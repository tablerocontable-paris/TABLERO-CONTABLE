import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Task, Status } from "../domain/model";
import { Empty } from "./ui";

export type TaskOrder = "original" | "az" | "za";
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
}: {
  tasks: Task[];
  renderCard: (task: Task) => ReactNode;
}) {
  const [expanded, setExpanded] = useState<Record<Status, boolean>>({
    Pendiente: true,
    "En curso": false,
    Completada: false,
  });
  return (
    <div className="kanban">
      {(["Pendiente", "En curso", "Completada"] as Status[]).map(
        (status, index) => {
          const rows = tasks.filter((t) => t.status === status);
          const open = expanded[status];
          const region = `task-column-${index}`;
          return (
            <section
              className={`column ${open ? "expanded" : "folded"}`}
              key={status}
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
                    rows.map(renderCard)
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
