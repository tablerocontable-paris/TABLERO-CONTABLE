// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Workforce } from "../src/components/Workforce";
import { seed } from "../src/data/repository";
import { dateART } from "../src/domain/model";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

describe("baja y reasignación auditada en el laboratorio", () => {
  it("solicita motivo, conserva el perfil y permite reasignar trabajo futuro", async () => {
    let state = seed();
    const employee = state.profiles.find((person) => person.id === "e0")!;
    const task = state.tasks.find((row) => row.ownerId === employee.id)!;
    const [year, month] = dateART().slice(0, 7).split("-").map(Number);
    const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
    const due = `${nextMonth}-20`;
    state = {
      ...state,
      tasks: state.tasks.map((row) => row.id === task.id
        ? { ...row, status: "Pendiente", due, scheduledOn: due, sessions: [], completedAt: null,
            checklist: row.checklist.map((check) => ({ ...check, done: false })) }
        : row),
      activity: state.activity.filter((entry) => entry.taskId !== task.id),
    };
    const commit = vi.fn((next: typeof state) => { state = next; return true; });
    const notify = vi.fn();
    const user = userEvent.setup();
    const view = render(<Workforce state={state} commit={commit} notify={notify} />);

    fireEvent.click(within(screen.getByRole("row", { name: /Valentino Magni/ })).getByRole("button", { name: "Dar de baja" }));
    fireEvent.change(screen.getByLabelText("Motivo de baja"), { target: { value: "Cambio de puesto" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar baja" }));

    expect(state.profiles.find((person) => person.id === employee.id)?.active).toBe(false);
    expect(state.assignments.filter((assignment) => assignment.ownerId === employee.id).every((assignment) => assignment.retired)).toBe(true);
    const orphan = state.orphanedWork?.find((item) => item.taskId === task.id);
    expect(orphan).toMatchObject({ formerOwnerName: employee.name, reason: "Cambio de puesto", resolution: "ready", status: "pending" });

    view.rerender(<Workforce state={state} commit={commit} notify={notify} />);
    const card = screen.getAllByText(task.title).map((element) => element.closest(".orphaned-work-card"))
      .find((element) => element?.querySelector("select")) as HTMLElement;
    await user.selectOptions(within(card).getByLabelText(`Reasignar ${task.title}`), "e1");
    fireEvent.click(within(card).getByRole("button", { name: "Confirmar reasignación" }));
    expect(state.tasks.find((row) => row.id === task.id)).toMatchObject({ ownerId: "e1", teamId: "t1" });
    expect(state.orphanedWork?.find((item) => item.id === orphan?.id)?.status).toBe("reassigned");
    expect(notify).not.toHaveBeenCalled();
  });
});
