// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { seed, load, persist } from "../src/data/repository";
import { materialize, currentMonth } from "../src/domain/model";
import { defaultSchedule } from "../src/domain/schedule";
import {
  approveHabitualTaskProposals,
  groupHabitualTaskProposals,
  requestHabitualProposalChanges,
  resubmitHabitualTaskProposal,
  submitHabitualTaskProposal,
} from "../src/domain/habitualTaskProposals";

const fixedNow = "2026-10-07T12:00:00.000Z";
const proposalInput = (overrides: Partial<Parameters<typeof submitHabitualTaskProposal>[2]> = {}) => ({
  id: "proposal-a",
  companyId: "c1",
  title: "Conciliación bancaria",
  process: "Banco Nación",
  description: "Comparar los movimientos bancarios y dejar las diferencias documentadas.",
  kind: "resultado" as const,
  unit: "",
  target: 0,
  schedule: defaultSchedule("2026-10-10", "mensual"),
  steps: ["Descargar extracto", "Comparar movimientos"],
  ...overrides,
});

beforeEach(() => localStorage.clear());

describe("propuestas de tareas habituales del laboratorio", () => {
  it("conserva propuestas pendientes y sólo agrupa coincidencias como sugerencias", () => {
    let state = seed();
    state.assignments = [];
    state.tasks = [];
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    state = submitHabitualTaskProposal(state, employee, proposalInput({ id: "first", title: "CONC BNA EMPRESA 1", process: "" }), fixedNow, () => "history-1");
    state = submitHabitualTaskProposal(state, state.profiles.find((profile) => profile.id === "e1")!, proposalInput({ id: "second", companyId: "c2", title: "CONCILIACION BANCO NACION E2", process: "" }), fixedNow, () => "history-2");

    const groups = groupHabitualTaskProposals(state.habitualTaskProposals || []);
    expect(groups).toHaveLength(1);
    expect(groups[0].suggestedMatch).toBe(true);
    expect(groups[0].proposals.map((proposal) => proposal.companyId).sort()).toEqual(["c1", "c2"]);
    expect(state.habitualTaskProposals?.every((proposal) => proposal.status === "pending")).toBe(true);
    expect(state.assignments).toHaveLength(0);
    expect(state.tasks).toHaveLength(0);
  });

  it("separa coincidencias cuando cambia el banco o el tipo de actividad", () => {
    let state = seed();
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    state = submitHabitualTaskProposal(state, employee, proposalInput({ id: "nation", title: "Conciliación", process: "Banco Nación" }), fixedNow);
    state = submitHabitualTaskProposal(state, state.profiles.find((profile) => profile.id === "e1")!, proposalInput({ id: "santander", companyId: "c2", title: "Conciliación", process: "Banco Santander" }), fixedNow);
    state = submitHabitualTaskProposal(state, state.profiles.find((profile) => profile.id === "e2")!, proposalInput({ id: "operativa", companyId: "c3", title: "Conciliación", process: "Banco Nación", kind: "operativa", unit: "facturas", target: 25 }), fixedNow);
    const groups = groupHabitualTaskProposals(state.habitualTaskProposals || []);
    expect(groups).toHaveLength(3);
    expect(groups.every((group) => !group.suggestedMatch)).toBe(true);
  });

  it("solicita correcciones con motivo y conserva todas las revisiones del empleado", () => {
    let state = seed();
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    const manager = state.profiles.find((profile) => profile.id === "boss")!;
    state = submitHabitualTaskProposal(state, employee, proposalInput(), fixedNow, () => "submitted");
    expect(() => requestHabitualProposalChanges(state, state.profiles.find((profile) => profile.id === "m1")!, "proposal-a", "Aclarar fuente", fixedNow)).toThrow(/Sólo jefatura/);
    state = requestHabitualProposalChanges(state, manager, "proposal-a", "Aclarar de qué cuenta se toma el extracto.", fixedNow, () => "request");
    expect(state.habitualTaskProposals?.[0]).toMatchObject({ status: "changes_requested", managerNote: "Aclarar de qué cuenta se toma el extracto." });
    state = resubmitHabitualTaskProposal(state, employee, "proposal-a", proposalInput({ title: "Conciliación Banco Nación por cuenta", schedule: defaultSchedule("2026-10-10", "semanal") }), "2026-10-08T12:00:00.000Z", () => "resubmit");
    expect(state.habitualTaskProposals?.[0]).toMatchObject({ status: "pending", revision: 2, originalTitle: "Conciliación bancaria", title: "Conciliación Banco Nación por cuenta" });
    expect(state.habitualTaskProposals?.[0].submissions).toHaveLength(2);
    expect(state.habitualTaskProposals?.[0].history.map((entry) => entry.action)).toEqual(["submitted", "changes_requested", "resubmitted"]);
  });

  it("rechaza reenviar una propuesta si la empresa fue revocada y no altera su historial", () => {
    let state = seed();
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    const boss = state.profiles.find((profile) => profile.id === "boss")!;
    state = submitHabitualTaskProposal(state, employee, proposalInput(), fixedNow);
    state = requestHabitualProposalChanges(state, boss, "proposal-a", "Aclarar el alcance del control.", fixedNow);
    const revokedActor = { ...employee, companyIds: employee.companyIds.filter((companyId) => companyId !== "c1") };
    const revoked = { ...state, profiles: state.profiles.map((profile) => profile.id === employee.id ? revokedActor : profile) };
    expect(() => resubmitHabitualTaskProposal(revoked, revokedActor, "proposal-a", proposalInput({ title: "Título corregido" }), fixedNow)).toThrow(/empresa.*ya no está asignada/i);
    expect(() => resubmitHabitualTaskProposal(revoked, employee, "proposal-a", proposalInput({ title: "Título corregido" }), fixedNow)).toThrow(/empresa.*ya no está asignada/i);
    expect(revoked.habitualTaskProposals).toEqual(state.habitualTaskProposals);
  });

  it("aprueba operativas en asignaciones separadas sin metas mensuales", () => {
    let state = seed();
    state.assignments = [];
    state.tasks = [];
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    state = submitHabitualTaskProposal(state, employee, proposalInput({ id: "invoice-c1", companyId: "c1", title: "Carga de facturas", process: "", kind: "operativa", unit: "facturas", target: 45, schedule: defaultSchedule("2026-10-08", "diaria") }), fixedNow);
    state = submitHabitualTaskProposal(state, employee, proposalInput({ id: "invoice-c2", companyId: "c2", title: "Carga de facturas", process: "", kind: "operativa", unit: "facturas", target: 90, schedule: defaultSchedule("2026-10-09", "semanal") }), fixedNow);
    const manager = state.profiles.find((profile) => profile.id === "boss")!;
    const month = currentMonth();

    state = approveHabitualTaskProposals(state, manager, ["invoice-c1", "invoice-c2"], { kind: "link", templateId: "cat3" }, month, fixedNow, () => "version-snapshot");
    expect(state.assignments).toHaveLength(2);
    expect(state.assignments.map((assignment) => [assignment.companyId, assignment.target, assignment.frequency]).sort()).toEqual([
      ["c1", 0, "diaria"], ["c2", 0, "semanal"],
    ]);
    expect(state.assignments.every((assignment) => assignment.templateId === "cat3" && assignment.templateVersion === 1)).toBe(true);
    expect(state.habitualTaskProposals?.every((proposal) => proposal.status === "approved")).toBe(true);
    expect(() => approveHabitualTaskProposals(state, manager, ["invoice-c1", "invoice-c2"], { kind: "link", templateId: "cat3" }, month, fixedNow)).toThrow(/pendientes/);
    state = materialize(state, month);
    expect(state.tasks.filter((task) => task.assignmentId?.startsWith("habitual-proposal-assignment:")).length).toBeGreaterThan(2);
    expect(new Set(state.tasks.filter((task) => task.assignmentId?.startsWith("habitual-proposal-assignment:")).map((task) => task.companyId))).toEqual(new Set(["c1", "c2"]));
  });

  it("crea un estándar versionado y no permite activar propuestas como empleado", () => {
    let state = seed();
    state.assignments = [];
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    state = submitHabitualTaskProposal(state, employee, proposalInput({ id: "proposal-new", title: "Control de retenciones", process: "SICORE" }), fixedNow);
    const standard = {
      title: "Control de retenciones SICORE", sector: "Impuestos", description: "Revisar retenciones antes del cierre.",
      kind: "resultado" as const, unit: "", weight: 4, target: 0, steps: ["Comparar comprobantes", "Controlar saldos"],
    };
    const proposal = state.habitualTaskProposals![0];
    expect(() => approveHabitualTaskProposals(state, employee, [proposal.id], { kind: "create", template: standard }, currentMonth(), fixedNow)).toThrow(/Sólo jefatura/);
    let generatedId = 0;
    state = approveHabitualTaskProposals(state, state.profiles.find((profile) => profile.id === "boss")!, [proposal.id], { kind: "create", template: standard }, currentMonth(), fixedNow, () => `generated-${++generatedId}`);
    const created = state.templates.find((template) => template.title === standard.title)!;
    expect(created.title).toBe(standard.title);
    expect(state.catalogueVersions?.find((version) => version.templateId === created.id)).toMatchObject({ version: 1, createdBy: "boss", source: "catalog_change" });
    expect(state.assignments[0]).toMatchObject({ templateId: created.id, templateVersion: 1, ownerId: "e0", companyId: "c1" });
  });

  it("rechaza empresas ajenas y conserva payloads anteriores sin la colección nueva", () => {
    const state = seed();
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    expect(() => submitHabitualTaskProposal(state, employee, proposalInput({ companyId: "outside" }), fixedNow)).toThrow(/empresa ya no está asignada/);
    const oldPayload = { ...state };
    delete oldPayload.habitualTaskProposals;
    persist(oldPayload, true);
    expect(load(true).habitualTaskProposals).toBeUndefined();
  });

  it("persiste el historial tipado de propuestas en el almacenamiento del laboratorio", () => {
    let state = seed();
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    state = submitHabitualTaskProposal(state, employee, proposalInput(), fixedNow);
    persist(state, true);
    expect(load(true).habitualTaskProposals?.[0]).toMatchObject({ id: "proposal-a", status: "pending", submissions: [{ revision: 1 }], history: [{ action: "submitted" }] });
  });
});
