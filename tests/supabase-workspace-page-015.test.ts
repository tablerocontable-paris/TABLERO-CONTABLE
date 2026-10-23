import { describe, expect, it } from "vitest";
import { AccountingLab, ids, stages } from "./helpers/accounting-lab";
import { decodeQueryResponseV1, decodeQueryV1 } from "../src/data/supabase/operational-contract";

const filters = (subjectId: string | null, period: string, companyId: string | null = null, teamId: string | null = null, sector: string | null = null) => ({ subjectId, period, companyId, teamId, sector });

describe("Supabase workspacePage migration 015", () => {
  it("bounds and decodes a maximum escaped checklist envelope", () => {
    const response = {
      contractVersion: 1,
      kind: "taskChecklistPage",
      data: {
        evaluatedAt: "2026-10-23T12:00:00.000Z",
        taskId: ids.owner,
        taskRevision: "9223372036854775807",
        totalControls: 1,
        items: Array.from({ length: 16 }, (_, index) => ({ id: ids.peer, ordinal: 1, textPart: "\u0001".repeat(512), textOffset: index * 512, textLength: 10_000, textComplete: false, done: false, issueCode: null })),
        nextCursor: "A".repeat(2000),
      },
    };
    const bytes = new TextEncoder().encode(JSON.stringify(response)).byteLength;
    expect(bytes).toBeLessThanOrEqual(65_536);
    expect(decodeQueryResponseV1(response).ok).toBe(true);
    expect(decodeQueryResponseV1({ ...response, data: { ...response.data, nextCursor: "A".repeat(2001) } }).ok).toBe(false);
    console.info(`Maximum contract-shaped escaped checklist envelope: ${bytes} bytes; below the 65,536-byte budget by construction.`);
  });

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
      expect(decodeQueryResponseV1(page.result).ok).toBe(true);
      expect(JSON.stringify(page.result)).not.toMatch(/blocked_by|blockedBy|visibleDependencies|reference|currentRate|notes/i);

      const legacyQuery = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "readiness", filters: { taskId: task }, cursor: null, limit: 1 })]);
      expect(legacyQuery.result.kind).toBe("readiness");
    } finally {
      await lab.db.close();
    }
  }, 30_000);

  it("keeps task-bound coverage eligible when the occurrence date is outside the coverage interval", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      const task = await lab.task();
      const plan = lab.next(), binding = lab.next();
      const outsideDay = `${lab.period.slice(0, 8)}01`;
      await lab.admin();
      await lab.db.query("update task_instances set scheduled_on=$2::date where id=$1", [task, outsideDay]);
      await lab.db.query("insert into task_coverage_plans(id,organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by) values($1,$2,$3,$4,$5::date,$6::date,'licencia',$7)", [plan, ids.org, ids.owner, ids.peer, lab.day, lab.day, ids.boss]);
      await lab.db.query("insert into task_coverage_bindings(id,organization_id,plan_id,instance_id,responsible_id,replacement_id,starts_on,ends_on,company_id_snapshot,period_snapshot,scheduled_on_snapshot,status,approved_by) values($1,$2,$3,$4,$5,$6,$7::date,$7::date,$8,$9::date,$10::date,'active',$11)", [binding, ids.org, plan, task, ids.owner, ids.peer, lab.day, ids.company, lab.period, outsideDay, ids.boss]);
      await lab.actor(ids.peer, "aal1", "authenticated");
      const result = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "workspacePage", filters: filters(null, lab.period), cursor: null, limit: 20 })]);
      expect(result.result.data.items.map((item: any) => item.taskId)).toContain(task);
      expect(decodeQueryResponseV1(result.result).ok).toBe(true);
    } finally { await lab.db.close(); }
  }, 30_000);

  it("includes only current, sealed legacy absence coverage and rechecks access on later pages", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      const firstTask = await lab.task();
      const secondTask = await lab.task();
      const outsideDay = `${lab.period.slice(0, 8)}01`;
      const absence = await lab.absence(ids.owner, ids.peer, lab.day, lab.day, [ids.company]);
      await lab.admin();
      await lab.db.query("update task_instances set scheduled_on=$2::date where id=any($1::uuid[])", [[firstTask, secondTask], outsideDay]);
      await lab.actor(ids.peer, "aal1", "authenticated");
      const request = (cursor: string | null) => JSON.stringify({ contractVersion: 1, kind: "workspacePage", filters: filters(null, lab.period), cursor, limit: 1 });
      const first = await lab.first("select api.query_v1($1::jsonb) result", [request(null)]);
      expect(first.result.data.items).toHaveLength(1);
      expect(first.result.data.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(first.result.data.nextCursor).not.toMatch(/[=\r\n]/);
      expect(decodeQueryResponseV1(first.result).ok).toBe(true);
      await expect(lab.first("select api.query_v1($1::jsonb)", [request(`${first.result.data.nextCursor}\n`)])).rejects.toThrow();
      await expect(lab.first("select api.query_v1($1::jsonb)", [request(`${first.result.data.nextCursor}=`)])).rejects.toThrow();
      const parsed = JSON.parse(Buffer.from(first.result.data.nextCursor, "base64url").toString("utf8"));
      expect(parsed).toMatchObject({ kind: "workspacePage", cursorVersion: 1, orderVersion: 1, subjectId: ids.peer });
      const wrongCursorVersion = Buffer.from(JSON.stringify({ ...parsed, cursorVersion: "1" }), "utf8").toString("base64url");
      await expect(lab.first("select api.query_v1($1::jsonb)", [request(wrongCursorVersion)])).rejects.toThrow();
      const second = await lab.first("select api.query_v1($1::jsonb) result", [request(first.result.data.nextCursor)]);
      expect(second.result.data.items).toHaveLength(1);
      expect(second.result.data.items[0].taskId).not.toBe(first.result.data.items[0].taskId);
      expect(decodeQueryResponseV1(second.result).ok).toBe(true);
      await lab.admin();
      await lab.db.query("update employee_absences set cancelled_at=now() where id=$1", [absence]);
      await lab.actor(ids.peer, "aal1", "authenticated");
      const afterRevocation = await lab.first("select api.query_v1($1::jsonb) result", [request(first.result.data.nextCursor)]);
      expect(afterRevocation.result.data.items).toHaveLength(0);
      expect(afterRevocation.result.data.nextCursor).toBeNull();
    } finally { await lab.db.close(); }
  }, 30_000);

  it("allows a manager to filter their own managed team without being its member", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      const managedTeam = lab.next();
      await lab.admin();
      await lab.db.query("insert into teams(id,organization_id,name,manager_id) values($1,$2,'Managed without membership',$3)", [managedTeam, ids.org, ids.manager]);
      await lab.actor(ids.manager, "aal2", "authenticated");
      const request = { contractVersion: 1, kind: "workspacePage", filters: filters(null, lab.period, null, managedTeam), cursor: null, limit: 20 };
      const result = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify(request)]);
      expect(result.result.data.items).toEqual([]);
      expect(decodeQueryResponseV1(result.result).ok).toBe(true);
    } finally { await lab.db.close(); }
  }, 30_000);

  it("decodes SQL responses for result, operational v1 and operational v2 while retaining saved coefficient snapshots", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      const resultTask = await lab.task({ kind: "resultado" });
      const operationalV1 = await lab.task({ kind: "operativa" });
      const operationalV2 = await lab.task({ kind: "operativa" });
      const head = lab.next(), oldRate = lab.next(), newRate = lab.next();
      await lab.admin();
      await lab.db.query("update task_instances set measurement_version=2,weight=null,target=null,unit='facturas',checklist='[]'::jsonb where id=$1", [operationalV2]);
      await lab.db.query("insert into app_private.operational_rate_heads(id,organization_id,company_id,template_id,instance_id) values($1,$2,$3,null,$4)", [head, ids.org, ids.company, operationalV2]);
      await lab.db.query("insert into app_private.operational_rate_versions(id,organization_id,head_id,version,effective_on,unit,unit_weight,reason,created_by) values($1,$2,$3,1,$4::date,'facturas',2,'Coeficiente inicial',$5),($6,$2,$3,2,$7::date,'facturas',9,'Coeficiente revisado',$5)", [oldRate, ids.org, head, lab.period, ids.boss, newRate, lab.day]);
      await lab.db.query("insert into activity_entries(organization_id,instance_id,work_date,quantity,reference,actor_id,measurement_version,operational_rate_id,operational_unit_weight,unit_snapshot) values($1,$2,$3,3,'Lote histórico',$4,2,$5,2,'facturas')", [ids.org, operationalV2, lab.day, ids.owner, oldRate]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      const response = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "workspacePage", filters: filters(null, lab.period), cursor: null, limit: 20 })]);
      expect(decodeQueryResponseV1(response.result).ok).toBe(true);
      const items = response.result.data.items;
      expect(items.find((item: any) => item.taskId === resultTask)).toMatchObject({ kind: "resultado", measurementVersion: 1 });
      expect(items.find((item: any) => item.taskId === operationalV1)).toMatchObject({ kind: "operativa", measurementVersion: 1, weight: "5", target: 40, unit: "facturas" });
      const v2 = items.find((item: any) => item.taskId === operationalV2);
      expect(v2).toMatchObject({ kind: "operativa", measurementVersion: 2, weight: null, target: null, unit: "facturas", subjectWork: { quantity: "3" } });
      expect(Number(v2.subjectWork.ratedLoad)).toBe(6);
      expect(Number(v2.subjectWork.weightedLoad)).toBe(6);
      await lab.actor(ids.boss, "aal2", "authenticated");
      const history = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "rateHistory", filters: { companyId: ids.company, templateId: null, taskId: operationalV2 }, cursor: null, limit: 100 })]);
      expect(history.result.data.items.map((item: any) => item.version)).toEqual(["2", "1"]);
      expect(Number(items.find((item: any) => item.taskId === operationalV2).subjectWork.weightedLoad)).toBe(6);
    } finally { await lab.db.close(); }
  }, 30_000);

  it("keeps participant contributions separate and excludes private notes and activity references", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      const task = await lab.task({ checklist: [{ text: "Control compartido", done: false }] });
      await lab.admin();
      await lab.db.query("update task_instances set due_date=$2::date where id=$1", [task, lab.period]);
      await lab.db.query("update task_assignments set frequency='unica' where id=(select assignment_id from task_instances where id=$1)", [task]);
      await lab.actor(ids.boss, "aal2", "authenticated");
      await lab.first("select assign_task_responsibility($1,$2::jsonb,'Synthetic joint task',1,$3)", [task, JSON.stringify([{ profileId: ids.owner, shareBps: 5000 }, { profileId: ids.peer, shareBps: 5000 }]), lab.next()]);
      await lab.admin();
      await lab.db.query("insert into task_time_sessions(organization_id,instance_id,actor_id,started_at,ended_at) values($1,$2,$3,now()-interval '20 minutes',now()-interval '10 minutes')", [ids.org, task, ids.peer]);
      await lab.db.query("insert into activity_entries(organization_id,instance_id,work_date,quantity,reference,actor_id) values($1,$2,$3,2,'PRIVATE-REFERENCE',$4)", [ids.org, task, lab.day, ids.peer]);
      await lab.db.query("insert into task_private_block_notes(organization_id,instance_id,author_id,body) values($1,$2,$3,'PRIVATE-NOTE')", [ids.org, task, ids.owner]);
      await lab.actor(ids.peer, "aal1", "authenticated");
      const result = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "workspacePage", filters: filters(null, lab.period), cursor: null, limit: 20 })]);
      expect(result.result.data.items[0].subjectWork.recordedSeconds).toBe("600");
      expect(decodeQueryResponseV1(result.result).ok).toBe(true);
      expect(JSON.stringify(result.result)).not.toMatch(/PRIVATE-REFERENCE|PRIVATE-NOTE/);
    } finally { await lab.db.close(); }
  }, 30_000);

  it("returns title within the DTO cap and rejects unrepresentable controls without dropping them", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      const task = await lab.task({ checklist: [{ text: "Control" }] });
      await lab.admin();
      await lab.db.query("update task_instances set title=$2 where id=$1", [task, "x".repeat(201)]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      const request = { contractVersion: 1, kind: "workspacePage", filters: filters(null, lab.period), cursor: null, limit: 20 };
      const titleResponse = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify(request)]);
      expect(titleResponse.result.data.items[0].title).toHaveLength(200);
      expect(decodeQueryResponseV1(titleResponse.result).ok).toBe(true);
      await lab.admin();
      await lab.db.query("update task_instances set checklist=$2::jsonb where id=$1", [task, JSON.stringify([{ text: "x".repeat(1001), done: false }])]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      await expect(lab.first("select api.query_v1($1::jsonb)", [JSON.stringify(request)])).rejects.toThrow("Control histórico fuera de formato");
      await lab.admin();
      await lab.db.query("update task_instances set checklist=$2::jsonb where id=$1", [task, JSON.stringify(Array.from({ length: 101 }, (_, index) => ({ text: `Control ${index + 1}`, done: false })))]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      await expect(lab.first("select api.query_v1($1::jsonb)", [JSON.stringify(request)])).rejects.toThrow("Control histórico fuera de formato");
    } finally { await lab.db.close(); }
  }, 30_000);

  it("uses explicit null ranks so cursor pagination preserves real 9999-12-31 dates", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      const maxDue = await lab.task();
      const nullDue = await lab.task();
      await lab.admin();
      await lab.db.query("update task_instances set period='9999-12-01',due_date='9999-12-31',scheduled_on='9999-12-20' where id=$1", [maxDue]);
      await lab.db.query("update task_instances set period='9999-12-01',due_date=null,scheduled_on='9999-12-01' where id=$1", [nullDue]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      const page = async (cursor: string | null) => (await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "workspacePage", filters: filters(null, "9999-12-01"), cursor, limit: 1 })])).result;
      const dueFirst = await page(null);
      expect(dueFirst.data.items[0].taskId).toBe(maxDue);
      const dueSecond = await page(dueFirst.data.nextCursor);
      expect(dueSecond.data.items[0].taskId).toBe(nullDue);
      expect(decodeQueryResponseV1(dueSecond).ok).toBe(true);
    } finally { await lab.db.close(); }
  }, 30_000);

  it("uses stable, visibly marked name fallbacks for blank legacy labels", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      const task = await lab.task();
      await lab.admin();
      await lab.db.query("update profiles set name='' where id=$1", [ids.owner]);
      await lab.db.query("update teams set name='' where id=$1", [ids.team]);
      await lab.db.query("update companies set name='' where id=$1", [ids.company]);
      await lab.actor(ids.boss, "aal2", "authenticated");
      const response = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "workspacePage", filters: filters(ids.owner, lab.period), cursor: null, limit: 20 })]);
      const item = response.result.data.items.find((row: any) => row.taskId === task);
      expect(item.ownerDisplayName).toBe(`[Sin nombre · ${ids.owner.slice(0, 8)}]`);
      expect(item.teamName).toBe(`[Sin nombre · ${ids.team.slice(0, 8)}]`);
      expect(item.companyName).toBe(`[Sin nombre · ${ids.company.slice(0, 8)}]`);
      expect(decodeQueryResponseV1(response.result).ok).toBe(true);
    } finally { await lab.db.close(); }
  }, 30_000);

  it("classifies checklist bootstrap without letting invalid or oversized historical checklists block other tasks", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      const inline = await lab.task();
      const oversized = await lab.task();
      const malformed = await lab.task();
      const longText = await lab.task();
      await lab.admin();
      await lab.db.query("update task_instances set checklist=$2::jsonb where id=$1", [inline, JSON.stringify(Array.from({ length: 100 }, (_, i) => ({ text: `Control ${i}`, done: false }))) ]);
      await lab.db.query("update task_instances set checklist=$2::jsonb where id=$1", [oversized, JSON.stringify(Array.from({ length: 101 }, (_, i) => ({ text: `Control ${i}`, done: false }))) ]);
      await lab.db.query("update task_instances set checklist=$2::jsonb where id=$1", [malformed, JSON.stringify([{ text: null, done: false, privateKey: "SECRET" }, { text: "", done: true }, null, { text: "válido", done: "yes" }]) ]);
      await lab.db.query("update task_instances set checklist=$2::jsonb where id=$1", [longText, JSON.stringify([{ text: "x".repeat(1001), done: false }]) ]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      const request = { contractVersion: 1, kind: "workspacePageV2", filters: filters(null, lab.period), cursor: null, limit: 20 };
      expect(decodeQueryV1(request).ok).toBe(true);
      const response = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify(request)]);
      expect(decodeQueryResponseV1(response.result).ok).toBe(true);
      const byId = new Map(response.result.data.items.map((item: any) => [item.taskId, item]));
      expect(byId.get(inline)).toMatchObject({ checklistState: "inline", checklistControlCount: 100 });
      expect((byId.get(inline) as any).checklist).toHaveLength(100);
      expect(byId.get(oversized)).toMatchObject({ checklistState: "paged", checklistControlCount: 101, checklist: [] });
      expect(byId.get(malformed)).toMatchObject({ checklistState: "requires_review", checklistControlCount: 4, checklist: [] });
      expect(byId.get(longText)).toMatchObject({ checklistState: "paged", checklistControlCount: 1, checklist: [] });
      expect(JSON.stringify(response.result)).not.toContain("SECRET");
    } finally { await lab.db.close(); }
  }, 30_000);

  it("pages checklist text on Unicode code point boundaries, reconstructs exactly, and reports legacy issues", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      const task = await lab.task();
      const longValue = `A😀e\u0301"\\\n${"🧾".repeat(1030)}`;
      const stored = [
        { id: ids.peer, text: longValue, done: true, private: "DO_NOT_RETURN" },
        { text: "x" },
        { text: "x".repeat(511), done: false },
        { text: "x".repeat(512), done: false },
        { text: "x".repeat(513), done: false },
        { text: "x".repeat(1024), done: false },
        { text: "x".repeat(1025), done: false },
        { text: "", done: "bad" },
        { text: 3, done: true },
        { unknown: "secret" },
        null,
        "legacy string",
        { text: "missing done" },
        { text: "recognized text", done: "bad" },
      ];
      await lab.admin();
      await lab.db.query("update task_instances set checklist=$2::jsonb where id=$1", [task, JSON.stringify(stored)]);
      const current = await lab.first("select state_revision::text revision from task_instances where id=$1", [task]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      const request = (cursor: string | null, limit = 1) => ({ contractVersion: 1, kind: "taskChecklistPage", filters: { taskId: task, subjectId: null, taskRevision: current.revision }, cursor, limit });
      expect(decodeQueryV1(request(null)).ok).toBe(true);
      const reconstructed = new Map<number, string>();
      const seenItems: any[] = [];
      let cursor: string | null = null; let pages = 0;
      do {
        const result = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify(request(cursor, 1))]);
        expect(decodeQueryResponseV1(result.result).ok).toBe(true);
        expect(new TextEncoder().encode(JSON.stringify(result.result)).byteLength).toBeLessThanOrEqual(65_536);
        const item = result.result.data.items[0]; seenItems.push(item);
        reconstructed.set(item.ordinal, (reconstructed.get(item.ordinal) ?? "") + item.textPart);
        cursor = result.result.data.nextCursor; pages++;
        expect(pages).toBeLessThan(25);
      } while (cursor);
      expect(reconstructed.get(1)).toBe(longValue);
      expect(Array.from(reconstructed.get(1)!).length).toBe(Array.from(longValue).length);
      expect(seenItems.filter((item) => item.ordinal === 1).map((item) => item.textOffset)).toEqual([0, 512, 1024]);
      expect(seenItems.filter((item) => item.ordinal === 5).map((item) => item.textOffset)).toEqual([0, 512]);
      expect(seenItems.filter((item) => item.ordinal === 6).map((item) => item.textOffset)).toEqual([0, 512]);
      expect(seenItems.filter((item) => item.ordinal === 7).map((item) => item.textOffset)).toEqual([0, 512, 1024]);
      expect(seenItems.find((item) => item.ordinal === 8)).toMatchObject({ issueCode: "text_empty", textLength: 0, done: null });
      expect(seenItems.find((item) => item.ordinal === 9)).toMatchObject({ issueCode: "text_invalid", textLength: 0, done: null });
      expect(seenItems.find((item) => item.ordinal === 10)).toMatchObject({ issueCode: "text_missing", done: null });
      expect(seenItems.find((item) => item.ordinal === 11)).toMatchObject({ issueCode: "invalid_type", done: null });
      expect(seenItems.find((item) => item.ordinal === 12)).toMatchObject({ issueCode: null, textPart: "legacy string", done: false });
      expect(seenItems.find((item) => item.ordinal === 13)).toMatchObject({ issueCode: null, textPart: "missing done", done: false });
      expect(seenItems.find((item) => item.ordinal === 14)).toMatchObject({ issueCode: "done_invalid", textPart: "recognized text", textLength: 15, done: null });
      expect(JSON.stringify(seenItems)).not.toMatch(/DO_NOT_RETURN|secret/i);
      const parsedCursor = JSON.parse(Buffer.from((await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify(request(null, 1))])).result.data.nextCursor, "base64url").toString("utf8"));
      expect(parsedCursor).toEqual({ kind: "taskChecklistPage", cursorVersion: 1, taskId: task, subjectId: ids.owner, taskRevision: current.revision, ordinal: 1, textOffset: 512 });
    } finally { await lab.db.close(); }
  }, 30_000);

  it("binds every detail page to the current revision, rechecks revocation, and advances revision on every checklist write", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      const task = await lab.task({ checklist: [{ id: ids.peer, text: "Control", done: false }] });
      const before = await lab.first("select state_revision::text revision from task_instances where id=$1", [task]);
      const direct = await lab.first("update task_instances set checklist='[{\"id\":\"00000000-0000-0000-0000-000000000005\",\"text\":\"Direct update\",\"done\":false}]'::jsonb where id=$1 returning state_revision::text revision", [task]);
      expect(BigInt(direct.revision)).toBe(BigInt(before.revision) + 1n);
      const actorCanUpdate = await lab.first("select has_table_privilege('authenticated','public.task_instances','UPDATE') allowed");
      expect(actorCanUpdate.allowed).toBe(false);
      await lab.actor(ids.owner, "aal1", "authenticated");
      const commandRevision = await lab.first("select public.set_checklist_item_reviewed($1,$2,true,'revisión', $3::bigint,$4) revision", [task, ids.peer, direct.revision, lab.next()]);
      expect(BigInt(commandRevision.revision)).toBe(BigInt(direct.revision) + 1n);
      const current = await lab.first("select state_revision::text revision from task_instances where id=$1", [task]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      const request = (revision: string, cursor: string | null = null) => JSON.stringify({ contractVersion: 1, kind: "taskChecklistPage", filters: { taskId: task, subjectId: null, taskRevision: revision }, cursor, limit: 1 });
      const page = await lab.first("select api.query_v1($1::jsonb) result", [request(current.revision)]);
      expect(page.result.data.taskRevision).toBe(current.revision);
      await expect(lab.first("select api.query_v1($1::jsonb)", [request(direct.revision)])).rejects.toThrow("task_changed");
      const revocationTask = await lab.task({ owner: ids.peer, checklist: [{ text: "A" }, { text: "B" }] });
      const revocationTaskRevision = await lab.first("select state_revision::text revision from task_instances where id=$1", [revocationTask]);
      const replacement = await lab.absence(ids.peer, ids.owner, lab.day, lab.day, [ids.company]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      const revocableReq = (cursor: string | null) => JSON.stringify({ contractVersion: 1, kind: "taskChecklistPage", filters: { taskId: revocationTask, subjectId: null, taskRevision: revocationTaskRevision.revision }, cursor, limit: 1 });
      const first = await lab.first("select api.query_v1($1::jsonb) result", [revocableReq(null)]);
      expect(first.result.data.items).toHaveLength(1);
      await lab.admin(); await lab.db.query("update employee_absences set cancelled_at=now() where id=$1", [replacement]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      await expect(lab.first("select api.query_v1($1::jsonb)", [revocableReq(first.result.data.nextCursor)])).rejects.toThrow("Consulta no disponible");
    } finally { await lab.db.close(); }
  }, 30_000);

  it("rejects noncanonical, cross-task, out-of-range, non-grid, and end-position checklist cursors while allowing legal jumps", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m015);
      const task = await lab.task({ checklist: [{ text: "x".repeat(513) }, { text: "second" }] });
      const empty = await lab.task();
      const revision = await lab.first("select state_revision::text revision from task_instances where id=$1", [task]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      const request = (cursor: string | null) => JSON.stringify({ contractVersion: 1, kind: "taskChecklistPage", filters: { taskId: task, subjectId: null, taskRevision: revision.revision }, cursor, limit: 1 });
      const first = await lab.first("select api.query_v1($1::jsonb) result", [request(null)]);
      const token = first.result.data.nextCursor as string;
      expect(decodeQueryResponseV1(first.result).ok).toBe(true);
      const payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
      const cursor = async (value: unknown) => (await lab.first("select rtrim(translate(regexp_replace(encode(convert_to($1::jsonb::text,'UTF8'),'base64'),E'[\\r\\n]','','g'),'+/','-_'),'=') token", [JSON.stringify(value)])).token as string;
      const badValues = [
        { ...payload, taskRevision: "1" }, { ...payload, taskId: empty },
        { ...payload, subjectId: ids.peer }, { ...payload, cursorVersion: 2 },
        { ...payload, unexpected: true }, { ...payload, ordinal: 3, textOffset: 0 },
        { ...payload, ordinal: 1, textOffset: 1 }, { ...payload, ordinal: 1, textOffset: 513 },
        { ...payload, ordinal: 1, textOffset: 1024 }, { ...payload, kind: "workspacePageV2" },
      ];
      const badTokens: string[] = [`${token}=`, `${token}\n`];
      for (const value of badValues) badTokens.push(await cursor(value));
      for (const bad of badTokens) await expect(lab.first("select api.query_v1($1::jsonb)", [request(bad)])).rejects.toThrow("Consulta inválida");
      const jump = await cursor({ ...payload, ordinal: 2, textOffset: 0 });
      const jumped = await lab.first("select api.query_v1($1::jsonb) result", [request(jump)]);
      expect(jumped.result.data.items[0]).toMatchObject({ ordinal: 2, textPart: "second", textComplete: true });
      const emptyRevision = await lab.first("select state_revision::text revision from task_instances where id=$1", [empty]);
      const emptyRequest = JSON.stringify({ contractVersion: 1, kind: "taskChecklistPage", filters: { taskId: empty, subjectId: null, taskRevision: emptyRevision.revision }, cursor: null, limit: 16 });
      const emptyPage = await lab.first("select api.query_v1($1::jsonb) result", [emptyRequest]);
      const emptyCursor = await cursor({ kind: "taskChecklistPage", cursorVersion: 1, taskId: empty, subjectId: ids.owner, taskRevision: emptyRevision.revision, ordinal: 1, textOffset: 0 });
      expect(emptyPage.result.data.items).toEqual([]);
      await expect(lab.first("select api.query_v1($1::jsonb)", [JSON.stringify({ ...JSON.parse(emptyRequest), cursor: emptyCursor })])).rejects.toThrow("Consulta inválida");
    } finally { await lab.db.close(); }
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
      await lab.task({ owner: ids.owner });
      await lab.actor(ids.manager, "aal2", "authenticated");
      const request = (cursor: string | null) => ({ contractVersion: 1, kind: "workspacePage", filters: filters(ids.owner, lab.period, ids.company, ids.team), cursor, limit: 1 });
      const page = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify(request(null))]);
      expect(page.result.data.items).toHaveLength(1);
      expect(page.result.data.nextCursor).toEqual(expect.any(String));
      await lab.admin();
      await lab.db.query("update profiles set manager_id=$1 where id=$2", [ids.boss, ids.owner]);
      await lab.actor(ids.manager, "aal2", "authenticated");
      await expect(lab.first("select api.query_v1($1::jsonb)", [JSON.stringify(request(page.result.data.nextCursor))])).rejects.toThrow();
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

  it("selects bounded pages and reuses canonical cursors through all 2,000 tasks", async () => {
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
      expect(page.result.data.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(page.result.data.nextCursor).not.toMatch(/[=\r\n]/);
      expect(responseBytes).toBeLessThan(250_000);
      expect(elapsedMs).toBeLessThan(30_000);
      console.info(`workspacePage 2k smoke: ${elapsedMs} ms, ${responseBytes} response bytes`);
      const seen = new Set<string>(page.result.data.items.map((item: any) => item.taskId));
      let cursor = page.result.data.nextCursor as string | null;
      let pageCount = 1;
      while (cursor) {
        const next = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "workspacePage", filters: filters(null, lab.period), cursor, limit: 100 })]);
        expect(decodeQueryResponseV1(next.result).ok).toBe(true);
        for (const item of next.result.data.items) seen.add(item.taskId);
        cursor = next.result.data.nextCursor;
        pageCount++;
        expect(pageCount).toBeLessThanOrEqual(21);
      }
      expect(pageCount).toBe(20);
      expect(seen.size).toBe(2000);
      const largeTask = page.result.data.items[0].taskId as string;
      await lab.admin();
      await lab.db.query("update task_instances set checklist=$2::jsonb where id=$1", [largeTask, JSON.stringify([{ text: "x".repeat(1_000_000), done: false }, ...Array.from({ length: 9_999 }, (_, index) => ({ text: `Control ${index}`, done: false }))])]);
      const largeRevision = await lab.first("select state_revision::text revision from task_instances where id=$1", [largeTask]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      const v2StartedAt = Date.now();
      const v2 = await lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind: "workspacePageV2", filters: filters(null, lab.period), cursor: null, limit: 100 })]);
      const v2ElapsedMs = Date.now() - v2StartedAt;
      const largeItem = v2.result.data.items.find((item: any) => item.taskId === largeTask);
      expect(largeItem).toMatchObject({ checklistState: "paged", checklistControlCount: 10_000, checklist: [] });
      expect(decodeQueryResponseV1(v2.result).ok).toBe(true);
      const detailRequest = (cursor: string | null) => JSON.stringify({ contractVersion: 1, kind: "taskChecklistPage", filters: { taskId: largeTask, subjectId: null, taskRevision: largeRevision.revision }, cursor, limit: 16 });
      const detailStartedAt = Date.now();
      const detailFirst = await lab.first("select api.query_v1($1::jsonb) result", [detailRequest(null)]);
      const detailFirstMs = Date.now() - detailStartedAt;
      expect(decodeQueryResponseV1(detailFirst.result).ok).toBe(true);
      expect(detailFirst.result.data.items).toHaveLength(16);
      expect(detailFirst.result.data.items[0]).toMatchObject({ ordinal: 1, textOffset: 0, textLength: 1_000_000, textComplete: false });
      const detailSecondStartedAt = Date.now();
      const detailSecond = await lab.first("select api.query_v1($1::jsonb) result", [detailRequest(detailFirst.result.data.nextCursor)]);
      const detailSecondMs = Date.now() - detailSecondStartedAt;
      expect(decodeQueryResponseV1(detailSecond.result).ok).toBe(true);
      expect(detailSecond.result.data.items[0]).toMatchObject({ ordinal: 1, textOffset: 8_192, textLength: 1_000_000 });
      expect(new TextEncoder().encode(JSON.stringify(detailFirst.result)).byteLength).toBeLessThanOrEqual(65_536);
      console.info(`workspacePageV2 2k+10k checklist/1M text: ${v2ElapsedMs} ms; checklist first/next RPC ${detailFirstMs}/${detailSecondMs} ms; bytes ${new TextEncoder().encode(JSON.stringify(detailFirst.result)).byteLength}/${new TextEncoder().encode(JSON.stringify(detailSecond.result)).byteLength}; ${process.platform}/${process.arch} Node ${process.version}, PGlite (synthetic, not Supabase)`);
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
      console.info(`workspacePage partial selector-only EXPLAIN ANALYZE BUFFERS (not the RPC plan; omits DTO aggregation and session/activity joins): ${JSON.stringify(planSummary)}`);
    } finally {
      await lab.db.close();
    }
  }, 180_000);
});
