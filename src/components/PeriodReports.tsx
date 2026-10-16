import { useState } from "react";
import { Printer } from "lucide-react";
import { canSee, csvCell, type State, type Closure } from "../domain/model";
import { duration } from "../domain/workforce";
import { Panel, Dialog, Empty } from "./ui";
import { TimelinessNumbers } from "./TimelinessPanel";
const percent = (n: number | null) =>
  n === null ? "Sin base" : `${Math.round(n)}%`;
export default function PeriodReports({
  state,
  month,
  laboratory = false,
}: {
  state: State;
  month: string;
  laboratory?: boolean;
}) {
  const active = state.profiles.find((p) => p.id === state.activeId)!;
  const [selected, setSelected] = useState<Closure | null>(null);
  const reports = state.closures.filter(
    (c) =>
      c.month === month &&
      c.report &&
      canSee(active, c.ownerId, state.profiles),
  );
  const r = selected?.report ? {
    ...selected.report,
    coverageContributions: selected.report.coverageContributions?.filter((item) =>
      active.role === "jefe" || active.id === item.executorId || canSee(active, item.originalOwnerId, state.profiles)),
  } : undefined;
  function exportReport(c: Closure) {
    const report = {
      ...c.report!,
      coverageContributions: c.report!.coverageContributions?.filter((item) =>
        active.role === "jefe" || active.id === item.executorId || canSee(active, item.originalOwnerId, state.profiles)),
    };
    const hasLaboratorySummary = !!report.laboratorySummary;
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
        "Entregables antes / evaluables",
        "Entregables antes %",
        ...(hasLaboratorySummary
          ? ["Movimientos operativos", "Carga operativa ponderada", "Movimientos sin coeficiente", "Calidad", "Orden", "Oportunidad", "Evaluaciones"]
          : ["Metas antes / evaluables", "Metas antes %"]),
        "Promedio días anticipación entregables",
        ...(!hasLaboratorySummary ? ["Promedio días anticipación metas"] : []),
      ],
      ...report.groups.map((g) => [
        report.employee,
        c.month,
        g.company,
        g.process,
        g.templateId || "Puntual",
        g.kind,
        g.unit,
        g.kind === "operativa" && hasLaboratorySummary ? "No aplica" : g.metrics.assigned,
        g.kind === "operativa" && hasLaboratorySummary ? "No aplica" : g.metrics.done,
        g.kind === "operativa" && hasLaboratorySummary ? "No aplica" : g.metrics.points,
        g.kind === "operativa" && hasLaboratorySummary ? "No aplica" : g.metrics.earned,
        g.kind === "operativa" && hasLaboratorySummary ? "No aplica" : g.metrics.weighted ?? "Sin base",
        duration(g.recordedSeconds),
        g.reopenings,
        `${g.metrics.timeliness?.results.early ?? "Sin medición histórica"}/${g.metrics.timeliness?.results.evaluated ?? "Sin medición histórica"}`,
        g.metrics.timeliness ? (g.metrics.timeliness.results.earlyRate ?? "Sin muestra") : "Sin medición histórica",
        ...(hasLaboratorySummary
          ? g.kind !== "operativa"
            ? ["No aplica", "No aplica", "No aplica", "No aplica", "No aplica", "No aplica", "No aplica"]
            : g.operationalSummary
              ? [g.operationalSummary.movementCount, g.operationalSummary.weightedLoad ?? "Pendiente de parametrizar", g.operationalSummary.unweightedQuantity,
                g.operationalSummary.quality ?? "Sin evaluar", g.operationalSummary.order ?? "Sin evaluar", g.operationalSummary.timeliness ?? "Sin evaluar", g.operationalSummary.evaluations]
              : ["Sin resumen", "Sin resumen", "Sin resumen", "Sin resumen", "Sin resumen", "Sin resumen", "Sin resumen"]
          : [`${g.metrics.timeliness?.operational.early ?? "Sin medición histórica"}/${g.metrics.timeliness?.operational.evaluated ?? "Sin medición histórica"}`,
            g.metrics.timeliness?.operational.earlyRate ?? "Sin muestra"]),
        g.metrics.timeliness ? (g.metrics.timeliness.results.averageDaysAhead ?? "Sin muestra") : "Sin medición histórica",
        ...(!hasLaboratorySummary ? [g.metrics.timeliness?.operational.averageDaysAhead ?? "Sin muestra"] : []),
      ]),
      ...(report.contributions?.length ? [
        ["Contribuciones personales", "Período", "Proceso", "Participación %", "Puntos posibles", "Puntos obtenidos", "Tiempo registrado"],
        ...report.contributions.map((item) => [report.employee, c.month, item.title, item.shareBps / 100, item.possiblePoints, item.earnedPoints, duration(item.recordedSeconds)]),
      ] : []),
      ...(report.transfers?.length ? [
        ["Tarea", "ID tarea", "Responsable anterior", "Responsable nuevo", "Motivo", "Fecha"],
        ...report.transfers.map((item) => [item.title, item.taskId, item.formerOwner, item.newOwner, item.reason, item.transferredAt]),
      ] : []),
      ...(report.coverageContributions?.length ? [
        ["Trabajo en cobertura", "Empresa", "Titular original", "Ejecutor", "Tipo", "Cantidad", "Unidad", "Tiempo", "Finalización"],
        ...report.coverageContributions.map((item) => [item.title, item.company, item.originalOwner, item.executor, item.kind,
          item.activity.reduce((sum, row) => sum + row.qty, 0), item.unit,
          duration(item.sessions.reduce((sum, session) => sum + Math.max(0, (Date.parse(session.end || c.at) - Date.parse(session.start)) / 1000), 0)),
          item.completionAt || "Sin finalización por el reemplazo"]),
      ] : []),
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
      sub={`${reports.length} reporte${reports.length === 1 ? "" : "s"} disponibles · uno por empleado y período, generado al consolidar todas sus empresas.`}
      collapsible
      defaultOpen={false}
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
                {laboratory && <th>Operativas</th>}
                <th>Anticipación</th>
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
                  {laboratory && <td>{c.report!.laboratorySummary
                    ? c.report!.groups.some((group) => group.kind === "operativa")
                      ? <>{c.report!.laboratorySummary.operational.movementCount} movimientos · {c.report!.laboratorySummary.operational.weightedLoad === null ? "carga pendiente" : `${c.report!.laboratorySummary.operational.weightedLoad.toLocaleString("es-AR")} carga`}{c.report!.laboratorySummary.operational.unweightedQuantity > 0 && <small>{c.report!.laboratorySummary.operational.unweightedQuantity.toLocaleString("es-AR")} sin coeficiente</small>}</>
                      : "Sin operativas"
                    : "Métrica histórica original"}</td>}
                  <td>
                    {c.metrics.timeliness
                      ? `${c.metrics.timeliness.total.early}/${c.metrics.timeliness.total.evaluated} antes`
                      : "Sin medición histórica"}
                  </td>
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
          className="period-report-dialog"
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
          {r.laboratorySummary && <div className="note">En coberturas: {r.laboratorySummary.covered.movementCount} movimientos · {r.laboratorySummary.covered.recordedSeconds ? duration(r.laboratorySummary.covered.recordedSeconds) : "sin tiempo propio"}. Las métricas de calidad se informan por separado y no cambian el cumplimiento.</div>}
          <TimelinessNumbers value={selected.metrics.timeliness} historical={!selected.metrics.timeliness} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Proceso</th>
                  <th>Entregables</th>
                  <th>{r.laboratorySummary ? "Carga / revisión operativa" : "Operativas en meta"}</th>
                  <th>Cumplimiento</th>
                  <th>Antes / evaluables</th>
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
                    <td>{r.laboratorySummary && g.kind === "operativa" ? "No aplica" : `${g.metrics.done}/${g.metrics.assigned}`}</td>
                    <td>{r.laboratorySummary ? g.operationalSummary
                      ? <>{g.operationalSummary.quantityByUnit.map((item) => `${item.quantity.toLocaleString("es-AR")} ${item.unit}`).join(" · ") || `${g.operationalSummary.movementCount} movimientos`}<small>{g.operationalSummary.weightedLoad === null ? "Carga pendiente de parametrizar" : `${g.operationalSummary.weightedLoad.toLocaleString("es-AR")} carga ponderada`} · Calidad {g.operationalSummary.quality ?? "sin evaluar"} · Orden {g.operationalSummary.order ?? "sin evaluar"} · Oportunidad {g.operationalSummary.timeliness ?? "sin evaluar"} · {g.operationalSummary.evaluations} evaluaciones</small></>
                      : "—" : `${g.metrics.operationalTarget}/${g.metrics.operational}`}</td>
                    <td>{r.laboratorySummary && g.kind === "operativa" ? "No aplica" : percent(g.metrics.weighted)}</td>
                    <td>
                      {g.metrics.timeliness
                        ? `${g.metrics.timeliness.total.early}/${g.metrics.timeliness.total.evaluated}`
                        : "Sin medición histórica"}
                    </td>
                    <td>{duration(g.recordedSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!!r.contributions?.length && <>
            <h3>Contribución de {r.employee}</h3>
            <div className="table-wrap"><table><thead><tr><th>Proceso</th><th>Participación</th><th>Puntos posibles</th><th>Puntos logrados</th><th>Tiempo registrado</th></tr></thead>
              <tbody>{r.contributions.map((item) => <tr key={item.taskId}><td>{item.title}</td><td>{(item.shareBps / 100).toFixed(2).replace(/\.00$/, "")}%</td><td>{item.possiblePoints.toFixed(2)}</td><td>{item.earnedPoints.toFixed(2)}</td><td>{duration(item.recordedSeconds)}</td></tr>)}</tbody>
            </table></div>
          </>}
          {!!r.coverageContributions?.length && <>
            <h3>Trabajo realizado en cobertura</h3>
            <div className="table-wrap"><table><thead><tr><th>Proceso</th><th>Empresa</th><th>Titular</th><th>Ejecutor</th><th>Movimientos</th><th>Tiempo</th><th>Finalización</th></tr></thead>
              <tbody>{r.coverageContributions.map((item) => <tr key={`${item.taskId}-${item.executorId}`}>
                <td>{item.title}<small>{item.kind === "operativa" ? item.unit : "Entregable · sin puntos duplicados"}</small></td>
                <td>{item.company}</td><td>{item.originalOwner}</td><td>{item.executor}</td>
                <td>{item.activity.reduce((sum, row) => sum + row.qty, 0)}{item.activity.length ? ` ${item.unit}` : "Sin movimientos"}</td>
                <td>{duration(item.sessions.reduce((sum, session) => sum + Math.max(0, (Date.parse(session.end || r.generatedAt) - Date.parse(session.start)) / 1000), 0))}</td>
                <td>{item.completionAt ? new Date(item.completionAt).toLocaleString("es-AR") : "Sin finalización por el reemplazo"}</td>
              </tr>)}</tbody>
            </table></div>
          </>}
          {!!r.transfers?.length && <>
            <h3>Historial de traspasos</h3>
            <div className="table-wrap"><table><thead><tr><th>Tarea</th><th>Responsable anterior</th><th>Responsable nuevo</th><th>Motivo</th><th>Fecha</th></tr></thead>
              <tbody>{r.transfers.map((item, index) => <tr key={`${item.taskId}-${index}`}><td>{item.title}</td><td>{item.formerOwner}</td><td>{item.newOwner}</td><td>{item.reason}</td><td>{new Date(item.transferredAt).toLocaleString("es-AR")}</td></tr>)}</tbody>
            </table></div>
          </>}
          <p>
            <b>Observaciones de cierre:</b> {selected.note}
          </p>
          <div className="period-report-actions">
            <button type="button" onClick={() => window.print()}>
              <Printer size={16} /> Imprimir reporte
            </button>
            <button type="button" onClick={() => exportReport(selected)}>
              Descargar reporte CSV
            </button>
          </div>
        </Dialog>
      )}
    </Panel>
  );
}
