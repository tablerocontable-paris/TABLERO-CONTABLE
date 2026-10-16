import { describe, expect, it } from "vitest";
import { seed } from "../src/data/repository";
import { deadlineReminders, markDeadlineRemindersRead } from "../src/domain/deadlineNotifications";
import type { State, Task } from "../src/domain/model";

function taskFrom(state: State, id: string, due: string, extra: Partial<Task> = {}): Task {
  const source = state.tasks.find((task) => task.ownerId === "e0" && task.kind === "resultado")!;
  return {
    ...source,
    id,
    month: "2026-10",
    due,
    scheduledOn: due,
    status: "Pendiente",
    completedAt: null,
    blockedBy: "",
    blockedSince: null,
    ...extra,
  };
}

describe("avisos locales de vencimiento", () => {
  const today = "2026-10-07T15:00:00.000Z";

  it("groups tasks into three-days-before, due-today, and overdue windows", () => {
    const state = seed();
    state.activeId = "e0";
    state.tasks = [
      taskFrom(state, "due-1", "2026-10-10"),
      taskFrom(state, "due-2", "2026-10-10"),
      taskFrom(state, "today", "2026-10-07"),
      taskFrom(state, "late", "2026-10-06"),
      taskFrom(state, "completed", "2026-10-06", { status: "Completada", completedAt: today }),
      taskFrom(state, "invalid", "2026-02-30"),
    ];

    expect(deadlineReminders(state, today).map(({ rule, taskIds }) => ({ rule, taskIds }))).toEqual([
      { rule: "overdue-summary", taskIds: ["late"] },
      { rule: "due-today", taskIds: ["today"] },
      { rule: "due-in-three-days", taskIds: ["due-1", "due-2"] },
    ]);
  });

  it("uses the active profile's current work access and pauses the absent owner's alert", () => {
    const state = seed();
    const covered = taskFrom(state, "covered", "2026-10-06", { scheduledOn: "2026-10-07" });
    state.tasks = [covered];
    state.absences = [{
      id: "absence-1", ownerId: "e0", replacementId: "e1", from: "2026-10-07", to: "2026-10-07",
      kind: "Licencia", note: "Demo", createdBy: "boss", taskIds: [covered.id],
    }];

    expect(deadlineReminders({ ...state, activeId: "e0" }, today)).toEqual([]);
    expect(deadlineReminders({ ...state, activeId: "e1" }, today).flatMap((reminder) => reminder.taskIds)).toEqual(["covered"]);
    expect(deadlineReminders({ ...state, activeId: "e2" }, today)).toEqual([]);
    expect(deadlineReminders({ ...state, activeId: "m1" }, today).flatMap((reminder) => reminder.taskIds)).toEqual(["covered"]);
  });

  it("omits closed periods, keeps read state per recipient, and ignores stale read IDs", () => {
    const state = seed();
    state.activeId = "e0";
    const due = taskFrom(state, "due", "2026-10-10");
    state.tasks = [due];
    const initial = deadlineReminders(state, today);
    expect(initial).toHaveLength(1);

    const read = markDeadlineRemindersRead(state, [initial[0]!.id, "not-visible"], today, today);
    expect(deadlineReminders(read, today)[0]!.readAt).toBe(today);
    expect(deadlineReminders({ ...read, activeId: "boss" }, today)[0]!.readAt).toBeNull();

    const closed: State = {
      ...state,
      closures: [{ id: "closure", ownerId: "e0", month: "2026-10", at: today, by: "boss", metrics: {} as never, tasks: [], activity: [], note: "" }],
    };
    expect(deadlineReminders(closed, today)).toEqual([]);
    expect(deadlineReminders(state, "invalid-date")).toEqual([]);
  });
});
