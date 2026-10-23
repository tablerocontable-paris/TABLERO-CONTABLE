// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MyWork, { mergeChecklistPage } from "../src/components/MyWork";
import type { WorkspaceQueryTransport } from "../src/data/supabase/workspace-repository";
import type { QueryResponseV1 } from "../src/data/supabase/operational-contract";
import type { TaskChecklistPageResponse } from "../src/data/supabase/workspace-repository";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const task = (state: "inline" | "paged" | "requires_review" = "inline", title = "Cierre") => ({
  taskId: id(1), taskRevision: "9223372036854775807", ownerId: id(3), ownerDisplayName: "Ana", teamId: id(4), teamName: "Equipo Norte", companyId: id(5), companyName: "Empresa Sur", period: "2026-10-01", scheduledOn: "2026-10-12", title, status: "En curso", dueDate: "2026-10-25", priority: "Alta", ready: false, blockerCodes: ["external_wait"], hasHiddenDependencies: false, kind: "resultado", measurementVersion: 1, weight: "1.0000", target: null, unit: null, checklistState: state, checklistControlCount: state === "paged" || state === "inline" ? 2 : 1, checklist: state === "inline" ? [{ id: id(6), text: "Revisar documentación", done: false }, { id: id(6), text: "Segundo control", done: true }] : [], subjectWork: { recordedSeconds: "3600" },
});
const workspace = (...items: ReturnType<typeof task>[]) => ({ contractVersion: 1, kind: "workspacePageV2", data: { evaluatedAt: "2026-10-23T12:00:00.000Z", items, nextCursor: null } });
const row = (overrides = {}) => ({ id: id(8), ordinal: 1, textPart: "Control válido ✅", textOffset: 0, textLength: 15, textComplete: true, done: true, issueCode: null, ...overrides });
const checklist = (items: unknown[], totalControls: number, nextCursor: string | null) => ({ contractVersion: 1, kind: "taskChecklistPage", data: { evaluatedAt: "2026-10-23T12:00:00.000Z", taskId: id(1), taskRevision: "9223372036854775807", totalControls, items, nextCursor } });
const checklistData = (overrides: Partial<TaskChecklistPageResponse["data"]> = {}) => ({ evaluatedAt: "2026-10-23T12:00:00.000Z", taskId: id(1), taskRevision: "9223372036854775807", totalControls: 1, items: [], nextCursor: null, ...overrides }) as TaskChecklistPageResponse["data"];
const fragment = (overrides: Partial<TaskChecklistPageResponse["data"]["items"][number]> = {}) => ({ id: id(8), ordinal: 1, textPart: "x", textOffset: 0, textLength: 1, textComplete: true, done: false, issueCode: null, ...overrides }) as TaskChecklistPageResponse["data"]["items"][number];
const transport = (fn: (input: any) => unknown): WorkspaceQueryTransport => ({ query: vi.fn(async (input) => ({ ok: true as const, value: fn(input) as QueryResponseV1 })) });

describe("Mi trabajo", () => {
  afterEach(cleanup);
  it("queries only the authenticated actor (null subject), renders work fields and inline checklist, and exposes no writes", async () => {
    const call = vi.fn((input) => workspace(task())); const remote = transport(call);
    const view = render(<MyWork transport={remote} />);
    expect(await screen.findByText("Cierre")).toBeTruthy();
    expect(call.mock.calls[0]![0]).toMatchObject({ kind: "workspacePageV2", filters: { subjectId: null, companyId: null, teamId: null, sector: null } });
    expect(document.body.textContent).toContain("Empresa Sur"); expect(document.body.textContent).toContain("Equipo Norte"); expect(document.body.textContent).toContain("espera externa");
    fireEvent.click(screen.getByRole("button", { name: "Ver controles" }));
    expect(await screen.findByText("Revisar documentación")).toBeTruthy(); expect(await screen.findByText("Segundo control")).toBeTruthy();
    expect(view.container.querySelectorAll("input,textarea")).toHaveLength(1);
    expect(view.container.querySelectorAll("button").length).toBe(1);
  });

  it("shows empty state and loads additional list pages without changing actor", async () => {
    const call = vi.fn().mockImplementationOnce(() => ({ contractVersion: 1, kind: "workspacePageV2", data: { evaluatedAt: "2026-10-23T12:00:00.000Z", items: [], nextCursor: null } }));
    render(<MyWork transport={transport(call)} />);
    expect(await screen.findByText("No hay tareas para este período")).toBeTruthy();
    expect(call.mock.calls[0]![0].filters.subjectId).toBeNull();
  });

  it("paginates task rows with the server cursor and keeps query scope fixed", async () => {
    const first = { contractVersion: 1, kind: "workspacePageV2", data: { evaluatedAt: "2026-10-23T12:00:00.000Z", items: [task("inline", "Primera tarea")], nextCursor: "listnext" } };
    const secondTask = { ...task("inline", "Segunda tarea"), taskId: id(2) };
    const call = vi.fn().mockResolvedValueOnce({ ok: true, value: first }).mockResolvedValueOnce({ ok: true, value: workspace(secondTask) });
    render(<MyWork transport={{ query: call }} />);
    expect(await screen.findByText("Primera tarea")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cargar más tareas" }));
    expect(await screen.findByText("Segunda tarea")).toBeTruthy();
    expect(call.mock.calls[1]![0]).toMatchObject({ kind: "workspacePageV2", cursor: "listnext", filters: { subjectId: null, companyId: null, teamId: null, sector: null } });
  });

  it("ignores a delayed response from the previous period", async () => {
    type Result = Awaited<ReturnType<WorkspaceQueryTransport["query"]>>;
    const pending: Array<{ period: string; resolve: (value: Result) => void }> = [];
    const remote: WorkspaceQueryTransport = { query: (input: unknown) => new Promise((resolve) => pending.push({ period: (input as any).filters.period, resolve })) };
    render(<MyWork transport={remote} />);
    await waitFor(() => expect(pending).toHaveLength(1));
    const firstPeriod = pending[0]!.period;
    fireEvent.change(screen.getByLabelText(/Período/), { target: { value: firstPeriod.slice(0, 7) === "2026-10" ? "2026-11" : "2026-10" } });
    await waitFor(() => expect(pending).toHaveLength(2));
    const newer = pending[1]!;
    await act(async () => newer.resolve({ ok: true, value: workspace(task("inline", "Tarea del período nuevo")) as QueryResponseV1 }));
    expect(await screen.findByText("Tarea del período nuevo")).toBeTruthy();
    await act(async () => pending[0]!.resolve({ ok: true, value: workspace(task("inline", "Tarea antigua")) as QueryResponseV1 }));
    expect(screen.queryByText("Tarea antigua")).toBeNull();
  });

  it("loads checklist pages inline in the card, preserves Unicode and review states", async () => {
    const calls: any[] = [];
    const remote = transport((input) => { calls.push(input); if (input.kind === "workspacePageV2") return workspace(task("paged")); if (input.cursor === null) return checklist([row({ textPart: "漢字 ✅", textLength: 4 })], 2, "opaque-next"); return checklist([row({ ordinal: 2, textPart: "Revisar", textLength: 7 })], 2, null); });
    render(<MyWork transport={remote} />); await screen.findByText("Cierre"); fireEvent.click(screen.getByRole("button", { name: "Ver controles" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cargar más controles" })).toBeTruthy());
    expect(screen.queryByText("漢字 ✅")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cargar más controles" })); expect(await screen.findByText("漢字 ✅")).toBeTruthy(); expect(await screen.findByText("Revisar")).toBeTruthy();
    expect(calls.filter((call) => call.kind === "taskChecklistPage").map((call) => call.filters)).toEqual([expect.objectContaining({ subjectId: null, taskRevision: "9223372036854775807" }), expect.objectContaining({ subjectId: null, taskRevision: "9223372036854775807" })]);
    expect(calls[2].cursor).toBe("opaque-next");
  });

  it("keeps review-required checklist closed and reports query errors with retry", async () => {
    render(<MyWork transport={transport(() => workspace(task("requires_review")))} />);
    await screen.findByText("Cierre"); fireEvent.click(screen.getByRole("button", { name: "Ver controles" })); expect(screen.getByText(/requieren revisión/)).toBeTruthy();
    const flaky = vi.fn().mockResolvedValueOnce({ ok: false, error: "transport" }).mockResolvedValueOnce({ ok: true, value: workspace(task()) });
    render(<MyWork transport={{ query: flaky }} />);
    expect(await screen.findByRole("alert")).toBeTruthy(); fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getAllByText("Cierre").length).toBeGreaterThan(0));
  });

  it("clears partial checklist rows and refreshes task revisions after server/protocol errors", async () => {
    const calls: any[] = [];
    const remote: WorkspaceQueryTransport = { query: async (input: unknown): Promise<Awaited<ReturnType<WorkspaceQueryTransport["query"]>>> => {
      const request = input as { kind: string };
      calls.push(input);
      if (request.kind === "workspacePageV2") return { ok: true, value: workspace(task("paged")) as QueryResponseV1 };
      return { ok: false, error: "server" };
    } };
    render(<MyWork transport={remote} />); await screen.findByText("Cierre");
    fireEvent.click(screen.getByRole("button", { name: "Ver controles" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Control válido ✅")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar lista de tareas" }));
    await waitFor(() => expect(calls.filter((call) => call.kind === "workspacePageV2")).toHaveLength(2));
    expect(calls.filter((call) => call.kind === "workspacePageV2")[1]).toMatchObject({ kind: "workspacePageV2", cursor: null, filters: { subjectId: null } });
  });

  it("clears previously loaded cards and invalidates checklist reads after list-page denial", async () => {
    let resolveDetail: ((value: any) => void) | undefined;
    const calls: any[] = [];
    const remote: WorkspaceQueryTransport = { query: async (input: unknown): Promise<Awaited<ReturnType<WorkspaceQueryTransport["query"]>>> => {
      const request = input as any; calls.push(request);
      if (request.kind === "workspacePageV2" && request.cursor === null) return { ok: true, value: { ...workspace(task("paged")), data: { ...workspace(task("paged")).data, nextCursor: "listnext" } } as QueryResponseV1 };
      if (request.kind === "workspacePageV2") return { ok: false, error: "unauthenticated" };
      if (request.cursor === null) return { ok: true, value: checklist([row({ textPart: "x".repeat(512), textLength: 513, textComplete: false })], 1, "detailnext") as QueryResponseV1 };
      return new Promise((resolve) => { resolveDetail = resolve; });
    } };
    render(<MyWork transport={remote} />); expect(await screen.findByText("Cierre")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver controles" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cargar más controles" }));
    await waitFor(() => expect(resolveDetail).toBeTypeOf("function"));
    expect(calls.some((call) => call.kind === "taskChecklistPage" && call.cursor === "detailnext")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cargar más tareas" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Cierre")).toBeNull();
    await act(async () => resolveDetail?.({ ok: true, value: checklist([row({ textPart: "y", textOffset: 512, textLength: 513 })], 1, null) }));
    expect(screen.queryByText("Cierre")).toBeNull();
    expect(screen.queryByText("y")).toBeNull();
  });

  it("renders controls with repeated ids using stable ordinal keys", async () => {
    const remote = transport((input) => input.kind === "workspacePageV2" ? workspace(task("paged")) : checklist([row({ ordinal: 1, textPart: "Primero", textLength: 7 }), row({ ordinal: 2, textPart: "Segundo", textLength: 7 })], 2, null));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<MyWork transport={remote} />); await screen.findByText("Cierre");
    fireEvent.click(screen.getByRole("button", { name: "Ver controles" }));
    expect(await screen.findByText("Primero")).toBeTruthy(); expect(screen.getByText("Segundo")).toBeTruthy();
    expect(errors.mock.calls.flat().join(" ")).not.toContain("same key"); errors.mockRestore();
  });
  it("reconstructs long Unicode controls across pages by code point and keeps combining marks intact", () => {
    const text = `${"A".repeat(511)}e\u0301😀`;
    const points = Array.from(text);
    const first = mergeChecklistPage(undefined, checklistData({ items: [fragment({ textPart: points.slice(0, 512).join(""), textLength: points.length, textComplete: false })], nextCursor: "c1" }), { taskId: id(1), taskRevision: "9223372036854775807" });
    expect(first.complete).toBe(false); expect(first.controls).toEqual([]);
    const complete = mergeChecklistPage(first, checklistData({ items: [fragment({ textPart: points.slice(512).join(""), textOffset: 512, textLength: points.length, textComplete: true })] }), { taskId: id(1), taskRevision: "9223372036854775807" });
    expect(complete.complete).toBe(true); expect(complete.controls[0]?.text).toBe(text);
    expect(complete.controls[0]?.text.includes("e\u0301")).toBe(true); expect(Array.from(complete.controls[0]!.text)).toHaveLength(514);
  });

  it("deduplicates only exact ordinal/offset repeats and rejects missing, skipped, or incomplete terminal coverage", () => {
    const firstPart = fragment({ textPart: "x".repeat(512), textLength: 513, textComplete: false });
    const first = mergeChecklistPage(undefined, checklistData({ items: [firstPart], nextCursor: "c1" }), { taskId: id(1), taskRevision: "9223372036854775807" });
    const duplicateAndTail = mergeChecklistPage(first, checklistData({ items: [firstPart, fragment({ textPart: "y", textOffset: 512, textLength: 513 })] }), { taskId: id(1), taskRevision: "9223372036854775807" });
    expect(duplicateAndTail.controls[0]?.text).toBe(`${"x".repeat(512)}y`);
    expect(() => mergeChecklistPage(undefined, checklistData({ totalControls: 2, items: [fragment({ ordinal: 2 })], nextCursor: null }), { taskId: id(1), taskRevision: "9223372036854775807" })).toThrow();
    expect(() => mergeChecklistPage(undefined, checklistData({ totalControls: 2, items: [fragment()], nextCursor: null }), { taskId: id(1), taskRevision: "9223372036854775807" })).toThrow();
    expect(() => mergeChecklistPage(undefined, checklistData({ items: [fragment({ textComplete: false })], nextCursor: null }), { taskId: id(1), taskRevision: "9223372036854775807" })).toThrow();
    expect(() => mergeChecklistPage(first, checklistData({ items: [fragment({ textPart: "z", textLength: 513 }), fragment({ textPart: "y", textOffset: 512, textLength: 513 })] }), { taskId: id(1), taskRevision: "9223372036854775807" })).toThrow();
    expect(() => mergeChecklistPage(first, checklistData({ items: [fragment({ textPart: "y", textOffset: 513, textLength: 513 })] }), { taskId: id(1), taskRevision: "9223372036854775807" })).toThrow();
    expect(() => mergeChecklistPage(first, checklistData({ items: [fragment({ textPart: "z", textOffset: 0, textLength: 513, textComplete: false })], nextCursor: "c2" }), { taskId: id(1), taskRevision: "9223372036854775807" })).toThrow();
  });

  it.each([
    ["taskId", id(2)], ["taskRevision", "new-revision"], ["totalControls", 2],
  ])("rejects changed %s between detail pages", (field, value) => {
    const first = mergeChecklistPage(undefined, checklistData({ items: [fragment({ textPart: "x".repeat(512), textLength: 513, textComplete: false })], nextCursor: "c1" }), { taskId: id(1), taskRevision: "9223372036854775807" });
    const changed = checklistData({ items: [fragment({ textPart: "y", textOffset: 512, textLength: 513 })], [field]: value } as Partial<TaskChecklistPageResponse["data"]>);
    expect(() => mergeChecklistPage(first, changed, { taskId: id(1), taskRevision: "9223372036854775807" })).toThrow();
  });

  it.each(["id", "done", "issueCode", "textLength"] as const)("rejects changed per-control %s across text segments", (attribute) => {
    const first = mergeChecklistPage(undefined, checklistData({ items: [fragment({ textPart: "x".repeat(512), textLength: 513, textComplete: false })], nextCursor: "c1" }), { taskId: id(1), taskRevision: "9223372036854775807" });
    const changes = { id: id(9), done: true, issueCode: "done_invalid" as const, textLength: 514 };
    const changedFragment = fragment({ textPart: "y", textOffset: 512, textLength: 513, [attribute]: changes[attribute] } as Partial<TaskChecklistPageResponse["data"]["items"][number]>);
    expect(() => mergeChecklistPage(first, checklistData({ items: [changedFragment] }), { taskId: id(1), taskRevision: "9223372036854775807" })).toThrow();
  });
});
