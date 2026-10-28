import { useState, type FormEvent } from "react";
import { Panel, Empty } from "./ui";
import StepListEditor, { validateSteps } from "./StepListEditor";
import ScheduleEditor from "./ScheduleEditor";
import { getParisTask, parisTaskParameterKey, PARIS_BUSINESS_UNITS } from "../domain/parisTaskCatalog";
import {
  approveHabitualTaskProposals,
  groupHabitualTaskProposals,
  pendingHabitualTaskProposals,
  proposalsForProfile,
  proposalStatusLabel,
  requestHabitualProposalChanges,
  resubmitHabitualTaskProposal,
} from "../domain/habitualTaskProposals";
import { currentMonth, materialize, type HabitualTaskProposal, type Profile, type State, type Template } from "../domain/model";

type Commit = (state: State, action?: string, entityId?: string) => boolean;
type Notify = (message: string) => void;

export function HabitualTaskProposalInbox({ state, actor, month, commit, notify }: {
  state: State; actor: Profile; month: string; commit: Commit; notify: Notify;
}) {
  const proposals = pendingHabitualTaskProposals(state, actor);
  const groups = groupHabitualTaskProposals(proposals);
  return (
    <Panel title="Propuestas de tareas habituales" sub={`${proposals.length} pendientes · revisá coincidencias y decidí explícitamente el estándar para cada perfil y empresa.`} collapsible defaultOpen>
      {groups.length ? <div className="habitual-proposal-groups">
        {groups.map((group) => <ProposalGroupCard key={group.key} group={group.proposals} suggestedMatch={group.suggestedMatch} state={state} actor={actor} month={month} commit={commit} notify={notify} />)}
      </div> : <Empty text="No hay propuestas habituales pendientes de revisión." />}
    </Panel>
  );
}

function ProposalGroupCard({ group, suggestedMatch, state, actor, month, commit, notify }: {
  group: HabitualTaskProposal[]; suggestedMatch: boolean; state: State; actor: Profile; month: string; commit: Commit; notify: Notify;
}) {
  const first = group[0];
  const requiresCanonicalSelection = group.some((proposal) => (proposal.taskCode && (proposal.submissions || []).some((submission) => !submission.taskCode)) || (!proposal.taskCode && (proposal.businessUnitCode || proposal.taskCatalogVersion !== undefined || (proposal.submissions || []).some((submission) => submission.businessUnitCode || submission.taskCatalogVersion !== undefined))));
  const [templateId, setTemplateId] = useState("");
  const [standard, setStandard] = useState({
    title: first.title,
    sector: actor.sector || "Contabilidad general",
    description: first.description,
    weight: 1,
    target: 0,
  });
  const [steps, setSteps] = useState([...first.steps]);
  const [correctionNotes, setCorrectionNotes] = useState<Record<string, string>>({});
  const compatible = state.templates.filter((template) =>
    template.kind === first.kind && (first.kind !== "operativa" || normalizeUnit(template.unit) === normalizeUnit(first.unit)) &&
    (first.taskCode ? template.taskCode === first.taskCode && template.taskCatalogVersion === first.taskCatalogVersion : !template.taskCode),
  );
  const companyName = (proposal: HabitualTaskProposal) => state.companies.find((company) => company.id === proposal.companyId)?.name || "Empresa";
  const profileName = (proposal: HabitualTaskProposal) => state.profiles.find((profile) => profile.id === proposal.ownerId)?.name || "Perfil";
  const needsParisConfiguration = !!first.taskCode && (standard.description.trim().length < 20 || /selección del catálogo grupo parís/i.test(standard.description) || !steps.some((step) => step.trim().length >= 10 && !/confirmar procedimiento y controles con jefatura/i.test(step.trim())));

  function approve(decision: { kind: "link"; templateId: string } | { kind: "create"; template: { title: string; sector: string; description: string; kind: Template["kind"]; unit: string; weight: number; target: number; steps: string[] } }) {
    try {
      const next = approveHabitualTaskProposals(state, actor, group.map((proposal) => proposal.id), decision, month, new Date().toISOString());
      if (commit(materialize(next, month), decision.kind === "link" ? "Vinculó propuestas a un estándar" : "Creó un estándar y aprobó propuestas", group[0].id))
        notify(`Se activaron ${group.length} asignaciones independientes en el laboratorio.`);
    } catch (error) { notify((error as Error).message); }
  }

  return (
    <article className="habitual-proposal-group">
      <div className="habitual-proposal-group-heading">
        <div>
          <span className="quality-status">{suggestedMatch ? `Posible coincidencia · ${group.length}` : "Propuesta individual"}</span>
          <h3>{first.title}</h3>
          {first.businessUnitCode && <small>Unidad de negocio: {businessUnitLabel(first.businessUnitCode)}</small>}
          {first.process && <p>Proceso o banco: {first.process}</p>}
        </div>
        <small>{first.kind === "operativa" ? `Actividad · ${first.unit}` : "Entregable con controles"}</small>
      </div>
      {suggestedMatch && <p className="habitual-proposal-hint">La coincidencia sólo orienta la revisión. No se fusionaron nombres, empresas ni asignaciones.</p>}
      {requiresCanonicalSelection && <p className="notice-banner" role="note">Esta propuesta mezcla historial con y sin clasificación estándar. No se puede activar ni incorporar al catálogo. Conservá el historial y pedí que se revise antes de generar trabajo.</p>}
      <div className="habitual-proposal-members">
        {group.map((proposal) => (
          <section className="habitual-proposal-member" key={proposal.id}>
            <div>
              <b>{profileName(proposal)} · {companyName(proposal)}</b>
              <p>{proposal.title}{proposal.process ? ` · ${proposal.process}` : ""}</p>
              <small>{businessUnitLabel(proposal.businessUnitCode)} · {proposal.schedule.frequency} · {proposal.kind === "operativa" ? `actividad por ${proposal.unit} · sin cuota` : `${proposal.steps.length} controles`} · envío {new Date(proposal.submittedAt).toLocaleDateString("es-AR")}</small>
              {proposal.taskCode && Object.keys(proposal.taskParameters || {}).length > 0 && <dl className="paris-proposal-parameters">{(getParisTask(proposal.taskCode)?.parameters || []).map((label) => {
                const value = proposal.taskParameters?.[parisTaskParameterKey(label)];
                return value ? <div key={label}><dt>{label}</dt><dd>{value}</dd></div> : null;
              })}</dl>}
              <details>
                <summary>Ver descripción y controles</summary>
                <p>{proposal.description}</p>
                <ol>{proposal.steps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol>
              </details>
            </div>
            <label>
              Qué debe corregir {profileName(proposal)}
              <textarea
                value={correctionNotes[proposal.id] || ""}
                maxLength={500}
                rows={2}
                onChange={(event) => setCorrectionNotes({ ...correctionNotes, [proposal.id]: event.target.value })}
              />
            </label>
            <button type="button" disabled={(correctionNotes[proposal.id] || "").trim().length < 5} onClick={() => {
              try {
                const next = requestHabitualProposalChanges(state, actor, proposal.id, correctionNotes[proposal.id]);
                if (commit(next, "Solicitó correcciones de tarea habitual", proposal.id)) notify("La corrección quedó registrada para el perfil en este laboratorio.");
              } catch (error) { notify((error as Error).message); }
            }}>Solicitar correcciones</button>
          </section>
        ))}
      </div>
      {!requiresCanonicalSelection && <>
      <div className="habitual-proposal-decision">
        <label>
          Vincular a un estándar existente
          <select aria-label={`Estándar existente para ${first.title}`} value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">Elegí un estándar compatible</option>
            {compatible.map((template) => <option value={template.id} key={template.id}>{template.title} · {template.sector}</option>)}
          </select>
        </label>
        <button type="button" disabled={!templateId} onClick={() => approve({ kind: "link", templateId })}>Vincular y activar {group.length} {group.length === 1 ? "asignación" : "asignaciones"}</button>
      </div>
      <details className="habitual-standard-create">
        <summary>Crear un estándar para {group.length === 1 ? "esta propuesta" : "el grupo"}</summary>
        <p>El estándar define nombre, rubro, controles y peso común. La frecuencia se conserva por perfil y empresa; el peso por movimiento se parametriza por empresa.</p>
        <div className="form-grid">
          <label>Nombre estándar<input maxLength={120} value={standard.title} readOnly={!!first.taskCode} onChange={(event) => setStandard({ ...standard, title: event.target.value })} /></label>
          <label>Rubro o sector<input maxLength={80} value={standard.sector} onChange={(event) => setStandard({ ...standard, sector: event.target.value })} /></label>
          <label>Peso común<input type="number" min={0} step="any" value={standard.weight} onChange={(event) => setStandard({ ...standard, weight: Number(event.target.value) })} /></label>
          {first.kind === "operativa" && <p className="catalogue-rate-note">La cantidad se registra libremente; jefatura define el coeficiente por movimiento en Actividad operativa.</p>}
        </div>
        <label>Objetivo del proceso<textarea maxLength={1000} rows={3} value={standard.description} onChange={(event) => setStandard({ ...standard, description: event.target.value })} /></label>
        <label>Controles comunes</label>
        <StepListEditor value={steps} onChange={setSteps} />
        {needsParisConfiguration && <p className="paris-configuration-required">Definí el procedimiento y al menos un control concreto antes de activar estas asignaciones.</p>}
        <button type="button" className="primary" disabled={needsParisConfiguration} onClick={() => {
          try {
            const safeSteps = validateSteps(steps);
            approve({ kind: "create", template: { ...standard, target: 0, kind: first.kind, unit: first.kind === "operativa" ? first.unit : "", steps: safeSteps } });
          } catch (error) { notify((error as Error).message); }
        }}>Crear estándar y activar {group.length} {group.length === 1 ? "asignación" : "asignaciones"}</button>
      </details>
      </>}
    </article>
  );
}

export function MyHabitualTaskProposals({ state, actor, month, commit, notify }: {
  state: State; actor: Profile; month?: string; commit: Commit; notify: Notify;
}) {
  const proposals = proposalsForProfile(state, actor);
  if (!proposals.length) return null;
  return (
    <Panel title="Mis propuestas de tareas habituales" sub={`${proposals.length} propuestas · los procesos esperan revisión antes de generar tareas o puntos.`} collapsible defaultOpen>
      <div className="habitual-proposal-groups">
        {proposals.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((proposal) => <MyProposalCard key={proposal.id} proposal={proposal} state={state} actor={actor} month={month || currentMonth()} commit={commit} notify={notify} />)}
      </div>
    </Panel>
  );
}

function MyProposalCard({ proposal, state, actor, month, commit, notify }: {
  proposal: HabitualTaskProposal; state: State; actor: Profile; month: string; commit: Commit; notify: Notify;
}) {
  const [title, setTitle] = useState(proposal.title);
  const [process, setProcess] = useState(proposal.process);
  const [taskParameters, setTaskParameters] = useState(proposal.taskParameters || {});
  const [description, setDescription] = useState(proposal.description);
  const [kind, setKind] = useState(proposal.kind);
  const [unit, setUnit] = useState(proposal.unit);
  const [target, setTarget] = useState(proposal.target);
  const [schedule, setSchedule] = useState(proposal.schedule);
  const [steps, setSteps] = useState(proposal.steps);
  const template = proposal.templateId ? state.templates.find((row) => row.id === proposal.templateId) : null;
  function resubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const next = resubmitHabitualTaskProposal(state, actor, proposal.id, { title, process, description, kind, unit, target: kind === "operativa" ? 0 : target, schedule, steps, taskCode: proposal.taskCode, taskCatalogVersion: proposal.taskCatalogVersion, businessUnitCode: proposal.businessUnitCode, taskParameters });
      if (commit(next, "Reenvió propuesta habitual corregida", proposal.id)) notify("La propuesta volvió a la bandeja de revisión de jefatura.");
    } catch (error) { notify((error as Error).message); }
  }
  return (
    <article className="habitual-proposal-group my-habitual-proposal">
      <div className="habitual-proposal-group-heading">
        <div><span className={`quality-status ${proposal.status === "approved" ? "quality-adopted" : proposal.status === "changes_requested" ? "quality-measured" : ""}`}>{proposalStatusLabel(proposal)}</span><h3>{proposal.title}</h3></div>
        <small>Empresa: {state.companies.find((row) => row.id === proposal.companyId)?.name || "Empresa"}{proposal.businessUnitCode ? ` · Unidad: ${businessUnitLabel(proposal.businessUnitCode)}` : ""}</small>
      </div>
      <p>{proposal.process || proposal.description}</p>
      <small>Regla: {proposal.schedule.frequency} · {proposal.kind === "operativa" ? `cantidad ${proposal.unit} · sin cuota` : "meta no aplica"} · revisión {proposal.revision}</small>
      {proposal.status === "changes_requested" && <div className="habitual-proposal-requested-change"><b>Corrección solicitada</b><p>{proposal.managerNote}</p></div>}
      {proposal.status === "approved" && template && <p className="habitual-proposal-approved">Estándar confirmado: {template.title} · versión {proposal.templateVersion}</p>}
      {proposal.status === "changes_requested" && (
        <form className="habitual-proposal-resubmit" onSubmit={resubmit}>
          <label>Nombre de la tarea<input required maxLength={120} value={title} readOnly={!!proposal.taskCode} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Banco o proceso<input maxLength={160} value={process} onChange={(event) => setProcess(event.target.value)} /></label>
          {proposal.taskCode && <fieldset className="paris-task-parameters"><legend>Parámetros de la tarea estándar</legend><div className="paris-task-parameter-fields">{(getParisTask(proposal.taskCode)?.parameters || []).map((label) => {
            const key = parisTaskParameterKey(label);
            return <label key={key}>{label}<input maxLength={160} value={taskParameters[key] || ""} onChange={(event) => setTaskParameters({ ...taskParameters, [key]: event.target.value })} /></label>;
          })}</div></fieldset>}
          <label>Descripción<textarea required maxLength={1000} rows={2} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <div className="form-grid">
            <label>Tipo<select value={kind} onChange={(event) => setKind(event.target.value as Template["kind"])}><option value="resultado">Entregable</option><option value="operativa">Actividad con cantidad</option></select></label>
            {kind === "operativa" && <label>Unidad<input required maxLength={40} value={unit} onChange={(event) => setUnit(event.target.value)} /></label>}
          </div>
          <label>Frecuencia y vencimiento</label>
          <ScheduleEditor value={schedule} month={month} onChange={setSchedule} />
          <label>Controles o pasos</label>
          <StepListEditor value={steps} onChange={setSteps} />
          <button className="primary" type="submit">Reenviar para revisión</button>
        </form>
      )}
      <details>
        <summary>Historial de revisión ({proposal.history.length})</summary>
        <ol>{proposal.history.map((entry) => <li key={entry.id}><b>{entry.action === "submitted" ? "Enviada" : entry.action === "resubmitted" ? "Reenviada" : entry.action === "changes_requested" ? "Correcciones solicitadas" : "Aprobada"}</b> · {new Date(entry.at).toLocaleString("es-AR")}<p>{entry.note}</p></li>)}</ol>
      </details>
    </article>
  );
}

function normalizeUnit(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("es-AR");
}

function businessUnitLabel(code?: string) {
  return PARIS_BUSINESS_UNITS.find((unit) => unit.code === code)?.label || "Sin unidad clasificada";
}
