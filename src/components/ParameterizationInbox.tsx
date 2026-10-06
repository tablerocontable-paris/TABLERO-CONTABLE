import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { type State } from "../domain/model";
import {
  pendingParameterizations,
  confirmParameters,
} from "../domain/parameterization";
import { Dialog } from "./ui";

export default function ParameterizationInbox({
  state,
  commit,
  notify,
}: {
  state: State;
  commit: (s: State, action?: string, id?: string) => boolean;
  notify: (message: string) => void;
}) {
  const [profileId, setProfileId] = useState("");
  const [values, setValues] = useState<
    { id: string; weight: number; target: number }[]
  >([]);
  const actor = state.profiles.find((p) => p.id === state.activeId);
  const pending = pendingParameterizations(state);
  if (actor?.role !== "jefe" || !pending.length) return null;
  const profile = state.profiles.find((p) => p.id === profileId);
  const assignments = state.assignments.filter(
    (a) => a.ownerId === profileId && !a.retired,
  );
  return (
    <>
      <details className="parameterization-inbox">
        <summary>
          <Bell size={18} aria-hidden="true" />
          <strong>Pendiente parametrizar pesos y objetivos</strong>
          <span>{pending.length} perfiles</span>
        </summary>
        <p>
          Estos perfiles completaron su inducción. El aviso permanece hasta que
          jefatura confirme sus parámetros.
        </p>
        {pending.map((p) => (
          <div className="parameterization-person" key={p.id}>
            <span>
              <strong>{p.name}</strong>
              <small>Perfil completado · revisión pendiente</small>
            </span>
            <button
              onClick={() => {
                setProfileId(p.id);
                setValues(
                  state.assignments
                    .filter((a) => a.ownerId === p.id && !a.retired)
                    .map((a) => ({
                      id: a.id,
                      weight: a.weight,
                      target: a.target,
                    })),
                );
              }}
            >
              Revisar {p.name}
            </button>
          </div>
        ))}
      </details>
      {profile && (
        <Dialog
          title={"Pesos y objetivos · " + profile.name}
          onClose={() => setProfileId("")}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const next = confirmParameters(
                  state,
                  profileId,
                  actor.id,
                  values,
                );
                if (commit(next, "Confirmó pesos y objetivos", profileId)) {
                  setProfileId("");
                  notify(
                    "Parámetros confirmados. El aviso de este perfil quedó resuelto.",
                  );
                }
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            <p>
              Se aplican a nuevas ocurrencias y tareas sin iniciar. El trabajo
              iniciado y los cierres conservan sus valores históricos.
            </p>
            {!assignments.length && (
              <p role="alert">
                Este perfil todavía no tiene tareas asignadas. Preparalas en
                Planificación antes de confirmar.
              </p>
            )}
            {assignments.map((a, i) => (
              <fieldset className="parameterization-fields" key={a.id}>
                <legend>
                  {a.title} ·{" "}
                  {state.companies.find((c) => c.id === a.companyId)?.name}
                </legend>
                <label>
                  Peso
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step="any"
                    required
                    value={values[i].weight}
                    onChange={(e) =>
                      setValues(
                        values.map((v) =>
                          v.id === a.id
                            ? { ...v, weight: Number(e.target.value) }
                            : v,
                        ),
                      )
                    }
                  />
                </label>
                {a.kind === "operativa" && (
                  <label>
                    Objetivo · {a.unit}
                    <input
                      type="number"
                      min={1}
                      max={1000000}
                      step="any"
                      required
                      value={values[i].target}
                      onChange={(e) =>
                        setValues(
                          values.map((v) =>
                            v.id === a.id
                              ? { ...v, target: Number(e.target.value) }
                              : v,
                          ),
                        )
                      }
                    />
                  </label>
                )}
              </fieldset>
            ))}
            <div className="modal-actions">
              <button className="primary" disabled={!assignments.length}>
                <Check size={16} />
                Confirmar parámetros
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
