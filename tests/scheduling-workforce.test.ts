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
  cancelAbsence,
  expireCoverageClocks,
  recurringCoveragePreview,
  deactivateProfile,
  reassignOrphanedTask,
  transferOrphanedTask,
  updateProfile,
} from "../src/domain/workforce";
import { reviseAssignment } from "../src/domain/planning";
import { collectTaskNotifications } from "../src/domain/notifications";
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
  it("materializa frecuencia diaria a través de varios meses sin duplicar ni perder plazos", () => {
    const base = seed();
    const assignment = {
      ...base.assignments[0]!, id: "daily-cross-month", frequency: "diaria" as const,
      startMonth: "2026-10", schedule: {
        ...defaultSchedule("2026-10-30", "diaria"), interval: 2, dueOffsetDays: 2,
      },
    };
    const state = { ...base, assignments: [assignment], tasks: [] };
    const october = materialize(state, "2026-10");
    expect(october.tasks.map((task) => task.scheduledOn)).toEqual(["2026-10-30"]);
    const november = materialize(october, "2026-11");
    const daily = november.tasks.filter((task) => task.assignmentId === assignment.id && task.month === "2026-11");
    expect(daily).toHaveLength(15);
    expect(daily[0]).toMatchObject({ scheduledOn: "2026-11-01", due: "2026-11-03" });
    expect(daily.at(-1)).toMatchObject({ scheduledOn: "2026-11-29", due: "2026-12-01" });
    expect(materialize(november, "2026-11").tasks.filter((task) => task.assignmentId === assignment.id)).toHaveLength(16);
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
    const t = s.tasks.find((t) => t.ownerId === "e0")!;
    const other = s.tasks.find((x) => x.ownerId === "e0" && x.id !== t.id && x.companyId === t.companyId)!;
    s = registerAbsence(s, { ...a, taskIds: [t.id] }, "boss");
    const p = s.profiles.find((p) => p.id === "e1")!;
    expect(canWork(s, p, t, currentMonth() + "-15")).toBe(true);
    expect(canWork(s, p, other, currentMonth() + "-15")).toBe(false);
    expect(canWork(s, p, t, "2027-01-01")).toBe(false);
    expect(t.ownerId).toBe("e0");
    expect(() => registerAbsence(s, { ...a, id: "duplicate", taskIds: [t.id] }, "boss")).toThrow(
      "rango",
    );
    expect(() => registerAbsence(seed(), a, "e0")).toThrow("responsable");
  });
  it("revoca acceso y detiene sólo el reloj del reemplazo al cancelar o vencer", () => {
    const base = seed();
    const task = base.tasks.find((item) => item.ownerId === "e0" && item.status !== "Completada" && !item.blockedBy)!;
    const day = task.due || task.scheduledOn || currentMonth() + "-15";
    const absence = {
      id: "clock-coverage", ownerId: "e0", replacementId: "e1", taskIds: [task.id],
      from: currentMonth() + "-01", to: currentMonth() + "-31",
      kind: "Vacaciones" as const, note: "", createdBy: "boss",
    };
    let s = registerAbsence(base, absence, "boss");
    s = applyClock(s, task.id, "e0", true, `${day}T11:00:00-03:00`);
    s = applyClock(s, task.id, "e1", true, `${day}T12:00:00-03:00`);
    s = cancelAbsence(s, absence.id, "boss", `${day}T14:00:00-03:00`);
    const sessions = s.tasks.find((item) => item.id === task.id)?.sessions || [];
    expect(sessions.find((session) => session.actorId === "e1")?.end).toBe(`${day}T14:00:00-03:00`);
    expect(sessions.find((session) => session.actorId === "e0")?.end).toBeNull();
    expect(canWork(s, s.profiles.find((profile) => profile.id === "e1")!, task, day)).toBe(false);

    const future = { ...absence, id: "expired-clock", from: "2026-10-01", to: "2026-10-31" };
    let expired = registerAbsence(base, future, "boss");
    expired = applyClock(expired, task.id, "e1", true, "2026-10-31T18:00:00-03:00");
    expired = expireCoverageClocks(expired, "2026-11-01");
    expect(expired.tasks.find((item) => item.id === task.id)?.sessions?.at(-1)?.end).toBe("2026-11-01T02:59:59.999Z");
  });
  it("un encargado cubre tareas elegidas sólo dentro de su equipo", () => {
    const s = seed();
    const task = s.tasks.find((t) => t.ownerId === "e0" && t.status !== "Completada")!;
    const absence = {
      id: "team-coverage", ownerId: "e0", replacementId: "e6",
      from: currentMonth() + "-01", to: currentMonth() + "-31",
      kind: "Licencia" as const, note: "", createdBy: "m1", taskIds: [task.id],
    };
    expect(() => registerAbsence(s, absence, "m1")).toThrow("ámbito");
    expect(registerAbsence(s, { ...absence, replacementId: "e1" }, "m1").absences).toHaveLength(1);
    expect(() => registerAbsence(s, { ...absence, replacementId: "e1", taskIds: [] }, "m1")).toThrow("regla recurrente");
  });
  it("incluye ocurrencias futuras de una regla seleccionada y no duplica su acceso al materializar", () => {
    const base = seed();
    const assignment = {
      ...base.assignments[0]!, id: "selected-recurring-rule", ownerId: "e0", companyId: "c1",
      frequency: "mensual" as const, startMonth: "2026-10", day: 12,
      schedule: { ...defaultSchedule("2026-10-01", "mensual"), monthDay: 12, hasDeadline: false },
    };
    const s0 = { ...base, assignments: [assignment], tasks: [], closures: [] };
    const absence = {
      id: "recurring-coverage", ownerId: "e0", replacementId: "e1", assignmentIds: [assignment.id],
      from: "2026-11-01", to: "2026-11-30", kind: "Vacaciones" as const,
      note: "", createdBy: "boss",
    };
    const approved = registerAbsence(s0, absence, "boss");
    expect(recurringCoveragePreview(approved, "e0", absence.from, absence.to, "e1")).toMatchObject([
      { assignmentId: assignment.id, dates: ["2026-11-12"] },
    ]);
    const once = materialize(approved, "2026-11");
    const twice = materialize(once, "2026-11");
    expect(twice.tasks).toHaveLength(1);
    expect(twice.tasks[0]?.id).toBe(once.tasks[0]?.id);
    const replacement = twice.profiles.find((profile) => profile.id === "e1")!;
    expect(canWork(twice, replacement, twice.tasks[0]!, "2026-11-12")).toBe(true);
    expect(canWork(twice, replacement, twice.tasks[0]!, "2026-12-01")).toBe(false);
    let working = applyClock(twice, twice.tasks[0]!.id, "e1", true, "2026-11-12T12:00:00Z");
    working = cancelAbsence(working, absence.id, "boss", "2026-11-12T13:00:00Z");
    expect(working.tasks[0]?.sessions?.[0]?.end).toBe("2026-11-12T13:00:00Z");
    expect(canWork(working, replacement, working.tasks[0]!, "2026-11-12")).toBe(false);
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
    expect(() => updateProfile(s, { ...p, active: false }, "boss")).toThrow("flujo de baja");
  });
  it("desactiva conservando historia, pausa reglas/relojes y prepara sólo el futuro elegible", () => {
    const at = "2026-10-06T15:00:00.000Z";
    const base = seed();
    const [ready, started, closed] = base.tasks.filter((task) => task.ownerId === "e0").slice(0, 3);
    const tasks = [...base.tasks.filter((task) => task.ownerId !== "e0"), ...base.tasks.filter((task) => task.ownerId === "e0").slice(0, 3).map((task) => task.id === ready.id
      ? { ...task, status: "Pendiente" as const, due: "2026-11-20", scheduledOn: "2026-11-20", sessions: [], startedAt: null, checklist: task.checklist.map((check) => ({ ...check, done: false })), completedAt: null }
      : task.id === started.id
        ? { ...task, status: "En curso" as const, due: "2026-11-21", scheduledOn: "2026-11-21", sessions: [{ id: "open-clock", actorId: "e0", start: at, end: null }], completedAt: null }
        : task.id === closed.id
          ? { ...task, status: "Completada" as const, completedAt: at }
          : task)];
    const state = { ...base, tasks, activity: base.activity.filter((entry) => entry.taskId !== ready.id && entry.taskId !== started.id) };
    const former = state.profiles.find((person) => person.id === "e0")!;
    const result = deactivateProfile(state, { ...former, active: false }, "boss", "Cambio de puesto", at);
    expect(result.profiles.find((person) => person.id === "e0")?.active).toBe(false);
    expect(result.assignments.filter((assignment) => assignment.ownerId === "e0").every((assignment) => assignment.retired)).toBe(true);
    expect(result.tasks.find((task) => task.id === started.id)?.sessions?.[0]?.end).toBe(at);
    expect(result.tasks.find((task) => task.id === closed.id)?.ownerId).toBe("e0");
    expect(result.orphanedWork).toHaveLength(2);
    expect(result.orphanedWork?.find((item) => item.taskId === ready.id)).toMatchObject({
      formerOwnerId: "e0", formerOwnerName: "Valentino Magni", companyId: ready.companyId,
      resolution: "ready", status: "pending", reason: "Cambio de puesto",
    });
    expect(result.orphanedWork?.find((item) => item.taskId === started.id)?.resolution).toBe("handoff_required");
    const returned = updateProfile(result, { ...former, active: true }, "boss");
    expect(returned.assignments.filter((assignment) => assignment.ownerId === "e0").every((assignment) => assignment.retired)).toBe(true);
  });
  it("reasigna una tarea futura una sola vez y no materializa una segunda ocurrencia", () => {
    const at = "2026-10-06T15:00:00.000Z";
    const base = seed();
    const task = base.tasks.find((row) => row.ownerId === "e0")!;
    const adjusted = { ...task, status: "Pendiente" as const, due: "2026-11-20", scheduledOn: "2026-11-20", sessions: [], startedAt: null, checklist: task.checklist.map((check) => ({ ...check, done: false })), completedAt: null };
    const before = { ...base, tasks: base.tasks.map((row) => row.id === task.id ? adjusted : row), activity: base.activity.filter((entry) => entry.taskId !== task.id) };
    const former = before.profiles.find((person) => person.id === "e0")!;
    const retired = deactivateProfile(before, { ...former, active: false }, "boss", "Baja de equipo", at);
    const item = retired.orphanedWork?.find((row) => row.taskId === task.id)!;
    const reassigned = reassignOrphanedTask(retired, item.id, "e1", "boss", at);
    expect(reassigned.tasks.find((row) => row.id === task.id)).toMatchObject({ ownerId: "e1", teamId: "t1" });
    expect(reassigned.orphanedWork?.find((row) => row.id === item.id)).toMatchObject({ status: "reassigned", assignedTo: "e1", resolvedBy: "boss" });
    expect(() => reassignOrphanedTask(reassigned, item.id, "e2", "boss", at)).toThrow("explícito");
    expect(materialize(reassigned, "2026-11").tasks.filter((row) => row.id === task.id)).toHaveLength(1);
  });
  it("traspasa trabajo iniciado con historial íntegro y atribuye el tiempo a quien lo registró", () => {
    const at = "2026-10-06T15:00:00.000Z";
    const base = seed();
    const task = base.tasks.find((row) => row.ownerId === "e0" && row.kind === "resultado")!;
    const started = {
      ...task,
      status: "En curso" as const,
      startedAt: "2026-10-05T10:00:00.000Z",
      sessions: [{ id: "former-session", actorId: "e0", start: "2026-10-05T10:00:00.000Z", end: null }],
    };
    const activity = { id: "prior-activity", taskId: task.id, actorId: "e0", date: task.month + "-05", qty: 1, note: "Avance previo", createdAt: "2026-10-05T11:00:00.000Z" };
    const comment = { id: "prior-comment", taskId: task.id, actorId: "e0", content: "Control iniciado", createdAt: "2026-10-05T11:05:00.000Z" };
    const before = { ...base, tasks: base.tasks.map((row) => row.id === task.id ? started : row), activity: [...base.activity, activity], taskComments: [comment] };
    const former = before.profiles.find((person) => person.id === "e0")!;
    const retired = deactivateProfile(before, { ...former, active: false }, "boss", "Cambio de puesto", at);
    const item = retired.orphanedWork?.find((row) => row.taskId === task.id)!;
    expect(item.resolution).toBe("handoff_required");
    expect(retired.tasks.find((row) => row.id === task.id)?.sessions?.[0]?.end).toBe(at);
    const transferred = transferOrphanedTask(retired, item.id, "e1", "boss", "Continuidad del cierre mensual", at);
    const moved = transferred.tasks.find((row) => row.id === task.id)!;
    const record = transferred.taskTransfers?.[0]!;
    expect(moved).toMatchObject({ ownerId: "e1", teamId: "t1" });
    expect(moved.sessions).toEqual(retired.tasks.find((row) => row.id === task.id)?.sessions);
    expect(transferred.orphanedWork?.find((row) => row.id === item.id)).toMatchObject({ status: "transferred", assignedTo: "e1", resolvedBy: "boss" });
    expect(record).toMatchObject({ formerOwnerId: "e0", newOwnerId: "e1", reason: "Continuidad del cierre mensual" });
    expect(record.taskSnapshot.ownerId).toBe("e0");
    expect(record.sessions[0]).toMatchObject({ id: "former-session", actorId: "e0", end: at });
    expect(record.activity).toEqual([activity]);
    expect(record.comments).toEqual([comment]);
    expect(() => transferOrphanedTask(transferred, item.id, "e2", "boss", "Segundo traspaso")).toThrow("explícito");
    const notified = collectTaskNotifications(retired, transferred, "boss");
    expect(notified.notifications?.filter((notice) => notice.taskId === task.id && notice.kind === "assigned").map((notice) => notice.recipientId).sort()).toEqual(["e1", "m1"]);

    const closure = closeMonth(transferred, "e1", task.month, "boss", "Controlado por jefatura");
    const report = closure.closures.at(-1)?.report!;
    expect(closure.closures.at(-1)?.taskTransfers).toEqual([record]);
    expect(report.transfers).toEqual([expect.objectContaining({ taskId: task.id, formerOwner: "Valentino Magni", newOwner: "Lucía Fernández" })]);
    expect(report.recordedSeconds).toBe(0);
    expect(report.groups.find((group) => group.process === task.title)?.recordedSeconds).toBe(0);
  });
  it("requiere reasignar subordinados antes de dar de baja a su encargado", () => {
    const s = seed();
    const manager = s.profiles.find((person) => person.id === "m1")!;
    expect(() => deactivateProfile(s, { ...manager, active: false }, "boss", "Cambio de sector")).toThrow("personas a cargo");
  });
  it("revoca coberturas vigentes del perfil dado de baja y corta el reloj del reemplazo", () => {
    const base = seed();
    const task = base.tasks.find((row) => row.ownerId === "e0")!;
    const dated = { ...task, status: "Pendiente" as const, due: "2026-11-20", scheduledOn: "2026-11-20", sessions: [], completedAt: null, blockedBy: "", blockedSince: null, checklist: task.checklist.map((check) => ({ ...check, done: false })) };
    const clean = { ...base, tasks: base.tasks.map((row) => row.id === task.id ? dated : row), activity: base.activity.filter((entry) => entry.taskId !== task.id) };
    const absence = { id: "temporary-cover", ownerId: "e0", replacementId: "e1", taskIds: [task.id], from: "2026-11-01", to: "2026-11-30", kind: "Licencia" as const, note: "", createdBy: "boss" };
    const approved = registerAbsence(clean, absence, "boss");
    const working = applyClock(approved, task.id, "e1", true, "2026-11-20T10:00:00.000Z");
    const owner = working.profiles.find((person) => person.id === "e0")!;
    const retired = deactivateProfile(working, { ...owner, active: false }, "boss", "Baja de equipo", "2026-11-20T13:00:00.000Z");
    expect(retired.absences?.find((row) => row.id === absence.id)?.cancelledAt).toBe("2026-11-20T13:00:00.000Z");
    expect(retired.tasks.find((row) => row.id === task.id)?.sessions?.find((session) => session.actorId === "e1")?.end).toBe("2026-11-20T13:00:00.000Z");
    expect(canWork(retired, retired.profiles.find((person) => person.id === "e1")!, retired.tasks.find((row) => row.id === task.id)!, "2026-11-20")).toBe(false);
  });
  it("persiste y vuelve a cargar bajas cuya asignación original era diaria", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key) || null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });
    const base = seed();
    const assignment = base.assignments.find((row) => row.ownerId === "e0")!;
    const dailyAssignment = {
      ...assignment, frequency: "diaria" as const,
      schedule: { ...defaultSchedule(base.tasks[0]!.month + "-01", "diaria"), interval: 1 },
    };
    const task = base.tasks.find((row) => row.assignmentId === assignment.id)!;
    const state = {
      ...base,
      assignments: base.assignments.map((row) => row.id === assignment.id ? dailyAssignment : row),
      tasks: base.tasks.map((row) => row.id === task.id
        ? { ...row, status: "En curso" as const, startedAt: "2026-10-05T10:00:00.000Z", completedAt: null }
        : row),
    };
    const former = state.profiles.find((person) => person.id === "e0")!;
    const retired = deactivateProfile(state, { ...former, active: false }, "boss", "Cambio de puesto", "2026-10-06T15:00:00.000Z");
    expect(retired.orphanedWork?.find((row) => row.taskId === task.id)?.assignmentSnapshot?.frequency).toBe("diaria");
    persist(retired);
    expect(load().orphanedWork?.find((row) => row.taskId === task.id)?.assignmentSnapshot?.frequency).toBe("diaria");
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
    s.orphanedWork = [{
      id: "orphan-persist", taskId: s.tasks[0]!.id, formerOwnerId: "e0",
      formerOwnerName: "Valentino Magni", companyId: "c1", assignmentSnapshot: null,
      reason: "Cambio de puesto", createdAt: "2026-10-06T15:00:00.000Z",
      resolution: "ready", status: "pending",
    }];
    s.taskTransfers = [{
      id: "transfer-persist", taskId: s.tasks[0]!.id, formerOwnerId: "e0", formerOwnerName: "Valentino Magni",
      newOwnerId: "e1", newOwnerName: "Lucía Fernández", companyId: s.tasks[0]!.companyId,
      reason: "Continuidad del cierre mensual", transferredAt: "2026-10-06T15:00:00.000Z", transferredBy: "boss",
      taskSnapshot: structuredClone(s.tasks[0]!), sessions: [], activity: [], comments: [],
    }];
    persist(s);
    const before = data.get(KEY);
    enterLab(s);
    const lab = load();
    expect(lab.orphanedWork).toEqual(s.orphanedWork);
    expect(lab.taskTransfers).toEqual(s.taskTransfers);
    lab.tasks = [];
    persist(lab, true);
    expect(data.get(KEY)).toBe(before);
    exitLab();
    persist(lab, true); // An already-open lab tab stays isolated after another tab exits.
    expect(load().tasks.length).toBe(s.tasks.length);
  });
});
