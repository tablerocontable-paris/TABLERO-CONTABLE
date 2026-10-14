import { useState } from "react";
import { saveOperationalAssessment } from "../domain/laboratory-work";
import type { Profile, State } from "../domain/model";
import { Panel } from "./ui";

export default function OperationalQualityReview({ state, actor, tasks, commit, notify, companyOf, nameOf }: {
  state: State; actor: Profile; tasks: State["tasks"]; commit: (next: State, action?: string, entityId?: string) => boolean;
  notify: (message: string) => void; companyOf: (id: string) => string; nameOf: (id: string) => string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  if (actor.role !== "jefe") return null;
  const rows = tasks.filter((task) => task.kind === "operativa" && !task.responsibility);
  return <Panel title="Revisión de calidad operativa" sub="Evaluación opcional de calidad, orden y oportunidad. No se suma al cumplimiento ni a la carga atendida." collapsible defaultOpen={false}>
    {!rows.length ? <p className="note">No hay operativas individuales en el filtro actual.</p> : <div className="lab-assessment-list">{rows.map((task) => {
      const assessment = (state.operationalAssessments || []).find((row) => row.taskId === task.id);
      return <article key={task.id}>
        <div><b>{task.title}</b><span>{nameOf(task.ownerId)} · {companyOf(task.companyId)}</span><small>{assessment ? `Calidad ${assessment.quality} · Orden ${assessment.order} · Oportunidad ${assessment.timeliness}` : "Sin evaluar"}</small></div>
        <button type="button" onClick={() => setEditing(editing === task.id ? null : task.id)}>{assessment ? "Ver o actualizar" : "Evaluar"}</button>
        {editing === task.id && <form className="lab-assessment-form" onSubmit={(event) => {
          event.preventDefault(); const data = new FormData(event.currentTarget);
          try {
            const next = saveOperationalAssessment(state, actor.id, { taskId: task.id,
              quality: Number(data.get("quality")), order: Number(data.get("order")), timeliness: Number(data.get("timeliness")), note: String(data.get("note") || "") });
            if (commit(next, "Evaluó calidad operativa", task.id)) { setEditing(null); notify("Evaluación de calidad guardada por separado del cumplimiento."); }
          } catch (error) { notify(error instanceof Error ? error.message : "No se pudo guardar la evaluación."); }
        }}>
          <label>Calidad<input name="quality" type="number" min="0" max="100" defaultValue={assessment?.quality ?? 80} required /></label>
          <label>Orden<input name="order" type="number" min="0" max="100" defaultValue={assessment?.order ?? 80} required /></label>
          <label>Oportunidad<input name="timeliness" type="number" min="0" max="100" defaultValue={assessment?.timeliness ?? 80} required /></label>
          <label className="lab-assessment-note">Observación<input name="note" minLength={5} maxLength={1000} defaultValue={assessment?.note || ""} placeholder="Explicá el criterio y la evidencia observada" required /></label>
          <button className="primary">Guardar evaluación</button>
        </form>}
      </article>;
    })}</div>}
  </Panel>;
}
