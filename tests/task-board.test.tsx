// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import TaskBoard, { orderTasks } from "../src/components/TaskBoard";
import { seed } from "../src/data/repository";
import type { Task } from "../src/domain/model";
afterEach(cleanup);
const task = (id: string, title: string, status: Task["status"]): Task => ({
  ...seed().tasks[0],
  id,
  title,
  status,
});
describe("columnas independientes y orden de tareas", () => {
  it("abrir o plegar una columna conserva la expansión de las otras", () => {
    render(
      <TaskBoard
        tasks={[
          task("p", "Trabajo pendiente", "Pendiente"),
          task("c", "Trabajo en curso", "En curso"),
          task("f", "Trabajo finalizado", "Completada"),
        ]}
        renderCard={(t) => <p key={t.id}>{t.title}</p>}
      />,
    );
    const pending = screen.getByRole("button", { name: "Pendiente 1" });
    const progress = screen.getByRole("button", { name: "En curso 1" });
    const completed = screen.getByRole("button", { name: "Completada 1" });
    expect(pending.getAttribute("aria-expanded")).toBe("true");
    expect(progress.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(progress);
    expect(pending.getAttribute("aria-expanded")).toBe("true");
    expect(completed.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(pending);
    expect(progress.getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByText("Trabajo pendiente")).toBeNull();
    expect(screen.getByText("Trabajo en curso")).toBeTruthy();
    fireEvent.click(completed);
    expect(pending.getAttribute("aria-expanded")).toBe("false");
    expect(progress.getAttribute("aria-expanded")).toBe("true");
  });
  it("ordena con acentos y números sin modificar tareas, identidad ni orden original", () => {
    const original = [
      task("z", "Zeta", "Pendiente"),
      task("b", "Banco 10", "Pendiente"),
      task("a", "Ámbito", "Pendiente"),
      task("b2", "Banco 2", "En curso"),
    ];
    expect(orderTasks(original, "az").map((t) => t.title)).toEqual([
      "Ámbito",
      "Banco 2",
      "Banco 10",
      "Zeta",
    ]);
    expect(orderTasks(original, "za").map((t) => t.title)).toEqual([
      "Zeta",
      "Banco 10",
      "Banco 2",
      "Ámbito",
    ]);
    expect(original.map((t) => t.id)).toEqual(["z", "b", "a", "b2"]);
    expect(orderTasks(original, "original")).toBe(original);
  });
  it("moves a card by drag and drop and reports its destination status", () => {
    const onMove = vi.fn();
    render(<TaskBoard tasks={[task("p", "Trabajo pendiente", "Pendiente"), task("w", "Trabajo en curso", "En curso")]} onMove={onMove} renderCard={t => <article key={t.id} className="task-card" data-task-id={t.id}>{t.title}</article>} />);
    fireEvent.click(screen.getByRole("button", { name: "En curso 1" }));
    const card = screen.getByText("Trabajo pendiente").closest("article")!;
    const target = document.querySelectorAll<HTMLElement>('[role="region"]')[1]!;
    const dataTransfer = { effectAllowed: "", dropEffect: "", setData: vi.fn(), getData: vi.fn(() => "p") };
    fireEvent.dragStart(card, { dataTransfer });
    expect(card.getAttribute("data-dragging")).toBe("true");
    fireEvent.dragOver(target, { dataTransfer });
    expect(target.parentElement?.className).toContain("is-drop-target");
    fireEvent.drop(target, { dataTransfer });
    expect(onMove).toHaveBeenCalledWith("p", "En curso", undefined);
    expect(card.getAttribute("data-landed")).toBe("true");
  });
  it("does not show a landed animation when the guarded move is rejected", () => {
    const onMove = vi.fn(() => false);
    render(<TaskBoard tasks={[task("p", "Trabajo pendiente", "Pendiente")]} onMove={onMove} renderCard={t => <article key={t.id}>{t.title}</article>} />);
    const card = screen.getByRole("article", { name: /Arrastrá para cambiar/ });
    const target = document.querySelectorAll<HTMLElement>("[role=region]")[1]!;
    const dataTransfer = { effectAllowed: "", dropEffect: "", setData: vi.fn(), getData: vi.fn(() => "p") };
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(onMove).toHaveBeenCalledWith("p", "En curso", undefined);
    expect(card.hasAttribute("data-landed")).toBe(false);
  });
  it("moves by keyboard and restores focus to the moved card after it remounts", async () => {
    function StatefulBoard() {
      const [tasks, setTasks] = useState([task("p", "Trabajo pendiente", "Pendiente")]);
      const onMove = (taskId: string, status: Task["status"]) => {
        setTasks((current) => current.map((row) => row.id === taskId ? { ...row, status } : row));
        return true;
      };
      return <TaskBoard tasks={tasks} onMove={onMove} renderCard={t => <article key={t.id} className="task-card" data-task-id={t.id}>{t.title}</article>} />;
    }
    render(<StatefulBoard />);
    fireEvent.click(screen.getByRole("button", { name: "En curso 0" }));
    const card = screen.getByRole("article", { name: /Arrastrá para cambiar/ });
    card.focus();
    fireEvent.keyDown(card, { altKey: true, key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("button", { name: "En curso 1" }).getAttribute("aria-expanded")).toBe("true"));
    await waitFor(() => {
      const moved = screen.getByRole("article", { name: /Arrastrá para cambiar/ });
      expect(moved.closest('[role="region"]')?.getAttribute("aria-labelledby")).toContain("task-column-");
      expect(document.activeElement).toBe(moved);
    });
  });
  it("prefixes ARIA regions per board and animates only an accepted move", () => {
    const onMove = vi.fn(() => false);
    const tasks = [task("p", "Trabajo pendiente", "Pendiente")];
    const board = (key: string) => <TaskBoard key={key} tasks={tasks} onMove={onMove} renderCard={t => <article key={t.id}>{t.title}</article>} />;
    const { container } = render(<>{board("own")}{board("coverage")}{<TaskBoard key="empty" tasks={[]} renderCard={t => <article key={t.id}>{t.title}</article>} />}</>);
    const ids = Array.from(container.querySelectorAll<HTMLElement>("[role=region]"), node => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>("[aria-controls]"), node => node.getAttribute("aria-controls")).every(id => !!id && document.getElementById(id))).toBe(true);
    const firstToggle = container.querySelector<HTMLButtonElement>(".column-toggle")!;
    const controls = firstToggle.getAttribute("aria-controls")!;
    fireEvent.click(firstToggle);
    expect(document.getElementById(controls)?.hidden).toBe(true);
    fireEvent.click(firstToggle);
    expect(document.getElementById(controls)?.hidden).toBe(false);
  });
});
