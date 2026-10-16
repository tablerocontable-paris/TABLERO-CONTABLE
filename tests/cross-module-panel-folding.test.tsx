// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import JointTaskSetup from "../src/components/JointTaskSetup";
import LaboratoryInvitations from "../src/components/LaboratoryInvitations";
import WorkspaceSetup from "../src/components/WorkspaceSetup";
import { seed } from "../src/data/repository";

afterEach(cleanup);

describe("paneles extensos plegables entre módulos", () => {
  it("pliega y reabre configuración de empresas sin perder los campos", () => {
    render(<WorkspaceSetup state={seed()} commit={vi.fn(() => true)} presence={{}} />);

    fireEvent.click(screen.getByRole("button", { name: "Plegar Empresas y acceso" }));
    expect(screen.queryByRole("textbox", { name: "Empresa 1" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Desplegar Empresas y acceso" }));
    expect(screen.getByRole("textbox", { name: "Empresa 1" })).toBeTruthy();
  });

  it("pliega y reabre invitaciones de prueba sin ocultar la acción del panel", () => {
    const state = seed();
    render(<LaboratoryInvitations state={state} />);
    const profile = state.profiles.find((row) => row.active)!;

    fireEvent.click(screen.getByRole("button", { name: "Plegar Invitaciones de prueba" }));
    expect(screen.queryByRole("link", { name: `Probar invitación de ${profile.name}` })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Desplegar Invitaciones de prueba" }));
    expect(screen.getByRole("link", { name: `Probar invitación de ${profile.name}` })).toBeTruthy();
  });

  it("pliega la información de integrantes sin cambiar la responsabilidad", () => {
    const state = seed();
    const task = { ...state.tasks[0]! };
    const first = state.profiles.find((row) => row.id === task.ownerId)!;
    const second = state.profiles.find((row) => row.active && row.id !== first.id && row.role === "empleado")!;
    task.responsibility = {
      version: 1,
      revision: 1,
      mode: "joint",
      activatedAt: "2026-10-01T10:00:00.000Z",
      activatedBy: "boss",
      reason: "Cobertura de cierre",
      members: [
        { profileId: first.id, shareBps: 6000, name: first.name, teamId: first.teamId, sector: first.sector },
        { profileId: second.id, shareBps: 4000, name: second.name, teamId: second.teamId, sector: second.sector },
      ],
    };
    const boss = state.profiles.find((row) => row.role === "jefe")!;

    render(<JointTaskSetup state={state} task={task} actor={boss} commit={vi.fn(() => true)} notify={vi.fn()} />);
    const panel = screen.getByRole("heading", { name: "Responsabilidad conjunta" }).closest(".panel")!;
    fireEvent.click(screen.getByRole("button", { name: "Plegar Responsabilidad conjunta" }));
    expect(panel.querySelector<HTMLElement>(".panel-body")?.hidden).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Desplegar Responsabilidad conjunta" }));
    expect(panel.querySelector<HTMLElement>(".panel-body")?.hidden).toBe(false);
    expect(screen.getByText(first.name)).toBeTruthy();
    expect(screen.getByText(second.name)).toBeTruthy();
  });
});
