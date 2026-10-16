// Revisión de 008: diagnóstico separado; cada caso usa transacción y rollback.
// Resultado CONTRACT_VIOLATION es evidencia de revisión, no aceptación de producto.
// Sólo datos sintéticos PGlite; no conecta con Supabase ni envía correo.
import { PGlite } from '@electric-sql/pglite';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const sourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const db = new PGlite();
const root = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const [org,boss,manager,owner,peer,company,team,assignment,t1,t2] = [1,2,3,4,5,6,7,8,9,10].map(id);
const authSchema=`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`;
await db.exec(authSchema);
for (const f of readdirSync(root).filter(f => f <= '202610010008_time_coverage_finalization.sql').sort()) await db.exec(readFileSync(`${root}/${f}`,'utf8'));
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

// Anomalías históricas sólo en laboratorio. Crear sesión antes de fijar la
// cancelación permite revisar un historial válido que 007 puede recibir de 006.
async function coverage({expired=false,cancelled=false,task=t1,ended=false}={}) {
  await actor(boss,'aal2');
  const absence=(await first(`select approve_employee_absence($1,$2,'licencia',(now() at time zone 'America/Argentina/Buenos_Aires')::date-3,(now() at time zone 'America/Argentina/Buenos_Aires')::date+${expired?'-1':'5'},array[$3]::uuid[],'Sintética',$4) as id`,[owner,peer,company,operation()])).id;
  await db.exec('reset role');
  const session=(await first(`insert into task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id,ended_at) values($1,$2,$3,clock_timestamp()-interval '2 days',$4,${ended?'clock_timestamp()':'null'}) returning id`,[org,task,peer,absence])).id;
  if(cancelled) await db.query("update employee_absences set cancelled_at=clock_timestamp()-interval '1 hour' where id=$1",[absence]);
  return {absence,session};
}

await probe('operational_last_control','Operativa conserva En curso y un reloj',async()=>{
  await db.query("update task_instances set kind='operativa',target=10,unit='facturas' where id=$1",[t1]);
  await actor(owner);
  const call=await attempt("select set_checklist_item_reviewed($1,'b',true,null,0,$2)",[t1,operation()]);
  const state=await first("select status,state_revision::int as revision,(select count(*)::int from task_time_sessions where instance_id=$1 and ended_at is null) as active from task_instances where id=$1",[t1]);
  return {met:!call.error&&state.status==='En curso'&&state.revision===1&&state.active===1,observed:{call,state}};
});
await probe('same_wait_with_live_clock','Mismo bloqueo con reloj pausa y revisa una vez',async()=>{
  await actor(owner);const s=await start();await db.exec('reset role');
  await db.query("update task_instances set blocked_by='Esperando',blocked_since=current_date where id=$1",[t1]);
  await actor(owner);const call=await attempt("select set_task_wait($1,'Esperando',1,$2)",[t1,operation()]);
  const state=await first('select ended_at is not null as ended,(select state_revision::int from task_instances where id=$2) revision from task_time_sessions where id=$1',[s,t1]);
  return {met:!call.error&&state.ended&&state.revision===2,observed:{call,state}};
});
await probe('cancelled_future_source','Origen cancelado se limpia sin switch',async()=>{
  const {session}=await coverage({cancelled:true});
  await db.query('insert into team_members values($1,$2,$3)',[org,team,peer]);
  await db.query("insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day) select $1,organization_id,company_id,$2,team_id,'Propia','resultado',5,'mensual',start_month,due_day from task_assignments where id=$3",[id(50),peer,assignment]);
  await db.query('update task_instances set assignment_id=$1,owner_id=$2 where id=$3',[id(50),peer,t2]);
  await actor(peer);const call=await attempt('select start_task_timer($1,0,$2,false)',[t2,operation()]);
  await db.exec('reset role');const state=await first('select ended_at is not null as ended from task_time_sessions where id=$1',[session]);
  return {met:!call.error&&state.ended,observed:{call,state}};
});
await probe('closed_session_insert_cutoff','INSERT termina exactamente en medianoche ART',async()=>{
  const {session}=await coverage({expired:true,ended:true});
  const state=await first("select s.ended_at=((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires') as exact from task_time_sessions s join employee_absences a on a.id=s.absence_id where s.id=$1",[session]);
  return {met:state.exact,observed:state};
});
await probe('interruption_audit_cutoff','Intervención guarda inicio y fin efectivos',async()=>{
  await actor(owner);const session=await start();await actor(boss,'aal2');
  await db.query("select transition_task_reviewed($1,'Pendiente','Revisión',1,$2)",[t1,operation()]);await db.exec('reset role');
  const state=await first("select e.details,(e.details->>'started_at')::timestamptz=s.started_at and (e.details->>'ended_at')::timestamptz=s.ended_at as exact from audit_events e join task_time_sessions s on s.id=$2 where e.action='task.transition' and e.entity_id=$1 order by e.id desc limit 1",[t1,session]);
  return {met:state.exact,observed:state};
});

for(const executor of [owner,manager]) {
  await probe(executor===owner?'unblock_keeps_own_clock':'unblock_keeps_foreign_clock','NULL desbloquea sin finalizar reloj ni pedir intervención',async()=>{
    await actor(executor);const session=await start();await db.exec('reset role');
    await db.query("update task_instances set blocked_by='Documentación',blocked_since=current_date where id=$1",[t1]);
    await actor(owner);const call=await attempt('select set_task_wait($1,null,1,$2)',[t1,operation()]);await db.exec('reset role');
    const state=await first('select t.blocked_by,t.state_revision::int as revision,s.ended_at is null as active,(select count(*)::int from audit_events where details->>\'session\'=$2) as audit_count from task_instances t join task_time_sessions s on s.instance_id=t.id where t.id=$1 and s.id=$2::uuid',[t1,session]);
    return {met:!call.error&&state.blocked_by===null&&state.active&&state.revision===2,observed:{call,state}};
  });
}
for(const rpc of ['transition','checklist']) {
  await probe('expired_foreign_destination_'+rpc,'Limpiar destino vencido antes de tratarlo como otro ejecutor activo',async()=>{
    const {session}=await coverage({expired:true});
    await db.query("update task_instances set checklist='[{\"id\":\"a\",\"done\":false},{\"id\":\"b\",\"done\":false}]' where id=$1",[t1]);
    await actor(owner);
    const call=rpc==='transition'
      ?await attempt("select transition_task_reviewed($1,'En curso',null,0,$2)",[t1,operation()])
      :await attempt("select set_checklist_item_reviewed($1,'a',true,null,0,$2)",[t1,operation()]);
    await db.exec('reset role');
    const state=await first('select ended_at is not null as expired_ended,(select count(*)::int from task_time_sessions where instance_id=$2 and actor_id=$3 and ended_at is null) as own_active from task_time_sessions where id=$1',[session,t1,owner]);
    return {met:!call.error&&state.expired_ended&&state.own_active===1,observed:{call,state}};
  });
}
for(const rpc of ['transition','checklist']) {
  await probe('finish_independent_of_own_closed_clock_'+rpc,'Completar resultado no depende del reloj propio de otra tarea',async()=>{
    await actor(owner);const session=await start();await db.exec('reset role');
    await db.query("insert into monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) select organization_id,owner_id,period,'{}',$2,'Sintético' from task_instances where id=$1",[t1,boss]);
    await db.query("update task_instances set period=period+interval '1 month',scheduled_on=scheduled_on+interval '1 month',checklist='[{\"id\":\"only\",\"done\":false}]',status=$2 where id=$1",[t2,rpc==='transition'?'En curso':'Pendiente']);
    if(rpc==='transition') await db.query("update task_instances set checklist='[]' where id=$1",[t2]);
    await actor(owner);
    const call=rpc==='transition'
      ?await attempt("select transition_task_reviewed($1,'Completada',null,0,$2)",[t2,operation()])
      :await attempt("select set_checklist_item_reviewed($1,'only',true,null,0,$2)",[t2,operation()]);
    await db.exec('reset role');
    const state=await first('select t.status,t.state_revision::int as revision,(select ended_at is null from task_time_sessions where id=$2) as source_active,(select count(*)::int from task_time_sessions where instance_id=$1) as destination_sessions from task_instances t where id=$1',[t2,session]);
    return {met:!call.error&&state.status==='Completada'&&state.revision===1&&state.source_active&&state.destination_sessions===0,observed:{call,state}};
  });
}
await probe('ended_pause_after_month_close','Pausa de sesión ya terminada es no-op incluso después del cierre',async()=>{
  await actor(owner);const session=await start();const ended=await first('select pause_task_timer($1,$2) as ended_at',[session,operation()]);
  await db.exec('reset role');
  await db.query("insert into monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) select organization_id,owner_id,period,'{}',$2,'Sintético' from task_instances where id=$1",[t1,boss]);
  await actor(owner);const call=await attempt('select pause_task_timer($1,$2) as ended_at',[session,operation()]);
  return {met:!call.error&&new Date(call.result[0].ended_at).getTime()===new Date(ended.ended_at).getTime(),observed:{call,original:ended.ended_at}};
});
await probe('absence_uuid_and_approval_time_immutable','Autorización conserva UUID y momento de aprobación',async()=>{
  await actor(boss,'aal2');const absence=(await first("select approve_employee_absence($1,null,'vacaciones',current_date,current_date+1,'{}','Prueba',$2) as id",[owner,operation()])).id;
  await db.exec('reset role');
  const time=await attempt("update employee_absences set approved_at=approved_at-interval '1 day' where id=$1 returning id",[absence]);
  const identity=await attempt('update employee_absences set id=$2 where id=$1 returning id',[absence,id(70)]);
  const state=await first("select exists(select 1 from employee_absences where id=$1) as original_exists,exists(select 1 from audit_events where entity_id=$1 and action='absence.approved') as original_audit",[absence]);
  return {met:!!time.error&&!!identity.error&&state.original_exists,observed:{time,identity,state}};
});
await probe('cancelled_absence_new_key_is_noop','Nueva clave en cancelación existente no relimpia historia',async()=>{
  const {absence,session}=await coverage({cancelled:true});await actor(boss,'aal2');
  const call=await attempt("select cancel_employee_absence($1,'Reintento',$2)",[absence,operation()]);await db.exec('reset role');
  const state=await first('select s.ended_at is null as unchanged,t.state_revision::int as revision,(select count(*)::int from audit_events where action=\'absence.session_stopped\') as stopped_events from task_time_sessions s join task_instances t on t.id=s.instance_id where s.id=$1',[session]);
  return {met:!call.error&&state.unchanged&&state.revision===0&&state.stopped_events===0,observed:{call,state}};
});
await probe('cancellation_audit_operation_instant','Audit de cancelación usa el instante de operación, igual al cutoff',async()=>{
  const {absence}=await coverage();await actor(boss,'aal2');
  await db.query("select cancel_employee_absence($1,'Revisión',$2)",[absence,operation()]);await db.exec('reset role');
  const state=await first("select e.at::text as audit_at,a.cancelled_at::text as cutoff,e.at=a.cancelled_at as same_instant from audit_events e join employee_absences a on a.id=e.entity_id where a.id=$1 and e.action='absence.cancelled'",[absence]);
  return {met:state.same_instant,observed:state};
});
await probe('own_pause_has_cutoff_audit','Pausa ordinaria registra actor, ejecutor, sesión e inicio/fin efectivos',async()=>{
  await actor(owner);const session=await start();await db.query('select pause_task_timer($1,$2)',[session,operation()]);await db.exec('reset role');
  const state=await first("select count(*)::int as matching_events from audit_events e join task_time_sessions s on s.id=$1::uuid where e.actor_id=$2::uuid and e.details->>'session'=$1::text and e.details->>'executor'=$2::text and (e.details->>'started_at')::timestamptz=s.started_at and (e.details->>'ended_at')::timestamptz=s.ended_at",[session,owner]);
  return {met:state.matching_events===1,observed:state};
});
await probe('expired_wait_records_expiration','Espera que finaliza reloj vencido registra también la expiración',async()=>{
  const {session}=await coverage({expired:true});await actor(boss,'aal2');
  await db.query("select set_task_wait($1,'Documentación',0,$2)",[t1,operation()]);await db.exec('reset role');
  const state=await first("select (select count(*)::int from audit_events where action='task.timer_expired' and entity_id=$1) as expired_events,(select ended_at is not null from task_time_sessions where id=$1) as ended",[session]);
  return {met:state.ended&&state.expired_events===1,observed:state};
});

await probe('expired_wait_keeps_session_context','task.wait conserva la sesión y el fin efectivos del reloj vencido',async()=>{
  const {absence,session}=await coverage({expired:true});
  await actor(owner);
  await db.query("select set_task_wait($1,'Documentación',0,$2)",[t1,operation()]);
  await db.exec('reset role');
  const state=await first("select e.details,s.ended_at::text,(e.details->>'session')::uuid=s.id and (e.details->>'executor')::uuid=s.actor_id and (e.details->>'absence')::uuid=s.absence_id and (e.details->>'started_at')::timestamptz=s.started_at and (e.details->>'ended_at')::timestamptz=s.ended_at as exact from audit_events e join task_time_sessions s on s.id=$2 where e.entity_id=$1 and e.action='task.wait'",[t1,session]);
  return {met:state.exact===true,observed:{state,absence,session}};
});

await probe('checklist_noop_independent_of_closed_origin','Control ya marcado con clave nueva es no-op sin bloquear origen ajeno a la operación',async()=>{
  await db.query("update task_instances set checklist='[{\"id\":\"only\",\"done\":false}]' where id=$1",[t2]);
  await actor(owner);const source=await start(t2);
  await db.exec('reset role');
  await db.query("insert into monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) select organization_id,owner_id,period,'{}',$2,'Sintético' from task_instances where id=$1",[t2,boss]);
  await db.query("update task_instances set period=period+interval '1 month',scheduled_on=scheduled_on+interval '1 month' where id=$1",[t1]);
  const opId=operation();await actor(owner);
  const call=await attempt("select set_checklist_item_reviewed($1,'a',true,null,0,$2)",[t1,opId]);
  await db.exec('reset role');
  const state=await first("select status,state_revision::int as revision,(select ended_at is null from task_time_sessions where id=$2) source_active,(select count(*)::int from task_mutation_receipts where operation_id=$3) receipts from task_instances where id=$1",[t1,source,opId]);
  return {met:!call.error&&state.status==='Pendiente'&&state.revision===0&&state.source_active&&state.receipts===1,observed:{call,state}};
});

for(const rpc of ['transition','checklist']) {
  await probe('two_expired_clocks_audit_'+rpc,'Destino y origen vencidos conservan fines independientes en auditoría',async()=>{
    // Dos titulares distintos, coberturas en meses pasados y sólo un reloj por actor/instancia.
    const destination=await coverage({expired:true,task:t1});
    await actor(boss,'aal2');
    const sourceAbsence=(await first("select approve_employee_absence($1,$2,'licencia',(now() at time zone 'America/Argentina/Buenos_Aires')::date-40,(now() at time zone 'America/Argentina/Buenos_Aires')::date-35,array[$3]::uuid[],'Origen pasado',$4) id",[peer,owner,company,operation()])).id;
    await db.exec('reset role');
    await db.query("insert into team_members values($1,$2,$3)",[org,team,peer]);
    await db.query("insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day) select $1,organization_id,company_id,$2,team_id,'Origen','resultado',5,'mensual',start_month,due_day from task_assignments where id=$3",[id(52),peer,assignment]);
    await db.query("update task_instances set assignment_id=$1,owner_id=$2,period=date_trunc('month',current_date-40)::date,scheduled_on=current_date-39 where id=$3",[id(52),peer,t2]);
    const sourceSession=(await first("insert into task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values($1,$2,$3,clock_timestamp()-interval '39 days',$4) returning id",[org,t2,owner,sourceAbsence])).id;
    await db.query("update task_instances set checklist='[{\"id\":\"a\",\"done\":false},{\"id\":\"b\",\"done\":false}]' where id=$1",[t1]);
    await actor(owner);
    const call=rpc==='transition'
      ?await attempt("select transition_task_reviewed($1,'En curso',null,0,$2)",[t1,operation()])
      :await attempt("select set_checklist_item_reviewed($1,'a',true,null,0,$2)",[t1,operation()]);
    await db.exec('reset role');
    const state=await first("select e.details,(e.details->>'session')::uuid=s.id and (e.details->>'ended_at')::timestamptz=s.ended_at as exact,s.ended_at::text as destination_end,(select ended_at::text from task_time_sessions where id=$3) as source_end from audit_events e join task_time_sessions s on s.id=$2 where e.entity_id=$1 and e.action=$4",[t1,destination.session,sourceSession,rpc==='transition'?'task.transition':'task.checklist']);
    return {met:!call.error&&state?.exact===true,observed:{call,state}};
  });
}

await probe('unsealed_coverage_does_not_authorize','Ausencia no sellada no habilita lectura ni completar tareas como reemplazante',async()=>{
  await actor(boss,'aal2');await db.exec('reset role');
  const absence=(await first("insert into employee_absences(organization_id,owner_id,replacement_id,kind,starts_on,ends_on,note,approved_by,authorization_sealed) values($1,$2,$3,'licencia',current_date-1,current_date+1,'Sin sello',$4,false) returning id",[org,owner,peer,boss])).id;
  await db.query("insert into employee_absence_companies(absence_id,organization_id,company_id) values($1,$2,$3)",[absence,org,company]);
  await db.query("update task_instances set status='En curso',checklist='[]' where id=$1",[t1]);
  await actor(peer);const opId=operation();
  const visible=await first("select public.can_access_instance($1) as allowed,(select count(*)::int from task_instances where id=$1) as visible",[t1]);
  const call=await attempt("select transition_task_reviewed($1,'Completada',null,0,$2)",[t1,opId]);
  await db.exec('reset role');
  const state=await first("select status,state_revision::int as revision,(select count(*)::int from task_mutation_receipts where operation_id=$2) receipts from task_instances where id=$1",[t1,opId]);
  return {met:!visible.allowed&&visible.visible===0&&!!call.error&&state.status==='En curso'&&state.revision===0&&state.receipts===0,observed:{visible,call,state}};
});

await probe('helpers_and_direct_dml_denied','anon/authenticated sin helpers ni DML de tiempos',async()=>{
  const state=await first("select has_function_privilege('authenticated','public._session_cutoff(uuid)','execute') as helper_auth,has_function_privilege('anon','public._session_cutoff(uuid)','execute') as helper_anon,has_table_privilege('authenticated','public.task_time_sessions','insert,update,delete') as dml_auth,has_table_privilege('anon','public.task_time_sessions','insert,update,delete') as dml_anon");
  return {met:Object.values(state).every(v=>!v),observed:state};
});
for(const stage of ['202610010004_time_coverage.sql','202610010005_time_coverage_hardening.sql','202610010006_time_coverage_acceptance.sql','202610010007_time_coverage_completion.sql']) {
  await probe('populated_upgrade_'+stage.slice(9,12)+'_to_008','Upgrade poblado preserva historia sin exigir membresía actual',async()=>{
    const upgrade=new PGlite();
    try {
      await upgrade.exec(authSchema);
      const names=readdirSync(root).filter(f=>f.endsWith('.sql')).sort();
      for(const name of names.filter(f=>f<=stage)) await upgrade.exec(readFileSync(`${root}/${name}`,'utf8'));
      await upgrade.exec(seed);
      await upgrade.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{\"aal\":\"aal2\"}',false)",[boss]);
      const absence=(await upgrade.query("select approve_employee_absence($1,$2,'licencia',current_date-3,current_date+5,array[$3]::uuid[],'Historia compatible',$4) id",[owner,peer,company,operation()])).rows[0].id;
      await upgrade.query("insert into task_time_sessions(id,organization_id,instance_id,actor_id,started_at,ended_at,absence_id) values($1,$2,$3,$4,clock_timestamp()-interval '2 days',clock_timestamp()-interval '2 days'+interval '30 minutes',$5)",[id(80),org,t1,peer,absence]);
      await upgrade.query('delete from company_memberships where profile_id=$1',[peer]);
      await upgrade.query('update profiles set active=false where id=$1',[peer]);
      const audit=(await upgrade.query("insert into audit_events(organization_id,actor_id,action,entity_id,details) values($1,null,'task.transition',$2,'{\"from\":\"Completada\",\"to\":\"Pendiente\"}') returning id",[org,t1])).rows[0].id;
      await upgrade.query("insert into task_reopen_events(id,organization_id,instance_id,actor_id,reason,source,legacy_audit_id) values($1,$2,$3,null,'Historia','legacy_transition',$4)",[id(81),org,t1,audit]);
      await upgrade.query("insert into monthly_closures(id,organization_id,owner_id,period,snapshot,closed_by,note) values($1,$2,$3,date_trunc('month',current_date)::date-interval '1 month','{\"historical\":true,\"points\":5}',$4,'Historia')",[id(82),org,owner,boss]);
      await upgrade.query("insert into period_reports(id,organization_id,closure_id,owner_id,period,snapshot) select $1,organization_id,id,owner_id,period,snapshot from monthly_closures where id=$2",[id(83),id(82)]);
      await upgrade.query("insert into report_deliveries(id,organization_id,report_id,recipient_id,recipient_email) values($1,$2,$3,$4,'boss@test.invalid')",[id(84),org,id(83),boss]);
      await upgrade.query('insert into report_outbox_events(id,organization_id,delivery_id) values($1,$2,$3)',[id(85),org,id(84)]);
      const capture=async()=>{
        const data={};for(const table of ['task_time_sessions','task_instances','task_reopen_events','audit_events','report_deliveries','report_outbox_events','task_mutation_receipts']) data[table]=(await upgrade.query(`select * from ${table} order by ${table==='task_mutation_receipts'?'operation_id':'id'}`)).rows;
        for(const table of ['monthly_closures','period_reports']) data[table]=(await upgrade.query(`select id,snapshot::text from ${table} order by id`)).rows;
        data.absences=(await upgrade.query('select id,organization_id,owner_id,replacement_id,starts_on,ends_on,approved_at,cancelled_at from employee_absences order by id')).rows;
        return JSON.stringify(data);
      };
      const before=await capture();
      await upgrade.exec("select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims','{}',false)");
      for(const name of names.filter(f=>f>stage&&f<='202610010008_time_coverage_finalization.sql')) await upgrade.exec(readFileSync(`${root}/${name}`,'utf8'));
      const after=await capture();
      return {met:before===after,observed:{from:stage,preserved:before===after,removed_membership:true,suspended_replacement:true}};
    } finally {await upgrade.close();}
  });
}

// Inyección sintética en el helper del laboratorio, revertida por cada rollback.
// No demuestra una carrera entre conexiones ni expone helpers al cliente.
async function injectMonthGuard(sql) {
  const def=(await first("select pg_get_functiondef('public.lock_open_month(uuid,date)'::regprocedure) as definition")).definition;
  await db.exec(def.replace(/\bbegin\b/i, match => match+'\n'+sql+';\n'));
}
for(const rpc of ['start','checklist','transition','wait']) {
  await probe('target_identity_recheck_'+rpc,'Cambio sintético de período después de planificar rechaza y revierte',async()=>{
    const opId=operation();
    await injectMonthGuard(`update public.task_instances set period=period+interval '1 month',scheduled_on=scheduled_on+interval '1 month' where id='${t1}'`);
    await actor(owner);
    const calls={
      start:['select start_task_timer($1,0,$2,false)',[t1,opId]],
      checklist:["select set_checklist_item_reviewed($1,'b',true,null,0,$2)",[t1,opId]],
      transition:["select transition_task_reviewed($1,'En curso',null,0,$2)",[t1,opId]],
      wait:["select set_task_wait($1,'Espera',0,$2)",[t1,opId]]
    };
    const call=await attempt(...calls[rpc]);await db.exec('reset role');
    const state=await first("select period=date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date as original_period,state_revision::int revision,(select count(*)::int from task_mutation_receipts where operation_id=$2) receipts,(select count(*)::int from task_time_sessions) sessions from task_instances where id=$1",[t1,opId]);
    return {met:call.error?.includes('La identidad de la tarea cambió')&&state.original_period&&state.revision===0&&state.receipts===0&&state.sessions===0,observed:{injection:'synthetic helper, not concurrency',call,state}};
  });
}
for(const rpc of ['checklist','transition']) {
  await probe('recomputed_start_plan_'+rpc,'Inicio recalculado fuera del plan debe rechazar antes de escribir',async()=>{
    if(rpc==='checklist') {
      await db.query(`update task_instances set checklist='[{"id":"only","done":false}]' where id=$1`,[t1]);
      // Plan de resultado: el único control completa, sin iniciar reloj.
      await injectMonthGuard(`update public.task_instances set kind='operativa',target=10,unit='facturas' where id='${t1}'`);
    } else {
      await db.query("update task_instances set status='En curso' where id=$1",[t1]);
      // Plan de no-op: una escritura interna cambia estado sin incrementar revision.
      await injectMonthGuard(`update public.task_instances set status='Pendiente' where id='${t1}'`);
    }
    const before=await rows('select id,status,kind,state_revision from task_instances order by id');
    await actor(owner);const opId=operation();
    const call=rpc==='checklist'
      ?await attempt("select set_checklist_item_reviewed($1,'only',true,null,0,$2)",[t1,opId])
      :await attempt("select transition_task_reviewed($1,'En curso',null,0,$2)",[t1,opId]);
    await db.exec('reset role');
    const after=await rows('select id,status,kind,state_revision from task_instances order by id');
    const state=await first('select (select count(*)::int from task_time_sessions) sessions,(select count(*)::int from task_mutation_receipts where operation_id=$1) receipts',( [opId] ));
    return {met:!!call.error&&JSON.stringify(before)===JSON.stringify(after)&&state.sessions===0&&state.receipts===0,observed:{injection:'synthetic internal write without revision; not concurrency',call,before,after,state}};
  });
}
for(const rpc of ['wait','checklist','activity','start']) {
  await probe('unsealed_denies_'+rpc,'Cobertura sin sello niega RLS y cada escritura con clave nueva',async()=>{
    await actor(boss,'aal2');await db.exec('reset role');
    const absence=(await first("insert into employee_absences(organization_id,owner_id,replacement_id,kind,starts_on,ends_on,note,approved_by,authorization_sealed) values($1,$2,$3,'licencia',(now() at time zone 'America/Argentina/Buenos_Aires')::date-1,(now() at time zone 'America/Argentina/Buenos_Aires')::date+1,'Sin sello',$4,false) returning id",[org,owner,peer,boss])).id;
    await db.query('insert into employee_absence_companies values($1,$2,$3)',[absence,org,company]);
    await db.query("update task_instances set kind='operativa',target=40,unit='facturas' where id=$1",[t1]);
    await actor(peer);const opId=operation();
    const visible=await first('select can_access_instance($1) allowed,(select count(*)::int from task_instances where id=$1) visible',[t1]);
    const calls={wait:["select set_task_wait($1,'Espera',0,$2)",[t1,opId]],checklist:["select set_checklist_item_reviewed($1,'b',true,null,0,$2)",[t1,opId]],activity:["select record_activity_once($1,(now() at time zone 'America/Argentina/Buenos_Aires')::date,5,'Fixture',$2)",[t1,opId]],start:["select start_task_timer($1,0,$2,false)",[t1,opId]]};
    const call=await attempt(...calls[rpc]);await db.exec('reset role');
    const state=await first('select state_revision::int revision,(select count(*)::int from task_mutation_receipts where operation_id=$2) receipts,(select count(*)::int from activity_entries) activity,(select count(*)::int from task_time_sessions) sessions from task_instances where id=$1',[t1,opId]);
    return {met:!visible.allowed&&visible.visible===0&&call.error==='Sin permiso'&&state.revision===0&&state.receipts===0&&state.activity===0&&state.sessions===0,observed:{visible,call,state}};
  });
}
await probe('report_exact_nonzero_quantities','Cierre real calcula 1800 segundos, 18 facturas de 40 y snapshot/reporte/outbox únicos',async()=>{
  await actor(boss,'aal2');await db.exec('reset role');
  await db.query("update task_instances set kind='operativa',target=40,unit='facturas' where id=$1",[t1]);
  await db.query("update auth.users set email='boss@test.invalid',email_confirmed_at=now() where id=$1",[boss]);
  await db.query('insert into report_settings(organization_id,recipient_id,updated_by) values($1,$2,$2)',[org,boss]);
  await db.query("insert into task_time_sessions(organization_id,instance_id,actor_id,started_at,ended_at) select organization_id,id,$2,(period+interval '12 hours') at time zone 'America/Argentina/Buenos_Aires',(period+interval '12 hours 30 minutes') at time zone 'America/Argentina/Buenos_Aires' from task_instances where id=$1",[t1,owner]);
  await actor(owner);
  for(const quantity of [7,11]) await db.query("select record_activity_once($1,(now() at time zone 'America/Argentina/Buenos_Aires')::date,$2,'Facturas verificadas',$3)",[t1,quantity,operation()]);
  await actor(boss,'aal2');
  await db.query("select close_employee_month($1,date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date,'Cierre verificado')",[owner]);
  const snapshot=await first('select snapshot from period_reports where owner_id=$1',[owner]);
  await db.query("select close_employee_month($1,date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date,'Cierre repetido')",[owner]);
  await db.exec('reset role');
  const state=await first("select (select count(*)::int from monthly_closures) closures,(select count(*)::int from period_reports) reports,(select count(*)::int from report_deliveries) deliveries,(select count(*)::int from report_outbox_events) outbox,(select snapshot from period_reports where owner_id=$1) snapshot",[owner]);
  const operationalTask=state.snapshot.tasks.find(task=>task.id===t1);
  return {met:Number(state.snapshot.metrics.recordedSeconds)===1800&&operationalTask.quantity===18&&operationalTask.target===40&&state.snapshot.metrics.operational===1&&state.snapshot.metrics.operationalTarget===0&&state.closures===1&&state.reports===1&&state.deliveries===1&&state.outbox===1&&JSON.stringify(state.snapshot)===JSON.stringify(snapshot.snapshot),observed:state};
});

console.log(JSON.stringify({source_sha:sourceSha,review:'008',checks,contract_met:checks-violations,contract_violations:violations,acceptance:false,concurrency_tested:false}));
await db.close();
