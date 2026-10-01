// Sequential PGlite smoke check of emitted SQL. NOT a concurrency test.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { scenario, cases } from "./scenarios.mjs";
const db = new PGlite();
let current = "setup";
try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`);
  const migrations = new URL("../../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(migrations)
    .filter((f) => f.endsWith(".sql") && f <= "202610010008_time_coverage_finalization.sql")
    .sort())
    await db.exec(readFileSync(new URL(file, migrations), "utf8"));
  const fixture = readFileSync(
    new URL("fixture.sql", import.meta.url),
    "utf8",
  ).replace(/^begin;|^commit;$/gm, "");
  let passed = 0;
  for (const name of cases.filter((c) => c !== "expiry-wait"))
    for (const order of ["AB", "BA"]) {
      const spec = scenario(name, order);
      current = name + " " + order;
      await db.exec("begin");
      try {
        await db.exec(fixture + spec.setup);
        for (const conn of [spec.first, spec.second])
          await db.exec(spec[conn].replace(/\nbegin;\n/, "\n"));
        await db.exec(spec.verify);
        passed++;
        console.log(
          JSON.stringify({
            scenario: name,
            order,
            passed: true,
            sequential_only: true,
          }),
        );
      } finally {
        await db.exec("rollback");
      }
    }
  console.log(
    JSON.stringify({
      passed,
      concurrency_tested: false,
      expiry: "NO EJECUTADO",
      postgresql: "NO EJECUTADO",
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      case: current,
      passed: false,
      error: error.message,
      where: error.where,
      code: error.code,
    }),
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
