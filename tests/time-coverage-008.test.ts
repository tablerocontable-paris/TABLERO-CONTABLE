import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

let db: any;
const org = "00000000-0000-0000-0000-000000000008";
const boss = "10000000-0000-0000-0000-000000000008";
const owner = "10000000-0000-0000-0000-000000000018";
const peer = "10000000-0000-0000-0000-000000000028";
const sourceOwner = "10000000-0000-0000-0000-000000000038";
const company = "20000000-0000-0000-0000-000000000008";
const team = "30000000-0000-0000-0000-000000000008";
const assignment = "40000000-0000-0000-0000-000000000008";
const instance = "50000000-0000-0000-0000-000000000008";
const operation = "90000000-0000-0000-0000-000000000008";
async function actor(uid: string) {
  await db.exec("reset role");
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [uid, JSON.stringify({ aal: "aal2" })],
  );
  await db.exec("set role authenticated");
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;",
  );
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(migrations)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(new URL(file, migrations), "utf8"));
  }
  await db.query("insert into organizations values($1,'Contract 008')", [org]);
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'boss@test',now()),($2,'owner@test',now()),($3,'peer@test',now()),($4,'source@test',now())",
    [boss, owner, peer, sourceOwner],
  );
  await db.query(
    "insert into profiles(id,organization_id,name,role,manager_id,sector,branch,position) values($1,$5,'Boss','jefe',null,'A','B','C'),($2,$5,'Owner','empleado',$1,'A','B','C'),($3,$5,'Peer','empleado',$1,'A','B','C'),($4,$5,'Source','empleado',$1,'A','B','C')",
    [boss, owner, peer, sourceOwner, org],
  );
  await db.query("insert into companies values($1,$2,'Company')", [
    company,
    org,
  ]);
  await db.query("insert into teams values($1,$2,'Team',$3)", [
    team,
    org,
    boss,
  ]);
  await db.query(
    "insert into team_members values($1,$2,$3),($1,$2,$4),($1,$2,$5)",
    [org, team, owner, peer, sourceOwner],
  );
  await db.query(
    "insert into company_memberships values($1,$2,$3),($1,$2,$4),($1,$2,$5)",
    [org, company, owner, peer, sourceOwner],
  );
  await db.query(
    "insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day) values($1,$2,$3,$4,$5,'Task','resultado',5,'mensual',date_trunc('month',current_date)::date,30)",
    [assignment, org, company, owner, team],
  );
  await db.query(
    "insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight) values($1,$2,$3,$4,$5,$6,date_trunc('month',current_date)::date,current_date,'Task','resultado',5)",
    [instance, org, assignment, company, owner, team],
  );
  await db.query(
    "insert into report_settings(organization_id,recipient_id,updated_by) values($1,$2,$2)",
    [org, boss],
  );
  await actor(boss);
  await db.query(
    "select approve_employee_absence($1,$2,'licencia',current_date,current_date+30,array[$3]::uuid[],'Coverage',$4)",
    [owner, peer, company, operation],
  );
});
afterAll(async () => db?.close());

describe("Aceptación 008: sello de cobertura", () => {
  it("un checklist sin cambios no bloquea ni toca otro cronómetro de un mes cerrado", async () => {
    await db.exec("reset role");
    await db.query(
      'update task_instances set checklist=\'[{"id":"same","done":true}]\'::jsonb where id=$1',
      [instance],
    );
    await db.query(
      "insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day) values('40000000-0000-0000-0000-000000000009',$1,$2,$3,$4,'Previous','resultado',5,'mensual',(date_trunc('month',current_date)-interval '1 month')::date,30)",
      [org, company, owner, team],
    );
    await db.query(
      "insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight) values('50000000-0000-0000-0000-000000000009',$1,'40000000-0000-0000-0000-000000000009',$2,$3,$4,(date_trunc('month',current_date)-interval '1 month')::date,(date_trunc('month',current_date)-interval '1 month')::date,'Previous','resultado',5)",
      [org, company, owner, team],
    );
    await db.query(
      "insert into monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values($1,$2,(date_trunc('month',current_date)-interval '1 month')::date,'{}',$3,'Closed fixture')",
      [org, owner, boss],
    );
    const sourceSession = (
      await db.query(
        "insert into task_time_sessions(organization_id,instance_id,actor_id,started_at) values($1,'50000000-0000-0000-0000-000000000009',$2,now()) returning id",
        [org, owner],
      )
    ).rows[0].id;
    await actor(owner);
    const operationId = "90000000-0000-0000-0000-000000000019";
    await db.query(
      "select set_checklist_item_reviewed($1,'same',true,null,0,$2)",
      [instance, operationId],
    );
    await db.exec("reset role");
    expect(
      (
        await db.query(
          "select state_revision,status from task_instances where id=$1",
          [instance],
        )
      ).rows[0],
    ).toEqual({ state_revision: 0, status: "Pendiente" });
    expect(
      (
        await db.query("select ended_at from task_time_sessions where id=$1", [
          sourceSession,
        ])
      ).rows[0].ended_at,
    ).toBeNull();
    expect(
      (
        await db.query(
          "select count(*)::int n from task_mutation_receipts where operation_id=$1",
          [operationId],
        )
      ).rows[0].n,
    ).toBe(1);
    await db.query(
      "update task_time_sessions set ended_at=started_at+interval '1 minute' where id=$1",
      [sourceSession],
    );
  });

  it("la espera registra el contexto completo de una sesión de cobertura vencida", async () => {
    await db.exec("reset role");
    const oldAssignment = "40000000-0000-0000-0000-000000000029";
    const oldInstance = "50000000-0000-0000-0000-000000000029";
    const absenceOp = "90000000-0000-0000-0000-000000000029";
    const waitOp = "90000000-0000-0000-0000-000000000039";
    await db.query(
      "insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day) values($1,$2,$3,$4,$5,'Expired coverage','resultado',5,'mensual','2025-04-01',30)",
      [oldAssignment, org, company, owner, team],
    );
    await db.query(
      "insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,blocked_by,blocked_since) values($1,$2,$3,$4,$5,$6,'2025-04-01','2025-04-01','Expired coverage','resultado',5,'Waiting','2025-04-01')",
      [oldInstance, org, oldAssignment, company, owner, team],
    );
    await actor(boss);
    const absence = (
      await db.query(
        "select approve_employee_absence($1,$2,'licencia','2025-04-01','2025-04-02',array[$3]::uuid[],'Expired coverage',$4) id",
        [owner, peer, company, absenceOp],
      )
    ).rows[0].id;
    await db.exec("reset role");
    const sessionId = (
      await db.query(
        "insert into task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values($1,$2,$3,'2025-04-01 12:00:00+00',$4) returning id",
        [org, oldInstance, peer, absence],
      )
    ).rows[0].id;
    await actor(owner);
    await db.query("select set_task_wait($1,'Waiting',0,$2)", [
      oldInstance,
      waitOp,
    ]);
    await db.exec("reset role");
    const sessionRow = (
      await db.query(
        "select started_at,ended_at,absence_id,actor_id,instance_id from task_time_sessions where id=$1",
        [sessionId],
      )
    ).rows[0];
    const events = (
      await db.query(
        "select action,entity_id,at,details from audit_events where details->>'session'=$1 and action in ('task.timer_expired','task.wait') order by id",
        [sessionId],
      )
    ).rows;
    expect(events).toHaveLength(2);
    expect(events[1].details).toMatchObject({
      executor: peer,
      session: sessionId,
      absence,
    });
    expect(new Date(events[1].details.started_at).toISOString()).toBe(
      new Date(sessionRow.started_at).toISOString(),
    );
    expect(new Date(events[1].details.ended_at).toISOString()).toBe(
      new Date(sessionRow.ended_at).toISOString(),
    );
    expect(new Date(events[1].at).toISOString()).toBe(
      new Date(events[0].at).toISOString(),
    );
  });

  it("transición con dos sesiones vencidas conserva por separado origen y destino", async () => {
    await db.exec("reset role");
    const sourceAssignment = "40000000-0000-0000-0000-000000000049";
    const targetAssignment = "40000000-0000-0000-0000-000000000059";
    const source = "50000000-0000-0000-0000-000000000049";
    const target = "50000000-0000-0000-0000-000000000059";
    const absenceOp = "90000000-0000-0000-0000-000000000049";
    const transitionOp = "90000000-0000-0000-0000-000000000059";
    for (const [assignmentId, instanceId, taskOwner, title] of [
      [sourceAssignment, source, sourceOwner, "Expired origin"],
      [targetAssignment, target, owner, "Expired destination"],
    ]) {
      await db.query(
        "insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day) values($1,$2,$3,$4,$5,$6,'resultado',5,'mensual','2025-05-01',30)",
        [assignmentId, org, company, taskOwner, team, title],
      );
      await db.query(
        "insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight) values($1,$2,$3,$4,$5,$6,'2025-05-01','2025-05-01',$7,'resultado',5)",
        [instanceId, org, assignmentId, company, taskOwner, team, title],
      );
    }
    await actor(boss);
    const sourceAbsence = (
      await db.query(
        "select approve_employee_absence($1,$2,'licencia','2025-05-01','2025-05-02',array[$3]::uuid[],'Expired source timer',$4) id",
        [sourceOwner, owner, company, absenceOp],
      )
    ).rows[0].id;
    const targetAbsence = (
      await db.query(
        "select approve_employee_absence($1,$2,'licencia','2025-05-01','2025-05-02',array[$3]::uuid[],'Expired destination timer',$4) id",
        [owner, peer, company, "90000000-0000-0000-0000-000000000050"],
      )
    ).rows[0].id;
    await db.exec("reset role");
    const sourceSession = (
      await db.query(
        "insert into task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values($1,$2,$3,'2025-05-01 12:00:00+00',$4) returning id",
        [org, source, owner, sourceAbsence],
      )
    ).rows[0].id;
    const targetSession = (
      await db.query(
        "insert into task_time_sessions(organization_id,instance_id,actor_id,started_at,absence_id) values($1,$2,$3,'2025-05-01 13:00:00+00',$4) returning id",
        [org, target, peer, targetAbsence],
      )
    ).rows[0].id;
    await actor(owner);
    await db.query("select transition_task_reviewed($1,'En curso',null,0,$2)", [
      target,
      transitionOp,
    ]);
    await db.exec("reset role");
    const targetEnd = (
      await db.query("select ended_at from task_time_sessions where id=$1", [
        targetSession,
      ])
    ).rows[0].ended_at;
    const sourceEnd = (
      await db.query("select ended_at from task_time_sessions where id=$1", [
        sourceSession,
      ])
    ).rows[0].ended_at;
    const transitionAudit = (
      await db.query(
        "select details from audit_events where action='task.transition' and entity_id=$1",
        [target],
      )
    ).rows[0].details;
    expect(transitionAudit).toMatchObject({
      session: targetSession,
      executor: peer,
      absence: targetAbsence,
    });
    expect(new Date(transitionAudit.ended_at).toISOString()).toBe(
      new Date(targetEnd).toISOString(),
    );
    const sourceExpiry = (
      await db.query(
        "select details from audit_events where action='task.timer_expired' and entity_id=$1",
        [sourceSession],
      )
    ).rows[0].details;
    expect(sourceExpiry).toMatchObject({
      session: sourceSession,
      instance: source,
    });
    expect(new Date(sourceExpiry.ended_at).toISOString()).toBe(
      new Date(sourceEnd).toISOString(),
    );
    expect(
      (
        await db.query(
          "select state_revision from task_instances where id in ($1,$2) order by id",
          [source, target],
        )
      ).rows.map((row: { state_revision: number }) => row.state_revision),
    ).toEqual([1, 1]);
    expect(
      (
        await db.query(
          "select count(*)::int n from task_time_sessions where instance_id=$1 and ended_at is null",
          [target],
        )
      ).rows[0].n,
    ).toBe(1);
  });

  it("reporte de período calcula exactamente 1800 segundos y cantidades operativas", async () => {
    await db.exec("reset role");
    await db.query(
      "insert into task_time_sessions(organization_id,instance_id,actor_id,started_at,ended_at) values($1,$2,$3,'2020-01-01 12:00:00+00','2020-01-01 12:30:00+00')",
      [org, instance, owner],
    );
    await actor(boss);
    const period = (
      await db.query("select date_trunc('month',current_date)::date period")
    ).rows[0].period;
    await db.query(
      "select close_employee_month($1,$2,'Report exact fixture')",
      [owner, period],
    );
    await db.exec("reset role");
    const snapshot = (
      await db.query(
        "select snapshot from period_reports where owner_id=$1 and period=$2",
        [owner, period],
      )
    ).rows[0].snapshot;
    expect(Number(snapshot.metrics.recordedSeconds)).toBe(1800);
    expect(snapshot.metrics.operational).toBe(0);
    expect(snapshot.metrics.operationalTarget).toBe(0);
  });

  it("rechaza cobertura sin sello en helpers de acceso y hereda la autorización al sellar", async () => {
    await db.exec("reset role");
    await db.exec(
      "alter table employee_absences disable trigger employee_absence_identity_immutable",
    );
    await db.query(
      "update employee_absences set authorization_sealed=false where owner_id=$1",
      [owner],
    );
    await db.exec(
      "alter table employee_absences enable trigger employee_absence_identity_immutable",
    );
    await actor(peer);
    expect(
      (await db.query("select can_cover_instance($1) allowed", [instance]))
        .rows[0].allowed,
    ).toBe(false);
    await db.exec("reset role");
    await db.exec(
      "alter table employee_absences disable trigger employee_absence_identity_immutable",
    );
    await db.query(
      "update employee_absences set authorization_sealed=true where owner_id=$1",
      [owner],
    );
    await db.exec(
      "alter table employee_absences enable trigger employee_absence_identity_immutable",
    );
    await actor(peer);
    expect(
      (await db.query("select can_cover_instance($1) allowed", [instance]))
        .rows[0].allowed,
    ).toBe(true);
  });

  it("mantiene el helper interno fuera de los roles cliente", async () => {
    await db.exec("reset role");
    const acl = (
      await db.query(
        "select has_function_privilege('anon','public._can_access_instance_at(uuid,timestamptz)','execute') anon, has_function_privilege('authenticated','public._can_access_instance_at(uuid,timestamptz)','execute') authenticated, has_function_privilege('authenticated','public.can_cover_instance(uuid)','execute') cover",
      )
    ).rows[0];
    expect(acl).toEqual({ anon: false, authenticated: false, cover: true });
  });
});
