// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { seed } from "../src/data/repository";
import TaskSchedulePanel from "../src/components/TaskSchedulePanel";

afterEach(() => cleanup());

function setup() {
  const original = seed();
  const source = original.tasks.find((task) => task.ownerId === "e0" && task.kind === "resultado")!;
  const task = { ...source, status: "Pendiente" as const, startedAt: null, completedAt: null, sessions: [] };
  const state = { ...original, activeId: "m1", activity: original.activity.filter((row) => row.taskId !== task.id), tasks: original.tasks.map((row) => row.id === task.id ? task : row) };
  return { state, task, actor: state.profiles.find((profile) => profile.id === "m1")! };
}

describe("reprogramación puntual de una tarea", () => {
  it("permite al encargado reprogramar y registra la fecha y el motivo en la auditoría de acción", () => {
    const { state, task, actor } = setup();
    const commit = vi.fn(() => true);
    const notify = vi.fn();
    render(<TaskSchedulePanel state={state} task={task} actor={actor} commit={commit} notify={notify} />);
    fireEvent.click(screen.getByText("Reprogramar esta tarea"));
    expect(screen.getByLabelText("Fecha programada")).toHaveProperty("value", task.due);
    fireEvent.change(screen.getByLabelText("Fecha programada"), { target: { value: `${task.month}-28` } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Esperar el extracto bancario" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar fecha" }));

    expect(commit).toHaveBeenCalledWith(expect.objectContaining({
      tasks: expect.arrayContaining([expect.objectContaining({ id: task.id, scheduledOn: `${task.month}-28` })]),
    }), expect.stringContaining("Esperar el extracto bancario"), task.id);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("avisos enviados"));
  });

  it("no expone la acción de reprogramar a un empleado", () => {
    const { state, task } = setup();
    const employee = state.profiles.find((profile) => profile.id === task.ownerId)!;
    render(<TaskSchedulePanel state={state} task={task} actor={employee} commit={vi.fn(() => true)} notify={vi.fn()} />);
    expect(screen.queryByText("Reprogramar esta tarea")).toBeNull();
  });
});
