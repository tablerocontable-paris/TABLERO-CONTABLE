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
const phase = (name) => console.log(`[backup-e2e] ${name}`);

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
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiCalls.push(request.url());
  });
  await page.goto("http://127.0.0.1:8093");
  await page.locator(".lab-banner").waitFor();
  phase("app ready");
  const lockPage = await context.newPage();
  lockPage.on("pageerror", (error) => errors.push(error.message));
  await lockPage.goto("http://127.0.0.1:8093");
  await lockPage.locator(".lab-banner").waitFor();
  const holdEvidenceLock = async () => {
    await lockPage.evaluate(() => {
      window.__labEvidenceLockReady = false;
      window.__labEvidenceLockRelease = null;
      window.__labEvidenceLockRequest = new Promise((resolve) => {
        window.__labEvidenceLockResolveRequest = resolve;
      });
      navigator.locks.request("grupo-paris-laboratory-evidence-mutation-v1", async () => {
        window.__labEvidenceLockReady = true;
        await new Promise((resolve) => { window.__labEvidenceLockRelease = resolve; });
      }).then(() => window.__labEvidenceLockResolveRequest()).catch((error) => {
        window.__labEvidenceLockError = String(error);
        window.__labEvidenceLockResolveRequest();
      });
    });
    await lockPage.waitForFunction(() => window.__labEvidenceLockReady === true);
  };
  const releaseEvidenceLock = async () => {
    await lockPage.evaluate(() => window.__labEvidenceLockRelease?.());
    await lockPage.evaluate(() => window.__labEvidenceLockRequest);
  };

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
  const evidenceTask = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    state.activeId = "e0";
    localStorage.setItem("paris-state-lab", JSON.stringify(state));
    const task = state.tasks.find((row) => row.ownerId === "e0" && row.kind === "resultado" && row.status !== "Completada" && !row.responsibility &&
      !state.tasks.some((other) => other.companyId === row.companyId && other.month === row.month && other.responsibility && other.status !== "Completada" &&
        (other.ownerId === "e0" || other.responsibility.members.some((member) => member.profileId === "e0"))) &&
      !state.tasks.some((other) => other.companyId === row.companyId && other.month === row.month && other.sessions?.some((session) => !session.end)));
    return task && { id: task.id, title: task.title, companyId: task.companyId, month: task.month };
  });
  assert(evidenceTask, "No eligible deliverable is available for the evidence flow");
  await page.reload();
  await page.locator(".lab-banner").waitFor();
  await page.locator('[data-nav="tasks"]').click();
  await page.locator(`[data-task-id="${evidenceTask.id}"] .card-title`).click();
  await page.getByRole("heading", { name: evidenceTask.title }).waitFor();
  await page.getByRole("button", { name: /Desplegar Evidencia del entregable/ }).click();
  const evidenceInput = page.locator('.lab-evidence-add input[type="file"]');
  await evidenceInput.setInputFiles({
    name: "evidencia-prueba.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rckAAAAASUVORK5CYII=", "base64"),
  });
  await page.evaluate(() => {
    const locks = navigator.locks;
    const original = locks.request;
    window.__restoreEvidenceLockRequest = () => { locks.request = original; };
    locks.request = function (name, options, callback) {
      if (name === "grupo-paris-laboratory-evidence-mutation-v1") return Promise.reject(new DOMException("denied", "SecurityError"));
      return original.call(this, name, options, callback);
    };
  });
  await page.getByRole("button", { name: "Guardar evidencia" }).click();
  await page.getByRole("alert").filter({ hasText: /evidencia|bloqueó|denied/i }).waitFor();
  const retryEvidenceButton = page.getByRole("button", { name: "Guardar evidencia" });
  await retryEvidenceButton.waitFor();
  const lockRetryEnabled = await retryEvidenceButton.isEnabled();
  assert(lockRetryEnabled, "The evidence form must release its busy state after lock rejection");
  const lockRejectedWithoutWrite = await page.evaluate(async () => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 2);
      request.onupgradeneeded = () => {
        const store = request.result.objectStoreNames.contains("files")
          ? request.transaction.objectStore("files")
          : request.result.createObjectStore("files", { keyPath: "id" });
        if (!store.indexNames.contains("recordKey")) store.createIndex("recordKey", "recordKey", { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("files", "readonly");
    const blobCount = await new Promise((resolve, reject) => {
      const request = transaction.objectStore("files").count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return { metadataCount: state.taskEvidence?.length || 0, blobCount };
  });
  assert(lockRejectedWithoutWrite.metadataCount === 0, "A rejected Web Lock must not commit evidence metadata");
  assert(lockRejectedWithoutWrite.blobCount === 0, "A rejected Web Lock must not write an evidence blob");
  await page.evaluate(() => window.__restoreEvidenceLockRequest());
  phase("rejected Web Lock leaves the form retryable without a write");
  await holdEvidenceLock();
  await page.getByRole("button", { name: "Guardar evidencia" }).click();
  await page.getByRole("button", { name: "Guardando…" }).waitFor();
  await page.waitForTimeout(200);
  const uploadBeforeRelease = await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")).taskEvidence?.length || 0);
  assert(uploadBeforeRelease === 0, "Evidence upload committed while another tab held the shared mutation lock");
  await releaseEvidenceLock();
  await page.getByText("La evidencia quedó guardada en este laboratorio y asociada al entregable.").waitFor();
  phase("cross-tab upload released and committed");
  const durableStateBeforeConcurrentRestore = await page.evaluate(() => localStorage.getItem("paris-state-lab"));
  await holdEvidenceLock();
  await evidenceInput.setInputFiles({
    name: "evidencia-obsoleta.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rckAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Guardar evidencia" }).click();
  await page.getByRole("button", { name: "Guardando…" }).waitFor();
  await lockPage.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    state.profiles.find((profile) => profile.id === "e0").name = "Perfil de restauración concurrente";
    state.labRevision = crypto.randomUUID();
    localStorage.setItem("paris-state-lab", JSON.stringify(state));
  });
  await releaseEvidenceLock();
  await page.getByRole("alert").filter({ hasText: /cambió en otra pestaña.*recargá/i }).waitFor();
  const staleUploadState = await page.evaluate(() => new Promise((resolve, reject) => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 2);
    request.onsuccess = () => {
      const transaction = request.result.transaction("files", "readonly");
      const count = transaction.objectStore("files").count();
      count.onsuccess = () => resolve({ metadataCount: state.taskEvidence?.length || 0, blobCount: count.result });
      count.onerror = () => reject(count.error);
    };
    request.onerror = () => reject(request.error);
  }));
  assert(staleUploadState.metadataCount === 1 && staleUploadState.blobCount === 1, "A stale upload wrote blobs or metadata after a concurrent restore");
  await page.evaluate((raw) => localStorage.setItem("paris-state-lab", raw), durableStateBeforeConcurrentRestore);
  phase("upload with a stale view was rejected after a concurrent restore");
  await page.evaluate(() => {
    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.__nativeSetItem = nativeSetItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "paris-state-lab") throw new DOMException("Simulated state storage quota", "QuotaExceededError");
      return nativeSetItem.call(this, key, value);
    };
    const nativeDelete = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (...args) {
      IDBObjectStore.prototype.delete = nativeDelete;
      throw new DOMException("Simulated evidence cleanup failure", "UnknownError");
    };
  });
  await evidenceInput.setInputFiles({
    name: "evidencia-temporal-recuperable.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rckAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Guardar evidencia" }).click();
  await page.getByRole("alert").filter({ hasText: /ya no ocupa el cupo de adjuntos/ }).waitFor();
  const compensationState = await page.evaluate(async () => {
    Storage.prototype.setItem = Storage.prototype.__nativeSetItem || Storage.prototype.setItem;
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("files", "readonly");
    const records = await new Promise((resolve, reject) => {
      const request = transaction.objectStore("files").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    const orphan = records.find((record) => !state.taskEvidence?.some((row) => row.id === record.id));
    return { metadataCount: state.taskEvidence?.length || 0, orphanHasQuotaKey: !!orphan?.recordKey, orphanBytesRetained: !!orphan };
  });
  assert(compensationState.metadataCount === 1, "Rejected evidence commit changed the previous metadata");
  assert(!compensationState.orphanHasQuotaKey && compensationState.orphanBytesRetained, "Failed compensation did not preserve bytes and clear the stale quota index");
  await page.evaluate(() => { Storage.prototype.setItem = Storage.prototype.__nativeSetItem; });
  phase("failed cleanup retained bytes and reconciled the quota index");
  await evidenceInput.setInputFiles({
    name: "evidencia-reintento.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rckAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Guardar evidencia" }).click();
  await page.getByText("La evidencia quedó guardada en este laboratorio y asociada al entregable.").waitFor();
  phase("evidence retry succeeded after failed compensation");
  await page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("files", "readwrite");
    transaction.objectStore("files").add({
      id: "orphan-before-restore", name: "temporal.png", blob: new Blob(["orphan"], { type: "image/png" }),
      mimeType: "image/png", size: 6, sha256: "0".repeat(64), recordKey: "obsolete-task\u001ftask",
    });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  });
  phase("orphan evidence inserted");
  await page.evaluate(() => {
    const originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      IDBObjectStore.prototype.add = originalAdd;
      throw new DOMException("Simulated browser storage quota", "QuotaExceededError");
    };
  });
  await evidenceInput.setInputFiles({
    name: "evidencia-cuota.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rckAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Guardar evidencia" }).click();
  const quotaAlert = page.getByRole("alert").filter({ hasText: /No hay espacio disponible/ });
  await quotaAlert.waitFor();
  phase("quota error displayed");
  const quotaFailureMessage = await quotaAlert.textContent();
  const evidenceAfterQuotaFailure = await page.evaluate((taskId) => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    return state.taskEvidence.filter((row) => row.taskId === taskId && row.activityId === null).length;
  }, evidenceTask.id);
  assert(evidenceAfterQuotaFailure === 2, "Quota failure created dangling or duplicate evidence metadata");
  const evidenceBeforeNativeAbort = await page.evaluate(async (taskId) => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("files", "readonly");
    const blobCount = await new Promise((resolve, reject) => {
      const request = transaction.objectStore("files").count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return { metadataCount: state.taskEvidence.filter((row) => row.taskId === taskId && row.activityId === null).length, blobCount };
  }, evidenceTask.id);
  await page.evaluate(() => {
    const nativeAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      IDBObjectStore.prototype.add = nativeAdd;
      const transaction = this.transaction;
      const request = nativeAdd.apply(this, args);
      queueMicrotask(() => { try { transaction.abort(); } catch { /* Transaction already completed. */ } });
      return request;
    };
  });
  await evidenceInput.setInputFiles({
    name: "evidencia-transaccion-abortada.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rckAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Guardar evidencia" }).click();
  await page.getByRole("alert").filter({ hasText: /abort|no se pudo guardar|transacci/i }).waitFor();
  const nativeAbortButton = page.getByRole("button", { name: "Guardar evidencia" });
  await nativeAbortButton.waitFor();
  const nativeAbortRetryEnabled = await nativeAbortButton.isEnabled();
  assert(nativeAbortRetryEnabled, "An IndexedDB transaction abort left evidence submission permanently busy");
  const evidenceAfterNativeAbort = await page.evaluate(async (taskId) => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("files", "readonly");
    const blobCount = await new Promise((resolve, reject) => {
      const request = transaction.objectStore("files").count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return { metadataCount: state.taskEvidence.filter((row) => row.taskId === taskId && row.activityId === null).length, blobCount };
  }, evidenceTask.id);
  assert(evidenceAfterNativeAbort.metadataCount === evidenceBeforeNativeAbort.metadataCount && evidenceAfterNativeAbort.blobCount === evidenceBeforeNativeAbort.blobCount, "A native IndexedDB transaction abort changed evidence references or blobs");
  phase("native IndexedDB transaction abort preserved evidence and kept retry enabled; physical quota exhaustion not induced");
  await page.getByRole("button", { name: "Cerrar" }).click();
  await page.getByRole("button", { name: /Copia del laboratorio/ }).click();
  await page.locator(".lab-backup-dialog").waitFor({ state: "visible" });
  phase("backup dialog opened");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar copia" }).click(),
  ]);
  phase("backup downloaded");
  const backupPath = await download.path();
  const payload = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  assert(
    payload.format === "grupo-paris-lab-backup" && payload.formatVersion === 2,
    "Backup format or version missing",
  );
  assert(
    payload.state.profiles.some((profile) => profile.name === profileName),
    "Backup does not contain the current lab profile",
  );
  assert(payload.files?.length === 2, "Backup did not include the successfully linked evidence files");
  assert(payload.state.taskEvidence?.some((row) => row.id === payload.files[0].id), "Backup evidence metadata is missing");
  assert(payload.files[0].taskId === evidenceTask.id && payload.files[0].activityId === null, "Backup did not retain the task/activity scope needed for atomic file limits after restore");

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
    page.getByText(/Copia válida/).waitFor({ timeout: 10000 }),
    page.getByRole("alert").waitFor({ timeout: 10000 }),
  ]);
  const backupError = await page
    .locator(".lab-backup-error")
    .textContent()
    .catch(() => "sin mensaje");
  assert(
    (await page.getByText(/Copia válida/).count()) === 1,
    "Backup preview failed: " + backupError,
  );
  phase("backup v2 inspected");
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
  const preflightPayload = JSON.parse(JSON.stringify(payload));
  const originalEvidenceId = preflightPayload.files[0].id;
  const preflightEvidenceId = `preflight-${Date.now()}`;
  const replaceEvidenceId = (value) => {
    if (value === originalEvidenceId) return preflightEvidenceId;
    if (Array.isArray(value)) return value.map(replaceEvidenceId);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceEvidenceId(child)]));
    return value;
  };
  const preflightContents = JSON.stringify(replaceEvidenceId(preflightPayload));
  await input.setInputFiles({ name: "preflight.json", mimeType: "application/json", buffer: Buffer.from(preflightContents) });
  await page.getByText(/Copia válida · versión 2: preflight.json/).waitFor();
  await page.getByRole("checkbox", { name: /Reemplazar la simulación guardada/ }).check();
  await page.evaluate(() => {
    const original = Storage.prototype.getItem;
    window.__restoreLabGetItem = () => { Storage.prototype.getItem = original; };
    Storage.prototype.getItem = function (key) {
      if (key === "paris-state-lab") throw new DOMException("blocked", "SecurityError");
      return original.call(this, key);
    };
  });
  await restoreButton.click();
  const preflightAlert = page.getByRole("alert").filter({ hasText: /No se pudo leer la copia actual del laboratorio/ });
  await preflightAlert.waitFor();
  await page.evaluate(() => window.__restoreLabGetItem());
  const preflightResult = await page.evaluate(async (evidenceId) => {
    const profileName = JSON.parse(localStorage.getItem("paris-state-lab")).profiles.find((profile) => profile.id === "boss").name;
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("files", "readonly");
    const blobExists = await new Promise((resolve, reject) => {
      const request = transaction.objectStore("files").get(evidenceId);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return { profileName, blobExists };
  }, preflightEvidenceId);
  assert(preflightResult.profileName === "Cambio temporal de prueba", "Unreadable preflight replaced the previous lab state");
  assert(!preflightResult.blobExists, "Unreadable preflight staged a new evidence blob before reading prior state");
  phase("unreadable restore preflight preserved state and wrote no blob");
  await input.setInputFiles({ name: "copia-prueba.json", mimeType: "application/json", buffer: fs.readFileSync(backupPath) });
  await page.getByText(/Copia válida · versión 2: copia-prueba.json/).waitFor();
  await page.getByRole("checkbox", { name: /Reemplazar la simulación guardada/ }).check();
  await page.evaluate(async (evidenceId) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("files", "readwrite");
    const store = transaction.objectStore("files");
    const request = store.get(evidenceId);
    request.onsuccess = () => { request.result.recordKey = "wrong-scope"; store.put(request.result); };
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, payload.files[0].id);
  await restoreButton.click();
  await page.getByRole("alert").filter({ hasText: /No se pudo reconciliar el índice local de evidencia/ }).waitFor();
  const afterScopeConflict = await page.evaluate(async (evidenceId) => {
    const profileName = JSON.parse(localStorage.getItem("paris-state-lab")).profiles.find((profile) => profile.id === "boss").name;
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("files", "readonly");
    const record = await new Promise((resolve, reject) => {
      const request = transaction.objectStore("files").get(evidenceId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return { profileName, recordKey: record.recordKey };
  }, payload.files[0].id);
  assert(afterScopeConflict.profileName === "Cambio temporal de prueba", "Scope conflict replaced the previous local state");
  assert(afterScopeConflict.recordKey === "wrong-scope", "Scope conflict rewrote the existing evidence index");
  phase("scope conflict rejected and rolled back");
  await page.evaluate(async ({ evidenceId, expectedKey }) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("files", "readwrite");
    const store = transaction.objectStore("files");
    const request = store.get(evidenceId);
    request.onsuccess = () => { request.result.recordKey = expectedKey; store.put(request.result); };
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, { evidenceId: payload.files[0].id, expectedKey: `${evidenceTask.id}\u001ftask` });
  await page.evaluate(async (evidenceId) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("files", "readwrite");
    transaction.objectStore("files").delete(evidenceId);
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "paris-state-lab") {
        Storage.prototype.setItem = originalSetItem;
        throw new DOMException("Simulated state storage quota", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    };
  }, payload.files[0].id);
  await restoreButton.click();
  const rollbackAlert = page.getByRole("alert").filter({ hasText: /No hay espacio disponible/ });
  await rollbackAlert.waitFor();
  const rollbackState = await page.evaluate((evidenceId) => new Promise((resolve, reject) => {
    const current = JSON.parse(localStorage.getItem("paris-state-lab"));
    const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("files", "readonly");
      const read = transaction.objectStore("files").get(evidenceId);
      read.onsuccess = () => { resolve({ profileName: current.profiles.find((profile) => profile.id === "boss").name, blobExists: !!read.result }); database.close(); };
      read.onerror = () => { reject(read.error); database.close(); };
    };
  }), payload.files[0].id);
  assert(rollbackState.profileName === "Cambio temporal de prueba", "Failed restoration replaced the previous lab state");
  assert(!rollbackState.blobExists, "Failed restoration left a temporary evidence blob behind");
  phase("quota failure rolled back");
  const rollbackMessage = await rollbackAlert.textContent();
  await holdEvidenceLock();
  phase("cross-tab restore lock held");
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Restaurar y recargar"));
    return !!button && !button.disabled;
  }, { timeout: 10000 });
  phase("restore button enabled");
  await restoreButton.click();
  phase("restore click returned");
  await page.waitForTimeout(200);
  const pendingRestoreName = await page.evaluate(() => JSON.parse(localStorage.getItem("paris-state-lab")).profiles.find((profile) => profile.id === "boss").name);
  assert(pendingRestoreName === "Cambio temporal de prueba", "Restore replaced state while another tab held the shared mutation lock");
  const navigation = page.waitForNavigation({ waitUntil: "domcontentloaded" });
  await releaseEvidenceLock();
  phase("cross-tab restore lock released");
  await navigation;
  const restoredName = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("paris-state-lab")).profiles.find(
        (profile) => profile.id === "boss",
      ).name,
  );
  const restoredEvidence = await page.evaluate(async (evidenceId) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("files", "readonly");
    const store = transaction.objectStore("files");
    const [record, orphan] = await Promise.all([new Promise((resolve, reject) => {
      const request = store.get(evidenceId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }), new Promise((resolve, reject) => {
      const request = store.get("orphan-before-restore");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    })]);
    const orphanHasIndex = !!orphan?.recordKey;
    const orphanBytesRetained = !!orphan && orphan.blob?.size === orphan.size;
    database.close();
    return { validEvidence: !!record && record.size > 0 && record.blob?.size === record.size, orphanHasIndex, orphanBytesRetained };
  }, payload.files[0].id);
  assert(restoredEvidence.validEvidence, "Evidence blob was not restored with the laboratory snapshot");
  assert(!restoredEvidence.orphanHasIndex, "Unreferenced evidence remained in the active quota index after restore");
  assert(restoredEvidence.orphanBytesRetained, "Reconciliation deleted recoverable orphan evidence bytes");
  assert(restoredName === profileName, "Selected snapshot was not restored");
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    state.activeId = "e0";
    localStorage.setItem("paris-state-lab", JSON.stringify(state));
  });
  await page.reload();
  await page.locator(".lab-banner").waitFor();
  await page.locator('[data-nav="tasks"]').click();
  await page.locator(`[data-task-id="${evidenceTask.id}"] .card-title`).click();
  await page.getByRole("heading", { name: evidenceTask.title }).waitFor();
  await page.getByRole("button", { name: /Desplegar Evidencia del entregable/ }).click();
  const unknownEvidenceInput = page.locator('.lab-evidence-add input[type="file"]');
  await unknownEvidenceInput.setInputFiles({
    name: "evidencia-commit-incierto.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rckAAAAASUVORK5CYII=", "base64"),
  });
  await page.evaluate(() => {
    const nativeSetItem = Storage.prototype.setItem;
    const nativeGetItem = Storage.prototype.getItem;
    let labWriteReportedFailed = false;
    Storage.prototype.setItem = function (key, value) {
      nativeSetItem.call(this, key, value);
      if (key === "paris-state-lab") {
        labWriteReportedFailed = true;
        Storage.prototype.setItem = nativeSetItem;
        throw new DOMException("Write succeeded but reported failure", "QuotaExceededError");
      }
      return undefined;
    };
    Storage.prototype.getItem = function (key) {
      if (key === "paris-state-lab" && labWriteReportedFailed) {
        Storage.prototype.getItem = nativeGetItem;
        throw new DOMException("Readback unavailable", "SecurityError");
      }
      return nativeGetItem.call(this, key);
    };
  });
  await page.getByRole("button", { name: "Guardar evidencia" }).click();
  await page.getByRole("alert").filter({ hasText: /No se pudo confirmar si la evidencia quedó guardada/ }).waitFor();
  const unknownOutcomeState = await page.evaluate(async (taskId) => {
    Storage.prototype.setItem = Storage.prototype.__nativeSetItem || Storage.prototype.setItem;
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("files", "readonly");
    const records = await new Promise((resolve, reject) => {
      const request = transaction.objectStore("files").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return { metadataCount: state.taskEvidence.filter((row) => row.taskId === taskId).length, totalMetadata: state.taskEvidence.length, blobCount: records.length };
  }, evidenceTask.id);
  await unknownEvidenceInput.setInputFiles({
    name: "evidencia-commit-incierto.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rckAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Guardar evidencia" }).click();
  await page.waitForTimeout(1000);
  const staleRetryAlert = await page.getByRole("alert").allTextContents();
  phase(`stale retry alerts: ${staleRetryAlert.join(" | ") || "none"}`);
  assert(staleRetryAlert.some((message) => /cambió en otra pestaña.*recargá/i.test(message)), "An uncertain evidence retry was not rejected as stale: " + staleRetryAlert.join(" | "));
  const uncertainRetry = await page.evaluate(async (taskId) => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("files", "readonly");
    const records = await new Promise((resolve, reject) => {
      const request = transaction.objectStore("files").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return { metadataCount: state.taskEvidence.filter((row) => row.taskId === taskId).length, totalMetadata: state.taskEvidence.length, blobCount: records.length, unindexedReferenced: records.some((record) => state.taskEvidence.some((row) => row.id === record.id) && !record.recordKey) };
  }, evidenceTask.id);
  assert(unknownOutcomeState.metadataCount === 3, "The write-then-throw outcome did not persist its candidate");
  assert(uncertainRetry.metadataCount === unknownOutcomeState.metadataCount && uncertainRetry.totalMetadata === unknownOutcomeState.totalMetadata && uncertainRetry.blobCount === unknownOutcomeState.blobCount, "An uncertain write retry duplicated or removed evidence");
  assert(!uncertainRetry.unindexedReferenced, "An uncertain write retry removed the quota index of referenced evidence");
  phase("write-then-throw with failed readback remained intact and stale retry stopped");
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    state.activeId = "boss";
    localStorage.setItem("paris-state-lab", JSON.stringify(state));
  });
  await page.reload();
  await page.locator(".lab-banner").waitFor();
  await page.locator('[data-nav="closing"]').click();
  await page.getByLabel("Alcance").selectOption("person");
  await page.getByLabel("Seleccionar persona").selectOption("e0");
  const closeButton = page.locator(".lab-close-form button.primary");
  await closeButton.waitFor({ state: "visible" });
  await page.getByLabel("Observación del cierre").fill("Cierre de prueba con evidencia conservada.");
  await page.locator(".lab-close-form input[type=checkbox]").check();
  await closeButton.click();
  await page.locator(".lab-close-result[role=status]").filter({ hasText: /cerradas/ }).waitFor();
  const closureEvidence = await page.evaluate(async (expected) => {
    const state = JSON.parse(localStorage.getItem("paris-state-lab"));
    const companyClosure = (state.companyClosures || []).find((row) => row.ownerId === "e0" && row.companyId === expected.companyId && row.month === expected.month);
    const monthlyClosure = (state.closures || []).find((row) => row.ownerId === "e0" && row.month === expected.month);
    const companyTask = companyClosure?.tasks.find((task) => task.id === expected.taskId);
    const monthlyTask = monthlyClosure?.tasks.find((task) => task.id === expected.taskId);
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("files", "readonly");
    const record = await new Promise((resolve, reject) => {
      const request = transaction.objectStore("files").get(expected.evidenceId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return {
      companyReference: companyTask?.evidenceIds?.includes(expected.evidenceId) || false,
      monthlyReference: monthlyTask?.evidenceIds?.includes(expected.evidenceId) || false,
      blobAvailable: !!record && record.size === record.blob.size,
    };
  }, { companyId: evidenceTask.companyId, month: evidenceTask.month, taskId: evidenceTask.id, evidenceId: payload.files[0].id });
  assert(closureEvidence.companyReference, "Company closure snapshot lost the evidence reference");
  assert(closureEvidence.monthlyReference, "Monthly closure snapshot lost the evidence reference");
  assert(closureEvidence.blobAvailable, "Evidence blob is unavailable after the monthly closure");
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
  await lockPage.close();
  const result = {
    passed: true,
    backupVersion: payload.formatVersion,
    evidenceFileCount: payload.files.length,
    quotaFailureMessage,
    evidenceReferencesAfterQuotaFailure: evidenceAfterQuotaFailure,
    rollbackMessage,
    rollbackPreservedPreviousState: rollbackState.profileName === "Cambio temporal de prueba",
    rollbackRemovedTemporaryBlob: !rollbackState.blobExists,
    scopeConflictRejectedAndRolledBack: afterScopeConflict.profileName === "Cambio temporal de prueba" && afterScopeConflict.recordKey === "wrong-scope",
    crossTabMutationLock: "upload and restore waited for the shared lock held by a second browser tab",
    rejectedLockRetry: { enabled: lockRetryEnabled, metadataCount: lockRejectedWithoutWrite.metadataCount, blobCount: lockRejectedWithoutWrite.blobCount },
    failedCompensationRecovery: { ...compensationState, retryCommitted: payload.files?.length === 2 },
    nativeIndexedDbAbort: {
      before: evidenceBeforeNativeAbort,
      after: evidenceAfterNativeAbort,
      preserved: evidenceAfterNativeAbort.metadataCount === evidenceBeforeNativeAbort.metadataCount && evidenceAfterNativeAbort.blobCount === evidenceBeforeNativeAbort.blobCount,
      retryEnabled: nativeAbortRetryEnabled,
      physicalQuotaExhaustionInduced: false,
    },
    staleUploadRejectedAfterRestore: staleUploadState.metadataCount === 1 && staleUploadState.blobCount === 1,
    unreadableRestorePreflight: { preservedProfile: preflightResult.profileName === "Cambio temporal de prueba", stagedBlob: preflightResult.blobExists },
    evidenceRestored: restoredEvidence,
    evidenceAvailableAfterCompanyAndMonthlyClosure: closureEvidence,
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
