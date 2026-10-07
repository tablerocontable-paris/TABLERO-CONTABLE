const { spawn } = require("node:child_process");
const fs = require("node:fs");
const { chromium } = require("playwright-core");
const root = require("node:path").resolve(__dirname, "..");
const binary = process.env.CHROMIUM_PATH;
const output = process.env.E2E_OUTPUT;
if (!binary) throw Error("Definí CHROMIUM_PATH para la prueba conjunta.");
if (!output) throw Error("Definí E2E_OUTPUT para guardar la evidencia visual.");
fs.mkdirSync(output, { recursive: true });
let server, browser;
const errors = [], apiCalls = [];
const assert = (ok, message) => { if (!ok) throw Error(message); };
(async () => {
  server = spawn(process.execPath, [root + "/node_modules/vite/bin/vite.js", "preview", "--outDir", "dist/client", "--host", "127.0.0.1", "--port", "8092", "--strictPort"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Preview timeout")), 10000);
    server.stdout.on("data", (chunk) => { if (chunk.toString().includes("Local:")) { clearTimeout(timer); resolve(); } });
    server.once("error", reject); server.once("exit", (code) => { if (code) reject(Error("Preview exited " + code)); });
  });
  browser = await chromium.launch({ executablePath: binary, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) apiCalls.push(request.url()); });
  await page.goto("http://127.0.0.1:8092");
  await page.locator(".lab-banner").waitFor();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
    state.tasks.push({ id: "joint-browser-test", assignmentId: null, templateId: null, title: "Tarea de prueba conjunta", ownerId: "e0", companyId: "c1", teamId: "t1", sector: "Tesorería", month, due: `${month}-25`, kind: "resultado", weight: 5, unit: "", target: 0, status: "Pendiente", checklist: [], completedAt: null, startedAt: null, priority: "Media", blockedBy: "", blockedSince: null, sessions: [], reopenCount: 0 });
    state.activeId = "m1";
    for (const profile of state.profiles) {
      state.onboarding[profile.id] = { ...(state.onboarding[profile.id] || state.onboarding.e0 || {}), completedAt: new Date().toISOString(), step: 6, home: "tasks", name: profile.name };
    }
    state.activity = state.activity.filter((row) => row.taskId !== "joint-browser-test");
    state.taskComments = (state.taskComments || []).filter((row) => row.taskId !== "joint-browser-test");
    localStorage.setItem("paris-state-lab", JSON.stringify(state));
  });
  await page.reload(); await page.locator(".lab-banner").waitFor();
  await page.locator('[data-nav="tasks"]').click();
  await page.getByLabel("Perfil que estás viendo").selectOption("e0");
  const card = page.locator('[data-task-id="joint-browser-test"]');
  await card.waitFor(); await card.locator(".card-title").click();
  await page.getByRole("button", { name: "Compartir tarea" }).click();
  await page.getByLabel("Segundo responsable").selectOption("e1");
  await page.getByLabel("Participación de Valentino Magni (%)").fill("60");
  await page.getByLabel("Motivo de la colaboración").fill("Revisión cruzada");
  await page.getByRole("button", { name: "Confirmar responsabilidad" }).click();
  await page.getByText("Tarea conjunta", { exact: false }).first().waitFor();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")));
  let task = saved.tasks.find((row) => row.id === "joint-browser-test");
  assert(task.responsibility?.members.map((member) => member.shareBps).join(",") === "6000,4000", "UI did not persist the 60/40 allocation");
  assert(saved.notifications.some((notice) => notice.taskId === task.id && notice.recipientId === "e1" && notice.kind === "joint"), "Joint assignment notification missing");
  await page.screenshot({ path: require("node:path").join(output, "joint-task-detail.png"), animations: "disabled" });
  await page.getByRole("button", { name: "Cerrar" }).click();

  async function useProfile(id) {
    await page.evaluate((profileId) => { const state = JSON.parse(localStorage.getItem("paris-state-lab")); state.activeId = profileId; localStorage.setItem("paris-state-lab", JSON.stringify(state)); }, id);
    await page.reload(); await page.locator(".lab-banner").waitFor(); await page.locator('[data-nav="tasks"]').click();
    await page.getByRole("button", { name: /^En curso/ }).click();
    const own = page.locator('[data-task-id="joint-browser-test"]');
    await own.waitFor();
    await own.locator(".card-title").click();
  }
  await useProfile("e0");
  await page.getByRole("button", { name: "Iniciar cronómetro" }).click();
  await page.getByRole("button", { name: "Cerrar" }).click();
  await useProfile("e1");
  await page.getByRole("button", { name: "Iniciar cronómetro" }).click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")));
  task = saved.tasks.find((row) => row.id === "joint-browser-test");
  assert(task.sessions.filter((session) => !session.end).map((session) => session.actorId).sort().join(",") === "e0,e1", "Two different members must run clocks simultaneously");
  await page.getByRole("button", { name: "Cerrar" }).click();
  await useProfile("e0");
  await page.getByRole("dialog").getByRole("button", { name: "Pausar cronómetro" }).click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")));
  task = saved.tasks.find((row) => row.id === "joint-browser-test");
  assert(task.sessions.filter((session) => !session.end).map((session) => session.actorId).join(",") === "e1", "Pausing one member must preserve the partner clock");
  assert((await page.locator('[data-task-id="joint-browser-test"]').count()) === 1, "Joint task duplicated on member board");

  await useProfile("e1");
  await page.getByRole("dialog").getByRole("button", { name: "Pausar cronómetro" }).click();
  await page.getByRole("button", { name: "Cerrar" }).click();
  await useProfile("e0");
  await page.getByRole("dialog").getByRole("button", { name: "Completar tarea", exact: true }).click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")));
  task = saved.tasks.find((row) => row.id === "joint-browser-test");
  assert(task.status === "Completada", "Completing from the task dialog must close the shared occurrence");
  assert(task.sessions.every((session) => !!session.end), "Completing the shared task must stop all member clocks");

  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    state.activeId = "boss";
    localStorage.setItem("paris-state-lab", JSON.stringify(state));
  });
  await page.reload();
  await page.locator(".lab-banner").waitFor();
  await page.locator('[data-nav="closing"]').click();

  async function closeEmployee(name, note) {
    await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name: "Revisar y cerrar" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Observaciones de cierre").fill(note);
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirmar cierre" }).click();
    await dialog.waitFor({ state: "detached" });
  }
  await closeEmployee("Valentino Magni", "Revisión de cierre A");
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")));
  const closureA = saved.closures.find((closure) => closure.ownerId === "e0" && closure.month === task.month);
  assert(closureA?.report?.schemaVersion === 2, "First participant closure must produce report schema v2");
  const contributionA = closureA.report.contributions.find((row) => row.taskId === task.id);
  assert(contributionA?.shareBps === 6000 && contributionA.possiblePoints === 3 && contributionA.earnedPoints === 3, "First report must preserve A's 60% contribution");
  assert(!JSON.stringify(closureA.report).includes("Lucía Fernández"), "First participant report must not expose the partner's identity");
  await page.getByRole("row").filter({ hasText: "Lucía Fernández" }).getByRole("button", { name: "Revisar y cerrar" }).waitFor();

  const reportRow = page.getByRole("row").filter({ hasText: "Valentino Magni" }).getByRole("button", { name: "Ver reporte" });
  await reportRow.click();
  const reportDialog = page.getByRole("dialog");
  const reportText = await reportDialog.innerText();
  assert(reportText.includes("60%") && reportText.includes("3.00"), "On-screen v2 report must show the personal share and points");
  assert(!reportText.includes("Lucía Fernández"), "On-screen personal report must not name the partner");
  const downloadReady = page.waitForEvent("download");
  await reportDialog.getByRole("button", { name: "Descargar reporte CSV" }).click();
  const csvDownload = await downloadReady;
  const csvPath = require("node:path").join(output, "joint-member-report.csv");
  await csvDownload.saveAs(csvPath);
  const csv = fs.readFileSync(csvPath, "utf8");
  assert(csv.includes("60") && csv.includes("3") && !csv.includes("Lucía Fernández"), "CSV must preserve A's contribution without the partner's identity");
  await reportDialog.getByRole("button", { name: "Cerrar" }).click();

  await closeEmployee("Lucía Fernández", "Revisión de cierre B");
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")));
  const closureB = saved.closures.find((closure) => closure.ownerId === "e1" && closure.month === task.month);
  assert(closureB?.report?.schemaVersion === 2, "Second participant must close the same frozen occurrence with report schema v2");
  const contributionB = closureB.report.contributions.find((row) => row.taskId === task.id);
  assert(contributionB?.shareBps === 4000 && contributionB.possiblePoints === 2 && contributionB.earnedPoints === 2, "Second report must preserve B's 40% contribution");
  assert(!apiCalls.length, "Laboratory called the operational API");
  assert(!errors.length, "Browser errors: " + errors.join("; "));
  console.log("PASS: joint activation, independent clocks, shared completion, sequential member closures, v2 reports and CSV privacy; zero operational API calls or JS errors.");
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); if (server) server.kill(); });
