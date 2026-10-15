// Native R6 preflight review against an already migrated disposable fixture cluster.
// Loopback only. No hosted services, installations, source rewrites, or real data.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const flags = Object.fromEntries(process.argv.slice(2).reduce((rows, value, i, all) => i % 2 ? rows : [...rows,[value,all[i+1]]],[]));
for (const key of ['--pg-bin','--cluster','--output-dir']) if (!flags[key]) throw Error(`${key} required`);
const bin=resolve(flags['--pg-bin']), cluster=resolve(flags['--cluster']), out=resolve(flags['--output-dir']), port=flags['--port'] ?? '55483';
if (!/^\d{4,5}$/.test(port)) throw Error('Invalid loopback port');
mkdirSync(out,{recursive:true});
const exe=name=>join(bin,`${name}${process.platform==='win32'?'.exe':''}`);
const psqlArgs=['-X','-q','-A','-t','-h','127.0.0.1','-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'];
const sql=input=>{
  try { return {code:'00000',stdout:execFileSync(exe('psql'),psqlArgs,{input,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe']}).trim()}; }
  catch(error) { const stderr=String(error.stderr??'');return {code:stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??'unknown',stderr,stdout:String(error.stdout??'')}; }
};
const uid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const actor=uid(2),task=uid(26),operation=uid(990001);
const claims=`select set_config('request.jwt.claim.sub','${actor}',false),set_config('request.jwt.claims','${JSON.stringify({sub:actor,role:'authenticated',aal:'aal1'})}',false);`;
const command={contractVersion:1,operationId:operation,kind:'operation.record',expectedRevisions:{[`task:${task}`]:null},payload:{taskId:task,workDate:'2026-10-15',quantity:1,reference:null}};
const query={contractVersion:1,kind:'activityPage',filters:{taskId:task},cursor:'!!!',limit:10};
const callCommand=`select api.command_v1('${JSON.stringify(command)}'::jsonb);`;
const callQuery=`select api.query_v1('${JSON.stringify(query)}'::jsonb);`;
const snapshot=`select jsonb_build_object(
 'taskRevision',(select state_revision::text from public.task_instances where id='${task}'),
 'activity',(select coalesce(jsonb_agg(jsonb_build_array(id::text,quantity::text,created_at::text) order by id),'[]'::jsonb) from public.activity_entries where instance_id='${task}'),
 'receipts',(select coalesce(jsonb_agg(jsonb_build_array(actor_id::text,operation_id::text,kind,created_at::text) order by actor_id,operation_id),'[]'::jsonb) from app_private.api_command_receipts),
 'operationFences',(select coalesce(jsonb_agg(jsonb_build_array(actor_id::text,operation_id::text,fence_epoch::text) order by actor_id,operation_id),'[]'::jsonb) from app_private.api_operation_fences),
 'monthFences',(select coalesce(jsonb_agg(jsonb_build_array(owner_id::text,period::text,fence_epoch::text) order by owner_id,period),'[]'::jsonb) from app_private.api_month_fences),
 'rateHeads',(select coalesce(jsonb_agg(jsonb_build_array(id::text,config_revision::text,fence_epoch::text) order by id),'[]'::jsonb) from app_private.operational_rate_heads),
 'assessments',(select coalesce(jsonb_agg(jsonb_build_array(instance_id::text,revision::text) order by instance_id),'[]'::jsonb) from app_private.operational_assessments),
 'assessmentVersions',(select coalesce(jsonb_agg(jsonb_build_array(id::text,instance_id::text,revision::text) order by instance_id,revision),'[]'::jsonb) from app_private.operational_assessment_versions)
)::text;`;
const results=[];
const check=(name,expected,observed,details={})=>{const row={name,passed:expected===observed,expected,observed,...details};results.push(row);console.log(JSON.stringify(row));};
const contested=async(lock,call)=>{
  const child=spawn(exe('psql'),psqlArgs,{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';
  const closed=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error(`blocker failed ${code}: ${stderr}`)));});
  let timer;
  const ready=new Promise((resolve,reject)=>{
    timer=setTimeout(()=>reject(Error('blocker readiness timeout')),5000);
    child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.includes('R6_READY'))resolve();});
    child.stderr.on('data',chunk=>{stderr+=chunk;});
    child.on('error',reject);
  });
  child.stdin.write(`${claims}\nbegin;\n${lock};\n\\echo R6_READY\n`);
  try { await ready; clearTimeout(timer); const result=sql(`${claims}\nset lock_timeout='250ms';set role authenticated;${call}`);child.stdin.end('rollback;\n');await closed;return result; }
  catch(error) { clearTimeout(timer);child.kill();await closed.catch(()=>{});throw error; }
};
let started=false;
try {
  execFileSync(exe('pg_ctl'),['-D',cluster,'-l',join(out,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start'],{windowsHide:true,stdio:'ignore'});started=true;
  const activate=sql(`update public.profiles set active=true where id='${actor}';`);
  if(activate.code!=='00000')throw Error(JSON.stringify(activate));
  const before=sql(snapshot);if(before.code!=='00000')throw Error(JSON.stringify(before));
  check('native helper rejects NULL member in expected key set','f',sql(`select app_private.api_exact_keys('{"a":1,"b":2}'::jsonb,array['a',null]::text[]);`).stdout);
  check('native malformed revision without contention returns 22023','22023',sql(`${claims}set role authenticated;${callCommand}`).code);
  const recordResult=await contested(`select public._coordination_receipt_lock('${actor}','${operation}')`,callCommand);
  check('native malformed revision rejects before occupied receipt lock','22023',recordResult.code,{error:recordResult.stderr});
  check('native malformed cursor without contention returns 22023','22023',sql(`${claims}set role authenticated;${callQuery}`).code);
  const queryResult=await contested(`select id from public.task_instances where id='${task}' for update`,callQuery);
  check('native malformed cursor rejects before occupied task lock','22023',queryResult.code,{error:queryResult.stderr});
  const after=sql(snapshot);check('native rejected inputs preserve state',before.stdout,after.stdout);
} finally {
  if(started)execFileSync(exe('pg_ctl'),['-D',cluster,'-m','fast','-w','stop'],{windowsHide:true,stdio:'ignore'});
}
const report={scope:'Native PostgreSQL R6 preflight contention review; disposable fixture',engine:execFileSync(exe('postgres'),['--version'],{encoding:'utf8',windowsHide:true}).trim(),total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,results,migration014Sha256:createHash('sha256').update(readFileSync('supabase/migrations/202610150014_operational_api.sql')).digest('hex')};
writeFileSync(join(out,'review.json'),JSON.stringify(report,null,2)+'\n');
process.exitCode=report.failed?1:0;
