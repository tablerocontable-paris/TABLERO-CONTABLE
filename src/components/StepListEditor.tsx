import { Plus, Trash2 } from "lucide-react";
export const parseSteps = (text: string) =>
  text
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean);

export function validateSteps(value: string[]): string[] {
  const steps = value.map((step) => step.trim()).filter(Boolean);
  if (steps.length > 50)
    throw new Error("El checklist admite hasta 50 pasos.");
  if (steps.some((step) => step.length > 300))
    throw new Error("Cada paso debe tener 300 caracteres o menos.");
  return steps;
}

export default function StepListEditor({
  value,
  onChange,
  name,
  readOnly = false,
  error,
  emptyMessage = "No hay controles agregados todavía.",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  name?: string;
  readOnly?: boolean;
  error?: string;
  emptyMessage?: string;
}) {
  const steps = value.length ? value : [];
  return (
    <div className="step-list-editor">
      {steps.map((step, index) => (
        <div className="step-editor-row" key={index}>
          <span aria-hidden="true">{index + 1}</span>
          <input
            aria-label={`Paso ${index + 1}`}
            value={step}
            readOnly={readOnly}
            placeholder="Escribí un control o paso"
            onChange={(event) => {
              const next = [...steps];
              next[index] = event.target.value;
              onChange(next);
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !readOnly &&
                steps.length < 50
              ) {
                event.preventDefault();
                onChange([...steps, ""]);
              }
            }}
          />
          {!readOnly && (
            <button
              type="button"
              aria-label={`Quitar paso ${index + 1}`}
              onClick={() => onChange(steps.filter((_, i) => i !== index))}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ))}
      {steps.length === 0 && !readOnly && (
        <p className="step-list-empty">{emptyMessage}</p>
      )}
      {!readOnly && (
        <button
          type="button"
          className="step-add"
          disabled={steps.length >= 50}
          onClick={() => onChange([...steps, ""])}
        >
          <Plus size={15} /> Agregar paso
        </button>
      )}
      {error && <p className="step-list-error" role="alert">{error}</p>}
      {name && <input type="hidden" name={name} value={parseSteps(steps.join("\n")).join("\n")} />}
      {readOnly && steps.length === 0 && <p>Este proceso no tiene controles definidos.</p>}
    </div>
  );
}
