import { cloneElement, isValidElement, useId, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Task, Status } from "../domain/model";
import { Empty } from "./ui";

export type TaskOrder = "original" | "az" | "za";
const STATUSES: Status[] = ["Pendiente", "En curso", "Completada"];
const alphabet = new Intl.Collator("es-AR", {
  sensitivity: "base",
  numeric: true,
});
export function orderTasks(tasks: Task[], order: TaskOrder): Task[] {
  if (order === "original") return tasks;
  return [...tasks].sort((a, b) => {
    const title = alphabet.compare(a.title, b.title);
    return (order === "za" ? -title : title) || a.id.localeCompare(b.id);
  });
}
export default function TaskBoard({
  tasks,
  renderCard,
  onMove,
}: {
  tasks: Task[];
  renderCard: (task: Task) => ReactNode;
  onMove?: (taskId: string, status: Status, beforeTaskId?: string) => void | boolean;
}) {
  const id = useId();
  const boardRef = useRef<HTMLDivElement>(null);
  const keyboardMoveRef = useRef<string | null>(null);
  const [expanded, setExpanded] = useState<Record<Status, boolean>>({
    Pendiente: true,
    "En curso": false,
    Completada: false,
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<Status | null>(null);
  const [landedId, setLandedId] = useState<string | null>(null);
  function move(taskId: string, status: Status, beforeTaskId?: string, sourceId = draggedId, keyboard = false) {
    if (!onMove || !sourceId) return;
    const id = sourceId;
    setDraggedId(null);
    setDropStatus(null);
    keyboardMoveRef.current = keyboard ? id : null;
    const accepted = onMove(id, status, beforeTaskId);
    if (accepted === false) {
      keyboardMoveRef.current = null;
      return;
    }
    setLandedId(id);
    window.setTimeout(() => setLandedId(current => current === id ? null : current), 420);
  }
  useLayoutEffect(() => {
    const targetId = keyboardMoveRef.current;
    if (!targetId || !landedId || targetId !== landedId) return;
    const card = Array.from(boardRef.current?.querySelectorAll<HTMLElement>("[data-task-id]") || [])
      .find((candidate) => candidate.dataset.taskId === targetId);
    if (card) {
      keyboardMoveRef.current = null;
      card.focus();
    }
  }, [landedId, tasks]);
  function decorateCard(task: Task, status: Status) {
    const node = renderCard(task);
    if (!onMove || !isValidElement(node)) return node;
    const props = node.props as { className?: string };
    return cloneElement(node as React.ReactElement<Record<string, unknown>>, {
      draggable: true,
      tabIndex: 0,
      "aria-keyshortcuts": "Alt+ArrowLeft Alt+ArrowRight",
      "aria-roledescription": "tarjeta movible",
      "aria-label": `${task.title}. Arrastrá para cambiar de columna; también podés usar Alt y las flechas izquierda o derecha. Estado: ${status}`,
      "data-dragging": draggedId === task.id ? "true" : undefined,
      "data-landed": landedId === task.id ? "true" : undefined,
      className: `${props.className || ""}${draggedId === task.id ? " is-dragging" : ""}${landedId === task.id ? " just-landed" : ""}`.trim(),
      onDragStart: (event: DragEvent<HTMLElement>) => {
        setDraggedId(task.id);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
      },
      onDragEnd: () => { setDraggedId(null); setDropStatus(null); },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (draggedId && draggedId !== task.id) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault(); event.stopPropagation();
        if (draggedId && draggedId !== task.id) {
          const box = event.currentTarget.getBoundingClientRect();
          const index = tasks.findIndex(row => row.id === task.id);
          const insertAfter = event.clientY > box.top + box.height / 2;
          const nextCard = insertAfter ? tasks.slice(index + 1).find(row => row.status === status) : task;
          move(task.id, status, nextCard?.id);
        }
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
        event.preventDefault();
        const target = STATUSES[STATUSES.indexOf(status) + (event.key === "ArrowRight" ? 1 : -1)];
        if (target) move(task.id, target, undefined, task.id, true);
      },
    });
  }
  return (
    <div className="kanban" ref={boardRef} data-tour="board-movement">
      {STATUSES.map(
        (status, index) => {
          const rows = tasks.filter((t) => t.status === status);
          const open = expanded[status];
          const region = `task-column-${id}-${index}`;
          return (
            <section
              className={`column ${open ? "expanded" : "folded"}${dropStatus === status ? " is-drop-target" : ""}`}
              data-tour={open && rows.length ? "task-column-open" : !rows.length ? "task-column-empty" : undefined}
              key={status}
              onDragOver={event => { if (draggedId) { event.preventDefault(); setDropStatus(status); event.dataTransfer.dropEffect = "move"; } }}
              onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropStatus(current => current === status ? null : current); }}
              onDrop={event => { event.preventDefault(); if (draggedId) move("", status); }}
            >
              <h2 className="column-heading">
                <button
                  id={`${region}-toggle`}
                  className="column-toggle"
                  aria-expanded={open}
                  aria-controls={region}
                  onClick={() =>
                    setExpanded((previous) => ({
                      ...previous,
                      [status]: !previous[status],
                    }))
                  }
                >
                  {open ? (
                    <ChevronDown size={16} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={16} aria-hidden="true" />
                  )}
                  <span>{status}</span>
                  <b>{rows.length}</b>
                </button>
              </h2>
              <div
                id={region}
                role="region"
                aria-labelledby={`${region}-toggle`}
                hidden={!open}
              >
                {open &&
                  (rows.length ? (
                    rows.map(task => decorateCard(task, status))
                  ) : (
                    <Empty text="Sin tareas en esta columna." />
                  ))}
              </div>
            </section>
          );
        },
      )}
    </div>
  );
}
