import { dateART, metrics, metricsForProfile, isResponsible, responsibilityShare, taskQuantity, type State, type Closure, type Metrics } from "./model";
import { actorElapsedSeconds, duration } from "./workforce";
export interface ReportContribution {
  taskId: string;
  title: string;
  shareBps: number;
  possiblePoints: number;
  earnedPoints: number;
  recordedSeconds: number;
}
export interface ReportTransfer {
  taskId: string;
  title: string;
  formerOwner: string;
  newOwner: string;
  reason: string;
  transferredAt: string;
}
export interface ReportGroup {
  key: string;
  company: string;
  process: string;
  templateId: string | null;
  kind: "resultado" | "operativa";
  unit: string;
  metrics: Metrics;
  recordedSeconds: number;
  reopenings: number;
  contributions?: ReportContribution[];
}
export interface PeriodReport {
  schemaVersion: 1 | 2;
  generatedAt: string;
  employee: string;
  team: string;
  sector: string;
  recipientIds: string[];
  recipientNames: string[];
  delivery: "disponible en demostración";
  groups: ReportGroup[];
  recordedSeconds: number;
  reopenings: number;
  profileId?: string;
  contributions?: ReportContribution[];
  transfers?: ReportTransfer[];
  algorithm?: "joint-lab-v1";
}
export function closureCsvRows(
  c: Closure,
  companyName: (companyId: string) => string,
) {
  return [
    [
      "Tarea",
      "Empresa",
      "Tipo",
      "Peso global",
      "Participación personal %",
      "Puntos posibles personales",
      "Puntos obtenidos personales",
      "Tiempo personal",
      "Estado",
      "Cantidad",
      "Unidad",
      "Meta",
    ],
    ...c.tasks
      .filter((task) => isResponsible(task, c.ownerId))
      .map((task) => {
        const shareBps = responsibilityShare(task, c.ownerId);
        const quantity = taskQuantity(task, c.activity);
        const globalEarned = task.weight * (task.kind === "resultado"
          ? task.status === "Completada" ? 1 : 0
          : task.target > 0 ? Math.min(quantity / task.target, 1) : 0);
        return [
          task.title,
          companyName(task.companyId),
          task.kind,
          task.weight,
          shareBps / 100,
          task.weight * shareBps / 10000,
          globalEarned * shareBps / 10000,
          duration(actorElapsedSeconds(task, c.ownerId, c.at)),
          task.status,
          quantity,
          task.unit,
          task.target,
        ];
      }),
  ];
}
export function generatePeriodReport(s: State, c: Closure): PeriodReport {
  const p = s.profiles.find((p) => p.id === c.ownerId)!;
  const recipients = s.profiles.filter((p) => p.role === "jefe" && p.active);
  const grouped = new Map<string, typeof c.tasks>();
  for (const t of c.tasks) {
    const templateId =
      t.templateId ??
      s.assignments.find((a) => a.id === t.assignmentId)?.templateId ??
      null;
    // La identidad libre no se agrupa por semejanza de texto.
    const key = JSON.stringify([
      t.companyId,
      templateId || t.id,
      t.kind,
      t.unit,
      t.title,
    ]);
    grouped.set(key, [...(grouped.get(key) || []), t]);
  }
  const personalTasks = c.tasks.filter((task) => isResponsible(task, c.ownerId));
  const hasJointTasks = personalTasks.some((task) => !!task.responsibility);
  const contributions = personalTasks.map((task) => {
    const shareBps = responsibilityShare(task, c.ownerId);
    const globalEarned = task.weight * (task.kind === "resultado"
      ? task.status === "Completada" ? 1 : 0
      : task.target > 0 ? Math.min(c.activity.filter((a) => a.taskId === task.id && a.date.startsWith(task.month)).reduce((n, a) => n + a.qty, 0) / task.target, 1) : 0);
    return {
      taskId: task.id, title: task.title, shareBps,
      possiblePoints: task.weight * shareBps / 10000,
      earnedPoints: globalEarned * shareBps / 10000,
      recordedSeconds: actorElapsedSeconds(task, c.ownerId, c.at),
    };
  });
  const taskIds = new Set(personalTasks.map((task) => task.id));
  const transfers = (c.taskTransfers || [])
    .filter((transfer) => taskIds.has(transfer.taskId))
    .map((transfer) => ({
      taskId: transfer.taskId,
      title: c.tasks.find((task) => task.id === transfer.taskId)?.title || transfer.taskId,
      formerOwner: transfer.formerOwnerName,
      newOwner: transfer.newOwnerName,
      reason: transfer.reason,
      transferredAt: transfer.transferredAt,
    }));
  return {
    schemaVersion: hasJointTasks ? 2 : 1,
    ...(hasJointTasks ? { profileId: c.ownerId, algorithm: "joint-lab-v1" as const } : {}),
    generatedAt: c.at,
    employee: p.name,
    team: s.teams.find((t) => t.id === p.teamId)?.name || p.teamId,
    sector: p.sector,
    recipientIds: recipients.map((p) => p.id),
    recipientNames: recipients.map((p) => p.name),
    delivery: "disponible en demostración",
    recordedSeconds: personalTasks.reduce((n, t) => n + actorElapsedSeconds(t, c.ownerId, c.at), 0),
    reopenings: personalTasks.reduce((n, t) => n + (t.reopenCount || 0), 0),
    ...(hasJointTasks ? { contributions } : {}),
    ...(transfers.length ? { transfers } : {}),
    groups: [...grouped.entries()].map(([key, tasks]) => ({
      key,
      company:
        s.companies.find((x) => x.id === tasks[0].companyId)?.name ||
        tasks[0].companyId,
      process: tasks[0].title,
      templateId:
        tasks[0].templateId ??
        s.assignments.find((a) => a.id === tasks[0].assignmentId)?.templateId ??
        null,
      kind: tasks[0].kind,
      unit: tasks[0].unit,
      metrics: hasJointTasks ? metricsForProfile(tasks, c.activity, c.ownerId, dateART(c.at), c.at) : metrics(tasks, c.activity, dateART(c.at), c.at),
      recordedSeconds: tasks.reduce((n, t) => n + actorElapsedSeconds(t, c.ownerId, c.at), 0),
      reopenings: tasks.reduce((n, t) => n + (t.reopenCount || 0), 0),
      ...(hasJointTasks ? { contributions: contributions.filter((row) => tasks.some((task) => task.id === row.taskId)) } : {}),
    })),
  };
}
