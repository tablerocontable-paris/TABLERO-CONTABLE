// Independent native PostgreSQL review. Synthetic data, fresh cluster, loopback only.
// Exit 1 means contract findings; exit 2 means the harness could not complete.
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { decodeContextV1 } from "../../src/data/supabase/context-contract.ts";
import { decodeCommandResponseV1, decodeQueryResponseV1 } from "../../src/data/supabase/operational-contract.ts";

const flags = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((a, v, i, all) => (i % 2 ? a : [...a, [v, all[i + 1]]]), []),
);
const m2aIsolation = flags["--m2-2a-isolation"] === "rr"
  ? "repeatable read"
  : "read committed";
if (flags["--m2-2a-isolation"] && flags["--m2-2a-isolation"] !== "rr" && flags["--m2-2a-isolation"] !== "rc")
  throw Error("--m2-2a-isolation must be rc or rr");
const parseM2aIsolation = (value, fallback) => {
  if (value === undefined) return fallback;
  if (value === "rr") return "repeatable read";
  if (value === "rc") return "read committed";
  throw Error("M2.2A isolation overrides must be rc or rr");
};
const m2aFirstIsolation = parseM2aIsolation(flags["--m2-2a-first-isolation"], m2aIsolation);
const m2aSecondIsolation = parseM2aIsolation(flags["--m2-2a-second-isolation"], m2aIsolation);
if (!flags["--pg-bin"] || !flags["--output-dir"])
  throw Error("--pg-bin and --output-dir required");
const bin = resolve(flags["--pg-bin"]),
  out = resolve(flags["--output-dir"]);
const port = flags["--port"] ?? "55439";
if (!/^\d{4,5}$/.test(port)) throw Error("Invalid local port");
const root = resolve(import.meta.dirname, "../..");
const cluster = join(out, "cluster");
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const lit = (value) => `'${String(value).replaceAll("'", "''")}'`;
const exe = (name) =>
  join(bin, process.platform === "win32" ? `${name}.exe` : name);
const native = (name, args) =>
  execFileSync(exe(name), args, { encoding: "utf8", windowsHide: true });
const control = (args) =>
  execFileSync(exe("pg_ctl"), args, { windowsHide: true, stdio: "ignore" });
mkdirSync(out, { recursive: true });
const original013Hash =
  "aaced2308a23801f92a207e3cdd1f08b094e85d6ae7576eb35efd00630a786bd";
function candidate013(source) {
  source = source.replace(/\r\n/g, "\n");
  assert.equal(
    createHash("sha256").update(source).digest("hex"),
    original013Hash,
    "Candidate applies only to the reviewed 013 source",
  );
  const addition = String.raw`
-- Review candidate: consistent ECMAScript trim set; no business data access.
create function app_private.normalize_context_name(value text)
returns text language sql immutable strict set search_path = ''
as $$select pg_catalog.btrim(value,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')$$;
revoke all on function app_private.normalize_context_name(text) from public, anon, authenticated, service_role;

-- The row write forces stale snapshot transactions to serialize or abort.
create table app_private.principal_identity_fences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0)
);
alter table app_private.principal_identity_fences enable row level security;
revoke all on table app_private.principal_identity_fences from public, anon, authenticated, service_role;

`;
  return source
    .replace(
      "create table app_private.technical_accounts (",
      () => addition + "create table app_private.technical_accounts (",
    )
    .replace(
      "pg_catalog.char_length(pg_catalog.btrim(display_name))",
      "pg_catalog.char_length(app_private.normalize_context_name(display_name))",
    )
    .replace(
      "  perform pg_catalog.pg_advisory_xact_lock(1110, pg_catalog.hashtext(principal_id::text));",
      `  perform pg_catalog.pg_advisory_xact_lock(1110, pg_catalog.hashtext(principal_id::text));
  insert into app_private.principal_identity_fences(user_id,revision)
    values(principal_id,1)
    on conflict(user_id) do update
    set revision=app_private.principal_identity_fences.revision+1;`,
    )
    .replace(
      "or aal not in ('aal1','aal2')",
      "or aal is null or aal not in ('aal1','aal2')",
    )
    .replace(
      "where p.id = actor_id and p.active\n    union all",
      "where p.id = actor_id\n    union all",
    )
    .replace(
      "where t.user_id = actor_id and t.active\n  ) active_principals",
      "where t.user_id = actor_id\n  ) active_principals",
    )
    .replace(
      "pg_catalog.btrim(p.name)",
      "app_private.normalize_context_name(p.name)",
    )
    .replace(
      "pg_catalog.btrim(t.display_name)",
      "app_private.normalize_context_name(t.display_name)",
    );
}

class Session {
  constructor() {
    this.proc = spawn(
      exe("psql"),
      [
        "-X",
        "-q",
        "-t",
        "-A",
        "-h",
        "127.0.0.1",
        "-p",
        port,
        "-U",
        "postgres",
        "-d",
        "postgres",
      ],
      { windowsHide: true, env: { ...process.env, PGCLIENTENCODING: "UTF8" } },
    );
    this.buffer = "";
    this.errors = "";
    this.serial = 0;
    this.pending = null;
    this.proc.stdout.setEncoding("utf8");
    this.proc.stderr.setEncoding("utf8");
    this.proc.stdout.on("data", (data) => {
      this.buffer += data;
      this.flush();
    });
    this.proc.stderr.on("data", (data) => {
      this.errors += data;
    });
    this.proc.on("error", (error) => this.pending?.reject(error));
    this.proc.on("exit", (code) =>
      this.pending?.reject(Error(`psql exited ${code}: ${this.errors}`)),
    );
  }
  flush() {
    if (!this.pending) return;
    const { mark, resolve: done } = this.pending,
      position = this.buffer.indexOf(mark + " ");
    if (position < 0) return;
    const end = this.buffer.indexOf("\n", position);
    if (end < 0) return;
    const frame = this.buffer.slice(position, end).trim().split(/\s+/);
    const lines = this.buffer
      .slice(0, position)
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    const errors = this.errors;
    this.errors = "";
    this.buffer = this.buffer.slice(end + 1);
    this.pending = null;
    done({
      lines,
      code: errors.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] ?? frame.at(-1),
      errors,
    });
  }
  query(sql) {
    if (this.pending) throw Error("One query per connection");
    return new Promise((done, reject) => {
      const mark = `__M2_REVIEW_${++this.serial}__`;
      this.pending = { mark, resolve: done, reject };
      this.proc.stdin.write(`${sql}\n\\echo ${mark} :ERROR :SQLSTATE\n`);
    });
  }
  async ok(sql) {
    const result = await this.query(sql);
    assert.equal(result.code, "00000", result.errors);
    return result.lines;
  }
  async close() {
    if (this.pending) throw Error("Cannot close a pending connection");
    this.proc.stdin.end("\\q\n");
    if (this.proc.exitCode === null)
      await new Promise((done) => this.proc.once("exit", done));
  }
}

const results = [];
const record = (name, passed, details) => {
  const row = { name, passed, ...details };
  results.push(row);
  console.log(JSON.stringify(row));
};
let started = false,
  a,
  b,
  observer;
try {
  const init = native("initdb", [
    "-D",
    cluster,
    "-A",
    "trust",
    "-U",
    "postgres",
    "--encoding=UTF8",
    "--no-locale",
  ]);
  writeFileSync(join(out, "initdb.log"), init);
  control([
    "-D",
    cluster,
    "-l",
    join(out, "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${port}`,
    "-w",
    "start",
  ]);
  started = true;
  a = new Session();
  b = new Session();
  observer = new Session();
  for (const session of [a, b, observer])
    await session.ok("\\set VERBOSITY verbose\nset statement_timeout='15s';");
  await a.ok(`create role anon;create role authenticated;create role service_role;
    create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`);
  const migrationLimit = flags["--through-014"]
    ? "202610150014_operational_api.sql"
    : "202610140013_api_identity_foundation.sql";
  for (const file of readdirSync(join(root, "supabase/migrations"))
    .filter(
      (f) =>
        f.endsWith(".sql") && f <= migrationLimit,
    )
    .sort()) {
    let migration = readFileSync(
      join(root, "supabase/migrations", file),
      "utf8",
    );
    if (file.startsWith("202610140013") && flags["--candidate"]) {
      assert.equal(flags["--candidate"], "guard-fence-v2");
      migration = candidate013(migration);
      writeFileSync(join(out, "candidate-013.sql"), migration);
    }
    await a.ok(migration);
  }
  const org = uid(1),
    actor = uid(2);
  await a.ok(`insert into public.organizations values(${lit(org)},'Synthetic review');
    insert into auth.users(id) values(${lit(actor)});
    insert into public.profiles(id,organization_id,name,role,sector,branch,position)
      values(${lit(actor)},${lit(org)},'Synthetic employee','empleado','Test','Test','Test');`);
  const claims = async (claim, subject = actor) => {
    await a.ok(
      `reset role;select set_config('request.jwt.claim.sub',${lit(subject)},false),set_config('request.jwt.claims',${lit(JSON.stringify(claim))},false);set role authenticated;`,
    );
  };
  if (flags["--m2-2a-smoke"]) {
    const boss = uid(20), company = uid(21), team = uid(22), template = uid(23), version = uid(24), assignment = uid(25), task = uid(26);
    const acl = await a.query(`select
      has_function_privilege('authenticated','api.command_v1(jsonb)','execute'),
      has_function_privilege('authenticated','api.query_v1(jsonb)','execute'),
      has_function_privilege('anon','api.command_v1(jsonb)','execute'),
      has_function_privilege('service_role','api.command_v1(jsonb)','execute'),
      has_table_privilege('authenticated','app_private.operational_rate_heads','select'),
      has_table_privilege('service_role','app_private.api_command_receipts','select'),
      (select count(*)=7 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app_private' and c.relname in ('operational_rate_heads','operational_rate_versions','operational_assessments','operational_assessment_versions','api_operation_fences','api_month_fences','api_command_receipts') and c.relrowsecurity);`);
    assert.equal(acl.code, "00000", JSON.stringify(acl));
    assert.equal(acl.lines.at(-1), "t|t|f|f|f|f|t");
    await a.ok(`insert into auth.users(id) values(${lit(boss)});
      insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(boss)},${lit(org)},'Synthetic boss','jefe','Test','Test','Jefe');
      insert into public.companies(id,organization_id,name) values(${lit(company)},${lit(org)},'Synthetic company');
      insert into public.teams(id,organization_id,name,manager_id) values(${lit(team)},${lit(org)},'Synthetic team',${lit(boss)});
      insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(actor)});
      insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(actor)}),(${lit(org)},${lit(company)},${lit(boss)});
      insert into public.task_templates(id,organization_id,title,kind,weight,unit,monthly_target) values(${lit(template)},${lit(org)},'Synthetic invoices','operativa',5,'facturas',10);
      insert into public.task_template_versions(id,organization_id,template_id,version,title,objective,sector,kind,weight,unit,monthly_target) values(${lit(version)},${lit(org)},${lit(template)},1,'Synthetic invoices','','Test','operativa',5,'facturas',10);
      insert into public.task_assignments(id,organization_id,template_id,template_version_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,start_date,month_day)
       values(${lit(assignment)},${lit(org)},${lit(template)},${lit(version)},${lit(company)},${lit(actor)},${lit(team)},'Synthetic invoices','operativa',5,'facturas',10,'mensual','2026-10-01',31,'2026-10-01',31);
      insert into public.task_instances(id,organization_id,assignment_id,template_version_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,unit,target,status,due_date,checklist)
       values(${lit(task)},${lit(org)},${lit(assignment)},${lit(version)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01','2026-10-01','Synthetic invoices','operativa',5,'facturas',10,'Pendiente','2026-10-31','[]');`);
    await claims({ role: "authenticated", sub: actor, aal: "aal1" });
    const stringVersionCommand = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: "1", operationId: uid(73), kind: "operation.record", expectedRevisions: { [`task:${task}`]: "0" }, payload: { taskId: task, workDate: "2026-10-15", quantity: 1, reference: null } }).replaceAll("'", "''")}'::jsonb);`);
    const stringVersionQuery = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: "1", kind: "activityPage", filters: { taskId: task }, cursor: null, limit: 10 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(stringVersionCommand.code, "22023", JSON.stringify(stringVersionCommand));
    assert.equal(stringVersionQuery.code, "22023", JSON.stringify(stringVersionQuery));
    const recordCall = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: uid(31), kind: "operation.record", expectedRevisions: { [`task:${task}`]: "0" }, payload: { taskId: task, workDate: "2026-10-15", quantity: 3, reference: null } }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(recordCall.code, "00000", JSON.stringify(recordCall));
    const recordResult = JSON.parse(recordCall.lines.at(-1));
    assert.equal(decodeCommandResponseV1(recordResult).ok, true, JSON.stringify(recordResult));
    assert.equal(recordResult.result.measurementVersion, 2);
    assert.equal(recordResult.result.rateId, null);
    const page = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: task }, cursor: null, limit: 10 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(page.code, "00000", page.lines.at(-1));
    assert.equal(JSON.parse(page.lines.at(-1)).data.items.length, 1);
    assert.equal(decodeQueryResponseV1(JSON.parse(page.lines.at(-1))).ok, true, page.lines.at(-1));
    const summary = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "operationalSummary", filters: { taskId: task }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(summary.code, "00000", JSON.stringify(summary));
    assert.equal(JSON.parse(summary.lines.at(-1)).data.quantity, "3");
    const initialQuality = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "quality", filters: { taskId: task }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(initialQuality.code, "00000", JSON.stringify(initialQuality));
    assert.equal(JSON.parse(initialQuality.lines.at(-1)).data.current, null);
    const extraPayload = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: uid(36), kind: "operation.record", expectedRevisions: { [`task:${task}`]: "1" }, payload: { taskId: task, workDate: "2026-10-15", quantity: 1, reference: null, actorId: boss } }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(extraPayload.code, "22023", JSON.stringify(extraPayload));
    await a.ok("reset role;");
    const executeCheck = await a.query(`select app_private.api_can_execute('${task}'::uuid,'${boss}'::uuid,'2026-10-15'::date),coalesce((select string_agg(m.profile_id::text,',') from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id where h.instance_id='${task}'::uuid),'none');`);
    assert.equal(executeCheck.code, "00000", JSON.stringify(executeCheck));
    assert.equal(executeCheck.lines.at(-1), `f|${actor}`);
    await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
    const bossRecord = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: uid(37), kind: "operation.record", expectedRevisions: { [`task:${task}`]: "1" }, payload: { taskId: task, workDate: "2026-10-15", quantity: 1, reference: null } }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(bossRecord.code, "42501", JSON.stringify(bossRecord));
    await claims({ role: "authenticated", sub: boss, aal: "aal1" }, boss);
    const lowAssurance = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: uid(38), kind: "operation.assess", expectedRevisions: { [`task:${task}`]: "1", [`assessment:${task}`]: "0" }, payload: { taskId: task, quality: 1, order: 1, timeliness: 1, observation: "Evaluación sintética" } }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(lowAssurance.code, "42501", JSON.stringify(lowAssurance));
    await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
    const rate = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: uid(32), kind: "operation.rate", expectedRevisions: { [`rate:${company}:template:${template}`]: "0" }, payload: { companyId: company, templateId: template, taskId: null, effectiveOn: "2026-10-01", unitWeight: "2.5", reason: "Coeficiente por factura" } }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(rate.code, "00000", JSON.stringify(rate));
    const rateResult = JSON.parse(rate.lines.at(-1));
    assert.equal(decodeCommandResponseV1(rateResult).ok, true, JSON.stringify(rateResult));
    assert.equal(rateResult.result.unitWeight, "2.500000");
    const history = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "rateHistory", filters: { companyId: company, templateId: template, taskId: null }, cursor: null, limit: 10 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(history.code, "00000", JSON.stringify(history));
    assert.equal(JSON.parse(history.lines.at(-1)).data.items.length, 1);
    assert.equal(decodeQueryResponseV1(JSON.parse(history.lines.at(-1))).ok, true, history.lines.at(-1));
    const laterRate = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: uid(35), kind: "operation.rate", expectedRevisions: { [`rate:${company}:template:${template}`]: "1" }, payload: { companyId: company, templateId: template, taskId: null, effectiveOn: "2026-11-01", unitWeight: "3.125", reason: "Coeficiente futuro por factura" } }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(laterRate.code, "00000", JSON.stringify(laterRate));
    const firstRatePage = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "rateHistory", filters: { companyId: company, templateId: template, taskId: null }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(firstRatePage.code, "00000", JSON.stringify(firstRatePage));
    const firstRatePageData = JSON.parse(firstRatePage.lines.at(-1)).data;
    assert.equal(firstRatePageData.items.length, 1);
    assert.ok(firstRatePageData.nextCursor);
    const secondRatePage = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "rateHistory", filters: { companyId: company, templateId: template, taskId: null }, cursor: firstRatePageData.nextCursor, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(secondRatePage.code, "00000", JSON.stringify(secondRatePage));
    assert.equal(JSON.parse(secondRatePage.lines.at(-1)).data.items.length, 1);
    const rateReceipt = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "commandReceipt", filters: { operationId: uid(32) }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(rateReceipt.code, "00000", JSON.stringify(rateReceipt));
    assert.equal(JSON.parse(rateReceipt.lines.at(-1)).data.found, true);
    const assess = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: uid(33), kind: "operation.assess", expectedRevisions: { [`task:${task}`]: "1", [`assessment:${task}`]: "0" }, payload: { taskId: task, quality: 0, order: 80, timeliness: 100, observation: "Evaluación sintética" } }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(assess.code, "00000", assess.lines.at(-1));
    assert.equal(decodeCommandResponseV1(JSON.parse(assess.lines.at(-1))).ok, true, assess.lines.at(-1));
    const quality = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "quality", filters: { taskId: task }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(quality.code, "00000", JSON.stringify(quality));
    assert.equal(JSON.parse(quality.lines.at(-1)).data.current.quality, 0);
    assert.equal(decodeQueryResponseV1(JSON.parse(quality.lines.at(-1))).ok, true, quality.lines.at(-1));
    await a.ok("reset role;");
    await observer.ok(`update public.profiles set active=false where id=${lit(boss)};`);
    await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
    const revokedRateReplay = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: uid(32), kind: "operation.rate", expectedRevisions: { [`rate:${company}:template:${template}`]: "0" }, payload: { companyId: company, templateId: template, taskId: null, effectiveOn: "2026-10-01", unitWeight: "2.5", reason: "Coeficiente por factura" } }).replaceAll("'", "''")}'::jsonb);`);
    const revokedAssessmentReplay = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: uid(33), kind: "operation.assess", expectedRevisions: { [`task:${task}`]: "1", [`assessment:${task}`]: "0" }, payload: { taskId: task, quality: 0, order: 80, timeliness: 100, observation: "Evaluación sintética" } }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(revokedRateReplay.code, "42501", JSON.stringify(revokedRateReplay));
    assert.equal(revokedAssessmentReplay.code, "42501", JSON.stringify(revokedAssessmentReplay));
    await a.ok("reset role;");
    await observer.ok(`update public.profiles set active=true where id=${lit(boss)};`);
    record("M2.2A rate and assessment receipts are reauthorized before replay", true, { revokedRateReplay: revokedRateReplay.code, revokedAssessmentReplay: revokedAssessmentReplay.code });
    await claims({ role: "authenticated", sub: actor, aal: "aal1" });
    const nextCommand = { contractVersion: 1, operationId: uid(34), kind: "operation.record", expectedRevisions: { [`task:${task}`]: "2" }, payload: { taskId: task, workDate: "2026-10-15", quantity: 4, reference: "   " } };
    const next = await a.query(`select api.command_v1('${JSON.stringify(nextCommand).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(next.code, "00000", next.lines.at(-1));
    assert.equal(JSON.parse(next.lines.at(-1)).result.unitWeight, "2.500000");
    const firstActivityPage = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: task }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(firstActivityPage.code, "00000", JSON.stringify(firstActivityPage));
    const firstActivityData = JSON.parse(firstActivityPage.lines.at(-1)).data;
    assert.equal(firstActivityData.items.length, 1);
    assert.ok(firstActivityData.nextCursor);
    const secondActivityPage = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: task }, cursor: firstActivityData.nextCursor, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(secondActivityPage.code, "00000", JSON.stringify(secondActivityPage));
    assert.equal(JSON.parse(secondActivityPage.lines.at(-1)).data.items.length, 1);
    assert.equal(JSON.parse(secondActivityPage.lines.at(-1)).data.nextCursor, null);
    const replay = await a.query(`select api.command_v1('${JSON.stringify(nextCommand).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(replay.code, "00000", JSON.stringify(replay));
    assert.equal(replay.lines.at(-1), next.lines.at(-1));
    const conflict = await a.query(`select api.command_v1('${JSON.stringify({ ...nextCommand, payload: { ...nextCommand.payload, quantity: 8 } }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(conflict.code, "40001");
    const closedPreview = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "operationalSummary", filters: { taskId: task }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(closedPreview.code, "00000", JSON.stringify(closedPreview));
    assert.equal(JSON.parse(closedPreview.lines.at(-1)).data.ratedLoad, "10.000000");
    assert.equal(JSON.parse(closedPreview.lines.at(-1)).data.weightedLoad, null);
    const ownReceipt = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "commandReceipt", filters: { operationId: uid(34) }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(ownReceipt.code, "00000", JSON.stringify(ownReceipt));
    assert.equal(JSON.parse(ownReceipt.lines.at(-1)).data.found, true);
    const replayRace = { contractVersion: 1, operationId: uid(39), kind: "operation.record", expectedRevisions: { [`task:${task}`]: "3" }, payload: { taskId: task, workDate: "2026-10-15", quantity: 1, reference: null } };
    await claims({ role: "authenticated", sub: actor, aal: "aal1" });
    await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;`);
    const pidA = Number((await a.ok("select pg_backend_pid();")).at(-1));
    const pidB = Number((await b.ok("select pg_backend_pid();")).at(-1));
    await a.ok(`begin isolation level ${m2aFirstIsolation};`);
    const firstReplay = await a.query(`select api.command_v1('${JSON.stringify(replayRace).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(firstReplay.code, "00000", JSON.stringify(firstReplay));
    await b.ok(`begin isolation level ${m2aSecondIsolation};`);
    const pendingReplay = b.query(`select api.command_v1('${JSON.stringify(replayRace).replaceAll("'", "''")}'::jsonb);`);
    const raceDeadline = Date.now() + 10000;
    let replayBlocked = false;
    while (Date.now() < raceDeadline) {
      const line = (await observer.ok(`select ${pidA}=any(pg_catalog.pg_blocking_pids(${pidB}));`)).at(-1);
      if (line === "t") { replayBlocked = true; break; }
      await new Promise((done) => setTimeout(done, 20));
    }
    await a.ok("commit;");
    const secondReplay = await pendingReplay;
    const replayCommit = await b.query(secondReplay.code === "00000" ? "commit;" : "rollback;");
    assert.equal(replayCommit.code, "00000", JSON.stringify(replayCommit));
    assert.equal(replayBlocked, true);
    let replayRetry = null;
    if (m2aSecondIsolation === "repeatable read") {
      assert.equal(secondReplay.code, "40001", JSON.stringify(secondReplay));
      await b.ok(`begin isolation level ${m2aSecondIsolation};`);
      replayRetry = await b.query(`select api.command_v1('${JSON.stringify(replayRace).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(replayRetry.code, "00000", JSON.stringify(replayRetry));
      assert.equal(replayRetry.lines.at(-1), firstReplay.lines.at(-1));
      await b.ok("commit;");
    } else {
      assert.equal(firstReplay.lines.at(-1), secondReplay.lines.at(-1));
      assert.equal(secondReplay.code, "00000", JSON.stringify(secondReplay));
    }
    const replayCount = await observer.query(`select count(*) from public.activity_entries where instance_id=${lit(task)} and actor_id=${lit(actor)} and measurement_version=2;`);
    assert.equal(replayCount.lines.at(-1), "3");
    record("M2.2A concurrent exact replay serializes without duplicate activity", true, { isolationPair: `${m2aFirstIsolation}/${m2aSecondIsolation}`, blocked: replayBlocked, replaySQLSTATE: secondReplay.code, retrySQLSTATE: replayRetry?.code ?? null, measurementV2Entries: 3 });
    await a.ok("reset role;");
    await b.ok("reset role;");
    const owner2 = uid(40), assignment2 = uid(41), task2 = uid(42), template2 = uid(45), version2 = uid(46);
    await observer.ok(`insert into auth.users(id) values(${lit(owner2)});
      insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(owner2)},${lit(org)},'Synthetic second employee','empleado','Test','Test','Test');
      insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(owner2)});
      insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(owner2)});
      insert into public.task_templates(id,organization_id,title,kind,weight,unit,monthly_target) values(${lit(template2)},${lit(org)},'Synthetic new invoices','operativa',5,'facturas',10);
      insert into public.task_template_versions(id,organization_id,template_id,version,title,objective,sector,kind,weight,unit,monthly_target) values(${lit(version2)},${lit(org)},${lit(template2)},1,'Synthetic new invoices','','Test','operativa',5,'facturas',10);
      insert into public.task_assignments(id,organization_id,template_id,template_version_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,start_date,month_day)
       values(${lit(assignment2)},${lit(org)},${lit(template2)},${lit(version2)},${lit(company)},${lit(owner2)},${lit(team)},'Synthetic second invoices','operativa',5,'facturas',10,'mensual','2026-10-01',31,'2026-10-01',31);
      insert into public.task_instances(id,organization_id,assignment_id,template_version_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,unit,target,status,due_date,checklist)
       values(${lit(task2)},${lit(org)},${lit(assignment2)},${lit(version2)},${lit(company)},${lit(owner2)},${lit(team)},'2026-10-01','2026-10-01','Synthetic second invoices','operativa',5,'facturas',10,'Pendiente','2026-10-31','[]');`);
    await claims({ role: "authenticated", sub: owner2, aal: "aal1" }, owner2);
    await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
    const setupPidA = Number((await a.ok("select pg_backend_pid();")).at(-1));
    const setupPidB = Number((await b.ok("select pg_backend_pid();")).at(-1));
    await a.ok(`begin isolation level ${m2aIsolation};`);
    const firstConfigurationRecord = { contractVersion: 1, operationId: uid(43), kind: "operation.record", expectedRevisions: { [`task:${task2}`]: "0" }, payload: { taskId: task2, workDate: "2026-10-15", quantity: 2, reference: null } };
    const firstConfiguredRecord = await a.query(`select api.command_v1('${JSON.stringify(firstConfigurationRecord).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(firstConfiguredRecord.code, "00000", JSON.stringify(firstConfiguredRecord));
    await b.ok(`begin isolation level ${m2aIsolation};select count(*) from public.task_instances;`);
    const firstRateArgs = { contractVersion: 1, operationId: uid(44), kind: "operation.rate", expectedRevisions: { [`rate:${company}:template:${template2}`]: "0" }, payload: { companyId: company, templateId: template2, taskId: null, effectiveOn: "2026-10-01", unitWeight: "4", reason: "Primera configuración concurrente" } };
    const waitingRate = b.query(`select api.command_v1('${JSON.stringify(firstRateArgs).replaceAll("'", "''")}'::jsonb);`);
    const firstRateDeadline = Date.now() + 10000;
    let firstRateBlocked = false;
    while (Date.now() < firstRateDeadline) {
      const line = (await observer.ok(`select ${setupPidA}=any(pg_catalog.pg_blocking_pids(${setupPidB}));`)).at(-1);
      if (line === "t") { firstRateBlocked = true; break; }
      await new Promise((done) => setTimeout(done, 20));
    }
    await a.ok("commit;");
    const concurrentFirstRate = await waitingRate;
    const firstRateEnd = await b.query(concurrentFirstRate.code === "00000" ? "commit;" : "rollback;");
    const rateAfterRace = await observer.query(`select count(*) from app_private.operational_rate_versions v join app_private.operational_rate_heads h on h.id=v.head_id where h.company_id=${lit(company)} and h.template_id=${lit(template2)};`);
    assert.equal(firstRateBlocked, true);
    assert.equal(firstRateEnd.code, "00000", JSON.stringify(firstRateEnd));
    let firstRateRetry = null;
    if (m2aIsolation === "repeatable read") {
      assert.equal(concurrentFirstRate.code, "40001", JSON.stringify(concurrentFirstRate));
      assert.equal(rateAfterRace.lines.at(-1), "0");
      await b.ok("begin isolation level repeatable read;");
      firstRateRetry = await b.query(`select api.command_v1('${JSON.stringify(firstRateArgs).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(firstRateRetry.code, "00000", JSON.stringify(firstRateRetry));
      await b.ok("commit;");
    } else {
      assert.equal(concurrentFirstRate.code, "00000", JSON.stringify(concurrentFirstRate));
      assert.equal(rateAfterRace.lines.at(-1), "1");
    }
    const firstRateOriginalEntry = await observer.query(`select coalesce(operational_unit_weight::text,'null')||'|'||measurement_version::text from public.activity_entries where instance_id=${lit(task2)};`);
    assert.equal(firstRateOriginalEntry.lines.at(-1), "null|2");
    record("M2.2A first rate configuration racing an operational record preserves the winning entry snapshot", true, { isolation: m2aIsolation, blocked: firstRateBlocked, rateSQLSTATE: concurrentFirstRate.code, rateRetrySQLSTATE: firstRateRetry?.code ?? null, rateVersionsAfterRace: rateAfterRace.lines.at(-1), originalActivity: firstRateOriginalEntry.lines.at(-1) });
    await a.ok("reset role;");
    await b.ok("reset role;");
    await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
    await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(owner2)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: owner2, aal: "aal1" }))},false);set role authenticated;`);
    const rateFirstRevision = (await observer.query(`select state_revision from public.task_instances where id=${lit(task2)};`)).lines.at(-1);
    const rateFirstPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
    const recordSecondPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
    const rateFirstConfigRevision = (await observer.query(`select coalesce((select config_revision from app_private.operational_rate_heads where company_id=${lit(company)} and template_id=${lit(template2)} and instance_id is null),'0');`)).lines.at(-1);
    await a.ok(`begin isolation level ${m2aIsolation};`);
    const rateFirstArgs = { contractVersion: 1, operationId: uid(84), kind: "operation.rate", expectedRevisions: { [`rate:${company}:template:${template2}`]: rateFirstConfigRevision }, payload: { companyId: company, templateId: template2, taskId: null, effectiveOn: "2026-10-01", unitWeight: "4", reason: "Configuración previa al registro" } };
    const rateFirstResult = await a.query(`select api.command_v1('${JSON.stringify(rateFirstArgs).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(rateFirstResult.code, "00000", JSON.stringify(rateFirstResult));
    await b.ok(`begin isolation level ${m2aIsolation};`);
    const recordAfterRateArgs = { contractVersion: 1, operationId: uid(85), kind: "operation.record", expectedRevisions: { [`task:${task2}`]: rateFirstRevision }, payload: { taskId: task2, workDate: "2026-10-15", quantity: 2, reference: "rate-first" } };
    const recordAfterRatePending = b.query(`select api.command_v1('${JSON.stringify(recordAfterRateArgs).replaceAll("'", "''")}'::jsonb);`);
    const rateFirstDeadline = Date.now() + 10000;
    let rateFirstBlocked = false;
    while (Date.now() < rateFirstDeadline) {
      if ((await observer.ok(`select ${rateFirstPid}=any(pg_catalog.pg_blocking_pids(${recordSecondPid}));`)).at(-1) === "t") { rateFirstBlocked = true; break; }
      await new Promise((done) => setTimeout(done, 20));
    }
    await a.ok("commit;");
    const recordAfterRateResult = await recordAfterRatePending;
    await b.query(recordAfterRateResult.code === "00000" ? "commit;" : "rollback;");
    let recordAfterRateRetry = null;
    if (m2aIsolation === "repeatable read") {
      assert.equal(recordAfterRateResult.code, "40001", JSON.stringify(recordAfterRateResult));
      await b.ok("begin isolation level repeatable read;");
      recordAfterRateRetry = await b.query(`select api.command_v1('${JSON.stringify(recordAfterRateArgs).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(recordAfterRateRetry.code, "00000", JSON.stringify(recordAfterRateRetry));
      await b.ok("commit;");
    }
    const rateFirstEvidence = await observer.query(`select operational_unit_weight::text||'|'||measurement_version::text from public.activity_entries where instance_id=${lit(task2)} and reference='rate-first';`);
    assert.equal(rateFirstBlocked, true);
    assert.equal(recordAfterRateResult.code, m2aIsolation === "repeatable read" ? "40001" : "00000", JSON.stringify(recordAfterRateResult));
    assert.equal(rateFirstEvidence.lines.at(-1), "4.000000|2");
    record("M2.2A first rate commits before a blocked record and its coefficient is snapshotted", true, { isolation: m2aIsolation, blocked: rateFirstBlocked, rateSQLSTATE: rateFirstResult.code, recordSQLSTATE: recordAfterRateResult.code, recordRetrySQLSTATE: recordAfterRateRetry?.code ?? null, activitySnapshot: rateFirstEvidence.lines.at(-1) });
    const assessPidA = Number((await a.ok("select pg_backend_pid();")).at(-1));
    const assessPidB = Number((await b.ok("select pg_backend_pid();")).at(-1));
    await a.ok(`begin isolation level ${m2aIsolation};`);
    const revisionBeforeAssessment = (await observer.query(`select state_revision from public.task_instances where id=${lit(task2)};`)).lines.at(-1);
    const assessmentRaceArgs = { contractVersion: 1, operationId: uid(47), kind: "operation.assess", expectedRevisions: { [`task:${task2}`]: revisionBeforeAssessment, [`assessment:${task2}`]: "0" }, payload: { taskId: task2, quality: 90, order: 90, timeliness: 90, observation: "Revisión concurrente" } };
    const assessmentFirst = await a.query(`select api.command_v1('${JSON.stringify(assessmentRaceArgs).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(assessmentFirst.code, "00000", JSON.stringify(assessmentFirst));
    await b.ok(`begin isolation level ${m2aIsolation};`);
    const recordAgainstAssessment = { contractVersion: 1, operationId: uid(48), kind: "operation.record", expectedRevisions: { [`task:${task2}`]: revisionBeforeAssessment }, payload: { taskId: task2, workDate: "2026-10-15", quantity: 1, reference: null } };
    const waitingRecord = b.query(`select api.command_v1('${JSON.stringify(recordAgainstAssessment).replaceAll("'", "''")}'::jsonb);`);
    const assessDeadline = Date.now() + 10000;
    let assessBlocked = false;
    while (Date.now() < assessDeadline) {
      const line = (await observer.ok(`select ${assessPidA}=any(pg_catalog.pg_blocking_pids(${assessPidB}));`)).at(-1);
      if (line === "t") { assessBlocked = true; break; }
      await new Promise((done) => setTimeout(done, 20));
    }
    await a.ok("commit;");
    const recordAfterAssessment = await waitingRecord;
    const recordAssessEnd = await b.query(recordAfterAssessment.code === "00000" ? "commit;" : "rollback;");
    assert.equal(assessBlocked, true);
    assert.equal(recordAfterAssessment.code, "40001", JSON.stringify(recordAfterAssessment));
    assert.equal(recordAssessEnd.code, "00000", JSON.stringify(recordAssessEnd));
    const assessmentRaceRows = await observer.query(`select count(*) from public.activity_entries where instance_id=${lit(task2)};`);
    assert.equal(assessmentRaceRows.lines.at(-1), "2");
    record("M2.2A assessment racing a stale operational record serializes with one revision", true, { blocked: assessBlocked, recordSQLSTATE: recordAfterAssessment.code, activityEntries: 2 });
    const [recordFirstTaskRevision, recordFirstAssessmentRevision] = (await observer.query(`select t.state_revision,coalesce(a.revision,0) from public.task_instances t left join app_private.operational_assessments a on a.instance_id=t.id where t.id=${lit(task2)};`)).lines.at(-1).split("|");
    const recordFirstPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
    const assessSecondPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
    await b.ok(`begin isolation level ${m2aIsolation};`);
    const recordWinsAssessmentArgs = { contractVersion: 1, operationId: uid(86), kind: "operation.record", expectedRevisions: { [`task:${task2}`]: recordFirstTaskRevision }, payload: { taskId: task2, workDate: "2026-10-15", quantity: 1, reference: "record-before-assessment" } };
    const recordWinsAssessment = await b.query(`select api.command_v1('${JSON.stringify(recordWinsAssessmentArgs).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(recordWinsAssessment.code, "00000", JSON.stringify(recordWinsAssessment));
    await a.ok(`begin isolation level ${m2aIsolation};`);
    const staleAssessmentArgs = { contractVersion: 1, operationId: uid(87), kind: "operation.assess", expectedRevisions: { [`task:${task2}`]: recordFirstTaskRevision, [`assessment:${task2}`]: recordFirstAssessmentRevision }, payload: { taskId: task2, quality: 80, order: 80, timeliness: 80, observation: "Revisión posterior al registro" } };
    const waitingStaleAssessment = a.query(`select api.command_v1('${JSON.stringify(staleAssessmentArgs).replaceAll("'", "''")}'::jsonb);`);
    const reverseAssessDeadline = Date.now() + 10000;
    let reverseAssessBlocked = false;
    while (Date.now() < reverseAssessDeadline) {
      if ((await observer.ok(`select ${recordFirstPid}=any(pg_catalog.pg_blocking_pids(${assessSecondPid}));`)).at(-1) === "t") { reverseAssessBlocked = true; break; }
      await new Promise((done) => setTimeout(done, 20));
    }
    await b.ok("commit;");
    const staleAssessmentResult = await waitingStaleAssessment;
    await a.query(staleAssessmentResult.code === "00000" ? "commit;" : "rollback;");
    assert.equal(reverseAssessBlocked, true);
    assert.equal(staleAssessmentResult.code, "40001", JSON.stringify(staleAssessmentResult));
    const assessmentVersionsAfterRecord = await observer.query(`select revision from app_private.operational_assessments where instance_id=${lit(task2)};`);
    assert.equal(assessmentVersionsAfterRecord.lines.at(-1), recordFirstAssessmentRevision);
    record("M2.2A record-first race rejects the stale assessment without a partial revision", true, { blocked: reverseAssessBlocked, recordSQLSTATE: recordWinsAssessment.code, assessmentSQLSTATE: staleAssessmentResult.code, assessmentRevision: assessmentVersionsAfterRecord.lines.at(-1) });
    const changeFirstTaskRevision = (await observer.query(`select state_revision from public.task_instances where id=${lit(task2)};`)).lines.at(-1);
    const changeFirstRateRevision = (await observer.query(`select config_revision from app_private.operational_rate_heads where company_id=${lit(company)} and template_id=${lit(template2)} and instance_id is null;`)).lines.at(-1);
    const recordChangePid = Number((await b.ok("select pg_backend_pid();")).at(-1));
    const rateChangePid = Number((await a.ok("select pg_backend_pid();")).at(-1));
    await b.ok(`begin isolation level ${m2aIsolation};`);
    const recordBeforeRateChangeArgs = { contractVersion: 1, operationId: uid(88), kind: "operation.record", expectedRevisions: { [`task:${task2}`]: changeFirstTaskRevision }, payload: { taskId: task2, workDate: "2026-10-15", quantity: 1, reference: "change-after-record" } };
    const recordBeforeRateChange = await b.query(`select api.command_v1('${JSON.stringify(recordBeforeRateChangeArgs).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(recordBeforeRateChange.code, "00000", JSON.stringify(recordBeforeRateChange));
    await a.ok(`begin isolation level ${m2aIsolation};`);
    const changeRateArgs = { contractVersion: 1, operationId: uid(89), kind: "operation.rate", expectedRevisions: { [`rate:${company}:template:${template2}`]: changeFirstRateRevision }, payload: { companyId: company, templateId: template2, taskId: null, effectiveOn: "2026-10-01", unitWeight: "5", reason: "Actualización posterior al registro" } };
    const waitingRateChange = a.query(`select api.command_v1('${JSON.stringify(changeRateArgs).replaceAll("'", "''")}'::jsonb);`);
    const rateChangeDeadline = Date.now() + 10000;
    let rateChangeBlocked = false;
    while (Date.now() < rateChangeDeadline) {
      if ((await observer.ok(`select ${recordChangePid}=any(pg_catalog.pg_blocking_pids(${rateChangePid}));`)).at(-1) === "t") { rateChangeBlocked = true; break; }
      await new Promise((done) => setTimeout(done, 20));
    }
    await b.ok("commit;");
    const rateChangeResult = await waitingRateChange;
    await a.query(rateChangeResult.code === "00000" ? "commit;" : "rollback;");
    let rateChangeRetry = null;
    if (m2aIsolation === "repeatable read") {
      assert.equal(rateChangeResult.code, "40001", JSON.stringify(rateChangeResult));
      await a.ok("begin isolation level repeatable read;");
      rateChangeRetry = await a.query(`select api.command_v1('${JSON.stringify(changeRateArgs).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(rateChangeRetry.code, "00000", JSON.stringify(rateChangeRetry));
      await a.ok("commit;");
    }
    const immutableRateSnapshot = await observer.query(`select operational_unit_weight::text from public.activity_entries where instance_id=${lit(task2)} and reference='change-after-record';`);
    const newestRate = await observer.query(`select unit_weight::text from app_private.operational_rate_versions v join app_private.operational_rate_heads h on h.id=v.head_id where h.company_id=${lit(company)} and h.template_id=${lit(template2)} and h.instance_id is null order by version desc limit 1;`);
    assert.equal(rateChangeBlocked, true);
    assert.equal(rateChangeResult.code, m2aIsolation === "repeatable read" ? "40001" : "00000", JSON.stringify(rateChangeResult));
    assert.equal(immutableRateSnapshot.lines.at(-1), "4.000000");
    assert.equal(newestRate.lines.at(-1), "5.000000");
    record("M2.2A record-first rate change preserves the entry coefficient and updates future rate", true, { isolation: m2aIsolation, blocked: rateChangeBlocked, recordSQLSTATE: recordBeforeRateChange.code, rateSQLSTATE: rateChangeResult.code, rateRetrySQLSTATE: rateChangeRetry?.code ?? null, entryWeight: immutableRateSnapshot.lines.at(-1), currentWeight: newestRate.lines.at(-1) });
    const changedRateRevision = (await observer.query(`select config_revision from app_private.operational_rate_heads where company_id=${lit(company)} and template_id=${lit(template2)} and instance_id is null;`)).lines.at(-1);
    const changedTaskRevision = (await observer.query(`select state_revision from public.task_instances where id=${lit(task2)};`)).lines.at(-1);
    const changedRatePid = Number((await a.ok("select pg_backend_pid();")).at(-1));
    const changedRecordPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
    await a.ok(`begin isolation level ${m2aIsolation};`);
    const changedRateFirstArgs = { contractVersion: 1, operationId: uid(99), kind: "operation.rate", expectedRevisions: { [`rate:${company}:template:${template2}`]: changedRateRevision }, payload: { companyId: company, templateId: template2, taskId: null, effectiveOn: "2026-10-01", unitWeight: "6", reason: "Nueva ponderación anterior al registro" } };
    const changedRateFirst = await a.query(`select api.command_v1('${JSON.stringify(changedRateFirstArgs).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(changedRateFirst.code, "00000", JSON.stringify(changedRateFirst));
    await b.ok(`begin isolation level ${m2aIsolation};`);
    const recordAfterChangedRateArgs = { contractVersion: 1, operationId: uid(100), kind: "operation.record", expectedRevisions: { [`task:${task2}`]: changedTaskRevision }, payload: { taskId: task2, workDate: "2026-10-15", quantity: 1, reference: "change-before-record" } };
    const recordAfterChangedRatePending = b.query(`select api.command_v1('${JSON.stringify(recordAfterChangedRateArgs).replaceAll("'", "''")}'::jsonb);`);
    const changedRateDeadline = Date.now() + 10000;
    let changedRateBlocked = false;
    while (Date.now() < changedRateDeadline) {
      if ((await observer.ok(`select ${changedRatePid}=any(pg_catalog.pg_blocking_pids(${changedRecordPid}));`)).at(-1) === "t") { changedRateBlocked = true; break; }
      await new Promise((done) => setTimeout(done, 20));
    }
    await a.ok("commit;");
    const recordAfterChangedRateResult = await recordAfterChangedRatePending;
    await b.query(recordAfterChangedRateResult.code === "00000" ? "commit;" : "rollback;");
    let recordAfterChangedRateRetry = null;
    if (m2aIsolation === "repeatable read") {
      assert.equal(recordAfterChangedRateResult.code, "40001", JSON.stringify(recordAfterChangedRateResult));
      await b.ok("begin isolation level repeatable read;");
      recordAfterChangedRateRetry = await b.query(`select api.command_v1('${JSON.stringify(recordAfterChangedRateArgs).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(recordAfterChangedRateRetry.code, "00000", JSON.stringify(recordAfterChangedRateRetry));
      await b.ok("commit;");
    }
    const changedRateSnapshot = await observer.query(`select operational_unit_weight::text from public.activity_entries where instance_id=${lit(task2)} and reference='change-before-record';`);
    assert.equal(changedRateBlocked, true);
    assert.equal(recordAfterChangedRateResult.code, m2aIsolation === "repeatable read" ? "40001" : "00000", JSON.stringify(recordAfterChangedRateResult));
    assert.equal(changedRateSnapshot.lines.at(-1), "6.000000");
    record("M2.2A rate-change-first race applies the new coefficient only to the later record", true, { isolation: m2aIsolation, blocked: changedRateBlocked, rateSQLSTATE: changedRateFirst.code, recordSQLSTATE: recordAfterChangedRateResult.code, recordRetrySQLSTATE: recordAfterChangedRateRetry?.code ?? null, activitySnapshot: changedRateSnapshot.lines.at(-1) });
    await observer.ok(`update auth.users set email='synthetic-manager@example.invalid',email_confirmed_at=clock_timestamp() where id=${lit(boss)};
      insert into public.report_settings(organization_id,recipient_id,updated_by) values(${lit(org)},${lit(boss)},${lit(boss)}) on conflict(organization_id) do update set recipient_id=excluded.recipient_id,updated_by=excluded.updated_by;`);
    const closeAfterRecordRevision = (await observer.query(`select state_revision from public.task_instances where id=${lit(task2)};`)).lines.at(-1);
    const recordBeforeClosePid = Number((await b.ok("select pg_backend_pid();")).at(-1));
    const closeAfterRecordPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
    await b.ok(`begin isolation level ${m2aIsolation};`);
    const recordBeforeCloseArgs = { contractVersion: 1, operationId: uid(90), kind: "operation.record", expectedRevisions: { [`task:${task2}`]: closeAfterRecordRevision }, payload: { taskId: task2, workDate: "2026-10-15", quantity: 1, reference: "record-before-close" } };
    const recordBeforeCloseResult = await b.query(`select api.command_v1('${JSON.stringify(recordBeforeCloseArgs).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(recordBeforeCloseResult.code, "00000", JSON.stringify(recordBeforeCloseResult));
    await a.ok(`begin isolation level ${m2aIsolation};`);
    const waitingCloseAfterRecord = a.query(`select public.close_employee_month(${lit(owner2)},'2026-10-01','Cierre posterior al registro');`);
    const closeAfterRecordDeadline = Date.now() + 10000;
    let closeAfterRecordBlocked = false;
    while (Date.now() < closeAfterRecordDeadline) {
      if ((await observer.ok(`select ${recordBeforeClosePid}=any(pg_catalog.pg_blocking_pids(${closeAfterRecordPid}));`)).at(-1) === "t") { closeAfterRecordBlocked = true; break; }
      await new Promise((done) => setTimeout(done, 20));
    }
    await b.ok("commit;");
    const closeAfterRecordResult = await waitingCloseAfterRecord;
    await a.query(closeAfterRecordResult.code === "00000" ? "commit;" : "rollback;");
    const closeRetryAfterRecord = await a.query(`select public.close_employee_month(${lit(owner2)},'2026-10-01','Cierre posterior al registro');`);
    const closeAfterRecordArtifacts = await observer.query(`select (select count(*) from public.monthly_closures where owner_id=${lit(owner2)} and period='2026-10-01')||'|'||(select count(*) from public.period_reports pr join public.monthly_closures mc on mc.id=pr.closure_id where mc.owner_id=${lit(owner2)} and mc.period='2026-10-01')||'|'||(select count(*) from public.report_outbox_events oe join public.report_deliveries d on d.id=oe.delivery_id join public.period_reports pr on pr.id=d.report_id join public.monthly_closures mc on mc.id=pr.closure_id where mc.owner_id=${lit(owner2)} and mc.period='2026-10-01');`);
    assert.equal(closeAfterRecordBlocked, true);
    assert.equal(closeAfterRecordResult.code, "40001", JSON.stringify(closeAfterRecordResult));
    assert.equal(closeRetryAfterRecord.code, "0A000", JSON.stringify(closeRetryAfterRecord));
    assert.equal(closeAfterRecordArtifacts.lines.at(-1), "0|0|0");
    record("M2.2A record-first public close fails cleanly without closure, report, or outbox", true, { blocked: closeAfterRecordBlocked, recordSQLSTATE: recordBeforeCloseResult.code, closeSQLSTATE: closeAfterRecordResult.code, closeRetrySQLSTATE: closeRetryAfterRecord.code, artifacts: closeAfterRecordArtifacts.lines.at(-1) });
    await a.ok("reset role;");
    await b.ok("reset role;");
    const owner3 = uid(49), assignment3 = uid(50), task3 = uid(51);
    await observer.ok(`insert into auth.users(id) values(${lit(owner3)});
      insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(owner3)},${lit(org)},'Synthetic third employee','empleado','Test','Test','Test');
      insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(owner3)});
      insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(owner3)});
      insert into public.task_assignments(id,organization_id,template_id,template_version_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,start_date,month_day)
       values(${lit(assignment3)},${lit(org)},${lit(template2)},${lit(version2)},${lit(company)},${lit(owner3)},${lit(team)},'Synthetic third invoices','operativa',5,'facturas',10,'mensual','2026-10-01',31,'2026-10-01',31);
      insert into public.task_instances(id,organization_id,assignment_id,template_version_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,unit,target,status,due_date,checklist)
       values(${lit(task3)},${lit(org)},${lit(assignment3)},${lit(version2)},${lit(company)},${lit(owner3)},${lit(team)},'2026-10-01','2026-10-01','Synthetic third invoices','operativa',5,'facturas',10,'Pendiente','2026-10-31','[]');`);
    await observer.ok(`update auth.users set email='synthetic-manager@example.invalid',email_confirmed_at=clock_timestamp() where id=${lit(boss)};
      insert into public.report_settings(organization_id,recipient_id,updated_by) values(${lit(org)},${lit(boss)},${lit(boss)}) on conflict(organization_id) do update set recipient_id=excluded.recipient_id,updated_by=excluded.updated_by;`);
    await observer.ok(`begin;select public._coordination_lock_keys(1104,array[${lit(`${owner3}:2026-10-01`)}]);`);
    const blockerPid = Number((await observer.ok("select pg_backend_pid();")).at(-1));
    await a.ok(`begin isolation level ${m2aIsolation};`);
    const closePidA = Number((await a.ok("select pg_backend_pid();")).at(-1));
    const closeCommand = a.query(`select public.close_employee_month(${lit(owner3)},'2026-10-01','Cierre concurrente sintético');`);
    let closeCommandBlocked = false;
    const closeCommandDeadline = Date.now() + 10000;
    while (Date.now() < closeCommandDeadline) {
      if ((await observer.ok(`select ${blockerPid}=any(pg_catalog.pg_blocking_pids(${closePidA}));`)).at(-1) === "t") { closeCommandBlocked = true; break; }
      await new Promise((done) => setTimeout(done, 20));
    }
    await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(owner3)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: owner3, aal: "aal1" }))},false);set role authenticated;begin isolation level ${m2aIsolation};`);
    const closePidB = Number((await b.ok("select pg_backend_pid();")).at(-1));
    const recordBeforeClose = { contractVersion: 1, operationId: uid(52), kind: "operation.record", expectedRevisions: { [`task:${task3}`]: "0" }, payload: { taskId: task3, workDate: "2026-10-15", quantity: 1, reference: null } };
    const waitingCloseRecord = b.query(`select api.command_v1('${JSON.stringify(recordBeforeClose).replaceAll("'", "''")}'::jsonb);`);
    const closeDeadline = Date.now() + 10000;
    let closeBlocked = false;
    while (Date.now() < closeDeadline) {
      const line = (await observer.ok(`select ${closePidA}=any(pg_catalog.pg_blocking_pids(${closePidB}));`)).at(-1);
      if (line === "t") { closeBlocked = true; break; }
      await new Promise((done) => setTimeout(done, 20));
    }
    await observer.ok("commit;");
    const closeCommandResult = await closeCommand;
    assert.equal(closeCommandResult.code, "00000", JSON.stringify(closeCommandResult));
    await a.ok("commit;");
    const recordAfterClose = await waitingCloseRecord;
    const recordCloseEnd = await b.query(recordAfterClose.code === "00000" ? "commit;" : "rollback;");
    assert.equal(closeCommandBlocked, true);
    assert.equal(closeBlocked, true);
    assert.equal(recordAfterClose.code, "40001", JSON.stringify(recordAfterClose));
    assert.equal(recordCloseEnd.code, "00000", JSON.stringify(recordCloseEnd));
    const recordCloseRetry = await b.query(`select api.command_v1('${JSON.stringify(recordBeforeClose).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(recordCloseRetry.code, "55000", JSON.stringify(recordCloseRetry));
    const closedRaceEntries = await observer.query(`select count(*) from public.activity_entries where instance_id=${lit(task3)};`);
    assert.equal(closedRaceEntries.lines.at(-1), "0");
    record("M2.2A public monthly close revalidates a coordinated concurrent record and denies its retry", true, { closeBlocked: closeCommandBlocked, recordBlocked: closeBlocked, closeSQLSTATE: closeCommandResult.code, firstSQLSTATE: recordAfterClose.code, retrySQLSTATE: recordCloseRetry.code, activityEntries: 0 });
    await a.ok("reset role;");
    await b.ok("reset role;");
    const owner4 = uid(53), assignment4 = uid(54), task4 = uid(55), plan4 = uid(56);
    await observer.ok(`insert into auth.users(id) values(${lit(owner4)});
      insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(owner4)},${lit(org)},'Synthetic fourth employee','empleado','Test','Test','Test');
      insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(owner4)});
      insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(owner4)});
      insert into public.task_assignments(id,organization_id,template_id,template_version_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,start_date,month_day)
       values(${lit(assignment4)},${lit(org)},${lit(template2)},${lit(version2)},${lit(company)},${lit(owner4)},${lit(team)},'Synthetic covered invoices','operativa',5,'facturas',10,'mensual','2026-10-01',31,'2026-10-01',31);
      insert into public.task_instances(id,organization_id,assignment_id,template_version_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,unit,target,status,due_date,checklist)
       values(${lit(task4)},${lit(org)},${lit(assignment4)},${lit(version2)},${lit(company)},${lit(owner4)},${lit(team)},'2026-10-01','2026-10-01','Synthetic covered invoices','operativa',5,'facturas',10,'Pendiente','2026-10-31','[]');
      insert into public.task_coverage_plans(id,organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by,sealed,sealed_by,sealed_at)
       values(${lit(plan4)},${lit(org)},${lit(owner4)},${lit(actor)},'2026-10-01','2026-10-31','licencia',${lit(boss)},false,null,null);
      insert into public.task_coverage_plan_instances(plan_id,organization_id,instance_id,company_id_snapshot,period_snapshot,responsibility_set_id)
       select ${lit(plan4)},${lit(org)},${lit(task4)},${lit(company)},'2026-10-01',h.set_id from public.task_responsibility_heads h where h.instance_id=${lit(task4)};
      update public.task_coverage_plans set sealed=true,sealed_by=${lit(boss)},sealed_at=clock_timestamp() where id=${lit(plan4)};
      reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;
      select public.approve_task_coverage_plan(${lit(plan4)},${lit(uid(59))});reset role;`);
    const binding4 = (await observer.ok(`select id from public.task_coverage_bindings where instance_id=${lit(task4)} and status='active' order by id limit 1;`)).at(-1);
    await observer.ok(`begin;select public._coordination_lock_keys(1104,array[${lit(`${owner4}:2026-10-01`)}]);`);
    await a.ok(`begin isolation level ${m2aIsolation};`);
    const coveragePidA = Number((await a.ok("select pg_backend_pid();")).at(-1));
    const cancellationCommand = a.query(`select public.cancel_task_coverage_binding(${lit(binding4)},'Cancelación concurrente sintética',${lit(uid(60))});`);
    let cancellationBlocked = false;
    const cancellationDeadline = Date.now() + 10000;
    while (Date.now() < cancellationDeadline) {
      if ((await observer.ok(`select ${blockerPid}=any(pg_catalog.pg_blocking_pids(${coveragePidA}));`)).at(-1) === "t") { cancellationBlocked = true; break; }
      await new Promise((done) => setTimeout(done, 20));
    }
    await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level ${m2aIsolation};`);
    const coveragePidB = Number((await b.ok("select pg_backend_pid();")).at(-1));
    const coveredRecord = { contractVersion: 1, operationId: uid(58), kind: "operation.record", expectedRevisions: { [`task:${task4}`]: "0" }, payload: { taskId: task4, workDate: "2026-10-15", quantity: 1, reference: null } };
    const waitingCoveredRecord = b.query(`select api.command_v1('${JSON.stringify(coveredRecord).replaceAll("'", "''")}'::jsonb);`);
    const coverageDeadline = Date.now() + 10000;
    let coverageBlocked = false;
    while (Date.now() < coverageDeadline) {
      const line = (await observer.ok(`select ${coveragePidA}=any(pg_catalog.pg_blocking_pids(${coveragePidB}));`)).at(-1);
      if (line === "t") { coverageBlocked = true; break; }
      await new Promise((done) => setTimeout(done, 20));
    }
    await observer.ok("commit;");
    const cancellationResult = await cancellationCommand;
    assert.equal(cancellationResult.code, "00000", JSON.stringify(cancellationResult));
    await a.ok("commit;");
    const coveredRecordAfterCancel = await waitingCoveredRecord;
    const coverageRecordEnd = await b.query(coveredRecordAfterCancel.code === "00000" ? "commit;" : "rollback;");
    assert.equal(cancellationBlocked, true);
    assert.equal(coverageBlocked, true);
    assert.equal(coveredRecordAfterCancel.code, "40001", JSON.stringify(coveredRecordAfterCancel));
    assert.equal(coverageRecordEnd.code, "00000", JSON.stringify(coverageRecordEnd));
    const cancelledReplay = await b.query(`select api.command_v1('${JSON.stringify(coveredRecord).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(cancelledReplay.code, "42501", JSON.stringify(cancelledReplay));
    const coverageRaceEntries = await observer.query(`select count(*) from public.activity_entries where instance_id=${lit(task4)};`);
    assert.equal(coverageRaceEntries.lines.at(-1), "0");
    record("M2.2A public coverage cancellation revalidates a coordinated waiting record", true, { cancellationBlocked, recordBlocked: coverageBlocked, cancellationSQLSTATE: cancellationResult.code, firstSQLSTATE: coveredRecordAfterCancel.code, retrySQLSTATE: cancelledReplay.code, activityEntries: 0 });
    const owner5 = uid(91), assignment5 = uid(92), task5 = uid(93), plan5 = uid(94);
    await observer.ok(`insert into auth.users(id) values(${lit(owner5)});
      insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(owner5)},${lit(org)},'Synthetic fifth employee','empleado','Test','Test','Test');
      insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(owner5)});
      insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(owner5)});
      insert into public.task_assignments(id,organization_id,template_id,template_version_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,start_date,month_day)
       values(${lit(assignment5)},${lit(org)},${lit(template2)},${lit(version2)},${lit(company)},${lit(owner5)},${lit(team)},'Synthetic fifth invoices','operativa',5,'facturas',10,'mensual','2026-10-01',31,'2026-10-01',31);
      insert into public.task_instances(id,organization_id,assignment_id,template_version_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,unit,target,status,due_date,checklist)
       values(${lit(task5)},${lit(org)},${lit(assignment5)},${lit(version2)},${lit(company)},${lit(owner5)},${lit(team)},'2026-10-01','2026-10-01','Synthetic fifth invoices','operativa',5,'facturas',10,'Pendiente','2026-10-31','[]');
      insert into public.task_coverage_plans(id,organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by,sealed,sealed_by,sealed_at)
       values(${lit(plan5)},${lit(org)},${lit(owner5)},${lit(actor)},'2026-10-01','2026-10-31','licencia',${lit(boss)},false,null,null);
      insert into public.task_coverage_plan_instances(plan_id,organization_id,instance_id,company_id_snapshot,period_snapshot,responsibility_set_id)
       select ${lit(plan5)},${lit(org)},${lit(task5)},${lit(company)},'2026-10-01',h.set_id from public.task_responsibility_heads h where h.instance_id=${lit(task5)};
      update public.task_coverage_plans set sealed=true,sealed_by=${lit(boss)},sealed_at=clock_timestamp() where id=${lit(plan5)};
      reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;
      select public.approve_task_coverage_plan(${lit(plan5)},${lit(uid(95))});reset role;`);
    const binding5 = (await observer.ok(`select id from public.task_coverage_bindings where instance_id=${lit(task5)} and status='active' order by id limit 1;`)).at(-1);
    const coverageRecordFirstRevision = (await observer.query(`select state_revision from public.task_instances where id=${lit(task5)};`)).lines.at(-1);
    const recordBeforeCancelPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
    const cancelAfterRecordPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
    await b.ok(`begin isolation level ${m2aIsolation};`);
    const coveredRecordFirst = { contractVersion: 1, operationId: uid(96), kind: "operation.record", expectedRevisions: { [`task:${task5}`]: coverageRecordFirstRevision }, payload: { taskId: task5, workDate: "2026-10-15", quantity: 1, reference: "coverage-before-cancel" } };
    const recordBeforeCancel = await b.query(`select api.command_v1('${JSON.stringify(coveredRecordFirst).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(recordBeforeCancel.code, "00000", JSON.stringify(recordBeforeCancel));
    await a.ok(`begin isolation level ${m2aIsolation};`);
    const cancelAfterRecordPending = a.query(`select public.cancel_task_coverage_binding(${lit(binding5)},'Cancelación posterior al registro',${lit(uid(97))});`);
    const cancelAfterRecordDeadline = Date.now() + 10000;
    let cancelAfterRecordBlocked = false;
    while (Date.now() < cancelAfterRecordDeadline) {
      if ((await observer.ok(`select ${recordBeforeCancelPid}=any(pg_catalog.pg_blocking_pids(${cancelAfterRecordPid}));`)).at(-1) === "t") { cancelAfterRecordBlocked = true; break; }
      await new Promise((done) => setTimeout(done, 20));
    }
    await b.ok("commit;");
    const cancelAfterRecordResult = await cancelAfterRecordPending;
    await a.query(cancelAfterRecordResult.code === "00000" ? "commit;" : "rollback;");
    const cancelAfterRecordRetry = await a.query(`select public.cancel_task_coverage_binding(${lit(binding5)},'Cancelación posterior al registro',${lit(uid(98))});`);
    const coverageFirstEvidence = await observer.query(`select (select actor_id from public.activity_entries where instance_id=${lit(task5)} and reference='coverage-before-cancel')::text||'|'||(select status from public.task_coverage_bindings where id=${lit(binding5)});`);
    assert.equal(cancelAfterRecordBlocked, true);
    assert.equal(cancelAfterRecordResult.code, "40001", JSON.stringify(cancelAfterRecordResult));
    assert.equal(cancelAfterRecordRetry.code, "00000", JSON.stringify(cancelAfterRecordRetry));
    assert.equal(coverageFirstEvidence.lines.at(-1), `${actor}|cancelled`);
    record("M2.2A record-first coverage cancellation preserves the real executor and completes on retry", true, { blocked: cancelAfterRecordBlocked, recordSQLSTATE: recordBeforeCancel.code, cancellationSQLSTATE: cancelAfterRecordResult.code, retrySQLSTATE: cancelAfterRecordRetry.code, activityAndCoverage: coverageFirstEvidence.lines.at(-1) });
    await a.ok("reset role;");
    await b.ok("reset role;");
    await b.ok(`select set_config('request.jwt.claim.sub',${lit(owner4)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: owner4, aal: "aal1" }))},false);set role authenticated;begin isolation level repeatable read;select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "operationalSummary", filters: { taskId: task4 }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
    const staleSnapshotCloseRecord = { contractVersion: 1, operationId: uid(81), kind: "operation.record", expectedRevisions: { [`task:${task4}`]: "0" }, payload: { taskId: task4, workDate: "2026-10-15", quantity: 1, reference: null } };
    await a.ok(`reset role;insert into public.monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values(${lit(org)},${lit(owner4)},'2026-10-01','{}'::jsonb,${lit(boss)},'Cierre que gana la carrera RR');commit;`);
    const staleCloseWrite = await b.query(`select api.command_v1('${JSON.stringify(staleSnapshotCloseRecord).replaceAll("'", "''")}'::jsonb);`);
    const staleCloseCommit = await b.query(staleCloseWrite.code === "00000" ? "commit;" : "rollback;");
    assert.equal(staleCloseWrite.code, "40001", JSON.stringify(staleCloseWrite));
    assert.equal(staleCloseCommit.code, "00000", JSON.stringify(staleCloseCommit));
    const staleCloseState = await observer.query(`select (select count(*) from public.activity_entries where instance_id=${lit(task4)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(uid(81))});`);
    assert.equal(staleCloseState.lines.at(-1), "0|0");
    record("M2.2A stale RR snapshot cannot write into a newly closed month", true, { writeSQLSTATE: staleCloseWrite.code, artifacts: staleCloseState.lines.at(-1) });
    await b.ok("reset role;");
    await claims({ role: "authenticated", sub: actor, aal: "aal1" });
    const employeeRates = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "rateHistory", filters: { companyId: company, templateId: template, taskId: null }, cursor: null, limit: 10 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(employeeRates.code, "42501", JSON.stringify(employeeRates));
    await a.ok("reset role;");
    const manager = uid(68);
    await observer.ok(`insert into auth.users(id) values(${lit(manager)});
      insert into public.profiles(id,organization_id,name,role,manager_id,sector,branch,position) values(${lit(manager)},${lit(org)},'Synthetic scoped manager','encargado',${lit(boss)},'Test','Test','Manager');
      insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(manager)});
      insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(manager)});
      update public.profiles set manager_id=${lit(manager)} where id=${lit(actor)};`);
    // Supervisory business profiles require aal2 even for scoped consultation.
    await claims({ role: "authenticated", sub: manager, aal: "aal2" }, manager);
    const managerContext = await a.query("select api.get_context_v1();");
    assert.equal(managerContext.code, "00000", JSON.stringify(managerContext));
    const managerActivity = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: task }, cursor: null, limit: 10 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(managerActivity.code, "00000", JSON.stringify({ managerActivity, managerContext: managerContext.lines.at(-1) }));
    const managerOutOfScope = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: task2 }, cursor: null, limit: 10 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(managerOutOfScope.code, "42501", JSON.stringify(managerOutOfScope));
    const managerQuality = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "quality", filters: { taskId: task }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(managerQuality.code, "42501", JSON.stringify(managerQuality));
    const managerRecord = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: uid(69), kind: "operation.record", expectedRevisions: { [`task:${task}`]: "4" }, payload: { taskId: task, workDate: "2026-10-15", quantity: 1, reference: null } }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(managerRecord.code, "42501", JSON.stringify(managerRecord));
    await a.ok("reset role;");
    await observer.ok(`update public.profiles set manager_id=null where id=${lit(actor)};`);
    const otherOrg = uid(60), foreignOwner = uid(61), foreignCompany = uid(62), foreignTeam = uid(63), foreignTemplate = uid(64), foreignVersion = uid(65), foreignAssignment = uid(66), foreignTask = uid(67);
    await observer.ok(`insert into public.organizations(id,name) values(${lit(otherOrg)},'Synthetic other organization');
      insert into auth.users(id) values(${lit(foreignOwner)});
      insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(foreignOwner)},${lit(otherOrg)},'Other organization employee','empleado','Test','Other','Test');
      insert into public.companies(id,organization_id,name) values(${lit(foreignCompany)},${lit(otherOrg)},'Other company');
      insert into public.teams(id,organization_id,name,manager_id) values(${lit(foreignTeam)},${lit(otherOrg)},'Other team',${lit(foreignOwner)});
      insert into public.team_members(organization_id,team_id,profile_id) values(${lit(otherOrg)},${lit(foreignTeam)},${lit(foreignOwner)});
      insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(otherOrg)},${lit(foreignCompany)},${lit(foreignOwner)});
      insert into public.task_templates(id,organization_id,title,kind,weight,unit,monthly_target) values(${lit(foreignTemplate)},${lit(otherOrg)},'Other invoices','operativa',5,'facturas',10);
      insert into public.task_template_versions(id,organization_id,template_id,version,title,objective,sector,kind,weight,unit,monthly_target) values(${lit(foreignVersion)},${lit(otherOrg)},${lit(foreignTemplate)},1,'Other invoices','','Test','operativa',5,'facturas',10);
      insert into public.task_assignments(id,organization_id,template_id,template_version_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,start_date,month_day)
       values(${lit(foreignAssignment)},${lit(otherOrg)},${lit(foreignTemplate)},${lit(foreignVersion)},${lit(foreignCompany)},${lit(foreignOwner)},${lit(foreignTeam)},'Other invoices','operativa',5,'facturas',10,'mensual','2026-10-01',31,'2026-10-01',31);
      insert into public.task_instances(id,organization_id,assignment_id,template_version_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,unit,target,status,due_date,checklist)
       values(${lit(foreignTask)},${lit(otherOrg)},${lit(foreignAssignment)},${lit(foreignVersion)},${lit(foreignCompany)},${lit(foreignOwner)},${lit(foreignTeam)},'2026-10-01','2026-10-01','Other invoices','operativa',5,'facturas',10,'Pendiente','2026-10-31','[]');`);
    await claims({ role: "authenticated", sub: actor, aal: "aal1" });
    const foreignQuery = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: foreignTask }, cursor: null, limit: 10 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(foreignQuery.code, "42501", JSON.stringify(foreignQuery));
    await a.ok("reset role;");
    await claims({ role: "authenticated", sub: foreignOwner, aal: "aal1" }, foreignOwner);
    const ownForeignTask = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: foreignTask }, cursor: null, limit: 10 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(ownForeignTask.code, "00000", JSON.stringify(ownForeignTask));
    const actorRevision = (await observer.query(`select state_revision from public.task_instances where id=${lit(task)};`)).lines.at(-1);
    const actorActivityBefore = (await observer.query(`select count(*) from public.activity_entries where instance_id=${lit(task)};`)).lines.at(-1);
    await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level repeatable read;select count(*) from public.task_instances where id=${lit(task)};`);
    await observer.ok(`update public.profiles set active=false where id=${lit(actor)};`);
    const revokedActorWrite = await b.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: uid(82), kind: "operation.record", expectedRevisions: { [`task:${task}`]: actorRevision }, payload: { taskId: task, workDate: "2026-10-15", quantity: 1, reference: null } }).replaceAll("'", "''")}'::jsonb);`);
    await b.query("rollback;");
    assert.equal(revokedActorWrite.code, "40001", JSON.stringify(revokedActorWrite));
    const actorRevokedArtifacts = await observer.query(`select (select count(*) from public.activity_entries where instance_id=${lit(task)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(uid(82))});`);
    assert.equal(actorRevokedArtifacts.lines.at(-1), `${actorActivityBefore}|0`);
    await observer.ok(`update public.profiles set active=true where id=${lit(actor)};`);
    await b.ok("reset role;");
    record("M2.2A stale RR actor snapshot cannot write after profile deactivation", true, { writeSQLSTATE: revokedActorWrite.code, activityAndReceipt: actorRevokedArtifacts.lines.at(-1) });
    await a.ok(`reset role;update public.profiles set active=false where id=${lit(foreignOwner)};`);
    await claims({ role: "authenticated", sub: foreignOwner, aal: "aal1" }, foreignOwner);
    const inactiveRead = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: foreignTask }, cursor: null, limit: 10 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(inactiveRead.code, "42501", JSON.stringify(inactiveRead));
    await a.ok("reset role;");
    await a.ok(`update public.profiles set active=false where id=${lit(actor)};`);
    await claims({ role: "authenticated", sub: actor, aal: "aal1" });
    const revokedReceipt = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "commandReceipt", filters: { operationId: uid(31) }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(revokedReceipt.code, "42501", JSON.stringify(revokedReceipt));
    await a.ok(`reset role;update public.profiles set active=true where id=${lit(actor)};`);
    record("M2.2A manager can consult only assigned scope; execution, private quality, foreign, and inactive access deny", true, { managerActivity: managerActivity.code, managerOutOfScopeDenied: managerOutOfScope.code, managerQualityDenied: managerQuality.code, managerRecordDenied: managerRecord.code, employeeRateHistory: employeeRates.code, foreignTaskDenied: foreignQuery.code, foreignOwnerRead: ownForeignTask.code, inactiveOwnerDenied: inactiveRead.code, revokedReceiptDenied: revokedReceipt.code });
    record("M2.2A operation, rate, assessment, and query smoke", true, { task, quantity: 7 });
    await a.ok("reset role;");
    await observer.ok(`create function app_private.m2_2a_injected_write_failure() returns trigger language plpgsql set search_path='' as $$ begin
      if tg_table_name='activity_entries' then if new.reference='m2-2a-rollback-marker' then raise exception using errcode='23514',message='synthetic rollback probe'; end if;
      elsif tg_table_name='operational_rate_versions' then if new.reason='m2-2a-rollback-marker' then raise exception using errcode='23514',message='synthetic rollback probe'; end if;
      elsif tg_table_name='operational_assessment_versions' then if new.observation='m2-2a-rollback-marker' then raise exception using errcode='23514',message='synthetic rollback probe'; end if; end if;
      return new; end $$;
      create trigger m2_2a_rollback_activity before insert on public.activity_entries for each row execute function app_private.m2_2a_injected_write_failure();
      create trigger m2_2a_rollback_rate before insert on app_private.operational_rate_versions for each row execute function app_private.m2_2a_injected_write_failure();
      create trigger m2_2a_rollback_assessment before insert on app_private.operational_assessment_versions for each row execute function app_private.m2_2a_injected_write_failure();`);
    const rollbackRecord = { contractVersion: 1, operationId: uid(70), kind: "operation.record", expectedRevisions: { [`task:${task}`]: String((await observer.query(`select state_revision from public.task_instances where id=${lit(task)};`)).lines.at(-1)) }, payload: { taskId: task, workDate: "2026-10-15", quantity: 1, reference: "m2-2a-rollback-marker" } };
    await claims({ role: "authenticated", sub: actor, aal: "aal1" });
    const failedRecord = await a.query(`select api.command_v1('${JSON.stringify(rollbackRecord).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(failedRecord.code, "23514", JSON.stringify(failedRecord));
    const recordRollbackState = await observer.query(`select (select count(*) from public.activity_entries where reference='m2-2a-rollback-marker'),(select count(*) from app_private.api_command_receipts where operation_id=${lit(uid(70))}),(select count(*) from app_private.api_operation_fences where operation_id=${lit(uid(70))});`);
    assert.equal(recordRollbackState.lines.at(-1), "0|0|0");
    await a.ok("reset role;");
    const rateStateBefore = await observer.query(`select config_revision,fence_epoch from app_private.operational_rate_heads where organization_id=${lit(org)} and company_id=${lit(company)} and template_id=${lit(template)} and instance_id is null;`);
    await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
    const failedRate = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: uid(71), kind: "operation.rate", expectedRevisions: { [`rate:${company}:template:${template}`]: "2" }, payload: { companyId: company, templateId: template, taskId: null, effectiveOn: "2026-12-01", unitWeight: "4", reason: "m2-2a-rollback-marker" } }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(failedRate.code, "23514", JSON.stringify(failedRate));
    const rateRollbackState = await observer.query(`select h.config_revision,h.fence_epoch,(select count(*) from app_private.operational_rate_versions v where v.head_id=h.id and v.reason='m2-2a-rollback-marker'),(select count(*) from app_private.api_command_receipts where operation_id=${lit(uid(71))}),(select count(*) from app_private.api_operation_fences where operation_id=${lit(uid(71))}) from app_private.operational_rate_heads h where h.organization_id=${lit(org)} and h.company_id=${lit(company)} and h.template_id=${lit(template)} and h.instance_id is null;`);
    assert.equal(rateRollbackState.lines.at(-1), `${rateStateBefore.lines.at(-1)}|0|0|0`);
    const assessmentStateBefore = await observer.query(`select t.state_revision,a.revision from public.task_instances t join app_private.operational_assessments a on a.instance_id=t.id where t.id=${lit(task)};`);
    const [taskRevision, assessmentRevision] = assessmentStateBefore.lines.at(-1).split("|");
    const failedAssessment = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: uid(72), kind: "operation.assess", expectedRevisions: { [`task:${task}`]: taskRevision, [`assessment:${task}`]: assessmentRevision }, payload: { taskId: task, quality: 70, order: 70, timeliness: 70, observation: "m2-2a-rollback-marker" } }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(failedAssessment.code, "23514", JSON.stringify(failedAssessment));
    const assessmentRollbackState = await observer.query(`select t.state_revision,a.revision,(select count(*) from app_private.operational_assessment_versions v where v.instance_id=t.id and v.observation='m2-2a-rollback-marker'),(select count(*) from app_private.api_command_receipts where operation_id=${lit(uid(72))}),(select count(*) from app_private.api_operation_fences where operation_id=${lit(uid(72))}) from public.task_instances t join app_private.operational_assessments a on a.instance_id=t.id where t.id=${lit(task)};`);
    assert.equal(assessmentRollbackState.lines.at(-1), `${assessmentStateBefore.lines.at(-1)}|0|0|0`);
    await a.ok("reset role;");
    await observer.ok(`drop trigger m2_2a_rollback_activity on public.activity_entries; drop trigger m2_2a_rollback_rate on app_private.operational_rate_versions; drop trigger m2_2a_rollback_assessment on app_private.operational_assessment_versions; drop function app_private.m2_2a_injected_write_failure();`);
    record("M2.2A injected failures roll back all partial writes for record, rate, and assessment", true, { record: recordRollbackState.lines.at(-1), rate: rateRollbackState.lines.at(-1), assessment: assessmentRollbackState.lines.at(-1) });
    if (flags["--m2-2a-independent"]) {
      // Record wins the actor coordination lock; revocation waits, then commits.
      // An exact retry after the committed revocation must be denied.
      const recordFirstRevision = (await observer.query(`select state_revision from public.task_instances where id=${lit(task)};`)).lines.at(-1);
      const recordFirstRevocation = { contractVersion: 1, operationId: uid(101), kind: "operation.record", expectedRevisions: { [`task:${task}`]: recordFirstRevision }, payload: { taskId: task, workDate: "2026-10-15", quantity: 1, reference: "record-before-revocation" } };
      await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level ${m2aFirstIsolation};`);
      const recordFirstRevocationPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const recordFirstRevocationResult = await a.query(`select api.command_v1('${JSON.stringify(recordFirstRevocation).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(recordFirstRevocationResult.code, "00000", JSON.stringify(recordFirstRevocationResult));
      await b.ok(`reset role;begin isolation level ${m2aSecondIsolation};select count(*) from public.profiles where id=${lit(actor)};`);
      const revokerPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const waitingRevocationLock = b.query(`select public._coordination_lock_keys(1102,array[${lit(actor)}]);`);
      const recordFirstRevocationDeadline = Date.now() + 10000;
      let recordFirstRevocationBlocked = false;
      while (Date.now() < recordFirstRevocationDeadline) {
        if ((await observer.ok(`select ${recordFirstRevocationPid}=any(pg_catalog.pg_blocking_pids(${revokerPid}));`)).at(-1) === "t") { recordFirstRevocationBlocked = true; break; }
        await new Promise((done) => setTimeout(done, 20));
      }
      await a.ok("commit;");
      await waitingRevocationLock;
      const revokeAfterRecord = await b.query(`update public.profiles set active=false where id=${lit(actor)};`);
      assert.equal(revokeAfterRecord.code, "00000", JSON.stringify(revokeAfterRecord));
      await b.ok("commit;");
      await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;`);
      const deniedPostRevocationReplay = await a.query(`select api.command_v1('${JSON.stringify(recordFirstRevocation).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(deniedPostRevocationReplay.code, "42501", JSON.stringify(deniedPostRevocationReplay));
      await a.ok("reset role;");
      const recordFirstRevocationState = await observer.query(`select (select count(*) from public.activity_entries where instance_id=${lit(task)} and reference='record-before-revocation')||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(uid(101))})||'|'||(select active from public.profiles where id=${lit(actor)});`);
      assert.equal(recordFirstRevocationBlocked, true);
      assert.equal(recordFirstRevocationState.lines.at(-1), "1|1|false");
      await observer.ok(`update public.profiles set active=true where id=${lit(actor)};`);
      record("M2.2A record-first actor revocation waits for the record then denies exact replay", true, { isolationPair: `${m2aFirstIsolation}/${m2aSecondIsolation}`, blocked: recordFirstRevocationBlocked, recordSQLSTATE: recordFirstRevocationResult.code, revocationSQLSTATE: revokeAfterRecord.code, replaySQLSTATE: deniedPostRevocationReplay.code, activityReceiptActorState: recordFirstRevocationState.lines.at(-1) });
      // Model a revocation writer that follows the agreed actor coordination lock.
      // Both transactions are rolled back; this is a disposable synthetic cluster.
      await a.ok(`reset role;begin isolation level ${m2aFirstIsolation};`);
      await a.ok(`select public._coordination_lock_keys(1102,array[${lit(actor)}]);`);
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level ${m2aSecondIsolation};`);
      const probePidA = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const probePidB = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const probeRevision = (await observer.query(`select state_revision from public.task_instances where id=${lit(task)};`)).lines.at(-1);
      const probeActivityBefore = (await observer.query(`select count(*) from public.activity_entries where instance_id=${lit(task)} and actor_id=${lit(actor)} and measurement_version=2;`)).lines.at(-1);
      const probeArgs = { contractVersion: 1, operationId: uid(83), kind: "operation.record", expectedRevisions: { [`task:${task}`]: probeRevision }, payload: { taskId: task, workDate: "2026-10-15", quantity: 1, reference: null } };
      const probeWriter = b.query(`select api.command_v1('${JSON.stringify(probeArgs).replaceAll("'", "''")}'::jsonb);`);
      let probeBlocked = false;
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if ((await observer.ok(`select ${probePidA}=any(pg_catalog.pg_blocking_pids(${probePidB}));`)).at(-1) === "t") { probeBlocked = true; break; }
        await new Promise(done => setTimeout(done, 20));
      }
      const probeRevoke = a.query(`update public.profiles set active=false where id=${lit(actor)};`);
      const revocationResult = await probeRevoke;
      await a.ok("commit;");
      const writerResult = await probeWriter;
      await b.query("rollback;");
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;`);
      const revokedReplay = await b.query(`select api.command_v1('${JSON.stringify(nextCommand).replaceAll("'", "''")}'::jsonb);`);
      await b.ok("reset role;");
      const probeArtifacts = (await observer.ok(`select (select count(*) from app_private.api_command_receipts where operation_id=${lit(uid(83))})||'|'||(select count(*) from public.activity_entries where instance_id=${lit(task)} and actor_id=${lit(actor)} and measurement_version=2)||'|'||(select active from public.profiles where id=${lit(actor)});`)).at(-1);
      await observer.ok(`update public.profiles set active=true where id=${lit(actor)};`);
      const [receiptCount, activityCount, inactive] = probeArtifacts.split("|");
      record("M2.2A coordinated actor revocation denies a waiting record and exact replay without deadlock or partial write", probeBlocked && revocationResult.code === "00000" && ["42501", "40001"].includes(writerResult.code) && revokedReplay.code === "42501" && receiptCount === "0" && activityCount === probeActivityBefore && inactive === "false", { blocked: probeBlocked, revocationSQLSTATE: revocationResult.code, recordSQLSTATE: writerResult.code, revokedReplaySQLSTATE: revokedReplay.code, beforeActivity: probeActivityBefore, finalArtifacts: probeArtifacts });
      await b.ok("reset role;");
    }
    const legacyClose = await a.query(`insert into public.monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values(${lit(org)},${lit(actor)},'2026-10-01','{}'::jsonb,${lit(boss)},'Legacy close guard smoke');`);
    assert.equal(legacyClose.code, "0A000", JSON.stringify(legacyClose));
  }
  const technical = uid(3);
  await a.ok(`insert into auth.users(id) values(${lit(technical)});
    insert into app_private.technical_accounts(user_id,organization_id,display_name) values(${lit(technical)},${lit(org)},'Synthetic technical');`);
  for (const principal of [
    ["business", actor],
    ["technical", technical],
  ])
    for (const [name, claim] of [
      ["missing AAL", { role: "authenticated" }],
      ["null AAL", { role: "authenticated", aal: null }],
      ["empty AAL", { role: "authenticated", aal: "" }],
      ["unknown AAL", { role: "authenticated", aal: "aal3" }],
    ]) {
      await claims(claim, principal[1]);
      const response = await a.query("select api.get_context_v1();");
      record(`${principal[0]} ${name}`, response.code === "42501", {
        expectedSQLSTATE: "42501",
        observedSQLSTATE: response.code,
        body: response.lines.at(-1),
      });
    }
  for (const [name, value, expected] of [
    ["whitespace-only display name", "\t\n", "deny"],
    ["Unicode code-point display name", "😀".repeat(150), "decode"],
    [
      "mixed ECMAScript whitespace",
      "\u00a0\ufeff\tValid Name\u2028\u3000",
      "normalized",
    ],
    ["maximum 200 code points", "x".repeat(200), "decode"],
    ["over maximum 201 code points", "x".repeat(201), "deny"],
  ]) {
    await a.ok(
      `reset role;update public.profiles set name=${lit(value)} where id=${lit(actor)};`,
    );
    await claims({ role: "authenticated", aal: "aal1" });
    const response = await a.query("select api.get_context_v1();");
    const decoded =
      response.code === "00000"
        ? decodeContextV1(JSON.parse(response.lines.at(-1)))
        : null;
    record(
      name,
      expected === "deny"
        ? response.code === "42501"
        : decoded?.ok === true &&
            decoded.context.principal.displayName ===
              (expected === "normalized" ? "Valid Name" : value),
      {
        expected,
        observedSQLSTATE: response.code,
        decoded: decoded?.ok ?? null,
      },
    );
  }
  await a.ok(`reset role;update public.profiles set name='Synthetic employee' where id=${lit(actor)};
    alter table app_private.technical_accounts disable trigger technical_accounts_principal_identity_guard;
    insert into app_private.technical_accounts(user_id,organization_id,display_name,active) values(${lit(actor)},${lit(org)},'Corrupt inactive duplicate',false);
    alter table app_private.technical_accounts enable trigger technical_accounts_principal_identity_guard;`);
  await claims({ role: "authenticated", aal: "aal1" });
  const duplicate = await a.query("select api.get_context_v1();");
  record(
    "corrupted dual identity with an inactive duplicate",
    duplicate.code === "42501",
    { expectedSQLSTATE: "42501", observedSQLSTATE: duplicate.code },
  );
  await a.ok(
    `reset role;delete from app_private.technical_accounts where user_id=${lit(actor)};`,
  );
  const pidA = Number((await a.ok("select pg_backend_pid();")).at(-1));
  const pidB = Number((await b.ok("select pg_backend_pid();")).at(-1));
  let serial = 100;
  for (const isolation of [
    "read committed",
    "repeatable read",
    "serializable",
  ]) {
    for (const firstKind of ["business", "technical"]) {
      const identity = uid(++serial);
      await observer.ok(`insert into auth.users(id) values(${lit(identity)});`);
      const insert = (kind) =>
        kind === "business"
          ? `insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(identity)},${lit(org)},'Synthetic race','empleado','Test','Test','Test');`
          : `insert into app_private.technical_accounts(user_id,organization_id,display_name) values(${lit(identity)},${lit(org)},'Synthetic race');`;
      await a.ok(`begin isolation level ${isolation};`);
      await b.ok(
        `begin isolation level ${isolation};select count(*) from public.profiles;`,
      );
      await a.ok(insert(firstKind));
      const pending = b.query(
        insert(firstKind === "business" ? "technical" : "business"),
      );
      const deadline = Date.now() + 10000;
      let blocked = false;
      while (Date.now() < deadline) {
        const line = (
          await observer.ok(
            `select ${pidA}=any(pg_catalog.pg_blocking_pids(${pidB}));`,
          )
        ).at(-1);
        if (line === "t") {
          blocked = true;
          break;
        }
        await new Promise((done) => setImmediate(done));
      }
      await a.ok("commit;");
      const second = await pending;
      const committed = await b.query(
        second.code === "00000" ? "commit;" : "rollback;",
      );
      const coexist =
        (
          await observer.ok(
            `select exists(select 1 from public.profiles p join app_private.technical_accounts t on t.user_id=p.id where p.id=${lit(identity)});`,
          )
        ).at(-1) === "t";
      record(
        `identity race ${isolation}: ${firstKind} first`,
        blocked &&
          !coexist &&
          ["23514", "40001"].includes(
            second.code === "00000" ? committed.code : second.code,
          ),
        {
          blocked,
          secondSQLSTATE: second.code,
          commitSQLSTATE: committed.code,
          coexist,
        },
      );
    }
  }
  for (const firstKind of ["business", "technical"]) {
    for (const [firstIsolation, secondIsolation] of [
      ["read committed", "repeatable read"],
      ["repeatable read", "read committed"],
    ]) {
      const source = uid(++serial),
        target = uid(++serial);
      await observer.ok(
        `insert into auth.users(id) values(${lit(source)}),(${lit(target)});`,
      );
      if (firstKind === "business")
        await observer.ok(
          `insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(source)},${lit(org)},'Synthetic update','empleado','Test','Test','Test');`,
        );
      else
        await observer.ok(
          `insert into app_private.technical_accounts(user_id,organization_id,display_name) values(${lit(source)},${lit(org)},'Synthetic update');`,
        );
      const firstUpdate =
        firstKind === "business"
          ? `update public.profiles set id=${lit(target)} where id=${lit(source)};`
          : `update app_private.technical_accounts set user_id=${lit(target)} where user_id=${lit(source)};`;
      const secondInsert =
        firstKind === "business"
          ? `insert into app_private.technical_accounts(user_id,organization_id,display_name) values(${lit(target)},${lit(org)},'Synthetic mixed race');`
          : `insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(target)},${lit(org)},'Synthetic mixed race','empleado','Test','Test','Test');`;
      await a.ok(`begin isolation level ${firstIsolation};`);
      await b.ok(
        `begin isolation level ${secondIsolation};select count(*) from public.profiles;select count(*) from app_private.technical_accounts;`,
      );
      await a.ok(firstUpdate);
      const pending = b.query(secondInsert);
      const deadline = Date.now() + 10000;
      let blocked = false;
      while (Date.now() < deadline) {
        if (
          (
            await observer.ok(
              `select ${pidA}=any(pg_catalog.pg_blocking_pids(${pidB}));`,
            )
          ).at(-1) === "t"
        ) {
          blocked = true;
          break;
        }
        await new Promise((done) => setImmediate(done));
      }
      await a.ok("commit;");
      const second = await pending;
      const committed = await b.query(
        second.code === "00000" ? "commit;" : "rollback;",
      );
      const finalCount = (
        await observer.ok(
          `select ((select count(*) from public.profiles where id=${lit(target)})+(select count(*) from app_private.technical_accounts where user_id=${lit(target)}))::text;`,
        )
      ).at(-1);
      const fenceRevision = (
        await observer.ok(
          `select revision::text from app_private.principal_identity_fences where user_id=${lit(target)};`,
        )
      ).at(-1);
      record(
        `identity UUID update race ${firstIsolation}/${secondIsolation}: ${firstKind} first`,
        blocked &&
          finalCount === "1" &&
          fenceRevision === "1" &&
          !["40P01"].includes(second.code) &&
          ["23514", "40001"].includes(
            second.code === "00000" ? committed.code : second.code,
          ),
        {
          blocked,
          secondSQLSTATE: second.code,
          commitSQLSTATE: committed.code,
          finalPrincipalCount: finalCount,
          fenceRevision,
        },
      );
      await observer.ok(
        `delete from public.profiles where id in (${lit(source)},${lit(target)});delete from app_private.technical_accounts where user_id in (${lit(source)},${lit(target)});`,
      );
    }
  }
  // Independent acceptance: the waiting transaction also changes an existing UUID.
  if (flags["--review-matrix"] === "full") {
    const makePrincipal = (kind, id) =>
      kind === "business"
        ? `insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(id)},${lit(org)},'Acceptance fixture','empleado','Test','Test','Test');`
        : `insert into app_private.technical_accounts(user_id,organization_id,display_name) values(${lit(id)},${lit(org)},'Acceptance fixture');`;
    const changeIdentity = (kind, from, to) =>
      kind === "business"
        ? `update public.profiles set id=${lit(to)} where id=${lit(from)};`
        : `update app_private.technical_accounts set user_id=${lit(to)} where user_id=${lit(from)};`;
    const waitForBlock = async () => {
      const until = Date.now() + 10000;
      while (Date.now() < until) {
        if (
          (
            await observer.ok(`select ${pidA}=any(pg_blocking_pids(${pidB}));`)
          ).at(-1) === "t"
        )
          return true;
        await new Promise((done) => setImmediate(done));
      }
      return false;
    };
    for (const firstKind of ["business", "technical"])
      for (const firstMutation of ["insert", "update"]) {
        const secondKind = firstKind === "business" ? "technical" : "business";
        for (const [firstIsolation, secondIsolation] of [
          ["read committed", "read committed"],
          ["read committed", "repeatable read"],
          ["repeatable read", "read committed"],
          ["repeatable read", "repeatable read"],
        ]) {
          const target = uid(++serial),
            sourceA = uid(++serial),
            sourceB = uid(++serial);
          await observer.ok(
            `insert into auth.users(id) values(${lit(target)}),(${lit(sourceA)}),(${lit(sourceB)});`,
          );
          if (firstMutation === "update")
            await observer.ok(makePrincipal(firstKind, sourceA));
          await observer.ok(makePrincipal(secondKind, sourceB));
          await a.ok(`begin isolation level ${firstIsolation};`);
          await b.ok(
            `begin isolation level ${secondIsolation};select count(*) from public.profiles;`,
          );
          await a.ok(
            firstMutation === "insert"
              ? makePrincipal(firstKind, target)
              : changeIdentity(firstKind, sourceA, target),
          );
          const pending = b.query(changeIdentity(secondKind, sourceB, target));
          const blocked = await waitForBlock();
          await a.ok("commit;");
          const second = await pending;
          await b.ok("rollback;");
          const state = JSON.parse(
            (
              await observer.ok(
                `select json_build_object('targetCount',(select count(*) from public.profiles where id=${lit(target)})+(select count(*) from app_private.technical_accounts where user_id=${lit(target)}),'loserPreserved',(select count(*) from public.profiles where id=${lit(sourceB)})+(select count(*) from app_private.technical_accounts where user_id=${lit(sourceB)}),'fenceRevision',(select revision::text from app_private.principal_identity_fences where user_id=${lit(target)}));`,
              )
            ).at(-1),
          );
          record(
            `acceptance ${firstKind} ${firstMutation}/update ${firstIsolation}/${secondIsolation}`,
            blocked &&
              ["23514", "40001"].includes(second.code) &&
              state.targetCount === 1 &&
              state.loserPreserved === 1 &&
              state.fenceRevision === "1",
            { blocked, secondSQLSTATE: second.code, ...state },
          );
        }
      }
    for (const firstKind of ["business", "technical"]) {
      const target = uid(++serial),
        secondKind = firstKind === "business" ? "technical" : "business";
      await observer.ok(`insert into auth.users(id) values(${lit(target)});`);
      await a.ok("begin;");
      await b.ok(
        "begin isolation level repeatable read;select count(*) from public.profiles;",
      );
      await a.ok(makePrincipal(firstKind, target));
      const pending = b.query(makePrincipal(secondKind, target));
      const blocked = await waitForBlock();
      await a.ok("rollback;");
      const second = await pending;
      const committed = await b.query(
        second.code === "00000" ? "commit;" : "rollback;",
      );
      const state = JSON.parse(
        (
          await observer.ok(
            `select json_build_object('targetCount',(select count(*) from public.profiles where id=${lit(target)})+(select count(*) from app_private.technical_accounts where user_id=${lit(target)}),'fenceRevision',(select revision::text from app_private.principal_identity_fences where user_id=${lit(target)}));`,
          )
        ).at(-1),
      );
      record(
        `acceptance rollback winner ${firstKind}`,
        blocked &&
          second.code === "00000" &&
          committed.code === "00000" &&
          state.targetCount === 1 &&
          state.fenceRevision === "1",
        {
          blocked,
          secondSQLSTATE: second.code,
          commitSQLSTATE: committed.code,
          ...state,
        },
      );
    }
  }
  const sqlFile = join(
    root,
    "supabase/migrations/202610140013_api_identity_foundation.sql",
  );
  const report = {
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    }).trim(),
    engine: native("postgres", ["--version"]).trim(),
    migrationSha256: createHash("sha256")
      .update(readFileSync(sqlFile))
      .digest("hex"),
    candidate: flags["--candidate"] ?? null,
    m2aIsolation,
    m2aFirstIsolation,
    m2aSecondIsolation,
    total: results.length,
    passed: results.filter((row) => row.passed).length,
    failed: results.filter((row) => !row.passed).length,
    results,
    providerAuth: "synthetic claims only; no hosted Supabase connection",
    references: [
      "https://www.postgresql.org/docs/17/transaction-iso.html",
      "https://www.postgresql.org/docs/17/xfunc-volatility.html",
    ],
  };
  writeFileSync(join(out, "review.json"), JSON.stringify(report, null, 2));
  process.exitCode = report.failed ? 1 : 0;
} catch (error) {
  console.error(error);
  process.exitCode = 2;
} finally {
  for (const session of [a, b, observer])
    if (session && !session.pending) await session.close();
  if (started) control(["-D", cluster, "-m", "fast", "-w", "stop"]);
}
