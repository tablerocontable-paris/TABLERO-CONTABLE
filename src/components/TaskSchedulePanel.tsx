import { useState, type FormEvent } from "react";
import type { Profile, State, Task } from "../domain/model";
import { canRescheduleLabTask, rescheduleLabTask } from "../domain/laboratory-work";

export default function TaskSchedulePanel({ state, task, actor, commit, notify }: {
  state: State;
  task: Task;
  actor: Profile;
  commit: (next: State, action?: string, entityId?: string) => boolean;
  notify: (message: string) => void;
}) {
  const [scheduledOn, setScheduledOn] = useState(task.scheduledOn || task.due || task.month + "-01");
  const [reason, setReason] = useState("");
  if (!canRescheduleLabTask(state, actor, task)) return null;
  const [year, month] = task.month.split("-").map(Number);
  const firstDay = `${task.month}-01`;
  const lastDay = `${task.month}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const next = rescheduleLabTask(state, task.id, scheduledOn, reason, actor.id);
      if (commit(next, `Reprogramó la tarea para ${scheduledOn}: ${reason.trim()}`, task.id)) {
        setReason("");
        notify("Nueva fecha guardada y avisos enviados a las personas autorizadas.");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo reprogramar la tarea.");
    }
  }

  return <details className="task-schedule-panel">
    <summary>Reprogramar esta tarea</summary>
    <p>Modifica sólo esta aparición. Conserva el período contable, el vencimiento y la regla recurrente.</p>
    <form onSubmit={save}>
      <label>Fecha programada<input type="date" min={firstDay} max={lastDay} required value={scheduledOn} onChange={(event) => setScheduledOn(event.target.value)} /></label>
      <label>Motivo<textarea required minLength={5} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <button className="primary" type="submit">Guardar fecha</button>
    </form>
  </details>;
}
