import { useState } from "react";
import { saveOperationalRate } from "../domain/laboratory-work";
import { dateART, type Profile, type State } from "../domain/model";
import { Panel } from "./ui";

export default function OperationalRatePanel({ state, actor, commit, notify, company }: {
  state: State; actor: Profile; commit: (next: State, action?: string, entityId?: string) => boolean;
  notify: (message: string) => void; company?: string;
}) {
  const [targetKind, setTargetKind] = useState<"template" | "task">("template");
  const [templateId, setTemplateId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [companyId, setCompanyId] = useState(() => company && state.companies.some((row) => row.id === company)
    ? company : state.companies[0]?.id || "");
  const [effectiveOn, setEffectiveOn] = useState(dateART);
  const [weight, setWeight] = useState("1");
  if (actor.role !== "jefe") return null;
  const templates = state.templates.filter((template) => template.kind === "operativa");
  const tasks = state.tasks.filter((task) => task.kind === "operativa" && task.companyId === companyId);
  const recent = (state.operationalRates || []).filter((rate) => !company || rate.companyId === company)
    .slice().sort((a, b) => b.effectiveOn.localeCompare(a.effectiveOn) || b.version - a.version);
  return <Panel title="Coeficientes por movimiento" sub="La tarifa se versiona por empresa y vigencia. Cada movimiento conserva el coeficiente que tenía al registrarse." collapsible defaultOpen={false}>
    <form className="lab-rate-form" onSubmit={(event) => {
      event.preventDefault();
      try {
        const template = targetKind === "template" ? templates.find((row) => row.id === templateId) : undefined;
        const task = targetKind === "task" ? tasks.find((row) => row.id === taskId) : undefined;
        if (targetKind === "template" && !template) throw new Error("Elegí una operativa del catálogo.");
        if (targetKind === "task" && !task) throw new Error("Elegí una tarea operativa vigente de la empresa seleccionada.");
        const next = saveOperationalRate(state, actor.id, { templateId: template?.id || null, taskId: task?.id || null, companyId,
          effectiveOn, unitWeight: Number(weight) });
        if (commit(next, "Versionó coeficiente de carga operativa", task?.id || template!.id)) notify("Coeficiente guardado; los registros anteriores mantienen su peso original.");
      } catch (error) { notify(error instanceof Error ? error.message : "No se pudo guardar el coeficiente."); }
    }}>
      <label>Aplicar a<select value={targetKind} onChange={(event) => setTargetKind(event.target.value as "template" | "task")}><option value="template">Actividad del catálogo</option><option value="task">Tarea puntual</option></select></label>
      <label>Empresa<select required value={companyId} onChange={(event) => { setCompanyId(event.target.value); setTaskId(""); }}>{state.companies.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      {targetKind === "template" ? <label>Actividad<select required value={templateId} onChange={(event) => setTemplateId(event.target.value)}><option value="">Elegir operativa</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.title} · {template.unit || "movimientos"}</option>)}</select></label>
        : <label>Tarea puntual<select required value={taskId} onChange={(event) => setTaskId(event.target.value)}><option value="">Elegir tarea</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title} · {state.companies.find((row) => row.id === task.companyId)?.name} · {task.month} · {task.unit || "movimientos"}</option>)}</select></label>}
      <label>Vigente desde<input required type="date" value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /></label>
      <label>Peso por movimiento<input required type="number" min="0.01" max="1000000" step="0.01" value={weight} onChange={(event) => setWeight(event.target.value)} /></label>
      <button className="primary">Guardar nueva versión</button>
    </form>
    {recent.length ? <div className="table-wrap"><table><thead><tr><th>Actividad</th><th>Empresa</th><th>Versión</th><th>Peso</th><th>Desde</th></tr></thead><tbody>{recent.map((rate) => <tr key={rate.id}><td>{templates.find((row) => row.id === rate.templateId)?.title || state.tasks.find((task) => task.id === rate.taskId)?.title}</td><td>{state.companies.find((row) => row.id === rate.companyId)?.name}</td><td>v{rate.version}</td><td>{rate.unitWeight}</td><td>{rate.effectiveOn}</td></tr>)}</tbody></table></div> : <p className="note">Sin coeficientes configurados. Las cantidades y el tiempo se conservan; la carga ponderada queda pendiente.</p>}
  </Panel>;
}
