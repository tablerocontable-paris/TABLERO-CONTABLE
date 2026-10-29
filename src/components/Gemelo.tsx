import { useState, type FormEvent } from "react";
import { ArrowRight, CalendarDays, Search, Sparkles } from "lucide-react";
import type { GemeloObligation, GemeloTask } from "../domain/gemelo";

type Intent = "next" | "due" | "blocked";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR").trim();
}

function matchesTerms(value: string, terms: string) {
  const haystack = normalize(value);
  return !terms || terms.split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
}

function taskRank(a: GemeloTask, b: GemeloTask) {
  const priority = { Alta: 0, Media: 1, Baja: 2 };
  return Number(b.ready) - Number(a.ready) ||
    (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31") ||
    priority[a.priority] - priority[b.priority] ||
    a.title.localeCompare(b.title, "es");
}

export default function Gemelo({
  tasks,
  obligations,
  actorId,
  companyOf,
  onOpenTask,
  onOpenCalendar,
}: {
  tasks: GemeloTask[];
  obligations: GemeloObligation[];
  actorId: string;
  companyOf: (companyId: string) => string;
  onOpenTask: (taskId: string) => void;
  onOpenCalendar: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [intent, setIntent] = useState<Intent>("next");
  const search = normalize(question);
  const searchTerm = search.replace(/\b(que|vence|vencimientos?|obligaciones?|fiscales?|fecha|fechas|proximos?|proximas?|esta|estan|en|el|la|los|las|bloqueado|bloqueadas?|espera|dependencias?)\b/g, " ").replace(/\s+/g, " ").trim();
  const detectedIntent: Intent = /venc|vence|oblig|impuest|iva|fecha/.test(search)
    ? "due"
    : /bloque|espera|depend/.test(search)
      ? "blocked"
      : intent;
  const taskResults = tasks
    .filter((task) => detectedIntent !== "blocked" || !task.ready)
    .filter((task) => matchesTerms(`${task.title} ${companyOf(task.companyId)} ${task.sector} ${task.ownerLabel} ${Object.entries(task.taskParameters || {}).flat().join(" ")}`, searchTerm))
    .sort(taskRank)
    .slice(0, 8);
  const obligationResults = obligations
    .filter((obligation) => matchesTerms(`${obligation.title} ${obligation.obligationCode} ${companyOf(obligation.companyId)}`, searchTerm))
    .filter((obligation) => obligation.status === "pending" || obligation.status === "unassigned")
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn, "es") || a.title.localeCompare(b.title, "es"));
  const dueTaskResults = taskResults.filter((task) => !!task.due).slice(0, 6);

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalize(question);
    setIntent(/venc|vence|oblig|impuest|iva|fecha/.test(normalized) ? "due" :
      /bloque|espera|depend/.test(normalized) ? "blocked" : "next");
  }

  function choose(next: Intent) {
    setIntent(next);
    setQuestion("");
  }

  return (
    <div className="gemelo-page">
      <section className="panel gemelo-intro" aria-labelledby="gemelo-intro-title">
        <div className="gemelo-mark"><Sparkles size={19} aria-hidden="true" /></div>
        <div>
          <h2 id="gemelo-intro-title">Tu centro de trabajo contable</h2>
          <p>Consultá tareas y vencimientos del período. Las respuestas usan reglas locales y respetan tu ámbito de acceso.</p>
        </div>
        <span className="gemelo-demo-tag">Laboratorio · datos ficticios</span>
      </section>

      <form className="panel gemelo-query" onSubmit={submit}>
        <label htmlFor="gemelo-question">¿Qué necesitás resolver?</label>
        <div className="gemelo-query-row">
          <Search size={18} aria-hidden="true" />
          <input id="gemelo-question" value={question} onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ej.: qué vence, qué está bloqueado, conciliación Banco Francés" />
          <button className="primary" type="submit">Consultar <ArrowRight size={15} /></button>
        </div>
        <p className="gemelo-query-hint">Busca por tarea, empresa, sector o parámetro. También reconoce consultas de vencimientos y tareas en espera.</p>
        <div className="gemelo-shortcuts" aria-label="Consultas rápidas">
          <button type="button" aria-pressed={intent === "next" && !question} className={intent === "next" && !question ? "selected" : ""} onClick={() => choose("next")}>Qué sigue</button>
          <button type="button" aria-pressed={intent === "due"} className={intent === "due" ? "selected" : ""} onClick={() => choose("due")}>Vencimientos</button>
          <button type="button" aria-pressed={intent === "blocked"} className={intent === "blocked" ? "selected" : ""} onClick={() => choose("blocked")}>En espera</button>
        </div>
      </form>

      <p className="sr-only" role="status" aria-live="polite">{detectedIntent === "due" ? `${obligationResults.length} obligaciones y ${dueTaskResults.length} entregables visibles con vencimiento.` : `${taskResults.length} tareas en la lista.`}</p>
      <div className="gemelo-results">
        {detectedIntent === "due" ? (
          <section className="panel" aria-labelledby="gemelo-results-title">
            <div className="panel-head">
              <div><h2 id="gemelo-results-title">Obligaciones por revisar</h2><p>{obligationResults.length} en el período · las fechas de ejemplo no son fuente fiscal oficial</p></div>
              <button className="text-button" type="button" onClick={onOpenCalendar}><CalendarDays size={15} /> Abrir calendario</button>
            </div>
            {obligationResults.length ? <ul className="gemelo-list">
              {obligationResults.map((obligation) => <li key={obligation.id}>
                <div><strong>{obligation.title}</strong><span>{companyOf(obligation.companyId)} · período fiscal {obligation.fiscalPeriod}</span></div>
                <time dateTime={obligation.dueOn}>{new Date(`${obligation.dueOn}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</time>
              </li>)}
            </ul> : <p className="gemelo-empty">No hay obligaciones pendientes visibles para estos filtros.</p>}
            <div className="gemelo-subsection-head"><h3>Entregables con vencimiento</h3><span>{dueTaskResults.length}</span></div>
            {dueTaskResults.length ? <ul className="gemelo-list">
              {dueTaskResults.map((task) => <li key={task.id}>
                <div><strong>{task.title}</strong><span>{companyOf(task.companyId)} · {task.status}</span></div>
                <div className="gemelo-task-meta"><time dateTime={task.due}>{new Date(`${task.due}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</time><button className="text-button" type="button" onClick={() => onOpenTask(task.id)}>Abrir <ArrowRight size={14} /></button></div>
              </li>)}
            </ul> : <p className="gemelo-empty">No hay entregables pendientes con fecha en este período.</p>}
            <p className="gemelo-source-note">Origen visible: datos del laboratorio. El Gemelo todavía no consulta ARCA, clientes ni archivos.</p>
          </section>
        ) : (
          <section className="panel" aria-labelledby="gemelo-results-title">
            <div className="panel-head"><div><h2 id="gemelo-results-title">{detectedIntent === "blocked" ? "Trabajo en espera" : "Próximas acciones"}</h2>
              <p>{detectedIntent === "blocked" ? "Bloqueos registrados en las tareas visibles." : "Primero vencimiento, prioridad y tareas habilitadas."}</p></div>
              <span className="gemelo-result-count">{taskResults.length}</span>
            </div>
            {taskResults.length ? <ul className="gemelo-list">
              {taskResults.map((task) => <li key={task.id}>
                <div><strong>{task.title}</strong><span>{companyOf(task.companyId)} · {task.ownerId === actorId ? "A tu cargo" : task.ownerLabel}</span>
                  {!task.ready && <small>{task.reason}</small>}</div>
                <div className="gemelo-task-meta"><span className={`gemelo-priority gemelo-priority--${task.priority.toLowerCase()}`}>{task.priority}</span><button className="text-button" type="button" onClick={() => onOpenTask(task.id)}>Abrir <ArrowRight size={14} /></button></div>
              </li>)}
            </ul> : <p className="gemelo-empty">{detectedIntent === "blocked" ? "No hay tareas en espera dentro de tu ámbito." : "No hay tareas pendientes que coincidan con la consulta."}</p>}
          </section>
        )}
      </div>
      <p className="gemelo-limit">Gemelo está en desarrollo: no usa inteligencia artificial externa ni modifica tareas. Las anotaciones personales no se consultan ni aparecen aquí.</p>
    </div>
  );
}
