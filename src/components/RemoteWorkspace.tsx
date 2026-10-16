import { useEffect, useRef, useState } from "react";
import App from "../App";
import type { State } from "../domain/model";
import {
  readWorkspace,
  saveWorkspace,
  WorkspaceError,
  type WorkspaceResponse,
} from "../data/site-client";

type PendingSave = {
  state: State;
  baseRevision: number;
  action?: string;
  entityId?: string;
  resolve: ((s: State) => void)[];
  reject: ((e: Error) => void)[];
  error?: Error;
  errorCode?: number;
};
// Retain an unconfirmed proposal across a component remount.
let detachedProposal: PendingSave | null = null;
let detachedSaveInFlight = false;
const saveSettlementEvent = "paris-workspace-save-settled";
function notifySaveSettlement() {
  window.dispatchEvent(new Event(saveSettlementEvent));
}

export default function RemoteWorkspace() {
  const [data, setData] = useState<WorkspaceResponse | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<
    "loading" | "saved" | "pending" | "saving" | "error"
  >("loading");
  const [errorCode, setErrorCode] = useState(0);
  const revision = useRef(0);
  const pending = useRef<PendingSave | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const lastData = useRef<WorkspaceResponse | null>(null);
  const generation = useRef(0);
  const readSequence = useRef(0);
  const opening = useRef(false);
  const currentView = useRef("");
  const mounted = useRef(false);
  async function open(viewId = "") {
    if (pending.current || busy.current) return;
    const requestGeneration = ++generation.current;
    const requestSequence = ++readSequence.current;
    const requestedView = viewId;
    currentView.current = requestedView;
    opening.current = true;
    if (mounted.current) {
      setStatus("loading");
      setError("");
    }
    try {
      const result = await readWorkspace(requestedView);
      if (requestGeneration !== generation.current || requestSequence !== readSequence.current || requestedView !== currentView.current || pending.current || busy.current) return;
      revision.current = result.revision;
      lastData.current = result;
      if (mounted.current) {
        setData(result);
        setStatus("saved");
      }
    } catch (e) {
      if (requestGeneration !== generation.current || requestSequence !== readSequence.current || requestedView !== currentView.current || pending.current || busy.current) return;
      if (mounted.current) {
        setError((e as Error).message);
        setErrorCode(e instanceof WorkspaceError ? e.status : 0);
        setStatus("error");
      }
    } finally {
      if (requestSequence === readSequence.current) opening.current = false;
    }
  }
  useEffect(() => {
    mounted.current = true;
    if (detachedProposal) {
      pending.current = detachedProposal;
      setStatus("error");
      setError(detachedProposal.error?.message || "Hay una propuesta pendiente de un guardado anterior. Reintentala o descargala antes de cargar otra versión.");
      setErrorCode(detachedProposal.errorCode ?? 0);
    }
    const settled = () => {
      if (!mounted.current) return;
      if (detachedProposal) {
        pending.current = detachedProposal;
        setError(detachedProposal.error?.message || "Hay una propuesta pendiente de un guardado anterior.");
        setErrorCode(detachedProposal.errorCode ?? 0);
        setStatus("error");
      } else {
        pending.current = null;
        void open(currentView.current);
      }
    };
    window.addEventListener(saveSettlementEvent, settled);
    if (!detachedSaveInFlight) void open();
    return () => {
      mounted.current = false;
      generation.current += 1;
      readSequence.current += 1;
      opening.current = false;
      window.removeEventListener(saveSettlementEvent, settled);
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (pending.current) {
        detachedProposal = pending.current;
        const reason = new WorkspaceError("La pantalla se cerró antes de confirmar el guardado. La propuesta quedó conservada para reintentar o descargar.", 0, "transport");
        pending.current.error = reason;
        pending.current.errorCode = 0;
        pending.current.reject.forEach((reject) => reject(reason));
        pending.current.resolve = [];
        pending.current.reject = [];
      }
    };
  }, []);
  useEffect(() => {
    const interval = setInterval(async () => {
      if (busy.current || pending.current || opening.current || !lastData.current) return;
      const requestGeneration = generation.current;
      const requestSequence = ++readSequence.current;
      const requestedView = currentView.current;
      try {
        const result = await readWorkspace(requestedView);
        if (requestGeneration !== generation.current || requestSequence !== readSequence.current || requestedView !== currentView.current || busy.current || pending.current) return;
        revision.current = result.revision;
        lastData.current = result;
        if (mounted.current) setData(result);
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
    if (!job || busy.current || detachedSaveInFlight) return;
    busy.current = true;
    detachedSaveInFlight = true;
    const requestGeneration = generation.current;
    const requestView = currentView.current;
    if (mounted.current) {
      setStatus("saving");
      setError("");
    }
    try {
      const result = await saveWorkspace(
        job.state,
        job.baseRevision,
        job.action,
        job.entityId,
      );
      if (requestGeneration === generation.current && requestView === currentView.current) {
        revision.current = result.revision;
        lastData.current = result;
        if (mounted.current) setData(result);
      }
      pending.current = null;
      if (detachedProposal === job) detachedProposal = null;
      if (mounted.current) setStatus("saved");
      job.resolve.forEach((r) => r(result.state));
    } catch (e) {
      detachedProposal = job;
      job.error = e as Error;
      job.errorCode = e instanceof WorkspaceError ? e.status : 0;
      if (mounted.current) {
        setError((e as Error).message);
        setErrorCode(e instanceof WorkspaceError ? e.status : 0);
        setStatus("error");
      }
      // Keep the proposal in memory for retry/download. Never silently overwrite a newer revision.
      job.reject.forEach((r) => r(e as Error));
      job.resolve = [];
      job.reject = [];
    } finally {
      busy.current = false;
      detachedSaveInFlight = false;
      notifySaveSettlement();
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
      generation.current += 1;
      readSequence.current += 1;
      opening.current = false;
      currentView.current = state.activeId;
      pending.current = {
        state,
        baseRevision: old?.baseRevision ?? revision.current,
        action: action || old?.action,
        entityId: entityId || old?.entityId,
        resolve: [...(old?.resolve || []), resolve],
        reject: [...(old?.reject || []), reject],
      };
      detachedProposal = pending.current;
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
  function discardPendingAndOpen(viewId: string) {
    const abandoned = pending.current;
    if (timer.current) clearTimeout(timer.current);
    abandoned?.reject.forEach((reject) => reject(new WorkspaceError("Se descartó la propuesta pendiente para cargar la versión guardada.", 409)));
    pending.current = null;
    detachedProposal = null;
    generation.current += 1;
    readSequence.current += 1;
    opening.current = false;
    void open(viewId);
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
        {pending.current ? (
          <>
            <p role="alert">{error || "Hay un cambio que todavía no se confirmó."}</p>
            {errorCode !== 409 && <button disabled={detachedSaveInFlight} onClick={() => void flush()}>Reintentar guardado</button>}
            <button onClick={downloadProposal}>Descargar cambio pendiente</button>
            <button disabled={detachedSaveInFlight} onClick={() => discardPendingAndOpen(pending.current!.state.activeId)}>Descartar cambio y cargar versión guardada</button>
          </>
        ) : errorCode === 401 ? (
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
                discardPendingAndOpen(data.state.activeId);
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
