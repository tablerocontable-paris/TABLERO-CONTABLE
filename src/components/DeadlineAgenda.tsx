import { useState } from "react";
import { type State, dateART, taskQuantity } from "../domain/model";
import { Panel, Empty } from "./ui";
import TimelinessBadge from "./TimelinessBadge";
import { taskTimeliness } from "../domain/timeliness";
export default function DeadlineAgenda({
  state,
  month,
  company,
  owner,
  sector,
  openTask,
  openNotes,
}: {
  state: State;
  month: string;
  company: string;
  owner: string;
  sector: string;
  openTask: (id: string) => void;
  openNotes: () => void;
}) {
  const [completed, setCompleted] = useState(false);
  const matches = state.tasks.filter(
    (t) =>
      (!company || t.companyId === company) &&
      (!owner || t.ownerId === owner) &&
      (!sector || t.sector === sector),
  );
  const done = (t: State["tasks"][number]) =>
    t.kind === "operativa"
      ? taskQuantity(t, state.activity) >= t.target
      : t.status === "Completada";
  const rows = matches
    .filter((t) => t.due.startsWith(month) && (completed || !done(t)))
    .sort(
      (a, b) =>
        a.due.localeCompare(b.due) || a.title.localeCompare(b.title, "es"),
    );
  const notes = (state.annotations || []).filter(
    (a) =>
      a.ownerId === state.activeId &&
      a.reminderOn?.startsWith(month) &&
      !a.convertedTaskId,
  );
  const undated = matches.filter(
    (t) => t.month === month && !t.due && !done(t),
  );
  return (
    <Panel
      title="Agenda y objetivos del mes"
      sub="Incluye entregables, metas operativas y recordatorios. Una fecha muestra el plazo del trabajo; el cumplimiento se registra en su tarjeta."
    >
      <label className="check-line">
        <input
          type="checkbox"
          checked={completed}
          onChange={(e) => setCompleted(e.target.checked)}
        />
        Mostrar también objetivos cumplidos
      </label>
      {!rows.length && !notes.length ? (
        <Empty text="No hay vencimientos pendientes en esta selección." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Trabajo / objetivo</th>
                <th>Empresa</th>
                <th>Responsable</th>
                <th>Cumplimiento</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className={!done(t) && t.due < dateART() ? "danger" : ""}>
                    {new Date(t.due + "T12:00:00").toLocaleDateString("es-AR")}
                  </td>
                  <td>
                    <strong>{t.title}</strong>
                    <small>
                      {t.kind === "operativa"
                        ? `${taskQuantity(t, state.activity)} / ${t.target} ${t.unit}`
                        : t.status}
                    </small>
                  </td>
                  <td>
                    {state.companies.find((c) => c.id === t.companyId)?.name}
                  </td>
                  <td>
                    {state.profiles.find((p) => p.id === t.ownerId)?.name}
                  </td>
                  <td>
                    <TimelinessBadge
                      value={taskTimeliness(
                        t,
                        state.activity,
                        new Date().toISOString(),
                      )}
                    />
                  </td>
                  <td>
                    <button onClick={() => openTask(t.id)}>
                      Abrir tarjeta
                    </button>
                  </td>
                </tr>
              ))}
              {notes.map((a) => (
                <tr key={a.id}>
                  <td>
                    {new Date(a.reminderOn! + "T12:00:00").toLocaleDateString(
                      "es-AR",
                    )}
                  </td>
                  <td>
                    {a.title}
                    <small>Recordatorio personal</small>
                  </td>
                  <td>—</td>
                  <td>Vos</td>
                  <td>Pendiente</td>
                  <td>
                    <button onClick={openNotes}>Ver anotación</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!undated.length && (
        <details>
          <summary>{undated.length} trabajos sin plazo</summary>
          <p>
            Definí un vencimiento al crear o reprogramar la tarea si querés
            medir su puntualidad.
          </p>
          {undated.map((t) => (
            <p key={t.id}>
              <button onClick={() => openTask(t.id)}>
                {t.title} ·{" "}
                {state.companies.find((c) => c.id === t.companyId)?.name}
              </button>
            </p>
          ))}
        </details>
      )}
    </Panel>
  );
}
