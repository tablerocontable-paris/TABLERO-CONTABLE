import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getPartiallyStagedPaths } from './staged-paths.mjs';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
let partiallyStaged;
try {
  partiallyStaged = getPartiallyStagedPaths();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
if (partiallyStaged.length) {
  console.error('No se puede validar un commit parcial: hay archivos staged y modificados después del stage.');
  for (const path of partiallyStaged) console.error(`  ${path}`);
  process.exit(1);
}
// Checks the working tree after rejecting partially staged tracked files;
// GitHub still validates the exact pushed commit.
run('git', ['diff', '--cached', '--check']);
run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']);
run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run',
  'tests/domain.test.ts', 'tests/parameterization.test.ts',
  'tests/laboratory-corrections.test.tsx', 'tests/notifications.test.ts',
  'tests/laboratory-backup.test.tsx',
  'tests/task-evidence-concurrency.test.tsx',
  'tests/fiscal-obligations.test.ts', 'tests/fiscal-obligations-ui.test.tsx',
  'tests/scheduling-workforce.test.ts', 'tests/workforce-retirement.test.tsx',
  'tests/process-improvement.test.ts', 'tests/site-operational.test.ts',
  'tests/staged-paths.test.ts',
  'tests/habitual-task-proposals.test.ts', 'tests/habitual-task-onboarding.test.tsx',
  'tests/habitual-task-proposals-ui.test.tsx', 'tests/habitual-task-app.test.tsx',
  'tests/deadline-notifications.test.ts', 'tests/deadline-notifications-ui.test.tsx',
  '--maxWorkers=1', '--exclude', 'tmp/**']);
