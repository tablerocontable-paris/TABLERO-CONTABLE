// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createLaboratoryBackup,
  createLaboratoryBackupV2,
  inspectLaboratoryBackup,
  KEY,
  restoreLaboratoryBackup,
  seed,
} from "../src/data/repository";
import LaboratoryBackup from "../src/components/LaboratoryBackup";
import { restoreEvidenceBundle } from "../src/data/laboratoryEvidence";

beforeEach(() => {
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

afterEach(() => cleanup());

describe("respaldo local del laboratorio", () => {
  it("explica que el límite de 50 MB incluye los datos y los archivos de la copia", () => {
    render(<LaboratoryBackup state={seed()} />);
    fireEvent.click(screen.getByRole("button", { name: /Copia del laboratorio/ }));
    expect(screen.getByText(/La copia completa admite hasta 50 MB, incluidos los datos y archivos/)).toBeTruthy();
  });

  it("ignora el resultado de una copia anterior si la selección nueva termina primero", async () => {
    const contents = createLaboratoryBackup(seed());
    let resolveOld!: (value: string) => void;
    let resolveCurrent!: (value: string) => void;
    const oldFile = new File([""], "anterior.json", { type: "application/json" });
    const currentFile = new File([""], "actual.json", { type: "application/json" });
    Object.defineProperty(oldFile, "text", { value: () => new Promise<string>((resolve) => { resolveOld = resolve; }) });
    Object.defineProperty(currentFile, "text", { value: () => new Promise<string>((resolve) => { resolveCurrent = resolve; }) });
    render(<LaboratoryBackup state={seed()} />);
    fireEvent.click(screen.getByRole("button", { name: /Copia del laboratorio/ }));
    const input = screen.getByLabelText("Elegir archivo de copia del laboratorio");
    fireEvent.change(input, { target: { files: [oldFile] } });
    fireEvent.change(input, { target: { files: [currentFile] } });
    resolveCurrent(contents);
    expect(await screen.findByText(/Copia válida · versión 1: actual.json/)).toBeTruthy();
    resolveOld("no es json");
    await Promise.resolve();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/Copia válida · versión 1: actual.json/)).toBeTruthy();
  });

  it("crea copias versión 2 y conserva la lectura de la versión 1", async () => {
    const state = seed();
    const copy = await createLaboratoryBackupV2(state, "2026-10-07T12:00:00.000Z");
    const inspected = inspectLaboratoryBackup(copy);
    expect(JSON.parse(copy).formatVersion).toBe(2);
    expect(inspected.formatVersion).toBe(2);
    expect(inspected.fileCount).toBe(0);
    expect(inspectLaboratoryBackup(createLaboratoryBackup(state)).formatVersion).toBe(1);
  });

  it("rechaza un archivo de respaldo cuyo contenido no coincide con el tipo declarado", async () => {
    await expect(restoreEvidenceBundle([{
      id: "evidence-invalid", name: "captura.png", mimeType: "image/png", size: 7,
      sha256: "0".repeat(64), contents: btoa("not png"),
    }])).rejects.toThrow(/no coincide con el tipo de archivo/i);
  });

  it("conserva evidencia que sólo está referenciada por un cierre archivado", () => {
    const state = seed();
    const task = state.tasks.find((row) => row.companyId === "c1" && row.kind === "resultado")!;
    const pngBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const evidenceId = "archived-task-evidence";
    const activityEvidenceId = "archived-movement-evidence";
    const sha256 = createHash("sha256").update(pngBytes).digest("hex");
    const snapshot = { ...task, evidenceIds: [evidenceId] };
    const snapshotActivity = {
      id: "archived-evidence-movement", taskId: task.id, actorId: task.ownerId,
      date: `${task.month}-20`, qty: 1, note: "Movimiento ficticio",
      createdAt: `${task.month}-20T12:00:00.000Z`, evidenceIds: [activityEvidenceId],
    };
    state.tasks = state.tasks.filter((row) => row.id !== task.id);
    state.closures = [{
      id: "archived-evidence-close", ownerId: task.ownerId, month: task.month,
      at: `${task.month}-28T23:00:00.000Z`, by: "boss", note: "Cierre ficticio",
      metrics: { assigned: 1, done: 1, points: 5, earned: 5, weighted: 100, onTime: 100, late: 0, blocked: 0, operational: 0, operationalTarget: 0 },
      tasks: [snapshot], activity: [snapshotActivity],
    }];
    state.taskEvidence = [{
      id: evidenceId, taskId: task.id, activityId: null, profileId: task.ownerId,
      name: "respaldo.png", mimeType: "image/png", size: pngBytes.length, sha256,
      createdAt: `${task.month}-20T12:00:00.000Z`,
    }, {
      id: activityEvidenceId, taskId: task.id, activityId: snapshotActivity.id, profileId: task.ownerId,
      name: "movimiento.png", mimeType: "image/png", size: pngBytes.length, sha256,
      createdAt: `${task.month}-20T12:05:00.000Z`,
    }];
    const copy = JSON.stringify({
      format: "grupo-paris-lab-backup", formatVersion: 2, createdAt: "2026-10-08T12:00:00.000Z", state,
      files: [
        { id: evidenceId, taskId: task.id, activityId: null, name: "respaldo.png", mimeType: "image/png", size: pngBytes.length, sha256, contents: pngBytes.toString("base64") },
        { id: activityEvidenceId, taskId: task.id, activityId: snapshotActivity.id, name: "movimiento.png", mimeType: "image/png", size: pngBytes.length, sha256, contents: pngBytes.toString("base64") },
      ],
    });

    const inspected = inspectLaboratoryBackup(copy);
    expect(inspected.fileCount).toBe(2);
    expect(inspected.state.closures[0]?.tasks[0]?.evidenceIds).toEqual([evidenceId]);
    expect(inspected.state.closures[0]?.activity[0]?.evidenceIds).toEqual([activityEvidenceId]);
    const mismatched = JSON.parse(copy);
    mismatched.files[0].taskId = "another-task";
    expect(() => inspectLaboratoryBackup(JSON.stringify(mismatched))).toThrow(/referencias, tamaño o contenido incompatibles/i);
    const legacyV2 = JSON.parse(copy);
    legacyV2.files.forEach((file: Record<string, unknown>) => { delete file.taskId; delete file.activityId; });
    expect(inspectLaboratoryBackup(JSON.stringify(legacyV2)).fileCount).toBe(2);
  });

  it("rechaza un cierre archivado que apunta a evidencia sin metadatos", () => {
    const state = seed();
    const task = state.tasks.find((row) => row.kind === "resultado")!;
    state.closures = [{
      id: "missing-evidence-close", ownerId: task.ownerId, month: task.month,
      at: `${task.month}-28T23:00:00.000Z`, by: "boss", note: "Cierre ficticio",
      metrics: { assigned: 1, done: 1, points: task.weight, earned: task.weight, weighted: 100, onTime: 100, late: 0, blocked: 0, operational: 0, operationalTarget: 0 },
      tasks: [{ ...task, evidenceIds: ["missing-evidence"] }], activity: [],
    }];

    expect(() => inspectLaboratoryBackup(createLaboratoryBackup(state))).toThrow(/copia compatible/i);
  });

  it("serializes a versioned copy and validates its contents and preview counts", () => {
    const state = seed();
    state.activeId = "e0";
    state.annotations = [
      {
        id: "note-1",
        ownerId: "e0",
        title: "Prueba",
        content: "Dato ficticio",
        kind: "personal",
        reminderOn: null,
        createdAt: "2026-10-07T12:00:00.000Z",
        updatedAt: "2026-10-07T12:00:00.000Z",
        convertedTaskId: null,
      },
    ];
    const stateWithFutureField = Object.assign(state, {
      compatibleFutureField: "preserved",
    });
    const copy = createLaboratoryBackup(
      stateWithFutureField,
      "2026-10-07T12:00:00.000Z",
    );
    const inspected = inspectLaboratoryBackup(copy);

    expect(JSON.parse(copy).format).toBe("grupo-paris-lab-backup");
    expect(inspected.createdAt).toBe("2026-10-07T12:00:00.000Z");
    expect(inspected.state.activeId).toBe("e0");
    expect(inspected.state.annotations?.[0].content).toBe("Dato ficticio");
    expect(
      (inspected.state as typeof stateWithFutureField).compatibleFutureField,
    ).toBe("preserved");
    expect(inspected.counts).toEqual({
      companies: 4,
      profiles: 13,
      tasks: state.tasks.length,
      notes: 1,
    });
  });

  it("restores only the isolated lab key and leaves the operational board untouched", async () => {
    const state = seed();
    state.profiles[0].name = "Jefatura de prueba restaurada";
    localStorage.setItem(KEY, "operational-board-must-not-change");

    const restored = await restoreLaboratoryBackup(createLaboratoryBackup(state));

    expect(restored.state.profiles[0].name).toBe(
      "Jefatura de prueba restaurada",
    );
    expect(
      JSON.parse(localStorage.getItem("paris-state-lab")!).profiles[0].name,
    ).toBe("Jefatura de prueba restaurada");
    expect(localStorage.getItem(KEY)).toBe("operational-board-must-not-change");
    expect(localStorage.getItem("paris-environment")).toBeNull();
  });

  it("rejects invalid files before replacing any browser data", async () => {
    localStorage.setItem("paris-state-lab", "existing-lab-copy");
    localStorage.setItem(KEY, "operational-board");
    const invalid = JSON.stringify({
      format: "grupo-paris-lab-backup",
      formatVersion: 1,
      createdAt: "today",
      state: { version: 99 },
    });

    await expect(restoreLaboratoryBackup(invalid)).rejects.toThrow(/copia compatible/);
    const missingActor = seed();
    missingActor.activeId = "profile-missing";
    await expect(restoreLaboratoryBackup(createLaboratoryBackup(missingActor))).rejects.toThrow(/perfil activo válido/);
    expect(localStorage.getItem("paris-state-lab")).toBe("existing-lab-copy");
    expect(localStorage.getItem(KEY)).toBe("operational-board");
  });

  it("rejects malformed and cyclic dependencies before accepting a backup", () => {
    const state = seed();
    const malformed = JSON.parse(createLaboratoryBackup(state));
    malformed.state.tasks[0].dependsOnTaskIds = "not-an-array";
    expect(() => inspectLaboratoryBackup(JSON.stringify(malformed))).toThrow(/copia compatible/i);

    const cycle = JSON.parse(createLaboratoryBackup(state));
    const first = cycle.state.tasks.find((task: { kind: string; responsibility?: unknown }) => task.kind === "resultado" && !task.responsibility)!;
    const second = { ...first, id: "cycle-task", title: "Tarea cíclica" };
    first.dependsOnTaskIds = [second.id];
    second.dependsOnTaskIds = [first.id];
    cycle.state.tasks.push(second);
    expect(() => inspectLaboratoryBackup(JSON.stringify(cycle))).toThrow(/copia compatible/i);
  });

  it("rechaza perfiles y jerarquías inválidas antes de tocar el estado local", async () => {
    localStorage.setItem("paris-state-lab", "estado-anterior");
    const malformed = JSON.parse(createLaboratoryBackup(seed()));
    malformed.state.profiles.find((profile: { id: string }) => profile.id === "e0").companyIds = 42;
    expect(() => inspectLaboratoryBackup(JSON.stringify(malformed))).toThrow(/copia compatible/i);
    const cycle = JSON.parse(createLaboratoryBackup(seed()));
    cycle.state.profiles.find((profile: { id: string }) => profile.id === "boss").managerId = "m1";
    await expect(restoreLaboratoryBackup(JSON.stringify(cycle))).rejects.toThrow(/copia compatible/i);
    expect(localStorage.getItem("paris-state-lab")).toBe("estado-anterior");
    const inactiveSuperior = seed();
    inactiveSuperior.profiles.find((profile) => profile.id === "m1")!.active = false;
    expect(inspectLaboratoryBackup(createLaboratoryBackup(inactiveSuperior)).state.profiles.find((profile) => profile.id === "e0")?.managerId).toBe("m1");
  });

  it("aplica el contrato semántico del estado a copias v1 y v2", () => {
    const corruptions: Array<(state: any) => void> = [
      (state) => { state.profiles.find((profile: any) => profile.id === "e0").active = "yes"; },
      (state) => { state.profiles.find((profile: any) => profile.id === "e0").sector = 42; },
      (state) => { state.profiles.find((profile: any) => profile.id === "e0").companyIds = ["c1", "c1"]; },
      (state) => { state.profiles.find((profile: any) => profile.id === "e0").companyIds = ["missing-company"]; },
      (state) => { state.profiles.find((profile: any) => profile.id === "e0").teamId = "missing-team"; },
      (state) => { state.profiles.find((profile: any) => profile.id === "e0").managerId = "missing-manager"; },
      (state) => { state.companies.push({ ...state.companies[0] }); },
      (state) => { state.profiles.push({ ...state.profiles[0] }); },
      (state) => { state.teams.push({ ...state.teams[0] }); },
      (state) => {
        state.profiles.find((profile: any) => profile.id === "m1").active = false;
        state.profiles.find((profile: any) => profile.id === "m2").active = false;
        state.profiles.find((profile: any) => profile.id === "m1").managerId = "m2";
        state.profiles.find((profile: any) => profile.id === "m2").managerId = "m1";
      },
    ];

    for (const formatVersion of [1, 2]) for (const corrupt of corruptions) {
      const backup = JSON.parse(createLaboratoryBackup(seed()));
      backup.formatVersion = formatVersion;
      if (formatVersion === 2) backup.files = [];
      corrupt(backup.state);
      expect(() => inspectLaboratoryBackup(JSON.stringify(backup))).toThrow(/copia compatible/i);
    }
  });

  it("rechaza referencias vivas, fechas imposibles y frecuencias no admitidas al inspeccionar respaldos", () => {
    const invalidTaskCompany = JSON.parse(createLaboratoryBackup(seed()));
    invalidTaskCompany.state.tasks[0].companyId = "missing-company";
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidTaskCompany))).toThrow(/copia compatible/i);
    const invalidV2 = { ...invalidTaskCompany, formatVersion: 2, files: [] };
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidV2))).toThrow(/copia compatible/i);

    const invalidFiscalTask = JSON.parse(createLaboratoryBackup(seed()));
    invalidFiscalTask.state.fiscalObligations = [{ id: "obl-1", companyId: "c1", obligationCode: "IVA", title: "IVA mensual", fiscalPeriod: "2026-10", milestone: "presentation", dueOn: "2026-10-20", sourceLabel: "Prueba", sourceRevision: "1", sourceCheckedAt: null, revision: 1, requiredTaskIds: ["missing-task"], createdAt: "2026-10-01T12:00:00.000Z", createdBy: "boss", updatedAt: "2026-10-01T12:00:00.000Z", history: [] }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidFiscalTask))).toThrow(/copia compatible/i);

    const legacyOperationalObligation = JSON.parse(createLaboratoryBackup(seed()));
    const operationalTask = legacyOperationalObligation.state.tasks.find((row: { kind: string }) => row.kind === "operativa");
    legacyOperationalObligation.state.fiscalObligations = [{ id: "legacy-op", companyId: operationalTask.companyId, obligationCode: "IVA", title: "IVA histórico", fiscalPeriod: "2026-10", milestone: "presentation", dueOn: "2026-10-20", sourceLabel: "Dato ficticio", sourceRevision: "1", sourceCheckedAt: null, revision: 1, requiredTaskIds: [operationalTask.id], createdAt: "2026-10-01T12:00:00.000Z", createdBy: "boss", updatedAt: "2026-10-01T12:00:00.000Z", history: [] }];
    expect(inspectLaboratoryBackup(JSON.stringify(legacyOperationalObligation)).state.fiscalObligations![0]!.evaluationVersion).toBeUndefined();

    const invalidVersionedOperationalObligation = structuredClone(legacyOperationalObligation);
    invalidVersionedOperationalObligation.state.fiscalObligations[0].evaluationVersion = 2;
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidVersionedOperationalObligation))).toThrow(/copia compatible/i);

    const versionedDeliverable = JSON.parse(createLaboratoryBackup(seed()));
    const deliverable = versionedDeliverable.state.tasks.find((row: { kind: string }) => row.kind === "resultado");
    versionedDeliverable.state.fiscalObligations = [{ id: "v2-with-history", companyId: deliverable.companyId, obligationCode: "IVA", title: "IVA vigente", fiscalPeriod: "2026-10", milestone: "presentation", dueOn: "2026-10-20", sourceLabel: "Dato ficticio", sourceRevision: "1", sourceCheckedAt: null, revision: 2, evaluationVersion: 2, requiredTaskIds: [deliverable.id], createdAt: "2026-10-01T12:00:00.000Z", createdBy: "boss", updatedAt: "2026-10-02T12:00:00.000Z", history: [{ revision: 2, at: "2026-10-01T12:00:00.000Z", by: "boss", reason: "Alta inicial", dueOn: "2026-10-20", sourceLabel: "Dato ficticio", sourceRevision: "1", requiredTaskIds: [deliverable.id], sourceCheckedAt: null }] }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(versionedDeliverable))).not.toThrow();
    const tamperedV2History = structuredClone(versionedDeliverable);
    tamperedV2History.state.fiscalObligations[0].history[0].requiredTaskIds = [operationalTask.id];
    expect(() => inspectLaboratoryBackup(JSON.stringify(tamperedV2History))).toThrow(/copia compatible/i);

    const invalidRecipient = JSON.parse(createLaboratoryBackup(seed()));
    invalidRecipient.state.calendarEvents = [{ id: "event-1", revision: 1, authorId: "boss", companyId: "c1", kind: "important", title: "Fecha", description: "", startOn: "2026-10-20", endOn: "2026-10-20", recipientIds: ["missing-profile"], linkedTaskId: null, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z", cancelledAt: null, cancelledBy: null }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidRecipient))).toThrow(/copia compatible/i);

    const invalidMixedRecipient = JSON.parse(createLaboratoryBackup(seed()));
    invalidMixedRecipient.state.calendarEvents = [{ id: "event-2", revision: 1, authorId: "boss", companyId: "c1", kind: "important", title: "Fecha", description: "", startOn: "2026-10-20", endOn: "2026-10-20", recipientIds: ["boss", "missing-profile"], linkedTaskId: null, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z", cancelledAt: null, cancelledBy: null }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidMixedRecipient))).toThrow(/copia compatible/i);

    const invalidCalendarDate = JSON.parse(createLaboratoryBackup(seed()));
    invalidCalendarDate.state.calendarEvents = [{ id: "event-1", revision: 1, authorId: "boss", companyId: "c1", kind: "important", title: "Fecha", description: "", startOn: "2026-02-30", endOn: "2026-03-01", recipientIds: ["boss"], linkedTaskId: null, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z", cancelledAt: null, cancelledBy: null }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidCalendarDate))).toThrow(/copia compatible/i);

    const invalidCalendarCompany = JSON.parse(createLaboratoryBackup(seed()));
    invalidCalendarCompany.state.calendarEvents = [{ id: "event-2", revision: 1, authorId: "boss", companyId: "missing-company", kind: "important", title: "Fecha", description: "", startOn: "2026-10-20", endOn: "2026-10-20", recipientIds: ["boss"], linkedTaskId: null, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z", cancelledAt: null, cancelledBy: null }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidCalendarCompany))).toThrow(/copia compatible/i);

    const invalidRateDate = JSON.parse(createLaboratoryBackup(seed()));
    invalidRateDate.state.operationalRates = [{ id: "rate-1", templateId: "cat3", taskId: null, companyId: "c1", effectiveOn: "not-a-date", unitWeight: 1, version: 1, createdAt: "2026-10-01T12:00:00.000Z", createdBy: "boss" }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidRateDate))).toThrow(/copia compatible/i);

    const invalidAuthoredInstant = JSON.parse(createLaboratoryBackup(seed()));
    invalidAuthoredInstant.state.calendarEvents = [{ id: "event-1", revision: 1, authorId: "boss", companyId: "c1", kind: "important", title: "Fecha", description: "", startOn: "2026-10-20", endOn: "2026-10-20", recipientIds: ["boss"], linkedTaskId: null, createdAt: "2026-02-30T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z", cancelledAt: null, cancelledBy: null }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidAuthoredInstant))).toThrow(/copia compatible/i);

    const invalidRateCompany = JSON.parse(createLaboratoryBackup(seed()));
    const task = invalidRateCompany.state.tasks.find((row: { kind: string }) => row.kind === "operativa");
    invalidRateCompany.state.operationalRates = [{ id: "rate-1", templateId: null, taskId: task.id, companyId: "c2", effectiveOn: "2026-10-01", unitWeight: 1, version: 1, createdAt: "2026-10-01T12:00:00.000Z", createdBy: "boss" }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidRateCompany))).toThrow(/copia compatible/i);

    const invalidFrequency = JSON.parse(createLaboratoryBackup(seed()));
    invalidFrequency.state.assignments[0].schedule = { frequency: "anual", startDate: "2026-10-01", endDate: "", interval: 1, weekdays: [], monthDay: 1, hasDeadline: true, dueOffsetDays: 0 };
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidFrequency))).toThrow(/copia compatible/i);
  });

  it("rechaza formas mal tipadas, IDs vacíos, actores faltantes y ausencias imposibles", () => {
    const malformedAssignmentSteps = JSON.parse(createLaboratoryBackup(seed()));
    malformedAssignmentSteps.state.assignments[0].steps = 42;
    expect(() => inspectLaboratoryBackup(JSON.stringify(malformedAssignmentSteps))).toThrow(/copia compatible/i);

    const malformedTemplateSteps = JSON.parse(createLaboratoryBackup(seed()));
    malformedTemplateSteps.state.templates[0].steps = 42;
    expect(() => inspectLaboratoryBackup(JSON.stringify(malformedTemplateSteps))).toThrow(/copia compatible/i);

    const emptyTaskId = JSON.parse(createLaboratoryBackup(seed()));
    emptyTaskId.state.tasks[0].id = "";
    expect(() => inspectLaboratoryBackup(JSON.stringify(emptyTaskId))).toThrow(/copia compatible/i);

    const missingSessionActor = JSON.parse(createLaboratoryBackup(seed()));
    missingSessionActor.state.tasks[0].sessions = [{ id: "session-1", actorId: "missing-profile", start: "2026-10-01T12:00:00.000Z", end: null }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(missingSessionActor))).toThrow(/copia compatible/i);

    const impossibleAbsence = JSON.parse(createLaboratoryBackup(seed()));
    impossibleAbsence.state.absences = [{ id: "absence-1", ownerId: "e0", replacementId: "e1", createdBy: "boss", from: "2026-02-30", to: "2026-02-01", kind: "Licencia", note: "Prueba" }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(impossibleAbsence))).toThrow(/copia compatible/i);

    const invalidTaskTitle = JSON.parse(createLaboratoryBackup(seed()));
    invalidTaskTitle.state.tasks[0].title = 42;
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidTaskTitle))).toThrow(/copia compatible/i);

    const invalidTaskStatus = JSON.parse(createLaboratoryBackup(seed()));
    invalidTaskStatus.state.tasks[0].status = {};
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidTaskStatus))).toThrow(/copia compatible/i);

    const invalidOnboardingSelection = JSON.parse(createLaboratoryBackup(seed()));
    invalidOnboardingSelection.state.onboarding.e0.selectedTemplateIds = 42;
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidOnboardingSelection))).toThrow(/copia compatible/i);

    const invalidOnboardingTitle = JSON.parse(createLaboratoryBackup(seed()));
    invalidOnboardingTitle.state.onboarding.e0.customTitle = 42;
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidOnboardingTitle))).toThrow(/copia compatible/i);
  });

  it("rechaza cierres malformados antes de aceptar o restaurar una copia", () => {
    const state = seed();
    const malformedCompanyClose = JSON.parse(createLaboratoryBackup(state));
    malformedCompanyClose.state.companyClosures = [{
      id: "broken-company-close", ownerId: "e0", companyId: "c1", month: "2026-10",
      at: "2026-10-31T23:00:00.000Z", by: "boss", note: "Cierre", metrics: {},
      tasks: {}, activity: [], coveredActivity: [], schemaVersion: 1,
    }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(malformedCompanyClose))).toThrow(/copia compatible/i);

    const malformedPeriodClose = JSON.parse(createLaboratoryBackup(state));
    malformedPeriodClose.state.closures = [{
      id: "broken-period-close", ownerId: "e0", month: "2026-10", at: "2026-10-31T23:00:00.000Z",
      by: "boss", note: "Cierre", metrics: {}, tasks: {}, activity: [],
    }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(malformedPeriodClose))).toThrow(/copia compatible/i);

    const malformedReport = JSON.parse(createLaboratoryBackup(state));
    malformedReport.state.closures = [{
      id: "broken-report-close", ownerId: "e0", month: "2026-10", at: "2026-10-31T23:00:00.000Z",
      by: "boss", note: "Cierre", metrics: { assigned: 0, done: 0, points: 0, earned: 0, weighted: null, onTime: null, late: 0, blocked: 0, operational: 0, operationalTarget: 0 },
      tasks: [], activity: [], report: { schemaVersion: 3, groups: {} },
    }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(malformedReport))).toThrow(/copia compatible/i);

    const malformedFrozenTask = JSON.parse(createLaboratoryBackup(state));
    const snapshotTask = { ...state.tasks[0], sessions: {} };
    malformedFrozenTask.state.closures = [{
      id: "broken-task-close", ownerId: snapshotTask.ownerId, month: snapshotTask.month,
      at: `${snapshotTask.month}-28T23:00:00.000Z`, by: "boss", note: "Cierre",
      metrics: { assigned: 0, done: 0, points: 0, earned: 0, weighted: null, onTime: null, late: 0, blocked: 0, operational: 0, operationalTarget: 0 },
      tasks: [snapshotTask], activity: [],
    }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(malformedFrozenTask))).toThrow(/copia compatible/i);

    const baseTask = state.tasks.find((task) => task.companyId === "c1")!;
    const closureMetrics = { assigned: 0, done: 0, points: 0, earned: 0, weighted: null, onTime: null, late: 0, blocked: 0, operational: 0, operationalTarget: 0 };
    const malformedResponsibility = JSON.parse(createLaboratoryBackup(state));
    malformedResponsibility.state.companyClosures = [{
      id: "broken-responsibility", ownerId: baseTask.ownerId, companyId: "c1", month: baseTask.month,
      at: `${baseTask.month}-28T23:00:00.000Z`, by: "boss", note: "Cierre", metrics: closureMetrics,
      tasks: [{ ...baseTask, responsibility: { version: 1, revision: 1, mode: "joint", members: {} } }],
      activity: [], coveredActivity: [], schemaVersion: 1,
    }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(malformedResponsibility))).toThrow(/copia compatible/i);

    const mismatchedCompany = JSON.parse(createLaboratoryBackup(state));
    mismatchedCompany.state.companyClosures = [{
      id: "mismatched-company", ownerId: baseTask.ownerId, companyId: "c2", month: baseTask.month,
      at: `${baseTask.month}-28T23:00:00.000Z`, by: "boss", note: "Cierre", metrics: closureMetrics,
      tasks: [baseTask], activity: [], coveredActivity: [], schemaVersion: 1,
    }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(mismatchedCompany))).toThrow(/copia compatible/i);
  });

  it("valida campos nuevos dentro de snapshots congelados sin exigirlos en copias antiguas", () => {
    const state = seed();
    const task = state.tasks.find((row) => row.companyId === "c1")!;
    const metrics = { assigned: 0, done: 0, points: 0, earned: 0, weighted: null, onTime: null, late: 0, blocked: 0, operational: 0, operationalTarget: 0 };
    const closure = {
      id: "frozen-fields", ownerId: task.ownerId, companyId: task.companyId, month: task.month,
      at: `${task.month}-28T23:00:00.000Z`, by: "boss", note: "Cierre", metrics,
      tasks: [{ ...task, commercialTrackingEnabled: true, commercialProgress: {
        month: task.month, throughDay: 31, updatedAt: `${task.month}-20T12:00:00.000Z`, updatedBy: task.ownerId,
      } }], activity: [], coveredActivity: [], schemaVersion: 1,
    };
    const invalidProgress = JSON.parse(createLaboratoryBackup(state));
    invalidProgress.state.companyClosures = [closure];
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidProgress))).toThrow(/copia compatible/i);

    const invalidSnapshotActivity = JSON.parse(createLaboratoryBackup(state));
    invalidSnapshotActivity.state.companyClosures = [{ ...closure, tasks: [], activity: [{
      id: "bad-date", taskId: task.id, actorId: task.ownerId, date: `${task.month}-31`, qty: 1,
      operationalUnitWeight: 1,
    }] }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidSnapshotActivity))).toThrow(/copia compatible/i);

    const operationalTask = state.tasks.find((row) => row.companyId === "c1" && row.kind === "operativa")!;
    const invalidSnapshotRate = JSON.parse(createLaboratoryBackup(state));
    invalidSnapshotRate.state.companyClosures = [{ ...closure, tasks: [operationalTask], activity: [{
      id: "bad-rate", taskId: operationalTask.id, actorId: operationalTask.ownerId, date: `${operationalTask.month}-20`, qty: 1,
      operationalRateId: "missing-rate", operationalUnitWeight: 0,
    }] }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidSnapshotRate))).toThrow(/copia compatible/i);

    const invalidSnapshotDependency = JSON.parse(createLaboratoryBackup(state));
    invalidSnapshotDependency.state.companyClosures = [{ ...closure, tasks: [{ ...task, dependsOnTaskIds: ["missing-frozen-task"] }] }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(invalidSnapshotDependency))).toThrow(/copia compatible/i);

    const resultTasks = state.tasks.filter((row) => row.companyId === "c1" && row.month === task.month && row.kind === "resultado");
    const first = { ...resultTasks[0]!, id: "frozen-cycle-a", dependsOnTaskIds: ["frozen-cycle-b"] };
    const second = { ...resultTasks[1]!, id: "frozen-cycle-b", dependsOnTaskIds: ["frozen-cycle-a"] };
    const cyclicSnapshots = JSON.parse(createLaboratoryBackup(state));
    cyclicSnapshots.state.companyClosures = [{ ...closure, tasks: [first, second] }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(cyclicSnapshots))).toThrow(/copia compatible/i);

    const legacySnapshot = JSON.parse(createLaboratoryBackup(state));
    legacySnapshot.state.companyClosures = [{ ...closure, tasks: [{
      id: task.id, ownerId: task.ownerId, companyId: task.companyId, month: task.month,
      kind: task.kind, weight: task.weight,
    }], schemaVersion: 1 }];
    expect(() => inspectLaboratoryBackup(JSON.stringify(legacySnapshot))).not.toThrow();
  });

  it("requires a checkbox after inspecting a copy before offering restoration", async () => {
    const state = seed();
    render(<LaboratoryBackup state={state} />);
    fireEvent.click(
      screen.getByRole("button", { name: /copia del laboratorio/i }),
    );
    const file = new File([createLaboratoryBackup(state)], "copia.json", {
      type: "application/json",
    });
    fireEvent.change(
      screen.getByLabelText("Elegir archivo de copia del laboratorio"),
      { target: { files: [file] } },
    );

    expect(await screen.findByText(/Copia válida · versión 1: copia.json/)).toBeTruthy();
    const restore = screen.getByRole("button", {
      name: "Restaurar y recargar",
    }) as HTMLButtonElement;
    expect(restore.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(restore.disabled).toBe(false);
    expect(screen.getByText(/No modifica el tablero operativo/)).toBeTruthy();
  });
});
