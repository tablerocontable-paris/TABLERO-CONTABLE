// Independent M2.2A acceptance probes. Fresh, synthetic PGlite databases only.
// Run explicitly; findings exit 1 and do not enter the ordinary Vitest suite.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { AccountingLab, ids, stages } from '../helpers/accounting-lab.ts';
import { decodeCommandV1, decodeQueryResponseV1, decodeQueryDataV1 } from '../../src/data/supabase/operational-contract.ts';

const outFlag = process.argv.indexOf('--output-dir');
if (outFlag < 0 || !process.argv[outFlag + 1]) throw new Error('--output-dir required');
const out = resolve(process.argv[outFlag + 1]);
mkdirSync(out, { recursive: true });
const results = [];
const record = (name, passed, details) => {
  const row = { name, passed, ...details };
  results.push(row);
  console.log(JSON.stringify(row));
};
const attempt = async (lab, sql, args = []) => {
  try { return { code: '00000', rows: await lab.rows(sql, args) }; }
  catch (error) { return { code: error.code, message: error.message }; }
};
const query = (kind, taskId) => ({ contractVersion: 1, kind, filters: { taskId }, cursor: null, limit: 1 });
const call = (lab, input) => attempt(lab, 'select api.query_v1($1::jsonb) response', [JSON.stringify(input)]);

// A reference valid under the original trim(space) constraint must stay valid.
{
  const lab = new AccountingLab();
  try {
    await lab.init(stages.m013);
    const task = await lab.task({ kind: 'operativa' });
    await lab.db.query('insert into activity_entries(organization_id,instance_id,work_date,quantity,reference,actor_id) values($1,$2,$3,1,$4,$5)', [ids.org, task, lab.day, '\t\n', ids.owner]);
    let code = '00000';
    try { await lab.migrate(stages.m013, stages.m014); }
    catch (error) { code = error.code; await lab.db.exec('rollback'); }
    await lab.actor(ids.owner, 'aal1', 'authenticated');
    const page = code === '00000' ? await call(lab, query('activityPage', task)) : { code };
    const preserved = page.code === '00000' && page.rows[0].response.data.items[0].reference === '\t\n' && decodeQueryResponseV1(page.rows[0].response).ok;
    record('013 valid whitespace reference survives upgrade without rewriting', code === '00000' && preserved, { expected: '00000', observed: code, pageSQL: page.code, referencePreserved: preserved });
  } finally { await lab.close(); }
}

{
  const lab = new AccountingLab();
  try {
    await lab.init(stages.m014);
    const task = await lab.task({ kind: 'operativa' });
    await lab.actor(ids.owner, 'aal1', 'authenticated');

    const malformed = [
      ['null query kind', { ...query(null, task) }, '22023'],
      ['integer overflow in query limit', { ...query('activityPage', task), limit: 2147483648 }, '22023'],
      ['null cursor timestamp', { ...query('activityPage', task), cursor: Buffer.from(JSON.stringify({ kind: 'activityPage', taskId: task, createdAt: null, entryId: task })).toString('base64url') }, '22023'],
      ['null cursor kind', { ...query('activityPage', task), cursor: Buffer.from(JSON.stringify({ kind: null, taskId: task, createdAt: '2026-10-01T00:00:00Z', entryId: task })).toString('base64url') }, '22023'],
      ['infinite cursor timestamp', { ...query('activityPage', task), cursor: Buffer.from(JSON.stringify({ kind: 'activityPage', taskId: task, createdAt: 'infinity', entryId: task })).toString('base64url') }, '22023'],
      ['cursor missing entry id', { ...query('activityPage', task), cursor: Buffer.from(JSON.stringify({ kind: 'activityPage', taskId: task, createdAt: '2026-10-01T00:00:00Z' })).toString('base64url') }, '22023'],
    ];
    for (const [name, input, expected] of malformed) {
      const result = await call(lab, input);
      record(name, result.code === expected, { expected, observed: result.code, responseDecodes: result.code === '00000' ? decodeQueryResponseV1(result.rows[0].response).ok : null });
    }
    const nullKindCommand = { contractVersion: 1, operationId: lab.next(), kind: null, expectedRevisions: {}, payload: {} };
    const nullKindSql = await attempt(lab, 'select api.command_v1($1::jsonb)', [JSON.stringify(nullKindCommand)]);
    record('null command kind is rejected with generic protocol error', nullKindSql.code === '22023', { expected: '22023', observed: nullKindSql.code });

    const zeroYear = { contractVersion: 1, operationId: lab.next(), kind: 'operation.record', expectedRevisions: { [`task:${task}`]: '0' }, payload: { taskId: task, workDate: '0000-01-01', quantity: 1, reference: null } };
    const zeroYearSql = await attempt(lab, 'select api.command_v1($1::jsonb)', [JSON.stringify(zeroYear)]);
    record('year zero is rejected by decoder and SQL', !decodeCommandV1(zeroYear).ok && zeroYearSql.code === '22023', { decoderAccepts: decodeCommandV1(zeroYear).ok, sqlCode: zeroYearSql.code });

    await lab.actor(ids.boss, 'aal2', 'authenticated');
    const unicodeAssessment = { contractVersion: 1, operationId: lab.next(), kind: 'operation.assess', expectedRevisions: { [`task:${task}`]: '0', [`assessment:${task}`]: '0' }, payload: { taskId: task, quality: 90, order: 90, timeliness: 90, observation: '😀'.repeat(600) } };
    const assessed = await attempt(lab, 'select api.command_v1($1::jsonb)', [JSON.stringify(unicodeAssessment)]);
    const quality = await call(lab, query('quality', task));
    record('non-BMP text length is compatible between installed Zod and SQL', decodeCommandV1(unicodeAssessment).ok && assessed.code === '00000' && quality.code === '00000' && decodeQueryResponseV1(quality.rows[0].response).ok, { decoderAccepts: decodeCommandV1(unicodeAssessment).ok, sqlCode: assessed.code, responseDecodes: quality.code === '00000' && decodeQueryResponseV1(quality.rows[0].response).ok });

  } finally { await lab.close(); }
}

// A failed upgrade must leave no 014 objects or columns behind.
{
  const lab = new AccountingLab();
  try {
    await lab.init(stages.m013);
    const task = await lab.task({ kind: 'operativa' });
    await lab.db.query('alter table activity_entries drop constraint activity_entries_reference_check');
    await lab.db.query('insert into activity_entries(organization_id,instance_id,work_date,quantity,reference,actor_id) values($1,$2,$3,1,$4,$5)', [ids.org, task, lab.day, ' ', ids.owner]);
    let code = '00000';
    try { await lab.migrate(stages.m013, stages.m014); }
    catch (error) { code = error.code; await lab.db.exec('rollback'); }
    const after = await lab.first("select to_regclass('app_private.operational_rate_heads')::text as rate_table,exists(select 1 from information_schema.columns where table_name='activity_entries' and column_name='measurement_version') as version_column,(select count(*)::int from activity_entries where instance_id=$1 and reference=' ') as legacy_rows", [task]);
    record('failed 014 upgrade rolls back its schema changes and preserves prior rows', code === '23514' && after.rate_table === null && after.version_column === false && after.legacy_rows === 1, { migrationSQLSTATE: code, ...after });
  } finally { await lab.close(); }
}

{
  const lab = new AccountingLab();
  try {
    await lab.init(stages.m013);
    const task = await lab.task({ kind: 'operativa' });
    await lab.db.query('update task_instances set unit=$2 where id=$1', [task, 'u'.repeat(81)]);
    await lab.db.query('insert into activity_entries(organization_id,instance_id,work_date,quantity,reference,actor_id) values($1,$2,$3,1,$4,$5)', [ids.org, task, lab.day, 'Legacy reference', ids.owner]);
    await lab.migrate(stages.m013, stages.m014);
    await lab.actor(ids.owner, 'aal1', 'authenticated');
    const page = await call(lab, query('activityPage', task));
    const summary = await call(lab, query('operationalSummary', task));
    const pageDecoded = page.code === '00000' && decodeQueryResponseV1(page.rows[0].response).ok;
    const summaryDecoded = summary.code === '00000' && decodeQueryResponseV1(summary.rows[0].response).ok;
    record('legacy unit longer than 80 remains readable in activity and summary DTOs', pageDecoded && summaryDecoded && page.rows[0].response.data.items[0].unit === 'u'.repeat(81) && summary.rows[0].response.data.unit === 'u'.repeat(81), { pageSQL: page.code, summarySQL: summary.code, pageDecodes: pageDecoded, summaryDecodes: summaryDecoded, unitPreserved: pageDecoded && summaryDecoded && page.rows[0].response.data.items[0].unit === 'u'.repeat(81) && summary.rows[0].response.data.unit === 'u'.repeat(81) });
    await lab.actor(ids.boss, 'aal2', 'authenticated');
    const invalidRate = { contractVersion: 1, operationId: lab.next(), kind: 'operation.rate', expectedRevisions: { [`rate:${ids.company}:task:${task}`]: '0' }, payload: { companyId: ids.company, templateId: null, taskId: task, effectiveOn: lab.day, unitWeight: '2', reason: 'Coeficiente sintético' } };
    const rateRejected = await attempt(lab, 'select api.command_v1($1::jsonb)', [JSON.stringify(invalidRate)]);
    await lab.admin();
    const rateArtifacts = await lab.first('select (select count(*) from app_private.operational_rate_versions)::text||\'|\'||(select count(*) from app_private.api_command_receipts where operation_id=$1)::text||\'|\'||(select count(*) from app_private.api_operation_fences where operation_id=$1)::text as state', [invalidRate.operationId]);
    record('v2 rate write rejects legacy unit over 80 without partial state', rateRejected.code === '22023' && rateArtifacts.state === '0|0|0', { sqlCode: rateRejected.code, artifacts: rateArtifacts.state });
    await lab.actor(ids.owner, 'aal1', 'authenticated');
    const recordArgs = { contractVersion: 1, operationId: lab.next(), kind: 'operation.record', expectedRevisions: { [`task:${task}`]: '0' }, payload: { taskId: task, workDate: lab.day, quantity: 1, reference: null } };
    const recordRejected = await attempt(lab, 'select api.command_v1($1::jsonb)', [JSON.stringify(recordArgs)]);
    await lab.admin();
    const recordArtifacts = await lab.rows('select (select count(*) from activity_entries where instance_id=$1 and measurement_version=2)::text||\'|\'||(select count(*) from app_private.api_command_receipts where operation_id=$2)::text||\'|\'||(select count(*) from app_private.api_operation_fences where operation_id=$2)::text as state', [task, recordArgs.operationId]);
    record('v2 activity write rejects legacy unit over 80 before creating records or receipts', recordRejected.code === '22023' && recordArtifacts[0].state === '0|0|0', { sqlCode: recordRejected.code, artifacts: recordArtifacts[0].state });
  } finally { await lab.close(); }
}

{
  const lab = new AccountingLab();
  try {
    await lab.init(stages.m014);
    const task = await lab.task({ kind: 'operativa' });
    await lab.actor(ids.owner, 'aal1', 'authenticated');
    const cmd = { contractVersion: 1, operationId: lab.next(), kind: 'operation.record', expectedRevisions: { [`task:${task}`]: '0' }, payload: { taskId: task, workDate: lab.day, quantity: 2, reference: null } };
    const saved = await attempt(lab, 'select api.command_v1($1::jsonb)', [JSON.stringify(cmd)]);
    const page = await call(lab, query('activityPage', task));
    const queryDecoded = page.code === '00000' && decodeQueryResponseV1(page.rows[0].response).ok;
    const dataDecoded = page.code === '00000' && decodeQueryDataV1({ kind: 'activityPage', data: page.rows[0].response.data }).ok;
    record('v2 activity response passes envelope and query-data decoders', saved.code === '00000' && queryDecoded && dataDecoded, { writeSQL: saved.code, querySQL: page.code, envelopeDecoder: queryDecoded, queryDataDecoder: dataDecoded });
  } finally { await lab.close(); }
}

const sources = ['supabase/migrations/202610150014_operational_api.sql', 'src/data/supabase/operational-contract.ts', 'tests/review/m2-2a-independent-review.mjs'];
const report = {
  scope: 'Independent protocol and populated-legacy compatibility probes; no hosted connection',
  total: results.length, passed: results.filter(r => r.passed).length,
  failed: results.filter(r => !r.passed).length, results,
  sha256: Object.fromEntries(sources.map(p => [p, createHash('sha256').update(readFileSync(p)).digest('hex')])),
};
writeFileSync(join(out, 'review.json'), JSON.stringify(report, null, 2) + '\n');
process.exitCode = report.failed ? 1 : 0;
