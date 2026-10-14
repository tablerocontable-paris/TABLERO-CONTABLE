// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EmployeePicker from "../src/components/EmployeePicker";
import { seed } from "../src/data/repository";

afterEach(cleanup);

describe("selector de personas", () => {
  it("busca por nombre, sector o equipo y muestra grupos con iniciales y tonos", () => {
    const state = seed();
    const onChange = vi.fn();
    render(<EmployeePicker label="Tareas de" selectLabel="Perfil que estás viendo" profiles={state.profiles.filter((profile) => profile.active)} teams={state.teams} value="e0" onChange={onChange} emptyLabel="Elegí una persona" />);

    const trigger = screen.getByRole("button", { name: "Perfil que estás viendo" });
    expect(trigger.textContent).toContain("Valentino Magni");
    expect(trigger.textContent).toContain("VM");
    fireEvent.click(trigger);
    const search = screen.getByRole("combobox", { name: "Buscar persona en Tareas de" });
    const listbox = screen.getByRole("listbox", { name: "Perfil que estás viendo" });
    expect(within(listbox).getByRole("option", { name: /Valentino Magni/i })).toBeTruthy();
    const groups = [...document.querySelectorAll(".employee-picker-group")];
    expect(groups.length).toBeGreaterThan(1);
    expect(groups.every((group) => group.getAttribute("data-tone") !== null)).toBe(true);
    expect(new Set(groups.map((group) => group.getAttribute("data-tone"))).size).toBeGreaterThan(1);

    fireEvent.change(search, { target: { value: "tesoreria" } });
    expect(within(listbox).getByRole("option", { name: /Valentino Magni/i })).toBeTruthy();
    expect(within(listbox).queryByRole("option", { name: /Camila Vera/ })).toBeNull();
    fireEvent.change(search, { target: { value: "" } });
    const selectedProfile = state.profiles.find((profile) => profile.id === "e1")!;
    fireEvent.click(within(listbox).getByRole("option", { name: new RegExp(selectedProfile.name) }));
    expect(onChange).toHaveBeenCalledWith("e1");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("permite seleccionar con flechas y Enter, y cerrar con Escape", () => {
    const state = seed();
    const onChange = vi.fn();
    render(<EmployeePicker label="Tareas de" selectLabel="Perfil que estás viendo" profiles={state.profiles.filter((profile) => profile.active)} teams={state.teams} value="e0" onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "Perfil que estás viendo" });
    fireEvent.click(trigger);
    const search = screen.getByRole("combobox", { name: "Buscar persona en Tareas de" });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("e1");
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Buscar persona en Tareas de" }), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("mantiene visible la opción activa al saltar al final y al inicio", () => {
    const state = seed();
    const base = state.profiles.find((profile) => profile.id === "e0")!;
    const profiles = Array.from({ length: 24 }, (_, index) => ({ ...base, id: `test-${index}`, name: `Persona ${String(index + 1).padStart(2, "0")}` }));
    render(<EmployeePicker label="Tareas de" selectLabel="Perfil que estás viendo" profiles={profiles} teams={state.teams} value="test-0" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Perfil que estás viendo" }));
    const search = screen.getByRole("combobox", { name: "Buscar persona en Tareas de" });
    const list = document.querySelector<HTMLElement>(".employee-picker-listbox")!;
    const last = list.querySelector<HTMLElement>('[data-profile-id="test-23"]')!;
    vi.spyOn(list, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 120, left: 0, right: 300, width: 300, height: 120, x: 0, y: 0, toJSON() {} });
    vi.spyOn(last, "getBoundingClientRect").mockReturnValue({ top: 360, bottom: 400, left: 0, right: 300, width: 300, height: 40, x: 0, y: 360, toJSON() {} });
    fireEvent.keyDown(search, { key: "End" });
    expect(search.getAttribute("aria-activedescendant")).toBe(last.id);
    expect(list.scrollTop).toBeGreaterThan(0);
    fireEvent.keyDown(search, { key: "Home" });
    expect(search.getAttribute("aria-activedescendant")).toContain("test-0");
  });

  it("Tab y Shift+Tab cierran el selector y continúan el foco fuera de la lista", async () => {
    const state = seed();
    render(<><EmployeePicker label="Tareas de" selectLabel="Perfil que estás viendo" profiles={state.profiles.filter((profile) => profile.active)} teams={state.teams} value="e0" onChange={() => {}} /><button type="button">Después del selector</button></>);
    const trigger = screen.getByRole("button", { name: "Perfil que estás viendo" });
    fireEvent.click(trigger);
    const search = screen.getByRole("combobox", { name: "Buscar persona en Tareas de" });
    fireEvent.keyDown(search, { key: "Tab", shiftKey: true });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.click(trigger);
    const reopenedSearch = screen.getByRole("combobox", { name: "Buscar persona en Tareas de" });
    fireEvent.keyDown(reopenedSearch, { key: "Tab" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Después del selector" })));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
