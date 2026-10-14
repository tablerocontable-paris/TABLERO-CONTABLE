import { useState, type FormEvent } from "react";
import type { Profile, State, Task } from "../domain/model";
import { updateTaskReadiness } from "../domain/laboratory-work";
import { Panel } from "./ui";

export default function TaskReadinessPanel({ state, task, actor, commit, notify }: {
  state: State;
  task: Task;
  actor: Profile;
  commit: (next: State, action?: string, entityId?: string) => boolean;
  notify: (message: string) => void;
}) {
  const [dependencies, setDependencies] = useState<string[]>(task.dependsOnTaskIds || []);
  const [availableFrom, setAvailableFrom] = useState(task.availableFrom || "");
  const candidates = state.tasks.filter((row) => row.id !== task.id && row.kind === "resultado" &&
    row.companyId === task.companyId && row.month === task.month && !row.responsibility);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const next = updateTaskReadiness(state, task.id, { dependsOnTaskIds: dependencies, availableFrom: availableFrom || null }, actor.id);
      if (commit(next, "Configuró dependencias y disponibilidad", task.id)) notify("La ruta sugerida se actualizó. No se inició la tarea ni el cronómetro.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo guardar la ruta de esta tarea.");
    }
  }

  const [year, month] = task.month.split("-").map(Number);
  const lastCalendarDay = String(new Date(year, month, 0).getDate()).padStart(2, "0");
  return <Panel title="Dependencias y disponibilidad" sub="La hoja de ruta explica qué puede empezar y qué debe esperar. Las sugerencias nunca inician trabajo." collapsible defaultOpen={false}>
    <form className="lab-readiness-form" onSubmit={save}>
      <fieldset>
        <legend>Esperar a que terminen estas tareas de {state.companies.find((row) => row.id === task.companyId)?.name}</legend>
        {!candidates.length ? <p className="note">No hay otros entregables individuales en esta empresa y período.</p> : candidates.map((candidate) => <label className="check-line" key={candidate.id}>
          <input type="checkbox" checked={dependencies.includes(candidate.id)} onChange={(event) => setDependencies((previous) => event.target.checked ? [...previous, candidate.id] : previous.filter((id) => id !== candidate.id))} />
          <span>{candidate.title}<small>{candidate.status} · {candidate.due || "sin vencimiento"}</small></span>
        </label>)}
      </fieldset>
      <label>Disponible desde<input type="date" value={availableFrom} min={`${task.month}-01`} max={`${task.month}-${lastCalendarDay}`} onChange={(event) => setAvailableFrom(event.target.value)} /><small>La fecha no libera otras esperas ni reemplaza el vencimiento.</small></label>
      <button className="primary">Guardar ruta sugerida</button>
    </form>
  </Panel>;
}
