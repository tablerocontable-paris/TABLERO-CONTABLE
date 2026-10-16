const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { performance } = require("node:perf_hooks");
const { chromium } = require("playwright-core");
const { evaluateBenchmark, validateFixture, effectiveTreeHash } = require("./verification-contract.cjs");

const root = path.resolve(__dirname, "..");
const binary = process.env.CHROMIUM_PATH;
const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
let output = path.resolve(process.env.PERFORMANCE_OUTPUT || path.join(root, "outputs", `performance-lab-${timestamp}-${process.pid}`));
let reportPath = path.join(output, "navigation-benchmark.json");
const errors = [];
const apiCalls = [];
const samples = [];
let server;
let browser;
let browserVersion;
let page;
let dataset;
let fixtureCheck;
let failure;
let outputReserved = false;

function reserveFailureOutput() {
  const base = `${output}.failed-${timestamp}-${process.pid}`;
  let candidate = base;
  let suffix = 1;
  while (true) {
    try {
      fs.mkdirSync(candidate, { recursive: false });
      output = candidate;
      reportPath = path.join(output, "navigation-benchmark.json");
      outputReserved = true;
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      candidate = `${base}-${suffix++}`;
    }
  }
}

const waitForPaint = () => page.evaluate(() => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve({
    readyState: document.readyState,
    loadingMarkers: [...document.querySelectorAll('[aria-busy="true"], .section-loading')].map((node) => node.textContent || node.getAttribute("aria-label")),
  })));
}));

async function waitForRouteContent(route) {
  const nav = page.locator(`[data-nav="${route}"].active`);
  await nav.waitFor({ state: "visible", timeout: 60000 });
  await page.locator(".heading h1").waitFor({ state: "visible", timeout: 60000 });
  if (route === "analytics") {
    await page.locator(".analytics-toolbar").waitFor({ state: "visible", timeout: 60000 });
    await page.locator(".analytics-score-row").waitFor({ state: "visible", timeout: 60000 });
  } else if (route === "tasks") {
    await page.locator(".task-owner-section h2").first().waitFor({ state: "visible", timeout: 60000 });
    await page.locator(".kanban, .task-owner-section .panel").first().waitFor({ state: "visible", timeout: 60000 });
  } else if (route === "overview") {
    await page.locator(".stats").waitFor({ state: "visible", timeout: 60000 });
    await page.locator(".priority-grid, .dashboard-row").first().waitFor({ state: "visible", timeout: 60000 });
  } else throw new Error(`No hay contrato de contenido para la ruta ${route}.`);
  const paint = await waitForPaint();
  if (paint.loadingMarkers.length) throw new Error(`${route}: sigue visible contenido de carga: ${paint.loadingMarkers.join(" | ")}`);
}

async function navigate(route) {
  const started = performance.now();
  await page.locator(`[data-nav="${route}"]`).click();
  await waitForRouteContent(route);
  return performance.now() - started;
}

async function createFixture() {
  const serialized = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    if (!state?.profiles?.length || !state.tasks?.length) throw new Error("Falta la semilla del laboratorio.");
    if (state.profiles.length > 24) throw new Error(`La semilla ya supera 24 perfiles (${state.profiles.length}); no se eliminarán perfiles para ajustar la medición.`);
    if (state.tasks.length > 2000) throw new Error(`La semilla ya supera 2.000 tareas (${state.tasks.length}); no se eliminarán tareas para ajustar la medición.`);
    const baseEmployee = state.profiles.find((profile) => profile.role === "empleado");
    const baseTask = state.tasks.find((task) => task.kind === "resultado");
    if (!baseEmployee || !baseTask || !state.companies.length || !state.teams.length) throw new Error("La semilla no tiene empleado, entregable, empresas y equipos de referencia.");
    const extraProfiles = Array.from({ length: 24 - state.profiles.length }, (_, index) => ({
      ...baseEmployee,
      id: `bench_employee_${String(index + 1).padStart(2, "0")}`,
      name: `Perfil de prueba ${String(index + 1).padStart(2, "0")}`,
      email: `benchmark${index + 1}@example.test`,
      companyIds: state.companies.map((company) => company.id),
    }));
    state.profiles.push(...extraProfiles);
    const people = state.profiles.filter((profile) => profile.role === "empleado");
    const tasks = Array.from({ length: 2000 - state.tasks.length }, (_, index) => {
      const owner = people[index % people.length];
      const eligibleCompanies = (owner.companyIds || []).filter((companyId) => state.companies.some((company) => company.id === companyId));
      if (!eligibleCompanies.length) throw new Error(`El perfil ${owner.id} no tiene una empresa habilitada para la fixture.`);
      const task = structuredClone(baseTask);
      task.id = `bench_task_${String(index + 1).padStart(5, "0")}`;
      task.title = `Tarea de rendimiento ${index + 1}`;
      task.ownerId = owner.id;
      task.teamId = owner.teamId || baseTask.teamId;
      task.sector = owner.sector || baseTask.sector;
      task.companyId = eligibleCompanies[index % eligibleCompanies.length];
      task.assignmentId = null;
      delete task.responsibility;
      task.dependsOnTaskIds = [];
      task.availableFrom = null;
      task.status = "Pendiente";
      task.month = baseTask.month;
      task.due = baseTask.due;
      task.checklist = (task.checklist || []).map((step) => ({ ...step, done: false }));
      task.sessions = [];
      task.evidenceIds = [];
      return task;
    });
    state.tasks.push(...tasks);
    state.activeId = state.profiles.find((profile) => profile.role === "jefe")?.id || state.activeId;
    localStorage.setItem("paris-state-lab", JSON.stringify(state));
    return localStorage.getItem("paris-state-lab");
  });
  const state = JSON.parse(serialized);
  fixtureCheck = validateFixture(state);
  dataset = {
    profiles: state.profiles.length,
    tasks: state.tasks.length,
    employees: state.profiles.filter((profile) => profile.role === "empleado").length,
    companies: state.companies.length,
    teams: state.teams.length,
    owners: new Set(state.tasks.map((task) => task.ownerId)).size,
    month: state.tasks[0]?.month,
    fixtureValidation: fixtureCheck,
  };
  if (!fixtureCheck.passed) throw new Error(`Fixture inválida: ${fixtureCheck.errors.join("; ")}`);
}

async function main() {
  if (fs.existsSync(output)) throw new Error(`La carpeta ya existe; se usará una nueva carpeta de salida para no sobrescribir: ${output}`);
  fs.mkdirSync(output, { recursive: false });
  outputReserved = true;
  if (!binary) throw new Error("Definí CHROMIUM_PATH con Edge o Chromium instalado.");
  server = spawn(process.execPath, [
    path.join(root, "node_modules/vite/bin/vite.js"), "preview", "--outDir", "dist/client",
    "--host", "127.0.0.1", "--port", "8093", "--strictPort",
  ], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Vite preview no inició dentro de 10 s.")), 10000);
    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Local:")) { clearTimeout(timeout); resolve(); }
    });
    server.stderr.on("data", (chunk) => errors.push(`Vite: ${chunk.toString().trim()}`));
    server.once("error", reject);
    server.once("exit", (code) => { if (code !== 0) reject(new Error(`Vite preview terminó con ${code}.`)); });
  });
  browser = await chromium.launch({ executablePath: binary, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  browserVersion = await browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    try { if (new URL(request.url()).pathname.startsWith("/api/")) apiCalls.push(request.url()); } catch {}
  });
  await page.goto("http://127.0.0.1:8093", { waitUntil: "domcontentloaded" });
  await page.locator(".heading h1").waitFor({ state: "visible", timeout: 60000 });
  await createFixture();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".heading h1").waitFor({ state: "visible", timeout: 60000 });
  const routes = ["analytics", "tasks", "overview"];
  for (let cycle = 0; cycle < 2; cycle++) for (const route of routes) await navigate(route);
  for (let cycle = 0; cycle < 10; cycle++) for (const route of routes) samples.push(await navigate(route));
}

(async () => {
  try { await main(); }
  catch (error) { failure = error instanceof Error ? error.stack || error.message : String(error); }
  finally {
    if (browser) await browser.close().catch((error) => { errors.push(`Cierre de Chromium: ${error.message}`); });
    if (server) server.kill();
    let source = null;
    let provenanceError = null;
    try { source = effectiveTreeHash(root); }
    catch (error) {
      provenanceError = error instanceof Error ? error.message : String(error);
      failure = failure || `No se pudo calcular el hash del árbol efectivo: ${provenanceError}`;
      errors.push(failure);
    }
    if (!outputReserved) {
      try { reserveFailureOutput(); }
      catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        failure = `${failure || "La ejecución falló."} No se pudo reservar una carpeta nueva para guardar el informe: ${detail}`;
      }
    }
    const evaluation = evaluateBenchmark({ samples, pageErrors: errors, apiCalls, provenanceError });
    const result = {
      schemaVersion: 2,
      result: !failure && evaluation.passed && fixtureCheck?.passed ? "passed" : "failed",
      failure: failure || null,
      timestamp: new Date().toISOString(),
      sourceTree: source,
      browser: browserVersion || null,
      machine: { platform: `${os.platform()} ${os.release()}`, architecture: os.arch(), cpuModel: os.cpus()[0]?.model || "unknown", cpuCount: os.cpus().length, totalMemoryBytes: os.totalmem() },
      viewport: "1440x900",
      dataset,
      method: "Fixture validates exactly 24 profiles and 2,000 reference-preserving tasks; two warm-up cycles, then 10 hot cycles across analytics, tasks and overview (30 samples). Each sample waits for route-specific content plus two animation frames; no fixed delay.",
      samplesMs: samples.map((value) => Number(value.toFixed(2))),
      p95RouteMs: evaluation.p95Ms === null ? null : Number(evaluation.p95Ms.toFixed(2)),
      targetP95RouteMsExclusive: 1000,
      acceptance: { passed: !failure && evaluation.passed && fixtureCheck?.passed, reasons: [...evaluation.reasons, ...(fixtureCheck?.errors || []), ...(failure ? [failure] : [])] },
      javascriptErrors: errors,
      operationalApiCalls: apiCalls,
    };
    if (outputReserved) fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), { flag: "wx" });
    console.log(JSON.stringify({ result: result.result, reportPath, p95RouteMs: result.p95RouteMs, targetP95RouteMsExclusive: 1000, sampleCount: samples.length, dataset, acceptance: result.acceptance }, null, 2));
    if (result.result !== "passed") process.exitCode = 1;
  }
})();
