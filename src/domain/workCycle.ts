import type { Activity, Profile, State, Task } from "./model";
import type { TaskEvidence } from "./laboratory-work";

export type WorkCycleMode = "day" | "week";
export type WorkCycleDimension = "company" | "person" | "team" | "sector";

export interface WorkCycleMeasure {
  plannedOccurrences: number;
  plannedPoints: number;
  completedTasks: number;
  completedPoints: number;
  recordedSeconds: number;
  operationalRecords: number;
  operationalAmounts: Record<string, number>;
}

export interface WorkCycleBucket extends WorkCycleMeasure {
  key: string;
  label: string;
  start: string;
  end: string;
  hasExecutionEvidence: boolean;
}

export interface WorkCycleGroup extends WorkCycleMeasure {
  key: string;
  label: string;
}

export interface WorkCycleResult {
  buckets: WorkCycleBucket[];
  groups: WorkCycleGroup[];
  unattributedClosures: number;
}

export function applyCompletionAttribution(
  previous: Task[],
  next: Task[],
  actorId: string,
): Task[] {
  const priorTasks = new Map(previous.map((task) => [task.id, task]));
  return next.map((task) => {
    const old = priorTasks.get(task.id);
    if (old && old.status !== "Completada" && task.status === "Completada")
      return { ...task, completedBy: actorId };
    if (old?.status === "Completada" && task.status !== "Completada") {
      const { completedBy: _completedBy, ...reopened } = task;
      return reopened;
    }
    return task;
  });
}

/** Link task evidence to a newly completed task without changing prior or activity evidence. */
export function linkEvidenceToCompletions(previous: Task[], next: Task[], evidence: TaskEvidence[]): TaskEvidence[] {
  const completedAtByTask = new Map<string, string>();
  for (const task of next) {
    const old = previous.find((entry) => entry.id === task.id);
    if (old && old.status !== "Completada" && task.status === "Completada" && task.completedAt)
      completedAtByTask.set(task.id, task.completedAt);
  }
  if (!completedAtByTask.size) return evidence;
  const taskById = new Map(next.map((task) => [task.id, task]));
  return evidence.map((row) => {
    const completionAt = completedAtByTask.get(row.taskId);
    if (row.activityId || row.completionAt || !completionAt || !taskById.get(row.taskId)?.evidenceIds?.includes(row.id)) return row;
    return { ...row, completionAt };
  });
}

const argentinaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const argentinaWallClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function dateInArgentina(timestamp: number): string {
  return argentinaDate.format(new Date(timestamp));
}

function nextDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
}

function argentinaMidnight(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const desiredWallClock = Date.UTC(year, month - 1, day);
  let candidate = desiredWallClock;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      argentinaWallClock
        .formatToParts(new Date(candidate))
        .map(({ type, value }) => [type, value]),
    );
    const observedWallClock = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const correction = desiredWallClock - observedWallClock;
    candidate += correction;
    if (correction === 0) break;
  }
  return candidate;
}

function emptyMeasure(): WorkCycleMeasure {
  return {
    plannedOccurrences: 0,
    plannedPoints: 0,
    completedTasks: 0,
    completedPoints: 0,
    recordedSeconds: 0,
    operationalRecords: 0,
    operationalAmounts: {},
  };
}

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function makeBuckets(month: string, mode: WorkCycleMode): WorkCycleBucket[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const buckets: WorkCycleBucket[] = [];
  for (let day = 1; day <= daysInMonth;) {
    const start = `${month}-${String(day).padStart(2, "0")}`;
    let end = start;
    if (mode === "week") {
      const weekday = new Date(`${start}T12:00:00Z`).getUTCDay();
      const daysUntilSunday = (7 - weekday) % 7;
      end = `${month}-${String(Math.min(daysInMonth, day + daysUntilSunday)).padStart(2, "0")}`;
    }
    const label =
      mode === "day"
        ? dateLabel(start)
        : `${dateLabel(start)} – ${dateLabel(end)}`;
    buckets.push({
      key: `${mode}:${start}`,
      label,
      start,
      end,
      ...emptyMeasure(),
      hasExecutionEvidence: false,
    });
    day = Number(end.slice(-2)) + 1;
  }
  return buckets;
}

function memberRows(task: Task, state: Pick<State, "profiles">) {
  if (task.responsibility) return task.responsibility.members;
  const profile = state.profiles.find((entry) => entry.id === task.ownerId);
  return [
    {
      profileId: task.ownerId,
      shareBps: 10000,
      name: profile?.name || "Responsable sin perfil",
      teamId: task.teamId,
      sector: task.sector,
    },
  ];
}

function groupForTask(
  task: Task,
  dimension: WorkCycleDimension,
  state: Pick<State, "companies" | "profiles" | "teams">,
  profileId?: string,
): { key: string; label: string } {
  if (dimension === "company") {
    const company = state.companies.find(
      (entry) => entry.id === task.companyId,
    );
    return {
      key: task.companyId,
      label: company?.name || "Empresa sin nombre",
    };
  }
  if (dimension === "person") {
    const member = profileId
      ? memberRows(task, state).find((entry) => entry.profileId === profileId)
      : undefined;
    const profile = state.profiles.find((entry) => entry.id === profileId);
    return {
      key: profileId || "unattributed",
      label:
        member?.name ||
        profile?.name ||
        (profileId ? "Persona no disponible" : "Cierre histórico sin actor"),
    };
  }
  const member = profileId
    ? memberRows(task, state).find((entry) => entry.profileId === profileId)
    : undefined;
  const profile = state.profiles.find((entry) => entry.id === profileId);
  if (dimension === "team") {
    const teamId =
      member?.teamId ||
      profile?.teamId ||
      (profileId === task.ownerId ? task.teamId : "unassigned");
    const team = state.teams.find((entry) => entry.id === teamId);
    return {
      key: teamId,
      label:
        team?.name ||
        (teamId === "unassigned" ? "Equipo no disponible" : `Equipo ${teamId}`),
    };
  }
  const sector =
    member?.sector ||
    profile?.sector ||
    (profileId === task.ownerId ? task.sector : "Sector no disponible");
  return { key: sector, label: sector };
}

function addToGroup(
  groups: Map<string, WorkCycleGroup>,
  ref: { key: string; label: string },
  update: (measure: WorkCycleMeasure) => void,
) {
  const group = groups.get(ref.key) || { ...ref, ...emptyMeasure() };
  update(group);
  groups.set(ref.key, group);
}

function bucketForDate(buckets: WorkCycleBucket[], date: string) {
  return buckets.find((bucket) => bucket.start <= date && date <= bucket.end);
}

function addSessionSeconds(
  buckets: WorkCycleBucket[],
  session: { start: string; end: string | null },
  onDay: (date: string, seconds: number) => void,
  asOfMs: number,
  month: string,
) {
  const startMs = Date.parse(session.start);
  const rawEndMs = session.end ? Date.parse(session.end) : asOfMs;
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(rawEndMs) ||
    rawEndMs <= startMs
  )
    return;
  const endMs = Math.min(rawEndMs, asOfMs);
  if (endMs <= startMs) return;
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = argentinaMidnight(`${month}-01`);
  const lastDayNumber = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthEnd = argentinaMidnight(
    nextDate(`${month}-${String(lastDayNumber).padStart(2, "0")}`),
  );
  const clippedStart = Math.max(startMs, monthStart);
  const clippedEnd = Math.min(endMs, monthEnd);
  if (clippedEnd <= clippedStart) return;
  let day = dateInArgentina(clippedStart);
  const finalDate = dateInArgentina(clippedEnd - 1);
  while (day <= finalDate) {
    const dayStart = argentinaMidnight(day);
    const dayEnd = argentinaMidnight(nextDate(day));
    const overlap = Math.max(
      0,
      Math.min(clippedEnd, dayEnd) - Math.max(clippedStart, dayStart),
    );
    if (overlap > 0 && bucketForDate(buckets, day)) onDay(day, overlap / 1000);
    day = nextDate(day);
  }
}

export function buildWorkCycle(input: {
  tasks: Task[];
  activity: Activity[];
  month: string;
  mode: WorkCycleMode;
  dimension: WorkCycleDimension;
  state: Pick<State, "companies" | "profiles" | "teams">;
  asOfISO?: string;
}): WorkCycleResult {
  const buckets = makeBuckets(input.month, input.mode);
  const asOfMs = Date.parse(input.asOfISO || new Date().toISOString());
  if (!buckets.length || !Number.isFinite(asOfMs))
    return { buckets, groups: [], unattributedClosures: 0 };
  const groups = new Map<string, WorkCycleGroup>();
  const tasks = input.tasks.filter((task) => task.month === input.month);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  let unattributedClosures = 0;

  for (const task of tasks) {
    if (task.scheduledOn?.startsWith(`${input.month}-`)) {
      const bucket = bucketForDate(buckets, task.scheduledOn);
      if (bucket) {
        bucket.plannedOccurrences += 1;
        if (task.kind === "resultado") bucket.plannedPoints += task.weight;
        bucket.hasExecutionEvidence ||= false;
        const targets =
          input.dimension === "company"
            ? [
                {
                  ...groupForTask(task, input.dimension, input.state),
                  share: 1,
                },
              ]
            : memberRows(task, input.state).map((member) => ({
                ...groupForTask(
                  task,
                  input.dimension,
                  input.state,
                  member.profileId,
                ),
                share: member.shareBps / 10000,
              }));
        for (const target of targets)
          addToGroup(groups, target, (group) => {
            group.plannedOccurrences += target.share;
            if (task.kind === "resultado") group.plannedPoints += task.weight * target.share;
          });
      }
    }

    if (task.status === "Completada" && task.completedAt) {
      const completedAtMs = Date.parse(task.completedAt);
      if (!Number.isFinite(completedAtMs)) continue;
      const completedDate = dateInArgentina(completedAtMs);
      const bucket = bucketForDate(buckets, completedDate);
      if (bucket) {
        bucket.completedTasks += 1;
        if (task.kind === "resultado") bucket.completedPoints += task.weight;
        bucket.hasExecutionEvidence = true;
        const ref =
          input.dimension === "company"
            ? groupForTask(task, input.dimension, input.state)
            : task.completedBy
              ? groupForTask(
                  task,
                  input.dimension,
                  input.state,
                  task.completedBy,
                )
              : groupForTask(task, input.dimension, input.state);
        if (!task.completedBy) unattributedClosures += 1;
        addToGroup(groups, ref, (group) => {
          group.completedTasks += 1;
          if (task.kind === "resultado") group.completedPoints += task.weight;
        });
      }
    }

    for (const session of task.sessions || []) {
      const ref = groupForTask(
        task,
        input.dimension,
        input.state,
        session.actorId,
      );
      addSessionSeconds(
        buckets,
        session,
        (date, seconds) => {
          const bucket = bucketForDate(buckets, date);
          if (bucket) {
            bucket.recordedSeconds += seconds;
            bucket.hasExecutionEvidence = true;
          }
          addToGroup(groups, ref, (group) => {
            group.recordedSeconds += seconds;
          });
        },
        asOfMs,
        input.month,
      );
    }
  }

  for (const entry of input.activity) {
    const task = taskById.get(entry.taskId);
    if (
      !task ||
      task.kind !== "operativa" ||
      !entry.date.startsWith(`${input.month}-`)
    )
      continue;
    const bucket = bucketForDate(buckets, entry.date);
    if (!bucket) continue;
    const ref = groupForTask(task, input.dimension, input.state, entry.actorId);
    const unit = task.unit.trim() || "Unidad no indicada";
    bucket.operationalRecords += 1;
    bucket.operationalAmounts[unit] =
      (bucket.operationalAmounts[unit] || 0) + entry.qty;
    bucket.hasExecutionEvidence = true;
    addToGroup(groups, ref, (group) => {
      group.operationalRecords += 1;
      group.operationalAmounts[unit] =
        (group.operationalAmounts[unit] || 0) + entry.qty;
    });
  }

  return {
    buckets,
    groups: [...groups.values()].sort(
      (a, b) =>
        b.plannedPoints - a.plannedPoints ||
        b.recordedSeconds - a.recordedSeconds ||
        a.label.localeCompare(b.label, "es"),
    ),
    unattributedClosures,
  };
}
