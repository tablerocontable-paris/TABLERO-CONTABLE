import { canSee, id, isClosed, isResponsible, type State, type Task } from "./model";
import { canWork, coverageFor } from "./workforce";

export interface WorkNotification {
  id: string;
  recipientId: string;
  actorId: string;
  taskId: string;
  title: string;
  kind: "assigned" | "completed" | "changed" | "comment" | "joint";
  createdAt: string;
  readAt: string | null;
}
export interface TaskComment {
  id: string;
  taskId: string;
  actorId: string;
  content: string;
  createdAt: string;
}

function recipients(s: State, t: Task, actorId: string) {
  return s.profiles.filter(
    (p) =>
      p.active &&
      p.id !== actorId &&
      canWork(s, p, t),
  );
}
function taskConfigurationChanged(before: Task, after: Task) {
  const normalized = (task: Task) => ({
    title: task.title,
    ownerId: task.ownerId,
    due: task.due,
    scheduledOn: task.scheduledOn,
    status: task.status,
    weight: task.weight,
    target: task.target,
    blockedBy: task.blockedBy,
    checklist: task.checklist || [],
    availableFrom: task.availableFrom ?? null,
    dependsOnTaskIds: [...new Set(task.dependsOnTaskIds || [])].sort(),
    commercialTrackingEnabled: task.commercialTrackingEnabled === true,
  });
  return JSON.stringify(normalized(before)) !== JSON.stringify(normalized(after));
}
export function taskNotifications(
  s: State,
  t: Task,
  actorId: string,
  kind: WorkNotification["kind"],
  title: string,
  at = new Date().toISOString(),
): WorkNotification[] {
  return recipients(s, t, actorId).map((p) => ({
    id: id(),
    recipientId: p.id,
    actorId,
    taskId: t.id,
    kind,
    title,
    createdAt: at,
    readAt: null,
  }));
}

// Laboratory event generation. A production implementation must generate these
// on the server in the same transaction as the authorized change.
export function collectTaskNotifications(
  before: State,
  next: State,
  actorId: string,
): State {
  const actor = next.profiles.find((p) => p.id === actorId);
  if (!actor?.active) return next;
  const events: WorkNotification[] = [];
  const previous = new Map(before.tasks.map((t) => [t.id, t]));
  for (const t of next.tasks) {
    const old = previous.get(t.id);
    if (!canWork(next, actor, t)) continue;
    if (!old) {
      if (t.ownerId !== actorId)
        events.push(
          ...taskNotifications(
            next,
            t,
            actorId,
            "assigned",
            "Nueva tarea asignada",
          ),
        );
      continue;
    }
    if (!old.responsibility && t.responsibility) {
      events.push(...taskNotifications(next, t, actorId, "joint", "Tarea compartida con vos"));
      continue;
    }
    if (old.status !== "Completada" && t.status === "Completada") {
      events.push(
        ...taskNotifications(next, t, actorId, "completed", "Tarea completada"),
      );
    } else if (taskConfigurationChanged(old, t)) {
      events.push(
        ...taskNotifications(
          next,
          t,
          actorId,
          t.ownerId !== old.ownerId ? "assigned" : "changed",
          t.ownerId !== old.ownerId
            ? "Nueva tarea asignada"
            : "Tarea modificada",
        ),
      );
    }
  }
  for (const comment of next.taskComments || []) {
    if (
      (before.taskComments || []).some((c) => c.id === comment.id) ||
      comment.actorId !== actorId
    )
      continue;
    const t = next.tasks.find((t) => t.id === comment.taskId);
    if (t && canWork(next, actor, t))
      events.push(
        ...taskNotifications(
          next,
          t,
          actorId,
          "comment",
          "Nuevo comentario en la tarea",
        ),
      );
  }
  for (const activity of next.activity) {
    if (before.activity.some((a) => a.id === activity.id)) continue;
    const t = next.tasks.find((t) => t.id === activity.taskId);
    if (t && activity.actorId === actorId && canWork(next, actor, t))
      events.push(
        ...taskNotifications(
          next,
          t,
          actorId,
          activity.note.trim() ? "comment" : "changed",
          activity.note.trim()
            ? "Nueva anotación de actividad"
            : "Actividad registrada en la tarea",
        ),
      );
  }
  return events.length
    ? { ...next, notifications: [...(before.notifications || []), ...events] }
    : next;
}

export function visibleNotifications(s: State) {
  const actor = s.profiles.find((p) => p.id === s.activeId);
  if (!actor?.active) return [];
  return (s.notifications || [])
    .filter(
      (n) =>
        n.recipientId === actor.id &&
        s.tasks.some(
          (t) =>
            t.id === n.taskId &&
            canWork(s, actor, t),
        ),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addTaskComment(
  s: State,
  taskId: string,
  content: string,
): State {
  const actor = s.profiles.find((p) => p.id === s.activeId);
  const task = s.tasks.find((t) => t.id === taskId);
  const text = content.trim();
  const canManage = !!actor?.active && !!task && (
    s.companies.some((company) => company.id === task.companyId) && (actor.role === "jefe" || actor.companyIds.includes(task.companyId) && (
      actor.role === "encargado"
        ? canSee(actor, task.ownerId, s.profiles) || !!task.responsibility?.members.some((member) => canSee(actor, member.profileId, s.profiles))
        : isResponsible(task, actor.id) || coverageFor(s, task)?.replacementId === actor.id
    ))
  );
  if (
    !actor?.active ||
    !task ||
    !canManage ||
    isClosed(s, task)
  )
    throw Error("No tenés acceso a esta tarea.");
  if (!text || text.length > 2000)
    throw Error("Escribí un comentario de hasta 2000 caracteres.");
  return {
    ...s,
    taskComments: [
      ...(s.taskComments || []),
      {
        id: id(),
        taskId,
        actorId: actor.id,
        content: text,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}
