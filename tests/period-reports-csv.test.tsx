// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PeriodReports from "../src/components/PeriodReports";
import { seed } from "../src/data/repository";
import { metrics, type Closure, type Metrics, type Task } from "../src/domain/model";
import { closureCsvRows } from "../src/domain/reports";

let csvExports: string[] = [];
beforeEach(() => {
  csvExports = [];
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  vi.stubGlobal("Blob", class { constructor(parts: unknown[]) { csvExports.push(parts.map(String).join("")); } });
  vi.stubGlobal("URL", { createObjectURL: () => "blob:report", revokeObjectURL: () => {} });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("CSV de reporte cerrado", () => {
  it("exporta cuota, puntos y tiempo propios para una tarea conjunta", () => {
    const state = seed();
    const task: Task = {
      ...state.tasks[0]!,
      id: "shared-close-export",
      ownerId: "e0",
      weight: 5,
      status: "Completada" as const,
      responsibility: {
        version: 1 as const,
        revision: 1 as const,
        mode: "joint" as const,
        activatedAt: "2026-10-06T10:00:00Z",
        activatedBy: "boss",
        reason: "Revisión conjunta",
        members: [
          { profileId: "e0", shareBps: 6000, name: "A", teamId: "t1", sector: "Tesorería" },
          { profileId: "e1", shareBps: 4000, name: "B", teamId: "t1", sector: "Tesorería" },
        ],
      },
      sessions: [
        { id: "a", actorId: "e0", start: "2026-10-06T10:00:00Z", end: "2026-10-06T10:10:00Z" },
        { id: "b", actorId: "e1", start: "2026-10-06T10:00:00Z", end: "2026-10-06T10:20:00Z" },
      ],
    };
    const closure = {
      id: "closure-e1", ownerId: "e1", month: "2026-10", at: "2026-10-31T23:59:59Z", by: "boss",
      metrics: metrics([task], []), tasks: [task], activity: [], note: "Validado",
    } satisfies Closure;
    const rows = closureCsvRows(closure, () => "Empresa de prueba");
    expect(rows[0]).toContain("Participación personal %");
    expect(rows[1]).toEqual(expect.arrayContaining([5, 40, 2, 2, "00:20:00", "Completada"]));
  });
  it("no exporta puntos de cuota para una operativa de un reporte nuevo", () => {
    const state = seed();
    const task = { ...state.tasks.find((row) => row.kind === "operativa")!, target: 10, weight: 4 };
    const closure = {
      id: "new-lab-operative-export", ownerId: task.ownerId, month: task.month, at: `${task.month}-30T23:59:59Z`, by: "boss",
      metrics: metrics([], []), tasks: [task], activity: [], note: "Cierre de prueba", report: { schemaVersion: 3 },
    } as unknown as Closure;
    const row = closureCsvRows(closure, () => "Empresa de prueba")[1]!;
    expect(row.slice(3, 7)).toEqual(["No aplica", "No aplica", "No aplica", "No aplica"]);
    expect(row[11]).toBe("No aplica");
  });
  it("conserva la columna meta en los reportes históricos", () => {
    const state = seed();
    const task = { ...state.tasks.find((row) => row.kind === "operativa")!, target: 18 };
    const closure = {
      id: "legacy-operative-export", ownerId: task.ownerId, month: task.month, at: `${task.month}-30T23:59:59Z`, by: "boss",
      metrics: metrics([], []), tasks: [task], activity: [], note: "Cierre anterior",
      report: { schemaVersion: 2 },
    } as unknown as Closure;
    expect(closureCsvRows(closure, () => "Empresa de prueba")[1]![11]).toBe(18);
  });
  it("separa operativas de entregables en el reporte nuevo", () => {
    const state = seed();
    const base = metrics([], []);
    const summary = {
      movementCount: 0, quantityByUnit: [], weightedLoad: null, unweightedQuantity: 0,
      recordedSeconds: 0, quality: null, order: null, timeliness: null, evaluations: 0,
    };
    const closure: Closure = {
      id: "lab-report-without-operations", ownerId: "e0", month: "2026-10", at: "2026-10-31T23:59:59Z", by: "boss",
      metrics: base, tasks: [], activity: [], note: "",
      report: {
        schemaVersion: 3, generatedAt: "2026-10-31T23:59:59Z", employee: "Valentino Magni",
        team: "Tesorería", sector: "Contabilidad", recipientIds: ["boss"], recipientNames: ["Juan Pablo"],
        delivery: "disponible en demostración", recordedSeconds: 0, reopenings: 0,
        groups: [{ key: "deliverables", company: "San Luis Capital", process: "Conciliación", templateId: null,
          kind: "resultado", unit: "", metrics: base, recordedSeconds: 0, reopenings: 0 }],
        laboratorySummary: { operational: summary, covered: { ...summary, quantityByUnit: [] } },
      },
    };
    state.closures = [closure];
    render(<PeriodReports state={state} month="2026-10" laboratory />);
    fireEvent.click(screen.getByRole("button", { name: "Desplegar Reportes emitidos al cierre" }));
    expect(screen.getByText("Sin operativas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver reporte" }));
    fireEvent.click(screen.getByRole("button", { name: "Descargar reporte CSV" }));
    expect(csvExports[0]).toContain("No aplica");
  });
  it("exporta trabajo de cobertura separado sin asignar puntos al reemplazo", () => {
    const state = seed();
    state.activeId = "m1";
    const base = metrics([], []);
    const closure: Closure = {
      id: "coverage-report-export", ownerId: "e1", month: "2026-10", at: "2026-10-31T23:59:59Z", by: "boss",
      metrics: base, tasks: [], activity: [], note: "",
      report: {
        schemaVersion: 3, generatedAt: "2026-10-31T23:59:59Z", employee: "Reemplazo",
        team: "Tesorería", sector: "Contabilidad", recipientIds: ["boss"], recipientNames: ["Jefatura"],
        delivery: "disponible en demostración", groups: [], recordedSeconds: 60, reopenings: 0,
        laboratorySummary: { operational: {
          movementCount: 0, quantityByUnit: [], weightedLoad: null, unweightedQuantity: 0,
          recordedSeconds: 0, quality: null, order: null, timeliness: null, evaluations: 0,
        }, covered: { movementCount: 1, quantityByUnit: [{ unit: "factura", quantity: 3 }], weightedLoad: null, unweightedQuantity: 3, recordedSeconds: 60 } },
        coverageContributions: [{ taskId: "covered-task", title: "Carga de facturas", companyId: "c1", company: "San Luis Capital",
          originalOwnerId: "e6", originalOwner: "Titular fuera del equipo", executorId: "e1", executor: "Reemplazo", executorTeamId: "t1",
          sector: "Contabilidad", kind: "operativa", unit: "facturas", sessions: [{ id: "covered-session", start: "2026-10-10T10:00:00Z", end: "2026-10-10T10:01:00Z" }],
          activity: [{ id: "covered-movement", date: "2026-10-10", qty: 3, note: "Lote A" }], completionAt: null }],
      },
    };
    const rows = closureCsvRows(closure, (companyId) => state.companies.find((company) => company.id === companyId)?.name || companyId);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(expect.arrayContaining(["Carga de facturas · titular Titular fuera del equipo · ejecutor Reemplazo", "Cobertura ejecutada", "00:01:00", 3, "facturas", "No aplica"]));
    expect(rows[1]?.[3]).toBe("No aplica");
    expect(rows[1]?.[6]).toBe("No aplica");
    expect(closureCsvRows(closure, (id) => id, (item) => item.executorId === "another-user")).toHaveLength(1);
    state.closures = [closure];
    render(<PeriodReports state={state} month="2026-10" laboratory />);
    fireEvent.click(screen.getByRole("button", { name: "Desplegar Reportes emitidos al cierre" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver reporte" }));
    expect(screen.queryByText("Titular fuera del equipo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Descargar reporte CSV" }));
    expect(csvExports[0]).not.toContain("Titular fuera del equipo");
    expect(csvExports[0]).not.toContain("Reemplazo");
  });
  it("distingue falta de snapshot histórico y resumen nuevo sin muestra", async () => {
    const state = seed();
    const base = metrics([], []);
    const old = { ...base, timeliness: undefined };
    const noSample = { ...base, timeliness: base.timeliness };
    const makeClosure = (id: string, groupMetrics: Metrics): Closure => ({
      id, ownerId: "e0", month: "2026-10", at: "2026-10-31T23:59:59Z", by: "boss",
      metrics: groupMetrics, tasks: [], activity: [], note: "",
      report: {
        schemaVersion: 1, generatedAt: "2026-10-31T23:59:59Z", employee: "Empleado",
        team: "Equipo", sector: "Contabilidad", recipientIds: [], recipientNames: [],
        delivery: "disponible en demostración", recordedSeconds: 0, reopenings: 0,
        groups: [{ key: id, company: "Empresa", process: id, templateId: null,
          kind: "resultado", unit: "", metrics: groupMetrics, recordedSeconds: 0, reopenings: 0 }],
      },
    });
    const historic = makeClosure("Histórico", old);
    const current = makeClosure("Nuevo", noSample);
    current.report!.groups.unshift(historic.report!.groups[0]!);
    current.report!.transfers = [{
      taskId: "task-transfer", title: "Conciliación iniciada", formerOwner: "Valentino Magni",
      newOwner: "Lucía Fernández", reason: "Continuidad del cierre mensual", transferredAt: "2026-10-06T15:00:00.000Z",
    }];
    current.taskTransfers = [{
      id: "transfer-1", taskId: "task-transfer", formerOwnerId: "e0", formerOwnerName: "Valentino Magni",
      newOwnerId: "e1", newOwnerName: "Lucía Fernández", companyId: "c1", reason: "Continuidad del cierre mensual",
      transferredAt: "2026-10-06T15:00:00.000Z", transferredBy: "boss",
      taskSnapshot: { ...state.tasks[0]!, id: "task-transfer", title: "Conciliación iniciada" }, sessions: [], activity: [], comments: [],
    }];
    state.closures = [current];
    render(<PeriodReports state={state} month="2026-10" />);
    fireEvent.click(screen.getByRole("button", { name: "Desplegar Reportes emitidos al cierre" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Ver reporte" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Descargar reporte CSV" }));
    expect(csvExports).toHaveLength(1);
    const csv = csvExports[0]!;
    expect(csv).toContain("Sin medición histórica");
    expect(csv).toContain("Sin muestra");
    expect(csv).toContain("Promedio días anticipación metas");
    expect(csv).toContain("Continuidad del cierre mensual");
    expect(csv).toContain("Valentino Magni");
  });
});

describe("impresión del reporte cerrado", () => {
  it("abre la impresión del reporte seleccionado sin reemplazar la descarga CSV", () => {
    const state = seed();
    const base = metrics([], []);
    const closure: Closure = {
      id: "print-closure", ownerId: "e0", month: "2026-10", at: "2026-10-31T23:59:59Z", by: "boss",
      metrics: base, tasks: [], activity: [], note: "Cierre revisado",
      report: {
        schemaVersion: 1, generatedAt: "2026-10-31T23:59:59Z", employee: "Valentino Magni",
        team: "Tesorería", sector: "Contabilidad", recipientIds: ["boss"], recipientNames: ["Juan Pablo"],
        delivery: "disponible en demostración", recordedSeconds: 0, reopenings: 0,
        groups: [{ key: "print", company: "San Luis Capital", process: "Conciliación", templateId: null,
          kind: "resultado", unit: "", metrics: base, recordedSeconds: 0, reopenings: 0 }],
      },
    };
    state.closures = [closure];
    const print = vi.fn();
    vi.stubGlobal("print", print);
    render(<PeriodReports state={state} month="2026-10" />);

    fireEvent.click(screen.getByRole("button", { name: "Desplegar Reportes emitidos al cierre" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver reporte" }));
    expect(document.querySelector("dialog.period-report-dialog[open]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Imprimir reporte" }));

    expect(print).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Descargar reporte CSV" })).toBeTruthy();
  });
});
