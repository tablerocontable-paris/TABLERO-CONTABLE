// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { load, persist, seed } from "../src/data/repository";
import FiscalObligations from "../src/components/FiscalObligations";
import type { State } from "../src/domain/model";

describe("interfaz de obligaciones del laboratorio", () => {
  beforeEach(() => localStorage.clear());

  it("agrega ejemplos a un laboratorio anterior y conserva las revisiones al recargar", () => {
    localStorage.setItem("paris-state-lab", JSON.stringify(seed()));
    const migrated = load(true);
    expect(migrated.fiscalObligations).toHaveLength(2);
    expect(migrated.fiscalObligations?.every((row) => row.sourceLabel.includes("ficticio"))).toBe(true);
    const event = migrated.fiscalObligations![0]!;
    const revised = {
      ...migrated,
      fiscalObligations: migrated.fiscalObligations!.map((row) => row.id === event.id
        ? { ...row, revision: 2, updatedAt: "2026-10-05T12:00:00Z", history: [{ revision: 2, at: "2026-10-05T12:00:00Z", by: "boss", reason: "Corrección de prueba", dueOn: "2026-10-22", sourceLabel: row.sourceLabel, sourceRevision: "DEMO-02", sourceCheckedAt: null, requiredTaskIds: row.requiredTaskIds }] }
        : row),
    };
    persist(revised, true);
    expect(load(true).fiscalObligations?.find((row) => row.id === event.id)?.revision).toBe(2);
  });

  it("carga un hito con período distinto al vencimiento y vínculo de tarea explícito", () => {
    const state = seed();
    const operationalTask = state.tasks.find((task) => task.kind === "operativa")!;
    operationalTask.companyId = "c2";
    const commit = vi.fn((_next: State, _action?: string, _entityId?: string) => true);
    const notify = vi.fn();
    render(<FiscalObligations state={state} actor={state.profiles[0]!} month="2026-10" company="c2" commit={commit} notify={notify} openTask={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Plegar Obligaciones por empresa" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Plegar Obligaciones por empresa" }));
    expect(screen.getByRole("button", { name: "Nueva obligación" })).toBeTruthy();
    expect(screen.queryByText(state.fiscalObligations?.[0]?.title || "IVA mensual")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Nueva obligación" }));
    expect(screen.getByRole("button", { name: "Plegar Obligaciones por empresa" }).getAttribute("aria-expanded")).toBe("true");
    const taskOptions = [...document.querySelectorAll(".obligation-task-links label")];
    expect(taskOptions.length).toBeGreaterThan(0);
    expect(taskOptions.length).toBe(state.tasks.filter((task) => task.companyId === "c2" && task.kind === "resultado").length);
    expect(taskOptions.some((label) => label.textContent?.includes(operationalTask.title))).toBe(false);
    expect(taskOptions.every((label) => {
      const task = state.tasks.find((row) => label.textContent?.includes(row.title));
      return !task || task.kind === "resultado";
    })).toBe(true);
    fireEvent.change(screen.getByLabelText("Obligación"), { target: { value: "IVA de prueba" } });
    fireEvent.change(screen.getByLabelText("Período fiscal"), { target: { value: "2026-09" } });
    fireEvent.change(screen.getByLabelText("Fecha del vencimiento"), { target: { value: "2026-10-22" } });
    fireEvent.click(screen.getAllByRole("checkbox")[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Cargar obligación" }));

    expect(commit).toHaveBeenCalledTimes(1);
    const next = commit.mock.calls[0]![0];
    expect(next.fiscalObligations?.at(-1)).toMatchObject({
      title: "IVA de prueba", fiscalPeriod: "2026-09", dueOn: "2026-10-22", revision: 1, evaluationVersion: 2,
    });
    expect(next.fiscalObligations?.at(-1)?.requiredTaskIds).toHaveLength(1);
    expect(next.tasks.find((task) => task.id === next.fiscalObligations?.at(-1)?.requiredTaskIds[0])?.kind).toBe("resultado");
    expect(commit.mock.calls[0]![1]).toBe("fiscal_obligation.created");
    expect(notify).toHaveBeenCalledWith("La obligación quedó cargada en la agenda del laboratorio.");
  });

  it("muestra al empleado sólo los hitos vinculados a tareas que puede trabajar", () => {
    const state = seed();
    const task = state.tasks.find((row) => row.companyId === "c2" && row.ownerId === "e0" && row.title === "Liquidación y control de IVA")!;
    state.fiscalObligations = [{
      id: "linked", companyId: "c2", obligationCode: "iva-mensual", title: "IVA de ejemplo",
      fiscalPeriod: "2026-09", milestone: "presentation", dueOn: "2026-10-20",
      sourceLabel: "Dato ficticio", sourceRevision: "DEMO-01", sourceCheckedAt: null,
      revision: 1, requiredTaskIds: [task.id], createdAt: "2026-10-01T12:00:00Z",
      createdBy: "boss", updatedAt: "2026-10-01T12:00:00Z", history: [],
    }];
    const { rerender } = render(<FiscalObligations state={state} actor={state.profiles.find((row) => row.id === "e0")!} month="2026-10" company="c2" commit={vi.fn(() => true)} notify={vi.fn()} openTask={vi.fn()} />);
    expect(screen.getByText("IVA de ejemplo")).toBeTruthy();
    expect(screen.getByText(/Evaluación histórica/)).toBeTruthy();
    rerender(<FiscalObligations state={state} actor={state.profiles.find((row) => row.id === "e1")!} month="2026-10" company="c2" commit={vi.fn(() => true)} notify={vi.fn()} openTask={vi.fn()} />);
    expect(screen.queryByText("IVA de ejemplo")).toBeNull();
  });

  it("señala y conserva el vínculo operativo de un hito histórico", () => {
    const state = seed();
    const task = state.tasks.find((row) => row.kind === "operativa")!;
    task.companyId = "c2";
    state.fiscalObligations = [{
      id: "legacy-operational", companyId: "c2", obligationCode: "IVA-LEGACY",
      title: "Hito histórico", fiscalPeriod: "2026-09", milestone: "presentation",
      dueOn: "2026-10-20", sourceLabel: "Dato ficticio", sourceRevision: "1",
      sourceCheckedAt: null, revision: 1, requiredTaskIds: [task.id],
      createdAt: "2026-10-01T12:00:00Z", createdBy: "boss",
      updatedAt: "2026-10-01T12:00:00Z", history: [],
    }];
    render(<FiscalObligations state={state} actor={state.profiles.find((row) => row.id === "boss")!} month="2026-10" company="c2" commit={vi.fn(() => true)} notify={vi.fn()} openTask={vi.fn()} />);
    expect(screen.getByText(/Evaluación histórica.*1 vínculo operativo requiere revisión/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Revisar vencimiento, fuente o vínculos/ }));
    const historicalChoice = [...document.querySelectorAll(".obligation-task-links label")]
      .find((label) => label.textContent?.includes("vínculo histórico") && label.textContent.includes(task.title));
    expect(historicalChoice).toBeTruthy();
    expect(historicalChoice?.querySelector("input")?.checked).toBe(true);
  });
});
