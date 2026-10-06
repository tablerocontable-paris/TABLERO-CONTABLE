import { useEffect, useRef, useState } from "react";
import App from "../App";
import type { State } from "../domain/model";
import {
  readWorkspace,
  saveWorkspace,
  WorkspaceError,
  type WorkspaceResponse,
} from "../data/site-client";

export default function RemoteWorkspace() {
  const [data, setData] = useState<WorkspaceResponse | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<
    "loading" | "saved" | "pending" | "saving" | "error"
  >("loading");
  const [errorCode, setErrorCode] = useState(0);
  const revision = useRef(0);
  const pending = useRef<{
    state: State;
    action?: string;
    entityId?: string;
    resolve: ((s: State) => void)[];
    reject: ((e: Error) => void)[];
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const lastData = useRef<WorkspaceResponse | null>(null);
  async function open(view = "") {
    setStatus("loading");
    setError("");
    try {
      const result = await readWorkspace(view);
      revision.current = result.revision;
      lastData.current = result;
      setData(result);
      setStatus("saved");
    } catch (e) {
      setError((e as Error).message);
      setErrorCode(e instanceof WorkspaceError ? e.status : 0);
      setStatus("error");
    }
  }
  useEffect(() => {
    void open();
  }, []);
  useEffect(() => {
    const interval = setInterval(async () => {
      if (busy.current || pending.current || !lastData.current) return;
      try {
        const result = await readWorkspace(lastData.current.state.activeId);
        revision.current = result.revision;
        lastData.current = result;
        setData(result);
      } catch {
        /* The next action reports a connection failure without discarding the page. */
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current || busy.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  async function flush() {
    const job = pending.current;
    if (!job || busy.current) return;
    busy.current = true;
    setStatus("saving");
    setError("");
    try {
      const result = await saveWorkspace(
        job.state,
        revision.current,
        job.action,
        job.entityId,
      );
      revision.current = result.revision;
      lastData.current = result;
      setData(result);
      pending.current = null;
      setStatus("saved");
      job.resolve.forEach((r) => r(result.state));
    } catch (e) {
      setError((e as Error).message);
      setErrorCode(e instanceof WorkspaceError ? e.status : 0);
      setStatus("error");
      // Keep the proposal in memory for retry/download. Never silently overwrite a newer revision.
      job.reject.forEach((r) => r(e as Error));
      job.resolve = [];
      job.reject = [];
    } finally {
      busy.current = false;
    }
  }
  function save(
    state: State,
    action?: string,
    entityId?: string,
  ): Promise<State> {
    return new Promise((resolve, reject) => {
      if (busy.current) {
        reject(new Error("Esperá a que termine el guardado."));
        return;
      }
      const old = pending.current;
      pending.current = {
        state,
        action: action || old?.action,
        entityId: entityId || old?.entityId,
        resolve: [...(old?.resolve || []), resolve],
        reject: [...(old?.reject || []), reject],
      };
      if (timer.current) clearTimeout(timer.current);
      setStatus("pending");
      timer.current = setTimeout(() => {
        void flush();
      }, 450);
    });
  }
  function downloadProposal() {
    if (!pending.current) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(pending.current.state, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "propuesta-tablero-sin-guardar.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  if (!data)
    return (
      <main className="fatal">
        <img width="170" src="/logo-grupo-paris.svg" alt="Grupo París" />
        <h1>
          {status === "loading"
            ? "Abriendo tu tablero…"
            : "No pudimos abrir el tablero"}
        </h1>
        {error && <p role="alert">{error}</p>}
        {errorCode === 401 ? (
          <a
            className="primary"
            href="/signin-with-chatgpt?return_to=%2F"
            target="_top"
          >
            Iniciar sesión con ChatGPT
          </a>
        ) : (
          status === "error" && (
            <button onClick={() => void open()}>Reintentar</button>
          )
        )}
      </main>
    );
  return (
    <>
      <div
        className={"sync-status " + (status === "error" ? "sync-error" : "")}
        role="status"
        aria-live="polite"
      >
        <span>
          {status === "saving"
            ? "Guardando…"
            : status === "pending"
              ? "Guardado pendiente…"
              : status === "loading"
                ? "Actualizando…"
                : status === "error"
                  ? error
                  : "Guardado en el servidor · acceso privado"}
        </span>
        {status === "error" && (
          <>
            {pending.current && (
              <button onClick={downloadProposal}>
                Descargar cambio pendiente
              </button>
            )}
            {errorCode !== 409 && pending.current && (
              <button onClick={() => void flush()}>Reintentar guardado</button>
            )}
            <button
              onClick={() => {
                pending.current = null;
                void open(data.state.activeId);
              }}
            >
              Cargar versión guardada
            </button>
          </>
        )}
      </div>
      <div
        inert={
          status === "saving" || status === "loading" || status === "error"
        }
      >
        <App
          key={data.state.activeId}
          initialState={data.state}
          remoteSave={save}
          remoteOwner={data.isOwner}
          presence={data.presence}
          onView={(view) => {
            if (pending.current) {
              setError(
                "Esperá a que se guarde el cambio antes de cambiar de espacio.",
              );
              return;
            }
            void open(view);
          }}
        />
      </div>
    </>
  );
}
