import { describe, expect, it } from "vitest";
import { seed } from "../src/data/repository";
import { defaultSchedule } from "../src/domain/schedule";
import { reviseAssignment } from "../src/domain/planning";
import { standardizeAssignment } from "../src/domain/catalogue";
import {
  materializeNeutralStarterAssignment,
  NEUTRAL_STARTER_CATALOG,
  NEUTRAL_STARTER_CATALOG_VERSION,
} from "../src/domain/neutralStarterCatalog";

describe("catálogo inicial neutral", () => {
  it("materializa una selección versionada con título y controles propios sin incorporarla al catálogo común", () => {
    const state = seed();
    const originalTemplates = structuredClone(state.templates);
    const bankReconciliation = NEUTRAL_STARTER_CATALOG[0]!;
    const paymentProcessing = NEUTRAL_STARTER_CATALOG.find((entry) => entry.id.endsWith("payment-processing"))!;
    const schedule = defaultSchedule("2026-10-25", "mensual");
    const first = materializeNeutralStarterAssignment(bankReconciliation.id, {
      id: `onboard-e0-c1-${bankReconciliation.id}`,
      owner: { id: "e0", sector: "Contabilidad general" },
      companyId: "c1",
      startMonth: "2026-10",
      day: 25,
      schedule,
    });
    const second = materializeNeutralStarterAssignment(paymentProcessing.id, {
      id: `onboard-e0-c1-${paymentProcessing.id}`,
      owner: { id: "e0", sector: "Contabilidad general" },
      companyId: "c1",
      startMonth: "2026-10",
      day: 25,
      schedule,
    });

    expect(NEUTRAL_STARTER_CATALOG_VERSION).toBe(1);
    expect(first).toMatchObject({
      id: `onboard-e0-c1-${bankReconciliation.id}`,
      templateId: null,
      starterId: bankReconciliation.id,
      title: bankReconciliation.title,
      sector: "Contabilidad general",
      kind: "resultado",
      steps: bankReconciliation.steps,
      frequency: "mensual",
      schedule,
    });
    expect(second).toMatchObject({
      templateId: null,
      title: paymentProcessing.title,
      kind: "operativa",
      unit: "pagos",
      steps: paymentProcessing.steps,
      target: 0,
    });
    expect(materializeNeutralStarterAssignment("starter-v99-missing", {
      id: "missing", owner: { id: "e0", sector: "General" }, companyId: "c1", startMonth: "2026-10", day: 25, schedule,
    })).toBeUndefined();
    expect(state.templates).toEqual(originalTemplates);
    expect(state.templates.map((entry) => entry.id)).not.toContain(bankReconciliation.id);
    expect(new Set([first!.id, second!.id]).size).toBe(2);
    expect(standardizeAssignment(state, first!)).toEqual(first);
    expect(() => standardizeAssignment(state, { ...first!, starterId: "starter-v99-invalid" })).toThrow(/concepto inicial versionado/i);
  });

  it("permite reprogramar una recurrencia versionada sin convertirla en estándar común", () => {
    const state = seed();
    const starter = NEUTRAL_STARTER_CATALOG.find((entry) => entry.id.endsWith("payment-processing"))!;
    const assignment = materializeNeutralStarterAssignment(starter.id, {
      id: "starter-recurring-rule",
      owner: { id: "e0", sector: "Contabilidad general" },
      companyId: "c1",
      startMonth: "2027-01",
      day: 25,
      schedule: defaultSchedule("2027-01-25", "mensual"),
    })!;
    const next = reviseAssignment(
      { ...state, assignments: [...state.assignments, assignment] },
      assignment.id,
      defaultSchedule("2027-02-01", "mensual"),
      "boss",
    );

    expect(next.assignments.find((row) => row.id === assignment.id)?.schedule?.endDate).toBe("2027-01-31");
    expect(next.assignments.at(-1)).toMatchObject({
      templateId: null,
      starterId: starter.id,
      frequency: "mensual",
      startMonth: "2027-02",
    });
    expect(next.templates).toEqual(state.templates);
    expect(next.tasks.some((task) => task.assignmentId === next.assignments.at(-1)?.id)).toBe(true);
  });
});
