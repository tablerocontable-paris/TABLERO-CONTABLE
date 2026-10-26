import {
  occurrences,
  defaultSchedule,
  type Schedule,
  type Frequency,
} from "./schedule";
import { stopClock, type TimeSession, type Absence } from "./workforce";
import { generatePeriodReport, type PeriodReport } from "./reports";
import { endOfARTDate, summarizeTimeliness, type TimelinessSummary } from "./timeliness";
export type Role = "jefe" | "encargado" | "empleado";
export type Status = "Pendiente" | "En curso" | "Completada";
export type Kind = "resultado" | "operativa";
export interface Profile {
  email?: string;
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
  /** Versioned lab-only source for an opt-in neutral starter concept. */
  starterId?: string;
  /** Catalogue snapshot used for future occurrences. Older records may be unversioned. */
  templateVersion?: number;
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
  /** Lab-only dependency links. The remote workspace does not consume them. */
  dependsOnTaskIds?: string[];
  availableFrom?: string | null;
  commercialProgress?: { month: string; throughDay: number; updatedAt: string; updatedBy: string } | null;
}
export interface Task {
  templateId?: string | null;
  /** Request that explicitly created this one-off assignment in the laboratory. */
  originRequestId?: string;
  /** Standard version captured when this occurrence was materialized. */
  templateVersion?: number;
  scheduledOn?: string;
  /** Actor who performed the latest completion in this local laboratory. */
  completedBy?: string;
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
  responsibility?: JointResponsibility;
  /** Optional, explicit dependencies used by the private laboratory. */
  dependsOnTaskIds?: string[];
  availableFrom?: string | null;
  /** Optional bank reconciliation tracking, expressed on a 30-day commercial month. */
  commercialTrackingEnabled?: boolean;
  commercialProgress?: { month: string; throughDay: number; updatedAt: string; updatedBy: string } | null;
  /** Evidence IDs are metadata references; file bytes live only in laboratory IndexedDB. */
  evidenceIds?: string[];
}
export interface JointMemberSnapshot {
  profileId: string;
  shareBps: number;
  name: string;
  teamId: string;
  sector: string;
}
export interface JointResponsibility {
  version: 1;
  revision: 1;
  mode: "joint";
  activatedAt: string;
  activatedBy: string;
  reason: string;
  members: [JointMemberSnapshot, JointMemberSnapshot];
}
export interface JointReceipt {
  requestId: string;
  actorId: string;
  taskId: string;
  body: string;
  revision: number;
  acknowledgedAt: string;
}
export interface Activity {
  id: string;
  taskId: string;
  date: string;
  qty: number;
  note: string;
  createdAt: string;
  actorId: string;
  /** Rate is snapshotted when this movement is recorded in the laboratory. */
  operationalRateId?: string | null;
  operationalUnitWeight?: number | null;
  evidenceIds?: string[];
}
export interface Audit {
  id: string;
  at: string;
  actorId: string;
  action: string;
  entityId: string;
}
export interface TaskTransfer {
  id: string;
  taskId: string;
  formerOwnerId: string;
  formerOwnerName: string;
  newOwnerId: string;
  newOwnerName: string;
  companyId: string;
  reason: string;
  transferredAt: string;
  transferredBy: string;
  taskSnapshot: Task;
  sessions: TimeSession[];
  activity: Activity[];
  comments: import('./notifications').TaskComment[];
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
  timeliness?: TimelinessSummary;
}
export interface Closure {
  report?: PeriodReport;
  taskTransfers?: TaskTransfer[];
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
export interface OrphanedWork {
  id: string;
  taskId: string;
  formerOwnerId: string;
  formerOwnerName: string;
  companyId: string;
  assignmentSnapshot: {
    id: string;
    title: string;
    templateId: string | null;
    frequency: Frequency;
    schedule?: Schedule;
  } | null;
  reason: string;
  createdAt: string;
  resolution: "ready" | "handoff_required" | "review_required";
  status: "pending" | "reassigned" | "transferred";
  resolvedAt?: string;
  resolvedBy?: string;
  assignedTo?: string;
}
export type AnnotationKind = "personal" | "formula" | "reminder";
export interface Annotation {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  kind: AnnotationKind;
  category?: string;
  reminderOn: string | null;
  createdAt: string;
  updatedAt: string;
  convertedTaskId: string | null;
}
export interface Onboarding {
  assignmentCompanyIds?: Record<string, string[]>;
  schedules?: Record<string, Schedule>;
  /** New inductions save recurrence and target independently for each company. */
  companySchedules?: Record<string, Record<string, Schedule>>;
  companyTargets?: Record<string, Record<string, number>>;
  habitualTaskProposals?: HabitualTaskProposalDraft[];
  habitualProposalForm?: {
    title: string;
    process: string;
    description: string;
    kind: Kind;
    unit: string;
    steps: string[];
  };
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
export interface HabitualTaskProposalDraft {
  id: string;
  title: string;
  process: string;
  description: string;
  kind: Kind;
  unit: string;
  steps: string[];
  companyIds: string[];
}
export interface HabitualTaskProposal {
  id: string;
  ownerId: string;
  companyId: string;
  originalTitle: string;
  title: string;
  process: string;
  description: string;
  kind: Kind;
  unit: string;
  target: number;
  schedule: Schedule;
  steps: string[];
  revision: number;
  submittedAt: string;
  updatedAt: string;
  status: "pending" | "changes_requested" | "approved";
  managerNote?: string;
  templateId?: string;
  templateVersion?: number;
  submissions: {
    revision: number;
    title: string;
    process: string;
    description: string;
    kind: Kind;
    unit: string;
    target: number;
    schedule: Schedule;
    steps: string[];
    submittedAt: string;
  }[];
  history: {
    id: string;
    by: string;
    action: "submitted" | "changes_requested" | "resubmitted" | "approved";
    note: string;
    at: string;
    templateId?: string;
    templateVersion?: number;
  }[];
}
export interface ParameterReview {
  onboardingCompletedAt: string;
  reviewedAt: string;
  reviewedBy: string;
}
export interface State {
  /** Changes on every durable lab write so stale tabs can reject overwrites safely. */
  labRevision?: string;
  boardOrder?: "original" | "az" | "za";
  notifications?: import('./notifications').WorkNotification[];
  deadlineReminderReads?: Record<string, string>;
  internalRequests?: import('./internalRequests').InternalRequest[];
  taskComments?: import('./notifications').TaskComment[];
  jointReceipts?: JointReceipt[];
  parameterReviews?: Record<string, ParameterReview>;
  version: 3;
  absences?: Absence[];
  orphanedWork?: OrphanedWork[];
  taskTransfers?: TaskTransfer[];
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
  tourVersion?: Record<string, number>;
  tourStepId?: Record<string, string>;
  annotations?: Annotation[];
  catalogueVersions?: import("./processImprovement").CatalogueVersion[];
  improvementProposals?: import("./processImprovement").KaizenProposal[];
  fiveSReviews?: import("./processImprovement").FiveSReview[];
  fiscalObligations?: import("./fiscalObligations").FiscalObligation[];
  habitualTaskProposals?: HabitualTaskProposal[];
  /** These collections belong to the private lab contract; the remote API ignores them. */
  operationalRates?: import("./laboratory-work").OperationalRate[];
  operationalAssessments?: import("./laboratory-work").OperationalAssessment[];
  calendarEvents?: import("./laboratory-work").LabCalendarEvent[];
  calendarNotices?: import("./laboratory-work").CalendarNotice[];
  companyClosures?: import("./laboratory-work").CompanyClosure[];
  taskEvidence?: import("./laboratory-work").TaskEvidence[];
}
export const id = () => crypto.randomUUID();
const argentinaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const dateART = (iso = new Date().toISOString()) =>
  argentinaDateFormatter.format(new Date(iso));
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
type TaskResponsibilityView = Pick<Task, "ownerId" | "teamId" | "sector" | "responsibility">;
export function responsibleMembers(t: TaskResponsibilityView): JointMemberSnapshot[] {
  return t.responsibility?.members || [{
    profileId: t.ownerId, shareBps: 10000, name: "", teamId: t.teamId, sector: t.sector,
  }];
}
export function responsibilityShare(t: TaskResponsibilityView, profileId: string) {
  return responsibleMembers(t).find((m) => m.profileId === profileId)?.shareBps || 0;
}
export function isResponsible(t: TaskResponsibilityView, profileId: string) {
  return responsibleMembers(t).some((m) => m.profileId === profileId);
}
export function isCompanyClosed(s: State, ownerId: string, companyId: string, month: string) {
  return s.closures.some((closure) => closure.ownerId === ownerId && closure.month === month) ||
    (s.companyClosures || []).some((closure) => closure.ownerId === ownerId && closure.companyId === companyId && closure.month === month);
}
export function canAccessJointTask(s: State, actor: Profile, t: Task) {
  if (!t.responsibility) return canSee(actor, t.ownerId, s.profiles);
  if (actor.id === "admin") return false;
  if (!actor.active) return false;
  if (actor.role === "jefe") return true;
  if (!actor.companyIds.includes(t.companyId)) return false;
  if (isResponsible(t, actor.id)) return true;
  return actor.role === "encargado" && t.responsibility.members.some((m) => {
    const member = s.profiles.find((p) => p.id === m.profileId);
    return member?.managerId === actor.id;
  });
}
export function isClosed(s: State, t: Pick<Task, "ownerId" | "companyId" | "month" | "responsibility">) {
  const owners = t.responsibility?.members.map((m) => m.profileId) || [t.ownerId];
  return owners.some((ownerId) => isCompanyClosed(s, ownerId, t.companyId, t.month));
}
export function taskReadiness(state: State, task: Task, on = dateART(), viewer?: Profile) {
  const currentViewer = viewer ? state.profiles.find((profile) => profile.id === viewer.id) : undefined;
  const deps = task.dependsOnTaskIds || [];
  const unmet = deps.map((depId) => state.tasks.find((row) => row.id === depId)).filter((dep) => !dep || dep.status !== "Completada");
  const visibleUnmet = unmet.filter((dependency): dependency is Task => !!dependency && (!viewer ||
    !!currentViewer?.active && (currentViewer.role === "jefe" || currentViewer.companyIds.includes(dependency.companyId)) && canAccessJointTask(state, currentViewer, dependency)));
  const hasHiddenUnmet = visibleUnmet.length !== unmet.length;
  return {
    ready: !task.blockedBy && (!task.availableFrom || task.availableFrom <= on) && unmet.length === 0,
    reason: task.blockedBy
      ? `Espera externa: ${task.blockedBy}`
      : task.availableFrom && task.availableFrom > on
        ? `Disponible desde ${task.availableFrom}`
        : unmet.length
          ? hasHiddenUnmet
            ? visibleUnmet.length
              ? `Espera ${visibleUnmet.map((dep) => dep.title).join(", ")} y otras tareas fuera de tu ámbito`
              : "Espera una tarea que no está disponible en tu ámbito"
            : `Espera ${unmet.map((dep) => dep?.title || "una tarea eliminada").join(", ")}`
          : "Lista para empezar",
  };
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
    if (t.commercialTrackingEnabled && t.commercialProgress?.throughDay !== 30)
      throw Error("Para completar esta conciliación, registrá el día comercial 30 y confirmá el cierre del período.");
    if (t.checklist.some((c) => !c.done))
      throw Error("Completá todos los pasos del checklist.");
  }
  if (next === "Completada" && t.status === "Completada") return t;
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
  if (t.checklist.find((c) => c.id === checkId)?.done === done) return t;
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
    next.kind === "resultado" &&
    !next.commercialTrackingEnabled
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
  asOfISO?: string,
): Metrics {
  const reference = asOfISO || endOfARTDate(today) || "invalid";
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
    timeliness: summarizeTimeliness(tasks, logs, reference),
  };
}
export function metricsForProfile(
  tasks: Task[], logs: Activity[], profileId: string, today = dateART(), asOfISO?: string,
): Metrics {
  return metrics(tasks.filter((t) => isResponsible(t, profileId)).map((t) => ({
    ...t, weight: t.weight * responsibilityShare(t, profileId) / 10000,
  })), logs, today, asOfISO);
}
export function materialize(s: State, month: string): State {
  const tasks = [...s.tasks];
  for (const a of s.assignments) {
    if (a.retired) continue;
    if (s.closures.some((c) => c.ownerId === a.ownerId && c.month === month) ||
        (s.companyClosures || []).some((c) => c.ownerId === a.ownerId && c.companyId === a.companyId && c.month === month))
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
        ...(a.templateVersion === undefined ? {} : { templateVersion: a.templateVersion }),
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
    !actor.active ||
    actor.role !== "jefe" ||
    !canSee(actor, ownerId, s.profiles)
  )
    throw Error("El cierre requiere jefatura activa y autorizada.");
  if (!note.trim())
    throw Error("La revisión requiere observaciones de cierre.");
  if (s.closures.some((c) => c.ownerId === ownerId && c.month === month))
    throw Error("Este mes ya está cerrado.");
  if (month > currentMonth()) throw Error("No se puede cerrar un mes futuro.");
  const tasks = s.tasks.filter(
    (t) => t.month === month && isResponsible(t, ownerId),
  );
  if (!tasks.length) throw Error("No hay tareas para cerrar.");
  if (tasks.some((t) => t.sessions?.some((e) => !e.end)))
    throw Error(
      "Pausá todos los cronómetros de sus tareas antes de cerrar el período.",
    );
  if (tasks.some((t) => t.responsibility &&
      (t.kind === "resultado" ? t.status !== "Completada" :
        t.blockedBy || t.target <= 0 || taskQuantity(t, s.activity) < t.target)))
    throw Error("No se puede cerrar una tarea conjunta pendiente o sin meta cumplida.");
  const logs = s.activity.filter(
    (a) => tasks.some((t) => t.id === a.taskId) && a.date.startsWith(month),
  );
  const at = new Date().toISOString();
  const c: Closure = {
    id: id(),
    ownerId,
    month,
    at,
    by: actorId,
    note,
    metrics: metricsForProfile(tasks, logs, ownerId, dateART(at), at),
    tasks: structuredClone(tasks),
    activity: structuredClone(logs),
    taskTransfers: structuredClone((s.taskTransfers || []).filter((transfer) => tasks.some((task) => task.id === transfer.taskId))),
  };
  c.report = generatePeriodReport(s, c);
  return { ...s, closures: [...s.closures, c] };
}
export function csvCell(v: unknown) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
