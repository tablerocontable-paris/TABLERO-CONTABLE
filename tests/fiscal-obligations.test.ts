import { describe, expect, it } from "vitest";
import { seed } from "../src/data/repository";
import {
  canManageFiscalObligation,
  createFiscalObligation,
  fiscalObligationStatus,
  seedFiscalObligations,
  updateFiscalObligation,
  visibleFiscalObligations,
  type FiscalObligationInput,
} from "../src/domain/fiscalObligations";

function setup() {
  const state = seed();
    const tasks = state.tasks.filter((task) => task.companyId === "c2" && task.kind === "resultado");
  expect(tasks.length).toBeGreaterThanOrEqual(2);
  return { state, tasks };
}

function input(companyId = "c2", requiredTaskIds: string[] = []): FiscalObligationInput {
  return {
    companyId, obligationCode: "iva-mensual", title: "IVA mensual",
    fiscalPeriod: "2026-09", milestone: "presentation", dueOn: "2026-10-20",
    sourceLabel: "Dato ficticio", sourceRevision: "DEMO-01", sourceCheckedAt: null,
    requiredTaskIds,
  };
}

function setCompleted(state: ReturnType<typeof seed>, taskIds: string[], completedAt: string) {
  state.tasks = state.tasks.map((task) => taskIds.includes(task.id)
    ? { ...task, status: "Completada", completedAt, blockedBy: "", blockedSince: null }
    : task);
}

describe("agenda de obligaciones de empresa en laboratorio", () => {
  it("distingue período fiscal de vencimiento y conserva sólo muestras ficticias", () => {
    const { state } = setup();
    const samples = seedFiscalObligations(state, "2026-10");
    expect(samples.map((row) => row.fiscalPeriod)).toEqual(["2026-09", "2026-09"]);
    expect(samples.map((row) => row.dueOn)).toEqual(["2026-10-20", "2026-10-25"]);
    expect(samples.every((row) => row.evaluationVersion === 2 && row.sourceLabel.includes("ficticio") && row.requiredTaskIds.every((id) => state.tasks.some((task) => task.id === id && task.kind === "resultado")))).toBe(true);
  });

  it("calcula el hito sólo cuando todas las tareas exactas están completas y al reabrir vuelve a pendiente", () => {
    const { state, tasks } = setup();
    const taskIds = tasks.slice(0, 2).map((task) => task.id);
    state.tasks = state.tasks.map((task) => taskIds.includes(task.id)
      ? { ...task, status: "Pendiente", completedAt: null }
      : task);
    const created = createFiscalObligation(state, input("c2", taskIds), "boss", "2026-10-01T12:00:00.000Z");
    const event = created.fiscalObligations![0]!;
    expect(fiscalObligationStatus(created, event, "2026-11-01T12:00:00.000Z")).toBe("pending");
    setCompleted(created, taskIds, "2026-10-20T22:00:00.000Z");
    expect(fiscalObligationStatus(created, event, "2026-11-01T12:00:00.000Z")).toBe("completed_on_time");
    setCompleted(created, [taskIds[1]!], "2026-10-21T03:01:00.000Z");
    expect(fiscalObligationStatus(created, event, "2026-11-01T12:00:00.000Z")).toBe("completed_late");
    created.tasks = created.tasks.map((task) => task.id === taskIds[1]
      ? { ...task, status: "Pendiente", completedAt: null }
      : task);
    expect(fiscalObligationStatus(created, event, "2026-11-01T12:00:00.000Z")).toBe("pending");
  });

  it("rechaza operativas nuevas y conserva el cálculo de metas sólo en obligaciones históricas", () => {
    const { state } = setup();
    const task = state.tasks.find((row) => row.companyId === "c3" && row.title === "Carga de facturas")!;
    expect(() => createFiscalObligation(state, input("c3", [task.id]), "boss", "2026-10-01T12:00:00.000Z")).toThrow(/entregables verificables/);
    const created = createFiscalObligation(state, input("c3", []), "boss", "2026-10-01T12:00:00.000Z");
    const current = created.fiscalObligations![0]!;
    const event = { ...current, requiredTaskIds: [task.id] };
    delete event.evaluationVersion;
    created.fiscalObligations = [event];
    const currentQty = created.activity.filter((row) => row.taskId === task.id).reduce((sum, row) => sum + row.qty, 0);
    created.activity.push({ id: "obligation-target-evidence", taskId: task.id, qty: task.target - currentQty, date: "2026-10-20", note: "Evidencia ficticia", actorId: task.ownerId, createdAt: "2026-10-20T15:00:00.000Z" });
    expect(fiscalObligationStatus(created, event, "2026-11-01T12:00:00.000Z")).toBe("completed_on_time");
    expect(createFiscalObligation(state, input("c3", []), "boss").fiscalObligations?.at(-1)?.evaluationVersion).toBe(2);
  });

  it("conserva vínculos operativos legacy al revisar y no permite agregar otros", () => {
    const { state } = setup();
    const operationalTasks = state.tasks.filter((row) => row.companyId === "c3" && row.kind === "operativa");
    expect(operationalTasks.length).toBeGreaterThan(1);
    const created = createFiscalObligation(state, input("c3", []), "boss", "2026-10-01T12:00:00.000Z");
    const historical = { ...created.fiscalObligations![0]!, requiredTaskIds: [operationalTasks[0]!.id] };
    delete historical.evaluationVersion;
    const legacyState = { ...created, fiscalObligations: [historical] };
    const revisited = updateFiscalObligation(legacyState, historical.id, {
      dueOn: historical.dueOn, sourceLabel: historical.sourceLabel,
      sourceRevision: "DEMO-02", sourceCheckedAt: null,
      requiredTaskIds: [operationalTasks[0]!.id], reason: "Conserva vínculo histórico",
    }, "boss", "2026-10-02T12:00:00.000Z");
    expect(revisited.fiscalObligations![0]!.evaluationVersion).toBeUndefined();
    expect(revisited.fiscalObligations![0]!.requiredTaskIds).toEqual([operationalTasks[0]!.id]);
    expect(revisited.fiscalObligations![0]!.history[0]!.evaluationVersion).toBe(1);
    expect(() => updateFiscalObligation(legacyState, historical.id, {
      dueOn: historical.dueOn, sourceLabel: historical.sourceLabel,
      sourceRevision: "DEMO-02", sourceCheckedAt: null,
      requiredTaskIds: operationalTasks.map((task) => task.id), reason: "Agrega tarea operativa",
    }, "boss")).toThrow(/entregables verificables/);
  });

  it("rechaza empresas mezcladas, fechas inválidas y claves duplicadas", () => {
    const { state, tasks } = setup();
    const wrongCompanyTask = state.tasks.find((task) => task.companyId === "c1")!;
    expect(() => createFiscalObligation(state, input("c2", [wrongCompanyTask.id]), "boss")).toThrow(/misma empresa/);
    expect(() => createFiscalObligation(state, { ...input(), fiscalPeriod: "2026-13" }, "boss")).toThrow(/período fiscal/);
    expect(() => createFiscalObligation(state, { ...input(), dueOn: "2026-02-30" }, "boss")).toThrow(/fecha de vencimiento/);
    expect(() => createFiscalObligation(state, input("c2", [tasks[0]!.id, tasks[0]!.id]), "boss")).toThrow(/No repitas/);
    const created = createFiscalObligation(state, input(), "boss");
    expect(() => createFiscalObligation(created, { ...input(), obligationCode: "IVA-MENSUAL" }, "boss")).toThrow(/Ya existe/);
  });

  it("aplica alcance por empresa y tareas, y sólo jefatura ve hitos sin responsable", () => {
    const { state, tasks } = setup();
    const unassigned = createFiscalObligation(state, input(), "boss");
    const event = unassigned.fiscalObligations![0]!;
    expect(fiscalObligationStatus(unassigned, event)).toBe("unassigned");
    expect(visibleFiscalObligations(unassigned, "boss", "2026-10", "c2")).toHaveLength(1);
    expect(visibleFiscalObligations(unassigned, "e0", "2026-10", "c2")).toHaveLength(0);
    expect(canManageFiscalObligation(unassigned, "e0", "c2", [])).toBe(false);
    expect(canManageFiscalObligation(unassigned, "e0", "c2", [tasks.find((task) => task.ownerId === "e0")!.id])).toBe(true);
    const linked = createFiscalObligation(state, input("c2", [tasks.find((task) => task.ownerId === "e0")!.id]), "boss");
    expect(visibleFiscalObligations(linked, "e0", "2026-10", "c2")).toHaveLength(1);
    expect(visibleFiscalObligations(linked, "e1", "2026-10", "c2")).toHaveLength(0);
  });

  it("permite consulta y gestión organizacional de jefatura sin membresía directa, y revalida al encargado", () => {
    const { state, tasks } = setup();
    const bossWithoutMembership = { ...state.profiles.find((profile) => profile.id === "boss")!, companyIds: [] };
    const bossState = { ...state, profiles: state.profiles.map((profile) => profile.id === "boss" ? bossWithoutMembership : profile) };
    expect(canManageFiscalObligation(bossState, bossWithoutMembership.id, "c2", [])).toBe(true);
    const created = createFiscalObligation(bossState, input("c2", []), bossWithoutMembership.id);
    expect(visibleFiscalObligations(created, bossWithoutMembership.id, "2026-10", "c2")).toHaveLength(1);
    expect(visibleFiscalObligations({ ...created, companies: created.companies.filter((company) => company.id !== "c2") }, bossWithoutMembership.id, "2026-10", "c2")).toHaveLength(0);
    const manager = state.profiles.find((profile) => profile.id === "m1")!;
    const task = tasks.find((row) => row.ownerId === "e0")!;
    const revoked = { ...state, profiles: state.profiles.map((profile) => profile.id === manager.id ? { ...profile, companyIds: profile.companyIds.filter((companyId) => companyId !== "c2") } : profile) };
    expect(canManageFiscalObligation(revoked, manager.id, "c2", [task.id])).toBe(false);
  });

  it("versiona cambios de fuente/vencimiento y conserva la identidad del hito", () => {
    const { state } = setup();
    const created = createFiscalObligation(state, input(), "boss", "2026-10-01T12:00:00.000Z");
    const event = created.fiscalObligations![0]!;
    const revised = updateFiscalObligation(created, event.id, {
      dueOn: "2026-10-22", sourceLabel: "Resolución de ejemplo", sourceRevision: "DEMO-02",
      sourceCheckedAt: "2026-10-05", requiredTaskIds: [], reason: "Se corrige la muestra",
    }, "boss", "2026-10-05T12:00:00.000Z");
    expect(revised.fiscalObligations![0]).toMatchObject({ revision: 2, dueOn: "2026-10-22", sourceRevision: "DEMO-02" });
    expect(revised.fiscalObligations![0]!.history).toHaveLength(1);
    expect(revised.fiscalObligations![0]!.evaluationVersion).toBe(2);
    expect(revised.fiscalObligations![0]!.history[0]!.evaluationVersion).toBe(2);
    expect(() => updateFiscalObligation(created, event.id, {
      dueOn: "2026-10-22", sourceLabel: "Dato ficticio", sourceRevision: "DEMO-01",
      sourceCheckedAt: null, requiredTaskIds: [], reason: "No soy jefe",
    }, "e1")).toThrow(/permisos/);
  });
});
