import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Checks the working tree; GitHub must also validate the exact pushed commit.
run('git', ['diff', '--cached', '--check']);
run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']);
run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run',
  'tests/domain.test.ts', 'tests/parameterization.test.ts',
  'tests/laboratory-corrections.test.tsx', 'tests/notifications.test.ts',
  'tests/fiscal-obligations.test.ts', 'tests/fiscal-obligations-ui.test.tsx',
  'tests/scheduling-workforce.test.ts', 'tests/workforce-retirement.test.tsx',
  'tests/process-improvement.test.ts', 'tests/site-operational.test.ts',
  'tests/habitual-task-proposals.test.ts', 'tests/habitual-task-onboarding.test.tsx',
  'tests/habitual-task-proposals-ui.test.tsx', 'tests/habitual-task-app.test.tsx',
  '--maxWorkers=1']);
