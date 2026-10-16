import { useState } from "react";
import { Panel } from "./ui";
import type { State } from "../domain/model";
export default function WorkspaceSetup({
  state,
  commit,
  presence,
}: {
  state: State;
  commit: (s: State, a?: string, id?: string) => boolean;
  presence: Record<string, string>;
}) {
  const [names, setNames] = useState(state.companies.map((c) => ({ ...c })));
  function exportBackup() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { exportedAt: new Date().toISOString(), state },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "tablero-paris-respaldo-" +
      new Date().toISOString().slice(0, 10) +
      ".json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Panel
      title="Empresas y acceso"
      sub="Renombrá las cuatro empresas antes de asignar trabajo. Cada tarjeta conserva su empresa y período."
      collapsible
      defaultOpen
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commit(
            {
              ...state,
              companies: names.map((c) => ({ ...c, name: c.name.trim() })),
            },
            "Configuró empresas",
          );
        }}
      >
        <div className="form-grid">
          {names.map((c, i) => (
            <label key={c.id}>
              Empresa {i + 1}
              <input
                required
                maxLength={120}
                value={c.name}
                onChange={(e) =>
                  setNames(
                    names.map((x) =>
                      x.id === c.id ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button className="primary">Guardar empresas</button>
          <button type="button" onClick={exportBackup}>
            Exportar datos del tablero
          </button>
        </div>
      </form>
      <p className="access-note">
        El acceso al sitio sigue habilitado sólo para su propietario. Podés
        preparar perfiles y tareas para el equipo; habilitar otras personas
        requiere tu aprobación.
      </p>
      <details>
        <summary>Actividad de las cuentas</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Correo de acceso</th>
                <th>Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {state.profiles
                .filter((p) => p.id !== "admin")
                .map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.email || "Por configurar"}</td>
                    <td>
                      {presence[p.id]
                        ? new Date(presence[p.id]).toLocaleString("es-AR")
                        : "Aún no ingresó"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p>
          La última actividad se actualiza mientras el tablero está abierto; no
          mide productividad.
        </p>
      </details>
    </Panel>
  );
}
