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
const apiActor = async (
  lab: AccountingLab,
  actorId = ids.owner,
  aal = "aal1",
  role = "authenticated",
) => lab.actor(actorId, aal, role);
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
    "task_private_block_notes",
    "task_private_block_note_versions",
    "private_block_note_receipts",
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
      await lab.migrate("", stages.m012);
      const publicFunctionAclBefore =
        await lab.rows(`select p.oid::regprocedure::text signature,coalesce(p.proacl::text,'<default>') acl
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1`);
      await lab.migrate(stages.m012, stages.m013);
      expect(
        await lab.rows(`select p.oid::regprocedure::text signature,coalesce(p.proacl::text,'<default>') acl
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1`),
      ).toEqual(publicFunctionAclBefore);
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
        "create table app_private.future_table(id integer); create function api.future_function() returns integer language sql as 'select 1'; create function app_private.future_function() returns integer language sql as 'select 1'",
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
      const access = await lab.first(`select
        (select relrowsecurity from pg_class where oid='app_private.principal_identity_fences'::regclass) rls,
        (select count(*)::int from pg_policies where schemaname='app_private') policies,
        has_function_privilege('authenticated','api.get_context_v1()','EXECUTE') endpoint_auth,
        has_function_privilege('anon','api.get_context_v1()','EXECUTE') endpoint_anon,
        has_function_privilege('service_role','api.get_context_v1()','EXECUTE') endpoint_service`);
      expect(access).toMatchObject({
        rls: true,
        policies: 0,
        endpoint_auth: true,
        endpoint_anon: false,
        endpoint_service: false,
      });
      for (const role of ["anon", "authenticated", "service_role"]) {
        for (const privilege of [
          "SELECT",
          "INSERT",
          "UPDATE",
          "DELETE",
          "TRUNCATE",
          "REFERENCES",
        ]) {
          expect(
            await lab.first(
              "select has_table_privilege($1,'app_private.principal_identity_fences',$2) allowed",
              [role, privilege],
            ),
          ).toEqual({ allowed: false });
          expect(
            await lab.first(
              "select has_table_privilege($1,'app_private.technical_accounts',$2) allowed",
              [role, privilege],
            ),
          ).toEqual({ allowed: false });
          expect(
            await lab.first(
              "select has_table_privilege($1,'app_private.future_table',$2) allowed",
              [role, privilege],
            ),
          ).toEqual({ allowed: false });
        }
        for (const fn of [
          "app_private.normalize_context_name(text)",
          "app_private.guard_principal_identity()",
        ])
          expect(
            await lab.first(
              "select has_function_privilege($1,$2,'EXECUTE') allowed",
              [role, fn],
            ),
          ).toEqual({ allowed: false });
        expect(
          await lab.first(
            "select has_function_privilege($1,'app_private.future_function()','EXECUTE') allowed",
            [role],
          ),
        ).toEqual({ allowed: false });
      }
    } finally {
      await lab.db.close();
    }
  });

  it("upgrades populated 012 without changing business rows or snapshots", async () => {
    const lab = await new AccountingLab().init(stages.m012);
    try {
      const deliverable = await lab.task({
        kind: "resultado",
        status: "Completada",
      });
      const operational = await lab.task({ kind: "operativa" });
      await lab.session(
        deliverable,
        ids.owner,
        null,
        `${lab.period}T12:00:00Z`,
        `${lab.period}T12:00:20Z`,
      );
      await lab.actor(ids.owner, "aal1", "authenticated");
      await lab.first(
        "select record_activity_once($1,$2::date,3,'Movimiento previo a 013',$3)",
        [operational, lab.day, lab.next()],
      );
      const noteOperation = lab.next();
      const note = (
        await lab.first(
          "select save_private_block_note($1,'Nota histórica privada',0,$2) as result",
          [deliverable, noteOperation],
        )
      ).result;
      await lab.first(
        "select save_private_block_note($1,'Nota histórica editada',1,$2) as result",
        [deliverable, lab.next()],
      );
      await lab.actor(ids.boss, "aal2", "authenticated");
      await lab.first(
        "select close_employee_month($1,$2::date,'Revisión previa a 013')",
        [ids.owner, lab.period],
      );
      await lab.admin();
      const requiredCounts = await lab.first(`select
        (select count(*)::int from task_instances) tasks,
        (select count(*)::int from task_time_sessions where ended_at is not null) finished_sessions,
        (select count(*)::int from task_mutation_receipts) receipts,
        (select count(*)::int from activity_entries) activities,
        (select count(*)::int from task_private_block_note_versions) note_versions,
        (select count(*)::int from monthly_closures) closures,
        (select count(*)::int from period_reports) reports,
        (select count(*)::int from report_outbox_events) outbox`);
      expect(Object.values(requiredCounts).every((count) => count > 0)).toBe(
        true,
      );
      const before = await serializedBusinessRows(lab);
      const snapshotsBefore = await lab.rows(
        "select snapshot::text from period_reports order by id",
      );
      await lab.db.exec(migration);
      expect(await serializedBusinessRows(lab)).toBe(before);
      expect(
        await lab.rows("select snapshot::text from period_reports order by id"),
      ).toEqual(snapshotsBefore);
      expect(
        await lab.first(
          "select count(*)::int as n from app_private.technical_accounts",
        ),
      ).toEqual({ n: 0 });
      expect(note.note_id).toBeTruthy();
    } finally {
      await lab.db.close();
    }
  });

  it("returns current business role and sorted organization memberships", async () => {
    const lab = await new AccountingLab().init(stages.m013);
    try {
      await apiActor(lab, ids.owner, "aal1");
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

      await apiActor(lab, ids.manager, "aal1");
      expect(await context(lab)).toMatchObject({
        principal: { role: "encargado" },
        authentication: { requiresMfa: true },
      });
      await apiActor(lab, ids.boss, "aal1");
      expect(await context(lab)).toMatchObject({
        principal: { role: "jefe" },
        authentication: { requiresMfa: true },
        capabilities: [],
      });
      await apiActor(lab, ids.boss, "aal2");
      expect(await context(lab)).toMatchObject({
        principal: { role: "jefe" },
        authentication: { requiresMfa: false },
        capabilities: [],
      });
      const beforeCalls = await lab.capture();
      await apiActor(lab, ids.owner, "aal1");
      await context(lab);
      expect(await lab.capture()).toEqual(beforeCalls);
    } finally {
      await lab.db.close();
    }
  });

  it("re-reads DB role and memberships for an unchanged JWT", async () => {
    const lab = await new AccountingLab().init(stages.m013);
    try {
      await apiActor(lab, ids.owner, "aal1");
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
      await apiActor(lab, tech, "aal1");
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

      await apiActor(lab, ids.owner, "aal1", "service_role");
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await apiActor(lab, ids.owner, "aal1", "anon");
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await apiActor(lab, ids.owner, "aal1", "");
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await apiActor(lab, ids.owner, "aal3");
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await apiActor(lab, "", "aal1");
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await apiActor(lab, ids.owner, "aal1");
      await lab.admin();
      await lab.db.query(
        "update public.profiles set role='auditor' where id=$1",
        [ids.owner],
      );
      await apiActor(lab, ids.owner, "aal2");
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
    } finally {
      await lab.db.close();
    }
  });

  it("denies inactive, missing, and malformed display-name principals", async () => {
    const lab = await new AccountingLab().init(stages.m013);
    try {
      await apiActor(lab, ids.owner);
      await lab.admin();
      await lab.db.query("update public.profiles set name='  ' where id=$1", [
        ids.owner,
      ]);
      await apiActor(lab, ids.owner);
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
      await apiActor(lab, inactiveTechnical, "aal2");
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await lab.admin();
      await lab.db.query(
        "update public.profiles set name=repeat('x',201) where id=$1",
        [ids.owner],
      );
      await apiActor(lab, ids.owner);
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await lab.admin();
      await lab.db.query(
        "update public.profiles set active=false where id=$1",
        [ids.owner],
      );
      await apiActor(lab, ids.owner);
      await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      await apiActor(lab, uid(999));
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
      await apiActor(lab, ids.owner);
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

  it("denies every corrupted dual-principal active-state combination", async () => {
    const lab = await new AccountingLab().init(stages.m013);
    try {
      for (const [index, profileActive, technicalActive] of [
        [1, true, true],
        [2, true, false],
        [3, false, true],
        [4, false, false],
      ] as const) {
        const actorId = uid(850 + index);
        await lab.admin();
        await lab.db.query("insert into auth.users(id,email) values($1,$2)", [
          actorId,
          `dual-${index}@example.test`,
        ]);
        await lab.db.exec(
          "alter table public.profiles disable trigger profiles_principal_identity_guard; alter table app_private.technical_accounts disable trigger technical_accounts_principal_identity_guard",
        );
        await lab.db.query(
          "insert into public.profiles(id,organization_id,name,role,sector,branch,position,active) values($1,$2,'Corrupted pair','empleado','Test','Test','Test',$3)",
          [actorId, ids.org, profileActive],
        );
        await lab.db.query(
          "insert into app_private.technical_accounts(user_id,organization_id,display_name,active) values($1,$2,'Corrupted pair',$3)",
          [actorId, ids.org, technicalActive],
        );
        await lab.db.exec(
          "alter table public.profiles enable trigger profiles_principal_identity_guard; alter table app_private.technical_accounts enable trigger technical_accounts_principal_identity_guard",
        );
        await apiActor(lab, actorId, "aal1");
        await expect(context(lab)).rejects.toMatchObject({ code: "42501" });
      }
    } finally {
      await lab.close();
    }
  }, 60_000);

  it("rolls back identity fences when a later trigger aborts an insert or UUID update", async () => {
    const lab = await new AccountingLab().init(stages.m013);
    const inserted = uid(880),
      updated = uid(881),
      sourceProfile = uid(882);
    try {
      await lab.admin();
      await lab.db.query(
        "insert into auth.users(id,email) values($1,'rollback-insert@example.test'),($2,'rollback-update@example.test'),($3,'rollback-source@example.test')",
        [inserted, updated, sourceProfile],
      );
      await lab.db.query(
        "insert into public.profiles(id,organization_id,name,role,sector,branch,position) values($1,$2,'Rollback source','empleado','x','x','x')",
        [sourceProfile, ids.org],
      );
      await lab.db
        .exec(`create function app_private.reject_identity_write() returns trigger language plpgsql as $$begin raise exception 'synthetic later failure'; end$$;
        create trigger reject_identity_write after insert or update of id on public.profiles for each row execute function app_private.reject_identity_write();`);
      await expect(
        lab.db.query(
          "insert into public.profiles(id,organization_id,name,role,sector,branch,position) values($1,$2,'Rollback','empleado','x','x','x')",
          [inserted, ids.org],
        ),
      ).rejects.toThrow(/synthetic later failure/);
      expect(
        await lab.first(
          "select exists(select 1 from public.profiles where id=$1) principal,exists(select 1 from app_private.principal_identity_fences where user_id=$1) fence",
          [inserted],
        ),
      ).toEqual({ principal: false, fence: false });
      await lab.db.exec(
        "drop trigger reject_identity_write on public.profiles; drop function app_private.reject_identity_write()",
      );
      await lab.db
        .exec(`create function app_private.reject_identity_update() returns trigger language plpgsql as $$begin raise exception 'synthetic later failure'; end$$;
        create trigger reject_identity_update after update of id on public.profiles for each row execute function app_private.reject_identity_update();`);
      await expect(
        lab.db.query("update public.profiles set id=$1 where id=$2", [
          updated,
          sourceProfile,
        ]),
      ).rejects.toThrow(/synthetic later failure/);
      expect(
        await lab.first("select id from public.profiles where id=$1", [
          sourceProfile,
        ]),
      ).toEqual({ id: sourceProfile });
      expect(
        await lab.first(
          "select exists(select 1 from app_private.principal_identity_fences where user_id=$1) fence",
          [updated],
        ),
      ).toEqual({ fence: false });
    } finally {
      await lab.close();
    }
  }, 60_000);
});
