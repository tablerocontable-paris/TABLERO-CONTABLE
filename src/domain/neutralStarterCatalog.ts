import type { Assignment, Profile, Template } from "./model";
import type { Schedule } from "./schedule";

/** Lab-only opt-in starter concepts. IDs are namespaced by immutable catalog version. */
export const NEUTRAL_STARTER_CATALOG_VERSION = 1;
export const NEUTRAL_STARTER_CATALOG: readonly Template[] = [
  {
    id: "starter-v1-bank-reconciliation",
    title: "Conciliación de cuenta bancaria",
    sector: "General",
    kind: "resultado",
    weight: 1,
    unit: "cuenta y período",
    target: 0,
    steps: ["Reunir extracto y registros del período", "Comparar movimientos y documentar diferencias", "Dejar referencias y revisión trazables"],
    description: "Comparar movimientos del extracto con los registros contables y dejar diferencias documentadas.",
  },
  {
    id: "starter-v1-tax-obligations",
    title: "Preparación y control de obligaciones fiscales",
    sector: "General",
    kind: "resultado",
    weight: 1,
    unit: "obligación y período",
    target: 0,
    steps: ["Identificar obligación y período aplicables", "Revisar documentación y cálculos", "Verificar vencimiento según la configuración vigente", "Dejar constancia del control y de la presentación cuando corresponda"],
    description: "Controlar documentación, cálculos y vencimiento definidos por la organización, sin asumir obligaciones ni fechas.",
  },
  {
    id: "starter-v1-document-recording",
    title: "Registro de comprobantes",
    sector: "General",
    kind: "operativa",
    weight: 0,
    unit: "comprobantes",
    target: 0,
    steps: ["Identificar comprobantes recibidos o emitidos", "Registrar cada comprobante con una referencia localizable", "Revisar que el registro conserve el vínculo con su documentación"],
    description: "Registrar comprobantes recibidos o emitidos con referencias suficientes para encontrarlos después.",
  },
  {
    id: "starter-v1-procedure-follow-up",
    title: "Gestión y seguimiento de trámites",
    sector: "General",
    kind: "operativa",
    weight: 0,
    unit: "trámites",
    target: 0,
    steps: ["Registrar el inicio y el identificador del trámite", "Actualizar su estado y próximo paso", "Conservar constancias y referencias de seguimiento"],
    description: "Iniciar y actualizar trámites administrativos o fiscales conservando su identificador y estado.",
  },
  {
    id: "starter-v1-payment-processing",
    title: "Procesamiento y control de pagos",
    sector: "General",
    kind: "operativa",
    weight: 0,
    unit: "pagos",
    target: 0,
    steps: ["Verificar la autorización del pago", "Registrar fecha e importe procesado", "Guardar la referencia y el resultado"],
    description: "Procesar pagos autorizados y registrar fecha, referencia y resultado.",
  },
  {
    id: "starter-v1-accounting-close",
    title: "Cierre contable por empresa",
    sector: "General",
    kind: "resultado",
    weight: 1,
    unit: "empresa y período",
    target: 0,
    steps: ["Revisar saldos del período", "Documentar ajustes y sus respaldos", "Dejar un cierre revisable para la empresa y el período"],
    description: "Revisar saldos y ajustes, dejando un cierre trazable para cada empresa y período.",
  },
];

const starterById = new Map(NEUTRAL_STARTER_CATALOG.map((entry) => [entry.id, entry]));

export function neutralStarterTask(id: string): Template | undefined {
  return starterById.get(id);
}

export function materializeNeutralStarterAssignment(
  starterId: string,
  values: {
    id: string;
    owner: Pick<Profile, "id" | "sector">;
    companyId: string;
    startMonth: string;
    day: number;
    schedule: Schedule;
  },
): Assignment | undefined {
  const starter = neutralStarterTask(starterId);
  if (!starter) return undefined;
  return {
    id: values.id,
    templateId: null,
    starterId: starter.id,
    title: starter.title,
    ownerId: values.owner.id,
    companyId: values.companyId,
    sector: values.owner.sector,
    kind: starter.kind,
    weight: starter.weight,
    unit: starter.unit,
    target: 0,
    day: values.day,
    frequency: values.schedule.frequency,
    schedule: values.schedule,
    steps: [...starter.steps],
    startMonth: values.startMonth,
    priority: "Media",
  };
}
