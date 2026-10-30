import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AccountingLab, ids, stages } from "./helpers/accounting-lab";

const sql017 = readFileSync(new URL("../supabase/migrations/202610290017_activity_executor_authorization.sql", import.meta.url), "utf8");

describe("Supabase activity executor authorization migration 017", () => {
  it("upgrades from 016 without changing public and internal execute permissions", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m016);
      await lab.migrate(stages.m016, stages.m017);
      expect(await lab.first(`select
        has_function_privilege('authenticated','public.record_activity_once(uuid,date,integer,text,uuid)','execute') public_allowed,
        has_function_privilege('anon','public.record_activity_once(uuid,date,integer,text,uuid)','execute') anon_allowed,
        has_function_privilege('authenticated','public._coordination_record_activity(uuid,date,integer,text,uuid,text)','execute') internal_allowed`))
        .toEqual({ public_allowed: true, anon_allowed: false, internal_allowed: false });
    } finally { await lab.db.close(); }
  }, 30_000);

  it("allows actual executors and denies supervisors with read-only task scope", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m017);
      await lab.db.exec(sql017);
      const task = await lab.task({ kind: "operativa" });
      const record = (operationId: string) => lab.first(
        "select public.record_activity_once($1,$2::date,3,'Lote autorizado',$3) entry_id",
        [task, lab.day, operationId],
      );

      await lab.actor(ids.manager, "aal2", "authenticated");
      await expect(record(lab.next())).rejects.toThrow("Sin permiso para registrar actividad");
      await lab.admin();
      expect(await lab.first("select count(*)::int count from activity_entries where instance_id=$1", [task]))
        .toEqual({ count: 0 });

      await lab.actor(ids.owner, "aal1", "authenticated");
      const created = await record(lab.next());
      expect(created.entry_id).toBeTruthy();
      await lab.actor(ids.manager, "aal2", "authenticated");
      await expect(record(lab.next())).rejects.toThrow("Sin permiso para registrar actividad");
      await lab.admin();
      expect(await lab.first("select actor_id from activity_entries where instance_id=$1", [task]))
        .toEqual({ actor_id: ids.owner });

      const coveredTask = await lab.task({ kind: "operativa" });
      const coveragePlan = lab.next();
      await lab.admin();
      await lab.db.query("update task_assignments set frequency='unica' where id=(select assignment_id from task_instances where id=$1)", [coveredTask]);
      await lab.db.query(`insert into task_coverage_plans(id,organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by,handover_note)
        values($1,$2,$3,$4,$5::date,$5::date,'licencia',$6,'Reemplazo de prueba')`,
        [coveragePlan, ids.org, ids.owner, ids.peer, lab.day, ids.boss]);
      await lab.db.query(`insert into task_coverage_plan_instances(plan_id,organization_id,instance_id,company_id_snapshot,period_snapshot)
        select $1,organization_id,id,company_id,period from task_instances where id=$2`, [coveragePlan, coveredTask]);
      await lab.db.query("update task_coverage_plans set sealed=true,sealed_by=$2,sealed_at=clock_timestamp() where id=$1", [coveragePlan, ids.boss]);
      await lab.actor(ids.boss, "aal2", "authenticated");
      await lab.first("select public.approve_task_coverage_plan($1,$2)", [coveragePlan, lab.next()]);
      await lab.admin();
      const binding = (await lab.first("select id from task_coverage_bindings where plan_id=$1 and instance_id=$2", [coveragePlan, coveredTask])).id;
      const coveredOperation = lab.next();
      await lab.actor(ids.peer, "aal1", "authenticated");
      const covered = await lab.first(
        "select public.record_activity_once($1,$2::date,2,'Movimiento cubierto',$3) entry_id",
        [coveredTask, lab.day, coveredOperation],
      );
      await lab.admin();
      expect(await lab.first("select actor_id from activity_entries where id=$1", [covered.entry_id]))
        .toEqual({ actor_id: ids.peer });

      await lab.actor(ids.boss, "aal2", "authenticated");
      await lab.first("select public.cancel_task_coverage_binding($1,'Cobertura finalizada',$2)", [binding, lab.next()]);
      await lab.actor(ids.peer, "aal1", "authenticated");
      await expect(lab.first(
        "select public.record_activity_once($1,$2::date,2,'Movimiento cubierto',$3)",
        [coveredTask, lab.day, coveredOperation],
      )).rejects.toThrow();
      await expect(lab.first(
        "select public.record_activity_once($1,$2::date,1,'Nuevo movimiento',$3)",
        [coveredTask, lab.day, lab.next()],
      )).rejects.toThrow();
    } finally { await lab.db.close(); }
  }, 30_000);

  it("keeps historic jointly assigned operational tasks read-only pending review", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m017);
      const task = await lab.task({ kind: "operativa" });
      const setId = lab.next();
      await lab.admin();
      await lab.db.query("update task_assignments set frequency='unica' where id=(select assignment_id from task_instances where id=$1)", [task]);
      await lab.db.query(`insert into task_responsibility_sets(
        id,organization_id,instance_id,revision,mode,origin,anchor_owner_id,company_id_snapshot,
        period_snapshot,team_id_snapshot,sector_source,captured_by,reason)
        select $1,organization_id,id,2,'conjunta','explicit',owner_id,company_id,period,team_id,'unknown',$3,'Revisión de fixture'
        from task_instances where id=$2`, [setId, task, ids.boss]);
      await lab.db.query("insert into task_responsibility_members(set_id,organization_id,profile_id,share_bps) values($1,$2,$3,6000),($1,$2,$4,4000)",
        [setId, ids.org, ids.owner, ids.peer]);
      await lab.db.query("update task_responsibility_sets set sealed=true where id=$1", [setId]);
      // Model a legacy row that predates the current write guard; new writes
      // must remain denied even if historical data contains this shape.
      await lab.db.exec("alter table task_responsibility_heads disable trigger task_responsibility_head_guard");
      await lab.db.query("update task_responsibility_heads set set_id=$3 where instance_id=$1 and organization_id=$2",
        [task, ids.org, setId]);
      await lab.db.exec("alter table task_responsibility_heads enable trigger task_responsibility_head_guard");

      await lab.actor(ids.owner, "aal1", "authenticated");
      await expect(lab.first("select public.record_activity_once($1,$2::date,3,'Lote conjunto',$3)",
        [task, lab.day, lab.next()])).rejects.toThrow("GP_JOINT_OPERATION_REQUIRES_REVIEW");
      await lab.actor(ids.peer, "aal1", "authenticated");
      await expect(lab.first("select public.record_activity_once($1,$2::date,3,'Lote conjunto',$3)",
        [task, lab.day, lab.next()])).rejects.toThrow("GP_JOINT_OPERATION_REQUIRES_REVIEW");
      await lab.admin();
      expect(await lab.first("select count(*)::int count from activity_entries where instance_id=$1", [task]))
        .toEqual({ count: 0 });
    } finally { await lab.db.close(); }
  }, 30_000);
});
