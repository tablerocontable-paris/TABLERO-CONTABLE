// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import CompanyClosureManager from "../src/components/CompanyClosureManager";
import { seed } from "../src/data/repository";
import { currentMonth, dateART } from "../src/domain/model";

afterEach(cleanup);

describe("vista de cierres por grupo conjunto", () => {
  it("invalida la confirmación al cambiar el período sin desmontar el panel", () => {
    const state = seed();
    const month = currentMonth();
    const prior = new Date(`${month}-01T12:00:00Z`);
    prior.setUTCMonth(prior.getUTCMonth() - 1);
    const priorMonth = dateART(prior.toISOString()).slice(0, 7);
    const boss = state.profiles.find((profile) => profile.role === "jefe")!;
    const task = state.tasks.find((row) => row.ownerId === "e0" && row.companyId === "c1" && row.month === month)!;
    state.tasks = [...state.tasks, { ...task, id: "prior-period-close-unit", month: priorMonth, due: `${priorMonth}-20`, sessions: [] }];
    const props = {
      state, actor: boss, month, commit: vi.fn(() => true),
      companyOf: (companyId: string) => state.companies.find((company) => company.id === companyId)?.name || companyId,
      nameOf: (profileId: string) => state.profiles.find((profile) => profile.id === profileId)?.name || profileId,
      teamName: (teamId: string) => state.teams.find((team) => team.id === teamId)?.name || teamId,
      notify: vi.fn(),
    };
    const view = render(<CompanyClosureManager {...props} />);
    fireEvent.change(screen.getByLabelText("Alcance"), { target: { value: "person" } });
    fireEvent.change(screen.getByLabelText("Seleccionar persona"), { target: { value: "e0" } });
    const confirmation = screen.getByRole("checkbox");
    fireEvent.click(confirmation);
    expect((confirmation as HTMLInputElement).checked).toBe(true);
    view.rerender(<CompanyClosureManager {...props} month={priorMonth} />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect(props.commit).not.toHaveBeenCalled();
  });

  it("marca todas las unidades enlazadas pendientes si una persona tiene otro reloj activo", () => {
    const state = seed();
    const month = currentMonth();
    const boss = state.profiles.find((profile) => profile.role === "jefe")!;
    const first = state.profiles.find((profile) => profile.id === "e0")!;
    const second = state.profiles.find((profile) => profile.id === "e1")!;
    const jointSource = state.tasks.find((task) => task.ownerId === first.id && task.companyId === "c1" && task.month === month && task.kind === "resultado")!;
    const otherTask = state.tasks.find((task) => task.ownerId === second.id && task.companyId === "c1" && task.month === month && task.kind === "resultado" && task.id !== jointSource.id)!;
    state.tasks = state.tasks.map((task) => task.id === jointSource.id
      ? {
          ...task,
          status: "Completada" as const,
          completedAt: `${month}-07T17:00:00.000Z`,
          sessions: [],
          responsibility: {
            version: 1 as const,
            revision: 1 as const,
            mode: "joint" as const,
            activatedAt: `${month}-01T12:00:00.000Z`,
            activatedBy: boss.id,
            reason: "Control conjunto",
            members: [
              { profileId: first.id, shareBps: 5000, name: first.name, teamId: first.teamId, sector: first.sector },
              { profileId: second.id, shareBps: 5000, name: second.name, teamId: second.teamId, sector: second.sector },
            ],
          },
        }
      : task.id === otherTask.id
        ? { ...task, status: "En curso" as const, sessions: [{ id: "active-partner-clock", actorId: second.id, start: `${month}-08T10:00:00.000Z`, end: null }] }
        : task);

    render(<CompanyClosureManager
      state={state}
      actor={boss}
      month={month}
      commit={vi.fn(() => true)}
      companyOf={(companyId) => state.companies.find((company) => company.id === companyId)?.name || companyId}
      nameOf={(profileId) => state.profiles.find((profile) => profile.id === profileId)?.name || profileId}
      teamName={(teamId) => state.teams.find((team) => team.id === teamId)?.name || teamId}
      notify={vi.fn()}
    />);

    fireEvent.change(screen.getByLabelText("Alcance"), { target: { value: "person" } });
    fireEvent.change(screen.getByLabelText("Seleccionar persona"), { target: { value: first.id } });
    const companyName = state.companies.find((company) => company.id === "c1")!.name;
    for (const profile of [first, second]) {
      const row = screen.getAllByRole("row").find((candidate) => candidate.textContent?.includes(profile.name) && candidate.textContent?.includes(companyName));
      expect(row).toBeTruthy();
      expect(within(row!).getByText(/Pendiente:.*cronómetros activos/i)).toBeTruthy();
    }
    expect(document.querySelector(".lab-close-count")?.textContent).toContain("2 pendientes");
  });

  it("invalida la confirmación cuando cambia la preparación de una unidad ya revisada", () => {
    const original = seed();
    const month = currentMonth();
    const boss = original.profiles.find((profile) => profile.role === "jefe")!;
    const task = original.tasks.find((row) => row.ownerId === "e0" && row.companyId === "c1" && row.month === month)!;
    const props = {
      state: original, actor: boss, month, commit: vi.fn(() => true),
      companyOf: (companyId: string) => original.companies.find((company) => company.id === companyId)?.name || companyId,
      nameOf: (profileId: string) => original.profiles.find((profile) => profile.id === profileId)?.name || profileId,
      teamName: (teamId: string) => original.teams.find((team) => team.id === teamId)?.name || teamId,
      notify: vi.fn(),
    };
    const view = render(<CompanyClosureManager {...props} />);
    fireEvent.change(screen.getByLabelText("Alcance"), { target: { value: "person" } });
    fireEvent.change(screen.getByLabelText("Seleccionar persona"), { target: { value: "e0" } });
    const confirmation = screen.getByRole("checkbox");
    fireEvent.click(confirmation);
    expect((confirmation as HTMLInputElement).checked).toBe(true);

    const changed = {
      ...original,
      tasks: original.tasks.map((row) => row.id === task.id
        ? { ...row, sessions: [{ id: "started-after-preview", actorId: "e0", start: `${month}-10T10:00:00.000Z`, end: null }] }
        : row),
    };
    view.rerender(<CompanyClosureManager {...props} state={changed} />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/Pendiente:.*cronómetros activos/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Cerrar .* unidades listas/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(props.commit).not.toHaveBeenCalled();
  });
});
