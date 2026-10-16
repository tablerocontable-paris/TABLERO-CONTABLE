import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import contract from "../scripts/verification-contract.cjs";

describe("gates de rendimiento", () => {
  it("aplica p95 inclusivo por rango más cercano y exige menor a 1.000 ms", () => {
    expect(contract.evaluateBenchmark({ samples: Array(30).fill(999) }).passed).toBe(true);
    expect(contract.evaluateBenchmark({ samples: Array(30).fill(1000) })).toMatchObject({
      passed: false,
      p95Ms: 1000,
    });
    expect(contract.evaluateBenchmark({ samples: Array(30).fill(1500) }).passed).toBe(false);
  });

  it("rechaza cantidad incorrecta, datos no finitos, errores y llamadas operativas", () => {
    expect(contract.evaluateBenchmark({ samples: [] }).passed).toBe(false);
    expect(contract.evaluateBenchmark({ samples: [Number.NaN] }).p95Ms).toBeNull();
    expect(contract.evaluateBenchmark({ samples: Array(30).fill(10), pageErrors: ["error"] }).passed).toBe(false);
    expect(contract.evaluateBenchmark({ samples: Array(30).fill(10), apiCalls: ["/api/tasks"] }).passed).toBe(false);
  });

  it("no permite debilitar cantidad de muestras o umbral mediante opciones externas", () => {
    const evaluateAtRuntime = contract.evaluateBenchmark as unknown as (input: Record<string, unknown>) => { passed: boolean; reasons: string[] };
    const relaxed = evaluateAtRuntime({
      samples: [1500],
      targetMs: 2000,
      expectedSamples: 1,
    });
    expect(relaxed.passed).toBe(false);
    expect(relaxed.reasons.join(" ")).toMatch(/30 muestras/);
    expect(relaxed.reasons.join(" ")).toMatch(/< 1000 ms/);
  });

  it("rechaza un benchmark sin hash de procedencia del árbol", () => {
    const result = contract.evaluateBenchmark({ samples: Array(30).fill(10), provenanceError: "git no disponible" });
    expect(result.passed).toBe(false);
    expect(result.reasons.join(" ")).toContain("git no disponible");
  });

  it("guarda el fallo por conflicto de salida en un directorio nuevo y conserva el anterior", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "paris-s57-existing-output-"));
    const existingOutput = path.join(tempRoot, "historic-output");
    mkdirSync(existingOutput);
    writeFileSync(path.join(existingOutput, "sentinel.txt"), "historial intacto");
    try {
      const result = spawnSync(process.execPath, [path.resolve("scripts/benchmark-laboratory.cjs")], {
        cwd: process.cwd(),
        env: { ...process.env, PERFORMANCE_OUTPUT: existingOutput },
        encoding: "utf8",
        timeout: 30000,
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      const summary = JSON.parse(result.stdout);
      expect(summary.result).toBe("failed");
      expect(summary.reportPath).not.toBe(path.join(existingOutput, "navigation-benchmark.json"));
      expect(existsSync(summary.reportPath)).toBe(true);
      const report = JSON.parse(readFileSync(summary.reportPath, "utf8"));
      expect(report.acceptance.passed).toBe(false);
      expect(report.failure).toMatch(/ya existe/i);
      expect(readFileSync(path.join(existingOutput, "sentinel.txt"), "utf8")).toBe("historial intacto");
      expect(existsSync(path.join(existingOutput, "navigation-benchmark.json"))).toBe(false);
    } finally {
      const parent = path.resolve(os.tmpdir());
      const target = path.resolve(tempRoot);
      const relative = path.relative(parent, target);
      if (!relative.startsWith("..") && !path.isAbsolute(relative)) rmSync(target, { recursive: true, force: true });
    }
  });
});

describe("gates del reportero aislado", () => {
  const report = (assertions: Array<{ fullName: string; status: string }>) => ({
    testResults: [{ assertionResults: assertions }],
  });
  const expectedPattern = "control actual";
  const passed = { fullName: "suite control actual", status: "passed" };

  it("acepta una ejecución positiva que corresponde al patrón esperado", () => {
    expect(contract.evaluateIsolatedRun({ processStatus: 0, report: report([passed]), expectedPattern })).toMatchObject({
      passed: true,
      counts: { executed: 1, passed: 1, skipped: 0, failed: 0 },
    });
  });

  it.each([
    { label: "status null", processStatus: null, json: report([passed]) },
    { label: "cero pruebas", processStatus: 0, json: report([]) },
    { label: "todo omitido", processStatus: 0, json: report([{ fullName: "suite control actual", status: "pending" }]) },
    { label: "patrón ausente", processStatus: 0, json: report([{ fullName: "otro control", status: "passed" }]) },
    { label: "prueba fallida", processStatus: 1, json: report([{ fullName: "suite control actual", status: "failed" }]) },
  ])("rechaza $label", ({ processStatus, json }) => {
    expect(contract.evaluateIsolatedRun({ processStatus: processStatus as number | null, report: json, expectedPattern }).passed).toBe(false);
  });
});

describe("fixture del benchmark", () => {
  it("conserva cantidades y referencias de persona, empresa y equipo", () => {
    const profiles = Array.from({ length: 24 }, (_, index) => ({
      id: `p${index}`,
      companyIds: ["c1"],
      teamId: "t1",
    }));
    const state = {
      profiles,
      companies: [{ id: "c1" }],
      teams: [{ id: "t1" }],
      assignments: [],
      tasks: Array.from({ length: 2000 }, (_, index) => ({
        id: `task${index}`,
        ownerId: "p0",
        companyId: "c1",
        teamId: "t1",
        assignmentId: null,
        dependsOnTaskIds: [],
      })),
    };
    expect(contract.validateFixture(state)).toMatchObject({ passed: true, errors: [] });
    state.tasks[0].ownerId = "missing";
    expect(contract.validateFixture(state).passed).toBe(false);
  });

  it("mantiene 24 perfiles y 2.000 tareas aunque se intenten pasar otros límites", () => {
    const state = {
      profiles: [{ id: "p1" }],
      companies: [{ id: "c1" }],
      teams: [{ id: "t1" }],
      assignments: [],
      tasks: [{ id: "task1", ownerId: "p1", companyId: "c1", teamId: "t1", assignmentId: null }],
    };
    const validateAtRuntime = contract.validateFixture as unknown as (state: unknown, options: Record<string, number>) => { passed: boolean; errors: string[] };
    const attemptedOverride = validateAtRuntime(state, { expectedProfiles: 1, expectedTasks: 1 });
    expect(attemptedOverride.passed).toBe(false);
    expect(attemptedOverride.errors.join(" ")).toMatch(/24/);
    expect(attemptedOverride.errors.join(" ")).toMatch(/2000/);
  });
});

describe("runner de aislamiento", () => {
  it("guarda un reporte fallido cuando no puede leer el hash Git", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "paris-s58-git-error-"));
    const emptyBin = path.join(tempRoot, "empty-bin");
    const output = path.join(tempRoot, "report");
    mkdirSync(emptyBin);
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (key.toLowerCase() === "path") delete env[key];
    env.PATH = emptyBin;
    try {
      const result = spawnSync(
        process.execPath,
        [path.resolve("tests/review/run-time-coverage-008-isolation.mjs"), "--output-dir", output],
        { cwd: process.cwd(), env, encoding: "utf8", timeout: 15000 },
      );
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      const report = JSON.parse(readFileSync(path.join(output, "isolation-run.json"), "utf8"));
      expect(report).toMatchObject({
        status: "failed",
        acceptance: false,
        sourceTree: null,
        sourceHead: null,
        totals: { executed: 0, passed: 0, skipped: 0, failed: 0 },
      });
      expect(report.fatalError).toMatch(/git|not found|not recognized/i);
    } finally {
      const parent = path.resolve(os.tmpdir());
      const target = path.resolve(tempRoot);
      const relative = path.relative(parent, target);
      if (!relative.startsWith("..") && !path.isAbsolute(relative)) rmSync(target, { recursive: true, force: true });
    }
  });
});
