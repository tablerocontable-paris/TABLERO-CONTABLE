import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

// PGlite defaults unparameterized query rows to unknown; assertions below validate these synthetic SQL results.
let db: any;
const org="00000000-0000-0000-0000-000000000007";
const boss="10000000-0000-0000-0000-000000000007";
const owner="10000000-0000-0000-0000-000000000017";
const peer="10000000-0000-0000-0000-000000000027";
const company="20000000-0000-0000-0000-000000000007";
const team="30000000-0000-0000-0000-000000000007";
async function actor(uid:string,aal="aal1") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[uid,JSON.stringify({aal})]);
  await db.exec("set role authenticated");
}
async function admin(){await db.exec("reset role");}
let serial=700, op=700;
const uuid=(n:number)=>"90000000-0000-0000-0000-"+String(n).padStart(12,"0");
async function task(opts:{kind?:string;period?:string;checklist?:string}={}) {
  const n=++serial,assignment=uuid(n),instance=uuid(n+1000),kind=opts.kind??"resultado";
  const period=opts.period??"2027-04-01",checklist=opts.checklist??"[]";
  await admin();
  await db.query("insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day) values($1,$2,$3,$4,$5,$6,$7,5,'mensual','2027-04-01',30)",[assignment,org,company,owner,team,"Tarea "+n,kind]);
  await db.query("insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,checklist) values($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,5,$7,$10::jsonb)",[instance,org,assignment,company,owner,team,period,"Tarea "+n,kind,checklist]);
  return instance;
}
async function approve(taskId:string,starts?:string,ends?:string) {
  if(!starts){const month=String((op%12)+1).padStart(2,"0"); starts="2025-"+month+"-01"; ends="2025-"+month+"-02";}
  await actor(boss,"aal2");
  return (await db.query("select approve_employee_absence($1,$2,'licencia',$3,$4,array[$5]::uuid[],'Prueba 007',$6) id",[owner,peer,starts,ends,company,uuid(++op)])).rows[0].id;
}
async function session(taskId:string,actorId=peer,started="2025-04-01 12:00:00+00",absence:string|null=null,ended:string|null=null) {
  await admin();
  return (await db.query("insert into task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id,ended_at) values($1,$2,$3,$4,$5,$6) returning id",[org,taskId,actorId,started,absence,ended])).rows[0].id;
}
beforeAll(async()=>{
  db=new PGlite();
  await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;");
  const migrations=new URL("../supabase/migrations/",import.meta.url);
  // Pin this suite to the migration version it accepted. 009–011 have
  // independent upgrade/activation coverage and must not alter old evidence.
  for(const f of readdirSync(migrations).filter(x=>x.endsWith(".sql") && x < "202610020009_private_block_notes.sql").sort()) await db.exec(readFileSync(new URL(f,migrations),"utf8"));
  await db.query("insert into organizations values($1,'Contract 007')",[org]);
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'boss@test',now()),($2,'owner@test',now()),($3,'peer@test',now())",[boss,owner,peer]);
  await db.query("insert into profiles(id,organization_id,name,role,manager_id,sector,branch,position) values($1,$4,'Boss','jefe',null,'A','B','C'),($2,$4,'Owner','empleado',$1,'A','B','C'),($3,$4,'Peer','empleado',$1,'A','B','C')",[boss,owner,peer,org]);
  await db.query("insert into companies values($1,$2,'Company')",[company,org]);
  await db.query("insert into teams values($1,$2,'Team',$3)",[team,org,boss]);
  await db.query("insert into team_members values($1,$2,$3),($1,$2,$4)",[org,team,owner,peer]);
  await db.query("insert into company_memberships values($1,$2,$3),($1,$2,$4)",[org,company,owner,peer]);
  await db.query("insert into report_settings(organization_id,recipient_id,updated_by) values($1,$2,$2)",[org,boss]);
});
afterAll(async()=>db?.close());
afterEach(async()=>{await admin();await db.exec("update task_time_sessions set ended_at=greatest(clock_timestamp(),started_at) where ended_at is null");await db.exec("reset role");});

describe("Aceptación 007: espera, pausa, ausencias y reporte",()=>{
  it("desbloquear una tarea ya libre es no-op con receipt sin revisión ni auditoría",async()=>{
    const id=await task(); await actor(owner);
    const opId=uuid(++op);
    await db.query("select set_task_wait($1,null,0,$2)",[id,opId]);
    await db.query("select set_task_wait($1,null,0,$2)",[id,opId]);
    await admin();
    expect((await db.query("select state_revision,blocked_by from task_instances where id=$1",[id])).rows[0]).toEqual({state_revision:0,blocked_by:null});
    expect((await db.query("select count(*)::int n from audit_events where entity_id=$1 and action='task.wait_cleared'",[id])).rows[0].n).toBe(0);
    expect((await db.query("select count(*)::int n from task_mutation_receipts where actor_id=$1 and operation_id=$2",[owner,opId])).rows[0].n).toBe(1);
  });
  it("desbloquear conserva el reloj propio y audita sólo el desbloqueo",async()=>{
    const id=await task(); await actor(owner);
    await db.query("select start_task_timer($1,0,$2,false)",[id,uuid(++op)]);
    await admin(); await db.query("update task_instances set blocked_by='Banco',blocked_since='2027-04-01' where id=$1",[id]);
    await actor(owner); await db.query("select set_task_wait($1,null,1,$2)",[id,uuid(++op)]);
    const row=(await db.query("select t.blocked_by,t.blocked_since,t.state_revision,s.ended_at is null active from task_instances t join task_time_sessions s on s.instance_id=t.id where t.id=$1",[id])).rows[0];
    expect(row).toEqual({blocked_by:null,blocked_since:null,state_revision:2,active:true});
    await admin(); const audit=(await db.query("select action,at from audit_events where entity_id=$1 and action='task.wait_cleared'",[id])).rows[0];
    expect(audit.action).toBe("task.wait_cleared"); expect(audit.at).toBeTruthy();
  });
  it("desbloquear no detiene un reloj ajeno ni requiere MFA",async()=>{
    const id=await task(); await admin(); await db.query("update task_instances set blocked_by='Banco',blocked_since='2027-04-01' where id=$1",[id]);
    const sessionId=await session(id,peer,"2027-04-01 12:00:00+00",null);
    await actor(owner); await db.query("select set_task_wait($1,null,0,$2)",[id,uuid(++op)]);
    const open=(await db.query("select ended_at from task_time_sessions where id=$1",[sessionId])).rows[0].ended_at;
    expect(open).toBeNull();
  });
  it("pausar una sesión ya terminada devuelve receipt aunque el mes cerró",async()=>{
    const id=await task({period:"2026-08-01"}),sessionId=await session(id,owner,"2026-08-10 12:00:00+00",null,"2026-08-10 12:30:00+00");
    await admin(); await db.query("insert into monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values($1,$2,'2026-08-01','{}',$3,'prueba')",[org,owner,boss]);
    await actor(owner);
    const ended=(await db.query("select pause_task_timer($1,$2) ended",[sessionId,uuid(++op)])).rows[0].ended;
    expect(new Date(ended).toISOString()).toBe("2026-08-10T12:30:00.000Z");
    await admin();
    expect((await db.query("select count(*)::int n from task_mutation_receipts where operation_id=$1",[uuid(op)])).rows[0].n).toBe(1);
  });
  it("la pausa ordinaria deja auditoría completa con el corte guardado",async()=>{
    const id=await task(); await actor(owner);
    const sessionId=(await db.query("select start_task_timer($1,0,$2,false) id",[id,uuid(++op)])).rows[0].id;
    await db.query("select pause_task_timer($1,$2)",[sessionId,uuid(++op)]);
    await admin();
    const row=(await db.query("select e.action,e.at,e.details,s.started_at,s.ended_at from audit_events e join task_time_sessions s on s.id=e.entity_id where e.entity_id=$1 and e.action='task.timer_paused'",[sessionId])).rows[0];
    expect(row.action).toBe("task.timer_paused"); expect(row.at).toBeTruthy();
    expect(row.details).toMatchObject({instance:id,executor:owner,session:sessionId,absence:null});
    expect(new Date(row.details.started_at).toISOString()).toBe(new Date(row.started_at).toISOString());
    expect(new Date(row.details.ended_at).toISOString()).toBe(new Date(row.ended_at).toISOString());
  });
  it("la identidad de ausencia protege UUID y approved_at",async()=>{
    const id=await task(),absence=await approve(id); await admin();
    await expect(db.query("update employee_absences set approved_at=approved_at+interval '1 second' where id=$1",[absence])).rejects.toThrow("inmutable");
    await expect(db.query("update employee_absences set id=$2 where id=$1",[absence,uuid(++serial)])).rejects.toThrow("inmutable");
  });
  it("el sello impide agregar o reescribir empresas autorizadas",async()=>{
    const id=await task(),absence=await approve(id);
    const otherCompany=uuid(++serial); await admin();
    await db.query("insert into companies(id,organization_id,name) values($1,$2,'Otra empresa')",[otherCompany,org]);
    await expect(db.query("insert into employee_absence_companies(absence_id,organization_id,company_id) values($1,$2,$3)",[absence,org,otherCompany])).rejects.toThrow("sellada");
    await expect(db.query("update employee_absence_companies set company_id=$2 where absence_id=$1",[absence,otherCompany])).rejects.toThrow("inmutables");
    await expect(db.query("delete from employee_absence_companies where absence_id=$1",[absence])).rejects.toThrow("inmutables");
  });
  it("aprobación usa un instante idéntico al evento",async()=>{
    const id=await task(),absence=await approve(id); await admin();
    const row=(await db.query("select a.approved_at=e.at same from employee_absences a join audit_events e on e.entity_id=a.id and e.action='absence.approved' where a.id=$1",[absence])).rows[0];
    expect(row.same).toBe(true);
  });
  it("cancelación repetida con clave nueva conserva sesión, revisión y auditoría",async()=>{
    const id=await task({period:"2026-10-01"}),absence=await approve(id,"2026-10-01","2026-10-05");
    const sessionId=await session(id,peer,"2026-10-01 12:00:00+00",absence,null);
    await actor(boss,"aal2"); await db.query("select cancel_employee_absence($1,'fin de cobertura',$2)",[absence,uuid(++op)]);
    const before=(await db.query("select a.cancelled_at,t.state_revision,s.ended_at from employee_absences a join task_instances t on t.id=$2 join task_time_sessions s on s.id=$3 where a.id=$1",[absence,id,sessionId])).rows[0];
    const events=(await db.query("select count(*)::int n from audit_events where action in ('absence.cancelled','absence.session_stopped') and (entity_id=$1 or details->>'session'=$2)",[absence,sessionId])).rows[0].n;
    await db.query("select cancel_employee_absence($1,'motivo repetido',$2)",[absence,uuid(++op)]);
    const after=(await db.query("select a.cancelled_at,t.state_revision,s.ended_at from employee_absences a join task_instances t on t.id=$2 join task_time_sessions s on s.id=$3 where a.id=$1",[absence,id,sessionId])).rows[0];
    const eventsAfter=(await db.query("select count(*)::int n from audit_events where action in ('absence.cancelled','absence.session_stopped') and (entity_id=$1 or details->>'session'=$2)",[absence,sessionId])).rows[0].n;
    expect(after).toEqual(before); expect(eventsAfter).toBe(events);
    await admin(); const cancelAudit=(await db.query("select e.at,a.cancelled_at,e.at=a.cancelled_at same from audit_events e join employee_absences a on a.id=e.entity_id where e.action='absence.cancelled' and a.id=$1",[absence])).rows[0];
    expect(cancelAudit.same).toBe(true);
  });
  it("una espera igual limpia cobertura vencida y audita espera y expiración",async()=>{
    const id=await task({period:"2025-04-01"}),absence=await approve(id,"2025-04-01","2025-04-02");
    const sessionId=await session(id,peer,"2025-04-01 12:00:00+00",absence,null);
    await admin(); await db.query("update task_instances set blocked_by='Esperando',blocked_since='2025-04-01' where id=$1",[id]);
    await actor(owner); await db.query("select set_task_wait($1,'Esperando',0,$2)",[id,uuid(++op)]);
    await admin();
    const state=(await db.query("select t.state_revision,s.ended_at from task_instances t join task_time_sessions s on s.instance_id=t.id where t.id=$1",[id])).rows[0];
    expect(state.state_revision).toBe(1); expect(new Date(state.ended_at).toISOString()).toBe("2025-04-03T03:00:00.000Z");
    expect((await db.query("select count(*)::int n from audit_events where (entity_id=$1 or details->>'instance'=$1::text) and action in ('task.timer_expired','task.wait')",[id])).rows[0].n).toBe(2);
  });
  it("pausar una cobertura vencida audita el corte como expiración",async()=>{
    const id=await task({period:"2025-07-01"}),absence=await approve(id,"2025-07-01","2025-07-02");
    const sessionId=await session(id,peer,"2025-07-01 12:00:00+00",absence,null);
    await actor(peer);
    const ended=(await db.query("select pause_task_timer($1,$2) ended",[sessionId,uuid(++op)])).rows[0].ended;
    await admin();
    expect(new Date(ended).toISOString()).toBe("2025-07-03T03:00:00.000Z");
    expect((await db.query("select action,details from audit_events where entity_id=$1 and action='task.timer_expired'",[sessionId])).rows[0].details).toMatchObject({session:sessionId,executor:peer,instance:id,absence});
    expect((await db.query("select count(*)::int n from audit_events where entity_id=$1 and action='task.timer_paused'",[sessionId])).rows[0].n).toBe(0);
  });
  it("transición limpia destino vencido antes de iniciar el reloj propio",async()=>{
    const id=await task({period:"2025-05-01"}),absence=await approve(id,"2025-05-01","2025-05-02");
    const oldSession=await session(id,peer,"2025-05-01 12:00:00+00",absence,null);
    await actor(owner); await db.query("select transition_task_reviewed($1,'En curso',null,0,$2)",[id,uuid(++op)]);
    await admin();
    const sessions=(await db.query("select actor_id,ended_at from task_time_sessions where instance_id=$1 order by started_at",[id])).rows;
    expect(sessions).toHaveLength(2); expect(sessions[0].actor_id).toBe(peer); expect(sessions[0].ended_at).toBeTruthy();
    expect(sessions[1].actor_id).toBe(owner); expect(sessions[1].ended_at).toBeNull();
    const audit=(await db.query("select details from audit_events where action='task.timer_expired' and entity_id=$1",[oldSession])).rows[0];
    expect(audit.details).toMatchObject({instance:id,session:oldSession,executor:peer,absence});
  });
  it("checklist de resultado limpia un destino vencido y conserva contexto de auditoría",async()=>{
    const id=await task({period:"2025-06-01",checklist:'[{"id":"control","done":false}]'}),absence=await approve(id,"2025-06-01","2025-06-02");
    const oldSession=await session(id,peer,"2025-06-01 12:00:00+00",absence,null);
    await actor(owner); await db.query("select set_checklist_item_reviewed($1,'control',true,null,0,$2)",[id,uuid(++op)]);
    await admin();
    const state=(await db.query("select status,state_revision from task_instances where id=$1",[id])).rows[0];
    expect(state).toEqual({status:"Completada",state_revision:1});
    const audit=(await db.query("select details from audit_events where action='task.checklist' and entity_id=$1",[id])).rows[0];
    expect(audit.details).toMatchObject({executor:peer,session:oldSession,absence});
    expect(new Date(audit.details.started_at).toISOString()).toBe("2025-06-01T12:00:00.000Z");
  });
  it("completar destino no depende del reloj propio en un mes cerrado",async()=>{
    const source=await task({period:"2026-09-01"}),target=await task({period:"2026-10-01",checklist:'[{"id":"control","done":true}]'});
    await admin();
    await db.query("insert into monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values($1,$2,'2026-09-01','{}',$3,'guard') on conflict(owner_id,period) do nothing",[org,owner,boss]);
    await db.query("insert into task_time_sessions(organization_id,instance_id,actor_id,started_at) values($1,$2,$3,'2026-09-10 12:00:00+00')",[org,source,owner]);
    await db.query("update task_instances set status='En curso',started_at='2026-10-01 12:00:00+00' where id=$1",[target]);
    await actor(owner); await db.query("select transition_task_reviewed($1,'Completada',null,0,$2)",[target,uuid(++op)]);
    await admin();
    expect((await db.query("select status,state_revision from task_instances where id=$1",[target])).rows[0]).toEqual({status:"Completada",state_revision:1});
    expect((await db.query("select ended_at from task_time_sessions where instance_id=$1",[source])).rows[0].ended_at).toBeNull();
  });
  it("completar último control tampoco bloquea por el reloj propio en mes cerrado",async()=>{
    const source=await task({period:"2026-09-01"}),target=await task({period:"2026-10-01",checklist:'[{"id":"control","done":false}]'});
    await admin();
    await db.query("insert into monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values($1,$2,'2026-09-01','{}',$3,'guard') on conflict(owner_id,period) do nothing",[org,owner,boss]);
    await db.query("insert into task_time_sessions(organization_id,instance_id,actor_id,started_at) values($1,$2,$3,'2026-09-10 12:00:00+00')",[org,source,owner]);
    await actor(owner); await db.query("select set_checklist_item_reviewed($1,'control',true,null,0,$2)",[target,uuid(++op)]);
    await admin();
    expect((await db.query("select status,state_revision from task_instances where id=$1",[target])).rows[0]).toEqual({status:"Completada",state_revision:1});
    expect((await db.query("select ended_at from task_time_sessions where instance_id=$1",[source])).rows[0].ended_at).toBeNull();
  });
  it("cierre suma exactamente 1800 segundos y reintento no duplica entregas",async()=>{
    const id=await task({period:"2026-07-01"});
    await session(id,owner,"2026-07-10 12:00:00+00",null,"2026-07-10 12:30:00+00");
    await actor(boss,"aal2");
    const closure=(await db.query("select close_employee_month($1,'2026-07-01','revisión 007') id",[owner])).rows[0].id;
    await db.query("select close_employee_month($1,'2026-07-01','repetición')",[owner]);
    await admin();
    const metrics=(await db.query("select snapshot->'metrics'->>'recordedSeconds' seconds from monthly_closures where id=$1",[closure])).rows[0].seconds;
    expect(Number(metrics)).toBe(1800);
    expect((await db.query("select count(*)::int n from report_deliveries where report_id in(select id from period_reports where closure_id=$1)",[closure])).rows[0].n).toBe(1);
    expect((await db.query("select count(*)::int n from report_outbox_events where delivery_id in(select id from report_deliveries where report_id in(select id from period_reports where closure_id=$1))",[closure])).rows[0].n).toBe(1);
  });
});
