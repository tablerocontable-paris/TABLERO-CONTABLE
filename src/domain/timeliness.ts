import type { Activity, Kind, Task } from "./model";

export type TimelinessStatus =
  | "early"
  | "on-date"
  | "late"
  | "pending"
  | "overdue"
  | "no-deadline"
  | "unknown";
export type TimelinessEvidence = "completion" | "registered-target";
export interface TaskTimeliness {
  status: TimelinessStatus;
  achievementAt: string | null;
  daysAhead: number | null;
  evidence: TimelinessEvidence | null;
}
export interface TimelinessBucket {
  evaluated: number;
  early: number;
  onDate: number;
  late: number;
  pending: number;
  overdue: number;
  noDeadline: number;
  unknown: number;
  earlyRate: number | null;
  averageDaysAhead: number | null;
}
export interface TimelinessSummary {
  version: 1;
  results: TimelinessBucket;
  operational: TimelinessBucket;
  total: TimelinessBucket;
}

const emptyBucket = (): TimelinessBucket => ({
  evaluated: 0,
  early: 0,
  onDate: 0,
  late: 0,
  pending: 0,
  overdue: 0,
  noDeadline: 0,
  unknown: 0,
  earlyRate: null,
  averageDaysAhead: null,
});

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}

export function endOfARTDate(today: string): string | null {
  if (!validDate(today)) return null;
  const [y, m, d] = today.split("-").map(Number);
  // Final representable instant of the ART day; UTC-03:00.
  return new Date(Date.UTC(y, m - 1, d + 1, 3) - 1).toISOString();
}

function dateART(instant: string): string | null {
  const parsed = Date.parse(instant);
  if (!Number.isFinite(parsed)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  const result = `${part("year")}-${part("month")}-${part("day")}`;
  return validDate(result) ? result : null;
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}

function operationAchievement(
  task: Task,
  activity: Activity[],
  asOfMs: number,
): { at: string } | { unknown: true } | null {
  if (!Number.isSafeInteger(task.target) || task.target <= 0)
    return { unknown: true };
  const own = activity.filter((entry) => entry.taskId === task.id);
  const relevant = own.filter((entry) => entry.date.startsWith(task.month));
  const asOfDate = dateART(new Date(asOfMs).toISOString());
  if (
    relevant.some(
      (entry) =>
        !validDate(entry.date) ||
        (asOfDate !== null && entry.date > asOfDate),
    )
  )
    return { unknown: true };
  const entries = relevant as Activity[];
  if (
    entries.some(
      (entry) =>
        !Number.isSafeInteger(entry.qty) ||
        entry.qty <= 0 ||
        !Number.isFinite(Date.parse(entry.createdAt)) ||
        Date.parse(entry.createdAt) > asOfMs,
    )
  )
    return { unknown: true };
  entries.sort(
    (a, b) =>
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
  let quantity = 0;
  for (const entry of entries) {
    quantity += entry.qty;
    if (quantity >= task.target) return { at: entry.createdAt };
  }
  return null;
}

export function taskTimeliness(
  task: Task,
  activity: Activity[],
  asOfISO: string,
): TaskTimeliness {
  const unknown: TaskTimeliness = {
    status: "unknown",
    achievementAt: null,
    daysAhead: null,
    evidence: null,
  };
  const asOfMs = Date.parse(asOfISO);
  if (!Number.isFinite(asOfMs)) return unknown;
  if (!task.due) return { ...unknown, status: "no-deadline" };
  if (!validDate(task.due)) return unknown;

  let achievementAt: string | null = null;
  let evidence: TimelinessEvidence;
  if (task.kind === "resultado") {
    evidence = "completion";
    if (task.status !== "Completada") {
      const today = dateART(asOfISO);
      if (!today) return unknown;
      return {
        ...unknown,
        status: task.due < today ? "overdue" : "pending",
      };
    }
    if (!task.completedAt || !Number.isFinite(Date.parse(task.completedAt)))
      return unknown;
    achievementAt = task.completedAt;
  } else {
    evidence = "registered-target";
    const result = operationAchievement(task, activity, asOfMs);
    if (!result) {
      const today = dateART(asOfISO);
      if (!today) return unknown;
      return {
        ...unknown,
        status: task.due < today ? "overdue" : "pending",
      };
    }
    if ("unknown" in result) return unknown;
    achievementAt = result.at;
  }

  const achievedDate = dateART(achievementAt);
  if (!achievedDate || achievedDate > dateART(asOfISO)!) return unknown;
  const daysAhead = daysBetween(achievedDate, task.due);
  return {
    status: daysAhead > 0 ? "early" : daysAhead === 0 ? "on-date" : "late",
    achievementAt,
    daysAhead,
    evidence,
  };
}

function finishBucket(
  bucket: TimelinessBucket,
  earlyDays: number[],
): TimelinessBucket {
  bucket.evaluated = bucket.early + bucket.onDate + bucket.late;
  bucket.earlyRate = bucket.evaluated
    ? Math.round((bucket.early / bucket.evaluated) * 100)
    : null;
  bucket.averageDaysAhead = earlyDays.length
    ? Math.round(
        (earlyDays.reduce((sum, days) => sum + days, 0) / earlyDays.length) *
          10,
      ) / 10
    : null;
  return bucket;
}

export function summarizeTimeliness(
  tasks: Task[],
  activity: Activity[],
  asOfISO: string,
): TimelinessSummary {
  const buckets = {
    resultado: emptyBucket(),
    operativa: emptyBucket(),
  } satisfies Record<Kind, TimelinessBucket>;
  const earlyDays: Record<Kind, number[]> = { resultado: [], operativa: [] };
  const seen = new Set<string>();
  for (const task of tasks) {
    if (seen.has(task.id)) continue;
    seen.add(task.id);
    const result = taskTimeliness(task, activity, asOfISO);
    const bucket = buckets[task.kind];
    switch (result.status) {
      case "early":
        bucket.early++;
        earlyDays[task.kind].push(result.daysAhead!);
        break;
      case "on-date":
        bucket.onDate++;
        break;
      case "late":
        bucket.late++;
        break;
      case "pending":
        bucket.pending++;
        break;
      case "overdue":
        bucket.overdue++;
        break;
      case "no-deadline":
        bucket.noDeadline++;
        break;
      case "unknown":
        bucket.unknown++;
    }
  }
  finishBucket(buckets.resultado, earlyDays.resultado);
  finishBucket(buckets.operativa, earlyDays.operativa);
  const total = emptyBucket();
  for (const key of [
    "evaluated",
    "early",
    "onDate",
    "late",
    "pending",
    "overdue",
    "noDeadline",
    "unknown",
  ] as const)
    total[key] = buckets.resultado[key] + buckets.operativa[key];
  finishBucket(total, [...earlyDays.resultado, ...earlyDays.operativa]);
  return {
    version: 1,
    results: buckets.resultado,
    operational: buckets.operativa,
    total,
  };
}
