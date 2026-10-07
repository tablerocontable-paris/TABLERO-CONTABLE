// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { seed, KEY, persist } from "../src/data/repository";
vi.mock("recharts", () =>
  Object.fromEntries(
    [
      "ResponsiveContainer",
      "BarChart",
      "Bar",
      "XAxis",
      "YAxis",
      "CartesianGrid",
      "Tooltip",
      "Legend",
      "LineChart",
      "Line",
      "ReferenceLine",
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
  it("opens fictitious users and work without touching operational storage or API", () => {
    localStorage.setItem(KEY, "operational-data-do-not-touch");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<LaboratoryWorkspace />);
    expect(
      screen.getByLabelText("Vista de usuario").querySelectorAll("option")
        .length,
    ).toBeGreaterThan(10);
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
    expect(screen.getByLabelText("Vista de usuario").textContent).toContain(
      "Jefe de prueba conservado",
    );
    expect(
      JSON.parse(localStorage.getItem("paris-state-lab")!).tasks.some(
        (t: { id: string }) => t.id === "legacy-legacy",
      ),
    ).toBe(false);
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
    await waitFor(() => expect(document.querySelector("details.catalog-item")).toBeTruthy());
    const entry = document.querySelector<HTMLDetailsElement>("details.catalog-item")!;
    expect(entry.open).toBe(false);
    expect(entry.querySelector(".catalog-summary-title")?.textContent).toBeTruthy();
    fireEvent.click(entry.querySelector("summary")!);
    expect(entry.open).toBe(true);
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
    fireEvent.click(screen.getByText(/Pendiente parametrizar pesos/));
    fireEvent.click(
      screen.getByRole("button", { name: "Revisar Valentino Magni" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar parámetros" }),
    );
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
    expect(screen.queryByText(/Pendiente parametrizar pesos/)).toBeNull();
  });
});
