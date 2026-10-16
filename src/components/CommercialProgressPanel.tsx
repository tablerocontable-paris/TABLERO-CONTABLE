import { useEffect, useState, type FormEvent } from "react";
import type { Profile, State, Task } from "../domain/model";
import { setCommercialTracking, updateCommercialProgress } from "../domain/laboratory-work";
import { Panel } from "./ui";

export default function CommercialProgressPanel({ state, task, actor, commit, notify, canUpdate, canComplete, onComplete }: {
  state: State;
  task: Task;
  actor: Profile;
  commit: (next: State, action?: string, entityId?: string) => boolean;
  notify: (message: string) => void;
  canUpdate: boolean;
  canComplete: boolean;
  onComplete: () => void;
}) {
  const [day, setDay] = useState(String(task.commercialProgress?.throughDay ?? 0));
  useEffect(() => setDay(String(task.commercialProgress?.throughDay ?? 0)), [task.id, task.commercialProgress?.throughDay]);
  const isBoss = actor.role === "jefe";
  const closed = task.status === "Completada";
  const allChecksDone = task.checklist.every((check) => check.done);

  function enable(enabled: boolean) {
    try {
      const next = setCommercialTracking(state, task.id, enabled, actor.id);
      if (commit(next, enabled ? "Activó seguimiento de período comercial" : "Desactivó seguimiento de período comercial", task.id))
        notify(enabled ? "Se habilitó el seguimiento de 30 días comerciales." : "Se desactivó el seguimiento de período comercial.");
    } catch (error) { notify(error instanceof Error ? error.message : "No se pudo cambiar el seguimiento comercial."); }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const next = updateCommercialProgress(state, task.id, Number(day), actor.id);
      if (commit(next, `Actualizó conciliación hasta día comercial ${day}`, task.id)) notify("Se guardó el avance de la conciliación.");
    } catch (error) { notify(error instanceof Error ? error.message : "No se pudo guardar el avance."); }
  }

  return <Panel title="Seguimiento de período comercial" sub="Opcional para conciliaciones. Usa 30 días comerciales, independientemente de los días reales del mes." collapsible defaultOpen={task.commercialTrackingEnabled === true}>
    {!task.commercialTrackingEnabled ? <>
      <p className="note">Este seguimiento no modifica vencimientos ni crea fechas como el 30 de febrero.</p>
      {isBoss && <button type="button" disabled={closed} onClick={() => enable(true)}>Activar seguimiento 0–30</button>}
      {!isBoss && <p>La jefatura todavía no habilitó este seguimiento.</p>}
    </> : <>
      <div className="commercial-progress-summary"><b>Día {task.commercialProgress?.throughDay ?? 0} de 30</b><span>{task.commercialProgress?.throughDay === 30 ? "Período conciliado" : "Conciliación en curso"}</span></div>
      <form className="commercial-progress-form" onSubmit={save}>
        <label>Conciliado hasta día comercial<input type="number" min="0" max="30" step="1" required value={day} disabled={!canUpdate || closed} onChange={(event) => setDay(event.target.value)} /></label>
        <button disabled={!canUpdate || closed}>Guardar avance</button>
      </form>
      {task.commercialProgress?.throughDay === 30 && <div className="commercial-completion-prompt">
        {allChecksDone ? <><p>El día 30 habilita la propuesta de cierre; revisá los controles y confirmá la finalización.</p><button type="button" className="primary" disabled={!canComplete || closed || task.status !== "En curso"} onClick={() => {
          if (window.confirm("¿Confirmás que esta conciliación está completa hasta el día comercial 30 y que todos sus controles están verificados?")) onComplete();
        }}>Confirmar conciliación completa</button></> : <p>El día 30 quedó registrado. Completá los {task.checklist.filter((check) => !check.done).length} controles pendientes antes de confirmar.</p>}
      </div>}
      {isBoss && <button type="button" className="text-button" disabled={closed} onClick={() => enable(false)}>Quitar seguimiento</button>}
    </>}
  </Panel>;
}
