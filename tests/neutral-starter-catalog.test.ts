import { describe, expect, it } from "vitest";
import { seed } from "../src/data/repository";
import { defaultSchedule } from "../src/domain/schedule";
import { reviseAssignment } from "../src/domain/planning";
import { standardizeAssignment } from "../src/domain/catalogue";
import {
  materializeNeutralStarterAssignment,
  NEUTRAL_STARTER_CATALOG,
  NEUTRAL_STARTER_CATALOG_VERSION,
  NEUTRAL_STARTER_SUGGESTIONS,
  NEUTRAL_STARTER_SUGGESTIONS_VERSION,
  NEUTRAL_STARTER_V2_IDS,
} from "../src/domain/neutralStarterCatalog";
import { CONCEPT_CODE_LIST, STARTER_CONCEPT_CODES, WORKFORCE_TAXONOMY_VERSION } from "../src/domain/workforceTaxonomy.mjs";

describe("catálogo inicial neutral", () => {
  it("preserves v1 IDs and exposes the approved 26 v2 prompts in five groups", () => {
    expect(NEUTRAL_STARTER_CATALOG.map(({ id }) => id)).toEqual([
      "starter-v1-bank-reconciliation", "starter-v1-tax-obligations", "starter-v1-document-recording",
      "starter-v1-procedure-follow-up", "starter-v1-payment-processing", "starter-v1-accounting-close",
    ]);
    expect(NEUTRAL_STARTER_SUGGESTIONS_VERSION).toBe(2);
    expect(NEUTRAL_STARTER_SUGGESTIONS).toHaveLength(26);
    expect(NEUTRAL_STARTER_SUGGESTIONS.every((row) => row.id.startsWith("starter-suggestion-v2-") && /^[a-z0-9-]+$/.test(row.id))).toBe(true);
    expect(new Set(NEUTRAL_STARTER_SUGGESTIONS.map((row) => row.id)).size).toBe(26);
    expect(NEUTRAL_STARTER_SUGGESTIONS.every((row) => row.aliases.length > 0 && row.description.length > 0 && row.suggestedSteps.length >= 2 && row.suggestedSteps.length <= 4 && ["resultado", "operativa"].includes(row.suggestedKind))).toBe(true);
    expect(NEUTRAL_STARTER_SUGGESTIONS.every((row) => row.suggestedKind === "operativa" ? !!row.suggestedUnit : row.suggestedUnit === "")).toBe(true);
    expect(NEUTRAL_STARTER_SUGGESTIONS.every((row) => row.neutralConceptCode === STARTER_CONCEPT_CODES[row.id] && row.taxonomyVersion === WORKFORCE_TAXONOMY_VERSION)).toBe(true);
    expect(new Set(NEUTRAL_STARTER_SUGGESTIONS.map((row) => row.neutralConceptCode)).size).toBe(26);
    expect(new Set(CONCEPT_CODE_LIST.filter((code) => code !== "other_pending_review")).size).toBe(26);
    expect(Object.fromEntries(NEUTRAL_STARTER_SUGGESTIONS.map(({ title, id }) => [title, id]))).toEqual(NEUTRAL_STARTER_V2_IDS);
    expect(Object.fromEntries([...new Set(NEUTRAL_STARTER_SUGGESTIONS.map((row) => row.group))].map((group) => [group, NEUTRAL_STARTER_SUGGESTIONS.filter((row) => row.group === group).length]))).toEqual({
      "Tesorería, bancos y cobranzas": 11,
      "Registración y documentación": 4,
      "Contabilidad, inventario y obligaciones": 4,
      "Análisis e indicadores": 3,
      "Coordinación y administración": 4,
    });
    expect(NEUTRAL_STARTER_SUGGESTIONS.every((row) => !("weight" in row) && !("templateId" in row))).toBe(true);
  });
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
