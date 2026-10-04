import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AccountingLab, ids, stages } from "./helpers/accounting-lab";
import { savePrivateBlockNote, type PrivateBlockNoteTransport } from "../src/data/remote/private-block-notes";
import { createHash } from "node:crypto";

const call = "select public.save_private_block_note($1,$2,$3,$4) result";
const input = { instanceId: ids.owner, body: "Texto privado", expectedRevision: 0, operationId: ids.peer };
const ack = { note_id: ids.owner, revision: 1, cleared: false };

describe("009 independent wrapper review", () => {
  it("does not confirm a late ACK after cancellation following dispatch", async () => {
    const controller = new AbortController();
    const transport: PrivateBlockNoteTransport = { rpc: async () => {
      controller.abort();
      return { data: ack, error: null };
    } };
    expect(await savePrivateBlockNote(transport, input, controller.signal)).toMatchObject({
      ok: false, error: { category: "aborted" }, ambiguous: true,
    });
  });
  it("returns promptly on cancellation even if the transport does not settle", async () => {
    const controller = new AbortController();
    let resolve!: (value: { data: unknown; error: null }) => void;
    const pending = new Promise<{ data: unknown; error: null }>((done) => { resolve = done; });
    const request = savePrivateBlockNote({ rpc: () => pending }, input, controller.signal);
    controller.abort();
    expect(await request).toMatchObject({ ok: false, error: { category: "aborted" }, ambiguous: true });
    resolve({ data: ack, error: null });
  });
  for (const response of [undefined, null, {}, { data: ack }, { error: null }]) {
    it(`treats incomplete response ${JSON.stringify(response)} as an ambiguous protocol error`, async () => {
      const transport = { rpc: async () => response } as PrivateBlockNoteTransport;
      expect(await savePrivateBlockNote(transport, input)).toMatchObject({
        ok: false, error: { category: "protocol" }, ambiguous: true,
      });
    });
  }
});

describe("009 independent SQL review", () => {
  let lab: AccountingLab;
  beforeAll(async () => { lab = await new AccountingLab().init(stages.m009); }, 60_000);
  beforeEach(async () => { await lab.admin(); await lab.db.exec("begin"); });
  afterEach(async () => { await lab.db.exec("rollback; reset role"); });
  afterAll(async () => { await lab?.close(); });

  it("rejects whitespace-only SQL bodies using the same whitespace definition as JS", async () => {
    const task = await lab.task();
    await lab.actor(ids.owner);
    for (const body of ["\t\n\r", "\u00a0\u2003", "\ufeff\u2028\u2029"])
      await lab.expectError(call, [task, body, 0, lab.next()], /caracteres/);
    expect(await lab.first("select count(*)::int n from task_private_block_notes")).toEqual({ n: 0 });
  });

  it("preserves own coverage notes after access expires but never discloses another author's history", async () => {
    const task = await lab.task();
    const absence = await lab.absence();
    await lab.actor(ids.owner);
    const ownerNote = (await lab.first(call, [task, "Nota del titular", 0, lab.next()])).result.note_id;
    await lab.actor(ids.peer);
    const note = (await lab.first(call, [task, "Nota del reemplazo", 0, lab.next()])).result.note_id;
    expect(await lab.rows("select body from task_private_block_note_versions where note_id=$1", [ownerNote])).toEqual([]);
    await lab.actor(ids.boss, "aal2");
    await lab.db.query("select cancel_employee_absence($1,'Termina cobertura',$2)", [absence, lab.next()]);
    await lab.actor(ids.peer);
    expect(await lab.first("select body from task_private_block_notes where id=$1", [note])).toEqual({ body: "Nota del reemplazo" });
    expect(await lab.rows("select body from task_private_block_note_versions where note_id=$1", [note])).toHaveLength(1);
    expect(await lab.rows("select id from task_instances where id=$1", [task])).toEqual([]);
    expect(await lab.rows("select id from profiles where id=$1", [ids.owner])).toEqual([]);
    await lab.expectError(call, [task, "Fuera de cobertura", 1, lab.next()], /Sin permiso/);
  });

  it("replays the original ACK after period closure, denies new operations, and denies inactive replay", async () => {
    const task = await lab.task();
    const op = lab.next();
    await lab.actor(ids.owner);
    const original = await lab.first(call, [task, "Original", 0, op]);
    await lab.admin();
    await lab.db.query("insert into monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note) values($1,$2,$3,'{}',$4,'Test')", [ids.org, ids.owner, lab.period, ids.boss]);
    await lab.actor(ids.owner);
    expect(await lab.first(call, [task, "Original", 0, op])).toEqual(original);
    await lab.expectError(call, [task, "Original", 1, lab.next()], /mes está cerrado/);
    await lab.admin();
    expect(await lab.first("select count(*)::int n from private_block_note_receipts")).toEqual({ n: 1 });
    await lab.db.query("update profiles set active=false where id=$1", [ids.owner]);
    await lab.actor(ids.owner);
    await lab.expectError(call, [task, "Original", 0, op], /Sin permiso/);
  });

  it("repeated clear is a no-op only with the current revision, and invalid limits roll back receipts", async () => {
    const task = await lab.task();
    await lab.actor(ids.owner);
    await lab.first(call, [task, "😀".repeat(2000), 0, lab.next()]);
    const clear = await lab.first(call, [task, null, 1, lab.next()]);
    expect(await lab.first(call, [task, null, 2, lab.next()])).toEqual(clear);
    await lab.expectError(call, [task, null, 1, lab.next()], /revisión/);
    await lab.expectError(call, [task, "a".repeat(2001), 2, lab.next()], /caracteres/);
    await lab.expectError(call, [task, "Valid", -1, lab.next()], /revisión/);
    await lab.admin();
    expect(await lab.first("select count(*)::int n from task_private_block_note_versions")).toEqual({ n: 2 });
    expect(await lab.first("select count(*)::int n from private_block_note_receipts")).toEqual({ n: 3 });
  });
});

it("009 upgrade preserves populated times, coverage, activity, receipts and literal report snapshots", async () => {
  const lab = await new AccountingLab().init(stages.m008);
  try {
    const task = await lab.task({ period: "2025-04-01", kind: "operativa" });
    const absence = await lab.absence(ids.owner, ids.peer, "2025-04-01", "2025-04-10");
    await lab.session(task, ids.peer, absence, "2025-04-02T12:00:00Z", "2025-04-02T12:30:00Z");
    await lab.admin();
    await lab.db.query("insert into activity_entries(organization_id,instance_id,work_date,quantity,reference,actor_id) values($1,$2,'2025-04-02',18,'histórico',$3)", [ids.org, task, ids.peer]);
    await lab.db.query("insert into task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result) values($1,$2,$3,'activity','{}','{}')", [ids.org, ids.peer, lab.next()]);
    const closure = lab.next(), report = lab.next(), delivery = lab.next();
    await lab.db.query("insert into monthly_closures(id,organization_id,owner_id,period,snapshot,closed_by,note) values($1,$2,$3,'2025-03-01','{\"schemaVersion\":1,\"historical\":true}',$4,'History')", [closure, ids.org, ids.owner, ids.boss]);
    await lab.db.query("insert into period_reports(id,organization_id,closure_id,owner_id,period,snapshot) select $1,organization_id,id,owner_id,period,snapshot from monthly_closures where id=$2", [report, closure]);
    await lab.db.query("insert into report_deliveries(id,organization_id,report_id,recipient_id,recipient_email) values($1,$2,$3,$4,'boss@example.test')", [delivery, ids.org, report, ids.boss]);
    await lab.db.query("insert into report_outbox_events(organization_id,delivery_id) values($1,$2)", [ids.org, delivery]);
    const before = await lab.capture();
    const literal = await lab.rows("select id,snapshot::text snapshot from period_reports order by id");
    const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
    await lab.migrate(stages.m008, stages.m009);
    expect(digest(await lab.capture())).toBe(digest(before));
    expect(await lab.rows("select id,snapshot::text snapshot from period_reports order by id")).toEqual(literal);
    expect(await lab.first("select count(*)::int n from task_private_block_notes")).toEqual({ n: 0 });
  } finally { await lab.close(); }
}, 60_000);
