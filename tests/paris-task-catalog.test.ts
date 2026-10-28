import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  findParisTaskAlias,
  PARIS_BUSINESS_UNITS,
  PARIS_TASK_CATALOG,
  PARIS_TASK_CATALOG_V1,
  PARIS_TASK_CATALOG_V2,
  PARIS_TASK_CATALOG_V3,
  PARIS_TASK_CATALOG_V4,
  PARIS_TASK_CATALOG_V5,
  PARIS_TASK_CATALOG_VERSION,
  getParisTask,
  getParisTaskSelectionPreset,
  hasRequiredParisTaskParameters,
  isParisTaskParameterSet,
  isParisTaskParameterComparisonEligible,
  normalizeParisTaskParameters,
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
    expect(findParisTaskAlias("CONC BANC FRANC")?.code).toBe("gpar_bank_reconciliation");
    expect(findParisTaskAlias("CONC BANC FRANC")?.label).toBe("Conciliación bancaria");
    expect(findParisTaskAlias("Conciliación Banco Francés – PA")?.label).toBe("Conciliación bancaria");
    expect(findParisTaskAlias("Carga de sueldos")?.code).not.toBe(findParisTaskAlias("Carga pago sueldos en banco")?.code);
    expect(findParisTaskAlias("Asiento sueldos PA")?.code).not.toBe(findParisTaskAlias("Carga de sueldos")?.code);
    expect(findParisTaskAlias("Coinciliacion Mercado Pago")?.code).not.toBe(findParisTaskAlias("Cancelacion cupones MP Paris Autos")?.code);
  });

  it("versiona las tareas nuevas y conserva las lecturas históricas v1 a v4", () => {
    expect(PARIS_TASK_CATALOG_VERSION).toBe(6);
    expect(PARIS_TASK_CATALOG_V2).toHaveLength(PARIS_TASK_CATALOG_V1.length + 5);
    expect(PARIS_TASK_CATALOG).toHaveLength(PARIS_TASK_CATALOG_V2.length);
    expect(getParisTask("procedure_follow_up", 1)).toBeUndefined();
    expect(getParisTask("procedure_follow_up", 2)?.label).toBe("Control de trámites");
    expect(getParisTask("procedure_follow_up", 3)?.label).toBe("Control de trámites");
    expect(getParisTask("gpar_bank_reconciliation", 1)?.label).toBe("Conciliación bancaria");
    expect(getParisTask("gpar_bank_reconciliation", 2)?.label).toBe("Conciliación bancaria");
    expect(getParisTask("gpar_bank_reconciliation", 3)?.label).toBe("Conciliación bancaria");
    expect(getParisTask("gpar_bank_reconciliation", 4)?.label).toBe("Conciliación bancaria");
    expect(PARIS_TASK_CATALOG_V3).toHaveLength(PARIS_TASK_CATALOG_V2.length);
    expect(getParisTask("salary_accounting_entry", 3)?.parameters).toContain("unidad");
    expect(getParisTask("vat_accounting_entry", 3)?.parameters).toContain("unidad");
  });

  it("usa businessUnitCode como dimensión única de unidad desde v4", () => {
    for (const version of [4, 5]) {
      expect(getParisTask("salary_accounting_entry", version)?.parameters).toEqual(["período"]);
      expect(getParisTask("vat_accounting_entry", version)?.parameters).toEqual(["período", "tipo"]);
      expect(getParisTask("salary_accounting_entry", version)?.parameters).not.toContain("unidad");
      expect(getParisTask("vat_accounting_entry", version)?.parameters).not.toContain("unidad");
      expect(isParisTaskParameterSet("vat_accounting_entry", { unidad: "PARIS AUTOS" }, version)).toBe(false);
    }
  });

  it("mantiene intacta v4 al versionar su alias y parámetros", () => {
    for (const v3Task of PARIS_TASK_CATALOG_V3) {
      const expectedV4 = {
        ...v3Task,
        aliases: v3Task.code === "gpar_bank_reconciliation"
          ? [...v3Task.aliases, "conc banc franc"]
          : v3Task.aliases,
        parameters: v3Task.parameters.filter((parameter) =>
          !(["salary_accounting_entry", "vat_accounting_entry"].includes(v3Task.code) && parameter === "unidad"),
        ),
      };
      expect(getParisTask(v3Task.code, 4)).toEqual(expectedV4);
      expect(getParisTask(v3Task.code, 4)).toEqual(PARIS_TASK_CATALOG_V4.find((task) => task.code === v3Task.code));
    }
  });

  it("mantiene v5 histórica y controla los bancos de conciliación en v6", () => {
    expect(getParisTask("gpar_bank_reconciliation", 5)).toEqual(PARIS_TASK_CATALOG_V5.find((task) => task.code === "gpar_bank_reconciliation"));
    expect(getParisTask("gpar_bank_reconciliation", 5)?.parameters).toEqual(["banco", "cuenta", "período"]);
    expect(getParisTask("gpar_bank_reconciliation", 6)?.parameters).toContain("banco no catalogado");
    expect(normalizeParisTaskParameters("gpar_bank_reconciliation", { banco: "Banco Francés", cuenta: " Cuenta 1 " }, 6)).toEqual({ banco: "frances", cuenta: "Cuenta 1" });
    expect(normalizeParisTaskParameters("gpar_bank_reconciliation", { banco: "CONC BANC FRANC" }, 6).banco).toBe("frances");
    expect(normalizeParisTaskParameters("gpar_bank_reconciliation", { banco: "bna" }, 6).banco).toBe("nacion");
    expect(isParisTaskParameterSet("gpar_bank_reconciliation", { banco: "banco frances" }, 6)).toBe(false);
    expect(isParisTaskParameterSet("gpar_bank_reconciliation", { banco: "frances", cuenta: "Cuenta 1" }, 6)).toBe(true);
    expect(isParisTaskParameterSet("gpar_bank_reconciliation", { banco: "unverified", "banco_no_catalogado": "Banco inventado" }, 6)).toBe(true);
    expect(hasRequiredParisTaskParameters("gpar_bank_reconciliation", { banco: "unverified", "banco_no_catalogado": "Banco inventado", cuenta: "Cuenta 1" }, 6)).toBe(true);
    expect(hasRequiredParisTaskParameters("gpar_bank_reconciliation", { banco: "unverified", cuenta: "Cuenta 1" }, 6)).toBe(false);
    expect(hasRequiredParisTaskParameters("gpar_bank_reconciliation", { banco: "frances", cuenta: "Cuenta 1", "banco_no_catalogado": "Otro" }, 6)).toBe(false);
    expect(getParisTaskSelectionPreset("gpar_bank_reconciliation", "conc banc franc", 6)).toMatchObject({ label: "Conciliación Banco Francés", parameters: { banco: "frances" } });
    expect(getParisTaskSelectionPreset("gpar_bank_reconciliation", "frances", 6)?.parameters.banco).toBe("frances");
    expect(getParisTaskSelectionPreset("gpar_bank_reconciliation", "Conciliación Banco Nación", 6)?.parameters.banco).toBe("nacion");
    expect(getParisTaskSelectionPreset("gpar_bank_reconciliation", "banco", 6)).toBeUndefined();
    expect(isParisTaskParameterComparisonEligible("gpar_bank_reconciliation", { banco: "frances" }, 6)).toBe(true);
    expect(isParisTaskParameterComparisonEligible("gpar_bank_reconciliation", undefined, 6)).toBe(false);
    expect(isParisTaskParameterComparisonEligible("gpar_bank_reconciliation", {}, 6)).toBe(false);
    expect(isParisTaskParameterComparisonEligible("gpar_bank_reconciliation", { banco: "unverified" }, 6)).toBe(false);
    expect(isParisTaskParameterComparisonEligible("gpar_bank_reconciliation", { banco: "Banco Francés" }, 5)).toBe(true);
  });

  it("corrige elegibilidad sin alterar el snapshot histórico v4", () => {
    expect(getParisTask("supplier_invoice_load", 4)?.comparisonEligible).toBe(true);
    expect(getParisTask("customer_collections", 4)?.comparisonEligible).toBe(false);
    expect(getParisTask("supplier_invoice_load", 5)?.comparisonEligible).toBe(false);
    expect(getParisTask("customer_collections", 5)?.comparisonEligible).toBe(true);
    expect(PARIS_TASK_CATALOG.filter((task) => task.comparisonEligible !== false)).toHaveLength(25);
    expect(PARIS_TASK_CATALOG.filter((task) => task.comparisonEligible === false)).toHaveLength(30);
  });

  it("mantiene los criterios de comparación en paridad con las 55 filas del borrador", () => {
    const contract = readFileSync(new URL("../docs/product/BUSINESS-UNIT-TASK-CATALOG-DRAFT-20261028.md", import.meta.url), "utf8");
    const taskSection = contract.split("## Tareas canónicas observadas")[1]?.split("\n## ")[0] || "";
    const rows = taskSection.split(/\r?\n/)
      .filter((line) => /^\|\s*`[^`]+`\s*\|/.test(line))
      .map((line) => {
        const columns = line.split("|").map((column) => column.trim());
        return { code: columns[1]?.replaceAll("`", ""), label: columns[2], status: columns[5] };
      });
    const statusByCode = new Map(rows.map((row) => [row.code, row.status]));

    expect(rows).toHaveLength(55);
    expect(statusByCode.size).toBe(55);
    expect(PARIS_TASK_CATALOG).toHaveLength(rows.length);
    for (const task of PARIS_TASK_CATALOG) {
      const status = statusByCode.get(task.code);
      expect(status, `falta ${task.code} en el borrador`).toBeDefined();
      expect(task.comparisonEligible !== false, task.code).toBe(status === "Confirmada");
      expect(rows.find((row) => row.code === task.code)?.label, `nombre de ${task.code}`).toBe(task.label);
    }
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

  it("permite elegir las 55 tareas observadas y señala las 30 sin comparación entre unidades", () => {
    expect(PARIS_TASK_CATALOG).toHaveLength(55);
    expect(selectableParisTasks()).toHaveLength(55);
    expect(selectableParisTasks(2)).toHaveLength(25);
    expect(PARIS_TASK_CATALOG.filter((task) => task.comparisonEligible === false)).toHaveLength(30);
    expect(selectableParisTasks().every((task) => task.state === "selectable")).toBe(true);
    expect(findParisTaskAlias("Análisis Bonis PYMES")?.state).toBe("selectable");
    expect(findParisTaskAlias("Análisis Bonis PYMES")?.comparisonEligible).toBe(false);
    expect(findParisTaskAlias("Carga de facturas de proveedores")?.comparisonEligible).toBe(false);
    expect(findParisTaskAlias("Registro de cobros de clientes")?.comparisonEligible).toBe(true);
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
