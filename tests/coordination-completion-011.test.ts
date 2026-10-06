import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AccountingLab, ids, stages, uid } from "./helpers/accounting-lab";

describe("011 complete coordination contracts", () => {
  let lab: AccountingLab;
  beforeAll(async () => { lab = await new AccountingLab().init(stages.m011); }, 60_000);
  beforeEach(async () => { await lab.admin(); await lab.db.exec("begin"); });
  afterEach(async () => { await lab.db.exec("rollback; reset role"); });
  afterAll(async () => { await lab?.close(); });
  async function coverage(task: string, recurring = false, replacement = ids.peer, starts = lab.period, ends?: string) {
    await lab.admin();
    const plan = lab.next();
    ends ??= (await lab.first("select ($1::date+interval '1 month - 1 day')::date::text d", [lab.period])).d;
    await lab.db.query(`insert into task_coverage_plans(id,organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by,handover_note)
      values($1,$2,$3,$4,$5,$6,'licencia',$7,'Test')`, [plan,ids.org,ids.owner,replacement,starts,ends,ids.boss]);
    if (recurring) await lab.db.query(`insert into task_coverage_plan_assignment_rules(plan_id,organization_id,assignment_id,company_id_snapshot,assignment_snapshot)
      select $1,a.organization_id,a.id,a.company_id,to_jsonb(a) from task_assignments a join task_instances t on t.assignment_id=a.id where t.id=$2`, [plan,task]);
    else await lab.db.query(`insert into task_coverage_plan_instances(plan_id,organization_id,instance_id,company_id_snapshot,period_snapshot)
      select $1,organization_id,id,company_id,period from task_instances where id=$2`, [plan,task]);
    await lab.db.query("update task_coverage_plans set sealed=true,sealed_by=$2,sealed_at=clock_timestamp() where id=$1",[plan,ids.boss]);
    await lab.actor(ids.boss,"aal2");
    await lab.first("select approve_task_coverage_plan($1,$2)",[plan,lab.next()]);
    await lab.admin();
    return { plan, binding:(await lab.first("select id from task_coverage_bindings where plan_id=$1 and instance_id is null order by id limit 1",[plan]))?.id as string | undefined };
  }
  async function joint(task: string) {
    await lab.admin();
    await lab.db.query("update task_assignments set frequency='unica' where id=(select assignment_id from task_instances where id=$1)",[task]);
    await lab.actor(ids.boss,"aal2");
    await lab.first("select assign_task_responsibility($1,$2::jsonb,'Dupla',1,$3)",[task,JSON.stringify([{profileId:ids.owner,shareBps:6000},{profileId:ids.peer,shareBps:4000}]),lab.next()]);
  }
  it("cancels a recurring rule and all derived bindings and clocks while preserving evidence", async () => {
    const task=await lab.task();
    const {plan,binding}=await coverage(task,true);
    await lab.actor(ids.owner);
    await lab.first("select materialize_month($1,$2::date)",[ids.owner,lab.period]);
    await lab.actor(ids.peer);
    const session=(await lab.first("select start_task_timer($1,0,$2,false) id",[task,lab.next()])).id;
    await lab.actor(ids.boss,"aal2");
    const op=lab.next();
    await lab.first("select cancel_task_coverage_binding($1,'Cambio de cobertura',$2)",[binding,op]);
    await lab.first("select cancel_task_coverage_binding($1,'Cambio de cobertura',$2)",[binding,op]);
    await lab.admin();
    expect(await lab.first("select count(*)::int n from task_coverage_bindings where plan_id=$1 and status='active'",[plan])).toEqual({n:0});
    expect(await lab.first("select actor_id,ended_at is not null ended from task_time_sessions where id=$1",[session])).toEqual({actor_id:ids.peer,ended:true});
    expect(await lab.first("select count(*)::int n from task_mutation_receipts where operation_id=$1",[op])).toEqual({n:1});
    await lab.actor(ids.peer);
    expect(await lab.first("select can_access_instance($1) ok",[task])).toEqual({ok:false});
    await lab.actor(ids.owner);
    await lab.first("select materialize_month($1,$2::date)",[ids.owner,lab.period]);
    await lab.admin();
    expect(await lab.first("select count(*)::int n from task_coverage_bindings where plan_id=$1 and status='active'",[plan])).toEqual({n:0});
  });
  it("narrows legacy absence grants to exact tasks and never restores broad access after cancellation", async () => {
    const selected=await lab.task(), unrelated=await lab.task();
    const ends=(await lab.first("select ($1::date+interval '1 month - 1 day')::date::text d",[lab.period])).d;
    await lab.absence(ids.owner,ids.peer,lab.period,ends);
    await coverage(selected);
    await lab.actor(ids.peer);
    expect(await lab.first("select can_access_instance($1) ok",[selected])).toEqual({ok:true});
    expect(await lab.first("select can_access_instance($1) ok",[unrelated])).toEqual({ok:false});
    await lab.admin();
    const binding=(await lab.first("select id from task_coverage_bindings where instance_id=$1",[selected])).id;
    await lab.actor(ids.boss,"aal2");
    await lab.first("select cancel_task_coverage_binding($1,'Fin',$2)",[binding,lab.next()]);
    await lab.actor(ids.peer);
    expect(await lab.first("select can_access_instance($1) ok",[selected])).toEqual({ok:false});
  });
  it("rejects overlapping substitutes and permits distinct non-overlapping coverage intervals", async () => {
    const task=await lab.task();
    await coverage(task,false,ids.peer,`${lab.period.slice(0,7)}-01`,`${lab.period.slice(0,7)}-10`);
    await lab.admin();
    await lab.db.exec("savepoint overlap");
    await expect(coverage(task,false,ids.sourceOwner,`${lab.period.slice(0,7)}-05`,`${lab.period.slice(0,7)}-12`)).rejects.toThrow(/superpone/);
    await lab.db.exec("rollback to savepoint overlap; release savepoint overlap");
    await coverage(task,false,ids.peer,`${lab.period.slice(0,7)}-11`,`${lab.period.slice(0,7)}-20`);
    expect(await lab.first("select count(*)::int n from task_coverage_bindings where instance_id=$1",[task])).toEqual({n:2});
  });
  it("freezes one joint task on first close, allows the second close and reconciles shares without duplicate points", async () => {
    const task=await lab.task(); await joint(task);
    await lab.admin();
    await lab.db.query("update task_instances set status='Completada',completed_at=clock_timestamp() where id=$1",[task]);
    await lab.actor(ids.boss,"aal2");
    const first=(await lab.first("select close_employee_month($1,$2::date,'Revisado') id",[ids.owner,lab.period])).id;
    await lab.actor(ids.peer);
    await lab.expectError("select transition_task_reviewed($1,'Pendiente','Corrección',1,$2)",[task,lab.next()],/cerrado/);
    await lab.actor(ids.boss,"aal2");
    await lab.first("select close_employee_month($1,$2::date,'Revisado') id",[ids.peer,lab.period]);
    expect((await lab.first("select close_employee_month($1,$2::date,'Repetición') id",[ids.owner,lab.period])).id).toBe(first);
    await lab.admin();
    const reports=await lab.rows("select owner_id,snapshot from period_reports order by owner_id");
    expect(reports.map(r=>r.snapshot.version)).toEqual([4,4]);
    expect(reports.map(r=>r.snapshot.metrics.points)).toEqual([3,2]);
    expect(reports.reduce((s,r)=>s+r.snapshot.metrics.earned,0)).toBe(5);
    expect(reports.every(r=>r.snapshot.tasks.length===1 && r.snapshot.tasks[0].taskId===task)).toBe(true);
    expect(await lab.first("select count(*)::int n from report_outbox_events")).toEqual({n:2});
    await lab.actor(ids.manager,"aal2");
    expect(await lab.rows("select id from period_reports")).toHaveLength(1);
    await lab.actor(ids.peer);
    expect(await lab.rows("select id from period_reports")).toHaveLength(1);
  });
  it("records own coverage with zero score and does not freeze the titular's later activity", async () => {
    const task=await lab.task({kind:"operativa"}); await coverage(task);
    await lab.actor(ids.peer);
    await lab.first("select record_activity_once($1,$2::date,4,'Cobertura',$3)",[task,lab.day,lab.next()]);
    await lab.actor(ids.boss,"aal2");
    await lab.first("select close_employee_month($1,$2::date,'Aporte revisado')",[ids.peer,lab.period]);
    await lab.admin();
    const before=(await lab.first("select snapshot from period_reports where owner_id=$1",[ids.peer])).snapshot;
    expect(before.metrics.points).toBe(0);
    expect(before.contributions[0]).toMatchObject({role:"coverage",weightedPossible:0,weightedEarned:0,quantity:4});
    await lab.actor(ids.owner);
    await lab.first("select record_activity_once($1,$2::date,2,'Titular',$3)",[task,lab.day,lab.next()]);
    await lab.admin();
    expect((await lab.first("select snapshot from period_reports where owner_id=$1",[ids.peer])).snapshot).toEqual(before);
  });
  it("never includes peer sessions, activity or private notes in an employee report", async () => {
    const task=await lab.task({kind:"operativa"}); await coverage(task);
    await lab.actor(ids.owner);
    await lab.first("select record_activity_once($1,$2::date,3,'Titular',$3)",[task,lab.day,lab.next()]);
    await lab.first("select save_private_block_note($1,'Privado',0,$2)",[task,lab.next()]);
    await lab.actor(ids.peer);
    await lab.first("select record_activity_once($1,$2::date,2,'Compañero',$3)",[task,lab.day,lab.next()]);
    await lab.actor(ids.boss,"aal2");
    await lab.first("select close_employee_month($1,$2::date,'Revisado')",[ids.owner,lab.period]);
    await lab.admin();
    const snapshot=(await lab.first("select snapshot from period_reports")).snapshot;
    expect(snapshot.activity).toHaveLength(1);
    expect(snapshot.activity[0].actor_id).toBe(ids.owner);
    expect(JSON.stringify(snapshot)).not.toContain("Privado");
    expect(snapshot.contributions[0].quantity).toBe(3);
    expect(snapshot.metrics.earned).toBe(0.63); // exact 5 * (5/40), rounded only in metrics
  });
  it("uses only the new lock namespaces in every final writer and denies internal helper execution", async () => {
    await lab.admin();
    const writers=["start_task_timer","pause_task_timer","_coordination_apply_task_control","_coordination_record_activity","close_employee_month","materialize_month","create_catalog_assignment","approve_employee_absence","cancel_employee_absence","approve_onboarding","save_private_block_note","update_template_weight","create_task_template","approve_task_coverage_plan","cancel_task_coverage_binding","assign_task_responsibility","_get_mutation_receipt"];
    const definitions=await lab.rows("select p.proname,pg_get_functiondef(p.oid) body from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any($1::text[])",[writers]);
    expect(definitions).toHaveLength(writers.length);
    expect(definitions.every(r=>!r.body.includes("hashtextextended") && !r.body.includes("pg_advisory_xact_lock"))).toBe(true);
    for(const role of ["anon","authenticated","service_role"]){
      expect((await lab.first("select bool_or(has_function_privilege($1,p.oid,'EXECUTE')) allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like '\\_coordination\\_%' escape '\\' or p.proname=any($2::text[]))",[role,["_guard_coverage_binding","_get_mutation_receipt"]])).allowed).toBe(false);
    }
  });
  it("detects both footprint expansion and reduction and rolls back before a new receipt", async () => {
    const task=await lab.task(); await lab.actor(ids.boss,"aal2");
    // Internal helpers are tested under the migration owner, not exposed to Auth roles.
    await lab.expectError("select _coordination_prepare(array[$1::uuid],array[$2::uuid],array[$3::uuid],'[]','{}') p",[task,ids.boss,ids.owner],/permission denied/);
    await lab.admin();
    const plan=(await lab.first("select _coordination_prepare(array[$1::uuid],array[$2::uuid],array[$3::uuid],'[]','{}') p",[task,ids.boss,ids.owner])).p;
    await lab.db.query("update task_instances set state_revision=state_revision+1 where id=$1",[task]);
    await lab.expectError("select _coordination_revalidate($1::jsonb)",[JSON.stringify(plan)],/Cambió el ámbito/);
    const scope={kind:"close",owner:ids.owner,period:lab.period};
    const closurePlan=(await lab.first("select _coordination_prepare('{}','{}','{}','[]','{}',$1::jsonb) p",[JSON.stringify(scope)])).p;
    await lab.task();
    await lab.expectError("select _coordination_revalidate($1::jsonb)",[JSON.stringify(closurePlan)],/Cambió el ámbito/);
    const reducedPlan=(await lab.first("select _coordination_prepare(array[$1::uuid],'{}',array[$2::uuid],'[]','{}') p",[task,ids.owner])).p;
    await lab.db.query("delete from company_memberships where profile_id=$1 and company_id=$2",[ids.owner,ids.otherCompany]);
    await lab.expectError("select _coordination_revalidate($1::jsonb)",[JSON.stringify(reducedPlan)],/Cambió el ámbito/);
  });
  it("starts legacy covered clocks with explicit absence provenance and stops them without changing actor", async () => {
    const task=await lab.task(); const absence=await lab.absence();
    await lab.actor(ids.peer);
    const session=(await lab.first("select start_task_timer($1,0,$2,false) id",[task,lab.next()])).id;
    await lab.admin();
    expect(await lab.first("select contribution_kind,absence_id,coverage_binding_id from task_time_sessions where id=$1",[session])).toEqual({contribution_kind:"coverage",absence_id:absence,coverage_binding_id:null});
    await lab.actor(ids.boss,"aal2");
    await lab.first("select cancel_employee_absence($1,'Fin',$2)",[absence,lab.next()]);
    await lab.admin();
    expect(await lab.first("select actor_id,ended_at is not null ended from task_time_sessions where id=$1",[session])).toEqual({actor_id:ids.peer,ended:true});
  });
  it("preserves existing v3 reports, recipients and outbox bytes when upgrading populated 010", async () => {
    const upgrade=await new AccountingLab().init(stages.m010);
    try{
      await upgrade.task(); await upgrade.actor(ids.boss,"aal2");
      await upgrade.first("select close_employee_month($1,$2::date,'Histórico')",[ids.owner,upgrade.period]);
      await upgrade.admin();
      const before=await upgrade.rows("select snapshot::text from period_reports");
      expect(JSON.parse(before[0].snapshot).version).toBe(3);
      const delivery=await upgrade.rows("select to_jsonb(d)::text row from report_deliveries d");
      const events=await upgrade.rows("select to_jsonb(e)::text row from report_outbox_events e");
      await upgrade.migrate(stages.m010,stages.m011);
      expect(await upgrade.rows("select snapshot::text from period_reports")).toEqual(before);
      expect(await upgrade.rows("select to_jsonb(d)::text row from report_deliveries d")).toEqual(delivery);
      expect(await upgrade.rows("select to_jsonb(e)::text row from report_outbox_events e")).toEqual(events);
      await upgrade.actor(ids.manager,"aal2");
      expect(await upgrade.rows("select id from period_reports")).toHaveLength(1);
    }finally{await upgrade.close();}
  });
  it("keeps real actor seconds separate from responsibility percentages", async () => {
    const task=await lab.task(); await joint(task);
    await lab.session(task,ids.owner,null,`${lab.period}T12:00:00Z`,`${lab.period}T12:00:10Z`);
    await lab.session(task,ids.peer,null,`${lab.period}T12:00:00Z`,`${lab.period}T12:00:20Z`);
    await lab.actor(ids.boss,"aal2");
    for(const owner of [ids.owner,ids.peer])await lab.first("select close_employee_month($1,$2::date,'Horas revisadas')",[owner,lab.period]);
    await lab.admin();
    const reports=await lab.rows("select snapshot from period_reports order by owner_id");
    expect(reports.map(r=>r.snapshot.metrics.recordedSeconds)).toEqual([10,20]);
    expect(reports.every(r=>r.snapshot.sessions.length===1)).toBe(true);
  });
  it("rolls back an invalid recipient without closure, report or outbox", async () => {
    await lab.task(); await lab.admin();
    await lab.db.query("update auth.users set email_confirmed_at=null where id=$1",[ids.boss]);
    const before=await lab.capture();
    await lab.actor(ids.boss,"aal2");
    await lab.expectError("select close_employee_month($1,$2::date,'Revisado')",[ids.owner,lab.period],/correo verificado/);
    expect(await lab.capture()).toEqual(before);
  });
  it("expires an earlier binding's own clock before starting the same task under a new disjoint binding", async () => {
    const task=await lab.task();
    const previous=(await lab.first("select ($1::date-1)::text d",[lab.day])).d;
    await coverage(task,false,ids.peer,previous,previous);
    await lab.admin();
    const old=(await lab.first("select id from task_coverage_bindings where instance_id=$1",[task])).id;
    const session=lab.next();
    await lab.db.query("insert into task_time_sessions(id,organization_id,instance_id,actor_id,started_at,contribution_kind,coverage_binding_id) values($1,$2,$3,$4,$5::date::timestamp at time zone 'America/Argentina/Buenos_Aires','coverage',$6)",[session,ids.org,task,ids.peer,previous,old]);
    await coverage(task,false,ids.peer,lab.day,lab.day);
    await lab.actor(ids.peer);
    const newId=(await lab.first("select start_task_timer($1,0,$2,false) id",[task,lab.next()])).id;
    expect(newId).not.toBe(session);
    await lab.admin();
    expect(await lab.first("select ended_at is not null ended from task_time_sessions where id=$1",[session])).toEqual({ended:true});
    expect(await lab.first("select count(*)::int n from task_time_sessions where actor_id=$1 and ended_at is null",[ids.peer])).toEqual({n:1});
  });
  it("revokes precise access immediately when the titular is suspended or the substitute loses its work role", async () => {
    const task=await lab.task(); await coverage(task);
    await lab.admin();
    await lab.db.query("update profiles set active=false where id=$1",[ids.owner]);
    await lab.actor(ids.peer);
    expect(await lab.first("select can_access_instance($1) ok",[task])).toEqual({ok:false});
    await lab.admin();
    await lab.db.query("update profiles set active=true where id=$1",[ids.owner]);
    await lab.db.query("update profiles set role='auditor' where id=$1",[ids.peer]);
    await lab.actor(ids.peer);
    expect(await lab.first("select can_access_instance($1) ok",[task])).toEqual({ok:false});
  });
});
