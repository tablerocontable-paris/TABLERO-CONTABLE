import { useState } from "react";
import { Bell } from "lucide-react";
import { type State } from "../domain/model";
import { visibleNotifications } from "../domain/notifications";
import { pendingParameterizations } from "../domain/parameterization";
import ParameterizationInbox from "./ParameterizationInbox";
import { Dialog } from "./ui";

export default function NotificationCenter({
  state,
  commit,
  notify,
  onOpenTask,
}: {
  state: State;
  commit: (s: State, action?: string, id?: string) => boolean;
  notify: (text: string) => void;
  onOpenTask: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const items = visibleNotifications(state);
  const pending =
    state.profiles.find((p) => p.id === state.activeId)?.role === "jefe"
      ? pendingParameterizations(state).length
      : 0;
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <>
      <button
        className="notification-trigger"
        aria-label={`Notificaciones: ${unread + pending} pendientes`}
        onClick={() => setOpen(true)}
      >
        <Bell size={19} />
        {unread + pending > 0 && <span>{unread + pending}</span>}
      </button>
      {open && (
        <Dialog title="Notificaciones" onClose={() => setOpen(false)}>
          <ParameterizationInbox
            state={state}
            commit={commit}
            notify={notify}
          />
          {!items.length && <p>No hay avisos de tareas para tu perfil.</p>}
          {!!unread && (
            <button
              onClick={() =>
                commit({
                  ...state,
                  notifications: (state.notifications || []).map((n) =>
                    items.some((item) => item.id === n.id)
                      ? { ...n, readAt: n.readAt || new Date().toISOString() }
                      : n,
                  ),
                })
              }
            >
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
        </Dialog>
      )}
    </>
  );
}
