import { describe, expect, it } from "vitest";
import { AccountingLab, ids, stages } from "./helpers/accounting-lab";

// Each upgrade/abort owns a disposable database. Historical rows, not current
// authorization, decide whether old time records are compatible.
async function history(lab: AccountingLab) {
  await lab.admin();
  const data: Record<string, any> = {};
  const tables = await lab.rows(
    "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name",
  );
  for (const { table_name: table } of tables) {
    data[table] = (
      await lab.rows(
        `select to_jsonb(t) row from public.${table} t order by to_jsonb(t)::text`,
      )
    ).map((r) => r.row);
  }
  for (const table of ["monthly_closures", "period_reports"]) {
    if (data[table])
      data[`${table}_snapshot_text`] = await lab.rows(
        `select id,snapshot::text snapshot_text from ${table} order by id`,
      );
  }
  return data;
}
function preserved(before: Record<string, any>, after: Record<string, any>) {
  for (const [table, rows] of Object.entries(before)) {
    expect(after[table], table).toHaveLength(rows.length);
    // Compare every original field; later schema additions have separate asserts.
    const keys = rows.length ? Object.keys(rows[0]) : [];
    const project = (xs: any[]) =>
      xs
        .map((row) => Object.fromEntries(keys.map((key) => [key, row[key]])))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    expect(project(after[table]), table).toEqual(project(rows));
  }
}
async function catalog(lab: AccountingLab) {
  const queries = {
    columns:
      "select table_name,column_name,data_type,column_default,is_nullable from information_schema.columns where table_schema='public' order by table_name,ordinal_position",
    constraints:
      "select c.relname,con.conname,pg_get_constraintdef(con.oid) definition from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,con.conname",
    indexes:
      "select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname",
    functions:
      "select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p') order by signature",
    triggers:
      "select c.relname,t.tgname,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname",
    policies:
      "select * from pg_policies where schemaname='public' order by tablename,policyname",
  };
  const out: Record<string, unknown> = {};
  for (const [key, query] of Object.entries(queries))
    out[key] = await lab.rows(query);
  return out;
}
async function reportHistory(lab: AccountingLab) {
  const closure = lab.next(),
    report = lab.next(),
    delivery = lab.next(),
    outbox = lab.next();
  await lab.admin();
  await lab.db.query(
    'insert into monthly_closures(id,organization_id,owner_id,period,snapshot,closed_by,note) values($1,$2,$3,\'2025-03-01\',\'{"historical":true,"points":5,"tasks":[{"quantity":18,"target":40}]}\',$4,\'Historia\')',
    [closure, ids.org, ids.owner, ids.boss],
  );
  await lab.db.query(
    "insert into period_reports(id,organization_id,closure_id,owner_id,period,snapshot) select $1,organization_id,id,owner_id,period,snapshot from monthly_closures where id=$2",
    [report, closure],
  );
  await lab.db.query(
    "insert into report_deliveries(id,organization_id,report_id,recipient_id,recipient_email) values($1,$2,$3,$4,'boss@example.test')",
    [delivery, ids.org, report, ids.boss],
  );
  await lab.db.query(
    "insert into report_outbox_events(id,organization_id,delivery_id) values($1,$2,$3)",
    [outbox, ids.org, delivery],
  );
}

describe("upgrades poblados hasta 008", () => {
  for (const from of [stages.m004, stages.m005, stages.m006, stages.m007]) {
    it(`${from.slice(9, 12)}→008 conserva todas las filas históricas y snapshots`, async () => {
      const lab = new AccountingLab();
      try {
        await lab.init(from);
        const task = await lab.task({ period: "2025-04-01" });
        const absence = await lab.absence(
          ids.owner,
          ids.peer,
          "2025-04-01",
          "2025-04-10",
          [ids.company, ids.otherCompany],
        );
        await lab.session(
          task,
          ids.peer,
          absence,
          "2025-04-02T12:00:00Z",
          "2025-04-02T12:30:00Z",
        );
        await lab.admin();
        await lab.db.query(
          "delete from company_memberships where profile_id=$1",
          [ids.peer],
        );
        await lab.db.query("update profiles set active=false where id=$1", [
          ids.peer,
        ]);
        const audit = (
          await lab.first(
            'insert into audit_events(organization_id,actor_id,action,entity_id,details) values($1,null,\'task.transition\',$2,\'{"from":"Completada","to":"Pendiente"}\') returning id',
            [ids.org, task],
          )
        ).id;
        await lab.db.query(
          "insert into task_reopen_events(id,organization_id,instance_id,actor_id,reason,source,legacy_audit_id) values($1,$2,$3,null,'Historia','legacy_transition',$4)",
          [lab.next(), ids.org, task, audit],
        );
        await reportHistory(lab);
        const before = await history(lab);
        expect(before.task_mutation_receipts).toHaveLength(1);
        expect(before.employee_absence_companies).toHaveLength(2);
        await lab.migrate(from);
        const after = await history(lab);
        preserved(before, after);
        expect(after.employee_absences[0].authorization_sealed).toBe(true);
        expect(after.task_reopen_events[0].actor_id).toBeNull();
        expect(after.task_time_sessions[0]).toMatchObject({
          actor_id: ids.peer,
          absence_id: absence,
        });
        expect(
          new Date(after.task_time_sessions[0].started_at).toISOString(),
        ).toBe("2025-04-02T12:00:00.000Z");
        expect(
          new Date(after.task_time_sessions[0].ended_at).toISOString(),
        ).toBe("2025-04-02T12:30:00.000Z");
        expect(
          after.company_memberships.filter(
            (r: any) => r.profile_id === ids.peer,
          ),
        ).toHaveLength(0);
        expect(after.profiles.find((r: any) => r.id === ids.peer).active).toBe(
          false,
        );
      } finally {
        await lab.close();
      }
    }, 20000);
  }
  it("0.3→001–008 preserva campos originales y añade contratos sin reescribir cierres", async () => {
    const lab = new AccountingLab();
    try {
      const base = "202609300002_workflows.sql";
      await lab.init(base);
      const template = lab.next(),
        assignment = lab.next(),
        task = lab.next();
      await lab.db.query(
        "insert into task_templates(id,organization_id,title,kind,weight,checklist) values($1,$2,'Conciliación','resultado',5,'[{\"text\":\"Control\"}]')",
        [template, ids.org],
      );
      await lab.db.query(
        "insert into task_assignments(id,organization_id,template_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day,checklist) values($1,$2,$3,$4,$5,$6,'Conciliación','resultado',5,'mensual','2025-04-01',30,'[\"Control\"]')",
        [assignment, ids.org, template, ids.company, ids.owner, ids.team],
      );
      await lab.db.query(
        "insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,title,kind,weight,due_date,checklist) values($1,$2,$3,$4,$5,$6,'2025-04-01','Conciliación','resultado',5,'2025-04-30','[{\"id\":\"kept\",\"text\":\"Control\",\"done\":false}]')",
        [task, ids.org, assignment, ids.company, ids.owner, ids.team],
      );
      await lab.db.query(
        "insert into monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values($1,$2,'2025-02-01','{\"immutable\":true,\"weight\":5}',$3,'0.3')",
        [ids.org, ids.owner, ids.boss],
      );
      const old = await history(lab);
      await lab.migrate(base, stages.m003);
      preserved(old, await history(lab));
      await lab.admin();
      await lab.db.query(
        "insert into task_time_sessions(id,organization_id,instance_id,actor_id,started_at,ended_at) values($1,$2,$3,$4,'2025-04-10T12:00Z','2025-04-10T12:30Z')",
        [lab.next(), ids.org, task, ids.owner],
      );
      const audit = (
        await lab.first(
          'insert into audit_events(organization_id,actor_id,action,entity_id,details) values($1,null,\'task.transition\',$2,\'{"from":"Completada","to":"Pendiente"}\') returning id',
          [ids.org, task],
        )
      ).id;
      await reportHistory(lab);
      const before004 = await history(lab);
      await lab.migrate(stages.m003);
      const after = await history(lab);
      preserved(before004, after);
      expect(after.task_instances[0]).toMatchObject({
        scheduled_on: "2025-04-30",
        due_date: "2025-04-30",
        state_revision: 0,
        checklist: [{ id: "kept", text: "Control", done: false }],
      });
      expect(after.task_template_versions).toHaveLength(1);
      expect(after.task_assignments[0].template_version_id).toBe(
        after.task_template_versions[0].id,
      );
      expect(after.task_instances[0].template_version_id).toBe(
        after.task_template_versions[0].id,
      );
      expect(after.onboarding_requests).toHaveLength(0);
      expect(after.task_reopen_events).toHaveLength(1);
      expect(after.task_reopen_events[0]).toMatchObject({
        actor_id: null,
        legacy_audit_id: audit,
        source: "legacy_transition",
      });
      expect(after.task_time_sessions[0].absence_id).toBeNull();
    } finally {
      await lab.close();
    }
  }, 20000);
});

describe("preflight y rollback de migraciones", () => {
  const cases = [
    {
      from: stages.m003,
      to: stages.m004,
      kind: "multiple",
      message: /Preflight 004: tareas con varios cronómetros activos/,
    },
    ...[stages.m005, stages.m006].flatMap((to) => [
      {
        from: to === stages.m005 ? stages.m004 : stages.m005,
        to,
        kind: "orphan",
        message: new RegExp(
          `Preflight ${to.slice(9, 12)}: auditorías de reapertura`,
        ),
      },
      {
        from: to === stages.m005 ? stages.m004 : stages.m005,
        to,
        kind: "organization",
        message: new RegExp(
          `Preflight ${to.slice(9, 12)}: .*organización incompatible`,
        ),
      },
    ]),
    ...[
      "absence_owner",
      "absence_actor",
      "after_cutoff",
      "before_start",
      "end_after_cutoff",
    ].map((kind) => ({
      from: stages.m005,
      to: stages.m006,
      kind,
      message: /Preflight 006: sesiones incompatibles/,
    })),
  ];
  for (const test of cases) {
    it(`${test.to.slice(9, 12)} rechaza ${test.kind} con ID y revierte filas, DDL, funciones y ACL`, async () => {
      const lab = new AccountingLab();
      try {
        await lab.init(test.from);
        const task = await lab.task({ period: "2025-04-01" });
        let offending: string;
        if (test.kind === "multiple") {
          await lab.admin();
          for (const actor of [ids.owner, ids.peer])
            await lab.db.query(
              "insert into task_time_sessions(organization_id,instance_id,actor_id,started_at) values($1,$2,$3,'2025-04-02T12:00Z')",
              [ids.org, task, actor],
            );
          offending = task;
        } else if (["orphan", "organization"].includes(test.kind)) {
          await lab.admin();
          offending = String(
            (
              await lab.first(
                'insert into audit_events(organization_id,actor_id,action,entity_id,details) values($1,$2,\'task.transition\',$3,\'{"from":"Completada","to":"Pendiente"}\') returning id',
                [
                  ids.org,
                  test.kind === "organization" ? ids.outsider : null,
                  test.kind === "orphan" ? lab.next() : task,
                ],
              )
            ).id,
          );
        } else {
          const absence = await lab.absence(
            test.kind === "absence_owner" ? ids.sourceOwner : ids.owner,
            test.kind === "absence_actor" ? ids.sourceOwner : ids.peer,
            "2025-04-01",
            "2025-04-02",
          );
          offending = await lab.session(
            task,
            ids.peer,
            absence,
            test.kind === "after_cutoff"
              ? "2025-04-03T03:01Z"
              : test.kind === "before_start"
                ? "2025-04-01T02:59Z"
                : "2025-04-02T12:00Z",
          );
          if (test.kind === "end_after_cutoff") {
            // Synthetic corrupt legacy row: disable only the clamp fixture,
            // restore it before applying migration; never relax production SQL.
            await lab.db.exec(
              "alter table task_time_sessions disable trigger task_sessions_clamp_end",
            );
            await lab.db.query(
              "update task_time_sessions set ended_at='2025-04-03T03:01Z' where id=$1",
              [offending],
            );
            await lab.db.exec(
              "alter table task_time_sessions enable trigger task_sessions_clamp_end",
            );
          }
        }
        const before = await history(lab),
          ddl = await catalog(lab);
        let error: unknown;
        try {
          await lab.migrate(test.from, test.to);
        } catch (e) {
          error = e;
          await lab.db.exec("rollback");
        }
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(test.message);
        expect((error as Error).message).toContain(offending);
        expect(await history(lab)).toEqual(before);
        expect(await catalog(lab)).toEqual(ddl);
      } finally {
        await lab.close();
      }
    }, 20000);
  }
});
