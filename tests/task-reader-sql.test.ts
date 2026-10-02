import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AccountingLab, ids } from "./helpers/accounting-lab";
import { createTaskReader, type TaskReadQuery } from "../src/data/remote/task-reader";

let lab: AccountingLab;
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
function sqlTransport() {
  return {
    async read(query: TaskReadQuery) {
      try {
        let sql: string;
        let args: unknown[];
        if (query.kind === "taskPage") {
          sql = "select to_jsonb(t) row from task_instances t where period=$1::date and ($2::uuid is null or company_id=$2) and ($3::uuid is null or owner_id=$3) and ($4::uuid is null or team_id=$4) and ($5::uuid is null or id>$5) order by id asc limit $6";
          args = [query.period, query.companyId, query.ownerId, query.teamId, query.afterId, query.take];
        } else if (query.kind === "taskById") {
          sql = "select to_jsonb(t) row from task_instances t where id=$1 limit $2";
          args = [query.instanceId, query.take];
        } else {
          sql = "select to_jsonb(s) row from task_time_sessions s where instance_id=any($1::uuid[]) and ($2::uuid is null or id>$2) order by id asc limit $3";
          args = [query.instanceIds, query.afterId, query.take];
        }
        const result = await lab.rows(sql, args);
        return { data: json(result.map((row) => row.row)), error: null };
      } catch {
        return { data: null, error: { code: "sql_error" } };
      }
    },
  };
}

beforeAll(async () => { lab = await new AccountingLab().init(); }, 20000);
beforeEach(async () => { await lab.admin(); await lab.db.exec("begin"); });
afterEach(async () => { await lab.db.exec("rollback;reset role"); });
afterAll(async () => lab?.close());

describe("task reader con SELECT allowlistado y RLS del AccountingLab", () => {
  it("pagina tareas autorizadas sin saltos, separa empresa y encuentra filas completas", async () => {
    const isolatedPeriod = "2098-01-01";
    const a = await lab.task({ company: ids.company, period: isolatedPeriod });
    const b = await lab.task({ company: ids.company, period: isolatedPeriod });
    await lab.task({ company: ids.otherCompany, period: isolatedPeriod });
    await lab.actor(ids.owner);
    const reader = createTaskReader(sqlTransport());
    const page1 = await reader.listTasks({ period: isolatedPeriod, companyId: ids.company, limit: 1 });
    expect(page1).toMatchObject({ ok: true, rows: [{ id: a }], hasMore: true, nextCursor: a });
    if (!page1.ok) throw new Error("Expected a task page");
    const page2 = await reader.listTasks({ period: isolatedPeriod, companyId: ids.company, limit: 1, afterId: page1.nextCursor });
    expect(page2).toMatchObject({ ok: true, rows: [{ id: b }], hasMore: false, nextCursor: null });
    expect(await reader.listTasks({ period: isolatedPeriod, companyId: ids.otherCompany })).toMatchObject({ ok: true, rows: [{ company_id: ids.otherCompany }] });
    expect(await reader.findTask({ instanceId: a })).toMatchObject({ ok: true, kind: "found", row: { title: "Task", company_id: ids.company } });
    expect(await reader.findTask({ instanceId: ids.otherOrg })).toEqual({ ok: true, kind: "unavailable" });
  });

  it("reads persisted sessions only for listed task IDs and preserves metadata", async () => {
    const taskId = await lab.task();
    const sessionId = await lab.session(taskId, ids.owner);
    await lab.actor(ids.owner);
    const reader = createTaskReader(sqlTransport());
    expect(await reader.listSessions({ instanceIds: [taskId] })).toMatchObject({ ok: true, rows: [{ id: sessionId, instance_id: taskId }] });
    expect(await reader.listSessions({ instanceIds: [ids.otherOrg] })).toMatchObject({ ok: true, rows: [] });
  });
});
