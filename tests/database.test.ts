import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
let db: PGlite;
const ids = {
  org: "00000000-0000-0000-0000-000000000001",
  other: "00000000-0000-0000-0000-000000000002",
  boss: "10000000-0000-0000-0000-000000000001",
  manager: "10000000-0000-0000-0000-000000000002",
  employee: "10000000-0000-0000-0000-000000000003",
  outsider: "10000000-0000-0000-0000-000000000004",
  c: "20000000-0000-0000-0000-000000000001",
  c2: "20000000-0000-0000-0000-000000000002",
  c3: "20000000-0000-0000-0000-000000000003",
  team: "30000000-0000-0000-0000-000000000001",
  a: "40000000-0000-0000-0000-000000000001",
  t: "50000000-0000-0000-0000-000000000001",
  tpl: "70000000-0000-0000-0000-000000000001",
};
async function actor(uid: string, aal = "aal1") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ aal })]);
  await db.exec("set role authenticated");
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  for (const f of readdirSync(
    new URL("../supabase/migrations/", import.meta.url),
  ).sort())
    await db.exec(
      readFileSync(
        new URL("../supabase/migrations/" + f, import.meta.url),
        "utf8",
      ),
    );
  await db.exec(
    `insert into organizations values('${ids.org}','Test'),('${ids.other}','Other');insert into auth.users(id) values('${ids.boss}'),('${ids.manager}'),('${ids.employee}'),('${ids.outsider}');insert into profiles(id,organization_id,name,role,manager_id,sector,branch,position) values('${ids.boss}','${ids.org}','Boss','jefe',null,'A','B','C'),('${ids.manager}','${ids.org}','Manager','encargado','${ids.boss}','A','B','C'),('${ids.employee}','${ids.org}','Employee','empleado','${ids.manager}','A','B','C'),('${ids.outsider}','${ids.other}','Other','jefe',null,'A','B','C');insert into companies values('${ids.c}','${ids.org}','Empresa');insert into teams values('${ids.team}','${ids.org}','Team','${ids.manager}');insert into team_members values('${ids.org}','${ids.team}','${ids.employee}');insert into company_memberships values('${ids.org}','${ids.c}','${ids.employee}'),('${ids.org}','${ids.c}','${ids.manager}');insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day) values('${ids.a}','${ids.org}','${ids.c}','${ids.employee}','${ids.team}','Conciliación','resultado',5,'mensual','2026-09-01',30);insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date) values('${ids.t}','${ids.org}','${ids.a}','${ids.c}','${ids.employee}','${ids.team}','2026-09-01','2026-09-30','Conciliación','resultado',5,'2026-09-30');`,
  );
  await db.exec(`update auth.users set email='boss@example.test',email_confirmed_at=now() where id='${ids.boss}';insert into report_settings(organization_id,recipient_id,updated_by) values('${ids.org}','${ids.boss}','${ids.boss}');`);
}, 20000);
afterAll(async () => db?.close());
describe("base nueva desde cero y RLS", () => {
  it("empleado ve su tarea y no puede cambiar pesos ni su rol", async () => {
    await actor(ids.employee);
    expect((await db.query("select * from task_instances")).rows).toHaveLength(
      1,
    );
    await expect(
      db.exec("update task_instances set weight=100"),
    ).rejects.toThrow();
    await expect(db.exec("update profiles set role='jefe'")).rejects.toThrow();
  });
  it("encargado ve el ámbito asignado", async () => {
    await actor(ids.manager);
    expect((await db.query("select * from task_instances")).rows).toHaveLength(
      1,
    );
  });
  it("otro tenant no ve ni modifica", async () => {
    await actor(ids.outsider);
    expect((await db.query("select * from task_instances")).rows).toHaveLength(
      0,
    );
    await expect(
      db.query("select transition_task($1,'En curso')", [ids.t]),
    ).rejects.toThrow("Sin permiso");
  });
  it("transición valida pendiente y escribe auditoría", async () => {
    await actor(ids.employee);
    await expect(
      db.query("select transition_task($1,'Completada')", [ids.t]),
    ).rejects.toThrow();
    await db.query("select transition_task($1,'En curso')", [ids.t]);
    await db.query("select transition_task($1,'Completada')", [ids.t]);
    expect(
      (await db.query<{ status: string }>("select status from task_instances"))
        .rows[0].status,
    ).toBe("Completada");
    await actor(ids.boss, "aal2");
    expect((await db.query("select * from audit_events")).rows).toHaveLength(2);
  });
  it("checklist mueve y reabre automáticamente", async () => {
    await db.exec("reset role");
    await db.query(
      `update task_instances set checklist='[{"id":"step","text":"Control","done":false}]',status='En curso',completed_at=null,state_revision=0 where id=$1`,
      [ids.t],
    );
    await actor(ids.employee);
    await db.query("select set_checklist_item($1,$2,true)", [ids.t, "step"]);
    expect(
      (await db.query<{ status: string }>("select status from task_instances"))
        .rows[0].status,
    ).toBe("Completada");
    await expect(db.query("select set_checklist_item($1,$2,false)", [ids.t, "step"])).rejects.toThrow("motivo");
    await db.query("select set_checklist_item_reviewed($1,$2,false,'Control omitido deliberadamente',1,$3)", [ids.t, "step", "90000000-0000-0000-0000-000000000001"]);
    expect(
      (await db.query<{ status: string }>("select status from task_instances"))
        .rows[0].status,
    ).toBe("En curso");
    await expect(db.exec("update task_reopen_events set reason='alterado'" )).rejects.toThrow();
    await expect(
      db.query("select set_checklist_item($1,$2,true)", [ids.t, "missing"]),
    ).rejects.toThrow("Paso inválido");
  });
  it("materializa sin duplicar y ajusta el día de febrero", async () => {
    await actor(ids.employee);
    expect(
      (
        await db.query<{ materialize_month: number }>(
          "select materialize_month($1,'2027-02-01')",
          [ids.employee],
        )
      ).rows[0].materialize_month,
    ).toBe(1);
    expect(
      (
        await db.query<{ materialize_month: number }>(
          "select materialize_month($1,'2027-02-01')",
          [ids.employee],
        )
      ).rows[0].materialize_month,
    ).toBe(0);
    expect(
      (
        await db.query<{ due_date: string }>(
          "select due_date::text from task_instances where period='2027-02-01'",
        )
      ).rows[0].due_date,
    ).toBe("2027-02-28");
  });
  it("cierre exige responsable con MFA y conserva snapshot servidor", async () => {
    await actor(ids.employee);
    await expect(
      db.query("select close_employee_month($1,'2026-09-01','Revisado')", [
        ids.employee,
      ]),
    ).rejects.toThrow("MFA");
    await actor(ids.manager);
    await expect(
      db.query("select close_employee_month($1,'2026-09-01','Revisado')", [
        ids.employee,
      ]),
    ).rejects.toThrow("MFA");
    await db.exec(
      `reset role;select set_config('request.jwt.claims','{"aal":"aal2"}',false);set role authenticated;`,
    );
    await db.query("select close_employee_month($1,'2026-09-01','Revisado')", [
      ids.employee,
    ]);
    const snapshot = (
      await db.query<{
        snapshot: { tasks: unknown[]; metrics: { points: number } };
      }>("select snapshot from monthly_closures")
    ).rows[0].snapshot;
    expect(snapshot.tasks).toHaveLength(1);
    expect(snapshot.metrics.points).toBe(5);
    const repeated = await db.query("select close_employee_month($1,'2026-09-01','Revisado')", [ids.employee]);
    expect(repeated.rows).toHaveLength(1);
    expect((await db.query("select * from period_reports")).rows).toHaveLength(1);
  });
  it("cierre impide cambios posteriores", async () => {
    await db.exec("reset role");
    await actor(ids.employee);
    await expect(
      db.query("select transition_task($1,'En curso')", [ids.t]),
    ).rejects.toThrow("El mes está cerrado");
  });
  it("el cronómetro es idempotente, versiona el estado y bloquea otro reloj simultáneo", async () => {
    const timed = "50000000-0000-0000-0000-000000000201";
    const timedOther = "50000000-0000-0000-0000-000000000202";
    await db.exec("reset role");
    await db.query(
      "insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date) values($1,$2,$3,$4,$5,$6,'2026-10-01','2026-10-02','Reloj idempotente','resultado',5,'2026-10-31'),($7,$2,$3,$4,$5,$6,'2026-10-01','2026-10-03','Segundo reloj','resultado',5,'2026-10-31')",
      [timed, ids.org, ids.a, ids.c, ids.employee, ids.team, timedOther],
    );
    await actor(ids.employee);
    const op = "90000000-0000-0000-0000-000000000201";
    const session = (await db.query<{ start_task_timer: string }>(
      "select start_task_timer($1,0,$2,false)", [timed, op],
    )).rows[0].start_task_timer;
    const retry = (await db.query<{ start_task_timer: string }>(
      "select start_task_timer($1,0,$2,false)", [timed, op],
    )).rows[0].start_task_timer;
    expect(retry).toBe(session);
    expect((await db.query<{ state_revision: number; status: string }>("select state_revision,status from task_instances where id=$1", [timed])).rows[0]).toMatchObject({ state_revision: 1, status: "En curso" });
    await expect(db.query("select start_task_timer($1,0,$2,false)", [timedOther, "90000000-0000-0000-0000-000000000202"])).rejects.toThrow("cronómetro actual");
    await expect(db.query("select start_task_timer($1,0,$2,false)", [timedOther, op])).rejects.toThrow("reutilizado");
    const pause = "90000000-0000-0000-0000-000000000203";
    const ended = (await db.query<{ pause_task_timer: string }>("select pause_task_timer($1,$2)", [session, pause])).rows[0].pause_task_timer;
    await db.query("select pause_task_timer($1,$2)", [session, pause]);
    expect((await db.query<{ ended_at: string | null }>("select ended_at::text from task_time_sessions where id=$1", [session])).rows[0].ended_at).not.toBeNull();
    expect((await db.query<{ state_revision: number }>("select state_revision from task_instances where id=$1", [timed])).rows[0].state_revision).toBe(2);
  });
  it("rechaza revisiones y switch nulos y conserva el recibo de un inicio no-op", async () => {
    const task = "50000000-0000-0000-0000-000000000211";
    await db.exec("reset role");
    await db.query("insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date) values($1,$2,$3,$4,$5,$6,'2026-11-01','2026-11-02','Receipts','resultado',5,'2026-11-30')", [task,ids.org,ids.a,ids.c,ids.employee,ids.team]);
    await actor(ids.employee);
    await expect(db.query("select start_task_timer($1,null,$2,false)",[task,"90000000-0000-0000-0000-000000000211"])).rejects.toThrow("revisión");
    await expect(db.query("select start_task_timer($1,0,$2,null)",[task,"90000000-0000-0000-0000-000000000212"])).rejects.toThrow("revisión");
    const first="90000000-0000-0000-0000-000000000213",noop="90000000-0000-0000-0000-000000000214",pause="90000000-0000-0000-0000-000000000215";
    const session=(await db.query<{start_task_timer:string}>("select start_task_timer($1,0,$2,false)",[task,first])).rows[0].start_task_timer;
    expect((await db.query<{start_task_timer:string}>("select start_task_timer($1,1,$2,false)",[task,noop])).rows[0].start_task_timer).toBe(session);
    await db.query("select pause_task_timer($1,$2)",[session,pause]);
    expect((await db.query<{start_task_timer:string}>("select start_task_timer($1,1,$2,false)",[task,noop])).rows[0].start_task_timer).toBe(session);
    expect((await db.query<{ended_at:string|null}>("select ended_at::text from task_time_sessions where id=$1",[session])).rows[0].ended_at).not.toBeNull();
  });
  it("solo permite pausar al suspendido, protege el mes cerrado y bloquea inicio en espera", async () => {
    const closed="50000000-0000-0000-0000-000000000221",blocked="50000000-0000-0000-0000-000000000222",suspendedTask="50000000-0000-0000-0000-000000000223";
    await db.exec("reset role");
    await db.query("insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,checklist) values($1,$2,$3,$4,$5,$6,'2026-11-01','2026-11-04','Espera','resultado',5,'2026-11-30','[{\"id\":\"step\",\"done\":false}]')",[blocked,ids.org,ids.a,ids.c,ids.employee,ids.team]);
    const session=(await db.query<{id:string}>("insert into task_time_sessions(organization_id,instance_id,actor_id,started_at) values($1,$2,$3,now()-interval '1 hour') returning id",[ids.org,ids.t,ids.employee])).rows[0].id;
    await actor(ids.employee);
    await expect(db.query("select pause_task_timer($1,$2)",[session,"90000000-0000-0000-0000-000000000221"])).rejects.toThrow("cerrado");
    await db.exec("reset role");
    await db.query("update task_time_sessions set ended_at=clock_timestamp() where id=$1",[session]);
    await db.query("insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date) values($1,$2,$3,$4,$5,$6,'2027-01-01','2027-01-08','Pausa de usuario suspendido','resultado',5,'2027-01-30')",[suspendedTask,ids.org,ids.a,ids.c,ids.employee,ids.team]);
    const ownSession=(await db.query<{id:string}>("insert into task_time_sessions(organization_id,instance_id,actor_id,started_at) values($1,$2,$3,now()-interval '1 hour') returning id",[ids.org,suspendedTask,ids.employee])).rows[0].id;
    await db.exec("reset role"); await db.query("update profiles set active=false where id=$1",[ids.employee]);
    await actor(ids.employee);
    await db.query("select pause_task_timer($1,$2)",[ownSession,"90000000-0000-0000-0000-000000000222"]);
    expect((await db.query<{ended_at:string|null}>("select ended_at::text from task_time_sessions where id=$1",[ownSession])).rows[0].ended_at).not.toBeNull();
    await db.exec("reset role"); await db.query("update profiles set active=true where id=$1",[ids.employee]);
    await actor(ids.employee);
    await expect(db.query("select set_task_wait($1,$2,0,$3)",[blocked,"   ","90000000-0000-0000-0000-000000000223"])).rejects.toThrow("descripción");
    await expect(db.query("select transition_task_reviewed($1,'En curso',null,null,$2)",[blocked,"90000000-0000-0000-0000-000000000227"])).rejects.toThrow("revisión");
    await expect(db.query("select set_checklist_item_reviewed($1,'step',true,null,null,$2)",[blocked,"90000000-0000-0000-0000-000000000228"])).rejects.toThrow("revisión");
    await db.query("select set_task_wait($1,$2,0,$3)",[blocked,"Esperando soporte","90000000-0000-0000-0000-000000000224"]);
    await expect(db.query("select transition_task_reviewed($1,'En curso',null,1,$2)",[blocked,"90000000-0000-0000-0000-000000000225"])).rejects.toThrow("iniciarla");
    expect((await db.query<{status:string;state_revision:number}>("select status,state_revision from task_instances where id=$1",[blocked])).rows[0]).toMatchObject({status:"Pendiente",state_revision:1});
    await db.query("select set_checklist_item_reviewed($1,'step',true,null,1,$2)",[blocked,"90000000-0000-0000-0000-000000000226"]);
    expect((await db.query<{status:string;state_revision:number}>("select status,state_revision from task_instances where id=$1",[blocked])).rows[0]).toMatchObject({status:"Pendiente",state_revision:2});
    expect((await db.query("select * from task_time_sessions where instance_id=$1 and ended_at is null",[blocked])).rows).toHaveLength(0);
  });
  it("el empleado no puede completar controles ni detener el reloj de un encargado", async () => {
    const task="50000000-0000-0000-0000-000000000231";
    await db.exec("reset role");
    await db.query("insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,status,started_at,checklist) values($1,$2,$3,$4,$5,$6,'2026-12-01','2026-12-02','Revisión entre actores','resultado',5,'2026-12-30','En curso',now(),'[{\"id\":\"step\",\"done\":false}]')",[task,ids.org,ids.a,ids.c,ids.employee,ids.team]);
    await actor(ids.manager);
    const session=(await db.query<{start_task_timer:string}>("select start_task_timer($1,0,$2,false)",[task,"90000000-0000-0000-0000-000000000231"])).rows[0].start_task_timer;
    await actor(ids.employee);
    await expect(db.query("select set_checklist_item_reviewed($1,'step',true,null,1,$2)",[task,"90000000-0000-0000-0000-000000000232"])).rejects.toThrow("ejecutor");
    expect((await db.query<{ended_at:string|null}>("select ended_at::text from task_time_sessions where id=$1",[session])).rows[0].ended_at).toBeNull();
    expect((await db.query<{status:string;done:boolean}>("select status,checklist->0->>'done'='true' as done from task_instances where id=$1",[task])).rows[0]).toMatchObject({status:"En curso",done:false});
    await actor(ids.boss);
    await expect(db.query("select transition_task_reviewed($1,'Pendiente','Intervención verificada',1,$2)",[task,"90000000-0000-0000-0000-000000000233"])).rejects.toThrow("MFA");
    await actor(ids.boss,"aal2");
    await expect(db.query("select transition_task_reviewed($1,'Pendiente','   ',1,$2)",[task,"90000000-0000-0000-0000-000000000234"])).rejects.toThrow("motivo");
    await db.query("select transition_task_reviewed($1,'Pendiente','Interrupción revisada por jefatura',1,$2)",[task,"90000000-0000-0000-0000-000000000235"]);
    expect((await db.query<{ended_at:string|null}>("select ended_at::text from task_time_sessions where id=$1",[session])).rows[0].ended_at).not.toBeNull();
    await db.exec("reset role");
    await db.query("update task_time_sessions set ended_at=clock_timestamp() where id=$1",[session]);
  });
  it("cota una sesión cubierta a medianoche ART aunque se cancele después", async () => {
    const task="50000000-0000-0000-0000-000000000241";
    await db.exec("reset role");
    await db.query("insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date) values($1,$2,$3,$4,$5,$6,'2026-01-01','2026-01-12','Cobertura finita','resultado',5,'2026-01-30')",[task,ids.org,ids.a,ids.c,ids.employee,ids.team]);
    await db.exec(`reset role;select set_config('request.jwt.claim.sub','${ids.boss}',false);select set_config('request.jwt.claims','{"aal":"aal2"}',false);set role authenticated;`);
    const absence=(await db.query<{approve_employee_absence:string}>("select approve_employee_absence($1,$2,'licencia','2026-01-01','2026-01-01',array[$3]::uuid[],'Cobertura de prueba',$4)",[ids.employee,ids.manager,ids.c,"90000000-0000-0000-0000-000000000241"])).rows[0].approve_employee_absence;
    await db.exec("reset role");
    await db.query("update task_time_sessions set ended_at=clock_timestamp() where actor_id=$1 and ended_at is null",[ids.manager]);
    const session=(await db.query<{id:string}>("insert into task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values($1,$2,$3,'2026-01-01 12:00+00',$4) returning id",[ids.org,task,ids.manager,absence])).rows[0].id;
    await db.exec(`reset role;select set_config('request.jwt.claim.sub','${ids.boss}',false);select set_config('request.jwt.claims','{"aal":"aal2"}',false);set role authenticated;`);
    await db.query("select cancel_employee_absence($1,'Fin anticipado confirmado',$2)",[absence,"90000000-0000-0000-0000-000000000242"]);
    await db.exec("reset role");
    const result=(await db.query<{end:string;expiry:string}>("select ended_at::text as end,('2026-01-02'::date::timestamp at time zone 'America/Argentina/Buenos_Aires')::text as expiry from task_time_sessions where id=$1",[session])).rows[0];
    expect(new Date(result.end).toISOString()).toBe(new Date(result.expiry).toISOString());
    await db.query("select cancel_employee_absence($1,'Texto distinto de reintento',$2)",[absence,"90000000-0000-0000-0000-000000000243"]);
    expect((await db.query("select * from audit_events where action='absence.cancelled' and entity_id=$1",[absence])).rows).toHaveLength(1);
    const expiredSession=(await db.query<{id:string}>("insert into task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values($1,$2,$3,'2026-01-01 12:00+00',$4) returning id",[ids.org,task,ids.manager,absence])).rows[0].id;
    await actor(ids.manager);
    const resumed=(await db.query<{start_task_timer:string}>("select start_task_timer($1,1,$2,false)",["50000000-0000-0000-0000-000000000223","90000000-0000-0000-0000-000000000246"])).rows[0].start_task_timer;
    await db.exec("reset role");
    expect((await db.query<{ended_at:string|null}>("select ended_at::text from task_time_sessions where id=$1",[expiredSession])).rows[0].ended_at).not.toBeNull();
    await actor(ids.manager);
    await db.query("select pause_task_timer($1,$2)",[resumed,"90000000-0000-0000-0000-000000000247"]);
    await actor(ids.boss,"aal2");
    const noCoverage=(await db.query<{approve_employee_absence:string}>("select approve_employee_absence($1,null,'vacaciones','2026-02-01','2026-02-03','{}','Sin reemplazo',$2)",[ids.employee,"90000000-0000-0000-0000-000000000244"])).rows[0].approve_employee_absence;
    await expect(db.query("select approve_employee_absence($1,null,'licencia','2026-02-03','2026-02-05','{}','Otro rango',$2)",[ids.employee,"90000000-0000-0000-0000-000000000245"])).rejects.toThrow("superpone");
    await db.exec("reset role");
    expect((await db.query("select * from employee_absences where owner_id=$1 and cancelled_at is null and starts_on='2026-02-01'",[ids.employee])).rows).toHaveLength(1);
    expect(noCoverage).toBeTruthy();
  });
  it("anon no tiene lectura", async () => {
    await db.exec("reset role;set role anon");
    await expect(db.query("select * from profiles")).rejects.toThrow();
  });
  it("materializa recurrencia semanal e intervalo sin vencimiento", async () => {
    await db.exec("reset role");
    await db.exec("delete from task_instances where period='2027-02-01'");
    await db.exec(
      `update task_assignments set frequency='semanal',start_date='2027-02-01',end_date=null,interval_count=2,weekdays=array[1,3]::smallint[],has_deadline=false,due_offset_days=0 where id='${ids.a}'`,
    );
    await actor(ids.employee);
    await db.query("select materialize_month($1,'2027-02-01')", [ids.employee]);
    const rows = (
      await db.query<{ scheduled_on: string; due_date: string | null }>(
        "select scheduled_on::text,due_date::text from task_instances where period='2027-02-01' order by scheduled_on",
      )
    ).rows;
    expect(rows.map((r) => r.scheduled_on)).toEqual([
      "2027-02-01",
      "2027-02-03",
      "2027-02-15",
      "2027-02-17",
    ]);
    expect(rows.every((r) => r.due_date === null)).toBe(true);
    expect(
      (
        await db.query<{ materialize_month: number }>(
          "select materialize_month($1,'2027-02-01')",
          [ids.employee],
        )
      ).rows[0].materialize_month,
    ).toBe(0);
  });
  it("admite varias ocurrencias diarias y vencimientos posteriores al mes", async () => {
    await db.exec("reset role");
    await db.exec("delete from task_instances where period='2027-02-01'");
    await db.exec(
      `update task_assignments set frequency='diaria',start_date='2027-02-01',end_date=null,interval_count=3,has_deadline=true,due_offset_days=5 where id='${ids.a}'`,
    );
    await actor(ids.employee);
    await db.query("select materialize_month($1,'2027-02-01')", [ids.employee]);
    const rows = (
      await db.query<{ scheduled_on: string; due_date: string }>(
        "select scheduled_on::text,due_date::text from task_instances where period='2027-02-01' order by scheduled_on",
      )
    ).rows;
    expect(rows.map((r) => r.scheduled_on)).toEqual([
      "2027-02-01",
      "2027-02-04",
      "2027-02-07",
      "2027-02-10",
      "2027-02-13",
      "2027-02-16",
      "2027-02-19",
      "2027-02-22",
      "2027-02-25",
      "2027-02-28",
    ]);
    expect(rows.at(-1)?.due_date).toBe("2027-03-05");
  });
  it("actualiza desde 0.3 preservando cierres, tareas y catálogo existente", async () => {
    const legacy = new PGlite();
    try {
      await legacy.exec(
        `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
      );
      for (const f of readdirSync(
        new URL("../supabase/migrations/", import.meta.url),
      )
        .filter((n) => n.startsWith("20260930"))
        .sort())
        await legacy.exec(
          readFileSync(
            new URL("../supabase/migrations/" + f, import.meta.url),
            "utf8",
          ),
        );
      await legacy.exec(
        `insert into organizations(id,name) values('${ids.org}','Legacy');insert into auth.users(id) values('${ids.boss}'),('${ids.employee}');insert into profiles(id,organization_id,name,role,manager_id,sector,branch,position) values('${ids.boss}','${ids.org}','Boss','jefe',null,'A','B','C'),('${ids.employee}','${ids.org}','Employee','empleado','${ids.boss}','A','B','C');insert into companies values('${ids.c}','${ids.org}','Empresa');insert into teams values('${ids.team}','${ids.org}','Team','${ids.boss}');insert into team_members values('${ids.org}','${ids.team}','${ids.employee}');insert into company_memberships values('${ids.org}','${ids.c}','${ids.employee}');insert into task_templates(id,organization_id,title,kind,weight,checklist) values('${ids.t}','${ids.org}','Conciliación','resultado',5,'[{"text":"Control"}]');insert into task_assignments(id,organization_id,template_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day,checklist) values('${ids.a}','${ids.org}','${ids.t}','${ids.c}','${ids.employee}','${ids.team}','Conciliación','resultado',5,'mensual','2026-09-01',30,'["Control"]');insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,title,kind,weight,due_date,checklist) values('${ids.t.replace("500", "600")}','${ids.org}','${ids.a}','${ids.c}','${ids.employee}','${ids.team}','2026-09-01','Conciliación','resultado',5,'2026-09-30','[{"id":"kept","text":"Control","done":false}]');insert into monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values('${ids.org}','${ids.employee}','2026-09-01','{"immutable":true}','${ids.boss}','Revisado');`,
      );
      await legacy.exec(
        readFileSync(
          new URL(
            "../supabase/migrations/202610010001_occurrence_contract.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await legacy.exec(
        readFileSync(
          new URL(
            "../supabase/migrations/202610010002_onboarding_approval.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await legacy.exec(readFileSync(new URL("../supabase/migrations/202610010003_report_delivery.sql", import.meta.url), "utf8"));
      await legacy.exec(`insert into audit_events(organization_id,actor_id,action,entity_id,details) values('${ids.org}','${ids.boss}','task.transition','${ids.t.replace("500", "600")}','{"from":"Completada","to":"Pendiente"}');insert into period_reports(id,organization_id,closure_id,owner_id,period,snapshot) select '81000000-0000-0000-0000-000000000001',organization_id,id,owner_id,period,'{"legacy_report":true}' from monthly_closures where owner_id='${ids.employee}' and period='2026-09-01';insert into report_deliveries(id,organization_id,report_id,recipient_id,recipient_email) values('82000000-0000-0000-0000-000000000001','${ids.org}','81000000-0000-0000-0000-000000000001','${ids.boss}','boss@legacy.test');insert into report_outbox_events(id,organization_id,delivery_id) values('83000000-0000-0000-0000-000000000001','${ids.org}','82000000-0000-0000-0000-000000000001');`);
      for (const f of readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((n) => /^20261001000[45]_/.test(n)).sort())
        await legacy.exec(readFileSync(new URL("../supabase/migrations/" + f, import.meta.url), "utf8"));
      const instance = (
        await legacy.query<{
          scheduled_on: string;
          due_date: string;
          checklist: { id: string }[];
        }>(
          "select scheduled_on::text,due_date::text,checklist from task_instances",
        )
      ).rows[0];
      expect(instance).toMatchObject({
        scheduled_on: "2026-09-30",
        due_date: "2026-09-30",
      });
      expect(instance.checklist[0].id).toBe("kept");
      expect(
        (
          await legacy.query<{ snapshot: { immutable: boolean } }>(
            "select snapshot from monthly_closures",
          )
        ).rows[0].snapshot.immutable,
      ).toBe(true);
      expect(
        (await legacy.query("select * from task_template_versions")).rows,
      ).toHaveLength(1);
      expect(
        (
          await legacy.query<{ template_version_id: string }>(
            "select template_version_id from task_assignments",
          )
        ).rows[0].template_version_id,
      ).toBeTruthy();
      expect((await legacy.query("select * from onboarding_requests")).rows).toHaveLength(0);
      expect((await legacy.query("select * from task_time_sessions")).rows).toHaveLength(0);
      expect((await legacy.query<{snapshot:object}>("select snapshot from monthly_closures")).rows[0].snapshot).toEqual({ immutable: true });
      expect((await legacy.query<{id:string;snapshot:object}>("select id,snapshot from period_reports")).rows[0]).toEqual({id:"81000000-0000-0000-0000-000000000001",snapshot:{legacy_report:true}});
      expect((await legacy.query("select * from report_outbox_events where id='83000000-0000-0000-0000-000000000001'")).rows).toHaveLength(1);
      expect((await legacy.query("select * from task_reopen_events where legacy_audit_id=(select max(id) from audit_events where action='task.transition')")).rows).toHaveLength(1);
    } finally {
      await legacy.close();
    }
  }, 20000);
  it("crea revisiones inmutables de catálogo y nuevas asignaciones apuntan a ellas", async () => {
    await db.exec(
      `reset role;select set_config('request.jwt.claim.sub','${ids.boss}',false);select set_config('request.jwt.claims','{"aal":"aal2"}',false);set role authenticated;`,
    );
    const templateId = (
      await db.query<{ create_task_template: string }>(
        "select create_task_template($1,$2,$3,$4,$5,$6,$7,$8::jsonb)",
        [
          "Conciliación",
          "Conciliar saldos",
          "Tesorería",
          "resultado",
          5,
          null,
          null,
          '["Control"]',
        ],
      )
    ).rows[0].create_task_template;
    await expect(
      db.query("select create_task_template($1,$2,$3,$4,$5,$6,$7,$8::jsonb)", [
        "  conciliación  ",
        "Misma tarea",
        "Tesorería",
        "resultado",
        5,
        null,
        null,
        '["Control"]',
      ]),
    ).rejects.toThrow("ya existe");
    await db.query("select update_template_weight($1,8)", [templateId]);
    const versions = (
      await db.query<{ version: number; weight: number }>(
        "select version,weight from task_template_versions where template_id=$1 order by version",
        [templateId],
      )
    ).rows.map((v) => ({ ...v, weight: Number(v.weight) }));
    expect(versions).toEqual([
      { version: 1, weight: 5 },
      { version: 2, weight: 8 },
    ]);
    await expect(
      db.exec("update task_template_versions set weight=1"),
    ).rejects.toThrow();
    await db.exec("reset role");
    await db.exec(
      `insert into companies values('${ids.c2}','${ids.org}','Otra empresa');insert into company_memberships values('${ids.org}','${ids.c2}','${ids.employee}'),('${ids.org}','${ids.c2}','${ids.manager}');`,
    );
    await actor(ids.manager, "aal2");
    await expect(db.query("select create_catalog_assignment($1,$2,$3,$4,'2026-10-01',31,'mensual')", [templateId, ids.c, ids.employee, ids.team])).rejects.toThrow("Sólo jefatura");
    await db.exec(`reset role;select set_config('request.jwt.claim.sub','${ids.boss}',false);select set_config('request.jwt.claims','{\"aal\":\"aal2\"}',false);set role authenticated;`);
    const created = await db.query<{ create_catalog_assignment: string }>(
      "select create_catalog_assignment($1,$2,$3,$4,'2026-10-01',31,'mensual')",
      [templateId, ids.c, ids.employee, ids.team],
    );
    const second = await db.query<{ create_catalog_assignment: string }>(
      "select create_catalog_assignment($1,$2,$3,$4,'2026-10-01',31,'mensual')",
      [templateId, ids.c2, ids.employee, ids.team],
    );
    const pair = (
      await db.query<{
        id: string;
        company_id: string;
        title: string;
        template_version_id: string;
      }>(
        "select id,company_id,title,template_version_id from task_assignments where id=any($1::uuid[]) order by company_id",
        [
          [
            created.rows[0].create_catalog_assignment,
            second.rows[0].create_catalog_assignment,
          ],
        ],
      )
    ).rows;
    expect(pair.map((a) => a.company_id)).toEqual([ids.c, ids.c2]);
    expect(pair.map((a) => a.title)).toEqual(["Conciliación", "Conciliación"]);
    expect(pair[0].template_version_id).toBe(pair[1].template_version_id);
    expect(pair[0].id).not.toBe(pair[1].id);
    const assignment = (
      await db.query<{
        title: string;
        weight: number;
        template_version_id: string;
        start_date: string;
        month_day: number;
      }>(
        "select title,weight,template_version_id,start_date::text,month_day from task_assignments where id=$1",
        [created.rows[0].create_catalog_assignment],
      )
    ).rows[0];
    expect({ ...assignment, weight: Number(assignment.weight) }).toMatchObject({
      title: "Conciliación",
      weight: 8,
      start_date: "2026-10-31",
      month_day: 31,
    });
    expect(assignment.template_version_id).toBeTruthy();
  });
  it("la inducción requiere revisión, respeta empresas y sólo jefatura activa las tareas", async () => {
    await db.exec(`reset role;insert into companies values('${ids.c3}','${ids.org}','Empresa de prueba');insert into company_memberships values('${ids.org}','${ids.c3}','${ids.employee}');`);
    await db.exec(
      `reset role;select set_config('request.jwt.claim.sub','${ids.boss}',false);select set_config('request.jwt.claims','{"aal":"aal2"}',false);set role authenticated;`,
    );
    const template = (
      await db.query<{ create_task_template: string }>(
        "select create_task_template($1,$2,$3,$4,$5,$6,$7,$8::jsonb)",
        ["Conciliación bancaria", "Conciliar y controlar", "Tesorería", "resultado", 7, null, null, '["Saldo conciliado"]'],
      )
    ).rows[0].create_task_template;
    const version = (
      await db.query<{ id: string }>(
        "select id from task_template_versions where template_id=$1 order by version desc limit 1",
        [template],
      )
    ).rows[0].id;
    const line1 = "80000000-0000-0000-0000-000000000001";
    const line2 = "80000000-0000-0000-0000-000000000002";
    const payload = JSON.stringify({
      lines: [
        { line_id: line1, template_version_id: version, company_id: ids.c, team_id: ids.team, frequency: "semanal", start_date: "2026-11-02", interval_count: 1, weekdays: [1], has_deadline: true, due_offset_days: 2 },
        { line_id: line2, template_version_id: version, company_id: ids.c3, team_id: ids.team, frequency: "mensual", start_date: "2026-11-10", interval_count: 1, month_day: 10, has_deadline: false, due_offset_days: 0 },
      ],
    });
    await actor(ids.employee);
    const priorAssignments = (await db.query<{ count: string }>(
      "select count(*)::text as count from task_assignments where owner_id=$1", [ids.employee],
    )).rows[0].count;
    const request = (await db.query<{ save_onboarding_draft: string }>(
      "select save_onboarding_draft(null,$1::jsonb,0,0)", ['{"lines":[]}'],
    )).rows[0].save_onboarding_draft;
    expect((await db.query<{ status: string }>("select status from onboarding_requests where id=$1", [request])).rows[0].status).toBe("draft");
    await expect(db.query("select submit_onboarding($1,0,1)", [request])).rejects.toThrow("al menos una tarea");
    await db.query("select save_onboarding_draft($1,$2::jsonb,0,1)", [request, payload]);
    await db.query("select submit_onboarding($1,0,2)", [request]);
    expect((await db.query<{ count: string }>("select count(*)::text as count from task_assignments where owner_id=$1", [ids.employee])).rows[0].count).toBe(priorAssignments);
    await expect(db.query("select submit_onboarding($1,0,2)", [request])).rejects.toThrow("revisión cambió");
    await expect(db.query("select * from onboarding_requests where id=$1", [request])).resolves.toBeDefined();
    await db.exec(`reset role;delete from company_memberships where company_id='${ids.c3}' and profile_id='${ids.employee}';`);

    await db.exec(`reset role;select set_config('request.jwt.claim.sub','${ids.manager}',false);select set_config('request.jwt.claims','{"aal":"aal2"}',false);set role authenticated;`);
    await expect(db.query("select approve_onboarding($1,1)", [request])).rejects.toThrow("Sólo jefatura");
    await db.query("select request_onboarding_changes($1,1,'Confirmar los días')", [request]);
    await actor(ids.employee);
    await db.query("select save_onboarding_draft($1,$2::jsonb,1,2)", [request, payload]);
    await db.query("select submit_onboarding($1,1,3)", [request]);

    await db.exec(`reset role;select set_config('request.jwt.claim.sub','${ids.boss}',false);select set_config('request.jwt.claims','{"aal":"aal1"}',false);set role authenticated;`);
    await expect(db.query("select approve_onboarding($1,2)", [request])).rejects.toThrow("MFA");
    await db.exec(`reset role;select set_config('request.jwt.claim.sub','${ids.boss}',false);select set_config('request.jwt.claims','{"aal":"aal2"}',false);set role authenticated;`);
    await expect(db.query("select approve_onboarding($1,1)", [request])).rejects.toThrow("desactualizada");
    await expect(db.query("select approve_onboarding($1,2)", [request])).rejects.toThrow("Empresa o equipo ya no asignado");
    expect((await db.query("select * from onboarding_activations where request_id=$1", [request])).rows).toHaveLength(0);
    expect((await db.query("select * from task_assignments where owner_id=$1 and template_version_id=$2", [ids.employee, version])).rows).toHaveLength(0);
    await db.exec(`reset role;insert into company_memberships values('${ids.org}','${ids.c3}','${ids.employee}');select set_config('request.jwt.claim.sub','${ids.boss}',false);select set_config('request.jwt.claims','{"aal":"aal2"}',false);set role authenticated;`);
    expect((await db.query<{ approve_onboarding: number }>("select approve_onboarding($1,2)", [request])).rows[0].approve_onboarding).toBe(2);
    const assigned = (await db.query<{ company_id: string; frequency: string; has_deadline: boolean; weight: number }>(
      "select company_id,frequency,has_deadline,weight from task_assignments where owner_id=$1 and template_version_id=$2 order by company_id",
      [ids.employee, version],
    )).rows;
    expect(assigned).toHaveLength(2);
    expect(assigned.map(({ company_id, frequency }) => [company_id, frequency])).toEqual([
      [ids.c, "semanal"], [ids.c3, "mensual"],
    ]);
    expect((await db.query("select * from onboarding_activations where request_id=$1", [request])).rows).toHaveLength(2);
    expect((await db.query<{ approve_onboarding: number }>("select approve_onboarding($1,2)", [request])).rows[0].approve_onboarding).toBe(2);
  });
  it("reportes privados, destinatario verificado y consumidor reservado al servidor", async () => {
    await actor(ids.employee);
    expect((await db.query("select * from period_reports")).rows).toHaveLength(1);
    expect((await db.query("select * from report_deliveries")).rows).toHaveLength(0);
    await expect(db.query("select claim_report_deliveries(1)")).rejects.toThrow();
    await actor(ids.outsider);
    expect((await db.query("select * from period_reports")).rows).toHaveLength(0);
    await actor(ids.boss, "aal2");
    await expect(db.query("select set_report_recipient($1)", [ids.manager])).rejects.toThrow("correo verificado");
    await expect(db.query("select set_report_recipient($1)", [ids.outsider])).rejects.toThrow("correo verificado");
    await db.query("select set_report_recipient($1)", [ids.boss]);
  });
  it("la entrega respeta lease, reintenta y no regenera cierre ni eventos", async () => {
    await db.exec("reset role;set role service_role");
    const first = (await db.query<{id:string;lease_token:string}>("select * from claim_report_deliveries(1)")).rows[0];
    expect(first).toBeDefined();
    expect((await db.query("select * from claim_report_deliveries(1)")).rows).toHaveLength(0);
    await db.query("select fail_report_delivery($1,$2,'provider_unavailable',true)", [first.id,first.lease_token]);
    await db.exec("reset role");
    const wait = (await db.query<{status:string;seconds:number}>("select status,extract(epoch from(next_attempt_at-now())) as seconds from report_deliveries where id=$1",[first.id])).rows[0];
    expect(wait.status).toBe("retry_wait");
    expect(Number(wait.seconds)).toBeGreaterThan(55);
    await db.query("update report_deliveries set next_attempt_at=now()-interval '1 second' where id=$1",[first.id]);
    await db.exec("set role service_role");
    const second = (await db.query<{id:string;lease_token:string;attempts:number}>("select * from claim_report_deliveries(1)")).rows[0];
    expect(second.id).toBe(first.id);
    expect(second.attempts).toBe(2);
    await expect(db.query("select complete_report_delivery($1,$2,'fake-accepted')",[first.id,first.lease_token])).rejects.toThrow("Lease");
    await db.query("select complete_report_delivery($1,$2,'fake-accepted')",[second.id,second.lease_token]);
    expect((await db.query("select * from claim_report_deliveries(1)")).rows).toHaveLength(0);
    await db.exec("reset role");
    expect((await db.query("select * from report_outbox_events")).rows).toHaveLength(1);
    expect((await db.query("select * from monthly_closures")).rows).toHaveLength(1);
    await expect(db.exec("update period_reports set snapshot='{}'")).rejects.toThrow("inmutables");
  });
  it("un destinatario inválido o cronómetro activo revierte el cierre; sin vencimiento no inventa puntualidad", async () => {
    const task = "50000000-0000-0000-0000-000000000099";
    await db.exec("reset role");
    await db.query("insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date,status,completed_at) values($1,$2,$3,$4,$5,$6,'2026-10-01','2026-10-15','Sin vencimiento','resultado',5,null,'Completada',now())",[task,ids.org,ids.a,ids.c,ids.employee,ids.team]);
    await db.query("update auth.users set email_confirmed_at=null where id=$1",[ids.boss]);
    await actor(ids.boss, "aal2");
    await expect(db.query("select close_employee_month($1,'2026-10-01','Controlado')",[ids.employee])).rejects.toThrow("correo verificado");
    await db.exec("reset role");
    expect((await db.query("select * from monthly_closures where period='2026-10-01'")).rows).toHaveLength(0);
    await db.query("update auth.users set email_confirmed_at=now() where id=$1",[ids.boss]);
    await db.query("insert into task_time_sessions(organization_id,instance_id,actor_id,started_at) values($1,$2,$3,now()-interval '1 hour')",[ids.org,task,ids.employee]);
    await actor(ids.boss, "aal2");
    await expect(db.query("select close_employee_month($1,'2026-10-01','Controlado')",[ids.employee])).rejects.toThrow("cronómetros activos");
    await db.exec("reset role");
    await db.query("update task_time_sessions set ended_at=started_at+interval '30 minutes' where instance_id=$1",[task]);
    await actor(ids.boss, "aal2");
    await db.query("select close_employee_month($1,'2026-10-01','Controlado')",[ids.employee]);
    const snap = (await db.query<{snapshot:{version:number;metrics:{onTime:number|null;recordedSeconds:number};sessions:unknown[]}}>("select snapshot from period_reports where period='2026-10-01'")).rows[0].snapshot;
    expect(snap.version).toBe(3);
    expect(snap.metrics.onTime).toBeNull();
    expect(Number(snap.metrics.recordedSeconds)).toBeGreaterThanOrEqual(1800);
    expect(Number(snap.metrics.recordedSeconds)).toBeLessThan(1801);
    expect(snap.sessions).toHaveLength(2);
  });
  it("cinco fallos agotan reintentos; el reintento manual conserva identidad y contador histórico", async () => {
    let id="";
    for(let attempt=1;attempt<=5;attempt++) {
      await db.exec("reset role;set role service_role");
      const d=(await db.query<{id:string;lease_token:string;attempts:number}>("select * from claim_report_deliveries(1)")).rows[0];
      id=d.id;
      expect(d.attempts).toBe(attempt);
      await db.query("select fail_report_delivery($1,$2,'provider_unavailable',true)",[d.id,d.lease_token]);
      await db.exec("reset role");
      const state=(await db.query<{status:string}>("select status from report_deliveries where id=$1",[id])).rows[0];
      expect(state.status).toBe(attempt===5?"failed":"retry_wait");
      await db.query("update report_deliveries set next_attempt_at=now()-interval '1 second' where id=$1",[id]);
    }
    await actor(ids.boss, "aal2");
    await db.query("select retry_report_delivery($1)",[id]);
    await db.exec("reset role;set role service_role");
    const next=(await db.query<{id:string;lease_token:string;total_attempts:number}>("select * from claim_report_deliveries(1)")).rows[0];
    expect(next.id).toBe(id);
    expect(next.total_attempts).toBe(6);
    await db.exec("reset role");
    await db.query("update report_deliveries set lease_until=now()-interval '1 second' where id=$1",[id]);
    await db.exec("set role service_role");
    const reclaimed=(await db.query<{id:string;lease_token:string}>("select * from claim_report_deliveries(1)")).rows[0];
    expect(reclaimed.id).toBe(id);
    expect(reclaimed.lease_token).not.toBe(next.lease_token);
    await expect(db.query("select complete_report_delivery($1,$2,'late-ack')",[id,next.lease_token])).rejects.toThrow("Lease");
    await db.query("select complete_report_delivery($1,$2,'accepted')",[id,reclaimed.lease_token]);
  });

});
