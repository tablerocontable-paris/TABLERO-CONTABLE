import { ArrowRight, Building2, CalendarDays, Plus } from "lucide-react";
import type { Task } from "../domain/model";
import TimelinessBadge from "./TimelinessBadge";
import type { TaskTimeliness } from "../domain/timeliness";

export default function OperationalTaskCard({
  task, company, owner, coverOwner, scheduled, quantity, time, actorId, closed,
  timeliness, weightedLoad, unweightedQuantity, laboratory = false,
  onClock, onLog, onDetails,
}: {
  task: Task; company: string; owner: string; coverOwner?: string; scheduled: string;
  quantity: number; time: string; actorId: string; closed: boolean;
  timeliness: TaskTimeliness; weightedLoad?: number | null; unweightedQuantity?: number;
  laboratory?: boolean; onClock: () => void; onLog: () => void; onDetails: () => void;
}) {
  const completion = task.target > 0 ? Math.round((quantity / task.target) * 100) : null;
  const running = task.sessions?.some((session) => !session.end && session.actorId === actorId) || false;
  const hasRecorded = task.sessions?.some((session) => session.actorId === actorId) || false;
  return (
    <section className="panel operation" data-task-id={task.id}>
      <div className="card-top">
        <span className="company-tag"><Building2 size={11} /> {company}</span>
        {laboratory ? <span className="operation-load-label">{weightedLoad == null ? "Carga pendiente" : `${weightedLoad.toLocaleString("es-AR")} carga ponderada`}</span> : <b>{task.weight} pts</b>}
      </div>
      <h2>{task.title}</h2>
      {!laboratory && <TimelinessBadge value={timeliness} />}
      <p>{coverOwner ? `Tarea de ${owner} · cobertura a cargo de ${coverOwner}` : owner}</p>
      {task.scheduledOn && <small>Realización: {scheduled}</small>}
      <div className="timer-mini">
        <span>◷ {hasRecorded ? `${time} propios` : "Sin tiempo propio"}</span>
        {!closed && !task.blockedBy && task.status !== "Completada" && <button aria-label={running ? `Pausar cronómetro de ${task.title}` : `Iniciar cronómetro de ${task.title}`} onClick={onClock}>{running ? "Pausar" : "Cronometrar"}</button>}
      </div>
      <div className="quantity">
        <strong>{quantity.toLocaleString("es-AR")}</strong>
        <span>{task.unit || "movimientos"} registrados</span>
      </div>
      {laboratory ? (
        <div className="operation-load-detail">
          {weightedLoad == null
            ? `Carga pendiente de parametrizar${unweightedQuantity ? ` · ${unweightedQuantity} movimientos sin coeficiente` : ""}`
            : `Carga operativa: ${weightedLoad.toLocaleString("es-AR")} puntos de carga`}
          <small>La cantidad atendida no es una cuota. El tiempo se informa aparte.</small>
        </div>
      ) : (
        <>
          {completion !== null && <div className="track"><span style={{ transform: `scaleX(${Math.max(0, Math.min(1, completion / 100))})` }} /></div>}
          <div className="operation-footer"><small>{completion === null ? "Sin meta configurada" : `${completion}% de la meta`}</small><button className="primary" disabled={closed} onClick={onLog}><Plus size={14} /> Registrar</button></div>
        </>
      )}
      {laboratory && <div className="operation-footer"><small>Tiempo registrado por vos: {hasRecorded ? time : "sin medición"}</small><button className="primary" disabled={closed} onClick={onLog}><Plus size={14} /> Registrar</button></div>}
      <button className="text-button" onClick={onDetails}><CalendarDays size={13} /> Ver registros <ArrowRight size={13} /></button>
    </section>
  );
}
