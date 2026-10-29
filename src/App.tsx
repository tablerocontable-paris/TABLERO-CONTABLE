import NotificationCenter from "./components/NotificationCenter";
import LaboratoryBackup from "./components/LaboratoryBackup";
import TaskComments from "./components/TaskComments";
import EmployeePicker from "./components/EmployeePicker";
import { lazy, Suspense, useState, useEffect, useMemo, useRef, type FormEvent } from "react";
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
  presenceStatus,
  canViewPresence,
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
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
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
  taskReadiness,
  closeMonth,
  csvCell,
} from "./domain/model";
import { classifyCommitStorageFailure, isLaboratoryStateCurrent, load, persist, blankOnboarding, KEY, StaleLaboratoryStateError, type CommitOutcome } from "./data/repository";
import { Dialog, Panel, Empty, Meter } from "./components/ui";
import ParisTaskParameterFields from "./components/ParisTaskParameterFields";
import OperationalTaskCard from "./components/OperationalTaskCard";
import OperationalRatePanel from "./components/OperationalRatePanel";
import OperationalQualityReview from "./components/OperationalQualityReview";
import CompanyClosureManager from "./components/CompanyClosureManager";
import SuggestedRoutePanel from "./components/SuggestedRoutePanel";
import TimelinessBadge from "./components/TimelinessBadge";
import TimelinessPanel from "./components/TimelinessPanel";
import StepListEditor, { parseSteps, validateSteps } from "./components/StepListEditor";
import { taskTimeliness } from "./domain/timeliness";
import { closureCsvRows } from "./domain/reports";
import { closedPeriodHistory } from "./domain/closedHistory";
import type { TaskEvidence } from "./domain/laboratory-work";
import {
  activitySnapshotsForLog,
  canExecuteLab,
  canAssignLabTask,
  calendarCanAccessTask,
  isLabCompanyClosed,
  isLabTaskLocked,
  operationalLoad,
  suggestedRoute,
  updateTaskWeight,
} from "./domain/laboratory-work";
import { applyCompletionAttribution, linkEvidenceToCompletions } from "./domain/workCycle";
import { currentCatalogueVersion } from "./domain/processImprovement";
import { materializeNeutralStarterAssignment } from "./domain/neutralStarterCatalog";
import { submitHabitualTaskProposal } from "./domain/habitualTaskProposals";
import { summarizeParisTaskWork } from "./domain/parisTaskAnalytics";
import { buildGemeloContext } from "./domain/gemelo";
import {
  PARIS_BUSINESS_UNITS,
  PARIS_TASK_CATALOG_VERSION,
  hasRequiredParisTaskParameters,
  formatParisTaskParameterValue,
  selectableParisTasks,
  type ParisBusinessUnitCode,
} from "./domain/parisTaskCatalog";
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
const TaskReadinessPanel = lazy(() => import("./components/TaskReadinessPanel"));
const TaskSchedulePanel = lazy(() => import("./components/TaskSchedulePanel"));
const CommercialProgressPanel = lazy(() => import("./components/CommercialProgressPanel"));
const TaskEvidencePanel = lazy(() => import("./components/TaskEvidencePanel"));
const EvidenceLinks = lazy(() => import("./components/TaskEvidencePanel").then((module) => ({ default: module.EvidenceLinks })));
const Gemelo = lazy(() => import("./components/Gemelo"));

function retainProposalDraftMap<T>(source: Record<string, T> | undefined, proposals: Array<{ id: string }> | undefined): Record<string, T> {
  const proposalIds = new Set((proposals || []).map((proposal) => proposal.id));
  return Object.fromEntries(Object.entries(source || {}).filter(([key]) => proposalIds.has(key))) as Record<string, T>;
}

type Page =
  | "overview"
  | "gemelo"
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
  { id: "gemelo", name: "Gemelo", icon: Sparkles },
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
const TOUR_VERSION = 6;
export default function App({initialState, remoteSave, remoteOwner=false, presence={}, onView, laboratoryMode=false, persistenceUnavailable=false}: {laboratoryMode?:boolean;persistenceUnavailable?:boolean;initialState?:State;remoteSave?:(state:State,action?:string,entityId?:string)=>Promise<State>;remoteOwner?:boolean;presence?:Record<string,string>;onView?:(view:string)=>void} = {}) {
  const [laboratory] = useState(() => laboratoryMode || (remoteSave ? false : isLab()));
  const [state, setState] = useState<State>(() => initialState || load(laboratory));
  const latestStateRef = useRef(state);
  latestStateRef.current = state;
  useEffect(()=>{if(initialState){latestStateRef.current=initialState;setState(initialState)}},[initialState]);
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
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogKind, setCatalogKind] = useState<"all" | "resultado" | "operativa">("all");
  const [catalogSector, setCatalogSector] = useState("");
  const [quickTaskSearchOpen, setQuickTaskSearchOpen] = useState(false);
  const [taskOrder, setTaskOrder] = useState<TaskOrder>(() => state.boardOrder || "az");
  const [view, setView] = useState<"board" | "list">("board");
  const [group, setGroup] = useState<"individual" | "team" | "sector">(
    "individual",
  );
  const [historySeries, setHistorySeries] = useState<Array<"weighted" | "onTime" | "operationalLoad" | "recordedSeconds">>([
    "weighted",
    "onTime",
  ]);
  const [distributionBy, setDistributionBy] = useState<"status" | "kind" | "company" | "team">("status");
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [modal, setModal] = useState<"new" | "employee" | "close" | null>(null);
  const [noteToTask, setNoteToTask] = useState<Annotation | null>(null);
  const [requestToTask, setRequestToTask] = useState<InternalRequest | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [collapsedCards,setCollapsedCards]=useState<Record<string,boolean>>({});
  const [logFor, setLogFor] = useState<string | null>(null);
  const [activitySaving, setActivitySaving] = useState(false);
  const activitySubmitLock = useRef(false);
  const [induct, setInduct] = useState(false);
  const [paused, setPaused] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourResetNotice, setTourResetNotice] = useState(false);
  const tourOpenerRef = useRef<HTMLElement | null>(null);
  const tourActorRef = useRef("");
  const tourWasOpenRef = useRef(false);
  const tourPrimaryRef = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const active = state.profiles.find((p) => p.id === state.activeId)!;
  const labOnly = laboratory && !remoteSave;
  const catalogNeedle = catalogSearch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
  const catalogEntries = state.templates.filter((template) => {
    const haystack = `${template.title} ${template.description} ${template.sector} ${template.unit}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
    return (!catalogNeedle || haystack.includes(catalogNeedle)) &&
      (catalogKind === "all" || template.kind === catalogKind) &&
      (!catalogSector || template.sector === catalogSector);
  });
  const taskLocked = (task: Task) => labOnly ? isLabTaskLocked(state, task) : isClosed(state, task);
  const canExecute = (task: Task) => !labOnly || canExecuteLab(state, active, task);
  const manager = active.role !== "empleado";
  const people = useMemo(
    () => state.profiles.filter((p) => p.active && canSee(active, p.id, state.profiles)),
    [state.profiles, active],
  );
  const nameOf = (pid: string) =>
    state.profiles.find((p) => p.id === pid)?.name || "Sin responsable";
  const companyOf = (cid: string) =>
    state.companies.find((c) => c.id === cid)?.name || "Sin empresa";
  const teamName = (teamId: string) => {
    const selectedTeam = state.teams.find((t) => t.id === teamId);
    return selectedTeam ? `Equipo de ${nameOf(selectedTeam.managerId)}` : "Sin equipo";
  };
  const personPresence = (profileId: string) => canViewPresence(state, active, profileId)
    ? presenceStatus(profileId, active.id, labOnly, presence[profileId], tick)
    : null;
  function notify(s: string) {
    setNotice(s);
  }
  useEffect(() => {
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
  function commitAgainstResult(current: State, next: State, action?: string, entityId = ""): CommitOutcome {
    if (laboratory && persistenceUnavailable) {
      notify("El almacenamiento local no está disponible. Podés consultar o exportar este estado; las modificaciones quedan deshabilitadas hasta recuperar el almacenamiento.");
      return { status: "rejected", reason: "storage" };
    }
    if (laboratory && !isLaboratoryStateCurrent(current)) {
      notify("El laboratorio cambió en otra pestaña. Recargá la página antes de guardar para evitar sobrescribir la versión restaurada.");
      return { status: "rejected", reason: "validation" };
    }
    if(remoteSave){
      latestStateRef.current=next;
      setState(next);
      void remoteSave(next,action,entityId).then((saved)=>{latestStateRef.current=saved;setState(saved)}).catch((e:Error)=>notify(e.message));
      return { status: "committed" };
    }
    let s: State;
    try {
      if (laboratory) {
        const previousTasks = current.tasks;
        const attributedTasks = applyCompletionAttribution(previousTasks, next.tasks, current.activeId);
        next = {
          ...next,
          tasks: attributedTasks,
          taskEvidence: linkEvidenceToCompletions(previousTasks, attributedTasks, next.taskEvidence || []),
        };
        next = collectTaskNotifications(current, next, current.activeId);
      }
      s = action
        ? {
            ...next,
            audit: [
              ...next.audit,
              {
                id: id(),
                at: new Date().toISOString(),
                actorId: current.activeId,
                action,
                entityId,
              },
            ],
          }
        : next;
      if (laboratory) s.labRevision = id();
    } catch {
      notify("No se pudo preparar el cambio. El estado y los archivos siguen sin vincularse; podés volver a intentar.");
      return { status: "rejected", reason: "preparation" };
    }
    const storageKey = laboratory ? "paris-state-lab" : KEY;
    let previousRaw: string | null = null;
    let previousRead = false;
    try { previousRaw = localStorage.getItem(storageKey); previousRead = true; }
    catch { /* A successful write can still be confirmed from the stored candidate. */ }
    let expected: string;
    try { expected = JSON.stringify(s); }
    catch {
      notify(
        "No se pudo guardar. Liberá espacio del navegador y volvé a intentar.",
      );
      return { status: "rejected", reason: "storage" };
    }
    try { persist(s, laboratory, current.labRevision); }
    catch (error) {
      if (laboratory && error instanceof StaleLaboratoryStateError) {
        notify("El laboratorio cambió en otra pestaña. Recargá la página antes de guardar para evitar sobrescribir la versión actual.");
        return { status: "rejected", reason: "validation" };
      }
      let actual: string | null | undefined;
      let actualRead = false;
      try { actual = localStorage.getItem(storageKey); actualRead = true; }
      catch { /* Keep attached files if storage cannot establish the outcome. */ }
      const outcome = classifyCommitStorageFailure({ expected, previousRaw, previousRead, actualRaw: actual, actualRead });
      if (outcome.status === "committed") {
          latestStateRef.current = s;
          setState(s);
          return outcome;
      }
      if (outcome.status === "rejected") {
        notify("No se pudo guardar. Liberá espacio del navegador y volvé a intentar.");
        return { ...outcome, reason: "storage" };
      }
      notify("No se pudo confirmar el resultado del guardado. Revisá el trabajo antes de volver a intentar.");
      return outcome;
    }
    latestStateRef.current = s;
    setState(s);
    return { status: "committed" };
  }
  function commitAgainst(current: State, next: State, action?: string, entityId = "") {
    return commitAgainstResult(current, next, action, entityId).status === "committed";
  }
  function commit(next: State, action?: string, entityId = "") {
    return commitAgainst(latestStateRef.current, next, action, entityId);
  }
  function commitLatest(update: (current: State) => State | null, action?: string, entityId = "") {
    const current = latestStateRef.current;
    const next = update(current);
    return next ? commitAgainst(current, next, action, entityId) : false;
  }
  function commitLatestWithResult(update: (current: State) => State | null, action?: string, entityId = ""): CommitOutcome {
    const current = latestStateRef.current;
    let next: State | null;
    try { next = update(current); }
    catch {
      notify("No se pudo validar el cambio. No se guardó y podés volver a intentar.");
      return { status: "rejected", reason: "preparation" };
    }
    return next ? commitAgainstResult(current, next, action, entityId) : { status: "rejected", reason: "validation" };
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
    if (!laboratory || remoteSave) return false;
    try {
      const available = internalRequestRecipients(state, active, input.kind).some((target) => target.id === input.recipientId);
      if (!available) throw new Error("El destino seleccionado ya no está disponible.");
      const request = createInternalRequest({ ...input, now: new Date().toISOString(), makeId: id });
      if (commit({ ...state, internalRequests: [...(state.internalRequests || []), request] }, "Creó una consulta o pedido", request.id)) {
        notify("Pedido registrado en el laboratorio.");
        return true;
      }
      return false;
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo registrar el pedido.");
      return false;
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
    if (!laboratory || remoteSave) return false;
    const request = state.internalRequests?.find((entry) => entry.id === requestId);
    if (!request) return false;
    try {
      const updated = replyToInternalRequest(request, active, body, new Date().toISOString(), id);
      if (commit({ ...state, internalRequests: state.internalRequests!.map((entry) => entry.id === requestId ? updated : entry) }, "Respondió una consulta interna", requestId)) return true;
      return false;
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo responder el pedido.");
      return false;
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
    if (!task || (labOnly ? !calendarCanAccessTask(state, active, task) : !canWork(state, active, task))) {
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
  const monthTasks = useMemo(
    () => state.tasks.filter(
      (t) => t.month === month && (labOnly ? calendarCanAccessTask(state, active, t) : canWork(state, active, t)),
    ),
    [state, month, labOnly, active],
  );
  const isOwnBoardPage = page === "day" || page === "tasks" || page === "operations" || page === "calendar";
  const viewedOwner = boardOwner || active.id;
  const personalOverview = page === "overview" && active.role === "empleado";
  const profileScopedPage = isOwnBoardPage || personalOverview;
  const ownerFilter = profileScopedPage ? viewedOwner : owner;
  const filtered = useMemo(() => monthTasks.filter(
    (t) =>
      (!company || t.companyId === company) &&
      (!ownerFilter ||
        isResponsible(t, ownerFilter) ||
        (isOwnBoardPage && viewedOwner === active.id &&
          coverageFor(state, t)?.replacementId === active.id)) &&
      (!sector || t.sector === sector) &&
      (!team || t.teamId === team) &&
      (!query ||
        `${t.title} ${nameOf(t.ownerId)} ${companyOf(t.companyId)}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  ), [monthTasks, company, ownerFilter, isOwnBoardPage, viewedOwner, active, sector, team, query, state]);
  const summaryOwnerFilter = active.role === "empleado" ? viewedOwner : owner;
  const summaryFiltered = useMemo(() => monthTasks.filter(
    (t) =>
      (!company || t.companyId === company) &&
      (!summaryOwnerFilter || isResponsible(t, summaryOwnerFilter)) &&
      (!sector || t.sector === sector) &&
      (!team || t.teamId === team) &&
      (!query || `${t.title} ${nameOf(t.ownerId)} ${companyOf(t.companyId)}`.toLowerCase().includes(query.toLowerCase())),
  ), [monthTasks, company, summaryOwnerFilter, sector, team, query, state]);
  const metricDay = dateART();
  const metricAsOf = useMemo(() => new Date().toISOString(), [state.tasks, state.activity, metricDay]);
  const gemeloContext = useMemo(
    () => buildGemeloContext(state, active, filtered, month, company, metricDay),
    [state, active, filtered, month, company, metricDay],
  );
  const metricTasks = useMemo(() => labOnly ? filtered.filter((task) => task.kind === "resultado") : filtered, [labOnly, filtered]);
  const summaryMetricTasks = useMemo(() => labOnly ? summaryFiltered.filter((task) => task.kind === "resultado") : summaryFiltered, [labOnly, summaryFiltered]);
  const m = useMemo(() => {
    if (page !== "overview" && page !== "analytics" && page !== "day") return metrics([], state.activity, metricDay, metricAsOf);
    return profileScopedPage
      ? metricsForProfile(metricTasks, state.activity, viewedOwner, metricDay, metricAsOf)
      : metrics(summaryMetricTasks, state.activity, metricDay, metricAsOf);
  }, [page, profileScopedPage, metricTasks, summaryMetricTasks, state.activity, viewedOwner, metricDay, metricAsOf]);
  const resultTasks = useMemo(() => filtered.filter((t) => t.kind === "resultado"), [filtered]);
  const operations = useMemo(() => filtered.filter((t) => t.kind === "operativa"), [filtered]);
  const operationalSummary = useMemo(() => labOnly ? operationalLoad(state, operations.map((task) => task.id), profileScopedPage ? viewedOwner : undefined, metricAsOf) : null, [labOnly, state, operations, profileScopedPage, viewedOwner, metricAsOf]);
  const operationalUnits = [...new Set(operations.map((task) => task.unit || "movimientos"))]
    .map((unit) => {
      const ids = operations.filter((task) => (task.unit || "movimientos") === unit).map((task) => task.id);
      const quantity = operationalLoad(state, ids, profileScopedPage ? viewedOwner : undefined, metricAsOf).quantity;
      return quantity ? `${quantity.toLocaleString("es-AR")} ${unit}` : null;
    })
    .filter((value): value is string => !!value)
    .join(" · ") || "Sin movimientos registrados";
  const operationAssessments = useMemo(() => (state.operationalAssessments || []).filter((assessment) => operations.some((task) => task.id === assessment.taskId)), [state.operationalAssessments, operations]);
  const operationQuality = (key: "quality" | "order" | "timeliness") => operationAssessments.length
    ? Math.round(operationAssessments.reduce((sum, assessment) => sum + assessment[key], 0) / operationAssessments.length)
    : null;
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
      if (taskLocked(t))
        throw Error("El mes está cerrado y conserva su historial.");
      if (!canExecute(t)) throw Error("Podés consultar esta tarea, pero sólo su responsable o cobertura autorizada puede ejecutarla.");
      let next = fn(t);
      if (next === t) return;
      const readiness = taskReadiness(state, t, undefined, active);
      const startsOrFinishes = next.status !== t.status && (next.status === "En curso" || next.status === "Completada");
      const changesChecklist = next.checklist !== t.checklist;
      if ((startsOrFinishes || changesChecklist) && !readiness.ready)
        throw Error(readiness.reason);
      if (
        next.status === "En curso" &&
        t.status !== "En curso" &&
        !next.blockedBy
      )
        next = startClock(next, active.id, new Date().toISOString(), state);
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
      if (taskLocked(t)) throw Error("La unidad empresa/persona ya está cerrada.");
      if (!canExecute(t)) throw Error("Sólo su responsable, participante o reemplazo autorizado puede usar el cronómetro.");
      if (running && !taskReadiness(state, t, undefined, active).ready) throw Error(taskReadiness(state, t, undefined, active).reason);
      commit(
        applyClock(state, t.id, active.id, running),
        running ? "Inició cronómetro" : "Pausó cronómetro",
        t.id,
      );
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function advance(t: Task, commercialConfirmed = false) {
    const completingCommercial = t.commercialTrackingEnabled && t.status === "En curso";
    if (completingCommercial && !commercialConfirmed) {
      if (t.commercialProgress?.throughDay !== 30 || t.checklist.some((check) => !check.done)) {
        notify("Para cerrar esta conciliación, registrá el día comercial 30 y completá todos los controles.");
        return;
      }
      if (!window.confirm("¿Confirmás que esta conciliación está completa hasta el día comercial 30 y que todos sus controles están verificados?")) return;
    }
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
  function moveBoardTask(taskId: string, nextStatus: Status, beforeTaskId?: string): boolean {
    const task = state.tasks.find(t => t.id === taskId);
    if (!laboratory || !task || task.kind !== "resultado") return false;
    if (task.blockedBy && nextStatus === "En curso") {
      notify("Liberá la espera externa antes de iniciar esta tarea.");
      return false;
    }
    try {
      if (!canWork(state, active, task)) throw Error("Esta tarea está fuera de tu ámbito.");
      if (taskLocked(task)) throw Error("El mes está cerrado y conserva su historial.");
      if (!canExecute(task)) throw Error("Sólo el responsable o cobertura autorizada puede mover la tarjeta.");
      if (task.commercialTrackingEnabled && nextStatus === "Completada" && task.status !== "Completada") {
        if (task.commercialProgress?.throughDay !== 30 || task.checklist.some((check) => !check.done)) {
          throw Error("Para cerrar esta conciliación, registrá el día comercial 30 y completá todos los controles.");
        }
        if (!window.confirm("¿Confirmás que esta conciliación está completa hasta el día comercial 30 y que todos sus controles están verificados?")) return false;
      }
      if ((nextStatus === "En curso" || nextStatus === "Completada") && nextStatus !== task.status) {
        const readiness = taskReadiness(state, task, undefined, active);
        if (!readiness.ready) throw Error(readiness.reason);
      }
      if (task.responsibility && nextStatus === "Pendiente" && task.sessions?.some((session) => !session.end && session.actorId !== active.id))
        throw Error("La tarea compartida tiene el reloj del compañero activo. No podés devolverla a Pendiente mientras sigue trabajando.");
      let moved = nextStatus === task.status ? task : transition(task, nextStatus);
      if (nextStatus === "En curso" && task.status !== "En curso") moved = startClock(moved, active.id, new Date().toISOString(), state);
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
      return commit({ ...state, boardOrder: "original", tasks: orderedTasks }, nextStatus === task.status ? undefined : "Movió tarea a " + nextStatus, taskId);
    } catch (error) {
      notify((error as Error).message);
      return false;
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
    const preparesPersonalTasks = active.role !== "jefe";
    const hasLegacyOnboardingSelections = draft.selectedTemplateIds.length > 0 || (draft.customTasks?.length || 0) > 0 || !!draft.customTitle.trim() || (draft.habitualTaskProposals || []).some((proposal) => !proposal.taskCode);
    const hasLegacyV1StarterSelection = draft.selectedTemplateIds.some((taskId) => taskId.startsWith("starter-v1-"));
    const parisOnboarding = laboratory && !remoteSave && active.role !== "jefe" && (!hasLegacyOnboardingSelections || (draft.selectedBusinessUnitCodes?.length || 0) > 0 || hasLegacyV1StarterSelection);
    const selectedTemplateIds = parisOnboarding ? [] : draft.selectedTemplateIds;
    try {
      if (parisOnboarding && !(draft.selectedBusinessUnitCodes?.length || 0))
        throw Error("Elegí al menos una unidad de negocio antes de confirmar tus tareas.");
      if (parisOnboarding) {
        const canonicalSelections = (draft.habitualTaskProposals || []).filter((proposal) => !!proposal.taskCode);
        if (!canonicalSelections.length)
          throw Error("Elegí al menos una tarea del catálogo Grupo París para preparar el tablero.");
        if (canonicalSelections.some((proposal) => !proposal.businessUnitCode ||
            !(draft.selectedBusinessUnitCodes || []).includes(proposal.businessUnitCode) ||
            !proposal.companyIds.some((companyId) => draft.selectedCompanyIds.includes(companyId))))
          throw Error("Cada tarea estándar necesita una unidad y al menos una empresa seleccionadas.");
      }
      if (laboratory && !remoteSave && active.role !== "jefe" && !parisOnboarding && (draft.selectedTemplateIds.length || (draft.customTasks?.length || 0) || draft.customTitle.trim()))
        throw Error("Este borrador conserva tareas anteriores sin clasificación Grupo París. No se activaron: quitá esas selecciones y elegí tareas del catálogo con su unidad de negocio.");
      if (preparesPersonalTasks) {
        const effectiveCompanies = new Map<string, Set<string>>();
        const addEffectiveCompanies = (key: string, companyIds: string[]) => {
          const selected = companyIds.filter((companyId) => draft.selectedCompanyIds.includes(companyId));
          if (selected.length) effectiveCompanies.set(key, new Set(selected));
        };
        for (const taskId of selectedTemplateIds) {
          addEffectiveCompanies(taskId, draft.assignmentCompanyIds?.[taskId] || draft.selectedCompanyIds);
        }
        if (!parisOnboarding) {
          for (const task of draft.customTasks || []) {
            addEffectiveCompanies(task.id, draft.assignmentCompanyIds?.[task.id] || draft.selectedCompanyIds);
          }
          if (draft.customTitle.trim()) addEffectiveCompanies("custom", draft.assignmentCompanyIds?.custom || draft.selectedCompanyIds);
        }
        if (laboratory && !remoteSave) {
          for (const proposal of draft.habitualTaskProposals || []) if (!parisOnboarding || proposal.taskCode) addEffectiveCompanies(proposal.id, proposal.companyIds);
        }
        for (const [key, companyIds] of effectiveCompanies) {
          const genericSchedule = draft.schedules?.[key];
          for (const companyId of companyIds) {
            const schedule = draft.companySchedules?.[key]?.[companyId] || genericSchedule;
            if (schedule) validateSchedule(schedule);
            const target = draft.companyTargets?.[key]?.[companyId];
            if (target !== undefined && (!Number.isFinite(target) || target < 0))
              throw Error("Las metas por empresa deben ser números válidos.");
          }
        }
        if (!parisOnboarding) {
          for (const task of draft.customTasks || []) validateSteps(task.steps.split(/\r?\n/));
          if (draft.customTitle.trim()) validateSteps(String(draft.customSteps || "").split(/\r?\n/));
        }
        const customIds = new Set([...(draft.customTasks || []).map((task) => task.id), "custom"]);
        for (const [key, companyIds] of effectiveCompanies) {
          if (!customIds.has(key)) continue;
          for (const companyId of companyIds) {
            const schedule = draft.companySchedules?.[key]?.[companyId] || draft.schedules?.[key];
            if (schedule && schedule.frequency !== "única")
              throw Error("Los trabajos particulares son puntuales. Para repetirlos, jefatura debe incorporar el proceso al catálogo.");
          }
        }
      }
    } catch (e) {
      notify((e as Error).message);
      return;
    }
    const assignments: Assignment[] = [];
    const scheduleForCompany = (taskId: string, companyId: string, noStarterDeadline = false) =>
      (laboratory && !remoteSave ? draft.companySchedules?.[taskId]?.[companyId] : undefined) ||
      draft.schedules?.[taskId] || (noStarterDeadline ? { ...defaultSchedule(month + "-25"), hasDeadline: false } : defaultSchedule(month + "-25"));
    const targetForCompany = (taskId: string, companyId: string, fallback: number) =>
      laboratory && !remoteSave ? (draft.companyTargets?.[taskId]?.[companyId] ?? fallback) : fallback;
    for (const cid of preparesPersonalTasks ? draft.selectedCompanyIds : []) {
      for (const tid of selectedTemplateIds) {
        if (
          !(
            draft.assignmentCompanyIds?.[tid] || draft.selectedCompanyIds
          ).includes(cid)
        )
          continue;
        const legacyTemplate = state.templates.find((t) => t.id === tid);
        const schedule = scheduleForCompany(tid, cid);
        if (!legacyTemplate && laboratory && !remoteSave) {
          const starterAssignment = materializeNeutralStarterAssignment(tid, {
            id: `onboard-${active.id}-${cid}-${tid}`,
            owner: active,
            companyId: cid,
            startMonth: month,
            day: draft.day,
            schedule,
          });
          if (starterAssignment) assignments.push(starterAssignment);
          continue;
        }
        if (!legacyTemplate) continue;
        const t = legacyTemplate;
        assignments.push({
          id: `onboard-${active.id}-${cid}-${tid}`,
          templateId: tid,
          ...(laboratory && !remoteSave ? { templateVersion: currentCatalogueVersion(state, tid) || 1 } : {}),
          ...(laboratory && !remoteSave && t.neutralConceptCode !== undefined ? { neutralConceptCode: t.neutralConceptCode, taxonomyVersion: t.taxonomyVersion } : {}),
          title: t.title,
          ownerId: active.id,
          companyId: cid,
          sector: t.sector,
          kind: t.kind,
          weight: t.weight,
          unit: t.unit,
          target: laboratory && !remoteSave && t.kind === "operativa" ? 0 : targetForCompany(tid, cid, t.target),
          day: draft.day,
          frequency: draft.frequency,
          steps: t.steps,
          startMonth: month,
          schedule,
          priority: "Media",
        });
      }
      const custom = parisOnboarding ? [] : [
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
          target: laboratory && !remoteSave && c.kind === "operativa" ? 0 : targetForCompany(c.id, cid, c.target),
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
    if (laboratory && !remoteSave && preparesPersonalTasks) {
      try {
        const now = new Date().toISOString();
        for (const proposal of draft.habitualTaskProposals || []) {
          if (parisOnboarding && !proposal.taskCode) continue;
          for (const cid of proposal.companyIds.filter((companyId) => draft.selectedCompanyIds.includes(companyId))) {
            const pending = submitHabitualTaskProposal({ ...state, habitualTaskProposals }, active, {
              id: proposal.starterId ? `${proposal.starterId}:${active.id}:${cid}` : `${proposal.id}:${cid}`,
              companyId: cid,
              starterId: proposal.starterId,
            taskCode: proposal.taskCode,
            taskCatalogVersion: proposal.taskCatalogVersion,
            businessUnitCode: proposal.businessUnitCode,
            taskParameters: proposal.taskParameters,
              title: proposal.title,
              process: proposal.process,
              description: proposal.description,
              neutralConceptCode: proposal.neutralConceptCode,
              taxonomyVersion: proposal.taxonomyVersion,
              kind: proposal.kind,
              unit: proposal.unit,
              target: targetForCompany(proposal.id, cid, 0),
              schedule: scheduleForCompany(proposal.id, cid, !!proposal.starterId),
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
          ...(preparesPersonalTasks ? {} : {
            selectedTemplateIds: [],
            assignmentCompanyIds: retainProposalDraftMap(draft.assignmentCompanyIds, draft.habitualTaskProposals),
            schedules: retainProposalDraftMap(draft.schedules, draft.habitualTaskProposals),
            companySchedules: retainProposalDraftMap(draft.companySchedules, draft.habitualTaskProposals),
            companyTargets: retainProposalDraftMap(draft.companyTargets, draft.habitualTaskProposals),
            customTitle: "",
            customSteps: "",
            customTasks: [],
          }),
          completedAt: new Date().toISOString(),
          step: 5,
        },
      },
      tour: { ...state.tour, [active.id]: 0 },
      tourStepId: { ...state.tourStepId, [active.id]: "day-route" },
      tourVersion: { ...state.tourVersion, [active.id]: TOUR_VERSION },
    };
    next = materialize(next, month);
    if (commit(next, "Completó inducción", active.id)) {
      setInduct(false);
      setPage("day");
      setOwner(active.id);
      tourOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      tourActorRef.current = active.id;
      setTourOpen(true);
    }
  }
  const tours: { id: string; page: Page; selector: string; fallbackSelector?: string; title: string; text: string }[] = [
    { id: "day-route", page: "day", selector: '[data-tour="day-route"]', fallbackSelector: '[data-tour="day-overview"]', title: "Tu jornada", text: "Revisá tus prioridades y pendientes. Cuando está disponible, la hoja de ruta explica qué tareas están habilitadas y cuáles esperan una dependencia; la sugerencia no inicia tareas ni cronómetros." },
    { id: "board-movement", page: "tasks", selector: '[data-tour="board-movement"]', title: "Organizá y mové el tablero", text: "Mové una tarjeta con arrastre o Alt y las flechas. La sugerencia de orden no reemplaza tus decisiones; sólo responsables o coberturas vigentes pueden ejecutar." },
    { id: "board-checks", page: "tasks", selector: '[data-tour="task-controls"]', fallbackSelector: '[data-tour="task-column-open"], [data-tour="task-column-empty"]', title: "Controles y evidencia", text: "Abrí una columna con tareas y desplegá la tarjeta para revisar controles y evidencia opcional. Si no hay tarjetas visibles, el tablero muestra columnas vacías; el recorrido no crea tareas de ejemplo." },
    { id: "board-timer", page: "tasks", selector: '[data-tour="task-timers"]', fallbackSelector: '[data-tour="task-column-open"], [data-tour="task-column-empty"]', title: "Tiempo registrado", text: "El cronómetro de una tarjeta conserva quién lo inició; consultar el trabajo de otra persona no cambia el actor. Abrí una columna con tareas para llegar al control." },
    { id: "operations-movements", page: "operations", selector: '[data-tour="operations-movements"]', title: "Movimientos operativos", text: "Registrá cantidad y unidad por movimiento. La referencia y evidencia son opcionales; no hay una meta mensual que completar." },
    { id: "calendar-agenda", page: "calendar", selector: '[data-tour="calendar-day-detail"]', fallbackSelector: '[data-tour="calendar-grid"], [data-tour="calendar-agenda-basic"]', title: "Calendario y agenda", text: "Elegí un día y revisá su agenda; las tareas y obligaciones se abren desde su módulo de origen. Las fechas compartidas no amplían permisos sobre el trabajo vinculado." },
    { id: "absence-coverage", page: "absences", selector: '[data-tour="absence-coverage"]', title: "Ausencias y cobertura", text: "Consultá los intervalos y la cobertura autorizada. Las observaciones privadas no se exponen a quienes revisan disponibilidad." },
    { id: "private-annotations", page: "annotations", selector: '[data-tour="annotations-create-action"]', fallbackSelector: '[data-tour="private-annotations"]', title: "Anotaciones personales", text: "Esta acción abre el formulario de tu biblioteca personal. Podés buscar y filtrar tus notas; el recorrido no lee ni muestra su contenido." },
    { id: "planning-rules", page: "planning", selector: '[data-tour="planning-list"]', fallbackSelector: '[data-tour="planning-empty"]', title: "Planificación y reglas", text: "Consultá reglas vigentes y sus instancias; la jefatura puede reprogramar con una nueva vigencia, sin reescribir el trabajo anterior." },
    ...(labOnly ? [
      { id: "requests-followup", page: "requests" as Page, selector: '[data-tour="requests-list"]', fallbackSelector: '[data-tour="requests-empty"]', title: "Consultas y pedidos", text: "Revisá la bandeja de seguimiento. La acción Nuevo pedido abre el formulario cuando quieras usarlo; sólo roles autorizados convierten pedidos en trabajo." },
      { id: "process-quality", page: "quality" as Page, selector: '[data-tour="quality-kaizen-content"]', fallbackSelector: '[data-tour="quality-kaizen-action"]', title: "Mejora de procesos", text: "Consultá propuestas y su estado de revisión. La acción de propuesta inicia una carga sólo si la elegís; el recorrido no crea ni revisa casos." },
    ] : []),
    ...(manager ? [
      { id: "analytics-series", page: "analytics" as Page, selector: '[data-tour="analytics-distribution"]', fallbackSelector: '[data-tour="analytics-series"]', title: "Análisis y series", text: "Elegí la distribución por estado, tipo, empresa o equipo, y las series compatibles bajo el gráfico. Los bloques de detalle se despliegan cuando los necesitás; “Sin base” es distinto de cero." },
      { id: "team-consultation", page: "team" as Page, selector: '[data-tour="team-consultation"]', fallbackSelector: ".org-root", title: "Organigrama y consulta", text: "Abrí las tareas de una persona desde su equipo sin cambiar quién actúa. La presencia de esta demostración es simulada y no incluye notas personales." },
    ] : []),
    ...(active.role === "jefe" ? [
      { id: "monthly-close", page: "closing" as Page, selector: '[data-tour="closure-preview"]', fallbackSelector: '[data-tour="monthly-close-basic"]', title: "Cierre de mes", text: "Revisá el alcance elegido y la vista previa de unidades listas o pendientes. La confirmación exige volver a verificar; el recorrido nunca cierra unidades." },
      { id: "task-catalogue", page: "catalog" as Page, selector: '[data-tour="catalogue-row"]', fallbackSelector: '[data-tour="task-catalogue"]', title: "Catálogo y versiones", text: "Buscá una fila compacta y desplegá la tarea para consultar configuración e historial versionado. La jefatura administra los cambios según su vigencia." },
    ] : []),
  ];
  const storedTourId = state.tourVersion?.[active.id] === TOUR_VERSION ? state.tourStepId?.[active.id] : undefined;
  const storedTourIndex = storedTourId === "__complete__" ? tours.length : tours.findIndex((step) => step.id === storedTourId);
  const savedTourValue = state.tourVersion?.[active.id] === TOUR_VERSION
    ? storedTourId ? Math.max(0, storedTourIndex) : state.tour[active.id] || 0
    : 0;
  const savedTour = Number.isSafeInteger(savedTourValue)
    ? Math.min(Math.max(savedTourValue, 0), tours.length)
    : 0;
  const tourStep = Number.isSafeInteger(savedTour)
    ? Math.min(Math.max(savedTour, 0), tours.length - 1)
    : 0;
  const [tourFallback, setTourFallback] = useState(false);
  const [tourPosition, setTourPosition] = useState<{ top: number; left: number } | null>(null);
  const tourDialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tourOpen) {
      tourWasOpenRef.current = true;
      return;
    }
    if (!tourWasOpenRef.current) return;
    tourWasOpenRef.current = false;
    const frame = requestAnimationFrame(() => {
      const source = tourActorRef.current === active.id ? tourOpenerRef.current : null;
      const visible = (node: HTMLElement | null): node is HTMLElement => {
        if (!node?.isConnected || node.matches(":disabled") || node.closest("[hidden]")) return false;
        for (let current: HTMLElement | null = node; current; current = current.parentElement) {
          const style = getComputedStyle(current);
          if (style.display === "none" || style.visibility === "hidden") return false;
        }
        return true;
      };
      const fallback = document.querySelector<HTMLElement>('[data-tour-trigger="true"]');
      const target = visible(source) ? source : fallback;
      if (visible(target)) target.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [tourOpen, active.id]);
  useEffect(() => {
    let highlighted: Element | null = null;
    let scrolledTarget: Element | null = null;
    let observer: MutationObserver | undefined;
    const automaticToggles: { button: HTMLButtonElement; wasExpanded: boolean; changedByUser: boolean }[] = [];
    const automaticDetails: { details: HTMLDetailsElement; wasOpen: boolean; changedByUser: boolean }[] = [];
    const automaticButtons = new WeakSet<HTMLButtonElement>();
    const openAutomatically = (button: HTMLButtonElement) => {
      if (automaticToggles.some((entry) => entry.button === button)) return;
      const wasExpanded = button.getAttribute("aria-expanded") === "true";
      automaticToggles.push({ button, wasExpanded, changedByUser: false });
      automaticButtons.add(button);
      button.click();
      automaticButtons.delete(button);
    };
    const markManualToggle = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>(".panel-collapse, .card-collapse, .column-toggle");
      if (button && !automaticButtons.has(button)) {
        const entry = automaticToggles.find((item) => item.button === button);
        if (entry) entry.changedByUser = true;
      }
      const details = target.closest<HTMLDetailsElement>("details");
      if (details) {
        const entry = automaticDetails.find((item) => item.details === details);
        if (entry) entry.changedByUser = true;
      }
    };
    const isVisible = (element: HTMLElement) => {
      for (let node: HTMLElement | null = element; node; node = node.parentElement) {
        if (node.hidden) return false;
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
        const step = tours[tourStep];
        const candidates = Array.from(document.querySelectorAll<HTMLElement>(step.selector));
        const candidate = candidates.find((item) => !item.matches(":disabled"));
        const closedDetails: HTMLDetailsElement[] = [];
        for (let node = candidate || null; node; node = node.parentElement) {
          if (node instanceof HTMLDetailsElement && !node.open) closedDetails.unshift(node);
        }
        const nextDetails = closedDetails[0];
        if (nextDetails) {
          if (!automaticDetails.some((entry) => entry.details === nextDetails)) automaticDetails.push({ details: nextDetails, wasOpen: nextDetails.open, changedByUser: false });
          nextDetails.open = true;
          return;
        }
        const hiddenPanel = candidate?.closest<HTMLElement>(".panel-body[hidden]");
        const panelToggle = hiddenPanel?.parentElement?.querySelector<HTMLButtonElement>(":scope > .panel-head .panel-collapse");
        if (panelToggle && panelToggle.getAttribute("aria-expanded") !== "true") {
          openAutomatically(panelToggle);
          return;
        }
        const card = candidate?.closest<HTMLElement>(".task-card");
        const hiddenCardBody = candidate?.closest<HTMLElement>(".task-card [hidden]");
        const cardToggle = hiddenCardBody ? card?.querySelector<HTMLButtonElement>(".card-collapse") : null;
        if (cardToggle && cardToggle.getAttribute("aria-expanded") !== "true") {
          openAutomatically(cardToggle);
          return;
        }
        let target = candidates.find((item) => isVisible(item) && !item.closest(".column.folded"));
        if (!target && step.fallbackSelector) {
          target = Array.from(document.querySelectorAll<HTMLElement>(step.fallbackSelector)).find(isVisible);
          fallback = !!target;
        }
        highlighted = target || null;
        highlighted?.classList.add("spotlight");
      }
      if (tourOpen && highlighted instanceof HTMLElement) {
        const targetRect = highlighted.getBoundingClientRect();
        const targetOutsideViewport = targetRect.top < 12 || targetRect.bottom > window.innerHeight - 12;
        if ((scrolledTarget !== highlighted || targetOutsideViewport) && typeof highlighted.scrollIntoView === "function") {
          const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          highlighted.scrollIntoView({ block: "center", behavior: reducedMotion || targetOutsideViewport ? "auto" : "smooth" });
          scrolledTarget = highlighted;
        }
        const rect = highlighted.getBoundingClientRect();
        const coachWidth = Math.min(390, window.innerWidth - 24);
        const coachHeight = Math.min(300, window.innerHeight - 24);
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - coachWidth - 12));
        const below = rect.bottom + 16;
        const top = below + coachHeight <= window.innerHeight - 12
          ? below
          : Math.max(12, Math.min(rect.top - coachHeight - 16, window.innerHeight - coachHeight - 12));
        setTourPosition({ top, left });
      } else {
        setTourPosition(null);
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
        attributeFilter: ["aria-expanded", "hidden", "open"],
      });
      main.addEventListener("click", markManualToggle, true);
      resolveTarget();
    }
    window.addEventListener("resize", resolveTarget);
    window.addEventListener("scroll", resolveTarget, true);
    return () => {
      observer?.disconnect();
      main?.removeEventListener("click", markManualToggle, true);
      window.removeEventListener("resize", resolveTarget);
      window.removeEventListener("scroll", resolveTarget, true);
      highlighted?.classList.remove("spotlight");
      for (const entry of [...automaticToggles].reverse()) {
        if (!entry.changedByUser && entry.button.isConnected && (entry.button.getAttribute("aria-expanded") === "true") !== entry.wasExpanded) entry.button.click();
      }
      for (const entry of [...automaticDetails].reverse()) {
        if (!entry.changedByUser && entry.details.isConnected && entry.details.open !== entry.wasOpen) entry.details.open = entry.wasOpen;
      }
    };
  }, [tourOpen, tourStep, page, active.id]);
  useEffect(() => {
    if (!tourOpen) return;
    const dialog = tourDialog.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) || []).filter((node) => {
      if (!node.isConnected || node.closest("[hidden]")) return false;
      for (let current: HTMLElement | null = node; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (style.display === "none" || style.visibility === "hidden") return false;
      }
      return true;
    });
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setTourOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement as HTMLElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !items.includes(document.activeElement as HTMLElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tourOpen]);
  const workspaceReady = !!draft.completedAt && !induct;
  const chartGroups = useMemo(() => !workspaceReady ? [] : (
    group === "individual"
      ? people.map((p) => ({ id: p.id, name: p.name }))
      : group === "team"
        ? state.teams.map((t) => ({ ...t, name: teamName(t.id) }))
        : [...new Set(summaryFiltered.map((t) => t.sector))].map((s) => ({
            id: s,
            name: s,
          }))
  )
    .map((g) => {
      const ts = summaryFiltered.filter((t) =>
        group === "individual"
          ? isResponsible(t, g.id)
          : group === "team"
            ? t.teamId === g.id
            : t.sector === g.id,
      );
      const metricRows = labOnly ? ts.filter((task) => task.kind === "resultado") : ts;
      const x = group === "individual"
        ? metricsForProfile(metricRows, state.activity, g.id, dateART(metricAsOf), metricAsOf)
        : metrics(metricRows, state.activity, dateART(metricAsOf), metricAsOf);
      const operationIds = new Set(ts.filter((task) => task.kind === "operativa").map((task) => task.id));
      const assessments = (state.operationalAssessments || []).filter((assessment) => operationIds.has(assessment.taskId));
      const averageAssessment = (key: "quality" | "order" | "timeliness") => assessments.length
        ? Math.round(assessments.reduce((sum, assessment) => sum + assessment[key], 0) / assessments.length)
        : null;
      return { ...g, ...x, pendingPoints: Math.max(0, x.points - x.earned), operationalQuality: averageAssessment("quality"), operationalOrder: averageAssessment("order"), operationalTimeliness: averageAssessment("timeliness"), operationalEvaluations: assessments.length };
    })
    .filter((g) => labOnly ? summaryFiltered.some((task) => group === "individual"
      ? isResponsible(task, g.id)
      : group === "team"
        ? task.teamId === g.id
        : task.sector === g.id) : g.points > 0)
    .sort((a, b) => b.points - a.points), [workspaceReady, group, people, summaryFiltered, state.activity, state.operationalAssessments, state.teams, state.profiles, metricDay, metricAsOf, labOnly]);
  const distributionData = useMemo(() => !workspaceReady ? [] : (() => {
    const counts = new Map<string, number>();
    for (const task of summaryFiltered) {
      const label = distributionBy === "status"
        ? task.status
        : distributionBy === "kind"
          ? task.kind === "operativa" ? "Operativa" : "Entregable"
          : distributionBy === "company" ? companyOf(task.companyId) : teamName(task.teamId);
      counts.set(label, (counts.get(label) || 0) + 1);
    }

    return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  })(), [workspaceReady, summaryFiltered, distributionBy, state.teams, state.profiles]);
  const history = useMemo(() => !workspaceReady ? [] : labOnly
    ? closedPeriodHistory(state, { viewerId: active.id, throughMonth: month, ownerId: owner || undefined, companyId: company || undefined, sector: sector || undefined, teamId: team || undefined, query })
      .map((row) => ({ ...row, label: monthLabel(row.period) }))
    : [...new Set(state.tasks.map((t) => t.month))]
    .filter((p) => p <= month)
    .sort()
    .slice(-6)
    .map((period) => {
      const periodRows = state.tasks.filter(
        (t) =>
          t.month === period &&
          (labOnly ? calendarCanAccessTask(state, active, t) : canWork(state, active, t)) &&
          (!company || t.companyId === company) &&
          (!owner || isResponsible(t, owner)) &&
          (!sector || t.sector === sector) &&
          (!team || t.teamId === team) &&
          (!query ||
            `${t.title} ${nameOf(t.ownerId)} ${companyOf(t.companyId)}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      );
      const tasks = labOnly ? periodRows.filter((task) => task.kind === "resultado") : periodRows;
      const periodMetrics = metrics(tasks, state.activity);
      const periodOperational = labOnly ? operationalLoad(state, periodRows.filter((task) => task.kind === "operativa").map((task) => task.id)) : null;
      const recordedSeconds = periodRows.reduce((sum, task) => sum + (task.sessions || []).reduce((elapsed, session) => elapsed + Math.max(0, (Date.parse(session.end || metricAsOf) - Date.parse(session.start)) / 1000), 0), 0);
      return {
        period,
        label: monthLabel(period),
        ...periodMetrics,
        operationalLoad: periodOperational?.activities ? periodOperational.weightedLoad : null,
        recordedSeconds,
      };
    })
    .filter((p) => p.points > 0), [workspaceReady, state.tasks, state.activity, state.closures, month, labOnly, active, state, company, owner, sector, team, query, metricAsOf]);
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
          key={active.id}
          remote={!!remoteSave}
          month={month}
          state={state}
          profile={active}
          draft={draft}
          onboardingNotice={notice}
          update={(d) =>
            (setNotice(""), commit({ ...state, onboarding: { ...state.onboarding, [active.id]: d } }))
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
  function toggleHistorySeries(series: "weighted" | "onTime" | "operationalLoad" | "recordedSeconds") {
    setHistorySeries((current) => {
      if (current.includes(series)) return current.length === 1 ? current : current.filter((item) => item !== series);
      const dimension = (item: string) => item === "weighted" || item === "onTime" ? "percent" : item;
      const currentDimension = dimension(current[0] || "weighted");
      if (dimension(series) !== currentDimension) return [series];
      return [...current, series];
    });
  }
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
          labOnly ? {
            label: "Movimientos gestionados",
            value: operationalSummary?.activities.toLocaleString("es-AR") || "0",
            hint: `${operationalUnits} · Calidad ${operationQuality("quality") ?? "sin evaluar"} · Orden ${operationQuality("order") ?? "sin evaluar"} · Oportunidad ${operationQuality("timeliness") ?? "sin evaluar"}`,
            icon: ActivityIcon,
          } : {
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
    const closed = taskLocked(t);
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
                      disabled={taskLocked(t) || !canExecute(t)}
                    >
                      Registrar
                    </button>
                  ) : (
                    <button
                      onClick={() => advance(t)}
                      disabled={taskLocked(t) || !canExecute(t)}
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
        collapsible
        defaultOpen
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
  const tasksForDetail = state.tasks.find((t) => t.id === detail && (labOnly ? calendarCanAccessTask(state, active, t) : canWork(state, active, t)));
  const logTask = state.tasks.find((t) => t.id === logFor && (labOnly ? calendarCanAccessTask(state, active, t) : canWork(state, active, t)) && (!labOnly || canExecute(t)));
  function openSearchResult(task: Task) {
    if (labOnly ? !calendarCanAccessTask(state, active, task) : !canWork(state, active, task)) {
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
    requestAnimationFrame(() => {
      const detailDialog = Array.from(document.querySelectorAll<HTMLElement>('dialog[open]')).find((dialog) => dialog.getAttribute("aria-labelledby") && document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent === task.title);
      const title = detailDialog?.querySelector<HTMLElement>("h2") || Array.from(document.querySelectorAll<HTMLElement>("[data-task-id] .card-title")).find((button) => button.textContent?.trim() === task.title);
      title?.focus();
    });
  }

  return (
    <>
      <aside className={`sidebar${labOnly ? " sidebar-lab" : ""}`}>
        <div className="brand">
          <img src="/logo-grupo-paris.svg" alt="Grupo París" />
          <div className="brand-wordmark"><strong>IVA</strong><span>GESTIÓN CONTABLE</span></div>
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
              (p.id !== "gemelo" || (laboratory && !remoteSave)) &&
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
        {(() => {
          const personalTasks = state.tasks.filter((task) =>
            task.status !== "Completada" && !taskLocked(task) &&
            (labOnly ? calendarCanAccessTask(state, active, task) : canWork(state, active, task)) &&
            (isResponsible(task, active.id) || coverageFor(state, task)?.replacementId === active.id),
          );
          const datedTasks = personalTasks.filter((task) => task.due);
          const upcoming = datedTasks.filter((task) => task.due >= dateART()).sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title, "es"))[0]
            || datedTasks.sort((a, b) => b.due.localeCompare(a.due))[0];
          const running = personalTasks.find((task) => task.sessions?.some((session) => !session.end && session.actorId === active.id));
          return (personalTasks.length > 0 || running) ? <section className="sidebar-day-summary" aria-label="Mi jornada">
            <div><b>Mi jornada</b><span>{personalTasks.length} pendiente{personalTasks.length === 1 ? "" : "s"}</span></div>
            {upcoming && <button type="button" onClick={() => { setMonth(upcoming.month); setBoardOwner(active.id); setPage("tasks"); setDetail(upcoming.id); }}>
              <CalendarDays size={13} /><span>Próxima · {upcoming.title}</span><small>{fmt(upcoming.due)}</small>
            </button>}
            {running && <button type="button" className="sidebar-running-task" onClick={() => { setMonth(running.month); setBoardOwner(active.id); setPage("tasks"); setDetail(running.id); }}>
              <ActivityIcon size={13} /><span>Cronómetro en curso</span>
            </button>}
          </section> : null;
        })()}
        <div className="sidebar-bottom">
          {!remoteSave && !laboratoryMode && <button onClick={() => (laboratory ? exitLab() : enterLab(state))}>
            {laboratory ? "Salir del laboratorio" : "Laboratorio de pruebas"}
          </button>}
          <button
            data-tour-trigger="true"
            onClick={() => {
              const progress = savedTour;
              const start = progress >= tours.length ? 0 : progress;
              const resetOutdatedProgress =
                (state.tour[active.id] || 0) > 0 &&
                state.tourVersion?.[active.id] !== TOUR_VERSION;
              if (
                !commit({
                  ...state,
                  tour: { ...state.tour, [active.id]: start },
                  tourStepId: { ...state.tourStepId, [active.id]: tours[start]?.id || "__complete__" },
                  tourVersion: {
                    ...state.tourVersion,
                    [active.id]: TOUR_VERSION,
                  },
                })
              )
                return;
              tourOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              tourActorRef.current = active.id;
              setTourResetNotice(resetOutdatedProgress);
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
          {labOnly ? <EmployeePicker label="Vista de prueba · actor simulado" selectLabel="Vista de usuario" profiles={state.profiles.filter((profile) => profile.active)} teams={state.teams} value={active.id} onChange={changeProfile} compact /> : <label>
            {remoteSave ? "Mi espacio" : "Vista de usuario · simulación"}
            <select aria-label="Vista de usuario" value={active.id} onChange={(e) => changeProfile(e.target.value)}>
              {state.profiles.filter((p) => p.active && (!remoteSave || (remoteOwner && ['admin','e0'].includes(p.id)) || p.id===active.id)).map((p) => <option key={p.id} value={p.id}>{p.id==='admin'&&remoteSave ? 'Administrar tablero' : p.id==='e0'&&remoteSave ? 'Mi tablero · Valentino' : `${p.name} · ${p.role}`}</option>)}
              {remoteSave&&remoteOwner&&!state.profiles.some(p=>p.id==='admin')&&<option value="admin">Administrar tablero</option>}
            </select>
          </label>}
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
          <div className="header-spacer" aria-hidden="true" />
          <div className="header-right">
            <button type="button" className="quick-search-trigger" aria-label="Abrir búsqueda de tareas" title="Buscar tareas · Ctrl+K" onClick={() => setQuickTaskSearchOpen(true)}><Search size={16} aria-hidden="true" /><span>Buscar</span><kbd>Ctrl K</kbd></button>
            {!remoteSave && <NotificationCenter key={active.id} state={state} commit={commit} notify={notify} laboratory={laboratory} onOpenProposals={() => setPage("team")} onOpenCalendar={() => setPage("calendar")} onOpenTask={taskId => {
              const task = state.tasks.find(t => t.id === taskId);
              if (task && (labOnly ? calendarCanAccessTask(state, active, task) : canWork(state, active, task))) { setMonth(task.month); setPage('tasks'); setDetail(taskId); }
            }} />}
            <ThemeControl />
          </div>
        </header>
        <div className="content">
          <div className="content-breadcrumb">Espacio de trabajo <span>/</span> <b>{pages.find((p) => p.id === page)?.name}</b></div>
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
              <span className="eyebrow">{page === "gemelo" ? "IVA · GEMELO" : "CONTABILIDAD · GRUPO PARÍS"}</span>
              <h1>
                {page === "gemelo"
                  ? "El trabajo contable, en contexto."
                  : page === "overview"
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
                  {page === "gemelo"
                    ? "Tareas y vencimientos de tu ámbito, con próximos pasos claros."
                    : page === "overview" && active.role === "empleado"
                    ? "Tus tareas, prioridades y resultados del período."
                    : page === "operations"
                  ? labOnly ? "Facturas, trámites y pagos: cantidades, carga ponderada y tiempo registrado." : "Facturas, trámites y pagos: cantidades, referencias y metas por mes."
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
            {isOwnBoardPage ? (
              <div className="board-owner-filter">
                <EmployeePicker label="Tareas de" selectLabel="Perfil que estás viendo" profiles={people} teams={state.teams} value={viewedOwner} onChange={setBoardOwner} emptyLabel="Elegí una persona" compact />
                <small>Consultar este tablero no cambia tu identidad ni habilita acciones por esa persona.</small>
              </div>
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
            {page === "gemelo" && labOnly && (
              <Gemelo
                actorId={active.id}
                tasks={gemeloContext.tasks}
                obligations={gemeloContext.obligations}
                companyOf={companyOf}
                onOpenTask={(taskId) => {
                  const task = state.tasks.find((row) => row.id === taskId);
                  if (!task || !calendarCanAccessTask(state, active, task)) return;
                  setMonth(task.month);
                  setBoardOwner(active.role === "empleado" ? active.id : task.ownerId);
                  setOwner(active.role === "empleado" ? active.id : task.ownerId);
                  setPage("tasks");
                  setDetail(task.id);
                }}
                onOpenCalendar={() => setPage("calendar")}
              />
            )}
            {page === "requests" && laboratory && !remoteSave && <InternalRequests state={state} actor={active} onCreate={createRequest} onStatus={updateRequestStatus} onReply={replyRequest} onConvert={convertRequestToTask} onOpenTask={openRequestTask} />}
            {page === "quality" && laboratory && !remoteSave && <ProcessQuality state={state} actor={active} commit={commit} notify={notify} />}
            {(page === "overview" || page === "day") && (
              <>
                {stats()}
                {page === "day" && labOnly && <SuggestedRoutePanel state={state} actor={active} profileId={viewedOwner} month={month} companyId={company || undefined} teamId={team || undefined} sector={sector || undefined} companyOf={companyOf} onOpen={(taskId) => { setPage("tasks"); setDetail(taskId); }} />}
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
                <div className="dashboard-row" data-tour="day-overview">
                  <Panel
                    title={active.role === "empleado" ? "Tu avance ponderado" : "Avance ponderado del equipo"}
                    sub="Puntos completados y pendientes · mismo período"
                    collapsible
                    defaultOpen
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
                          <Tooltip
                            allowEscapeViewBox={{ x: true, y: true }}
                            wrapperStyle={{ zIndex: 30, pointerEvents: "none" }}
                            cursor={{ fill: "var(--chart-cursor)", fillOpacity: 0.12, stroke: "var(--chart-cursor-border)", strokeOpacity: 0.55 }}
                            content={({ active: tooltipActive, payload }) => {
                              const row = payload?.[0]?.payload as (typeof chartGroups)[number] | undefined;
                              if (!tooltipActive || !row) return null;
                              return <div className="analytics-score-tooltip">
                                <b>{row.name}</b>
                                <span>Puntos logrados <strong>{row.earned.toLocaleString("es-AR", { maximumFractionDigits: 1 })}</strong></span>
                                <span>Puntos pendientes <strong>{row.pendingPoints.toLocaleString("es-AR", { maximumFractionDigits: 1 })}</strong></span>
                                <span>Total asignado <strong>{row.points.toLocaleString("es-AR", { maximumFractionDigits: 1 })} pts</strong></span>
                                <span>Entregables <strong>{row.done} de {row.assigned}</strong></span>
                              </div>;
                            }}
                          />
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
                    <Panel title="Entregables" sub="Una instancia independiente por empresa y mes" collapsible defaultOpen>
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
                      <Panel title="Entregables cubiertos" sub="La cobertura no crea una tarea duplicada" collapsible defaultOpen>
                        {table(coveredResults)}
                      </Panel>
                    ) : (
                      <TaskBoard tasks={coveredResults} renderCard={taskCard} onMove={moveBoardTask} />
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
                  if (!task || (labOnly ? !calendarCanAccessTask(state, active, task) : !canWork(state, active, task))) return;
                  setMonth(task.month);
                  setPage("tasks");
                  setDetail(taskId);
                }}
              />
            )}
            {page === "operations" && (
              <>
                {labOnly && active.role === "jefe" && <OperationalRatePanel state={state} actor={active} commit={commit} notify={notify} company={company || undefined} />}
                <section className="task-owner-section" data-tour="operations-movements">
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
                        closed={taskLocked(t) || !canExecute(t)}
                        laboratory={labOnly}
                        weightedLoad={labOnly ? operationalLoad(state, [t.id]).weightedLoad : undefined}
                        unweightedQuantity={labOnly ? operationalLoad(state, [t.id]).unweightedQuantity : undefined}
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
                          closed={taskLocked(t) || !canExecute(t)}
                          laboratory={labOnly}
                          weightedLoad={labOnly ? operationalLoad(state, [t.id]).weightedLoad : undefined}
                          unweightedQuantity={labOnly ? operationalLoad(state, [t.id]).unweightedQuantity : undefined}
                          timeliness={taskTimeliness(t, state.activity, new Date().toISOString())}
                          onClock={() => clock(t, !t.sessions?.some((session) => !session.end && session.actorId === active.id))}
                          onLog={() => setLogFor(t.id)}
                          onDetails={() => setDetail(t.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {labOnly && active.role === "jefe" && <OperationalQualityReview state={state} actor={active} tasks={operations} commit={commit} notify={notify} companyOf={companyOf} nameOf={nameOf} />}
                {!ownBoardOperations.length && !coveredOperations.length && (
                  <Empty text="No hay operativas. Podés crear una desde Nueva tarea." />
                )}
                <Panel
                  title="Últimos registros"
                  sub={`${state.activity.filter((activity) => visibleOperations.some((task) => task.id === activity.taskId) && activity.date.startsWith(month)).length} movimientos · cada registro conserva cantidad, unidad, empresa y referencia`}
                  collapsible
                  defaultOpen={false}
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
                            ...(!labOnly ? ["Metas operativas antes / evaluables", "Metas operativas antes %", "Promedio días meta anticipada"] : ["Calidad operativa", "Orden operativo", "Oportunidad operativa", "Evaluaciones operativas"]),
                          ],
                          ...chartGroups.map((g) => [
                            g.name,
                            g.points,
                            g.earned,
                            g.weighted ?? (labOnly ? "Sin base" : ""),
                            g.onTime,
                            g.assigned,
                            g.done,
                            g.late,
                            `${g.timeliness?.results.early ?? 0}/${g.timeliness?.results.evaluated ?? 0}`,
                            g.timeliness?.results.earlyRate ?? "Sin muestra",
                            g.timeliness?.results.averageDaysAhead ?? "Sin muestra",
                            ...(labOnly ? [g.operationalQuality ?? "Sin evaluar", g.operationalOrder ?? "Sin evaluar", g.operationalTimeliness ?? "Sin evaluar", g.operationalEvaluations] : [`${g.timeliness?.operational.early ?? 0}/${g.timeliness?.operational.evaluated ?? 0}`, g.timeliness?.operational.earlyRate ?? "Sin muestra", g.timeliness?.operational.averageDaysAhead ?? "Sin muestra"]),
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
                  includeOperational={!labOnly}
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
                {laboratory && !remoteSave && <Panel title="Trabajo por tarea normalizada" sub="Los códigos confirmados se agrupan por unidad y parámetros; las opciones provisionales se muestran aparte hasta validar equivalencias." collapsible defaultOpen={false}>
                  {(() => {
                    const metrics = summarizeParisTaskWork(filtered, state.activity);
                    return metrics.length ? <div className="table-wrap"><table>
                      <thead><tr><th>Tarea estándar</th><th>Unidad de negocio</th><th>Parámetros</th><th>Empresas</th><th>Asignadas</th><th>Completadas</th><th>Movimientos</th><th>Cantidad</th></tr></thead>
                      <tbody>{metrics.map((metric) => <tr key={metric.key}>
                        <td>{metric.title}{!metric.taskCode && <small className="unclassified-label"> · Sin clasificar</small>}{metric.taskCode && !metric.comparisonEligible && <small className="unclassified-label"> · Provisional, sin comparación entre unidades</small>}</td>
                        <td>{metric.businessUnitLabel}</td>
                        <td>{Object.entries(metric.parameters).filter(([, value]) => value.trim()).map(([key, value]) => `${key.replace(/_/g, " ")}: ${formatParisTaskParameterValue(metric.taskCode, key, value, metric.taskCatalogVersion)}`).join(" · ") || "Sin detalle"}</td>
                        <td>{metric.companies.length}</td><td>{metric.assigned}</td><td>{metric.completed}</td>
                        <td>{metric.kind === "operativa" ? metric.movementCount : "—"}</td>
                        <td>{metric.kind === "operativa" ? `${metric.movementQuantity.toLocaleString("es-AR")} ${metric.unit}` : "—"}</td>
                      </tr>)}</tbody>
                    </table></div> : <Empty text="No hay tareas en el período y filtros seleccionados." />;
                  })()}
                </Panel>}
                <div className="dashboard-row analytics-score-row">
                  <Panel
                    title="Cumplimiento ponderado"
                    sub="Puntos logrados sobre asignados · un 0% es distinto de un ámbito sin base"
                    collapsible
                    defaultOpen
                    action={
                      <button
                        type="button"
                        className="icon-button analytics-help"
                        aria-label={`${formulaOpen ? "Ocultar" : "Ver"} cómo se calcula el cumplimiento ponderado`}
                        aria-expanded={formulaOpen}
                        onClick={() => setFormulaOpen((value) => !value)}
                      >
                        <HelpCircle size={16} aria-hidden="true" />
                      </button>
                    }
                  >
                    <div className="chart">
                      <ResponsiveContainer width="100%" height={Math.max(220, chartGroups.length * 39)}>
                        <BarChart
                          layout="vertical"
                          data={chartGroups}
                          margin={{ right: 42, left: 5 }}
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
                          <Tooltip
                            allowEscapeViewBox={{ x: true, y: true }}
                            wrapperStyle={{ zIndex: 30, pointerEvents: "none" }}
                            cursor={{ fill: "var(--chart-cursor)", fillOpacity: 0.12, stroke: "var(--chart-cursor-border)", strokeOpacity: 0.55 }}
                            content={({ active: tooltipActive, payload }) => {
                              const row = payload?.[0]?.payload as (typeof chartGroups)[number] | undefined;
                              if (!tooltipActive || !row) return null;
                              return <div className="analytics-score-tooltip">
                                <b>{row.name}</b>
                                <span>Puntos logrados <strong>{row.earned.toLocaleString("es-AR", { maximumFractionDigits: 1 })}</strong></span>
                                <span>Puntos pendientes <strong>{row.pendingPoints.toLocaleString("es-AR", { maximumFractionDigits: 1 })}</strong></span>
                                <span>Total asignado <strong>{row.points.toLocaleString("es-AR", { maximumFractionDigits: 1 })} pts</strong></span>
                                <span>Entregables <strong>{row.done} de {row.assigned}</strong></span>
                                <b>Cumplimiento {row.weighted === null ? "Sin base" : `${Math.round(row.weighted)}%`}</b>
                              </div>;
                            }}
                          />
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
                          >
                            <LabelList
                              dataKey="weighted"
                              position="right"
                              fill="var(--muted)"
                              formatter={(value) => value == null ? "Sin base" : `${Math.round(Number(value))}%`}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      {labOnly && (chartGroups.some((row) => row.weighted === null) || chartGroups.some((row) => row.weighted === 0)) && (
                        <p className="muted analytics-no-base" role="note">
                          {chartGroups.some((row) => row.weighted === null) && <>Sin base de entregables: {chartGroups.filter((row) => row.weighted === null).map((row) => row.name).join(", ")}.</>}
                          {chartGroups.some((row) => row.weighted === 0) && <> {chartGroups.some((row) => row.weighted === null) ? " " : ""}Cumplimiento 0%: {chartGroups.filter((row) => row.weighted === 0).map((row) => row.name).join(", ")}.</>}
                        </p>
                      )}
                    </div>
                    {formulaOpen && (
                      <div className="metric-explainer">
                        <b>Método actual del laboratorio</b>
                        <p>
                          {labOnly ? "El laboratorio separa los indicadores: los entregables aportan puntos al completarse; las operativas informan cantidad, carga versionada y tiempo; la revisión de calidad se conserva como evaluación independiente. La puntualidad considera entregables completados y usa fecha argentina." : "El indicador refleja el cálculo implementado hoy en este entorno. Un entregable aporta su peso al completarse y las operativas mantienen la medición configurada para la cuenta."}
                        </p>
                        <p>
                          Los pesos expresan complejidad relativa; este indicador
                          no sustituye una evaluación del desempeño ni explica
                          por sí solo demoras externas.
                        </p>
                      </div>
                    )}
                  </Panel>
                  <Panel
                    title={labOnly ? "Puntos por entregables" : "Carga asignada y lograda"}
                    sub={labOnly ? "Cumplimiento de entregables; calidad operativa se informa por separado" : "Puntos · comparar el porcentaje junto con la carga"}
                    collapsible
                    defaultOpen={false}
                  >
                    <div className="performance-list">
                      {chartGroups.map((g) => (
                        <div key={g.id}>
                          <div>
                            <b>{g.name}</b>
                            <span>{g.weighted === null ? "Sin base" : `${g.earned.toFixed(1)} / ${g.points} pts`}</span>
                          </div>
                          {g.weighted !== null && <Meter value={g.weighted} />}
                          <small>
                            {g.done}/{g.assigned} entregables · {g.blocked} en espera{labOnly
                              ? ` · Calidad ${g.operationalQuality ?? "sin evaluar"} · Orden ${g.operationalOrder ?? "sin evaluar"} · Oportunidad ${g.operationalTimeliness ?? "sin evaluar"}`
                              : ` · ${g.operationalTarget}/${g.operational} operativas en meta`}
                          </small>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
                <Panel
                  title="Tiempo registrado y reaperturas"
                  sub="Trabajo cronometrado por quien lo realizó. No equivale a presencia ni se usa como penalización automática."
                  collapsible
                  defaultOpen={false}
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
                <div className="dashboard-row analytics-trend-row">
                  <Panel
                    title="Evolución mensual"
                    sub="Últimos seis períodos con trabajo registrado · se respetan los filtros"
                    collapsible
                    defaultOpen
                  >
                    {history.length > 1 ? (
                      <>
                        <div className="chart">
                          <ResponsiveContainer width="100%" height={230}>
                            <LineChart
                              data={history}
                              margin={{ top: 15, right: 25, left: 0, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                              <YAxis domain={historySeries.every((series) => series === "weighted" || series === "onTime") ? [0, 100] : ["auto", "auto"]} tickFormatter={(value) => historySeries[0] === "recordedSeconds" ? duration(Number(value)) : historySeries.every((series) => series === "weighted" || series === "onTime") ? `${value}%` : Number(value).toLocaleString("es-AR")} tick={{ fontSize: 11 }} />
                              <Tooltip
                                labelFormatter={(label) => monthLabel(String(label))}
                                formatter={(value, name) => {
                                  if (value == null) return ["Sin base", name];
                                  const seriesName = String(name);
                                  if (seriesName.includes("Tiempo")) return [duration(Number(value)), name];
                                  if (seriesName.includes("Carga")) return [`${Number(value).toLocaleString("es-AR")} puntos de carga`, name];
                                  return [`${value}%`, name];
                                }}
                              />
                              {historySeries.length > 1 && <Legend />}
                              {historySeries.includes("weighted") && (
                                <Line
                                  dataKey="weighted"
                                  name="Cumplimiento ponderado"
                                  stroke="var(--chart-ink)"
                                  strokeWidth={3}
                                  dot={{ r: 4 }}
                                  connectNulls={false}
                                />
                              )}
                              {historySeries.includes("onTime") && (
                                <Line
                                  dataKey="onTime"
                                  name="Entregas en fecha"
                                  stroke="var(--chart-slice-4)"
                                  strokeDasharray="5 4"
                                  connectNulls={false}
                                />
                              )}
                              {historySeries.includes("operationalLoad") && <Line dataKey="operationalLoad" name="Carga operativa ponderada" stroke="var(--chart-slice-2)" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} />}
                              {historySeries.includes("recordedSeconds") && <Line dataKey="recordedSeconds" name="Tiempo registrado" stroke="var(--chart-slice-5)" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} />}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="analytics-series" data-tour="analytics-series" role="group" aria-label="Series del gráfico de evolución mensual">
                          <button
                            type="button"
                            className={historySeries.includes("weighted") ? "selected" : ""}
                            aria-pressed={historySeries.includes("weighted")}
                            disabled={historySeries.length === 1 && historySeries.includes("weighted")}
                            onClick={() => toggleHistorySeries("weighted")}
                          >
                            <span className="series-dot series-dot-weighted" />Cumplimiento ponderado
                          </button>
                          <button
                            type="button"
                            className={historySeries.includes("onTime") ? "selected" : ""}
                            aria-pressed={historySeries.includes("onTime")}
                            disabled={historySeries.length === 1 && historySeries.includes("onTime")}
                            onClick={() => toggleHistorySeries("onTime")}
                          >
                            <span className="series-dot series-dot-ontime" />Entregas en fecha
                          </button>
                          {labOnly && <button type="button" className={historySeries.includes("operationalLoad") ? "selected" : ""} aria-pressed={historySeries.includes("operationalLoad")} disabled={historySeries.length === 1 && historySeries.includes("operationalLoad")} onClick={() => toggleHistorySeries("operationalLoad")}><span className="series-dot series-dot-load" />Carga operativa</button>}
                          {labOnly && <button type="button" className={historySeries.includes("recordedSeconds") ? "selected" : ""} aria-pressed={historySeries.includes("recordedSeconds")} disabled={historySeries.length === 1 && historySeries.includes("recordedSeconds")} onClick={() => toggleHistorySeries("recordedSeconds")}><span className="series-dot series-dot-time" />Tiempo registrado</button>}
                        </div>
                        {labOnly && history.some((row) => "coverageHistory" in row && row.coverageHistory === "legacy-not-preserved") && <p className="note">Los cierres anteriores a la versión 3 no conservan el detalle de las coberturas. Ese trabajo no se reconstruye desde tareas actuales.</p>}
                      </>
                    ) : (
                      <>
                        <div className="note">
                          Para comparar meses, cerrá al menos dos períodos completos. Los períodos abiertos no se incluyen.
                        </div>
                        <div className="analytics-series" data-tour="analytics-series" role="group" aria-label="Series del gráfico de evolución mensual">
                          <button type="button" className={historySeries.includes("weighted") ? "selected" : ""} aria-pressed={historySeries.includes("weighted")} disabled={historySeries.length === 1 && historySeries.includes("weighted")} onClick={() => toggleHistorySeries("weighted")}><span className="series-dot series-dot-weighted" />Cumplimiento ponderado</button>
                          <button type="button" className={historySeries.includes("onTime") ? "selected" : ""} aria-pressed={historySeries.includes("onTime")} disabled={historySeries.length === 1 && historySeries.includes("onTime")} onClick={() => toggleHistorySeries("onTime")}><span className="series-dot series-dot-ontime" />Entregas en fecha</button>
                          {labOnly && <button type="button" className={historySeries.includes("operationalLoad") ? "selected" : ""} aria-pressed={historySeries.includes("operationalLoad")} disabled={historySeries.length === 1 && historySeries.includes("operationalLoad")} onClick={() => toggleHistorySeries("operationalLoad")}><span className="series-dot series-dot-load" />Carga operativa</button>}
                          {labOnly && <button type="button" className={historySeries.includes("recordedSeconds") ? "selected" : ""} aria-pressed={historySeries.includes("recordedSeconds")} disabled={historySeries.length === 1 && historySeries.includes("recordedSeconds")} onClick={() => toggleHistorySeries("recordedSeconds")}><span className="series-dot series-dot-time" />Tiempo registrado</button>}
                        </div>
                      </>
                    )}
                  </Panel>
                  <Panel
                    title="Distribución de tareas"
                    sub="Cantidad de tareas del filtro actual · no representa puntos ni cumplimiento"
                    collapsible
                    defaultOpen
                  >
                    <div className="analytics-series analytics-distribution-picker" data-tour="analytics-distribution" role="group" aria-label="Distribuir tareas por">
                      {([
                        ["status", "Estado"],
                        ["kind", "Tipo"],
                        ["company", "Empresa"],
                        ["team", "Equipo"],
                      ] as const).map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          className={distributionBy === value ? "selected" : ""}
                          aria-pressed={distributionBy === value}
                          onClick={() => setDistributionBy(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {distributionData.length ? (
                      <div className="chart analytics-pie-chart">
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={distributionData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={42}
                              outerRadius={83}
                              paddingAngle={2}
                              stroke="var(--surface)"
                              strokeWidth={2}
                            >
                              {distributionData.map((entry, index) => (
                                <Cell key={`${entry.name}-${index}`} fill={`var(--chart-slice-${(index % 7) + 1})`} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => [`${value} tareas`, "Cantidad"]} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div data-tour="analytics-distribution-empty"><Empty text="No hay tareas para distribuir con estos filtros." /></div>
                    )}
                  </Panel>
                </div>
                <Panel
                  title="Detalle que explica el indicador"
                  sub="Puntos de entregables, con empresa y responsable. Las operativas se analizan por separado según cantidad, peso y tiempo."
                  collapsible
                  defaultOpen={false}
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
                        {metricTasks.map((t) => (
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
                            <td>{t.status}</td>
                            <td>
                              {metrics([t], state.activity).earned.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
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
              <Workforce state={state} commit={commit} notify={notify} remote={!!remoteSave} laboratory={labOnly} presence={presence} now={tick}/>
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
                            {(labOnly || remoteSave) && personPresence(t.managerId) && <small className={`lab-presence-text ${personPresence(t.managerId)!.online ? "is-online" : "is-offline"}`}>{personPresence(t.managerId)!.label}</small>}
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
                                {(labOnly || remoteSave) && personPresence(p.id) && <small className={`lab-presence-text ${personPresence(p.id)!.online ? "is-online" : "is-offline"}`}>{personPresence(p.id)!.label}</small>}
                              </div>
                              <button
                                data-tour="team-consultation"
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
                  sub={`${people.length} perfiles · ${remoteSave ? 'los permisos se comprueban en el servidor.' : 'ámbitos de la demostración.'}`}
                  collapsible
                  defaultOpen={false}
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
                sub={`${catalogEntries.length} de ${state.templates.length} procesos · el jefe define el peso. Los cambios se aplican a nuevas asignaciones; no reescriben meses anteriores.`}
                collapsible
                defaultOpen
              >
                {active.role === "jefe" && (
                  <CatalogueCreator
                    state={state}
                    commit={commit}
                    notify={notify}
                    versioned={laboratory && !remoteSave}
                  />
                )}
                <div className="catalog-filter-bar">
                  <label><span>Buscar proceso</span><input data-tour="task-catalogue" aria-label="Buscar en el catálogo" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Nombre, descripción, sector o unidad" /></label>
                  <label><span>Tipo</span><select aria-label="Filtrar tipo de proceso" value={catalogKind} onChange={(event) => setCatalogKind(event.target.value as typeof catalogKind)}><option value="all">Todos</option><option value="resultado">Entregables</option><option value="operativa">Operativas</option></select></label>
                  <label><span>Sector</span><select aria-label="Filtrar sector del catálogo" value={catalogSector} onChange={(event) => setCatalogSector(event.target.value)}><option value="">Todos los sectores</option>{[...new Set(state.templates.map((template) => template.sector))].sort((a, b) => a.localeCompare(b, "es")).map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
                  {(catalogSearch || catalogKind !== "all" || catalogSector) && <button type="button" onClick={() => { setCatalogSearch(""); setCatalogKind("all"); setCatalogSector(""); }}>Limpiar filtros</button>}
                </div>
                <div className="catalog-grid">
                  {catalogEntries.map((template) => <CatalogueVersionCard key={template.id} state={state} template={template} actor={active} commit={commit} notify={notify} versioned={laboratory && !remoteSave} />)}
                  {!catalogEntries.length && <Empty text="No hay procesos que coincidan con estos filtros." />}
                </div>
              </Panel>
            )}
            {page === "closing" && active.role === "jefe" && (
              <>
                <div className="notice-banner">
                  <LockKeyhole size={18} />
                  <span>
                    Cada cierre corresponde a una persona, empresa y período.
                    Cuando quedan cerradas todas las empresas con trabajo, se
                    consolida el mes y se bloquean sus cambios {remoteSave?'en el servidor.':'en esta demostración.'}
                  </span>
                </div>
                <PeriodReports state={state} month={month} laboratory={labOnly} />
                {labOnly && <CompanyClosureManager state={state} actor={active} month={month} commit={commit} companyOf={companyOf} nameOf={nameOf} teamName={teamName} notify={notify} />}
                {!labOnly && <Panel
                  title={`Cierre de ${monthLabel(month)}`}
                  sub="Cada persona tiene su propia consolidación"
                  collapsible
                  defaultOpen
                >
                  <div className="table-wrap" data-tour="monthly-close-basic">
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
                                          closureCsvRows(c, companyOf, (item) => active.role === "jefe" || active.id === item.executorId || canSee(active, item.originalOwnerId, state.profiles)),
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
                </Panel>}
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
        <div className="tour-backdrop" aria-hidden="true" />
      )}
      {tourOpen && (
        <div
          className="tour-coach"
          role="dialog"
          aria-modal="true"
          aria-label="Recorrido guiado"
          ref={tourDialog}
          style={tourPosition ? { top: tourPosition.top, left: tourPosition.left } : undefined}
        >
          <small>
            RECORRIDO · {tourStep + 1}/{tours.length}
          </small>
          <h3>{tours[tourStep].title}</h3>
          <p>{tours[tourStep].text}{tourFallback ? " Se muestra el bloque equivalente disponible en esta modalidad; el recorrido no crea datos de ejemplo." : !tourPosition ? " El contenido de esta sección todavía no está disponible; podés continuar." : ""}</p>
          {tourResetNotice && <p role="status">El recorrido se actualizó y comienza de nuevo. Tus otros datos siguen guardados.</p>}
          <div>
            <button
              disabled={tourStep === 0}
              onClick={() => {
                const previous = Math.max(0, tourStep - 1);
                if (commit({ ...state, tour: { ...state.tour, [active.id]: previous }, tourStepId: { ...state.tourStepId, [active.id]: tours[previous]?.id || "__complete__" }, tourVersion: { ...state.tourVersion, [active.id]: TOUR_VERSION } })) {
                  setPage(tours[previous].page);
                  if (previous === 0) requestAnimationFrame(() => tourPrimaryRef.current?.focus());
                }
              }}
            >Anterior</button>
            <button onClick={() => setTourOpen(false)}>Pausar</button>
            <button
              ref={tourPrimaryRef}
              className="primary"
              onClick={() => {
                if (tourStep === tours.length - 1) {
                  if (
                    commit({
                      ...state,
                      tour: { ...state.tour, [active.id]: tours.length },
                      tourStepId: { ...state.tourStepId, [active.id]: "__complete__" },
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
                  tourStepId: { ...state.tourStepId, [active.id]: tours[tourStep + 1]!.id },
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
          laboratory={labOnly}
          month={month}
          company={company}
          owner={noteToTask || requestToTask ? active.id : isOwnBoardPage ? viewedOwner : owner || active.id}
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
              if (labOnly && a.kind === "operativa") a.target = 0;
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
            if (!converting && active.role !== "jefe" && (a.frequency !== "única" || effectiveSchedule.frequency !== "única")) {
              notify("Sólo jefatura puede definir recurrencias. Elegí una tarea de una sola vez.");
              return;
            }
            const targetPeriod = converting
              ? effectiveSchedule.startDate.slice(0, 7)
              : month;
            const responsible = state.profiles.find((p) => p.id === a.ownerId);
            if (
              !responsible?.active ||
              !responsible.teamId ||
              !state.teams.some((team) => team.id === responsible.teamId) ||
              !responsible.companyIds.includes(a.companyId) ||
              !(labOnly ? canAssignLabTask(state, active, a.ownerId, a.companyId) : canSee(active, a.ownerId, state.profiles))
            ) {
              notify("Empresa o responsable fuera del ámbito autorizado.");
              return;
            }
            if (isLabCompanyClosed(state, a.ownerId, a.companyId, targetPeriod)) {
              notify(`La unidad ${companyOf(a.companyId)} · ${targetPeriod} de esa persona está cerrada.`);
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
        <Suspense fallback={<div className="section-loading" role="status">Cargando detalle de tarea…</div>}>
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
          {(!labOnly || tasksForDetail.kind !== "operativa") && <TimelinessBadge value={taskTimeliness(tasksForDetail, state.activity, new Date().toISOString())} />}
          {laboratory && <JointTaskSetup state={state} task={tasksForDetail} actor={active} commit={commit} notify={notify} laboratory={labOnly} />}
          {labOnly && tasksForDetail.kind === "resultado" && <CommercialProgressPanel state={state} task={tasksForDetail} actor={active} commit={commit} notify={notify} canUpdate={canExecute(tasksForDetail)} canComplete={canExecute(tasksForDetail) && tasksForDetail.checklist.every((check) => check.done)} onComplete={() => advance(tasksForDetail, true)} />}
          {labOnly && active.role === "jefe" && tasksForDetail.kind === "resultado" && !taskLocked(tasksForDetail) && <TaskReadinessPanel state={state} task={tasksForDetail} actor={active} commit={commit} notify={notify} />}
          {labOnly && <TaskSchedulePanel key={`schedule-${tasksForDetail.id}`} state={state} task={tasksForDetail} actor={active} commit={commit} notify={notify} />}
          {labOnly && tasksForDetail.kind === "resultado" && <TaskEvidencePanel state={state} task={tasksForDetail} actor={active} commitLatest={commitLatestWithResult} notify={notify} canAdd={canExecute(tasksForDetail) && !taskLocked(tasksForDetail)} />}
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
                taskLocked(tasksForDetail) || !canExecute(tasksForDetail) ||
                tasksForDetail.status === "Completada" ||
                (!tasksForDetail.sessions?.some((e) => !e.end && e.actorId === active.id) &&
                  !taskReadiness(state, tasksForDetail, undefined, active).ready)
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
                    disabled={taskLocked(tasksForDetail) || !canExecute(tasksForDetail) || !taskReadiness(state, tasksForDetail, undefined, active).ready}
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
                    taskLocked(tasksForDetail) || !canExecute(tasksForDetail) ||
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
                  disabled={taskLocked(tasksForDetail) || !canExecute(tasksForDetail) || !taskReadiness(state, tasksForDetail, undefined, active).ready}
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
              {labOnly
                ? <h3>{taskQuantity(tasksForDetail, state.activity)} {tasksForDetail.unit || "movimientos"} registrados</h3>
                : <><h3>{taskQuantity(tasksForDetail, state.activity)} / {tasksForDetail.target} {tasksForDetail.unit}</h3><Meter value={(taskQuantity(tasksForDetail, state.activity) / tasksForDetail.target) * 100} /></>}
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
                      {labOnly && <EvidenceLinks records={(state.taskEvidence || []).filter((evidence) => evidence.activityId === a.id)} />}
                    </div>
                  ))}
              </div>
              <button
                className="primary"
                disabled={taskLocked(tasksForDetail) || !canExecute(tasksForDetail)}
                onClick={() => setLogFor(tasksForDetail.id)}
              >
                Registrar actividad
              </button>
            </>
          )}
          {laboratory && <TaskComments key={`comments-${tasksForDetail.id}`} state={state} taskId={tasksForDetail.id} commit={commit} notify={notify} />}
          {active.role === "jefe" && !taskLocked(tasksForDetail) && (
            <details>
              <summary>Configuración del jefe · este período</summary>
              <label>
                Peso
                <select
                  value={tasksForDetail.weight}
                  onChange={(e) => {
                    if (!labOnly) {
                      mutateTask(tasksForDetail, (task) => ({ ...task, weight: Number(e.target.value) }), "Ajustó peso del período");
                      return;
                    }
                    try {
                      commit(updateTaskWeight(state, tasksForDetail.id, Number(e.target.value), active.id), "Ajustó peso del período", tasksForDetail.id);
                    } catch (error) {
                      notify(error instanceof Error ? error.message : "No se pudo ajustar el peso.");
                    }
                  }}
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
        </Suspense>
      )}
      {logTask && (
        <Dialog title="Registrar actividad" onClose={() => setLogFor(null)}>
          <p>
            <b>{logTask.title}</b> · {companyOf(logTask.companyId)} ·{" "}
            {nameOf(logTask.ownerId)}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (activitySubmitLock.current) return;
              activitySubmitLock.current = true;
              setActivitySaving(true);
              let activityOutcome: CommitOutcome | null = null;
              let evidence: TaskEvidence[] = [];
              let releaseEvidenceLock: (() => void) | null = null;
              try {
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
              if (taskLocked(logTask) || !canExecute(logTask)) {
                notify(taskLocked(logTask) ? "La unidad empresa/persona está cerrada." : "Sólo el responsable o la cobertura autorizada puede registrar movimientos.");
                return;
              }
              if (labOnly && logTask.responsibility && logTask.kind === "operativa") { notify("No se habilitan nuevas operativas conjuntas en esta versión."); return; }
              const activityId = id();
              const files = labOnly ? (f.getAll("evidenceFiles") as File[]).filter((file) => file.size > 0) : [];
              try {
                if (files.length) {
                  const evidenceStorage = await import("./data/laboratoryEvidence");
                  releaseEvidenceLock = await evidenceStorage.acquireEvidenceMutationLock();
                  if (!isLaboratoryStateCurrent(latestStateRef.current) || !await evidenceStorage.reconcileEvidenceAgainstDurableState(latestStateRef.current)) {
                    notify("El laboratorio cambió en otra pestaña. Recargá la página antes de registrar la actividad.");
                    return;
                  }
                  evidence = await evidenceStorage.storeTaskEvidence(files, { taskId: logTask.id, activityId, profileId: active.id }, 0);
                }
              } catch (error) {
                notify(error instanceof Error ? error.message : "No se pudo guardar la evidencia.");
                return;
              }
              activityOutcome = commitLatestWithResult((current) => {
                const currentActor = current.profiles.find((profile) => profile.id === active.id);
                const currentTask = current.tasks.find((task) => task.id === logTask.id);
                if (current.activeId !== active.id || !currentActor?.active || !currentTask || currentTask.month !== logTask.month ||
                  date < `${currentTask.month}-01` || !date.startsWith(currentTask.month) || date > dateART() ||
                  (labOnly && (isLabTaskLocked(current, currentTask) || !canExecuteLab(current, currentActor, currentTask, date))) ||
                  evidence.some((row) => row.taskId !== currentTask.id || row.activityId !== activityId || row.profileId !== active.id) ||
                  evidence.some((row) => (current.taskEvidence || []).some((existingRow) => existingRow.id === row.id))) return null;
                if (labOnly && currentTask.responsibility && currentTask.kind === "operativa") return null;
                const snapshots = labOnly ? activitySnapshotsForLog(current, currentTask, date) : {};
                return {
                  ...current,
                  activity: [...current.activity, {
                    id: activityId,
                    taskId: currentTask.id,
                    qty,
                    date,
                    note: String(f.get("note")).trim(),
                    actorId: active.id,
                    createdAt: new Date().toISOString(),
                    ...(evidence.length ? { evidenceIds: evidence.map((row) => row.id) } : {}),
                    ...snapshots,
                  }],
                  taskEvidence: [...(current.taskEvidence || []), ...evidence],
                };
              }, "Registró actividad", logTask.id);
              if (activityOutcome.status === "committed") {
                setLogFor(null);
                notify(
                  evidence.length ? "Actividad y evidencia guardadas. Los indicadores se actualizaron." : "Actividad registrada. Los indicadores se actualizaron.",
                );
              } else if (activityOutcome.status === "rejected" && evidence.length) {
                const evidenceStorage = await import("./data/laboratoryEvidence");
                try {
                  await evidenceStorage.removeStoredEvidence(evidence.map((row) => row.id));
                  if (activityOutcome.reason === "preparation")
                    notify("No se pudo preparar la actividad. El archivo temporal se retiró y no quedó adjuntado. Podés volver a intentar.");
                  else if (activityOutcome.reason !== "storage")
                    notify("El usuario, el permiso o el estado de la tarea cambió durante la carga. La actividad y sus archivos no se guardaron.");
                } catch {
                  try {
                    await evidenceStorage.reconcileEvidenceFromDurableState();
                    notify("La actividad no se guardó. El archivo temporal quedó conservado para recuperación, pero ya no ocupa el cupo de adjuntos.");
                  } catch {
                    notify("La actividad no se guardó. El archivo temporal quedó conservado para recuperación; no se pudo actualizar su cupo local.");
                  }
                }
              } else if (activityOutcome.status === "rejected") {
                notify("El usuario, el permiso o el estado de la tarea cambió. No se registró la actividad.");
              } else {
                notify("No se pudo confirmar si la actividad quedó guardada. Los archivos se conservaron; revisá el historial antes de reintentar.");
              }
              } catch (error) {
                notify(evidence.length && activityOutcome === null
                  ? "No se pudo determinar si la actividad quedó guardada. Los archivos se conservaron; revisá el historial antes de reintentar."
                  : activityOutcome?.status === "committed" ? "La actividad quedó registrada, pero falló la confirmación visual. Revisá el historial antes de reintentar." : activityOutcome?.status === "unknown" ? "No se pudo confirmar si la actividad quedó guardada. Los archivos se conservaron; revisá el historial antes de reintentar." : error instanceof Error ? `No se pudo confirmar el registro: ${error.message}` : "No se pudo confirmar el registro.");
              } finally {
                releaseEvidenceLock?.();
                activitySubmitLock.current = false;
                setActivitySaving(false);
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
              Detalle / referencia (opcional, sugerido)
              <textarea
                name="note"
                maxLength={500}
                placeholder="Ej. Lote de facturas de proveedores del 30/09"
              />
            </label>
            {labOnly && <label className="lab-evidence-upload">Evidencia opcional · hasta 3 archivos<input name="evidenceFiles" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple /><small>Imágenes de hasta 5 MB y PDF de hasta 10 MB; se guardan en este navegador.</small></label>}
            <div className="modal-actions">
              <button className="primary" disabled={activitySaving} aria-busy={activitySaving}>{activitySaving ? "Guardando…" : "Guardar registro"}</button>
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
                    remoteSave ? "Mes consolidado y reporte guardado para jefatura." : "Mes consolidado y reporte emitido para jefatura en esta demostración.",
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
      {quickTaskSearchOpen && (
        <QuickTaskSearch
          state={state}
          active={active}
          laboratory={labOnly}
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
  laboratory,
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
  laboratory: boolean;
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
  const [parisTaskCode, setParisTaskCode] = useState("");
  const [businessUnitCode, setBusinessUnitCode] = useState<ParisBusinessUnitCode | "">("");
  const [taskParameters, setTaskParameters] = useState<Record<string, string>>({});
  const assignablePeople = people.filter((profile) =>
    !!profile.teamId && state.teams.some((team) => team.id === profile.teamId),
  );
  const initialOwner = assignablePeople.some((profile) => profile.id === owner)
    ? owner
    : assignablePeople[0]?.id || "";
  const [selectedOwner, setSelectedOwner] = useState(initialOwner);
  const [selectedCompany, setSelectedCompany] = useState(() => {
    const selectedProfile = state.profiles.find((profile) => profile.id === initialOwner);
    const allowed = state.companies.filter((candidate) => selectedProfile?.companyIds.includes(candidate.id) &&
      (active.role === "jefe" || active.companyIds.includes(candidate.id)));
    return allowed.some((candidate) => candidate.id === company) ? company : allowed[0]?.id || "";
  });
  const [companyScopeRevoked, setCompanyScopeRevoked] = useState(false);
  const [steps, setSteps] = useState<string[]>(() => seedAnnotation ? parseSteps(seedAnnotation.content) : []);
  const [schedule, setSchedule] = useState<Schedule>(() =>
    defaultSchedule(seedAnnotation?.reminderOn || month + "-25"),
  );
  const [scheduleError, setScheduleError] = useState("");
  const [taskError, setTaskError] = useState("");
  const [kind, setKind] = useState<"resultado" | "operativa">("resultado");
  const t = state.templates.find((t) => t.id === template);
  const parisTask = laboratory ? selectableParisTasks().find((task) => task.code === parisTaskCode) : undefined;
  const parisTaskKind = parisTask?.kind === "operational" ? "operativa" : parisTask ? "resultado" : undefined;
  const selectedOwnerProfile = state.profiles.find((profile) => profile.id === selectedOwner);
  const allowedCompanies = state.companies.filter((candidate) => selectedOwnerProfile?.companyIds.includes(candidate.id) &&
    (active.role === "jefe" || active.companyIds.includes(candidate.id)));
  const selectedCompanyAvailable = allowedCompanies.some((candidate) => candidate.id === selectedCompany);
  useEffect(() => {
    if (selectedCompany && !selectedCompanyAvailable) {
      setSelectedCompany("");
      setCompanyScopeRevoked(true);
    }
  }, [selectedCompany, selectedCompanyAvailable]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = laboratory ? parisTask?.label || "" : String(f.get("title")).trim();
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
    if (laboratory && (!parisTask || !businessUnitCode)) {
      setTaskError("Elegí una tarea y una unidad de negocio del catálogo para clasificarla.");
      return;
    }
    if (laboratory && parisTask && !hasRequiredParisTaskParameters(parisTask.code, taskParameters)) {
      setTaskError("Completá los datos obligatorios para identificar esta tarea.");
      return;
    }
    const selectedKind = laboratory && parisTaskKind ? parisTaskKind : t?.kind || kind;
    let checklist: string[] = [];
    let target = 0;
    try {
      if (selectedKind === "resultado")
        checklist = validateSteps(t?.steps || parseSteps(String(f.get("steps") || "")));
      if (selectedKind === "operativa") {
        target = laboratory ? 0 : Number(f.get("target") || t?.target || 0);
        if (!laboratory && (!Number.isSafeInteger(target) || target < 1 || target > 1000000))
          throw Error("La meta debe ser un número entero entre 1 y 1.000.000.");
      }
    } catch (e) {
      setTaskError((e as Error).message);
      return;
    }
    if (!selectedCompany || !selectedCompanyAvailable) {
      setTaskError("Empresa o responsable fuera del ámbito autorizado. Elegí una empresa vigente para continuar.");
      return;
    }
    setScheduleError("");
    setTaskError("");
    create({
      schedule,
      id: id(),
      templateId: template || null,
      title,
      ownerId: selectedOwner,
      companyId: selectedCompany,
      sector: laboratory && parisTask ? parisTask.group : t?.sector || String(f.get("sector") || active.sector),
      kind: selectedKind,
      weight: t?.weight || (active.role === "jefe" ? Number(f.get("weight") || 0) : 1),
      unit: selectedKind === "operativa" ? (laboratory && parisTask ? parisTask.unit || "" : t?.unit || String(f.get("unit") || "").trim()) : "",
      target: selectedKind === "operativa" ? target : 0,
      ...(laboratory && parisTask ? {
        taskCode: parisTask.code,
        taskCatalogVersion: PARIS_TASK_CATALOG_VERSION,
        businessUnitCode: businessUnitCode as ParisBusinessUnitCode,
        taskParameters: Object.fromEntries(Object.entries(taskParameters).filter(([, value]) => value.trim())),
      } : {}),
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
      {laboratory ? <div className="form-grid">
        <label>
          Tarea estandarizada
          <select aria-label="Elegí del catálogo" value={parisTaskCode} onChange={(event) => {
            setParisTaskCode(event.target.value);
            setTaskParameters({});
            setTaskError("");
          }} required>
            <option value="">Seleccioná una tarea</option>
            {selectableParisTasks().map((task) => <option key={task.code} value={task.code}>{task.label}</option>)}
          </select>
        </label>
        <label>
          Unidad de negocio
          <select aria-label="Unidad de negocio" value={businessUnitCode} onChange={(event) => setBusinessUnitCode(event.target.value as ParisBusinessUnitCode | "")} required>
            <option value="">Seleccioná una unidad</option>
            {PARIS_BUSINESS_UNITS.map((unit) => <option key={unit.code} value={unit.code}>{unit.label}</option>)}
          </select>
        </label>
        {parisTask && <ParisTaskParameterFields taskCode={parisTask.code} version={PARIS_TASK_CATALOG_VERSION} values={taskParameters} onChange={(values) => { setTaskParameters(values); setTaskError(""); }} />}
        {parisTask && <p className="note">La tarea se guardará como <b>{parisTask.label}</b>{parisTask.unit ? <> · Unidad de registro: <b>{parisTask.unit}</b></> : null}. El detalle de pedido o anotación queda como contexto y no cambia el nombre canónico.</p>}
      </div> : <label>
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
      </label>}
      {seedRequest && <div className="request-origin-context"><b>Conversión explícita del pedido · {seedRequest.subject}</b><p>{seedRequest.description}</p><span>La conversión crea una sola tarea y cierra el pedido al confirmar. No hay asignaciones hasta guardar.</span></div>}
      <form key={template} onSubmit={submit}>
        {laboratory ? <p><b>Tarea:</b> {parisTask?.label || "Seleccioná una tarea estandarizada"}</p> : <label>
          Título
          <input
            name="title"
            required
            maxLength={120}
            defaultValue={t?.title || seedAnnotation?.title || seedRequest?.subject}
            readOnly={!!t}
          />
        </label>}
        <div className="form-grid">
          <div>
            <label>
              Empresa obligatoria
              <select
                name="company"
                value={selectedCompany}
                aria-describedby={companyScopeRevoked ? "new-task-company-revoked" : undefined}
                onChange={(event) => {
                  setSelectedCompany(event.target.value);
                  setCompanyScopeRevoked(false);
                }}
                required
              >
                <option value="" disabled>
                  Seleccioná una empresa
                </option>
                {allowedCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {companyScopeRevoked && !selectedCompany && <small id="new-task-company-revoked" className="field-note">La empresa seleccionada dejó de estar autorizada. Elegí una empresa vigente para continuar.</small>}
          </div>
          <label>
            Responsable
            <select name="owner" value={selectedOwner} onChange={(event) => {
              const nextOwner = event.target.value;
              const nextProfile = state.profiles.find((profile) => profile.id === nextOwner);
              const nextAllowed = state.companies.filter((candidate) => nextProfile?.companyIds.includes(candidate.id) &&
                (active.role === "jefe" || active.companyIds.includes(candidate.id)));
              setSelectedOwner(nextOwner);
              if (!nextAllowed.some((candidate) => candidate.id === selectedCompany)) setSelectedCompany(nextAllowed[0]?.id || "");
            }} required>
              {!assignablePeople.length && <option value="">No hay personas con equipo disponible</option>}
              {assignablePeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {!laboratory && <label>
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
          </label>}
          {!laboratory && <label>
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
          </label>}
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
          {!laboratory && kind === "operativa" && (
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
              {!laboratory && <label>
                Meta por ocurrencia
                <input name="target" type="number" min="1" max="1000000" required defaultValue={t?.target || 50} />
              </label>}
            </>
          )}
        </div>
        <ScheduleEditor
          value={schedule}
          onChange={(next) => { setSchedule(next); setScheduleError(""); }}
          month={month}
          onlyOnce={active.role !== "jefe" || !!seedAnnotation || !!seedRequest || !t}
        />
        {scheduleError && <p role="alert">{scheduleError}</p>}
        {((!laboratory && kind === "resultado") || (laboratory && parisTask?.kind === "deliverable")) && (
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
        {taskError && (laboratory ? parisTask?.kind === "operational" : kind !== "resultado") && <p className="step-list-error" role="alert">{taskError}</p>}
        <div className="note">
          {seedRequest ? "Se creará una sola tarea para el período de la fecha elegida, con el peso definido por jefatura." : `Se crea una instancia para ${monthLabel(month)}. Dos empresas conservan estados e indicadores independientes.`}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={!selectedOwnerProfile || !allowedCompanies.some((candidate) => candidate.id === selectedCompany)}>
            Crear tarea <Plus size={15} />
          </button>
        </div>
      </form>
    </Dialog>
  );
}
