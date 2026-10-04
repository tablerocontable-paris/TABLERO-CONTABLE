import { describe, expect, it } from "vitest";
import { AccountingLab, ids, stages } from "./helpers/accounting-lab";
import {
  savePrivateBlockNote,
  type PrivateBlockNoteTransport,
} from "../src/data/remote/private-block-notes";

const noteSql = `select public.save_private_block_note($1,$2,$3,$4) result`;
async function expectFailure(
  lab: AccountingLab,
  sql: string,
  args: unknown[],
  pattern: RegExp,
) {
  await lab.db.exec("begin");
  try {
    await lab.expectError(sql, args, pattern);
    await lab.db.exec("commit");
  } catch (error) {
    await lab.db.exec("rollback");
    throw error;
  }
}

describe("private block notes 009", () => {
  it("applies to an empty base and preserves the populated 008 upgrade", async () => {
    const empty = new AccountingLab();
    try {
      await empty.init(stages.m009);
      expect(
        await empty.first(
          "select to_regclass('public.task_private_block_notes')::text table_name",
        ),
      ).toEqual({ table_name: "task_private_block_notes" });
    } finally {
      await empty.close();
    }

    const lab = new AccountingLab();
    try {
      await lab.init(stages.m008);
      const instance = await lab.task();
      const before = await lab.capture();
      await lab.migrate(stages.m008, stages.m009);
      expect(await lab.capture()).toEqual(before);
      await lab.actor(ids.owner);
      const saved = await lab.first(noteSql, [instance, "privado", 0, lab.next()]);
      expect(saved.result).toEqual({
        note_id: expect.any(String),
        revision: 1,
        cleared: false,
      });
    } finally {
      await lab.close();
    }
  }, 60_000);

  it("versions edits, clear, restore and no-op without touching task state or time", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m009);
      const instance = await lab.task();
      await lab.actor(ids.owner);
      const beforeTask = await lab.first(
        "select status,state_revision,started_at,completed_at,checklist,blocked_by from task_instances where id=$1",
        [instance],
      );
      const first = (await lab.first(noteSql, [instance, "  No están los pagos  ", 0, lab.next()])).result;
      expect(first.revision).toBe(1);
      const noteId = first.note_id;
      const noOp = (await lab.first(noteSql, [instance, "No están los pagos", 1, lab.next()])).result;
      expect(noOp).toEqual(first);
      const edit = (await lab.first(noteSql, [instance, "Falta confirmar la carga", 1, lab.next()])).result;
      expect(edit.revision).toBe(2);
      const clear = (await lab.first(noteSql, [instance, null, 2, lab.next()])).result;
      expect(clear).toMatchObject({ note_id: noteId, revision: 3, cleared: true });
      const restore = (await lab.first(noteSql, [instance, "Ya se cargaron los pagos", 3, lab.next()])).result;
      expect(restore).toMatchObject({ note_id: noteId, revision: 4, cleared: false });
      await expectFailure(lab, noteSql, [instance, "stale", 1, lab.next()], /revisión/);
      await expectFailure(lab, noteSql, [instance, "   ", 4, lab.next()], /caracteres/);
      expect(await lab.first("select count(*)::int count from task_private_block_note_versions where note_id=$1", [noteId])).toEqual({ count: 4 });
      expect(await lab.first("select body from task_private_block_notes where id=$1", [noteId])).toEqual({ body: "Ya se cargaron los pagos" });
      expect(await lab.first("select status,state_revision,started_at,completed_at,checklist,blocked_by from task_instances where id=$1", [instance])).toEqual(beforeTask);
      await lab.admin();
      await expectFailure(lab, "update task_private_block_note_versions set body='cambio' where note_id=$1", [noteId], /inmutable/);
      await expectFailure(lab, "delete from task_private_block_note_versions where note_id=$1", [noteId], /inmutable/);
      const audits = await lab.rows("select action,details from audit_events where entity_id=$1 order by id", [noteId]);
      expect(audits.map((row) => row.action)).toEqual([
        "private_block_note.created",
        "private_block_note.updated",
        "private_block_note.cleared",
        "private_block_note.updated",
      ]);
      expect(audits.every((row) => JSON.stringify(row.details) === "{}")).toBe(true);
      const sensitive = JSON.stringify(await lab.capture());
      expect(sensitive).not.toContain("Ya se cargaron los pagos");
    } finally {
      await lab.close();
    }
  }, 60_000);

  it("replays an exact private receipt, rejects changed arguments, and keeps receipt namespaces separate", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m009);
      const instance = await lab.task();
      const operation = lab.next();
      await lab.actor(ids.owner);
      const first = await lab.first(noteSql, [instance, "privado", 0, operation]);
      await lab.admin();
      await lab.db.query(
        "insert into task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result) values($1,$2,$3,'legacy', '{}'::jsonb, '{}'::jsonb)",
        [ids.org, ids.owner, operation],
      );
      await lab.actor(ids.owner);
      expect(await lab.first(noteSql, [instance, "privado", 0, operation])).toEqual(first);
      await expectFailure(lab, noteSql, [instance, "changed", 0, operation], /otros argumentos/);
      await lab.admin();
      expect(await lab.first("select count(*)::int count from task_private_block_note_versions")).toEqual({ count: 1 });
      expect(await lab.first("select count(*)::int count from private_block_note_receipts")).toEqual({ count: 1 });
    } finally {
      await lab.close();
    }
  }, 60_000);

  it("allows only the author, current manager for that company, and active boss to read", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m009);
      const instance = await lab.task();
      await lab.actor(ids.owner);
      const noteId = (await lab.first(noteSql, [instance, "visible al encargado", 0, lab.next()])).result.note_id;
      const visible = async (actor: string) => {
        await lab.actor(actor);
        return lab.first("select body from task_private_block_notes where id=$1", [noteId]);
      };
      expect(await visible(ids.owner)).toEqual({ body: "visible al encargado" });
      expect(await visible(ids.manager)).toEqual({ body: "visible al encargado" });
      expect(await visible(ids.boss)).toEqual({ body: "visible al encargado" });
      expect(await visible(ids.peer)).toEqual(undefined);
      expect(await visible(ids.outsider)).toEqual(undefined);

      await lab.admin();
      const auditor = lab.next();
      await lab.db.query("insert into auth.users values($1,'auditor@example.test',now())", [auditor]);
      await lab.db.query("insert into profiles(id,organization_id,name,role,sector,branch,position) values($1,$2,'Auditor','auditor','Contabilidad','Lab','Auditor')", [auditor,ids.org]);
      expect(await visible(auditor)).toEqual(undefined);

      await lab.admin();
      await lab.db.query("update profiles set manager_id=$1 where id=$2", [ids.boss, ids.owner]);
      expect(await visible(ids.manager)).toEqual(undefined);
      expect(await visible(ids.boss)).toEqual({ body: "visible al encargado" });

      await lab.admin();
      await lab.db.query("update profiles set active=false where id=$1", [ids.owner]);
      expect(await visible(ids.owner)).toEqual(undefined);
      await expectFailure(lab, noteSql, [instance, "otra nota", 1, lab.next()], /Sin permiso/);
    } finally {
      await lab.close();
    }
  }, 60_000);

  it("keeps an author's note readable after losing task access without granting task or profile access", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m009);
      const instance = await lab.task();
      await lab.actor(ids.manager);
      const noteId = (await lab.first(noteSql, [instance, "nota del encargado", 0, lab.next()])).result.note_id;
      await lab.admin();
      await lab.db.query("update profiles set manager_id=$1 where id=$2", [ids.boss, ids.owner]);
      await lab.actor(ids.manager);
      expect(await lab.first("select body from task_private_block_notes where id=$1", [noteId])).toEqual({ body: "nota del encargado" });
      expect(await lab.first("select id from task_instances where id=$1", [instance])).toBeUndefined();
      expect(await lab.first("select id from profiles where id=$1", [ids.owner])).toBeUndefined();
    } finally {
      await lab.close();
    }
  }, 60_000);

  it("enforces same-company manager membership, closed periods, and task isolation", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m009);
      const instance = await lab.task();
      await lab.admin();
      const closeId = lab.next();
      await lab.db.query(
        "insert into monthly_closures(id,organization_id,owner_id,period,snapshot,closed_by,note) values($1,$2,$3,$4,'{}',$5,'close')",
        [closeId, ids.org, ids.owner, lab.period, ids.boss],
      );
      await lab.actor(ids.owner);
      await expectFailure(lab, noteSql, [instance, "late", 0, lab.next()], /mes está cerrado/);

      await lab.admin();
      await lab.db.query("delete from monthly_closures where id=$1", [closeId]);
      await lab.db.query("delete from company_memberships where profile_id=$1 and company_id=$2", [ids.manager,ids.company]);
      await lab.actor(ids.owner);
      const noteId = (await lab.first(noteSql, [instance, "comentario", 0, lab.next()])).result.note_id;
      await lab.actor(ids.manager);
      expect(await lab.first("select body from task_private_block_notes where id=$1", [noteId])).toBeUndefined();
      await expectFailure(lab, "update task_instances set blocked_by='fuga' where id=$1", [instance], /permission|privilege/i);
      await expectFailure(lab, "insert into task_private_block_notes(organization_id,instance_id,author_id,body) values($1,$2,$3,'directo')", [ids.org,instance,ids.manager], /permission|privilege/i);
      await expectFailure(lab, "select * from private_block_note_receipts", [], /permission|privilege/i);
    } finally {
      await lab.close();
    }
  }, 60_000);

  it("validates the RPC wrapper, passes abort options once, and never exposes bodies in errors", async () => {
    const calls: unknown[] = [];
    const transport: PrivateBlockNoteTransport = {
      rpc: (name, args, options) => {
        calls.push({ name, args, options });
        return Promise.resolve({ data: { note_id: ids.owner, revision: 1, cleared: false }, error: null });
      },
    };
    const input = { instanceId: ids.owner, body: "comentario secreto", expectedRevision: 0, operationId: ids.peer };
    const controller = new AbortController();
    expect(await savePrivateBlockNote(transport, input, controller.signal)).toEqual({ ok: true, noteId: ids.owner, revision: 1, cleared: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ name: "save_private_block_note", args: { p_instance: ids.owner, p_body: input.body, p_expected_revision: 0, p_operation_id: ids.peer }, options: { signal: controller.signal } });
    expect(await savePrivateBlockNote(transport, { ...input, body: "   " })).toMatchObject({ ok: false, error: { category: "validation" }, ambiguous: false });
    expect(await savePrivateBlockNote({ rpc: () => Promise.resolve({ data: null, error: { message: input.body } }) }, input)).toMatchObject({ ok: false, error: { category: "server" }, ambiguous: false });
    expect(await savePrivateBlockNote({ rpc: () => Promise.resolve({ data: [], error: null }) }, input)).toMatchObject({ ok: false, error: { category: "protocol" }, ambiguous: true });
    expect(await savePrivateBlockNote({ rpc: () => Promise.reject(new Error(input.body)) }, input)).toMatchObject({ ok: false, error: { category: "transport" }, ambiguous: true });
    const aborted = new AbortController();
    aborted.abort();
    expect(await savePrivateBlockNote(transport, input, aborted.signal)).toMatchObject({ ok: false, error: { category: "aborted" }, ambiguous: false });
    expect(calls).toHaveLength(1);
    expect(JSON.stringify(await savePrivateBlockNote({ rpc: () => Promise.reject(new Error(input.body)) }, input))).not.toContain(input.body);
  }, 60_000);
});
