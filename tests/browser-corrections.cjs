const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright-core");
const { selectProfile } = require("./browser-helpers.cjs");
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
async function setTheme(page, target) {
  const toggle = page.locator(".theme-toggle");
  for (let step = 0; step < 3; step++) {
    if ((await toggle.getAttribute("data-theme")) === target) return;
    await toggle.click();
  }
  throw Error(`theme cycle did not reach ${target}`);
}
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
  const chartContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const chartPage = await chartContext.newPage();
  chartPage.on("pageerror", (e) => errors.push(e.message));
  chartPage.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) apiCalls.push(r.url());
  });
  await chartPage.goto("http://127.0.0.1:8091");
  await chartPage.locator(".lab-banner").waitFor();
  const chartFixture = await chartPage.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    const operation0 = state.tasks.find((task) => task.kind === "operativa" && task.ownerId === "e0");
    const operation1 = state.tasks.find((task) => task.kind === "operativa" && task.ownerId === "e1");
    const zeroResult = state.tasks.find((task) => task.kind === "resultado" && task.ownerId === "e2");
    if (!operation0 || !operation1 || !zeroResult) throw Error("Seed lacks operational-only and zero-result chart groups");
    const tasks = [operation0, operation1, zeroResult].map((task) => ({
      ...task,
      dependsOnTaskIds: [],
      status: task.id === zeroResult.id ? "Pendiente" : "En curso",
      completedAt: null,
    }));
    const taskIds = new Set(tasks.map((task) => task.id));
    const assignmentIds = new Set(tasks.map((task) => task.assignmentId).filter(Boolean));
    state.tasks = tasks;
    state.assignments = state.assignments.filter((assignment) => assignmentIds.has(assignment.id));
    state.activity = state.activity.filter((row) => taskIds.has(row.taskId));
    state.fiscalObligations = [];
    state.calendarEvents = [];
    state.calendarNotices = [];
    state.notifications = [];
    state.taskComments = [];
    state.internalRequests = [];
    state.jointReceipts = [];
    state.taskEvidence = [];
    state.operationalRates = [];
    state.operationalAssessments = [{
      id: "chart-qa-assessment", taskId: operation0.id, profileId: operation0.ownerId,
      companyId: operation0.companyId, month: operation0.month,
      quality: 90, order: 80, timeliness: 70, note: "Evaluación ficticia para validar el gráfico",
      evaluatedAt: new Date().toISOString(), evaluatedBy: "boss",
    }];
    localStorage.setItem("paris-state-lab", JSON.stringify(state));
    return { operationalIds: [operation0.id, operation1.id], resultId: zeroResult.id, owners: [operation0.ownerId, operation1.ownerId, zeroResult.ownerId], month: state.tasks[0].month, activeId: state.activeId, onboarding: state.onboarding[state.activeId] };
  });
  await chartPage.reload();
  await Promise.race([
    chartPage.locator(".lab-banner").waitFor().catch(() => {}),
    chartPage.locator(".storage-recovery").waitFor().catch(() => {}),
  ]);
  assert((await chartPage.locator(".storage-recovery").count()) === 0, "S52 chart fixture did not pass laboratory state validation: " + await chartPage.locator("body").innerText());
  await chartPage.locator('[data-nav="analytics"]').click();
  await chartPage.getByRole("heading", { name: "Cumplimiento ponderado", exact: true }).waitFor();
  const scorePanel = chartPage.locator(".analytics-score-row");
  await scorePanel.locator(".recharts-responsive-container svg").waitFor();
  const chartState = await scorePanel.evaluate((panel) => {
    const svg = panel.querySelector(".recharts-responsive-container svg");
    const svgText = [...(svg?.querySelectorAll("text") || [])].map((node) => node.textContent?.trim()).filter(Boolean);
    const bars = [...panel.querySelectorAll(".recharts-bar-rectangle")].map((node) => node.getAttribute("width"));
    return { svg: !!svg, svgText, bars, note: panel.querySelector('[role="note"]')?.textContent?.trim() || "", panelText: panel.textContent?.trim().slice(0, 500) };
  });
  await chartPage.waitForFunction(() => {
    const sectors = [...document.querySelectorAll(".analytics-pie-chart .recharts-sector")];
    return sectors.length > 0 && sectors.every((sector) => {
      const bounds = sector.getBBox();
      const fill = getComputedStyle(sector).fill;
      return !!sector.getAttribute("d") && bounds.width > 90 && bounds.height > 70 && fill !== "none" && fill !== "rgba(0, 0, 0, 0)";
    });
  });
  await chartPage.waitForFunction(() => {
    const sectors = [...document.querySelectorAll(".analytics-pie-chart .recharts-sector")];
    if (sectors.length < 2) return false;
    const signature = sectors.map((sector) => {
      const bounds = sector.getBBox();
      return [sector.getAttribute("d"), bounds.x, bounds.y, bounds.width, bounds.height, getComputedStyle(sector).fill].join(":");
    }).join("|");
    const now = performance.now();
    const previous = (window).__analyticsPieStable;
    if (!previous || previous.signature !== signature) {
      (window).__analyticsPieStable = { signature, since: now };
      return false;
    }
    return now - previous.since >= 500;
  }, null, { polling: "raf", timeout: 10000 });
  const pieState = await chartPage.locator(".analytics-pie-chart svg[role=application]").evaluate((svg) => ({
    sectors: [...svg.querySelectorAll(".recharts-sector")].map((sector) => {
      const bounds = sector.getBBox();
      return {
        name: sector.getAttribute("name"),
        fill: getComputedStyle(sector).fill,
        bounds: { width: bounds.width, height: bounds.height },
      };
    }),
  }));
  await chartPage.screenshot({ path: path.join(output, "analytics-operational-no-base.png"), fullPage: true, animations: "disabled" });
  assert(chartState.svg, "S52 did not render the real Recharts SVG");
  assert(chartState.svgText.some((label) => label.includes("Valentino Magni")) && chartState.svgText.some((label) => label.includes("Lucía Fernández")), "Real chart omitted operational-only groups: " + JSON.stringify({ chartFixture, chartState }));
  assert(chartState.note.includes("Valentino Magni") && chartState.note.includes("Lucía Fernández"), "Real chart does not identify groups without a deliverable basis: " + JSON.stringify(chartState));
  assert(chartState.svgText.some((label) => label.includes("Joaquín Pérez")), "Real chart omitted the zero-completion deliverable group: " + JSON.stringify(chartState));
  assert(chartState.note.includes("Cumplimiento 0%: Joaquín Pérez."), "Real chart does not identify the zero-completion group separately from no base: " + JSON.stringify(chartState));
  assert(pieState.sectors.length >= 2 && pieState.sectors.every((sector) => sector.bounds.width > 90 && sector.bounds.height > 70), "Real distribution chart did not render complete pie sectors: " + JSON.stringify(pieState));
  checks.push({ interaction: "s52-real-recharts-operational-only-and-zero-result-groups", chartFixture, chartState, pieState });
  await chartContext.close();
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
  const pickerFixture = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    const base = state.profiles.find((profile) => profile.id === "e0");
    while (state.profiles.length < 24) {
      const index = state.profiles.length + 1;
      state.profiles.push({ ...base, id: `picker-e${index}`, name: `Persona de prueba ${String(index).padStart(2, "0")}` });
    }
    localStorage.setItem("paris-state-lab", JSON.stringify(state));
    return { count: state.profiles.length };
  });
  await page.reload();
  await page.locator(".lab-banner").waitFor();
  await page.evaluate(() => document.fonts.ready);
  const actorPicker = page.locator(".sidebar-bottom .employee-picker");
  await actorPicker.getByRole("button", { name: "Vista de usuario" }).click();
  const pickerOptions = actorPicker.locator('[role="option"]');
  assert((await pickerOptions.count()) === 24, "The 24-profile picker fixture did not load");
  assert((await pickerOptions.allTextContents()).some((option) => /[A-ZÁÉÍÓÚÜÑ]{1,2}/.test(option)), "Employee options do not include initials");
  const teamGroupTones = await actorPicker.locator(".employee-picker-group").evaluateAll((groups) => groups.map((group) => getComputedStyle(group).backgroundColor));
  assert(new Set(teamGroupTones).size > 1, "Employee teams are not visually distinguished by grayscale tones");
  const pickerSearch = actorPicker.getByRole("combobox", { name: "Buscar persona en Vista de prueba · actor simulado" });
  await pickerSearch.press("End");
  const pickerScroll = await actorPicker.evaluate((root) => {
    const search = root.querySelector("input[aria-activedescendant]");
    const option = document.getElementById(search.getAttribute("aria-activedescendant"));
    const list = root.querySelector(".employee-picker-listbox");
    const row = option.getBoundingClientRect(), box = list.getBoundingClientRect();
    return { active: option?.textContent?.trim(), scrollTop: list.scrollTop, visible: row.top >= box.top - 1 && row.bottom <= box.bottom + 1, bounds: { top: box.top, bottom: box.bottom, rowTop: row.top, rowBottom: row.bottom } };
  });
  assert(pickerScroll.scrollTop > 0 && pickerScroll.visible, "End did not scroll only the picker list to the visible active option: " + JSON.stringify(pickerScroll));
  await pickerSearch.press("Home");
  await page.screenshot({ path: path.join(output, "employee-picker-open.png"), animations: "disabled" });
  await pickerSearch.press("Escape");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Vista de usuario");
  await actorPicker.getByRole("button", { name: "Vista de usuario" }).click();
  const pickerTabSearch = actorPicker.getByRole("combobox", { name: "Buscar persona en Vista de prueba · actor simulado" });
  await pickerTabSearch.waitFor({ state: "visible" });
  await pickerTabSearch.focus();
  await pickerTabSearch.press("Tab");
  await page.waitForFunction(() => document.activeElement !== document.body && !document.querySelector(".employee-picker-popover"));
  assert(!(await page.evaluate(() => document.activeElement === document.body)), "Tab lost focus when closing the employee picker");
  assert((await actorPicker.locator(".employee-picker-popover").count()) === 0, "Tab did not close the employee picker");
  await setTheme(page, "light");
  await page.locator('[data-nav="annotations"]').click();
  await page.getByRole("heading", { name: "Anotaciones personales" }).waitFor();
  const createAnnotation = page.getByRole("button", { name: "Nueva anotación" });
  assert(await createAnnotation.evaluate((button) => !!button.closest(".panel-head")), "Annotation action is not compactly placed in the panel header");
  assert((await page.getByRole("button", { name: "Plegar Tu biblioteca" }).getAttribute("aria-expanded")) === "true", "Annotation library should be visible on entry");
  await page.screenshot({ path: path.join(output, "annotations-prioritized.png"), animations: "disabled" });
  await page.locator('[data-nav="overview"]').click();
  await page.getByRole("heading", { name: "Todo el equipo, en perspectiva." }).waitFor();
  for (const [width, height] of [
    [1440, 900],
    [1600, 740],
    [1280, 720],
    [1024, 650],
  ]) {
    await page.setViewportSize({ width, height });
    const metrics = await page.evaluate(() => {
      const s = document.querySelector(".sidebar"),
        u = s.querySelector(".sidebar-bottom");
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
    if (width === 1024) {
      await page.screenshot({ path: path.join(output, "sidebar-layout-diagnostic.png"), fullPage: true, animations: "disabled" });
      console.log("Sidebar layout:", JSON.stringify(metrics));
    }
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
  assert(
    (await page.locator(".induction-step").innerText()).includes("La inducción de jefatura no crea tareas personales"),
    "Boss onboarding should explain that it does not create personal execution tasks",
  );
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Preparar mi tablero", exact: true }).click();
  const bossOnboarding = await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")));
  assert(!bossOnboarding.assignments.some((assignment) => assignment.ownerId === bossOnboarding.activeId), "Boss onboarding created a personal assignment");
  assert(!bossOnboarding.tasks.some((task) => task.ownerId === bossOnboarding.activeId), "Boss onboarding materialized a personal task");
  checks.push({ interaction: "boss-onboarding-does-not-create-execution-work", profileId: bossOnboarding.activeId });
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "e0");
  await page.locator('[data-nav="day"]').click();
  const routeEntry = page.locator('.suggested-route-entry').first();
  await routeEntry.waitFor();
  await routeEntry.getByText("Por qué está en esta posición", { exact: true }).click();
  const routeReason = await routeEntry.locator('.route-position-details p').innerText();
  assert(routeReason.length > 30, 'Suggested route does not explain its ordering');
  checks.push({ interaction: 'suggested-route-position-explanation', reason: routeReason });
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
  const dragFeedback = await origin.evaluate(card => {
    card.getAnimations().forEach(animation => animation.cancel());
    card.classList.add('is-dragging');
    const style = getComputedStyle(card);
    const transform = style.transform;
    const opacity = Number(style.opacity);
    card.classList.remove('is-dragging');
    const matrix = new DOMMatrixReadOnly(transform);
    return { scale: Math.hypot(matrix.a, matrix.b), opacity };
  });
  assert(Math.abs(dragFeedback.scale - 1.04) < 0.01 && dragFeedback.opacity >= 0.9, 'Drag preview should enlarge the card and keep it visible: ' + JSON.stringify(dragFeedback));
  await origin.dragTo(destination);
  const afterMove = await page.evaluate(id => JSON.parse(localStorage.getItem('paris-state-lab')).tasks.find(t => t.id === id), moveTaskId);
  assert(afterMove.status === 'En curso' && afterMove.sessions.some(s => !s.end && s.actorId === 'e0'), 'Dragging to in progress must move and start own clock: ' + JSON.stringify(afterMove));
  const landedCard = page.locator(`[data-task-id="${moveTaskId}"][data-landed="true"]`).first();
  await landedCard.waitFor({ state: 'visible' });
  const landingAnimation = await landedCard.evaluate(card => getComputedStyle(card).animationName);
  assert(landingAnimation === 'task-land', 'Dropped card did not play its landing animation: ' + landingAnimation);
  assert((await page.evaluate(() => JSON.parse(localStorage.getItem('paris-state-lab')).boardOrder)) === 'original', 'Manual board ordering must persist after drag');
  checks.push({ interaction: 'drag-to-progress', taskId: moveTaskId, status: afterMove.status, actorClockStarted: true, dragFeedback, landingAnimation });
  const search = page.locator('.search input').first();
  if (await search.count()) {
    await search.focus();
    const bounds = await page.locator('.search').first().boundingBox();
    assert(bounds.x >= 4 && bounds.x + bounds.width <= 1596, 'Search focus frame clipped');
    await page.screenshot({ path: path.join(output, 'search-focus.png'), animations: 'disabled' });
  }
  const quickSearchTrigger = page.getByRole('button', { name: 'Abrir búsqueda de tareas' });
  await quickSearchTrigger.focus();
  await quickSearchTrigger.click();
  await page.getByRole('searchbox', { name: 'Buscar tareas por nombre, empresa, persona o período' }).fill('conciliacion banco nacion');
  const quickSearchResults = page.locator('.quick-task-search-result');
  assert(await quickSearchResults.count() === 2, 'Quick search did not find the two accessible matching tasks: ' + await page.locator('.quick-task-search-dialog').innerText());
  assert((await quickSearchResults.allTextContents()).every((text) => text.includes('Conciliación Banco Nación')), 'Quick search returned an unexpected task');
  await page.screenshot({ path: path.join(output, 'quick-task-search.png'), animations: 'disabled' });
  const quickSearchActor = await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")).activeId);
  await page.getByRole('searchbox', { name: 'Buscar tareas por nombre, empresa, persona o período' }).press('Tab');
  assert(await quickSearchResults.first().evaluate((button) => document.activeElement === button), 'Tab did not move from search input to the first semantic task action');
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: 'Conciliación Banco Nación', exact: true }).waitFor();
  assert(await page.evaluate(() => /Conciliación Banco Nación/.test(document.activeElement?.textContent || document.activeElement?.getAttribute('aria-label') || '')), 'Selecting a task in search did not focus its destination');
  assert(await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")).activeId) === quickSearchActor, 'Quick-search Enter changed the actor');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  checks.push({ interaction: 'quick-task-search-native-tab-enter-accent-insensitive-and-actor-preserved', results: 2, actor: quickSearchActor });
  await quickSearchTrigger.focus();
  await quickSearchTrigger.evaluate((button) => (button instanceof HTMLButtonElement) && button.click());
  await page.getByRole('searchbox', { name: 'Buscar tareas por nombre, empresa, persona o período' }).fill('conciliacion banco nacion');
  await page.getByRole('searchbox', { name: 'Buscar tareas por nombre, empresa, persona o período' }).press('Tab');
  await page.keyboard.press('Space');
  await page.getByRole('heading', { name: 'Conciliación Banco Nación', exact: true }).waitFor();
  assert(await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")).activeId) === quickSearchActor, 'Quick-search Space changed the actor');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  checks.push({ interaction: 'quick-task-search-native-space-activation-actor-preserved', actor: quickSearchActor });
  await quickSearchTrigger.focus();
  await quickSearchTrigger.click();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement?.classList.contains('quick-search-trigger'));
  checks.push({ interaction: 'quick-search-escape-restores-trigger-focus' });
  await first.locator('.card-title').click();
  await page.getByLabel('Nuevo comentario').fill('Nota de prueba para el superior');
  await page.getByRole('button', { name: 'Publicar comentario', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  const taskCountBeforeRequest = await page.evaluate(() => JSON.parse(localStorage.getItem('paris-state-lab')).tasks.length);
  await page.locator('[data-nav="requests"]').click();
  assert(await page.getByLabel('Módulo').count() === 0, 'Request composer should start closed');
  await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click();
  await page.getByLabel('Módulo').fill('Vencimientos');
  await page.getByLabel('Asunto').fill('Aclarar vencimiento de prueba');
  await page.getByLabel('Detalle').fill('Necesito confirmar el criterio del vencimiento en la demostración.');
  await page.getByRole('button', { name: 'Registrar pedido' }).click();
  const requestId = await page.evaluate(() => JSON.parse(localStorage.getItem('paris-state-lab')).internalRequests.at(-1).id);
  assert(await page.evaluate((before) => JSON.parse(localStorage.getItem('paris-state-lab')).tasks.length === before, taskCountBeforeRequest), 'Internal request altered task KPI source rows');
  checks.push({ interaction: 'internal-request-created-without-task-or-KPI-mutation', requestId });
  await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "boss");
  await page.locator('[data-nav="requests"]').click();
  await page.getByRole('heading', { name: 'Aclarar vencimiento de prueba' }).waitFor();
  await page.getByRole('button', { name: 'Tomar para revisión' }).click();
  await page.getByLabel('Respuesta').fill('El plazo se conserva en la tarjeta de la tarea.');
  await page.getByRole('button', { name: 'Responder' }).click();
  await page.getByRole('button', { name: 'Marcar resuelto' }).click();
  const closedRequest = await page.evaluate((id) => JSON.parse(localStorage.getItem('paris-state-lab')).internalRequests.find((row) => row.id === id), requestId);
  assert(closedRequest.status === 'resolved' && closedRequest.messages.length === 1 && closedRequest.history.length === 4, 'Internal request response or transition history did not persist');
  await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "e0");
  await page.locator('[data-nav="requests"]').click();
  assert(await page.getByText('El plazo se conserva en la tarjeta de la tarea.').count() === 1, 'Request author cannot see recipient response');
  const taskCountBeforeExplicitConversion = await page.evaluate(() => JSON.parse(localStorage.getItem('paris-state-lab')).tasks.length);
  await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click();
  await page.getByLabel('Módulo').fill('Tablero');
  await page.getByLabel('Asunto').fill('Asignar conciliación puntual de prueba');
  await page.getByLabel('Detalle').fill('Comparar el extracto y documentar las diferencias de esta prueba.');
  await page.getByRole('button', { name: 'Registrar pedido' }).click();
  const conversionRequestId = await page.evaluate(() => JSON.parse(localStorage.getItem('paris-state-lab')).internalRequests.at(-1).id);
  assert(await page.evaluate((before) => JSON.parse(localStorage.getItem('paris-state-lab')).tasks.length === before, taskCountBeforeExplicitConversion), 'Request created a task before manager confirmation');
  await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "boss");
  await page.locator('[data-nav="requests"]').click();
  await page.getByRole('button', { name: 'Convertir en tarea puntual' }).click();
  await page.getByLabel('Responsable').selectOption('e0');
  await page.getByLabel('Empresa obligatoria').selectOption('c1');
  await page.locator('select[name="weight"]').selectOption('3');
  const convertedDate = await page.locator('input[aria-label="Fecha de realización"]').inputValue();
  await page.getByRole('button', { name: /Crear tarea/ }).click();
  const convertedState = await page.evaluate((id) => {
    const saved = JSON.parse(localStorage.getItem('paris-state-lab'));
    const request = saved.internalRequests.find((row) => row.id === id);
    const task = saved.tasks.find((row) => row.id === request?.convertedTaskId);
    const assignment = saved.assignments.find((row) => row.id === task?.assignmentId);
    return { request, task, assignment, linkedCount: saved.tasks.filter((row) => row.originRequestId === id).length };
  }, conversionRequestId);
  assert(convertedState.request?.status === 'resolved' && convertedState.request.convertedBy === 'boss', 'Explicit conversion did not resolve and attribute the request');
  assert(convertedState.task?.originRequestId === conversionRequestId && convertedState.task?.ownerId === 'e0' && convertedState.task?.companyId === 'c1', 'Converted task lost its request link or selected assignment');
  assert(convertedState.task?.weight === 3 && convertedState.task?.scheduledOn === convertedDate && convertedState.assignment?.frequency === 'única', 'Conversion did not preserve explicit weight/date or created recurrence');
  assert(convertedState.linkedCount === 1, 'Request conversion created duplicate task links');
  const assignmentNotice = await page.evaluate((taskId) => JSON.parse(localStorage.getItem('paris-state-lab')).notifications.some((notice) => notice.taskId === taskId && notice.kind === 'assigned' && notice.recipientId === 'e0'), convertedState.task.id);
  assert(assignmentNotice, 'New task assignee did not receive an in-app assignment notification');
  checks.push({ interaction: 'manager-explicit-one-off-task-conversion', requestId: conversionRequestId, taskId: convertedState.task.id, scheduledOn: convertedDate, assigneeNotification: assignmentNotice });
  await page.getByRole('button', { name: 'Abrir tarea', exact: true }).click();
  const requestContext = page.locator('.request-origin-context').getByText('Comparar el extracto y documentar las diferencias de esta prueba.', { exact: true });
  await requestContext.waitFor({ state: 'visible', timeout: 5000 });
  assert(await requestContext.count() === 1, 'Converted task did not retain the source request context');
  await page.screenshot({ path: path.join(output, 'request-task-conversion.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "boss");
  await page.getByRole('button', { name: /^Notificaciones:/ }).click();
  assert((await page.getByText('Nuevo comentario en la tarea', { exact: true }).count()) === 1, 'Manager task notification missing');
  await page.locator(".parameterization-inbox summary").click();
  await page
    .getByRole("button", { name: "Revisar Valentino Magni", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar revisión", exact: true })
    .click();
  assert(
    (await page
      .getByRole("button", { name: "Revisar Valentino Magni", exact: true })
      .count()) === 0,
    "Pending notice not resolved",
  );
  if (await page.locator("dialog[open]").count())
    await page.locator("dialog[open] button[aria-label=\"Cerrar\"]").click();
  await page.screenshot({
    path: path.join(output, "pending-parameters.png"),
    animations: "disabled",
  });
  await page.locator('[data-nav="calendar"]').click();
  await page.getByRole("heading", { name: "Obligaciones por empresa" }).waitFor();
  await page.getByLabel("Empresa", { exact: true }).first().selectOption("");
  await page.getByRole("button", { name: "Nueva obligación" }).click();
  await page.locator(".fiscal-obligation-form select").first().selectOption("c2");
  await page.getByLabel("Obligación").fill("IVA de prueba navegador");
  await page.getByLabel("Período fiscal").fill("2026-09");
  await page.getByLabel("Fecha del vencimiento").fill("2026-10-22");
  await page.locator(".obligation-task-links input[type=checkbox]").first().check();
  await page.getByRole("button", { name: "Cargar obligación" }).click();
  const demoObligation = await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")).fiscalObligations.at(-1));
  assert(demoObligation.fiscalPeriod === "2026-09" && demoObligation.dueOn === "2026-10-22", "Fiscal period and due date were conflated");
  assert(demoObligation.requiredTaskIds.length === 1 && demoObligation.sourceLabel.includes("ficticio"), "Explicit task link or fictitious source missing");
  assert(demoObligation.companyId === "c2", "The obligation was saved to a different company than the form selection");
  const obligationCard = page.locator(".fiscal-obligation-card").filter({ hasText: "IVA de prueba navegador" });
  await obligationCard.getByRole("button", { name: "Revisar vencimiento, fuente o vínculos" }).click();
  await page.getByLabel("Fecha del vencimiento").fill("2026-10-24");
  await page.getByLabel("Revisión del origen").fill("DEMO-02");
  await page.getByLabel("Motivo de la revisión").fill("Corrección de prueba del navegador");
  await page.getByRole("button", { name: "Guardar revisión" }).click();
  const revisedObligation = await page.evaluate((id) => JSON.parse(localStorage.getItem("paris-state-lab")).fiscalObligations.find((row) => row.id === id), demoObligation.id);
  assert(revisedObligation.revision === 2 && revisedObligation.history.length === 1 && revisedObligation.dueOn === "2026-10-24", "Obligation revision history did not persist");
  checks.push({ interaction: "fiscal-obligation-created-linked-and-versioned", id: demoObligation.id, revision: revisedObligation.revision });
  await page.screenshot({ path: path.join(output, "fiscal-obligations.png"), animations: "disabled" });
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
  await page.locator('[data-nav="analytics"]').click();
  await page.getByRole('heading', { name: 'Ciclo de trabajo', exact: true }).waitFor();
  assert(await page.getByText('Puntos de entregables previstos', { exact: true }).count() >= 1, 'Work-cycle points must be labeled as deliverables');
  await page.getByLabel('Agrupar período').getByRole('button', { name: 'Día', exact: true }).click();
  const analysisMonth = await page.locator('input[type="month"][aria-label="Período"]').inputValue();
  const daysInAnalysisMonth = new Date(Number(analysisMonth.slice(0, 4)), Number(analysisMonth.slice(5, 7)), 0).getDate();
  assert((await page.locator('.work-cycle-table-wrap').first().locator('tbody tr').count()) === daysInAnalysisMonth, 'Daily work-cycle view omitted a date');
  await page.getByLabel('Desglosar ciclo por').selectOption('team');
  assert((await page.locator('.work-cycle-table-wrap').nth(1).locator('thead th').first().innerText()).toLowerCase() === 'equipo', 'Work-cycle dimension did not switch to teams');
  checks.push({ interaction: 'monthly-work-cycle-day-week-and-team-breakdown', month: analysisMonth, days: daysInAnalysisMonth });
  await page.screenshot({ path: path.join(output, 'work-cycle.png'), fullPage: true, animations: 'disabled' });
  await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "e0");
  await page.locator('[data-nav="quality"]').click();
  await page.getByRole("heading", { name: "Mejorar un proceso con evidencia", exact: true }).waitFor();
  await page.getByRole("button", { name: "Desplegar Mejorar un proceso con evidencia" }).click();
  await page.getByRole("button", { name: "Proponer mejora", exact: true }).click();
  await page.getByLabel("Problema observado").fill("Se repiten diferencias por extractos incompletos.");
  await page.getByRole("spinbutton", { name: "Medición inicial", exact: true }).fill("24");
  await page.getByLabel("Unidad comparable").fill("minutos por conciliación");
  await page.getByLabel("Meta numérica").fill("12");
  await page.getByLabel("Evidencia de la medición inicial").fill("Diez conciliaciones revisadas en la muestra.");
  await page.getByLabel("Volumen y contexto inicial").fill("Octubre · diez conciliaciones de complejidad media.");
  await page.getByLabel("Cambio propuesto").fill("Verificar la integridad del extracto antes de conciliar.");
  await page.getByLabel("Responsable de la prueba").selectOption("e0");
  await page.getByLabel("Desde").fill("2026-10-06");
  await page.getByLabel("Hasta").fill("2026-10-31");
  await page.getByRole("button", { name: "Guardar propuesta", exact: true }).click();
  const proposalId = await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")).improvementProposals.at(-1).id);
  await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "boss");
  await page.locator('[data-nav="quality"]').click();
  await page.getByRole("button", { name: "Desplegar Mejorar un proceso con evidencia" }).click();
  await page.getByLabel("Criterio para habilitar la prueba").fill("Muestra y período acotados; mantener el mismo volumen y complejidad.");
  await page.getByRole("button", { name: "Autorizar prueba", exact: true }).click();
  await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "e0");
  await page.locator('[data-nav="quality"]').click();
  await page.getByRole("button", { name: "Desplegar Mejorar un proceso con evidencia" }).click();
  await page.getByLabel("Valor medido").fill("10");
  await page.getByLabel("Fecha", { exact: true }).fill("2026-10-25");
  await page.getByLabel("Evidencia de la medición").fill("Las diez conciliaciones posteriores requirieron menos verificaciones repetidas.");
  await page.getByLabel("Volumen y contexto comparables").fill("Octubre · diez conciliaciones de complejidad media.");
  await page.getByRole("button", { name: "Guardar medición", exact: true }).click();
  await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "boss");
  await page.locator('[data-nav="quality"]').click();
  await page.getByRole("button", { name: "Desplegar Mejorar un proceso con evidencia" }).click();
  await page.getByLabel("Objetivo actualizado").fill("Validar integridad del extracto antes de conciliar.");
  await page.getByLabel("Controles de la nueva versión · uno por línea").fill("Confirmar período y empresa del extracto\nComparar saldos y movimientos\nDocumentar diferencias\nRevisar conciliación");
  await page.getByLabel("Comparación y criterio de adopción").fill("La medición mejora con volumen y complejidad comparables; se adopta como estándar futuro.");
  await page.getByRole("button", { name: "Adoptar y versionar", exact: true }).click();
  const adopted = await page.evaluate((id) => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    const proposal = state.improvementProposals.find((row) => row.id === id);
    return { status: proposal.status, version: proposal.adoptedVersion, sourceVersion: state.catalogueVersions.find((row) => row.sourceProposalId === id)?.version };
  }, proposalId);
  assert(adopted.status === "adopted" && adopted.version === 2 && adopted.sourceVersion === 2, "Kaizen adoption did not create a catalog version: " + JSON.stringify(adopted));
  await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "e0");
  await page.locator('[data-nav="quality"]').click();
  await page.getByRole("tab", { name: /Revisiones 5S/ }).click();
  await page.getByRole("button", { name: "Desplegar Orden y documentación de trabajo" }).click();
  await page.getByRole("button", { name: "Registrar revisión 5S", exact: true }).click();
  await page.getByLabel("Otro alcance").fill("Archivo de extractos de prueba");
  await page.getByLabel("Fecha de revisión").fill("2026-10-06");
  for (const area of ["classify", "order", "clean", "standardize", "sustain"]) {
    await page.locator(`[name="${area}-result"]`).selectOption("hallazgo");
    await page.locator(`[name="${area}-evidence"]`).fill(`Evidencia simulada para ${area}.`);
    await page.locator(`[name="${area}-finding"]`).fill(`Se documenta el hallazgo de ${area}.`);
    await page.locator(`[name="${area}-action"]`).fill(`Completar la acción y conservar la evidencia de ${area}.`);
    await page.locator(`[name="${area}-responsible"]`).selectOption("e0");
    await page.locator(`[name="${area}-dueOn"]`).fill("2026-10-13");
  }
  await page.getByRole("button", { name: "Guardar revisión completa", exact: true }).click();
  await page.getByRole("button", { name: "Registrar verificación" }).first().click();
  await page.getByLabel("Evidencia de corrección").fill("Índice revisado y ubicación de prueba normalizada.");
  await page.getByLabel("Fecha de verificación").fill("2026-10-07");
  await page.getByRole("button", { name: "Cerrar acción", exact: true }).click();
  assert((await page.locator(".quality-completion").count()) === 1, "5S action closure evidence did not appear");
  checks.push({ interaction: "kaizen-evidence-test-adoption-and-versioned-catalogue", proposalId, version: adopted.version });
  checks.push({ interaction: "five-s-review-and-evidence-backed-action-closure", completedActions: 1 });
  await page.screenshot({ path: path.join(output, "process-quality.png"), fullPage: true, animations: "disabled" });
  await page.locator('[data-nav="analytics"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-nav="quality"]').click();
  assert(await page.getByRole("heading", { name: "Mejorar el proceso también es parte del trabajo.", exact: true }).count() === 1, "Process quality missing on mobile");
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), "Mobile process-quality layout caused page-level horizontal overflow");
  checks.push({ interaction: "mobile-process-quality-without-page-overflow", viewport: "390x844" });
  await page.screenshot({ path: path.join(output, "process-quality-mobile.png"), fullPage: true, animations: "disabled" });
  await page.locator('[data-nav="analytics"]').click();
  assert(await page.getByRole('heading', { name: 'Ciclo de trabajo', exact: true }).count() === 1, 'Work cycle missing on mobile');
  assert(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'Mobile work-cycle layout caused page-level horizontal overflow');
  checks.push({ interaction: 'mobile-work-cycle-without-page-overflow', viewport: '390x844' });
  await page.screenshot({ path: path.join(output, 'work-cycle-mobile.png'), animations: 'disabled' });
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
  await page.setViewportSize({ width: 1440, height: 900 });
  await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "m1");
  const boardPickerFixture = await page.evaluate(() => {
    const key = "paris-state-lab";
    const state = JSON.parse(localStorage.getItem(key));
    const managedTeam = state.teams.find((team) => team.managerId === "m1");
    const base = state.profiles.find((profile) => profile.id === "e0");
    if (!managedTeam || !base) throw Error("Seed lacks a manager team for the owner-picker fixture");
    const employees = state.profiles.filter((profile) => profile.role === "empleado");
    employees.forEach((profile) => { profile.managerId = "m1"; profile.teamId = managedTeam.id; });
    while (employees.length < 23) {
      const index = state.profiles.length + 1;
      const profile = { ...base, id: `board-picker-e${index}`, name: `Integrante de equipo ${String(index).padStart(2, "0")}`, managerId: "m1", teamId: managedTeam.id };
      state.profiles.push(profile);
      employees.push(profile);
    }
    localStorage.setItem(key, JSON.stringify(state));
    return { visibleProfiles: employees.length + 1 };
  });
  await page.reload();
  await page.locator(".lab-banner").waitFor();
  await page.locator('[data-nav="tasks"]').click();
  const boardOwnerPicker = page.locator(".board-owner-filter .employee-picker");
  await boardOwnerPicker.waitFor();
  await boardOwnerPicker.getByRole("button", { name: "Perfil que estás viendo" }).click();
  const boardOwnerSearch = boardOwnerPicker.getByRole("combobox", { name: "Buscar persona en Tareas de" });
  await boardOwnerSearch.press("End");
  const boardPickerScroll = await boardOwnerPicker.evaluate((root) => {
    const list = root.querySelector(".employee-picker-listbox");
    const active = root.querySelector("[role=option][data-active=true]");
    const box = list?.getBoundingClientRect();
    const row = active?.getBoundingClientRect();
    return { count: root.querySelectorAll('[role="option"]').length, active: active?.textContent?.trim(), scrollTop: list?.scrollTop, visible: !!box && !!row && row.top >= box.top - 1 && row.bottom <= box.bottom + 1 };
  });
  assert(boardPickerFixture.visibleProfiles === 24 && boardPickerScroll.count === 24 && boardPickerScroll.scrollTop > 0 && boardPickerScroll.visible, "Board employee selector did not scroll its 24-profile list to the active option: " + JSON.stringify({ boardPickerFixture, boardPickerScroll }));
  await boardOwnerSearch.press("Shift+Tab");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Perfil que estás viendo" && !document.querySelector(".board-owner-filter .employee-picker-popover"));
  await boardOwnerPicker.getByRole("button", { name: "Perfil que estás viendo" }).click();
  const reopenedOwnerSearch = boardOwnerPicker.getByRole("combobox", { name: "Buscar persona en Tareas de" });
  await reopenedOwnerSearch.press("End");
  await reopenedOwnerSearch.press("Escape");
  checks.push({ interaction: "board-owner-selector-24-profiles-end-scroll-and-escape", boardPickerFixture, boardPickerScroll });
  assert((await page.locator('[data-nav="closing"], [data-nav="catalog"]').count()) === 0, "An encargado sees jefe-only Cierre/Catálogo navigation");
  await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "e0");
  const employeeTourTrigger = page.getByRole("button", { name: "Recorrido guiado" });
  await employeeTourTrigger.focus();
  await employeeTourTrigger.evaluate((button) => (button instanceof HTMLButtonElement) && button.click());
  assert((await page.locator(".tour-coach small").innerText()).endsWith("/11"), "Empleado tour has the wrong laboratory role-scoped step count");
  let employeeInternalTargets = 0;
  for (let step = 0; step < 11; step++) {
    const target = await page.locator(".spotlight").evaluate((node) => ({ insideModule: !!node.closest(".main"), navigation: node.hasAttribute("data-nav"), id: node.getAttribute("data-tour") }));
    assert(target.insideModule && !target.navigation && target.id, `Empleado step ${step + 1} does not point to module content: ${JSON.stringify(target)}`);
    employeeInternalTargets++;
    if (step < 10) await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  }
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-tour-trigger") === "true");
  checks.push({ interaction: "employee-tour-role-scope-and-module-targets", steps: 11, internalTargets: employeeInternalTargets });
  await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "m1");
  const managerTourTrigger = page.getByRole("button", { name: "Recorrido guiado" });
  await managerTourTrigger.focus();
  await managerTourTrigger.evaluate((button) => (button instanceof HTMLButtonElement) && button.click());
  assert((await page.locator(".tour-coach small").innerText()).endsWith("/13"), "Encargado tour has the wrong role-scoped step count");
  const managerTourTitles = [];
  let managerInternalTargets = 0;
  for (let step = 0; step < 13; step++) {
    managerTourTitles.push(await page.locator(".tour-coach h3").innerText());
    const target = await page.locator(".spotlight").evaluate((node) => ({ insideModule: !!node.closest(".main"), navigation: node.hasAttribute("data-nav"), id: node.getAttribute("data-tour") }));
    assert(target.insideModule && !target.navigation && target.id, `Encargado step ${step + 1} does not point to module content: ${JSON.stringify(target)}`);
    managerInternalTargets++;
    if (step < 12) await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  }
  assert(!managerTourTitles.some((title) => /Cierre por alcance|Catálogo y versiones/.test(title)), "Encargado tour includes jefe-only steps: " + JSON.stringify(managerTourTitles));
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-tour-trigger") === "true");
  checks.push({ interaction: "manager-tour-role-scope-and-focus-restoration", steps: managerTourTitles.length, internalTargets: managerInternalTargets, excluded: ["Cierre por alcance", "Catálogo y versiones"] });
  await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "boss");
  assert((await page.locator('[data-nav="closing"], [data-nav="catalog"]').count()) === 2, "Jefatura cannot access both Cierre and Catálogo");
  const chiefTourTrigger = page.getByRole("button", { name: "Recorrido guiado" });
  await chiefTourTrigger.focus();
  await chiefTourTrigger.evaluate((button) => (button instanceof HTMLButtonElement) && button.click());
  assert((await page.locator(".tour-coach small").innerText()).endsWith("/15"), "Jefatura tour has the wrong role-scoped step count");
  let chiefInternalTargets = 0;
  for (let step = 0; step < 13; step++) {
    const target = await page.locator(".spotlight").evaluate((node) => ({ insideModule: !!node.closest(".main"), navigation: node.hasAttribute("data-nav"), id: node.getAttribute("data-tour") }));
    assert(target.insideModule && !target.navigation && target.id, `Jefatura step ${step + 1} does not point to module content: ${JSON.stringify(target)}`);
    chiefInternalTargets++;
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  }
  const chiefTourStep = await page.locator(".tour-coach h3").innerText();
  const chiefTourProgress = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    return { activeId: state.activeId, progress: state.tour?.[state.activeId], stepId: state.tourStepId?.[state.activeId], version: state.tourVersion?.[state.activeId] };
  });
  assert(chiefTourStep === "Cierre de mes", `Jefatura tour omitted the monthly close guidance: ${JSON.stringify({ chiefTourStep, chiefTourProgress })}`);
  const closeTarget = await page.locator(".spotlight").evaluate((node) => ({ insideModule: !!node.closest(".main"), id: node.getAttribute("data-tour") }));
  assert(closeTarget.insideModule && closeTarget.id === "closure-preview", `Cierre guidance does not highlight its preview: ${JSON.stringify(closeTarget)}`);
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  assert((await page.locator(".tour-coach h3").innerText()) === "Catálogo y versiones", "Jefatura tour omitted catalogue guidance");
  const catalogueTarget = await page.locator(".spotlight").evaluate((node) => ({ insideModule: !!node.closest(".main"), id: node.getAttribute("data-tour") }));
  assert(catalogueTarget.insideModule && catalogueTarget.id === "catalogue-row", `Catalogue guidance does not highlight a task row: ${JSON.stringify(catalogueTarget)}`);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-tour-trigger") === "true");
  checks.push({ interaction: "chief-tour-includes-close-and-catalogue", internalTargets: chiefInternalTargets + 2 });
  const coverageContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const coveragePage = await coverageContext.newPage();
  coveragePage.on("pageerror", (e) => errors.push(e.message));
  coveragePage.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) apiCalls.push(r.url());
  });
  await coveragePage.goto("http://127.0.0.1:8091");
  await coveragePage.locator(".lab-banner").waitFor();
  const coverageFixture = await coveragePage.evaluate(() => {
    const key = "paris-state-lab";
    const state = JSON.parse(localStorage.getItem(key));
    const original = state.tasks.find((task) => task.kind === "resultado" && task.ownerId === "e0");
    if (!original) throw Error("Seed lacks an employee result task for coverage drag");
    const day = new Date().toISOString().slice(0, 10);
    const task = {
      ...original,
      id: "browser-s54-covered-task",
      ownerId: "e0",
      assignmentId: null,
      companyId: "c1",
      month: day.slice(0, 7),
      status: "Pendiente",
      blockedBy: "",
      dependsOnTaskIds: [],
      checklist: [],
      sessions: [],
      completedAt: null,
      scheduledOn: day,
      due: day,
    };
    delete task.responsibility;
    const replacement = state.profiles.find((profile) => profile.id === "e1");
    replacement.companyIds = [...new Set([...replacement.companyIds, task.companyId])];
    state.tasks = [...state.tasks, task];
    state.activeId = "e1";
    state.absences = [{ id: "browser-s54-absence", ownerId: "e0", replacementId: "e1", taskIds: [task.id], from: day, to: day, kind: "Vacaciones", note: "Dato ficticio E2E", createdBy: "boss" }];
    state.onboarding.e1 = { ...state.onboarding.e1, completedAt: new Date().toISOString(), home: "tasks" };
    state.tour = { ...(state.tour || {}), e1: 0 };
    state.tourStepId = { ...(state.tourStepId || {}), e1: undefined };
    state.tourVersion = { ...(state.tourVersion || {}), e1: 6 };
    localStorage.setItem(key, JSON.stringify(state));
    return { taskId: task.id, ownerId: task.ownerId, activeId: state.activeId, day };
  });
  fs.writeFileSync(path.join(output, "s54-fixture-state.json"), await coveragePage.evaluate(() => localStorage.getItem("paris-state-lab")));
  await coveragePage.reload();
  await Promise.race([
    coveragePage.locator(".lab-banner").waitFor().catch(() => {}),
    coveragePage.locator(".storage-recovery").waitFor().catch(() => {}),
  ]);
  assert((await coveragePage.locator(".storage-recovery").count()) === 0, "S54 coverage fixture did not pass laboratory state validation: " + (await coveragePage.locator("body").innerText()).slice(0, 1600));
  await coveragePage.locator('[data-nav="tasks"]').click();
  const coveredBoard = coveragePage.locator(".coverage-section .kanban");
  await coveredBoard.waitFor();
  await coveredBoard.locator(".column").nth(1).locator(".column-toggle").click();
  const coveredCard = coveredBoard.locator(`[data-task-id="${coverageFixture.taskId}"]`).first();
  const coveredDestination = coveredBoard.locator(".column").nth(1).locator('[role="region"]');
  assert((await coveredCard.getAttribute("draggable")) === "true", "Authorized covered task is not draggable");
  await coveragePage.emulateMedia({ reducedMotion: "reduce" });
  await coveredCard.dragTo(coveredDestination);
  const coveredAfterMove = await coveragePage.evaluate((id) => JSON.parse(localStorage.getItem("paris-state-lab")).tasks.find((task) => task.id === id), coverageFixture.taskId);
  assert(coveredAfterMove.status === "En curso" && coveredAfterMove.ownerId === "e0", "Covered drag changed task identity or failed: " + JSON.stringify(coveredAfterMove));
  assert(coveredAfterMove.sessions.some((session) => !session.end && session.actorId === "e1"), "Covered drag did not start the authorized replacement's clock: " + JSON.stringify(coveredAfterMove.sessions));
  assert(coveredAfterMove.sessions.every((session) => session.actorId !== "e0"), "Covered drag impersonated the task owner");
  const coveredLanding = coveredBoard.locator(`[data-task-id="${coverageFixture.taskId}"][data-landed="true"]`).first();
  await coveredLanding.waitFor({ state: "visible" });
  const reducedAnimationDuration = await coveredLanding.evaluate((card) => getComputedStyle(card).animationDuration);
  assert(reducedAnimationDuration.split(",").every((duration) => parseFloat(duration) <= 0.00001), "Reduced-motion preference retained a visible landing animation: " + reducedAnimationDuration);
  const coveredAudit = await coveragePage.evaluate((id) => JSON.parse(localStorage.getItem("paris-state-lab")).audit.filter((entry) => entry.entityId === id).at(-1), coverageFixture.taskId);
  assert(coveredAudit?.actorId === "e1", "Covered drag audit does not retain the actual actor: " + JSON.stringify(coveredAudit));
  checks.push({ interaction: "covered-task-drag-preserves-owner-and-records-replacement-actor", coverageFixture, status: coveredAfterMove.status, auditActor: coveredAudit.actorId, reducedMotion: reducedAnimationDuration });
  await coveredLanding.focus();
  await coveredLanding.press("Alt+ArrowLeft");
  const coveredAfterKeyboardMove = await coveragePage.evaluate((id) => JSON.parse(localStorage.getItem("paris-state-lab")).tasks.find((task) => task.id === id), coverageFixture.taskId);
  assert(coveredAfterKeyboardMove.status === "Pendiente" && coveredAfterKeyboardMove.ownerId === "e0", "Covered keyboard movement changed task ownership or failed: " + JSON.stringify(coveredAfterKeyboardMove));
  const coveredKeyboardCard = coveredBoard.locator(`[data-task-id="${coverageFixture.taskId}"]`).first();
  await coveredKeyboardCard.waitFor({ state: "visible" });
  assert(await coveredKeyboardCard.evaluate((card) => card === document.activeElement), "Covered keyboard movement did not restore focus to the moved card");
  const keyboardAudit = await coveragePage.evaluate((id) => JSON.parse(localStorage.getItem("paris-state-lab")).audit.filter((entry) => entry.entityId === id).at(-1), coverageFixture.taskId);
  assert(keyboardAudit?.actorId === "e1", "Covered keyboard movement audit does not retain the actual actor: " + JSON.stringify(keyboardAudit));
  checks.push({ interaction: "covered-task-keyboard-move-preserves-owner-actor-and-focus", status: coveredAfterKeyboardMove.status, focused: true, auditActor: keyboardAudit.actorId });
  await coverageContext.close();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    const id = state.activeId;
    state.tour[id] = 0;
    state.tourStepId[id] = "day-route";
    state.tourVersion[id] = 6;
    localStorage.setItem("paris-state-lab", JSON.stringify(state));
  });
  await page.reload();
  await page.locator(".lab-banner").waitFor();
  const geometryTourTrigger = page.getByRole("button", { name: "Recorrido guiado" });
  await geometryTourTrigger.focus();
  await geometryTourTrigger.evaluate((button) => (button instanceof HTMLButtonElement) && button.click());
  await page.locator(".tour-coach").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Siguiente" }).click();
  const previousTourStep = page.getByRole("button", { name: "Anterior" });
  await previousTourStep.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.activeElement?.textContent?.includes("Siguiente"));
  assert(await previousTourStep.isDisabled(), "Guided tour first-step Previous control is not disabled");
  await page.keyboard.press("Shift+Tab");
  assert(await page.evaluate(() => document.activeElement?.textContent?.includes("Pausar")), "Guided tour Shift+Tab did not wrap to the first enabled control");
  await page.keyboard.press("Tab");
  assert(await page.evaluate(() => document.activeElement?.textContent?.includes("Siguiente")), "Guided tour Tab did not skip the disabled Previous control");
  checks.push({ interaction: "s38-tour-first-step-restores-focus-and-native-keyboard-order" });
  assert((await page.locator(".tour-backdrop").count()) === 1, "Guided tour exterior dimmer is missing");
  const tourGeometry = await page.evaluate(() => {
    const target = document.querySelector(".spotlight");
    const coach = document.querySelector(".tour-coach");
    if (!target || !coach) return null;
    const rect = coach.getBoundingClientRect();
    return { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
  assert(!!tourGeometry && tourGeometry.top >= 0 && tourGeometry.left >= 0 && tourGeometry.bottom <= tourGeometry.viewportHeight && tourGeometry.right <= tourGeometry.viewportWidth, "Guided tour coach escaped the viewport: " + JSON.stringify(tourGeometry));
  checks.push({ interaction: "guided-tour-dimmer-and-target-relative-position", geometry: tourGeometry });
  await page.screenshot({ path: path.join(output, "guided-tour.png"), animations: "disabled" });
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.locator(".tour-coach").waitFor({ state: "detached" });
  assert((await page.locator(".spotlight").count()) === 0, "Guided tour highlight remained after pause");
  checks.push({ interaction: "guided-tour-pause-clears-highlight" });
  const mobileTourTrigger = page.getByRole("button", { name: "Recorrido guiado" });
  await mobileTourTrigger.focus();
  await mobileTourTrigger.evaluate((button) => (button instanceof HTMLButtonElement) && button.click());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".tour-coach").waitFor({ state: "visible" });
  const mobileTourGeometry = await page.evaluate(() => {
    const target = document.querySelector(".spotlight");
    const coach = document.querySelector(".tour-coach");
    if (!target || !coach) return null;
    const rect = coach.getBoundingClientRect();
    return { insideModule: !!target.closest(".main"), top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
  assert(!!mobileTourGeometry && mobileTourGeometry.insideModule && mobileTourGeometry.top >= 0 && mobileTourGeometry.left >= 0 && mobileTourGeometry.bottom <= mobileTourGeometry.viewportHeight && mobileTourGeometry.right <= mobileTourGeometry.viewportWidth, "Guided tour escaped mobile viewport or highlighted a non-module target: " + JSON.stringify(mobileTourGeometry));
  checks.push({ interaction: "mobile-guided-tour-target-and-coach-geometry", geometry: mobileTourGeometry });
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  const calendarFixture = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    const boss = state.profiles.find((profile) => profile.role === "jefe");
    const month = state.tasks[0].month;
    const day = `${month}-01`;
    const timestamp = `${day}T12:00:00.000Z`;
    state.fiscalObligations = [...(state.fiscalObligations || []), {
      id: "browser-origin-obligation", companyId: "c1", obligationCode: "BROWSER-IVA",
      title: "Obligación origen E2E", fiscalPeriod: month, milestone: "presentation", dueOn: day,
      sourceLabel: "Calendario ficticio E2E", sourceRevision: "E2E-01", sourceCheckedAt: day,
      revision: 1, requiredTaskIds: [], createdAt: timestamp, createdBy: boss.id, updatedAt: timestamp, history: [],
    }];
    state.calendarEvents = [...(state.calendarEvents || []), {
      id: "browser-calendar-detail", companyId: "c1", kind: "audit", title: "Auditoría de agenda E2E",
      description: "Detalle visible de auditoría", startOn: day, endOn: day, recipientIds: [boss.id],
      linkedTaskId: null, revision: 1, authorId: boss.id, createdAt: timestamp, updatedAt: timestamp,
      cancelledAt: null, cancelledBy: null,
    }];
    localStorage.setItem("paris-state-lab", JSON.stringify(state));
    return { month, day };
  });
  await page.reload();
  await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "boss");
  await page.locator('[data-nav="calendar"]').click();
  await page.getByText("Auditoría de agenda E2E", { exact: true }).waitFor();
  assert(await page.getByText("Detalle visible de auditoría", { exact: true }).count() === 1, "Calendar event description is missing");
  assert(await page.getByText(/Auditoría · Empresa 1/).count() === 1, "Calendar event type/company origin is missing");
  assert(await page.getByText(/origen: Calendario ficticio E2E · revisión E2E-01/).count() === 1, "Fiscal obligation source detail is missing");
  const calendarGrid = page.getByRole("grid", { name: "Calendario mensual" });
  const selectedCalendarDay = calendarGrid.locator(`[data-calendar-day="${calendarFixture.day}"]`);
  await selectedCalendarDay.press("ArrowLeft");
  const previousMonthLastDay = new Date(`${calendarFixture.day}T12:00:00Z`);
  previousMonthLastDay.setUTCDate(0);
  const previousCalendarDay = previousMonthLastDay.toISOString().slice(0, 10);
  assert(await calendarGrid.locator(`[data-calendar-day="${previousCalendarDay}"]`).evaluate((button) => document.activeElement === button), "Calendar left arrow did not move focus to the previous month");
  await calendarGrid.locator(`[data-calendar-day="${previousCalendarDay}"]`).press("PageDown");
  const pagedCalendarDay = `${calendarFixture.month}-${previousCalendarDay.slice(-2)}`;
  assert(await calendarGrid.locator(`[data-calendar-day="${pagedCalendarDay}"]`).evaluate((button) => document.activeElement === button), "Calendar PageDown did not preserve day-of-month and focus");
  assert(await calendarGrid.getByRole("button").evaluateAll((buttons) => buttons.filter((button) => button.tabIndex === 0).length === 1), "Calendar grid must keep one tab stop");
  await calendarGrid.locator(`[data-calendar-day="${calendarFixture.day}"]`).click();
  checks.push({ interaction: "calendar-grid-arrow-page-navigation-and-single-tab-stop", previousCalendarDay, pagedCalendarDay });
  await page.getByRole("button", { name: "Abrir obligación de origen" }).click();
  assert(await page.evaluate(() => document.activeElement?.id) === "fiscal-obligation-browser-origin-obligation", "Calendar did not focus the original fiscal obligation card");
  checks.push({ interaction: "calendar-event-details-and-fiscal-obligation-origin-navigation", calendarFixture });
  const accessibilityRoutes = ["overview", "day", "tasks", "operations", "calendar", "analytics", "closing", "team", "catalog", "quality", "planning", "absences", "annotations", "requests"];
  const renderedControlIssues = [];
  for (const route of accessibilityRoutes) {
    const navigation = page.locator(`[data-nav="${route}"]`);
    if (!(await navigation.count())) continue;
    await navigation.click();
    await navigation.waitFor({ state: "visible" });
    await page.locator(".section-loading").waitFor({ state: "detached" }).catch(() => {});
    const issues = await page.evaluate(() => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        return !element.hidden && style.display !== "none" && style.visibility !== "hidden" && !element.closest("details:not([open])") && element.getClientRects().length > 0;
      };
      const referencedName = (element) => (element.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean)
        .map((id) => document.getElementById(id)?.innerText || "").join(" ").trim();
      const buttons = [...document.querySelectorAll("button")].filter(visible).flatMap((button) => {
        const name = button.getAttribute("aria-label") || referencedName(button) || button.getAttribute("title") || button.innerText || button.textContent ||
          [...button.querySelectorAll("svg[aria-label]")].map((icon) => icon.getAttribute("aria-label")).join(" ");
        return name.trim() ? [] : [`button:${button.className || "(no class)"}`];
      });
      const fields = [...document.querySelectorAll("input,select,textarea")].filter((field) => visible(field) && field.type !== "hidden").flatMap((field) => {
        const name = field.getAttribute("aria-label") || referencedName(field) || field.getAttribute("title") || (field.labels?.length ? [...field.labels].map((label) => label.innerText).join(" ") : "");
        return name.trim() ? [] : [`${field.tagName.toLowerCase()}:${field.name || field.type || "(unnamed)"}`];
      });
      return [...buttons, ...fields];
    });
    if (issues.length) renderedControlIssues.push({ route, issues });
  }
  assert(!renderedControlIssues.length, "Visible controls without accessible names: " + JSON.stringify(renderedControlIssues));
  checks.push({ interaction: "rendered-accessible-names-across-manager-sections", routes: accessibilityRoutes, unnamedControls: 0 });
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
          "internal request routing, response, resolution and persistence",
          "jefatura-only explicit one-off request-to-task conversion with provenance and no duplicate",
          "daily and weekly monthly work-cycle with team breakdown",
          "accent-insensitive global quick task search scoped to employee access",
          "Kaizen evidence, controlled trial, manager adoption and catalogue versioning",
          "five-area 5S review and evidence-backed corrective action closure",
          "fiscal obligation linked to exact tasks with separate fiscal period, due date, and revision history",
          "desktop and mobile process-quality layout",
          "persisted review",
          "mobile",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: responsive sidebar, logos, laboratory, invitation, drag-and-drop, access-scoped quick task search, internal request conversion, review notification, persistence, mobile; zero operational API calls and JS errors.",
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
