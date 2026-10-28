// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import App from "../src/App";
import Onboarding from "../src/components/Onboarding";
import { load, persist, seed } from "../src/data/repository";
import { defaultSchedule } from "../src/domain/schedule";
import type { Onboarding as Draft, State } from "../src/domain/model";
import { NEUTRAL_STARTER_SUGGESTIONS } from "../src/domain/neutralStarterCatalog";

beforeEach(() => {
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("integración de propuestas en la inducción", () => {
  it("conserva una selección incompleta de conciliación como borrador editable", () => {
    const state = seed();
    state.onboarding.e0!.selectedBusinessUnitCodes = ["paris_autos"];
    state.onboarding.e0!.habitualTaskProposals = [{
      id: "draft-bank-reconciliation", taskCode: "gpar_bank_reconciliation", taskCatalogVersion: 1,
      businessUnitCode: "paris_autos", taskParameters: {}, title: "Conciliación bancaria", process: "",
      description: "Selección del catálogo Grupo París.", kind: "resultado", unit: "", steps: [], companyIds: ["c1"],
    }];
    persist(state, true);
    expect(load(true).onboarding.e0?.habitualTaskProposals?.[0]).toMatchObject({
      taskCode: "gpar_bank_reconciliation", businessUnitCode: "paris_autos", taskParameters: {},
    });
  });

  it("permite elegir unidades de negocio y tareas canónicas sin editar sus nombres", () => {
    const state = seed();
    const profile = state.profiles.find((row) => row.id === "e0")!;
    const update = vi.fn();
    const stepOne: Draft = { ...state.onboarding.e0!, step: 1, selectedCompanyIds: ["c1"], selectedBusinessUnitCodes: [] };
    const first = render(<Onboarding state={state} month="2026-10" profile={profile} draft={stepOne} update={update} finish={vi.fn()} pause={vi.fn()} laboratory />);
    fireEvent.click(screen.getByLabelText("PARIS AUTOS"));
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ selectedBusinessUnitCodes: ["paris_autos"] }));
    first.unmount();

    const updateTask = vi.fn();
    const stepTwo: Draft = { ...stepOne, step: 2, selectedBusinessUnitCodes: ["paris_autos"] };
    render(<Onboarding state={state} month="2026-10" profile={profile} draft={stepTwo} update={updateTask} finish={vi.fn()} pause={vi.fn()} laboratory />);
    const bankRow = Array.from(document.querySelectorAll(".paris-task-catalog-item"))
      .find((row) => row.textContent?.includes("Conciliación bancaria"))!;
    fireEvent.click(within(bankRow as HTMLElement).getByRole("button", { name: /PARIS AUTOS/ }));
    expect(updateTask).toHaveBeenLastCalledWith(expect.objectContaining({
      habitualTaskProposals: [expect.objectContaining({
        taskCode: "gpar_bank_reconciliation", taskCatalogVersion: 1,
        businessUnitCode: "paris_autos", title: "Conciliación bancaria",
      })],
    }));
  });

  it("no ofrece tareas libres si un borrador nuevo intenta saltar la selección de unidad", () => {
    const state = seed();
    const profile = state.profiles.find((row) => row.id === "e0")!;
    const draft: Draft = { ...state.onboarding.e0!, step: 2, selectedBusinessUnitCodes: [], selectedTemplateIds: [], habitualTaskProposals: [] };
    render(<Onboarding state={state} month="2026-10" profile={profile} draft={draft} update={vi.fn()} finish={vi.fn()} pause={vi.fn()} laboratory />);
    expect(document.querySelector(".paris-task-catalog")).not.toBeNull();
    expect(screen.queryByText("Sugerencias habituales")).toBeNull();
    expect((screen.getByRole("button", { name: /Continuar/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("envía una sugerencia v2 como pendiente, sin materializar tareas, y no duplica al repetir la inducción", async () => {
    const state = seed();
    state.activeId = "e0";
    state.assignments = [];
    state.tasks = [];
    state.activity = [];
    const starter = NEUTRAL_STARTER_SUGGESTIONS[0]!;
    const draft: Draft = {
      ...state.onboarding.e0!, name: "Emilia Romero", step: 5, completedAt: null,
      selectedCompanyIds: ["c1", "c2"], selectedTemplateIds: [],
      companySchedules: { [`${starter.id}:e0`]: {
        c1: { ...defaultSchedule("2026-10-03", "mensual"), hasDeadline: false },
        c2: { ...defaultSchedule("2026-10-05", "semanal"), hasDeadline: false },
      } }, companyTargets: {}, assignmentCompanyIds: {}, schedules: {},
      customTitle: "", customSteps: "", customTasks: [], habitualTaskProposals: [{
        id: `${starter.id}:e0`, starterId: starter.id, neutralConceptCode: starter.neutralConceptCode,
        taxonomyVersion: starter.taxonomyVersion, title: starter.title, process: "",
        description: starter.description, kind: starter.suggestedKind, unit: starter.suggestedUnit,
        steps: [...starter.suggestedSteps], companyIds: ["c1", "c2"],
      }],
    };
    state.onboarding.e0 = draft;
    persist(state as State, true);
    const reloaded = load(true);
    expect(reloaded.onboarding.e0?.habitualTaskProposals?.[0]).toMatchObject({
      starterId: starter.id, neutralConceptCode: starter.neutralConceptCode, taxonomyVersion: starter.taxonomyVersion,
    });
    render(<App initialState={reloaded} laboratoryMode />);
    fireEvent.click(await screen.findByRole("button", { name: /Preparar mi tablero/ }));
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("paris-state-lab") || "null");
      expect(saved?.habitualTaskProposals).toHaveLength(2);
    });
    const once = load(true);
    expect(once.habitualTaskProposals).toHaveLength(2);
    expect(once.habitualTaskProposals?.find((proposal) => proposal.companyId === "c1")).toMatchObject({
      id: `${starter.id}:e0:c1`, ownerId: "e0", companyId: "c1", status: "pending", title: starter.title,
      neutralConceptCode: starter.neutralConceptCode, taxonomyVersion: starter.taxonomyVersion,
      schedule: { frequency: "mensual", startDate: "2026-10-03", hasDeadline: false },
    });
    expect(once.habitualTaskProposals?.find((proposal) => proposal.companyId === "c2")?.schedule).toMatchObject({
      frequency: "semanal", startDate: "2026-10-05", hasDeadline: false,
    });
    expect(once.assignments).toHaveLength(0);
    expect(once.tasks).toHaveLength(0);

    cleanup();
    once.onboarding.e0!.completedAt = null;
    render(<App initialState={once} laboratoryMode />);
    fireEvent.click(await screen.findByRole("button", { name: /Preparar mi tablero/ }));
    await waitFor(() => expect(load(true).habitualTaskProposals).toHaveLength(2));
    expect(load(true).assignments).toHaveLength(0);
    expect(load(true).tasks).toHaveLength(0);
  });

  it("guarda la propuesta pendiente en el laboratorio sin crear tareas ni asignaciones", async () => {
    const state = seed();
    state.activeId = "e0";
    state.assignments = [];
    state.tasks = [];
    const draft: Draft = {
      ...state.onboarding.e0,
      name: "Emilia Romero",
      step: 5,
      completedAt: null,
      selectedCompanyIds: ["c1"],
      selectedTemplateIds: [],
      assignmentCompanyIds: {},
      schedules: {},
      companySchedules: { "draft-process": { c1: defaultSchedule("2026-10-10", "mensual") } },
      companyTargets: {},
      customTitle: "",
      customSteps: "",
      customTasks: [],
      habitualTaskProposals: [{
        id: "draft-process",
        title: "Conciliación Banco Nación",
        process: "Banco Nación",
        description: "Comparar los movimientos y dejar evidencia de las diferencias.",
        kind: "resultado",
        unit: "",
        steps: ["Descargar extracto", "Comparar movimientos"],
        companyIds: ["c1"],
      }],
    };
    state.onboarding.e0 = draft;
    render(<App initialState={state as State} laboratoryMode />);

    fireEvent.click(await screen.findByRole("button", { name: /Preparar mi tablero/ }));

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("paris-state-lab") || "null");
      expect(saved?.habitualTaskProposals).toHaveLength(1);
    });
    const saved = JSON.parse(localStorage.getItem("paris-state-lab")!);
    expect(saved.habitualTaskProposals[0]).toMatchObject({
      id: "draft-process:c1",
      ownerId: "e0",
      companyId: "c1",
      title: "Conciliación Banco Nación",
      status: "pending",
      revision: 1,
    });
    expect(saved.assignments).toHaveLength(0);
    expect(saved.tasks).toHaveLength(0);
    expect(saved.onboarding.e0.completedAt).toBeTruthy();
  });

  it("completa la inducción de jefatura sin generar tareas propias inválidas", async () => {
    const state = seed();
    const boss = state.profiles.find((profile) => profile.role === "jefe")!;
    const bossCompanies = boss.companyIds.slice(0, 2);
    const starterId = "starter-suggestion-v2-conciliacion-de-cuenta-bancaria";
    const starterDraftId = `${starterId}:${boss.id}`;
    state.activeId = boss.id;
    state.onboarding[boss.id] = {
      ...state.onboarding[boss.id],
      name: boss.name,
      step: 2,
      completedAt: null,
      selectedCompanyIds: bossCompanies,
      selectedTemplateIds: [state.templates[0]!.id],
      assignmentCompanyIds: {},
      schedules: {},
      companySchedules: { [starterDraftId]: {
        [bossCompanies[0]!]: { ...defaultSchedule("2026-10-02", "mensual"), hasDeadline: false },
        [bossCompanies[1]!]: { ...defaultSchedule("2026-10-03", "semanal"), hasDeadline: false },
      } },
      companyTargets: { [starterDraftId]: { [bossCompanies[0]!]: 0 } },
      customTitle: "",
      customSteps: "",
      customTasks: [],
      habitualTaskProposals: [{
        id: starterDraftId,
        starterId,
        title: "Conciliación de cuenta bancaria", process: "", description: "Borrador conservado.",
        kind: "resultado", unit: "", steps: ["Revisar referencias", "Documentar diferencias"], companyIds: [],
      }],
    };

    render(<App initialState={state as State} laboratoryMode />);
    fireEvent.click(await screen.findByRole("button", { name: /^Continuar/ }));
    await waitFor(() => expect(document.querySelector(".induction-top")?.textContent).toContain("4 DE 6"));
    expect(screen.queryByText("Propuestas que revisará jefatura")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Continuar/ }));
    await waitFor(() => expect(document.querySelector(".induction-top")?.textContent).toContain("5 DE 6"));
    fireEvent.click(screen.getByRole("button", { name: /^Continuar/ }));
    await waitFor(() => expect(document.querySelector(".induction-top")?.textContent).toContain("6 DE 6"));
    expect(screen.getByText("0 tareas")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /Preparar mi tablero/ }));

    await waitFor(() => expect(localStorage.getItem("paris-state-lab")).not.toBeNull());
    const saved = load(true);
    expect(saved.onboarding[boss.id]?.completedAt).toBeTruthy();
    expect(saved.assignments.some((assignment) => assignment.ownerId === boss.id)).toBe(false);
    expect(saved.tasks.some((task) => task.ownerId === boss.id)).toBe(false);
    expect(saved.habitualTaskProposals || []).toHaveLength(0);
    expect(saved.onboarding[boss.id]?.habitualTaskProposals?.[0]?.starterId).toBe(starterId);
    expect(saved.onboarding[boss.id]?.companySchedules?.[starterDraftId]?.[bossCompanies[0]!]).toMatchObject({ frequency: "mensual", hasDeadline: false });
    expect(saved.onboarding[boss.id]?.companySchedules?.[starterDraftId]?.[bossCompanies[1]!]).toMatchObject({ frequency: "semanal", hasDeadline: false });
    expect(saved.onboarding[boss.id]?.companyTargets?.[starterDraftId]?.[bossCompanies[0]!]).toBe(0);
  });

  it("materializa un v1 ya seleccionado en el borrador histórico y conserva su versión", async () => {
    const state = seed();
    state.activeId = "e0";
    state.assignments = [];
    state.tasks = [];
    state.activity = [];
    const legacyId = "starter-v1-bank-reconciliation";
    state.onboarding.e0 = {
      ...state.onboarding.e0!, name: "Emilia Romero", step: 5, completedAt: null,
      selectedCompanyIds: ["c1"], selectedTemplateIds: [legacyId], assignmentCompanyIds: {},
      schedules: {}, companySchedules: {}, companyTargets: {}, customTitle: "", customSteps: "", customTasks: [], habitualTaskProposals: [],
    };
    render(<App initialState={state as State} laboratoryMode />);
    fireEvent.click(await screen.findByRole("button", { name: /Preparar mi tablero/ }));
    await waitFor(() => expect(load(true).assignments).toHaveLength(1));
    const saved = load(true);
    expect(saved.assignments[0]).toMatchObject({ starterId: legacyId, title: "Conciliación de cuenta bancaria", templateId: null });
    expect(saved.tasks.some((task) => task.assignmentId === saved.assignments[0]?.id)).toBe(true);
  });

  it("al quitar una propuesta limpia sus claves de programación y permite terminar otra selección válida", async () => {
    const state = seed();
    state.activeId = "e0";
    state.assignments = [];
    state.tasks = [];
    state.activity = [];
    const starter = NEUTRAL_STARTER_SUGGESTIONS[0]!;
    const proposalId = `${starter.id}:e0`;
    const validTemplateId = state.templates[0]!.id;
    const initialDraft: Draft = {
      ...state.onboarding.e0!, name: "Emilia Romero", step: 2, completedAt: null,
      selectedCompanyIds: ["c1"], selectedTemplateIds: [validTemplateId],
      assignmentCompanyIds: { [proposalId]: ["c1"], [validTemplateId]: ["c1"] },
      schedules: { [proposalId]: defaultSchedule("2026-10-10", "unrecognized" as never) },
      companySchedules: {
        [proposalId]: { c1: defaultSchedule("2026-10-10", "unrecognized" as never) },
        [validTemplateId]: { c1: defaultSchedule("2026-10-10", "mensual") },
      },
      companyTargets: { [proposalId]: { c1: 12 }, [validTemplateId]: { c1: 3 } },
      customTitle: "", customSteps: "", customTasks: [],
      habitualTaskProposals: [{
        id: proposalId, starterId: starter.id, title: starter.title, process: "",
        description: starter.description, kind: starter.suggestedKind, unit: starter.suggestedUnit,
        steps: [...starter.suggestedSteps], companyIds: ["c1"],
      }],
    };
    let removedDraft = initialDraft;
    const removalView = render(<Onboarding state={state as State} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={initialDraft} update={(next) => { removedDraft = next; }} finish={() => {}} pause={() => {}} laboratory />);
    fireEvent.click(document.querySelector(".starter-suggestion-group summary")!);
    fireEvent.click(document.querySelector(".starter-suggestion-detail summary")!);
    fireEvent.click(screen.getByRole("button", { name: "Quitar selección" }));
    expect(removedDraft.habitualTaskProposals).toEqual([]);
    expect(removedDraft.schedules).not.toHaveProperty(proposalId);
    expect(removedDraft.companySchedules).not.toHaveProperty(proposalId);
    expect(removedDraft.companyTargets).not.toHaveProperty(proposalId);
    expect(removedDraft.assignmentCompanyIds).not.toHaveProperty(proposalId);
    removalView.unmount();
    state.onboarding.e0 = { ...removedDraft, step: 5 };
    render(<App initialState={state as State} laboratoryMode />);
    fireEvent.click(await screen.findByRole("button", { name: /Preparar mi tablero/ }));

    await waitFor(() => expect(load(true).onboarding.e0?.completedAt).toBeTruthy());
    const saved = load(true);
    expect(saved.onboarding.e0?.habitualTaskProposals).toEqual([]);
    expect(saved.onboarding.e0?.schedules).not.toHaveProperty(proposalId);
    expect(saved.onboarding.e0?.companySchedules).not.toHaveProperty(proposalId);
    expect(saved.onboarding.e0?.companyTargets).not.toHaveProperty(proposalId);
    expect(saved.onboarding.e0?.assignmentCompanyIds).not.toHaveProperty(proposalId);
    expect(saved.assignments.some((assignment) => assignment.ownerId === "e0")).toBe(true);
  });

  it("al retirar una empresa limpia sólo sus mapas y envía la propuesta para la empresa restante", async () => {
    const state = seed();
    state.activeId = "e0";
    state.assignments = [];
    state.tasks = [];
    state.activity = [];
    const starter = NEUTRAL_STARTER_SUGGESTIONS[0]!;
    const proposalId = `${starter.id}:e0`;
    const invalidSchedule = { ...defaultSchedule("2026-10-10", "mensual"), frequency: "unsupported" as never };
    const initialDraft: Draft = {
      ...state.onboarding.e0!, name: "Emilia Romero", step: 3, completedAt: null,
      selectedCompanyIds: ["c1", "c2"], selectedTemplateIds: [], assignmentCompanyIds: {}, schedules: {},
      companySchedules: { [proposalId]: { c1: { ...defaultSchedule("2026-10-10", "mensual"), hasDeadline: false }, c2: invalidSchedule } },
      companyTargets: { [proposalId]: { c1: 7, c2: 11 } }, customTitle: "", customSteps: "", customTasks: [],
      habitualTaskProposals: [{
        id: proposalId, starterId: starter.id, title: starter.title, process: "", description: starter.description,
        kind: starter.suggestedKind, unit: starter.suggestedUnit, steps: [...starter.suggestedSteps], companyIds: ["c1", "c2"],
      }],
    };
    let editedDraft = initialDraft;
    const removalView = render(<Onboarding state={state as State} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={initialDraft} update={(next) => { editedDraft = next; }} finish={() => {}} pause={() => {}} laboratory />);
    const proposalSection = document.querySelector<HTMLElement>(".habitual-proposal-schedule")!;
    const company2 = state.companies.find((company) => company.id === "c2")!;
    fireEvent.click(within(proposalSection).getByLabelText(company2.name));
    expect(editedDraft.habitualTaskProposals?.[0]?.companyIds).toEqual(["c1"]);
    expect(editedDraft.companySchedules?.[proposalId]).not.toHaveProperty("c2");
    expect(editedDraft.companySchedules?.[proposalId]?.c1).toMatchObject({ frequency: "mensual", hasDeadline: false });
    expect(editedDraft.companyTargets?.[proposalId]).not.toHaveProperty("c2");
    expect(editedDraft.companyTargets?.[proposalId]?.c1).toBe(7);
    removalView.unmount();

    state.onboarding.e0 = { ...editedDraft, step: 5 };
    render(<App initialState={state as State} laboratoryMode />);
    fireEvent.click(await screen.findByRole("button", { name: /Preparar mi tablero/ }));
    await waitFor(() => expect(load(true).habitualTaskProposals).toHaveLength(1));
    expect(load(true).habitualTaskProposals?.[0]).toMatchObject({ companyId: "c1", status: "pending" });
    expect(load(true).habitualTaskProposals?.some((proposal) => proposal.companyId === "c2")).toBe(false);
  });

  it("al quitar c2 desde Tu contexto conserva su regla latente y finaliza sólo con c1", async () => {
    const state = seed();
    state.activeId = "e0";
    state.assignments = [];
    state.tasks = [];
    state.activity = [];
    const starter = NEUTRAL_STARTER_SUGGESTIONS[0]!;
    const proposalId = `${starter.id}:e0`;
    const latentInvalidSchedule = { ...defaultSchedule("2026-10-10", "mensual"), monthDay: 0 };
    const initialDraft: Draft = {
      ...state.onboarding.e0!, name: "Emilia Romero", step: 1, completedAt: null,
      selectedCompanyIds: ["c1", "c2"], selectedTemplateIds: [], assignmentCompanyIds: {}, schedules: {},
      companySchedules: { [proposalId]: { c1: { ...defaultSchedule("2026-10-10", "mensual"), hasDeadline: false }, c2: latentInvalidSchedule } },
      companyTargets: { [proposalId]: { c1: 7, c2: 11 } }, customTitle: "", customSteps: "", customTasks: [],
      habitualTaskProposals: [{
        id: proposalId, starterId: starter.id, title: starter.title, process: "", description: starter.description,
        kind: starter.suggestedKind, unit: starter.suggestedUnit, steps: [...starter.suggestedSteps], companyIds: ["c1", "c2"],
      }],
    };
    let contextDraft = initialDraft;
    const contextView = render(<Onboarding state={state as State} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={initialDraft} update={(next) => { contextDraft = next; }} finish={() => {}} pause={() => {}} laboratory />);
    const company2 = state.companies.find((company) => company.id === "c2")!;
    fireEvent.click(screen.getByLabelText(company2.name));
    expect(contextDraft.selectedCompanyIds).toEqual(["c1"]);
    expect(contextDraft.companySchedules?.[proposalId]?.c2).toEqual(latentInvalidSchedule);
    contextView.unmount();

    state.onboarding.e0 = { ...contextDraft, step: 5 };
    render(<App initialState={state as State} laboratoryMode />);
    fireEvent.click(await screen.findByRole("button", { name: /Preparar mi tablero/ }));
    await waitFor(() => expect(load(true).habitualTaskProposals).toHaveLength(1));
    const saved = load(true);
    expect(saved.habitualTaskProposals?.[0]).toMatchObject({ companyId: "c1", status: "pending" });
    expect(saved.habitualTaskProposals?.some((proposal) => proposal.companyId === "c2")).toBe(false);
    expect(saved.onboarding.e0?.companySchedules?.[proposalId]?.c2).toEqual(latentInvalidSchedule);
  });

  it("valida una tarea puntual sólo para sus empresas asignadas y conserva el horario latente de c2", async () => {
    const state = seed();
    state.activeId = "e0";
    state.assignments = [];
    state.tasks = [];
    state.activity = [];
    const customTask = { id: "custom-limited", title: "Revisión puntual", steps: "Control", kind: "resultado" as const, unit: "", target: 0 };
    const invalidLatentSchedule = { ...defaultSchedule("2026-10-10", "mensual"), monthDay: 0 };
    const initialDraft: Draft = {
      ...state.onboarding.e0!, name: "Emilia Romero", step: 3, completedAt: null,
      selectedCompanyIds: ["c1", "c2"], selectedTemplateIds: [], assignmentCompanyIds: { [customTask.id]: ["c1", "c2"] },
      schedules: {}, companySchedules: { [customTask.id]: {
        c1: defaultSchedule("2026-10-10", "única"), c2: invalidLatentSchedule,
      } },
      companyTargets: {}, customTitle: "", customSteps: "", customTasks: [customTask], habitualTaskProposals: [],
    };
    let editedDraft = initialDraft;
    const editView = render(<Onboarding state={state as State} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={initialDraft} update={(next) => { editedDraft = next; }} finish={() => {}} pause={() => {}} laboratory />);
    const taskSection = document.querySelector<HTMLElement>(".schedule-task")!;
    const company2 = state.companies.find((company) => company.id === "c2")!;
    fireEvent.click(within(taskSection).getByLabelText(company2.name));
    expect(editedDraft.assignmentCompanyIds?.[customTask.id]).toEqual(["c1"]);
    expect(editedDraft.companySchedules?.[customTask.id]?.c2).toEqual(invalidLatentSchedule);
    editView.unmount();

    state.onboarding.e0 = { ...editedDraft, step: 5 };
    render(<App initialState={state as State} laboratoryMode />);
    fireEvent.click(await screen.findByRole("button", { name: /Preparar mi tablero/ }));
    await waitFor(() => expect(load(true).assignments.some((assignment) => assignment.id === `onboard-e0-c1-${customTask.id}`)).toBe(true));
    const saved = load(true);
    expect(saved.assignments.some((assignment) => assignment.id === `onboard-e0-c2-${customTask.id}`)).toBe(false);
    expect(saved.onboarding.e0?.companySchedules?.[customTask.id]?.c2).toEqual(invalidLatentSchedule);
  });

  it("al retirar una plantilla y un trabajo puntual conserva sus horarios latentes al finalizar", async () => {
    const state = seed();
    state.activeId = "e0";
    state.assignments = [];
    state.tasks = [];
    state.activity = [];
    const [removedTemplate, retainedTemplate] = state.templates;
    const removedCustom = { id: "custom-remove", title: "Trabajo que se quita", steps: "Control removido", kind: "resultado" as const, unit: "", target: 0 };
    const retainedCustom = { id: "custom-keep", title: "Trabajo que sigue", steps: "Control vigente", kind: "resultado" as const, unit: "", target: 0 };
    const invalidLatentSchedule = { ...defaultSchedule("2026-10-10", "mensual"), monthDay: 0 };
    const initialDraft: Draft = {
      ...state.onboarding.e0!, name: "Emilia Romero", step: 2, completedAt: null,
      selectedCompanyIds: ["c1"], selectedTemplateIds: [removedTemplate!.id, retainedTemplate!.id],
      assignmentCompanyIds: { [removedTemplate!.id]: ["c1"], [retainedTemplate!.id]: ["c1"] },
      schedules: {}, companySchedules: {
        [removedTemplate!.id]: { c1: invalidLatentSchedule },
        [retainedTemplate!.id]: { c1: { ...defaultSchedule("2026-10-10", "mensual"), hasDeadline: false } },
        [removedCustom.id]: { c1: invalidLatentSchedule },
        [retainedCustom.id]: { c1: defaultSchedule("2026-10-10", "única") },
      },
      companyTargets: {}, customTitle: "", customSteps: "", customTasks: [removedCustom, retainedCustom], habitualTaskProposals: [],
    };
    let editedDraft = initialDraft;
    function Harness() {
      const [current, setCurrent] = useState(initialDraft);
      return <Onboarding state={state as State} month="2026-10" profile={state.profiles.find((profile) => profile.id === "e0")!} draft={current} update={(next) => { editedDraft = next; setCurrent(next); }} finish={() => {}} pause={() => {}} laboratory />;
    }
    render(<Harness />);
    const catalog = document.querySelector<HTMLElement>(".catalog-options")!;
    const removedCheckbox = [...catalog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
      .find((input) => input.closest("label")?.textContent?.includes(removedTemplate!.title))!;
    fireEvent.click(removedCheckbox);
    const removedRow = [...document.querySelectorAll<HTMLElement>(".custom-task-row")].find((row) => row.textContent?.includes(removedCustom.title))!;
    fireEvent.click(within(removedRow).getByRole("button", { name: "Quitar" }));
    expect(editedDraft.selectedTemplateIds).not.toContain(removedTemplate!.id);
    expect(editedDraft.customTasks?.some((task) => task.id === removedCustom.id)).toBe(false);
    expect(editedDraft.companySchedules?.[removedTemplate!.id]?.c1).toEqual(invalidLatentSchedule);
    expect(editedDraft.companySchedules?.[removedCustom.id]?.c1).toEqual(invalidLatentSchedule);

    cleanup();
    state.onboarding.e0 = { ...editedDraft, step: 5 };
    render(<App initialState={state as State} laboratoryMode />);
    fireEvent.click(await screen.findByRole("button", { name: /Preparar mi tablero/ }));
    await waitFor(() => expect(load(true).onboarding.e0?.completedAt).toBeTruthy());
    const saved = load(true);
    expect(saved.onboarding.e0?.companySchedules?.[removedTemplate!.id]?.c1).toEqual(invalidLatentSchedule);
    expect(saved.onboarding.e0?.companySchedules?.[removedCustom.id]?.c1).toEqual(invalidLatentSchedule);
    expect(saved.assignments.some((assignment) => assignment.ownerId === "e0")).toBe(true);
  });
});
