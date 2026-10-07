// @vitest-environment jsdom
// Diagnostics report acceptance explicitly. Green execution means setup completed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import App from "../src/App";
import { KEY, load, seed } from "../src/data/repository";
import {
  closeMonth,
  currentMonth,
  dateART,
  metrics,
  type State,
} from "../src/domain/model";
import { defaultSchedule } from "../src/domain/schedule";
import { activateJointTask } from "../src/domain/coordination";

const chartProbe = vi.hoisted(() => ({
  cursorProps: [] as Array<Record<string, number>>,
  rowId: "e0",
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  BarChart: ({ children }: { children: ReactNode }) => children,
  LabelList: () => null,
  Bar: ({
    name,
    dataKey,
    onClick,
  }: {
    name: string;
    dataKey: string;
    onClick?: (row: { id: string }) => void;
  }) => (
    <button
      aria-label={`chart ${dataKey}`}
      onClick={() => onClick?.({ id: chartProbe.rowId })}
    >
      {name}
    </button>
  ),
  Tooltip: ({ cursor = {} }: { cursor?: Record<string, number> }) => {
    chartProbe.cursorProps.push(cursor);
    return null;
  },
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  LineChart: () => null,
  Line: () => null,
  ReferenceLine: () => null,
  PieChart: () => null,
  Pie: () => null,
  Cell: () => null,
}));

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
async function openNotes() {
  fireEvent.click(document.querySelector('[data-nav="annotations"]')!);
  await screen.findByRole("button", { name: "Nueva anotación" });
  const create = screen.queryByRole("button", { name: "Nueva anotación" });
  if (create) fireEvent.click(create);
}
async function convert() {
  await openNotes();
  await screen.findByRole("button", { name: "Convertir en tarea" });
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
  it("incluye la tarea y la cuota conjunta del segundo participante en la tabla de cierre", async () => {
    const state = prepare("boss");
    const example = seed().tasks.find(
      (task) => task.ownerId === "e0" && task.kind === "resultado",
    )!;
    const task = {
      ...example,
      id: "joint-close-ui",
      assignmentId: null,
      templateId: null,
      month: currentMonth(),
      status: "Pendiente" as const,
      startedAt: null,
      completedAt: null,
      blockedBy: "",
      blockedSince: null,
      sessions: [],
      checklist: [],
    };
    state.tasks = [task];
    let joint = activateJointTask(
      state,
      {
        taskId: task.id,
        secondProfileId: "e1",
        anchorShareBps: 6000,
        reason: "Revisión de cierre compartida",
        expectedRevision: 0,
        requestId: "joint-close-ui-request",
      },
      "boss",
    );
    joint.tasks = joint.tasks.map((row) =>
      row.id === task.id
        ? { ...row, status: "Completada", completedAt: "2026-10-06T15:00:00Z" }
        : row,
    );
    joint = closeMonth(
      joint,
      "e1",
      currentMonth(),
      "boss",
      "Cierre de participante B",
    );
    localStorage.setItem(KEY, JSON.stringify(joint));

    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="closing"]')!);
    await screen.findByRole("button", { name: "Exportar cierre" });
    const memberName = joint.profiles.find(
      (profile) => profile.id === "e1",
    )!.name;
    const row = screen
      .getAllByText(memberName)
      .map((element) => element.closest("tr"))
      .find((candidate) =>
        candidate
          ?.querySelector("button")
          ?.textContent?.includes("Exportar cierre"),
      )!;
    expect(row.textContent).toContain("1/1");
    expect(row.textContent).toContain("100%");
  });

  it("guarda y vuelve a cargar una categoría libre de anotación", async () => {
    prepare();
    render(<App />);
    await openNotes();
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Criterio de revisión" },
    });
    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "Control interno" },
    });
    fireEvent.change(screen.getByLabelText("Contenido"), {
      target: { value: "Validar soporte antes de conciliar." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar anotación" }));
    expect(
      stored().annotations!.find(
        (note) => note.title === "Criterio de revisión",
      ),
    ).toMatchObject({ category: "Control interno", kind: "personal" });
    expect(
      screen
        .getByText("Criterio de revisión")
        .closest("article")
        ?.querySelector(".annotation-kind")?.textContent,
    ).toContain("Control interno");
  });

  it("el paso anterior del recorrido restaura su página y avance guardado", () => {
    prepare();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(document.querySelector(".tour-coach small")?.textContent).toContain(
      "3/11",
    );
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(document.querySelector(".tour-coach small")?.textContent).toContain(
      "2/11",
    );
    expect(
      document.querySelector("nav button.active")?.getAttribute("data-nav"),
    ).toBe("day");
    expect(stored().tour.e0).toBe(1);
  });

  it("abre la vista del encargado con sus tareas y conserva el perfil al volver al tablero", () => {
    const state = prepare("m1");
    const example = seed().tasks[0]!;
    state.tasks = [
      {
        ...example,
        id: "manager-own",
        ownerId: "m1",
        title: "Tarea de Carolina",
      },
      {
        ...example,
        id: "employee-own",
        ownerId: "e0",
        title: "Tarea de Valentino",
      },
    ];
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    expect(screen.getByText("Tarea de Carolina")).toBeTruthy();
    expect(screen.queryByText("Tarea de Valentino")).toBeNull();
    fireEvent.change(screen.getByLabelText("Perfil que estás viendo"), {
      target: { value: "e0" },
    });
    expect(screen.getByText("Tarea de Valentino")).toBeTruthy();
    expect(screen.queryByText("Tarea de Carolina")).toBeNull();
    fireEvent.click(document.querySelector('[data-nav="day"]')!);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    expect(
      (screen.getByLabelText("Perfil que estás viendo") as HTMLSelectElement)
        .value,
    ).toBe("e0");
    expect(screen.getByText("Tarea de Valentino")).toBeTruthy();
  });

  it("separa las tareas cubiertas sin duplicar su identidad en el tablero", () => {
    const state = prepare("e1");
    const example = seed().tasks[0]!;
    state.tasks = [
      {
        ...example,
        id: "coverage-task",
        ownerId: "e0",
        month: currentMonth(),
        companyId: "c1",
        title: "Conciliación cubierta",
        scheduledOn: dateART(),
        due: dateART(),
      },
    ];
    state.absences = [
      {
        id: "coverage-absence",
        ownerId: "e0",
        replacementId: "e1",
        taskIds: ["coverage-task"],
        from: dateART(),
        to: dateART(),
        kind: "Vacaciones",
        note: "Prueba",
        createdBy: "m1",
      },
    ];
    localStorage.setItem(KEY, JSON.stringify(state));
    expect(load().absences?.[0].taskIds).toEqual(["coverage-task"]);
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    expect(screen.getByText(/Tareas que cubrís/)).toBeTruthy();
    expect(
      document.querySelectorAll('[data-task-id="coverage-task"]'),
    ).toHaveLength(1);
    expect(
      screen.getByText(/Tarea de cobertura para Valentino Magni/),
    ).toBeTruthy();
  });

  it("al preparar una cobertura obliga a elegir tareas específicas y las conserva", async () => {
    const state = prepare("m1");
    const examples = seed()
      .tasks.filter((task) => task.ownerId === "e0")
      .slice(0, 2);
    state.tasks = examples.map((task, index) => ({
      ...task,
      id: `selected-coverage-${index}`,
      title: `Cobertura ${index + 1}`,
      month: currentMonth(),
      due: `${currentMonth()}-15`,
      scheduledOn: `${currentMonth()}-10`,
      status: "Pendiente" as const,
      blockedBy: "",
      sessions: [],
    }));
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="absences"]')!);
    await screen.findByRole("button", { name: "Registrar ausencia" });
    fireEvent.click(screen.getByRole("button", { name: "Registrar ausencia" }));
    fireEvent.change(screen.getByLabelText("Persona ausente"), {
      target: { value: "e0" },
    });
    fireEvent.change(screen.getByLabelText("Quién cubre"), {
      target: { value: "e1" },
    });
    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: `${currentMonth()}-01` },
    });
    fireEvent.change(screen.getByLabelText("Hasta"), {
      target: { value: `${currentMonth()}-31` },
    });
    const selected = screen.getByLabelText(/Cobertura 1/);
    const unselected = screen.getByLabelText(/Cobertura 2/);
    fireEvent.click(selected);
    fireEvent.click(screen.getByRole("button", { name: "Guardar ausencia" }));
    expect((selected as HTMLInputElement).checked).toBe(true);
    expect((unselected as HTMLInputElement).checked).toBe(false);
    expect(load().absences?.[0].taskIds).toEqual(["selected-coverage-0"]);
  });

  it("previsualiza ocurrencias recurrentes y guarda la regla elegida para cobertura futura", async () => {
    const state = prepare("m1");
    const example = seed().assignments[0]!;
    state.assignments = [
      {
        ...example,
        id: "monthly-coverage-rule",
        ownerId: "e0",
        companyId: "c1",
        title: "Conciliación mensual",
        frequency: "mensual",
        startMonth: "2026-10",
        day: 12,
        schedule: {
          ...defaultSchedule("2026-10-01", "mensual"),
          monthDay: 12,
          hasDeadline: false,
        },
      },
    ];
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="absences"]')!);
    await screen.findByRole("button", { name: "Registrar ausencia" });
    fireEvent.click(screen.getByRole("button", { name: "Registrar ausencia" }));
    fireEvent.change(screen.getByLabelText("Persona ausente"), {
      target: { value: "e0" },
    });
    fireEvent.change(screen.getByLabelText("Quién cubre"), {
      target: { value: "e1" },
    });
    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: "2026-11-01" },
    });
    fireEvent.change(screen.getByLabelText("Hasta"), {
      target: { value: "2026-11-30" },
    });
    const rule = screen.getByLabelText(/Conciliación mensual.*2026-11-12/);
    fireEvent.click(rule);
    fireEvent.click(screen.getByRole("button", { name: "Guardar ausencia" }));
    expect(load().absences?.[0].assignmentIds).toEqual([
      "monthly-coverage-rule",
    ]);
  });

  it("asigna una tarea nueva al perfil consultado y respeta la meta editada", () => {
    prepare("m1");
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Nueva tarea" }));
    fireEvent.change(screen.getByLabelText("Elegí del catálogo"), {
      target: { value: "cat3" },
    });
    fireEvent.change(screen.getByLabelText("Meta por ocurrencia"), {
      target: { value: "321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Crear tarea/ }));
    expect(stored().assignments.at(-1)).toMatchObject({
      title: "Carga de facturas",
      ownerId: "m1",
      target: 321,
    });
    expect(stored().templates.find((item) => item.id === "cat3")?.target).toBe(
      120,
    );
  });

  it("crea un checklist línea por línea y conserva errores sin truncar el control", () => {
    prepare();
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Nueva tarea" }));
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Trabajo puntual" },
    });
    expect(screen.getByText(/Se creará sin checklist/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Agregar paso" }));
    const step = screen.getByLabelText("Paso 1") as HTMLInputElement;
    const tooLong = "x".repeat(301);
    fireEvent.change(step, { target: { value: tooLong } });
    fireEvent.click(screen.getByRole("button", { name: /Crear tarea/ }));
    expect(stored().assignments).toHaveLength(0);
    expect(screen.getByRole("alert").textContent).toContain("300 caracteres");
    fireEvent.change(screen.getByLabelText("Paso 1"), {
      target: { value: "Revisar comprobantes" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Crear tarea/ }));
    expect(stored().assignments.at(-1)?.steps).toEqual([
      "Revisar comprobantes",
    ]);
  });

  it("limpia detalle y modal al cambiar de actor de la demostración", () => {
    const state = prepare("m1");
    const example = seed().tasks[0]!;
    state.tasks = [
      {
        ...example,
        id: "employee-detail",
        ownerId: "e0",
        title: "Tarea supervisada",
      },
    ];
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    fireEvent.change(screen.getByLabelText("Perfil que estás viendo"), {
      target: { value: "e0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tarea supervisada" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Vista de usuario"), {
      target: { value: "e0" },
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("permite desplegar una anotación multilineal corta", async () => {
    const state = prepare();
    state.annotations![0]!.content = "Control uno\nControl dos\nControl tres";
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="annotations"]')!);
    const expand = await screen.findByRole("button", { name: "Leer completo" });
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(expand);
    expect(
      screen
        .getByRole("button", { name: "Mostrar menos" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(screen.getByText(/Control uno/).className).toContain("expanded");
  });

  it("conversión normal conserva texto y crea vínculo", async () => {
    prepare();
    render(<App />);
    await convert();
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
  it("fecha de otro mes no debe dejar asignación sin vínculo", async () => {
    prepare();
    render(<App />);
    await convert();
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
  it("mes objetivo cerrado rechaza conversión sin modificar la anotación", async () => {
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
    await convert();
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
  it("fallo al guardar conversión conserva el formulario y se puede reintentar", async () => {
    prepare();
    render(<App />);
    await convert();
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
  it("guardado fallido conserva texto para reintentar", async () => {
    prepare();
    render(<App />);
    await openNotes();
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
  it("recordatorios aparecen en el tablero propio y no se filtran entre perfiles", async () => {
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
    await openNotes();
    expect(screen.queryByText("Contenido privado de prueba")).toBeNull();
  });
  it("conversión mantiene una sola vez aunque se elija catálogo", async () => {
    prepare();
    render(<App />);
    await convert();
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
  it("handler rechaza recurrencia aunque se fuerce en el formulario", async () => {
    prepare();
    render(<App />);
    await convert();
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
  it("vínculo sin tarjeta no debe ofrecer reconversión", async () => {
    const state = prepare();
    state.annotations![0].convertedTaskId = "missing-task";
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    await openNotes();
    const button = screen.queryByRole("button", { name: "Convertir en tarea" });
    record("missing_link_keeps_conversion_lock", button === null, {
      offersConvert: button !== null,
      offersEdit: screen.queryByRole("button", { name: "Editar" }) !== null,
    });
  });
  it("recorrido extenso por rol y pausa/reanudación", () => {
    for (const [role, total] of [
      ["e0", 11],
      ["m1", 14],
      ["boss", 16],
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
  it("resalta un único destino del recorrido y explica el fallback cuando falta", async () => {
    const state = prepare("e0");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    const assertOneSpotlight = async (selector: string) => {
      await waitFor(() => {
        expect(document.querySelectorAll(".spotlight")).toHaveLength(1);
        expect(
          document.querySelector(selector)?.closest(".spotlight"),
        ).not.toBeNull();
      });
    };
    await assertOneSpotlight(".heading");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await assertOneSpotlight(".sidebar-workspace");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await assertOneSpotlight(".board-owner-filter");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await assertOneSpotlight(".task-order");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await assertOneSpotlight('[data-tour="task-actions"]');
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => {
      expect(
        document.querySelector(".heading")?.classList.contains("spotlight"),
      ).toBe(true);
      expect(
        screen.getByRole("dialog", { name: "Recorrido guiado" }).textContent,
      ).toContain("tablero está vacío");
    });
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    expect(document.querySelector(".spotlight")).toBeNull();
  });
  it("elige una sola tarjeta abierta para reloj y controles y vuelve al encabezado al plegarla", async () => {
    const state = prepare("e0");
    const task = seed().tasks.find(
      (row) => row.ownerId === "e0" && row.kind === "resultado",
    )!;
    state.tasks = [
      {
        ...task,
        id: "tour-spotlight-task",
        month: currentMonth(),
        status: "Pendiente",
      },
    ];
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    for (let i = 0; i < 5; i++)
      fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => {
      expect(
        document.querySelectorAll("[data-tour=task-timers].spotlight"),
      ).toHaveLength(1);
      expect(document.querySelectorAll(".spotlight")).toHaveLength(1);
    });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() =>
      expect(
        document.querySelectorAll("[data-tour=task-controls].spotlight"),
      ).toHaveLength(1),
    );
    fireEvent.click(document.querySelector(".column-toggle")!);
    await waitFor(() =>
      expect(
        document.querySelector(".heading")?.classList.contains("spotlight"),
      ).toBe(true),
    );
  });
  it("muestra iniciales de encargado en el organigrama", async () => {
    const state = prepare("boss");
    state.profiles.find((profile) => profile.id === "m1")!.name =
      "Lucía Fernández";
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="team"]')!);
    await waitFor(() =>
      expect(document.querySelector(".org-manager .avatar")).not.toBeNull(),
    );
    expect(document.querySelector(".org-manager .avatar")?.textContent).toBe(
      "LF",
    );
    expect(
      document.querySelectorAll(".org-manager .avatar").length,
    ).toBeGreaterThan(0);
  });
  it("muestra anticipación en el tablero personal y análisis de gerencia", () => {
    const employee = prepare("e0");
    const sample = seed().tasks.find(
      (row) => row.ownerId === "e0" && row.kind === "resultado",
    )!;
    employee.tasks = [
      {
        ...sample,
        id: "timeliness-card",
        month: currentMonth(),
        due: "9999-12-31",
        status: "Completada",
        completedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      },
    ];
    localStorage.setItem(KEY, JSON.stringify(employee));
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    fireEvent.click(screen.getByRole("button", { name: /Completada/ }));
    const badge = document.querySelector(".timeliness-badge");
    record(
      "timeliness_employee_card",
      !!badge && /Completada \d+ días antes/.test(badge.textContent || ""),
      {
        badge: badge?.textContent,
        task: stored().tasks[0],
        renderedTasks: document.querySelectorAll("[data-task-id]").length,
      },
    );

    cleanup();
    const manager = prepare("boss");
    manager.tasks = [{ ...employee.tasks[0]!, ownerId: "e0" }];
    localStorage.setItem(KEY, JSON.stringify(manager));
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="analytics"]')!);
    expect(
      screen.getByRole("heading", { name: "Anticipación de plazos" }),
    ).toBeTruthy();
    expect(screen.getByText("1/1 antes del plazo · 100%")).toBeTruthy();
  });
  it("pasa cursor tenue al gráfico y conserva la navegación del clic por empleado", () => {
    const state = prepare("boss");
    const task = seed().tasks.find(
      (row) => row.ownerId === "e0" && row.kind === "resultado",
    )!;
    state.tasks = [
      { ...task, id: "chart-navigation-task", month: currentMonth() },
    ];
    localStorage.setItem(KEY, JSON.stringify(state));
    chartProbe.cursorProps = [];
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="analytics"]')!);
    expect(chartProbe.cursorProps.length).toBeGreaterThanOrEqual(2);
    expect(
      chartProbe.cursorProps.every(
        (cursor) =>
          cursor.fillOpacity === 0.12 && cursor.strokeOpacity === 0.55,
      ),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Por equipo" }));
    chartProbe.rowId = "t1";
    fireEvent.click(screen.getByRole("button", { name: "chart weighted" }));
    expect((screen.getByLabelText("Equipo") as HTMLSelectElement).value).toBe(
      "t1",
    );
    fireEvent.click(screen.getByRole("button", { name: "Por sector" }));
    chartProbe.rowId = "Tesorería";
    fireEvent.click(screen.getByRole("button", { name: "chart weighted" }));
    expect((screen.getByLabelText("Sector") as HTMLSelectElement).value).toBe(
      "Tesorería",
    );
    fireEvent.click(screen.getByRole("button", { name: "Por empleado" }));
    chartProbe.rowId = "e0";
    fireEvent.click(screen.getByRole("button", { name: "chart weighted" }));
    expect(
      document.querySelector("nav button.active")?.getAttribute("data-nav"),
    ).toBe("tasks");
    expect(
      (screen.getByLabelText("Perfil que estás viendo") as HTMLSelectElement)
        .value,
    ).toBe("e0");
  });
  it("recorrido no avanza vista si falló guardar avance", () => {
    const state = prepare();
    state.tour.e0 = 5;
    state.tourVersion = { e0: 4 };
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
    record("failed_tour_save_stays_consistent", currentPage === "tasks", {
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
      "1/11",
    );
  });
  it("fin de inducción abre Mi día aunque home sea tablero y no duplica asignaciones", async () => {
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
      await screen.findByRole("button", { name: "Preparar mi tablero" }),
    );
    expect(
      document.querySelector("nav button.active")?.getAttribute("data-nav"),
    ).toBe("day");
    expect(document.querySelector(".tour-coach small")?.textContent).toContain(
      "1/11",
    );
    const saved = stored();
    expect(saved.tour.e0).toBe(0);
    expect(saved.tourVersion?.e0).toBe(4);
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
    for (let step = 0; step < 10; step++)
      fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(document.querySelector(".tour-coach small")?.textContent).toContain(
      "11/11",
    );
    const before = stored();
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    expect(document.querySelector(".tour-coach")).toBeNull();
    expect(stored().tour.e0).toBe(11);
    expect(stored().tourVersion?.e0).toBe(4);
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    expect(document.querySelector(".tour-coach small")?.textContent).toContain(
      "1/11",
    );
    expect(stored().tour.e0).toBe(0);
    expect(stored().assignments).toEqual(before.assignments);
    expect(stored().tasks).toEqual(before.tasks);
  });
  it("fallo al abrir recorrido mantiene vista y progreso; reintento abre coherente", () => {
    const state = prepare();
    state.onboarding.e0.home = "tasks";
    state.tour.e0 = 4;
    state.tourVersion = { e0: 4 };
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
      "5/11",
    );
    expect(
      document.querySelector("nav button.active")?.getAttribute("data-nav"),
    ).toBe("tasks");
  });
  it("fallo al cerrar recorrido conserva último paso; Listo se puede reintentar", () => {
    const state = prepare();
    state.tour.e0 = 10;
    state.tourVersion = { e0: 4 };
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
      "11/11",
    );
    expect(
      document.querySelector("nav button.active")?.getAttribute("data-nav"),
    ).toBe("annotations");
    expect(stored()).toEqual(before);
    setItem.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    expect(document.querySelector(".tour-coach")).toBeNull();
    expect(stored().tour.e0).toBe(11);
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
    expect((screen.getByLabelText("Tipo") as HTMLInputElement).value).toBe(
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
      screen.getByRole("button", { name: "Nueva anotación" }),
    ).toBeTruthy();
  });
});
