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

    fireEvent.click(screen.getByRole("button", { name: "Ver reporte" }));
    expect(document.querySelector("dialog.period-report-dialog[open]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Imprimir reporte" }));

    expect(print).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Descargar reporte CSV" })).toBeTruthy();
  });
});
