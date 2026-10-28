import { describe, expect, it } from "vitest";
import {
  findParisTaskAlias,
  PARIS_BUSINESS_UNITS,
  PARIS_TASK_CATALOG,
  PARIS_TASK_CATALOG_V1,
  PARIS_TASK_CATALOG_V2,
  PARIS_TASK_CATALOG_VERSION,
  getParisTask,
  selectableParisTasks,
} from "../src/domain/parisTaskCatalog";

describe("catálogo de tareas de Grupo París", () => {
  it("preserva las siete unidades de negocio pedidas como códigos distintos", () => {
    expect(PARIS_BUSINESS_UNITS.map((unit) => unit.label)).toEqual([
      "PARIS AUTOS", "DORAL", "PARIS CARS", "PARIS TRAC", "MOTOR",
      "FIDEICOMISO DESARROLLO", "POSTVENTA",
    ]);
    expect(new Set(PARIS_BUSINESS_UNITS.map((unit) => unit.code)).size).toBe(7);
  });

  it("mantiene códigos únicos y no mezcla alias de procesos distintos", () => {
    expect(new Set(PARIS_TASK_CATALOG.map((task) => task.code)).size).toBe(PARIS_TASK_CATALOG.length);
    expect(findParisTaskAlias("CONC BANC FRANC" )?.code).toBeUndefined();
    expect(findParisTaskAlias("Conciliación Banco Francés – PA")?.label).toBe("Conciliación bancaria");
    expect(findParisTaskAlias("Carga de sueldos")?.code).not.toBe(findParisTaskAlias("Carga pago sueldos en banco")?.code);
    expect(findParisTaskAlias("Asiento sueldos PA")?.code).not.toBe(findParisTaskAlias("Carga de sueldos")?.code);
    expect(findParisTaskAlias("Coinciliacion Mercado Pago")?.code).not.toBe(findParisTaskAlias("Cancelacion cupones MP Paris Autos")?.code);
  });

  it("versiona las tareas nuevas y conserva intacta la lectura del catálogo v1", () => {
    expect(PARIS_TASK_CATALOG_VERSION).toBe(3);
    expect(PARIS_TASK_CATALOG_V2).toHaveLength(PARIS_TASK_CATALOG_V1.length + 5);
    expect(PARIS_TASK_CATALOG).toHaveLength(PARIS_TASK_CATALOG_V2.length);
    expect(getParisTask("procedure_follow_up", 1)).toBeUndefined();
    expect(getParisTask("procedure_follow_up", 2)?.label).toBe("Control de trámites");
    expect(getParisTask("procedure_follow_up", 3)?.label).toBe("Control de trámites");
    expect(getParisTask("gpar_bank_reconciliation", 1)?.label).toBe("Conciliación bancaria");
    expect(getParisTask("gpar_bank_reconciliation", 2)?.label).toBe("Conciliación bancaria");
    expect(getParisTask("gpar_bank_reconciliation", 3)?.label).toBe("Conciliación bancaria");
  });

  it("incluye las cuatro tareas visibles que faltaban con nombre canónico", () => {
    expect(selectableParisTasks().map((task) => task.label)).toEqual(expect.arrayContaining([
      "Control de trámites", "Procesamiento de pagos", "Cierre de cuentas mensuales", "Liquidación y control de IVA",
    ]));
    expect(findParisTaskAlias("Control trámites")?.code).toBe("procedure_follow_up");
    expect(findParisTaskAlias("Carga de pagos")?.code).toBe("payment_processing");
    expect(findParisTaskAlias("Cierre de cuenta mensual")?.code).toBe("monthly_accounting_close");
    expect(findParisTaskAlias("Liquidación y control de IVA")?.code).toBe("vat_settlement_control");
  });

  it("permite elegir las 55 tareas observadas y señala las 30 con comparación provisional", () => {
    expect(PARIS_TASK_CATALOG).toHaveLength(55);
    expect(selectableParisTasks()).toHaveLength(55);
    expect(selectableParisTasks(2)).toHaveLength(25);
    expect(PARIS_TASK_CATALOG.filter((task) => task.comparisonEligible === false)).toHaveLength(30);
    expect(selectableParisTasks().every((task) => task.state === "selectable")).toBe(true);
    expect(findParisTaskAlias("Análisis Bonis PYMES")?.state).toBe("selectable");
    expect(findParisTaskAlias("Análisis Bonis PYMES")?.comparisonEligible).toBe(false);
    expect(findParisTaskAlias("Carga de otras facturas")?.comparisonEligible).toBe(false);
    expect(findParisTaskAlias("Carga de otras facturas")?.requiredParameters).toContain("tipo específico");
  });

  it("registra con código propio los procesos provisionales sin fusionar aliases", () => {
    expect(findParisTaskAlias("Carga de pagos PDA")?.code).toBe("dealer_credits_payment_load");
    expect(findParisTaskAlias("Carga de pagos PDA")?.state).toBe("selectable");
    expect(getParisTask("dealer_credits_payment_load", 2)?.state).toBe("review");
    expect(findParisTaskAlias("Cobranza VN/VO/PDA")?.code).toBe("vehicle_collection");
    expect(findParisTaskAlias("Carga de transferencias VN/VO/PDA")?.code).toBe("supplier_payment_transfer_vn_vo_pda");
    expect(findParisTaskAlias("Carga de otras facturas")?.state).toBe("selectable");
    expect(getParisTask("invoice_load_other", 2)?.state).toBe("review");
    expect(findParisTaskAlias("Cobro en caja VN VO PDA PV")?.code).toBe("vehicle_cash_collection");
    expect(findParisTaskAlias("Cobro en caja VN VO PDA PV")?.state).toBe("selectable");
    expect(findParisTaskAlias("Cobro en caja VN VO PDA PV")?.code).not.toBe("sector_cash_collections");
    expect(findParisTaskAlias("Cobranza VN/VO/PDA")?.code).toBe("vehicle_collection");
  });
});
