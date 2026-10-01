import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

let db: PGlite;
const org="00000000-0000-0000-0000-000000000006";
const jefe="10000000-0000-0000-0000-000000000006";
const empleado="10000000-0000-0000-0000-000000000007";
const reemplazo="10000000-0000-0000-0000-000000000008";
const empresa="20000000-0000-0000-0000-000000000006";
const equipo="30000000-0000-0000-0000-000000000006";
async function actor(uid: string, aal="aal1") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({aal})]);
  await db.exec("set role authenticated");
}
async function makeTask(n: number, kind: string, checklist: string) {
  await db.exec("reset role");
  const serial=String(n).padStart(12,"0");
  const assignment="40000000-0000-0000-0000-"+serial;
  const instance="50000000-0000-0000-0000-"+serial;
  const op=kind==="operativa";
  await db.query("insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day) values($1,$2,$3,$4,$5,$6,$7,5,$8,$9,'mensual','2027-04-01',30)",[assignment,org,empresa,empleado,equipo,"Tarea "+n,kind,op?"facturas":null,op?10:null]);
  await db.query("insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,unit,target,due_date,checklist) values($1,$2,$3,$4,$5,$6,'2027-04-01',$7,$8,$9,5,$10,$11,$7,$12::jsonb)",[instance,org,assignment,empresa,empleado,equipo,"2027-04-0"+(n+1),"Tarea "+n,kind,op?"facturas":null,op?10:null,checklist]);
  return instance;
}
beforeAll(async()=>{
  db=new PGlite();
  await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;");
  const migrations=new URL("../supabase/migrations/",import.meta.url);
  for(const f of readdirSync(migrations).filter(x=>x.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(f,migrations),"utf8"));
  await db.query("insert into organizations values($1,'Contract')",[org]);
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'boss@test',now()),($2,'user@test',now())",[jefe,empleado]);
  await db.query("insert into profiles(id,organization_id,name,role,manager_id,sector,branch,position) values($1,$3,'Boss','jefe',null,'A','B','C'),($2,$3,'Employee','empleado',$1,'A','B','C')",[jefe,empleado,org]);
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'replacement@test',now())",[reemplazo]);
  await db.query("insert into profiles(id,organization_id,name,role,manager_id,sector,branch,position) values($1,$2,'Replacement','empleado',$3,'A','B','C')",[reemplazo,org,jefe]);
  await db.query("insert into companies values($1,$2,'Company')",[empresa,org]);
  await db.query("insert into teams values($1,$2,'Team',$3)",[equipo,org,jefe]);
  await db.query("insert into team_members values($1,$2,$3),($1,$2,$4)",[org,equipo,empleado,reemplazo]);
  await db.query("insert into company_memberships values($1,$2,$3),($1,$2,$4)",[org,empresa,empleado,reemplazo]);
  await db.query("insert into report_settings(organization_id,recipient_id,updated_by) values($1,$2,$2)",[org,jefe]);
});
afterAll(async()=>db?.close());

describe("Contrato 006 con fixture propio",()=>{
  it("ultimo control operativo conserva En curso e inicia cronometro",async()=>{
    const task=await makeTask(1,"operativa",'[{"id":"a","done":true},{"id":"b","done":false}]');
    await actor(empleado);
    await db.query("select set_checklist_item_reviewed($1,'b',true,null,0,$2)",[task,"90000000-0000-0000-0000-000000000601"]);
    expect((await db.query("select status,state_revision from task_instances where id=$1",[task])).rows[0]).toEqual({status:"En curso",state_revision:1});
    const session=(await db.query<{id:string}>("select id from task_time_sessions where instance_id=$1 and ended_at is null",[task])).rows[0].id;
    expect(session).toBeTruthy();
    await db.query("select pause_task_timer($1,$2)",[session,"90000000-0000-0000-0000-000000000699"]);
  });
  it("resultado con control unico completa sin iniciar reloj",async()=>{
    const task=await makeTask(2,"resultado",'[{"id":"a","done":false}]');
    await actor(empleado);
    await db.query("select set_checklist_item_reviewed($1,'a',true,null,0,$2)",[task,"90000000-0000-0000-0000-000000000602"]);
    expect((await db.query("select status,completed_at is not null as completed from task_instances where id=$1",[task])).rows[0]).toEqual({status:"Completada",completed:true});
    expect((await db.query("select * from task_time_sessions where instance_id=$1",[task])).rows).toHaveLength(0);
  });
  it("repetir la espera con reloj abierto finaliza la sesion y cambia revision",async()=>{
    const task=await makeTask(3,"resultado",'[{"id":"a","done":false}]');
    await actor(empleado);
    await db.query("select start_task_timer($1,0,$2,false)",[task,"90000000-0000-0000-0000-000000000603"]);
    await db.exec("reset role");
    await db.query("update task_instances set blocked_by='Documentación',blocked_since='2027-04-04' where id=$1",[task]);
    await actor(empleado);
    await db.query("select set_task_wait($1,'Documentación',1,$2)",[task,"90000000-0000-0000-0000-000000000604"]);
    expect((await db.query<{state_revision:number}>("select state_revision from task_instances where id=$1",[task])).rows[0].state_revision).toBe(2);
    expect((await db.query<{ended:boolean}>("select ended_at is not null as ended from task_time_sessions where instance_id=$1",[task])).rows[0].ended).toBe(true);
  });
  it("rechaza nuevas sesiones vinculadas con ausencia cancelada",async()=>{
    const task=await makeTask(4,"resultado",'[{"id":"a","done":false}]');
    await actor(jefe,"aal2");
    const absence=(await db.query<{id:string}>("select approve_employee_absence($1,$2,'licencia','2027-04-05','2027-04-06',array[$3]::uuid[],'Prueba',$4) as id",[empleado,reemplazo,empresa,"90000000-0000-0000-0000-000000000605"])).rows[0].id;
    await db.query("select cancel_employee_absence($1,'Prueba',$2)",[absence,"90000000-0000-0000-0000-000000000606"]);
    await db.exec("reset role");
    await expect(db.query("insert into task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values($1,$2,$3,'2027-04-05 12:00+00',$4)",[org,task,reemplazo,absence])).rejects.toThrow("cancelada");
  });
  it("limpia el reloj propio vencido antes de iniciar otra tarea y deja auditoría efectiva",async()=>{
    const source=await makeTask(5,"resultado",'[]');
    const destination=await makeTask(6,"resultado",'[]');
    await db.exec("reset role");
    await db.query("update profiles set role='encargado' where id=$1",[reemplazo]);
    await db.query("update profiles set manager_id=$1 where id=$2",[reemplazo,empleado]);
    const absence=(await db.query<{id:string}>("select approve_employee_absence($1,$2,'licencia','2025-04-05','2025-04-06',array[$3]::uuid[],'Cobertura vencida',$4) as id",[empleado,reemplazo,empresa,"90000000-0000-0000-0000-000000000607"])).rows[0].id;
    await db.exec("reset role");
    await db.query("update task_instances set period='2025-04-01',scheduled_on='2025-04-05',due_date='2025-04-30' where id=$1",[source]);
    await db.query("update task_instances set period='2025-05-01',scheduled_on='2025-05-05',due_date='2025-05-30' where id=$1",[destination]);
    const session=(await db.query<{id:string}>("insert into task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values($1,$2,$3,'2025-04-05 12:00+00',$4) returning id",[org,source,reemplazo,absence])).rows[0].id;
    await actor(reemplazo);
    await db.query("select start_task_timer($1,0,$2,false)",[destination,"90000000-0000-0000-0000-000000000608"]);
    await db.exec("reset role");
    const ended=(await db.query<{ended_at:string;revision:number}>("select s.ended_at::text,t.state_revision as revision from task_time_sessions s join task_instances t on t.id=s.instance_id where s.id=$1",[session])).rows[0];
    expect(new Date(ended.ended_at).toISOString()).toBe("2025-04-07T03:00:00.000Z");
    expect(ended.revision).toBe(1);
    const audit=(await db.query<{at:string;details:{started_at:string;ended_at:string;absence:string;executor:string;instance:string}}>("select at::text,details from audit_events where action='task.timer_expired' and entity_id=$1",[session])).rows[0];
    expect(audit.details).toMatchObject({absence,executor:reemplazo,instance:source,ended_at:audit.details.ended_at});
    expect(audit.at).toBeTruthy();
    await db.query("update profiles set role='empleado' where id=$1",[reemplazo]);
    await db.query("update profiles set manager_id=$1 where id=$2",[jefe,empleado]);
    await actor(reemplazo);
    const open=(await db.query<{id:string}>("select id from task_time_sessions where instance_id=$1 and ended_at is null",[destination])).rows;
    expect(open).toHaveLength(1);
    await db.query("select pause_task_timer($1,$2)",[open[0].id,"90000000-0000-0000-0000-000000000609"]);
  });
});
