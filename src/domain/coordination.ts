import { canSee, id, isClosed, isCompanyClosed, type JointMemberSnapshot, type State, type Task } from "./model";

export interface ActivateJointTaskInput {
  taskId: string;
  secondProfileId: string;
  anchorShareBps: number;
  reason: string;
  expectedRevision: number;
  requestId: string;
}

export function activateJointTask(
  state: State,
  input: ActivateJointTaskInput,
  actorId: string,
  at = new Date().toISOString(),
): State {
  const task = state.tasks.find((row) => row.id === input.taskId);
  const actor = state.profiles.find((row) => row.id === actorId);
  if (!task || !actor?.active || actor.id === "admin" || (actor.role !== "jefe" && actor.role !== "encargado"))
    throw Error("Sólo jefatura o un encargado autorizado puede compartir una tarea.");
  if (!input.requestId.trim() || input.requestId.length > 120)
    throw Error("La solicitud de activación no es válida.");
  const canonical = JSON.stringify({ ...input, taskId: task.id });
  const prior = (state.jointReceipts || []).find((receipt) => receipt.requestId === input.requestId);
  if (prior) {
    if (prior.actorId !== actorId || prior.body !== canonical)
      throw Error("La clave de solicitud ya se usó con otros datos.");
    return state;
  }
  if (input.expectedRevision !== 0 || task.responsibility)
    throw Error("La tarea cambió desde que abriste la configuración.");
  if (!state.companies.some((company) => company.id === task.companyId) ||
      (actor.role !== "jefe" && !actor.companyIds.includes(task.companyId)) || !canSee(actor, task.ownerId, state.profiles))
    throw Error("La tarea está fuera de tu ámbito.");
  if (isClosed(state, task)) throw Error("El período ya está cerrado para uno de los responsables.");
  if (task.status !== "Pendiente" || task.startedAt || task.completedAt || task.blockedBy || task.checklist.some((check) => check.done))
    throw Error("Sólo se puede compartir una tarea pendiente, sin iniciar ni bloquear.");
  if ((task.sessions || []).length || state.activity.some((row) => row.taskId === task.id) ||
      (state.taskComments || []).some((row) => row.taskId === task.id))
    throw Error("La tarea ya tiene actividad y no puede cambiar de responsabilidad.");
  const assignment = state.assignments.find((row) => row.id === task.assignmentId);
  if (assignment && (assignment.frequency !== "única" || (assignment.schedule && assignment.schedule.frequency !== "única")))
    throw Error("Las tareas recurrentes no se pueden compartir en esta versión.");
  if (task.assignmentId && state.tasks.some((row) => row.id !== task.id && row.assignmentId === task.assignmentId))
    throw Error("La asignación tiene más de una ocurrencia vinculada.");
  if (!task.assignmentId && task.templateId && state.assignments.some((row) => row.templateId === task.templateId && row.frequency !== "única"))
    throw Error("El catálogo vinculado a esta tarea tiene recurrencia activa.");
  if (!Number.isInteger(input.anchorShareBps) || input.anchorShareBps <= 0 || input.anchorShareBps >= 10000)
    throw Error("El reparto debe ser positivo y sumar 100% entre ambos responsables.");
  const second = state.profiles.find((row) => row.id === input.secondProfileId);
  const anchor = state.profiles.find((row) => row.id === task.ownerId);
  if (!anchor?.active || !second?.active || second.id === anchor.id ||
      !["empleado", "encargado"].includes(anchor.role) || !["empleado", "encargado"].includes(second.role))
    throw Error("Elegí dos responsables operativos distintos y activos.");
  if (isCompanyClosed(state, second.id, task.companyId, task.month))
    throw Error("El período del segundo responsable ya está cerrado.");
  if (!anchor.companyIds.includes(task.companyId) || !second.companyIds.includes(task.companyId))
    throw Error("Ambos responsables deben tener acceso a la empresa de la tarea.");
  if (actor.role === "encargado" &&
      (anchor.managerId !== actor.id || second.managerId !== actor.id || anchor.teamId !== second.teamId))
    throw Error("Un encargado sólo puede compartir entre dos personas directas de su equipo.");
  if (!input.reason.trim() || input.reason.trim().length > 500)
    throw Error("Indicá un motivo de hasta 500 caracteres.");
  const member = (profile: typeof anchor, shareBps: number): JointMemberSnapshot => ({
    profileId: profile!.id, shareBps, name: profile!.name, teamId: profile!.teamId, sector: profile!.sector,
  });
  const members: [JointMemberSnapshot, JointMemberSnapshot] = [
    member(anchor, input.anchorShareBps), member(second, 10000 - input.anchorShareBps),
  ];
  if (members.reduce((total, row) => total + row.shareBps, 0) !== 10000)
    throw Error("El reparto de responsabilidad debe sumar 100%.");
  const nextTask: Task = { ...task, responsibility: {
    version: 1, revision: 1, mode: "joint", activatedAt: at, activatedBy: actorId,
    reason: input.reason.trim(), members,
  } };
  return {
    ...state,
    tasks: state.tasks.map((row) => row.id === task.id ? nextTask : row),
    jointReceipts: [...(state.jointReceipts || []), {
      requestId: input.requestId, actorId, taskId: task.id, body: canonical,
      revision: 1, acknowledgedAt: at,
    }],
    audit: [...state.audit, { id: id(), at, actorId, action: "Activó tarea conjunta", entityId: task.id }],
  };
}
