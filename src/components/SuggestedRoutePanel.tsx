import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { suggestedRoute } from "../domain/laboratory-work";
import { calendarCanAccessTask } from "../domain/laboratory-work";
import type { Profile, State } from "../domain/model";
import { Panel } from "./ui";

type RouteRow = ReturnType<typeof suggestedRoute>[number];
const priorityOrder = ["Alta", "Media", "Baja"];

function comparisonReason(previous: RouteRow, current: RouteRow) {
  if ((previous.task.due || "9999") !== (current.task.due || "9999")) {
    const previousDue = previous.task.due || "sin fecha";
    const currentDue = current.task.due || "sin fecha";
    return `“${previous.task.title}” queda antes porque vence ${previousDue}; esta tarea vence ${currentDue}.`;
  }
  if (previous.task.priority !== current.task.priority) {
    const relative = priorityOrder.indexOf(previous.task.priority) < priorityOrder.indexOf(current.task.priority) ? "más alta" : "más baja";
    return `“${previous.task.title}” queda antes porque su prioridad ${previous.task.priority} es ${relative}; esta tarea tiene prioridad ${current.task.priority}.`;
  }
  if (previous.task.weight !== current.task.weight) {
    return `“${previous.task.title}” queda antes porque tiene peso ${previous.task.weight}; esta tarea tiene peso ${current.task.weight}.`;
  }
  if ((previous.task.scheduledOn || "9999") !== (current.task.scheduledOn || "9999")) {
    return `“${previous.task.title}” queda antes por su fecha programada ${previous.task.scheduledOn || "sin fecha"}; esta tarea está programada para ${current.task.scheduledOn || "sin fecha"}.`;
  }
  return `Empatan en vencimiento, prioridad, peso y fecha programada; se conserva un desempate estable para que el orden no cambie entre consultas.`;
}

function positionExplanation(row: RouteRow, previous?: RouteRow) {
  const waitingReason = row.ready ? "" : `Sigue en espera: ${row.reason}. `;
  if (previous) return `${waitingReason}${comparisonReason(previous, row)}`;
  return row.ready
    ? `Es la primera tarea habilitada. El orden considera su vencimiento (${row.task.due || "sin fecha"}), prioridad ${row.task.priority}, peso ${row.task.weight} y fecha programada (${row.task.scheduledOn || "sin fecha"}).`
    : `${waitingReason}Entre las tareas en espera, el orden considera vencimiento, prioridad, peso y fecha programada.`;
}

function RouteEntry({ row, index, previous, companyOf, onOpen }: {
  row: RouteRow; index: number; previous?: RouteRow; companyOf: (id: string) => string; onOpen: (taskId: string) => void;
}) {
  return <div className="suggested-route-entry">
    <button type="button" onClick={() => onOpen(row.task.id)}>
      <span className="route-rank">{index}</span>
      <span className="route-copy">
        <b>{row.task.title}</b>
        <small>{companyOf(row.task.companyId)} · vence {row.task.due || "sin fecha"} · prioridad {row.task.priority}</small>
        <small>{row.reason}</small>
      </span>
      <ArrowRight size={15} />
    </button>
    <details className="route-position-details">
      <summary>Por qué está en esta posición</summary>
      <p>{positionExplanation(row, previous)}</p>
    </details>
  </div>;
}

export default function SuggestedRoutePanel({ state, actor, profileId, month, companyId, teamId, sector, companyOf, onOpen }: {
  state: State; actor: Profile; profileId: string; month: string; companyId?: string; teamId?: string; sector?: string; companyOf: (id: string) => string; onOpen: (taskId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "ready" | "waiting">("all");
  const route = suggestedRoute(state, profileId, undefined, { month, companyId, teamId, sector }, actor)
    .filter(({ task }) => calendarCanAccessTask(state, actor, task));
  const visible = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("es");
    return route.filter(({ task, reason, ready }) => {
      if (filter === "ready" && !ready) return false;
      if (filter === "waiting" && ready) return false;
      if (!normalized) return true;
      return `${task.title} ${companyOf(task.companyId)} ${reason}`.toLocaleLowerCase("es").includes(normalized);
    });
  }, [route, search, filter, companyOf]);
  const ready = visible.filter((row) => row.ready);
  const waiting = visible.filter((row) => !row.ready);
  return <Panel title="Hoja de ruta sugerida" sub="Orden orientativo: primero lo habilitado, luego vencimiento, prioridad, peso y fecha programada. No inicia tareas ni relojes." collapsible defaultOpen>
    <div data-tour="day-route">
    {!route.length ? <p className="note">No hay entregables pendientes para este perfil con los filtros seleccionados.</p> : <div className="suggested-route">
      <div className="suggested-route-tools">
        <label><span>Buscar tarea</span><input type="search" aria-label="Buscar en la hoja de ruta" placeholder="Nombre, empresa o motivo" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label><span>Mostrar</span><select aria-label="Filtrar tareas de la hoja de ruta" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">Todas</option><option value="ready">Listas para empezar</option><option value="waiting">En espera</option></select></label>
        <span className="suggested-route-count" aria-live="polite">{visible.length} de {route.length} tareas</span>
      </div>
      {!visible.length ? <p className="note">No hay tareas que coincidan con la búsqueda y el filtro.</p> : <>
        {ready.map((row, index) => <RouteEntry key={row.task.id} row={row} index={index + 1} previous={index > 0 ? ready[index - 1] : undefined} companyOf={companyOf} onOpen={onOpen} />)}
        {!!waiting.length && <details open={filter === "waiting" || (search.trim().length > 0 && ready.length === 0)}><summary>{waiting.length} tareas en espera</summary>{waiting.map((row, index) => <RouteEntry key={row.task.id} row={row} index={ready.length + index + 1} previous={index > 0 ? waiting[index - 1] : undefined} companyOf={companyOf} onOpen={onOpen} />)}</details>}
      </>}
    </div>}
    </div>
  </Panel>;
}
