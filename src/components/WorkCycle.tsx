import { useMemo, useState } from "react";
import { Empty, Panel } from "./ui";
import { duration } from "../domain/workforce";
import {
  buildWorkCycle,
  type WorkCycleDimension,
  type WorkCycleMode,
} from "../domain/workCycle";
import type { Activity, State, Task } from "../domain/model";

const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const points = (value: number) => number.format(Math.round(value * 100) / 100);
const clock = (seconds: number) => duration(Math.max(0, Math.round(seconds)));

function operationSummary(amounts: Record<string, number>) {
  const entries = Object.entries(amounts).sort(([a], [b]) =>
    a.localeCompare(b, "es"),
  );
  return entries.length
    ? entries
        .map(([unit, value]) => `${number.format(value)} ${unit}`)
        .join(" · ")
    : "—";
}

export default function WorkCycle({
  tasks,
  activity,
  state,
  month,
}: {
  tasks: Task[];
  activity: Activity[];
  state: State;
  month: string;
}) {
  const [mode, setMode] = useState<WorkCycleMode>("week");
  const [dimension, setDimension] = useState<WorkCycleDimension>("person");
  const result = useMemo(
    () => buildWorkCycle({ tasks, activity, state, month, mode, dimension }),
    [tasks, activity, state, month, mode, dimension],
  );
  const totals = result.buckets.reduce(
    (sum, bucket) => ({
      plannedPoints: sum.plannedPoints + bucket.plannedPoints,
      completedTasks: sum.completedTasks + bucket.completedTasks,
      completedPoints: sum.completedPoints + bucket.completedPoints,
      recordedSeconds: sum.recordedSeconds + bucket.recordedSeconds,
      operationalRecords: sum.operationalRecords + bucket.operationalRecords,
    }),
    {
      plannedPoints: 0,
      completedTasks: 0,
      completedPoints: 0,
      recordedSeconds: 0,
      operationalRecords: 0,
    },
  );

  return (
    <>
      <Panel
        title="Ciclo de trabajo"
        sub="Carga planificada y ejecución registrada, ubicadas en el día que corresponde. Los filtros superiores mantienen el mismo alcance."
        collapsible
        defaultOpen={false}
        action={
          <div
            className="segmented work-cycle-mode"
            aria-label="Agrupar período"
          >
            {(
              [
                ["day", "Día"],
                ["week", "Semana"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={mode === value ? "selected" : ""}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        <div className="work-cycle-summary" aria-label="Totales del período">
          <div>
            <span>Puntos de entregables previstos</span>
            <b>{points(totals.plannedPoints)}</b>
          </div>
          <div>
            <span>Tareas cerradas</span>
            <b>{totals.completedTasks}</b>
          </div>
          <div>
            <span>Tiempo registrado</span>
            <b>{clock(totals.recordedSeconds)}</b>
          </div>
          <div>
            <span>Registros operativos</span>
            <b>{totals.operationalRecords}</b>
          </div>
        </div>
        {!result.buckets.length ? (
          <Empty text="Elegí un período válido para ver el ciclo de trabajo." />
        ) : (
          <div className="table-wrap work-cycle-table-wrap">
            <table className="work-cycle-table">
              <thead>
                <tr>
                  <th>{mode === "day" ? "Día" : "Semana"}</th>
                  <th>Ocurrencias previstas</th>
                  <th>Puntos de entregables previstos</th>
                  <th>Tareas cerradas</th>
                  <th>Puntos de entregables cerrados</th>
                  <th>Tiempo registrado</th>
                  <th>Operativas registradas</th>
                </tr>
              </thead>
              <tbody>
                {result.buckets.map((bucket) => (
                  <tr key={bucket.key}>
                    <th scope="row">{bucket.label}</th>
                    <td>{number.format(bucket.plannedOccurrences)}</td>
                    <td>{points(bucket.plannedPoints)}</td>
                    <td>{bucket.completedTasks || "—"}</td>
                    <td>
                      {bucket.completedTasks
                        ? points(bucket.completedPoints)
                        : "—"}
                    </td>
                    <td>
                      {bucket.recordedSeconds
                        ? clock(bucket.recordedSeconds)
                        : "—"}
                    </td>
                    <td>
                      {bucket.operationalRecords ? (
                        <>
                          {bucket.operationalRecords} registros
                          <small>
                            {operationSummary(bucket.operationalAmounts)}
                          </small>
                        </>
                      ) : (
                        "—"
                      )}
                      {!bucket.hasExecutionEvidence && (
                        <small>Sin ejecución registrada</small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="work-cycle-note">
          Lo planificado usa la fecha de realización de cada ocurrencia, no el
          vencimiento. El tiempo se reparte entre días calendario de Argentina.
          Los valores de operativas se separan por unidad y no se suman entre
          sí. “Sin ejecución registrada” indica falta de evidencia cargada; no
          significa tiempo libre.
        </p>
      </Panel>

      <Panel
        title="Comparación por ámbito"
        sub="La vista diaria o semanal sigue el filtro superior; este detalle compara persona, equipo, sector o empresa."
        collapsible
        defaultOpen={false}
        action={
          <label className="work-cycle-dimension">
            <span>Desglosar por</span>
            <select
              aria-label="Desglosar ciclo por"
              value={dimension}
              onChange={(event) =>
                setDimension(event.target.value as WorkCycleDimension)
              }
            >
              <option value="person">Persona</option>
              <option value="team">Equipo</option>
              <option value="sector">Sector</option>
              <option value="company">Empresa</option>
            </select>
          </label>
        }
      >
        {result.groups.length ? (
          <div className="table-wrap work-cycle-table-wrap">
            <table className="work-cycle-table">
              <thead>
                <tr>
                  <th>
                    {dimension === "person"
                      ? "Persona"
                      : dimension === "team"
                        ? "Equipo"
                        : dimension === "sector"
                          ? "Sector"
                          : "Empresa"}
                  </th>
                  <th>Ocurrencias planificadas</th>
                  <th>Puntos de entregables previstos</th>
                  <th>Tareas cerradas</th>
                  <th>Puntos de entregables cerrados</th>
                  <th>Tiempo registrado</th>
                  <th>Registros operativos</th>
                  <th>Cantidades por unidad</th>
                </tr>
              </thead>
              <tbody>
                {result.groups.map((group) => (
                  <tr key={group.key}>
                    <th scope="row">{group.label}</th>
                    <td>{number.format(group.plannedOccurrences)}</td>
                    <td>{points(group.plannedPoints)}</td>
                    <td>{group.completedTasks || "—"}</td>
                    <td>
                      {group.completedTasks
                        ? points(group.completedPoints)
                        : "—"}
                    </td>
                    <td>
                      {group.recordedSeconds
                        ? clock(group.recordedSeconds)
                        : "—"}
                    </td>
                    <td>{group.operationalRecords || "—"}</td>
                    <td>{operationSummary(group.operationalAmounts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="No hay tareas planificadas ni ejecución registrada para estos filtros." />
        )}
        {!!result.unattributedClosures && (
          <p className="work-cycle-note" role="status">
            {result.unattributedClosures} cierre(s) histórico(s) no tienen
            registrado quién los completó. Se conservan en el total del período
            y aparecen como sin atribución cuando corresponde; no se adjudican a
            una persona por suposición.
          </p>
        )}
        <p className="work-cycle-note">
          En tareas conjuntas, la carga planificada se reparte por las cuotas
          guardadas y el total cuenta la ocurrencia una sola vez. Los cierres
          nuevos identifican al actor desde este corte; los registros anteriores
          conservan la falta de atribución. La ejecución se agrupa por quien
          registró el tiempo o movimiento; las cuotas conjuntas conservan su
          snapshot.
        </p>
      </Panel>
    </>
  );
}
