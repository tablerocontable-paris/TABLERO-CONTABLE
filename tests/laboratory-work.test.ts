import { describe, expect, it, vi } from "vitest";
import { createLaboratoryBackup, inspectLaboratoryBackup, seed } from "../src/data/repository";
import { closedPeriodHistory } from "../src/domain/closedHistory";
import { canViewLabAssignment } from "../src/domain/planning";
import { checkTask, currentMonth, dateART, isResponsible, metrics, metricsForProfile, taskReadiness, transition } from "../src/domain/model";
import {
  calendarCanAccessTask,
  canAssignLabTask,
  canViewCalendarEvent,
  canExecuteLab,
  calendarRecipients,
  changeCalendarEvent,
  closeCompanyUnits,
  companyCloseUnits,
  companyUnitCloseBlocker,
  createCalendarEvent,
  visibleCalendarEvents,
  isEventManager,
  operationalLoad,
  canRescheduleLabTask,
  rescheduleLabTask,
  saveOperationalAssessment,
  saveOperationalRate,
  setCommercialTracking,
  snapshotOperationalRate,
  suggestedRoute,
  updateTaskWeight,
  updateCommercialProgress,
  updateTaskReadiness,
} from "../src/domain/laboratory-work";

const active = (state: ReturnType<typeof seed>, role: "jefe" | "encargado" | "empleado") => state.profiles.find((profile) => profile.role === role)!;
function reschedulableSeed() {
  const base = seed();
  const source = base.tasks.find((row) => row.ownerId === "e0" && row.kind === "resultado")!;
  const task = { ...source, status: "Pendiente" as const, startedAt: null, completedAt: null, sessions: [] };
  return { state: { ...base, activity: base.activity.filter((row) => row.taskId !== task.id), tasks: base.tasks.map((row) => row.id === task.id ? task : row) }, task };
}

describe("contratos de trabajo del laboratorio", () => {
  it("permite reprogramar una aparición puntual a jefatura o a su encargado autorizado", () => {
    const { state, task } = reschedulableSeed();
    const owner = state.profiles.find((row) => row.id === task.ownerId)!;
    const manager = state.profiles.find((row) => row.id === owner.managerId)!;
    const boss = state.profiles.find((row) => row.id === "boss")!;
    const newDate = `${task.month}-28`;
    expect(canRescheduleLabTask(state, manager, task)).toBe(true);
    const moved = rescheduleLabTask(state, task.id, newDate, "Prioridad del cierre bancario", manager.id);
    const updated = moved.tasks.find((row) => row.id === task.id)!;
    expect(updated.scheduledOn).toBe(newDate);
    expect(updated.due).toBe(task.due);
    expect(updated.month).toBe(task.month);
    expect(moved.assignments).toEqual(state.assignments);
    expect(rescheduleLabTask(state, task.id, newDate, "Cambio por coordinación", boss.id).tasks.find((row) => row.id === task.id)?.scheduledOn).toBe(newDate);
  });

  it("rechaza reprogramaciones sin ámbito, fuera de período, sin motivo, iniciadas o cerradas", () => {
    const { state, task } = reschedulableSeed();
    const owner = state.profiles.find((row) => row.id === task.ownerId)!;
    const manager = state.profiles.find((row) => row.id === owner.managerId)!;
    const peer = state.profiles.find((row) => row.id === "e1")!;
    const validDate = `${task.month}-28`;
    expect(() => rescheduleLabTask(state, task.id, validDate, "Cambio válido", peer.id)).toThrow(/autorizado/);
    const outsideMonth = `${Number(task.month.slice(0, 4)) + 1}-01-28`;
    expect(() => rescheduleLabTask(state, task.id, outsideMonth, "Cambio válido", manager.id)).toThrow(/período/);
    expect(() => rescheduleLabTask(state, task.id, validDate, "no", manager.id)).toThrow(/motivo/);
    const started = { ...state, tasks: state.tasks.map((row) => row.id === task.id ? { ...row, status: "En curso" as const, startedAt: `${task.month}-04T12:00:00.000Z` } : row) };
    expect(() => rescheduleLabTask(started, task.id, validDate, "Cambio válido", manager.id)).toThrow(/autorizado/);
    const closed = { ...state, companyClosures: [{ id: "closed", ownerId: task.ownerId, companyId: task.companyId, month: task.month, at: `${task.month}-25T12:00:00.000Z`, by: "boss", note: "Cierre", metrics: metrics([], []), tasks: [], activity: [], coveredActivity: [], schemaVersion: 1 as const }] };
    expect(() => rescheduleLabTask(closed, task.id, validDate, "Cambio válido", manager.id)).toThrow(/autorizado/);
  });

  it("versiona los coeficientes y conserva el peso usado en cada movimiento", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const task = state.tasks.find((row) => row.kind === "operativa")!;
    const first = saveOperationalRate(state, boss.id, { templateId: null, taskId: task.id, companyId: task.companyId, effectiveOn: `${task.month}-01`, unitWeight: 1.5 });
    const snapshot = snapshotOperationalRate(first, task, `${task.month}-18`);
    const activity = { id: "movement-1", taskId: task.id, actorId: task.ownerId, date: `${task.month}-18`, qty: 4, note: "", createdAt: `${task.month}-18T12:00:00Z`, ...snapshot };
    const second = saveOperationalRate(first, boss.id, { templateId: null, taskId: task.id, companyId: task.companyId, effectiveOn: `${task.month}-20`, unitWeight: 2 });
    expect(second.operationalRates?.map((row) => row.version)).toEqual([1, 2]);
    expect(operationalLoad({ ...second, activity: [activity] }, [task.id]).weightedLoad).toBe(6);
    expect(snapshotOperationalRate(second, task, `${task.month}-19`).operationalUnitWeight).toBe(1.5);
    expect(snapshotOperationalRate(second, task, `${task.month}-21`).operationalUnitWeight).toBe(2);
  });

  it("aplica al movimiento de hoy un coeficiente con vigencia inicial ART de hoy", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const task = state.tasks.find((row) => row.kind === "operativa")!;
    const today = dateART();
    const rated = saveOperationalRate(state, boss.id, { templateId: null, taskId: task.id, companyId: task.companyId, effectiveOn: today, unitWeight: 2.25 });
    expect(snapshotOperationalRate(rated, task, today)).toMatchObject({ operationalRateId: rated.operationalRates![0]!.id, operationalUnitWeight: 2.25 });
  });

  it("exige que cada coeficiente apunte a una plantilla o a una tarea, nunca a ambas", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const task = state.tasks.find((row) => row.kind === "operativa")!;
    const template = state.templates.find((row) => row.kind === "operativa")!;
    const input = { templateId: template.id, taskId: task.id, companyId: task.companyId, effectiveOn: `${task.month}-01`, unitWeight: 1 };
    expect(() => saveOperationalRate(state, boss.id, input)).toThrow(/no ambas/i);
    expect(state.operationalRates || []).toEqual([]);
    const malformed = { ...state, operationalRates: [{ id: "bad-rate", ...input, version: 1, createdAt: `${task.month}-01T12:00:00.000Z`, createdBy: boss.id }] };
    expect(() => inspectLaboratoryBackup(createLaboratoryBackup(malformed))).toThrow(/copia compatible/i);
  });

  it("continúa desde la mayor versión y rechaza versiones duplicadas al restaurar", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const task = state.tasks.find((row) => row.kind === "operativa")!;
    const initial = saveOperationalRate(state, boss.id, { templateId: null, taskId: task.id, companyId: task.companyId, effectiveOn: `${task.month}-01`, unitWeight: 1 });
    const restored = { ...initial, operationalRates: initial.operationalRates!.map((rate) => ({ ...rate, version: 7 })) };
    const next = saveOperationalRate(restored, boss.id, { templateId: null, taskId: task.id, companyId: task.companyId, effectiveOn: `${task.month}-20`, unitWeight: 2 });
    expect(next.operationalRates?.map((rate) => rate.version)).toEqual([7, 8]);
    expect(inspectLaboratoryBackup(createLaboratoryBackup(next)).state.operationalRates?.map((rate) => rate.version)).toEqual([7, 8]);

    const duplicated = { ...next, operationalRates: [...next.operationalRates!, { ...next.operationalRates![1]!, id: "duplicate-version" }] };
    expect(() => inspectLaboratoryBackup(createLaboratoryBackup(duplicated))).toThrow(/copia compatible/i);
  });

  it("deja pendiente la carga cuando parte de los movimientos no tiene coeficiente", () => {
    const state = seed();
    const task = state.tasks.find((row) => row.kind === "operativa")!;
    const movement = { id: "unrated", taskId: task.id, actorId: task.ownerId, date: `${task.month}-18`, qty: 7, note: "", createdAt: `${task.month}-18T12:00:00Z` };
    const result = operationalLoad({ ...state, activity: [movement] }, [task.id]);
    expect(result.quantity).toBe(7);
    expect(result.weightedLoad).toBeNull();
    expect(result.unweightedQuantity).toBe(7);
  });

  it("deja la carga pendiente cuando aún no hay movimientos ni coeficiente configurado", () => {
    const state = seed();
    const task = state.tasks.find((row) => row.kind === "operativa")!;
    state.activity = state.activity.filter((activity) => activity.taskId !== task.id);
    expect(operationalLoad(state, [task.id])).toMatchObject({ quantity: 0, weightedLoad: null, unweightedQuantity: 0, activities: 0 });
  });

  it("mantiene la evaluación de calidad separada de puntos de entregables", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const task = state.tasks.find((row) => row.kind === "operativa" && !row.responsibility)!;
    const before = metricsForProfile(state.tasks.filter((row) => row.kind === "resultado"), state.activity, task.ownerId);
    const evaluated = saveOperationalAssessment(state, boss.id, { taskId: task.id, quality: 90, order: 80, timeliness: 70, note: "Control y evidencia revisados." });
    expect(evaluated.operationalAssessments?.[0]).toMatchObject({ quality: 90, order: 80, timeliness: 70, evaluatedBy: boss.id });
    expect(metricsForProfile(evaluated.tasks.filter((row) => row.kind === "resultado"), evaluated.activity, task.ownerId)).toEqual(before);
    expect(() => saveOperationalAssessment(state, boss.id, { taskId: task.id, quality: 90, order: 80, timeliness: 70, note: "no" })).toThrow(/observación/i);
  });

  it("registra cobertura comercial de 0 a 30 sin completar la tarea automáticamente", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const task = state.tasks.find((row) => row.kind === "resultado" && /banco|concili/i.test(row.title))!;
    const enabled = setCommercialTracking(state, task.id, true, boss.id);
    const owner = state.profiles.find((profile) => profile.id === task.ownerId)!;
    const atThirty = updateCommercialProgress(enabled, task.id, 30, owner.id);
    expect(atThirty.tasks.find((row) => row.id === task.id)?.commercialProgress?.throughDay).toBe(30);
    expect(atThirty.tasks.find((row) => row.id === task.id)?.status).not.toBe("Completada");
    expect(() => updateCommercialProgress(enabled, task.id, 31, owner.id)).toThrow(/entre 0 y 30/);
  });

  it("revalida ejecución comercial después de revocar empresa o desactivar al responsable", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const task = state.tasks.find((row) => row.kind === "resultado" && /banco|concili/i.test(row.title))!;
    const enabled = setCommercialTracking(state, task.id, true, boss.id);
    const owner = enabled.profiles.find((profile) => profile.id === task.ownerId)!;
    const revoked = { ...enabled, profiles: enabled.profiles.map((profile) => profile.id === owner.id
      ? { ...profile, companyIds: profile.companyIds.filter((companyId) => companyId !== task.companyId) }
      : profile) };
    const inactive = { ...enabled, profiles: enabled.profiles.map((profile) => profile.id === owner.id ? { ...profile, active: false } : profile) };
    expect(() => updateCommercialProgress(revoked, task.id, 20, owner.id)).toThrow(/responsable|reemplazo/i);
    expect(() => updateCommercialProgress(inactive, task.id, 20, owner.id)).toThrow(/responsable|reemplazo/i);
    expect(enabled.tasks.find((row) => row.id === task.id)?.commercialProgress?.throughDay).toBe(0);
  });

  it("revalida cobertura vigente y cierre de la unidad del reemplazo en seguimiento comercial", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const task = state.tasks.find((row) => row.ownerId === "e0" && row.companyId === "c1" && row.kind === "resultado")!;
    const tracked = setCommercialTracking(state, task.id, true, boss.id);
    const month = task.month;
    const covered = { ...tracked, absences: [{ id: "commercial-coverage", ownerId: task.ownerId, replacementId: "e1", taskIds: [task.id], from: `${month}-05`, to: `${month}-20`, kind: "Licencia" as const, note: "", createdBy: boss.id }] };
    expect(updateCommercialProgress(covered, task.id, 18, "e1", `${month}-10T12:00:00Z`).tasks.find((row) => row.id === task.id)?.commercialProgress?.updatedBy).toBe("e1");
    expect(() => updateCommercialProgress(covered, task.id, 19, "e1", `${month}-21T12:00:00Z`)).toThrow(/responsable|reemplazo/i);
    const replacementClosed = { ...covered, companyClosures: [{ id: "replacement-closed", ownerId: "e1", companyId: task.companyId, month, at: `${month}-18T12:00:00Z`, by: boss.id, note: "Cierre", metrics: metrics([], []), tasks: [], activity: [], coveredActivity: [], schemaVersion: 1 as const }] };
    expect(() => updateCommercialProgress(replacementClosed, task.id, 19, "e1", `${month}-10T12:00:00Z`)).toThrow(/reemplazo/i);
  });

  it("mantiene las dependencias efectivas y oculta el título de una tarea fuera del ámbito", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const target = state.tasks.find((row) => row.ownerId === "e0" && row.kind === "resultado")!;
    const otherCompany = state.tasks.find((row) => row.ownerId === "e0" && row.kind === "resultado" && row.companyId !== target.companyId)!;
    const dependency = { ...otherCompany, status: "Pendiente" as const };
    const task = { ...target, status: "Pendiente" as const, blockedBy: "", dependsOnTaskIds: [dependency.id] };
    const configured = { ...state, tasks: state.tasks.map((row) => row.id === task.id ? task : row.id === dependency.id ? dependency : row) };
    const viewer = { ...configured.profiles.find((profile) => profile.id === "e0")!, companyIds: [target.companyId] };
    configured.profiles = configured.profiles.map((profile) => profile.id === viewer.id ? viewer : profile);
    const readiness = taskReadiness(configured, task, `${task.month}-15`, viewer);
    expect(readiness.ready).toBe(false);
    expect(readiness.reason).not.toContain(otherCompany.title);
    expect(readiness.reason).toMatch(/no está disponible en tu ámbito/);
    expect(taskReadiness(configured, task, `${task.month}-15`, boss).reason).toContain(otherCompany.title);
  });

  it("oculta el título de una dependencia de un compañero aunque comparta empresa", () => {
    const state = seed();
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    const peer = state.profiles.find((profile) => profile.id === "e1")!;
    const manager = state.profiles.find((profile) => profile.id === employee.managerId)!;
    const boss = active(state, "jefe");
    const target = state.tasks.find((row) => row.ownerId === employee.id && row.kind === "resultado" && row.companyId === "c1")!;
    const peerSource = state.tasks.find((row) => row.ownerId === peer.id && row.kind === "resultado" && row.companyId === target.companyId && row.month === target.month);
    const dependency = { ...(peerSource || target), id: "peer-dependency", ownerId: peer.id, title: "Conciliación reservada del compañero", status: "Pendiente" as const, responsibility: undefined };
    const dependent = { ...target, status: "Pendiente" as const, blockedBy: "", dependsOnTaskIds: [dependency.id] };
    const configured = { ...state, tasks: [...state.tasks.filter((row) => row.id !== target.id && row.id !== peerSource?.id), dependency, dependent] };

    const employeeReason = taskReadiness(configured, dependent, `${target.month}-15`, employee).reason;
    expect(employeeReason).not.toContain(dependency.title);
    expect(employeeReason).toMatch(/una tarea que no está disponible en tu ámbito/);
    expect(taskReadiness(configured, dependent, `${target.month}-15`, manager).reason).toContain(dependency.title);
    expect(taskReadiness(configured, dependent, `${target.month}-15`, boss).reason).toContain(dependency.title);
    const revoked = { ...configured, profiles: configured.profiles.map((profile) => profile.id === employee.id ? { ...profile, companyIds: [] } : profile) };
    const staleReason = taskReadiness(revoked, dependent, `${target.month}-15`, employee).reason;
    expect(staleReason).not.toContain(dependency.title);
    expect(staleReason).toMatch(/una tarea que no está disponible en tu ámbito/);
  });

  it("proyecta planificación, asignación y eventos sólo con permisos actuales", () => {
    const state = seed();
    const manager = state.profiles.find((profile) => profile.id === "m1")!;
    const assignment = state.assignments.find((row) => row.ownerId === "e0" && row.companyId === "c1")!;
    const owner = state.profiles.find((profile) => profile.id === assignment.ownerId)!;
    const event = createCalendarEvent(state, owner.id, {
      companyId: "c1", kind: "audit", title: "Fecha reservada", description: "", startOn: `${currentMonth()}-20`, endOn: `${currentMonth()}-20`, recipientIds: [], linkedTaskId: null,
    }).calendarEvents![0]!;
    const revokedManager = { ...manager, companyIds: manager.companyIds.filter((companyId) => companyId !== "c1") };
    const revoked = { ...state, profiles: state.profiles.map((profile) => profile.id === manager.id ? revokedManager : profile) };
    expect(canViewLabAssignment(revoked, revokedManager, assignment)).toBe(false);
    expect(canViewLabAssignment(revoked, manager, assignment)).toBe(false);
    expect(canAssignLabTask(revoked, revokedManager, owner.id, "c1")).toBe(false);
    expect(canAssignLabTask(revoked, manager, owner.id, "c1")).toBe(false);
    expect(canViewCalendarEvent(revoked, revokedManager, event)).toBe(false);
    expect(canViewCalendarEvent({ ...state, companies: state.companies.filter((company) => company.id !== "c1") }, active(state, "jefe"), event)).toBe(false);
    const bossWithoutMembership = { ...state.profiles.find((profile) => profile.id === "boss")!, companyIds: [] };
    expect(canViewLabAssignment(state, bossWithoutMembership, assignment)).toBe(true);
    expect(canAssignLabTask(state, bossWithoutMembership, owner.id, "c1")).toBe(true);
  });

  it("detiene administración de fechas ante una jerarquía corrupta incluso antes del respaldo", () => {
    const state = seed();
    const actor = state.profiles.find((profile) => profile.id === "e0")!;
    const manager = state.profiles.find((profile) => profile.id === "m1")!;
    actor.managerId = manager.id;
    manager.managerId = actor.id;
    manager.active = false;
    expect(() => createCalendarEvent(state, actor.id, {
      companyId: "c1", kind: "audit", title: "Fecha con jerarquía inconsistente", description: "",
      startOn: `${currentMonth()}-20`, endOn: `${currentMonth()}-20`, recipientIds: [], linkedTaskId: null,
    })).toThrow(/jerarquía.*no es válida/i);
  });

  it("revoca el acceso a fechas compartidas cuando cambia la jefatura del autor", () => {
    const state = seed();
    const owner = state.profiles.find((profile) => profile.id === "e0")!;
    const previousManager = state.profiles.find((profile) => profile.id === owner.managerId)!;
    const event = createCalendarEvent(state, owner.id, {
      companyId: "c1", kind: "audit", title: "Auditoría de equipo", description: "",
      startOn: `${currentMonth()}-20`, endOn: `${currentMonth()}-20`, recipientIds: [], linkedTaskId: null,
    }).calendarEvents![0]!;
    expect(event.recipientIds).toContain(previousManager.id);
    expect(canViewCalendarEvent(state, previousManager, event)).toBe(true);

    const changedHierarchy = {
      ...state,
      calendarEvents: [event],
      profiles: state.profiles.map((profile) => profile.id === owner.id
        ? { ...profile, managerId: "m2", teamId: "t2" }
        : profile),
    };
    const currentManager = changedHierarchy.profiles.find((profile) => profile.id === "m2")!;
    expect(canViewCalendarEvent(changedHierarchy, previousManager, event)).toBe(false);
    expect(canViewCalendarEvent(changedHierarchy, currentManager, event)).toBe(true);
    expect(visibleCalendarEvents(changedHierarchy, previousManager, currentMonth())).toEqual([]);
    expect(visibleCalendarEvents(changedHierarchy, currentManager, currentMonth())).toEqual([event]);
  });

  it("exige confirmar día 30 y checklist antes de completar una conciliación seguida", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const task = state.tasks.find((row) => row.kind === "resultado" && /banco|concili/i.test(row.title))!;
    const tracked = { ...task, status: "Pendiente" as const, blockedBy: "", checklist: [{ id: "bank-step", text: "Revisar extracto", done: false }], commercialTrackingEnabled: true, commercialProgress: { month: task.month, throughDay: 29, updatedAt: "2026-10-29T12:00:00Z", updatedBy: boss.id } };
    const startedWithControls = checkTask(tracked, "bank-step", true);
    expect(startedWithControls.status).toBe("En curso");
    expect(() => transition(startedWithControls, "Completada")).toThrow(/día comercial 30/i);
    const readyToClose = { ...startedWithControls, commercialProgress: { ...startedWithControls.commercialProgress!, throughDay: 30 } };
    expect(transition(readyToClose, "Completada").status).toBe("Completada");
  });

  it("rechaza dependencias cíclicas y ordena primero los trabajos habilitados", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const base = state.tasks.find((row) => row.kind === "resultado" && row.status !== "Completada")!;
    const a = { ...base, id: "route-a", companyId: "c1", ownerId: "e0", status: "Pendiente" as const, blockedBy: "", dependsOnTaskIds: [] };
    const b = { ...a, id: "route-b", title: "Segundo paso", dependsOnTaskIds: [a.id] };
    let next = { ...state, tasks: [...state.tasks.filter((row) => row.id !== a.id), a, b] };
    next = updateTaskReadiness(next, a.id, { dependsOnTaskIds: [], availableFrom: null }, boss.id);
    expect(() => updateTaskReadiness(next, a.id, { dependsOnTaskIds: [b.id], availableFrom: null }, boss.id)).toThrow(/ciclo/i);
    expect(suggestedRoute(next, "e0").findIndex((row) => row.task.id === a.id)).toBeLessThan(suggestedRoute(next, "e0").findIndex((row) => row.task.id === b.id));
  });

  it("bloquea la ruta mientras una dependencia sigue pendiente", () => {
    const state = seed();
    const seedDependency = state.tasks.find((row) => row.kind === "resultado" && row.ownerId === "e0")!;
    const dependency = { ...seedDependency, status: "Pendiente" as const, blockedBy: "" };
    const task = { ...dependency, id: "dependent-task", title: "Tarea posterior", status: "Pendiente" as const, dependsOnTaskIds: [dependency.id], availableFrom: null };
    const next = { ...state, tasks: [...state.tasks.filter((row) => row.id !== dependency.id), dependency, task] };
    expect(taskReadiness(next, task, `${task.month}-15`)).toMatchObject({ ready: false, reason: expect.stringContaining(dependency.title) });
    const completed = { ...next, tasks: next.tasks.map((row) => row.id === dependency.id ? { ...row, status: "Completada" as const } : row) };
    expect(taskReadiness(completed, task, `${task.month}-15`)).toMatchObject({ ready: true, reason: "Lista para empezar" });
  });

  it("aplica período, empresa, equipo y sector a la hoja de ruta sugerida", () => {
    const state = seed();
    const month = currentMonth();
    const route = suggestedRoute(state, "e0", `${month}-15`, { month, companyId: "c1", teamId: "t1", sector: "Tesorería" });
    expect(route.length).toBeGreaterThan(0);
    expect(route.every(({ task }) => task.month === month && task.companyId === "c1" && task.teamId === "t1" && task.sector === "Tesorería" && isResponsible(task, "e0"))).toBe(true);
    const otherCompanyTask = { ...route[0]!.task, id: "route-other-company", companyId: "c4" };
    const withOtherCompany = { ...state, tasks: [...state.tasks, otherCompanyTask] };
    expect(suggestedRoute(withOtherCompany, "e0", `${month}-15`, { month, companyId: "c4" }).some(({ task }) => task.id === otherCompanyTask.id)).toBe(true);
    expect(suggestedRoute(withOtherCompany, "e0", `${month}-15`, { month, companyId: "c1", teamId: "t1", sector: "Tesorería" }).some(({ task }) => task.id === otherCompanyTask.id)).toBe(false);
  });

  it("incluye superiores en fechas compartidas y genera avisos a destinatarios", () => {
    const state = seed();
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    const recipients = calendarRecipients(state, employee, "c1", false, ["e1"]);
    expect(recipients).toEqual(expect.arrayContaining([employee.id, "e1", "m1", "boss"]));
    const created = createCalendarEvent(state, employee.id, { companyId: "c1", kind: "audit", title: "Auditoría", description: "", startOn: `${currentMonth()}-20`, endOn: `${currentMonth()}-21`, recipientIds: ["e1"], linkedTaskId: null });
    expect(created.calendarNotices?.map((notice) => notice.recipientId)).toEqual(expect.arrayContaining(["e1", "m1", "boss"]));
    const changed = changeCalendarEvent(created, created.calendarEvents![0]!.id, employee.id, { title: "Auditoría reprogramada" });
    expect(changed.calendarNotices?.at(-1)?.kind).toBe("changed");
    const removedRecipient = changeCalendarEvent(created, created.calendarEvents![0]!.id, employee.id, { recipientIds: [] });
    expect(removedRecipient.calendarNotices?.some((notice) => notice.revision === 2 && notice.recipientId === "e1" && notice.kind === "changed")).toBe(true);
    expect(() => createCalendarEvent(state, employee.id, { companyId: "c1", kind: "custom", title: "Fuera del ámbito", description: "", startOn: `${currentMonth()}-20`, endOn: `${currentMonth()}-20`, recipientIds: [], linkedTaskId: "missing-task" })).toThrow(/fuera de tu ámbito/i);
    const cyclic = { ...state, profiles: state.profiles.map((profile) => profile.id === "boss" ? { ...profile, managerId: "m1" } : profile) };
    expect(() => calendarRecipients(cyclic, employee, "c1")).toThrow(/jerarquía.*no es válida/i);
  });

  it("valida calendario antes de mutar eventos o avisos", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const input = { companyId: "missing-company", kind: "audit" as const, title: "Auditoría", description: "", startOn: `${currentMonth()}-20`, endOn: `${currentMonth()}-20`, recipientIds: [], linkedTaskId: null };
    expect(() => createCalendarEvent(state, boss.id, input)).toThrow(/empresa.*no existe/i);
    expect(state.calendarEvents || []).toHaveLength(0);
    expect(state.calendarNotices || []).toHaveLength(0);

    const valid = createCalendarEvent(state, boss.id, { ...input, companyId: "c1" });
    const event = valid.calendarEvents![0]!;
    expect(() => changeCalendarEvent(valid, event.id, boss.id, { description: "x".repeat(1001) })).toThrow(/detalle.*1\.000/i);
    expect(valid.calendarEvents).toEqual([event]);
    expect(valid.calendarNotices).toEqual([]);
  });

  it("conserva el autor histórico de fechas al editar tras baja o cambio de empresa", () => {
    const base = seed();
    const employee = base.profiles.find((profile) => profile.id === "e0")!;
    const boss = base.profiles.find((profile) => profile.id === "boss")!;
    const created = createCalendarEvent(base, employee.id, {
      companyId: "c1", kind: "important", title: "Cierre de balance", description: "", startOn: `${currentMonth()}-20`,
      endOn: `${currentMonth()}-20`, recipientIds: [], linkedTaskId: null,
    });
    const event = created.calendarEvents![0]!;
    const inactiveAuthor = { ...created, profiles: created.profiles.map((profile) => profile.id === employee.id ? { ...profile, active: false } : profile) };
    const movedAuthor = { ...created, profiles: created.profiles.map((profile) => profile.id === employee.id ? { ...profile, companyIds: profile.companyIds.filter((id) => id !== "c1") } : profile) };

    for (const state of [inactiveAuthor, movedAuthor]) {
      const changed = changeCalendarEvent(state, event.id, boss.id, { title: "Cierre reprogramado" });
      expect(changed.calendarEvents?.[0]).toMatchObject({ authorId: employee.id, title: "Cierre reprogramado" });
      expect(changed.calendarEvents?.[0]?.recipientIds).toContain(employee.id);
      expect(canViewCalendarEvent(changed, changed.profiles.find((profile) => profile.id === employee.id)!, changed.calendarEvents![0]!)).toBe(false);
      expect(inspectLaboratoryBackup(createLaboratoryBackup(changed)).state.calendarEvents?.[0]?.authorId).toBe(employee.id);
      if (!changed.profiles.find((profile) => profile.id === employee.id)?.active)
        expect(changed.calendarNotices?.some((notice) => notice.recipientId === employee.id && notice.revision === 2)).toBe(false);
    }
  });

  it("no expone ni permite administrar fechas de empresas fuera del ámbito del superior", () => {
    const state = seed();
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    const manager = state.profiles.find((profile) => profile.id === "m1")!;
    const month = currentMonth();
    const event = createCalendarEvent(state, employee.id, {
      companyId: "c1", kind: "audit", title: "Auditoría reservada", description: "Detalle reservado",
      startOn: `${month}-20`, endOn: `${month}-20`, recipientIds: [], linkedTaskId: null,
    }).calendarEvents![0]!;
    const outsideScope = { ...manager, companyIds: manager.companyIds.filter((companyId) => companyId !== "c1") };
    const restricted = { ...state, profiles: state.profiles.map((profile) => profile.id === manager.id ? outsideScope : profile) };
    expect(visibleCalendarEvents(restricted, outsideScope, month)).toEqual([]);
    expect(isEventManager(restricted, outsideScope, event)).toBe(false);
    expect(() => changeCalendarEvent(restricted, event.id, manager.id, { title: "Cambio fuera de ámbito" })).toThrow(/superior autorizado/i);
    expect(calendarRecipients(restricted, employee, "c1")).not.toContain(manager.id);
    expect(calendarRecipients(restricted, employee, "c1")).toContain("boss");
  });

  it("limita la consulta de tareas a jefatura, equipo propio, responsable o cobertura", () => {
    const state = seed();
    const employee = state.profiles.find((profile) => profile.id === "e0")!;
    const manager = state.profiles.find((profile) => profile.id === "m1")!;
    const otherTeamTask = state.tasks.find((task) => task.ownerId === "e7")!;
    const ownTask = state.tasks.find((task) => task.ownerId === employee.id)!;
    const boss = active(state, "jefe");
    expect(calendarCanAccessTask(state, employee, ownTask)).toBe(true);
    expect(calendarCanAccessTask(state, employee, otherTeamTask)).toBe(false);
    expect(calendarCanAccessTask(state, manager, otherTeamTask)).toBe(false);
    expect(calendarCanAccessTask(state, boss, otherTeamTask)).toBe(true);
  });

  it("aplica empresa autorizada a consulta y reconoce al miembro secundario de una tarea conjunta", () => {
    const state = seed();
    const manager = state.profiles.find((profile) => profile.id === "m1")!;
    const subordinateTask = state.tasks.find((task) => task.ownerId === "e0" && task.companyId === "c1")!;
    const joint: typeof subordinateTask = {
      ...subordinateTask,
      ownerId: "e7",
      responsibility: {
        version: 1 as const,
        revision: 1 as const,
        mode: "joint" as const,
        activatedAt: "2026-10-01T12:00:00.000Z",
        activatedBy: "boss",
        reason: "Revisión conjunta",
        members: [
          { profileId: "e0", shareBps: 5000, name: "Empleado 0", teamId: "team-a", sector: "Tesorería" },
          { profileId: "e7", shareBps: 5000, name: "Empleado 7", teamId: "team-b", sector: "Tesorería" },
        ],
      },
    };
    expect(calendarCanAccessTask(state, manager, joint)).toBe(true);
    const withoutCompany = { ...manager, companyIds: manager.companyIds.filter((companyId) => companyId !== "c1") };
    expect(calendarCanAccessTask(state, withoutCompany, joint)).toBe(false);
    expect(calendarCanAccessTask(state, { ...manager, active: false }, subordinateTask)).toBe(false);
  });

  it("permite a jefatura ajustar el peso antes de iniciar sin requerir permiso de ejecución", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const source = state.tasks.find((task) => task.kind === "resultado" && task.status === "Pendiente" && !(task.sessions || []).length)!;
    const task = { ...source, status: "Pendiente" as const, sessions: [] };
    const next = { ...state, tasks: state.tasks.map((row) => row.id === task.id ? task : row) };
    expect(updateTaskWeight(next, task.id, 8, boss.id).tasks.find((row) => row.id === task.id)?.weight).toBe(8);
    expect(() => updateTaskWeight(next, task.id, 8, "e0")).toThrow(/sólo jefatura/i);
    expect(() => updateTaskWeight(next, task.id, 0, boss.id)).toThrow(/mayor que 0/i);
    expect(() => updateTaskWeight({ ...next, companyClosures: [{ id: "closed-unit", ownerId: task.ownerId, companyId: task.companyId, month: task.month, at: "2026-10-30T12:00:00Z", by: boss.id, note: "Cerrado", metrics: metricsForProfile([], [], task.ownerId), tasks: [], activity: [], coveredActivity: [], schemaVersion: 1 }] }, task.id, 8, boss.id)).toThrow(/cerrada/i);
  });

  it("cierra sólo las unidades empresa/persona listas y deja las pendientes separadas", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const employeeId = "e0";
    const companyTwo = state.tasks.find((task) => task.ownerId === employeeId && task.companyId === "c2")!;
    companyTwo.sessions = [{ id: "running", actorId: employeeId, start: new Date().toISOString(), end: null }];
    const readyUnit = { ownerId: employeeId, companyId: "c1", month: currentMonth() };
    const runningUnit = { ownerId: employeeId, companyId: "c2", month: currentMonth() };
    expect(companyUnitCloseBlocker(state, readyUnit, boss.id)).toBeNull();
    expect(companyUnitCloseBlocker(state, runningUnit, boss.id)).toMatch(/cronómetros activos/i);
    expect(companyUnitCloseBlocker(state, readyUnit, employeeId)).toMatch(/requiere jefatura/i);
    const result = closeCompanyUnits(state, [
      readyUnit,
      runningUnit,
    ], boss.id, "Revisión de prueba.");
    expect(result.closed).toEqual([{ ownerId: employeeId, companyId: "c1", month: currentMonth() }]);
    expect(result.blocked[0]?.reason).toMatch(/cronómetros activos/i);
    expect(result.state.companyClosures?.some((row) => row.ownerId === employeeId && row.companyId === "c1")).toBe(true);
    expect(result.state.companyClosures?.some((row) => row.ownerId === employeeId && row.companyId === "c2")).toBe(false);
    const retry = closeCompanyUnits(result.state, [readyUnit], boss.id, "Reintento idempotente.");
    expect(retry.closed).toHaveLength(0);
    expect(retry.blocked[0]?.reason).toMatch(/ya tienen el mes cerrado/i);
    expect(retry.state.companyClosures?.filter((row) => row.ownerId === employeeId && row.companyId === "c1")).toHaveLength(1);
  });

  it("descarta el candidato de cierre si falla la consolidación y permite reintentar", () => {
    const state = seed();
    state.tasks = state.tasks.map((task) => ({ ...task, sessions: [] }));
    expect(inspectLaboratoryBackup(createLaboratoryBackup(state)).state).toEqual(state);
    const boss = active(state, "jefe");
    const ownerId = "e0";
    const month = currentMonth();
    const units = [...new Set(state.tasks.filter((task) => task.ownerId === ownerId && task.month === month).map((task) => task.companyId))]
      .map((companyId) => ({ ownerId, companyId, month }));
    const before = JSON.stringify(state);
    const nativeClone = globalThis.structuredClone;
    let injected = false;
    const cloneSpy = vi.spyOn(globalThis, "structuredClone").mockImplementation((value) => {
      if (!injected && new Error().stack?.includes("consolidateClosedMonth")) {
        injected = true;
        throw new Error("Fallo inyectado al consolidar el mes");
      }
      return nativeClone(value);
    });
    let failed: ReturnType<typeof closeCompanyUnits>;
    try {
      failed = closeCompanyUnits(state, units, boss.id, "Cierre de prueba.", `${month}-28T15:00:00.000Z`);
    } finally {
      cloneSpy.mockRestore();
    }
    expect(injected).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
    expect(failed!.blocked.length).toBeGreaterThan(0);
    const blockedKeys = new Set(failed!.blocked.map(({ unit }) => `${unit.ownerId}:${unit.companyId}:${unit.month}`));
    expect(failed!.closed.some((unit) => blockedKeys.has(`${unit.ownerId}:${unit.companyId}:${unit.month}`))).toBe(false);
    expect(failed!.blocked.every(({ unit }) => !failed!.state.companyClosures?.some((closure) => closure.ownerId === unit.ownerId && closure.companyId === unit.companyId && closure.month === unit.month))).toBe(true);

    const retry = closeCompanyUnits(failed!.state, failed!.blocked.map(({ unit }) => unit), boss.id, "Reintento de cierre.", `${month}-28T15:00:00.000Z`);
    expect(retry.blocked).toHaveLength(0);
    expect(retry.closed).toHaveLength(failed!.blocked.length);
    expect(retry.state.companyClosures?.filter((closure) => closure.ownerId === ownerId && closure.month === month)).toHaveLength(units.length);
    expect(retry.state.closures.filter((closure) => closure.ownerId === ownerId && closure.month === month)).toHaveLength(1);
  });

  it("considera los cronómetros y aportes de cobertura al cerrar la unidad de quien ejecuta", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const month = currentMonth();
    const covered = state.tasks.find((task) => task.ownerId === "e0" && task.companyId === "c1" && task.month === month && task.kind === "resultado" && task.status !== "Completada")!;
    const running = { ...covered, sessions: [{ id: "coverage-clock", actorId: "e1", start: `${month}-08T10:00:00.000Z`, end: null }] };
    const runningState = { ...state, tasks: state.tasks.map((task) => task.id === covered.id ? running : task) };
    expect(companyUnitCloseBlocker(runningState, { ownerId: "e1", companyId: "c1", month }, boss.id)).toMatch(/cobertura/i);

    const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const absence = { id: "coverage-for-close", ownerId: "e0", replacementId: "e1", taskIds: [covered.id], from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}`, kind: "Licencia" as const, note: "", createdBy: boss.id };
    const coveredState = { ...state, absences: [...(state.absences || []), absence] };
    const replacement = coveredState.profiles.find((profile) => profile.id === "e1")!;
    expect(canExecuteLab(coveredState, replacement, covered, `${month}-08`)).toBe(true);
    const closedExecutor = { ...coveredState, companyClosures: [{ id: "e1-closed", ownerId: "e1", companyId: "c1", month, at: `${month}-28T15:00:00.000Z`, by: boss.id, note: "Cerrado", metrics: metrics([], []), tasks: [], activity: [], coveredActivity: [], schemaVersion: 1 as const }] };
    expect(canExecuteLab(closedExecutor, replacement, covered, `${month}-08`)).toBe(false);
  });

  it("congela cobertura sólo-tiempo y finalización ejecutada sin tareas propias ni puntos duplicados", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const month = currentMonth();
    const covered = state.tasks.find((task) => task.ownerId === "e0" && task.companyId === "c1" && task.month === month && task.kind === "resultado" && task.status !== "Completada")!;
    const coveredOperation = state.tasks.find((task) => task.ownerId === "e0" && task.companyId === "c1" && task.month === month && task.kind === "operativa")!;
    const endDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    state.absences = [{ id: "coverage-only-time", ownerId: "e0", replacementId: "e1", taskIds: [covered.id, coveredOperation.id],
      from: `${month}-01`, to: `${month}-${String(endDay).padStart(2, "0")}`, kind: "Licencia", note: "", createdBy: boss.id }];
    const replacementOwnTaskIds = new Set(state.tasks.filter((task) => task.ownerId === "e1").map((task) => task.id));
    state.activity = state.activity.filter((row) => !replacementOwnTaskIds.has(row.taskId));
    state.tasks = state.tasks.filter((task) => task.ownerId !== "e1").map((task) => task.id === covered.id
      ? { ...task, status: "Completada" as const, completedBy: "e1", completedAt: `${month}-09T12:00:00.000Z`, sessions: [{ id: "replacement-hour", actorId: "e1", start: `${month}-08T10:00:00.000Z`, end: `${month}-08T11:00:00.000Z` }] }
      : task);
    state.activity.push({ id: "replacement-movement", taskId: coveredOperation.id, actorId: "e1", date: `${month}-10`, qty: 3,
      note: "Tres facturas procesadas", createdAt: `${month}-10T14:00:00.000Z` });
    const units = companyCloseUnits(state, month, { scope: "person", id: "e1" });
    expect(units).toEqual([{ ownerId: "e1", companyId: "c1", month }]);
    const result = closeCompanyUnits(state, units, boss.id, "Cierre de cobertura.", `${month}-28T15:00:00.000Z`);
    expect(result.closed).toEqual(units);
    const snapshot = result.state.companyClosures?.find((row) => row.ownerId === "e1" && row.companyId === "c1")!;
    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.tasks).toHaveLength(0);
    expect(snapshot.coveredContributions).toEqual(expect.arrayContaining([
      expect.objectContaining({ executorId: "e1", originalOwnerId: "e0", sessions: [expect.objectContaining({ id: "replacement-hour" })], completionAt: `${month}-09T12:00:00.000Z` }),
      expect.objectContaining({ executorId: "e1", originalOwnerId: "e0", sessions: [], activity: [expect.objectContaining({ id: "replacement-movement", qty: 3 })], completionAt: null }),
    ]));
    expect(snapshot.coveredActivity).toMatchObject([{ id: "replacement-movement", actorId: "e1", qty: 3 }]);
    const monthly = result.state.closures.find((row) => row.ownerId === "e1" && row.month === month)!;
    expect(monthly.metrics.points).toBe(0);
    expect(monthly.report?.recordedSeconds).toBe(3600);
    expect(monthly.report?.coverageContributions).toHaveLength(2);
    expect(monthly.report?.laboratorySummary?.covered).toMatchObject({ movementCount: 1, unweightedQuantity: 3, weightedLoad: null, recordedSeconds: 3600 });
    const historyBefore = closedPeriodHistory(result.state, { viewerId: "e1", ownerId: "e1", throughMonth: month });
    expect(historyBefore).toMatchObject([{ period: month, points: 0, recordedSeconds: 3600, coverageHistory: "complete" }]);
    const withoutLiveTask = { ...result.state, tasks: result.state.tasks.filter((task) => task.id !== covered.id && task.id !== coveredOperation.id) };
    expect(closedPeriodHistory(withoutLiveTask, { viewerId: "e1", ownerId: "e1", throughMonth: month })).toEqual(historyBefore);
    expect(inspectLaboratoryBackup(createLaboratoryBackup(result.state)).state.companyClosures?.[0]?.schemaVersion).toBe(2);
  });

  it("no duplica en la historia global el tiempo congelado en tarea y cobertura", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const month = currentMonth();
    const source = state.tasks.find((task) => task.ownerId === "e0" && task.companyId === "c1" && task.month === month && task.kind === "resultado")!;
    const task = { ...source, status: "Completada" as const, completedBy: "e1", completedAt: `${month}-08T11:00:00.000Z`, sessions: [
      { id: "shared-coverage-session", actorId: "e1", start: `${month}-08T10:00:00.000Z`, end: `${month}-08T11:00:00.000Z` },
    ] };
    const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    state.tasks = [task];
    state.activity = [];
    state.absences = [{ id: "coverage-time-only", ownerId: "e0", replacementId: "e1", taskIds: [task.id],
      from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}`, kind: "Licencia", note: "", createdBy: boss.id }];
    const units = [{ ownerId: "e0", companyId: "c1", month }, { ownerId: "e1", companyId: "c1", month }];
    const result = closeCompanyUnits(state, units, boss.id, "Cierre de cobertura con tiempo.", `${month}-28T15:00:00.000Z`);
    expect(result.blocked).toHaveLength(0);
    expect(result.state.closures.filter((row) => row.month === month)).toHaveLength(2);
    expect(closedPeriodHistory(result.state, { viewerId: boss.id, throughMonth: month })).toMatchObject([{ recordedSeconds: 3600 }]);
    expect(closedPeriodHistory(result.state, { viewerId: "e1", ownerId: "e1", throughMonth: month })).toMatchObject([{ recordedSeconds: 3600 }]);
  });

  it("marca como cobertura histórica incompleta el reporte schema 3 anterior al snapshot versionado", () => {
    const state = seed();
    const ownerId = "e0";
    const task = { ...state.tasks.find((row) => row.ownerId === ownerId && row.kind === "resultado")!, id: "old-schema-three", month: "2026-08" };
    state.closures = [{ id: "old-schema-three-close", ownerId, month: "2026-08", at: "2026-08-31T23:00:00.000Z", by: "boss",
      note: "Cierre anterior al snapshot de cobertura", metrics: metrics([task], []), tasks: [task], activity: [],
      report: { schemaVersion: 3, generatedAt: "2026-08-31T23:00:00.000Z", employee: "Empleado 0", team: "", sector: "", recipientIds: [], recipientNames: [],
        delivery: "disponible en demostración", groups: [], recordedSeconds: 0, reopenings: 0 } }];
    expect(closedPeriodHistory(state, { viewerId: ownerId, ownerId, throughMonth: "2026-08" })).toMatchObject([{ coverageHistory: "legacy-not-preserved" }]);
  });

  it("no declara completa la cobertura mensual al mezclar una unidad heredada con una nueva", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const month = currentMonth();
    const ownerId = "e0";
    const units = companyCloseUnits(state, month, { scope: "person", id: ownerId });
    expect(units.length).toBeGreaterThan(1);
    const partial = closeCompanyUnits(state, [units[0]], boss.id, "Cierre parcial anterior.", `${month}-28T15:00:00.000Z`);
    expect(partial.blocked).toHaveLength(0);
    const companyClosures = partial.state.companyClosures!.map((unit) => {
      if (unit.ownerId !== units[0].ownerId || unit.companyId !== units[0].companyId || unit.month !== month || !unit.report) return unit;
      const { coverageSnapshotVersion: _oldMarker, ...legacyReport } = unit.report;
      return { ...unit, schemaVersion: 1 as const, report: legacyReport };
    });
    const legacyPartialState = { ...partial.state, companyClosures };
    const rest = closeCompanyUnits(legacyPartialState, units.slice(1), boss.id, "Cierre final.", `${month}-28T15:00:00.000Z`);
    expect(rest.blocked).toHaveLength(0);
    const monthly = rest.state.closures.find((row) => row.ownerId === ownerId && row.month === month)!;
    expect(monthly.report?.coverageSnapshotVersion).toBeUndefined();
    expect(closedPeriodHistory(rest.state, { viewerId: ownerId, ownerId, throughMonth: month })).toMatchObject([{ coverageHistory: "legacy-not-preserved" }]);

    const reverseState = seed();
    const reverseUnits = companyCloseUnits(reverseState, month, { scope: "person", id: ownerId });
    expect(reverseUnits.length).toBeGreaterThan(2);
    const firstNew = closeCompanyUnits(reverseState, [reverseUnits[0]], boss.id, "Primera unidad nueva.", `${month}-28T15:00:00.000Z`);
    const secondNew = closeCompanyUnits(firstNew.state, [reverseUnits[1]], boss.id, "Segunda unidad.", `${month}-28T15:00:00.000Z`);
    const reverseClosures = secondNew.state.companyClosures!.map((unit) => {
      if (unit.ownerId !== reverseUnits[1].ownerId || unit.companyId !== reverseUnits[1].companyId || unit.month !== month || !unit.report) return unit;
      const { coverageSnapshotVersion: _newMarker, ...legacyReport } = unit.report;
      return { ...unit, schemaVersion: 1 as const, report: legacyReport };
    });
    const mixedReverse = closeCompanyUnits({ ...secondNew.state, companyClosures: reverseClosures }, reverseUnits.slice(2), boss.id, "Unidades restantes.", `${month}-28T15:00:00.000Z`);
    expect(mixedReverse.blocked).toHaveLength(0);
    const reverseMonthly = mixedReverse.state.closures.find((row) => row.ownerId === ownerId && row.month === month)!;
    expect(reverseMonthly.report?.coverageSnapshotVersion).toBeUndefined();
    expect(closedPeriodHistory(mixedReverse.state, { viewerId: ownerId, ownerId, throughMonth: month })).toMatchObject([{ coverageHistory: "legacy-not-preserved" }]);
  });

  it("cierra una tarea conjunta en forma indivisible aunque el otro participante tenga un reloj activo", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const month = currentMonth();
    const source = state.tasks.find((task) => task.ownerId === "e0" && task.companyId === "c1" && task.month === month && task.kind === "resultado")!;
    const joint: typeof source = {
      ...source,
      status: "Completada" as const,
      completedAt: `${month}-07T17:00:00.000Z`,
      sessions: [],
      responsibility: {
        version: 1 as const,
        revision: 1 as const,
        mode: "joint" as const,
        activatedAt: `${month}-01T12:00:00.000Z`,
        activatedBy: boss.id,
        reason: "Control conjunto",
        members: [
          { profileId: "e0", shareBps: 5000, name: "Empleado 0", teamId: "team-a", sector: "Tesorería" },
          { profileId: "e1", shareBps: 5000, name: "Empleado 1", teamId: "team-a", sector: "Tesorería" },
        ],
      },
    };
    const otherTask = state.tasks.find((task) => task.ownerId === "e1" && task.companyId === "c1" && task.month === month && task.id !== source.id)!;
    const tasks = state.tasks.map((task) => task.id === source.id ? joint : task.id === otherTask.id
      ? { ...task, sessions: [{ id: "active-for-partner", actorId: "e1", start: `${month}-08T10:00:00.000Z`, end: null }] }
      : task);
    const result = closeCompanyUnits({ ...state, tasks }, [{ ownerId: "e0", companyId: "c1", month }], boss.id, "Cierre conjunto.");
    expect(result.closed).toHaveLength(0);
    expect(result.blocked.map((entry) => entry.unit.ownerId)).toEqual(expect.arrayContaining(["e0", "e1"]));
    expect(result.state.companyClosures || []).toHaveLength(0);
  });

  it("consolida el mes sólo después de cerrar todas las empresas y reporta los nuevos indicadores", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const ownerId = "e0";
    const month = currentMonth();
    const monthlyTasks = state.tasks.filter((task) => task.ownerId === ownerId && task.month === month && !task.responsibility);
    const byCompany = new Map<string, (typeof monthlyTasks)[number]>();
    for (const company of state.companies) {
      const result = monthlyTasks.find((task) => task.companyId === company.id && task.kind === "resultado");
      if (result) byCompany.set(company.id, { ...result, sessions: [], status: "Pendiente" });
    }
    const operational = monthlyTasks.find((task) => task.companyId === "c1" && task.kind === "operativa");
    if (operational) byCompany.set("c1-ops", { ...operational, sessions: [], status: "Pendiente" });
    expect(new Set([...byCompany.values()].map((task) => task.companyId)).size).toBeGreaterThan(1);
    state.tasks = [...byCompany.values()];
    const evidenceTask = state.tasks.find((task) => task.companyId === "c1" && task.kind === "resultado")!;
    const evidenceId = "closure-evidence-reference";
    evidenceTask.evidenceIds = [evidenceId];
    state.taskEvidence = [{
      id: evidenceId, taskId: evidenceTask.id, activityId: null, profileId: ownerId,
      name: "control.pdf", mimeType: "application/pdf", size: 1024,
      sha256: "a".repeat(64), createdAt: `${month}-07T12:00:00.000Z`,
    }];
    const opTask = state.tasks.find((task) => task.kind === "operativa");
    if (opTask) state.activity = [{ id: "lab-op-movement", taskId: opTask.id, actorId: ownerId, date: `${month}-07`, qty: 3, note: "", createdAt: `${month}-07T12:00:00.000Z` }];
    const units = [...new Set(state.tasks.map((task) => task.companyId))].map((companyId) => ({ ownerId, companyId, month }));
    const first = closeCompanyUnits(state, units.slice(0, 1), boss.id, "Cierre parcial revisado.");
    expect(first.state.closures).toHaveLength(0);
    expect(first.state.companyClosures?.find((row) => row.companyId === "c1")?.tasks.find((task) => task.id === evidenceTask.id)?.evidenceIds).toEqual([evidenceId]);
    const closedUnitTask = first.state.companyClosures?.[0]?.tasks[0];
    const changedLiveState = closedUnitTask ? {
      ...first.state,
      tasks: first.state.tasks.map((task) => task.id === closedUnitTask.id ? { ...task, weight: task.weight + 100, status: "Pendiente" as const } : task),
      activity: [],
    } : first.state;
    const rest = closeCompanyUnits(changedLiveState, units.slice(1), boss.id, "Cierre final revisado.");
    expect(rest.blocked).toHaveLength(0);
    const consolidated = rest.state.closures.find((closure) => closure.ownerId === ownerId && closure.month === month);
    expect(consolidated?.report?.schemaVersion).toBe(3);
    expect(consolidated?.report?.laboratorySummary?.operational).toMatchObject({ movementCount: opTask ? 1 : 0, weightedLoad: null, unweightedQuantity: opTask ? 3 : 0 });
    expect(consolidated?.tasks.find((task) => task.id === closedUnitTask?.id)?.weight).toBe(closedUnitTask?.weight);
    expect(consolidated?.tasks.find((task) => task.id === evidenceTask.id)?.evidenceIds).toEqual([evidenceId]);
    expect(rest.state.taskEvidence?.map((row) => row.id)).toEqual([evidenceId]);
    const operationalGroup = consolidated?.report?.groups.find((group) => group.kind === "operativa");
    expect(operationalGroup?.metrics).toMatchObject({ assigned: 0, done: 0, points: 0, earned: 0, weighted: null, onTime: null });
    expect(operationalGroup?.contributions).toBeUndefined();
    expect(rest.state.closures.filter((closure) => closure.ownerId === ownerId && closure.month === month)).toHaveLength(1);
  });

  it("construye la evolución del laboratorio desde cierres congelados y omite meses abiertos", () => {
    const state = seed();
    const ownerId = "e0";
    const viewer = active(state, "jefe");
    const snapshotTask = state.tasks.find((task) => task.ownerId === ownerId && task.kind === "resultado")!;
    const frozenTask = { ...snapshotTask, month: "2026-08", due: "2026-08-20", weight: 10, status: "Completada" as const, completedAt: "2026-08-19T15:00:00.000Z", sessions: [] };
    const operationalTask = { ...state.tasks.find((task) => task.ownerId === ownerId && task.kind === "operativa")!, id: "frozen-ops", month: "2026-08", weight: 100 };
    const openTask = { ...frozenTask, id: "open-period", month: "2026-10", completedAt: "2026-10-10T15:00:00.000Z" };
    const closure = { id: "frozen-august", ownerId, month: "2026-08", at: "2026-08-31T23:00:00.000Z", by: viewer.id, note: "", metrics: metrics([frozenTask], []), tasks: [frozenTask, operationalTask], activity: [] };
    state.closures = [closure];
    state.tasks = [openTask];
    const before = closedPeriodHistory(state, { viewerId: viewer.id, throughMonth: "2026-10", ownerId });
    state.tasks = [{ ...openTask, weight: 100, status: "Pendiente", completedAt: null }];
    const after = closedPeriodHistory(state, { viewerId: viewer.id, throughMonth: "2026-10", ownerId });
    expect(before).toEqual(after);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ period: "2026-08", points: 10, earned: 10, weighted: 100 });
  });

  it("limita historia a empresas autorizadas y atribuye puntos/tiempo personales en tareas conjuntas", () => {
    const state = seed();
    const ownerId = "e0";
    const month = "2026-08";
    const base = state.tasks.find((task) => task.ownerId === ownerId && task.companyId === "c1" && task.kind === "resultado")!;
    const shared: typeof base = {
      ...base,
      id: "history-joint-task",
      month,
      due: `${month}-20`,
      weight: 10,
      status: "Completada" as const,
      completedAt: `${month}-19T15:00:00.000Z`,
      sessions: [
        { id: "history-e0-time", actorId: "e0", start: `${month}-19T09:00:00.000Z`, end: `${month}-19T09:10:00.000Z` },
        { id: "history-e1-time", actorId: "e1", start: `${month}-19T10:00:00.000Z`, end: `${month}-19T10:20:00.000Z` },
      ],
      responsibility: {
        version: 1 as const, revision: 1 as const, mode: "joint" as const,
        activatedAt: `${month}-01T12:00:00.000Z`, activatedBy: "boss", reason: "Revisión compartida",
        members: [
          { profileId: "e0", shareBps: 5000, name: "Empleado 0", teamId: "t1", sector: "Tesorería" },
          { profileId: "e1", shareBps: 5000, name: "Empleado 1", teamId: "t1", sector: "Tesorería" },
        ],
      },
    };
    const closure = {
      id: "history-joint-closure", ownerId, companyId: "c1", month, at: `${month}-31T23:00:00.000Z`, by: "boss",
      note: "Cierre", metrics: metricsForProfile([shared], [], ownerId), tasks: [shared], activity: [], coveredActivity: [], schemaVersion: 1 as const,
    };
    state.closures = [closure];
    const manager = state.profiles.find((profile) => profile.id === "m1")!;
    const unauthorizedManager = { ...manager, companyIds: manager.companyIds.filter((companyId) => companyId !== "c1") };
    state.profiles = state.profiles.map((profile) => profile.id === manager.id ? unauthorizedManager : profile);

    expect(closedPeriodHistory(state, { viewerId: manager.id, throughMonth: month, ownerId }).some((row) => row.period === month)).toBe(false);
    expect(closedPeriodHistory(state, { viewerId: ownerId, throughMonth: month, ownerId, companyId: "c1" })[0])
      .toMatchObject({ points: 5, earned: 5, recordedSeconds: 600 });
  });

  it("conserva la carga operativa congelada en cero cuando hubo coeficiente pero ningún movimiento", () => {
    const state = seed();
    const ownerId = "e0";
    const operational = state.tasks.find((task) => task.ownerId === ownerId && task.companyId === "c1" && task.kind === "operativa")!;
    const snapshotTask = { ...operational, month: "2026-08", sessions: [] };
    const emptySummary = {
      movementCount: 0, quantityByUnit: [], weightedLoad: 0, unweightedQuantity: 0,
      recordedSeconds: 0, quality: null, order: null, timeliness: null, evaluations: 0,
    };
    state.closures = [{
      id: "zero-operational-load", ownerId, month: "2026-08", at: "2026-08-31T23:00:00.000Z", by: "boss",
      note: "Cierre sin movimientos", metrics: metrics([], []), tasks: [snapshotTask], activity: [],
      report: {
        schemaVersion: 3, generatedAt: "2026-08-31T23:00:00.000Z", employee: "Empleado 0", team: "Equipo 1", sector: "Tesorería",
        recipientIds: [], recipientNames: [], delivery: "disponible en demostración", groups: [], recordedSeconds: 0, reopenings: 0,
        laboratorySummary: { operational: emptySummary, covered: { movementCount: 0, quantityByUnit: [], weightedLoad: 0, unweightedQuantity: 0, recordedSeconds: 0 } },
      },
    }];
    const history = closedPeriodHistory(state, { viewerId: ownerId, ownerId, throughMonth: "2026-08" });
    expect(history).toMatchObject([{ period: "2026-08", operationalLoad: 0 }]);
  });

  it("no reconstruye una carga histórica null desde movimientos parcialmente parametrizados", () => {
    const state = seed();
    const ownerId = "e0";
    const rated = { ...state.tasks.find((task) => task.ownerId === ownerId && task.companyId === "c1" && task.kind === "operativa")!, id: "rated-history", month: "2026-08" };
    const unrated = { ...rated, id: "unrated-history", companyId: "c2" };
    const movement = { id: "rated-movement", taskId: rated.id, actorId: ownerId, date: "2026-08-12", qty: 5, operationalUnitWeight: 2, note: "", createdAt: "2026-08-12T12:00:00Z" };
    const unknownSummary = {
      movementCount: 1, quantityByUnit: [{ unit: rated.unit, quantity: 5 }], weightedLoad: null,
      unweightedQuantity: 0, recordedSeconds: 0, quality: null, order: null, timeliness: null, evaluations: 0,
    };
    state.closures = [{
      id: "partially-rated-history", ownerId, month: "2026-08", at: "2026-08-31T23:00:00.000Z", by: "boss",
      note: "Cierre", metrics: metrics([], []), tasks: [rated, unrated], activity: [movement],
      report: { schemaVersion: 3, laboratorySummary: { operational: unknownSummary, covered: { movementCount: 0, quantityByUnit: [], weightedLoad: 0, unweightedQuantity: 0, recordedSeconds: 0 } } } as never,
    }];
    expect(closedPeriodHistory(state, { viewerId: ownerId, ownerId, throughMonth: "2026-08" })).toMatchObject([{ operationalLoad: null }]);
  });

  it("mantiene la carga de empresa congelada y no inventa comparabilidad para filtros de detalle", () => {
    const state = seed();
    const ownerId = "e0";
    const task = { ...state.tasks.find((row) => row.ownerId === ownerId && row.companyId === "c1" && row.kind === "operativa")!, id: "company-history", month: "2026-08" };
    const summary = {
      movementCount: 1, quantityByUnit: [{ unit: task.unit, quantity: 4 }], weightedLoad: 8,
      unweightedQuantity: 0, recordedSeconds: 60, quality: null, order: null, timeliness: null, evaluations: 0,
    };
    state.closures = [{
      id: "company-history-month", ownerId, month: "2026-08", at: "2026-08-31T23:00:00.000Z", by: "boss",
      note: "Cierre", metrics: metrics([], []), tasks: [task], activity: [],
    }];
    state.companyClosures = [{
      id: "company-history-unit", ownerId, companyId: "c1", month: "2026-08", at: "2026-08-31T22:00:00.000Z", by: "boss",
      note: "Cierre de empresa", metrics: metrics([], []), tasks: [task], activity: [], coveredActivity: [], schemaVersion: 1,
      report: { schemaVersion: 3, laboratorySummary: { operational: summary, covered: { movementCount: 0, quantityByUnit: [], weightedLoad: 0, unweightedQuantity: 0, recordedSeconds: 0 } } } as never,
    }];
    expect(closedPeriodHistory(state, { viewerId: ownerId, ownerId, throughMonth: "2026-08", companyId: "c1" })).toMatchObject([{ operationalLoad: 8 }]);
    expect(closedPeriodHistory(state, { viewerId: ownerId, ownerId, throughMonth: "2026-08", sector: task.sector })).toMatchObject([{ operationalLoad: null }]);
  });

  it("no expone carga operativa de otras empresas en la historia del encargado", () => {
    const state = seed();
    const ownerId = "e0";
    const month = "2026-08";
    const sourceOperational = state.tasks.find((task) => task.ownerId === ownerId && task.kind === "operativa")!;
    const companyOneTask = { ...sourceOperational, id: "private-company-one", companyId: "c1", month };
    const companyTwoTask = { ...sourceOperational, id: "visible-company-two", companyId: "c2", month };
    const summary = (weightedLoad: number) => ({
      movementCount: 1, quantityByUnit: [{ unit: "movimientos", quantity: weightedLoad }], weightedLoad,
      unweightedQuantity: 0, recordedSeconds: 60, quality: null, order: null, timeliness: null, evaluations: 0,
    });
    const monthlySummary = { ...summary(206), quantityByUnit: [{ unit: "movimientos", quantity: 103 }] };
    state.profiles = state.profiles.map((profile) => profile.id === "m1" ? { ...profile, companyIds: ["c2"] } : profile);
    state.closures = [{
      id: "scoped-monthly-close", ownerId, month, at: `${month}-31T23:00:00.000Z`, by: "boss", note: "Cierre",
      metrics: metrics([], []), tasks: [companyOneTask, companyTwoTask], activity: [],
      report: { schemaVersion: 3, laboratorySummary: { operational: monthlySummary } } as never,
    }];
    state.companyClosures = [
      { id: "private-company-unit", ownerId, companyId: "c1", month, at: `${month}-31T22:00:00.000Z`, by: "boss", note: "Cierre", metrics: metrics([], []), tasks: [companyOneTask], activity: [], coveredActivity: [], schemaVersion: 1, report: { schemaVersion: 3, laboratorySummary: { operational: summary(200) } } as never },
      { id: "visible-company-unit", ownerId, companyId: "c2", month, at: `${month}-31T22:00:00.000Z`, by: "boss", note: "Cierre", metrics: metrics([], []), tasks: [companyTwoTask], activity: [], coveredActivity: [], schemaVersion: 1, report: { schemaVersion: 3, laboratorySummary: { operational: summary(6) } } as never },
    ];

    expect(closedPeriodHistory(state, { viewerId: "m1", ownerId, throughMonth: month })).toMatchObject([{ operationalLoad: 6 }]);
    expect(closedPeriodHistory(state, { viewerId: "m1", ownerId, throughMonth: month, companyId: "c1" })).toEqual([]);
  });

  it("consolida unidades ya congeladas aunque su tarea viva haya desaparecido", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const ownerId = "e0";
    const month = currentMonth();
    const selected = ["c1", "c2"].map((companyId) => {
      const source = state.tasks.find((task) => task.ownerId === ownerId && task.companyId === companyId && task.month === month && task.kind === "resultado")!;
      return { ...source, status: "Completada" as const, completedAt: `${month}-20T15:00:00.000Z`, sessions: [] };
    });
    state.tasks = selected;
    const first = closeCompanyUnits(state, [{ ownerId, companyId: "c1", month }], boss.id, "Cierre de la primera empresa.", `${month}-28T15:00:00.000Z`);
    expect(first.closed).toHaveLength(1);
    const afterRemoval = { ...first.state, tasks: first.state.tasks.filter((task) => task.companyId !== "c1") };
    const second = closeCompanyUnits(afterRemoval, [{ ownerId, companyId: "c2", month }], boss.id, "Cierre de la segunda empresa.", `${month}-28T16:00:00.000Z`);
    expect(second.blocked).toHaveLength(0);
    const monthly = second.state.closures.find((closure) => closure.ownerId === ownerId && closure.month === month);
    expect(monthly?.tasks.map((task) => task.companyId).sort()).toEqual(["c1", "c2"]);
    expect(monthly?.metrics.points).toBe(selected.reduce((sum, task) => sum + task.weight, 0));
  });

  it("conserva una carga mensual comparable cuando otra empresa cerrada no tiene operativas", () => {
    const state = seed();
    const boss = active(state, "jefe");
    const ownerId = "e0";
    const month = currentMonth();
    const deliverable = { ...state.tasks.find((task) => task.ownerId === ownerId && task.companyId === "c1" && task.month === month && task.kind === "resultado")!, sessions: [] };
    const operation = { ...state.tasks.find((task) => task.ownerId === ownerId && task.kind === "operativa" && task.month === month)!, id: "rated-c2-operation", companyId: "c2", sessions: [] };
    const rated = saveOperationalRate({ ...state, tasks: [...state.tasks, operation] }, boss.id, { templateId: null, taskId: operation.id, companyId: "c2", effectiveOn: `${month}-01`, unitWeight: 2 }, `${month}-01T12:00:00.000Z`);
    const movement = { id: "monthly-rated-movement", taskId: operation.id, actorId: ownerId, date: `${month}-18`, qty: 3, note: "", createdAt: `${month}-18T12:00:00Z`, ...snapshotOperationalRate(rated, operation, `${month}-18`) };
    rated.tasks = [deliverable, operation];
    rated.activity = [movement];
    const first = closeCompanyUnits(rated, [{ ownerId, companyId: "c1", month }], boss.id, "Cierre sin operativas.", `${month}-28T15:00:00.000Z`);
    const second = closeCompanyUnits(first.state, [{ ownerId, companyId: "c2", month }], boss.id, "Cierre con operativas.", `${month}-28T16:00:00.000Z`);
    const monthly = second.state.closures.find((closure) => closure.ownerId === ownerId && closure.month === month);
    expect(monthly?.report?.laboratorySummary?.operational.weightedLoad).toBe(6);
    expect(closedPeriodHistory(second.state, { viewerId: boss.id, ownerId, throughMonth: month })).toMatchObject([{ operationalLoad: 6 }]);
  });
});
