import type { Assignment, State } from "./model";

/** El contexto cambia por empresa; la identidad y controles los define el catálogo. */
export function standardizeAssignment(s: State, a: Assignment): Assignment {
  if (!a.templateId) {
    if ((a.schedule?.frequency || a.frequency) !== "única")
      throw Error(
        "Las tareas habituales deben elegirse del catálogo. Pedí a Juan Pablo que incorpore el proceso; las tareas particulares son puntuales.",
      );
    return a;
  }
  const t = s.templates.find((t) => t.id === a.templateId);
  if (!t) throw Error("El proceso ya no está disponible en el catálogo.");
  return {
    ...a,
    title: t.title,
    sector: t.sector,
    kind: t.kind,
    weight: t.weight,
    unit: t.unit,
    steps: [...t.steps],
  };
}
