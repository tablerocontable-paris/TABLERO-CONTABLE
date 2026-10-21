import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createOperationalTransport,
  type OperationalFailure,
} from "../data/supabase/operational-transport";
import type { ContextV1 } from "../data/supabase/context-contract";

type GateState =
  | { kind: "checking" }
  | { kind: "signedOut"; message?: string }
  | { kind: "loadingContext" }
  | { kind: "ready"; context: ContextV1 }
  | {
      kind: "mfaChallenge";
      factorId: string;
      challengeId: string;
      message?: string;
    }
  | {
      kind: "mfaEnrollment";
      factorId: string;
      qrCode: string;
      secret: string;
      message?: string;
    }
  | { kind: "unavailable"; message: string };

const failureMessage: Record<OperationalFailure, string> = {
  unauthenticated: "La sesión venció. Iniciá sesión nuevamente.",
  transport:
    "No pudimos conectar con el espacio de trabajo. Revisá tu conexión y reintentá.",
  server:
    "La cuenta todavía no tiene un perfil operativo habilitado o el servicio no está listo.",
  protocol:
    "La respuesta del servicio no coincide con la versión de la aplicación.",
};

/** Authenticates a real user and derives identity/scope from the server context. */
export default function SupabaseAuthGate({
  client,
  children,
}: {
  client: SupabaseClient;
  children: (context: ContextV1) => ReactNode;
}) {
  const [state, setState] = useState<GateState>({ kind: "checking" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [busy, setBusy] = useState(false);
  const requestRef = useRef(0);
  const reloadContextRef = useRef<(() => Promise<void>) | null>(null);
  const transport = useRef(createOperationalTransport(client)).current;

  useEffect(() => {
    let mounted = true;
    const loadContext = async () => {
      const request = ++requestRef.current;
      const isCurrent = () => mounted && request === requestRef.current;
      if (mounted) setState({ kind: "loadingContext" });
      let result: Awaited<ReturnType<typeof transport.getContext>>;
      try {
        result = await transport.getContext();
      } catch {
        if (isCurrent())
          setState({ kind: "unavailable", message: failureMessage.transport });
        return;
      }
      if (!isCurrent()) return;
      if (result.ok && result.value) {
        const context = result.value;
        if (!context.authentication.requiresMfa) {
          setState({ kind: "ready", context });
          return;
        }

        try {
          const assurance =
            await client.auth.mfa.getAuthenticatorAssuranceLevel();
          if (!isCurrent()) return;
          if (assurance.error) throw assurance.error;
          if (assurance.data.currentLevel === "aal2") {
            setState({
              kind: "unavailable",
              message:
                "La sesión y los permisos no coinciden. Cerrá sesión y volvé a ingresar.",
            });
            return;
          }

          const listed = await client.auth.mfa.listFactors();
          if (!isCurrent()) return;
          if (listed.error) throw listed.error;
          const verifiedFactors = listed.data.totp.filter(
            (item) => item.status === "verified",
          );
          const pendingFactors = listed.data.totp.filter(
            (item) => item.status !== "verified",
          );
          if (verifiedFactors.length > 1 || (!verifiedFactors.length && pendingFactors.length > 1)) {
            throw new Error("Ambiguous TOTP factors require administrator review");
          }
          const factor = verifiedFactors[0] ?? pendingFactors[0];
          if (factor) {
            const challenge = await client.auth.mfa.challenge({
              factorId: factor.id,
            });
            if (!isCurrent()) return;
            if (challenge.error) throw challenge.error;
            setState({
              kind: "mfaChallenge",
              factorId: factor.id,
              challengeId: challenge.data.id,
            });
            return;
          }

          const enrollment = await client.auth.mfa.enroll({
            factorType: "totp",
            friendlyName: "Grupo París",
          });
          if (!isCurrent()) return;
          if (enrollment.error) throw enrollment.error;
          const { qr_code: qrCode, secret } = enrollment.data.totp;
          if (!qrCode.startsWith("data:image/svg+xml") || !secret) {
            throw new Error("Invalid authenticator enrollment response");
          }
          setState({
            kind: "mfaEnrollment",
            factorId: enrollment.data.id,
            qrCode,
            secret,
          });
        } catch {
          if (isCurrent())
            setState({
              kind: "unavailable",
              message:
                "No pudimos preparar la verificación de seguridad. Reintentá o contactá a administración.",
            });
        }
      } else {
        setState({
          kind: "unavailable",
          message: result.ok
            ? failureMessage.protocol
            : failureMessage[result.error],
        });
      }
    };

    const unsubscribe = transport.subscribeAuth((authenticated) => {
      const request = ++requestRef.current;
      setBusy(false);
      setPassword("");
      setMfaCode("");
      if (!authenticated) {
        setState({ kind: "signedOut" });
        return;
      }
      setState({ kind: "loadingContext" });
      // Defer the RPC until Supabase has completed the auth callback.
      queueMicrotask(() => {
        if (mounted && request === requestRef.current) void loadContext();
      });
    });
    reloadContextRef.current = loadContext;

    const initialRequest = requestRef.current;
    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted || requestRef.current !== initialRequest) return;
        if (error) {
          setState({
            kind: "unavailable",
            message: "No pudimos revisar la sesión. Reintentá.",
          });
        } else if (data.session?.access_token) {
          void loadContext();
        } else {
          setState({ kind: "signedOut" });
        }
      })
      .catch(() => {
        if (mounted && requestRef.current === initialRequest)
          setState({
            kind: "unavailable",
            message: "No pudimos revisar la sesión. Reintentá.",
          });
      });

    return () => {
      mounted = false;
      requestRef.current += 1;
      reloadContextRef.current = null;
      unsubscribe();
    };
  }, [client, transport]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = requestRef.current;
    setBusy(true);
    setState({ kind: "signedOut" });
    try {
      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error && request === requestRef.current)
        setState({
          kind: "signedOut",
          message:
            "No pudimos validar esos datos. Revisá el correo y la contraseña.",
        });
      // A successful auth event advances the request generation and loads the
      // server-derived context through the subscription callback.
    } catch {
      if (request === requestRef.current)
        setState({
          kind: "signedOut",
          message: "No pudimos iniciar sesión. Revisá tu conexión y reintentá.",
        });
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  async function signOut() {
    const request = requestRef.current;
    setBusy(true);
    try {
      const { error } = await client.auth.signOut();
      if (error && request === requestRef.current)
        setState({
          kind: "unavailable",
          message: "No pudimos cerrar la sesión. Reintentá.",
        });
    } catch {
      if (request === requestRef.current)
        setState({
          kind: "unavailable",
          message: "No pudimos cerrar la sesión. Reintentá.",
        });
    } finally {
      setBusy(false);
    }
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind !== "mfaChallenge" && state.kind !== "mfaEnrollment") return;
    const current = state;
    const request = requestRef.current;
    const isCurrent = () => request === requestRef.current;
    setBusy(true);
    try {
      let challengeId: string;
      if (current.kind === "mfaChallenge") {
        challengeId = current.challengeId;
      } else {
        const challenge = await client.auth.mfa.challenge({
          factorId: current.factorId,
        });
        if (!isCurrent()) return;
        if (challenge.error) throw challenge.error;
        challengeId = challenge.data.id;
      }
      const verified = await client.auth.mfa.verify({
        factorId: current.factorId,
        challengeId,
        code: mfaCode,
      });
      if (!isCurrent()) return;
      if (verified.error) throw verified.error;
      setMfaCode("");
      await reloadContextRef.current?.();
    } catch {
      if (!isCurrent()) return;
      setMfaCode("");
      setState({
        ...current,
        message:
          "El código no se pudo verificar. Revisá el código e intentá otra vez.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "checking" || state.kind === "loadingContext") {
    return (
      <main className="supabase-auth-shell" aria-live="polite">
        {state.kind === "checking"
          ? "Revisando la sesión…"
          : "Cargando tu espacio de trabajo…"}
      </main>
    );
  }
  if (state.kind === "ready") {
    return (
      <>
        {children(state.context)}
        <div className="supabase-session">
          <span>
            {state.context.principal.displayName} ·{" "}
            {state.context.principal.role}
          </span>
          <button type="button" onClick={() => void signOut()} disabled={busy}>
            Cerrar sesión
          </button>
        </div>
      </>
    );
  }
  if (state.kind === "unavailable") {
    return (
      <main className="supabase-auth-shell">
        <section className="supabase-auth-card">
          <h1>Espacio de trabajo no disponible</h1>
          <p role="alert">{state.message}</p>
          <button
            type="button"
            className="primary"
            onClick={() => location.reload()}
          >
            Reintentar
          </button>
        </section>
      </main>
    );
  }
  if (state.kind === "mfaChallenge" || state.kind === "mfaEnrollment") {
    return (
      <main className="supabase-auth-shell">
        <form
          className="supabase-auth-card"
          onSubmit={(event) => void verifyMfa(event)}
        >
          <h1>
            {state.kind === "mfaChallenge"
              ? "Verificá tu identidad"
              : "Activá la verificación en dos pasos"}
          </h1>
          {state.kind === "mfaEnrollment" ? (
            <>
              <p>
                Escaneá este código con tu aplicación autenticadora. Si no podés
                escanearlo, ingresá la clave manual.
              </p>
              <img
                className="supabase-mfa-qr"
                src={state.qrCode}
                alt="Código QR para configurar el autenticador"
              />
              <code className="supabase-mfa-secret">{state.secret}</code>
            </>
          ) : (
            <p>Ingresá el código temporal de tu aplicación autenticadora.</p>
          )}
          {state.message && (
            <p role="alert" className="supabase-auth-error">
              {state.message}
            </p>
          )}
          <label>
            Código de verificación
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,8}"
              minLength={6}
              maxLength={8}
              required
              value={mfaCode}
              onChange={(event) =>
                setMfaCode(event.target.value.replace(/\D/g, ""))
              }
            />
          </label>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Verificando…" : "Verificar e ingresar"}
          </button>
          <button type="button" onClick={() => void signOut()} disabled={busy}>
            Cancelar y cerrar sesión
          </button>
        </form>
      </main>
    );
  }
  return (
    <main className="supabase-auth-shell">
      <form
        className="supabase-auth-card"
        onSubmit={(event) => void signIn(event)}
      >
        <h1>Ingresar a Grupo París</h1>
        <p>
          Usá tu cuenta de trabajo. Tu perfil y permisos se determinan desde la
          organización.
        </p>
        {state.message && (
          <p role="alert" className="supabase-auth-error">
            {state.message}
          </p>
        )}
        <label>
          Correo electrónico
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
