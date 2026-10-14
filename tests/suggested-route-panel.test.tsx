// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SuggestedRoutePanel from "../src/components/SuggestedRoutePanel";
import { seed } from "../src/data/repository";
import { updateTaskReadiness } from "../src/domain/laboratory-work";

afterEach(cleanup);

describe("hoja de ruta sugerida", () => {
  it("explica por qué cada tarea habilitada ocupa esa posición", () => {
    const state = seed();
    const base = state.tasks.find((task) => task.ownerId === "e0" && task.kind === "resultado" && !task.responsibility)!;
    state.tasks = [
      { ...base, id: "route-earlier", title: "Vence antes", status: "Pendiente", due: "2026-10-10", priority: "Media", weight: 2, scheduledOn: "2026-10-09", blockedBy: "", blockedSince: null, dependsOnTaskIds: [], availableFrom: null },
      { ...base, id: "route-later", title: "Vence después", status: "Pendiente", due: "2026-10-20", priority: "Media", weight: 2, scheduledOn: "2026-10-09", blockedBy: "", blockedSince: null, dependsOnTaskIds: [], availableFrom: null },
    ];
    const companyOf = (id: string) => state.companies.find((company) => company.id === id)?.name || id;
    render(<SuggestedRoutePanel state={state} actor={state.profiles.find((profile) => profile.id === "e0")!} profileId="e0" month={base.month} companyOf={companyOf} onOpen={vi.fn()} />);

    const first = screen.getByRole("button", { name: /Vence antes/ }).parentElement!;
    fireEvent.click(within(first).getByText("Por qué está en esta posición"));
    expect(within(first).getByText(/Es la primera tarea habilitada.*vencimiento \(2026-10-10\).*prioridad Media, peso 2/)).toBeTruthy();

    const second = screen.getByRole("button", { name: /Vence después/ }).parentElement!;
    fireEvent.click(within(second).getByText("Por qué está en esta posición"));
    expect(within(second).getByText(/“Vence antes” queda antes porque vence 2026-10-10; esta tarea vence 2026-10-20/)).toBeTruthy();
  });

  it("explica los desempates por prioridad, peso, programación y estabilidad", () => {
    const state = seed();
    const base = state.tasks.find((task) => task.ownerId === "e0" && task.kind === "resultado" && !task.responsibility)!;
    const common = { ...base, status: "Pendiente" as const, due: "2026-10-10", blockedBy: "", blockedSince: null, dependsOnTaskIds: [], availableFrom: null };
    state.tasks = [
      { ...common, id: "route-a", title: "Prioridad alta", priority: "Alta", weight: 1, scheduledOn: "2026-10-20" },
      { ...common, id: "route-b", title: "Peso cinco", priority: "Media", weight: 5, scheduledOn: "2026-10-20" },
      { ...common, id: "route-c", title: "Peso cuatro", priority: "Media", weight: 4, scheduledOn: "2026-10-20" },
      { ...common, id: "route-d", title: "Programada después", priority: "Media", weight: 4, scheduledOn: "2026-10-22" },
      { ...common, id: "route-e", title: "Desempate estable", priority: "Media", weight: 4, scheduledOn: "2026-10-22" },
    ];
    const companyOf = (id: string) => state.companies.find((company) => company.id === id)?.name || id;
    render(<SuggestedRoutePanel state={state} actor={state.profiles.find((profile) => profile.id === "e0")!} profileId="e0" month={base.month} companyOf={companyOf} onOpen={vi.fn()} />);
    const explanationFor = (title: string) => {
      const entry = screen.getByRole("button", { name: new RegExp(title) }).parentElement!;
      fireEvent.click(within(entry).getByText("Por qué está en esta posición"));
      return within(entry).getByText((_, element) => element?.tagName === "P").textContent || "";
    };
    expect(explanationFor("Peso cinco")).toContain("prioridad Alta es más alta");
    expect(explanationFor("Peso cuatro")).toContain("peso 5");
    expect(explanationFor("Programada después")).toContain("fecha programada 2026-10-20");
    expect(explanationFor("Desempate estable")).toContain("Empatan en vencimiento, prioridad, peso y fecha programada");
  });

  it("busca tareas y filtra entre habilitadas y en espera sin alterar su orden recomendado", () => {
    const state = seed();
    const base = state.tasks.find((task) => task.ownerId === "e0" && task.kind === "resultado" && task.status !== "Completada");
    expect(base).toBeTruthy();
    state.tasks.push({ ...base!, id: "route-filter-dependent", title: "Informe de conciliación dependiente", dependsOnTaskIds: [base!.id] });
    const onOpen = vi.fn();
    const companyOf = (id: string) => state.companies.find((company) => company.id === id)?.name || id;
    render(<SuggestedRoutePanel state={state} actor={state.profiles.find((profile) => profile.id === "e0")!} profileId="e0" month={base!.month} companyOf={companyOf} onOpen={onOpen} />);

    const filter = screen.getByRole("combobox", { name: "Filtrar tareas de la hoja de ruta" });
    const search = screen.getByRole("searchbox", { name: "Buscar en la hoja de ruta" });
    fireEvent.change(filter, { target: { value: "waiting" } });
    const waitingSummary = screen.getAllByText(/tareas en espera/).find((node) => node.tagName === "SUMMARY");
    expect(waitingSummary?.closest("details")?.open).toBe(true);
    expect(screen.getByRole("button", { name: /Informe de conciliación dependiente/ })).toBeTruthy();
    fireEvent.change(search, { target: { value: "no existe" } });
    expect(screen.getByText("No hay tareas que coincidan con la búsqueda y el filtro.")).toBeTruthy();
    fireEvent.change(search, { target: { value: "informe de conciliación" } });
    fireEvent.click(screen.getByRole("button", { name: /Informe de conciliación dependiente/ }));
    expect(onOpen).toHaveBeenCalledWith("route-filter-dependent");
    fireEvent.change(filter, { target: { value: "ready" } });
    expect(screen.queryByRole("button", { name: /Informe de conciliación dependiente/ })).toBeNull();
  });

  it("no expone al encargado tareas del perfil consultado en empresas no autorizadas", () => {
    const state = seed();
    const base = state.tasks.find((task) => task.ownerId === "e0" && task.companyId === "c1" && task.kind === "resultado")!;
    const manager = state.profiles.find((profile) => profile.id === "m1")!;
    const scopedManager = { ...manager, companyIds: manager.companyIds.filter((companyId) => companyId !== "c1") };
    state.profiles = state.profiles.map((profile) => profile.id === manager.id ? scopedManager : profile);
    const companyOf = (id: string) => state.companies.find((company) => company.id === id)?.name || id;
    render(<SuggestedRoutePanel state={state} actor={scopedManager} profileId="e0" month={base.month} companyId="c1" companyOf={companyOf} onOpen={vi.fn()} />);

    expect(screen.getByText("No hay entregables pendientes para este perfil con los filtros seleccionados.")).toBeTruthy();
    expect(screen.queryByText(base.title)).toBeNull();
  });

  it("explica dependencias según quien consulta y mantiene oculto el título fuera de su ámbito", () => {
    const state = seed();
    const employeeTask = state.tasks.find((task) => task.ownerId === "e0" && task.companyId === "c1" && task.kind === "resultado")!;
    const otherTeamTask = state.tasks.find((task) => task.ownerId === "e5" && task.companyId === "c1" && task.kind === "resultado")!;
    const target = { ...employeeTask, id: "route-subject-task", title: "Trabajo de Valentino", status: "Pendiente" as const, responsibility: undefined, blockedBy: "", blockedSince: null, dependsOnTaskIds: [], availableFrom: null };
    const dependency = { ...otherTeamTask, id: "route-private-dependency", title: "Dependencia del otro equipo", status: "Pendiente" as const, responsibility: undefined, blockedBy: "", blockedSince: null, dependsOnTaskIds: [], availableFrom: null };
    state.tasks = [target, dependency];
    const withDependency = updateTaskReadiness(state, target.id, { dependsOnTaskIds: [dependency.id], availableFrom: null }, "boss");
    const companyOf = (id: string) => withDependency.companies.find((company) => company.id === id)?.name || id;

    const boss = withDependency.profiles.find((profile) => profile.id === "boss")!;
    const bossView = render(<SuggestedRoutePanel state={withDependency} actor={boss} profileId="e0" month={target.month} companyId="c1" companyOf={companyOf} onOpen={vi.fn()} />);
    expect(screen.getByText("Espera Dependencia del otro equipo")).toBeTruthy();
    bossView.unmount();

    const manager = withDependency.profiles.find((profile) => profile.id === "m1")!;
    render(<SuggestedRoutePanel state={withDependency} actor={manager} profileId="e0" month={target.month} companyId="c1" companyOf={companyOf} onOpen={vi.fn()} />);
    expect(screen.getByText("Espera una tarea que no está disponible en tu ámbito")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar en la hoja de ruta" }), { target: { value: "Dependencia del otro equipo" } });
    expect(screen.queryByText("Trabajo de Valentino")).toBeNull();
    expect(screen.queryByText("Dependencia del otro equipo")).toBeNull();
  });
});
