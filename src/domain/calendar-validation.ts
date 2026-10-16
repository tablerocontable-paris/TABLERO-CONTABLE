import { validDate } from "./schedule";

const calendarKinds = new Set(["balance_close", "audit", "important", "custom"]);

export interface CalendarTaskReference {
  companyId: string;
}

/** Shared semantic validation for calendar writes and restored laboratory state. */
export function calendarEventFieldsError(
  value: unknown,
  companyIds: ReadonlySet<string>,
  tasks: ReadonlyMap<string, CalendarTaskReference>,
): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "La fecha compartida no tiene un formato válido.";
  const event = value as Record<string, unknown>;
  if (event.companyId !== null && (typeof event.companyId !== "string" || !companyIds.has(event.companyId)))
    return "La empresa de la fecha compartida no existe.";
  if (typeof event.kind !== "string" || !calendarKinds.has(event.kind)) return "El tipo de fecha compartida no es válido.";
  if (typeof event.title !== "string" || !event.title.trim() || event.title.trim().length > 120 ||
      typeof event.description !== "string" || event.description.trim().length > 1000)
    return "El título admite entre 1 y 120 caracteres y el detalle hasta 1.000.";
  if (typeof event.startOn !== "string" || typeof event.endOn !== "string" ||
      !validDate(event.startOn) || !validDate(event.endOn) || event.endOn < event.startOn)
    return "El intervalo de la fecha compartida no es válido.";
  if (event.linkedTaskId !== null) {
    if (typeof event.linkedTaskId !== "string") return "La tarea vinculada no es válida.";
    const task = tasks.get(event.linkedTaskId);
    if (!task || task.companyId !== event.companyId) return "La tarea vinculada está fuera de tu ámbito o no corresponde a esta fecha y empresa.";
  }
  return null;
}
