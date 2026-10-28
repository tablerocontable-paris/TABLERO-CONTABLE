import { describe, expect, it } from "vitest";
import {
  findParisTaskAlias,
  PARIS_BUSINESS_UNITS,
  PARIS_TASK_CATALOG,
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

  it("oculta de la selección inicial las filas marcadas para revisión", () => {
    expect(selectableParisTasks().length).toBeGreaterThan(20);
    expect(selectableParisTasks().every((task) => task.state === "selectable")).toBe(true);
    expect(findParisTaskAlias("Análisis Bonis PYMES")?.state).toBe("review");
  });
});
