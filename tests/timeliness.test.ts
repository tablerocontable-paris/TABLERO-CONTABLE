import { describe, expect, it } from "vitest";
import type { Activity, Task } from "../src/domain/model";
import { closeMonth, currentMonth, metrics, transition } from "../src/domain/model";
import { seed } from "../src/data/repository";
import { summarizeTimeliness, taskTimeliness } from "../src/domain/timeliness";

const task = (overrides: Partial<Task> = {}): Task => ({
  id: "bank-c1-october",
  assignmentId: "monthly-bank",
  title: "Conciliación bancaria",
  ownerId: "employee-a",
  companyId: "company-1",
  teamId: "team-a",
  sector: "Tesorería",
  month: "2026-10",
  due: "2026-10-10",
  kind: "resultado",
  weight: 5,
  unit: "",
  target: 0,
  status: "Completada",
  checklist: [],
  completedAt: "2026-10-08T15:00:00Z",
  startedAt: "2026-10-02T12:00:00Z",
  priority: "Media",
  blockedBy: "",
  blockedSince: null,
  ...overrides,
});
const activity = (
  id: string,
  qty: number,
  createdAt: string,
  date = "2026-10-08",
  taskId = "bank-c1-october",
): Activity => ({ id, taskId, qty, createdAt, date, actorId: "employee-a", note: "" });

describe("anticipación de plazos por ocurrencia", () => {
  it("mide días calendario usando fecha argentina, inclusive el día del plazo", () => {
    expect(taskTimeliness(task(), [], "2026-10-09T12:00:00Z")).toMatchObject({
      status: "early", daysAhead: 2,
    });
    const deadlineDay = task({ completedAt: "2026-10-10T03:00:00Z" });
    expect(taskTimeliness(deadlineDay, [], "2026-10-10T03:00:00Z")).toMatchObject({
      status: "on-date", daysAhead: 0,
    });
    expect(taskTimeliness(task({ completedAt: "2026-10-12T15:00:00Z" }), [], "2026-10-13T03:00:00Z")).toMatchObject({
      status: "late", daysAhead: -2,
    });
  });

  it("separa pendientes, vencidas, sin vencimiento y evidencia inválida", () => {
    expect(taskTimeliness(task({ status: "En curso", completedAt: null }), [], "2026-10-10T12:00:00Z").status).toBe("pending");
    expect(taskTimeliness(task({ status: "Pendiente", completedAt: null }), [], "2026-10-11T12:00:00Z").status).toBe("overdue");
    expect(taskTimeliness(task({ due: "" }), [], "2026-10-11T12:00:00Z").status).toBe("no-deadline");
    expect(taskTimeliness(task({ due: "2026-02-31" }), [], "2026-10-11T12:00:00Z").status).toBe("unknown");
    expect(taskTimeliness(task({ completedAt: null }), [], "2026-10-11T12:00:00Z").status).toBe("unknown");
  });

  it("toma el primer registro que alcanza la meta, nunca la fecha de trabajo declarada", () => {
    const operational = task({ kind: "operativa", target: 10, unit: "facturas", status: "En curso", completedAt: null });
    const entries = [
      activity("second", 6, "2026-10-08T13:00:00Z"),
      activity("first", 4, "2026-10-07T13:00:00Z"),
      activity("other-task", 99, "2026-10-06T12:00:00Z", "2026-10-06", "another"),
    ];
    expect(taskTimeliness(operational, entries, "2026-10-09T12:00:00Z")).toMatchObject({
      status: "early", daysAhead: 2, evidence: "registered-target", achievementAt: "2026-10-08T13:00:00Z",
    });
    const lateEntered = [activity("late", 10, "2026-10-12T12:00:00Z", "2026-10-08")];
    expect(taskTimeliness(operational, lateEntered, "2026-10-10T12:00:00Z").status).toBe("unknown");
    expect(taskTimeliness(operational, lateEntered, "2026-10-13T12:00:00Z").status).toBe("late");
  });

  it("da denominadores separados y no duplica una misma ocurrencia", () => {
    const early = task();
    const same = { ...early, companyId: "company-2" };
    const onTime = task({ id: "same-bank-separate-occurrence", completedAt: "2026-10-10T12:00:00Z" });
    const operational = task({ id: "operations", kind: "operativa", target: 10, status: "En curso", completedAt: null });
    const result = summarizeTimeliness([early, same, onTime, operational], [], "2026-10-11T12:00:00Z");
    expect(result.results).toMatchObject({ evaluated: 2, early: 1, onDate: 1, earlyRate: 50 });
    expect(result.operational).toMatchObject({ evaluated: 0, overdue: 1, earlyRate: null });
    expect(result.total).toMatchObject({ evaluated: 2, early: 1, onDate: 1, overdue: 1 });
    expect(metrics([early], [], "2026-10-09", "2026-10-09T12:00:00Z").timeliness?.results.early).toBe(1);
  });

  it("no cambia la fecha al volver a completar y respeta la reapertura explícita", () => {
    const completed = task();
    expect(transition(completed, "Completada", "2026-10-09T13:00:00Z")).toBe(completed);
    const reopened = transition(completed, "En curso", "2026-10-09T13:00:00Z");
    expect(reopened.completedAt).toBeNull();
    expect(reopened.reopenCount).toBe(1);
    const completedAgain = transition(reopened, "Completada", "2026-10-11T13:00:00Z");
    expect(taskTimeliness(completedAgain, [], "2026-10-12T13:00:00Z")).toMatchObject({ status: "late", daysAhead: -1 });
    expect(taskTimeliness(completed, [], "2026-10-12T13:00:00Z").daysAhead).toBe(2);
  });

  it("congela el indicador nuevo en el snapshot de cierre y su reporte", () => {
    const state = seed();
    const month = currentMonth();
    state.assignments = [];
    state.tasks = [task({
      ownerId: "e0",
      companyId: "c1",
      teamId: "t1",
      month,
      due: "9999-12-31",
      completedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    })];
    state.activity = [];
    const closed = closeMonth(state, "e0", month, "boss", "Revisado");
    const snapshot = closed.closures[0]!.metrics.timeliness;
    expect(snapshot?.results.early).toBe(1);
    expect(closed.closures[0]!.report?.groups[0]?.metrics.timeliness?.results.early).toBe(1);
    closed.tasks[0]!.due = "2020-01-01";
    expect(closed.closures[0]!.metrics.timeliness).toEqual(snapshot);
  });
});
