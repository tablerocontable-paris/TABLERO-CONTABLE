import { useState } from "react";
import { canSee, csvCell, type State, type Closure } from "../domain/model";
import { duration } from "../domain/workforce";
import { Panel, Dialog, Empty } from "./ui";
const percent = (n: number | null) =>
  n === null ? "Sin base" : `${Math.round(n)}%`;
export default function PeriodReports({
  state,
  month,
}: {
  state: State;
  month: string;
}) {
  const active = state.profiles.find((p) => p.id === state.activeId)!;
  const [selected, setSelected] = useState<Closure | null>(null);
  const reports = state.closures.filter(
    (c) =>
      c.month === month &&
      c.report &&
      canSee(active, c.ownerId, state.profiles),
  );
  const r = selected?.report;
  function exportReport(c: Closure) {
    const r = c.report!;
    const rows = [
      [
        "Empleado",
        "Período",
        "Empresa",
        "Proceso",
        "Código catálogo",
        "Tipo",
        "Unidad",
        "Tareas",
        "Completadas",
        "Puntos previstos",
        "Puntos obtenidos",
        "Cumplimiento %",
        "Tiempo registrado",
        "Reaperturas",
      ],
      ...r.groups.map((g) => [
        r.employee,
        c.month,
        g.company,
        g.process,
        g.templateId || "Puntual",
        g.kind,
        g.unit,
        g.metrics.assigned,
        g.metrics.done,
        g.metrics.points,
        g.metrics.earned,
        g.metrics.weighted ?? "Sin base",
        duration(g.recordedSeconds),
        g.reopenings,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-${c.ownerId}-${c.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Panel
      title="Reportes emitidos al cierre"
      sub="Un reporte por empleado y período, generado al consolidar todas sus empresas. Disponible aquí para Juan Pablo; el envío por correo requiere conectar el servicio de producción."
    >
      {!reports.length ? (
        <Empty text="Se generan automáticamente con cada cierre. Los cierres anteriores a esta función conservan su exportación original." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Destinatario al cierre</th>
                <th>Cumplimiento</th>
                <th>Tiempo registrado</th>
                <th>Reporte</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((c) => (
                <tr key={c.id}>
                  <td>{c.report!.employee}</td>
                  <td>
                    {c.report!.recipientNames.join(", ") ||
                      "Sin jefe activo configurado"}
                  </td>
                  <td>{percent(c.metrics.weighted)}</td>
                  <td>{duration(c.report!.recordedSeconds)}</td>
                  <td>
                    <button onClick={() => setSelected(c)}>Ver reporte</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && r && (
        <Dialog
          title={`Reporte de ${r.employee} · ${selected.month}`}
          onClose={() => setSelected(null)}
          wide
        >
          <p>
            {r.team} · {r.sector} · generado{" "}
            {new Date(r.generatedAt).toLocaleString("es-AR")}
          </p>
          <div className="note">
            Tiempo registrado: {duration(r.recordedSeconds)} · Reaperturas:{" "}
            {r.reopenings}. Las coberturas conservan el titular y los ejecutores
            en el historial. El tiempo no mide por sí solo productividad.
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Proceso</th>
                  <th>Entregables</th>
                  <th>Operativas en meta</th>
                  <th>Cumplimiento</th>
                  <th>Tiempo</th>
                </tr>
              </thead>
              <tbody>
                {r.groups.map((g) => (
                  <tr key={g.key}>
                    <td>{g.company}</td>
                    <td>
                      {g.process}
                      <small>
                        {g.templateId
                          ? `Catálogo ${g.templateId}`
                          : "Trabajo puntual"}
                      </small>
                    </td>
                    <td>
                      {g.metrics.done}/{g.metrics.assigned}
                    </td>
                    <td>
                      {g.metrics.operationalTarget}/{g.metrics.operational}
                    </td>
                    <td>{percent(g.metrics.weighted)}</td>
                    <td>{duration(g.recordedSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <b>Observaciones de cierre:</b> {selected.note}
          </p>
          <button onClick={() => exportReport(selected)}>
            Descargar reporte CSV
          </button>
        </Dialog>
      )}
    </Panel>
  );
}
