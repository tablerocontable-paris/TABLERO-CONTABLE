import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Plus, X } from "lucide-react";
import { type Profile, type State, canSee, dateART, isResponsible, taskQuantity } from "../domain/model";
import { coverageFor } from "../domain/workforce";
import { Panel, Empty } from "./ui";
import TimelinessBadge from "./TimelinessBadge";
import { taskTimeliness } from "../domain/timeliness";
import FiscalObligations from "./FiscalObligations";
import { calendarCanAccessTask, calendarRecipients, changeCalendarEvent, createCalendarEvent, eligibleCalendarRecipients, isEventManager, visibleCalendarEvents } from "../domain/laboratory-work";
import { visibleFiscalObligations } from "../domain/fiscalObligations";

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-AR", { dateStyle: "medium" });
}
function shiftMonth(value: string, amount: number) {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + amount, 1)).toISOString().slice(0, 7);
}
export default function DeadlineAgenda({
  state, month, company, owner, sector, openTask, openNotes, actor, laboratory = false, commit, notify,
}: {
  state: State; month: string; company: string; owner: string; sector: string; openTask: (id: string) => void;
  openNotes: () => void; actor?: Profile; laboratory?: boolean;
  commit?: (next: State, action?: string, entityId?: string) => boolean; notify?: (message: string) => void;
}) {
  const [completed, setCompleted] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(month);
  const [selectedDay, setSelectedDay] = useState(`${month}-01`);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [eventCompanyId, setEventCompanyId] = useState(company);
  const [shareAll, setShareAll] = useState(false);
  const [fiscalPeriod, setFiscalPeriod] = useState(month);
  const [fiscalFocus, setFiscalFocus] = useState<{ id: string; token: number } | null>(null);
  const fiscalFocusToken = useRef(0);
  const requestedDayFocus = useRef<string | null>(null);
  useEffect(() => { setCalendarMonth(month); setSelectedDay(`${month}-01`); setFiscalPeriod(month); }, [month]);
  useEffect(() => { setEventCompanyId(company); setRecipients([]); }, [company]);

  const matches = state.tasks.filter((task) => (!company || task.companyId === company) && (!owner || isResponsible(task, owner)) && (!sector || task.sector === sector));
  const visibleTask = (task: State["tasks"][number]) => laboratory && actor
    ? calendarCanAccessTask(state, actor, task)
    : !actor || canSee(actor, task.ownerId, state.profiles) || isResponsible(task, actor.id) || coverageFor(state, task)?.replacementId === actor.id;
  const done = (task: State["tasks"][number]) => task.kind === "operativa" ? (!laboratory && task.target > 0 && taskQuantity(task, state.activity) >= task.target) : task.status === "Completada";
  const rows = matches.filter((task) => visibleTask(task) && task.due.startsWith(calendarMonth) && (completed || !done(task)))
    .sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title, "es"));
  const notes = (state.annotations || []).filter((annotation) => annotation.ownerId === (actor?.id || state.activeId) && annotation.reminderOn?.startsWith(calendarMonth) && !annotation.convertedTaskId);
  const undated = matches.filter((task) => visibleTask(task) && task.month === calendarMonth && !task.due && !done(task));
  const events = laboratory && actor ? visibleCalendarEvents(state, actor, calendarMonth) : [];
  const obligations = laboratory && actor ? visibleFiscalObligations(state, actor.id, calendarMonth, company) : [];
  const absences = laboratory && actor ? (state.absences || []).filter((absence) => !absence.cancelledAt && absence.from.slice(0, 7) <= calendarMonth && absence.to.slice(0, 7) >= calendarMonth && canSee(actor, absence.ownerId, state.profiles)) : [];
  const recipientOptions = laboratory && actor ? eligibleCalendarRecipients(state, actor, eventCompanyId || null) : [];
  const requiredRecipientIds = new Set(laboratory && actor ? calendarRecipients(state, actor, eventCompanyId || null).filter((id) => id !== actor.id) : []);
  const days = useMemo(() => {
    const [year, monthNumber] = calendarMonth.split("-").map(Number);
    const firstWeekday = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
    const total = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return [...Array(firstWeekday).fill(null), ...Array.from({ length: total }, (_, index) => `${calendarMonth}-${String(index + 1).padStart(2, "0")}`)];
  }, [calendarMonth]);
  const gridDays = useMemo(() => [...days, ...Array((7 - days.length % 7) % 7).fill(null)], [days]);
  const counts = new Map<string, number>();
  for (const task of rows) counts.set(task.due, (counts.get(task.due) || 0) + 1);
  for (const obligation of obligations) counts.set(obligation.dueOn, (counts.get(obligation.dueOn) || 0) + 1);
  for (const day of days.filter((value): value is string => !!value)) {
    for (const event of events) if (event.startOn <= day && event.endOn >= day) counts.set(day, (counts.get(day) || 0) + 1);
    for (const absence of absences) if (absence.from <= day && absence.to >= day) counts.set(day, (counts.get(day) || 0) + 1);
  }
  const selectedTasks = rows.filter((task) => task.due === selectedDay);
  const selectedObligations = obligations.filter((row) => row.dueOn === selectedDay);
  const selectedEvents = events.filter((event) => event.startOn <= selectedDay && event.endOn >= selectedDay);
  const selectedAbsences = absences.filter((absence) => absence.from <= selectedDay && absence.to >= selectedDay);

  const openFiscalOrigin = (id: string, period: string, companyId: string) => {
    if (!actor) return;
    const accessible = visibleFiscalObligations(state, actor.id, period, companyId).some((row) => row.id === id);
    if (!accessible) {
      notify?.("La obligación ya no está disponible en tu ámbito. Revisá el período y los permisos actuales.");
      return;
    }
    const token = ++fiscalFocusToken.current;
    setFiscalPeriod(period);
    setFiscalFocus({ id, token });
  };

  useEffect(() => {
    const day = requestedDayFocus.current;
    if (!day || day !== selectedDay) return;
    const target = document.querySelector<HTMLButtonElement>(`[data-calendar-day="${day}"]`);
    if (!target) return;
    requestedDayFocus.current = null;
    target.focus();
  }, [calendarMonth, selectedDay, days]);

  const moveCalendarFocus = (day: string, key: string) => {
    const [year, monthNumber, dateNumber] = day.split("-").map(Number);
    const date = new Date(Date.UTC(year, monthNumber - 1, dateNumber));
    if (key === "ArrowLeft") date.setUTCDate(date.getUTCDate() - 1);
    else if (key === "ArrowRight") date.setUTCDate(date.getUTCDate() + 1);
    else if (key === "ArrowUp") date.setUTCDate(date.getUTCDate() - 7);
    else if (key === "ArrowDown") date.setUTCDate(date.getUTCDate() + 7);
    else if (key === "Home") date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    else if (key === "End") date.setUTCDate(date.getUTCDate() + (6 - ((date.getUTCDay() + 6) % 7)));
    else if (key === "PageUp" || key === "PageDown") {
      const targetMonth = monthNumber - 1 + (key === "PageUp" ? -1 : 1);
      const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
      date.setTime(Date.UTC(year, targetMonth, Math.min(dateNumber, lastDay)));
    } else return;
    const nextDay = date.toISOString().slice(0, 10);
    requestedDayFocus.current = nextDay;
    if (nextDay.slice(0, 7) !== calendarMonth) setCalendarMonth(nextDay.slice(0, 7));
    setSelectedDay(nextDay);
  };

  const createEvent = (form: HTMLFormElement) => {
    if (!actor || !commit || !notify) return;
    const data = new FormData(form);
    try {
      const linkedTaskId = String(data.get("linkedTaskId") || "");
      const next = createCalendarEvent(state, actor.id, { companyId: String(data.get("companyId") || "") || null,
        kind: String(data.get("kind")) as "balance_close" | "audit" | "important" | "custom", title: String(data.get("title") || ""),
        description: String(data.get("description") || ""), startOn: String(data.get("startOn")), endOn: String(data.get("endOn")),
        recipientIds: shareAll ? recipientOptions.map((profile) => profile.id) : recipients, linkedTaskId: linkedTaskId || null });
      if (commit(next, "Compartió una fecha en el calendario", next.calendarEvents?.at(-1)?.id)) {
        setFormOpen(false); setRecipients([]); setShareAll(false); notify("Fecha guardada. Los superiores correspondientes quedaron incluidos en los avisos.");
      }
    } catch (error) { notify(error instanceof Error ? error.message : "No se pudo guardar la fecha."); }
  };
  const changeEvent = (eventId: string, change: { title?: string; description?: string; startOn?: string; endOn?: string } = {}, cancel = false) => {
    if (!actor || !commit || !notify) return;
    try {
      const next = changeCalendarEvent(state, eventId, actor.id, change, cancel);
      if (commit(next, cancel ? "Canceló una fecha del calendario" : "Actualizó una fecha del calendario", eventId)) {
        setEditingEvent(null);
        notify(cancel ? "Fecha cancelada y aviso local enviado." : "Fecha actualizada y aviso local enviado.");
      }
    } catch (error) { notify(error instanceof Error ? error.message : "No se pudo actualizar la fecha."); }
  };

  return <>
    {laboratory && actor && commit && notify && <Panel title="Calendario y fechas importantes" sub="Vencimientos, obligaciones, auditorías, cierres y ausencias en una sola vista. Las fechas derivadas abren su trabajo de origen." collapsible defaultOpen>
      <div className="calendar-toolbar" data-tour="calendar-agenda"><button type="button" aria-label="Mes anterior" onClick={() => { const next = shiftMonth(calendarMonth, -1); setCalendarMonth(next); setSelectedDay(`${next}-01`); }}><ArrowLeft size={15} /></button><strong>{new Date(`${calendarMonth}-15T12:00:00`).toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</strong><button type="button" aria-label="Mes siguiente" onClick={() => { const next = shiftMonth(calendarMonth, 1); setCalendarMonth(next); setSelectedDay(`${next}-01`); }}><ArrowRight size={15} /></button><button className="primary" type="button" onClick={() => setFormOpen((value) => !value)}><Plus size={14} /> Nueva fecha</button></div>
      <div className="calendar-layout"><div className="calendar-grid" data-tour="calendar-grid" role="grid" aria-label="Calendario mensual" aria-colcount={7}>
        <div className="calendar-grid-row calendar-weekday-row" role="row">{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => <b className="calendar-weekday" role="columnheader" key={day}>{day}</b>)}</div>
        {Array.from({ length: gridDays.length / 7 }, (_, weekIndex) => <div className="calendar-grid-row" role="row" key={`week-${weekIndex}`}>
          {gridDays.slice(weekIndex * 7, weekIndex * 7 + 7).map((day, dayIndex) => day ? <div role="gridcell" aria-selected={selectedDay === day} key={day}><button type="button" data-calendar-day={day} tabIndex={selectedDay === day ? 0 : -1} aria-current={day === dateART() ? "date" : undefined} aria-label={`${dateLabel(day)}${counts.get(day) ? `, ${counts.get(day)} elementos` : ""}`} className={selectedDay === day ? "selected" : ""} onClick={() => setSelectedDay(day)} onKeyDown={(event) => {
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) {
              event.preventDefault();
              moveCalendarFocus(day, event.key);
            }
          }}><span>{Number(day.slice(-2))}</span>{!!counts.get(day) && <i>{counts.get(day)}</i>}</button></div> : <div role="gridcell" aria-disabled="true" key={`blank-${weekIndex}-${dayIndex}`} />)}
        </div>)}
      </div><section className="calendar-day-detail" data-tour="calendar-day-detail"><h3><CalendarDays size={16} /> {dateLabel(selectedDay)}</h3>
        {!selectedTasks.length && !selectedObligations.length && !selectedEvents.length && !selectedAbsences.length && <div data-tour="calendar-empty"><Empty text="No hay fechas para este día." /></div>}
        {selectedTasks.map((task) => <article key={task.id}><b>{task.title}</b><small>{state.companies.find((row) => row.id === task.companyId)?.name} · {state.profiles.find((row) => row.id === task.ownerId)?.name} · {task.kind === "operativa" ? laboratory ? `${taskQuantity(task, state.activity)} ${task.unit || "movimientos"} registrados` : `${taskQuantity(task, state.activity)} / ${task.target} ${task.unit}` : task.status}</small><button type="button" onClick={() => openTask(task.id)}>{laboratory ? "Abrir tarea" : "Abrir tarjeta"}</button></article>)}
        {selectedObligations.map((row) => <article key={row.id}><b>{row.title} · {row.milestone}</b><small>{state.companies.find((companyRow) => companyRow.id === row.companyId)?.name} · período fiscal {row.fiscalPeriod} · origen: {row.sourceLabel} · revisión {row.sourceRevision}</small><button type="button" onClick={() => openFiscalOrigin(row.id, row.fiscalPeriod, row.companyId)}>Abrir obligación de origen</button></article>)}
        {selectedEvents.map((event) => {
          const linked = event.linkedTaskId ? state.tasks.find((task) => task.id === event.linkedTaskId) : undefined;
          const manager = isEventManager(state, actor, event);
          const eventKind = ({ balance_close: "Cierre de balance", audit: "Auditoría", important: "Fecha importante", custom: "Otra fecha" } as const)[event.kind];
          const companyName = event.companyId ? state.companies.find((row) => row.id === event.companyId)?.name : "Todas las empresas autorizadas";
          const recipientNames = event.recipientIds.map((id) => state.profiles.find((profile) => profile.id === id)?.name).filter((name): name is string => !!name);
          return <article key={event.id} className={event.cancelledAt ? "cancelled" : ""}>
            <b>{event.title}{event.cancelledAt ? " · Cancelada" : ""}</b>
            <small>{eventKind} · {companyName || "Empresa sin nombre"} · {dateLabel(event.startOn)}{event.endOn !== event.startOn ? ` – ${dateLabel(event.endOn)}` : ""} · Creada por {state.profiles.find((profile) => profile.id === event.authorId)?.name || "Perfil inactivo"}</small>
            {event.description && <p className="calendar-event-description">{event.description}</p>}
            <small>Compartida con: {recipientNames.join(", ") || "sin destinatarios adicionales"}</small>
            {linked && actor && calendarCanAccessTask(state, actor, linked) && <button type="button" onClick={() => openTask(linked.id)}>Abrir tarea vinculada</button>}
            {manager && !event.cancelledAt && <>
              <button type="button" className="text-button" aria-expanded={editingEvent === event.id} onClick={() => setEditingEvent((current) => current === event.id ? null : event.id)}>Editar fecha</button>
              <button type="button" className="text-button" onClick={() => changeEvent(event.id, {}, true)}><X size={13} /> Cancelar fecha</button>
            </>}
            {manager && !event.cancelledAt && editingEvent === event.id && <form className="calendar-event-edit" onSubmit={(formEvent) => {
              formEvent.preventDefault();
              const values = new FormData(formEvent.currentTarget);
              changeEvent(event.id, { title: String(values.get("title") || ""), description: String(values.get("description") || ""), startOn: String(values.get("startOn") || ""), endOn: String(values.get("endOn") || "") });
            }}>
              <label>Título<input name="title" maxLength={120} required defaultValue={event.title} /></label>
              <div className="form-grid"><label>Desde<input name="startOn" type="date" required defaultValue={event.startOn} /></label><label>Hasta<input name="endOn" type="date" required defaultValue={event.endOn} /></label></div>
              <label>Detalle<input name="description" maxLength={1000} defaultValue={event.description} /></label>
              <button className="primary">Guardar cambios y avisar</button>
            </form>}
          </article>;
        })}
        {selectedAbsences.map((absence) => <article key={absence.id}><b>{absence.kind} · {state.profiles.find((profile) => profile.id === absence.ownerId)?.name}</b><small>{dateLabel(absence.from)} – {dateLabel(absence.to)}{absence.replacementId ? ` · cobertura: ${state.profiles.find((profile) => profile.id === absence.replacementId)?.name}` : ""}</small></article>)}
      </section></div>
      {formOpen && <form className="calendar-event-form" onSubmit={(event) => { event.preventDefault(); createEvent(event.currentTarget); }}>
        <h3>Compartir una fecha</h3><div className="form-grid"><label>Tipo<select name="kind"><option value="important">Fecha importante</option><option value="audit">Auditoría</option><option value="balance_close">Cierre de balance</option><option value="custom">Otra fecha</option></select></label><label>Empresa<select name="companyId" value={eventCompanyId} onChange={(event) => { setEventCompanyId(event.target.value); setRecipients([]); }}><option value="">Todas mis empresas</option>{state.companies.filter((row) => actor.companyIds.includes(row.id) || actor.role === "jefe").map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label>Título<input name="title" maxLength={120} required /></label><label>Desde<input name="startOn" type="date" defaultValue={selectedDay} required /></label><label>Hasta<input name="endOn" type="date" defaultValue={selectedDay} required /></label><label>Vincular tarea (opcional)<select name="linkedTaskId"><option value="">Sin vínculo</option>{!eventCompanyId && <option disabled>Seleccioná una empresa para vincular tareas</option>}{eventCompanyId && state.tasks.filter((task) => task.companyId === eventCompanyId && calendarCanAccessTask(state, actor, task)).map((task) => <option key={task.id} value={task.id}>{task.title} · {state.companies.find((row) => row.id === task.companyId)?.name}</option>)}</select></label></div><label>Detalle<input name="description" maxLength={1000} /></label>
        <div className="calendar-recipient-picker"><b>Compartir con…</b><label><input type="checkbox" checked={shareAll} onChange={(event) => setShareAll(event.target.checked)} /> Todos los perfiles autorizados</label>{!shareAll && recipientOptions.map((profile) => { const required = requiredRecipientIds.has(profile.id); return <label key={profile.id}><input type="checkbox" checked={required || recipients.includes(profile.id)} disabled={required} onChange={(event) => setRecipients((current) => event.target.checked ? [...current, profile.id] : current.filter((id) => id !== profile.id))} /> {profile.name} · {profile.position}{required ? " · Superior obligatorio" : ""}</label>; })}<small>Los superiores autorizados quedan incluidos. Compartir la fecha no amplía el acceso a las tareas vinculadas.</small></div><div className="modal-actions"><button type="button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary">Guardar fecha</button></div>
      </form>}
      {!!rows.length && <details className="calendar-deadline-list"><summary>{rows.length} vencimientos del mes</summary><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Trabajo</th><th>Empresa</th><th>Responsable</th><th>Estado</th><th /></tr></thead><tbody>{rows.map((task) => <tr key={task.id}><td>{dateLabel(task.due)}</td><td><strong>{task.title}</strong><small>{task.kind === "operativa" ? laboratory ? `${taskQuantity(task, state.activity)} ${task.unit || "movimientos"} registrados` : `${taskQuantity(task, state.activity)} / ${task.target} ${task.unit}` : task.status}</small></td><td>{state.companies.find((row) => row.id === task.companyId)?.name}</td><td>{state.profiles.find((row) => row.id === task.ownerId)?.name}</td><td>{task.kind === "operativa" ? "Actividad continua" : <TimelinessBadge value={taskTimeliness(task, state.activity, new Date().toISOString())} />}</td><td><button type="button" onClick={() => openTask(task.id)}>Abrir</button></td></tr>)}</tbody></table></div></details>}
      {notes.length > 0 && <div className="note">{notes.length} recordatorio(s) personal(es) de tu perfil en este mes. <button type="button" onClick={openNotes}>Ver anotaciones</button></div>}
      {!!undated.length && <details><summary>{undated.length} trabajos sin vencimiento</summary>{undated.map((task) => <p key={task.id}><button type="button" onClick={() => openTask(task.id)}>{task.title} · {state.companies.find((row) => row.id === task.companyId)?.name}</button></p>)}</details>}
    </Panel>}
    {!laboratory && <Panel title="Agenda y objetivos del mes" sub="Incluye entregables, metas operativas y recordatorios personales." collapsible defaultOpen>
      <label className="check-line" data-tour="calendar-agenda-basic"><input type="checkbox" checked={completed} onChange={(event) => setCompleted(event.target.checked)} />Mostrar también objetivos cumplidos</label>
      {!rows.length && !notes.length ? <Empty text="No hay vencimientos pendientes en esta selección." /> : <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Trabajo</th><th>Empresa</th><th>Responsable</th><th>Estado</th><th /></tr></thead><tbody>{rows.map((task) => <tr key={task.id}><td className={!done(task) && task.due < dateART() ? "danger" : ""}>{dateLabel(task.due)}</td><td><strong>{task.title}</strong><small>{task.kind === "operativa" ? laboratory ? `${taskQuantity(task, state.activity)} ${task.unit || "movimientos"} registrados` : `${taskQuantity(task, state.activity)} / ${task.target} ${task.unit}` : task.status}</small></td><td>{state.companies.find((row) => row.id === task.companyId)?.name}</td><td>{state.profiles.find((row) => row.id === task.ownerId)?.name}</td><td>{task.kind === "operativa" && laboratory ? "Actividad continua" : <TimelinessBadge value={taskTimeliness(task, state.activity, new Date().toISOString())} />}</td><td><button type="button" onClick={() => openTask(task.id)}>{laboratory ? "Abrir tarea" : "Abrir tarjeta"}</button></td></tr>)}{notes.map((annotation) => <tr key={annotation.id}><td>{dateLabel(annotation.reminderOn!)}</td><td>{annotation.title}<small>Recordatorio personal</small></td><td>—</td><td>Vos</td><td>Pendiente</td><td><button type="button" onClick={openNotes}>Ver anotación</button></td></tr>)}</tbody></table></div>}
    </Panel>}
    {laboratory && actor && commit && notify && <FiscalObligations state={state} actor={actor} month={fiscalPeriod} company={company} commit={commit} notify={notify} openTask={openTask} focusRequest={fiscalFocus} onFocusHandled={(token) => setFiscalFocus((current) => current?.token === token ? null : current)} />}
  </>;
}
