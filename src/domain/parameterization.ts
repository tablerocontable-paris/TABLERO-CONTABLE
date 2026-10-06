import { type State, type Profile, isClosed } from "./model";
import { blankOnboarding } from "../data/repository";

export function pendingParameterizations(s: State): Profile[] {
  return s.profiles.filter(
    (p) =>
      p.active &&
      p.role !== "jefe" &&
      !!s.onboarding[p.id]?.completedAt &&
      s.parameterReviews?.[p.id]?.onboardingCompletedAt !==
        s.onboarding[p.id].completedAt,
  );
}

export function prepareLaboratoryInvitation(
  s: State,
  profileId: string,
): State {
  const p = s.profiles.find((p) => p.id === profileId && p.active);
  if (
    !p ||
    !p.companyIds.length ||
    !p.position ||
    !p.sector ||
    !p.branch ||
    (p.role !== "jefe" &&
      !s.profiles.some((x) => x.id === p.managerId && x.active))
  ) {
    throw Error(
      "Completá rol, responsable, puesto, sector, sucursal y empresas antes de probar la invitación.",
    );
  }
  const current = s.onboarding[p.id];
  return {
    ...s,
    activeId: p.id,
    onboarding: {
      ...s.onboarding,
      [p.id]: {
        ...blankOnboarding(p.name),
        ...current,
        name: p.name,
        selectedCompanyIds: [...p.companyIds],
        completedAt: null,
        step: 0,
      },
    },
  };
}

export function confirmParameters(
  s: State,
  profileId: string,
  actorId: string,
  values: { id: string; weight: number; target: number }[],
  now = new Date().toISOString(),
): State {
  const actor = s.profiles.find((p) => p.id === actorId && p.active);
  const completedAt = s.onboarding[profileId]?.completedAt;
  if (
    actor?.role !== "jefe" ||
    !completedAt ||
    !pendingParameterizations(s).some((p) => p.id === profileId)
  )
    throw Error(
      "Sólo jefatura confirma los parámetros pendientes de un perfil completado.",
    );
  const assigned = s.assignments.filter(
    (a) => a.ownerId === profileId && !a.retired,
  );
  if (!assigned.length)
    throw Error("Primero asigná al menos una tarea a este perfil.");
  if (
    values.length !== assigned.length ||
    new Set(values.map((v) => v.id)).size !== values.length ||
    values.some(
      (v) =>
        !assigned.some((a) => a.id === v.id) ||
        !Number.isFinite(v.weight) ||
        v.weight < 1 ||
        v.weight > 100 ||
        !Number.isFinite(v.target) ||
        v.target < 0 ||
        v.target > 1000000 ||
        (assigned.find((a) => a.id === v.id)?.kind === "operativa" &&
          v.target === 0),
    )
  )
    throw Error(
      "Revisá todas las tareas: peso entre 1 y 100 y objetivo operativo mayor a cero.",
    );
  const byId = new Map(values.map((v) => [v.id, v]));
  return {
    ...s,
    assignments: s.assignments.map((a) => {
      const v = byId.get(a.id);
      return v ? { ...a, weight: v.weight, target: v.target } : a;
    }),
    tasks: s.tasks.map((t) => {
      const v = t.assignmentId && byId.get(t.assignmentId);
      const untouched =
        t.status === "Pendiente" &&
        !t.startedAt &&
        !t.sessions?.length &&
        t.checklist.every((c) => !c.done) &&
        !s.activity.some((a) => a.taskId === t.id) &&
        !isClosed(s, t);
      return v && untouched ? { ...t, weight: v.weight, target: v.target } : t;
    }),
    parameterReviews: {
      ...s.parameterReviews,
      [profileId]: {
        onboardingCompletedAt: completedAt,
        reviewedAt: now,
        reviewedBy: actorId,
      },
    },
  };
}
