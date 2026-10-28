// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { seed, load, persist, createLaboratoryBackup, inspectLaboratoryBackup } from "../src/data/repository";
import { materialize, currentMonth } from "../src/domain/model";
import { defaultSchedule } from "../src/domain/schedule";
import { NEUTRAL_STARTER_SUGGESTIONS } from "../src/domain/neutralStarterCatalog";
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
    state.activity = [];
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

  it("separa tareas canónicas por unidad de negocio y parámetros analíticos", () => {
    let state = seed();
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    const common = {
      title: "Conciliación bancaria", process: "", taskCode: "gpar_bank_reconciliation",
      taskCatalogVersion: 2, taskParameters: { banco: "Banco Francés", cuenta: "Cuenta principal" },
    };
    state = submitHabitualTaskProposal(state, employee, proposalInput({ id: "recon-pa", ...common, businessUnitCode: "paris_autos" }), fixedNow);
    state = submitHabitualTaskProposal(state, employee, proposalInput({ id: "recon-doral", ...common, businessUnitCode: "doral" }), fixedNow);
    state = submitHabitualTaskProposal(state, employee, proposalInput({ id: "recon-pa-secondary", ...common, businessUnitCode: "paris_autos", taskParameters: { banco: "Banco Francés", cuenta: "Cuenta secundaria" } }), fixedNow);
    const groups = groupHabitualTaskProposals(state.habitualTaskProposals || []);
    expect(groups).toHaveLength(3);
    expect(groups.every((group) => group.proposals.length === 1)).toBe(true);
  });

  it("exige banco y cuenta para identificar una conciliación bancaria", () => {
    const state = seed();
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    expect(() => submitHabitualTaskProposal(state, employee, proposalInput({
      taskCode: "gpar_bank_reconciliation", taskCatalogVersion: 2, businessUnitCode: "paris_autos",
    }), fixedNow)).toThrow(/datos obligatorios/);
  });

  it("rechaza restaurar una propuesta canónica con datos analíticos obligatorios incompletos", () => {
    let state = seed();
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    state = submitHabitualTaskProposal(state, employee, proposalInput({
      taskCode: "gpar_bank_reconciliation", taskCatalogVersion: 2,
      businessUnitCode: "paris_autos", taskParameters: { banco: "Banco Francés", cuenta: "Cuenta principal" },
    }), fixedNow);
    state.habitualTaskProposals![0]!.taskParameters = {};
    expect(() => inspectLaboratoryBackup(createLaboratoryBackup(state))).toThrow(/compatible/);
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

  it("conserva el concepto neutral desde sugerencia hasta catálogo, asignación, tarea y persistencia", () => {
    let state = seed();
    state.assignments = [];
    state.tasks = [];
    state.activity = [];
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    const manager = state.profiles.find((profile) => profile.id === "boss")!;
    const starter = NEUTRAL_STARTER_SUGGESTIONS[0]!;
    state = submitHabitualTaskProposal(state, employee, proposalInput({
      id: "starter-bank-recon", starterId: starter.id,
      neutralConceptCode: starter.neutralConceptCode, taxonomyVersion: starter.taxonomyVersion,
      title: starter.title, process: "",
    }), fixedNow);
    expect(state.habitualTaskProposals?.[0]).toMatchObject({
      starterId: starter.id, neutralConceptCode: "bank_reconciliation", taxonomyVersion: 2,
      submissions: [{ starterId: starter.id, neutralConceptCode: "bank_reconciliation", taxonomyVersion: 2 }],
    });

    state = approveHabitualTaskProposals(state, manager, ["starter-bank-recon"], {
      kind: "create", template: {
        title: "Conciliación bancaria estándar", sector: "Tesorería",
        description: "Comparar movimientos y documentar diferencias.", kind: "resultado",
        unit: "", weight: 3, target: 0, steps: ["Comparar movimientos"],
      },
    }, "2026-10", fixedNow, (() => { let next = 0; return () => `bank-id-${++next}`; })());
    const templateId = state.habitualTaskProposals?.[0]?.templateId;
    const template = state.templates.find((row) => row.id === templateId)!;
    expect(template).toMatchObject({ neutralConceptCode: "bank_reconciliation", taxonomyVersion: 2 });
    expect(state.catalogueVersions?.find((row) => row.templateId === template.id)).toMatchObject({
      neutralConceptCode: "bank_reconciliation", taxonomyVersion: 2,
    });
    expect(state.assignments[0]).toMatchObject({ neutralConceptCode: "bank_reconciliation", taxonomyVersion: 2 });

    state = materialize(state, "2026-10");
    expect(state.tasks.find((task) => task.assignmentId === state.assignments[0]?.id)).toMatchObject({
      neutralConceptCode: "bank_reconciliation", taxonomyVersion: 2,
    });
    persist(state, true);
    expect(load(true).tasks.find((task) => task.assignmentId === state.assignments[0]?.id)).toMatchObject({
      neutralConceptCode: "bank_reconciliation", taxonomyVersion: 2,
    });
  });

  it("rechaza una clasificación que contradice el ID inmutable de la sugerencia", () => {
    const state = seed();
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    const starter = NEUTRAL_STARTER_SUGGESTIONS[0]!;
    expect(() => submitHabitualTaskProposal(state, employee, proposalInput({
      starterId: starter.id, neutralConceptCode: "payment_processing", taxonomyVersion: 2,
    }), fixedNow)).toThrow(/no corresponde a la sugerencia/);
    expect(state.habitualTaskProposals).toBeUndefined();
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

  it("conserva el código canónico y la unidad de negocio desde la selección hasta la tarea materializada", () => {
    let state = seed();
    state.assignments = [];
    state.tasks = [];
    state.activity = [];
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    const manager = state.profiles.find((profile) => profile.id === "boss")!;
    const canonical = proposalInput({
      id: "paris-bank-recon", title: "Conciliación bancaria", process: "",
      taskCode: "gpar_bank_reconciliation", taskCatalogVersion: 2, businessUnitCode: "paris_autos",
      taskParameters: { banco: "Banco Francés", cuenta: "Cuenta principal" },
    });
    expect(() => submitHabitualTaskProposal(state, employee, { ...canonical, title: "Conc Banc Franc" }, fixedNow)).toThrow(/no se pueden editar/);
    state = submitHabitualTaskProposal(state, employee, canonical, fixedNow);
    expect(state.habitualTaskProposals?.[0]).toMatchObject({ taskCode: "gpar_bank_reconciliation", taskCatalogVersion: 2, businessUnitCode: "paris_autos", taskParameters: { banco: "Banco Francés", cuenta: "Cuenta principal" } });
    state = approveHabitualTaskProposals(state, manager, ["paris-bank-recon"], { kind: "create", template: {
      title: "Conciliación bancaria", sector: "Contabilidad", description: "Comparar movimientos de la cuenta.",
      kind: "resultado", unit: "", weight: 1, target: 0, steps: ["Comparar movimientos y documentar diferencias"],
    } }, "2026-10", fixedNow);
    expect(state.templates.find((template) => template.taskCode === "gpar_bank_reconciliation")).toMatchObject({ taskCode: "gpar_bank_reconciliation", taskCatalogVersion: 2 });
    expect(state.assignments[0]).toMatchObject({ taskCode: "gpar_bank_reconciliation", taskCatalogVersion: 2, businessUnitCode: "paris_autos", taskParameters: { banco: "Banco Francés", cuenta: "Cuenta principal" }, companyId: "c1" });
    state = materialize(state, "2026-10");
    expect(state.tasks.find((task) => task.assignmentId === state.assignments[0]?.id)).toMatchObject({
      taskCode: "gpar_bank_reconciliation", taskCatalogVersion: 2, businessUnitCode: "paris_autos", taskParameters: { banco: "Banco Francés", cuenta: "Cuenta principal" }, companyId: "c1",
    });
    persist(state, true);
    expect(load(true).tasks.find((task) => task.assignmentId === state.assignments[0]?.id)).toMatchObject({
      taskCode: "gpar_bank_reconciliation", businessUnitCode: "paris_autos", taskParameters: { banco: "Banco Francés", cuenta: "Cuenta principal" },
    });
  });

  it("no permite activar tareas canónicas con la descripción y los controles de ejemplo", () => {
    let state = seed();
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    const manager = state.profiles.find((profile) => profile.id === "boss")!;
    state = submitHabitualTaskProposal(state, employee, proposalInput({
      id: "paris-placeholder", process: "", taskCode: "gpar_bank_reconciliation", taskCatalogVersion: 2,
      businessUnitCode: "paris_autos", taskParameters: { banco: "Banco Francés", cuenta: "Cuenta principal" },
      description: "Selección del catálogo Grupo París. Jefatura confirmará el procedimiento y los controles antes de asignar trabajo.",
      steps: ["Confirmar procedimiento y controles con jefatura."],
    }), fixedNow);
    expect(() => approveHabitualTaskProposals(state, manager, ["paris-placeholder"], { kind: "create", template: {
      title: "Conciliación bancaria", sector: "Tesorería", description: "Selección del catálogo Grupo París.",
      kind: "resultado", unit: "", weight: 1, target: 0, steps: ["Confirmar procedimiento y controles con jefatura."],
    } }, "2026-10", fixedNow)).toThrow(/jefatura debe definir/);
  });
});
