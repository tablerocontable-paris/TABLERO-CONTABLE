import { useState } from "react";
import { CalendarClock, Link2, Pencil, Plus } from "lucide-react";
import type { Profile, State } from "../domain/model";
import { canWork } from "../domain/workforce";
import {
  canManageFiscalObligation,
  createFiscalObligation,
  fiscalObligationStatus,
  updateFiscalObligation,
  visibleFiscalObligations,
  type FiscalObligation,
  type ObligationMilestone,
} from "../domain/fiscalObligations";
import { Empty, Panel } from "./ui";

type FormState = {
  companyId: string;
  obligationCode: string;
  title: string;
  fiscalPeriod: string;
  milestone: ObligationMilestone;
  dueOn: string;
  sourceLabel: string;
  sourceRevision: string;
  sourceCheckedAt: string;
  requiredTaskIds: string[];
  reason: string;
};

const milestoneNames: Record<ObligationMilestone, string> = {
  presentation: "Presentación",
  payment: "Pago",
  closing: "Cierre",
  documentation: "Carga de documentación",
};

function newForm(companyId: string, period: string): FormState {
  return {
    companyId, obligationCode: "", title: "", fiscalPeriod: period,
    milestone: "presentation", dueOn: `${period}-20`,
    sourceLabel: "Dato ficticio de laboratorio", sourceRevision: "DEMO-01",
    sourceCheckedAt: "", requiredTaskIds: [], reason: "",
  };
}

function editForm(event: FiscalObligation): FormState {
  return {
    companyId: event.companyId, obligationCode: event.obligationCode, title: event.title,
    fiscalPeriod: event.fiscalPeriod, milestone: event.milestone, dueOn: event.dueOn,
    sourceLabel: event.sourceLabel, sourceRevision: event.sourceRevision,
    sourceCheckedAt: event.sourceCheckedAt || "", requiredTaskIds: [...event.requiredTaskIds], reason: "",
  };
}

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-AR", { dateStyle: "medium" });
}

function statusLabel(event: FiscalObligation, status: ReturnType<typeof fiscalObligationStatus>) {
  if (status === "completed_on_time") return "Cumplido a tiempo";
  if (status === "completed_late") return "Cumplido fuera de término";
  if (status === "unassigned") return "Sin responsable";
  return event.dueOn < new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
    ? "Pendiente · vencido"
    : "Pendiente";
}

export default function FiscalObligations({
  state, actor, month, company, commit, notify, openTask,
}: {
  state: State;
  actor: Profile;
  month: string;
  company: string;
  commit: (next: State, action?: string, entityId?: string) => boolean;
  notify: (message: string) => void;
  openTask: (id: string) => void;
}) {
  const firstCompany = company && actor.companyIds.includes(company) ? company : actor.companyIds[0] || "";
  const [form, setForm] = useState<FormState>(() => newForm(firstCompany, month));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const events = visibleFiscalObligations(state, actor.id, month, company);
  const companies = state.companies.filter((row) => actor.companyIds.includes(row.id));

  const reset = () => {
    setCreating(false);
    setEditingId(null);
    setForm(newForm(firstCompany, month));
  };

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (editingId) {
        const next = updateFiscalObligation(state, editingId, {
          dueOn: form.dueOn, sourceLabel: form.sourceLabel,
          sourceRevision: form.sourceRevision, sourceCheckedAt: form.sourceCheckedAt || null,
          requiredTaskIds: form.requiredTaskIds, reason: form.reason,
        }, actor.id);
        if (commit(next, "fiscal_obligation.revised", editingId)) {
          notify("La revisión quedó guardada en el historial de la obligación.");
          reset();
        }
        return;
      }
      const next = createFiscalObligation(state, {
        companyId: form.companyId, obligationCode: form.obligationCode,
        title: form.title, fiscalPeriod: form.fiscalPeriod,
        milestone: form.milestone, dueOn: form.dueOn,
        sourceLabel: form.sourceLabel, sourceRevision: form.sourceRevision,
        sourceCheckedAt: form.sourceCheckedAt || null,
        requiredTaskIds: form.requiredTaskIds,
      }, actor.id);
      const created = next.fiscalObligations?.at(-1);
      if (created && commit(next, "fiscal_obligation.created", created.id)) {
        notify("La obligación quedó cargada en la agenda del laboratorio.");
        reset();
      }
    } catch (error) {
      notify((error as Error).message);
    }
  };

  const candidateTasks = state.tasks
    .filter((task) => task.companyId === form.companyId && (actor.role === "jefe" || canWork(state, actor, task)))
    .sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title, "es"));

  return <Panel
    title="Obligaciones por empresa"
    sub="El período fiscal y el mes del vencimiento se muestran por separado. Los vínculos con tareas son explícitos."
    action={canManageFiscalObligation(state, actor.id, firstCompany, []) ? <button type="button" className="text-button" onClick={() => {
      reset(); setCreating(true); setForm(newForm(firstCompany, month));
    }}><Plus size={16} /> Nueva obligación</button> : undefined}
  >
    <div className="obligation-lab-note"><CalendarClock size={17} /> Fechas ficticias para probar el flujo. No se consulta ARCA ni se envían avisos externos.</div>
    {(creating || editingId) && <form className="fiscal-obligation-form" onSubmit={save}>
      <div className="form-grid">
        <label>Empresa<select value={form.companyId} disabled={!!editingId} onChange={(event) => setForm({ ...form, companyId: event.target.value, requiredTaskIds: [] })} required>
          {companies.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select></label>
        {!editingId && <>
          <label>Obligación<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value, obligationCode: event.target.value })} maxLength={120} required placeholder="IVA mensual" /></label>
          <label>Hito<select value={form.milestone} onChange={(event) => setForm({ ...form, milestone: event.target.value as ObligationMilestone })}>
            {Object.entries(milestoneNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>Período fiscal<input type="month" value={form.fiscalPeriod} onChange={(event) => setForm({ ...form, fiscalPeriod: event.target.value })} required /></label>
        </>}
        <label>Fecha del vencimiento<input type="date" value={form.dueOn} onChange={(event) => setForm({ ...form, dueOn: event.target.value })} required /></label>
        <label>Origen o referencia<input value={form.sourceLabel} onChange={(event) => setForm({ ...form, sourceLabel: event.target.value })} maxLength={160} required /></label>
        <label>Revisión del origen<input value={form.sourceRevision} onChange={(event) => setForm({ ...form, sourceRevision: event.target.value })} maxLength={80} required placeholder="DEMO-01" /></label>
        <label>Fecha de consulta<input type="date" value={form.sourceCheckedAt} onChange={(event) => setForm({ ...form, sourceCheckedAt: event.target.value })} /></label>
      </div>
      <fieldset className="obligation-task-links">
        <legend>Tareas obligatorias para cumplir este hito</legend>
        {!candidateTasks.length ? <p>No hay tareas visibles de esta empresa para vincular.</p> : candidateTasks.map((task) => <label key={task.id}>
          <input type="checkbox" checked={form.requiredTaskIds.includes(task.id)} onChange={(event) => setForm({
            ...form,
            requiredTaskIds: event.target.checked ? [...form.requiredTaskIds, task.id] : form.requiredTaskIds.filter((id) => id !== task.id),
          })} />
          <span>{task.title} · {state.profiles.find((profile) => profile.id === task.ownerId)?.name || "Sin responsable"} · {task.month}</span>
        </label>)}
        <small>Sin tareas vinculadas, el estado queda “Sin responsable”. Todas las tareas vinculadas deben cumplir; una tarea de otra empresa no puede cerrar este hito.</small>
      </fieldset>
      {!!editingId && <label className="obligation-reason">Motivo de la revisión<textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} minLength={5} maxLength={500} required /></label>}
      <div className="modal-actions"><button type="button" onClick={reset}>Cancelar</button><button type="submit" className="primary">{editingId ? "Guardar revisión" : "Cargar obligación"}</button></div>
    </form>}
    {!events.length ? <Empty text="No hay obligaciones visibles para esta empresa y este período." /> : <div className="fiscal-obligation-list">
      {events.map((event) => {
        const status = fiscalObligationStatus(state, event);
        const linked = event.requiredTaskIds.map((taskId) => state.tasks.find((task) => task.id === taskId)).filter((task): task is NonNullable<typeof task> => !!task);
        const accessible = linked.filter((task) => actor.role === "jefe" || canWork(state, actor, task));
        const editable = canManageFiscalObligation(state, actor.id, event.companyId, event.requiredTaskIds);
        return <article className="fiscal-obligation-card" key={event.id}>
          <div className="fiscal-obligation-topline"><span>{state.companies.find((row) => row.id === event.companyId)?.name}</span><span>Revisión {event.revision}</span></div>
          <div className="fiscal-obligation-title"><div><h3>{event.title}</h3><p>{milestoneNames[event.milestone]}</p></div>
            <span className={`fiscal-obligation-status fiscal-obligation-status--${status}`}>{statusLabel(event, status)}</span>
          </div>
          <div className="fiscal-obligation-dates"><div><small>Período fiscal</small><strong>{event.fiscalPeriod}</strong></div><div><small>Vence</small><strong>{dateLabel(event.dueOn)}</strong></div></div>
          <p className="fiscal-obligation-source">Origen: {event.sourceLabel} · {event.sourceRevision}{event.sourceCheckedAt ? ` · consultado ${dateLabel(event.sourceCheckedAt)}` : ""}</p>
          <div className="fiscal-obligation-links"><Link2 size={15} /> {accessible.length ? accessible.map((task) => <button type="button" key={task.id} onClick={() => openTask(task.id)}>{task.title}</button>) : <span>{event.requiredTaskIds.length ? `${event.requiredTaskIds.length} tarea(s) vinculada(s)` : "Sin tareas vinculadas"}</span>}</div>
          <div className="fiscal-obligation-actions">
            {editable && <button type="button" onClick={() => { setCreating(false); setEditingId(event.id); setForm(editForm(event)); }}><Pencil size={15} /> Revisar vencimiento, fuente o vínculos</button>}
            {event.history.length > 0 && <details><summary>Historial de revisiones</summary>{event.history.map((change) => <p key={change.revision}>Rev. {change.revision} · {dateLabel(change.at.slice(0, 10))} · {change.reason} · vence {dateLabel(change.dueOn)}</p>)}</details>}
          </div>
        </article>;
      })}
    </div>}
  </Panel>;
}
