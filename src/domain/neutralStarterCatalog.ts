import type { Assignment, Profile, Template } from "./model";
import type { Schedule } from "./schedule";

/** Lab-only opt-in starter concepts. IDs are namespaced by immutable catalog version. */
export const NEUTRAL_STARTER_CATALOG_VERSION = 1;
/** Sol-approved v2 suggestions. These are proposal prompts, never assignments. */
export const NEUTRAL_STARTER_SUGGESTIONS_VERSION = 2;
const suggestion = (group: string, title: string, aliases: string[], suggestedKind: Template["kind"], suggestedUnit: string, description: string, suggestedSteps: string[]) => ({
  id: NEUTRAL_STARTER_V2_IDS[title]!,
  group, title, aliases, suggestedKind, suggestedUnit, description, suggestedSteps,
});
/** Frozen identifiers: title edits never change saved v2 proposal identity. */
export const NEUTRAL_STARTER_V2_IDS: Readonly<Record<string, string>> = Object.freeze({
  "Conciliación de cuenta bancaria": "starter-suggestion-v2-conciliacion-de-cuenta-bancaria",
  "Procesamiento y control de pagos": "starter-suggestion-v2-procesamiento-y-control-de-pagos",
  "Arqueo y control de caja": "starter-suggestion-v2-arqueo-y-control-de-caja",
  "Registro y seguimiento de cobranzas": "starter-suggestion-v2-registro-y-seguimiento-de-cobranzas",
  "Registro y control de liquidaciones de tarjetas y cupones": "starter-suggestion-v2-registro-y-control-de-cancelaciones-de-cupones",
  "Registro de devoluciones a clientes": "starter-suggestion-v2-registro-de-devoluciones-a-clientes",
  "Registro y control de cheques": "starter-suggestion-v2-registro-y-control-de-cheques",
  "Registro y control de operaciones de crédito": "starter-suggestion-v2-registro-y-control-de-operaciones-de-credito",
  "Aplicación y compensación de cobros": "starter-suggestion-v2-aplicacion-y-compensacion-de-cobros",
  "Conciliación de plataformas de cobro": "starter-suggestion-v2-conciliacion-de-plataformas-de-cobro",
  "Registro y control de cuotas de planes": "starter-suggestion-v2-registro-y-control-de-cuotas-de-planes",
  "Registro de comprobantes": "starter-suggestion-v2-registro-de-comprobantes",
  "Archivo y organización de documentación": "starter-suggestion-v2-archivo-y-organizacion-de-documentacion",
  "Registro y control de asientos contables": "starter-suggestion-v2-registro-y-control-de-asientos-contables",
  "Registro y control de información de sueldos": "starter-suggestion-v2-registro-y-control-de-informacion-de-sueldos",
  "Preparación y control de obligaciones fiscales": "starter-suggestion-v2-preparacion-y-control-de-obligaciones-fiscales",
  "Cierre contable por empresa": "starter-suggestion-v2-cierre-contable-por-empresa",
  "Control y ajuste de inventario": "starter-suggestion-v2-control-y-ajuste-de-inventario",
  "Preparación y registro de ajustes contables": "starter-suggestion-v2-preparacion-y-registro-de-ajustes-contables",
  "Análisis de costos de operaciones": "starter-suggestion-v2-analisis-de-costos-de-operaciones",
  "Análisis y resumen de operaciones": "starter-suggestion-v2-analisis-y-resumen-de-operaciones",
  "Cierre mensual de indicadores": "starter-suggestion-v2-cierre-mensual-de-indicadores",
  "Gestión y seguimiento de trámites": "starter-suggestion-v2-gestion-y-seguimiento-de-tramites",
  "Revisión de seguimiento del equipo": "starter-suggestion-v2-revision-de-seguimiento-del-equipo",
  "Actualización del registro de servicios": "starter-suggestion-v2-actualizacion-del-registro-de-servicios",
  "Compra y control de insumos": "starter-suggestion-v2-compra-y-control-de-insumos",
});
export const NEUTRAL_STARTER_SUGGESTIONS = [
  suggestion("Tesorería, bancos y cobranzas", "Conciliación de cuenta bancaria", ["extracto", "banco", "conciliacion bancaria"], "resultado", "", "Comparar los movimientos de una cuenta con los registros disponibles y dejar diferencias identificadas.", ["Reunir los movimientos y registros del período", "Comparar y documentar diferencias", "Dejar referencias para revisión"]),
  suggestion("Tesorería, bancos y cobranzas", "Procesamiento y control de pagos", ["pago", "transferencias", "tesoreria"], "operativa", "pagos", "Registrar pagos procesados y conservar su referencia y resultado.", ["Reunir pagos autorizados para procesar", "Registrar fecha, referencia y resultado", "Revisar que el registro quede localizable"]),
  suggestion("Tesorería, bancos y cobranzas", "Arqueo y control de caja", ["caja", "arqueo", "efectivo"], "resultado", "", "Comparar los valores contados con los registros disponibles y documentar diferencias.", ["Reunir registros del corte", "Contar y comparar los valores", "Documentar diferencias y revisión"]),
  suggestion("Tesorería, bancos y cobranzas", "Registro y seguimiento de cobranzas", ["cobros", "cuentas por cobrar", "cobranzas"], "operativa", "cobranzas", "Registrar cobros recibidos y conservar su referencia. La aplicación a deudas y la conciliación bancaria o de plataforma son controles separados.", ["Identificar el cobro recibido", "Registrar importe, fecha y referencia", "Dejar pendiente la imputación si corresponde a otro proceso"]),
  suggestion("Tesorería, bancos y cobranzas", "Registro y control de liquidaciones de tarjetas y cupones", ["cupones", "tarjetas", "liquidaciones", "cancelaciones de cupones"], "operativa", "liquidaciones", "Registrar liquidaciones informadas por tarjetas o cupones, con su estado y referencia del procesador. Conciliarlas contra registros bancarios o contables corresponde a otro control.", ["Identificar la liquidación y el procesador", "Registrar importe, fecha, estado y referencia", "Dejar diferencias para la conciliación correspondiente"]),
  suggestion("Tesorería, bancos y cobranzas", "Registro de devoluciones a clientes", ["devoluciones", "reintegros", "clientes"], "operativa", "devoluciones", "Registrar devoluciones realizadas y vincularlas con la documentación disponible.", ["Identificar la devolución y su referencia", "Registrar importe y fecha", "Conservar el respaldo disponible"]),
  suggestion("Tesorería, bancos y cobranzas", "Registro y control de cheques", ["cheques", "valores", "cartera"], "operativa", "cheques", "Mantener un registro de cheques y sus estados según la información disponible.", ["Identificar el cheque y sus datos", "Registrar movimiento y estado", "Actualizar la referencia de control"]),
  suggestion("Tesorería, bancos y cobranzas", "Registro y control de operaciones de crédito", ["credito", "financiacion", "préstamos"], "operativa", "operaciones", "Registrar operaciones de crédito y conservar la información disponible para su seguimiento.", ["Identificar la operación y su referencia", "Registrar los datos disponibles", "Actualizar el estado de seguimiento"]),
  suggestion("Tesorería, bancos y cobranzas", "Aplicación y compensación de cobros", ["imputacion de cobros", "compensaciones", "aplicacion de pagos"], "operativa", "aplicaciones", "Imputar cobros ya registrados a facturas, saldos u otros conceptos según el respaldo disponible. No vuelve a registrar la recepción del dinero.", ["Identificar el cobro previamente registrado y los conceptos relacionados", "Registrar la imputación o compensación", "Dejar referencias para revisión"]),
  suggestion("Tesorería, bancos y cobranzas", "Conciliación de plataformas de cobro", ["pasarelas", "liquidaciones de plataformas", "procesadores de cobro"], "resultado", "", "Comparar las liquidaciones y movimientos informados por una plataforma con los registros internos, e identificar diferencias. El registro inicial de cada liquidación es una actividad distinta.", ["Reunir liquidaciones, movimientos y registros internos", "Comparar importes, fechas y referencias", "Documentar diferencias para su resolución"]),
  suggestion("Tesorería, bancos y cobranzas", "Registro y control de cuotas de planes", ["cuotas", "planes de pago", "financiacion"], "operativa", "cuotas", "Registrar cuotas de planes y actualizar su seguimiento con datos disponibles.", ["Identificar el plan y la cuota", "Registrar movimiento y referencia", "Actualizar el seguimiento"]),
  suggestion("Registración y documentación", "Registro de comprobantes", ["facturas", "recibidos", "emitidos", "comprobantes"], "operativa", "comprobantes", "Registrar comprobantes recibidos o emitidos. Durante la configuración se define si incluye compras, ventas u otros documentos; no se duplica la tarea por empresa o clase de comprobante.", ["Elegir el tipo y el origen del comprobante según la configuración", "Registrar sus datos y referencia", "Vincular la documentación disponible"]),
  suggestion("Registración y documentación", "Archivo y organización de documentación", ["archivo", "documentos", "legajos"], "operativa", "documentos", "Organizar documentación y registrar referencias para facilitar su consulta.", ["Identificar la documentación recibida", "Ordenar y registrar su ubicación", "Revisar que la referencia permita encontrarla"]),
  suggestion("Registración y documentación", "Registro y control de asientos contables", ["asientos", "diario", "registracion contable"], "operativa", "asientos", "Registrar asientos contables y conservar referencias para su revisión.", ["Reunir el respaldo disponible", "Registrar el asiento y su referencia", "Revisar la vinculación documental"]),
  suggestion("Registración y documentación", "Registro y control de información de sueldos", ["sueldos", "nómina", "liquidacion salarial"], "operativa", "registros", "Organizar y controlar registros de información salarial según el proceso definido.", ["Reunir la información disponible", "Registrar datos y referencias", "Revisar integridad y acceso al respaldo"]),
  suggestion("Contabilidad, inventario y obligaciones", "Preparación y control de obligaciones fiscales", ["impuestos", "tributos", "presentaciones fiscales"], "resultado", "", "Preparar y revisar la información de las obligaciones que defina la organización, sin asumir normas ni vencimientos.", ["Identificar la obligación configurada y su período", "Revisar documentación y cálculos disponibles", "Dejar constancia del control realizado"]),
  suggestion("Contabilidad, inventario y obligaciones", "Cierre contable por empresa", ["cierre", "saldos", "empresa"], "resultado", "", "Revisar saldos del período y dejar un cierre trazable para la empresa.", ["Revisar saldos y movimientos del período", "Documentar ajustes y respaldos", "Dejar el cierre disponible para revisión"]),
  suggestion("Contabilidad, inventario y obligaciones", "Control y ajuste de inventario", ["stock", "existencias", "inventario"], "resultado", "", "Comparar registros de inventario con la información disponible y documentar ajustes revisables.", ["Reunir los registros de inventario", "Comparar saldos e identificar diferencias", "Documentar ajustes y respaldo"]),
  suggestion("Contabilidad, inventario y obligaciones", "Preparación y registro de ajustes contables", ["ajustes", "asientos de ajuste", "correcciones contables"], "resultado", "", "Preparar ajustes respaldados y registrar su referencia para revisión.", ["Identificar diferencias que requieren análisis", "Preparar el ajuste con respaldo disponible", "Registrar referencia y revisión"]),
  suggestion("Análisis e indicadores", "Análisis de costos de operaciones", ["costos", "costos operativos", "gastos"], "resultado", "", "Analizar costos según los criterios y datos que defina la organización.", ["Reunir datos y período de análisis", "Aplicar criterios configurados", "Documentar resultados y observaciones"]),
  suggestion("Análisis e indicadores", "Análisis y resumen de operaciones", ["operaciones", "resumen operativo", "actividad"], "resultado", "", "Analizar operaciones registradas y preparar un resumen con referencias a sus fuentes.", ["Definir el período y datos disponibles", "Revisar y resumir la información", "Dejar referencias y observaciones"]),
  suggestion("Análisis e indicadores", "Cierre mensual de indicadores", ["indicadores", "kpi", "cierre mensual"], "resultado", "", "Consolidar indicadores configurados para el período y dejar su revisión documentada.", ["Reunir datos del período", "Calcular indicadores configurados", "Revisar y guardar el cierre"]),
  suggestion("Coordinación y administración", "Gestión y seguimiento de trámites", ["tramites", "expedientes", "gestiones"], "operativa", "trámites", "Registrar trámites y actualizar su estado con identificadores y referencias disponibles.", ["Registrar inicio e identificador disponible", "Actualizar estado y próximo paso", "Conservar constancias y referencias"]),
  suggestion("Coordinación y administración", "Revisión de seguimiento del equipo", ["equipo", "seguimiento", "coordinacion"], "resultado", "", "Revisar el seguimiento disponible del equipo y dejar observaciones para coordinación.", ["Reunir el seguimiento disponible", "Identificar asuntos que requieren revisión", "Registrar observaciones de coordinación"]),
  suggestion("Coordinación y administración", "Actualización del registro de servicios", ["servicios", "registro de servicios", "prestaciones"], "operativa", "registros", "Actualizar registros de servicios según la información validada disponible.", ["Identificar registros a actualizar", "Incorporar la información revisada", "Verificar referencias y cambios"]),
  suggestion("Coordinación y administración", "Compra y control de insumos", ["compras", "insumos", "abastecimiento"], "operativa", "compras", "Registrar compras de insumos y conservar datos de seguimiento y respaldo.", ["Identificar necesidad y autorización disponible", "Registrar compra y referencia", "Actualizar seguimiento y respaldo"]),
];
export const NEUTRAL_STARTER_GROUP_DESCRIPTIONS: Record<string, string> = {
  "Tesorería, bancos y cobranzas": "Registros y revisiones de fondos, movimientos y cobros.",
  "Registración y documentación": "Organización, registro y control de información y respaldos.",
  "Contabilidad, inventario y obligaciones": "Procesos contables y controles definidos por cada organización.",
  "Análisis e indicadores": "Lectura y consolidación de información según criterios configurados.",
  "Coordinación y administración": "Seguimiento de procesos internos y tareas administrativas.",
};
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
