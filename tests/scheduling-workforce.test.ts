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
  isClosed,
  metrics,
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
  presenceStatus,
  canViewPresence,
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
    const inactiveBoss = { ...s, profiles: s.profiles.map((profile) => profile.id === "boss" ? { ...profile, active: false } : profile) };
    expect(() => reviseAssignment(inactiveBoss, a.id, defaultSchedule("2026-12-01"), "boss")).toThrow(/jefatura/i);
    s.tasks[1].status = "En curso";
    expect(() =>
      reviseAssignment(s, a.id, defaultSchedule("2026-11-01"), "boss"),
    ).toThrow("trabajo iniciado");
  });

  it("no elimina tareas alcanzadas por dependencias o referencias aunque sigan pendientes", () => {
    let state = seed();
    const assignment = { ...state.assignments[0], id: "referenced-rule", schedule: { ...defaultSchedule("2026-10-01", "mensual"), monthDay: 5 } };
    state = materialize(materialize({ ...state, assignments: [assignment], tasks: [] }, "2026-10"), "2026-11");
    const affected = state.tasks.find((task) => task.month === "2026-11")!;
    const linked = { ...state, taskComments: [{ id: "comment-1", taskId: affected.id, actorId: "boss", content: "Seguimiento", createdAt: "2026-10-10T00:00:00Z" }] };
    expect(() => reviseAssignment(linked, assignment.id, defaultSchedule("2026-11-01"), "boss")).toThrow(/referencias, progreso comercial o dependencias/);
    expect(linked.tasks.some((task) => task.id === affected.id)).toBe(true);
    const dependent = { ...state, tasks: state.tasks.map((task) => task.month === "2026-10" ? { ...task, dependsOnTaskIds: [affected.id] } : task) };
    expect(() => reviseAssignment(dependent, assignment.id, defaultSchedule("2026-11-01"), "boss")).toThrow(/referencias, progreso comercial o dependencias/);
  });

  it("conserva tareas pendientes con fecha explícita de disponibilidad al reemplazar una recurrencia", () => {
    let state = seed();
    const assignment = { ...state.assignments[0], id: "available-from-rule", schedule: { ...defaultSchedule("2026-10-01", "mensual"), monthDay: 5 } };
    state = materialize(materialize({ ...state, assignments: [assignment], tasks: [] }, "2026-10"), "2026-11");
    const affected = state.tasks.find((task) => task.month === "2026-11")!;
    const withExplicitAvailability = { ...state, tasks: state.tasks.map((task) => task.id === affected.id ? { ...task, availableFrom: "2026-11-10" } : task) };

    expect(() => reviseAssignment(withExplicitAvailability, assignment.id, defaultSchedule("2026-11-01"), "boss")).toThrow(/referencias, progreso comercial o dependencias/);
    expect(withExplicitAvailability.tasks.some((task) => task.id === affected.id)).toBe(true);
    expect(reviseAssignment(state, assignment.id, defaultSchedule("2026-11-01"), "boss").tasks.some((task) => task.id === affected.id)).toBe(false);
  });

  it("protege operativas vinculadas a coeficientes o evaluaciones y conserva respaldo válido", () => {
    let state = seed();
    const assignment = state.assignments.find((row) => state.templates.find((template) => template.id === row.templateId)?.kind === "operativa")!;
    const recurring = { ...assignment, id: "rate-linked-rule", schedule: { ...defaultSchedule("2026-10-01", "mensual"), monthDay: 5 } };
    state = materialize(materialize({ ...state, assignments: [recurring], tasks: [] }, "2026-10"), "2026-11");
    const affected = state.tasks.find((task) => task.month === "2026-11")!;
    const rate = { id: "rate-linked", templateId: null, taskId: affected.id, companyId: affected.companyId, effectiveOn: "2026-11-01", unitWeight: 1, version: 1, createdAt: "2026-10-01T12:00:00.000Z", createdBy: "boss" };
    const linked = { ...state, operationalRates: [rate] };

    expect(() => reviseAssignment(linked, recurring.id, defaultSchedule("2026-11-01"), "boss")).toThrow(/referencias, progreso comercial o dependencias/);
    expect(linked.tasks.some((task) => task.id === affected.id)).toBe(true);
    expect(linked.operationalRates).toEqual([rate]);
  });
});
describe("tiempo y cobertura", () => {
  it("expira la presencia real a los 90 segundos y distingue la señal simulada", () => {
    const now = Date.parse("2026-10-08T15:00:00.000Z");
    expect(presenceStatus("e0", "boss", false, "2026-10-08T14:58:30.000Z", now)).toMatchObject({ online: true, label: "En línea" });
    expect(presenceStatus("e0", "boss", false, "2026-10-08T14:58:29.999Z", now)).toMatchObject({ online: false });
    expect(presenceStatus("e0", "boss", false, undefined, now)).toEqual({ online: false, label: "Sin señal registrada" });
    expect(presenceStatus("boss", "boss", true, undefined, now)).toEqual({ online: true, label: "En línea · simulación" });
    expect(presenceStatus("e0", "boss", true, undefined, now)).toEqual({ online: false, label: "Sin sesión · simulación" });
  });

  it("el reloj rechaza una tarea dependiente y permite pausar un reloj que ya estaba activo", () => {
    const base = seed();
    const month = currentMonth();
    const source = base.tasks.find((task) => task.ownerId === "e0" && task.companyId === "c1" && task.kind === "resultado")!;
    const prerequisite = { ...source, status: "Pendiente" as const, blockedBy: "", sessions: [] };
    const dependent = { ...prerequisite, id: "clock-dependent", title: "Cierre posterior", dependsOnTaskIds: [prerequisite.id] };
    const state = { ...base, tasks: [...base.tasks.filter((task) => task.id !== source.id), prerequisite, dependent] };
    expect(() => applyClock(state, dependent.id, "e0", true, `${month}-08T12:00:00.000Z`)).toThrow(/Espera/i);
    expect(() => applyClock(state, prerequisite.id, "boss", true, `${month}-08T12:00:00.000Z`)).toThrow(/fuera de tu ámbito/i);
    const running = { ...dependent, status: "En curso" as const, sessions: [{ id: "existing-clock", actorId: "e0", start: `${month}-08T11:00:00.000Z`, end: null }] };
    const runningState = { ...state, tasks: state.tasks.map((task) => task.id === dependent.id ? running : task) };
    const paused = applyClock(runningState, dependent.id, "e0", false, `${month}-08T12:00:00.000Z`);
    expect(paused.tasks.find((task) => task.id === dependent.id)?.sessions?.[0]?.end).toBe(`${month}-08T12:00:00.000Z`);
  });

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
  it("permite registrar ausencia sin cobertura y limita presencia a jefatura/equipo autorizado", () => {
    const state = seed();
    const manager = state.profiles.find((profile) => profile.id === "m1")!;
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    const peerManager = state.profiles.find((profile) => profile.id === "m2")!;
    const absence = {
      id: "absence-without-replacement", ownerId: employee.id, replacementId: "", taskIds: [], assignmentIds: [],
      from: "2026-11-10", to: "2026-11-12", kind: "Licencia" as const, note: "", createdBy: manager.id,
    };
    expect(registerAbsence(state, absence, manager.id).absences).toContainEqual(absence);
    expect(canViewPresence(state, manager, employee.id)).toBe(true);
    expect(canViewPresence(state, peerManager, employee.id)).toBe(false);
    expect(canViewPresence(state, employee, manager.id)).toBe(false);
    const revokedManager = { ...manager, companyIds: [] };
    const revoked = { ...state, profiles: state.profiles.map((profile) => profile.id === manager.id ? revokedManager : profile) };
    expect(canViewPresence(revoked, manager, employee.id)).toBe(false);
    expect(canViewPresence({ ...state, profiles: state.profiles.map((profile) => profile.id === employee.id ? { ...profile, active: false } : profile) }, manager, employee.id)).toBe(false);
  });
  it("rechaza cobertura de tareas y reglas en empresas revocadas al encargado", () => {
    const state = seed();
    const manager = state.profiles.find((profile) => profile.id === "m1")!;
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    const task = state.tasks.find((row) => row.ownerId === employee.id && row.companyId === "c1" && row.status !== "Completada")!;
    const revokedManager = { ...manager, companyIds: manager.companyIds.filter((companyId) => companyId !== "c1") };
    const revoked = {
      ...state,
      profiles: state.profiles.map((profile) => profile.id === manager.id ? revokedManager : profile),
      tasks: state.tasks.map((row) => row.id === task.id ? { ...row, scheduledOn: dateART(), due: dateART() } : row),
    };
    const absence = {
      id: "revoked-company-task-coverage", ownerId: employee.id, replacementId: "e1",
      taskIds: [task.id], assignmentIds: [], from: dateART(), to: dateART(),
      kind: "Vacaciones" as const, note: "", createdBy: manager.id,
    };
    expect(canWork(revoked, revokedManager, { ...task, scheduledOn: dateART(), due: dateART() })).toBe(false);
    expect(() => registerAbsence(revoked, absence, manager.id)).toThrow(/empresas autorizadas/i);
    expect(registerAbsence(revoked, { ...absence, id: "scope-only-absence", replacementId: "", taskIds: [] }, manager.id).absences).toHaveLength(1);

    const recurring = {
      ...state.assignments.find((assignment) => assignment.ownerId === employee.id && assignment.companyId === "c1")!,
      id: "revoked-company-rule", frequency: "mensual" as const, startMonth: currentMonth(), day: 15,
      schedule: { ...defaultSchedule(`${currentMonth()}-01`, "mensual"), monthDay: 15, hasDeadline: false },
    };
    const withRule = { ...revoked, assignments: [...revoked.assignments, recurring] };
    expect(() => registerAbsence(withRule, { ...absence, id: "revoked-company-rule-coverage", taskIds: [], assignmentIds: [recurring.id] }, manager.id)).toThrow(/reglas recurrentes activas/i);
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
    const inactiveBoss = { ...s, profiles: s.profiles.map((profile) => profile.id === "boss" ? { ...profile, active: false } : profile) };
    expect(() => updateProfile(inactiveBoss, { ...p, name: "No autorizado" }, "boss")).toThrow(/jefatura/i);
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
    expect(() => updateProfile(s, { ...p, companyIds: [...p.companyIds, "unknown-company"] }, "boss")).toThrow(/empresas existentes/i);
    expect(() => updateProfile(s, { ...p, companyIds: [p.companyIds[0]!, p.companyIds[0]!] }, "boss")).toThrow(/sin repetir/i);
    expect(updateProfile(s, { ...p, name: "Valentino válido" }, "boss").profiles.find((row) => row.id === p.id)?.name).toBe("Valentino válido");
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
    const closedForReplacement = {
      ...retired,
      companyClosures: [{ id: "recipient-company-close", ownerId: "e1", companyId: task.companyId, month: task.month,
        at, by: "boss", note: "Cierre parcial", metrics: metrics([], []), tasks: [], activity: [], coveredActivity: [], schemaVersion: 1 as const }],
    };
    expect(() => reassignOrphanedTask(closedForReplacement, item.id, "e1", "boss", at)).toThrow(/cerrados para la persona receptora/i);
    expect(closedForReplacement.tasks.find((row) => row.id === task.id)?.ownerId).toBe("e0");
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
    const closedForReplacement = {
      ...retired,
      companyClosures: [{ id: "transfer-recipient-company-close", ownerId: "e1", companyId: task.companyId, month: task.month,
        at, by: "boss", note: "Cierre parcial", metrics: metrics([], []), tasks: [], activity: [], coveredActivity: [], schemaVersion: 1 as const }],
    };
    expect(() => transferOrphanedTask(closedForReplacement, item.id, "e1", "boss", "Continuidad del cierre mensual", at)).toThrow(/cerrados para la persona receptora/i);
    expect(closedForReplacement.tasks.find((row) => row.id === task.id)?.ownerId).toBe("e0");
    expect(closedForReplacement.taskTransfers).toBeUndefined();
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
  it("da de baja al reemplazo, corta sólo sus relojes, cancela la cobertura y avisa al titular/superior", () => {
    const at = "2026-11-20T13:00:00.000Z";
    const base = seed();
    const task = base.tasks.find((row) => row.ownerId === "e0" && row.kind === "resultado")!;
    const month = task.month;
    const day = task.due.slice(8, 10);
    const targetDay = `${month}-${day}`;
    const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const prepared = {
      ...base,
      tasks: base.tasks.map((row) => row.id === task.id ? {
        ...row, sessions: [
          { id: "replacement-open", actorId: "e1", start: `${targetDay}T09:00:00.000Z`, end: null },
          { id: "other-open", actorId: "e2", start: `${targetDay}T09:30:00.000Z`, end: null },
        ],
      } : row),
    };
    const absence = { id: "replacement-retirement", ownerId: "e0", replacementId: "e1", taskIds: [task.id], from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}`, kind: "Licencia" as const, note: "", createdBy: "boss" };
    const working = registerAbsence(prepared, absence, "boss");
    const replacement = working.profiles.find((profile) => profile.id === "e1")!;
    const retired = deactivateProfile(working, { ...replacement, active: false }, "boss", "Fin de cobertura", at);
    const updatedTask = retired.tasks.find((row) => row.id === task.id)!;
    expect(updatedTask.sessions).toEqual([
      { id: "replacement-open", actorId: "e1", start: `${targetDay}T09:00:00.000Z`, end: at },
      { id: "other-open", actorId: "e2", start: `${targetDay}T09:30:00.000Z`, end: null },
    ]);
    expect(retired.absences?.find((row) => row.id === absence.id)?.cancelledAt).toBe(at);
    expect(retired.notifications?.filter((row) => row.taskId === task.id && row.title.includes("Cobertura cancelada"))
      .map((row) => row.recipientId).sort()).toEqual(["e0", "m1"]);
    expect(() => deactivateProfile(retired, { ...replacement, active: false }, "boss", "Baja repetida", at)).toThrow(/acceso activo/i);
    expect(retired.notifications?.filter((row) => row.taskId === task.id && row.title.includes("Cobertura cancelada"))).toHaveLength(2);
  });

  it("no altera relojes de una unidad del reemplazo que ya está congelada", () => {
    const base = seed();
    const task = base.tasks.find((row) => row.ownerId === "e0" && row.companyId === "c1" && row.kind === "resultado")!;
    const month = task.month;
    const at = `${month}-28T13:00:00.000Z`;
    const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const session = { id: "frozen-open-clock", actorId: "e1", start: `${month}-20T09:00:00.000Z`, end: null };
    const withTask = { ...base, tasks: base.tasks.map((row) => row.id === task.id ? { ...row, sessions: [session] } : row) };
    const absence = { id: "frozen-replacement", ownerId: "e0", replacementId: "e1", taskIds: [task.id], from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}`, kind: "Licencia" as const, note: "", createdBy: "boss" };
    const working = registerAbsence(withTask, absence, "boss");
    const closedUnit = { ...working, companyClosures: [{ id: "replacement-frozen-unit", ownerId: "e1", companyId: task.companyId, month: task.month,
      at, by: "boss", note: "Cierre", metrics: metrics([], []), tasks: [], activity: [], coveredActivity: [], schemaVersion: 1 as const }] };
    const replacement = closedUnit.profiles.find((profile) => profile.id === "e1")!;
    const retired = deactivateProfile(closedUnit, { ...replacement, active: false }, "boss", "Fin de cobertura", at);
    expect(retired.tasks.find((row) => row.id === task.id)?.sessions).toEqual([session]);
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
  it("preserva tareas de una empresa cerrada y materializa sólo las unidades abiertas", () => {
    const state = seed();
    const task = state.tasks.find((row) => row.assignmentId && row.kind === "resultado")!;
    const assignment = state.assignments.find((row) => row.id === task.assignmentId)!;
    const closedUnit = {
      id: "closed-company-unit",
      ownerId: task.ownerId,
      companyId: task.companyId,
      month: task.month,
      at: `${task.month}-28T15:00:00.000Z`,
      by: "boss",
      note: "Cierre de prueba",
      metrics: metrics([], []),
      tasks: [],
      activity: [],
      coveredActivity: [],
      schemaVersion: 1 as const,
    };
    const closedState = { ...state, tasks: [task], assignments: [assignment], companyClosures: [closedUnit] };
    expect(isClosed(closedState, task)).toBe(true);
    const openUnitState = { ...closedState, tasks: [], companyClosures: undefined };
    expect(materialize(openUnitState, task.month).tasks).not.toHaveLength(0);
    expect(materialize({ ...closedState, tasks: [] }, task.month).tasks).toHaveLength(0);
    const revised = reviseAssignment(closedState, assignment.id, defaultSchedule(task.scheduledOn || task.due), "boss");
    expect(revised.tasks.some((row) => row.id === task.id)).toBe(true);
  });
  it("impide que un reemplazo ejecute una cobertura si su propia unidad empresa/mes está cerrada", () => {
    const state = seed();
    const task = state.tasks.find((row) => row.ownerId === "e0" && row.companyId === "c1" && row.kind === "resultado" && row.status !== "Completada")!;
    const month = task.month;
    const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const absence = { id: "coverage-actor-close", ownerId: "e0", replacementId: "e1", taskIds: [task.id], from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}`, kind: "Licencia" as const, note: "", createdBy: "boss" };
    const coveredState = registerAbsence(state, absence, "boss");
    const replacement = coveredState.profiles.find((profile) => profile.id === "e1")!;
    const closure = { id: "replacement-unit-closed", ownerId: replacement.id, companyId: task.companyId, month, at: `${month}-28T15:00:00.000Z`, by: "boss", note: "Cierre", metrics: metrics([], []), tasks: [], activity: [], coveredActivity: [], schemaVersion: 1 as const };
    const closedState = { ...coveredState, companyClosures: [closure] };
    expect(() => applyClock(closedState, task.id, replacement.id, true, `${month}-08T12:00:00.000Z`)).toThrow(/ámbito o mes cerrado/i);
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
