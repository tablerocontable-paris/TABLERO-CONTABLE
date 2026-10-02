// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PeriodReports from "../src/components/PeriodReports";
import { seed } from "../src/data/repository";
import { metrics, type Closure, type Metrics } from "../src/domain/model";

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
    state.closures = [current];
    render(<PeriodReports state={state} month="2026-10" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Ver reporte" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Descargar reporte CSV" }));
    expect(csvExports).toHaveLength(1);
    const csv = csvExports[0]!;
    expect(csv).toContain("Sin medición histórica");
    expect(csv).toContain("Sin muestra");
    expect(csv).toContain("Promedio días anticipación metas");
  });
});
