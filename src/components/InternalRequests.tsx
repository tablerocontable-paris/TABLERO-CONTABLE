import { useId, useMemo, useState } from "react";
import { MessageSquareText, Send, ShieldAlert } from "lucide-react";
import { canSee, type Profile, type State } from "../domain/model";
import {
  canConvertInternalRequest,
  internalRequestLabels,
  internalRequestRecipients,
  internalRequestStatusLabels,
  internalRequestUrgencyLabels,
  visibleInternalRequests,
  type InternalRequest,
  type InternalRequestKind,
  type InternalRequestStatus,
  type InternalRequestUrgency,
} from "../domain/internalRequests";
import { Empty, Panel } from "./ui";

const kinds: InternalRequestKind[] = ["technical_error", "work_request", "suggestion"];
const urgencies: InternalRequestUrgency[] = ["low", "medium", "high", "urgent"];
const statuses: InternalRequestStatus[] = ["new", "review", "responded", "resolved"];

export default function InternalRequests({
  state, actor, onCreate, onStatus, onReply, onConvert, onOpenTask,
}: {
  state: State;
  actor: Profile;
  onCreate: (request: Omit<InternalRequest, "id" | "createdAt" | "updatedAt" | "messages" | "history">) => boolean;
  onStatus: (id: string, status: InternalRequestStatus) => void;
  onReply: (id: string, body: string) => boolean;
  onConvert: (request: InternalRequest) => void;
  onOpenTask: (id: string) => void;
}) {
  const [kind, setKind] = useState<InternalRequestKind>("work_request");
  const [urgency, setUrgency] = useState<InternalRequestUrgency>("medium");
  const [recipient, setRecipient] = useState("");
  const [filterKind, setFilterKind] = useState("all");
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterAuthor, setFilterAuthor] = useState("all");
  const [module, setModule] = useState("");
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const composeId = useId();
  const recipients = internalRequestRecipients(state, actor, kind);
  const visibleRows = useMemo(() => visibleInternalRequests(state.internalRequests || [], actor), [state.internalRequests, actor]);
  const requests = useMemo(() => visibleRows.filter((request) =>
    (filterKind === "all" || request.kind === filterKind) &&
    (filterStatus === "open" || filterStatus === "all" || request.status === filterStatus) &&
    (filterAuthor === "all" || request.authorId === filterAuthor),
  ), [visibleRows, filterKind, filterStatus, filterAuthor]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const targetId = kind === "suggestion" ? recipient : recipients[0]?.id;
    if (!targetId) { setError("Elegí un destinatario."); return; }
    const subject = String(form.get("subject") || "").trim();
    const description = String(form.get("description") || "").trim();
    if (!module.trim() || !subject || !description) { setError("Completá el módulo, el asunto y el detalle."); return; }
    let saved = false;
    try {
      saved = onCreate({
        kind, authorId: actor.id, recipientId: targetId, urgency, module: module.trim(),
        subject, description, status: "new",
      });
    } catch {
      saved = false;
    }
    if (saved) {
      event.currentTarget.reset();
      setModule(""); setError(""); setRecipient(""); setFormOpen(false);
    } else {
      setError("No se pudo guardar el pedido. Conservamos el borrador para que puedas reintentar.");
    }
  }

  return <div className="internal-requests-page">
    <div className="internal-request-toolbar" data-tour="requests-followup">
      <div className="internal-request-privacy"><ShieldAlert size={17} /> Laboratorio local: los pedidos se guardan en este navegador y no se sincronizan. La cola de soporte es simulada; no hay cuenta técnica conectada. No adjuntes información real de clientes.</div>
      <button data-tour="requests-create-action" type="button" className="primary" aria-expanded={formOpen} aria-controls={composeId} onClick={() => { setFormOpen((open) => !open); setError(""); }}>
        <Send size={15} /> {formOpen ? "Cerrar formulario" : "Nuevo pedido"}
      </button>
    </div>
    {formOpen && <Panel title="Nuevo pedido" sub="El destinatario y la jefatura pueden ver el seguimiento. Los pedidos no afectan indicadores; jefatura puede convertir un pedido de trabajo en tarea de forma explícita." collapsible defaultOpen action={<button type="button" onClick={() => { setFormOpen(false); setError(""); }}>Cancelar</button>}>
      <div id={composeId}>
      <form className="internal-request-form" data-tour="requests-create-form" onSubmit={submit}>
        <label>Tipo<select value={kind} onChange={(event) => { setKind(event.target.value as InternalRequestKind); setRecipient(""); }}>
          {kinds.map((value) => <option key={value} value={value}>{internalRequestLabels[value]}</option>)}
        </select></label>
        {kind === "suggestion" && <label>Enviar a<select required value={recipient} onChange={(event) => setRecipient(event.target.value)}><option value="">Elegí el destino</option>{recipients.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>}
        {kind === "technical_error" && <p className="internal-request-route">Destino: Cola de soporte técnico · simulada</p>}
        {kind === "work_request" && <p className="internal-request-route">Destino: {recipients[0]?.name || "Juan Pablo"}</p>}
        <label>Urgencia<select value={urgency} onChange={(event) => setUrgency(event.target.value as InternalRequestUrgency)}>{urgencies.map((value) => <option key={value} value={value}>{internalRequestUrgencyLabels[value]}</option>)}</select></label>
        <label>Módulo<input required maxLength={80} list="internal-request-modules" value={module} onChange={(event) => setModule(event.target.value)} placeholder="Ej. Vencimientos, tablero, cierres" /><datalist id="internal-request-modules">{["Tablero", "Vencimientos", "Cierre del mes", "Anotaciones", "Equipo y estructura", "Planificación", "Catálogo y pesos"].map((name) => <option key={name} value={name} />)}</datalist></label>
        <label>Asunto<input name="subject" required maxLength={120} placeholder="Resumí el pedido" /></label>
        <label className="internal-request-description">Detalle<textarea name="description" required maxLength={4000} rows={4} placeholder="Contá qué pasó, qué necesitás o qué proponés…" /></label>
        {error && <p role="alert" className="internal-request-error">{error}</p>}
        <button className="primary" type="submit"><Send size={15} /> Registrar pedido</button>
      </form>
      </div>
    </Panel>}
    <Panel title="Seguimiento" sub={`${requests.length} pedido${requests.length === 1 ? "" : "s"} visible${requests.length === 1 ? "" : "s"} para ${actor.name}`} collapsible defaultOpen>
      <div className="internal-request-filters">
        <label>Tipo<select aria-label="Filtrar por tipo" value={filterKind} onChange={(event) => setFilterKind(event.target.value)}><option value="all">Todos los tipos</option>{kinds.map((value) => <option key={value} value={value}>{internalRequestLabels[value]}</option>)}</select></label>
        <label>Estado<select aria-label="Filtrar por estado" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}><option value="open">Abiertos primero</option><option value="all">Todos</option>{statuses.map((value) => <option key={value} value={value}>{internalRequestStatusLabels[value]}</option>)}</select></label>
        <label>Autor<select aria-label="Filtrar por autor" value={filterAuthor} onChange={(event) => setFilterAuthor(event.target.value)}><option value="all">Todos los autores</option>{[...new Set(visibleRows.map((request) => request.authorId))].map((id) => <option key={id} value={id}>{state.profiles.find((profile) => profile.id === id)?.name || "Perfil anterior"}</option>)}</select></label>
      </div>
      {requests.length === 0 ? <div data-tour="requests-empty"><Empty text="No hay pedidos para estos filtros." /></div> : <div className="internal-request-list" data-tour="requests-list">{requests.map((request) => {
        const canRespond = actor.active && (request.recipientId === actor.id || actor.role === "jefe") && request.status !== "resolved";
        const convertedTask = request.convertedTaskId ? state.tasks.find((task) => task.id === request.convertedTaskId) : undefined;
        const canOpenConvertedTask = convertedTask && actor.active && actor.companyIds.includes(convertedTask.companyId) && canSee(actor, convertedTask.ownerId, state.profiles);
        return <article className="internal-request-card" key={request.id}>
          <div className="internal-request-card-head"><span>{internalRequestLabels[request.kind]}</span><span className={`request-urgency urgency-${request.urgency}`}>{internalRequestUrgencyLabels[request.urgency]}</span><span className={`request-status status-${request.status}`}>{internalRequestStatusLabels[request.status]}</span></div>
          <h3>{request.subject}</h3><p className="internal-request-meta">{request.module} · {state.profiles.find((profile) => profile.id === request.authorId)?.name || "Perfil anterior"} · {new Date(request.createdAt).toLocaleString("es-AR")}</p>
          <p className="internal-request-body">{request.description}</p>
          {request.messages.map((message) => <div className="internal-request-reply" key={message.id}><b>Respuesta · {state.profiles.find((profile) => profile.id === message.actorId)?.name || "Jefatura"} · {new Date(message.createdAt).toLocaleString("es-AR")}</b><p>{message.body}</p></div>)}
          {request.convertedTaskId && <div className="internal-request-conversion" role="status">
            {convertedTask ? <><span>Tarea asignada · {state.profiles.find((profile) => profile.id === convertedTask.ownerId)?.name || "Responsable anterior"} · {state.companies.find((company) => company.id === convertedTask.companyId)?.name || "Empresa"} · {convertedTask.scheduledOn || convertedTask.month}</span>{canOpenConvertedTask && <button type="button" onClick={() => onOpenTask(convertedTask.id)}>Abrir tarea</button>}</> : <span>Pedido convertido; la tarea vinculada ya no está disponible.</span>}
          </div>}
          <details className="internal-request-history"><summary>Historial ({request.history.length})</summary><ol>{[...request.history].reverse().map((item) => <li key={item.id}><span>{internalRequestStatusLabels[item.status]}</span> · {item.note} · {state.profiles.find((profile) => profile.id === item.actorId)?.name || "Perfil anterior"} · {new Date(item.createdAt).toLocaleString("es-AR")}</li>)}</ol></details>
          {canConvertInternalRequest(request, actor) && <div className="internal-request-conversion-actions"><button className="primary" type="button" onClick={() => onConvert(request)}>Convertir en tarea puntual</button><span>La jefatura definirá responsable, empresa, fecha, controles y peso. No se asigna nada hasta confirmar.</span></div>}
          {canRespond && <div className="internal-request-actions">
            {request.status === "new" && <button type="button" onClick={() => onStatus(request.id, "review")}>Tomar para revisión</button>}
            <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const body = String(form.get("reply") || ""); if (!body.trim()) return; try { if (onReply(request.id, body)) event.currentTarget.reset(); } catch { /* preserve the draft for retry */ } }}><label className="sr-only" htmlFor={`reply-${request.id}`}>Respuesta</label><textarea id={`reply-${request.id}`} name="reply" maxLength={4000} rows={2} placeholder="Escribí una respuesta para el autor" /><button className="primary" type="submit">Responder</button></form>
            <button type="button" onClick={() => onStatus(request.id, "resolved")}>Marcar resuelto</button>
          </div>}
        </article>;
      })}</div>}
    </Panel>
    <div className="internal-request-heading"><MessageSquareText size={16} /> Los pedidos por sí solos no alteran el tablero de desempeño</div>
  </div>;
}
