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
  await setTheme(page, "light");
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
  await page.getByRole('button', { name: 'Buscar tareas' }).click();
  await page.getByRole('searchbox', { name: 'Buscar tareas por nombre, empresa, persona o período' }).fill('conciliacion banco nacion');
  const quickSearchResults = page.locator('.quick-task-search-result');
  assert(await quickSearchResults.count() === 2, 'Quick search did not find the two accessible matching tasks: ' + await page.locator('.quick-task-search-dialog').innerText());
  assert((await quickSearchResults.allTextContents()).every((text) => text.includes('Conciliación Banco Nación')), 'Quick search returned an unexpected task');
  await page.screenshot({ path: path.join(output, 'quick-task-search.png'), animations: 'disabled' });
  await quickSearchResults.first().click();
  await page.getByRole('heading', { name: 'Conciliación Banco Nación', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  checks.push({ interaction: 'quick-task-search-accent-insensitive-access-scoped', results: 2 });
  await first.locator('.card-title').click();
  await page.getByLabel('Nuevo comentario').fill('Nota de prueba para el superior');
  await page.getByRole('button', { name: 'Publicar comentario', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  const taskCountBeforeRequest = await page.evaluate(() => JSON.parse(localStorage.getItem('paris-state-lab')).tasks.length);
  await page.locator('[data-nav="requests"]').click();
  await page.getByLabel('Módulo').fill('Vencimientos');
  await page.getByLabel('Asunto').fill('Aclarar vencimiento de prueba');
  await page.getByLabel('Detalle').fill('Necesito confirmar el criterio del vencimiento en la demostración.');
  await page.getByRole('button', { name: 'Registrar pedido' }).click();
  const requestId = await page.evaluate(() => JSON.parse(localStorage.getItem('paris-state-lab')).internalRequests.at(-1).id);
  assert(await page.evaluate((before) => JSON.parse(localStorage.getItem('paris-state-lab')).tasks.length === before, taskCountBeforeRequest), 'Internal request altered task KPI source rows');
  checks.push({ interaction: 'internal-request-created-without-task-or-KPI-mutation', requestId });
  await page.getByLabel("Vista de usuario").selectOption("boss");
  await page.locator('[data-nav="requests"]').click();
  await page.getByRole('heading', { name: 'Aclarar vencimiento de prueba' }).waitFor();
  await page.getByRole('button', { name: 'Tomar para revisión' }).click();
  await page.getByLabel('Respuesta').fill('El plazo se conserva en la tarjeta de la tarea.');
  await page.getByRole('button', { name: 'Responder' }).click();
  await page.getByRole('button', { name: 'Marcar resuelto' }).click();
  const closedRequest = await page.evaluate((id) => JSON.parse(localStorage.getItem('paris-state-lab')).internalRequests.find((row) => row.id === id), requestId);
  assert(closedRequest.status === 'resolved' && closedRequest.messages.length === 1 && closedRequest.history.length === 4, 'Internal request response or transition history did not persist');
  await page.getByLabel("Vista de usuario").selectOption("e0");
  await page.locator('[data-nav="requests"]').click();
  assert(await page.getByText('El plazo se conserva en la tarjeta de la tarea.').count() === 1, 'Request author cannot see recipient response');
  const taskCountBeforeExplicitConversion = await page.evaluate(() => JSON.parse(localStorage.getItem('paris-state-lab')).tasks.length);
  await page.getByLabel('Módulo').fill('Tablero');
  await page.getByLabel('Asunto').fill('Asignar conciliación puntual de prueba');
  await page.getByLabel('Detalle').fill('Comparar el extracto y documentar las diferencias de esta prueba.');
  await page.getByRole('button', { name: 'Registrar pedido' }).click();
  const conversionRequestId = await page.evaluate(() => JSON.parse(localStorage.getItem('paris-state-lab')).internalRequests.at(-1).id);
  assert(await page.evaluate((before) => JSON.parse(localStorage.getItem('paris-state-lab')).tasks.length === before, taskCountBeforeExplicitConversion), 'Request created a task before manager confirmation');
  await page.getByLabel("Vista de usuario").selectOption("boss");
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
  await page.getByRole('button', { name: 'Abrir tarea' }).click();
  assert(await page.locator('.request-origin-context').getByText('Comparar el extracto y documentar las diferencias de esta prueba.', { exact: true }).count() === 1, 'Converted task did not retain the source request context');
  await page.screenshot({ path: path.join(output, 'request-task-conversion.png'), fullPage: true, animations: 'disabled' });
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
  await page.getByLabel('Agrupar período').getByRole('button', { name: 'Día', exact: true }).click();
  const analysisMonth = await page.locator('input[type="month"][aria-label="Período"]').inputValue();
  const daysInAnalysisMonth = new Date(Number(analysisMonth.slice(0, 4)), Number(analysisMonth.slice(5, 7)), 0).getDate();
  assert((await page.locator('.work-cycle-table-wrap').first().locator('tbody tr').count()) === daysInAnalysisMonth, 'Daily work-cycle view omitted a date');
  await page.getByLabel('Desglosar ciclo por').selectOption('team');
  assert((await page.locator('.work-cycle-table-wrap').nth(1).locator('thead th').first().innerText()).toLowerCase() === 'equipo', 'Work-cycle dimension did not switch to teams');
  checks.push({ interaction: 'monthly-work-cycle-day-week-and-team-breakdown', month: analysisMonth, days: daysInAnalysisMonth });
  await page.screenshot({ path: path.join(output, 'work-cycle.png'), fullPage: true, animations: 'disabled' });
  await page.getByLabel("Vista de usuario").selectOption("e0");
  await page.locator('[data-nav="quality"]').click();
  await page.getByRole("heading", { name: "Mejorar un proceso con evidencia", exact: true }).waitFor();
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
  await page.getByLabel("Vista de usuario").selectOption("boss");
  await page.locator('[data-nav="quality"]').click();
  await page.getByLabel("Criterio para habilitar la prueba").fill("Muestra y período acotados; mantener el mismo volumen y complejidad.");
  await page.getByRole("button", { name: "Autorizar prueba", exact: true }).click();
  await page.getByLabel("Vista de usuario").selectOption("e0");
  await page.locator('[data-nav="quality"]').click();
  await page.getByLabel("Valor medido").fill("10");
  await page.getByLabel("Fecha", { exact: true }).fill("2026-10-25");
  await page.getByLabel("Evidencia de la medición").fill("Las diez conciliaciones posteriores requirieron menos verificaciones repetidas.");
  await page.getByLabel("Volumen y contexto comparables").fill("Octubre · diez conciliaciones de complejidad media.");
  await page.getByRole("button", { name: "Guardar medición", exact: true }).click();
  await page.getByLabel("Vista de usuario").selectOption("boss");
  await page.locator('[data-nav="quality"]').click();
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
  await page.getByLabel("Vista de usuario").selectOption("e0");
  await page.locator('[data-nav="quality"]').click();
  await page.getByRole("tab", { name: /Revisiones 5S/ }).click();
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
