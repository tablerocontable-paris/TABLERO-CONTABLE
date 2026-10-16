import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { AccountingLab, ids, stages, uid } from "./helpers/accounting-lab";
import { taskResponsibilitySchema } from "../src/data/remote/coordination-contract";

const tables = ["task_responsibility_sets", "task_responsibility_members", "task_responsibility_heads",
  "task_coverage_plans", "task_coverage_plan_instances", "task_coverage_plan_assignment_rules"];
const functions = ["_coordination_text_present(text)", "_validate_task_responsibility_set(uuid)",
  "_guard_task_responsibility_set()", "_guard_task_responsibility_member()", "_guard_task_responsibility_head()",
  "_validate_task_coverage_plan(uuid)", "_guard_task_coverage_plan()", "_guard_task_coverage_selection()",
  "_legacy_task_responsibility(uuid)"];

async function draft(lab: AccountingLab, task: string, opts: {
  mode?: string; origin?: string; revision?: number; members?: [string, number][]; companySnapshot?: string;
} = {}) {
  await lab.admin();
  const id = lab.next();
  await lab.db.query(`insert into task_responsibility_sets(id,organization_id,instance_id,revision,mode,origin,
    anchor_owner_id,company_id_snapshot,period_snapshot,team_id_snapshot,sector_snapshot,sector_source,captured_by,reason)
    select $1,t.organization_id,t.id,$2,$3,$4,t.owner_id,coalesce($7::uuid,t.company_id),t.period,t.team_id,v.sector,
      case when v.id is null then 'unknown' else 'catalog' end,
      case when $4='explicit' then $5::uuid else null end,case when $4='explicit' then 'Fixture staged' else null end
    from task_instances t left join task_template_versions v on v.id=t.template_version_id where t.id=$6`,
    [id, opts.revision ?? 1, opts.mode ?? "individual", opts.origin ?? "explicit", ids.boss, task, opts.companySnapshot ?? null]);
  for (const [profile, share] of opts.members ?? [[ids.owner, 10000]])
    await lab.db.query("insert into task_responsibility_members values($1,$2,$3,$4)", [id, ids.org, profile, share]);
  return id;
}
const seal = (lab: AccountingLab, set: string) => lab.db.query("update task_responsibility_sets set sealed=true where id=$1", [set]);
async function punctual(lab: AccountingLab, task: string) {
  await lab.db.query("update task_assignments set frequency='unica' where id=(select assignment_id from task_instances where id=$1)", [task]);
}
async function plan(lab: AccountingLab, responsible = ids.owner, replacement = ids.peer) {
  const id = lab.next();
  await lab.db.query(`insert into task_coverage_plans(id,organization_id,responsible_id,replacement_id,
    starts_on,ends_on,kind,created_by,handover_note) values($1,$2,$3,$4,'2025-04-10','2025-04-20','vacaciones',$5,'Control habitual')`,
    [id, ids.org, responsible, replacement, ids.boss]);
  return id;
}
async function selectInstance(lab: AccountingLab, planId: string, task: string, set: string | null = null) {
  await lab.db.query(`insert into task_coverage_plan_instances(plan_id,organization_id,instance_id,
    company_id_snapshot,period_snapshot,responsibility_set_id)
    select $1,organization_id,id,company_id,period,$3 from task_instances where id=$2`, [planId, task, set]);
}
async function selectRule(lab: AccountingLab, planId: string, task: string) {
  await lab.db.query(`insert into task_coverage_plan_assignment_rules(plan_id,organization_id,assignment_id,
    company_id_snapshot,assignment_snapshot) select $1,a.organization_id,a.id,a.company_id,to_jsonb(a)
    from task_assignments a join task_instances t on t.assignment_id=a.id where t.id=$2`, [planId, task]);
}
const sealPlanSql = "update task_coverage_plans set sealed=true,sealed_by=$2,sealed_at=clock_timestamp() where id=$1";
const sealPlan = (lab: AccountingLab, id: string) => lab.db.query(sealPlanSql, [id, ids.boss]);

describe("010 staged foundation", () => {
  let lab: AccountingLab;
  beforeAll(async () => { lab = await new AccountingLab().init(stages.m010); }, 60_000);
  beforeEach(async () => { await lab.admin(); await lab.db.exec("begin"); });
  afterEach(async () => { await lab.db.exec("rollback; reset role"); });
  afterAll(async () => { await lab?.close(); });

  it("creates an empty staged base with RLS, no policies or client/service grants", async () => {
    for (const table of tables) {
      expect(await lab.first(`select count(*)::int n from public.${table}`)).toEqual({ n: 0 });
      expect(await lab.first("select relrowsecurity rls from pg_class where oid=$1::regclass", [`public.${table}`])).toEqual({ rls: true });
      expect(await lab.first("select count(*)::int n from pg_policies where schemaname='public' and tablename=$1", [table])).toEqual({ n: 0 });
      for (const role of ["anon", "authenticated", "service_role"])
        for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"])
          expect((await lab.first("select has_table_privilege($1,$2,$3) allowed", [role, `public.${table}`, privilege])).allowed).toBe(false);
    }
    for (const fn of functions) {
      for (const role of ["anon", "authenticated", "service_role"])
        expect((await lab.first("select has_function_privilege($1,$2,'EXECUTE') allowed", [role, `public.${fn}`])).allowed).toBe(false);
      expect((await lab.first(`select count(*)::int n from pg_proc p,
        lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
        where p.oid=$1::regprocedure and x.grantee=0`, [`public.${fn}`])).n).toBe(0);
    }
  });

  it("keeps future 008 tasks in a read-only legacy fallback, then accepts a baseline head", async () => {
    const task = await lab.task();
    const before = await lab.capture();
    const projection = (await lab.first("select _legacy_task_responsibility($1) value", [task])).value;
    expect(taskResponsibilitySchema.parse(projection)).toMatchObject({
      schemaVersion: 2, instanceId: task, setId: null, revision: 0, origin: "legacy_fallback",
      mode: "individual", anchorOwnerId: ids.owner, sector: null, sectorSource: "unknown",
      members: [{ profileId: ids.owner, shareBps: 10000 }],
    });
    expect(await lab.capture()).toEqual(before);
    expect(await lab.first("select count(*)::int n from task_responsibility_sets")).toEqual({ n: 0 });
    await lab.expectError("select _legacy_task_responsibility($1)", [lab.next()], /inexistente/);
    const baseline = await draft(lab, task, { origin: "baseline_legacy" });
    await lab.expectError("insert into task_responsibility_heads values($1,$2,$3)", [task, ids.org, baseline], /sellada/);
    await seal(lab, baseline);
    await lab.db.query("insert into task_responsibility_heads values($1,$2,$3)", [task, ids.org, baseline]);
    expect(taskResponsibilitySchema.parse((await lab.first("select _legacy_task_responsibility($1) value", [task])).value))
      .toMatchObject({ origin: "baseline_legacy", setId: baseline, revision: 1 });
    await lab.expectError("update task_responsibility_heads set set_id=set_id where instance_id=$1", [task], /inmutable/);
    await lab.expectError("delete from task_responsibility_heads where instance_id=$1", [task], /inmutable/);
  });

  it("seals a punctual joint set but refuses a head or operational access for its second member", async () => {
    const task = await lab.task();
    await punctual(lab, task);
    const set = await draft(lab, task, { mode: "conjunta", members: [[ids.owner, 6500], [ids.peer, 3500]] });
    await seal(lab, set);
    await lab.expectError("insert into task_responsibility_heads values($1,$2,$3)", [task, ids.org, set], /baseline/);
    await lab.actor(ids.owner);
    const privateNote = (await lab.first("select save_private_block_note($1,'Privado',0,$2) value", [task, lab.next()])).value.note_id;
    await lab.actor(ids.peer);
    expect(await lab.rows("select id from task_instances where id=$1", [task])).toEqual([]);
    expect(await lab.rows("select body from task_private_block_notes where id=$1", [privateNote])).toEqual([]);
    expect(await lab.rows("select id from profiles where id=$1", [ids.owner])).toEqual([]);
    await lab.expectError("select start_task_timer($1,0,$2,false)", [task, lab.next()], /Sin permiso/);
    await lab.admin();
    expect((await lab.first("select indexdef from pg_indexes where indexname='one_open_session_per_instance'")).indexdef).toContain("UNIQUE INDEX");
  });

  it("rejects habitual joint sets, stale identity and invented sector snapshots", async () => {
    const task = await lab.task();
    const joint = await draft(lab, task, { mode: "conjunta", members: [[ids.owner, 5000], [ids.peer, 5000]] });
    await lab.expectError("update task_responsibility_sets set sealed=true where id=$1", [joint], /puntuales/);
    expect(await lab.first("select sealed from task_responsibility_sets where id=$1", [joint])).toEqual({ sealed: false });
    await punctual(lab, task);
    await seal(lab, joint);
    const stale = await draft(lab, task, { revision: 2, companySnapshot: ids.otherCompany });
    await lab.expectError("update task_responsibility_sets set sealed=true where id=$1", [stale], /Identidad/);
    const invented = lab.next();
    await lab.db.query(`insert into task_responsibility_sets(id,organization_id,instance_id,revision,mode,origin,
      anchor_owner_id,company_id_snapshot,period_snapshot,team_id_snapshot,sector_source,sector_snapshot,captured_by,reason)
      select $1,organization_id,id,3,'individual','explicit',owner_id,company_id,period,team_id,'catalog','Contabilidad',$2,'Probe'
      from task_instances where id=$3`, [invented, ids.boss, task]);
    await lab.db.query("insert into task_responsibility_members values($1,$2,$3,10000)", [invented, ids.org, ids.owner]);
    await lab.expectError("update task_responsibility_sets set sealed=true where id=$1", [invented], /desconocido/);
  });

  it("validates shares/cardinality atomically and permits a staged individual transfer without changing the anchor", async () => {
    const task = await lab.task();
    const set = await draft(lab, task, { members: [[ids.owner, 6000]] });
    await lab.expectError("update task_responsibility_sets set sealed=true where id=$1", [set], /cuotas/);
    await lab.db.query("insert into task_responsibility_members values($1,$2,$3,4000)", [set, ids.org, ids.peer]);
    await lab.expectError("update task_responsibility_sets set sealed=true where id=$1", [set], /cuotas/);
    await lab.db.query("delete from task_responsibility_members where set_id=$1 and profile_id=$2", [set, ids.owner]);
    await lab.db.query("update task_responsibility_members set share_bps=10000 where set_id=$1", [set]);
    await seal(lab, set);
    expect(await lab.first("select anchor_owner_id from task_responsibility_sets where id=$1", [set])).toEqual({ anchor_owner_id: ids.owner });
    expect(await lab.first("select owner_id from task_instances where id=$1", [task])).toEqual({ owner_id: ids.owner });
    const baseline = await draft(lab, task, { origin: "baseline_legacy", revision: 2, members: [[ids.peer, 10000]] });
    await lab.expectError("update task_responsibility_sets set sealed=true where id=$1", [baseline], /titular/);
  });

  it("rejects duplicate/cross-organization members, out-of-range shares and movement between drafts", async () => {
    const task = await lab.task();
    const set = await draft(lab, task);
    const other = await draft(lab, task, { revision: 2, members: [] });
    await lab.expectError("insert into task_responsibility_members values($1,$2,$3,1)", [set, ids.org, ids.owner], /duplicate/);
    await lab.expectError("insert into task_responsibility_members values($1,$2,$3,10000)", [set, ids.org, ids.outsider], /foreign key/);
    for (const share of [0, 10001])
      await lab.expectError("insert into task_responsibility_members values($1,$2,$3,$4)", [set, ids.org, ids.peer, share], /check constraint/);
    await lab.expectError("update task_responsibility_members set set_id=$2 where set_id=$1", [set, other], /mover/);
    await lab.expectError("update task_responsibility_sets set reason='Edit' where id=$1", [set], /sellar/);
    await lab.expectError("delete from task_responsibility_sets where id=$1", [set], /inmutable/);
    await lab.expectError("update task_responsibility_sets set sealed=true,company_id_snapshot=$2 where id=$1", [set, ids.otherCompany], /identidad/);
    await lab.expectError(`insert into task_responsibility_sets(organization_id,instance_id,revision,mode,origin,anchor_owner_id,
      company_id_snapshot,period_snapshot,team_id_snapshot,sector_source,captured_by,reason)
      values($1,$2,3,'individual','explicit',$3,$4,$5,$6,'unknown',$7,E'\t\n')`,
      [ids.org, task, ids.owner, ids.company, lab.period, ids.team, ids.boss], /check constraint/);
  });

  it("preserves sealed headers and participants against all owner-level DML", async () => {
    const task = await lab.task();
    const set = await draft(lab, task);
    await seal(lab, set);
    for (const sql of ["update task_responsibility_sets set sealed=false where id=$1",
      "update task_responsibility_sets set reason='Changed' where id=$1", "delete from task_responsibility_sets where id=$1"])
      await lab.expectError(sql, [set], /inmutable|sellar/);
    for (const sql of ["update task_responsibility_members set share_bps=9000 where set_id=$1",
      "delete from task_responsibility_members where set_id=$1"])
      await lab.expectError(sql, [set], /inmutables/);
    await lab.expectError("insert into task_responsibility_members values($1,$2,$3,1000)", [set, ids.org, ids.peer], /inmutables/);
    const snapshot = await lab.first("select to_jsonb(s) value from task_responsibility_sets s where id=$1", [set]);
    await lab.db.query("update profiles set active=false where id=$1", [ids.owner]);
    expect(await lab.first("select to_jsonb(s) value from task_responsibility_sets s where id=$1", [set])).toEqual(snapshot);
  });

  it("seals selected monthly instances outside the absence schedule without creating permissions or absences", async () => {
    const task = await lab.task({ period: "2025-04-01" });
    const p = await plan(lab);
    await selectInstance(lab, p, task);
    await sealPlan(lab, p);
    expect(await lab.first("select count(*)::int n from employee_absences")).toEqual({ n: 0 });
    expect(await lab.first("select count(*)::int n from employee_absence_companies")).toEqual({ n: 0 });
    const overlapping = await plan(lab, ids.owner, ids.sourceOwner);
    await selectInstance(lab, overlapping, task);
    await sealPlan(lab, overlapping); // staging is validation, never approval.
    await lab.actor(ids.peer);
    expect(await lab.rows("select id from task_instances where id=$1", [task])).toEqual([]);
    await lab.expectError("select start_task_timer($1,0,$2,false)", [task, lab.next()], /Sin permiso/);
  });

  it("validates a selected sealed joint member and rejects draft or unrelated responsibilities", async () => {
    const task = await lab.task({ period: "2025-04-01" });
    await punctual(lab, task);
    const set = await draft(lab, task, { mode: "conjunta", members: [[ids.owner, 5000], [ids.peer, 5000]] });
    const p = await plan(lab, ids.peer, ids.sourceOwner);
    await selectInstance(lab, p, task, set);
    await lab.expectError(sealPlanSql, [p, ids.boss], /ocurrencia/);
    await seal(lab, set);
    await sealPlan(lab, p);
    const unrelated = await plan(lab, ids.sourceOwner, ids.peer);
    await selectInstance(lab, unrelated, task, set);
    await lab.expectError(sealPlanSql, [unrelated, ids.boss], /ocurrencia/);
    const otherTask = await lab.task();
    const another = await plan(lab);
    await lab.expectError(`insert into task_coverage_plan_instances
      select $1,organization_id,id,company_id,period,$3 from task_instances where id=$2`, [another, otherTask, set], /foreign key/);
  });

  it("rejects empty plans and identity/date/selection mismatches without partial seal", async () => {
    const task = await lab.task({ period: "2025-04-01" });
    const empty = await plan(lab);
    await lab.expectError(sealPlanSql, [empty, ids.boss], /selección/);
    expect(await lab.first("select sealed,sealed_by,sealed_at from task_coverage_plans where id=$1", [empty]))
      .toEqual({ sealed: false, sealed_by: null, sealed_at: null });
    await selectInstance(lab, empty, task);
    await lab.db.query("update task_coverage_plan_instances set company_id_snapshot=$2 where plan_id=$1", [empty, ids.otherCompany]);
    await lab.expectError(sealPlanSql, [empty, ids.boss], /ocurrencia/);
    const wrongOwner = await plan(lab, ids.sourceOwner, ids.peer);
    await selectInstance(lab, wrongOwner, task);
    await lab.expectError(sealPlanSql, [wrongOwner, ids.boss], /ocurrencia/);
    await lab.expectError("update task_coverage_plans set ends_on=starts_on-1 where id=$1", [empty], /identidad/);
    await lab.expectError(`insert into task_coverage_plans(organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by)
      values($1,$2,$2,'2025-04-01','2025-04-10','otra',$3)`, [ids.org, ids.owner, ids.boss], /check constraint/);
    await lab.expectError(`insert into task_coverage_plans(organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by)
      values($1,$2,$3,'2025-04-20','2025-04-10','otra',$4)`, [ids.org, ids.owner, ids.peer, ids.boss], /check constraint/);
  });

  it("freezes complete future-rule snapshots and never materializes a binding", async () => {
    const task = await lab.task({ period: "2025-04-01" });
    const p = await plan(lab);
    await selectRule(lab, p, task);
    const invalid = await plan(lab);
    await selectRule(lab, invalid, task);
    await lab.db.query("update task_coverage_plan_assignment_rules set assignment_snapshot=assignment_snapshot||'{\"frequency\":\"unica\"}' where plan_id=$1", [invalid]);
    await lab.expectError(sealPlanSql, [invalid, ids.boss], /snapshot/);
    const wrongOwner = await plan(lab, ids.peer, ids.sourceOwner);
    await selectRule(lab, wrongOwner, task);
    await lab.expectError(sealPlanSql, [wrongOwner, ids.boss], /snapshot/);
    await sealPlan(lab, p);
    const frozen = await lab.first("select assignment_snapshot::text value from task_coverage_plan_assignment_rules where plan_id=$1", [p]);
    await lab.db.query("update task_assignments set frequency='semanal' where id=(select assignment_id from task_instances where id=$1)", [task]);
    expect(await lab.first("select assignment_snapshot::text value from task_coverage_plan_assignment_rules where plan_id=$1", [p])).toEqual(frozen);
    expect(await lab.first("select count(*)::int n from task_instances")).toEqual({ n: 1 });
    expect(await lab.first("select count(*)::int n from employee_absences")).toEqual({ n: 0 });
  });

  it("makes sealed plans and both selections immutable, and prevents moving draft selections", async () => {
    const task = await lab.task();
    const p = await plan(lab), other = await plan(lab);
    await selectInstance(lab, p, task);
    await selectRule(lab, p, task);
    for (const table of ["task_coverage_plan_instances", "task_coverage_plan_assignment_rules"])
      await lab.expectError(`update ${table} set plan_id=$2 where plan_id=$1`, [p, other], /mover/);
    await sealPlan(lab, p);
    for (const sql of ["update task_coverage_plans set sealed=false,sealed_by=null,sealed_at=null where id=$1",
      "update task_coverage_plans set handover_note='Change' where id=$1", "delete from task_coverage_plans where id=$1"])
      await lab.expectError(sql, [p], /inmutable|sellar/);
    for (const table of ["task_coverage_plan_instances", "task_coverage_plan_assignment_rules"]) {
      await lab.expectError(`delete from ${table} where plan_id=$1`, [p], /inmutable/);
      await lab.expectError(`update ${table} set company_id_snapshot=company_id_snapshot where plan_id=$1`, [p], /inmutable/);
    }
    await lab.expectError(`insert into task_coverage_plan_instances
      select $1,organization_id,id,company_id,period,null from task_instances where id=$2`, [p, task], /inmutable/);
    await lab.expectError(`insert into task_coverage_plan_assignment_rules
      select $1,organization_id,id,company_id,to_jsonb(a) from task_assignments a
      where id=(select assignment_id from task_instances where id=$2)`, [p, task], /inmutable/);
  });

  it("denies direct staged access for all operational roles including service_role", async () => {
    const task = await lab.task();
    const set = await draft(lab, task);
    await seal(lab, set);
    const p = await plan(lab);
    await selectInstance(lab, p, task);
    await sealPlan(lab, p);
    for (const role of ["anon", "authenticated", "service_role"]) {
      await lab.db.exec(`set local role ${role}`);
      for (const table of tables)
        await lab.expectError(`select * from ${table}`, [], /permission denied/);
      await lab.expectError("select _legacy_task_responsibility($1)", [task], /permission denied/);
      await lab.expectError("update task_responsibility_sets set sealed=true where id=$1", [set], /permission denied/);
      await lab.admin();
    }
  });

  it("keeps owner transition, clock and private-note behavior compatible with 008/009", async () => {
    const task = await lab.task();
    const baseline = await draft(lab, task, { origin: "baseline_legacy" });
    await seal(lab, baseline);
    await lab.db.query("insert into task_responsibility_heads values($1,$2,$3)", [task, ids.org, baseline]);
    await lab.actor(ids.owner);
    const session = (await lab.first("select start_task_timer($1,0,$2,false) value", [task, lab.next()])).value;
    expect(await lab.first("select status,state_revision from task_instances where id=$1", [task]))
      .toEqual({ status: "En curso", state_revision: 1 });
    await lab.first("select pause_task_timer($1,$2) value", [session, lab.next()]);
    expect(await lab.first("select state_revision from task_instances where id=$1", [task])).toEqual({ state_revision: 2 });
    expect((await lab.first("select save_private_block_note($1,'Confirmar control',0,$2) value", [task, lab.next()])).value.revision).toBe(1);
    expect((await lab.first("select transition_task_reviewed($1,'Completada','',2,$2) value", [task, lab.next()])).value).toBe(3);
    await lab.admin();
    expect(await lab.first("select count(*)::int n from task_time_sessions where instance_id=$1 and ended_at is not null", [task])).toEqual({ n: 1 });
    expect((await lab.first("select _legacy_task_responsibility($1) value", [task])).value.members)
      .toEqual([{ profileId: ids.owner, shareBps: 10000 }]);
  });
});

it("010 upgrades populated 009 without rewriting any prior rows, snapshots or private history", async () => {
  const lab = await new AccountingLab().init(stages.m009);
  try {
    const task = await lab.task({ period: "2025-04-01", kind: "operativa" });
    const catalogTask = await lab.task({ company: ids.otherCompany });
    const template = lab.next(), version = lab.next();
    await lab.db.query("insert into task_templates(id,organization_id,title,kind,weight) values($1,$2,'Bank','resultado',5)", [template, ids.org]);
    await lab.db.query(`insert into task_template_versions(id,organization_id,template_id,version,title,sector,kind,weight)
      values($1,$2,$3,1,'Bank','Tesorería histórica','resultado',5)`, [version, ids.org, template]);
    await lab.db.query("update task_instances set template_version_id=$2 where id=$1", [catalogTask, version]);
    const absence = await lab.absence(ids.owner, ids.peer, "2025-04-01", "2025-04-10");
    await lab.session(task, ids.peer, absence, "2025-04-02T12:00:00Z", "2025-04-02T12:30:00Z");
    await lab.actor(ids.owner);
    const note = (await lab.first("select save_private_block_note($1,'Original',0,$2) value", [task, lab.next()])).value;
    await lab.first("select save_private_block_note($1,'Revisada',1,$2)", [task, lab.next()]);
    await lab.admin();
    await lab.db.query("insert into activity_entries(organization_id,instance_id,work_date,quantity,reference,actor_id) values($1,$2,'2025-04-02',18,'histórico',$3)", [ids.org, task, ids.peer]);
    await lab.db.query("insert into task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result) values($1,$2,$3,'activity','{}','{}')", [ids.org, ids.peer, lab.next()]);
    const closure = lab.next(), report = lab.next(), delivery = lab.next();
    await lab.db.query("insert into monthly_closures(id,organization_id,owner_id,period,snapshot,closed_by,note) values($1,$2,$3,'2025-03-01','{\"schemaVersion\":1,\"historical\":true}',$4,'History')", [closure, ids.org, ids.owner, ids.boss]);
    await lab.db.query("insert into period_reports(id,organization_id,closure_id,owner_id,period,snapshot) select $1,organization_id,id,owner_id,period,snapshot from monthly_closures where id=$2", [report, closure]);
    await lab.db.query("insert into report_deliveries(id,organization_id,report_id,recipient_id,recipient_email) values($1,$2,$3,$4,'boss@example.test')", [delivery, ids.org, report, ids.boss]);
    await lab.db.query("insert into report_outbox_events(organization_id,delivery_id) values($1,$2)", [ids.org, delivery]);
    await lab.db.query("update profiles set active=false,sector='Sector actual distinto' where id=$1", [ids.owner]);
    // 002 retains structural membership FKs for assignments. Inactivation denies
    // operational access while preserving those historical reference rows.
    const names = (await lab.rows("select tablename from pg_tables where schemaname='public' order by tablename")).map((row) => row.tablename as string);
    const captureAll = async () => {
      const captured: Record<string, unknown> = {};
      for (const name of names) captured[name] = await lab.rows(`select to_jsonb(t)::text row from public.${name} t order by to_jsonb(t)::text`);
      return captured;
    };
    const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
    const before = await captureAll();
    const literalReports = await lab.rows("select id,snapshot::text value from period_reports order by id");
    const start = (await lab.first("select clock_timestamp()::text instant")).instant;
    await lab.migrate(stages.m009, stages.m010);
    expect(digest(await captureAll())).toBe(digest(before));
    expect(await lab.rows("select body from task_private_block_note_versions where note_id=$1 order by revision", [note.note_id]))
      .toEqual([{ body: "Original" }, { body: "Revisada" }]);
    expect(await lab.rows("select id,snapshot::text value from period_reports order by id")).toEqual(literalReports);
    expect(await lab.first("select count(*)::int n from task_responsibility_heads")).toEqual({ n: 2 });
    expect(await lab.first("select count(*)::int n from task_responsibility_sets where captured_at>=$1::timestamptz and captured_at<=clock_timestamp() and captured_by is null and reason is null and sealed", [start])).toEqual({ n: 2 });
    const plain = (await lab.first("select _legacy_task_responsibility($1) value", [task])).value;
    const catalog = (await lab.first("select _legacy_task_responsibility($1) value", [catalogTask])).value;
    expect(taskResponsibilitySchema.parse(plain)).toMatchObject({ origin: "baseline_legacy", sector: null, sectorSource: "unknown", members: [{ profileId: ids.owner, shareBps: 10000 }] });
    expect(taskResponsibilitySchema.parse(catalog)).toMatchObject({ companyId: ids.otherCompany, sector: "Tesorería histórica", sectorSource: "catalog" });
    expect(await lab.first("select count(*)::int n from task_responsibility_members")).toEqual({ n: 2 });
    for (const table of tables.slice(3)) expect(await lab.first(`select count(*)::int n from ${table}`)).toEqual({ n: 0 });
  } finally { await lab.close(); }
}, 60_000);

const fallback = {
  schemaVersion: 2, instanceId: ids.owner, setId: null, revision: 0, origin: "legacy_fallback", mode: "individual",
  anchorOwnerId: ids.owner, companyId: ids.company, period: "2026-10-01", teamId: ids.team, sector: null,
  sectorSource: "unknown", members: [{ profileId: ids.owner, shareBps: 10000 }],
};
describe("010 strict responsibility contract", () => {
  it("accepts fallback, persisted baseline and explicit individual/joint snapshots", () => {
    expect(taskResponsibilitySchema.safeParse(fallback).success).toBe(true);
    expect(taskResponsibilitySchema.safeParse({ ...fallback, origin: "baseline_legacy", setId: uid(200), revision: 1 }).success).toBe(true);
    expect(taskResponsibilitySchema.safeParse({ ...fallback, origin: "explicit", setId: uid(200), revision: 1,
      members: [{ profileId: ids.peer, shareBps: 10000 }] }).success).toBe(true);
    expect(taskResponsibilitySchema.safeParse({ ...fallback, origin: "explicit", setId: uid(200), revision: 2, mode: "conjunta",
      sector: "Impuestos", sectorSource: "catalog", members: [{ profileId: ids.owner, shareBps: 6500 }, { profileId: ids.peer, shareBps: 3500 }] }).success).toBe(true);
  });
  it("rejects fabricated versions/fields, malformed identity, unsafe revisions, periods and sector provenance", () => {
    for (const value of [{ ...fallback, schemaVersion: 1 }, { ...fallback, body: "Private" },
      { ...fallback, instanceId: "invalid" }, { ...fallback, setId: uid(200) }, { ...fallback, revision: 1 },
      { ...fallback, period: "2026-10-02" }, { ...fallback, period: "2026-02-30" },
      { ...fallback, sector: "Current profile sector" }, { ...fallback, sectorSource: "catalog" },
      { ...fallback, sectorSource: "catalog", sector: "\u00a0\t" },
      { ...fallback, origin: "explicit", setId: uid(200), revision: Number.MAX_SAFE_INTEGER + 1 },
      { ...fallback, origin: "explicit", setId: null, revision: 1 }])
      expect(taskResponsibilitySchema.safeParse(value).success).toBe(false);
  });
  it("rejects missing/extra people, decimal or duplicated shares and altered legacy owner", () => {
    for (const members of [[], [{ profileId: ids.owner, shareBps: 9999 }],
      [{ profileId: ids.owner, shareBps: 10000.5 }], [{ profileId: ids.peer, shareBps: 10000 }],
      [{ profileId: ids.owner, shareBps: 5000 }, { profileId: ids.peer, shareBps: 5000 }]])
      expect(taskResponsibilitySchema.safeParse({ ...fallback, members }).success).toBe(false);
    const mixed = "abcdefab-cdef-abcd-abcd-abcdefabcdef";
    expect(taskResponsibilitySchema.safeParse({ ...fallback, origin: "explicit", setId: uid(200), revision: 1,
      mode: "conjunta", members: [{ profileId: mixed, shareBps: 5000 }, { profileId: mixed.toUpperCase(), shareBps: 5000 }] }).success).toBe(false);
  });
});
