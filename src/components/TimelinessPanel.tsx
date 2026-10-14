import type { TimelinessBucket, TimelinessSummary } from "../domain/timeliness";
import { Panel } from "./ui";

const percent = (value: number | null) =>
  value === null ? "Sin muestra" : `${value}%`;
const average = (bucket?: TimelinessBucket) =>
  bucket?.averageDaysAhead === null || !bucket
    ? "Sin muestra"
    : `${bucket.averageDaysAhead} días antes (promedio de anticipados)`;

export function TimelinessNumbers({
  value,
  historical = false,
  includeOperational = true,
}: {
  value?: TimelinessSummary;
  historical?: boolean;
  includeOperational?: boolean;
}) {
  if (!value)
    return <div className="note">{historical ? "Sin medición histórica" : "Sin medición disponible"}</div>;
  return (
    <div className="timeliness-grid">
      {[
        ["Entregables", value.results],
        ...(includeOperational ? [["Metas operativas", value.operational] as const] : []),
      ].map(([name, raw]) => {
        const bucket = raw as TimelinessBucket;
        return (
          <div className="timeliness-summary" key={name as string}>
            <b>{name as string}</b>
            <strong>{bucket.early}/{bucket.evaluated} antes del plazo · {percent(bucket.earlyRate)}</strong>
            <span>{average(bucket)}</span>
            <small>{bucket.onDate} en fecha · {bucket.late} después · {bucket.pending} pendientes · {bucket.overdue} vencidas</small>
            {(bucket.unknown > 0 || bucket.noDeadline > 0) && (
              <small>{bucket.unknown} sin medición · {bucket.noDeadline} sin plazo</small>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TimelinessPanel({
  value,
  rows,
  includeOperational = true,
}: {
  value: TimelinessSummary;
  rows?: { id: string; name: string; timeliness?: TimelinessSummary }[];
  includeOperational?: boolean;
}) {
  return (
    <Panel
      title="Anticipación de plazos"
      sub={includeOperational ? "Días calendario antes del vencimiento. En metas operativas cuenta cuándo se registró la cantidad que alcanzó la meta. No suma puntos al KPI ponderado." : "Días calendario antes del vencimiento de entregables completados. La actividad operativa se informa por cantidad, carga y tiempo."}
      collapsible
      defaultOpen={false}
    >
      <TimelinessNumbers value={value} includeOperational={includeOperational} />
      {rows?.length ? (
        <div className="table-wrap timeliness-table">
          <table>
            <thead><tr><th>Ámbito</th><th>Entregables antes / evaluables</th><th>Anticipación media</th>{includeOperational && <><th>Metas operativas antes / evaluables</th><th>Anticipación media de metas</th></>}</tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.timeliness?.results.early ?? 0}/{row.timeliness?.results.evaluated ?? 0} · {percent(row.timeliness?.results.earlyRate ?? null)}</td>
                <td>{average(row.timeliness?.results)}</td>
                {includeOperational && <>
                  <td>{row.timeliness?.operational.early ?? 0}/{row.timeliness?.operational.evaluated ?? 0} · {percent(row.timeliness?.operational.earlyRate ?? null)}</td>
                  <td>{average(row.timeliness?.operational)}</td>
                </>}
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
    </Panel>
  );
}
