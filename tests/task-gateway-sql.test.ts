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
  taskInstanceSchema,
  taskTimeSessionSchema,
} from "../src/data/remote/task-contract";
import {
  createTaskGateway,
  prepareTaskCommand,
  type TaskCommand,
  type TaskRpcName,
  type TaskRpcTransport,
} from "../src/data/remote/task-gateway";

let lab: AccountingLab;
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
// Fixed SQL allowlist. A caller-provided name is never interpolated into SQL.
const statements: Record<TaskRpcName, { sql: string; keys: string[] }> = {
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
function harness() {
  const rpc = vi.fn<TaskRpcTransport["rpc"]>(async (name, args) => {
    const statement = statements[name];
    if (!statement) throw new Error("Not in test allowlist");
    await lab.db.exec("savepoint gateway_call");
    try {
      const result = await lab.first(
        statement.sql,
        statement.keys.map((key) => (args as Record<string, unknown>)[key]),
      );
      await lab.db.exec("release savepoint gateway_call");
      return { data: json(result.value), error: null };
    } catch {
      await lab.db.exec(
        "rollback to savepoint gateway_call;release savepoint gateway_call",
      );
      return { data: null, error: { code: "lab_rejection" } };
    }
  });
  return { rpc, gateway: createTaskGateway({ rpc }) };
}
const command = (
  input: Omit<TaskCommand, "operationId"> & Record<string, unknown>,
) => prepareTaskCommand({ ...input, operationId: lab.next() });
async function taskRow(instance: string) {
  return json(
    (
      await lab.first(
        "select to_jsonb(t) row from task_instances t where id=$1",
        [instance],
      )
    ).row,
  );
}
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

describe("gateway compuesto con SQL 001–008 en laboratorio aislado", () => {
  it("start y pause explícitos/replay retornan los escalares originales sin repetir sesión ni revisión", async () => {
    const instanceId = await lab.task(),
      { rpc, gateway } = harness();
    const start = command({
      kind: "start",
      instanceId,
      expectedRevision: 0,
      switch: false,
    });
    await lab.actor();
    const first = await gateway.execute(start);
    expect(first).toMatchObject({ ok: true, kind: "start" });
    if (!first.ok || first.kind !== "start")
      throw new Error("Expected session ACK");
    const started = await lab.capture();
    await lab.actor();
    expect(await gateway.execute(start)).toEqual(first);
    expect(await lab.capture()).toEqual(started);
    const pause = command({ kind: "pause", sessionId: first.sessionId });
    await lab.actor();
    const paused = await gateway.execute(pause);
    expect(paused).toMatchObject({ ok: true, kind: "pause" });
    const afterPause = await lab.capture();
    await lab.actor();
    expect(await gateway.execute(pause)).toEqual(paused);
    expect(await lab.capture()).toEqual(afterPause);
    await lab.actor();
    expect(taskInstanceSchema.parse(await taskRow(instanceId))).toMatchObject({
      state_revision: 2,
      status: "En curso",
    });
    const sessions = await lab.rows(
      "select to_jsonb(s) row from task_time_sessions s where instance_id=$1",
      [instanceId],
    );
    expect(sessions).toHaveLength(1);
    expect(taskTimeSessionSchema.parse(json(sessions[0].row))).toMatchObject({
      id: first.sessionId,
      actor_id: ids.owner,
      absence_id: null,
    });
    expect(rpc).toHaveBeenCalledTimes(4);
  });
  it("empleado no corta cobertura vigente; jefe aal2 sí y conserva contexto del ejecutor", async () => {
    const instanceId = await lab.task(),
      absenceId = await lab.absence(),
      { rpc, gateway } = harness();
    await lab.actor(ids.peer);
    const started = await gateway.execute(
      command({
        kind: "start",
        instanceId,
        expectedRevision: 0,
        switch: false,
      }),
    );
    if (!started.ok || started.kind !== "start")
      throw new Error("Expected covered clock");
    const before = await lab.capture(),
      calls = rpc.mock.calls.length;
    const wait = command({
      kind: "wait",
      instanceId,
      expectedRevision: 1,
      note: "  Banco X  ",
      reason: null,
    });
    await lab.actor();
    expect(await gateway.execute(wait)).toMatchObject({
      ok: false,
      error: { category: "server" },
    });
    expect(rpc).toHaveBeenCalledTimes(calls + 1);
    expect(await lab.capture()).toEqual(before);
    await lab.actor(ids.boss, "aal1");
    expect(await gateway.execute(command({
      kind: "wait", instanceId, expectedRevision: 1, note: "  Banco X  ",
      reason: "Interrupción acordada con Tesorería",
    }))).toMatchObject({ ok: false, error: { category: "server" } });
    expect(await lab.capture()).toEqual(before);
    await lab.actor(ids.boss, "aal2");
    const acceptedWait = command({
      kind: "wait", instanceId, expectedRevision: 1, note: "  Banco X  ",
      reason: "Interrupción acordada con Tesorería",
    });
    expect(await gateway.execute(acceptedWait)).toEqual({ ok: true, kind: "wait", revision: 2 });
    const acceptedState = await lab.capture();
    await lab.actor(ids.boss, "aal2");
    expect(await gateway.execute(acceptedWait)).toEqual({ ok: true, kind: "wait", revision: 2 });
    expect(await lab.capture()).toEqual(acceptedState);
    await lab.actor(ids.boss, "aal2");
    const changedReason = prepareTaskCommand({
      kind: "wait", operationId: acceptedWait.operationId, instanceId,
      expectedRevision: 1, note: "  Banco X  ", reason: "Motivo cambiado",
    });
    expect(await gateway.execute(changedReason)).toMatchObject({ ok: false, error: { category: "server" } });
    expect(await lab.capture()).toEqual(acceptedState);
    expect(taskInstanceSchema.parse(await taskRow(instanceId))).toMatchObject({
      blocked_by: "Banco X",
      state_revision: 2,
    });
    const sessions = await lab.rows(
      "select to_jsonb(s) row from task_time_sessions s where instance_id=$1",
      [instanceId],
    );
    expect(sessions).toHaveLength(1);
    const clock = taskTimeSessionSchema.parse(json(sessions[0].row));
    expect(clock).toMatchObject({
      id: started.sessionId,
      actor_id: ids.peer,
      absence_id: absenceId,
    });
    expect(clock.ended_at).not.toBeNull();
    await lab.admin();
    const events = await lab.rows(
      "select details,actor_id from audit_events where action='task.wait' and entity_id=$1",
      [instanceId],
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actor_id: ids.boss,
      details: {
        note: "  Banco X  ",
        reason: "Interrupción acordada con Tesorería",
      },
    });
    const stoppedEvents = await lab.rows(
      "select entity_id,details from audit_events where action='task.timer_stopped_by_task_change' and details->>'instance'=$1",
      [instanceId],
    );
    expect(stoppedEvents).toMatchObject([{ entity_id: started.sessionId, details: { executor: ids.peer, reason: "Interrupción acordada con Tesorería" } }]);
    expect(new Date(stoppedEvents[0].details.started_at).toISOString()).toBe(
      new Date(clock.started_at).toISOString(),
    );
    expect(new Date(stoppedEvents[0].details.ended_at).toISOString()).toBe(
      new Date(clock.ended_at!).toISOString(),
    );
  });
  it("último control completa en SQL; reapertura exige motivo y crea un solo evento", async () => {
    const instanceId = await lab.task({
        checklist: [{ id: "last", done: false }],
      }),
      { rpc, gateway } = harness();
    await lab.actor();
    const ack = await gateway.execute(
      command({
        kind: "checklist",
        instanceId,
        expectedRevision: 0,
        checkId: "last",
        done: true,
        reason: null,
      }),
    );
    expect(ack).toEqual({ ok: true, kind: "checklist", revision: 1 });
    expect(ack).not.toHaveProperty("status");
    expect(taskInstanceSchema.parse(await taskRow(instanceId))).toMatchObject({
      status: "Completada",
      state_revision: 1,
      checklist: [{ id: "last", done: true }],
    });
    const before = await lab.capture(),
      calls = rpc.mock.calls.length;
    await lab.actor();
    expect(
      await gateway.execute(
        command({
          kind: "transition",
          instanceId,
          expectedRevision: 1,
          next: "En curso",
          reason: null,
        }),
      ),
    ).toMatchObject({ ok: false, error: { category: "server" } });
    expect(rpc).toHaveBeenCalledTimes(calls + 1);
    expect(await lab.capture()).toEqual(before);
    const reopen = command({
      kind: "transition",
      instanceId,
      expectedRevision: 1,
      next: "En curso",
      reason: "Corrección documentada",
    });
    await lab.actor();
    expect(await gateway.execute(reopen)).toEqual({
      ok: true,
      kind: "transition",
      revision: 2,
    });
    await lab.actor();
    expect(await gateway.execute(reopen)).toEqual({
      ok: true,
      kind: "transition",
      revision: 2,
    });
    expect(taskInstanceSchema.parse(await taskRow(instanceId))).toMatchObject({
      status: "En curso",
      state_revision: 2,
      completed_at: null,
    });
    await lab.admin();
    expect(
      await lab.rows(
        "select reason from task_reopen_events where instance_id=$1",
        [instanceId],
      ),
    ).toEqual([{ reason: "Corrección documentada" }]);
  });
  it("revisión vieja no modifica filas, no cambia intención y no reintenta automáticamente", async () => {
    const instanceId = await lab.task(),
      { rpc, gateway } = harness();
    await lab.actor();
    expect(
      await gateway.execute(
        command({
          kind: "start",
          instanceId,
          expectedRevision: 0,
          switch: false,
        }),
      ),
    ).toMatchObject({ ok: true });
    const before = await lab.capture(),
      old = command({
        kind: "wait",
        instanceId,
        expectedRevision: 0,
        note: "Banco",
        reason: null,
      });
    const bytes = JSON.stringify(old),
      calls = rpc.mock.calls.length;
    await lab.actor();
    expect(await gateway.execute(old)).toMatchObject({
      ok: false,
      error: { category: "server" },
    });
    expect(rpc).toHaveBeenCalledTimes(calls + 1);
    expect(JSON.stringify(old)).toBe(bytes);
    expect(await lab.capture()).toEqual(before);
  });
  it("actividad/replay registra exactamente un lote con fecha, cantidad y referencia correctas", async () => {
    const instanceId = await lab.task({ kind: "operativa" }),
      { rpc, gateway } = harness();
    const activity = command({
      kind: "activity",
      instanceId,
      workDate: lab.day,
      quantity: 12,
      reference: "  Lote Facturas 123  ",
    });
    await lab.actor();
    const first = await gateway.execute(activity);
    expect(first).toMatchObject({ ok: true, kind: "activity" });
    if (!first.ok || first.kind !== "activity")
      throw new Error("Expected activity ACK");
    const before = await lab.capture();
    await lab.actor();
    expect(await gateway.execute(activity)).toEqual(first);
    expect(await lab.capture()).toEqual(before);
    await lab.actor();
    expect(
      await lab.rows(
        "select id,work_date::text,quantity,reference,actor_id from activity_entries where instance_id=$1",
        [instanceId],
      ),
    ).toEqual([
      {
        id: first.entryId,
        work_date: lab.day,
        quantity: 12,
        reference: "Lote Facturas 123",
        actor_id: ids.owner,
      },
    ]);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it("parsea filas auténticas sin mezclar banco/empresa/asignación ni sustituir peso/checklist", async () => {
    const checklist = [
      {
        id: "control-2",
        done: false,
        metadata: { source: "snapshot", formula: "=SUMA(A1:A5)" },
      },
      { id: "control-1", done: true },
    ];
    const first = await lab.task({ checklist }),
      second = await lab.task({ company: ids.otherCompany, checklist });
    await lab.db.query(
      "update task_instances set title='Conciliación Banco X',weight=case when id=$1 then 8 else 21 end,scheduled_on=$3::date,due_date=(period+interval '1 month')::date+4 where id in($1,$2)",
      [first, second, lab.day],
    );
    await lab.actor();
    const rawA = await taskRow(first),
      rawB = await taskRow(second);
    const a = taskInstanceSchema.parse(rawA),
      b = taskInstanceSchema.parse(rawB);
    expect(a).toEqual(rawA);
    expect(b).toEqual(rawB);
    expect(a).toMatchObject({
      company_id: ids.company,
      owner_id: ids.owner,
      team_id: ids.team,
      template_version_id: null,
      weight: 8,
      checklist,
      period: lab.period,
      scheduled_on: lab.day,
      unit: null,
      target: null,
    });
    expect(b).toMatchObject({
      company_id: ids.otherCompany,
      weight: 21,
      checklist,
      template_version_id: null,
    });
    expect(a.assignment_id).not.toBe(b.assignment_id);
    expect(a.title).toBe(b.title);
  });
});
