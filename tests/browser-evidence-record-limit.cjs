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

(async () => {
  server = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "8096", "--strictPort"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Preview timeout")), 10000);
    server.stdout.on("data", (chunk) => { if (chunk.toString().includes("Local:")) { clearTimeout(timer); resolve(); } });
    server.once("error", reject);
    server.once("exit", (code) => { if (code) reject(Error(`Preview exited ${code}`)); });
  });
  browser = await chromium.launch({ executablePath: binary, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const javascriptErrors = [], operationalApiCalls = [];
  page.on("pageerror", (error) => javascriptErrors.push(error.message));
  page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) operationalApiCalls.push(request.url()); });
  await page.goto("http://127.0.0.1:8096");
  await page.locator(".lab-banner").waitFor();
  const result = await page.evaluate(async () => {
    const evidence = await import("/src/data/laboratoryEvidence.ts");
    const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rckAAAAASUVORK5CYII="), (char) => char.charCodeAt(0));
    const file = (name) => new File([bytes], name, { type: "image/png" });
    const context = { taskId: "race-task", activityId: null, profileId: "e0" };
    const legacyDigest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((value) => value.toString(16).padStart(2, "0")).join("");
    const legacyDatabase = await new Promise((resolve, reject) => {
      const request = indexedDB.open("grupo-paris-laboratory-evidence-v1", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("files", { keyPath: "id" });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const legacyTransaction = legacyDatabase.transaction("files", "readwrite");
    legacyTransaction.objectStore("files").add({ id: "legacy-v1-file", name: "anterior.png", blob: new Blob([bytes], { type: "image/png" }), mimeType: "image/png", size: bytes.length, sha256: legacyDigest });
    await new Promise((resolve, reject) => { legacyTransaction.oncomplete = resolve; legacyTransaction.onerror = legacyTransaction.onabort = () => reject(legacyTransaction.error); });
    legacyDatabase.close();
    const attempts = await Promise.allSettled([
      evidence.storeTaskEvidence([file("uno.png"), file("dos.png")], context, 1),
      evidence.storeTaskEvidence([file("tres.png"), file("cuatro.png")], context, 1),
    ]);
    const succeeded = attempts.filter((attempt) => attempt.status === "fulfilled").flatMap((attempt) => attempt.value);
    const rejected = attempts.filter((attempt) => attempt.status === "rejected").map((attempt) => String(attempt.reason?.message || attempt.reason));
    const concurrentSucceededCount = succeeded.length;
    const legacyV1BlobPreserved = !!await evidence.readStoredEvidence("legacy-v1-file");
    await evidence.removeStoredEvidence(["legacy-v1-file", ...succeeded.map((row) => row.id)]);

    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((value) => value.toString(16).padStart(2, "0")).join("");
    const restored = { id: "restored-evidence", taskId: "restored-task", activityId: null, name: "guardado.png", mimeType: "image/png", size: bytes.length, sha256: digest, contents: btoa(String.fromCharCode(...bytes)) };
    await evidence.restoreEvidenceBundle([restored]);
    let restoredLimitRejected = false;
    try { await evidence.storeTaskEvidence([file("a.png"), file("b.png"), file("c.png")], { taskId: "restored-task", activityId: null, profileId: "e0" }, 0); }
    catch (error) { restoredLimitRejected = /hasta 3 archivos/i.test(error.message); }
    await evidence.removeStoredEvidence([restored.id]);
    return { concurrentSucceededCount, concurrentRejectedCount: rejected.length, rejectionMessages: rejected, legacyV1BlobPreserved, restoredLimitRejected };
  });
  const passed = result.concurrentSucceededCount === 2 && result.concurrentRejectedCount === 1 && result.legacyV1BlobPreserved && result.restoredLimitRejected && !javascriptErrors.length && !operationalApiCalls.length;
  const report = { passed, ...result, javascriptErrors, operationalApiCalls, browser: "Microsoft Edge headless", isolation: "Only an IndexedDB test record was written and removed; no application state or operational storage was changed." };
  fs.writeFileSync(path.join(output, "evidence-record-limit.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!passed) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); if (server) server.kill(); });
