const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn } = require("node:child_process"),
  pw = require("playwright-core");
const { selectProfile } = require("./browser-helpers.cjs");
const root = path.resolve(__dirname, "..");
async function setTheme(page, target) {
  const toggle = page.locator(".theme-toggle");
  for (let step = 0; step < 3; step++) {
    if ((await toggle.getAttribute("data-theme")) === target) return;
    await toggle.click();
  }
  throw Error(`theme cycle did not reach ${target}`);
}
const binary = process.env.CHROMIUM_PATH;
if (!binary)
  throw Error(
    "Definí CHROMIUM_PATH con un Chromium instalado; ejecutar npm run build antes.",
  );
const output =
  process.env.E2E_OUTPUT ||
  fs.mkdtempSync(path.join(os.tmpdir(), "paris-e2e-"));
fs.mkdirSync(output, { recursive: true });
(async () => {
  let browser;
  const server = spawn(
    process.execPath,
    [
      root + "/node_modules/vite/bin/vite.js",
      "preview",
      "--outDir",
      "dist/client",
      "--host",
      "127.0.0.1",
      "--port",
      "8090",
    ],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  try {
    await new Promise((resolve, reject) => {
      server.stdout.on("data", (x) => {
        if (x.toString().includes("Local:")) resolve();
      });
      server.on("error", reject);
      setTimeout(() => reject(Error("server timeout")), 10000);
    });
    browser = await pw.chromium.launch({
      executablePath: binary,
      args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
      headless: true,
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    const apiRequests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin === "http://127.0.0.1:8090" && url.pathname.startsWith("/api/"))
        apiRequests.push(url.pathname);
    });
    await page.goto("http://127.0.0.1:8090");
    await page.locator("h1").waitFor();
    await page.screenshot({ path: output + "/overview.png", fullPage: true });
    console.log("overview", await page.locator("h1").innerText());
    for (const title of ["Avance ponderado del equipo", "Dónde está el trabajo"]) {
      const toggle = page.getByRole("button", { name: `Plegar ${title}` });
      await toggle.waitFor();
      const bodyId = await toggle.getAttribute("aria-controls");
      await toggle.click();
      if ((await toggle.getAttribute("aria-expanded")) !== "false" || !(await page.locator(`#${bodyId}`).isHidden()))
        throw Error(`${title} panel did not collapse`);
      await page.getByRole("button", { name: `Desplegar ${title}` }).click();
    }
    await setTheme(page, "dark");
    if (
      (await page.evaluate(() => document.documentElement.dataset.theme)) !==
      "dark"
    )
      throw Error("dark theme");
    await page.locator('[data-nav="tasks"]').click();
    await page.waitForFunction(
      () =>
        !!document.querySelector(".heading .primary") &&
        getComputedStyle(document.querySelector(".heading .primary"))
          .backgroundColor === "rgb(220, 229, 243)",
    );
    await page.screenshot({
      animations: "disabled",
      path: output + "/dark-tasks.png",
      fullPage: false,
    });
    await setTheme(page, "system");
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    await setTheme(page, "light");

    await page.locator('[data-nav="team"]').click();
    await page.getByRole("button", { name: "Alta de demostración" }).click();
    await page.locator('input[name="name"]').fill("Empleado QA");
    await page.locator('input[name="position"]').fill("Analista");
    await page
      .getByRole("button", { name: "Crear y probar inducción" })
      .click();
    await page
      .getByRole("button", { name: "Guardar y continuar después" })
      .click();
    if (
      await page
        .getByRole("button", { name: "Nueva tarea", exact: true })
        .count()
    )
      throw Error("induction pause bypass");
    await page.getByRole("button", { name: "Continuar inducción" }).click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.locator(".choices input[type=checkbox]").nth(1).check();
    await page.locator(".paris-business-unit-picker .choices input[type=checkbox]").first().check();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    const bankTask = page.locator(".paris-task-catalog-item").filter({ hasText: "Conciliación Banco Nación" });
    await bankTask.getByRole("button", { name: /PARIS AUTOS/ }).click();
    await bankTask.getByLabel("banco · fijado por selección").waitFor();
    await bankTask.getByLabel("cuenta · obligatorio").fill("Cuenta QA");
    const invoiceTask = page.locator(".paris-task-catalog-item").filter({ hasText: /^Carga de facturas de proveedores · Provisional/ });
    await invoiceTask.getByRole("button", { name: /PARIS AUTOS/ }).click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.reload();
    if (!(await page.locator(".induction-top").innerText()).includes("4 DE 6"))
      throw Error("onboarding resume");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.screenshot({ path: output + "/onboarding.png", fullPage: true });
    await page.getByRole("button", { name: "Preparar mi tablero" }).click();
    await page.getByRole("button", { name: "Pausar", exact: true }).click();
    await page.locator('[data-nav="tasks"]').click();
    const onboardingState = await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")));
    const qaProfileId = onboardingState.profiles.find((profile) => profile.name === "Empleado QA")?.id;
    const qaProposals = onboardingState.habitualTaskProposals.filter((proposal) => proposal.ownerId === qaProfileId);
    if (qaProposals.length !== 4 || new Set(qaProposals.map((proposal) => `${proposal.taskCode}:${proposal.companyId}`)).size !== 4)
      throw Error(`onboarding must create four distinct pending proposals (two tasks x two companies), got ${JSON.stringify(qaProposals.map(({ taskCode, companyId }) => ({ taskCode, companyId })))}`);
    const bankProposals = qaProposals.filter((proposal) => proposal.taskCode === "gpar_bank_reconciliation");
    if (bankProposals.length !== 2 || bankProposals.some((proposal) => proposal.taskParameters?.banco !== "nacion" || proposal.taskParameters?.cuenta !== "Cuenta QA"))
      throw Error("bank proposals lost their canonical bank/account parameters");
    if (onboardingState.tasks.length !== 73 || onboardingState.assignments.length !== 73)
      throw Error("onboarding proposals must not create task instances or assignments before approval");
    await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "e0");
    await page.locator('[data-nav="tasks"]').click();
    // A historical proposal with no catalogue fields must remain untouched until
    // the owner explicitly classifies a new revision from the canonical catalogue.
    await page.evaluate(() => {
      const key = "paris-state-lab";
      const state = JSON.parse(localStorage.getItem(key));
      const source = state.habitualTaskProposals.find((proposal) => proposal.taskCode === "gpar_bank_reconciliation");
      if (!source) throw Error("canonical QA proposal missing for legacy replay");
      const legacy = structuredClone(source);
      legacy.id = "browser-legacy-proposal";
      legacy.ownerId = "e0";
      legacy.companyId = "c1";
      legacy.title = "Conciliación Banco Nación";
      legacy.originalTitle = "Conciliación Banco Nación";
      legacy.process = "Banco Nación";
      legacy.status = "changes_requested";
      legacy.managerNote = "Elegí la tarea y unidad del catálogo París.";
      legacy.revision = 1;
      for (const field of ["taskCode", "taskCatalogVersion", "businessUnitCode", "taskParameters"]) delete legacy[field];
      legacy.submissions = [structuredClone(legacy.submissions[0])];
      legacy.submissions[0].revision = 1;
      for (const field of ["taskCode", "taskCatalogVersion", "businessUnitCode", "taskParameters"]) delete legacy.submissions[0][field];
      state.habitualTaskProposals.push(legacy);
      localStorage.setItem(key, JSON.stringify(state));
    });
    await page.reload();
    await page.locator('[data-nav="day"]').click();
    const legacyProposalCard = page.locator(".my-habitual-proposal").filter({ has: page.locator("h3").filter({ hasText: /^Conciliación Banco Nación$/ }) });
    await legacyProposalCard.waitFor();
    await legacyProposalCard.getByRole("combobox", { name: "Tarea del catálogo París" }).selectOption("gpar_bank_reconciliation");
    await legacyProposalCard.getByRole("combobox", { name: "Unidad de negocio" }).selectOption("doral");
    await legacyProposalCard.getByRole("combobox", { name: "banco · obligatorio" }).selectOption("frances");
    await legacyProposalCard.getByRole("textbox", { name: "cuenta · obligatorio" }).fill("Cuenta QA");
    await legacyProposalCard.getByRole("button", { name: "Reenviar para revisión" }).click();
    const reclassifiedLegacy = await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")).habitualTaskProposals.find((proposal) => proposal.id === "browser-legacy-proposal"));
    if (reclassifiedLegacy.revision !== 2 || reclassifiedLegacy.taskCode !== "gpar_bank_reconciliation" || reclassifiedLegacy.businessUnitCode !== "doral" || reclassifiedLegacy.taskParameters?.banco !== "frances" || reclassifiedLegacy.submissions.length !== 2 || reclassifiedLegacy.submissions[0].taskCode !== undefined || reclassifiedLegacy.originalTitle !== "Conciliación Banco Nación")
      throw Error(`legacy proposal classification did not preserve its unknown history: ${JSON.stringify(reclassifiedLegacy)}`);
    if (reclassifiedLegacy.assignments?.length || (await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")).tasks.length)) !== 73)
      throw Error("reclassifying a proposal must not materialize work before approval");
    await page.locator('[data-nav="tasks"]').click();
    const checklistTaskId = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("paris-state-lab"));
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      return state.tasks.find((task) => task.ownerId === state.activeId && task.kind === "resultado" && task.status === "Pendiente" && !task.blockedBy && (!task.availableFrom || task.availableFrom <= today) && (task.dependsOnTaskIds || []).every((id) => state.tasks.some((dependency) => dependency.id === id && dependency.status === "Completada")))?.id;
    });
    if (!checklistTaskId) throw Error("ready pending seeded deliverable missing");
    const card = page.locator(`.task-card[data-task-id="${checklistTaskId}"]`);
    await card.locator(".card-title").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading", { name: "Checklist", exact: true }).waitFor();
    const checks = dialog.locator("input[type=checkbox]");
    const checklistCount = await checks.count();
    if (!checklistCount) throw Error("onboarding result task did not render its checklist");
    await dialog.getByRole("button", { name: "Iniciar tarea" }).click();
    for (let i = 0; i < (await checks.count()); i++)
      if (await checks.nth(i).isEnabled()) await checks.nth(i).check();
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    let stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("paris-state-lab")),
    );
    let mine = stored.tasks.filter(
      (t) => t.ownerId === stored.activeId && t.kind === "resultado",
    );
    const completedChecklistTask = mine.find((task) => task.id === checklistTaskId);
    if (!completedChecklistTask || completedChecklistTask.status !== "Completada" || !completedChecklistTask.checklist?.every((step) => step.done))
      throw Error(`existing deliverable checklist did not complete: ${JSON.stringify(mine.map((t) => ({ id: t.id, companyId: t.companyId, status: t.status, checklist: t.checklist?.map((step) => step.done) })))}`);
    await page.locator('[data-nav="operations"]').click();
    await page
      .getByRole("button", { name: "Registrar", exact: true })
      .first()
      .click();
    await page.locator('input[name="qty"]').fill("12");
    await page
      .locator('input[name="note"],textarea[name="note"]')
      .fill("Lote QA");
    await page.getByRole("dialog").locator("button.primary").click();
    stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("paris-state-lab")),
    );
    if (!stored.activity.some((a) => a.qty === 12 && a.note === "Lote QA"))
      throw Error("activity not saved");
    await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "boss");
    await page.locator('[data-nav="analytics"]').click();
    for (const name of ["Por equipo", "Por sector", "Por empleado"])
      await page.getByRole("button", { name, exact: true }).click();
    await page.getByLabel("Empresa", { exact: true }).selectOption("c1");
    await page.locator('[data-nav="closing"]').click();
    await page.getByRole("heading", { name: /Cierres por empresa/ }).waitFor();
    const closeFieldLabels = await page.locator(".lab-close-controls label").evaluateAll((labels) => labels.map((label) => ({ text: label.innerText, controlCount: label.querySelectorAll("select").length })));
    if (closeFieldLabels.length !== 1 || closeFieldLabels[0].text.split("\n")[0] !== "Alcance" || closeFieldLabels[0].controlCount !== 1)
      throw Error(`closure scope control label mismatch: ${JSON.stringify(closeFieldLabels)}`);
    const qaId = await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")).profiles.find((profile) => profile.id === "e1").id);
    await page.locator(".lab-close-controls select").nth(0).selectOption("person");
    await page.locator(".lab-close-controls select").nth(1).selectOption(qaId);
    await page.locator(".lab-close-form textarea").fill("Revisión mensual QA");
    const closeConfirmation = page.locator(".lab-close-form input[type=checkbox]");
    await closeConfirmation.check();
    await page.getByRole("button", { name: "Cerrar 4 unidades listas", exact: true }).click();
    stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("paris-state-lab")),
    );
    const closure = stored.closures.find(
      (c) => c.note === "Revisión mensual QA",
    );
    if (
      closure.tasks.length !== 6 ||
      new Set(closure.tasks.map((t) => t.companyId)).size !== 4
    )
      throw Error("closure must include all companies despite filter");
    const companyClosures = stored.companyClosures.filter((entry) => entry.ownerId === qaId && entry.month === "2026-10");
    if (companyClosures.length !== 4 || new Set(companyClosures.map((entry) => entry.companyId)).size !== 4)
      throw Error("monthly consolidation did not preserve its four company closure units");
    await page.getByRole("button", { name: "Desplegar Reportes emitidos al cierre" }).click();
    await page.getByRole("button", { name: "Ver reporte" }).first().click();
    await page.evaluate(() => {
      window.__reportPrintCalled = false;
      window.print = () => { window.__reportPrintCalled = true; };
    });
    await page.getByRole("button", { name: "Imprimir reporte" }).click();
    if (!(await page.evaluate(() => window.__reportPrintCalled)))
      throw Error("print action did not invoke the browser print dialog");
    await page.emulateMedia({ media: "print" });
    const printLayout = await page.evaluate(() => ({
      reportVisible: getComputedStyle(document.querySelector("dialog.period-report-dialog")).visibility,
      sidebarVisible: getComputedStyle(document.querySelector(".sidebar")).visibility,
      printActionsDisplay: getComputedStyle(document.querySelector(".period-report-actions")).display,
      tableOverflow: getComputedStyle(document.querySelector("dialog.period-report-dialog .table-wrap")).overflow,
      reportWidth: document.querySelector("dialog.period-report-dialog").getBoundingClientRect().width,
      viewportWidth: innerWidth,
    }));
    if (
      printLayout.reportVisible !== "visible" ||
      printLayout.sidebarVisible !== "hidden" ||
      printLayout.printActionsDisplay !== "none" ||
      printLayout.tableOverflow !== "visible" ||
      printLayout.reportWidth < printLayout.viewportWidth * 0.85
    )
      throw Error(`report print layout is incomplete: ${JSON.stringify(printLayout)}`);
    await page.screenshot({ path: output + "/period-report-print.png", fullPage: true });
    await page.emulateMedia({ media: "screen" });
    await page.getByRole("dialog").getByRole("button", { name: "Cerrar", exact: true }).click();
    await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", qaId);
    await page.locator('[data-nav="tasks"]').click();
    const closedCard = page
      .locator(".task-card")
      .filter({ hasText: "Lucía Fernández" })
      .first();
    if (
      (await closedCard.locator("button.quick").count()) ||
      !(await closedCard.getByText("Cerrado", { exact: true }).count())
    )
      throw Error("closed card not locked");
    await closedCard.locator(".card-title").click();
    if (
      !(await page
        .getByRole("dialog")
        .locator("input[type=checkbox]")
        .first()
        .isDisabled())
    )
      throw Error("closed checklist not locked");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cerrar", exact: true })
      .click();
    await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "boss");
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await page.locator('[data-nav="analytics"]').click();
    await page.screenshot({ path: output + "/analytics.png", fullPage: true });

    await page.locator('[data-nav="tasks"]').click();
    await page.getByLabel("Período", { exact: true }).fill("2026-10");
    await page
      .getByRole("button", { name: "Nueva tarea", exact: true })
      .click();
    const previousAssignmentIds = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("paris-state-lab")).assignments.map(
        (assignment) => assignment.id,
      ),
    );
    await page.getByLabel("Elegí del catálogo").selectOption("gpar_bank_reconciliation");
    await page.getByLabel("Unidad de negocio").selectOption("paris_autos");
    await page.getByLabel("banco · obligatorio").selectOption("frances");
    await page.getByLabel("cuenta · obligatorio").fill("Principal");
    await page.locator('select[name="company"]').selectOption("c1");
    await page.locator('select[name="owner"]').selectOption("e0");
    const frequencyOptions = await page.getByLabel("Frecuencia de la tarea").locator("option").allTextContents();
    if (frequencyOptions.some((option) => /semanal|mensual|diaria/.test(option.toLowerCase())))
      throw Error("unapproved canonical work exposed recurring schedule options");
    await page.getByLabel("Fecha de realización", { exact: true }).fill("2026-10-05");
    await page.getByLabel("Tiene vencimiento").check();
    await page.getByLabel(/Plazo desde cada/).fill("2");
    await page.getByRole("button", { name: "Crear tarea", exact: true }).click();
    const canonicalAssignmentId = await page.evaluate((previousIds) => {
      const state = JSON.parse(localStorage.getItem("paris-state-lab"));
      return state.assignments.find(
        (assignment) =>
          !previousIds.includes(assignment.id) &&
          assignment.taskCode === "gpar_bank_reconciliation" &&
          assignment.ownerId === "e0" &&
          assignment.companyId === "c1",
      )?.id;
    }, previousAssignmentIds);
    if (!canonicalAssignmentId) throw Error("canonical one-off assignment missing");
    let canonicalTasks = await page.evaluate((assignmentId) =>
      JSON.parse(localStorage.getItem("paris-state-lab")).tasks
        .filter((task) => task.assignmentId === assignmentId)
        .sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn)),
      canonicalAssignmentId,
    );
    if (canonicalTasks.length !== 1 || canonicalTasks[0].scheduledOn !== "2026-10-05" || canonicalTasks[0].due !== "2026-10-07")
      throw Error("canonical one-off actual date or deadline");
    await page.getByLabel("Período", { exact: true }).fill("2026-10");
    const canonicalTaskId = canonicalTasks[0].id;
    await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "e0");
    await page.locator('[data-nav="tasks"]').click();
    const timedCard = page.locator(`.task-card[data-task-id="${canonicalTaskId}"]`);
    await timedCard
      .getByRole("button", { name: /Iniciar.*Conciliación bancaria/ })
      .click();
    await page.reload();
    stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("paris-state-lab")),
    );
    let timing = stored.tasks.find(
      (task) => task.assignmentId === canonicalAssignmentId && task.sessions?.some((session) => !session.end),
    );
    if (!timing) throw Error("timer persistence");
    await page
      .locator(".active-clock")
      .getByRole("button", { name: "Pausar cronómetro" })
      .click();
    stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("paris-state-lab")),
    );
    if (stored.tasks.some((t) => t.sessions?.some((e) => !e.end)))
      throw Error("pause did not stop timer");
    await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", "boss");
    await page.locator('[data-nav="absences"]').click();
    await page.getByRole("button", { name: "Registrar ausencia" }).click();
    await page.getByLabel("Persona ausente").selectOption("e0");
    await page.getByLabel("Desde").fill("2026-10-05");
    await page.getByLabel("Hasta").fill("2026-10-31");
    await page.getByLabel("Quién cubre").selectOption("e1");
    await page
      .locator(".coverage-task-selection")
      .filter({ hasText: "Reglas recurrentes incluidas en el rango" })
      .locator('input[type="checkbox"]')
      .first()
      .check();
    await page.getByLabel("Traspaso operativo").fill("Cobertura E2E");
    await page
      .getByRole("button", { name: "Guardar ausencia", exact: true })
      .click();
    const absencePanel = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Vacaciones, licencias y cobertura" }) });
    const absenceToggle = absencePanel.locator(".panel-collapse");
    if ((await absenceToggle.getAttribute("aria-expanded")) !== "true") await absenceToggle.click();
    await page.getByRole("row").filter({ hasText: "Cobertura E2E" }).waitFor();
    await page.screenshot({ path: output + "/absence.png", fullPage: false });
    const mainBefore = await page.evaluate(() =>
      localStorage.getItem("paris-state-v3"),
    );
    await page.locator(".lab-banner").waitFor();
    const isolatedLabTask = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("paris-state-lab"));
      const task = state.tasks.find((entry) => entry.taskCode === "gpar_bank_reconciliation" && entry.ownerId === "e0" && entry.companyId === "c1" && entry.taskParameters?.cuenta === "Principal");
      const owner = state.profiles.find((profile) => profile.id === "e0");
      return { task, teamExists: state.teams.some((team) => team.id === owner?.teamId) };
    });
    if (!isolatedLabTask.task || !isolatedLabTask.teamExists)
      throw Error("Canonical laboratory task did not persist with an existing responsible team");
    if (
      (await page.evaluate(() => localStorage.getItem("paris-state-v3"))) !==
      mainBefore
    )
      throw Error("lab changed main data");
    await page.screenshot({ path: output + "/lab.png", fullPage: false });

    const reminderId = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("paris-state-lab"));
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const [year, month, day] = today.split("-").map(Number);
      const due = new Date(Date.UTC(year, month - 1, day + 3)).toISOString().slice(0, 10);
      const source = state.tasks.find((task) => task.ownerId === "e0" && task.kind === "resultado");
      if (!source) throw Error("deadline reminder fixture missing");
      state.activeId = "boss";
      state.tasks.push({
        ...source,
        id: "browser-deadline-reminder",
        month: due.slice(0, 7),
        due,
        scheduledOn: due,
        status: "Pendiente",
        completedAt: null,
        sessions: [],
      });
      state.notifications = [];
      localStorage.setItem("paris-state-lab", JSON.stringify(state));
      window.__deadlineReminderLabState = state;
      return { id: `deadline:boss:due-in-three-days:${today}`, title: source.title };
    });
    fs.writeFileSync(
      path.join(output, "deadline-reminder-state.json"),
      JSON.stringify(await page.evaluate(() => window.__deadlineReminderLabState), null, 2),
    );
    await page.reload();
    await page.locator(".lab-banner").waitFor({ timeout: 5000 }).catch(async () => {
      throw Error(`Laboratory state failed to reload: ${await page.locator("body").innerText()}`);
    });
    await page.getByRole("button", { name: /Notificaciones:/ }).click();
    await page.getByText("1 tarea vence en 3 días").waitFor();
    await page.screenshot({ path: output + "/deadline-reminders.png", fullPage: false });
    await page.locator(".deadline-reminder-list > li")
      .filter({ hasText: "1 tarea vence en 3 días" })
      .getByRole("button", { name: `Abrir tarea: ${reminderId.title}` })
      .click();
    const reminderReadAt = await page.evaluate((id) =>
      JSON.parse(localStorage.getItem("paris-state-lab")).deadlineReminderReads?.[id],
      reminderId.id,
    );
    if (!reminderReadAt) throw Error("deadline reminder read receipt not persisted");
    await page.getByRole("dialog").getByRole("button", { name: "Cerrar", exact: true }).click();
    await page.getByRole("button", { name: /Notificaciones:/ }).click();
    const reminderClass = await page.locator(".deadline-reminder-list > li")
      .filter({ hasText: "1 tarea vence en 3 días" })
      .getAttribute("class");
    if (reminderClass?.includes("unread")) throw Error("deadline reminder remained unread");
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();

    await page.locator('[data-nav="overview"]').click();
    await page.locator("h1").waitFor();
    if ((await page.locator(".lab-banner").count()) !== 1)
      throw Error("isolated lab banner missing");
    await setTheme(page, "dark");
    await page.locator('[data-nav="analytics"]').click();

    for (const title of ["Cumplimiento ponderado", "Evolución mensual", "Distribución de tareas"]) {
      const toggle = page.getByRole("button", { name: `Plegar ${title}` });
      await toggle.waitFor();
      const bodyId = await toggle.getAttribute("aria-controls");
      await toggle.click();
      if ((await toggle.getAttribute("aria-expanded")) !== "false")
        throw Error(`${title} panel did not collapse`);
      if (!(await page.locator(`#${bodyId}`).isHidden()))
        throw Error(`${title} panel content remained visible after collapse`);
      await page.getByRole("button", { name: `Desplegar ${title}` }).click();
      if ((await page.getByRole("button", { name: `Plegar ${title}` }).getAttribute("aria-expanded")) !== "true")
        throw Error(`${title} panel did not reopen`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("heading", { name: "Cumplimiento ponderado" }).waitFor();
    await page.screenshot({ path: output + "/mobile.png", fullPage: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    if (overflow) throw Error("mobile viewport overflow");
    await page.getByRole("button", { name: /Notificaciones:/ }).click();
    await page.getByText("1 tarea vence en 3 días").waitFor();
    await page.screenshot({ path: output + "/deadline-reminders-mobile.png", fullPage: false });
    const dialogWidth = await page.getByRole("dialog").evaluate((dialog) => dialog.getBoundingClientRect().width);
    if (dialogWidth > 390) throw Error(`mobile notification dialog overflows viewport: ${dialogWidth}`);
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await page.locator('[data-nav="gemelo"]').click();
    await page.getByRole("heading", { name: "El trabajo contable, en contexto." }).waitFor();
    await page.getByRole("textbox", { name: "¿Qué necesitás resolver?" }).fill("Conciliación");
    await page.getByRole("button", { name: "Consultar" }).click();
    await page.getByRole("heading", { name: "Próximas acciones" }).waitFor();
    if (!(await page.locator(".gemelo-list li").count())) throw Error("Gemelo task search did not return the canonical reconciliation tasks");
    await page.screenshot({ path: output + "/gemelo-mobile.png", fullPage: true });
    const gemeloOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (gemeloOverflow) throw Error("Gemelo mobile viewport overflow");
    if (errors.length) throw Error(errors.join("\n"));
    if (apiRequests.length) throw Error(`isolated lab requested API routes: ${apiRequests.join(", ")}`);
    console.log(
      "PASS induction, resume, canonical pending proposals, historical proposal reclassification, company isolation, auto-checklist, activity, analysis grouping, complete monthly closure, write lock, canonical task classification, one-off deadline, timers, absences, isolated lab, due reminders and persisted read receipt, IVA/Gemelo navigation and search, system/light/dark themes, mobile. No JS errors or API requests.",
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
