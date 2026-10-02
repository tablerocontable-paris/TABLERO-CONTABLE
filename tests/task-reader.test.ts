import { describe, expect, it, vi } from "vitest";
import {
  createTaskReader,
  type TaskReadQuery,
} from "../src/data/remote/task-reader";

const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const alpha = "abcdef01-2345-6789-abcd-ef0123456789";
const ids = [uid(1), uid(2), uid(3)];
const task = (n: number, id = ids[n - 1]!) => ({
  id,
  organization_id: ids[0]!,
  assignment_id: ids[0]!,
  company_id: ids[1]!,
  owner_id: ids[2]!,
  team_id: ids[0]!,
  template_version_id: null,
  period: "2026-10-01",
  scheduled_on: "2026-10-02",
  title: `Task ${n}`,
  kind: "resultado",
  weight: 2,
  unit: null,
  target: null,
  status: "Pendiente",
  due_date: null,
  started_at: null,
  completed_at: null,
  checklist: [{ id: "control", done: true, detail: "retained" }],
  blocked_by: null,
  blocked_since: null,
  state_revision: 0,
  extra: { retained: true },
});
const session = (n: number, id = ids[n - 1]!) => ({
  id,
  organization_id: ids[0]!,
  instance_id: ids[2]!,
  actor_id: ids[1]!,
  started_at: "2026-10-02T10:00:00.123456Z",
  ended_at: null,
  absence_id: null,
  extra: { retained: true },
});
const ok = (data: unknown) => ({ data, error: null });
const pageResult = (rows: unknown[]) =>
  createTaskReader({ read: async () => ok(rows) });

describe("task reader", () => {
  it("builds frozen allowlisted query signatures with defaults and boundary take values", async () => {
    const queries: TaskReadQuery[] = [];
    const reader = createTaskReader({
      read: async (query) => {
        queries.push(query);
        return ok([]);
      },
    });
    expect(await reader.listTasks({ period: "2026-10-01" })).toMatchObject({
      ok: true,
      rows: [],
      hasMore: false,
      nextCursor: null,
    });
    expect(
      await reader.listTasks({ period: "2026-10-01", limit: 100 }),
    ).toMatchObject({ ok: true });
    expect(await reader.findTask({ instanceId: ids[0] })).toEqual({
      ok: true,
      kind: "unavailable",
    });
    const sourceIds = [alpha];
    expect(await reader.listSessions({ instanceIds: sourceIds })).toMatchObject(
      { ok: true, rows: [] },
    );
    const hundredSessionIds = Array.from({ length: 100 }, (_, index) =>
      uid(index + 4),
    );
    expect(
      await reader.listSessions({ instanceIds: hundredSessionIds, limit: 100 }),
    ).toMatchObject({ ok: true, rows: [] });
    expect(queries).toEqual([
      {
        kind: "taskPage",
        table: "task_instances",
        period: "2026-10-01",
        companyId: null,
        ownerId: null,
        teamId: null,
        afterId: null,
        take: 51,
      },
      {
        kind: "taskPage",
        table: "task_instances",
        period: "2026-10-01",
        companyId: null,
        ownerId: null,
        teamId: null,
        afterId: null,
        take: 101,
      },
      {
        kind: "taskById",
        table: "task_instances",
        instanceId: ids[0],
        take: 2,
      },
      {
        kind: "sessionPage",
        table: "task_time_sessions",
        instanceIds: [alpha],
        afterId: null,
        take: 51,
      },
      {
        kind: "sessionPage",
        table: "task_time_sessions",
        instanceIds: hundredSessionIds,
        afterId: null,
        take: 101,
      },
    ]);
    expect(queries.every(Object.isFrozen)).toBe(true);
    expect(
      Object.isFrozen(
        queries[3]!.kind === "sessionPage" ? queries[3]!.instanceIds : [],
      ),
    ).toBe(true);
    expect(
      Object.isFrozen(
        queries[4]!.kind === "sessionPage" ? queries[4]!.instanceIds : [],
      ),
    ).toBe(true);
  });

  it("strictly rejects invalid values before a read", async () => {
    const read = vi.fn(async () => ok([]));
    const reader = createTaskReader({ read });
    for (const input of [
      { period: "2026-10-02" },
      { period: "2026-02-30" },
      { period: "2026-10-01", limit: 0 },
      { period: "2026-10-01", limit: 101 },
      { period: "2026-10-01", limit: 1.5 },
      { period: "2026-10-01", actorId: ids[0] },
      { period: "2026-10-01", companyId: "bad" },
      { period: null },
      { period: "2026-10-01", limit: null },
    ])
      expect(await reader.listTasks(input)).toMatchObject({
        ok: false,
        error: "validation",
      });
    for (const input of [
      {},
      { instanceIds: [] },
      { instanceIds: Array.from({ length: 101 }, (_, i) => uid(i + 1)) },
      { instanceIds: [ids[0], ids[0]] },
      { instanceIds: [ids[0]], table: "profiles" },
      { instanceIds: null },
      { instanceIds: [ids[0]], limit: null },
    ])
      expect(await reader.listSessions(input)).toMatchObject({
        ok: false,
        error: "validation",
      });
    expect(
      await reader.findTask({ instanceId: ids[0], organizationId: ids[0] }),
    ).toMatchObject({ ok: false, error: "validation" });
    expect(await reader.findTask({ instanceId: "not-a-uuid" })).toMatchObject({
      ok: false,
      error: "validation",
    });
    expect(await reader.findTask({ instanceId: null })).toMatchObject({ ok: false, error: "validation" });
    expect(read).not.toHaveBeenCalled();
  });

  it("clones and freezes arrays before yielding, and detects duplicate UUIDs across case", async () => {
    let resolveRead!: (value: { data: unknown; error: unknown | null }) => void;
    const sourceIds = [alpha];
    const read = vi.fn(
      (_query: TaskReadQuery) =>
        new Promise<{ data: unknown; error: unknown | null }>((resolve) => {
          resolveRead = resolve;
        }),
    );
    const pending = createTaskReader({ read }).listSessions({
      instanceIds: sourceIds,
    });
    sourceIds[0] = ids[0]!;
    sourceIds.push(ids[1]!);
    const query = read.mock.calls[0]![0];
    expect(query).toMatchObject({
      table: "task_time_sessions",
      instanceIds: [alpha],
    });
    expect(Object.isFrozen(query)).toBe(true);
    if (query.kind === "sessionPage")
      expect(Object.isFrozen(query.instanceIds)).toBe(true);
    resolveRead(ok([]));
    expect(await pending).toMatchObject({ ok: true, rows: [] });
    expect(
      await createTaskReader({ read: async () => ok([]) }).listSessions({
        instanceIds: [alpha, alpha.toUpperCase()],
      }),
    ).toMatchObject({ ok: false, error: "validation" });
  });

  it("uses UUID textual order/case and never skips a lookahead row", async () => {
    const upper = alpha.toUpperCase();
    const rows = [
      task(1, alpha),
      task(2, "abcdef01-2345-6789-abcd-ef0123456790"),
      task(3, "abcdef01-2345-6789-abcd-ef0123456791"),
    ];
    const read = vi.fn(async (query: TaskReadQuery) => {
      if (query.kind !== "taskPage") return ok([]);
      const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
      return ok(
        sorted
          .filter(
            (row) =>
              query.afterId === null || row.id > query.afterId.toLowerCase(),
          )
          .slice(0, query.take)
          .map((row) => (row.id === alpha ? { ...row, id: upper } : row)),
      );
    });
    const reader = createTaskReader({ read });
    const a = await reader.listTasks({ period: "2026-10-01", limit: 1 });
    expect(a).toMatchObject({
      ok: true,
      rows: [{ id: upper }],
      hasMore: true,
      nextCursor: upper,
    });
    if (!a.ok) throw new Error("Expected first page");
    const b = await reader.listTasks({
      period: "2026-10-01",
      limit: 1,
      afterId: a.nextCursor,
    });
    expect(b).toMatchObject({
      ok: true,
      rows: [{ id: rows[1]!.id }],
      hasMore: true,
      nextCursor: rows[1]!.id,
    });
    if (!b.ok) throw new Error("Expected second page");
    expect(
      await reader.listTasks({
        period: "2026-10-01",
        limit: 1,
        afterId: b.nextCursor,
      }),
    ).toMatchObject({
      ok: true,
      rows: [{ id: rows[2]!.id }],
      hasMore: false,
      nextCursor: null,
    });
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("compares filter and find IDs case-insensitively while preserving received UUID text", async () => {
    const company = alpha;
    const instance = task(1, alpha);
    const queryLog: TaskReadQuery[] = [];
    const reader = createTaskReader({
      read: async (query) => {
        queryLog.push(query);
        if (query.kind === "taskById") return ok([instance]);
        return ok([{ ...instance, company_id: company }]);
      },
    });
    expect(
      await reader.listTasks({
        period: "2026-10-01",
        companyId: company.toUpperCase(),
      }),
    ).toMatchObject({ ok: true, rows: [{ company_id: company }] });
    expect(queryLog[0]).toMatchObject({ companyId: company.toUpperCase() });
    expect(
      await reader.findTask({ instanceId: alpha.toUpperCase() }),
    ).toMatchObject({ ok: true, kind: "found", row: { id: alpha } });
    expect(queryLog[1]).toMatchObject({ instanceId: alpha.toUpperCase() });
  });

  it("rejects malformed pages including lookahead, excess, order, cursor, filters and sessions", async () => {
    const badPages = [
      [task(1), task(1)],
      [task(2), task(1)],
      [task(1), task(2), task(3)],
      [task(1), { ...task(2), owner_id: ids[0] }],
      [task(1), { ...task(2), period: "2026-09-01" }],
      [task(1), { ...task(2), company_id: ids[0] }],
      [task(1), { ...task(2), team_id: ids[1] }],
    ];
    for (const rows of badPages)
      expect(
        await pageResult(rows).listTasks({
          period: "2026-10-01",
          companyId: ids[1],
          ownerId: ids[2],
          teamId: ids[0],
          limit: 1,
        }),
      ).toMatchObject({ ok: false, error: "protocol" });
    expect(
      await pageResult([task(1, alpha)]).listTasks({
        period: "2026-10-01",
        afterId: alpha.toUpperCase(),
      }),
    ).toMatchObject({ ok: false, error: "protocol" });
    const incomplete = { ...task(2) } as Record<string, unknown>;
    delete incomplete.started_at;
    expect(
      await pageResult([task(1), incomplete]).listTasks({
        period: "2026-10-01",
        limit: 1,
      }),
    ).toMatchObject({ ok: false, error: "protocol" });
    expect(
      await pageResult([
        session(1, alpha),
        session(2, alpha.toUpperCase()),
      ]).listSessions({ instanceIds: [ids[2]] }),
    ).toMatchObject({ ok: false, error: "protocol" });
    expect(
      await pageResult([session(1)]).listSessions({
        instanceIds: [ids[2]],
        afterId: ids[0],
      }),
    ).toMatchObject({ ok: false, error: "protocol" });
  });

  it("preserves full rows, task availability semantics and catches wrong/excess task reads", async () => {
    const metadata = {
      ...task(1),
      due_date: null,
      template_version_id: null,
      checklist: [{ id: "x", done: false, detail: "preserve" }],
      started_at: "2026-10-02T10:00:00.123456Z",
    };
    expect(
      await createTaskReader({ read: async () => ok([metadata]) }).findTask({
        instanceId: ids[0],
      }),
    ).toMatchObject({ ok: true, kind: "found", row: metadata });
    for (const data of [
      [{ ...task(1), id: ids[1] }],
      [task(1), task(2)],
      [{ ...task(1), state_revision: -1 }],
    ])
      expect(
        await createTaskReader({ read: async () => ok(data) }).findTask({
          instanceId: ids[0],
        }),
      ).toMatchObject({ ok: false, error: "protocol" });
    expect(
      await createTaskReader({ read: async () => ok([]) }).findTask({
        instanceId: ids[0],
      }),
    ).toEqual({ ok: true, kind: "unavailable" });
    const incomplete = { ...task(1) } as Record<string, unknown>;
    delete incomplete.state_revision;
    expect(await createTaskReader({ read: async () => ok([incomplete]) }).findTask({ instanceId: ids[0] })).toMatchObject({ ok: false, error: "protocol" });
  });

  it("validates null inputs and fully pages bounded sessions with metadata and precise timestamps", async () => {
    const read = vi.fn(async () => ok([]));
    const reader = createTaskReader({ read });
    expect(await reader.listTasks(null)).toMatchObject({ ok: false, error: "validation" });
    expect(await reader.findTask(null)).toMatchObject({ ok: false, error: "validation" });
    expect(await reader.listSessions(null)).toMatchObject({ ok: false, error: "validation" });
    expect(await reader.findTask({})).toMatchObject({ ok: false, error: "validation" });
    expect(read).not.toHaveBeenCalled();

    const rows = [1, 2, 3].map((n) => ({
      ...session(n), id: uid(20 + n), actor_id: ids[2], instance_id: ids[1],
      started_at: `2026-10-02T10:00:0${n}.123456Z`,
      ended_at: `2026-10-02T10:01:0${n}.654321Z`, metadata: { trace: `session-${n}` },
    }));
    const paged = createTaskReader({ read: async (query) => {
      if (query.kind !== "sessionPage") return ok([]);
      const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
      return ok(sorted.filter((row) => query.afterId === null || row.id > query.afterId).slice(0, query.take));
    }});
    const traversed: unknown[] = [];
    let afterId: string | null = null;
    for (let pageNo = 0; pageNo < 3; pageNo += 1) {
      const page = await paged.listSessions({ instanceIds: [ids[1]], limit: 1, afterId });
      expect(page).toMatchObject({ ok: true, hasMore: pageNo < 2 });
      if (!page.ok) throw new Error("Expected session page");
      traversed.push(...page.rows);
      afterId = page.nextCursor;
    }
    expect(traversed).toEqual([...rows].sort((a, b) => a.id.localeCompare(b.id)));
    expect(JSON.stringify(traversed)).toContain('"trace":"session-1"');
    expect(JSON.stringify(traversed[0])).toContain(".123456");
    expect(JSON.stringify(traversed[0])).toContain(".654321");
    expect(await createTaskReader({ read: async () => ok([{ ...rows[0], instance_id: ids[0] }]) }).listSessions({ instanceIds: [ids[1]] })).toMatchObject({ ok: false, error: "protocol" });
    expect(await createTaskReader({ read: async () => ok([rows[0], { ...rows[1], actor_id: undefined }]) }).listSessions({ instanceIds: [ids[1]], limit: 1 })).toMatchObject({ ok: false, error: "protocol" });
  });

  it("classifies envelope, server and transport failures once for each method", async () => {
    for (const method of ["listTasks", "findTask", "listSessions"] as const) {
      const input =
        method === "listTasks"
          ? { period: "2026-10-01" }
          : method === "findTask"
            ? { instanceId: ids[0] }
            : { instanceIds: [ids[2]] };
      for (const [response, category] of [
        [{ nope: true }, "protocol"],
        [{ data: [], error: undefined }, "protocol"],
        [{ data: null, error: { secret: "hidden" } }, "server"],
        [{ data: null, error: null }, "protocol"],
        [new Error("private detail"), "transport"],
      ] as const) {
        const read = vi.fn(async () => {
          if (response instanceof Error) throw response;
          return response as never;
        });
        const result = await createTaskReader({ read })[method](input as never);
        expect(result).toMatchObject({
          ok: false,
          error: category,
          message: `Task read ${category} error`,
        });
        expect(JSON.stringify(result)).not.toContain("private detail");
        expect(JSON.stringify(result)).not.toContain("hidden");
        expect(read).toHaveBeenCalledOnce();
      }
    }
  });
});
