import { describe, expect, it } from "vitest";
import type { Activity, Profile, State, Task } from "../src/domain/model";
import {
  applyCompletionAttribution,
  buildWorkCycle,
} from "../src/domain/workCycle";

const profiles: Profile[] = [
  {
    id: "a",
    name: "Ana",
    role: "empleado",
    managerId: "j",
    teamId: "ta",
    sector: "Impuestos",
    branch: "A",
    position: "Analista",
    companyIds: ["c"],
    active: true,
  },
  {
    id: "b",
    name: "Bruno",
    role: "empleado",
    managerId: "j",
    teamId: "tb",
    sector: "Tesorería",
    branch: "B",
    position: "Analista",
    companyIds: ["c"],
    active: true,
  },
];
const state = {
  profiles,
  companies: [{ id: "c", name: "Empresa París" }],
  teams: [
    { id: "ta", name: "Equipo de Ana", managerId: "j" },
    { id: "tb", name: "Equipo de Bruno", managerId: "j" },
  ],
} as Pick<State, "profiles" | "companies" | "teams">;
const task = (patch: Partial<Task> = {}): Task => ({
  id: "task",
  assignmentId: "assignment",
  title: "Conciliación",
  ownerId: "a",
  companyId: "c",
  teamId: "ta",
  sector: "Impuestos",
  month: "2026-10",
  due: "2026-10-31",
  scheduledOn: "2026-10-01",
  kind: "resultado",
  weight: 10,
  unit: "",
  target: 0,
  status: "Pendiente",
  checklist: [],
  completedAt: null,
  startedAt: null,
  priority: "Media",
  blockedBy: "",
  blockedSince: null,
  sessions: [],
  ...patch,
});
const build = (
  tasks: Task[],
  activity: Activity[] = [],
  mode: "day" | "week" = "day",
  dimension: "company" | "person" | "team" | "sector" = "company",
) =>
  buildWorkCycle({
    tasks,
    activity,
    state,
    month: "2026-10",
    mode,
    dimension,
    asOfISO: "2026-10-20T12:00:00.000Z",
  });

describe("ciclo mensual de trabajo", () => {
  it("sella el actor al completar, borra la atribución al reabrir y conserva cierres importados sin actor", () => {
    const pending = task();
    const completed = task({ status: "Completada", completedAt: "2026-10-02T12:00:00.000Z" });
    expect(applyCompletionAttribution([pending], [completed], "b")[0].completedBy).toBe("b");
    const reopened = task({ status: "En curso", completedAt: null, completedBy: "a" });
    expect(applyCompletionAttribution([completed], [reopened], "b")[0]).not.toHaveProperty("completedBy");
    const imported = task({ status: "Completada", completedAt: "2026-10-02T12:00:00.000Z" });
    expect(applyCompletionAttribution([], [imported], "b")[0]).not.toHaveProperty("completedBy");
  });

  it("genera todos los días y semanas parciales del mes sin perder el último día", () => {
    const daily = build([], [], "day");
    expect(daily.buckets).toHaveLength(31);
    expect(daily.buckets[0]).toMatchObject({
      start: "2026-10-01",
      end: "2026-10-01",
    });
    expect(daily.buckets.at(-1)).toMatchObject({
      start: "2026-10-31",
      end: "2026-10-31",
    });
    const weekly = build([], [], "week");
    expect(weekly.buckets.map(({ start, end }) => [start, end])).toEqual([
      ["2026-10-01", "2026-10-04"],
      ["2026-10-05", "2026-10-11"],
      ["2026-10-12", "2026-10-18"],
      ["2026-10-19", "2026-10-25"],
      ["2026-10-26", "2026-10-31"],
    ]);
  });

  it("reparte la planificación conjunta por cuota pero cuenta una ocurrencia global", () => {
    const joint = task({
      responsibility: {
        version: 1,
        revision: 1,
        mode: "joint",
        activatedAt: "2026-09-30T12:00:00Z",
        activatedBy: "j",
        reason: "Revisión",
        members: [
          {
            profileId: "a",
            shareBps: 6000,
            name: "Ana",
            teamId: "ta",
            sector: "Impuestos",
          },
          {
            profileId: "b",
            shareBps: 4000,
            name: "Bruno",
            teamId: "tb",
            sector: "Tesorería",
          },
        ],
      },
    });
    const total = build([joint]);
    expect(total.buckets[0].plannedOccurrences).toBe(1);
    expect(total.buckets[0].plannedPoints).toBe(10);
    const byPerson = build([joint], [], "day", "person");
    expect(
      byPerson.groups.map((group) => [
        group.key,
        group.plannedOccurrences,
        group.plannedPoints,
      ]),
    ).toEqual([
      ["a", 0.6, 6],
      ["b", 0.4, 4],
    ]);
  });

  it("atribuye los cierres nuevos al actor registrado y conserva los anteriores sin adjudicación", () => {
    const newClosure = task({
      status: "Completada",
      completedAt: "2026-10-02T15:30:00.000Z",
      completedBy: "b",
    });
    const historicClosure = task({
      id: "historic",
      scheduledOn: undefined,
      status: "Completada",
      completedAt: "2026-10-03T15:30:00.000Z",
    });
    const result = build([newClosure, historicClosure], [], "day", "person");
    expect(result.buckets[1].completedTasks).toBe(1);
    expect(result.buckets[2].completedTasks).toBe(1);
    expect(result.unattributedClosures).toBe(1);
    expect(
      result.groups.find((group) => group.key === "b")?.completedPoints,
    ).toBe(10);
    expect(
      result.groups.find((group) => group.key === "unattributed")
        ?.completedTasks,
    ).toBe(1);
  });

  it("distribuye una sesión que cruza medianoche por fecha argentina", () => {
    const withSession = task({
      sessions: [
        {
          id: "s",
          actorId: "a",
          start: "2026-10-02T02:30:00.000Z",
          end: "2026-10-02T03:30:00.000Z",
        },
      ],
    });
    const result = build([withSession]);
    expect(result.buckets[0].recordedSeconds).toBe(1800);
    expect(result.buckets[1].recordedSeconds).toBe(1800);
    expect(result.buckets[0].hasExecutionEvidence).toBe(true);
  });

  it("atribuye registros operativos al ejecutor y conserva cantidades por unidad", () => {
    const invoiceTask = task({
      id: "invoice",
      kind: "operativa",
      unit: "facturas",
      weight: 2,
    });
    const paymentTask = task({
      id: "payment",
      kind: "operativa",
      unit: "pagos",
      weight: 3,
    });
    const activity: Activity[] = [
      {
        id: "x",
        taskId: "invoice",
        date: "2026-10-06",
        qty: 3,
        note: "",
        createdAt: "2026-10-06T14:00:00.000Z",
        actorId: "b",
      },
      {
        id: "y",
        taskId: "payment",
        date: "2026-10-06",
        qty: 2,
        note: "",
        createdAt: "2026-10-06T15:00:00.000Z",
        actorId: "a",
      },
    ];
    const result = build([invoiceTask, paymentTask], activity, "day", "person");
    expect(result.buckets[5].operationalRecords).toBe(2);
    expect(result.buckets[5].operationalAmounts).toEqual({
      facturas: 3,
      pagos: 2,
    });
    expect(
      result.groups.find((group) => group.key === "b")?.operationalAmounts,
    ).toEqual({ facturas: 3 });
    expect(
      result.groups.find((group) => group.key === "a")?.operationalAmounts,
    ).toEqual({ pagos: 2 });
  });

  it("no usa el vencimiento como sustituto de la fecha planificada", () => {
    const withoutSchedule = task({ scheduledOn: undefined, due: "2026-10-04" });
    const result = build([withoutSchedule]);
    expect(result.buckets[3].plannedOccurrences).toBe(0);
    expect(result.buckets[0].plannedPoints).toBe(0);
  });
});
