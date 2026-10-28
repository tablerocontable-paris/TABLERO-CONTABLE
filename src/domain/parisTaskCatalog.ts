/** Organization-specific selection catalog. This does not replace neutral v2. */
export const PARIS_TASK_CATALOG_VERSION = 6 as const;
export type ParisTaskCatalogVersion = 1 | 2 | 3 | 4 | 5 | typeof PARIS_TASK_CATALOG_VERSION;

export const PARIS_BUSINESS_UNITS = [
  { code: "paris_autos", label: "PARIS AUTOS" },
  { code: "doral", label: "DORAL" },
  { code: "paris_cars", label: "PARIS CARS" },
  { code: "paris_trac", label: "PARIS TRAC" },
  { code: "motor", label: "MOTOR" },
  { code: "fideicomiso_desarrollo", label: "FIDEICOMISO DESARROLLO" },
  { code: "postventa", label: "POSTVENTA" },
] as const;

export type ParisBusinessUnitCode = (typeof PARIS_BUSINESS_UNITS)[number]["code"];
export type ParisTaskReviewState = "selectable" | "review";
export interface ParisTaskDefinition {
  code: string;
  label: string;
  group: string;
  kind: "deliverable" | "operational";
  unit?: string;
  parameters: readonly string[];
  /** Versioned, controlled values for fields whose vocabulary is known. */
  parameterChoices?: Readonly<Record<string, readonly ParisTaskParameterChoice[]>>;
  /** Search phrases that select a canonical task plus known parameter values. */
  selectionPresets?: readonly ParisTaskSelectionPreset[];
  /** Fields required to distinguish this work in cross-unit reporting. */
  requiredParameters?: readonly string[];
  aliases: readonly string[];
  state: ParisTaskReviewState;
  /** Provisional tasks are recordable but excluded from cross-unit comparison. */
  comparisonEligible?: boolean;
}
export interface ParisTaskParameterChoice {
  code: string;
  label: string;
  aliases: readonly string[];
}
export interface ParisTaskSelectionPreset {
  label: string;
  aliases: readonly string[];
  parameters: Readonly<Record<string, string>>;
}

/**
 * Canonical task names observed in the supplied screenshots. Parameters such
 * as bank, branch and brand must not be appended to the label. Business unit
 * is represented by businessUnitCode, never duplicated as a free-text field.
 */
/** Frozen version 1 snapshot. Keep it intact so saved lab work remains readable. */
export const PARIS_TASK_CATALOG_V1: readonly ParisTaskDefinition[] = [
  { code: "gpar_bank_reconciliation", label: "Conciliación bancaria", group: "Tesorería", kind: "deliverable", parameters: ["banco", "cuenta", "período"], requiredParameters: ["banco", "cuenta"], aliases: ["conciliacion banco frances", "conciliacion banco frances pa", "conciliacion bancaria", "conciliacion bancaria de todas las entidades bancarias"], state: "selectable" },
  { code: "gpar_mp_reconciliation", label: "Conciliación de movimientos de Mercado Pago", group: "Tesorería", kind: "deliverable", parameters: ["cuenta o comercio", "período"], aliases: ["coinciliacion mercado pago", "conciliacion mercado pago"], state: "selectable" },
  { code: "cash_count", label: "Arqueo de caja", group: "Tesorería", kind: "deliverable", parameters: ["sucursal", "caja", "turno o fecha"], aliases: ["arqueo caja", "arqueo de cajas"], state: "selectable" },
  { code: "document_archive", label: "Archivo y organización de documentación", group: "Documentación", kind: "operational", unit: "documentos", parameters: ["tipo de documento", "ubicación"], aliases: ["archivo de documentacion"], state: "selectable" },
  { code: "supplier_invoice_load", label: "Carga de facturas de proveedores", group: "Compras", kind: "operational", unit: "facturas", parameters: ["proveedor", "clase", "sucursal", "sistema u origen"], aliases: ["carga de factura proveedores", "carga facturas proveedores", "cargas facturas proveedores", "cargar facturas de compras", "carga de facturas gm", "carga facturas gm casos puntuales", "carga de factura chevrolet sa", "carga de facturas portal stellantis"], state: "selectable" },
  { code: "invoice_load_other", label: "Carga de otras facturas", group: "Compras", kind: "operational", unit: "facturas", parameters: ["tipo específico", "proveedor", "sucursal"], requiredParameters: ["tipo específico"], aliases: ["carga de facturas varias"], state: "review" },
  { code: "parts_invoice_load", label: "Carga de facturas de repuestos", group: "Compras", kind: "operational", unit: "facturas", parameters: ["sucursal"], aliases: ["carga facturas repuestos paris cars suc 3", "carga factura repuestos paris cars suc 81"], state: "selectable" },
  { code: "new_vehicle_invoice_load", label: "Carga de facturas de vehículos nuevos", group: "Compras", kind: "operational", unit: "facturas", parameters: ["marca", "sucursal", "etapa de recepción"], aliases: ["carga de facturas vehiculos nuevos chevrolet", "carga factura vn pa"], state: "review" },
  { code: "zero_km_invoice_receipt", label: "Registro de factura de unidad 0 km al recibirla", group: "Compras", kind: "operational", unit: "unidades", parameters: ["marca", "vehículo", "sucursal"], aliases: ["carga fc unidades 0km al recepcionar en sucursal"], state: "selectable" },
  { code: "service_invoice_load", label: "Carga de facturas de proveedores de servicios", group: "Compras", kind: "operational", unit: "facturas", parameters: ["proveedor", "tratamiento de caja"], aliases: ["carga de facturas proveedores de servicios conjunta con caja"], state: "review" },
  { code: "supplier_payment", label: "Preparación y registro de pagos a proveedores", group: "Tesorería", kind: "operational", unit: "pagos", parameters: ["proveedor", "banco o medio", "etapa"], aliases: ["carga de pagos a proveedores"], state: "review" },
  { code: "dealer_credits_payment_load", label: "Carga de pagos PDA", group: "Tesorería", kind: "operational", unit: "pagos", parameters: ["entidad", "proceso", "período"], aliases: [], state: "review" },
  { code: "bank_transfer_register", label: "Registro de transferencias bancarias", group: "Tesorería", kind: "operational", unit: "transferencias", parameters: ["banco", "cuenta", "destinatario", "motivo"], aliases: ["carga de transferencia bancaria", "carga de transferencias"], state: "review" },
  { code: "supplier_payment_transfer", label: "Transferencias de pago a proveedores", group: "Tesorería", kind: "operational", unit: "transferencias", parameters: ["banco", "cuenta", "proveedor"], aliases: ["carga de transferencias de pago a proveedores"], state: "review" },
  { code: "salary_data_load", label: "Carga de información de sueldos", group: "Sueldos", kind: "operational", unit: "registros", parameters: ["período", "sistema"], aliases: ["carga de sueldos", "carga sueldos"], state: "selectable" },
  { code: "salary_bank_payment", label: "Pago de sueldos por banco", group: "Sueldos", kind: "operational", unit: "pagos", parameters: ["banco", "cuenta", "período"], aliases: ["carga pago sueldos en banco"], state: "selectable" },
  { code: "salary_accounting_entry", label: "Registración contable de sueldos", group: "Sueldos", kind: "deliverable", parameters: ["unidad", "período"], aliases: ["asiento devengamiento de sueldos", "asiento sueldos pa", "asiento sueldos pt"], state: "selectable" },
  { code: "vat_accounting_entry", label: "Registración contable de IVA", group: "Contabilidad", kind: "deliverable", parameters: ["unidad", "período", "tipo"], aliases: ["asiento iva doral", "asiento iva pa", "asiento iva pc", "asiento iva pt"], state: "selectable" },
  { code: "patent_debt_payment_entry", label: "Registración del pago de deuda de patentes", group: "Contabilidad", kind: "deliverable", parameters: ["jurisdicción", "período"], aliases: ["asiento pago deuda patentes"], state: "selectable" },
  { code: "inventory_adjustment", label: "Ajustes de inventario", group: "Inventario", kind: "deliverable", parameters: ["sucursal", "rubro", "período"], aliases: ["ajustes inventario"], state: "review" },
  { code: "credit_cost_analysis", label: "Análisis de costo de créditos", group: "Análisis", kind: "deliverable", parameters: ["línea o producto", "período"], aliases: ["analisis costo creditos psa"], state: "review" },
  { code: "coupon_cost_analysis", label: "Análisis de costo de cupones", group: "Análisis", kind: "deliverable", parameters: ["medio o procesador", "período"], aliases: ["analisis costo cupones"], state: "selectable" },
  { code: "procedure_cost_analysis", label: "Análisis de costo de trámites", group: "Análisis", kind: "deliverable", parameters: ["tipo de trámite", "período"], aliases: ["analisis costo tramites"], state: "selectable" },
  { code: "monthly_parts_metrics", label: "Cierre mensual de indicadores de repuestos", group: "Análisis", kind: "deliverable", parameters: ["período"], aliases: ["cierre mensual metricas repuestos"], state: "selectable" },
  { code: "monthly_workshop_metrics", label: "Cierre mensual de indicadores de taller", group: "Análisis", kind: "deliverable", parameters: ["período"], aliases: ["cierre mensual metricas taller"], state: "selectable" },
  { code: "customer_receipt_application", label: "Aplicación de cobros de seguros a facturas pendientes", group: "Tesorería", kind: "operational", unit: "aplicaciones", parameters: ["aseguradora", "factura", "período"], aliases: ["compensar ingreso de bco con facturas pendiente de pago de seguros"], state: "selectable" },
  { code: "credit_operation_load", label: "Carga de operaciones de créditos prendarios", group: "Créditos", kind: "operational", unit: "operaciones", parameters: ["financiera", "vehículo", "operación"], aliases: ["carga creditos prendarios", "carga de credito prendarios"], state: "selectable" },
  { code: "credit_settlement_load", label: "Carga de liquidaciones de créditos prendarios", group: "Créditos", kind: "operational", unit: "liquidaciones", parameters: ["financiera", "operación", "período"], aliases: ["carga liquidaciones creditos gpat y bna prendarios"], state: "selectable" },
  { code: "savings_plan_first_installment_load", label: "Carga de primeras cuotas de planes de ahorro", group: "Planes", kind: "operational", unit: "cuotas", parameters: ["plan", "período"], aliases: ["carga primeras cuotas planes"], state: "selectable" },
  { code: "savings_plan_installment_collection", label: "Cobro de cuotas de planes de ahorro", group: "Planes", kind: "operational", unit: "cuotas", parameters: ["plan", "período"], aliases: ["cobro cuotas plan de ahorro"], state: "selectable" },
  { code: "service_register_update", label: "Actualización del tablero de servicios de internet", group: "Administración", kind: "operational", unit: "servicios", parameters: ["proveedor", "servicio", "período"], aliases: ["completar tablero servicios internet"], state: "review" },
  { code: "supplies_purchase_control", label: "Compra y control de insumos", group: "Administración", kind: "operational", unit: "compras", parameters: ["categoría", "proveedor", "período"], aliases: ["compra y control insumos informaticos y limpieza"], state: "review" },
  { code: "cheque_nosis_verification", label: "Verificación de cheques en Nosis", group: "Tesorería", kind: "operational", unit: "cheques", parameters: ["cheque", "fecha"], aliases: ["cintrol nosis cheques", "control nosis cheques"], state: "review" },
  { code: "customer_collections", label: "Registro de cobros de clientes", group: "Tesorería", kind: "operational", unit: "cobros", parameters: ["cliente", "medio", "fecha"], aliases: ["cobro a clientes"], state: "review" },
  { code: "vehicle_collection", label: "Cobro de operaciones de vehículos", group: "Tesorería", kind: "operational", unit: "cobros", parameters: ["tipo de operación", "medio", "fecha"], aliases: ["cobranza vn vo pda"], state: "review" },
  { code: "sector_cash_collections", label: "Registro de cobros de caja por sector", group: "Tesorería", kind: "operational", unit: "cobros", parameters: ["sector", "sucursal", "fecha"], aliases: ["cobro caja taller repuestos chapa", "cobro en caja vn vo pda pv"], state: "review" },
  { code: "workshop_invoice_collection", label: "Cobro de facturas de taller", group: "Tesorería", kind: "operational", unit: "facturas", parameters: ["cliente", "factura", "fecha"], aliases: ["cobro factura taller"], state: "review" },
  { code: "vehicle_exit_collection", label: "Cobro asociado a la salida diaria de vehículos", group: "Tesorería", kind: "operational", unit: "operaciones", parameters: ["vehículo", "operación", "fecha"], aliases: ["cobro de salida de vehiculos del dia"], state: "review" },
  { code: "customer_refund_record", label: "Registro de devoluciones a clientes en banco y sistema", group: "Tesorería", kind: "operational", unit: "devoluciones", parameters: ["cliente", "movimiento bancario", "sistema", "fecha"], aliases: ["carga devoluciones de clientes en banco y quiter"], state: "review" },
  { code: "coupon_settlement", label: "Registro de liquidación de cupones", group: "Tesorería", kind: "operational", unit: "liquidaciones", parameters: ["procesador", "lote", "fecha"], aliases: ["cancelacion cupones mp paris cars", "cancelacion cupones mp paris autos"], state: "review" },
  { code: "pda_result_adjustment", label: "Ajuste de resultados PDA", group: "Contabilidad", kind: "deliverable", parameters: ["período", "concepto"], aliases: ["ajuste resultados pda"], state: "review" },
  { code: "operations_analysis_mo4", label: "Análisis y resumen de operaciones", group: "Análisis", kind: "deliverable", parameters: ["período", "reporte MO4"], aliases: ["analisis y resumen de operaciones mo4 sep"], state: "review" },
  { code: "pymes_bonus_analysis", label: "Análisis de Bonis PYMES", group: "Análisis", kind: "deliverable", parameters: ["período", "criterio"], aliases: ["analisis bonis pymes"], state: "review" },
  { code: "municipal_fees_accrual", label: "Registración de cánones municipales acumulados", group: "Contabilidad", kind: "deliverable", parameters: ["municipio", "período"], aliases: ["canon municipal acumulados", "canon municipal acumulado"], state: "review" },
  { code: "vehicle_model_change_payment", label: "Gestión del cambio de modelo y su pago", group: "Administración", kind: "operational", unit: "operaciones", parameters: ["vehículo", "operación", "fecha"], aliases: ["carga y pago de cambio de modelo"], state: "review" },
  { code: "vehicle_transfers_pda", label: "Registro de transferencias de VN, VO y PDA", group: "Tesorería", kind: "operational", unit: "transferencias", parameters: ["tipo de operación", "medio", "período"], aliases: [], state: "review" },
  { code: "supplier_payment_transfer_vn_vo_pda", label: "Carga de transferencias de VN/VO/PDA", group: "Tesorería", kind: "operational", unit: "transferencias", parameters: ["tipo de operación", "medio", "período"], aliases: ["carga de transferencias vn vo pda"], state: "review" },
  { code: "cheque_operation_load", label: "Carga de cheques en operación", group: "Tesorería", kind: "operational", unit: "cheques", parameters: ["operación", "sistema"], aliases: ["carga de cheqs en operacion"], state: "review" },
  { code: "team_followup_review", label: "Revisión de seguimiento del equipo", group: "Supervisión", kind: "deliverable", parameters: ["equipo", "período"], aliases: ["checkpoint supervision del equipo"], state: "review" },
  { code: "gm_collection_register", label: "Registro de cobros de GM", group: "Tesorería", kind: "operational", unit: "cobros", parameters: ["entidad", "medio", "período"], aliases: ["cobros gm registro"], state: "review" },
];

/** Version 2 adds the explicit tasks from the supplied board captures. */
export const PARIS_TASK_CATALOG_V2: readonly ParisTaskDefinition[] = [
  ...PARIS_TASK_CATALOG_V1.map((task) => task.code === "sector_cash_collections"
    ? { ...task, aliases: task.aliases.filter((alias) => alias !== "cobro en caja vn vo pda pv") }
    : task),
  { code: "procedure_follow_up", label: "Control de trámites", group: "Administración", kind: "operational", unit: "trámites", parameters: ["tipo de trámite", "organismo o destino", "período"], aliases: ["control tramites", "seguimiento de tramites"], state: "selectable" },
  { code: "payment_processing", label: "Procesamiento de pagos", group: "Tesorería", kind: "operational", unit: "pagos", parameters: ["tipo de pago", "medio", "empresa o destinatario", "período"], aliases: ["procesamiento pagos", "carga de pagos"], state: "selectable" },
  { code: "monthly_accounting_close", label: "Cierre de cuentas mensuales", group: "Contabilidad", kind: "deliverable", parameters: ["período"], aliases: ["cierre de cuentas mensual", "cierre de cuenta mensual", "cierre mensual de cuentas"], state: "selectable" },
  { code: "vat_settlement_control", label: "Liquidación y control de IVA", group: "Impuestos", kind: "deliverable", parameters: ["período", "tipo de liquidación"], aliases: ["liquidacion control iva", "liquidación y control mensual de iva"], state: "selectable" },
  { code: "vehicle_cash_collection", label: "Registro de cobros en caja de operaciones de vehículos", group: "Tesorería", kind: "operational", unit: "cobros", parameters: ["tipo de operación", "sucursal o caja", "medio", "fecha"], aliases: ["cobro en caja vn vo pda pv"], state: "review" },
];

/** Frozen v3 snapshot. It preserves historical parameters exactly as recorded. */
export const PARIS_TASK_CATALOG_V3: readonly ParisTaskDefinition[] = PARIS_TASK_CATALOG_V2.map((task) => ({
  ...task,
  state: "selectable" as const,
  comparisonEligible: task.state === "selectable",
}));

/** Frozen version 4: canonical bank alias and unit stored only in businessUnitCode. */
export const PARIS_TASK_CATALOG_V4: readonly ParisTaskDefinition[] = PARIS_TASK_CATALOG_V3.map((task) => ({
  ...task,
  aliases: task.code === "gpar_bank_reconciliation"
    ? [...task.aliases, "conc banc franc"]
    : task.aliases,
  parameters: task.parameters.filter((parameter) =>
    !(["salary_accounting_entry", "vat_accounting_entry"].includes(task.code) && parameter === "unidad"),
  ),
}));

/** Frozen version 5 aligns comparison eligibility with the reviewed task definitions. */
export const PARIS_TASK_CATALOG_V5: readonly ParisTaskDefinition[] = PARIS_TASK_CATALOG_V4.map((task) => ({
  ...task,
  ...(task.code === "supplier_invoice_load" ? { comparisonEligible: false } : {}),
  ...(task.code === "customer_collections" ? { comparisonEligible: true } : {}),
}));

const bankChoices: readonly ParisTaskParameterChoice[] = [
  { code: "frances", label: "Banco Francés", aliases: ["frances", "banco frances", "conciliacion banco frances", "conciliacion banco frances pa", "conc banc franc"] },
  { code: "nacion", label: "Banco Nación", aliases: ["nacion", "banco nacion", "bna", "conciliacion banco nacion"] },
  { code: "unverified", label: "Otro banco · pendiente de normalizar", aliases: [] },
];

/** Version 6 stores known banks as canonical codes and flags unlisted banks. */
export const PARIS_TASK_CATALOG: readonly ParisTaskDefinition[] = PARIS_TASK_CATALOG_V5.map((task) => task.code === "gpar_bank_reconciliation"
  ? {
      ...task,
      parameters: [...task.parameters, "banco no catalogado"],
      parameterChoices: { banco: bankChoices },
      selectionPresets: [
        { label: "Conciliación Banco Francés", aliases: bankChoices[0]!.aliases, parameters: { banco: "frances" } },
        { label: "Conciliación Banco Nación", aliases: bankChoices[1]!.aliases, parameters: { banco: "nacion" } },
      ],
    }
  : task);

const catalogsByVersion = new Map<ParisTaskCatalogVersion, readonly ParisTaskDefinition[]>([
  [1, PARIS_TASK_CATALOG_V1],
  [2, PARIS_TASK_CATALOG_V2],
  [3, PARIS_TASK_CATALOG_V3],
  [4, PARIS_TASK_CATALOG_V4],
  [5, PARIS_TASK_CATALOG_V5],
  [PARIS_TASK_CATALOG_VERSION, PARIS_TASK_CATALOG],
]);

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

const taskByCodeByVersion = new Map([...catalogsByVersion].map(([version, tasks]) => [version, new Map(tasks.map((task) => [task.code, task]))]));
const taskByAlias = new Map<string, ParisTaskDefinition>();
for (const task of PARIS_TASK_CATALOG) {
  for (const alias of [task.label, ...task.aliases, ...(task.selectionPresets || []).flatMap((preset) => preset.aliases)]) {
    const key = normalize(alias);
    const existing = taskByAlias.get(key);
    if (existing && existing.code !== task.code) throw new Error(`Alias duplicado «${alias}» en el catálogo Grupo París.`);
    taskByAlias.set(key, task);
  }
}

export function isParisTaskCatalogVersion(value: unknown): value is ParisTaskCatalogVersion {
  return typeof value === "number" && catalogsByVersion.has(value as ParisTaskCatalogVersion);
}

export function getParisTask(code: string, version: number = PARIS_TASK_CATALOG_VERSION): ParisTaskDefinition | undefined {
  return isParisTaskCatalogVersion(version) ? taskByCodeByVersion.get(version)?.get(code) : undefined;
}

export function parisTaskParameterKey(label: string): string {
  return normalize(label).replace(/\s+/g, "_");
}

export function getParisTaskParameterChoices(code: string, parameterKey: string, version: number = PARIS_TASK_CATALOG_VERSION): readonly ParisTaskParameterChoice[] {
  const task = getParisTask(code, version);
  const choices = task?.parameterChoices?.[parameterKey];
  return choices ? [...choices] : [];
}

export function getParisTaskSelectionPreset(code: string, query: string, version: number = PARIS_TASK_CATALOG_VERSION): ParisTaskSelectionPreset | undefined {
  const task = getParisTask(code, version);
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return undefined;
  const matches = task?.selectionPresets?.filter((preset) =>
    [preset.label, ...preset.aliases].some((phrase) => normalize(phrase).includes(normalizedQuery)),
  ) || [];
  return matches.length === 1 ? matches[0] : undefined;
}

export function normalizeParisTaskParameters(code: string, values: Record<string, string>, version: number = PARIS_TASK_CATALOG_VERSION): Record<string, string> {
  const task = getParisTask(code, version);
  if (!task?.parameterChoices) return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));
  return Object.fromEntries(Object.entries(values).map(([key, value]) => {
    const trimmed = value.trim();
    const choices = task.parameterChoices?.[key];
    if (!choices || !trimmed) return [key, trimmed];
    const normalizedValue = normalize(trimmed);
    const choice = choices.find((candidate) => candidate.code === trimmed || normalize(candidate.label) === normalizedValue || candidate.aliases.some((alias) => normalize(alias) === normalizedValue));
    return [key, choice?.code || trimmed];
  }));
}

export function formatParisTaskParameterValue(code: string | null | undefined, key: string, value: string, version: number | null | undefined): string {
  if (!code || !version) return value;
  const choice = getParisTaskParameterChoices(code, key, version).find((candidate) => candidate.code === value);
  return choice?.label || value;
}

export function isParisTaskParameterComparisonEligible(code: string | null | undefined, parameters: Record<string, string> | undefined, version: number | null | undefined): boolean {
  if (!isParisTaskComparisonEligible(code, version)) return false;
  if (!code || !version) return true;
  const definition = getParisTask(code, version);
  if (!definition?.parameterChoices) return true;
  if (!parameters) return !Object.values(definition.parameterChoices).some((choices) => choices.some((choice) => choice.code === "unverified"));
  return !Object.entries(definition.parameterChoices).some(([key, choices]) => {
    const isControlledDimension = choices.some((choice) => choice.code === "unverified");
    return isControlledDimension && (!parameters[key] || parameters[key] === "unverified");
  });
}

export function isParisTaskParameterSet(code: string, value: unknown, version: number = PARIS_TASK_CATALOG_VERSION): value is Record<string, string> {
  const task = getParisTask(code, version);
  if (!task || !value || typeof value !== "object" || Array.isArray(value)) return false;
  const allowed = new Set(task.parameters.map(parisTaskParameterKey));
  const parameters = value as Record<string, unknown>;
  const validEntries = Object.entries(parameters).every(([key, entry]) =>
    allowed.has(key) && typeof entry === "string" && entry.trim().length <= 160,
  );
  if (!validEntries) return false;
  for (const [key, choices] of Object.entries(task.parameterChoices || {})) {
    const selected = parameters[key];
    if (selected !== undefined && !choices.some((choice) => choice.code === selected)) return false;
  }
  return true;
}

export function hasRequiredParisTaskParameters(code: string, value: unknown, version: number = PARIS_TASK_CATALOG_VERSION): boolean {
  if (!isParisTaskParameterSet(code, value, version)) return false;
  const parameters = value as Record<string, string>;
  const task = getParisTask(code, version)!;
  const required = [...requiredParisTaskParameterKeys(code, version)];
  for (const [key, choices] of Object.entries(task.parameterChoices || {})) {
    const selected = parameters[key];
    if (selected === "unverified") {
      const detailKey = parisTaskParameterKey("banco no catalogado");
      required.push(detailKey);
    } else if (parameters[parisTaskParameterKey("banco no catalogado")]) return false;
    if (selected !== undefined && !choices.some((choice) => choice.code === selected)) return false;
  }
  return required.every((key) => (parameters[key] || "").trim().length > 0);
}

export function requiredParisTaskParameterKeys(code: string, version: number = PARIS_TASK_CATALOG_VERSION): ReadonlySet<string> {
  return new Set((getParisTask(code, version)?.requiredParameters || []).map(parisTaskParameterKey));
}

export function isParisBusinessUnitCode(value: string): value is ParisBusinessUnitCode {
  return PARIS_BUSINESS_UNITS.some((unit) => unit.code === value);
}

export function isSelectableParisTaskCode(value: string, version: number = PARIS_TASK_CATALOG_VERSION): boolean {
  return getParisTask(value, version)?.state === "selectable";
}

export function isParisTaskComparisonEligible(code: string | null | undefined, version: number | null | undefined): boolean {
  if (!code || !version) return false;
  const definition = getParisTask(code, version);
  return !!definition && (definition.comparisonEligible ?? definition.state === "selectable");
}

/** Exact alias lookup for search/import review; never silently edits saved work. */
export function findParisTaskAlias(value: string): ParisTaskDefinition | undefined {
  return taskByAlias.get(normalize(value));
}

/** All observed rows are offered; provisional rows keep distinct codes and parameters. */
export function selectableParisTasks(version: number = PARIS_TASK_CATALOG_VERSION): readonly ParisTaskDefinition[] {
  if (!isParisTaskCatalogVersion(version)) return [];
  return (catalogsByVersion.get(version) || []).filter((task) => task.state === "selectable");
}
