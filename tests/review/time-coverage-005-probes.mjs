// Revisión congelada de 005: cada caso usa una transacción y rollback.
// Resultado CONTRACT_VIOLATION es evidencia de revisión, no aceptación de producto.
// Sólo datos sintéticos PGlite; no conecta con Supabase ni envía correo.
import { PGlite } from '@electric-sql/pglite';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
const db = new PGlite();
const root = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const [org,boss,manager,owner,peer,company,team,assignment,t1,t2] = [1,2,3,4,5,6,7,8,9,10].map(id);
const authSchema=`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`;
await db.exec(authSchema);
for (const f of readdirSync(root).filter(f => f <= '202610010005_time_coverage_hardening.sql').sort()) await db.exec(readFileSync(`${root}/${f}`,'utf8'));
const seed=`insert into organizations values('${org}','Synthetic');insert into auth.users(id) values('${boss}'),('${manager}'),('${owner}'),('${peer}');
insert into profiles(id,organization_id,name,role,manager_id,sector,branch,position) values('${boss}','${org}','Boss','jefe',null,'A','B','C'),('${manager}','${org}','Manager','encargado','${boss}','A','B','C'),('${owner}','${org}','Owner','empleado','${manager}','A','B','C'),('${peer}','${org}','Peer','empleado','${boss}','A','B','C');
insert into companies values('${company}','${org}','A');insert into teams values('${team}','${org}','Team','${manager}');insert into team_members values('${org}','${team}','${owner}');insert into company_memberships values('${org}','${company}','${owner}'),('${org}','${company}','${manager}'),('${org}','${company}','${peer}');
insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day) values('${assignment}','${org}','${company}','${owner}','${team}','Synthetic','resultado',5,'mensual',date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date,1);
insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,checklist) values('${t1}','${org}','${assignment}','${company}','${owner}','${team}',date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date,date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date,'A','resultado',5,null,'[{"id":"a","done":true},{"id":"b","done":false}]'),('${t2}','${org}','${assignment}','${company}','${owner}','${team}',date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date,date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date+1,'B','resultado',5,null,'[]');`;
await db.exec(seed);
async function actor(uid,aal='aal1') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[uid,JSON.stringify({aal})]); await db.exec('set role authenticated'); }
let op=100;
const operation=()=>id(op++);
const rows=async(sql,args=[]) => (await db.query(sql,args)).rows;
const first=async(sql,args=[]) => (await rows(sql,args))[0];
async function start(task=t1,rev=0,switching=false) {return (await first('select start_task_timer($1,$2,$3,$4) as id',[task,rev,operation(),switching])).id;}
async function attempt(sql,args=[]) {
  await db.exec('savepoint expected_error');
  try {const result=await rows(sql,args); await db.exec('release savepoint expected_error'); return {result};}
  catch(e) {await db.exec('rollback to savepoint expected_error;release savepoint expected_error'); return {error:e.message};}
}
let checks=0,violations=0;
async function probe(name,expected,fn) {
  await db.exec('begin');
  try {
    const {met,observed}=await fn();checks++;if(!met)violations++;
    console.log(JSON.stringify({name,expected,status:met?'CONTRACT_MET':'CONTRACT_VIOLATION',observed}));
  } finally {await db.exec('rollback;reset role');}
}
await probe('null_revisions','Rechazar las cuatro RPC sin receipt',async()=>{
  await actor(owner);const calls=[
    ['select start_task_timer($1,null,$2,false)',[t1,operation()]],
    ["select transition_task_reviewed($1,'En curso',null,null,$2)",[t1,operation()]],
    ["select set_checklist_item_reviewed($1,'b',true,null,null,$2)",[t1,operation()]],
    ["select set_task_wait($1,'Esperando',null,$2)",[t1,operation()]]];
  const observed=[];for(const [sql,args] of calls)observed.push(await attempt(sql,args));
  await db.exec('reset role');const receipts=(await first('select count(*)::int as n from task_mutation_receipts')).n;
  return {met:observed.every(x=>x.error)&&receipts===0,observed:{calls:observed,receipts}};
});
await probe('null_switch_with_live_source','Rechazar sin cerrar origen ni abrir destino',async()=>{
  await actor(owner);await start();const call=await attempt('select start_task_timer($1,0,$2,null)',[t2,operation()]);
  const state=await rows('select instance_id,ended_at is null as active from task_time_sessions');
  return {met:!!call.error&&state.length===1&&state[0].instance_id===t1&&state[0].active,observed:{call,state}};
});
await probe('suspended_pause','Pausar propia sesión sin permiso de tarea',async()=>{
  await actor(owner);const s=await start();await db.exec('reset role');await db.query('update profiles set active=false where id=$1',[owner]);await actor(owner);
  const call=await attempt('select pause_task_timer($1,$2)',[s,operation()]);await db.exec('reset role');const state=await first('select ended_at is not null as ended from task_time_sessions where id=$1',[s]);
  return {met:!call.error&&state.ended,observed:{call,state}};
});
await probe('noop_start_receipt_replay','Nuevo UUID no-op se recuerda después de pausar',async()=>{
  await actor(owner);const s=await start(),key=operation();const initial=await first('select start_task_timer($1,1,$2,false) as id',[t1,key]);await db.query('select pause_task_timer($1,$2)',[s,operation()]);
  const replay=await attempt('select start_task_timer($1,1,$2,false) as id',[t1,key]);await db.exec('reset role');const receipt=await first('select count(*)::int as n from task_mutation_receipts where operation_id=$1',[key]);
  return {met:receipt.n===1&&!replay.error&&replay.result[0].id===initial.id,observed:{initial,replay,receipt}};
});
await probe('blocked_transition','No iniciar transición de tarea bloqueada',async()=>{
  await actor(owner);await db.query("select set_task_wait($1,'Esperando',0,$2)",[t1,operation()]);const call=await attempt("select transition_task_reviewed($1,'En curso',null,1,$2)",[t1,operation()]);
  const state=await first('select status,(select count(*)::int from task_time_sessions where instance_id=$1 and ended_at is null) active from task_instances where id=$1',[t1]);return {met:!!call.error&&state.status==='Pendiente'&&state.active===0,observed:{call,state}};
});
await probe('employee_cannot_finish_manager_clock','Titular no detiene otro ejecutor con último control',async()=>{
  await actor(manager);await start();await actor(owner);const call=await attempt("select set_checklist_item_reviewed($1,'b',true,null,1,$2)",[t1,operation()]);const state=await first('select status,(select count(*)::int from task_time_sessions where instance_id=$1 and ended_at is null) active from task_instances where id=$1',[t1]);return {met:!!call.error&&state.active===1&&state.status==='En curso',observed:{call,state}};
});
await probe('boss_interruption_mfa_and_reason','Exigir MFA y motivo; con ambos finalizar reloj',async()=>{
  await actor(owner);await start();await actor(boss);const noMfa=await attempt("select transition_task_reviewed($1,'Pendiente','Revisión',1,$2)",[t1,operation()]);await actor(boss,'aal2');const noReason=await attempt("select transition_task_reviewed($1,'Pendiente',null,1,$2)",[t1,operation()]);const valid=await attempt("select transition_task_reviewed($1,'Pendiente','Revisión',1,$2)",[t1,operation()]);await db.exec('reset role');const state=await first('select count(*)::int as active from task_time_sessions where ended_at is null');return {met:!!noMfa.error&&!!noReason.error&&!valid.error&&state.active===0,observed:{noMfa,noReason,valid,state}};
});
await probe('absence_overlap_without_replacement','Rechazar superposición sin reemplazo',async()=>{
  await actor(boss,'aal2');await db.query("select approve_employee_absence($1,null,'vacaciones',current_date,current_date+2,'{}','Traspaso',$2)",[owner,operation()]);const call=await attempt("select approve_employee_absence($1,null,'licencia',current_date+2,current_date+4,'{}','Traspaso',$2)",[owner,operation()]);return {met:!!call.error,observed:call};
});
await probe('empty_wait','Rechazar descripción sólo espacios',async()=>{await actor(owner);const call=await attempt('select set_task_wait($1,$2,0,$3)',[t1,'   ',operation()]);return {met:!!call.error,observed:call};});
async function syntheticCoverage({expired=false,cancelled=false,sessionActor=peer,task=t1,ended=false}={}) {
  await actor(boss,'aal2');
  const absence=(await first(`select approve_employee_absence($1,$2,'licencia',(now() at time zone 'America/Argentina/Buenos_Aires')::date-3,(now() at time zone 'America/Argentina/Buenos_Aires')::date+${expired?'-1':'5'},array[$3]::uuid[],'Sintética',$4) as id`,[owner,peer,company,operation()])).id;
  await db.exec('reset role');
  if(cancelled)await db.query("update employee_absences set cancelled_at=clock_timestamp()-interval '1 hour' where id=$1",[absence]);
  const session=(await first(`insert into task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id,ended_at) values($1,$2,$3,clock_timestamp()-interval '2 days',$4,${ended?"clock_timestamp()":"null"}) returning id`,[org,task,sessionActor,absence])).id;
  return {absence,session};
}
await probe('effective_end_expiry_before_cancel','Usar mínimo expiración/cancelación',async()=>{
  const {absence,session}=await syntheticCoverage({expired:true,cancelled:true});const observed=await first("select _effective_session_end($1,clock_timestamp())<=((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires') as capped from employee_absences a where a.id=$2",[session,absence]);return {met:observed.capped,observed};
});
await probe('closed_month_pause','Rechazar pausa y conservar sesión/mes',async()=>{
  await actor(owner);const s=await start();await db.exec('reset role');await db.query("insert into monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) select organization_id,owner_id,period,'{}',$2,'Sintético' from task_instances where id=$1",[t1,boss]);await actor(owner);const call=await attempt('select pause_task_timer($1,$2)',[s,operation()]);await db.exec('reset role');const state=await first('select ended_at is null as active from task_time_sessions where id=$1',[s]);return {met:!!call.error&&state.active,observed:{call,state}};
});
await probe('operational_last_control','Marcar control operativo conserva En curso y reloj',async()=>{
  await db.query("update task_instances set kind='operativa',target=10,unit='facturas' where id=$1",[t1]);await actor(owner);const call=await attempt("select set_checklist_item_reviewed($1,'b',true,null,0,$2)",[t1,operation()]);const state=await first("select status,checklist,(select count(*)::int from task_time_sessions where instance_id=$1 and ended_at is null) as active from task_instances where id=$1",[t1]);return {met:!call.error&&state.status==='En curso'&&state.active===1,observed:{call,state}};
});
await probe('same_wait_with_live_clock','Repetir bloqueo con reloj anómalo lo detiene y revisa',async()=>{
  await actor(owner);const s=await start();await db.exec('reset role');await db.query("update task_instances set blocked_by='Esperando',blocked_since=current_date where id=$1",[t1]);await actor(owner);const call=await attempt("select set_task_wait($1,'Esperando',1,$2)",[t1,operation()]);const state=await first('select ended_at is not null as ended,(select state_revision::int from task_instances where id=$2) revision from task_time_sessions where id=$1',[s,t1]);return {met:!call.error&&state.ended&&state.revision===2,observed:{call,state}};
});
await probe('cancelled_future_source','Origen cancelado se limpia sin p_switch',async()=>{
  const {session}=await syntheticCoverage({cancelled:true});
  await db.query('insert into team_members values($1,$2,$3)',[org,team,peer]);
  await db.query("insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day) select $1,organization_id,company_id,$2,team_id,'Propia','resultado',5,'mensual',start_month,due_day from task_assignments where id=$3",[id(50),peer,assignment]);
  await db.query('update task_instances set assignment_id=$1,owner_id=$2 where id=$3',[id(50),peer,t2]);
  await actor(peer);const call=await attempt('select start_task_timer($1,0,$2,false)',[t2,operation()]);await db.exec('reset role');const state=await first('select ended_at is not null as ended from task_time_sessions where id=$1',[session]);return {met:!call.error&&state.ended,observed:{call,state}};
});
await probe('closed_session_insert_cutoff','INSERT de sesión terminada respeta corte ART',async()=>{
  const {absence,session}=await syntheticCoverage({expired:true,ended:true});const state=await first("select s.ended_at<=((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires') as capped from task_time_sessions s join employee_absences a on a.id=s.absence_id where s.id=$1 and a.id=$2",[session,absence]);return {met:state.capped,observed:state};
});
await probe('interruption_audit_cutoff','Auditoría contiene ended_at efectivo de sesión',async()=>{
  await actor(owner);await start();await actor(boss,'aal2');await db.query("select transition_task_reviewed($1,'Pendiente','Revisión',1,$2)",[t1,operation()]);await db.exec('reset role');const observed=await first("select details from audit_events where action='task.transition' and entity_id=$1 order by id desc limit 1",[t1]);return {met:!!observed.details.ended_at,observed};
});
await probe('upgrade_preflight_session_integrity','005 aborta con IDs si historia tiene vínculo incoherente/inicio posterior al corte',async()=>{
  const upgrade=new PGlite();
  try {
    await upgrade.exec(authSchema);
    for(const f of readdirSync(root).filter(f=>f<='202610010004_time_coverage.sql').sort()) await upgrade.exec(readFileSync(`${root}/${f}`,'utf8'));
    await upgrade.exec(seed);
    // Dos conflictos sintéticos distintos: la FK de organización no basta para
    // ligar titular/ejecutor; un inicio posterior al corte tampoco viola la FK.
    await upgrade.query("insert into employee_absences(id,organization_id,owner_id,replacement_id,kind,starts_on,ends_on,approved_by) values($1,$2,$3,$4,'licencia',current_date-3,current_date-1,$5),($6,$2,$4,$7,'licencia',current_date-3,current_date-1,$5)",[id(60),org,owner,peer,boss,id(61),manager]);
    await upgrade.query("insert into task_time_sessions(id,organization_id,instance_id,actor_id,started_at,absence_id) values($1,$2,$3,$4,clock_timestamp(),$5),($6,$2,$7,$8,clock_timestamp()-interval '2 days',$9)",[id(62),org,t1,peer,id(60),id(63),t2,owner,id(61)]);
    let error=null;
    try {await upgrade.exec(readFileSync(`${root}/202610010005_time_coverage_hardening.sql`,'utf8'));}
    catch(e) {error=e.message;await upgrade.exec('rollback');}
    const count=(await upgrade.query('select count(*)::int as preserved from task_time_sessions')).rows[0];
    return {met:!!error&&count.preserved===2,observed:{migration_rejected:!!error,error,...count}};
  } finally {await upgrade.close();}
});
console.log(JSON.stringify({review:'005',checks,contract_met:checks-violations,contract_violations:violations,acceptance:false,concurrency_tested:false}));
await db.close();
