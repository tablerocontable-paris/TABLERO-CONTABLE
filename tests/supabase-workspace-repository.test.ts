import { describe, expect, it, vi } from "vitest";
import { createWorkspaceRepository, type WorkspaceQueryTransport } from "../src/data/supabase/workspace-repository";
import type { QueryResponseV1 } from "../src/data/supabase/operational-contract";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const pageInput = (limit = 100) => ({ filters: { subjectId: null, period: "2026-10-01", companyId: null, teamId: null, sector: "   Impuestos  " }, cursor: null, limit });
const checklistInput = (limit = 16) => ({ filters: { taskId: id(1), subjectId: null, taskRevision: "9223372036854775807" }, cursor: "opaqueCursor", limit });

const pageResponse = (kind: "workspacePageV2" | "taskChecklistPage" = "workspacePageV2") => ({
  contractVersion: 1,
  kind,
  data: { evaluatedAt: "2026-10-23T12:00:00.000Z", items: [], nextCursor: null },
});
const workspaceResultItem = (checklistState: "inline" | "paged" | "requires_review") => ({
  taskId: id(1), taskRevision: "9223372036854775807", ownerId: id(3), ownerDisplayName: "Ana",
  teamId: id(4), teamName: "Equipo", companyId: id(5), companyName: "Empresa", period: "2026-10-01",
  scheduledOn: null, title: "Cierre", status: "Pendiente", dueDate: null, priority: "Media",
  ready: true, blockerCodes: [], hasHiddenDependencies: false,
  kind: "resultado", measurementVersion: 1, weight: "1.2300", target: null, unit: null,
  checklistState, checklistControlCount: checklistState === "paged" ? 101 : 1,
  checklist: checklistState === "inline" ? [{ id: id(6), text: "Control", done: false }] : [],
  subjectWork: { recordedSeconds: "0" },
});
const populatedPageResponse = (checklistState: "inline" | "paged" | "requires_review") => ({
  contractVersion: 1,
  kind: "workspacePageV2",
  data: { evaluatedAt: "2026-10-23T12:00:00.000Z", items: [workspaceResultItem(checklistState)], nextCursor: null },
});
const checklistResponse = (items: unknown[] = [], totalControls = 0, nextCursor: string | null = null) => ({
  contractVersion: 1,
  kind: "taskChecklistPage",
  data: { evaluatedAt: "2026-10-23T12:00:00.000Z", taskId: id(1), taskRevision: "9223372036854775807", totalControls, items, nextCursor },
});
const item = (overrides: Record<string, unknown> = {}) => ({
  id: id(2), ordinal: 1, textPart: "x", textOffset: 0, textLength: 1,
  textComplete: true, done: false, issueCode: null, ...overrides,
});
const transportFor = (response: unknown): WorkspaceQueryTransport => ({
  query: vi.fn(async () => ({ ok: true as const, value: response as QueryResponseV1 })),
});

describe("isolated workspace query repository", () => {
  it("sends the canonical workspacePageV2 query and preserves response values", async () => {
    const response = pageResponse();
    const transport = transportFor(response);
    const result = await createWorkspaceRepository(transport).listPage(pageInput());
    expect(transport.query).toHaveBeenCalledExactlyOnceWith({ contractVersion: 1, kind: "workspacePageV2", ...pageInput(), filters: { ...pageInput().filters, sector: "Impuestos" } });
    expect(result).toEqual({ ok: true, value: response });
    expect(result.ok && result.value.kind).toBe("workspacePageV2");
  });

  it("validates request bounds and prevents transport calls for invalid inputs", async () => {
    const transport = transportFor(pageResponse());
    const repo = createWorkspaceRepository(transport);
    expect(await repo.listPage(pageInput(101))).toEqual({ ok: false, error: "protocol" });
    expect(await repo.readChecklistPage(checklistInput(17))).toEqual({ ok: false, error: "protocol" });
    expect(await repo.listPage({ ...pageInput(), filters: { ...pageInput().filters, period: "2026-10-02" } })).toEqual({ ok: false, error: "protocol" });
    expect(transport.query).not.toHaveBeenCalled();
  });

  it("requires the expected response kind and rejects malformed or private payloads", async () => {
    // This response is valid for taskChecklistPage, so rejection here proves
    // the repository kind guard independently of contract-decoder failure.
    expect(await createWorkspaceRepository(transportFor(checklistResponse())).listPage(pageInput())).toEqual({ ok: false, error: "protocol" });
    expect(await createWorkspaceRepository(transportFor({ ...pageResponse(), data: { evaluatedAt: "bad", items: [], nextCursor: null } })).listPage(pageInput())).toEqual({ ok: false, error: "protocol" });
    const privateResponse = pageResponse() as any;
    privateResponse.data.blockedBy = "información privada";
    const privateResult = await createWorkspaceRepository(transportFor(privateResponse)).listPage(pageInput());
    expect(privateResult).toEqual({ ok: false, error: "protocol" });
    expect(JSON.stringify(privateResult)).not.toContain("información privada");
  });

  it("accepts inline, paged, and review-required checklist states and keeps decimal strings intact", async () => {
    for (const checklistState of ["inline", "paged", "requires_review"] as const) {
      const response = populatedPageResponse(checklistState);
      const result = await createWorkspaceRepository(transportFor(response)).listPage(pageInput());
      expect(result).toEqual({ ok: true, value: response });
      if (result.ok) {
        expect(result.value.data.items[0]?.checklistState).toBe(checklistState);
        expect(result.value.data.items[0]?.weight).toBe("1.2300");
      }
    }
  });

  it("passes transport/server failures through, maps thrown and malformed failures safely", async () => {
    for (const error of ["unauthenticated", "transport", "server", "protocol"] as const) {
      const transport: WorkspaceQueryTransport = { query: vi.fn(async () => ({ ok: false as const, error })) };
      expect(await createWorkspaceRepository(transport).listPage(pageInput())).toEqual({ ok: false, error });
    }
    const throwing: WorkspaceQueryTransport = { query: async () => { throw new Error("secret detail"); } };
    expect(await createWorkspaceRepository(throwing).listPage(pageInput())).toEqual({ ok: false, error: "transport" });
    const malformed = { query: async () => ({ ok: true, value: { secret: "private" } }) } as unknown as WorkspaceQueryTransport;
    expect(await createWorkspaceRepository(malformed).listPage(pageInput())).toEqual({ ok: false, error: "protocol" });
    const falsyResult = { query: async () => null } as unknown as WorkspaceQueryTransport;
    expect(await createWorkspaceRepository(falsyResult).listPage(pageInput())).toEqual({ ok: false, error: "protocol" });
    const nonBooleanOk = { query: async () => ({ ok: "yes", value: pageResponse() }) } as unknown as WorkspaceQueryTransport;
    expect(await createWorkspaceRepository(nonBooleanOk).listPage(pageInput())).toEqual({ ok: false, error: "protocol" });
    const unknownError = { query: async () => ({ ok: false, error: "database password" }) } as unknown as WorkspaceQueryTransport;
    expect(await createWorkspaceRepository(unknownError).listPage(pageInput())).toEqual({ ok: false, error: "protocol" });
  });

  it("keeps empty pages, decimal/revision strings, cursors, and the checklist request exact", async () => {
    const response = checklistResponse();
    const transport = transportFor(response);
    const result = await createWorkspaceRepository(transport).readChecklistPage(checklistInput());
    expect(transport.query).toHaveBeenCalledExactlyOnceWith({ contractVersion: 1, kind: "taskChecklistPage", ...checklistInput() });
    expect(result).toEqual({ ok: true, value: response });
    expect(result.ok && result.value.data.taskRevision).toBe("9223372036854775807");
  });

  it("accepts all defined checklist segment and issue modes without rewriting Unicode", async () => {
    const unicode = "𐐷😀e\u0301".repeat(128); // 512 Unicode code points, 768 UTF-16 code units.
    const cases = [
      checklistResponse([
        item({ textPart: unicode, textLength: 513, textComplete: false }),
        item({ ordinal: 1, textPart: "😀", textOffset: 512, textLength: 513, textComplete: true }),
      ], 1),
      checklistResponse([item({ textPart: "", textLength: 0, textComplete: true, issueCode: "text_empty" })], 1),
      checklistResponse([item({ textPart: "", textLength: 0, textComplete: true, done: null, issueCode: "text_missing" })], 1),
      checklistResponse([item({ textPart: "", textLength: 0, textComplete: true, done: null, issueCode: "text_invalid" })], 1),
      checklistResponse([item({ textPart: "", textLength: 0, textComplete: true, done: null, issueCode: "invalid_type" })], 1),
      checklistResponse([item({ textPart: "x", done: null, issueCode: "done_invalid" })], 1),
    ];
    for (const response of cases) {
      const result = await createWorkspaceRepository(transportFor(response)).readChecklistPage(checklistInput());
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(response);
    }
  });

  it("rejects broken offsets, discontinuous segments, and over-limit cursors", async () => {
    const repoFor = (value: unknown) => createWorkspaceRepository(transportFor(value)).readChecklistPage(checklistInput());
    expect(await repoFor(checklistResponse([item({ textOffset: 1 })], 1, "next"))).toEqual({ ok: false, error: "protocol" });
    expect(await repoFor(checklistResponse([item({ textOffset: 0, textLength: 513, textComplete: false }), item({ ordinal: 1, textOffset: 512 })], 1, "next"))).toEqual({ ok: false, error: "protocol" });
    expect(await repoFor(checklistResponse([], 0, "x".repeat(2049)))).toEqual({ ok: false, error: "protocol" });
  });
});
