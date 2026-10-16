import {
  canSee,
  currentMonth,
  dateART,
  id,
  isResponsible,
  metricsForProfile,
  taskReadiness,
  isCompanyClosed,
  type Activity,
  type Closure,
  type Metrics,
  type Profile,
  type State,
  type Task,
} from "./model";
import { canWork, coverageFor } from "./workforce";
import type { TimeSession } from "./workforce";
import { generatePeriodReport, type CoverageReportContribution, type OperationalReportSummary, type PeriodReport } from "./reports";
import { actorElapsedSeconds } from "./workforce";
import { validDate } from "./schedule";
import { calendarEventFieldsError } from "./calendar-validation";

export interface OperationalRate {
  id: string;
  templateId: string | null;
  taskId: string | null;
  companyId: string;
  effectiveOn: string;
  unitWeight: number;
  version: number;
  createdAt: string;
  createdBy: string;
}

export interface OperationalAssessment {
  id: string;
  taskId: string;
  profileId: string;
  companyId: string;
  month: string;
  quality: number;
  order: number;
  timeliness: number;
  note: string;
  evaluatedAt: string;
  evaluatedBy: string;
}

export type CalendarEventKind = "balance_close" | "audit" | "important" | "custom";
export interface LabCalendarEvent {
  id: string;
  revision: number;
  authorId: string;
  companyId: string | null;
  kind: CalendarEventKind;
  title: string;
  description: string;
  startOn: string;
  endOn: string;
  recipientIds: string[];
  linkedTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
}
export interface CalendarNotice {
  id: string;
  eventId: string;
  revision: number;
  recipientId: string;
  actorId: string;
  kind: "created" | "changed" | "cancelled";
  createdAt: string;
  readAt: string | null;
}

export interface TaskEvidence {
  id: string;
  taskId: string;
  activityId: string | null;
  profileId: string;
  /** Completion timestamp when the attachment documents a specific task finish. */
  completionAt?: string | null;
  name: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  size: number;
  sha256: string;
  createdAt: string;
}

export interface CompanyClosure extends Omit<Closure, "id" | "ownerId" | "month" | "activity"> {
  id: string;
  ownerId: string;
  companyId: string;
  month: string;
  activity: Activity[];
  /** Time and movements made by this person on covered work owned by someone else. */
  coveredActivity: Activity[];
  /** Immutable execution slices; legacy v1 closures have no reconstructible coverage snapshot. */
  coveredContributions?: CoveredContributionSnapshot[];
  schemaVersion: 1 | 2;
}
export interface CoveredContributionSnapshot {
  version: 1;
  taskSnapshot: Task;
  executorId: string;
  originalOwnerId: string;
  companyId: string;
  month: string;
  sessions: TimeSession[];
  activity: Activity[];
  completionAt: string | null;
}
export interface CloseUnit { ownerId: string; companyId: string; month: string; }
export interface CloseBlock { unit: CloseUnit; reason: string; }
export interface CloseBatchResult {
  state: State;
  closed: CloseUnit[];
  blocked: CloseBlock[];
}

export interface OperationalLoad {
  quantity: number;
  weightedLoad: number | null;
  unweightedQuantity: number;
  recordedSeconds: number;
  activities: number;
}

function contributionDateAllowed(absence: NonNullable<State["absences"]>[number], instant: string, month: string) {
  const day = dateART(instant);
  return day.slice(0, 7) === month && absence.from <= day && day <= absence.to &&
    (!absence.cancelledAt || Date.parse(instant) <= Date.parse(absence.cancelledAt));
}

function coveredContributionFor(state: State, task: Task, executorId: string, month: string): CoveredContributionSnapshot | null {
  if (task.month !== month || task.ownerId === executorId || isResponsible(task, executorId)) return null;
  const eligibleAbsences = (state.absences || []).filter((absence) => absence.ownerId === task.ownerId &&
    absence.replacementId === executorId && absence.from <= (task.scheduledOn || task.due) && (task.scheduledOn || task.due) <= absence.to &&
    ((absence.taskIds || []).includes(task.id) || (!!task.assignmentId && (absence.assignmentIds || []).includes(task.assignmentId))));
  if (!eligibleAbsences.length) return null;
  const sessions = (task.sessions || []).filter((session) => session.actorId === executorId && !!session.end &&
    eligibleAbsences.some((absence) => contributionDateAllowed(absence, session.start, month)));
  const activity = state.activity.filter((row) => row.taskId === task.id && row.actorId === executorId && row.date.startsWith(month) &&
    eligibleAbsences.some((absence) => absence.from <= row.date && row.date <= absence.to && contributionDateAllowed(absence, row.createdAt, month)));
  const completionAt = task.completedBy === executorId && task.completedAt &&
    eligibleAbsences.some((absence) => contributionDateAllowed(absence, task.completedAt!, month)) ? task.completedAt : null;
  if (!sessions.length && !activity.length && !completionAt) return null;
  const taskEvidenceIds = (state.taskEvidence || []).filter((evidence) => evidence.taskId === task.id && evidence.profileId === executorId && evidence.activityId === null).map((evidence) => evidence.id);
  const activityEvidence = new Map(activity.map((row) => [row.id, (row.evidenceIds || []).filter((evidenceId) =>
    (state.taskEvidence || []).some((evidence) => evidence.id === evidenceId && evidence.profileId === executorId && evidence.activityId === row.id))]));
  const taskSnapshot: Task = {
    ...structuredClone(task),
    sessions: structuredClone(sessions),
    evidenceIds: taskEvidenceIds,
    checklist: [],
    startedAt: sessions[0]?.start || null,
    status: completionAt ? "Completada" : sessions.length ? "En curso" : "Pendiente",
    completedAt: completionAt,
    ...(completionAt ? { completedBy: executorId } : { completedBy: undefined }),
  };
  return {
    version: 1, taskSnapshot, executorId, originalOwnerId: task.ownerId, companyId: task.companyId, month,
    sessions: structuredClone(sessions),
    activity: structuredClone(activity.map((row) => ({ ...row, evidenceIds: activityEvidence.get(row.id) || [] }))),
    completionAt,
  };
}

function coveredContributionsForUnit(state: State, unit: CloseUnit): CoveredContributionSnapshot[] {
  return state.tasks.flatMap((task) => {
    if (task.companyId !== unit.companyId || task.month !== unit.month) return [];
    const contribution = coveredContributionFor(state, task, unit.ownerId, unit.month);
    return contribution ? [contribution] : [];
  });
}

const isoMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const validRate = (value: number) => Number.isFinite(value) && value > 0 && value <= 1_000_000;

export function saveOperationalRate(
  state: State,
  actorId: string,
  input: Omit<OperationalRate, "id" | "version" | "createdAt" | "createdBy">,
  now = new Date().toISOString(),
): State {
  const actor = state.profiles.find((profile) => profile.id === actorId);
  if (!actor?.active || actor.role !== "jefe") throw Error("Sólo jefatura puede parametrizar la carga operativa.");
  if (!!input.templateId === !!input.taskId) throw Error("Elegí una actividad del catálogo o una tarea puntual, no ambas.");
  if (!state.companies.some((company) => company.id === input.companyId) || !validDate(input.effectiveOn) || !validRate(input.unitWeight))
    throw Error("Revisá la empresa, la vigencia y el peso positivo por movimiento.");
  if (input.templateId && !state.templates.some((template) => template.id === input.templateId && template.kind === "operativa"))
    throw Error("La actividad elegida ya no es operativa.");
  if (input.taskId && !state.tasks.some((task) => task.id === input.taskId && task.kind === "operativa" && task.companyId === input.companyId))
    throw Error("La tarea operativa no existe en esa empresa.");
  const current = state.operationalRates || [];
  const version = current.filter((rate) => rate.templateId === input.templateId && rate.taskId === input.taskId && rate.companyId === input.companyId)
    .reduce((highest, rate) => Math.max(highest, rate.version), 0) + 1;
  const rate: OperationalRate = { ...input, id: id(), version, createdAt: now, createdBy: actorId };
  return { ...state, operationalRates: [...current, rate] };
}

export function effectiveOperationalRate(state: State, task: Task, on: string): OperationalRate | undefined {
  const templateId = task.templateId || state.assignments.find((assignment) => assignment.id === task.assignmentId)?.templateId;
  const applicable = (state.operationalRates || []).filter((rate) => rate.companyId === task.companyId && rate.effectiveOn <= on &&
    (rate.taskId === task.id || (!rate.taskId && !!templateId && rate.templateId === templateId)));
  const specific = applicable.filter((rate) => rate.taskId === task.id);
  return (specific.length ? specific : applicable)
    .sort((a, b) => b.effectiveOn.localeCompare(a.effectiveOn) || b.version - a.version || b.createdAt.localeCompare(a.createdAt))[0];
}

export function snapshotOperationalRate(state: State, task: Task, on: string) {
  const rate = effectiveOperationalRate(state, task, on);
  return rate ? { operationalRateId: rate.id, operationalUnitWeight: rate.unitWeight } : { operationalRateId: null, operationalUnitWeight: null };
}

export function operationalLoad(state: State, taskIds: string[], actorId?: string, now = new Date().toISOString()): OperationalLoad {
  const tasks = new Map(state.tasks.filter((task) => taskIds.includes(task.id)).map((task) => [task.id, task]));
  const rows = state.activity.filter((activity) => tasks.has(activity.taskId) && (!actorId || activity.actorId === actorId));
  let quantity = 0, weightedLoad = 0, unweightedQuantity = 0;
  const units = new Set<string>();
  for (const activity of rows) {
    quantity += activity.qty;
    const task = tasks.get(activity.taskId)!;
    units.add(task.unit || "movimientos");
    if (activity.operationalUnitWeight == null) unweightedQuantity += activity.qty;
    else weightedLoad += activity.qty * activity.operationalUnitWeight;
  }
  const periodEnd = (month: string) => {
    const [year, monthNumber] = month.split("-").map(Number);
    return `${month}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, "0")}`;
  };
  const allTasksConfigured = [...tasks.values()].every((task) => !!effectiveOperationalRate(state, task, periodEnd(task.month)));
  const allRated = unweightedQuantity === 0 && allTasksConfigured;
  const seconds = [...tasks.values()].reduce((sum, task) => sum + (task.sessions || [])
    .filter((session) => !actorId || session.actorId === actorId)
    .reduce((part, session) => part + Math.max(0, (Date.parse(session.end || now) - Date.parse(session.start)) / 1000), 0), 0);
  return { quantity, weightedLoad: allRated ? Math.round(weightedLoad * 100) / 100 : null,
    unweightedQuantity, recordedSeconds: seconds, activities: rows.length };
}

export function saveOperationalAssessment(
  state: State,
  actorId: string,
  input: Pick<OperationalAssessment, "taskId" | "quality" | "order" | "timeliness" | "note">,
  now = new Date().toISOString(),
): State {
  const actor = state.profiles.find((profile) => profile.id === actorId);
  const task = state.tasks.find((row) => row.id === input.taskId);
  if (!actor?.active || actor.role !== "jefe" || !task || task.kind !== "operativa" || task.responsibility)
    throw Error("La evaluación corresponde a jefatura y a una operativa individual.");
  if (![input.quality, input.order, input.timeliness].every((value) => Number.isInteger(value) && value >= 0 && value <= 100))
    throw Error("Cada criterio debe estar entre 0 y 100.");
  const note = input.note.trim();
  if (note.length < 5 || note.length > 1000) throw Error("Agregá una observación de 5 a 1.000 caracteres.");
  if (isLabCompanyClosed(state, task.ownerId, task.companyId, task.month)) throw Error("La unidad empresa/persona ya está cerrada.");
  const existing = (state.operationalAssessments || []).find((row) => row.taskId === task.id);
  const assessment: OperationalAssessment = { id: existing?.id || id(), taskId: task.id, profileId: task.ownerId,
    companyId: task.companyId, month: task.month, quality: input.quality, order: input.order,
    timeliness: input.timeliness, note, evaluatedAt: now, evaluatedBy: actorId };
  return { ...state, operationalAssessments: [...(state.operationalAssessments || []).filter((row) => row.taskId !== task.id), assessment] };
}

export function qualitySummary(state: State, profileId: string, month: string, companyId?: string) {
  const rows = (state.operationalAssessments || []).filter((row) => row.profileId === profileId && row.month === month && (!companyId || row.companyId === companyId));
  if (!rows.length) return { quality: null, order: null, timeliness: null, evaluated: 0 };
  const average = (key: "quality" | "order" | "timeliness") => Math.round(rows.reduce((sum, row) => sum + row[key], 0) / rows.length);
  return { quality: average("quality"), order: average("order"), timeliness: average("timeliness"), evaluated: rows.length };
}

export function setCommercialTracking(state: State, taskId: string, enabled: boolean, actorId: string): State {
  const actor = state.profiles.find((profile) => profile.id === actorId), task = state.tasks.find((row) => row.id === taskId);
  if (!actor?.active || actor.role !== "jefe" || !task || task.kind !== "resultado" || task.responsibility)
    throw Error("Sólo jefatura puede parametrizar el seguimiento comercial de un entregable individual.");
  if (isLabCompanyClosed(state, task.ownerId, task.companyId, task.month)) throw Error("El período está cerrado.");
  const commercialProgress = enabled
    ? task.commercialProgress?.month === task.month ? task.commercialProgress : { month: task.month, throughDay: 0, updatedAt: new Date().toISOString(), updatedBy: actorId }
    : null;
  return { ...state, tasks: state.tasks.map((row) => row.id === taskId ? { ...row, commercialTrackingEnabled: enabled, commercialProgress } : row) };
}

export function updateCommercialProgress(state: State, taskId: string, throughDay: number, actorId: string, now = new Date().toISOString()): State {
  const actor = state.profiles.find((profile) => profile.id === actorId), task = state.tasks.find((row) => row.id === taskId);
  if (!actor?.active || !task || !task.commercialTrackingEnabled || task.kind !== "resultado" || task.responsibility ||
      !canExecuteLab(state, actor, task, dateART(now)))
    throw Error("Sólo la persona responsable o su reemplazo vigente pueden actualizar esta conciliación.");
  if (!Number.isInteger(throughDay) || throughDay < 0 || throughDay > 30) throw Error("El día comercial debe estar entre 0 y 30.");
  if (task.status === "Completada") throw Error("La conciliación ya está completa y no admite cambios de período.");
  if (isLabCompanyClosed(state, task.ownerId, task.companyId, task.month)) throw Error("El período está cerrado.");
  return { ...state, tasks: state.tasks.map((row) => row.id === taskId ? { ...row,
    commercialProgress: { month: row.month, throughDay, updatedAt: now, updatedBy: actorId } } : row) };
}

export function updateTaskReadiness(state: State, taskId: string, input: { dependsOnTaskIds: string[]; availableFrom: string | null }, actorId: string): State {
  const actor = state.profiles.find((profile) => profile.id === actorId), task = state.tasks.find((row) => row.id === taskId);
  if (!actor?.active || actor.role !== "jefe" || !task || task.kind !== "resultado" || task.responsibility)
    throw Error("Sólo jefatura puede configurar dependencias de un entregable individual.");
  if (isLabCompanyClosed(state, task.ownerId, task.companyId, task.month) || task.status === "Completada") throw Error("No se pueden cambiar las dependencias de una tarea cerrada o completada.");
  if (new Set(input.dependsOnTaskIds).size !== input.dependsOnTaskIds.length || input.dependsOnTaskIds.includes(task.id)) throw Error("La lista de dependencias contiene duplicados o la propia tarea.");
  if (input.availableFrom && (!validDate(input.availableFrom) || input.availableFrom.slice(0, 7) !== task.month)) throw Error("La disponibilidad debe ser una fecha válida del período de la tarea.");
  for (const depId of input.dependsOnTaskIds) {
    const dependency = state.tasks.find((row) => row.id === depId);
    if (!dependency || dependency.kind !== "resultado" || dependency.companyId !== task.companyId || dependency.month !== task.month || dependency.responsibility)
      throw Error("Cada dependencia debe ser un entregable individual de la misma empresa y período.");
  }
  const nextTasks = state.tasks.map((row) => row.id === taskId ? { ...row, dependsOnTaskIds: [...input.dependsOnTaskIds], availableFrom: input.availableFrom } : row);
  const graph = new Map(nextTasks.map((row) => [row.id, row.dependsOnTaskIds || []]));
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string): boolean => { if (visiting.has(id)) return false; if (visited.has(id)) return true; visiting.add(id); for (const dep of graph.get(id) || []) if (!visit(dep)) return false; visiting.delete(id); visited.add(id); return true; };
  if (!visit(taskId)) throw Error("La dependencia formaría un ciclo.");
  return { ...state, tasks: nextTasks };
}

export interface SuggestedRouteFilters {
  month?: string;
  companyId?: string;
  teamId?: string;
  sector?: string;
}

export function suggestedRoute(state: State, profileId: string, on = dateART(), filters: SuggestedRouteFilters = {}, viewer?: Profile): Array<{ task: Task; ready: boolean; reason: string }> {
  const profile = state.profiles.find((row) => row.id === profileId);
  if (!profile?.active) return [];
  const readinessViewer = viewer || profile;
  return state.tasks.filter((task) => task.kind === "resultado" && task.status !== "Completada" && !isLabTaskLocked(state, task) && isResponsible(task, profileId) && canWork(state, profile, task) &&
    (!filters.month || task.month === filters.month) && (!filters.companyId || task.companyId === filters.companyId) &&
    (!filters.teamId || task.teamId === filters.teamId) && (!filters.sector || task.sector === filters.sector))
    .map((task) => ({ task, ...taskReadiness(state, task, on, readinessViewer) }))
    .sort((a, b) => Number(b.ready) - Number(a.ready) || (a.task.due || "9999").localeCompare(b.task.due || "9999") ||
      ["Alta", "Media", "Baja"].indexOf(a.task.priority) - ["Alta", "Media", "Baja"].indexOf(b.task.priority) ||
      b.task.weight - a.task.weight || (a.task.scheduledOn || "9999").localeCompare(b.task.scheduledOn || "9999") || a.task.id.localeCompare(b.task.id));
}

function supervisors(state: State, actor: Profile) {
  const out: string[] = [];
  let cursor = actor;
  const visited = new Set<string>([actor.id]);
  while (cursor.managerId) {
    if (visited.size >= state.profiles.length || visited.has(cursor.managerId))
      throw Error("La jerarquía de responsables no es válida. Corregila antes de administrar fechas compartidas.");
    const next = state.profiles.find((row) => row.id === cursor.managerId);
    if (!next) throw Error("El superior indicado ya no existe. Corregí la estructura antes de administrar fechas compartidas.");
    visited.add(next.id);
    out.push(next.id);
    cursor = next;
  }
  if (actor.role !== "jefe") {
    const boss = state.profiles.find((row) => row.active && row.role === "jefe");
    if (boss && !out.includes(boss.id)) out.push(boss.id);
  }
  return out.filter((pid) => state.profiles.some((row) => row.id === pid && row.active));
}

export function calendarRecipients(state: State, actor: Profile, companyId: string | null, all = false, selected: string[] = []) {
  const sameScope = (profile: Profile) => profile.role === "jefe" || !companyId || profile.companyIds.includes(companyId);
  const supervisorIds = supervisors(state, actor);
  const allowed = state.profiles.filter((profile) => profile.active && sameScope(profile) &&
    (profile.id === actor.id || supervisorIds.includes(profile.id) || canSee(actor, profile.id, state.profiles) ||
      (actor.role === "empleado" && profile.role === "empleado" && profile.teamId === actor.teamId)));
  const ids = new Set<string>([actor.id, ...supervisorIds.filter((id) => allowed.some((row) => row.id === id)), ...(all ? allowed.map((row) => row.id) : selected.filter((pid) => allowed.some((row) => row.id === pid)))]);
  return [...ids].filter((pid) => allowed.some((profile) => profile.id === pid));
}

export function createCalendarEvent(state: State, actorId: string, input: Pick<LabCalendarEvent, "companyId" | "kind" | "title" | "description" | "startOn" | "endOn" | "recipientIds" | "linkedTaskId">, now = new Date().toISOString()): State {
  const actor = state.profiles.find((profile) => profile.id === actorId);
  if (!actor?.active || !["jefe", "encargado", "empleado"].includes(actor.role)) throw Error("El perfil no puede crear fechas en el calendario.");
  const invalid = calendarEventFieldsError(input, new Set(state.companies.map((company) => company.id)), new Map(state.tasks.map((task) => [task.id, task])));
  if (invalid) throw Error(invalid);
  const title = input.title.trim(), description = input.description.trim();
  if (input.companyId && !actor.companyIds.includes(input.companyId) && actor.role !== "jefe") throw Error("La empresa está fuera de tu ámbito.");
  const recipientIds = calendarRecipients(state, actor, input.companyId, false, input.recipientIds);
  if (input.linkedTaskId) {
    const task = state.tasks.find((row) => row.id === input.linkedTaskId);
    if (!task || !calendarCanAccessTask(state, actor, task) || task.companyId !== input.companyId) throw Error("La tarea vinculada está fuera de tu ámbito.");
  }
  const event: LabCalendarEvent = { ...input, id: id(), revision: 1, authorId: actorId, title, description, recipientIds,
    createdAt: now, updatedAt: now, cancelledAt: null, cancelledBy: null };
  const notices = recipientIds.filter((pid) => pid !== actorId).map((recipientId) => ({ id: id(), eventId: event.id, revision: event.revision, recipientId, actorId, kind: "created" as const, createdAt: now, readAt: null }));
  return { ...state, calendarEvents: [...(state.calendarEvents || []), event], calendarNotices: [...(state.calendarNotices || []), ...notices] };
}

export function calendarCanAccessTask(state: State, actor: Profile, task: Task) {
  if (!actor.active || actor.id === "admin") return false;
  if (actor.role !== "jefe" && !actor.companyIds.includes(task.companyId)) return false;
  if (isResponsible(task, actor.id) || coverageFor(state, task)?.replacementId === actor.id) return true;
  if (canSee(actor, task.ownerId, state.profiles)) return true;
  return !!task.responsibility?.members.some((member) => canSee(actor, member.profileId, state.profiles));
}

export function visibleCalendarEvents(state: State, actor: Profile, month: string) {
  if (!actor.active) return [];
  return (state.calendarEvents || []).filter((event) => event.startOn.slice(0, 7) <= month && event.endOn.slice(0, 7) >= month &&
      canViewCalendarEvent(state, actor, event));
}

/** Current authorization is shared by event details and linked notifications. */
export function canViewCalendarEvent(state: State, actor: Profile, event: LabCalendarEvent) {
  const author = state.profiles.find((profile) => profile.id === event.authorId);
  return actor.active && actor.id !== "admin" &&
    !!author && calendarRecipients(state, author, event.companyId, false, event.recipientIds).includes(actor.id) &&
    (!event.companyId || state.companies.some((company) => company.id === event.companyId) && (actor.role === "jefe" || actor.companyIds.includes(event.companyId))) &&
    (event.recipientIds.includes(actor.id) || isEventManager(state, actor, event));
}

export function changeCalendarEvent(state: State, eventId: string, actorId: string, change: Partial<Pick<LabCalendarEvent, "title" | "description" | "startOn" | "endOn" | "recipientIds">>, cancel = false, now = new Date().toISOString()): State {
  const actor = state.profiles.find((profile) => profile.id === actorId), event = state.calendarEvents?.find((row) => row.id === eventId);
  if (!actor?.active || !event || event.cancelledAt || !isEventManager(state, actor, event)) throw Error("Sólo el autor o su superior autorizado puede administrar esta fecha.");
  const nextTitle = change.title?.trim() ?? event.title, startOn = change.startOn ?? event.startOn, endOn = change.endOn ?? event.endOn;
  const nextDescription = change.description?.trim() ?? event.description;
  const invalid = calendarEventFieldsError({ ...event, title: nextTitle, description: nextDescription, startOn, endOn },
    new Set(state.companies.map((company) => company.id)), new Map(state.tasks.map((task) => [task.id, task])));
  if (invalid) throw Error(invalid);
  if (event.linkedTaskId) {
    const linkedTask = state.tasks.find((task) => task.id === event.linkedTaskId);
    if (!linkedTask || !calendarCanAccessTask(state, actor, linkedTask)) throw Error("La tarea vinculada dejó de estar en tu ámbito.");
  }
  const revision = event.revision + 1, cancelledAt = cancel ? now : null;
  const author = state.profiles.find((row) => row.id === event.authorId)!;
  const currentRecipients = calendarRecipients(state, author, event.companyId, false, change.recipientIds || event.recipientIds);
  // Keep the author as a historical reference even if their account was
  // deactivated or moved out of scope. canViewCalendarEvent still checks
  // current authorization before exposing the event.
  const nextEvent = { ...event, ...change, title: nextTitle, description: nextDescription, startOn, endOn, revision, updatedAt: now,
    recipientIds: [...new Set([...currentRecipients, event.authorId])],
    cancelledAt, cancelledBy: cancel ? actorId : null };
  const kind = cancel ? "cancelled" as const : "changed" as const;
  const notifiedRecipients = new Set([...event.recipientIds, ...nextEvent.recipientIds]);
  const notices = [...notifiedRecipients].filter((pid) => pid !== actorId && state.profiles.some((profile) => profile.id === pid && profile.active))
    .map((recipientId) => ({ id: id(), eventId, revision, recipientId, actorId, kind, createdAt: now, readAt: null }));
  return { ...state, calendarEvents: (state.calendarEvents || []).map((row) => row.id === eventId ? nextEvent : row), calendarNotices: [...(state.calendarNotices || []), ...notices] };
}

export function isLabCompanyClosed(state: State, ownerId: string, companyId: string, month: string) {
  return isCompanyClosed(state, ownerId, companyId, month);
}

export function updateTaskWeight(state: State, taskId: string, weight: number, actorId: string): State {
  const actor = state.profiles.find((profile) => profile.id === actorId);
  const task = state.tasks.find((row) => row.id === taskId);
  if (!actor?.active || actor.role !== "jefe" || !task)
    throw Error("Sólo jefatura puede ajustar el peso de una tarea.");
  if (!Number.isFinite(weight) || weight <= 0 || weight > 100)
    throw Error("El peso debe ser un número mayor que 0 y no superar 100.");
  if (isLabCompanyClosed(state, task.ownerId, task.companyId, task.month))
    throw Error("La unidad empresa/persona está cerrada.");
  if (task.status !== "Pendiente" || (task.sessions || []).length > 0)
    throw Error("El peso sólo se puede ajustar antes de iniciar la tarea.");
  return { ...state, tasks: state.tasks.map((row) => row.id === taskId ? { ...row, weight } : row) };
}

/** A supervisor can move one untouched occurrence without editing its recurring rule. */
export function canRescheduleLabTask(state: State, actor: Profile, task: Task) {
  const owner = state.profiles.find((profile) => profile.id === task.ownerId);
  return actor.active && (actor.role === "jefe" || actor.role === "encargado") &&
    !!owner?.active && canSee(actor, task.ownerId, state.profiles) &&
    (actor.role === "jefe" || actor.companyIds.includes(task.companyId)) &&
    !task.responsibility && task.status === "Pendiente" && !task.startedAt &&
    !(task.sessions || []).length && !state.activity.some((row) => row.taskId === task.id) &&
    !isLabCompanyClosed(state, task.ownerId, task.companyId, task.month);
}

export function rescheduleLabTask(state: State, taskId: string, scheduledOn: string, reason: string, actorId: string): State {
  const actor = state.profiles.find((profile) => profile.id === actorId);
  const task = state.tasks.find((row) => row.id === taskId);
  if (!actor || !task || !canRescheduleLabTask(state, actor, task))
    throw Error("Sólo jefatura o el encargado autorizado pueden reprogramar una tarea individual pendiente y sin actividad.");
  if (!validDate(scheduledOn) || scheduledOn.slice(0, 7) !== task.month)
    throw Error("La fecha programada debe ser válida y pertenecer al período de la tarea.");
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 5 || trimmedReason.length > 500)
    throw Error("Indicá un motivo de entre 5 y 500 caracteres.");
  return { ...state, tasks: state.tasks.map((row) => row.id === taskId ? { ...row, scheduledOn } : row) };
}

export function isLabTaskLocked(state: State, task: Task) {
  const owners = task.responsibility?.members.map((member) => member.profileId) || [task.ownerId];
  return owners.some((ownerId) => isLabCompanyClosed(state, ownerId, task.companyId, task.month));
}

export function companyCloseUnits(state: State, month: string, selection: { scope: "all" | "team" | "company" | "person"; id?: string }): CloseUnit[] {
  const candidates = state.profiles.filter((profile) => profile.active && profile.role !== "jefe" &&
    (selection.scope === "all" || selection.scope === "person" && profile.id === selection.id ||
      selection.scope === "team" && profile.teamId === selection.id || selection.scope === "company" && profile.companyIds.includes(selection.id || "")));
  const units = candidates.flatMap((profile) => [...new Set([
    ...state.tasks.filter((task) => task.month === month && isResponsible(task, profile.id) &&
      (selection.scope !== "company" || task.companyId === selection.id)).map((task) => task.companyId),
    ...state.tasks.filter((task) => task.month === month && (selection.scope !== "company" || task.companyId === selection.id) &&
      !!coveredContributionFor(state, task, profile.id, month)).map((task) => task.companyId),
  ])]
    .map((companyId) => ({ ownerId: profile.id, companyId, month })));
  return companyCloseGroups(state, units).flat();
}

const closeUnitKey = (unit: CloseUnit) => `${unit.ownerId}\u001f${unit.companyId}\u001f${unit.month}`;

function connectedCloseUnitGroups(state: State, units: CloseUnit[]): CloseUnit[][] {
  const pending = new Map(units.map((unit) => [closeUnitKey(unit), unit]));
  const groups: CloseUnit[][] = [];
  while (pending.size) {
    const first = pending.values().next().value as CloseUnit;
    const queue = [first];
    const group = new Map<string, CloseUnit>();
    while (queue.length) {
      const unit = queue.pop()!;
      const key = closeUnitKey(unit);
      if (group.has(key)) continue;
      group.set(key, unit);
      pending.delete(key);
      const sharedTasks = state.tasks.filter((task) => task.month === unit.month && task.companyId === unit.companyId &&
        isResponsible(task, unit.ownerId) && task.responsibility);
      for (const task of sharedTasks) for (const member of task.responsibility!.members) {
        const linked = { ownerId: member.profileId, companyId: unit.companyId, month: unit.month };
        if (!group.has(closeUnitKey(linked))) queue.push(linked);
      }
    }
    groups.push([...group.values()].sort((a, b) => a.ownerId.localeCompare(b.ownerId) || a.companyId.localeCompare(b.companyId)));
  }
  return groups;
}

export function companyCloseGroups(state: State, units: CloseUnit[]): CloseUnit[][] {
  return connectedCloseUnitGroups(state, units);
}

export function companyUnitCloseBlocker(state: State, unit: CloseUnit, actorId: string, at = new Date().toISOString()): string | null {
  const actor = state.profiles.find((row) => row.id === actorId), profile = state.profiles.find((row) => row.id === unit.ownerId);
  if (!actor?.active || actor.role !== "jefe" || !profile?.active || !canSee(actor, profile.id, state.profiles)) return "El cierre requiere jefatura y un perfil activo autorizado.";
  if (!isoMonth(unit.month) || unit.month > dateART(at).slice(0, 7)) return "No se puede cerrar un período futuro o inválido.";
  if (isLabCompanyClosed(state, unit.ownerId, unit.companyId, unit.month)) return "Esta persona y empresa ya tienen el mes cerrado.";
  const tasks = state.tasks.filter((task) => task.month === unit.month && task.companyId === unit.companyId && isResponsible(task, unit.ownerId));
  const coveredContributions = coveredContributionsForUnit(state, unit);
  if (!tasks.length && !coveredContributions.length) return "No hay tareas ni trabajo de cobertura para cerrar en esta empresa.";
  const hasActiveClock = state.tasks.some((task) => task.month === unit.month && task.companyId === unit.companyId &&
    task.sessions?.some((session) => !session.end && (isResponsible(task, unit.ownerId) || session.actorId === unit.ownerId)));
  if (hasActiveClock) return "Hay cronómetros activos o contribuciones de cobertura en esta unidad.";
  if (tasks.some((task) => task.responsibility && (task.kind !== "resultado" || task.status !== "Completada"))) return "Una tarea conjunta requiere revisión individual antes de cerrar.";
  return null;
}

function closeUnit(state: State, unit: CloseUnit, actorId: string, note: string, at: string): CompanyClosure {
  if (!note.trim() || note.trim().length > 1000) throw Error("La observación de cierre es obligatoria y admite hasta 1.000 caracteres.");
  const blocker = companyUnitCloseBlocker(state, unit, actorId, at);
  if (blocker) throw Error(blocker);
  const tasks = state.tasks.filter((task) => task.month === unit.month && task.companyId === unit.companyId && isResponsible(task, unit.ownerId));
  const taskIds = new Set(tasks.map((task) => task.id));
  const activity = state.activity.filter((row) => taskIds.has(row.taskId) && row.date.startsWith(unit.month));
  const coveredContributions = coveredContributionsForUnit(state, unit);
  const coveredActivity = coveredContributions.flatMap((contribution) => contribution.activity)
    .filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index);
  const deliveryTasks = tasks.filter((task) => task.kind === "resultado");
  const metrics = metricsForProfile(deliveryTasks, activity, unit.ownerId, dateART(at), at);
  const snapshot: Closure = { id: id(), ownerId: unit.ownerId, month: unit.month, at, by: actorId, note: note.trim(), metrics,
    tasks: structuredClone(tasks), activity: structuredClone(activity), taskTransfers: structuredClone((state.taskTransfers || []).filter((transfer) => taskIds.has(transfer.taskId))) };
  const reportState = { ...state, tasks: state.tasks.map((task) => taskIds.has(task.id) && task.kind === "operativa" ? { ...task, target: 0 } : task) };
  snapshot.report = laboratoryPeriodReport(reportState, snapshot, coveredContributions);
  return { ...snapshot, companyId: unit.companyId, coveredActivity: structuredClone(coveredActivity), coveredContributions, schemaVersion: 2 };
}

function operationalReportSummary(state: State, tasks: Task[], logs: Activity[], profileId: string, at: string, actorOnly = false): OperationalReportSummary {
  const operations = tasks.filter((task) => task.kind === "operativa");
  const taskById = new Map(operations.map((task) => [task.id, task]));
  const rows = logs.filter((activity) => taskById.has(activity.taskId) && (!actorOnly || activity.actorId === profileId));
  const quantityByUnit = new Map<string, number>();
  let weighted = 0, unweightedQuantity = 0;
  for (const activity of rows) {
    const task = taskById.get(activity.taskId)!;
    const unit = task.unit || "movimientos";
    quantityByUnit.set(unit, (quantityByUnit.get(unit) || 0) + activity.qty);
    if (activity.operationalUnitWeight == null) unweightedQuantity += activity.qty;
    else weighted += activity.qty * activity.operationalUnitWeight;
  }
  const endOfMonth = (month: string) => {
    const [year, monthNumber] = month.split("-").map(Number);
    return `${month}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, "0")}`;
  };
  const configured = operations.length > 0 && operations.every((task) => !!effectiveOperationalRate(state, task, endOfMonth(task.month)));
  const rated = unweightedQuantity === 0 && configured;
  const evaluations = actorOnly ? [] : (state.operationalAssessments || []).filter((assessment) => taskById.has(assessment.taskId) && assessment.profileId === profileId);
  const average = (key: "quality" | "order" | "timeliness") => evaluations.length ? Math.round(evaluations.reduce((sum, row) => sum + row[key], 0) / evaluations.length) : null;
  const recordedSeconds = operations.reduce((sum, task) => sum + actorElapsedSeconds(task, profileId, at), 0);
  return {
    movementCount: rows.length,
    quantityByUnit: [...quantityByUnit.entries()].sort(([a], [b]) => a.localeCompare(b, "es")).map(([unit, quantity]) => ({ unit, quantity })),
    weightedLoad: rated ? Math.round(weighted * 100) / 100 : null,
    unweightedQuantity,
    recordedSeconds,
    quality: average("quality"), order: average("order"), timeliness: average("timeliness"), evaluations: evaluations.length,
  };
}

function laboratoryPeriodReport(state: State, closure: Closure, coveredContributions: CoveredContributionSnapshot[]): PeriodReport {
  const base = generatePeriodReport(state, closure);
  const groups = new Map<string, Task[]>();
  for (const task of closure.tasks.filter((row) => row.kind === "operativa")) {
    const templateId = task.templateId ?? state.assignments.find((assignment) => assignment.id === task.assignmentId)?.templateId ?? null;
    const key = JSON.stringify([task.companyId, templateId || task.id, task.kind, task.unit, task.title]);
    groups.set(key, [...(groups.get(key) || []), task]);
  }
  const reportGroups = base.groups.map((group) => {
    const tasks = groups.get(group.key);
    if (!tasks) return group;
    return {
      ...group,
      metrics: {
        ...group.metrics,
        assigned: 0,
        done: 0,
        points: 0,
        earned: 0,
        weighted: null,
        onTime: null,
        late: 0,
        blocked: 0,
        operationalTarget: 0,
        timeliness: undefined,
      },
      contributions: undefined,
      operationalSummary: operationalReportSummary(state, tasks, closure.activity, closure.ownerId, closure.at),
    };
  });
  const operational = operationalReportSummary(state, closure.tasks, closure.activity, closure.ownerId, closure.at);
  const coveredTasks = coveredContributions.map((contribution) => contribution.taskSnapshot);
  const coveredActivity = coveredContributions.flatMap((contribution) => contribution.activity);
  const coveredLoad = operationalReportSummary(state, coveredTasks, coveredActivity, closure.ownerId, closure.at, true);
  const covered: OperationalReportSummary = {
    ...coveredLoad,
    recordedSeconds: coveredContributions.reduce((sum, contribution) => sum + contribution.sessions.reduce((seconds, session) =>
      seconds + Math.max(0, (Date.parse(session.end || closure.at) - Date.parse(session.start)) / 1000), 0), 0),
  };
  const coverageReports: CoverageReportContribution[] = coveredContributions.map((contribution) => {
    const task = contribution.taskSnapshot;
    return {
      taskId: task.id, title: task.title, companyId: contribution.companyId,
      company: state.companies.find((company) => company.id === contribution.companyId)?.name || contribution.companyId,
      originalOwnerId: contribution.originalOwnerId,
      originalOwner: state.profiles.find((profile) => profile.id === contribution.originalOwnerId)?.name || contribution.originalOwnerId,
      executorId: contribution.executorId,
      executor: state.profiles.find((profile) => profile.id === contribution.executorId)?.name || contribution.executorId,
      executorTeamId: state.profiles.find((profile) => profile.id === contribution.executorId)?.teamId || "",
      sector: task.sector, kind: task.kind, unit: task.unit,
      sessions: contribution.sessions.map(({ id, start, end }) => ({ id, start, end })),
      activity: contribution.activity.map(({ id, date, qty, note }) => ({ id, date, qty, note })),
      completionAt: contribution.completionAt,
    };
  });
  return {
    ...base,
    schemaVersion: 3,
    coverageSnapshotVersion: 1,
    groups: reportGroups,
    contributions: base.contributions?.filter((contribution) => closure.tasks.some((task) => task.id === contribution.taskId && task.kind === "resultado")),
    laboratorySummary: {
      operational,
      covered: {
        movementCount: covered.movementCount, quantityByUnit: covered.quantityByUnit,
        weightedLoad: covered.weightedLoad, unweightedQuantity: covered.unweightedQuantity, recordedSeconds: covered.recordedSeconds,
      },
    },
    ...(coverageReports.length ? { coverageContributions: coverageReports } : {}),
  };
}

function consolidateClosedMonth(state: State, ownerId: string, month: string, actorId: string, note: string, at: string): State {
  if (state.closures.some((closure) => closure.ownerId === ownerId && closure.month === month)) return state;
  const tasksInPeriod = state.tasks.filter((task) => task.month === month && isResponsible(task, ownerId));
  const existingUnits = (state.companyClosures || []).filter((row) => row.ownerId === ownerId && row.month === month);
  const companyIds = [...new Set([
    ...existingUnits.map((unit) => unit.companyId),
    ...tasksInPeriod.map((task) => task.companyId),
    ...state.tasks.flatMap((task) => coveredContributionFor(state, task, ownerId, month) ? [task.companyId] : []),
  ])];
  const units = existingUnits.filter((row) => companyIds.includes(row.companyId));
  if (!companyIds.length || companyIds.some((companyId) => !units.some((row) => row.companyId === companyId))) return state;
  const tasksById = new Map<string, Task>();
  const activityById = new Map<string, Activity>();
  const transfersById = new Map<string, NonNullable<Closure["taskTransfers"]>[number]>();
  for (const unit of units) {
    for (const task of unit.tasks) if (isResponsible(task, ownerId)) tasksById.set(task.id, structuredClone(task));
    for (const row of unit.activity) activityById.set(row.id, structuredClone(row));
    for (const transfer of unit.taskTransfers || []) transfersById.set(transfer.id, structuredClone(transfer));
  }
  const tasks = [...tasksById.values()];
  const taskIds = new Set(tasks.map((task) => task.id));
  const activity = [...activityById.values()].filter((row) => taskIds.has(row.taskId));
  const coveredActivity = units.flatMap((row) => row.coveredActivity).filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index);
  const coveredContributions = units.flatMap((row) => row.coveredContributions || [])
    .filter((row, index, rows) => rows.findIndex((candidate) => candidate.executorId === row.executorId && candidate.taskSnapshot.id === row.taskSnapshot.id) === index);
  const deliveryTasks = tasks.filter((task) => task.kind === "resultado");
  const closure: Closure = {
    id: id(), ownerId, month, at, by: actorId, note: note.trim(),
    metrics: metricsForProfile(deliveryTasks, activity, ownerId, dateART(at), at),
    tasks: structuredClone(tasks), activity: structuredClone(activity),
    taskTransfers: [...transfersById.values()].filter((transfer) => taskIds.has(transfer.taskId)),
  };
  const unitReports = units.map((unit) => unit.report).filter((report): report is PeriodReport => !!report);
  if (unitReports.length === units.length) {
    const operationalUnits = units.filter((unit) => unit.tasks.some((task) => task.kind === "operativa"));
    const operational = operationalUnits.map((unit) => unit.report?.laboratorySummary?.operational).filter((row): row is OperationalReportSummary => !!row);
    const coveredUnits = units.filter((unit) => !!unit.coveredContributions?.length);
    const covered = coveredUnits.map((unit) => unit.report?.laboratorySummary?.covered).filter((row): row is NonNullable<PeriodReport["laboratorySummary"]>["covered"] => !!row);
    const combineLoad = (rows: Array<{ weightedLoad: number | null; unweightedQuantity: number; quantityByUnit: Array<{ unit: string; quantity: number }>; movementCount: number; recordedSeconds: number }>) => {
      const unitsByName = new Map<string, number>();
      rows.forEach((row) => row.quantityByUnit.forEach((item) => unitsByName.set(item.unit, (unitsByName.get(item.unit) || 0) + item.quantity)));
      return {
        movementCount: rows.reduce((sum, row) => sum + row.movementCount, 0),
        quantityByUnit: [...unitsByName].map(([unit, quantity]) => ({ unit, quantity })).sort((a, b) => a.unit.localeCompare(b.unit, "es")),
        weightedLoad: rows.length && rows.every((row) => row.weightedLoad !== null) ? Math.round(rows.reduce((sum, row) => sum + (row.weightedLoad || 0), 0) * 100) / 100 : null,
        unweightedQuantity: rows.reduce((sum, row) => sum + row.unweightedQuantity, 0),
        recordedSeconds: rows.reduce((sum, row) => sum + row.recordedSeconds, 0),
      };
    };
    const { coverageSnapshotVersion: _baseCoverageSnapshotVersion, ...base } = unitReports[0];
    const operationalSummary = combineLoad(operational);
    const coveredSummary = combineLoad(covered);
    closure.report = {
      ...base,
      schemaVersion: 3,
      ...(unitReports.every((report) => report.coverageSnapshotVersion === 1) ? { coverageSnapshotVersion: 1 as const } : {}),
      generatedAt: at,
      groups: unitReports.flatMap((report) => report.groups),
      recordedSeconds: unitReports.reduce((sum, report) => sum + report.recordedSeconds, 0) +
        unitReports.reduce((sum, report) => sum + (report.laboratorySummary?.covered.recordedSeconds || 0), 0),
      reopenings: unitReports.reduce((sum, report) => sum + report.reopenings, 0),
      contributions: unitReports.flatMap((report) => report.contributions || []),
      transfers: unitReports.flatMap((report) => report.transfers || []),
      laboratorySummary: {
        operational: {
          ...operationalSummary,
          weightedLoad: operational.length === operationalUnits.length ? operationalSummary.weightedLoad : null,
          quality: operational.some((row) => row.quality !== null) ? Math.round(operational.reduce((sum, row) => sum + (row.quality || 0) * row.evaluations, 0) / Math.max(1, operational.reduce((sum, row) => sum + row.evaluations, 0))) : null,
          order: operational.some((row) => row.order !== null) ? Math.round(operational.reduce((sum, row) => sum + (row.order || 0) * row.evaluations, 0) / Math.max(1, operational.reduce((sum, row) => sum + row.evaluations, 0))) : null,
          timeliness: operational.some((row) => row.timeliness !== null) ? Math.round(operational.reduce((sum, row) => sum + (row.timeliness || 0) * row.evaluations, 0) / Math.max(1, operational.reduce((sum, row) => sum + row.evaluations, 0))) : null,
          evaluations: operational.reduce((sum, row) => sum + row.evaluations, 0),
        },
        covered: { ...coveredSummary, weightedLoad: covered.length === coveredUnits.length ? coveredSummary.weightedLoad : null },
      },
      ...(coveredContributions.length ? { coverageContributions: unitReports.flatMap((report) => report.coverageContributions || []) } : {}),
    };
  }
  return { ...state, closures: [...state.closures, closure] };
}

export function closeCompanyUnits(state: State, units: CloseUnit[], actorId: string, note: string, at = new Date().toISOString()): CloseBatchResult {
  let next = state;
  const closed: CloseUnit[] = [], blocked: CloseBlock[] = [];
  for (const group of connectedCloseUnitGroups(state, units)) {
    const reasons = group.map((unit) => companyUnitCloseBlocker(state, unit, actorId, at)).filter((reason): reason is string => !!reason);
    if (reasons.length) {
      for (const unit of group) blocked.push({ unit, reason: reasons[0] });
      continue;
    }
    try {
      const closures = group.map((unit) => closeUnit(state, unit, actorId, note, at));
      let candidate: State = { ...next, companyClosures: [...(next.companyClosures || []), ...closures] };
      for (const ownerId of new Set(group.map((unit) => unit.ownerId)))
        candidate = consolidateClosedMonth(candidate, ownerId, group[0].month, actorId, note, at);
      next = candidate;
      closed.push(...group);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "No se pudo cerrar el grupo de unidades.";
      for (const unit of group) blocked.push({ unit, reason });
    }
  }
  return { state: next, closed, blocked };
}

export function dashboardOperationalLoad(state: State, profileId: string, month: string, companyId?: string) {
  const tasks = state.tasks.filter((task) => task.month === month && task.kind === "operativa" && task.companyId &&
    (!companyId || task.companyId === companyId) && (isResponsible(task, profileId) || state.activity.some((activity) => activity.taskId === task.id && activity.actorId === profileId)));
  const own = operationalLoad(state, tasks.map((task) => task.id), profileId);
  const byUnit = new Map<string, number>();
  for (const task of tasks) for (const activity of state.activity.filter((row) => row.taskId === task.id && row.actorId === profileId))
    byUnit.set(task.unit || "movimientos", (byUnit.get(task.unit || "movimientos") || 0) + activity.qty);
  return { ...own, byUnit: [...byUnit.entries()].sort(([a], [b]) => a.localeCompare(b, "es")) };
}

export function companyMetrics(state: State, ownerId: string, companyId: string, month: string): Metrics {
  const tasks = state.tasks.filter((task) => task.month === month && task.companyId === companyId && isResponsible(task, ownerId) && task.kind === "resultado");
  return metricsForProfile(tasks, state.activity, ownerId);
}

export function isEventManager(state: State, actor: Profile, event: LabCalendarEvent) {
  return actor.active && (!event.companyId || actor.role === "jefe" || actor.companyIds.includes(event.companyId)) &&
    (actor.id === event.authorId || canSee(actor, event.authorId, state.profiles));
}

export function eligibleCalendarRecipients(state: State, actor: Profile, companyId: string | null) {
  return calendarRecipients(state, actor, companyId, true).map((profileId) => state.profiles.find((row) => row.id === profileId)).filter((row): row is Profile => !!row && row.id !== actor.id);
}

export function operationalTaskIds(state: State, profileId: string, month: string, companyId?: string) {
  return state.tasks.filter((task) => task.kind === "operativa" && task.month === month && (!companyId || task.companyId === companyId) && isResponsible(task, profileId)).map((task) => task.id);
}

export function activitySnapshotsForLog(state: State, task: Task, date: string) {
  return task.kind === "operativa" ? snapshotOperationalRate(state, task, date) : { operationalRateId: null, operationalUnitWeight: null };
}

/** Viewing a task never grants write or execution authority in the lab. */
export function canExecuteLab(state: State, actor: Profile, task: Task, on = dateART()) {
  if (!canWork(state, actor, task, on) || isLabTaskLocked(state, task)) return false;
  if (isLabCompanyClosed(state, actor.id, task.companyId, task.month)) return false;
  if (task.kind === "operativa" && task.responsibility) return false;
  return isResponsible(task, actor.id) || coverageFor(state, task, on)?.replacementId === actor.id;
}

export function canAssignLabTask(state: State, actor: Profile, ownerId: string, companyId: string) {
  const currentActor = state.profiles.find((profile) => profile.id === actor.id);
  const owner = state.profiles.find((profile) => profile.id === ownerId);
  if (!currentActor?.active || !owner?.active || !state.companies.some((company) => company.id === companyId) || !owner.companyIds.includes(companyId)) return false;
  if (currentActor.role === "jefe") return true;
  if (!currentActor.companyIds.includes(companyId) || !canSee(currentActor, ownerId, state.profiles)) return false;
  return currentActor.role === "encargado" ? owner.managerId === currentActor.id : currentActor.role === "empleado" && owner.id === currentActor.id;
}

export function closureProgress(state: State, profileId: string, month: string) {
  const units = [...new Set(state.tasks.filter((task) => task.month === month && isResponsible(task, profileId)).map((task) => task.companyId))];
  const closed = units.filter((companyId) => isLabCompanyClosed(state, profileId, companyId, month));
  return { total: units.length, closed: closed.length, remaining: units.filter((companyId) => !closed.includes(companyId)) };
}

export function assessableOperations(state: State, profileId: string, month: string, companyId?: string) {
  return state.tasks.filter((task) => task.kind === "operativa" && task.ownerId === profileId && task.month === month && (!companyId || task.companyId === companyId) && !task.responsibility);
}
