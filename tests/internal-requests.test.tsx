// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { load, persist, seed } from "../src/data/repository";
import { defaultSchedule } from "../src/domain/schedule";
import { materialize, type Assignment } from "../src/domain/model";
import InternalRequests from "../src/components/InternalRequests";
import {
  canConvertInternalRequest,
  canViewInternalRequest,
  completeInternalRequestConversion,
  createInternalRequest,
  replyToInternalRequest,
  setInternalRequestStatus,
  visibleInternalRequests,
  type InternalRequest,
} from "../src/domain/internalRequests";

afterEach(() => { cleanup(); localStorage.clear(); });
const counter = (() => { let value = 0; return () => `request-${++value}`; })();
function request(overrides: Partial<InternalRequest> = {}): InternalRequest {
  return {
    id: "r1", kind: "work_request", authorId: "e0", recipientId: "boss",
    urgency: "medium", module: "Vencimientos", subject: "Revisar fecha",
    description: "La fecha no coincide.", status: "new", createdAt: "2026-10-06T10:00:00Z",
    updatedAt: "2026-10-06T10:00:00Z", messages: [],
    history: [{ id: "h1", actorId: "e0", status: "new", note: "Solicitud creada", createdAt: "2026-10-06T10:00:00Z" }],
    ...overrides,
  };
}

describe("consultas y pedidos internos del laboratorio", () => {
  it("limita visibilidad al autor, destinatario y jefatura", () => {
    const state = seed();
    const item = request();
    expect(canViewInternalRequest(item, state.profiles.find((p) => p.id === "e0")!)).toBe(true);
    expect(canViewInternalRequest(item, state.profiles.find((p) => p.id === "boss")!)).toBe(true);
    expect(canViewInternalRequest(item, state.profiles.find((p) => p.id === "e1")!)).toBe(false);
    expect(canViewInternalRequest(item, { ...state.profiles.find((p) => p.id === "boss")!, active: false })).toBe(false);
  });

  it("ordena los abiertos por urgencia y antigüedad, y deja resueltos al final", () => {
    const state = seed();
    const rows = [
      request({ id: "low", urgency: "low", createdAt: "2026-10-01" }),
      request({ id: "new-urgent", urgency: "urgent", createdAt: "2026-10-02" }),
      request({ id: "old-urgent", urgency: "urgent", createdAt: "2026-10-01" }),
      request({ id: "resolved", urgency: "urgent", status: "resolved", createdAt: "2026-09-01" }),
    ];
    expect(visibleInternalRequests(rows, state.profiles.find((p) => p.id === "boss")!).map((row) => row.id))
      .toEqual(["old-urgent", "new-urgent", "low", "resolved"]);
  });

  it("valida, recorta y registra alta e historial sin convertirla en tarea", () => {
    const created = createInternalRequest({ kind: "suggestion", authorId: "e0", recipientId: "m1", urgency: "high", module: " Vencimientos ", subject: " Mejorar aviso ", description: " Mostrar el plazo fiscal. ", now: "2026-10-06T12:00:00Z", makeId: counter });
    expect(created).toMatchObject({ module: "Vencimientos", subject: "Mejorar aviso", description: "Mostrar el plazo fiscal.", status: "new", recipientId: "m1" });
    expect(created.history).toHaveLength(1);
    expect(() => createInternalRequest({ kind: "work_request", authorId: "e0", recipientId: "boss", urgency: "low", module: "", subject: "x", description: "y", now: "", makeId: counter })).toThrow(/módulo/);
  });

  it("convierte un pedido de trabajo sólo con decisión de jefatura y vincula una única tarjeta", () => {
    const state = seed();
    const item = request();
    state.internalRequests = [item];
    const boss = state.profiles.find((profile) => profile.id === "boss")!;
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    expect(canConvertInternalRequest(item, employee)).toBe(false);
    expect(canConvertInternalRequest(item, boss)).toBe(true);
    expect(canConvertInternalRequest(request({ kind: "suggestion" }), boss)).toBe(false);
    expect(canConvertInternalRequest(request({ kind: "technical_error" }), boss)).toBe(false);

    const assignment: Assignment = {
      id: "request-assignment", templateId: null, title: item.subject, ownerId: "e0", companyId: "c1",
      sector: "Tesorería", kind: "resultado", weight: 3, unit: "", target: 0, day: 21,
      frequency: "única", schedule: defaultSchedule("2026-10-21"), steps: [],
      startMonth: "2026-10", priority: "Media",
    };
    const withTask = materialize({ ...state, assignments: [...state.assignments, assignment] }, "2026-10");
    const task = withTask.tasks.find((candidate) => candidate.assignmentId === assignment.id)!;
    const converted = completeInternalRequestConversion(
      withTask, item.id, boss, assignment, task, "2026-10-07T12:00:00.000Z", counter,
    );
    expect(converted).toMatchObject({ status: "resolved", convertedTaskId: task.id, convertedBy: boss.id });
    expect(converted.history.at(-1)).toMatchObject({ status: "resolved", note: `Convertido en tarea: ${item.subject}` });

    const saved = {
      ...withTask,
      tasks: withTask.tasks.map((candidate) => candidate.id === task.id ? { ...candidate, originRequestId: item.id } : candidate),
      internalRequests: [converted],
    };
    expect(() => completeInternalRequestConversion(
      saved, item.id, boss, assignment, task, "2026-10-07T12:01:00.000Z", counter,
    )).toThrow(/ya no puede convertirse/);
    expect(() => completeInternalRequestConversion(
      withTask, item.id, employee, assignment, task, "2026-10-07T12:00:00.000Z", counter,
    )).toThrow(/ya no puede convertirse/);
  });

  it("conserva pedidos al recargar y acepta estados guardados anteriores sin esta colección", () => {
    const state = seed();
    const created = request({ status: "resolved", convertedTaskId: state.tasks[0]!.id, convertedBy: "boss", convertedAt: "2026-10-06T15:00:00Z" });
    state.internalRequests = [created];
    state.tasks[0].originRequestId = created.id;
    persist(state, true);
    expect(load(true).internalRequests).toEqual([created]);
    expect(load(true).tasks[0].originRequestId).toBe(created.id);
    const older = seed();
    delete older.internalRequests;
    localStorage.setItem("paris-state-lab", JSON.stringify(older));
    expect(load(true).internalRequests).toEqual([]);
  });

  it("sólo destinatario o jefatura responden/cambian estado y cada cambio queda en historial", () => {
    const state = seed();
    const item = request();
    const employee = state.profiles.find((p) => p.id === "e1")!;
    expect(() => replyToInternalRequest(item, employee, "No", "2026-10-06T13:00:00Z", counter)).toThrow(/destinatario/);
    const boss = state.profiles.find((p) => p.id === "boss")!;
    const reviewing = setInternalRequestStatus(item, boss, "review", "2026-10-06T13:00:00Z", counter);
    const replied = replyToInternalRequest(reviewing, boss, "Lo reviso hoy.", "2026-10-06T14:00:00Z", counter);
    const closed = setInternalRequestStatus(replied, boss, "resolved", "2026-10-06T15:00:00Z", counter);
    expect(closed.status).toBe("resolved");
    expect(closed.messages[0].body).toBe("Lo reviso hoy.");
    expect(closed.history.map((event) => event.status)).toEqual(["new", "review", "responded", "resolved"]);
    const makeId = vi.fn(counter);
    expect(() => replyToInternalRequest(closed, boss, "Nueva respuesta tardía", "2026-10-06T16:00:00Z", makeId)).toThrow(/ya está resuelto/);
    expect(makeId).not.toHaveBeenCalled();
    expect(closed.messages).toHaveLength(1);
    const converted = request({ status: "resolved", convertedTaskId: "linked-task", convertedBy: "boss", convertedAt: "2026-10-06T15:00:00Z" });
    expect(() => replyToInternalRequest(converted, boss, "Respuesta", "2026-10-06T16:00:00Z", makeId)).toThrow(/ya está resuelto/);
    expect(converted.convertedTaskId).toBe("linked-task");
    expect(() => setInternalRequestStatus(closed, boss, "review", "", counter)).toThrow(/no está disponible/);
  });

  it("hace elegir el destino de las sugerencias y no muestra pedidos de pares", () => {
    const state = seed();
    state.internalRequests = [request({ authorId: "e1", recipientId: "boss", subject: "Privado de un par" })];
    state.internalRequests.push(request({ id: "resolved-mine", status: "resolved", messages: [{ id: "reply1", actorId: "boss", body: "Respuesta visible luego del cierre.", createdAt: "2026-10-06T11:00:00Z" }] }));
    const onCreate = vi.fn(() => true);
    const onConvert = vi.fn();
    const view = render(<InternalRequests state={state} actor={state.profiles.find((p) => p.id === "e0")!} onCreate={onCreate} onStatus={vi.fn()} onReply={vi.fn()} onConvert={onConvert} onOpenTask={vi.fn()} />);
    expect(screen.queryByText("Privado de un par")).toBeNull();
    expect(screen.getByText("Respuesta visible luego del cierre.")).toBeTruthy();
    expect(screen.queryByLabelText("Módulo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Nuevo pedido" }));
    const composePanel = screen.getByRole("heading", { name: "Nuevo pedido" }).closest(".panel")!;
    fireEvent.click(screen.getByRole("button", { name: "Plegar Nuevo pedido" }));
    expect(composePanel.querySelector<HTMLElement>(".panel-body")?.hidden).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Desplegar Nuevo pedido" }));
    expect(composePanel.querySelector<HTMLElement>(".panel-body")?.hidden).toBe(false);
    fireEvent.change(screen.getAllByLabelText("Tipo")[0], { target: { value: "suggestion" } });
    fireEvent.change(screen.getByLabelText("Enviar a"), { target: { value: "m1" } });
    fireEvent.change(screen.getByLabelText("Módulo"), { target: { value: "Tablero" } });
    fireEvent.change(screen.getByPlaceholderText("Resumí el pedido"), { target: { value: "Revisar un texto" } });
    fireEvent.change(screen.getByPlaceholderText("Contá qué pasó, qué necesitás o qué proponés…"), { target: { value: "Propongo acortar la etiqueta." } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ kind: "suggestion", recipientId: "m1", authorId: "e0", module: "Tablero" }));
    expect(screen.queryByLabelText("Módulo")).toBeNull();
    expect(screen.queryByRole("button", { name: "Convertir en tarea puntual" })).toBeNull();
    view.unmount();

    const bossState = seed();
    bossState.internalRequests = [request()];
    render(<InternalRequests state={bossState} actor={bossState.profiles.find((p) => p.id === "boss")!} onCreate={vi.fn(() => true)} onStatus={vi.fn()} onReply={vi.fn(() => true)} onConvert={onConvert} onOpenTask={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Convertir en tarea puntual" }));
    expect(onConvert).toHaveBeenCalledWith(expect.objectContaining({ id: "r1", kind: "work_request" }));
  });

  it("conserva borradores si guardar falla y los limpia sólo tras éxito", () => {
    const state = seed();
    const actor = state.profiles.find((profile) => profile.id === "e0")!;
    const onCreate = vi.fn(() => false);
    const onReply = vi.fn(() => false);
    render(<InternalRequests state={{ ...state, internalRequests: [request({ authorId: "e1", recipientId: "e0" })] }} actor={actor} onCreate={onCreate} onStatus={vi.fn()} onReply={onReply} onConvert={vi.fn()} onOpenTask={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo pedido" }));
    fireEvent.change(screen.getByLabelText("Módulo"), { target: { value: "Tablero" } });
    fireEvent.change(screen.getByPlaceholderText("Resumí el pedido"), { target: { value: "Borrador conservado" } });
    fireEvent.change(screen.getByPlaceholderText("Contá qué pasó, qué necesitás o qué proponés…"), { target: { value: "Texto que se debe preservar" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));
    expect(screen.getByDisplayValue("Borrador conservado")).toBeTruthy();
    expect(screen.getByDisplayValue("Texto que se debe preservar")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/Conservamos el borrador/);
    const reply = screen.getByLabelText("Respuesta") as HTMLTextAreaElement;
    fireEvent.change(reply, { target: { value: "Respuesta pendiente" } });
    fireEvent.click(screen.getByRole("button", { name: "Responder" }));
    expect(reply.value).toBe("Respuesta pendiente");
    onReply.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Responder" }));
    expect(reply.value).toBe("");
  });
});
