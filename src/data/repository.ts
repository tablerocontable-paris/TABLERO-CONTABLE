import { z } from "zod";
import {
  id,
  currentMonth,
  dateART,
  materialize,
  type State,
  type Onboarding,
  type Task,
  type Activity,
  type Audit,
} from "../domain/model";
import { currentCatalogueVersion, ensureCatalogueVersions, pinMatchingCatalogueAssignments } from "../domain/processImprovement";
import { seedFiscalObligations } from "../domain/fiscalObligations";
import { validDate, validateSchedule, type Schedule } from "../domain/schedule";
import { calendarEventFieldsError } from "../domain/calendar-validation";

const validSnapshotInstant = (value: string) => {
  const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:0\d|1\d|2[0-3]):[0-5]\d)$/.exec(value);
  return !!match && validDate(match[1]!) && Number.isFinite(Date.parse(value));
};
import type { EvidenceBundleFile } from "./laboratoryEvidence";
export const KEY = "paris-state-v3";
export const blankOnboarding = (name = ""): Onboarding => ({
  version: 1,
  step: 0,
  completedAt: null,
  selectedCompanyIds: ["c1"],
  selectedTemplateIds: [],
  day: 25,
  frequency: "única",
  schedules: {},
  customTasks: [],
  home: "day",
  reminders: true,
  name,
  customTitle: "",
  customSteps: "",
  customKind: "resultado",
});
export function seed(): State {
  const month = currentMonth();
  const s: State = {
    version: 3,
    companies: [1, 2, 3, 4].map((n) => ({ id: "c" + n, name: "Empresa " + n })),
    teams: [
      { id: "t1", name: "Equipo de Carolina Díaz", managerId: "m1" },
      { id: "t2", name: "Equipo de Martín Acosta", managerId: "m2" },
    ],
    profiles: [
      {
        id: "boss",
        name: "Juan Pablo",
        role: "jefe",
        managerId: null,
        teamId: "",
        sector: "Dirección contable",
        branch: "San Luis Capital",
        position: "Gerente contable",
        companyIds: ["c1", "c2", "c3", "c4"],
        active: true,
      },
      ...["Carolina Díaz", "Martín Acosta"].map((name, i) => ({
        id: "m" + (i + 1),
        name,
        role: "encargado" as const,
        managerId: "boss",
        teamId: "t" + (i + 1),
        sector: i ? "Impuestos" : "Tesorería",
        branch: "San Luis Capital",
        position: "Encargado",
        companyIds: ["c1", "c2", "c3", "c4"],
        active: true,
      })),
      ...[
        "Valentino Magni",
        "Lucía Fernández",
        "Joaquín Pérez",
        "Sofía Torres",
        "Emilia Romero",
        "Nicolás Sosa",
        "Paula Ríos",
        "Agustín López",
        "Camila Vera",
        "Tomás Castro",
      ].map((name, i) => ({
        id: "e" + i,
        name,
        role: "empleado" as const,
        managerId: i < 5 ? "m1" : "m2",
        teamId: i < 5 ? "t1" : "t2",
        sector: i < 5 ? "Tesorería" : "Impuestos",
        branch: i % 2 ? "Villa Mercedes" : "San Luis Capital",
        position: i < 5 ? "Analista de tesorería" : "Analista contable",
        companyIds: ["c1", "c2", "c3", "c4"],
        active: true,
      })),
    ],
    templates: [
      {
        id: "cat1",
        title: "Conciliación Banco Nación",
        sector: "Tesorería",
        kind: "resultado",
        weight: 5,
        unit: "",
        target: 0,
        steps: [
          "Descargar extracto del período",
          "Comparar movimientos y documentar diferencias",
          "Validar conciliación",
        ],
        description:
          "Una conciliación por empresa y período, con su propia evidencia.",
      },
      {
        id: "cat2",
        title: "Liquidación y control de IVA",
        sector: "Impuestos",
        kind: "resultado",
        weight: 5,
        unit: "",
        target: 0,
        steps: [
          "Verificar comprobantes",
          "Controlar retenciones y percepciones",
          "Revisar presentación",
        ],
        description: "Control mensual y trazabilidad de la presentación.",
      },
      {
        id: "cat3",
        title: "Carga de facturas",
        sector: "Contabilidad general",
        kind: "operativa",
        weight: 3,
        unit: "facturas",
        target: 120,
        steps: [],
        description: "Registrá cantidades y referencias de cada jornada.",
      },
      {
        id: "cat4",
        title: "Control de trámites",
        sector: "Contabilidad general",
        kind: "operativa",
        weight: 2,
        unit: "trámites",
        target: 60,
        steps: [],
        description:
          "Medí controles realizados, sin dejar una tarea abierta indefinidamente.",
      },
      {
        id: "cat5",
        title: "Procesamiento de pagos",
        sector: "Tesorería",
        kind: "operativa",
        weight: 3,
        unit: "pagos",
        target: 80,
        steps: [],
        description: "Registrá pagos procesados con fecha y referencia.",
      },
      {
        id: "cat6",
        title: "Cierre de cuentas mensuales",
        sector: "Contabilidad general",
        kind: "resultado",
        weight: 5,
        unit: "",
        target: 0,
        steps: ["Controlar saldos", "Documentar ajustes", "Revisar cierre"],
        description: "Entregable de cierre de cada empresa.",
      },
    ],
    assignments: [],
    tasks: [],
    activity: [],
    audit: [],
    closures: [],
    annotations: [],
    onboarding: {},
    activeId: "boss",
    tour: {},
    tourVersion: {},
  };
  for (const [i, p] of s.profiles.entries()) {
    s.onboarding[p.id] = {
      ...blankOnboarding(p.name),
      completedAt: new Date().toISOString(),
      step: 5,
    };
    if (p.role === "jefe") continue;
    for (let j = 0; j < 6; j++) {
      let t = s.templates[j];
      s.assignments.push({
        id: id(),
        templateId: t.id,
        title: t.title,
        ownerId: p.id,
        companyId: "c" + ((j % 4) + 1),
        sector: t.sector,
        kind: t.kind,
        weight: t.weight,
        unit: t.unit,
        target: t.target,
        day: 20 + j,
        frequency: "mensual",
        steps: t.steps,
        startMonth: month,
        priority: j === 0 ? "Alta" : "Media",
      });
    }
    if (i === 3) {
      const a = s.assignments[s.assignments.length - 6];
      s.assignments.push({ ...a, id: id(), companyId: "c2" });
    }
  }
  let result = materialize(s, month);
  result.tasks = result.tasks.map((t, i) => {
    if (t.kind === "operativa") {
      result.activity.push({
        id: id(),
        taskId: t.id,
        date: month + "-18",
        qty: Math.round(t.target * (0.3 + (i % 7) / 10)),
        note: "Registro de demostración",
        actorId: t.ownerId,
        createdAt: month + "-18T15:00:00Z",
      });
      return t;
    }
    const done = i % 3 !== 0;
    return {
      ...t,
      status: done ? "Completada" : i % 2 ? "En curso" : "Pendiente",
      startedAt: month + "-10T12:00:00Z",
      completedAt: done ? month + "-19T15:00:00Z" : null,
      checklist: t.checklist.map((c, j) => ({ ...c, done: done || j === 0 })),
      blockedBy: !done && i % 4 === 0 ? "Ventas" : "",
      blockedSince: !done && i % 4 === 0 ? month + "-15" : null,
    };
  });
  return result;
}
const scheduleSchema = z.object({
  frequency: z.enum(["única", "diaria", "semanal", "mensual"]),
  startDate: z.string(), endDate: z.string(), interval: z.number().int(),
  weekdays: z.array(z.number().int()), monthDay: z.number().int(),
  hasDeadline: z.boolean(), dueOffsetDays: z.number().int(),
});
const proposalSubmissionSchema = z.object({
  revision: z.number().int().positive(), title: z.string().min(1).max(120),
  process: z.string().max(160), description: z.string().min(1).max(1000),
  kind: z.enum(["resultado", "operativa"]), unit: z.string().max(40),
  target: z.number().nonnegative(), schedule: scheduleSchema,
  steps: z.array(z.string().min(1).max(300)).max(50), submittedAt: z.string(),
});
const jointResponsibilitySnapshotSchema = z.object({
  version: z.literal(1), revision: z.literal(1), mode: z.literal("joint"),
  activatedAt: z.string().min(1), activatedBy: z.string().min(1), reason: z.string().min(1).max(500),
  members: z.tuple([
    z.object({ profileId: z.string().min(1), shareBps: z.number().int().positive(), name: z.string(), teamId: z.string(), sector: z.string() }),
    z.object({ profileId: z.string().min(1), shareBps: z.number().int().positive(), name: z.string(), teamId: z.string(), sector: z.string() }),
  ]).refine((members) => members[0].profileId !== members[1].profileId && members[0].shareBps + members[1].shareBps === 10000),
});
const snapshotTaskSchema = z.object({
  id: z.string().min(1), ownerId: z.string().min(1), companyId: z.string().min(1),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), kind: z.enum(["resultado", "operativa"]),
  weight: z.number().finite().nonnegative(),
  due: z.string().optional(), availableFrom: z.string().nullable().optional(),
  dependsOnTaskIds: z.array(z.string().min(1)).optional(),
  commercialTrackingEnabled: z.boolean().optional(),
  commercialProgress: z.object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    throughDay: z.number().int().min(0).max(30),
    updatedAt: z.string().min(1), updatedBy: z.string().min(1),
  }).nullable().optional(),
  evidenceIds: z.array(z.string().min(1)).optional(),
  sessions: z.array(z.object({ id: z.string().min(1), actorId: z.string().min(1), start: z.string().min(1), end: z.string().nullable() })).optional(),
  responsibility: jointResponsibilitySnapshotSchema.optional(),
}).passthrough().superRefine((task, context) => {
  if (task.due !== undefined && task.due !== "" && !validDate(task.due))
    context.addIssue({ code: "custom", path: ["due"], message: "El vencimiento de la tarea congelada debe ser una fecha real." });
  if (task.availableFrom !== undefined && task.availableFrom !== null &&
      (!validDate(task.availableFrom) || task.availableFrom.slice(0, 7) !== task.month))
    context.addIssue({ code: "custom", path: ["availableFrom"], message: "Las fechas de la tarea congelada deben ser reales y corresponder al período." });
  if (task.commercialProgress && (task.commercialProgress.month !== task.month || !validSnapshotInstant(task.commercialProgress.updatedAt)))
    context.addIssue({ code: "custom", path: ["commercialProgress"], message: "El seguimiento comercial congelado debe conservar período y fecha válidos." });
  if (task.dependsOnTaskIds && new Set(task.dependsOnTaskIds).size !== task.dependsOnTaskIds.length)
    context.addIssue({ code: "custom", path: ["dependsOnTaskIds"], message: "Las dependencias congeladas no pueden repetirse." });
});
const snapshotActivitySchema = z.object({
  id: z.string().min(1), taskId: z.string().min(1), actorId: z.string().min(1),
  date: z.string().min(1), qty: z.number().finite().positive(),
  evidenceIds: z.array(z.string().min(1)).optional(),
  operationalRateId: z.string().nullable().optional(), operationalUnitWeight: z.number().finite().positive().nullable().optional(),
}).passthrough().superRefine((activity, context) => {
  if (!validDate(activity.date))
    context.addIssue({ code: "custom", path: ["date"], message: "El movimiento congelado debe conservar una fecha real." });
});
const snapshotMetricsSchema = z.object({
  assigned: z.number().finite().nonnegative(), done: z.number().finite().nonnegative(),
  points: z.number().finite().nonnegative(), earned: z.number().finite().nonnegative(),
  weighted: z.number().finite().min(0).max(100).nullable(), onTime: z.number().finite().min(0).max(100).nullable(),
  late: z.number().finite().nonnegative(), blocked: z.number().finite().nonnegative(),
  operational: z.number().finite().nonnegative(), operationalTarget: z.number().finite().nonnegative(),
}).passthrough();
const operationalSummarySchema = z.object({
  movementCount: z.number().finite().nonnegative(),
  quantityByUnit: z.array(z.object({ unit: z.string(), quantity: z.number().finite().nonnegative() })),
  weightedLoad: z.number().finite().nonnegative().nullable(), unweightedQuantity: z.number().finite().nonnegative(),
  recordedSeconds: z.number().finite().nonnegative(), quality: z.number().finite().min(0).max(100).nullable(),
  order: z.number().finite().min(0).max(100).nullable(), timeliness: z.number().finite().min(0).max(100).nullable(),
  evaluations: z.number().int().nonnegative(),
});
const reportContributionSchema = z.object({
  taskId: z.string().min(1), title: z.string(), shareBps: z.number().finite().min(0).max(10000),
  possiblePoints: z.number().finite().nonnegative(), earnedPoints: z.number().finite().nonnegative(),
  recordedSeconds: z.number().finite().nonnegative(),
});
const coveredContributionSchema = z.object({
  version: z.literal(1), taskSnapshot: snapshotTaskSchema,
  executorId: z.string().min(1), originalOwnerId: z.string().min(1), companyId: z.string().min(1),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  sessions: z.array(z.object({ id: z.string().min(1), actorId: z.string().min(1), start: z.string().min(1), end: z.string().nullable() })),
  activity: z.array(snapshotActivitySchema), completionAt: z.string().nullable(),
});
const coverageReportContributionSchema = z.object({
  taskId: z.string().min(1), title: z.string(), companyId: z.string().min(1), company: z.string(),
  originalOwnerId: z.string().min(1), originalOwner: z.string(), executorId: z.string().min(1), executor: z.string(),
  executorTeamId: z.string(), sector: z.string(), kind: z.enum(["resultado", "operativa"]), unit: z.string(),
  sessions: z.array(z.object({ id: z.string().min(1), start: z.string().min(1), end: z.string().nullable() })),
  activity: z.array(z.object({ id: z.string().min(1), date: z.string(), qty: z.number().finite().positive(), note: z.string() })),
  completionAt: z.string().nullable(),
});
const periodReportSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]), generatedAt: z.string().min(1),
  employee: z.string(), team: z.string(), sector: z.string(), recipientIds: z.array(z.string()), recipientNames: z.array(z.string()),
  delivery: z.literal("disponible en demostración"),
  groups: z.array(z.object({
    key: z.string(), company: z.string(), process: z.string(), templateId: z.string().nullable(),
    kind: z.enum(["resultado", "operativa"]), unit: z.string(), metrics: snapshotMetricsSchema,
    recordedSeconds: z.number().finite().nonnegative(), reopenings: z.number().finite().nonnegative(),
    contributions: z.array(reportContributionSchema).optional(), operationalSummary: operationalSummarySchema.optional(),
  })),
  recordedSeconds: z.number().finite().nonnegative(), reopenings: z.number().finite().nonnegative(),
  profileId: z.string().optional(), contributions: z.array(reportContributionSchema).optional(),
  transfers: z.array(z.object({ taskId: z.string(), title: z.string(), formerOwner: z.string(), newOwner: z.string(), reason: z.string(), transferredAt: z.string() })).optional(),
  algorithm: z.literal("joint-lab-v1").optional(),
  laboratorySummary: z.object({ operational: operationalSummarySchema, covered: operationalSummarySchema.pick({
    movementCount: true, quantityByUnit: true, weightedLoad: true, unweightedQuantity: true, recordedSeconds: true,
  }) }).optional(),
  coverageContributions: z.array(coverageReportContributionSchema).optional(),
});
const companyClosureSchema = z.object({
  id: z.string().min(1), ownerId: z.string().min(1), companyId: z.string().min(1),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), at: z.string().min(1), by: z.string().min(1),
  note: z.string().max(1000), metrics: snapshotMetricsSchema, tasks: z.array(snapshotTaskSchema),
  activity: z.array(snapshotActivitySchema), coveredActivity: z.array(snapshotActivitySchema), report: periodReportSchema.optional(),
  coveredContributions: z.array(coveredContributionSchema).optional(),
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
}).passthrough().superRefine((closure, context) => {
  const taskIds = new Set(closure.tasks.map((task) => task.id));
  closure.tasks.forEach((task, index) => {
    if (task.companyId !== closure.companyId || task.month !== closure.month)
      context.addIssue({ code: "custom", path: ["tasks", index], message: "La tarea congelada debe pertenecer a la empresa y período del cierre." });
  });
  closure.activity.forEach((row, index) => {
    if (!taskIds.has(row.taskId) || !row.date.startsWith(closure.month))
      context.addIssue({ code: "custom", path: ["activity", index], message: "El movimiento debe pertenecer a una tarea y período incluidos en el cierre." });
  });
  closure.coveredActivity.forEach((row, index) => {
    if (!row.date.startsWith(closure.month))
      context.addIssue({ code: "custom", path: ["coveredActivity", index], message: "El movimiento de cobertura debe corresponder al período cerrado." });
  });
  if (closure.schemaVersion === 2 && !closure.coveredContributions)
    context.addIssue({ code: "custom", path: ["coveredContributions"], message: "El cierre de versión 2 debe conservar sus contribuciones de cobertura, aunque estén vacías." });
  (closure.coveredContributions || []).forEach((entry, index) => {
    const task = entry.taskSnapshot;
    if (entry.executorId !== closure.ownerId || entry.originalOwnerId !== task.ownerId || task.ownerId === entry.executorId ||
        entry.companyId !== closure.companyId || entry.month !== closure.month || task.companyId !== closure.companyId || task.month !== closure.month ||
        (!entry.sessions.length && !entry.activity.length && !entry.completionAt))
      context.addIssue({ code: "custom", path: ["coveredContributions", index], message: "La contribución debe identificar a titular, ejecutor, empresa, período y trabajo real de cobertura." });
    entry.sessions.forEach((session, sessionIndex) => {
      if (session.actorId !== entry.executorId || !validSnapshotInstant(session.start) || session.end === null || !validSnapshotInstant(session.end))
        context.addIssue({ code: "custom", path: ["coveredContributions", index, "sessions", sessionIndex], message: "La sesión debe pertenecer al ejecutor y conservar fechas válidas." });
    });
    entry.activity.forEach((row, activityIndex) => {
      if (row.taskId !== task.id || row.actorId !== entry.executorId || !row.date.startsWith(entry.month) || !validDate(row.date) || typeof row.createdAt !== "string" || !validSnapshotInstant(row.createdAt))
        context.addIssue({ code: "custom", path: ["coveredContributions", index, "activity", activityIndex], message: "El movimiento debe pertenecer al ejecutor, tarea y período congelados." });
    });
    if (entry.completionAt && (!validSnapshotInstant(entry.completionAt) || task.completedBy !== entry.executorId || task.completedAt !== entry.completionAt))
      context.addIssue({ code: "custom", path: ["coveredContributions", index, "completionAt"], message: "La finalización debe conservar su fecha y ejecutor reales." });
    if (task.sessions?.some((session) => session.actorId !== entry.executorId) || task.evidenceIds?.some((evidenceId) =>
        !(closure.report?.coverageContributions || []).some((reportEntry) => reportEntry.taskId === task.id && reportEntry.executorId === entry.executorId)))
      context.addIssue({ code: "custom", path: ["coveredContributions", index, "taskSnapshot"], message: "El snapshot de cobertura no puede incorporar sesiones o evidencia de terceros." });
  });
});
const closureSchema = z.object({
  id: z.string().min(1), ownerId: z.string().min(1), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  at: z.string().min(1), by: z.string().min(1), note: z.string().max(1000), metrics: snapshotMetricsSchema,
  tasks: z.array(snapshotTaskSchema), activity: z.array(snapshotActivitySchema),
  report: periodReportSchema.optional(), taskTransfers: z.array(z.unknown()).optional(),
}).passthrough().superRefine((closure, context) => {
  const taskIds = new Set(closure.tasks.map((task) => task.id));
  closure.tasks.forEach((task, index) => {
    if (task.month !== closure.month)
      context.addIssue({ code: "custom", path: ["tasks", index, "month"], message: "La tarea congelada debe pertenecer al período del cierre mensual." });
  });
  closure.activity.forEach((row, index) => {
    if (!taskIds.has(row.taskId) || !row.date.startsWith(closure.month))
      context.addIssue({ code: "custom", path: ["activity", index], message: "El movimiento debe pertenecer a una tarea y período incluidos en el cierre mensual." });
  });
});
const schema = z.object({
  version: z.literal(3),
  labRevision: z.string().optional(),
  boardOrder: z.enum(["original", "az", "za"]).optional(),
  companies: z.array(z.object({ id: z.string().min(1), name: z.string().min(1).max(200) })).max(1000),
  profiles: z.array(
    z
      .object({
        id: z.string().min(1),
        name: z.string().min(1).max(200),
        role: z.enum(["jefe", "encargado", "empleado"]),
        active: z.boolean(), managerId: z.string().nullable(), teamId: z.string().max(120),
        sector: z.string().max(160), branch: z.string().max(160), position: z.string().max(160),
        companyIds: z.array(z.string().min(1)).max(1000), email: z.string().max(320).optional(),
      })
      .passthrough(),
  ).max(500),
  tasks: z.array(
    z
      .object({
        id: z.string().min(1),
        companyId: z.string(),
        ownerId: z.string(),
        title: z.string().min(1).max(240),
        month: z.string(),
        status: z.enum(["Pendiente", "En curso", "Completada"]),
        weight: z.number().nonnegative(),
        unit: z.string().max(80),
        priority: z.enum(["Alta", "Media", "Baja"]),
        scheduledOn: z.string().optional(),
        completedBy: z.string().optional(),
        originRequestId: z.string().optional(),
        dependsOnTaskIds: z.array(z.string().min(1)).optional(),
        availableFrom: z.string().nullable().optional(),
        commercialTrackingEnabled: z.boolean().optional(),
        commercialProgress: z.object({
          month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
          throughDay: z.number().int().min(0).max(30),
          updatedAt: z.string().min(1), updatedBy: z.string().min(1),
        }).nullable().optional(),
        evidenceIds: z.array(z.string().min(1)).optional(),
        kind: z.enum(["resultado", "operativa"]),
        checklist: z.array(
          z.object({ id: z.string(), text: z.string(), done: z.boolean() }),
        ),
        responsibility: z.object({
          version: z.literal(1), revision: z.literal(1), mode: z.literal("joint"),
          activatedAt: z.string(), activatedBy: z.string(), reason: z.string().min(1).max(500),
          members: z.tuple([
            z.object({ profileId: z.string(), shareBps: z.number().int().positive(), name: z.string(), teamId: z.string(), sector: z.string() }),
            z.object({ profileId: z.string(), shareBps: z.number().int().positive(), name: z.string(), teamId: z.string(), sector: z.string() }),
          ]).refine((members) => members[0].profileId !== members[1].profileId && members[0].shareBps + members[1].shareBps === 10000),
        }).optional(),
      })
      .passthrough(),
  ),
  activity: z.array(
    z
      .object({
        id: z.string(),
        taskId: z.string(),
        qty: z.number().positive(),
        date: z.string(),
      })
      .passthrough(),
  ),
  assignments: z.array(z.object({ id: z.string().min(1), ownerId: z.string().min(1), companyId: z.string().min(1), templateId: z.string().nullable().optional() }).passthrough()).max(10000),
  teams: z.array(z.object({ id: z.string().min(1), name: z.string().min(1).max(200), managerId: z.string().min(1) }).passthrough()).max(1000),
  templates: z.array(z.object({ id: z.string().min(1), title: z.string().min(1).max(240), kind: z.enum(["resultado", "operativa"]) }).passthrough()).max(2000),
  catalogueVersions: z.array(z.object({
    id: z.string(), templateId: z.string(), version: z.number().int().positive(),
    title: z.string(), sector: z.string(), kind: z.enum(["resultado", "operativa"]),
    weight: z.number().nonnegative(), unit: z.string(), target: z.number().nonnegative(),
    steps: z.array(z.string()), description: z.string(), capturedAt: z.string(),
    effectiveOn: z.string().nullable(), createdBy: z.string().nullable(),
    source: z.enum(["initial_snapshot", "catalog_change", "kaizen_adoption", "legacy_reconciliation"]),
    changeReason: z.string().min(1).max(500), sourceProposalId: z.string().optional(),
  })).optional(),
  improvementProposals: z.array(z.object({
    id: z.string(), templateId: z.string(), companyId: z.string(), templateTitle: z.string(),
    problemObserved: z.string().min(1).max(1200), baselineValue: z.number().nonnegative(),
    objectiveValue: z.number().nonnegative(), unit: z.string().min(1).max(40),
    direction: z.enum(["lower", "higher"]), baselineEvidence: z.string().min(1).max(2000),
    baselineContext: z.string().min(1).max(1200), proposedChange: z.string().min(1).max(1600),
    responsibleId: z.string(), proposedBy: z.string(), proposedAt: z.string(),
    trialFrom: z.string(), trialThrough: z.string(),
    status: z.enum(["proposed", "testing", "measured", "adopted", "rejected"]),
    reviewNote: z.string().optional(), reviewedBy: z.string().optional(), reviewedAt: z.string().optional(),
    afterValue: z.number().nonnegative().optional(), afterEvidence: z.string().optional(),
    afterContext: z.string().optional(), measuredOn: z.string().optional(), measuredBy: z.string().optional(),
    decisionNote: z.string().optional(), decidedBy: z.string().optional(), decidedAt: z.string().optional(),
    adoptedVersion: z.number().int().positive().optional(),
  })).optional(),
  fiveSReviews: z.array(z.object({
    id: z.string(), companyId: z.string(), templateId: z.string().nullable(), scopeTitle: z.string().min(1).max(120),
    reviewedOn: z.string(), createdAt: z.string(), createdBy: z.string(),
    items: z.array(z.object({
      id: z.enum(["classify", "order", "clean", "standardize", "sustain"]),
      result: z.enum(["conforme", "hallazgo", "no_aplica"]),
      evidence: z.string().min(1).max(1200), finding: z.string().min(1).max(800), action: z.string().min(1).max(800),
      responsibleId: z.string(), dueOn: z.string(), status: z.enum(["open", "done"]),
      completionEvidence: z.string().optional(), completedOn: z.string().optional(), completedBy: z.string().optional(),
    })).length(5),
  })).optional(),
  fiscalObligations: z.array(z.object({
    id: z.string(), companyId: z.string(), obligationCode: z.string().min(2).max(80),
    title: z.string().min(1).max(120), fiscalPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    milestone: z.enum(["presentation", "payment", "closing", "documentation"]),
    dueOn: z.string(), sourceLabel: z.string().min(1).max(160),
    sourceRevision: z.string().min(1).max(80), sourceCheckedAt: z.string().nullable(),
    revision: z.number().int().positive(), evaluationVersion: z.union([z.literal(1), z.literal(2)]).optional(), requiredTaskIds: z.array(z.string()),
    createdAt: z.string(), createdBy: z.string().nullable(), updatedAt: z.string(),
    history: z.array(z.object({
      revision: z.number().int().positive(), evaluationVersion: z.union([z.literal(1), z.literal(2)]).optional(), at: z.string(), by: z.string(),
      reason: z.string().min(5).max(500), dueOn: z.string(),
      sourceLabel: z.string().min(1).max(160), sourceRevision: z.string().min(1).max(80),
      sourceCheckedAt: z.string().nullable(), requiredTaskIds: z.array(z.string()),
    })),
  })).optional(),
  habitualTaskProposals: z.array(z.object({
    id: z.string().min(1), ownerId: z.string().min(1), companyId: z.string().min(1),
    originalTitle: z.string().min(1).max(120), title: z.string().min(1).max(120),
    process: z.string().max(160), description: z.string().min(1).max(1000),
    kind: z.enum(["resultado", "operativa"]), unit: z.string().max(40),
    target: z.number().nonnegative(), schedule: scheduleSchema,
    steps: z.array(z.string().min(1).max(300)).max(50),
    revision: z.number().int().positive(), submittedAt: z.string(), updatedAt: z.string(),
    status: z.enum(["pending", "changes_requested", "approved"]), managerNote: z.string().max(500).optional(),
    templateId: z.string().optional(), templateVersion: z.number().int().positive().optional(),
    submissions: z.array(proposalSubmissionSchema).min(1),
    history: z.array(z.object({
      id: z.string(), by: z.string(),
      action: z.enum(["submitted", "changes_requested", "resubmitted", "approved"]),
      note: z.string().max(500), at: z.string(), templateId: z.string().optional(),
      templateVersion: z.number().int().positive().optional(),
    })),
  })).optional(),
  operationalRates: z.array(z.object({
    id: z.string().min(1), templateId: z.string().nullable(), taskId: z.string().nullable(),
    companyId: z.string().min(1), effectiveOn: z.string(), unitWeight: z.number().finite().positive().max(1_000_000),
    version: z.number().int().positive(), createdAt: z.string(), createdBy: z.string().min(1),
  })).optional(),
  operationalAssessments: z.array(z.object({
    id: z.string().min(1), taskId: z.string().min(1), profileId: z.string().min(1), companyId: z.string().min(1),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    quality: z.number().int().min(0).max(100), order: z.number().int().min(0).max(100),
    timeliness: z.number().int().min(0).max(100), note: z.string().min(5).max(1000),
    evaluatedAt: z.string(), evaluatedBy: z.string().min(1),
  })).optional(),
  calendarEvents: z.array(z.object({
    id: z.string().min(1), revision: z.number().int().positive(), authorId: z.string().min(1),
    companyId: z.string().nullable(), kind: z.enum(["balance_close", "audit", "important", "custom"]),
    title: z.string().min(1).max(120), description: z.string().max(1000), startOn: z.string(), endOn: z.string(),
    recipientIds: z.array(z.string().min(1)), linkedTaskId: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
    cancelledAt: z.string().nullable(), cancelledBy: z.string().nullable(),
  })).optional(),
  calendarNotices: z.array(z.object({
    id: z.string().min(1), eventId: z.string().min(1), revision: z.number().int().positive(),
    recipientId: z.string().min(1), actorId: z.string().min(1), kind: z.enum(["created", "changed", "cancelled"]),
    createdAt: z.string(), readAt: z.string().nullable(),
  })).optional(),
  companyClosures: z.array(companyClosureSchema).optional(),
  taskEvidence: z.array(z.object({
    id: z.string().min(1), taskId: z.string().min(1), activityId: z.string().nullable(), profileId: z.string().min(1),
    completionAt: z.string().datetime({ offset: true }).nullable().optional(),
    name: z.string().min(1).max(240), mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
    size: z.number().int().positive().max(10 * 1024 * 1024), sha256: z.string().regex(/^[a-f0-9]{64}$/), createdAt: z.string(),
  })).optional(),
  closures: z.array(closureSchema),
  audit: z.array(z.object({
    id: z.string().min(1), at: z.string(), actorId: z.string().min(1),
    action: z.string().min(1), entityId: z.string().min(1),
  }).passthrough()),
  annotations: z
    .array(
      z.object({
        id: z.string(),
        ownerId: z.string(),
        title: z.string(),
        content: z.string(),
        kind: z.enum(["personal", "formula", "reminder"]),
        category: z.string().max(40).optional(),
        reminderOn: z.string().nullable(),
        createdAt: z.string(),
        updatedAt: z.string(),
        convertedTaskId: z.string().nullable(),
      }),
    )
    .optional(),
  onboarding: z.record(z.string(), z.object({
    version: z.number().int().positive(), step: z.number().int().min(0), completedAt: z.string().nullable(),
    selectedCompanyIds: z.array(z.string().min(1)).max(1000), selectedTemplateIds: z.array(z.string().min(1)).max(2000),
    day: z.number().int().min(1).max(31), frequency: z.enum(["única", "diaria", "semanal", "mensual"]),
    home: z.enum(["day", "tasks"]), reminders: z.boolean(), name: z.string(), customTitle: z.string(),
    customSteps: z.string(), customKind: z.enum(["resultado", "operativa"]),
    schedules: z.record(z.string(), scheduleSchema).optional(),
    companySchedules: z.record(z.string(), z.record(z.string(), scheduleSchema)).optional(),
    companyTargets: z.record(z.string(), z.record(z.string(), z.number().nonnegative())).optional(),
    assignmentCompanyIds: z.record(z.string(), z.array(z.string().min(1))).optional(),
    customTasks: z.array(z.object({ id: z.string().min(1), title: z.string().min(1), steps: z.string(), kind: z.enum(["resultado", "operativa"]), unit: z.string(), target: z.number().nonnegative() })).optional(),
    habitualTaskProposals: z.array(z.object({
      id: z.string().min(1), starterId: z.string().regex(/^starter-suggestion-v2-[a-z0-9-]+$/).optional(),
      title: z.string(), process: z.string(), description: z.string(), kind: z.enum(["resultado", "operativa"]),
      unit: z.string(), steps: z.array(z.string()), companyIds: z.array(z.string().min(1)),
    })).optional(),
    habitualProposalForm: z.object({ title: z.string(), process: z.string(), description: z.string(), kind: z.enum(["resultado", "operativa"]), unit: z.string(), steps: z.array(z.string()) }).optional(),
  }).passthrough()),
  parameterReviews: z.record(z.string(), z.object({ onboardingCompletedAt: z.string(), reviewedAt: z.string(), reviewedBy: z.string() })).optional(),
  notifications: z.array(z.object({
    id: z.string(), recipientId: z.string(), actorId: z.string(), taskId: z.string(),
    title: z.string(), kind: z.enum(['assigned', 'completed', 'changed', 'comment', 'joint']),
    createdAt: z.string(), readAt: z.string().nullable(),
  })).optional(),
  deadlineReminderReads: z.record(z.string(), z.string()).optional(),
  internalRequests: z.array(z.object({
    id: z.string(), kind: z.enum(["technical_error", "work_request", "suggestion"]),
    authorId: z.string(), recipientId: z.string(), urgency: z.enum(["low", "medium", "high", "urgent"]),
    module: z.string().min(1).max(80), subject: z.string().min(1).max(120),
    description: z.string().min(1).max(4000), status: z.enum(["new", "review", "responded", "resolved"]),
    createdAt: z.string(), updatedAt: z.string(),
    messages: z.array(z.object({ id: z.string(), actorId: z.string(), body: z.string().min(1).max(4000), createdAt: z.string() })),
    history: z.array(z.object({ id: z.string(), actorId: z.string(), status: z.enum(["new", "review", "responded", "resolved"]), note: z.string().max(200), createdAt: z.string() })),
    convertedTaskId: z.string().optional(), convertedBy: z.string().optional(), convertedAt: z.string().optional(),
  })).optional(),
  taskComments: z.array(z.object({ id: z.string(), taskId: z.string(), actorId: z.string(),
    content: z.string().max(2000), createdAt: z.string(),
  })).optional(),
  jointReceipts: z.array(z.object({ requestId: z.string(), actorId: z.string(), taskId: z.string(),
    body: z.string(), revision: z.number().int().positive(), acknowledgedAt: z.string(),
  })).optional(),
  activeId: z.string(),
  absences: z.array(z.object({
    id: z.string(), ownerId: z.string(), replacementId: z.string(),
    from: z.string(), to: z.string(), kind: z.enum(["Vacaciones", "Licencia"]),
    note: z.string(), createdBy: z.string(), taskIds: z.array(z.string()).optional(),
    assignmentIds: z.array(z.string()).optional(),
    cancelledAt: z.string().optional(),
  })).optional(),
  orphanedWork: z.array(z.object({
    id: z.string(), taskId: z.string(), formerOwnerId: z.string(), formerOwnerName: z.string(),
    companyId: z.string(), assignmentSnapshot: z.object({
      id: z.string(), title: z.string(), templateId: z.string().nullable(),
      frequency: z.enum(["única", "diaria", "mensual", "semanal", "quincenal"]),
      schedule: z.unknown().optional(),
    }).nullable(), reason: z.string().min(5).max(500), createdAt: z.string(),
    resolution: z.enum(["ready", "handoff_required", "review_required"]),
    status: z.enum(["pending", "reassigned", "transferred"]), resolvedAt: z.string().optional(),
    resolvedBy: z.string().optional(), assignedTo: z.string().optional(),
  })).optional(),
  taskTransfers: z.array(z.object({
    id: z.string(), taskId: z.string(), formerOwnerId: z.string(), formerOwnerName: z.string(),
    newOwnerId: z.string(), newOwnerName: z.string(), companyId: z.string(),
    reason: z.string().min(5).max(500), transferredAt: z.string(), transferredBy: z.string(),
    taskSnapshot: z.object({ id: z.string(), ownerId: z.string(), companyId: z.string(), status: z.enum(["Pendiente", "En curso", "Completada"]) }).passthrough(),
    sessions: z.array(z.object({ id: z.string(), actorId: z.string(), start: z.string(), end: z.string().nullable() })),
    activity: z.array(z.object({ id: z.string(), taskId: z.string(), actorId: z.string(), date: z.string(), qty: z.number(), note: z.string(), createdAt: z.string() })),
    comments: z.array(z.object({ id: z.string(), taskId: z.string(), actorId: z.string(), content: z.string().max(2000), createdAt: z.string() })),
  })).optional(),
  tour: z.record(z.string(), z.number()),
  tourVersion: z.record(z.string(), z.number()).optional(),
  tourStepId: z.record(z.string(), z.string()).optional(),
}).superRefine((state, context) => {
  const unique = (rows: Array<{ id: string }>, path: string) => {
    if (new Set(rows.map((row) => row.id)).size !== rows.length)
      context.addIssue({ code: "custom", path: [path], message: "Los identificadores deben ser únicos." });
  };
  unique(state.companies, "companies"); unique(state.profiles, "profiles"); unique(state.teams, "teams");
  unique(state.templates, "templates"); unique(state.assignments, "assignments"); unique(state.tasks, "tasks");
  const profileById = new Map(state.profiles.map((profile) => [profile.id, profile]));
  const teamIds = new Set(state.teams.map((team) => team.id));
  const companyIds = new Set(state.companies.map((company) => company.id));
  state.profiles.forEach((profile, index) => {
    if (new Set(profile.companyIds).size !== profile.companyIds.length || profile.companyIds.some((companyId) => !companyIds.has(companyId)))
      context.addIssue({ code: "custom", path: ["profiles", index, "companyIds"], message: "Cada empresa del perfil debe existir y aparecer una sola vez." });
    if (profile.teamId && !teamIds.has(profile.teamId))
      context.addIssue({ code: "custom", path: ["profiles", index, "teamId"], message: "El equipo del perfil no existe." });
    if (profile.managerId && !profileById.has(profile.managerId))
      context.addIssue({ code: "custom", path: ["profiles", index, "managerId"], message: "El superior del perfil no existe." });
  });
  state.teams.forEach((team, index) => {
    if (!profileById.has(team.managerId)) context.addIssue({ code: "custom", path: ["teams", index, "managerId"], message: "El responsable del equipo no existe." });
  });
  const completed = new Set<string>();
  for (const profile of state.profiles) {
    const path = new Set<string>();
    let cursor: typeof profile | undefined = profile;
    while (cursor?.managerId) {
      if (path.has(cursor.id)) {
        context.addIssue({ code: "custom", path: ["profiles"], message: `La jerarquía contiene un ciclo que incluye ${cursor.id}.` });
        break;
      }
      if (completed.has(cursor.id)) break;
      path.add(cursor.id);
      cursor = profileById.get(cursor.managerId);
    }
    path.forEach((id) => completed.add(id));
  }
  state.assignments.forEach((assignment, index) => {
    const owner = profileById.get(assignment.ownerId);
    if (!owner || !companyIds.has(assignment.companyId) || (assignment.templateId && !state.templates.some((template) => template.id === assignment.templateId)))
      context.addIssue({ code: "custom", path: ["assignments", index], message: "La asignación debe referenciar responsable, empresa y catálogo existentes." });
    const schedule = (assignment as { schedule?: unknown }).schedule;
    const validFrequencies = ["única", "diaria", "semanal", "mensual"];
    const rawAssignment = assignment as unknown as Record<string, unknown>;
    const day = rawAssignment.day;
    if (!validFrequencies.includes(typeof rawAssignment.frequency === "string" ? rawAssignment.frequency : "") ||
      typeof rawAssignment.startMonth !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(rawAssignment.startMonth) ||
      !Number.isInteger(day) || (day as number) < 1 || (day as number) > 31)
      context.addIssue({ code: "custom", path: ["assignments", index], message: "La frecuencia, período inicial y día de la asignación deben ser válidos." });
    if (schedule !== undefined) {
      try {
        const candidate = schedule as Schedule;
        if (!validFrequencies.includes(candidate.frequency) ||
          (candidate.frequency === "semanal" && new Set(candidate.weekdays).size !== candidate.weekdays.length))
          throw new Error("Frecuencia inválida");
        validateSchedule(candidate);
      }
      catch { context.addIssue({ code: "custom", path: ["assignments", index, "schedule"], message: "La frecuencia y las fechas de la asignación no son válidas." }); }
    }
  });
  const validInstant = (value: string) => {
    const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:0\d|1\d|2[0-3]):[0-5]\d)$/.exec(value);
    return !!match && validDate(match[1]!) && Number.isFinite(Date.parse(value));
  };
  const taskById = new Map(state.tasks.map((task) => [task.id, task]));
  for (const [index, rawTask] of state.tasks.entries()) {
    const task = rawTask as unknown as Task;
    const owner = profileById.get(task.ownerId);
    const assignment = task.assignmentId ? state.assignments.find((entry) => entry.id === task.assignmentId) : undefined;
    if (!owner || !companyIds.has(task.companyId) || !teamIds.has(task.teamId))
      context.addIssue({ code: "custom", path: ["tasks", index], message: "La tarea requiere una persona, empresa y equipo existentes y coherentes." });
    if (task.assignmentId && (!assignment || assignment.companyId !== task.companyId))
      context.addIssue({ code: "custom", path: ["tasks", index, "assignmentId"], message: "La tarea debe conservar la asignación de origen correspondiente." });
    if (task.templateId && !state.templates.some((template) => template.id === task.templateId))
      context.addIssue({ code: "custom", path: ["tasks", index, "templateId"], message: "La tarea referencia un catálogo inexistente." });
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(task.month) || (task.due !== "" && !validDate(task.due)))
      context.addIssue({ code: "custom", path: ["tasks", index, "due"], message: "El período y vencimiento de la tarea deben ser válidos." });
    if (task.completedBy && !profileById.has(task.completedBy))
      context.addIssue({ code: "custom", path: ["tasks", index, "completedBy"], message: "La autoría de finalización debe corresponder a un perfil existente." });
    if ((task.startedAt !== null && task.startedAt !== undefined && !validInstant(task.startedAt)) ||
      (task.completedAt !== null && task.completedAt !== undefined && !validInstant(task.completedAt)) ||
      (task.sessions || []).some((session) => !validInstant(session.start) || (session.end !== null && !validInstant(session.end))))
      context.addIssue({ code: "custom", path: ["tasks", index], message: "La tarea debe conservar fechas de inicio, cierre y cronómetro válidas." });
    if (task.originRequestId && !state.internalRequests?.some((request) => request.id === task.originRequestId))
      context.addIssue({ code: "custom", path: ["tasks", index, "originRequestId"], message: "La tarea debe conservar su solicitud de origen." });
    const dependencies = task.dependsOnTaskIds || [];
    if (new Set(dependencies).size !== dependencies.length || dependencies.includes(task.id))
      context.addIssue({ code: "custom", path: ["tasks", index, "dependsOnTaskIds"], message: "Las dependencias no pueden repetirse ni apuntar a la propia tarea." });
    for (const dependencyId of dependencies) {
      const dependency = taskById.get(dependencyId);
      if (!dependency || dependency.kind !== "resultado" || dependency.companyId !== task.companyId || dependency.month !== task.month || dependency.responsibility)
        context.addIssue({ code: "custom", path: ["tasks", index, "dependsOnTaskIds"], message: "Cada dependencia debe ser un entregable individual de la misma empresa y período." });
    }
    if (task.availableFrom && (!validDate(task.availableFrom) || task.availableFrom.slice(0, 7) !== task.month))
      context.addIssue({ code: "custom", path: ["tasks", index, "availableFrom"], message: "La fecha de disponibilidad debe pertenecer al período y ser una fecha real." });
    if (task.commercialProgress && task.commercialProgress.month !== task.month)
      context.addIssue({ code: "custom", path: ["tasks", index, "commercialProgress"], message: "El seguimiento comercial debe corresponder al período de la tarea." });
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  const visitDependency = (taskId: string): boolean => {
    if (visiting.has(taskId)) return false;
    if (visited.has(taskId)) return true;
    visiting.add(taskId);
    const task = taskById.get(taskId);
    for (const dependencyId of task?.dependsOnTaskIds || []) if (!visitDependency(dependencyId)) return false;
    visiting.delete(taskId);
    visited.add(taskId);
    return true;
  };
  for (const task of state.tasks) if (!visitDependency(task.id)) {
    context.addIssue({ code: "custom", path: ["tasks"], message: "El respaldo contiene dependencias cíclicas." });
    break;
  }
  const historicalTasks = [
    ...state.closures.flatMap((closure) => closure.tasks),
    ...(state.companyClosures || []).flatMap((closure) => closure.tasks),
    ...(state.companyClosures || []).flatMap((closure) => (closure.coveredContributions || []).map((entry) => entry.taskSnapshot)),
    ...(state.taskTransfers || []).map((transfer) => transfer.taskSnapshot),
  ];
  const allTaskIds = new Set([...state.tasks, ...historicalTasks].map((task) => task.id));
  const allTasksById = new Map([...historicalTasks, ...state.tasks].map((task) => [task.id, task as unknown as Task]));
  const historicalTasksById = new Map(historicalTasks.map((task) => [task.id, task as unknown as Task]));
  historicalTasks.forEach((rawTask, index) => {
    const task = rawTask as unknown as Task;
    if (!profileById.has(task.ownerId) || !companyIds.has(task.companyId))
      context.addIssue({ code: "custom", path: ["closures", index, "tasks"], message: "La tarea congelada debe conservar titular y empresa existentes." });
    if (task.completedBy && !profileById.has(task.completedBy))
      context.addIssue({ code: "custom", path: ["closures", index, "tasks", "completedBy"], message: "La tarea congelada debe conservar el autor real de finalización." });
    if (task.responsibility?.members.some((member) => !profileById.has(member.profileId)))
      context.addIssue({ code: "custom", path: ["closures", index, "tasks", "responsibility"], message: "La responsabilidad congelada debe conservar los perfiles participantes." });
    if (task.commercialProgress && !profileById.has(task.commercialProgress.updatedBy))
      context.addIssue({ code: "custom", path: ["closures", index, "tasks", "commercialProgress", "updatedBy"], message: "El seguimiento comercial congelado debe conservar el autor real." });
    for (const dependencyId of task.dependsOnTaskIds || []) {
      const dependency = historicalTasksById.get(dependencyId) || taskById.get(dependencyId);
      if (!dependency || dependency.kind !== "resultado" || dependency.companyId !== task.companyId || dependency.month !== task.month || dependency.responsibility)
        context.addIssue({ code: "custom", path: ["closures", index, "tasks", "dependsOnTaskIds"], message: "La dependencia congelada debe apuntar a un entregable existente, individual, de la misma empresa y período." });
    }
  });
  const historicalDependencyGraph = new Map([...state.tasks, ...historicalTasks].map((task) => [task.id, task as unknown as Task]));
  const historicalVisiting = new Set<string>(), historicalVisited = new Set<string>();
  const visitHistoricalDependency = (taskId: string): boolean => {
    if (historicalVisiting.has(taskId)) return false;
    if (historicalVisited.has(taskId)) return true;
    historicalVisiting.add(taskId);
    const task = historicalDependencyGraph.get(taskId);
    for (const dependencyId of task?.dependsOnTaskIds || [])
      if (historicalDependencyGraph.has(dependencyId) && !visitHistoricalDependency(dependencyId)) return false;
    historicalVisiting.delete(taskId);
    historicalVisited.add(taskId);
    return true;
  };
  for (const task of historicalTasks) if (!visitHistoricalDependency(task.id)) {
    context.addIssue({ code: "custom", path: ["closures"], message: "El respaldo contiene dependencias cíclicas en snapshots congelados." });
    break;
  }
  const historicalActivityRows = [
    ...state.closures.flatMap((closure) => closure.activity),
    ...(state.companyClosures || []).flatMap((closure) => [
      ...closure.activity, ...closure.coveredActivity,
      ...(closure.coveredContributions || []).flatMap((entry) => entry.activity),
    ]),
    ...(state.taskTransfers || []).flatMap((transfer) => transfer.activity),
  ];
  historicalActivityRows.forEach((rawRow, index) => {
    const row = rawRow as unknown as Activity;
    const task = allTasksById.get(row.taskId);
    if (!task || task.month !== row.date.slice(0, 7) || !validDate(row.date) || !profileById.has(row.actorId))
      context.addIssue({ code: "custom", path: ["closures", index, "activity"], message: "El movimiento congelado debe conservar tarea, período y actor existentes." });
    if (row.operationalRateId && (task?.kind !== "operativa" || !(state.operationalRates || []).some((rate) => rate.id === row.operationalRateId && rate.companyId === task.companyId)))
      context.addIssue({ code: "custom", path: ["closures", index, "activity", "operationalRateId"], message: "El movimiento congelado referencia un coeficiente inexistente o de otra empresa." });
  });
  state.closures.forEach((closure, index) => {
    if (!profileById.has(closure.ownerId) || !profileById.has(closure.by) || !validInstant(closure.at) ||
      closure.tasks.some((task) => task.month !== closure.month ||
        (task.ownerId !== closure.ownerId && !task.responsibility?.members.some((member) => member.profileId === closure.ownerId))))
      context.addIssue({ code: "custom", path: ["closures", index], message: "El cierre mensual debe conservar titular, autor, período e historial coherentes." });
  });
  (state.companyClosures || []).forEach((closure, index) => {
    if (!profileById.has(closure.by) || !validInstant(closure.at))
      context.addIssue({ code: "custom", path: ["companyClosures", index], message: "El cierre por empresa debe conservar autor, titular y fecha válidos." });
    (closure.coveredContributions || []).forEach((entry, contributionIndex) => {
      if (!profileById.has(entry.executorId) || !profileById.has(entry.originalOwnerId) ||
          entry.sessions.some((session) => !validInstant(session.start) || !session.end || !validInstant(session.end) || dateART(session.start).slice(0, 7) !== entry.month) ||
          (entry.completionAt && dateART(entry.completionAt).slice(0, 7) !== entry.month))
        context.addIssue({ code: "custom", path: ["companyClosures", index, "coveredContributions", contributionIndex], message: "La contribución de cobertura debe conservar perfiles y sesiones cerradas dentro del período." });
    });
  });
  (state.taskTransfers || []).forEach((transfer, index) => {
    if (!profileById.has(transfer.formerOwnerId) || !profileById.has(transfer.newOwnerId) || !profileById.has(transfer.transferredBy) ||
      !companyIds.has(transfer.companyId) || !validInstant(transfer.transferredAt) ||
      transfer.taskSnapshot.id !== transfer.taskId || transfer.taskSnapshot.companyId !== transfer.companyId)
      context.addIssue({ code: "custom", path: ["taskTransfers", index], message: "La transferencia debe conservar las identidades y el snapshot de origen." });
    if (transfer.sessions.some((session) => !profileById.has(session.actorId) || !validInstant(session.start) || (session.end !== null && !validInstant(session.end))) ||
      transfer.activity.some((row) => !profileById.has(row.actorId) || !validDate(row.date) || !validInstant(row.createdAt)) ||
      transfer.comments.some((comment) => !profileById.has(comment.actorId) || !validInstant(comment.createdAt)))
      context.addIssue({ code: "custom", path: ["taskTransfers", index], message: "La transferencia debe conservar cronómetros, movimientos y comentarios válidos." });
  });
  (state.activity as unknown as Activity[]).forEach((row, index) => {
    const task = allTasksById.get(row.taskId);
    if (!task || task.kind !== "operativa" || task.month !== row.date.slice(0, 7) || !validDate(row.date) || !profileById.has(row.actorId) || !validInstant(row.createdAt))
      context.addIssue({ code: "custom", path: ["activity", index], message: "El movimiento debe corresponder a una operativa, período y actor existentes." });
    if (row.operationalRateId && !(state.operationalRates || []).some((rate) => rate.id === row.operationalRateId && rate.companyId === task?.companyId))
      context.addIssue({ code: "custom", path: ["activity", index, "operationalRateId"], message: "El movimiento referencia un coeficiente inexistente o de otra empresa." });
    if (row.operationalUnitWeight !== undefined && row.operationalUnitWeight !== null && (!(row.operationalUnitWeight > 0) || !Number.isFinite(row.operationalUnitWeight)))
      context.addIssue({ code: "custom", path: ["activity", index, "operationalUnitWeight"], message: "El coeficiente congelado del movimiento debe ser positivo y finito." });
  });
  unique(state.activity, "activity");
  (state.audit as Audit[]).forEach((row, index) => {
    if (!profileById.has(row.actorId) || !validInstant(row.at))
      context.addIssue({ code: "custom", path: ["audit", index], message: "La auditoría debe conservar un actor y una fecha válidos." });
  });
  state.assignments.forEach((assignment, index) => {
    if ((assignment as { retired?: unknown }).retired !== undefined && typeof (assignment as { retired?: unknown }).retired !== "boolean")
      context.addIssue({ code: "custom", path: ["assignments", index, "retired"], message: "El estado de vigencia debe ser booleano." });
    const steps = (assignment as unknown as { steps?: unknown }).steps;
    if (!Array.isArray(steps) || steps.some((step: unknown) => typeof step !== "string"))
      context.addIssue({ code: "custom", path: ["assignments", index, "steps"], message: "Los pasos de una regla deben ser una lista de textos." });
  });
  state.templates.forEach((template, index) => {
    const steps = (template as unknown as { steps?: unknown }).steps;
    if (!Array.isArray(steps) || steps.some((step: unknown) => typeof step !== "string"))
      context.addIssue({ code: "custom", path: ["templates", index, "steps"], message: "Los pasos del catálogo deben ser una lista de textos." });
  });
  state.tasks.forEach((task, index) => {
    if (!task.id.trim()) context.addIssue({ code: "custom", path: ["tasks", index, "id"], message: "Cada tarea necesita un identificador no vacío." });
    const sessions = (task as unknown as { sessions?: unknown }).sessions;
    if (Array.isArray(sessions) && sessions.some((session: any) => !session || !profileById.has(session.actorId) || !validInstant(session.start) || (session.end !== null && !validInstant(session.end))))
      context.addIssue({ code: "custom", path: ["tasks", index, "sessions"], message: "Cada cronómetro debe conservar un actor existente y fechas válidas." });
  });
  (state.absences || []).forEach((absence, index) => {
    if (!profileById.has(absence.ownerId) || !profileById.has(absence.replacementId) || !profileById.has(absence.createdBy) ||
      !validDate(absence.from) || !validDate(absence.to) || absence.to < absence.from)
      context.addIssue({ code: "custom", path: ["absences", index], message: "La ausencia debe conservar perfiles existentes y un intervalo real válido." });
  });
  (state.catalogueVersions || []).forEach((version, index) => {
    if (!state.templates.some((template) => template.id === version.templateId) ||
      (version.createdBy !== null && !profileById.has(version.createdBy)) ||
      !validInstant(version.capturedAt) || (version.effectiveOn !== null && !validDate(version.effectiveOn)))
      context.addIssue({ code: "custom", path: ["catalogueVersions", index], message: "La versión de catálogo debe conservar una plantilla, autor y vigencia válidos." });
  });
  (state.improvementProposals || []).forEach((proposal, index) => {
    if (!companyIds.has(proposal.companyId) || !state.templates.some((template) => template.id === proposal.templateId) ||
      !profileById.has(proposal.responsibleId) || !profileById.has(proposal.proposedBy) ||
      !validDate(proposal.trialFrom) || !validDate(proposal.trialThrough) || proposal.trialThrough < proposal.trialFrom ||
      !validInstant(proposal.proposedAt) ||
      (proposal.measuredOn !== undefined && (!validDate(proposal.measuredOn) || proposal.measuredOn < proposal.trialFrom || proposal.measuredOn > proposal.trialThrough ||
        !proposal.measuredBy || !profileById.has(proposal.measuredBy))) ||
      (proposal.measuredBy !== undefined && proposal.measuredOn === undefined))
      context.addIssue({ code: "custom", path: ["improvementProposals", index], message: "La propuesta debe conservar referencias y fechas válidas." });
  });
  (state.fiveSReviews || []).forEach((review, index) => {
    if (!companyIds.has(review.companyId) || (review.templateId !== null && !state.templates.some((template) => template.id === review.templateId)) ||
      !profileById.has(review.createdBy) || !validDate(review.reviewedOn) || !validInstant(review.createdAt))
      context.addIssue({ code: "custom", path: ["fiveSReviews", index], message: "La revisión debe conservar una empresa, catálogo, autor y fecha válidos." });
    review.items.forEach((item, itemIndex) => {
      if (!profileById.has(item.responsibleId) || !validDate(item.dueOn) ||
        (item.completedOn !== undefined && !validDate(item.completedOn)) ||
        (item.completedBy !== undefined && !profileById.has(item.completedBy)))
        context.addIssue({ code: "custom", path: ["fiveSReviews", index, "items", itemIndex], message: "La acción de mejora debe conservar responsables y fechas válidos." });
    });
  });
  (state.fiscalObligations || []).forEach((obligation, index) => {
    if (!companyIds.has(obligation.companyId) || !validDate(obligation.dueOn) || !validInstant(obligation.createdAt) || !validInstant(obligation.updatedAt) ||
      (obligation.sourceCheckedAt !== null && !validDate(obligation.sourceCheckedAt)) ||
      (obligation.createdBy !== null && !profileById.has(obligation.createdBy)) ||
      obligation.requiredTaskIds.some((taskId) => !state.tasks.some((task) => task.id === taskId && task.companyId === obligation.companyId)) ||
      (obligation.evaluationVersion === 2 && obligation.requiredTaskIds.some((taskId) => !state.tasks.some((task) => task.id === taskId && task.companyId === obligation.companyId && task.kind === "resultado"))))
      context.addIssue({ code: "custom", path: ["fiscalObligations", index], message: "La obligación debe conservar empresa, tareas, autor y fechas válidos." });
    obligation.history.forEach((change, changeIndex) => {
      if (!validDate(change.dueOn) || !validInstant(change.at) || !profileById.has(change.by) ||
        (change.sourceCheckedAt !== null && !validDate(change.sourceCheckedAt)) ||
        change.requiredTaskIds.some((taskId) => !state.tasks.some((task) => task.id === taskId && task.companyId === obligation.companyId)) ||
        (change.evaluationVersion !== undefined && change.evaluationVersion !== (obligation.evaluationVersion ?? 1)) ||
        ((change.evaluationVersion ?? obligation.evaluationVersion ?? 1) === 2 && change.requiredTaskIds.some((taskId) => !state.tasks.some((task) => task.id === taskId && task.companyId === obligation.companyId && task.kind === "resultado"))))
        context.addIssue({ code: "custom", path: ["fiscalObligations", index, "history", changeIndex], message: "El historial fiscal debe conservar referencias y fechas válidos." });
    });
  });
  (state.habitualTaskProposals || []).forEach((proposal, index) => {
    if (!profileById.has(proposal.ownerId) || !companyIds.has(proposal.companyId) ||
      !validInstant(proposal.submittedAt) || !validInstant(proposal.updatedAt))
      context.addIssue({ code: "custom", path: ["habitualTaskProposals", index], message: "La propuesta recurrente debe conservar titular, empresa y fechas válidos." });
    try { validateSchedule(proposal.schedule); }
    catch { context.addIssue({ code: "custom", path: ["habitualTaskProposals", index, "schedule"], message: "La frecuencia y las fechas de la propuesta recurrente no son válidas." }); }
    proposal.submissions.forEach((submission, submissionIndex) => {
      try { validateSchedule(submission.schedule); }
      catch { context.addIssue({ code: "custom", path: ["habitualTaskProposals", index, "submissions", submissionIndex, "schedule"], message: "La frecuencia y las fechas del envío no son válidas." }); }
      if (!validInstant(submission.submittedAt)) context.addIssue({ code: "custom", path: ["habitualTaskProposals", index, "submissions", submissionIndex, "submittedAt"], message: "La fecha del envío no es válida." });
    });
  });
  (state.operationalRates || []).forEach((rate, index) => {
    const task = rate.taskId ? state.tasks.find((row) => row.id === rate.taskId) : undefined;
    const template = rate.templateId ? state.templates.find((row) => row.id === rate.templateId) : undefined;
    if (!validDate(rate.effectiveOn) || !validInstant(rate.createdAt) ||
      (!!rate.taskId === !!rate.templateId) ||
      (rate.taskId ? !task || task.companyId !== rate.companyId || task.kind !== "operativa" : !template || template.kind !== "operativa"))
      context.addIssue({ code: "custom", path: ["operationalRates", index], message: "El coeficiente debe corresponder a una operativa de la misma empresa y tener vigencia válida." });
  });
  const operationalRateVersions = new Set<string>();
  (state.operationalRates || []).forEach((rate, index) => {
    const target = rate.taskId ? `task:${rate.taskId}` : `template:${rate.templateId}`;
    const key = `${rate.companyId}\u001f${target}\u001f${rate.version}`;
    if (operationalRateVersions.has(key))
      context.addIssue({ code: "custom", path: ["operationalRates", index, "version"], message: "La versión de un coeficiente no puede repetirse para la misma actividad y empresa." });
    operationalRateVersions.add(key);
  });
  (state.operationalAssessments || []).forEach((assessment, index) => {
    if (!validInstant(assessment.evaluatedAt)) context.addIssue({ code: "custom", path: ["operationalAssessments", index, "evaluatedAt"], message: "La fecha de evaluación debe ser válida." });
  });
  (state.calendarEvents || []).forEach((event, index) => {
    if (calendarEventFieldsError(event, new Set(state.companies.map((company) => company.id)), new Map(state.tasks.map((task) => [task.id, task]))) ||
      !validInstant(event.createdAt) || !validInstant(event.updatedAt) ||
      (event.cancelledAt !== null && !validInstant(event.cancelledAt)) ||
      (event.cancelledBy !== null && !profileById.has(event.cancelledBy)))
      context.addIssue({ code: "custom", path: ["calendarEvents", index], message: "La fecha compartida debe conservar empresa, contenido, fechas, vínculo y autoría válidos." });
  });
  (state.calendarNotices || []).forEach((notice, index) => {
    if (!validInstant(notice.createdAt) || (notice.readAt !== null && !validInstant(notice.readAt)))
      context.addIssue({ code: "custom", path: ["calendarNotices", index], message: "El aviso debe conservar fechas válidas." });
  });
  (state.notifications || []).forEach((notice, index) => {
    if (!profileById.has(notice.recipientId) || !profileById.has(notice.actorId) || !allTaskIds.has(notice.taskId) ||
      !validInstant(notice.createdAt) || (notice.readAt !== null && !validInstant(notice.readAt)))
      context.addIssue({ code: "custom", path: ["notifications", index], message: "La notificación debe conservar tarea, perfiles y fechas existentes." });
  });
  (state.taskComments || []).forEach((comment, index) => {
    if (!allTaskIds.has(comment.taskId) || !profileById.has(comment.actorId) || !validInstant(comment.createdAt))
      context.addIssue({ code: "custom", path: ["taskComments", index], message: "El comentario debe conservar tarea, autor y fecha existentes." });
  });
  (state.internalRequests || []).forEach((request, index) => {
    if (!profileById.has(request.authorId) || !profileById.has(request.recipientId) || !validInstant(request.createdAt) || !validInstant(request.updatedAt) ||
      (request.convertedTaskId !== undefined && !allTaskIds.has(request.convertedTaskId)) ||
      request.messages.some((message) => !profileById.has(message.actorId) || !validInstant(message.createdAt)) ||
      request.history.some((entry) => !profileById.has(entry.actorId) || !validInstant(entry.createdAt)))
      context.addIssue({ code: "custom", path: ["internalRequests", index], message: "La solicitud debe conservar autores, tarea convertida y fechas existentes." });
  });
  state.tasks.forEach((task, index) => {
    const responsibility = task.responsibility;
    if (responsibility && !responsibility.members.some((member) => member.profileId === task.ownerId))
      context.addIssue({ code: "custom", path: ["tasks", index, "responsibility"], message: "La responsabilidad debe conservar al titular original." });
  });
  const receipts = state.jointReceipts || [];
  if (new Set(receipts.map((receipt) => receipt.requestId)).size !== receipts.length)
    context.addIssue({ code: "custom", path: ["jointReceipts"], message: "Las claves de idempotencia deben ser únicas." });
  receipts.forEach((receipt, index) => {
    if (!state.tasks.some((task) => task.id === receipt.taskId && task.responsibility?.revision === receipt.revision))
      context.addIssue({ code: "custom", path: ["jointReceipts", index], message: "El recibo debe corresponder a una responsabilidad guardada." });
  });
  const obligations = state.fiscalObligations || [];
  const obligationKeys = obligations.map((row) => [row.companyId, row.obligationCode.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es-AR"), row.fiscalPeriod, row.milestone].join("\u001f"));
  if (new Set(obligationKeys).size !== obligationKeys.length)
    context.addIssue({ code: "custom", path: ["fiscalObligations"], message: "La agenda no puede repetir el mismo hito de una obligación." });
  obligations.forEach((row, index) => {
    if (new Set(row.requiredTaskIds).size !== row.requiredTaskIds.length)
      context.addIssue({ code: "custom", path: ["fiscalObligations", index, "requiredTaskIds"], message: "Una obligación no puede vincular dos veces la misma tarea." });
    if (row.history.length !== row.revision - 1 || row.history.some((change, changeIndex) => change.revision !== changeIndex + 2))
      context.addIssue({ code: "custom", path: ["fiscalObligations", index, "history"], message: "La revisión de la obligación no coincide con su historial." });
  });
  const uniqueIds = (rows: Array<{ id: string }> | undefined, path: string) => {
    const ids = (rows || []).map((row) => row.id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: "custom", path: [path], message: "Los identificadores del laboratorio deben ser únicos." });
  };
  uniqueIds(state.operationalRates, "operationalRates");
  uniqueIds(state.operationalAssessments, "operationalAssessments");
  uniqueIds(state.calendarEvents, "calendarEvents");
  uniqueIds(state.calendarNotices, "calendarNotices");
  uniqueIds(state.companyClosures, "companyClosures");
  uniqueIds(state.taskEvidence, "taskEvidence");
  uniqueIds(state.audit, "audit");
  uniqueIds(state.annotations, "annotations");
  uniqueIds(state.notifications, "notifications");
  uniqueIds(state.internalRequests, "internalRequests");
  uniqueIds(state.taskComments, "taskComments");
  uniqueIds(state.absences, "absences");
  uniqueIds(state.orphanedWork, "orphanedWork");
  uniqueIds(state.taskTransfers, "taskTransfers");
  uniqueIds(state.catalogueVersions, "catalogueVersions");
  uniqueIds(state.improvementProposals, "improvementProposals");
  uniqueIds(state.fiveSReviews, "fiveSReviews");
  uniqueIds(state.fiscalObligations, "fiscalObligations");
  (state.operationalRates || []).forEach((rate, index) => {
    if (!state.companies.some((company) => company.id === rate.companyId) ||
      !state.profiles.some((profile) => profile.id === rate.createdBy) ||
      (!!rate.taskId && !state.tasks.some((task) => task.id === rate.taskId && task.kind === "operativa")) ||
      (!!rate.templateId && !state.templates.some((template: any) => template.id === rate.templateId && template.kind === "operativa")) ||
      (!!rate.taskId === !!rate.templateId))
      context.addIssue({ code: "custom", path: ["operationalRates", index], message: "La tarifa debe apuntar a una operativa existente." });
  });
  (state.operationalAssessments || []).forEach((row, index) => {
    const task = state.tasks.find((entry) => entry.id === row.taskId);
    if (!task || task.kind !== "operativa" || task.ownerId !== row.profileId || task.companyId !== row.companyId || task.month !== row.month ||
      !state.profiles.some((profile) => profile.id === row.evaluatedBy && profile.role === "jefe"))
      context.addIssue({ code: "custom", path: ["operationalAssessments", index], message: "La evaluación debe corresponder a una operativa y una jefatura existentes." });
  });
  (state.calendarEvents || []).forEach((event, index) => {
    if (!state.profiles.some((profile) => profile.id === event.authorId) ||
      (event.companyId !== null && !state.companies.some((company) => company.id === event.companyId)) ||
      (event.linkedTaskId !== null && !state.tasks.some((task) => task.id === event.linkedTaskId)) ||
      !event.recipientIds.includes(event.authorId) || event.recipientIds.some((recipientId) => !state.profiles.some((profile) => profile.id === recipientId)) || new Set(event.recipientIds).size !== event.recipientIds.length ||
      event.endOn < event.startOn || !event.startOn.match(/^\d{4}-\d{2}-\d{2}$/) || !event.endOn.match(/^\d{4}-\d{2}-\d{2}$/))
      context.addIssue({ code: "custom", path: ["calendarEvents", index], message: "La fecha compartida contiene referencias o destinatarios inválidos." });
  });
  (state.calendarNotices || []).forEach((notice, index) => {
    if (!state.calendarEvents?.some((event) => event.id === notice.eventId && event.revision >= notice.revision) ||
      !state.profiles.some((profile) => profile.id === notice.recipientId) || !state.profiles.some((profile) => profile.id === notice.actorId))
      context.addIssue({ code: "custom", path: ["calendarNotices", index], message: "El aviso debe referenciar una fecha y perfiles existentes." });
  });
  const closureKeys = (state.companyClosures || []).map((row) => `${row.ownerId}\u001f${row.companyId}\u001f${row.month}`);
  if (new Set(closureKeys).size !== closureKeys.length)
    context.addIssue({ code: "custom", path: ["companyClosures"], message: "Una persona no puede cerrar dos veces la misma empresa y mes." });
  (state.companyClosures || []).forEach((row, index) => {
    if (!state.profiles.some((profile) => profile.id === row.ownerId) || !state.companies.some((company) => company.id === row.companyId))
      context.addIssue({ code: "custom", path: ["companyClosures", index], message: "El cierre por empresa requiere una persona y empresa existentes." });
  });
  const archivedTasks = [
    ...state.closures.flatMap((closure) => closure.tasks),
    ...(state.companyClosures || []).flatMap((closure) => [
      ...closure.tasks, ...(closure.coveredContributions || []).map((entry) => entry.taskSnapshot),
    ]),
  ];
  const evidenceTasks = [...state.tasks, ...archivedTasks];
  const archivedActivity = [
    ...state.closures.flatMap((closure) => closure.activity),
    ...(state.companyClosures || []).flatMap((closure) => [
      ...closure.activity, ...closure.coveredActivity, ...(closure.coveredContributions || []).flatMap((entry) => entry.activity),
    ]),
  ];
  const evidenceActivity = [...state.activity, ...archivedActivity];
  const evidenceMetadata = state.taskEvidence || [];
  const includesEvidence = (record: object, evidenceId: string) => {
    const evidenceIds = (record as { evidenceIds?: unknown }).evidenceIds;
    return Array.isArray(evidenceIds) && evidenceIds.includes(evidenceId);
  };
  (evidenceMetadata).forEach((evidence, index) => {
    const task = evidenceTasks.find((entry) => entry.id === evidence.taskId);
    const activity = evidence.activityId ? evidenceActivity.find((entry) => entry.id === evidence.activityId && entry.taskId === evidence.taskId) : null;
    const limit = evidence.mimeType === "application/pdf" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    const linked = evidence.activityId
      ? !!activity && includesEvidence(activity, evidence.id)
      : evidenceTasks.some((entry) => entry.id === evidence.taskId && includesEvidence(entry, evidence.id));
    if (!task || !state.profiles.some((profile) => profile.id === evidence.profileId) || (evidence.activityId && !activity) || (evidence.activityId && evidence.completionAt) || !linked || evidence.size > limit)
      context.addIssue({ code: "custom", path: ["taskEvidence", index], message: "La evidencia debe corresponder a una tarea, movimiento y autor existentes." });
  });
  for (const task of evidenceTasks) for (const evidenceId of (task.evidenceIds as string[] | undefined) || [])
    if (!evidenceMetadata.some((evidence) => evidence.id === evidenceId && evidence.taskId === task.id && evidence.activityId === null))
      context.addIssue({ code: "custom", path: ["tasks"], message: "La tarea apunta a una evidencia inexistente o asociada a otro registro." });
  for (const activity of evidenceActivity) for (const evidenceId of (activity.evidenceIds as string[] | undefined) || [])
    if (!evidenceMetadata.some((evidence) => evidence.id === evidenceId && evidence.taskId === activity.taskId && evidence.activityId === activity.id))
      context.addIssue({ code: "custom", path: ["activity"], message: "El movimiento apunta a una evidencia inexistente o asociada a otro registro." });
});
const laboratoryBackupSchema = z.object({
  format: z.literal("grupo-paris-lab-backup"),
  formatVersion: z.literal(1),
  createdAt: z.string().min(1).max(40),
  state: schema,
});
const laboratoryBackupV2Schema = z.object({
  format: z.literal("grupo-paris-lab-backup"),
  formatVersion: z.literal(2),
  createdAt: z.string().min(1).max(40),
  state: schema,
  files: z.array(z.object({
    id: z.string().min(1), name: z.string().min(1).max(240),
    taskId: z.string().min(1).optional(), activityId: z.string().nullable().optional(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
    size: z.number().int().positive().max(10 * 1024 * 1024),
    sha256: z.string().regex(/^[a-f0-9]{64}$/), contents: z.string().min(1),
  })).max(1000),
});
const LAB_BACKUP_V1_MAX_BYTES = 10 * 1024 * 1024;
const LAB_BACKUP_V2_MAX_BYTES = 50 * 1024 * 1024;

export interface LaboratoryBackup {
  formatVersion: 1 | 2;
  createdAt: string;
  state: State;
  files?: EvidenceBundleFile[];
  fileCount: number;
  counts: { companies: number; profiles: number; tasks: number; notes: number };
}

export type CommitOutcome =
  | { status: "committed" }
  | { status: "rejected"; reason?: "storage" | "validation" | "preparation" }
  | { status: "unknown" };

export function classifyCommitStorageFailure(input: {
  expected: string;
  previousRaw: string | null;
  previousRead: boolean;
  actualRaw?: string | null;
  actualRead: boolean;
}): CommitOutcome {
  if (input.actualRead && input.actualRaw === input.expected) return { status: "committed" };
  if (input.previousRead && input.actualRead && input.actualRaw === input.previousRaw) return { status: "rejected" };
  return { status: "unknown" };
}

export function createLaboratoryBackup(state: State, createdAt = new Date().toISOString()) {
  return JSON.stringify({
    format: "grupo-paris-lab-backup",
    formatVersion: 1,
    createdAt,
    state,
  }, null, 2);
}

export async function createLaboratoryBackupV2(state: State, createdAt = new Date().toISOString()) {
  const { createEvidenceBundle } = await import("./laboratoryEvidence");
  const files = await createEvidenceBundle(state);
  const contents = JSON.stringify({ format: "grupo-paris-lab-backup", formatVersion: 2, createdAt, state, files }, null, 2);
  if (new TextEncoder().encode(contents).byteLength > LAB_BACKUP_V2_MAX_BYTES)
    throw new Error("La copia con archivos supera el límite total de 50 MB.");
  return contents;
}

export function inspectLaboratoryBackup(contents: string): LaboratoryBackup {
  if (new TextEncoder().encode(contents).byteLength > LAB_BACKUP_V2_MAX_BYTES)
    throw new Error("La copia supera el límite total de 50 MB.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error("El archivo no contiene una copia JSON válida.");
  }

  const formatVersion = (parsed as { formatVersion?: unknown }).formatVersion;
  const candidateState = (parsed as { state?: unknown }).state;
  if (candidateState && typeof candidateState === "object" && Array.isArray((candidateState as { profiles?: unknown }).profiles)) {
    const profiles = (candidateState as { profiles: Array<{ id?: unknown }> }).profiles;
    const activeId = (candidateState as { activeId?: unknown }).activeId;
    if (typeof activeId === "string" && !profiles.some((profile) => profile?.id === activeId))
      throw new Error("La copia no identifica un perfil activo válido.");
  }
  const result = formatVersion === 1 ? laboratoryBackupSchema.safeParse(parsed) : formatVersion === 2 ? laboratoryBackupV2Schema.safeParse(parsed) : null;
  if (!result?.success) throw new Error("El archivo no es una copia compatible del laboratorio.");
  if (formatVersion === 1 && new TextEncoder().encode(contents).byteLength > LAB_BACKUP_V1_MAX_BYTES)
    throw new Error("La copia versión 1 supera el límite de 10 MB.");

  const state = result.data.state as unknown as State;
  if (!state.profiles.some((profile) => profile.id === state.activeId))
    throw new Error("La copia no identifica un perfil activo válido.");

  // Return the original parsed state to preserve fields added by compatible app
  // versions; the schema above validates it without rewriting the payload.
  const originalState = (parsed as { state: unknown }).state as State;
  const files = formatVersion === 2 ? (parsed as { files: EvidenceBundleFile[] }).files : undefined;
  const metadata = originalState.taskEvidence || [];
  if (formatVersion === 1 && metadata.length)
    throw new Error("Esta copia versión 1 no contiene los archivos asociados y no puede restaurar evidencia.");
  if (formatVersion === 2) {
    const filesById = new Map(files!.map((file) => [file.id, file]));
    if (filesById.size !== files!.length || files!.length !== metadata.length)
      throw new Error("La copia no incluye exactamente todos los archivos de evidencia referenciados.");
    const groups = new Map<string, number>();
    for (const file of files!) {
      const evidence = metadata.find((row) => row.id === file.id);
      const limit = file.mimeType === "application/pdf" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
      let decodedLength = -1;
      try { decodedLength = atob(file.contents).length; } catch { /* reported below */ }
      if (!evidence || (file.taskId !== undefined && file.taskId !== evidence.taskId) || (file.activityId !== undefined && file.activityId !== evidence.activityId) || evidence.name !== file.name || evidence.mimeType !== file.mimeType || evidence.size !== file.size || evidence.sha256 !== file.sha256 || file.size > limit || decodedLength !== file.size)
        throw new Error(`La evidencia “${file.name}” tiene referencias, tamaño o contenido incompatibles.`);
      const key = `${evidence.taskId}\u001f${evidence.activityId || "task"}`;
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    if ([...groups.values()].some((count) => count > 3)) throw new Error("Una tarea o movimiento supera el máximo de tres archivos.");
    const archivedTasks = [
      ...originalState.closures.flatMap((closure) => closure.tasks),
      ...(originalState.companyClosures || []).flatMap((closure) => [
        ...closure.tasks, ...(closure.coveredContributions || []).map((entry) => entry.taskSnapshot),
      ]),
    ];
    const evidenceTasks = [...originalState.tasks, ...archivedTasks];
    const archivedActivity = [
      ...originalState.closures.flatMap((closure) => closure.activity),
      ...(originalState.companyClosures || []).flatMap((closure) => [
        ...closure.activity, ...closure.coveredActivity, ...(closure.coveredContributions || []).flatMap((entry) => entry.activity),
      ]),
    ];
    const evidenceActivity = [...originalState.activity, ...archivedActivity];
    const hasEvidenceReference = (record: object, evidenceId: string) => {
      const evidenceIds = (record as { evidenceIds?: unknown }).evidenceIds;
      return Array.isArray(evidenceIds) && evidenceIds.includes(evidenceId);
    };
    for (const evidence of metadata) {
      const task = evidenceTasks.find((row) => row.id === evidence.taskId);
      const activity = evidence.activityId ? evidenceActivity.find((row) => row.id === evidence.activityId && row.taskId === evidence.taskId) : null;
      const linked = evidence.activityId
        ? !!activity && hasEvidenceReference(activity, evidence.id)
        : evidenceTasks.some((row) => row.id === evidence.taskId && hasEvidenceReference(row, evidence.id));
      if (!task || (evidence.activityId && !activity) || !linked)
        throw new Error(`La evidencia “${evidence.name}” no está vinculada a su tarea o movimiento.`);
    }
  }
  return {
    formatVersion: formatVersion as 1 | 2,
    createdAt: result.data.createdAt,
    state: originalState,
    ...(files ? { files } : {}),
    fileCount: files?.length || 0,
    counts: {
      companies: originalState.companies.length,
      profiles: originalState.profiles.length,
      tasks: originalState.tasks.length,
      notes: (originalState.annotations || []).length + (originalState.taskComments || []).length,
    },
  };
}

function readPreviousLaboratoryState() {
  try { return localStorage.getItem("paris-state-lab"); }
  catch { throw new Error("No se pudo leer la copia actual del laboratorio; no se modificó nada."); }
}

async function persistBackupAndReconcile(backup: LaboratoryBackup, previous: string | null, addedIds: string[] = []) {
  const { reconcileEvidenceRecordKeys, removeStoredEvidence } = await import("./laboratoryEvidence");
  try {
    backup.state.labRevision = id();
    localStorage.setItem("paris-state-lab", JSON.stringify(backup.state));
    await reconcileEvidenceRecordKeys(backup.state);
    return backup;
  } catch (error) {
    try {
      if (previous === null) localStorage.removeItem("paris-state-lab");
      else localStorage.setItem("paris-state-lab", previous);
    } catch {
      throw new Error("Falló la restauración y no se pudo recuperar la copia local anterior. No vuelvas a cerrar esta pestaña; descargá el respaldo antes de reintentar.");
    }
    try { await removeStoredEvidence(addedIds); }
    catch {
      try {
        const previousState = previous === null ? { taskEvidence: [] } as unknown as State : JSON.parse(previous) as State;
        await reconcileEvidenceRecordKeys(previousState);
      } catch {
        throw new Error("La restauración falló y no se pudo limpiar ni reconciliar el índice de archivos temporales. La copia anterior del estado sigue guardada; no cierres esta pestaña hasta descargarla.");
      }
      throw new Error("La restauración falló y algunos bytes temporales quedaron conservados sin vínculo activo. La copia anterior del estado se mantuvo.");
    }
    throw error;
  }
}

export async function restoreLaboratoryBackup(contents: string) {
  const backup = inspectLaboratoryBackup(contents);
  if (backup.formatVersion !== 1) throw new Error("La copia con evidencia requiere restauración asíncrona del laboratorio.");
  const { acquireEvidenceMutationLock } = await import("./laboratoryEvidence");
  const release = await acquireEvidenceMutationLock();
  try {
    const previous = readPreviousLaboratoryState();
    return await persistBackupAndReconcile(backup, previous);
  }
  finally { release(); }
}

export async function restoreLaboratoryBackupWithEvidence(contents: string) {
  const backup = inspectLaboratoryBackup(contents);
  const { acquireEvidenceMutationLock, restoreEvidenceBundle } = await import("./laboratoryEvidence");
  const release = await acquireEvidenceMutationLock();
  try {
    const previous = readPreviousLaboratoryState();
    if (backup.formatVersion === 1) return await persistBackupAndReconcile(backup, previous);
    const metadataById = new Map((backup.state.taskEvidence || []).map((row) => [row.id, row]));
    const files = (backup.files || []).map((file) => {
      const metadata = metadataById.get(file.id);
      return metadata ? { ...file, taskId: metadata.taskId, activityId: metadata.activityId } : file;
    });
    const storedIds = await restoreEvidenceBundle(files);
    return await persistBackupAndReconcile(backup, previous, storedIds);
  } finally { release(); }
}

export const isLab = () => localStorage.getItem("paris-environment") === "lab";
export function enterLab(state: State) {
  persist(state);
  const laboratoryState = { ...structuredClone(state), activeId: "boss", labRevision: id() };
  localStorage.setItem(
    "paris-state-lab",
    JSON.stringify(laboratoryState),
  );
  localStorage.setItem("paris-environment", "lab");
  location.reload();
}
export function exitLab() {
  localStorage.removeItem("paris-environment");
  location.reload();
}
export function load(laboratory = isLab()): State {
  const raw = localStorage.getItem(laboratory ? "paris-state-lab" : KEY);
  if (raw === null) {
    const s = seed();
    const legacy = localStorage.getItem("paris-tasks-v1");
    if (legacy && !laboratory) {
      localStorage.setItem("paris-tasks-v1-backup", legacy);
      try {
        const rows = JSON.parse(legacy) as Record<string, unknown>[];
        for (const t of rows) {
          if (typeof t.id !== "string" || typeof t.title !== "string") continue;
          const p = s.profiles.find((p) => p.name === t.person);
          const c = s.companies.find((c) => c.name === t.company);
          if (!p || !c || typeof t.due !== "string") continue;
          s.tasks.push({
            id: "legacy-" + t.id,
            assignmentId: null,
            title: t.title,
            ownerId: p.id,
            companyId: c.id,
            teamId: p.teamId,
            sector: String(t.sector || p.sector),
            month: t.due.slice(0, 7),
            due: t.due,
            kind: "resultado",
            weight: 1,
            unit: "",
            target: 0,
            status:
              t.status === "Completada"
                ? "Completada"
                : t.status === "En curso"
                  ? "En curso"
                  : "Pendiente",
            checklist: Array.isArray(t.checklist)
              ? t.checklist.map((x: { text: string; done: boolean }) => ({
                  id: id(),
                  text: String(x.text),
                  done: !!x.done,
                }))
              : [],
            completedAt:
              typeof t.completedAt === "string"
                ? t.completedAt + "T15:00:00Z"
                : null,
            startedAt: null,
            priority: "Media",
            blockedBy: t.status === "Bloqueada" ? "Por definir" : "",
            blockedSince: t.status === "Bloqueada" ? t.due : null,
          });
        }
      } catch {
        throw Error(
          "No pudimos leer los datos de la versión anterior. Conservamos el original; no lo sobrescribimos.",
        );
      }
    }
    if (!laboratory) return s;
    const versioned = pinMatchingCatalogueAssignments(ensureCatalogueVersions(s));
    const assignmentsById = new Map(versioned.assignments.map((assignment) => [assignment.id, assignment]));
    return {
      ...versioned,
      improvementProposals: [],
      fiveSReviews: [],
      fiscalObligations: seedFiscalObligations(versioned),
      tasks: versioned.tasks.map((task) => {
        const assignment = task.assignmentId ? assignmentsById.get(task.assignmentId) : undefined;
        const version = assignment?.templateVersion || (task.templateId ? currentCatalogueVersion(versioned, task.templateId) : 0);
        return version && task.templateId ? { ...task, templateVersion: version } : task;
      }),
    };
  }
  const parsed = JSON.parse(raw);
  schema.parse(parsed);
  const state = parsed as State;
  state.profiles = state.profiles.map((p) =>
    p.id === "boss" && p.name === "Juan · Jefe de ejemplo"
      ? { ...p, name: "Juan Pablo", position: "Gerente contable" }
      : p,
  );
  state.absences ||= [];
  state.orphanedWork ||= [];
  state.taskTransfers ||= [];
  state.annotations ||= [];
  state.internalRequests ||= [];
  state.tourVersion ||= {};
  if (!laboratory) return state;
  if (state.fiscalObligations === undefined) state.fiscalObligations = seedFiscalObligations(state);
  state.improvementProposals ||= [];
  state.fiveSReviews ||= [];
  return pinMatchingCatalogueAssignments(ensureCatalogueVersions(state));
}
export class StaleLaboratoryStateError extends Error {
  constructor() {
    super("El laboratorio cambió en otra pestaña. Recargá la página antes de guardar.");
    this.name = "StaleLaboratoryStateError";
  }
}
export function persist(s: State, laboratory = false, expectedLabRevision?: string) {
  let nextLabRevision = s.labRevision;
  if (laboratory) {
    const raw = localStorage.getItem("paris-state-lab");
    let durableRevision: string | undefined;
    if (raw !== null) {
      try { durableRevision = (JSON.parse(raw) as State).labRevision; }
      catch { throw new StaleLaboratoryStateError(); }
    }
    const expectedRevisionProvided = arguments.length >= 3;
    if (expectedRevisionProvided) {
      if (durableRevision !== expectedLabRevision) throw new StaleLaboratoryStateError();
      nextLabRevision = id();
    } else if (raw === null) {
      nextLabRevision ||= id();
    } else {
      if (s.labRevision !== durableRevision) throw new StaleLaboratoryStateError();
      nextLabRevision = id();
    }
  }
  const storageKey = laboratory ? "paris-state-lab" : KEY;
  const serialized = JSON.stringify(laboratory ? { ...s, labRevision: nextLabRevision } : s);
  try { localStorage.setItem(storageKey, serialized); }
  catch (error) {
    // A synchronous write can throw after the browser accepted it. Confirm the exact candidate before classifying the outcome.
    try { if (localStorage.getItem(storageKey) !== serialized) throw error; }
    catch { throw error; }
  }
  if (laboratory) s.labRevision = nextLabRevision;
}
/** A write token detects stale tabs without comparing large normalized state trees. */
export function isLaboratoryStateCurrent(expected: State): boolean {
  try {
    if (localStorage.getItem("paris-state-lab") === null) return true;
    return load(true).labRevision === expected.labRevision;
  } catch {
    return false;
  }
}
