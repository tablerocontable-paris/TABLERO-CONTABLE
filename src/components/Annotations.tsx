import { useMemo, useState } from "react";
import {
  Bell,
  Check,
  Clipboard,
  FileText,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  dateART,
  type Annotation,
  type AnnotationKind,
  type Task,
} from "../domain/model";
import { Empty, Panel } from "./ui";

const kindLabel: Record<AnnotationKind, string> = {
  personal: "Nota personal",
  formula: "Fórmula de Excel",
  reminder: "Recordatorio",
};

export default function Annotations({
  rows,
  tasks,
  onSave,
  onDelete,
  onConvert,
  onOpenTask,
}: {
  rows: Annotation[];
  tasks: Task[];
  onSave: (
    entry: Pick<Annotation, "id" | "title" | "content" | "kind" | "reminderOn">,
  ) => boolean;
  onDelete: (id: string) => void;
  onConvert: (entry: Annotation) => void;
  onOpenTask: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [formKind, setFormKind] = useState<AnnotationKind>("personal");
  const [editing, setEditing] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const visible = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            (kind === "all" || r.kind === kind) &&
            `${r.title} ${r.content}`
              .toLocaleLowerCase("es")
              .includes(search.toLocaleLowerCase("es")),
        )
        .sort(
          (a, b) =>
            (a.reminderOn || "9999").localeCompare(b.reminderOn || "9999") ||
            b.updatedAt.localeCompare(a.updatedAt),
        ),
    [rows, search, kind],
  );
  const today = dateART();
  const due = rows.filter(
    (r) => r.reminderOn && r.reminderOn <= today && !r.convertedTaskId,
  );

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") || "").trim();
    const content = String(data.get("content") || "").trim();
    if (!title || !content) return;
    const original = rows.find((r) => r.id === editing);
    const saved = onSave({
      id: original?.id || "",
      title,
      content,
      kind: String(data.get("kind")) as AnnotationKind,
      reminderOn: String(data.get("reminderOn") || "") || null,
    });
    if (saved) {
      e.currentTarget.reset();
      setEditing(null);
      setFormKind("personal");
    }
  }
  return (
    <div className="annotations-page">
      <Panel
        title="Anotaciones personales"
        sub="Fórmulas, recordatorios y referencias útiles. Podés convertir una nota en tarea cuando haga falta."
      >
        <div className="annotation-privacy">
          <FileText size={16} /> Demo local: estas notas quedan en este
          navegador y asociadas al perfil seleccionado. Aún no hay cuentas
          privadas ni sincronización.
        </div>
        {due.length > 0 && (
          <div className="annotation-due">
            <Bell size={16} /> Tenés {due.length} recordatorio
            {due.length === 1 ? "" : "s"} para revisar.
          </div>
        )}
        <form
          key={editing || "new"}
          className="annotation-form"
          onSubmit={submit}
        >
          <label>
            Título
            <input
              name="title"
              required
              maxLength={100}
              placeholder="Ej. Fórmula para diferencias"
              defaultValue={rows.find((r) => r.id === editing)?.title || ""}
            />
          </label>
          <label>
            Tipo
            <select
              name="kind"
              value={formKind}
              onChange={(e) => setFormKind(e.target.value as AnnotationKind)}
            >
              <option value="personal">Nota personal</option>
              <option value="formula">Fórmula de Excel</option>
              <option value="reminder">Recordatorio</option>
            </select>
          </label>
          <label className="annotation-date">
            Recordarme el
            <input
              name="reminderOn"
              type="date"
              required={formKind === "reminder"}
              defaultValue={
                rows.find((r) => r.id === editing)?.reminderOn || ""
              }
            />
          </label>
          <label className="annotation-content">
            Contenido
            <textarea
              name="content"
              required
              rows={4}
              placeholder="Guardá la fórmula, el criterio o el detalle que quieras recordar…"
              defaultValue={rows.find((r) => r.id === editing)?.content || ""}
            />
          </label>
          <div className="annotation-form-actions">
            <button className="primary">
              <Plus size={15} />
              {editing ? "Guardar cambios" : "Guardar anotación"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormKind("personal");
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </Panel>
      <Panel
        title="Tu biblioteca"
        sub={`${rows.length} anotación${rows.length === 1 ? "" : "es"}`}
      >
        <div className="annotation-tools">
          <label className="annotation-search">
            <Search size={16} />
            <input
              aria-label="Buscar anotaciones"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en tus anotaciones"
            />
          </label>
          <select
            aria-label="Filtrar tipo de anotación"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="all">Todos los tipos</option>
            <option value="personal">Notas personales</option>
            <option value="formula">Fórmulas</option>
            <option value="reminder">Recordatorios</option>
          </select>
        </div>
        {visible.length === 0 ? (
          <Empty
            text={
              rows.length
                ? "No hay resultados con estos filtros."
                : "Todavía no guardaste anotaciones."
            }
          />
        ) : (
          <div className="annotation-list">
            {visible.map((entry) => {
              const linked = entry.convertedTaskId
                ? tasks.find((t) => t.id === entry.convertedTaskId)
                : undefined;
              const converted = entry.convertedTaskId !== null;
              return (
                <article className="annotation-card" key={entry.id}>
                  <div className="annotation-card-head">
                    <span className={`annotation-kind kind-${entry.kind}`}>
                      {entry.kind === "reminder" ? (
                        <Bell size={13} />
                      ) : entry.kind === "formula" ? (
                        <Sparkles size={13} />
                      ) : (
                        <FileText size={13} />
                      )}
                      {kindLabel[entry.kind]}
                    </span>
                    {entry.reminderOn && (
                      <time>
                        {new Date(
                          entry.reminderOn + "T12:00:00",
                        ).toLocaleDateString("es-AR")}
                      </time>
                    )}
                  </div>
                  <h3>{entry.title}</h3>
                  <pre>{entry.content}</pre>
                  <div className="annotation-card-actions">
                    {entry.kind === "formula" && (
                      <button
                        onClick={async () => {
                          try {
                            if (!navigator.clipboard?.writeText)
                              throw new Error("Clipboard unavailable");
                            await navigator.clipboard.writeText(entry.content);
                            setCopied(entry.id);
                          } catch {
                            setCopied(`${entry.id}:error`);
                          }
                          setTimeout(() => setCopied(""), 2200);
                        }}
                      >
                        <Clipboard size={14} />
                        {copied === entry.id
                          ? "Copiada"
                          : copied === `${entry.id}:error`
                            ? "No se pudo copiar"
                            : "Copiar"}
                      </button>
                    )}
                    {linked ? (
                      <button
                        className="annotation-linked"
                        onClick={() => onOpenTask(linked.id)}
                      >
                        <Check size={14} />
                        Tarea creada · {linked.title}
                      </button>
                    ) : converted ? (
                      <span className="annotation-linked-unavailable">
                        Tarea vinculada no disponible
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setEditing(entry.id);
                          setFormKind(entry.kind);
                        }}
                      >
                        Editar
                      </button>
                    )}
                    {!converted && (
                      <button
                        className="primary"
                        onClick={() => onConvert(entry)}
                      >
                        <Sparkles size={14} />
                        Convertir en tarea
                      </button>
                    )}
                    {!converted && (
                      <button
                        aria-label={`Eliminar ${entry.title}`}
                        onClick={() => onDelete(entry.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
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
