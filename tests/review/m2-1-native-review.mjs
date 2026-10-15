// Independent native PostgreSQL review. Synthetic data, fresh cluster, loopback only.
// Exit 1 means contract findings; exit 2 means the harness could not complete.
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { decodeContextV1 } from "../../src/data/supabase/context-contract.ts";

const flags = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((a, v, i, all) => (i % 2 ? a : [...a, [v, all[i + 1]]]), []),
);
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
  for (const file of readdirSync(join(root, "supabase/migrations"))
    .filter(
      (f) =>
        f.endsWith(".sql") && f <= "202610140013_api_identity_foundation.sql",
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
  const claims = async (claim) => {
    await a.ok(
      `reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify(claim))},false);set role authenticated;`,
    );
  };
  for (const [name, claim] of [
    ["missing AAL", { role: "authenticated" }],
    ["null AAL", { role: "authenticated", aal: null }],
  ]) {
    await claims(claim);
    const response = await a.query("select api.get_context_v1();");
    record(name, response.code === "42501", {
      expectedSQLSTATE: "42501",
      observedSQLSTATE: response.code,
      body: response.lines.at(-1),
    });
  }
  for (const [name, value, expected] of [
    ["whitespace-only display name", "\t\n", "deny"],
    ["Unicode code-point display name", "😀".repeat(150), "decode"],
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
            decoded.context.principal.displayName === value,
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
