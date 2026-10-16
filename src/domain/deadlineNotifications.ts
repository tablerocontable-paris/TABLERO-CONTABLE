import { canWork, absenceForTask } from "./workforce";
import { dateART, isClosed, type State } from "./model";
import { validDate } from "./schedule";

export type DeadlineReminderRule = "due-in-three-days" | "due-today" | "overdue-summary";

export interface DeadlineReminder {
  id: string;
  recipientId: string;
  rule: DeadlineReminderRule;
  taskIds: string[];
  title: string;
  createdAt: string;
  readAt: string | null;
}

function dayNumber(value: string): number | null {
  if (!validDate(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function deadlineReminders(state: State, asOfISO: string): DeadlineReminder[] {
  if (!Number.isFinite(Date.parse(asOfISO))) return [];
  const actor = state.profiles.find((profile) => profile.id === state.activeId && profile.active);
  if (!actor) return [];

  const today = dateART(asOfISO);
  const todayNumber = dayNumber(today);
  if (todayNumber === null) return [];

  const grouped: Record<DeadlineReminderRule, string[]> = {
    "due-in-three-days": [],
    "due-today": [],
    "overdue-summary": [],
  };
  const eligible = state.tasks.filter((task) =>
    task.status !== "Completada" &&
    validDate(task.due) &&
    !isClosed(state, task) &&
    canWork(state, actor, task, today) &&
    // A personal reminder pauses during an active absence. The selected,
    // authorized replacement can still receive it through canWork().
    !(task.ownerId === actor.id && absenceForTask(state, task, today)),
  );

  for (const task of eligible) {
    const due = dayNumber(task.due);
    if (due === null) continue;
    const daysUntilDue = due - todayNumber;
    if (daysUntilDue === 3) grouped["due-in-three-days"].push(task.id);
    else if (daysUntilDue === 0) grouped["due-today"].push(task.id);
    else if (daysUntilDue < 0) grouped["overdue-summary"].push(task.id);
  }

  const rules: Array<{ rule: DeadlineReminderRule; title: (count: number) => string }> = [
    { rule: "overdue-summary", title: (count) => `${count} tarea${count === 1 ? "" : "s"} vencida${count === 1 ? "" : "s"}` },
    { rule: "due-today", title: (count) => `${count} tarea${count === 1 ? "" : "s"} vence${count === 1 ? "" : "n"} hoy` },
    { rule: "due-in-three-days", title: (count) => `${count} tarea${count === 1 ? "" : "s"} vence${count === 1 ? "" : "n"} en 3 días` },
  ];

  return rules.flatMap(({ rule, title }) => {
    const taskIds = grouped[rule].sort((a, b) => {
      const taskA = state.tasks.find((task) => task.id === a)!;
      const taskB = state.tasks.find((task) => task.id === b)!;
      return taskA.due.localeCompare(taskB.due) || taskA.title.localeCompare(taskB.title, "es");
    });
    if (!taskIds.length) return [];
    const id = `deadline:${actor.id}:${rule}:${today}`;
    return [{
      id,
      recipientId: actor.id,
      rule,
      taskIds,
      title: title(taskIds.length),
      createdAt: asOfISO,
      readAt: state.deadlineReminderReads?.[id] || null,
    }];
  });
}

export function markDeadlineRemindersRead(
  state: State,
  reminderIds: string[],
  asOfISO: string,
  readAt = new Date().toISOString(),
): State {
  const current = new Set(deadlineReminders(state, asOfISO).map((reminder) => reminder.id));
  const eligible = [...new Set(reminderIds)].filter((id) => current.has(id));
  if (!eligible.length) return state;

  const reads = { ...(state.deadlineReminderReads || {}) };
  let changed = false;
  for (const id of eligible) {
    if (reads[id]) continue;
    reads[id] = readAt;
    changed = true;
  }
  return changed ? { ...state, deadlineReminderReads: reads } : state;
}
