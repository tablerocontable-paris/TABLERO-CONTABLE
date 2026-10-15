// Independent review of R6 preflight ordering. Disposable synthetic PGlite only.
// Sentinels replace fixture functions, never application source or a hosted DB.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { AccountingLab, ids, stages } from '../helpers/accounting-lab.ts';

const index = process.argv.indexOf('--output-dir');
if (index < 0 || !process.argv[index + 1]) throw Error('--output-dir required');
const out = resolve(process.argv[index + 1]);
mkdirSync(out, { recursive: true });
const results = [];
const check = (name, expected, observed) => {
  const row = { name, passed: expected === observed, expected, observed };
  results.push(row);
  console.log(JSON.stringify(row));
};
const lab = new AccountingLab();
const attempt = async (fn, value) => {
  try { await lab.rows(`select api.${fn}($1::jsonb)`, [JSON.stringify(value)]); return '00000'; }
  catch (error) { return error.code ?? 'unknown'; }
};
try {
  await lab.init(stages.m014);
  const task = await lab.task({ kind: 'operativa' });
  const key = `task:${task}`;
  const rateKey = `rate:${ids.company}:task:${task}`;
  const assessmentKey = `assessment:${task}`;
  const record = revision => ({ contractVersion: 1, operationId: lab.next(), kind: 'operation.record', expectedRevisions: { [key]: revision }, payload: { taskId: task, workDate: lab.day, quantity: 1, reference: null } });
  const rate = revision => ({ contractVersion: 1, operationId: lab.next(), kind: 'operation.rate', expectedRevisions: { [rateKey]: revision }, payload: { companyId: ids.company, templateId: null, taskId: task, effectiveOn: lab.day, unitWeight: '2', reason: 'Review preflight' } });
  const assess = (revision, assessmentRevision) => ({ contractVersion: 1, operationId: lab.next(), kind: 'operation.assess', expectedRevisions: { [key]: revision, [assessmentKey]: assessmentRevision }, payload: { taskId: task, quality: 90, order: 90, timeliness: 90, observation: 'Review preflight' } });
  const query = (kind, cursor = null, limit = 1) => ({ contractVersion: 1, kind, filters: { taskId: task }, cursor, limit });

  await lab.admin();
  const helper = await lab.first(`select
    app_private.api_exact_keys('{"a":1,"b":2}'::jsonb,array['a',null]::text[]) null_member,
    app_private.api_exact_keys('{"a":1,"b":2}'::jsonb,array['a','a']::text[]) duplicate_member,
    app_private.api_exact_keys('{}'::jsonb,null::text[]) null_set`);
  check('invalid expected-key set with NULL member must be rejected', false, helper.null_member);
  check('duplicate expected keys must be rejected', false, helper.duplicate_member);
  check('SQL NULL expected-key set must be rejected', false, helper.null_set);

  await lab.actor(ids.owner, 'aal1', 'authenticated');
  const initialRecord = record('0');
  check('valid initial record succeeds before replay probe', '00000', await attempt('command_v1', initialRecord));
  const malformedReplay = { ...initialRecord, expectedRevisions: { [key]: null } };
  check('invalid revision remains a protocol error when operation ID exists', '22023', await attempt('command_v1', malformedReplay));
  await lab.admin();

  const receiptDefinition = (await lab.first("select pg_get_functiondef('public._coordination_receipt_lock(uuid,uuid)'::regprocedure) definition")).definition;
  await lab.db.exec(`create or replace function public._coordination_receipt_lock(p_actor uuid,p_operation uuid) returns void
    language plpgsql security definer set search_path='' as $$begin raise exception using errcode='PZ001',message='Review receipt-lock sentinel'; end$$`);
  await lab.actor(ids.owner, 'aal1', 'authenticated');
  check('valid command reaches receipt-lock sentinel (positive control)', 'PZ001', await attempt('command_v1', record('0')));
  check('record NULL revision rejected before receipt lock', '22023', await attempt('command_v1', record(null)));
  check('record numeric revision rejected before receipt lock', '22023', await attempt('command_v1', record(0)));
  check('record overflow revision rejected before receipt lock', '22023', await attempt('command_v1', record('9223372036854775808')));
  const emptyRecord = record('0'); emptyRecord.expectedRevisions = {};
  check('empty revision map rejected before receipt lock', '22023', await attempt('command_v1', emptyRecord));
  await lab.actor(ids.boss, 'aal2', 'authenticated');
  check('rate NULL revision rejected before receipt lock', '22023', await attempt('command_v1', rate(null)));
  check('assessment NULL task revision rejected before receipt lock', '22023', await attempt('command_v1', assess(null, '0')));
  check('assessment NULL assessment revision rejected before receipt lock', '22023', await attempt('command_v1', assess('0', null)));
  await lab.admin(); await lab.db.exec(receiptDefinition);

  const scopeDefinition = (await lab.first("select pg_get_functiondef('app_private.api_lock_task_scope(uuid,uuid,uuid)'::regprocedure) definition")).definition;
  await lab.db.exec(`create or replace function app_private.api_lock_task_scope(p_actor uuid,p_organization uuid,p_task uuid) returns void
    language plpgsql security definer set search_path='' as $$begin raise exception using errcode='PZ002',message='Review task-scope-lock sentinel'; end$$`);
  await lab.actor(ids.owner, 'aal1', 'authenticated');
  check('valid query reaches task-scope sentinel (positive control)', 'PZ002', await attempt('query_v1', query('operationalSummary')));
  check('invalid activity cursor rejected before task-scope locks', '22023', await attempt('query_v1', query('activityPage', '!!!', 10)));
  check('non-paginated summary invalid limit rejected before task-scope locks', '22023', await attempt('query_v1', query('operationalSummary', null, 2)));
  check('non-paginated quality invalid cursor rejected before task-scope locks', '22023', await attempt('query_v1', query('quality', 'x')));
  await lab.admin(); await lab.db.exec(scopeDefinition);
  await lab.actor(ids.owner, 'aal1', 'authenticated');
  check('valid query remains available after fixture sentinel restoration', '00000', await attempt('query_v1', query('operationalSummary')));
} finally { await lab.close(); }
const files = ['supabase/migrations/202610150014_operational_api.sql','tests/review/m2-2a-r6-preflight-review.mjs'];
const report = { scope: 'Independent R6 preflight review; fixture sentinels and synthetic PGlite only', total: results.length, passed: results.filter(x => x.passed).length, failed: results.filter(x => !x.passed).length, results, sha256: Object.fromEntries(files.map(path => [path,createHash('sha256').update(readFileSync(path)).digest('hex')])) };
writeFileSync(join(out, 'review.json'), JSON.stringify(report,null,2) + '\n');
process.exitCode = report.failed ? 1 : 0;
