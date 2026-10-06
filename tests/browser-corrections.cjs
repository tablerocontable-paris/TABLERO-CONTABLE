const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright-core");
const root = path.resolve(__dirname, "..");
const binary = process.env.CHROMIUM_PATH;
const output = process.env.E2E_OUTPUT;
if (!binary || !output)
  throw Error(
    "Definí CHROMIUM_PATH y E2E_OUTPUT para este laboratorio aislado.",
  );
fs.mkdirSync(output, { recursive: true });
let browser, server;
const checks = [],
  errors = [],
  apiCalls = [];
const assert = (ok, message) => {
  if (!ok) throw Error(message);
};
(async () => {
  server = spawn(
    process.execPath,
    [
      root + "/node_modules/vite/bin/vite.js",
      "preview",
      "--outDir",
      "dist/client",
      "--host",
      "127.0.0.1",
      "--port",
      "8091",
      "--strictPort",
    ],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error("Preview timeout")), 10000);
    server.stdout.on("data", (x) => {
      if (x.toString().includes("Local:")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.once("error", reject);
    server.once("exit", (code) => {
      if (code) reject(Error("Preview exited " + code));
    });
  });
  browser = await chromium.launch({ executablePath: binary, headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) apiCalls.push(r.url());
  });
  await page.goto("http://127.0.0.1:8091");
  await page.locator(".lab-banner").waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert(
    (await page.getByLabel("Vista de usuario").locator("option").count()) > 10,
    "Simulation users missing",
  );
  await page.getByLabel("Apariencia").selectOption("light");
  for (const [width, height] of [
    [1440, 900],
    [1600, 740],
    [1280, 720],
    [1024, 650],
  ]) {
    await page.setViewportSize({ width, height });
    const metrics = await page.evaluate(() => {
      const s = document.querySelector(".sidebar"),
        u = s.querySelector(".user");
      const logo = s.querySelector(".brand img");
      return {
        width: innerWidth,
        height: innerHeight,
        overflow: getComputedStyle(s).overflowY,
        bottom: u.getBoundingClientRect().bottom,
        right: s.getBoundingClientRect().right,
        logoWidth: logo.getBoundingClientRect().width,
        logoCenter: logo.getBoundingClientRect().x + logo.getBoundingClientRect().width / 2,
        selectorCenter: s.querySelector('.sidebar-workspace select').getBoundingClientRect().x + s.querySelector('.sidebar-workspace select').getBoundingClientRect().width / 2,
        horizontalOverflow:
          document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    assert(
      metrics.overflow === "visible",
      "Independent sidebar scrolling at " + width,
    );
    assert(
      metrics.bottom <= height + 1,
      "Sidebar clipped at " + width + ": " + metrics.bottom,
    );
    assert(!metrics.horizontalOverflow, "Horizontal page overflow at " + width);
    assert(metrics.logoWidth >= 90, "Logo unexpectedly small");
    assert(Math.abs(metrics.logoCenter - metrics.selectorCenter) < 6, 'Logo not aligned to company selector');
    assert((await page.locator('.brand').innerText()) === '', 'Brand caption remains');
    assert((await page.locator('header .notification-trigger').count()) === 1, 'Notifications missing from header');
    checks.push(metrics);
    await page.screenshot({
      path: path.join(output, "sidebar-" + width + "x" + height + ".png"),
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1600, height: 740 });
  await page.locator('[data-nav="team"]').click();
  await page
    .getByRole("link", { name: "Probar invitación de Juan Pablo", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Hola, Juan.", exact: true })
    .waitFor();
  const introLogo = await page.locator(".induction-side img").boundingBox();
  assert(
    introLogo.width >= 120 && introLogo.height >= 120,
    "Induction logo lacks size",
  );
  await page.screenshot({
    path: path.join(output, "onboarding-logo.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("heading", { name: "¿En qué empresas trabajás?", exact: true })
    .waitFor();
  assert(
    (await page.locator(".context-facts").innerText()).includes(
      "Gerente contable",
    ),
    "Preconfigured job missing",
  );
  assert(
    (await page.locator(".choices input:checked").count()) === 4,
    "Preconfigured company scopes missing",
  );
  await page.screenshot({
    path: path.join(output, "onboarding-context.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.locator(".catalog-option input").first().check();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Preparar mi tablero", exact: true }).click();
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.getByLabel("Vista de usuario").selectOption("e0");
  await page.locator('[data-nav="tasks"]').click();
  await page.locator(".task-card").first().waitFor();
  const first = page.locator(".task-card").first();
  const title = await first.locator(".card-title").boundingBox();
  const fold = await first.locator(".card-collapse").boundingBox();
  assert(
    fold.x >= title.x + title.width + 8,
    "Title and collapse control overlap",
  );
  assert(
    (await first.locator(".card-collapse").innerText()) === "",
    "Collapse still uses visible text",
  );
  await first.locator(".card-collapse").click();
  assert(
    (await first.locator(".card-collapse").getAttribute("aria-expanded")) ===
      "false",
    "Fold failed",
  );
  assert(
    (await page
      .locator(".task-card")
      .nth(1)
      .locator(".card-collapse")
      .getAttribute("aria-expanded")) === "true",
    "Sibling folded",
  );
  await page.screenshot({
    path: path.join(output, "task-cards.png"),
    animations: "disabled",
  });
  const moveTaskId = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('paris-state-lab'));
    const openMonths = new Set(state.closures.map(c => `${c.ownerId}:${c.month}`));
    const card = state.tasks.find(t => t.ownerId === state.activeId && t.month === new Date().toISOString().slice(0, 7)
      && t.kind === 'resultado' && t.status === 'Pendiente' && !t.blockedBy
      && !openMonths.has(`${t.ownerId}:${t.month}`));
    return card?.id;
  });
  assert(moveTaskId, 'No eligible pending card for the drag test');
  await page.locator('.column').nth(1).locator('.column-toggle').click();
  const origin = page.locator(`[data-task-id="${moveTaskId}"]`).first();
  const destination = page.locator('.column').nth(1).locator('[role="region"]');
  assert((await origin.getAttribute('draggable')) === 'true', 'Task card does not expose drag and drop');
  await origin.dragTo(destination);
  const afterMove = await page.evaluate(id => JSON.parse(localStorage.getItem('paris-state-lab')).tasks.find(t => t.id === id), moveTaskId);
  assert(afterMove.status === 'En curso' && afterMove.sessions.some(s => !s.end && s.actorId === 'e0'), 'Dragging to in progress must move and start own clock: ' + JSON.stringify(afterMove));
  assert((await page.evaluate(() => JSON.parse(localStorage.getItem('paris-state-lab')).boardOrder)) === 'original', 'Manual board ordering must persist after drag');
  checks.push({ interaction: 'drag-to-progress', taskId: moveTaskId, status: afterMove.status, actorClockStarted: true });
  const search = page.locator('.search input').first();
  if (await search.count()) {
    await search.focus();
    const bounds = await page.locator('.search').first().boundingBox();
    assert(bounds.x >= 4 && bounds.x + bounds.width <= 1596, 'Search focus frame clipped');
    await page.screenshot({ path: path.join(output, 'search-focus.png'), animations: 'disabled' });
  }
  await first.locator('.card-title').click();
  await page.getByLabel('Nuevo comentario').fill('Nota de prueba para el superior');
  await page.getByRole('button', { name: 'Publicar comentario', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByLabel("Vista de usuario").selectOption("boss");
  await page.getByRole('button', { name: /^Notificaciones:/ }).click();
  assert((await page.getByText('Nuevo comentario en la tarea', { exact: true }).count()) === 1, 'Manager task notification missing');
  await page.locator(".parameterization-inbox summary").click();
  await page
    .getByRole("button", { name: "Revisar Valentino Magni", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar parámetros", exact: true })
    .click();
  assert(
    (await page
      .getByRole("button", { name: "Revisar Valentino Magni", exact: true })
      .count()) === 0,
    "Pending notice not resolved",
  );
  await page.screenshot({
    path: path.join(output, "pending-parameters.png"),
    animations: "disabled",
  });
  await page.reload();
  await page.locator(".lab-banner").waitFor();
  await page.getByRole('button', { name: /^Notificaciones:/ }).click();
  await page.locator(".parameterization-inbox summary").click();
  assert(
    (await page
      .getByRole("button", { name: "Revisar Valentino Magni", exact: true })
      .count()) === 0,
    "Review lost on reload",
  );
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-nav="day"]').click();
  await page.locator('[data-nav="operations"]').click();
  assert((await page.locator('.operational-intro').count()) === 0, 'Operational banner remains');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  assert(!overflow, "Mobile horizontal overflow");
  await page.screenshot({
    path: path.join(output, "mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  assert(!apiCalls.length, "Laboratory called the operational API");
  assert(!errors.length, "Browser errors: " + errors.join("; "));
  fs.writeFileSync(
    path.join(output, "browser-validation.json"),
    JSON.stringify(
      {
        passed: true,
        checks,
        apiCalls,
        errors,
        flows: [
          "laboratory users",
          "simulated invitation",
          "preconfigured onboarding",
          "independent icon folds",
          "drag task and auto-start its actor clock",
          "boss parameter review",
          "persisted review",
          "mobile",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: responsive sidebar, logos, laboratory, invitation, card icons, drag-and-drop, review notification, persistence, mobile; zero operational API calls and JS errors.",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (server) server.kill();
  });
