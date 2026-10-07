// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { seed } from "../src/data/repository";
import { currentMonth, materialize, type State } from "../src/domain/model";
import { defaultSchedule } from "../src/domain/schedule";
import { submitHabitualTaskProposal } from "../src/domain/habitualTaskProposals";
import { HabitualTaskProposalInbox } from "../src/components/HabitualTaskProposals";
import NotificationCenter from "../src/components/NotificationCenter";
import { pendingParameterizations } from "../src/domain/parameterization";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);

function pendingProposals() {
  let state = seed();
  state.assignments = [];
  state.tasks = [];
  state.notifications = [];
  const input = {
    title: "Conciliación Banco Nación",
    process: "Banco Nación",
    description: "Comparar los movimientos y dejar las diferencias documentadas.",
    kind: "resultado" as const,
    unit: "",
    target: 0,
    schedule: defaultSchedule("2026-10-10", "mensual"),
    steps: ["Descargar el extracto", "Comparar movimientos"],
  };
  state = submitHabitualTaskProposal(state, state.profiles.find((profile) => profile.id === "e0")!, {
    ...input, id: "proposal-c1", companyId: "c1",
  }, "2026-10-07T12:00:00.000Z");
  state = submitHabitualTaskProposal(state, state.profiles.find((profile) => profile.id === "e1")!, {
    ...input, id: "proposal-c2", companyId: "c2",
  }, "2026-10-07T12:01:00.000Z");
  return state;
}

describe("interfaz de propuestas de tareas habituales", () => {
  it("muestra coincidencias como sugerencia y exige que jefatura vincule el estándar", () => {
    const state = pendingProposals();
    const manager = state.profiles.find((profile) => profile.id === "boss")!;
    const notify = vi.fn();
    let committed: State | undefined;
    render(<HabitualTaskProposalInbox
      state={state}
      actor={manager}
      month={currentMonth()}
      commit={(next) => { committed = next; return true; }}
      notify={notify}
    />);

    expect(screen.getByText("Posible coincidencia · 2")).toBeTruthy();
    expect(screen.getByText(/No se fusionaron nombres, empresas ni asignaciones/)).toBeTruthy();
    const approve = screen.getByRole("button", { name: "Vincular y activar 2 asignaciones" });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Estándar existente para Conciliación Banco Nación"), { target: { value: "cat1" } });
    fireEvent.click(approve);

    expect(committed?.habitualTaskProposals?.every((proposal) => proposal.status === "approved")).toBe(true);
    expect(committed?.assignments).toHaveLength(2);
    expect(committed?.assignments.map((assignment) => [assignment.ownerId, assignment.companyId])).toEqual([["e0", "c1"], ["e1", "c2"]]);
    const materialized = materialize(committed!, currentMonth());
    expect(materialized.tasks.map((task) => task.companyId).sort()).toEqual(["c1", "c2"]);
    expect(notify).toHaveBeenCalledWith("Se activaron 2 asignaciones independientes en el laboratorio.");
  });

  it("suma las propuestas pendientes al contador y ofrece ir a revisarlas", () => {
    const state = pendingProposals();
    const openProposals = vi.fn();
    const expectedPending = pendingParameterizations(state).length + 2;
    render(<NotificationCenter
      state={state}
      commit={() => true}
      notify={() => {}}
      onOpenTask={() => {}}
      onOpenProposals={openProposals}
    />);

    fireEvent.click(screen.getByRole("button", { name: `Notificaciones: ${expectedPending} pendientes` }));
    fireEvent.click(screen.getByRole("button", { name: "Revisar propuestas" }));
    expect(openProposals).toHaveBeenCalledOnce();
  });
});
