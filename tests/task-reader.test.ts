import { describe, expect, it, vi } from "vitest";
import { createTaskReader, type TaskReadQuery } from "../src/data/remote/task-reader";

const ids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"];
const task = (n: number) => ({
  id: ids[n - 1], organization_id: ids[0], assignment_id: ids[0], company_id: ids[1], owner_id: ids[2], team_id: ids[0], template_version_id: null,
  period: "2026-10-01", scheduled_on: "2026-10-02", title: `Task ${n}`, kind: "resultado", weight: 2, unit: null, target: null,
  status: "Pendiente", due_date: null, started_at: null, completed_at: null, checklist: [], blocked_by: null, blocked_since: null, state_revision: 0, extra: { retained: true },
});
const session = (n: number) => ({ id: ids[n - 1], organization_id: ids[0], instance_id: ids[2], actor_id: ids[1], started_at: "2026-10-02T10:00:00Z", ended_at: null, absence_id: null });
const ok = (data: unknown) => ({ data, error: null });

describe("task reader", () => {
  it("paginates by id with lookahead, retaining complete row data and a non-skipping cursor", async () => {
    const read = vi.fn(async (_q: TaskReadQuery) => ok([task(1), task(2)]));
    const result = await createTaskReader({ read }).listTasks({ period: "2026-10-01", limit: 1 });
    expect(result).toMatchObject({ ok: true, rows: [task(1)], hasMore: true, nextCursor: ids[0] });
    expect(read).toHaveBeenCalledOnce();
    expect(read.mock.calls[0][0]).toMatchObject({ kind: "taskPage", take: 2, afterId: null });
    expect(Object.isFrozen(read.mock.calls[0][0])).toBe(true);
  });

  it("rejects invalid strict inputs before transport and preserves UUID semantics across case", async () => {
    const read = vi.fn(async () => ok([]));
    const reader = createTaskReader({ read });
    expect(await reader.listTasks({ period: "2026-10-01", arbitrarySql: "select" })).toMatchObject({ ok: false, error: "validation" });
    expect(await reader.listSessions({ instanceIds: [ids[0], ids[0].toUpperCase()] })).toMatchObject({ ok: false, error: "validation" });
    expect(read).not.toHaveBeenCalled();
    const result = await reader.listTasks({ period: "2026-10-01", companyId: ids[1].toUpperCase() });
    expect(result).toMatchObject({ ok: true, rows: [] });
  });

  it("validates every lookahead row and rejects duplicates, disorder, or filter escape", async () => {
    for (const rows of [[task(1), task(1)], [task(2), task(1)], [task(1), { ...task(2), owner_id: ids[0] }]]) {
      const result = await createTaskReader({ read: async () => ok(rows) }).listTasks({ period: "2026-10-01", limit: 1, ownerId: ids[2] });
      expect(result).toMatchObject({ ok: false, error: "protocol" });
    }
    const incomplete = { ...task(2) } as Record<string, unknown>;
    delete incomplete.started_at;
    expect(await createTaskReader({ read: async () => ok([task(1), incomplete]) }).listTasks({ period: "2026-10-01", limit: 1 })).toMatchObject({ ok: false, error: "protocol" });
  });

  it("finds or reports unavailable without leaking distinctions and reads only listed sessions", async () => {
    const reader = createTaskReader({ read: async (q) => q.kind === "taskById" ? ok([task(1)]) : ok([session(1)]) });
    expect(await reader.findTask({ instanceId: ids[0] })).toMatchObject({ ok: true, kind: "found", row: { extra: { retained: true } } });
    expect(await createTaskReader({ read: async () => ok([]) }).findTask({ instanceId: ids[0] })).toEqual({ ok: true, kind: "unavailable" });
    expect(await reader.listSessions({ instanceIds: [ids[2]] })).toMatchObject({ ok: true, rows: [session(1)], hasMore: false, nextCursor: null });
    expect(await createTaskReader({ read: async () => ok([{ ...session(2), instance_id: ids[1] }]) }).listSessions({ instanceIds: [ids[2]] })).toMatchObject({ ok: false, error: "protocol" });
  });

  it("classifies server, transport, and envelope failures with one call", async () => {
    const server = vi.fn(async () => ({ data: null, error: { secret: "hidden" } }));
    expect(await createTaskReader({ read: server }).listTasks({ period: "2026-10-01" })).toMatchObject({ error: "server" });
    const transport = vi.fn(async () => { throw new Error("private detail"); });
    expect(await createTaskReader({ read: transport }).listTasks({ period: "2026-10-01" })).toMatchObject({ error: "transport", message: "Task read transport error" });
    expect(transport).toHaveBeenCalledOnce();
    expect(await createTaskReader({ read: async () => ({ nope: true }) as never }).listTasks({ period: "2026-10-01" })).toMatchObject({ error: "protocol" });
  });
});
