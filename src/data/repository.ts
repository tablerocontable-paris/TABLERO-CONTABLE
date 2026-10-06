import { z } from "zod";
import {
  id,
  currentMonth,
  materialize,
  type State,
  type Onboarding,
} from "../domain/model";
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
const schema = z.object({
  version: z.literal(3),
  boardOrder: z.enum(["original", "az", "za"]).optional(),
  companies: z.array(z.object({ id: z.string(), name: z.string() })),
  profiles: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        role: z.enum(["jefe", "encargado", "empleado"]),
      })
      .passthrough(),
  ),
  tasks: z.array(
    z
      .object({
        id: z.string(),
        companyId: z.string(),
        ownerId: z.string(),
        month: z.string(),
        weight: z.number().nonnegative(),
        kind: z.enum(["resultado", "operativa"]),
        checklist: z.array(
          z.object({ id: z.string(), text: z.string(), done: z.boolean() }),
        ),
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
  assignments: z.array(z.unknown()),
  teams: z.array(z.unknown()),
  templates: z.array(z.unknown()),
  closures: z.array(z.unknown()),
  audit: z.array(z.unknown()),
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
  onboarding: z.record(z.string(), z.unknown()),
  parameterReviews: z.record(z.string(), z.object({ onboardingCompletedAt: z.string(), reviewedAt: z.string(), reviewedBy: z.string() })).optional(),
  notifications: z.array(z.object({
    id: z.string(), recipientId: z.string(), actorId: z.string(), taskId: z.string(),
    title: z.string(), kind: z.enum(['assigned', 'completed', 'changed', 'comment', 'joint']),
    createdAt: z.string(), readAt: z.string().nullable(),
  })).optional(),
  taskComments: z.array(z.object({ id: z.string(), taskId: z.string(), actorId: z.string(),
    content: z.string().max(2000), createdAt: z.string(),
  })).optional(),
  activeId: z.string(),
  tour: z.record(z.string(), z.number()),
  tourVersion: z.record(z.string(), z.number()).optional(),
});
export const isLab = () => localStorage.getItem("paris-environment") === "lab";
export function enterLab(state: State) {
  persist(state);
  localStorage.setItem(
    "paris-state-lab",
    JSON.stringify({ ...structuredClone(state), activeId: "boss" }),
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
  if (!raw) {
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
    return s;
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
  state.annotations ||= [];
  state.tourVersion ||= {};
  return state;
}
export function persist(s: State, laboratory = false) {
  localStorage.setItem(laboratory ? "paris-state-lab" : KEY, JSON.stringify(s));
}
