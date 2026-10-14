// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seed } from "../src/data/repository";
import OperationalRatePanel from "../src/components/OperationalRatePanel";
import { dateART, type State } from "../src/domain/model";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("coeficiente para tarea operativa puntual", () => {
  it("usa calendario ART aunque el navegador tenga otra zona local", () => {
    vi.stubEnv("TZ", "Pacific/Kiritimati");
    expect(new Date("2026-10-09T02:59:00.000Z").getDate()).toBe(9);
    expect(dateART("2026-10-09T02:59:00.000Z")).toBe("2026-10-08");
  });

  it.each([
    ["2026-10-09T02:59:00.000Z", "2026-10-08", "2026-10-09T03:00:00.000Z"],
    ["2026-12-31T23:59:00.000Z", "2026-12-31", "2027-01-01T03:00:00.000Z"],
  ])("inicializa y conserva la fecha ART elegida en el borde %s", (instant, expectedDay, nextInstant) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(instant));
    const state = seed();
    const boss = state.profiles.find((profile) => profile.role === "jefe")!;
    render(<OperationalRatePanel state={state} actor={boss} commit={vi.fn(() => true)} notify={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Desplegar Coeficientes por movimiento" }));
    const effectiveDate = screen.getByLabelText("Vigente desde") as HTMLInputElement;
    expect(effectiveDate.value).toBe(expectedDay);
    fireEvent.change(effectiveDate, { target: { value: "2026-11-17" } });
    vi.setSystemTime(new Date(nextInstant));
    expect(effectiveDate.value).toBe("2026-11-17");
  });

  it("envía taskId y empresa correctos desde el formulario del jefe", () => {
    const state = seed();
    const boss = state.profiles.find((profile) => profile.role === "jefe")!;
    const task = state.tasks.find((row) => row.kind === "operativa" && row.companyId === "c1")!;
    const commit = vi.fn((_next: State, _action?: string, _entityId?: string) => true);
    const notify = vi.fn();
    render(<OperationalRatePanel state={state} actor={boss} commit={commit} notify={notify} />);

    fireEvent.click(screen.getByRole("button", { name: "Desplegar Coeficientes por movimiento" }));
    fireEvent.change(screen.getByLabelText("Aplicar a"), { target: { value: "task" } });
    fireEvent.change(screen.getByLabelText("Empresa"), { target: { value: task.companyId } });
    fireEvent.change(screen.getByLabelText("Tarea puntual"), { target: { value: task.id } });
    fireEvent.change(screen.getByLabelText("Peso por movimiento"), { target: { value: "2.5" } });
    fireEvent.submit(screen.getByRole("button", { name: "Guardar nueva versión" }).closest("form")!);

    expect(commit).toHaveBeenCalledTimes(1);
    const next = commit.mock.calls[0]![0];
    expect(next.operationalRates).toMatchObject([{ templateId: null, taskId: task.id, companyId: task.companyId, unitWeight: 2.5, version: 1 }]);
    expect(commit.mock.calls[0]![2]).toBe(task.id);
    expect(notify).toHaveBeenCalledWith("Coeficiente guardado; los registros anteriores mantienen su peso original.");
  });

  it("mantiene empresa visible y tarea puntual dentro del mismo ámbito del jefe", () => {
    const base = seed();
    const sourceTask = base.tasks.find((row) => row.kind === "operativa")!;
    const task = { ...sourceTask, id: "test-operativa-c2", companyId: "c2" };
    const state = { ...base, tasks: [...base.tasks, task] };
    const boss = { ...state.profiles.find((profile) => profile.role === "jefe")!, companyIds: ["c2"] };
    const commit = vi.fn((_next: State, _action?: string, _entityId?: string) => true);
    const notify = vi.fn();
    render(<OperationalRatePanel state={state} actor={boss} company="c2" commit={commit} notify={notify} />);

    fireEvent.click(screen.getByRole("button", { name: "Desplegar Coeficientes por movimiento" }));
    expect((screen.getByLabelText("Empresa") as HTMLSelectElement).value).toBe("c2");
    fireEvent.change(screen.getByLabelText("Aplicar a"), { target: { value: "task" } });
    const taskSelect = screen.getByLabelText("Tarea puntual") as HTMLSelectElement;
    expect([...taskSelect.options].some((option) => option.textContent?.includes("Empresa 1"))).toBe(false);
    fireEvent.change(taskSelect, { target: { value: task.id } });
    fireEvent.submit(screen.getByRole("button", { name: "Guardar nueva versión" }).closest("form")!);

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]![0].operationalRates).toMatchObject([{ taskId: task.id, companyId: "c2" }]);
  });
});
