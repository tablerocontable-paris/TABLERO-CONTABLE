import { metrics, type State, type Closure, type Metrics } from "./model";
import { elapsedSeconds } from "./workforce";
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
}
export interface PeriodReport {
  schemaVersion: 1;
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
  return {
    schemaVersion: 1,
    generatedAt: c.at,
    employee: p.name,
    team: s.teams.find((t) => t.id === p.teamId)?.name || p.teamId,
    sector: p.sector,
    recipientIds: recipients.map((p) => p.id),
    recipientNames: recipients.map((p) => p.name),
    delivery: "disponible en demostración",
    recordedSeconds: c.tasks.reduce((n, t) => n + elapsedSeconds(t, c.at), 0),
    reopenings: c.tasks.reduce((n, t) => n + (t.reopenCount || 0), 0),
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
      metrics: metrics(tasks, c.activity),
      recordedSeconds: tasks.reduce((n, t) => n + elapsedSeconds(t, c.at), 0),
      reopenings: tasks.reduce((n, t) => n + (t.reopenCount || 0), 0),
    })),
  };
}
