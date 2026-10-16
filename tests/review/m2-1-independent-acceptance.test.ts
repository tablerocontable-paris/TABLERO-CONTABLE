import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { AccountingLab, ids, stages, uid } from "../helpers/accounting-lab";
import { decodeContextV1 } from "../../src/data/supabase/context-contract";

async function publicBytes(lab: AccountingLab) {
  await lab.admin();
  const result: Record<string, string[]> = {};
  for (const { tablename } of await lab.rows(
    "select tablename from pg_tables where schemaname='public' order by tablename",
  )) {
    const identifier = `"${tablename.replaceAll('"', '""')}"`;
    result[tablename] = (
      await lab.rows(
        `select to_jsonb(t)::text bytes from public.${identifier} t order by to_jsonb(t)::text`,
      )
    ).map((r) => r.bytes);
  }
  return result;
}

describe("M2.1 independent acceptance 2026-10-15", () => {
  let lab: AccountingLab;
  beforeAll(async () => {
    lab = await new AccountingLab().init(stages.m013);
  }, 60_000);
  beforeEach(async () => {
    await lab.admin();
    await lab.db.exec("begin");
  });
  afterEach(async () => {
    await lab.admin();
    await lab.db.exec("rollback");
  });
  afterAll(async () => {
    await lab.close();
  });

  it("matches the complete ECMAScript trim set and decodes every valid SQL result", async () => {
    const whitespace =
      "\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";
    for (const char of whitespace) {
      await lab.admin();
      await lab.db.query("update profiles set name=$1 where id=$2", [
        char + "😀 París" + char,
        ids.owner,
      ]);
      await lab.actor(ids.owner, "aal1", "authenticated");
      const value = (await lab.first("select api.get_context_v1() result"))
        .result;
      expect(decodeContextV1(value)).toEqual({ ok: true, context: value });
      expect(value.principal.displayName).toBe("😀 París");
    }
    await lab.admin();
    await lab.db.query("update profiles set name=$1 where id=$2", [
      whitespace,
      ids.owner,
    ]);
    await lab.actor(ids.owner, "aal1", "authenticated");
    await lab.expectError(
      "select api.get_context_v1()",
      [],
      /Contexto no disponible/,
    );
    await lab.admin();
    await lab.db.query("update profiles set name=$1 where id=$2", [
      "\u0085París\u0085",
      ids.owner,
    ]);
    await lab.actor(ids.owner, "aal1", "authenticated");
    expect(
      (await lab.first("select api.get_context_v1() result")).result.principal
        .displayName,
    ).toBe("\u0085París\u0085");
  });

  it("rejects technical blank/overlong names and accepts 200 Unicode code points", async () => {
    const tech = uid(905);
    await lab.db.query("insert into auth.users(id) values($1)", [tech]);
    for (const name of ["\t\n\u00a0\ufeff", "😀".repeat(201)])
      await lab.expectError(
        "insert into app_private.technical_accounts(user_id,organization_id,display_name) values($1,$2,$3)",
        [tech, ids.org, name],
        /check constraint/,
      );
    expect(
      await lab.first(
        "select count(*)::int n from app_private.principal_identity_fences where user_id=$1",
        [tech],
      ),
    ).toEqual({ n: 0 });
    await lab.db.query(
      "insert into app_private.technical_accounts(user_id,organization_id,display_name) values($1,$2,$3)",
      [tech, ids.org, "\ufeff" + "😀".repeat(200) + "\t"],
    );
    const before = await lab.capture();
    await lab.actor(tech, "aal2", "authenticated");
    const value = (await lab.first("select api.get_context_v1() result"))
      .result;
    expect(decodeContextV1(value)).toEqual({ ok: true, context: value });
    expect(value.principal.displayName).toBe("😀".repeat(200));
    expect(await lab.capture()).toEqual(before);
  });

  it("denies an inactive principal without refreshing JWT and ignores metadata roles", async () => {
    await lab.actor(ids.owner, "aal1", "authenticated");
    await lab.db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({
        aal: "aal1",
        role: "authenticated",
        user_metadata: { role: "jefe", organizationId: ids.otherOrg },
      }),
    ]);
    expect(
      (await lab.first("select api.get_context_v1() result")).result.principal,
    ).toMatchObject({
      id: ids.owner,
      role: "empleado",
      organizationId: ids.org,
    });
    await lab.admin();
    await lab.db.query("update profiles set active=false where id=$1", [
      ids.owner,
    ]);
    await lab.db.exec("set role authenticated");
    await lab.expectError(
      "select api.get_context_v1()",
      [],
      /Contexto no disponible/,
    );
  });

  it("has no PUBLIC helper execution or private-table grants and closes future objects", async () => {
    expect(
      await lab.first(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where n.nspname in ('api','app_private') and a.grantee=0 and a.privilege_type='EXECUTE'`),
    ).toEqual({ n: 0 });
    expect(
      await lab.rows(
        "select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app_private' and c.relkind='r' order by relname",
      ),
    ).toEqual([
      { relname: "principal_identity_fences", relrowsecurity: true },
      { relname: "technical_accounts", relrowsecurity: true },
    ]);
    await lab.db.exec(
      "create table app_private.review_default(id integer); create function api.review_default() returns integer language sql as 'select 1'; create function app_private.review_default() returns integer language sql as 'select 1'",
    );
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect(
        await lab.first(
          "select has_table_privilege($1,'app_private.review_default','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') allowed",
          [role],
        ),
      ).toEqual({ allowed: false });
      for (const signature of [
        "api.review_default()",
        "app_private.review_default()",
      ])
        expect(
          await lab.first(
            "select has_function_privilege($1,$2,'EXECUTE') allowed",
            [role, signature],
          ),
        ).toEqual({ allowed: false });
    }
  });
});

it("M2.1 upgrade preserves every public table and literal closure/report snapshots", async () => {
  const lab = await new AccountingLab().init(stages.m012);
  try {
    const task = await lab.task({ status: "Completada" });
    const operation = await lab.task({ kind: "operativa" });
    await lab.session(
      task,
      ids.owner,
      null,
      `${lab.period}T12:00:00Z`,
      `${lab.period}T12:00:30Z`,
    );
    await lab.actor(ids.owner);
    await lab.first(
      "select record_activity_once($1,$2::date,7,'Synthetic prior movement',$3)",
      [operation, lab.day, lab.next()],
    );
    await lab.first(
      "select save_private_block_note($1,'Synthetic private history',0,$2)",
      [task, lab.next()],
    );
    await lab.first(
      "select save_private_block_note($1,'Synthetic edited history',1,$2)",
      [task, lab.next()],
    );
    await lab.actor(ids.boss, "aal2");
    await lab.first(
      "select close_employee_month($1,$2::date,'Synthetic prior review')",
      [ids.owner, lab.period],
    );
    const before = await publicBytes(lab);
    for (const table of [
      "task_assignments",
      "task_instances",
      "task_time_sessions",
      "task_mutation_receipts",
      "activity_entries",
      "task_private_block_notes",
      "task_private_block_note_versions",
      "private_block_note_receipts",
      "monthly_closures",
      "period_reports",
      "report_deliveries",
      "report_outbox_events",
    ])
      expect(
        before[table].length,
        `${table} must be populated`,
      ).toBeGreaterThan(0);
    const snapshots = await lab.rows(
      "select 'closure' kind,id,snapshot::text bytes from monthly_closures union all select 'report',id,snapshot::text from period_reports order by kind,id",
    );
    await lab.migrate(stages.m012, stages.m013);
    expect(await publicBytes(lab)).toEqual(before);
    expect(
      await lab.rows(
        "select 'closure' kind,id,snapshot::text bytes from monthly_closures union all select 'report',id,snapshot::text from period_reports order by kind,id",
      ),
    ).toEqual(snapshots);
  } finally {
    await lab.close();
  }
}, 60_000);
