import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createWorkspaceRepository, type WorkspaceQueryTransport } from "../data/supabase/workspace-repository";
import type { TaskChecklistPageResponse, WorkspacePageV2Response } from "../data/supabase/workspace-repository";

type Item = WorkspacePageV2Response["data"]["items"][number];
type ChecklistFragment = TaskChecklistPageResponse["data"]["items"][number];
type ChecklistControl = { id: string; ordinal: number; text: string; done: boolean | null; issueCode: string | null };
type ChecklistAssembly = { totalControls: number; fragments: ChecklistFragment[]; nextCursor: string | null; complete: boolean; controls: ChecklistControl[] };

const sameFragment = (a: ChecklistFragment, b: ChecklistFragment) =>
  a.id === b.id && a.ordinal === b.ordinal && a.textPart === b.textPart && a.textOffset === b.textOffset && a.textLength === b.textLength && a.textComplete === b.textComplete && a.done === b.done && a.issueCode === b.issueCode;

/** Merge one decoded page without ever treating a partial reconstruction as a finished control. */
export function mergeChecklistPage(
  previous: ChecklistAssembly | undefined,
  page: TaskChecklistPageResponse["data"],
  expected: { taskId: string; taskRevision: string },
): ChecklistAssembly {
  if (page.taskId !== expected.taskId || page.taskRevision !== expected.taskRevision) throw new Error("protocol");
  if (previous && previous.totalControls !== page.totalControls) throw new Error("protocol");
  const fragments = previous ? [...previous.fragments] : [];
  const seen = new Map(fragments.map((fragment) => [`${fragment.ordinal}:${fragment.textOffset}`, fragment]));
  const byOrdinal = new Map<number, ChecklistFragment>();
  for (const fragment of fragments) byOrdinal.set(fragment.ordinal, byOrdinal.get(fragment.ordinal) ?? fragment);
  for (const fragment of page.items) {
    const key = `${fragment.ordinal}:${fragment.textOffset}`;
    const duplicate = seen.get(key);
    if (duplicate) {
      if (!sameFragment(duplicate, fragment)) throw new Error("protocol");
      continue;
    }
    const prior = fragments.at(-1);
    const expectedOrdinal = prior ? (prior.textComplete ? prior.ordinal + 1 : prior.ordinal) : 1;
    const expectedOffset = prior && !prior.textComplete ? prior.textOffset + Array.from(prior.textPart).length : 0;
    if (fragment.ordinal !== expectedOrdinal || fragment.textOffset !== expectedOffset) throw new Error("protocol");
    const first = byOrdinal.get(fragment.ordinal);
    if (first && (first.id !== fragment.id || first.done !== fragment.done || first.issueCode !== fragment.issueCode || first.textLength !== fragment.textLength)) throw new Error("protocol");
    fragments.push(fragment); seen.set(key, fragment); byOrdinal.set(fragment.ordinal, first ?? fragment);
  }
  const controls: ChecklistControl[] = [];
  if (page.nextCursor === null) {
    if (fragments.length === 0 && page.totalControls !== 0) throw new Error("protocol");
    for (let ordinal = 1; ordinal <= page.totalControls; ordinal++) {
      const parts = fragments.filter((fragment) => fragment.ordinal === ordinal);
      if (!parts.length || !parts.at(-1)!.textComplete) throw new Error("protocol");
      const first = parts[0]!;
      if (parts.some((part, index) => part.textOffset !== (index === 0 ? 0 : parts[index - 1]!.textOffset + Array.from(parts[index - 1]!.textPart).length))) throw new Error("protocol");
      const text = parts.map((part) => part.textPart).join("");
      if (Array.from(text).length !== first.textLength) throw new Error("protocol");
      controls.push({ id: first.id, ordinal, text, done: first.done, issueCode: first.issueCode });
    }
    if (fragments.some((fragment) => fragment.ordinal < 1 || fragment.ordinal > page.totalControls)) throw new Error("protocol");
  }
  return { totalControls: page.totalControls, fragments, nextCursor: page.nextCursor, complete: page.nextCursor === null, controls };
}
const PAGE_SIZE = 20;
const message: Record<string, string> = {
  unauthenticated: "La sesión venció. Volvé a ingresar para consultar tus tareas.",
  transport: "No pudimos conectar con el espacio de trabajo.",
  server: "El servicio no está disponible o la cuenta no tiene acceso habilitado.",
  protocol: "La respuesta del servicio es incompatible con esta versión.",
};

export default function MyWork({ transport }: { transport: WorkspaceQueryTransport }) {
  const repository = useMemo(() => createWorkspaceRepository(transport), [transport]);
  const [period, setPeriod] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`; });
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [checklists, setChecklists] = useState<Record<string, ChecklistAssembly>>({});
  const [checkErrors, setCheckErrors] = useState<Record<string, string>>({});
  const [checkLoading, setCheckLoading] = useState<string | null>(null);
  const pageGeneration = useRef(0);
  const checklistGeneration = useRef(new Map<string, number>());
  const invalidateWorkspace = useCallback(() => {
    pageGeneration.current += 1;
    for (const [taskId, generation] of checklistGeneration.current) checklistGeneration.current.set(taskId, generation + 1);
    setItems([]); setCursor(null); setExpanded(null); setChecklists({}); setCheckErrors({}); setCheckLoading(null);
  }, []);
  const loadPage = useCallback(async (next: string | null, reset = false) => {
    const generation = ++pageGeneration.current;
    setLoading(true); setError(null);
    let result: Awaited<ReturnType<typeof repository.listPage>>;
    try {
      result = await repository.listPage({ filters: { subjectId: null, period, companyId: null, teamId: null, sector: null }, cursor: next, limit: PAGE_SIZE });
    } catch {
      if (generation === pageGeneration.current) { invalidateWorkspace(); setLoading(false); setError("transport"); }
      return;
    }
    if (generation !== pageGeneration.current) return;
    setLoading(false);
    if (!result.ok) { invalidateWorkspace(); setError(result.error); return; }
    setItems((old) => reset ? result.value.data.items : [...old, ...result.value.data.items]);
    setCursor(result.value.data.nextCursor);
  }, [invalidateWorkspace, period, repository]);
  useEffect(() => {
    setItems([]); setCursor(null); setError(null); setExpanded(null); setChecklists({}); setCheckErrors({}); setCheckLoading(null);
    for (const [taskId, generation] of checklistGeneration.current) checklistGeneration.current.set(taskId, generation + 1);
    void loadPage(null, true);
    return () => {
      pageGeneration.current += 1;
      for (const [taskId, generation] of checklistGeneration.current) checklistGeneration.current.set(taskId, generation + 1);
    };
  }, [loadPage]);

  const loadChecklist = async (item: Item, next: string | null, append: boolean) => {
    const generation = (checklistGeneration.current.get(item.taskId) ?? 0) + 1;
    checklistGeneration.current.set(item.taskId, generation);
    setCheckLoading(item.taskId); setCheckErrors((old) => { const copy = { ...old }; delete copy[item.taskId]; return copy; });
    let result: Awaited<ReturnType<typeof repository.readChecklistPage>>;
    try {
      result = await repository.readChecklistPage({ filters: { taskId: item.taskId, subjectId: null, taskRevision: item.taskRevision }, cursor: next, limit: 16 });
    } catch {
      if (checklistGeneration.current.get(item.taskId) === generation) {
        setCheckLoading(null); setChecklists((old) => { const copy = { ...old }; delete copy[item.taskId]; return copy; }); setCheckErrors((old) => ({ ...old, [item.taskId]: "transport" }));
      }
      return;
    }
    if (checklistGeneration.current.get(item.taskId) !== generation) return;
    setCheckLoading(null);
    if (!result.ok) {
      setChecklists((old) => { const copy = { ...old }; delete copy[item.taskId]; return copy; });
      setCheckErrors((old) => ({ ...old, [item.taskId]: result.error })); return;
    }
    try {
      const previous = append ? checklists[item.taskId] : undefined;
      const assembly = mergeChecklistPage(previous, result.value.data, { taskId: item.taskId, taskRevision: item.taskRevision });
      setChecklists((old) => ({ ...old, [item.taskId]: assembly }));
    } catch {
      setChecklists((old) => { const copy = { ...old }; delete copy[item.taskId]; return copy; });
      setCheckErrors((old) => ({ ...old, [item.taskId]: "protocol" }));
    }
  };
  const toggle = (item: Item) => {
    if (expanded === item.taskId) { setExpanded(null); return; }
    setExpanded(item.taskId);
    if (item.checklistState === "paged" && !checklists[item.taskId]) void loadChecklist(item, null, false);
  };
  const refreshTasks = () => {
    invalidateWorkspace(); setCheckErrors({});
    void loadPage(null, true);
  };

  return <main className="my-work" aria-labelledby="my-work-title">
    <header className="my-work-header"><div><p className="my-work-eyebrow">Grupo París · consulta personal</p><h1 id="my-work-title">Mi trabajo</h1><p>Vista de solo lectura de las tareas asignadas a tu sesión.</p></div>
      <label>Período <input type="month" value={period.slice(0, 7)} onChange={(event) => setPeriod(`${event.target.value}-01`)} /></label></header>
    {error && <section role="alert" className="my-work-error"><p>{message[error] ?? message.protocol}</p><button type="button" onClick={() => void loadPage(items.length ? cursor : null, items.length === 0)} disabled={loading}>Reintentar</button></section>}
    {loading && items.length === 0 && <p role="status">Cargando tus tareas…</p>}
    {!loading && !error && items.length === 0 && <section className="my-work-empty"><h2>No hay tareas para este período</h2><p>Probá otro período para consultar tu trabajo asignado.</p></section>}
    <div className="my-work-list">{items.map((item) => <article className="my-work-card" key={item.taskId}>
      <div className="my-work-card-head"><div><span className={`my-work-status status-${item.status === "Completada" ? "done" : item.status === "En curso" ? "progress" : "pending"}`}>{item.status}</span><h2>{item.title}</h2></div><span className={`my-work-priority priority-${item.priority.toLowerCase()}`}>Prioridad {item.priority.toLowerCase()}</span></div>
      <dl className="my-work-meta"><div><dt>Empresa</dt><dd>{item.companyName}</dd></div><div><dt>Equipo</dt><dd>{item.teamName}</dd></div><div><dt>Vencimiento</dt><dd>{item.dueDate ?? "Sin fecha"}</dd></div><div><dt>Programada</dt><dd>{item.scheduledOn ?? "Sin fecha"}</dd></div></dl>
      {item.blockerCodes.length > 0 && <p className="my-work-blocker">Bloqueos: {item.blockerCodes.map((code) => code === "external_wait" ? "espera externa" : code === "available_later" ? "disponible más adelante" : "dependencias pendientes").join(", ")}{item.hasHiddenDependencies ? " · hay dependencias fuera de tu vista" : ""}</p>}
      <p className="my-work-output">Trabajo registrado: {item.subjectWork.recordedSeconds} segundos</p>
      <button type="button" className="my-work-expand" aria-expanded={expanded === item.taskId} onClick={() => toggle(item)}>{expanded === item.taskId ? "Ocultar controles" : "Ver controles"}</button>
      {expanded === item.taskId && <section className="my-work-controls" aria-label={`Controles de ${item.title}`}>
        {item.checklistState === "requires_review" ? <p role="status">Los controles requieren revisión y no están disponibles para mostrar.</p> : item.checklistState === "inline" ? <ul>{item.checklist.map((value, index) => { const control = { ...value, ordinal: index + 1 }; return <li key={control.ordinal}><span aria-label={control.done ? "Realizado" : "Pendiente"}>{control.done ? "✓" : "○"}</span> {control.text}</li>; })}</ul> : <>
          {checklists[item.taskId]?.complete && <>
            <p role="status">Lectura completa · {checklists[item.taskId].totalControls} controles · {checklists[item.taskId].controls.filter((control) => control.done === null || control.issueCode !== null).length} requieren revisión.</p>
            <ul>{checklists[item.taskId].controls.map((control) => <li className="my-work-control" key={control.ordinal}>
              <span aria-label={control.done === null || control.issueCode !== null ? "Requiere revisión" : control.done ? "Realizado" : "Pendiente"}>{control.done === null || control.issueCode !== null ? "!" : control.done ? "✓" : "○"}</span>
              <span>{control.text}{control.issueCode === "text_missing" ? "[texto faltante]" : control.issueCode === "text_invalid" ? "[texto inválido]" : control.issueCode === "invalid_type" ? "[control inválido]" : control.issueCode === "text_empty" ? "[texto vacío]" : control.issueCode === "done_invalid" ? " [estado requiere revisión]" : ""}</span>
            </li>)}</ul>
          </>}
          {checkErrors[item.taskId] && <div role="alert"><p>{message[checkErrors[item.taskId]] ?? message.protocol}</p>{(checkErrors[item.taskId] === "protocol" || checkErrors[item.taskId] === "server") ? <button type="button" onClick={refreshTasks}>Actualizar lista de tareas</button> : <button type="button" onClick={() => void loadChecklist(item, null, false)}>Reintentar controles</button>}</div>}
          {checkLoading === item.taskId && <p role="status">Leyendo controles…{checklists[item.taskId] ? ` ${checklists[item.taskId].fragments.length} fragmentos recibidos` : ""}</p>}
          {checklists[item.taskId] && !checklists[item.taskId].complete && !checkLoading && <button type="button" onClick={() => void loadChecklist(item, checklists[item.taskId].nextCursor, true)}>Cargar más controles</button>}
        </>}
      </section>}
    </article>)}</div>
    {cursor && <button type="button" className="my-work-more" onClick={() => void loadPage(cursor)} disabled={loading}>{loading ? "Cargando…" : "Cargar más tareas"}</button>}
  </main>;
}
