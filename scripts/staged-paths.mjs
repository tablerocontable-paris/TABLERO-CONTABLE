import { spawnSync } from 'node:child_process';

export function findPartiallyStagedPaths(stagedPaths, unstagedPaths) {
  const unstaged = new Set(unstagedPaths);
  return [...new Set(stagedPaths)].filter((path) => unstaged.has(path)).sort();
}

export function getPartiallyStagedPaths(cwd = process.cwd()) {
  const gitPaths = (args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
    return result.stdout.split('\0').filter(Boolean);
  };
  return findPartiallyStagedPaths(
    gitPaths(['diff', '--cached', '--name-only', '-z']),
    gitPaths(['diff', '--name-only', '-z']),
  );
}
