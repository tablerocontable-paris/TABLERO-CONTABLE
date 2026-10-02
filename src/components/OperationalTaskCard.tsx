import { ArrowRight, Building2, CalendarDays, Plus } from "lucide-react";
import type { Task } from "../domain/model";
import { Meter } from "./ui";
import TimelinessBadge from "./TimelinessBadge";
import type { TaskTimeliness } from "../domain/timeliness";

export default function OperationalTaskCard({
  task,
  company,
  owner,
  coverOwner,
  scheduled,
  quantity,
  time,
  closed,
  timeliness,
  onClock,
  onLog,
  onDetails,
}: {
  task: Task;
  company: string;
  owner: string;
  coverOwner?: string;
  scheduled: string;
  quantity: number;
  time: string;
  closed: boolean;
  timeliness: TaskTimeliness;
  onClock: () => void;
  onLog: () => void;
  onDetails: () => void;
}) {
  const completion = Math.round((quantity / task.target) * 100);
  const running = task.sessions?.some((session) => !session.end) || false;
  return (
    <section className="panel operation" data-task-id={task.id}>
      <div className="card-top">
        <span className="company-tag"><Building2 size={11} /> {company}</span>
        <b>{task.weight} pts</b>
      </div>
      <h2>{task.title}</h2>
      <TimelinessBadge value={timeliness} />
      <p>{coverOwner ? `Tarea de ${owner} · cobertura a cargo de ${coverOwner}` : owner}</p>
      {task.scheduledOn && <small>Realización: {scheduled}</small>}
      <div className="timer-mini">
        <span>◷ {task.sessions?.length ? `${time} registrados` : "Sin tiempo registrado"}</span>
        {!closed && !task.blockedBy && task.status !== "Completada" && (
          <button aria-label={running ? `Pausar cronómetro de ${task.title}` : `Iniciar cronómetro de ${task.title}`} onClick={onClock}>
            {running ? "Pausar" : "Cronometrar"}
          </button>
        )}
      </div>
      <div className="quantity">
        <strong>{quantity}</strong>
        <span>/ {task.target} {task.unit}</span>
      </div>
      <Meter value={completion} />
      <div className="operation-footer">
        <small>{completion}% de la meta</small>
        <button className="primary" disabled={closed} onClick={onLog}>
          <Plus size={14} /> Registrar
        </button>
      </div>
      <button className="text-button" onClick={onDetails}>
        <CalendarDays size={13} /> Ver registros <ArrowRight size={13} />
      </button>
    </section>
  );
}
