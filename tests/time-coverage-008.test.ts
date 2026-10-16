import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { AccountingLab, ids } from "./helpers/accounting-lab";

let lab: AccountingLab;
const twoSteps = [
  { id: "a", done: true },
  { id: "b", done: false },
];
const iso = (value: string | Date) => new Date(value).toISOString();
beforeAll(async () => {
  lab = await new AccountingLab().init();
}, 20000);
beforeEach(async () => {
  await lab.admin();
  await lab.db.exec("begin");
});
afterEach(async () => {
  await lab.db.exec("rollback;reset role");
});
afterAll(async () => lab?.close());
async function unchanged(
  sql: string,
  args: unknown[],
  actor = ids.owner,
  pattern = /./,
  aal = "aal1",
) {
  const before = await lab.capture();
  await lab.actor(actor, aal);
  await lab.expectError(sql, args, pattern);
  expect(await lab.capture()).toEqual(before);
}
async function auditContext(action: string, entity: string, session: string) {
  await lab.admin();
  const events = await lab.rows(
    "select at,details from audit_events where action=$1 and entity_id=$2 order by id",
    [action, entity],
  );
  expect(events).toHaveLength(1);
  const row = await lab.first("select * from task_time_sessions where id=$1", [
    session,
  ]);
  expect(events[0].details).toMatchObject({
    session,
    executor: row.actor_id,
    absence: row.absence_id,
  });
  expect(iso(events[0].details.started_at)).toBe(iso(row.started_at));
  expect(iso(events[0].details.ended_at)).toBe(iso(row.ended_at));
  return events[0];
}
async function closedOrigin() {
  const source = await lab.task({ period: "2025-03-01" });
  const clock = await lab.session(source);
  await lab.db.query(
    "insert into monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values($1,$2,'2025-03-01','{}',$3,'Synthetic closure')",
    [ids.org, ids.owner, ids.boss],
  );
  return { source, clock };
}
async function dual(withDestination = true, sourceLive = false) {
  const source = await lab.task({
    owner: ids.sourceOwner,
    period: "2025-04-01",
  });
  const target = await lab.task({
    period: "2025-05-01",
    checklist: [
      { id: "a", done: false },
      { id: "b", done: false },
    ],
  });
  const sourceAbsence = await lab.absence(
    ids.sourceOwner,
    ids.owner,
    "2025-04-01",
    "2025-04-02",
  );
  const sourceClock = await lab.session(
    source,
    ids.owner,
    sourceLive ? null : sourceAbsence,
  );
  let targetClock: string | null = null;
  if (withDestination) {
    const absence = await lab.absence(
      ids.owner,
      ids.peer,
      "2025-05-01",
      "2025-05-04",
    );
    targetClock = await lab.session(
      target,
      ids.peer,
      absence,
      "2025-05-01T12:00:00Z",
    );
  }
  return { source, target, sourceClock, targetClock };
}
describe("008: aceptación aislada de plan, cobertura y tiempos", () => {
  it("control ya igual con segundo paso pendiente no toca otro reloj cerrado ni audita", async () => {
    const { clock } = await closedOrigin();
    const target = await lab.task({ checklist: twoSteps });
    const before = await lab.capture(),
      operation = lab.next();
    await lab.actor();
    expect(
      (
        await lab.first(
          "select set_checklist_item_reviewed($1,'a',true,null,0,$2) revision",
          [target, operation],
        )
      ).revision,
    ).toBe(0);
    await lab.first(
      "select set_checklist_item_reviewed($1,'a',true,null,0,$2)",
      [target, operation],
    );
    const after = await lab.capture();
    expect(after.task_instances).toEqual(before.task_instances);
    expect(after.task_time_sessions).toEqual(before.task_time_sessions);
    expect(after.audit_events).toEqual(before.audit_events);
    expect(after.task_reopen_events).toEqual(before.task_reopen_events);
    expect(after.task_mutation_receipts as unknown[]).toHaveLength(1);
    expect(
      (
        await lab.first("select ended_at from task_time_sessions where id=$1", [
          clock,
        ])
      ).ended_at,
    ).toBeNull();
  });
  it("cambio real que inicia con origen cerrado rechaza íntegro", async () => {
    await closedOrigin();
    const target = await lab.task({ checklist: twoSteps });
    await lab.actor();
    expect(
      (
        await lab.first(
          "select set_checklist_item_reviewed($1,'a',false,null,0,$2) revision",
          [target, lab.next()],
        )
      ).revision,
    ).toBe(1);
    // Marking a different pending step requires an actual start, not completion.
    const other = await lab.task({
      checklist: [
        { id: "a", done: false },
        { id: "b", done: false },
      ],
    });
    await unchanged(
      "select set_checklist_item_reviewed($1,'a',true,null,0,$2)",
      [other, lab.next()],
      ids.owner,
      /cerrado/,
    );
  });
  for (const cancelled of [false, true])
    it(`espera vencida por ${cancelled ? "cancelación" : "fecha"} conserva contexto, replay y revisión única`, async () => {
      const task = await lab.task({ period: "2025-04-01" });
      const absence = await lab.absence(
        ids.owner,
        ids.peer,
        "2025-04-01",
        cancelled ? "2025-04-10" : "2025-04-02",
      );
      const session = await lab.session(task, ids.peer, absence);
      if (cancelled)
        await lab.db.query(
          "update employee_absences set cancelled_at='2025-04-02T13:00:00Z' where id=$1",
          [absence],
        );
      const op = lab.next();
      await lab.actor();
      await lab.first("select set_task_wait($1,'Banco',0,$2)", [task, op]);
      const expired = await auditContext(
        "task.timer_expired",
        session,
        session,
      );
      const wait = await auditContext("task.wait", task, session);
      expect(iso(wait.at)).toBe(iso(expired.at));
      expect(iso(wait.details.ended_at)).toBe(
        cancelled ? "2025-04-02T13:00:00.000Z" : "2025-04-03T03:00:00.000Z",
      );
      const before = await lab.capture();
      await lab.actor();
      await lab.first("select set_task_wait($1,'Banco',0,$2)", [task, op]);
      expect(await lab.capture()).toEqual(before);
      await lab.actor();
      await lab.first("select set_task_wait($1,'Banco',1,$2)", [
        task,
        lab.next(),
      ]);
      const after = await lab.capture();
      expect(after.audit_events).toEqual(before.audit_events);
      expect(after.task_time_sessions).toEqual(before.task_time_sessions);
      expect(
        (
          await lab.first(
            "select state_revision from task_instances where id=$1",
            [task],
          )
        ).state_revision,
      ).toBe(1);
    });
  for (const rpc of ["transition", "checklist"])
    for (const destination of [true, false])
      it(`${rpc}: origen vencido ${destination ? "y destino con cortes distintos" : "sin reloj destino"}`, async () => {
        const f = await dual(destination);
        await lab.actor();
        const operation = lab.next();
        const sql =
          rpc === "transition"
            ? "select transition_task_reviewed($1,'En curso',null,0,$2)"
            : "select set_checklist_item_reviewed($1,'a',true,null,0,$2)";
        await lab.first(sql, [f.target, operation]);
        const sourceEvent = await auditContext(
          "task.timer_expired",
          f.sourceClock,
          f.sourceClock,
        );
        expect(iso(sourceEvent.details.ended_at)).toBe(
          "2025-04-03T03:00:00.000Z",
        );
        const action =
          rpc === "transition" ? "task.transition" : "task.checklist";
        if (f.targetClock) {
          const event = await auditContext(action, f.target, f.targetClock);
          const expired = await auditContext(
            "task.timer_expired",
            f.targetClock,
            f.targetClock,
          );
          expect(iso(event.details.ended_at)).toBe("2025-05-05T03:00:00.000Z");
          expect(iso(expired.at)).toBe(iso(sourceEvent.at));
          expect(iso(event.at)).toBe(iso(sourceEvent.at));
        } else {
          const event = await lab.first(
            "select details from audit_events where action=$1 and entity_id=$2",
            [action, f.target],
          );
          expect(event.details).toMatchObject({
            session: null,
            executor: null,
            absence: null,
            started_at: null,
            ended_at: null,
          });
        }
        expect(
          (
            await lab.rows(
              "select state_revision from task_instances order by id",
            )
          ).map((r) => r.state_revision),
        ).toEqual([1, 1]);
        expect(
          await lab.rows(
            "select instance_id,actor_id from task_time_sessions where ended_at is null",
          ),
        ).toEqual([{ instance_id: f.target, actor_id: ids.owner }]);
        const before = await lab.capture();
        await lab.actor();
        await lab.first(sql, [f.target, operation]);
        expect(await lab.capture()).toEqual(before);
      });
  for (const rpc of ["transition", "checklist", "start"])
    it(`${rpc}: rechazo posterior revierte limpieza de destino vencido`, async () => {
      const f = await dual(true, true);
      const sql =
        rpc === "transition"
          ? "select transition_task_reviewed($1,'En curso',null,0,$2)"
          : rpc === "checklist"
            ? "select set_checklist_item_reviewed($1,'a',true,null,0,$2)"
            : "select start_task_timer($1,0,$2,false)";
      await unchanged(sql, [f.target, lab.next()], ids.owner, /Pause/);
    });
  for (const rpc of ["start", "checklist", "transition", "wait"])
    it(`${rpc}: revisión inválida preserva todas las filas`, async () => {
      const task = await lab.task({ checklist: twoSteps });
      const calls: Record<string, string> = {
        start: "select start_task_timer($1,99,$2,false)",
        checklist: "select set_checklist_item_reviewed($1,'b',true,null,99,$2)",
        transition: "select transition_task_reviewed($1,'En curso',null,99,$2)",
        wait: "select set_task_wait($1,'Banco',99,$2)",
      };
      await unchanged(calls[rpc], [task, lab.next()], ids.owner, /cambió/);
    });
  for (const rpc of ["start", "checklist", "transition", "wait", "pause"])
    it(`${rpc}: cambio de identidad después del plan falla sin efectos`, async () => {
      const task = await lab.task({ checklist: twoSteps }),
        session = rpc === "pause" ? await lab.session(task) : null;
      const mutation = `update public.task_instances set period=period+interval '1 month',scheduled_on=scheduled_on+interval '1 month' where id='${task}'`;
      await lab.admin();
      if (rpc === "pause") {
        const def = (
          await lab.first(
            "select pg_get_functiondef('public.pause_task_timer(uuid,uuid)'::regprocedure) definition",
          )
        ).definition as string;
        const marker =
          "select * into t from public.task_instances where id=planned_t.id;";
        expect(def).toContain(marker);
        await lab.db.exec(def.replace(marker, `${mutation};\n${marker}`));
      } else await lab.injectMonthGuard(mutation);
      const calls: Record<string, string> = {
        start: "select start_task_timer($1,0,$2,false)",
        checklist: "select set_checklist_item_reviewed($1,'b',true,null,0,$2)",
        transition: "select transition_task_reviewed($1,'En curso',null,0,$2)",
        wait: "select set_task_wait($1,'Banco',0,$2)",
        pause: "select pause_task_timer($1,$2)",
      };
      await unchanged(
        calls[rpc],
        [session ?? task, lab.next()],
        ids.owner,
        /identidad de la tarea cambió/,
      );
    });
  for (const rpc of ["checklist", "transition"])
    it(`${rpc}: inicio recalculado fuera del plan se rechaza por inyección sintética`, async () => {
      const task = await lab.task({
        checklist: [{ id: "only", done: false }],
        status: rpc === "transition" ? "En curso" : "Pendiente",
      });
      await lab.injectMonthGuard(
        rpc === "checklist"
          ? `update public.task_instances set kind='operativa',target=40,unit='facturas' where id='${task}'`
          : `update public.task_instances set status='Pendiente' where id='${task}'`,
      );
      const sql =
        rpc === "checklist"
          ? "select set_checklist_item_reviewed($1,'only',true,null,0,$2)"
          : "select transition_task_reviewed($1,'En curso',null,0,$2)";
      await unchanged(
        sql,
        [task, lab.next()],
        ids.owner,
        /El plan de inicio cambió; vuelva a intentar/,
      );
    });
  it("retiro de membresía mientras espera el guard deniega operación nueva y revierte la inyección", async () => {
    const task = await lab.task();
    // Simulate historical/internal membership removal otherwise protected by FK.
    await lab.db.exec(
      "alter table task_assignments drop constraint assignment_company_member",
    );
    await lab.injectMonthGuard(
      `delete from public.company_memberships where profile_id='${ids.owner}' and company_id='${ids.company}'`,
    );
    await unchanged(
      "select start_task_timer($1,0,$2,false)",
      [task, lab.next()],
      ids.owner,
      /Sin permiso/,
    );
  });
  it("sello FALSE niega RLS y todas las escrituras; TRUE limita empresa y período sin afectar acceso permanente", async () => {
    const task = await lab.task({ kind: "operativa", checklist: twoSteps });
    const otherCompany = await lab.task({ company: ids.otherCompany });
    const otherMonth = await lab.task({ period: "2025-04-01" });
    await lab.actor(ids.boss, "aal2");
    await lab.admin();
    const absence = (
      await lab.first(
        "insert into employee_absences(organization_id,owner_id,replacement_id,kind,starts_on,ends_on,note,approved_by,authorization_sealed) values($1,$2,$3,'licencia',$4::date,$4::date+2,'Unsealed',$5,false) returning id",
        [ids.org, ids.owner, ids.peer, lab.day, ids.boss],
      )
    ).id;
    await lab.db.query(
      "insert into employee_absence_companies values($1,$2,$3)",
      [absence, ids.org, ids.company],
    );
    await lab.actor(ids.peer);
    expect(await lab.rows("select id from task_instances")).toEqual([]);
    for (const sql of [
      "select set_task_wait($1,'Wait',0,$2)",
      "select set_checklist_item_reviewed($1,'b',true,null,0,$2)",
      "select transition_task_reviewed($1,'En curso',null,0,$2)",
      "select start_task_timer($1,0,$2,false)",
      `select record_activity_once($1,'${lab.day}',7,'Ref',$2)`,
    ])
      await unchanged(sql, [task, lab.next()], ids.peer, /Sin permiso/);
    await lab.actor();
    expect(
      (await lab.first("select can_access_instance($1) allowed", [task]))
        .allowed,
    ).toBe(true);
    await lab.admin();
    await lab.db.query(
      "update employee_absences set authorization_sealed=true where id=$1",
      [absence],
    );
    await lab.actor(ids.peer);
    expect(await lab.rows("select id from task_instances order by id")).toEqual(
      [{ id: task }],
    );
    for (const inaccessible of [otherCompany, otherMonth])
      await unchanged(
        "select set_task_wait($1,'Wait',0,$2)",
        [inaccessible, lab.next()],
        ids.peer,
        /Sin permiso/,
      );
    await lab.actor(ids.peer);
    await lab.first(`select record_activity_once($1,'${lab.day}',7,'Ref',$2)`, [
      task,
      lab.next(),
    ]);
  });
  for (const denial of [
    "cancelled",
    "expired",
    "suspended",
    "replacement_membership",
    "owner_membership",
  ])
    it(`cobertura sellada ${denial} deniega lectura y nueva escritura`, async () => {
      const task = await lab.task();
      const absence = await lab.absence(
        ids.owner,
        ids.peer,
        denial === "expired" ? "2025-04-01" : lab.day,
        denial === "expired" ? "2025-04-02" : undefined,
      );
      await lab.admin();
      if (denial === "cancelled")
        await lab.db.query(
          "update employee_absences set cancelled_at=clock_timestamp() where id=$1",
          [absence],
        );
      if (denial === "suspended")
        await lab.db.query("update profiles set active=false where id=$1", [
          ids.peer,
        ]);
      if (denial === "owner_membership")
        await lab.db.exec(
          "alter table task_assignments drop constraint assignment_company_member",
        );
      if (denial.endsWith("membership"))
        await lab.db.query(
          "delete from company_memberships where profile_id=$1 and company_id=$2",
          [denial === "owner_membership" ? ids.owner : ids.peer, ids.company],
        );
      await lab.actor(ids.peer);
      expect(await lab.rows("select id from task_instances")).toEqual([]);
      await unchanged(
        "select set_task_wait($1,'Wait',0,$2)",
        [task, lab.next()],
        ids.peer,
        /Sin permiso/,
      );
    });
  it("replay escalar conserva excepción después de perder permiso; clave nueva es denegada", async () => {
    const task = await lab.task(),
      op = lab.next();
    await lab.actor();
    await lab.first("select set_task_wait($1,'Wait',0,$2)", [task, op]);
    await lab.admin();
    await lab.db.exec(
      "alter table task_assignments drop constraint assignment_company_member",
    );
    await lab.db.query("delete from company_memberships where profile_id=$1", [
      ids.owner,
    ]);
    const before = await lab.capture();
    await lab.actor();
    expect(
      (
        await lab.first("select set_task_wait($1,'Wait',0,$2) revision", [
          task,
          op,
        ])
      ).revision,
    ).toBe(1);
    expect(await lab.capture()).toEqual(before);
    await unchanged(
      "select set_task_wait($1,'Wait',1,$2)",
      [task, lab.next()],
      ids.owner,
      /Sin permiso/,
    );
  });
  for (const mode of [
    "ended_closed",
    "open_closed",
    "suspended",
    "membership_removed",
    "foreign",
  ])
    it(`pausa propia/ajena: ${mode}`, async () => {
      const task = await lab.task({ period: "2025-04-01" });
      const session = await lab.session(
        task,
        ids.owner,
        null,
        "2025-04-01T12:00:00Z",
        mode === "ended_closed" ? "2025-04-01T12:30:00Z" : null,
      );
      if (mode.includes("closed"))
        await lab.db.query(
          "insert into monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values($1,$2,'2025-04-01','{}',$3,'Closed')",
          [ids.org, ids.owner, ids.boss],
        );
      if (mode === "suspended")
        await lab.db.query("update profiles set active=false where id=$1", [
          ids.owner,
        ]);
      if (mode === "membership_removed")
        await lab.db.exec(
          "alter table task_assignments drop constraint assignment_company_member",
        );
      if (mode === "membership_removed")
        await lab.db.query(
          "delete from company_memberships where profile_id=$1",
          [ids.owner],
        );
      if (mode === "open_closed" || mode === "foreign")
        await unchanged(
          "select pause_task_timer($1,$2)",
          [session, lab.next()],
          mode === "foreign" ? ids.peer : ids.owner,
          mode === "foreign" ? /propia no encontrada/ : /cerrado/,
        );
      else {
        const before = await lab.capture();
        await lab.actor();
        await lab.first("select pause_task_timer($1,$2)", [
          session,
          lab.next(),
        ]);
        const event =
          mode === "ended_closed"
            ? null
            : await auditContext("task.timer_paused", session, session);
        if (event) expect(event.details.instance).toBe(task);
        const after = await lab.capture();
        if (mode === "ended_closed") {
          expect(after.task_time_sessions).toEqual(before.task_time_sessions);
          expect(after.audit_events).toEqual(before.audit_events);
        } else
          expect(
            (
              await lab.first(
                "select ended_at from task_time_sessions where id=$1",
                [session],
              )
            ).ended_at,
          ).not.toBeNull();
      }
    });
  for (const cancelled of [false, true])
    it(`NULL desbloquea sin limpiar reloj ajeno ${cancelled ? "cancelado" : "vigente"}`, async () => {
      const task = await lab.task({ period: "2025-04-01" }),
        absence = await lab.absence(
          ids.owner,
          ids.peer,
          "2025-04-01",
          "2025-04-02",
        );
      const session = await lab.session(task, ids.peer, absence);
      if (cancelled)
        await lab.db.query(
          "update employee_absences set cancelled_at='2025-04-02T13:00:00Z' where id=$1",
          [absence],
        );
      await lab.db.query(
        "update task_instances set blocked_by='Bank',blocked_since='2025-04-01' where id=$1",
        [task],
      );
      const before = await lab.capture();
      await lab.actor();
      await lab.first("select set_task_wait($1,null,0,$2)", [task, lab.next()]);
      const after = await lab.capture();
      expect(after.task_time_sessions).toEqual(before.task_time_sessions);
      expect(
        await lab.first(
          "select blocked_by,state_revision from task_instances where id=$1",
          [task],
        ),
      ).toEqual({ blocked_by: null, state_revision: 1 });
      expect(
        (
          await lab.first(
            "select ended_at from task_time_sessions where id=$1",
            [session],
          )
        ).ended_at,
      ).toBeNull();
    });
  it("operativa no autocompleta, auditoría de pausa compara fin real y ACL/DML siguen privados", async () => {
    const task = await lab.task({
      kind: "operativa",
      checklist: [{ id: "only", done: false }],
    });
    await lab.actor();
    await lab.first(
      "select set_checklist_item_reviewed($1,'only',true,null,0,$2)",
      [task, lab.next()],
    );
    await lab.admin();
    expect(
      (await lab.first("select status from task_instances where id=$1", [task]))
        .status,
    ).toBe("En curso");
    const session = (
      await lab.first(
        "select id from task_time_sessions where instance_id=$1 and ended_at is null",
        [task],
      )
    ).id;
    await lab.actor();
    await lab.first("select pause_task_timer($1,$2)", [session, lab.next()]);
    await auditContext("task.timer_paused", session, session);
    const acl = await lab.first(
      "select has_function_privilege('authenticated','public._can_access_instance_at(uuid,timestamptz)','execute') helper,has_function_privilege('anon','public._session_cutoff(uuid)','execute') anon,has_table_privilege('authenticated','public.task_time_sessions','insert,update,delete') dml,has_function_privilege('authenticated','public.can_cover_instance(uuid)','execute') cover",
    );
    expect(acl).toEqual({
      helper: false,
      anon: false,
      dml: false,
      cover: true,
    });
  });
  it("aprobación/cancelación comparten instante exacto y cancelación repetida no modifica historia", async () => {
    const task = await lab.task(),
      absence = await lab.absence();
    await lab.admin();
    expect(
      (
        await lab.first(
          "select a.approved_at=e.at same from employee_absences a join audit_events e on e.entity_id=a.id and e.action='absence.approved' where a.id=$1",
          [absence],
        )
      ).same,
    ).toBe(true);
    await lab.actor(ids.boss, "aal2");
    await lab.first("select cancel_employee_absence($1,'End',$2)", [
      absence,
      lab.next(),
    ]);
    await lab.admin();
    expect(
      (
        await lab.first(
          "select a.cancelled_at=e.at same from employee_absences a join audit_events e on e.entity_id=a.id and e.action='absence.cancelled' where a.id=$1",
          [absence],
        )
      ).same,
    ).toBe(true);
    const before = await lab.capture();
    await lab.actor(ids.boss, "aal2");
    await lab.first("select cancel_employee_absence($1,'Repeat',$2)", [
      absence,
      lab.next(),
    ]);
    const after = await lab.capture();
    expect(after.employee_absences).toEqual(before.employee_absences);
    expect(after.audit_events).toEqual(before.audit_events);
    expect(after.task_instances).toEqual(before.task_instances);
    expect(task).toBeTruthy();
  });
});
