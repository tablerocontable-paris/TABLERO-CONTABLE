// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../src/App";
import { load, seed } from "../src/data/repository";
import { defaultSchedule } from "../src/domain/schedule";
import type { Onboarding as Draft, State } from "../src/domain/model";

beforeEach(() => {
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("integración de propuestas en la inducción", () => {
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
    state.activeId = boss.id;
    state.onboarding[boss.id] = {
      ...state.onboarding[boss.id],
      name: boss.name,
      step: 5,
      completedAt: null,
      selectedCompanyIds: [boss.companyIds[0]!],
      selectedTemplateIds: [state.templates[0]!.id],
      assignmentCompanyIds: {},
      schedules: {},
      companySchedules: {},
      companyTargets: {},
      customTitle: "",
      customSteps: "",
      customTasks: [],
      habitualTaskProposals: [],
    };

    render(<App initialState={state as State} laboratoryMode />);
    fireEvent.click(await screen.findByRole("button", { name: /Preparar mi tablero/ }));

    await waitFor(() => expect(localStorage.getItem("paris-state-lab")).not.toBeNull());
    const saved = load(true);
    expect(saved.onboarding[boss.id]?.completedAt).toBeTruthy();
    expect(saved.assignments.some((assignment) => assignment.ownerId === boss.id)).toBe(false);
    expect(saved.tasks.some((task) => task.ownerId === boss.id)).toBe(false);
  });
});
