import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

export const migrationRoot = new URL(
  "../../supabase/migrations/",
  import.meta.url,
);
export const migrationNames = readdirSync(migrationRoot)
  .filter((f) => f.endsWith(".sql"))
  .sort();
export const stages = {
  foundation: "202609300001_foundation.sql",
  m003: "202610010003_report_delivery.sql",
  m004: "202610010004_time_coverage.sql",
  m005: "202610010005_time_coverage_hardening.sql",
  m006: "202610010006_time_coverage_acceptance.sql",
  m007: "202610010007_time_coverage_completion.sql",
  m008: "202610010008_time_coverage_finalization.sql",
  m009: "202610020009_private_block_notes.sql",
  m010: "202610040010_coordination_foundation.sql",
  m011: "202610060011_coordination_activation.sql",
  m012: "202610140012_sql_receipt_and_onboarding_guards.sql",
  m013: "202610140013_api_identity_foundation.sql",
};
export const uid = (n: number) =>
  `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
export const ids = {
  org: uid(1),
  boss: uid(2),
  manager: uid(3),
  owner: uid(4),
  peer: uid(5),
  sourceOwner: uid(6),
  company: uid(7),
  otherCompany: uid(8),
  team: uid(9),
  otherOrg: uid(10),
  outsider: uid(11),
};
export const authSchema = `create role anon; create role authenticated; create role service_role;
create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
grant usage on schema auth to authenticated; grant execute on function auth.uid(),auth.jwt() to authenticated;`;
// Synthetic SQL rows are asserted by the caller. No network, live Auth or mail.
export class AccountingLab {
  db = new PGlite();
  serial = 100;
  period = "";
  day = "";
  next() {
    return uid(++this.serial);
  }
  async rows(
    sql: string,
    args: unknown[] = [],
  ): Promise<Record<string, any>[]> {
    return (await this.db.query<Record<string, any>>(sql, args)).rows;
  }
  async first(sql: string, args: unknown[] = []) {
    return (await this.rows(sql, args))[0];
  }
  async admin() {
    await this.db.exec("reset role");
  }
  async actor(actorId = ids.owner, aal = "aal1", tokenRole = "authenticated") {
    await this.admin();
    await this.db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
      [actorId, JSON.stringify({ aal, role: tokenRole })],
    );
    await this.db.exec("set role authenticated");
  }
  async migrate(from = "", to = stages.m008) {
    await this.admin();
    await this.db.exec(
      "select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims','{}',false)",
    );
    for (const f of migrationNames.filter((f) => f > from && f <= to))
      await this.db.exec(readFileSync(new URL(f, migrationRoot), "utf8"));
  }
  async init(to = stages.m008) {
    await this.db.exec(authSchema);
    await this.migrate("", to);
    const calendar = await this.first(
      "select (now() at time zone 'America/Argentina/Buenos_Aires')::date::text as work_day,date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date::text period",
    );
    this.day = calendar.work_day;
    this.period = calendar.period;
    await this.db.query(
      "insert into organizations values($1,'Lab'),($2,'Other')",
      [ids.org, ids.otherOrg],
    );
    for (const [id, org, role, manager] of [
      [ids.boss, ids.org, "jefe", null],
      [ids.manager, ids.org, "encargado", ids.boss],
      [ids.owner, ids.org, "empleado", ids.manager],
      [ids.peer, ids.org, "empleado", ids.boss],
      [ids.sourceOwner, ids.org, "empleado", ids.boss],
      [ids.outsider, ids.otherOrg, "jefe", null],
    ]) {
      await this.db.query("insert into auth.users values($1,$2,now())", [
        id,
        `${id}@example.test`,
      ]);
      await this.db.query(
        "insert into profiles(id,organization_id,name,role,manager_id,sector,branch,position) values($1,$2,$3,$4,$5,'Contabilidad','Lab','Test')",
        [id, org, role, role, manager],
      );
    }
    await this.db.query("insert into companies values($1,$3,'A'),($2,$3,'B')", [
      ids.company,
      ids.otherCompany,
      ids.org,
    ]);
    await this.db.query("insert into teams values($1,$2,'Team',$3)", [
      ids.team,
      ids.org,
      ids.manager,
    ]);
    for (const profile of [ids.owner, ids.peer, ids.sourceOwner, ids.manager]) {
      await this.db.query("insert into team_members values($1,$2,$3)", [
        ids.org,
        ids.team,
        profile,
      ]);
      for (const company of [ids.company, ids.otherCompany])
        await this.db.query(
          "insert into company_memberships values($1,$2,$3)",
          [ids.org, company, profile],
        );
    }
    if (to >= stages.m003)
      await this.db.query(
        "insert into report_settings(organization_id,recipient_id,updated_by) values($1,$2,$2)",
        [ids.org, ids.boss],
      );
    return this;
  }
  async task(
    opts: {
      owner?: string;
      company?: string;
      period?: string;
      kind?: string;
      checklist?: unknown[];
      status?: string;
    } = {},
  ) {
    await this.admin();
    const assignment = this.next(),
      instance = this.next();
    const owner = opts.owner ?? ids.owner,
      company = opts.company ?? ids.company;
    const period = opts.period ?? this.period,
      kind = opts.kind ?? "resultado";
    const checklist = JSON.stringify(opts.checklist ?? []),
      status = opts.status ?? "Pendiente";
    await this.db.query(
      "insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day,unit,target,checklist) values($1,$2,$3,$4,$5,'Task', $6,5,'mensual',$7,15,$8,$9,$10::jsonb)",
      [
        assignment,
        ids.org,
        company,
        owner,
        ids.team,
        kind,
        period,
        kind === "operativa" ? "facturas" : null,
        kind === "operativa" ? 40 : null,
        checklist,
      ],
    );
    await this.db.query(
      "insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status,completed_at) values($1,$2,$3,$4,$5,$6,$7,$7,'Task',$8,5,null,$9,$10,$11::jsonb,$12,case when $12='Completada' then now() else null end)",
      [
        instance,
        ids.org,
        assignment,
        company,
        owner,
        ids.team,
        period,
        kind,
        kind === "operativa" ? "facturas" : null,
        kind === "operativa" ? 40 : null,
        checklist,
        status,
      ],
    );
    return instance;
  }
  async absence(
    owner = ids.owner,
    replacement: string | null = ids.peer,
    starts = this.day,
    ends?: string,
    companies = [ids.company],
  ) {
    await this.actor(ids.boss, "aal2");
    return (
      await this.first(
        "select approve_employee_absence($1,$2,'licencia',$3,coalesce($4::date,$3::date+2),$5::uuid[],'Lab',$6) id",
        [owner, replacement, starts, ends ?? null, companies, this.next()],
      )
    ).id as string;
  }
  async session(
    instance: string,
    actor = ids.owner,
    absence: string | null = null,
    started = "2025-04-01T12:00:00Z",
    ended: string | null = null,
  ) {
    await this.admin();
    return (
      await this.first(
        "insert into task_time_sessions(id,organization_id,instance_id,actor_id,started_at,ended_at,absence_id) values($1,$2,$3,$4,$5,$6,$7) returning id",
        [this.next(), ids.org, instance, actor, started, ended, absence],
      )
    ).id as string;
  }
  async capture() {
    await this.admin();
    const data: Record<string, unknown> = {};
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
      data[table] = await this.rows(
        `select to_jsonb(t) row from public.${table} t order by to_jsonb(t)::text`,
      );
    }
    return data;
  }
  async expectError(sql: string, args: unknown[], pattern: RegExp) {
    await this.db.exec("savepoint expected_failure");
    let error: unknown;
    try {
      await this.db.query(sql, args);
    } catch (e) {
      error = e;
    }
    await this.db.exec(
      "rollback to savepoint expected_failure;release savepoint expected_failure",
    );
    if (!(error instanceof Error) || !pattern.test(error.message))
      throw new Error(
        `Expected ${pattern}, observed ${error instanceof Error ? error.message : "success"}`,
      );
  }
  async injectMonthGuard(sql: string) {
    await this.admin();
    const def = (
      await this.first(
        "select pg_get_functiondef('public.lock_open_month(uuid,date)'::regprocedure) definition",
      )
    ).definition as string;
    await this.db.exec(
      def.replace(/\bbegin\b/i, (match) => `${match}\n${sql};\n`),
    );
  }
  async close() {
    await this.db.close();
  }
}
