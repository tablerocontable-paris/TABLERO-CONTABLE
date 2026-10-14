const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const S57_SAMPLE_COUNT = 30;
const S57_TARGET_MS = 1000;
const S57_PROFILE_COUNT = 24;
const S57_TASK_COUNT = 2000;

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0 || !Number.isFinite(p) || p <= 0 || p > 1) return null;
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.ceil(ordered.length * p) - 1];
}

function evaluateBenchmark({ samples, pageErrors = [], apiCalls = [], provenanceError = null }) {
  const reasons = [];
  const p95 = percentile(samples, 0.95);
  if (!Array.isArray(samples) || samples.length !== S57_SAMPLE_COUNT) reasons.push(`Se requieren ${S57_SAMPLE_COUNT} muestras; se obtuvieron ${Array.isArray(samples) ? samples.length : "ninguna"}.`);
  if (p95 === null) reasons.push("Las muestras deben ser finitas y no negativas.");
  else if (p95 >= S57_TARGET_MS) reasons.push(`p95 ${p95.toFixed(2)} ms no cumple el umbral estricto < ${S57_TARGET_MS} ms.`);
  if (pageErrors.length) reasons.push(`Se detectaron ${pageErrors.length} errores JavaScript.`);
  if (apiCalls.length) reasons.push(`Se detectaron ${apiCalls.length} llamadas a la API operativa.`);
  if (provenanceError) reasons.push(`No se pudo acreditar la procedencia del árbol: ${provenanceError}`);
  return { passed: reasons.length === 0, p95Ms: p95, reasons };
}

function validateFixture(state) {
  const errors = [];
  const profiles = state?.profiles || [];
  const tasks = state?.tasks || [];
  const companies = state?.companies || [];
  const teams = state?.teams || [];
  const profileById = new Map(profiles.map((row) => [row.id, row]));
  const companyIds = new Set(companies.map((row) => row.id));
  const teamIds = new Set(teams.map((row) => row.id));
  const assignmentIds = new Set((state?.assignments || []).map((row) => row.id));
  const taskIds = new Set(tasks.map((row) => row.id));
  if (profiles.length !== S57_PROFILE_COUNT) errors.push(`Perfiles: se esperaban ${S57_PROFILE_COUNT} y hay ${profiles.length}.`);
  if (tasks.length !== S57_TASK_COUNT) errors.push(`Tareas: se esperaban ${S57_TASK_COUNT} y hay ${tasks.length}.`);
  if (profileById.size !== profiles.length) errors.push("Hay IDs de perfil duplicados.");
  if (taskIds.size !== tasks.length) errors.push("Hay IDs de tarea duplicados.");
  if (!companies.length || !teams.length) errors.push("Faltan empresas o equipos de referencia.");
  for (const profile of profiles) {
    if (profile.managerId && !profileById.has(profile.managerId)) errors.push(`Perfil ${profile.id}: responsable jerárquico inexistente.`);
    if (profile.teamId && !teamIds.has(profile.teamId)) errors.push(`Perfil ${profile.id}: equipo inexistente.`);
    for (const companyId of profile.companyIds || []) if (!companyIds.has(companyId)) errors.push(`Perfil ${profile.id}: empresa inexistente ${companyId}.`);
  }
  for (const task of tasks) {
    const owner = profileById.get(task.ownerId);
    if (!owner) errors.push(`Tarea ${task.id}: responsable inexistente.`);
    if (!companyIds.has(task.companyId)) errors.push(`Tarea ${task.id}: empresa inexistente.`);
    if (owner?.companyIds?.length && !owner.companyIds.includes(task.companyId)) errors.push(`Tarea ${task.id}: la empresa no pertenece al ámbito del responsable.`);
    if (task.teamId && !teamIds.has(task.teamId)) errors.push(`Tarea ${task.id}: equipo inexistente.`);
    if (task.assignmentId && !assignmentIds.has(task.assignmentId)) errors.push(`Tarea ${task.id}: asignación inexistente.`);
    for (const dependencyId of task.dependsOnTaskIds || []) if (!taskIds.has(dependencyId)) errors.push(`Tarea ${task.id}: dependencia inexistente ${dependencyId}.`);
  }
  return { passed: errors.length === 0, errors };
}

function evaluateIsolatedRun({ processStatus, report, expectedPattern }) {
  const reasons = [];
  if (!Number.isInteger(processStatus)) reasons.push("El proceso no informó un código de salida válido.");
  else if (processStatus !== 0) reasons.push(`Vitest finalizó con código ${processStatus}.`);
  if (!report || typeof report !== "object") reasons.push("Falta un reporte JSON válido de Vitest.");
  const assertions = (report?.testResults || []).flatMap((file) => file.assertionResults || []);
  const passed = assertions.filter((test) => test.status === "passed").length;
  const failed = assertions.filter((test) => test.status === "failed").length;
  const skipped = assertions.filter((test) => ["pending", "todo", "skipped"].includes(test.status)).length;
  const matched = assertions.filter((test) => typeof test.fullName === "string" && test.fullName.includes(expectedPattern));
  if (passed <= 0) reasons.push("No se ejecutaron pruebas aprobadas.");
  if (failed > 0) reasons.push(`Hay ${failed} prueba(s) fallida(s).`);
  if (matched.length !== 1) reasons.push(`El patrón esperado debe identificar exactamente una prueba; coincidencias: ${matched.length}.`);
  if (matched.length === 1 && matched[0].status !== "passed") reasons.push(`La prueba esperada terminó como ${matched[0].status}.`);
  return { passed: reasons.length === 0, counts: { executed: passed + failed, passed, skipped, failed }, matched: matched.map((test) => ({ name: test.fullName, status: test.status })), reasons };
}

function effectiveTreeHash(root, excludedPrefixes = [".git/", "node_modules/", "dist/", "outputs/"]) {
  const { execFileSync } = require("node:child_process");
  const names = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root })
    .toString("utf8").split("\0").filter(Boolean).sort();
  const hash = crypto.createHash("sha256");
  const included = [];
  for (const name of names) {
    const normalized = name.replaceAll("\\", "/");
    if (excludedPrefixes.some((prefix) => normalized.startsWith(prefix))) continue;
    const file = path.join(root, name);
    let stat;
    try { stat = fs.statSync(file); } catch { continue; }
    if (!stat.isFile()) continue;
    hash.update(normalized).update("\0").update(fs.readFileSync(file)).update("\0");
    included.push(normalized);
  }
  return { sha256: hash.digest("hex"), fileCount: included.length, algorithm: "sha256(path\0contents\0), git tracked and non-ignored untracked files; generated outputs excluded" };
}

module.exports = { percentile, evaluateBenchmark, validateFixture, evaluateIsolatedRun, effectiveTreeHash };
