// Independent R6 acceptance probe. Fresh, synthetic PGlite database only.
// Run explicitly; findings exit 1 and do not enter the ordinary Vitest suite.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { AccountingLab, ids, stages } from '../helpers/accounting-lab.ts';

const outFlag = process.argv.indexOf('--output-dir');
if (outFlag < 0 || !process.argv[outFlag + 1]) throw new Error('--output-dir required');
const out = resolve(process.argv[outFlag + 1]);
mkdirSync(out, { recursive: true });
const results = [];
const check = (name, passed, detail = {}) => {
  const row = { name, passed, ...detail };
  results.push(row);
  console.log(JSON.stringify(row));
};
const attempt = async (lab, fn, input) => {
  try { return { code: '00000', rows: await lab.rows(`select api.${fn}($1::jsonb) response`, [JSON.stringify(input)]) }; }
  catch (error) { return { code: error.code ?? 'unknown', message: error.message }; }
};
const command = (kind, op, revisions, payload) => ({ contractVersion: 1, operationId: op, kind, expectedRevisions: revisions, payload });
const query = (kind, filters, cursor = null, limit = 10) => ({ contractVersion: 1, kind, filters, cursor, limit });
const state = async (lab, task) => {
  await lab.admin();
  const value = await lab.first(`select
    (select state_revision::text from public.task_instances where id=$1) task_revision,
    (select count(*)::int from public.activity_entries) activities,
    (select count(*)::int from app_private.operational_rate_heads) rate_heads,
    (select count(*)::int from app_private.operational_rate_versions) rate_versions,
    (select count(*)::int from app_private.operational_assessments) assessments,
    (select count(*)::int from app_private.operational_assessment_versions) assessment_versions,
    (select count(*)::int from app_private.api_command_receipts) receipts,
    (select count(*)::int from app_private.api_operation_fences) operation_fences,
    (select count(*)::int from app_private.api_month_fences) month_fences,
    (select count(*)::int from public.audit_events where organization_id=$2) audit_events`, [task, ids.org]);
  await lab.db.exec('set role authenticated');
  return value;
};

const lab = new AccountingLab();
try {
  await lab.init(stages.m014);
  const task = await lab.task({ kind: 'operativa' });
  await lab.actor(ids.owner, 'aal1', 'authenticated');
  await lab.admin();
  const helper = await lab.first(`select
    app_private.api_exact_keys('{}'::jsonb,array['required']) empty_required,
    app_private.api_exact_keys('{}'::jsonb,array[]::text[]) empty_empty,
    app_private.api_exact_keys(null::jsonb,array['required']) sql_null,
    app_private.api_exact_keys('null'::jsonb,array[]::text[]) json_null,
    app_private.api_exact_keys('[]'::jsonb,array[]::text[]) non_object`);
  await lab.db.exec('set role authenticated');
  check('key helper always returns strict booleans', Object.values(helper).join(',') === 'false,true,false,false,false', { observed: helper });

  const initial = await state(lab, task);
  const emptyRecord = command('operation.record', lab.next(), {}, { taskId: task, workDate: lab.day, quantity: 1, reference: null });
  let result = await attempt(lab, 'command_v1', emptyRecord);
  check('record rejects empty revisions with no state change', result.code === '22023' && JSON.stringify(await state(lab, task)) === JSON.stringify(initial), { expected: '22023, unchanged', observed: result.code });

  await lab.actor(ids.boss, 'aal2', 'authenticated');
  const emptyRate = command('operation.rate', lab.next(), {}, { companyId: ids.company, templateId: null, taskId: task, effectiveOn: lab.day, unitWeight: '2', reason: 'Prueba R6' });
  result = await attempt(lab, 'command_v1', emptyRate);
  check('rate rejects empty revisions with no state change', result.code === '22023' && JSON.stringify(await state(lab, task)) === JSON.stringify(initial), { expected: '22023, unchanged', observed: result.code });

  const emptyAssessment = command('operation.assess', lab.next(), {}, { taskId: task, quality: 80, order: 80, timeliness: 80, observation: 'Revisión R6' });
  result = await attempt(lab, 'command_v1', emptyAssessment);
  check('assessment rejects empty revisions with no state change', result.code === '22023' && JSON.stringify(await state(lab, task)) === JSON.stringify(initial), { expected: '22023, unchanged', observed: result.code });

  await lab.actor(ids.owner, 'aal1', 'authenticated');
  const absentRevisions = { contractVersion: 1, operationId: lab.next(), kind: 'operation.record', payload: { taskId: task, workDate: lab.day, quantity: 1, reference: null } };
  result = await attempt(lab, 'command_v1', absentRevisions);
  check('record rejects missing revision envelope', result.code === '22023' && JSON.stringify(await state(lab, task)) === JSON.stringify(initial), { expected: '22023, unchanged', observed: result.code });

  const nullRevision = command('operation.record', lab.next(), { [`task:${task}`]: null }, { taskId: task, workDate: lab.day, quantity: 1, reference: null });
  result = await attempt(lab, 'command_v1', nullRevision);
  check('record rejects null revision value', result.code === '22023' && JSON.stringify(await state(lab, task)) === JSON.stringify(initial), { expected: '22023, unchanged', observed: result.code });

  const validRecord = command('operation.record', lab.next(), { [`task:${task}`]: initial.task_revision }, { taskId: task, workDate: lab.day, quantity: 1, reference: null });
  result = await attempt(lab, 'command_v1', validRecord);
  const afterValid = await state(lab, task);
  const stale = command('operation.record', lab.next(), { [`task:${task}`]: initial.task_revision }, { taskId: task, workDate: lab.day, quantity: 1, reference: null });
  const staleResult = await attempt(lab, 'command_v1', stale);
  check('stale explicit revision remains serialization failure', result.code === '00000' && staleResult.code === '40001' && JSON.stringify(await state(lab, task)) === JSON.stringify(afterValid), { expected: 'valid 00000, stale 40001, unchanged after stale', valid: result.code, stale: staleResult.code });

  const receiptQuery = query('commandReceipt', {});
  const receiptResult = await attempt(lab, 'query_v1', receiptQuery);
  check('receipt query rejects empty filters', receiptResult.code === '22023', { expected: '22023', observed: receiptResult.code });

  const rateHistory = query('rateHistory', { companyId: ids.company });
  const historyResult = await attempt(lab, 'query_v1', rateHistory);
  check('rate history rejects incomplete filter shape', historyResult.code === '22023', { expected: '22023', observed: historyResult.code });

  const sources = ['supabase/migrations/202610150014_operational_api.sql', 'tests/review/m2-2a-r6-independent-review.mjs'];
  const report = { scope: 'Independent M2.2A R6 null-safety and state-preservation acceptance; synthetic PGlite only', total: results.length, passed: results.filter(x => x.passed).length, failed: results.filter(x => !x.passed).length, results, sha256: Object.fromEntries(sources.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])) };
  writeFileSync(join(out, 'review.json'), JSON.stringify(report, null, 2) + '\n');
  process.exitCode = report.failed ? 1 : 0;
} finally { await lab.close(); }
