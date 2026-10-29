// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Gemelo from "../src/components/Gemelo";
import { buildGemeloContext } from "../src/domain/gemelo";
import { seed } from "../src/data/repository";
import { currentMonth, materialize } from "../src/domain/model";
import type { Profile, State, Task } from "../src/domain/model";

afterEach(cleanup);

function setup() {
  const month = currentMonth();
  const base = materialize(seed(), month);
  const foreignTask = {
    ...base.tasks.find((task) => task.ownerId === "e5")!,
    id: "foreign-task",
    title: "TAREA AJENA PROTEGIDA",
    companyId: "c1",
    month,
  } satisfies Task;
  const bankTask = {
    ...base.tasks.find((task) => task.ownerId === "e0")!,
    id: "canonical-bank-task",
    title: "Conciliación bancaria",
    taskParameters: { banco: "frances", cuenta: "Cuenta QA" },
  } satisfies Task;
  const state: State = {
    ...base,
    tasks: [...base.tasks.filter((task) => task.id !== bankTask.id), bankTask, foreignTask],
    annotations: [{
      id: "private-note", ownerId: "e5", title: "NOTA PERSONAL PRIVADA",
      content: "CONTENIDO PRIVADO", kind: "personal", reminderOn: null,
      createdAt: `${month}-01T12:00:00.000Z`, updatedAt: `${month}-01T12:00:00.000Z`, convertedTaskId: null,
    }],
    fiscalObligations: [{
      id: "foreign-obligation", companyId: "c1", obligationCode: "private",
      title: "OBLIGACIÓN AJENA", fiscalPeriod: month, milestone: "presentation",
      dueOn: `${month}-20`, sourceLabel: "demo", sourceRevision: "1",
      sourceCheckedAt: null, revision: 1, evaluationVersion: 2,
      requiredTaskIds: [foreignTask.id], createdAt: `${month}-01T12:00:00.000Z`,
      createdBy: null, updatedAt: `${month}-01T12:00:00.000Z`, history: [],
    }],
  };
  const actor = state.profiles.find((profile) => profile.id === "m1")!;
  const context = buildGemeloContext(state, actor, state.tasks, month, "", `${month}-10`);
  return { state, actor, month, context, foreignTask };
}

describe("Gemelo del laboratorio", () => {
  it("limita tareas y obligaciones a lo autorizado y no recibe anotaciones privadas", () => {
    const { state, actor, month, context } = setup();
    expect(Object.keys(context).sort()).toEqual(["obligations", "tasks"]);
    expect(JSON.stringify(context)).not.toContain("CONTENIDO PRIVADO");
    const openTask = vi.fn();
    render(<Gemelo actorId={actor.id} tasks={context.tasks} obligations={context.obligations}
      companyOf={(id) => state.companies.find((company) => company.id === id)?.name || id}
      onOpenTask={openTask} onOpenCalendar={() => undefined} />);

    expect(screen.getByRole("heading", { name: "Próximas acciones" })).toBeTruthy();
    expect(screen.queryByText("TAREA AJENA PROTEGIDA")).toBeNull();
    expect(screen.queryByText("NOTA PERSONAL PRIVADA")).toBeNull();
    expect(screen.queryByText("CONTENIDO PRIVADO")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Vencimientos" }));
    expect(screen.getByRole("heading", { name: "Obligaciones por revisar" })).toBeTruthy();
    expect(screen.queryByText("OBLIGACIÓN AJENA")).toBeNull();
  });

  it("prioriza tareas pendientes y habilita acceso sólo desde la tarea listada", () => {
    const { state, actor, context } = setup();
    const openTask = vi.fn();
    render(<Gemelo actorId={actor.id} tasks={context.tasks} obligations={context.obligations}
      companyOf={(id) => state.companies.find((company) => company.id === id)?.name || id}
      onOpenTask={openTask} onOpenCalendar={() => undefined} />);

    const openButtons = screen.getAllByRole("button", { name: "Abrir" });
    expect(openButtons.length).toBeGreaterThan(0);
    fireEvent.click(openButtons[0]!);
    expect(openTask).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole("textbox", { name: "¿Qué necesitás resolver?" }), { target: { value: "Conciliación Banco Francés" } });
    fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
    expect(screen.getByText("Conciliación bancaria")).toBeTruthy();
  });
});
