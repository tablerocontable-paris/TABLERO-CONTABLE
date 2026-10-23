import { describe, expect, it } from "vitest";
import {
  decodeCommandResponseV1,
  decodeCommandV1,
  decodeQueryResponseV1,
  decodeQueryV1,
} from "../src/data/supabase/operational-contract";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const record = {
  contractVersion: 1,
  operationId: id(90),
  kind: "operation.record",
  expectedRevisions: { [`task:${id(1)}`]: "0" },
  payload: { taskId: id(1), workDate: "2026-10-15", quantity: 5, reference: null },
};

describe("operational API v1 protocol", () => {
  it("accepts exact record, rate, and assessment envelopes", () => {
    expect(decodeCommandV1(record).ok).toBe(true);
    expect(decodeCommandV1({
      ...record,
      kind: "operation.rate",
      expectedRevisions: { [`rate:${id(2)}:template:${id(3)}`]: "0" },
      payload: { companyId: id(2), templateId: id(3), taskId: null, effectiveOn: "2026-10-15", unitWeight: "1.250000", reason: "Coeficiente por factura" },
    }).ok).toBe(true);
    expect(decodeCommandV1({
      ...record,
      kind: "operation.assess",
      expectedRevisions: { [`task:${id(1)}`]: "0", [`assessment:${id(1)}`]: "0" },
      payload: { taskId: id(1), quality: 0, order: 100, timeliness: 50, observation: "Revisión de calidad" },
    }).ok).toBe(true);
  });

  it.each([
    ["uppercase UUID", { ...record, expectedRevisions: { [`task:a0000000-0000-0000-0000-000000000001`]: "0" }, payload: { ...record.payload, taskId: "A0000000-0000-0000-0000-000000000001" } }],
    ["string contract version", { ...record, contractVersion: "1" }],
    ["extra envelope key", { ...record, actorId: id(3) }],
    ["unexpected revision key", { ...record, expectedRevisions: { ...record.expectedRevisions, ignored: "0" } }],
    ["noncanonical revision", { ...record, expectedRevisions: { [`task:${id(1)}`]: "00" } }],
    ["revision bigint overflow", { ...record, expectedRevisions: { [`task:${id(1)}`]: "9223372036854775808" } }],
    ["impossible date", { ...record, payload: { ...record.payload, workDate: "2026-02-30" } }],
    ["reference over limit", { ...record, payload: { ...record.payload, reference: "x".repeat(2001) } }],
    ["zero quantity", { ...record, payload: { ...record.payload, quantity: 0 } }],
    ["scientific coefficient", { ...record, kind: "operation.rate", expectedRevisions: { [`rate:${id(2)}:template:${id(3)}`]: "0" }, payload: { companyId: id(2), templateId: id(3), taskId: null, effectiveOn: "2026-10-15", unitWeight: "1e2", reason: "Coeficiente por factura" } }],
    ["seven coefficient decimals", { ...record, kind: "operation.rate", expectedRevisions: { [`rate:${id(2)}:template:${id(3)}`]: "0" }, payload: { companyId: id(2), templateId: id(3), taskId: null, effectiveOn: "2026-10-15", unitWeight: "1.1234567", reason: "Coeficiente por factura" } }],
    ["rate with both scopes", { ...record, kind: "operation.rate", expectedRevisions: { [`rate:${id(2)}:template:${id(3)}`]: "0" }, payload: { companyId: id(2), templateId: id(3), taskId: id(4), effectiveOn: "2026-10-15", unitWeight: "1", reason: "Coeficiente por factura" } }],
  ])("rejects %s without echoing the input", (_name, value) => {
    const decoded = decodeCommandV1(value);
    expect(decoded).toEqual({ ok: false, error: "protocol" });
    expect(JSON.stringify(decoded)).not.toContain("Coeficiente por factura");
  });

  it("accepts and rejects query envelopes strictly", () => {
    expect(decodeQueryV1({ contractVersion: 1, kind: "activityPage", filters: { taskId: id(1) }, cursor: null, limit: 50 }).ok).toBe(true);
    expect(decodeQueryV1({ contractVersion: 1, kind: "quality", filters: { taskId: id(1) }, cursor: null, limit: 1 }).ok).toBe(true);
    expect(decodeQueryV1({ contractVersion: 1, kind: "quality", filters: { taskId: id(1) }, cursor: null, limit: 2 }).ok).toBe(false);
    expect(decodeQueryV1({ contractVersion: "1", kind: "quality", filters: { taskId: id(1) }, cursor: null, limit: 1 }).ok).toBe(false);
    expect(decodeQueryV1({ contractVersion: 1, kind: "futureKind", filters: {}, cursor: null, limit: 1 }).ok).toBe(false);
    expect(decodeQueryV1({ contractVersion: 1, kind: "workspacePage", filters: { subjectId: null, period: "2026-10-01", companyId: null, teamId: null, sector: null }, cursor: null, limit: 100 }).ok).toBe(true);
    expect(decodeQueryV1({ contractVersion: 1, kind: "workspacePage", filters: { subjectId: id(1), period: "2026-10-02", companyId: null, teamId: null, sector: null }, cursor: null, limit: 100 }).ok).toBe(false);
  });

  it("rejects malformed runtime values without throwing and returns normalized union data", () => {
    for (const revision of ["x", "1.5"]) {
      expect(() => decodeCommandV1({ ...record, expectedRevisions: { [`task:${id(1)}`]: revision } })).not.toThrow();
      expect(decodeCommandV1({ ...record, expectedRevisions: { [`task:${id(1)}`]: revision } })).toEqual({ ok: false, error: "protocol" });
    }
    const cyclic: Record<string, unknown> = { ...record };
    cyclic.self = cyclic;
    expect(decodeCommandV1(cyclic)).toEqual({ ok: false, error: "protocol" });
    expect(decodeCommandV1({ ...record, payload: { ...record.payload, reference: 1n } })).toEqual({ ok: false, error: "protocol" });

    const normalized = decodeCommandV1({ ...record, payload: { ...record.payload, reference: "  Lote  " } });
    expect(normalized.ok).toBe(true);
    if (normalized.ok && normalized.value.kind === "operation.record") expect(normalized.value.payload.reference).toBe("Lote");
  });

  it("validates exact response DTOs and preserves null versus zero", () => {
    expect(decodeCommandResponseV1({ contractVersion: 1, operationId: id(90), kind: "operation.record", result: { entryId: id(4), taskRevision: "1", measurementVersion: 2, rateId: null, unitWeight: null, weightedLoad: null } }).ok).toBe(true);
    expect(decodeCommandResponseV1({ contractVersion: 1, operationId: id(90), kind: "operation.record", result: { entryId: id(4), taskRevision: 1, measurementVersion: 2, rateId: null, unitWeight: "0", weightedLoad: "0" } }).ok).toBe(false);
    expect(decodeQueryResponseV1({ contractVersion: 1, kind: "quality", data: { taskId: id(1), current: null } }).ok).toBe(true);
    expect(decodeQueryResponseV1({ contractVersion: 1, kind: "quality", data: { taskId: id(1), current: { assessmentId: id(3), revision: "1", quality: 0, order: 0, timeliness: 0, mean: "0.00", observation: "Sin mejora", evaluatedBy: id(2), evaluatedAt: "2026-10-15T12:00:00Z" } } }).ok).toBe(true);
    expect(decodeQueryResponseV1({ contractVersion: 1, kind: "quality", data: { taskId: id(1), current: { assessmentId: id(3), revision: "1", quality: 0, order: 0, timeliness: 0, mean: "0.00", observation: "Sin mejora", evaluatedBy: id(2), evaluatedAt: "2026-10-15T12:00:00+00:00" } } }).ok).toBe(true);
    const workspacePage = { contractVersion: 1, kind: "workspacePage", data: { evaluatedAt: "2026-10-15T12:00:00Z", nextCursor: null, items: [{ taskId: id(1), taskRevision: "1", ownerId: id(2), ownerDisplayName: "Ana", teamId: id(3), teamName: "Equipo", companyId: id(4), companyName: "Empresa", period: "2026-10-01", scheduledOn: null, title: "Cierre", kind: "operativa", measurementVersion: 2, status: "Pendiente", dueDate: null, priority: "Media", weight: null, target: null, unit: "facturas", checklist: [], ready: true, blockerCodes: [], hasHiddenDependencies: false, subjectWork: { recordedSeconds: "0", movementCount: "0", quantity: "0", unit: "facturas", ratedLoad: "0", weightedLoad: "0", unratedQuantity: "0" } }] } };
    expect(decodeQueryResponseV1(workspacePage).ok).toBe(true);
    const privateFields = structuredClone(workspacePage) as any;
    privateFields.data.items[0].blockedBy = "motivo privado";
    expect(decodeQueryResponseV1(privateFields).ok).toBe(false);
    const ratedFromCurrentRate = structuredClone(workspacePage) as any;
    ratedFromCurrentRate.data.items[0].subjectWork.currentRate = "1.5";
    expect(decodeQueryResponseV1(ratedFromCurrentRate).ok).toBe(false);
  });
});
