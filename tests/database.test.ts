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
  team: "30000000-0000-0000-0000-000000000001",
  a: "40000000-0000-0000-0000-000000000001",
  t: "50000000-0000-0000-0000-000000000001",
};
async function actor(uid: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await db.exec("set role authenticated");
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
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
    `insert into organizations values('${ids.org}','Test'),('${ids.other}','Other');insert into auth.users values('${ids.boss}'),('${ids.manager}'),('${ids.employee}'),('${ids.outsider}');insert into profiles(id,organization_id,name,role,manager_id,sector,branch,position) values('${ids.boss}','${ids.org}','Boss','jefe',null,'A','B','C'),('${ids.manager}','${ids.org}','Manager','encargado','${ids.boss}','A','B','C'),('${ids.employee}','${ids.org}','Employee','empleado','${ids.manager}','A','B','C'),('${ids.outsider}','${ids.other}','Other','jefe',null,'A','B','C');insert into companies values('${ids.c}','${ids.org}','Empresa');insert into teams values('${ids.team}','${ids.org}','Team','${ids.manager}');insert into team_members values('${ids.org}','${ids.team}','${ids.employee}');insert into company_memberships values('${ids.org}','${ids.c}','${ids.employee}'),('${ids.org}','${ids.c}','${ids.manager}');insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day) values('${ids.a}','${ids.org}','${ids.c}','${ids.employee}','${ids.team}','Conciliación','resultado',5,'mensual','2026-09-01',30);insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,title,kind,weight,due_date) values('${ids.t}','${ids.org}','${ids.a}','${ids.c}','${ids.employee}','${ids.team}','2026-09-01','Conciliación','resultado',5,'2026-09-30');`,
  );
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
    await actor(ids.boss);
    expect((await db.query("select * from audit_events")).rows).toHaveLength(2);
  });
  it("checklist mueve y reabre automáticamente", async () => {
    await db.exec("reset role");
    await db.query(
      `update task_instances set checklist='[{"id":"step","text":"Control","done":false}]',status='En curso',completed_at=null where id=$1`,
      [ids.t],
    );
    await actor(ids.employee);
    await db.query("select set_checklist_item($1,$2,true)", [ids.t, "step"]);
    expect(
      (await db.query<{ status: string }>("select status from task_instances"))
        .rows[0].status,
    ).toBe("Completada");
    await db.query("select set_checklist_item($1,$2,false)", [ids.t, "step"]);
    expect(
      (await db.query<{ status: string }>("select status from task_instances"))
        .rows[0].status,
    ).toBe("En curso");
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
    await expect(
      db.query("select close_employee_month($1,'2026-09-01','Revisado')", [
        ids.employee,
      ]),
    ).rejects.toThrow("El mes está cerrado");
  });
  it("cierre impide cambios posteriores", async () => {
    await db.exec("reset role");
    await actor(ids.employee);
    await expect(
      db.query("select transition_task($1,'En curso')", [ids.t]),
    ).rejects.toThrow("El mes está cerrado");
  });
  it("anon no tiene lectura", async () => {
    await db.exec("reset role;set role anon");
    await expect(db.query("select * from profiles")).rejects.toThrow();
  });
});
