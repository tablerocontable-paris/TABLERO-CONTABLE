import { useState } from "react";
import { activateJointTask } from "../domain/coordination";
import { canSee, isClosed, responsibleMembers, type Profile, type State, type Task } from "../domain/model";
import { Panel } from "./ui";

export default function JointTaskSetup({ state, task, actor, commit, notify, laboratory = false }: {
  state: State; task: Task; actor: Profile; commit: (next: State, action?: string, entityId?: string) => boolean; notify: (message: string) => void; laboratory?: boolean;
}) {
  const [secondId, setSecondId] = useState("");
  const [share, setShare] = useState("50");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  if (task.responsibility) return <Panel title="Responsabilidad conjunta" sub={task.responsibility.reason} collapsible defaultOpen>
    <div className="joint-members">{responsibleMembers(task).map((member) => <div key={member.profileId}>
      <b>{member.name}</b><span>{(member.shareBps / 100).toFixed(2).replace(/\.00$/, "")}% de responsabilidad</span>
    </div>)}</div>
  </Panel>;
  if (laboratory && task.kind === "operativa") return <Panel title="Responsabilidad conjunta" sub="Las operativas nuevas conservan una persona responsable. Las coberturas registran quién realizó cada movimiento." collapsible defaultOpen><p>Las operativas conjuntas existentes mantienen su historial y se revisan antes del cierre.</p></Panel>;
  if (actor.role === "empleado" || task.status !== "Pendiente" || isClosed(state, task) ||
      (actor.role !== "jefe" && !actor.companyIds.includes(task.companyId)) || !canSee(actor, task.ownerId, state.profiles)) return null;
  const anchor = state.profiles.find((p) => p.id === task.ownerId);
  if (!anchor) return null;
  const choices = state.profiles.filter((p) => p.active && p.id !== anchor.id &&
    (p.role === "empleado" || p.role === "encargado") && p.companyIds.includes(task.companyId) &&
    (actor.role === "jefe" || (p.managerId === actor.id && p.teamId === anchor.teamId)));
  return <Panel title="Responsabilidad conjunta" sub="Una misma ocurrencia, con aportes y tiempos propios." collapsible defaultOpen>
    {!open ? <button type="button" onClick={() => setOpen(true)}>Compartir tarea</button> :
      <form className="joint-setup" onSubmit={(event) => {
        event.preventDefault();
        try {
          const numericShare = Number(share);
          if (!Number.isFinite(numericShare) || Math.abs(Math.round(numericShare * 100) - numericShare * 100) > 1e-8) throw Error("El porcentaje admite hasta dos decimales.");
          const next = activateJointTask(state, {
            taskId: task.id, secondProfileId: secondId,
            anchorShareBps: Math.round(numericShare * 100), reason,
            expectedRevision: 0, requestId: crypto.randomUUID(),
          }, actor.id);
          if (commit(next)) notify("La tarea quedó compartida y se notificó a las personas autorizadas.");
        } catch (error) { notify((error as Error).message); }
      }}>
        <label>Segundo responsable<select required value={secondId} onChange={(event) => setSecondId(event.target.value)}>
          <option value="">Seleccionar persona</option>{choices.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.position}</option>)}
        </select></label>
        <label>Participación de {anchor.name} (%)<input required type="number" min="0.01" max="99.99" step="0.01" value={share} onChange={(event) => setShare(event.target.value)} /></label>
        <label>Motivo de la colaboración<textarea required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        {!choices.length && <p>No hay otra persona activa con acceso a esta empresa dentro de tu ámbito.</p>}
        <div className="modal-actions"><button type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary" disabled={!choices.length || !secondId || !reason.trim()}>Confirmar responsabilidad</button></div>
      </form>}
  </Panel>;
}
