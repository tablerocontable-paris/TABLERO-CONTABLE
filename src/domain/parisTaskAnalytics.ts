import type { Activity, Task } from "./model";
import { getParisTask, PARIS_BUSINESS_UNITS, type ParisBusinessUnitCode } from "./parisTaskCatalog";

export interface ParisTaskWorkMetric {
  key: string;
  taskCode: string | null;
  taskCatalogVersion: number | null;
  title: string;
  businessUnitCode: ParisBusinessUnitCode | null;
  businessUnitLabel: string;
  month: string;
  kind: Task["kind"];
  unit: string;
  assigned: number;
  completed: number;
  movementCount: number;
  movementQuantity: number;
  companies: string[];
  parameters: Record<string, string>;
}

/** Aggregate only recorded canonical identities; never infer codes from titles. */
export function summarizeParisTaskWork(tasks: Task[], activity: Activity[]): ParisTaskWorkMetric[] {
  const groups = new Map<string, ParisTaskWorkMetric>();
  const businessUnits = new Map(PARIS_BUSINESS_UNITS.map((row) => [row.code, row.label]));
  for (const task of tasks) {
    const taskCatalogVersion = task.taskCatalogVersion;
    const definition = task.taskCode && taskCatalogVersion ? getParisTask(task.taskCode, taskCatalogVersion) : undefined;
    const parameters = task.taskParameters || {};
    const parameterKey = JSON.stringify(Object.fromEntries(Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b))));
    const key = [task.taskCode || "unclassified", taskCatalogVersion || "unclassified", task.businessUnitCode || "unclassified", task.month, parameterKey].join("\u001f");
    const metric = groups.get(key) || {
      key,
      taskCode: definition?.code || null,
      taskCatalogVersion: definition ? taskCatalogVersion! : null,
      title: definition?.label || "Trabajo histórico sin clasificar",
      businessUnitCode: task.businessUnitCode || null,
      businessUnitLabel: task.businessUnitCode ? businessUnits.get(task.businessUnitCode) || "Unidad sin clasificar" : "Sin clasificar",
      month: task.month,
      kind: task.kind,
      unit: task.unit,
      assigned: 0,
      completed: 0,
      movementCount: 0,
      movementQuantity: 0,
      companies: [],
      parameters,
    };
    metric.assigned += 1;
    if (task.status === "Completada") metric.completed += 1;
    if (!metric.companies.includes(task.companyId)) metric.companies.push(task.companyId);
    groups.set(key, metric);
  }
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  for (const row of activity) {
    const task = taskById.get(row.taskId);
    if (!task || task.kind !== "operativa") continue;
    const parameters = task.taskParameters || {};
    const parameterKey = JSON.stringify(Object.fromEntries(Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b))));
    const key = [task.taskCode || "unclassified", task.taskCatalogVersion || "unclassified", task.businessUnitCode || "unclassified", task.month, parameterKey].join("\u001f");
    const metric = groups.get(key);
    if (!metric) continue;
    metric.movementCount += 1;
    metric.movementQuantity += row.qty;
  }
  return [...groups.values()].sort((a, b) => a.month.localeCompare(b.month) || a.title.localeCompare(b.title, "es-AR") || a.businessUnitLabel.localeCompare(b.businessUnitLabel, "es-AR") || JSON.stringify(a.parameters).localeCompare(JSON.stringify(b.parameters), "es-AR"));
}
