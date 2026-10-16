import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const current = spawnSync('git', ['config', '--local', '--get', 'core.hooksPath'], { encoding: 'utf8' });
if (current.error || ![0, 1].includes(current.status)) {
  console.error('No se pudo consultar la configuración de Git.');
  process.exit(1);
}
if (current.stdout.trim() && current.stdout.trim() !== '.githooks') {
  console.error('Existe una ruta de hooks personalizada; integrar antes de reemplazarla.');
  process.exit(1);
}
const installed = spawnSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
if (installed.status !== 0) process.exit(installed.status ?? 1);
console.log('Pre-commit activado para este checkout.');
