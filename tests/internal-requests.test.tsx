// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { load, persist, seed } from "../src/data/repository";
import InternalRequests from "../src/components/InternalRequests";
import {
  canViewInternalRequest,
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

  it("conserva pedidos al recargar y acepta estados guardados anteriores sin esta colección", () => {
    const state = seed();
    const created = request();
    state.internalRequests = [created];
    persist(state, true);
    expect(load(true).internalRequests).toEqual([created]);
    const older = seed();
    delete older.internalRequests;
    persist(older, true);
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
    expect(() => setInternalRequestStatus(closed, boss, "review", "", counter)).toThrow(/no está disponible/);
  });

  it("hace elegir el destino de las sugerencias y no muestra pedidos de pares", () => {
    const state = seed();
    state.internalRequests = [request({ authorId: "e1", recipientId: "boss", subject: "Privado de un par" })];
    state.internalRequests.push(request({ id: "resolved-mine", status: "resolved", messages: [{ id: "reply1", actorId: "boss", body: "Respuesta visible luego del cierre.", createdAt: "2026-10-06T11:00:00Z" }] }));
    const onCreate = vi.fn();
    render(<InternalRequests state={state} actor={state.profiles.find((p) => p.id === "e0")!} onCreate={onCreate} onStatus={vi.fn()} onReply={vi.fn()} />);
    expect(screen.queryByText("Privado de un par")).toBeNull();
    expect(screen.getByText("Respuesta visible luego del cierre.")).toBeTruthy();
    fireEvent.change(screen.getAllByLabelText("Tipo")[0], { target: { value: "suggestion" } });
    fireEvent.change(screen.getByLabelText("Enviar a"), { target: { value: "m1" } });
    fireEvent.change(screen.getByLabelText("Módulo"), { target: { value: "Tablero" } });
    fireEvent.change(screen.getByPlaceholderText("Resumí el pedido"), { target: { value: "Revisar un texto" } });
    fireEvent.change(screen.getByPlaceholderText("Contá qué pasó, qué necesitás o qué proponés…"), { target: { value: "Propongo acortar la etiqueta." } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar pedido" }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ kind: "suggestion", recipientId: "m1", authorId: "e0", module: "Tablero" }));
  });
});
