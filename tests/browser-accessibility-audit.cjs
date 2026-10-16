const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright-core");
const { selectProfile } = require("./browser-helpers.cjs");

const root = path.resolve(__dirname, "..");
const binary = process.env.CHROMIUM_PATH;
const output = process.env.E2E_OUTPUT;
if (!binary || !output) throw Error("Definí CHROMIUM_PATH y E2E_OUTPUT.");
fs.mkdirSync(output, { recursive: true });
let browser;
let server;

async function startServer() {
  server = spawn(process.execPath, [
    path.join(root, "node_modules/vite/bin/vite.js"),
    "preview", "--outDir", "dist/client", "--host", "127.0.0.1",
    "--port", "8094", "--strictPort",
  ], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Preview timeout")), 10000);
    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Local:")) { clearTimeout(timer); resolve(); }
    });
    server.once("error", reject);
    server.once("exit", (code) => { if (code) reject(Error(`Preview exited ${code}`)); });
  });
}

async function auditPage(page, role, route) {
  return page.evaluate(({ role, route }) => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 && element.getClientRects().length > 0 &&
        !element.closest("[hidden], [aria-hidden='true']");
    };
    const text = (node) => (node?.innerText || node?.textContent || "")
      .replace(/\s+/g, " ").trim();
    const name = (element) => {
      const labelledBy = element.getAttribute("aria-labelledby");
      if (labelledBy) {
        const label = labelledBy.split(/\s+/).map((id) => text(document.getElementById(id))).filter(Boolean).join(" ");
        if (label) return label;
      }
      const aria = element.getAttribute("aria-label");
      if (aria?.trim()) return aria.trim();
      if (element.labels?.length) {
        const label = [...element.labels].map(text).filter(Boolean).join(" ");
        if (label) return label;
      }
      const role = element.getAttribute("role");
      if (["button", "link", "option", "menuitem", "tab"].includes(role) || ["BUTTON", "A"].includes(element.tagName)) {
        const label = text(element);
        if (label) return label;
      }
      return element.getAttribute("title")?.trim() || "";
    };
    const selector = [
      "button", "a[href]", "input:not([type=hidden])", "select", "textarea",
      "[role=button]", "[role=link]", "[role=option]", "[role=menuitem]", "[role=tab]",
    ].join(",");
    return [...document.querySelectorAll(selector)]
      .filter(visible)
      .map((element) => ({ tag: element.tagName.toLowerCase(), role: element.getAttribute("role") || "", name: name(element), text: text(element).slice(0, 90) }))
      .filter((item) => !item.name)
      .map((item) => ({ role, route, ...item }));
  }, { role, route });
}

async function auditKeyboard(page, role, route) {
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  const missingFocus = [];
  let focusStops = 0;
  for (let index = 0; index < 180; index += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body) return null;
      const visible = element.getClientRects().length > 0 && !element.closest("[hidden], [aria-hidden='true']");
      if (!visible) return { hidden: true };
      const style = getComputedStyle(element);
      let current = element;
      let ring = false;
      while (current && current instanceof HTMLElement) {
        const computed = getComputedStyle(current);
        if (computed.outlineStyle !== "none" && parseFloat(computed.outlineWidth) >= 2) ring = true;
        if (computed.boxShadow !== "none") ring = true;
        if (current.matches(":focus-visible") && computed.borderColor !== getComputedStyle(current.parentElement || document.body).borderColor) ring = true;
        current = current.parentElement;
      }
      const label = element.getAttribute("aria-label") || element.innerText || element.textContent || element.getAttribute("title") || element.tagName.toLowerCase();
      return { label: label.replace(/\\s+/g, " ").trim().slice(0, 90), ring, focusVisible: element.matches(":focus-visible") };
    });
    if (!stop) break;
    if (stop.hidden) continue;
    focusStops += 1;
    if (!stop.ring) missingFocus.push({ role, route, label: stop.label, focusVisible: stop.focusVisible });
  }
  return { focusStops, missingFocus };
}

async function auditAccessibilityTree(cdp, role, route) {
  const interactiveRoles = new Set([
    "button", "link", "textbox", "searchbox", "checkbox", "radio",
    "combobox", "listbox", "option", "menuitem", "menuitemcheckbox",
    "menuitemradio", "tab", "switch", "slider", "spinbutton", "treeitem",
  ]);
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const controls = nodes.filter((node) => !node.ignored && interactiveRoles.has(node.role?.value || ""));
  return {
    controls: controls.length,
    missingNames: controls
      .filter((node) => !node.name?.value?.trim())
      .map((node) => ({
        role: node.role?.value || "",
        backendDOMNodeId: node.backendDOMNodeId || null,
        profile: role,
        route,
      })),
  };
}

(async () => {
  const issues = [];
  const errors = [];
  const apiCalls = [];
  const visited = [];
  const keyboardIssues = [];
  const accessibilityTreeIssues = [];
  let keyboardFocusStops = 0;
  let accessibilityTreeControls = 0;
  await startServer();
  browser = await chromium.launch({ executablePath: binary, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Accessibility.enable");
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiCalls.push(request.url());
  });
  await page.goto("http://127.0.0.1:8094");
  await page.locator(".lab-banner").waitFor();
  await page.evaluate(() => document.fonts.ready);

  for (const profileId of ["boss", "m1", "e0"]) {
    await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", profileId);
    const routeIds = await page.locator(".sidebar nav [data-nav]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-nav")).filter(Boolean));
    for (const route of routeIds) {
      await page.locator(`.sidebar nav [data-nav="${route}"]`).click();
      await page.locator(".heading h1").waitFor();
      await page.waitForTimeout(80);
      visited.push({ profileId, route });
      issues.push(...await auditPage(page, profileId, route));
      const accessibilityTree = await auditAccessibilityTree(cdp, profileId, route);
      accessibilityTreeControls += accessibilityTree.controls;
      accessibilityTreeIssues.push(...accessibilityTree.missingNames);
      const keyboard = await auditKeyboard(page, profileId, route);
      keyboardFocusStops += keyboard.focusStops;
      keyboardIssues.push(...keyboard.missingFocus);
    }
  }

  const report = {
    passed: issues.length === 0 && accessibilityTreeIssues.length === 0 && keyboardIssues.length === 0 && errors.length === 0 && apiCalls.length === 0,
    visited,
    issues,
    accessibilityTree: {
      method: "Chromium DevTools Accessibility.getFullAXTree; automated accessibility-tree check, not screen-reader or WCAG certification",
      interactiveControls: accessibilityTreeControls,
      controlsWithoutAccessibleName: accessibilityTreeIssues,
    },
    keyboard: { focusStops: keyboardFocusStops, missingVisibleFocus: keyboardIssues },
    javascriptErrors: errors,
    operationalApiCalls: apiCalls,
  };
  fs.writeFileSync(path.join(output, "accessibility-audit.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, routesVisited: visited.length, controlsWithoutName: issues.length, accessibilityTreeControls: accessibilityTreeControls, accessibilityTreeControlsWithoutName: accessibilityTreeIssues.length, keyboardFocusStops: keyboardFocusStops, missingVisibleFocus: keyboardIssues.length, javascriptErrors: errors.length, operationalApiCalls: apiCalls.length, sampleIssues: issues.slice(0, 20), sampleAccessibilityTreeIssues: accessibilityTreeIssues.slice(0, 20), sampleKeyboardIssues: keyboardIssues.slice(0, 20) }, null, 2));
  if (!report.passed) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  if (server) server.kill();
});
