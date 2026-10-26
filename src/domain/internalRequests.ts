import type { Assignment, Profile, State, Task } from "./model";
import { canSee } from "./model";
import { validDate } from "./schedule";

export type InternalRequestKind = "technical_error" | "work_request" | "suggestion";
export type InternalRequestUrgency = "low" | "medium" | "high" | "urgent";
export type InternalRequestStatus = "new" | "review" | "responded" | "resolved";
export type InternalRequestMessage = {
  id: string;
  actorId: string;
  body: string;
  createdAt: string;
};
export type InternalRequestEvent = {
  id: string;
  actorId: string;
  status: InternalRequestStatus;
  note: string;
  createdAt: string;
};
export type InternalRequest = {
  id: string;
  kind: InternalRequestKind;
  authorId: string;
  recipientId: string;
  urgency: InternalRequestUrgency;
  module: string;
  subject: string;
  description: string;
  status: InternalRequestStatus;
  createdAt: string;
  updatedAt: string;
  messages: InternalRequestMessage[];
  history: InternalRequestEvent[];
  convertedTaskId?: string;
  convertedBy?: string;
  convertedAt?: string;
};

export const internalRequestLabels: Record<InternalRequestKind, string> = {
  technical_error: "Error técnico",
  work_request: "Pedido o consulta de trabajo",
  suggestion: "Sugerencia",
};
export const internalRequestStatusLabels: Record<InternalRequestStatus, string> = {
  new: "Nuevo",
  review: "En revisión",
  responded: "Respondido",
  resolved: "Resuelto",
};
export const internalRequestUrgencyLabels: Record<InternalRequestUrgency, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};
const urgencyOrder: Record<InternalRequestUrgency, number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
};

export function canViewInternalRequest(request: InternalRequest, actor: Profile) {
  return actor.active && (actor.role === "jefe" || request.authorId === actor.id || request.recipientId === actor.id);
}

export function visibleInternalRequests(requests: InternalRequest[], actor: Profile) {
  return requests
    .filter((request) => canViewInternalRequest(request, actor))
    .sort((a, b) => {
      const aOpen = a.status !== "resolved";
      const bOpen = b.status !== "resolved";
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      if (aOpen && urgencyOrder[a.urgency] !== urgencyOrder[b.urgency])
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export function createInternalRequest(input: {
  kind: InternalRequestKind;
  authorId: string;
  recipientId: string;
  urgency: InternalRequestUrgency;
  module: string;
  subject: string;
  description: string;
  now: string;
  makeId: () => string;
}): InternalRequest {
  const module = input.module.trim();
  const subject = input.subject.trim();
  const description = input.description.trim();
  if (!input.authorId || !input.recipientId) throw new Error("Elegí un destinatario válido.");
  if (!module || module.length > 80) throw new Error("Indicá el módulo (hasta 80 caracteres).");
  if (!subject || subject.length > 120) throw new Error("El asunto es obligatorio y admite hasta 120 caracteres.");
  if (!description || description.length > 4000) throw new Error("El detalle es obligatorio y admite hasta 4.000 caracteres.");
  const id = input.makeId();
  return {
    id, kind: input.kind, authorId: input.authorId, recipientId: input.recipientId,
    urgency: input.urgency, module, subject, description, status: "new",
    createdAt: input.now, updatedAt: input.now, messages: [],
    history: [{ id: input.makeId(), actorId: input.authorId, status: "new", note: "Solicitud creada", createdAt: input.now }],
  };
}

export function canManageInternalRequest(request: InternalRequest, actor: Profile) {
  return actor.active && (actor.id === request.recipientId || actor.role === "jefe");
}

export function canConvertInternalRequest(request: InternalRequest, actor: Profile) {
  return request.kind === "work_request" && request.status !== "resolved" &&
    !request.convertedTaskId && actor.role === "jefe" && canManageInternalRequest(request, actor);
}

/** Atomically records the explicit request-to-task link after the one-off task is materialized. */
export function completeInternalRequestConversion(
  state: State,
  requestId: string,
  actor: Profile,
  assignment: Assignment,
  task: Task,
  now: string,
  makeId: () => string,
): InternalRequest {
  const request = state.internalRequests?.find((entry) => entry.id === requestId);
  if (!request || !canConvertInternalRequest(request, actor))
    throw new Error("Este pedido ya no puede convertirse en tarea.");
  if (!validDate(now.slice(0, 10))) throw new Error("La fecha de conversión no es válida.");
  const responsible = state.profiles.find((profile) => profile.id === assignment.ownerId);
  if (!responsible?.active || !canSee(actor, responsible.id, state.profiles) ||
      !responsible.companyIds.includes(assignment.companyId) ||
      !state.companies.some((company) => company.id === assignment.companyId))
    throw new Error("Empresa o responsable fuera del ámbito autorizado.");
  if (!Number.isFinite(assignment.weight) || assignment.weight <= 0 ||
      assignment.frequency !== "única" || assignment.schedule?.frequency !== "única" ||
      task.assignmentId !== assignment.id || task.ownerId !== assignment.ownerId ||
      task.companyId !== assignment.companyId || task.title !== assignment.title ||
      task.weight !== assignment.weight || task.kind !== assignment.kind ||
      !task.scheduledOn || task.scheduledOn !== assignment.schedule.startDate ||
      !validDate(task.scheduledOn) || task.month !== task.scheduledOn.slice(0, 7) ||
      (task.due && (!validDate(task.due) || task.due < task.scheduledOn)))
    throw new Error("La conversión requiere una sola tarea con fechas y asignación válidas.");
  if (state.closures.some((closure) => closure.ownerId === task.ownerId && closure.month === task.month))
    throw new Error(`El período ${task.month} de esa persona está cerrado.`);
  const materialized = state.tasks.filter((candidate) => candidate.assignmentId === assignment.id && candidate.month === task.month);
  if (materialized.length !== 1 || materialized[0].id !== task.id ||
      state.tasks.some((candidate) => candidate.originRequestId === requestId))
    throw new Error("No se encontró una única tarea nueva para vincular con el pedido.");
  const event = {
    id: makeId(), actorId: actor.id, status: "resolved" as const,
    note: `Convertido en tarea: ${task.title}`, createdAt: now,
  };
  return {
    ...request, status: "resolved", updatedAt: now, convertedTaskId: task.id,
    convertedBy: actor.id, convertedAt: now, history: [...request.history, event],
  };
}

export function replyToInternalRequest(
  request: InternalRequest,
  actor: Profile,
  body: string,
  now: string,
  makeId: () => string,
): InternalRequest {
  if (!canManageInternalRequest(request, actor)) throw new Error("Sólo el destinatario puede responder este pedido.");
  if (request.status === "resolved") throw new Error("El pedido ya está resuelto y no admite nuevas respuestas.");
  const text = body.trim();
  if (!text || text.length > 4000) throw new Error("La respuesta es obligatoria y admite hasta 4.000 caracteres.");
  const message = { id: makeId(), actorId: actor.id, body: text, createdAt: now };
  const event = { id: makeId(), actorId: actor.id, status: "responded" as const, note: "Se agregó una respuesta", createdAt: now };
  return { ...request, status: "responded", updatedAt: now, messages: [...request.messages, message], history: [...request.history, event] };
}

export function setInternalRequestStatus(
  request: InternalRequest,
  actor: Profile,
  status: InternalRequestStatus,
  now: string,
  makeId: () => string,
): InternalRequest {
  if (!canManageInternalRequest(request, actor)) throw new Error("Sólo el destinatario puede actualizar este pedido.");
  if (request.status === status) return request;
  const allowed: Record<InternalRequestStatus, InternalRequestStatus[]> = {
    new: ["review", "resolved"],
    review: ["responded", "resolved"],
    responded: ["review", "resolved"],
    resolved: [],
  };
  if (!allowed[request.status].includes(status)) throw new Error("Ese cambio de estado no está disponible.");
  const event = { id: makeId(), actorId: actor.id, status, note: "Estado actualizado", createdAt: now };
  return { ...request, status, updatedAt: now, history: [...request.history, event] };
}

export function internalRequestRecipients(state: State, actor: Profile, kind: InternalRequestKind) {
  if (kind === "technical_error") return [{ id: "technical-support", name: "Cola de soporte técnico · simulada" }];
  if (kind === "work_request") return [{ id: "boss", name: state.profiles.find((p) => p.id === "boss")?.name || "jefatura" }];
  return state.profiles
    .filter((profile) => profile.active && profile.id !== actor.id && (profile.role === "jefe" || profile.role === "encargado"))
    .map(({ id, name }) => ({ id, name }));
}
