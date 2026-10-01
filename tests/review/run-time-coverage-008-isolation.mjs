// Aislamiento: procesos Vitest separados; sólo fixtures locales.
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const source_sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const groups=[
 ['tests/time-coverage-008.test.ts',[
 'un checklist sin cambios',
 'la espera registra el contexto',
 'transición con dos sesiones',
 'reporte de período calcula',
 'rechaza cobertura sin sello',
 'mantiene el helper interno']],
 ['tests/database.test.ts',[
 'reportes privados, destinatario verificado',
 'la entrega respeta lease',
 'un destinatario inválido o cronómetro activo',
 'cinco fallos agotan reintentos']]
];
const results=[];
for(const [file,patterns] of groups) for(const pattern of patterns) {
 const args=['node_modules/vitest/vitest.mjs','run',file,'-t',pattern];
 const r=spawnSync(process.execPath,args,{encoding:'utf8'});
 const output=r.stdout+r.stderr;
 results.push({source_sha,file,pattern,command:['node',...args],exit_code:r.status,summary:output.split('\n').filter(line=>/Test Files|Tests |Duration|FAIL|Error/.test(line)).map(line=>line.trim())});
 if(r.status!==0) process.stdout.write(output);
 console.log(JSON.stringify({file,pattern,passed:r.status===0}));
}
writeFileSync('review-evidence/time-coverage-008-isolation-20261001.jsonl',results.map(r=>JSON.stringify(r)).join('\n')+'\n');
if(results.some(r=>r.exit_code!==0)) process.exitCode=1;
