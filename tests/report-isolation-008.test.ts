import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { AccountingLab, ids } from "./helpers/accounting-lab";
let lab: AccountingLab;
beforeAll(async () => {
  lab = await new AccountingLab().init();
}, 20000);
beforeEach(async () => {
  await lab.admin();
  await lab.db.exec("begin");
});
afterEach(async () => {
  await lab.db.exec("rollback;reset role");
});
afterAll(async () => lab?.close());
async function report() {
  const task = await lab.task({ period: "2025-03-01", kind: "operativa" });
  await lab.session(
    task,
    ids.owner,
    null,
    "2025-03-10T12:00:00Z",
    "2025-03-10T12:30:00Z",
  );
  await lab.actor();
  for (const quantity of [7, 11])
    await lab.first(
      "select record_activity_once($1,'2025-03-10',$2,'Facturas verificadas',$3)",
      [task, quantity, lab.next()],
    );
  await lab.actor(ids.boss, "aal2");
  const closure = (
    await lab.first(
      "select close_employee_month($1,'2025-03-01','Cierre') id",
      [ids.owner],
    )
  ).id;
  await lab.admin();
  const row = (await lab.first(
    "select r.id report,d.id delivery,o.id outbox,r.snapshot from period_reports r join report_deliveries d on d.report_id=r.id join report_outbox_events o on o.delivery_id=d.id where r.closure_id=$1",
    [closure],
  )) as {
    report: string;
    delivery: string;
    outbox: string;
    snapshot: {
      metrics: {
        recordedSeconds: number;
        operational: number;
        operationalTarget: number;
        onTime: number | null;
      };
      tasks: { id: string; quantity: number; target: number; unit: string }[];
    };
  };
  return { task, closure, ...row };
}
async function claim(deliveryId: string) {
  await lab.admin();
  await lab.db.exec("set role service_role");
  const rows = await lab.rows("select * from claim_report_deliveries(1)");
  expect(rows).toHaveLength(1);
  expect(rows[0].id).toBe(deliveryId);
  return rows[0];
}
describe("008: reportes con fixture transaccional propia", () => {
  it("reportes privados, destinatario verificado y consumidor reservado al servidor", async () => {
    const f = await report();
    await lab.actor();
    expect(await lab.rows("select id from period_reports")).toEqual([
      { id: f.report },
    ]);
    expect(await lab.rows("select id from report_deliveries")).toEqual([]);
    await lab.expectError(
      "select claim_report_deliveries(1)",
      [],
      /permission denied/,
    );
    await lab.actor(ids.outsider);
    expect(await lab.rows("select id from period_reports")).toEqual([]);
    await lab.actor(ids.boss, "aal2");
    await lab.expectError(
      "select set_report_recipient($1)",
      [ids.manager],
      /correo verificado/,
    );
    await lab.expectError(
      "select set_report_recipient($1)",
      [ids.outsider],
      /correo verificado/,
    );
    await lab.first("select set_report_recipient($1)", [ids.boss]);
  });
  it("cierre fija 1800 segundos y 18 de 40 facturas; repetición conserva snapshots e identidades", async () => {
    const f = await report();
    expect(Number(f.snapshot.metrics.recordedSeconds)).toBe(1800);
    expect(
      f.snapshot.tasks.find((t: { id: string }) => t.id === f.task),
    ).toMatchObject({ quantity: 18, target: 40, unit: "facturas" });
    expect(f.snapshot.metrics).toMatchObject({
      operational: 1,
      operationalTarget: 0,
      onTime: null,
    });
    const before = await lab.capture();
    await lab.actor(ids.boss, "aal2");
    expect(
      (
        await lab.first(
          "select close_employee_month($1,'2025-03-01','Repetir') id",
          [ids.owner],
        )
      ).id,
    ).toBe(f.closure);
    expect(await lab.capture()).toEqual(before);
    for (const table of [
      "monthly_closures",
      "period_reports",
      "report_deliveries",
      "report_outbox_events",
    ])
      expect((await lab.first(`select count(*)::int n from ${table}`)).n).toBe(
        1,
      );
    await lab.expectError(
      "update period_reports set snapshot='{}' where id=$1",
      [f.report],
      /inmutables/,
    );
  });
  for (const invalid of ["recipient", "open_timer"])
    it(`cierre bloqueado por ${invalid} no genera registros parciales`, async () => {
      const task = await lab.task({
        period: "2025-03-01",
        status: "Completada",
      });
      if (invalid === "recipient")
        await lab.db.query(
          "update auth.users set email_confirmed_at=null where id=$1",
          [ids.boss],
        );
      else await lab.session(task);
      const before = await lab.capture();
      await lab.actor(ids.boss, "aal2");
      await lab.expectError(
        "select close_employee_month($1,'2025-03-01','Cierre')",
        [ids.owner],
        invalid === "recipient" ? /correo verificado/ : /cronómetros activos/,
      );
      expect(await lab.capture()).toEqual(before);
      for (const table of [
        "monthly_closures",
        "period_reports",
        "report_deliveries",
        "report_outbox_events",
      ])
        expect(
          (await lab.first(`select count(*)::int n from ${table}`)).n,
        ).toBe(0);
    });
  it("la entrega respeta lease, reintenta y no regenera cierre ni eventos", async () => {
    const f = await report(),
      first = await claim(f.delivery);
    expect(await lab.rows("select * from claim_report_deliveries(1)")).toEqual(
      [],
    );
    await lab.first(
      "select fail_report_delivery($1,$2,'provider_unavailable',true)",
      [first.id, first.lease_token],
    );
    await lab.admin();
    const wait = await lab.first(
      "select status,next_attempt_at>now() future from report_deliveries where id=$1",
      [f.delivery],
    );
    expect(wait).toEqual({ status: "retry_wait", future: true });
    await lab.db.query(
      "update report_deliveries set next_attempt_at=now()-interval '1 second' where id=$1",
      [f.delivery],
    );
    const second = await claim(f.delivery);
    expect(second.attempts).toBe(2);
    await lab.expectError(
      "select complete_report_delivery($1,$2,'old-ack')",
      [f.delivery, first.lease_token],
      /Lease/,
    );
    await lab.first("select complete_report_delivery($1,$2,'accepted')", [
      f.delivery,
      second.lease_token,
    ]);
    expect(await lab.rows("select * from claim_report_deliveries(1)")).toEqual(
      [],
    );
    await lab.admin();
    expect(
      (
        await lab.first("select snapshot from period_reports where id=$1", [
          f.report,
        ])
      ).snapshot,
    ).toEqual(f.snapshot);
    for (const table of [
      "monthly_closures",
      "period_reports",
      "report_deliveries",
      "report_outbox_events",
    ])
      expect((await lab.first(`select count(*)::int n from ${table}`)).n).toBe(
        1,
      );
  });
  it("cinco fallos agotan reintentos; reintento manual mantiene contador y rechaza ACK de lease vencido", async () => {
    const f = await report();
    for (let attempt = 1; attempt <= 5; attempt++) {
      const d = await claim(f.delivery);
      expect(d.attempts).toBe(attempt);
      await lab.first(
        "select fail_report_delivery($1,$2,'provider_unavailable',true)",
        [d.id, d.lease_token],
      );
      await lab.admin();
      expect(
        (
          await lab.first("select status from report_deliveries where id=$1", [
            f.delivery,
          ])
        ).status,
      ).toBe(attempt === 5 ? "failed" : "retry_wait");
      await lab.db.query(
        "update report_deliveries set next_attempt_at=now()-interval '1 second' where id=$1",
        [f.delivery],
      );
    }
    await lab.actor(ids.boss, "aal2");
    await lab.first("select retry_report_delivery($1)", [f.delivery]);
    const next = await claim(f.delivery);
    expect(next.total_attempts).toBe(6);
    await lab.admin();
    await lab.db.query(
      "update report_deliveries set lease_until=now()-interval '1 second' where id=$1",
      [f.delivery],
    );
    const reclaimed = await claim(f.delivery);
    expect(reclaimed.lease_token).not.toBe(next.lease_token);
    await lab.expectError(
      "select complete_report_delivery($1,$2,'late-ack')",
      [f.delivery, next.lease_token],
      /Lease/,
    );
    await lab.first("select complete_report_delivery($1,$2,'accepted')", [
      f.delivery,
      reclaimed.lease_token,
    ]);
  });
});
