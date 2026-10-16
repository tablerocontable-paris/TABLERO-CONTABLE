import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AccountingLab, ids, stages } from "./helpers/accounting-lab";
import {
  createTaskReader,
  type TaskReadQuery,
} from "../src/data/remote/task-reader";
import {
  createTaskGateway,
  prepareTaskCommand,
  type TaskCommand,
  type TaskRpcName,
  type TaskRpcTransport,
} from "../src/data/remote/task-gateway";

let lab: AccountingLab;
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
function sqlTransport() {
  return {
    async read(query: TaskReadQuery) {
      await lab.db.exec("savepoint task_read");
      try {
        let sql: string;
        let args: unknown[];
        if (query.kind === "taskPage") {
          if (query.table !== "task_instances")
            throw new Error("Wrong fixed table");
          sql =
            "select to_jsonb(t) row from task_instances t where period=$1::date and ($2::uuid is null or company_id=$2) and ($3::uuid is null or owner_id=$3) and ($4::uuid is null or team_id=$4) and ($5::uuid is null or id>$5) order by id asc limit $6";
          args = [
            query.period,
            query.companyId,
            query.ownerId,
            query.teamId,
            query.afterId,
            query.take,
          ];
        } else if (query.kind === "taskById") {
          if (query.table !== "task_instances")
            throw new Error("Wrong fixed table");
          sql =
            "select to_jsonb(t) row from task_instances t where id=$1 limit $2";
          args = [query.instanceId, query.take];
        } else {
          if (query.table !== "task_time_sessions")
            throw new Error("Wrong fixed table");
          sql =
            "select to_jsonb(s) row from task_time_sessions s where instance_id=any($1::uuid[]) and ($2::uuid is null or id>$2) order by id asc limit $3";
          args = [query.instanceIds, query.afterId, query.take];
        }
        const result = await lab.rows(sql, args);
        await lab.db.exec("release savepoint task_read");
        return { data: json(result.map((row) => row.row)), error: null };
      } catch {
        await lab.db.exec(
          "rollback to savepoint task_read;release savepoint task_read",
        );
        return { data: null, error: { code: "sql_error" } };
      }
    },
  };
}

const rpcStatements: Record<TaskRpcName, { sql: string; keys: string[] }> = {
  start_task_timer: {
    sql: "select public.start_task_timer($1,$2,$3,$4) value",
    keys: ["p_instance", "p_expected_revision", "p_operation_id", "p_switch"],
  },
  pause_task_timer: {
    sql: "select public.pause_task_timer($1,$2) value",
    keys: ["p_session", "p_operation_id"],
  },
  set_task_wait_reviewed: {
    sql: "select public.set_task_wait_reviewed($1,$2,$3,$4,$5) value",
    keys: ["p_instance", "p_note", "p_reason", "p_expected_revision", "p_operation_id"],
  },
  transition_task_reviewed: {
    sql: "select public.transition_task_reviewed($1,$2,$3,$4,$5) value",
    keys: [
      "p_instance",
      "p_next",
      "p_reason",
      "p_expected_revision",
      "p_operation_id",
    ],
  },
  set_checklist_item_reviewed: {
    sql: "select public.set_checklist_item_reviewed($1,$2,$3,$4,$5,$6) value",
    keys: [
      "p_instance",
      "p_check",
      "p_done",
      "p_reason",
      "p_expected_revision",
      "p_operation_id",
    ],
  },
  record_activity_once: {
    sql: "select public.record_activity_once($1,$2,$3,$4,$5) value",
    keys: [
      "p_instance",
      "p_work_date",
      "p_quantity",
      "p_reference",
      "p_operation_id",
    ],
  },
};
function gatewayHarness() {
  const rpc = vi.fn<TaskRpcTransport["rpc"]>(async (name, args) => {
    await lab.db.exec("savepoint reader_gateway");
    try {
      const statement = rpcStatements[name];
      const result = await lab.first(
        statement.sql,
        statement.keys.map((key) => (args as Record<string, unknown>)[key]),
      );
      await lab.db.exec("release savepoint reader_gateway");
      return { data: json(result.value), error: null };
    } catch {
      await lab.db.exec(
        "rollback to savepoint reader_gateway;release savepoint reader_gateway",
      );
      return { data: null, error: { code: "lab_rejection" } };
    }
  });
  return { rpc, gateway: createTaskGateway({ rpc }) };
}
const command = (
  input: Omit<TaskCommand, "operationId"> & Record<string, unknown>,
) => prepareTaskCommand({ ...input, operationId: lab.next() });

beforeAll(async () => {
  lab = await new AccountingLab().init(stages.m012);
}, 20000);
beforeEach(async () => {
  await lab.admin();
  await lab.db.exec("begin");
});
afterEach(async () => {
  await lab.db.exec("rollback;reset role");
});
afterAll(async () => lab?.close());

describe("task reader con SELECT allowlistado y RLS del AccountingLab", () => {
  it("pagina tareas autorizadas sin saltos, separa empresa y encuentra filas completas", async () => {
    const isolatedPeriod = "2098-01-01";
    const a = await lab.task({ company: ids.company, period: isolatedPeriod });
    const b = await lab.task({ company: ids.company, period: isolatedPeriod });
    await lab.task({ company: ids.otherCompany, period: isolatedPeriod });
    await lab.actor(ids.owner);
    const reader = createTaskReader(sqlTransport());
    const page1 = await reader.listTasks({
      period: isolatedPeriod,
      companyId: ids.company,
      limit: 1,
    });
    expect(page1).toMatchObject({
      ok: true,
      rows: [{ id: a }],
      hasMore: true,
      nextCursor: a,
    });
    if (!page1.ok) throw new Error("Expected a task page");
    const page2 = await reader.listTasks({
      period: isolatedPeriod,
      companyId: ids.company,
      limit: 1,
      afterId: page1.nextCursor,
    });
    expect(page2).toMatchObject({
      ok: true,
      rows: [{ id: b }],
      hasMore: false,
      nextCursor: null,
    });
    expect(
      await reader.listTasks({
        period: isolatedPeriod,
        companyId: ids.otherCompany,
      }),
    ).toMatchObject({ ok: true, rows: [{ company_id: ids.otherCompany }] });
    expect(await reader.findTask({ instanceId: a })).toMatchObject({
      ok: true,
      kind: "found",
      row: { title: "Task", company_id: ids.company },
    });
    expect(await reader.findTask({ instanceId: ids.otherOrg })).toEqual({
      ok: true,
      kind: "unavailable",
    });
  });

  it("reads persisted sessions only for listed task IDs and preserves metadata", async () => {
    const taskId = await lab.task();
    const sessionId = await lab.session(taskId, ids.owner);
    await lab.actor(ids.owner);
    const reader = createTaskReader(sqlTransport());
    expect(await reader.listSessions({ instanceIds: [taskId] })).toMatchObject({
      ok: true,
      rows: [{ id: sessionId, instance_id: taskId }],
    });
    expect(
      await reader.listSessions({ instanceIds: [ids.otherOrg] }),
    ).toMatchObject({ ok: true, rows: [] });
  });

  it("compares complete SQL task/session rows without losing timestamp precision", async () => {
    const taskId = await lab.task({
      checklist: [{ id: "control", done: false, evidence: "retained" }],
    });
    const sessionId = await lab.session(taskId, ids.owner, null,
      "2026-10-02T10:00:00.123456Z", "2026-10-02T10:01:00.654321Z");
    await lab.admin();
    const expectedTask = (await lab.first(
      "select to_jsonb(t) row from task_instances t where id=$1", [taskId],
    )).row;
    const expectedSession = (await lab.first(
      "select to_jsonb(s) row from task_time_sessions s where id=$1", [sessionId],
    )).row;
    await lab.actor(ids.owner);
    const reader = createTaskReader(sqlTransport());
    expect(await reader.findTask({ instanceId: taskId })).toEqual({
      ok: true, kind: "found", row: expectedTask,
    });
    const result = await reader.listSessions({ instanceIds: [taskId] });
    expect(result).toMatchObject({ ok: true, rows: [expectedSession] });
    expect(expectedSession.started_at).toContain(".123456");
    expect(expectedSession.ended_at).toContain(".654321");
  });

  it("keeps operative checklists in progress and reloads confirmed work and paused timer", async () => {
    const taskId = await lab.task({
      kind: "operativa",
      checklist: [{ id: "control-a", done: false }, { id: "control-b", done: false }],
    });
    const reader = createTaskReader(sqlTransport());
    const { gateway } = gatewayHarness();
    await lab.actor(ids.owner);
    const started = await gateway.execute(command({
      kind: "start", instanceId: taskId, expectedRevision: 0, switch: false,
    }));
    expect(started).toMatchObject({ ok: true, kind: "start" });
    if (!started.ok || started.kind !== "start") throw new Error("Expected timer start");
    await lab.actor(ids.owner);
    expect(await gateway.execute(command({
      kind: "checklist", instanceId: taskId, expectedRevision: 1,
      checkId: "control-a", done: true, reason: null,
    }))).toMatchObject({ ok: true, kind: "checklist", revision: 2 });
    await lab.actor(ids.owner);
    expect(await gateway.execute(command({
      kind: "checklist", instanceId: taskId, expectedRevision: 2,
      checkId: "control-b", done: true, reason: null,
    }))).toMatchObject({ ok: true, kind: "checklist", revision: 3 });
    await lab.actor(ids.owner);
    expect(await reader.findTask({ instanceId: taskId })).toMatchObject({
      ok: true, kind: "found", row: {
        status: "En curso", state_revision: 3,
        checklist: [{ id: "control-a", done: true }, { id: "control-b", done: true }],
      },
    });
    await lab.actor(ids.owner);
    expect(await gateway.execute(command({ kind: "pause", sessionId: started.sessionId }))).toMatchObject({ ok: true, kind: "pause" });
    await lab.actor(ids.owner);
    const history = await reader.listSessions({ instanceIds: [taskId] });
    expect(history).toMatchObject({ ok: true, rows: [{ id: started.sessionId, ended_at: expect.any(String) }] });
    await lab.actor(ids.owner);
    expect(await reader.findTask({ instanceId: taskId })).toMatchObject({ ok: true, kind: "found", row: { status: "En curso", state_revision: 4 } });
  });

  it("enforces employee, current manager, boss and organization scope despite caller filters", async () => {
    const period = "2098-02-01";
    const ownA = await lab.task({ company: ids.company, period });
    const ownB = await lab.task({ company: ids.otherCompany, period });
    const peerTask = await lab.task({
      owner: ids.peer,
      company: ids.company,
      period,
    });
    const managerTask = await lab.task({
      owner: ids.manager,
      company: ids.company,
      period,
    });
    const reader = createTaskReader(sqlTransport());

    await lab.actor(ids.owner);
    expect(await reader.listTasks({ period })).toMatchObject({
      ok: true,
      rows: [{ id: ownA }, { id: ownB }],
    });
    expect(await reader.listTasks({ period, ownerId: ids.peer })).toMatchObject(
      { ok: true, rows: [] },
    );
    expect(
      await reader.listTasks({ period, companyId: ids.otherCompany }),
    ).toMatchObject({ ok: true, rows: [{ id: ownB }] });

    await lab.actor(ids.manager);
    expect(await reader.listTasks({ period })).toMatchObject({
      ok: true,
      rows: [{ id: ownA }, { id: ownB }, { id: managerTask }],
    });
    expect(await reader.listTasks({ period, ownerId: ids.peer })).toMatchObject(
      { ok: true, rows: [] },
    );

    await lab.actor(ids.boss, "aal2");
    expect(await reader.listTasks({ period })).toMatchObject({
      ok: true,
      rows: [{ id: ownA }, { id: ownB }, { id: peerTask }, { id: managerTask }],
    });
    const traversed: string[] = [];
    let cursor: string | null = null;
    for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
      const page = await reader.listTasks({
        period,
        limit: 1,
        afterId: cursor,
      });
      expect(page.ok).toBe(true);
      if (!page.ok) throw new Error("Expected an authorized page");
      traversed.push(...page.rows.map((row) => row.id));
      if (!page.hasMore) break;
      cursor = page.nextCursor;
    }
    expect(traversed).toEqual([ownA, ownB, peerTask, managerTask]);

    // Give the separate organization a visible control row; RLS must return it
    // while continuing to hide all rows from this organization.
    await lab.admin();
    const foreignCompany = lab.next();
    const foreignTeam = lab.next();
    const foreignAssignment = lab.next();
    const foreignInstance = lab.next();
    await lab.db.query(
      "insert into companies(id,organization_id,name) values($1,$2,'Other org')",
      [foreignCompany, ids.otherOrg],
    );
    await lab.db.query(
      "insert into teams(id,organization_id,name,manager_id) values($1,$2,'Other team',$3)",
      [foreignTeam, ids.otherOrg, ids.outsider],
    );
    await lab.db.query(
      "insert into team_members(organization_id,team_id,profile_id) values($1,$2,$3)",
      [ids.otherOrg, foreignTeam, ids.outsider],
    );
    await lab.db.query(
      "insert into company_memberships(organization_id,company_id,profile_id) values($1,$2,$3)",
      [ids.otherOrg, foreignCompany, ids.outsider],
    );
    await lab.db.query(
      "insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day,checklist) values($1,$2,$3,$4,$5,'Task','resultado',5,'mensual',$6,15,'[]'::jsonb)",
      [
        foreignAssignment,
        ids.otherOrg,
        foreignCompany,
        ids.outsider,
        foreignTeam,
        period,
      ],
    );
    await lab.db.query(
      "insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status) values($1,$2,$3,$4,$5,$6,$7,$7,'Task','resultado',5,null,null,null,'[]'::jsonb,'Pendiente')",
      [
        foreignInstance,
        ids.otherOrg,
        foreignAssignment,
        foreignCompany,
        ids.outsider,
        foreignTeam,
        period,
      ],
    );

    await lab.actor(ids.outsider);
    expect(await reader.listTasks({ period })).toMatchObject({
      ok: true,
      rows: [{ id: foreignInstance }],
    });
    const before = await lab.capture();
    await lab.actor(ids.outsider);
    expect(
      await reader.listTasks({
        period,
        companyId: ids.company,
        ownerId: ids.owner,
      }),
    ).toMatchObject({ ok: true, rows: [] });
    const after = await lab.capture();
    expect(after).toEqual(before);
  });

  it("applies hierarchy and membership changes on each read", async () => {
    const period = "2098-03-01";
    const ownerTask = await lab.task({ period });
    const reader = createTaskReader(sqlTransport());
    await lab.actor(ids.manager);
    expect(await reader.findTask({ instanceId: ownerTask })).toMatchObject({
      ok: true,
      kind: "found",
    });

    await lab.admin();
    await lab.db.query("update profiles set manager_id=null where id=$1", [
      ids.owner,
    ]);
    await lab.actor(ids.manager);
    const hidden = await reader.findTask({ instanceId: ownerTask });
    expect(hidden).toEqual({
      ok: true,
      kind: "unavailable",
    });
    expect(hidden).toEqual(await reader.findTask({ instanceId: ids.otherOrg }));

    await lab.admin();
    await lab.db.query("update profiles set manager_id=$1 where id=$2", [
      ids.manager,
      ids.owner,
    ]);
    await lab.db.query(
      "delete from company_memberships where profile_id=$1 and company_id=$2",
      [ids.manager, ids.otherCompany],
    );
    await lab.actor(ids.manager);
    expect(await reader.findTask({ instanceId: ownerTask })).toMatchObject({
      ok: true,
      kind: "found",
    });
    const otherCompanyTask = await lab.task({
      company: ids.otherCompany,
      period,
    });
    await lab.actor(ids.manager);
    expect(await reader.findTask({ instanceId: otherCompanyTask })).toEqual({
      ok: true,
      kind: "unavailable",
    });
  });

  it("retains an executor's historical session after its sealed coverage is cancelled", async () => {
    const taskId = await lab.task({ period: lab.period });
    const otherCompanyTask = await lab.task({ company: ids.otherCompany, period: lab.period });
    const priorPeriod = `${String(Number(lab.period.slice(0, 4)) - (lab.period.slice(5, 7) === "01" ? 1 : 0)).padStart(4, "0")}-${lab.period.slice(5, 7) === "01" ? "12" : String(Number(lab.period.slice(5, 7)) - 1).padStart(2, "0")}-01`;
    const priorPeriodTask = await lab.task({ period: priorPeriod });
    const originalOwnerSession = await lab.session(
      taskId,
      ids.owner,
      null,
      "2025-04-01T12:00:00Z",
      "2025-04-01T12:01:00Z",
    );
    await lab.admin();
    await lab.db.query(
      "update task_instances set scheduled_on=$1 where id=$2",
      [lab.day, taskId],
    );
    const absenceId = await lab.absence(ids.owner, ids.peer, lab.day, lab.day, [
      ids.company,
    ]);
    const { gateway } = gatewayHarness();
    await lab.actor(ids.peer);
    const started = await gateway.execute(
      command({
        kind: "start",
        instanceId: taskId,
        expectedRevision: 0,
        switch: false,
      }),
    );
    if (!started.ok || started.kind !== "start")
      throw new Error("Expected authorized coverage start");
    const reader = createTaskReader(sqlTransport());
    await lab.actor(ids.peer);
    expect(await reader.findTask({ instanceId: taskId })).toMatchObject({
      ok: true,
      kind: "found",
      row: { status: "En curso", state_revision: 1 },
    });
    await lab.actor(ids.peer);
    expect(await reader.findTask({ instanceId: otherCompanyTask })).toEqual({ ok: true, kind: "unavailable" });
    await lab.actor(ids.peer);
    expect(await reader.findTask({ instanceId: priorPeriodTask })).toEqual({ ok: true, kind: "unavailable" });
    await lab.actor(ids.peer);
    expect(await reader.listTasks({ period: lab.period, companyId: ids.otherCompany, ownerId: ids.owner })).toMatchObject({ ok: true, rows: [] });
    await lab.actor(ids.peer);
    expect(await reader.listTasks({ period: priorPeriod, companyId: ids.company, ownerId: ids.owner })).toMatchObject({ ok: true, rows: [] });
    expect(await lab.first("select current_user role,auth.uid() actor")).toEqual({ role: "authenticated", actor: ids.peer });

    await lab.actor(ids.boss, "aal2");
    await lab.first("select public.cancel_employee_absence($1,$2,$3)", [
      absenceId,
      "Fin de cobertura",
      lab.next(),
    ]);
    const beforeDeniedRead = await lab.capture();
    await lab.actor(ids.peer);
    expect(await reader.findTask({ instanceId: taskId })).toEqual({
      ok: true,
      kind: "unavailable",
    });
    const history = await reader.listSessions({ instanceIds: [taskId] });
    expect(history).toMatchObject({
      ok: true,
      rows: [
        {
          id: started.sessionId,
          actor_id: ids.peer,
          instance_id: taskId,
          ended_at: expect.any(String),
        },
      ],
    });
    if (!history.ok) throw new Error("Expected own historical session");
    expect(history.rows.map((session) => session.id)).toEqual([
      started.sessionId,
    ]);
    expect(history.rows.map((session) => session.id)).not.toContain(
      originalOwnerSession,
    );
    const afterDeniedRead = await lab.capture();
    expect(afterDeniedRead).toEqual(beforeDeniedRead);
    await lab.actor(ids.peer);
    expect(
      await reader.listTasks({
        period: lab.period,
        companyId: ids.otherCompany,
        ownerId: ids.owner,
      }),
    ).toMatchObject({ ok: true, rows: [] });
    await lab.actor(ids.peer);
    expect(await reader.listTasks({ period: priorPeriod, companyId: ids.company, ownerId: ids.owner })).toMatchObject({ ok: true, rows: [] });
  });

  it("re-reads confirmed state after starting, checklist, transition and switching timers", async () => {
    const period = "2098-04-01";
    const a = await lab.task({
      period,
      checklist: [
        { id: "control", done: false },
        { id: "second", done: false },
      ],
    });
    const b = await lab.task({ period });
    const reader = createTaskReader(sqlTransport());
    const { gateway, rpc } = gatewayHarness();

    await lab.actor(ids.owner);
    const startA = await gateway.execute(
      command({
        kind: "start",
        instanceId: a,
        expectedRevision: 0,
        switch: false,
      }),
    );
    if (!startA.ok || startA.kind !== "start")
      throw new Error("Expected start ACK");
    await lab.actor(ids.owner);
    const startedA = await reader.findTask({ instanceId: a });
    expect(startedA).toMatchObject({
      ok: true,
      kind: "found",
      row: { status: "En curso", state_revision: 1 },
    });

    await lab.actor(ids.owner);
    expect(
      await gateway.execute(
        command({
          kind: "checklist",
          instanceId: a,
          expectedRevision: 1,
          checkId: "control",
          done: true,
          reason: null,
        }),
      ),
    ).toMatchObject({ ok: true, kind: "checklist", revision: 2 });
    await lab.actor(ids.owner);
    expect(await reader.findTask({ instanceId: a })).toMatchObject({
      ok: true,
      kind: "found",
      row: {
        status: "En curso",
        state_revision: 2,
        checklist: [
          { id: "control", done: true },
          { id: "second", done: false },
        ],
      },
    });

    await lab.actor(ids.owner);
    expect(
      await gateway.execute(
        command({
          kind: "checklist",
          instanceId: a,
          expectedRevision: 2,
          checkId: "second",
          done: true,
          reason: null,
        }),
      ),
    ).toMatchObject({ ok: true, kind: "checklist", revision: 3 });
    await lab.actor(ids.owner);
    expect(await reader.findTask({ instanceId: a })).toMatchObject({
      ok: true,
      kind: "found",
      row: {
        status: "Completada",
        state_revision: 3,
        checklist: [
          { id: "control", done: true },
          { id: "second", done: true },
        ],
      },
    });
    await lab.actor(ids.owner);
    expect(
      await gateway.execute(
        command({
          kind: "transition",
          instanceId: a,
          expectedRevision: 3,
          next: "Pendiente",
          reason: "Revisión requerida",
        }),
      ),
    ).toMatchObject({ ok: true, kind: "transition", revision: 4 });
    await lab.actor(ids.owner);
    expect(await reader.findTask({ instanceId: a })).toMatchObject({
      ok: true,
      kind: "found",
      row: { status: "Pendiente", state_revision: 4 },
    });

    // Use a separate still-pending task for a timer switch.
    const c = await lab.task({ period });
    await lab.actor(ids.owner);
    const startB = await gateway.execute(
      command({
        kind: "start",
        instanceId: b,
        expectedRevision: 0,
        switch: false,
      }),
    );
    if (!startB.ok || startB.kind !== "start")
      throw new Error("Expected second start ACK");
    await lab.actor(ids.owner);
    const startC = await gateway.execute(
      command({
        kind: "start",
        instanceId: c,
        expectedRevision: 0,
        switch: true,
      }),
    );
    if (!startC.ok || startC.kind !== "start")
      throw new Error("Expected switch ACK");

    await lab.actor(ids.owner);
    expect(await reader.findTask({ instanceId: b })).toMatchObject({
      ok: true,
      kind: "found",
      row: { status: "En curso", state_revision: 2 },
    });
    await lab.actor(ids.owner);
    expect(await reader.findTask({ instanceId: c })).toMatchObject({
      ok: true,
      kind: "found",
      row: { status: "En curso", state_revision: 1 },
    });
    await lab.actor(ids.owner);
    const sessions = await reader.listSessions({ instanceIds: [b, c] });
    expect(sessions).toMatchObject({ ok: true });
    if (!sessions.ok) throw new Error("Expected persisted sessions");
    expect(sessions.rows.map((row) => row.id)).toEqual(
      [startB.sessionId, startC.sessionId].sort((left, right) =>
        left.localeCompare(right),
      ),
    );
    expect(sessions.rows.find((row) => row.instance_id === b)).toMatchObject({
      id: startB.sessionId,
      actor_id: ids.owner,
      ended_at: expect.any(String),
    });
    expect(sessions.rows.find((row) => row.instance_id === c)).toMatchObject({
      id: startC.sessionId,
      actor_id: ids.owner,
      ended_at: null,
    });
    expect(rpc).toHaveBeenCalledTimes(6);
  });
});
