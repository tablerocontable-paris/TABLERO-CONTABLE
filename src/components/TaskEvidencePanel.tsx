import { useEffect, useRef, useState } from "react";
import type { Profile, State, Task } from "../domain/model";
import type { TaskEvidence } from "../domain/laboratory-work";
import { canExecuteLab, isLabTaskLocked } from "../domain/laboratory-work";
import { acquireEvidenceMutationLock, reconcileEvidenceAgainstDurableState, reconcileEvidenceFromDurableState, removeStoredEvidence, readStoredEvidence, storeTaskEvidence } from "../data/laboratoryEvidence";
import { evidenceStorageErrorMessage } from "../data/evidenceErrors";
import { isLaboratoryStateCurrent, type CommitOutcome } from "../data/repository";
import { Panel } from "./ui";

export default function TaskEvidencePanel({ state, task, actor, commitLatest, notify, canAdd }: {
  state: State;
  task: Task;
  actor: Profile;
  commitLatest: (update: (current: State) => State | null, action?: string, entityId?: string) => CommitOutcome;
  notify: (message: string) => void;
  canAdd: boolean;
}) {
  const existing = (state.taskEvidence || []).filter((row) => row.taskId === task.id && row.activityId === null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function reportError(message: string) {
    if (mounted.current) setError(message);
    else notify(message);
  }

  async function save() {
    setError("");
    if (!files.length || !canAdd || busy) return;
    setBusy(true);
    let saved: Awaited<ReturnType<typeof storeTaskEvidence>> = [];
    let outcome: CommitOutcome | null = null;
    let releaseEvidenceLock: (() => void) | null = null;
    try {
      releaseEvidenceLock = await acquireEvidenceMutationLock();
      if (!isLaboratoryStateCurrent(state) || !await reconcileEvidenceAgainstDurableState(state)) {
        reportError("El laboratorio cambió en otra pestaña. Recargá la página antes de adjuntar evidencia.");
        return;
      }
      saved = await storeTaskEvidence(files, { taskId: task.id, activityId: null, profileId: actor.id, completionAt: task.status === "Completada" ? task.completedAt : null }, existing.length);
      outcome = commitLatest((current) => {
        const currentActor = current.profiles.find((row) => row.id === actor.id);
        const currentTask = current.tasks.find((row) => row.id === task.id);
        const count = (current.taskEvidence || []).filter((row) => row.taskId === task.id && row.activityId === null).length;
        if (current.activeId !== actor.id || !currentActor?.active || !currentTask ||
          isLabTaskLocked(current, currentTask) || !canExecuteLab(current, currentActor, currentTask) || count + saved.length > 3 ||
          saved.some((row) => row.profileId !== actor.id || row.taskId !== task.id || row.activityId !== null)) return null;
        const currentMetadata = current.taskEvidence || [];
        if (saved.some((row) => currentMetadata.some((existingRow) => existingRow.id === row.id))) return null;
        const completionAt = currentTask.status === "Completada" ? currentTask.completedAt : null;
        const reconciledEvidence = saved.map((row) => ({ ...row, completionAt }));
        return {
          ...current,
          taskEvidence: [...currentMetadata, ...reconciledEvidence],
          tasks: current.tasks.map((row) => row.id === task.id ? { ...row, evidenceIds: [...(row.evidenceIds || []), ...reconciledEvidence.map((evidence) => evidence.id)] } : row),
        };
      }, "Adjuntó evidencia al entregable", task.id);
      if (outcome.status === "rejected") {
        try {
          await removeStoredEvidence(saved.map((row) => row.id));
          reportError(outcome.reason === "storage"
            ? "No se pudo guardar el estado del trabajo. El archivo temporal se retiró y no quedó adjuntado."
            : outcome.reason === "preparation"
              ? "No se pudo preparar el cambio. El archivo temporal se retiró y no quedó adjuntado. Podés volver a intentar."
              : "El usuario, el permiso o el estado de la tarea cambió durante la carga. No se adjuntó ningún archivo.");
        } catch {
          try {
            await reconcileEvidenceFromDurableState();
            reportError("El trabajo no aceptó la evidencia. El archivo temporal se conservó para recuperación, pero ya no ocupa el cupo de adjuntos.");
          } catch {
            reportError("El trabajo no aceptó la evidencia. El archivo temporal se conservó para recuperación; no se pudo actualizar su cupo local.");
          }
        }
        return;
      }
      if (outcome.status === "unknown") {
        reportError("No se pudo confirmar si la evidencia quedó guardada. El archivo se conservó; revisá el entregable antes de reintentar.");
        return;
      }
      setFiles([]);
      notify("La evidencia quedó guardada en este laboratorio y asociada al entregable.");
    } catch (reason) {
      if (saved.length && outcome === null) {
        reportError("No se pudo determinar si la evidencia quedó vinculada. Los archivos se conservaron; revisá el entregable antes de reintentar.");
        return;
      }
      reportError(outcome?.status === "committed" ? "La evidencia quedó guardada, pero no se pudo mostrar la confirmación. Revisá el adjunto en el entregable." : outcome?.status === "unknown" ? "No se pudo confirmar si la evidencia quedó guardada. Los archivos se conservaron para evitar borrar evidencia vinculada; revisá el entregable antes de reintentar." : evidenceStorageErrorMessage(reason));
    } finally {
      releaseEvidenceLock?.();
      if (mounted.current) setBusy(false);
    }
  }

  return <Panel title={`Evidencia del entregable · ${existing.length}/3`} sub="Imágenes y PDF opcionales. Los archivos se guardan sólo en este navegador y se conservan al cerrar el mes." collapsible defaultOpen={false}>
    {existing.length > 0 && <EvidenceLinks records={existing} />}
    {error && <p role="alert" className="lab-evidence-error">{error}</p>}
    {canAdd && existing.length < 3 && <div className="lab-evidence-add">
      <label>Adjuntar imagen o PDF · opcional<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple disabled={busy} onChange={(event) => { setError(""); setFiles(Array.from(event.currentTarget.files || [])); }} /><small>Hasta {3 - existing.length} archivo(s): imágenes de 5 MB y PDF de 10 MB como máximo.</small></label>
      {files.map((file) => <small key={`${file.name}-${file.size}`}>{file.name} · {(file.size / 1024).toLocaleString("es-AR", { maximumFractionDigits: 0 })} KB</small>)}
      <button type="button" className="primary" disabled={!files.length || busy} aria-busy={busy} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar evidencia"}</button>
    </div>}
  </Panel>;
}

export function EvidenceLinks({ records }: { records: TaskEvidence[] }) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setPreviews({});
    Promise.all(records.map(async (row) => {
      try {
        const blob = await readStoredEvidence(row.id);
        if (!blob || cancelled) return [row.id, ""] as const;
        const url = URL.createObjectURL(blob);
        if (cancelled) { URL.revokeObjectURL(url); return [row.id, ""] as const; }
        urls.push(url);
        return [row.id, url] as const;
      } catch { return [row.id, ""] as const; }
    })).then((rows) => { if (!cancelled) setPreviews(Object.fromEntries(rows.filter(([, url]) => url))); });
    return () => { cancelled = true; urls.forEach((url) => { try { URL.revokeObjectURL(url); } catch { /* best effort browser cleanup */ } }); };
  }, [records]);
  if (!records.length) return null;
  return <div className="lab-evidence-list">{records.map((row) => <article key={row.id}>
    <div><b>{row.name}</b><small>{(row.size / 1024).toLocaleString("es-AR", { maximumFractionDigits: 0 })} KB · {row.mimeType === "application/pdf" ? "PDF" : "Imagen"} · {new Date(row.createdAt).toLocaleDateString("es-AR")}{row.completionAt ? ` · Finalización ${new Date(row.completionAt).toLocaleString("es-AR")}` : " · Sin vincular a una finalización"}</small></div>
    {previews[row.id] ? <a className="lab-evidence-open" href={previews[row.id]} target="_blank" rel="noreferrer">{row.mimeType.startsWith("image/") ? <img src={previews[row.id]} alt={`Vista previa · ${row.name}`} /> : null}<span>{row.mimeType === "application/pdf" ? "Abrir PDF" : "Abrir imagen"}</span></a> : <small>Archivo no disponible en este navegador</small>}
  </article>)}</div>;
}
