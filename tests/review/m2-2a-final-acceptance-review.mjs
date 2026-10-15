// Independent M2.2A null-safety regression matrix. Synthetic PGlite only.
// Exit 1 records a contract finding; no network or hosted project is used.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { AccountingLab, ids, stages } from '../helpers/accounting-lab.ts';
import { decodeCommandV1 } from '../../src/data/supabase/operational-contract.ts';

const flag = process.argv.indexOf('--output-dir');
if (flag < 0 || !process.argv[flag + 1]) throw Error('--output-dir required');
const output = resolve(process.argv[flag + 1]);
mkdirSync(output, { recursive: true });
const lab = new AccountingLab();
const results = [];
const check = (name, passed, detail = {}) => {
  const result = { name, passed, ...detail };
  results.push(result);
  console.log(JSON.stringify(result));
};
const attempt = async (input, query = false) => {
  try {
    const rows = await lab.rows(`select api.${query ? 'query' : 'command'}_v1($1::jsonb) response`, [JSON.stringify(input)]);
    return { code: '00000', response: rows[0].response };
  } catch (error) { return { code: error.code ?? 'unknown', message: error.message }; }
};
const snapshot = async (task) => {
  await lab.admin();
  const result = await lab.first(`select
    (select state_revision::text from public.task_instances where id=$1) task_revision,
    (select count(*)::int from public.activity_entries where instance_id=$1) activity,
    (select count(*)::int from app_private.operational_rate_heads where instance_id=$1) rate_heads,
    (select count(*)::int from app_private.operational_rate_versions v join app_private.operational_rate_heads h on h.id=v.head_id where h.instance_id=$1) rate_versions,
    (select count(*)::int from app_private.operational_assessments where instance_id=$1) assessments,
    (select count(*)::int from app_private.operational_assessment_versions where instance_id=$1) assessment_versions,
    (select count(*)::int from app_private.api_command_receipts) receipts,
    (select count(*)::int from app_private.api_operation_fences) operation_fences,
    (select count(*)::int from app_private.api_month_fences) month_fences,
    (select count(*)::int from public.audit_events ae where ae.organization_id=$2 and (
      ae.entity_id in (select e.id from public.activity_entries e where e.instance_id=$1)
      or ae.entity_id in (select v.id from app_private.operational_rate_versions v join app_private.operational_rate_heads h on h.id=v.head_id where h.instance_id=$1)
      or ae.entity_id in (select v.id from app_private.operational_assessment_versions v where v.instance_id=$1)
      or ae.details @> jsonb_build_object('instance',$1::text)
      or ae.details @> jsonb_build_object('taskId',$1::text)
      or ae.details @> jsonb_build_object('scopeId',$1::text)
    )) task_audit`, [task, ids.org]);
  await lab.db.exec('set role authenticated');
  return result;
};
const command = (kind, operationId, expectedRevisions, payload) => ({ contractVersion: 1, operationId, kind, expectedRevisions, payload });
try {
  await lab.init(stages.m014);
  const task = await lab.task({ kind: 'operativa' });
  await lab.actor(ids.owner, 'aal1', 'authenticated');
  const initial = await snapshot(task);

  await lab.admin();
  const helperMatrix = await lab.rows(`select
    app_private.api_exact_keys('{}'::jsonb,array['required']) as empty_expected_key,
    app_private.api_exact_keys('{}'::jsonb,array[]::text[]) as empty_empty,
    app_private.api_exact_keys(null::jsonb,array['required']) as sql_null,
    app_private.api_exact_keys('null'::jsonb,array[]::text[]) as json_null,
    app_private.api_exact_keys('[]'::jsonb,array[]::text[]) as non_object`);
  await lab.db.exec('set role authenticated');
  const helperValues = Object.values(helperMatrix[0]);
  check('exact keys returns strict booleans for empty, SQL null, JSON null, and non-object', helperValues.join(',') === 'false,true,false,false,false', { observed: helperMatrix[0] });

  const invalidCommands = [
    ['record empty revisions', command('operation.record', lab.next(), {}, { taskId: task, workDate: lab.day, quantity: 1, reference: null })],
    ['record null revisions', command('operation.record', lab.next(), null, { taskId: task, workDate: lab.day, quantity: 1, reference: null })],
    ['record wrong-type revisions', command('operation.record', lab.next(), [], { taskId: task, workDate: lab.day, quantity: 1, reference: null })],
    ['record missing revision envelope field', { contractVersion: 1, operationId: lab.next(), kind: 'operation.record', payload: { taskId: task, workDate: lab.day, quantity: 1, reference: null } }],
    ['JSON null command envelope', null],
    ['record extra revision key', command('operation.record', lab.next(), { [`task:${task}`]: '0', extra: '0' }, { taskId: task, workDate: lab.day, quantity: 1, reference: null })],
    ['record null revision value', command('operation.record', lab.next(), { [`task:${task}`]: null }, { taskId: task, workDate: lab.day, quantity: 1, reference: null })],
    ['record empty payload', command('operation.record', lab.next(), { [`task:${task}`]: '0' }, {})],
    ['record null contract version', { ...command('operation.record', lab.next(), { [`task:${task}`]: '0' }, { taskId: task, workDate: lab.day, quantity: 1, reference: null }), contractVersion: null }],
  ];
  for (const [name, input] of invalidCommands) {
    const result = await attempt(input);
    const unchanged = JSON.stringify(await snapshot(task)) === JSON.stringify(initial);
    check(`${name} rejects before writes or fences`, result.code === '22023' && unchanged, { expected: '22023, unchanged state', decoderAccepts: decodeCommandV1(input).ok, observed: result.code, unchanged });
  }
  let sqlNullCommand = '00000';
  try { await lab.rows('select api.command_v1(null::jsonb)'); } catch (error) { sqlNullCommand = error.code ?? 'unknown'; }
  check('SQL NULL command envelope rejects without writes or fences', sqlNullCommand === '22023' && JSON.stringify(await snapshot(task)) === JSON.stringify(initial), { expected: '22023, unchanged state', observed: sqlNullCommand });

  const recordInput = (revisions, op = lab.next()) => command('operation.record', op, revisions, { taskId: task, workDate: lab.day, quantity: 1, reference: null });
  const currentRecord = recordInput({ [`task:${task}`]: initial.task_revision });
  const validRecord = await attempt(currentRecord);
  check('current explicit task revision succeeds', validRecord.code === '00000', { observed: validRecord.code });
  const afterRecord = await snapshot(task);
  const staleRecord = await attempt(recordInput({ [`task:${task}`]: initial.task_revision }));
  check('stale explicit task revision rejects without partial effects', staleRecord.code === '40001' && JSON.stringify(await snapshot(task)) === JSON.stringify(afterRecord), { expected: '40001, unchanged state', observed: staleRecord.code });

  const boss = ids.boss;
  await lab.actor(boss, 'aal2', 'authenticated');
  const rateKey = `rate:${ids.company}:task:${task}`;
  const ratePayload = { companyId: ids.company, templateId: null, taskId: task, effectiveOn: lab.day, unitWeight: '2', reason: 'Independent review' };
  const beforeRate = await snapshot(task);
  const emptyRate = command('operation.rate', lab.next(), {}, ratePayload);
  const emptyRateResult = await attempt(emptyRate);
  check('rate rejects empty revisions without partial rate, audit, receipt, or fence', emptyRateResult.code === '22023' && JSON.stringify(await snapshot(task)) === JSON.stringify(beforeRate) && !decodeCommandV1(emptyRate).ok, { expected: '22023 and unchanged state', decoderAccepts: decodeCommandV1(emptyRate).ok, observed: emptyRateResult.code });
  const validRate = await attempt(command('operation.rate', lab.next(), { [rateKey]: '0' }, ratePayload));
  check('rate accepts explicit current revision', validRate.code === '00000', { observed: validRate.code });
  const afterRate = await snapshot(task);
  const staleRate = await attempt(command('operation.rate', lab.next(), { [rateKey]: '0' }, { ...ratePayload, unitWeight: '3' }));
  check('rate rejects stale explicit revision without partial effects', staleRate.code === '40001' && JSON.stringify(await snapshot(task)) === JSON.stringify(afterRate), { expected: '40001, unchanged state', observed: staleRate.code });

  const assessmentPayload = { taskId: task, quality: 90, order: 90, timeliness: 90, observation: 'Independent review' };
  const assessRevisions = { [`task:${task}`]: afterRecord.task_revision, [`assessment:${task}`]: '0' };
  const beforeAssessment = await snapshot(task);
  const emptyAssessment = command('operation.assess', lab.next(), {}, assessmentPayload);
  const emptyAssessmentResult = await attempt(emptyAssessment);
  check('assessment rejects empty revisions without partial assessment or fences', emptyAssessmentResult.code === '22023' && JSON.stringify(await snapshot(task)) === JSON.stringify(beforeAssessment) && !decodeCommandV1(emptyAssessment).ok, { expected: '22023 and unchanged state', decoderAccepts: decodeCommandV1(emptyAssessment).ok, observed: emptyAssessmentResult.code });
  const partialAssessment = command('operation.assess', lab.next(), { [`task:${task}`]: afterRecord.task_revision }, assessmentPayload);
  check('assessment rejects missing assessment revision', (await attempt(partialAssessment)).code === '22023', { expected: '22023' });
  const validAssessment = await attempt(command('operation.assess', lab.next(), assessRevisions, assessmentPayload));
  check('assessment accepts both explicit current revisions', validAssessment.code === '00000', { observed: validAssessment.code });
  const afterAssessment = await snapshot(task);
  const staleAssessment = await attempt(command('operation.assess', lab.next(), assessRevisions, { ...assessmentPayload, quality: 91 }));
  check('assessment rejects stale explicit revisions without partial effects', staleAssessment.code === '40001' && JSON.stringify(await snapshot(task)) === JSON.stringify(afterAssessment), { expected: '40001, unchanged state', observed: staleAssessment.code });

  const malformedQueries = [
    ['JSON null query envelope', null],
    ['summary empty filters', { contractVersion: 1, kind: 'operationalSummary', filters: {}, cursor: null, limit: 1 }],
    ['activity null filters', { contractVersion: 1, kind: 'activityPage', filters: null, cursor: null, limit: 10 }],
    ['receipt empty filters', { contractVersion: 1, kind: 'commandReceipt', filters: {}, cursor: null, limit: 1 }],
    ['receipt wrong-type operation id', { contractVersion: 1, kind: 'commandReceipt', filters: { operationId: null }, cursor: null, limit: 1 }],
    ['rate history missing scope key', { contractVersion: 1, kind: 'rateHistory', filters: { companyId: ids.company, templateId: null }, cursor: null, limit: 10 }],
    ['null query contract version', { contractVersion: null, kind: 'operationalSummary', filters: { taskId: task }, cursor: null, limit: 1 }],
  ];
  for (const [name, input] of malformedQueries) {
    const result = await attempt(input, true);
    check(`${name} returns protocol error`, result.code === '22023', { expected: '22023', observed: result.code });
  }
  let sqlNullQuery = '00000';
  try { await lab.rows('select api.query_v1(null::jsonb)'); } catch (error) { sqlNullQuery = error.code ?? 'unknown'; }
  check('SQL NULL query envelope returns protocol error', sqlNullQuery === '22023', { expected: '22023', observed: sqlNullQuery });
  const summary = await attempt({ contractVersion: 1, kind: 'operationalSummary', filters: { taskId: task }, cursor: null, limit: 1 }, true);
  check('well-formed summary query remains available', summary.code === '00000', { observed: summary.code });

  // A protocol error rolled back to a savepoint must not poison the outer transaction.
  await lab.actor(ids.owner, 'aal1', 'authenticated');
  await lab.db.exec('begin; savepoint r6_invalid_command;');
  const savepointInvalid = await attempt(recordInput({}));
  await lab.db.exec('rollback to savepoint r6_invalid_command;');
  const savepointCurrent = await snapshot(task);
  const savepointValid = await attempt(recordInput({ [`task:${task}`]: savepointCurrent.task_revision }));
  const savepointAfter = await snapshot(task);
  await lab.db.exec('release savepoint r6_invalid_command; commit;');
  check('22023 can be rolled back to savepoint before a valid command commits', savepointInvalid.code === '22023' && savepointValid.code === '00000' && Number(savepointAfter.activity) === Number(savepointCurrent.activity) + 1, { invalidSQLSTATE: savepointInvalid.code, validSQLSTATE: savepointValid.code, before: savepointCurrent, after: savepointAfter });
} finally { await lab.close(); }

const report = { candidate: 'R6 null-safe validation', total: results.length, passed: results.filter(x => x.passed).length, failed: results.filter(x => !x.passed).length, results };
writeFileSync(join(output, 'review.json'), JSON.stringify(report, null, 2) + '\n');
process.exitCode = report.failed ? 1 : 0;
