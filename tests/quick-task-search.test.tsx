// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import App from "../src/App";
import QuickTaskSearch from "../src/components/QuickTaskSearch";
import { KEY, seed } from "../src/data/repository";
import { currentMonth } from "../src/domain/model";
import type { State } from "../src/domain/model";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("búsqueda rápida de tareas", () => {
  it("busca sin distinguir tildes y respeta el ámbito del perfil activo", () => {
    const state = seed();
    const active = state.profiles.find((profile) => profile.id === "e0")!;
    const hidden = {
      ...state.tasks.find((task) => task.ownerId === "e1")!,
      id: "private-search-task",
      title: "Tarea privada no visible para Valentino",
    };
    state.tasks.push(hidden);
    render(<QuickTaskSearch state={state} active={active} currentMonth={currentMonth()} onClose={() => {}} onSelect={() => {}} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar tareas por nombre, empresa, persona o período" }), { target: { value: "conciliacion banco nacion" } });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toContain("Conciliación Banco Nación");
    expect(options[1].textContent).toContain("Conciliación Banco Nación");
    expect(screen.queryByText(/Tarea privada no visible/)).toBeNull();
    expect(screen.getByText(/2 resultados ·/)).toBeTruthy();
  });

  it("permite a jefatura localizar empresas y responsables autorizados", () => {
    const state = seed();
    const active = state.profiles.find((profile) => profile.id === "boss")!;
    const target = state.tasks.find((task) => task.ownerId === "e0" && task.title === "Liquidación y control de IVA")!;
    const onSelect = vi.fn();
    render(<QuickTaskSearch state={state} active={active} currentMonth={currentMonth()} onClose={() => {}} onSelect={onSelect} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar tareas por nombre, empresa, persona o período" }), { target: { value: "valentino empresa 2" } });
    const result = screen.getByRole("option", { name: /Liquidación y control de IVA/ });
    fireEvent.click(result);
    expect(onSelect).toHaveBeenCalledWith(target);
  });

  it("abre una tarea histórica sin cambiar el perfil que actúa", () => {
    const state: State = seed();
    state.activeId = "boss";
    state.assignments = [];
    const target = {
      ...state.tasks.find((task) => task.ownerId === "e0")!,
      id: "historical-search-task",
      title: "Declaración histórica IVA",
      month: "2026-09",
      due: "2026-09-25",
      status: "Pendiente" as const,
      completedAt: null,
    };
    state.tasks = [target];
    localStorage.setItem("paris-environment", "lab");
    localStorage.setItem("paris-state-lab", JSON.stringify(state));
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);

    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    const search = screen.getByRole("searchbox", { name: "Buscar tareas por nombre, empresa, persona o período" });
    fireEvent.change(search, { target: { value: "declaracion historica" } });
    fireEvent.click(screen.getByRole("option", { name: /Declaración histórica IVA/ }));

    expect(screen.getByRole("heading", { name: "Declaración histórica IVA" })).toBeTruthy();
    expect(document.querySelector('nav button.active')?.getAttribute("data-nav")).toBe("tasks");
    expect(JSON.parse(localStorage.getItem("paris-state-lab")!).activeId).toBe("boss");
  });

  it("muestra un estado vacío cuando no hay coincidencias accesibles", () => {
    const state = seed();
    const active = state.profiles.find((profile) => profile.id === "e0")!;
    render(<QuickTaskSearch state={state} active={active} currentMonth={currentMonth()} onClose={() => {}} onSelect={() => {}} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar tareas por nombre, empresa, persona o período" }), { target: { value: "ninguna tarea con este nombre" } });
    expect(screen.getByText("No encontramos tareas accesibles con ese criterio.")).toBeTruthy();
    expect(within(screen.getByRole("dialog")).queryAllByRole("option")).toHaveLength(0);
  });
});
