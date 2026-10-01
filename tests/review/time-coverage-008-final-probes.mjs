// Review v26: isolated sequential PGlite diagnostic, never PostgreSQL concurrency.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { scenario, login } from '../postgres-008/scenarios.mjs';
const db=new PGlite(), source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
try {
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`);
 const root=new URL('../../supabase/migrations/',import.meta.url);
 for(const f of readdirSync(root).filter(f=>f.endsWith('.sql')&&f<='202610010008_time_coverage_finalization.sql').sort()) await db.exec(readFileSync(new URL(f,root),'utf8'));
 const spec=scenario('expiry-wait','BA');
 // Pin the original employee call; future guide correction must not rewrite
 // this historical diagnostic into a test of a different actor.
 const originalWait=login('10000000-0000-0000-0000-000008000002')+"\nbegin;\ndo $call$ begin perform public.set_task_wait('50000000-0000-0000-0000-000008000001','Synthetic wait',1,'90000000-0000-0000-0000-000008000001'); end $call$;";
 await db.exec(readFileSync(new URL('../postgres-008/fixture.sql',import.meta.url),'utf8')+spec.setup);
 const calendar=(await db.query("select clock_timestamp()<((ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires') live from employee_absences")).rows[0];
 if(!calendar.live) throw Error('Fixture crossed ART cutoff; recreate instead of testing another branch');
 await db.exec('begin');
 const capture=async()=>{
  await db.exec('reset role');const out={};
  for(const table of ['task_instances','task_time_sessions','audit_events','task_mutation_receipts','employee_absences']) out[table]=(await db.query(`select to_jsonb(t) row from ${table} t order by to_jsonb(t)::text`)).rows;
  return JSON.stringify(out);
 };
 const before=await capture();await db.exec('savepoint expected');
 let error;try{await db.exec(originalWait.replace(/\nbegin;\n/,'\n'));}catch(e){error=e.message;}
 await db.exec('rollback to savepoint expected;release savepoint expected');
 const unchanged=await capture()===before;
 if(!error?.includes('Sólo un responsable permanente')||!unchanged)throw Error('Diagnostic did not reproduce expected authorization rejection atomically');
 const bossBranch=originalWait.replace('10000000-0000-0000-0000-000008000002','10000000-0000-0000-0000-000008000001').replace('"aal":"aal1"','"aal":"aal2"').replace(/\nbegin;\n/,'\n');
 await db.exec(bossBranch);await db.exec('reset role');
 const outcome=(await db.query("select state_revision,blocked_by,(select count(*)::int from task_time_sessions where ended_at is null) open,(select count(*)::int from audit_events where action='task.wait') wait_audits,(select count(*)::int from audit_events where action='task.timer_expired') expired_audits from task_instances where id='50000000-0000-0000-0000-000008000001'")).rows[0];
 if(outcome.state_revision!==2||outcome.open!==0||outcome.wait_audits!==1||outcome.expired_audits!==0)throw Error('Synthetic boss/MFA alternative failed');
 console.log(JSON.stringify({source,case:'expiry-wait BA before ART cutoff',contract_met:false,error,unchanged,synthetic_boss_alternative:outcome,concurrency_tested:false,sql_product_changed:false}));
 await db.exec('rollback');
}catch(error){console.error(JSON.stringify({diagnostic_failed:true,error:error.message}));process.exitCode=1;}
finally{await db.close();}
