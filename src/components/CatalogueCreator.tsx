import { useState, type FormEvent } from "react";
import { id, type State, type Template } from "../domain/model";
import { addCatalogueTemplate } from "../domain/processImprovement";
import { Dialog } from "./ui";
import StepListEditor, { validateSteps } from "./StepListEditor";
export default function CatalogueCreator({
  state,
  commit,
  notify,
  versioned = true,
}: {
  state: State;
  commit: (s: State, a: string, id?: string) => boolean;
  notify: (s: string) => void;
  versioned?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Template["kind"]>("resultado");
  const [steps, setSteps] = useState<string[]>([]);
  const [stepsError, setStepsError] = useState("");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.profiles.find((p) => p.id === state.activeId)?.role !== "jefe")
      return;
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title")).trim();
    const normalized = (v: string) =>
      v.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("es");
    if (
      state.templates.some((t) => normalized(t.title) === normalized(title))
    ) {
      notify("Ese proceso ya existe. Usá el mismo catálogo para cada empresa.");
      return;
    }
    let safeSteps: string[];
    try {
      safeSteps = validateSteps(steps);
    } catch (error) {
      setStepsError((error as Error).message);
      return;
    }
    if (!title || !safeSteps.length) {
      notify("El proceso necesita un nombre y al menos un control estándar.");
      return;
    }
    const t: Template = {
      id: id(),
      title,
      sector: String(f.get("sector")),
      kind,
      weight: Number(f.get("weight")),
      unit: kind === "operativa" ? String(f.get("unit")).trim() : "",
      target: kind === "operativa" ? Number(f.get("target")) : 0,
      description: String(f.get("description")).trim(),
      steps: safeSteps,
    };
    const actor = state.profiles.find((profile) => profile.id === state.activeId);
    if (!actor) return;
    const next = versioned
      ? addCatalogueTemplate(state, t, actor)
      : { ...state, templates: [...state.templates, t] };
    if (commit(next, "Creó proceso estándar", t.id)) {
      setOpen(false);
      setSteps([]);
      setStepsError("");
      notify("Proceso incorporado al catálogo para todas las empresas.");
    }
  }
  return (
    <>
      <button onClick={() => setOpen(true)}>Incorporar proceso estándar</button>
      {open && (
        <Dialog
          title="Nuevo proceso del catálogo"
          onClose={() => setOpen(false)}
          wide
        >
          <p>
            Definí el proceso una vez. En las asignaciones se seleccionan la
            empresa, responsable, frecuencia y meta; el nombre y controles se
            conservan.
          </p>
          <form onSubmit={submit}>
            <label>
              Nombre estándar
              <input
                name="title"
                required
                maxLength={120}
                placeholder="Conciliación Banco Galicia"
              />
            </label>
            <label>
              Objetivo del proceso
              <textarea name="description" required maxLength={1000} />
            </label>
            <div className="form-grid">
              <label>
                Sector
                <select name="sector">
                  {["Tesorería", "Impuestos", "Contabilidad general"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Tipo
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as Template["kind"])}
                >
                  <option value="resultado">Entregable</option>
                  <option value="operativa">Operativa</option>
                </select>
              </label>
              <label>
                Peso
                <select name="weight" defaultValue="3">
                  {[1, 2, 3, 5, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} puntos
                    </option>
                  ))}
                </select>
              </label>
              {kind === "operativa" && (
                <>
                  <label>
                    Unidad
                    <input name="unit" required maxLength={30} />
                  </label>
                  <label>
                    Meta sugerida por ocurrencia
                    <input
                      name="target"
                      type="number"
                      min="1"
                      max="1000000"
                      defaultValue="1"
                      required
                    />
                  </label>
                </>
              )}
            </div>
            <div className="checklist-field">
              <p className="checklist-field-title">Proceso y controles · un paso por línea</p>
              <StepListEditor
                name="steps"
                value={steps}
                error={stepsError}
                emptyMessage="Agregá al menos un control estándar para guardar este proceso."
                onChange={(next) => { setSteps(next); setStepsError(""); }}
              />
            </div>
            <div className="modal-actions">
              <button className="primary">Guardar proceso estándar</button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
