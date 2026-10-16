import { useState } from "react";
import { type State } from "../domain/model";
import { addTaskComment } from "../domain/notifications";

export default function TaskComments({
  state,
  taskId,
  commit,
  notify,
}: {
  state: State;
  taskId: string;
  commit: (s: State, action?: string, id?: string) => boolean;
  notify: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <section className="task-comments">
      <h3>Comentarios de la tarea</h3>
      <p>
        Visibles para el responsable, sus superiores y quienes tengan cobertura
        autorizada.
      </p>
      {(state.taskComments || [])
        .filter((c) => c.taskId === taskId)
        .map((c) => (
          <article key={c.id}>
            <strong>
              {state.profiles.find((p) => p.id === c.actorId)?.name}
            </strong>
            <p>{c.content}</p>
          </article>
        ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (
              commit(
                addTaskComment(state, taskId, text),
                "Comentó una tarea",
                taskId,
              )
            )
              setText("");
          } catch (error) {
            notify((error as Error).message);
          }
        }}
      >
        <label>
          Nuevo comentario
          <textarea
            required
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button className="primary">Publicar comentario</button>
      </form>
    </section>
  );
}
