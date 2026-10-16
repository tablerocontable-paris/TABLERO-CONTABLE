// NO EJECUTADO against PostgreSQL. --emit-only writes SQL without connecting.
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { scenario, cases } from "./scenarios.mjs";
const here = dirname(fileURLToPath(import.meta.url)),
  root = resolve(here, "../..");
const [mode, output, name, order] = process.argv.slice(2);
if (
  !["--emit-only", "--run"].includes(mode) ||
  !output ||
  !cases.includes(name) ||
  !["AB", "BA"].includes(order)
) {
  throw Error(
    "Usage: node tests/postgres-008/run-case.mjs --emit-only|--run OUTPUT_DIR SCENARIO AB|BA",
  );
}
const spec = scenario(name, order);
mkdirSync(output, { recursive: true });
const scripts = {
  "00-fixture.sql": readFileSync(resolve(here, "fixture.sql"), "utf8"),
  "01-setup.sql": spec.setup,
  "02-A.sql": spec.A + "\n\\echo A_BODY_DONE\n",
  "03-B.sql": spec.B + "\n\\echo B_BODY_DONE\n",
  "04-first-commit.sql": spec.afterFirst + "\ncommit;\n",
  "05-second-commit.sql": "commit;\n",
  "06-verify.sql": spec.verify,
  "07-rollback.sql": "rollback;\n",
};
for (const [file, sql] of Object.entries(scripts))
  writeFileSync(resolve(output, file), sql + "\n");
writeFileSync(
  resolve(output, "ORDER.txt"),
  `first=${spec.first}\nsecond=${spec.second}\nStatus: NO EJECUTADO until run succeeds and logs are reviewed\n`,
);
if (mode === "--emit-only") {
  console.log(
    JSON.stringify({
      status: "NO EJECUTADO",
      scenario: name,
      order,
      sql: resolve(output),
    }),
  );
} else {
  for (const key of ["TC_PGHOST", "TC_PGPORT", "TC_PGUSER", "TC_DB_PREFIX"])
    if (!process.env[key]) throw Error(`${key} must be supplied explicitly`);
  if (
    !/^\d+$/.test(process.env.TC_PGPORT) ||
    !/^tablero_008_lab_[a-z0-9_]+$/.test(process.env.TC_DB_PREFIX)
  )
    throw Error("Port or disposable database prefix invalid");
  const db = `${process.env.TC_DB_PREFIX}_${name.replaceAll("-", "_")}_${order.toLowerCase()}`;
  if (db.length > 63) throw Error("Database name must be <=63 characters");
  const flags = [
    "--host",
    process.env.TC_PGHOST,
    "--port",
    process.env.TC_PGPORT,
    "--username",
    process.env.TC_PGUSER,
  ];
  const sqlFlags = [
    ...flags,
    "--dbname",
    db,
    "-X",
    "--no-password",
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
  ];
  const logFile = resolve(output, "postgres.log");
  writeFileSync(logFile, "");
  const log = (message) => {
    writeFileSync(logFile, message + "\n", { flag: "a" });
  };
  async function command(bin, args, input = "", app = "setup") {
    return new Promise((res, rej) => {
      const p = spawn(bin, args, {
        env: { ...process.env, PGAPPNAME: `tc008_${app}` },
        stdio: ["pipe", "pipe", "pipe"],
      });
      let out = "";
      p.stdout.on("data", (c) => {
        out += c;
        log(`[${app}] ${c}`);
      });
      p.stderr.on("data", (c) => log(`[${app}] ${c}`));
      p.on("error", rej);
      p.on("exit", (code) =>
        code === 0
          ? res(out)
          : rej(Error(`${bin} ${app} exited ${code}; see postgres.log`)),
      );
      p.stdin.end(input);
    });
  }
  await command("createdb", [...flags, "--no-password", db]); // Never drops/reuses a DB.
  const auth = `select pg_advisory_lock(hashtextextended('tc008_role_setup',0));
 do $$begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
 end$$;
 select pg_advisory_unlock(hashtextextended('tc008_role_setup',0));
 create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`;
  await command("psql", sqlFlags, auth);
  for (const file of readdirSync(resolve(root, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql") && f <= "202610010008_time_coverage_finalization.sql")
    .sort()) {
    await command(
      "psql",
      sqlFlags,
      readFileSync(resolve(root, "supabase/migrations", file), "utf8"),
      file,
    );
  }
  await command(
    "psql",
    sqlFlags,
    scripts["00-fixture.sql"] + scripts["01-setup.sql"],
  );
  const connections = [];
  function connection(label) {
    const app = `tc008_${process.pid}_${label}`;
    const p = spawn("psql", sqlFlags, {
      env: { ...process.env, PGAPPNAME: app },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      exited = false,
      failed = false;
    p.stdout.on("data", (c) => {
      out += c;
      log(`[${label}] ${c}`);
    });
    p.stderr.on("data", (c) => log(`[${label}] ${c}`));
    p.on("exit", (code) => {
      exited = true;
      failed = code !== 0;
    });
    p.on("error", (e) => {
      failed = true;
      exited = true;
      log(String(e));
    });
    const send = (sql) => {
      if (exited) throw Error(`Connection ${label} exited`);
      p.stdin.write(sql + "\n");
    };
    const wait = async (marker, limit = 15000) => {
      const until = Date.now() + limit;
      while (!out.includes(marker)) {
        if (exited || failed || Date.now() > until)
          throw Error(
            `Connection ${label} failed/timed out waiting for ${marker}`,
          );
        await new Promise((r) => setTimeout(r, 50));
      }
    };
    const c = {
      label,
      app,
      send,
      wait,
      rollback() {
        if (!exited) p.stdin.end("rollback;\n\\quit\n");
      },
    };
    connections.push(c);
    send("set statement_timeout='180s';set lock_timeout='170s';");
    return c;
  }
  try {
    await command(
      "psql",
      sqlFlags,
      "select version(),clock_timestamp();",
      "version",
    );
    const A = connection("A"),
      B = connection("B"),
      first = spec.first === "A" ? A : B,
      second = spec.second === "A" ? A : B;
    first.send(spec[first.label] + `\n\\echo ${first.label}_READY`);
    await first.wait(`${first.label}_READY`);
    second.send(spec[second.label] + `\n\\echo ${second.label}_READY`);
    const until = Date.now() + 15000;
    let waited = false;
    while (Date.now() < until) {
      const result = await command(
        "psql",
        sqlFlags,
        `select count(*) from pg_stat_activity where application_name='${second.app}' and wait_event_type='Lock';`,
        "observer",
      );
      if (result.trim() === "1") {
        waited = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!waited)
      throw Error("Second connection did not demonstrably wait for a lock");
    log(`CONFIRMED_LOCK_WAIT ${second.label}`);
    first.send(spec.afterFirst + `\ncommit;\n\\echo ${first.label}_COMMITTED`);
    await first.wait(
      `${first.label}_COMMITTED`,
      name === "expiry-wait" ? 150000 : 15000,
    );
    await second.wait(
      `${second.label}_READY`,
      name === "expiry-wait" ? 150000 : 15000,
    );
    second.send(`commit;\n\\echo ${second.label}_COMMITTED`);
    await second.wait(`${second.label}_COMMITTED`);
    await command("psql", sqlFlags, spec.verify, "assertions");
    writeFileSync(
      resolve(output, "RESULT.json"),
      JSON.stringify(
        {
          status: "POSTGRESQL_RUN_PASSED_REQUIRES_REVIEW",
          database: db,
          scenario: name,
          order,
          lock_wait_verified: true,
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        scenario: name,
        order,
        database: db,
        assertions: "passed",
        log: logFile,
      }),
    );
  } finally {
    for (const c of connections) c.rollback();
  }
}
