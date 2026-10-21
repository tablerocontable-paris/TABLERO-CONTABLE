// C late atomicity and calendar contract. Synthetic local PostgreSQL only.
// This runner creates a disposable cluster and never calls a hosted service.
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';

const flags = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, xs) => i % 2 ? a : [...a, [x, xs[i + 1]]], []));
for (const k of ['--pg-bin', '--output-dir', '--port']) if (!flags[k]) throw new Error(`Missing ${k}`);
const root = resolve(import.meta.dirname, '../..'), bin = resolve(flags['--pg-bin']), out = resolve(flags['--output-dir']);
const port = String(flags['--port']), cluster = join(out, 'cluster'); mkdirSync(out, { recursive: true });
const exe = n => join(bin, process.platform === 'win32' ? `${n}.exe` : n);
const native = (n, args) => execFileSync(exe(n), args, { encoding: 'utf8', windowsHide: true });
const ctl = args => execFileSync(exe('pg_ctl'), args, { windowsHide: true, stdio: 'ignore' });
const hash = b => createHash('sha256').update(b).digest('hex').toUpperCase();
const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const lit = x => `'${String(x).replaceAll("'", "''")}'`;
const cmdSql = c => `select api.command_v1(${lit(JSON.stringify(c))}::jsonb);`;
const report = { result: 'RUNNING', scope: 'C late atomicity six injections plus calendar and onboarding functional cases', runner: resolve(import.meta.filename), runnerSha256: hash(readFileSync(import.meta.filename)), sql014Sha256: hash(readFileSync(join(root, 'supabase/migrations/202610150014_operational_api.sql'))), baseline: execFileSync('git', ['rev-parse','HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(), originMain: execFileSync('git', ['rev-parse','origin/main'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(), commandLine: process.argv, cases: [], errors: [], deadlocks: [], snapshotScope: 'all public/app_private base tables; assert exactly 57', scopeLimit: 'synthetic local database only; no hosted calls' };
const persist = () => {
  const bytes = JSON.stringify(report, null, 2); writeFileSync(join(out, 'report.json'), bytes);
  const exitCodeBytes=Buffer.from(report.result==='GREEN_C_LATE_ATOMICITY_CALENDAR'?'0\n':'1\n');writeFileSync(join(out,'exit-code.txt'),exitCodeBytes);
  const manifest = { format: 'm2-2c-c-late-atomicity-calendar-v1', result: report.result, exitCode: report.result==='GREEN_C_LATE_ATOMICITY_CALENDAR'?0:1, exitCodePath: join(out,'exit-code.txt'), exitCodeSha256: hash(exitCodeBytes), runnerPath: resolve(import.meta.filename), runnerSha256: hash(readFileSync(import.meta.filename)), sql014Sha256: report.sql014Sha256, reportPath: join(out, 'report.json'), reportSha256: hash(bytes), caseCount: report.cases.length, caseNames: report.cases.map(x => x.name), errors: report.errors, deadlocks: report.deadlocks, generatedAt: new Date().toISOString(), scope: report.scopeLimit };
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
};

class Session {
  constructor() {
    this.proc = spawn(exe('psql'), ['-X','-q','-t','-A','-h','127.0.0.1','-p',port,'-U','postgres','-d','postgres'], { windowsHide: true, env: { ...process.env, PGCLIENTENCODING: 'UTF8' } });
    this.stdout=''; this.stderr=''; this.pending=null; this.seq=0; this.proc.stdout.setEncoding('utf8'); this.proc.stderr.setEncoding('utf8');
    this.proc.stdout.on('data', x => { this.stdout+=x; this.flush(); }); this.proc.stderr.on('data', x => { this.stderr+=x; });
    this.proc.on('error', e => this.pending?.reject(e)); this.proc.on('exit', c => this.pending?.reject(new Error(`psql exited ${c}: ${this.stderr}`)));
  }
  flush() { if(!this.pending)return; const {marker,resolve:done}=this.pending, at=this.stdout.indexOf(`${marker} `); if(at<0)return; const end=this.stdout.indexOf('\n',at); if(end<0)return; const lines=this.stdout.slice(0,at).trim().split(/\r?\n/u).filter(Boolean), errors=this.stderr; this.stdout=this.stdout.slice(end+1); this.stderr=''; this.pending=null; done({lines,errors,code:errors.match(/ERROR:\s+([0-9A-Z]{5}):/u)?.[1]??'00000'}); }
  query(sql) { return new Promise((ok,no)=>{ if(this.pending)return no(new Error('concurrent psql query')); const marker=`__c_late_${++this.seq}__`; this.pending={marker,resolve:ok,reject:no}; this.proc.stdin.write(`${sql}\nselect '${marker}'||' done';\n`); }); }
  async ok(sql) { const r=await this.query(sql); if(r.code!=='00000')throw new Error(`${r.code}: ${r.errors}\n${sql}`); return r.lines; }
  async close() { if(this.proc.exitCode===null){this.proc.stdin.write('\\q\n');this.proc.stdin.end();await new Promise(done=>this.proc.once('exit',done));} }
}
const sessions=[]; let clusterStarted=false, seed=610000;
const getJson = r => JSON.parse(r.lines.at(-1));
const eqSnapshot = (a,b,label) => assert.deepEqual(b,a,label);

try {
  report.postgresVersion = native('postgres',['--version']).trim();
  writeFileSync(join(out,'initdb.log'), native('initdb',['-D',cluster,'-A','trust','-U','postgres','--encoding=UTF8','--no-locale']));
  ctl(['-D',cluster,'-l',join(out,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']); clusterStarted=true;
  const setup=new Session(), observer=new Session(), actorSession=new Session(); sessions.push(setup,observer,actorSession);
  for(const s of sessions) await s.ok("\\set VERBOSITY verbose\n\\set ON_ERROR_ROLLBACK on\nset statement_timeout='20s';");
  await setup.ok(`create role anon; create role authenticated; create role service_role; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid(),auth.jwt() to authenticated;`);
  for(const f of readdirSync(join(root,'supabase/migrations')).filter(x=>x.endsWith('.sql')).sort()) await setup.ok(readFileSync(join(root,'supabase/migrations',f),'utf8'));
  await observer.ok(`create function pg_temp.snapshot_all() returns jsonb language plpgsql as $$ declare t record; rows jsonb; result jsonb:='{}'::jsonb; n int:=0;
    begin for t in select schemaname,tablename from pg_catalog.pg_tables where schemaname in ('public','app_private') order by schemaname,tablename loop
      execute format('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb) from %I.%I x',t.schemaname,t.tablename) into rows;
      result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,rows); n:=n+1; end loop;
      if n<>57 then raise exception 'expected 57 base tables, observed %',n using errcode='22023'; end if; return result; end $$;`);
  const snapshot=async()=>getJson(await observer.query('select pg_temp.snapshot_all()::text;'));
  const organization=uid(++seed), boss=uid(++seed), company=uid(++seed), team=uid(++seed);
  const currentPeriod=`${new Date().toISOString().slice(0,7)}-01`;
  await observer.ok(`insert into public.organizations(id,name) values(${lit(organization)},'C late synthetic'); insert into auth.users(id) values(${lit(boss)});
    insert into public.profiles(id,organization_id,name,role,sector,branch,position,active) values(${lit(boss)},${lit(organization)},'C late boss','jefe','Test','Test','Jefe',true);
    insert into public.companies(id,organization_id,name) values(${lit(company)},${lit(organization)},'C late company');
    insert into public.teams(id,organization_id,name,manager_id) values(${lit(team)},${lit(organization)},'C late team',${lit(boss)});
    insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(organization)},${lit(company)},${lit(boss)});
    insert into public.team_members(organization_id,team_id,profile_id) values(${lit(organization)},${lit(team)},${lit(boss)});`);
  const authSql=(actor, role='authenticated', aal='aal2')=>`reset role;select set_config('request.jwt.claim.sub',${lit(actor)},false),set_config('request.jwt.claims',${lit(JSON.stringify({role,sub:actor,aal}))},false);set role authenticated;`;
  const call=async(actor,c)=>{ await actorSession.ok(authSql(actor)); return actorSession.query(cmdSql(c)); };
  const addActor=async(role='empleado',id=uid(++seed))=>{ await observer.ok(`insert into auth.users(id) values(${lit(id)});insert into public.profiles(id,organization_id,name,role,sector,branch,position,manager_id,active) values(${lit(id)},${lit(organization)},'C late ${id}',${lit(role)},'Test','Test','Synthetic',${lit(boss)},true);insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(organization)},${lit(company)},${lit(id)});insert into public.team_members(organization_id,team_id,profile_id) values(${lit(organization)},${lit(team)},${lit(id)});`); return id; };
  const readVal=async(sql)=> (await observer.ok(sql)).at(-1);
  const mkCatalog=async(label)=>{ const rev=await readVal(`select coalesce((select revision from app_private.api_catalogue_heads where organization_id=${lit(organization)}),0);`); const op=uid(++seed), c={contractVersion:1,operationId:op,kind:'catalogue.create',expectedRevisions:{[`catalogue:${organization}`]:rev},payload:{definition:{kind:'operativa',title:label,objective:'',sector:'Test',unit:'documentos'},effectiveOn:'2024-01-01',reason:'C late fixture'}}; const r=await call(boss,c);assert.equal(r.code,'00000',JSON.stringify(r));return getJson(r).result; };
  const standard=await mkCatalog('C late standard');
  const mkDraft=(lineId, schedule={frequency:'mensual',startDate:'2024-01-01',endDate:null,interval:1,weekdays:[],monthDay:21,hasDeadline:true,dueOffsetDays:0})=>({schemaVersion:2,lines:[{lineId,companyId:company,teamId:team,source:{type:'catalogue',templateVersionId:standard.versionId},schedule}]});
  const saveCmd=(owner,operationId,draft,requestId=null,revision='0')=>({contractVersion:1,operationId,kind:'onboarding.saveDraft',expectedRevisions:{[`onboardingOwner:${owner}`]:revision},payload:{requestId,draft}});
  const submitCmd=(requestId,operationId)=>({contractVersion:1,operationId,kind:'onboarding.submit',expectedRevisions:{[`onboarding:${requestId}`]:'0',[`onboardingDraft:${requestId}`]:'1'},payload:{requestId}});
  const approveCmd=(requestId,operationId,templateId=standard.templateId,templateRevision='1')=>({contractVersion:1,operationId,kind:'onboarding.approve',expectedRevisions:{[`onboarding:${requestId}`]:'1',[`catalogue:${templateId}`]:templateRevision},payload:{requestId,weightOverrides:[],period:currentPeriod}});
  const makeSubmitted=async(owner,draft=mkDraft(uid(++seed)))=>{ await addActor('empleado',owner); const save=saveCmd(owner,uid(++seed),draft); const sr=await call(owner,save);assert.equal(sr.code,'00000',JSON.stringify(sr)); const requestId=getJson(sr).result.requestId;const sub=submitCmd(requestId,uid(++seed));const tr=await call(owner,sub);assert.equal(tr.code,'00000',JSON.stringify(tr));return {requestId,save,submit:sub}; };
  const auditFilterTrigger=async(action,actor,entity)=>observer.ok(`create function app_private.c_late_injected_failure() returns trigger language plpgsql set search_path='' as $$ begin if new.action=${lit(action)} and new.actor_id=${lit(actor)}${entity?` and new.entity_id=${lit(entity)}`:''} then raise exception using errcode='23514',message='C late synthetic injected rollback'; end if; return new; end $$; create trigger c_late_injected_failure after insert on public.audit_events for each row execute function app_private.c_late_injected_failure();`);
  const dropAuditFailure=async()=>observer.ok('drop trigger c_late_injected_failure on public.audit_events; drop function app_private.c_late_injected_failure();');
  const runFailingAudit=async({name,actor,command,action,entity,verify})=>{
    const before=await snapshot(); await auditFilterTrigger(action,actor,entity);
    const failed=await call(actor,command); await actorSession.ok('reset role;'); assert.equal(failed.code,'23514',`${name}: ${JSON.stringify(failed)}`);
    const afterError=await snapshot(); eqSnapshot(before,afterError,`${name}: exact 57-table rollback`); await dropAuditFailure();
    const retry=await call(actor,command); await actorSession.ok('reset role;'); assert.equal(retry.code,'00000',`${name} retry: ${JSON.stringify(retry)}`);
    const afterRetry=await snapshot(); await verify(afterRetry,retry);
    const replay=await call(actor,command); await actorSession.ok('reset role;'); assert.equal(replay.code,'00000',`${name} replay: ${JSON.stringify(replay)}`); const afterReplay=await snapshot(); eqSnapshot(afterRetry,afterReplay,`${name} replay inert`);
    report.cases.push({name,operationId:command.operationId,injectedSQLSTATE:failed.code,retrySQLSTATE:retry.code,replaySQLSTATE:replay.code,fullSnapshots:{before,afterInjectedRollback:afterError,afterRetry,afterReplay},result:getJson(retry)});
  };

  // Six late transactional fault injections.
  {
    const owner=await addActor('empleado'), op=uid(++seed), title=`C oneoff ${op}`, revision=await readVal(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(organization)} and owner_id=${lit(owner)}),0);`);
    const c={contractVersion:1,operationId:op,kind:'task.createOneOff',expectedRevisions:{[`creation:${owner}`]:revision},payload:{ownerId:owner,companyId:company,teamId:team,source:{type:'custom',definition:{kind:'operativa',title,objective:'',sector:'Test',unit:'documentos'}},scheduledOn:'2024-02-29',dueDate:null,priority:'Media'}};
    await runFailingAudit({name:'task.createOneOff late audit failure',actor:owner,command:c,action:'task.createOneOff',entity:null,verify:async(s,r)=>{assert.equal(s['public.task_assignments'].filter(x=>x.owner_id===owner&&x.title===title).length,1);assert.equal(s['public.task_instances'].filter(x=>x.owner_id===owner&&x.title===title).length,1);assert.equal(s['app_private.api_command_receipts'].filter(x=>x.operation_id===op).length,1);assert.equal(s['public.audit_events'].filter(x=>x.actor_id===owner&&x.action==='task.createOneOff').length,1);}});
  }
  {
    const op=uid(++seed), title=`C catalogue ${op}`, rev=await readVal(`select coalesce((select revision from app_private.api_catalogue_heads where organization_id=${lit(organization)}),0);`), c={contractVersion:1,operationId:op,kind:'catalogue.create',expectedRevisions:{[`catalogue:${organization}`]:rev},payload:{definition:{kind:'operativa',title,objective:'',sector:'Test',unit:'documentos'},effectiveOn:'2024-01-01',reason:'C late fault'}};
    const beforeTemplates=await readVal(`select count(*) from public.task_templates where organization_id=${lit(organization)};`);
    await runFailingAudit({name:'catalogue.create late audit failure',actor:boss,command:c,action:'catalogue.create',entity:null,verify:async(s,r)=>{const created=s['public.task_templates'].find(x=>x.title===title);assert.ok(created);assert.equal(s['public.task_template_versions'].filter(x=>x.template_id===created.id).length,1);assert.equal(s['public.task_templates'].filter(x=>x.title===title).length,1);assert.equal(s['app_private.api_command_receipts'].filter(x=>x.operation_id===op).length,1);assert.ok(Number(s['public.task_templates'].length)>Number(beforeTemplates));}});
  }
  {
    const owner=await addActor('empleado'), op=uid(++seed), draft=mkDraft(uid(++seed)), c=saveCmd(owner,op,draft);
    await runFailingAudit({name:'onboarding.saveDraft after request write',actor:owner,command:c,action:'onboarding.draft_saved',entity:null,verify:async(s,r)=>{const req=s['public.onboarding_requests'].find(x=>x.owner_id===owner);assert.ok(req);assert.equal(s['app_private.api_onboarding_owner_heads'].find(x=>x.owner_id===owner)?.revision,1);assert.equal(s['app_private.api_command_receipts'].filter(x=>x.operation_id===op).length,1);}});
  }
  {
    const owner=uid(++seed); await addActor('empleado',owner); const op=uid(++seed);
    const owner2=await addActor('empleado'), draft=mkDraft(uid(++seed)), sr=await call(owner2,saveCmd(owner2,uid(++seed),draft)); assert.equal(sr.code,'00000',JSON.stringify(sr)); const req=getJson(sr).result.requestId; const submit=submitCmd(req,op);
    await runFailingAudit({name:'onboarding.submit after request version write',actor:owner2,command:submit,action:'onboarding.submitted',entity:req,verify:async(s)=>{assert.equal(s['public.onboarding_requests'].find(x=>x.id===req).status,'submitted');assert.equal(s['public.onboarding_request_versions'].filter(x=>x.request_id===req).length,1);assert.equal(s['app_private.api_command_receipts'].filter(x=>x.operation_id===op).length,1);}});
  }
  {
    const owner=uid(++seed), {requestId}=await makeSubmitted(owner), op=uid(++seed), c=approveCmd(requestId,op);
    await runFailingAudit({name:'onboarding.approve after assignment/activation writes',actor:boss,command:c,action:'onboarding.approved',entity:requestId,verify:async(s)=>{assert.equal(s['public.onboarding_requests'].find(x=>x.id===requestId).status,'approved');assert.ok(s['public.onboarding_activations'].some(x=>x.request_id===requestId));assert.ok(s['public.task_assignments'].some(x=>x.owner_id===owner));assert.equal(s['app_private.api_command_receipts'].filter(x=>x.operation_id===op).length,1);}});
  }
  {
    const owner=await addActor('empleado'), assignment=uid(++seed), title=`C month ${assignment}`;
    await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,frequency,start_month,due_day,checklist,measurement_version,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days) values(${lit(assignment)},${lit(organization)},${lit(company)},${lit(owner)},${lit(team)},${lit(title)},'operativa',null,'documentos','mensual','2024-02-01',29,'[]',2,'2024-02-29',null,1,array[1]::smallint[],31,true,1);`);
    const rev=await readVal(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(organization)} and owner_id=${lit(owner)}),0);`), op=uid(++seed), c={contractVersion:1,operationId:op,kind:'month.materialize',expectedRevisions:{[`creation:${owner}`]:rev},payload:{ownerId:owner,period:'2024-02-01'}};
    await runFailingAudit({name:'month.materialize after occurrence writes',actor:boss,command:c,action:'month.materialized',entity:owner,verify:async(s)=>{assert.equal(s['public.task_instances'].filter(x=>x.assignment_id===assignment&&x.period==='2024-02-01').length,1);assert.equal(s['app_private.api_command_receipts'].filter(x=>x.operation_id===op).length,1);}});
  }

  // Duplicate IDs and weekdays must be rejected by the RPC without writes.
  for(const kind of ['duplicate-line-id','duplicate-weekday']){
    const owner=await addActor('empleado'), line=uid(++seed), secondLine=kind==='duplicate-line-id'?line:uid(++seed), draft={schemaVersion:2,lines:[{...mkDraft(line).lines[0]},{...mkDraft(secondLine).lines[0]}]};
    let validControl=null;
    if(kind==='duplicate-weekday'){
      draft.lines[1].schedule={frequency:'semanal',startDate:'2024-01-01',endDate:null,interval:1,weekdays:[1,1],monthDay:21,hasDeadline:false,dueOffsetDays:0};
      const controlDraft=structuredClone(draft);controlDraft.lines[1].schedule.weekdays=[1,2];
      const control=await call(owner,saveCmd(owner,uid(++seed),controlDraft));await actorSession.ok('reset role;');assert.equal(control.code,'00000',`valid weekday control: ${JSON.stringify(control)}`);validControl={sqlstate:control.code,response:control.lines.at(-1)};
    }
    const c=saveCmd(owner,uid(++seed),draft,null,kind==='duplicate-weekday'?'1':'0'), before=await snapshot(), r=await call(owner,c); await actorSession.ok('reset role;'); assert.equal(r.code,'22023',`${kind}: ${JSON.stringify(r)}`);
    assert.match(r.errors,/app_private\.api_validate_onboarding_v2/u,`${kind}: must fail in onboarding validator`);
    if(kind==='duplicate-line-id')assert.match(r.errors,/Identificador de línea duplicado/u);
    else assert.match(r.errors,/Calendario inválido/u);
    const after=await snapshot(); eqSnapshot(before,after,`${kind}: invalid draft must write nothing`);
    report.cases.push({name:`invalid multi-line draft ${kind}`,operationId:c.operationId,sqlstate:r.code,validationSource:'app_private.api_validate_onboarding_v2',expectedValidationMessage:kind==='duplicate-line-id'?'Identificador de línea duplicado':'Calendario inválido',validControl,fullSnapshots:{before,afterError:after},response:r.errors});
  }

  // Month/day clamp and due-date rollover across the leap-day/month boundary.
  {
    const owner=await addActor('empleado'), assignment=uid(++seed);
    await observer.ok(`insert into public.task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,unit,frequency,start_month,due_day,checklist,measurement_version,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days) values(${lit(assignment)},${lit(organization)},${lit(company)},${lit(owner)},${lit(team)},'C leap day 31 clamp','operativa',null,'documentos','mensual','2024-02-01',31,'[]',2,'2024-02-29','2024-03-31',1,array[1]::smallint[],31,true,1);`);
    let rev=await readVal(`select coalesce((select revision from app_private.api_creation_heads where organization_id=${lit(organization)} and owner_id=${lit(owner)}),0);`);
    for(const period of ['2024-02-01','2024-03-01']){const op=uid(++seed),c={contractVersion:1,operationId:op,kind:'month.materialize',expectedRevisions:{[`creation:${owner}`]:rev},payload:{ownerId:owner,period}};const r=await call(boss,c);assert.equal(r.code,'00000',JSON.stringify(r));rev=JSON.parse(r.lines.at(-1)).result.creationRevision;await actorSession.ok('reset role;');}
    const rows=JSON.parse((await observer.ok(`select coalesce(jsonb_agg(jsonb_build_object('period',period,'scheduledOn',scheduled_on,'dueDate',due_date) order by period),'[]'::jsonb)::text from public.task_instances where assignment_id=${lit(assignment)};`)).at(-1));
    assert.deepEqual(rows,[{period:'2024-02-01',scheduledOn:'2024-02-29',dueDate:'2024-03-01'},{period:'2024-03-01',scheduledOn:'2024-03-31',dueDate:'2024-04-01'}]); report.cases.push({name:'calendar leap day, day-31 clamp, due-date rollover',rows});
  }

  // Approval atomicity: line one is valid; line two conflicts after line one writes.
  {
    const owner=await addActor('empleado'), firstLine=uid(++seed), secondLine=uid(++seed), draft={schemaVersion:2,lines:[
      {lineId:firstLine,companyId:uid(++seed),teamId:team,source:{type:'catalogue',templateVersionId:standard.versionId},schedule:{frequency:'mensual',startDate:'2024-01-01',endDate:null,interval:1,weekdays:[],monthDay:10,hasDeadline:false,dueOffsetDays:0}},
      {lineId:secondLine,companyId:company,teamId:team,source:{type:'catalogue',templateVersionId:standard.versionId},schedule:{frequency:'mensual',startDate:'2024-01-01',endDate:null,interval:1,weekdays:[],monthDay:20,hasDeadline:false,dueOffsetDays:0}}
    ]};
    const firstCompany=draft.lines[0].companyId; await observer.ok(`insert into public.companies(id,organization_id,name) values(${lit(firstCompany)},${lit(organization)},'C late first-line company');insert into public.company_memberships(organization_id,company_id,profile_id) values(${lit(organization)},${lit(firstCompany)},${lit(owner)});`);
    const s=await call(owner,saveCmd(owner,uid(++seed),draft));assert.equal(s.code,'00000',JSON.stringify(s));const req=getJson(s).result.requestId;const sub=await call(owner,submitCmd(req,uid(++seed)));assert.equal(sub.code,'00000',JSON.stringify(sub));
    const conflictAssignment=uid(++seed);await observer.ok(`insert into public.task_assignments(id,organization_id,template_id,template_version_id,company_id,owner_id,team_id,title,kind,weight,unit,frequency,start_month,due_day,checklist,measurement_version,start_date,end_date,interval_count,weekdays,month_day,has_deadline,due_offset_days) values(${lit(conflictAssignment)},${lit(organization)},${lit(standard.templateId)},${lit(standard.versionId)},${lit(company)},${lit(owner)},${lit(team)},'C conflicting existing line','operativa',null,'documentos','mensual','2024-01-01',20,'[]',2,'2024-01-01',null,1,array[1]::smallint[],20,false,0);`);
    const op=uid(++seed), c=approveCmd(req,op), before=await snapshot(), failure=await call(boss,c);await actorSession.ok('reset role;');assert.equal(failure.code,'22023',JSON.stringify(failure));const after=await snapshot();eqSnapshot(before,after,'approval conflict must rollback all writes after first valid line');
    await observer.ok(`delete from public.task_assignments where id=${lit(conflictAssignment)};`);const afterRemovingConflict=await snapshot();
    const changedTables=Object.keys(before).filter(k=>JSON.stringify(before[k])!==JSON.stringify(afterRemovingConflict[k]));assert.deepEqual(changedTables,['public.task_assignments'],'removing the deliberate conflict may only change task_assignments');
    assert.deepEqual(afterRemovingConflict['public.task_assignments'],before['public.task_assignments'].filter(x=>x.id!==conflictAssignment),'only the deliberately seeded conflicting assignment is removed');
    const retry=await call(boss,c);await actorSession.ok('reset role;');assert.equal(retry.code,'00000',JSON.stringify(retry));const final=await snapshot();assert.equal(final['public.onboarding_requests'].find(x=>x.id===req).status,'approved');assert.equal(final['public.onboarding_activations'].filter(x=>x.request_id===req).length,2);assert.equal(final['public.task_assignments'].filter(x=>x.owner_id===owner&&x.template_id===standard.templateId).length,2);assert.equal(final['app_private.api_command_receipts'].filter(x=>x.operation_id===op).length,1);assert.equal(final['public.audit_events'].filter(x=>x.action==='onboarding.approved'&&x.entity_id===req).length,1);
    const durableReceipt=final['app_private.api_command_receipts'].find(x=>x.operation_id===op);assert.ok(durableReceipt,'successful retry must persist its durable receipt');
    const replay=await call(boss,c);await actorSession.ok('reset role;');assert.equal(replay.code,'00000',JSON.stringify(replay));assert.deepEqual(getJson(replay),getJson(retry),'approval replay must return the original result');assert.deepEqual(getJson(replay),durableReceipt.result,'approval replay response must equal the durable receipt result');const afterReplay=await snapshot();eqSnapshot(final,afterReplay,'approval replay must be inert across all 57 tables');
    report.cases.push({name:'approval all-or-nothing second line conflict then same-operation retry and replay',operationId:op,failureSQLSTATE:failure.code,retrySQLSTATE:retry.code,replaySQLSTATE:replay.code,durableReceiptResult:durableReceipt.result,conflictRemovalChangedTables:changedTables,fullSnapshots:{beforeConflict:before,afterConflict:after,afterRemovingConflict,beforeRetry:afterRemovingConflict,afterRetry:final,afterReplay}});
  }

  report.result='GREEN_C_LATE_ATOMICITY_CALENDAR';
} catch(e) {
  report.result='FAILED_C_LATE_ATOMICITY_CALENDAR'; report.errors.push({message:e?.message??String(e),stack:e?.stack??null});
} finally {
  for(const s of sessions) try{await s.close();}catch{}
  if(clusterStarted) try{ctl(['-D',cluster,'-m','fast','-w','stop']);}catch{}
  persist();
}
if(report.result!=='GREEN_C_LATE_ATOMICITY_CALENDAR'){process.stderr.write(`${JSON.stringify(report.errors,null,2)}\n`);process.exitCode=1;} else process.stdout.write(`${report.result}: ${report.cases.length} cases\n`);
