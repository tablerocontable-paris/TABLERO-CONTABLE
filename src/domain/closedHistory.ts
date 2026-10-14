import { canSee, dateART, metrics, metricsForProfile, type State, type Task } from "./model";
import type { CoverageReportContribution } from "./reports";

export interface ClosedHistoryFilters {
  viewerId: string;
  throughMonth: string;
  ownerId?: string;
  companyId?: string;
  sector?: string;
  teamId?: string;
  query?: string;
}

/** Builds analytics only from immutable, fully closed month snapshots. */
export function closedPeriodHistory(state: State, filters: ClosedHistoryFilters) {
  const viewer = state.profiles.find((profile) => profile.id === filters.viewerId);
  if (!viewer?.active) return [];
  const canAccessCompany = (companyId: string) => viewer.role === "jefe" || viewer.companyIds.includes(companyId);
  const canViewCoveredItem = (item: CoverageReportContribution) =>
    viewer.role === "jefe" || viewer.id === item.executorId || canSee(viewer, item.originalOwnerId, state.profiles);
  if (filters.companyId && !canAccessCompany(filters.companyId)) return [];
  const individualOwnerId = filters.ownerId || (viewer.role === "empleado" ? viewer.id : undefined);
  const query = filters.query?.trim().toLocaleLowerCase("es") || "";
  const visibleClosures = state.closures.filter((closure) =>
    closure.month <= filters.throughMonth &&
    (!filters.ownerId || closure.ownerId === filters.ownerId) &&
    canSee(viewer, closure.ownerId, state.profiles) && (
      closure.tasks.some((task) => canAccessCompany(task.companyId) && (!filters.companyId || task.companyId === filters.companyId)) ||
      (closure.report?.coverageContributions || []).some((item) => canViewCoveredItem(item) && canAccessCompany(item.companyId) && (!filters.companyId || item.companyId === filters.companyId))
    ),
  );
  const periods = [...new Set(visibleClosures.map((closure) => closure.month))].sort().slice(-6);

  return periods.map((period) => {
    const closures = visibleClosures.filter((closure) => closure.month === period);
    const taskById = new Map<string, Task>();
    const activities = new Map<string, (typeof closures)[number]["activity"][number]>();
    for (const closure of closures) {
      for (const task of closure.tasks) {
        if (!canAccessCompany(task.companyId)) continue;
        if (filters.companyId && task.companyId !== filters.companyId) continue;
        if (filters.sector && task.sector !== filters.sector) continue;
        if (filters.teamId && task.teamId !== filters.teamId) continue;
        const profile = state.profiles.find((row) => row.id === closure.ownerId);
        const text = `${task.title} ${profile?.name || closure.report?.employee || ""} ${task.companyId}`.toLocaleLowerCase("es");
        if (query && !text.includes(query)) continue;
        taskById.set(task.id, task);
      }
      for (const row of closure.activity) activities.set(row.id, row);
    }
    const tasks = [...taskById.values()];
    const coveredContributions = closures.flatMap((closure) => closure.report?.coverageContributions || [])
      .filter((item) => canViewCoveredItem(item) && canAccessCompany(item.companyId) && (!filters.companyId || item.companyId === filters.companyId) &&
        (!individualOwnerId || item.executorId === individualOwnerId) && (!filters.sector || item.sector === filters.sector) &&
        (!filters.teamId || item.executorTeamId === filters.teamId) &&
        (!query || `${item.title} ${item.executor} ${item.originalOwner} ${item.company}`.toLocaleLowerCase("es").includes(query)));
    const taskIds = new Set(tasks.map((task) => task.id));
    const logs = [...activities.values()].filter((row) => taskIds.has(row.taskId));
    const snapshotDate = closures.map((closure) => closure.at).sort().at(-1) || `${period}-28T23:59:59.000Z`;
    const deliveryTasks = tasks.filter((task) => task.kind === "resultado");
    const values = individualOwnerId
      ? metricsForProfile(deliveryTasks, logs, individualOwnerId, dateART(snapshotDate), snapshotDate)
      : metrics(deliveryTasks, logs, dateART(snapshotDate), snapshotDate);
    const narrowFilter = !!filters.sector || !!filters.teamId || !!query;
    const frozenOperationalLoads = !narrowFilter ? closures.flatMap((closure) => {
      const visibleOperationalCompanies = [...new Set(closure.tasks
        .filter((task) => task.kind === "operativa" && canAccessCompany(task.companyId) &&
          (!filters.companyId || task.companyId === filters.companyId))
        .map((task) => task.companyId))];
      if (!visibleOperationalCompanies.length) return [null];
      const units = state.companyClosures?.filter((unit) => unit.ownerId === closure.ownerId &&
        unit.month === period && visibleOperationalCompanies.includes(unit.companyId)) || [];
      if (units.length === visibleOperationalCompanies.length && units.every((unit) => unit.report?.laboratorySummary?.operational))
        return units.map((unit) => unit.report!.laboratorySummary!.operational.weightedLoad);

      // Old monthly reports can be used only when every company represented in
      // that frozen report remains visible. Otherwise their aggregate can leak
      // figures from companies outside the viewer's current scope.
      const allOperationalCompanies = [...new Set(closure.tasks.filter((task) => task.kind === "operativa").map((task) => task.companyId))];
      const canUseWholeMonthlySnapshot = !filters.companyId && allOperationalCompanies.length > 0 &&
        allOperationalCompanies.every(canAccessCompany);
      return [canUseWholeMonthlySnapshot ? closure.report?.laboratorySummary?.operational.weightedLoad ?? null : null];
    }) : [];
    // Historical coefficients are never reconstructed from movement rows: a
    // null snapshot means the complete scope was not fully parametrized.
    const operationalLoad = frozenOperationalLoads.length && frozenOperationalLoads.every((load) => load != null)
      ? Math.round(frozenOperationalLoads.reduce<number>((sum, load) => sum + load!, 0) * 100) / 100
      : null;
    const recordedSessions = new Map<string, number>();
    const addSession = (taskId: string, sessionId: string, actorId: string, start: string, end: string | null) => {
      const key = `${taskId}\u001f${sessionId}\u001f${actorId}`;
      if (!recordedSessions.has(key)) recordedSessions.set(key, Math.max(0, (Date.parse(end || snapshotDate) - Date.parse(start)) / 1000));
    };
    for (const task of tasks) for (const session of task.sessions || [])
      if (!individualOwnerId || session.actorId === individualOwnerId)
        addSession(task.id, session.id, session.actorId, session.start, session.end);
    for (const item of coveredContributions) for (const session of item.sessions)
      addSession(item.taskId, session.id, item.executorId, session.start, session.end);
    const recordedSeconds = [...recordedSessions.values()].reduce((sum, seconds) => sum + seconds, 0);
    return { period, ...values, operationalLoad, recordedSeconds,
      coverageHistory: closures.some((closure) => closure.report?.coverageSnapshotVersion !== 1) ? "legacy-not-preserved" as const : "complete" as const,
      hasScopedTasks: tasks.length > 0 || coveredContributions.length > 0 };
  }).filter((row) => row.hasScopedTasks).map(({ hasScopedTasks: _hasScopedTasks, ...row }) => row);
}
