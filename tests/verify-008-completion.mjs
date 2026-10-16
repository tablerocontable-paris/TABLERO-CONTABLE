// Critical cases each run in a fresh Vitest process. Zero selected tests FAILS.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const groups=[
 ['tests/time-coverage-008.test.ts',[
  'control ya igual con segundo paso pendiente',
  'cambio real que inicia con origen cerrado',
  'espera vencida por fecha',
  'espera vencida por cancelación',
  'transition: origen vencido y destino con cortes distintos',
  'checklist: origen vencido y destino con cortes distintos',
  'transition: origen vencido sin reloj destino',
  'checklist: origen vencido sin reloj destino',
  'start: rechazo posterior',
  'pause: cambio de identidad',
  'checklist: inicio recalculado fuera del plan',
  'transition: inicio recalculado fuera del plan',
  'retiro de membresía mientras espera',
  'sello FALSE niega RLS',
  'replay escalar conserva excepción',
  'operativa no autocompleta',
 ]],
 ['tests/report-isolation-008.test.ts',[
  'reportes privados, destinatario verificado',
  'cierre fija 1800 segundos',
  'cierre bloqueado por recipient',
  'cierre bloqueado por open_timer',
  'la entrega respeta lease',
  'cinco fallos agotan reintentos',
 ]],
 ['tests/upgrades-008.test.ts',[
  '0.3→001–008',
  '004→008 conserva',
  '007→008 conserva',
  '004 rechaza multiple',
  '006 rechaza after_cutoff',
 ]],
 ['tests/annotations-tour-app.test.tsx',[
  'fin de inducción abre Mi día',
  'Listo guarda finalización',
  'fallo al abrir recorrido',
  'fallo al cerrar recorrido',
  'editar nota con guardado fallido',
 ]],
];
const source_base=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const hashFiles=['supabase/migrations/202610010008_time_coverage_finalization.sql','tests/helpers/accounting-lab.ts',...groups.map(g=>g[0])];
const codeHash=createHash('sha256');for(const f of hashFiles)codeHash.update(f+'\n').update(readFileSync(f));
const source_hash=codeHash.digest('hex'),tmp=mkdtempSync(join(tmpdir(),'008-critical-')),results=[];
for(const [file,patterns] of groups) for(const pattern of patterns) {
 const output=join(tmp,`result-${results.length}.json`);
 const literal=pattern.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const args=['node_modules/vitest/vitest.mjs','run',file,'-t',literal,'--reporter=json','--outputFile='+output];
 const r=spawnSync(process.execPath,args,{encoding:'utf8'});
 let report;try {report=JSON.parse(readFileSync(output,'utf8'));} catch {report=null;}
 const passed=r.status===0&&report?.success===true&&report.numPassedTests===1&&report.numFailedTests===0;
 const result={source_base,source_hash,file,pattern,command:['node',...args],exit_code:r.status,selected_passed:report?.numPassedTests??0,selected_failed:report?.numFailedTests??null,passed};
 results.push(result);console.log(JSON.stringify(result));
 if(!passed)process.stderr.write((r.stdout+r.stderr).slice(-6000));
}
writeFileSync('review-evidence/time-coverage-008-completion-isolation-20261001.jsonl',results.map(r=>JSON.stringify(r)).join('\n')+'\n');
if(results.some(r=>!r.passed))process.exitCode=1;
