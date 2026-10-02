import { Plus, Trash2 } from "lucide-react";
export const parseSteps = (text: string) =>
  text
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, 50);

export default function StepListEditor({
  value,
  onChange,
  name,
  readOnly = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  name?: string;
  readOnly?: boolean;
}) {
  const steps = value.length ? value : [];
  return (
    <div className="step-list-editor">
      {steps.map((step, index) => (
        <div className="step-editor-row" key={index}>
          <span aria-hidden="true">{index + 1}</span>
          <input
            aria-label={`Paso ${index + 1}`}
            maxLength={300}
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
      {name && <input type="hidden" name={name} value={parseSteps(steps.join("\n")).join("\n")} />}
      {readOnly && steps.length === 0 && <p>Este proceso no tiene controles definidos.</p>}
    </div>
  );
}
