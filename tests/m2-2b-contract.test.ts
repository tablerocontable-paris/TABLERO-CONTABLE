import { describe, expect, it } from "vitest";
import { decodeCommandResponseV1, decodeCommandV1, decodeQueryDataV1, decodeQueryResponseV1, decodeQueryV1 } from "../src/data/supabase/operational-contract";
import { AccountingLab, ids, stages } from "./helpers/accounting-lab";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const errorCode = (error: unknown) => (error as { code?: string }).code;
const envelope = (kind: string, payload: Record<string, unknown>, expectedRevisions: Record<string, string>) => ({ contractVersion: 1, operationId: id(90), kind, payload, expectedRevisions });

describe("M2.2B protocol DTO", () => {
  it("accepts the commercial controls and rejects out-of-range or fractional progress", () => {
    for (const throughDay of [0, 30]) expect(decodeCommandV1(envelope("task.commercialProgress", { taskId: id(1), throughDay }, { [`task:${id(1)}`]: "0" })).ok).toBe(true);
    for (const throughDay of [-1, 31, 1.5, null]) expect(decodeCommandV1(envelope("task.commercialProgress", { taskId: id(1), throughDay }, { [`task:${id(1)}`]: "0" })).ok).toBe(false);
    expect(decodeCommandV1(envelope("task.commercialMode", { taskId: id(1), enabled: false }, { [`task:${id(1)}`]: "0" })).ok).toBe(true);
    expect(decodeCommandV1(envelope("task.transition", { taskId: id(1), status: "Completada", reason: null, confirmCommercialCompletion: true }, { [`task:${id(1)}`]: "0" })).ok).toBe(true);
  });

  it("requires exact task and graph revisions and unique bounded dependency IDs", () => {
    const expected = { [`task:${id(1)}`]: "0", [`graph:${id(2)}:2026-10-01`]: "3" };
    const valid = envelope("task.dependencies", { taskId: id(1), prerequisiteIds: [id(2)], availableFrom: null }, expected);
    expect(decodeCommandV1(valid).ok).toBe(true);
    expect(decodeCommandV1({ ...valid, payload: { ...valid.payload, prerequisiteIds: [id(2), id(2)] } }).ok).toBe(false);
    expect(decodeCommandV1({ ...valid, expectedRevisions: { [`task:${id(1)}`]: "0" } }).ok).toBe(false);
    expect(decodeCommandV1({ ...valid, payload: { ...valid.payload, prerequisiteIds: Array.from({ length: 101 }, (_, n) => id(n + 1)) } }).ok).toBe(false);
  });

  it("decodes exact command and readiness/route DTOs", () => {
    expect(decodeCommandResponseV1({ contractVersion: 1, operationId: id(90), kind: "task.commercialMode", result: { taskId: id(1), taskRevision: "1", enabled: true, throughDay: 0 } }).ok).toBe(true);
    expect(decodeCommandResponseV1({ contractVersion: 1, operationId: id(90), kind: "task.transition", result: { taskId: id(1), taskRevision: "2", status: "Completada", completionEventId: id(3), extra: true } }).ok).toBe(false);
    const readiness = { taskId: id(1), taskRevision: "1", graphRevision: "0", asOfOn: "2026-10-16", ready: false, blockers: [{ code: "available_later", availableFrom: "2026-10-20" }], visibleDependencies: [], hasHiddenDependencies: true, commercial: { enabled: true, throughDay: 30, completionSuggested: true } };
    expect(decodeQueryDataV1({ kind: "readiness", data: readiness }).ok).toBe(true);
    expect(decodeQueryResponseV1({ contractVersion: 1, kind: "readiness", data: readiness }).ok).toBe(true);
    expect(decodeQueryV1({ contractVersion: 1, kind: "readiness", filters: { taskId: id(1) }, cursor: null, limit: 1 }).ok).toBe(true);
    const routeQuery = { contractVersion: 1, kind: "suggestedRoute", filters: { subjectId: id(1), period: "2026-10-01", companyId: null, teamId: null, sector: null }, cursor: null, limit: 20 };
    expect(decodeQueryV1(routeQuery).ok).toBe(true);
    expect(decodeQueryV1({ ...routeQuery, filters: { ...routeQuery.filters, period: "2026-10-16" } }).ok).toBe(false);
    expect(decodeQueryResponseV1({ contractVersion: 1, kind: "suggestedRoute", data: { asOfOn: "2026-10-16", items: [{ taskId: id(1), taskRevision: "0", title: "Legacy weight", companyId: id(2), ownerId: id(3), period: "2026-10-01", dueDate: null, priority: "Media", weight: "0.123456789", scheduledOn: null, ready: true, blockerCodes: [] }], nextCursor: null } }).ok).toBe(true);
  });
});

describe("M2.2B SQL dispatch", () => {
  it("serves readiness and the paginated route, then reauthorizes a B command receipt", async () => {
    const lab = await new AccountingLab().init(stages.m014);
    try {
      const task = await lab.task({ period: lab.period });
      const secondTask = await lab.task({ period: lab.period });
      const hiddenOwner = lab.next();
      await lab.admin();
      await lab.db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())", [hiddenOwner, `${hiddenOwner}@example.test`]);
      await lab.db.query("insert into profiles(id,organization_id,name,role,manager_id,sector,branch,position) values($1,$2,'Hidden','empleado',$3,'Contabilidad','Lab','Test')", [hiddenOwner, ids.org, ids.boss]);
      await lab.db.query("insert into company_memberships(organization_id,company_id,profile_id) values($1,$2,$3)", [ids.org, ids.company, hiddenOwner]);
      await lab.db.query("insert into team_members(organization_id,team_id,profile_id) values($1,$2,$3)", [ids.org, ids.team, hiddenOwner]);
      const hiddenPrerequisite = await lab.task({ owner: hiddenOwner, period: lab.period });
      await lab.actor(ids.owner, "aal1", "authenticated");
      const query = async (kind: string, filters: unknown, cursor: string | null = null, limit = 1) =>
        lab.first("select api.query_v1($1::jsonb) result", [JSON.stringify({ contractVersion: 1, kind, filters, cursor, limit })]);
      for (const filters of [
        { companyId: ids.company, templateId: null, taskId: null },
        { companyId: ids.company, templateId: id(500), taskId: task },
      ]) {
        const xorError = await lab.rows("select api.query_v1($1::jsonb)", [JSON.stringify({ contractVersion: 1, kind: "rateHistory", filters, cursor: null, limit: 10 })]).catch((error: unknown) => error);
        expect(errorCode(xorError)).toBe("22023");
      }
      const readiness = (await query("readiness", { taskId: task })).result;
      expect(readiness.data).toMatchObject({ taskId: task, ready: true, commercial: { enabled: false, throughDay: null, completionSuggested: false } });
      const routeFilters = { subjectId: ids.owner, period: lab.period, companyId: null, teamId: null, sector: null };
      const route = (await query("suggestedRoute", routeFilters)).result;
      expect(route.data.items.map((item: { taskId: string }) => item.taskId)).toContain(task);
      expect(route.data.items[0]).toMatchObject({ taskId: task, ownerId: ids.owner, ready: true });
      expect(route.data.nextCursor).toEqual(expect.any(String));
      const nextPage = (await query("suggestedRoute", routeFilters, route.data.nextCursor)).result;
      expect(nextPage.data.items.map((item: { taskId: string }) => item.taskId)).toEqual([secondTask]);
      const staleDateCursor = JSON.parse(Buffer.from(route.data.nextCursor, "base64url").toString("utf8"));
      staleDateCursor.asOfOn = "2000-01-01";
      const staleDateError = await lab.rows("select api.query_v1($1::jsonb)", [JSON.stringify({ contractVersion: 1, kind: "suggestedRoute", filters: routeFilters, cursor: Buffer.from(JSON.stringify(staleDateCursor)).toString("base64url"), limit: 1 })]).catch((error: { code?: string }) => error);
      expect(errorCode(staleDateError)).toBe("40001");

      await lab.actor(ids.boss, "aal2", "authenticated");
      const graphKey = `graph:${ids.company}:${lab.period}`;
      const dependencyCommand = { contractVersion: 1, operationId: lab.next(), kind: "task.dependencies", expectedRevisions: { [`task:${secondTask}`]: "0", [graphKey]: "0" }, payload: { taskId: secondTask, prerequisiteIds: [task, hiddenPrerequisite], availableFrom: null } };
      const dependencyResult = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(dependencyCommand)])).result;
      expect(dependencyResult.result).toMatchObject({ taskId: secondTask, taskRevision: "1", graphRevision: "1" });
      await lab.actor(ids.owner, "aal1", "authenticated");
      expect((await query("readiness", { taskId: secondTask })).result.data.blockers).toContainEqual({ code: "dependencies_pending", availableFrom: null });
      const scopedReadiness = (await query("readiness", { taskId: secondTask })).result.data;
      expect(scopedReadiness.hasHiddenDependencies).toBe(true);
      expect(scopedReadiness.visibleDependencies.map((dependency: { taskId: string }) => dependency.taskId)).toEqual([task]);
      expect(JSON.stringify(scopedReadiness)).not.toContain(hiddenPrerequisite);
      const legacyTimerError = await lab.rows("select public.start_task_timer($1,1,$2,false)", [secondTask, lab.next()]).catch((error: { code?: string; message?: string }) => error);
      expect(errorCode(legacyTimerError)).toBe("55000");
      const cycleCommand = { contractVersion: 1, operationId: lab.next(), kind: "task.dependencies", expectedRevisions: { [`task:${task}`]: "0", [graphKey]: "1" }, payload: { taskId: task, prerequisiteIds: [secondTask], availableFrom: null } };
      await lab.actor(ids.boss, "aal2", "authenticated");
      const cycleError = await lab.rows("select api.command_v1($1::jsonb)", [JSON.stringify(cycleCommand)]).catch((error: { code?: string }) => error);
      expect(errorCode(cycleError)).toBe("22023");
      await lab.admin();
      expect(await lab.first("select config_revision from app_private.task_dependency_graphs where company_id=$1 and period=$2", [ids.company, lab.period])).toEqual({ config_revision: 1 });

      await lab.admin();
      await lab.db.query("update task_instances set priority='Alta' where id=$1", [secondTask]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      const movedRouteError = await lab.rows("select api.query_v1($1::jsonb)", [JSON.stringify({ contractVersion: 1, kind: "suggestedRoute", filters: routeFilters, cursor: route.data.nextCursor, limit: 1 })]).catch((error: { code?: string }) => error);
      expect(errorCode(movedRouteError)).toBe("40001");

      await lab.actor(ids.manager, "aal1", "authenticated");
      const operationId = lab.next();
      const command = { contractVersion: 1, operationId, kind: "task.commercialMode", expectedRevisions: { [`task:${task}`]: "0" }, payload: { taskId: task, enabled: true } };
      const lowAalError = await lab.rows("select api.command_v1($1::jsonb)", [JSON.stringify(command)]).catch((error: { code?: string }) => error);
      expect(errorCode(lowAalError)).toBe("42501");
      await lab.actor(ids.manager, "aal2", "authenticated");
      const managerError = await lab.rows("select api.command_v1($1::jsonb)", [JSON.stringify(command)]).catch((error: { code?: string }) => error);
      expect(errorCode(managerError)).toBe("42501");
      await lab.actor(ids.boss, "aal2", "authenticated");
      const commandResult = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(command)])).result;
      expect(commandResult.result).toMatchObject({ taskId: task, enabled: true, throughDay: 0 });
      expect((await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(command)])).result).toEqual(commandResult);
      const receipt = (await query("commandReceipt", { operationId })).result;
      expect(receipt.data).toEqual({ found: true, command: commandResult });
      await lab.actor(ids.manager, "aal2", "authenticated");
      const managerReplay = await lab.rows("select api.command_v1($1::jsonb)", [JSON.stringify(command)]).catch((error: { code?: string }) => error);
      expect(errorCode(managerReplay)).toBe("42501");
      const managerOperationId = lab.next();
      await lab.admin();
      await lab.db.query("insert into app_private.api_command_receipts(actor_id,operation_id,organization_id,kind,arguments,result) values($1,$2,$3,'task.commercialMode',$4::jsonb,$5::jsonb)", [ids.manager, managerOperationId, ids.org, JSON.stringify(command), JSON.stringify(commandResult)]);
      await lab.actor(ids.manager, "aal2", "authenticated");
      const managerReceipt = await lab.rows("select api.query_v1($1::jsonb)", [JSON.stringify({ contractVersion: 1, kind: "commandReceipt", filters: { operationId: managerOperationId }, cursor: null, limit: 1 })]).catch((error: { code?: string }) => error);
      expect(errorCode(managerReceipt)).toBe("42501");
      await lab.actor(ids.owner, "aal1", "authenticated");
      expect((await query("readiness", { taskId: task })).result.data.commercial).toEqual({ enabled: true, throughDay: 0, completionSuggested: false });
      const invalidProgress = { contractVersion: 1, operationId: lab.next(), kind: "task.commercialProgress", expectedRevisions: { [`task:${task}`]: "1" }, payload: { taskId: task, throughDay: 31 } };
      const invalidProgressError = await lab.rows("select api.command_v1($1::jsonb)", [JSON.stringify(invalidProgress)]).catch((error: { code?: string }) => error);
      expect(errorCode(invalidProgressError)).toBe("22023");
      const progress = { contractVersion: 1, operationId: lab.next(), kind: "task.commercialProgress", expectedRevisions: { [`task:${task}`]: "1" }, payload: { taskId: task, throughDay: 30 } };
      const progressResult = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(progress)])).result;
      expect(progressResult.result).toMatchObject({ taskRevision: "2", throughDay: 30, completionSuggested: true });
      await lab.first("select public.start_task_timer($1,2,$2,false) session_id", [task, lab.next()]);
      const deniedCompletion = { contractVersion: 1, operationId: lab.next(), kind: "task.transition", expectedRevisions: { [`task:${task}`]: "3" }, payload: { taskId: task, status: "Completada", reason: null, confirmCommercialCompletion: false } };
      const deniedCompletionError = await lab.rows("select api.command_v1($1::jsonb)", [JSON.stringify(deniedCompletion)]).catch((error: { code?: string }) => error);
      expect(errorCode(deniedCompletionError)).toBe("55000");
      const completion = { ...deniedCompletion, operationId: lab.next(), payload: { ...deniedCompletion.payload, confirmCommercialCompletion: true } };
      const completionResult = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(completion)])).result;
      expect(completionResult.result).toMatchObject({ taskRevision: "4", status: "Completada" });
      expect(completionResult.result.completionEventId).toMatch(/^[0-9a-f-]{36}$/);
      await lab.admin();
      expect(await lab.first("select count(*)::int count from app_private.task_completion_events where instance_id=$1 and task_revision=4", [task])).toEqual({ count: 1 });
      await lab.actor(ids.owner, "aal1", "authenticated");
      const reopen = { contractVersion: 1, operationId: lab.next(), kind: "task.transition", expectedRevisions: { [`task:${task}`]: "4" }, payload: { taskId: task, status: "Pendiente", reason: "Reapertura documentada para seguimiento", confirmCommercialCompletion: false } };
      const reopenResult = (await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(reopen)])).result;
      expect(reopenResult.result.status).toBe("Pendiente");
      await lab.admin();
      const auditReason = await lab.first("select exists(select 1 from public.audit_events where details::text like '%Reapertura documentada para seguimiento%') found");
      const historyReason = await lab.first("select exists(select 1 from public.task_reopen_events where instance_id=$1 and reason='Reapertura documentada para seguimiento') found", [task]);
      expect(auditReason.found).toBe(false);
      expect(historyReason.found).toBe(true);
      await lab.db.query("insert into public.monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values($1,$2,$3,'{}'::jsonb,$4,'B regression close')", [ids.org, ids.owner, lab.period, ids.boss]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      expect((await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify(reopen)])).result).toEqual(reopenResult);
      expect((await query("commandReceipt", { operationId: reopen.operationId })).result.data).toEqual({ found: true, command: reopenResult });
      const closedRoute = (await query("suggestedRoute", routeFilters)).result.data;
      expect(closedRoute.items.map((item: { taskId: string }) => item.taskId)).not.toContain(task);
      const closedCursorError = await lab.rows("select api.query_v1($1::jsonb)", [JSON.stringify({ contractVersion: 1, kind: "suggestedRoute", filters: routeFilters, cursor: route.data.nextCursor, limit: 1 })]).catch((error: unknown) => error);
      expect(errorCode(closedCursorError)).toBe("40001");
    } finally {
      await lab.db.close();
    }
  }, 20_000);
});
