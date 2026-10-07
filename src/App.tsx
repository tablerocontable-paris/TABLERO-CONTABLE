import NotificationCenter from "./components/NotificationCenter";
import LaboratoryBackup from "./components/LaboratoryBackup";
import TaskComments from "./components/TaskComments";
import { lazy, Suspense, useState, useEffect, type FormEvent } from "react";
import JointTaskSetup from "./components/JointTaskSetup";
import { collectTaskNotifications } from "./domain/notifications";
import TaskBoard, { orderTasks, type TaskOrder } from "./components/TaskBoard";
import QuickTaskSearch from "./components/QuickTaskSearch";
import { standardizeAssignment } from "./domain/catalogue";
import ThemeControl from "./components/ThemeControl";
import ScheduleEditor from "./components/ScheduleEditor";
import {
  defaultSchedule,
  validateSchedule,
  describeSchedule,
  validDate,
  type Schedule,
} from "./domain/schedule";
import {
  startClock,
  stopClock,
  stopActorClock,
  elapsedSeconds,
  actorElapsedSeconds,
  duration,
  applyClock,
  canWork,
  coverageFor,
  expireCoverageClocks,
} from "./domain/workforce";
import { enterLab, exitLab, isLab } from "./data/repository";
import {
  LayoutDashboard,
  Columns3,
  ChartNoAxesCombined,
  Users,
  CalendarDays,
  Plus,
  Search,
  ArrowRight,
  Play,
  Check,
  CheckCheck,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  SlidersHorizontal,
  Activity as ActivityIcon,
  BookOpen,
  LockKeyhole,
  GraduationCap,
  Clock,
  Flag,
  ArrowUpRight,
  HelpCircle,
  RotateCcw,
  GripVertical,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import {
  type State,
  type Task,
  type Profile,
  type Assignment,
  type Annotation,
  type Status,
  isResponsible,
  responsibilityShare,
  metricsForProfile,
  id,
  metrics,
  taskQuantity,
  transition,
  checkTask,
  currentMonth,
  dateART,
  canSee,
  isClosed,
  materialize,
  closeMonth,
  csvCell,
} from "./domain/model";
import { load, persist, blankOnboarding } from "./data/repository";
import { Dialog, Panel, Empty, Meter } from "./components/ui";
import OperationalTaskCard from "./components/OperationalTaskCard";
import TimelinessBadge from "./components/TimelinessBadge";
import TimelinessPanel from "./components/TimelinessPanel";
import StepListEditor, { parseSteps, validateSteps } from "./components/StepListEditor";
import { taskTimeliness } from "./domain/timeliness";
import { closureCsvRows } from "./domain/reports";
import { applyCompletionAttribution } from "./domain/workCycle";
import { currentCatalogueVersion } from "./domain/processImprovement";
import { submitHabitualTaskProposal } from "./domain/habitualTaskProposals";
import {
  canConvertInternalRequest,
  completeInternalRequestConversion,
  createInternalRequest,
  replyToInternalRequest,
  setInternalRequestStatus,
  internalRequestRecipients,
  type InternalRequest,
  type InternalRequestStatus,
} from "./domain/internalRequests";

const InternalRequests = lazy(() => import("./components/InternalRequests"));
const ProcessQuality = lazy(() => import("./components/ProcessQuality"));
const CatalogueVersionCard = lazy(() => import("./components/CatalogueVersionCard"));
const WorkCycle = lazy(() => import("./components/WorkCycle"));
const LaboratoryInvitations = lazy(() => import("./components/LaboratoryInvitations"));
const Planning = lazy(() => import("./components/Planning"));
const WorkspaceSetup = lazy(() => import("./components/WorkspaceSetup"));
const DeadlineAgenda = lazy(() => import("./components/DeadlineAgenda"));
const HabitualTaskProposalInbox = lazy(() =>
  import("./components/HabitualTaskProposals").then((module) => ({
    default: module.HabitualTaskProposalInbox,
  })),
);
const MyHabitualTaskProposals = lazy(() =>
  import("./components/HabitualTaskProposals").then((module) => ({
    default: module.MyHabitualTaskProposals,
  })),
);
const PeriodReports = lazy(() => import("./components/PeriodReports"));
const CatalogueCreator = lazy(() => import("./components/CatalogueCreator"));
const Absences = lazy(() =>
  import("./components/Workforce").then((module) => ({
    default: module.Absences,
  })),
);
const Workforce = lazy(() =>
  import("./components/Workforce").then((module) => ({
    default: module.Workforce,
  })),
);
const Onboarding = lazy(() => import("./components/Onboarding"));
const Annotations = lazy(() => import("./components/Annotations"));

type Page =
  | "overview"
  | "day"
  | "tasks"
  | "operations"
  | "analytics"
  | "team"
  | "catalog"
  | "closing"
  | "calendar"
  | "absences"
  | "planning"
  | "annotations"
  | "requests"
  | "quality";
const pages: { id: Page; name: string; icon: typeof Users }[] = [
  { id: "overview", name: "Resumen", icon: LayoutDashboard },
  { id: "day", name: "Mi día", icon: Flag },
  { id: "tasks", name: "Tablero de tareas", icon: Columns3 },
  { id: "operations", name: "Actividad operativa", icon: ActivityIcon },
  { id: "calendar", name: "Vencimientos", icon: CalendarDays },
  { id: "analytics", name: "Análisis mensual", icon: ChartNoAxesCombined },
  { id: "closing", name: "Cierre del mes", icon: LockKeyhole },
  { id: "team", name: "Equipo y estructura", icon: Users },
  { id: "catalog", name: "Catálogo y pesos", icon: BookOpen },
  { id: "quality", name: "Mejora de procesos", icon: Sparkles },
  { id: "planning", name: "Planificación", icon: CalendarDays },
  { id: "absences", name: "Ausencias y cobertura", icon: CalendarDays },
  { id: "annotations", name: "Anotaciones", icon: BookOpen },
  { id: "requests", name: "Consultas y pedidos", icon: MessageSquareText },
];
const fmt = (date: string) =>
  !date
    ? "Sin vencimiento"
    : new Date(date + "T12:00:00").toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
      });
const monthLabel = (m: string) =>
  new Date(m + "-15T12:00:00").toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
const ini = (s: string) =>
  s
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("");
const pct = (n: number | null) => (n === null ? "—" : n + "%");
const TOUR_VERSION = 4;
export default function App({initialState, remoteSave, remoteOwner=false, presence={}, onView, laboratoryMode=false}: {laboratoryMode?:boolean;initialState?:State;remoteSave?:(state:State,action?:string,entityId?:string)=>Promise<State>;remoteOwner?:boolean;presence?:Record<string,string>;onView?:(view:string)=>void} = {}) {
  const [laboratory] = useState(() => laboratoryMode || (remoteSave ? false : isLab()));
  const [state, setState] = useState<State>(() => initialState || load(laboratory));
  useEffect(()=>{if(initialState)setState(initialState)},[initialState]);
  const [tick, setTick] = useState(Date.now());
  const hasRunningClock = state.tasks.some((t) =>
    t.sessions?.some((e) => !e.end),
  );
  useEffect(() => {
    if (!hasRunningClock) return;
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasRunningClock]);
  useEffect(() => {
    if (!hasRunningClock) return;
    const next = expireCoverageClocks(state, dateART(new Date(tick).toISOString()));
    if (next !== state) commit(next, "Venció el período de cobertura");
  }, [tick]);
  const [page, setPage] = useState<Page>(() =>
    state.activeId === "boss"
      ? "overview"
      : state.onboarding[state.activeId]?.home || "day",
  );
  const [month, setMonth] = useState(currentMonth);
  const [company, setCompany] = useState("");
  const [boardOwner, setBoardOwner] = useState("");
  const [owner, setOwner] = useState("");
  const [sector, setSector] = useState("");
  const [team, setTeam] = useState("");
  const [query, setQuery] = useState("");
  const [quickTaskSearchOpen, setQuickTaskSearchOpen] = useState(false);
  const [taskOrder, setTaskOrder] = useState<TaskOrder>(() => state.boardOrder || "az");
  const [view, setView] = useState<"board" | "list">("board");
  const [group, setGroup] = useState<"individual" | "team" | "sector">(
    "individual",
  );
  const [modal, setModal] = useState<"new" | "employee" | "close" | null>(null);
  const [noteToTask, setNoteToTask] = useState<Annotation | null>(null);
  const [requestToTask, setRequestToTask] = useState<InternalRequest | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [collapsedCards,setCollapsedCards]=useState<Record<string,boolean>>({});
  const [logFor, setLogFor] = useState<string | null>(null);
  const [induct, setInduct] = useState(false);
  const [paused, setPaused] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const active = state.profiles.find((p) => p.id === state.activeId)!;
  const manager = active.role !== "empleado";
  const people = state.profiles.filter(
    (p) => p.active && canSee(active, p.id, state.profiles),
  );
  const nameOf = (pid: string) =>
    state.profiles.find((p) => p.id === pid)?.name || "Sin responsable";
  const companyOf = (cid: string) =>
    state.companies.find((c) => c.id === cid)?.name || "Sin empresa";
  const teamName = (teamId: string) => {
    const selectedTeam = state.teams.find((t) => t.id === teamId);
    return selectedTeam ? `Equipo de ${nameOf(selectedTeam.managerId)}` : "Sin equipo";
  };
  function notify(s: string) {
    setNotice(s);
  }
  useEffect(() => {
    if (!laboratory || remoteSave) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.isContentEditable || !!target?.closest("input, textarea, select, [contenteditable='true']");
      if (editing || event.altKey) return;
      const commandShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      const slashShortcut = event.key === "/" && !event.ctrlKey && !event.metaKey;
      if (!commandShortcut && !slashShortcut) return;
      event.preventDefault();
      setQuickTaskSearchOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [laboratory, remoteSave]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const on = () => setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  function commit(next: State, action?: string, entityId = "") {
    if(remoteSave){
      setState(next);
      void remoteSave(next,action,entityId).then(setState).catch((e:Error)=>notify(e.message));
      return true;
    }
    if (laboratory) {
      next = {
        ...next,
        tasks: applyCompletionAttribution(state.tasks, next.tasks, active.id),
      };
      next = collectTaskNotifications(state, next, active.id);
    }
    const s = action
      ? {
          ...next,
          audit: [
            ...next.audit,
            {
              id: id(),
              at: new Date().toISOString(),
              actorId: active.id,
              action,
              entityId,
            },
          ],
        }
      : next;
    try {
      persist(s, laboratory);
      setState(s);
      return true;
    } catch {
      notify(
        "No se pudo guardar. Liberá espacio del navegador y volvé a intentar.",
      );
      return false;
    }
  }
  function saveAnnotation(
    input: Pick<Annotation, "id" | "title" | "content" | "kind" | "category" | "reminderOn">,
  ): boolean {
    const now = new Date().toISOString();
    const existing = state.annotations?.find(
      (a) => a.id === input.id && a.ownerId === active.id,
    );
    const category = input.category?.trim().slice(0, 40) || undefined;
    const annotation: Annotation = {
      ...input,
      category,
      id: existing?.id || id(),
      ownerId: active.id,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      convertedTaskId: existing?.convertedTaskId || null,
    };
    if (existing?.convertedTaskId) {
      notify(
        "Esta anotación ya está vinculada a una tarea y quedó como referencia.",
      );
      return false;
    }
    if (input.kind === "reminder" && !input.reminderOn) {
      notify("Elegí una fecha para el recordatorio.");
      return false;
    }
    if (input.reminderOn && !validDate(input.reminderOn)) {
      notify("La fecha del recordatorio no es válida.");
      return false;
    }
    const saved = commit({
      ...state,
      annotations: [
        ...(state.annotations || []).filter((a) => a.id !== annotation.id),
        annotation,
      ],
    });
    if (saved) {
      notify("Anotación guardada en este perfil.");
      return true;
    }
    return false;
  }
  function createRequest(input: Omit<InternalRequest, "id" | "createdAt" | "updatedAt" | "messages" | "history">) {
    if (!laboratory || remoteSave) return;
    try {
      const available = internalRequestRecipients(state, active, input.kind).some((target) => target.id === input.recipientId);
      if (!available) throw new Error("El destino seleccionado ya no está disponible.");
      const request = createInternalRequest({ ...input, now: new Date().toISOString(), makeId: id });
      if (commit({ ...state, internalRequests: [...(state.internalRequests || []), request] }, "Creó una consulta o pedido", request.id)) {
        notify("Pedido registrado en el laboratorio.");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo registrar el pedido.");
    }
  }
  function updateRequestStatus(requestId: string, status: InternalRequestStatus) {
    if (!laboratory || remoteSave) return;
    const request = state.internalRequests?.find((entry) => entry.id === requestId);
    if (!request) return;
    try {
      const updated = setInternalRequestStatus(request, active, status, new Date().toISOString(), id);
      if (updated !== request) commit({ ...state, internalRequests: state.internalRequests!.map((entry) => entry.id === requestId ? updated : entry) }, "Actualizó estado de consulta", requestId);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo actualizar el pedido.");
    }
  }
  function replyRequest(requestId: string, body: string) {
    if (!laboratory || remoteSave) return;
    const request = state.internalRequests?.find((entry) => entry.id === requestId);
    if (!request) return;
    try {
      const updated = replyToInternalRequest(request, active, body, new Date().toISOString(), id);
      commit({ ...state, internalRequests: state.internalRequests!.map((entry) => entry.id === requestId ? updated : entry) }, "Respondió una consulta interna", requestId);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo responder el pedido.");
    }
  }
  function convertRequestToTask(request: InternalRequest) {
    if (!laboratory || remoteSave) return;
    const latest = state.internalRequests?.find((entry) => entry.id === request.id);
    if (!latest || !canConvertInternalRequest(latest, active)) {
      notify("Este pedido ya no está disponible para convertir en tarea.");
      return;
    }
    setNoteToTask(null);
    setRequestToTask(latest);
    setModal("new");
  }
  function openRequestTask(taskId: string) {
    const task = state.tasks.find((entry) => entry.id === taskId);
    if (!task || !canWork(state, active, task)) {
      notify("La tarea vinculada no está disponible en tu ámbito.");
      return;
    }
    setDetail(task.id);
  }
  function deleteAnnotation(annotationId: string) {
    const note = state.annotations?.find(
      (a) => a.id === annotationId && a.ownerId === active.id,
    );
    if (!note || note.convertedTaskId) return;
    if (!window.confirm(`¿Eliminar “${note.title}”?`)) return;
    commit({
      ...state,
      annotations: (state.annotations || []).filter((a) => a.id !== note.id),
    });
  }
  function convertAnnotation(note: Annotation) {
    const latest = state.annotations?.find((entry) => entry.id === note.id);
    if (!latest || latest.ownerId !== active.id) {
      notify("Esta anotación ya no está disponible en tu perfil.");
      return;
    }
    if (latest.convertedTaskId) {
      notify("Esta anotación ya está vinculada a una tarea.");
      return;
    }
    setNoteToTask(latest);
    setOwner(active.id);
    if (latest.reminderOn) setMonth(latest.reminderOn.slice(0, 7));
    setPage("tasks");
    setModal("new");
  }
  useEffect(() => {
    const next = materialize(state, month);
    if (next.tasks.length !== state.tasks.length) commit(next);
  }, [month]);
  const monthTasks = state.tasks.filter(
    (t) => t.month === month && canWork(state, active, t),
  );
  const ownBoardPages: Page[] = ["day", "tasks", "operations", "calendar"];
  const viewedOwner = boardOwner || active.id;
  const personalOverview = page === "overview" && active.role === "empleado";
  const profileScopedPage = ownBoardPages.includes(page) || personalOverview;
  const ownerFilter = profileScopedPage ? viewedOwner : owner;
  const filtered = monthTasks.filter(
    (t) =>
      (!company || t.companyId === company) &&
      (!ownerFilter ||
        isResponsible(t, ownerFilter) ||
        (ownBoardPages.includes(page) && viewedOwner === active.id &&
          coverageFor(state, t)?.replacementId === active.id)) &&
      (!sector || t.sector === sector) &&
      (!team || t.teamId === team) &&
      (!query ||
        `${t.title} ${nameOf(t.ownerId)} ${companyOf(t.companyId)}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const metricAsOf = new Date().toISOString();
  const m = profileScopedPage
    ? metricsForProfile(filtered, state.activity, viewedOwner, dateART(metricAsOf), metricAsOf)
    : metrics(filtered, state.activity, dateART(metricAsOf), metricAsOf);
  const resultTasks = filtered.filter((t) => t.kind === "resultado");
  const operations = filtered.filter((t) => t.kind === "operativa");
  const coverageTasks = viewedOwner === active.id
    ? filtered.filter((t) => t.ownerId !== active.id && !isResponsible(t, active.id) && coverageFor(state, t)?.replacementId === active.id)
    : [];
  const ownBoardResults = orderTasks(resultTasks.filter((t) => isResponsible(t, viewedOwner)), taskOrder);
  const coveredResults = orderTasks(coverageTasks.filter((t) => t.kind === "resultado"), taskOrder);
  const ownBoardOperations = orderTasks(operations.filter((t) => isResponsible(t, viewedOwner)), taskOrder);
  const coveredOperations = orderTasks(coverageTasks.filter((t) => t.kind === "operativa"), taskOrder);
  const visibleOperations = [...ownBoardOperations, ...coveredOperations];
  function changeProfile(pid: string) {
    if(remoteSave){onView?.(pid);return;}
    if (commit({ ...state, activeId: pid })) {
      setOwner("");
      setBoardOwner(pid);
      setCompany("");
      setTeam("");
      setSector("");
      setPage(state.onboarding[pid]?.home || "day");
      setPaused(false);
      setTourOpen(false);
      setQuery("");
      setDetail(null);
      setLogFor(null);
      setModal(null);
      setNoteToTask(null);
      setInduct(false);
    }
  }
  function mutateTask(t: Task, fn: (t: Task) => Task, action: string) {
    try {
      if (!canWork(state, active, t))
        throw Error("Esta tarea está fuera de tu ámbito.");
      if (isClosed(state, t))
        throw Error("El mes está cerrado y conserva su historial.");
      let next = fn(t);
      if (next === t) return;
      if (
        next.status === "En curso" &&
        t.status !== "En curso" &&
        !next.blockedBy
      )
        next = startClock(next, active.id);
      if (next.blockedBy) next = stopClock(next);
      const running = next.sessions?.some(
        (e) => !e.end && e.actorId === active.id,
      );
      commit(
        {
          ...state,
          tasks: state.tasks.map((x) =>
            x.id === t.id
              ? next
          : running &&
                  x.sessions?.some((e) => !e.end && e.actorId === active.id)
                ? stopActorClock(x, active.id)
                : x,
          ),
        },
        action,
        t.id,
      );
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function clock(t: Task, running: boolean) {
    try {
      commit(
        applyClock(state, t.id, active.id, running),
        running ? "Inició cronómetro" : "Pausó cronómetro",
        t.id,
      );
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function advance(t: Task) {
    mutateTask(
      t,
      (x) =>
        transition(
          x,
          x.status === "Pendiente"
            ? "En curso"
            : x.status === "En curso"
              ? "Completada"
              : "En curso",
        ),
      "Cambió estado",
    );
  }
  function moveBoardTask(taskId: string, nextStatus: Status, beforeTaskId?: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!laboratory || !task || task.kind !== "resultado") return;
    if (task.blockedBy && nextStatus === "En curso") {
      notify("Liberá la espera externa antes de iniciar esta tarea.");
      return;
    }
    try {
      if (!canWork(state, active, task)) throw Error("Esta tarea está fuera de tu ámbito.");
      if (isClosed(state, task)) throw Error("El mes está cerrado y conserva su historial.");
      if (task.responsibility && nextStatus === "Pendiente" && task.sessions?.some((session) => !session.end && session.actorId !== active.id))
        throw Error("La tarea compartida tiene el reloj del compañero activo. No podés devolverla a Pendiente mientras sigue trabajando.");
      let moved = nextStatus === task.status ? task : transition(task, nextStatus);
      if (nextStatus === "En curso" && task.status !== "En curso") moved = startClock(moved, active.id);
      const tasks = state.tasks.filter(row => row.id !== taskId);
      let insertAt = beforeTaskId ? tasks.findIndex(row => row.id === beforeTaskId) : -1;
      if (insertAt < 0) {
        for (let i = tasks.length - 1; i >= 0; i--) {
          if (tasks[i].ownerId === task.ownerId && tasks[i].month === task.month && tasks[i].status === nextStatus && tasks[i].kind === "resultado") { insertAt = i + 1; break; }
        }
      }
      if (insertAt < 0) insertAt = tasks.length;
      tasks.splice(insertAt, 0, moved);
      const stopsOtherClock = moved.sessions?.some(session => !session.end && session.actorId === active.id);
      const orderedTasks = stopsOtherClock ? tasks.map(row => row.id === taskId ? moved : row.sessions?.some(session => !session.end && session.actorId === active.id) ? stopActorClock(row, active.id) : row) : tasks;
      setTaskOrder("original");
      commit({ ...state, boardOrder: "original", tasks: orderedTasks }, nextStatus === task.status ? undefined : "Movió tarea a " + nextStatus, taskId);
    } catch (error) {
      notify((error as Error).message);
    }
  }
  function download(rows: unknown[][], filename: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  const draft = state.onboarding[active.id] || blankOnboarding(active.name);
  function finishOnboarding() {
    try {
      for (const schedule of Object.values(draft.schedules || {}))
        validateSchedule(schedule);
      for (const schedules of Object.values(draft.companySchedules || {}))
        for (const schedule of Object.values(schedules)) validateSchedule(schedule);
      for (const targets of Object.values(draft.companyTargets || {}))
        for (const target of Object.values(targets))
          if (!Number.isFinite(target) || target < 0) throw Error("Las metas por empresa deben ser números válidos.");
      for (const task of draft.customTasks || [])
        validateSteps(task.steps.split(/\r?\n/));
      if (draft.customTitle.trim())
        validateSteps(String(draft.customSteps || "").split(/\r?\n/));
      const customIds = [
        ...(draft.customTasks || []).map((t) => t.id),
        "custom",
      ];
      if (
        customIds.some(
          (key) =>
            [draft.schedules?.[key], ...Object.values(draft.companySchedules?.[key] || {})]
              .filter((schedule): schedule is Schedule => !!schedule)
              .some((schedule) => schedule.frequency !== "única"),
        )
      )
        throw Error(
          "Los trabajos particulares son puntuales. Para repetirlos, Juan Pablo debe incorporar el proceso al catálogo.",
        );
    } catch (e) {
      notify((e as Error).message);
      return;
    }
    const assignments: Assignment[] = [];
    const scheduleForCompany = (taskId: string, companyId: string) =>
      (laboratory && !remoteSave ? draft.companySchedules?.[taskId]?.[companyId] : undefined) ||
      draft.schedules?.[taskId] || defaultSchedule(month + "-25");
    const targetForCompany = (taskId: string, companyId: string, fallback: number) =>
      laboratory && !remoteSave ? (draft.companyTargets?.[taskId]?.[companyId] ?? fallback) : fallback;
    for (const cid of draft.selectedCompanyIds) {
      for (const tid of draft.selectedTemplateIds) {
        if (
          !(
            draft.assignmentCompanyIds?.[tid] || draft.selectedCompanyIds
          ).includes(cid)
        )
          continue;
        const t = state.templates.find((t) => t.id === tid)!;
        const schedule = scheduleForCompany(tid, cid);
        assignments.push({
          id: `onboard-${active.id}-${cid}-${tid}`,
          templateId: tid,
          ...(laboratory && !remoteSave ? { templateVersion: currentCatalogueVersion(state, tid) || 1 } : {}),
          title: t.title,
          ownerId: active.id,
          companyId: cid,
          sector: t.sector,
          kind: t.kind,
          weight: t.weight,
          unit: t.unit,
          target: targetForCompany(tid, cid, t.target),
          day: draft.day,
          frequency: draft.frequency,
          steps: t.steps,
          startMonth: month,
          schedule,
          priority: "Media",
        });
      }
      const custom = [
        ...(draft.customTasks || []),
        ...(draft.customTitle.trim()
          ? [
              {
                id: "custom",
                title: draft.customTitle,
                steps: draft.customSteps,
                kind: "resultado" as const,
                unit: "",
                target: 0,
              },
            ]
          : []),
      ];
      for (const c of custom) {
        if (
          !(
            draft.assignmentCompanyIds?.[c.id] || draft.selectedCompanyIds
          ).includes(cid)
        )
          continue;
        const schedule = scheduleForCompany(c.id, cid);
        assignments.push({
          id: `onboard-${active.id}-${cid}-${c.id}`,
          templateId: null,
          title: c.title.trim(),
          ownerId: active.id,
          companyId: cid,
          sector: active.sector,
          kind: c.kind,
          weight: 1,
          unit: c.unit,
          target: targetForCompany(c.id, cid, c.target),
          day: draft.day,
          frequency: draft.frequency,
          steps: c.steps
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          startMonth: month,
          schedule,
          priority: "Media",
        });
      }
    }
    let habitualTaskProposals = [...(state.habitualTaskProposals || [])];
    if (laboratory && !remoteSave) {
      try {
        const now = new Date().toISOString();
        for (const proposal of draft.habitualTaskProposals || []) {
          for (const cid of proposal.companyIds.filter((companyId) => draft.selectedCompanyIds.includes(companyId))) {
            const pending = submitHabitualTaskProposal({ ...state, habitualTaskProposals }, active, {
              id: `${proposal.id}:${cid}`,
              companyId: cid,
              title: proposal.title,
              process: proposal.process,
              description: proposal.description,
              kind: proposal.kind,
              unit: proposal.unit,
              target: targetForCompany(proposal.id, cid, 0),
              schedule: scheduleForCompany(proposal.id, cid),
              steps: proposal.steps,
            }, now, id);
            habitualTaskProposals = pending.habitualTaskProposals || habitualTaskProposals;
          }
        }
      } catch (e) {
        notify((e as Error).message);
        return;
      }
    }
    let next: State = {
      ...state,
      profiles: state.profiles.map((p) =>
        p.id === active.id ? { ...p, name: draft.name.trim() } : p,
      ),
      assignments: [
        ...state.assignments,
        ...assignments.filter(
          (a) => !state.assignments.some((x) => x.id === a.id),
        ),
      ],
      ...(laboratory && !remoteSave ? { habitualTaskProposals } : {}),
      onboarding: {
        ...state.onboarding,
        [active.id]: {
          ...draft,
          completedAt: new Date().toISOString(),
          step: 5,
        },
      },
      tour: { ...state.tour, [active.id]: 0 },
      tourVersion: { ...state.tourVersion, [active.id]: TOUR_VERSION },
    };
    next = materialize(next, month);
    if (commit(next, "Completó inducción", active.id)) {
      setInduct(false);
      setPage("day");
      setOwner(active.id);
      setTourOpen(true);
    }
  }
  const tours: { page: Page; selector: string; title: string; text: string }[] = [
    { page: "day", selector: ".heading", title: "Tu punto de partida", text: "Mi día reúne prioridades y vencimientos del perfil consultado para empezar el período." },
    { page: "day", selector: ".sidebar-workspace", title: "Elegí el ambiente", text: "Filtrá las empresas autorizadas. La misma conciliación en dos empresas conserva estados independientes." },
    { page: "tasks", selector: ".board-owner-filter", title: "Elegí el perfil", text: active.role === "empleado" ? "Este es tu espacio personal. El encargado y Juan Pablo consultan otros perfiles desde su selector." : "Tu tablero abre con tus tareas. Podés consultar a una persona autorizada sin cambiar quién realiza las acciones." },
    { page: "tasks", selector: ".task-order", title: "Ordená el tablero", text: "Plegá cada estado por separado y ordená por nombre para encontrar una tarjeta rápido." },
    { page: "tasks", selector: '[data-tour="task-actions"]', title: "Cargá una tarea", text: "Elegí una tarea puntual o un proceso del catálogo; revisá su empresa, frecuencia y vencimiento." },
    { page: "tasks", selector: '[data-tour="task-timers"]', title: "Medí el tiempo", text: "Iniciá, pausá o reanudá el cronómetro desde la tarjeta. El tiempo queda asociado a quien acciona." },
    { page: "tasks", selector: '[data-tour="task-controls"]', title: "Avanzá los controles", text: "Abrí la tarjeta y completá cada paso. El último control mueve el entregable a terminado automáticamente." },
    { page: "operations", selector: '[data-nav="operations"]', title: "Cargá la actividad", text: "Registrá cantidades y referencias de facturas, trámites o pagos para el cierre del período." },
    { page: "calendar", selector: '[data-nav="calendar"]', title: "Revisá las fechas", text: "Consultá los vencimientos de las tareas del período y atendé primero lo próximo." },
    { page: "absences", selector: '[data-nav="absences"]', title: "Coordiná cobertura", text: "Registrá vacaciones o licencias y organizá con el encargado quién cubre las tareas abiertas." },
    { page: "annotations", selector: '[data-nav="annotations"]', title: "Guardá referencias", text: "Conservá fórmulas y recordatorios personales. Convertí una anotación en una tarea puntual si necesitás seguimiento." },
    ...(manager ? [
      { page: "analytics" as Page, selector: '[data-nav="analytics"]', title: "Analizá resultados", text: "Compará cumplimiento, tiempos y pesos por persona, equipo o sector." },
      { page: "team" as Page, selector: '[data-nav="team"]', title: "Acompañá a tu equipo", text: "La relación jerárquica define los perfiles que podés consultar." },
      { page: "closing" as Page, selector: '[data-nav="closing"]', title: "Revisá el período", text: "El cierre mensual consolida la actividad de cada persona para revisión." },
    ] : []),
    ...(active.role === "jefe" ? [
      { page: "catalog" as Page, selector: '[data-nav="catalog"]', title: "Estandarizá procesos", text: "Configurá controles y pesos comunes para las tareas habituales." },
      { page: "team" as Page, selector: '[data-nav="team"]', title: "Administrá perfiles", text: "Configurá accesos, responsables, equipos y empresas del organigrama." },
    ] : []),
  ];
  const savedTourValue =
    state.tourVersion?.[active.id] === TOUR_VERSION
      ? state.tour[active.id] || 0
      : 0;
  const savedTour = Number.isSafeInteger(savedTourValue)
    ? Math.min(Math.max(savedTourValue, 0), tours.length)
    : 0;
  const tourStep = Number.isSafeInteger(savedTour)
    ? Math.min(Math.max(savedTour, 0), tours.length - 1)
    : 0;
  const [tourFallback, setTourFallback] = useState(false);
  useEffect(() => {
    let highlighted: Element | null = null;
    let observer: MutationObserver | undefined;
    const isVisible = (element: HTMLElement) => {
      for (let node: HTMLElement | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return false;
      }
      return true;
    };
    const resolveTarget = () => {
      highlighted?.classList.remove("spotlight");
      highlighted = null;
      let fallback = false;
      if (tourOpen && page === tours[tourStep].page) {
        const candidates = Array.from(
          document.querySelectorAll<HTMLElement>(tours[tourStep].selector),
        );
        const target = candidates.find(
          (candidate) =>
            !candidate.closest("[hidden], .column.folded") &&
            !candidate.matches(":disabled") &&
            isVisible(candidate),
        );
        highlighted = target || document.querySelector(".heading");
        fallback = !target && tours[tourStep].selector !== ".heading";
        highlighted?.classList.add("spotlight");
      }
      setTourFallback((current) => (current === fallback ? current : fallback));
    };
    resolveTarget();
    const main = document.querySelector(".main");
    if (main && tourOpen) {
      observer = new MutationObserver(resolveTarget);
      observer.observe(main, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-expanded", "hidden"],
      });
    }
    return () => {
      observer?.disconnect();
      highlighted?.classList.remove("spotlight");
    };
  }, [tourOpen, tourStep, page, active.id]);
  if (!draft.completedAt && paused && !induct)
    return (
      <div className="induction-pause">
        <img src="/logo-grupo-paris.svg" alt="Grupo París" />
        <h1>Tu comienzo quedó guardado.</h1>
        <p>Completá la inducción para habilitar tu espacio de trabajo.</p>
        <button className="primary" onClick={() => setPaused(false)}>
          Continuar inducción <ArrowRight size={16} />
        </button>
        <label>
          {remoteSave ? "Cambiar espacio" : "Volver a otra vista de demostración"}
          <select
            aria-label="Vista de usuario"
            value={active.id}
            onChange={(e) => changeProfile(e.target.value)}
          >
            {state.profiles.filter(p=>!remoteSave||(remoteOwner&&['admin','e0'].includes(p.id))||p.id===active.id).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  if ((!draft.completedAt && !paused) || induct)
    return (
      <Suspense fallback={<div className="section-loading" role="status">Cargando inducción…</div>}>
        <Onboarding
          remote={!!remoteSave}
          month={month}
          state={state}
          profile={active}
          draft={draft}
          update={(d) =>
            commit({
              ...state,
              onboarding: { ...state.onboarding, [active.id]: d },
            })
          }
          finish={finishOnboarding}
          laboratory={laboratory && !remoteSave}
          pause={() => {
            setInduct(false);
            setPaused(true);
          }}
        />
      </Suspense>
    );
  const chartGroups = (
    group === "individual"
      ? people.map((p) => ({ id: p.id, name: p.name }))
      : group === "team"
        ? state.teams.map((t) => ({ ...t, name: teamName(t.id) }))
        : [...new Set(filtered.map((t) => t.sector))].map((s) => ({
            id: s,
            name: s,
          }))
  )
    .map((g) => {
      const ts = filtered.filter((t) =>
        group === "individual"
          ? isResponsible(t, g.id)
          : group === "team"
            ? t.teamId === g.id
            : t.sector === g.id,
      );
      const x = group === "individual"
        ? metricsForProfile(ts, state.activity, g.id, dateART(metricAsOf), metricAsOf)
        : metrics(ts, state.activity, dateART(metricAsOf), metricAsOf);
      return { ...g, ...x, pendingPoints: Math.max(0, x.points - x.earned) };
    })
    .filter((g) => g.points > 0)
    .sort((a, b) => b.points - a.points);
  const history = [...new Set(state.tasks.map((t) => t.month))]
    .filter((p) => p <= month)
    .sort()
    .slice(-6)
    .map((period) => {
      const tasks = state.tasks.filter(
        (t) =>
          t.month === period &&
          canWork(state, active, t) &&
          (!company || t.companyId === company) &&
          (!owner || isResponsible(t, owner)) &&
          (!sector || t.sector === sector) &&
          (!team || t.teamId === team) &&
          (!query ||
            `${t.title} ${nameOf(t.ownerId)} ${companyOf(t.companyId)}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      );
      return {
        period,
        label: monthLabel(period),
        ...metrics(tasks, state.activity),
      };
    })
    .filter((p) => p.points > 0);
  function stats() {
    return (
      <div className="stats">
        {[
          {
            label: "Cumplimiento ponderado",
            value: pct(m.weighted),
            hint: `${m.earned.toFixed(1)} de ${m.points} puntos`,
            icon: ChartNoAxesCombined,
          },
          {
            label: "Entregables completados",
            value: `${m.done} / ${m.assigned}`,
            hint: "Tareas con resultado concreto",
            icon: CheckCheck,
          },
          {
            label: "Entregas en fecha",
            value: pct(m.onTime),
            hint: "Sobre entregables completados",
            icon: Clock,
          },
          {
            label: "Operativas en meta",
            value: `${m.operationalTarget} / ${m.operational}`,
            hint: `${m.late} vencidas · ${m.blocked} en espera`,
            icon: ActivityIcon,
          },
        ].map((s, i) => (
          <div
            className="stat"
            key={s.label}
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <div>
              <span>{s.label}</span>
              <s.icon size={17} />
            </div>
            <strong>{s.value}</strong>
            <small>{s.hint}</small>
          </div>
        ))}
      </div>
    );
  }
  function taskCard(t: Task) {
    const closed = isClosed(state, t);
    const timeliness = taskTimeliness(t, state.activity, new Date().toISOString());
    return (
      <article
        className={"task-card " + (t.status === "Completada" ? "done" : "")}
        data-task-id={t.id}
        key={t.id}
      >
        <div className="card-top">
          <span className="company-tag">
            <Building2 size={11} />
            {companyOf(t.companyId)}
          </span>
          <span className="board-card-grip" aria-hidden="true" title="Agarrá para mover"><GripVertical size={16} /><b>{t.weight} pts</b></span>
        </div>
        <div className="card-heading">
        <button className="card-title" onClick={() => setDetail(t.id)}>
          {t.title}
        </button>
        <button className="card-collapse" aria-label={`${collapsedCards[t.id]?'Desplegar':'Plegar'} tarjeta ${t.title}`} aria-expanded={!collapsedCards[t.id]} onClick={()=>setCollapsedCards({...collapsedCards,[t.id]:!collapsedCards[t.id]})}><ChevronDown size={18} aria-hidden="true" /></button>
        </div>
        <div hidden={!!collapsedCards[t.id]}>
        <p>
          {nameOf(t.ownerId)}
          {t.responsibility && <small className="joint-task-badge"> · Tarea conjunta · {responsibilityShare(t, active.id) ? `${(responsibilityShare(t, active.id) / 100).toFixed(2).replace(/\.00$/, "")}% propio` : "supervisión"}</small>}
          {coverageFor(state, t)?.replacementId && (
            <small>
              {" "}· {active.id === coverageFor(state, t)!.replacementId
                ? `cubrís a ${nameOf(t.ownerId)}`
                : active.id === t.ownerId
                  ? `te cubre ${nameOf(coverageFor(state, t)!.replacementId)}`
                  : `cobertura a cargo de ${nameOf(coverageFor(state, t)!.replacementId)}`}
            </small>
          )}
        </p>
        <TimelinessBadge value={timeliness} />
        {coverageFor(state, t)?.replacementId === active.id && viewedOwner === active.id && (
          <span className="coverage-task-badge">Tarea de cobertura para {nameOf(coverageFor(state, t)!.ownerId)}</span>
        )}
        {t.scheduledOn && <small>Realización: {fmt(t.scheduledOn)}</small>}
        <div className="timer-mini" data-tour="task-timers">
          {(t.sessions || []).some((session) => session.actorId === active.id) ? (
            <span>
              ◷ {duration(actorElapsedSeconds(t, active.id, new Date(tick).toISOString()))} propio
            </span>
          ) : (
            <span>Sin tiempo registrado</span>
          )}
          {t.status === "En curso" && !closed && !t.blockedBy && (
            <button
              aria-label={
                t.sessions?.some((e) => !e.end && e.actorId === active.id)
                  ? "Pausar cronómetro"
                  : "Reanudar cronómetro"
              }
              onClick={() => clock(t, !t.sessions?.some((e) => !e.end && e.actorId === active.id))}
            >
              {t.sessions?.some((e) => !e.end && e.actorId === active.id) ? "Pausar" : "Cronometrar"}
            </button>
          )}
        </div>
        {t.blockedBy && <span className="wait">Espera a {t.blockedBy}</span>}
        <div className="card-progress" data-tour="task-controls">
          <Meter
            value={
              t.checklist.length
                ? (t.checklist.filter((c) => c.done).length /
                    t.checklist.length) *
                  100
                : t.status === "Completada"
                  ? 100
                  : 0
            }
          />
          <small>
            {t.checklist.filter((c) => c.done).length}/{t.checklist.length}{" "}
            pasos
          </small>
        </div>
        </div>
        <div className="card-bottom">
          <span
            className={
              t.due && t.due < dateART() && t.status !== "Completada"
                ? "danger"
                : ""
            }
          >
            <CalendarDays size={12} />
            {fmt(t.due)}
          </span>
          {closed ? (
            <span className="badge">
              <LockKeyhole size={12} />
              Cerrado
            </span>
          ) : (
            <button
              className="quick"
              onClick={() => advance(t)}
              aria-label={`${t.status === "Pendiente" ? "Iniciar" : t.status === "En curso" ? "Completar" : "Reabrir"} ${t.title}`}
            >
              {t.status === "Pendiente" ? (
                <Play size={12} />
              ) : t.status === "En curso" ? (
                <Check size={13} />
              ) : (
                <RotateCcw size={12} />
              )}{" "}
              {t.status === "Pendiente"
                ? "Iniciar"
                : t.status === "En curso"
                  ? "Completar"
                  : "Reabrir"}
            </button>
          )}
        </div>
      </article>
    );
  }
  function table(ts: Task[]) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tarea</th>
              <th>Empresa</th>
              <th>Responsable</th>
              <th>Peso</th>
              <th>Vence</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {ts.map((t) => (
              <tr key={t.id}>
                <td>
                  <button
                    className="text-button"
                    onClick={() => setDetail(t.id)}
                  >
                    {t.title}
                  </button>
                  <small>{t.sector}</small>
                </td>
                <td>{companyOf(t.companyId)}</td>
                <td>{nameOf(t.ownerId)}</td>
                          <td>{t.weight} pts</td>
                          <td>{fmt(t.due)}<br /><TimelinessBadge value={taskTimeliness(t, state.activity, new Date().toISOString())} /></td>
                <td>
                  <span
                    className={
                      "status " + (t.status === "Completada" ? "success" : "")
                    }
                  >
                    {t.blockedBy ? "En espera" : t.status}
                  </span>
                </td>
                <td>
                  {t.kind === "operativa" ? (
                    <button
                      onClick={() => setLogFor(t.id)}
                      disabled={isClosed(state, t)}
                    >
                      Registrar
                    </button>
                  ) : (
                    <button
                      onClick={() => advance(t)}
                      disabled={isClosed(state, t)}
                    >
                      {t.status === "Pendiente"
                        ? "Iniciar"
                        : t.status === "En curso"
                          ? "Completar"
                          : "Reabrir"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!ts.length && <Empty />}
      </div>
    );
  }
  function distribution() {
    return (
      <Panel
        title="Dónde está el trabajo"
        sub="Entregables del período seleccionado"
      >
        <div className="distribution">
          {(["Pendiente", "En curso", "Completada"] as Status[]).map((s) => {
            let n = resultTasks.filter((t) => t.status === s).length;
            return (
              <div key={s}>
                <div>
                  <span>{s}</span>
                  <b>
                    {n}{" "}
                    <small>
                      ·{" "}
                      {resultTasks.length
                        ? Math.round((n / resultTasks.length) * 100)
                        : 0}
                      %
                    </small>
                  </b>
                </div>
                <Meter
                  value={
                    resultTasks.length ? (n / resultTasks.length) * 100 : 0
                  }
                />
              </div>
            );
          })}
          <div className="insight">
            <Flag size={16} />
            <span>
              {m.blocked
                ? `${m.blocked} tareas esperan a otra área.`
                : "No hay esperas externas en esta selección."}
            </span>
          </div>
        </div>
      </Panel>
    );
  }
  const tasksForDetail = state.tasks.find((t) => t.id === detail && canWork(state, active, t));
  const logTask = state.tasks.find((t) => t.id === logFor && canWork(state, active, t));
  function openSearchResult(task: Task) {
    if (!canWork(state, active, task)) {
      notify("La tarea ya no está disponible en tu ámbito.");
      setQuickTaskSearchOpen(false);
      return;
    }
    setQuickTaskSearchOpen(false);
    setCompany("");
    setOwner("");
    setSector("");
    setTeam("");
    setQuery("");
    setBoardOwner(active.role === "empleado" ? active.id : task.ownerId);
    setMonth(task.month);
    setPage("tasks");
    setDetail(task.id);
  }

  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo-grupo-paris.svg" alt="Grupo París" />
        </div>
        <label className="workspace sidebar-workspace">
          <Building2 size={18} />
          <div>
            <span>AMBIENTE DE TRABAJO</span>
            <select aria-label="Ambiente de trabajo" value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="">Todas las empresas</option>
              {state.companies.filter((c) => active.companyIds.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </label>
        <span className="nav-label">TU ESPACIO DE TRABAJO</span>
        <nav>
          {pages
            .filter((p) =>
              ((p.id !== "catalog" && p.id !== "closing") || active.role === "jefe") &&
              (p.id !== "requests" || (laboratory && !remoteSave)) &&
              (p.id !== "quality" || (laboratory && !remoteSave)),
            )
            .map((p) => (
              <button
                data-nav={p.id}
                key={p.id}
                className={page === p.id ? "active" : ""}
                onClick={() => {
                  setPage(p.id);
                  setQuery("");
                }}
              >
                <p.icon size={17} />
                {p.name}
                {p.id === "tasks" && <span>{resultTasks.length}</span>}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          {!remoteSave && !laboratoryMode && <button onClick={() => (laboratory ? exitLab() : enterLab(state))}>
            {laboratory ? "Salir del laboratorio" : "Laboratorio de pruebas"}
          </button>}
          <button
            onClick={() => {
              const progress = savedTour;
              const start = progress >= tours.length ? 0 : progress;
              if (
                !commit({
                  ...state,
                  tour: { ...state.tour, [active.id]: start },
                  tourVersion: {
                    ...state.tourVersion,
                    [active.id]: TOUR_VERSION,
                  },
                })
              )
                return;
              setPage(tours[start].page);
              setTourOpen(true);
            }}
          >
            <HelpCircle size={16} />
            Recorrido guiado
          </button>
          <div className="demo-indicator">
            <i />
            {remoteSave ? "ESPACIO PRIVADO" : "DEMOSTRACIÓN INTERACTIVA"}
          </div>
          <label>
            {remoteSave ? "Mi espacio" : "Vista de usuario · simulación"}
            <select
              aria-label="Vista de usuario"
              value={active.id}
              onChange={(e) => changeProfile(e.target.value)}
            >
              {state.profiles
                .filter((p) => p.active && (!remoteSave || (remoteOwner && ['admin','e0'].includes(p.id)) || p.id===active.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id==='admin'&&remoteSave ? 'Administrar tablero' : p.id==='e0'&&remoteSave ? 'Mi tablero · Valentino' : `${p.name} · ${p.role}`}
                  </option>
                ))}
              {remoteSave&&remoteOwner&&!state.profiles.some(p=>p.id==='admin')&&<option value="admin">Administrar tablero</option>}
            </select>
          </label>
          <div className="user">
            <span className="avatar">{ini(active.name)}</span>
            <div>
              {active.name}
              <small>{active.role} · {remoteSave ? 'sesión autenticada' : 'datos locales'}</small>
            </div>
          </div>
        </div>
      </aside>
      <main className="main">
        <header>
          <div>
            Espacio de trabajo <span>/</span>
            <b>{pages.find((p) => p.id === page)?.name}</b>
          </div>
          <div className="header-right">
            {laboratory && !remoteSave && <button type="button" className="quick-search-trigger" aria-label="Buscar tareas" title="Buscar tareas · Ctrl+K" onClick={() => setQuickTaskSearchOpen(true)}><Search size={16} aria-hidden="true" /><span>Buscar</span><kbd>Ctrl K</kbd></button>}
            {!remoteSave && <NotificationCenter key={active.id} state={state} commit={commit} notify={notify} laboratory={laboratory} onOpenProposals={() => setPage("team")} onOpenTask={taskId => {
              const task = state.tasks.find(t => t.id === taskId);
              if (task && canWork(state, active, task)) { setMonth(task.month); setPage('tasks'); setDetail(taskId); }
            }} />}
            <ThemeControl />
          </div>
        </header>
        <div className="content">
          {laboratory && (
            <div className="lab-banner">
              <b>Vista de prueba</b>
              <span>
                Podés probar todos los perfiles. Los cambios y KPI de este
                entorno no afectan el tablero principal.
              </span>
              {!remoteSave && <LaboratoryBackup state={state} />}
              {!laboratoryMode && <button onClick={exitLab}>Volver al tablero</button>}
            </div>
          )}
          {remoteSave&&active.id==='admin'&&state.tasks.length===0&&<div className="notice-banner"><span>Empezá por configurar las empresas y los responsables en Equipo. Después abrí Mi tablero para completar tu inducción y cargar el primer trabajo.</span><button onClick={()=>setPage('team')}>Configurar equipo</button><button onClick={()=>onView?.('e0')}>Abrir mi tablero</button></div>}
          {state.tasks
            .filter((t) =>
              t.sessions?.some((e) => !e.end && e.actorId === active.id),
            )
            .map((t) => (
              <div className="active-clock" key={t.id}>
                <span>
                  ◷ {t.title} ·{" "}
                  {duration(actorElapsedSeconds(t, active.id, new Date(tick).toISOString()))} propio
                </span>
                <button onClick={() => clock(t, false)}>
                  Pausar cronómetro
                </button>
              </div>
            ))}
          {offline && (
            <div role="status" className="notice-banner">
              {remoteSave ? 'Estás sin conexión. Los cambios necesitan confirmación del servidor; conservaremos tu propuesta si falla el guardado.' : 'Estás sin conexión. Esta demostración guarda en el navegador; no sincroniza con otros usuarios.'}
            </div>
          )}
          {!draft.completedAt && (
            <div className="notice-banner">
              Tu espacio está pendiente de configuración.
              <button
                className="primary"
                onClick={() => {
                  setPaused(false);
                  setInduct(true);
                }}
              >
                Continuar inducción
              </button>
            </div>
          )}
          <div className="heading">
            <div>
              <span className="eyebrow">CONTABILIDAD · GRUPO PARÍS</span>
              <h1>
                {page === "overview"
                  ? active.role === "empleado"
                    ? "Tu trabajo, en perspectiva."
                    : active.role === "encargado"
                      ? "Tu equipo, en perspectiva."
                      : "Todo el equipo, en perspectiva."
                  : page === "day"
                    ? viewedOwner === active.id
                      ? `Buen día, ${active.name.split(" ")[0]}.`
                      : `Tablero de ${nameOf(viewedOwner).split(" ")[0]}.`
                    : page === "tasks"
                      ? "El trabajo avanza con vos."
                      : page === "operations"
                        ? "Cada jornada deja su huella."
                        : page === "annotations"
                          ? "Tus referencias, siempre a mano."
                          : page === "analytics"
                            ? "Medir para acompañar mejor."
                            : page === "team"
                              ? "Personas, responsabilidades y equipo."
                              : page === "catalog"
                                ? "El mismo criterio para todos."
                                : page === "closing"
                                  ? "Un cierre con evidencia."
                                  : page === "absences"
                                    ? "El equipo se cubre, el trabajo sigue."
                      : page === "planning"
                                      ? "Cada tarea, en su momento."
                                    : page === "requests"
                                        ? "Cada pedido, con responsable y seguimiento."
                                      : page === "quality"
                                        ? "Mejorar el proceso también es parte del trabajo."
                                      : "Lo próximo, a la vista."}
              </h1>
              <p>
                  {page === "overview" && active.role === "empleado"
                    ? "Tus tareas, prioridades y resultados del período."
                    : page === "operations"
                  ? "Facturas, trámites y pagos: cantidades, referencias y metas por mes."
                  : page === "annotations"
                    ? "Guardá fórmulas y recordatorios personales; convertí una anotación en tarea cuando necesite seguimiento."
                    : page === "analytics"
                      ? "Pesos definidos por el jefe. Resultados explicables, con el detalle detrás de cada número."
                      : page === "team"
                        ? "La relación jefe → encargado → empleado define el ámbito de trabajo."
                        : page === "closing"
                        ? "Consolidá el trabajo mensual de cada persona y conservá una foto del resultado."
                        : page === "quality"
                          ? "Evidencia, acciones correctivas y estándares versionados, sin puntuaciones decorativas."
                          : "Tus empresas, tus prioridades y el contexto que necesitás para decidir."}
              </p>
            </div>
            {(["day", "tasks", "operations", "planning"] as Page[]).includes(page) && (
            <button className="primary" data-tour="task-actions" onClick={() => setModal("new")}>
                <Plus size={17} /> Nueva tarea
              </button>
            )}
          </div>
          {page !== "requests" && page !== "quality" && <div className="filters">
            <label className="company-filter">
              <span>AMBIENTE DE TRABAJO</span>
              <select
                aria-label="Empresa"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              >
                <option value="">Todas las empresas</option>
                {state.companies.filter((c) => active.companyIds.includes(c.id)).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <small className="workspace-count">{filtered.length} tareas visibles · {monthLabel(month)}</small>
            </label>
            <div className="filter-divider" />
            <label>
              <span>PERÍODO</span>
              <input
                aria-label="Período"
                type="month"
                value={month}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
              />
            </label>
            <select
              aria-label="Equipo"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
            >
              <option value="">Todos los equipos</option>
              {state.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {teamName(t.id)}
                </option>
              ))}
            </select>
            {ownBoardPages.includes(page) ? (
              <label className="board-owner-filter">
                <span>PERFIL QUE ESTÁS VIENDO</span>
                <select aria-label="Perfil que estás viendo" value={viewedOwner} onChange={(e) => setBoardOwner(e.target.value)}>
                  <option value={active.id}>Mis tareas · {active.name}</option>
                  {people.filter((p) => p.id !== active.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            ) : (
              <select aria-label="Empleado" value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="">{manager ? "Todo mi ámbito" : "Mis tareas"}</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <select
              aria-label="Sector"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
            >
              <option value="">Todos los sectores</option>
              {[...new Set(state.templates.map((t) => t.sector))].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button
              className="icon-button"
              aria-label="Limpiar filtros"
              onClick={() => {
                setCompany("");
                setOwner("");
                setTeam("");
                setSector("");
                setQuery("");
              }}
            >
              <RotateCcw size={16} />
            </button>
          </div>}
          <div className="view-content" key={page}>
            <Suspense fallback={<div className="section-loading" role="status" aria-live="polite">Cargando sección…</div>}>
            {page === "requests" && laboratory && !remoteSave && <InternalRequests state={state} actor={active} onCreate={createRequest} onStatus={updateRequestStatus} onReply={replyRequest} onConvert={convertRequestToTask} onOpenTask={openRequestTask} />}
            {page === "quality" && laboratory && !remoteSave && <ProcessQuality state={state} actor={active} commit={commit} notify={notify} />}
            {(page === "overview" || page === "day") && (
              <>
                {stats()}
                {page === "day" && draft.reminders && (
                  <div className="reminder">
                    <Clock size={18} />
                    <span>
                      {
                        filtered.filter(
                          (t) =>
                            t.ownerId === active.id &&
                            t.status !== "Completada" &&
                            t.kind === "resultado" &&
                            t.due &&
                            t.due <= dateART(),
                        ).length
                      }{" "}
                      tareas propias requieren atención por vencimiento.
                    </span>
                    <button
                      onClick={() => {
                        setOwner(active.id);
                        setPage("tasks");
                      }}
                    >
                      Ir a mis tareas <ArrowRight size={14} />
                    </button>
                  </div>
                )}
                {page === "day" &&
                  (state.annotations || []).some(
                    (a) =>
                      a.ownerId === active.id &&
                      a.reminderOn &&
                      a.reminderOn <= dateART() &&
                      !a.convertedTaskId,
                  ) && (
                    <div className="reminder annotation-reminder">
                      <BookOpen size={18} />
                      <span>
                        {
                          (state.annotations || []).filter(
                            (a) =>
                              a.ownerId === active.id &&
                              a.reminderOn &&
                              a.reminderOn <= dateART() &&
                              !a.convertedTaskId,
                          ).length
                        }{" "}
                        recordatorios personales necesitan atención.
                      </span>
                      <button onClick={() => setPage("annotations")}>
                        Ver anotaciones <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                {page === "day" && laboratory && !remoteSave && (
                  <MyHabitualTaskProposals state={state} actor={active} month={month} commit={commit} notify={notify} />
                )}
                <div className="dashboard-row">
                  <Panel
                    title={active.role === "empleado" ? "Tu avance ponderado" : "Avance ponderado del equipo"}
                    sub="Puntos completados y pendientes · mismo período"
                    action={
                      <button
                        className="text-button"
                        onClick={() => setPage("analytics")}
                      >
                        Abrir análisis <ArrowUpRight size={14} />
                      </button>
                    }
                  >
                    <div className="chart">
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart
                          data={chartGroups.slice(0, 6)}
                          margin={{ top: 10, right: 15, bottom: 0, left: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10 }}
                            interval={0}
                            angle={-22}
                            textAnchor="end"
                            height={56}
                          />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip cursor={{ fill: "var(--chart-cursor)", fillOpacity: 0.12, stroke: "var(--chart-cursor-border)", strokeOpacity: 0.55 }} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 9, color: "var(--ink)" }} labelStyle={{ color: "var(--ink)", fontWeight: 600 }} itemStyle={{ color: "var(--ink)" }} />
                          <Legend />
                          <Bar
                            dataKey="earned"
                            name="Puntos logrados"
                            stackId="a"
                            fill="var(--chart-earned)"
                            maxBarSize={28}
                            activeBar={{ fill: "var(--chart-active)", stroke: "var(--chart-active-border)" }}
                          />
                          <Bar
                            dataKey="pendingPoints"
                            name="Puntos pendientes"
                            stackId="a"
                            fill="var(--chart-muted)"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={28}
                            activeBar={{ fill: "var(--chart-active)", stroke: "var(--chart-active-border)" }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>
                  {distribution()}
                </div>
                <div className="section-heading">
                  <h2>
                    {page === "day"
                      ? viewedOwner === active.id
                        ? "Tu próxima acción"
                        : `Próxima acción de ${nameOf(viewedOwner)}`
                      : "Prioridades del equipo"}
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => setPage("tasks")}
                  >
                    Ver tablero <ArrowRight size={14} />
                  </button>
                </div>
                <div className="priority-grid">
                  {resultTasks
                    .filter(
                      (t) =>
                        t.status !== "Completada" &&
                        (page !== "day" || isResponsible(t, viewedOwner)),
                    )
                    .sort((a, b) =>
                      (a.due || "9999").localeCompare(b.due || "9999"),
                    )
                    .slice(0, 4)
                    .map(taskCard)}
                </div>
                {!resultTasks.some(
                  (t) =>
                    t.status !== "Completada" &&
                    (page !== "day" || isResponsible(t, viewedOwner)),
                ) && (
                  <Empty text="No tenés entregables pendientes en esta selección." />
                )}
              </>
            )}
            {page === "tasks" && (
              <>
                <div className="toolbar">
                  <div className="search">
                    <Search size={16} />
                    <input
                      aria-label="Buscar tareas"
                      placeholder="Buscar tarea, empresa o persona…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <label className="task-order">
                    Ordenar tareas
                    <select
                      aria-label="Ordenar tareas"
                      value={taskOrder}
                      onChange={(e) =>
                        setTaskOrder(e.target.value as TaskOrder)
                      }
                    >
                      <option value="az">Nombre · A a Z</option>
                      <option value="za">Nombre · Z a A</option>
                      <option value="original">Orden original</option>
                    </select>
                  </label>
                  <div className="segmented">
                    <button
                      className={view === "board" ? "selected" : ""}
                      onClick={() => setView("board")}
                    >
                      <Columns3 size={14} />
                      Tablero
                    </button>
                    <button
                      className={view === "list" ? "selected" : ""}
                      onClick={() => setView("list")}
                    >
                      Lista
                    </button>
                  </div>
                  <span>
                    {resultTasks.length} entregables · {operations.length}{" "}
                    operativas
                  </span>
                </div>
                <section className="task-owner-section">
                  <h2>{viewedOwner === active.id ? "Mis entregables" : `Entregables de ${nameOf(viewedOwner)}`}</h2>
                  {view === "list" ? (
                    <Panel title="Entregables" sub="Una instancia independiente por empresa y mes">
                      {table(ownBoardResults)}
                    </Panel>
                  ) : (
                    <TaskBoard tasks={ownBoardResults} renderCard={taskCard} onMove={moveBoardTask} />
                  )}
                </section>
                {coveredResults.length > 0 && (
                  <section className="task-owner-section coverage-section">
                    <h2>Tareas que cubrís <span>{coveredResults.length}</span></h2>
                    <p>Estas tarjetas conservan a su responsable y el mismo historial de la tarea.</p>
                    {view === "list" ? (
                      <Panel title="Entregables cubiertos" sub="La cobertura no crea una tarea duplicada">
                        {table(coveredResults)}
                      </Panel>
                    ) : (
                      <TaskBoard tasks={coveredResults} renderCard={taskCard} />
                    )}
                  </section>
                )}
              </>
            )}
            {page === "annotations" && (
              <Annotations
                remote={!!remoteSave}
                rows={(state.annotations || []).filter(
                  (a) => a.ownerId === active.id,
                )}
                tasks={state.tasks}
                onSave={saveAnnotation}
                onDelete={deleteAnnotation}
                onConvert={convertAnnotation}
                onOpenTask={(taskId) => {
                  const task = state.tasks.find((t) => t.id === taskId);
                  if (!task || !canWork(state, active, task)) return;
                  setMonth(task.month);
                  setPage("tasks");
                  setDetail(taskId);
                }}
              />
            )}
            {page === "operations" && (
              <>
                <section className="task-owner-section">
                  <h2>{viewedOwner === active.id ? "Mis operativas" : `Operativas de ${nameOf(viewedOwner)}`}</h2>
                  <div className="operations-grid">
                    {ownBoardOperations.map((t) => (
                      <OperationalTaskCard
                        key={t.id}
                        task={t}
                        company={companyOf(t.companyId)}
                        owner={nameOf(t.ownerId)}
                        scheduled={t.scheduledOn ? fmt(t.scheduledOn) : ""}
                        quantity={taskQuantity(t, state.activity)}
                        time={duration(actorElapsedSeconds(t, active.id, new Date(tick).toISOString()))}
                        actorId={active.id}
                        closed={isClosed(state, t)}
                        timeliness={taskTimeliness(t, state.activity, new Date().toISOString())}
                        onClock={() => clock(t, !t.sessions?.some((session) => !session.end && session.actorId === active.id))}
                        onLog={() => setLogFor(t.id)}
                        onDetails={() => setDetail(t.id)}
                      />
                    ))}
                  </div>
                </section>
                {coveredOperations.length > 0 && (
                  <section className="task-owner-section coverage-section">
                    <h2>Tareas operativas que cubrís <span>{coveredOperations.length}</span></h2>
                    <p>Los registros se conservan en la tarea original y muestran quién realizó cada aporte.</p>
                    <div className="operations-grid">
                      {coveredOperations.map((t) => (
                        <OperationalTaskCard
                          key={t.id}
                          task={t}
                          company={companyOf(t.companyId)}
                          owner={nameOf(t.ownerId)}
                          coverOwner={active.name}
                          scheduled={t.scheduledOn ? fmt(t.scheduledOn) : ""}
                          quantity={taskQuantity(t, state.activity)}
                          time={duration(actorElapsedSeconds(t, active.id, new Date(tick).toISOString()))}
                          actorId={active.id}
                          closed={isClosed(state, t)}
                          timeliness={taskTimeliness(t, state.activity, new Date().toISOString())}
                          onClock={() => clock(t, !t.sessions?.some((session) => !session.end && session.actorId === active.id))}
                          onLog={() => setLogFor(t.id)}
                          onDetails={() => setDetail(t.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {!ownBoardOperations.length && !coveredOperations.length && (
                  <Empty text="No hay operativas. Podés crear una desde Nueva tarea." />
                )}
                <Panel
                  title="Últimos registros"
                  sub="Cada registro conserva fecha, cantidad, unidad, empresa y referencia"
                >
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Actividad</th>
                          <th>Empresa</th>
                          <th>Responsable</th>
                          <th>Cantidad</th>
                          <th>Referencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.activity
                          .filter(
                            (a) =>
                              visibleOperations.some((t) => t.id === a.taskId) &&
                              a.date.startsWith(month),
                          )
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((a) => {
                            const t = visibleOperations.find(
                              (t) => t.id === a.taskId,
                            )!;
                            return (
                              <tr key={a.id}>
                                <td>{fmt(a.date)}</td>
                                <td>{t.title}</td>
                                <td>{companyOf(t.companyId)}</td>
                                <td>{nameOf(t.ownerId)}</td>
                                <td>
                                  {a.qty} {t.unit}
                                </td>
                                <td>{a.note}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </>
            )}
            {page === "analytics" && (
              <>
                <div className="analytics-toolbar">
                  <div className="segmented">
                    {[
                      ["individual", "Por empleado"],
                      ["team", "Por equipo"],
                      ["sector", "Por sector"],
                    ].map(([v, l]) => (
                      <button
                        key={v}
                        className={group === v ? "selected" : ""}
                        onClick={() => setGroup(v as typeof group)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() =>
                      download(
                        [
                          [
                            "Ámbito",
                            "Puntos asignados",
                            "Puntos logrados",
                            "Cumplimiento %",
                            "Puntualidad %",
                            "Entregables",
                            "Completados",
                            "Vencidos",
                            "Entregables antes / evaluables",
                            "Entregables antes %",
                            "Promedio días de anticipación",
                            "Metas operativas antes / evaluables",
                            "Metas operativas antes %",
                            "Promedio días meta anticipada",
                          ],
                          ...chartGroups.map((g) => [
                            g.name,
                            g.points,
                            g.earned,
                            g.weighted,
                            g.onTime,
                            g.assigned,
                            g.done,
                            g.late,
                            `${g.timeliness?.results.early ?? 0}/${g.timeliness?.results.evaluated ?? 0}`,
                            g.timeliness?.results.earlyRate ?? "Sin muestra",
                            g.timeliness?.results.averageDaysAhead ?? "Sin muestra",
                            `${g.timeliness?.operational.early ?? 0}/${g.timeliness?.operational.evaluated ?? 0}`,
                            g.timeliness?.operational.earlyRate ?? "Sin muestra",
                            g.timeliness?.operational.averageDaysAhead ?? "Sin muestra",
                          ]),
                        ],
                        `analisis-${month}.csv`,
                      )
                    }
                  >
                    <Download size={15} />
                    Exportar
                  </button>
                </div>
                {stats()}
                <TimelinessPanel
                  value={m.timeliness!}
                  rows={chartGroups.map((g) => ({
                    id: g.id,
                    name: g.name,
                    timeliness: g.timeliness,
                  }))}
                />
                {laboratory && !remoteSave && (
                  <WorkCycle
                    tasks={filtered}
                    activity={state.activity}
                    state={state}
                    month={month}
                  />
                )}
                <div className="dashboard-row">
                  <Panel
                    title="Cumplimiento ponderado"
                    sub="Porcentaje de puntos logrados sobre puntos asignados"
                  >
                    <div className="chart">
                      <ResponsiveContainer
                        width="100%"
                        height={Math.max(260, chartGroups.length * 43)}
                      >
                        <BarChart
                          layout="vertical"
                          data={chartGroups}
                          margin={{ right: 30, left: 5 }}
                        >
                          <CartesianGrid
                            horizontal={false}
                            strokeDasharray="3 3"
                          />
                          <XAxis
                            type="number"
                            domain={[0, 100]}
                            unit="%"
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={135}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip cursor={{ fill: "var(--chart-cursor)", fillOpacity: 0.12, stroke: "var(--chart-cursor-border)", strokeOpacity: 0.55 }} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 9, color: "var(--ink)" }} labelStyle={{ color: "var(--ink)", fontWeight: 600 }} itemStyle={{ color: "var(--ink)" }} formatter={(v) => `${v}%`} />
                          <ReferenceLine x={100} stroke="#a4a8b0" />
                          <Bar
                            dataKey="weighted"
                            name="Cumplimiento"
                            fill="var(--chart-ink)"
                            radius={[0, 5, 5, 0]}
                            maxBarSize={22}
                            activeBar={{ fill: "var(--chart-active)", stroke: "var(--chart-active-border)" }}
                            onClick={(d) => {
                              if (group === "individual")
                                setBoardOwner(String(d.id));
                              if (group === "team") setTeam(String(d.id));
                              if (group === "sector") setSector(String(d.id));
                              if (group !== "individual") {
                                setPage("analytics");
                              } else {
                                setPage("tasks");
                              }
                            }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>
                  <Panel
                    title="Carga asignada y lograda"
                    sub="Puntos · comparar el porcentaje junto con la carga"
                  >
                    <div className="performance-list">
                      {chartGroups.map((g) => (
                        <div key={g.id}>
                          <div>
                            <b>{g.name}</b>
                            <span>
                              {g.earned.toFixed(1)} / {g.points} pts
                            </span>
                          </div>
                          <Meter value={g.weighted || 0} />
                          <small>
                            {g.done}/{g.assigned} entregables · {g.blocked} en
                            espera · {g.operationalTarget}/{g.operational}{" "}
                            operativas en meta
                          </small>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
                <Panel
                  title="Tiempo registrado y reaperturas"
                  sub="Trabajo cronometrado por quien lo realizó. No equivale a presencia ni se usa como penalización automática."
                >
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Persona</th>
                          <th>Tiempo registrado</th>
                          <th>Sesiones</th>
                          <th>Entregables medidos</th>
                          <th>Reaperturas de sus tareas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {people.map((p) => {
                          const sessions = filtered
                            .flatMap((t) => t.sessions || [])
                            .filter((e) => e.actorId === p.id);
                          const secs = sessions.reduce(
                            (n, e) =>
                              n +
                              Math.max(
                                0,
                                (Date.parse(
                                  e.end || new Date(tick).toISOString(),
                                ) -
                                  Date.parse(e.start)) /
                                  1000,
                              ),
                            0,
                          );
                          const measured = filtered.filter(
                            (t) =>
                              t.kind === "resultado" &&
                              t.status === "Completada" &&
                              t.sessions?.some((e) => e.actorId === p.id),
                          );
                          return (
                            <tr key={p.id}>
                              <td>{p.name}</td>
                              <td>
                                {sessions.length
                                  ? duration(secs)
                                  : "Sin medición"}
                              </td>
                              <td>{sessions.length}</td>
                              <td>{measured.length}</td>
                              <td>
                                {filtered
                                  .filter((t) => t.ownerId === p.id)
                                  .reduce(
                                    (n, t) => n + (t.reopenCount || 0),
                                    0,
                                  )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p>
                    Un nuevo ciclo programado no es una reapertura. En las
                    coberturas se conserva el titular y se identifica al
                    ejecutor en cada sesión.
                  </p>
                </Panel>
                <Panel
                  title="Evolución mensual"
                  sub="Últimos seis períodos con trabajo registrado · se respetan los filtros"
                >
                  {history.length > 1 ? (
                    <div className="chart">
                      <ResponsiveContainer width="100%" height={230}>
                        <LineChart
                          data={history}
                          margin={{ top: 15, right: 25, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                          <YAxis
                            domain={[0, 100]}
                            unit="%"
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip
                            labelFormatter={(label) =>
                              monthLabel(String(label))
                            }
                            formatter={(value) => `${value}%`}
                          />
                          <Legend />
                          <Line
                            dataKey="weighted"
                            name="Cumplimiento ponderado"
                            stroke="var(--chart-ink)"
                            strokeWidth={3}
                            dot={{ r: 4 }}
                            connectNulls={false}
                          />
                          <Line
                            dataKey="onTime"
                            name="Entregas en fecha"
                            stroke="#8c96a6"
                            strokeDasharray="5 4"
                            connectNulls={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="note">
                      La evolución aparece al registrar trabajo en al menos dos
                      períodos. No se inventan datos históricos.
                    </div>
                  )}
                </Panel>
                <Panel
                  title="Detalle que explica el indicador"
                  sub="Las operativas aportan peso × avance contra meta, con un máximo del 100%"
                >
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Tarea / responsable</th>
                          <th>Empresa</th>
                          <th>Tipo</th>
                          <th>Peso</th>
                          <th>Resultado</th>
                          <th>Puntos logrados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <button
                                className="text-button"
                                onClick={() => setDetail(t.id)}
                              >
                                {t.title}
                              </button>
                              <small>{nameOf(t.ownerId)}</small>
                            </td>
                            <td>{companyOf(t.companyId)}</td>
                            <td>{t.kind}</td>
                            <td>{t.weight}</td>
                            <td>
                              {t.kind === "operativa"
                                ? `${taskQuantity(t, state.activity)} / ${t.target} ${t.unit}`
                                : t.status}
                            </td>
                            <td>
                              {metrics([t], state.activity).earned.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
                <div className="metric-explainer">
                  <b>Cómo se calcula</b>
                  <p>
                    Cumplimiento = puntos logrados / puntos asignados. Un
                    entregable aporta su peso al completarse. Una operativa
                    aporta proporcionalmente hasta su meta. La puntualidad
                    considera sólo entregables completados y usa fecha
                    argentina. Facturas, pagos y trámites se muestran por
                    separado; no se suman como si fueran una misma unidad.
                  </p>
                  <p>
                    Los pesos expresan complejidad relativa; este indicador no
                    sustituye una evaluación del desempeño ni explica por sí
                    solo las demoras externas.
                  </p>
                </div>
              </>
            )}
            {page === "planning" && (
              <Planning
                state={state}
                month={month}
                commit={commit}
                notify={notify}
              />
            )}
            {page === "absences" && (
              <Absences state={state} commit={commit} notify={notify} />
            )}
            {page === "team" && active.role === "jefe" && (<>
              {laboratory && <LaboratoryInvitations state={state} />}
              {laboratory && !remoteSave && <HabitualTaskProposalInbox state={state} actor={active} month={month} commit={commit} notify={notify} />}
              {remoteSave&&<WorkspaceSetup state={state} commit={commit} presence={presence}/>}
              <Workforce state={state} commit={commit} notify={notify} remote={!!remoteSave}/>
            </>)}
            {page === "calendar" && <DeadlineAgenda state={state} month={month} company={company} owner={viewedOwner} sector={sector} openTask={setDetail} openNotes={()=>setPage('annotations')} actor={active} laboratory={laboratory && !remoteSave} commit={commit} notify={notify}/>}
            {page === "team" && (
              <>
                <div className="section-heading">
                  <h2>Estructura de responsabilidad</h2>
                  {active.role === "jefe" && (
                    <button
                      className="primary"
                      onClick={() => setModal("employee")}
                    >
                      <Plus size={15} />
                      {remoteSave ? 'Incorporar empleado' : 'Alta de demostración'}
                    </button>
                  )}
                </div>
                <div className="org-root">
                  <span className="avatar">{ini(nameOf("boss"))}</span>
                  <div>
                    <b>{nameOf("boss")}</b>
                    <small>Jefatura · visión general</small>
                  </div>
                </div>
                <div className="org-teams">
                  {state.teams
                    .filter(
                      (t) =>
                        state.profiles.some(
                          (p) => p.id === t.managerId && p.role === "encargado",
                        ) &&
                        (active.role === "jefe" || t.id === active.teamId),
                    )
                    .map((t) => (
                      <section className="panel" key={t.id}>
                        <div className="org-manager">
                          <span className="avatar">{ini(nameOf(t.managerId))}</span>
                          <div>
                            <b>{nameOf(t.managerId)}</b>
                            <small>Encargado · {teamName(t.id)}</small>
                          </div>
                        </div>
                        {people
                          .filter((p) => p.managerId === t.managerId)
                          .map((p) => (
                            <div className="org-person" key={p.id}>
                              <span className="avatar">{ini(p.name)}</span>
                              <div>
                                <b>{p.name}</b>
                                <small>
                                  {p.sector} · {p.branch}
                                </small>
                                <small>
                                  {state.onboarding[p.id]?.completedAt
                                    ? "Inducción completada"
                                    : "Inducción pendiente"}
                                </small>
                              </div>
                              <button
                                aria-label={`Ver tareas de ${p.name}`}
                                onClick={() => {
                                  setBoardOwner(p.id);
                                  setPage("tasks");
                                }}
                              >
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          ))}
                      </section>
                    ))}
                </div>
                <Panel
                  title="Relaciones del equipo"
                  sub={remoteSave ? 'Los permisos de cada persona se comprueban en el servidor.' : 'Ámbitos de la demostración; los permisos definitivos deben ejecutarse en la base'}
                >
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Persona</th>
                          <th>Rol</th>
                          <th>Responsable</th>
                          <th>Equipo</th>
                          <th>Sector</th>
                          <th>Empresas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {people.map((p) => (
                          <tr key={p.id}>
                            <td>{p.name}</td>
                            <td>{p.role}</td>
                            <td>{p.managerId ? nameOf(p.managerId) : "—"}</td>
                            <td>
                              {state.teams.find((t) => t.id === p.teamId)
                                ?.name || "Dirección"}
                            </td>
                            <td>{p.sector}</td>
                            <td>{p.companyIds.map(companyOf).join(", ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </>
            )}
            {page === "catalog" && active.role === "jefe" && (
              <Panel
                title="Catálogo estándar y pesos"
                sub="El jefe define el peso. Los cambios se aplican a nuevas asignaciones; no reescriben meses anteriores."
              >
                {active.role === "jefe" && (
                  <CatalogueCreator
                    state={state}
                    commit={commit}
                    notify={notify}
                    versioned={laboratory && !remoteSave}
                  />
                )}
                <div className="catalog-grid">
                  {state.templates.map((template) => <CatalogueVersionCard key={template.id} state={state} template={template} actor={active} commit={commit} notify={notify} versioned={laboratory && !remoteSave} />)}
                </div>
              </Panel>
            )}
            {page === "closing" && active.role === "jefe" && (
              <>
                <div className="notice-banner">
                  <LockKeyhole size={18} />
                  <span>
                    El cierre abarca todas las empresas de cada empleado. Guarda
                    tareas, registros y métricas del mes; después bloquea sus
                    cambios {remoteSave?'en el servidor.':'en esta demostración.'}
                  </span>
                </div>
                <PeriodReports state={state} month={month} />
                <Panel
                  title={`Cierre de ${monthLabel(month)}`}
                  sub="Cada persona tiene su propia consolidación"
                >
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Empleado</th>
                          <th>Entregables</th>
                          <th>Cumplimiento</th>
                          <th>Operativas en meta</th>
                          <th>Estado</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {people
                          .filter(
                            (p) =>
                              p.role !== "jefe" && (!owner || owner === p.id),
                          )
                            .map((p) => {
                            const ts = state.tasks.filter(
                              (t) => t.month === month && isResponsible(t, p.id),
                            );
                            const c = state.closures.find(
                              (c) => c.ownerId === p.id && c.month === month,
                            );
                            const x = c?.metrics || metricsForProfile(ts, state.activity, p.id);
                            return (
                              <tr key={p.id}>
                                <td>{p.name}</td>
                                <td>
                                  {x.done}/{x.assigned}
                                </td>
                                <td>{pct(x.weighted)}</td>
                                <td>
                                  {x.operationalTarget}/{x.operational}
                                </td>
                                <td>
                                  <span
                                    className={"status " + (c ? "success" : "")}
                                  >
                                    {c ? "Cerrado" : "Abierto"}
                                  </span>
                                </td>
                                <td>
                                  {c ? (
                                    <button
                                      onClick={() =>
                                        download(
                                          closureCsvRows(c, companyOf),
                                          `cierre-${p.name}-${month}.csv`,
                                        )
                                      }
                                    >
                                      <Download size={13} />
                                      Exportar cierre
                                    </button>
                                  ) : (remoteSave ? active.role==='jefe' : manager) ? (
                                    <button
                                      disabled={
                                        !ts.length || month > currentMonth()
                                      }
                                      onClick={() => {
                                        setOwner(p.id);
                                        setModal("close");
                                      }}
                                    >
                                      Revisar y cerrar
                                    </button>
                                  ) : (
                                    <span>Jefatura realiza el cierre</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </>
            )}
            </Suspense>
          </div>
          <footer>
            <b>GRUPO PARÍS</b>
            <span>Orden para trabajar. Información para decidir.</span>
            <span>{remoteSave ? 'Datos compartidos · guardado privado' : 'Datos de ejemplo · guardado local'} · {monthLabel(month)}</span>
          </footer>
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {tourOpen && (
        <div className="tour-coach" role="dialog" aria-label="Recorrido guiado">
          <small>
            RECORRIDO · {tourStep + 1}/{tours.length}
          </small>
          <h3>{tours[tourStep].title}</h3>
          <p>{tours[tourStep].text}{tourFallback ? " Este elemento no está visible con estos filtros o el tablero está vacío; podés seguir con el recorrido." : ""}</p>
          <div>
            <button
              disabled={tourStep === 0}
              onClick={() => {
                const previous = Math.max(0, tourStep - 1);
                if (commit({ ...state, tour: { ...state.tour, [active.id]: previous }, tourVersion: { ...state.tourVersion, [active.id]: TOUR_VERSION } })) setPage(tours[previous].page);
              }}
            >Anterior</button>
            <button onClick={() => setTourOpen(false)}>Pausar</button>
            <button
              className="primary"
              onClick={() => {
                if (tourStep === tours.length - 1) {
                  if (
                    commit({
                      ...state,
                      tour: { ...state.tour, [active.id]: tours.length },
                      tourVersion: {
                        ...state.tourVersion,
                        [active.id]: TOUR_VERSION,
                      },
                    })
                  )
                    setTourOpen(false);
                } else if (
                  commit({
                    ...state,
                    tour: { ...state.tour, [active.id]: tourStep + 1 },
                    tourVersion: {
                      ...state.tourVersion,
                      [active.id]: TOUR_VERSION,
                    },
                  })
                ) {
                  setPage(tours[tourStep + 1].page);
                }
              }}
            >
              {tourStep === tours.length - 1 ? "Listo" : "Siguiente"}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
      {modal === "new" && (
        <NewTask
          state={state}
          active={active}
          month={month}
          company={company}
          owner={noteToTask || requestToTask ? active.id : ownBoardPages.includes(page) ? viewedOwner : owner || active.id}
          people={people}
          seedAnnotation={noteToTask}
          seedRequest={requestToTask}
          close={() => {
            setModal(null);
            setNoteToTask(null);
            setRequestToTask(null);
          }}
          create={(a) => {
            try {
              a = standardizeAssignment(state, a);
            } catch (e) {
              notify((e as Error).message);
              return;
            }
            const convertingNote = noteToTask !== null;
            const convertingRequest = requestToTask !== null;
            const converting = convertingNote || convertingRequest;
            const effectiveSchedule =
              a.schedule || defaultSchedule(a.startMonth + "-01", a.frequency);
            const sourceNote = convertingNote
              ? state.annotations?.find((entry) => entry.id === noteToTask.id)
              : undefined;
            const sourceRequest = convertingRequest
              ? state.internalRequests?.find((entry) => entry.id === requestToTask.id)
              : undefined;
            if (
              convertingNote &&
              (!sourceNote ||
                sourceNote.ownerId !== active.id ||
                sourceNote.convertedTaskId)
            ) {
              notify(
                "La anotación ya no está disponible o ya tiene una tarea vinculada.",
              );
              return;
            }
            if (
              convertingNote &&
              (a.frequency !== "única" ||
                effectiveSchedule.frequency !== "única")
            ) {
              notify(
                "Una anotación se convierte en una tarea puntual; cambiá la frecuencia a una sola vez.",
              );
              return;
            }
            if (convertingRequest && (!sourceRequest || !canConvertInternalRequest(sourceRequest, active))) {
              notify("Este pedido ya no puede convertirse en tarea.");
              return;
            }
            if (convertingRequest && (a.frequency !== "única" || effectiveSchedule.frequency !== "única")) {
              notify("Un pedido se convierte en una tarea puntual; no se permiten repeticiones.");
              return;
            }
            const targetPeriod = converting
              ? effectiveSchedule.startDate.slice(0, 7)
              : month;
            const responsible = state.profiles.find((p) => p.id === a.ownerId);
            if (
              !responsible?.active ||
              !responsible.companyIds.includes(a.companyId) ||
              !canSee(active, a.ownerId, state.profiles)
            ) {
              notify("Empresa o responsable fuera del ámbito autorizado.");
              return;
            }
            if (
              state.closures.some(
                (c) => c.ownerId === a.ownerId && c.month === targetPeriod,
              )
            ) {
              notify(`El período ${targetPeriod} de esa persona está cerrado.`);
              return;
            }
            let next = materialize(
              {
                ...state,
                assignments: [...state.assignments, a],
              },
              targetPeriod,
            );
            const created = next.tasks.filter(
              (task) =>
                task.assignmentId === a.id && task.month === targetPeriod,
            );
            if (converting && created.length !== 1) {
              notify(
                "No se pudo crear una única tarjeta para el origen. No guardé cambios.",
              );
              return;
            }
            if (convertingRequest && sourceRequest && created.length === 1) {
              try {
                const task = created[0];
                const updatedRequest = completeInternalRequestConversion(
                  next, sourceRequest.id, active, a, task, new Date().toISOString(), id,
                );
                next = {
                  ...next,
                  tasks: next.tasks.map((entry) => entry.id === task.id
                    ? { ...entry, originRequestId: sourceRequest.id }
                    : entry),
                  internalRequests: (next.internalRequests || []).map((entry) =>
                    entry.id === sourceRequest.id ? updatedRequest : entry),
                };
              } catch (error) {
                notify(error instanceof Error ? error.message : "No se pudo vincular la tarea con el pedido.");
                return;
              }
            }
            if (converting && sourceNote && created.length === 1)
              next.annotations = (next.annotations || []).map((entry) =>
                entry.id === sourceNote.id
                  ? {
                      ...entry,
                      convertedTaskId: created[0].id,
                      reminderOn: null,
                      updatedAt: new Date().toISOString(),
                    }
                  : entry,
              );
            if (commit(next, convertingRequest ? "Convirtió pedido en tarea" : "Creó asignación", convertingRequest && sourceRequest ? sourceRequest.id : a.id)) {
              setModal(null);
              setNoteToTask(null);
              setRequestToTask(null);
              setMonth(targetPeriod);
              notify(convertingRequest ? "Pedido convertido y vinculado a una tarea puntual." : "Tarea creada con empresa y período propios.");
            }
          }}
        />
      )}
      {tasksForDetail && (
        <Dialog title={tasksForDetail.title} onClose={() => setDetail(null)}>
          <div className="detail-meta">
            <span className="badge">{companyOf(tasksForDetail.companyId)}</span>
            <span>{nameOf(tasksForDetail.ownerId)}</span>
            <span>{monthLabel(tasksForDetail.month)}</span>
          </div>
          <div className="detail-stats">
            <span>
              <b>{tasksForDetail.weight} pts</b>Peso asignado
            </span>
            <span>
              <b>{fmt(tasksForDetail.due)}</b>Vencimiento
            </span>
            <span>
              <b>
                {tasksForDetail.kind === "operativa"
                  ? "Operativa"
                  : tasksForDetail.status}
              </b>
              Estado
            </span>
          </div>
          {tasksForDetail.originRequestId && (() => {
            const source = state.internalRequests?.find((entry) => entry.id === tasksForDetail.originRequestId);
            return source ? <div className="request-origin-context"><b>Pedido de origen · {source.subject}</b><p>{source.description}</p></div> : null;
          })()}
          <TimelinessBadge value={taskTimeliness(tasksForDetail, state.activity, new Date().toISOString())} />
          {laboratory && <JointTaskSetup state={state} task={tasksForDetail} actor={active} commit={commit} notify={notify} />}
          <div className="timer-panel">
            <div>
              <small>TIEMPO PROPIO · {active.name.toUpperCase()}</small>
              <strong>
                {duration(
                  actorElapsedSeconds(tasksForDetail, active.id, new Date(tick).toISOString()),
                )}
              </strong>
              <p>
                {tasksForDetail.sessions?.some((e) => !e.end && e.actorId === active.id)
                  ? "Tu reloj está en marcha y se conserva si recargás."
                  : "Tu reloj está pausado. Los aportes de otras personas se mantienen separados."}
              </p>
            </div>
            <button
              disabled={
                isClosed(state, tasksForDetail) ||
                !!tasksForDetail.blockedBy ||
                tasksForDetail.status === "Completada"
              }
              onClick={() =>
                clock(
                  tasksForDetail,
                  !tasksForDetail.sessions?.some((e) => !e.end && e.actorId === active.id),
                )
              }
            >
              {tasksForDetail.sessions?.some((e) => !e.end && e.actorId === active.id)
                ? "Pausar cronómetro"
                : "Iniciar cronómetro"}
            </button>
          </div>
          {(tasksForDetail.sessions || []).length > 0 && (
            <details>
              <summary>Sesiones y responsables</summary>
              {tasksForDetail.sessions!.filter((e) => active.role !== "empleado" || e.actorId === active.id).map((e) => (
                <p key={e.id}>
                  {nameOf(e.actorId)} ·{" "}
                  {new Date(e.start).toLocaleString("es-AR")} ·{" "}
                  {e.end
                    ? duration((Date.parse(e.end) - Date.parse(e.start)) / 1000)
                    : "En marcha"}
                </p>
              ))}
            </details>
          )}
          {tasksForDetail.kind === "resultado" ? (
            <>
              <h3>Checklist</h3>
              <p>
                El primer paso inicia la tarea. El último la completa y mueve la
                tarjeta automáticamente, si no está en espera.
              </p>
              {tasksForDetail.checklist.map((c) => (
                <label
                  key={c.id}
                  className={"check-line " + (c.done ? "checked" : "")}
                >
                  <input
                    type="checkbox"
                    checked={c.done}
                    disabled={isClosed(state, tasksForDetail)}
                    onChange={(e) =>
                      mutateTask(
                        tasksForDetail,
                        (t) => checkTask(t, c.id, e.target.checked),
                        "Actualizó checklist",
                      )
                    }
                  />
                  {c.text}
                </label>
              ))}
              {!tasksForDetail.checklist.length && (
                <p>Esta tarea no tiene pasos definidos.</p>
              )}
              <label>
                Espera por otra área
                <select
                  value={tasksForDetail.blockedBy}
                  disabled={
                    isClosed(state, tasksForDetail) ||
                    tasksForDetail.status === "Completada"
                  }
                  onChange={(e) =>
                    mutateTask(
                      tasksForDetail,
                      (t) => ({
                        ...t,
                        blockedBy: e.target.value,
                        blockedSince: e.target.value ? dateART() : null,
                      }),
                      "Actualizó espera externa",
                    )
                  }
                >
                  <option value="">Sin espera externa</option>
                  {[
                    "Ventas",
                    "Administración",
                    "Recursos Humanos",
                    "Sistemas",
                    "Fábrica",
                    "Por definir",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <div className="modal-actions">
                <button
                  className="primary"
                  disabled={isClosed(state, tasksForDetail)}
                  onClick={() => advance(tasksForDetail)}
                >
                  {tasksForDetail.status === "Pendiente"
                    ? "Iniciar tarea"
                    : tasksForDetail.status === "En curso"
                      ? "Completar tarea"
                      : "Reabrir tarea"}
                  <ArrowRight size={15} />
                </button>
              </div>
            </>
          ) : (
            <>
              <h3>
                {taskQuantity(tasksForDetail, state.activity)} /{" "}
                {tasksForDetail.target} {tasksForDetail.unit}
              </h3>
              <Meter
                value={
                  (taskQuantity(tasksForDetail, state.activity) /
                    tasksForDetail.target) *
                  100
                }
              />
              <div className="activity-history">
                {state.activity
                  .filter((a) => a.taskId === tasksForDetail.id && (active.role !== "empleado" || !tasksForDetail.responsibility || a.actorId === active.id))
                  .map((a) => (
                    <div key={a.id}>
                      <b>
                        {a.qty} {tasksForDetail.unit}
                      </b>
                      <span>
                        {fmt(a.date)} · {a.note}
                      </span>
                    </div>
                  ))}
              </div>
              <button
                className="primary"
                disabled={isClosed(state, tasksForDetail)}
                onClick={() => setLogFor(tasksForDetail.id)}
              >
                Registrar actividad
              </button>
            </>
          )}
          {laboratory && <TaskComments key={tasksForDetail.id} state={state} taskId={tasksForDetail.id} commit={commit} notify={notify} />}
          {active.role === "jefe" && !isClosed(state, tasksForDetail) && (
            <details>
              <summary>Configuración del jefe · este período</summary>
              <label>
                Peso
                <select
                  value={tasksForDetail.weight}
                  onChange={(e) =>
                    mutateTask(
                      tasksForDetail,
                      (t) => ({ ...t, weight: Number(e.target.value) }),
                      "Ajustó peso del período",
                    )
                  }
                >
                  {[1, 2, 3, 5, 8].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <p>
                Se registra en el historial {remoteSave?'del servidor':'local'}. No cambia cierres anteriores
                ni próximas recurrencias.
              </p>
            </details>
          )}
        </Dialog>
      )}
      {logTask && (
        <Dialog title="Registrar actividad" onClose={() => setLogFor(null)}>
          <p>
            <b>{logTask.title}</b> · {companyOf(logTask.companyId)} ·{" "}
            {nameOf(logTask.ownerId)}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const qty = Number(f.get("qty"));
              const date = String(f.get("date"));
              if (!Number.isInteger(qty) || qty <= 0 || qty > 1000000) {
                notify("Ingresá una cantidad entera entre 1 y 1.000.000.");
                return;
              }
              if (!date.startsWith(logTask.month) || date > dateART()) {
                notify("La fecha debe pertenecer al período y no ser futura.");
                return;
              }
              if (isClosed(state, logTask)) {
                notify("Este mes está cerrado.");
                return;
              }
              if (
                commit(
                  {
                    ...state,
                    activity: [
                      ...state.activity,
                      {
                        id: id(),
                        taskId: logTask.id,
                        qty,
                        date,
                        note: String(f.get("note")).trim(),
                        actorId: active.id,
                        createdAt: new Date().toISOString(),
                      },
                    ],
                  },
                  "Registró actividad",
                  logTask.id,
                )
              ) {
                setLogFor(null);
                notify(
                  "Actividad registrada. Los indicadores se actualizaron.",
                );
              }
            }}
          >
            <div className="form-grid">
              <label>
                Cantidad de {logTask.unit}
                <input
                  name="qty"
                  type="number"
                  min="1"
                  max="1000000"
                  required
                  autoFocus
                />
              </label>
              <label>
                Fecha
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={
                    logTask.month === currentMonth()
                      ? dateART()
                      : logTask.month + "-01"
                  }
                  min={logTask.month + "-01"}
                  max={dateART()}
                />
              </label>
            </div>
            <label>
              Referencia / lote / trabajo realizado
              <textarea
                name="note"
                required
                maxLength={500}
                placeholder="Ej. Lote de facturas de proveedores del 30/09"
              />
            </label>
            <div className="modal-actions">
              <button className="primary">Guardar registro</button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "employee" && (
        <Dialog
          title="Preparar un nuevo empleado"
          onClose={() => setModal(null)}
        >
          <p>
            {remoteSave ? 'El correo identifica a la persona que inicia sesión con ChatGPT. Configurar un perfil no amplía el acceso al sitio. Por ahora sólo el propietario puede entrar.' : 'Alta de demostración: prepara su perfil y la inducción. No crea una cuenta real ni envía una invitación.'}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const tid = String(f.get("team"));
              const t = state.teams.find((t) => t.id === tid)!;
              const pid = id();
              const p: Profile = {
                id: pid,
                name: String(f.get("name")).trim(),
                ...(remoteSave ? {email:String(f.get("email")||'').trim().toLowerCase()} : {}),
                role: "empleado",
                managerId: t.managerId,
                teamId: tid,
                sector: String(f.get("sector")),
                branch: String(f.get("branch")),
                position: String(f.get("position")).trim(),
                companyIds: state.companies.map((c) => c.id),
                active: true,
              };
              if (!p.name || !p.position) return;
              if (
                commit(
                  {
                    ...state,
                    profiles: [...state.profiles, p],
                    onboarding: {
                      ...state.onboarding,
                      [pid]: blankOnboarding(p.name),
                    },
                    activeId: remoteSave ? active.id : pid,
                  },
                  remoteSave ? "Incorporó empleado" : "Alta de demostración",
                  pid,
                )
              ) {
                setModal(null);
                setInduct(!remoteSave);
                setPaused(false);
                setOwner("");
              }
            }}
          >
            <label>
              Nombre
              <input name="name" required maxLength={80} />
            </label>
            {remoteSave && <label>Correo para iniciar sesión<input name="email" type="email" required maxLength={180}/></label>}
            <div className="form-grid">
              <label>
                Equipo / responsable
                <select name="team">
                  {state.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {teamName(t.id)} · {nameOf(t.managerId)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sector
                <select name="sector">
                  {["Tesorería", "Impuestos", "Contabilidad general"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Puesto
                <input name="position" required />
              </label>
              <label>
                Sucursal
                <select name="branch">
                  {[
                    "San Luis Capital",
                    "Villa Mercedes",
                    "Merlo",
                    "San Juan",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button className="primary">
                {remoteSave ? 'Crear perfil' : 'Crear y probar inducción'} <GraduationCap size={16} />
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "close" && active.role === "jefe" &&
        !!state.profiles.find((p) => p.id === owner && p.active) &&
        canSee(active, owner, state.profiles) && (
        <Dialog
          title={`Cerrar ${monthLabel(month)}`}
          onClose={() => setModal(null)}
        >
          <p>
            <b>{nameOf(owner)}</b> · todas sus empresas.
          </p>
          <div className="note">
            Se conservará una foto de las tareas, cantidades y métricas. Las
            tareas pendientes siguen visibles en esa foto; el cierre no las
            marca como realizadas.
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const note = String(
                  new FormData(e.currentTarget).get("note"),
                ).trim();
                if (
                  commit(
                    closeMonth(state, owner, month, active.id, note),
                    "Cerró mes",
                    owner,
                  )
                ) {
                  setModal(null);
                  setOwner("");
                  notify(
                    remoteSave ? "Mes consolidado y reporte guardado para jefatura." : "Mes consolidado y reporte emitido para Juan Pablo en esta demostración.",
                  );
                }
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            <label>
              Observaciones de cierre
              <textarea
                name="note"
                required
                maxLength={1000}
                placeholder="Explicá pendientes, esperas o desvíos relevantes."
              />
            </label>
            <label className="check-line">
              <input type="checkbox" required />
              Revisé todas las empresas y los registros de este empleado.
            </label>
            <div className="modal-actions">
              <button onClick={() => setModal(null)} type="button">
                Cancelar
              </button>
              <button className="primary">Confirmar cierre</button>
            </div>
          </form>
        </Dialog>
      )}
      {quickTaskSearchOpen && laboratory && !remoteSave && (
        <QuickTaskSearch
          state={state}
          active={active}
          currentMonth={month}
          onClose={() => setQuickTaskSearchOpen(false)}
          onSelect={openSearchResult}
        />
      )}
    </>
  );
}
function NewTask({
  state,
  active,
  month,
  company,
  owner,
  people,
  seedAnnotation,
  seedRequest,
  close,
  create,
}: {
  state: State;
  active: Profile;
  month: string;
  company: string;
  owner: string;
  people: Profile[];
  seedAnnotation: Annotation | null;
  seedRequest: InternalRequest | null;
  close: () => void;
  create: (a: Assignment) => void;
}) {
  const [template, setTemplate] = useState("");
  const [steps, setSteps] = useState<string[]>(() => seedAnnotation ? parseSteps(seedAnnotation.content) : []);
  const [schedule, setSchedule] = useState<Schedule>(() =>
    defaultSchedule(seedAnnotation?.reminderOn || month + "-25"),
  );
  const [scheduleError, setScheduleError] = useState("");
  const [taskError, setTaskError] = useState("");
  const [kind, setKind] = useState<"resultado" | "operativa">("resultado");
  const t = state.templates.find((t) => t.id === template);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title")).trim();
    if (!title) return;
    try {
      validateSchedule(schedule);
    } catch (e) {
      setScheduleError((e as Error).message);
      return;
    }
    if (!t && schedule.frequency !== "única") {
      setScheduleError("Las tareas habituales requieren un proceso del catálogo.");
      return;
    }
    const selectedKind = t?.kind || kind;
    let checklist: string[] = [];
    let target = 0;
    try {
      if (selectedKind === "resultado")
        checklist = validateSteps(t?.steps || parseSteps(String(f.get("steps") || "")));
      if (selectedKind === "operativa") {
        target = Number(f.get("target") || t?.target || 0);
        if (!Number.isSafeInteger(target) || target < 1 || target > 1000000)
          throw Error("La meta debe ser un número entero entre 1 y 1.000.000.");
      }
    } catch (e) {
      setTaskError((e as Error).message);
      return;
    }
    setScheduleError("");
    setTaskError("");
    create({
      schedule,
      id: id(),
      templateId: template || null,
      title,
      ownerId: String(f.get("owner")),
      companyId: String(f.get("company")),
      sector: t?.sector || String(f.get("sector") || active.sector),
      kind: selectedKind,
      weight: t?.weight || (active.role === "jefe" ? Number(f.get("weight") || 0) : 1),
      unit: selectedKind === "operativa" ? (t?.unit || String(f.get("unit") || "").trim()) : "",
      target: selectedKind === "operativa" ? target : 0,
      day: schedule.monthDay,
      frequency: schedule.frequency,
      steps:
        selectedKind === "resultado" ? checklist : [],
      startMonth: seedAnnotation || seedRequest ? schedule.startDate.slice(0, 7) : month,
      priority: String(f.get("priority")) as Assignment["priority"],
    });
  }
  return (
    <Dialog title="Nueva tarea, con todo su contexto" onClose={close} wide>
      <label>
        Elegí del catálogo
        <select
          value={template}
          disabled={!!seedRequest}
          onChange={(e) => {
            setTemplate(e.target.value);
            const selected = state.templates.find((t) => t.id === e.target.value);
            setKind(selected?.kind || "resultado");
            setSteps(selected?.steps || (seedAnnotation ? parseSteps(seedAnnotation.content) : []));
            setTaskError("");
          }}
        >
          <option value="">Trabajo esporádico · una sola vez</option>
          {state.templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      {seedRequest && <div className="request-origin-context"><b>Conversión explícita del pedido · {seedRequest.subject}</b><p>{seedRequest.description}</p><span>La conversión crea una sola tarea y cierra el pedido al confirmar. No hay asignaciones hasta guardar.</span></div>}
      <form key={template} onSubmit={submit}>
        <label>
          Título
          <input
            name="title"
            required
            maxLength={120}
            defaultValue={t?.title || seedAnnotation?.title || seedRequest?.subject}
            readOnly={!!t}
          />
        </label>
        <div className="form-grid">
          <label>
            Empresa obligatoria
            <select
              name="company"
              defaultValue={company || active.companyIds[0] || ""}
              required
            >
              <option value="" disabled>
                Seleccioná una empresa
              </option>
              {state.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Responsable
            <select name="owner" defaultValue={owner}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sector
            <select
              name="sector"
              disabled={!!t}
              defaultValue={t?.sector || active.sector}
            >
              {[
                "Tesorería",
                "Impuestos",
                "Contabilidad general",
                "Dirección contable",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Tipo de trabajo
            <select
              value={kind}
              disabled={!!t}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="resultado">Entregable · se completa</option>
              <option value="operativa">
                Operativa · se registra cantidad
              </option>
            </select>
          </label>
          <label>
            Peso · definido por jefe
            <select
              name="weight"
              defaultValue={t?.weight || (seedRequest ? "" : 1)}
              disabled={!!t || active.role !== "jefe"}
              required={!!seedRequest && !t}
            >
              {seedRequest && !t && <option value="">Definí el peso</option>}
              {[1, 2, 3, 5, 8].map((n) => (
                <option key={n} value={n}>
                  {n} puntos
                </option>
              ))}
            </select>
          </label>
          <label>
            Prioridad
            <select name="priority">
              <option>Media</option>
              <option>Alta</option>
              <option>Baja</option>
            </select>
          </label>
          {kind === "operativa" && (
            <>
              <label>
                Unidad
                <input
                  name="unit"
                  required
                  defaultValue={t?.unit}
                  readOnly={!!t}
                  placeholder="facturas, pagos, trámites…"
                  maxLength={30}
                />
              </label>
              <label>
                Meta por ocurrencia
                <input
                  name="target"
                  type="number"
                  min="1"
                  max="1000000"
                  required
                  defaultValue={t?.target || 50}
                />
              </label>
            </>
          )}
        </div>
        <ScheduleEditor
          value={schedule}
          onChange={(next) => { setSchedule(next); setScheduleError(""); }}
          month={month}
          onlyOnce={!!seedAnnotation || !!seedRequest || !t}
        />
        {scheduleError && <p role="alert">{scheduleError}</p>}
        {kind === "resultado" && (
          <div className="checklist-field">
            <p className="checklist-field-title">Checklist · un paso por línea</p>
            <StepListEditor
              name="steps"
              value={t?.steps || steps}
              error={taskError}
              emptyMessage="Se creará sin checklist. Podés agregar controles si este trabajo los requiere."
              onChange={(next) => { setSteps(next); setTaskError(""); }}
              readOnly={!!t}
            />
          </div>
        )}
        {taskError && kind !== "resultado" && <p className="step-list-error" role="alert">{taskError}</p>}
        <div className="note">
          {seedRequest ? "Se creará una sola tarea para el período de la fecha elegida, con el peso definido por jefatura." : `Se crea una instancia para ${monthLabel(month)}. Dos empresas conservan estados e indicadores independientes.`}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={close}>
            Cancelar
          </button>
          <button className="primary">
            Crear tarea <Plus size={15} />
          </button>
        </div>
      </form>
    </Dialog>
  );
}
