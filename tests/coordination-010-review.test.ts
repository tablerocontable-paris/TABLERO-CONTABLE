import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AccountingLab, ids, stages } from "./helpers/accounting-lab";
import { taskResponsibilitySchema } from "../src/data/remote/coordination-contract";

// Independent probes: use SQL directly rather than the implementation test's builders.
describe("010 independent boundary review", () => {
  let lab: AccountingLab;
  beforeAll(async () => { lab = await new AccountingLab().init(stages.m010); }, 60_000);
  beforeEach(async () => { await lab.admin(); await lab.db.exec("begin"); });
  afterEach(async () => { await lab.db.exec("rollback; reset role"); });
  afterAll(async () => { await lab?.close(); });

  async function stage(task: string, origin = "baseline_legacy") {
    const id = lab.next();
    await lab.db.query(`insert into task_responsibility_sets(id,organization_id,instance_id,revision,mode,origin,
      anchor_owner_id,company_id_snapshot,period_snapshot,team_id_snapshot,sector_source,captured_by,reason)
      select $1,organization_id,id,1,'individual',$3,owner_id,company_id,period,team_id,'unknown',
        case when $3='explicit' then $4::uuid else null end,case when $3='explicit' then 'Reviewed' else null end
      from task_instances where id=$2`, [id, task, origin, ids.boss]);
    await lab.db.query("insert into task_responsibility_members values($1,$2,$3,10000)", [id, ids.org, ids.owner]);
    return id;
  }

  it("rejects presealed inserts even with otherwise plausible headers and seal metadata", async () => {
    const task = await lab.task();
    await lab.expectError(`insert into task_responsibility_sets(organization_id,instance_id,revision,mode,origin,sealed,
      anchor_owner_id,company_id_snapshot,period_snapshot,team_id_snapshot,sector_source)
      select organization_id,id,1,'individual','baseline_legacy',true,owner_id,company_id,period,team_id,'unknown'
      from task_instances where id=$1`, [task], /borrador/);
    await lab.expectError(`insert into task_coverage_plans(organization_id,responsible_id,replacement_id,starts_on,ends_on,
      kind,created_by,sealed,sealed_by,sealed_at) values($1,$2,$3,'2026-10-01','2026-10-10','otra',$4,true,$4,now())`,
      [ids.org, ids.owner, ids.peer, ids.boss], /borrador/);
    expect(await lab.first("select count(*)::int n from task_responsibility_sets")).toEqual({ n: 0 });
    expect(await lab.first("select count(*)::int n from task_coverage_plans")).toEqual({ n: 0 });
  });

  it("prevents UPSERT from rewriting sealed members or heads", async () => {
    const task = await lab.task(), set = await stage(task);
    await lab.db.query("update task_responsibility_sets set sealed=true where id=$1", [set]);
    await lab.db.query("insert into task_responsibility_heads values($1,$2,$3)", [task, ids.org, set]);
    await lab.expectError(`insert into task_responsibility_members values($1,$2,$3,10000)
      on conflict(set_id,profile_id) do update set share_bps=9000`, [set, ids.org, ids.owner], /inmutables/);
    await lab.expectError(`insert into task_responsibility_heads values($1,$2,$3)
      on conflict(instance_id) do update set set_id=excluded.set_id`, [task, ids.org, set], /inmutable/);
    expect(await lab.first("select share_bps from task_responsibility_members where set_id=$1", [set])).toEqual({ share_bps: 10000 });
  });

  it("does not expose a sealed explicit set through fallback or create a head implicitly", async () => {
    const task = await lab.task(), set = await stage(task, "explicit");
    await lab.db.query("update task_responsibility_sets set sealed=true where id=$1", [set]);
    const before = await lab.capture();
    const payload = (await lab.first("select _legacy_task_responsibility($1) value", [task])).value;
    expect(taskResponsibilitySchema.parse(payload)).toMatchObject({ origin: "legacy_fallback", setId: null, revision: 0 });
    expect(await lab.first("select count(*)::int n from task_responsibility_heads")).toEqual({ n: 0 });
    expect(await lab.capture()).toEqual(before);
  });

  it("denies staged tables and helpers even to a service role that bypasses RLS", async () => {
    await lab.db.exec("alter role service_role bypassrls");
    expect(await lab.first("select rolbypassrls value from pg_roles where rolname='service_role'")).toEqual({ value: true });
    await lab.db.exec("set local role service_role");
    await lab.expectError("select * from task_responsibility_sets", [], /permission denied/);
    await lab.expectError("select * from task_coverage_plans", [], /permission denied/);
    await lab.expectError("select _legacy_task_responsibility($1)", [ids.owner], /permission denied/);
  });

  it("enforces organization identity across plans, tasks, profiles and snapshots", async () => {
    const task = await lab.task();
    await lab.expectError(`insert into task_coverage_plans(organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by)
      values($1,$2,$3,'2026-10-01','2026-10-10','otra',$4)`, [ids.org, ids.owner, ids.outsider, ids.boss], /foreign key/);
    await lab.expectError(`insert into task_responsibility_sets(organization_id,instance_id,revision,mode,origin,
      anchor_owner_id,company_id_snapshot,period_snapshot,team_id_snapshot,sector_source)
      values($1,$2,1,'individual','baseline_legacy',$3,$4,$5,$6,'unknown')`,
      [ids.otherOrg, task, ids.owner, ids.company, lab.period, ids.team], /foreign key/);
    await lab.expectError(`insert into task_coverage_plans(organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by)
      values($1,$2,$3,'infinity','infinity','otra',$4)`, [ids.org, ids.owner, ids.peer, ids.boss], /check constraint/);
  });

  it("keeps historical snapshots after profile changes without leaking private text into projection", async () => {
    const task = await lab.task(), set = await stage(task);
    await lab.db.query("update task_responsibility_sets set sealed=true where id=$1", [set]);
    await lab.db.query("insert into task_responsibility_heads values($1,$2,$3)", [task, ids.org, set]);
    await lab.actor(ids.owner);
    await lab.first("select save_private_block_note($1,'Falta información confidencial',0,$2)", [task, lab.next()]);
    await lab.admin();
    const before = (await lab.first("select _legacy_task_responsibility($1) value", [task])).value;
    await lab.db.query("update profiles set active=false,sector='Sector posterior',manager_id=$2 where id=$1", [ids.owner, ids.boss]);
    const after = (await lab.first("select _legacy_task_responsibility($1) value", [task])).value;
    expect(after).toEqual(before);
    expect(JSON.stringify(after)).not.toContain("confidencial");
    expect(taskResponsibilitySchema.parse(after).sector).toBeNull();
  });

  it("uses JS-compatible nonblank checks for staged provenance and keeps zero-width characters distinct", async () => {
    for (const value of ["\t\n", "\u00a0\u2003", "\ufeff\u2028\u2029", " "])
      expect((await lab.first("select _coordination_text_present($1) value", [value])).value).toBe(false);
    for (const value of [" x ", "\u200b", "\u0085"])
      expect((await lab.first("select _coordination_text_present($1) value", [value])).value).toBe(value.trim().length > 0);
  });
});

it("010 rolls back its DDL and data capture when a later migration statement fails", async () => {
  const lab = await new AccountingLab().init(stages.m009);
  try {
    await lab.task();
    const before = await lab.capture();
    await lab.db.exec("create table public.task_coverage_plans(marker text)");
    await expect(lab.migrate(stages.m009, stages.m010)).rejects.toThrow(/already exists/);
    await lab.db.exec("rollback");
    expect(await lab.capture()).toEqual(before);
    expect(await lab.first("select to_regclass('public.task_responsibility_sets')::text value")).toEqual({ value: null });
    expect(await lab.first("select to_regprocedure('public._coordination_text_present(text)')::text value")).toEqual({ value: null });
    expect(await lab.first("select count(*)::int n from task_coverage_plans")).toEqual({ n: 0 });
  } finally { await lab.close(); }
}, 60_000);
