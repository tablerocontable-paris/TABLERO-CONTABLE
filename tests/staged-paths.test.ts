import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findPartiallyStagedPaths, getPartiallyStagedPaths } from '../scripts/staged-paths.mjs';

function git(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
}

describe('protección contra archivos parcialmente staged', () => {
  it('detecta rutas staged que volvieron a modificarse, incluidas rutas con espacios', () => {
    expect(findPartiallyStagedPaths(
      ['src/App.tsx', 'docs/plan de entrega.md', 'src/App.tsx'],
      ['docs/plan de entrega.md', 'tests/domain.test.ts'],
    )).toEqual(['docs/plan de entrega.md']);
  });

  it('permite cambios staged sin modificaciones posteriores', () => {
    expect(findPartiallyStagedPaths(
      ['src/App.tsx', 'tests/domain.test.ts'],
      ['docs/PROJECT-STATUS.md'],
    )).toEqual([]);
  });

  it('detecta archivos staged y modificados en un repositorio real de prueba', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'grupo-paris-staged-'));
    try {
      git(root, ['init', '--quiet']);
      git(root, ['config', 'user.name', 'Laboratorio']);
      git(root, ['config', 'user.email', 'lab@example.test']);
      const file = path.join(root, 'modulo con espacios.ts');
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, 'base\n');
      git(root, ['add', 'modulo con espacios.ts']);
      writeFileSync(file, 'base\nstaged\n');
      git(root, ['add', 'modulo con espacios.ts']);
      writeFileSync(file, 'base\nstaged\nunstaged\n');
      expect(getPartiallyStagedPaths(root)).toEqual(['modulo con espacios.ts']);
    } finally {
      const base = path.resolve(tmpdir()) + path.sep;
      const target = path.resolve(root);
      if (!target.startsWith(base) || !path.basename(target).startsWith('grupo-paris-staged-')) {
        throw new Error('Refusing to clean an unexpected test directory.');
      }
      rmSync(target, { recursive: true, force: true });
    }
  });

  it('el pre-commit aborta antes de ejecutar otras validaciones si el snapshot está mezclado', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'grupo-paris-hook-'));
    try {
      git(root, ['init', '--quiet']);
      git(root, ['config', 'user.name', 'Laboratorio']);
      git(root, ['config', 'user.email', 'lab@example.test']);
      const scripts = path.join(root, 'scripts');
      mkdirSync(scripts);
      copyFileSync(new URL('../scripts/validate-change.mjs', import.meta.url), path.join(scripts, 'validate-change.mjs'));
      copyFileSync(new URL('../scripts/staged-paths.mjs', import.meta.url), path.join(scripts, 'staged-paths.mjs'));
      const file = path.join(root, 'modulo con espacios.ts');
      writeFileSync(file, 'base\n');
      git(root, ['add', 'modulo con espacios.ts']);
      writeFileSync(file, 'base\nstaged\n');
      git(root, ['add', 'modulo con espacios.ts']);
      writeFileSync(file, 'base\nstaged\nunstaged\n');

      const result = spawnSync(process.execPath, [path.join(scripts, 'validate-change.mjs')], {
        cwd: root,
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('No se puede validar un commit parcial');
      expect(result.stderr).toContain('modulo con espacios.ts');
    } finally {
      const base = path.resolve(tmpdir()) + path.sep;
      const target = path.resolve(root);
      if (!target.startsWith(base) || !path.basename(target).startsWith('grupo-paris-hook-')) {
        throw new Error('Refusing to clean an unexpected test directory.');
      }
      rmSync(target, { recursive: true, force: true });
    }
  });
});
