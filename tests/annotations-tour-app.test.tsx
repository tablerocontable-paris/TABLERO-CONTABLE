// @vitest-environment jsdom
// Diagnostics report acceptance explicitly. Green execution means setup completed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "../src/App";
import { KEY, load, seed } from "../src/data/repository";
import { currentMonth, metrics, type State } from "../src/domain/model";
import { defaultSchedule } from "../src/domain/schedule";

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
    ].map((key) => [key, () => null]),
  ),
);

const record = (id: string, passes: boolean, observed: unknown) =>
  expect({ id, passes, observed }).toEqual(
    expect.objectContaining({ passes: true }),
  );
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
describe("anotaciones y recorrido integrados", () => {
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
  it("mes objetivo cerrado rechaza conversión sin modificar la anotación", () => {
    const state = prepare();
    state.closures.push({
      id: "closed-month",
      ownerId: "e0",
      month: "2026-11",
      at: "2026-11-30T15:00:00.000Z",
      by: "boss",
      metrics: metrics([], []),
      tasks: [],
      activity: [],
      note: "Cierre de prueba",
    });
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    convert();
    fireEvent.change(screen.getByLabelText("Fecha de realización"), {
      target: { value: "2026-11-12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear tarea" }));
    const saved = stored();
    record(
      "closed_target_is_atomic",
      saved.assignments.length === 0 &&
        saved.tasks.length === 0 &&
        saved.annotations![0].reminderOn === "2026-10-10" &&
        saved.annotations![0].convertedTaskId === null,
      {
        assignments: saved.assignments.length,
        tasks: saved.tasks.length,
        annotation: saved.annotations![0],
      },
    );
  });
  it("fallo al guardar conversión conserva el formulario y se puede reintentar", () => {
    prepare();
    render(<App />);
    convert();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementationOnce(() => {
        throw new DOMException("Full", "QuotaExceededError");
      });
    fireEvent.click(screen.getByRole("button", { name: "Crear tarea" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(stored().assignments).toHaveLength(0);
    setItem.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Crear tarea" }));
    const saved = stored();
    expect(saved.assignments).toHaveLength(1);
    expect(saved.tasks).toHaveLength(1);
    expect(saved.annotations![0].convertedTaskId).toBe(saved.tasks[0].id);
    expect(saved.annotations![0].reminderOn).toBeNull();
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
  it("recordatorios aparecen en el tablero propio y no se filtran entre perfiles", () => {
    const state = prepare("e0");
    state.annotations![0].reminderOn = "2026-10-01";
    state.annotations![0].content = "Contenido privado de prueba";
    localStorage.setItem(KEY, JSON.stringify(state));
    const view = render(<App />);
    expect(
      screen.getByText(/recordatorios personales necesitan atención/i),
    ).toBeTruthy();
    view.unmount();
    state.activeId = "e1";
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    expect(screen.queryByText("Contenido privado de prueba")).toBeNull();
    openNotes();
    expect(screen.queryByText("Contenido privado de prueba")).toBeNull();
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
  it("handler rechaza recurrencia aunque se fuerce en el formulario", () => {
    prepare();
    render(<App />);
    convert();
    fireEvent.change(screen.getByLabelText("Elegí del catálogo"), {
      target: { value: "cat1" },
    });
    fireEvent.change(screen.getByLabelText("Frecuencia de la tarea"), {
      target: { value: "mensual" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear tarea" }));
    const saved = stored();
    expect(saved.assignments).toHaveLength(0);
    expect(saved.tasks).toHaveLength(0);
    expect(saved.annotations![0].convertedTaskId).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("tarea puntual");
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
  it("normaliza un avance del recorrido fuera de rango", () => {
    const state = prepare();
    state.tour.e0 = 1000;
    state.tourVersion = { e0: 2 };
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    expect(document.querySelector(".tour-coach small")?.textContent).toContain(
      "1/7",
    );
  });
  it("fin de inducción abre Mi día aunque home sea tablero y no duplica asignaciones", () => {
    const state = prepare();
    state.onboarding.e0 = {
      ...state.onboarding.e0,
      completedAt: null,
      step: 5,
      home: "tasks",
      selectedTemplateIds: ["cat1"],
      selectedCompanyIds: ["c1"],
      schedules: { cat1: defaultSchedule(currentMonth() + "-25") },
    };
    localStorage.setItem(KEY, JSON.stringify(state));
    const view = render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "Preparar mi tablero" }),
    );
    expect(
      document.querySelector("nav button.active")?.getAttribute("data-nav"),
    ).toBe("day");
    expect(document.querySelector(".tour-coach small")?.textContent).toContain(
      "1/7",
    );
    const saved = stored();
    expect(saved.tour.e0).toBe(0);
    expect(saved.tourVersion?.e0).toBe(2);
    expect(saved.onboarding.e0.completedAt).toBeTruthy();
    expect(saved.onboarding.e0.home).toBe("tasks");
    expect(saved.assignments).toHaveLength(1);
    expect(saved.tasks).toHaveLength(1);
    view.unmount();
    render(<App />);
    expect(
      document.querySelector("nav button.active")?.getAttribute("data-nav"),
    ).toBe("tasks");
    expect(
      screen.queryByRole("button", { name: "Preparar mi tablero" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    expect(stored().assignments).toEqual(saved.assignments);
    expect(stored().tasks).toEqual(saved.tasks);
    expect(
      document.querySelector("nav button.active")?.getAttribute("data-nav"),
    ).toBe("day");
  });
  it("Listo guarda finalización y reiniciar comienza de cero sin alterar tareas", () => {
    prepare();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    for (let step = 0; step < 6; step++)
      fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(document.querySelector(".tour-coach small")?.textContent).toContain(
      "7/7",
    );
    const before = stored();
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    expect(document.querySelector(".tour-coach")).toBeNull();
    expect(stored().tour.e0).toBe(7);
    expect(stored().tourVersion?.e0).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    expect(document.querySelector(".tour-coach small")?.textContent).toContain(
      "1/7",
    );
    expect(stored().tour.e0).toBe(0);
    expect(stored().assignments).toEqual(before.assignments);
    expect(stored().tasks).toEqual(before.tasks);
  });
  it("fallo al abrir recorrido mantiene vista y progreso; reintento abre coherente", () => {
    const state = prepare();
    state.onboarding.e0.home = "tasks";
    state.tour.e0 = 4;
    state.tourVersion = { e0: 2 };
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    const before = stored();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementationOnce(() => {
        throw new DOMException("Full", "QuotaExceededError");
      });
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    expect(document.querySelector(".tour-coach")).toBeNull();
    expect(
      document.querySelector("nav button.active")?.getAttribute("data-nav"),
    ).toBe("tasks");
    expect(stored()).toEqual(before);
    setItem.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    expect(document.querySelector(".tour-coach small")?.textContent).toContain(
      "5/7",
    );
    expect(
      document.querySelector("nav button.active")?.getAttribute("data-nav"),
    ).toBe("operations");
  });
  it("fallo al cerrar recorrido conserva último paso; Listo se puede reintentar", () => {
    const state = prepare();
    state.tour.e0 = 6;
    state.tourVersion = { e0: 2 };
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    const before = stored();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementationOnce(() => {
        throw new DOMException("Full", "QuotaExceededError");
      });
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    expect(document.querySelector(".tour-coach small")?.textContent).toContain(
      "7/7",
    );
    expect(
      document.querySelector("nav button.active")?.getAttribute("data-nav"),
    ).toBe("annotations");
    expect(stored()).toEqual(before);
    setItem.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    expect(document.querySelector(".tour-coach")).toBeNull();
    expect(stored().tour.e0).toBe(7);
  });
  it("editar nota con guardado fallido preserva ID y campos; reintento actualiza una sola nota", () => {
    prepare();
    render(<App />);
    openNotes();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const original = stored().annotations![0];
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Fórmula revisada" },
    });
    fireEvent.change(screen.getByLabelText("Contenido"), {
      target: { value: "=SUMAR.SI(A:A;B1;C:C)" },
    });
    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "formula" },
    });
    fireEvent.change(screen.getByLabelText("Recordarme el"), {
      target: { value: "2026-10-15" },
    });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementationOnce(() => {
        throw new DOMException("Full", "QuotaExceededError");
      });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(stored().annotations).toEqual([original]);
    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe(
      "Fórmula revisada",
    );
    expect(
      (screen.getByLabelText("Contenido") as HTMLTextAreaElement).value,
    ).toBe("=SUMAR.SI(A:A;B1;C:C)");
    expect((screen.getByLabelText("Tipo") as HTMLSelectElement).value).toBe(
      "formula",
    );
    expect(
      (screen.getByLabelText("Recordarme el") as HTMLInputElement).value,
    ).toBe("2026-10-15");
    setItem.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(stored().annotations).toHaveLength(1);
    expect(stored().annotations![0]).toMatchObject({
      id: original.id,
      createdAt: original.createdAt,
      title: "Fórmula revisada",
      content: "=SUMAR.SI(A:A;B1;C:C)",
      kind: "formula",
      reminderOn: "2026-10-15",
      convertedTaskId: null,
    });
    expect(
      screen.getByRole("button", { name: "Guardar anotación" }),
    ).toBeTruthy();
  });
});
