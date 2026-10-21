// Gate L residual native PostgreSQL races. Synthetic records only; loopback DB.
// This runner deliberately does not edit, patch, or apply hosted SQL.
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';

const flags = Object.fromEntries(process.argv.slice(2).reduce((out, x, i, a) => i % 2 ? out : [...out, [x, a[i + 1]]], []));
for (const key of ['--pg-bin', '--output-dir', '--port']) if (!flags[key]) throw new Error(`Missing ${key}`);
const root = resolve(import.meta.dirname, '../..'), bin = resolve(flags['--pg-bin']), out = resolve(flags['--output-dir']);
const port = String(flags['--port']), cluster = join(out, 'cluster');
const exe = n => join(bin, process.platform === 'win32' ? `${n}.exe` : n);
const native = (n, args) => execFileSync(exe(n), args, { encoding: 'utf8', windowsHide: true });
const ctl = args => execFileSync(exe('pg_ctl'), args, { windowsHide: true, stdio: 'ignore' });
const hash = b => createHash('sha256').update(b).digest('hex').toUpperCase();
const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const lit = x => `'${String(x).replaceAll("'", "''")}'`;
mkdirSync(out, { recursive: true });

class Session {
  constructor() {
    this.proc = spawn(exe('psql'), ['-X','-q','-t','-A','-h','127.0.0.1','-p',port,'-U','postgres','-d','postgres'], { windowsHide: true, env: { ...process.env, PGCLIENTENCODING: 'UTF8' } });
    this.stdout = ''; this.stderr = ''; this.pending = null; this.seq = 0;
    this.proc.stdout.setEncoding('utf8'); this.proc.stderr.setEncoding('utf8');
    this.proc.stdout.on('data', x => { this.stdout += x; this.flush(); });
    this.proc.stderr.on('data', x => { this.stderr += x; });
    this.proc.on('error', e => this.pending?.reject(e));
    this.proc.on('exit', c => this.pending?.reject(new Error(`psql exited ${c}: ${this.stderr}`)));
  }
  flush() {
    if (!this.pending) return;
    const { marker, resolve: done } = this.pending, at = this.stdout.indexOf(`${marker} `);
    if (at < 0) return;
    const end = this.stdout.indexOf('\n', at); if (end < 0) return;
    const lines = this.stdout.slice(0, at).trim().split(/\r?\n/u).filter(Boolean), errors = this.stderr;
    this.stdout = this.stdout.slice(end + 1); this.stderr = ''; this.pending = null;
    done({ lines, errors, code: errors.match(/ERROR:\s+([0-9A-Z]{5}):/u)?.[1] ?? '00000' });
  }
  query(sql) {
    return new Promise((ok, no) => {
      if (this.pending) return no(new Error('query already pending'));
      const marker = `__gatel_${++this.seq}__`; this.pending = { marker, resolve: ok, reject: no };
      this.proc.stdin.write(`${sql}\nselect '${marker}'||' done';\n`);
    });
  }
  async ok(sql) { const r = await this.query(sql); if (r.code !== '00000') throw new Error(`${r.code}: ${r.errors}\n${sql}`); return r.lines; }
  async close() { if (this.proc.exitCode === null) { this.proc.stdin.write('\\q\n'); this.proc.stdin.end(); await new Promise(done => this.proc.once('exit', done)); } }
}

const sessions = []; let clusterStarted = false;
const report = {
  result: 'RUNNING', scope: '12 Gate L residual races only',
  baseline: execFileSync('git', ['rev-parse','HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(),
  originMain: execFileSync('git', ['rev-parse','origin/main'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(),
  sql014Sha256: hash(readFileSync(join(root,'supabase/migrations/202610150014_operational_api.sql'))),
  commandLine: process.argv,
  runner: resolve(import.meta.filename), runnerSha256: hash(readFileSync(import.meta.filename)),
  postgresVersion: native('postgres',['--version']).trim(), snapshotScope: 'all 57 public/app_private base tables', cases: [], deadlocks: [],
};
const persist = () => {
  const reportBytes=JSON.stringify(report,null,2); writeFileSync(join(out,'report.json'),reportBytes);
  const manifest={format:'m2-2c-gatel-residual-races-v1',result:report.result,runnerPath:resolve(import.meta.filename),runnerSha256:hash(readFileSync(import.meta.filename)),sql014Sha256:report.sql014Sha256,postgresVersion:report.postgresVersion,reportPath:join(out,'report.json'),reportSha256:hash(reportBytes),caseCount:report.cases.length,caseNames:report.cases.map(x=>x.name),deadlocks:report.deadlocks,generatedAt:new Date().toISOString(),scope:'synthetic local PostgreSQL only; no hosted calls'};
  writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2));
};
const authSql = (actor, role, aal='aal2') => `reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({role:'authenticated',sub:actor,aal}))},false);set role authenticated;`;
const cmdSql = cmd => `select api.command_v1(${lit(JSON.stringify(cmd))}::jsonb);`;
const waitBlocker = async (observer, pid, expected, ms=12000) => {
  const until = Date.now()+ms;
  while(Date.now()<until){
    const row=JSON.parse((await observer.ok(`select jsonb_build_object('pid',pid,'waitEventType',wait_event_type,'waitEvent',wait_event,'blockers',pg_blocking_pids(pid))::text from pg_stat_activity where pid=${Number(pid)};`)).at(-1));
    if(row.blockers?.length) return row;
    await new Promise(r=>setTimeout(r,25));
  }
  return null;
};

try {
  writeFileSync(join(out,'initdb.log'), native('initdb',['-D',cluster,'-A','trust','-U','postgres','--encoding=UTF8','--no-locale']));
  ctl(['-D',cluster,'-l',join(out,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']); clusterStarted=true;
  const setup=new Session(), observer=new Session(), first=new Session(), second=new Session(); sessions.push(setup,observer,first,second);
  for(const s of sessions) await s.ok("\\set VERBOSITY verbose\n\\set ON_ERROR_ROLLBACK on\nset statement_timeout='20s';");
  await setup.ok(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid(),auth.jwt() to authenticated;`);
  for(const f of readdirSync(join(root,'supabase/migrations')).filter(x=>x.endsWith('.sql')).sort()) await setup.ok(readFileSync(join(root,'supabase/migrations',f),'utf8'));
  const connectionNames=['setup','observer','raceA','raceB']; report.connections={};
  for(let i=0;i<sessions.length;i++) report.connections[connectionNames[i]]=JSON.parse((await sessions[i].ok(`select jsonb_build_object('pid',pg_backend_pid(),'databaseRole',current_user,'sessionUser',session_user,'isolation',current_setting('transaction_isolation'))::text;`)).at(-1));
  await observer.ok(`create function pg_temp.snapshot_all() returns jsonb language plpgsql as $$
    declare t record; rows jsonb; result jsonb:='{}'::jsonb; n int:=0;
    begin for t in select schemaname,tablename from pg_catalog.pg_tables where schemaname in ('public','app_private') order by schemaname,tablename loop
      execute format('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb) from %I.%I x',t.schemaname,t.tablename) into rows;
      result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,rows); n:=n+1; end loop;
      if n<>57 then raise exception 'expected 57 base tables, observed %',n using errcode='22023'; end if; return result; end $$;`);
  const snapshot=async()=>JSON.parse((await observer.ok('select pg_temp.snapshot_all()::text;')).at(-1));
  const changedTables=(a,b)=>Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));
  const assertNoUnexpectedChanges=(a,b,allow,label)=>{
    const changed=changedTables(a,b), unexpected=changed.filter(k=>!allow.has(k));
    assert.deepEqual(unexpected,[],`${label}: unexpected changed tables ${unexpected.join(', ')}`);
    return changed;
  };
  const org=uid(500001), boss=uid(500002), company=uid(500003), team=uid(500004), date='2026-10-21', period='2026-10-01';
  await observer.ok(`insert into public.organizations(id,name) values(${lit(org)},'Gate L residual synthetic');insert into auth.users(id) values(${lit(boss)});
    insert into public.profiles(id,organization_id,name,role,sector,branch,position,active) values(${lit(boss)},${lit(org)},'Gate L jefe','jefe','Test','Test','Jefe',true);
    insert into public.companies(id,organization_id,name) values(${lit(company)},${lit(org)},'Gate L company');
    insert into public.teams(id,organization_id,name,manager_id) values(${lit(team)},${lit(org)},'Gate L team',${lit(boss)});
    insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(boss)});
    insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(boss)});`);
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const context=async(s,actor,aal='aal2')=>{
    await s.ok(authSql(actor,'authenticated',aal));
    const row=JSON.parse((await s.ok(`select jsonb_build_object('pid',pg_backend_pid(),'actor',auth.uid(),'role',auth.jwt()->>'role','aal',auth.jwt()->>'aal','isolation',current_setting('transaction_isolation'),'snapshot',txid_current_snapshot())::text;`)).at(-1));
    return row;
  };
  const trackedBlocker=async(pid,expected)=>{
    const until=Date.now()+12000; let last=null;
    while(Date.now()<until){
      last=JSON.parse((await observer.ok(`select coalesce(jsonb_build_object('pid',pid,'waitEventType',wait_event_type,'waitEvent',wait_event,'blockers',pg_blocking_pids(pid)),'{}'::jsonb)::text from pg_stat_activity where pid=${Number(pid)};`)).at(-1));
      if(last.waitEventType==='Lock' && last.blockers.includes(Number(expected))) return last;
      await delay(25);
    }
    throw new Error(`missing real lock barrier ${pid} <- ${expected}: ${JSON.stringify(last)}`);
  };
  const insertActor=async(id,role='empleado')=>observer.ok(`insert into auth.users(id) values(${lit(id)});
    insert into public.profiles(id,organization_id,name,role,sector,branch,position,manager_id,active) values(${lit(id)},${lit(org)},'Gate L ${id}',${lit(role)},'Test','Test','Synthetic',${lit(boss)},true);
    insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(org)},${lit(company)},${lit(id)});
    insert into public.team_members(organization_id,team_id,profile_id) values(${lit(org)},${lit(team)},${lit(id)});`);
  let seed=510000;
  const mkStandard=async(label)=>{
    const revision=(await observer.ok(`select coalesce((select revision from app_private.api_catalogue_heads where organization_id=${lit(org)}),0);`)).at(-1);
    const op=uid(++seed), cmd={contractVersion:1,operationId:op,kind:'catalogue.create',expectedRevisions:{[`catalogue:${org}`]:revision},payload:{definition:{kind:'operativa',title:label,objective:'',sector:'Test',unit:'documentos'},effectiveOn:date,reason:'Gate L residual fixture'}};
    const r=await (async()=>{await context(first,boss);return first.query(cmdSql(cmd));})(); assert.equal(r.code,'00000',JSON.stringify(r)); return JSON.parse(r.lines.at(-1)).result;
  };
  let standard=await mkStandard('Gate L residual standard');
  const mkRequest=async(owner,line,templateVersionId=standard.versionId)=>{
    await insertActor(owner);
    const draft={schemaVersion:2,lines:[{lineId:line,companyId:company,teamId:team,source:{type:'catalogue',templateVersionId},schedule:{frequency:'mensual',startDate:date,endDate:null,interval:1,weekdays:[],monthDay:21,hasDeadline:true,dueOffsetDays:0}}]};
    const save={contractVersion:1,operationId:uid(++seed),kind:'onboarding.saveDraft',expectedRevisions:{[`onboardingOwner:${owner}`]:'0'},payload:{requestId:null,draft}};
    await context(first,owner,'aal1'); let r=await first.query(cmdSql(save)); assert.equal(r.code,'00000',JSON.stringify(r)); const request=JSON.parse(r.lines.at(-1)).result.requestId;
    const submit={contractVersion:1,operationId:uid(++seed),kind:'onboarding.submit',expectedRevisions:{[`onboarding:${request}`]:'0',[`onboardingDraft:${request}`]:'1'},payload:{requestId:request}};
    r=await first.query(cmdSql(submit)); assert.equal(r.code,'00000',JSON.stringify(r)); return request;
  };
  const mkApproval=(request,op,templateVersion=1,templateId=standard.templateId)=>({contractVersion:1,operationId:op,kind:'onboarding.approve',expectedRevisions:{[`onboarding:${request}`]:'1',[`catalogue:${templateId}`]:String(templateVersion)},payload:{requestId:request,weightOverrides:[],period}});
  const assertNoDeadlock=r=>{for(const x of [r.first,r.second,r.retry]) if(x&&x.code==='40P01') report.deadlocks.push({case:r.name,errors:x.errors}); assert.equal(report.deadlocks.length,0,'deadlock detected');};

  // 1-2: reverse approval winners in RC/RC and RR/RR.
  for(const [iso,winnerIndex] of [['read committed',1],['repeatable read',0]]){
    const owner=uid(++seed), request=await mkRequest(owner,uid(++seed)), chiefs=[uid(++seed),uid(++seed)];
    for(const chiefId of chiefs) await insertActor(chiefId,'jefe');
    const commands=chiefs.map((_,i)=>mkApproval(request,uid(++seed))), winner=winnerIndex, loser=1-winner;
    const before=await snapshot(); const wctx=await context(first,chiefs[winner]); await first.ok(`begin isolation level ${iso};`); const winnerContext=await context(first,chiefs[winner]);
    const firstResult=await first.query(cmdSql(commands[winner])); assert.equal(firstResult.code,'00000',JSON.stringify(firstResult));
    await second.ok(`begin isolation level ${iso};`); const loserContext=await context(second,chiefs[loser]); const pending=second.query(cmdSql(commands[loser]));
    const block=await trackedBlocker(loserContext.pid,winnerContext.pid); await first.ok('commit;'); const winnerOnly=await snapshot(); const secondResult=await pending;
    await second.ok(secondResult.code==='00000'?'commit;':'rollback;'); assert.equal(secondResult.code,'40001',JSON.stringify(secondResult));
    const afterConflict=await snapshot(); assert.deepEqual(afterConflict,winnerOnly,'aborted competing approval must leave winner-only snapshot unchanged');
    await second.ok(`begin isolation level ${iso};`); const retryCtx=await context(second,chiefs[loser]); const retry=await second.query(cmdSql(commands[loser])); await second.ok(retry.code==='00000'?'commit;':'rollback;');
    const final=await snapshot(); assert.equal(final['public.onboarding_requests'].find(x=>x.id===request).status,'approved');
    assert.equal(final['public.onboarding_activations'].filter(x=>x.request_id===request).length,1);
    assert.equal(retry.code,'40001',JSON.stringify(retry),'approved status stale-aborts the competing approval retry');
    const winnerReceipt=final['app_private.api_command_receipts'].find(x=>x.actor_id===chiefs[winner]&&x.operation_id===commands[winner].operationId);
    assert.ok(winnerReceipt,'winner command receipt');
    const winnerEnvelope=JSON.parse(firstResult.lines.at(-1)); assert.deepEqual(winnerEnvelope,winnerReceipt.result,'winner response equals durable receipt');
    const activation=final['public.onboarding_activations'].find(x=>x.request_id===request);
    assert.equal(activation.assignment_id,winnerEnvelope.result.assignmentIds[0],'approval response points to exact assignment');
    assert.equal(final['public.onboarding_reviews'].filter(x=>x.request_id===request&&x.action==='approved').length,1,'one approved review record');
    assert.deepEqual(final['public.task_instances'].filter(x=>x.assignment_id===activation.assignment_id).map(x=>x.id),winnerEnvelope.result.createdTaskIds,'approval response points to exact occurrences');
    assert.equal(final['public.task_assignments'].filter(x=>x.id===activation.assignment_id&&x.owner_id===owner).length,1,'one exact activated assignment');
    assert.equal(final['app_private.api_creation_heads'].filter(x=>x.owner_id===owner).length,1,'one owner creation head');
    assert.equal(final['app_private.api_creation_heads'].find(x=>x.owner_id===owner).revision,1,'owner creation revision increments once');
    assert.equal(final['app_private.api_command_receipts'].filter(x=>x.actor_id===chiefs[loser]&&x.operation_id===commands[loser].operationId).length,0,'loser must not receive approval receipt');
    assert.equal(final['public.audit_events'].filter(x=>x.action==='onboarding.approved'&&x.entity_id===request).length,1,'one approval audit row');
    assert.notEqual(retry.code,'00000','competing approve retry cannot create a second successful approval');
    assert.deepEqual(final,afterConflict,'loser retry must not add receipt, audit, or business writes');
    assertNoDeadlock({name:`approve-approve-${iso}`,first:firstResult,second:secondResult,retry});
    const approvalAllow=new Set(['public.onboarding_requests','public.onboarding_request_versions','public.onboarding_activations','public.onboarding_reviews','public.task_assignments','public.task_instances','public.audit_events','app_private.api_command_receipts','app_private.api_operation_fences','app_private.api_creation_heads','app_private.api_month_fences','app_private.api_onboarding_owner_heads','public.task_responsibility_sets','public.task_responsibility_members','public.task_responsibility_events','public.task_responsibility_heads','app_private.api_membership_fences']);
    const winnerChangedTables=assertNoUnexpectedChanges(before,winnerOnly,approvalAllow,'approve/approve winner');
    report.cases.push({name:`approve-approve reverse winner ${winner===0?'A':'B'} ${iso}`,isolation:iso,actors:{A:chiefs[0],B:chiefs[1]},actorRoles:{A:'jefe',B:'jefe'},aal:'aal2',winner,contexts:{winner:winnerContext,loser:loserContext,retry:retryCtx},blocker:block,first:firstResult,second:secondResult,retry,winnerChangedTables,loserRetryNoWrite:true,fullSnapshots:{before,winnerOnly,afterLoserRollback:afterConflict,final}});
    await second.ok('reset role;');
  }

  // 3-4: revise first, then isolated approval; RC/RC and RR/RR.
  for(const iso of ['read committed','repeatable read']){
    standard=await mkStandard(`Gate L revise/approve ${iso}`);
    const owner=uid(++seed), request=await mkRequest(owner,uid(++seed));
    const approver=uid(++seed); await insertActor(approver,'jefe');
    const head=(await observer.ok(`select revision from app_private.api_catalogue_heads where organization_id=${lit(org)};`)).at(-1);
    const revise={contractVersion:1,operationId:uid(++seed),kind:'catalogue.revise',expectedRevisions:{[`catalogue:${org}`]:head,[`catalogue:${standard.templateId}`]:'1'},payload:{templateId:standard.templateId,definition:{kind:'operativa',title:`Gate L revised ${iso}`,objective:'',sector:'Test',unit:'archivos'},effectiveOn:date,reason:'Gate L revision-first'}};
    const approve=mkApproval(request,uid(++seed)); const before=await snapshot();
    await first.ok(`begin isolation level ${iso};`); const firstContext=await context(first,boss); assert.equal(firstContext.isolation,iso,'catalogue writer transaction must use requested isolation'); const revised=await first.query(cmdSql(revise)); assert.equal(revised.code,'00000',JSON.stringify(revised));
    await second.ok(`begin isolation level ${iso};`); const secondContext=await context(second,approver); assert.equal(secondContext.isolation,iso,'approval transaction must use requested isolation'); const pending=second.query(cmdSql(approve)); const block=await trackedBlocker(secondContext.pid,firstContext.pid);
    await first.ok('commit;'); const winnerOnly=await snapshot(); const stale=await pending; await second.ok(stale.code==='00000'?'commit;':'rollback;'); assert.equal(stale.code,'40001',JSON.stringify(stale));
    const conflict=await snapshot(); assert.deepEqual(conflict,winnerOnly,'stale approval transaction must roll back to revision-only winner'); await second.ok(`begin isolation level ${iso};`); const retryCtx=await context(second,approver); assert.equal(retryCtx.isolation,iso,'approval retry transaction must use requested isolation'); const fresh=await second.query(cmdSql({...approve,expectedRevisions:{[`onboarding:${request}`]:'1',[`catalogue:${standard.templateId}`]:'2'}})); await second.ok(fresh.code==='00000'?'commit;':'rollback;');
    const final=await snapshot();
    const catalogueAllow=new Set(['public.task_templates','public.task_template_versions','app_private.api_catalogue_heads','app_private.api_command_receipts','app_private.api_operation_fences','public.audit_events']);
    const revisionChangedTables=assertNoUnexpectedChanges(before,winnerOnly,catalogueAllow,'catalogue revise winner');
    assert.equal(conflict['public.onboarding_requests'].find(x=>x.id===request).status,'submitted','blocked approval must not change request');
    assert.equal(conflict['public.onboarding_activations'].filter(x=>x.request_id===request).length,0,'blocked approval must not activate');
    assert.equal(conflict['app_private.api_command_receipts'].filter(x=>x.actor_id===approver&&x.operation_id===approve.operationId).length,0,'stale approve must not receipt');
    assert.equal(fresh.code,'40001','updated expected catalog revision cannot authorize immutable submitted v1 source');
    assert.deepEqual(final,conflict,'fresh retry requires resubmission and must not change the approved-request snapshot');
    assert.equal(final['public.onboarding_reviews'].filter(x=>x.request_id===request&&x.action==='approved').length,0,'stale approve writes no approval review');
    assert.equal(final['public.task_assignments'].filter(x=>x.owner_id===owner).length,0,'stale approve writes no assignment');
    assert.equal(final['public.task_instances'].filter(x=>x.owner_id===owner).length,0,'stale approve writes no occurrence');
    assert.equal(final['app_private.api_command_receipts'].filter(x=>x.operation_id===approve.operationId).length,0,'stale approve writes no receipt');
    assertNoDeadlock({name:`revise-approve-${iso}`,first:revised,second:stale,retry:fresh});
    report.cases.push({name:`catalogue revise-first vs approve ${iso}`,isolation:iso,actors:{revision:boss,approval:approver},actorRoles:{revision:'jefe',approval:'jefe'},contexts:{revision:firstContext,approval:secondContext,retry:retryCtx},blocker:block,revision:revised,approval:stale,retry:fresh,retryExpected:'40001; immutable submitted v1 source requires resubmission after catalog v2',revisionChangedTables,fullSnapshots:{before,winnerOnly,afterLoserRollback:conflict,final}});
    await first.ok('reset role;'); await second.ok('reset role;');
  }

  // 5-8: materialization and one-off creation, both winners in RC/RC and RR/RR.
  for(const iso of ['read committed','repeatable read']) for(const winner of ['materialize','oneOff']){
    standard=await mkStandard(`Gate L materialize/one-off ${iso} ${winner}`);
    const owner=uid(++seed); await insertActor(owner);
    const assignment=uid(++seed), templateId=standard.templateId, versionId=standard.versionId;
    await observer.ok(`insert into public.task_assignments(id,organization_id,template_id,template_version_id,company_id,owner_id,team_id,title,kind,weight,unit,target,frequency,start_month,due_day,start_date,month_day,has_deadline,due_offset_days,interval_count,weekdays,checklist)
      values(${lit(assignment)},${lit(org)},${lit(templateId)},${lit(versionId)},${lit(company)},${lit(owner)},${lit(team)},'Gate L recurring ${iso}','operativa',null,'documentos',null,'mensual',${lit(period)},21,${lit(date)},21,true,0,1,array[3]::smallint[],'[]');`);
    const creation=(await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(owner)}),0);`)).at(-1);
    const mat={contractVersion:1,operationId:uid(++seed),kind:'month.materialize',expectedRevisions:{[`creation:${owner}`]:creation},payload:{ownerId:owner,period}};
    const one={contractVersion:1,operationId:uid(++seed),kind:'task.createOneOff',expectedRevisions:{[`creation:${owner}`]:creation,[`catalogue:${templateId}`]:'1'},payload:{ownerId:owner,companyId:company,teamId:team,source:{type:'catalogue',templateVersionId:versionId},scheduledOn:date,dueDate:null,priority:'Media'}};
    const before=await snapshot(), winnerSession=winner==='materialize'?first:second, loserSession=winner==='materialize'?second:first;
    const wactor=winner==='materialize'?boss:owner, lactor=winner==='materialize'?owner:boss;
    await context(winnerSession,wactor,winner==='materialize'?'aal2':'aal1'); await winnerSession.ok(`begin isolation level ${iso};`); const wctx=await context(winnerSession,wactor,winner==='materialize'?'aal2':'aal1');
    const wcmd=winner==='materialize'?mat:one, lcmd=winner==='materialize'?one:mat; const wr=await winnerSession.query(cmdSql(wcmd)); assert.equal(wr.code,'00000',JSON.stringify(wr));
    await context(loserSession,lactor,lactor===boss?'aal2':'aal1'); await loserSession.ok(`begin isolation level ${iso};`); const lctx=await context(loserSession,lactor,lactor===boss?'aal2':'aal1'); const pending=loserSession.query(cmdSql(lcmd)); const block=await trackedBlocker(lctx.pid,wctx.pid);
    await winnerSession.ok('commit;'); const winnerOnly=await snapshot(); const stale=await pending; await loserSession.ok(stale.code==='00000'?'commit;':'rollback;'); assert.equal(stale.code,'40001',JSON.stringify(stale));
    const conflict=await snapshot(); assert.deepEqual(conflict,winnerOnly,'stale competing command must leave winner-only snapshot unchanged'); const rev=(await observer.ok(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(org)} and owner_id=${lit(owner)}),0);`)).at(-1);
    const retryCmd=winner==='materialize'?{...one,expectedRevisions:{[`creation:${owner}`]:rev,[`catalogue:${templateId}`]:'1'}}:{...mat,expectedRevisions:{[`creation:${owner}`]:rev}};
    await loserSession.ok(`begin isolation level ${iso};`); const retryCtx=await context(loserSession,lactor,lactor===boss?'aal2':'aal1'); const retry=await loserSession.query(cmdSql(retryCmd)); await loserSession.ok(retry.code==='00000'?'commit;':'rollback;');
    assert.equal(stale.code,'40001',JSON.stringify(stale)); assert.equal(retry.code,'00000',JSON.stringify(retry));
    const final=await snapshot(); assert.equal(final['public.task_instances'].filter(x=>x.assignment_id===assignment&&x.period===period).length,1,'one recurring occurrence per source');
    assert.equal(final['public.task_assignments'].filter(x=>x.owner_id===owner&&x.frequency==='unica').length,1,'one one-off assignment');
    const oneOffReceipt=final['app_private.api_command_receipts'].find(x=>x.operation_id===one.operationId&&x.actor_id===owner);
    const materializeReceipt=final['app_private.api_command_receipts'].find(x=>x.operation_id===mat.operationId&&x.actor_id===boss);
    assert.ok(oneOffReceipt&&materializeReceipt,'both successful commands need durable receipts');
    const oneOffResponse=JSON.parse((winner==='oneOff'?wr:retry).lines.at(-1));
    const materializeResponse=JSON.parse((winner==='materialize'?wr:retry).lines.at(-1));
    assert.deepEqual(oneOffResponse,oneOffReceipt.result,'one-off response/receipt equality');
    assert.deepEqual(materializeResponse,materializeReceipt.result,'materialize response/receipt equality');
    assert.ok(final['public.task_assignments'].some(x=>x.id===oneOffResponse.result.assignmentId&&x.owner_id===owner&&x.frequency==='unica'),'one-off receipt points to exact assignment');
    assert.equal(final['public.task_instances'].filter(x=>x.id===oneOffResponse.result.taskId&&x.assignment_id===oneOffResponse.result.assignmentId).length,1,'one-off receipt points to exact task instance');
    assert.equal(materializeResponse.result.createdTaskIds.length,1);
    assert.deepEqual(materializeResponse.result.createdTaskIds,final['public.task_instances'].filter(x=>x.assignment_id===assignment&&x.period===period).map(x=>x.id),'materialize receipt points to exact occurrence');
    assert.equal(conflict['app_private.api_command_receipts'].filter(x=>x.operation_id===(winner==='materialize'?one.operationId:mat.operationId)).length,0,'blocked command has no receipt before retry');
    if(winner==='materialize') { assert.equal(conflict['public.task_instances'].filter(x=>x.assignment_id===assignment&&x.period===period).length,1); assert.equal(conflict['public.task_assignments'].filter(x=>x.owner_id===owner&&x.frequency==='unica').length,0); }
    else { assert.equal(conflict['public.task_instances'].filter(x=>x.assignment_id===assignment&&x.period===period).length,0); assert.equal(conflict['public.task_assignments'].filter(x=>x.owner_id===owner&&x.frequency==='unica').length,1); }
    const taskWriteAllow=new Set(['public.task_assignments','public.task_instances','public.task_templates','public.task_template_versions','app_private.api_catalogue_heads','app_private.api_creation_heads','app_private.api_month_fences','app_private.api_command_receipts','app_private.api_operation_fences','public.audit_events','public.task_responsibility_sets','public.task_responsibility_members','public.task_responsibility_events','public.task_responsibility_heads','app_private.api_membership_fences']);
    const winnerChangedTables=assertNoUnexpectedChanges(before,winnerOnly,taskWriteAllow,'materialize/one-off winner');
    const retryChangedTables=assertNoUnexpectedChanges(conflict,final,taskWriteAllow,'materialize/one-off retry');
    assertNoDeadlock({name:`materialize-oneOff-${iso}-${winner}`,first:wr,second:stale,retry});
    report.cases.push({name:`month.materialize/task.createOneOff ${winner}-first ${iso}`,isolation:iso,winner,actors:{materialize:boss,oneOff:owner},actorRoles:{materialize:'jefe',oneOff:'empleado'},contexts:{winner:wctx,loser:lctx,retry:retryCtx},blocker:block,winnerResult:wr,staleResult:stale,retry,winnerChangedTables,retryChangedTables,fullSnapshots:{before,winnerOnly,afterLoserRollback:conflict,final},occurrenceCounts:{recurring:final['public.task_instances'].filter(x=>x.assignment_id===assignment&&x.period===period).length,oneOffAssignments:final['public.task_assignments'].filter(x=>x.owner_id===owner&&x.frequency==='unica').length}});
    await first.ok('reset role;'); await second.ok('reset role;');
  }

  // 9-12: ACK replay first holds author FOR SHARE while profile writer waits.
  for(const iso of ['read committed','repeatable read']) for(const mutation of ['inactive','auditor']){
    const actor=uid(++seed), assignment=uid(++seed), task=uid(++seed), op=uid(++seed), body='Gate L replay-first synthetic note'; await insertActor(actor);
    await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day,checklist) values(${lit(assignment)},${lit(org)},${lit(company)},${lit(actor)},${lit(team)},'Gate L note','resultado',1,'mensual',${lit(period)},21,'[]');
      insert into public.task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,status,checklist) values(${lit(task)},${lit(org)},${lit(assignment)},${lit(company)},${lit(actor)},${lit(team)},${lit(period)},${lit(date)},'Gate L note','resultado',1,'Pendiente','[]');`);
    const call=`select public.save_private_block_note(${lit(task)},${lit(body)},0,${lit(op)})::text;`;
    await context(first,actor,'aal1'); const initial=await first.query(call); assert.equal(initial.code,'00000',JSON.stringify(initial));
    const before=await snapshot(); const initialEnvelope=JSON.parse(initial.lines.at(-1)); const initialReceipt=before['public.private_block_note_receipts'].find(x=>x.actor_id===actor&&x.operation_id===op); assert.ok(initialReceipt,'first write must persist private-note receipt'); assert.deepEqual(initialEnvelope,initialReceipt.result,'first response must equal durable receipt');
    await first.ok(`begin isolation level ${iso};`); const replayCtx=await context(first,actor,'aal1'); assert.equal(replayCtx.isolation,iso,'ACK replay transaction must use requested isolation'); const ack=await first.query(call); assert.equal(ack.code,'00000',JSON.stringify(ack)); assert.deepEqual(JSON.parse(ack.lines.at(-1)),initialReceipt.result,'ACK response must equal initial receipt result');
    const ackSnapshot=await snapshot(); assert.deepEqual(ackSnapshot,before,'ACK must not mutate state');
    const writerMeta=JSON.parse((await second.ok(`begin isolation level ${iso};select jsonb_build_object('pid',pg_backend_pid(),'databaseRole',current_user,'sessionUser',session_user,'jwtSub',auth.uid(),'jwtRole',auth.jwt()->>'role','aal',auth.jwt()->>'aal','isolation',current_setting('transaction_isolation'))::text;`)).at(-1)); assert.equal(writerMeta.isolation,iso,'profile writer transaction must use requested isolation'); const writerPid=writerMeta.pid; const update=mutation==='inactive'?`update public.profiles set active=false where id=${lit(actor)};`:`update public.profiles set role='auditor' where id=${lit(actor)};`;
    const pending=second.query(update), barrier=await trackedBlocker(writerPid,replayCtx.pid); await first.ok('commit;'); const write=await pending; assert.equal(write.code,'00000',JSON.stringify(write)); await second.ok('commit;');
    assert.equal(write.code,'00000',JSON.stringify(write));
    const afterWriter=await snapshot(); const writerDelta=changedTables(ackSnapshot,afterWriter); assert.deepEqual(writerDelta,['public.profiles'],'profile writer must affect only the profile row');
    const changedProfile=afterWriter['public.profiles'].find(x=>x.id===actor); assert.ok(changedProfile);
    assert.equal(changedProfile.active,mutation==='inactive'?false:true); assert.equal(changedProfile.role,mutation==='auditor'?'auditor':'empleado');
    await first.ok(`begin isolation level ${iso};`); const retryCtx=await context(first,actor,'aal1'); const retryBefore=await snapshot(); const retry=await first.query(call); await first.ok('rollback;'); const retryAfter=await snapshot();
    assert.equal(retry.code,'P0001',JSON.stringify(retry)); assert.deepEqual(retryAfter,retryBefore,'fresh denied replay must not mutate');
    assertNoDeadlock({name:`P-${mutation}-${iso}`,first:ack,second:write,retry});
    report.cases.push({name:`P replay-first vs ${mutation} ${iso}`,isolation:iso,mutation,actorRole:'empleado',actorAal:'aal1',contexts:{replay:replayCtx,writer:writerMeta,retry:retryCtx},writerAuthority:{principal:'local postgres fixture operator',mechanism:'direct SQL profile update; current migration policy search found only profile_read SELECT (supabase/migrations/202609300001_foundation.sql:41) and no profile role/deactivation RPC or authenticated UPDATE policy',notAnApplicationIdentity:true,limitation:'This models the database profile row writer required for the lock race; it does not claim an authorized application profile-management path.'},ack,barrier,writerResult:write,writerChangedTables:writerDelta,retry,fullSnapshots:{before,afterAck:ackSnapshot,afterWriter,retryBefore,retryAfter}});
    await first.ok('reset role;'); await second.ok('reset role;');
  }
  assert.equal(report.cases.length,12,`expected exactly 12 cases, got ${report.cases.length}`);
  report.result='GREEN_RESIDUAL_12';
  persist();
} catch(e) {
  report.result='HARNESS_ERROR'; report.error=String(e.stack??e); persist(); console.error(e); process.exitCode=2;
} finally {
  for(const s of sessions) await s.close().catch(()=>{});
  if(clusterStarted) ctl(['-D',cluster,'-m','fast','-w','stop']);
}
