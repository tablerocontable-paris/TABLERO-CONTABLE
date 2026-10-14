import { useState, type FormEvent } from "react";
import { Check, ClipboardCheck, FlaskConical, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { dateART, id, type Profile, type State } from "../domain/model";
import {
  canCoordinateProcess,
  canViewFiveSReview,
  canViewKaizenProposal,
  completeFiveSAction,
  createFiveSReview,
  createKaizenProposal,
  decideKaizenProposal,
  FIVE_S_AREAS,
  recordKaizenMeasurement,
  reviewKaizenProposal,
  type FiveSReviewInput,
  type KaizenInput,
  type KaizenProposal,
} from "../domain/processImprovement";
import { Empty, Panel, Dialog } from "./ui";

type Tab = "kaizen" | "fiveS";
type Commit = (next: State, action: string, entityId?: string) => boolean;

const localDate = () => dateART();
const plusDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const statusText: Record<KaizenProposal["status"], string> = {
  proposed: "Pendiente de revisión", testing: "Prueba en curso", measured: "Medido · falta decisión",
  adopted: "Adoptado · nueva versión", rejected: "Descartado con motivo",
};
const resultText = { conforme: "Conforme", hallazgo: "Hallazgo", no_aplica: "No aplica" } as const;

export default function ProcessQuality({ state, actor, commit, notify }: {
  state: State; actor: Profile; commit: Commit; notify: (message: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("kaizen");
  const [newKaizenOpen, setNewKaizenOpen] = useState(false);
  const [newFiveSOpen, setNewFiveSOpen] = useState(false);
  const [proposalCompanyId, setProposalCompanyId] = useState(actor.companyIds[0] || state.companies[0]?.id || "");
  const proposals = (state.improvementProposals || []).filter((row) => canViewKaizenProposal(state, actor, row)).sort((a, b) => b.proposedAt.localeCompare(a.proposedAt));
  const reviews = (state.fiveSReviews || []).filter((row) => canViewFiveSReview(state, actor, row)).sort((a, b) => b.reviewedOn.localeCompare(a.reviewedOn));
  const activeProfiles = state.profiles.filter((profile) => profile.active &&
    (actor.role === "jefe" || profile.companyIds.some((companyId) => actor.companyIds.includes(companyId))));
  const availableCompanies = state.companies.filter((company) => actor.role === "jefe" || actor.companyIds.includes(company.id));
  const openActions = reviews.flatMap((review) => review.items.filter((item) => item.status === "open")).length;

  function save(next: State, action: string, entityId?: string) {
    if (commit(next, action, entityId)) { notify("Guardado en el laboratorio de este navegador."); return true; }
    notify("No se pudo guardar en el laboratorio. Tus datos siguen en el formulario; podés reintentar.");
    return false;
  }
  function createProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const input: KaizenInput = {
        templateId: String(form.get("templateId")), companyId: String(form.get("companyId")),
        problemObserved: String(form.get("problemObserved")), baselineValue: Number(form.get("baselineValue")),
        objectiveValue: Number(form.get("objectiveValue")), unit: String(form.get("unit")),
        direction: String(form.get("direction")) as KaizenInput["direction"],
        baselineEvidence: String(form.get("baselineEvidence")), baselineContext: String(form.get("baselineContext")),
        proposedChange: String(form.get("proposedChange")), responsibleId: String(form.get("responsibleId")),
        trialFrom: String(form.get("trialFrom")), trialThrough: String(form.get("trialThrough")),
      };
      const proposal = createKaizenProposal(state, actor, input);
      if (save({ ...state, improvementProposals: [...(state.improvementProposals || []), proposal] }, "Propuso mejora Kaizen", proposal.id)) {
        setNewKaizenOpen(false);
        event.currentTarget.reset();
      }
    } catch (error) { notify((error as Error).message); }
  }
  function reviewProposal(event: FormEvent<HTMLFormElement>, proposal: KaizenProposal, decision: "test" | "reject") {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("note") || "");
    try { save(reviewKaizenProposal(state, actor, proposal.id, decision, note), decision === "test" ? "Autorizó prueba Kaizen" : "Descartó propuesta Kaizen", proposal.id); }
    catch (error) { notify((error as Error).message); }
  }
  function measureProposal(event: FormEvent<HTMLFormElement>, proposal: KaizenProposal) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const next = recordKaizenMeasurement(state, actor, proposal.id, {
        afterValue: Number(form.get("afterValue")), afterEvidence: String(form.get("afterEvidence")),
        afterContext: String(form.get("afterContext")), measuredOn: String(form.get("measuredOn")),
      });
      save(next, "Registró medición Kaizen", proposal.id);
    } catch (error) { notify((error as Error).message); }
  }
  function decideProposal(event: FormEvent<HTMLFormElement>, proposal: KaizenProposal, decision: "adopt" | "reject") {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const note = String(form.get("decisionNote") || "");
      const standard = decision === "adopt" ? {
        description: String(form.get("description") || ""),
        steps: String(form.get("steps") || "").split(/\r?\n/).map((step) => step.trim()).filter(Boolean),
      } : undefined;
      const next = decideKaizenProposal(state, actor, proposal.id, decision, note, standard);
      save(next, decision === "adopt" ? "Adoptó mejora y creó versión de catálogo" : "Descartó mejora medida", proposal.id);
    } catch (error) { notify((error as Error).message); }
  }
  function submitFiveS(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const input: FiveSReviewInput = {
        companyId: String(form.get("companyId")),
        templateId: String(form.get("templateId") || "") || null,
        scopeTitle: String(form.get("scopeTitle")),
        reviewedOn: String(form.get("reviewedOn")),
        items: FIVE_S_AREAS.map((area) => ({
          id: area.id,
          result: String(form.get(`${area.id}-result`)) as FiveSReviewInput["items"][number]["result"],
          evidence: String(form.get(`${area.id}-evidence`)), finding: String(form.get(`${area.id}-finding`)),
          action: String(form.get(`${area.id}-action`)), responsibleId: String(form.get(`${area.id}-responsible`)),
          dueOn: String(form.get(`${area.id}-dueOn`)),
        })),
      };
      const review = createFiveSReview(state, actor, input);
      if (save({ ...state, fiveSReviews: [...(state.fiveSReviews || []), review] }, "Registró revisión 5S", review.id)) {
        setNewFiveSOpen(false);
        event.currentTarget.reset();
      }
    } catch (error) { notify((error as Error).message); }
  }
  function closeFiveSAction(reviewId: string, areaId: (typeof FIVE_S_AREAS)[number]["id"], evidence: string, completedOn: string) {
    try { return save(completeFiveSAction(state, actor, reviewId, areaId, evidence, completedOn), "Verificó acción 5S", reviewId); }
    catch (error) { notify((error as Error).message); return false; }
  }

  return <div className="process-quality-page">
    <div className="quality-lab-note"><ShieldCheck size={18} /><span><b>Calidad del proceso · aislada del desempeño</b> Las propuestas y revisiones se guardan sólo en este navegador. No crean tareas, no alteran pesos ni KPI y no envían datos fuera del laboratorio.</span></div>
    <div className="quality-tabs" data-tour="process-quality" role="tablist" aria-label="Calidad del proceso">
      <button role="tab" aria-selected={tab === "kaizen"} className={tab === "kaizen" ? "active" : ""} onClick={() => setTab("kaizen")}><Sparkles size={16} /> Mejora Kaizen <span>{proposals.filter((row) => !["adopted", "rejected"].includes(row.status)).length}</span></button>
      <button role="tab" aria-selected={tab === "fiveS"} className={tab === "fiveS" ? "active" : ""} onClick={() => setTab("fiveS")}><ClipboardCheck size={16} /> Revisiones 5S <span>{openActions} acciones abiertas</span></button>
    </div>

    {tab === "kaizen" && <>
      <Panel title="Mejorar un proceso con evidencia" sub={`${proposals.length} propuestas · compará mediciones con volumen y contexto equivalentes. Las decisiones no se transforman en puntuación.`} collapsible defaultOpen={false} action={<button data-tour="quality-kaizen-action" className="primary" onClick={() => setNewKaizenOpen(true)}><Plus size={15} /> Proponer mejora</button>}>
        <div data-tour="quality-kaizen-content">{proposals.length ? <div className="quality-card-list">{proposals.map((proposal) => {
          const company = state.companies.find((row) => row.id === proposal.companyId)?.name || "Empresa";
          const author = state.profiles.find((row) => row.id === proposal.proposedBy)?.name || "Perfil anterior";
          const responsible = state.profiles.find((row) => row.id === proposal.responsibleId)?.name || "Perfil anterior";
          const reviewer = state.profiles.find((row) => row.id === proposal.reviewedBy)?.name;
          const coordinator = canCoordinateProcess(state, actor, proposal.proposedBy, proposal.companyId) || canCoordinateProcess(state, actor, proposal.responsibleId, proposal.companyId);
          return <article className="quality-card" key={proposal.id}>
            <div className="quality-card-head"><span className={`quality-status quality-${proposal.status}`}>{statusText[proposal.status]}</span><span>{company} · {proposal.templateTitle}</span></div>
            <h3>{proposal.problemObserved}</h3>
            <p className="quality-meta">Propuesta de {author} · responsable: {responsible} · {new Date(proposal.proposedAt).toLocaleDateString("es-AR")}</p>
            <p>{proposal.proposedChange}</p>
            <div className="quality-measures"><div><small>Base</small><b>{proposal.baselineValue} {proposal.unit}</b><p>{proposal.baselineContext}</p><small>Evidencia: {proposal.baselineEvidence}</small></div><div><small>Meta ({proposal.direction === "lower" ? "reducir" : "aumentar"})</small><b>{proposal.objectiveValue} {proposal.unit}</b><p>Prueba: {proposal.trialFrom} a {proposal.trialThrough}</p></div>{proposal.afterValue !== undefined && <div><small>Medición posterior</small><b>{proposal.afterValue} {proposal.unit}</b><p>{proposal.afterContext}</p><small>Evidencia: {proposal.afterEvidence}</small></div>}</div>
            {proposal.reviewNote && <p className="quality-note"><b>Revisión{reviewer ? ` · ${reviewer}` : ""}:</b> {proposal.reviewNote}</p>}
            {proposal.decisionNote && <p className="quality-note"><b>Decisión:</b> {proposal.decisionNote}{proposal.adoptedVersion ? ` · nueva versión ${proposal.adoptedVersion}` : ""}</p>}
            {proposal.status === "proposed" && coordinator && <div className="quality-inline-actions">
              <form onSubmit={(event) => reviewProposal(event, proposal, "test")}><label>Criterio para habilitar la prueba<textarea name="note" required maxLength={1000} rows={2} /></label><button className="primary" type="submit"><FlaskConical size={14} /> Autorizar prueba</button></form>
              <form onSubmit={(event) => reviewProposal(event, proposal, "reject")}><label>Motivo para descartar<textarea name="note" required maxLength={1000} rows={2} /></label><button type="submit">Descartar</button></form>
            </div>}
            {proposal.status === "testing" && (canViewKaizenProposal(state, actor, proposal) && (actor.id === proposal.responsibleId || canCoordinateProcess(state, actor, proposal.responsibleId, proposal.companyId))) && <form className="quality-inline-measure" onSubmit={(event) => measureProposal(event, proposal)}><h4>Registrar medición posterior</h4><div className="form-grid"><label>Valor medido<input name="afterValue" type="number" min="0" step="any" required /></label><label>Fecha<input name="measuredOn" type="date" min={proposal.trialFrom} max={proposal.trialThrough} required defaultValue={proposal.trialThrough} /></label></div><label>Evidencia de la medición<textarea name="afterEvidence" required maxLength={2000} rows={2} /></label><label>Volumen y contexto comparables<textarea name="afterContext" required maxLength={1200} rows={2} placeholder="Indicá período, cantidad de casos y complejidad observada." /></label><button className="primary" type="submit">Guardar medición</button></form>}
            {proposal.status === "measured" && coordinator && <div className="quality-inline-actions">
              {actor.role === "jefe" && <form onSubmit={(event) => decideProposal(event, proposal, "adopt")}><h4>Adoptar con una nueva versión del estándar</h4><label>Objetivo actualizado<textarea name="description" required maxLength={1000} defaultValue={state.templates.find((row) => row.id === proposal.templateId)?.description || proposal.proposedChange} /></label><label>Controles de la nueva versión · uno por línea<textarea name="steps" required maxLength={2000} rows={4} defaultValue={(state.templates.find((row) => row.id === proposal.templateId)?.steps || []).join("\n")} /></label><label>Comparación y criterio de adopción<textarea name="decisionNote" required maxLength={1200} rows={2} placeholder="Explicá cómo comparaste la evidencia, volumen y complejidad." /></label><button className="primary" type="submit"><Check size={14} /> Adoptar y versionar</button></form>}
              <form onSubmit={(event) => decideProposal(event, proposal, "reject")}><label>Motivo para descartar la mejora medida<textarea name="decisionNote" required maxLength={1200} rows={2} /></label><button type="submit">Descartar con motivo</button></form>
            </div>}
          </article>;
        })}</div> : <Empty text="Todavía no hay propuestas. Una mejora necesita base medible, contexto y responsable antes de iniciar una prueba." />}</div>
      </Panel>
      <div className="quality-footnote">Los valores se comparan como evidencia operativa; no calculan productividad ni cambian el cierre del período.</div>
    </>}

    {tab === "fiveS" && <>
      <Panel title="Orden y documentación de trabajo" sub={`${reviews.length} revisiones · ${openActions} acciones abiertas · evidencia y responsables por área.`} collapsible defaultOpen={false} action={<button className="primary" onClick={() => setNewFiveSOpen(true)}><Plus size={15} /> Registrar revisión 5S</button>}>
        {reviews.length ? <div className="quality-card-list">{reviews.map((review) => {
          const pending = review.items.filter((item) => item.status === "open").length;
          return <article className="quality-card" key={review.id}>
            <div className="quality-card-head"><span className={pending ? "quality-status quality-testing" : "quality-status quality-adopted"}>{pending ? `${pending} acciones abiertas` : "Seguimiento cerrado"}</span><span>{state.companies.find((row) => row.id === review.companyId)?.name || "Empresa"} · {review.scopeTitle} · {review.reviewedOn}</span></div>
            <p className="quality-meta">Revisó {state.profiles.find((row) => row.id === review.createdBy)?.name || "Perfil anterior"} · {new Date(review.createdAt).toLocaleDateString("es-AR")}</p>
            <div className="quality-five-s-list">{review.items.map((item) => {
              const area = FIVE_S_AREAS.find((candidate) => candidate.id === item.id)!;
              const responsible = state.profiles.find((row) => row.id === item.responsibleId)?.name || "Perfil anterior";
              const canComplete = item.status === "open" && canViewFiveSReview(state, actor, review) && (actor.id === item.responsibleId || canCoordinateProcess(state, actor, item.responsibleId, review.companyId));
              return <section className="quality-five-s-item" key={item.id}><div className="quality-five-s-title"><b>{area.label}</b><span>{resultText[item.result]} · {item.status === "done" ? "acción verificada" : `vence ${item.dueOn}`}</span></div><p className="quality-meta">{area.guide}</p><p><b>Evidencia:</b> {item.evidence}</p><p><b>Hallazgo:</b> {item.finding}</p><p><b>Acción:</b> {item.action} · {responsible}</p>{item.completionEvidence && <p className="quality-completion"><b>Verificación {item.completedOn}:</b> {item.completionEvidence}</p>}{canComplete && <FiveSCompletionForm onComplete={(evidence, day) => closeFiveSAction(review.id, item.id, evidence, day)} />}</section>;
            })}</div>
          </article>;
        })}</div> : <Empty text="No hay revisiones 5S. Registrá evidencia, hallazgos y acciones sin adjuntar documentos reales de clientes." />}
      </Panel>
      <div className="quality-footnote">La revisión es una herramienta de calidad. No crea tareas ficticias, no borra evidencia y no modifica KPI.</div>
    </>}

    {newKaizenOpen && <Dialog title="Proponer una mejora Kaizen" wide onClose={() => setNewKaizenOpen(false)}><form className="quality-form" onSubmit={createProposal}>
      <p>Registrá una medición inicial, la meta y el contexto para poder comparar después de la prueba.</p>
      <div className="form-grid"><label>Empresa<select name="companyId" required value={proposalCompanyId} onChange={(event) => setProposalCompanyId(event.target.value)}>{availableCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label>Proceso del catálogo<select name="templateId" required>{state.templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}</select></label></div>
      <label>Problema observado<textarea name="problemObserved" required maxLength={1200} rows={2} /></label>
      <div className="form-grid"><label>Medición inicial<input name="baselineValue" type="number" min="0" step="any" required /></label><label>Unidad comparable<input name="unit" required maxLength={40} placeholder="minutos, errores, casos..." /></label><label>Meta numérica<input name="objectiveValue" type="number" min="0" step="any" required /></label><label>La mejora busca<select name="direction"><option value="lower">Reducir el valor</option><option value="higher">Aumentar el valor</option></select></label></div>
      <label>Evidencia de la medición inicial<textarea name="baselineEvidence" required maxLength={2000} rows={2} /></label><label>Volumen y contexto inicial<textarea name="baselineContext" required maxLength={1200} rows={2} placeholder="Período observado, cantidad de casos y complejidad." /></label>
      <label>Cambio propuesto<textarea name="proposedChange" required maxLength={1600} rows={3} /></label>
      <div className="form-grid"><label>Responsable de la prueba<select name="responsibleId" required>{activeProfiles.filter((profile) => profile.companyIds.includes(proposalCompanyId)).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><label>Desde<input name="trialFrom" type="date" required defaultValue={localDate()} /></label><label>Hasta<input name="trialThrough" type="date" required defaultValue={plusDays(localDate(), 14)} /></label></div>
      <div className="modal-actions"><button type="button" onClick={() => setNewKaizenOpen(false)}>Cancelar</button><button className="primary" type="submit">Guardar propuesta</button></div>
    </form></Dialog>}

    {newFiveSOpen && <Dialog title="Registrar revisión 5S" wide onClose={() => setNewFiveSOpen(false)}><form className="quality-form" onSubmit={submitFiveS}>
      <p>Dejá evidencia y una acción por cada área. Usá referencias descriptivas; no adjuntes archivos ni datos reales de clientes.</p>
      <div className="form-grid"><label>Empresa<select name="companyId" required>{availableCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label>Proceso (opcional)<select name="templateId" defaultValue=""><option value="">Alcance general de documentación</option>{state.templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}</select></label><label>Otro alcance<input name="scopeTitle" maxLength={120} placeholder="Ej. Archivo de extractos" /></label><label>Fecha de revisión<input name="reviewedOn" type="date" required defaultValue={localDate()} /></label></div>
      {FIVE_S_AREAS.map((area) => <fieldset className="quality-five-s-field" key={area.id}><legend>{area.label}</legend><p>{area.guide}</p><div className="form-grid"><label>Resultado<select name={`${area.id}-result`} defaultValue="hallazgo"><option value="conforme">Conforme</option><option value="hallazgo">Hallazgo</option><option value="no_aplica">No aplica</option></select></label><label>Responsable de la acción<select name={`${area.id}-responsible`} required defaultValue={actor.id}>{activeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label></div><label>Evidencia observada<textarea name={`${area.id}-evidence`} required maxLength={1200} rows={2} /></label><label>Hallazgo o fundamento de conformidad<textarea name={`${area.id}-finding`} required maxLength={800} rows={2} placeholder="Describí el hallazgo o indicá por qué está conforme/no aplica." /></label><label>Acción o medida para sostener<textarea name={`${area.id}-action`} required maxLength={800} rows={2} /></label><label>Fecha objetivo<input name={`${area.id}-dueOn`} type="date" required defaultValue={plusDays(localDate(), 7)} /></label></fieldset>)}
      <div className="modal-actions"><button type="button" onClick={() => setNewFiveSOpen(false)}>Cancelar</button><button className="primary" type="submit">Guardar revisión completa</button></div>
    </form></Dialog>}
  </div>;
}

function FiveSCompletionForm({ onComplete }: { onComplete: (evidence: string, date: string) => boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button className="quality-complete-toggle" type="button" onClick={() => setOpen(true)}>Registrar verificación</button>;
  return <form className="quality-completion-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); if (onComplete(String(form.get("evidence")), String(form.get("date")))) { event.currentTarget.reset(); setOpen(false); } }}><label>Evidencia de corrección<textarea name="evidence" required maxLength={1200} rows={2} /></label><div className="quality-completion-controls"><label>Fecha de verificación<input name="date" type="date" required defaultValue={localDate()} /></label><button className="primary" type="submit"><Check size={14} /> Cerrar acción</button></div></form>;
}
