import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AccountingLab, ids, stages } from "./helpers/accounting-lab";
import { coordinatedTaskSchema } from "../src/data/remote/coordination-contract";

const sql016 = readFileSync(new URL("../supabase/migrations/202610260016_manager_task_revocation.sql", import.meta.url), "utf8");

describe("Supabase manager task read revocation migration 016", () => {
  it("preserves the 014→015→016 upgrade path and is safe to reapply", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m014);
      await lab.migrate(stages.m014, stages.m015);
      await lab.migrate(stages.m015, stages.m016);
      await lab.db.exec(sql016);
      expect(await lab.first("select has_function_privilege('authenticated','public.read_coordinated_task_for_manager(uuid)','execute') allowed")).toEqual({ allowed: true });
      expect(await lab.first("select has_function_privilege('anon','public.read_coordinated_task_for_manager(uuid)','execute') allowed")).toEqual({ allowed: false });
      expect(await lab.first("select has_function_privilege('public','public.read_coordinated_task_for_manager(uuid)','execute') allowed")).toEqual({ allowed: false });
    } finally { await lab.db.close(); }
  });

  it("denies manager reads after api.command_v1 revokes membership while preserving the row, then permits valid reactivation", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m016);
      const task = await lab.task();
      const read = () => lab.first("select public.read_coordinated_task_for_manager($1) result", [task]);
      await lab.actor(ids.manager, "aal2", "authenticated");
      const before = await read();
      expect(before.result.schemaVersion).toBe(3);

      const membershipKey = `membership:${ids.company}:${ids.manager}`;
      const command = async (active: boolean, revision: number) => {
        await lab.actor(ids.boss, "aal2", "authenticated");
        return lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify({
          contractVersion: 1,
          operationId: lab.next(),
          kind: "companyMembership.setActive",
          expectedRevisions: { [membershipKey]: String(revision) },
          payload: { companyId: ids.company, profileId: ids.manager, active, reason: active ? "Reactivación de prueba" : "Revocación de prueba" },
        })]);
      };
      await command(false, 0);
      expect(await lab.first("select active,revision from company_memberships where organization_id=$1 and company_id=$2 and profile_id=$3", [ids.org, ids.company, ids.manager]))
        .toEqual({ active: false, revision: 1 });
      expect(await lab.first("select count(*)::int count from company_memberships where organization_id=$1 and company_id=$2 and profile_id=$3", [ids.org, ids.company, ids.manager])).toEqual({ count: 1 });
      await lab.actor(ids.manager, "aal2", "authenticated");
      await expect(read()).rejects.toThrow("Fuera del ámbito");

      await command(true, 1);
      const reactivated = await lab.first("select active,revision,access_valid_from is not null valid_from from company_memberships where organization_id=$1 and company_id=$2 and profile_id=$3", [ids.org, ids.company, ids.manager]);
      expect(reactivated).toEqual({ active: true, revision: 2, valid_from: true });
      await lab.actor(ids.manager, "aal2", "authenticated");
      expect((await read()).result.schemaVersion).toBe(3);

      await lab.admin();
      await lab.db.query("update company_memberships set access_valid_from=clock_timestamp()+interval '1 hour' where organization_id=$1 and company_id=$2 and profile_id=$3", [ids.org, ids.company, ids.manager]);
      await lab.actor(ids.manager, "aal2", "authenticated");
      await expect(read()).rejects.toThrow("Fuera del ámbito");
    } finally { await lab.db.close(); }
  }, 30_000);

  it("reauthorizes an operational activity receipt replay after company membership is revoked", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m017);
      const task = await lab.task({ owner: ids.owner, kind: "operativa" });
      const operationId = lab.next();
      const record = () => lab.first(
        "select public.record_activity_once($1,$2::date,3,'Lote de prueba',$3) entry_id",
        [task, lab.day, operationId],
      );

      await lab.actor(ids.owner, "aal1", "authenticated");
      const first = await record();
      expect(first.entry_id).toBeTruthy();

      await lab.actor(ids.boss, "aal2", "authenticated");
      await lab.first("select api.command_v1($1::jsonb) result", [JSON.stringify({
        contractVersion: 1,
        operationId: lab.next(),
        kind: "companyMembership.setActive",
        expectedRevisions: { [`membership:${ids.company}:${ids.owner}`]: "0" },
        payload: { companyId: ids.company, profileId: ids.owner, active: false, reason: "Revocación para replay de actividad" },
      })]);

      const state = () => lab.first(`select jsonb_build_object(
        'activityCount',(select count(*) from activity_entries where instance_id=$1),
        'receiptCount',(select count(*) from task_mutation_receipts where actor_id=$2 and operation_id=$3),
        'taskRevision',(select state_revision from task_instances where id=$1),
        'activityAuditCount',(select count(*) from audit_events where actor_id=$2 and action='activity.created' and entity_id=$4)
      ) value`, [task, ids.owner, operationId, first.entry_id]).then((row) => row.value);
      await lab.admin();
      const beforeReplay = await state();

      await lab.actor(ids.owner, "aal1", "authenticated");
      await expect(record()).rejects.toThrow();
      await lab.admin();
      expect(await state()).toEqual(beforeReplay);
    } finally { await lab.db.close(); }
  }, 30_000);

  it("keeps manager scope, organization boundaries, active actor checks, private notes and DTO v3 intact", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m016);
      const inScope = await lab.task({ owner: ids.owner, checklist: [{ id: "c1", text: "Check", done: false }] });
      const outScope = await lab.task({ owner: ids.peer });
      const foreignCompany = lab.next(), foreignTeam = lab.next(), foreignAssignment = lab.next(), crossOrgTask = lab.next();
      await lab.admin();
      await lab.db.query("insert into companies(id,organization_id,name) values($1,$2,'Foreign')", [foreignCompany, ids.otherOrg]);
      await lab.db.query("insert into teams(id,organization_id,name,manager_id) values($1,$2,'Foreign',$3)", [foreignTeam, ids.otherOrg, ids.outsider]);
      await lab.db.query("insert into team_members(organization_id,team_id,profile_id) values($1,$2,$3)", [ids.otherOrg, foreignTeam, ids.outsider]);
      await lab.db.query("insert into company_memberships(organization_id,company_id,profile_id) values($1,$2,$3)", [ids.otherOrg, foreignCompany, ids.outsider]);
      await lab.db.query("insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day,unit,target,checklist) values($1,$2,$3,$4,$5,'Foreign task','resultado',5,'mensual',$6,15,null,null,'[]'::jsonb)", [foreignAssignment, ids.otherOrg, foreignCompany, ids.outsider, foreignTeam, lab.period]);
      await lab.db.query("insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,checklist) values($1,$2,$3,$4,$5,$6,$7,$7,'Foreign task','resultado',5,'[]'::jsonb)", [crossOrgTask, ids.otherOrg, foreignAssignment, foreignCompany, ids.outsider, foreignTeam, lab.period]);
      const note = lab.next();
      await lab.admin();
      await lab.db.query("insert into task_private_block_notes(id,organization_id,instance_id,author_id,body,revision) values($1,$2,$3,$4,'secreto de prueba',1)", [note, ids.org, inScope, ids.owner]);
      await lab.actor(ids.manager, "aal2", "authenticated");
      const payload = (await lab.first("select public.read_coordinated_task_for_manager($1) result", [inScope])).result;
      expect(Object.keys(payload).sort()).toEqual(["checklist", "companyId", "completedAt", "coverage", "dueDate", "dueState", "isBlocked", "kind", "members", "myContribution", "period", "responsibility", "scheduledOn", "schemaVersion", "startedAt", "stateRevision", "status", "taskId", "target", "title", "unit", "weight"].sort());
      expect(coordinatedTaskSchema.parse(payload)).toEqual(payload);
      expect(JSON.stringify(payload)).not.toContain("secreto de prueba");
      await expect(lab.first("select public.read_coordinated_task_for_manager($1)", [outScope])).rejects.toThrow("Fuera del ámbito");
      await expect(lab.first("select public.read_coordinated_task_for_manager($1)", [crossOrgTask])).rejects.toThrow("Fuera del ámbito");
      await expect(lab.first("select public.read_coordinated_task_for_manager($1)", [lab.next()])).rejects.toThrow("Fuera del ámbito");

      const secondCompanyTask = await lab.task({ owner: ids.owner, company: ids.otherCompany });
      await lab.actor(ids.manager, "aal2", "authenticated");
      await expect(lab.first("select public.read_coordinated_task_for_manager($1) result", [secondCompanyTask])).resolves.toMatchObject({ result: { schemaVersion: 3 } });

      await lab.admin();
      await lab.actor(ids.owner, "aal2", "authenticated");
      await expect(lab.first("select public.read_coordinated_task_for_manager($1)", [inScope])).rejects.toThrow("Sin permiso");
      await lab.actor(ids.manager, "aal2", "authenticated");
      await expect(lab.first("select public.read_coordinated_task_for_manager($1)", [lab.next()])).rejects.toThrow("Fuera del ámbito");

      await lab.admin();
      await lab.db.query("update profiles set active=false where id=$1", [ids.manager]);
      await lab.actor(ids.manager, "aal2", "authenticated");
      await expect(lab.first("select public.read_coordinated_task_for_manager($1)", [inScope])).rejects.toThrow();

      await lab.admin();
      await lab.db.exec("set role anon");
      await expect(lab.first("select public.read_coordinated_task_for_manager($1)", [inScope])).rejects.toThrow();
    } finally { await lab.db.close(); }
  });

  it("allows a jefe without company membership and does not let assignment participation widen an encargado's owner scope", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m016);
      const peerTask = await lab.task({ owner: ids.peer });
      await lab.actor(ids.boss, "aal2", "authenticated");
      expect((await lab.first("select public.read_coordinated_task_for_manager($1) result", [peerTask])).result.schemaVersion).toBe(3);

      await lab.admin();
      const responsibility = lab.next();
      await lab.db.query(`insert into task_responsibility_sets(id,organization_id,instance_id,revision,mode,origin,anchor_owner_id,company_id_snapshot,period_snapshot,team_id_snapshot,sector_source,captured_by,reason)
        select $1,organization_id,id,2,'individual','explicit',owner_id,company_id,period,team_id,'unknown',$3,'test participation outside owner scope' from task_instances where id=$2`, [responsibility, peerTask, ids.boss]);
      await lab.db.query("insert into task_responsibility_members(set_id,organization_id,profile_id,share_bps) values($1,$2,$3,10000)", [responsibility, ids.org, ids.manager]);
      await lab.db.query("update task_responsibility_sets set sealed=true where id=$1", [responsibility]);
      await lab.db.query("update task_responsibility_heads set set_id=$1 where instance_id=$2", [responsibility, peerTask]);
      await lab.actor(ids.manager, "aal2", "authenticated");
      await expect(lab.first("select public.read_coordinated_task_for_manager($1)", [peerTask])).rejects.toThrow("Fuera del ámbito");

      await lab.admin();
      await lab.absence(ids.peer, ids.manager, lab.day);
      await lab.actor(ids.manager, "aal2", "authenticated");
      expect(await lab.first("select public.can_access_instance($1) allowed", [peerTask])).toEqual({ allowed: true });
      await expect(lab.first("select public.read_coordinated_task_for_manager($1)", [peerTask])).rejects.toThrow("Fuera del ámbito");
    } finally { await lab.db.close(); }
  });
});
