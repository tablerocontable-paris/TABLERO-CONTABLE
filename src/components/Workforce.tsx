import { useState } from "react";
import { Panel, Dialog } from "./ui";
import { canSee, dateART, id, type State, type Profile } from "../domain/model";
import {
  registerAbsence,
  updateProfile,
  type Absence,
} from "../domain/workforce";
export function Workforce({
  state,
  commit,
  notify,
}: {
  state: State;
  commit: (s: State, action: string, entityId?: string) => boolean;
  notify: (s: string) => void;
}) {
  const active = state.profiles.find((p) => p.id === state.activeId)!;
  const [editing, setEditing] = useState<Profile | null>(null);
  return (
    <Panel
      title="Administración de perfiles"
      sub="Juan Pablo define el rol, responsable, equipo, empresas y estado del acceso."
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Persona</th>
              <th>Rol</th>
              <th>Responsable</th>
              <th>Acceso</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {state.profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.role}</td>
                <td>
                  {state.profiles.find((x) => x.id === p.managerId)?.name ||
                    "Dirección"}
                </td>
                <td>{p.active ? "Habilitado" : "Suspendido"}</td>
                <td>
                  <button onClick={() => setEditing({ ...p })}>
                    Configurar perfil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Dialog title="Administrar perfil" onClose={() => setEditing(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                if (
                  commit(
                    updateProfile(state, editing, active.id),
                    "Configuró perfil",
                    editing.id,
                  )
                )
                  setEditing(null);
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            <label>
              Nombre
              <input
                value={editing.name}
                required
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <label>
              Rol
              <select
                value={editing.role}
                disabled={editing.id === active.id}
                onChange={(e) => {
                  const role = e.target.value as Profile["role"];
                  const manager = state.profiles.find(
                    (p) =>
                      p.active &&
                      p.id !== editing.id &&
                      p.role === (role === "empleado" ? "encargado" : "jefe"),
                  );
                  setEditing({
                    ...editing,
                    role,
                    managerId: role === "jefe" ? null : manager?.id || null,
                    teamId:
                      role === "empleado"
                        ? manager?.teamId || ""
                        : editing.teamId,
                  });
                }}
              >
                <option value="empleado">Empleado</option>
                <option value="encargado">Encargado</option>
                <option value="jefe">Jefe / gerente</option>
              </select>
            </label>
            {editing.role !== "jefe" && (
              <>
                <label>
                  Responsable
                  <select
                    value={editing.managerId || ""}
                    required
                    onChange={(e) => {
                      const m = state.profiles.find(
                        (p) => p.id === e.target.value,
                      )!;
                      setEditing({
                        ...editing,
                        managerId: m.id,
                        teamId:
                          editing.role === "empleado"
                            ? m.teamId
                            : editing.teamId,
                      });
                    }}
                  >
                    <option value="">Seleccioná responsable</option>
                    {state.profiles
                      .filter(
                        (p) =>
                          p.active &&
                          p.id !== editing.id &&
                          p.role ===
                            (editing.role === "empleado"
                              ? "encargado"
                              : "jefe"),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Equipo
                  <select
                    value={editing.teamId}
                    onChange={(e) =>
                      setEditing({ ...editing, teamId: e.target.value })
                    }
                  >
                    {state.teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <div className="form-grid">
              <label>
                Sector
                <input
                  required
                  value={editing.sector}
                  onChange={(e) =>
                    setEditing({ ...editing, sector: e.target.value })
                  }
                />
              </label>
              <label>
                Puesto
                <input
                  required
                  value={editing.position}
                  onChange={(e) =>
                    setEditing({ ...editing, position: e.target.value })
                  }
                />
              </label>
            </div>
            <p>Empresas autorizadas</p>
            <div className="choices">
              {state.companies.map((c) => (
                <label className="check-line" key={c.id}>
                  <input
                    type="checkbox"
                    checked={editing.companyIds.includes(c.id)}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        companyIds: e.target.checked
                          ? [...editing.companyIds, c.id]
                          : editing.companyIds.filter((x) => x !== c.id),
                      })
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
            <label className="check-line">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) =>
                  setEditing({ ...editing, active: e.target.checked })
                }
              />
              Acceso habilitado
            </label>
            <div className="note">
              Al convertir un empleado en encargado se prepara su propio equipo.
              Las invitaciones y el restablecimiento de contraseña se
              habilitarán al conectar las cuentas reales. En esta demostración
              no se almacenan contraseñas.
            </div>
            <div className="modal-actions">
              <button className="primary">Guardar perfil</button>
            </div>
          </form>
        </Dialog>
      )}
    </Panel>
  );
}
export function Absences({
  state,
  commit,
  notify,
}: {
  state: State;
  commit: (s: State, action: string, entityId?: string) => boolean;
  notify: (s: string) => void;
}) {
  const active = state.profiles.find((p) => p.id === state.activeId)!;
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    ownerId: "",
    replacementId: "",
    from: dateART(),
    to: dateART(),
    kind: "Vacaciones" as Absence["kind"],
    note: "",
  });
  const people = state.profiles.filter(
    (p) =>
      p.active && canSee(active, p.id, state.profiles) && p.role !== "jefe",
  );
  const dates = state.absences || [];
  const visible = dates.filter(
    (a) =>
      canSee(active, a.ownerId, state.profiles) ||
      a.replacementId === active.id,
  );
  const affected = state.tasks.filter(
    (t) =>
      t.ownerId === form.ownerId &&
      t.status !== "Completada" &&
      (t.due || t.scheduledOn || "") >= form.from &&
      (t.due || t.scheduledOn || "") <= form.to,
  );
  return (
    <>
      <Panel
        title="Vacaciones, licencias y cobertura"
        sub="Se conserva el titular de la tarea. El reemplazante recibe acceso temporal a las tareas abiertas; cada sesión de trabajo conserva quién la realizó."
        action={
          active.role !== "empleado" ? (
            <button className="primary" onClick={() => setAdding(true)}>
              Registrar ausencia
            </button>
          ) : undefined
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Motivo</th>
                <th>Desde / hasta</th>
                <th>Cobertura</th>
                <th>Traspaso</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.id}>
                  <td>
                    {state.profiles.find((p) => p.id === a.ownerId)?.name}
                  </td>
                  <td>{a.kind}</td>
                  <td>
                    {a.from} → {a.to}
                  </td>
                  <td>
                    {state.profiles.find((p) => p.id === a.replacementId)
                      ?.name || "Sin cobertura asignada"}
                  </td>
                  <td>{a.note}</td>
                  <td>
                    {a.cancelledAt
                      ? "Cancelada"
                      : a.to < dateART()
                        ? "Finalizada"
                        : a.from > dateART()
                          ? "Próxima"
                          : "Vigente"}
                    {!a.cancelledAt &&
                      active.role !== "empleado" &&
                      canSee(active, a.ownerId, state.profiles) && (
                        <button
                          onClick={() =>
                            commit(
                              {
                                ...state,
                                absences: dates.map((x) =>
                                  x.id === a.id
                                    ? {
                                        ...x,
                                        cancelledAt: new Date().toISOString(),
                                      }
                                    : x,
                                ),
                              },
                              "Canceló ausencia",
                              a.id,
                            )
                          }
                        >
                          Cancelar ausencia
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && <p>No hay ausencias registradas en tu ámbito.</p>}
        </div>
      </Panel>
      {adding && (
        <Dialog
          title="Preparar ausencia y cobertura"
          onClose={() => setAdding(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const a = { ...form, id: id(), createdBy: active.id };
                if (
                  commit(
                    registerAbsence(state, a, active.id),
                    "Registró ausencia",
                    a.id,
                  )
                )
                  setAdding(false);
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            <label>
              Persona ausente
              <select
                required
                value={form.ownerId}
                onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              >
                <option value="">Seleccioná una persona</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Desde
                <input
                  type="date"
                  required
                  value={form.from}
                  onChange={(e) => setForm({ ...form, from: e.target.value })}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  required
                  min={form.from}
                  value={form.to}
                  onChange={(e) => setForm({ ...form, to: e.target.value })}
                />
              </label>
            </div>
            <label>
              Tipo
              <select
                value={form.kind}
                onChange={(e) =>
                  setForm({ ...form, kind: e.target.value as Absence["kind"] })
                }
              >
                <option>Vacaciones</option>
                <option>Licencia</option>
              </select>
            </label>
            <label>
              Quién cubre
              <select
                value={form.replacementId}
                onChange={(e) =>
                  setForm({ ...form, replacementId: e.target.value })
                }
              >
                <option value="">Todavía sin asignar</option>
                {people
                  .filter((p) => p.id !== form.ownerId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Traspaso operativo
              <textarea
                value={form.note}
                maxLength={1000}
                placeholder="Pendientes e instrucciones para la cobertura. No incluir datos médicos."
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </label>
            <div className="note">
              {affected.length} tareas abiertas con fecha en el rango. Los
              vencimientos no se postergan automáticamente.
            </div>
            <div className="modal-actions">
              <button className="primary">Guardar ausencia</button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
