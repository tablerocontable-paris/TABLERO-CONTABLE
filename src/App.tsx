import Planning from "./components/Planning";
import ThemeControl from "./components/ThemeControl";
import ScheduleEditor from "./components/ScheduleEditor";
import { Absences, Workforce } from "./components/Workforce";
import {
  defaultSchedule,
  validateSchedule,
  describeSchedule,
  type Schedule,
} from "./domain/schedule";
import {
  startClock,
  stopClock,
  elapsedSeconds,
  duration,
  applyClock,
  canWork,
  coverageFor,
} from "./domain/workforce";
import { enterLab, exitLab, isLab } from "./data/repository";
import { useState, useEffect, type FormEvent } from "react";
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
  GitBranch,
  RotateCcw,
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
  type Status,
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
import Onboarding from "./components/Onboarding";
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
  | "planning";
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
  { id: "planning", name: "Planificación", icon: CalendarDays },
  { id: "absences", name: "Ausencias y cobertura", icon: CalendarDays },
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
export default function App() {
  const [laboratory] = useState(isLab);
  const [state, setState] = useState<State>(() => load(laboratory));
  const [tick, setTick] = useState(Date.now());
  const hasRunningClock = state.tasks.some((t) =>
    t.sessions?.some((e) => !e.end),
  );
  useEffect(() => {
    if (!hasRunningClock) return;
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasRunningClock]);
  const [page, setPage] = useState<Page>(() =>
    state.activeId === "boss"
      ? "overview"
      : state.onboarding[state.activeId]?.home || "day",
  );
  const [month, setMonth] = useState(currentMonth);
  const [company, setCompany] = useState("");
  const [owner, setOwner] = useState("");
  const [sector, setSector] = useState("");
  const [team, setTeam] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"board" | "list">("board");
  const [group, setGroup] = useState<"individual" | "team" | "sector">(
    "individual",
  );
  const [modal, setModal] = useState<"new" | "employee" | "close" | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
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
  function notify(s: string) {
    setNotice(s);
  }
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
  useEffect(() => {
    const next = materialize(state, month);
    if (next.tasks.length !== state.tasks.length) commit(next);
  }, [month]);
  const monthTasks = state.tasks.filter(
    (t) => t.month === month && canWork(state, active, t),
  );
  const filtered = monthTasks.filter(
    (t) =>
      (!company || t.companyId === company) &&
      (!owner || t.ownerId === owner) &&
      (!sector || t.sector === sector) &&
      (!team || t.teamId === team) &&
      (!query ||
        `${t.title} ${nameOf(t.ownerId)} ${companyOf(t.companyId)}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const m = metrics(filtered, state.activity);
  const resultTasks = filtered.filter((t) => t.kind === "resultado");
  const operations = filtered.filter((t) => t.kind === "operativa");
  function changeProfile(pid: string) {
    if (commit({ ...state, activeId: pid })) {
      setOwner("");
      setCompany("");
      setTeam("");
      setSector("");
      setPage(state.onboarding[pid]?.home || "day");
      setPaused(false);
      setTourOpen(false);
    }
  }
  function mutateTask(t: Task, fn: (t: Task) => Task, action: string) {
    try {
      if (!canWork(state, active, t))
        throw Error("Esta tarea está fuera de tu ámbito.");
      if (isClosed(state, t))
        throw Error("El mes está cerrado y conserva su historial.");
      let next = fn(t);
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
                ? stopClock(x)
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
    } catch (e) {
      notify((e as Error).message);
      return;
    }
    const assignments: Assignment[] = [];
    for (const cid of draft.selectedCompanyIds) {
      for (const tid of draft.selectedTemplateIds) {
        const t = state.templates.find((t) => t.id === tid)!;
        assignments.push({
          id: `onboard-${active.id}-${cid}-${tid}`,
          templateId: tid,
          title: t.title,
          ownerId: active.id,
          companyId: cid,
          sector: t.sector,
          kind: t.kind,
          weight: t.weight,
          unit: t.unit,
          target: t.target,
          day: draft.day,
          frequency: draft.frequency,
          steps: t.steps,
          startMonth: month,
          schedule: draft.schedules?.[tid] || defaultSchedule(month + "-25"),
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
      for (const c of custom)
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
          target: c.target,
          day: draft.day,
          frequency: draft.frequency,
          steps: c.steps
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          startMonth: month,
          schedule: draft.schedules?.[c.id] || defaultSchedule(month + "-25"),
          priority: "Media",
        });
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
      onboarding: {
        ...state.onboarding,
        [active.id]: {
          ...draft,
          completedAt: new Date().toISOString(),
          step: 5,
        },
      },
    };
    next = materialize(next, month);
    if (commit(next, "Completó inducción", active.id)) {
      setInduct(false);
      setPage(draft.home);
      setOwner(active.id);
      setTourOpen(true);
    }
  }
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
          Volver a otra vista de demostración
          <select
            aria-label="Vista de usuario"
            value={active.id}
            onChange={(e) => changeProfile(e.target.value)}
          >
            {state.profiles.map((p) => (
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
      <Onboarding
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
        pause={() => {
          setInduct(false);
          setPaused(true);
        }}
      />
    );
  const chartGroups = (
    group === "individual"
      ? people.map((p) => ({ id: p.id, name: p.name }))
      : group === "team"
        ? state.teams
        : [...new Set(filtered.map((t) => t.sector))].map((s) => ({
            id: s,
            name: s,
          }))
  )
    .map((g) => {
      const ts = filtered.filter((t) =>
        group === "individual"
          ? t.ownerId === g.id
          : group === "team"
            ? t.teamId === g.id
            : t.sector === g.id,
      );
      const x = metrics(ts, state.activity);
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
          canSee(active, t.ownerId, state.profiles) &&
          (!company || t.companyId === company) &&
          (!owner || t.ownerId === owner) &&
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
    return (
      <article
        className={"task-card " + (t.status === "Completada" ? "done" : "")}
        key={t.id}
      >
        <div className="card-top">
          <span className="company-tag">
            <Building2 size={11} />
            {companyOf(t.companyId)}
          </span>
          <b>{t.weight} pts</b>
        </div>
        <button className="card-title" onClick={() => setDetail(t.id)}>
          {t.title}
        </button>
        <p>
          {nameOf(t.ownerId)}
          {coverageFor(state, t)?.replacementId && (
            <small>
              {" "}
              · cubre {nameOf(coverageFor(state, t)!.replacementId)}
            </small>
          )}
        </p>
        {t.scheduledOn && <small>Realización: {fmt(t.scheduledOn)}</small>}
        <div className="timer-mini">
          {t.sessions?.length ? (
            <span>
              ◷ {duration(elapsedSeconds(t, new Date(tick).toISOString()))}
            </span>
          ) : (
            <span>Sin tiempo registrado</span>
          )}
          {t.status === "En curso" && !closed && !t.blockedBy && (
            <button
              aria-label={
                t.sessions?.some((e) => !e.end)
                  ? "Pausar cronómetro"
                  : "Reanudar cronómetro"
              }
              onClick={() => clock(t, !t.sessions?.some((e) => !e.end))}
            >
              {t.sessions?.some((e) => !e.end) ? "Pausar" : "Cronometrar"}
            </button>
          )}
        </div>
        {t.blockedBy && <span className="wait">Espera a {t.blockedBy}</span>}
        <div className="card-progress">
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
                <td>{fmt(t.due)}</td>
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
  const tasksForDetail = state.tasks.find((t) => t.id === detail);
  const logTask = state.tasks.find((t) => t.id === logFor);
  const tours = [
    {
      selector: '[data-nav="day"]',
      title: "Tu punto de partida",
      text: "Mi día reúne tus prioridades y vencimientos.",
    },
    {
      selector: ".filters",
      title: "Elegí el ambiente",
      text: "Cambiá de empresa o miralas todas juntas. Cada tarea mantiene su identidad.",
    },
    {
      selector: '[data-nav="tasks"]',
      title: "El trabajo avanza con vos",
      text: "Iniciar mueve la tarjeta a En curso. Al completar el último paso, pasa a Completada.",
    },
    {
      selector: '[data-nav="operations"]',
      title: "Registrá lo que hiciste",
      text: "Las operativas acumulan cantidades por fecha y empresa.",
    },
    ...(manager
      ? [
          {
            selector: '[data-nav="analytics"]',
            title: "Mirá el contexto completo",
            text: "Compará puntos, puntualidad y metas por persona, equipo o sector.",
          },
        ]
      : []),
  ];
  const tourStep = Math.min(state.tour[active.id] || 0, tours.length - 1);
  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo-grupo-paris.svg" alt="Grupo París" />
          <span>ESPACIO CONTABLE</span>
        </div>
        <div className="workspace">
          <Building2 size={18} />
          <div>
            Grupo París<small>4 empresas · un equipo</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-label">TU ESPACIO DE TRABAJO</span>
        <nav>
          {pages
            .filter((p) => manager || !["overview", "catalog"].includes(p.id))
            .map((p) => (
              <button
                data-nav={p.id}
                key={p.id}
                className={
                  (page === p.id ? "active " : "") +
                  (tourOpen &&
                  tours[tourStep].selector === `[data-nav="${p.id}"]`
                    ? "spotlight"
                    : "")
                }
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
          <button onClick={() => (laboratory ? exitLab() : enterLab(state))}>
            {laboratory ? "Salir del laboratorio" : "Laboratorio de pruebas"}
          </button>
          <button
            onClick={() => {
              commit({ ...state, tour: { ...state.tour, [active.id]: 0 } });
              setTourOpen(true);
            }}
          >
            <HelpCircle size={16} />
            Recorrido guiado
          </button>
          <div className="demo-indicator">
            <i />
            DEMOSTRACIÓN INTERACTIVA
          </div>
          <label>
            Vista de usuario · simulación
            <select
              aria-label="Vista de usuario"
              value={active.id}
              onChange={(e) => changeProfile(e.target.value)}
            >
              {state.profiles
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.role}
                  </option>
                ))}
            </select>
          </label>
          <div className="user">
            <span className="avatar">{ini(active.name)}</span>
            <div>
              {active.name}
              <small>{active.role} · datos locales</small>
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
            <ThemeControl />
            <span className="version">Nueva generación · 0.4</span>
            <span className="avatar">{ini(active.name)}</span>
          </div>
        </header>
        <div className="content">
          {laboratory && (
            <div className="lab-banner">
              <b>LABORATORIO TÉCNICO · copia aislada</b>
              <span>
                Podés probar todos los perfiles. Los cambios y KPI de este
                entorno no afectan el tablero principal.
              </span>
              <button onClick={exitLab}>Volver al tablero</button>
            </div>
          )}
          {state.tasks
            .filter((t) =>
              t.sessions?.some((e) => !e.end && e.actorId === active.id),
            )
            .map((t) => (
              <div className="active-clock" key={t.id}>
                <span>
                  ◷ {t.title} ·{" "}
                  {duration(elapsedSeconds(t, new Date(tick).toISOString()))}
                </span>
                <button onClick={() => clock(t, false)}>
                  Pausar cronómetro
                </button>
              </div>
            ))}
          {offline && (
            <div role="status" className="notice-banner">
              Estás sin conexión. Esta demostración guarda en el navegador; no
              sincroniza con otros usuarios.
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
                  ? "Todo el equipo, en perspectiva."
                  : page === "day"
                    ? `Buen día, ${active.name.split(" ")[0]}.`
                    : page === "tasks"
                      ? "El trabajo avanza con vos."
                      : page === "operations"
                        ? "Cada jornada deja su huella."
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
                                    : "Lo próximo, a la vista."}
              </h1>
              <p>
                {page === "operations"
                  ? "Facturas, trámites y pagos: cantidades, referencias y metas por mes."
                  : page === "analytics"
                    ? "Pesos definidos por el jefe. Resultados explicables, con el detalle detrás de cada número."
                    : page === "team"
                      ? "La relación jefe → encargado → empleado define el ámbito de trabajo."
                      : page === "closing"
                        ? "Consolidá el trabajo mensual de cada persona y conservá una foto del resultado."
                        : "Tus empresas, tus prioridades y el contexto que necesitás para decidir."}
              </p>
            </div>
            <button className="primary" onClick={() => setModal("new")}>
              <Plus size={17} />
              Nueva tarea
            </button>
          </div>
          <div
            className={
              "filters " + (tourOpen && tourStep === 1 ? "spotlight" : "")
            }
          >
            <label className="company-filter">
              <span>AMBIENTE DE TRABAJO</span>
              <select
                aria-label="Empresa"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              >
                <option value="">Todas las empresas</option>
                {state.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
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
                  {t.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Empleado"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="">
                {manager ? "Todo mi ámbito" : "Mis tareas"}
              </option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
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
          </div>
          <div className="view-content" key={page}>
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
                <div className="dashboard-row">
                  <Panel
                    title="Avance ponderado del equipo"
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
                            tickFormatter={(s) => s.split(" ")[0]}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Bar
                            dataKey="earned"
                            name="Puntos logrados"
                            stackId="a"
                            fill="var(--chart-ink)"
                          />
                          <Bar
                            dataKey="pendingPoints"
                            name="Puntos pendientes"
                            stackId="a"
                            fill="#dddfe4"
                            radius={[4, 4, 0, 0]}
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
                      ? "Tu próxima acción"
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
                        (page !== "day" || t.ownerId === active.id),
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
                    (page !== "day" || t.ownerId === active.id),
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
                {view === "list" ? (
                  <Panel
                    title="Entregables"
                    sub="Una instancia independiente por empresa y mes"
                  >
                    {table(resultTasks)}
                  </Panel>
                ) : (
                  <div className="kanban">
                    {(["Pendiente", "En curso", "Completada"] as Status[]).map(
                      (s) => (
                        <section className="column" key={s}>
                          <h2>
                            <span
                              className={
                                "dot " + (s === "Completada" ? "green" : "")
                              }
                            />
                            {s}
                            <b>
                              {resultTasks.filter((t) => t.status === s).length}
                            </b>
                          </h2>
                          {resultTasks
                            .filter((t) => t.status === s)
                            .map(taskCard)}
                          {!resultTasks.some((t) => t.status === s) && (
                            <Empty text="Sin tareas en esta columna." />
                          )}
                        </section>
                      ),
                    )}
                  </div>
                )}
              </>
            )}
            {page === "operations" && (
              <>
                <div className="operational-intro">
                  <ActivityIcon size={23} />
                  <div>
                    <b>Trabajo continuo, evidencia concreta.</b>
                    <p>
                      Registrá lo realizado. Cada operativa tiene una meta y un
                      historial propios por empresa y mes.
                    </p>
                  </div>
                </div>
                <div className="operations-grid">
                  {operations.map((t) => {
                    const qty = taskQuantity(t, state.activity);
                    return (
                      <section className="panel operation" key={t.id}>
                        <div className="card-top">
                          <span className="company-tag">
                            {companyOf(t.companyId)}
                          </span>
                          <b>{t.weight} pts</b>
                        </div>
                        <h2>{t.title}</h2>
                        <p>
                          {nameOf(t.ownerId)}
                          {coverageFor(state, t)?.replacementId && (
                            <small>
                              {" "}
                              · cubre{" "}
                              {nameOf(coverageFor(state, t)!.replacementId)}
                            </small>
                          )}
                        </p>
                        {t.scheduledOn && (
                          <small>Realización: {fmt(t.scheduledOn)}</small>
                        )}
                        <div className="timer-mini">
                          {t.sessions?.length ? (
                            <span>
                              ◷{" "}
                              {duration(
                                elapsedSeconds(t, new Date(tick).toISOString()),
                              )}
                            </span>
                          ) : (
                            <span>Sin tiempo registrado</span>
                          )}
                          {t.status === "En curso" &&
                            !closed &&
                            !t.blockedBy && (
                              <button
                                aria-label={
                                  t.sessions?.some((e) => !e.end)
                                    ? "Pausar cronómetro"
                                    : "Reanudar cronómetro"
                                }
                                onClick={() =>
                                  clock(t, !t.sessions?.some((e) => !e.end))
                                }
                              >
                                {t.sessions?.some((e) => !e.end)
                                  ? "Pausar"
                                  : "Cronometrar"}
                              </button>
                            )}
                        </div>
                        <div className="quantity">
                          <strong>{qty}</strong>
                          <span>
                            / {t.target} {t.unit}
                          </span>
                        </div>
                        <Meter value={(qty / t.target) * 100} />
                        <div className="operation-footer">
                          <small>
                            {Math.round((qty / t.target) * 100)}% de la meta
                            mensual
                          </small>
                          <button
                            className="primary"
                            onClick={() => setLogFor(t.id)}
                            disabled={isClosed(state, t)}
                          >
                            <Plus size={14} />
                            Registrar
                          </button>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setDetail(t.id)}
                        >
                          Ver registros <ArrowRight size={13} />
                        </button>
                      </section>
                    );
                  })}
                </div>
                {!operations.length && (
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
                              operations.some((t) => t.id === a.taskId) &&
                              a.date.startsWith(month),
                          )
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((a) => {
                            const t = operations.find(
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
                          <Tooltip formatter={(v) => `${v}%`} />
                          <ReferenceLine x={100} stroke="#a4a8b0" />
                          <Bar
                            dataKey="weighted"
                            name="Cumplimiento"
                            fill="var(--chart-ink)"
                            radius={[0, 5, 5, 0]}
                            onClick={(d) => {
                              if (group === "individual")
                                setOwner(String(d.id));
                              if (group === "team") setTeam(String(d.id));
                              if (group === "sector") setSector(String(d.id));
                              setPage("tasks");
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
            {page === "team" && active.role === "jefe" && (
              <Workforce state={state} commit={commit} notify={notify} />
            )}
            {page === "calendar" && (
              <Panel
                title="Agenda del mes"
                sub="Ordenada por vencimiento; el filtro de empresa se mantiene"
              >
                {table(
                  resultTasks
                    .filter((t) => t.status !== "Completada")
                    .sort((a, b) =>
                      (a.due || "9999").localeCompare(b.due || "9999"),
                    ),
                )}
              </Panel>
            )}
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
                      Alta de demostración
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
                          <GitBranch size={20} />
                          <div>
                            <b>{nameOf(t.managerId)}</b>
                            <small>Encargado · {t.name}</small>
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
                                  setOwner(p.id);
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
                  sub="Ámbitos de la demostración; los permisos definitivos deben ejecutarse en la base"
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
            {page === "catalog" && (
              <Panel
                title="Catálogo estándar y pesos"
                sub="El jefe define el peso. Los cambios se aplican a nuevas asignaciones; no reescriben meses anteriores."
              >
                <div className="catalog-grid">
                  {state.templates.map((t) => (
                    <section className="catalog-item" key={t.id}>
                      <span className="badge">
                        {t.kind === "operativa"
                          ? "Actividad operativa"
                          : "Entregable"}
                      </span>
                      <h3>{t.title}</h3>
                      <p>{t.description}</p>
                      <small>{t.sector}</small>
                      <div className="catalog-fields">
                        <label>
                          Peso de la tarea
                          <select
                            disabled={active.role !== "jefe"}
                            value={t.weight}
                            onChange={(e) =>
                              commit(
                                {
                                  ...state,
                                  templates: state.templates.map((x) =>
                                    x.id === t.id
                                      ? { ...x, weight: Number(e.target.value) }
                                      : x,
                                  ),
                                },
                                "Actualizó peso de catálogo",
                                t.id,
                              )
                            }
                          >
                            {[1, 2, 3, 5, 8].map((n) => (
                              <option key={n} value={n}>
                                {n} puntos
                              </option>
                            ))}
                          </select>
                        </label>
                        {t.kind === "operativa" && (
                          <label>
                            Meta por ocurrencia
                            <input
                              type="number"
                              min="1"
                              max="1000000"
                              disabled={active.role !== "jefe"}
                              value={t.target}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if (n > 0 && n <= 1000000)
                                  commit(
                                    {
                                      ...state,
                                      templates: state.templates.map((x) =>
                                        x.id === t.id ? { ...x, target: n } : x,
                                      ),
                                    },
                                    "Actualizó meta de catálogo",
                                    t.id,
                                  );
                              }}
                            />
                            <small>{t.unit}</small>
                          </label>
                        )}
                      </div>
                      {t.steps.length > 0 && (
                        <ol>
                          {t.steps.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ol>
                      )}
                    </section>
                  ))}
                </div>
              </Panel>
            )}
            {page === "closing" && (
              <>
                <div className="notice-banner">
                  <LockKeyhole size={18} />
                  <span>
                    El cierre abarca todas las empresas de cada empleado. Guarda
                    tareas, registros y métricas del mes; después bloquea sus
                    cambios en esta demostración.
                  </span>
                </div>
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
                              (t) => t.ownerId === p.id && t.month === month,
                            );
                            const c = state.closures.find(
                              (c) => c.ownerId === p.id && c.month === month,
                            );
                            const x = c?.metrics || metrics(ts, state.activity);
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
                                          [
                                            [
                                              "Tarea",
                                              "Empresa",
                                              "Tipo",
                                              "Peso",
                                              "Estado",
                                              "Cantidad",
                                              "Unidad",
                                              "Meta",
                                            ],
                                            ...c.tasks.map((t) => [
                                              t.title,
                                              companyOf(t.companyId),
                                              t.kind,
                                              t.weight,
                                              t.status,
                                              taskQuantity(t, c.activity),
                                              t.unit,
                                              t.target,
                                            ]),
                                          ],
                                          `cierre-${p.name}-${month}.csv`,
                                        )
                                      }
                                    >
                                      <Download size={13} />
                                      Exportar cierre
                                    </button>
                                  ) : manager ? (
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
                                    <span>Tu encargado realiza el cierre</span>
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
          </div>
          <footer>
            <b>GRUPO PARÍS</b>
            <span>Orden para trabajar. Información para decidir.</span>
            <span>Datos de ejemplo · guardado local · {monthLabel(month)}</span>
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
          <p>{tours[tourStep].text}</p>
          <div>
            <button onClick={() => setTourOpen(false)}>Pausar</button>
            <button
              className="primary"
              onClick={() => {
                if (tourStep === tours.length - 1) {
                  setTourOpen(false);
                  commit({
                    ...state,
                    tour: { ...state.tour, [active.id]: tours.length },
                  });
                } else
                  commit({
                    ...state,
                    tour: { ...state.tour, [active.id]: tourStep + 1 },
                  });
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
          owner={owner}
          people={people}
          close={() => setModal(null)}
          create={(a) => {
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
                (c) => c.ownerId === a.ownerId && c.month === month,
              )
            ) {
              notify("El mes de esa persona está cerrado.");
              return;
            }
            if (
              commit(
                materialize(
                  { ...state, assignments: [...state.assignments, a] },
                  month,
                ),
                "Creó asignación",
                a.id,
              )
            ) {
              setModal(null);
              notify("Tarea creada con empresa y período propios.");
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
          <div className="timer-panel">
            <div>
              <small>TIEMPO REGISTRADO</small>
              <strong>
                {duration(
                  elapsedSeconds(tasksForDetail, new Date(tick).toISOString()),
                )}
              </strong>
              <p>
                {tasksForDetail.sessions?.some((e) => !e.end)
                  ? "En marcha · se conserva si recargás. Pausalo al interrumpir el trabajo."
                  : "Pausado · las esperas no se suman si el cronómetro está detenido."}
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
                  !tasksForDetail.sessions?.some((e) => !e.end),
                )
              }
            >
              {tasksForDetail.sessions?.some((e) => !e.end)
                ? "Pausar cronómetro"
                : "Iniciar cronómetro"}
            </button>
          </div>
          {(tasksForDetail.sessions || []).length > 0 && (
            <details>
              <summary>Sesiones y responsables</summary>
              {tasksForDetail.sessions!.map((e) => (
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
                  .filter((a) => a.taskId === tasksForDetail.id)
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
                Se registra en el historial local. No cambia cierres anteriores
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
            Alta de demostración: prepara su perfil y la inducción. No crea una
            cuenta real ni envía una invitación.
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
                    activeId: pid,
                  },
                  "Alta de demostración",
                  pid,
                )
              ) {
                setModal(null);
                setInduct(true);
                setPaused(false);
                setOwner("");
              }
            }}
          >
            <label>
              Nombre
              <input name="name" required maxLength={80} />
            </label>
            <div className="form-grid">
              <label>
                Equipo / responsable
                <select name="team">
                  {state.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {nameOf(t.managerId)}
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
                Crear y probar inducción <GraduationCap size={16} />
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "close" && (
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
                  notify(
                    "Mes consolidado. El historial quedó protegido en esta demostración.",
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
  close,
  create,
}: {
  state: State;
  active: Profile;
  month: string;
  company: string;
  owner: string;
  people: Profile[];
  close: () => void;
  create: (a: Assignment) => void;
}) {
  const [template, setTemplate] = useState("");
  const [schedule, setSchedule] = useState<Schedule>(() =>
    defaultSchedule(month + "-25"),
  );
  const [scheduleError, setScheduleError] = useState("");
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
    create({
      schedule,
      id: id(),
      templateId: template || null,
      title,
      ownerId: String(f.get("owner")),
      companyId: String(f.get("company")),
      sector: String(f.get("sector")),
      kind,
      weight: active.role === "jefe" ? Number(f.get("weight")) : t?.weight || 1,
      unit: kind === "operativa" ? String(f.get("unit")).trim() : "",
      target: kind === "operativa" ? Number(f.get("target")) : 0,
      day: schedule.monthDay,
      frequency: schedule.frequency,
      steps:
        kind === "resultado"
          ? String(f.get("steps"))
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      startMonth: month,
      priority: String(f.get("priority")) as Assignment["priority"],
    });
  }
  return (
    <Dialog title="Nueva tarea, con todo su contexto" onClose={close} wide>
      <label>
        Elegí del catálogo
        <select
          value={template}
          onChange={(e) => {
            setTemplate(e.target.value);
            setKind(
              state.templates.find((t) => t.id === e.target.value)?.kind ||
                "resultado",
            );
          }}
        >
          <option value="">Tarea particular</option>
          {state.templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      <form key={template} onSubmit={submit}>
        <label>
          Título
          <input
            name="title"
            required
            maxLength={120}
            defaultValue={t?.title}
          />
        </label>
        <div className="form-grid">
          <label>
            Empresa obligatoria
            <select name="company" defaultValue={company || ""} required>
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
            <select name="owner" defaultValue={owner || active.id}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sector
            <select name="sector" defaultValue={t?.sector || active.sector}>
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
              defaultValue={t?.weight || 1}
              disabled={active.role !== "jefe"}
            >
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
        <ScheduleEditor value={schedule} onChange={setSchedule} month={month} />
        {scheduleError && <p role="alert">{scheduleError}</p>}
        {kind === "resultado" && (
          <label>
            Checklist · un paso por línea
            <textarea
              name="steps"
              rows={4}
              defaultValue={t?.steps.join("\n")}
            />
          </label>
        )}
        <div className="note">
          Se crea una instancia para {monthLabel(month)}. Dos empresas conservan
          estados e indicadores independientes.
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
