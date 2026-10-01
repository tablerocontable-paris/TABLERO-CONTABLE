import {
  type State,
  type Assignment,
  id,
  dueDate,
  materialize,
  isClosed,
} from "./model";
import {
  defaultSchedule,
  validateSchedule,
  addDays,
  type Schedule,
} from "./schedule";
export const scheduleOf = (a: Assignment): Schedule =>
  a.schedule || {
    ...defaultSchedule(
      a.frequency === "única"
        ? dueDate(a.startMonth, a.day)
        : a.startMonth + "-01",
      a.frequency,
    ),
    monthDay: a.day,
  };
export function reviseAssignment(
  s: State,
  assignmentId: string,
  rule: Schedule,
  actorId: string,
) {
  if (s.profiles.find((p) => p.id === actorId)?.role !== "jefe")
    throw Error("Jefatura administra las recurrencias.");
  validateSchedule(rule);
  const old = s.assignments.find((a) => a.id === assignmentId);
  if (!old || old.retired) throw Error("La planificación ya fue reemplazada.");
  if (!old.templateId && rule.frequency !== "única")
    throw Error(
      "Una tarea habitual necesita un proceso estándar en el catálogo.",
    );
  const oldRule = scheduleOf(old);
  const affected = s.tasks.filter(
    (t) =>
      t.assignmentId === old.id &&
      (t.scheduledOn || t.due || t.month + "-01") >= rule.startDate,
  );
  if (
    affected.some(
      (t) =>
        isClosed(s, t) ||
        t.status !== "Pendiente" ||
        t.sessions?.length ||
        s.activity.some((e) => e.taskId === t.id),
    )
  )
    throw Error(
      "Hay trabajo iniciado o un mes cerrado desde esa fecha. Elegí una fecha posterior para conservar el historial.",
    );
  const periods = [
    ...new Set([rule.startDate.slice(0, 7), ...affected.map((t) => t.month)]),
  ];
  const nextAssignment: Assignment = {
    ...old,
    id: id(),
    schedule: rule,
    frequency: rule.frequency,
    day: rule.monthDay,
    startMonth: rule.startDate.slice(0, 7),
  };
  let next: State = {
    ...s,
    tasks: s.tasks.filter((t) => !affected.some((a) => a.id === t.id)),
    assignments: [
      ...s.assignments.map((a) =>
        a.id === old.id
          ? {
              ...a,
              retired: rule.startDate <= oldRule.startDate,
              schedule: {
                ...oldRule,
                endDate:
                  rule.startDate <= oldRule.startDate
                    ? oldRule.endDate
                    : addDays(rule.startDate, -1),
              },
            }
          : a,
      ),
      nextAssignment,
    ],
  };
  for (const period of periods) next = materialize(next, period);
  return next;
}
