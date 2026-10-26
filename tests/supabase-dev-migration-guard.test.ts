import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BASELINE_COUNT,
  MIGRATIONS,
  createStage,
  validateDryRun,
  validateHistory,
  verifySql015ReviewAcceptance,
  verifySql016ReviewAcceptance,
} from "../scripts/supabase-dev-migration-guard.mjs";

const temporaryRoots: string[] = [];
afterEach(async () => {
  for (const directory of temporaryRoots.splice(0)) {
    const resolved = path.resolve(directory);
    if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error("Temporary test cleanup escaped the temp directory.");
    await rm(resolved, { recursive: true, force: true });
  }
});

const rows = (localCount: number, remoteCount: number) => Array.from({ length: localCount }, (_, index) => ({
  local: MIGRATIONS[index][0].slice(0, 12),
  remote: index < remoteCount ? MIGRATIONS[index][0].slice(0, 12) : "",
  time: "",
}));

describe("Supabase DEV migration guard", () => {
  it("checks empty baseline before apply and exact 16→16 baseline after apply", () => {
    expect(validateHistory({ migrations: rows(BASELINE_COUNT, 0) }, "baseline_001_014")).toEqual({ local: 16, remote: 0 });
    expect(validateHistory({ migrations: rows(BASELINE_COUNT, BASELINE_COUNT) }, "baseline_001_014", "after")).toEqual({ local: 16, remote: 16 });
    expect(validateHistory({ migrations: rows(17, 16) }, "apply_015")).toEqual({ local: 17, remote: 16 });
    expect(() => validateHistory({ migrations: rows(17, 15) }, "apply_015")).toThrow();
    expect(() => validateHistory({ migrations: rows(17, 17) }, "apply_015")).toThrow();
    expect(validateHistory({ migrations: rows(18, 17) }, "apply_016")).toEqual({ local: 18, remote: 17 });
    expect(() => validateHistory({ migrations: rows(18, 16) }, "apply_016")).toThrow();
    expect(() => validateHistory({ migrations: rows(18, 18) }, "apply_016")).toThrow();
  });

  it("requires the exact pending version list for each dry-run", () => {
    const baselineFiles = MIGRATIONS.slice(0, BASELINE_COUNT).map(([name]) => name);
    const baseline = baselineFiles.map((name) => name.slice(0, 12));
    const v015 = MIGRATIONS[BASELINE_COUNT][0].slice(0, 12);
    const cliOutput = (files: string[]) => `Would push these migrations:\n${files.map((file) => ` • ${file}`).join("\n")}\nFinished supabase db push.`;
    expect(validateDryRun(cliOutput(baselineFiles), "baseline_001_014")).toEqual(baseline);
    expect(validateDryRun(cliOutput([MIGRATIONS[BASELINE_COUNT][0]]), "apply_015")).toEqual([v015]);
    expect(validateDryRun(cliOutput([MIGRATIONS[BASELINE_COUNT + 1][0]]), "apply_016")).toEqual([MIGRATIONS[BASELINE_COUNT + 1][0].slice(0, 12)]);
    expect(() => validateDryRun(cliOutput([...baselineFiles, MIGRATIONS[BASELINE_COUNT][0]]), "baseline_001_014")).toThrow();
    expect(() => validateDryRun(cliOutput([MIGRATIONS[0][0]]), "baseline_001_014")).toThrow();
    expect(() => validateDryRun(cliOutput([...baselineFiles, baselineFiles[0]]), "baseline_001_014")).toThrow();
    expect(() => validateDryRun(cliOutput([...baselineFiles].reverse()), "baseline_001_014")).toThrow();
  });

  it("builds an isolated CLI project that cannot see SQL015 in the baseline stage", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "supabase-dev-stage-test-"));
    temporaryRoots.push(temp);
    const root = path.resolve(process.cwd());
    const stage = path.join(temp, "baseline");
    await createStage(root, stage, "baseline_001_014");
    const staged = (await readdir(path.join(stage, "supabase", "migrations"))).sort();
    expect(staged).toHaveLength(BASELINE_COUNT);
    expect(staged.at(-1)).toBe("202610150014_operational_api.sql");
    expect(staged).not.toContain("202610230015_workspace_page.sql");
    const config = await readFile(path.join(stage, "supabase", "config.toml"), "utf8");
    expect(config).toContain("major_version = 17");
  });

  it("keeps baseline_001_014 and apply_015 isolated from SQL016", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "supabase-dev-stage-016-test-"));
    temporaryRoots.push(temp);
    const root = path.resolve(process.cwd());
    const stage = path.join(temp, "apply-015");
    await createStage(root, stage, "apply_015");
    const staged = await readdir(path.join(stage, "supabase", "migrations"));
    expect(staged).toHaveLength(BASELINE_COUNT + 1);
    expect(staged).toContain("202610230015_workspace_page.sql");
    expect(staged).not.toContain("202610260016_manager_task_revocation.sql");
  });

  it("requires a separate Sol code/hash acceptance and rejects the contract acceptance or a wrong hash", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "supabase-015-acceptance-test-"));
    temporaryRoots.push(temp);
    const architecture = path.join(temp, "docs", "architecture");
    await mkdir(architecture, { recursive: true });
    const contractHash = "42849A545D2B63DCFB0507592FB696F19AD070A4FD4C8B926ACB2E76B018E96D";
    await writeFile(path.join(architecture, "REMOTE-WORKSPACE-BOOTSTRAP-SOL-ACCEPTANCE-20261023.md"),
      `Dictamen: **apto para implementación local de la migración aditiva 015**\nContrato SHA-256: ${contractHash}\n`);
    await expect(verifySql015ReviewAcceptance(temp)).rejects.toThrow("aceptación Sol del hash exacto");

    const expected = MIGRATIONS[BASELINE_COUNT][1];
    const codeAcceptance = path.join(architecture, "REMOTE-WORKSPACE-015-CODE-SOL-ACCEPTANCE-20261023.md");
    await writeFile(codeAcceptance, `Dictamen: **apto para aplicar SQL015 en grupo-paris-dev**\nSQL015 SHA-256: \`${"0".repeat(64)}\`\n`);
    await expect(verifySql015ReviewAcceptance(temp)).rejects.toThrow("aceptación Sol del hash exacto");
    await writeFile(codeAcceptance, `Dictamen: **apto para aplicar SQL015 en grupo-paris-dev**\nSQL015 SHA-256: \`${expected}\`\n`);
    await expect(verifySql015ReviewAcceptance(temp)).resolves.toBeUndefined();
  });

  it("accepts SQL016 for application only when its exact separate hash acceptance exists", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "supabase-016-acceptance-test-"));
    temporaryRoots.push(temp);
    const architecture = path.join(temp, "docs", "architecture");
    await mkdir(architecture, { recursive: true });
    await expect(verifySql016ReviewAcceptance(temp)).rejects.toThrow("sigue deshabilitada");
    const file = path.join(architecture, "REMOTE-WORKSPACE-016-CODE-SOL-ACCEPTANCE-20261026.md");
    const expected = MIGRATIONS[BASELINE_COUNT + 1][1];
    await writeFile(file, `Dictamen: **apto para aplicar SQL016 en grupo-paris-dev**\nSQL016 SHA-256: \`${"0".repeat(64)}\`\n`);
    await expect(verifySql016ReviewAcceptance(temp)).rejects.toThrow("sigue deshabilitada");
    await writeFile(file, `Dictamen: **apto para aplicar SQL016 en grupo-paris-dev**\nSQL016 SHA-256: \`${expected}\`\n`);
    await expect(verifySql016ReviewAcceptance(temp)).resolves.toBeUndefined();
  });
});
