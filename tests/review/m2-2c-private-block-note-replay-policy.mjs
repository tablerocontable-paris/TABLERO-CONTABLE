// Focused native PostgreSQL policy review for private block note receipts.
// Uses only a disposable local cluster and synthetic identities/data.
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, item, index, all) => index % 2 ? pairs : [...pairs, [item, all[index + 1]]], []));
const baselineMode = args['--baseline-mode'] === 'true';
for (const required of ['--pg-bin', '--output-dir', '--port']) if (!args[required]) throw new Error(`Missing ${required}`);
const root = resolve(import.meta.dirname, '../..');
const bin = resolve(args['--pg-bin']);
const out = resolve(args['--output-dir']);
const port = String(args['--port']);
const cluster = join(out, 'cluster');
const exe = name => join(bin, process.platform === 'win32' ? `${name}.exe` : name);
const native = (name, parameters) => execFileSync(exe(name), parameters, { encoding: 'utf8', windowsHide: true });
const control = parameters => execFileSync(exe('pg_ctl'), parameters, { windowsHide: true, stdio: 'ignore' });
const hash = data => createHash('sha256').update(data).digest('hex').toUpperCase();
const shaFile = file => hash(readFileSync(file));
const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const lit = value => `'${String(value).replaceAll("'", "''")}'`;
mkdirSync(out, { recursive: true });

class Session {
  constructor() {
    this.process = spawn(exe('psql'), ['-X', '-q', '-t', '-A', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', 'postgres'], {
      windowsHide: true,
      env: { ...process.env, PGCLIENTENCODING: 'UTF8' },
    });
    this.stdout = '';
    this.stderr = '';
    this.pending = null;
    this.sequence = 0;
    this.process.stdout.setEncoding('utf8');
    this.process.stderr.setEncoding('utf8');
    this.process.stdout.on('data', chunk => { this.stdout += chunk; this.flush(); });
    this.process.stderr.on('data', chunk => { this.stderr += chunk; });
    this.process.on('error', error => this.pending?.reject(error));
    this.process.on('exit', code => this.pending?.reject(new Error(`psql exited ${code}: ${this.stderr}`)));
  }
  flush() {
    if (!this.pending) return;
    const { marker, resolve: finish } = this.pending;
    const start = this.stdout.indexOf(`${marker} `);
    if (start < 0) return;
    const end = this.stdout.indexOf('\n', start);
    if (end < 0) return;
    const lines = this.stdout.slice(0, start).trim().split(/\r?\n/u).filter(Boolean);
    const errors = this.stderr;
    this.stdout = this.stdout.slice(end + 1);
    this.stderr = '';
    this.pending = null;
    finish({ lines, errors, code: errors.match(/ERROR:\s+([0-9A-Z]{5}):/u)?.[1] ?? '00000' });
  }
  query(sql) {
    return new Promise((resolvePromise, reject) => {
      if (this.pending) return reject(new Error('query pending'));
      const marker = `__private_note_${++this.sequence}__`;
      this.pending = { marker, resolve: resolvePromise, reject };
      this.process.stdin.write(`${sql}\nselect '${marker}'||' done';\n`);
    });
  }
  async ok(sql) {
    const result = await this.query(sql);
    if (result.code !== '00000') throw new Error(`${result.code}: ${result.errors}\n${sql}`);
    return result.lines;
  }
  async close() {
    this.process.stdin.end('\\q\n');
    if (this.process.exitCode === null) await new Promise(done => this.process.once('exit', done));
  }
}

const sessions = [];
let clusterStarted = false;
const report = {
  result: 'RUNNING',
  executionMode: baselineMode ? 'exact-baseline-reproduction' : 'candidate-policy-validation',
  baselineCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(),
  originMainCommit: execFileSync('git', ['rev-parse', 'origin/main'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(),
  postgresVersion: native('postgres', ['--version']).trim(),
  sql014Path: join(root, 'supabase/migrations/202610150014_operational_api.sql'),
  sql014Sha256: shaFile(join(root, 'supabase/migrations/202610150014_operational_api.sql')),
  runnerPath: resolve(import.meta.filename),
  runnerSha256: shaFile(resolve(import.meta.filename)),
  schema: 'SQL001-014 applied in order to a fresh disposable local cluster; no hosted database access',
  snapshotScope: 'all base tables in public and app_private, with rows sorted by JSONB text',
  expectedPolicy: 'A cached ACK is returned only to the same active actor in the receipt organization with a currently allowed role (empleado, encargado, jefe); a different actor never receives the author receipt.',
  cases: [],
  limitations: [],
};

const recordFile = () => writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
const auth = async (session, actor, aal = 'aal1') => session.ok(`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({ role: 'authenticated', sub: actor, aal }))},false);set role authenticated;`);

try {
  const init = native('initdb', ['-D', cluster, '-A', 'trust', '-U', 'postgres', '--encoding=UTF8', '--no-locale']);
  writeFileSync(join(out, 'initdb.log'), init);
  control(['-D', cluster, '-l', join(out, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  clusterStarted = true;
  const setup = new Session(); sessions.push(setup);
  const writer = new Session(); sessions.push(writer);
  const replay = new Session(); sessions.push(replay);
  const observer = new Session(); sessions.push(observer);
  const watcher = new Session(); sessions.push(watcher);
  for (const session of sessions) await session.ok("\\set VERBOSITY verbose\n\\set ON_ERROR_ROLLBACK on\nset statement_timeout='20s';");
  await setup.ok(`create role anon;create role authenticated;create role service_role;
    create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`);
  const migrations = readdirSync(join(root, 'supabase/migrations')).filter(file => file.endsWith('.sql')).sort();
  for (const file of migrations) {
    const migration = readFileSync(join(root, 'supabase/migrations', file), 'utf8');
    await setup.ok(migration);
  }
  await observer.ok(`create function pg_temp.snapshot_all() returns jsonb language plpgsql as $$
    declare t record; data jsonb; result jsonb:='{}'::jsonb;
    begin
      for t in select schemaname,tablename from pg_catalog.pg_tables where schemaname in ('public','app_private') order by schemaname,tablename loop
        execute format('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text), ''[]''::jsonb) from %I.%I x',t.schemaname,t.tablename) into data;
        result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,data);
      end loop;
      return result;
    end $$;`);
  const snapshot = async () => JSON.parse((await observer.ok('select pg_temp.snapshot_all()::text;')).at(-1));
  const org = uid(700001), org2 = uid(700002), company = uid(700003), company2 = uid(700004), team = uid(700005), boss = uid(700006);
  const seedBase = async (actor, assignment, task, noteOp, role = 'empleado') => {
    await observer.ok(`insert into public.organizations(id,name) values(${lit(org)},'Private note synthetic'),(${lit(org2)},'Private note second synthetic') on conflict(id) do nothing;
      insert into auth.users(id) values(${lit(boss)}),(${lit(actor)}) on conflict(id) do nothing;
      insert into public.profiles(id,organization_id,name,role,sector,branch,position,manager_id)
        values(${lit(boss)},${lit(org)},'Synthetic boss','jefe','Test','Test','Jefe',null),
              (${lit(actor)},${lit(org)},'Synthetic author',${lit(role)},'Test','Test','Empleado',${lit(boss)}) on conflict(id) do nothing;
      insert into public.companies(id,organization_id,name) values(${lit(company)},${lit(org)},'Synthetic company'),(${lit(company2)},${lit(org2)},'Second synthetic company') on conflict(id) do nothing;
      insert into public.teams(id,organization_id,name,manager_id) values(${lit(team)},${lit(org)},'Synthetic team',${lit(boss)}) on conflict(id) do nothing;
      insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(actor)}) on conflict(team_id,profile_id) do nothing;
      insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(actor)}),(${lit(org)},${lit(company)},${lit(boss)}) on conflict(company_id,profile_id) do nothing;
      insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day,checklist)
        values(${lit(assignment)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'Synthetic private note','resultado',1,'mensual','2026-10-01',15,'[]');
      insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,status,checklist)
        values(${lit(task)},${lit(org)},${lit(assignment)},${lit(company)},${lit(actor)},${lit(team)},'2026-10-01',current_date,'Synthetic private note','resultado',1,'Pendiente','[]');`);
    const body = 'nota privada sintética';
    const call = `select public.save_private_block_note(${lit(task)},${lit(body)},0,${lit(noteOp)})::text;`;
    await auth(setup, actor);
    const before = await snapshot();
    const first = await setup.query(call);
    if (first.code !== '00000') throw new Error(`first private note write ${first.code}: ${first.errors}`);
    const firstResult = JSON.parse(first.lines.at(-1));
    const after = await snapshot();
    const replayBefore = await snapshot();
    const exactReplay = await setup.query(`select public.save_private_block_note(${lit(task)},${lit(body)},0,${lit(noteOp)})::text;`);
    const replayAfter = await snapshot();
    if (exactReplay.code !== '00000') throw new Error(`authorized exact replay ${exactReplay.code}: ${exactReplay.errors}`);
    const replayResult = JSON.parse(exactReplay.lines.at(-1));
    if (JSON.stringify(replayResult) !== JSON.stringify(firstResult) || Object.keys(replayResult).sort().join(',') !== 'cleared,note_id,revision') throw new Error(`unexpected ACK shape: ${JSON.stringify(replayResult)}`);
    if (JSON.stringify(replayAfter) !== JSON.stringify(replayBefore)) throw new Error('authorized exact replay changed full database snapshot');
    report.cases.push({ kind: 'authorized-own-ACK', actor, task, operationId: noteOp, firstSqlstate: first.code, replaySqlstate: exactReplay.code, firstResult, replayResult, beforeFirst: before, afterFirst: after, beforeReplay: replayBefore, afterReplay: replayAfter, passed: true });
    const beforeChangedArguments = await snapshot();
    const changedArguments = await setup.query(`select public.save_private_block_note(${lit(task)},${lit('altered body')},0,${lit(noteOp)})::text;`);
    const afterChangedArguments = await snapshot();
    if (changedArguments.code !== 'P0001' || !changedArguments.errors.includes('La operación ya fue usada con otros argumentos') || JSON.stringify(afterChangedArguments) !== JSON.stringify(beforeChangedArguments)) throw new Error(`changed-argument receipt behavior differed: ${JSON.stringify(changedArguments)}`);
    report.cases.push({ kind: 'same-actor-changed-arguments-denied', actor, task, operationId: noteOp, sqlstate: changedArguments.code, errors: changedArguments.errors, before: beforeChangedArguments, after: afterChangedArguments, passed: true });
    return { actor, assignment, task, operationId: noteOp, body };
  };
  const waitForBlock = async (readerPid, writerPid) => {
    const deadline = Date.now() + 12000;
    let state = null;
    while (Date.now() < deadline) {
      state = JSON.parse((await watcher.ok(`select coalesce(json_build_object('pid',pid,'waitEventType',wait_event_type,'waitEvent',wait_event,'blockers',pg_blocking_pids(pid)),'{}'::json)::text from pg_stat_activity where pid=${Number(readerPid)};`)).at(-1));
      if (state.waitEventType === 'Lock' && state.blockers.includes(Number(writerPid))) return state;
      await new Promise(done => setTimeout(done, 20));
    }
    throw new Error(`No real receipt-lock barrier: ${JSON.stringify(state)}`);
  };
  let serial = 710000;
  for (const mutation of ['inactive', 'allowed-role', 'unauthorized-role']) for (const isolation of ['read committed', 'repeatable read']) {
    const actor = uid(++serial), assignment = uid(++serial), task = uid(++serial), operationId = uid(++serial);
    const seed = await seedBase(actor, assignment, task, operationId);
    const beforeMutation = await snapshot();
    const writerPid = Number((await writer.ok("reset role;begin;select pg_backend_pid();")).at(-1));
    await writer.ok(`select pg_advisory_xact_lock(1101,hashtext(${lit(`${actor}:${operationId}`)}));`);
    const changed = mutation === 'inactive'
      ? await writer.query(`update public.profiles set active=false where id=${lit(actor)};`)
      : await writer.query(`update public.profiles set role=${lit(mutation === 'allowed-role' ? 'encargado' : 'auditor')} where id=${lit(actor)};`);
    if (changed.code !== '00000') throw new Error(`profile mutation ${mutation} failed: ${changed.code} ${changed.errors}`);
    const writerVisibleState = (await writer.ok(`select json_build_object('active',active,'role',role,'organization',organization_id)::text from public.profiles where id=${lit(actor)};`)).at(-1);
    const snapshotWhileUncommitted = await snapshot();
    if (JSON.stringify(snapshotWhileUncommitted) !== JSON.stringify(beforeMutation)) throw new Error('observer saw uncommitted profile mutation');
    await auth(replay, actor);
    await replay.ok(`begin isolation level ${isolation};`);
    const replayPid = Number((await replay.ok('select pg_backend_pid();')).at(-1));
    const call = `select public.save_private_block_note(${lit(task)},${lit(seed.body)},0,${lit(operationId)})::text;`;
    const pending = replay.query(call);
    const blocker = await waitForBlock(replayPid, writerPid);
    await writer.ok('commit;');
    const afterMutation = await snapshot();
    const response = await pending;
    await replay.ok('rollback;');
    const afterReplay = await snapshot();
    const retryBefore = await snapshot();
    const retryResponse = await replay.query(call);
    const retryAfter = await snapshot();
    const allowedAfterMutation = mutation === 'allowed-role';
    const replayedAck = response.code === '00000' || retryResponse.code === '00000';
    const policyViolation = !allowedAfterMutation && replayedAck;
    const stateUnchangedByReplay = JSON.stringify(afterReplay) === JSON.stringify(afterMutation);
    const stateUnchangedByRetry = JSON.stringify(retryAfter) === JSON.stringify(retryBefore);
    const acceptableResponse = baselineMode
      ? response.code === (isolation === 'repeatable read' ? '00000' : (allowedAfterMutation ? '00000' : 'P0001'))
      : response.code === (isolation === 'repeatable read' ? '40001' : (allowedAfterMutation ? '00000' : 'P0001'));
    const acceptableRetry = retryResponse.code === (allowedAfterMutation ? '00000' : 'P0001');
    report.cases.push({
      kind: 'profile-mutation-vs-exact-replay', mutation, isolation, actor, task, operationId,
      beforeMutation, snapshotWhileWriterUncommitted: snapshotWhileUncommitted, writerVisibleState,
      blocker, writerCommitSqlstate: '00000', afterMutation, replaySqlstate: response.code,
      replayErrors: response.errors, replayResult: response.lines.at(-1) ?? null, afterReplay,
      retryAfterFreshSnapshot: { before: retryBefore, sqlstate: retryResponse.code, errors: retryResponse.errors, result: retryResponse.lines.at(-1) ?? null, after: retryAfter },
      expected: allowedAfterMutation ? 'permitted-role replay returns own ACK after retry' : 'inactive/unauthorized role never returns ACK; stale RR may require fresh retry',
      policyViolation, stateUnchangedByReplay, stateUnchangedByRetry,
      passedHarness: blocker.waitEventType === 'Lock' && blocker.blockers.includes(writerPid) && stateUnchangedByReplay && stateUnchangedByRetry && acceptableResponse && acceptableRetry,
    });
    await replay.ok('rollback;');
    await writer.ok('reset role;');
  }

  // An exact own receipt remains an inert ACK after month closure.
  const closeActor = uid(++serial), closeAssignment = uid(++serial), closeTask = uid(++serial), closeOp = uid(++serial);
  const closeSeed = await seedBase(closeActor, closeAssignment, closeTask, closeOp);
  await observer.ok(`insert into public.monthly_closures(organization_id,owner_id,period,snapshot,closed_by,note)
    values(${lit(org)},${lit(closeActor)},'2026-10-01','{}'::jsonb,${lit(boss)},'synthetic replay policy');`);
  const closedBefore = await snapshot();
  await auth(replay, closeActor);
  const afterClosureReplay = await replay.query(`select public.save_private_block_note(${lit(closeTask)},${lit(closeSeed.body)},0,${lit(closeOp)})::text;`);
  const closedAfter = await snapshot();
  report.cases.push({ kind: 'authorized-own-ack-after-month-close', actor: closeActor, task: closeTask, operationId: closeOp,
    sqlstate: afterClosureReplay.code, result: afterClosureReplay.lines.at(-1) ?? null, before: closedBefore, after: closedAfter,
    snapshotUnchanged: JSON.stringify(closedBefore) === JSON.stringify(closedAfter),
    passedHarness: afterClosureReplay.code === '00000' && JSON.stringify(closedBefore) === JSON.stringify(closedAfter) });

  // A replacement author can replay their own ACK after the approved coverage is cancelled.
  const coveredActor = uid(++serial), coveredOwner = uid(++serial), coveredAssignment = uid(++serial), coveredTask = uid(++serial);
  const coveredOperation = uid(++serial), absenceOperation = uid(++serial);
  const coveredBody = 'nota privada bajo cobertura';
  const period = (await observer.ok("select date_trunc('month',current_date)::date::text;")).at(-1);
  await observer.ok(`insert into auth.users(id) values(${lit(coveredActor)}),(${lit(coveredOwner)}) on conflict(id) do nothing;
    insert into public.profiles(id,organization_id,name,role,sector,branch,position,manager_id)
      values(${lit(coveredActor)},${lit(org)},'Synthetic covered author','empleado','Test','Test','Empleado',${lit(boss)}),
            (${lit(coveredOwner)},${lit(org)},'Synthetic covered owner','empleado','Test','Test','Empleado',${lit(boss)});
    insert into public.company_memberships(organization_id,company_id,profile_id)
      values(${lit(org)},${lit(company)},${lit(coveredActor)}),(${lit(org)},${lit(company)},${lit(coveredOwner)})
      on conflict(company_id,profile_id) do nothing;
    insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(coveredOwner)}) on conflict(team_id,profile_id) do nothing;
    insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day,checklist)
      values(${lit(coveredAssignment)},${lit(org)},${lit(company)},${lit(coveredOwner)},${lit(team)},'Synthetic covered note','resultado',1,'mensual',${lit(period)},15,'[]');
    insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,status,checklist)
      values(${lit(coveredTask)},${lit(org)},${lit(coveredAssignment)},${lit(company)},${lit(coveredOwner)},${lit(team)},${lit(period)},current_date,'Synthetic covered note','resultado',1,'Pendiente','[]');`);
  await auth(setup, boss, 'aal2');
  const approval = await setup.query(`select public.approve_employee_absence(${lit(coveredOwner)},${lit(coveredActor)},'licencia',current_date-1,current_date+1,array[${lit(company)}]::uuid[],'synthetic coverage',${lit(absenceOperation)})::text;`);
  if (approval.code !== '00000') throw new Error(`coverage approval failed ${approval.code}: ${approval.errors}`);
  const absenceId = approval.lines.at(-1);
  await auth(replay, coveredActor);
  const coverageBeforeWrite = await snapshot();
  const coveredWrite = await replay.query(`select public.save_private_block_note(${lit(coveredTask)},${lit(coveredBody)},0,${lit(coveredOperation)})::text;`);
  if (coveredWrite.code !== '00000') throw new Error(`covered private-note write failed ${coveredWrite.code}: ${coveredWrite.errors}`);
  const coverageAfterWrite = await snapshot();
  await auth(setup, boss, 'aal2');
  const cancelCoverage = await setup.query(`select public.cancel_employee_absence(${lit(absenceId)},'synthetic coverage ended',${lit(uid(++serial))})::text;`);
  if (cancelCoverage.code !== '00000') throw new Error(`coverage cancellation failed ${cancelCoverage.code}: ${cancelCoverage.errors}`);
  const coverageAfterCancellation = await snapshot();
  await auth(replay, coveredActor);
  const replayAfterCoverage = await replay.query(`select public.save_private_block_note(${lit(coveredTask)},${lit(coveredBody)},0,${lit(coveredOperation)})::text;`);
  const coverageAfterReplay = await snapshot();
  report.cases.push({ kind: 'authorized-own-ack-after-coverage-cancellation', actor: coveredActor, owner: coveredOwner, task: coveredTask,
    operationId: coveredOperation, absenceId, firstWriteSqlstate: coveredWrite.code, cancellationSqlstate: cancelCoverage.code,
    replaySqlstate: replayAfterCoverage.code, replayResult: replayAfterCoverage.lines.at(-1) ?? null,
    beforeFirstWrite: coverageBeforeWrite, afterFirstWrite: coverageAfterWrite,
    afterCoverageCancellation: coverageAfterCancellation, afterReplay: coverageAfterReplay,
    replaySnapshotUnchanged: JSON.stringify(coverageAfterCancellation) === JSON.stringify(coverageAfterReplay),
    limitation: 'Native fixture cancels the approved coverage after its valid first write; this verifies own receipt access after coverage is no longer active, not clock-driven end-date passage.',
    passedHarness: coveredWrite.code === '00000' && cancelCoverage.code === '00000' && replayAfterCoverage.code === '00000'
      && JSON.stringify(coverageAfterCancellation) === JSON.stringify(coverageAfterReplay) });

  // A cross-organization identity with the same operation UUID must not receive the author's ACK.
  const crossActor = uid(++serial), crossAssignment = uid(++serial), crossTask = uid(++serial), crossOp = uid(++serial);
  const own = await seedBase(crossActor, crossAssignment, crossTask, crossOp);
  const beforeCrossOrg = await snapshot();
  const orgMove = await observer.query(`update public.profiles set organization_id=${lit(org2)} where id=${lit(crossActor)};`);
  const afterRejectedOrgMove = await snapshot();
  const foreignActor = uid(++serial);
  await observer.ok(`insert into auth.users(id) values(${lit(foreignActor)});
    insert into public.profiles(id,organization_id,name,role,sector,branch,position) values(${lit(foreignActor)},${lit(org2)},'Cross-org actor','jefe','Test','Test','Jefe');`);
  await auth(replay, foreignActor);
  const foreignBefore = await snapshot();
  const foreign = await replay.query(`select public.save_private_block_note(${lit(own.task)},${lit(own.body)},0,${lit(own.operationId)})::text;`);
  const foreignAfter = await snapshot();
  report.cases.push({ kind: 'author-organization-change-fk-boundary', author: crossActor, attemptedOrganization: org2, sqlstate: orgMove.code, errors: orgMove.errors, snapshotBefore: beforeCrossOrg, snapshotAfter: afterRejectedOrgMove, policy: 'The author cannot move organizations while composite task/note/receipt foreign keys preserve the historical organization; no fixture constraints were dropped.', passedHarness: orgMove.code === '23503' && JSON.stringify(beforeCrossOrg) === JSON.stringify(afterRejectedOrgMove) });
  report.cases.push({ kind: 'cross-organization-actor-cannot-receive-authors-ack', author: crossActor, foreignActor, operationId: own.operationId, sqlstate: foreign.code, errors: foreign.errors, before: foreignBefore, after: foreignAfter, passedHarness: foreign.code !== '00000' && JSON.stringify(foreignBefore) === JSON.stringify(foreignAfter) });

  // A different actor in the same organization can access the task but cannot read the author's receipt.
  const bossReplayBefore = await snapshot();
  await auth(replay, boss);
  const otherAuthor = await replay.query(`select public.save_private_block_note(${lit(own.task)},${lit(own.body)},1,${lit(own.operationId)})::text;`);
  const bossReplayAfter = await snapshot();
  report.cases.push({ kind: 'same-organization-other-actor-cannot-receive-ack', author: crossActor, otherActor: boss, operationId: own.operationId, sqlstate: otherAuthor.code, errors: otherAuthor.errors, before: bossReplayBefore, after: bossReplayAfter, passedHarness: otherAuthor.code !== '00000' && JSON.stringify(bossReplayBefore) === JSON.stringify(bossReplayAfter) });

  const raceCases = report.cases.filter(item => item.kind === 'profile-mutation-vs-exact-replay');
  const anyViolation = raceCases.some(item => item.policyViolation);
  const allRealBarriers = raceCases.every(item => item.passedHarness);
  report.result = anyViolation ? 'RED_CONFIRMED_PRIVATE_NOTE_REPLAY_POLICY_GAP' : 'GREEN_PRIVATE_NOTE_REPLAY_POLICY';
  report.summary = { raceCases: raceCases.length, cases: report.cases.length, realBarriers: allRealBarriers,
    policyViolations: raceCases.filter(item => item.policyViolation).map(item => `${item.mutation}/${item.isolation}`),
    acceptedRoleChanges: raceCases.filter(item => item.mutation === 'allowed-role').map(item => `${item.isolation}/${item.replaySqlstate}/${item.retryAfterFreshSnapshot.sqlstate}`),
    closureReplay: report.cases.find(item => item.kind === 'authorized-own-ack-after-month-close')?.passedHarness,
    orgMoveSqlstate: orgMove.code };
  if (!allRealBarriers || report.cases.some(item => item.passedHarness === false)) throw new Error('Runner assertion failed; see partial report');
  recordFile();
} catch (error) {
  report.result = 'HARNESS_ERROR';
  report.error = String(error.stack ?? error);
  recordFile();
  console.error(error);
  process.exitCode = 2;
} finally {
  for (const session of sessions) if (session.process.exitCode === null) await session.close();
  if (clusterStarted) control(['-D', cluster, '-m', 'fast', '-w', 'stop']);
}
