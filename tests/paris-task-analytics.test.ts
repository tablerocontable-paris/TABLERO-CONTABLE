import { describe, expect, it } from "vitest";
import type { Task } from "../src/domain/model";
import { summarizeParisTaskWork } from "../src/domain/parisTaskAnalytics";

function task(id: string, businessUnitCode: Task["businessUnitCode"], parameters: Record<string, string> = {}, overrides: Partial<Task> = {}): Task {
  return {
    id, assignmentId: `assignment-${id}`, title: "Conciliación bancaria", ownerId: "employee", companyId: `company-${id}`,
    teamId: "team", sector: "Tesorería", month: "2026-10", due: "2026-10-30", kind: "resultado", weight: 2,
    unit: "", target: 0, status: "Pendiente", checklist: [], completedAt: null, startedAt: null,
    priority: "Media", blockedBy: "", blockedSince: null,
    taskCode: "gpar_bank_reconciliation", taskCatalogVersion: 4, businessUnitCode, taskParameters: parameters,
    ...overrides,
  };
}

describe("medición del catálogo de tareas Grupo París", () => {
  it("agrupa el mismo código por unidad de negocio y conserva parámetros como banco", () => {
    const rows = summarizeParisTaskWork([
      task("a", "paris_autos", { banco: "Banco Francés" }, { status: "Completada" }),
      task("b", "paris_autos", { banco: "Banco Nación" }),
      task("c", "doral", { banco: "Banco Francés" }),
    ], []);

    expect(rows).toHaveLength(3);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskCode: "gpar_bank_reconciliation", businessUnitCode: "paris_autos", parameters: { banco: "Banco Nación" }, assigned: 1, completed: 0 }),
      expect.objectContaining({ taskCode: "gpar_bank_reconciliation", businessUnitCode: "paris_autos", parameters: { banco: "Banco Francés" }, assigned: 1, completed: 1 }),
      expect.objectContaining({ taskCode: "gpar_bank_reconciliation", businessUnitCode: "doral", parameters: { banco: "Banco Francés" }, assigned: 1, completed: 0 }),
    ]));
  });

  it("no deduce un código canónico del título histórico", () => {
    const historical = task("old", undefined, {}, { taskCode: undefined, taskCatalogVersion: undefined, businessUnitCode: undefined });
    const [row] = summarizeParisTaskWork([historical], []);
    expect(row).toMatchObject({ taskCode: null, title: "Trabajo histórico sin clasificar", businessUnitLabel: "Sin clasificar" });
  });

  it("separa métricas de versiones distintas y conserva la etiqueta histórica", () => {
    const rows = summarizeParisTaskWork([
      task("v1", "paris_autos", { banco: "Banco Francés" }, { taskCatalogVersion: 1 }),
      task("v2", "paris_autos", { banco: "Banco Francés" }, { taskCatalogVersion: 2 }),
      task("v3", "paris_autos", { banco: "Banco Francés" }, { taskCatalogVersion: 3 }),
      task("v4", "paris_autos", { banco: "Banco Francés" }, { taskCatalogVersion: 4 }),
      task("v5", "paris_autos", { banco: "Banco Francés" }, { taskCatalogVersion: 5 }),
    ], []);
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.taskCatalogVersion)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.every((row) => row.title === "Conciliación bancaria")).toBe(true);
  });

  it("aplica el criterio v5 sólo al trabajo nuevo y respeta elegibilidad v4 histórica", () => {
    const rows = summarizeParisTaskWork([
      task("supplier-v4", "paris_autos", {}, { taskCode: "supplier_invoice_load", taskCatalogVersion: 4 }),
      task("supplier-v5", "paris_autos", {}, { taskCode: "supplier_invoice_load", taskCatalogVersion: 5 }),
      task("collections-v4", "paris_autos", {}, { taskCode: "customer_collections", taskCatalogVersion: 4 }),
      task("collections-v5", "paris_autos", {}, { taskCode: "customer_collections", taskCatalogVersion: 5 }),
    ], []);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskCode: "supplier_invoice_load", taskCatalogVersion: 4, comparisonEligible: true }),
      expect.objectContaining({ taskCode: "supplier_invoice_load", taskCatalogVersion: 5, comparisonEligible: false }),
      expect.objectContaining({ taskCode: "customer_collections", taskCatalogVersion: 4, comparisonEligible: false }),
      expect.objectContaining({ taskCode: "customer_collections", taskCatalogVersion: 5, comparisonEligible: true }),
    ]));
  });

  it("registra una tarea provisional sin marcarla comparable entre unidades", () => {
    const row = summarizeParisTaskWork([
      task("provisional", "paris_autos", { tipo_especifico: "gastos varios" }, {
        title: "Carga de otras facturas", taskCode: "invoice_load_other", taskCatalogVersion: 4,
        kind: "operativa", unit: "facturas",
      }),
    ], [])[0];

    expect(row).toMatchObject({
      taskCode: "invoice_load_other", taskCatalogVersion: 4,
      comparisonEligible: false, movementCount: 0,
    });
  });

  it("suma los movimientos de una operativa en su unidad común y muestra la cantidad medida", () => {
    const operational = task("invoice", "paris_autos", { proveedor: "Proveedor A" }, {
      title: "Carga de facturas de proveedores", taskCode: "supplier_invoice_load", kind: "operativa", unit: "facturas",
    });
    const rows = summarizeParisTaskWork([operational], [
      { id: "m1", taskId: "invoice", date: "2026-10-01", qty: 2, note: "", createdAt: "2026-10-01T12:00:00Z", actorId: "employee" },
      { id: "m2", taskId: "invoice", date: "2026-10-02", qty: 3, note: "", createdAt: "2026-10-02T12:00:00Z", actorId: "employee" },
    ]);
    expect(rows[0]).toMatchObject({ movementCount: 2, movementQuantity: 5, unit: "facturas" });
  });
});
