import { canSee, dateART, id, isClosed, type Profile, type State, type Template } from "./model";
import { validDate } from "./schedule";

export type CatalogueVersionSource =
  | "initial_snapshot"
  | "catalog_change"
  | "kaizen_adoption"
  | "legacy_reconciliation";

/** Immutable snapshot. `capturedAt` is a record date, not a claim about when
 * the standard first entered into force. `effectiveOn` is null when unknown. */
export interface CatalogueVersion {
  id: string;
  templateId: string;
  version: number;
  title: string;
  sector: string;
  kind: Template["kind"];
  weight: number;
  unit: string;
  target: number;
  steps: string[];
  description: string;
  capturedAt: string;
  effectiveOn: string | null;
  createdBy: string | null;
  source: CatalogueVersionSource;
  changeReason: string;
  sourceProposalId?: string;
}

export type KaizenStatus = "proposed" | "testing" | "measured" | "adopted" | "rejected";
export type MeasureDirection = "lower" | "higher";

export interface KaizenProposal {
  id: string;
  templateId: string;
  companyId: string;
  templateTitle: string;
  problemObserved: string;
  baselineValue: number;
  objectiveValue: number;
  unit: string;
  direction: MeasureDirection;
  baselineEvidence: string;
  baselineContext: string;
  proposedChange: string;
  responsibleId: string;
  proposedBy: string;
  proposedAt: string;
  trialFrom: string;
  trialThrough: string;
  status: KaizenStatus;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  afterValue?: number;
  afterEvidence?: string;
  afterContext?: string;
  measuredOn?: string;
  measuredBy?: string;
  decisionNote?: string;
  decidedBy?: string;
  decidedAt?: string;
  adoptedVersion?: number;
}

export const FIVE_S_AREAS = [
  { id: "classify", label: "Clasificar", guide: "Separar documentación vigente, obsoleta y faltante; conservar según política aprobada." },
  { id: "order", label: "Ordenar", guide: "Definir ubicación, nombre y responsable para documentos e instructivos." },
  { id: "clean", label: "Limpiar", guide: "Detectar duplicados, archivos dañados y referencias incorrectas; registrar correcciones verificadas." },
  { id: "standardize", label: "Estandarizar", guide: "Mantener plantillas, checklist y controles del catálogo versionados." },
  { id: "sustain", label: "Sostener", guide: "Programar revisión periódica y dejar accesible la documentación para coberturas." },
] as const;

export type FiveSAreaId = (typeof FIVE_S_AREAS)[number]["id"];
export type FiveSResult = "conforme" | "hallazgo" | "no_aplica";
export type FiveSActionStatus = "open" | "done";

export interface FiveSItem {
  id: FiveSAreaId;
  result: FiveSResult;
  evidence: string;
  finding: string;
  action: string;
  responsibleId: string;
  dueOn: string;
  status: FiveSActionStatus;
  completionEvidence?: string;
  completedOn?: string;
  completedBy?: string;
}

export interface FiveSReview {
  id: string;
  companyId: string;
  templateId: string | null;
  scopeTitle: string;
  reviewedOn: string;
  createdAt: string;
  createdBy: string;
  items: FiveSItem[];
}

export interface KaizenInput {
  templateId: string;
  companyId: string;
  problemObserved: string;
  baselineValue: number;
  objectiveValue: number;
  unit: string;
  direction: MeasureDirection;
  baselineEvidence: string;
  baselineContext: string;
  proposedChange: string;
  responsibleId: string;
  trialFrom: string;
  trialThrough: string;
}

export interface KaizenMeasurement {
  afterValue: number;
  afterEvidence: string;
  afterContext: string;
  measuredOn: string;
}

export interface FiveSReviewInput {
  companyId: string;
  templateId: string | null;
  scopeTitle: string;
  reviewedOn: string;
  items: Omit<FiveSItem, "status" | "completionEvidence" | "completedOn" | "completedBy">[];
}

const text = (value: string, label: string, max: number) => {
  const cleaned = value.trim();
  if (!cleaned) throw Error(`Completá ${label}.`);
  if (cleaned.length > max) throw Error(`${label} supera el máximo de ${max} caracteres.`);
  return cleaned;
};

function requireActive(state: State, profileId: string, label = "responsable") {
  const profile = state.profiles.find((candidate) => candidate.id === profileId && candidate.active);
  if (!profile) throw Error(`Elegí un ${label} activo.`);
  return profile;
}

function requireCompany(profile: Profile, companyId: string) {
  if (!profile.companyIds.includes(companyId)) throw Error("La empresa está fuera del ámbito de este perfil.");
}

function activeProcessActor(state: State, actor: Profile) {
  const current = state.profiles.find((profile) => profile.id === actor.id);
  return current?.active ? current : null;
}

function hasProcessCompanyScope(state: State, actor: Profile, companyId: string) {
  const current = activeProcessActor(state, actor);
  return !!current && state.companies.some((company) => company.id === companyId) &&
    (current.role === "jefe" || current.companyIds.includes(companyId));
}

function canAccessProcessSubject(state: State, actor: Profile, profileId: string, companyId: string) {
  const current = activeProcessActor(state, actor);
  if (!current || !hasProcessCompanyScope(state, current, companyId)) return false;
  if (current.role === "jefe") return true;
  const subject = state.profiles.find((profile) => profile.id === profileId && profile.active && profile.companyIds.includes(companyId));
  if (!subject) return false;
  if (current.id === subject.id) return true;
  return current.role === "encargado" && subject.managerId === current.id;
}

export function canCoordinateProcess(state: State, actor: Profile, profileId: string, companyId: string) {
  const current = activeProcessActor(state, actor);
  return !!current && hasProcessCompanyScope(state, current, companyId) && (current.role === "jefe" ||
    current.role === "encargado" && canAccessProcessSubject(state, current, profileId, companyId) && canSee(current, profileId, state.profiles));
}

export function canViewKaizenProposal(state: State, actor: Profile, proposal: KaizenProposal) {
  return canAccessProcessSubject(state, actor, proposal.proposedBy, proposal.companyId) ||
    canAccessProcessSubject(state, actor, proposal.responsibleId, proposal.companyId);
}

export function canViewFiveSReview(state: State, actor: Profile, review: FiveSReview) {
  return canAccessProcessSubject(state, actor, review.createdBy, review.companyId) ||
    review.items.some((item) => canAccessProcessSubject(state, actor, item.responsibleId, review.companyId));
}

function sameTemplateSnapshot(version: Pick<CatalogueVersion, "title" | "sector" | "kind" | "weight" | "unit" | "target" | "description" | "steps">, template: Template) {
  return version.title === template.title && version.sector === template.sector &&
    version.kind === template.kind && version.weight === template.weight &&
    version.unit === template.unit && version.target === template.target &&
    version.description === template.description && JSON.stringify(version.steps) === JSON.stringify(template.steps);
}

function snapshot(
  template: Template,
  version: number,
  capturedAt: string,
  effectiveOn: string | null,
  createdBy: string | null,
  source: CatalogueVersionSource,
  changeReason: string,
  makeId: () => string,
  sourceProposalId?: string,
): CatalogueVersion {
  return {
    id: makeId(), templateId: template.id, version, title: template.title,
    sector: template.sector, kind: template.kind, weight: template.weight,
    unit: template.unit, target: template.target, steps: [...template.steps],
    description: template.description, capturedAt, effectiveOn, createdBy,
    source, changeReason, ...(sourceProposalId ? { sourceProposalId } : {}),
  };
}

/** Adds a truthful first snapshot for older lab data without inventing its
 * original effective date. Also records any pre-versioning catalog edits. */
export function ensureCatalogueVersions(state: State, now = new Date().toISOString(), makeId: () => string = id): State {
  const versions = [...(state.catalogueVersions || [])];
  for (const template of state.templates) {
    const history = versions.filter((version) => version.templateId === template.id);
    if (!history.length) {
      versions.push(snapshot(template, 1, now, null, null, "initial_snapshot", "Primera foto versionada del laboratorio; la vigencia anterior no está registrada.", makeId));
      continue;
    }
    const latest = history.reduce((a, b) => a.version > b.version ? a : b);
    if (!sameTemplateSnapshot(latest, template)) {
      const nextVersion = Math.max(...history.map((version) => version.version)) + 1;
      versions.push(snapshot(template, nextVersion, now, null, null, "legacy_reconciliation", "Captura de diferencias del catálogo anteriores al control de versiones.", makeId));
    }
  }
  return { ...state, catalogueVersions: versions };
}

export function currentCatalogueVersion(state: State, templateId: string) {
  const rows = (state.catalogueVersions || []).filter((version) => version.templateId === templateId);
  return rows.reduce((latest, row) => Math.max(latest, row.version), 0);
}

/** Pin future rules only when their saved snapshot exactly matches the current
 * standard. Existing task occurrences remain untouched and unversioned unless
 * the evidence already carries their version. */
export function pinMatchingCatalogueAssignments(state: State): State {
  const assignments = state.assignments.map((assignment) => {
    if (assignment.templateVersion || !assignment.templateId) return assignment;
    const template = state.templates.find((row) => row.id === assignment.templateId);
    const version = currentCatalogueVersion(state, assignment.templateId);
    if (!template || !version || assignment.title !== template.title || assignment.sector !== template.sector ||
        assignment.kind !== template.kind || assignment.weight !== template.weight || assignment.unit !== template.unit ||
        assignment.target !== template.target || JSON.stringify(assignment.steps) !== JSON.stringify(template.steps)) return assignment;
    return { ...assignment, templateVersion: version };
  });
  return { ...state, assignments };
}

export function addCatalogueTemplate(state: State, template: Template, actor: Profile, now = new Date().toISOString(), makeId: () => string = id) {
  if (!actor.active || actor.role !== "jefe") throw Error("Sólo jefatura puede incorporar procesos estándar.");
  if (state.templates.some((row) => row.id === template.id)) throw Error("El proceso ya existe en el catálogo.");
  const version = snapshot(template, 1, now, dateART(now), actor.id, "catalog_change", "Alta de proceso estándar.", makeId);
  return { ...state, templates: [...state.templates, { ...template, steps: [...template.steps] }], catalogueVersions: [...(state.catalogueVersions || []), version] };
}

export function reviseCatalogueTemplate(
  state: State,
  templateId: string,
  actor: Profile,
  patch: Partial<Pick<Template, "weight" | "target" | "description" | "steps">>,
  reason: string,
  now = new Date().toISOString(),
  makeId: () => string = id,
) {
  if (!actor.active || actor.role !== "jefe") throw Error("Sólo jefatura puede versionar el catálogo.");
  const prepared = ensureCatalogueVersions(state, now, makeId);
  const current = prepared.templates.find((row) => row.id === templateId);
  if (!current) throw Error("El proceso ya no está disponible en el catálogo.");
  const next = { ...current, ...patch, steps: patch.steps ? [...patch.steps] : [...current.steps] };
  if (sameTemplateSnapshot((prepared.catalogueVersions || []).filter((row) => row.templateId === templateId).reduce((a, b) => a.version > b.version ? a : b), next))
    throw Error("No hay cambios para guardar como nueva versión.");
  if (!Number.isFinite(next.weight) || next.weight < 0 || !Number.isFinite(next.target) || next.target < 0)
    throw Error("El peso y la meta deben ser valores válidos.");
  const rows = (prepared.catalogueVersions || []).filter((row) => row.templateId === templateId);
  const newVersion = snapshot(next, Math.max(...rows.map((row) => row.version)) + 1, now, dateART(now), actor.id, "catalog_change", text(reason, "el motivo del cambio", 500), makeId);
  return { ...prepared, templates: prepared.templates.map((row) => row.id === templateId ? next : row), catalogueVersions: [...(prepared.catalogueVersions || []), newVersion] };
}

export function createKaizenProposal(
  state: State,
  actor: Profile,
  input: KaizenInput,
  now = new Date().toISOString(),
  makeId: () => string = id,
): KaizenProposal {
  if (!actor.active) throw Error("El perfil está inactivo.");
  if (!hasProcessCompanyScope(state, actor, input.companyId)) throw Error("La empresa está fuera del ámbito de este perfil.");
  const template = state.templates.find((row) => row.id === input.templateId);
  if (!template) throw Error("Elegí un proceso vigente del catálogo.");
  const responsible = requireActive(state, input.responsibleId);
  requireCompany(responsible, input.companyId);
  if (!Number.isFinite(input.baselineValue) || input.baselineValue < 0 || !Number.isFinite(input.objectiveValue) || input.objectiveValue < 0)
    throw Error("La medición inicial y la meta deben ser números válidos, iguales o mayores a cero.");
  if (input.direction === "lower" ? input.objectiveValue >= input.baselineValue : input.objectiveValue <= input.baselineValue)
    throw Error("La meta debe expresar una mejora respecto de la medición inicial.");
  if (!validDate(input.trialFrom) || !validDate(input.trialThrough) || input.trialThrough < input.trialFrom)
    throw Error("Indicá un período de prueba válido, con inicio anterior o igual al fin.");
  return {
    id: makeId(), templateId: template.id, companyId: input.companyId, templateTitle: template.title,
    problemObserved: text(input.problemObserved, "el problema observado", 1200),
    baselineValue: input.baselineValue, objectiveValue: input.objectiveValue,
    unit: text(input.unit, "la unidad de medición", 40), direction: input.direction,
    baselineEvidence: text(input.baselineEvidence, "la evidencia inicial", 2000),
    baselineContext: text(input.baselineContext, "el contexto y volumen inicial", 1200),
    proposedChange: text(input.proposedChange, "el cambio propuesto", 1600),
    responsibleId: responsible.id, proposedBy: actor.id, proposedAt: now,
    trialFrom: input.trialFrom, trialThrough: input.trialThrough, status: "proposed",
  };
}

export function reviewKaizenProposal(state: State, actor: Profile, proposalId: string, decision: "test" | "reject", note: string, now = new Date().toISOString()) {
  if (!actor.active) throw Error("El perfil está inactivo.");
  const proposal = (state.improvementProposals || []).find((row) => row.id === proposalId);
  if (!proposal || proposal.status !== "proposed") throw Error("La propuesta ya no está pendiente de revisión.");
  if (!canCoordinateProcess(state, actor, proposal.proposedBy, proposal.companyId) && !canCoordinateProcess(state, actor, proposal.responsibleId, proposal.companyId))
    throw Error("Sólo el encargado responsable o jefatura pueden revisar esta propuesta.");
  const reviewNote = text(note, decision === "test" ? "el criterio para habilitar la prueba" : "el motivo del rechazo", 1000);
  const updated: KaizenProposal = decision === "test"
    ? { ...proposal, status: "testing", reviewNote, reviewedBy: actor.id, reviewedAt: now }
    : { ...proposal, status: "rejected", reviewNote, reviewedBy: actor.id, reviewedAt: now, decisionNote: reviewNote, decidedBy: actor.id, decidedAt: now };
  return { ...state, improvementProposals: (state.improvementProposals || []).map((row) => row.id === proposalId ? updated : row) };
}

export function recordKaizenMeasurement(state: State, actor: Profile, proposalId: string, input: KaizenMeasurement, now = new Date().toISOString()) {
  if (!actor.active) throw Error("El perfil está inactivo.");
  const proposal = (state.improvementProposals || []).find((row) => row.id === proposalId);
  if (!proposal || proposal.status !== "testing") throw Error("La propuesta no está en etapa de prueba.");
  if (!(actor.id === proposal.responsibleId && canAccessProcessSubject(state, actor, proposal.responsibleId, proposal.companyId)) &&
      !canCoordinateProcess(state, actor, proposal.responsibleId, proposal.companyId))
    throw Error("Sólo la persona responsable, su encargado o jefatura pueden registrar la medición.");
  if (!Number.isFinite(input.afterValue) || input.afterValue < 0) throw Error("La medición posterior debe ser un número válido, igual o mayor a cero.");
  if (!validDate(input.measuredOn) || input.measuredOn < proposal.trialFrom || input.measuredOn > proposal.trialThrough)
    throw Error("La fecha de medición debe estar dentro del período de prueba aprobado.");
  const updated: KaizenProposal = {
    ...proposal, status: "measured", afterValue: input.afterValue,
    afterEvidence: text(input.afterEvidence, "la evidencia posterior", 2000),
    afterContext: text(input.afterContext, "el volumen y contexto posterior", 1200),
    measuredOn: input.measuredOn, measuredBy: actor.id,
  };
  return { ...state, improvementProposals: (state.improvementProposals || []).map((row) => row.id === proposalId ? updated : row) };
}

export function decideKaizenProposal(
  state: State,
  actor: Profile,
  proposalId: string,
  decision: "adopt" | "reject",
  note: string,
  standard?: { description: string; steps: string[] },
  now = new Date().toISOString(),
  makeId: () => string = id,
) {
  const currentActor = activeProcessActor(state, actor);
  if (!currentActor) throw Error("El perfil está inactivo.");
  const proposal = (state.improvementProposals || []).find((row) => row.id === proposalId);
  if (!proposal || proposal.status !== "measured") throw Error("La propuesta necesita una medición final antes de decidir.");
  if (!hasProcessCompanyScope(state, currentActor, proposal.companyId)) throw Error("La empresa de la propuesta ya no está disponible en el ámbito vigente.");
  if (decision === "adopt" && currentActor.role !== "jefe") throw Error("La adopción de un estándar requiere decisión de jefatura.");
  if (decision === "reject" && !canCoordinateProcess(state, actor, proposal.responsibleId, proposal.companyId)) throw Error("Sólo el encargado responsable o jefatura pueden cerrar la propuesta.");
  const decisionNote = text(note, decision === "adopt" ? "la comparación y criterio de adopción" : "el motivo del descarte", 1200);
  let nextState = state;
  let adoptedVersion: number | undefined;
  if (decision === "adopt") {
    const current = state.templates.find((row) => row.id === proposal.templateId);
    if (!current) throw Error("El proceso vinculado ya no está en el catálogo.");
    if (!standard) throw Error("Definí la descripción y los controles de la nueva versión.");
    const description = text(standard.description, "el objetivo actualizado", 1000);
    const steps = standard.steps.map((step) => text(step, "cada control estándar", 240)).filter(Boolean);
    if (!steps.length) throw Error("La nueva versión necesita al menos un control verificable.");
    const prepared = ensureCatalogueVersions(state, now, makeId);
    const versions = (prepared.catalogueVersions || []).filter((row) => row.templateId === current.id);
    adoptedVersion = Math.max(...versions.map((row) => row.version)) + 1;
    const revised = { ...current, description, steps: [...steps] };
    const version = snapshot(revised, adoptedVersion, now, dateART(now), actor.id, "kaizen_adoption", decisionNote, makeId, proposal.id);
    const assignments = prepared.assignments.map((assignment) => assignment.templateId === current.id && !assignment.retired
      ? { ...assignment, templateVersion: adoptedVersion, steps: [...steps] }
      : assignment);
    const futureTasks = prepared.tasks.map((task) => {
      const untouched = task.status === "Pendiente" && !task.startedAt && !task.completedAt &&
        !(task.sessions || []).length && task.checklist.every((check) => !check.done);
      if (task.templateId !== current.id || !task.scheduledOn || task.scheduledOn < dateART(now) || !untouched || isClosed(prepared, task)) return task;
      return {
        ...task, templateVersion: adoptedVersion,
        checklist: steps.map((step, index) => ({ id: task.checklist[index]?.id || makeId(), text: step, done: false })),
      };
    });
    nextState = {
      ...prepared,
      templates: prepared.templates.map((row) => row.id === current.id ? revised : row),
      assignments,
      tasks: futureTasks,
      catalogueVersions: [...(prepared.catalogueVersions || []), version],
    };
  }
  const finalStatus: KaizenStatus = decision === "adopt" ? "adopted" : "rejected";
  const decided: KaizenProposal = { ...proposal, status: finalStatus, decisionNote, decidedBy: actor.id, decidedAt: now, ...(adoptedVersion ? { adoptedVersion } : {}) };
  return { ...nextState, improvementProposals: (nextState.improvementProposals || []).map((row) => row.id === proposalId ? decided : row) };
}

export function createFiveSReview(state: State, actor: Profile, input: FiveSReviewInput, now = new Date().toISOString(), makeId: () => string = id): FiveSReview {
  if (!actor.active) throw Error("El perfil está inactivo.");
  if (!hasProcessCompanyScope(state, actor, input.companyId)) throw Error("La empresa está fuera del ámbito de este perfil.");
  if (!validDate(input.reviewedOn)) throw Error("Indicá una fecha de revisión válida.");
  const template = input.templateId ? state.templates.find((row) => row.id === input.templateId) : undefined;
  if (input.templateId && !template) throw Error("El proceso seleccionado ya no está disponible.");
  const scopeTitle = text(template?.title || input.scopeTitle, "el alcance de la revisión", 120);
  if (input.items.length !== FIVE_S_AREAS.length || new Set(input.items.map((item) => item.id)).size !== FIVE_S_AREAS.length ||
      FIVE_S_AREAS.some((area) => !input.items.some((item) => item.id === area.id)))
    throw Error("La revisión debe cubrir una sola vez cada una de las cinco áreas 5S.");
  const items = input.items.map((item) => {
    const responsible = requireActive(state, item.responsibleId);
    requireCompany(responsible, input.companyId);
    if (!validDate(item.dueOn) || item.dueOn < input.reviewedOn) throw Error("Cada acción debe tener una fecha válida igual o posterior a la revisión.");
    return {
      id: item.id, result: item.result,
      evidence: text(item.evidence, `la evidencia de ${FIVE_S_AREAS.find((area) => area.id === item.id)!.label}`, 1200),
      finding: text(item.finding, `el hallazgo de ${FIVE_S_AREAS.find((area) => area.id === item.id)!.label}`, 800),
      action: text(item.action, `la acción de ${FIVE_S_AREAS.find((area) => area.id === item.id)!.label}`, 800),
      responsibleId: responsible.id, dueOn: item.dueOn, status: "open" as const,
    };
  });
  return { id: makeId(), companyId: input.companyId, templateId: template?.id || null, scopeTitle, reviewedOn: input.reviewedOn, createdAt: now, createdBy: actor.id, items };
}

export function completeFiveSAction(state: State, actor: Profile, reviewId: string, areaId: FiveSAreaId, completionEvidence: string, completedOn: string, now = new Date().toISOString()) {
  if (!actor.active) throw Error("El perfil está inactivo.");
  const review = (state.fiveSReviews || []).find((row) => row.id === reviewId);
  const item = review?.items.find((row) => row.id === areaId);
  if (!review || !item || item.status !== "open") throw Error("La acción 5S ya no está pendiente.");
  if (!(actor.id === item.responsibleId && canAccessProcessSubject(state, actor, item.responsibleId, review.companyId)) &&
      !canCoordinateProcess(state, actor, item.responsibleId, review.companyId))
    throw Error("Sólo la persona asignada, su encargado o jefatura pueden cerrar esta acción.");
  if (!validDate(completedOn) || completedOn < review.reviewedOn) throw Error("Indicá una fecha válida de verificación.");
  const nextItem: FiveSItem = { ...item, status: "done", completionEvidence: text(completionEvidence, "la evidencia de cierre", 1200), completedOn, completedBy: actor.id };
  const nextReview = { ...review, items: review.items.map((row) => row.id === areaId ? nextItem : row) };
  return { ...state, fiveSReviews: (state.fiveSReviews || []).map((row) => row.id === reviewId ? nextReview : row) };
}
