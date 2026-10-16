import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { dateART, type State } from "../domain/model";
import { visibleNotifications } from "../domain/notifications";
import { deadlineReminders, markDeadlineRemindersRead } from "../domain/deadlineNotifications";
import { pendingParameterizations } from "../domain/parameterization";
import ParameterizationInbox from "./ParameterizationInbox";
import { Dialog } from "./ui";
import { pendingHabitualTaskProposals } from "../domain/habitualTaskProposals";
import { canViewCalendarEvent } from "../domain/laboratory-work";

export default function NotificationCenter({
  state,
  commit,
  notify,
  onOpenTask,
  onOpenProposals,
  onOpenCalendar,
  laboratory = false,
}: {
  laboratory?: boolean;
  state: State;
  commit: (s: State, action?: string, id?: string) => boolean;
  notify: (text: string) => void;
  onOpenTask: (id: string) => void;
  onOpenProposals?: () => void;
  onOpenCalendar?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [asOfISO, setAsOfISO] = useState(() => new Date().toISOString());
  const artDay = dateART(asOfISO);
  useEffect(() => {
    const [year, month, day] = artDay.split("-").map(Number);
    const nextARTMidnight = Date.UTC(year, month - 1, day + 1, 3, 0, 0, 25);
    const refresh = () => setAsOfISO(new Date().toISOString());
    const timer = window.setTimeout(refresh, Math.max(1, nextARTMidnight - Date.now()));
    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [artDay]);
  const items = visibleNotifications(state);
  const reminders = laboratory ? deadlineReminders(state, asOfISO) : [];
  const pending =
    state.profiles.find((p) => p.id === state.activeId)?.role === "jefe"
      ? pendingParameterizations(state).length
      : 0;
  const actor = state.profiles.find((p) => p.id === state.activeId);
  const pendingProposals = actor ? pendingHabitualTaskProposals(state, actor).length : 0;
  const calendarNotices = laboratory ? (state.calendarNotices || []).filter((notice) => notice.recipientId === state.activeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  const calendarNoticeRows = calendarNotices.map((notice) => {
    const currentEvent = state.calendarEvents?.find((row) => row.id === notice.eventId);
    return { notice, event: actor && currentEvent && canViewCalendarEvent(state, actor, currentEvent) ? currentEvent : null };
  });
  const unreadCalendar = calendarNotices.filter((notice) => !notice.readAt).length;
  const unread = items.filter((n) => !n.readAt).length;
  const unreadReminders = reminders.filter((reminder) => !reminder.readAt).length;
  const totalUnread = unread + unreadReminders + unreadCalendar + pending + pendingProposals;
  return (
    <>
      <button
        className="notification-trigger"
        aria-label={`Notificaciones: ${totalUnread} pendientes`}
        onClick={() => { setAsOfISO(new Date().toISOString()); setOpen(true); }}
      >
        <Bell size={19} />
        {totalUnread > 0 && <span>{totalUnread}</span>}
      </button>
      {open && (
        <Dialog title="Notificaciones" onClose={() => setOpen(false)}>
          {!!pendingProposals && (
            <div className="proposal-notification">
              <strong>{pendingProposals} propuesta{pendingProposals === 1 ? "" : "s"} de tareas habituales para revisar</strong>
              <p>Las tareas quedan sin activar hasta confirmar un estándar.</p>
              <button onClick={() => { setOpen(false); onOpenProposals?.(); }}>Revisar propuestas</button>
            </div>
          )}
          <ParameterizationInbox
            state={state}
            commit={commit}
            notify={notify}
          />
          {!items.length && !reminders.length && !calendarNotices.length && !pendingProposals && !pending && <p>No hay avisos pendientes para tu perfil.</p>}
          {!!(unread + unreadReminders + unreadCalendar) && (
            <button onClick={() => {
              const readAt = new Date().toISOString();
              const currentReminders = laboratory ? deadlineReminders(state, readAt) : [];
              setAsOfISO(readAt);
              const eventsRead = {
                ...state,
                notifications: (state.notifications || []).map((n) =>
                  items.some((item) => item.id === n.id)
                    ? { ...n, readAt: n.readAt || readAt }
                    : n,
                ),
                calendarNotices: (state.calendarNotices || []).map((notice) => calendarNotices.some((item) => item.id === notice.id) ? { ...notice, readAt: notice.readAt || readAt } : notice),
              };
              commit(markDeadlineRemindersRead(eventsRead, currentReminders.map((reminder) => reminder.id), readAt, readAt));
            }}>
              Marcar avisos como leídos
            </button>
          )}
          <ul className="notification-list">
            {items.map((n) => {
              const task = state.tasks.find((t) => t.id === n.taskId)!;
              return (
                <li key={n.id} className={n.readAt ? "" : "unread"}>
                  <strong>{n.title}</strong>
                  <p>{task.title}</p>
                  <small>
                    {state.profiles.find((p) => p.id === n.actorId)?.name ||
                      "Integrante del equipo"}{" "}
                    · {new Date(n.createdAt).toLocaleString("es-AR")}
                  </small>
                  <button
                    onClick={() => {
                      if (
                        commit({
                          ...state,
                          notifications: (state.notifications || []).map(
                            (item) =>
                              item.id === n.id
                                ? {
                                    ...item,
                                    readAt:
                                      item.readAt || new Date().toISOString(),
                                  }
                                : item,
                          ),
                        })
                      ) {
                        setOpen(false);
                        onOpenTask(n.taskId);
                      }
                    }}
                  >
                    Abrir tarea
                  </button>
                </li>
              );
            })}
          </ul>
          {!!calendarNotices.length && <ul className="notification-list calendar-notification-list" aria-label="Avisos de fechas compartidas">{calendarNoticeRows.map(({ notice, event }) =>
            <li key={notice.id} className={notice.readAt ? "" : "unread"}>
              {event ? <>
                <strong>{notice.kind === "created" ? "Nueva fecha compartida" : notice.kind === "changed" ? "Fecha actualizada" : "Fecha cancelada"} · {event.title}</strong>
                <small>{event.startOn} · {state.profiles.find((profile) => profile.id === notice.actorId)?.name || "Equipo"}</small>
              </> : <strong>El acceso a una fecha compartida fue actualizado.</strong>}
              {event && <button type="button" onClick={() => { const readAt = new Date().toISOString(); if (commit({ ...state, calendarNotices: (state.calendarNotices || []).map((item) => item.id === notice.id ? { ...item, readAt: item.readAt || readAt } : item) })) { setOpen(false); onOpenCalendar?.(); } }}>Ver calendario</button>}
            </li>,
          )}</ul>}
          {!!reminders.length && (
            <ul className="notification-list deadline-reminder-list" aria-label="Avisos de vencimiento">
              {reminders.map((reminder) => (
                <li key={reminder.id} className={reminder.readAt ? "" : "unread"}>
                  <strong>{reminder.title}</strong>
                  <small>{new Date(asOfISO).toLocaleDateString("es-AR")} · Aviso de vencimiento</small>
                  <ul className="deadline-reminder-tasks">
                    {reminder.taskIds.map((taskId) => {
                      const task = state.tasks.find((entry) => entry.id === taskId);
                      if (!task) return null;
                      return (
                        <li key={task.id}>
                          <span>{task.title} · {state.companies.find((company) => company.id === task.companyId)?.name || "Empresa"} · vence {new Date(`${task.due}T12:00:00`).toLocaleDateString("es-AR")}</span>
                          <button
                            aria-label={`Abrir tarea: ${task.title}`}
                            onClick={() => {
                              const currentAsOfISO = new Date().toISOString();
                              setAsOfISO(currentAsOfISO);
                              const currentReminders = deadlineReminders(state, currentAsOfISO);
                              if (!currentReminders.some((item) => item.id === reminder.id)) return;
                              if (commit(markDeadlineRemindersRead(state, [reminder.id], currentAsOfISO, currentAsOfISO))) {
                                setOpen(false);
                                onOpenTask(task.id);
                              }
                            }}
                          >Abrir</button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Dialog>
      )}
    </>
  );
}
