import { useMemo, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  Clipboard,
  FileText,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { dateART, type Annotation, type AnnotationKind, type Task } from "../domain/model";
import { Empty, Panel } from "./ui";

const kindLabel: Record<AnnotationKind, string> = {
  personal: "Nota personal",
  formula: "Fórmula de Excel",
  reminder: "Recordatorio",
};
const categoryKind = (label: string): AnnotationKind => {
  const normalized = label.trim().toLocaleLowerCase("es");
  if (["fórmula de excel", "formula de excel", "formula"].includes(normalized)) return "formula";
  if (["recordatorio", "reminder"].includes(normalized)) return "reminder";
  if (normalized === "personal") return "personal";
  return "personal";
};

export default function Annotations({
  rows, tasks, onSave, onDelete, onConvert, onOpenTask, remote=false,
}: {
  rows: Annotation[];
  tasks: Task[];
  onSave: (entry: Pick<Annotation, "id" | "title" | "content" | "kind" | "category" | "reminderOn">) => boolean;
  onDelete: (id: string) => void;
  onConvert: (entry: Annotation) => void;
  onOpenTask: (id: string) => void;
  remote?:boolean;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formCategory, setFormCategory] = useState("Nota personal");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState("");
  const visible = useMemo(() => rows.filter((r) => {
    const category = r.category || kindLabel[r.kind];
    return (filter === "all" || category === filter) &&
      `${r.title} ${r.content} ${category}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"));
  }).sort((a, b) => (a.reminderOn || "9999").localeCompare(b.reminderOn || "9999") || b.updatedAt.localeCompare(a.updatedAt)), [rows, search, filter]);
  const today = dateART();
  const due = rows.filter((r) => r.reminderOn && r.reminderOn <= today && !r.convertedTaskId);
  const categories = [...new Set(rows.map((r) => r.category || kindLabel[r.kind]))].sort((a, b) => a.localeCompare(b, "es"));
  const source = rows.find((r) => r.id === editing);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") || "").trim();
    const content = String(data.get("content") || "").trim();
    const category = String(data.get("category") || "Nota personal").trim().slice(0, 40);
    const reminderOn = String(data.get("reminderOn") || "") || null;
    if (!title || !content || !category) return;
    const kind = categoryKind(category);
    if (kind === "reminder" && !reminderOn) return;
    if (onSave({ id: source?.id || "", title, content, category, kind, reminderOn })) {
      e.currentTarget.reset();
      setEditing(null);
      setFormOpen(false);
    }
  }

  return (
    <div className="annotations-page">
      <Panel title="Anotaciones personales" sub="Fórmulas, recordatorios y referencias útiles. Convertí una anotación en tarea cuando necesite seguimiento." collapsible defaultOpen action={!formOpen ? <button data-tour="annotations-create-action" type="button" className="primary annotation-new" onClick={() => { setEditing(null); setFormCategory("Nota personal"); setFormOpen(true); }}><Plus size={15} /> Nueva anotación</button> : undefined}>
        <div className="annotation-privacy">
          <FileText size={16} /> {remote ? 'Estas anotaciones se guardan en el servidor y sólo se entregan a tu perfil. Si convertís una en tarea, el título y los controles de esa tarea pasan al ámbito de trabajo autorizado.' : 'Demo local: estas anotaciones quedan en este navegador y asociadas al perfil seleccionado. Aún no hay cuentas privadas ni sincronización.'}
        </div>
        {due.length > 0 && <div className="annotation-due"><Bell size={16} /> Tenés {due.length} recordatorio{due.length === 1 ? "" : "s"} para revisar.</div>}
        {formOpen && (
          <form key={editing || "new"} className="annotation-form" data-tour="annotations-form" onSubmit={submit}>
            <label>Título<input name="title" required maxLength={100} placeholder="Ej. Fórmula para diferencias" defaultValue={source?.title || ""} /></label>
            <label>Tipo o categoría<input aria-label="Tipo" name="category" required list="annotation-categories" maxLength={40} placeholder="Nota personal, fórmula, recordatorio u otra" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} /><datalist id="annotation-categories">{[...new Set(["Nota personal", "Fórmula de Excel", "Recordatorio", ...categories])].map((name) => <option key={name} value={name} />)}</datalist></label>
            <label className="annotation-date">Recordarme el<input name="reminderOn" type="date" required={categoryKind(formCategory) === "reminder"} defaultValue={source?.reminderOn || ""} /></label>
            <label className="annotation-content">Contenido<textarea name="content" required rows={3} placeholder="Guardá la fórmula, el criterio o el detalle que quieras recordar…" defaultValue={source?.content || ""} /></label>
            <div className="annotation-form-actions"><button className="primary"><Plus size={15} /> {editing ? "Guardar cambios" : "Guardar anotación"}</button><button type="button" onClick={() => { setFormOpen(false); setEditing(null); }}>Cancelar</button></div>
          </form>
        )}
      </Panel>
      <Panel title="Tu biblioteca" sub={`${rows.length} anotación${rows.length === 1 ? "" : "es"}`} collapsible defaultOpen>
        <div className="annotation-tools" data-tour="private-annotations">
          <label className="annotation-search"><Search size={16} /><input aria-label="Buscar anotaciones" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en tus anotaciones" /></label>
          <select aria-label="Filtrar tipo de anotación" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Todos los tipos</option>{categories.map((name) => <option key={name} value={name}>{name}</option>)}</select>
        </div>
        {visible.length === 0 ? <div className="annotation-empty-state"><Empty text={rows.length ? "No hay resultados con estos filtros." : "Todavía no guardaste anotaciones."} /></div> : (
          <div className="annotation-list">
            {visible.map((entry) => {
              const linked = entry.convertedTaskId ? tasks.find((t) => t.id === entry.convertedTaskId) : undefined;
              const converted = entry.convertedTaskId !== null;
              const category = entry.category || kindLabel[entry.kind];
              const open = expanded[entry.id] || false;
              return (
                <article className="annotation-card" key={entry.id}>
                  <div className="annotation-card-head"><span className={`annotation-kind kind-${entry.kind}`}>{entry.kind === "reminder" ? <Bell size={13} /> : entry.kind === "formula" ? <Sparkles size={13} /> : <FileText size={13} />}{category}</span>{entry.reminderOn && <time>{new Date(entry.reminderOn + "T12:00:00").toLocaleDateString("es-AR")}</time>}</div>
                  <h3>{entry.title}</h3>
                  <p className={`annotation-preview ${open ? "expanded" : ""}`}>{entry.content}</p>
                  <button type="button" className="annotation-expand" aria-expanded={open} onClick={() => setExpanded((current) => ({ ...current, [entry.id]: !open }))}>{open ? "Mostrar menos" : "Leer completo"} <ChevronDown size={13} /></button>
                  <div className="annotation-card-actions">
                    {entry.kind === "formula" && <button onClick={async () => { try { if (!navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(entry.content); setCopied(entry.id); } catch { setCopied(`${entry.id}:error`); } setTimeout(() => setCopied(""), 2200); }}><Clipboard size={14} />{copied === entry.id ? "Copiada" : copied === `${entry.id}:error` ? "No se pudo copiar" : "Copiar"}</button>}
                    {linked ? <button className="annotation-linked" onClick={() => onOpenTask(linked.id)}><Check size={14} /> Tarea creada · {linked.title}</button> : converted ? <span className="annotation-linked-unavailable">Tarea vinculada no disponible</span> : <button onClick={() => { setEditing(entry.id); setFormCategory(category); setFormOpen(true); }}>Editar</button>}
                    {!converted && <button className="primary" onClick={() => onConvert(entry)}><Sparkles size={14} /> Convertir en tarea</button>}
                    {!converted && <button aria-label={`Eliminar ${entry.title}`} onClick={() => onDelete(entry.id)}><Trash2 size={14} /></button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
