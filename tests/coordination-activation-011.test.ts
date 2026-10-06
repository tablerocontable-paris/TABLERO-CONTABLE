import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AccountingLab, ids, stages, uid } from "./helpers/accounting-lab";
import { assignTaskResponsibilityInputSchema, coordinatedTaskSchema } from "../src/data/remote/coordination-contract";

describe("011 activation smoke", () => {
  let lab: AccountingLab;
  beforeAll(async () => { lab = await new AccountingLab().init(stages.m011); }, 60_000);
  beforeEach(async () => { await lab.admin(); await lab.db.exec("begin"); });
  afterEach(async () => { await lab.db.exec("rollback; reset role"); });
  afterAll(async () => { await lab?.close(); });
  it("applies migration 011 after the staged 010 foundation", async () => {
    expect(await lab.first("select count(*)::int n from public.task_coverage_bindings")).toEqual({ n: 0 });
    expect(await lab.first("select count(*)::int n from pg_indexes where indexname='one_open_session_per_instance'")).toEqual({ n: 0 });
    expect((await lab.first("select indexdef from pg_indexes where indexname='one_open_session_per_actor_instance'")).indexdef).toContain("UNIQUE INDEX");
  });

  it("upgrades post-010 work rows without dropping activity, note receipts or task identity", async () => {
    const upgrade = await new AccountingLab().init(stages.m010);
    try {
      const task = await upgrade.task({ kind: "operativa" });
      await upgrade.actor(ids.owner);
      const activity = await upgrade.first(
        "select record_activity_once($1,$2::date,2,'Pre-011',$3) id",
        [task, upgrade.day, uid(924)],
      );
      await upgrade.first(
        "select save_private_block_note($1,'Nota preexistente',0,$2)",
        [task, uid(925)],
      );
      await upgrade.admin();
      const before = await upgrade.first(
        "select id,assignment_id,company_id,owner_id,period::text,status,state_revision from task_instances where id=$1",
        [task],
      );
      await upgrade.migrate(stages.m010, stages.m011);
      expect(await upgrade.first(
        "select id,assignment_id,company_id,owner_id,period::text,status,state_revision from task_instances where id=$1",
        [task],
      )).toEqual(before);
      expect(await upgrade.first(
        "select s.mode,m.profile_id,m.share_bps from task_responsibility_heads h join task_responsibility_sets s on s.id=h.set_id join task_responsibility_members m on m.set_id=s.id where h.instance_id=$1",
        [task],
      )).toEqual({ mode: "individual", profile_id: ids.owner, share_bps: 10000 });
      expect(await upgrade.first("select actor_id,quantity from activity_entries where id=$1", [activity.id]))
        .toEqual({ actor_id: ids.owner, quantity: 2 });
      expect(await upgrade.first("select body from task_private_block_notes where instance_id=$1", [task]))
        .toEqual({ body: "Nota preexistente" });
      expect(await upgrade.first("select count(*)::int n from private_block_note_receipts where operation_id=$1", [uid(925)]))
        .toEqual({ n: 1 });
    } finally {
      await upgrade.close();
    }
  });

  it("assigns one punctual task jointly with frozen shares and grants only participant access", async () => {
    const task = await lab.task();
    await lab.admin();
    await lab.db.query("update task_assignments set frequency='unica' where id=(select assignment_id from task_instances where id=$1)", [task]);
    await lab.actor(ids.boss, "aal2");
    const members = [{ profileId: ids.owner, shareBps: 6000 }, { profileId: ids.peer, shareBps: 4000 }];
    const revision = await lab.first("select assign_task_responsibility($1,$2::jsonb,'Preparación conjunta',1,$3) revision",
      [task, JSON.stringify(members), uid(900)]);
    expect(revision.revision).toBe(2);
    await lab.actor(ids.peer);
    expect(await lab.rows("select id from task_instances where id=$1", [task])).toHaveLength(1);
    const dto=(await lab.first("select read_coordinated_task($1) data",[task])).data;
    expect(coordinatedTaskSchema.parse(dto)).toMatchObject({
      schemaVersion:3,taskId:task,
      members:[
        {profileId:ids.owner,displayName:"empleado",shareBps:6000},
        {profileId:ids.peer,displayName:"empleado",shareBps:4000},
      ],
      myContribution:{kind:"responsible",shareBps:4000},
    });
    expect(dto).not.toHaveProperty("blocked_by");
    expect(dto).not.toHaveProperty("sessions");
    await lab.admin();
    expect(await lab.first("select mode from task_responsibility_sets where instance_id=$1 and revision=2", [task])).toEqual({ mode: "conjunta" });
    expect(await lab.rows("select profile_id,share_bps from task_responsibility_members m join task_responsibility_sets s on s.id=m.set_id where s.instance_id=$1 and s.revision=2 order by profile_id", [task]))
      .toEqual([{ profile_id: ids.owner, share_bps: 6000 }, { profile_id: ids.peer, share_bps: 4000 }]);
  });

  it("strictly validates the joint assignment input and rejects repeated member IDs or extra data", () => {
    const input={instanceId:uid(920),members:[{profileId:ids.owner,shareBps:5000},{profileId:ids.peer,shareBps:5000}],
      reason:"Auditoría de cuenta",expectedRevision:1,idempotencyKey:uid(921)};
    expect(assignTaskResponsibilityInputSchema.parse(input)).toEqual(input);
    expect(assignTaskResponsibilityInputSchema.safeParse({...input,extra:"no"}).success).toBe(false);
    expect(assignTaskResponsibilityInputSchema.safeParse({...input,members:[input.members[0],{...input.members[1],profileId:ids.owner}]}).success).toBe(false);
  });

  it("records operational activity once under the new receipt lock and preserves the real actor", async () => {
    const task=await lab.task({kind:"operativa"});
    const operation=uid(922);
    await lab.actor(ids.owner);
    const first=(await lab.first("select record_activity_once($1,$2::date,3,'Facturas verificadas',$3) id",[task,lab.day,operation])).id;
    const replay=(await lab.first("select record_activity_once($1,$2::date,3,'Facturas verificadas',$3) id",[task,lab.day,operation])).id;
    expect(replay).toBe(first);
    await lab.expectError("select record_activity_once($1,$2::date,4,'Facturas verificadas',$3)",[task,lab.day,operation],/otros argumentos/i);
    await lab.admin();
    expect(await lab.first("select actor_id,quantity from activity_entries where id=$1",[first])).toEqual({actor_id:ids.owner,quantity:3});
    expect(await lab.first("select count(*)::int n from activity_entries where instance_id=$1",[task])).toEqual({n:1});
  });

  it("keeps a participant's private block note out of the shared task DTO and other employees' reads", async () => {
    const task=await lab.task();
    await lab.actor(ids.owner);
    const note=(await lab.first("select save_private_block_note($1,'Falta respuesta bancaria',0,$2) result",[task,uid(923)])).result;
    expect(note).toMatchObject({revision:1,cleared:false});
    const dto=(await lab.first("select read_coordinated_task($1) data",[task])).data;
    expect(dto).not.toHaveProperty("privateNote");
    expect(dto).not.toHaveProperty("blocked_by");
    await lab.actor(ids.peer);
    expect(await lab.rows("select body from task_private_block_notes where instance_id=$1",[task])).toEqual([]);
    await lab.actor(ids.manager);
    expect(await lab.rows("select body from task_private_block_notes where instance_id=$1",[task])).toEqual([{body:"Falta respuesta bancaria"}]);
  });

  it("rejects habitual, evidence-bearing, non-anchor and out-of-company joint assignments", async () => {
    const task = await lab.task();
    const members = JSON.stringify([{ profileId: ids.owner, shareBps: 5000 }, { profileId: ids.peer, shareBps: 5000 }]);
    await lab.actor(ids.boss, "aal2");
    await lab.expectError("select assign_task_responsibility($1,$2::jsonb,'Motivo',1,$3)", [task, members, uid(901)], /puntual/);
    await lab.admin();
    await lab.db.query("update task_assignments set frequency='unica' where id=(select assignment_id from task_instances where id=$1)", [task]);
    await lab.db.query("insert into activity_entries(organization_id,instance_id,work_date,quantity,reference,actor_id) values($1,$2,$3,1,'x',$4)",
      [ids.org, task, lab.day, ids.owner]);
    await lab.actor(ids.boss, "aal2");
    await lab.expectError("select assign_task_responsibility($1,$2::jsonb,'Motivo',1,$3)", [task, members, uid(902)], /evidencia/);
    await lab.admin();
    const other = await lab.task({ owner: ids.sourceOwner });
    await lab.db.query("update task_assignments set frequency='unica' where id=(select assignment_id from task_instances where id=$1)", [other]);
    await lab.actor(ids.boss, "aal2");
    await lab.expectError("select assign_task_responsibility($1,$2::jsonb,'Motivo',1,$3)",
      [other, JSON.stringify([{ profileId: ids.sourceOwner, shareBps: 5000 }, { profileId: ids.outsider, shareBps: 5000 }]), uid(903)], /empresa/);
  });

  it("approves a sealed selected-occurrence coverage and cancels it without changing its historical task identity", async () => {
    const task = await lab.task({ period: lab.period });
    const plan = uid(904);
    await lab.admin();
    await lab.db.query("update task_assignments set frequency='unica' where id=(select assignment_id from task_instances where id=$1)", [task]);
    await lab.db.query(`insert into task_coverage_plans(id,organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by,handover_note)
      values($1,$2,$3,$4,$5::date,$5::date+2,'vacaciones',$6,'handover')`, [plan,ids.org,ids.owner,ids.peer,lab.day,ids.boss]);
    await lab.db.query(`insert into task_coverage_plan_instances(plan_id,organization_id,instance_id,company_id_snapshot,period_snapshot)
      select $1,organization_id,id,company_id,period from task_instances where id=$2`, [plan,task]);
    await lab.db.query("update task_coverage_plans set sealed=true,sealed_by=$2,sealed_at=clock_timestamp() where id=$1", [plan,ids.boss]);
    await lab.actor(ids.boss,"aal2");
    expect(await lab.first("select approve_task_coverage_plan($1,$2) n",[plan,uid(905)])).toEqual({n:1});
    await lab.admin();
    const binding=(await lab.first("select id from task_coverage_bindings where instance_id=$1",[task])).id;
    await lab.actor(ids.peer);
    expect((await lab.first("select can_access_instance($1) ok",[task])).ok).toBe(true);
    const session=(await lab.first("select start_task_timer($1,0,$2,false) id",[task,uid(916)])).id;
    expect((await lab.first("select contribution_kind from task_time_sessions where id=$1",[session]))).toEqual({contribution_kind:"coverage"});
    await lab.actor(ids.boss,"aal2");
    await lab.db.query("select cancel_task_coverage_binding($1,'Cancelada',$2)",[binding,uid(906)]);
    await lab.actor(ids.peer);
    expect((await lab.first("select can_access_instance($1) ok",[task])).ok).toBe(false);
    await lab.admin();
    expect((await lab.first("select status from task_coverage_bindings where id=$1",[binding])).status).toBe("cancelled");
    expect((await lab.first("select ended_at is not null ended from task_time_sessions where id=$1",[session])).ended).toBe(true);
    expect((await lab.first("select owner_id,period::text from task_instances where id=$1",[task]))).toEqual({owner_id:ids.owner,period:lab.period});
  });

  it("allows two responsible clocks but keeps peer session detail private and pauses only its own clock", async () => {
    const task = await lab.task();
    await lab.admin();
    await lab.db.query("update task_assignments set frequency='unica' where id=(select assignment_id from task_instances where id=$1)", [task]);
    await lab.actor(ids.boss,"aal2");
    const members = JSON.stringify([{profileId:ids.owner,shareBps:5000},{profileId:ids.peer,shareBps:5000}]);
    await lab.first("select assign_task_responsibility($1,$2::jsonb,'Trabajo en dupla',1,$3)",[task,members,uid(907)]);
    await lab.actor(ids.owner);
    const first = (await lab.first("select start_task_timer($1,1,$2,false) id",[task,uid(908)])).id;
    await lab.actor(ids.peer);
    const second = (await lab.first("select start_task_timer($1,2,$2,false) id",[task,uid(909)])).id;
    expect(first).not.toBe(second);
    expect(await lab.first("select count(*)::int n from task_time_sessions where instance_id=$1 and ended_at is null",[task])).toEqual({n:1});
    expect(await lab.first("select count(*)::int n from task_time_sessions where instance_id=$1",[task])).toEqual({n:1});
    await lab.admin();
    expect(await lab.first("select count(*)::int n from task_time_sessions where instance_id=$1",[task])).toEqual({n:2});
    await lab.actor(ids.owner);
    await lab.first("select pause_task_timer($1,$2) ended",[first,uid(910)]);
    await lab.admin();
    expect(await lab.first("select count(*)::int n from task_time_sessions where instance_id=$1 and ended_at is null",[task])).toEqual({n:1});
    expect(await lab.first("select actor_id from task_time_sessions where id=$1",[second])).toEqual({actor_id:ids.peer});
  });

  it("requires privileged review to complete a joint task while both members have clocks, then stops both atomically", async () => {
    const task = await lab.task({ checklist:[{id:"review",text:"Revisar papeles",done:false}] });
    await lab.admin();
    await lab.db.query("update task_assignments set frequency='unica' where id=(select assignment_id from task_instances where id=$1)",[task]);
    await lab.actor(ids.boss,"aal2");
    const members=JSON.stringify([{profileId:ids.owner,shareBps:5000},{profileId:ids.peer,shareBps:5000}]);
    await lab.first("select assign_task_responsibility($1,$2::jsonb,'Control cruzado',1,$3)",[task,members,uid(911)]);
    await lab.actor(ids.owner);
    const one=(await lab.first("select start_task_timer($1,1,$2,false) id",[task,uid(912)])).id;
    await lab.actor(ids.peer);
    const two=(await lab.first("select start_task_timer($1,2,$2,false) id",[task,uid(913)])).id;
    await lab.actor(ids.boss,"aal2");
    await lab.expectError("select set_checklist_item_reviewed($1,'review',true,'',3,$2)",[task,uid(914)],/superior|interrumpir/i);
    await lab.first("select set_checklist_item_reviewed($1,'review',true,'Cierre validado',3,$2)",[task,uid(915)]);
    await lab.admin();
    expect(await lab.first("select status,state_revision from task_instances where id=$1",[task])).toEqual({status:"Completada",state_revision:4});
    expect(await lab.rows("select id,ended_at is not null ended from task_time_sessions where id=any($1::uuid[]) order by actor_id",[[one,two]])).toEqual([
      {id:one,ended:true},{id:two,ended:true},
    ]);
  });
});
