// Acceptance runner: each exact current regression is isolated in its own Vitest process.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import contract from "../../scripts/verification-contract.cjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outputArg = process.argv.indexOf("--output-dir");
const output = outputArg >= 0
  ? path.resolve(process.argv[outputArg + 1] || "")
  : path.join(root, "outputs", `time-coverage-008-isolation-${timestamp}-${process.pid}`);
const reportPath = path.join(output, "isolation-run.json");
const groups = [
  ["tests/time-coverage-008.test.ts", [
    "control ya igual con segundo paso pendiente no toca otro reloj cerrado ni audita",
    "retiro de membresía mientras espera el guard deniega operación nueva y revierte la inyección",
    "sello FALSE niega RLS y todas las escrituras; TRUE limita empresa y período sin afectar acceso permanente",
    "operativa no autocompleta, auditoría de pausa compara fin real y ACL/DML siguen privados",
  ]],
  ["tests/database.test.ts", [
    "empleado ve su tarea y no puede cambiar pesos ni su rol",
    "otro tenant no ve ni modifica",
    "cierre exige responsable con MFA y conserva snapshot servidor",
  ]],
];

const runs = [];
let fatalError = null;
let sourceTree = null;
let sourceHead = null;
let canWriteReport = false;

try {
  if (outputArg >= 0 && !process.argv[outputArg + 1]) throw new Error("--output-dir requiere una ruta.");
  if (existsSync(output)) throw new Error(`La carpeta ya existe; no se sobrescriben artefactos: ${output}`);
  mkdirSync(output, { recursive: true });
  canWriteReport = true;
  sourceTree = contract.effectiveTreeHash(root);
  sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const vitest = path.join(root, "node_modules", "vitest", "vitest.mjs");
  for (const [file, patterns] of groups) {
    for (const pattern of patterns) {
      const id = `${path.basename(file, ".test.ts")}-${String(runs.length + 1).padStart(2, "0")}`;
      const jsonPath = path.join(output, `${id}.vitest.json`);
      const args = [vitest, "run", file, "-t", pattern, "--exclude", "tmp/**", "--reporter=json", `--outputFile=${jsonPath}`];
      const child = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", timeout: 180000, maxBuffer: 30 * 1024 * 1024 });
      let json = null;
      let parseError = null;
      try { json = JSON.parse(readFileSync(jsonPath, "utf8")); }
      catch (error) { parseError = error instanceof Error ? error.message : String(error); }
      const verdict = contract.evaluateIsolatedRun({ processStatus: child.status, report: json, expectedPattern: pattern });
      runs.push({ id, file, expectedPattern: pattern, command: ["node", ...args], process: { status: child.status, signal: child.signal, error: child.error?.message || null }, reporter: { path: path.basename(jsonPath), parseError }, ...verdict });
      writeFileSync(reportPath, JSON.stringify({ schemaVersion: 2, status: "running", sourceHead, sourceTree, outputDirectory: output, runs }, null, 2));
      console.log(JSON.stringify({ id, passed: verdict.passed, counts: verdict.counts, reasons: verdict.reasons }));
      if (child.stdout) process.stdout.write(child.stdout);
      if (child.stderr) process.stderr.write(child.stderr);
    }
  }
} catch (error) {
  fatalError = error instanceof Error ? error.stack || error.message : String(error);
} finally {
  const totals = runs.reduce((sum, run) => ({
    executed: sum.executed + run.counts.executed,
    passed: sum.passed + run.counts.passed,
    skipped: sum.skipped + run.counts.skipped,
    failed: sum.failed + run.counts.failed,
  }), { executed: 0, passed: 0, skipped: 0, failed: 0 });
  const passed = !fatalError && runs.length === groups.reduce((sum, [, patterns]) => sum + patterns.length, 0) && runs.every((run) => run.passed) && totals.passed > 0;
  const report = { schemaVersion: 2, status: passed ? "passed" : "failed", acceptance: passed, sourceHead, sourceTree, outputDirectory: output, totals, fatalError, runs };
  if (canWriteReport) {
    writeFileSync(reportPath, JSON.stringify(report, null, 2), { flag: "w" });
    console.log(JSON.stringify({ status: report.status, acceptance: report.acceptance, reportPath, totals, fatalError }, null, 2));
  } else {
    console.error(JSON.stringify({ status: "failed", acceptance: false, fatalError }, null, 2));
  }
  if (!passed) process.exitCode = 1;
}
