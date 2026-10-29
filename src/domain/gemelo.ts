import { calendarCanAccessTask } from "./laboratory-work";
import { canSee, dateART, taskReadiness, type Profile, type State, type Task } from "./model";
import { fiscalObligationStatus, visibleFiscalObligations } from "./fiscalObligations";

export interface GemeloTask {
  id: string;
  title: string;
  companyId: string;
  ownerId: string;
  ownerLabel: string;
  sector: string;
  month: string;
  due: string;
  status: Task["status"];
  priority: Task["priority"];
  ready: boolean;
  reason: string;
  taskParameters?: Record<string, string>;
}

export interface GemeloObligation {
  id: string;
  title: string;
  obligationCode: string;
  companyId: string;
  fiscalPeriod: string;
  dueOn: string;
  status: ReturnType<typeof fiscalObligationStatus>;
}

/** Projects authorized operational facts; private annotations never cross this boundary. */
export function buildGemeloContext(
  state: State,
  actor: Profile,
  candidateTasks: Task[],
  month: string,
  companyId = "",
  today = dateART(),
) {
  const tasks: GemeloTask[] = candidateTasks
    .filter((task) => task.month === month && (!companyId || task.companyId === companyId) && calendarCanAccessTask(state, actor, task))
    .filter((task) => task.status !== "Completada")
    .map((task) => {
      const readiness = taskReadiness(state, task, today, actor);
      const visibleResponsible = actor.role === "jefe" || canSee(actor, task.ownerId, state.profiles);
      return {
        id: task.id,
        title: task.title,
        companyId: task.companyId,
        ownerId: task.ownerId,
        ownerLabel: visibleResponsible
          ? state.profiles.find((profile) => profile.id === task.ownerId)?.name || "Responsable asignado"
          : "Trabajo dentro de tu ámbito",
        sector: task.sector,
        month: task.month,
        due: task.due,
        status: task.status,
        priority: task.priority,
        ready: readiness.ready,
        reason: readiness.reason,
        ...(task.taskParameters ? { taskParameters: { ...task.taskParameters } } : {}),
      };
    });
  const obligations: GemeloObligation[] = visibleFiscalObligations(state, actor.id, month, companyId)
    .map((obligation) => ({
      id: obligation.id,
      title: obligation.title,
      obligationCode: obligation.obligationCode,
      companyId: obligation.companyId,
      fiscalPeriod: obligation.fiscalPeriod,
      dueOn: obligation.dueOn,
      status: fiscalObligationStatus(state, obligation),
    }));
  return { tasks, obligations };
}
