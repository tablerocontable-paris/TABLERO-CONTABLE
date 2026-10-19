// Independent native PostgreSQL review. Synthetic data, fresh cluster, loopback only.
// Exit 1 means contract findings; exit 2 means the harness could not complete.
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { decodeContextV1 } from "../../src/data/supabase/context-contract.ts";
import { decodeCommandResponseV1, decodeQueryResponseV1 } from "../../src/data/supabase/operational-contract.ts";

const allowedFlags = new Set([
  "--pg-bin", "--output-dir", "--port", "--candidate", "--review-matrix",
  "--through-014", "--m2-2a-smoke", "--m2-2a-independent", "--m2-2b-smoke", "--m2-2c-smoke",
  "--m2-2a-isolation", "--m2-2a-first-isolation", "--m2-2a-second-isolation",
]);
const flags = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1];
  if (!allowedFlags.has(key)) throw Error(`Unknown option: ${key}`);
  if (Object.hasOwn(flags, key)) throw Error(`Repeated option: ${key}`);
  if (value === undefined || value.startsWith("--")) throw Error(`Missing value for ${key}`);
  flags[key] = value;
}
if (flags["--review-matrix"] && flags["--review-matrix"] !== "full")
  throw Error("--review-matrix must be full");
if (flags["--through-014"] && flags["--through-014"] !== "yes")
  throw Error("--through-014 must be yes");
for (const key of ["--m2-2a-smoke", "--m2-2a-independent"])
  if (flags[key] && flags[key] !== "yes") throw Error(`${key} must be yes`);
if (flags["--m2-2b-smoke"] && flags["--m2-2b-smoke"] !== "yes") throw Error("--m2-2b-smoke must be yes");
if (flags["--m2-2b-smoke"] && !flags["--m2-2a-smoke"]) throw Error("--m2-2b-smoke requires --m2-2a-smoke yes");
if (flags["--m2-2c-smoke"] && flags["--m2-2c-smoke"] !== "yes") throw Error("--m2-2c-smoke must be yes");
if (flags["--m2-2c-smoke"] && (!flags["--m2-2a-smoke"] || !flags["--through-014"])) throw Error("--m2-2c-smoke requires --through-014 yes and --m2-2a-smoke yes");
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
const auxiliarySessions = [];
const record = (name, passed, details) => {
  const row = { name, passed, ...details };
  results.push(row);
  console.log(JSON.stringify(row));
};
let started = false,
  a,
  b,
  observer,
  reviewer;
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
  reviewer = new Session();
  for (const session of [a, b, observer, reviewer])
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
    record("M2.2A record-first legacy close rejects v2 without closure, report, or outbox", true, { blocked: closeAfterRecordBlocked, recordSQLSTATE: recordBeforeCloseResult.code, closeSQLSTATE: closeAfterRecordResult.code, closeRetrySQLSTATE: closeRetryAfterRecord.code, artifacts: closeAfterRecordArtifacts.lines.at(-1) });
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
    if (flags["--m2-2c-smoke"]) {
      const scheduledOn = (await observer.ok("select (now() at time zone 'America/Argentina/Buenos_Aires')::date;")).at(-1);
      const pairs = [
        ["read committed", "read committed"],
        ["read committed", "read committed"],
        ["repeatable read", "repeatable read"],
        ["repeatable read", "repeatable read"],
        ["read committed", "repeatable read"],
        ["repeatable read", "read committed"],
        ["repeatable read", "read committed"],
        ["read committed", "repeatable read"],
      ];
      for (let i = 0; i < pairs.length; i++) {
        const [isoA, isoB] = pairs[i], first = i % 2 === 0 ? a : b, second = i % 2 === 0 ? b : a;
        const revision = (await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)}),0);`)).at(-1);
        const firstOp = uid(300 + i * 2), secondOp = uid(301 + i * 2), suffix = `race-${i}`;
        const command = (operationId, title, expected) => ({
          contractVersion: 1, operationId, kind: "task.createOneOff",
          expectedRevisions: { [`creation:${actor}`]: expected },
          payload: { ownerId: actor, companyId: company, teamId: team, source: { type: "custom", definition: { kind: "operativa", title, objective: "", sector: "Test", unit: "comprobantes" } }, scheduledOn, dueDate: null, priority: "Media" },
        });
        const firstArgs = command(firstOp, `M2.2C ${suffix} first`, revision), secondArgs = command(secondOp, `M2.2C ${suffix} second`, revision);
        await first.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level ${isoA};`);
        const firstPid = Number((await first.ok("select pg_backend_pid();")).at(-1));
        const firstResult = await first.query(`select api.command_v1('${JSON.stringify(firstArgs).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(firstResult.code, "00000", JSON.stringify(firstResult));
        await second.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level ${isoB};select count(*) from public.task_assignments;`);
        const secondPid = Number((await second.ok("select pg_backend_pid();")).at(-1));
        const pending = second.query(`select api.command_v1('${JSON.stringify(secondArgs).replaceAll("'", "''")}'::jsonb);`);
        let blocked = false;
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          if ((await observer.ok(`select ${firstPid}=any(pg_catalog.pg_blocking_pids(${secondPid}));`)).at(-1) === "t") { blocked = true; break; }
          await new Promise((done) => setTimeout(done, 20));
        }
        await first.ok("commit;");
        const secondResult = await pending;
        await second.ok(secondResult.code === "00000" ? "commit;" : "rollback;");
        assert.equal(blocked, true, `creation owner fence did not block (${isoA}/${isoB})`);
        assert.equal(secondResult.code, "40001", JSON.stringify(secondResult));
        const retry = command(secondOp, `M2.2C ${suffix} second`, String(Number(revision) + 1));
        await second.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;`);
        const retryResult = await second.query(`select api.command_v1('${JSON.stringify(retry).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(retryResult.code, "00000", JSON.stringify(retryResult));
        await second.ok("reset role;"); await first.ok("reset role;");
        const state = (await observer.ok(`select count(*) from public.task_assignments where owner_id=${lit(actor)} and title like ${lit(`M2.2C ${suffix}%`)};`)).at(-1);
        assert.equal(state, "2", state);
        record(`M2.2C concurrent one-off creation serializes and retries (${isoA}/${isoB})`, true, { isolationPair: `${isoA}/${isoB}`, firstBackend: first === a ? "A" : "B", blocked, firstSQLSTATE: firstResult.code, secondSQLSTATE: secondResult.code, retrySQLSTATE: retryResult.code, finalAssignments: state });
      }
      const monthPeriod = (await observer.ok("select date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date;")).at(-1);
      const dayOfMonth = Number(scheduledOn.slice(-2));
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const standardCommand = { contractVersion: 1, operationId: uid(349), kind: "catalogue.create", expectedRevisions: { [`catalogue:${org}`]: "0" }, payload: { definition: { kind: "operativa", title: "M2.2C standard para inducción", objective: "", sector: "Test", unit: "comprobantes" }, effectiveOn: scheduledOn, reason: "Fixture nativo C" } };
      const standardCall = await a.query(`select api.command_v1('${JSON.stringify(standardCommand).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(standardCall.code, "00000", JSON.stringify(standardCall));
      const standardVersionId = JSON.parse(standardCall.lines.at(-1)).result.versionId;
      const onboardingRevision = (await observer.ok(`select coalesce((select revision from app_private.api_onboarding_owner_heads where organization_id=${lit(org)} and owner_id=${lit(actor)}),0);`)).at(-1);
      const requestDraft = { schemaVersion: 2, lines: [{ lineId: uid(352), companyId: company, teamId: team, source: { type: "catalogue", templateVersionId: standardVersionId }, schedule: { frequency: "mensual", startDate: scheduledOn, endDate: null, interval: 1, weekdays: [], monthDay: dayOfMonth, hasDeadline: true, dueOffsetDays: 0 } }] };
      const makeRequest = async (ownerId, lineId, opBase, templateVersionId = standardVersionId) => {
        await observer.ok(`insert into auth.users(id) values(${lit(ownerId)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(ownerId)},${lit(org)},'Synthetic reverse revocation ${opBase}','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(ownerId)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(ownerId)});`);
        await claims({ role: "authenticated", sub: ownerId, aal: "aal1" }, ownerId);
        const draft = { ...requestDraft, lines: [{ ...requestDraft.lines[0], lineId, source: { type: "catalogue", templateVersionId } }] };
        const save = { contractVersion: 1, operationId: uid(opBase), kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${ownerId}`]: "0" }, payload: { requestId: null, draft } };
        const saved = await a.query(`select api.command_v1('${JSON.stringify(save).replaceAll("'", "''")}'::jsonb);`); assert.equal(saved.code, "00000", JSON.stringify(saved));
        const requestId = JSON.parse(saved.lines.at(-1)).result.requestId;
        const submit = { contractVersion: 1, operationId: uid(opBase + 1), kind: "onboarding.submit", expectedRevisions: { [`onboarding:${requestId}`]: "0", [`onboardingDraft:${requestId}`]: "1" }, payload: { requestId } };
        const submitted = await a.query(`select api.command_v1('${JSON.stringify(submit).replaceAll("'", "''")}'::jsonb);`); assert.equal(submitted.code, "00000", JSON.stringify(submitted)); await a.ok("reset role;");
        return requestId;
      };
      // requestChanges historical replay/receipt race matrix. Each fixture is
      // synthetic and uses a separate observer connection as the writer.
      const requestChangesCases = [
        { name: "jefe actor deactivation", role: "jefe", mutation: actorId => `update public.profiles set active=false where id=${lit(actorId)};`, deny: true },
        { name: "jefe actor demotion", role: "jefe", mutation: actorId => `update public.profiles set role='empleado' where id=${lit(actorId)};`, deny: true },
        { name: "encargado actor deactivation", role: "encargado", mutation: actorId => `update public.profiles set active=false where id=${lit(actorId)};`, deny: true },
        { name: "encargado actor demotion", role: "encargado", mutation: actorId => `update public.profiles set role='empleado' where id=${lit(actorId)};`, deny: true },
        { name: "encargado manager change", role: "encargado", mutation: (_actorId, ownerId) => `update public.profiles set manager_id=null where id=${lit(ownerId)};`, deny: true },
        { name: "encargado owner deactivation", role: "encargado", mutation: (_actorId, ownerId) => `update public.profiles set active=false where id=${lit(ownerId)};`, deny: true },
      ];
      const requestChangesActions = [
        { name: "exact replay", run: f => a.query(`select api.command_v1('${JSON.stringify(f.command).replaceAll("'", "''")}'::jsonb);`) },
        { name: "commandReceipt", run: f => a.query(`select api.query_v1('${JSON.stringify(f.receipt).replaceAll("'", "''")}'::jsonb);`) },
      ];
      const requestChangesPairs = [["read committed", "read committed"], ["repeatable read", "repeatable read"], ["read committed", "repeatable read"], ["repeatable read", "read committed"]];
      const waitRequestChangesWriterBlocked = async (blockedPid, blockerPid) => {
        const until = Date.now() + 10000;
        while (Date.now() < until) {
          if ((await reviewer.ok(`select ${blockerPid}=any(pg_catalog.pg_blocking_pids(${blockedPid}));`)).at(-1) === "t") return true;
          await new Promise(done => setTimeout(done, 20));
        }
        return false;
      };
      let requestChangesRace = 0;
      const makeRequestChangesFixture = async seed => {
        const actorId = uid(seed), ownerId = uid(seed + 1), opBase = seed + 2;
        const role = seed % 2 ? "encargado" : "jefe";
        await observer.ok(`insert into auth.users(id) values(${lit(actorId)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(actorId)},${lit(org)},'requestChanges ${seed}',${lit(role)},'Test','Test','Test');`);
        await observer.ok(`update public.profiles set role=${lit(role)} where id=${lit(actorId)};`);
        const requestId = await makeRequest(ownerId, uid(seed + 3), opBase);
        if (role === "encargado") await observer.ok(`update public.profiles set manager_id=${lit(actorId)} where id=${lit(ownerId)};`);
        const command = { contractVersion: 1, operationId: uid(seed + 4), kind: "onboarding.requestChanges", expectedRevisions: { [`onboarding:${requestId}`]: "1" }, payload: { requestId, reason: "Race fixture" } };
        await claims({ role: "authenticated", sub: actorId, aal: "aal2" }, actorId);
        const created = await a.query(`select api.command_v1('${JSON.stringify(command).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(created.code, "00000", JSON.stringify(created));
        const receipt = { contractVersion: 1, kind: "commandReceipt", filters: { operationId: command.operationId }, cursor: null, limit: 1 };
        await a.ok("reset role;");
        const snapshotSql = `select jsonb_build_object(
          'actor',(select to_jsonb(p) from public.profiles p where p.id=${lit(actorId)}),
          'owner',(select to_jsonb(p) from public.profiles p where p.id=${lit(ownerId)}),
          'request',(select to_jsonb(r) from public.onboarding_requests r where r.id=${lit(requestId)}),
          'versions',(select coalesce(jsonb_agg(to_jsonb(v) order by v.revision),'[]'::jsonb) from public.onboarding_request_versions v where v.request_id=${lit(requestId)}),
          'reviews',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.onboarding_reviews x where x.request_id=${lit(requestId)}),
          'receipt',(select to_jsonb(x) from app_private.api_command_receipts x where x.actor_id=${lit(actorId)} and x.operation_id=${lit(command.operationId)}),
          'fences',(select count(*) from app_private.api_operation_fences x where x.actor_id=${lit(actorId)} and x.operation_id=${lit(command.operationId)}),
          'audit',(select count(*) from public.audit_events x where x.actor_id=${lit(actorId)} and x.entity_id=${lit(requestId)} and x.action='onboarding.changes_requested'));`;
        return { actorId, ownerId, requestId, role, command, receipt, created, snapshotSql };
      };
      {
        const f = await makeRequestChangesFixture(29990);
        await observer.ok(`update public.profiles set role='jefe' where id=${lit(f.actorId)};`);
        await observer.ok(`update public.profiles set active=false where id=${lit(f.ownerId)};`);
        await claims({ role: "authenticated", sub: f.actorId, aal: "aal2" }, f.actorId);
        const replay = await a.query(`select api.command_v1('${JSON.stringify(f.command).replaceAll("'", "''")}'::jsonb);`);
        const receipt = await a.query(`select api.query_v1('${JSON.stringify(f.receipt).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(replay.code, "00000", JSON.stringify(replay));
        assert.equal(receipt.code, "00000", JSON.stringify(receipt));
        assert.equal(JSON.parse(receipt.lines.at(-1)).data.found, true, JSON.stringify(receipt));
        await a.ok("reset role;");
        record("requestChanges jefe replay and commandReceipt remain org-wide after owner deactivation", true, { replaySQLSTATE: replay.code, receiptSQLSTATE: receipt.code, receiptFound: true });
      }
      for (const mutationCase of requestChangesCases) for (const action of requestChangesActions) for (const [readerIso, writerIso] of requestChangesPairs) {
        for (const writerFirst of [false, true]) {
          const f = await makeRequestChangesFixture(30000 + requestChangesRace++ * 10);
          await observer.ok(`update public.profiles set role=${lit(mutationCase.role)} where id=${lit(f.actorId)};`);
          if (mutationCase.role === "encargado") await observer.ok(`update public.profiles set manager_id=${lit(f.actorId)} where id=${lit(f.ownerId)};`);
          const writerSql = mutationCase.mutation(f.actorId, f.ownerId);
          if (!writerFirst) {
            const before = (await observer.ok(f.snapshotSql)).at(-1);
            await claims({ role: "authenticated", sub: f.actorId, aal: "aal2" }, f.actorId);
            await a.ok(`begin isolation level ${readerIso};`);
            const readerPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
            const read = await action.run(f); assert.equal(read.code, "00000", JSON.stringify(read));
            await observer.ok(`begin isolation level ${writerIso};`);
            const writerPid = Number((await observer.ok("select pg_backend_pid();")).at(-1));
            const pending = observer.query(writerSql);
            const blocked = await waitRequestChangesWriterBlocked(writerPid, readerPid);
            await a.ok("commit;"); const write = await pending; await observer.ok(write.code === "00000" ? "commit;" : "rollback;");
            assert.equal(blocked, true, `${mutationCase.name} ${action.name} did not block read-first writer`);
            assert.equal(write.code, "00000", JSON.stringify(write));
            const after = (await observer.ok(f.snapshotSql)).at(-1);
            assert.notEqual(after, before, "writer commit must be visible after read-first commit");
            await a.ok("reset role;");
            record(`requestChanges ${action.name} ${mutationCase.name} read-first ${readerIso}/${writerIso}`, true, { blocked, readerSQLSTATE: read.code, writerSQLSTATE: write.code, committedSnapshotChanged: true });
          } else {
            await claims({ role: "authenticated", sub: f.actorId, aal: "aal2" }, f.actorId);
            await a.ok(`begin isolation level ${readerIso};select active,role from public.profiles where id=${lit(f.actorId)};`);
            const readPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
            await observer.ok(`begin isolation level ${writerIso};${writerSql}`);
            await observer.ok("commit;");
            const after = (await observer.ok(f.snapshotSql)).at(-1);
            const stale = await action.run(f);
            assert.equal(stale.code, readerIso === "repeatable read" ? "40001" : "42501", JSON.stringify(stale));
            await a.ok("rollback;");
            await claims({ role: "authenticated", sub: f.actorId, aal: "aal2" }, f.actorId);
            const retry = await action.run(f); assert.equal(retry.code, "42501", JSON.stringify(retry));
            assert.equal((await observer.ok(f.snapshotSql)).at(-1), after, "denied stale/fresh reads changed post-commit snapshot");
            await a.ok("reset role;");
            record(`requestChanges ${action.name} ${mutationCase.name} writer-first ${readerIso}/${writerIso}`, true, { writerSQLSTATE: "00000", staleReaderSQLSTATE: stale.code, freshRetrySQLSTATE: retry.code, postCommitSnapshotUnchanged: true, readerBackend: readPid });
          }
        }
      }
      {
        const owner = uid(150500), companyB = uid(150501), teamB = uid(150502), lineA = uid(150503), lineB = uid(150504);
        await observer.ok(`insert into auth.users(id) values(${lit(owner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(owner)},${lit(org)},'M2.2C immutable submit version replay','empleado','Test','Test','Test');insert into public.companies(id,organization_id,name) values(${lit(companyB)},${lit(org)},'Replay version B');insert into public.teams(id,organization_id,name,manager_id) values(${lit(teamB)},${lit(org)},'Replay version team B',${lit(boss)});insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(owner)}),(${lit(org)},${lit(companyB)},${lit(owner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(owner)}),(${lit(org)},${lit(teamB)},${lit(owner)});`);
        const draftA = { ...requestDraft, lines: [{ ...requestDraft.lines[0], lineId: lineA }] };
        await claims({ role: "authenticated", sub: owner, aal: "aal1" }, owner);
        const saveA = { contractVersion: 1, operationId: uid(150505), kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${owner}`]: "0" }, payload: { requestId: null, draft: draftA } };
        const savedA = await a.query(`select api.command_v1('${JSON.stringify(saveA).replaceAll("'", "''")}'::jsonb);`); assert.equal(savedA.code, "00000", JSON.stringify(savedA));
        const request = JSON.parse(savedA.lines.at(-1)).result.requestId, submitOp = uid(150506);
        const submit = { contractVersion: 1, operationId: submitOp, kind: "onboarding.submit", expectedRevisions: { [`onboarding:${request}`]: "0", [`onboardingDraft:${request}`]: "1" }, payload: { requestId: request } };
        const submitted = await a.query(`select api.command_v1('${JSON.stringify(submit).replaceAll("'", "''")}'::jsonb);`); assert.equal(submitted.code, "00000", JSON.stringify(submitted));
        const exactReceipt = JSON.parse(submitted.lines.at(-1));
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        const changes = { contractVersion: 1, operationId: uid(150507), kind: "onboarding.requestChanges", expectedRevisions: { [`onboarding:${request}`]: "1" }, payload: { requestId: request, reason: "Cambiar a B" } };
        const changed = await a.query(`select api.command_v1('${JSON.stringify(changes).replaceAll("'", "''")}'::jsonb);`); assert.equal(changed.code, "00000", JSON.stringify(changed));
        const draftB = { ...requestDraft, lines: [{ ...requestDraft.lines[0], lineId: lineB, companyId: companyB, teamId: teamB }] };
        await claims({ role: "authenticated", sub: owner, aal: "aal1" }, owner);
        const saveB = { contractVersion: 1, operationId: uid(150508), kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${owner}`]: "3", [`onboarding:${request}`]: "1", [`onboardingDraft:${request}`]: "1" }, payload: { requestId: request, draft: draftB } };
        const savedB = await a.query(`select api.command_v1('${JSON.stringify(saveB).replaceAll("'", "''")}'::jsonb);`); assert.equal(savedB.code, "00000", JSON.stringify(savedB));
        await claims({ role: "authenticated", sub: owner, aal: "aal1" }, owner);
        const revokeA = { contractVersion: 1, operationId: uid(150509), kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${owner}`]: "0" }, payload: { companyId: company, profileId: owner, active: false, reason: "Submitted A revoked" } };
        await a.ok("begin isolation level read committed;");
        const replayPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
        const replayFirst = await a.query(`select api.command_v1('${JSON.stringify(submit).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(replayFirst.code, "00000", JSON.stringify(replayFirst));
        assert.deepEqual(JSON.parse(replayFirst.lines.at(-1)).result, exactReceipt.result);
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level read committed;`);
        const revokerPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
        const revokePending = b.query(`select api.command_v1('${JSON.stringify(revokeA).replaceAll("'", "''")}'::jsonb);`);
        let replayBlockedRevocation = false; const replayDeadline = Date.now() + 10000;
        while (Date.now() < replayDeadline) { if ((await observer.ok(`select ${replayPid}=any(pg_catalog.pg_blocking_pids(${revokerPid}));`)).at(-1) === "t") { replayBlockedRevocation = true; break; } await new Promise(done => setTimeout(done, 20)); }
        await a.ok("commit;"); const revokedA = await revokePending; await b.ok(revokedA.code === "00000" ? "commit;" : "rollback;");
        assert.equal(replayBlockedRevocation, true); assert.equal(revokedA.code, "00000", JSON.stringify(revokedA));
        await claims({ role: "authenticated", sub: owner, aal: "aal1" }, owner);
        const replayDenied = await a.query(`select api.command_v1('${JSON.stringify(submit).replaceAll("'", "''")}'::jsonb);`); assert.equal(replayDenied.code, "42501", JSON.stringify(replayDenied));
        await a.ok("reset role;"); await b.ok("reset role;");
        const state = (await observer.ok(`select (select active::text from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(owner)})||'|'||(select active::text from public.company_memberships where company_id=${lit(companyB)} and profile_id=${lit(owner)})||'|'||(select revision::text from public.onboarding_request_versions where request_id=${lit(request)} and revision=1)||'|'||(select count(*) from public.onboarding_request_versions where request_id=${lit(request)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(submitOp)});`)).at(-1);
        assert.equal(state, "false|true|1|1|1", state);
        record("M2.2C exact submit replay authorizes immutable A and serializes before revoking its membership", true, { submitSQLSTATE: submitted.code, requestChangesSQLSTATE: changed.code, saveDraftBSQLSTATE: savedB.code, replayFirstSQLSTATE: replayFirst.code, revokerBlockedByReplay: replayBlockedRevocation, revokeSQLSTATE: revokedA.code, replayAfterRevocationSQLSTATE: replayDenied.code, storedReceipt: exactReceipt.result, finalMembershipsAndVersions: state });
      }
      {
        const replayOwner = uid(150520), createOp = uid(150521), revokeOp = uid(150522);
        await observer.ok(`insert into auth.users(id) values(${lit(replayOwner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(replayOwner)},${lit(org)},'M2.2C assignment replay/revoke','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(replayOwner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(replayOwner)});`);
        const createRevision = (await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(replayOwner)}),0);`)).at(-1);
        const assignmentReplayCommand = { contractVersion: 1, operationId: createOp, kind: "assignment.create", expectedRevisions: { [`creation:${replayOwner}`]: createRevision, [`catalogue:${JSON.parse(standardCall.lines.at(-1)).result.templateId}`]: "1" }, payload: { ownerId: replayOwner, companyId: company, teamId: team, source: { type: "catalogue", templateVersionId: standardVersionId }, schedule: { frequency: "mensual", startDate: scheduledOn, endDate: null, interval: 1, weekdays: [], monthDay: dayOfMonth, hasDeadline: true, dueOffsetDays: 0 } } };
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        const assignmentCreated = await a.query(`select api.command_v1('${JSON.stringify(assignmentReplayCommand).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(assignmentCreated.code, "00000", JSON.stringify(assignmentCreated));
        const assignmentReceipt = JSON.parse(assignmentCreated.lines.at(-1));
        const assignmentId = assignmentReceipt.result.assignmentId;
        const snapshotSql = `select jsonb_build_object(
          'membership',(select jsonb_build_array(active,revision) from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(replayOwner)}),
          'teamMemberships',(select count(*) from public.team_members where team_id=${lit(team)} and profile_id=${lit(replayOwner)}),
          'assignments',(select count(*) from public.task_assignments where id=${lit(assignmentId)}),
          'instances',(select count(*) from public.task_instances where assignment_id=${lit(assignmentId)}),
          'creationHead',(select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(replayOwner)}),
          'membershipFence',(select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(replayOwner)}),
          'monthFence',(select fence_epoch from app_private.api_month_fences where organization_id=${lit(org)} and owner_id=${lit(replayOwner)} and period=${lit(monthPeriod)}::date),
          'operationFence',(select count(*) from app_private.api_operation_fences where actor_id=${lit(boss)} and operation_id=${lit(createOp)}),
          'receipt',(select count(*) from app_private.api_command_receipts where actor_id=${lit(boss)} and operation_id=${lit(createOp)}),
          'assignmentAudit',(select count(*) from public.audit_events where actor_id=${lit(boss)} and action='assignment.create' and entity_id=${lit(assignmentId)}),
          'membershipEvents',(select count(*) from app_private.company_membership_events where company_id=${lit(company)} and profile_id=${lit(replayOwner)})
        );`;
        const beforeReplay = (await observer.ok(snapshotSql)).at(-1);
        await a.ok("reset role;" );
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        await a.ok("begin isolation level read committed;");
        const replayPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
        const replaySuccess = await a.query(`select api.command_v1('${JSON.stringify(assignmentReplayCommand).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(replaySuccess.code, "00000", JSON.stringify(replaySuccess));
        assert.deepEqual(JSON.parse(replaySuccess.lines.at(-1)).result, assignmentReceipt.result);
        assert.equal((await observer.ok(snapshotSql)).at(-1), beforeReplay, "successful exact replay must be read-only");

        const revoke = { contractVersion: 1, operationId: revokeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${replayOwner}`]: "0" }, payload: { companyId: company, profileId: replayOwner, active: false, reason: "Assignment replay race" } };
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level read committed;`);
        const revokerPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
        const pendingRevoke = b.query(`select api.command_v1('${JSON.stringify(revoke).replaceAll("'", "''")}'::jsonb);`);
        let replayBlockedRevocation = false; const raceDeadline = Date.now() + 10000;
        while (Date.now() < raceDeadline) {
          if ((await observer.ok(`select ${replayPid}=any(pg_catalog.pg_blocking_pids(${revokerPid}));`)).at(-1) === "t") { replayBlockedRevocation = true; break; }
          await new Promise(done => setTimeout(done, 20));
        }
        await a.ok("commit;");
        const revoked = await pendingRevoke;
        await b.ok(revoked.code === "00000" ? "commit;" : "rollback;");
        assert.equal(replayBlockedRevocation, true, "revocation must wait on exact replay membership lock");
        assert.equal(revoked.code, "00000", JSON.stringify(revoked));

        const afterRevocation = (await observer.ok(snapshotSql)).at(-1);
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        const deniedReplay = await a.query(`select api.command_v1('${JSON.stringify(assignmentReplayCommand).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(deniedReplay.code, "42501", JSON.stringify(deniedReplay));
        const mismatch = { ...assignmentReplayCommand, expectedRevisions: { ...assignmentReplayCommand.expectedRevisions, [`creation:${replayOwner}`]: "999" } };
        const mismatchResult = await a.query(`select api.command_v1('${JSON.stringify(mismatch).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(mismatchResult.code, "40001", JSON.stringify(mismatchResult));
        await a.ok("reset role;"); await b.ok("reset role;");
        assert.equal((await observer.ok(snapshotSql)).at(-1), afterRevocation, "denied/mismatched replay must preserve post-revocation read-only state");
        record("M2.2C exact assignment replay is read-only, serializes before membership revoke, and denies replay after revoke", true, { createSQLSTATE: assignmentCreated.code, replaySQLSTATE: replaySuccess.code, replayReadOnlyBeforeRevoke: beforeReplay, revokerBlockedByReplay: replayBlockedRevocation, revokeSQLSTATE: revoked.code, revokedState: afterRevocation, exactReplayAfterRevokeSQLSTATE: deniedReplay.code, argumentMismatchSQLSTATE: mismatchResult.code, stateUnchangedByDeniedReplays: true });
      }
      {
        const makeReceiptFixture = async (seed) => {
          const chief = uid(seed), ownerId = uid(seed + 1), opId = uid(seed + 2), revokeId = uid(seed + 3);
          await observer.ok(`insert into auth.users(id) values(${lit(chief)}),(${lit(ownerId)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(chief)},${lit(org)},'M2.2C receipt chief','jefe','Test','Test','Test'),(${lit(ownerId)},${lit(org)},'M2.2C receipt owner','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(ownerId)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(ownerId)});`);
          const command = { contractVersion: 1, operationId: opId, kind: "assignment.create", expectedRevisions: { [`creation:${ownerId}`]: "0", [`catalogue:${JSON.parse(standardCall.lines.at(-1)).result.templateId}`]: "1" }, payload: { ownerId, companyId: company, teamId: team, source: { type: "catalogue", templateVersionId: standardVersionId }, schedule: { frequency: "mensual", startDate: scheduledOn, endDate: null, interval: 1, weekdays: [], monthDay: dayOfMonth, hasDeadline: true, dueOffsetDays: 0 } } };
          await claims({ role: "authenticated", sub: chief, aal: "aal2" }, chief);
          const created = await a.query(`select api.command_v1('${JSON.stringify(command).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(created.code, "00000", JSON.stringify(created));
          const receipt = { contractVersion: 1, kind: "commandReceipt", filters: { operationId: opId }, cursor: null, limit: 1 };
          const revoke = { contractVersion: 1, operationId: revokeId, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${ownerId}`]: "0" }, payload: { companyId: company, profileId: ownerId, active: false, reason: "Creation receipt race" } };
          const snapshotSql = `select jsonb_build_object(
            'profiles',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.profiles p where p.id in (${lit(chief)},${lit(ownerId)})),
            'memberships',(select coalesce(jsonb_agg(to_jsonb(m) order by m.company_id,m.profile_id),'[]'::jsonb) from public.company_memberships m where m.organization_id=${lit(org)} and m.profile_id=${lit(ownerId)}),
            'teamMembers',(select coalesce(jsonb_agg(to_jsonb(t) order by t.team_id,t.profile_id),'[]'::jsonb) from public.team_members t where t.organization_id=${lit(org)} and t.profile_id=${lit(ownerId)}),
            'assignments',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.task_assignments x where x.organization_id=${lit(org)} and x.owner_id=${lit(ownerId)}),
            'instances',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.task_instances x where x.organization_id=${lit(org)} and x.owner_id=${lit(ownerId)}),
            'head',(select to_jsonb(h) from app_private.api_creation_heads h where h.organization_id=${lit(org)} and h.owner_id=${lit(ownerId)}),
            'monthFences',(select coalesce(jsonb_agg(to_jsonb(f) order by f.period),'[]'::jsonb) from app_private.api_month_fences f where f.organization_id=${lit(org)} and f.owner_id=${lit(ownerId)}),
            'membershipFences',(select coalesce(jsonb_agg(to_jsonb(f) order by f.profile_id),'[]'::jsonb) from app_private.api_membership_fences f where f.organization_id=${lit(org)} and f.profile_id=${lit(ownerId)}),
            'operationFences',(select coalesce(jsonb_agg(to_jsonb(f) order by f.actor_id,f.operation_id),'[]'::jsonb) from app_private.api_operation_fences f where f.actor_id=${lit(chief)}),
            'receipt',(select to_jsonb(r) from app_private.api_command_receipts r where r.actor_id=${lit(chief)} and r.operation_id=${lit(opId)}),
            'audit',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.audit_events x where x.actor_id=${lit(chief)} and x.action='assignment.create'),
            'membershipEvents',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from app_private.company_membership_events x where x.company_id=${lit(company)} and x.profile_id=${lit(ownerId)})
          );`;
          return { chief, ownerId, command, receipt, revoke, snapshotSql };
        };
        const readIsolation = ["read committed", "repeatable read"];
        const matrixPairs = [["read committed", "read committed"], ["repeatable read", "repeatable read"], ["read committed", "repeatable read"], ["repeatable read", "read committed"]];
        const waitBlocked = async (blockedPid, blockerPid) => {
          const until = Date.now() + 10000;
          while (Date.now() < until) {
            if ((await reviewer.ok(`select ${blockerPid}=any(pg_catalog.pg_blocking_pids(${blockedPid}));`)).at(-1) === "t") return true;
            await new Promise(done => setTimeout(done, 20));
          }
          return false;
        };
        let raceNo = 0;
        for (const [readerIsolation, revokerIsolation] of matrixPairs) {
          const f = await makeReceiptFixture(15100 + raceNo++ * 10);
          const before = (await observer.ok(f.snapshotSql)).at(-1);
          await claims({ role: "authenticated", sub: f.chief, aal: "aal2" }, f.chief);
          await a.ok(`begin isolation level ${readerIsolation};`);
          const readerPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
          const read = await a.query(`select api.query_v1('${JSON.stringify(f.receipt).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(read.code, "00000", JSON.stringify(read));
          assert.equal(JSON.parse(read.lines.at(-1)).data.found, true, JSON.stringify(read));
          assert.equal((await observer.ok(f.snapshotSql)).at(-1), before, "read-first receipt query changed state");
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${revokerIsolation};`);
          const revokerPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
          const revocationPending = b.query(`select api.command_v1('${JSON.stringify(f.revoke).replaceAll("'", "''")}'::jsonb);`);
          const blocked = await waitBlocked(revokerPid, readerPid);
          await a.ok("commit;"); const revocation = await revocationPending; await b.ok(revocation.code === "00000" ? "commit;" : "rollback;");
          assert.equal(blocked, true, `${readerIsolation}/${revokerIsolation} read-first must serialize on membership scope`);
          assert.equal(revocation.code, "00000", JSON.stringify(revocation));
          await a.ok("reset role;"); await b.ok("reset role;");
          record(`M2.2C assignment commandReceipt membership race read-first (${readerIsolation}/${revokerIsolation})`, true, { readerSQLSTATE: read.code, revocationSQLSTATE: revocation.code, revokerBlockedByDistinctChiefReceiptReader: blocked, readOnlySnapshot: before });
        }
        for (const [readerIsolation, revokerIsolation] of matrixPairs) {
          const f = await makeReceiptFixture(15200 + raceNo++ * 10);
          await claims({ role: "authenticated", sub: f.chief, aal: "aal2" }, f.chief);
          await a.ok(`begin isolation level ${readerIsolation};`);
          await a.ok(`select active from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(f.ownerId)};`);
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${revokerIsolation};`);
          const revoke = await b.query(`select api.command_v1('${JSON.stringify(f.revoke).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(revoke.code, "00000", JSON.stringify(revoke)); await b.ok("commit;");
          const beforeDeniedRetry = (await observer.ok(f.snapshotSql)).at(-1);
          const staleRead = await a.query(`select api.query_v1('${JSON.stringify(f.receipt).replaceAll("'", "''")}'::jsonb);`);
          if (readerIsolation === "repeatable read") assert.equal(staleRead.code, "40001", JSON.stringify(staleRead));
          else assert.equal(staleRead.code, "42501", JSON.stringify(staleRead));
          await a.ok("rollback;");
          const retry = await a.query(`select api.query_v1('${JSON.stringify(f.receipt).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(retry.code, "42501", JSON.stringify(retry));
          assert.equal((await observer.ok(f.snapshotSql)).at(-1), beforeDeniedRetry, "stale denial/retry changed post-revocation state");
          await a.ok("reset role;"); await b.ok("reset role;");
          record(`M2.2C assignment commandReceipt membership race revoke-first (${readerIsolation}/${revokerIsolation})`, true, { revocationSQLSTATE: revoke.code, staleReaderSQLSTATE: staleRead.code, freshRetrySQLSTATE: retry.code, postRevocationSnapshotUnchanged: true });
        }
        const makeMonthFixture = async (seed) => {
          const chief = uid(seed), ownerId = uid(seed + 1), opId = uid(seed + 2);
          await observer.ok(`insert into auth.users(id) values(${lit(chief)}),(${lit(ownerId)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(chief)},${lit(org)},'M2.2C month receipt chief','jefe','Test','Test','Test'),(${lit(ownerId)},${lit(org)},'M2.2C month receipt owner','empleado','Test','Test','Test');`);
          const command = { contractVersion: 1, operationId: opId, kind: "month.materialize", expectedRevisions: { [`creation:${ownerId}`]: "0" }, payload: { ownerId, period: monthPeriod } };
          await claims({ role: "authenticated", sub: chief, aal: "aal2" }, chief);
          const created = await a.query(`select api.command_v1('${JSON.stringify(command).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(created.code, "00000", JSON.stringify(created));
          const receipt = { contractVersion: 1, kind: "commandReceipt", filters: { operationId: opId }, cursor: null, limit: 1 };
          const snapshotSql = `select jsonb_build_object(
            'profiles',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.profiles p where p.id in (${lit(chief)},${lit(ownerId)})),
            'memberships',(select coalesce(jsonb_agg(to_jsonb(m) order by m.company_id,m.profile_id),'[]'::jsonb) from public.company_memberships m where m.organization_id=${lit(org)} and m.profile_id=${lit(ownerId)}),
            'teamMembers',(select coalesce(jsonb_agg(to_jsonb(t) order by t.team_id,t.profile_id),'[]'::jsonb) from public.team_members t where t.organization_id=${lit(org)} and t.profile_id=${lit(ownerId)}),
            'assignments',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.task_assignments x where x.organization_id=${lit(org)} and x.owner_id=${lit(ownerId)}),
            'instances',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.task_instances x where x.organization_id=${lit(org)} and x.owner_id=${lit(ownerId)}),
            'head',(select to_jsonb(h) from app_private.api_creation_heads h where h.organization_id=${lit(org)} and h.owner_id=${lit(ownerId)}),
            'monthFences',(select coalesce(jsonb_agg(to_jsonb(f) order by f.period),'[]'::jsonb) from app_private.api_month_fences f where f.organization_id=${lit(org)} and f.owner_id=${lit(ownerId)}),
            'membershipFences',(select coalesce(jsonb_agg(to_jsonb(f) order by f.profile_id),'[]'::jsonb) from app_private.api_membership_fences f where f.organization_id=${lit(org)} and f.profile_id=${lit(ownerId)}),
            'operationFences',(select coalesce(jsonb_agg(to_jsonb(f) order by f.actor_id,f.operation_id),'[]'::jsonb) from app_private.api_operation_fences f where f.actor_id=${lit(chief)}),
            'receipt',(select to_jsonb(r) from app_private.api_command_receipts r where r.actor_id=${lit(chief)} and r.operation_id=${lit(opId)}),
            'audit',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.audit_events x where x.actor_id=${lit(chief)} and x.action='month.materialized')
          );`;
          return { chief, ownerId, command, receipt, created, snapshotSql };
        };
        const monthActions = [
          { name: "exact replay", run: async (f) => a.query(`select api.command_v1('${JSON.stringify(f.command).replaceAll("'", "''")}'::jsonb);`), expect: (r, f) => { assert.equal(r.code, "00000", JSON.stringify(r)); assert.deepEqual(JSON.parse(r.lines.at(-1)).result, JSON.parse(f.created.lines.at(-1)).result); } },
          { name: "commandReceipt", run: async (f) => a.query(`select api.query_v1('${JSON.stringify(f.receipt).replaceAll("'", "''")}'::jsonb);`), expect: (r) => { assert.equal(r.code, "00000", JSON.stringify(r)); assert.equal(JSON.parse(r.lines.at(-1)).data.found, true, JSON.stringify(r)); } },
        ];
        let monthRaceNo = 0;
        for (const action of monthActions) for (const [readerIsolation, writerIsolation] of matrixPairs) {
          const f = await makeMonthFixture(15300 + monthRaceNo++ * 10);
          const before = (await observer.ok(f.snapshotSql)).at(-1);
          await claims({ role: "authenticated", sub: f.chief, aal: "aal2" }, f.chief);
          await a.ok(`begin isolation level ${readerIsolation};`);
          const readerPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
          action.created = f.created;
          const read = await action.run(f); action.expect(read, f);
          assert.equal((await observer.ok(f.snapshotSql)).at(-1), before, `${action.name} read-first changed snapshot`);
          await observer.ok(`begin isolation level ${writerIsolation};`);
          const deactivationPid = Number((await observer.ok("select pg_backend_pid();")).at(-1));
          const deactivationPending = observer.query(`update public.profiles set active=false where id=${lit(f.ownerId)};`);
          const blocked = await waitBlocked(deactivationPid, readerPid);
          await a.ok("commit;"); const deactivation = await deactivationPending;
          await observer.ok("commit;");
          assert.equal(blocked, true, `${action.name} read-first (${readerIsolation}/${writerIsolation}) must lock the owner profile`);
          assert.equal(deactivation.code, "00000", JSON.stringify(deactivation));
          await a.ok("reset role;");
          record(`M2.2C month ${action.name} owner-deactivation race read-first (${readerIsolation}/${writerIsolation})`, true, { readerSQLSTATE: read.code, ownerDeactivationSQLSTATE: deactivation.code, deactivationBlockedByRead: blocked, readOnlySnapshot: before });
        }
        for (const action of monthActions) for (const [readerIsolation, writerIsolation] of matrixPairs) {
          const f = await makeMonthFixture(15400 + monthRaceNo++ * 10);
          await claims({ role: "authenticated", sub: f.chief, aal: "aal2" }, f.chief);
          await a.ok(`begin isolation level ${readerIsolation};select active from public.profiles where id=${lit(f.ownerId)};`);
          await observer.ok(`begin isolation level ${writerIsolation};`);
          const deactivation = await observer.query(`update public.profiles set active=false where id=${lit(f.ownerId)};`);
          assert.equal(deactivation.code, "00000", JSON.stringify(deactivation)); await observer.ok("commit;");
          const beforeRetry = (await observer.ok(f.snapshotSql)).at(-1);
          action.created = f.created;
          const staleRead = await action.run(f);
          if (readerIsolation === "repeatable read") assert.equal(staleRead.code, "40001", `${action.name}: ${JSON.stringify(staleRead)}`);
          else assert.equal(staleRead.code, "42501", `${action.name}: ${JSON.stringify(staleRead)}`);
          await a.ok("rollback;");
          await claims({ role: "authenticated", sub: f.chief, aal: "aal2" }, f.chief);
          const retry = await action.run(f); assert.equal(retry.code, "42501", `${action.name} fresh retry: ${JSON.stringify(retry)}`);
          assert.equal((await observer.ok(f.snapshotSql)).at(-1), beforeRetry, "owner denial/retry changed post-deactivation state");
          await a.ok("reset role;");
          record(`M2.2C month ${action.name} owner-deactivation race writer-first (${readerIsolation}/${writerIsolation})`, true, { ownerDeactivationSQLSTATE: deactivation.code, staleReaderSQLSTATE: staleRead.code, freshRetrySQLSTATE: retry.code, postDeactivationSnapshotUnchanged: true });
        }
        const makeApprovalReceiptFixture = async (seed) => {
          const chief = uid(seed), secondChief = uid(seed + 1), ownerId = uid(seed + 2), lineId = uid(seed + 3), approveOp = uid(seed + 4), revokeOp = uid(seed + 5);
          await observer.ok(`insert into auth.users(id) values(${lit(chief)}),(${lit(secondChief)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(chief)},${lit(org)},'Approval receipt chief one','jefe','Test','Test','Test'),(${lit(secondChief)},${lit(org)},'Approval receipt chief two','jefe','Test','Test','Test');`);
          const request = await makeRequest(ownerId, lineId, seed + 6);
          const templateId = JSON.parse(standardCall.lines.at(-1)).result.templateId;
          const approve = { contractVersion: 1, operationId: approveOp, kind: "onboarding.approve", expectedRevisions: { [`onboarding:${request}`]: "1", [`catalogue:${JSON.parse(standardCall.lines.at(-1)).result.templateId}`]: "1" }, payload: { requestId: request, weightOverrides: [], period: monthPeriod } };
          await claims({ role: "authenticated", sub: chief, aal: "aal2" }, chief);
          const created = await a.query(`select api.command_v1('${JSON.stringify(approve).replaceAll("'", "''")}'::jsonb);`); assert.equal(created.code, "00000", JSON.stringify(created));
          await observer.ok(`update public.onboarding_requests set draft_payload=jsonb_set(draft_payload,'{lines,0,source,definition,title}','"Later mutable draft B"'::jsonb) where id=${lit(request)};`);
          const receipt = { contractVersion: 1, kind: "commandReceipt", filters: { operationId: approveOp }, cursor: null, limit: 1 };
          const revoke = { contractVersion: 1, operationId: revokeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${ownerId}`]: "0" }, payload: { companyId: company, profileId: ownerId, active: false, reason: "Approval receipt replay race" } };
          const snapshotSql = `select jsonb_build_object(
            'profiles',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.profiles p where p.id in (${lit(chief)},${lit(secondChief)},${lit(ownerId)})),
            'membership',(select to_jsonb(m) from public.company_memberships m where m.organization_id=${lit(org)} and m.company_id=${lit(company)} and m.profile_id=${lit(ownerId)}),
            'versions',(select coalesce(jsonb_agg(to_jsonb(v) order by v.revision),'[]'::jsonb) from public.onboarding_request_versions v where v.organization_id=${lit(org)} and v.request_id=${lit(request)}),
            'request',(select to_jsonb(r) from public.onboarding_requests r where r.id=${lit(request)}),
            'activations',(select coalesce(jsonb_agg(to_jsonb(x) order by x.line_id),'[]'::jsonb) from public.onboarding_activations x where x.request_id=${lit(request)}),
            'assignments',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.task_assignments x where x.organization_id=${lit(org)} and x.owner_id=${lit(ownerId)}),
            'instances',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.task_instances x where x.organization_id=${lit(org)} and x.owner_id=${lit(ownerId)}),
            'creationHead',(select to_jsonb(h) from app_private.api_creation_heads h where h.organization_id=${lit(org)} and h.owner_id=${lit(ownerId)}),
            'monthFences',(select coalesce(jsonb_agg(to_jsonb(f) order by f.period),'[]'::jsonb) from app_private.api_month_fences f where f.organization_id=${lit(org)} and f.owner_id=${lit(ownerId)}),
            'membershipFences',(select coalesce(jsonb_agg(to_jsonb(f) order by f.profile_id),'[]'::jsonb) from app_private.api_membership_fences f where f.organization_id=${lit(org)} and f.profile_id=${lit(ownerId)}),
            'receipt',(select to_jsonb(r) from app_private.api_command_receipts r where r.actor_id=${lit(chief)} and r.operation_id=${lit(approveOp)}),
            'audit',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.audit_events x where x.actor_id=${lit(chief)} and x.entity_id=${lit(request)} and x.action='onboarding.approved')
          );`;
          return { chief, secondChief, ownerId, request, templateId, approve, receipt, revoke, created, snapshotSql };
        };
        const approvalReadActions = [
          { name: "exact replay", run: f => a.query(`select api.command_v1('${JSON.stringify(f.approve).replaceAll("'", "''")}'::jsonb);`), check: (r, f) => { assert.equal(r.code, "00000", JSON.stringify(r)); assert.deepEqual(JSON.parse(r.lines.at(-1)), JSON.parse(f.created.lines.at(-1))); } },
          { name: "commandReceipt", run: f => a.query(`select api.query_v1('${JSON.stringify(f.receipt).replaceAll("'", "''")}'::jsonb);`), check: r => { assert.equal(r.code, "00000", JSON.stringify(r)); assert.equal(JSON.parse(r.lines.at(-1)).data.found, true, JSON.stringify(r)); } },
        ];
        const runWithInactiveCatalogue = async (f, action) => {
          await observer.ok(`update public.task_templates set active=false where id=${lit(f.templateId)};`);
          assert.equal((await observer.ok(`select active from public.task_templates where id=${lit(f.templateId)};`)).at(-1), "f");
          try { return await action(); } finally { await observer.ok(`update public.task_templates set active=true where id=${lit(f.templateId)};`); }
        };
        let approvalReceiptRaceNo = 0;
        for (const action of approvalReadActions) for (const [readerIsolation, writerIsolation] of matrixPairs) {
          const f = await makeApprovalReceiptFixture(18000 + approvalReceiptRaceNo++ * 20), before = (await observer.ok(f.snapshotSql)).at(-1);
          await claims({ role: "authenticated", sub: f.chief, aal: "aal2" }, f.chief); await a.ok(`begin isolation level ${readerIsolation};`);
          const readerPid = Number((await a.ok("select pg_backend_pid();")).at(-1)); const read = await runWithInactiveCatalogue(f, () => action.run(f)); action.check(read, f);
          assert.equal((await observer.ok(f.snapshotSql)).at(-1), before, `${action.name} approval read changed its snapshot`);
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(f.secondChief)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: f.secondChief, aal: "aal2" }))},false);set role authenticated;begin isolation level ${writerIsolation};`);
          const writerPid = Number((await b.ok("select pg_backend_pid();")).at(-1)); const pending = b.query(`select api.command_v1('${JSON.stringify(f.revoke).replaceAll("'", "''")}'::jsonb);`);
          const blocked = await waitBlocked(writerPid, readerPid); await a.ok("commit;"); const write = await pending; await b.ok(write.code === "00000" ? "commit;" : "rollback;");
          assert.equal(blocked, true, `${action.name} must serialize distinct-chief revocation (${readerIsolation}/${writerIsolation})`); assert.equal(write.code, "00000", JSON.stringify(write));
          await a.ok("reset role;"); await b.ok("reset role;");
          record(`M2.2C onboarding.approve ${action.name} distinct-chief revocation read-first (${readerIsolation}/${writerIsolation})`, true, { isolationPair: `${readerIsolation}/${writerIsolation}`, readerSQLSTATE: read.code, revocationSQLSTATE: write.code, revocationBlockedByRead: blocked, readOnlySnapshot: before });
        }
        for (const action of approvalReadActions) for (const [readerIsolation, writerIsolation] of matrixPairs) {
          const f = await makeApprovalReceiptFixture(18200 + approvalReceiptRaceNo++ * 20);
          await claims({ role: "authenticated", sub: f.chief, aal: "aal2" }, f.chief); await a.ok(`begin isolation level ${readerIsolation};select active from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(f.ownerId)};`);
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(f.secondChief)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: f.secondChief, aal: "aal2" }))},false);set role authenticated;begin isolation level ${writerIsolation};`);
          const revoked = await b.query(`select api.command_v1('${JSON.stringify(f.revoke).replaceAll("'", "''")}'::jsonb);`); assert.equal(revoked.code, "00000", JSON.stringify(revoked)); await b.ok("commit;");
          const afterWrite = (await observer.ok(f.snapshotSql)).at(-1); const stale = await runWithInactiveCatalogue(f, () => action.run(f));
          assert.equal(stale.code, readerIsolation === "repeatable read" ? "40001" : "42501", JSON.stringify(stale)); await a.ok("rollback;");
          await claims({ role: "authenticated", sub: f.chief, aal: "aal2" }, f.chief); const retry = await runWithInactiveCatalogue(f, () => action.run(f)); assert.equal(retry.code, "42501", JSON.stringify(retry));
          assert.equal((await observer.ok(f.snapshotSql)).at(-1), afterWrite, "revoked approval read/retry changed post-revocation snapshot"); await a.ok("reset role;"); await b.ok("reset role;");
          record(`M2.2C onboarding.approve ${action.name} distinct-chief revocation writer-first (${readerIsolation}/${writerIsolation})`, true, { isolationPair: `${readerIsolation}/${writerIsolation}`, revocationSQLSTATE: revoked.code, staleReaderSQLSTATE: stale.code, freshRetrySQLSTATE: retry.code, postRevocationSnapshotUnchanged: true });
        }
        for (const action of approvalReadActions) for (const [readerIsolation, writerIsolation] of matrixPairs) {
          const f = await makeApprovalReceiptFixture(18400 + approvalReceiptRaceNo++ * 20), before = (await observer.ok(f.snapshotSql)).at(-1);
          await claims({ role: "authenticated", sub: f.chief, aal: "aal2" }, f.chief); await a.ok(`begin isolation level ${readerIsolation};`);
          const readerPid = Number((await a.ok("select pg_backend_pid();")).at(-1)); const read = await runWithInactiveCatalogue(f, () => action.run(f)); action.check(read, f);
          assert.equal((await observer.ok(f.snapshotSql)).at(-1), before, `${action.name} owner read changed its snapshot`);
          await observer.ok(`begin isolation level ${writerIsolation};`); const writerPid = Number((await observer.ok("select pg_backend_pid();")).at(-1));
          const pending = observer.query(`update public.profiles set active=false where id=${lit(f.ownerId)};`); const blocked = await waitBlocked(writerPid, readerPid);
          await a.ok("commit;"); const deactivated = await pending; await observer.ok(deactivated.code === "00000" ? "commit;" : "rollback;");
          assert.equal(blocked, true, `${action.name} must share-lock the active owner (${readerIsolation}/${writerIsolation})`); assert.equal(deactivated.code, "00000", JSON.stringify(deactivated));
          await a.ok("reset role;"); await observer.ok("reset role;");
          record(`M2.2C onboarding.approve ${action.name} owner deactivation read-first (${readerIsolation}/${writerIsolation})`, true, { isolationPair: `${readerIsolation}/${writerIsolation}`, readerSQLSTATE: read.code, ownerDeactivationSQLSTATE: deactivated.code, deactivationBlockedByRead: blocked, readOnlySnapshot: before });
        }
        for (const action of approvalReadActions) for (const [readerIsolation, writerIsolation] of matrixPairs) {
          const f = await makeApprovalReceiptFixture(18600 + approvalReceiptRaceNo++ * 20);
          await claims({ role: "authenticated", sub: f.chief, aal: "aal2" }, f.chief); await a.ok(`begin isolation level ${readerIsolation};select active from public.profiles where id=${lit(f.ownerId)};`);
          await observer.ok(`begin isolation level ${writerIsolation};`); const deactivated = await observer.query(`update public.profiles set active=false where id=${lit(f.ownerId)};`);
          assert.equal(deactivated.code, "00000", JSON.stringify(deactivated)); await observer.ok("commit;"); const afterWrite = (await observer.ok(f.snapshotSql)).at(-1);
          const stale = await runWithInactiveCatalogue(f, () => action.run(f)); assert.equal(stale.code, readerIsolation === "repeatable read" ? "40001" : "42501", JSON.stringify(stale)); await a.ok("rollback;");
          await claims({ role: "authenticated", sub: f.chief, aal: "aal2" }, f.chief); const retry = await runWithInactiveCatalogue(f, () => action.run(f)); assert.equal(retry.code, "42501", JSON.stringify(retry));
          assert.equal((await observer.ok(f.snapshotSql)).at(-1), afterWrite, "inactive-owner approval read/retry changed snapshot"); await a.ok("reset role;"); await b.ok("reset role;");
          record(`M2.2C onboarding.approve ${action.name} owner deactivation writer-first (${readerIsolation}/${writerIsolation})`, true, { isolationPair: `${readerIsolation}/${writerIsolation}`, ownerDeactivationSQLSTATE: deactivated.code, staleReaderSQLSTATE: stale.code, freshRetrySQLSTATE: retry.code, postDeactivationSnapshotUnchanged: true });
        }
      }
      const saveRequest = { contractVersion: 1, operationId: uid(350), kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${actor}`]: onboardingRevision }, payload: { requestId: null, draft: requestDraft } };
      await claims({ role: "authenticated", sub: actor, aal: "aal1" });
      const savedRequestCall = await a.query(`select api.command_v1('${JSON.stringify(saveRequest).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(savedRequestCall.code, "00000", JSON.stringify(savedRequestCall));
      const requestId = JSON.parse(savedRequestCall.lines.at(-1)).result.requestId;
      const submitRequest = { contractVersion: 1, operationId: uid(351), kind: "onboarding.submit", expectedRevisions: { [`onboarding:${requestId}`]: "0", [`onboardingDraft:${requestId}`]: "1" }, payload: { requestId } };
      const submittedRequestCall = await a.query(`select api.command_v1('${JSON.stringify(submitRequest).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(submittedRequestCall.code, "00000", JSON.stringify(submittedRequestCall));
      const requestIds = [requestId], owners = [actor];
      const owner2 = uid(360);
      await observer.ok(`insert into auth.users(id) values(${lit(owner2)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(owner2)},${lit(org)},'Synthetic C employee 2','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(owner2)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(owner2)});`);
      const secondDraft = { ...requestDraft, lines: [{ ...requestDraft.lines[0], lineId: uid(356) }] };
      await claims({ role: "authenticated", sub: owner2, aal: "aal1" }, owner2);
      const secondSave = { contractVersion: 1, operationId: uid(355), kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${owner2}`]: "0" }, payload: { requestId: null, draft: secondDraft } };
      const secondSaved = await a.query(`select api.command_v1('${JSON.stringify(secondSave).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(secondSaved.code, "00000", JSON.stringify(secondSaved));
      const secondRequestId = JSON.parse(secondSaved.lines.at(-1)).result.requestId;
      requestIds.push(secondRequestId); owners.push(owner2);
      const secondSubmit = { contractVersion: 1, operationId: uid(357), kind: "onboarding.submit", expectedRevisions: { [`onboarding:${secondRequestId}`]: "0", [`onboardingDraft:${secondRequestId}`]: "1" }, payload: { requestId: secondRequestId } };
      const secondSubmitted = await a.query(`select api.command_v1('${JSON.stringify(secondSubmit).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(secondSubmitted.code, "00000", JSON.stringify(secondSubmitted));
      await a.ok("reset role;");
      const approveFirst = i => i % 2 === 0 ? a : b;
      for (let i = 0; i < 2; i++) {
        const currentRequestId = requestIds[i];
        const approvals = [uid(358 + i * 2), uid(359 + i * 2)].map((operationId) => ({ contractVersion: 1, operationId, kind: "onboarding.approve", expectedRevisions: { [`onboarding:${currentRequestId}`]: "1", [`catalogue:${JSON.parse(standardCall.lines.at(-1)).result.templateId}`]: "1" }, payload: { requestId: currentRequestId, weightOverrides: [], period: monthPeriod } }));
        const [isoA, isoB] = i === 0 ? ["read committed", "read committed"] : ["repeatable read", "repeatable read"];
        const first = approveFirst(i), second = first === a ? b : a;
        const firstApproval = approvals[i], secondApproval = approvals[1 - i];
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        await first.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${isoA};`);
        const firstPid = Number((await first.ok("select pg_backend_pid();")).at(-1));
        const firstResult = await first.query(`select api.command_v1('${JSON.stringify(firstApproval).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(firstResult.code, "00000", JSON.stringify(firstResult));
        await second.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${isoB};select count(*) from public.profiles;`);
        const secondPid = Number((await second.ok("select pg_backend_pid();")).at(-1));
        const pending = second.query(`select api.command_v1('${JSON.stringify(secondApproval).replaceAll("'", "''")}'::jsonb);`);
        let blocked = false;
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          if ((await observer.ok(`select ${firstPid}=any(pg_catalog.pg_blocking_pids(${secondPid}));`)).at(-1) === "t") { blocked = true; break; }
          await new Promise((done) => setTimeout(done, 20));
        }
        await first.ok("commit;");
        const secondResult = await pending;
        await second.ok(secondResult.code === "00000" ? "commit;" : "rollback;");
        assert.equal(blocked, true, "approve/approve did not block on request lock");
        assert.equal(secondResult.code, "40001", JSON.stringify(secondResult));
        await second.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
        const replay = await second.query(`select api.command_v1('${JSON.stringify(firstApproval).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(replay.code, "00000", JSON.stringify(replay));
        await second.ok("reset role;"); await first.ok("reset role;");
        const outcome = (await observer.ok(`select status||'|'||(select count(*) from public.onboarding_activations where request_id=${lit(currentRequestId)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id in (${lit(approvals[0].operationId)},${lit(approvals[1].operationId)})) from public.onboarding_requests where id=${lit(currentRequestId)};`)).at(-1);
        assert.equal(outcome, "approved|1|1", outcome);
        record(`M2.2C concurrent approvals serialize, reject a competing approval and replay exact receipt (${isoA}/${isoB})`, true, { isolationPair: `${isoA}/${isoB}`, firstBackend: first === a ? "A" : "B", blocked, winnerSQLSTATE: firstResult.code, loserSQLSTATE: secondResult.code, exactReplaySQLSTATE: replay.code, finalStatusActivationsReceipts: outcome });
        if (i === 0) {
          await first.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level read committed;`);
          const replayFirstPid = Number((await first.ok("select pg_backend_pid();")).at(-1));
          const replayFirst = await first.query(`select api.command_v1('${JSON.stringify(approvals[0]).replaceAll("'", "''")}'::jsonb);`); assert.equal(replayFirst.code, "00000", JSON.stringify(replayFirst));
          await second.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select count(*) from public.onboarding_requests;`);
          const replaySecondPid = Number((await second.ok("select pg_backend_pid();")).at(-1));
          const replayPending = second.query(`select api.command_v1('${JSON.stringify(approvals[0]).replaceAll("'", "''")}'::jsonb);`);
          let replayBlocked = false; const replayDeadline = Date.now() + 10000; while (Date.now() < replayDeadline) { if ((await observer.ok(`select ${replayFirstPid}=any(pg_catalog.pg_blocking_pids(${replaySecondPid}));`)).at(-1) === "t") { replayBlocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
          await first.ok("commit;"); const replaySecond = await replayPending; assert.equal(replaySecond.code, "00000", JSON.stringify(replaySecond)); await second.ok("commit;");
          const replayState = (await observer.ok(`select (select count(*) from public.onboarding_activations where request_id=${lit(currentRequestId)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(approvals[0].operationId)});`)).at(-1); assert.equal(replayState, "1|1", replayState); assert.equal(replayBlocked, true);
          record("M2.2C exact onboarding receipt replay serializes across mixed RC/RR and returns one activation", true, { isolationPair: "read committed/repeatable read", blocked: replayBlocked, firstSQLSTATE: replayFirst.code, secondSQLSTATE: replaySecond.code, state: replayState });
          await first.ok("reset role;"); await second.ok("reset role;");
          await second.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select count(*) from public.onboarding_requests;`);
          const reverseFirstPid = Number((await second.ok("select pg_backend_pid();")).at(-1));
          const reverseFirst = await second.query(`select api.command_v1('${JSON.stringify(approvals[0]).replaceAll("'", "''")}'::jsonb);`); assert.equal(reverseFirst.code, "00000", JSON.stringify(reverseFirst));
          await first.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level read committed;`);
          const reverseSecondPid = Number((await first.ok("select pg_backend_pid();")).at(-1));
          const reversePending = first.query(`select api.command_v1('${JSON.stringify(approvals[0]).replaceAll("'", "''")}'::jsonb);`);
          let reverseBlocked = false; const reverseDeadline = Date.now() + 10000; while (Date.now() < reverseDeadline) { if ((await observer.ok(`select ${reverseFirstPid}=any(pg_catalog.pg_blocking_pids(${reverseSecondPid}));`)).at(-1) === "t") { reverseBlocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
          await second.ok("commit;"); const reverseSecond = await reversePending; assert.equal(reverseSecond.code, "00000", JSON.stringify(reverseSecond)); await first.ok("commit;");
          assert.equal(reverseBlocked, true);
          record("M2.2C exact onboarding receipt replay serializes across reverse mixed RR/RC and returns one activation", true, { isolationPair: "repeatable read/read committed", blocked: reverseBlocked, firstSQLSTATE: reverseFirst.code, secondSQLSTATE: reverseSecond.code, state: replayState });
          await first.ok("reset role;"); await second.ok("reset role;");
        }
      }
      {
        const revokedOwner = uid(390), revokedLine = uid(391), revokedRequestOp = uid(392), revokedSubmitOp = uid(393), revokedApproveOp = uid(394), revokeOp = uid(395);
        await observer.ok(`insert into auth.users(id) values(${lit(revokedOwner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(revokedOwner)},${lit(org)},'Synthetic membership revoke C','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(revokedOwner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(revokedOwner)});`);
        const revokedDraft = { ...requestDraft, lines: [{ ...requestDraft.lines[0], lineId: revokedLine }] };
        await claims({ role: "authenticated", sub: revokedOwner, aal: "aal1" }, revokedOwner);
        const revokedSaveCommand = { contractVersion: 1, operationId: revokedRequestOp, kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${revokedOwner}`]: "0" }, payload: { requestId: null, draft: revokedDraft } };
        const saved = await a.query(`select api.command_v1('${JSON.stringify(revokedSaveCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(saved.code, "00000", JSON.stringify(saved));
        const revokedRequestId = JSON.parse(saved.lines.at(-1)).result.requestId;
        const revokedSubmitCommand = { contractVersion: 1, operationId: revokedSubmitOp, kind: "onboarding.submit", expectedRevisions: { [`onboarding:${revokedRequestId}`]: "0", [`onboardingDraft:${revokedRequestId}`]: "1" }, payload: { requestId: revokedRequestId } };
        const submitted = await a.query(`select api.command_v1('${JSON.stringify(revokedSubmitCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(submitted.code, "00000", JSON.stringify(submitted)); await a.ok("reset role;");
        const approve = { contractVersion: 1, operationId: revokedApproveOp, kind: "onboarding.approve", expectedRevisions: { [`onboarding:${revokedRequestId}`]: "1", [`catalogue:${JSON.parse(standardCall.lines.at(-1)).result.templateId}`]: "1" }, payload: { requestId: revokedRequestId, weightOverrides: [], period: monthPeriod } };
        const revoke = { contractVersion: 1, operationId: revokeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${revokedOwner}`]: "0" }, payload: { companyId: company, profileId: revokedOwner, active: false, reason: "Revoke-first onboarding race" } };
        await a.ok(`select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level read committed;`);
        const revokeResult = await a.query(`select api.command_v1('${JSON.stringify(revoke).replaceAll("'", "''")}'::jsonb);`); assert.equal(revokeResult.code, "00000", JSON.stringify(revokeResult));
        const revokePid = Number((await a.ok("select pg_backend_pid();")).at(-1));
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select count(*) from public.company_memberships where profile_id=${lit(revokedOwner)};`);
        const approvePid = Number((await b.ok("select pg_backend_pid();")).at(-1)); const pending = b.query(`select api.command_v1('${JSON.stringify(approve).replaceAll("'", "''")}'::jsonb);`);
        let blocked = false; const deadline = Date.now() + 10000; while (Date.now() < deadline) { if ((await observer.ok(`select ${revokePid}=any(pg_catalog.pg_blocking_pids(${approvePid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
         await a.ok("commit;"); const stale = await pending; await b.ok(stale.code === "00000" ? "commit;" : "rollback;"); assert.equal(blocked, true); assert.equal(stale.code, "40001", JSON.stringify(stale));
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
        const retry = await b.query(`select api.command_v1('${JSON.stringify(approve).replaceAll("'", "''")}'::jsonb);`); assert.equal(retry.code, "42501", JSON.stringify(retry)); await b.ok("reset role;");
        await claims({ role: "authenticated", sub: revokedOwner, aal: "aal1" }, revokedOwner);
        const saveReplayAfterRevoke = await a.query(`select api.command_v1('${JSON.stringify(revokedSaveCommand).replaceAll("'", "''")}'::jsonb);`);
        const submitReplayAfterRevoke = await a.query(`select api.command_v1('${JSON.stringify(revokedSubmitCommand).replaceAll("'", "''")}'::jsonb);`);
        const receiptQuery = operationId => ({ contractVersion: 1, kind: "commandReceipt", filters: { operationId }, cursor: null, limit: 1 });
        const saveReceiptAfterRevoke = await a.query(`select api.query_v1('${JSON.stringify(receiptQuery(revokedRequestOp)).replaceAll("'", "''")}'::jsonb);`);
        const submitReceiptAfterRevoke = await a.query(`select api.query_v1('${JSON.stringify(receiptQuery(revokedSubmitOp)).replaceAll("'", "''")}'::jsonb);`);
        const onboardingReplayDenied = saveReplayAfterRevoke.code === "42501" && submitReplayAfterRevoke.code === "42501" && saveReceiptAfterRevoke.code === "42501" && submitReceiptAfterRevoke.code === "42501";
        record("M2.2C membership-revoked owner cannot replay or query exact onboarding draft/submit receipts", onboardingReplayDenied, { expectedSQLSTATE: "42501", saveDraftReplaySQLSTATE: saveReplayAfterRevoke.code, submitReplaySQLSTATE: submitReplayAfterRevoke.code, saveDraftReceiptSQLSTATE: saveReceiptAfterRevoke.code, submitReceiptSQLSTATE: submitReceiptAfterRevoke.code, requestStatus: (await observer.ok(`select status from public.onboarding_requests where id=${lit(revokedRequestId)};`)).at(-1) });
        await a.ok("reset role;");
        const state = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where profile_id=${lit(revokedOwner)} and company_id=${lit(company)})||'|'||(select status from public.onboarding_requests where id=${lit(revokedRequestId)})||'|'||(select count(*) from public.onboarding_activations where request_id=${lit(revokedRequestId)})||'|'||(select count(*) from public.task_assignments where owner_id=${lit(revokedOwner)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(revokedApproveOp)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(revokeOp)});`)).at(-1); assert.equal(state, "false|1|submitted|0|0|0|1", state);
        await a.ok("reset role;");
        record("M2.2C revoke-first soft membership revocation fences RR approval; stale approval denies after retry", true, { blocked, revokeSQLSTATE: revokeResult.code, staleApprovalSQLSTATE: stale.code, retrySQLSTATE: retry.code, draftReplaySQLSTATE: saveReplayAfterRevoke.code, submitReplaySQLSTATE: submitReplayAfterRevoke.code, draftReceiptSQLSTATE: saveReceiptAfterRevoke.code, submitReceiptSQLSTATE: submitReceiptAfterRevoke.code, finalMembershipAndOnboardingState: state });
      }
      {
        const receiptRaceOwner = uid(150010), receiptRaceRequest = await makeRequest(receiptRaceOwner, uid(150011), 150012), receiptRaceRevokeOp = uid(150014);
        // The helper uses opBase + 1 for submit; construct the actual id used.
        const submitOperationId = uid(150013);
        const receiptQuery = { contractVersion: 1, kind: "commandReceipt", filters: { operationId: submitOperationId }, cursor: null, limit: 1 };
        await claims({ role: "authenticated", sub: receiptRaceOwner, aal: "aal1" }, receiptRaceOwner);
        await a.ok("begin isolation level read committed;");
        const receiptPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
        const receiptFirst = await a.query(`select api.query_v1('${JSON.stringify(receiptQuery).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(receiptFirst.code, "00000", JSON.stringify(receiptFirst));
        assert.match(receiptFirst.lines.at(-1), /"found": true/);
        const revoke = { contractVersion: 1, operationId: receiptRaceRevokeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${receiptRaceOwner}`]: "0" }, payload: { companyId: company, profileId: receiptRaceOwner, active: false, reason: "Receipt read first" } };
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level read committed;`);
        const revokePid = Number((await b.ok("select pg_backend_pid();")).at(-1));
        const pendingRevoke = b.query(`select api.command_v1('${JSON.stringify(revoke).replaceAll("'", "''")}'::jsonb);`);
        let receiptBlockedRevocation = false; const receiptDeadline = Date.now() + 10000;
        while (Date.now() < receiptDeadline) { if ((await observer.ok(`select ${receiptPid}=any(pg_catalog.pg_blocking_pids(${revokePid}));`)).at(-1) === "t") { receiptBlockedRevocation = true; break; } await new Promise(done => setTimeout(done, 20)); }
        await a.ok("commit;"); const revokeAfterReceipt = await pendingRevoke; await b.ok(revokeAfterReceipt.code === "00000" ? "commit;" : "rollback;");
        assert.equal(receiptBlockedRevocation, true); assert.equal(revokeAfterReceipt.code, "00000", JSON.stringify(revokeAfterReceipt));
        await claims({ role: "authenticated", sub: receiptRaceOwner, aal: "aal1" }, receiptRaceOwner);
        const staleReceipt = await a.query(`select api.query_v1('${JSON.stringify(receiptQuery).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(staleReceipt.code, "42501", JSON.stringify(staleReceipt));
        await a.ok("reset role;"); await b.ok("reset role;");
        const receiptRaceState = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(receiptRaceOwner)})||'|'||(select status from public.onboarding_requests where id=${lit(receiptRaceRequest)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(submitOperationId)})||'|'||(select count(*) from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(receiptRaceOwner)});`)).at(-1);
        assert.equal(receiptRaceState, "false|1|submitted|1|1", receiptRaceState);
        record("M2.2C submit commandReceipt read-first serializes before membership revocation and is denied afterward", true, { receiptSQLSTATE: receiptFirst.code, revokeBlockedByReceipt: receiptBlockedRevocation, revokeSQLSTATE: revokeAfterReceipt.code, postRevocationReceiptSQLSTATE: staleReceipt.code, finalMembershipRequestReceiptFence: receiptRaceState });
      }
      {
        const staleReceiptOwner = uid(150020), staleReceiptRequest = await makeRequest(staleReceiptOwner, uid(150021), 150022), staleReceiptRevokeOp = uid(150024);
        const operationId = uid(150023), query = { contractVersion: 1, kind: "commandReceipt", filters: { operationId }, cursor: null, limit: 1 };
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(staleReceiptOwner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: staleReceiptOwner, aal: "aal1" }))},false);set role authenticated;begin isolation level repeatable read;select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(staleReceiptOwner)};`);
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        const revoke = { contractVersion: 1, operationId: staleReceiptRevokeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${staleReceiptOwner}`]: "0" }, payload: { companyId: company, profileId: staleReceiptOwner, active: false, reason: "Receipt stale snapshot" } };
        const revoked = await a.query(`select api.command_v1('${JSON.stringify(revoke).replaceAll("'", "''")}'::jsonb);`); assert.equal(revoked.code, "00000", JSON.stringify(revoked));
        const stale = await b.query(`select api.query_v1('${JSON.stringify(query).replaceAll("'", "''")}'::jsonb);`);
        await b.ok("rollback;"); assert.equal(stale.code, "40001", JSON.stringify(stale));
        const retry = await b.query(`select api.query_v1('${JSON.stringify(query).replaceAll("'", "''")}'::jsonb);`); assert.equal(retry.code, "42501", JSON.stringify(retry));
        await b.ok("reset role;"); await a.ok("reset role;");
        const state = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(staleReceiptOwner)})||'|'||(select status from public.onboarding_requests where id=${lit(staleReceiptRequest)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(operationId)})||'|'||(select count(*) from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(staleReceiptOwner)});`)).at(-1);
        assert.equal(state, "false|1|submitted|1|1", state);
        record("M2.2C RR commandReceipt snapshot aborts after membership revocation and fresh retry denies", true, { revokeSQLSTATE: revoked.code, staleReceiptSQLSTATE: stale.code, retrySQLSTATE: retry.code, finalMembershipRequestReceiptFence: state });
      }
      {
        const firstSubmitOwner = uid(150000), firstSubmitLine = uid(150001), saveOp = uid(150002), submitOp = uid(150003), revokeOp = uid(150004);
        await observer.ok(`insert into auth.users(id) values(${lit(firstSubmitOwner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(firstSubmitOwner)},${lit(org)},'M2.2C first submit under membership fence','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(firstSubmitOwner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(firstSubmitOwner)});`);
        const firstSubmitDraft = { ...requestDraft, lines: [{ ...requestDraft.lines[0], lineId: firstSubmitLine }] };
        await claims({ role: "authenticated", sub: firstSubmitOwner, aal: "aal1" }, firstSubmitOwner);
        const saveFirstSubmit = { contractVersion: 1, operationId: saveOp, kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${firstSubmitOwner}`]: "0" }, payload: { requestId: null, draft: firstSubmitDraft } };
        const savedFirstSubmit = await a.query(`select api.command_v1('${JSON.stringify(saveFirstSubmit).replaceAll("'", "''")}'::jsonb);`); assert.equal(savedFirstSubmit.code, "00000", JSON.stringify(savedFirstSubmit));
        const firstSubmitRequestId = JSON.parse(savedFirstSubmit.lines.at(-1)).result.requestId;
        const submitFirst = { contractVersion: 1, operationId: submitOp, kind: "onboarding.submit", expectedRevisions: { [`onboarding:${firstSubmitRequestId}`]: "0", [`onboardingDraft:${firstSubmitRequestId}`]: "1" }, payload: { requestId: firstSubmitRequestId } };
        await a.ok("reset role;");
        const revokeBeforeFirstSubmit = { contractVersion: 1, operationId: revokeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${firstSubmitOwner}`]: "0" }, payload: { companyId: company, profileId: firstSubmitOwner, active: false, reason: "First submit membership-fence regression" } };
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss); await a.ok("begin isolation level read committed;");
        const revokerPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
        const revokeBeforeFirstSubmitResult = await a.query(`select api.command_v1('${JSON.stringify(revokeBeforeFirstSubmit).replaceAll("'", "''")}'::jsonb);`); assert.equal(revokeBeforeFirstSubmitResult.code, "00000", JSON.stringify(revokeBeforeFirstSubmitResult));
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(firstSubmitOwner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: firstSubmitOwner, aal: "aal1" }))},false);set role authenticated;begin isolation level repeatable read;select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(firstSubmitOwner)};`);
        const staleSubmitPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
        const staleFirstSubmitPending = b.query(`select api.command_v1('${JSON.stringify(submitFirst).replaceAll("'", "''")}'::jsonb);`);
        let firstSubmitBlocked = false; const firstSubmitDeadline = Date.now() + 10000;
        while (Date.now() < firstSubmitDeadline) { if ((await observer.ok(`select ${revokerPid}=any(pg_catalog.pg_blocking_pids(${staleSubmitPid}));`)).at(-1) === "t") { firstSubmitBlocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
        await a.ok("commit;"); const staleFirstSubmit = await staleFirstSubmitPending; await b.ok("rollback;");
        assert.equal(firstSubmitBlocked, true); assert.equal(staleFirstSubmit.code, "40001", JSON.stringify(staleFirstSubmit));
        const firstSubmitRetry = await b.query(`select api.command_v1('${JSON.stringify(submitFirst).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(firstSubmitRetry.code, "42501", JSON.stringify(firstSubmitRetry)); await b.ok("reset role;"); await a.ok("reset role;");
        const firstSubmitFinal = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(firstSubmitOwner)})||'|'||(select status from public.onboarding_requests where id=${lit(firstSubmitRequestId)})||'|'||(select count(*) from public.onboarding_request_versions where request_id=${lit(firstSubmitRequestId)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(submitOp)});`)).at(-1);
        assert.equal(firstSubmitFinal, "false|1|draft|0|0", firstSubmitFinal);
        record("M2.2C RR first onboarding submit waits behind membership revoke, stale draft access aborts, fresh retry denies without submit writes", true, { blockerObserved: firstSubmitBlocked, staleSubmitSQLSTATE: staleFirstSubmit.code, retrySQLSTATE: firstSubmitRetry.code, finalState: firstSubmitFinal });
      }
      {
        const owner = uid(920), request = await makeRequest(owner, uid(921), 922), approveOp = uid(924), revokeOp = uid(925);
        const approve = { contractVersion: 1, operationId: approveOp, kind: "onboarding.approve", expectedRevisions: { [`onboarding:${request}`]: "1", [`catalogue:${JSON.parse(standardCall.lines.at(-1)).result.templateId}`]: "1" }, payload: { requestId: request, weightOverrides: [], period: monthPeriod } };
        const revoke = { contractVersion: 1, operationId: revokeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${owner}`]: "0" }, payload: { companyId: company, profileId: owner, active: false, reason: "Approval-first membership soft revocation" } };
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        await a.ok(`begin isolation level read committed;`);
        const approvePid = Number((await a.ok("select pg_backend_pid();")).at(-1));
        const approveResult = await a.query(`select api.command_v1('${JSON.stringify(approve).replaceAll("'", "''")}'::jsonb);`); assert.equal(approveResult.code, "00000", JSON.stringify(approveResult));
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(owner)};`);
        const revokePid = Number((await b.ok("select pg_backend_pid();")).at(-1));
        const revokePending = b.query(`select api.command_v1('${JSON.stringify(revoke).replaceAll("'", "''")}'::jsonb);`);
        let blocked = false; const deadline = Date.now() + 10000; while (Date.now() < deadline) { if ((await observer.ok(`select ${approvePid}=any(pg_catalog.pg_blocking_pids(${revokePid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
        await a.ok("commit;"); const revokeResult = await revokePending; await b.ok("rollback;"); assert.equal(blocked, true);
        assert.equal(revokeResult.code, "40001", JSON.stringify(revokeResult));
        const approvedAssignments = await observer.ok(`select count(*) from public.task_assignments where owner_id=${lit(owner)} and company_id=${lit(company)};`);
        assert.equal(Number(approvedAssignments.at(-1)) > 0, true, "approval did not create the assignment that protects its company membership");
        await b.ok("reset role;select set_config('request.jwt.claim.sub',"+lit(boss)+",false),set_config('request.jwt.claims',"+lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))+",false);set role authenticated;"); const retry = await b.query(`select api.command_v1('${JSON.stringify(revoke).replaceAll("'", "''")}'::jsonb);`); assert.equal(retry.code, "00000", JSON.stringify(retry)); await b.ok("reset role;"); await a.ok("reset role;");
        const state = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where profile_id=${lit(owner)} and company_id=${lit(company)})||'|'||(select status from public.onboarding_requests where id=${lit(request)})||'|'||(select count(*) from public.onboarding_activations where request_id=${lit(request)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(approveOp)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(revokeOp)})||'|'||(select count(*) from public.task_assignments where owner_id=${lit(owner)} and company_id=${lit(company)});`)).at(-1); assert.equal(state, `false|1|approved|1|1|1|${approvedAssignments.at(-1)}`, state);
        record("M2.2C approval-first membership soft revocation waits, stale RR aborts, retry preserves approved activation", true, { isolationPair: "read committed/repeatable read", blocked, approvalSQLSTATE: approveResult.code, staleRevocationSQLSTATE: revokeResult.code, retrySQLSTATE: retry.code, protectingAssignments: approvedAssignments.at(-1), finalMembershipStatusActivationReceiptsAssignments: state });
      }
      {
        const inactiveOwner = uid(872), inactiveLine = uid(873), inactiveSaveOp = uid(874), inactiveSubmitOp = uid(875), inactiveApproveOp = uid(876);
        await observer.ok(`insert into auth.users(id) values(${lit(inactiveOwner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(inactiveOwner)},${lit(org)},'Synthetic inactive C owner','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(inactiveOwner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(inactiveOwner)});`);
        const inactiveDraft = { ...requestDraft, lines: [{ ...requestDraft.lines[0], lineId: inactiveLine }] };
        await claims({ role: "authenticated", sub: inactiveOwner, aal: "aal1" }, inactiveOwner);
        const inactiveSave = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: inactiveSaveOp, kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${inactiveOwner}`]: "0" }, payload: { requestId: null, draft: inactiveDraft } }).replaceAll("'", "''")}'::jsonb);`); assert.equal(inactiveSave.code, "00000", JSON.stringify(inactiveSave));
        const inactiveRequest = JSON.parse(inactiveSave.lines.at(-1)).result.requestId;
        const inactiveSubmit = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: inactiveSubmitOp, kind: "onboarding.submit", expectedRevisions: { [`onboarding:${inactiveRequest}`]: "0", [`onboardingDraft:${inactiveRequest}`]: "1" }, payload: { requestId: inactiveRequest } }).replaceAll("'", "''")}'::jsonb);`); assert.equal(inactiveSubmit.code, "00000", JSON.stringify(inactiveSubmit)); await a.ok("reset role;");
        const inactiveApprove = { contractVersion: 1, operationId: inactiveApproveOp, kind: "onboarding.approve", expectedRevisions: { [`onboarding:${inactiveRequest}`]: "1", [`catalogue:${JSON.parse(standardCall.lines.at(-1)).result.templateId}`]: "1" }, payload: { requestId: inactiveRequest, weightOverrides: [], period: monthPeriod } };
        await a.ok(`begin isolation level read committed;update public.profiles set active=false where id=${lit(inactiveOwner)};`);
        const deactivatePid = Number((await a.ok("select pg_backend_pid();")).at(-1));
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select active from public.profiles where id=${lit(inactiveOwner)};`);
        const inactiveApprovePid = Number((await b.ok("select pg_backend_pid();")).at(-1)); const inactivePending = b.query(`select api.command_v1('${JSON.stringify(inactiveApprove).replaceAll("'", "''")}'::jsonb);`);
        let inactiveBlocked = false; const inactiveDeadline = Date.now() + 10000; while (Date.now() < inactiveDeadline) { if ((await observer.ok(`select ${deactivatePid}=any(pg_catalog.pg_blocking_pids(${inactiveApprovePid}));`)).at(-1) === "t") { inactiveBlocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
        await a.ok("commit;"); const inactiveStale = await inactivePending; await b.ok(inactiveStale.code === "00000" ? "commit;" : "rollback;"); assert.equal(inactiveBlocked, true); assert.equal(inactiveStale.code, "40001", JSON.stringify(inactiveStale));
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
        const inactiveRetry = await b.query(`select api.command_v1('${JSON.stringify(inactiveApprove).replaceAll("'", "''")}'::jsonb);`); assert.equal(inactiveRetry.code, "42501", JSON.stringify(inactiveRetry)); await b.ok("reset role;");
        const inactiveState = (await observer.ok(`select (select active::text from public.profiles where id=${lit(inactiveOwner)})||'|'||(select status from public.onboarding_requests where id=${lit(inactiveRequest)})||'|'||(select count(*) from public.onboarding_activations where request_id=${lit(inactiveRequest)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(inactiveApproveOp)});`)).at(-1); assert.equal(inactiveState, "false|submitted|0|0", inactiveState);
        record("M2.2C profile inactivation waits for RR approval and retry denies without activation", true, { blocked: inactiveBlocked, staleSQLSTATE: inactiveStale.code, retrySQLSTATE: inactiveRetry.code, state: inactiveState });
      }
      {
        const owner = uid(930), request = await makeRequest(owner, uid(931), 932), approveOp = uid(934);
        const approve = { contractVersion: 1, operationId: approveOp, kind: "onboarding.approve", expectedRevisions: { [`onboarding:${request}`]: "1", [`catalogue:${JSON.parse(standardCall.lines.at(-1)).result.templateId}`]: "1" }, payload: { requestId: request, weightOverrides: [], period: monthPeriod } };
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss); await a.ok("begin isolation level read committed;");
        const approvePid = Number((await a.ok("select pg_backend_pid();")).at(-1)); const approveResult = await a.query(`select api.command_v1('${JSON.stringify(approve).replaceAll("'", "''")}'::jsonb);`); assert.equal(approveResult.code, "00000", JSON.stringify(approveResult));
        await b.ok(`reset role;begin isolation level repeatable read;select active from public.profiles where id=${lit(owner)};`);
        const mutationPid = Number((await b.ok("select pg_backend_pid();")).at(-1)); const mutationPending = b.query(`update public.profiles set active=false where id=${lit(owner)};`);
        let blocked = false; const deadline = Date.now() + 10000; while (Date.now() < deadline) { if ((await observer.ok(`select ${approvePid}=any(pg_catalog.pg_blocking_pids(${mutationPid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
        await a.ok("commit;"); const mutationResult = await mutationPending; await b.ok(mutationResult.code === "00000" ? "commit;" : "rollback;"); assert.equal(blocked, true);
        let retry = mutationResult;
        if (mutationResult.code === "40001") { await b.ok("begin isolation level read committed;"); retry = await b.query(`update public.profiles set active=false where id=${lit(owner)};`); await b.ok(retry.code === "00000" ? "commit;" : "rollback;"); }
        assert.equal(retry.code, "00000", JSON.stringify(retry)); await a.ok("reset role;"); await b.ok("reset role;");
        const state = (await observer.ok(`select (select active::text from public.profiles where id=${lit(owner)})||'|'||(select status from public.onboarding_requests where id=${lit(request)})||'|'||(select count(*) from public.onboarding_activations where request_id=${lit(request)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(approveOp)});`)).at(-1); assert.equal(state, "false|approved|1|1", state);
        record("M2.2C approval-first profile inactivation waits, retries and preserves committed activation", true, { isolationPair: "read committed/repeatable read", blocked, approvalSQLSTATE: approveResult.code, inactivationSQLSTATE: mutationResult.code, retrySQLSTATE: retry.code, finalActiveStatusActivationReceipt: state });
      }
      // Same-isolation responsibility/onboarding approval races. Each case has
      // its own task, request, operation IDs, and two distinct AAL2 chiefs.
      // The winner stays uncommitted until pg_blocking_pids proves the other
      // operation is waiting. Depending on order/isolation, the loser either
      // aborts stale state and retries in a new session, or approval-first RC
      // applies responsibility to the unchanged pre-existing task.
      for (let i = 0; i < 4; i++) {
        const base = 50000 + i * 20;
        const owner = uid(base), lineId = uid(base + 1), assignment = uid(base + 2), taskId = uid(base + 3);
        const responsibilityChief = uid(base + 4), approvalChief = uid(base + 5);
        const saveOp = uid(base + 6), submitOp = uid(base + 7), responsibilityOp = uid(base + 8), approvalOp = uid(base + 9);
        const iso = i < 2 ? "read committed" : "repeatable read";
        const order = i % 2 === 0 ? "responsibility-first" : "approval-first";
        const members = [{ profileId: owner, shareBps: 5000 }, { profileId: actor, shareBps: 5000 }];
        await observer.ok(`insert into auth.users(id) values(${lit(owner)}),(${lit(responsibilityChief)}),(${lit(approvalChief)});
          insert into public.profiles(id,organization_id,name,role,sector,branch,position) values
            (${lit(owner)},${lit(org)},${lit(`M2.2C responsibility approval owner ${i}`)},'empleado','Test','Test','Test'),
            (${lit(responsibilityChief)},${lit(org)},${lit(`M2.2C responsibility chief ${i}`)},'jefe','Test','Test','Jefe'),
            (${lit(approvalChief)},${lit(org)},${lit(`M2.2C approval chief ${i}`)},'jefe','Test','Test','Jefe');
          insert into public.company_memberships(organization_id,company_id,profile_id) values
            (${lit(org)},${lit(company)},${lit(owner)}),(${lit(org)},${lit(company)},${lit(responsibilityChief)}),(${lit(org)},${lit(company)},${lit(approvalChief)});
          insert into public.team_members(organization_id,team_id,profile_id) values
            (${lit(org)},${lit(team)},${lit(owner)}),(${lit(org)},${lit(team)},${lit(responsibilityChief)}),(${lit(org)},${lit(team)},${lit(approvalChief)});
          insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days)
            values(${lit(assignment)},${lit(org)},${lit(company)},${lit(owner)},${lit(team)},'M2.2C same-isolation responsibility approval ${i}','resultado',1,null,null,'unica',date_trunc('month',${lit(scheduledOn)}::date)::date,extract(day from ${lit(scheduledOn)}::date)::integer,'[]',${lit(scheduledOn)},${lit(scheduledOn)},1,array[1]::smallint[],extract(day from ${lit(scheduledOn)}::date)::smallint,true,0);
          insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
            values(${lit(taskId)},${lit(org)},${lit(assignment)},${lit(company)},${lit(owner)},${lit(team)},date_trunc('month',${lit(scheduledOn)}::date)::date,${lit(scheduledOn)},'M2.2C same-isolation responsibility approval ${i}','resultado',1,${lit(scheduledOn)},null,null,'[]','Pendiente');`);
        const draft = { ...requestDraft, lines: [{ lineId, companyId: company, teamId: team,
          source: { type: "custom", definition: { kind: "operativa", title: `M2.2C same-isolation onboarding ${i}`, objective: "", sector: "Test", unit: "documentos" } },
          schedule: { ...requestDraft.lines[0].schedule, frequency: "unica", startDate: scheduledOn, endDate: scheduledOn } }] };
        await claims({ role: "authenticated", sub: owner, aal: "aal1" }, owner);
        const saved = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: saveOp, kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${owner}`]: "0" }, payload: { requestId: null, draft } }).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(saved.code, "00000", JSON.stringify(saved));
        const request = JSON.parse(saved.lines.at(-1)).result.requestId;
        const submitted = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: submitOp, kind: "onboarding.submit", expectedRevisions: { [`onboarding:${request}`]: "0", [`onboardingDraft:${request}`]: "1" }, payload: { requestId: request } }).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(submitted.code, "00000", JSON.stringify(submitted)); await a.ok("reset role;");
        const approve = { contractVersion: 1, operationId: approvalOp, kind: "onboarding.approve", expectedRevisions: { [`onboarding:${request}`]: "1" }, payload: { requestId: request, weightOverrides: [], period: monthPeriod } };
        const responsibilitySql = `select public.assign_task_responsibility(${lit(taskId)},'${JSON.stringify(members)}'::jsonb,'M2.2C same-isolation onboarding approval race',1,${lit(responsibilityOp)});`;
        const approvalSql = `select api.command_v1('${JSON.stringify(approve).replaceAll("'", "''")}'::jsonb);`;
        const snapshot = async () => JSON.parse((await observer.ok(`select jsonb_build_object(
          'request',(select to_jsonb(r) from public.onboarding_requests r where r.id=${lit(request)}),
          'requestVersion',(select to_jsonb(v) from public.onboarding_request_versions v where v.request_id=${lit(request)} and v.revision=1),
          'sourceAssignment',(select to_jsonb(a) from public.task_assignments a where a.id=${lit(assignment)}),
          'sourceTask',(select to_jsonb(t) from public.task_instances t where t.id=${lit(taskId)}),
          'responsibility',(select jsonb_build_object('head',to_jsonb(h),'set',to_jsonb(s),'members',(select coalesce(jsonb_agg(to_jsonb(m) order by m.profile_id),'[]'::jsonb) from public.task_responsibility_members m where m.set_id=s.id)) from public.task_responsibility_heads h join public.task_responsibility_sets s on s.id=h.set_id where h.instance_id=${lit(taskId)}),
          'activations',(select coalesce(jsonb_agg(to_jsonb(x) order by x.line_id),'[]'::jsonb) from public.onboarding_activations x where x.request_id=${lit(request)}),
          'onboardingAssignments',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.onboarding_activations x join public.task_assignments a on a.id=x.assignment_id where x.request_id=${lit(request)}),
          'onboardingTasks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.onboarding_activations x join public.task_instances t on t.assignment_id=x.assignment_id and t.period=${lit(monthPeriod)}::date where x.request_id=${lit(request)}),
          'commandReceipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.operation_id),'[]'::jsonb) from app_private.api_command_receipts r where r.actor_id=${lit(approvalChief)} and r.operation_id=${lit(approvalOp)}),
          'responsibilityReceipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.operation_id),'[]'::jsonb) from public.task_mutation_receipts r where r.actor_id=${lit(responsibilityChief)} and r.operation_id=${lit(responsibilityOp)}),
          'creationHead',(select to_jsonb(h) from app_private.api_creation_heads h where h.organization_id=${lit(org)} and h.owner_id=${lit(owner)}),
          'monthFence',(select coalesce(jsonb_agg(to_jsonb(f) order by f.period),'[]'::jsonb) from app_private.api_month_fences f where f.organization_id=${lit(org)} and f.owner_id=${lit(owner)} and f.period=${lit(monthPeriod)}::date),
          'audit',(select coalesce(jsonb_agg(to_jsonb(e) order by e.at,e.id),'[]'::jsonb) from public.audit_events e where e.entity_id in (${lit(request)},${lit(taskId)}) and e.actor_id in (${lit(responsibilityChief)},${lit(approvalChief)}) and e.action in ('task.responsibility_assigned','onboarding.approved'))
        )::text;`)).at(-1));
        const before = await snapshot();
        assert.equal(before.request.status, "submitted");
        assert.equal(before.responsibility.set.revision, 1);
        assert.equal(before.responsibility.set.origin, "baseline_legacy");
        assert.equal(before.activations.length, 0);
        const first = order === "responsibility-first" ? a : b;
        const second = order === "responsibility-first" ? b : a;
        const firstActor = order === "responsibility-first" ? responsibilityChief : approvalChief;
        const secondActor = order === "responsibility-first" ? approvalChief : responsibilityChief;
        const firstSql = order === "responsibility-first" ? responsibilitySql : approvalSql;
        const secondSql = order === "responsibility-first" ? approvalSql : responsibilitySql;
        const firstIsolation = iso;
        const loserIsolation = iso;
        const setSessionActor = (session, principal) => session.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(principal)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: principal, aal: "aal2" }))},false);set role authenticated;`);
        await setSessionActor(first, firstActor);
        await first.ok(`begin isolation level ${firstIsolation};`);
        const firstPid = Number((await first.ok("select pg_backend_pid();")).at(-1));
        const firstPending = first.query(firstSql);
        const firstResult = await firstPending; assert.equal(firstResult.code, "00000", JSON.stringify(firstResult));
        await setSessionActor(second, secondActor);
        await second.ok(`begin isolation level ${loserIsolation};select status from public.onboarding_requests where id=${lit(request)};select state_revision from public.task_instances where id=${lit(taskId)};`);
        const loserPid = Number((await second.ok("select pg_backend_pid();")).at(-1));
        const loserPending = second.query(secondSql);
        let blocked = false; const blockDeadline = Date.now() + 10000;
        while (Date.now() < blockDeadline) {
          if ((await observer.ok(`select ${firstPid}=any(pg_catalog.pg_blocking_pids(${loserPid}));`)).at(-1) === "t") { blocked = true; break; }
          await new Promise(done => setTimeout(done, 20));
        }
        assert.equal(blocked, true, `${order} ${iso}: loser PID ${loserPid} must be blocked by winner PID ${firstPid}`);
        const blockerPids = (await observer.ok(`select pg_catalog.pg_blocking_pids(${loserPid})::text;`)).at(-1);
        await first.ok("commit;");
        const loserResult = await loserPending;
        const afterWinnerCommit = await snapshot();
        const expectedLoserSuccess = order === "approval-first" && iso === "read committed";
        if (expectedLoserSuccess) {
          assert.equal(loserResult.code, "00000", JSON.stringify(loserResult));
          assert.equal(afterWinnerCommit.request.status, "approved");
          assert.equal(afterWinnerCommit.activations.length, 1);
          assert.equal(afterWinnerCommit.onboardingAssignments.length, 1);
          assert.equal(afterWinnerCommit.onboardingTasks.length, 1);
          assert.deepEqual(afterWinnerCommit.sourceTask, before.sourceTask, "approval must not mutate the pre-existing task");
          assert.deepEqual(afterWinnerCommit.sourceAssignment, before.sourceAssignment, "approval must not mutate the pre-existing assignment");
          assert.deepEqual(afterWinnerCommit.responsibility, before.responsibility, "approval must leave the pre-existing responsibility footprint unchanged");
          assert.equal(afterWinnerCommit.commandReceipts.length, 1);
          assert.equal(afterWinnerCommit.responsibilityReceipts.length, 0);
          const loserCommit = await second.query("commit;");
          assert.equal(loserCommit.code, "00000", JSON.stringify(loserCommit));
          const afterLoserCommit = await snapshot();
          assert.equal(afterLoserCommit.sourceTask.state_revision, 1);
          assert.equal(afterLoserCommit.responsibility.set.revision, 2);
          assert.equal(afterLoserCommit.responsibilityReceipts.length, 1);
          const replaySession = new Session(); auxiliarySessions.push(replaySession);
          await replaySession.ok("\\set VERBOSITY verbose\nset statement_timeout='15s';");
          await replaySession.ok(`select set_config('request.jwt.claim.sub',${lit(secondActor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: secondActor, aal: "aal2" }))},false);set role authenticated;begin isolation level ${iso};`);
          const replayResult = await replaySession.query(secondSql);
          assert.equal(replayResult.code, "00000", JSON.stringify(replayResult));
          assert.equal(replayResult.lines.at(-1), loserResult.lines.at(-1), "exact responsibility replay must return the stored result");
          await replaySession.ok("commit;"); await replaySession.ok("reset role;"); await replaySession.close(); auxiliarySessions.splice(auxiliarySessions.indexOf(replaySession), 1);
          const afterReplay = await snapshot();
          assert.deepEqual(afterReplay, afterLoserCommit, "exact replay must not duplicate tasks, receipts, responsibility, or audit rows");
          await a.ok("reset role;"); await b.ok("reset role;");
          assert.equal(afterReplay.activations.length, 1);
           assert.equal(afterReplay.activations[0].line_id, lineId);
          assert.equal(afterReplay.onboardingAssignments.length, 1);
          assert.equal(afterReplay.onboardingTasks.length, 1);
           assert.equal(afterReplay.responsibility.set.revision, 2);
           assert.equal(afterReplay.responsibility.set.mode, "conjunta");
           assert.deepEqual(afterReplay.responsibility.members.map(m => [m.profile_id, Number(m.share_bps)]).sort(), members.map(m => [m.profileId, m.shareBps]).sort());
          assert.equal(afterReplay.commandReceipts.length, 1);
          assert.equal(afterReplay.responsibilityReceipts.length, 1);
          assert.equal(afterReplay.audit.filter(e => e.action === "onboarding.approved").length, 1);
          assert.equal(afterReplay.audit.filter(e => e.action === "task.responsibility_assigned").length, 1);
          const winnerResponse = JSON.parse(firstResult.lines.at(-1));
          const loserResponse = JSON.parse(loserResult.lines.at(-1));
          record(`M2.2C responsibility/onboarding approval same-isolation ${order} (${iso}/${iso})`, true, {
            isolationPair: `${iso}/${iso}`, order, actors: { responsibilityChief, approvalChief }, backendPids: { winner: firstPid, loser: loserPid }, blocked, blockerPids,
            before, winner: { sqlstate: firstResult.code, response: winnerResponse }, loser: { sqlstate: loserResult.code, response: loserResponse, commitSQLSTATE: loserCommit.code },
            intermediate: afterWinnerCommit, replay: { connection: "new PostgreSQL session", sqlstate: replayResult.code, response: JSON.parse(replayResult.lines.at(-1)) }, after: afterReplay,
            footprint: { activations: afterReplay.activations.length, onboardingAssignments: afterReplay.onboardingAssignments.length, onboardingTasks: afterReplay.onboardingTasks.length,
              jointResponsibilityRevision: afterReplay.responsibility.set.revision, responsibilityReceipts: afterReplay.responsibilityReceipts.length, approvalReceipts: afterReplay.commandReceipts.length }
          });
          continue;
        }
        if (loserResult.code !== "40001") {
          const loserCommit = await second.query(loserResult.code === "00000" ? "commit;" : "rollback;");
          const unexpectedFinal = await snapshot();
          const diagnostic = {
            scenario: `M2.2C responsibility/onboarding approval same-isolation ${order} (${iso}/${iso})`,
            ids: { owner, request, lineId, assignment, taskId, responsibilityChief, approvalChief, responsibilityOp, approvalOp },
            isolation: iso, order, backendPids: { winner: firstPid, loser: loserPid }, blockerPids, blocked,
            before, winner: { sqlstate: firstResult.code, response: firstResult.lines.at(-1) },
            loser: { sqlstate: loserResult.code, error: loserResult.errors, response: loserResult.lines.at(-1) },
            afterWinnerCommitBeforeLoserCommit: afterWinnerCommit,
            loserCommitSQLSTATE: loserCommit.code, final: unexpectedFinal,
            postgresLog: join(out, "postgres.log"),
          };
          writeFileSync(join(out, "responsibility-onboarding-approval-race-diagnostic.json"), JSON.stringify(diagnostic, null, 2));
          record(`M2.2C unexpected loser outcome: responsibility/onboarding approval (${order}, ${iso}/${iso})`, false, diagnostic);
          throw Error(`Unexpected loser SQLSTATE ${loserResult.code} for ${order}/${iso}; diagnostic saved to ${join(out, "responsibility-onboarding-approval-race-diagnostic.json")}`);
        }
        await second.ok("rollback;");
        const intermediate = await snapshot();
        if (order === "responsibility-first") {
          assert.equal(intermediate.request.status, "submitted");
          assert.equal(intermediate.responsibility.set.revision, 2);
          assert.equal(intermediate.responsibility.set.mode, "conjunta");
          assert.equal(intermediate.activations.length, 0);
          assert.equal(intermediate.commandReceipts.length, 0);
          assert.equal(intermediate.responsibilityReceipts.length, 1);
        } else {
          assert.equal(intermediate.request.status, "approved");
          assert.equal(intermediate.responsibility.set.revision, 1);
          assert.equal(intermediate.activations.length, 1);
          assert.equal(intermediate.commandReceipts.length, 1);
          assert.equal(intermediate.responsibilityReceipts.length, 0);
        }
        const retrySession = new Session(); auxiliarySessions.push(retrySession);
        await retrySession.ok("\\set VERBOSITY verbose\nset statement_timeout='15s';");
        await retrySession.ok(`select set_config('request.jwt.claim.sub',${lit(secondActor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: secondActor, aal: "aal2" }))},false);set role authenticated;begin isolation level ${iso};`);
        const retryResult = await retrySession.query(secondSql);
        assert.equal(retryResult.code, "00000", JSON.stringify(retryResult));
        await retrySession.ok("commit;"); await retrySession.ok("reset role;"); await retrySession.close(); auxiliarySessions.splice(auxiliarySessions.indexOf(retrySession), 1);
        await a.ok("reset role;"); await b.ok("reset role;");
        const after = await snapshot();
        assert.equal(after.request.status, "approved");
        assert.equal(after.activations.length, 1);
        assert.equal(after.activations[0].line_id, lineId);
        assert.equal(after.onboardingAssignments.length, 1);
        assert.equal(after.onboardingTasks.length, 1, JSON.stringify(after.onboardingTasks));
        assert.equal(after.responsibility.set.revision, 2);
        assert.equal(after.responsibility.set.mode, "conjunta");
        assert.deepEqual(after.responsibility.members.map(m => [m.profile_id, Number(m.share_bps)]).sort(), [[owner, 5000], [actor, 5000]].sort());
        assert.equal(after.commandReceipts.length, 1);
        assert.equal(after.responsibilityReceipts.length, 1);
        assert.equal(after.audit.filter(e => e.action === "onboarding.approved").length, 1);
        assert.equal(after.audit.filter(e => e.action === "task.responsibility_assigned").length, 1);
        const winnerResponse = JSON.parse(firstResult.lines.at(-1));
        const retryResponse = JSON.parse(retryResult.lines.at(-1));
        record(`M2.2C responsibility/onboarding approval same-isolation ${order} (${iso}/${iso})`, true, {
          isolationPair: `${iso}/${iso}`, order, actors: { responsibilityChief, approvalChief }, backendPids: { winner: firstPid, loser: loserPid }, blocked, blockerPids,
          before, winner: { sqlstate: firstResult.code, response: winnerResponse }, staleLoser: { sqlstate: loserResult.code, error: loserResult.errors }, intermediate,
          retry: { connection: "new PostgreSQL session", sqlstate: retryResult.code, response: retryResponse }, after,
          footprint: { activations: after.activations.length, onboardingAssignments: after.onboardingAssignments.length, onboardingTasks: after.onboardingTasks.length,
            jointResponsibilityRevision: after.responsibility.set.revision, responsibilityReceipts: after.responsibilityReceipts.length, approvalReceipts: after.commandReceipts.length }
        });
      }
      {
        const responsibilityOwner = uid(880), responsibilityAssignment = uid(881), responsibilityTask = uid(882), responsibilityLine = uid(883), responsibilitySaveOp = uid(884), responsibilitySubmitOp = uid(885), responsibilityApproveOp = uid(886), responsibilityMutationOp = uid(887);
        await observer.ok(`insert into auth.users(id) values(${lit(responsibilityOwner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(responsibilityOwner)},${lit(org)},'Synthetic responsibility C owner','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(responsibilityOwner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(responsibilityOwner)});
          insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days)
            values(${lit(responsibilityAssignment)},${lit(org)},${lit(company)},${lit(responsibilityOwner)},${lit(team)},'M2.2C responsibility footprint','resultado',1,null,null,'unica',date_trunc('month',${lit(scheduledOn)}::date)::date,extract(day from ${lit(scheduledOn)}::date)::integer,'[]',${lit(scheduledOn)},${lit(scheduledOn)},1,array[1]::smallint[],extract(day from ${lit(scheduledOn)}::date)::smallint,true,0);
          insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
            values(${lit(responsibilityTask)},${lit(org)},${lit(responsibilityAssignment)},${lit(company)},${lit(responsibilityOwner)},${lit(team)},date_trunc('month',${lit(scheduledOn)}::date)::date,${lit(scheduledOn)},'M2.2C responsibility footprint','resultado',1,${lit(scheduledOn)},null,null,'[]','Pendiente');`);
        const responsibilityDraft = { ...requestDraft, lines: [{ lineId: responsibilityLine, companyId: company, teamId: team, source: { type: "custom", definition: { kind: "operativa", title: "M2.2C responsibility approve footprint", objective: "", sector: "Test", unit: "documentos" } }, schedule: { ...requestDraft.lines[0].schedule, frequency: "unica", startDate: scheduledOn, endDate: scheduledOn } }] };
        await claims({ role: "authenticated", sub: responsibilityOwner, aal: "aal1" }, responsibilityOwner);
        const responsibilitySaved = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: responsibilitySaveOp, kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${responsibilityOwner}`]: "0" }, payload: { requestId: null, draft: responsibilityDraft } }).replaceAll("'", "''")}'::jsonb);`); assert.equal(responsibilitySaved.code, "00000", JSON.stringify(responsibilitySaved));
        const responsibilityRequest = JSON.parse(responsibilitySaved.lines.at(-1)).result.requestId;
        const responsibilitySubmitted = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: responsibilitySubmitOp, kind: "onboarding.submit", expectedRevisions: { [`onboarding:${responsibilityRequest}`]: "0", [`onboardingDraft:${responsibilityRequest}`]: "1" }, payload: { requestId: responsibilityRequest } }).replaceAll("'", "''")}'::jsonb);`); assert.equal(responsibilitySubmitted.code, "00000", JSON.stringify(responsibilitySubmitted)); await a.ok("reset role;");
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        await a.ok("begin isolation level read committed;");
        const responsibilityPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
        const responsibilityMembers = [{ profileId: responsibilityOwner, shareBps: 5000 }, { profileId: actor, shareBps: 5000 }];
        const responsibilityPending = a.query(`select public.assign_task_responsibility(${lit(responsibilityTask)},'${JSON.stringify(responsibilityMembers)}'::jsonb,'C approval footprint race',1,${lit(responsibilityMutationOp)});`);
        const responsibilityResult = await responsibilityPending; assert.equal(responsibilityResult.code, "00000", JSON.stringify(responsibilityResult));
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select count(*) from public.task_instances where id=${lit(responsibilityTask)};`);
        const responsibilityApprovePid = Number((await b.ok("select pg_backend_pid();")).at(-1));
        const responsibilityApprove = { contractVersion: 1, operationId: responsibilityApproveOp, kind: "onboarding.approve", expectedRevisions: { [`onboarding:${responsibilityRequest}`]: "1" }, payload: { requestId: responsibilityRequest, weightOverrides: [], period: monthPeriod } };
        const responsibilityApprovePending = b.query(`select api.command_v1('${JSON.stringify(responsibilityApprove).replaceAll("'", "''")}'::jsonb);`);
        let responsibilityBlocked = false; const responsibilityDeadline = Date.now() + 10000; while (Date.now() < responsibilityDeadline) { if ((await observer.ok(`select ${responsibilityPid}=any(pg_catalog.pg_blocking_pids(${responsibilityApprovePid}));`)).at(-1) === "t") { responsibilityBlocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
        await a.ok("commit;"); const responsibilityStale = await responsibilityApprovePending; await b.ok(responsibilityStale.code === "00000" ? "commit;" : "rollback;"); assert.equal(responsibilityBlocked, true); assert.equal(responsibilityStale.code, "40001", JSON.stringify(responsibilityStale));
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
        const responsibilityRetry = await b.query(`select api.command_v1('${JSON.stringify(responsibilityApprove).replaceAll("'", "''")}'::jsonb);`); assert.equal(responsibilityRetry.code, "00000", JSON.stringify(responsibilityRetry)); await b.ok("reset role;");
        const responsibilityState = (await observer.ok(`select (select status from public.onboarding_requests where id=${lit(responsibilityRequest)})||'|'||(select rs.revision from public.task_responsibility_heads h join public.task_responsibility_sets rs on rs.id=h.set_id where h.instance_id=${lit(responsibilityTask)})||'|'||(select count(*) from public.onboarding_activations where request_id=${lit(responsibilityRequest)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(responsibilityApproveOp)});`)).at(-1); assert.equal(responsibilityState, "approved|2|1|1", responsibilityState);
        record("M2.2C responsibility revision fences RR onboarding approval footprint and stale retry succeeds", true, { blocked: responsibilityBlocked, responsibilitySQLSTATE: responsibilityResult.code, staleApprovalSQLSTATE: responsibilityStale.code, retrySQLSTATE: responsibilityRetry.code, state: responsibilityState });
      }
      {
        const coverageOwner = uid(890), coverageAssignment = uid(891), coverageTask = uid(892), coveragePlan = uid(893), coverageLine = uid(894), coverageSaveOp = uid(895), coverageSubmitOp = uid(896), coverageApproveOp = uid(897), coverageCancelOp = uid(898);
        await observer.ok(`insert into auth.users(id) values(${lit(coverageOwner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(coverageOwner)},${lit(org)},'Synthetic coverage C owner','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(coverageOwner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(coverageOwner)});
          insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days)
            values(${lit(coverageAssignment)},${lit(org)},${lit(company)},${lit(coverageOwner)},${lit(team)},'M2.2C coverage footprint','resultado',1,null,null,'unica',date_trunc('month',${lit(scheduledOn)}::date)::date,extract(day from ${lit(scheduledOn)}::date)::integer,'[]',${lit(scheduledOn)},${lit(scheduledOn)},1,array[1]::smallint[],extract(day from ${lit(scheduledOn)}::date)::smallint,true,0);
          insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
            values(${lit(coverageTask)},${lit(org)},${lit(coverageAssignment)},${lit(company)},${lit(coverageOwner)},${lit(team)},date_trunc('month',${lit(scheduledOn)}::date)::date,${lit(scheduledOn)},'M2.2C coverage footprint','resultado',1,${lit(scheduledOn)},null,null,'[]','Pendiente');
          insert into public.task_coverage_plans(id,organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by,sealed)
            values(${lit(coveragePlan)},${lit(org)},${lit(coverageOwner)},${lit(actor)},${lit(scheduledOn)},${lit(scheduledOn)},'otra',${lit(boss)},false);
          insert into public.task_coverage_plan_instances(plan_id,organization_id,instance_id,company_id_snapshot,period_snapshot,responsibility_set_id)
            select ${lit(coveragePlan)},${lit(org)},${lit(coverageTask)},${lit(company)},date_trunc('month',${lit(scheduledOn)}::date)::date,h.set_id from public.task_responsibility_heads h where h.instance_id=${lit(coverageTask)};
          update public.task_coverage_plans set sealed=true,sealed_by=${lit(boss)},sealed_at=clock_timestamp() where id=${lit(coveragePlan)};`);
        const coverageDraft = { ...requestDraft, lines: [{ lineId: coverageLine, companyId: company, teamId: team, source: { type: "custom", definition: { kind: "operativa", title: "M2.2C coverage approve footprint", objective: "", sector: "Test", unit: "documentos" } }, schedule: { ...requestDraft.lines[0].schedule, frequency: "unica", startDate: scheduledOn, endDate: scheduledOn } }] };
        await claims({ role: "authenticated", sub: coverageOwner, aal: "aal1" }, coverageOwner);
        const coverageSaved = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: coverageSaveOp, kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${coverageOwner}`]: "0" }, payload: { requestId: null, draft: coverageDraft } }).replaceAll("'", "''")}'::jsonb);`); assert.equal(coverageSaved.code, "00000", JSON.stringify(coverageSaved));
        const coverageRequest = JSON.parse(coverageSaved.lines.at(-1)).result.requestId;
        const coverageSubmitted = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: coverageSubmitOp, kind: "onboarding.submit", expectedRevisions: { [`onboarding:${coverageRequest}`]: "0", [`onboardingDraft:${coverageRequest}`]: "1" }, payload: { requestId: coverageRequest } }).replaceAll("'", "''")}'::jsonb);`); assert.equal(coverageSubmitted.code, "00000", JSON.stringify(coverageSubmitted)); await a.ok("reset role;");
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        const coverageEnabled = await a.query(`select public.approve_task_coverage_plan(${lit(coveragePlan)},${lit(uid(899))});`); assert.equal(coverageEnabled.code, "00000", JSON.stringify(coverageEnabled)); await a.ok("reset role;");
        const coverageBinding = (await observer.ok(`select id from public.task_coverage_bindings where instance_id=${lit(coverageTask)} and status='active';`)).at(-1);
        await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select count(*) from public.task_instances where id=${lit(coverageTask)};`);
        const cancelPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
        const cancelPending = a.query(`select public.cancel_task_coverage_binding(${lit(coverageBinding)},'C approval coverage footprint race',${lit(coverageCancelOp)});`);
        const cancelResult = await cancelPending; assert.equal(cancelResult.code, "00000", JSON.stringify(cancelResult));
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level read committed;select count(*) from public.task_instances where id=${lit(coverageTask)};`);
        const coverageApprovePid = Number((await b.ok("select pg_backend_pid();")).at(-1));
        const coverageApprove = { contractVersion: 1, operationId: coverageApproveOp, kind: "onboarding.approve", expectedRevisions: { [`onboarding:${coverageRequest}`]: "1" }, payload: { requestId: coverageRequest, weightOverrides: [], period: monthPeriod } };
        const coverageApprovePending = b.query(`select api.command_v1('${JSON.stringify(coverageApprove).replaceAll("'", "''")}'::jsonb);`);
        let coverageBlocked = false; const coverageDeadline = Date.now() + 10000; while (Date.now() < coverageDeadline) { if ((await observer.ok(`select ${cancelPid}=any(pg_catalog.pg_blocking_pids(${coverageApprovePid}));`)).at(-1) === "t") { coverageBlocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
        await a.ok("commit;"); const coverageStale = await coverageApprovePending; await b.ok(coverageStale.code === "00000" ? "commit;" : "rollback;"); assert.equal(coverageBlocked, true); assert.equal(coverageStale.code, "40001", JSON.stringify(coverageStale));
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
        const coverageRetry = await b.query(`select api.command_v1('${JSON.stringify(coverageApprove).replaceAll("'", "''")}'::jsonb);`); assert.equal(coverageRetry.code, "00000", JSON.stringify(coverageRetry)); await b.ok("reset role;");
        const coverageState = (await observer.ok(`select (select status from public.task_coverage_bindings where id=${lit(coverageBinding)})||'|'||(select status from public.onboarding_requests where id=${lit(coverageRequest)})||'|'||(select count(*) from public.onboarding_activations where request_id=${lit(coverageRequest)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(coverageApproveOp)});`)).at(-1); assert.equal(coverageState, "cancelled|approved|1|1", coverageState);
        record("M2.2C coverage cancellation fences mixed RR/RC onboarding approval footprint and stale retry succeeds", true, { isolationPair: "repeatable read/read committed", blocked: coverageBlocked, cancellationSQLSTATE: cancelResult.code, staleApprovalSQLSTATE: coverageStale.code, retrySQLSTATE: coverageRetry.code, state: coverageState });
      }
      {
        const owner = uid(940), assignment = uid(941), taskId = uid(942), request = await makeRequest(owner, uid(943), 944), approveOp = uid(946), mutationOp = uid(947);
        await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days) values(${lit(assignment)},${lit(org)},${lit(company)},${lit(owner)},${lit(team)},'M2.2C approval-first responsibility','resultado',1,null,null,'unica',date_trunc('month',${lit(scheduledOn)}::date)::date,extract(day from ${lit(scheduledOn)}::date)::integer,'[]',${lit(scheduledOn)},${lit(scheduledOn)},1,array[1]::smallint[],extract(day from ${lit(scheduledOn)}::date)::smallint,true,0);insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status) values(${lit(taskId)},${lit(org)},${lit(assignment)},${lit(company)},${lit(owner)},${lit(team)},date_trunc('month',${lit(scheduledOn)}::date)::date,${lit(scheduledOn)},'M2.2C approval-first responsibility','resultado',1,${lit(scheduledOn)},null,null,'[]','Pendiente');`);
        const approve = { contractVersion: 1, operationId: approveOp, kind: "onboarding.approve", expectedRevisions: { [`onboarding:${request}`]: "1", [`catalogue:${JSON.parse(standardCall.lines.at(-1)).result.templateId}`]: "1" }, payload: { requestId: request, weightOverrides: [], period: monthPeriod } };
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss); await a.ok("begin isolation level read committed;");
        const approvePid = Number((await a.ok("select pg_backend_pid();")).at(-1)); const approvePending = a.query(`select api.command_v1('${JSON.stringify(approve).replaceAll("'", "''")}'::jsonb);`); const approveResult = await approvePending; assert.equal(approveResult.code, "00000", JSON.stringify(approveResult));
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select count(*) from public.task_instances where id=${lit(taskId)};`);
        const mutationPid = Number((await b.ok("select pg_backend_pid();")).at(-1)); const members = [{ profileId: owner, shareBps: 5000 }, { profileId: actor, shareBps: 5000 }];
        const mutationPending = b.query(`select public.assign_task_responsibility(${lit(taskId)},'${JSON.stringify(members)}'::jsonb,'C approval-first responsibility race',1,${lit(mutationOp)});`);
        let blocked = false; const deadline = Date.now() + 10000; while (Date.now() < deadline) { if ((await observer.ok(`select ${approvePid}=any(pg_catalog.pg_blocking_pids(${mutationPid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
         await a.ok("commit;"); const mutationResult = await mutationPending; await b.ok(mutationResult.code === "00000" ? "commit;" : "rollback;"); assert.equal(blocked, true); assert.equal(mutationResult.code, "40001", JSON.stringify(mutationResult));
         const retry = await b.query(`select public.assign_task_responsibility(${lit(taskId)},'${JSON.stringify(members)}'::jsonb,'C approval-first responsibility race',1,${lit(mutationOp)});`); assert.equal(retry.code, "00000", JSON.stringify(retry)); await a.ok("reset role;"); await b.ok("reset role;");
        const state = (await observer.ok(`select (select status from public.onboarding_requests where id=${lit(request)})||'|'||(select revision from public.task_responsibility_heads h join public.task_responsibility_sets s on s.id=h.set_id where h.instance_id=${lit(taskId)})||'|'||(select count(*) from public.onboarding_activations where request_id=${lit(request)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(approveOp)});`)).at(-1); assert.equal(state, "approved|2|1|1", state);
         record("M2.2C approval-first responsibility waits, stale RR aborts, then retry applies", true, { isolationPair: "read committed/repeatable read", blocked, approvalSQLSTATE: approveResult.code, mutationSQLSTATE: mutationResult.code, retrySQLSTATE: retry.code, state });
      }
      {
        const owner = uid(950), assignment = uid(951), taskId = uid(952), plan = uid(953), request = await makeRequest(owner, uid(954), 955), approveOp = uid(957), cancelOp = uid(958);
        await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days) values(${lit(assignment)},${lit(org)},${lit(company)},${lit(owner)},${lit(team)},'M2.2C approval-first coverage','resultado',1,null,null,'unica',date_trunc('month',${lit(scheduledOn)}::date)::date,extract(day from ${lit(scheduledOn)}::date)::integer,'[]',${lit(scheduledOn)},${lit(scheduledOn)},1,array[1]::smallint[],extract(day from ${lit(scheduledOn)}::date)::smallint,true,0);insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status) values(${lit(taskId)},${lit(org)},${lit(assignment)},${lit(company)},${lit(owner)},${lit(team)},date_trunc('month',${lit(scheduledOn)}::date)::date,${lit(scheduledOn)},'M2.2C approval-first coverage','resultado',1,${lit(scheduledOn)},null,null,'[]','Pendiente');insert into public.task_coverage_plans(id,organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by,sealed,sealed_by,sealed_at) values(${lit(plan)},${lit(org)},${lit(owner)},${lit(actor)},${lit(scheduledOn)},${lit(scheduledOn)},'otra',${lit(boss)},false,null,null);insert into public.task_coverage_plan_instances(plan_id,organization_id,instance_id,company_id_snapshot,period_snapshot,responsibility_set_id) select ${lit(plan)},${lit(org)},${lit(taskId)},${lit(company)},date_trunc('month',${lit(scheduledOn)}::date)::date,h.set_id from public.task_responsibility_heads h where h.instance_id=${lit(taskId)};update public.task_coverage_plans set sealed=true,sealed_by=${lit(boss)},sealed_at=clock_timestamp() where id=${lit(plan)};`);
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss); const coverageApproval = await a.query(`select public.approve_task_coverage_plan(${lit(plan)},${lit(uid(959))});`); assert.equal(coverageApproval.code, "00000", JSON.stringify(coverageApproval)); await a.ok("reset role;");
        const binding = (await observer.ok(`select id from public.task_coverage_bindings where instance_id=${lit(taskId)} and status='active';`)).at(-1); const approve = { contractVersion: 1, operationId: approveOp, kind: "onboarding.approve", expectedRevisions: { [`onboarding:${request}`]: "1", [`catalogue:${JSON.parse(standardCall.lines.at(-1)).result.templateId}`]: "1" }, payload: { requestId: request, weightOverrides: [], period: monthPeriod } };
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss); await a.ok("begin isolation level read committed;"); const approvePid = Number((await a.ok("select pg_backend_pid();")).at(-1)); const approvePending = a.query(`select api.command_v1('${JSON.stringify(approve).replaceAll("'", "''")}'::jsonb);`); const approveResult = await approvePending; assert.equal(approveResult.code, "00000", JSON.stringify(approveResult));
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select count(*) from public.task_instances where id=${lit(taskId)};`);
        const cancelPid = Number((await b.ok("select pg_backend_pid();")).at(-1)); const cancelPending = b.query(`select public.cancel_task_coverage_binding(${lit(binding)},'C approval-first coverage race',${lit(cancelOp)});`);
        let blocked = false; const deadline = Date.now() + 10000; while (Date.now() < deadline) { if ((await observer.ok(`select ${approvePid}=any(pg_catalog.pg_blocking_pids(${cancelPid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
         await a.ok("commit;"); const stale = await cancelPending; await b.ok(stale.code === "00000" ? "commit;" : "rollback;"); assert.equal(blocked, true); assert.equal(stale.code, "40001", JSON.stringify(stale));
         const retry = await b.query(`select public.cancel_task_coverage_binding(${lit(binding)},'C approval-first coverage race',${lit(cancelOp)});`); assert.equal(retry.code, "00000", JSON.stringify(retry)); await a.ok("reset role;"); await b.ok("reset role;");
        const state = (await observer.ok(`select (select status from public.task_coverage_bindings where id=${lit(binding)})||'|'||(select status from public.onboarding_requests where id=${lit(request)})||'|'||(select count(*) from public.onboarding_activations where request_id=${lit(request)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(approveOp)});`)).at(-1); assert.equal(state, "cancelled|approved|1|1", state);
         record("M2.2C approval-first coverage cancellation waits, stale RR aborts, then retry applies", true, { isolationPair: "read committed/repeatable read", blocked, approvalSQLSTATE: approveResult.code, cancellationSQLSTATE: stale.code, retrySQLSTATE: retry.code, state });
      }
      for (let i = 0; i < 4; i++) {
        const race = i % 2, iso = i < 2 ? "read committed" : "repeatable read";
        const owner = uid(610 + i * 10), lineId = uid(611 + i * 10), saveOp = uid(612 + i * 10), submitOp = uid(613 + i * 10), approveOp = uid(614 + i * 10), changesOp = uid(615 + i * 10);
        await observer.ok(`insert into auth.users(id) values(${lit(owner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(owner)},${lit(org)},${lit(`Synthetic submit review race ${i}`)},'empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(owner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(owner)});`);
        const draft = { ...requestDraft, lines: [{ ...requestDraft.lines[0], lineId }] };
        await claims({ role: "authenticated", sub: owner, aal: "aal1" }, owner);
        const save = { contractVersion: 1, operationId: saveOp, kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${owner}`]: "0" }, payload: { requestId: null, draft } };
        const savedRace = await a.query(`select api.command_v1('${JSON.stringify(save).replaceAll("'", "''")}'::jsonb);`); assert.equal(savedRace.code, "00000", JSON.stringify(savedRace)); const request = JSON.parse(savedRace.lines.at(-1)).result.requestId;
        const submit = { contractVersion: 1, operationId: submitOp, kind: "onboarding.submit", expectedRevisions: { [`onboarding:${request}`]: "0", [`onboardingDraft:${request}`]: "1" }, payload: { requestId: request } };
        const submittedRace = await a.query(`select api.command_v1('${JSON.stringify(submit).replaceAll("'", "''")}'::jsonb);`); assert.equal(submittedRace.code, "00000", JSON.stringify(submittedRace)); await a.ok("reset role;");
        const approve = { contractVersion: 1, operationId: approveOp, kind: "onboarding.approve", expectedRevisions: { [`onboarding:${request}`]: "1", [`catalogue:${JSON.parse(standardCall.lines.at(-1)).result.templateId}`]: "1" }, payload: { requestId: request, weightOverrides: [], period: monthPeriod } };
        const changes = { contractVersion: 1, operationId: changesOp, kind: "onboarding.requestChanges", expectedRevisions: { [`onboarding:${request}`]: "1" }, payload: { requestId: request, reason: "Please correct this synthetic request" } };
        const approveFirst = race === 0, firstArgs = approveFirst ? approve : changes, secondArgs = approveFirst ? changes : approve;
        await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${iso};`);
        const firstPid = Number((await a.ok("select pg_backend_pid();")).at(-1)); const firstResult = await a.query(`select api.command_v1('${JSON.stringify(firstArgs).replaceAll("'", "''")}'::jsonb);`); assert.equal(firstResult.code, "00000", JSON.stringify(firstResult));
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${iso};select count(*) from public.onboarding_requests;`);
        const secondPid = Number((await b.ok("select pg_backend_pid();")).at(-1)); const pending = b.query(`select api.command_v1('${JSON.stringify(secondArgs).replaceAll("'", "''")}'::jsonb);`);
        let blocked = false; const deadline = Date.now() + 10000; while (Date.now() < deadline) { if ((await observer.ok(`select ${firstPid}=any(pg_catalog.pg_blocking_pids(${secondPid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
         await a.ok("commit;"); const stale = await pending; await b.ok(stale.code === "00000" ? "commit;" : "rollback;"); assert.equal(blocked, true); assert.equal(stale.code, "40001", JSON.stringify(stale));
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
        const retry = await b.query(`select api.command_v1('${JSON.stringify(secondArgs).replaceAll("'", "''")}'::jsonb);`); assert.equal(retry.code, "40001", JSON.stringify(retry)); await b.ok("reset role;"); await a.ok("reset role;");
        const state = (await observer.ok(`select status||'|'||(select count(*) from public.onboarding_activations where request_id=${lit(request)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id in (${lit(approveOp)},${lit(changesOp)})) from public.onboarding_requests where id=${lit(request)};`)).at(-1);
        assert.equal(state, approveFirst ? "approved|1|1" : "changes_requested|0|1", state);
        record(`M2.2C submit/requestChanges/approve race ${approveFirst ? "approve-first" : "changes-first"} (${iso}/${iso})`, true, { isolationPair: `${iso}/${iso}`, blocked, winner: firstArgs.kind, winnerSQLSTATE: firstResult.code, staleSQLSTATE: stale.code, retrySQLSTATE: retry.code, finalStatusActivationsReceipts: state });
      }
      for (let i = 0; i < 4; i++) {
        const race = i % 2, owner = uid(370 + i), lineId = uid(372 + i), iso = i < 2 ? "read committed" : "repeatable read";
        await observer.ok(`insert into auth.users(id) values(${lit(owner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(owner)},${lit(org)},${lit(`Synthetic draft race ${i}`)},'empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(owner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(owner)});`);
        const draft = { schemaVersion: 2, lines: [{ lineId, companyId: company, teamId: team, source: { type: "catalogue", templateVersionId: standardVersionId }, schedule: { frequency: "mensual", startDate: scheduledOn, endDate: null, interval: 1, weekdays: [], monthDay: dayOfMonth, hasDeadline: true, dueOffsetDays: 0 } }] };
        await claims({ role: "authenticated", sub: owner, aal: "aal1" }, owner);
        const initialSave = { contractVersion: 1, operationId: uid(400 + i), kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${owner}`]: "0" }, payload: { requestId: null, draft } };
        const initialSaveResult = await a.query(`select api.command_v1('${JSON.stringify(initialSave).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(initialSaveResult.code, "00000", JSON.stringify(initialSaveResult));
        const draftRequestId = JSON.parse(initialSaveResult.lines.at(-1)).result.requestId;
        const saveRace = { contractVersion: 1, operationId: uid(402 + i), kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${owner}`]: "1", [`onboarding:${draftRequestId}`]: "0", [`onboardingDraft:${draftRequestId}`]: "1" }, payload: { requestId: draftRequestId, draft } };
        const submitRace = { contractVersion: 1, operationId: uid(404 + i), kind: "onboarding.submit", expectedRevisions: { [`onboarding:${draftRequestId}`]: "0", [`onboardingDraft:${draftRequestId}`]: "1" }, payload: { requestId: draftRequestId } };
        await a.ok("reset role;");
        const saveWinsFirst = race === 0, first = saveWinsFirst ? a : b, second = saveWinsFirst ? b : a;
        const firstArgs = saveWinsFirst ? saveRace : submitRace, secondArgs = saveWinsFirst ? submitRace : saveRace;
        await first.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(owner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: owner, aal: "aal1" }))},false);set role authenticated;begin isolation level ${iso};`);
        const firstPid = Number((await first.ok("select pg_backend_pid();")).at(-1));
        const firstResult = await first.query(`select api.command_v1('${JSON.stringify(firstArgs).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(firstResult.code, "00000", JSON.stringify(firstResult));
        await second.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(owner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: owner, aal: "aal1" }))},false);set role authenticated;begin isolation level ${iso};select count(*) from public.profiles;`);
        const secondPid = Number((await second.ok("select pg_backend_pid();")).at(-1));
        const pending = second.query(`select api.command_v1('${JSON.stringify(secondArgs).replaceAll("'", "''")}'::jsonb);`);
        let blocked = false;
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          if ((await observer.ok(`select ${firstPid}=any(pg_catalog.pg_blocking_pids(${secondPid}));`)).at(-1) === "t") { blocked = true; break; }
          await new Promise((done) => setTimeout(done, 20));
        }
        await first.ok("commit;");
        const secondResult = await pending;
        await second.ok(secondResult.code === "00000" ? "commit;" : "rollback;");
        assert.equal(blocked, true, "draft/save/submit did not share owner/request lock plan");
        assert.equal(secondResult.code, "40001", JSON.stringify(secondResult));
        let retryResult = null;
        if (saveWinsFirst) {
          const retrySubmit = { ...submitRace, expectedRevisions: { [`onboarding:${draftRequestId}`]: "0", [`onboardingDraft:${draftRequestId}`]: "2" } };
          await second.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(owner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: owner, aal: "aal1" }))},false);set role authenticated;`);
          retryResult = await second.query(`select api.command_v1('${JSON.stringify(retrySubmit).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(retryResult.code, "00000", JSON.stringify(retryResult));
        }
        await first.ok("reset role;"); await second.ok("reset role;");
        const raceState = (await observer.ok(`select status||'|'||draft_revision||'|'||(select count(*) from public.onboarding_request_versions where request_id=${lit(draftRequestId)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id in (${lit(saveRace.operationId)},${lit(submitRace.operationId)})) from public.onboarding_requests where id=${lit(draftRequestId)};`)).at(-1);
        assert.equal(raceState.startsWith("submitted|"), true, raceState);
        record(`M2.2C draft/save vs submit ${saveWinsFirst ? "save-first" : "submit-first"} (${iso}/${iso})`, true, { isolationPair: `${iso}/${iso}`, firstAction: saveWinsFirst ? "save" : "submit", blocked, firstSQLSTATE: firstResult.code, secondSQLSTATE: secondResult.code, retrySQLSTATE: retryResult?.code ?? null, finalStatusAndVersions: raceState });
      }
      for (let i = 0; i < 4; i++) {
        const race = i % 2, iso = i < 2 ? "read committed" : "repeatable read";
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        const catalogueRevision = (await observer.ok(`select coalesce((select revision from app_private.api_catalogue_heads where organization_id=${lit(org)}),0);`)).at(-1);
        const newStandard = { contractVersion: 1, operationId: uid(410 + i * 5), kind: "catalogue.create", expectedRevisions: { [`catalogue:${org}`]: catalogueRevision }, payload: { definition: { kind: "operativa", title: `M2.2C race standard ${i}`, objective: "", sector: "Test", unit: "comprobantes" }, effectiveOn: scheduledOn, reason: "Native C concurrency fixture" } };
        const createdStandard = await a.query(`select api.command_v1('${JSON.stringify(newStandard).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(createdStandard.code, "00000", JSON.stringify(createdStandard));
        const standardCreatedResult = JSON.parse(createdStandard.lines.at(-1)).result;
        const templateId = standardCreatedResult.templateId, templateV1 = standardCreatedResult.versionId;
        const currentCreationRevision = (await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)}),0);`)).at(-1);
        const revise = { contractVersion: 1, operationId: uid(411 + i * 5), kind: "catalogue.revise", expectedRevisions: { [`catalogue:${org}`]: String(Number(catalogueRevision) + 1), [`catalogue:${templateId}`]: "1" }, payload: { templateId, definition: { kind: "operativa", title: `M2.2C race standard ${i}`, objective: "", sector: "Test", unit: "documentos" }, effectiveOn: scheduledOn, reason: "Update unit in native race" } };
        const createAssignment = { contractVersion: 1, operationId: uid(412 + i * 5), kind: "assignment.create", expectedRevisions: { [`creation:${actor}`]: currentCreationRevision, [`catalogue:${templateId}`]: "1" }, payload: { ownerId: actor, companyId: company, teamId: team, source: { type: "catalogue", templateVersionId: templateV1 }, schedule: { frequency: "mensual", startDate: scheduledOn, endDate: null, interval: 1, weekdays: [], monthDay: dayOfMonth, hasDeadline: true, dueOffsetDays: 0 } } };
        const reviseFirst = race === 0, first = reviseFirst ? a : b, second = reviseFirst ? b : a;
        const firstArgs = reviseFirst ? revise : createAssignment, secondArgs = reviseFirst ? createAssignment : revise;
        await first.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${iso};`);
        const firstPid = Number((await first.ok("select pg_backend_pid();")).at(-1));
        const firstResult = await first.query(`select api.command_v1('${JSON.stringify(firstArgs).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(firstResult.code, "00000", JSON.stringify(firstResult));
        await second.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${iso};select count(*) from public.task_templates;`);
        const secondPid = Number((await second.ok("select pg_backend_pid();")).at(-1));
        const pending = second.query(`select api.command_v1('${JSON.stringify(secondArgs).replaceAll("'", "''")}'::jsonb);`);
        let blocked = false;
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          if ((await observer.ok(`select ${firstPid}=any(pg_catalog.pg_blocking_pids(${secondPid}));`)).at(-1) === "t") { blocked = true; break; }
          await new Promise((done) => setTimeout(done, 20));
        }
        await first.ok("commit;");
        const secondResult = await pending;
        await second.ok(secondResult.code === "00000" ? "commit;" : "rollback;");
        assert.equal(blocked, true, "catalogue/assignment plan did not block on template fence");
        let retryResult = null;
        if (reviseFirst) {
          assert.equal(secondResult.code, "40001", JSON.stringify(secondResult));
          const newVersion = await observer.ok(`select id from public.task_template_versions where template_id=${lit(templateId)} order by version desc limit 1;`);
          const ownerRevision = (await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)}),0);`)).at(-1);
          const retryAssignment = { ...createAssignment, expectedRevisions: { [`creation:${actor}`]: ownerRevision, [`catalogue:${templateId}`]: "2" }, payload: { ...createAssignment.payload, source: { type: "catalogue", templateVersionId: newVersion.at(-1) } } };
          await second.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
          retryResult = await second.query(`select api.command_v1('${JSON.stringify(retryAssignment).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(retryResult.code, "00000", JSON.stringify(retryResult));
        } else assert.equal(secondResult.code, "00000", JSON.stringify(secondResult));
        await first.ok("reset role;"); await second.ok("reset role;");
        const versionAndAssignments = (await observer.ok(`select (select max(version) from public.task_template_versions where template_id=${lit(templateId)})||'|'||(select count(*) from public.task_assignments where owner_id=${lit(actor)} and template_id=${lit(templateId)})||'|'||(select count(*) from public.task_assignments a join public.task_template_versions v on v.id=a.template_version_id where a.owner_id=${lit(actor)} and a.template_id=${lit(templateId)} and v.version=1);`)).at(-1);
        assert.equal(versionAndAssignments, reviseFirst ? "2|1|0" : "2|1|1", versionAndAssignments);
        record(`M2.2C catalogue revision/assignment ${reviseFirst ? "revision-first" : "assignment-first"} (${iso}/${iso})`, true, { isolationPair: `${iso}/${iso}`, firstAction: reviseFirst ? "revision" : "assignment", blocked, firstSQLSTATE: firstResult.code, secondSQLSTATE: secondResult.code, retrySQLSTATE: retryResult?.code ?? null, versionsAssignments: versionAndAssignments });
      }
      {
        // Exact assignment replay is authorized first, then returns its receipt
        // even after the source catalogue revision becomes stale. A new command
        // with that stale revision must fail 40001 before current eligibility;
        // malformed structure must still retain its own 22023 response.
        const owner = uid(1090), templateOrgRev = (await observer.ok(`select coalesce((select revision from app_private.api_catalogue_heads where organization_id=${lit(org)}),0);`)).at(-1);
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        const standardCommand = { contractVersion: 1, operationId: uid(1091), kind: "catalogue.create", expectedRevisions: { [`catalogue:${org}`]: templateOrgRev }, payload: { definition: { kind: "operativa", title: "M2.2C exact assignment replay", objective: "", sector: "Test", unit: "documentos" }, effectiveOn: scheduledOn, reason: "Replay authorization ordering" } };
        const standardResponse = await a.query(`select api.command_v1('${JSON.stringify(standardCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(standardResponse.code, "00000", JSON.stringify(standardResponse)); const standard = JSON.parse(standardResponse.lines.at(-1)).result;
        await observer.ok(`insert into auth.users(id) values(${lit(owner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(owner)},${lit(org)},'Synthetic exact replay owner','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(owner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(owner)});`);
        const creationRevision = (await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(owner)}),0);`)).at(-1);
        const assignmentCommand = { contractVersion: 1, operationId: uid(1092), kind: "assignment.create", expectedRevisions: { [`creation:${owner}`]: creationRevision, [`catalogue:${standard.templateId}`]: "1" }, payload: { ownerId: owner, companyId: company, teamId: team, source: { type: "catalogue", templateVersionId: standard.versionId }, schedule: { frequency: "mensual", startDate: scheduledOn, endDate: null, interval: 1, weekdays: [], monthDay: dayOfMonth, hasDeadline: true, dueOffsetDays: 0 } } };
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        const assignmentResponse = await a.query(`select api.command_v1('${JSON.stringify(assignmentCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(assignmentResponse.code, "00000", JSON.stringify(assignmentResponse)); const originalReceipt = JSON.parse(assignmentResponse.lines.at(-1));
        const reviseRevision = (await observer.ok(`select revision from app_private.api_catalogue_heads where organization_id=${lit(org)};`)).at(-1);
        const reviseCommand = { contractVersion: 1, operationId: uid(1093), kind: "catalogue.revise", expectedRevisions: { [`catalogue:${org}`]: reviseRevision, [`catalogue:${standard.templateId}`]: "1" }, payload: { templateId: standard.templateId, definition: { kind: "operativa", title: "M2.2C exact assignment replay revised", objective: "", sector: "Test", unit: "archivos" }, effectiveOn: scheduledOn, reason: "Make prior source stale" } };
        const revisionResponse = await a.query(`select api.command_v1('${JSON.stringify(reviseCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(revisionResponse.code, "00000", JSON.stringify(revisionResponse));
        const replayResponse = await a.query(`select api.command_v1('${JSON.stringify(assignmentCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(replayResponse.code, "00000", JSON.stringify(replayResponse)); assert.deepEqual(JSON.parse(replayResponse.lines.at(-1)), originalReceipt);
        const freshCreationRevision = (await observer.ok(`select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(owner)};`)).at(-1);
        const staleCommand = { ...assignmentCommand, operationId: uid(1094), expectedRevisions: { [`creation:${owner}`]: freshCreationRevision, [`catalogue:${standard.templateId}`]: "1" } };
        const staleResponse = await a.query(`select api.command_v1('${JSON.stringify(staleCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(staleResponse.code, "40001", JSON.stringify(staleResponse));
        const invalidCommand = { ...staleCommand, operationId: uid(1095), payload: { ...staleCommand.payload, schedule: { ...staleCommand.payload.schedule, frequency: "unsupported" } } };
        const invalidResponse = await a.query(`select api.command_v1('${JSON.stringify(invalidCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(invalidResponse.code, "22023", JSON.stringify(invalidResponse));
        record("M2.2C assignment exact replay precedes stale catalogue eligibility; stale revision and malformed payload remain distinct", true, { replaySQLSTATE: replayResponse.code, staleSQLSTATE: staleResponse.code, malformedSQLSTATE: invalidResponse.code, receiptStable: JSON.stringify(JSON.parse(replayResponse.lines.at(-1))) === JSON.stringify(originalReceipt) });
      }
      {
        // R29: one-off exact replay remains ahead of catalogue eligibility,
        // while membership revocation denies replay without creating effects.
        const templateOrgRevision = (await observer.ok(`select coalesce((select revision from app_private.api_catalogue_heads where organization_id=${lit(org)}),0);`)).at(-1);
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        const createTemplate = { contractVersion: 1, operationId: uid(1100), kind: "catalogue.create", expectedRevisions: { [`catalogue:${org}`]: templateOrgRevision }, payload: { definition: { kind: "operativa", title: "M2.2C one-off replay R29", objective: "", sector: "Test", unit: "comprobantes" }, effectiveOn: scheduledOn, reason: "One-off replay R29" } };
        const templateResponse = await a.query(`select api.command_v1('${JSON.stringify(createTemplate).replaceAll("'", "''")}'::jsonb);`); assert.equal(templateResponse.code, "00000", JSON.stringify(templateResponse));
        const template = JSON.parse(templateResponse.lines.at(-1)).result;
        const ownerRevision = (await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)}),0);`)).at(-1);
        const oneOff = { contractVersion: 1, operationId: uid(1101), kind: "task.createOneOff", expectedRevisions: { [`creation:${actor}`]: ownerRevision, [`catalogue:${template.templateId}`]: "1" }, payload: { ownerId: actor, companyId: company, teamId: team, source: { type: "catalogue", templateVersionId: template.versionId }, scheduledOn, dueDate: null, priority: "Media" } };
        await claims({ role: "authenticated", sub: actor, aal: "aal1" }, actor);
        const oneOffResponse = await a.query(`select api.command_v1('${JSON.stringify(oneOff).replaceAll("'", "''")}'::jsonb);`); assert.equal(oneOffResponse.code, "00000", JSON.stringify(oneOffResponse));
        const receipt = JSON.parse(oneOffResponse.lines.at(-1));
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        const catalogueHead = (await observer.ok(`select revision from app_private.api_catalogue_heads where organization_id=${lit(org)};`)).at(-1);
        const revise = { contractVersion: 1, operationId: uid(1102), kind: "catalogue.revise", expectedRevisions: { [`catalogue:${org}`]: catalogueHead, [`catalogue:${template.templateId}`]: "1" }, payload: { templateId: template.templateId, definition: { kind: "operativa", title: "M2.2C one-off replay R29 revisada", objective: "", sector: "Test", unit: "archivos" }, effectiveOn: scheduledOn, reason: "R29 revision" } };
        const revised = await a.query(`select api.command_v1('${JSON.stringify(revise).replaceAll("'", "''")}'::jsonb);`); assert.equal(revised.code, "00000", JSON.stringify(revised));
        await claims({ role: "authenticated", sub: actor, aal: "aal1" }, actor);
        const exactReplay = await a.query(`select api.command_v1('${JSON.stringify(oneOff).replaceAll("'", "''")}'::jsonb);`); assert.equal(exactReplay.code, "00000", JSON.stringify(exactReplay)); assert.deepEqual(JSON.parse(exactReplay.lines.at(-1)), receipt);
        const freshOwnerRevision = (await observer.ok(`select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)};`)).at(-1);
        const stale = { ...oneOff, operationId: uid(1103), expectedRevisions: { [`creation:${actor}`]: freshOwnerRevision, [`catalogue:${template.templateId}`]: "1" } };
        const staleResult = await a.query(`select api.command_v1('${JSON.stringify(stale).replaceAll("'", "''")}'::jsonb);`); assert.equal(staleResult.code, "40001", JSON.stringify(staleResult));
        const malformed = { ...stale, operationId: uid(1104), payload: { ...stale.payload, scheduledOn: "not-a-date" } };
        const malformedResult = await a.query(`select api.command_v1('${JSON.stringify(malformed).replaceAll("'", "''")}'::jsonb);`); assert.equal(malformedResult.code, "22023", JSON.stringify(malformedResult));
        await observer.ok(`update public.company_memberships set active=false where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)};`);
        const beforeDeniedReplay = (await observer.ok(`select (select count(*) from app_private.api_command_receipts where actor_id=${lit(actor)} and operation_id=${lit(uid(1101))})||'|'||(select count(*) from public.task_assignments where id=${lit(receipt.result.assignmentId)})||'|'||(select count(*) from public.task_instances where id=${lit(receipt.result.taskId)})||'|'||(select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)})||'|'||(select count(*) from app_private.api_operation_fences where actor_id=${lit(actor)} and operation_id=${lit(uid(1101))})||'|'||(select count(*) from public.audit_events where actor_id=${lit(actor)} and action='task.createOneOff')||'|'||(select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(actor)})||'|'||(select count(*) from app_private.company_membership_events where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)});`)).at(-1);
        const denied = await a.query(`select api.command_v1('${JSON.stringify(oneOff).replaceAll("'", "''")}'::jsonb);`); assert.equal(denied.code, "42501", JSON.stringify(denied));
        const afterDeniedReplay = (await observer.ok(`select (select count(*) from app_private.api_command_receipts where actor_id=${lit(actor)} and operation_id=${lit(uid(1101))})||'|'||(select count(*) from public.task_assignments where id=${lit(receipt.result.assignmentId)})||'|'||(select count(*) from public.task_instances where id=${lit(receipt.result.taskId)})||'|'||(select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)})||'|'||(select count(*) from app_private.api_operation_fences where actor_id=${lit(actor)} and operation_id=${lit(uid(1101))})||'|'||(select count(*) from public.audit_events where actor_id=${lit(actor)} and action='task.createOneOff')||'|'||(select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(actor)})||'|'||(select count(*) from app_private.company_membership_events where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)});`)).at(-1);
        assert.equal(afterDeniedReplay, beforeDeniedReplay);
        await observer.ok(`update public.company_memberships set active=true where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)};`);
        {
          const beforeRace = (await observer.ok(`select (select count(*) from app_private.api_command_receipts where actor_id=${lit(actor)} and operation_id=${lit(uid(1101))})||'|'||(select count(*) from public.task_assignments where id=${lit(receipt.result.assignmentId)})||'|'||(select count(*) from public.task_instances where id=${lit(receipt.result.taskId)})||'|'||(select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)})||'|'||(select count(*) from app_private.api_operation_fences where actor_id=${lit(actor)} and operation_id=${lit(uid(1101))})||'|'||(select count(*) from public.audit_events where actor_id=${lit(actor)} and action='task.createOneOff')||'|'||(select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(actor)})||'|'||(select count(*) from app_private.company_membership_events where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)});`)).at(-1);
          await observer.ok(`reset role;begin isolation level read committed;update public.company_memberships set active=false where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)};`);
          await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level read committed;`);
          const revocationFirstPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
          const revocationBlockerPid = Number((await observer.ok("select pg_backend_pid();")).at(-1));
          const revocationFirstPending = a.query(`select api.command_v1('${JSON.stringify(oneOff).replaceAll("'", "''")}'::jsonb);`);
          let revocationFirstBlocked = false; const revocationFirstDeadline = Date.now() + 10000;
          while (Date.now() < revocationFirstDeadline) {
            if ((await b.ok(`select ${revocationBlockerPid}=any(pg_catalog.pg_blocking_pids(${revocationFirstPid}));`)).at(-1) === "t") { revocationFirstBlocked = true; break; }
            await new Promise((done) => setTimeout(done, 20));
          }
          assert.equal(revocationFirstBlocked, true, "READ COMMITTED replay was not observably blocked by committed-first revocation");
          await observer.ok("commit;");
          const revocationFirstReplay = await revocationFirstPending; assert.equal(revocationFirstReplay.code, "42501", JSON.stringify(revocationFirstReplay));
          await a.ok("rollback;");
          const afterRace = (await observer.ok(`select (select count(*) from app_private.api_command_receipts where actor_id=${lit(actor)} and operation_id=${lit(uid(1101))})||'|'||(select count(*) from public.task_assignments where id=${lit(receipt.result.assignmentId)})||'|'||(select count(*) from public.task_instances where id=${lit(receipt.result.taskId)})||'|'||(select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)})||'|'||(select count(*) from app_private.api_operation_fences where actor_id=${lit(actor)} and operation_id=${lit(uid(1101))})||'|'||(select count(*) from public.audit_events where actor_id=${lit(actor)} and action='task.createOneOff')||'|'||(select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(actor)})||'|'||(select count(*) from app_private.company_membership_events where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)});`)).at(-1);
          assert.equal(afterRace, beforeRace, "denied replay must preserve receipt, business rows, creation revision, operation and membership fences, audit, and membership events");
          record("M2.2C one-off revoke-first READ COMMITTED replay waits, then denies without side effects", true, { blocked: revocationFirstBlocked, replaySQLSTATE: revocationFirstReplay.code, beforeState: beforeRace, afterState: afterRace });
          await observer.ok(`update public.company_memberships set active=true where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)};`);

          await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level read committed;`);
          const replayFirst = await a.query(`select api.command_v1('${JSON.stringify(oneOff).replaceAll("'", "''")}'::jsonb);`); assert.equal(replayFirst.code, "00000", JSON.stringify(replayFirst)); assert.deepEqual(JSON.parse(replayFirst.lines.at(-1)), receipt);
          const replayFirstPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
          const replayFirstBaseline = (await observer.ok(`select (select count(*) from app_private.api_command_receipts where actor_id=${lit(actor)} and operation_id=${lit(uid(1101))})||'|'||(select count(*) from public.task_assignments where id=${lit(receipt.result.assignmentId)})||'|'||(select count(*) from public.task_instances where id=${lit(receipt.result.taskId)})||'|'||(select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)})||'|'||(select count(*) from app_private.api_operation_fences where actor_id=${lit(actor)} and operation_id=${lit(uid(1101))})||'|'||(select count(*) from public.audit_events where actor_id=${lit(actor)} and action='task.createOneOff')||'|'||(select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(actor)})||'|'||(select count(*) from app_private.company_membership_events where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)});`)).at(-1);
          await observer.ok(`reset role;begin isolation level read committed;`);
          const replayFirstBlockerPid = Number((await observer.ok("select pg_backend_pid();")).at(-1));
          const revokeFirstRetryPending = observer.query(`update public.company_memberships set active=false where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)};`);
          let replayFirstBlocked = false; const replayFirstDeadline = Date.now() + 10000;
          while (Date.now() < replayFirstDeadline) {
            if ((await b.ok(`select ${replayFirstPid}=any(pg_catalog.pg_blocking_pids(${replayFirstBlockerPid}));`)).at(-1) === "t") { replayFirstBlocked = true; break; }
            await new Promise((done) => setTimeout(done, 20));
          }
          assert.equal(replayFirstBlocked, true, "membership revocation was not observably blocked by replay-first transaction");
          await a.ok("commit;");
          const revocationAfterReplay = await revokeFirstRetryPending; assert.equal(revocationAfterReplay.code, "00000", JSON.stringify(revocationAfterReplay)); await observer.ok("commit;");
          const revocationRetry = await observer.query(`update public.company_memberships set active=false where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)};`); assert.equal(revocationRetry.code, "00000", JSON.stringify(revocationRetry));
          await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;`);
          const replayAfterRevocation = await a.query(`select api.command_v1('${JSON.stringify(oneOff).replaceAll("'", "''")}'::jsonb);`); assert.equal(replayAfterRevocation.code, "42501", JSON.stringify(replayAfterRevocation));
          const receiptQuery = { contractVersion: 1, kind: "commandReceipt", filters: { operationId: uid(1101) }, cursor: null, limit: 1 };
          const receiptAfterRevocation = await a.query(`select api.query_v1('${JSON.stringify(receiptQuery).replaceAll("'", "''")}'::jsonb);`); assert.equal(receiptAfterRevocation.code, "42501", JSON.stringify(receiptAfterRevocation));
          const finalRaceState = (await observer.ok(`select (select count(*) from app_private.api_command_receipts where actor_id=${lit(actor)} and operation_id=${lit(uid(1101))})||'|'||(select count(*) from public.task_assignments where id=${lit(receipt.result.assignmentId)})||'|'||(select count(*) from public.task_instances where id=${lit(receipt.result.taskId)})||'|'||(select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)})||'|'||(select count(*) from app_private.api_operation_fences where actor_id=${lit(actor)} and operation_id=${lit(uid(1101))})||'|'||(select count(*) from public.audit_events where actor_id=${lit(actor)} and action='task.createOneOff')||'|'||(select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(actor)})||'|'||(select count(*) from app_private.company_membership_events where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)});`)).at(-1);
          assert.equal(finalRaceState, replayFirstBaseline, "replay and revoked replay must preserve business state, receipts, fences, audit, and membership events");
          record("M2.2C one-off replay-first blocks concurrent revocation; revocation commits/retries and later replay denies", true, { blocked: replayFirstBlocked, replaySQLSTATE: replayFirst.code, revocationSQLSTATE: revocationAfterReplay.code, revocationRetrySQLSTATE: revocationRetry.code, laterReplaySQLSTATE: replayAfterRevocation.code, state: finalRaceState, sqlstate40P01: 0 });
          await observer.ok(`update public.company_memberships set active=true where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)};`);
        }
        {
          const query = { contractVersion: 1, kind: "commandReceipt", filters: { operationId: uid(1101) }, cursor: null, limit: 1 };
          const membershipCommand = (operationId, active, revision, reason) => ({ contractVersion: 1, operationId, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${actor}`]: String(revision) }, payload: { companyId: company, profileId: actor, active, reason } });
          const membershipFenceBeforeQueries = Number((await observer.ok(`select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(actor)};`)).at(-1));
          const membershipAccessFromBeforeQueries = (await observer.ok(`select coalesce(access_valid_from::text,'') from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)};`)).at(-1);
          await claims({ role: "authenticated", sub: actor, aal: "aal1" }, actor);
          await a.ok("begin isolation level read committed;");
          const readFirst = await a.query(`select api.query_v1('${JSON.stringify(query).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(readFirst.code, "00000", JSON.stringify(readFirst));
          assert.equal(JSON.parse(readFirst.lines.at(-1)).data.found, true);
          const queryPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level read committed;`);
          const revokePid = Number((await b.ok("select pg_backend_pid();")).at(-1));
          const revoke = membershipCommand(uid(1120), false, 0, "Receipt query race, read first");
          const revokePending = b.query(`select api.command_v1('${JSON.stringify(revoke).replaceAll("'", "''")}'::jsonb);`);
          let queryBlockedRevoker = false; const queryBlockDeadline = Date.now() + 10000;
          while (Date.now() < queryBlockDeadline) {
            if ((await observer.ok(`select ${queryPid}=any(pg_catalog.pg_blocking_pids(${revokePid}));`)).at(-1) === "t") { queryBlockedRevoker = true; break; }
            await new Promise((done) => setTimeout(done, 20));
          }
          assert.equal(queryBlockedRevoker, true, "one-off receipt query did not serialize against membership revocation");
          await a.ok("commit;");
          const revokeAfterQuery = await revokePending; assert.equal(revokeAfterQuery.code, "00000", JSON.stringify(revokeAfterQuery)); await b.ok("commit;");
          const queryAfterRevocation = await a.query(`select api.query_v1('${JSON.stringify(query).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(queryAfterRevocation.code, "42501", JSON.stringify(queryAfterRevocation));
          await a.ok("reset role;");
          const restore = membershipCommand(uid(1121), true, 1, "Restore for RR receipt query race");
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
          const restored = await b.query(`select api.command_v1('${JSON.stringify(restore).replaceAll("'", "''")}'::jsonb);`); assert.equal(restored.code, "00000", JSON.stringify(restored));

          await claims({ role: "authenticated", sub: actor, aal: "aal1" }, actor);
          await a.ok(`begin isolation level repeatable read;select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)};`);
          const revokeRR = membershipCommand(uid(1122), false, 2, "Receipt query race, revoke first");
          const revokedRR = await b.query(`select api.command_v1('${JSON.stringify(revokeRR).replaceAll("'", "''")}'::jsonb);`); assert.equal(revokedRR.code, "00000", JSON.stringify(revokedRR));
          const staleQuery = await a.query(`select api.query_v1('${JSON.stringify(query).replaceAll("'", "''")}'::jsonb);`);
          await a.ok("rollback;");
          assert.equal(staleQuery.code, "40001", JSON.stringify(staleQuery));
          const freshQuery = await a.query(`select api.query_v1('${JSON.stringify(query).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(freshQuery.code, "42501", JSON.stringify(freshQuery));
          const finalQueryState = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(actor)})||'|'||(select count(*) from app_private.api_command_receipts where actor_id=${lit(actor)} and operation_id=${lit(uid(1101))})||'|'||(select count(*) from public.task_instances where id=${lit(receipt.result.taskId)})||'|'||(select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(actor)});`)).at(-1);
          assert.deepEqual(finalQueryState.split("|"), ["false", "3", "1", "1", String(membershipFenceBeforeQueries + 3)], finalQueryState);
          record("M2.2C one-off commandReceipt serializes read-first RC and aborts stale revoke-first RR", true, { readFirstSQLSTATE: readFirst.code, revocationBlockedByQuery: queryBlockedRevoker, revokeAfterQuerySQLSTATE: revokeAfterQuery.code, postRevocationSQLSTATE: queryAfterRevocation.code, revokeFirstSQLSTATE: revokedRR.code, staleRRSQLSTATE: staleQuery.code, freshRetrySQLSTATE: freshQuery.code, state: finalQueryState, sqlstate40P01: 0 });
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
          const restoreFinal = membershipCommand(uid(1123), true, 3, "Restore after RR receipt query test");
          const finalRestore = await b.query(`select api.command_v1('${JSON.stringify(restoreFinal).replaceAll("'", "''")}'::jsonb);`); assert.equal(finalRestore.code, "00000", JSON.stringify(finalRestore));
          // Restore this shared synthetic fixture's pre-test effective-date setting
          // so later unrelated scenarios retain their original month-start access.
          await observer.ok(`update public.company_memberships set access_valid_from=${membershipAccessFromBeforeQueries ? `${lit(membershipAccessFromBeforeQueries)}::timestamptz` : "null"} where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)};`);
        }
        {
          const manager = uid(1110), managerOperation = uid(1111);
          await observer.ok(`insert into auth.users(id) values(${lit(manager)});
            insert into public.profiles(id,organization_id,name,role,manager_id,sector,branch,position) values(${lit(manager)},${lit(org)},'Synthetic one-off manager','encargado',${lit(boss)},'Test','Test','Manager');
            insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(manager)});
            insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(manager)});
            update public.profiles set manager_id=${lit(manager)} where id=${lit(actor)};`);
          const ownerCreationRevision = (await observer.ok(`select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)};`)).at(-1);
          const managerScheduledOn = (await observer.ok("select (date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date::text;")).at(-1);
          const managedOneOff = { contractVersion: 1, operationId: managerOperation, kind: "task.createOneOff", expectedRevisions: { [`creation:${actor}`]: ownerCreationRevision }, payload: { ownerId: actor, companyId: company, teamId: team, source: { type: "custom", definition: { kind: "operativa", title: "M2.2C manager one-off null guard", objective: "", sector: "Test", unit: "comprobantes" } }, scheduledOn: managerScheduledOn, dueDate: null, priority: "Media" } };
          await claims({ role: "authenticated", sub: manager, aal: "aal2" }, manager);
          const made = await a.query(`select api.command_v1('${JSON.stringify(managedOneOff).replaceAll("'", "''")}'::jsonb);`); assert.equal(made.code, "00000", JSON.stringify(made));
          const receiptQuery = operationId => ({ contractVersion: 1, kind: "commandReceipt", filters: { operationId }, cursor: null, limit: 1 });
          const managedReceipt = await a.query(`select api.query_v1('${JSON.stringify(receiptQuery(managerOperation)).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(managedReceipt.code, "00000", JSON.stringify(managedReceipt)); assert.equal(JSON.parse(managedReceipt.lines.at(-1)).data.found, true);
          await a.ok("reset role;");
          const bossOperation = uid(1114), bossCreationRevision = (await observer.ok(`select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)};`)).at(-1);
          const bossOneOff = { ...managedOneOff, operationId: bossOperation, expectedRevisions: { [`creation:${actor}`]: bossCreationRevision }, payload: { ...managedOneOff.payload, source: { ...managedOneOff.payload.source, definition: { ...managedOneOff.payload.source.definition, title: "M2.2C jefe one-off receipt read" } } } };
          await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
          const bossMade = await a.query(`select api.command_v1('${JSON.stringify(bossOneOff).replaceAll("'", "''")}'::jsonb);`); assert.equal(bossMade.code, "00000", JSON.stringify(bossMade));
          const bossReceipt = await a.query(`select api.query_v1('${JSON.stringify(receiptQuery(bossOperation)).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(bossReceipt.code, "00000", JSON.stringify(bossReceipt)); assert.equal(JSON.parse(bossReceipt.lines.at(-1)).data.found, true);
          await a.ok("reset role;");
          const receiptState = async () => (await observer.ok(`select jsonb_build_object(
            'creationHeads',(select coalesce(jsonb_agg(to_jsonb(h) order by owner_id),'[]'::jsonb) from app_private.api_creation_heads h where organization_id=${lit(org)} and owner_id=${lit(actor)}),
            'monthFences',(select coalesce(jsonb_agg(to_jsonb(f) order by period),'[]'::jsonb) from app_private.api_month_fences f where owner_id=${lit(actor)}),
            'membershipFences',(select to_jsonb(f) from app_private.api_membership_fences f where organization_id=${lit(org)} and profile_id=${lit(actor)}),
            'operationFences',(select coalesce(jsonb_agg(to_jsonb(f) order by actor_id,operation_id),'[]'::jsonb) from app_private.api_operation_fences f where (actor_id,operation_id) in ((${lit(manager)},${lit(managerOperation)}),(${lit(boss)},${lit(bossOperation)}))),
            'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by actor_id,operation_id),'[]'::jsonb) from app_private.api_command_receipts r where (actor_id,operation_id) in ((${lit(manager)},${lit(managerOperation)}),(${lit(boss)},${lit(bossOperation)}))),
            'audit',(select coalesce(jsonb_agg(to_jsonb(e) order by at),'[]'::jsonb) from public.audit_events e where actor_id in (${lit(manager)},${lit(boss)}) and action='task.createOneOff')
          )::text;`)).at(-1);
          const receiptSnapshotBefore = await receiptState();
          await claims({ role: "authenticated", sub: actor, aal: "aal1" }, actor);
          const managerReceiptHidden = await a.query(`select api.query_v1('${JSON.stringify(receiptQuery(managerOperation)).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(managerReceiptHidden.code, "00000", JSON.stringify(managerReceiptHidden)); assert.equal(JSON.parse(managerReceiptHidden.lines.at(-1)).data.found, false);
          await claims({ role: "authenticated", sub: manager, aal: "aal2" }, manager);
          const managedReceiptAgain = await a.query(`select api.query_v1('${JSON.stringify(receiptQuery(managerOperation)).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(managedReceiptAgain.code, "00000", JSON.stringify(managedReceiptAgain)); assert.equal(JSON.parse(managedReceiptAgain.lines.at(-1)).data.found, true);
          await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
          const bossReceiptAgain = await a.query(`select api.query_v1('${JSON.stringify(receiptQuery(bossOperation)).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(bossReceiptAgain.code, "00000", JSON.stringify(bossReceiptAgain)); assert.equal(JSON.parse(bossReceiptAgain.lines.at(-1)).data.found, true);
          await a.ok("reset role;");
          const receiptSnapshotAfter = await receiptState(); assert.equal(receiptSnapshotAfter, receiptSnapshotBefore, "receipt reads must not change heads, fences, audit, or receipts");
          await a.ok("reset role;");
          await observer.ok(`update public.profiles set manager_id=null where id=${lit(actor)};`);
          await claims({ role: "authenticated", sub: manager, aal: "aal2" }, manager);
          const managerReceiptOutOfScope = await a.query(`select api.query_v1('${JSON.stringify(receiptQuery(managerOperation)).replaceAll("'", "''")}'::jsonb);`); assert.equal(managerReceiptOutOfScope.code, "42501", JSON.stringify(managerReceiptOutOfScope));
          const replay = await a.query(`select api.command_v1('${JSON.stringify(managedOneOff).replaceAll("'", "''")}'::jsonb);`); assert.equal(replay.code, "42501", JSON.stringify(replay));
          const freshRevision = (await observer.ok(`select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)};`)).at(-1);
          const firstExecution = { ...managedOneOff, operationId: uid(1112), expectedRevisions: { [`creation:${actor}`]: freshRevision } };
          const firstDenied = await a.query(`select api.command_v1('${JSON.stringify(firstExecution).replaceAll("'", "''")}'::jsonb);`); assert.equal(firstDenied.code, "42501", JSON.stringify(firstDenied));
          const effectState = (await observer.ok(`select (select count(*) from public.task_assignments where owner_id=${lit(actor)} and title='M2.2C manager one-off null guard')||'|'||(select count(*) from public.task_instances where owner_id=${lit(actor)} and title='M2.2C manager one-off null guard')||'|'||(select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)})||'|'||(select count(*) from app_private.api_command_receipts where actor_id=${lit(manager)} and operation_id=${lit(managerOperation)})||'|'||(select count(*) from app_private.api_operation_fences where actor_id=${lit(manager)} and operation_id=${lit(managerOperation)});`)).at(-1);
          assert.equal(effectState, `1|1|${Number(bossCreationRevision) + 1}|1|1`);
          await a.ok("reset role;");
          record("M2.2C one-off commandReceipt permits jefe/encargado own receipts, hides actor-private receipts, is read-only, and denies manager_id NULL", true, { managerReadSQLSTATE: managedReceipt.code, bossReadSQLSTATE: bossReceipt.code, foreignActorFound: JSON.parse(managerReceiptHidden.lines.at(-1)).data.found, managerOutOfScopeSQLSTATE: managerReceiptOutOfScope.code, snapshotStable: receiptSnapshotBefore === receiptSnapshotAfter, replaySQLSTATE: replay.code, firstExecutionSQLSTATE: firstDenied.code, inertAfterDeniedCalls: effectState });

          // The live assignment FK and sealed responsibility-set references
          // make a real receipt without team_members unreachable. Use a fresh
          // no-assignment employee and seed a structurally exact synthetic
          // receipt once; never modify its arguments or weaken constraints.
          const teamOwner = uid(1117), teamOperation = uid(1118), syntheticTask = uid(2117), syntheticAssignment = uid(2118);
          const teamCommand = { contractVersion: 1, operationId: teamOperation, kind: "task.createOneOff", expectedRevisions: { [`creation:${teamOwner}`]: "0" }, payload: { ownerId: teamOwner, companyId: company, teamId: team, source: { type: "custom", definition: { kind: "operativa", title: "Synthetic historical receipt team guard", objective: "", sector: "Test", unit: "comprobantes" } }, scheduledOn: managerScheduledOn, dueDate: null, priority: "Media" } };
          const teamResult = { contractVersion: 1, operationId: teamOperation, kind: "task.createOneOff", result: { assignmentId: syntheticAssignment, taskId: syntheticTask, taskRevision: "1" } };
          await observer.ok(`insert into auth.users(id) values(${lit(teamOwner)});
            insert into public.profiles(id,organization_id,name,role,manager_id,sector,branch,position) values(${lit(teamOwner)},${lit(org)},'Synthetic no-assignment employee','empleado',${lit(manager)},'Test','Test','Employee');
            insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(teamOwner)});
            insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(teamOwner)});
            insert into app_private.api_command_receipts(actor_id,operation_id,organization_id,kind,arguments,result) values(${lit(manager)},${lit(teamOperation)},${lit(org)},'task.createOneOff','${JSON.stringify(teamCommand)}'::jsonb,'${JSON.stringify(teamResult)}'::jsonb);
            delete from public.team_members where organization_id=${lit(org)} and team_id=${lit(team)} and profile_id=${lit(teamOwner)};`);
          const teamReadSnapshot = async () => (await observer.ok(`select jsonb_build_object(
            'profile',(select to_jsonb(p) from public.profiles p where id=${lit(teamOwner)}),
            'head',(select to_jsonb(h) from app_private.api_creation_heads h where organization_id=${lit(org)} and owner_id=${lit(teamOwner)}),
            'monthFences',(select coalesce(jsonb_agg(to_jsonb(f) order by period),'[]'::jsonb) from app_private.api_month_fences f where owner_id=${lit(teamOwner)}),
            'membershipFence',(select to_jsonb(f) from app_private.api_membership_fences f where organization_id=${lit(org)} and profile_id=${lit(teamOwner)}),
            'operationFence',(select to_jsonb(f) from app_private.api_operation_fences f where actor_id=${lit(manager)} and operation_id=${lit(teamOperation)}),
            'receipt',(select to_jsonb(r) from app_private.api_command_receipts r where actor_id=${lit(manager)} and operation_id=${lit(teamOperation)}),
            'audit',(select coalesce(jsonb_agg(to_jsonb(e) order by at),'[]'::jsonb) from public.audit_events e where actor_id=${lit(manager)} and entity_id=${lit(syntheticAssignment)} and action='task.createOneOff'),
            'businessRows',jsonb_build_array((select count(*) from public.task_instances where id=${lit(syntheticTask)}),(select count(*) from public.task_assignments where id=${lit(syntheticAssignment)}),(select count(*) from public.team_members where organization_id=${lit(org)} and team_id=${lit(team)} and profile_id=${lit(teamOwner)}))
          )::text;`)).at(-1);
          const teamBeforeRead = await teamReadSnapshot();
          await claims({ role: "authenticated", sub: manager, aal: "aal2" }, manager);
          const teamDenied = await a.query(`select api.query_v1('${JSON.stringify(receiptQuery(teamOperation)).replaceAll("'", "''")}'::jsonb);`); assert.equal(teamDenied.code, "42501", JSON.stringify(teamDenied));
          await a.ok("reset role;");
          const teamAfterRead = await teamReadSnapshot(); assert.equal(teamAfterRead, teamBeforeRead, "synthetic team-out-of-scope denied receipt query must not write");
          await observer.ok(`insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(teamOwner)});`);
          record("M2.2C synthetic commandReceipt read denies with missing team_members; no assignment/constraint disabled", true, { deniedSQLSTATE: teamDenied.code, receiptFixture: "synthetic exact-version shape; not emitted by command_v1", argumentsUntampered: true, noAssignmentRows: true, snapshotStable: teamBeforeRead === teamAfterRead, membershipRestored: true });
        }
        await claims({ role: "authenticated", sub: actor, aal: "aal1" }, actor);
        await a.ok("reset role;begin isolation level repeatable read;");
        await a.ok(`select active from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)};`);
        await observer.ok(`update public.company_memberships set active=false where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)};`);
        const staleSnapshot = await a.query(`select api.command_v1('${JSON.stringify(oneOff).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(staleSnapshot.code, "40001", JSON.stringify(staleSnapshot)); await a.ok("rollback;");
        const freshDenied = await a.query(`select api.command_v1('${JSON.stringify(oneOff).replaceAll("'", "''")}'::jsonb);`); assert.equal(freshDenied.code, "42501", JSON.stringify(freshDenied));
        await observer.ok(`update public.company_memberships set active=true where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(actor)};`);
        await a.ok("reset role;");
        record("M2.2C one-off replay reauthorizes revoked membership; R29, stale/malformed, RC/RR deny and inert-state controls", true, { r29ReplaySQLSTATE: exactReplay.code, staleCatalogueSQLSTATE: staleResult.code, malformedSQLSTATE: malformedResult.code, rcRevokedSQLSTATE: denied.code, rrStaleSnapshotSQLSTATE: staleSnapshot.code, rrFreshSQLSTATE: freshDenied.code, noEffectState: afterDeniedReplay, receiptStable: JSON.stringify(JSON.parse(exactReplay.lines.at(-1))) === JSON.stringify(receipt) });
      }
      {
        const owner = uid(660), lineId = uid(661), templateIdOp = uid(662), templateOrgRev = (await observer.ok(`select coalesce((select revision from app_private.api_catalogue_heads where organization_id=${lit(org)}),0);`)).at(-1);
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        const create = { contractVersion: 1, operationId: uid(663), kind: "catalogue.create", expectedRevisions: { [`catalogue:${org}`]: templateOrgRev }, payload: { definition: { kind: "operativa", title: "M2.2C triad standard", objective: "", sector: "Test", unit: "documentos" }, effectiveOn: scheduledOn, reason: "Three way native race" } };
        const created = await a.query(`select api.command_v1('${JSON.stringify(create).replaceAll("'", "''")}'::jsonb);`); assert.equal(created.code, "00000", JSON.stringify(created)); const standard = JSON.parse(created.lines.at(-1)).result; const templateId = standard.templateId;
        await observer.ok(`insert into auth.users(id) values(${lit(owner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(owner)},${lit(org)},'Synthetic catalogue triad employee','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(owner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(owner)});`);
        const draft = { schemaVersion: 2, lines: [{ lineId, companyId: company, teamId: team, source: { type: "catalogue", templateVersionId: standard.versionId }, schedule: { frequency: "mensual", startDate: scheduledOn, endDate: null, interval: 1, weekdays: [], monthDay: dayOfMonth, hasDeadline: true, dueOffsetDays: 0 } }] };
        await claims({ role: "authenticated", sub: owner, aal: "aal1" }, owner);
        const saved = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: uid(664), kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${owner}`]: "0" }, payload: { requestId: null, draft } }).replaceAll("'", "''")}'::jsonb);`); assert.equal(saved.code, "00000", JSON.stringify(saved)); const requestId = JSON.parse(saved.lines.at(-1)).result.requestId;
        const submit = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: uid(665), kind: "onboarding.submit", expectedRevisions: { [`onboarding:${requestId}`]: "0", [`onboardingDraft:${requestId}`]: "1" }, payload: { requestId } }).replaceAll("'", "''")}'::jsonb);`); assert.equal(submit.code, "00000", JSON.stringify(submit)); await a.ok("reset role;");
        const catalogueRevision = Number(templateOrgRev) + 1;
        const revise = { contractVersion: 1, operationId: uid(666), kind: "catalogue.revise", expectedRevisions: { [`catalogue:${org}`]: String(catalogueRevision), [`catalogue:${templateId}`]: "1" }, payload: { templateId, definition: { kind: "operativa", title: "M2.2C triad standard revised", objective: "", sector: "Test", unit: "archivos" }, effectiveOn: scheduledOn, reason: "Change during triad" } };
        const creationRev = (await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(owner)}),0);`)).at(-1);
        const assignment = { contractVersion: 1, operationId: uid(667), kind: "assignment.create", expectedRevisions: { [`creation:${owner}`]: creationRev, [`catalogue:${templateId}`]: "1" }, payload: { ownerId: owner, companyId: company, teamId: team, source: { type: "catalogue", templateVersionId: standard.versionId }, schedule: { frequency: "mensual", startDate: scheduledOn, endDate: null, interval: 1, weekdays: [], monthDay: dayOfMonth, hasDeadline: true, dueOffsetDays: 0 } } };
        const approve = { contractVersion: 1, operationId: uid(668), kind: "onboarding.approve", expectedRevisions: { [`onboarding:${requestId}`]: "1", [`catalogue:${templateId}`]: "1" }, payload: { requestId, weightOverrides: [], period: monthPeriod } };
        await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level read committed;`);
        const reviseResult = await a.query(`select api.command_v1('${JSON.stringify(revise).replaceAll("'", "''")}'::jsonb);`); assert.equal(reviseResult.code, "00000", JSON.stringify(reviseResult));
        const revisePid = Number((await a.ok("select pg_backend_pid();")).at(-1));
        const catalogueAdvisoryLockHeld = (await reviewer.ok(`select exists(select 1 from pg_catalog.pg_locks where pid=${revisePid} and locktype='advisory' and granted and classid=1105 and objid=pg_catalog.hashtext(${lit(`catalogue:${org}`)})::oid and objsubid=2);`)).at(-1) === "t";
        assert.equal(catalogueAdvisoryLockHeld, true, "revision transaction did not retain the expected 1105 catalogue advisory lock");
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select count(*) from public.task_templates;`);
        const assignPid = Number((await b.ok("select pg_backend_pid();")).at(-1)); const assignPending = b.query(`select api.command_v1('${JSON.stringify(assignment).replaceAll("'", "''")}'::jsonb);`);
        await observer.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level read committed;select count(*) from public.onboarding_requests;`);
        const approvalSnapshot = (await observer.ok(`select current_setting('transaction_isolation')||'|'||(select version from public.task_templates where id=${lit(templateId)});`)).at(-1);
        assert.equal(approvalSnapshot, "read committed|1", approvalSnapshot);
        const approvePid = Number((await observer.ok("select pg_backend_pid();")).at(-1)); const approvePending = observer.query(`select api.command_v1('${JSON.stringify(approve).replaceAll("'", "''")}'::jsonb);`);
        let assignBlocked = false, approveBlocked = false; let approveActivity = "not_sampled"; const deadline = Date.now() + 10000;
        while (Date.now() < deadline && !(assignBlocked && approveBlocked)) {
          if (!assignBlocked) assignBlocked = (await reviewer.ok(`select ${Number((await a.ok("select pg_backend_pid();")).at(-1))}=any(pg_catalog.pg_blocking_pids(${assignPid}));`)).at(-1) === "t";
          if (!approveBlocked) {
            const activity = await reviewer.ok(`select coalesce((select coalesce(wait_event_type,'active')||'|'||coalesce(wait_event,'')||'|'||coalesce(array_to_string(pg_catalog.pg_blocking_pids(pid),','),'') from pg_catalog.pg_stat_activity where pid=${approvePid} and state='active'),'finished');`);
            approveActivity = activity.at(-1);
            const directBlockers = approveActivity.startsWith("Lock|") ? approveActivity.split("|")[2].split(",") : [];
            // The assignment and approval share the actor fence (1102), so approval may
            // wait behind assignment, which itself waits behind the catalogue revision.
            approveBlocked = directBlockers.includes(String(revisePid)) || directBlockers.includes(String(assignPid));
          }
          await new Promise((done) => setTimeout(done, 20));
        }
        await a.ok("commit;"); const assignStale = await assignPending, approveStale = await approvePending;
        await b.ok(assignStale.code === "00000" ? "commit;" : "rollback;"); await observer.ok(approveStale.code === "00000" ? "commit;" : "rollback;");
        assert.equal(assignBlocked, true, `assignment was not blocked; revisePid=${revisePid}, assignmentPid=${assignPid}, approvePid=${approvePid}, approveBlocked=${approveBlocked}, assignmentSQLSTATE=${assignStale.code}, approveSQLSTATE=${approveStale.code}`); assert.equal(approveBlocked, true, `approval was not blocked under ${approvalSnapshot}; revisePid=${revisePid}, assignmentPid=${assignPid}, approvePid=${approvePid}, revisionLockHeld=${catalogueAdvisoryLockHeld}, activity=${approveActivity}, assignmentBlocked=${assignBlocked}, assignmentSQLSTATE=${assignStale.code}, approve=${JSON.stringify(approveStale)}`); assert.equal(assignStale.code, "40001", JSON.stringify(assignStale)); assert.equal(approveStale.code, "40001", JSON.stringify(approveStale));
        const newVersion = (await reviewer.ok(`select id from public.task_template_versions where template_id=${lit(templateId)} order by version desc limit 1;`)).at(-1);
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
        const assignmentRetry = { ...assignment, expectedRevisions: { [`creation:${owner}`]: creationRev, [`catalogue:${templateId}`]: "2" }, payload: { ...assignment.payload, source: { type: "catalogue", templateVersionId: newVersion } } };
        const assignmentRetryResult = await b.query(`select api.command_v1('${JSON.stringify(assignmentRetry).replaceAll("'", "''")}'::jsonb);`); assert.equal(assignmentRetryResult.code, "00000", JSON.stringify(assignmentRetryResult)); await b.ok("reset role;");
        await observer.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
        const approveRetry = { ...approve, expectedRevisions: { [`onboarding:${requestId}`]: "1", [`catalogue:${templateId}`]: "2" } };
        const approveRetryResult = await observer.query(`select api.command_v1('${JSON.stringify(approveRetry).replaceAll("'", "''")}'::jsonb);`); assert.equal(approveRetryResult.code, "40001", JSON.stringify(approveRetryResult)); await observer.ok("reset role;");
        const state = (await reviewer.ok(`select (select version from public.task_templates where id=${lit(templateId)})||'|'||(select count(*) from public.task_assignments where owner_id=${lit(owner)} and template_id=${lit(templateId)})||'|'||(select status from public.onboarding_requests where id=${lit(requestId)})||'|'||(select count(*) from public.onboarding_activations where request_id=${lit(requestId)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(uid(668))});`)).at(-1);
        assert.equal(state, "2|1|submitted|0|0", state);
        record("M2.2C catalogue revision fences simultaneous assignment creation and approval; assignment retries on v2", true, { reviseSQLSTATE: reviseResult.code, assignmentSQLSTATE: assignStale.code, approvalSQLSTATE: approveStale.code, assignmentRetrySQLSTATE: assignmentRetryResult.code, approvalRetrySQLSTATE: approveRetryResult.code, backendPids: { revision: revisePid, assignment: assignPid, approval: approvePid }, revisionLockHeld: catalogueAdvisoryLockHeld, blockers: { assignment: assignBlocked, approval: approveBlocked }, approvalActivity: approveActivity, approvalStaleError: approveStale.errors, finalVersionAssignmentsRequestActivationReceipt: state });
        await a.ok("reset role;"); await b.ok("reset role;"); await observer.ok("reset role;");
      }
      for (let i = 0; i < 2; i++) {
        const iso = i === 0 ? "read committed" : "repeatable read", owner = uid(1000 + i * 20), company2 = uid(1008 + i * 20), templateOp = uid(1001 + i * 20);
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        const orgRevision = (await observer.ok(`select coalesce((select revision from app_private.api_catalogue_heads where organization_id=${lit(org)}),0);`)).at(-1);
        const createTemplate = { contractVersion: 1, operationId: templateOp, kind: "catalogue.create", expectedRevisions: { [`catalogue:${org}`]: orgRevision }, payload: { definition: { kind: "operativa", title: `M2.2C triad inverse ${i}`, objective: "", sector: "Test", unit: "documentos" }, effectiveOn: scheduledOn, reason: "Inverse triad concurrency fixture" } };
        const createResult = await a.query(`select api.command_v1('${JSON.stringify(createTemplate).replaceAll("'", "''")}'::jsonb);`); assert.equal(createResult.code, "00000", JSON.stringify(createResult)); await a.ok("reset role;");
        const template = JSON.parse(createResult.lines.at(-1)).result, request = await makeRequest(owner, uid(1002 + i * 20), 1003 + i * 20, template.versionId);
        await observer.ok(`insert into public.companies(id,organization_id,name) values(${lit(company2)},${lit(org)},'M2.2C triad inverse company ${i}');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company2)},${lit(owner)});`);
        const assignmentRevision = (await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(owner)}),0);`)).at(-1);
        const assignment = { contractVersion: 1, operationId: uid(1005 + i * 20), kind: "assignment.create", expectedRevisions: { [`creation:${owner}`]: assignmentRevision, [`catalogue:${template.templateId}`]: "1" }, payload: { ownerId: owner, companyId: company2, teamId: team, source: { type: "catalogue", templateVersionId: template.versionId }, schedule: { frequency: "mensual", startDate: scheduledOn, endDate: null, interval: 1, weekdays: [], monthDay: dayOfMonth, hasDeadline: true, dueOffsetDays: 0 } } };
        const approveOp = uid(1006 + i * 20), approve = { contractVersion: 1, operationId: approveOp, kind: "onboarding.approve", expectedRevisions: { [`onboarding:${request}`]: "1", [`catalogue:${template.templateId}`]: "1" }, payload: { requestId: request, weightOverrides: [], period: monthPeriod } };
        const currentOrgRevision = (await observer.ok(`select revision from app_private.api_catalogue_heads where organization_id=${lit(org)};`)).at(-1);
        const revise = { contractVersion: 1, operationId: uid(1007 + i * 20), kind: "catalogue.revise", expectedRevisions: { [`catalogue:${org}`]: currentOrgRevision, [`catalogue:${template.templateId}`]: "1" }, payload: { templateId: template.templateId, definition: { kind: "operativa", title: `M2.2C triad inverse revised ${i}`, objective: "", sector: "Test", unit: "archivos" }, effectiveOn: scheduledOn, reason: "Revision waits behind assignment and approval" } };
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        await a.ok(`begin isolation level ${iso};`); const creatorPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
        const assignmentResult = await a.query(`select api.command_v1('${JSON.stringify(assignment).replaceAll("'", "''")}'::jsonb);`); assert.equal(assignmentResult.code, "00000", JSON.stringify(assignmentResult));
        const approvalResult = await a.query(`select api.command_v1('${JSON.stringify(approve).replaceAll("'", "''")}'::jsonb);`); assert.equal(approvalResult.code, "00000", JSON.stringify(approvalResult));
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${iso};select count(*) from public.task_templates;`);
        const revisionPid = Number((await b.ok("select pg_backend_pid();")).at(-1)); const revisionPending = b.query(`select api.command_v1('${JSON.stringify(revise).replaceAll("'", "''")}'::jsonb);`);
        let blocked = false; const deadline = Date.now() + 10000; while (Date.now() < deadline) { if ((await observer.ok(`select ${creatorPid}=any(pg_catalog.pg_blocking_pids(${revisionPid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
        assert.equal(blocked, true, "catalogue revision did not block behind committed-together assignment/approval plan");
        await a.ok("commit;"); const revisionResult = await revisionPending; await b.ok(revisionResult.code === "00000" ? "commit;" : "rollback;"); assert.equal(revisionResult.code, "00000", JSON.stringify(revisionResult));
        await a.ok("reset role;"); await b.ok("reset role;");
        const final = (await observer.ok(`select (select version from public.task_templates where id=${lit(template.templateId)})||'|'||(select status from public.onboarding_requests where id=${lit(request)})||'|'||(select count(*) from public.onboarding_activations where request_id=${lit(request)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id in (${lit(assignment.operationId)},${lit(approveOp)},${lit(revise.operationId)}));`)).at(-1);
        assert.equal(final, "2|approved|1|3", final);
        record(`M2.2C triad inverse: assignment and approval win before catalogue revision (${iso}/${iso})`, true, { isolationPair: `${iso}/${iso}`, blocked, assignmentSQLSTATE: assignmentResult.code, approvalSQLSTATE: approvalResult.code, revisionSQLSTATE: revisionResult.code, finalVersionStatusActivationReceipts: final });
      }
      const assignmentRevision = (await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)}),0);`)).at(-1);
      const catalogueTemplateId = JSON.parse(standardCall.lines.at(-1)).result.templateId;
      const catalogueVersionId = standardVersionId;
      const assignmentCommand = { contractVersion: 1, operationId: uid(362), kind: "assignment.create", expectedRevisions: { [`creation:${actor}`]: assignmentRevision, [`catalogue:${catalogueTemplateId}`]: "1" }, payload: { ownerId: actor, companyId: company, teamId: team, source: { type: "catalogue", templateVersionId: catalogueVersionId }, schedule: { frequency: "mensual", startDate: scheduledOn, endDate: null, interval: 1, weekdays: [], monthDay: dayOfMonth, hasDeadline: true, dueOffsetDays: 0 } } };
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const assignmentResult = await a.query(`select api.command_v1('${JSON.stringify(assignmentCommand).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(assignmentResult.code, "00000", JSON.stringify(assignmentResult));
      const assignmentId = JSON.parse(assignmentResult.lines.at(-1)).result.assignmentId;
      for (let i = 0; i < 4; i++) {
      const materializeRevision = (await observer.ok(`select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)};`)).at(-1);
      const materializations = [uid(363 + i * 2), uid(364 + i * 2)].map((operationId) => ({ contractVersion: 1, operationId, kind: "month.materialize", expectedRevisions: { [`creation:${actor}`]: materializeRevision }, payload: { ownerId: actor, period: monthPeriod } }));
      const iso = i < 2 ? "read committed" : "repeatable read", first = i % 2 === 0 ? a : b, second = first === a ? b : a;
      await first.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${iso};`);
      const firstPid = Number((await first.ok("select pg_backend_pid();")).at(-1));
      const materializeFirst = await first.query(`select api.command_v1('${JSON.stringify(materializations[0]).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(materializeFirst.code, "00000", JSON.stringify(materializeFirst));
      await second.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${iso};select count(*) from public.task_assignments where owner_id=${lit(actor)};`);
      const secondPid = Number((await second.ok("select pg_backend_pid();")).at(-1));
      const materializePending = second.query(`select api.command_v1('${JSON.stringify(materializations[1]).replaceAll("'", "''")}'::jsonb);`);
      let materializeBlocked = false;
      const materializeDeadline = Date.now() + 10000;
      while (Date.now() < materializeDeadline) {
        if ((await observer.ok(`select ${firstPid}=any(pg_catalog.pg_blocking_pids(${secondPid}));`)).at(-1) === "t") { materializeBlocked = true; break; }
        await new Promise((done) => setTimeout(done, 20));
      }
      await first.ok("commit;");
      const materializeSecond = await materializePending;
      await second.ok(materializeSecond.code === "00000" ? "commit;" : "rollback;");
      assert.equal(materializeBlocked, true);
      assert.equal(materializeSecond.code, "40001", JSON.stringify(materializeSecond));
      const freshRevision = (await observer.ok(`select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)};`)).at(-1);
      const materializeRetryArgs = { ...materializations[1], expectedRevisions: { [`creation:${actor}`]: freshRevision } };
      await second.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
      const authorizedRetry = await second.query(`select api.command_v1('${JSON.stringify(materializeRetryArgs).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(authorizedRetry.code, "00000", JSON.stringify(authorizedRetry));
      await first.ok("reset role;"); await second.ok("reset role;");
      const materializeState = (await observer.ok(`select count(*) from public.task_instances where assignment_id=${lit(assignmentId)} and period=${lit(monthPeriod)}::date;`)).at(-1);
      assert.equal(materializeState, "1", materializeState);
      record(`M2.2C materialize/materialize both writers (${iso}/${iso}, first backend ${first === a ? "A" : "B"})`, true, { isolationPair: `${iso}/${iso}`, firstBackend: first === a ? "A" : "B", blocked: materializeBlocked, firstSQLSTATE: materializeFirst.code, secondSQLSTATE: materializeSecond.code, retrySQLSTATE: authorizedRetry.code, taskInstancesForAssignment: materializeState });
      }
      const closeOneOffPairs = [
        ["read committed", "read committed"], ["read committed", "read committed"],
        ["repeatable read", "repeatable read"], ["repeatable read", "repeatable read"],
        ["read committed", "repeatable read"], ["read committed", "repeatable read"],
      ];
      for (let i = 0; i < closeOneOffPairs.length; i++) {
        const [closeIso, writerIso] = closeOneOffPairs[i];
        const owner = uid(430 + i), op = uid(432 + i);
        await observer.ok(`insert into auth.users(id) values(${lit(owner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(owner)},${lit(org)},${lit(`Synthetic close race ${i}`)},'empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(owner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(owner)});`);
        const closeAssignment = uid(440 + i * 2), closeTask = uid(441 + i * 2);
        await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist) values(${lit(closeAssignment)},${lit(org)},${lit(company)},${lit(owner)},${lit(team)},'M2.2C close prerequisite ${i}','resultado',1,null,null,'mensual',${lit(monthPeriod)}::date,${dayOfMonth},'[]');insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status,completed_at) values(${lit(closeTask)},${lit(org)},${lit(closeAssignment)},${lit(company)},${lit(owner)},${lit(team)},${lit(monthPeriod)}::date,${lit(scheduledOn)}::date,'M2.2C close prerequisite ${i}','resultado',1,null,null,null,'[]','Completada',clock_timestamp());`);
        const oneOff = { contractVersion: 1, operationId: op, kind: "task.createOneOff", expectedRevisions: { [`creation:${owner}`]: "0" }, payload: { ownerId: owner, companyId: company, teamId: team, source: { type: "custom", definition: { kind: "operativa", title: `M2.2C close race ${i}`, objective: "", sector: "Test", unit: "comprobantes" } }, scheduledOn, dueDate: null, priority: "Media" } };
        if (i % 2 === 0) {
          await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${closeIso};`);
          const closePid = Number((await a.ok("select pg_backend_pid();")).at(-1));
          const closeFirst = await a.query(`select public.close_employee_month(${lit(owner)},${lit(monthPeriod)},'C fixture closes empty month');`);
          assert.equal(closeFirst.code, "00000", JSON.stringify(closeFirst));
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(owner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: owner, aal: "aal1" }))},false);set role authenticated;begin isolation level ${writerIso};select count(*) from public.profiles where id=${lit(owner)};`);
          const writerPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
          const writerPending = b.query(`select api.command_v1('${JSON.stringify(oneOff).replaceAll("'", "''")}'::jsonb);`);
          let blocked = false; const deadline = Date.now() + 10000;
          while (Date.now() < deadline) { if ((await observer.ok(`select ${closePid}=any(pg_catalog.pg_blocking_pids(${writerPid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
          await a.ok("commit;"); const writer = await writerPending; await b.ok(writer.code === "00000" ? "commit;" : "rollback;");
          assert.equal(blocked, true); assert.equal(writer.code, "40001", JSON.stringify(writer));
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(owner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: owner, aal: "aal1" }))},false);set role authenticated;`);
          const retry = await b.query(`select api.command_v1('${JSON.stringify(oneOff).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(retry.code, "55000", JSON.stringify(retry)); await b.ok("reset role;"); await a.ok("reset role;");
          const state = (await observer.ok(`select (select count(*) from public.monthly_closures where owner_id=${lit(owner)} and period=${lit(monthPeriod)})||'|'||(select count(*) from public.task_assignments where owner_id=${lit(owner)} and title like 'M2.2C close race%')||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(op)});`)).at(-1);
          assert.equal(state, "1|0|0", state);
          record(`M2.2C close-first one-off race (${closeIso}/${writerIso})`, true, { isolationPair: `${closeIso}/${writerIso}`, firstAction: "close", blocked, closeSQLSTATE: closeFirst.code, staleOneOffSQLSTATE: writer.code, retrySQLSTATE: retry.code, finalClosureAssignmentsReceipt: state });
        } else {
          await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(owner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: owner, aal: "aal1" }))},false);set role authenticated;begin isolation level ${writerIso};`);
          const writerPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
          const oneOffFirst = await a.query(`select api.command_v1('${JSON.stringify(oneOff).replaceAll("'", "''")}'::jsonb);`); assert.equal(oneOffFirst.code, "00000", JSON.stringify(oneOffFirst));
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${closeIso};`);
          const closePid = Number((await b.ok("select pg_backend_pid();")).at(-1));
          const closePending = b.query(`select public.close_employee_month(${lit(owner)},${lit(monthPeriod)},'C fixture races one-off');`);
          let blocked = false; const deadline = Date.now() + 10000;
          while (Date.now() < deadline) { if ((await observer.ok(`select ${writerPid}=any(pg_catalog.pg_blocking_pids(${closePid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
          await a.ok("commit;"); const close = await closePending; await b.ok(close.code === "00000" ? "commit;" : "rollback;");
          assert.equal(blocked, true); assert.equal(close.code, "40001", JSON.stringify(close));
          const closeRetry = await b.query(`select public.close_employee_month(${lit(owner)},${lit(monthPeriod)},'C fixture races one-off');`);
          assert.equal(closeRetry.code, "0A000", JSON.stringify(closeRetry));
          const state = (await observer.ok(`select (select count(*) from public.monthly_closures where owner_id=${lit(owner)} and period=${lit(monthPeriod)})||'|'||(select count(*) from public.task_assignments where owner_id=${lit(owner)} and title like 'M2.2C close race%')||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(op)});`)).at(-1);
          assert.equal(state, "0|1|1", state);
          record(`M2.2C one-off-first legacy close race (${writerIso}/${closeIso})`, true, { isolationPair: `${writerIso}/${closeIso}`, firstAction: "oneOff", blocked, oneOffSQLSTATE: oneOffFirst.code, staleCloseSQLSTATE: close.code, retrySQLSTATE: closeRetry.code, finalClosureAssignmentsReceipt: state });
          await a.ok("reset role;"); await b.ok("reset role;");
        }
      }
      for (let i = 0; i < 4; i++) {
        const iso = i < 2 ? "read committed" : "repeatable read";
        const owner = uid(500 + i * 10), assignment = uid(501 + i * 10), task = uid(502 + i * 10), futureAssignment = uid(503 + i * 10), operationId = uid(504 + i * 10);
        await observer.ok(`insert into auth.users(id) values(${lit(owner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(owner)},${lit(org)},${lit(`Synthetic materialize-close ${i}`)},'empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(owner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(owner)});insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days,measurement_version,definition_revision) values(${lit(assignment)},${lit(org)},${lit(company)},${lit(owner)},${lit(team)},'M2.2C materialize-close prerequisite','resultado',1,null,null,'mensual','2026-10-01',15,'[]','2026-10-01',null,1,array[1]::smallint[],1,false,0,1,1);insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status,completed_at) values(${lit(task)},${lit(org)},${lit(assignment)},${lit(company)},${lit(owner)},${lit(team)},'2026-10-01','2026-10-01','M2.2C materialize-close prerequisite','resultado',1,null,null,null,'[]','Completada',clock_timestamp());insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days,measurement_version,definition_revision) values(${lit(futureAssignment)},${lit(org)},${lit(company)},${lit(owner)},${lit(team)},'M2.2C materialize-close future','resultado',1,null,null,'mensual','2026-11-01',15,'[]','2026-11-01',null,1,array[1]::smallint[],1,false,0,1,1);`);
        const materialize = { contractVersion: 1, operationId, kind: "month.materialize", expectedRevisions: { [`creation:${owner}`]: "0" }, payload: { ownerId: owner, period: monthPeriod } };
        if (i % 2 === 1) {
          const v2Assignment = { contractVersion: 1, operationId: uid(505 + i), kind: "task.createOneOff", expectedRevisions: { [`creation:${owner}`]: "0" }, payload: { ownerId: owner, companyId: company, teamId: team, source: { type: "custom", definition: { kind: "operativa", title: `M2.2C materialize-close v2 ${i}`, objective: "", sector: "Test", unit: "documentos" } }, scheduledOn: monthPeriod, dueDate: null, priority: "Media" } };
          await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
          const createdV2 = await a.query(`select api.command_v1('${JSON.stringify(v2Assignment).replaceAll("'", "''")}'::jsonb);`); assert.equal(createdV2.code, "00000", JSON.stringify(createdV2));
          await a.ok("reset role;"); materialize.expectedRevisions[`creation:${owner}`] = "1";
        }
        if (i % 2 === 0) {
          await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${iso};`);
          const closePid = Number((await a.ok("select pg_backend_pid();")).at(-1));
          const closeFirst = await a.query(`select public.close_employee_month(${lit(owner)},${lit(monthPeriod)},'C fixture closes before materialize');`); assert.equal(closeFirst.code, "00000", JSON.stringify(closeFirst));
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${iso};select count(*) from public.profiles where id=${lit(owner)};`);
          const writerPid = Number((await b.ok("select pg_backend_pid();")).at(-1)); const pending = b.query(`select api.command_v1('${JSON.stringify(materialize).replaceAll("'", "''")}'::jsonb);`);
          let blocked = false; const deadline = Date.now() + 10000; while (Date.now() < deadline) { if ((await observer.ok(`select ${closePid}=any(pg_catalog.pg_blocking_pids(${writerPid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
           await a.ok("commit;"); const stale = await pending; await b.ok(stale.code === "00000" ? "commit;" : "rollback;"); assert.equal(blocked, true); assert.equal(stale.code, iso === "repeatable read" ? "40001" : "55000", JSON.stringify(stale));
          const retry = await b.query(`select api.command_v1('${JSON.stringify(materialize).replaceAll("'", "''")}'::jsonb);`); assert.equal(retry.code, "55000", JSON.stringify(retry)); await a.ok("reset role;"); await b.ok("reset role;");
          const state = (await observer.ok(`select (select count(*) from public.monthly_closures where owner_id=${lit(owner)} and period=${lit(monthPeriod)})||'|'||(select count(*) from public.task_instances where owner_id=${lit(owner)} and period=${lit(monthPeriod)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(operationId)});`)).at(-1); assert.equal(state, "1|1|0", state);
           record(`M2.2C close-first materialization (${iso}/${iso}) rejects after wait and retry rejects closed month`, true, { isolationPair: `${iso}/${iso}`, firstAction: "close", blocked, closeSQLSTATE: closeFirst.code, staleSQLSTATE: stale.code, retrySQLSTATE: retry.code, finalClosureTasksReceipt: state });
        } else {
          await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${iso};`);
          const writerPid = Number((await a.ok("select pg_backend_pid();")).at(-1)); const first = await a.query(`select api.command_v1('${JSON.stringify(materialize).replaceAll("'", "''")}'::jsonb);`); assert.equal(first.code, "00000", JSON.stringify(first));
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${iso};`);
          const closePid = Number((await b.ok("select pg_backend_pid();")).at(-1)); const pending = b.query(`select public.close_employee_month(${lit(owner)},${lit(monthPeriod)},'C fixture close races materialize');`);
          let blocked = false; const deadline = Date.now() + 10000; while (Date.now() < deadline) { if ((await observer.ok(`select ${writerPid}=any(pg_catalog.pg_blocking_pids(${closePid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
          await a.ok("commit;"); const stale = await pending; await b.ok("rollback;"); assert.equal(blocked, true); assert.ok(["40001", "0A000"].includes(stale.code), JSON.stringify(stale));
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
          const closeRetry = await b.query(`select public.close_employee_month(${lit(owner)},${lit(monthPeriod)},'C fixture close races materialize');`); assert.equal(closeRetry.code, "0A000", JSON.stringify(closeRetry));
          await a.ok("reset role;"); await b.ok("reset role;");
          const state = (await observer.ok(`select (select count(*) from public.monthly_closures where owner_id=${lit(owner)} and period=${lit(monthPeriod)})||'|'||(select count(*) from public.task_instances where owner_id=${lit(owner)} and period=${lit(monthPeriod)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(operationId)})||'|'||(select count(*) from public.task_instances ti join public.task_assignments ta on ta.id=ti.assignment_id where ti.owner_id=${lit(owner)} and ti.period=${lit(monthPeriod)} and ti.measurement_version=2 and ta.measurement_version=2);`)).at(-1); assert.equal(state, "0|2|1|1", state);
          record(`M2.2C materialize-first legacy close rejects v2 (${iso}/${iso})`, true, { isolationPair: `${iso}/${iso}`, firstAction: "materialize", blocked, materializeSQLSTATE: first.code, closeSQLSTATE: stale.code, retrySQLSTATE: closeRetry.code, finalClosureTasksReceiptV2: state });
        }
      }
      const rollbackRevision = (await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)}),0);`)).at(-1);
      const rollbackOp = uid(330), rollbackTitle = "M2.2C injected rollback one-off";
      const rollbackArgs = { contractVersion: 1, operationId: rollbackOp, kind: "task.createOneOff", expectedRevisions: { [`creation:${actor}`]: rollbackRevision }, payload: { ownerId: actor, companyId: company, teamId: team, source: { type: "custom", definition: { kind: "operativa", title: rollbackTitle, objective: "", sector: "Test", unit: "comprobantes" } }, scheduledOn, dueDate: null, priority: "Media" } };
      await observer.ok(`create function app_private.m22c_injected_failure() returns trigger language plpgsql set search_path='' as $$ begin if new.title='${rollbackTitle}' then raise exception using errcode='23514',message='synthetic C rollback'; end if; return new; end $$; create trigger m22c_injected_failure before insert on public.task_instances for each row execute function app_private.m22c_injected_failure();`);
      await claims({ role: "authenticated", sub: actor, aal: "aal1" });
      const failedCreation = await a.query(`select api.command_v1('${JSON.stringify(rollbackArgs).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(failedCreation.code, "23514", JSON.stringify(failedCreation));
      await a.ok("reset role;");
      const rollbackState = (await observer.ok(`select (select count(*) from public.task_assignments where owner_id=${lit(actor)} and title=${lit(rollbackTitle)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(rollbackOp)})||'|'||coalesce((select revision::text from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)}),'0');`)).at(-1);
      assert.equal(rollbackState, `0|0|${rollbackRevision}`, rollbackState);
      await observer.ok("drop trigger m22c_injected_failure on public.task_instances;drop function app_private.m22c_injected_failure();");
      const retriedCreation = await a.query(`select api.command_v1('${JSON.stringify(rollbackArgs).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(retriedCreation.code, "00000", JSON.stringify(retriedCreation));
      record("M2.2C one-off injected failure rolls back assignment, receipt and owner revision", true, { failureSQLSTATE: failedCreation.code, rollbackState, retrySQLSTATE: retriedCreation.code });
      await a.ok("reset role;");

      const catalogueRollbackTitle = "M2.2C injected catalogue rollback";
      const catalogueRollbackRevision = (await observer.ok(`select coalesce((select revision from app_private.api_catalogue_heads where organization_id=${lit(org)}),0);`)).at(-1);
      const catalogueRollbackOp = uid(851);
      const catalogueRollback = { contractVersion: 1, operationId: catalogueRollbackOp, kind: "catalogue.create", expectedRevisions: { [`catalogue:${org}`]: catalogueRollbackRevision }, payload: { definition: { kind: "operativa", title: catalogueRollbackTitle, objective: "", sector: "Test", unit: "archivos" }, effectiveOn: scheduledOn, reason: "Injected rollback" } };
      await observer.ok(`create function app_private.m22c_catalogue_failure() returns trigger language plpgsql set search_path='' as $$ begin if new.title='${catalogueRollbackTitle}' then raise exception using errcode='23514',message='synthetic catalogue rollback'; end if; return new; end $$; create trigger m22c_catalogue_failure before insert on public.task_template_versions for each row execute function app_private.m22c_catalogue_failure();`);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const failedCatalogue = await a.query(`select api.command_v1('${JSON.stringify(catalogueRollback).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(failedCatalogue.code, "23514", JSON.stringify(failedCatalogue)); await a.ok("reset role;");
      const catalogueRollbackState = (await observer.ok(`select (select count(*) from public.task_templates where organization_id=${lit(org)} and title=${lit(catalogueRollbackTitle)})||'|'||(select count(*) from public.task_template_versions where organization_id=${lit(org)} and title=${lit(catalogueRollbackTitle)})||'|'||coalesce((select revision::text from app_private.api_catalogue_heads where organization_id=${lit(org)}),'0')||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(catalogueRollbackOp)});`)).at(-1);
      assert.equal(catalogueRollbackState, `0|0|${catalogueRollbackRevision}|0`, catalogueRollbackState);
      await observer.ok("drop trigger m22c_catalogue_failure on public.task_template_versions;drop function app_private.m22c_catalogue_failure();");
      const retriedCatalogue = await a.query(`select api.command_v1('${JSON.stringify(catalogueRollback).replaceAll("'", "''")}'::jsonb);`); assert.equal(retriedCatalogue.code, "00000", JSON.stringify(retriedCatalogue)); await a.ok("reset role;");
      record("M2.2C injected catalogue failure rolls back template, version, epoch and receipt", true, { failureSQLSTATE: failedCatalogue.code, rollbackState: catalogueRollbackState, retrySQLSTATE: retriedCatalogue.code });

      const draftRollbackOwner = uid(852), draftRollbackOp = uid(853);
      await observer.ok(`insert into auth.users(id) values(${lit(draftRollbackOwner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(draftRollbackOwner)},${lit(org)},'Synthetic onboarding rollback','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(draftRollbackOwner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(draftRollbackOwner)}); create function app_private.m22c_onboarding_failure() returns trigger language plpgsql set search_path='' as $$ begin if new.owner_id='${draftRollbackOwner}' then raise exception using errcode='23514',message='synthetic onboarding rollback'; end if; return new; end $$; create trigger m22c_onboarding_failure before insert on public.onboarding_requests for each row execute function app_private.m22c_onboarding_failure();`);
      const draftRollback = { contractVersion: 1, operationId: draftRollbackOp, kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${draftRollbackOwner}`]: "0" }, payload: { requestId: null, draft: { ...requestDraft, lines: [{ ...requestDraft.lines[0], lineId: uid(854) }] } } };
      await claims({ role: "authenticated", sub: draftRollbackOwner, aal: "aal1" }, draftRollbackOwner);
      const failedDraft = await a.query(`select api.command_v1('${JSON.stringify(draftRollback).replaceAll("'", "''")}'::jsonb);`); assert.equal(failedDraft.code, "23514", JSON.stringify(failedDraft)); await a.ok("reset role;");
      const onboardingRollbackState = (await observer.ok(`select (select count(*) from public.onboarding_requests where organization_id=${lit(org)} and owner_id=${lit(draftRollbackOwner)})||'|'||(select count(*) from app_private.api_onboarding_owner_heads where organization_id=${lit(org)} and owner_id=${lit(draftRollbackOwner)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(draftRollbackOp)})||'|'||(select count(*) from public.audit_events where actor_id=${lit(draftRollbackOwner)} and action='onboarding.draft_saved');`)).at(-1);
      assert.equal(onboardingRollbackState, "0|0|0|0", onboardingRollbackState);
      await observer.ok("drop trigger m22c_onboarding_failure on public.onboarding_requests;drop function app_private.m22c_onboarding_failure();");
      const retriedDraft = await a.query(`select api.command_v1('${JSON.stringify(draftRollback).replaceAll("'", "''")}'::jsonb);`); assert.equal(retriedDraft.code, "00000", JSON.stringify(retriedDraft)); await a.ok("reset role;");
      record("M2.2C injected draft failure rolls back request, owner fence, receipt and audit", true, { failureSQLSTATE: failedDraft.code, rollbackState: onboardingRollbackState, retrySQLSTATE: retriedDraft.code });

      const materializeRollbackOwner = uid(855), materializeRollbackLine = uid(856), materializeRollbackSaveOp = uid(857), materializeRollbackSubmitOp = uid(858), materializeRollbackApproveOp = uid(859);
      await observer.ok(`insert into auth.users(id) values(${lit(materializeRollbackOwner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(materializeRollbackOwner)},${lit(org)},'Synthetic materialize rollback','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(materializeRollbackOwner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(materializeRollbackOwner)});`);
      const materializeRollbackDraft = { ...requestDraft, lines: [{ lineId: materializeRollbackLine, companyId: company, teamId: team, source: { type: "custom", definition: { kind: "operativa", title: "M2.2C materialize rollback", objective: "", sector: "Test", unit: "documentos" } }, schedule: { ...requestDraft.lines[0].schedule, frequency: "unica", startDate: scheduledOn, endDate: scheduledOn } }] };
      await claims({ role: "authenticated", sub: materializeRollbackOwner, aal: "aal1" }, materializeRollbackOwner);
      const materializeRollbackSaved = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: materializeRollbackSaveOp, kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${materializeRollbackOwner}`]: "0" }, payload: { requestId: null, draft: materializeRollbackDraft } }).replaceAll("'", "''")}'::jsonb);`); assert.equal(materializeRollbackSaved.code, "00000", JSON.stringify(materializeRollbackSaved));
      const materializeRollbackRequest = JSON.parse(materializeRollbackSaved.lines.at(-1)).result.requestId;
      const materializeRollbackSubmitted = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: materializeRollbackSubmitOp, kind: "onboarding.submit", expectedRevisions: { [`onboarding:${materializeRollbackRequest}`]: "0", [`onboardingDraft:${materializeRollbackRequest}`]: "1" }, payload: { requestId: materializeRollbackRequest } }).replaceAll("'", "''")}'::jsonb);`); assert.equal(materializeRollbackSubmitted.code, "00000", JSON.stringify(materializeRollbackSubmitted)); await a.ok("reset role;");
      await observer.ok(`create function app_private.m22c_materialize_failure() returns trigger language plpgsql set search_path='' as $$ begin if new.request_id='${materializeRollbackRequest}' then raise exception using errcode='23514',message='synthetic materialize rollback'; end if; return new; end $$; create trigger m22c_materialize_failure before insert on public.onboarding_activations for each row execute function app_private.m22c_materialize_failure();`);
      const materializeRollbackApprove = { contractVersion: 1, operationId: materializeRollbackApproveOp, kind: "onboarding.approve", expectedRevisions: { [`onboarding:${materializeRollbackRequest}`]: "1" }, payload: { requestId: materializeRollbackRequest, weightOverrides: [], period: monthPeriod } };
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const failedMaterialize = await a.query(`select api.command_v1('${JSON.stringify(materializeRollbackApprove).replaceAll("'", "''")}'::jsonb);`); assert.equal(failedMaterialize.code, "23514", JSON.stringify(failedMaterialize)); await a.ok("reset role;");
      const materializeRollbackState = (await observer.ok(`select (select count(*) from public.task_assignments where owner_id=${lit(materializeRollbackOwner)})||'|'||(select count(*) from public.task_instances where owner_id=${lit(materializeRollbackOwner)} and assignment_id in (select id from public.task_assignments where owner_id=${lit(materializeRollbackOwner)}))||'|'||(select count(*) from public.onboarding_activations where request_id=${lit(materializeRollbackRequest)})||'|'||(select status from public.onboarding_requests where id=${lit(materializeRollbackRequest)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(materializeRollbackApproveOp)})||'|'||(select count(*) from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(materializeRollbackOwner)});`)).at(-1);
      assert.equal(materializeRollbackState, "0|0|0|submitted|0|0", materializeRollbackState);
      await observer.ok("drop trigger m22c_materialize_failure on public.onboarding_activations;drop function app_private.m22c_materialize_failure();");
      const retriedMaterialize = await a.query(`select api.command_v1('${JSON.stringify(materializeRollbackApprove).replaceAll("'", "''")}'::jsonb);`); assert.equal(retriedMaterialize.code, "00000", JSON.stringify(retriedMaterialize)); await a.ok("reset role;");
      record("M2.2C injected approval/materialization failure rolls back assignments, occurrences, activation, receipt and owner revision", true, { failureSQLSTATE: failedMaterialize.code, rollbackState: materializeRollbackState, retrySQLSTATE: retriedMaterialize.code });

      const monthRollbackAssignment = uid(870), monthRollbackOp = uid(871), monthRollbackTitle = "M2.2C injected month materialize rollback";
      await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,measurement_version,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days)
        values(${lit(monthRollbackAssignment)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},${lit(monthRollbackTitle)},'operativa',null,'documentos',null,'unica',date_trunc('month',${lit(scheduledOn)}::date)::date,extract(day from ${lit(scheduledOn)}::date)::integer,'[]',2,${lit(scheduledOn)},${lit(scheduledOn)},1,array[1]::smallint[],extract(day from ${lit(scheduledOn)}::date)::smallint,true,0);
        create function app_private.m22c_month_materialize_failure() returns trigger language plpgsql set search_path='' as $$ begin if new.title='${monthRollbackTitle}' then raise exception using errcode='23514',message='synthetic month materialize rollback'; end if; return new; end $$;
        create trigger m22c_month_materialize_failure after insert on public.task_instances for each row execute function app_private.m22c_month_materialize_failure();`);
      const monthRollbackRevision = (await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)}),0);`)).at(-1);
      const monthRollbackCommand = { contractVersion: 1, operationId: monthRollbackOp, kind: "month.materialize", expectedRevisions: { [`creation:${actor}`]: monthRollbackRevision }, payload: { ownerId: actor, period: monthPeriod } };
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const failedMonthMaterialize = await a.query(`select api.command_v1('${JSON.stringify(monthRollbackCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(failedMonthMaterialize.code, "23514", JSON.stringify(failedMonthMaterialize)); await a.ok("reset role;");
      const monthRollbackState = (await observer.ok(`select (select count(*) from public.task_instances where assignment_id=${lit(monthRollbackAssignment)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(monthRollbackOp)})||'|'||coalesce((select revision::text from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(actor)}),'0');`)).at(-1);
      assert.equal(monthRollbackState, `0|0|${monthRollbackRevision}`, monthRollbackState);
      await observer.ok("drop trigger m22c_month_materialize_failure on public.task_instances;drop function app_private.m22c_month_materialize_failure();");
      const retriedMonthMaterialize = await a.query(`select api.command_v1('${JSON.stringify(monthRollbackCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(retriedMonthMaterialize.code, "00000", JSON.stringify(retriedMonthMaterialize)); await a.ok("reset role;");
      const monthRetryInstances = (await observer.ok(`select count(*) from public.task_instances where assignment_id=${lit(monthRollbackAssignment)} and period=${lit(monthPeriod)};`)).at(-1); assert.equal(monthRetryInstances, "1", monthRetryInstances);
      record("M2.2C injected month.materialize failure after occurrence insert rolls back occurrence, receipt and owner revision", true, { failureSQLSTATE: failedMonthMaterialize.code, rollbackState: monthRollbackState, retrySQLSTATE: retriedMonthMaterialize.code, retryInstances: monthRetryInstances });

      // A legacy timer started from an RR snapshot predating a membership revoke
      // must hit the same org/profile fence as API writers and fail stale.
      const membershipOwner = uid(889), membershipAssignment = uid(890), membershipTask = uid(891), membershipOp = uid(892), revokeOp = uid(893);
      await observer.ok(`insert into auth.users(id) values(${lit(membershipOwner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(membershipOwner)},${lit(org)},'M2.2C membership fence owner','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(membershipOwner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(membershipOwner)});insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day,checklist) values(${lit(membershipAssignment)},${lit(org)},${lit(company)},${lit(membershipOwner)},${lit(team)},'M2.2C membership stale timer','resultado',1,'mensual',${lit(monthPeriod)}::date,15,'[]');insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,checklist,status) values(${lit(membershipTask)},${lit(org)},${lit(membershipAssignment)},${lit(company)},${lit(membershipOwner)},${lit(team)},${lit(monthPeriod)}::date,${lit(scheduledOn)}::date,'M2.2C membership stale timer','resultado',1,null,'[]','Pendiente');`);
      const membershipFenceBefore = (await observer.ok(`select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(membershipOwner)};`)).at(-1);
      await claims({ role: "authenticated", sub: membershipOwner, aal: "aal1" }, membershipOwner);
      await a.ok(`begin isolation level repeatable read;select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(membershipOwner)};`);
      const membershipRevision = (await observer.ok(`select revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(membershipOwner)};`)).at(-1);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const revokeMembership = { contractVersion: 1, operationId: revokeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${membershipOwner}`]: membershipRevision }, payload: { companyId: company, profileId: membershipOwner, active: false, reason: "Native stale timer revocation" } };
      const revokeMembershipResult = await b.query(`select api.command_v1('${JSON.stringify(revokeMembership).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(revokeMembershipResult.code, "00000", JSON.stringify(revokeMembershipResult));
      const membershipFenceAfter = (await observer.ok(`select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(membershipOwner)};`)).at(-1);
      await b.ok("reset role;");
      await claims({ role: "authenticated", sub: membershipOwner, aal: "aal1" }, membershipOwner);
      const staleTimer = await a.query(`select public.start_task_timer(${lit(membershipTask)},0,${lit(membershipOp)},false);`);
      assert.equal(staleTimer.code, "40001", JSON.stringify({ result: staleTimer, membershipFenceBefore, membershipFenceAfter }));
      await a.ok("rollback;");
      const retryTimer = await a.query(`select public.start_task_timer(${lit(membershipTask)},0,${lit(membershipOp)},false);`);
      assert.equal(retryTimer.code, "P0001", JSON.stringify(retryTimer));
      await a.ok("reset role;");
      const membershipTimerState = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(membershipOwner)})||'|'||(select count(*) from public.task_time_sessions where instance_id=${lit(membershipTask)} and ended_at is null)||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(membershipOp)});`)).at(-1);
      assert.equal(membershipTimerState, "false|1|0|0", membershipTimerState);
      record("M2.2C membership revoke fences stale RR legacy timer and retry has no session", true, { staleSQLSTATE: staleTimer.code, retrySQLSTATE: retryTimer.code, revokeSQLSTATE: revokeMembershipResult.code, finalState: membershipTimerState });
      // A profile with two company memberships loses only the revoked company's
      // creation context; the second membership remains usable and visible.
      const multiOwner = uid(894), secondCompany = uid(895), multiRevokeOp = uid(896), taskA = uid(897), assignmentA = uid(898), taskB = uid(899), assignmentB = uid(900), assignmentNoBackfillA = uid(901), assignmentNoBackfillB = uid(902), multiClosure = uid(9094), multiReport = uid(9095), multiCoveragePlan = uid(9096), multiCoverageApprovalOp = uid(9097);
      await observer.ok(`insert into auth.users(id) values(${lit(multiOwner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(multiOwner)},${lit(org)},'M2.2C multi-company member','empleado','Test','Test','Test');insert into public.companies(id,organization_id,name) values(${lit(secondCompany)},${lit(org)},'M2.2C second company');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(multiOwner)}),(${lit(org)},${lit(secondCompany)},${lit(multiOwner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(multiOwner)});
        insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days)
        values(${lit(assignmentA)},${lit(org)},${lit(company)},${lit(multiOwner)},${lit(team)},'M2.2C company A existing','resultado',1,null,null,'unica',${lit(monthPeriod)}::date,extract(day from ${lit(scheduledOn)}::date)::integer,'[]',${lit(scheduledOn)}::date,${lit(scheduledOn)}::date,1,array[1]::smallint[],extract(day from ${lit(scheduledOn)}::date)::smallint,true,0),
              (${lit(assignmentB)},${lit(org)},${lit(secondCompany)},${lit(multiOwner)},${lit(team)},'M2.2C company B existing','resultado',1,null,null,'unica',${lit(monthPeriod)}::date,extract(day from ${lit(scheduledOn)}::date)::integer,'[]',${lit(scheduledOn)}::date,${lit(scheduledOn)}::date,1,array[1]::smallint[],extract(day from ${lit(scheduledOn)}::date)::smallint,true,0),
              (${lit(assignmentNoBackfillA)},${lit(org)},${lit(company)},${lit(multiOwner)},${lit(team)},'M2.2C company A lapse no backfill','resultado',1,null,null,'unica',${lit(monthPeriod)}::date,extract(day from ${lit(scheduledOn)}::date)::integer,'[]',${lit(scheduledOn)}::date,${lit(scheduledOn)}::date,1,array[1]::smallint[],extract(day from ${lit(scheduledOn)}::date)::smallint,true,0),
              (${lit(assignmentNoBackfillB)},${lit(org)},${lit(secondCompany)},${lit(multiOwner)},${lit(team)},'M2.2C company B materialize','resultado',1,null,null,'unica',${lit(monthPeriod)}::date,extract(day from ${lit(scheduledOn)}::date)::integer,'[]',${lit(scheduledOn)}::date,${lit(scheduledOn)}::date,1,array[1]::smallint[],extract(day from ${lit(scheduledOn)}::date)::smallint,true,0);
        insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
        values(${lit(taskA)},${lit(org)},${lit(assignmentA)},${lit(company)},${lit(multiOwner)},${lit(team)},${lit(monthPeriod)}::date,${lit(scheduledOn)}::date,'M2.2C company A existing','resultado',1,${lit(scheduledOn)}::date,null,null,'[]','Pendiente'),
              (${lit(taskB)},${lit(org)},${lit(assignmentB)},${lit(secondCompany)},${lit(multiOwner)},${lit(team)},${lit(monthPeriod)}::date,${lit(scheduledOn)}::date,'M2.2C company B existing','resultado',1,${lit(scheduledOn)}::date,null,null,'[]','Pendiente');`);
      const contextQuery = { contractVersion: 1, kind: "creationContext", filters: { ownerId: multiOwner }, cursor: null, limit: 1 };
      await observer.ok(`insert into public.task_coverage_plans(id,organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by,sealed) values(${lit(multiCoveragePlan)},${lit(org)},${lit(multiOwner)},${lit(actor)},${lit(scheduledOn)},${lit(scheduledOn)},'otra',${lit(boss)},false);
        insert into public.task_coverage_plan_instances(plan_id,organization_id,instance_id,company_id_snapshot,period_snapshot,responsibility_set_id) select ${lit(multiCoveragePlan)},${lit(org)},${lit(taskA)},${lit(company)},${lit(monthPeriod)}::date,h.set_id from public.task_responsibility_heads h where h.instance_id=${lit(taskA)};
        update public.task_coverage_plans set sealed=true,sealed_by=${lit(boss)},sealed_at=clock_timestamp() where id=${lit(multiCoveragePlan)};`);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const multiCoverageApproval = await b.query(`select public.approve_task_coverage_plan(${lit(multiCoveragePlan)},${lit(multiCoverageApprovalOp)});`);
      assert.equal(multiCoverageApproval.code, "00000", JSON.stringify(multiCoverageApproval));
      const multiCoverageBinding = (await observer.ok(`select id from public.task_coverage_bindings where instance_id=${lit(taskA)} and status='active';`)).at(-1);
      assert.notEqual(multiCoverageBinding, "", "coverage fixture must have an active binding");
      await claims({ role: "authenticated", sub: multiOwner, aal: "aal1" }, multiOwner);
      const beforeContext = await a.query(`select api.query_v1('${JSON.stringify(contextQuery).replaceAll("'", "''")}'::jsonb);`); assert.equal(beforeContext.code, "00000", JSON.stringify(beforeContext));
      const beforeCompanies = JSON.parse(beforeContext.lines.at(-1)).data.companies.map((x) => x.id).sort(); assert.deepEqual(beforeCompanies, [company, secondCompany].sort());
      const timerAStart = await a.query(`select public.start_task_timer(${lit(taskA)},0,${lit(uid(903))},false);`); assert.equal(timerAStart.code, "00000", JSON.stringify(timerAStart));
      await observer.ok(`insert into public.activity_entries(organization_id,instance_id,work_date,quantity,reference,actor_id) values(${lit(org)},${lit(taskA)},${lit(scheduledOn)},1,'M2.2C RLS privacy probe',${lit(multiOwner)});
        insert into public.monthly_closures(id,organization_id,owner_id,period,snapshot,closed_by,note) values(${lit(multiClosure)},${lit(org)},${lit(multiOwner)},'2027-01-01'::date,jsonb_build_object('tasks',jsonb_build_array(jsonb_build_object('taskId',${lit(taskA)}::text,'companyId',${lit(company)}::text),jsonb_build_object('taskId',${lit(taskB)}::text,'companyId',${lit(secondCompany)}::text)),'probe','immutable-membership-rls'),${lit(boss)},'M2.2C RLS probe');
        insert into public.period_reports(id,organization_id,closure_id,owner_id,period,snapshot) select ${lit(multiReport)},${lit(org)},id,${lit(multiOwner)},period,snapshot from public.monthly_closures where id=${lit(multiClosure)};`);
      const storedSnapshot = (await observer.ok(`select snapshot::text from public.period_reports where id=${lit(multiReport)};`)).at(-1);
      const rlsBefore = await a.ok(`select (select count(*) from public.activity_entries where instance_id=${lit(taskA)})||'|'||(select count(*) from public.task_time_sessions where instance_id=${lit(taskA)})||'|'||(select count(*) from public.company_memberships where profile_id=${lit(multiOwner)})||'|'||(select count(*) from public.monthly_closures where id=${lit(multiClosure)})||'|'||(select count(*) from public.period_reports where id=${lit(multiReport)});`);
      assert.equal(rlsBefore.at(-1), "1|1|2|1|1", JSON.stringify(rlsBefore));
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const multiRevoke = { contractVersion: 1, operationId: multiRevokeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${multiOwner}`]: "0" }, payload: { companyId: company, profileId: multiOwner, active: false, reason: "Keep the other company active" } };
      const multiRevokeResult = await b.query(`select api.command_v1('${JSON.stringify(multiRevoke).replaceAll("'", "''")}'::jsonb);`); assert.equal(multiRevokeResult.code, "00000", JSON.stringify(multiRevokeResult));
      await claims({ role: "authenticated", sub: multiOwner, aal: "aal1" }, multiOwner);
      const afterContext = await a.query(`select api.query_v1('${JSON.stringify(contextQuery).replaceAll("'", "''")}'::jsonb);`); assert.equal(afterContext.code, "00000", JSON.stringify(afterContext));
      const afterCompanies = JSON.parse(afterContext.lines.at(-1)).data.companies.map((x) => x.id); assert.deepEqual(afterCompanies, [secondCompany]);
      const rlsAfterRevoke = await a.ok(`select (select count(*) from public.activity_entries where instance_id=${lit(taskA)})||'|'||(select count(*) from public.task_time_sessions where instance_id=${lit(taskA)})||'|'||(select count(*) from public.company_memberships where profile_id=${lit(multiOwner)})||'|'||(select count(*) from public.monthly_closures where id=${lit(multiClosure)})||'|'||(select count(*) from public.period_reports where id=${lit(multiReport)});`);
      assert.equal(rlsAfterRevoke.at(-1), "0|0|1|0|0", JSON.stringify(rlsAfterRevoke));
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const bossClosureReport = await b.ok(`select (select count(*) from public.monthly_closures where id=${lit(multiClosure)})||'|'||(select count(*) from public.period_reports where id=${lit(multiReport)});`);
      assert.equal(bossClosureReport.at(-1), "1|1", JSON.stringify(bossClosureReport));
      await claims({ role: "authenticated", sub: multiOwner, aal: "aal1" }, multiOwner);
      const secondCompanyActive = (await observer.ok(`select active::text from public.company_memberships where company_id=${lit(secondCompany)} and profile_id=${lit(multiOwner)};`)).at(-1); assert.equal(secondCompanyActive, "true");
      const taskAccess = await a.ok(`select public.can_access_instance(${lit(taskA)})||'|'||public.can_access_instance(${lit(taskB)});`); assert.equal(taskAccess.at(-1), "false|true", JSON.stringify(taskAccess));
      const sessionState = (await observer.ok(`select (select count(*) from public.task_time_sessions where actor_id=${lit(multiOwner)} and instance_id=${lit(taskA)} and ended_at is null)::text||'|'||(select count(*) from public.task_time_sessions where actor_id=${lit(multiOwner)} and instance_id=${lit(taskA)} and ended_at is not null)::text;`)).at(-1); assert.equal(sessionState, "0|1", sessionState);
      const coverageAfterRevoke = (await observer.ok(`select status from public.task_coverage_bindings where id=${lit(multiCoverageBinding)};`)).at(-1); assert.equal(coverageAfterRevoke, "cancelled", coverageAfterRevoke);
      const deniedTimerA = await a.query(`select public.start_task_timer(${lit(taskA)},1,${lit(uid(904))},false);`); assert.equal(deniedTimerA.code, "P0001", JSON.stringify(deniedTimerA));
      const timerBStart = await a.query(`select public.start_task_timer(${lit(taskB)},0,${lit(uid(905))},false);`); assert.equal(timerBStart.code, "00000", JSON.stringify(timerBStart));
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const ownerCreationRevision = (await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(multiOwner)}),0);`)).at(-1);
      const materializeOp = uid(906), materialize = { contractVersion: 1, operationId: materializeOp, kind: "month.materialize", expectedRevisions: { [`creation:${multiOwner}`]: ownerCreationRevision }, payload: { ownerId: multiOwner, period: monthPeriod } };
      const materialized = await b.query(`select api.command_v1('${JSON.stringify(materialize).replaceAll("'", "''")}'::jsonb);`); assert.equal(materialized.code, "00000", JSON.stringify(materialized));
      const lapseInstances = (await observer.ok(`select (select count(*) from public.task_instances where assignment_id=${lit(assignmentNoBackfillA)} and period=${lit(monthPeriod)}::date)::text||'|'||(select count(*) from public.task_instances where assignment_id=${lit(assignmentNoBackfillB)} and period=${lit(monthPeriod)}::date)::text;`)).at(-1); assert.equal(lapseInstances, "0|1", lapseInstances);
      const restore = { contractVersion: 1, operationId: uid(907), kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${multiOwner}`]: "1" }, payload: { companyId: company, profileId: multiOwner, active: true, reason: "Restore after lapse" } };
      const restored = await b.query(`select api.command_v1('${JSON.stringify(restore).replaceAll("'", "''")}'::jsonb);`); assert.equal(restored.code, "00000", JSON.stringify(restored));
      const restoredAccess = await a.query(`select public.can_access_instance(${lit(taskA)});`); assert.equal(restoredAccess.lines.at(-1), "t", JSON.stringify(restoredAccess));
      const coverageAfterRestore = (await observer.ok(`select status from public.task_coverage_bindings where id=${lit(multiCoverageBinding)};`)).at(-1); assert.equal(coverageAfterRestore, "cancelled", coverageAfterRestore);
      const rlsAfterRestore = await a.ok(`select (select count(*) from public.activity_entries where instance_id=${lit(taskA)})||'|'||(select count(*) from public.task_time_sessions where instance_id=${lit(taskA)})||'|'||(select count(*) from public.monthly_closures where id=${lit(multiClosure)})||'|'||(select count(*) from public.period_reports where id=${lit(multiReport)})||'|'||(select snapshot::text from public.period_reports where id=${lit(multiReport)});`);
      assert.equal(rlsAfterRestore.at(-1), `1|1|1|1|${storedSnapshot}`, JSON.stringify(rlsAfterRestore));
      const creationRevisionAfter = (await observer.ok(`select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(multiOwner)};`)).at(-1);
      const rematerialize = { ...materialize, operationId: uid(908), expectedRevisions: { [`creation:${multiOwner}`]: creationRevisionAfter } };
      const rematerialized = await b.query(`select api.command_v1('${JSON.stringify(rematerialize).replaceAll("'", "''")}'::jsonb);`); assert.equal(rematerialized.code, "00000", JSON.stringify(rematerialized));
      const finalInstances = (await observer.ok(`select (select count(*) from public.task_instances where assignment_id=${lit(assignmentNoBackfillA)} and period=${lit(monthPeriod)}::date)::text||'|'||(select count(*) from public.task_instances where assignment_id=${lit(assignmentNoBackfillB)} and period=${lit(monthPeriod)}::date)::text;`)).at(-1); assert.equal(finalInstances, "0|1", finalInstances);
      record("M2.2C one-of-two company revoke preserves B, stops A timer once, cancels live coverage without restore resurrection, authenticated RLS hides revoked activity/session/membership and whole multi-company closure/report, restore preserves snapshot without backfill", true, { initialCompanies: beforeCompanies, remainingCompanies: afterCompanies, secondCompanyActive, taskAccess: taskAccess.at(-1), stoppedSession: sessionState, coverageAfterRevoke, coverageAfterRestore, deniedTimerA: deniedTimerA.code, timerBStart: timerBStart.code, firstMaterializeSQLSTATE: materialized.code, instancesDuringLapse: lapseInstances, rlsBefore: rlsBefore.at(-1), rlsAfterRevoke: rlsAfterRevoke.at(-1), bossClosureReport: bossClosureReport.at(-1), rlsAfterRestore: rlsAfterRestore.at(-1), restoredSQLSTATE: restored.code, restoredAAccess: restoredAccess.lines.at(-1), rematerializeSQLSTATE: rematerialized.code, finalInstances });
      // A fresh assignment command that planned its owner membership before a
      // revoke must stale-abort, then deny on retry without assignment/receipt.
      const assignmentOwner = uid(909), revokeAssignmentOp = uid(910), createAssignmentOp = uid(911);
      await observer.ok(`insert into auth.users(id) values(${lit(assignmentOwner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(assignmentOwner)},${lit(org)},'M2.2C revoke assignment owner','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(assignmentOwner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(assignmentOwner)});`);
      const creationRev = (await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(assignmentOwner)}),0);`)).at(-1);
      const assignmentTemplate = JSON.parse(standardCall.lines.at(-1)).result;
      const createAssignmentCommand = { contractVersion: 1, operationId: createAssignmentOp, kind: "assignment.create", expectedRevisions: { [`creation:${assignmentOwner}`]: creationRev, [`catalogue:${assignmentTemplate.templateId}`]: "1" }, payload: { ownerId: assignmentOwner, companyId: company, teamId: team, source: { type: "catalogue", templateVersionId: assignmentTemplate.versionId }, schedule: { frequency: "mensual", startDate: scheduledOn, endDate: null, interval: 1, weekdays: [], monthDay: dayOfMonth, hasDeadline: true, dueOffsetDays: 0 } } };
      const revokeAssignment = { contractVersion: 1, operationId: revokeAssignmentOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${assignmentOwner}`]: "0" }, payload: { companyId: company, profileId: assignmentOwner, active: false, reason: "Revoke-first assignment race" } };
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      await a.ok("begin isolation level read committed;");
      const revokeAssignmentResult = await a.query(`select api.command_v1('${JSON.stringify(revokeAssignment).replaceAll("'", "''")}'::jsonb);`); assert.equal(revokeAssignmentResult.code, "00000", JSON.stringify(revokeAssignmentResult));
      const revokeAssignmentPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(assignmentOwner)};`);
      const createAssignmentPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const pendingAssignment = b.query(`select api.command_v1('${JSON.stringify(createAssignmentCommand).replaceAll("'", "''")}'::jsonb);`);
      let assignmentBlocked = false; const assignmentDeadline = Date.now() + 10000; while (Date.now() < assignmentDeadline) { if ((await observer.ok(`select ${revokeAssignmentPid}=any(pg_catalog.pg_blocking_pids(${createAssignmentPid}));`)).at(-1) === "t") { assignmentBlocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
      await a.ok("commit;"); const staleAssignment = await pendingAssignment; await b.ok(staleAssignment.code === "00000" ? "commit;" : "rollback;"); assert.equal(assignmentBlocked, true); assert.equal(staleAssignment.code, "40001", JSON.stringify(staleAssignment));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
      const assignmentRetry = await b.query(`select api.command_v1('${JSON.stringify(createAssignmentCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(assignmentRetry.code, "42501", JSON.stringify(assignmentRetry)); await a.ok("reset role;"); await b.ok("reset role;");
      const assignmentRaceState = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where profile_id=${lit(assignmentOwner)} and company_id=${lit(company)})||'|'||(select count(*) from public.task_assignments where owner_id=${lit(assignmentOwner)} and company_id=${lit(company)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(createAssignmentOp)})||'|'||coalesce((select revision::text from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(assignmentOwner)}),'0');`)).at(-1); assert.equal(assignmentRaceState, "false|1|0|0|0", assignmentRaceState);
      record("M2.2C revoke-first membership fence stale-aborts assignment.create and retry denies without partial writes", true, { blocked: assignmentBlocked, revokeSQLSTATE: revokeAssignmentResult.code, staleSQLSTATE: staleAssignment.code, retrySQLSTATE: assignmentRetry.code, finalState: assignmentRaceState });

      const materializeOwner = uid(912), materializeAssignment = uid(913), revokeMaterializeOp = uid(914), inactiveMaterializeOp = uid(915);
      await observer.ok(`insert into auth.users(id) values(${lit(materializeOwner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(materializeOwner)},${lit(org)},'M2.2C revoke materialize owner','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(materializeOwner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(materializeOwner)});insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days) values(${lit(materializeAssignment)},${lit(org)},${lit(company)},${lit(materializeOwner)},${lit(team)},'M2.2C revoked materialization','resultado',1,null,null,'unica',${lit(monthPeriod)}::date,extract(day from ${lit(scheduledOn)}::date)::integer,'[]',${lit(scheduledOn)}::date,${lit(scheduledOn)}::date,1,array[1]::smallint[],extract(day from ${lit(scheduledOn)}::date)::smallint,true,0);`);
      const materializeForInactiveOwner = { contractVersion: 1, operationId: inactiveMaterializeOp, kind: "month.materialize", expectedRevisions: { [`creation:${materializeOwner}`]: "0" }, payload: { ownerId: materializeOwner, period: monthPeriod } };
      const revokeMaterialize = { contractVersion: 1, operationId: revokeMaterializeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${materializeOwner}`]: "0" }, payload: { companyId: company, profileId: materializeOwner, active: false, reason: "Revoke-first materialization race" } };
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      await a.ok("begin isolation level read committed;");
      const revokeMaterializeResult = await a.query(`select api.command_v1('${JSON.stringify(revokeMaterialize).replaceAll("'", "''")}'::jsonb);`); assert.equal(revokeMaterializeResult.code, "00000", JSON.stringify(revokeMaterializeResult));
      const revokeMaterializePid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(materializeOwner)};`);
      const materializePid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const pendingMaterialize = b.query(`select api.command_v1('${JSON.stringify(materializeForInactiveOwner).replaceAll("'", "''")}'::jsonb);`);
      let materializeBlocked = false; const materializeDeadline = Date.now() + 10000; while (Date.now() < materializeDeadline) { if ((await observer.ok(`select ${revokeMaterializePid}=any(pg_catalog.pg_blocking_pids(${materializePid}));`)).at(-1) === "t") { materializeBlocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
      await a.ok("commit;"); const staleMaterialize = await pendingMaterialize; await b.ok(staleMaterialize.code === "00000" ? "commit;" : "rollback;"); assert.equal(materializeBlocked, true); assert.equal(staleMaterialize.code, "40001", JSON.stringify(staleMaterialize));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
      const materializeRetry = await b.query(`select api.command_v1('${JSON.stringify(materializeForInactiveOwner).replaceAll("'", "''")}'::jsonb);`); assert.equal(materializeRetry.code, "00000", JSON.stringify(materializeRetry)); await a.ok("reset role;"); await b.ok("reset role;");
      const materializeRaceState = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where profile_id=${lit(materializeOwner)} and company_id=${lit(company)})||'|'||(select count(*) from public.task_instances where assignment_id=${lit(materializeAssignment)} and period=${lit(monthPeriod)}::date)||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(inactiveMaterializeOp)});`)).at(-1); assert.equal(materializeRaceState, "false|1|0|1", materializeRaceState);
      record("M2.2C revoke-first membership fence stale-aborts month.materialize and retry creates no occurrence", true, { blocked: materializeBlocked, revokeSQLSTATE: revokeMaterializeResult.code, staleSQLSTATE: staleMaterialize.code, retrySQLSTATE: materializeRetry.code, finalState: materializeRaceState });

      // A materializer that wins the shared owner fence must be visible to a
      // waiting membership revocation plan; stale RR aborts, retry includes and
      // revises the newly materialized task.
      const materializeFirstOwner = uid(9500), materializeFirstAssignment = uid(9501), materializeFirstOp = uid(9502), revokeAfterMaterializeOp = uid(9503);
      await observer.ok(`insert into auth.users(id) values(${lit(materializeFirstOwner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(materializeFirstOwner)},${lit(org)},'M2.2C materialize-first revoke owner','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(materializeFirstOwner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(materializeFirstOwner)});
        insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days) values(${lit(materializeFirstAssignment)},${lit(org)},${lit(company)},${lit(materializeFirstOwner)},${lit(team)},'M2.2C materialize-first membership revoke','resultado',1,null,null,'unica',${lit(monthPeriod)}::date,extract(day from ${lit(scheduledOn)}::date)::integer,'[]',${lit(scheduledOn)}::date,${lit(scheduledOn)}::date,1,array[1]::smallint[],extract(day from ${lit(scheduledOn)}::date)::smallint,true,0);`);
      const materializeFirstRevision = (await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(materializeFirstOwner)}),0);`)).at(-1);
      const materializeFirstCommand = { contractVersion: 1, operationId: materializeFirstOp, kind: "month.materialize", expectedRevisions: { [`creation:${materializeFirstOwner}`]: materializeFirstRevision }, payload: { ownerId: materializeFirstOwner, period: monthPeriod } };
      const revokeAfterMaterialize = { contractVersion: 1, operationId: revokeAfterMaterializeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${materializeFirstOwner}`]: "0" }, payload: { companyId: company, profileId: materializeFirstOwner, active: false, reason: "Materialize-first membership revoke" } };
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      await a.ok("begin isolation level read committed;"); const materializeFirstPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const materializeFirstResult = await a.query(`select api.command_v1('${JSON.stringify(materializeFirstCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(materializeFirstResult.code, "00000", JSON.stringify(materializeFirstResult));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(materializeFirstOwner)};`);
      const revokeAfterMaterializePid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const pendingRevokeAfterMaterialize = b.query(`select api.command_v1('${JSON.stringify(revokeAfterMaterialize).replaceAll("'", "''")}'::jsonb);`);
      let revokeAfterMaterializeBlocked = false; const revokeAfterMaterializeDeadline = Date.now() + 10000;
      while (Date.now() < revokeAfterMaterializeDeadline) { if ((await observer.ok(`select ${materializeFirstPid}=any(pg_catalog.pg_blocking_pids(${revokeAfterMaterializePid}));`)).at(-1) === "t") { revokeAfterMaterializeBlocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
      await a.ok("commit;"); const staleRevokeAfterMaterialize = await pendingRevokeAfterMaterialize; await b.ok(staleRevokeAfterMaterialize.code === "00000" ? "commit;" : "rollback;");
      assert.equal(revokeAfterMaterializeBlocked, true); assert.equal(staleRevokeAfterMaterialize.code, "40001", JSON.stringify(staleRevokeAfterMaterialize));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
      const retryRevokeAfterMaterialize = await b.query(`select api.command_v1('${JSON.stringify(revokeAfterMaterialize).replaceAll("'", "''")}'::jsonb);`); assert.equal(retryRevokeAfterMaterialize.code, "00000", JSON.stringify(retryRevokeAfterMaterialize)); await a.ok("reset role;"); await b.ok("reset role;");
      const materializeFirstFinal = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where profile_id=${lit(materializeFirstOwner)} and company_id=${lit(company)})||'|'||(select count(*) from public.task_instances where assignment_id=${lit(materializeFirstAssignment)} and period=${lit(monthPeriod)}::date)||'|'||(select state_revision from public.task_instances where assignment_id=${lit(materializeFirstAssignment)} and period=${lit(monthPeriod)}::date)||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(revokeAfterMaterializeOp)})||'|'||(select count(*) from app_private.company_membership_events where profile_id=${lit(materializeFirstOwner)} and company_id=${lit(company)});`)).at(-1);
      assert.equal(materializeFirstFinal, "false|1|1|1|1|1", materializeFirstFinal);
      record("M2.2C materialize-first then membership revoke waits, stale RR plan aborts, retry includes new occurrence", true, { blocked: revokeAfterMaterializeBlocked, materializeSQLSTATE: materializeFirstResult.code, staleRevocationSQLSTATE: staleRevokeAfterMaterialize.code, retrySQLSTATE: retryRevokeAfterMaterialize.code, finalState: materializeFirstFinal });

      // An assignment writer that wins the shared owner fence must be visible
      // to a waiting RR membership revocation plan.
      const assignmentFirstOwner = uid(9600), assignmentFirstOp = uid(9601), revokeAfterAssignmentOp = uid(9602);
      await observer.ok(`insert into auth.users(id) values(${lit(assignmentFirstOwner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(assignmentFirstOwner)},${lit(org)},'M2.2C assignment-first revoke owner','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(assignmentFirstOwner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(assignmentFirstOwner)});`);
      const assignmentFirstCreationRev = (await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(assignmentFirstOwner)}),0);`)).at(-1);
      const assignmentFirstCommand = { contractVersion: 1, operationId: assignmentFirstOp, kind: "assignment.create", expectedRevisions: { [`creation:${assignmentFirstOwner}`]: assignmentFirstCreationRev, [`catalogue:${assignmentTemplate.templateId}`]: "1" }, payload: { ownerId: assignmentFirstOwner, companyId: company, teamId: team, source: { type: "catalogue", templateVersionId: assignmentTemplate.versionId }, schedule: { frequency: "mensual", startDate: scheduledOn, endDate: null, interval: 1, weekdays: [], monthDay: dayOfMonth, hasDeadline: true, dueOffsetDays: 0 } } };
      const revokeAfterAssignment = { contractVersion: 1, operationId: revokeAfterAssignmentOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${assignmentFirstOwner}`]: "0" }, payload: { companyId: company, profileId: assignmentFirstOwner, active: false, reason: "Assignment-first membership revoke" } };
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      await a.ok("begin isolation level read committed;"); const assignmentFirstPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const assignmentFirstResult = await a.query(`select api.command_v1('${JSON.stringify(assignmentFirstCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(assignmentFirstResult.code, "00000", JSON.stringify(assignmentFirstResult));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(assignmentFirstOwner)};`);
      const revokeAfterAssignmentPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const pendingRevokeAfterAssignment = b.query(`select api.command_v1('${JSON.stringify(revokeAfterAssignment).replaceAll("'", "''")}'::jsonb);`);
      let revokeAfterAssignmentBlocked = false; const revokeAfterAssignmentDeadline = Date.now() + 10000;
      while (Date.now() < revokeAfterAssignmentDeadline) { if ((await observer.ok(`select ${assignmentFirstPid}=any(pg_catalog.pg_blocking_pids(${revokeAfterAssignmentPid}));`)).at(-1) === "t") { revokeAfterAssignmentBlocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
      await a.ok("commit;"); const staleRevokeAfterAssignment = await pendingRevokeAfterAssignment; await b.ok(staleRevokeAfterAssignment.code === "00000" ? "commit;" : "rollback;");
      assert.equal(revokeAfterAssignmentBlocked, true); assert.equal(staleRevokeAfterAssignment.code, "40001", JSON.stringify(staleRevokeAfterAssignment));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
      const retryRevokeAfterAssignment = await b.query(`select api.command_v1('${JSON.stringify(revokeAfterAssignment).replaceAll("'", "''")}'::jsonb);`); assert.equal(retryRevokeAfterAssignment.code, "00000", JSON.stringify(retryRevokeAfterAssignment)); await a.ok("reset role;"); await b.ok("reset role;");
      const assignmentFirstFinal = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where profile_id=${lit(assignmentFirstOwner)} and company_id=${lit(company)})||'|'||(select count(*) from public.task_assignments where owner_id=${lit(assignmentFirstOwner)} and company_id=${lit(company)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(assignmentFirstOp)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(revokeAfterAssignmentOp)})||'|'||(select count(*) from app_private.company_membership_events where profile_id=${lit(assignmentFirstOwner)} and company_id=${lit(company)});`)).at(-1);
      assert.equal(assignmentFirstFinal, "false|1|1|1|1|1", assignmentFirstFinal);
      record("M2.2C assignment-first then membership revoke waits, stale RR plan aborts, retry includes new assignment", true, { blocked: revokeAfterAssignmentBlocked, assignmentSQLSTATE: assignmentFirstResult.code, staleRevocationSQLSTATE: staleRevokeAfterAssignment.code, retrySQLSTATE: retryRevokeAfterAssignment.code, finalState: assignmentFirstFinal });

      // A task transition winning the owner fence must serialize against the
      // same membership revocation plan and preserve the transition on retry.
      const transitionOwner = uid(9610), transitionAssignment = uid(9611), transitionTask = uid(9612), transitionOp = uid(9613), revokeAfterTransitionOp = uid(9614);
      await observer.ok(`insert into auth.users(id) values(${lit(transitionOwner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(transitionOwner)},${lit(org)},'M2.2C transition-first revoke owner','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(transitionOwner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(transitionOwner)});insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day,checklist) values(${lit(transitionAssignment)},${lit(org)},${lit(company)},${lit(transitionOwner)},${lit(team)},'M2.2C transition-first membership revoke','resultado',1,'mensual',${lit(monthPeriod)}::date,15,'[]');insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,checklist,status) values(${lit(transitionTask)},${lit(org)},${lit(transitionAssignment)},${lit(company)},${lit(transitionOwner)},${lit(team)},${lit(monthPeriod)}::date,${lit(scheduledOn)}::date,'M2.2C transition-first membership revoke','resultado',1,null,'[]','Pendiente');`);
      const transitionCommand = { contractVersion: 1, operationId: transitionOp, kind: "task.transition", expectedRevisions: { [`task:${transitionTask}`]: "0" }, payload: { taskId: transitionTask, status: "En curso", reason: null, confirmCommercialCompletion: false } };
      const revokeAfterTransition = { contractVersion: 1, operationId: revokeAfterTransitionOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${transitionOwner}`]: "0" }, payload: { companyId: company, profileId: transitionOwner, active: false, reason: "Transition-first membership revoke" } };
      await claims({ role: "authenticated", sub: transitionOwner, aal: "aal1" }, transitionOwner);
      await a.ok("begin isolation level read committed;"); const transitionFirstPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const transitionFirstResult = await a.query(`select api.command_v1('${JSON.stringify(transitionCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(transitionFirstResult.code, "00000", JSON.stringify(transitionFirstResult));
      const transitionReplayEpochSql = `select coalesce((select fence_epoch::text from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(transitionOwner)}),'0')||'|'||coalesce((select fence_epoch::text from app_private.api_operation_fences where actor_id=${lit(transitionOwner)} and operation_id=${lit(transitionOp)}),'0')||'|'||coalesce((select fence_epoch::text from app_private.api_month_fences where organization_id=${lit(org)} and owner_id=${lit(transitionOwner)} and period=${lit(monthPeriod)}::date),'0')||'|'||coalesce((select fence_epoch::text from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period=${lit(monthPeriod)}::date),'0')||'|'||(select count(*) from public.audit_events where organization_id=${lit(org)} and actor_id=${lit(transitionOwner)} and action='task.tracking.command' and entity_id=${lit(transitionTask)})||'|'||(select count(*) from app_private.api_command_receipts where actor_id=${lit(transitionOwner)} and operation_id=${lit(transitionOp)})||'|'||(select count(*) from app_private.task_tracking_events where organization_id=${lit(org)} and instance_id=${lit(transitionTask)});`;
      await a.ok("reset role;");
      const transitionReplayFencesBefore = (await a.ok(transitionReplayEpochSql)).at(-1);
      await a.ok("set role authenticated;");
      const transitionReplayResult = await a.query(`select api.command_v1('${JSON.stringify(transitionCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(transitionReplayResult.code, "00000", JSON.stringify(transitionReplayResult));
      await a.ok("reset role;");
      const transitionReplayFencesAfter = (await a.ok(transitionReplayEpochSql)).at(-1); assert.equal(transitionReplayFencesAfter, transitionReplayFencesBefore, transitionReplayFencesAfter);
      await a.ok("set role authenticated;");
      record("M2.2C exact task.transition replay reauthorizes and returns before writing membership, operation, month, graph, audit, receipt or event state", true, { replaySQLSTATE: transitionReplayResult.code, fencesAndCountsBefore: transitionReplayFencesBefore, fencesAndCountsAfter: transitionReplayFencesAfter });
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(transitionOwner)};`);
      const revokeAfterTransitionPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const pendingRevokeAfterTransition = b.query(`select api.command_v1('${JSON.stringify(revokeAfterTransition).replaceAll("'", "''")}'::jsonb);`);
      let revokeAfterTransitionBlocked = false; const revokeAfterTransitionDeadline = Date.now() + 10000;
      while (Date.now() < revokeAfterTransitionDeadline) { if ((await observer.ok(`select ${transitionFirstPid}=any(pg_catalog.pg_blocking_pids(${revokeAfterTransitionPid}));`)).at(-1) === "t") { revokeAfterTransitionBlocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
      await a.ok("commit;"); const staleRevokeAfterTransition = await pendingRevokeAfterTransition; await b.ok(staleRevokeAfterTransition.code === "00000" ? "commit;" : "rollback;");
      assert.equal(revokeAfterTransitionBlocked, true); assert.equal(staleRevokeAfterTransition.code, "40001", JSON.stringify(staleRevokeAfterTransition));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
      const retryRevokeAfterTransition = await b.query(`select api.command_v1('${JSON.stringify(revokeAfterTransition).replaceAll("'", "''")}'::jsonb);`); assert.equal(retryRevokeAfterTransition.code, "00000", JSON.stringify(retryRevokeAfterTransition)); await a.ok("reset role;"); await b.ok("reset role;");
      const transitionFirstFinal = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where profile_id=${lit(transitionOwner)} and company_id=${lit(company)})||'|'||(select status||'|'||state_revision from public.task_instances where id=${lit(transitionTask)})||'|'||(select count(*) from public.task_time_sessions where instance_id=${lit(transitionTask)} and ended_at is null)||'|'||(select count(*) from app_private.api_command_receipts where operation_id in (${lit(transitionOp)},${lit(revokeAfterTransitionOp)}))||'|'||(select count(*) from app_private.company_membership_events where profile_id=${lit(transitionOwner)} and company_id=${lit(company)});`)).at(-1);
      assert.equal(transitionFirstFinal, "false|1|En curso|2|0|2|1", transitionFirstFinal);
      record("M2.2C task.transition-first then membership revoke waits, stale RR plan aborts, retry preserves state and revisions once", true, { blocked: revokeAfterTransitionBlocked, transitionSQLSTATE: transitionFirstResult.code, staleRevocationSQLSTATE: staleRevokeAfterTransition.code, retrySQLSTATE: retryRevokeAfterTransition.code, finalState: transitionFirstFinal });

      // The legacy schema has one-open-session-per-actor globally (001), and
      // migration 011 adds a unique actor+instance index. Revoke one actor
      // while a different eligible actor has a session.
      const sessionOwner = uid(9620), sessionPeer = uid(9621), sessionAssignmentA = uid(9622), sessionAssignmentB = uid(9623), sessionTaskA = uid(9624), sessionTaskB = uid(9625), revokeSessionsOp = uid(9626);
      await observer.ok(`insert into auth.users(id) values(${lit(sessionOwner)}),(${lit(sessionPeer)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(sessionOwner)},${lit(org)},'M2.2C session revoke owner','empleado','Test','Test','Test'),(${lit(sessionPeer)},${lit(org)},'M2.2C session peer','empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(sessionOwner)}),(${lit(org)},${lit(company)},${lit(sessionPeer)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(sessionOwner)}),(${lit(org)},${lit(team)},${lit(sessionPeer)});insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day,checklist) values(${lit(sessionAssignmentA)},${lit(org)},${lit(company)},${lit(sessionOwner)},${lit(team)},'M2.2C session revoke owner task','resultado',1,'mensual',${lit(monthPeriod)}::date,15,'[]'),(${lit(sessionAssignmentB)},${lit(org)},${lit(company)},${lit(sessionPeer)},${lit(team)},'M2.2C session peer task','resultado',1,'mensual',${lit(monthPeriod)}::date,15,'[]');insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,checklist,status) values(${lit(sessionTaskA)},${lit(org)},${lit(sessionAssignmentA)},${lit(company)},${lit(sessionOwner)},${lit(team)},${lit(monthPeriod)}::date,${lit(scheduledOn)}::date,'M2.2C session revoke owner task','resultado',1,null,'[]','En curso'),(${lit(sessionTaskB)},${lit(org)},${lit(sessionAssignmentB)},${lit(company)},${lit(sessionPeer)},${lit(team)},${lit(monthPeriod)}::date,${lit(scheduledOn)}::date,'M2.2C session peer task','resultado',1,null,'[]','En curso');insert into public.task_time_sessions(organization_id,instance_id,actor_id,started_at) values(${lit(org)},${lit(sessionTaskA)},${lit(sessionOwner)},clock_timestamp()-interval '5 minutes'),(${lit(org)},${lit(sessionTaskB)},${lit(sessionPeer)},clock_timestamp()-interval '4 minutes');`);
      const revokeSessions = { contractVersion: 1, operationId: revokeSessionsOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${sessionOwner}`]: "0" }, payload: { companyId: company, profileId: sessionOwner, active: false, reason: "Stop only revoked member session" } };
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const revokeSessionsResult = await a.query(`select api.command_v1('${JSON.stringify(revokeSessions).replaceAll("'", "''")}'::jsonb);`); assert.equal(revokeSessionsResult.code, "00000", JSON.stringify(revokeSessionsResult));
      const sessionFenceAfter = (await observer.ok(`select coalesce((select fence_epoch::text from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(sessionOwner)}),'0');`)).at(-1);
      const sessionGraphAfter = (await observer.ok(`select coalesce((select fence_epoch::text from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period=${lit(monthPeriod)}::date),'0');`)).at(-1);
      const replaySessionsResult = await a.query(`select api.command_v1('${JSON.stringify(revokeSessions).replaceAll("'", "''")}'::jsonb);`); assert.equal(replaySessionsResult.code, "00000", JSON.stringify(replaySessionsResult));
      const sessionFenceReplay = (await observer.ok(`select coalesce((select fence_epoch::text from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(sessionOwner)}),'0');`)).at(-1);
      const sessionGraphReplay = (await observer.ok(`select coalesce((select fence_epoch::text from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period=${lit(monthPeriod)}::date),'0');`)).at(-1);
      const sessionAuditCount = (await observer.ok(`select count(*) from public.audit_events where action='companyMembership.setActive' and entity_id=${lit(company)} and details->>'profileId'=${lit(sessionOwner)};`)).at(-1);
      const memberReceiptQuery = { contractVersion: 1, kind: "commandReceipt", filters: { operationId: revokeSessionsOp }, cursor: null, limit: 1 };
      const memberReceiptAllowed = await a.query(`select api.query_v1('${JSON.stringify(memberReceiptQuery).replaceAll("'", "''")}'::jsonb);`); assert.equal(memberReceiptAllowed.code, "00000", JSON.stringify(memberReceiptAllowed));
      const memberReceiptAllowedData = JSON.parse(memberReceiptAllowed.lines.at(-1)); assert.equal(memberReceiptAllowedData.data.found, true, JSON.stringify(memberReceiptAllowedData)); assert.equal(memberReceiptAllowedData.data.command.kind, "companyMembership.setActive");
      await claims({ role: "authenticated", sub: sessionPeer, aal: "aal1" }, sessionPeer);
      const memberReceiptOtherActor = await a.query(`select api.query_v1('${JSON.stringify(memberReceiptQuery).replaceAll("'", "''")}'::jsonb);`); assert.equal(memberReceiptOtherActor.code, "00000", JSON.stringify(memberReceiptOtherActor)); assert.equal(JSON.parse(memberReceiptOtherActor.lines.at(-1)).data.found, false);
      await claims({ role: "authenticated", sub: boss, aal: "aal1" }, boss);
      const memberReceiptAal1 = await a.query(`select api.query_v1('${JSON.stringify(memberReceiptQuery).replaceAll("'", "''")}'::jsonb);`); assert.equal(memberReceiptAal1.code, "42501", JSON.stringify(memberReceiptAal1));
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const memberNoopOp = uid(9627), memberNoop = { contractVersion: 1, operationId: memberNoopOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${sessionPeer}`]: "0" }, payload: { companyId: company, profileId: sessionPeer, active: true, reason: "No-op active membership" } };
      const memberNoopEpochSql = `select coalesce((select fence_epoch::text from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(sessionPeer)}),'0')||'|'||coalesce((select fence_epoch::text from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period=${lit(monthPeriod)}::date),'0')||'|'||(select count(*) from app_private.company_membership_events where profile_id=${lit(sessionPeer)} and company_id=${lit(company)})||'|'||(select count(*) from public.audit_events where action='companyMembership.setActive' and entity_id=${lit(company)} and details->>'profileId'=${lit(sessionPeer)})||'|'||(select count(*) from app_private.api_operation_fences where actor_id=${lit(boss)} and operation_id=${lit(memberNoopOp)})||'|'||(select count(*) from app_private.api_command_receipts where actor_id=${lit(boss)} and operation_id=${lit(memberNoopOp)});`;
      const memberNoopBefore = (await observer.ok(memberNoopEpochSql)).at(-1);
      const memberNoopResult = await a.query(`select api.command_v1('${JSON.stringify(memberNoop).replaceAll("'", "''")}'::jsonb);`); assert.equal(memberNoopResult.code, "00000", JSON.stringify(memberNoopResult));
      const memberNoopAfter = (await observer.ok(memberNoopEpochSql)).at(-1); assert.equal(memberNoopAfter, memberNoopBefore.replace(/\|0\|0$/, "|0|1"), `${memberNoopBefore} -> ${memberNoopAfter}`);
      const sessionRevokeFinal = (await observer.ok(`select (select count(*) from public.task_time_sessions where instance_id=${lit(sessionTaskA)} and actor_id=${lit(sessionOwner)} and ended_at is null)::text||'|'||(select count(*) from public.task_time_sessions where instance_id=${lit(sessionTaskA)} and actor_id=${lit(sessionOwner)} and ended_at is not null)::text||'|'||(select count(*) from public.task_time_sessions where instance_id=${lit(sessionTaskB)} and actor_id=${lit(sessionPeer)} and ended_at is null)::text||'|'||(select state_revision from public.task_instances where id=${lit(sessionTaskA)})||'|'||(select state_revision from public.task_instances where id=${lit(sessionTaskB)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(revokeSessionsOp)})||'|'||(select count(*) from app_private.company_membership_events where profile_id=${lit(sessionOwner)} and company_id=${lit(company)});`)).at(-1);
      assert.equal(sessionRevokeFinal, "0|1|1|1|0|1|1", sessionRevokeFinal); assert.equal(sessionFenceReplay, sessionFenceAfter); assert.equal(sessionGraphReplay, sessionGraphAfter);
      record("M2.2C membership revoke stops exactly one session; replay, no-op, and scoped receipt reads have required inertness", true, { ownerSessionStopped: "0|1", otherExecutorSessionRemainsOpen: true, exactReplaySQLSTATE: replaySessionsResult.code, membershipFenceAfterFirst: sessionFenceAfter, membershipFenceAfterReplay: sessionFenceReplay, graphFenceAfterFirst: sessionGraphAfter, graphFenceAfterReplay: sessionGraphReplay, receiptQueryChiefAAL2: memberReceiptAllowedData.data.found, receiptQueryOtherActor: JSON.parse(memberReceiptOtherActor.lines.at(-1)).data.found, receiptQueryChiefAAL1SQLSTATE: memberReceiptAal1.code, noOpSQLSTATE: memberNoopResult.code, noOpFenceEventAuditReceiptBefore: memberNoopBefore, noOpFenceEventAuditReceiptAfter: memberNoopAfter, auditEvents: sessionAuditCount, finalState: sessionRevokeFinal, schemaCardinality: "one open session per actor globally (001); unique actor+instance index also present (011)" });

      async function memberTask(ownerId, assignmentId, taskId, label, taskKind = "resultado") {
        const unit = taskKind === "operativa" ? "horas" : null, target = taskKind === "operativa" ? 10 : null, dueDate = taskKind === "operativa" ? `,${lit(scheduledOn)}::date` : ",null";
        await observer.ok(`insert into auth.users(id) values(${lit(ownerId)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(ownerId)},${lit(org)},${lit(label)},'empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(ownerId)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(ownerId)});insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist) values(${lit(assignmentId)},${lit(org)},${lit(company)},${lit(ownerId)},${lit(team)},${lit(label)},${lit(taskKind)},1,${unit === null ? "null" : lit(unit)},${target === null ? "null" : target},'mensual',${lit(monthPeriod)}::date,15,'[]');insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,unit,target,due_date,checklist,status) values(${lit(taskId)},${lit(org)},${lit(assignmentId)},${lit(company)},${lit(ownerId)},${lit(team)},${lit(monthPeriod)}::date,${lit(scheduledOn)}::date,${lit(label)},${lit(taskKind)},1,${unit === null ? "null" : lit(unit)},${target === null ? "null" : target}${dueDate},'[]','Pendiente');`);
      }
      // Exact membership receipt replay must lock/revalidate the chief profile
      // without writing any fence, then reject an RR snapshot predating demotion.
      const replayChief = uid(9680), replayTarget = uid(9681), replayTargetAssignment = uid(9682), replayTargetTask = uid(9683), replayMembershipOp = uid(9684);
      await observer.ok(`insert into auth.users(id) values(${lit(replayChief)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(replayChief)},${lit(org)},'M2.2C replay chief','jefe','Test','Test','Test');`);
      await memberTask(replayTarget, replayTargetAssignment, replayTargetTask, "M2.2C replay membership target");
      const replayMembershipCommand = { contractVersion: 1, operationId: replayMembershipOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${replayTarget}`]: "0" }, payload: { companyId: company, profileId: replayTarget, active: false, reason: "Replay authorization fencing" } };
      await claims({ role: "authenticated", sub: replayChief, aal: "aal2" }, replayChief);
      const initialMembershipCommand = await a.query(`select api.command_v1('${JSON.stringify(replayMembershipCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(initialMembershipCommand.code, "00000", JSON.stringify(initialMembershipCommand));
      const chiefReplayStateSql = `select (select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(replayChief)})||'|'||(select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(replayTarget)})||'|'||(select count(*) from app_private.company_membership_events where profile_id=${lit(replayTarget)} and company_id=${lit(company)})||'|'||(select count(*) from public.audit_events where action='companyMembership.setActive' and details->>'profileId'=${lit(replayTarget)})||'|'||(select count(*) from app_private.api_command_receipts where actor_id=${lit(replayChief)} and operation_id=${lit(replayMembershipOp)});`;
      const chiefReplayBefore = (await observer.ok(chiefReplayStateSql)).at(-1);
      await a.ok("begin isolation level read committed;"); const chiefReplayPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const firstChiefReplay = await a.query(`select api.command_v1('${JSON.stringify(replayMembershipCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(firstChiefReplay.code, "00000", JSON.stringify(firstChiefReplay));
      const chiefReplayAfter = (await observer.ok(chiefReplayStateSql)).at(-1); assert.equal(chiefReplayAfter, chiefReplayBefore, `${chiefReplayBefore} -> ${chiefReplayAfter}`);
      const demotionPid = Number((await observer.ok("select pg_backend_pid();")).at(-1));
      const pendingChiefDemotion = observer.query(`update public.profiles set role='encargado' where id=${lit(replayChief)};`);
      let chiefDemotionBlocked = false; const chiefDemotionDeadline = Date.now() + 10000;
      while (Date.now() < chiefDemotionDeadline) { if ((await reviewer.ok(`select ${chiefReplayPid}=any(pg_catalog.pg_blocking_pids(${demotionPid}));`)).at(-1) === "t") { chiefDemotionBlocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
      await a.ok("commit;"); const chiefDemotionResult = await pendingChiefDemotion; assert.equal(chiefDemotionResult.code, "00000", JSON.stringify(chiefDemotionResult));
      assert.equal(chiefDemotionBlocked, true);
      // Demotion-first: both API command replay and receipt query must stale-abort,
      // then deny in a fresh transaction without changing the saved receipt.
      await observer.ok(`update public.profiles set role='jefe' where id=${lit(replayChief)};`);
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(replayChief)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: replayChief, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select role from public.profiles where id=${lit(replayChief)};`);
      await observer.ok(`update public.profiles set role='encargado' where id=${lit(replayChief)};`);
      const staleMembershipReplay = await b.query(`select api.command_v1('${JSON.stringify(replayMembershipCommand).replaceAll("'", "''")}'::jsonb);`); await b.ok("rollback;"); assert.equal(staleMembershipReplay.code, "40001", JSON.stringify(staleMembershipReplay));
      const retryMembershipReplay = await b.query(`select api.command_v1('${JSON.stringify(replayMembershipCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(retryMembershipReplay.code, "42501", JSON.stringify(retryMembershipReplay));
      await observer.ok(`update public.profiles set role='jefe' where id=${lit(replayChief)};`);
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(replayChief)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: replayChief, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select role from public.profiles where id=${lit(replayChief)};`);
      await observer.ok(`update public.profiles set role='encargado' where id=${lit(replayChief)};`);
      const staleMembershipReceipt = await b.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "commandReceipt", filters: { operationId: replayMembershipOp }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`); await b.ok("rollback;"); assert.equal(staleMembershipReceipt.code, "40001", JSON.stringify(staleMembershipReceipt));
      const retryMembershipReceipt = await b.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "commandReceipt", filters: { operationId: replayMembershipOp }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`); assert.equal(retryMembershipReceipt.code, "42501", JSON.stringify(retryMembershipReceipt));
      const chiefReplayFinal = (await observer.ok(chiefReplayStateSql)).at(-1); assert.equal(chiefReplayFinal, chiefReplayBefore, `${chiefReplayBefore} -> ${chiefReplayFinal}`);
      await observer.ok(`update public.profiles set role='jefe' where id=${lit(replayChief)};`); await a.ok("reset role;"); await b.ok("reset role;");
      record("M2.2C setActive replay and commandReceipt serialize against chief demotion without epoch writes", true, { initialSQLSTATE: initialMembershipCommand.code, replayFirstSQLSTATE: firstChiefReplay.code, demotionBlocked: chiefDemotionBlocked, staleReplaySQLSTATE: staleMembershipReplay.code, retryReplaySQLSTATE: retryMembershipReplay.code, staleReceiptSQLSTATE: staleMembershipReceipt.code, retryReceiptSQLSTATE: retryMembershipReceipt.code, epochsEventsAuditReceiptBeforeAfter: `${chiefReplayBefore}|${chiefReplayFinal}` });

      async function coveredTaskFixture(ownerId, replacementId, assignmentId, taskId, planId, approveOp, label) {
        await memberTask(ownerId, assignmentId, taskId, `${label} owner`);
        await observer.ok(`insert into auth.users(id) values(${lit(replacementId)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(replacementId)},${lit(org)},${lit(label+' replacement')},'empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(replacementId)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(replacementId)});insert into public.task_coverage_plans(id,organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by,sealed) values(${lit(planId)},${lit(org)},${lit(ownerId)},${lit(replacementId)},${lit(scheduledOn)}::date,${lit(scheduledOn)}::date,'otra',${lit(boss)},false);insert into public.task_coverage_plan_instances(plan_id,organization_id,instance_id,company_id_snapshot,period_snapshot,responsibility_set_id) select ${lit(planId)},${lit(org)},${lit(taskId)},${lit(company)},${lit(monthPeriod)}::date,h.set_id from public.task_responsibility_heads h where h.instance_id=${lit(taskId)};update public.task_coverage_plans set sealed=true,sealed_by=${lit(boss)},sealed_at=clock_timestamp() where id=${lit(planId)};`);
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        const approval = await a.query(`select public.approve_task_coverage_plan(${lit(planId)},${lit(approveOp)});`); assert.equal(approval.code, "00000", JSON.stringify(approval));
        const bindingId = (await observer.ok(`select id from public.task_coverage_bindings where instance_id=${lit(taskId)} and status='active';`)).at(-1); assert.match(bindingId,/^[0-9a-f-]{36}$/i,bindingId);
        return { ownerId, replacementId, taskId, bindingId };
      }
      // Same-isolation cancellation/onboarding approval matrix. These fixtures
      // deliberately use a one-off assignment and an instance-only binding;
      // they must not inherit the monthly assignment from memberTask().
      const coverageApprovalCancellationCases = [
        { order: "cancel-first", isolation: "read committed", expectedLoser: "40001", retry: "approval" },
        { order: "approve-first", isolation: "read committed", expectedLoser: "00000", retry: "cancel-replay" },
        { order: "cancel-first", isolation: "repeatable read", expectedLoser: "40001", retry: "approval" },
        { order: "approve-first", isolation: "repeatable read", expectedLoser: "40001", retry: "cancel" },
      ];
      for (let index = 0; index < coverageApprovalCancellationCases.length; index++) {
        const spec = coverageApprovalCancellationCases[index], base = 53000 + index * 20;
        const ownerId = uid(base), replacementId = uid(base + 1), assignmentId = uid(base + 2), taskId = uid(base + 3);
        const planId = uid(base + 4), lineId = uid(base + 5), saveOp = uid(base + 6), submitOp = uid(base + 7);
        const approvalOp = uid(base + 8), coverageApproveOp = uid(base + 9), cancelOp = uid(base + 10);
        const cancelChief = uid(base + 11), approvalChief = uid(base + 12), reason = `M2.2C ${spec.order} ${spec.isolation} cancellation`;
        const firstAction = spec.order === "cancel-first" ? "cancel" : "approve";
        const winnerActor = firstAction === "cancel" ? cancelChief : approvalChief;
        const loserActor = firstAction === "cancel" ? approvalChief : cancelChief;
        await observer.ok(`insert into auth.users(id) values(${lit(ownerId)}),(${lit(replacementId)}),(${lit(cancelChief)}),(${lit(approvalChief)});
          insert into public.profiles(id,organization_id,name,role,sector,branch,position) values
            (${lit(ownerId)},${lit(org)},'M2.2C coverage approval owner ${index}','empleado','Test','Test','Test'),
            (${lit(replacementId)},${lit(org)},'M2.2C coverage replacement ${index}','empleado','Test','Test','Test'),
            (${lit(cancelChief)},${lit(org)},'M2.2C coverage cancel chief ${index}','jefe','Test','Test','Jefe'),
            (${lit(approvalChief)},${lit(org)},'M2.2C coverage approval chief ${index}','jefe','Test','Test','Jefe');
          insert into public.company_memberships(organization_id,company_id,profile_id) values
            (${lit(org)},${lit(company)},${lit(ownerId)}),(${lit(org)},${lit(company)},${lit(replacementId)}),
            (${lit(org)},${lit(company)},${lit(cancelChief)}),(${lit(org)},${lit(company)},${lit(approvalChief)});
          insert into public.team_members(organization_id,team_id,profile_id) values
            (${lit(org)},${lit(team)},${lit(ownerId)}),(${lit(org)},${lit(team)},${lit(replacementId)}),
            (${lit(org)},${lit(team)},${lit(cancelChief)}),(${lit(org)},${lit(team)},${lit(approvalChief)});
          insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days)
            values(${lit(assignmentId)},${lit(org)},${lit(company)},${lit(ownerId)},${lit(team)},'M2.2C covered one-off ${index}','resultado',1,null,null,'unica',date_trunc('month',${lit(scheduledOn)}::date)::date,extract(day from ${lit(scheduledOn)}::date)::integer,'[]',${lit(scheduledOn)}::date,${lit(scheduledOn)}::date,1,array[1]::smallint[],extract(day from ${lit(scheduledOn)}::date)::smallint,true,0);
          insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
            values(${lit(taskId)},${lit(org)},${lit(assignmentId)},${lit(company)},${lit(ownerId)},${lit(team)},${lit(monthPeriod)}::date,${lit(scheduledOn)}::date,'M2.2C covered one-off ${index}','resultado',1,${lit(scheduledOn)}::date,null,null,'[]','Pendiente');
          insert into public.task_coverage_plans(id,organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by,sealed)
            values(${lit(planId)},${lit(org)},${lit(ownerId)},${lit(replacementId)},${lit(scheduledOn)}::date,${lit(scheduledOn)}::date,'otra',${lit(cancelChief)},false);
          insert into public.task_coverage_plan_instances(plan_id,organization_id,instance_id,company_id_snapshot,period_snapshot,responsibility_set_id)
            select ${lit(planId)},${lit(org)},${lit(taskId)},${lit(company)},${lit(monthPeriod)}::date,h.set_id from public.task_responsibility_heads h where h.instance_id=${lit(taskId)};
          update public.task_coverage_plans set sealed=true,sealed_by=${lit(cancelChief)},sealed_at=clock_timestamp() where id=${lit(planId)};`);
        const coverageSetupActorCount = (await observer.ok(`select count(*) from public.profiles p join public.company_memberships m on m.profile_id=p.id and m.organization_id=p.organization_id and m.company_id=${lit(company)} and m.active where p.id in (${lit(cancelChief)},${lit(approvalChief)}) and p.organization_id=${lit(org)} and p.role='jefe' and p.active;`)).at(-1);
        assert.equal(coverageSetupActorCount, "2", `two active, company-authorized chiefs required: ${coverageSetupActorCount}`);
        await claims({ role: "authenticated", sub: cancelChief, aal: "aal2" }, cancelChief);
        const coverageSetup = await a.query(`select public.approve_task_coverage_plan(${lit(planId)},${lit(coverageApproveOp)});`);
        assert.equal(coverageSetup.code, "00000", JSON.stringify(coverageSetup)); await a.ok("reset role;");
        const bindingId = (await observer.ok(`select id from public.task_coverage_bindings where plan_id=${lit(planId)} and instance_id=${lit(taskId)} and status='active';`)).at(-1);
        assert.match(bindingId, /^[0-9a-f-]{36}$/iu, bindingId);
        const bindingShape = (await observer.ok(`select (b.instance_id=${lit(taskId)})::text||'|'||(b.source_rule_id is null)::text||'|'||(t.assignment_id=${lit(assignmentId)})::text||'|'||a.frequency from public.task_coverage_bindings b join public.task_instances t on t.id=b.instance_id join public.task_assignments a on a.id=t.assignment_id where b.id=${lit(bindingId)};`)).at(-1);
        assert.equal(bindingShape, "true|true|true|unica", bindingShape);
        const draft = { ...requestDraft, lines: [{ lineId, companyId: company, teamId: team,
          source: { type: "custom", definition: { kind: "operativa", title: `M2.2C onboarding one-off ${index}`, objective: "", sector: "Test", unit: "documentos" } },
          schedule: { ...requestDraft.lines[0].schedule, frequency: "unica", startDate: scheduledOn, endDate: scheduledOn } }] };
        await claims({ role: "authenticated", sub: ownerId, aal: "aal1" }, ownerId);
        const saved = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: saveOp, kind: "onboarding.saveDraft", expectedRevisions: { [`onboardingOwner:${ownerId}`]: "0" }, payload: { requestId: null, draft } }).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(saved.code, "00000", JSON.stringify(saved)); const requestId = JSON.parse(saved.lines.at(-1)).result.requestId;
        const submitted = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: submitOp, kind: "onboarding.submit", expectedRevisions: { [`onboarding:${requestId}`]: "0", [`onboardingDraft:${requestId}`]: "1" }, payload: { requestId } }).replaceAll("'", "''")}'::jsonb);`);
        assert.equal(submitted.code, "00000", JSON.stringify(submitted)); await a.ok("reset role;");
        const approve = { contractVersion: 1, operationId: approvalOp, kind: "onboarding.approve", expectedRevisions: { [`onboarding:${requestId}`]: "1" }, payload: { requestId, weightOverrides: [], period: monthPeriod } };
        const approvalSql = `select api.command_v1('${JSON.stringify(approve).replaceAll("'", "''")}'::jsonb);`;
        const cancellationSql = `select public.cancel_task_coverage_binding(${lit(bindingId)},${lit(reason)},${lit(cancelOp)});`;
        const snapshot = async () => JSON.parse((await reviewer.ok(`select jsonb_build_object(
          'request',(select to_jsonb(r) from public.onboarding_requests r where r.id=${lit(requestId)}),
          'requestVersion',(select to_jsonb(v) from public.onboarding_request_versions v where v.request_id=${lit(requestId)} and v.revision=1),
          'sourceAssignment',(select to_jsonb(a) from public.task_assignments a where a.id=${lit(assignmentId)}),
          'sourceTask',(select to_jsonb(t) from public.task_instances t where t.id=${lit(taskId)}),
          'coveragePlan',(select to_jsonb(p) from public.task_coverage_plans p where p.id=${lit(planId)}),
          'coveragePlanInstance',(select to_jsonb(pi) from public.task_coverage_plan_instances pi where pi.plan_id=${lit(planId)} and pi.instance_id=${lit(taskId)}),
          'binding',(select to_jsonb(b) from public.task_coverage_bindings b where b.id=${lit(bindingId)}),
          'sessions',(select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) from public.task_time_sessions s where s.instance_id=${lit(taskId)} or s.coverage_binding_id=${lit(bindingId)}),
          'activations',(select coalesce(jsonb_agg(to_jsonb(x) order by x.line_id),'[]'::jsonb) from public.onboarding_activations x where x.request_id=${lit(requestId)}),
          'onboardingAssignments',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.onboarding_activations x join public.task_assignments a on a.id=x.assignment_id where x.request_id=${lit(requestId)}),
          'onboardingTasks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.onboarding_activations x join public.task_assignments a on a.id=x.assignment_id join public.task_instances t on t.assignment_id=a.id and t.period=${lit(monthPeriod)}::date where x.request_id=${lit(requestId)}),
          'approvalReceipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.operation_id),'[]'::jsonb) from app_private.api_command_receipts r where r.actor_id=${lit(approvalChief)} and r.operation_id=${lit(approvalOp)}),
          'cancellationReceipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.operation_id),'[]'::jsonb) from public.task_mutation_receipts r where r.actor_id=${lit(cancelChief)} and r.operation_id=${lit(cancelOp)}),
          'monthFence',(select coalesce(jsonb_agg(to_jsonb(f) order by f.period),'[]'::jsonb) from app_private.api_month_fences f where f.organization_id=${lit(org)} and f.owner_id=${lit(ownerId)} and f.period=${lit(monthPeriod)}::date),
          'dependencyFence',(select to_jsonb(g) from app_private.task_dependency_graphs g where g.organization_id=${lit(org)} and g.company_id=${lit(company)} and g.period=${lit(monthPeriod)}::date),
          'audit',(select coalesce(jsonb_agg(to_jsonb(e) order by e.at,e.id),'[]'::jsonb) from public.audit_events e where e.entity_id in (${lit(requestId)},${lit(taskId)},${lit(bindingId)}) and e.actor_id in (${lit(cancelChief)},${lit(approvalChief)}) and e.action in ('onboarding.approved','task.coverage_cancelled'))
        )::text;`)).at(-1));
        const before = await snapshot(); assert.equal(before.request.status, "submitted"); assert.equal(before.binding.status, "active");
        assert.equal(before.binding.source_rule_id, null); assert.equal(before.activations.length, 0); assert.equal(before.sessions.length, 0);
        assert.equal(before.sourceAssignment.frequency, "unica"); assert.equal(before.coveragePlan.sealed, true);
        const winner = firstAction === "cancel" ? a : a, loser = b;
        const winnerSql = firstAction === "cancel" ? cancellationSql : approvalSql, loserSql = firstAction === "cancel" ? approvalSql : cancellationSql;
        const setAal2Actor = async (session, actorId) => session.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actorId)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actorId, aal: "aal2" }))},false);set role authenticated;`);
        await setAal2Actor(winner, winnerActor); await winner.ok(`begin isolation level ${spec.isolation};`);
        const winnerIsolation = (await winner.ok("show transaction_isolation;")).at(-1); assert.equal(winnerIsolation, spec.isolation);
        const winnerPid = Number((await winner.ok("select pg_backend_pid();")).at(-1));
        const winnerPending = winner.query(winnerSql); const winnerResult = await winnerPending;
        if (winnerResult.code !== "00000") throw Error(`M2.2C coverage cancellation race winner diverged before blocker: ${spec.order}/${spec.isolation}, ${winnerResult.code}: ${winnerResult.errors}`);
        await setAal2Actor(loser, loserActor); await loser.ok(`begin isolation level ${spec.isolation};select status from public.onboarding_requests where id=${lit(requestId)};select state_revision from public.task_instances where id=${lit(taskId)};`);
        const loserIsolation = (await loser.ok("show transaction_isolation;")).at(-1); assert.equal(loserIsolation, spec.isolation);
        const loserPid = Number((await loser.ok("select pg_backend_pid();")).at(-1)); const loserPending = loser.query(loserSql);
        let blocked = false; const deadline = Date.now() + 10000;
        while (Date.now() < deadline) { if ((await reviewer.ok(`select ${winnerPid}=any(pg_catalog.pg_blocking_pids(${loserPid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise(done => setTimeout(done, 20)); }
        const blockerPids = (await reviewer.ok(`select pg_catalog.pg_blocking_pids(${loserPid})::text;`)).at(-1);
        if (!blocked) { await winner.ok("commit;"); const loserResult = await loserPending; await loser.ok("rollback;"); const diag = { spec, before, winner: { sqlstate: winnerResult.code, response: winnerResult.lines.at(-1) }, loser: { sqlstate: loserResult.code, errors: loserResult.errors }, blocked, blockerPids, after: await snapshot() }; writeFileSync(join(out, `m2-2c-coverage-cancel-approval-race-${index}-diagnostic.json`), JSON.stringify(diag, null, 2)); record(`M2.2C coverage cancellation race missing real blocker ${spec.order}/${spec.isolation}`, false, diag); throw Error(`M2.2C coverage race did not block for ${spec.order}/${spec.isolation}`); }
        await winner.ok("commit;"); const loserResult = await loserPending; const afterWinnerCommit = await snapshot();
        if (loserResult.code !== spec.expectedLoser) {
          await loser.ok("rollback;"); const diag = { spec, actors: { cancelChief, approvalChief, winnerActor, loserActor }, isolation: { winner: winnerIsolation, loser: loserIsolation }, pids: { winnerPid, loserPid, blockerPids }, before, winner: { sqlstate: winnerResult.code, response: winnerResult.lines.at(-1) }, loser: { sqlstate: loserResult.code, errors: loserResult.errors, response: loserResult.lines.at(-1) }, afterWinnerCommit, afterRollback: await snapshot(), postgresLog: join(out, "postgres.log") };
          writeFileSync(join(out, `m2-2c-coverage-cancel-approval-race-${index}-diagnostic.json`), JSON.stringify(diag, null, 2)); record(`M2.2C coverage cancellation race unexpected loser outcome ${spec.order}/${spec.isolation}`, false, diag); throw Error(`M2.2C fixed SQLSTATE mismatch ${spec.order}/${spec.isolation}: expected ${spec.expectedLoser}, observed ${loserResult.code}`);
        }
        let retryResult = null, retryConnection = null, replayResult = null, afterFirstAttempt = afterWinnerCommit;
        if (spec.expectedLoser === "40001") await loser.ok("rollback;"); else await loser.ok("commit;");
        afterFirstAttempt = await snapshot();
        if (firstAction === "cancel") {
          assert.equal(afterFirstAttempt.request.status, "submitted"); assert.equal(afterFirstAttempt.binding.status, "cancelled");
          assert.equal(afterFirstAttempt.activations.length, 0); assert.equal(afterFirstAttempt.approvalReceipts.length, 0);
        } else {
          assert.equal(afterWinnerCommit.request.status, "approved"); assert.equal(afterWinnerCommit.binding.status, "active");
          assert.equal(afterWinnerCommit.activations.length, 1); assert.equal(afterWinnerCommit.approvalReceipts.length, 1);
          assert.deepEqual(afterWinnerCommit.sourceTask, before.sourceTask); assert.deepEqual(afterWinnerCommit.sourceAssignment, before.sourceAssignment);
          assert.deepEqual(afterWinnerCommit.binding, before.binding); assert.deepEqual(afterWinnerCommit.coveragePlan, before.coveragePlan);
          assert.deepEqual(afterWinnerCommit.coveragePlanInstance, before.coveragePlanInstance); assert.deepEqual(afterWinnerCommit.sessions, before.sessions);
        }
        const retrySession = new Session(); auxiliarySessions.push(retrySession);
        await retrySession.ok("\\set VERBOSITY verbose\nset statement_timeout='15s';");
        const retryActor = spec.retry === "approval" ? approvalChief : cancelChief;
        await setAal2Actor(retrySession, retryActor);
        await retrySession.ok(`begin isolation level ${spec.isolation};`);
        if (spec.retry === "approval") {
          retryResult = await retrySession.query(approvalSql); assert.equal(retryResult.code, "00000", JSON.stringify(retryResult)); await retrySession.ok("commit;");
        } else if (spec.retry === "cancel") {
          retryResult = await retrySession.query(cancellationSql); assert.equal(retryResult.code, "00000", JSON.stringify(retryResult)); await retrySession.ok("commit;");
        } else {
          replayResult = await retrySession.query(cancellationSql); assert.equal(replayResult.code, "00000", JSON.stringify(replayResult));
          assert.deepEqual(replayResult.lines, loserResult.lines, "void cancellation exact replay must return the same empty response");
          await retrySession.ok("commit;");
        }
        await retrySession.ok("reset role;"); await retrySession.close(); auxiliarySessions.splice(auxiliarySessions.indexOf(retrySession), 1);
        const afterRetry = await snapshot();
        if (spec.retry === "cancel-replay") assert.deepEqual(afterRetry, afterFirstAttempt, "void cancellation replay must be inert");
        const approvalEnvelope = JSON.parse((firstAction === "approve" ? winnerResult : retryResult).lines.at(-1));
        const approvalReceipt = afterRetry.approvalReceipts[0]; assert.equal(afterRetry.approvalReceipts.length, 1);
        assert.deepEqual(approvalEnvelope, approvalReceipt.result, "full onboarding.approve response must equal its durable receipt result");
        const cancelReceipt = afterRetry.cancellationReceipts[0]; assert.equal(afterRetry.cancellationReceipts.length, 1);
        assert.equal(cancelReceipt.operation_kind, "cancel_task_coverage"); assert.equal(cancelReceipt.actor_id, cancelChief); assert.equal(cancelReceipt.operation_id, cancelOp);
        assert.deepEqual(cancelReceipt.arguments, { binding: bindingId, reason: reason }); assert.deepEqual(cancelReceipt.result, {});
        assert.equal(afterRetry.request.status, "approved"); assert.equal(afterRetry.activations.length, 1); assert.equal(afterRetry.activations[0].line_id, lineId);
        assert.equal(afterRetry.onboardingAssignments.length, 1); assert.equal(afterRetry.onboardingTasks.length, 1);
        assert.equal(afterRetry.binding.status, "cancelled"); assert.equal(afterRetry.binding.cancelled_by, cancelChief);
        assert.equal(afterRetry.sessions.length, 0); assert.equal(afterRetry.audit.filter(e => e.action === "task.coverage_cancelled" && e.entity_id === bindingId).length, 1);
        assert.equal(afterRetry.audit.filter(e => e.action === "onboarding.approved" && e.entity_id === requestId).length, 1);
        const final = { activationCount: afterRetry.activations.length, assignments: afterRetry.onboardingAssignments.length, occurrences: afterRetry.onboardingTasks.length,
          cancelledBindings: afterRetry.binding.status === "cancelled" ? 1 : 0, approvalReceipts: afterRetry.approvalReceipts.length, cancellationReceipts: afterRetry.cancellationReceipts.length,
          cancellationAuditEvents: afterRetry.audit.filter(e => e.action === "task.coverage_cancelled" && e.entity_id === bindingId).length,
          approvalAuditEvents: afterRetry.audit.filter(e => e.action === "onboarding.approved" && e.entity_id === requestId).length };
        assert.deepEqual(final, { activationCount: 1, assignments: 1, occurrences: 1, cancelledBindings: 1, approvalReceipts: 1, cancellationReceipts: 1, cancellationAuditEvents: 1, approvalAuditEvents: 1 });
        record(`M2.2C coverage cancellation vs onboarding approval ${spec.order} (${spec.isolation}/${spec.isolation})`, true, {
          spec, actors: { cancelChief, approvalChief, distinctAal2Chiefs: cancelChief !== approvalChief }, actualIsolation: { winner: winnerIsolation, loser: loserIsolation },
          backendPids: { winner: winnerPid, loser: loserPid }, blockerPids, blocked, before, winner: { sqlstate: winnerResult.code, response: winnerResult.lines.at(-1) },
          loser: { sqlstate: loserResult.code, response: loserResult.lines.at(-1), errors: loserResult.errors }, afterWinnerCommit, afterFirstAttempt,
          retry: retryResult ? { connection: "new PostgreSQL session", sqlstate: retryResult.code, response: retryResult.lines.at(-1) } : null,
          exactVoidReplay: replayResult ? { connection: "new PostgreSQL session", sqlstate: replayResult.code, response: replayResult.lines, inert: true } : null,
          approvalEnvelope, approvalReceipt, cancellationVoid: { sqlstate: firstAction === "cancel" ? winnerResult.code : (loserResult.code === "00000" ? loserResult.code : retryResult.code), receipt: cancelReceipt }, after: afterRetry, final,
        });
        await a.ok("reset role;"); await b.ok("reset role;");
      }
      async function transitionReceiptFor(taskId, opId, executorId) {
        const command = { contractVersion: 1, operationId: opId, kind: "task.transition", expectedRevisions: { [`task:${taskId}`]: "0" }, payload: { taskId, status: "En curso", reason: null, confirmCommercialCompletion: false } };
        await claims({ role: "authenticated", sub: executorId, aal: "aal1" }, executorId);
        const result = await a.query(`select api.command_v1('${JSON.stringify(command).replaceAll("'", "''")}'::jsonb);`); assert.equal(result.code, "00000", JSON.stringify(result));
        return command;
      }
      const revokeReplayOwner = uid(9710), revokeReplayAssignment = uid(9711), revokeReplayTask = uid(9712), revokeReplayTransitionOp = uid(9713), revokeReplayMembershipOp = uid(9714);
      await memberTask(revokeReplayOwner, revokeReplayAssignment, revokeReplayTask, "M2.2C stale replay after membership revoke");
      const revokeReplayCommand = await transitionReceiptFor(revokeReplayTask, revokeReplayTransitionOp, revokeReplayOwner);
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(revokeReplayOwner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: revokeReplayOwner, aal: "aal1" }))},false);set role authenticated;begin isolation level repeatable read;select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(revokeReplayOwner)};`);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const revokeReplayMembership = { contractVersion: 1, operationId: revokeReplayMembershipOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${revokeReplayOwner}`]: "0" }, payload: { companyId: company, profileId: revokeReplayOwner, active: false, reason: "Stale transition receipt replay" } };
      const revokeReplayResult = await a.query(`select api.command_v1('${JSON.stringify(revokeReplayMembership).replaceAll("'", "''")}'::jsonb);`); assert.equal(revokeReplayResult.code, "00000", JSON.stringify(revokeReplayResult));
      const revokeReplayStateSql = `select (select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(revokeReplayOwner)})||'|'||(select fence_epoch from app_private.api_operation_fences where actor_id=${lit(revokeReplayOwner)} and operation_id=${lit(revokeReplayTransitionOp)})||'|'||coalesce((select fence_epoch from app_private.api_month_fences where organization_id=${lit(org)} and owner_id=${lit(revokeReplayOwner)} and period=${lit(monthPeriod)}::date),0)||'|'||coalesce((select fence_epoch from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period=${lit(monthPeriod)}::date),0)||'|'||(select status||'|'||state_revision from public.task_instances where id=${lit(revokeReplayTask)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(revokeReplayTransitionOp)})||'|'||(select count(*) from app_private.task_completion_events where instance_id=${lit(revokeReplayTask)});`;
      const revokeReplayBefore = (await observer.ok(revokeReplayStateSql)).at(-1);
      const staleRevokeTransitionReplay = await b.query(`select api.command_v1('${JSON.stringify(revokeReplayCommand).replaceAll("'", "''")}'::jsonb);`); await b.ok("rollback;"); assert.equal(staleRevokeTransitionReplay.code, "40001", JSON.stringify(staleRevokeTransitionReplay));
      const retryRevokeTransitionReplay = await b.query(`select api.command_v1('${JSON.stringify(revokeReplayCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(retryRevokeTransitionReplay.code, "42501", JSON.stringify(retryRevokeTransitionReplay));
      const revokeReplayAfter = (await observer.ok(revokeReplayStateSql)).at(-1); assert.equal(revokeReplayAfter, revokeReplayBefore, `${revokeReplayBefore} -> ${revokeReplayAfter}`); await a.ok("reset role;"); await b.ok("reset role;");
      record("M2.2C exact task.transition replay after membership revoke stale-aborts RR then denies clean retry without epoch or receipt writes", true, { revokeSQLSTATE: revokeReplayResult.code, staleReplaySQLSTATE: staleRevokeTransitionReplay.code, retrySQLSTATE: retryRevokeTransitionReplay.code, stateEpochsBeforeAfter: `${revokeReplayBefore}|${revokeReplayAfter}` });

      const coverageReplayFirst = await coveredTaskFixture(uid(9720),uid(9721),uid(9722),uid(9723),uid(9724),uid(9725),"M2.2C replay-first coverage cancellation");
      const coverageReplayFirstOp = uid(9726), coverageReplayFirstCancelOp = uid(9727);
      const coverageReplayFirstCommand = await transitionReceiptFor(coverageReplayFirst.taskId,coverageReplayFirstOp,coverageReplayFirst.replacementId);
      const coverageReplayFirstStateSql = `select (select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(coverageReplayFirst.replacementId)})||'|'||(select fence_epoch from app_private.api_operation_fences where actor_id=${lit(coverageReplayFirst.replacementId)} and operation_id=${lit(coverageReplayFirstOp)})||'|'||(select status from public.task_coverage_bindings where id=${lit(coverageReplayFirst.bindingId)})||'|'||(select state_revision from public.task_instances where id=${lit(coverageReplayFirst.taskId)})||'|'||(select count(*) from app_private.api_command_receipts where actor_id=${lit(coverageReplayFirst.replacementId)} and operation_id=${lit(coverageReplayFirstOp)})||'|'||(select count(*) from public.audit_events where action='task.coverage_cancelled' and entity_id=${lit(coverageReplayFirst.bindingId)});`;
      const coverageReplayBefore = (await observer.ok(coverageReplayFirstStateSql)).at(-1);
      await claims({ role: "authenticated", sub: coverageReplayFirst.replacementId, aal: "aal1" }, coverageReplayFirst.replacementId); await a.ok("begin isolation level read committed;"); const coverageReplayPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const coverageReplayResult = await a.query(`select api.command_v1('${JSON.stringify(coverageReplayFirstCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(coverageReplayResult.code, "00000", JSON.stringify(coverageReplayResult));
      const coverageReplayAfter = (await observer.ok(coverageReplayFirstStateSql)).at(-1); assert.equal(coverageReplayAfter, coverageReplayBefore, `${coverageReplayBefore} -> ${coverageReplayAfter}`);
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level read committed;`); const coverageCancelPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const pendingCoverageCancel = b.query(`select public.cancel_task_coverage_binding(${lit(coverageReplayFirst.bindingId)},'Cancel after receipt replay',${lit(coverageReplayFirstCancelOp)});`);
      let coverageCancelBlocked = false; const coverageCancelDeadline = Date.now()+10000; while(Date.now()<coverageCancelDeadline){if((await reviewer.ok(`select ${coverageReplayPid}=any(pg_catalog.pg_blocking_pids(${coverageCancelPid}));`)).at(-1)==="t"){coverageCancelBlocked=true;break;}await new Promise(done=>setTimeout(done,20));}
      await a.ok("commit;"); const coverageCancelResult = await pendingCoverageCancel; await b.ok(coverageCancelResult.code==="00000"?"commit;":"rollback;"); assert.equal(coverageCancelBlocked,true); assert.equal(coverageCancelResult.code,"00000",JSON.stringify(coverageCancelResult)); await a.ok("reset role;"); await b.ok("reset role;");
      record("M2.2C exact transition replay is read-only and serializes before coverage cancellation", true, { replaySQLSTATE: coverageReplayResult.code, cancelSQLSTATE: coverageCancelResult.code, blocked: coverageCancelBlocked, stateBeforeAfterReplay: `${coverageReplayBefore}|${coverageReplayAfter}` });

      const coverageCancelFirst = await coveredTaskFixture(uid(9730),uid(9731),uid(9732),uid(9733),uid(9734),uid(9735),"M2.2C cancel-first stale replay");
      const coverageCancelFirstOp = uid(9736), coverageCancelFirstCancelOp = uid(9737);
      const coverageCancelFirstCommand = await transitionReceiptFor(coverageCancelFirst.taskId,coverageCancelFirstOp,coverageCancelFirst.replacementId);
      await claims({ role: "authenticated", sub: coverageCancelFirst.replacementId, aal: "aal1" }, coverageCancelFirst.replacementId);
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(coverageCancelFirst.replacementId)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: coverageCancelFirst.replacementId, aal: "aal1" }))},false);set role authenticated;begin isolation level repeatable read;select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(coverageCancelFirst.replacementId)};`);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const coverageCancelFirstResult = await a.query(`select public.cancel_task_coverage_binding(${lit(coverageCancelFirst.bindingId)},'Cancel before stale replay',${lit(coverageCancelFirstCancelOp)});`); assert.equal(coverageCancelFirstResult.code,"00000",JSON.stringify(coverageCancelFirstResult));
      const coverageCancelStateSql = `select (select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(coverageCancelFirst.replacementId)})||'|'||(select fence_epoch from app_private.api_operation_fences where actor_id=${lit(coverageCancelFirst.replacementId)} and operation_id=${lit(coverageCancelFirstOp)})||'|'||(select status from public.task_coverage_bindings where id=${lit(coverageCancelFirst.bindingId)})||'|'||(select status||'|'||state_revision from public.task_instances where id=${lit(coverageCancelFirst.taskId)})||'|'||(select count(*) from app_private.api_command_receipts where actor_id=${lit(coverageCancelFirst.replacementId)} and operation_id=${lit(coverageCancelFirstOp)})||'|'||(select count(*) from public.audit_events where action='task.coverage_cancelled' and entity_id=${lit(coverageCancelFirst.bindingId)});`;
      const coverageCancelStateBeforeReplay = (await observer.ok(coverageCancelStateSql)).at(-1);
      const staleCoverageTransitionReplay = await b.query(`select api.command_v1('${JSON.stringify(coverageCancelFirstCommand).replaceAll("'", "''")}'::jsonb);`); await b.ok("rollback;"); assert.equal(staleCoverageTransitionReplay.code,"40001",JSON.stringify(staleCoverageTransitionReplay));
      const retryCoverageTransitionReplay = await b.query(`select api.command_v1('${JSON.stringify(coverageCancelFirstCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(retryCoverageTransitionReplay.code,"42501",JSON.stringify(retryCoverageTransitionReplay));
      const coverageCancelStateAfterReplay = (await observer.ok(coverageCancelStateSql)).at(-1); assert.equal(coverageCancelStateAfterReplay,coverageCancelStateBeforeReplay,`${coverageCancelStateBeforeReplay} -> ${coverageCancelStateAfterReplay}`); await a.ok("reset role;"); await b.ok("reset role;");
      record("M2.2C coverage cancel before exact transition replay stale-aborts RR and retry denies without writes", true, { cancelSQLSTATE: coverageCancelFirstResult.code, staleReplaySQLSTATE: staleCoverageTransitionReplay.code, retrySQLSTATE: retryCoverageTransitionReplay.code, epochsAndReceiptBeforeAfter: `${coverageCancelStateBeforeReplay}|${coverageCancelStateAfterReplay}` });

      const recordOwner = uid(9630), recordAssignment = uid(9631), recordTask = uid(9632), recordOp = uid(9633), revokeAfterRecordOp = uid(9634);
      await memberTask(recordOwner, recordAssignment, recordTask, "M2.2C operation.record-first membership revoke", "operativa");
      const recordFirstCommand = { contractVersion: 1, operationId: recordOp, kind: "operation.record", expectedRevisions: { [`task:${recordTask}`]: "0" }, payload: { taskId: recordTask, workDate: scheduledOn, quantity: 1, reference: "membership-revoke-record-first" } };
      const revokeAfterRecord = { contractVersion: 1, operationId: revokeAfterRecordOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${recordOwner}`]: "0" }, payload: { companyId: company, profileId: recordOwner, active: false, reason: "Record-first membership revoke" } };
      await claims({ role: "authenticated", sub: recordOwner, aal: "aal1" }, recordOwner);
      await a.ok("begin isolation level read committed;"); const recordFirstPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const recordFirstResult = await a.query(`select api.command_v1('${JSON.stringify(recordFirstCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(recordFirstResult.code, "00000", JSON.stringify(recordFirstResult));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(recordOwner)};`);
      const revokeAfterRecordPid = Number((await b.ok("select pg_backend_pid();")).at(-1)); const pendingRevokeAfterRecord = b.query(`select api.command_v1('${JSON.stringify(revokeAfterRecord).replaceAll("'", "''")}'::jsonb);`);
      let revokeAfterRecordBlocked = false; const revokeAfterRecordDeadline = Date.now() + 10000;
      while (Date.now() < revokeAfterRecordDeadline) { if ((await observer.ok(`select ${recordFirstPid}=any(pg_catalog.pg_blocking_pids(${revokeAfterRecordPid}));`)).at(-1) === "t") { revokeAfterRecordBlocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
      await a.ok("commit;"); const staleRevokeAfterRecord = await pendingRevokeAfterRecord; await b.ok(staleRevokeAfterRecord.code === "00000" ? "commit;" : "rollback;");
      assert.equal(revokeAfterRecordBlocked, true); assert.equal(staleRevokeAfterRecord.code, "40001", JSON.stringify(staleRevokeAfterRecord));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
      const retryRevokeAfterRecord = await b.query(`select api.command_v1('${JSON.stringify(revokeAfterRecord).replaceAll("'", "''")}'::jsonb);`); assert.equal(retryRevokeAfterRecord.code, "00000", JSON.stringify(retryRevokeAfterRecord)); await a.ok("reset role;"); await b.ok("reset role;");
      const recordFirstFinal = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where profile_id=${lit(recordOwner)} and company_id=${lit(company)})||'|'||(select count(*)||'|'||coalesce(sum(quantity),0) from public.activity_entries where instance_id=${lit(recordTask)} and reference='membership-revoke-record-first')||'|'||(select state_revision from public.task_instances where id=${lit(recordTask)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id in (${lit(recordOp)},${lit(revokeAfterRecordOp)}))||'|'||(select count(*) from app_private.company_membership_events where profile_id=${lit(recordOwner)} and company_id=${lit(company)});`)).at(-1);
      assert.equal(recordFirstFinal, "false|1|1|1|2|2|1", recordFirstFinal);
      record("M2.2C operation.record-first then membership revoke waits and stale-aborts; retry preserves contribution and commits one revoke", true, { blocked: revokeAfterRecordBlocked, recordSQLSTATE: recordFirstResult.code, staleRevocationSQLSTATE: staleRevokeAfterRecord.code, retrySQLSTATE: retryRevokeAfterRecord.code, finalState: recordFirstFinal });

      const revokedRecordOwner = uid(9640), revokedRecordAssignment = uid(9641), revokedRecordTask = uid(9642), revokedRecordOp = uid(9643), revokeBeforeRecordOp = uid(9644);
      await memberTask(revokedRecordOwner, revokedRecordAssignment, revokedRecordTask, "M2.2C revoke-first operation.record", "operativa");
      const revokedRecordCommand = { contractVersion: 1, operationId: revokedRecordOp, kind: "operation.record", expectedRevisions: { [`task:${revokedRecordTask}`]: "0" }, payload: { taskId: revokedRecordTask, workDate: scheduledOn, quantity: 1, reference: "membership-revoke-first" } };
      const revokeBeforeRecord = { contractVersion: 1, operationId: revokeBeforeRecordOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${revokedRecordOwner}`]: "0" }, payload: { companyId: company, profileId: revokedRecordOwner, active: false, reason: "Revoke-first contribution" } };
      await claims({ role: "authenticated", sub: revokedRecordOwner, aal: "aal1" }, revokedRecordOwner);
      const recordMembershipSnapshot = (await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(revokedRecordOwner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: revokedRecordOwner, aal: "aal1" }))},false);set role authenticated;begin isolation level repeatable read;select active::text||'|'||revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(revokedRecordOwner)};`)).at(-1); assert.equal(recordMembershipSnapshot, "true|0", recordMembershipSnapshot);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const revokeBeforeRecordResult = await a.query(`select api.command_v1('${JSON.stringify(revokeBeforeRecord).replaceAll("'", "''")}'::jsonb);`); assert.equal(revokeBeforeRecordResult.code, "00000", JSON.stringify(revokeBeforeRecordResult));
      const staleRecord = await b.query(`select api.command_v1('${JSON.stringify(revokedRecordCommand).replaceAll("'", "''")}'::jsonb);`); await b.ok(staleRecord.code === "00000" ? "commit;" : "rollback;"); assert.equal(staleRecord.code, "40001", JSON.stringify(staleRecord));
      const retryRecord = await b.query(`select api.command_v1('${JSON.stringify(revokedRecordCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(retryRecord.code, "42501", JSON.stringify(retryRecord)); await a.ok("reset role;"); await b.ok("reset role;");
      const revokeFirstRecordFinal = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where profile_id=${lit(revokedRecordOwner)} and company_id=${lit(company)})||'|'||(select count(*) from public.activity_entries where instance_id=${lit(revokedRecordTask)})||'|'||(select state_revision from public.task_instances where id=${lit(revokedRecordTask)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id in (${lit(revokedRecordOp)},${lit(revokeBeforeRecordOp)}))||'|'||(select count(*) from app_private.company_membership_events where profile_id=${lit(revokedRecordOwner)} and company_id=${lit(company)});`)).at(-1);
      assert.equal(revokeFirstRecordFinal, "false|1|0|1|1|1", revokeFirstRecordFinal);
      record("M2.2C revoke-first stale RR operation.record aborts then denies on retry without contribution or receipt", true, { revokeSQLSTATE: revokeBeforeRecordResult.code, staleRecordSQLSTATE: staleRecord.code, retrySQLSTATE: retryRecord.code, finalState: revokeFirstRecordFinal });

      const revokedTransitionOwner = uid(9650), revokedTransitionAssignment = uid(9651), revokedTransitionTask = uid(9652), revokedTransitionOp = uid(9653), revokeBeforeTransitionOp = uid(9654);
      await memberTask(revokedTransitionOwner, revokedTransitionAssignment, revokedTransitionTask, "M2.2C revoke-first task.transition");
      const revokedTransitionCommand = { contractVersion: 1, operationId: revokedTransitionOp, kind: "task.transition", expectedRevisions: { [`task:${revokedTransitionTask}`]: "0" }, payload: { taskId: revokedTransitionTask, status: "En curso", reason: null, confirmCommercialCompletion: false } };
      const revokeBeforeTransition = { contractVersion: 1, operationId: revokeBeforeTransitionOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${revokedTransitionOwner}`]: "0" }, payload: { companyId: company, profileId: revokedTransitionOwner, active: false, reason: "Revoke-first transition" } };
      const transitionMembershipSnapshot = (await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(revokedTransitionOwner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: revokedTransitionOwner, aal: "aal1" }))},false);set role authenticated;begin isolation level repeatable read;select active::text||'|'||revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(revokedTransitionOwner)};`)).at(-1); assert.equal(transitionMembershipSnapshot, "true|0", transitionMembershipSnapshot);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const revokeBeforeTransitionResult = await a.query(`select api.command_v1('${JSON.stringify(revokeBeforeTransition).replaceAll("'", "''")}'::jsonb);`); assert.equal(revokeBeforeTransitionResult.code, "00000", JSON.stringify(revokeBeforeTransitionResult));
      const staleTransition = await b.query(`select api.command_v1('${JSON.stringify(revokedTransitionCommand).replaceAll("'", "''")}'::jsonb);`); await b.ok(staleTransition.code === "00000" ? "commit;" : "rollback;"); assert.equal(staleTransition.code, "40001", JSON.stringify(staleTransition));
      const retryTransition = await b.query(`select api.command_v1('${JSON.stringify(revokedTransitionCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(retryTransition.code, "42501", JSON.stringify(retryTransition)); await a.ok("reset role;"); await b.ok("reset role;");
      const revokeFirstTransitionFinal = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where profile_id=${lit(revokedTransitionOwner)} and company_id=${lit(company)})||'|'||(select status||'|'||state_revision from public.task_instances where id=${lit(revokedTransitionTask)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id in (${lit(revokedTransitionOp)},${lit(revokeBeforeTransitionOp)}))||'|'||(select count(*) from app_private.company_membership_events where profile_id=${lit(revokedTransitionOwner)} and company_id=${lit(company)});`)).at(-1);
      assert.equal(revokeFirstTransitionFinal, "false|1|Pendiente|1|1|1", revokeFirstTransitionFinal);
      record("M2.2C revoke-first stale RR task.transition aborts then API authorization denies with 42501 without partial status or receipt", true, { revokeSQLSTATE: revokeBeforeTransitionResult.code, staleTransitionSQLSTATE: staleTransition.code, retrySQLSTATE: retryTransition.code, finalState: revokeFirstTransitionFinal });

      // Same-isolation operation.record/membership-revocation races. Both
      // orders hold their winner open until a live PostgreSQL blocker is seen.
      async function operationRecordMembershipRace({ order, isolation, base }) {
        const owner = uid(base), assignment = uid(base + 1), task = uid(base + 2);
        const recordOp = uid(base + 3), revokeOp = uid(base + 4), iso = isolation === "RC" ? "read committed" : "repeatable read";
        const reference = `M2.2C ${order} ${isolation} operation record race`;
        const recordCommand = { contractVersion: 1, operationId: recordOp, kind: "operation.record", expectedRevisions: { [`task:${task}`]: "0" }, payload: { taskId: task, workDate: scheduledOn, quantity: 1, reference } };
        const revokeCommand = { contractVersion: 1, operationId: revokeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${owner}`]: "0" }, payload: { companyId: company, profileId: owner, active: false, reason: `M2.2C ${order} ${isolation} operation record race` } };
        await observer.ok(`insert into auth.users(id) values(${lit(owner)});insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(owner)},${lit(org)},${lit(reference)},'empleado','Test','Test','Test');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(owner)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(owner)});insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,measurement_version) values(${lit(assignment)},${lit(org)},${lit(company)},${lit(owner)},${lit(team)},${lit(reference)},'operativa',null,'documentos',null,'mensual',${lit(monthPeriod)}::date,15,'[]',2);insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,unit,target,due_date,checklist,status,measurement_version) values(${lit(task)},${lit(org)},${lit(assignment)},${lit(company)},${lit(owner)},${lit(team)},${lit(monthPeriod)}::date,${lit(scheduledOn)}::date,${lit(reference)},'operativa',null,'documentos',null,${lit(scheduledOn)}::date,'[]','Pendiente',2);`);
        const actorCheck = (await observer.ok(`select (select role='empleado' and active from public.profiles where id=${lit(owner)})||'|'||(select active from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(owner)})||'|'||(select role='jefe' and active from public.profiles where id=${lit(boss)})||'|'||(select count(*)=1 from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(boss)} and active);`)).at(-1);
        assert.equal(actorCheck, "true|true|true|true", `${order}/${isolation}: distinct active authorized employee and chief`);
        const snapshot = async () => JSON.parse((await reviewer.ok(`select jsonb_build_object(
          'membership',(select to_jsonb(m) from public.company_memberships m where m.organization_id=${lit(org)} and m.company_id=${lit(company)} and m.profile_id=${lit(owner)}),
          'task',(select to_jsonb(t) from public.task_instances t where t.id=${lit(task)}),
          'assignment',(select to_jsonb(a) from public.task_assignments a where a.id=${lit(assignment)}),
          'activity',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) from public.activity_entries e where e.instance_id=${lit(task)}),
          'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.operation_id),'[]'::jsonb) from app_private.api_command_receipts r where r.operation_id in (${lit(recordOp)},${lit(revokeOp)})),
          'membershipEvents',(select coalesce(jsonb_agg(to_jsonb(e) order by e.revision),'[]'::jsonb) from app_private.company_membership_events e where e.organization_id=${lit(org)} and e.company_id=${lit(company)} and e.profile_id=${lit(owner)}),
          'activityAudit',(select coalesce(jsonb_agg(to_jsonb(e) order by e.at,e.id),'[]'::jsonb) from public.audit_events e where e.organization_id=${lit(org)} and e.action='activity.created' and e.details->>'instance'=${lit(task)}),
          'membershipAudit',(select coalesce(jsonb_agg(to_jsonb(e) order by e.at,e.id),'[]'::jsonb) from public.audit_events e where e.organization_id=${lit(org)} and e.action='companyMembership.setActive' and e.entity_id=${lit(company)} and e.details->>'profileId'=${lit(owner)}),
          'fences',jsonb_build_object(
            'membership',coalesce((select f.fence_epoch from app_private.api_membership_fences f where f.organization_id=${lit(org)} and f.profile_id=${lit(owner)}),0),
            'recordOperation',coalesce((select f.fence_epoch from app_private.api_operation_fences f where f.actor_id=${lit(owner)} and f.operation_id=${lit(recordOp)}),0),
            'revokeOperation',coalesce((select f.fence_epoch from app_private.api_operation_fences f where f.actor_id=${lit(boss)} and f.operation_id=${lit(revokeOp)}),0),
            'month',coalesce((select f.fence_epoch from app_private.api_month_fences f where f.organization_id=${lit(org)} and f.owner_id=${lit(owner)} and f.period=${lit(monthPeriod)}::date),0),
            'graph',coalesce((select g.fence_epoch from app_private.task_dependency_graphs g where g.organization_id=${lit(org)} and g.company_id=${lit(company)} and g.period=${lit(monthPeriod)}::date),0)
          )
        )::text;`)).at(-1));
        const baseline = await snapshot();
        assert.equal(baseline.membership.active, true); assert.equal(baseline.membership.revision, 0);
        assert.equal(baseline.task.status, "Pendiente"); assert.equal(baseline.task.state_revision, 0); assert.equal(baseline.task.measurement_version, 2);
        assert.equal(baseline.task.unit, "documentos"); assert.equal(baseline.task.target, null); assert.equal(baseline.task.weight, null);
        assert.equal(baseline.assignment.measurement_version, 2); assert.equal(baseline.assignment.unit, "documentos");
        assert.equal(baseline.assignment.target, null); assert.equal(baseline.assignment.weight, null);
        assert.deepEqual(baseline.activity, []); assert.deepEqual(baseline.receipts, []);
        const beginAs = async (session, actor, aal) => {
          await session.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal }))},false);set role authenticated;begin isolation level ${iso};`);
          assert.equal((await session.ok("select current_setting('transaction_isolation');")).at(-1), iso, `${order}/${isolation}: effective isolation`);
          return Number((await session.ok("select pg_backend_pid();")).at(-1));
        };
        const diagnostic = async (state) => {
          const data = { order, isolation, actorCheck, actors: { employee: owner, chief: boss }, operationIds: { record: recordOp, revoke: revokeOp }, baseline, ...state, postgresLog: join(out, "postgres.log") };
          const path = join(out, `m2-2c-operation-record-membership-revocation-race-${order}-${isolation.toLowerCase()}-diagnostic.json`);
          writeFileSync(path, JSON.stringify(data, null, 2));
          record(`M2.2C operation.record/membership revoke diagnostic ${order}/${isolation}`, false, { path, data });
          return data;
        };
        const firstAction = order === "record-first" ? "record" : "revoke";
        const winnerActor = firstAction === "record" ? owner : boss;
        const winnerAal = firstAction === "record" ? "aal1" : "aal2";
        const loserActor = firstAction === "record" ? boss : owner;
        const loserAal = firstAction === "record" ? "aal2" : "aal1";
        const winnerCommand = firstAction === "record" ? recordCommand : revokeCommand;
        const loserCommand = firstAction === "record" ? revokeCommand : recordCommand;
        const expectedLoser = "40001";
        const winnerPid = await beginAs(a, winnerActor, winnerAal);
        const winnerResult = await a.query(`select api.command_v1('${JSON.stringify(winnerCommand).replaceAll("'", "''")}'::jsonb);`);
        if (winnerResult.code !== "00000") { const after = await snapshot(); await diagnostic({ winnerResult, after }); throw Error(`M2.2C unexpected winner SQLSTATE ${order}/${isolation}: ${winnerResult.code}`); }
        const loserPid = await beginAs(b, loserActor, loserAal);
        await b.ok(`select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(owner)};select status,state_revision from public.task_instances where id=${lit(task)};`);
        const pendingLoser = b.query(`select api.command_v1('${JSON.stringify(loserCommand).replaceAll("'", "''")}'::jsonb);`);
        let blocked = false; const deadline = Date.now() + 10000;
        while (Date.now() < deadline) { if ((await reviewer.ok(`select ${winnerPid}=any(pg_catalog.pg_blocking_pids(${loserPid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise(done => setTimeout(done, 20)); }
        const blockerPids = (await reviewer.ok(`select pg_catalog.pg_blocking_pids(${loserPid})::text;`)).at(-1);
        if (!blocked) {
          await a.ok("commit;"); const loserResult = await pendingLoser; await b.ok(loserResult.code === "00000" ? "commit;" : "rollback;");
          await diagnostic({ winnerPid, loserPid, blockerPids, blocked, winnerSQLSTATE: winnerResult.code, loserSQLSTATE: loserResult.code, loserResponse: loserResult.lines.at(-1), loserErrors: loserResult.errors, afterWinnerAndLoser: await snapshot() });
          throw Error(`M2.2C no real concurrent blocker ${order}/${isolation}`);
        }
        await a.ok("commit;");
        const winnerOnly = await snapshot();
        const loserResult = await pendingLoser;
        const actualFirstLoserSQLSTATE = loserResult.code;
        await b.ok(actualFirstLoserSQLSTATE === "00000" ? "commit;" : "rollback;");
        const afterFirstAttempt = await snapshot();
        if (actualFirstLoserSQLSTATE !== expectedLoser) {
          await diagnostic({ winnerPid, loserPid, blockerPids, blocked, winnerSQLSTATE: winnerResult.code, winnerResponse: winnerResult.lines.at(-1), winnerOnly, loserSQLSTATE: actualFirstLoserSQLSTATE, loserResponse: loserResult.lines.at(-1), loserErrors: loserResult.errors, afterFirstAttempt });
          throw Error(`M2.2C SQLSTATE mismatch ${order}/${isolation}: expected ${expectedLoser}, observed ${actualFirstLoserSQLSTATE}`);
        }
        assert.deepEqual(afterFirstAttempt, winnerOnly, "the stale losing command must leave winner-only state unchanged");
        let retryResult, retryResponse = null, recordResponse = null, revokeResponse = null;
        const retry = new Session(); auxiliarySessions.push(retry);
        await retry.ok("\\set VERBOSITY verbose\nset statement_timeout='15s';");
        const retryActor = firstAction === "record" ? boss : owner;
        await beginAs(retry, retryActor, firstAction === "record" ? "aal2" : "aal1");
        const retryCommand = firstAction === "record" ? revokeCommand : recordCommand;
        retryResult = await retry.query(`select api.command_v1('${JSON.stringify(retryCommand).replaceAll("'", "''")}'::jsonb);`);
        const expectedRetry = firstAction === "record" ? "00000" : "42501";
        if (retryResult.code !== expectedRetry) {
          await retry.ok(retryResult.code === "00000" ? "commit;" : "rollback;");
          await retry.ok("reset role;"); await retry.close(); auxiliarySessions.splice(auxiliarySessions.indexOf(retry), 1);
          await diagnostic({ winnerPid, loserPid, blockerPids, blocked, winnerSQLSTATE: winnerResult.code, winnerOnly, loserSQLSTATE: actualFirstLoserSQLSTATE, loserErrors: loserResult.errors, afterFirstAttempt, retrySQLSTATE: retryResult.code, expectedRetrySQLSTATE: expectedRetry, retryResponse: retryResult.lines.at(-1), retryErrors: retryResult.errors, afterRetryUnexpected: await snapshot() });
          throw Error(`M2.2C retry SQLSTATE mismatch ${order}/${isolation}: expected ${expectedRetry}, observed ${retryResult.code}`);
        }
        if (expectedRetry === "00000") await retry.ok("commit;"); else await retry.ok("rollback;");
        retryResponse = retryResult.lines.at(-1);
        await retry.ok("reset role;"); await retry.close(); auxiliarySessions.splice(auxiliarySessions.indexOf(retry), 1);
        if (firstAction === "record") { recordResponse = winnerResult.lines.at(-1); revokeResponse = retryResponse; }
        else { revokeResponse = winnerResult.lines.at(-1); }
        const final = await snapshot();
        const fenceExpectations = firstAction === "record"
          ? { membership: baseline.fences.membership + 2, recordOperation: baseline.fences.recordOperation + 1, revokeOperation: baseline.fences.revokeOperation + 1, month: baseline.fences.month + 1, graph: baseline.fences.graph }
          : { membership: baseline.fences.membership + 1, recordOperation: baseline.fences.recordOperation, revokeOperation: baseline.fences.revokeOperation + 1, month: baseline.fences.month, graph: baseline.fences.graph };
        try { assert.deepEqual(final.fences, fenceExpectations); }
        catch {
          await diagnostic({ winnerPid, loserPid, blockerPids, blocked, winnerSQLSTATE: winnerResult.code, winnerResponse: winnerResult.lines.at(-1), winnerOnly, loserSQLSTATE: actualFirstLoserSQLSTATE, loserResponse: loserResult.lines.at(-1), loserErrors: loserResult.errors, retrySQLSTATE: retryResult.code, retryResponse, afterFirstAttempt, final, fenceExpectations });
          throw Error(`M2.2C fence footprint differs ${order}/${isolation}: observed ${JSON.stringify(final.fences)}, expected ${JSON.stringify(fenceExpectations)}`);
        }
        if (firstAction === "record") {
          const envelope = JSON.parse(recordResponse), activity = final.activity[0], recordReceipt = final.receipts.find(r => r.operation_id === recordOp), revokeReceipt = final.receipts.find(r => r.operation_id === revokeOp);
          assert.equal(final.membership.active, false); assert.equal(final.membership.revision, 1);
          assert.equal(final.activity.length, 1); assert.equal(activity.actor_id, owner); assert.equal(activity.quantity, 1); assert.equal(activity.reference, reference);
          assert.equal(activity.measurement_version, 2); assert.equal(activity.unit_snapshot, "documentos"); assert.equal(activity.operational_rate_id, null); assert.equal(activity.operational_unit_weight, null);
          assert.equal(envelope.result.entryId, activity.id); assert.equal(envelope.result.taskRevision, "1"); assert.equal(envelope.result.measurementVersion, 2); assert.equal(envelope.result.rateId, null); assert.equal(envelope.result.unitWeight, null); assert.equal(envelope.result.weightedLoad, null);
          assert.deepEqual(envelope, recordReceipt.result); assert.equal(final.task.state_revision, 2);
          assert.equal(final.receipts.length, 2); assert.deepEqual(final.receipts.map(r => r.operation_id).sort(), [recordOp, revokeOp].sort());
          assert.equal(final.membershipEvents.length, 1); assert.equal(final.activityAudit.length, 1); assert.equal(final.membershipAudit.length, 1);
          assert.equal(final.activityAudit[0].entity_id, activity.id); assert.equal(final.activityAudit[0].details.instance, task);
          assert.equal(revokeReceipt.actor_id, boss); assert.equal(revokeReceipt.operation_id, revokeOp);
          assert.equal(revokeReceipt.result.kind, "companyMembership.setActive"); assert.equal(revokeReceipt.result.result.active, false);
          assert.deepEqual(JSON.parse(revokeResponse), revokeReceipt.result, "full companyMembership.setActive response must equal its receipt result");
          assert.equal(afterFirstAttempt.membership.active, true); assert.equal(afterFirstAttempt.membership.revision, 0);
          assert.equal(afterFirstAttempt.activity.length, 1); assert.equal(afterFirstAttempt.task.state_revision, 1);
          assert.equal(afterFirstAttempt.receipts.length, 1); assert.equal(afterFirstAttempt.receipts[0].operation_id, recordOp);
          assert.equal(winnerOnly.activity.length, 1); assert.equal(winnerOnly.membership.active, true);
          const recordReceiptResult = recordReceipt.result;
          assert.deepEqual(recordReceiptResult, envelope);
          record(`M2.2C operation.record-first membership revoke ${isolation} blocks, stale-aborts, retry commits exact once`, true, { order, isolation: iso, actors: { employee: owner, chief: boss }, actorCheck, winnerPid, loserPid, blockerPids, blocked, winnerSQLSTATE: winnerResult.code, loserSQLSTATE: actualFirstLoserSQLSTATE, retrySQLSTATE: retryResult.code, baseline, winnerOnly, afterFirstAttempt, responses: { record: envelope, revoke: JSON.parse(revokeResponse) }, receipts: { record: recordReceipt, revoke: revokeReceipt }, activityEntry: activity, final });
        } else {
          const recordReceipt = final.receipts.find(r => r.operation_id === recordOp), revokeReceipt = final.receipts.find(r => r.operation_id === revokeOp);
          assert.equal(winnerOnly.membership.active, false); assert.equal(winnerOnly.membership.revision, 1);
          assert.equal(winnerOnly.task.state_revision, 1); assert.deepEqual(winnerOnly.activity, []);
          assert.equal(winnerOnly.receipts.length, 1); assert.equal(winnerOnly.receipts[0].operation_id, revokeOp);
          assert.deepEqual(final, winnerOnly, "freshly denied record retry must be inert");
          assert.equal(final.membership.active, false); assert.equal(final.membership.revision, 1); assert.equal(final.task.state_revision, 1);
          assert.deepEqual(final.activity, []); assert.equal(final.receipts.length, 1); assert.equal(recordReceipt, undefined);
          assert.equal(revokeReceipt.actor_id, boss); assert.equal(revokeReceipt.operation_id, revokeOp);
          assert.equal(final.membershipEvents.length, 1); assert.equal(final.activityAudit.length, 0); assert.equal(final.membershipAudit.length, 1);
          assert.deepEqual(JSON.parse(revokeResponse), revokeReceipt.result, "full companyMembership.setActive response must equal its receipt result");
          assert.equal(final.fences.membership, baseline.fences.membership + 1); assert.equal(final.fences.recordOperation, baseline.fences.recordOperation); assert.equal(final.fences.revokeOperation, baseline.fences.revokeOperation + 1);
          assert.deepEqual(afterFirstAttempt, winnerOnly); assert.deepEqual(winnerOnly.activity, []);
          record(`M2.2C membership revoke-first operation.record ${isolation} blocks, stale-aborts and fresh retry denies without writes`, true, { order, isolation: iso, actors: { employee: owner, chief: boss }, actorCheck, winnerPid, loserPid, blockerPids, blocked, winnerSQLSTATE: winnerResult.code, loserSQLSTATE: actualFirstLoserSQLSTATE, retrySQLSTATE: retryResult.code, retryResponse, retryErrors: retryResult.errors, baseline, winnerOnly, afterFirstAttempt, final, revokeResponse: JSON.parse(revokeResponse), revokeReceipt });
        }
        await a.ok("reset role;"); await b.ok("reset role;");
      }
      await operationRecordMembershipRace({ order: "record-first", isolation: "RC", base: 22000 });
      await operationRecordMembershipRace({ order: "revoke-first", isolation: "RC", base: 22010 });
      await operationRecordMembershipRace({ order: "record-first", isolation: "RR", base: 22020 });
      await operationRecordMembershipRace({ order: "revoke-first", isolation: "RR", base: 22030 });

      // First-execution assignment.create versus membership revocation. Each
      // case owns its company/team and two distinct AAL2 chiefs; all creation,
      // month, graph and membership fences are explicitly materialized at 0.
      async function assignmentCreateMembershipRace({ order, isolation, base }) {
        const iso = isolation === "RC" ? "read committed" : "repeatable read";
        const creator = uid(base), revoker = uid(base + 1), owner = uid(base + 2);
        const companyId = uid(base + 3), teamId = uid(base + 4), createOp = uid(base + 5), revokeOp = uid(base + 6);
        const label = `M2.2C assignment create ${order} ${isolation}`;
        const period = monthPeriod, date = scheduledOn, weekday = 1;
        assert.notEqual(creator, revoker);
        await observer.ok(`insert into auth.users(id) values(${lit(creator)}),(${lit(revoker)}),(${lit(owner)});
          insert into public.profiles(id,organization_id,name,role,sector,branch,position) values
            (${lit(creator)},${lit(org)},${lit(label)}||' creator','jefe','Assignment race','Assignment race','Chief'),
            (${lit(revoker)},${lit(org)},${lit(label)}||' revoker','jefe','Assignment race','Assignment race','Chief'),
            (${lit(owner)},${lit(org)},${lit(label)}||' employee','empleado','Assignment race','Assignment race','Employee');
          insert into public.companies(id,organization_id,name) values(${lit(companyId)},${lit(org)},${lit(label)}||' company');
          insert into public.teams(id,organization_id,name,manager_id) values(${lit(teamId)},${lit(org)},${lit(label)}||' team',${lit(creator)});
          insert into public.company_memberships(organization_id,company_id,profile_id) values
            (${lit(org)},${lit(companyId)},${lit(owner)}),(${lit(org)},${lit(companyId)},${lit(creator)}),(${lit(org)},${lit(companyId)},${lit(revoker)});
          insert into public.team_members(organization_id,team_id,profile_id) values
            (${lit(org)},${lit(teamId)},${lit(owner)}),(${lit(org)},${lit(teamId)},${lit(creator)}),(${lit(org)},${lit(teamId)},${lit(revoker)});
          insert into app_private.api_creation_heads(organization_id,owner_id,revision,fence_epoch) values(${lit(org)},${lit(owner)},0,0)
            on conflict(organization_id,owner_id) do update set revision=0,fence_epoch=0;
          insert into app_private.api_month_fences(organization_id,owner_id,period,fence_epoch) values(${lit(org)},${lit(owner)},${lit(period)}::date,0)
            on conflict(owner_id,period) do update set fence_epoch=0;
          insert into app_private.task_dependency_graphs(organization_id,company_id,period,config_revision,fence_epoch)
            values(${lit(org)},${lit(companyId)},${lit(period)}::date,0,0)
            on conflict(organization_id,company_id,period) do update set config_revision=0,fence_epoch=0;`);
        const createCommand = { contractVersion: 1, operationId: createOp, kind: "assignment.create",
          expectedRevisions: { [`creation:${owner}`]: "0" },
          payload: { ownerId: owner, companyId, teamId,
            source: { type: "custom", definition: { kind: "operativa", title: label, objective: `${label} synthetic objective`, sector: "Assignment race", unit: "documentos" } },
            schedule: { frequency: "unica", startDate: date, endDate: date, interval: 1, weekdays: [], monthDay: Number(date.slice(-2)), hasDeadline: true, dueOffsetDays: 0 } } };
        const revokeCommand = { contractVersion: 1, operationId: revokeOp, kind: "companyMembership.setActive",
          expectedRevisions: { [`membership:${companyId}:${owner}`]: "0" },
          payload: { companyId, profileId: owner, active: false, reason: `${label} synthetic revocation` } };
        const snapshot = async () => JSON.parse((await observer.ok(`select jsonb_build_object(
          'profiles',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.profiles p where p.id in (${lit(owner)},${lit(creator)},${lit(revoker)})),
          'memberships',(select coalesce(jsonb_agg(to_jsonb(m) order by m.profile_id),'[]'::jsonb) from public.company_memberships m where m.organization_id=${lit(org)} and m.company_id=${lit(companyId)}),
          'teamMembers',(select coalesce(jsonb_agg(to_jsonb(tm) order by tm.profile_id),'[]'::jsonb) from public.team_members tm where tm.organization_id=${lit(org)} and tm.team_id=${lit(teamId)}),
          'assignments',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.task_assignments a where a.organization_id=${lit(org)} and a.owner_id=${lit(owner)} and a.company_id=${lit(companyId)}),
          'chiefAssignments',(select count(*) from public.task_assignments a where a.organization_id=${lit(org)} and a.company_id=${lit(companyId)} and a.owner_id in (${lit(creator)},${lit(revoker)})),
          'chiefInstances',(select count(*) from public.task_instances i where i.organization_id=${lit(org)} and i.company_id=${lit(companyId)} and i.owner_id in (${lit(creator)},${lit(revoker)})),
          'instances',(select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb) from public.task_instances i where i.organization_id=${lit(org)} and i.owner_id=${lit(owner)} and i.company_id=${lit(companyId)}),
          'sessions',(select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) from public.task_time_sessions s where s.organization_id=${lit(org)} and (s.actor_id in (${lit(owner)},${lit(creator)},${lit(revoker)}) or s.instance_id in (select id from public.task_instances where owner_id=${lit(owner)} and company_id=${lit(companyId)}))),
          'head',(select to_jsonb(h) from app_private.api_creation_heads h where h.organization_id=${lit(org)} and h.owner_id=${lit(owner)}),
          'month',(select to_jsonb(f) from app_private.api_month_fences f where f.organization_id=${lit(org)} and f.owner_id=${lit(owner)} and f.period=${lit(period)}::date),
          'graph',(select to_jsonb(g) from app_private.task_dependency_graphs g where g.organization_id=${lit(org)} and g.company_id=${lit(companyId)} and g.period=${lit(period)}::date),
          'fences',jsonb_build_object(
            'membershipOwner',(select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(owner)}),
            'membershipCreator',(select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(creator)}),
            'membershipRevoker',(select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(revoker)}),
            'month',(select fence_epoch from app_private.api_month_fences where organization_id=${lit(org)} and owner_id=${lit(owner)} and period=${lit(period)}::date),
            'graph',(select fence_epoch from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(companyId)} and period=${lit(period)}::date),
            'graphConfig',(select config_revision from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(companyId)} and period=${lit(period)}::date),
            'creationRevision',(select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(owner)}),
            'creation',(select fence_epoch from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(owner)}),
            'createOperation',coalesce((select fence_epoch from app_private.api_operation_fences where actor_id=${lit(creator)} and operation_id=${lit(createOp)}),0),
            'revokeOperation',coalesce((select fence_epoch from app_private.api_operation_fences where actor_id=${lit(revoker)} and operation_id=${lit(revokeOp)}),0)),
          'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.operation_id),'[]'::jsonb) from app_private.api_command_receipts r where r.operation_id in (${lit(createOp)},${lit(revokeOp)})),
          'operationFences',(select coalesce(jsonb_agg(to_jsonb(f) order by f.actor_id,f.operation_id),'[]'::jsonb) from app_private.api_operation_fences f where f.operation_id in (${lit(createOp)},${lit(revokeOp)})),
          'assignmentAudit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.audit_events a where a.organization_id=${lit(org)} and a.action='assignment.create' and (a.entity_id in (select id from public.task_assignments where owner_id=${lit(owner)} and company_id=${lit(companyId)}) or a.details->>'ownerId'=${lit(owner)})),
          'membershipAudit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.audit_events a where a.organization_id=${lit(org)} and a.action='companyMembership.setActive' and (a.entity_id=${lit(companyId)} or a.details->>'profileId'=${lit(owner)})),
          'membershipEvents',(select coalesce(jsonb_agg(to_jsonb(e) order by e.revision),'[]'::jsonb) from app_private.company_membership_events e where e.organization_id=${lit(org)} and e.company_id=${lit(companyId)} and e.profile_id=${lit(owner)}),
          'activity',(select count(*) from public.activity_entries e where e.organization_id=${lit(org)} and e.actor_id in (${lit(owner)},${lit(creator)},${lit(revoker)})),
          'closures',(select count(*) from public.monthly_closures c where c.organization_id=${lit(org)} and c.owner_id=${lit(owner)}),
          'absences',(select count(*) from public.employee_absences x where x.organization_id=${lit(org)} and (x.owner_id=${lit(owner)} or x.replacement_id=${lit(owner)})),
          'coverage',(select count(*) from public.task_coverage_bindings b where b.organization_id=${lit(org)} and b.company_id_snapshot=${lit(companyId)}),
          'responsibilityHeads',(select count(*) from public.task_responsibility_heads h join public.task_instances i on i.id=h.instance_id where i.organization_id=${lit(org)} and i.company_id=${lit(companyId)} and i.owner_id=${lit(owner)}),
          'dependencies',(select count(*) from app_private.task_dependencies d where d.organization_id=${lit(org)} and d.company_id=${lit(companyId)} and d.period=${lit(period)}::date),
          'tracking',(select count(*) from app_private.task_tracking t join public.task_instances i on i.id=t.instance_id where i.organization_id=${lit(org)} and i.company_id=${lit(companyId)} and i.owner_id=${lit(owner)}),
          'trackingEvents',(select count(*) from app_private.task_tracking_events e join public.task_instances i on i.id=e.instance_id where i.organization_id=${lit(org)} and i.company_id=${lit(companyId)} and i.owner_id=${lit(owner)}),
          'completionEvents',(select count(*) from app_private.task_completion_events e join public.task_instances i on i.id=e.instance_id where i.organization_id=${lit(org)} and i.company_id=${lit(companyId)} and i.owner_id=${lit(owner)}),
          'parameterization',(select count(*) from app_private.assignment_parameterization p where p.organization_id=${lit(org)} and p.assignment_id in (select id from public.task_assignments where owner_id=${lit(owner)} and company_id=${lit(companyId)}))
        )::text;`)).at(-1));
        const baseline = await snapshot();
        assert.equal(baseline.profiles.length, 3); assert.equal(baseline.memberships.length, 3); assert.equal(baseline.teamMembers.length, 3);
        assert.equal(baseline.assignments.length, 0); assert.equal(baseline.chiefAssignments, 0); assert.equal(baseline.chiefInstances, 0); assert.deepEqual(baseline.instances, []); assert.deepEqual(baseline.sessions, []);
        assert.equal(baseline.head.revision, 0); assert.equal(baseline.head.fence_epoch, 0);
        assert.equal(baseline.month.fence_epoch, 0); assert.equal(baseline.graph.fence_epoch, 0); assert.equal(baseline.graph.config_revision, 0);
        assert.deepEqual(baseline.receipts, []); assert.deepEqual(baseline.operationFences, []); assert.deepEqual(baseline.assignmentAudit, []); assert.deepEqual(baseline.membershipAudit, []); assert.deepEqual(baseline.membershipEvents, []);
        assert.equal(baseline.activity, 0); assert.equal(baseline.closures, 0); assert.equal(baseline.absences, 0); assert.equal(baseline.coverage, 0);
        assert.equal(baseline.responsibilityHeads, 0); assert.equal(baseline.dependencies, 0); assert.equal(baseline.tracking, 0); assert.equal(baseline.trackingEvents, 0); assert.equal(baseline.completionEvents, 0); assert.equal(baseline.parameterization, 0);
        assert.deepEqual(baseline.fences, { membershipOwner: 0, membershipCreator: 0, membershipRevoker: 0, month: 0, graph: 0, graphConfig: 0, creationRevision: 0, creation: 0, createOperation: 0, revokeOperation: 0 });
        const claimsFor = async (session, actor, aal) => {
          const row = (await session.ok(`select coalesce(auth.uid()::text,'')||'|'||coalesce(current_setting('request.jwt.claim.sub',true),'')||'|'||coalesce((current_setting('request.jwt.claims',true)::jsonb->>'sub'),'')||'|'||coalesce((current_setting('request.jwt.claims',true)::jsonb->>'aal'),'')||'|'||current_setting('transaction_isolation')||'|'||current_user||'|'||coalesce((current_setting('request.jwt.claims',true)::jsonb->>'role'),'');`)).at(-1).split("|");
          const observed = { uid: row[0], jwtSub: row[1], claimsSub: row[2], aal: row[3], isolation: row[4], currentUser: row[5], claimsRole: row[6] };
          assert.deepEqual(observed, { uid: actor, jwtSub: actor, claimsSub: actor, aal, isolation: iso, currentUser: "authenticated", claimsRole: "authenticated" }, `${order}/${isolation}: effective claims`);
          return observed;
        };
        const runAs = async (session, actor, aal) => {
          await session.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal }))},false);set role authenticated;begin isolation level ${iso};`);
          return { pid: Number((await session.ok("select pg_backend_pid();")).at(-1)), claims: await claimsFor(session, actor, aal) };
        };
        const winnerAction = order === "assignment-first" ? "assignment" : "revoke";
        const winnerActor = winnerAction === "assignment" ? creator : revoker, loserActor = winnerAction === "assignment" ? revoker : creator;
        const winnerCommand = winnerAction === "assignment" ? createCommand : revokeCommand, loserCommand = winnerAction === "assignment" ? revokeCommand : createCommand;
        const winnerAal = "aal2", loserAal = "aal2", expectedRetry = winnerAction === "assignment" ? "00000" : "42501";
        const winnerContext = await runAs(a, winnerActor, winnerAal);
        const winnerResult = await a.query(`select api.command_v1('${JSON.stringify(winnerCommand).replaceAll("'", "''")}'::jsonb);`);
        if (winnerResult.code !== "00000") throw Error(`${label}: winner expected 00000, observed ${winnerResult.code}: ${winnerResult.errors}`);
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(loserActor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: loserActor, aal: loserAal }))},false);set role authenticated;begin isolation level ${iso};select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(companyId)} and profile_id=${lit(owner)};`);
        const loserPid = Number((await b.ok("select pg_backend_pid();")).at(-1)), loserClaims = await claimsFor(b, loserActor, loserAal);
        const pendingLoser = b.query(`select api.command_v1('${JSON.stringify(loserCommand).replaceAll("'", "''")}'::jsonb);`);
        let blocked = false; const deadline = Date.now() + 10000;
        while (Date.now() < deadline) { if ((await observer.ok(`select ${winnerContext.pid}=any(pg_catalog.pg_blocking_pids(${loserPid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise(done => setTimeout(done, 20)); }
        const blockerPids = (await observer.ok(`select pg_catalog.pg_blocking_pids(${loserPid})::text;`)).at(-1);
        if (!blocked) { await a.ok("commit;"); const r = await pendingLoser; await b.ok(r.code === "00000" ? "commit;" : "rollback;"); throw Error(`${label}: expected real blocker; observed ${JSON.stringify({winnerPid:winnerContext.pid,loserPid,blockerPids,winner:r.code,loser:r.errors})}`); }
        await a.ok("commit;"); const winnerOnly = await snapshot();
        const loserResult = await pendingLoser; await b.ok(loserResult.code === "00000" ? "commit;" : "rollback;");
        const afterRollback = await snapshot();
        if (loserResult.code !== "40001") throw Error(`${label}: first loser expected 40001, observed ${loserResult.code}: ${loserResult.errors}; snapshot=${JSON.stringify(afterRollback)}`);
        assert.deepEqual(afterRollback, winnerOnly, `${label}: serialization loser must leave winner-only state`);
        const retry = new Session(); auxiliarySessions.push(retry); await retry.ok("\\set VERBOSITY verbose\nset statement_timeout='15s';");
        const retryContext = await runAs(retry, loserActor, loserAal);
        const retryResult = await retry.query(`select api.command_v1('${JSON.stringify(loserCommand).replaceAll("'", "''")}'::jsonb);`);
        if (retryResult.code !== expectedRetry) { await retry.ok(retryResult.code === "00000" ? "commit;" : "rollback;"); throw Error(`${label}: retry expected ${expectedRetry}, observed ${retryResult.code}: ${retryResult.errors}; snapshot=${JSON.stringify(await snapshot())}`); }
        if (expectedRetry === "00000") await retry.ok("commit;"); else await retry.ok("rollback;");
        const retryResponse = retryResult.lines.at(-1); await retry.ok("reset role;"); await retry.close(); auxiliarySessions.splice(auxiliarySessions.indexOf(retry), 1);
        const final = await snapshot();
        const fenceExpected = winnerAction === "assignment"
          ? { membershipOwner: 2, membershipCreator: 1, membershipRevoker: 0, month: 1, graph: 0, graphConfig: 0, creationRevision: 1, creation: 1, createOperation: 1, revokeOperation: 1 }
          : { membershipOwner: 1, membershipCreator: 0, membershipRevoker: 0, month: 0, graph: 0, graphConfig: 0, creationRevision: 0, creation: 0, createOperation: 0, revokeOperation: 1 };
        const winnerFenceExpected = winnerAction === "assignment"
          ? { membershipOwner: 1, membershipCreator: 1, membershipRevoker: 0, month: 1, graph: 0, graphConfig: 0, creationRevision: 1, creation: 1, createOperation: 1, revokeOperation: 0 }
          : { membershipOwner: 1, membershipCreator: 0, membershipRevoker: 0, month: 0, graph: 0, graphConfig: 0, creationRevision: 0, creation: 0, createOperation: 0, revokeOperation: 1 };
        try {
          assert.deepEqual(final.fences, fenceExpected);
          assert.equal(final.assignments.length, winnerAction === "assignment" ? 1 : 0);
          assert.equal(final.chiefAssignments, 0); assert.equal(final.chiefInstances, 0);
          assert.equal(final.operationFences.length, winnerAction === "assignment" ? 2 : 1);
          assert.equal(final.instances.length, 0); assert.equal(final.sessions.length, 0);
          assert.equal(final.activity, 0); assert.equal(final.closures, 0); assert.equal(final.absences, 0); assert.equal(final.coverage, 0);
          assert.equal(final.responsibilityHeads, 0); assert.equal(final.dependencies, 0); assert.equal(final.tracking, 0); assert.equal(final.trackingEvents, 0); assert.equal(final.completionEvents, 0); assert.equal(final.parameterization, 0);
          assert.equal(final.memberships.find(m => m.profile_id === owner).active, false);
          assert.equal(final.memberships.find(m => m.profile_id === owner).revision, 1);
          assert.deepEqual(final.graph, baseline.graph);
          assert.deepEqual(winnerOnly.fences, winnerFenceExpected, `${label}: exact winner-only fence vector`);
          if (winnerAction === "assignment") {
            assert.equal(winnerOnly.assignments.length, 1); assert.equal(winnerOnly.memberships.find(m => m.profile_id === owner).active, true);
            assert.equal(winnerOnly.head.revision, 1); assert.equal(winnerOnly.head.fence_epoch, 1); assert.equal(winnerOnly.month.fence_epoch, 1);
            assert.deepEqual(final.assignments, winnerOnly.assignments, `${label}: retry revoke must preserve assignment row exactly`);
            assert.equal(final.assignments.length, 1);
            const assignment = final.assignments[0];
            assert.equal(assignment.owner_id, owner); assert.equal(assignment.company_id, companyId); assert.equal(assignment.team_id, teamId);
            assert.equal(assignment.title, label); assert.equal(assignment.kind, "operativa");
            assert.equal(assignment.template_id, null); assert.equal(assignment.template_version_id, null);
            assert.equal(assignment.measurement_version, 2); assert.equal(assignment.weight, null); assert.equal(assignment.target, null);
            assert.equal(assignment.unit, "documentos"); assert.equal(assignment.frequency, "unica");
            assert.equal(assignment.start_month, period); assert.equal(assignment.start_date, date); assert.equal(assignment.end_date, date);
            assert.equal(assignment.interval_count, 1); assert.deepEqual(assignment.weekdays, [weekday]);
            assert.equal(assignment.month_day, Number(date.slice(-2))); assert.equal(assignment.has_deadline, true); assert.equal(assignment.due_offset_days, 0);
            assert.equal(assignment.due_day, Number(date.slice(-2))); assert.deepEqual(assignment.checklist, []);
            assert.equal(assignment.definition_revision, 1);
            assert.equal(final.receipts.length, 2); assert.equal(final.assignmentAudit.length, 1); assert.equal(final.membershipAudit.length, 1); assert.equal(final.membershipEvents.length, 1);
            assert.equal(final.operationFences.find(f => f.operation_id === createOp).fence_epoch, 1); assert.equal(final.operationFences.find(f => f.operation_id === revokeOp).fence_epoch, 1);
          } else {
            assert.deepEqual(final, winnerOnly); assert.deepEqual(final.assignments, []);
            assert.equal(final.head.revision, 0); assert.equal(final.head.fence_epoch, 0); assert.equal(final.month.fence_epoch, 0);
            assert.equal(final.receipts.length, 1); assert.deepEqual(final.assignmentAudit, []); assert.deepEqual(final.membershipAudit.length, 1); assert.equal(final.membershipEvents.length, 1);
            assert.equal(final.operationFences[0].operation_id, revokeOp); assert.equal(final.operationFences[0].fence_epoch, 1);
          }
        } catch (error) { throw Error(`${label}: final invariant failed: ${error.message}; expected=${JSON.stringify(fenceExpected)} observed=${JSON.stringify(final)}`); }
        const receiptCreate = final.receipts.find(r => r.operation_id === createOp), receiptRevoke = final.receipts.find(r => r.operation_id === revokeOp);
        if (receiptCreate) {
          const envelope = JSON.parse(winnerAction === "assignment" ? winnerResult.lines.at(-1) : retryResponse);
          assert.deepEqual(envelope, receiptCreate.result); assert.equal(receiptCreate.actor_id, creator); assert.equal(receiptCreate.kind, "assignment.create");
          assert.deepEqual(receiptCreate.arguments, { kind: "assignment.create", payload: createCommand.payload, expectedRevisions: createCommand.expectedRevisions });
          assert.equal(receiptCreate.result.result.assignmentId, final.assignments[0].id); assert.equal(receiptCreate.result.result.assignmentRevision, "1");
          assert.equal(final.assignmentAudit[0].actor_id, creator); assert.equal(final.assignmentAudit[0].entity_id, final.assignments[0].id);
          assert.equal(final.assignmentAudit[0].details.ownerId, owner);
        }
        assert.equal(receiptRevoke.actor_id, revoker); assert.equal(receiptRevoke.kind, "companyMembership.setActive");
        assert.deepEqual(receiptRevoke.arguments, { kind: "companyMembership.setActive", payload: revokeCommand.payload, expectedRevisions: revokeCommand.expectedRevisions });
        const revokeEnvelope = JSON.parse(winnerAction === "revoke" ? winnerResult.lines.at(-1) : retryResponse);
        assert.deepEqual(revokeEnvelope, receiptRevoke.result);
        assert.equal(final.membershipAudit[0].actor_id, revoker); assert.equal(final.membershipAudit[0].entity_id, companyId);
        assert.equal(final.membershipAudit[0].details.profileId, owner); assert.equal(final.membershipAudit[0].details.active, false);
        assert.equal(final.membershipEvents[0].actor_id, revoker); assert.equal(final.membershipEvents[0].company_id, companyId);
        assert.equal(final.membershipEvents[0].profile_id, owner); assert.equal(final.membershipEvents[0].revision, 1); assert.equal(final.membershipEvents[0].active, false);
        record(`M2.2C assignment.create versus membership revoke ${order} ${isolation} blocks, stale-aborts, exact retry`, true,
          { order, isolation: iso, actors: { owner, creator, revoker, distinctChiefs: creator !== revoker }, claims: { winner: winnerContext.claims, loser: loserClaims, retry: retryContext.claims }, pids: { winner: winnerContext.pid, loser: loserPid, blockerPids }, blocked, winnerSQLSTATE: winnerResult.code, winnerResponse: winnerResult.lines.at(-1), winnerErrors: winnerResult.errors, loserSQLSTATE: loserResult.code, loserResponse: loserResult.lines.at(-1), loserErrors: loserResult.errors, retrySQLSTATE: retryResult.code, retryResponse, retryErrors: retryResult.errors, baseline, winnerOnly, afterFirstAttemptAndRollback: afterRollback, final, expectedWinnerFences: winnerFenceExpected, expectedFences: fenceExpected, weekdayInput: [], weekdayPersisted: weekday, createdAssignment: final.assignments[0] ?? null });
        await a.ok("reset role;"); await b.ok("reset role;");
      }
      await assignmentCreateMembershipRace({ order: "assignment-first", isolation: "RC", base: 24000 });
      await assignmentCreateMembershipRace({ order: "revoke-first", isolation: "RC", base: 24020 });
      await assignmentCreateMembershipRace({ order: "assignment-first", isolation: "RR", base: 24040 });
      await assignmentCreateMembershipRace({ order: "revoke-first", isolation: "RR", base: 24060 });

      // First-execution task.createOneOff versus membership revocation. Each
      // isolated case proves creation of its task and trigger-sealed baseline
      // responsibility is visible to the waiting revocation planner.
      async function oneOffCreateMembershipRace({ order, isolation, base }) {
        const iso = isolation === "RC" ? "read committed" : "repeatable read";
        const createFirst = order === "create-first";
        const owner = uid(base), revoker = uid(base + 1), companyId = uid(base + 2), teamId = uid(base + 3);
        const createOp = uid(base + 4), revokeOp = uid(base + 5), title = `M2.2C one-off create ${order} ${isolation}`;
        const period = monthPeriod, date = scheduledOn, day = Number(date.slice(-2));
        await observer.ok(`insert into auth.users(id) values(${lit(owner)}),(${lit(revoker)});
          insert into public.profiles(id,organization_id,name,role,sector,branch,position) values
            (${lit(owner)},${lit(org)},${lit(title)}||' employee','empleado','OneOff race','OneOff race','Employee'),
            (${lit(revoker)},${lit(org)},${lit(title)}||' chief','jefe','OneOff race','OneOff race','Chief');
          insert into public.companies(id,organization_id,name) values(${lit(companyId)},${lit(org)},${lit(title)}||' company');
          insert into public.teams(id,organization_id,name,manager_id) values(${lit(teamId)},${lit(org)},${lit(title)}||' team',${lit(revoker)});
          insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(companyId)},${lit(owner)}),(${lit(org)},${lit(companyId)},${lit(revoker)});
          insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(teamId)},${lit(owner)}),(${lit(org)},${lit(teamId)},${lit(revoker)});
          insert into app_private.api_creation_heads(organization_id,owner_id,revision,fence_epoch) values(${lit(org)},${lit(owner)},0,0)
            on conflict(organization_id,owner_id) do update set revision=0,fence_epoch=0;
          insert into app_private.api_month_fences(organization_id,owner_id,period,fence_epoch) values(${lit(org)},${lit(owner)},${lit(period)}::date,0)
            on conflict(owner_id,period) do update set fence_epoch=0;
          insert into app_private.task_dependency_graphs(organization_id,company_id,period,config_revision,fence_epoch)
            values(${lit(org)},${lit(companyId)},${lit(period)}::date,0,0)
            on conflict(organization_id,company_id,period) do update set config_revision=0,fence_epoch=0;`);
        const createCommand = { contractVersion: 1, operationId: createOp, kind: "task.createOneOff",
          expectedRevisions: { [`creation:${owner}`]: "0" },
          payload: { ownerId: owner, companyId, teamId,
            source: { type: "custom", definition: { kind: "operativa", title, objective: `${title} objective`, sector: "OneOff synthetic", unit: "comprobantes" } },
            scheduledOn: date, dueDate: null, priority: "Media" } };
        const revokeCommand = { contractVersion: 1, operationId: revokeOp, kind: "companyMembership.setActive",
          expectedRevisions: { [`membership:${companyId}:${owner}`]: "0" },
          payload: { companyId, profileId: owner, active: false, reason: `${title} synthetic revocation` } };
        const snapshot = async () => JSON.parse((await observer.ok(`select jsonb_build_object(
          'profiles',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.profiles p where p.id in (${lit(owner)},${lit(revoker)})),
          'memberships',(select coalesce(jsonb_agg(to_jsonb(m) order by m.profile_id),'[]'::jsonb) from public.company_memberships m where m.organization_id=${lit(org)} and m.company_id=${lit(companyId)}),
          'teamMembers',(select coalesce(jsonb_agg(to_jsonb(tm) order by tm.profile_id),'[]'::jsonb) from public.team_members tm where tm.organization_id=${lit(org)} and tm.team_id=${lit(teamId)}),
          'assignments',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.task_assignments a where a.organization_id=${lit(org)} and a.company_id=${lit(companyId)}),
          'instances',(select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb) from public.task_instances i where i.organization_id=${lit(org)} and i.company_id=${lit(companyId)}),
          'responsibilities',(select coalesce(jsonb_agg(jsonb_build_object('head',to_jsonb(h),'set',to_jsonb(s),'members',(select coalesce(jsonb_agg(to_jsonb(m) order by m.profile_id),'[]'::jsonb) from public.task_responsibility_members m where m.set_id=h.set_id)) order by h.instance_id),'[]'::jsonb) from public.task_responsibility_heads h left join public.task_responsibility_sets s on s.id=h.set_id where h.organization_id=${lit(org)} and h.instance_id in (select i.id from public.task_instances i where i.organization_id=${lit(org)} and i.company_id=${lit(companyId)})),
          'responsibilityHeads',(select coalesce(jsonb_agg(to_jsonb(h) order by h.instance_id),'[]'::jsonb) from public.task_responsibility_heads h where h.organization_id=${lit(org)}),
          'responsibilitySets',(select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) from public.task_responsibility_sets s where s.organization_id=${lit(org)} and s.company_id_snapshot=${lit(companyId)}),
          'responsibilityMembers',(select coalesce(jsonb_agg(to_jsonb(m) order by m.set_id,m.profile_id),'[]'::jsonb) from public.task_responsibility_members m where m.organization_id=${lit(org)}),
          'sessions',(select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) from public.task_time_sessions s where s.organization_id=${lit(org)} and (s.actor_id in (${lit(owner)},${lit(revoker)}) or s.instance_id in (select i.id from public.task_instances i where i.company_id=${lit(companyId)} and i.owner_id=${lit(owner)}))),
          'creationHead',(select to_jsonb(h) from app_private.api_creation_heads h where h.organization_id=${lit(org)} and h.owner_id=${lit(owner)}),
          'monthFences',(select coalesce(jsonb_agg(to_jsonb(f) order by f.owner_id,f.period),'[]'::jsonb) from app_private.api_month_fences f where f.organization_id=${lit(org)} and f.owner_id in (${lit(owner)},${lit(revoker)})),
          'graph',(select to_jsonb(g) from app_private.task_dependency_graphs g where g.organization_id=${lit(org)} and g.company_id=${lit(companyId)} and g.period=${lit(period)}::date),
          'fences',jsonb_build_object(
            'membershipOwner',(select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(owner)}),
            'membershipRevoker',(select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(revoker)}),
            'monthOwner',(select fence_epoch from app_private.api_month_fences where organization_id=${lit(org)} and owner_id=${lit(owner)} and period=${lit(period)}::date),
            'monthRevoker',coalesce((select fence_epoch from app_private.api_month_fences where organization_id=${lit(org)} and owner_id=${lit(revoker)} and period=${lit(period)}::date),0),
            'graph',(select fence_epoch from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(companyId)} and period=${lit(period)}::date),
            'graphConfig',(select config_revision from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(companyId)} and period=${lit(period)}::date),
            'creationRevision',(select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(owner)}),
            'creation',(select fence_epoch from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(owner)}),
            'createOperation',coalesce((select fence_epoch from app_private.api_operation_fences where actor_id=${lit(owner)} and operation_id=${lit(createOp)}),0),
            'revokeOperation',coalesce((select fence_epoch from app_private.api_operation_fences where actor_id=${lit(revoker)} and operation_id=${lit(revokeOp)}),0)),
          'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.operation_id),'[]'::jsonb) from app_private.api_command_receipts r where r.operation_id in (${lit(createOp)},${lit(revokeOp)})),
          'periodReports',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from public.period_reports r where r.organization_id=${lit(org)} and r.owner_id in (${lit(owner)},${lit(revoker)})),
          'reportDeliveries',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) from public.report_deliveries d join public.period_reports r on r.id=d.report_id and r.organization_id=d.organization_id where d.organization_id=${lit(org)} and r.owner_id in (${lit(owner)},${lit(revoker)})),
          'monthlyClosures',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]'::jsonb) from public.monthly_closures c where c.organization_id=${lit(org)} and c.owner_id in (${lit(owner)},${lit(revoker)})),
          'reportOutboxRows',(select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) from public.report_outbox_events o join public.report_deliveries d on d.id=o.delivery_id and d.organization_id=o.organization_id join public.period_reports r on r.id=d.report_id and r.organization_id=d.organization_id where o.organization_id=${lit(org)} and r.owner_id in (${lit(owner)},${lit(revoker)})),
          'operationFences',(select coalesce(jsonb_agg(to_jsonb(f) order by f.actor_id,f.operation_id),'[]'::jsonb) from app_private.api_operation_fences f where f.operation_id in (${lit(createOp)},${lit(revokeOp)})),
          'createAudit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.audit_events a where a.organization_id=${lit(org)} and a.action='task.createOneOff' and (a.entity_id in (select x.id from public.task_assignments x where x.owner_id=${lit(owner)} and x.company_id=${lit(companyId)}) or a.details->>'ownerId'=${lit(owner)})),
          'membershipAudit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.audit_events a where a.organization_id=${lit(org)} and a.action='companyMembership.setActive' and (a.entity_id=${lit(companyId)} or a.details->>'profileId'=${lit(owner)})),
          'membershipEvents',(select coalesce(jsonb_agg(to_jsonb(e) order by e.revision),'[]'::jsonb) from app_private.company_membership_events e where e.organization_id=${lit(org)} and e.company_id=${lit(companyId)} and e.profile_id=${lit(owner)}),
          'sideEffects',jsonb_build_object(
            'activity',(select count(*) from public.activity_entries e where e.organization_id=${lit(org)} and (e.actor_id in (${lit(owner)},${lit(revoker)}) or e.instance_id in (select i.id from public.task_instances i where i.company_id=${lit(companyId)} and i.owner_id=${lit(owner)}))),
            'closures',(select count(*) from public.monthly_closures c where c.organization_id=${lit(org)} and c.owner_id in (${lit(owner)},${lit(revoker)})),
            'periodReports',(select count(*) from public.period_reports r where r.organization_id=${lit(org)} and r.owner_id in (${lit(owner)},${lit(revoker)})),
            'reportDeliveries',(select count(*) from public.report_deliveries d join public.period_reports r on r.id=d.report_id and r.organization_id=d.organization_id where d.organization_id=${lit(org)} and r.owner_id in (${lit(owner)},${lit(revoker)})),
            'absences',(select count(*) from public.employee_absences x where x.organization_id=${lit(org)} and (x.owner_id in (${lit(owner)},${lit(revoker)}) or x.replacement_id in (${lit(owner)},${lit(revoker)}))),
            'coverage',(select count(*) from public.task_coverage_bindings b where b.organization_id=${lit(org)} and b.company_id_snapshot=${lit(companyId)}),
            'dependencies',(select count(*) from app_private.task_dependencies d where d.organization_id=${lit(org)} and d.company_id=${lit(companyId)} and d.period=${lit(period)}::date),
            'tracking',(select count(*) from app_private.task_tracking t join public.task_instances i on i.id=t.instance_id where i.organization_id=${lit(org)} and i.company_id=${lit(companyId)} and i.owner_id=${lit(owner)}),
            'trackingEvents',(select count(*) from app_private.task_tracking_events e join public.task_instances i on i.id=e.instance_id where i.organization_id=${lit(org)} and i.company_id=${lit(companyId)} and i.owner_id=${lit(owner)}),
            'completionEvents',(select count(*) from app_private.task_completion_events e join public.task_instances i on i.id=e.instance_id where i.organization_id=${lit(org)} and i.company_id=${lit(companyId)} and i.owner_id=${lit(owner)}),
            'parameterization',(select count(*) from app_private.assignment_parameterization p where p.organization_id=${lit(org)} and p.assignment_id in (select x.id from public.task_assignments x where x.company_id=${lit(companyId)} and x.owner_id=${lit(owner)})),
            'mutationReceipts',(select count(*) from public.task_mutation_receipts r where r.organization_id=${lit(org)} and r.actor_id in (${lit(owner)},${lit(revoker)})),
            'outbox',(select count(*) from public.report_outbox_events o join public.report_deliveries d on d.id=o.delivery_id and d.organization_id=o.organization_id join public.period_reports r on r.id=d.report_id and r.organization_id=d.organization_id where o.organization_id=${lit(org)} and r.owner_id in (${lit(owner)},${lit(revoker)})))
        )::text;`)).at(-1));
        const baseline = await snapshot();
        assert.equal(baseline.profiles.length, 2); assert.equal(baseline.memberships.length, 2); assert.equal(baseline.teamMembers.length, 2);
        assert.deepEqual(baseline.assignments, []); assert.deepEqual(baseline.instances, []); assert.deepEqual(baseline.responsibilities, []); assert.deepEqual(baseline.sessions, []);
        assert.equal(baseline.creationHead.revision, 0); assert.equal(baseline.creationHead.fence_epoch, 0); assert.equal(baseline.monthFences.length, 1); assert.deepEqual(baseline.monthFences[0], {organization_id:org,owner_id:owner,period,fence_epoch:0});
        assert.equal(baseline.graph.fence_epoch, 0); assert.equal(baseline.graph.config_revision, 0); assert.deepEqual(baseline.receipts, []); assert.deepEqual(baseline.operationFences, []); assert.deepEqual(baseline.reportOutboxRows, []);
        assert.deepEqual(baseline.createAudit, []); assert.deepEqual(baseline.membershipAudit, []); assert.deepEqual(baseline.membershipEvents, []); assert.deepEqual(baseline.periodReports, []); assert.deepEqual(baseline.reportDeliveries, []); assert.deepEqual(baseline.monthlyClosures, []);
        assert.deepEqual(baseline.fences, { membershipOwner: 0, membershipRevoker: 0, monthOwner: 0, monthRevoker: 0, graph: 0, graphConfig: 0, creationRevision: 0, creation: 0, createOperation: 0, revokeOperation: 0 });
        assert.deepEqual(baseline.sideEffects, { activity: 0, closures: 0, periodReports: 0, reportDeliveries: 0, absences: 0, coverage: 0, dependencies: 0, tracking: 0, trackingEvents: 0, completionEvents: 0, parameterization: 0, mutationReceipts: 0, outbox: 0 });
        const claimsFor = async (session, actor, aal) => {
          const row = (await session.ok(`select coalesce(auth.uid()::text,'')||'|'||coalesce(current_setting('request.jwt.claim.sub',true),'')||'|'||coalesce((current_setting('request.jwt.claims',true)::jsonb->>'sub'),'')||'|'||coalesce((current_setting('request.jwt.claims',true)::jsonb->>'aal'),'')||'|'||current_setting('transaction_isolation')||'|'||current_user||'|'||coalesce((current_setting('request.jwt.claims',true)::jsonb->>'role'),'');`)).at(-1).split("|");
          const observed = { uid: row[0], jwtSub: row[1], claimsSub: row[2], aal: row[3], isolation: row[4], currentUser: row[5], claimsRole: row[6] };
          assert.deepEqual(observed, { uid: actor, jwtSub: actor, claimsSub: actor, aal, isolation: iso, currentUser: "authenticated", claimsRole: "authenticated" }, `${order}/${isolation}: effective identity`); return observed;
        };
        const beginAs = async (session, actor, aal) => {
          await session.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({role:"authenticated",sub:actor,aal}))},false);set role authenticated;begin isolation level ${iso};`);
          return { pid: Number((await session.ok("select pg_backend_pid();")).at(-1)), claims: await claimsFor(session, actor, aal) };
        };
        const createActor = owner, revokeActor = revoker;
        const winnerActor = createFirst ? createActor : revokeActor, loserActor = createFirst ? revokeActor : createActor;
        const winnerCommand = createFirst ? createCommand : revokeCommand, loserCommand = createFirst ? revokeCommand : createCommand;
        const winnerAal = createFirst ? "aal1" : "aal2", loserAal = createFirst ? "aal2" : "aal1";
        const winnerSession = createFirst ? a : a, loserSession = b;
        const winnerContext = await beginAs(winnerSession, winnerActor, winnerAal);
        const winnerResult = await winnerSession.query(`select api.command_v1('${JSON.stringify(winnerCommand).replaceAll("'", "''")}'::jsonb);`);
        if (winnerResult.code !== "00000") throw Error(`${title}: winner expected 00000, observed ${winnerResult.code}: ${winnerResult.errors}`);
        await loserSession.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(loserActor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({role:"authenticated",sub:loserActor,aal:loserAal}))},false);set role authenticated;begin isolation level ${iso};select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(companyId)} and profile_id=${lit(owner)};`);
        const loserPid = Number((await loserSession.ok("select pg_backend_pid();")).at(-1)), loserClaims = await claimsFor(loserSession, loserActor, loserAal);
        const pendingLoser = loserSession.query(`select api.command_v1('${JSON.stringify(loserCommand).replaceAll("'", "''")}'::jsonb);`);
        let blocked = false; const deadline = Date.now() + 10000;
        while (Date.now() < deadline) { if ((await observer.ok(`select ${winnerContext.pid}=any(pg_catalog.pg_blocking_pids(${loserPid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise(done => setTimeout(done,20)); }
        const blockerPids = (await observer.ok(`select pg_catalog.pg_blocking_pids(${loserPid})::text;`)).at(-1);
        if (!blocked) { await winnerSession.ok("commit;"); const loser = await pendingLoser; await loserSession.ok(loser.code === "00000" ? "commit;" : "rollback;"); throw Error(`${title}: missing real blocker ${JSON.stringify({winnerPid:winnerContext.pid,loserPid,blockerPids,winner: winnerResult.code,loser:loser.code})}`); }
        await winnerSession.ok("commit;"); const winnerOnly = await snapshot();
        const loserResult = await pendingLoser; await loserSession.ok(loserResult.code === "00000" ? "commit;" : "rollback;");
        const afterRollback = await snapshot();
        if (loserResult.code !== "40001") throw Error(`${title}: first loser expected 40001, observed ${loserResult.code}: ${loserResult.errors}; snapshot=${JSON.stringify(afterRollback)}`);
        assert.deepEqual(afterRollback, winnerOnly, `${title}: stale loser leaves winner-only state unchanged`);
        const assertNoScopedSideEffects = (state, stage) => {
          assert.deepEqual(state.sessions, [], `${title}: ${stage} has no sessions`);
          assert.deepEqual(state.periodReports, [], `${title}: ${stage} has no scoped period reports`);
          assert.deepEqual(state.reportDeliveries, [], `${title}: ${stage} has no deliveries joined to scoped reports`);
          assert.deepEqual(state.monthlyClosures, [], `${title}: ${stage} has no scoped closures`);
          assert.deepEqual(state.reportOutboxRows, [], `${title}: ${stage} has no outbox rows joined through scoped reports/deliveries`);
          assert.deepEqual(state.sideEffects, baseline.sideEffects, `${title}: ${stage} scoped side-effect counts stay at baseline`);
        };
        for (const [stage, state] of [["baseline",baseline],["winner-only",winnerOnly],["after-rollback",afterRollback]]) assertNoScopedSideEffects(state,stage);
        const retry = new Session(); auxiliarySessions.push(retry); await retry.ok("\\set VERBOSITY verbose\nset statement_timeout='15s';");
        const retryActor = loserActor, retryAal = loserAal, retryContext = await beginAs(retry,retryActor,retryAal);
        const retryResult = await retry.query(`select api.command_v1('${JSON.stringify(loserCommand).replaceAll("'", "''")}'::jsonb);`);
        const retryExpected = createFirst ? "00000" : "42501";
        if (retryResult.code !== retryExpected) { await retry.ok(retryResult.code === "00000" ? "commit;" : "rollback;"); throw Error(`${title}: retry expected ${retryExpected}, observed ${retryResult.code}: ${retryResult.errors}`); }
        if (retryExpected === "00000") await retry.ok("commit;"); else await retry.ok("rollback;");
        const retryResponse = retryResult.lines.at(-1); await retry.ok("reset role;"); await retry.close(); auxiliarySessions.splice(auxiliarySessions.indexOf(retry),1);
        const final = await snapshot();
        assertNoScopedSideEffects(final,"final");
        const assertPreservedAndAdded = (before, after, label, expectedAdds) => {
          for (const row of before) assert(after.some(candidate => JSON.stringify(candidate) === JSON.stringify(row)), `${label}: baseline row disappeared or changed`);
          assert.equal(after.length - before.length, expectedAdds, `${label}: unexpected row delta`);
        };
        const winnerFences = createFirst
          ? {membershipOwner:1,membershipRevoker:0,monthOwner:1,monthRevoker:0,graph:0,graphConfig:0,creationRevision:1,creation:1,createOperation:1,revokeOperation:0}
          : {membershipOwner:1,membershipRevoker:0,monthOwner:0,monthRevoker:0,graph:0,graphConfig:0,creationRevision:0,creation:0,createOperation:0,revokeOperation:1};
        const finalFences = createFirst
          ? {membershipOwner:2,membershipRevoker:0,monthOwner:1,monthRevoker:0,graph:0,graphConfig:0,creationRevision:1,creation:1,createOperation:1,revokeOperation:1}
          : winnerFences;
        assert.deepEqual(winnerOnly.fences,winnerFences); assert.deepEqual(final.fences,finalFences);
        const baselineMonths = baseline.monthFences;
        const expectedMonths = createFirst
          ? baselineMonths.map(row => row.owner_id === owner && row.period === period ? {...row,fence_epoch:1} : row)
          : baselineMonths;
        assert.deepEqual(winnerOnly.monthFences,expectedMonths,`${title}: exact winner-only organization-wide owner/revoker month fences`);
        assert.deepEqual(afterRollback.monthFences,expectedMonths,`${title}: rollback preserves exact month-fence set`);
        assert.deepEqual(final.monthFences,expectedMonths,`${title}: final organization-wide owner/revoker month fences`);
        const operationFenceRows = (createEpoch,revokeEpoch) => [
          ...(createEpoch === null ? [] : [{actor_id:owner,operation_id:createOp,fence_epoch:createEpoch}]),
          ...(revokeEpoch === null ? [] : [{actor_id:revoker,operation_id:revokeOp,fence_epoch:revokeEpoch}]),
        ];
        const winnerOperationFences = createFirst ? operationFenceRows(1,null) : operationFenceRows(null,1);
        const finalOperationFences = createFirst ? operationFenceRows(1,1) : operationFenceRows(null,1);
        assert.deepEqual(winnerOnly.operationFences,winnerOperationFences,`${title}: exact winner-only operation fences`);
        assert.deepEqual(afterRollback.operationFences,winnerOperationFences,`${title}: exact operation fences after loser rollback`);
        assert.deepEqual(final.operationFences,finalOperationFences,`${title}: exact final operation fences`);
        assert.equal(final.memberships.find(m=>m.profile_id===owner).active,false); assert.equal(final.memberships.find(m=>m.profile_id===owner).revision,1);
        assert.deepEqual(final.graph,baseline.graph);
        let created = null;
        if (createFirst) {
          assert.equal(winnerOnly.assignments.length,1); assert.equal(winnerOnly.instances.length,1); assert.equal(winnerOnly.responsibilities.length,1);
          const assignment=winnerOnly.assignments[0], task=winnerOnly.instances[0], responsibility=winnerOnly.responsibilities[0];
          const createResponse=JSON.parse(winnerResult.lines.at(-1)), createReceipt=winnerOnly.receipts.find(r=>r.operation_id===createOp);
          created={assignment,task,responsibility};
          assert.equal(assignment.id,createResponse.result.assignmentId); assert.equal(task.id,createResponse.result.taskId); assert.equal(createResponse.result.taskRevision,"0");
          assert.equal(assignment.owner_id,owner); assert.equal(assignment.company_id,companyId); assert.equal(assignment.team_id,teamId); assert.equal(assignment.title,title); assert.equal(assignment.kind,"operativa");
          assert.equal(assignment.weight,null); assert.equal(assignment.target,null); assert.equal(assignment.unit,"comprobantes"); assert.equal(assignment.frequency,"unica");
          assert.equal(assignment.start_date,date); assert.equal(assignment.end_date,date); assert.equal(assignment.start_month,period); assert.equal(assignment.due_day,day); assert.equal(assignment.month_day,day);
          assert.equal(assignment.interval_count,1); assert.deepEqual(assignment.weekdays,[1]); assert.equal(assignment.has_deadline,false); assert.equal(assignment.due_offset_days,0); assert.equal(assignment.measurement_version,2); assert.equal(assignment.definition_revision,1); assert.deepEqual(assignment.checklist,[]); assert.equal(assignment.template_id,null); assert.equal(assignment.template_version_id,null);
          assert.equal(task.assignment_id,assignment.id); assert.equal(task.owner_id,owner); assert.equal(task.company_id,companyId); assert.equal(task.team_id,teamId); assert.equal(task.period,period); assert.equal(task.scheduled_on,date);
          assert.equal(task.title,title); assert.equal(task.kind,"operativa"); assert.equal(task.unit,"comprobantes"); assert.equal(task.measurement_version,2); assert.equal(task.weight,null); assert.equal(task.target,null); assert.equal(task.due_date,null); assert.deepEqual(task.checklist,[]); assert.equal(task.priority,"Media"); assert.equal(task.status,"Pendiente"); assert.equal(task.state_revision,0); assert.equal(task.started_at,null); assert.equal(task.completed_at,null); assert.equal(task.blocked_by,null);
          assert.equal(responsibility.head.instance_id,task.id); assert.equal(responsibility.head.set_id,responsibility.set.id); assert.equal(responsibility.set.revision,1); assert.equal(responsibility.set.mode,"individual"); assert.equal(responsibility.set.origin,"baseline_legacy"); assert.equal(responsibility.set.anchor_owner_id,owner); assert.equal(responsibility.set.company_id_snapshot,companyId); assert.equal(responsibility.set.period_snapshot,period); assert.equal(responsibility.set.team_id_snapshot,teamId); assert.equal(responsibility.set.sector_snapshot,null); assert.equal(responsibility.set.sector_source,"unknown"); assert.equal(responsibility.set.sealed,true); assert.equal(responsibility.members.length,1); assert.equal(responsibility.members[0].profile_id,owner); assert.equal(responsibility.members[0].share_bps,10000);
          assert.equal(createReceipt.actor_id,owner); assert.equal(createReceipt.operation_id,createOp); assert.equal(createReceipt.organization_id,org); assert.equal(createReceipt.kind,"task.createOneOff"); assert.deepEqual(createReceipt.arguments,{kind:createCommand.kind,payload:createCommand.payload,expectedRevisions:createCommand.expectedRevisions}); assert.deepEqual(createResponse,createReceipt.result);
          assert.equal(createReceipt.result.result.taskRevision,"0"); assert.equal(winnerOnly.createAudit.length,1); assert.equal(winnerOnly.createAudit[0].actor_id,owner); assert.equal(winnerOnly.createAudit[0].action,"task.createOneOff"); assert.equal(winnerOnly.createAudit[0].entity_id,assignment.id); assert.deepEqual(winnerOnly.createAudit[0].details,{ownerId:owner,period});
          assert.equal(winnerOnly.memberships.find(m=>m.profile_id===owner).active,true); assert.equal(winnerOnly.memberships.find(m=>m.profile_id===owner).revision,0); assert.equal(winnerOnly.receipts.length,1); assert.deepEqual(winnerOnly.membershipEvents,[]); assert.deepEqual(winnerOnly.membershipAudit,[]);
          assert.deepEqual(final.assignments,winnerOnly.assignments); assert.equal(final.instances.length,1); assert.equal(final.instances[0].id,task.id);
          const finalTask=final.instances.find(row=>row.id===task.id); assert.deepEqual(finalTask,{...task,state_revision:1},"revocation may change only task state_revision from 0 to 1");
          const finalResp=final.responsibilities[0]; assert.deepEqual(finalResp,responsibility,"revocation must preserve complete baseline responsibility snapshot");
          assertPreservedAndAdded(baseline.responsibilityHeads,winnerOnly.responsibilityHeads,"responsibility heads at create",1);
          assertPreservedAndAdded(baseline.responsibilitySets,winnerOnly.responsibilitySets,"responsibility sets at create",1);
          assertPreservedAndAdded(baseline.responsibilityMembers,winnerOnly.responsibilityMembers,"responsibility members at create",1);
          assert.deepEqual(final.responsibilityHeads,winnerOnly.responsibilityHeads); assert.deepEqual(final.responsibilitySets,winnerOnly.responsibilitySets); assert.deepEqual(final.responsibilityMembers,winnerOnly.responsibilityMembers);
          assert.equal(final.receipts.length,2); assert.equal(final.createAudit.length,1); assert.equal(final.membershipAudit.length,1); assert.equal(final.membershipEvents.length,1);
          const finalCreateReceipt=final.receipts.find(r=>r.operation_id===createOp); assert.deepEqual(finalCreateReceipt,createReceipt,"historical create receipt must remain unchanged"); assert.equal(finalCreateReceipt.result.result.taskRevision,"0");
        } else {
          assert.deepEqual(final,winnerOnly); assert.deepEqual(final.assignments,[]); assert.deepEqual(final.instances,[]); assert.deepEqual(final.responsibilities,[]); assert.equal(final.creationHead.revision,0); assert.equal(final.creationHead.fence_epoch,0); assert.equal(final.monthFences.length,1); assert.equal(final.monthFences[0].owner_id,owner); assert.equal(final.monthFences[0].fence_epoch,0);
          assert.deepEqual(final.responsibilityHeads,baseline.responsibilityHeads); assert.deepEqual(final.responsibilitySets,baseline.responsibilitySets); assert.deepEqual(final.responsibilityMembers,baseline.responsibilityMembers);
          assert.equal(final.receipts.length,1); assert.deepEqual(final.createAudit,[]); assert.equal(final.membershipAudit.length,1); assert.equal(final.membershipEvents.length,1);
          assert.equal(final.receipts[0].operation_id,revokeOp);
        }
        const revokeReceipt=final.receipts.find(r=>r.operation_id===revokeOp), revokeResponse=JSON.parse(createFirst?retryResponse:winnerResult.lines.at(-1));
        assert.equal(revokeReceipt.actor_id,revoker); assert.equal(revokeReceipt.operation_id,revokeOp); assert.equal(revokeReceipt.organization_id,org); assert.equal(revokeReceipt.kind,"companyMembership.setActive"); assert.deepEqual(revokeReceipt.arguments,{kind:revokeCommand.kind,payload:revokeCommand.payload,expectedRevisions:revokeCommand.expectedRevisions}); assert.deepEqual(revokeResponse,revokeReceipt.result);
        assert.equal(final.membershipAudit[0].actor_id,revoker); assert.equal(final.membershipAudit[0].entity_id,companyId); assert.deepEqual(final.membershipAudit[0].details,{active:false,profileId:owner,membershipRevision:"1"});
        const event=final.membershipEvents[0]; assert.equal(event.actor_id,revoker); assert.equal(event.organization_id,org); assert.equal(event.company_id,companyId); assert.equal(event.profile_id,owner); assert.equal(event.revision,1); assert.equal(event.active,false); assert.equal(event.reason,revokeCommand.payload.reason);
        record(`M2.2C task.createOneOff versus membership revoke ${order} ${isolation} blocker/stale/retry`,true,{order,isolation:iso,actors:{owner,revoker,distinct:owner!==revoker},claims:{winner:winnerContext.claims,loser:loserClaims,retry:retryContext.claims},pids:{winner:winnerContext.pid,loser:loserPid,blockerPids},blocked,winnerSQLSTATE:winnerResult.code,winnerResponse:winnerResult.lines.at(-1),winnerErrors:winnerResult.errors,loserSQLSTATE:loserResult.code,loserResponse:loserResult.lines.at(-1),loserErrors:loserResult.errors,retrySQLSTATE:retryResult.code,retryResponse,retryErrors:retryResult.errors,baseline,winnerOnly,afterConflictRollback:afterRollback,final,created,createReceipt:createFirst?winnerOnly.receipts[0]:null,revokeReceipt,expectedWinnerFences:winnerFences,expectedFinalFences:finalFences});
        await winnerSession.ok("reset role;"); await loserSession.ok("reset role;");
      }
      await oneOffCreateMembershipRace({order:"create-first",isolation:"RC",base:25000});
      await oneOffCreateMembershipRace({order:"revoke-first",isolation:"RC",base:25010});
      await oneOffCreateMembershipRace({order:"create-first",isolation:"RR",base:25020});
      await oneOffCreateMembershipRace({order:"revoke-first",isolation:"RR",base:25030});

      // Native timer-start/membership-revocation matrix. Each case owns its
      // company, team, employee, chief, task, responsibility, graph and month
      // fence rows so the asserted epochs are exact deltas from a zero base.
      async function timerStartMembershipRace({ order, isolation, base }) {
        const iso = isolation === "RC" ? "read committed" : "repeatable read";
        const firstAction = order === "timer-first" ? "timer" : "revoke";
        const owner = uid(base), chief = uid(base + 1), companyId = uid(base + 2), teamId = uid(base + 3);
        const assignment = uid(base + 4), task = uid(base + 5), timerOp = uid(base + 6), revokeOp = uid(base + 7);
        const label = `M2.2C timer start ${order} ${isolation}`;
        const period = monthPeriod, date = scheduledOn;
        await observer.ok(`insert into auth.users(id) values(${lit(owner)}),(${lit(chief)});
          insert into public.profiles(id,organization_id,name,role,sector,branch,position) values
            (${lit(owner)},${lit(org)},${lit(label)}||' employee','empleado','Timer race','Timer race','Employee'),
            (${lit(chief)},${lit(org)},${lit(label)}||' chief','jefe','Timer race','Timer race','Chief');
          insert into public.companies(id,organization_id,name) values(${lit(companyId)},${lit(org)},${lit(label)}||' company');
          insert into public.teams(id,organization_id,name,manager_id) values(${lit(teamId)},${lit(org)},${lit(label)}||' team',${lit(chief)});
          insert into public.company_memberships(organization_id,company_id,profile_id) values
            (${lit(org)},${lit(companyId)},${lit(owner)}),(${lit(org)},${lit(companyId)},${lit(chief)});
          insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(teamId)},${lit(owner)}),(${lit(org)},${lit(teamId)},${lit(chief)});
          insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
            values(${lit(assignment)},${lit(org)},${lit(companyId)},${lit(owner)},${lit(teamId)},${lit(label)},'resultado',1,null,null,'unica',${lit(period)}::date,extract(day from ${lit(date)}::date)::integer,'[]');
          insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,unit,target,due_date,checklist,status)
            values(${lit(task)},${lit(org)},${lit(assignment)},${lit(companyId)},${lit(owner)},${lit(teamId)},${lit(period)}::date,${lit(date)}::date,${lit(label)},'resultado',1,null,null,${lit(date)}::date,'[]','Pendiente');
          insert into app_private.task_dependency_graphs(organization_id,company_id,period,config_revision,fence_epoch) values(${lit(org)},${lit(companyId)},${lit(period)}::date,0,0);
          insert into app_private.api_month_fences(organization_id,owner_id,period,fence_epoch) values(${lit(org)},${lit(owner)},${lit(period)}::date,0) on conflict(owner_id,period) do update set fence_epoch=0;`);
        const actorCheck = (await observer.ok(`select
          (select role='empleado' and active from public.profiles where id=${lit(owner)})||'|'||
          (select role='jefe' and active from public.profiles where id=${lit(chief)})||'|'||
          (select count(*)=1 from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(companyId)} and profile_id=${lit(owner)} and active)||'|'||
          (select count(*)=1 from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(companyId)} and profile_id=${lit(chief)} and active)||'|'||
          (select count(*)=1 from public.task_responsibility_heads h join public.task_responsibility_members m on m.set_id=h.set_id where h.instance_id=${lit(task)} and m.profile_id=${lit(owner)})||'|'||
          (select count(*)=1 from public.task_assignments where id=${lit(assignment)} and frequency='unica')||'|'||
          (select count(*)=0 from public.task_time_sessions where actor_id=${lit(owner)} and ended_at is null);`)).at(-1);
        assert.equal(actorCheck, "true|true|true|true|true|true|true", `${order}/${isolation}: fixture actors/task/responsibility must be valid and isolated`);
        const timerArgs = { instance: task, revision: 0, switch: false };
        const revokeCommand = { contractVersion: 1, operationId: revokeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${companyId}:${owner}`]: "0" }, payload: { companyId, profileId: owner, active: false, reason: `${label} synthetic revocation` } };
        const snapshotSql = `select jsonb_build_object(
          'task',(select to_jsonb(t) from public.task_instances t where t.id=${lit(task)}),
          'assignment',(select to_jsonb(a) from public.task_assignments a where a.id=${lit(assignment)}),
          'responsibility',(select jsonb_build_object('head',to_jsonb(h),'set',to_jsonb(s),'members',(select coalesce(jsonb_agg(to_jsonb(m) order by m.profile_id),'[]'::jsonb) from public.task_responsibility_members m where m.set_id=s.id)) from public.task_responsibility_heads h join public.task_responsibility_sets s on s.id=h.set_id where h.instance_id=${lit(task)}),
          'memberships',(select coalesce(jsonb_agg(to_jsonb(m) order by m.profile_id),'[]'::jsonb) from public.company_memberships m where m.organization_id=${lit(org)} and m.company_id=${lit(companyId)} and m.profile_id in (${lit(owner)},${lit(chief)})),
          'profiles',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.profiles p where p.id in (${lit(owner)},${lit(chief)})),
          'sessions',(select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) from public.task_time_sessions s where s.organization_id=${lit(org)} and (s.actor_id=${lit(owner)} or s.instance_id=${lit(task)})),
          'timerReceipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.actor_id),'[]'::jsonb) from public.task_mutation_receipts r where r.operation_id=${lit(timerOp)}),
          'commandReceipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.operation_id),'[]'::jsonb) from app_private.api_command_receipts r where r.organization_id=${lit(org)} and r.operation_id=${lit(revokeOp)}),
          'membershipEvents',(select coalesce(jsonb_agg(to_jsonb(e) order by e.revision),'[]'::jsonb) from app_private.company_membership_events e where e.organization_id=${lit(org)} and e.company_id=${lit(companyId)} and e.profile_id=${lit(owner)}),
          'audit',(select coalesce(jsonb_agg(to_jsonb(e) order by e.at,e.id),'[]'::jsonb) from public.audit_events e where e.organization_id=${lit(org)} and ((e.action='task.timer_started' and e.details->>'instance'=${lit(task)}) or (e.action='companyMembership.setActive' and e.entity_id=${lit(companyId)} and e.details->>'profileId'=${lit(owner)}))),
          'fences',jsonb_build_object(
            'membershipEmployee',coalesce((select f.fence_epoch from app_private.api_membership_fences f where f.organization_id=${lit(org)} and f.profile_id=${lit(owner)}),0),
            'membershipChief',coalesce((select f.fence_epoch from app_private.api_membership_fences f where f.organization_id=${lit(org)} and f.profile_id=${lit(chief)}),0),
            'month',coalesce((select f.fence_epoch from app_private.api_month_fences f where f.organization_id=${lit(org)} and f.owner_id=${lit(owner)} and f.period=${lit(period)}::date),0),
            'graph',coalesce((select g.fence_epoch from app_private.task_dependency_graphs g where g.organization_id=${lit(org)} and g.company_id=${lit(companyId)} and g.period=${lit(period)}::date),0),
            'graphConfig',coalesce((select g.config_revision from app_private.task_dependency_graphs g where g.organization_id=${lit(org)} and g.company_id=${lit(companyId)} and g.period=${lit(period)}::date),0),
            'timerOperation',(select f.fence_epoch from app_private.api_operation_fences f where f.actor_id=${lit(owner)} and f.operation_id=${lit(timerOp)}),
            'revokeOperation',(select f.fence_epoch from app_private.api_operation_fences f where f.actor_id=${lit(chief)} and f.operation_id=${lit(revokeOp)})
          ),
          'otherEffects',jsonb_build_object(
            'activity',(select count(*) from public.activity_entries where instance_id=${lit(task)}),
            'assessments',(select count(*) from app_private.operational_assessments where instance_id=${lit(task)}),
            'coverage',(select count(*) from public.task_coverage_bindings where instance_id=${lit(task)}),
            'closures',(select count(*) from public.monthly_closures where owner_id=${lit(owner)} and period=${lit(period)}::date),
            'assignmentCount',(select count(*) from public.task_assignments where company_id=${lit(companyId)}),
            'responsibilityMembers',(select count(*) from public.task_responsibility_members m join public.task_responsibility_heads h on h.set_id=m.set_id where h.instance_id=${lit(task)})
          )
        )::text;`;
        const snapshot = async () => JSON.parse((await reviewer.ok(snapshotSql)).at(-1));
        const baseline = await snapshot();
        assert.equal(baseline.task.status, "Pendiente"); assert.equal(baseline.task.state_revision, 0);
        assert.equal(baseline.assignment.frequency, "unica"); assert.equal(baseline.responsibility.members.length, 1);
        assert.deepEqual(baseline.sessions, []); assert.deepEqual(baseline.timerReceipts, []); assert.deepEqual(baseline.commandReceipts, []);
        assert.deepEqual(baseline.fences, { membershipEmployee: 0, membershipChief: 0, month: 0, graph: 0, graphConfig: 0, timerOperation: null, revokeOperation: null });
        assert.deepEqual(baseline.otherEffects, { activity: 0, assessments: 0, coverage: 0, closures: 0, assignmentCount: 1, responsibilityMembers: 1 });
        const diagnosticPath=join(out,`m2-2c-timer-start-membership-revocation-race-${order}-${isolation.toLowerCase()}-diagnostic.json`);
        const persistDiagnostic=(phase,state,error=null)=>{const data={phase,error:error?String(error.stack||error):null,order,isolation,actorCheck,actors:{employee:owner,chief},operationIds:{timer:timerOp,revoke:revokeOp},claims:state.claims??null,winnerPid:state.winnerPid??null,loserPid:state.loserPid??null,blockerPids:state.blockerPids??null,blocked:state.blocked??null,winnerSQLSTATE:state.winnerResult?.code??null,winnerResponse:state.winnerResult?.lines?.at(-1)??null,loserSQLSTATE:state.loserResult?.code??null,loserResponse:state.loserResult?.lines?.at(-1)??null,loserErrors:state.loserResult?.errors??null,retrySQLSTATE:state.retryResult?.code??null,retryResponse:state.retryResult?.lines?.at(-1)??null,retryErrors:state.retryResult?.errors??null,baseline,winnerOnly:state.winnerOnly??null,afterConflict:state.afterConflict??null,final:state.final??null,postgresLog:join(out,"postgres.log")};writeFileSync(diagnosticPath,JSON.stringify(data,null,2));};
        const verifyPhase=(phase,state,check)=>{try{check();}catch(error){persistDiagnostic(phase,state,error);throw Error(`${order}/${isolation} ${phase} assertion failed; diagnostic ${diagnosticPath}: ${error.message}`);}};
        const winnerSession = firstAction === "timer" ? a : a, loserSession = b;
        const winnerActor = firstAction === "timer" ? owner : chief, loserActor = firstAction === "timer" ? chief : owner;
        const winnerAal = firstAction === "timer" ? "aal1" : "aal2", loserAal = firstAction === "timer" ? "aal2" : "aal1";
        const beginAs = async (session, who, aal) => {
          await session.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(who)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: who, aal }))},false);set role authenticated;begin isolation level ${iso};`);
          const effective = JSON.parse((await session.ok(`select jsonb_build_object('uid',auth.uid(),'sub',current_setting('request.jwt.claim.sub',true),'jwtSub',auth.jwt()->>'sub','aal',auth.jwt()->>'aal','isolation',current_setting('transaction_isolation'))::text;`)).at(-1));
          try{assert.deepEqual(effective,{uid:who,sub:who,jwtSub:who,aal,isolation:iso},`${order}/${isolation} effective identity/AAL/isolation`);}catch(error){persistDiagnostic("effective claims",{claims:{who,requestedAal:aal,effective}} ,error);throw error;}
          return { pid:Number((await session.ok("select pg_backend_pid();")).at(-1)), effective };
        };
        const winnerIdentity = await beginAs(winnerSession, winnerActor, winnerAal), winnerPid = winnerIdentity.pid;
        const winnerSql = firstAction === "timer"
          ? `select public.start_task_timer(${lit(task)},0,${lit(timerOp)},false);`
          : `select api.command_v1('${JSON.stringify(revokeCommand).replaceAll("'", "''")}'::jsonb);`;
        const winnerResult = await winnerSession.query(winnerSql);
        if (winnerResult.code !== "00000") {persistDiagnostic("winner outcome",{winnerPid,winnerResult,claims:{winner:winnerIdentity.effective}},new Error(winnerResult.errors));throw Error(`${order}/${isolation}: unexpected winner SQLSTATE ${winnerResult.code}: ${winnerResult.errors}; diagnostic ${diagnosticPath}`);}
        const winnerResponse = winnerResult.lines.at(-1);
        const loserIdentity = await beginAs(loserSession, loserActor, loserAal), loserPid = loserIdentity.pid;
        await loserSession.ok(`select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(companyId)} and profile_id=${lit(owner)};select status,state_revision from public.task_instances where id=${lit(task)};`);
        const loserSql = firstAction === "timer"
          ? `select api.command_v1('${JSON.stringify(revokeCommand).replaceAll("'", "''")}'::jsonb);`
          : `select public.start_task_timer(${lit(task)},0,${lit(timerOp)},false);`;
        const pendingLoser = loserSession.query(loserSql);
        let blocked = false; const deadline = Date.now() + 10000;
        while (Date.now() < deadline) { if ((await reviewer.ok(`select ${winnerPid}=any(pg_catalog.pg_blocking_pids(${loserPid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise(done => setTimeout(done,20)); }
        const blockerPids = (await reviewer.ok(`select pg_catalog.pg_blocking_pids(${loserPid})::text;`)).at(-1);
        if (!blocked) {
          await winnerSession.ok("commit;"); const loserResult = await pendingLoser; await loserSession.ok(loserResult.code === "00000" ? "commit;" : "rollback;");
          const data = { order,isolation,actorCheck,actors:{employee:owner,chief},operationIds:{timer:timerOp,revoke:revokeOp},winnerPid,loserPid,blockerPids,blocked,winnerSQLSTATE:winnerResult.code,winnerResponse,loserSQLSTATE:loserResult.code,loserErrors:loserResult.errors,claims:{winner:winnerIdentity.effective,loser:loserIdentity.effective},baseline,after:await snapshot(),postgresLog:join(out,"postgres.log") };
          writeFileSync(diagnosticPath,JSON.stringify(data,null,2));
          throw Error(`M2.2C no real blocker ${order}/${isolation}; diagnostic ${diagnosticPath}`);
        }
        await winnerSession.ok("commit;");
        const winnerOnly = await snapshot();
        const loserResult = await pendingLoser;
        await loserSession.ok(loserResult.code === "00000" ? "commit;" : "rollback;");
        const afterConflict = await snapshot();
        const expectedLoser = "40001";
        if (loserResult.code !== expectedLoser) {
          const data={order,isolation,actorCheck,actors:{employee:owner,chief},operationIds:{timer:timerOp,revoke:revokeOp},winnerPid,loserPid,blockerPids,blocked,winnerSQLSTATE:winnerResult.code,winnerResponse,winnerOnly,loserSQLSTATE:loserResult.code,loserResponse:loserResult.lines.at(-1),loserErrors:loserResult.errors,afterConflict,baseline,postgresLog:join(out,"postgres.log")};
          const path=join(out,`m2-2c-timer-start-membership-revocation-race-${order}-${isolation.toLowerCase()}-diagnostic.json`);writeFileSync(path,JSON.stringify(data,null,2));
          throw Error(`${order}/${isolation}: expected stale loser 40001, got ${loserResult.code}; diagnostic ${path}`);
        }
        const raceState={winnerPid,loserPid,blockerPids,blocked,winnerResult,loserResult,winnerOnly,afterConflict,claims:{winner:winnerIdentity.effective,loser:loserIdentity.effective}};
        verifyPhase("winner-only and conflict rollback",raceState,()=>{
          assert.deepEqual(afterConflict,winnerOnly,"loser rollback leaves exact winner-only snapshot");
          assert.deepEqual(winnerOnly.assignment,baseline.assignment,"winner must not mutate full assignment");
          assert.deepEqual(winnerOnly.responsibility,baseline.responsibility,"winner must not mutate full responsibility/head/member rows");
          assert.deepEqual(winnerOnly.profiles,baseline.profiles,"winner must not mutate profiles");
          assert.deepEqual(winnerOnly.otherEffects,baseline.otherEffects);
          if(firstAction==="timer"){
            const employee=winnerOnly.memberships.find(m=>m.profile_id===owner), manager=winnerOnly.memberships.find(m=>m.profile_id===chief), session=winnerOnly.sessions[0], receipt=winnerOnly.timerReceipts[0];
            assert.equal(employee.active,true);assert.equal(employee.revision,0);assert.equal(manager.active,true);assert.equal(manager.revision,0);
            assert.equal(winnerOnly.task.status,"En curso");assert.equal(winnerOnly.task.state_revision,1);assert.ok(winnerOnly.task.started_at);
            assert.equal(winnerOnly.sessions.length,1);assert.equal(session.id,winnerResponse);assert.equal(session.actor_id,owner);assert.equal(session.instance_id,task);assert.equal(session.contribution_kind,"responsible");assert.equal(session.absence_id,null);assert.equal(session.coverage_binding_id,null);assert.ok(session.started_at);assert.equal(session.ended_at,null);
            assert.equal(winnerOnly.timerReceipts.length,1);assert.equal(receipt.actor_id,owner);assert.equal(receipt.organization_id,org);assert.equal(receipt.operation_id,timerOp);assert.equal(receipt.operation_kind,"start_timer");assert.deepEqual(receipt.arguments,timerArgs);assert.deepEqual(receipt.result,{session_id:session.id});
            assert.deepEqual(winnerOnly.commandReceipts,[]);assert.deepEqual(winnerOnly.membershipEvents,[]);assert.equal(winnerOnly.audit.length,1);
            assert.deepEqual(Object.keys(receipt).sort(),["actor_id","arguments","created_at","operation_id","operation_kind","organization_id","result"]);
            assert.equal(winnerOnly.audit.length,1);assert.equal(winnerOnly.audit[0].action,"task.timer_started");assert.equal(winnerOnly.audit[0].actor_id,owner);assert.equal(winnerOnly.audit[0].organization_id,org);assert.equal(winnerOnly.audit[0].entity_id,session.id);assert.deepEqual(winnerOnly.audit[0].details,{instance:task,contribution:"responsible",binding:null});
            assert.deepEqual(winnerOnly.fences,{membershipEmployee:1,membershipChief:0,month:1,graph:1,graphConfig:0,timerOperation:null,revokeOperation:null});
          }else{
            const employee=winnerOnly.memberships.find(m=>m.profile_id===owner),manager=winnerOnly.memberships.find(m=>m.profile_id===chief),receipt=winnerOnly.commandReceipts[0],event=winnerOnly.membershipEvents[0],audit=winnerOnly.audit[0];
            assert.equal(employee.active,false);assert.equal(employee.revision,1);assert.equal(manager.active,true);assert.equal(manager.revision,0);
            assert.equal(winnerOnly.task.status,"Pendiente");assert.equal(winnerOnly.task.state_revision,1);assert.equal(winnerOnly.sessions.length,0);assert.equal(winnerOnly.timerReceipts.length,0);
            assert.equal(winnerOnly.commandReceipts.length,1);assert.equal(receipt.actor_id,chief);assert.equal(receipt.operation_id,revokeOp);assert.equal(receipt.kind,"companyMembership.setActive");
            assert.deepEqual(Object.keys(receipt).sort(),["actor_id","arguments","created_at","kind","operation_id","organization_id","result"]);
            assert.deepEqual(receipt.arguments,{kind:revokeCommand.kind,payload:revokeCommand.payload,expectedRevisions:revokeCommand.expectedRevisions});assert.deepEqual(JSON.parse(winnerResponse),receipt.result);
            assert.equal(winnerOnly.membershipEvents.length,1);assert.equal(event.actor_id,chief);assert.equal(event.organization_id,org);assert.equal(event.company_id,companyId);assert.equal(event.profile_id,owner);assert.equal(event.revision,1);assert.equal(event.active,false);assert.equal(event.reason,revokeCommand.payload.reason);
            assert.equal(winnerOnly.audit.length,1);assert.equal(audit.action,"companyMembership.setActive");assert.equal(audit.actor_id,chief);assert.equal(audit.entity_id,companyId);assert.equal(audit.organization_id,org);assert.deepEqual(audit.details,{active:false,profileId:owner,membershipRevision:"1"});
            assert.deepEqual(winnerOnly.fences,{membershipEmployee:1,membershipChief:0,month:0,graph:1,graphConfig:0,timerOperation:null,revokeOperation:1});
          }
        });
        const retry = new Session(); auxiliarySessions.push(retry); await retry.ok("\\set VERBOSITY verbose\nset statement_timeout='15s';");
        const retryActor = firstAction === "timer" ? chief : owner, retryAal = firstAction === "timer" ? "aal2" : "aal1";
        await retry.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(retryActor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({role:"authenticated",sub:retryActor,aal:retryAal}))},false);set role authenticated;begin isolation level ${iso};`);
        const retryIdentity=JSON.parse((await retry.ok(`select jsonb_build_object('uid',auth.uid(),'sub',current_setting('request.jwt.claim.sub',true),'jwtSub',auth.jwt()->>'sub','aal',auth.jwt()->>'aal','isolation',current_setting('transaction_isolation'))::text;`)).at(-1));
        try{assert.deepEqual(retryIdentity,{uid:retryActor,sub:retryActor,jwtSub:retryActor,aal:retryAal,isolation:iso},`${order}/${isolation} retry identity/AAL/isolation`);}catch(error){persistDiagnostic("retry effective claims",{winnerPid,loserPid,claims:{winner:winnerIdentity.effective,loser:loserIdentity.effective,retry:retryIdentity}},error);throw error;}
        const retrySql = firstAction === "timer" ? `select api.command_v1('${JSON.stringify(revokeCommand).replaceAll("'", "''")}'::jsonb);` : `select public.start_task_timer(${lit(task)},0,${lit(timerOp)},false);`;
        const retryResult = await retry.query(retrySql);
        const expectedRetry = firstAction === "timer" ? "00000" : "P0001";
        const primaryError = retryResult.errors.match(/ERROR:\s+P0001:\s+([^\r\n]+)/u)?.[1] ?? null;
        if (retryResult.code !== expectedRetry || (firstAction === "revoke" && primaryError !== "Sin permiso")) {
          await retry.ok(retryResult.code === "00000" ? "commit;" : "rollback;"); await retry.ok("reset role;"); await retry.close(); auxiliarySessions.splice(auxiliarySessions.indexOf(retry),1);
          const data={order,isolation,actorCheck,actors:{employee:owner,chief},operationIds:{timer:timerOp,revoke:revokeOp},winnerPid,loserPid,blockerPids,blocked,winnerSQLSTATE:winnerResult.code,winnerResponse,winnerOnly,loserSQLSTATE:loserResult.code,loserErrors:loserResult.errors,afterConflict,retrySQLSTATE:retryResult.code,expectedRetry,primaryError,retryResponse:retryResult.lines.at(-1),retryErrors:retryResult.errors,claims:{winner:winnerIdentity.effective,loser:loserIdentity.effective,retry:retryIdentity},final:await snapshot(),baseline,postgresLog:join(out,"postgres.log")};
          writeFileSync(diagnosticPath,JSON.stringify(data,null,2));
          throw Error(`${order}/${isolation}: retry outcome differs; observed ${retryResult.code}/${primaryError}; diagnostic ${diagnosticPath}`);
        }
        if (expectedRetry === "00000") await retry.ok("commit;"); else await retry.ok("rollback;");
        await retry.ok("reset role;"); await retry.close(); auxiliarySessions.splice(auxiliarySessions.indexOf(retry),1);
        const final = await snapshot();
        const fenceExpected = firstAction === "timer"
          ? { membershipEmployee: 2, membershipChief: 0, month: 1, graph: 2, graphConfig: 0, timerOperation: null, revokeOperation: 1 }
          : { membershipEmployee: 1, membershipChief: 0, month: 0, graph: 1, graphConfig: 0, timerOperation: null, revokeOperation: 1 };
        const timerReceipt = final.timerReceipts[0], revokeReceipt = final.commandReceipts[0];
        verifyPhase("final effects and exact receipts",{...raceState,retryResult,final,claims:{winner:winnerIdentity.effective,loser:loserIdentity.effective,retry:retryIdentity}},()=>{
          assert.deepEqual(final.fences,fenceExpected,`${order}/${isolation} exact all-fence footprint`);
          assert.deepEqual(final.assignment,baseline.assignment,"assignment remains identical to baseline");
          assert.deepEqual(final.responsibility,baseline.responsibility,"responsibility head/set/member rows remain identical to baseline");
          assert.deepEqual(final.profiles,baseline.profiles,"profile rows remain identical to baseline");
          assert.deepEqual(final.otherEffects,baseline.otherEffects);
          assert.equal(final.memberships.find(m=>m.profile_id===owner).active,false);assert.equal(final.memberships.find(m=>m.profile_id===owner).revision,1);
          assert.equal(final.memberships.find(m=>m.profile_id===chief).active,true);assert.equal(final.memberships.find(m=>m.profile_id===chief).revision,0);
          assert.equal(final.membershipEvents.length,1);const membershipEvent=final.membershipEvents[0];
          assert.equal(membershipEvent.actor_id,chief);assert.equal(membershipEvent.organization_id,org);assert.equal(membershipEvent.company_id,companyId);assert.equal(membershipEvent.profile_id,owner);assert.equal(membershipEvent.revision,1);assert.equal(membershipEvent.active,false);assert.equal(membershipEvent.reason,revokeCommand.payload.reason);
          const membershipAudit=final.audit.filter(e=>e.action==="companyMembership.setActive");assert.equal(membershipAudit.length,1);
          assert.equal(membershipAudit[0].actor_id,chief);assert.equal(membershipAudit[0].organization_id,org);assert.equal(membershipAudit[0].entity_id,companyId);assert.deepEqual(membershipAudit[0].details,{active:false,profileId:owner,membershipRevision:"1"});
          assert.equal(final.commandReceipts.length,1);assert.equal(revokeReceipt.actor_id,chief);assert.equal(revokeReceipt.organization_id,org);assert.equal(revokeReceipt.operation_id,revokeOp);assert.equal(revokeReceipt.kind,"companyMembership.setActive");
          assert.deepEqual(Object.keys(revokeReceipt).sort(),["actor_id","arguments","created_at","kind","operation_id","organization_id","result"]);
          assert.deepEqual(revokeReceipt.arguments,{kind:revokeCommand.kind,payload:revokeCommand.payload,expectedRevisions:revokeCommand.expectedRevisions});
          assert.equal(final.task.state_revision,firstAction==="timer"?2:1);assert.equal(final.task.status,firstAction==="timer"?"En curso":"Pendiente");
          if(firstAction==="timer"){
            const session=final.sessions[0],winnerSessionRow=winnerOnly.sessions[0],sessionId=winnerResponse;
            assert.equal(final.sessions.length,1);assert.equal(session.id,sessionId);assert.equal(session.actor_id,owner);assert.equal(session.instance_id,task);assert.equal(session.contribution_kind,"responsible");assert.equal(session.absence_id,null);assert.equal(session.coverage_binding_id,null);assert.ok(session.ended_at);assert.ok(Date.parse(session.ended_at)>=Date.parse(session.started_at));
            for(const key of ["id","organization_id","instance_id","actor_id","created_at","started_at","absence_id","contribution_kind","coverage_binding_id"])assert.equal(session[key],winnerSessionRow[key],`timer session ${key} is immutable across revoke`);
            assert.equal(final.task.started_at,winnerOnly.task.started_at);
            const expectedTask={...winnerOnly.task,state_revision:2};assert.deepEqual(final.task,expectedTask,"revocation only advances the timer-started task revision");
            assert.equal(final.timerReceipts.length,1);assert.equal(timerReceipt.actor_id,owner);assert.equal(timerReceipt.organization_id,org);assert.equal(timerReceipt.operation_id,timerOp);assert.equal(timerReceipt.operation_kind,"start_timer");assert.deepEqual(timerReceipt.arguments,timerArgs);assert.deepEqual(timerReceipt.result,{session_id:sessionId});
            assert.deepEqual(timerReceipt,winnerOnly.timerReceipts[0],"timer receipt is preserved byte-for-byte after revocation");
            const timerAudits=final.audit.filter(e=>e.action==="task.timer_started");assert.equal(timerAudits.length,1);assert.deepEqual(timerAudits[0],winnerOnly.audit[0]);
            assert.equal(timerAudits[0].actor_id,owner);assert.equal(timerAudits[0].entity_id,sessionId);assert.equal(timerAudits[0].details.instance,task);assert.equal(timerAudits[0].details.contribution,"responsible");assert.equal(timerAudits[0].details.binding,null);
            assert.deepEqual(JSON.parse(retryResult.lines.at(-1)),revokeReceipt.result,"full successful revoke response equals durable receipt result");
          }else{
            assert.deepEqual(final,winnerOnly,"P0001 retry after revocation is inert across the full snapshot");
            assert.deepEqual(final.sessions,[]);assert.equal(final.task.status,"Pendiente");assert.equal(final.task.state_revision,1);assert.equal(primaryError,"Sin permiso");
            assert.deepEqual(final.timerReceipts,[]);assert.equal(final.audit.filter(e=>e.action==="task.timer_started").length,0);
            assert.deepEqual(JSON.parse(winnerResponse),revokeReceipt.result,"full revoke winner response equals durable receipt result");
          }
        });
        record(`M2.2C timer start/membership revoke ${order} (${iso}/${iso})`,true,{order,isolation:iso,actors:{employee:owner,chief},actorCheck,claims:{winner:winnerIdentity.effective,loser:loserIdentity.effective,retry:retryIdentity},winnerPid,loserPid,blockerPids,blocked,winnerSQLSTATE:winnerResult.code,winnerResponse,loserSQLSTATE:loserResult.code,loserResponse:loserResult.lines.at(-1),loserErrors:loserResult.errors,retrySQLSTATE:retryResult.code,retryPrimaryError:primaryError,baseline,winnerOnly,afterConflict,final,fenceExpected});
        await a.ok("reset role;"); await b.ok("reset role;");
      }
      await timerStartMembershipRace({order:"timer-first",isolation:"RC",base:23000});
      await timerStartMembershipRace({order:"revoke-first",isolation:"RC",base:23010});
      await timerStartMembershipRace({order:"timer-first",isolation:"RR",base:23020});
      await timerStartMembershipRace({order:"revoke-first",isolation:"RR",base:23030});

      // Same-isolation transition/membership races. The winning command stays
      // open while the competing command starts; pg_blocking_pids proves the
      // second session actually waits before the winner commits.
      async function transitionMembershipRace({ order, isolation, base }) {
        const owner = uid(base), assignment = uid(base + 1), task = uid(base + 2);
        const transitionOp = uid(base + 3), revokeOp = uid(base + 4);
        await memberTask(owner, assignment, task, `M2.2C ${order} ${isolation} transition-membership race`);
        const transition = { contractVersion: 1, operationId: transitionOp, kind: "task.transition", expectedRevisions: { [`task:${task}`]: "0" }, payload: { taskId: task, status: "En curso", reason: null, confirmCommercialCompletion: false } };
        const revoke = { contractVersion: 1, operationId: revokeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${owner}`]: "0" }, payload: { companyId: company, profileId: owner, active: false, reason: `M2.2C ${order} ${isolation} transition race` } };
        const iso = isolation === "RC" ? "read committed" : "repeatable read";
        const isolationCheck = `select current_setting('transaction_isolation');`;
        const beginAs = async (session, actor, aal) => {
          await session.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal }))},false);set role authenticated;begin isolation level ${iso};`);
          assert.equal((await session.ok(isolationCheck)).at(-1), iso, `${order}/${isolation}: effective isolation`);
          return Number((await session.ok("select pg_backend_pid();")).at(-1));
        };
        const snapshot = async () => JSON.parse((await observer.ok(`select jsonb_build_object(
          'membership',(select jsonb_build_array(active,revision) from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(owner)}),
          'task',(select jsonb_build_array(status,state_revision) from public.task_instances where id=${lit(task)}),
          'assignment',(select jsonb_build_array(id,owner_id,company_id) from public.task_assignments where id=${lit(assignment)}),
          'activeSessions',(select count(*) from public.task_time_sessions where instance_id=${lit(task)} and ended_at is null),
          'membershipFence',coalesce((select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(owner)}),0),
          'monthFence',coalesce((select fence_epoch from app_private.api_month_fences where organization_id=${lit(org)} and owner_id=${lit(owner)} and period=${lit(monthPeriod)}::date),0),
          'graphFence',coalesce((select fence_epoch from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period=${lit(monthPeriod)}::date),0),
          'transitionOperationFence',coalesce((select fence_epoch from app_private.api_operation_fences where actor_id=${lit(owner)} and operation_id=${lit(transitionOp)}),0),
          'revokeOperationFence',coalesce((select fence_epoch from app_private.api_operation_fences where actor_id=${lit(boss)} and operation_id=${lit(revokeOp)}),0),
          'receipts',(select coalesce(jsonb_agg(jsonb_build_array(actor_id,operation_id,kind) order by operation_id),'[]'::jsonb) from app_private.api_command_receipts where operation_id in (${lit(transitionOp)},${lit(revokeOp)})),
          'trackingEvents',(select coalesce(jsonb_agg(jsonb_build_array(actor_id,kind) order by at),'[]'::jsonb) from app_private.task_tracking_events where organization_id=${lit(org)} and instance_id=${lit(task)}),
          'completionEvents',(select coalesce(jsonb_agg(jsonb_build_array(completed_by,task_revision) order by task_revision),'[]'::jsonb) from app_private.task_completion_events where organization_id=${lit(org)} and instance_id=${lit(task)}),
          'membershipEvents',(select coalesce(jsonb_agg(jsonb_build_array(actor_id,active,revision) order by revision),'[]'::jsonb) from app_private.company_membership_events where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(owner)}),
          'audit',(select coalesce(jsonb_agg(jsonb_build_array(actor_id,action,entity_id) order by at),'[]'::jsonb) from public.audit_events where organization_id=${lit(org)} and ((entity_id=${lit(task)} and actor_id=${lit(owner)} and action='task.tracking.command') or (entity_id=${lit(company)} and actor_id=${lit(boss)} and action='companyMembership.setActive' and details->>'profileId'=${lit(owner)})))
        )::text;`)).at(-1));
        const baseline = await snapshot();
        assert.deepEqual(baseline.membership, [true, 0]);
        assert.deepEqual(baseline.task, ["Pendiente", 0]);
        assert.deepEqual(baseline.assignment, [assignment, owner, company]);
        const actorChecks = (await observer.ok(`select (select role='jefe' and active from public.profiles where id=${lit(boss)})||'|'||(select role='empleado' and active from public.profiles where id=${lit(owner)})||'|'||(select active from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(owner)});`)).at(-1);
        assert.equal(actorChecks, "true|true|true", `${order}/${isolation}: authorized distinct actors ${boss}/${owner}`);

        let blockerPid, waiterPid, winnerResult, staleResult, retryResult, blocked = false;
        if (order === "transition-first") {
          await claims({ role: "authenticated", sub: owner, aal: "aal1" }, owner);
          const winnerTx = await beginAs(a, owner, "aal1");
          blockerPid = winnerTx;
          winnerResult = await a.query(`select api.command_v1('${JSON.stringify(transition).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(winnerResult.code, "00000", JSON.stringify(winnerResult));
          waiterPid = await beginAs(b, boss, "aal2");
          await b.ok(`select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(owner)};`);
          const pending = b.query(`select api.command_v1('${JSON.stringify(revoke).replaceAll("'", "''")}'::jsonb);`);
          const deadline = Date.now() + 10000;
          while (Date.now() < deadline) {
            if ((await observer.ok(`select ${blockerPid}=any(pg_catalog.pg_blocking_pids(${waiterPid}));`)).at(-1) === "t") { blocked = true; break; }
            await new Promise((done) => setTimeout(done, 20));
          }
          assert.equal(blocked, true, `${order}/${isolation}: revoker must be blocked by transition`);
          await a.ok("commit;");
          staleResult = await pending;
          await b.ok(staleResult.code === "00000" ? "commit;" : "rollback;");
          assert.equal(staleResult.code, "40001", JSON.stringify(staleResult));
          const afterConflict = await snapshot();
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${iso};`);
          retryResult = await b.query(`select api.command_v1('${JSON.stringify(revoke).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(retryResult.code, "00000", JSON.stringify(retryResult)); await b.ok("commit;");
          const final = await snapshot();
          assert.deepEqual(afterConflict.membership, [true, 0]);
          assert.deepEqual(afterConflict.task, ["En curso", baseline.task[1] + 1]);
          assert.deepEqual(final.membership, [false, 1]);
          assert.deepEqual(final.task, ["En curso", baseline.task[1] + 2]);
          assert.deepEqual(final.receipts.map(row => row[0]).sort(), [boss, owner].sort());
          assert.deepEqual(final.trackingEvents, []);
          assert.deepEqual(final.membershipEvents.map(row => row[0]), [boss]);
          assert.equal(final.receipts.length, 2); assert.equal(final.trackingEvents.length, 0); assert.equal(final.membershipEvents.length, 1);
          assert.equal(afterConflict.revokeOperationFence, baseline.revokeOperationFence);
          assert.equal(final.revokeOperationFence, baseline.revokeOperationFence + 1);
          assert.deepEqual(afterConflict.audit.map(row => row[0]), [owner]);
          assert.deepEqual(final.audit.map(row => row[0]).sort(), [boss, owner].sort());
          record(`M2.2C task.transition-first membership revoke ${isolation} blocks, stale-aborts and succeeds on fresh retry`, true, { order, isolation, observedIsolation: iso, actorChecks, actors: { transition: owner, revoker: boss }, blockerPid, waiterPid, blocked, winnerSQLSTATE: winnerResult.code, staleSQLSTATE: staleResult.code, retrySQLSTATE: retryResult.code, baseline, afterConflict, final });
        } else {
          await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
          const winnerTx = await beginAs(a, boss, "aal2");
          blockerPid = winnerTx;
          winnerResult = await a.query(`select api.command_v1('${JSON.stringify(revoke).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(winnerResult.code, "00000", JSON.stringify(winnerResult));
          waiterPid = await beginAs(b, owner, "aal1");
          await b.ok(`select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(owner)};`);
          const pending = b.query(`select api.command_v1('${JSON.stringify(transition).replaceAll("'", "''")}'::jsonb);`);
          const deadline = Date.now() + 10000;
          while (Date.now() < deadline) {
            if ((await observer.ok(`select ${blockerPid}=any(pg_catalog.pg_blocking_pids(${waiterPid}));`)).at(-1) === "t") { blocked = true; break; }
            await new Promise((done) => setTimeout(done, 20));
          }
          assert.equal(blocked, true, `${order}/${isolation}: transition must be blocked by revocation`);
          await a.ok("commit;");
          staleResult = await pending;
          await b.ok(staleResult.code === "00000" ? "commit;" : "rollback;");
          assert.equal(staleResult.code, "40001", JSON.stringify(staleResult));
          const afterConflict = await snapshot();
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(owner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: owner, aal: "aal1" }))},false);set role authenticated;begin isolation level ${iso};`);
          retryResult = await b.query(`select api.command_v1('${JSON.stringify(transition).replaceAll("'", "''")}'::jsonb);`);
          assert.equal(retryResult.code, "42501", JSON.stringify(retryResult)); await b.ok("rollback;");
          const final = await snapshot();
          assert.deepEqual(final, afterConflict, "denied transition retry must preserve every snapshotted field");
          assert.deepEqual(final.membership, [false, 1]);
          assert.deepEqual(final.task, ["Pendiente", baseline.task[1] + 1]);
          assert.deepEqual(final.receipts.map(row => row[0]), [boss]);
          assert.deepEqual(final.trackingEvents, []); assert.deepEqual(final.membershipEvents.map(row => row[0]), [boss]);
          assert.equal(final.receipts.length, 1); assert.equal(final.membershipEvents.length, 1);
          assert.deepEqual(final.audit.map(row => row[0]), [boss]);
          record(`M2.2C membership revoke-first task.transition ${isolation} blocks, stale-aborts and denies on fresh retry`, true, { order, isolation, observedIsolation: iso, actorChecks, actors: { transition: owner, revoker: boss }, blockerPid, waiterPid, blocked, winnerSQLSTATE: winnerResult.code, staleSQLSTATE: staleResult.code, retrySQLSTATE: retryResult.code, baseline, afterConflict, final });
        }
        await a.ok("reset role;"); await b.ok("reset role;");
      }
      await transitionMembershipRace({ order: "transition-first", isolation: "RC", base: 15000 });
      await transitionMembershipRace({ order: "revoke-first", isolation: "RC", base: 15010 });
      await transitionMembershipRace({ order: "transition-first", isolation: "RR", base: 15020 });
      await transitionMembershipRace({ order: "revoke-first", isolation: "RR", base: 15030 });

      const timerFirstOwner = uid(9660), timerFirstAssignment = uid(9661), timerFirstTask = uid(9662), timerFirstSession = uid(9663), revokeAfterTimerOp = uid(9664);
      await memberTask(timerFirstOwner, timerFirstAssignment, timerFirstTask, "M2.2C timer-first membership revoke");
      const revokeAfterTimer = { contractVersion: 1, operationId: revokeAfterTimerOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${timerFirstOwner}`]: "0" }, payload: { companyId: company, profileId: timerFirstOwner, active: false, reason: "Timer-first membership revoke" } };
      await claims({ role: "authenticated", sub: timerFirstOwner, aal: "aal1" }, timerFirstOwner);
      await a.ok("begin isolation level read committed;"); const timerFirstPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const timerFirstResult = await a.query(`select public.start_task_timer(${lit(timerFirstTask)},0,${lit(timerFirstSession)},false);`); assert.equal(timerFirstResult.code, "00000", JSON.stringify(timerFirstResult));
      const timerFirstActualSession = timerFirstResult.lines.at(-1); assert.match(timerFirstActualSession,/^[0-9a-f-]{36}$/i,timerFirstActualSession);
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level repeatable read;select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(timerFirstOwner)};`);
      const revokeAfterTimerPid = Number((await b.ok("select pg_backend_pid();")).at(-1)); const pendingRevokeAfterTimer = b.query(`select api.command_v1('${JSON.stringify(revokeAfterTimer).replaceAll("'", "''")}'::jsonb);`);
      let revokeAfterTimerBlocked = false; const revokeAfterTimerDeadline = Date.now() + 10000;
      while (Date.now() < revokeAfterTimerDeadline) { if ((await observer.ok(`select ${timerFirstPid}=any(pg_catalog.pg_blocking_pids(${revokeAfterTimerPid}));`)).at(-1) === "t") { revokeAfterTimerBlocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
      await a.ok("commit;"); const staleRevokeAfterTimer = await pendingRevokeAfterTimer; await b.ok(staleRevokeAfterTimer.code === "00000" ? "commit;" : "rollback;"); assert.equal(revokeAfterTimerBlocked, true); assert.equal(staleRevokeAfterTimer.code, "40001", JSON.stringify(staleRevokeAfterTimer));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
      const retryRevokeAfterTimer = await b.query(`select api.command_v1('${JSON.stringify(revokeAfterTimer).replaceAll("'", "''")}'::jsonb);`); assert.equal(retryRevokeAfterTimer.code, "00000", JSON.stringify(retryRevokeAfterTimer)); await a.ok("reset role;"); await b.ok("reset role;");
      const timerFirstFinal = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where profile_id=${lit(timerFirstOwner)} and company_id=${lit(company)})||'|'||(select count(*) from public.task_time_sessions where id=${lit(timerFirstActualSession)} and ended_at is null)||'|'||(select count(*) from public.task_time_sessions where id=${lit(timerFirstActualSession)} and ended_at is not null)||'|'||(select status||'|'||state_revision from public.task_instances where id=${lit(timerFirstTask)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(revokeAfterTimerOp)})||'|'||(select count(*) from app_private.company_membership_events where profile_id=${lit(timerFirstOwner)} and company_id=${lit(company)});`)).at(-1);
      assert.equal(timerFirstFinal, "false|1|0|1|En curso|2|1|1", timerFirstFinal);
      record("M2.2C timer-first then membership revoke blocks, stale RR aborts, retry ends the new session once", true, { isolationPair: "read committed/repeatable read", blocked: revokeAfterTimerBlocked, timerSQLSTATE: timerFirstResult.code, timerSessionId: timerFirstActualSession, staleRevocationSQLSTATE: staleRevokeAfterTimer.code, retrySQLSTATE: retryRevokeAfterTimer.code, finalState: timerFirstFinal });

      const revokedTimerOwner = uid(9670), revokedTimerAssignment = uid(9671), revokedTimerTask = uid(9672), revokedTimerSession = uid(9673), revokeBeforeTimerOp = uid(9674);
      await memberTask(revokedTimerOwner, revokedTimerAssignment, revokedTimerTask, "M2.2C revoke-first timer");
      const revokeBeforeTimer = { contractVersion: 1, operationId: revokeBeforeTimerOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${revokedTimerOwner}`]: "0" }, payload: { companyId: company, profileId: revokedTimerOwner, active: false, reason: "Revoke-first timer" } };
      await claims({ role: "authenticated", sub: revokedTimerOwner, aal: "aal1" }, revokedTimerOwner);
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(revokedTimerOwner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: revokedTimerOwner, aal: "aal1" }))},false);set role authenticated;begin isolation level repeatable read;select active,revision from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(revokedTimerOwner)};`);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const revokeBeforeTimerResult = await a.query(`select api.command_v1('${JSON.stringify(revokeBeforeTimer).replaceAll("'", "''")}'::jsonb);`); assert.equal(revokeBeforeTimerResult.code, "00000", JSON.stringify(revokeBeforeTimerResult));
      const staleMembershipTimer = await b.query(`select public.start_task_timer(${lit(revokedTimerTask)},0,${lit(revokedTimerSession)},false);`); await b.ok(staleMembershipTimer.code === "00000" ? "commit;" : "rollback;"); assert.equal(staleMembershipTimer.code, "40001", JSON.stringify(staleMembershipTimer));
      await claims({ role: "authenticated", sub: revokedTimerOwner, aal: "aal1" }, revokedTimerOwner);
      const retryMembershipTimer = await b.query(`select public.start_task_timer(${lit(revokedTimerTask)},0,${lit(revokedTimerSession)},false);`); assert.equal(retryMembershipTimer.code, "P0001", JSON.stringify(retryMembershipTimer)); await a.ok("reset role;"); await b.ok("reset role;");
      const revokeFirstTimerFinal = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where profile_id=${lit(revokedTimerOwner)} and company_id=${lit(company)})||'|'||(select count(*) from public.task_time_sessions where instance_id=${lit(revokedTimerTask)} and actor_id=${lit(revokedTimerOwner)} and ended_at is null)||'|'||(select count(*) from public.task_time_sessions where instance_id=${lit(revokedTimerTask)} and actor_id=${lit(revokedTimerOwner)})||'|'||(select count(*) from public.task_mutation_receipts where actor_id=${lit(revokedTimerOwner)} and operation_id=${lit(revokedTimerSession)} and operation_kind='start_timer')||'|'||(select status||'|'||state_revision from public.task_instances where id=${lit(revokedTimerTask)})||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(revokeBeforeTimerOp)})||'|'||(select count(*) from app_private.company_membership_events where profile_id=${lit(revokedTimerOwner)} and company_id=${lit(company)});`)).at(-1);
      assert.equal(revokeFirstTimerFinal, "false|1|0|0|0|Pendiente|1|1|1", revokeFirstTimerFinal);
      record("M2.2C revoke-first mixed RR/RC stale legacy timer aborts then denies on retry without session", true, { isolationPair: "repeatable read/read committed", revokeSQLSTATE: revokeBeforeTimerResult.code, staleTimerSQLSTATE: staleMembershipTimer.code, retrySQLSTATE: retryMembershipTimer.code, finalState: revokeFirstTimerFinal });

      // Acceptance row 12: operation IDs are bound to the complete command
      // envelope. Changed active/reason/revision must not mutate any state.
      const conflictOwner = uid(9700), conflictAssignment = uid(9701), conflictTask = uid(9702), conflictOp = uid(9703);
      await memberTask(conflictOwner, conflictAssignment, conflictTask, "M2.2C operation conflict target");
      const conflictBase = { contractVersion: 1, operationId: conflictOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${conflictOwner}`]: "0" }, payload: { companyId: company, profileId: conflictOwner, active: false, reason: "Conflict baseline" } };
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const conflictFirst = await a.query(`select api.command_v1('${JSON.stringify(conflictBase).replaceAll("'", "''")}'::jsonb);`); assert.equal(conflictFirst.code, "00000", JSON.stringify(conflictFirst));
      const conflictStateSql = `select (select active::text||'|'||revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(conflictOwner)})||'|'||(select count(*) from app_private.company_membership_events where company_id=${lit(company)} and profile_id=${lit(conflictOwner)})||'|'||(select count(*) from public.audit_events where action='companyMembership.setActive' and entity_id=${lit(company)} and details->>'profileId'=${lit(conflictOwner)})||'|'||coalesce((select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(conflictOwner)}),0)||'|'||coalesce((select fence_epoch from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period=${lit(monthPeriod)}::date),0)||'|'||coalesce((select fence_epoch from app_private.api_operation_fences where actor_id=${lit(boss)} and operation_id=${lit(conflictOp)}),0)||'|'||(select count(*) from app_private.api_command_receipts where actor_id=${lit(boss)} and operation_id=${lit(conflictOp)});`;
      const conflictBefore = (await observer.ok(conflictStateSql)).at(-1);
      const conflictVariants = [
        { ...conflictBase, payload: { ...conflictBase.payload, active: true } },
        { ...conflictBase, payload: { ...conflictBase.payload, reason: "Changed reason" } },
        { ...conflictBase, expectedRevisions: { [`membership:${company}:${conflictOwner}`]: "1" } },
      ];
      const conflictResults = [];
      for (const variant of conflictVariants) { const r = await a.query(`select api.command_v1('${JSON.stringify(variant).replaceAll("'", "''")}'::jsonb);`); conflictResults.push(r.code); assert.equal(r.code, "40001", JSON.stringify(r)); }
      const conflictResultsRR = [];
      for (const variant of conflictVariants) {
        await a.ok("begin isolation level repeatable read;");
        await a.ok(`select active,revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(conflictOwner)};`);
        const r = await a.query(`select api.command_v1('${JSON.stringify(variant).replaceAll("'", "''")}'::jsonb);`);
        conflictResultsRR.push(r.code); assert.equal(r.code, "40001", JSON.stringify(r));
        await a.ok("rollback;");
      }
      const conflictAfter = (await observer.ok(conflictStateSql)).at(-1); assert.equal(conflictAfter, conflictBefore, `${conflictBefore} -> ${conflictAfter}`);
      record("M2.2C same operationId changed-argument conflicts are inert under RC and fresh RR snapshots", true, { readCommittedVariantSQLSTATEs: conflictResults, repeatableReadVariantSQLSTATEs: conflictResultsRR, repeatableReadTransactions: "one fresh transaction per conflicting replay", stateBeforeAfter: `${conflictBefore}|${conflictAfter}` });

      // Fault injection runs after membership and session updates but before
      // the event/receipt. Each failed call must roll back all writes; retry
      // after removing the trigger commits exactly once in a new transaction
      // using the same isolation level as the injected failure.
      await observer.ok(`create or replace function app_private.m2_2c_fail_membership_event() returns trigger language plpgsql set search_path='' as $$ begin if new.reason like 'M2.2C rollback injection:%' then raise exception using errcode='23514',message='M2.2C injected membership event failure'; end if; return new; end $$; create trigger m2_2c_fail_membership_event before insert on app_private.company_membership_events for each row execute function app_private.m2_2c_fail_membership_event();`);
      for (const [index, isolation] of [[0, "read committed"], [1, "repeatable read"]]) {
        const ownerId = uid(9800 + index * 10), assignmentId = uid(9801 + index * 10), taskId = uid(9802 + index * 10), sessionId = uid(9803 + index * 10), operationId = uid(9804 + index * 10);
        await memberTask(ownerId, assignmentId, taskId, `M2.2C injected rollback ${index}`);
        await claims({ role: "authenticated", sub: ownerId, aal: "aal1" }, ownerId);
        const started = await a.query(`select public.start_task_timer(${lit(taskId)},0,${lit(sessionId)},false);`); assert.equal(started.code, "00000", JSON.stringify(started)); const actualSessionId = started.lines.at(-1); assert.match(actualSessionId, /^[0-9a-f-]{36}$/i, JSON.stringify(started));
        const command = { contractVersion: 1, operationId, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${ownerId}`]: "0" }, payload: { companyId: company, profileId: ownerId, active: false, reason: `M2.2C rollback injection:${isolation}` } };
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        const injectionSnapshotSql = `select (select active::text||'|'||revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(ownerId)})||'|'||(select ended_at is null from public.task_time_sessions where id=${lit(actualSessionId)})||'|'||(select count(*) from app_private.company_membership_events where company_id=${lit(company)} and profile_id=${lit(ownerId)})||'|'||(select count(*) from public.audit_events where action='companyMembership.setActive' and details->>'profileId'=${lit(ownerId)})||'|'||coalesce((select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(ownerId)}),0)||'|'||coalesce((select fence_epoch from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period=${lit(monthPeriod)}::date),0)||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(operationId)})||'|'||(select count(*) from app_private.api_operation_fences where actor_id=${lit(boss)} and operation_id=${lit(operationId)});`;
        const injectionBefore = (await observer.ok(injectionSnapshotSql)).at(-1);
        if (isolation === "repeatable read") { await a.ok("begin isolation level repeatable read;"); await a.ok(`select active,revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(ownerId)};`); }
        const failed = await a.query(`select api.command_v1('${JSON.stringify(command).replaceAll("'", "''")}'::jsonb);`); assert.equal(failed.code, "23514", JSON.stringify(failed));
        await a.ok("rollback;");
        const rollbackState = (await observer.ok(injectionSnapshotSql)).at(-1);
        assert.equal(rollbackState, injectionBefore, `${injectionBefore} -> ${rollbackState}`);
        await observer.ok("drop trigger m2_2c_fail_membership_event on app_private.company_membership_events;");
        await a.ok(`begin isolation level ${isolation};`);
        const retried = await a.query(`select api.command_v1('${JSON.stringify(command).replaceAll("'", "''")}'::jsonb);`); assert.equal(retried.code, "00000", JSON.stringify(retried));
        await a.ok("commit;");
        const committedState = (await observer.ok(injectionSnapshotSql)).at(-1);
        assert.match(committedState, /^false\|1\|false\|1\|1\|\d+\|\d+\|1\|1$/u, committedState);
        record(`M2.2C injected membership event failure rolls back then retry commits once under ${isolation}`, true, { failureTransactionIsolation: isolation, retryIsolation: isolation, injectedSQLSTATE: failed.code, stateBefore: injectionBefore, stateAfterRollback: rollbackState, retrySQLSTATE: retried.code, committedState });
        if (index === 0) await observer.ok(`create trigger m2_2c_fail_membership_event before insert on app_private.company_membership_events for each row execute function app_private.m2_2c_fail_membership_event();`);
      }
      await observer.ok("drop trigger if exists m2_2c_fail_membership_event on app_private.company_membership_events; drop function if exists app_private.m2_2c_fail_membership_event();");

      // Membership scope is company-specific: an open B session and a second
      // eligible executor remain untouched while A is revoked; timer-first A
      // is stopped once, while revoke-first A cannot create a session on retry.
      const scopedOwner = uid(9970), multiPeer = uid(9971), multiAssignA = uid(9972), multiAssignB = uid(9973), multiTaskA = uid(9974), multiTaskB = uid(9975), multiSessionB = uid(9976), multiScopeRevokeOp = uid(9977), multiTimerOp = uid(9978);
      const companyB = uid(9979), teamB = uid(9980);
      await observer.ok(`insert into public.companies(id,organization_id,name) values(${lit(companyB)},${lit(org)},'M2.2C company B'); insert into public.teams(id,organization_id,name,manager_id) values(${lit(teamB)},${lit(org)},'M2.2C team B',${lit(boss)}); insert into auth.users(id) values(${lit(scopedOwner)}); insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(scopedOwner)},${lit(org)},'M2.2C multi-company owner','empleado','Test','Test','Test'); insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(scopedOwner)}),(${lit(org)},${lit(companyB)},${lit(scopedOwner)}),(${lit(org)},${lit(companyB)},${lit(boss)}); insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(scopedOwner)}),(${lit(org)},${lit(teamB)},${lit(scopedOwner)}); insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist) values(${lit(multiAssignA)},${lit(org)},${lit(company)},${lit(scopedOwner)},${lit(team)},'M2.2C multi-company A','operativa',1,'comprobantes',10,'mensual',${lit(monthPeriod)}::date,15,'[]'),(${lit(multiAssignB)},${lit(org)},${lit(companyB)},${lit(scopedOwner)},${lit(teamB)},'M2.2C multi-company B','operativa',1,'comprobantes',10,'mensual',${lit(monthPeriod)}::date,15,'[]'); insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,unit,target,checklist,status) values(${lit(multiTaskA)},${lit(org)},${lit(multiAssignA)},${lit(company)},${lit(scopedOwner)},${lit(team)},${lit(monthPeriod)}::date,${lit(scheduledOn)}::date,'M2.2C multi-company A','operativa',1,'comprobantes',10,'[]','En curso'),(${lit(multiTaskB)},${lit(org)},${lit(multiAssignB)},${lit(companyB)},${lit(scopedOwner)},${lit(teamB)},${lit(monthPeriod)}::date,${lit(scheduledOn)}::date,'M2.2C multi-company B','operativa',1,'comprobantes',10,'[]','En curso'); insert into public.task_time_sessions(id,organization_id,instance_id,actor_id,started_at) values(${lit(multiSessionB)},${lit(org)},${lit(multiTaskB)},${lit(scopedOwner)},clock_timestamp()-interval '2 minutes');`);
      await observer.ok(`update public.profiles set manager_id=${lit(manager)} where id=${lit(scopedOwner)};`);
      // SQL 009 block notes are a distinct legacy resource, but a manager's
      // supervisor read must end when their company membership is revoked.
      await claims({ role: "authenticated", sub: scopedOwner, aal: "aal1" }, scopedOwner);
      const privateNoteResult = await a.query(`select public.save_private_block_note(${lit(multiTaskA)},'M2.2C private block-note revocation probe',0,${lit(uid(10020))});`);
      assert.equal(privateNoteResult.code, "00000", JSON.stringify(privateNoteResult));
      const privateNoteId = JSON.parse(privateNoteResult.lines.at(-1)).note_id;
      await claims({ role: "authenticated", sub: manager, aal: "aal2" }, manager);
      const managerNoteBeforeRevoke = await a.query(`select count(*) from public.task_private_block_notes where id=${lit(privateNoteId)};`);
      const managerNoteVersionsBeforeRevoke = await a.query(`select count(*) from public.task_private_block_note_versions where note_id=${lit(privateNoteId)};`);
      assert.equal(managerNoteBeforeRevoke.lines.at(-1), "1");
      assert.equal(managerNoteVersionsBeforeRevoke.lines.at(-1), "1");
      const revokeManagerMembership = { contractVersion: 1, operationId: uid(10021), kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${manager}`]: "0" }, payload: { companyId: company, profileId: manager, active: false, reason: "M2.2C private note access revoke" } };
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const revokeManagerResult = await a.query(`select api.command_v1('${JSON.stringify(revokeManagerMembership).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(revokeManagerResult.code, "00000", JSON.stringify(revokeManagerResult));
      await claims({ role: "authenticated", sub: manager, aal: "aal2" }, manager);
      const managerNoteAfterOwnMembershipRevoke = await a.query(`select count(*) from public.task_private_block_notes where id=${lit(privateNoteId)};`);
      const managerNoteVersionsAfterOwnMembershipRevoke = await a.query(`select count(*) from public.task_private_block_note_versions where note_id=${lit(privateNoteId)};`);
      assert.equal(managerNoteAfterOwnMembershipRevoke.lines.at(-1), "0");
      assert.equal(managerNoteVersionsAfterOwnMembershipRevoke.lines.at(-1), "0");
      await a.ok("begin isolation level repeatable read;");
      const managerNoteAfterRevokeRR = await a.query(`select count(*) from public.task_private_block_notes where id=${lit(privateNoteId)};`);
      const managerNoteVersionsAfterRevokeRR = await a.query(`select count(*) from public.task_private_block_note_versions where note_id=${lit(privateNoteId)};`);
      assert.equal(managerNoteAfterRevokeRR.lines.at(-1), "0");
      assert.equal(managerNoteVersionsAfterRevokeRR.lines.at(-1), "0");
      await a.ok("rollback;");
      const restoreManagerMembership = { contractVersion: 1, operationId: uid(10022), kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${manager}`]: "1" }, payload: { companyId: company, profileId: manager, active: true, reason: "M2.2C private note access restore" } };
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const restoreManagerResult = await a.query(`select api.command_v1('${JSON.stringify(restoreManagerMembership).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(restoreManagerResult.code, "00000", JSON.stringify(restoreManagerResult));
      await claims({ role: "authenticated", sub: manager, aal: "aal2" }, manager);
      const managerNoteAfterRestore = await a.query(`select count(*) from public.task_private_block_notes where id=${lit(privateNoteId)};`);
      const managerNoteVersionsAfterRestore = await a.query(`select count(*) from public.task_private_block_note_versions where note_id=${lit(privateNoteId)};`);
      assert.equal(managerNoteAfterRestore.lines.at(-1), "1");
      assert.equal(managerNoteVersionsAfterRestore.lines.at(-1), "1");
      const matrixApi = {};
      await claims({ role: "authenticated", sub: boss, aal: "aal1" }, boss);
      matrixApi.bossAal1 = (await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskA }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`)).code;
      matrixApi.bossAal1Rls = (await a.query(`select count(*) from public.task_instances where id in (${lit(multiTaskA)},${lit(multiTaskB)});`)).lines.at(-1);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      matrixApi.bossAal2A = (await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskA }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`)).code;
      matrixApi.bossAal2B = (await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskB }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`)).code;
      await claims({ role: "authenticated", sub: manager, aal: "aal2" }, manager);
      matrixApi.managerA = (await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskA }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`)).code;
      matrixApi.managerB = (await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskB }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`)).code;
      matrixApi.managerRls = (await a.query(`select count(*) from public.task_instances where id in (${lit(multiTaskA)},${lit(multiTaskB)});`)).lines.at(-1);
      await claims({ role: "authenticated", sub: scopedOwner, aal: "aal1" }, scopedOwner);
      matrixApi.employeeA = (await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskA }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`)).code;
      matrixApi.employeeB = (await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskB }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`)).code;
      matrixApi.employeeRls = (await a.query(`select count(*) from public.task_instances where id in (${lit(multiTaskA)},${lit(multiTaskB)});`)).lines.at(-1);
      assert.equal(matrixApi.bossAal1, "42501", JSON.stringify(matrixApi)); assert.equal(matrixApi.bossAal1Rls, "2", JSON.stringify(matrixApi)); assert.equal(matrixApi.bossAal2A, "00000", JSON.stringify(matrixApi)); assert.equal(matrixApi.bossAal2B, "00000", JSON.stringify(matrixApi));
      assert.equal(matrixApi.managerA, "00000"); assert.equal(matrixApi.managerB, "42501"); assert.equal(matrixApi.managerRls, "1"); assert.equal(matrixApi.employeeA, "00000"); assert.equal(matrixApi.employeeB, "00000"); assert.equal(matrixApi.employeeRls, "2");
      const inactiveOwner = uid(9910), inactiveAssignment = uid(9911), inactiveTask = uid(9912);
      await memberTask(inactiveOwner, inactiveAssignment, inactiveTask, "M2.2C inactive profile matrix"); await observer.ok(`update public.profiles set active=false where id=${lit(inactiveOwner)};`);
      await claims({ role: "authenticated", sub: inactiveOwner, aal: "aal1" }, inactiveOwner);
      const inactiveContext = await a.query("select api.get_context_v1();"), inactiveApi = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: inactiveTask }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`), inactiveRls = await a.query(`select count(*) from public.task_instances where id=${lit(inactiveTask)};`);
      assert.equal(inactiveContext.code, "42501"); assert.equal(inactiveApi.code, "42501"); assert.equal(inactiveRls.lines.at(-1), "0");
      await observer.ok(`update public.profiles set active=true where id=${lit(foreignOwner)};`);
      await claims({ role: "authenticated", sub: foreignOwner, aal: "aal1" }, foreignOwner);
      const foreignO2Api = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: foreignTask }, cursor: null, limit: 10 }).replaceAll("'", "''")}'::jsonb);`), foreignO1Api = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskA }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`), foreignRls = await a.query(`select count(*) from public.task_instances where id in (${lit(multiTaskA)},${lit(multiTaskB)},${lit(foreignTask)});`);
      assert.equal(foreignO1Api.code, "42501", JSON.stringify(foreignO1Api)); assert.equal(foreignO2Api.code, "00000", JSON.stringify({ foreignO2Api, foreignOwner, foreignCompany, foreignTask })); assert.equal(foreignRls.lines.at(-1), "1", JSON.stringify(foreignRls));
      const techId = uid(9913); await observer.ok(`insert into auth.users(id) values(${lit(techId)}); insert into app_private.technical_accounts(user_id,organization_id,display_name) values(${lit(techId)},${lit(org)},'M2.2C local technical principal');`);
      await claims({ role: "authenticated", sub: techId, aal: "aal2" }, techId);
      const techContext = await a.query("select api.get_context_v1();"), techApi = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskA }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`), techRls = await a.query(`select count(*) from public.task_instances where id=${lit(multiTaskA)};`);
      assert.equal(techContext.code, "00000"); assert.equal(techApi.code, "42501"); assert.equal(techRls.lines.at(-1), "0");
      await a.ok(`reset role;select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims','{"role":"anon"}',false);set role anon;`);
      const anonApi = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskA }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`), anonRls = await a.query(`select count(*) from public.task_instances where id=${lit(multiTaskA)};`);
      assert.equal(anonApi.code, "42501"); assert.equal(anonRls.code === "00000" ? anonRls.lines.at(-1) : "0", "0");
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const multiScopeRevokeCommand = { contractVersion: 1, operationId: multiScopeRevokeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${scopedOwner}`]: "0" }, payload: { companyId: company, profileId: scopedOwner, active: false, reason: "A-only multi-company revoke" } };
      await claims({ role: "authenticated", sub: scopedOwner, aal: "aal1" }, scopedOwner);
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(scopedOwner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: scopedOwner, aal: "aal1" }))},false);set role authenticated;begin isolation level repeatable read;select active,revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(scopedOwner)};`);
       await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
       await a.ok("begin isolation level read committed;"); const multiRevokePid = Number((await a.ok("select pg_backend_pid();")).at(-1));
       const multiScopeRevokeResult = await a.query(`select api.command_v1('${JSON.stringify(multiScopeRevokeCommand).replaceAll("'", "''")}'::jsonb);`); assert.equal(multiScopeRevokeResult.code, "00000", JSON.stringify(multiScopeRevokeResult));
       const multiTimerPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
       const multiPendingTimer = b.query(`select public.start_task_timer(${lit(multiTaskA)},0,${lit(multiTimerOp)},false);`);
       let multiTimerBlocked = false; const multiTimerDeadline = Date.now() + 10000;
       while (Date.now() < multiTimerDeadline) { if ((await observer.ok(`select ${multiRevokePid}=any(pg_catalog.pg_blocking_pids(${multiTimerPid}));`)).at(-1) === "t") { multiTimerBlocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
       await a.ok("commit;"); const multiStaleTimer = await multiPendingTimer; await b.ok(multiStaleTimer.code === "00000" ? "commit;" : "rollback;"); assert.equal(multiTimerBlocked, true); assert.equal(multiStaleTimer.code, "40001", JSON.stringify(multiStaleTimer));
       await claims({ role: "authenticated", sub: scopedOwner, aal: "aal1" }, scopedOwner);
       const afterRevokeApiA = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskA }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`), afterRevokeApiB = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskB }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`), afterRevokeRls = await a.query(`select count(*) from public.task_instances where id in (${lit(multiTaskA)},${lit(multiTaskB)});`);
       assert.equal(afterRevokeApiA.code, "42501"); assert.equal(afterRevokeApiB.code, "00000"); assert.equal(afterRevokeRls.lines.at(-1), "1");
       const postRevokeMatrix = {};
       await claims({ role: "authenticated", sub: manager, aal: "aal2" }, manager);
       const postRevokeManagerA = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskA }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
       postRevokeMatrix.managerA = postRevokeManagerA.code;
       const managerAEnvelope = postRevokeManagerA.code === "00000" ? JSON.parse(postRevokeManagerA.lines.at(-1)) : null;
       postRevokeMatrix.managerAItems = managerAEnvelope?.data.items.length ?? 0;
       postRevokeMatrix.managerANextCursor = managerAEnvelope?.data.nextCursor ?? null;
       postRevokeMatrix.managerALeaksTarget = managerAEnvelope !== null && (JSON.stringify(managerAEnvelope).includes(multiTaskA) || JSON.stringify(managerAEnvelope).includes("M2.2C multi-company A"));
       postRevokeMatrix.managerAHasTotal = managerAEnvelope !== null && Object.hasOwn(managerAEnvelope.data, "total");
       postRevokeMatrix.managerRlsA = (await a.query(`select count(*) from public.task_instances where id=${lit(multiTaskA)};`)).lines.at(-1);
       postRevokeMatrix.managerPrivateNoteRows = (await a.query(`select count(*) from public.task_private_block_notes where id=${lit(privateNoteId)};`)).lines.at(-1);
       postRevokeMatrix.managerPrivateNoteVersionRows = (await a.query(`select count(*) from public.task_private_block_note_versions where note_id=${lit(privateNoteId)};`)).lines.at(-1);
       assert.equal(postRevokeMatrix.managerPrivateNoteRows, "1");
       assert.equal(postRevokeMatrix.managerPrivateNoteVersionRows, "1");
       const managerTransitionOp = uid(9981);
       const managerTransitionBefore = (await observer.ok(`select status||'|'||state_revision from public.task_instances where id=${lit(multiTaskA)};`)).at(-1);
       const managerTransition = await a.query(`select api.command_v1('${JSON.stringify({ contractVersion: 1, operationId: managerTransitionOp, kind: "task.transition", expectedRevisions: { [`task:${multiTaskA}`]: "0" }, payload: { taskId: multiTaskA, status: "Completada", reason: null, confirmCommercialCompletion: false } }).replaceAll("'", "''")}'::jsonb);`);
       postRevokeMatrix.managerTransition = managerTransition.code;
       const managerTransitionAfter = (await observer.ok(`select (select status||'|'||state_revision from public.task_instances where id=${lit(multiTaskA)})||'|'||(select count(*) from app_private.api_command_receipts where actor_id=${lit(manager)} and operation_id=${lit(managerTransitionOp)});`)).at(-1);
       postRevokeMatrix.managerTransitionStateBeforeAfter = `${managerTransitionBefore}|${managerTransitionAfter}`;
       await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
       postRevokeMatrix.bossAal2A = (await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskA }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`)).code;
       postRevokeMatrix.bossAal2B = (await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskB }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`)).code;
       postRevokeMatrix.bossCannotReadO2 = (await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: foreignTask }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`)).code;
       postRevokeMatrix.bossRlsRows = (await a.query(`select count(*) from public.task_instances where id in (${lit(multiTaskA)},${lit(multiTaskB)});`)).lines.at(-1);
       postRevokeMatrix.bossRlsRowsIncludingO2 = (await a.query(`select count(*) from public.task_instances where id in (${lit(multiTaskA)},${lit(multiTaskB)},${lit(foreignTask)});`)).lines.at(-1);
       await claims({ role: "authenticated", sub: foreignOwner, aal: "aal1" }, foreignOwner);
       postRevokeMatrix.o2Own = (await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: foreignTask }, cursor: null, limit: 10 }).replaceAll("'", "''")}'::jsonb);`)).code;
       postRevokeMatrix.o2CannotReadO1 = (await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskA }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`)).code;
       postRevokeMatrix.o2RlsRows = (await a.query(`select count(*) from public.task_instances where id in (${lit(multiTaskA)},${lit(multiTaskB)},${lit(foreignTask)});`)).lines.at(-1);
       await claims({ role: "authenticated", sub: inactiveOwner, aal: "aal1" }, inactiveOwner);
       postRevokeMatrix.inactiveQuery = (await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: inactiveTask }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`)).code;
       postRevokeMatrix.inactiveRlsRows = (await a.query(`select count(*) from public.task_instances where id=${lit(inactiveTask)};`)).lines.at(-1);
       await claims({ role: "authenticated", sub: techId, aal: "aal2" }, techId);
       postRevokeMatrix.technicalQuery = (await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskA }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`)).code;
       postRevokeMatrix.technicalRlsRows = (await a.query(`select count(*) from public.task_instances where id=${lit(multiTaskA)};`)).lines.at(-1);
       await a.ok(`reset role;select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims','{"role":"anon"}',false);set role anon;`);
       postRevokeMatrix.anonQuery = (await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "activityPage", filters: { taskId: multiTaskA }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`)).code;
       const postRevokeAnonRls = await a.query(`select count(*) from public.task_instances where id=${lit(multiTaskA)};`);
       postRevokeMatrix.anonRlsRows = postRevokeAnonRls.code === "00000" ? postRevokeAnonRls.lines.at(-1) : "0";
       assert.equal(afterRevokeApiA.code, "42501"); assert.equal(afterRevokeApiB.code, "00000"); assert.equal(afterRevokeRls.lines.at(-1), "1");
       assert.equal(postRevokeMatrix.managerA, "00000"); assert.equal(postRevokeMatrix.managerAItems, 0); assert.equal(postRevokeMatrix.managerANextCursor, null); assert.equal(postRevokeMatrix.managerALeaksTarget, false); assert.equal(postRevokeMatrix.managerAHasTotal, false); assert.equal(postRevokeMatrix.managerRlsA, "1");
       assert.equal(postRevokeMatrix.managerTransition, "42501"); assert.equal(managerTransitionAfter, `${managerTransitionBefore}|0`);
       assert.equal(postRevokeMatrix.bossAal2A, "00000"); assert.equal(postRevokeMatrix.bossAal2B, "00000"); assert.equal(postRevokeMatrix.bossCannotReadO2, "42501"); assert.equal(postRevokeMatrix.bossRlsRows, "2"); assert.equal(postRevokeMatrix.bossRlsRowsIncludingO2, "2");
       assert.equal(postRevokeMatrix.o2Own, "00000"); assert.equal(postRevokeMatrix.o2CannotReadO1, "42501"); assert.equal(postRevokeMatrix.o2RlsRows, "1");
       assert.equal(postRevokeMatrix.inactiveQuery, "42501"); assert.equal(postRevokeMatrix.inactiveRlsRows, "0");
       assert.equal(postRevokeMatrix.technicalQuery, "42501"); assert.equal(postRevokeMatrix.technicalRlsRows, "0");
       assert.equal(postRevokeMatrix.anonQuery, "42501"); assert.equal(postRevokeMatrix.anonRlsRows, "0");
      record("M2.2C synthetic local API+RLS role matrix before/after revoke: task scope, activity projection, legacy block notes, execution, O2, inactive, technical, anon", true, { beforeRevoke: { api: matrixApi, managerPrivateNoteRows: managerNoteBeforeRevoke.lines.at(-1), managerPrivateNoteVersionRows: managerNoteVersionsBeforeRevoke.lines.at(-1), afterManagerMembershipRevoke: { revokeSQLSTATE: revokeManagerResult.code, readCommittedNoteRows: managerNoteAfterOwnMembershipRevoke.lines.at(-1), readCommittedVersionRows: managerNoteVersionsAfterOwnMembershipRevoke.lines.at(-1), repeatableReadNoteRows: managerNoteAfterRevokeRR.lines.at(-1), repeatableReadVersionRows: managerNoteVersionsAfterRevokeRR.lines.at(-1) }, afterManagerMembershipRestore: { restoreSQLSTATE: restoreManagerResult.code, noteRows: managerNoteAfterRestore.lines.at(-1), versionRows: managerNoteVersionsAfterRestore.lines.at(-1) }, inactive: { context: inactiveContext.code, query: inactiveApi.code, visibleRows: inactiveRls.lines.at(-1) }, foreignOrg: { O1: foreignO1Api.code, O2: foreignO2Api.code, visibleTasks: foreignRls.lines.at(-1) }, technical: { context: techContext.code, query: techApi.code, visibleRows: techRls.lines.at(-1) }, anon: { query: anonApi.code, directRlsSQLSTATE: anonRls.code, visibleRows: anonRls.code === "00000" ? anonRls.lines.at(-1) : "0" } }, afterRevoke: { employeeA: afterRevokeApiA.code, employeeB: afterRevokeApiB.code, employeeVisibleRows: afterRevokeRls.lines.at(-1), ...postRevokeMatrix }, noteResourceScope: "legacy task_private_block_notes use current supervisor authorization and are tested independently from personal_annotations (M2.5, not covered by SQL014)", authMode: "synthetic local JWT claims; hosted Auth/HTTP unavailable in this runner" });
      const multiRetryTimer = await b.query(`select public.start_task_timer(${lit(multiTaskA)},0,${lit(multiTimerOp)},false);`); assert.equal(multiRetryTimer.code, "P0001", JSON.stringify(multiRetryTimer)); await a.ok("reset role;"); await b.ok("reset role;");
      const multiFinal = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(scopedOwner)})||'|'||(select active from public.company_memberships where company_id=${lit(companyB)} and profile_id=${lit(scopedOwner)})||'|'||(select count(*) from public.task_time_sessions where instance_id=${lit(multiTaskA)} and actor_id=${lit(scopedOwner)})||'|'||(select ended_at is null from public.task_time_sessions where id=${lit(multiSessionB)})||'|'||(select count(*) from public.task_time_sessions where instance_id=${lit(multiTaskB)} and actor_id=${lit(multiPeer)} and ended_at is null)||'|'||(select count(*) from app_private.api_command_receipts where operation_id=${lit(multiScopeRevokeOp)});`)).at(-1);
       assert.equal(multiFinal, "false|1|true|0|true|0|1", multiFinal);
       record("M2.2C company A revoke wins concurrent timer start, leaves company B executor/session intact", true, { isolationPair: "read committed/repeatable read", blocked: multiTimerBlocked, revokeSQLSTATE: multiScopeRevokeResult.code, staleTimerSQLSTATE: multiStaleTimer.code, retryTimerSQLSTATE: multiRetryTimer.code, APIafterRevoke: { companyA: afterRevokeApiA.code, companyB: afterRevokeApiB.code }, visibleTaskCountAfterRevoke: afterRevokeRls.lines.at(-1), finalState: multiFinal });

      // Direct membership-revoke / legacy coverage-cancel races. The losing
      // transaction takes its MVCC snapshot before the winner commits, and the
      // test captures the actual blocker, retry, immutable cancellation actor,
      // receipts/events/audit, task revision and restore behavior.
      async function membershipCoverageRace(caseBase, firstAction, firstIso, secondIso) {
        const ownerId = uid(caseBase), replacementId = uid(caseBase + 1), assignmentId = uid(caseBase + 2), taskId = uid(caseBase + 3), planId = uid(caseBase + 4), approvalOp = uid(caseBase + 5), cancelOp = uid(caseBase + 6), revokeOp = uid(caseBase + 7), restoreOp = uid(caseBase + 8);
        const fixture = await coveredTaskFixture(ownerId, replacementId, assignmentId, taskId, planId, approvalOp, `M2.2C coverage/membership ${firstAction} ${firstIso}/${secondIso}`);
        const cancelSql = `select public.cancel_task_coverage_binding(${lit(fixture.bindingId)},'M2.2C explicit cancellation ${firstAction}',${lit(cancelOp)});`;
        const revoke = { contractVersion: 1, operationId: revokeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${replacementId}`]: "0" }, payload: { companyId: company, profileId: replacementId, active: false, reason: `M2.2C membership revoke ${firstAction}` } };
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        let firstResult, secondResult, blocked = false, firstPid, secondPid;
        if (firstAction === "cancel") {
          await a.ok(`begin isolation level ${firstIso};`); firstPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
          firstResult = await a.query(cancelSql); assert.equal(firstResult.code, "00000", JSON.stringify(firstResult));
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${secondIso};select active,revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(replacementId)};`);
          secondPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
          const pending = b.query(`select api.command_v1('${JSON.stringify(revoke).replaceAll("'", "''")}'::jsonb);`);
          const deadline = Date.now() + 10000; while (Date.now() < deadline) { if ((await observer.ok(`select ${firstPid}=any(pg_catalog.pg_blocking_pids(${secondPid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
          await a.ok("commit;"); secondResult = await pending; await b.ok(secondResult.code === "00000" ? "commit;" : "rollback;");
        } else {
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${secondIso};select active,revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(replacementId)};`);
          await a.ok(`begin isolation level ${firstIso};`); firstPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
          firstResult = await a.query(`select api.command_v1('${JSON.stringify(revoke).replaceAll("'", "''")}'::jsonb);`); assert.equal(firstResult.code, "00000", JSON.stringify(firstResult));
          secondPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
          const pending = b.query(cancelSql);
          const deadline = Date.now() + 10000; while (Date.now() < deadline) { if ((await observer.ok(`select ${firstPid}=any(pg_catalog.pg_blocking_pids(${secondPid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
          await a.ok("commit;"); secondResult = await pending; await b.ok(secondResult.code === "00000" ? "commit;" : "rollback;");
        }
        assert.equal(blocked, true, `missing blocker ${firstAction} ${firstIso}/${secondIso}`);
        const expectedLoserCode = "40001";
        assert.equal(secondResult.code, expectedLoserCode, JSON.stringify(secondResult));
        let retryResult = null;
        if (secondResult.code === "40001") {
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;`);
          retryResult = firstAction === "cancel" ? await b.query(`select api.command_v1('${JSON.stringify(revoke).replaceAll("'", "''")}'::jsonb);`) : await b.query(cancelSql);
          assert.equal(retryResult.code, "00000", JSON.stringify(retryResult));
        }
        if (firstAction === "revoke" && secondResult.code === "00000") retryResult = secondResult;
        const activeRevision = (await observer.ok(`select active::text||'|'||revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(replacementId)};`)).at(-1);
        assert.equal(activeRevision, "false|1", activeRevision);
        const restore = { contractVersion: 1, operationId: restoreOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${replacementId}`]: "1" }, payload: { companyId: company, profileId: replacementId, active: true, reason: "M2.2C restore after coverage race" } };
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss); const restored = await a.query(`select api.command_v1('${JSON.stringify(restore).replaceAll("'", "''")}'::jsonb);`); assert.equal(restored.code, "00000", JSON.stringify(restored));
        const final = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(replacementId)})||'|'||(select status||'|'||coalesce(cancelled_by::text,'null')||'|'||coalesce(cancel_reason,'null') from public.task_coverage_bindings where id=${lit(fixture.bindingId)})||'|'||(select state_revision from public.task_instances where id=${lit(taskId)})||'|'||(select count(*) from public.task_time_sessions where instance_id=${lit(taskId)} and ended_at is null)||'|'||(select count(*) from app_private.api_command_receipts where operation_id in (${lit(revokeOp)},${lit(restoreOp)}))||'|'||(select count(*) from app_private.company_membership_events where company_id=${lit(company)} and profile_id=${lit(replacementId)})||'|'||(select count(*) from public.task_mutation_receipts where operation_id=${lit(cancelOp)})||'|'||(select count(*) from public.audit_events where entity_id=${lit(fixture.bindingId)} and action='task.coverage_cancelled')||'|'||coalesce((select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(replacementId)}),0);`)).at(-1);
        const finalParts = final.split("|");
        assert.equal(finalParts.length, 12, final);
        assert.equal(finalParts[0] + "|" + finalParts[1], "true|2", final);
        assert.equal(finalParts[2], "cancelled", final);
        assert.equal(finalParts[3], boss, final);
        assert.equal(finalParts[4], firstAction === "cancel" ? `M2.2C explicit cancellation ${firstAction}` : `M2.2C membership revoke ${firstAction}`, final);
        assert.deepEqual(finalParts.slice(5, 11), ["1", "0", "2", "2", "1", "1"], final);
        assert(Number(finalParts[11]) >= 2, final);
        record(`M2.2C membership.setActive vs coverage.cancelBinding ${firstAction}-first (${firstIso}/${secondIso}), then restore does not resurrect`, true, { firstAction, isolationPair: `${firstIso}/${secondIso}`, blockerObserved: blocked, firstSQLSTATE: firstResult.code, secondSQLSTATE: secondResult.code, retrySQLSTATE: retryResult?.code ?? null, restoreSQLSTATE: restored.code, bindingAndAuditState: final });
        await a.ok("reset role;"); await b.ok("reset role;");
      }
      for (const [index, [firstIso, secondIso]] of [["read committed", "repeatable read"], ["repeatable read", "read committed"]].entries()) {
        await membershipCoverageRace(9840 + index * 20, "cancel", firstIso, secondIso);
        await membershipCoverageRace(9880 + index * 20, "revoke", firstIso, secondIso);
      }

      async function pendingCoverageFixture(base, label, recurring = false) {
        const ownerId = uid(base), replacementId = uid(base + 1), assignmentId = uid(base + 2), taskId = uid(base + 3), planId = uid(base + 4);
        await memberTask(ownerId, assignmentId, taskId, `${label} owner`);
        await observer.ok(`insert into auth.users(id) values(${lit(replacementId)}); insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(replacementId)},${lit(org)},${lit(label+' replacement')},'empleado','Test','Test','Test'); insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(replacementId)}); insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(replacementId)}); insert into public.task_coverage_plans(id,organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by,sealed) values(${lit(planId)},${lit(org)},${lit(ownerId)},${lit(replacementId)},${lit(scheduledOn)}::date,${lit(scheduledOn)}::date,'otra',${lit(boss)},false);`);
        let siblingTaskId = null;
        if (recurring) {
          await observer.ok(`update public.task_assignments set start_date=${lit(monthPeriod)}::date,end_date=null,interval_count=1,month_day=extract(day from ${lit(scheduledOn)}::date)::smallint where id=${lit(assignmentId)}; insert into public.task_coverage_plan_assignment_rules(plan_id,organization_id,assignment_id,company_id_snapshot,assignment_snapshot) select ${lit(planId)},a.organization_id,a.id,a.company_id,to_jsonb(a) from public.task_assignments a where a.id=${lit(assignmentId)};`);
          await claims({ role: "authenticated", sub: ownerId, aal: "aal1" }, ownerId);
          const nextPeriod = (await a.ok(`select (date_trunc('month',${lit(monthPeriod)}::date+interval '1 month'))::date;`)).at(-1);
          const materialized = await a.query(`select public.materialize_month(${lit(ownerId)},${lit(nextPeriod)}::date);`);
          assert.equal(materialized.code, "00000", JSON.stringify(materialized));
          siblingTaskId = (await observer.ok(`select id from public.task_instances where assignment_id=${lit(assignmentId)} and period=${lit(nextPeriod)}::date;`)).at(-1);
          assert.match(siblingTaskId, /^[0-9a-f-]{36}$/iu, siblingTaskId);
          const recurrenceProof = (await observer.ok(`select a.frequency||'|'||a.interval_count||'|'||(select count(*) from public.task_instances t where t.assignment_id=a.id)||'|'||(select count(*) from public.task_coverage_plan_assignment_rules r where r.plan_id=${lit(planId)} and r.assignment_id=a.id and r.assignment_snapshot=to_jsonb(a))||'|'||(select count(*) from public.task_coverage_plan_instances i where i.plan_id=${lit(planId)}) from public.task_assignments a where a.id=${lit(assignmentId)};`)).at(-1);
          assert.equal(recurrenceProof, "mensual|1|2|1|0", recurrenceProof);
        } else {
          await observer.ok(`insert into public.task_coverage_plan_instances(plan_id,organization_id,instance_id,company_id_snapshot,period_snapshot,responsibility_set_id) select ${lit(planId)},${lit(org)},${lit(taskId)},${lit(company)},${lit(monthPeriod)}::date,h.set_id from public.task_responsibility_heads h where h.instance_id=${lit(taskId)};`);
        }
        await observer.ok(`update public.task_coverage_plans set sealed=true,sealed_by=${lit(boss)},sealed_at=clock_timestamp() where id=${lit(planId)};`);
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        return { ownerId, replacementId, assignmentId, taskId, planId, siblingTaskId };
      }
      // Same-isolation approval/materialization races. The assignment exists
      // without its current-month occurrence so the winner determines whether
      // approval binds an existing occurrence or materialization binds from
      // the newly-created recurring rule.
      for (const [index, [iso, firstAction]] of [
        ["read committed", "approve"], ["read committed", "materialize"],
        ["repeatable read", "approve"], ["repeatable read", "materialize"],
      ].entries()) {
        const base = 10500 + index * 20;
        const ownerId = uid(base), replacementId = uid(base + 1), assignmentId = uid(base + 2), planId = uid(base + 3);
        const approvalOp = uid(base + 4), materializeOp = uid(base + 5);
        const approvalBoss = uid(base + 6), materializeBoss = uid(base + 7);
        await observer.ok(`insert into auth.users(id) values(${lit(ownerId)}),(${lit(replacementId)}),(${lit(approvalBoss)}),(${lit(materializeBoss)});
          insert into public.profiles(id,organization_id,name,role,sector,branch,position) values
            (${lit(ownerId)},${lit(org)},'Recurring assignment owner ${index}','empleado','Test','Test','Test'),
            (${lit(replacementId)},${lit(org)},'Synthetic replacement ${index}','empleado','Test','Test','Test'),
            (${lit(approvalBoss)},${lit(org)},'Coverage approval chief ${index}','jefe','Test','Test','Test'),
            (${lit(materializeBoss)},${lit(org)},'Materialize chief ${index}','jefe','Test','Test','Test');
          insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(ownerId)}),(${lit(org)},${lit(company)},${lit(replacementId)});
          insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(ownerId)});
          insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days,measurement_version,definition_revision)
            values(${lit(assignmentId)},${lit(org)},${lit(company)},${lit(ownerId)},${lit(team)},'M2.2C recurring coverage/materialize ${index}','resultado',1,null,null,'mensual',${lit(monthPeriod)}::date,${dayOfMonth},'[]',${lit(monthPeriod)}::date,null,1,array[1]::smallint[],${dayOfMonth},true,0,1,0);
          insert into public.task_coverage_plans(id,organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by,sealed)
            values(${lit(planId)},${lit(org)},${lit(ownerId)},${lit(replacementId)},${lit(scheduledOn)}::date,${lit(scheduledOn)}::date,'otra',${lit(approvalBoss)},false);
          insert into public.task_coverage_plan_assignment_rules(plan_id,organization_id,assignment_id,company_id_snapshot,assignment_snapshot)
            select ${lit(planId)},organization_id,id,company_id,to_jsonb(a) from public.task_assignments a where id=${lit(assignmentId)};
          update public.task_coverage_plans set sealed=true,sealed_by=${lit(approvalBoss)},sealed_at=clock_timestamp() where id=${lit(planId)};`);
        const materializeCommand = { contractVersion: 1, operationId: materializeOp, kind: "month.materialize", expectedRevisions: { [`creation:${ownerId}`]: "0" }, payload: { ownerId, period: monthPeriod } };
        const snapshotSql = `select jsonb_build_object(
          'assignment',(select to_jsonb(x) from public.task_assignments x where id=${lit(assignmentId)}),
          'occurrences',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.task_instances x where assignment_id=${lit(assignmentId)} and period=${lit(monthPeriod)}::date),
          'plan',(select to_jsonb(x) from public.task_coverage_plans x where id=${lit(planId)}),
          'rule',(select to_jsonb(x) from public.task_coverage_plan_assignment_rules x where plan_id=${lit(planId)}),
          'bindings',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.task_coverage_bindings x where plan_id=${lit(planId)} or source_rule_id in(select id from public.task_coverage_bindings where plan_id=${lit(planId)})),
          'creationHead',(select to_jsonb(x) from app_private.api_creation_heads x where organization_id=${lit(org)} and owner_id=${lit(ownerId)}),
          'monthFence',(select to_jsonb(x) from app_private.api_month_fences x where organization_id=${lit(org)} and owner_id=${lit(ownerId)} and period=${lit(monthPeriod)}::date),
          'membershipFences',(select coalesce(jsonb_agg(to_jsonb(x) order by x.profile_id),'[]'::jsonb) from app_private.api_membership_fences x where organization_id=${lit(org)} and profile_id in (${lit(ownerId)},${lit(replacementId)},${lit(approvalBoss)},${lit(materializeBoss)})),
          'approvalReceipt',(select to_jsonb(x) from public.task_mutation_receipts x where actor_id=${lit(approvalBoss)} and operation_id=${lit(approvalOp)}),
          'materializeReceipt',(select to_jsonb(x) from app_private.api_command_receipts x where actor_id=${lit(materializeBoss)} and operation_id=${lit(materializeOp)}),
          'audit',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.audit_events x where x.organization_id=${lit(org)} and x.actor_id in (${lit(approvalBoss)},${lit(materializeBoss)}) and (x.entity_id in (${lit(ownerId)},${lit(planId)}) or x.action='month.materialized')));`;
        const before = (await observer.ok(snapshotSql)).at(-1);
        const approvalSql = `select public.approve_task_coverage_plan(${lit(planId)},${lit(approvalOp)});`;
        const materializeSql = `select api.command_v1('${JSON.stringify(materializeCommand).replaceAll("'", "''")}'::jsonb);`;
        const first = firstAction === "approve" ? a : b, second = firstAction === "approve" ? b : a;
        const firstActor = firstAction === "approve" ? approvalBoss : materializeBoss;
        const secondActor = firstAction === "approve" ? materializeBoss : approvalBoss;
        const firstSql = firstAction === "approve" ? approvalSql : materializeSql;
        const secondSql = firstAction === "approve" ? materializeSql : approvalSql;
        const jwt = subject => `reset role;select set_config('request.jwt.claim.sub',${lit(subject)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: subject, aal: "aal2" }))},false);set role authenticated;`;
        await first.ok(`${jwt(firstActor)}begin isolation level ${iso};`);
        const firstPid = Number((await first.ok("select pg_backend_pid();")).at(-1));
        const firstResult = await first.query(firstSql); assert.equal(firstResult.code, "00000", JSON.stringify(firstResult));
        await second.ok(`${jwt(secondActor)}begin isolation level ${iso}; select count(*) from public.task_assignments where id=${lit(assignmentId)};`);
        const secondPid = Number((await second.ok("select pg_backend_pid();")).at(-1));
        const pending = second.query(secondSql);
        let blocked = false; const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          if ((await observer.ok(`select ${firstPid}=any(pg_catalog.pg_blocking_pids(${secondPid}));`)).at(-1) === "t") { blocked = true; break; }
          await new Promise(done => setTimeout(done, 20));
        }
        await first.ok("commit;");
        const secondResult = await pending;
        assert.equal(secondResult.code, "40001", `blocked ${firstAction === "approve" ? "materialize" : "approval"} must abort for ${iso}/${iso}: ${JSON.stringify(secondResult)}`);
        await second.ok(secondResult.code === "00000" ? "commit;" : "rollback;");
        const afterConflict = (await observer.ok(snapshotSql)).at(-1);
        const conflictState = JSON.parse(afterConflict);
        if (firstAction === "approve") {
          assert.equal(conflictState.occurrences.length, 0, `approval-first must not materialize before retry: ${afterConflict}`);
          assert.equal(conflictState.bindings.length, 1, `approval-first must leave only the coverage root before retry: ${afterConflict}`);
          assert.ok(conflictState.bindings[0].instance_id === null && conflictState.bindings[0].status === "active", afterConflict);
        } else {
          assert.equal(conflictState.occurrences.length, 1, `materialize-first must create exactly one occurrence before retry: ${afterConflict}`);
          assert.equal(conflictState.bindings.length, 0, `materialize-first must not bind coverage before approval retry: ${afterConflict}`);
        }
        const retrySession = new Session(); await retrySession.ok(jwt(secondActor));
        let retryResult;
        if (firstAction === "approve" && secondResult.code !== "00000") {
          const freshCreationRevision = (await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(ownerId)}),0);`)).at(-1);
          retryResult = await retrySession.query(`select api.command_v1('${JSON.stringify({ ...materializeCommand, expectedRevisions: { [`creation:${ownerId}`]: freshCreationRevision } }).replaceAll("'", "''")}'::jsonb);`);
        } else retryResult = await retrySession.query(firstAction === "approve" ? materializeSql : approvalSql);
        assert.equal(retryResult.code, "00000", `fresh-session retry must converge: ${JSON.stringify(retryResult)}`); await retrySession.close();
        const finalSnapshot = (await observer.ok(snapshotSql)).at(-1);
        const final = JSON.parse(finalSnapshot);
        assert.equal(final.occurrences.length, 1, JSON.stringify(final));
        assert.equal(final.bindings.length, 2, JSON.stringify(final));
        const root = final.bindings.find(x => x.instance_id === null && x.status === "active");
        const child = final.bindings.find(x => x.instance_id !== null && x.status === "active");
        assert.ok(root && child, JSON.stringify(final.bindings)); assert.equal(child.source_rule_id, root.id);
        assert.equal(final.approvalReceipt?.operation_id, approvalOp, JSON.stringify(final.approvalReceipt));
        assert.equal(final.materializeReceipt?.operation_id, materializeOp, JSON.stringify(final.materializeReceipt));
        const approvalResponseResult = firstAction === "approve" ? firstResult : retryResult;
        const materializeResponseResult = firstAction === "approve" ? retryResult : firstResult;
        const approvalResponse = Number(approvalResponseResult.lines.at(-1));
        const expectedApprovalCount = firstAction === "approve" ? 1 : 2;
        assert.equal(approvalResponse, expectedApprovalCount, `approval response must equal expected bind count: ${JSON.stringify(approvalResponseResult)}`);
        assert.equal(final.approvalReceipt.result.count, approvalResponse, `approval response/receipt count mismatch: ${JSON.stringify({ approvalResponse, receipt: final.approvalReceipt })}`);
        const materializeResponse = JSON.parse(materializeResponseResult.lines.at(-1));
        assert.equal(materializeResponse.operationId, materializeOp, JSON.stringify(materializeResponse));
        assert.equal(materializeResponse.kind, "month.materialize", JSON.stringify(materializeResponse));
        assert.deepEqual(materializeResponse, final.materializeReceipt.result, `materialization response/receipt mismatch: ${JSON.stringify({ materializeResponse, receipt: final.materializeReceipt })}`);
        assert.deepEqual(materializeResponse.result.createdTaskIds, final.occurrences.map(x => x.id), JSON.stringify({ materializeResponse, occurrences: final.occurrences }));
        assert.equal(materializeResponse.result.createdTaskIds.length, 1, JSON.stringify(materializeResponse));
        assert.equal(materializeResponse.result.creationRevision, String(final.creationHead.revision), JSON.stringify({ materializeResponse, creationHead: final.creationHead }));
        assert.equal(materializeResponse.result.ownerId, ownerId, JSON.stringify(materializeResponse));
        assert.equal(materializeResponse.result.period, monthPeriod, JSON.stringify(materializeResponse));
        assert.equal(blocked, true, `expected lock wait ${iso}/${firstAction}, pids ${firstPid}->${secondPid}`);
        record(`M2.2C recurring coverage approval versus month.materialize (${firstAction}-first; ${iso}/${iso})`, true, {
          winner: { action: firstAction, actor: firstActor, pid: firstPid, isolation: iso, sqlstate: firstResult.code },
          loser: { action: firstAction === "approve" ? "materialize" : "approve", actor: secondActor, pid: secondPid, isolation: iso, blockedByWinner: blocked, sqlstate: secondResult.code, message: secondResult.errors.trim() },
          retry: { action: firstAction === "approve" ? "materialize" : "approve", actor: secondActor, newSession: true, sqlstate: retryResult.code },
          responsesAndReceipts: {
            approval: { response: approvalResponse, expectedCount: expectedApprovalCount, receipt: final.approvalReceipt },
            materialize: { response: materializeResponse, receipt: final.materializeReceipt },
          },
          snapshots: { before: JSON.parse(before), afterConflict: conflictState, final },
          intermediateState: firstAction === "approve" ? "one active rule root; zero occurrences and zero children" : "one occurrence; zero roots and zero children",
          finalCardinality: { occurrences: final.occurrences.length, activeRoots: 1, activeChildren: 1, childSourceRuleId: child.source_rule_id },
        });
        await first.ok("reset role;"); await second.ok("reset role;");
      }
      for (const [base, firstAction, winnerIsolation, loserIsolation, recurring] of [
        [9920, "approve", "read committed", "repeatable read", false],
        [9930, "revoke", "read committed", "repeatable read", false],
        [9940, "approve", "repeatable read", "read committed", false],
        [9950, "revoke", "repeatable read", "read committed", false],
        [10100, "approve", "read committed", "repeatable read", true],
        [10110, "revoke", "read committed", "repeatable read", true],
        [10120, "approve", "repeatable read", "read committed", true],
        [10130, "revoke", "repeatable read", "read committed", true],
        [10140, "approve", "read committed", "read committed", true],
        [10150, "revoke", "read committed", "read committed", true],
        [10160, "approve", "repeatable read", "repeatable read", true],
        [10170, "revoke", "repeatable read", "repeatable read", true],
      ]) {
        const fixture = await pendingCoverageFixture(base, `M2.2C membership/coverage approval ${firstAction}`, recurring), approvalOp = uid(base + 5), revokeOp = uid(base + 6);
        const secondBoss = recurring && winnerIsolation === loserIsolation ? uid(base + 7) : boss;
        if (secondBoss !== boss) await observer.ok(`insert into auth.users(id) values(${lit(secondBoss)}); insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(secondBoss)},${lit(org)},'Independent coverage jefe','jefe','Test','Test','Test'); insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(secondBoss)});`);
        const snapshotSql = `select jsonb_build_object(
          'membership',(select to_jsonb(m) from public.company_memberships m where m.company_id=${lit(company)} and m.profile_id=${lit(fixture.replacementId)}),
          'sessions',(select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) from public.task_time_sessions s where s.instance_id in (${lit(fixture.taskId)},${lit(fixture.siblingTaskId ?? fixture.taskId)})),
          'assignments',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.task_assignments a where a.id=${lit(fixture.assignmentId)}),
          'tasks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.task_instances t where t.assignment_id=${lit(fixture.assignmentId)}),
          'heads',(select coalesce(jsonb_agg(to_jsonb(h) order by h.instance_id),'[]'::jsonb) from public.task_responsibility_heads h where h.instance_id in (${lit(fixture.taskId)},${lit(fixture.siblingTaskId ?? fixture.taskId)})),
          'sets',(select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) from public.task_responsibility_sets s where s.id in(select h.set_id from public.task_responsibility_heads h where h.instance_id in (${lit(fixture.taskId)},${lit(fixture.siblingTaskId ?? fixture.taskId)}))),
          'plan',(select to_jsonb(p) from public.task_coverage_plans p where p.id=${lit(fixture.planId)}),
          'rules',(select coalesce(jsonb_agg(to_jsonb(r) order by r.assignment_id),'[]'::jsonb) from public.task_coverage_plan_assignment_rules r where r.plan_id=${lit(fixture.planId)}),
          'planInstances',(select coalesce(jsonb_agg(to_jsonb(i) order by i.instance_id),'[]'::jsonb) from public.task_coverage_plan_instances i where i.plan_id=${lit(fixture.planId)}),
          'bindings',(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]'::jsonb) from public.task_coverage_bindings b where b.plan_id=${lit(fixture.planId)} or b.source_rule_id in(select id from public.task_coverage_bindings where plan_id=${lit(fixture.planId)})),
          'graphs',(select coalesce(jsonb_agg(to_jsonb(g) order by g.company_id,g.period),'[]'::jsonb) from app_private.task_dependency_graphs g where g.organization_id=${lit(org)} and g.company_id=${lit(company)} and g.period=${lit(monthPeriod)}::date),
          'fences',(select coalesce(jsonb_agg(to_jsonb(f) order by f.profile_id),'[]'::jsonb) from app_private.api_membership_fences f where f.organization_id=${lit(org)} and f.profile_id in (${lit(fixture.ownerId)},${lit(fixture.replacementId)},${lit(boss)},${lit(secondBoss)})),
          'approvalReceipt',(select to_jsonb(r) from public.task_mutation_receipts r where r.operation_id=${lit(approvalOp)}),
          'revokeReceipt',(select to_jsonb(r) from app_private.api_command_receipts r where r.operation_id=${lit(revokeOp)}),
          'membershipEvents',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) from app_private.company_membership_events e where e.company_id=${lit(company)} and e.profile_id=${lit(fixture.replacementId)}),
          'audit',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) from public.audit_events e where e.organization_id=${lit(org)} and (e.entity_id=${lit(fixture.planId)} or e.entity_id=${lit(fixture.replacementId)} or (e.entity_id=${lit(company)} and e.details->>'profileId'=${lit(fixture.replacementId)}))));`;
        const preConflictSnapshot = (await observer.ok(snapshotSql)).at(-1);
        const retryInNewSession = async (subject, sql) => {
          const session = new Session();
          await session.ok(`select set_config('request.jwt.claim.sub',${lit(subject)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: subject, aal: "aal2" }))},false);set role authenticated;`);
          const result = await session.query(sql);
          await session.close();
          return result;
        };
        const revoke = { contractVersion: 1, operationId: revokeOp, kind: "companyMembership.setActive", expectedRevisions: { [`membership:${company}:${fixture.replacementId}`]: "0" }, payload: { companyId: company, profileId: fixture.replacementId, active: false, reason: `M2.2C approval race revoke ${firstAction}` } };
        const membershipFenceBefore = Number((await observer.ok(`select coalesce((select fence_epoch from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(fixture.replacementId)}),0);`)).at(-1));
        await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
        let approvalResult, revokeResult, blocked = false, winnerPid, loserPid, retryResult, winnerIsolationObserved, loserIsolationObserved, conflictSnapshot;
        if (firstAction === "approve") {
          await a.ok(`begin isolation level ${winnerIsolation};`); winnerIsolationObserved = (await a.ok("show transaction_isolation;")).at(-1); winnerPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
          assert.equal(winnerIsolationObserved, winnerIsolation);
          approvalResult = await a.query(`select public.approve_task_coverage_plan(${lit(fixture.planId)},${lit(approvalOp)});`); assert.equal(approvalResult.code, "00000", JSON.stringify(approvalResult));
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(secondBoss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: secondBoss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${loserIsolation};select active,revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(fixture.replacementId)};`);
          loserIsolationObserved = (await b.ok("show transaction_isolation;")).at(-1); assert.equal(loserIsolationObserved, loserIsolation);
          loserPid = Number((await b.ok("select pg_backend_pid();")).at(-1)); const pending = b.query(`select api.command_v1('${JSON.stringify(revoke).replaceAll("'", "''")}'::jsonb);`);
          const deadline = Date.now() + 10000; while (Date.now() < deadline) { if ((await observer.ok(`select ${winnerPid}=any(pg_catalog.pg_blocking_pids(${loserPid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
          await a.ok("commit;"); revokeResult = await pending; await b.ok(revokeResult.code === "00000" ? "commit;" : "rollback;"); assert.equal(revokeResult.code, "40001", JSON.stringify(revokeResult)); conflictSnapshot = (await observer.ok(snapshotSql)).at(-1);
          retryResult = await retryInNewSession(secondBoss, `select api.command_v1('${JSON.stringify(revoke).replaceAll("'", "''")}'::jsonb);`); assert.equal(retryResult.code, "00000", JSON.stringify(retryResult));
        } else {
          await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(secondBoss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: secondBoss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${loserIsolation};select active,revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(fixture.replacementId)};`);
          loserIsolationObserved = (await b.ok("show transaction_isolation;")).at(-1); assert.equal(loserIsolationObserved, loserIsolation);
          await a.ok(`begin isolation level ${winnerIsolation};`); winnerIsolationObserved = (await a.ok("show transaction_isolation;")).at(-1); assert.equal(winnerIsolationObserved, winnerIsolation); winnerPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
          revokeResult = await a.query(`select api.command_v1('${JSON.stringify(revoke).replaceAll("'", "''")}'::jsonb);`); assert.equal(revokeResult.code, "00000", JSON.stringify(revokeResult));
          loserPid = Number((await b.ok("select pg_backend_pid();")).at(-1)); const pending = b.query(`select public.approve_task_coverage_plan(${lit(fixture.planId)},${lit(approvalOp)});`);
          const deadline = Date.now() + 10000; while (Date.now() < deadline) { if ((await observer.ok(`select ${winnerPid}=any(pg_catalog.pg_blocking_pids(${loserPid}));`)).at(-1) === "t") { blocked = true; break; } await new Promise((done) => setTimeout(done, 20)); }
          await a.ok("commit;"); approvalResult = await pending; await b.ok(approvalResult.code === "00000" ? "commit;" : "rollback;"); assert.equal(approvalResult.code, "40001", JSON.stringify(approvalResult)); conflictSnapshot = (await observer.ok(snapshotSql)).at(-1);
          const fenceStateBeforeRetry = (await observer.ok(`select
            coalesce((select string_agg(profile_id::text||':'||fence_epoch::text,',' order by profile_id) from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id in (${lit(fixture.ownerId)},${lit(fixture.replacementId)},${lit(boss)},${lit(secondBoss)})),'')||'|'||
            coalesce((select string_agg(company_id::text||':'||period::text||':'||fence_epoch::text,',' order by company_id,period) from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period=${lit(monthPeriod)}::date),'');`)).at(-1);
          retryResult = await retryInNewSession(secondBoss, `select public.approve_task_coverage_plan(${lit(fixture.planId)},${lit(approvalOp)});`);
          assert.equal(retryResult.code, "42501", JSON.stringify(retryResult));
          assert.match(retryResult.errors, /Membres[ií]a de empresa inactiva/u, JSON.stringify(retryResult));
          const fenceStateAfterRetry = (await observer.ok(`select
            coalesce((select string_agg(profile_id::text||':'||fence_epoch::text,',' order by profile_id) from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id in (${lit(fixture.ownerId)},${lit(fixture.replacementId)},${lit(boss)},${lit(secondBoss)})),'')||'|'||
            coalesce((select string_agg(company_id::text||':'||period::text||':'||fence_epoch::text,',' order by company_id,period) from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period=${lit(monthPeriod)}::date),'');`)).at(-1);
          assert.equal(fenceStateAfterRetry, fenceStateBeforeRetry, "denied coverage retry must not leave fence writes");
        }
        assert.equal(blocked, true);
        const final = (await observer.ok(`select (select active::text||'|'||revision from public.company_memberships where company_id=${lit(company)} and profile_id=${lit(fixture.replacementId)})||chr(31)||(select coalesce(string_agg(status||':'||coalesce(cancelled_by::text,'null')||':'||coalesce(cancel_reason,'null'),',' order by id),'none') from public.task_coverage_bindings where instance_id=${lit(fixture.taskId)})||chr(31)||(select coalesce(string_agg(status||':'||coalesce(cancelled_by::text,'null')||':'||coalesce(cancel_reason,'null'),',' order by id),'none') from public.task_coverage_bindings where plan_id=${lit(fixture.planId)} and assignment_id=${lit(fixture.assignmentId)} and instance_id is null)||chr(31)||(select count(*) from public.task_coverage_bindings child join public.task_coverage_bindings root on child.source_rule_id=root.id where root.plan_id=${lit(fixture.planId)} and root.assignment_id=${lit(fixture.assignmentId)} and root.instance_id is null and child.instance_id=${lit(fixture.taskId)})||chr(31)||(select count(*) from public.task_mutation_receipts where operation_id=${lit(approvalOp)})||chr(31)||(select count(*) from app_private.api_command_receipts where operation_id=${lit(revokeOp)})||chr(31)||(select count(*) from app_private.company_membership_events where company_id=${lit(company)} and profile_id=${lit(fixture.replacementId)})||chr(31)||(select count(*) from public.audit_events where action='companyMembership.setActive' and details->>'profileId'=${lit(fixture.replacementId)})||chr(31)||(select count(*) from public.task_coverage_bindings where instance_id=${lit(fixture.siblingTaskId ?? fixture.taskId)})||chr(31)||coalesce((select fence_epoch::text from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(fixture.replacementId)}),'0');`)).at(-1);
        const expectedSiblingBindings = recurring ? "0" : (firstAction === "approve" ? "1" : "0");
        const finalParts = final.split("\u001f");
        assert.equal(finalParts.length, 10, JSON.stringify(finalParts));
        const expectedFenceDelta = firstAction === "approve" ? 2 : 1;
        assert.equal(Number(finalParts[9]) - membershipFenceBefore, expectedFenceDelta, `membership fence delta for ${firstAction}-first: expected ${expectedFenceDelta}, observed ${membershipFenceBefore} -> ${finalParts[9]}`);
        assert.equal(finalParts[0], "false|1", final);
        if (firstAction === "approve") assert.match(finalParts[1], /^cancelled:[0-9a-f-]{36}:M2\.2C approval race revoke approve$/u, final);
        else assert.equal(finalParts[1], "none", final);
        if (recurring && firstAction === "approve") assert.equal(finalParts[2], `cancelled:${secondBoss}:M2.2C approval race revoke approve`, final);
        else assert.equal(finalParts[2], "none", final);
        assert.equal(finalParts[3], recurring && firstAction === "approve" ? "1" : "0", `rule-to-occurrence source_rule_id link count: ${final}`);
        assert.deepEqual(finalParts.slice(4, 9), [firstAction === "approve" ? "1" : "0", "1", "1", "1", expectedSiblingBindings], final);
        const finalSnapshot = (await observer.ok(snapshotSql)).at(-1);
        assert.notEqual(conflictSnapshot, preConflictSnapshot, "winner commit must change the relevant snapshot");
        if (firstAction === "approve") assert.notEqual(finalSnapshot, conflictSnapshot, "successful fresh retry must change the relevant snapshot");
        else assert.equal(finalSnapshot, conflictSnapshot, "denied fresh retry must leave the conflict snapshot unchanged");
        const newSameIsolationCase = recurring && winnerIsolation === loserIsolation;
        const approvalActor = firstAction === "approve" ? boss : secondBoss;
        const revocationActor = firstAction === "approve" ? secondBoss : boss;
        let bothBossesActiveAndCompanyAuthorized = null;
        if (newSameIsolationCase) {
          assert.notEqual(approvalActor, revocationActor, "same-isolation recurrent sessions must use distinct jefes");
          bothBossesActiveAndCompanyAuthorized = (await observer.ok(`select count(*)=2 from public.profiles p join public.company_memberships m on m.profile_id=p.id and m.organization_id=p.organization_id where p.id in (${lit(approvalActor)},${lit(revocationActor)}) and p.organization_id=${lit(org)} and p.role='jefe' and p.active and m.company_id=${lit(company)} and m.active;`)).at(-1) === "t";
          assert.equal(bothBossesActiveAndCompanyAuthorized, true, "both jefes must be active in this organization and company");
          if (firstAction === "approve") {
            assert.equal(approvalResult.code, "00000", "approval winner was authorized");
            assert.equal(retryResult.code, "00000", "revocation retry by the other jefe was authorized");
          } else {
            assert.equal(revokeResult.code, "00000", "revocation winner was authorized");
            assert.equal(approvalResult.code, "40001", "stale approval reached coordination revalidation");
            assert.equal(retryResult.code, "42501", "fresh approval denial follows the membership revocation");
            assert.match(retryResult.errors, /Membres[ií]a de empresa inactiva/u, JSON.stringify(retryResult));
          }
        }
        record(`M2.2C membership revocation versus ${recurring ? "recurring-rule " : ""}coverage approve/reassignment (${firstAction}-first; ${winnerIsolation}/${loserIsolation})`, true, { recurring, recurrenceRuleAndOccurrenceCount: recurring ? "mensual|1|2; exact assignment snapshot; rule selected, no per-instance selection; child source_rule_id linked to root" : null, actors: { approvalActor, revocationActor, distinct: approvalActor !== revocationActor, bothBossesActiveAndCompanyAuthorized }, isolationPair: `${winnerIsolation}/${loserIsolation}`, actualIsolationLevels: { winner: winnerIsolationObserved, loser: loserIsolationObserved }, blockerObserved: blocked, approvalSQLSTATE: approvalResult.code, revokeSQLSTATE: revokeResult.code, retryActor: firstAction === "approve" ? revocationActor : approvalActor, retrySQLSTATE: retryResult.code, retryConnectionWasNew: true, retryError: retryResult.errors.trim(), retryFenceStateUnchanged: firstAction === "revoke" ? true : null, membershipFenceEpoch: `${membershipFenceBefore}->${finalParts[9]}`, snapshots: { before: JSON.parse(preConflictSnapshot), afterConflictBeforeRetry: JSON.parse(conflictSnapshot), afterFreshRetry: JSON.parse(finalSnapshot) }, finalState: final });
        await a.ok("reset role;"); await b.ok("reset role;");
      }
    }
    if (flags["--m2-2b-smoke"]) {
      const bAssignmentA = uid(200), bAssignmentB = uid(201), bTaskA = uid(202), bTaskB = uid(203);
      await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
        values(${lit(bAssignmentA)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'M2.2B synthetic A','resultado',1,null,null,'mensual','2026-10-01',15,'[]'),
              (${lit(bAssignmentB)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'M2.2B synthetic B','resultado',1,null,null,'mensual','2026-10-01',15,'[]');
        insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
        values(${lit(bTaskA)},${lit(org)},${lit(bAssignmentA)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01','2026-10-01','M2.2B synthetic A','resultado',1,null,null,null,'[]','Pendiente'),
              (${lit(bTaskB)},${lit(org)},${lit(bAssignmentB)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01','2026-10-01','M2.2B synthetic B','resultado',1,null,null,null,'[]','Pendiente');`);
      const availableAssignment = uid(286), availableTask = uid(287);
      await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
        values(${lit(availableAssignment)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'M2.2B future availability','resultado',1,null,null,'mensual','2026-11-01',15,'[]');
        insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
        values(${lit(availableTask)},${lit(org)},${lit(availableAssignment)},${lit(company)},${lit(actor)},${lit(team)},'2026-11-01','2026-11-01','M2.2B future availability','resultado',1,null,null,null,'[]','Pendiente');
        insert into app_private.task_tracking(instance_id,organization_id,available_from) values(${lit(availableTask)},${lit(org)},'2026-11-01');`);
      const availableTimer = await a.query(`select public.start_task_timer(${lit(availableTask)},1,${lit(uid(288))},false);`);
      const availableTransition = await a.query(`select public.transition_task(${lit(availableTask)},'En curso');`);
      assert.equal(availableTimer.code, "42501", JSON.stringify(availableTimer));
      assert.equal(availableTransition.code, "42501", JSON.stringify(availableTransition));
      const availableState = (await observer.ok(`select status||'|'||state_revision||'|'||(select count(*) from public.task_time_sessions where instance_id=${lit(availableTask)}) from public.task_instances where id=${lit(availableTask)};`)).at(-1);
      assert.equal(availableState, "Pendiente|0|0");
      record("M2.2B-R4 legacy timer and transition enforce available_from executor protection", true, { availableTimerSQLSTATE: availableTimer.code, availableTransitionSQLSTATE: availableTransition.code, state: availableState });
      const manager = uid(68), managerOperation = uid(293);
      const managerCommercialCommand = { contractVersion: 1, operationId: managerOperation, kind: "task.commercialMode", expectedRevisions: { [`task:${bTaskA}`]: "0" }, payload: { taskId: bTaskA, enabled: true } };
      await observer.ok(`insert into app_private.api_command_receipts(actor_id,operation_id,organization_id,kind,arguments,result)
        values(${lit(manager)},${lit(managerOperation)},${lit(org)},'task.commercialMode','${JSON.stringify(managerCommercialCommand)}'::jsonb,'{"contractVersion":1,"operationId":"${managerOperation}","kind":"task.commercialMode","result":{"taskId":"${bTaskA}","taskRevision":"1","enabled":true,"throughDay":0}}'::jsonb);`);
      await claims({ role: "authenticated", sub: manager, aal: "aal2" }, manager);
      const managerModeError = await a.query(`select api.command_v1('${JSON.stringify(managerCommercialCommand).replaceAll("'", "''")}'::jsonb);`);
      const managerModeReceiptError = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "commandReceipt", filters: { operationId: managerOperation }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(managerModeError.code, "42501", JSON.stringify(managerModeError));
      assert.equal(managerModeReceiptError.code, "42501", JSON.stringify(managerModeReceiptError));
      record("M2.2B-R3 commercialMode command, exact replay, and receipt are jefe-only", true, { commandAndReplaySQLSTATE: managerModeError.code, receiptSQLSTATE: managerModeReceiptError.code });
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const graphKey = `graph:${company}:2026-10-01`;
      const enableCommercial = { contractVersion: 1, operationId: uid(204), kind: "task.commercialMode", expectedRevisions: { [`task:${bTaskA}`]: "0" }, payload: { taskId: bTaskA, enabled: true } };
      const enabled = await a.query(`select api.command_v1('${JSON.stringify(enableCommercial).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(enabled.code, "00000", JSON.stringify(enabled));
      await claims({ role: "authenticated", sub: actor, aal: "aal1" });
      const progress = { contractVersion: 1, operationId: uid(205), kind: "task.commercialProgress", expectedRevisions: { [`task:${bTaskA}`]: "1" }, payload: { taskId: bTaskA, throughDay: 30 } };
      const progressed = await a.query(`select api.command_v1('${JSON.stringify(progress).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(progressed.code, "00000", JSON.stringify(progressed));
      await a.ok(`select public.start_task_timer(${lit(bTaskA)},2,${lit(uid(209))},false);`);
      const unconfirmed = { contractVersion: 1, operationId: uid(206), kind: "task.transition", expectedRevisions: { [`task:${bTaskA}`]: "3" }, payload: { taskId: bTaskA, status: "Completada", reason: null, confirmCommercialCompletion: false } };
      const unconfirmedResult = await a.query(`select api.command_v1('${JSON.stringify(unconfirmed).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(unconfirmedResult.code, "55000", JSON.stringify(unconfirmedResult));
      const transitionFenceBefore = (await observer.ok(`select fence_epoch from app_private.api_month_fences where owner_id=${lit(actor)} and period='2026-10-01';`)).at(-1);
      const confirmation = { ...unconfirmed, operationId: uid(207), payload: { ...unconfirmed.payload, confirmCommercialCompletion: true } };
      const completed = await a.query(`select api.command_v1('${JSON.stringify(confirmation).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(completed.code, "00000", JSON.stringify(completed));
      const transitionFenceAfter = (await observer.ok(`select fence_epoch from app_private.api_month_fences where owner_id=${lit(actor)} and period='2026-10-01';`)).at(-1);
      assert.equal(BigInt(transitionFenceAfter) - BigInt(transitionFenceBefore), 1n, "API transition core must touch its month fence once");
      record("M2.2B API task.transition central core touches its month fence exactly once", true, { before: transitionFenceBefore, after: transitionFenceAfter, delta: "1" });
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const dependencies = { contractVersion: 1, operationId: uid(208), kind: "task.dependencies", expectedRevisions: { [`task:${bTaskB}`]: "0", [graphKey]: "0" }, payload: { taskId: bTaskB, prerequisiteIds: [bTaskA], availableFrom: null } };
      const graphUpdate = await a.query(`select api.command_v1('${JSON.stringify(dependencies).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(graphUpdate.code, "00000", JSON.stringify(graphUpdate));
      await claims({ role: "authenticated", sub: actor, aal: "aal1" });
      const ready = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "readiness", filters: { taskId: bTaskB }, cursor: null, limit: 1 })}'::jsonb);`);
      assert.equal(ready.code, "00000", JSON.stringify(ready));
      assert.equal(JSON.parse(ready.lines.at(-1)).data.ready, true);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const completedTaskRevision = (await observer.ok(`select state_revision from public.task_instances where id=${lit(bTaskA)};`)).at(-1);
      const graphBeforeCompletedEdit = (await observer.ok(`select config_revision from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period='2026-10-01';`)).at(-1);
      const completedDependencyEdit = { contractVersion: 1, operationId: uid(239), kind: "task.dependencies", expectedRevisions: { [`task:${bTaskA}`]: completedTaskRevision, [graphKey]: graphBeforeCompletedEdit }, payload: { taskId: bTaskA, prerequisiteIds: [], availableFrom: null } };
      const completedDependencyResult = await a.query(`select api.command_v1('${JSON.stringify(completedDependencyEdit).replaceAll("'", "''")}'::jsonb);`);
      const completedDependencyState = (await observer.ok(`select (select state_revision from public.task_instances where id=${lit(bTaskA)})||'|'||(select config_revision from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period='2026-10-01');`)).at(-1);
      assert.equal(completedDependencyResult.code, "55000", JSON.stringify(completedDependencyResult));
      assert.equal(completedDependencyState, `${completedTaskRevision}|${graphBeforeCompletedEdit}`);
      record("M2.2B native commercial completion, readiness and completed-task graph fence", true, { commercialTask: bTaskA, dependentTask: bTaskB, completionSQLSTATE: completed.code, graphRevision: JSON.parse(graphUpdate.lines.at(-1)).result.graphRevision, completedDependencySQLSTATE: completedDependencyResult.code, stateUnchanged: completedDependencyState });
      await claims({ role: "authenticated", sub: actor, aal: "aal1" });
      const privateReason = "Privado: seguimiento de reapertura nativa";
      const reopenCommand = { contractVersion: 1, operationId: uid(292), kind: "task.transition", expectedRevisions: { [`task:${bTaskA}`]: completedTaskRevision }, payload: { taskId: bTaskA, status: "Pendiente", reason: privateReason, confirmCommercialCompletion: false } };
      const reopenResult = await a.query(`select api.command_v1('${JSON.stringify(reopenCommand).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(reopenResult.code, "00000", JSON.stringify(reopenResult));
      const reasonPrivacy = await observer.query(`select exists(select 1 from public.audit_events where details::text like '%${privateReason}%')||'|'||exists(select 1 from public.task_reopen_events where instance_id=${lit(bTaskA)} and reason='${privateReason}');`);
      assert.equal(reasonPrivacy.lines.at(-1), "false|true");
      record("M2.2B reopen reason remains in authorized history and is omitted from audit details", true, { commandSQLSTATE: reopenResult.code, auditContainsReason: false, historyContainsReason: true });
      const xorEmpty = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "rateHistory", filters: { companyId: company, templateId: null, taskId: null }, cursor: null, limit: 10 })}'::jsonb);`);
      const xorBoth = await a.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "rateHistory", filters: { companyId: company, templateId: uid(23), taskId: bTaskA }, cursor: null, limit: 10 })}'::jsonb);`);
      assert.equal(xorEmpty.code, "22023", JSON.stringify(xorEmpty));
      assert.equal(xorBoth.code, "22023", JSON.stringify(xorBoth));
      record("M2.2B-R8 rateHistory preserves XOR scope validation", true, { neitherScopeSQLSTATE: xorEmpty.code, bothScopesSQLSTATE: xorBoth.code });
      await a.ok("reset role;");

      const bAssignmentC = uid(210), bAssignmentD = uid(211), bTaskC = uid(212), bTaskD = uid(213);
      await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
        values(${lit(bAssignmentC)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'M2.2B race C','resultado',1,null,null,'mensual','2026-10-01',15,'[]'),
              (${lit(bAssignmentD)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'M2.2B race D','resultado',1,null,null,'mensual','2026-10-01',15,'[]');
        insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
        values(${lit(bTaskC)},${lit(org)},${lit(bAssignmentC)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01','2026-10-01','M2.2B race C','resultado',1,null,null,null,'[]','Pendiente'),
              (${lit(bTaskD)},${lit(org)},${lit(bAssignmentD)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01','2026-10-01','M2.2B race D','resultado',1,null,null,null,'[]','Pendiente');`);
      const firstIsolation = m2aFirstIsolation, secondIsolation = m2aSecondIsolation;
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      await a.ok(`begin isolation level ${firstIsolation};`);
      const graphEditPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const graphEdit = { contractVersion: 1, operationId: uid(214), kind: "task.dependencies", expectedRevisions: { [`task:${bTaskD}`]: "0", [graphKey]: "1" }, payload: { taskId: bTaskD, prerequisiteIds: [bTaskC], availableFrom: null } };
      const graphEditResult = await a.query(`select api.command_v1('${JSON.stringify(graphEdit).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(graphEditResult.code, "00000", JSON.stringify(graphEditResult));
      await claims({ role: "authenticated", sub: actor, aal: "aal1" });
      await b.ok(`begin isolation level ${secondIsolation};`);
      const timerPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const waitingTimer = b.query(`select public.start_task_timer(${lit(bTaskD)},1,${lit(uid(215))},false);`);
      let graphTimerBlocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await observer.ok(`select ${graphEditPid}=any(pg_blocking_pids(${timerPid}));`)).at(-1) === "t") { graphTimerBlocked = true; break; }
        await new Promise((done) => setTimeout(done, 20));
      }
      await a.ok("commit;");
      const timerAfterGraph = await waitingTimer;
      if (timerAfterGraph.code !== "00000") await b.ok("rollback;"); else await b.ok("commit;");
      let timerRetry = timerAfterGraph;
      if (timerAfterGraph.code === "40001") {
        await b.ok(`begin isolation level ${secondIsolation};`);
        timerRetry = await b.query(`select public.start_task_timer(${lit(bTaskD)},1,${lit(uid(215))},false);`);
        await b.ok("rollback;");
      }
      const graphTimerState = (await observer.ok(`select (select count(*) from public.task_time_sessions where instance_id=${lit(bTaskD)} and ended_at is null)||'|'||(select state_revision from public.task_instances where id=${lit(bTaskD)})||'|'||(select config_revision from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period='2026-10-01');`)).at(-1);
      assert.equal(graphTimerBlocked, true, `task timer did not wait for graph edit (${firstIsolation}/${secondIsolation})`);
      assert.ok(["40001", "55000"].includes(timerAfterGraph.code), JSON.stringify(timerAfterGraph));
      assert.equal(timerRetry.code, "55000", JSON.stringify(timerRetry));
      assert.equal(graphTimerState, "0|1|2");
      record("M2.2B dependency edit fences concurrent legacy timer", graphTimerBlocked && ["40001", "55000"].includes(timerAfterGraph.code) && timerRetry.code === "55000" && graphTimerState === "0|1|2", { isolationPair: `${firstIsolation}/${secondIsolation}`, blocked: graphTimerBlocked, graphSQLSTATE: graphEditResult.code, timerSQLSTATE: timerAfterGraph.code, timerRetrySQLSTATE: timerRetry.code, finalState: graphTimerState });
      await a.ok("reset role;");
       await b.ok("reset role;");

       const bAssignmentH = uid(234), bTaskH = uid(235);
       await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
         values(${lit(bAssignmentH)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'M2.2B timer-first H','resultado',1,null,null,'mensual','2026-10-01',15,'[]');
         insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
         values(${lit(bTaskH)},${lit(org)},${lit(bAssignmentH)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01','2026-10-01','M2.2B timer-first H','resultado',1,null,null,null,'[]','Pendiente');`);
       await claims({ role: "authenticated", sub: actor, aal: "aal1" });
       await a.ok(`begin isolation level ${firstIsolation};`);
       const timerFirstPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
       const timerFirst = await a.query(`select public.start_task_timer(${lit(bTaskH)},0,${lit(uid(236))},false);`);
       assert.equal(timerFirst.code, "00000", JSON.stringify(timerFirst));
       const timerSessionH = timerFirst.lines.at(-1);
       await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
       const graphAfterTimerPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
       const graphAfterTimer = { contractVersion: 1, operationId: uid(237), kind: "task.dependencies", expectedRevisions: { [`task:${bTaskH}`]: "0", [graphKey]: "2" }, payload: { taskId: bTaskH, prerequisiteIds: [bTaskC], availableFrom: null } };
       const graphAfterTimerPending = b.query(`select api.command_v1('${JSON.stringify(graphAfterTimer).replaceAll("'", "''")}'::jsonb);`);
       let timerGraphBlocked = false;
       for (let attempt = 0; attempt < 100; attempt++) {
         if ((await observer.ok(`select ${timerFirstPid}=any(pg_blocking_pids(${graphAfterTimerPid}));`)).at(-1) === "t") { timerGraphBlocked = true; break; }
         await new Promise((done) => setTimeout(done, 20));
       }
       await a.ok("commit;");
       let graphAfterTimerResult = await graphAfterTimerPending;
       if (graphAfterTimerResult.code !== "00000") await b.ok("rollback;"); else await b.ok("commit;");
       let graphAfterTimerRetry = graphAfterTimerResult;
       if (graphAfterTimerResult.code === "40001") {
         await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
         graphAfterTimerRetry = await b.query(`select api.command_v1('${JSON.stringify({ ...graphAfterTimer, expectedRevisions: { [`task:${bTaskH}`]: "1", [graphKey]: "2" } }).replaceAll("'", "''")}'::jsonb);`);
         if (graphAfterTimerRetry.code === "00000") await b.ok("commit;"); else await b.ok("rollback;");
       }
       const timerGraphState = (await observer.ok(`select (select count(*) from public.task_time_sessions where instance_id=${lit(bTaskH)} and ended_at is null)||'|'||(select state_revision from public.task_instances where id=${lit(bTaskH)})||'|'||(select config_revision from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period='2026-10-01')||'|'||(select count(*) from app_private.task_dependencies where instance_id=${lit(bTaskH)});`)).at(-1);
       assert.equal(timerGraphBlocked, true);
       assert.ok(["40001", "55000"].includes(graphAfterTimerResult.code), JSON.stringify(graphAfterTimerResult));
       assert.ok(["00000", "55000"].includes(graphAfterTimerRetry.code), JSON.stringify(graphAfterTimerRetry));
       assert.ok(["1|1|2|0", "1|2|3|1"].includes(timerGraphState), timerGraphState);
       record("M2.2B legacy timer fences reverse dependency edit ordering", true, { isolationPair: `${firstIsolation}/${secondIsolation}`, blocked: timerGraphBlocked, timerSQLSTATE: timerFirst.code, graphSQLSTATE: graphAfterTimerResult.code, graphRetrySQLSTATE: graphAfterTimerRetry.code, sessionId: timerSessionH, finalState: timerGraphState });
       await claims({ role: "authenticated", sub: actor, aal: "aal1" });
       await a.ok(`select public.pause_task_timer(${lit(timerSessionH)},${lit(uid(238))}); reset role;`);
       await b.ok("reset role;");

      const peer = uid(216);
      const bAssignmentE = uid(219), bTaskE = uid(220);
      await observer.ok(`insert into auth.users(id) values(${lit(peer)});
        insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(peer)},${lit(org)},'Synthetic peer','empleado','Test','Test','Test');
        insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(peer)});
        insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(peer)});
        insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
          values(${lit(bAssignmentE)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'M2.2B joint race E','resultado',1,null,null,'unica','2026-10-01',15,'[]');
        insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
          values(${lit(bTaskE)},${lit(org)},${lit(bAssignmentE)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01','2026-10-01','M2.2B joint race E','resultado',1,null,null,null,'[]','Pendiente');`);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      await a.ok(`begin isolation level ${firstIsolation};`);
      const configurationPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const configureRace = { contractVersion: 1, operationId: uid(221), kind: "task.commercialMode", expectedRevisions: { [`task:${bTaskE}`]: "0" }, payload: { taskId: bTaskE, enabled: true } };
      const configureRaceResult = await a.query(`select api.command_v1('${JSON.stringify(configureRace).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(configureRaceResult.code, "00000", JSON.stringify(configureRaceResult));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
      const assignmentPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const jointMembers = JSON.stringify([{ profileId: actor, shareBps: 5000 }, { profileId: peer, shareBps: 5000 }]).replaceAll("'", "''");
      const jointAfterConfig = b.query(`select public.assign_task_responsibility(${lit(bTaskE)},'${jointMembers}'::jsonb,'M2.2B race',1,${lit(uid(222))});`);
      let configJointBlocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await observer.ok(`select ${configurationPid}=any(pg_blocking_pids(${assignmentPid}));`)).at(-1) === "t") { configJointBlocked = true; break; }
        await new Promise((done) => setTimeout(done, 20));
      }
      await a.ok("commit;");
      const jointAfterConfigResult = await jointAfterConfig;
      await b.ok("rollback;");
      let jointRetry = jointAfterConfigResult;
      if (jointAfterConfigResult.code === "40001") {
        await b.ok(`begin isolation level ${secondIsolation};`);
        jointRetry = await b.query(`select public.assign_task_responsibility(${lit(bTaskE)},'${jointMembers}'::jsonb,'M2.2B race',1,${lit(uid(222))});`);
        await b.ok("rollback;");
      }
      const configJointState = (await observer.ok(`select (select commercial_enabled::text from app_private.task_tracking where instance_id=${lit(bTaskE)})||'|'||(select revision from public.task_responsibility_heads h join public.task_responsibility_sets s on s.id=h.set_id where h.instance_id=${lit(bTaskE)})||'|'||(select state_revision from public.task_instances where id=${lit(bTaskE)});`)).at(-1);
      assert.equal(configJointBlocked, true);
      assert.ok(["40001", "55000"].includes(jointAfterConfigResult.code), JSON.stringify(jointAfterConfigResult));
      assert.equal(jointRetry.code, "55000", JSON.stringify(jointRetry));
      assert.equal(configJointState, "true|1|1");
      record("M2.2B commercial configuration fences concurrent legacy joint assignment", true, { isolationPair: `${firstIsolation}/${secondIsolation}`, blocked: configJointBlocked, configurationSQLSTATE: configureRaceResult.code, jointSQLSTATE: jointAfterConfigResult.code, retrySQLSTATE: jointRetry.code, finalState: configJointState });
      await a.ok("reset role;");
      await b.ok("reset role;");

      const bAssignmentF = uid(230), bTaskF = uid(231);
      await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
        values(${lit(bAssignmentF)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'M2.2B joint-first race F','resultado',1,null,null,'unica','2026-10-01',15,'[]');
        insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
        values(${lit(bTaskF)},${lit(org)},${lit(bAssignmentF)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01','2026-10-01','M2.2B joint-first race F','resultado',1,null,null,null,'[]','Pendiente');`);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      await a.ok(`begin isolation level ${firstIsolation};`);
      const jointFirstPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const jointFirst = await a.query(`select public.assign_task_responsibility(${lit(bTaskF)},'${jointMembers}'::jsonb,'M2.2B joint first',1,${lit(uid(232))});`);
      assert.equal(jointFirst.code, "00000", JSON.stringify(jointFirst));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
      const modePid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const modeAfterJoint = { contractVersion: 1, operationId: uid(233), kind: "task.commercialMode", expectedRevisions: { [`task:${bTaskF}`]: "0" }, payload: { taskId: bTaskF, enabled: true } };
      const modePending = b.query(`select api.command_v1('${JSON.stringify(modeAfterJoint).replaceAll("'", "''")}'::jsonb);`);
      let jointModeBlocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await observer.ok(`select ${jointFirstPid}=any(pg_blocking_pids(${modePid}));`)).at(-1) === "t") { jointModeBlocked = true; break; }
        await new Promise((done) => setTimeout(done, 20));
      }
      await a.ok("commit;");
      const modeAfterJointResult = await modePending;
      if (modeAfterJointResult.code !== "00000") await b.ok("rollback;"); else await b.ok("commit;");
      let modeAfterJointRetry = modeAfterJointResult;
      if (modeAfterJointResult.code === "40001") {
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
        modeAfterJointRetry = await b.query(`select api.command_v1('${JSON.stringify({ ...modeAfterJoint, expectedRevisions: { [`task:${bTaskF}`]: "1" } }).replaceAll("'", "''")}'::jsonb);`);
        await b.ok("rollback;");
      }
      const jointModeState = (await observer.ok(`select (select mode from public.task_responsibility_sets s join public.task_responsibility_heads h on h.set_id=s.id where h.instance_id=${lit(bTaskF)})||'|'||coalesce((select commercial_enabled::text from app_private.task_tracking where instance_id=${lit(bTaskF)}),'false')||'|'||(select state_revision from public.task_instances where id=${lit(bTaskF)});`)).at(-1);
      assert.equal(jointModeBlocked, true);
      assert.ok(["40001", "55000"].includes(modeAfterJointResult.code), JSON.stringify(modeAfterJointResult));
      assert.equal(modeAfterJointRetry.code, "55000", JSON.stringify(modeAfterJointRetry));
      assert.equal(jointModeState, "conjunta|false|1");
      record("M2.2B legacy joint assignment fences concurrent commercial configuration", true, { isolationPair: `${firstIsolation}/${secondIsolation}`, blocked: jointModeBlocked, jointSQLSTATE: jointFirst.code, configurationSQLSTATE: modeAfterJointResult.code, retrySQLSTATE: modeAfterJointRetry.code, finalState: jointModeState });
      await a.ok("reset role;");
      await b.ok("reset role;");

      const replayDisable = { contractVersion: 1, operationId: uid(223), kind: "task.commercialMode", expectedRevisions: { [`task:${bTaskE}`]: "1" }, payload: { taskId: bTaskE, enabled: false } };
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      await a.ok(`begin isolation level ${firstIsolation};`);
      const replayPidA = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const replayFirst = await a.query(`select api.command_v1('${JSON.stringify(replayDisable).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(replayFirst.code, "00000", JSON.stringify(replayFirst));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
      const replayPidB = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const replayPending = b.query(`select api.command_v1('${JSON.stringify(replayDisable).replaceAll("'", "''")}'::jsonb);`);
      let replayBBlocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await observer.ok(`select ${replayPidA}=any(pg_blocking_pids(${replayPidB}));`)).at(-1) === "t") { replayBBlocked = true; break; }
        await new Promise((done) => setTimeout(done, 20));
      }
      await a.ok("commit;");
      let replaySecond = await replayPending;
      if (replaySecond.code !== "00000") await b.ok("rollback;"); else await b.ok("commit;");
      let replayRetry = replaySecond;
      if (replaySecond.code === "40001") {
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
        replayRetry = await b.query(`select api.command_v1('${JSON.stringify(replayDisable).replaceAll("'", "''")}'::jsonb);`);
        await b.ok("commit;");
      }
      const replayFinal = (await observer.ok(`select (select count(*) from app_private.api_command_receipts where actor_id=${lit(boss)} and operation_id=${lit(uid(223))})||'|'||(select count(*) from app_private.task_tracking_events where instance_id=${lit(bTaskE)} and kind='commercial_mode')||'|'||(select state_revision from public.task_instances where id=${lit(bTaskE)})||'|'||(select commercial_enabled::text from app_private.task_tracking where instance_id=${lit(bTaskE)});`)).at(-1);
      assert.equal(replayBBlocked, true);
      assert.ok(["00000", "40001"].includes(replaySecond.code), JSON.stringify(replaySecond));
      assert.equal(replayRetry.code, "00000", JSON.stringify(replayRetry));
      assert.equal(replayFirst.lines.at(-1), replayRetry.lines.at(-1));
      assert.equal(replayFinal, "1|2|2|false");
      record("M2.2B concurrent exact commercial replay serializes without duplicate events", true, { isolationPair: `${firstIsolation}/${secondIsolation}`, blocked: replayBBlocked, firstSQLSTATE: replayFirst.code, replaySQLSTATE: replaySecond.code, retrySQLSTATE: replayRetry.code, finalState: replayFinal });
      await a.ok("reset role;");
      await b.ok("reset role;");

      const bAssignmentG = uid(224), bTaskG = uid(225);
      await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
        values(${lit(bAssignmentG)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'M2.2B day30 race','resultado',1,null,null,'mensual','2026-10-01',15,'[]');
        insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
        values(${lit(bTaskG)},${lit(org)},${lit(bAssignmentG)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01','2026-10-01','M2.2B day30 race','resultado',1,null,null,null,'[]','Pendiente');`);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const enableG = { contractVersion: 1, operationId: uid(226), kind: "task.commercialMode", expectedRevisions: { [`task:${bTaskG}`]: "0" }, payload: { taskId: bTaskG, enabled: true } };
      assert.equal((await a.query(`select api.command_v1('${JSON.stringify(enableG).replaceAll("'", "''")}'::jsonb);`)).code, "00000");
      await claims({ role: "authenticated", sub: actor, aal: "aal1" });
      await a.ok(`select public.start_task_timer(${lit(bTaskG)},1,${lit(uid(227))},false);`);
      await a.ok(`begin isolation level ${firstIsolation};`);
      const day30Pid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const day30 = { contractVersion: 1, operationId: uid(228), kind: "task.commercialProgress", expectedRevisions: { [`task:${bTaskG}`]: "2" }, payload: { taskId: bTaskG, throughDay: 30 } };
      const day30Result = await a.query(`select api.command_v1('${JSON.stringify(day30).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(day30Result.code, "00000", JSON.stringify(day30Result));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
      const completionPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const completeG = { contractVersion: 1, operationId: uid(229), kind: "task.transition", expectedRevisions: { [`task:${bTaskG}`]: "2" }, payload: { taskId: bTaskG, status: "Completada", reason: null, confirmCommercialCompletion: true } };
      const completionPending = b.query(`select api.command_v1('${JSON.stringify(completeG).replaceAll("'", "''")}'::jsonb);`);
      let completionBlocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await observer.ok(`select ${day30Pid}=any(pg_blocking_pids(${completionPid}));`)).at(-1) === "t") { completionBlocked = true; break; }
        await new Promise((done) => setTimeout(done, 20));
      }
      await a.ok("commit;");
      let completionRace = await completionPending;
      if (completionRace.code !== "00000") await b.ok("rollback;"); else await b.ok("commit;");
      let completionRetry = completionRace;
      if (completionRace.code === "40001") {
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
        completionRetry = await b.query(`select api.command_v1('${JSON.stringify({ ...completeG, expectedRevisions: { [`task:${bTaskG}`]: "3" } }).replaceAll("'", "''")}'::jsonb);`);
        await b.ok("commit;");
      }
      const day30Final = (await observer.ok(`select (select through_day from app_private.task_tracking where instance_id=${lit(bTaskG)})||'|'||(select status from public.task_instances where id=${lit(bTaskG)})||'|'||(select count(*) from app_private.task_completion_events where instance_id=${lit(bTaskG)})||'|'||(select count(*) from public.task_time_sessions where instance_id=${lit(bTaskG)} and ended_at is null);`)).at(-1);
      assert.equal(completionBlocked, true);
      assert.ok(["40001", "55000"].includes(completionRace.code), JSON.stringify(completionRace));
      assert.equal(completionRetry.code, "00000", JSON.stringify(completionRetry));
      assert.equal(day30Final, "30|Completada|1|0");
      record("M2.2B day30 progress fences concurrent completion and produces one completion event", true, { isolationPair: `${firstIsolation}/${secondIsolation}`, blocked: completionBlocked, day30SQLSTATE: day30Result.code, completionSQLSTATE: completionRace.code, retrySQLSTATE: completionRetry.code, finalState: day30Final });
      await a.ok("reset role;");
      await b.ok("reset role;");

      const bOwnerClose = uid(240), bAssignmentClose = uid(241), bTaskClose = uid(242);
      await observer.ok(`insert into auth.users(id) values(${lit(bOwnerClose)});
        insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(bOwnerClose)},${lit(org)},'M2.2B close owner','empleado','Test','Test','Test');
        insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(bOwnerClose)});
        insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(bOwnerClose)});
        insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
          values(${lit(bAssignmentClose)},${lit(org)},${lit(company)},${lit(bOwnerClose)},${lit(team)},'M2.2B close fence','resultado',1,null,null,'mensual','2026-10-01',15,'[]');
        insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
          values(${lit(bTaskClose)},${lit(org)},${lit(bAssignmentClose)},${lit(company)},${lit(bOwnerClose)},${lit(team)},'2026-10-01','2026-10-01','M2.2B close fence','resultado',1,null,null,null,'[]','Pendiente');`);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      await a.ok(`begin isolation level ${firstIsolation};`);
      const bCloseCommandPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const closeEnable = { contractVersion: 1, operationId: uid(243), kind: "task.commercialMode", expectedRevisions: { [`task:${bTaskClose}`]: "0" }, payload: { taskId: bTaskClose, enabled: true } };
      const closeEnableResult = await a.query(`select api.command_v1('${JSON.stringify(closeEnable).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(closeEnableResult.code, "00000", JSON.stringify(closeEnableResult));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
      const bLegacyClosePid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const legacyClosePending = b.query(`select public.close_employee_month(${lit(bOwnerClose)},'2026-10-01','M2.2B legacy close race');`);
      let bLegacyCloseBlocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await observer.ok(`select ${bCloseCommandPid}=any(pg_blocking_pids(${bLegacyClosePid}));`)).at(-1) === "t") { bLegacyCloseBlocked = true; break; }
        await new Promise((done) => setTimeout(done, 20));
      }
      await a.ok("commit;");
      let bLegacyCloseResult = await legacyClosePending;
      if (bLegacyCloseResult.code !== "00000") await b.ok("rollback;"); else await b.ok("commit;");
      let bLegacyCloseRetry = bLegacyCloseResult;
      if (bLegacyCloseResult.code === "40001") {
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
        bLegacyCloseRetry = await b.query(`select public.close_employee_month(${lit(bOwnerClose)},'2026-10-01','M2.2B legacy close race');`);
        await b.ok(bLegacyCloseRetry.code === "00000" ? "commit;" : "rollback;");
      }
      assert.equal(bLegacyCloseBlocked, true);
      assert.ok(["00000", "40001"].includes(bLegacyCloseResult.code), JSON.stringify(bLegacyCloseResult));
      assert.equal(bLegacyCloseRetry.code, "00000", JSON.stringify(bLegacyCloseRetry));
      record("M2.2B API commercial configuration fences legacy monthly close", true, { isolationPair: `${firstIsolation}/${secondIsolation}`, blocked: bLegacyCloseBlocked, commandSQLSTATE: closeEnableResult.code, closeSQLSTATE: bLegacyCloseResult.code, retrySQLSTATE: bLegacyCloseRetry.code });
      await a.ok("reset role;");
      await b.ok("reset role;");

      const bAssignmentRevoke = uid(244), bTaskRevoke = uid(245);
      await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
        values(${lit(bAssignmentRevoke)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'M2.2B revocation fence','resultado',1,null,null,'mensual','2026-10-01',15,'[]');
        insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
          values(${lit(bTaskRevoke)},${lit(org)},${lit(bAssignmentRevoke)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01','2026-10-01','M2.2B revocation fence','resultado',1,null,null,null,'[]','Pendiente');`);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const revokeEnable = { contractVersion: 1, operationId: uid(246), kind: "task.commercialMode", expectedRevisions: { [`task:${bTaskRevoke}`]: "0" }, payload: { taskId: bTaskRevoke, enabled: true } };
      assert.equal((await a.query(`select api.command_v1('${JSON.stringify(revokeEnable).replaceAll("'", "''")}'::jsonb);`)).code, "00000");
      const actorRevision = (await observer.ok(`select state_revision from public.task_instances where id=${lit(bTaskRevoke)};`)).at(-1);
      const actorRevokeCommand = { contractVersion: 1, operationId: uid(247), kind: "task.commercialProgress", expectedRevisions: { [`task:${bTaskRevoke}`]: actorRevision }, payload: { taskId: bTaskRevoke, throughDay: 1 } };
      await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level ${firstIsolation};`);
      const actorCommandPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const actorRevokeResult = await a.query(`select api.command_v1('${JSON.stringify(actorRevokeCommand).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(actorRevokeResult.code, "00000", JSON.stringify(actorRevokeResult));
      await b.ok(`reset role;begin isolation level ${secondIsolation};`);
      const actorRevokerPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const actorRevocationPending = b.query(`update public.profiles set active=false where id=${lit(actor)};`);
      let actorRevocationBlocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await observer.ok(`select ${actorCommandPid}=any(pg_blocking_pids(${actorRevokerPid}));`)).at(-1) === "t") { actorRevocationBlocked = true; break; }
        await new Promise((done) => setTimeout(done, 20));
      }
      await a.ok("commit;");
      const actorRevocationResult = await actorRevocationPending;
      await b.ok("commit;");
      const actorReplayDenied = await a.query(`select api.command_v1('${JSON.stringify(actorRevokeCommand).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(actorRevocationResult.code, "00000", JSON.stringify(actorRevocationResult));
      assert.equal(actorReplayDenied.code, "42501", JSON.stringify(actorReplayDenied));
      assert.equal(actorRevocationBlocked, true);
      await observer.ok(`update public.profiles set active=true where id=${lit(actor)};`);
      record("M2.2B actor revocation waits for commercial progress and denies exact replay", true, { isolationPair: `${firstIsolation}/${secondIsolation}`, blocked: actorRevocationBlocked, commandSQLSTATE: actorRevokeResult.code, revokeSQLSTATE: actorRevocationResult.code, replaySQLSTATE: actorReplayDenied.code });

      const bOwnerCoverage = uid(249), bAssignmentCoverage = uid(250), bTaskCoverage = uid(251), bPlanCoverage = uid(252);
      await observer.ok(`insert into auth.users(id) values(${lit(bOwnerCoverage)});
        insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(bOwnerCoverage)},${lit(org)},'M2.2B coverage owner','empleado','Test','Test','Test');
        insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(bOwnerCoverage)});
        insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(bOwnerCoverage)});
        insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
          values(${lit(bAssignmentCoverage)},${lit(org)},${lit(company)},${lit(bOwnerCoverage)},${lit(team)},'M2.2B coverage revocation','resultado',1,null,null,'mensual','2026-10-01',15,'[]');
        insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
          values(${lit(bTaskCoverage)},${lit(org)},${lit(bAssignmentCoverage)},${lit(company)},${lit(bOwnerCoverage)},${lit(team)},'2026-10-01','2026-10-01','M2.2B coverage revocation','resultado',1,null,null,null,'[]','Pendiente');
        insert into public.task_coverage_plans(id,organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by,sealed,sealed_by,sealed_at)
          values(${lit(bPlanCoverage)},${lit(org)},${lit(bOwnerCoverage)},${lit(peer)},'2026-10-01','2026-10-31','licencia',${lit(boss)},false,null,null);
        insert into public.task_coverage_plan_instances(plan_id,organization_id,instance_id,company_id_snapshot,period_snapshot,responsibility_set_id)
          select ${lit(bPlanCoverage)},${lit(org)},${lit(bTaskCoverage)},${lit(company)},'2026-10-01',h.set_id from public.task_responsibility_heads h where h.instance_id=${lit(bTaskCoverage)};
        update public.task_coverage_plans set sealed=true,sealed_by=${lit(boss)},sealed_at=clock_timestamp() where id=${lit(bPlanCoverage)};`);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      await a.ok(`select public.approve_task_coverage_plan(${lit(bPlanCoverage)},${lit(uid(253))});`);
      const coverageEnableRevision = (await observer.ok(`select state_revision from public.task_instances where id=${lit(bTaskCoverage)};`)).at(-1);
      const coverageEnableCommand = { contractVersion: 1, operationId: uid(254), kind: "task.commercialMode", expectedRevisions: { [`task:${bTaskCoverage}`]: coverageEnableRevision }, payload: { taskId: bTaskCoverage, enabled: true } };
      assert.equal((await a.query(`select api.command_v1('${JSON.stringify(coverageEnableCommand).replaceAll("'", "''")}'::jsonb);`)).code, "00000");
      const membershipRevision = (await observer.ok(`select state_revision from public.task_instances where id=${lit(bTaskCoverage)};`)).at(-1);
      const membershipRevokeCommand = { contractVersion: 1, operationId: uid(255), kind: "task.commercialProgress", expectedRevisions: { [`task:${bTaskCoverage}`]: membershipRevision }, payload: { taskId: bTaskCoverage, throughDay: 1 } };
      await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(peer)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: peer, aal: "aal1" }))},false);set role authenticated;begin isolation level ${firstIsolation};`);
      const membershipCommandPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const membershipCommandResult = await a.query(`select api.command_v1('${JSON.stringify(membershipRevokeCommand).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(membershipCommandResult.code, "00000", JSON.stringify(membershipCommandResult));
      await b.ok(`reset role;begin isolation level ${secondIsolation};`);
      const membershipRevokerPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const membershipLockPending = b.query(`select public._coordination_lock_keys(1102,array[${lit(peer)}]);`);
      let membershipRevocationBlocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await observer.ok(`select ${membershipCommandPid}=any(pg_blocking_pids(${membershipRevokerPid}));`)).at(-1) === "t") { membershipRevocationBlocked = true; break; }
        await new Promise((done) => setTimeout(done, 20));
      }
      await a.ok("commit;");
      await membershipLockPending;
      const membershipRevocationPending = b.query(`delete from public.company_memberships where organization_id=${lit(org)} and company_id=${lit(company)} and profile_id=${lit(peer)};`);
      const membershipRevokeResult = await membershipRevocationPending;
      await b.ok("commit;");
      await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(peer)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: peer, aal: "aal1" }))},false);set role authenticated;`);
      const membershipReplayDenied = await a.query(`select api.command_v1('${JSON.stringify(membershipRevokeCommand).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(membershipRevokeResult.code, "00000", JSON.stringify(membershipRevokeResult));
      assert.equal(membershipReplayDenied.code, "42501", JSON.stringify(membershipReplayDenied));
      assert.equal(membershipRevocationBlocked, true);
      await observer.ok(`insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(peer)}) on conflict do nothing;`);
      record("M2.2B covered executor membership revocation waits for progress and denies exact replay", true, { isolationPair: `${firstIsolation}/${secondIsolation}`, blocked: membershipRevocationBlocked, commandSQLSTATE: membershipRevokeResult.code, replaySQLSTATE: membershipReplayDenied.code });

      const bindingCoverage = (await observer.ok(`select id from public.task_coverage_bindings where instance_id=${lit(bTaskCoverage)} and replacement_id=${lit(peer)} and status='active' order by id limit 1;`)).at(-1);
      const coverageRevision = (await observer.ok(`select state_revision from public.task_instances where id=${lit(bTaskCoverage)};`)).at(-1);
      const coverageRevokeCommand = { contractVersion: 1, operationId: uid(256), kind: "task.commercialProgress", expectedRevisions: { [`task:${bTaskCoverage}`]: coverageRevision }, payload: { taskId: bTaskCoverage, throughDay: 2 } };
      await a.ok(`begin isolation level ${firstIsolation};`);
      const coverageCommandPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const coverageCommandResult = await a.query(`select api.command_v1('${JSON.stringify(coverageRevokeCommand).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(coverageCommandResult.code, "00000", JSON.stringify(coverageCommandResult));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
      const coverageRevokerPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const coverageRevocationPending = b.query(`select public.cancel_task_coverage_binding(${lit(bindingCoverage)},'M2.2B coverage revocation race',${lit(uid(257))});`);
      let coverageRevocationBlocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await observer.ok(`select ${coverageCommandPid}=any(pg_blocking_pids(${coverageRevokerPid}));`)).at(-1) === "t") { coverageRevocationBlocked = true; break; }
        await new Promise((done) => setTimeout(done, 20));
      }
      await a.ok("commit;");
      const coverageRevocationResult = await coverageRevocationPending;
      await b.ok(coverageRevocationResult.code === "00000" ? "commit;" : "rollback;");
      let coverageRevocationRetry = coverageRevocationResult;
      if (coverageRevocationResult.code === "40001") {
        await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
        coverageRevocationRetry = await b.query(`select public.cancel_task_coverage_binding(${lit(bindingCoverage)},'M2.2B coverage revocation race',${lit(uid(257))});`);
        await b.ok(coverageRevocationRetry.code === "00000" ? "commit;" : "rollback;");
      }
      await a.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(peer)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: peer, aal: "aal1" }))},false);set role authenticated;`);
      const coverageReplayDenied = await a.query(`select api.command_v1('${JSON.stringify(coverageRevokeCommand).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(coverageRevocationBlocked, true);
      assert.ok(["00000", "40001"].includes(coverageRevocationResult.code), JSON.stringify(coverageRevocationResult));
      assert.equal(coverageRevocationRetry.code, "00000", JSON.stringify(coverageRevocationRetry));
      assert.equal(coverageReplayDenied.code, "42501", JSON.stringify(coverageReplayDenied));
      record("M2.2B coverage revocation waits for covered progress and denies exact replay", true, { isolationPair: `${firstIsolation}/${secondIsolation}`, blocked: coverageRevocationBlocked, commandSQLSTATE: coverageCommandResult.code, revokeSQLSTATE: coverageRevocationResult.code, retrySQLSTATE: coverageRevocationRetry.code, replaySQLSTATE: coverageReplayDenied.code });

      const bAssignmentGraphFirst = uid(258), bTaskGraphFirst = uid(259), bAssignmentCompleteFirst = uid(260), bTaskCompleteFirst = uid(261);
      await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
        values(${lit(bAssignmentGraphFirst)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'M2.2B dependency before completion','resultado',1,null,null,'mensual','2026-10-01',15,'[]'),
              (${lit(bAssignmentCompleteFirst)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'M2.2B completion before dependency','resultado',1,null,null,'mensual','2026-10-01',15,'[]');
        insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
          values(${lit(bTaskGraphFirst)},${lit(org)},${lit(bAssignmentGraphFirst)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01','2026-10-01','M2.2B dependency before completion','resultado',1,null,null,null,'[]','En curso'),
                (${lit(bTaskCompleteFirst)},${lit(org)},${lit(bAssignmentCompleteFirst)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01','2026-10-01','M2.2B completion before dependency','resultado',1,null,null,null,'[]','En curso');`);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      await a.ok(`begin isolation level ${firstIsolation};`);
      const graphFirstPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const graphFirstRevision = (await observer.ok(`select config_revision from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period='2026-10-01';`)).at(-1);
      const graphFirstCommand = { contractVersion: 1, operationId: uid(262), kind: "task.dependencies", expectedRevisions: { [`task:${bTaskGraphFirst}`]: "0", [graphKey]: graphFirstRevision }, payload: { taskId: bTaskGraphFirst, prerequisiteIds: [bTaskC], availableFrom: null } };
      const graphFirstResult = await a.query(`select api.command_v1('${JSON.stringify(graphFirstCommand).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(graphFirstResult.code, "00000", JSON.stringify(graphFirstResult));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
      const completionAfterGraphPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const completeAfterGraph = { contractVersion: 1, operationId: uid(263), kind: "task.transition", expectedRevisions: { [`task:${bTaskGraphFirst}`]: "0" }, payload: { taskId: bTaskGraphFirst, status: "Completada", reason: null, confirmCommercialCompletion: false } };
      const completionAfterGraphPending = b.query(`select api.command_v1('${JSON.stringify(completeAfterGraph).replaceAll("'", "''")}'::jsonb);`);
      let graphBeforeCompleteBlocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await observer.ok(`select ${graphFirstPid}=any(pg_blocking_pids(${completionAfterGraphPid}));`)).at(-1) === "t") { graphBeforeCompleteBlocked = true; break; }
        await new Promise((done) => setTimeout(done, 20));
      }
      await a.ok("commit;");
      const completionAfterGraphResult = await completionAfterGraphPending;
      await b.ok("rollback;");
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
      const completionAfterGraphRetry = await b.query(`select api.command_v1('${JSON.stringify({ ...completeAfterGraph, expectedRevisions: { [`task:${bTaskGraphFirst}`]: "1" } }).replaceAll("'", "''")}'::jsonb);`);
      await b.ok("rollback;");
      assert.equal(graphBeforeCompleteBlocked, true);
      assert.equal(completionAfterGraphResult.code, "40001", JSON.stringify(completionAfterGraphResult));
      assert.equal(completionAfterGraphRetry.code, "55000", JSON.stringify(completionAfterGraphRetry));
      record("M2.2B dependency edit fences concurrent task completion", true, { isolationPair: `${firstIsolation}/${secondIsolation}`, blocked: graphBeforeCompleteBlocked, dependencySQLSTATE: graphFirstResult.code, completionSQLSTATE: completionAfterGraphResult.code, retrySQLSTATE: completionAfterGraphRetry.code });
      await a.ok("reset role;");
      await b.ok("reset role;");

      await claims({ role: "authenticated", sub: actor, aal: "aal1" });
      await a.ok(`begin isolation level ${firstIsolation};`);
      const completedFirstPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const completeBeforeGraph = { contractVersion: 1, operationId: uid(264), kind: "task.transition", expectedRevisions: { [`task:${bTaskCompleteFirst}`]: "0" }, payload: { taskId: bTaskCompleteFirst, status: "Completada", reason: null, confirmCommercialCompletion: false } };
      const completedFirstResult = await a.query(`select api.command_v1('${JSON.stringify(completeBeforeGraph).replaceAll("'", "''")}'::jsonb);`);
      assert.equal(completedFirstResult.code, "00000", JSON.stringify(completedFirstResult));
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
      const graphAfterCompletePid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const graphAfterCompleteRevision = (await observer.ok(`select config_revision from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period='2026-10-01';`)).at(-1);
      const graphAfterComplete = { contractVersion: 1, operationId: uid(265), kind: "task.dependencies", expectedRevisions: { [`task:${bTaskCompleteFirst}`]: "0", [graphKey]: graphAfterCompleteRevision }, payload: { taskId: bTaskCompleteFirst, prerequisiteIds: [bTaskC], availableFrom: null } };
      const graphAfterCompletePending = b.query(`select api.command_v1('${JSON.stringify(graphAfterComplete).replaceAll("'", "''")}'::jsonb);`);
      let completionBeforeGraphBlocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await observer.ok(`select ${completedFirstPid}=any(pg_blocking_pids(${graphAfterCompletePid}));`)).at(-1) === "t") { completionBeforeGraphBlocked = true; break; }
        await new Promise((done) => setTimeout(done, 20));
      }
      await a.ok("commit;");
      const graphAfterCompleteResult = await graphAfterCompletePending;
      await b.ok("rollback;");
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(boss)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: boss, aal: "aal2" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
      const graphAfterCompleteRetry = await b.query(`select api.command_v1('${JSON.stringify({ ...graphAfterComplete, expectedRevisions: { [`task:${bTaskCompleteFirst}`]: "1", [graphKey]: graphAfterCompleteRevision } }).replaceAll("'", "''")}'::jsonb);`);
      await b.ok("rollback;");
      assert.equal(completionBeforeGraphBlocked, true);
      assert.equal(graphAfterCompleteResult.code, "40001", JSON.stringify(graphAfterCompleteResult));
      assert.equal(graphAfterCompleteRetry.code, "55000", JSON.stringify(graphAfterCompleteRetry));
      record("M2.2B completion fences reverse dependency edit", true, { isolationPair: `${firstIsolation}/${secondIsolation}`, blocked: completionBeforeGraphBlocked, completionSQLSTATE: completedFirstResult.code, dependencySQLSTATE: graphAfterCompleteResult.code, retrySQLSTATE: graphAfterCompleteRetry.code });
      await a.ok("reset role;");
      await b.ok("reset role;");

      const bAssignmentPred1 = uid(266), bTaskPred1 = uid(267), bAssignmentSucc1 = uid(268), bTaskSucc1 = uid(269), bAssignmentPred2 = uid(270), bTaskPred2 = uid(271), bAssignmentSucc2 = uid(272), bTaskSucc2 = uid(273);
      await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
        values(${lit(bAssignmentPred1)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'M2.2B predecessor reopen','resultado',1,null,null,'mensual','2026-10-01',15,'[]'),
              (${lit(bAssignmentSucc1)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'M2.2B successor after reopen','resultado',1,null,null,'mensual','2026-10-01',15,'[]'),
              (${lit(bAssignmentPred2)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'M2.2B predecessor completion','resultado',1,null,null,'mensual','2026-10-01',15,'[]'),
              (${lit(bAssignmentSucc2)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'M2.2B successor completion','resultado',1,null,null,'mensual','2026-10-01',15,'[]');
        insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
          values(${lit(bTaskPred1)},${lit(org)},${lit(bAssignmentPred1)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01','2026-10-01','M2.2B predecessor reopen','resultado',1,null,null,null,'[]','En curso'),
                (${lit(bTaskSucc1)},${lit(org)},${lit(bAssignmentSucc1)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01','2026-10-01','M2.2B successor after reopen','resultado',1,null,null,null,'[]','En curso'),
                (${lit(bTaskPred2)},${lit(org)},${lit(bAssignmentPred2)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01','2026-10-01','M2.2B predecessor completion','resultado',1,null,null,null,'[]','En curso'),
                (${lit(bTaskSucc2)},${lit(org)},${lit(bAssignmentSucc2)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01','2026-10-01','M2.2B successor completion','resultado',1,null,null,null,'[]','En curso');`);
      await claims({ role: "authenticated", sub: boss, aal: "aal2" }, boss);
      const predGraphRev = (await observer.ok(`select config_revision from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period='2026-10-01';`)).at(-1);
      const predDeps1 = { contractVersion: 1, operationId: uid(274), kind: "task.dependencies", expectedRevisions: { [`task:${bTaskSucc1}`]: "0", [graphKey]: predGraphRev }, payload: { taskId: bTaskSucc1, prerequisiteIds: [bTaskPred1], availableFrom: null } };
      assert.equal((await a.query(`select api.command_v1('${JSON.stringify(predDeps1).replaceAll("'", "''")}'::jsonb);`)).code, "00000");
      const predGraphRev2 = (await observer.ok(`select config_revision from app_private.task_dependency_graphs where organization_id=${lit(org)} and company_id=${lit(company)} and period='2026-10-01';`)).at(-1);
      const predDeps2 = { contractVersion: 1, operationId: uid(275), kind: "task.dependencies", expectedRevisions: { [`task:${bTaskSucc2}`]: "0", [graphKey]: predGraphRev2 }, payload: { taskId: bTaskSucc2, prerequisiteIds: [bTaskPred2], availableFrom: null } };
      assert.equal((await a.query(`select api.command_v1('${JSON.stringify(predDeps2).replaceAll("'", "''")}'::jsonb);`)).code, "00000");
      await claims({ role: "authenticated", sub: actor, aal: "aal1" });
      const completePred1 = { contractVersion: 1, operationId: uid(276), kind: "task.transition", expectedRevisions: { [`task:${bTaskPred1}`]: "0" }, payload: { taskId: bTaskPred1, status: "Completada", reason: null, confirmCommercialCompletion: false } };
      assert.equal((await a.query(`select api.command_v1('${JSON.stringify(completePred1).replaceAll("'", "''")}'::jsonb);`)).code, "00000");
      await a.ok(`begin isolation level ${firstIsolation};`);
      const reopenPredPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const reopenPred = { contractVersion: 1, operationId: uid(277), kind: "task.transition", expectedRevisions: { [`task:${bTaskPred1}`]: "1" }, payload: { taskId: bTaskPred1, status: "En curso", reason: "Reapertura para corrección", confirmCommercialCompletion: false } };
      assert.equal((await a.query(`select api.command_v1('${JSON.stringify(reopenPred).replaceAll("'", "''")}'::jsonb);`)).code, "00000");
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
      const finishSuccPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const finishSuccAfterReopen = { contractVersion: 1, operationId: uid(278), kind: "task.transition", expectedRevisions: { [`task:${bTaskSucc1}`]: "1" }, payload: { taskId: bTaskSucc1, status: "Completada", reason: null, confirmCommercialCompletion: false } };
      const finishSuccPending = b.query(`select api.command_v1('${JSON.stringify(finishSuccAfterReopen).replaceAll("'", "''")}'::jsonb);`);
      let reopenSuccessorBlocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await observer.ok(`select ${reopenPredPid}=any(pg_blocking_pids(${finishSuccPid}));`)).at(-1) === "t") { reopenSuccessorBlocked = true; break; }
        await new Promise((done) => setTimeout(done, 20));
      }
      await a.ok("commit;");
      const finishSuccResult = await finishSuccPending;
      await b.ok("rollback;");
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
      const finishSuccRetry = await b.query(`select api.command_v1('${JSON.stringify(finishSuccAfterReopen).replaceAll("'", "''")}'::jsonb);`);
      await b.ok("rollback;");
      assert.equal(reopenSuccessorBlocked, true);
      assert.ok(["40001", "55000"].includes(finishSuccResult.code), JSON.stringify(finishSuccResult));
      assert.equal(finishSuccRetry.code, "55000", JSON.stringify(finishSuccRetry));
      record("M2.2B predecessor reopen fences concurrent successor completion", true, { isolationPair: `${firstIsolation}/${secondIsolation}`, blocked: reopenSuccessorBlocked, reopenSQLSTATE: "00000", successorSQLSTATE: finishSuccResult.code, retrySQLSTATE: finishSuccRetry.code });
      await a.ok("reset role;");
      await b.ok("reset role;");

      await claims({ role: "authenticated", sub: actor, aal: "aal1" });
      await a.ok(`begin isolation level ${firstIsolation};`);
      const completePredPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
      const completePred2 = { contractVersion: 1, operationId: uid(279), kind: "task.transition", expectedRevisions: { [`task:${bTaskPred2}`]: "0" }, payload: { taskId: bTaskPred2, status: "Completada", reason: null, confirmCommercialCompletion: false } };
      assert.equal((await a.query(`select api.command_v1('${JSON.stringify(completePred2).replaceAll("'", "''")}'::jsonb);`)).code, "00000");
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
      const completeSuccPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
      const completeSucc2 = { contractVersion: 1, operationId: uid(280), kind: "task.transition", expectedRevisions: { [`task:${bTaskSucc2}`]: "1" }, payload: { taskId: bTaskSucc2, status: "Completada", reason: null, confirmCommercialCompletion: false } };
      const completeSuccPending = b.query(`select api.command_v1('${JSON.stringify(completeSucc2).replaceAll("'", "''")}'::jsonb);`);
      let predecessorSuccessorBlocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await observer.ok(`select ${completePredPid}=any(pg_blocking_pids(${completeSuccPid}));`)).at(-1) === "t") { predecessorSuccessorBlocked = true; break; }
        await new Promise((done) => setTimeout(done, 20));
      }
      await a.ok("commit;");
      const completeSuccResult = await completeSuccPending;
      await b.ok("rollback;");
      await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: actor, aal: "aal1" }))},false);set role authenticated;begin isolation level ${secondIsolation};`);
      const completeSuccRetry = await b.query(`select api.command_v1('${JSON.stringify(completeSucc2).replaceAll("'", "''")}'::jsonb);`);
      await b.ok("commit;");
      assert.equal(predecessorSuccessorBlocked, true);
      assert.ok(["00000", "40001", "55000"].includes(completeSuccResult.code), JSON.stringify(completeSuccResult));
      assert.equal(completeSuccRetry.code, "00000", JSON.stringify(completeSuccRetry));
      record("M2.2B predecessor completion fences successor completion and retry", true, { isolationPair: `${firstIsolation}/${secondIsolation}`, blocked: predecessorSuccessorBlocked, predecessorSQLSTATE: completePred2 ? "00000" : null, successorSQLSTATE: completeSuccResult.code, retrySQLSTATE: completeSuccRetry.code });
      await a.ok("reset role;");
      await b.ok("reset role;");
       record("M2.2B-R2 task.transition shares graph-before-task lock order", graphBeforeCompleteBlocked && completionBeforeGraphBlocked && [completionAfterGraphResult.code, graphAfterCompleteResult.code].every((code) => code === "40001"), { isolationPair: `${firstIsolation}/${secondIsolation}`, transitionBeforeGraphBlocked: completionBeforeGraphBlocked, graphBeforeTransitionBlocked: graphBeforeCompleteBlocked, preparedPlanPassedToCore: true, nestedLockReacquisition: false, firstConflictSQLSTATE: completionAfterGraphResult.code, reverseConflictSQLSTATE: graphAfterCompleteResult.code });
    }
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
    await a.ok("reset role;");
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
      const profileFenceMigration = (
        await observer.ok(
          `select ((select count(*) from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(source)})::text)||'|'||((select count(*) from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id=${lit(target)})::text)||'|'||((select count(*) from public.profiles where id=${lit(target)})::text);`,
        )
      ).at(-1);
      record(
        `identity UUID update race ${firstIsolation}/${secondIsolation}: ${firstKind} first`,
        blocked &&
          finalCount === "1" &&
          fenceRevision === "1" &&
          profileFenceMigration === `0|${firstKind === "business" ? "1" : "0"}|${firstKind === "business" ? "1" : "0"}` &&
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
          profileFenceMigration,
        },
      );
      await observer.ok(
        `delete from app_private.api_membership_fences where organization_id=${lit(org)} and profile_id in (${lit(source)},${lit(target)});delete from public.profiles where id in (${lit(source)},${lit(target)});delete from app_private.technical_accounts where user_id in (${lit(source)},${lit(target)});`,
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
  if (flags["--m2-2b-smoke"]) {
    const closeOwner = uid(284), closeBoss = uid(20), closeCompany = uid(21), closeTeam = uid(22);
    const closeTaskAssignment = uid(281), closeTask = uid(282), replayAssignment = uid(289), replayTask = uid(290), replayOperation = uid(291), timerAssignment = uid(293), timerTask = uid(294), reviewAssignment = uid(297), reviewTask = uid(298), reviewOperation = uid(299);
    await observer.ok(`insert into auth.users(id) values(${lit(closeOwner)});
      insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(closeOwner)},${lit(org)},'R1 close-fence employee','empleado','Test','Test','Test');
      insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(closeCompany)},${lit(closeOwner)});
      insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(closeTeam)},${lit(closeOwner)});
      insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
      values(${lit(closeTaskAssignment)},${lit(org)},${lit(closeCompany)},${lit(closeOwner)},${lit(closeTeam)},'M2.2B stale month-fence task','resultado',1,null,null,'mensual','2026-10-01',15,'[]');
      insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
      values(${lit(closeTask)},${lit(org)},${lit(closeTaskAssignment)},${lit(closeCompany)},${lit(closeOwner)},${lit(closeTeam)},'2026-10-01','2026-10-01','M2.2B stale month-fence task','resultado',1,null,null,null,'[]','En curso');
      insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
      values(${lit(replayAssignment)},${lit(org)},${lit(closeCompany)},${lit(closeOwner)},${lit(closeTeam)},'M2.2B receipt replay after close','resultado',1,null,null,'mensual','2026-10-01',15,'[]');
      insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
      values(${lit(replayTask)},${lit(org)},${lit(replayAssignment)},${lit(closeCompany)},${lit(closeOwner)},${lit(closeTeam)},'2026-10-01','2026-10-01','M2.2B receipt replay after close','resultado',1,null,null,null,'[]','En curso');`);
    await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
      values(${lit(timerAssignment)},${lit(org)},${lit(closeCompany)},${lit(closeOwner)},${lit(closeTeam)},'M2.2B legacy timer stale month-fence','resultado',1,null,null,'mensual','2026-09-01',15,'[]');
      insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status)
      values(${lit(timerTask)},${lit(org)},${lit(timerAssignment)},${lit(closeCompany)},${lit(closeOwner)},${lit(closeTeam)},'2026-09-01','2026-09-01','M2.2B legacy timer stale month-fence','resultado',1,null,null,null,'[]','En curso');
      insert into app_private.task_tracking(instance_id,organization_id,commercial_enabled,through_day,progress_by,progress_at) values(${lit(timerTask)},${lit(org)},true,0,${lit(closeOwner)},clock_timestamp());`);
    await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,checklist)
      values(${lit(reviewAssignment)},${lit(org)},${lit(closeCompany)},${lit(closeOwner)},${lit(closeTeam)},'M2.2B legacy transition stale month-fence','resultado',1,null,null,'mensual','2026-09-01',15,'[]');
      insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,unit,target,checklist,status,state_revision)
      values(${lit(reviewTask)},${lit(org)},${lit(reviewAssignment)},${lit(closeCompany)},${lit(closeOwner)},${lit(closeTeam)},'2026-09-01','2026-09-01','M2.2B legacy transition stale month-fence','resultado',1,null,null,null,'[]','Pendiente',1);
      insert into app_private.task_tracking(instance_id,organization_id,commercial_enabled,through_day,progress_by,progress_at) values(${lit(reviewTask)},${lit(org)},true,0,${lit(closeOwner)},clock_timestamp());`);
    await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(closeOwner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: closeOwner, aal: "aal1" }))},false);set role authenticated;`);
    const routeFilters = { subjectId: closeOwner, period: "2026-10-01", companyId: null, teamId: null, sector: null };
    const routeBeforeClose = await b.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "suggestedRoute", filters: routeFilters, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(routeBeforeClose.code, "00000", JSON.stringify(routeBeforeClose));
    const oldRouteCursor = JSON.parse(routeBeforeClose.lines.at(-1)).data.nextCursor;
    assert.equal(typeof oldRouteCursor, "string");
    await claims({ role: "authenticated", sub: closeBoss, aal: "aal2" }, closeBoss);
    await reviewer.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(closeOwner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: closeOwner, aal: "aal1" }))},false);set role authenticated;`);
    await reviewer.ok(`begin isolation level repeatable read;select count(*) from public.monthly_closures where owner_id=${lit(closeOwner)} and period='2026-09-01';`);
    const staleReviewPid = Number((await reviewer.ok("select pg_backend_pid();")).at(-1));
    await b.ok(`begin isolation level repeatable read;select count(*) from public.monthly_closures where owner_id=${lit(closeOwner)} and period='2026-09-01';`);
    const staleTimerPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
    await a.ok("begin;");
    await a.ok("select pg_backend_pid();");
    await a.ok(`select public.close_employee_month(${lit(closeOwner)},'2026-09-01','R1 legacy timer month-fence');`);
    const staleTimerPending = b.query(`select public.start_task_timer(${lit(timerTask)},0,${lit(uid(295))},false);`);
    const staleReviewPending = reviewer.query(`select public.transition_task_reviewed(${lit(reviewTask)},'En curso',null,1,${lit(reviewOperation)});`);
    let staleTimerBlocked = false;
    const timerDeadline = Date.now() + 10000;
    while (Date.now() < timerDeadline) {
      const blocked = await a.ok(`select cardinality(pg_catalog.pg_blocking_pids(${staleTimerPid}))>0,cardinality(pg_catalog.pg_blocking_pids(${staleReviewPid}))>0;`);
      if (blocked.at(-1) === "t|t") { staleTimerBlocked = true; break; }
      await new Promise((done) => setTimeout(done, 20));
    }
    await a.ok("commit;");
    const staleTimerResult = await staleTimerPending;
    const staleReviewResult = await staleReviewPending;
    await b.ok("rollback;");
    await reviewer.ok("rollback;");
    await b.ok("begin isolation level repeatable read;");
    const closedTimerRetry = await b.query(`select public.start_task_timer(${lit(timerTask)},0,${lit(uid(296))},false);`);
    await b.ok("rollback;");
    await reviewer.ok("begin isolation level repeatable read;");
    const closedReviewRetry = await reviewer.query(`select public.transition_task_reviewed(${lit(reviewTask)},'En curso',null,1,${lit(uid(300))});`);
    await reviewer.ok("rollback;");
    assert.equal(staleTimerBlocked, true, "RR legacy timer must wait for monthly closure");
    assert.equal(staleTimerResult.code, "40001", JSON.stringify(staleTimerResult));
    assert.equal(staleReviewResult.code, "40001", JSON.stringify(staleReviewResult));
    assert.notEqual(closedTimerRetry.code, "00000", JSON.stringify(closedTimerRetry));
    assert.notEqual(closedReviewRetry.code, "00000", JSON.stringify(closedReviewRetry));
    const closedTimerState = (await observer.ok(`select (select count(*) from public.monthly_closures where owner_id=${lit(closeOwner)} and period='2026-09-01')||'|'||(select state_revision from public.task_instances where id=${lit(timerTask)})||'|'||(select count(*) from public.task_time_sessions where instance_id=${lit(timerTask)} and ended_at is null);`)).at(-1);
    assert.equal(closedTimerState, "1|0|0");
    record("M2.2B Sol P1 legacy timer RR stale snapshot aborts on month fence; retry creates no session", true, { blocked: staleTimerBlocked, closeCommitted: "00000", staleSnapshotSQLSTATE: staleTimerResult.code, freshRetrySQLSTATE: closedTimerRetry.code, finalState: closedTimerState });
    const closedReviewState = (await observer.ok(`select (select status||'|'||state_revision from public.task_instances where id=${lit(reviewTask)})||'|'||(select count(*) from public.task_time_sessions where instance_id=${lit(reviewTask)} and ended_at is null)||'|'||(select count(*) from public.task_mutation_receipts where actor_id=${lit(closeOwner)} and operation_id in (${lit(reviewOperation)},${lit(uid(300))}));`)).at(-1);
    assert.equal(closedReviewState, "Pendiente|1|0|0");
    record("M2.2B Sol P1 shared task-control core fences legacy transition against monthly close", true, { blocked: staleTimerBlocked, closeCommitted: "00000", staleSnapshotSQLSTATE: staleReviewResult.code, freshRetrySQLSTATE: closedReviewRetry.code, finalState: closedReviewState });
    const replayCommand = { contractVersion: 1, operationId: replayOperation, kind: "task.transition", expectedRevisions: { [`task:${replayTask}`]: "0" }, payload: { taskId: replayTask, status: "Completada", reason: null, confirmCommercialCompletion: false } };
    const replayBeforeClose = await b.query(`select api.command_v1('${JSON.stringify(replayCommand).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(replayBeforeClose.code, "00000", JSON.stringify(replayBeforeClose));
    await claims({ role: "authenticated", sub: closeBoss, aal: "aal2" }, closeBoss);
    await a.ok("begin;");
    const closeWriterPid = Number((await a.ok("select pg_backend_pid();")).at(-1));
    await a.ok(`select public.close_employee_month(${lit(closeOwner)},'2026-10-01','R1 native close fence');`);
    await b.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(closeOwner)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: "authenticated", sub: closeOwner, aal: "aal1" }))},false);set role authenticated;`);
    await b.ok(`begin isolation level repeatable read;select count(*) from public.monthly_closures where owner_id=${lit(closeOwner)} and period='2026-10-01';`);
    const staleWriterPid = Number((await b.ok("select pg_backend_pid();")).at(-1));
    const closeCommand = { contractVersion: 1, operationId: uid(283), kind: "task.transition", expectedRevisions: { [`task:${closeTask}`]: "0" }, payload: { taskId: closeTask, status: "Completada", reason: null, confirmCommercialCompletion: false } };
    const staleClosePending = b.query(`select api.command_v1('${JSON.stringify(closeCommand).replaceAll("'", "''")}'::jsonb);`);
    let staleCloseBlocked = false;
    const closeDeadline = Date.now() + 10000;
    while (Date.now() < closeDeadline) {
      if ((await observer.ok(`select ${closeWriterPid}=any(pg_catalog.pg_blocking_pids(${staleWriterPid}));`)).at(-1) === "t") { staleCloseBlocked = true; break; }
      await new Promise((done) => setTimeout(done, 20));
    }
    await a.ok("commit;");
    const staleCloseResult = await staleClosePending;
    await b.ok("rollback;");
    await b.ok(`begin isolation level repeatable read;`);
    const closedRetry = await b.query(`select api.command_v1('${JSON.stringify(closeCommand).replaceAll("'", "''")}'::jsonb);`);
    await b.ok("rollback;");
    assert.equal(staleCloseBlocked, true, "RR month-fence writer must wait for the close");
    assert.equal(staleCloseResult.code, "40001", JSON.stringify(staleCloseResult));
    assert.equal(closedRetry.code, "55000", JSON.stringify(closedRetry));
    const closedState = (await observer.ok(`select status||'|'||state_revision from public.task_instances where id=${lit(closeTask)};`)).at(-1);
    assert.equal(closedState, "En curso|0");
    record("M2.2B-R1 RR stale snapshot aborts at month fence; retry rejects closed unit", true, { blocked: staleCloseBlocked, closeCommitted: "00000", staleSnapshotSQLSTATE: staleCloseResult.code, freshRetrySQLSTATE: closedRetry.code, finalState: closedState });
    const replayAfterClose = await b.query(`select api.command_v1('${JSON.stringify(replayCommand).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(replayAfterClose.code, "00000", JSON.stringify(replayAfterClose));
    const receiptAfterClose = await b.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "commandReceipt", filters: { operationId: replayOperation }, cursor: null, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(receiptAfterClose.code, "00000", JSON.stringify(receiptAfterClose));
    const closedCursor = await b.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "suggestedRoute", filters: routeFilters, cursor: oldRouteCursor, limit: 1 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(closedCursor.code, "40001", JSON.stringify(closedCursor));
    const routeAfterClose = await b.query(`select api.query_v1('${JSON.stringify({ contractVersion: 1, kind: "suggestedRoute", filters: routeFilters, cursor: null, limit: 10 }).replaceAll("'", "''")}'::jsonb);`);
    assert.equal(routeAfterClose.code, "00000", JSON.stringify(routeAfterClose));
    assert.equal(JSON.parse(routeAfterClose.lines.at(-1)).data.items.length, 0);
    record("M2.2B-R5/R6 exact replay survives close; closed route items leave cursor fingerprint", true, { replaySQLSTATE: replayAfterClose.code, receiptSQLSTATE: receiptAfterClose.code, oldCursorSQLSTATE: closedCursor.code, freshRouteItems: 0 });
    await b.ok("reset role;");
  }
  const sqlFile = join(
    root,
    "supabase/migrations/202610140013_api_identity_foundation.sql",
  );
  const sql014File = join(root, "supabase/migrations/202610150014_operational_api.sql");
  const postgresLog = readFileSync(join(out, "postgres.log"), "utf8");
  const deadlockMatches = postgresLog.match(/deadlock detected|40P01/gi) ?? [];
  record("native PostgreSQL deadlock log check", deadlockMatches.length === 0, { sqlstate40P01: deadlockMatches.length, checked: "postgres.log" });
  const report = {
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    }).trim(),
    runnerSha256: createHash("sha256")
      .update(readFileSync(join(root, "tests/review/m2-1-native-review.mjs")))
      .digest("hex"),
    focusedMatrix: "M2.2C task.createOneOff first execution versus companyMembership.setActive, RC/RC and RR/RR, both winners",
    engine: native("postgres", ["--version"]).trim(),
    migrationSha256: createHash("sha256")
      .update(readFileSync(sqlFile))
      .digest("hex"),
    migration014Sha256: flags["--through-014"]
      ? createHash("sha256").update(readFileSync(sql014File)).digest("hex")
      : null,
    candidate: flags["--candidate"] ?? null,
    m2aIsolation,
    m2aFirstIsolation,
    m2aSecondIsolation,
    m2cSmoke: flags["--m2-2c-smoke"] === "yes",
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
  for (const session of [a, b, observer, reviewer, ...auxiliarySessions])
    if (session && !session.pending) await session.close();
  if (started) control(["-D", cluster, "-m", "fast", "-w", "stop"]);
}
