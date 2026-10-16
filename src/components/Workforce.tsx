import { useState } from "react";
import { Panel, Dialog } from "./ui";
import { canSee, dateART, id, isClosed, type State, type Profile } from "../domain/model";
import {
  cancelAbsence,
  registerAbsence,
  recurringCoveragePreview,
  deactivateProfile,
  reassignOrphanedTask,
  transferOrphanedTask,
  updateProfile,
  type Absence,
  presenceStatus,
  canViewPresence,
} from "../domain/workforce";
export function Workforce({
  state,
  commit,
  notify,
  remote=false,
  laboratory=false,
  presence={},
  now=Date.now(),
}: {
  state: State;
  commit: (s: State, action: string, entityId?: string) => boolean;
  notify: (s: string) => void;
  remote?:boolean;
  laboratory?:boolean;
  presence?: Record<string, string>;
  now?: number;
}) {
  const active = state.profiles.find((p) => p.id === state.activeId)!;
  const [editing, setEditing] = useState<Profile | null>(null);
  const [retiring, setRetiring] = useState<Profile | null>(null);
  const [deactivationReason, setDeactivationReason] = useState("");
  const [reassignmentTargets, setReassignmentTargets] = useState<Record<string, string>>({});
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({});
  const [transferReasons, setTransferReasons] = useState<Record<string, string>>({});
  return (
    <Panel
      title="Administración de perfiles"
      sub={`${state.profiles.length} perfiles · las bajas conservan el historial y dejan el trabajo por resolver en una bandeja auditable.`}
      collapsible
      defaultOpen
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Persona</th>
              <th>Rol</th>
              {(laboratory || remote) && <th>Presencia</th>}
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
                {(laboratory || remote) && <td>{canViewPresence(state, active, p.id) ? (() => { const status = presenceStatus(p.id, active.id, laboratory && !remote, presence[p.id], now); return <span className={`lab-presence ${status.online ? "is-online" : "is-offline"}`}><i aria-hidden="true" />{status.label}</span>; })() : <span aria-label="Presencia no disponible">—</span>}</td>}
                <td>
                  {state.profiles.find((x) => x.id === p.managerId)?.name ||
                    "Dirección"}
                </td>
                <td>{p.active ? "Habilitado" : "Suspendido"}</td>
                <td>
                  <button onClick={() => { setEditing({ ...p }); setDeactivationReason(""); }}>
                    Configurar perfil
                  </button>
                  {!remote && p.active && p.id !== active.id && (
                    <button onClick={() => { setRetiring(p); setDeactivationReason(""); }}>
                      Dar de baja
                    </button>
                  )}
                  {!remote && !p.active && p.id !== active.id && (
                    <button onClick={() => {
                      try { commit(updateProfile(state, { ...p, active: true }, active.id), "Rehabilitó acceso", p.id); }
                      catch (error) { notify((error as Error).message); }
                    }}>Rehabilitar acceso</button>
                  )}
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
            {remote&&editing.id!=='admin'&&<label>Correo de acceso<input type="email" value={editing.email||''} maxLength={180} onChange={e=>setEditing({...editing,email:e.target.value.trim().toLowerCase()})}/><small>Debe coincidir con el correo usado para iniciar sesión con ChatGPT.</small></label>}
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
            <div className="note">
              Acceso actual: {editing.active ? "habilitado" : "suspendido"}. Al convertir un empleado en encargado se prepara su propio equipo.
              {remote ? 'El correo debe coincidir con su cuenta de ChatGPT. El acceso al sitio se habilita por separado y requiere aprobación del propietario.' : 'Las invitaciones y el restablecimiento de contraseña se habilitarán al conectar las cuentas reales. En esta demostración no se almacenan contraseñas.'}
            </div>
            <div className="modal-actions">
              <button className="primary">Guardar perfil</button>
            </div>
          </form>
        </Dialog>
      )}
      {retiring && !remote && (
        <Dialog title={`Dar de baja · ${retiring.name}`} onClose={() => setRetiring(null)}>
          <form onSubmit={(e) => {
            e.preventDefault();
            try {
              if (commit(deactivateProfile(state, { ...retiring, active: false }, active.id, deactivationReason),
                "Desactivó perfil y dejó trabajo pendiente de reasignación", retiring.id)) {
                setRetiring(null);
                setDeactivationReason("");
              }
            } catch (error) { notify((error as Error).message); }
          }}>
            <p>El perfil y sus cierres históricos se conservan. Se pausarán sus recurrencias y relojes; el trabajo abierto quedará registrado para reasignación o traspaso.</p>
            <label>Motivo de baja
              <textarea value={deactivationReason} minLength={5} maxLength={500} required
                onChange={(e) => setDeactivationReason(e.target.value)}
                placeholder="Ej.: cambio de puesto, salida del equipo o licencia prolongada" />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setRetiring(null)}>Cancelar</button>
              <button className="primary">Confirmar baja</button>
            </div>
          </form>
        </Dialog>
      )}
      {active.role === "jefe" && !remote && (
        <section className="panel-section" aria-label="Trabajo pendiente de reasignar">
          <h3>Trabajo pendiente de reasignar</h3>
          <p>Las tareas futuras sin actividad pueden reasignarse directamente. Las iniciadas o con actividad requieren un traspaso explícito para conservar su historial.</p>
          {(state.orphanedWork || []).filter((item) => item.status === "pending").length === 0
            ? <p>No hay tareas huérfanas pendientes.</p>
            : (state.orphanedWork || []).filter((item) => item.status === "pending").map((item) => {
              const task = state.tasks.find((row) => row.id === item.taskId);
              const company = state.companies.find((row) => row.id === item.companyId)?.name || item.companyId;
              const candidates = state.profiles.filter((person) => person.active && person.id !== item.formerOwnerId && person.companyIds.includes(item.companyId));
              return (
                <article className="orphaned-work-card" key={item.id}>
                  <strong>{task?.title || item.assignmentSnapshot?.title || "Tarea sin título"}</strong>
                  <span>{item.formerOwnerName} · {company} · {item.assignmentSnapshot ? `${item.assignmentSnapshot.title} (${item.assignmentSnapshot.frequency})` : "Tarea puntual"}</span>
                  <small>Motivo: {item.reason}</small>
                  {item.resolution === "ready" && task ? (
                    <div className="form-grid">
                      <label>Reasignar a
                        <select aria-label={`Reasignar ${task.title}`} value={reassignmentTargets[item.id] || ""}
                          onChange={(e) => setReassignmentTargets({ ...reassignmentTargets, [item.id]: e.target.value })}>
                          <option value="">Elegí una persona activa</option>
                          {candidates.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                        </select>
                      </label>
                      <button disabled={!reassignmentTargets[item.id] || !candidates.some((person) => person.id === reassignmentTargets[item.id])}
                        onClick={() => {
                          try {
                            if (commit(reassignOrphanedTask(state, item.id, reassignmentTargets[item.id]!, active.id), "Reasignó tarea pendiente", item.taskId))
                              setReassignmentTargets((targets) => ({ ...targets, [item.id]: "" }));
                          } catch (error) { notify((error as Error).message); }
                        }}>Confirmar reasignación</button>
                    </div>
                  ) : item.resolution === "handoff_required" && task && !task.responsibility ? (
                    <div className="form-grid">
                      <label>Traspasar con historial a
                        <select aria-label={`Traspasar ${task.title}`} value={transferTargets[item.id] || ""}
                          onChange={(e) => setTransferTargets({ ...transferTargets, [item.id]: e.target.value })}>
                          <option value="">Elegí una persona activa</option>
                          {candidates.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                        </select>
                      </label>
                      <label>Motivo del traspaso
                        <textarea aria-label={`Motivo para ${task.title}`} minLength={5} maxLength={500} required
                          value={transferReasons[item.id] || ""}
                          onChange={(e) => setTransferReasons({ ...transferReasons, [item.id]: e.target.value })}
                          placeholder="Explicá por qué se transfiere el trabajo iniciado" />
                      </label>
                      <button disabled={!transferTargets[item.id] || (transferReasons[item.id] || "").trim().length < 5}
                        onClick={() => {
                          try {
                            if (commit(transferOrphanedTask(state, item.id, transferTargets[item.id]!, active.id, transferReasons[item.id]!), "Traspasó tarea iniciada conservando historial", item.taskId)) {
                              setTransferTargets((targets) => ({ ...targets, [item.id]: "" }));
                              setTransferReasons((reasons) => ({ ...reasons, [item.id]: "" }));
                            }
                          } catch (error) { notify((error as Error).message); }
                        }}>Registrar traspaso</button>
                    </div>
                  ) : <span>{item.resolution === "handoff_required"
                    ? "Responsabilidad conjunta: revisar participaciones y cierres antes de resolver."
                    : "Revisión manual requerida"}</span>}
                </article>
              );
              })}
          {!!state.taskTransfers?.length && <>
            <h3>Historial de traspasos</h3>
            <div className="table-wrap"><table><thead><tr><th>Tarea</th><th>De</th><th>A</th><th>Motivo</th><th>Fecha</th></tr></thead>
              <tbody>{[...state.taskTransfers].reverse().map((transfer) => <tr key={transfer.id}>
                <td>{transfer.taskSnapshot.title} · {state.companies.find((company) => company.id === transfer.companyId)?.name || transfer.companyId}</td>
                <td>{transfer.formerOwnerName}</td><td>{transfer.newOwnerName}</td><td>{transfer.reason}</td>
                <td>{new Date(transfer.transferredAt).toLocaleString("es-AR")}</td>
              </tr>)}</tbody>
            </table></div>
          </>}
        </section>
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
    taskIds: [] as string[],
    assignmentIds: [] as string[],
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
  const recurringPreviews = recurringCoveragePreview(
    state, form.ownerId, form.from, form.to, form.replacementId,
  ).filter((preview) => active.role === "jefe" || active.companyIds.includes(preview.companyId));
  const affected = state.tasks.filter(
    (t) =>
      t.ownerId === form.ownerId &&
      t.status !== "Completada" &&
      !isClosed(state, t) &&
      (active.role === "jefe" || active.companyIds.includes(t.companyId)) &&
      !(t.assignmentId && recurringPreviews.some((preview) => preview.assignmentId === t.assignmentId)) &&
      (!form.replacementId || !!state.profiles.find((profile) => profile.id === form.replacementId)?.companyIds.includes(t.companyId)) &&
      (t.scheduledOn || t.due || "") >= form.from &&
      (t.scheduledOn || t.due || "") <= form.to,
  );
  const allowedTaskIds = new Set(affected.map((task) => task.id));
  const allowedAssignmentIds = new Set(recurringPreviews.map((preview) => preview.assignmentId));
  return (
    <>
      <Panel
        title="Vacaciones, licencias y cobertura"
        sub={`${visible.filter((absence) => !absence.cancelledAt).length} ausencias vigentes o próximas · se conserva el titular y sólo se habilitan las tareas elegidas.`}
        collapsible
        defaultOpen={false}
        action={
          active.role !== "empleado" ? (
            <button className="primary" onClick={() => setAdding(true)}>
              Registrar ausencia
            </button>
          ) : undefined
        }
      >
        <div className="table-wrap" data-tour="absence-coverage">
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
                              cancelAbsence(state, a.id, active.id),
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
                const revokedTasks = form.taskIds.filter((taskId) => !allowedTaskIds.has(taskId));
                const revokedRules = form.assignmentIds.filter((assignmentId) => !allowedAssignmentIds.has(assignmentId));
                if (revokedTasks.length || revokedRules.length) {
                  setForm({
                    ...form,
                    taskIds: form.taskIds.filter((taskId) => allowedTaskIds.has(taskId)),
                    assignmentIds: form.assignmentIds.filter((assignmentId) => allowedAssignmentIds.has(assignmentId)),
                  });
                  notify("Cambió el alcance de la cobertura. Quité tareas y reglas que ya no están autorizadas; revisá la selección antes de guardar.");
                  return;
                }
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
                onChange={(e) => setForm({ ...form, ownerId: e.target.value, taskIds: [], assignmentIds: [] })}
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
                  onChange={(e) => setForm({ ...form, from: e.target.value, taskIds: [], assignmentIds: [] })}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  required
                  min={form.from}
                  value={form.to}
                  onChange={(e) => setForm({ ...form, to: e.target.value, taskIds: [], assignmentIds: [] })}
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
            {form.replacementId && (
              <fieldset className="coverage-task-selection">
                <legend>Tareas que puede cubrir</legend>
                {affected.length ? affected.map((task) => (
                  <label key={task.id}>
                    <input
                      type="checkbox"
                      checked={form.taskIds.includes(task.id)}
                      onChange={(e) => setForm({
                        ...form,
                        taskIds: e.target.checked
                          ? [...form.taskIds, task.id]
                          : form.taskIds.filter((id) => id !== task.id),
                      })}
                    />
                    {task.title} · {state.companies.find((company) => company.id === task.companyId)?.name || "Empresa"}
                  </label>
                )) : <p>No hay tareas abiertas puntuales dentro del rango.</p>}
                <small>Las sesiones quedan atribuidas al reemplazante. Las reglas recurrentes se seleccionan por separado y abarcan sólo las fechas previstas dentro del rango.</small>
              </fieldset>
            )}
            {form.replacementId && recurringPreviews.length > 0 && (
              <fieldset className="coverage-task-selection">
                <legend>Reglas recurrentes incluidas en el rango</legend>
                {recurringPreviews.map((preview) => (
                  <label key={preview.assignmentId}>
                    <input
                      type="checkbox"
                      checked={form.assignmentIds.includes(preview.assignmentId)}
                      onChange={(e) => setForm({
                        ...form,
                        assignmentIds: e.target.checked
                          ? [...form.assignmentIds, preview.assignmentId]
                          : form.assignmentIds.filter((id) => id !== preview.assignmentId),
                      })}
                    />
                    {preview.title} · {state.companies.find((company) => company.id === preview.companyId)?.name || "Empresa"} · {preview.dates.length} ocurrencias ({preview.dates.join(", ")})
                  </label>
                ))}
              </fieldset>
            )}
            <div className="note">
              {form.taskIds.length} tareas puntuales y {form.assignmentIds.length} reglas recurrentes seleccionadas. Los
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
