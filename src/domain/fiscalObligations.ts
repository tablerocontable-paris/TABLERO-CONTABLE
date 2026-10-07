import { currentMonth, id, responsibleMembers, type State, type Task } from "./model";
import { canWork } from "./workforce";
import { taskTimeliness } from "./timeliness";

export type ObligationMilestone = "presentation" | "payment" | "closing" | "documentation";
export type FiscalObligationStatus = "pending" | "completed_on_time" | "completed_late" | "unassigned";

export interface FiscalObligationRevision {
  revision: number;
  at: string;
  by: string;
  reason: string;
  dueOn: string;
  sourceLabel: string;
  sourceRevision: string;
  sourceCheckedAt: string | null;
  requiredTaskIds: string[];
}

export interface FiscalObligation {
  id: string;
  companyId: string;
  obligationCode: string;
  title: string;
  fiscalPeriod: string;
  milestone: ObligationMilestone;
  dueOn: string;
  sourceLabel: string;
  sourceRevision: string;
  sourceCheckedAt: string | null;
  revision: number;
  requiredTaskIds: string[];
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  history: FiscalObligationRevision[];
}

export interface FiscalObligationInput {
  companyId: string;
  obligationCode: string;
  title: string;
  fiscalPeriod: string;
  milestone: ObligationMilestone;
  dueOn: string;
  sourceLabel: string;
  sourceRevision: string;
  sourceCheckedAt: string | null;
  requiredTaskIds: string[];
}

export interface FiscalObligationUpdate {
  dueOn: string;
  sourceLabel: string;
  sourceRevision: string;
  sourceCheckedAt: string | null;
  requiredTaskIds: string[];
  reason: string;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validPeriod(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function canonicalObligationCode(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es-AR");
}

function identityKey(row: Pick<FiscalObligation, "companyId" | "obligationCode" | "fiscalPeriod" | "milestone">): string {
  return [row.companyId, canonicalObligationCode(row.obligationCode), row.fiscalPeriod, row.milestone].join("\u001f");
}

function checkedInput(input: FiscalObligationInput | (FiscalObligationUpdate & { companyId: string; fiscalPeriod?: string }), state: State) {
  const company = state.companies.find((row) => row.id === input.companyId);
  if (!company) throw Error("Elegí una empresa válida.");
  if (input.fiscalPeriod !== undefined && !validPeriod(input.fiscalPeriod)) throw Error("Revisá el período fiscal.");
  if (!validDate(input.dueOn)) throw Error("Ingresá una fecha de vencimiento válida.");
  if (input.sourceCheckedAt !== null && !validDate(input.sourceCheckedAt)) throw Error("Revisá la fecha de consulta de la fuente.");
  const sourceLabel = input.sourceLabel.trim();
  const sourceRevision = input.sourceRevision.trim();
  if (!sourceLabel || sourceLabel.length > 160) throw Error("Indicá un origen o referencia de hasta 160 caracteres.");
  if (!sourceRevision || sourceRevision.length > 80) throw Error("Indicá una revisión del origen de hasta 80 caracteres.");
  const selected = new Set(input.requiredTaskIds);
  if (selected.size !== input.requiredTaskIds.length) throw Error("No repitas tareas obligatorias.");
  const linked = state.tasks.filter((task) => selected.has(task.id));
  if (linked.length !== selected.size || linked.some((task) => task.companyId !== company.id))
    throw Error("Vinculá tareas existentes de la misma empresa.");
  return { company, sourceLabel, sourceRevision, linked };
}

export function canManageFiscalObligation(
  state: State,
  actorId: string,
  companyId: string,
  taskIds: string[],
): boolean {
  const actor = state.profiles.find((profile) => profile.id === actorId);
  if (!actor?.active || !actor.companyIds.includes(companyId)) return false;
  if (actor.role === "jefe") return true;
  const linked = state.tasks.filter((task) => taskIds.includes(task.id));
  if (linked.length !== taskIds.length || linked.some((task) => task.companyId !== companyId)) return false;
  if (linked.length) return linked.every((task) => canWork(state, actor, task));
  if (actor.role === "empleado") return false;
  return state.tasks.some((task) => task.companyId === companyId && canWork(state, actor, task));
}

export function createFiscalObligation(
  state: State,
  input: FiscalObligationInput,
  actorId: string,
  at = new Date().toISOString(),
): State {
  const actor = state.profiles.find((profile) => profile.id === actorId);
  const { sourceLabel, sourceRevision } = checkedInput(input, state);
  if (!actor?.active || !canManageFiscalObligation(state, actorId, input.companyId, input.requiredTaskIds))
    throw Error("No tenés permisos para cargar esta obligación.");
  const code = input.obligationCode.trim();
  const title = input.title.trim();
  if (code.length < 2 || code.length > 80) throw Error("El identificador de la obligación debe tener entre 2 y 80 caracteres.");
  if (!title || title.length > 120) throw Error("Indicá una obligación de hasta 120 caracteres.");
  if (!validPeriod(input.fiscalPeriod)) throw Error("Revisá el período fiscal.");
  const event: FiscalObligation = {
    id: id(), companyId: input.companyId, obligationCode: code, title,
    fiscalPeriod: input.fiscalPeriod, milestone: input.milestone, dueOn: input.dueOn,
    sourceLabel, sourceRevision, sourceCheckedAt: input.sourceCheckedAt,
    revision: 1, requiredTaskIds: [...input.requiredTaskIds], createdAt: at,
    createdBy: actorId, updatedAt: at, history: [],
  };
  if ((state.fiscalObligations || []).some((row) => identityKey(row) === identityKey(event)))
    throw Error("Ya existe ese hito para la empresa y el período fiscal elegidos.");
  return { ...state, fiscalObligations: [...(state.fiscalObligations || []), event] };
}

export function updateFiscalObligation(
  state: State,
  eventId: string,
  update: FiscalObligationUpdate,
  actorId: string,
  at = new Date().toISOString(),
): State {
  const event = (state.fiscalObligations || []).find((row) => row.id === eventId);
  if (!event) throw Error("La obligación ya no está disponible.");
  const actor = state.profiles.find((profile) => profile.id === actorId);
  const { sourceLabel, sourceRevision } = checkedInput({ ...update, companyId: event.companyId }, state);
  if (!actor?.active ||
    !canManageFiscalObligation(state, actorId, event.companyId, event.requiredTaskIds) ||
    !canManageFiscalObligation(state, actorId, event.companyId, update.requiredTaskIds))
    throw Error("No tenés permisos para revisar esta obligación.");
  const reason = update.reason.trim();
  if (reason.length < 5 || reason.length > 500) throw Error("Explicá el cambio en 5 a 500 caracteres.");
  const changed = event.dueOn !== update.dueOn || event.sourceLabel !== sourceLabel ||
    event.sourceRevision !== sourceRevision || event.sourceCheckedAt !== update.sourceCheckedAt ||
    event.requiredTaskIds.length !== update.requiredTaskIds.length ||
    event.requiredTaskIds.some((taskId, index) => taskId !== update.requiredTaskIds[index]);
  if (!changed) throw Error("No hay cambios para guardar.");
  const revision = event.revision + 1;
  const history: FiscalObligationRevision = {
    revision, at, by: actorId, reason, dueOn: update.dueOn,
    sourceLabel, sourceRevision, sourceCheckedAt: update.sourceCheckedAt,
    requiredTaskIds: [...update.requiredTaskIds],
  };
  return {
    ...state,
    fiscalObligations: (state.fiscalObligations || []).map((row) => row.id === eventId ? {
      ...row, dueOn: update.dueOn, sourceLabel, sourceRevision,
      sourceCheckedAt: update.sourceCheckedAt, requiredTaskIds: [...update.requiredTaskIds],
      revision, updatedAt: at, history: [...row.history, history],
    } : row),
  };
}

function taskHasActiveResponsible(state: State, task: Task): boolean {
  return responsibleMembers(task).some((member) => state.profiles.some((profile) =>
    profile.id === member.profileId && profile.active && profile.companyIds.includes(task.companyId)));
}

export function fiscalObligationStatus(
  state: State,
  event: FiscalObligation,
  asOfISO = new Date().toISOString(),
): FiscalObligationStatus {
  if (!event.requiredTaskIds.length) return "unassigned";
  const tasks = event.requiredTaskIds.map((taskId) => state.tasks.find((task) => task.id === taskId));
  if (tasks.some((task) => !task || task.companyId !== event.companyId)) return "unassigned";
  const linked = tasks as Task[];
  if (linked.some((task) => !taskHasActiveResponsible(state, task))) return "unassigned";
  const evidence = linked.map((task) => taskTimeliness({ ...task, due: event.dueOn }, state.activity, asOfISO));
  if (evidence.some((item) => item.achievementAt === null || !["early", "on-date", "late"].includes(item.status)))
    return "pending";
  return evidence.some((item) => item.status === "late") ? "completed_late" : "completed_on_time";
}

export function visibleFiscalObligations(
  state: State,
  actorId: string,
  dueOrFiscalMonth: string,
  companyId = "",
): FiscalObligation[] {
  const actor = state.profiles.find((profile) => profile.id === actorId);
  if (!actor?.active) return [];
  return (state.fiscalObligations || []).filter((event) => {
    if (!actor.companyIds.includes(event.companyId) || (companyId && event.companyId !== companyId)) return false;
    if (event.fiscalPeriod !== dueOrFiscalMonth && !event.dueOn.startsWith(dueOrFiscalMonth)) return false;
    if (actor.role === "jefe") return true;
    return event.requiredTaskIds.some((taskId) => {
      const task = state.tasks.find((row) => row.id === taskId);
      return !!task && canWork(state, actor, task);
    });
  }).sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title, "es"));
}

function previousMonth(month: string): string {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function seedFiscalObligations(state: State, month = currentMonth()): FiscalObligation[] {
  const sampleTask = state.tasks.find((task) => task.companyId === "c2" && task.ownerId === "e0" && task.title === "Liquidación y control de IVA");
  const createdAt = `${month}-01T12:00:00.000Z`;
  const base = {
    companyId: "c2", obligationCode: "iva-mensual", fiscalPeriod: previousMonth(month),
    sourceLabel: "Ejemplo ficticio de laboratorio · sin consulta oficial",
    sourceRevision: "DEMO-01", sourceCheckedAt: null, revision: 1,
    createdAt, createdBy: null, updatedAt: createdAt, history: [] as FiscalObligationRevision[],
  };
  return [
    {
      ...base, id: "demo-fiscal-iva-presentation", title: "IVA mensual · presentación (ejemplo)",
      milestone: "presentation", dueOn: `${month}-20`, requiredTaskIds: sampleTask ? [sampleTask.id] : [],
    },
    {
      ...base, id: "demo-fiscal-iva-payment", title: "IVA mensual · pago (ejemplo)",
      milestone: "payment", dueOn: `${month}-25`, requiredTaskIds: [],
    },
  ];
}
