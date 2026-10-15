// Independent final acceptance probes against the committed M2.2A candidate.
// Synthetic, disposable PGlite only. Exit 1 records a contract finding.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { AccountingLab, ids, stages } from '../helpers/accounting-lab.ts';
import { decodeCommandV1 } from '../../src/data/supabase/operational-contract.ts';

const flag = process.argv.indexOf('--output-dir');
if (flag < 0 || !process.argv[flag + 1]) throw Error('--output-dir required');
const output = resolve(process.argv[flag + 1]);
mkdirSync(output, { recursive: true });
const results = [];
const lab = new AccountingLab();
const check = (name, passed, detail) => {
  const row = { name, passed, ...detail };
  results.push(row);
  console.log(JSON.stringify(row));
};
const attempt = async (input, query = false) => {
  try {
    const rows = await lab.rows(`select api.${query ? 'query' : 'command'}_v1($1::jsonb) response`, [JSON.stringify(input)]);
    return { code: '00000', response: rows[0].response };
  } catch (error) { return { code: error.code, message: error.message }; }
};
try {
  await lab.init(stages.m014);
  const task = await lab.task({ kind: 'operativa' });
  await lab.actor(ids.owner, 'aal1', 'authenticated');
  const record = (revisions) => ({ contractVersion: 1, operationId: lab.next(), kind: 'operation.record', expectedRevisions: revisions, payload: { taskId: task, workDate: lab.day, quantity: 1, reference: null } });
  const state = async () => {
    await lab.admin();
    const result = await lab.first('select (select state_revision::text from task_instances where id=$1) revision,(select count(*)::int from activity_entries where instance_id=$1) entries,(select count(*)::int from app_private.api_command_receipts) receipts', [task]);
    await lab.db.exec('set role authenticated');
    return result;
  };
  const before = await state();
  const emptyRecord = record({});
  const missing = await attempt(emptyRecord);
  const after = await state();
  check('record rejects empty revisions without effects', missing.code === '22023' && JSON.stringify(before) === JSON.stringify(after), { expected: '22023 and unchanged state', decoderAccepts: decodeCommandV1(emptyRecord).ok, observed: missing, before, after });
  const valid = await attempt(record({ [`task:${task}`]: after.revision }));
  check('explicit current revision succeeds', valid.code === '00000', { observed: valid.code });
  const stale = await attempt(record({ [`task:${task}`]: '0' }));
  check('explicit stale revision is rejected', stale.code === '40001', { expected: '40001', observed: stale.code });
  await lab.actor(ids.boss, 'aal2', 'authenticated');
  const rate = { contractVersion: 1, operationId: lab.next(), kind: 'operation.rate', expectedRevisions: {}, payload: { companyId: ids.company, templateId: null, taskId: task, effectiveOn: lab.day, unitWeight: '2', reason: 'Independent review' } };
  const rateResult = await attempt(rate);
  check('rate rejects empty revisions', rateResult.code === '22023', { expected: '22023', decoderAccepts: decodeCommandV1(rate).ok, observed: rateResult });
  const assess = { contractVersion: 1, operationId: lab.next(), kind: 'operation.assess', expectedRevisions: {}, payload: { taskId: task, quality: 90, order: 90, timeliness: 90, observation: 'Independent review' } };
  const assessed = await attempt(assess);
  check('assessment rejects empty revisions', assessed.code === '22023', { expected: '22023', decoderAccepts: decodeCommandV1(assess).ok, observed: assessed });
  const malformedQuery = await attempt({ contractVersion: 1, kind: 'operationalSummary', filters: {}, cursor: null, limit: 1 }, true);
  check('query rejects empty filters as protocol error', malformedQuery.code === '22023', { expected: '22023', observed: malformedQuery });
  const malformedReceipt = await attempt({ contractVersion: 1, kind: 'commandReceipt', filters: {}, cursor: null, limit: 1 }, true);
  check('receipt query rejects empty filters as protocol error', malformedReceipt.code === '22023', { expected: '22023', observed: malformedReceipt });
  const malformedPayload = record({});
  malformedPayload.payload = {};
  const empty = await attempt(malformedPayload);
  check('record rejects empty payload as protocol error', empty.code === '22023', { expected: '22023', observed: empty });
  const current = await state();
  const oneMissingAssessment = { ...assess, operationId: lab.next(), expectedRevisions: { [`task:${task}`]: current.revision } };
  const partial = await attempt(oneMissingAssessment);
  check('assessment rejects a missing assessment revision', partial.code === '22023', { expected: '22023', observed: partial });
} finally { await lab.close(); }
const report = { candidate: '9c096973c21fe56fdb91ac0ba4e54ec0f8232649', total: results.length, passed: results.filter(x => x.passed).length, failed: results.filter(x => !x.passed).length, results };
writeFileSync(join(output, 'review.json'), JSON.stringify(report, null, 2) + '\n');
process.exitCode = report.failed ? 1 : 0;
