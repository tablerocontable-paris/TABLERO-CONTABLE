import { useState } from "react";
import { Bell } from "lucide-react";
import { type State } from "../domain/model";
import { visibleNotifications } from "../domain/notifications";
import { deadlineReminders, markDeadlineRemindersRead } from "../domain/deadlineNotifications";
import { pendingParameterizations } from "../domain/parameterization";
import ParameterizationInbox from "./ParameterizationInbox";
import { Dialog } from "./ui";
import { pendingHabitualTaskProposals } from "../domain/habitualTaskProposals";

export default function NotificationCenter({
  state,
  commit,
  notify,
  onOpenTask,
  onOpenProposals,
  laboratory = false,
}: {
  laboratory?: boolean;
  state: State;
  commit: (s: State, action?: string, id?: string) => boolean;
  notify: (text: string) => void;
  onOpenTask: (id: string) => void;
  onOpenProposals?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [asOfISO, setAsOfISO] = useState(() => new Date().toISOString());
  const items = visibleNotifications(state);
  const reminders = laboratory ? deadlineReminders(state, asOfISO) : [];
  const pending =
    state.profiles.find((p) => p.id === state.activeId)?.role === "jefe"
      ? pendingParameterizations(state).length
      : 0;
  const actor = state.profiles.find((p) => p.id === state.activeId);
  const pendingProposals = actor ? pendingHabitualTaskProposals(state, actor).length : 0;
  const unread = items.filter((n) => !n.readAt).length;
  const unreadReminders = reminders.filter((reminder) => !reminder.readAt).length;
  return (
    <>
      <button
        className="notification-trigger"
        aria-label={`Notificaciones: ${unread + unreadReminders + pending + pendingProposals} pendientes`}
        onClick={() => { setAsOfISO(new Date().toISOString()); setOpen(true); }}
      >
        <Bell size={19} />
        {unread + unreadReminders + pending + pendingProposals > 0 && <span>{unread + unreadReminders + pending + pendingProposals}</span>}
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
          {!items.length && !reminders.length && !pendingProposals && !pending && <p>No hay avisos pendientes para tu perfil.</p>}
          {!!(unread + unreadReminders) && (
            <button onClick={() => {
              const readAt = new Date().toISOString();
              const eventsRead = {
                ...state,
                notifications: (state.notifications || []).map((n) =>
                  items.some((item) => item.id === n.id)
                    ? { ...n, readAt: n.readAt || readAt }
                    : n,
                ),
              };
              commit(markDeadlineRemindersRead(eventsRead, reminders.map((reminder) => reminder.id), asOfISO, readAt));
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
                              if (commit(markDeadlineRemindersRead(state, [reminder.id], asOfISO))) {
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
