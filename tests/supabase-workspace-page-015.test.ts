import { describe, expect, it } from "vitest";
import { AccountingLab, ids, stages } from "./helpers/accounting-lab";

const filters = (subjectId: string | null, period: string, companyId: string | null = null, teamId: string | null = null, sector: string | null = null) => ({ subjectId, period, companyId, teamId, sector });

describe("Supabase workspacePage migration 015", () => {
  it("adds the page while preserving the SQL014 query delegate and returns actor-attributed exact data", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      const task = await lab.task({ checklist: [{ id: ids.peer, text: "Control", done: true }] });
      const sessionEnd = Date.now() - 30 * 60_000;
      const sessionStart = sessionEnd - 30 * 60_000;
      await lab.session(task, ids.owner, null, new Date(sessionStart).toISOString(), new Date(sessionEnd).toISOString());
      await lab.actor(ids.owner, "aal1", "authenticated");
      let page: any;
      try { page = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "workspacePage", filters: filters(null, lab.period), cursor: null, limit: 20 })]); } catch (error) { throw new Error(`workspace page RPC failed: ${String(error)}`); }
      expect(page.result.kind).toBe("workspacePage");
      expect(page.result.contractVersion).toBe(1);
      expect(page.result.data.items).toHaveLength(1);
      expect(page.result.data.items[0]).toMatchObject({ taskId: task, ownerId: ids.owner, kind: "resultado", measurementVersion: 1, checklist: [{ id: ids.peer, text: "Control", done: true }], subjectWork: { recordedSeconds: "1800" } });
      expect(JSON.stringify(page.result)).not.toMatch(/blocked_by|blockedBy|visibleDependencies|reference|currentRate|notes/i);

      const legacyQuery = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "readiness", filters: { taskId: task }, cursor: null, limit: 1 })]);
      expect(legacyQuery.result.kind).toBe("readiness");
    } finally {
      await lab.db.close();
    }
  }, 30_000);

  it("rejects a third-party subject outside the actor's current owner scope", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      await lab.task();
      await lab.actor(ids.owner, "aal1", "authenticated");
      await expect(lab.first("select api.query_v1($1::jsonb)", [JSON.stringify({ contractVersion: 1, kind: "workspacePage", filters: filters(ids.peer, lab.period), cursor: null, limit: 20 })])).rejects.toThrow();
    } finally {
      await lab.db.close();
    }
  }, 30_000);

  it("requires a current managed team and subject membership for an encargado's third-party page", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      await lab.task({ owner: ids.owner });
      await lab.actor(ids.manager, "aal2", "authenticated");
      const request = { contractVersion: 1, kind: "workspacePage", filters: filters(ids.owner, lab.period, ids.company, ids.team), cursor: null, limit: 20 };
      const page = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify(request)]);
      expect(page.result.data.items).toHaveLength(1);
      await lab.admin();
      await lab.db.query("update profiles set manager_id=$1 where id=$2", [ids.boss, ids.owner]);
      await lab.actor(ids.manager, "aal2", "authenticated");
      await expect(lab.first("select api.query_v1($1::jsonb)", [JSON.stringify(request)])).rejects.toThrow();
    } finally {
      await lab.db.close();
    }
  }, 30_000);

  it("allows an encargado to query their own task without a supervisor relation to themselves", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      await lab.task({ owner: ids.manager });
      await lab.actor(ids.manager, "aal2", "authenticated");
      const page = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "workspacePage", filters: filters(null, lab.period), cursor: null, limit: 20 })]);
      expect(page.result.data.items).toHaveLength(1);
      expect(page.result.data.items[0].ownerId).toBe(ids.manager);
    } finally {
      await lab.db.close();
    }
  }, 30_000);

  it("selects only a bounded page before returning data from a 2,000-task organization", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      await lab.admin();
      await lab.db.exec(`
        with assignments as (
          insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day,checklist)
          select gen_random_uuid(), '${ids.org}'::uuid, '${ids.company}'::uuid, '${ids.owner}'::uuid, '${ids.team}'::uuid,
            'Task '||g, 'resultado', 5, 'mensual', '${lab.period}'::date, 15, '[]'::jsonb from generate_series(1,2000) g
          returning id,organization_id,company_id,owner_id,team_id,title,kind,weight
        )
        insert into task_instances(organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,checklist)
        select organization_id,id,company_id,owner_id,team_id,'${lab.period}'::date,'${lab.period}'::date,title,kind,weight,null,'[]'::jsonb from assignments
      `);
      await lab.actor(ids.owner, "aal1", "authenticated");
      const startedAt = Date.now();
      const page = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "workspacePage", filters: filters(null, lab.period), cursor: null, limit: 100 })]);
      const elapsedMs = Date.now() - startedAt;
      const responseBytes = new TextEncoder().encode(JSON.stringify(page.result)).byteLength;
      expect(page.result.data.items).toHaveLength(100);
      expect(page.result.data.nextCursor).toEqual(expect.any(String));
      expect(responseBytes).toBeLessThan(250_000);
      expect(elapsedMs).toBeLessThan(30_000);
      console.info(`workspacePage 2k smoke: ${elapsedMs} ms, ${responseBytes} response bytes`);
      await lab.admin();
      const plan = await lab.first(`explain (analyze, buffers, format json)
        select t.id from public.task_instances t
        where t.organization_id=$1 and t.period=$2 and public.can_access_instance(t.id)
          and (t.owner_id=$3 or exists(select 1 from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id where h.instance_id=t.id and m.profile_id=$3)
            or exists(select 1 from public.activity_entries e where e.instance_id=t.id and e.actor_id=$3)
            or exists(select 1 from public.task_time_sessions s where s.instance_id=t.id and s.actor_id=$3))
        order by t.due_date asc nulls last,t.scheduled_on asc nulls last,t.id asc limit 101`, [ids.org, lab.period, ids.owner]);
      const planDoc = (plan["QUERY PLAN"] as Array<Record<string, unknown>>)[0];
      expect(planDoc["Execution Time"]).toEqual(expect.any(Number));
      const planSummary = {
        topNode: (planDoc.Plan as Record<string, unknown>)["Node Type"],
        actualRows: (planDoc.Plan as Record<string, unknown>)["Actual Rows"],
        executionTimeMs: planDoc["Execution Time"],
        sharedHitBlocks: (planDoc.Plan as Record<string, unknown>)["Shared Hit Blocks"],
      };
      console.info(`workspacePage 2k selection EXPLAIN ANALYZE BUFFERS: ${JSON.stringify(planSummary)}`);
    } finally {
      await lab.db.close();
    }
  }, 60_000);
});
