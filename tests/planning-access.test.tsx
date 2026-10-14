// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Planning from "../src/components/Planning";
import { seed } from "../src/data/repository";

afterEach(cleanup);

describe("privacidad actual de Planificación", () => {
  it("recalcula filas, búsqueda y conteo al revocar una empresa con el panel abierto", () => {
    const state = seed();
    const base = state.assignments.find((row) => row.ownerId === "e0")!;
    state.assignments = [
      { ...base, id: "private-c1", companyId: "c1", ownerId: "e0", title: "Regla reservada revocada" },
      { ...base, id: "visible-c2", companyId: "c2", ownerId: "e0", title: "Regla vigente del equipo" },
      { ...base, id: "outside-team", companyId: "c2", ownerId: "e6", title: "Regla de otro equipo" },
    ];
    state.activeId = "m1";
    const notify = vi.fn();
    const view = render(<Planning state={state} month="2026-10" commit={() => true} notify={notify} />);

    fireEvent.click(screen.getByRole("button", { name: "Desplegar Planificación y recurrencias" }));
    expect(screen.getByText("Regla reservada revocada")).toBeTruthy();
    expect(screen.getByText("Regla vigente del equipo")).toBeTruthy();
    expect(screen.queryByText("Regla de otro equipo")).toBeNull();
    expect(screen.getByText(/2 reglas/)).toBeTruthy();

    const revoked = {
      ...state,
      profiles: state.profiles.map((profile) => profile.id === "m1"
        ? { ...profile, companyIds: profile.companyIds.filter((companyId) => companyId !== "c1") }
        : profile),
    };
    view.rerender(<Planning state={revoked} month="2026-10" commit={() => true} notify={notify} />);

    expect(screen.queryByText("Regla reservada revocada")).toBeNull();
    expect(screen.getByText("Regla vigente del equipo")).toBeTruthy();
    expect(screen.queryByText("Regla de otro equipo")).toBeNull();
    expect(screen.getByText(/1 regla ·/)).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar planificación" }), { target: { value: "reservada" } });
    expect(screen.queryByText("Regla reservada revocada")).toBeNull();
    expect(screen.getByText(/0 reglas ·/)).toBeTruthy();
  });

  it("mantiene el alcance organizacional de jefatura sin membresía directa", () => {
    const state = seed();
    const base = state.assignments.find((row) => row.ownerId === "e0")!;
    state.assignments = [{ ...base, id: "boss-global", companyId: "c1", ownerId: "e6", title: "Regla organizacional" }];
    state.activeId = "boss";
    state.profiles = state.profiles.map((profile) => profile.id === "boss" ? { ...profile, companyIds: [] } : profile);
    render(<Planning state={state} month="2026-10" commit={() => true} notify={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Desplegar Planificación y recurrencias" }));
    expect(screen.getByText("Regla organizacional")).toBeTruthy();
    expect(screen.getByText(/1 regla ·/)).toBeTruthy();
  });
});
