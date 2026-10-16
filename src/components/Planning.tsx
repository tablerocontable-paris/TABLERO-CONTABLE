import { useState } from "react";
import { Panel, Dialog } from "./ui";
import ScheduleEditor from "./ScheduleEditor";
import { type State, type Assignment } from "../domain/model";
import { canViewLabAssignment, scheduleOf, reviseAssignment } from "../domain/planning";
import { describeSchedule, type Schedule } from "../domain/schedule";
export default function Planning({
  state,
  month,
  commit,
  notify,
}: {
  state: State;
  month: string;
  commit: (s: State, a: string, id?: string) => boolean;
  notify: (s: string) => void;
}) {
  const active = state.profiles.find((p) => p.id === state.activeId)!;
  const [edit, setEdit] = useState<Assignment | null>(null);
  const [rule, setRule] = useState<Schedule | null>(null);
  const [search, setSearch] = useState("");
  const rows = state.assignments.filter(
    (a) =>
      !a.retired &&
      canViewLabAssignment(state, active, a) &&
      `${a.title} ${state.profiles.find((p) => p.id === a.ownerId)?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <Panel
      title="Planificación y recurrencias"
      sub={`${rows.length} regla${rows.length === 1 ? "" : "s"} · por tarea y empresa. El trabajo anterior conserva sus condiciones.`}
      collapsible
      defaultOpen={false}
    >
      <input
        data-tour="planning-rules"
        aria-label="Buscar planificación"
        placeholder="Buscar tarea o responsable"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="table-wrap" data-tour="planning-list">
        {rows.length ? <table>
          <thead>
            <tr>
              <th>Tarea</th>
              <th>Responsable / empresa</th>
              <th>Regla</th>
              <th>Vigencia</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{a.title}</td>
                <td>
                  {state.profiles.find((p) => p.id === a.ownerId)?.name}
                  <small>
                    {state.companies.find((c) => c.id === a.companyId)?.name}
                  </small>
                </td>
                <td>{describeSchedule(scheduleOf(a))}</td>
                <td>
                  {scheduleOf(a).startDate} →{" "}
                  {scheduleOf(a).endDate || "Sin fecha final"}
                </td>
                <td>
                  {active.role === "jefe" && (
                    <button
                      onClick={() => {
                        setEdit(a);
                        setRule({ ...scheduleOf(a), startDate: month + "-01" });
                      }}
                    >
                      Reprogramar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table> : <p className="empty-state" data-tour="planning-empty">No hay reglas para estos filtros.</p>}
      </div>
      {edit && rule && (
        <Dialog
          title="Reprogramar desde una fecha"
          onClose={() => setEdit(null)}
          wide
        >
          <p>
            {edit.title}. La fecha de inicio marca desde cuándo rige la nueva
            versión. Se reemplazan sólo ocurrencias pendientes sin actividad
            desde esa fecha.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                if (
                  commit(
                    reviseAssignment(state, edit.id, rule, active.id),
                    "Reprogramó asignación",
                    edit.id,
                  )
                )
                  setEdit(null);
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            <ScheduleEditor
              value={rule}
              onChange={setRule}
              month={rule.startDate.slice(0, 7) || month}
            />
            <div className="modal-actions">
              <button className="primary">Guardar nueva planificación</button>
            </div>
          </form>
        </Dialog>
      )}
    </Panel>
  );
}
