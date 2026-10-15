import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AccountingLab, ids, stages, uid } from "./helpers/accounting-lab";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202610140013_api_identity_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);
const context = async (lab: AccountingLab) =>
  (await lab.first("select api.get_context_v1() as context")).context;
const serializedBusinessRows = async (lab: AccountingLab) => {
  const data: Record<string, string[]> = {};
  for (const table of [
    "task_instances",
    "task_time_sessions",
    "employee_absences",
    "employee_absence_companies",
    "audit_events",
    "task_reopen_events",
    "task_mutation_receipts",
    "activity_entries",
    "monthly_closures",
    "period_reports",
    "report_deliveries",
    "report_outbox_events",
  ]) {
    data[table] = (
      await lab.rows(
        `select to_jsonb(t)::text as row_bytes from public.${table} t order by to_jsonb(t)::text`,
      )
    ).map((row) => row.row_bytes);
  }
  return JSON.stringify(data);
};

describe("Supabase M2.1 identity foundation", () => {
  it("migrates an empty database through 013", async () => {
    const lab = new AccountingLab();
    try {
      await lab.db
        .exec(`create role anon; create role authenticated; create role service_role;
        create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
        grant usage on schema auth to authenticated; grant execute on function auth.uid(),auth.jwt() to authenticated;`);
      await lab.migrate("", stages.m013);
      expect(
        await lab.first(
          "select to_regclass('app_private.technical_accounts') as table_name, to_regprocedure('api.get_context_v1()') as endpoint",
        ),
      ).toMatchObject({
        table_name: "app_private.technical_accounts",
        endpoint: "api.get_context_v1()",
      });
      expect(
        await lab.first(
          "select count(*)::int as n from app_private.technical_accounts",
        ),
      ).toEqual({ n: 0 });
      await lab.db.exec(
        "create table app_private.future_table(id integer); create function api.future_function() returns integer language sql as 'select 1'",
      );
      expect(
        await lab.first(`select
        has_table_privilege('anon','app_private.future_table','SELECT') anon_select,
        has_table_privilege('authenticated','app_private.future_table','SELECT') auth_select,
        has_function_privilege('anon','api.future_function()','EXECUTE') anon_execute,
        has_function_privilege('authenticated','api.future_function()','EXECUTE') auth_execute`),
      ).toEqual({
        anon_select: false,
        auth_select: false,
        anon_execute: false,
        auth_execute: false,
      });
    } finally {
      await lab.db.close();
    }
  });

  it("upgrades populated 012 without changing business rows or snapshots", async () => {
    const lab = await new AccountingLab().init(stages.m012);
    try {
      const instance = await lab.task();
      await lab.session(instance);
      const before = await serializedBusinessRows(lab);
      await lab.db.exec(migration);
      expect(await serializedBusinessRows(lab)).toBe(before);
      expect(
        await lab.first(
          "select count(*)::int as n from app_private.technical_accounts",
        ),
      ).toEqual({ n: 0 });
    } finally {
      await lab.db.close();
    }
  });

  it("returns current business role and sorted organization memberships", async () => {
    const lab = await new AccountingLab().init(stages.m013);
    try {
      await lab.actor(ids.owner, "aal1");
      const employee = await context(lab);
      expect(employee).toMatchObject({
        contractVersion: 1,
        principal: {
          kind: "business",
          id: ids.owner,
          role: "empleado",
          teamIds: [ids.team],
          companyIds: [ids.company, ids.otherCompany],
        },
        authentication: { aal: "aal1", requiresMfa: false },
        capabilities: [],
      });

      await lab.actor(ids.manager, "aal1");
      expect(await context(lab)).toMatchObject({
        principal: { role: "encargado" },
        authentication: { requiresMfa: true },
      });
      await lab.actor(ids.boss, "aal1");
      expect(await context(lab)).toMatchObject({
        principal: { role: "jefe" },
        authentication: { requiresMfa: true },
        capabilities: [],
      });
      await lab.actor(ids.boss, "aal2");
      expect(await context(lab)).toMatchObject({
        principal: { role: "jefe" },
        authentication: { requiresMfa: false },
        capabilities: [],
      });
      const beforeCalls = await lab.capture();
      await context(lab);
      expect(await lab.capture()).toEqual(beforeCalls);
    } finally {
      await lab.db.close();
    }
  });

  it("re-reads DB role and memberships for an unchanged JWT", async () => {
    const lab = await new AccountingLab().init(stages.m013);
    try {
      await lab.actor(ids.owner, "aal1");
      expect((await context(lab)).principal.role).toBe("empleado");
      await lab.admin();
      await lab.db.query(
        "update public.profiles set role='encargado' where id=$1",
        [ids.owner],
      );
      await lab.db.query(
        "delete from public.company_memberships where profile_id=$1 and company_id=$2",
        [ids.owner, ids.otherCompany],
      );
      await lab.db.exec("set role authenticated");
      expect(await context(lab)).toMatchObject({
        principal: { role: "encargado", companyIds: [ids.company] },
        authentication: { requiresMfa: true },
      });
    } finally {
      await lab.db.close();
    }
  });

  it("keeps the technical principal outside business profiles and rejects invalid actors", async () => {
    const lab = await new AccountingLab().init(stages.m013);
    const tech = uid(801);
    try {
      await lab.admin();
      await lab.db.query(
        "insert into auth.users(id,email) values($1,'synthetic-maintainer@example.test')",
        [tech],
      );
      await lab.db.query(
        "insert into app_private.technical_accounts(user_id,organization_id,display_name) values($1,$2,' Maintainer Lab ')",
        [tech, ids.org],
      );
      await lab.actor(tech, "aal1");
      expect(await context(lab)).toEqual({
        contractVersion: 1,
        principal: {
          kind: "technical",
          id: tech,
          organizationId: ids.org,
          displayName: "Maintainer Lab",
          role: "maintainer",
        },
        authentication: { aal: "aal1", requiresMfa: true },
        capabilities: [],
      });
      expect(await lab.first("select public.actor_role() as role")).toEqual({
        role: null,
      });
      expect(
        await lab.first(
          "select count(*)::int as n from public.profiles where id=$1",
          [tech],
        ),
      ).toEqual({ n: 0 });

      await lab.actor(ids.owner, "aal1", "service_role");
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await lab.actor(ids.owner, "aal1", "anon");
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await lab.actor(ids.owner, "aal1", "");
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await lab.actor(ids.owner, "aal3");
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await lab.actor("", "aal1");
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await lab.actor(ids.owner, "aal1");
      await lab.admin();
      await lab.db.query(
        "update public.profiles set role='auditor' where id=$1",
        [ids.owner],
      );
      await lab.actor(ids.owner, "aal2");
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
    } finally {
      await lab.db.close();
    }
  });

  it("denies inactive, missing, and malformed display-name principals", async () => {
    const lab = await new AccountingLab().init(stages.m013);
    try {
      await lab.actor(ids.owner);
      await lab.admin();
      await lab.db.query("update public.profiles set name='  ' where id=$1", [
        ids.owner,
      ]);
      await lab.actor(ids.owner);
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await lab.admin();
      const inactiveTechnical = uid(806);
      await lab.db.query(
        "insert into auth.users(id,email) values($1,'inactive-maintainer@example.test')",
        [inactiveTechnical],
      );
      await lab.db.query(
        "insert into app_private.technical_accounts(user_id,organization_id,display_name,active) values($1,$2,'Inactive',false)",
        [inactiveTechnical, ids.org],
      );
      await lab.actor(inactiveTechnical, "aal2");
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await lab.admin();
      await lab.db.query(
        "update public.profiles set name=repeat('x',201) where id=$1",
        [ids.owner],
      );
      await lab.actor(ids.owner);
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await lab.admin();
      await lab.db.query(
        "update public.profiles set active=false where id=$1",
        [ids.owner],
      );
      await lab.actor(ids.owner);
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await lab.actor(uid(999));
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
    } finally {
      await lab.db.close();
    }
  });

  it("rejects cross-table identity reuse for inserts, updates, and inactive rows", async () => {
    const lab = await new AccountingLab().init(stages.m013);
    const tech = uid(802);
    try {
      await lab.admin();
      await lab.db.query(
        "insert into auth.users(id,email) values($1,'synthetic-dual@example.test')",
        [tech],
      );
      await lab.db.query(
        "insert into app_private.technical_accounts(user_id,organization_id,display_name,active) values($1,$2,'Inactive maintainer',false)",
        [tech, ids.org],
      );
      await expect(
        lab.db.query(
          "insert into public.profiles(id,organization_id,name,role,sector,branch,position) values($1,$2,'Conflict','empleado','x','x','x')",
          [tech, ids.org],
        ),
      ).rejects.toMatchObject({ code: "23514" });

      const secondTech = uid(803);
      await lab.db.query(
        "insert into auth.users(id,email) values($1,'synthetic-dual2@example.test')",
        [secondTech],
      );
      await lab.db.query(
        "insert into public.profiles(id,organization_id,name,role,sector,branch,position) values($1,$2,'Conflict','empleado','x','x','x')",
        [secondTech, ids.org],
      );
      await expect(
        lab.db.query(
          "insert into app_private.technical_accounts(user_id,organization_id,display_name) values($1,$2,'Conflict')",
          [secondTech, ids.org],
        ),
      ).rejects.toMatchObject({ code: "23514" });

      const thirdTech = uid(804);
      await lab.db.query(
        "insert into auth.users(id,email) values($1,'synthetic-dual3@example.test')",
        [thirdTech],
      );
      await lab.db.query(
        "insert into app_private.technical_accounts(user_id,organization_id,display_name) values($1,$2,'Conflict')",
        [thirdTech, ids.org],
      );
      await expect(
        lab.db.query("update public.profiles set id=$1 where id=$2", [
          thirdTech,
          ids.owner,
        ]),
      ).rejects.toMatchObject({ code: "23514" });

      const fourthTech = uid(805);
      await lab.db.query(
        "insert into auth.users(id,email) values($1,'synthetic-dual4@example.test')",
        [fourthTech],
      );
      await lab.db.query(
        "insert into app_private.technical_accounts(user_id,organization_id,display_name) values($1,$2,'Conflict')",
        [fourthTech, ids.org],
      );
      await expect(
        lab.db.query(
          "update app_private.technical_accounts set user_id=$1 where user_id=$2",
          [ids.peer, fourthTech],
        ),
      ).rejects.toMatchObject({ code: "23514" });

      await expect(
        lab.db.query("select * from app_private.technical_accounts"),
      ).resolves.toBeDefined();
      const functionAcl = await lab.first(`select
        has_function_privilege('anon','api.get_context_v1()','EXECUTE') anon_exec,
        has_function_privilege('authenticated','api.get_context_v1()','EXECUTE') auth_exec,
        has_function_privilege('service_role','api.get_context_v1()','EXECUTE') service_exec,
        has_table_privilege('authenticated','app_private.technical_accounts','SELECT') auth_select,
        has_table_privilege('anon','app_private.technical_accounts','INSERT') anon_insert,
        has_schema_privilege('anon','app_private','USAGE') anon_private_usage,
        has_schema_privilege('authenticated','app_private','USAGE') auth_private_usage,
        has_schema_privilege('authenticated','api','USAGE') auth_api_usage,
        has_schema_privilege('anon','public','CREATE') anon_public_create,
        has_schema_privilege('authenticated','public','CREATE') auth_public_create,
        exists(select 1 from pg_catalog.pg_proc p cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a where p.oid='api.get_context_v1()'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE') public_exec`);
      expect(functionAcl).toEqual({
        anon_exec: false,
        auth_exec: true,
        service_exec: false,
        auth_select: false,
        anon_insert: false,
        anon_private_usage: false,
        auth_private_usage: false,
        auth_api_usage: true,
        anon_public_create: false,
        auth_public_create: false,
        public_exec: false,
      });
      await lab.actor(ids.owner);
      await expect(
        lab.first("select * from app_private.technical_accounts"),
      ).rejects.toBeDefined();
      await expect(
        lab.first(
          "insert into app_private.technical_accounts(user_id,organization_id,display_name) values($1,$2,'nope')",
          [ids.owner, ids.org],
        ),
      ).rejects.toBeDefined();
    } finally {
      await lab.db.close();
    }
  });
});
