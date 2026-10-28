import { addCatalogueTemplate, currentCatalogueVersion, ensureCatalogueVersions } from "./processImprovement";
import { canSee, id, type HabitualTaskProposal, type Profile, type State, type Template } from "./model";
import { validateSchedule, type Schedule } from "./schedule";
import { CONCEPT_CODES, STARTER_CONCEPT_CODES, WORKFORCE_TAXONOMY_VERSION, type NeutralConceptCode } from "./workforceTaxonomy.mjs";
import { getParisTask, hasRequiredParisTaskParameters, isParisBusinessUnitCode, isParisTaskCatalogVersion, isParisTaskParameterSet, PARIS_TASK_CATALOG_VERSION } from "./parisTaskCatalog";

export interface HabitualProposalInput {
  id: string;
  companyId: string;
  starterId?: string;
  taskCode?: string;
  taskCatalogVersion?: number;
  businessUnitCode?: import("./parisTaskCatalog").ParisBusinessUnitCode;
  taskParameters?: Record<string, string>;
  title: string;
  process: string;
  description: string;
  kind: Template["kind"];
  unit: string;
  target: number;
  schedule: Schedule;
  steps: string[];
  neutralConceptCode?: NeutralConceptCode;
  taxonomyVersion?: 2;
}

export interface StandardProposalInput {
  title: string;
  sector: string;
  description: string;
  kind: Template["kind"];
  unit: string;
  weight: number;
  target: number;
  steps: string[];
}

export type ProposalGroup = {
  key: string;
  suggestedMatch: boolean;
  proposals: HabitualTaskProposal[];
};

function classification(input: Pick<HabitualProposalInput, "neutralConceptCode" | "taxonomyVersion" | "starterId">) {
  if (input.neutralConceptCode === undefined && input.taxonomyVersion === undefined && !input.starterId) return {};
  const mappedCode = input.starterId ? STARTER_CONCEPT_CODES[input.starterId] : undefined;
  const neutralConceptCode = input.neutralConceptCode ?? mappedCode;
  const taxonomyVersion = input.taxonomyVersion ?? (mappedCode ? WORKFORCE_TAXONOMY_VERSION : undefined);
  if (!neutralConceptCode || taxonomyVersion !== WORKFORCE_TAXONOMY_VERSION ||
      !CONCEPT_CODES.has(neutralConceptCode))
    throw Error("La clasificación neutral está incompleta o no pertenece a una versión admitida.");
  if (input.starterId && mappedCode !== neutralConceptCode)
    throw Error("La clasificación neutral no corresponde a la sugerencia versionada seleccionada.");
  return { neutralConceptCode, taxonomyVersion: WORKFORCE_TAXONOMY_VERSION as 2 };
}

function cleanProposal(input: Omit<HabitualProposalInput, "id" | "companyId">, allowHistoricalCatalogVersion = false) {
  const title = input.title.trim().replace(/\s+/g, " ");
  const process = input.process.trim().replace(/\s+/g, " ");
  const description = input.description.trim();
  const unit = input.unit.trim().replace(/\s+/g, " ");
  const taskParameters = input.taskParameters === undefined ? undefined : Object.fromEntries(Object.entries(input.taskParameters).map(([key, value]) => [key, value.trim()]));
  const steps = input.steps.map((step) => step.trim()).filter(Boolean);
  if (!title || title.length > 120) throw Error("La tarea necesita un nombre de hasta 120 caracteres.");
  if (process.length > 160) throw Error("El banco o proceso admite hasta 160 caracteres.");
  if (!description || description.length > 1000) throw Error("Describí el trabajo en hasta 1000 caracteres.");
  if (!steps.length || steps.length > 50 || steps.some((step) => step.length > 300))
    throw Error("La propuesta necesita entre 1 y 50 controles de hasta 300 caracteres.");
  if (!Number.isFinite(input.target) || input.target < 0) throw Error("El dato numérico de la propuesta no es válido.");
  if (input.kind === "operativa" && !unit) throw Error("Indicá la unidad de la tarea operativa.");
  if (input.taskCode) {
    const version = input.taskCatalogVersion;
    const definition = isParisTaskCatalogVersion(version) ? getParisTask(input.taskCode, version) : undefined;
    if (!definition || definition.state !== "selectable" || (!allowHistoricalCatalogVersion && version !== PARIS_TASK_CATALOG_VERSION) ||
        !input.businessUnitCode || !isParisBusinessUnitCode(input.businessUnitCode))
      throw Error("La tarea estándar necesita un código, versión y unidad de negocio vigentes.");
    const expectedKind = definition.kind === "operational" ? "operativa" : "resultado";
    if (title !== definition.label || input.kind !== expectedKind || unit !== (definition.unit || ""))
      throw Error("El nombre, tipo y unidad de una tarea estándar los define el catálogo; no se pueden editar.");
    if (!isParisTaskParameterSet(input.taskCode, taskParameters || {}, version) || !hasRequiredParisTaskParameters(input.taskCode, taskParameters || {}, version))
      throw Error("Completá los datos obligatorios para identificar esta tarea y verificá sus parámetros.");
  } else if (input.taskCatalogVersion !== undefined || input.businessUnitCode !== undefined || taskParameters !== undefined) {
    throw Error("La unidad de negocio sólo se puede asociar a una tarea estándar versionada.");
  }
  validateSchedule(input.schedule);
  return { title, process, description, unit, steps, ...(taskParameters ? { taskParameters } : {}) };
}

export function submitHabitualTaskProposal(
  state: State,
  actor: Profile,
  input: HabitualProposalInput,
  now = new Date().toISOString(),
  makeId: () => string = id,
): State {
  if (!actor.active) throw Error("El perfil está inactivo.");
  if (!actor.companyIds.includes(input.companyId)) throw Error("La empresa ya no está asignada a este perfil.");
  const existing = (state.habitualTaskProposals || []).find((row) => row.id === input.id);
  if (existing) {
    if (existing.ownerId !== actor.id || existing.companyId !== input.companyId)
      throw Error("La referencia de la propuesta ya está ocupada.");
    return state;
  }
  const clean = cleanProposal(input);
  const neutral = classification(input);
  const snapshot = {
    revision: 1,
    ...(input.starterId ? { starterId: input.starterId } : {}),
    ...(input.taskCode ? { taskCode: input.taskCode, taskCatalogVersion: input.taskCatalogVersion, businessUnitCode: input.businessUnitCode, ...(clean.taskParameters ? { taskParameters: clean.taskParameters } : {}) } : {}),
    title: clean.title,
    process: clean.process,
    description: clean.description,
    kind: input.kind,
    unit: clean.unit,
    target: input.target,
    schedule: structuredClone(input.schedule),
    steps: clean.steps,
    ...neutral,
    submittedAt: now,
  };
  const proposal: HabitualTaskProposal = {
    id: input.id,
    ownerId: actor.id,
    companyId: input.companyId,
    ...(input.starterId ? { starterId: input.starterId } : {}),
    ...(input.taskCode ? { taskCode: input.taskCode, taskCatalogVersion: input.taskCatalogVersion, businessUnitCode: input.businessUnitCode, ...(clean.taskParameters ? { taskParameters: clean.taskParameters } : {}) } : {}),
    originalTitle: clean.title,
    ...neutral,
    ...snapshot,
    submittedAt: now,
    updatedAt: now,
    status: "pending",
    submissions: [snapshot],
    history: [{ id: makeId(), by: actor.id, action: "submitted", note: "Propuesta enviada desde la inducción.", at: now }],
  };
  return { ...state, habitualTaskProposals: [...(state.habitualTaskProposals || []), proposal] };
}

function normalizeWords(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR")
    .replace(/\bconc\.?\b/g, " conciliacion ")
    .replace(/\bbna\b/g, " banco nacion ")
    .replace(/\bempresa\s+[a-z0-9-]+\b/g, " ")
    .replace(/\be\s*\d+\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

/** Returns candidate groups only; it never changes a proposal or catalogue entry. */
export function groupHabitualTaskProposals(rows: HabitualTaskProposal[]): ProposalGroup[] {
  const groups = new Map<string, HabitualTaskProposal[]>();
  for (const proposal of rows.filter((row) => row.status === "pending")) {
    const process = normalizeWords(`${proposal.title} ${proposal.process}`);
    const parameterKey = JSON.stringify(Object.fromEntries(Object.entries(proposal.taskParameters || {}).sort(([a], [b]) => a.localeCompare(b))));
    const key = [proposal.kind, proposal.kind === "operativa" ? normalizeWords(proposal.unit) : "", proposal.neutralConceptCode || "", proposal.taxonomyVersion || "", proposal.taskCode || "", proposal.taskCatalogVersion || "", proposal.businessUnitCode || "", parameterKey, process].join("\u001f");
    groups.set(key, [...(groups.get(key) || []), proposal]);
  }
  return [...groups.entries()]
    .map(([key, proposals]) => ({ key, suggestedMatch: proposals.length > 1, proposals: proposals.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.id.localeCompare(b.id)) }))
    .sort((a, b) => a.proposals[0].title.localeCompare(b.proposals[0].title, "es-AR"));
}

function requireManager(state: State, actor: Profile, proposals: HabitualTaskProposal[]) {
  if (!actor.active || actor.role !== "jefe") throw Error("Sólo jefatura puede revisar tareas habituales.");
  for (const proposal of proposals) {
    const owner = state.profiles.find((profile) => profile.id === proposal.ownerId);
    if (!owner?.active || !canSee(actor, owner.id, state.profiles)) throw Error("La propuesta ya no pertenece a un perfil autorizado.");
    if (!owner.companyIds.includes(proposal.companyId)) throw Error("La relación de empresa de la propuesta ya no está vigente.");
  }
}

export function requestHabitualProposalChanges(
  state: State,
  actor: Profile,
  proposalId: string,
  note: string,
  now = new Date().toISOString(),
  makeId: () => string = id,
): State {
  const proposal = (state.habitualTaskProposals || []).find((row) => row.id === proposalId);
  if (!proposal || proposal.status !== "pending") throw Error("La propuesta ya no está pendiente.");
  requireManager(state, actor, [proposal]);
  const reason = note.trim();
  if (reason.length < 5 || reason.length > 500) throw Error("Explicá el cambio solicitado en 5 a 500 caracteres.");
  return {
    ...state,
    habitualTaskProposals: state.habitualTaskProposals!.map((row) => row.id === proposal.id ? {
      ...row, status: "changes_requested", managerNote: reason, updatedAt: now,
      history: [...row.history, { id: makeId(), by: actor.id, action: "changes_requested", note: reason, at: now }],
    } : row),
  };
}

export function resubmitHabitualTaskProposal(
  state: State,
  actor: Profile,
  proposalId: string,
  input: Omit<HabitualProposalInput, "id" | "companyId">,
  now = new Date().toISOString(),
  makeId: () => string = id,
): State {
  const proposal = (state.habitualTaskProposals || []).find((row) => row.id === proposalId);
  if (!proposal || proposal.status !== "changes_requested") throw Error("La propuesta no tiene correcciones pendientes.");
  const currentActor = state.profiles.find((profile) => profile.id === actor.id);
  if (!currentActor?.active || proposal.ownerId !== currentActor.id) throw Error("Sólo quien presentó la propuesta puede corregirla.");
  if (!currentActor.companyIds.includes(proposal.companyId)) throw Error("La empresa de esta propuesta ya no está asignada a tu perfil.");
  const clean = cleanProposal(input, true);
  const suppliedNeutral = classification(input);
  if ((input.neutralConceptCode !== undefined || input.taxonomyVersion !== undefined) &&
      (suppliedNeutral.neutralConceptCode !== proposal.neutralConceptCode || suppliedNeutral.taxonomyVersion !== proposal.taxonomyVersion))
    throw Error("La clasificación neutral aprobada no se puede cambiar al reenviar una propuesta.");
  if (proposal.taskCode && (input.taskCode !== proposal.taskCode || input.taskCatalogVersion !== proposal.taskCatalogVersion || input.businessUnitCode !== proposal.businessUnitCode))
    throw Error("La tarea estándar y la unidad de negocio no se pueden cambiar al reenviar la propuesta.");
  const neutral = classification({ ...proposal, starterId: proposal.starterId });
  const changed = proposal.title !== clean.title || proposal.process !== clean.process || proposal.description !== clean.description ||
    proposal.kind !== input.kind || proposal.unit !== clean.unit || proposal.target !== input.target ||
    JSON.stringify(proposal.taskParameters || {}) !== JSON.stringify(clean.taskParameters || {}) ||
    JSON.stringify(proposal.schedule) !== JSON.stringify(input.schedule) || JSON.stringify(proposal.steps) !== JSON.stringify(clean.steps);
  if (!changed) throw Error("Hacé al menos el cambio solicitado antes de reenviar.");
  const revision = proposal.revision + 1;
  const submission = {
    revision, ...(proposal.starterId ? { starterId: proposal.starterId } : {}), title: clean.title, process: clean.process, description: clean.description,
    ...(proposal.taskCode ? { taskCode: proposal.taskCode, taskCatalogVersion: proposal.taskCatalogVersion, businessUnitCode: proposal.businessUnitCode, ...(clean.taskParameters ? { taskParameters: clean.taskParameters } : {}) } : {}),
    kind: input.kind, unit: clean.unit, target: input.target,
    schedule: structuredClone(input.schedule), steps: clean.steps, ...neutral, submittedAt: now,
  };
  return {
    ...state,
    habitualTaskProposals: state.habitualTaskProposals!.map((row) => row.id === proposal.id ? {
      ...row, ...submission, revision, status: "pending", managerNote: undefined, updatedAt: now,
      submissions: [...row.submissions, submission],
      history: [...row.history, { id: makeId(), by: actor.id, action: "resubmitted", note: "Se reenviaron los cambios solicitados.", at: now }],
    } : row),
  };
}

export function approveHabitualTaskProposals(
  state: State,
  actor: Profile,
  proposalIds: string[],
  decision: { kind: "link"; templateId: string } | { kind: "create"; template: StandardProposalInput },
  month: string,
  now = new Date().toISOString(),
  makeId: () => string = id,
): State {
  const ids = [...new Set(proposalIds)];
  if (!ids.length || ids.length !== proposalIds.length) throw Error("Seleccioná propuestas distintas para revisar.");
  const proposals = ids.map((proposalId) => (state.habitualTaskProposals || []).find((row) => row.id === proposalId));
  if (proposals.some((row) => !row || row.status !== "pending")) throw Error("Todas las propuestas deben seguir pendientes.");
  const selected = proposals as HabitualTaskProposal[];
  requireManager(state, actor, selected);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error("El período de asignación no es válido.");
  if (new Set(selected.map((row) => row.kind)).size !== 1 ||
      new Set(selected.map((row) => row.kind === "operativa" ? normalizeWords(row.unit) : "")).size !== 1 ||
      new Set(selected.map((row) => `${row.neutralConceptCode || ""}:${row.taxonomyVersion || ""}`)).size !== 1 ||
      new Set(selected.map((row) => `${row.taskCode || ""}:${row.taskCatalogVersion || ""}`)).size !== 1 ||
      new Set(selected.map((row) => `${row.businessUnitCode || ""}:${JSON.stringify(Object.fromEntries(Object.entries(row.taskParameters || {}).sort(([a], [b]) => a.localeCompare(b))))}`)).size !== 1)
    throw Error("El grupo mezcla tipos, unidades de negocio o parámetros que no comparten un estándar.");
  if (selected.some((row) => row.taskCode && !hasRequiredParisTaskParameters(row.taskCode, row.taskParameters || {}, row.taskCatalogVersion)))
    throw Error("Completá los parámetros obligatorios de cada tarea antes de aprobarla.");

  const neutral = classification(selected[0]!);

  let next = ensureCatalogueVersions(state, now, makeId);
  let template: Template | undefined;
  if (decision.kind === "link") {
    template = next.templates.find((row) => row.id === decision.templateId);
    if (!template) throw Error("El estándar seleccionado ya no está disponible.");
    if (template.neutralConceptCode !== neutral.neutralConceptCode || template.taxonomyVersion !== neutral.taxonomyVersion)
      throw Error("El estándar y la propuesta no comparten una clasificación neutral confirmada.");
    if (template.taskCode !== selected[0]!.taskCode || template.taskCatalogVersion !== selected[0]!.taskCatalogVersion)
      throw Error("El estándar elegido no coincide con el código de tarea de la propuesta.");
  } else {
    const input = decision.template;
    const title = input.title.trim().replace(/\s+/g, " ");
    const steps = input.steps.map((step) => step.trim()).filter(Boolean);
    if (!title || title.length > 120 || !input.sector.trim() || input.sector.length > 80 || !input.description.trim() || input.description.length > 1000)
      throw Error("Completá nombre, rubro y objetivo del estándar.");
    if (!Number.isFinite(input.weight) || input.weight < 0 || !Number.isFinite(input.target) || input.target < 0)
      throw Error("El peso y la referencia numérica deben ser válidos.");
    if (!steps.length || steps.length > 50 || steps.some((step) => step.length > 300))
      throw Error("El estándar necesita entre 1 y 50 controles válidos.");
    if (selected.some((row) => row.kind !== input.kind || (row.kind === "operativa" && normalizeWords(row.unit) !== normalizeWords(input.unit))))
      throw Error("El estándar debe conservar el tipo y la unidad de todas las propuestas del grupo.");
    const normalizedTitle = normalizeWords(title);
    const taskCode = selected[0]!.taskCode;
    const taskCatalogVersion = selected[0]!.taskCatalogVersion;
    if (taskCode) {
      const definition = isParisTaskCatalogVersion(taskCatalogVersion) ? getParisTask(taskCode, taskCatalogVersion) : undefined;
      if (!definition || definition.state !== "selectable" || title !== definition.label || input.kind !== (definition.kind === "operational" ? "operativa" : "resultado") || (input.kind === "operativa" && normalizeWords(input.unit) !== normalizeWords(definition.unit || "")))
        throw Error("La tarea estándar debe conservar su nombre, tipo, unidad y versión del catálogo.");
      const description = input.description.trim();
      const meaningfulSteps = input.steps.filter((step) => step.trim().length >= 10 && !/confirmar procedimiento y controles con jefatura/i.test(step.trim()));
      if (description.length < 20 || /selección del catálogo grupo parís/i.test(description) || !meaningfulSteps.length)
        throw Error("Antes de activar la tarea estándar, jefatura debe definir una descripción y al menos un control real.");
      if (next.templates.some((row) => row.taskCode === taskCode && row.taskCatalogVersion === taskCatalogVersion))
        throw Error("Este código ya tiene un estándar; vinculá la propuesta al estándar existente.");
    }
    if (next.templates.some((row) => normalizeWords(row.title) === normalizedTitle))
      throw Error("Ya existe un estándar con ese nombre; vinculá las propuestas a ese proceso.");
    template = {
      id: makeId(), title, sector: input.sector.trim(), kind: input.kind,
      weight: input.weight, unit: input.kind === "operativa" ? input.unit.trim() : "",
      target: 0,
      steps, description: input.description.trim(),
      ...(taskCode ? { taskCode, taskCatalogVersion } : {}),
      ...neutral,
    };
    next = addCatalogueTemplate(next, template, actor, now, makeId);
  }
  if (selected.some((row) => row.kind !== template!.kind || (row.kind === "operativa" && normalizeWords(row.unit) !== normalizeWords(template!.unit))))
    throw Error("El estándar elegido no coincide con el tipo o unidad de la propuesta.");
  const templateVersion = currentCatalogueVersion(next, template.id);
  if (!templateVersion) throw Error("El estándar no tiene una versión vigente para asignar.");

  const assignments = selected.map((proposal) => ({
    id: `habitual-proposal-assignment:${proposal.id}`,
    templateId: template!.id,
    templateVersion,
    ...neutral,
    title: template!.title,
    ownerId: proposal.ownerId,
    companyId: proposal.companyId,
    sector: template!.sector,
    kind: template!.kind,
    weight: template!.weight,
    unit: template!.unit,
    target: proposal.kind === "operativa" ? 0 : template!.target,
    day: Number(proposal.schedule.startDate.slice(-2)),
    frequency: proposal.schedule.frequency,
    schedule: structuredClone(proposal.schedule),
    steps: [...template!.steps],
    ...(proposal.taskCode ? { taskCode: proposal.taskCode, taskCatalogVersion: proposal.taskCatalogVersion, businessUnitCode: proposal.businessUnitCode, ...(proposal.taskParameters ? { taskParameters: { ...proposal.taskParameters } } : {}) } : {}),
    startMonth: month,
    priority: "Media" as const,
  }));
  if (assignments.some((assignment) => next.assignments.some((row) => row.id === assignment.id)))
    throw Error("Una propuesta ya creó una asignación y requiere revisión de estado.");
  return {
    ...next,
    assignments: [...next.assignments, ...assignments],
    habitualTaskProposals: next.habitualTaskProposals!.map((proposal) => selected.some((row) => row.id === proposal.id) ? {
      ...proposal,
      status: "approved",
      managerNote: undefined,
      templateId: template!.id,
      templateVersion,
      updatedAt: now,
      history: [...proposal.history, { id: makeId(), by: actor.id, action: "approved", note: `Asignada al estándar «${template!.title}».`, at: now, templateId: template!.id, templateVersion }],
    } : proposal),
  };
}

export function pendingHabitualTaskProposals(state: State, actor: Profile) {
  return actor.active && actor.role === "jefe"
    ? (state.habitualTaskProposals || []).filter((row) => row.status === "pending" && canSee(actor, row.ownerId, state.profiles))
    : [];
}

export function proposalsForProfile(state: State, actor: Profile) {
  return actor.active ? (state.habitualTaskProposals || []).filter((row) => row.ownerId === actor.id) : [];
}

export function proposalStatusLabel(proposal: HabitualTaskProposal) {
  if (proposal.status === "pending") return "Pendiente de revisión";
  if (proposal.status === "changes_requested") return "Necesita cambios";
  return "Incorporada al catálogo";
}
