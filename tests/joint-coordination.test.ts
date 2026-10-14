// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { activateJointTask } from "../src/domain/coordination";
import { seed, persist, load } from "../src/data/repository";
import { checkTask, closeMonth, isClosed, metrics, metricsForProfile, transition } from "../src/domain/model";
import { actorElapsedSeconds, applyClock, canWork } from "../src/domain/workforce";
import { collectTaskNotifications, taskNotifications } from "../src/domain/notifications";

function setup() {
  const state = seed();
  const original = state.tasks.find((row) => row.ownerId === "e0" && row.kind === "resultado")!;
  const task = { ...original, assignmentId: null, templateId: null, status: "Pendiente" as const,
    startedAt: null, completedAt: null, blockedBy: "", blockedSince: null,
    checklist: [], sessions: [] };
  state.tasks = state.tasks.map((row) => row.id === task.id ? task : row);
  state.tasks = [task];
  state.activity = state.activity.filter((row) => row.taskId === task.id);
  return { state, task };
}
const request = (taskId: string, overrides = {}) => ({
  taskId, secondProfileId: "e1", anchorShareBps: 6000, reason: "Cierre conjunto de la conciliación",
  expectedRevision: 0, requestId: "joint-req-1", ...overrides,
});

describe("responsabilidad conjunta en laboratorio", () => {
  it("activa una única tarea con snapshot 60/40 y aviso deduplicado", () => {
    const { state, task } = setup();
    const activated = activateJointTask(state, request(task.id), "m1", "2026-10-06T10:00:00Z");
    expect(state.tasks.find((row) => row.id === task.id)?.responsibility).toBeUndefined();
    expect(activated.tasks.find((row) => row.id === task.id)?.responsibility?.members.map((m) => m.shareBps)).toEqual([6000, 4000]);
    expect(activated.tasks.find((row) => row.id === task.id)?.id).toBe(task.id);
    const withNotices = collectTaskNotifications(state, activated, "m1");
    expect(withNotices.notifications?.filter((n) => n.kind === "joint").map((n) => n.recipientId).sort()).toEqual(["boss", "e0", "e1"]);
    const replay = activateJointTask(withNotices, request(task.id), "m1");
    expect(replay).toBe(withNotices);
    expect(collectTaskNotifications(withNotices, replay, "m1").notifications).toEqual(withNotices.notifications);
    expect(() => activateJointTask(activated, request(task.id, { reason: "otro" }), "m1")).toThrow();
  });

  it("autoriza a ambos miembros puntualmente y reparte puntos sin duplicar el peso global", () => {
    const { state, task } = setup();
    const activated = activateJointTask(state, request(task.id), "m1");
    const shared = activated.tasks.find((row) => row.id === task.id)!;
    expect(canWork(activated, activated.profiles.find((p) => p.id === "e1")!, shared)).toBe(true);
    expect(canWork(activated, activated.profiles.find((p) => p.id === "e2")!, shared)).toBe(false);
    expect(metricsForProfile([shared], [], "e0").points).toBe(3);
    expect(metricsForProfile([shared], [], "e1").points).toBe(2);
    expect(metrics([shared], []).points).toBe(5);
  });

  it("mantiene consulta y avisos de jefatura en tareas conjuntas aunque no tenga membresía empresa directa", () => {
    const { state, task } = setup();
    const withoutCompany = {
      ...state,
      profiles: state.profiles.map((profile) => profile.id === "boss" ? { ...profile, companyIds: [] } : profile),
    };
    const activated = activateJointTask(withoutCompany, request(task.id), "m1");
    const shared = activated.tasks.find((row) => row.id === task.id)!;
    const boss = activated.profiles.find((profile) => profile.id === "boss")!;

    expect(canWork(activated, boss, shared)).toBe(true);
    expect(taskNotifications(activated, shared, "m1", "joint", "Tarea compartida")
      .map((notification) => notification.recipientId)).toContain("boss");
  });

  it("permite a jefatura activa compartir una tarea elegible sin membresía directa", () => {
    const { state, task } = setup();
    const withoutCompany = { ...state, profiles: state.profiles.map((profile) => profile.id === "boss" ? { ...profile, companyIds: [] } : profile) };
    const activated = activateJointTask(withoutCompany, request(task.id), "boss");
    expect(activated.tasks.find((row) => row.id === task.id)?.responsibility?.activatedBy).toBe("boss");
    const inactiveBoss = { ...withoutCompany, profiles: withoutCompany.profiles.map((profile) => profile.id === "boss" ? { ...profile, active: false } : profile) };
    expect(() => activateJointTask(inactiveBoss, request(task.id), "boss")).toThrow();
  });

  it("permite dos cronómetros, pausa sólo al actor y conserva tiempo separado", () => {
    const { state, task } = setup();
    let next = activateJointTask(state, request(task.id), "m1");
    next = applyClock(next, task.id, "e0", true, "2026-10-06T10:00:00Z");
    next = applyClock(next, task.id, "e1", true, "2026-10-06T10:00:10Z");
    next = applyClock(next, task.id, "e0", false, "2026-10-06T10:00:30Z");
    const shared = next.tasks.find((row) => row.id === task.id)!;
    expect(shared.sessions?.filter((row) => !row.end).map((row) => row.actorId)).toEqual(["e1"]);
    expect(actorElapsedSeconds(shared, "e0", "2026-10-06T10:00:40Z")).toBe(30);
    expect(actorElapsedSeconds(shared, "e1", "2026-10-06T10:00:40Z")).toBe(30);
  });

  it("completar detiene ambos relojes; reabrir conserva la historia sin arrancar al compañero", () => {
    const { state, task } = setup();
    let next = activateJointTask(state, request(task.id), "m1");
    const taskWithStep = { ...next.tasks[0], checklist: [{ id: "last", text: "Validar conciliación", done: false }] };
    next.tasks = [taskWithStep];
    next = applyClock(next, task.id, "e0", true, "2026-10-06T10:00:00Z");
    next = applyClock(next, task.id, "e1", true, "2026-10-06T10:00:10Z");
    const completed = checkTask(next.tasks[0], "last", true);
    expect(completed.status).toBe("Completada");
    expect(completed.sessions?.every((session) => !!session.end)).toBe(true);
    expect(new Set(completed.sessions?.map((session) => session.end)).size).toBe(1);
    const reopened = transition(completed, "En curso", "2026-10-06T12:00:00Z");
    expect(reopened.reopenCount).toBe(1);
    expect(reopened.sessions?.every((session) => !!session.end)).toBe(true);
  });

  it("cierra el período de cada miembro con la contribución propia y congela para ambos", () => {
    const { state, task } = setup();
    let next = activateJointTask(state, request(task.id), "m1");
    next = applyClock(next, task.id, "e0", true, "2026-10-06T10:00:00Z");
    next = applyClock(next, task.id, "e1", true, "2026-10-06T10:00:00Z");
    next = applyClock(next, task.id, "e0", false, "2026-10-06T11:00:00Z");
    next = applyClock(next, task.id, "e1", false, "2026-10-06T11:30:00Z");
    next.tasks = next.tasks.map((row) => row.id === task.id ? { ...row, status: "Completada", completedAt: "2026-10-06T12:00:00Z" } : row);
    next = closeMonth(next, "e0", task.month, "boss", "Validado A");
    const shared = next.tasks.find((row) => row.id === task.id)!;
    expect(isClosed(next, shared)).toBe(true);
    expect(next.closures[0].metrics.points).toBe(3);
    expect(next.closures[0].report?.schemaVersion).toBe(2);
    expect(next.closures[0].report?.recordedSeconds).toBe(3600);
    expect(next.closures[0].report?.contributions?.[0].shareBps).toBe(6000);
    next = closeMonth(next, "e1", task.month, "boss", "Validado B");
    expect(next.closures[1].metrics.points).toBe(2);
    expect(next.closures[1].report?.recordedSeconds).toBe(5400);
  });

  it("rechaza empleado activador, porcentaje inválido, recurrencia y miembros fuera del equipo del encargado", () => {
    const { state, task } = setup();
    expect(() => activateJointTask(state, request(task.id), "e0")).toThrow();
    expect(() => activateJointTask({ ...state, profiles: [...state.profiles, { ...state.profiles[0], id: "admin" }] }, request(task.id), "admin")).toThrow();
    expect(() => activateJointTask(state, request(task.id, { anchorShareBps: 10000 }), "m1")).toThrow();
    const recurring = { ...state, assignments: state.assignments.map((a) => a.ownerId === "e0" ? { ...a, id: task.assignmentId || "recurring", templateId: null, frequency: "mensual" as const } : a) };
    recurring.tasks = recurring.tasks.map((row) => row.id === task.id ? { ...row, assignmentId: "recurring" } : row);
    expect(() => activateJointTask(recurring, request(task.id), "m1")).toThrow();
    expect(() => activateJointTask(state, request(task.id, { secondProfileId: "e5" }), "m1")).toThrow();
  });

  it("rechaza activar una tarea si la empresa ya está cerrada para el segundo responsable", () => {
    const { state, task } = setup();
    state.companyClosures = [{
      id: "e1-c1-closed", ownerId: "e1", companyId: task.companyId, month: task.month,
      at: `${task.month}-20T12:00:00.000Z`, by: "boss", note: "Cierre parcial",
      metrics: metrics([], []), tasks: [], activity: [], coveredActivity: [], schemaVersion: 1,
    }];

    expect(() => activateJointTask(state, request(task.id), "m1")).toThrow(/cerrado/i);
    expect(state.tasks[0]?.responsibility).toBeUndefined();
  });

  it("persiste responsabilidad y recibos con validación de esquema", () => {
    const { state, task } = setup();
    const activated = activateJointTask(state, request(task.id), "m1");
    persist(activated, true);
    const restored = load(true);
    expect(restored.tasks.find((row) => row.id === task.id)?.responsibility?.members[1].profileId).toBe("e1");
    expect(restored.jointReceipts?.[0].requestId).toBe("joint-req-1");
  });
});
