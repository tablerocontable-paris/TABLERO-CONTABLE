import type { SupabaseClient } from "@supabase/supabase-js";
import LaboratoryWorkspace from "./components/LaboratoryWorkspace";
import SupabaseAuthGate from "./components/SupabaseAuthGate";
import {
  createSupabaseBrowserClient,
  type SupabaseBrowserClientResult,
} from "./data/supabase/client";
import type { ContextV1 } from "./data/supabase/context-contract";

export type BootstrapEnvironment = Record<string, unknown> & {
  VITE_SUPABASE_AUTH_BOOTSTRAP?: unknown;
};

export type ApplicationBootstrapState =
  | { mode: "laboratory" }
  | { mode: "configuration-error"; reason: "missing" | "invalid" }
  | { mode: "remote-diagnostic"; client: SupabaseClient };

export type ClientFactory = (env: Record<string, unknown>) => SupabaseBrowserClientResult;

/** Resolve the opt-in before React renders; the factory is never called by a component. */
export function resolveApplicationBootstrap(
  env: BootstrapEnvironment,
  clientFactory: ClientFactory = createSupabaseBrowserClient,
): ApplicationBootstrapState {
  if (env.VITE_SUPABASE_AUTH_BOOTSTRAP !== "true") {
    return { mode: "laboratory" };
  }

  const result = clientFactory(env);
  return result.ok
    ? { mode: "remote-diagnostic", client: result.client }
    : { mode: "configuration-error", reason: result.reason };
}

function DiagnosticWorkspace({ context }: { context: ContextV1 }) {
  return (
    <main className="supabase-auth-shell" aria-labelledby="diagnostic-title">
      <section className="supabase-auth-card">
        <h1 id="diagnostic-title">Acceso verificado</h1>
        <p>La autenticación está activa en modo diagnóstico.</p>
        <dl>
          <dt>Perfil</dt>
          <dd>{context.principal.role}</dd>
          <dt>Permisos disponibles</dt>
          <dd>{context.capabilities.length}</dd>
        </dl>
        <p>El espacio operativo todavía no está habilitado.</p>
      </section>
    </main>
  );
}

/** Pure view over bootstrap state already resolved before createRoot. */
export function ApplicationBootstrap({
  bootstrap,
}: {
  bootstrap: ApplicationBootstrapState;
}) {
  if (bootstrap.mode === "laboratory") return <LaboratoryWorkspace />;
  if (bootstrap.mode === "configuration-error") {
    const reason = bootstrap.reason === "missing" ? "falta" : "no es válida";
    return (
      <main className="fatal" role="alert">
        <h1>No se puede iniciar el acceso de prueba.</h1>
        <p>
          La configuración del acceso a Supabase {reason}. Revisá
          VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY. El laboratorio no
          se abrirá como alternativa.
        </p>
      </main>
    );
  }

  return (
    <SupabaseAuthGate client={bootstrap.client}>
      {(context) => <DiagnosticWorkspace context={context} />}
    </SupabaseAuthGate>
  );
}
