import { seed, blankOnboarding } from "../data/repository";
import {
  type State,
  type Profile,
  type Task,
  id,
  currentMonth,
  dateART,
  canSee,
  materialize,
  isClosed,
  transition,
  checkTask,
  closeMonth,
} from "../domain/model";
import {
  canWork,
  updateProfile,
  registerAbsence,
  stopClock,
} from "../domain/workforce";
import { standardizeAssignment } from "../domain/catalogue";
import { scheduleOf } from "../domain/planning";
import { occurrences } from "../domain/schedule";
import { stateSchema } from "./site-schema";

function stable(v: unknown): string {
  if (v === undefined) return "undefined";
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.entries(v)
        .filter(([, x]) => x !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => JSON.stringify(k) + ":" + stable(x))
        .join(",") +
      "}"
    );
  return JSON.stringify(v);
}
export const equal = (a: unknown, b: unknown) => stable(a) === stable(b);
function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function unique(rows: { id: string }[]) {
  requireRule(
    new Set(rows.map((r) => r.id)).size === rows.length,
    "Hay identificadores repetidos.",
  );
}
function mergeRows<T extends { id: string }>(
  all: T[],
  visible: T[],
  proposed: T[],
) {
  unique(proposed);
  const shown = new Set(visible.map((r) => r.id));
  requireRule(
    proposed.every((r) => !all.some((x) => x.id === r.id && !shown.has(x.id))),
    "Registro fuera de tu ámbito.",
  );
  return [...all.filter((r) => !shown.has(r.id)), ...proposed];
}
export function operationalSeed(ownerEmail: string): State {
  const demo = seed();
  const s: State = {
    ...demo,
    assignments: [],
    tasks: [],
    activity: [],
    audit: [],
    closures: [],
    annotations: [],
    absences: [],
    onboarding: {},
    tour: {},
    tourVersion: {},
    activeId: "admin",
  };
  // No demonstration employees or completed work enter the operational store.
  s.profiles = demo.profiles.filter((p) => ["boss", "m1", "e0"].includes(p.id));
  s.profiles = s.profiles.map((p) =>
    p.id === "m1"
      ? { ...p, name: "Encargado por configurar" }
      : p.id === "e0"
        ? { ...p, email: ownerEmail }
        : p,
  );
  s.profiles.push({
    id: "admin",
    name: "Administración · Valentino",
    email: ownerEmail,
    role: "jefe",
    managerId: null,
    teamId: "",
    sector: "Administración del tablero",
    branch: "San Luis Capital",
    position: "Propietario técnico",
    companyIds: s.companies.map((c) => c.id),
    active: true,
  });
  s.teams = demo.teams
    .filter((t) => t.id === "t1")
    .map((t) => ({ ...t, name: "Equipo contable" }));
  for (const p of s.profiles)
    s.onboarding[p.id] = {
      ...blankOnboarding(p.name),
      ...(p.id === "admin"
        ? { completedAt: new Date().toISOString(), step: 5 }
        : {}),
    };
  return s;
}
export function identify(
  s: State,
  email: string,
  ownerEmail: string,
  requestedView = "",
): { actor: Profile; isOwner: boolean } {
  const isOwner = email.toLowerCase() === ownerEmail.toLowerCase();
  const actor = isOwner
    ? s.profiles.find((p) => p.id === (requestedView === "e0" ? "e0" : "admin"))
    : s.profiles.find(
        (p) =>
          p.email?.toLowerCase() === email.toLowerCase() && p.id !== "admin",
      );
  requireRule(
    actor?.active,
    "Tu cuenta no tiene un perfil activo. Pedí a administración que configure tu correo y empresas.",
  );
  return { actor, isOwner };
}
export function projectState(s: State, p: Profile): State {
  const tasks = s.tasks.filter(
    (t) => p.companyIds.includes(t.companyId) && canWork(s, p, t),
  );
  const taskIds = new Set(tasks.map((t) => t.id));
  const ownerIds = new Set(tasks.map((t) => t.ownerId));
  const profiles = s.profiles.filter(
    (x) =>
      canSee(p, x.id, s.profiles) ||
      ownerIds.has(x.id) ||
      x.id === p.managerId ||
      x.id === "boss",
  );
  const allowedIds = new Set(profiles.map((x) => x.id));
  return structuredClone({
    ...s,
    activeId: p.id,
    companies: s.companies.filter((c) => p.companyIds.includes(c.id)),
    profiles,
    teams: s.teams.filter((t) => allowedIds.has(t.managerId)),
    tasks,
    assignments: s.assignments.filter(
      (a) =>
        canSee(p, a.ownerId, s.profiles) && p.companyIds.includes(a.companyId),
    ),
    activity: s.activity.filter((a) => taskIds.has(a.taskId)),
    annotations: (s.annotations || []).filter((a) => a.ownerId === p.id),
    // A closure spans all companies: reveal it only to an actor entitled to all of them.
    closures: s.closures.filter(
      (c) =>
        canSee(p, c.ownerId, s.profiles) &&
        c.tasks.every((t) => p.companyIds.includes(t.companyId)),
    ),
    absences: (s.absences || []).filter(
      (a) => canSee(p, a.ownerId, s.profiles) || a.replacementId === p.id,
    ),
    audit: s.audit.filter((a) => a.actorId === p.id || p.role === "jefe"),
    onboarding: Object.fromEntries(
      Object.entries(s.onboarding).filter(
        ([k]) => k === p.id || canSee(p, k, s.profiles),
      ),
    ),
    parameterReviews: Object.fromEntries(
      Object.entries(s.parameterReviews || {}).filter(
        ([pid]) => pid === p.id || canSee(p, pid, s.profiles),
      ),
    ),
    tour: { [p.id]: s.tour[p.id] || 0 },
    tourVersion: { [p.id]: s.tourVersion?.[p.id] || 0 },
  });
}

// The browser proposes the visible delta. Every mutable row is checked here;
// hidden rows are retained and never accepted from the client.
export function applyProposal(
  current: State,
  raw: unknown,
  actor: Profile,
  action: string,
  entityId: string,
  now = new Date().toISOString(),
): State {
  const parsed = stateSchema.safeParse(raw);
  requireRule(
    parsed.success,
    "Los datos no son válidos. Revisá fechas, cantidades y campos obligatorios.",
  );
  const proposed = parsed.data as unknown as State;
  requireRule(
    proposed.activeId === actor.id,
    "No se puede suplantar otro perfil.",
  );
  const visible = projectState(current, actor);
  const boss = actor.role === "jefe";
  let next: State = { ...current };
  const collections = [
    "companies",
    "teams",
    "profiles",
    "templates",
    "assignments",
    "tasks",
    "activity",
    "closures",
    "annotations",
    "absences",
  ] as const;
  for (const key of collections)
    (next as unknown as Record<string, unknown>)[key] = mergeRows(
      (current[key] || []) as { id: string }[],
      (visible[key] || []) as { id: string }[],
      (proposed[key] || []) as { id: string }[],
    );
  for (const k of ["companies", "templates", "teams"] as const)
    if (!equal(visible[k], proposed[k]))
      requireRule(
        boss,
        "Sólo jefatura configura empresas, equipos y catálogo.",
      );
  requireRule(
    next.companies.length === current.companies.length &&
      current.companies.every((c) => next.companies.some((x) => x.id === c.id)),
    "Las empresas se renombran; no se elimina su historia.",
  );
  for (const old of current.profiles) {
    const p = next.profiles.find((x) => x.id === old.id);
    requireRule(p, "No se eliminan perfiles históricos.");
    if (equal(old, p)) continue;
    if (boss) {
      requireRule(
        old.id !== "admin" || equal({ ...old, name: p.name }, p),
        "El acceso del propietario técnico se conserva.",
      );
      next = updateProfile(next, p, actor.id);
    } else
      requireRule(
        p.id === actor.id && equal({ ...old, name: p.name }, p),
        "No podés cambiar roles, correos, empresas ni responsables.",
      );
  }
  for (const p of next.profiles.filter(
    (p) => !current.profiles.some((x) => x.id === p.id),
  )) {
    requireRule(boss && p.id !== "admin", "Sólo jefatura incorpora empleados.");
    requireRule(
      p.role === "empleado",
      "Creá el perfil y configurá su rol desde Equipo.",
    );
    next = updateProfile(next, p, actor.id);
  }
  requireRule(
    new Set(
      next.profiles
        .filter((p) => p.email && p.id !== "admin")
        .map((p) => p.email!.toLowerCase()),
    ).size === next.profiles.filter((p) => p.email && p.id !== "admin").length,
    "El correo ya pertenece a otro perfil.",
  );
  const companyIds = new Set(next.companies.map((c) => c.id));
  for (const p of next.profiles)
    requireRule(
      p.companyIds.every((c) => companyIds.has(c)),
      "Empresa inexistente en un perfil.",
    );
  for (const a of next.assignments) {
    const old = current.assignments.find((x) => x.id === a.id);
    if (equal(old, a)) continue;
    requireRule(!old || boss, "Sólo jefatura reprograma asignaciones.");
    const owner = next.profiles.find((p) => p.id === a.ownerId);
    requireRule(
      owner?.active &&
        canSee(actor, owner.id, current.profiles) &&
        actor.companyIds.includes(a.companyId) &&
        owner.companyIds.includes(a.companyId),
      "Asignación fuera de las empresas o personas autorizadas.",
    );
    if (!old) {
      requireRule(
        equal(a, standardizeAssignment(next, a)),
        "La tarea debe conservar el nombre, controles y peso del catálogo.",
      );
      if (!a.templateId && !boss)
        requireRule(
          a.weight === 1,
          "Una tarea particular tiene peso inicial 1.",
        );
    }
  }
  requireRule(
    current.assignments.every((a) =>
      next.assignments.some((x) => x.id === a.id),
    ),
    "Las asignaciones históricas no se eliminan.",
  );
  // Reprogramming may remove only untouched, open occurrences.
  for (const old of current.tasks.filter(
    (t) => !next.tasks.some((x) => x.id === t.id),
  )) {
    requireRule(
      boss &&
        !isClosed(current, old) &&
        old.status === "Pendiente" &&
        !old.sessions?.length &&
        !current.activity.some((a) => a.taskId === old.id),
      "No se elimina trabajo iniciado o cerrado.",
    );
    const assignment = next.assignments.find((a) => a.id === old.assignmentId);
    requireRule(
      assignment &&
        (assignment.retired ||
          !occurrences(scheduleOf(assignment), old.month).some(
            (o) => o.date === old.scheduledOn,
          )),
      "La tarjeta sigue perteneciendo a una recurrencia vigente.",
    );
  }
  next.tasks = next.tasks.map((t) => {
    const old = current.tasks.find((x) => x.id === t.id);
    if (equal(old, t)) return old!;
    requireRule(
      actor.companyIds.includes(t.companyId) && canWork(current, actor, t),
      "Tarea fuera de tu ámbito.",
    );
    requireRule(!isClosed(current, t), "El período está cerrado.");
    if (!old) {
      const a = next.assignments.find((a) => a.id === t.assignmentId);
      requireRule(a, "La tarjeta necesita una asignación.");
      const generated = materialize({ ...next, tasks: [] }, t.month).tasks.find(
        (x) => x.assignmentId === a.id && x.scheduledOn === t.scheduledOn,
      );
      requireRule(
        generated &&
          equal(
            {
              ...generated,
              id: t.id,
              checklist: generated.checklist.map((c, i) => ({
                ...c,
                id: t.checklist[i]?.id,
              })),
            },
            t,
          ),
        "La tarjeta no coincide con su empresa, período o proceso.",
      );
      return t;
    }
    const untouched =
      boss &&
      old.status === "Pendiente" &&
      !old.startedAt &&
      !old.sessions?.length &&
      old.checklist.every((c) => !c.done) &&
      !current.activity.some((a) => a.taskId === old.id);
    const mutable = [
      "status",
      "checklist",
      "startedAt",
      "completedAt",
      "blockedBy",
      "blockedSince",
      "sessions",
      "reopenCount",
      ...(boss ? ["weight"] : []),
      ...(untouched ? ["target"] : []),
    ];
    const immutable = (x: Task) =>
      Object.fromEntries(
        Object.entries(x).filter(([k]) => !mutable.includes(k)),
      );
    requireRule(
      equal(immutable(old), immutable(t)),
      "La identidad y condiciones de una tarjeta iniciada se conservan.",
    );
    requireRule(
      equal(
        old.checklist.map((c) => ({ id: c.id, text: c.text })),
        t.checklist.map((c) => ({ id: c.id, text: c.text })),
      ),
      "Los controles pertenecen al proceso estándar.",
    );
    let result: Task = {
      ...old,
      weight: boss ? t.weight : old.weight,
      target: untouched ? t.target : old.target,
      blockedBy: t.blockedBy,
      blockedSince: t.blockedBy ? old.blockedSince || dateART(now) : null,
    };
    // Domain transitions calculate completion and reopening, never browser timestamps.
    for (const check of t.checklist)
      if (old.checklist.find((c) => c.id === check.id)!.done !== check.done)
        result = checkTask(result, check.id, check.done);
    if (result.status !== t.status) result = transition(result, t.status, now);
    result = {
      ...result,
      startedAt: result.startedAt ? old.startedAt || now : null,
      completedAt:
        result.status === "Completada"
          ? old.status === "Completada"
            ? old.completedAt
            : now
          : null,
    };
    const sessions = t.sessions || [];
    requireRule(
      (old.sessions || []).every((s) => sessions.some((x) => x.id === s.id)),
      "No se eliminan sesiones de tiempo.",
    );
    requireRule(
      sessions.filter((s) => !s.end).length <= 1,
      "Sólo puede haber una sesión activa en una tarjeta.",
    );
    result.sessions = sessions.map((s) => {
      const prior = old.sessions?.find((x) => x.id === s.id);
      if (prior) {
        requireRule(
          prior.actorId === s.actorId &&
            prior.start === s.start &&
            (!prior.end || prior.end === s.end),
          "No se modifica tiempo ya registrado.",
        );
        return { ...prior, end: prior.end || (s.end ? now : null) };
      }
      requireRule(
        s.actorId === actor.id && !s.end,
        "La sesión debe comenzar con el usuario autenticado.",
      );
      return { ...s, start: now, end: null };
    });
    if (result.status === "Completada" || result.blockedBy)
      result = stopClock(result, now);
    return result;
  });
  const occurrenceKeys = next.tasks
    .filter((t) => t.assignmentId)
    .map((t) => t.assignmentId + ":" + t.scheduledOn);
  requireRule(
    new Set(occurrenceKeys).size === occurrenceKeys.length,
    "Ya existe la tarjeta de esa ocurrencia y empresa.",
  );
  const running = next.tasks.flatMap((t) =>
    (t.sessions || []).filter((s) => !s.end),
  );
  requireRule(
    new Set(running.map((s) => s.actorId)).size === running.length,
    "Sólo puede haber un cronómetro activo por persona.",
  );
  const suspended = new Set(
    next.profiles.filter((p) => !p.active).map((p) => p.id),
  );
  next.tasks = next.tasks.map((t) => ({
    ...t,
    sessions: t.sessions?.map((s) =>
      suspended.has(s.actorId) && !s.end ? { ...s, end: now } : s,
    ),
  }));
  for (const old of current.activity)
    requireRule(
      equal(
        old,
        next.activity.find((x) => x.id === old.id),
      ),
      "Los registros de actividad son inmutables.",
    );
  next.activity = next.activity.map((a) => {
    if (current.activity.some((x) => x.id === a.id)) return a;
    const t = next.tasks.find((t) => t.id === a.taskId);
    requireRule(
      t &&
        canWork(current, actor, t) &&
        t.kind === "operativa" &&
        !isClosed(current, t) &&
        a.actorId === actor.id &&
        a.date.startsWith(t.month) &&
        a.date <= dateART(now) &&
        Number.isInteger(a.qty),
      "Registro fuera del período o de tu ámbito.",
    );
    return { ...a, createdAt: now };
  });
  for (const a of next.absences || []) {
    const old = current.absences?.find((x) => x.id === a.id);
    if (equal(old, a)) continue;
    requireRule(
      actor.role !== "empleado" && canSee(actor, a.ownerId, current.profiles),
      "La cobertura requiere un responsable autorizado.",
    );
    if (old)
      requireRule(
        equal({ ...old, cancelledAt: a.cancelledAt }, a) && a.cancelledAt,
        "Una cobertura se cancela; no se reescribe.",
      );
    else
      registerAbsence(
        {
          ...next,
          absences: (next.absences || []).filter((x) => x.id !== a.id),
        },
        a,
        actor.id,
      );
    a.createdBy = old?.createdBy || actor.id;
    if (a.cancelledAt) a.cancelledAt = now;
  }
  requireRule(
    (current.absences || []).every((a) =>
      next.absences?.some((x) => x.id === a.id),
    ),
    "Las coberturas conservan su historia.",
  );
  next.annotations = (next.annotations || []).map((a) => {
    const old = current.annotations?.find((x) => x.id === a.id);
    if (equal(old, a)) return a;
    requireRule(
      a.ownerId === actor.id && (!old || old.ownerId === actor.id),
      "Las notas son privadas de su autor.",
    );
    requireRule(
      !old?.convertedTaskId,
      "La nota vinculada conserva su referencia.",
    );
    if (a.convertedTaskId)
      requireRule(
        next.tasks.some(
          (t) =>
            t.id === a.convertedTaskId &&
            t.ownerId === actor.id &&
            next.assignments.find((x) => x.id === t.assignmentId)?.frequency ===
              "única",
        ),
        "La nota debe vincularse a una tarea propia puntual.",
      );
    requireRule(
      a.kind !== "reminder" || a.reminderOn || a.convertedTaskId,
      "El recordatorio necesita una fecha.",
    );
    return { ...a, createdAt: old?.createdAt || now, updatedAt: now };
  });
  for (const a of (current.annotations || []).filter(
    (a) => !next.annotations?.some((x) => x.id === a.id),
  ))
    requireRule(
      a.ownerId === actor.id && !a.convertedTaskId,
      "No podés eliminar esta nota.",
    );
  next.onboarding = { ...current.onboarding };
  for (const [pid, draft] of Object.entries(proposed.onboarding)) {
    if (equal(current.onboarding[pid], draft)) continue;
    requireRule(
      pid === actor.id || (boss && !current.profiles.some((p) => p.id === pid)),
      "La inducción pertenece a la persona autenticada.",
    );
    const profile = next.profiles.find((p) => p.id === pid);
    requireRule(
      profile &&
        draft.selectedCompanyIds.every((c) => profile.companyIds.includes(c)),
      "La inducción incluye empresas no autorizadas.",
    );
    requireRule(
      Object.values(draft.assignmentCompanyIds || {}).every((cs) =>
        cs.every((c) => profile.companyIds.includes(c)),
      ),
      "Empresa no autorizada.",
    );
    next.onboarding[pid] = {
      ...draft,
      completedAt: draft.completedAt
        ? current.onboarding[pid]?.completedAt || now
        : null,
    };
  }
  next.parameterReviews = { ...current.parameterReviews };
  for (const [pid, review] of Object.entries(proposed.parameterReviews || {})) {
    if (equal(current.parameterReviews?.[pid], review)) continue;
    const completedAt = next.onboarding[pid]?.completedAt;
    requireRule(
      boss &&
        !!completedAt &&
        review.onboardingCompletedAt === completedAt &&
        next.profiles.some(
          (p) => p.id === pid && p.active && p.role !== "jefe",
        ),
      "Sólo jefatura confirma los parámetros de un perfil completado.",
    );
    requireRule(
      !current.parameterReviews?.[pid] ||
        current.parameterReviews[pid].onboardingCompletedAt !== completedAt,
      "La revisión confirmada es inmutable.",
    );
    const assigned = next.assignments.filter(
      (a) => a.ownerId === pid && !a.retired,
    );
    requireRule(
      assigned.length > 0 &&
        assigned.every(
          (a) =>
            actor.companyIds.includes(a.companyId) &&
            (a.kind !== "operativa" || a.target > 0),
        ),
      "Revisá las empresas autorizadas, tareas y objetivos antes de confirmar.",
    );
    next.parameterReviews[pid] = {
      onboardingCompletedAt: completedAt!,
      reviewedBy: actor.id,
      reviewedAt: now,
    };
  }
  if (proposed.parameterReviews)
    for (const pid of Object.keys(visible.parameterReviews || {}))
      requireRule(
        pid in proposed.parameterReviews,
        "No se elimina una revisión histórica.",
      );
  next.tour = { ...current.tour, [actor.id]: proposed.tour[actor.id] || 0 };
  next.tourVersion = {
    ...current.tourVersion,
    [actor.id]: proposed.tourVersion?.[actor.id] || 0,
  };
  for (const old of current.closures)
    requireRule(
      equal(
        old,
        next.closures.find((x) => x.id === old.id),
      ),
      "Los cierres son inmutables.",
    );
  const requestedClosures = next.closures.filter(
    (c) => !current.closures.some((x) => x.id === c.id),
  );
  next.closures = current.closures;
  for (const c of requestedClosures) {
    requireRule(boss, "Sólo jefatura puede cerrar períodos.");
    requireRule(
      !next.tasks.some(
        (t) =>
          t.ownerId === c.ownerId &&
          t.month === c.month &&
          !actor.companyIds.includes(t.companyId),
      ),
      "El cierre requiere acceso a todas las empresas.",
    );
    next = closeMonth(next, c.ownerId, c.month, actor.id, c.note);
  }
  next.audit = [
    ...current.audit,
    {
      id: id(),
      at: now,
      actorId: actor.id,
      action: action.slice(0, 180) || "Actualizó trabajo",
      entityId: entityId.slice(0, 180),
    },
  ];
  next.activeId = current.activeId;
  stateSchema.parse(next);
  return next;
}
