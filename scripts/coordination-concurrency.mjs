// PostgreSQL-only laboratory. No driver dependency, cloud connection or sleeps.
// Each case gets a NEW database with a fixed lab prefix and synthetic users.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const flags=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,s)=>i%2?a:a.concat([[v,s[i+1]]]),[]));
const psql=flags['--psql'];
if(!psql) { console.log('NO EJECUTADO: proporcionar --psql y PostgreSQL local descartable.'); process.exit(2); }
const port=flags['--port']??'55432';
if(!/^\d{4,5}$/.test(port)) throw Error('Puerto inválido');
const output=flags['--output'];
const root=resolve(import.meta.dirname,'..');
const uid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const id={org:uid(1),boss:uid(2),owner:uid(4),peer:uid(5),company:uid(7),team:uid(9),assignment:uid(101),task:uid(102),assignment2:uid(103),task2:uid(104),plan:uid(200),request:uid(300),template:uid(400),version:uid(401)};
const lit=s=>`'${String(s).replaceAll("'","''")}'`;
class Session {
  constructor(database) {
    this.proc=spawn(psql,['-X','-q','-t','-A','-h','127.0.0.1','-p',port,'-U','postgres','-d',database],{windowsHide:true});
    this.buffer='';this.errors='';this.serial=0;this.pending=null;
    this.proc.stdout.setEncoding('utf8');this.proc.stderr.setEncoding('utf8');
    this.proc.stdout.on('data',data=>{this.buffer+=data;this.flush();});
    this.proc.stderr.on('data',data=>{this.errors+=data;});
    this.proc.on('error',error=>this.pending?.reject(error));
    this.proc.on('exit',code=>{if(this.pending)this.pending.reject(Error(`psql terminó (${code}): ${this.errors}`));});
  }
  flush(){
    if(!this.pending)return;
    const {mark,resolve:done}=this.pending,position=this.buffer.indexOf(mark+' ');
    if(position<0)return;
    const end=this.buffer.indexOf('\n',position);if(end<0)return;
    const frame=this.buffer.slice(position,end).trim().split(/\s+/);
    const lines=this.buffer.slice(0,position).trim().split(/\r?\n/).filter(Boolean);
    const errors=this.errors;this.errors='';this.buffer=this.buffer.slice(end+1);this.pending=null;
    const code=errors.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??frame.at(-1);
    done({lines,code,errors});
  }
  query(sql){
    if(this.pending)throw Error('Una consulta por conexión');
    return new Promise((done,reject)=>{
      const mark=`__PG_LAB_${++this.serial}__`;
      this.pending={mark,resolve:done,reject};
      this.proc.stdin.write(`${sql}\n\\echo ${mark} :ERROR :SQLSTATE\n`);
    });
  }
  async ok(sql){const r=await this.query(sql);assert.equal(r.code,'00000',`${sql}\n${r.errors}`);return r.lines;}
  async close(){if(this.pending)throw Error('Conexión con consulta pendiente');this.proc.stdin.end('\\q\n');await new Promise(done=>this.proc.once('exit',done));}
}
const actor=(who,aal='aal2')=>`reset role; select set_config('request.jwt.claim.sub',${lit(who)},false),set_config('request.jwt.claims',${lit(JSON.stringify({aal}))},false); set role authenticated;`;
const sql=(name,...args)=>`select public.${name}(${args.join(',')});`;
const revision=task=>`(select state_revision from public.task_instances where id=${lit(task)})`;
let operationSerial=10000;
const op=()=>lit(uid(++operationSerial));
const start=(task,switchClock=false)=>sql('start_task_timer',lit(task),revision(task),op(),switchClock?'true':'false');
const close=()=>sql('close_employee_month',lit(id.owner),'current_date-date_part(\'day\',current_date)::integer+1',"'Revisión ficticia'");
const month="date_trunc('month',current_date)::date";
const materialize=()=>sql('materialize_month',lit(id.owner),month);
const assign=task=>sql('assign_task_responsibility',lit(task),`${lit(JSON.stringify([{profileId:id.owner,shareBps:5000},{profileId:id.peer,shareBps:5000}]))}::jsonb`,"'Dupla ficticia'",'1',op());
async function fixture(a) {
 await a.ok("\\set VERBOSITY verbose\nselect 1;");
 await a.ok(`do $$begin create role anon; exception when duplicate_object then null; end$$;
 do $$begin create role authenticated; exception when duplicate_object then null; end$$;
 do $$begin create role service_role; exception when duplicate_object then null; end$$;
 create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid(),auth.jwt() to authenticated;`);
 for(const file of readdirSync(resolve(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await a.ok(readFileSync(resolve(root,'supabase/migrations',file),'utf8'));
 await a.ok(`insert into organizations values(${lit(id.org)},'Laboratorio ficticio');
 insert into auth.users values(${lit(id.boss)},'boss@example.test',now()),(${lit(id.owner)},'owner@example.test',now()),(${lit(id.peer)},'peer@example.test',now());
 insert into profiles(id,organization_id,name,role,manager_id,sector,branch,position) values
 (${lit(id.boss)},${lit(id.org)},'Jefe ficticio','jefe',null,'Test','Test','Test'),
 (${lit(id.owner)},${lit(id.org)},'A ficticio','empleado',${lit(id.boss)},'Test','Test','Test'),
 (${lit(id.peer)},${lit(id.org)},'B ficticio','empleado',${lit(id.boss)},'Test','Test','Test');
 insert into companies values(${lit(id.company)},${lit(id.org)},'Empresa ficticia');
 insert into teams values(${lit(id.team)},${lit(id.org)},'Equipo ficticio',${lit(id.boss)});
 insert into company_memberships values(${lit(id.org)},${lit(id.company)},${lit(id.owner)}),(${lit(id.org)},${lit(id.company)},${lit(id.peer)});
 insert into team_members values(${lit(id.org)},${lit(id.team)},${lit(id.owner)}),(${lit(id.org)},${lit(id.team)},${lit(id.peer)});
 insert into report_settings(organization_id,recipient_id,updated_by) values(${lit(id.org)},${lit(id.boss)},${lit(id.boss)});
 insert into task_assignments(id,organization_id,company_id,owner_id,team_id,title,kind,weight,frequency,start_month,due_day,checklist)
 values(${lit(id.assignment)},${lit(id.org)},${lit(id.company)},${lit(id.owner)},${lit(id.team)},'Tarea A','resultado',5,'mensual',${month},15,'[]'),
 (${lit(id.assignment2)},${lit(id.org)},${lit(id.company)},${lit(id.peer)},${lit(id.team)},'Tarea B','resultado',5,'mensual',${month},15,'[]');
 insert into task_instances(id,organization_id,assignment_id,company_id,owner_id,team_id,period,scheduled_on,title,kind,weight,checklist)
 values(${lit(id.task)},${lit(id.org)},${lit(id.assignment)},${lit(id.company)},${lit(id.owner)},${lit(id.team)},${month},${month},'Tarea A','resultado',5,'[]'),
 (${lit(id.task2)},${lit(id.org)},${lit(id.assignment2)},${lit(id.company)},${lit(id.peer)},${lit(id.team)},${month},${month},'Tarea B','resultado',5,'[]');`);
}
async function joint(a,both=false) {
 await a.ok(`reset role;update task_assignments set frequency='unica';`);
 await a.ok(actor(id.boss)); await a.ok(assign(id.task));if(both)await a.ok(assign(id.task2));
}
async function plan(a,recurring=false,approved=false) {
 await a.ok(`reset role;insert into task_coverage_plans(id,organization_id,responsible_id,replacement_id,starts_on,ends_on,kind,created_by,handover_note) values(${lit(id.plan)},${lit(id.org)},${lit(id.owner)},${lit(id.peer)},${month},(${month}+interval '1 month - 1 day')::date,'licencia',${lit(id.boss)},'Ficticio');`);
 if(recurring)await a.ok(`insert into task_coverage_plan_assignment_rules(plan_id,organization_id,assignment_id,company_id_snapshot,assignment_snapshot) select ${lit(id.plan)},organization_id,id,company_id,to_jsonb(a) from task_assignments a where id=${lit(id.assignment)};`);
 else await a.ok(`insert into task_coverage_plan_instances(plan_id,organization_id,instance_id,company_id_snapshot,period_snapshot) select ${lit(id.plan)},organization_id,id,company_id,period from task_instances where id=${lit(id.task)};`);
 await a.ok(`update task_coverage_plans set sealed=true,sealed_by=${lit(id.boss)},sealed_at=clock_timestamp() where id=${lit(id.plan)};`);
 if(approved){await a.ok(actor(id.boss));await a.ok(sql('approve_task_coverage_plan',lit(id.plan),op()));}
}
async function onboarding(a,standard=false) {
 await a.ok('reset role;');
 if(standard)await a.ok(`insert into task_templates(id,organization_id,title,kind,weight,checklist) values(${lit(id.template)},${lit(id.org)},'Estándar','resultado',5,'["Revisar"]');
 insert into task_template_versions(id,organization_id,template_id,version,title,objective,sector,kind,weight,checklist) values(${lit(id.version)},${lit(id.org)},${lit(id.template)},1,'Estándar','Objetivo','Test','resultado',5,'["Revisar"]');`);
 const dates=await a.ok(`select (${month})::text;`);
 const payload={lines:[{line_id:uid(301),company_id:id.company,team_id:id.team,frequency:'mensual',start_date:dates.at(-1),interval_count:1,month_day:10,has_deadline:false,due_offset_days:0,...(standard?{template_version_id:id.version}:{custom_title:'Tarea ficticia',kind:'resultado',checklist:['Revisar']})}]};
 await a.ok(`insert into onboarding_requests(id,organization_id,owner_id,status,current_revision,draft_payload,submitted_at) values(${lit(id.request)},${lit(id.org)},${lit(id.owner)},'submitted',1,${lit(JSON.stringify(payload))}::jsonb,now());
 insert into onboarding_request_versions(organization_id,request_id,revision,payload,submitted_by) values(${lit(id.org)},${lit(id.request)},1,${lit(JSON.stringify(payload))}::jsonb,${lit(id.owner)});`);
}
const onboard=()=>sql('approve_onboarding',lit(id.request),'1',`${lit(JSON.stringify({[uid(301)]:5}))}::jsonb`);
const binding=`(select id from public.task_coverage_bindings where plan_id=${lit(id.plan)} and instance_id=${lit(id.task)} limit 1)`;
const cancel=()=>sql('cancel_task_coverage_binding',binding,"'Fin ficticio'",op());
const cases=[
 {name:'joint inverse anchors',setup:a=>joint(a,true),one:[id.owner,start(id.task)],two:[id.peer,start(id.task2)]},
 {name:'switch A to B and B to A',setup:async a=>{await joint(a,true);await a.ok(actor(id.owner));await a.ok(start(id.task));await a.ok(actor(id.peer));await a.ok(start(id.task2));},one:[id.owner,start(id.task2,true)],two:[id.peer,start(id.task,true)]},
 {name:'complete versus start',setup:async a=>{await joint(a);await a.ok(actor(id.owner));await a.ok(start(id.task));await a.ok(sql('pause_task_timer',`(select id from task_time_sessions where actor_id=${lit(id.owner)} and ended_at is null)`,op()));},one:[id.boss,sql('transition_task_reviewed',lit(id.task),"'Completada'","'Validación ficticia'",revision(id.task),op())],two:[id.peer,start(id.task)]},
 {name:'close versus start',setup:a=>joint(a),one:[id.boss,close()],two:[id.owner,start(id.task)]},
 {name:'close versus activity',setup:a=>a.ok(`reset role;update task_instances set kind='operativa',unit='facturas',target=40 where id=${lit(id.task)};`),one:[id.boss,close()],two:[id.owner,sql('record_activity_once',lit(id.task),'current_date','1',"'Ficticio'",op())]},
 {name:'close versus private note',setup:async()=>{},one:[id.boss,close()],two:[id.owner,sql('save_private_block_note',lit(id.task),"'Privado ficticio'",'0',op())]},
 {name:'materialize versus close',setup:async()=>{},one:[id.owner,materialize()],two:[id.boss,close()]},
 {name:'approve recurring rule versus materialize',setup:a=>plan(a,true),one:[id.boss,sql('approve_task_coverage_plan',lit(id.plan),op())],two:[id.owner,materialize()]},
 {name:'cancel coverage versus start',setup:a=>plan(a,false,true),one:[id.boss,cancel()],two:[id.peer,start(id.task)]},
 {name:'cancel coverage versus pause',setup:async a=>{await plan(a,false,true);await a.ok(actor(id.peer));await a.ok(start(id.task));},one:[id.boss,cancel()],two:[id.peer,sql('pause_task_timer',`(select id from task_time_sessions where actor_id=${lit(id.peer)} and ended_at is null)`,op())]},
 {name:'assign head versus close',setup:a=>a.ok("reset role;update task_assignments set frequency='unica';"),one:[id.boss,assign(id.task)],two:[id.boss,close()]},
 {name:'onboarding versus close',setup:a=>onboarding(a),one:[id.boss,onboard()],two:[id.boss,close()]},
 {name:'onboarding versus weight revision',setup:a=>onboarding(a,true),one:[id.boss,onboard()],two:[id.boss,sql('update_template_weight',lit(id.template),'7')]},
];
const results=[];const stamp=Date.now();
const trackedTables=['task_instances','task_assignments','task_time_sessions','task_responsibility_sets','task_responsibility_members','task_responsibility_heads','task_coverage_bindings','task_mutation_receipts','activity_entries','task_private_block_notes','private_block_note_receipts','audit_events','monthly_closures','period_reports','report_deliveries','report_outbox_events','onboarding_requests','onboarding_activations','task_templates','task_template_versions'];
const fingerprint=`select jsonb_build_object(${trackedTables.map(t=>`${lit(t)},(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]')::text) from public.${t} t)`).join(',')})::text;`;
for(const [index,test] of cases.entries())for(const reverse of [false,true]) {
 const database=`coordination_011_lab_${stamp}_${index}_${reverse?1:0}`;
 const admin=new Session('postgres');await admin.ok(`create database ${database};`);await admin.close();
 const a=new Session(database),b=new Session(database);
 try {
   await fixture(a);await b.ok("\\set VERBOSITY verbose\nselect 1;");await test.setup(a);
   await a.ok('reset role;');
   const bindingId=(await a.ok(`select id from public.task_coverage_bindings where plan_id=${lit(id.plan)} and instance_id=${lit(id.task)} limit 1;`)).at(-1);
   const resolveInput=([who,statement])=>[who,statement.includes(binding)?statement.replace(binding,lit(bindingId)):statement];
   const [first,second]=(reverse?[test.two,test.one]:[test.one,test.two]).map(resolveInput);
   const aid=Number((await a.ok('select pg_backend_pid();')).at(-1)),bid=Number((await b.ok('select pg_backend_pid();')).at(-1));
   await a.ok(actor(first[0]));await b.ok(actor(second[0]));
   await a.ok('begin;');await b.ok('begin;');
   await a.ok(first[1]);
   // Observe engine state as the disposable database owner; Auth roles cannot
   // inspect another backend's pg_stat_activity wait fields.
   await a.ok('reset role;');
   const beforeSecond=(await a.ok(fingerprint)).at(-1);
   const pending=b.query(second[1]);
   const deadline=Date.now()+10000;let blocked=false;
   while(Date.now()<deadline){
     const rows=await a.ok(`select exists(select 1 from pg_catalog.pg_stat_activity s join pg_catalog.pg_locks l on l.pid=s.pid where s.pid=${bid} and s.wait_event_type='Lock' and not l.granted and ${aid}=any(pg_catalog.pg_blocking_pids(s.pid)));`);
     if(rows.at(-1)==='t'){blocked=true;break;}
     await new Promise(done=>setImmediate(done));
   }
   if(!blocked){await a.ok('rollback;');const r=await pending;throw Error(`No se observó barrera: ${r.code} ${r.errors}`);}
   await a.ok('commit;');const r=await pending;
   assert.ok(['00000','40001'].includes(r.code),`${test.name}: ${r.code} ${r.errors}`);
   await b.ok(r.code==='00000'?'commit;':'rollback;');
   await a.ok('reset role;');
   if(r.code==='40001')assert.equal((await a.ok(fingerprint)).at(-1),beforeSecond,'Rollback completo sin evidencia/receipt/outbox parcial');
   const unique=await a.ok('select count(*)=count(distinct (actor_id,operation_id)) from task_mutation_receipts;');assert.equal(unique.at(-1),'t');
   const outbox=await a.ok('select (select count(*) from monthly_closures)=(select count(*) from period_reports) and (select count(*) from period_reports)=(select count(*) from report_outbox_events);');assert.equal(outbox.at(-1),'t');
   const row={case:test.name,order:reverse?'BA':'AB',blocked:true,secondSQLSTATE:r.code,database};results.push(row);console.log(JSON.stringify(row));
 }finally{await a.close();await b.close();}
}
const report={engine:'PostgreSQL',generatedAt:new Date().toISOString(),scenarios:results.length,passed:results.length,results};
if(output)writeFileSync(output,JSON.stringify(report,null,2));
console.log(`PASS ${results.length}/${results.length}; pg_locks barriers, no 40P01.`);
