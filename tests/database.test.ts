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
    `insert into organizations values('${ids.org}','Test'),('${ids.other}','Other');insert into auth.users values('${ids.boss}'),('${ids.manager}'),('${ids.employee}'),('${ids.outsider}');insert into profiles(id,organization_id,name,role,manager_id,sector,branch,position) values('${ids.boss}','${ids.org}','Boss','jefe',null,'A','B','C'),('${ids.manager}','${ids.org}','Manager','encargado','${ids.boss}','A','B','C'),('${ids.employee}','${ids.org}','Employee','empleado','${ids.manager}','A','B','C'),('${ids.outsider}','${ids.other}','Other','jefe',null,'A','B','C');insert into companies values('${ids.c}','${ids.org}','Empresa');insert into teams values('${ids.team}','${ids.org}','Team','${ids.manager}');insert into team_members values('${ids.org}','${ids.team}','${ids.employee}');insert into company_memberships values('${ids.org}','${ids.c}','${ids.employee}'),('${ids.org}','${ids.c}','${ids.manager}');insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day) values('${ids.a}','${ids.org}','${ids.c}','${ids.employee}','${ids.team}','Conciliación','resultado',5,'mensual','2026-09-01',30);insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,due_date) values('${ids.t}','${ids.org}','${ids.a}','${ids.c}','${ids.employee}','${ids.team}','2026-09-01','2026-09-30','Conciliación','resultado',5,'2026-09-30');`,
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
        `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
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
        `insert into organizations(id,name) values('${ids.org}','Legacy');insert into auth.users values('${ids.boss}'),('${ids.employee}');insert into profiles(id,organization_id,name,role,manager_id,sector,branch,position) values('${ids.boss}','${ids.org}','Boss','jefe',null,'A','B','C'),('${ids.employee}','${ids.org}','Employee','empleado','${ids.boss}','A','B','C');insert into companies values('${ids.c}','${ids.org}','Empresa');insert into teams values('${ids.team}','${ids.org}','Team','${ids.boss}');insert into team_members values('${ids.org}','${ids.team}','${ids.employee}');insert into company_memberships values('${ids.org}','${ids.c}','${ids.employee}');insert into task_templates(id,organization_id,title,kind,weight,checklist) values('${ids.t}','${ids.org}','Conciliación','resultado',5,'[{"text":"Control"}]');insert into task_assignments(id,organization_id,template_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day,checklist) values('${ids.a}','${ids.org}','${ids.t}','${ids.c}','${ids.employee}','${ids.team}','Conciliación','resultado',5,'mensual','2026-09-01',30,'["Control"]');insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,title,kind,weight,due_date,checklist) values('${ids.t.replace("500", "600")}','${ids.org}','${ids.a}','${ids.c}','${ids.employee}','${ids.team}','2026-09-01','Conciliación','resultado',5,'2026-09-30','[{"id":"kept","text":"Control","done":false}]');insert into monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values('${ids.org}','${ids.employee}','2026-09-01','{"immutable":true}','${ids.boss}','Revisado');`,
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
    await actor(ids.manager);
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
});
