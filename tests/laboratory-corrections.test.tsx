// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import LaboratoryWorkspace from "../src/components/LaboratoryWorkspace";
import App from "../src/App";
import ParameterizationInbox from "../src/components/ParameterizationInbox";
import ThemeControl from "../src/components/ThemeControl";
import JointTaskSetup from "../src/components/JointTaskSetup";
import { currentMonth } from "../src/domain/model";
import { seed, KEY, persist } from "../src/data/repository";
vi.mock("recharts", () =>
  Object.fromEntries(
    [
      "ResponsiveContainer",
      "BarChart",
      "Bar",
      "LabelList",
      "XAxis",
      "YAxis",
      "CartesianGrid",
      "Tooltip",
      "Legend",
      "LineChart",
      "Line",
      "ReferenceLine",
      "PieChart",
      "Pie",
      "Cell",
    ].map((k) => [k, () => null]),
  ),
);
beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("correcciones del laboratorio y las tarjetas", () => {
  it("no duplica la identidad activa en el selector de actor del laboratorio", () => {
    const state = seed();
    state.activeId = "e0";
    render(<App initialState={state} laboratoryMode />);
    expect(document.querySelector(".sidebar-bottom .employee-picker-current")).toBeNull();
    expect(document.querySelector(".sidebar-bottom .user .avatar")?.textContent).toBeTruthy();
  });
  it("no ofrece crear nuevas operativas conjuntas en el laboratorio", () => {
    const state = seed();
    const boss = state.profiles.find((profile) => profile.role === "jefe")!;
    const task = state.tasks.find((row) => row.kind === "operativa" && !row.responsibility)!;
    render(<JointTaskSetup state={state} task={task} actor={boss} laboratory commit={() => true} notify={() => {}} />);
    expect(screen.getByText(/Las operativas nuevas conservan una persona responsable/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Compartir tarea" })).toBeNull();
  });
  it("cierra el formulario de responsabilidad conjunta si se revoca la empresa", () => {
    const state = seed();
    const manager = state.profiles.find((profile) => profile.id === "m1")!;
    const task = state.tasks.find((row) => row.ownerId === "e0" && row.companyId === "c1" && row.kind === "resultado")!;
    const commit = vi.fn(() => true);
    const notify = vi.fn();
    const view = render(<JointTaskSetup state={state} task={{ ...task, assignmentId: null, templateId: null, status: "Pendiente", startedAt: null, completedAt: null, checklist: [] }} actor={manager} commit={commit} notify={notify} />);
    fireEvent.click(screen.getByRole("button", { name: "Compartir tarea" }));
    expect(screen.getByLabelText("Segundo responsable")).toBeTruthy();

    const revokedManager = { ...manager, companyIds: manager.companyIds.filter((companyId) => companyId !== "c1") };
    const revoked = { ...state, profiles: state.profiles.map((profile) => profile.id === manager.id ? revokedManager : profile) };
    view.rerender(<JointTaskSetup state={revoked} task={task} actor={revokedManager} commit={commit} notify={notify} />);

    expect(screen.queryByRole("button", { name: "Compartir tarea" })).toBeNull();
    expect(screen.queryByLabelText("Segundo responsable")).toBeNull();
    expect(commit).not.toHaveBeenCalled();
  });

  it("reduce el ruido de Análisis mensual sin mezclar puntos con cantidades", async () => {
    const state = seed();
    const boss = state.profiles.find((profile) => profile.role === "jefe")!;
    state.activeId = boss.id;
    state.onboarding[boss.id] = { ...state.onboarding[boss.id]!, step: 6, completedAt: "2026-10-01T12:00:00.000Z" };
    const [year, month] = currentMonth().split("-").map(Number);
    const previousMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
    state.tasks = [
      ...state.tasks,
      { ...state.tasks[0]!, id: "analytics-previous-period", month: previousMonth },
    ];
    render(<App initialState={state} laboratoryMode />);
    fireEvent.click(document.querySelector('[data-nav="analytics"]')!);

    expect(await screen.findByRole("heading", { name: "Evolución mensual" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Distribución de tareas" })).toBeTruthy();
    for (const title of ["Cumplimiento ponderado", "Evolución mensual", "Distribución de tareas"]) {
      const toggle = screen.getByRole("button", { name: `Plegar ${title}` });
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
    }
    const formula = screen.getByRole("button", {
      name: "Ver cómo se calcula el cumplimiento ponderado",
    });
    expect(formula.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/el laboratorio separa los indicadores/i)).toBeNull();
    fireEvent.click(formula);
    expect(screen.getByText(/el laboratorio separa los indicadores/i)).toBeTruthy();

    const onTime = screen.getByRole("button", { name: "Entregas en fecha" });
    fireEvent.click(onTime);
    expect(onTime.getAttribute("aria-pressed")).toBe("false");
    const distribution = screen.getByRole("group", { name: "Distribuir tareas por" });
    fireEvent.click(within(distribution).getByRole("button", { name: "Empresa" }));
    expect(within(distribution).getByRole("button", { name: "Empresa" }).getAttribute("aria-pressed")).toBe("true");

    const detailToggle = screen.getByRole("button", {
      name: "Desplegar Detalle que explica el indicador",
    });
    expect(detailToggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(detailToggle);
    expect(detailToggle.getAttribute("aria-expanded")).toBe("true");
  });
  it("mantiene el grupo con trabajo operativo aunque no tenga base de entregables", async () => {
    const state = seed();
    const boss = state.profiles.find((profile) => profile.role === "jefe")!;
    state.activeId = boss.id;
    state.onboarding[boss.id] = { ...state.onboarding[boss.id]!, step: 6, completedAt: "2026-10-01T12:00:00.000Z" };
    const operation = state.tasks.find((task) => task.kind === "operativa" && task.ownerId === "e0" && !task.responsibility)!;
    const result = state.tasks.find((task) => task.kind === "resultado" && task.ownerId === "e2" && !task.responsibility)!;
    state.assignments = [];
    state.tasks = [
      { ...operation, id: "only-ops-e0", ownerId: "e0", month: currentMonth(), due: "", status: "En curso", target: 0 },
      { ...operation, id: "only-ops-e1", ownerId: "e1", month: currentMonth(), due: "", status: "En curso", target: 0 },
      { ...result, id: "zero-result-e2", ownerId: "e2", month: currentMonth(), status: "Pendiente", completedAt: null, weight: 5 },
    ];
    state.operationalAssessments = [{ id: "assessment-e0", taskId: "only-ops-e0", profileId: "e0", companyId: operation.companyId, month: currentMonth(), quality: 90, order: 80, timeliness: 70, note: "Revisión de demostración", evaluatedAt: new Date().toISOString(), evaluatedBy: boss.id }];
    render(<App initialState={state} laboratoryMode />);
    fireEvent.click(document.querySelector('[data-nav="analytics"]')!);
    expect(await screen.findByRole("heading", { name: "Cumplimiento ponderado" })).toBeTruthy();
    expect(screen.getByText(/Sin base de entregables: Valentino Magni/)).toBeTruthy();
    expect(screen.getAllByText(/Calidad 90 · Orden 80 · Oportunidad 70/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Calidad sin evaluar · Orden sin evaluar · Oportunidad sin evaluar/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sin base").length).toBeGreaterThan(0);
    expect(screen.getByText(/0\.0 \/ 5 pts/)).toBeTruthy();

    let csv = "";
    vi.stubGlobal("Blob", class { constructor(parts: BlobPart[]) { csv = parts.join(""); } });
    vi.stubGlobal("URL", { createObjectURL: () => "blob:test", revokeObjectURL: () => {} });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
    expect(csv).toContain("Valentino Magni");
    expect(csv).toContain("Sin base");
    expect(csv).toContain("Sin evaluar");
    expect(csv).toContain('"Joaquín Pérez";"5";"0";"0";');
  });
  it("opens fictitious users and work without touching operational storage or API", () => {
    localStorage.setItem(KEY, "operational-data-do-not-touch");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<LaboratoryWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Vista de usuario" }));
    expect(screen.getAllByRole("option").length).toBeGreaterThan(10);
    expect(localStorage.getItem(KEY)).toBe("operational-data-do-not-touch");
    expect(fetch).not.toHaveBeenCalled();
    expect(
      JSON.parse(localStorage.getItem("paris-state-lab")!).tasks.length,
    ).toBeGreaterThan(50);
    expect(screen.queryByText("Volver al tablero")).toBeNull();
  });
  it("preserves existing lab data and never imports old operational/legacy rows", () => {
    const s = seed();
    s.profiles[0].name = "Jefe de prueba conservado";
    persist(s, true);
    localStorage.setItem(
      "paris-tasks-v1",
      JSON.stringify([{ id: "legacy", title: "REAL SECRET" }]),
    );
    render(<LaboratoryWorkspace />);
    expect(screen.getByRole("button", { name: "Vista de usuario" }).textContent).toContain(
      "Jefe de prueba conservado",
    );
    expect(
      JSON.parse(localStorage.getItem("paris-state-lab")!).tasks.some(
        (t: { id: string }) => t.id === "legacy-legacy",
      ),
    ).toBe(false);
  });
  it("shows recovery instead of substituting the seed when laboratory storage is corrupt", () => {
    localStorage.setItem("paris-state-lab", "");
    render(<LaboratoryWorkspace />);
    expect(screen.getByRole("heading", { name: "No se pudo leer el laboratorio" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Vista de usuario" })).toBeNull();
    expect(localStorage.getItem("paris-state-lab")).toBe("");
  });
  it("keeps a legacy laboratory copy unchanged until its normalized format is saved", async () => {
    const legacy = seed();
    legacy.profiles.find((profile) => profile.id === "boss")!.name = "Juan · Jefe de ejemplo";
    persist(legacy, true);
    const previous = localStorage.getItem("paris-state-lab");
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === "paris-state-lab") throw new DOMException("Quota full", "QuotaExceededError");
      return originalSetItem.call(this, key, value);
    });

    render(<LaboratoryWorkspace />);
    expect(await screen.findByText(/la actualización de formato no se confirmó/i)).toBeTruthy();
    expect(localStorage.getItem("paris-state-lab")).toBe(previous);

    setItem.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar actualización" }));
    await waitFor(() => expect(screen.queryByText(/la actualización de formato no se confirmó/i)).toBeNull());
    expect(JSON.parse(localStorage.getItem("paris-state-lab")!).profiles.find((profile: { id: string }) => profile.id === "boss")?.name).toBe("Juan Pablo");
  });
  it("an invitation simulates the configured first boss without real authentication or a network call", async () => {
    history.replaceState(null, "", "/?laboratorio=1&invitacion=boss");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<LaboratoryWorkspace />);
    expect(await screen.findByRole("heading", { name: "Hola, Juan." })).toBeTruthy();
    expect(location.search).not.toContain("invitacion");
    expect(JSON.parse(localStorage.getItem("paris-state-lab")!).activeId).toBe(
      "boss",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not activate an invitation until its local state is durably saved and offers retry", async () => {
    const prior = seed();
    prior.activeId = "boss";
    persist(prior, true);
    history.replaceState(null, "", "/?laboratorio=1&invitacion=e0");
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === "paris-state-lab") throw new DOMException("Quota full", "QuotaExceededError");
      return originalSetItem.call(this, key, value);
    });

    render(<LaboratoryWorkspace />);
    expect(await screen.findByText(/la invitación de laboratorio no se confirmó/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Vista de usuario" }).textContent).toContain("Juan Pablo");
    expect(JSON.parse(localStorage.getItem("paris-state-lab")!).activeId).toBe("boss");
    expect(location.search).toContain("invitacion=e0");

    setItem.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar preparación" }));
    expect(await screen.findByRole("heading", { name: "Hola, Valentino." })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("paris-state-lab")!).activeId).toBe("e0");
    expect(location.search).not.toContain("invitacion");
  });
  it("does not duplicate invitation persistence under StrictMode", async () => {
    history.replaceState(null, "", "/?laboratorio=1&invitacion=boss");
    const originalSetItem = Storage.prototype.setItem;
    const writes = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      return originalSetItem.call(this, key, value);
    });
    render(<StrictMode><LaboratoryWorkspace /></StrictMode>);
    expect(await screen.findByRole("heading", { name: "Hola, Juan." })).toBeTruthy();
    expect(writes.mock.calls.filter(([key]) => key === "paris-state-lab")).toHaveLength(1);
  });
  it("shows recoverable storage error when localStorage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    render(<LaboratoryWorkspace />);
    expect(screen.getByRole("heading", { name: "No se pudo leer el laboratorio" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Vista de usuario" })).toBeNull();
  });
  it("offers simulated invitation links on the team page and does not send email", async () => {
    render(<LaboratoryWorkspace />);
    fireEvent.click(document.querySelector('[data-nav="team"]')!);
    const link = await screen.findByRole("link", {
      name: "Probar invitación de Juan Pablo",
    });
    expect(link.getAttribute("href")).toBe("?laboratorio=1&invitacion=boss");
    expect(
      screen.getByText(/No envía correos ni habilita cuentas reales/),
    ).toBeTruthy();
  });
  it("places an accessible icon apart from the title and folds each card independently", () => {
    const example = seed();
    example.activeId = "e0";
    render(<App initialState={example} laboratoryMode />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    const cards = document.querySelectorAll<HTMLElement>(".task-card");
    const first = within(cards[0]).getByRole("button", {
      name: /Plegar tarjeta/,
    });
    expect(first.textContent).toBe("");
    expect(first.querySelector("svg")).toBeTruthy();
    expect(first.parentElement?.className).toBe("card-heading");
    fireEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(
      cards[1].querySelector(".card-collapse")?.getAttribute("aria-expanded"),
    ).toBe("true");
  });
  it("shows Resumen to employees and reserves Catálogo and Cierre for the boss", () => {
    const employeeState = seed();
    employeeState.activeId = employeeState.profiles.find((p) => p.role === "empleado")!.id;
    render(<App initialState={employeeState} laboratoryMode />);
    expect(document.querySelector('[data-nav="overview"]')).toBeTruthy();
    expect(document.querySelector('[data-nav="catalog"]')).toBeNull();
    expect(document.querySelector('[data-nav="closing"]')).toBeNull();
    fireEvent.click(document.querySelector('[data-nav="overview"]')!);
    expect(screen.getByRole("heading", { name: "Tu trabajo, en perspectiva." })).toBeTruthy();
    expect(screen.getByText("Tu avance ponderado")).toBeTruthy();
    expect(document.querySelector("header .avatar")).toBeNull();
    expect(document.querySelector(".sidebar .user .avatar")).toBeTruthy();

    cleanup();
    const supervisorState = seed();
    supervisorState.activeId = supervisorState.profiles.find((p) => p.role === "encargado")!.id;
    render(<App initialState={supervisorState} laboratoryMode />);
    expect(document.querySelector('[data-nav="overview"]')).toBeTruthy();
    expect(document.querySelector('[data-nav="catalog"]')).toBeNull();
    expect(document.querySelector('[data-nav="closing"]')).toBeNull();

    cleanup();
    const bossState = seed();
    bossState.activeId = bossState.profiles.find((p) => p.role === "jefe")!.id;
    render(<App initialState={bossState} laboratoryMode />);
    expect(document.querySelector('[data-nav="catalog"]')).toBeTruthy();
    expect(document.querySelector('[data-nav="closing"]')).toBeTruthy();
  });
  it("keeps catalogue entries compact until their details are opened", async () => {
    const state = seed();
    state.activeId = state.profiles.find((p) => p.role === "jefe")!.id;
    render(<App initialState={state} laboratoryMode />);
    fireEvent.click(document.querySelector('[data-nav="catalog"]')!);
    await waitFor(() => expect(screen.getByRole("button", { name: "Plegar Catálogo estándar y pesos" })).toBeTruthy());
    const cataloguePanel = screen.getByRole("button", { name: "Plegar Catálogo estándar y pesos" });
    expect(cataloguePanel.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(cataloguePanel);
    expect(screen.queryByRole("textbox", { name: "Buscar en el catálogo" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Desplegar Catálogo estándar y pesos" }));
    await waitFor(() => expect(document.querySelector("details.catalog-item")).toBeTruthy());
    const entry = document.querySelector<HTMLDetailsElement>("details.catalog-item")!;
    expect(entry.open).toBe(false);
    expect(entry.querySelector(".catalog-summary-title")?.textContent).toBeTruthy();
    const search = screen.getByRole("textbox", { name: "Buscar en el catálogo" });
    fireEvent.change(search, { target: { value: "sin coincidencias de prueba" } });
    expect(screen.queryByText("No hay procesos que coincidan con estos filtros.")).toBeTruthy();
    expect(document.querySelector("details.catalog-item")).toBeNull();
    fireEvent.change(search, { target: { value: entry.querySelector(".catalog-summary-title")?.textContent || "" } });
    await waitFor(() => expect(document.querySelector("details.catalog-item")).toBeTruthy());
    const filteredEntry = document.querySelector<HTMLDetailsElement>("details.catalog-item")!;
    expect(filteredEntry.open).toBe(false);
    fireEvent.click(filteredEntry.querySelector("summary")!);
    expect(filteredEntry.open).toBe(true);
  });
  it("cycles the single theme button through automatic, light, and dark", () => {
    render(<ThemeControl />);
    const button = screen.getByRole("button", { name: "Apariencia automática. Cambiar a clara" });
    expect(button.getAttribute("data-theme")).toBe("system");
    fireEvent.click(button);
    expect(button.getAttribute("data-theme")).toBe("light");
    expect(button.getAttribute("aria-label")).toBe("Apariencia clara. Cambiar a oscura");
    fireEvent.click(button);
    expect(button.getAttribute("data-theme")).toBe("dark");
    fireEvent.click(button);
    expect(button.getAttribute("data-theme")).toBe("system");
    expect(localStorage.getItem("paris-theme")).toBe("system");
  });
  it("only the boss sees pending profile notifications and confirmation resolves that one", () => {
    const s = seed();
    const commit = vi.fn(
      (_state: ReturnType<typeof seed>, _action?: string, _id?: string) => true,
    );
    const notify = vi.fn();
    const view = render(
      <ParameterizationInbox state={s} commit={commit} notify={notify} />,
    );
    fireEvent.click(screen.getByText(/Perfiles pendientes de revisión/));
    fireEvent.click(
      screen.getByRole("button", { name: "Revisar Valentino Magni" }),
    );
    expect(screen.queryByLabelText(/Objetivo/)).toBeNull();
    expect(screen.getAllByText(/sin cuota/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar revisión" }));
    expect(commit).toHaveBeenCalledOnce();
    const confirmed = commit.mock.calls[0][0];
    view.rerender(
      <ParameterizationInbox
        state={confirmed}
        commit={commit}
        notify={notify}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Revisar Valentino Magni" }),
    ).toBeNull();
    view.rerender(
      <ParameterizationInbox
        state={{ ...s, activeId: "e0" }}
        commit={commit}
        notify={notify}
      />,
    );
    expect(screen.queryByText(/Perfiles pendientes de revisión/)).toBeNull();
  });
  it("keeps the parameter review dialog open when persistence fails", () => {
    const s = seed();
    const commit = vi.fn(() => false);
    const notify = vi.fn();
    render(<ParameterizationInbox state={s} commit={commit} notify={notify} />);
    fireEvent.click(screen.getByText(/Perfiles pendientes de revisión/));
    fireEvent.click(screen.getByRole("button", { name: "Revisar Valentino Magni" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar revisión" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/formulario sigue abierto/));
  });
});
