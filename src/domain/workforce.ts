import { validDate } from "./schedule";
import {
  id,
  dateART,
  canSee,
  canAccessJointTask,
  isClosed,
  type State,
  type Profile,
  type Task,
} from "./model";
export interface Absence {
  id: string;
  ownerId: string;
  replacementId: string;
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
      t.month >= a.from.slice(0, 7) &&
      t.month <= a.to.slice(0, 7),
  );
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
    !p ||
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
      owner.companyIds.some((c) => !replacement.companyIds.includes(c)))
  )
    throw Error(
      "El reemplazante debe pertenecer a tu ámbito y tener acceso a las empresas del titular.",
    );
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
  if (!t || !canWork(s, p, t) || isClosed(s, t))
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
