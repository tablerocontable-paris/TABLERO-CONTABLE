import { useMemo, useRef, useState } from "react";
import { CalendarDays, Search } from "lucide-react";
import { canWork } from "../domain/workforce";
import type { Profile, State, Task } from "../domain/model";
import { calendarCanAccessTask } from "../domain/laboratory-work";
import { Dialog, Empty } from "./ui";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR")
    .trim();
}

export default function QuickTaskSearch({
  state,
  active,
  laboratory = false,
  currentMonth,
  onClose,
  onSelect,
}: {
  state: State;
  active: Profile;
  laboratory?: boolean;
  currentMonth: string;
  onClose: () => void;
  onSelect: (task: Task) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedTaskRef = useRef(false);
  const results = useMemo(() => {
    const ordered = state.tasks
      .filter((task) => laboratory ? calendarCanAccessTask(state, active, task) : canWork(state, active, task))
      .sort((a, b) => {
        const currentPeriod = Number(b.month === currentMonth) - Number(a.month === currentMonth);
        if (currentPeriod) return currentPeriod;
        const openFirst = Number(a.status === "Completada") - Number(b.status === "Completada");
        if (openFirst) return openFirst;
        const period = b.month.localeCompare(a.month);
        if (period) return period;
        const due = (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31");
        return due || a.title.localeCompare(b.title, "es");
      });
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const matches = !terms.length ? ordered : ordered.filter((task) => {
        const owner = state.profiles.find((profile) => profile.id === task.ownerId)?.name || "";
        const company = state.companies.find((row) => row.id === task.companyId)?.name || "";
        const searchable = [task.title, company, owner, task.sector, task.status, task.month, task.due]
          .map(normalize)
          .join(" ");
        return terms.every((term) => searchable.includes(term));
      });
    return { rows: matches.slice(0, 10), matchCount: matches.length, accessibleCount: ordered.length };
  }, [active, currentMonth, laboratory, query, state]);
  const tasks = results.rows;

  return (
    <Dialog title="Buscar tareas" onClose={onClose} wide className="quick-task-search-dialog" restoreFocus={() => !selectedTaskRef.current} focusFallback={() => document.querySelector<HTMLElement>(".quick-search-trigger")}>
      <label className="quick-task-search-input">
        <Search size={18} aria-hidden="true" />
        <input
          autoFocus
          type="search"
          aria-label="Buscar tareas por nombre, empresa, persona o período"
          placeholder="Tarea, empresa, persona o período"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p className="quick-task-search-count">
        {query.trim()
          ? `${results.matchCount} resultado${results.matchCount === 1 ? "" : "s"} · ${results.accessibleCount} tareas en tu ámbito`
          : `Tareas accesibles · ${results.accessibleCount} en total`}
      </p>
      {tasks.length ? (
        <ul className="quick-task-search-results" aria-label="Resultados de tareas">
          {tasks.map((task) => {
            const owner = state.profiles.find((profile) => profile.id === task.ownerId)?.name || "Sin responsable";
            const company = state.companies.find((row) => row.id === task.companyId)?.name || "Sin empresa";
            return (
              <li key={task.id}>
              <button
                type="button"
                className="quick-task-search-result"
                onClick={() => { selectedTaskRef.current = true; onSelect(task); }}
              >
                <span className="quick-task-search-result-main">
                  <b>{task.title}</b>
                  <small>{company} · {owner} · {task.sector}</small>
                </span>
                <span className="quick-task-search-result-meta">
                  <span>{task.status}</span>
                  <small><CalendarDays size={13} aria-hidden="true" /> {task.month}</small>
                </span>
              </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty text="No encontramos tareas accesibles con ese criterio." />
      )}
      {results.matchCount > 10 && <p className="quick-task-search-hint">Mostramos 10 de {results.matchCount} resultados. Escribí más para acotar la búsqueda.</p>}
    </Dialog>
  );
}
