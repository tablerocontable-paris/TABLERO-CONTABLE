export const WORKFORCE_TAXONOMY_VERSION: 2;
export type NeutralConceptCode =
  | "bank_reconciliation" | "payment_processing" | "cash_reconciliation" | "collections_tracking"
  | "card_coupon_settlement" | "customer_refunds" | "cheque_tracking" | "credit_operations"
  | "receipt_application" | "payment_platform_reconciliation" | "payment_plan_tracking"
  | "document_recording" | "document_organization" | "accounting_entries" | "payroll_records"
  | "tax_obligations" | "company_accounting_close" | "inventory_control" | "accounting_adjustments"
  | "cost_analysis" | "operations_analysis" | "monthly_indicator_close" | "procedure_tracking"
  | "team_review" | "service_register_update" | "supplies_control";
export const STARTER_CONCEPT_CODES: Readonly<Record<string, NeutralConceptCode>>;
export const CONCEPT_CODE_LIST: readonly string[];
export const CONCEPT_CODES: ReadonlySet<string>;
