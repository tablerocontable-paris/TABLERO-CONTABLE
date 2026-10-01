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
    .filter(
      (f) =>
        f.endsWith(".sql") &&
        f <= "202610010008_time_coverage_finalization.sql",
    )
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
  {
    const name = "expiry-wait BA before cutoff";
    const spec = scenario("expiry-wait", "BA");
    current = name;
    await db.exec("begin");
    try {
      await db.exec(fixture + spec.setup);
      const calendar = (
        await db.query(
          "select clock_timestamp()<((ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires') live from employee_absences where id='60000000-0000-0000-0000-000008000001'",
        )
      ).rows[0];
      if (!calendar?.live)
        throw Error(
          "Fixture crossed ART cutoff; recreate instead of testing another branch",
        );

      await db.exec(
        "reset role;select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000008000001',false),set_config('request.jwt.claims','{\"aal\":\"aal2\"}',false);set role authenticated;",
      );
      const identity = (
        await db.query(
          "select auth.uid()::text actor,auth.jwt()->>'aal' aal,current_user role",
        )
      ).rows[0];
      if (
        identity.actor !== "10000000-0000-0000-0000-000008000001" ||
        identity.aal !== "aal2" ||
        identity.role !== "authenticated"
      )
        throw Error(
          "B must execute as permanent boss with aal2 as authenticated",
        );
      await db.exec("reset role");
      const sourceClock = (
        await db.query(
          "select id::text,started_at::text from task_time_sessions where instance_id='50000000-0000-0000-0000-000008000001' and ended_at is null",
        )
      ).rows[0];
      if (!sourceClock) throw Error("Expected seeded peer clock before B");

      const scalarB = spec.B.replace(
        /perform (public\.set_task_wait\([\s\S]*?\));/,
        "insert into lab008.results values('wait',to_jsonb($1));",
      );
      if (scalarB === spec.B)
        throw Error("Could not capture the original scalar return from B");
      await db.exec(scalarB.replace(/\nbegin;\n/, "\n"));
      await db.exec(spec.verify);
      const firstResult = (
        await db.query(
          "select value from lab008.results where connection='wait'",
        )
      ).rows[0]?.value;
      if (firstResult !== 2)
        throw Error(
          `B returned ${JSON.stringify(firstResult)} instead of revision 2`,
        );

      const waitAssertions = (
        await db.query(`select
          (select actor_id='10000000-0000-0000-0000-000008000001' and result='{"revision":2}'::jsonb
             from task_mutation_receipts where operation_id='90000000-0000-0000-0000-000008000001') boss_receipt,
          (select s.id::text='${sourceClock.id}' and s.started_at::text='${sourceClock.started_at}' and s.ended_at < ((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires')
             from task_time_sessions s join employee_absences a on a.id=s.absence_id where s.id='${sourceClock.id}') source_closed,
          (select count(*)=1 and bool_and(actor_id='10000000-0000-0000-0000-000008000001'
             and (details->>'session')::uuid='${sourceClock.id}'
             and (details->>'executor')::uuid='10000000-0000-0000-0000-000008000003'
             and (details->>'absence')::uuid='60000000-0000-0000-0000-000008000001'
             and (details->>'started_at')::timestamptz='${sourceClock.started_at}'::timestamptz
             and (details->>'ended_at')::timestamptz=(select ended_at from task_time_sessions where id='${sourceClock.id}'))
             from audit_events where action='task.wait') exact_wait_audit,
          (select count(*)=2 from task_mutation_receipts) two_receipts,
          (select count(*)=0 from audit_events where action='task.timer_expired') no_expiry_audit`)
      ).rows[0];
      if (Object.values(waitAssertions).some((value) => value !== true))
        throw Error(
          `Wait/session receipt assertions failed: ${JSON.stringify(waitAssertions)}`,
        );

      const state = async () => {
        await db.exec("reset role");
        const snapshot = {};
        for (const table of [
          "task_instances",
          "task_time_sessions",
          "audit_events",
          "task_mutation_receipts",
        ])
          snapshot[table] = (
            await db.query(
              `select to_jsonb(t) row from ${table} t order by to_jsonb(t)::text`,
            )
          ).rows;
        return JSON.stringify(snapshot);
      };
      const beforeReplay = await state();
      await db.exec(
        "reset role;select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000008000001',false),set_config('request.jwt.claims','{\"aal\":\"aal2\"}',false);set role authenticated;",
      );
      const replay = (
        await db.query(
          "select public.set_task_wait('50000000-0000-0000-0000-000008000001','Synthetic wait',1,'90000000-0000-0000-0000-000008000001') result",
        )
      ).rows[0]?.result;
      if (replay !== 2 || (await state()) !== beforeReplay)
        throw Error(
          "Same-key replay changed state/audits or did not return revision 2",
        );

      passed++;
      console.log(
        JSON.stringify({
          scenario: name,
          passed: true,
          sequential_only: true,
          before_art_cutoff: true,
          boss_aal2: true,
          same_key_replay_unchanged: true,
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
