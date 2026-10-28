// @vitest-environment jsdom
// Diagnostics report acceptance explicitly. Green execution means setup completed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import App from "../src/App";
import { KEY, load, seed } from "../src/data/repository";
import { closeMonth, currentMonth, dateART, metrics, type State } from "../src/domain/model";
import { defaultSchedule } from "../src/domain/schedule";
import { activateJointTask } from "../src/domain/coordination";
import type { InternalRequest } from "../src/domain/internalRequests";
import { chooseEmployee } from "./employee-picker-test-helpers";

const chartProbe = vi.hoisted(() => ({ cursorProps: [] as Array<Record<string, number>>, rowId: "e0" }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  BarChart: ({ children }: { children: ReactNode }) => children,
  LabelList: () => null,
  Bar: ({ name, dataKey, onClick }: { name: string; dataKey: string; onClick?: (row: { id: string }) => void }) =>
    <button aria-label={`chart ${dataKey}`} onClick={() => onClick?.({ id: chartProbe.rowId })}>{name}</button>,
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
const storedLab = () => JSON.parse(localStorage.getItem("paris-state-lab")!) as State;
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
async function openNotesPage() {
  fireEvent.click(document.querySelector('[data-nav="annotations"]')!);
  await screen.findByRole("button", { name: "Nueva anotación" });
  await screen.findByRole("button", { name: "Plegar Tu biblioteca" });
}
async function openNotes() {
  await openNotesPage();
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
  it("en laboratorio sólo crea tareas canónicas y guarda unidad y parámetros para medirlas", async () => {
    const state = prepare("boss");
    localStorage.setItem("paris-state-lab", JSON.stringify(state));
    render(<App initialState={state} laboratoryMode />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Nueva tarea" }));
    fireEvent.change(screen.getByLabelText("Elegí del catálogo"), { target: { value: "gpar_bank_reconciliation" } });
    fireEvent.change(screen.getByLabelText("Unidad de negocio"), { target: { value: "paris_autos" } });
    fireEvent.submit(screen.getByRole("dialog", { name: "Nueva tarea, con todo su contexto" }).querySelector("form")!);
    expect(screen.getByRole("alert").textContent).toContain("datos obligatorios");
    expect(storedLab().assignments).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("banco"), { target: { value: "Banco Francés" } });
    fireEvent.change(screen.getByLabelText("cuenta"), { target: { value: "Cuenta principal" } });
    fireEvent.submit(screen.getByRole("dialog", { name: "Nueva tarea, con todo su contexto" }).querySelector("form")!);
    const saved = storedLab();
    expect(saved.assignments.at(-1)).toMatchObject({
      title: "Conciliación bancaria",
      taskCode: "gpar_bank_reconciliation",
      taskCatalogVersion: 5,
      businessUnitCode: "paris_autos",
      taskParameters: { banco: "Banco Francés", cuenta: "Cuenta principal" },
    });
    expect(saved.tasks.at(-1)).toMatchObject({
      title: "Conciliación bancaria",
      taskCode: "gpar_bank_reconciliation",
      taskCatalogVersion: 5,
      businessUnitCode: "paris_autos",
      taskParameters: { banco: "Banco Francés", cuenta: "Cuenta principal" },
    });
  });

  it("incluye la tarea y la cuota conjunta del segundo participante en la tabla de cierre", async () => {
    const state = prepare("boss");
    const example = seed().tasks.find((task) => task.ownerId === "e0" && task.kind === "resultado")!;
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
    let joint = activateJointTask(state, {
      taskId: task.id,
      secondProfileId: "e1",
      anchorShareBps: 6000,
      reason: "Revisión de cierre compartida",
      expectedRevision: 0,
      requestId: "joint-close-ui-request",
    }, "boss");
    joint.tasks = joint.tasks.map((row) => row.id === task.id
      ? { ...row, status: "Completada", completedAt: "2026-10-06T15:00:00Z" }
      : row);
    joint = closeMonth(joint, "e1", currentMonth(), "boss", "Cierre de participante B");
    localStorage.setItem(KEY, JSON.stringify(joint));

    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="closing"]')!);
    await screen.findByRole("button", { name: "Exportar cierre" }, { timeout: 5000 });
    const memberName = joint.profiles.find((profile) => profile.id === "e1")!.name;
    const row = screen.getAllByText(memberName)
      .map((element) => element.closest("tr"))
      .find((candidate) => candidate?.querySelector("button")?.textContent?.includes("Exportar cierre"))!;
    expect(row.textContent).toContain("1/1");
    expect(row.textContent).toContain("100%");
  });

  it("guarda y vuelve a cargar una categoría libre de anotación", async () => {
    prepare();
    render(<App />);
    await openNotes();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Criterio de revisión" } });
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "Control interno" } });
    fireEvent.change(screen.getByLabelText("Contenido"), { target: { value: "Validar soporte antes de conciliar." } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar anotación" }));
    expect(stored().annotations!.find((note) => note.title === "Criterio de revisión")).toMatchObject({ category: "Control interno", kind: "personal" });
    expect(screen.getByText("Criterio de revisión").closest("article")?.querySelector(".annotation-kind")?.textContent).toContain("Control interno");
  });

  it("el paso anterior del recorrido restaura su página y avance guardado", () => {
    prepare();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(document.querySelector(".tour-coach small")?.textContent).toContain("3/9");
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(document.querySelector(".tour-coach small")?.textContent).toContain("2/9");
    expect(document.querySelector("nav button.active")?.getAttribute("data-nav")).toBe("tasks");
    expect(stored().tour.e0).toBe(1);
  });

  it("al volver al primer paso devuelve el foco a Siguiente y no al botón deshabilitado", async () => {
    prepare();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    const previous = screen.getByRole("button", { name: "Anterior" });
    previous.focus();
    fireEvent.click(previous);

    const next = screen.getByRole("button", { name: "Siguiente" });
    await waitFor(() => expect(document.activeElement).toBe(next));
    expect((previous as HTMLButtonElement).disabled).toBe(true);
  });

  it("oscurece el exterior, posiciona la guía junto al objetivo y permite salir con Escape", async () => {
    prepare();
    render(<App />);
    const trigger = screen.getByRole("button", { name: "Recorrido guiado" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Recorrido guiado" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.querySelector(".tour-backdrop")).not.toBeNull();
    await waitFor(() => {
      expect((dialog as HTMLElement).style.top).not.toBe("");
      expect((dialog as HTMLElement).style.left).not.toBe("");
    });
    const pause = within(dialog).getByRole("button", { name: "Pausar" });
    const next = within(dialog).getByRole("button", { name: "Siguiente" });
    expect(document.activeElement).toBe(pause);
    fireEvent.keyDown(pause, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(next);
    fireEvent.keyDown(next, { key: "Tab" });
    expect(document.activeElement).toBe(pause);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Recorrido guiado" })).toBeNull());
    expect(document.querySelector(".tour-backdrop")).toBeNull();
    expect(document.querySelector(".spotlight")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("al cambiar el actor durante el recorrido devuelve el foco a un control vigente", async () => {
    prepare();
    render(<App />);
    const trigger = screen.getByRole("button", { name: "Recorrido guiado" });
    trigger.focus();
    fireEvent.click(trigger);
    chooseEmployee("Vista de usuario", "m1");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Recorrido guiado" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(load().activeId).toBe("m1");
  });

  it("avisa al reiniciar el progreso numérico de una versión anterior del recorrido", () => {
    const state = prepare();
    state.tour.e0 = 4;
    state.tourVersion = { e0: 4 };
    const templateTitle = state.templates[0]?.title;
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    expect(screen.getByRole("status").textContent).toContain("El recorrido se actualizó y comienza de nuevo");
    expect(load().tour.e0).toBe(0);
    expect(load().templates[0]?.title).toBe(templateTitle);
  });

  it("abre la vista del encargado con sus tareas y conserva el perfil al volver al tablero", () => {
    const state = prepare("m1");
    const example = seed().tasks[0]!;
    state.tasks = [
      { ...example, id: "manager-own", assignmentId: null, ownerId: "m1", title: "Tarea de Carolina" },
      { ...example, id: "employee-own", assignmentId: null, ownerId: "e0", title: "Tarea de Valentino" },
    ];
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    expect(screen.getByText("Tarea de Carolina")).toBeTruthy();
    expect(screen.queryByText("Tarea de Valentino")).toBeNull();
    chooseEmployee("Perfil que estás viendo", "e0");
    expect(screen.getByText("Tarea de Valentino")).toBeTruthy();
    expect(screen.queryByText("Tarea de Carolina")).toBeNull();
    fireEvent.click(document.querySelector('[data-nav="day"]')!);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    expect(screen.getByRole("button", { name: "Perfil que estás viendo" }).textContent).toContain("Valentino Magni");
    expect(screen.getByText("Tarea de Valentino")).toBeTruthy();
  });

  it("separa las tareas cubiertas sin duplicar su identidad en el tablero", () => {
    const state = prepare("e1");
    const example = seed().tasks[0]!;
    state.tasks = [{ ...example, id: "coverage-task", assignmentId: null, ownerId: "e0", month: currentMonth(), companyId: "c1", title: "Conciliación cubierta", scheduledOn: dateART(), due: dateART() }];
    state.absences = [{
      id: "coverage-absence",
      ownerId: "e0",
      replacementId: "e1",
      taskIds: ["coverage-task"],
      from: dateART(),
      to: dateART(),
      kind: "Vacaciones",
      note: "Prueba",
      createdBy: "m1",
    }];
    localStorage.setItem(KEY, JSON.stringify(state));
    expect(load().absences?.[0].taskIds).toEqual(["coverage-task"]);
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    expect(screen.getByText(/Tareas que cubrís/)).toBeTruthy();
    expect(document.querySelectorAll('[data-task-id="coverage-task"]')).toHaveLength(1);
    expect(within(screen.getByRole("region", { name: "Mi jornada" })).getByText("1 pendiente")).toBeTruthy();
    expect(screen.getByText(/Tarea de cobertura para Valentino Magni/)).toBeTruthy();
  });

  it("retira una cobertura vencida de Mi jornada sin borrar la tarea titular", async () => {
    const state = prepare("e1");
    const example = seed().tasks.find((task) => task.ownerId === "e0")!;
    state.tasks = [{
      ...example, id: "expired-coverage-sidebar", assignmentId: null, ownerId: "e0", companyId: "c1",
      month: currentMonth(), title: "Cobertura que vence hoy", status: "Pendiente", scheduledOn: dateART(), due: dateART(), sessions: [],
    }];
    const yesterday = dateART(new Date(Date.now() - 86_400_000).toISOString());
    state.absences = [{
      id: "expires-today", ownerId: "e0", replacementId: "e1", taskIds: ["expired-coverage-sidebar"],
      from: yesterday, to: dateART(), kind: "Licencia", note: "", createdBy: "m1",
    }];
    localStorage.setItem(KEY, JSON.stringify(state));
    const view = render(<App initialState={state} laboratoryMode />);
    expect(within(await screen.findByRole("region", { name: "Mi jornada" })).getByText("1 pendiente")).toBeTruthy();
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    expect(document.querySelectorAll('[data-task-id="expired-coverage-sidebar"]')).toHaveLength(1);

    const expired = { ...state, absences: state.absences!.map((absence) => ({ ...absence, to: yesterday })) };
    view.rerender(<App initialState={expired} laboratoryMode />);

    await waitFor(() => expect(screen.queryByRole("region", { name: "Mi jornada" })).toBeNull());
    expect(document.querySelectorAll('[data-task-id="expired-coverage-sidebar"]')).toHaveLength(0);
    expect(stored().tasks.some((task) => task.id === "expired-coverage-sidebar" && task.ownerId === "e0")).toBe(true);
  });

  it("al preparar una cobertura obliga a elegir tareas específicas y las conserva", async () => {
    const state = prepare("m1");
    const examples = seed().tasks.filter((task) => task.ownerId === "e0").slice(0, 2);
    state.tasks = examples.map((task, index) => ({
      ...task, id: `selected-coverage-${index}`, assignmentId: null, title: `Cobertura ${index + 1}`,
      month: currentMonth(), due: `${currentMonth()}-15`, scheduledOn: `${currentMonth()}-10`,
      status: "Pendiente" as const, blockedBy: "", sessions: [],
    }));
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="absences"]')!);
    await screen.findByRole("button", { name: "Registrar ausencia" });
    fireEvent.click(screen.getByRole("button", { name: "Registrar ausencia" }));
    fireEvent.change(screen.getByLabelText("Persona ausente"), { target: { value: "e0" } });
    fireEvent.change(screen.getByLabelText("Quién cubre"), { target: { value: "e1" } });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: `${currentMonth()}-01` } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: `${currentMonth()}-31` } });
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
    state.assignments = [{
      ...example, id: "monthly-coverage-rule", ownerId: "e0", companyId: "c1",
      title: "Conciliación mensual", frequency: "mensual", startMonth: "2026-10", day: 12,
      schedule: { ...defaultSchedule("2026-10-01", "mensual"), monthDay: 12, hasDeadline: false },
    }];
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="absences"]')!);
    await screen.findByRole("button", { name: "Registrar ausencia" });
    fireEvent.click(screen.getByRole("button", { name: "Registrar ausencia" }));
    fireEvent.change(screen.getByLabelText("Persona ausente"), { target: { value: "e0" } });
    fireEvent.change(screen.getByLabelText("Quién cubre"), { target: { value: "e1" } });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-11-30" } });
    const rule = screen.getByLabelText(/Conciliación mensual.*2026-11-12/);
    fireEvent.click(rule);
    fireEvent.click(screen.getByRole("button", { name: "Guardar ausencia" }));
    expect(load().absences?.[0].assignmentIds).toEqual(["monthly-coverage-rule"]);
  });

  it("asigna una tarea nueva al perfil consultado y respeta la meta editada", () => {
    prepare("m1");
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Nueva tarea" }));
    fireEvent.change(screen.getByLabelText("Elegí del catálogo"), { target: { value: "cat3" } });
    fireEvent.change(screen.getByLabelText("Meta por ocurrencia"), { target: { value: "321" } });
    fireEvent.click(screen.getByRole("button", { name: /Crear tarea/ }));
    expect(stored().assignments.at(-1)).toMatchObject({
      title: "Carga de facturas",
      ownerId: "m1",
      target: 321,
    });
    expect(stored().templates.find((item) => item.id === "cat3")?.target).toBe(120);
  });

  it("reserva las recurrencias a jefatura en UI y vuelve a comprobarlo al guardar", () => {
    prepare("m1");
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Nueva tarea" }));
    fireEvent.change(screen.getByLabelText("Elegí del catálogo"), { target: { value: "cat1" } });

    const frequency = screen.getByLabelText("Frecuencia de la tarea") as HTMLSelectElement;
    expect(Array.from(frequency.options).map((option) => option.value)).toEqual(["única"]);
    fireEvent.change(frequency, { target: { value: "mensual" } });
    fireEvent.click(screen.getByRole("button", { name: /Crear tarea/ }));

    expect(stored().assignments).toHaveLength(0);
    expect(stored().tasks).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toContain("Sólo jefatura puede definir recurrencias");
  });

  it("revalida el ámbito al convertir una anotación mientras el formulario sigue abierto", async () => {
    const state = prepare("m1");
    const view = render(<App initialState={state} laboratoryMode />);
    await openNotes();
    fireEvent.click(await screen.findByRole("button", { name: "Convertir en tarea" }));
    fireEvent.change(screen.getByLabelText("Elegí del catálogo"), { target: { value: "gpar_bank_reconciliation" } });
    fireEvent.change(screen.getByLabelText("Unidad de negocio"), { target: { value: "paris_autos" } });
    fireEvent.change(screen.getByLabelText("banco"), { target: { value: "Banco Francés" } });
    fireEvent.change(screen.getByLabelText("cuenta"), { target: { value: "Cuenta principal" } });

    const revoked = {
      ...state,
      profiles: state.profiles.map((profile) => profile.id === "m1"
        ? { ...profile, companyIds: profile.companyIds.filter((companyId) => companyId !== "c1") }
        : profile),
    };
    view.rerender(<App initialState={revoked} laboratoryMode />);
    fireEvent.submit(screen.getByRole("dialog", { name: "Nueva tarea, con todo su contexto" }).querySelector("form")!);

    expect(stored().assignments).toHaveLength(0);
    expect(stored().tasks).toHaveLength(0);
    expect(stored().annotations?.[0]?.convertedTaskId).toBeNull();
    expect(screen.getByRole("dialog", { name: "Nueva tarea, con todo su contexto" })).toBeTruthy();
    expect((screen.getByLabelText("Elegí del catálogo") as HTMLSelectElement).value).toBe("gpar_bank_reconciliation");
    expect(screen.getByRole("alert").textContent).toContain("Empresa o responsable fuera del ámbito autorizado");
  });

  it("revalida empresa y conserva el pedido al revocar su ámbito durante la conversión", async () => {
    const state = prepare("boss");
    const request: InternalRequest = {
      id: "request-conversion-scope",
      kind: "work_request",
      authorId: "e0",
      recipientId: "boss",
      urgency: "medium",
      module: "Tablero",
      subject: "Preparar conciliación",
      description: "Asignar el control del período.",
      status: "new",
      createdAt: "2026-10-01T12:00:00.000Z",
      updatedAt: "2026-10-01T12:00:00.000Z",
      messages: [],
      history: [{ id: "request-event", actorId: "e0", status: "new", note: "Solicitud creada", createdAt: "2026-10-01T12:00:00.000Z" }],
    };
    state.internalRequests = [request];
    localStorage.setItem(KEY, JSON.stringify(state));
    const view = render(<App initialState={state} laboratoryMode />);
    fireEvent.click(document.querySelector('[data-nav="requests"]')!);
    fireEvent.click(await screen.findByRole("button", { name: "Convertir en tarea puntual" }));
    fireEvent.change(screen.getByLabelText("Elegí del catálogo"), { target: { value: "gpar_bank_reconciliation" } });
    fireEvent.change(screen.getByLabelText("Unidad de negocio"), { target: { value: "paris_autos" } });
    fireEvent.change(screen.getByLabelText("banco"), { target: { value: "Banco Francés" } });
    fireEvent.change(screen.getByLabelText("cuenta"), { target: { value: "Cuenta principal" } });
    fireEvent.change(screen.getByLabelText("Responsable"), { target: { value: "e0" } });
    fireEvent.change(screen.getByLabelText("Empresa obligatoria"), { target: { value: "c1" } });
    expect((screen.getByLabelText("Elegí del catálogo") as HTMLSelectElement).value).toBe("gpar_bank_reconciliation");
    expect((screen.getByLabelText("Responsable") as HTMLSelectElement).value).toBe("e0");
    expect((screen.getByLabelText("Empresa obligatoria") as HTMLSelectElement).value).toBe("c1");

    const revoked = {
      ...state,
      profiles: state.profiles.map((profile) => profile.id === "e0"
        ? { ...profile, companyIds: profile.companyIds.filter((companyId) => companyId !== "c1") }
        : profile),
    };
    view.rerender(<App initialState={revoked} laboratoryMode />);
    fireEvent.submit(screen.getByRole("dialog", { name: "Nueva tarea, con todo su contexto" }).querySelector("form")!);

    const saved = stored();
    expect(saved.assignments).toHaveLength(0);
    expect(saved.tasks).toHaveLength(0);
    expect(saved.internalRequests?.[0]).toMatchObject({ id: request.id, status: "new" });
    expect(saved.internalRequests?.[0]?.convertedTaskId).toBeUndefined();
    expect(screen.getByRole("dialog", { name: "Nueva tarea, con todo su contexto" })).toBeTruthy();
    expect((screen.getByLabelText("Elegí del catálogo") as HTMLSelectElement).value).toBe("gpar_bank_reconciliation");
    expect((screen.getByLabelText("Responsable") as HTMLSelectElement).value).toBe("e0");
    expect((screen.getByLabelText("Empresa obligatoria") as HTMLSelectElement).value).toBe("");
    expect(screen.getByText(/La empresa seleccionada dejó de estar autorizada/)).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Empresa o responsable fuera del ámbito autorizado");
  });

  it("oculta empresas revocadas al asignar y evita crear si el ámbito dejó de ser válido", async () => {
    const state = prepare("m1");
    state.profiles = state.profiles.map((profile) => profile.id === "m1" ? { ...profile, companyIds: [] } : profile);
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Nueva tarea" }));
    const ownerSelect = screen.getByLabelText("Responsable") as HTMLSelectElement;
    fireEvent.change(ownerSelect, { target: { value: "e0" } });
    const companyOptions = within(screen.getByLabelText("Empresa obligatoria")).getAllByRole("option");
    expect(companyOptions.every((option) => (option as HTMLOptionElement).value === "")).toBe(true);
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Tarea fuera del ámbito" } });
    fireEvent.click(screen.getByRole("button", { name: /Crear tarea/ }));
    expect(stored().assignments).toHaveLength(0);
  });

  it("no muestra Mi jornada después de revocar el ámbito de una tarea abierta", async () => {
    const state = prepare("e0");
    const task = seed().tasks.find((row) => row.ownerId === "e0")!;
    state.tasks = [{ ...task, id: "revoked-personal-task", assignmentId: null, status: "Pendiente", sessions: [] }];
    state.profiles = state.profiles.map((profile) => profile.id === "e0" ? { ...profile, companyIds: [] } : profile);
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    await waitFor(() => expect(screen.queryByRole("region", { name: "Mi jornada" })).toBeNull());
  });

  it("Mi jornada conserva sólo tareas de empresas vigentes y abre una tarea autorizada", async () => {
    const state = prepare("e0");
    const task = seed().tasks.find((row) => row.ownerId === "e0")!;
    state.tasks = [
      { ...task, id: "revoked-company-task", assignmentId: null, companyId: "c1", title: "Pendiente de empresa revocada", status: "Pendiente", sessions: [] },
      { ...task, id: "authorized-company-task", assignmentId: null, companyId: "c2", title: "Pendiente de empresa vigente", status: "Pendiente", sessions: [] },
    ];
    state.profiles = state.profiles.map((profile) => profile.id === "e0" ? { ...profile, companyIds: ["c2"] } : profile);
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);

    const summary = await screen.findByRole("region", { name: "Mi jornada" });
    expect(within(summary).getByText("1 pendiente")).toBeTruthy();
    expect(within(summary).getByText(/Pendiente de empresa vigente/)).toBeTruthy();
    expect(within(summary).queryByText(/Pendiente de empresa revocada/)).toBeNull();
    fireEvent.click(within(summary).getByRole("button", { name: /Pendiente de empresa vigente/ }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: "Pendiente de empresa vigente" })).toBeTruthy());
  });

  it("revoca en una vista abierta la tarea y el conteo de una empresa recién retirada", async () => {
    const state = prepare("e0");
    const task = seed().tasks.find((row) => row.ownerId === "e0")!;
    state.tasks = [
      { ...task, id: "open-revoked-company-task", assignmentId: null, companyId: "c1", title: "Se retiró el permiso", status: "Pendiente", sessions: [] },
      { ...task, id: "open-authorized-company-task", assignmentId: null, companyId: "c2", title: "Permiso todavía vigente", status: "Pendiente", sessions: [] },
    ];
    state.profiles = state.profiles.map((profile) => profile.id === "e0" ? { ...profile, companyIds: ["c1", "c2"] } : profile);
    localStorage.setItem(KEY, JSON.stringify(state));
    const view = render(<App initialState={state} laboratoryMode />);
    const summary = await screen.findByRole("region", { name: "Mi jornada" });
    expect(within(summary).getByText("2 pendientes")).toBeTruthy();

    const revoked = {
      ...state,
      profiles: state.profiles.map((profile) => profile.id === "e0"
        ? { ...profile, companyIds: ["c2"] }
        : profile),
    };
    view.rerender(<App initialState={revoked} laboratoryMode />);

    await waitFor(() => {
      expect(within(screen.getByRole("region", { name: "Mi jornada" })).getByText("1 pendiente")).toBeTruthy();
    });
    expect(within(screen.getByRole("region", { name: "Mi jornada" })).getByText(/Permiso todavía vigente/)).toBeTruthy();
    expect(stored().tasks).toHaveLength(2);
  });

  it("crea un checklist línea por línea y conserva errores sin truncar el control", () => {
    prepare();
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Nueva tarea" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Trabajo puntual" } });
    expect(screen.getByText(/Se creará sin checklist/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Agregar paso" }));
    const step = screen.getByLabelText("Paso 1") as HTMLInputElement;
    const tooLong = "x".repeat(301);
    fireEvent.change(step, { target: { value: tooLong } });
    fireEvent.click(screen.getByRole("button", { name: /Crear tarea/ }));
    expect(stored().assignments).toHaveLength(0);
    expect(screen.getByRole("alert").textContent).toContain("300 caracteres");
    fireEvent.change(screen.getByLabelText("Paso 1"), { target: { value: "Revisar comprobantes" } });
    fireEvent.click(screen.getByRole("button", { name: /Crear tarea/ }));
    expect(stored().assignments.at(-1)?.steps).toEqual(["Revisar comprobantes"]);
  });

  it("limpia detalle y modal al cambiar de actor de la demostración", () => {
    const state = prepare("m1");
    const example = seed().tasks[0]!;
    state.tasks = [{ ...example, id: "employee-detail", assignmentId: null, ownerId: "e0", title: "Tarea supervisada" }];
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    chooseEmployee("Perfil que estás viendo", "e0");
    fireEvent.click(screen.getByRole("button", { name: "Tarea supervisada" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    chooseEmployee("Vista de usuario", "e0");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("permite desplegar una anotación multilineal corta", async () => {
    const state = prepare();
    state.annotations![0]!.content = "Control uno\nControl dos\nControl tres";
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    await openNotesPage();
    const expand = await screen.findByRole("button", { name: "Leer completo" });
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(expand);
    expect(screen.getByRole("button", { name: "Mostrar menos" }).getAttribute("aria-expanded")).toBe("true");
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
      ["e0", 9],
      ["m1", 11],
      ["boss", 13],
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
        expect(document.querySelector(selector)?.closest(".spotlight")).not.toBeNull();
      });
    };
    await waitFor(() => {
      expect(document.querySelectorAll(".spotlight")).toHaveLength(1);
      expect(document.querySelector(".spotlight")?.getAttribute("data-tour")).toMatch(/day-route|day-overview/);
    });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await assertOneSpotlight('[data-tour="board-movement"]');
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => {
      expect(document.querySelectorAll(".spotlight")).toHaveLength(1);
      expect(document.querySelector(".heading")?.classList.contains("spotlight")).toBe(false);
      expect(document.querySelector(".spotlight")?.getAttribute("data-tour")).toMatch(/task-controls|task-column-(open|empty)/);
    });
    expect(stored().tasks).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    expect(document.querySelector(".spotlight")).toBeNull();
  });
  it("abre temporalmente un panel plegado para el recorrido y restaura su estado al pausar", async () => {
    const state = prepare("e0");
    state.tour.e0 = 8;
    state.tourStepId = { e0: "planning-rules" };
    state.tourVersion = { e0: 6 };
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    await waitFor(() => expect(document.querySelector('[data-tour="planning-rules"]')?.closest<HTMLElement>(".panel-body")?.hidden).toBe(false));
    const toggle = screen.getByRole("button", { name: "Plegar Planificación y recurrencias" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Desplegar Planificación y recurrencias" }).getAttribute("aria-expanded")).toBe("false"));
  });
  it("elige una sola tarjeta abierta para reloj y controles y vuelve al encabezado al plegarla", async () => {
    const state = prepare("e0");
    const task = seed().tasks.find((row) => row.ownerId === "e0" && row.kind === "resultado")!;
    state.tasks = [{ ...task, id: "tour-spotlight-task", assignmentId: null, month: currentMonth(), status: "Pendiente" }];
    state.tour.e0 = 3;
    state.tourStepId = { e0: "board-timer" };
    state.tourVersion = { e0: 6 };
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    await waitFor(() => {
      expect(document.querySelectorAll("[data-tour=task-timers].spotlight")).toHaveLength(1);
      expect(document.querySelectorAll(".spotlight")).toHaveLength(1);
    });
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await waitFor(() => expect(document.querySelectorAll("[data-tour=task-controls].spotlight")).toHaveLength(1));
    fireEvent.click(document.querySelector(".column-toggle")!);
    await waitFor(() => expect(document.querySelector(".heading")?.classList.contains("spotlight")).toBe(false));
  });
  it("muestra iniciales de encargado en el organigrama", async () => {
    const state = prepare("boss");
    state.profiles.find((profile) => profile.id === "m1")!.name = "Lucía Fernández";
    localStorage.setItem(KEY, JSON.stringify(state));
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="team"]')!);
    await waitFor(() => expect(document.querySelector(".org-manager .avatar")).not.toBeNull());
    expect(document.querySelector(".org-manager .avatar")?.textContent).toBe("LF");
    expect(document.querySelectorAll(".org-manager .avatar").length).toBeGreaterThan(0);
  });
  it("muestra anticipación en el tablero personal y análisis de gerencia", () => {
    const employee = prepare("e0");
    const sample = seed().tasks.find((row) => row.ownerId === "e0" && row.kind === "resultado")!;
    employee.tasks = [{
      ...sample,
      id: "timeliness-card",
      assignmentId: null,
      month: currentMonth(),
      due: "9999-12-31",
      status: "Completada",
      completedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    }];
    localStorage.setItem(KEY, JSON.stringify(employee));
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="tasks"]')!);
    fireEvent.click(screen.getByRole("button", { name: /Completada/ }));
    const badge = document.querySelector(".timeliness-badge");
    record("timeliness_employee_card", !!badge && /Completada \d+ días antes/.test(badge.textContent || ""), {
      badge: badge?.textContent,
      task: stored().tasks[0],
      renderedTasks: document.querySelectorAll("[data-task-id]").length,
    });

    cleanup();
    const manager = prepare("boss");
    manager.tasks = [{ ...employee.tasks[0]!, ownerId: "e0" }];
    localStorage.setItem(KEY, JSON.stringify(manager));
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="analytics"]')!);
    expect(screen.getByRole("heading", { name: "Anticipación de plazos" })).toBeTruthy();
    expect(screen.getByText("1/1 antes del plazo · 100%")).toBeTruthy();
  });
  it("pasa cursor tenue al gráfico y conserva la navegación del clic por empleado", () => {
    const state = prepare("boss");
    const task = seed().tasks.find((row) => row.ownerId === "e0" && row.kind === "resultado")!;
    state.tasks = [{ ...task, id: "chart-navigation-task", assignmentId: null, month: currentMonth() }];
    localStorage.setItem(KEY, JSON.stringify(state));
    chartProbe.cursorProps = [];
    render(<App />);
    fireEvent.click(document.querySelector('[data-nav="analytics"]')!);
    expect(chartProbe.cursorProps.length).toBeGreaterThanOrEqual(2);
    expect(chartProbe.cursorProps.every((cursor) => cursor.fillOpacity === 0.12 && cursor.strokeOpacity === 0.55)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Por equipo" }));
    chartProbe.rowId = "t1";
    fireEvent.click(screen.getByRole("button", { name: "chart weighted" }));
    expect((screen.getByLabelText("Equipo") as HTMLSelectElement).value).toBe("t1");
    fireEvent.click(screen.getByRole("button", { name: "Por sector" }));
    chartProbe.rowId = "Tesorería";
    fireEvent.click(screen.getByRole("button", { name: "chart weighted" }));
    expect((screen.getByLabelText("Sector") as HTMLSelectElement).value).toBe("Tesorería");
    fireEvent.click(screen.getByRole("button", { name: "Por empleado" }));
    chartProbe.rowId = "e0";
    fireEvent.click(screen.getByRole("button", { name: "chart weighted" }));
    expect(document.querySelector("nav button.active")?.getAttribute("data-nav")).toBe("tasks");
    expect(screen.getByRole("button", { name: "Perfil que estás viendo" }).textContent).toContain("Valentino Magni");
  });
  it("recorrido no avanza vista si falló guardar avance", () => {
    const state = prepare();
    state.tour.e0 = 3;
    state.tourStepId = { e0: "board-timer" };
    state.tourVersion = { e0: 6 };
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
      "1/9",
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
    fireEvent.click(await screen.findByRole("button", { name: "Preparar mi tablero" }));
    expect(
      document.querySelector("nav button.active")?.getAttribute("data-nav"),
    ).toBe("day");
    expect(document.querySelector(".tour-coach small")?.textContent).toContain(
      "1/9",
    );
    const saved = stored();
    expect(saved.tour.e0).toBe(0);
    expect(saved.tourVersion?.e0).toBe(6);
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
    for (let step = 0; step < 8; step++)
      fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(document.querySelector(".tour-coach small")?.textContent).toContain(
      "9/9",
    );
    const before = stored();
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    expect(document.querySelector(".tour-coach")).toBeNull();
    expect(stored().tour.e0).toBe(9);
    expect(stored().tourVersion?.e0).toBe(6);
    fireEvent.click(screen.getByRole("button", { name: "Recorrido guiado" }));
    expect(document.querySelector(".tour-coach small")?.textContent).toContain(
      "1/9",
    );
    expect(stored().tour.e0).toBe(0);
    expect(stored().assignments).toEqual(before.assignments);
    expect(stored().tasks).toEqual(before.tasks);
  });
  it("fallo al abrir recorrido mantiene vista y progreso; reintento abre coherente", () => {
    const state = prepare();
    state.onboarding.e0.home = "tasks";
    state.tour.e0 = 4;
    state.tourVersion = { e0: 6 };
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
      "5/9",
    );
    expect(
      document.querySelector("nav button.active")?.getAttribute("data-nav"),
    ).toBe("operations");
  });
  it("fallo al cerrar recorrido conserva último paso; Listo se puede reintentar", () => {
    const state = prepare();
    state.tour.e0 = 8;
    state.tourVersion = { e0: 6 };
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
      "9/9",
    );
    expect(
      document.querySelector("nav button.active")?.getAttribute("data-nav"),
    ).toBe("planning");
    expect(stored()).toEqual(before);
    setItem.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    expect(document.querySelector(".tour-coach")).toBeNull();
    expect(stored().tour.e0).toBe(9);
  });
  it("editar nota con guardado fallido preserva ID y campos; reintento actualiza una sola nota", async () => {
    prepare();
    render(<App />);
    await openNotes();
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
