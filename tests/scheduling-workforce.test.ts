import { describe, it, expect, afterEach, vi } from "vitest";
import { defaultSchedule, occurrences } from "../src/domain/schedule";
import {
  seed,
  persist,
  load,
  enterLab,
  exitLab,
  KEY,
} from "../src/data/repository";
import {
  materialize,
  currentMonth,
  dateART,
  transition,
  closeMonth,
} from "../src/domain/model";
import {
  applyClock,
  elapsedSeconds,
  registerAbsence,
  canWork,
  updateProfile,
} from "../src/domain/workforce";
import { reviseAssignment } from "../src/domain/planning";
describe("fechas de cada ocurrencia", () => {
  it("puntual no reaparece al cambiar el mes", () => {
    const r = defaultSchedule("2026-10-09");
    expect(occurrences(r, "2026-10")).toEqual([
      { date: "2026-10-09", due: "2026-10-09" },
    ]);
    expect(occurrences(r, "2026-11")).toEqual([]);
  });
  it("semanal tiene fecha y plazo independientes, incluso al cruzar el mes", () => {
    const r = {
      ...defaultSchedule("2026-10-01", "semanal"),
      weekdays: [6],
      dueOffsetDays: 2,
    };
    const dates = occurrences(r, "2026-10");
    expect(dates).toHaveLength(5);
    expect(dates[4]).toEqual({ date: "2026-10-31", due: "2026-11-02" });
    expect(occurrences(r, "2026-11")[0]).toEqual({
      date: "2026-11-07",
      due: "2026-11-09",
    });
  });
  it("quincenal, fin de recurrencia y fin de mes son explícitos", () => {
    expect(
      occurrences(
        {
          ...defaultSchedule("2026-10-05", "semanal"),
          weekdays: [1],
          interval: 2,
          endDate: "2026-10-20",
        },
        "2026-10",
      ).map((x) => x.date),
    ).toEqual(["2026-10-05", "2026-10-19"]);
    const monthly = {
      ...defaultSchedule("2027-01-01", "mensual"),
      monthDay: 31,
    };
    expect(occurrences(monthly, "2027-02")[0].due).toBe("2027-02-28");
    expect(occurrences(monthly, "2027-03")[0].due).toBe("2027-03-31");
  });
  it("sin vencimiento y fechas inválidas no se confunden", () => {
    expect(
      occurrences(
        { ...defaultSchedule("2026-10-05"), hasDeadline: false },
        "2026-10",
      )[0].due,
    ).toBe("");
    expect(() =>
      occurrences(defaultSchedule("2026-02-31"), "2026-02"),
    ).toThrow();
  });
  it("semana se materializa sin duplicar ni resetear otras empresas", () => {
    let s = seed();
    const a = {
      ...s.assignments[0],
      id: "weekly",
      schedule: {
        ...defaultSchedule("2026-10-01", "semanal"),
        weekdays: [1, 3],
      },
    };
    s = {
      ...s,
      assignments: [a, { ...a, id: "weekly-other", companyId: "c2" }],
      tasks: [],
    };
    s = materialize(s, "2026-10");
    expect(s.tasks).toHaveLength(16);
    s.tasks[0].status = "En curso";
    const again = materialize(s, "2026-10");
    expect(again.tasks).toHaveLength(16);
    expect(again.tasks[0].status).toBe("En curso");
    expect(new Set(again.tasks.map((t) => t.companyId)).size).toBe(2);
  });
  it("reprogramar conserva pasado y bloquea trabajo ya iniciado", () => {
    let s = seed();
    const a = {
      ...s.assignments[0],
      id: "versioned",
      schedule: { ...defaultSchedule("2026-10-01", "mensual"), monthDay: 5 },
    };
    s = materialize(
      materialize({ ...s, assignments: [a], tasks: [] }, "2026-10"),
      "2026-11",
    );
    const oldId = s.tasks[0].id;
    const updated = reviseAssignment(
      s,
      a.id,
      { ...defaultSchedule("2026-11-01", "semanal"), weekdays: [1] },
      "boss",
    );
    expect(updated.tasks.some((t) => t.id === oldId)).toBe(true);
    expect(updated.tasks.filter((t) => t.month === "2026-11")).toHaveLength(5);
    s.tasks[1].status = "En curso";
    expect(() =>
      reviseAssignment(s, a.id, defaultSchedule("2026-11-01"), "boss"),
    ).toThrow("trabajo iniciado");
  });
});
describe("tiempo y cobertura", () => {
  it("un ejecutor cronometra una tarea a la vez, pausa y completa sin seguir sumando", () => {
    let s = seed();
    const tasks = s.tasks
      .filter((t) => t.ownerId === "e0" && t.kind === "resultado")
      .slice(0, 2);
    s.tasks = s.tasks.map((t) =>
      tasks.some((x) => x.id === t.id)
        ? { ...t, status: "Pendiente", blockedBy: "", checklist: [] }
        : t,
    );
    s = applyClock(s, tasks[0].id, "e0", true, "2026-09-30T10:00:00Z");
    s = applyClock(s, tasks[1].id, "e0", true, "2026-09-30T10:05:00Z");
    expect(
      elapsedSeconds(
        s.tasks.find((t) => t.id === tasks[0].id)!,
        "2026-09-30T11:00:00Z",
      ),
    ).toBe(300);
    const t = transition(
      s.tasks.find((t) => t.id === tasks[1].id)!,
      "Completada",
      "2026-09-30T10:07:00Z",
    );
    expect(elapsedSeconds(t, "2026-09-30T11:00:00Z")).toBe(120);
    expect(transition(t, "En curso").reopenCount).toBe(1);
  });
  it("un cierre no permite un cronómetro abierto", () => {
    let s = seed();
    const t = s.tasks.find(
      (t) => t.ownerId === "e0" && t.kind === "operativa",
    )!;
    s = applyClock(s, t.id, "e0", true);
    expect(() =>
      closeMonth(s, "e0", currentMonth(), "boss", "Revisado"),
    ).toThrow("cronómetros");
  });
  it("cobertura vence por fecha y no cambia titular ni equipo", () => {
    let s = seed();
    const a = {
      id: "absence",
      ownerId: "e0",
      replacementId: "e1",
      from: currentMonth() + "-01",
      to: currentMonth() + "-30",
      kind: "Vacaciones" as const,
      note: "Control pendiente",
      createdBy: "boss",
    };
    s = registerAbsence(s, a, "boss");
    const t = s.tasks.find((t) => t.ownerId === "e0")!;
    const p = s.profiles.find((p) => p.id === "e1")!;
    expect(canWork(s, p, t, currentMonth() + "-15")).toBe(true);
    expect(canWork(s, p, t, "2027-01-01")).toBe(false);
    expect(t.ownerId).toBe("e0");
    expect(() => registerAbsence(s, { ...a, id: "duplicate" }, "boss")).toThrow(
      "rango",
    );
    expect(() => registerAbsence(seed(), a, "e0")).toThrow("responsable");
  });
  it("empleado no administra, jefe debe mantener relación válida", () => {
    const s = seed(),
      p = s.profiles.find((p) => p.id === "e0")!;
    expect(() => updateProfile(s, { ...p, name: "Editado" }, "e0")).toThrow(
      "Sólo",
    );
    expect(() => updateProfile(s, { ...p, managerId: "e1" }, "boss")).toThrow(
      "encargado",
    );
    expect(
      updateProfile(
        s,
        { ...p, managerId: "m2", teamId: "t2" },
        "boss",
      ).profiles.find((x) => x.id === p.id)?.managerId,
    ).toBe("m2");
  });
});
describe("laboratorio aislado", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("acciones de prueba no escriben el tablero principal", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => data.get(k) || null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    });
    vi.stubGlobal("location", { reload: vi.fn() });
    const s = seed();
    persist(s);
    const before = data.get(KEY);
    enterLab(s);
    const lab = load();
    lab.tasks = [];
    persist(lab, true);
    expect(data.get(KEY)).toBe(before);
    exitLab();
    persist(lab, true); // An already-open lab tab stays isolated after another tab exits.
    expect(load().tasks.length).toBe(s.tasks.length);
  });
});
