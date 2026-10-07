const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright-core");
const root = path.resolve(__dirname, "..");
const binary = process.env.CHROMIUM_PATH;
const output = process.env.E2E_OUTPUT;
if (!binary || !output) throw Error("Definí CHROMIUM_PATH y E2E_OUTPUT.");
fs.mkdirSync(output, { recursive: true });
let browser, server;
const errors = [],
  apiCalls = [];
const assert = (condition, message) => {
  if (!condition) throw Error(message);
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
      "8093",
      "--strictPort",
    ],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Preview timeout")), 10000);
    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Local:")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.once("error", reject);
    server.once("exit", (code) => {
      if (code) reject(Error("Preview exited " + code));
    });
  });
  browser = await chromium.launch({ executablePath: binary, headless: true });
  const page = await browser.newPage({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiCalls.push(request.url());
  });
  await page.goto("http://127.0.0.1:8093");
  await page.locator(".lab-banner").waitFor();

  const operationalValue = "operational-storage-isolated";
  await page.evaluate(
    (value) => localStorage.setItem("paris-state-v3", value),
    operationalValue,
  );
  const profileName = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("paris-state-lab")).profiles.find(
        (profile) => profile.id === "boss",
      ).name,
  );
  await page.getByRole("button", { name: /Copia del laboratorio/ }).click();
  await page.locator(".lab-backup-dialog").waitFor({ state: "visible" });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar copia" }).click(),
  ]);
  const backupPath = await download.path();
  const payload = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  assert(
    payload.format === "grupo-paris-lab-backup" && payload.formatVersion === 1,
    "Backup format or version missing",
  );
  assert(
    payload.state.profiles.some((profile) => profile.name === profileName),
    "Backup does not contain the current lab profile",
  );

  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    state.profiles.find((profile) => profile.id === "boss").name =
      "Cambio temporal de prueba";
    localStorage.setItem("paris-state-lab", JSON.stringify(state));
  });
  await page.reload();
  await page.locator(".lab-banner").waitFor();
  await page.getByRole("button", { name: /Copia del laboratorio/ }).click();
  await page.locator(".lab-backup-dialog").waitFor({ state: "visible" });
  const input = page.locator('.lab-backup-actions input[type="file"]');
  assert(
    (await input.count()) === 1,
    "Backup file input is missing from the open dialog",
  );
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Elegir copia para restaurar" }).click(),
  ]);
  await fileChooser.setFiles({
    name: "copia-prueba.json",
    mimeType: "application/json",
    buffer: fs.readFileSync(backupPath),
  });
  await Promise.race([
    page.getByText(/Copia válida:/).waitFor({ timeout: 10000 }),
    page.getByRole("alert").waitFor({ timeout: 10000 }),
  ]);
  const backupError = await page
    .locator(".lab-backup-error")
    .textContent()
    .catch(() => "sin mensaje");
  assert(
    (await page.getByText(/Copia válida:/).count()) === 1,
    "Backup preview failed: " + backupError,
  );
  await page.screenshot({
    path: path.join(output, "laboratory-backup-preview.png"),
    animations: "disabled",
  });
  const restoreButton = page.getByRole("button", {
    name: "Restaurar y recargar",
  });
  assert(
    await restoreButton.isDisabled(),
    "Restore must require explicit confirmation",
  );
  await page
    .getByRole("checkbox", { name: /Reemplazar la simulación guardada/ })
    .check();
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    restoreButton.click(),
  ]);
  const restoredName = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("paris-state-lab")).profiles.find(
        (profile) => profile.id === "boss",
      ).name,
  );
  assert(restoredName === profileName, "Selected snapshot was not restored");
  assert(
    (await page.evaluate(() => localStorage.getItem("paris-state-v3"))) ===
      operationalValue,
    "Operational storage was modified",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Copia del laboratorio/ }).click();
  await page.locator(".lab-backup-dialog").waitFor({ state: "visible" });
  const dialogBox = await page.locator(".lab-backup-dialog").boundingBox();
  assert(
    dialogBox && dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= 390,
    "Backup dialog overflows the mobile viewport",
  );
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Backup control introduced mobile page overflow",
  );
  await page.screenshot({
    path: path.join(output, "laboratory-backup-mobile.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Cerrar" }).click();
  assert(!errors.length, "Browser errors: " + errors.join("; "));
  assert(!apiCalls.length, "Laboratory made an operational API request");
  const result = {
    passed: true,
    backupVersion: payload.formatVersion,
    restoredBossName: restoredName,
    operationalStorageUnchanged: true,
    mobileDialogFits: true,
    apiCalls,
    errors,
  };
  fs.writeFileSync(
    path.join(output, "laboratory-backup-browser.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(
    "PASS: laboratory backup downloaded, inspected, confirmed and restored; operational storage and API untouched.",
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (server) server.kill();
  });
