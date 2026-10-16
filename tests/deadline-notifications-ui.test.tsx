// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import NotificationCenter from "../src/components/NotificationCenter";
import { seed } from "../src/data/repository";
import type { State } from "../src/domain/model";

describe("campana de vencimientos", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("shows an authorized reminder and persists its read state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T15:00:00.000Z"));
    const state = seed();
    state.activeId = "e0";
    const source = state.tasks.find((task) => task.ownerId === "e0" && task.kind === "resultado")!;
    const task = { ...source, id: "ui-due", due: "2026-10-10", scheduledOn: "2026-10-10", status: "Pendiente" as const, completedAt: null };
    state.tasks = [task];
    const commit = vi.fn((_next: State) => true);

    render(
      <NotificationCenter
        state={state}
        commit={commit}
        notify={vi.fn()}
        onOpenTask={vi.fn()}
        laboratory
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Notificaciones:/ }));
    expect(screen.getByText("1 tarea vence en 3 días")).toBeTruthy();
    expect(screen.getByRole("button", { name: `Abrir tarea: ${task.title}` })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Marcar avisos como leídos" }));
    const saved = commit.mock.calls.at(-1)?.[0];
    expect(saved?.deadlineReminderReads).toMatchObject({
      [`deadline:e0:due-in-three-days:2026-10-07`]: "2026-10-07T15:00:00.000Z",
    });
  });

  it("actualiza el panel abierto al comenzar el día ART y marca leído el aviso del nuevo día", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T02:59:40.000Z"));
    const state = seed();
    state.activeId = "e0";
    const source = state.tasks.find((task) => task.ownerId === "e0" && task.kind === "resultado")!;
    const task = { ...source, id: "ui-midnight-open", due: "2026-10-08", scheduledOn: "2026-10-08", status: "Pendiente" as const, completedAt: null };
    state.tasks = [task];
    const commit = vi.fn((_next: State) => true);

    render(<NotificationCenter state={state} commit={commit} notify={vi.fn()} onOpenTask={vi.fn()} laboratory />);
    fireEvent.click(screen.getByRole("button", { name: "Notificaciones: 0 pendientes" }));
    expect(screen.getByText("No hay avisos pendientes para tu perfil.")).toBeTruthy();

    act(() => vi.advanceTimersByTime(20_100));
    expect(screen.getByRole("button", { name: "Notificaciones: 1 pendientes" })).toBeTruthy();
    expect(screen.getByText("1 tarea vence hoy")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Marcar avisos como leídos" }));
    const saved = commit.mock.calls.at(-1)?.[0];
    expect(saved?.deadlineReminderReads).toMatchObject({
      [`deadline:e0:due-today:2026-10-08`]: "2026-10-08T03:00:00.100Z",
    });
  });

  it("refresca el contador al recuperar foco tras suspensión y vuelve a filtrar al cambiar el actor", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T02:59:40.000Z"));
    const state = seed();
    state.activeId = "e0";
    const source = state.tasks.find((task) => task.ownerId === "e0" && task.kind === "resultado")!;
    state.tasks = [{ ...source, id: "ui-midnight-resume", due: "2026-10-08", scheduledOn: "2026-10-08", status: "Pendiente" as const, completedAt: null }];
    const view = render(<NotificationCenter state={state} commit={() => true} notify={vi.fn()} onOpenTask={vi.fn()} laboratory />);
    expect(screen.getByRole("button", { name: "Notificaciones: 0 pendientes" })).toBeTruthy();

    act(() => {
      vi.setSystemTime(new Date("2026-10-08T03:00:10.000Z"));
      window.dispatchEvent(new Event("focus"));
    });
    expect(screen.getByRole("button", { name: "Notificaciones: 1 pendientes" })).toBeTruthy();

    state.activeId = "e1";
    view.rerender(<NotificationCenter state={state} commit={() => true} notify={vi.fn()} onOpenTask={vi.fn()} laboratory />);
    expect(screen.getByRole("button", { name: "Notificaciones: 0 pendientes" })).toBeTruthy();
  });
});
