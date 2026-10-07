// @vitest-environment jsdom
// Diagnostics report acceptance explicitly. Green execution means setup completed.
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import App from "../../src/App";
import { KEY, load, seed } from "../../src/data/repository";
import type { State } from "../../src/domain/model";

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
    ].map((key) => [key, () => null]),
  ),
);

const results: { id: string; passes: boolean; observed: unknown }[] = [];
const record = (id: string, passes: boolean, observed: unknown) =>
  results.push({ id, passes, observed });
const stored = () => JSON.parse(localStorage.getItem(KEY)!) as State;
function prepare(role = "e0") {
  const state = seed();
  state.activeId = role;
  state.assignments = [];
  state.tasks = [];
  state.activity = [];
  state.audit = [];
  state.annotations = [
    {
      id: "review-note",
      ownerId: role,
      title: "Referencia personal",
      content: "=SUMA(A1:A4)",
      kind: "reminder",
      reminderOn: "2026-10-10",
      createdAt: "2026-10-01T12:00:00Z",
      updatedAt: "2026-10-01T12:00:00Z",
      convertedTaskId: null,
    },
  ];
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}
function openNotes() {
  fireEvent.click(document.querySelector('[data-nav="annotations"]')!);
}
function convert() {
  openNotes();
  fireEvent.click(screen.getByRole("button", { name: "Convertir en tarea" }));
}
beforeEach(() => {
  localStorage.clear();
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
afterAll(() =>
  writeFileSync(
    "review-evidence/annotations-tour-008-20261001.json",
    JSON.stringify(
      {
        source_sha: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        environment:
          "jsdom, simulated local profiles; no browser visual QA, Auth or backend",
        acceptance: results.every((r) => r.passes),
        results,
      },
      null,
      2,
    ) + "\n",
  ),
);

describe("diagnóstico de anotaciones y recorrido", () => {
  it("conversión normal conserva texto y crea vínculo", () => {
    prepare();
    render(<App />);
    convert();
    fireEvent.click(screen.getByRole("button", { name: "Crear tarea" }));
    const state = stored();
    const note = state.annotations![0];
    const task = state.tasks.find((t) => t.id === note.convertedTaskId);
    record(
      "normal_conversion",
      !!task &&
        note.content === "=SUMA(A1:A4)" &&
        state.assignments[0].frequency === "única",
      {
        note,
        taskCount: state.tasks.length,
        assignmentCount: state.assignments.length,
      },
    );
  });
  it("fecha de otro mes no debe dejar asignación sin vínculo", () => {
    prepare();
    render(<App />);
    convert();
    fireEvent.change(screen.getByLabelText("Fecha de realización"), {
      target: { value: "2026-11-12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear tarea" }));
    const state = stored();
    record(
      "conversion_other_month",
      state.annotations![0].convertedTaskId !== null &&
        state.tasks.length === 1,
      {
        note: state.annotations![0],
        taskCount: state.tasks.length,
        assignments: state.assignments,
      },
    );
  });
  it("guardado fallido conserva texto para reintentar", () => {
    prepare();
    render(<App />);
    openNotes();
    const title = screen.getByLabelText("Título") as HTMLInputElement;
    const content = screen.getByLabelText("Contenido") as HTMLTextAreaElement;
    fireEvent.change(title, { target: { value: "No perder" } });
    fireEvent.change(content, { target: { value: "Texto irremplazable" } });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar anotación" }));
    expect(screen.getByRole("status").textContent).toContain(
      "No se pudo guardar",
    );
    record(
      "failed_save_preserves_draft",
      title.value === "No perder" && content.value === "Texto irremplazable",
      {
        title: title.value,
        content: content.value,
        savedNotes: stored().annotations!.length,
      },
    );
  });
  it("conversión mantiene una sola vez aunque se elija catálogo", () => {
    prepare();
    render(<App />);
    convert();
    fireEvent.change(screen.getByLabelText("Elegí del catálogo"), {
      target: { value: "cat1" },
    });
    const frequency = screen.getByLabelText(
      "Frecuencia de la tarea",
    ) as HTMLSelectElement;
    const options = Array.from(frequency.options).map((o) => o.value);
    record(
      "conversion_one_off",
      options.length === 1 && options[0] === "única",
      { options },
    );
  });
  it("vínculo sin tarjeta no debe ofrecer reconversión", () => {
    const state = prepare();
    state.annotations![0].convertedTaskId = "missing-task";
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    openNotes();
    const button = screen.queryByRole("button", { name: "Convertir en tarea" });
    record("missing_link_keeps_conversion_lock", button === null, {
      offersConvert: button !== null,
      offersEdit: screen.queryByRole("button", { name: "Editar" }) !== null,
    });
  });
  it("recorrido extenso por rol y pausa/reanudación", () => {
    for (const [role, total] of [
      ["e0", 7],
      ["m1", 9],
      ["boss", 11],
    ] as const) {
      prepare(role);
      const view = render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
      const count = document.querySelector(".tour-coach small")!.textContent;
      fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
      fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
      view.unmount();
      const resumed = render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
      const resume = document.querySelector(".tour-coach small")!.textContent;
      record(
        "tour_resume_" + role,
        count!.includes("1/" + total) && resume!.includes("2/" + total),
        { count, resume, version: stored().tourVersion },
      );
      resumed.unmount();
      localStorage.clear();
    }
  });
  it("recorrido no avanza vista si falló guardar avance", () => {
    const state = prepare();
    state.tour.e0 = 4;
    state.tourVersion = { e0: 2 };
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    const currentPage = document
      .querySelector("nav button.active")!
      .getAttribute("data-nav");
    const coach = document.querySelector(".tour-coach h3")!.textContent;
    record("failed_tour_save_stays_consistent", currentPage === "operations", {
      currentPage,
      coach,
      savedStep: stored().tour.e0,
    });
  });
  it("payload anterior v3 conserva datos", () => {
    const state = prepare();
    delete state.annotations;
    delete state.tourVersion;
    localStorage.setItem(KEY, JSON.stringify(state));
    const next = load();
    record(
      "old_v3_compatible",
      Array.isArray(next.annotations) &&
        next.annotations.length === 0 &&
        !!next.tourVersion &&
        next.activeId === state.activeId,
      {
        profiles: next.profiles.length,
        annotations: next.annotations,
        tourVersion: next.tourVersion,
      },
    );
  });
});
