import { describe, expect, it } from "vitest";
import { AccountingLab, ids, stages } from "./helpers/accounting-lab";

describe("Supabase M2.2A migration 014", () => {
  it("adds operational snapshots without rewriting populated 013 history", async () => {
    const lab = new AccountingLab();
    try {
      await lab.init(stages.m013);
      const task = await lab.task({ kind: "operativa", period: "2025-04-01" });
      const activity = lab.next(), closure = lab.next(), report = lab.next(), delivery = lab.next();
      const session = lab.next(), mutationOperation = lab.next(), privateNote = lab.next(), privateNoteOperation = lab.next();
      await lab.admin();
      await lab.db.query(
        "insert into activity_entries(id,organization_id,instance_id,work_date,quantity,reference,actor_id,created_at) values($1,$2,$3,'2025-04-02',18,'histórico sin cambios',$4,'2025-04-03T12:00:00Z')",
        [activity, ids.org, task, ids.owner],
      );
      await lab.db.query(
        "insert into monthly_closures(id,organization_id,owner_id,period,snapshot,closed_by,note) values($1,$2,$3,'2025-04-01',$4::jsonb,$5,'Cierre anterior')",
        [closure, ids.org, ids.owner, JSON.stringify({ schemaVersion: 4, immutable: ["v4", 17] }), ids.boss],
      );
      await lab.db.query(
        "insert into period_reports(id,organization_id,closure_id,owner_id,period,snapshot) select $1,organization_id,id,owner_id,period,snapshot from monthly_closures where id=$2",
        [report, closure],
      );
      await lab.db.query(
        "insert into report_deliveries(id,organization_id,report_id,recipient_id,recipient_email) values($1,$2,$3,$4,'synthetic@example.test')",
        [delivery, ids.org, report, ids.boss],
      );
      await lab.db.query(
        "insert into report_outbox_events(organization_id,delivery_id) values($1,$2)",
        [ids.org, delivery],
      );
      await lab.db.query(
        "insert into task_time_sessions(id,organization_id,instance_id,actor_id,started_at,ended_at) values($1,$2,$3,$4,'2025-04-02T08:00:00Z','2025-04-02T08:30:00Z')",
        [session, ids.org, task, ids.owner],
      );
      await lab.db.query(
        "insert into task_mutation_receipts(organization_id,actor_id,operation_id,operation_kind,arguments,result) values($1,$2,$3,'pause_timer',$4::jsonb,$5::jsonb)",
        [ids.org, ids.owner, mutationOperation, JSON.stringify({ legacy: "arguments" }), JSON.stringify({ elapsed: 1800 })],
      );
      await lab.db.query(
        "insert into task_private_block_notes(id,organization_id,instance_id,author_id,body,revision) values($1,$2,$3,$4,'Nota privada histórica',1)",
        [privateNote, ids.org, task, ids.owner],
      );
      await lab.db.query(
        "insert into task_private_block_note_versions(note_id,organization_id,revision,body,at,actor_id) values($1,$2,1,'Nota privada histórica','2025-04-02T08:00:00Z',$3)",
        [privateNote, ids.org, ids.owner],
      );
      await lab.db.query(
        "insert into private_block_note_receipts(organization_id,actor_id,operation_id,arguments,result) values($1,$2,$3,$4::jsonb,$5::jsonb)",
        [ids.org, ids.owner, privateNoteOperation, JSON.stringify({ body: "Nota privada histórica" }), JSON.stringify({ revision: 1 })],
      );

      const prior = await lab.first(
        `select id,organization_id,instance_id,work_date,quantity,reference,actor_id,created_at from activity_entries where id=$1`,
        [activity],
      );
      const taskBefore = await lab.first(
        "select to_jsonb(t)::text row from task_instances t where id=$1",
        [task],
      );
      const closeBefore = await lab.first(
        "select snapshot::text snapshot from monthly_closures where id=$1",
        [closure],
      );
      const reportBefore = await lab.first(
        "select snapshot::text snapshot from period_reports where id=$1",
        [report],
      );
      const outboxBefore = await lab.rows(
        "select to_jsonb(o)::text row from report_outbox_events o where delivery_id=$1",
        [delivery],
      );
      const sessionBefore = await lab.first("select to_jsonb(s)::text row from task_time_sessions s where id=$1", [session]);
      const mutationReceiptBefore = await lab.first("select to_jsonb(r)::text row from task_mutation_receipts r where operation_id=$1", [mutationOperation]);
      const privateNoteBefore = await lab.first("select to_jsonb(n)::text row from task_private_block_notes n where id=$1", [privateNote]);
      const privateNoteVersionsBefore = await lab.rows("select to_jsonb(v)::text row from task_private_block_note_versions v where note_id=$1", [privateNote]);
      const privateNoteReceiptBefore = await lab.first("select to_jsonb(r)::text row from private_block_note_receipts r where operation_id=$1", [privateNoteOperation]);

      await lab.migrate(stages.m013, stages.m014);

      expect(await lab.first(
        `select id,organization_id,instance_id,work_date,quantity,reference,actor_id,created_at from activity_entries where id=$1`,
        [activity],
      )).toEqual(prior);
      expect(await lab.first(
        "select measurement_version,operational_rate_id,operational_unit_weight,unit_snapshot from activity_entries where id=$1",
        [activity],
      )).toEqual({ measurement_version: 1, operational_rate_id: null, operational_unit_weight: null, unit_snapshot: null });
      expect(await lab.first(
        "select to_jsonb(t)::text row from task_instances t where id=$1",
        [task],
      )).toEqual(taskBefore);
      expect(await lab.first(
        "select snapshot::text snapshot from monthly_closures where id=$1",
        [closure],
      )).toEqual(closeBefore);
      expect(await lab.first(
        "select snapshot::text snapshot from period_reports where id=$1",
        [report],
      )).toEqual(reportBefore);
      expect(await lab.rows(
        "select to_jsonb(o)::text row from report_outbox_events o where delivery_id=$1",
        [delivery],
      )).toEqual(outboxBefore);
      expect(await lab.first("select to_jsonb(s)::text row from task_time_sessions s where id=$1", [session])).toEqual(sessionBefore);
      expect(await lab.first("select to_jsonb(r)::text row from task_mutation_receipts r where operation_id=$1", [mutationOperation])).toEqual(mutationReceiptBefore);
      expect(await lab.first("select to_jsonb(n)::text row from task_private_block_notes n where id=$1", [privateNote])).toEqual(privateNoteBefore);
      expect(await lab.rows("select to_jsonb(v)::text row from task_private_block_note_versions v where note_id=$1", [privateNote])).toEqual(privateNoteVersionsBefore);
      expect(await lab.first("select to_jsonb(r)::text row from private_block_note_receipts r where operation_id=$1", [privateNoteOperation])).toEqual(privateNoteReceiptBefore);
      expect(await lab.first("select count(*)::int count from app_private.operational_rate_versions")).toEqual({ count: 0 });
      expect(await lab.first("select count(*)::int count from app_private.operational_assessment_versions")).toEqual({ count: 0 });
      expect(await lab.first("select count(*)::int count from app_private.api_command_receipts")).toEqual({ count: 0 });
      expect(await lab.first("select count(*)::int count from app_private.api_month_fences where owner_id=$1 and period='2025-04-01'", [ids.owner])).toEqual({ count: 1 });
      expect(await lab.first("select count(*)::int count from app_private.api_month_fences")).toEqual({ count: 1 });
    } finally {
      await lab.db.close();
    }
  }, 20_000);
});
