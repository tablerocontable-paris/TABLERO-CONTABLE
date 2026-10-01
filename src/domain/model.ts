import {
  occurrences,
  defaultSchedule,
  type Schedule,
  type Frequency,
} from "./schedule";
import { stopClock, type TimeSession, type Absence } from "./workforce";
import { generatePeriodReport, type PeriodReport } from "./reports";
export type Role = "jefe" | "encargado" | "empleado";
export type Status = "Pendiente" | "En curso" | "Completada";
export type Kind = "resultado" | "operativa";
export interface Profile {
  id: string;
  name: string;
  role: Role;
  managerId: string | null;
  teamId: string;
  sector: string;
  branch: string;
  position: string;
  companyIds: string[];
  active: boolean;
}
export interface Company {
  id: string;
  name: string;
}
export interface Team {
  id: string;
  name: string;
  managerId: string;
}
export interface Check {
  id: string;
  text: string;
  done: boolean;
}
export interface Template {
  id: string;
  title: string;
  sector: string;
  kind: Kind;
  weight: number;
  unit: string;
  target: number;
  steps: string[];
  description: string;
}
export interface Assignment {
  retired?: boolean;
  id: string;
  templateId: string | null;
  title: string;
  ownerId: string;
  companyId: string;
  sector: string;
  kind: Kind;
  weight: number;
  unit: string;
  target: number;
  day: number;
  frequency: Frequency;
  schedule?: Schedule;
  steps: string[];
  startMonth: string;
  priority: "Alta" | "Media" | "Baja";
}
export interface Task {
  templateId?: string | null;
  scheduledOn?: string;
  sessions?: TimeSession[];
  reopenCount?: number;
  id: string;
  assignmentId: string | null;
  title: string;
  ownerId: string;
  companyId: string;
  teamId: string;
  sector: string;
  month: string;
  due: string;
  kind: Kind;
  weight: number;
  unit: string;
  target: number;
  status: Status;
  checklist: Check[];
  completedAt: string | null;
  startedAt: string | null;
  priority: "Alta" | "Media" | "Baja";
  blockedBy: string;
  blockedSince: string | null;
}
export interface Activity {
  id: string;
  taskId: string;
  date: string;
  qty: number;
  note: string;
  createdAt: string;
  actorId: string;
}
export interface Audit {
  id: string;
  at: string;
  actorId: string;
  action: string;
  entityId: string;
}
export interface Metrics {
  assigned: number;
  done: number;
  points: number;
  earned: number;
  weighted: number | null;
  onTime: number | null;
  late: number;
  blocked: number;
  operational: number;
  operationalTarget: number;
}
export interface Closure {
  report?: PeriodReport;
  id: string;
  ownerId: string;
  month: string;
  at: string;
  by: string;
  metrics: Metrics;
  tasks: Task[];
  activity: Activity[];
  note: string;
}
export interface Onboarding {
  assignmentCompanyIds?: Record<string, string[]>;
  schedules?: Record<string, Schedule>;
  customTasks?: {
    id: string;
    title: string;
    steps: string;
    kind: Kind;
    unit: string;
    target: number;
  }[];
  version: number;
  step: number;
  completedAt: string | null;
  selectedCompanyIds: string[];
  selectedTemplateIds: string[];
  day: number;
  frequency: Frequency;
  schedule?: Schedule;
  home: "day" | "tasks";
  reminders: boolean;
  name: string;
  customTitle: string;
  customSteps: string;
  customKind: Kind;
}
export interface State {
  version: 3;
  absences?: Absence[];
  companies: Company[];
  teams: Team[];
  profiles: Profile[];
  templates: Template[];
  assignments: Assignment[];
  tasks: Task[];
  activity: Activity[];
  audit: Audit[];
  closures: Closure[];
  onboarding: Record<string, Onboarding>;
  activeId: string;
  tour: Record<string, number>;
}
export const id = () => crypto.randomUUID();
export const dateART = (iso = new Date().toISOString()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
export const currentMonth = () => dateART().slice(0, 7);
export function dueDate(month: string, day: number) {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(Math.min(day, new Date(y, m, 0).getDate())).padStart(2, "0")}`;
}
export function canSee(
  profile: Profile,
  ownerId: string,
  profiles: Profile[],
): boolean {
  if (profile.role === "jefe") return true;
  if (profile.id === ownerId) return true;
  return (
    profile.role === "encargado" &&
    profiles.some((p) => p.id === ownerId && p.managerId === profile.id)
  );
}
export function isClosed(s: State, t: Pick<Task, "ownerId" | "month">) {
  return s.closures.some((c) => c.ownerId === t.ownerId && c.month === t.month);
}
export function transition(
  t: Task,
  next: Status,
  at = new Date().toISOString(),
): Task {
  if (next === "Completada") {
    if (t.kind === "operativa")
      throw Error(
        "Las operativas se miden con registros y se consolidan al cierre mensual.",
      );
    if (t.status === "Pendiente") throw Error("Primero iniciá la tarea.");
    if (t.blockedBy) throw Error("Liberá la espera antes de completar.");
    if (t.checklist.some((c) => !c.done))
      throw Error("Completá todos los pasos del checklist.");
  }
  return {
    ...(next !== "En curso" ? stopClock(t, at) : t),
    reopenCount:
      (t.reopenCount || 0) +
      (t.status === "Completada" && next !== "Completada" ? 1 : 0),
    status: next,
    startedAt: next === "En curso" ? t.startedAt || at : t.startedAt,
    completedAt: next === "Completada" ? at : null,
  };
}
export function checkTask(t: Task, checkId: string, done: boolean): Task {
  if (!t.checklist.some((c) => c.id === checkId))
    throw Error("El paso no pertenece a esta tarea.");
  let next = {
    ...t,
    checklist: t.checklist.map((c) => (c.id === checkId ? { ...c, done } : c)),
  };
  if (t.status === "Completada" && !done) next = transition(next, "En curso");
  if (done && next.status === "Pendiente") next = transition(next, "En curso");
  if (
    done &&
    next.checklist.length &&
    next.checklist.every((c) => c.done) &&
    !next.blockedBy &&
    next.kind === "resultado"
  )
    next = transition(next, "Completada");
  return next;
}
export function taskQuantity(t: Task, logs: Activity[]) {
  return logs
    .filter((a) => a.taskId === t.id && a.date.startsWith(t.month))
    .reduce((n, a) => n + a.qty, 0);
}
export function metrics(
  tasks: Task[],
  logs: Activity[],
  today = dateART(),
): Metrics {
  const results = tasks.filter((t) => t.kind === "resultado");
  const done = results.filter((t) => t.status === "Completada");
  const ontime = done.filter(
    (t) => t.due && t.completedAt && dateART(t.completedAt) <= t.due,
  );
  const points = tasks.reduce((n, t) => n + t.weight, 0);
  const earned = tasks.reduce(
    (n, t) =>
      n +
      t.weight *
        (t.kind === "resultado"
          ? t.status === "Completada"
            ? 1
            : 0
          : t.target > 0
            ? Math.min(taskQuantity(t, logs) / t.target, 1)
            : 0),
    0,
  );
  return {
    assigned: results.length,
    done: done.length,
    points,
    earned: Math.round(earned * 100) / 100,
    weighted: points ? Math.round((earned / points) * 100) : null,
    onTime: done.filter((t) => t.due).length
      ? Math.round((ontime.length / done.filter((t) => t.due).length) * 100)
      : null,
    late: results.filter(
      (t) => t.due && t.due < today && t.status !== "Completada",
    ).length,
    blocked: tasks.filter((t) => t.blockedBy).length,
    operational: tasks.filter((t) => t.kind === "operativa").length,
    operationalTarget: tasks.filter(
      (t) => t.kind === "operativa" && taskQuantity(t, logs) >= t.target,
    ).length,
  };
}
export function materialize(s: State, month: string): State {
  const tasks = [...s.tasks];
  for (const a of s.assignments) {
    if (a.retired) continue;
    if (s.closures.some((c) => c.ownerId === a.ownerId && c.month === month))
      continue;
    const p = s.profiles.find((p) => p.id === a.ownerId);
    if (!p?.active) continue;
    const schedule = a.schedule || {
      ...defaultSchedule(a.startMonth + "-01", a.frequency),
      monthDay: a.day,
      startDate:
        a.frequency === "única"
          ? dueDate(a.startMonth, a.day)
          : a.startMonth + "-01",
    };
    for (const occurrence of occurrences(schedule, month)) {
      if (
        tasks.some(
          (t) =>
            t.assignmentId === a.id &&
            (t.scheduledOn === occurrence.date ||
              (!t.scheduledOn &&
                t.month === month &&
                ["mensual", "única"].includes(schedule.frequency))),
        )
      )
        continue;
      tasks.push({
        id: id(),
        assignmentId: a.id,
        templateId: a.templateId,
        title: a.title,
        ownerId: a.ownerId,
        companyId: a.companyId,
        teamId: p.teamId,
        sector: a.sector,
        month,
        scheduledOn: occurrence.date,
        due: occurrence.due,
        kind: a.kind,
        weight: a.weight,
        unit: a.unit,
        target: a.target,
        status: "Pendiente",
        checklist: a.steps.map((text) => ({ id: id(), text, done: false })),
        completedAt: null,
        startedAt: null,
        priority: a.priority,
        blockedBy: "",
        blockedSince: null,
        sessions: [],
        reopenCount: 0,
      });
    }
  }
  return { ...s, tasks };
}
export function closeMonth(
  s: State,
  ownerId: string,
  month: string,
  actorId: string,
  note: string,
): State {
  const actor = s.profiles.find((p) => p.id === actorId);
  if (
    !actor ||
    actor.role === "empleado" ||
    !canSee(actor, ownerId, s.profiles)
  )
    throw Error("El cierre requiere un responsable de este empleado.");
  if (!note.trim())
    throw Error("La revisión requiere observaciones de cierre.");
  if (s.closures.some((c) => c.ownerId === ownerId && c.month === month))
    throw Error("Este mes ya está cerrado.");
  if (month > currentMonth()) throw Error("No se puede cerrar un mes futuro.");
  const tasks = s.tasks.filter(
    (t) => t.ownerId === ownerId && t.month === month,
  );
  if (!tasks.length) throw Error("No hay tareas para cerrar.");
  if (tasks.some((t) => t.sessions?.some((e) => !e.end)))
    throw Error(
      "Pausá los cronómetros activos de este empleado antes de cerrar.",
    );
  const logs = s.activity.filter(
    (a) => tasks.some((t) => t.id === a.taskId) && a.date.startsWith(month),
  );
  const c: Closure = {
    id: id(),
    ownerId,
    month,
    at: new Date().toISOString(),
    by: actorId,
    note,
    metrics: metrics(tasks, logs),
    tasks: structuredClone(tasks),
    activity: structuredClone(logs),
  };
  c.report = generatePeriodReport(s, c);
  return { ...s, closures: [...s.closures, c] };
}
export function csvCell(v: unknown) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
