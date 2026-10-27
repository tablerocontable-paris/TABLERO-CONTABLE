/** Stable neutral concepts shared by first-login prompts and the local estimator. */
export const WORKFORCE_TAXONOMY_VERSION = 2;

export const STARTER_CONCEPT_CODES = Object.freeze({
  "starter-suggestion-v2-conciliacion-de-cuenta-bancaria": "bank_reconciliation",
  "starter-suggestion-v2-procesamiento-y-control-de-pagos": "payment_processing",
  "starter-suggestion-v2-arqueo-y-control-de-caja": "cash_reconciliation",
  "starter-suggestion-v2-registro-y-seguimiento-de-cobranzas": "collections_tracking",
  "starter-suggestion-v2-registro-y-control-de-cancelaciones-de-cupones": "card_coupon_settlement",
  "starter-suggestion-v2-registro-de-devoluciones-a-clientes": "customer_refunds",
  "starter-suggestion-v2-registro-y-control-de-cheques": "cheque_tracking",
  "starter-suggestion-v2-registro-y-control-de-operaciones-de-credito": "credit_operations",
  "starter-suggestion-v2-aplicacion-y-compensacion-de-cobros": "receipt_application",
  "starter-suggestion-v2-conciliacion-de-plataformas-de-cobro": "payment_platform_reconciliation",
  "starter-suggestion-v2-registro-y-control-de-cuotas-de-planes": "payment_plan_tracking",
  "starter-suggestion-v2-registro-de-comprobantes": "document_recording",
  "starter-suggestion-v2-archivo-y-organizacion-de-documentacion": "document_organization",
  "starter-suggestion-v2-registro-y-control-de-asientos-contables": "accounting_entries",
  "starter-suggestion-v2-registro-y-control-de-informacion-de-sueldos": "payroll_records",
  "starter-suggestion-v2-preparacion-y-control-de-obligaciones-fiscales": "tax_obligations",
  "starter-suggestion-v2-cierre-contable-por-empresa": "company_accounting_close",
  "starter-suggestion-v2-control-y-ajuste-de-inventario": "inventory_control",
  "starter-suggestion-v2-preparacion-y-registro-de-ajustes-contables": "accounting_adjustments",
  "starter-suggestion-v2-analisis-de-costos-de-operaciones": "cost_analysis",
  "starter-suggestion-v2-analisis-y-resumen-de-operaciones": "operations_analysis",
  "starter-suggestion-v2-cierre-mensual-de-indicadores": "monthly_indicator_close",
  "starter-suggestion-v2-gestion-y-seguimiento-de-tramites": "procedure_tracking",
  "starter-suggestion-v2-revision-de-seguimiento-del-equipo": "team_review",
  "starter-suggestion-v2-actualizacion-del-registro-de-servicios": "service_register_update",
  "starter-suggestion-v2-compra-y-control-de-insumos": "supplies_control",
});

export const CONCEPT_CODE_LIST = Object.freeze([
  ...new Set([...Object.values(STARTER_CONCEPT_CODES), "other_pending_review"]),
]);
export const CONCEPT_CODES = Object.freeze(new Set(CONCEPT_CODE_LIST));
