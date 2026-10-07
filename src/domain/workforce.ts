import { defaultSchedule, occurrences, validDate } from "./schedule";
import {
  id,
  dateART,
  canSee,
  canAccessJointTask,
  isClosed,
  type State,
  type Profile,
  type Task,
  type OrphanedWork,
  type TaskTransfer,
} from "./model";
export interface Absence {
  id: string;
  ownerId: string;
  replacementId: string;
  taskIds?: string[];
  assignmentIds?: string[];
  from: string;
  to: string;
  kind: "Vacaciones" | "Licencia";
  note: string;
  createdBy: string;
  cancelledAt?: string;
}
export interface TimeSession {
  id: string;
  actorId: string;
  start: string;
  end: string | null;
}
export const elapsedSeconds = (t: Task, at = new Date().toISOString()) =>
  (t.sessions || []).reduce(
    (n, s) =>
      n + Math.max(0, (Date.parse(s.end || at) - Date.parse(s.start)) / 1000),
    0,
  );
export const actorElapsedSeconds = (t: Task, actorId: string, at = new Date().toISOString()) =>
  (t.sessions || []).filter((s) => s.actorId === actorId).reduce(
    (n, s) => n + Math.max(0, (Date.parse(s.end || at) - Date.parse(s.start)) / 1000), 0,
  );
export const duration = (secs: number) => {
  const s = Math.floor(secs);
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
export function stopClock(t: Task, at = new Date().toISOString()): Task {
  return {
    ...t,
    sessions: (t.sessions || []).map((s) => (s.end ? s : { ...s, end: at })),
  };
}
export function stopActorClock(t: Task, actorId: string, at = new Date().toISOString()): Task {
  return { ...t, sessions: (t.sessions || []).map((s) => !s.end && s.actorId === actorId ? { ...s, end: at } : s) };
}
export const stopAllTaskClocks = stopClock;
export function startClock(
  t: Task,
  actorId: string,
  at = new Date().toISOString(),
): Task {
  if (t.blockedBy || t.status === "Completada")
    throw Error("Liberá la espera o reabrí la tarea antes de cronometrar.");
  if ((t.sessions || []).some((s) => !s.end && s.actorId === actorId)) return t;
  return {
    ...t,
    status: "En curso",
    startedAt: t.startedAt || at,
    sessions: [
      ...(t.sessions || []),
      { id: id(), actorId, start: at, end: null },
    ],
  };
}
export function coverageFor(s: State, t: Task, at = dateART()) {
  return (s.absences || []).find(
    (a) =>
      !a.cancelledAt &&
      a.ownerId === t.ownerId &&
      a.from <= at &&
      a.to >= at &&
      !!a.replacementId &&
      isCoveredOccurrence(a, t) &&
      !isClosed(s, t),
  );
}
function isCoveredOccurrence(absence: Absence, task: Task) {
  const occursOn = task.scheduledOn || task.due;
  return !!occursOn && absence.from <= occursOn && occursOn <= absence.to && (
    (absence.taskIds || []).includes(task.id) ||
    (!!task.assignmentId && (absence.assignmentIds || []).includes(task.assignmentId))
  );
}
function nextMonth(month: string) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 7);
}
export interface RecurringCoveragePreview {
  assignmentId: string;
  title: string;
  companyId: string;
  dates: string[];
}
export function recurringCoveragePreview(
  s: State, ownerId: string, from: string, to: string, replacementId: string,
): RecurringCoveragePreview[] {
  if (!validDate(from) || !validDate(to) || to < from) return [];
  const replacement = s.profiles.find((profile) => profile.id === replacementId);
  if (!replacement?.active) return [];
  return s.assignments.flatMap((assignment) => {
    if (assignment.ownerId !== ownerId || assignment.retired || assignment.frequency === "única" ||
      !replacement.companyIds.includes(assignment.companyId)) return [];
    const schedule = assignment.schedule || {
      ...defaultSchedule(assignment.startMonth + "-01", assignment.frequency),
      monthDay: assignment.day,
    };
    if (schedule.frequency === "única") return [];
    const dates: string[] = [];
    for (let month = from.slice(0, 7); month <= to.slice(0, 7); month = nextMonth(month)) {
      if (s.closures.some((closure) => closure.ownerId === ownerId && closure.month === month)) continue;
      try {
        dates.push(...occurrences(schedule, month)
          .map((occurrence) => occurrence.date)
          .filter((date) => from <= date && date <= to)
          .filter((date) => !s.tasks.some((task) => task.assignmentId === assignment.id &&
            task.scheduledOn === date && task.status === "Completada")));
      } catch {
        return [];
      }
    }
    return dates.length ? [{ assignmentId: assignment.id, title: assignment.title, companyId: assignment.companyId, dates }] : [];
  });
}
export function cancelAbsence(s: State, absenceId: string, actorId: string, at = new Date().toISOString()): State {
  const actor = s.profiles.find((p) => p.id === actorId);
  const absence = s.absences?.find((item) => item.id === absenceId && !item.cancelledAt);
  if (!actor?.active || actor.role === "empleado" || !absence || !canSee(actor, absence.ownerId, s.profiles))
    throw Error("Sólo un responsable autorizado puede cancelar esta cobertura.");
  return {
    ...s,
    absences: s.absences!.map((item) => item.id === absenceId ? { ...item, cancelledAt: at } : item),
    tasks: s.tasks.map((task) => task.ownerId === absence.ownerId && isCoveredOccurrence(absence, task)
      ? stopActorClock(task, absence.replacementId, at) : task),
  };
}
export function expireCoverageClocks(s: State, at = dateART()): State {
  const expired = (s.absences || []).filter((absence) => !absence.cancelledAt && absence.replacementId && absence.to < at);
  if (!expired.length) return s;
  let changed = false;
  const tasks = s.tasks.map((task) => {
    let next = task;
    for (const absence of expired) {
      if (absence.ownerId !== task.ownerId || !isCoveredOccurrence(absence, task)) continue;
      const cutoff = new Date(`${absence.to}T23:59:59.999-03:00`).toISOString();
      next = { ...next, sessions: (next.sessions || []).map((session) => {
        if (session.end || session.actorId !== absence.replacementId) return session;
        changed = true;
        return { ...session, end: Date.parse(session.start) > Date.parse(cutoff) ? session.start : cutoff };
      }) };
    }
    return next;
  });
  return changed ? { ...s, tasks } : s;
}
export function canWork(s: State, p: Profile, t: Task, at = dateART()) {
  if (!p.active || (p.role !== "jefe" && !p.companyIds.includes(t.companyId)))
    return false;
  if (canAccessJointTask(s, p, t)) return true;
  return (
    coverageFor(s, t, at)?.replacementId === p.id &&
    p.companyIds.includes(t.companyId)
  );
}
export function registerAbsence(s: State, a: Absence, actorId: string): State {
  const p = s.profiles.find((p) => p.id === actorId);
  const owner = s.profiles.find((p) => p.id === a.ownerId);
  const replacement = s.profiles.find((p) => p.id === a.replacementId);
  if (
    !p || !p.active ||
    p.role === "empleado" ||
    !canSee(p, a.ownerId, s.profiles) ||
    !owner?.active
  )
    throw Error(
      "Sólo un responsable de ese empleado puede registrar la ausencia.",
    );
  if (!validDate(a.from) || !validDate(a.to) || a.to < a.from)
    throw Error("Revisá el rango de la ausencia.");
  if (
    a.replacementId &&
    (!replacement?.active ||
      replacement.id === a.ownerId ||
      !canSee(p, replacement.id, s.profiles) ||
      !(a.taskIds?.length || a.assignmentIds?.length))
  )
    throw Error(
      "Elegí una tarea o regla recurrente y un reemplazante activo de tu ámbito.",
    );
  if (p.role === "encargado" &&
    (owner.managerId !== p.id || replacement?.managerId !== p.id))
    throw Error("Un encargado sólo puede aprobar coberturas dentro de su equipo.");
  const selected = new Set(a.taskIds || []);
  const selectedRules = new Set(a.assignmentIds || []);
  if (selectedRules.size !== (a.assignmentIds || []).length)
    throw Error("No repitas reglas recurrentes en la cobertura.");
  if (selected.size !== (a.taskIds || []).length)
    throw Error("No repitas tareas en la cobertura.");
  const selectedTasks = s.tasks.filter((t) => selected.has(t.id));
  if (selectedTasks.length !== selected.size || selectedTasks.some((t) =>
    t.ownerId !== owner.id || t.status === "Completada" ||
    (t.scheduledOn || t.due || "") < a.from || (t.scheduledOn || t.due || "") > a.to ||
    !owner.companyIds.includes(t.companyId) ||
    (!!replacement && !replacement.companyIds.includes(t.companyId)) ||
    isClosed(s, t)))
    throw Error("La cobertura sólo puede incluir tareas abiertas del titular, dentro del rango y en empresas autorizadas.");
  const previewableRules = new Set(recurringCoveragePreview(s, owner.id, a.from, a.to, replacement?.id || "")
    .filter((preview) => owner.companyIds.includes(preview.companyId))
    .map((preview) => preview.assignmentId));
  const validRules = new Set(s.assignments.filter((assignment) => selectedRules.has(assignment.id) &&
    assignment.ownerId === owner.id && !assignment.retired && assignment.frequency !== "única" &&
    previewableRules.has(assignment.id)).map((assignment) => assignment.id));
  if (validRules.size !== selectedRules.size)
    throw Error("Elegí reglas recurrentes activas del titular con ocurrencias abiertas dentro del rango.");
  if (!a.replacementId && (selected.size || selectedRules.size))
    throw Error("Asigná un reemplazante antes de autorizar tareas de cobertura.");
  if (
    (s.absences || []).some(
      (x) =>
        !x.cancelledAt &&
        x.ownerId === a.ownerId &&
        x.from <= a.to &&
        x.to >= a.from,
    )
  )
    throw Error("Ya existe una ausencia en ese rango.");
  return { ...s, absences: [...(s.absences || []), a] };
}
export function deactivateProfile(
  s: State,
  profile: Profile,
  actorId: string,
  reason: string,
  at = new Date().toISOString(),
): State {
  const actor = s.profiles.find((item) => item.id === actorId && item.active);
  const current = s.profiles.find((item) => item.id === profile.id);
  const note = reason.trim();
  if (actor?.role !== "jefe") throw Error("Sólo Juan Pablo / jefatura administra las bajas.");
  if (!current?.active || current.id === actor.id) throw Error("Elegí a otra persona con acceso activo.");
  if (note.length < 5 || note.length > 500) throw Error("Indicá un motivo de baja de entre 5 y 500 caracteres.");
  if (s.profiles.some((item) => item.active && item.managerId === current.id))
    throw Error("Reasigná primero las personas a cargo.");

  const configured = updateProfile(s, { ...profile, active: true }, actorId);
  const futureDate = dateART(at);
  const work: OrphanedWork[] = (configured.tasks || [])
    .filter((task) => task.ownerId === current.id && task.status !== "Completada" && !isClosed(configured, task))
    .map((task) => {
      const assignment = configured.assignments.find((item) => item.id === task.assignmentId);
      const hasSessions = (task.sessions || []).length > 0;
      const hasActivity = configured.activity.some((entry) => entry.taskId === task.id);
      const hasComments = (configured.taskComments || []).some((comment) => comment.taskId === task.id);
      const hasStarted = task.status === "En curso" || !!task.startedAt || task.checklist.some((check) => check.done);
      const scheduledDate = task.scheduledOn || task.due;
      const ready = task.status === "Pendiente" && !hasStarted && !hasSessions && !hasActivity && !hasComments &&
        !task.responsibility && !!scheduledDate && scheduledDate > futureDate;
      return {
        id: id(), taskId: task.id, formerOwnerId: current.id,
        formerOwnerName: configured.profiles.find((item) => item.id === current.id)?.name || current.name,
        companyId: task.companyId,
        assignmentSnapshot: assignment ? {
          id: assignment.id, title: assignment.title, templateId: assignment.templateId,
          frequency: assignment.frequency, ...(assignment.schedule ? { schedule: assignment.schedule } : {}),
        } : null,
        reason: note, createdAt: at,
        resolution: ready ? "ready" as const : hasStarted || hasSessions || hasActivity || hasComments || task.responsibility
          ? "handoff_required" as const : "review_required" as const,
        status: "pending" as const,
      };
    });
  const cancelledAbsences = (configured.absences || []).filter((absence) =>
    absence.ownerId === current.id && !absence.cancelledAt,
  );
  const retired = {
    ...configured,
    profiles: configured.profiles.map((item) => item.id === current.id ? { ...item, active: false } : item),
    assignments: configured.assignments.map((item) => item.ownerId === current.id ? { ...item, retired: true } : item),
    tasks: configured.tasks.map((task) => {
      let next = task.ownerId === current.id ? stopActorClock(task, current.id, at) : task;
      for (const absence of cancelledAbsences) {
        if (isCoveredOccurrence(absence, task)) next = stopActorClock(next, absence.replacementId, at);
      }
      return next;
    }),
    absences: (configured.absences || []).map((absence) =>
      cancelledAbsences.some((item) => item.id === absence.id) ? { ...absence, cancelledAt: at } : absence,
    ),
    orphanedWork: [...(configured.orphanedWork || []), ...work],
  };
  return retired;
}

export function reassignOrphanedTask(
  s: State,
  orphanedId: string,
  replacementId: string,
  actorId: string,
  at = new Date().toISOString(),
): State {
  const actor = s.profiles.find((item) => item.id === actorId && item.active);
  const item = (s.orphanedWork || []).find((row) => row.id === orphanedId && row.status === "pending");
  const task = item && s.tasks.find((row) => row.id === item.taskId);
  const replacement = s.profiles.find((row) => row.id === replacementId && row.active);
  if (actor?.role !== "jefe") throw Error("Sólo jefatura puede reasignar trabajo pendiente.");
  if (!item || item.resolution !== "ready" || !task || !replacement)
    throw Error("Este trabajo requiere una revisión o un traspaso explícito antes de reasignarlo.");
  const scheduledDate = task.scheduledOn || task.due;
  if (task.status !== "Pendiente" || (task.sessions || []).length ||
      s.activity.some((entry) => entry.taskId === task.id) || isClosed(s, task) ||
      !scheduledDate || scheduledDate <= dateART(at))
    throw Error("La tarea dejó de cumplir las condiciones para una reasignación directa.");
  if (replacement.id === item.formerOwnerId || !replacement.companyIds.includes(item.companyId))
    throw Error("Elegí una persona activa autorizada para la empresa de la tarea.");
  return {
    ...s,
    tasks: s.tasks.map((row) => row.id === task.id ? { ...row, ownerId: replacement.id, teamId: replacement.teamId } : row),
    orphanedWork: (s.orphanedWork || []).map((row) => row.id === item.id
      ? { ...row, status: "reassigned", assignedTo: replacement.id, resolvedBy: actor.id, resolvedAt: at }
      : row),
  };
}

export function transferOrphanedTask(
  s: State,
  orphanedId: string,
  replacementId: string,
  actorId: string,
  reason: string,
  at = new Date().toISOString(),
): State {
  const actor = s.profiles.find((item) => item.id === actorId && item.active);
  const item = (s.orphanedWork || []).find((row) => row.id === orphanedId && row.status === "pending");
  const task = item && s.tasks.find((row) => row.id === item.taskId);
  const replacement = s.profiles.find((row) => row.id === replacementId && row.active);
  const note = reason.trim();
  if (actor?.role !== "jefe") throw Error("Sólo jefatura puede autorizar el traspaso.");
  if (!item || item.resolution !== "handoff_required" || !task || !replacement)
    throw Error("La tarea ya no está pendiente de un traspaso explícito.");
  if (task.responsibility)
    throw Error("La tarea conjunta requiere revisar primero sus participaciones y cierres.");
  if (!canSee(actor, item.formerOwnerId, s.profiles))
    throw Error("No tenés alcance para resolver el trabajo de esta persona.");
  if (item.formerOwnerId !== task.ownerId || task.status === "Completada" || isClosed(s, task))
    throw Error("La tarea cambió o su período ya está cerrado; no se puede traspasar.");
  if (s.closures.some((closure) => closure.ownerId === replacement.id && closure.month === task.month))
    throw Error("El período de la persona receptora ya está cerrado.");
  if ((task.sessions || []).some((session) => !session.end))
    throw Error("Pausá todos los cronómetros antes de confirmar el traspaso.");
  if (replacement.id === item.formerOwnerId || !replacement.companyIds.includes(item.companyId))
    throw Error("Elegí una persona activa autorizada para la empresa de la tarea.");
  if (note.length < 5 || note.length > 500)
    throw Error("Indicá el motivo del traspaso (entre 5 y 500 caracteres).");
  const former = s.profiles.find((profile) => profile.id === item.formerOwnerId);
  const record: TaskTransfer = {
    id: id(), taskId: task.id, formerOwnerId: item.formerOwnerId,
    formerOwnerName: former?.name || item.formerOwnerName,
    newOwnerId: replacement.id, newOwnerName: replacement.name,
    companyId: task.companyId, reason: note, transferredAt: at, transferredBy: actor.id,
    taskSnapshot: structuredClone(task),
    sessions: structuredClone(task.sessions || []),
    activity: structuredClone(s.activity.filter((entry) => entry.taskId === task.id)),
    comments: structuredClone((s.taskComments || []).filter((comment) => comment.taskId === task.id)),
  };
  return {
    ...s,
    tasks: s.tasks.map((row) => row.id === task.id
      ? { ...row, ownerId: replacement.id, teamId: replacement.teamId }
      : row),
    taskTransfers: [...(s.taskTransfers || []), record],
    orphanedWork: (s.orphanedWork || []).map((row) => row.id === item.id
      ? { ...row, status: "transferred", assignedTo: replacement.id, resolvedBy: actor.id, resolvedAt: at }
      : row),
  };
}

export function updateProfile(s: State, p: Profile, actorId: string): State {
  if (s.profiles.find((x) => x.id === actorId)?.role !== "jefe")
    throw Error("Sólo Juan Pablo / jefatura administra los perfiles.");
  if (!p.name.trim() || !p.companyIds.length)
    throw Error("Completá nombre y empresas.");
  const manager = s.profiles.find((x) => x.id === p.managerId);
  if (
    p.role === "empleado" &&
    (!manager?.active || manager.role !== "encargado")
  )
    throw Error("Un empleado debe depender de un encargado activo.");
  if (p.role === "encargado" && (!manager?.active || manager.role !== "jefe"))
    throw Error("Un encargado debe depender de un jefe activo.");
  if (p.role === "jefe" && p.managerId)
    throw Error("Jefatura no tiene un encargado.");
  let teams = [...s.teams];
  if (p.role === "encargado") {
    let team = teams.find((t) => t.managerId === p.id);
    if (!team) {
      team = { id: id(), name: `Equipo de ${p.name}`, managerId: p.id };
      teams.push(team);
    }
    p = { ...p, teamId: team.id };
  } else if (
    p.role === "empleado" &&
    !teams.some((t) => t.id === p.teamId && t.managerId === p.managerId)
  )
    throw Error("El equipo y el responsable no coinciden.");
  if (p.id === actorId && !p.active)
    throw Error("No podés desactivar tu propio acceso.");
  if (s.profiles.some((x) => x.id === p.id && x.active) && !p.active)
    throw Error("Usá el flujo de baja para pausar tareas y guardar la reasignación pendiente.");
  if (
    (!p.active || p.role !== s.profiles.find((x) => x.id === p.id)?.role) &&
    s.profiles.some((x) => x.active && x.managerId === p.id)
  )
    throw Error("Reasigná primero las personas a cargo.");
  return {
    ...s,
    teams,
    profiles: s.profiles.map((x) => (x.id === p.id ? p : x)),
  };
}
export function applyClock(
  s: State,
  taskId: string,
  actorId: string,
  running: boolean,
  at = new Date().toISOString(),
): State {
  const p = s.profiles.find((p) => p.id === actorId)!;
  const t = s.tasks.find((t) => t.id === taskId)!;
  if (!t || !canWork(s, p, t, dateART(at)) || isClosed(s, t))
    throw Error("Tarea fuera de tu ámbito o mes cerrado.");
  return {
    ...s,
    tasks: s.tasks.map((x) =>
      x.id === taskId
        ? running
          ? startClock(x, actorId, at)
          : stopActorClock(x, actorId, at)
        : running && x.sessions?.some((e) => !e.end && e.actorId === actorId)
          ? stopActorClock(x, actorId, at)
          : x,
    ),
  };
}
