import { describe, it, expect } from "vitest";
import { seed } from "../src/data/repository";
import {
  transition,
  checkTask,
  metrics,
  materialize,
  closeMonth,
  taskQuantity,
  canSee,
  dateART,
  dueDate,
  currentMonth,
  csvCell,
  type Task,
} from "../src/domain/model";
const base = (): Task => ({
  id: "a",
  assignmentId: null,
  title: "Conciliación",
  ownerId: "e0",
  companyId: "c1",
  teamId: "t1",
  sector: "Tesorería",
  month: "2026-09",
  due: "2026-09-30",
  kind: "resultado",
  weight: 5,
  unit: "",
  target: 0,
  status: "Pendiente",
  checklist: [{ id: "x", text: "Paso", done: false }],
  completedAt: null,
  startedAt: null,
  priority: "Media",
  blockedBy: "",
  blockedSince: null,
});
describe("reglas independientes de las pantallas", () => {
  it("no cierra pendiente ni checklist incompleto", () => {
    expect(() => transition(base(), "Completada")).toThrow();
    expect(() =>
      transition({ ...base(), status: "En curso" }, "Completada"),
    ).toThrow();
  });
  it("último checklist inicia y termina, sin mutar la otra empresa", () => {
    let a = base(),
      b = { ...base(), id: "b", companyId: "c2" };
    a = checkTask(a, "x", true);
    expect(a.status).toBe("Completada");
    expect(a.startedAt).toBeTruthy();
    expect(b.status).toBe("Pendiente");
    expect(b.checklist[0].done).toBe(false);
  });
  it("no completa una espera externa y desmarcar reabre", () => {
    expect(
      checkTask({ ...base(), blockedBy: "Ventas" }, "x", true).status,
    ).toBe("En curso");
    expect(checkTask(checkTask(base(), "x", true), "x", false).status).toBe(
      "En curso",
    );
  });
  it("operativas no terminan por botón y filtran sus registros por mes", () => {
    const t = { ...base(), kind: "operativa" as const, target: 100 };
    expect(() =>
      transition({ ...t, status: "En curso" }, "Completada"),
    ).toThrow();
    expect(
      taskQuantity(t, [
        {
          id: "1",
          taskId: "a",
          date: "2026-08-30",
          qty: 100,
          note: "",
          createdAt: "",
          actorId: "",
        },
        {
          id: "2",
          taskId: "a",
          date: "2026-09-30",
          qty: 40,
          note: "",
          createdAt: "",
          actorId: "",
        },
      ]),
    ).toBe(40);
  });
  it("KPI ponderado usa puntos y proporción, no cantidad de tareas", () => {
    let a = {
        ...base(),
        status: "Completada" as const,
        completedAt: "2026-09-30T23:30:00Z",
      },
      b = {
        ...base(),
        id: "b",
        weight: 3,
        kind: "operativa" as const,
        target: 100,
      };
    const logs = [
      {
        id: "l",
        taskId: "b",
        date: "2026-09-30",
        qty: 50,
        note: "",
        createdAt: "",
        actorId: "",
      },
    ];
    expect(metrics([a, b], logs).earned).toBe(6.5);
    expect(metrics([a, b], logs).weighted).toBe(81);
    logs[0].qty = 200;
    expect(metrics([a, b], logs).weighted).toBe(100);
  });
  it("puntualidad en Argentina y sin datos no es cero", () => {
    expect(dateART("2026-10-01T02:30:00Z")).toBe("2026-09-30");
    expect(metrics([], []).weighted).toBeNull();
    expect(metrics([], []).onTime).toBeNull();
  });
  it("recurrencia idempotente y ajusta febrero", () => {
    let s = seed();
    s = materialize(s, currentMonth());
    const n = s.tasks.length;
    s = materialize(s, currentMonth());
    expect(s.tasks).toHaveLength(n);
    expect(dueDate("2027-02", 31)).toBe("2027-02-28");
  });
  it("cierre conserva foto y no se duplica", () => {
    let s = seed();
    const month = currentMonth();
    s = closeMonth(s, "e0", month, "boss", "Revisado");
    const before = s.closures[0].tasks[0].title;
    const t = s.tasks.find((t) => t.id === s.closures[0].tasks[0].id)!;
    t.title = "Cambio";
    expect(s.closures[0].tasks[0].title).toBe(before);
    expect(() => closeMonth(s, "e0", month, "boss", "")).toThrow();
  });
  it("rechaza que una jefatura dada de baja cierre un período", () => {
    const s = seed();
    s.profiles = s.profiles.map((p) => p.id === "boss" ? { ...p, active: false } : p);
    expect(() => closeMonth(s, "e0", currentMonth(), "boss", "Revisado"))
      .toThrow("El cierre requiere un responsable de este empleado.");
  });
  it("ámbito jerárquico de demostración", () => {
    const s = seed();
    const manager = s.profiles.find((p) => p.id === "m1")!;
    expect(canSee(manager, "e0", s.profiles)).toBe(true);
    expect(canSee(manager, "e9", s.profiles)).toBe(false);
    expect(
      canSee(
        s.profiles.find((p) => p.id === "e0")!,
        "e1",
        s.profiles,
      ),
    ).toBe(false);
  });
  it("CSV neutraliza fórmulas y conserva comillas", () => {
    expect(csvCell("=1+1")).toBe('"\'=1+1"');
    expect(csvCell('a"b')).toBe('"a""b"');
  });
});
