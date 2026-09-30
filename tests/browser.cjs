const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn } = require("node:child_process"),
  pw = require("playwright-core");
const root = path.resolve(__dirname, "..");
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
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:8090");
    await page.locator("h1").waitFor();
    await page.screenshot({ path: output + "/overview.png", fullPage: true });
    console.log("overview", await page.locator("h1").innerText());
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
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page
      .locator(".catalog-option")
      .filter({ hasText: "Conciliación Banco Nación" })
      .locator("input")
      .check();
    await page
      .locator(".catalog-option")
      .filter({ hasText: "Carga de facturas" })
      .locator("input")
      .check();
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
    if ((await page.locator(".task-card").count()) !== 2)
      throw Error("two distinct company results expected");
    const card = page.locator(".task-card").first();
    await card.locator(".card-title").click();
    const dialog = page.getByRole("dialog");
    const checks = dialog.locator("input[type=checkbox]");
    for (let i = 0; i < (await checks.count()); i++)
      await checks.nth(i).check();
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    let stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("paris-state-v3")),
    );
    let mine = stored.tasks.filter(
      (t) => t.ownerId === stored.activeId && t.kind === "resultado",
    );
    if (
      mine.filter((t) => t.status === "Completada").length !== 1 ||
      mine.filter((t) => t.status === "Pendiente").length !== 1
    )
      throw Error("company isolation/automatic transition");
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
      JSON.parse(localStorage.getItem("paris-state-v3")),
    );
    if (!stored.activity.some((a) => a.qty === 12 && a.note === "Lote QA"))
      throw Error("activity not saved");
    await page.getByLabel("Vista de usuario").selectOption("boss");
    await page.locator('[data-nav="analytics"]').click();
    for (const name of ["Por equipo", "Por sector", "Por empleado"])
      await page.getByRole("button", { name, exact: true }).click();
    await page.getByLabel("Empresa", { exact: true }).selectOption("c1");
    await page.locator('[data-nav="closing"]').click();
    const row = page.getByRole("row").filter({ hasText: "Empleado QA" });
    await row.getByRole("button", { name: "Revisar y cerrar" }).click();
    await page
      .getByRole("dialog")
      .locator('textarea[name="note"]')
      .fill("Revisión mensual QA");
    await page.getByRole("dialog").locator("input[type=checkbox]").check();
    await page
      .getByRole("button", { name: "Confirmar cierre", exact: true })
      .click();
    stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("paris-state-v3")),
    );
    const closure = stored.closures.find(
      (c) => c.note === "Revisión mensual QA",
    );
    if (
      closure.tasks.length !== 4 ||
      new Set(closure.tasks.map((t) => t.companyId)).size !== 2
    )
      throw Error("closure must include all companies despite filter");
    await page.locator('[data-nav="tasks"]').click();
    const closedCard = page.locator(".task-card").first();
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
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await page.locator('[data-nav="analytics"]').click();
    await page.screenshot({ path: output + "/analytics.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: output + "/mobile.png", fullPage: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    if (overflow) throw Error("mobile viewport overflow");
    if (errors.length) throw Error(errors.join("\n"));
    console.log(
      "PASS induction, resume, company isolation, auto-checklist, activity, analysis grouping, complete monthly closure, write lock, mobile. No JS errors.",
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
