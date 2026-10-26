import {
  type Profile,
  type State,
  type Assignment,
  id,
  dueDate,
  materialize,
  isClosed,
  canSee,
} from "./model";
import {
  defaultSchedule,
  validateSchedule,
  addDays,
  type Schedule,
} from "./schedule";
import { neutralStarterTask } from "./neutralStarterCatalog";

export function canViewLabAssignment(state: State, actor: Profile, assignment: Assignment) {
  const currentActor = state.profiles.find((profile) => profile.id === actor.id);
  const owner = state.profiles.find((profile) => profile.id === assignment.ownerId);
  const companyExists = state.companies.some((company) => company.id === assignment.companyId);
  return !!currentActor?.active && companyExists && !!owner?.active && owner.companyIds.includes(assignment.companyId) &&
    (currentActor.role === "jefe" || currentActor.companyIds.includes(assignment.companyId) && canSee(currentActor, owner.id, state.profiles));
}
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
  const actor = s.profiles.find((p) => p.id === actorId);
  if (!actor?.active || actor.role !== "jefe")
    throw Error("Jefatura administra las recurrencias.");
  validateSchedule(rule);
  const old = s.assignments.find((a) => a.id === assignmentId);
  if (!old || old.retired) throw Error("La planificación ya fue reemplazada.");
  if (!old.templateId && !neutralStarterTask(old.starterId || "") && rule.frequency !== "única")
    throw Error(
      "Una tarea habitual necesita un proceso estándar en el catálogo.",
    );
  const oldRule = scheduleOf(old);
  const affected = s.tasks.filter(
    (t) =>
      t.assignmentId === old.id &&
      (t.scheduledOn || t.due || t.month + "-01") >= rule.startDate,
  );
  const editableAffected = affected.filter((task) => !isClosed(s, task));
  const affectedIds = new Set(editableAffected.map((task) => task.id));
  const hasReferences = (taskId: string) =>
    (s.taskComments || []).some((row) => row.taskId === taskId) ||
    (s.taskEvidence || []).some((row) => row.taskId === taskId) ||
    (s.notifications || []).some((row) => row.taskId === taskId) ||
    (s.calendarEvents || []).some((row) => row.linkedTaskId === taskId) ||
    (s.jointReceipts || []).some((row) => row.taskId === taskId) ||
    (s.taskTransfers || []).some((row) => row.taskId === taskId) ||
    (s.internalRequests || []).some((row) => row.convertedTaskId === taskId) ||
    (s.fiscalObligations || []).some((row) => row.requiredTaskIds.includes(taskId)) ||
    (s.annotations || []).some((row) => row.convertedTaskId === taskId) ||
    (s.operationalRates || []).some((row) => row.taskId === taskId) ||
    (s.operationalAssessments || []).some((row) => row.taskId === taskId) ||
    (s.absences || []).some((row) => row.taskIds?.includes(taskId) || (s.tasks.find((task) => task.id === taskId)?.assignmentId && row.assignmentIds?.includes(s.tasks.find((task) => task.id === taskId)!.assignmentId!))) ||
    (s.tasks || []).some((row) => row.dependsOnTaskIds?.includes(taskId));
  if (editableAffected.some((task) => task.dependsOnTaskIds?.length || task.availableFrom || task.commercialProgress || task.evidenceIds?.length || hasReferences(task.id)))
    throw Error("Hay referencias, progreso comercial o dependencias en tareas que esta regla eliminaría. Elegí una fecha posterior para conservarlas.");
  if (
    editableAffected.some(
      (t) =>
        t.status !== "Pendiente" ||
        t.sessions?.length ||
        s.activity.some((e) => e.taskId === t.id),
    )
  )
    throw Error(
      "Hay trabajo iniciado o un mes cerrado desde esa fecha. Elegí una fecha posterior para conservar el historial.",
    );
  const periods = [
    ...new Set([rule.startDate.slice(0, 7), ...editableAffected.map((t) => t.month)]),
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
    tasks: s.tasks.filter((t) => !editableAffected.some((a) => a.id === t.id)),
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
