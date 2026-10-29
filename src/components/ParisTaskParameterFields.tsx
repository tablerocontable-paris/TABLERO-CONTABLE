import {
  getParisTaskParameterChoices,
  getParisTask,
  getParisTaskUnverifiedParameterDetails,
  parisTaskParameterKey,
  requiredParisTaskParameterKeys,
} from "../domain/parisTaskCatalog";

export default function ParisTaskParameterFields({
  taskCode,
  version,
  values,
  onChange,
  lockedKeys,
}: {
  taskCode: string;
  version: number;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  lockedKeys?: ReadonlySet<string>;
}) {
  const task = getParisTask(taskCode, version);
  if (!task) return null;
  const required = requiredParisTaskParameterKeys(taskCode, version);
  const unverifiedDetails = getParisTaskUnverifiedParameterDetails(taskCode, version);
  const detailFields = Object.entries(unverifiedDetails).map(([controlledParameter, detail]) => ({
    controlledKey: controlledParameter,
    key: parisTaskParameterKey(detail.parameter),
    label: detail.label,
  }));

  function update(key: string, value: string) {
    const next = { ...values, [key]: value };
    if (value !== "unverified") {
      for (const detail of detailFields) {
        if (detail.controlledKey === key) delete next[detail.key];
      }
    }
    onChange(next);
  }

  return <div className="paris-task-parameter-fields">
    {task.parameters.map((label) => {
      const key = parisTaskParameterKey(label);
      const detailField = detailFields.find((detail) => detail.key === key);
      if (detailField && values[detailField.controlledKey] !== "unverified") return null;
      const choices = getParisTaskParameterChoices(taskCode, key, version);
      const isRequired = required.has(key) || !!detailField;
      const shownLabel = detailField?.label || label;
      const locked = lockedKeys?.has(key) === true;
      return <label key={key}>{shownLabel}{locked ? " · fijado por selección" : isRequired ? " · obligatorio" : " · opcional"}{choices.length > 0
        ? <select aria-label={`${label}${locked ? " · fijado por selección" : isRequired ? " · obligatorio" : " · opcional"}`} required={isRequired} disabled={locked} value={values[key] || ""} onChange={(event) => update(key, event.target.value)}>
            <option value="">Seleccioná una opción</option>
            {choices.map((choice) => <option key={choice.code} value={choice.code}>{choice.label}</option>)}
          </select>
        : <input aria-label={`${shownLabel}${isRequired ? " · obligatorio" : " · opcional"}`} maxLength={160} required={isRequired} value={values[key] || ""} placeholder={detailField ? "Se mantendrá fuera de comparaciones hasta normalizarlo" : isRequired ? "Dato necesario para medir" : "Opcional"} onChange={(event) => update(key, event.target.value)} />
      }</label>;
    })}
  </div>;
}
