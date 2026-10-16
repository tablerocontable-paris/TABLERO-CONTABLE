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
let browser, server;

function contrastPage(page, theme, profileId, route) {
  return page.evaluate(({ theme, profileId, route }) => {
    const parse = (value) => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const values = match[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
      if (values.length < 3 || values.some((item) => !Number.isFinite(item))) return null;
      return { rgb: values.slice(0, 3), alpha: values.length > 3 ? values[3] : 1 };
    };
    const linear = (v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (rgb) => 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
    const ratio = (a, b) => {
      const x = luminance(a), y = luminance(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const blend = (front, back, alpha) => front.map((channel, index) => channel * alpha + back[index] * (1 - alpha));
    const splitLayers = (value) => {
      const layers = [];
      let start = 0, depth = 0;
      for (let index = 0; index < value.length; index++) {
        if (value[index] === "(") depth++;
        else if (value[index] === ")") depth--;
        else if (value[index] === "," && depth === 0) { layers.push(value.slice(start, index).trim()); start = index + 1; }
      }
      layers.push(value.slice(start).trim());
      return layers;
    };
    const gradientColors = (image) => {
      const match = image.match(/^(?:repeating-)?(?:linear|radial|conic)-gradient\((.*)\)$/i);
      if (!match) return null;
      const stops = (match[1].match(/rgba?\([^)]*\)/gi) || []).map(parse).filter(Boolean);
      if (!stops.length) return null;
      const samples = [];
      for (let index = 0; index < stops.length; index++) {
        samples.push(stops[index]);
        const next = stops[index + 1];
        if (!next) continue;
        for (let step = 1; step < 8; step++) {
          const amount = step / 8;
          samples.push({ rgb: stops[index].rgb.map((channel, channelIndex) => channel + (next.rgb[channelIndex] - channel) * amount), alpha: stops[index].alpha + (next.alpha - stops[index].alpha) * amount });
        }
      }
      return samples;
    };
    const issues = [];
    let checked = 0, skipped = 0, cappedGradientSampleSets = 0;
    const skippedReasons = { unsupportedBackgroundImage: 0, unresolvedBackground: 0, unsupportedForeground: 0 };
    for (const element of document.querySelectorAll("body *")) {
      const text = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join(" ").replace(/\s+/g, " ").trim();
      if (!text || !element.getClientRects().length || element.closest('[aria-hidden="true"],script,style') || element.matches("input,textarea,select")) continue;
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0 || element.closest(":disabled")) continue;
      let backgrounds = [[255, 255, 255]], unsupported = false;
      const ancestors = [];
      for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) ancestors.push(ancestor);
      for (const ancestor of ancestors.reverse()) {
        const ancestorStyle = getComputedStyle(ancestor);
        const color = parse(ancestorStyle.backgroundColor);
        if (color && color.alpha > 0) backgrounds = backgrounds.map((background) => blend(color.rgb, background, color.alpha));
        const images = ancestorStyle.backgroundImage === "none" ? [] : splitLayers(ancestorStyle.backgroundImage);
        if (images.some((image) => !gradientColors(image))) { unsupported = true; break; }
        for (const image of images.reverse()) {
          const samples = gradientColors(image);
          backgrounds = backgrounds.flatMap((background) => samples.map((sample) => blend(sample.rgb, background, sample.alpha)));
          if (backgrounds.length > 400) {
            cappedGradientSampleSets++;
            backgrounds = backgrounds.filter((_, index) => index % Math.ceil(backgrounds.length / 400) === 0);
          }
        }
      }
      const foreground = parse(element.closest("svg") ? style.fill : style.color);
      if (unsupported || !backgrounds.length) { skipped++; skippedReasons.unsupportedBackgroundImage++; continue; }
      if (!foreground) { skipped++; skippedReasons.unsupportedForeground++; continue; }
      if (!ancestors.some((ancestor) => { const background = getComputedStyle(ancestor).backgroundColor; const color = parse(background); return color?.alpha >= 0.999; }) && backgrounds.length === 1 && backgrounds[0].every((channel) => channel === 255)) { skipped++; skippedReasons.unresolvedBackground++; continue; }
      const values = backgrounds.map((background) => ratio(foreground.alpha < 1 ? blend(foreground.rgb, background, foreground.alpha) : foreground.rgb, background));
      const value = Math.min(...values);
      const background = backgrounds[values.indexOf(value)];
      const size = Number.parseFloat(style.fontSize) || 14;
      const weight = Number.parseInt(style.fontWeight, 10) || 400;
      const large = size >= 24 || (size >= 18.67 && weight >= 700);
      const required = large ? 3 : 4.5;
      checked++;
      if (value < required) issues.push({ route, profileId, theme, tag: element.tagName.toLowerCase(), className: String(element.className || "").slice(0, 100), text: text.slice(0, 120), foreground: style.color, background: `rgb(${background.map(Math.round).join(", ")})`, ratio: Number(value.toFixed(2)), required });
    }
    return { theme, profileId, route, checked, skipped, skippedReasons, cappedGradientSampleSets, issues };
  }, { theme, profileId, route });
}

(async () => {
  server = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "preview", "--outDir", "dist/client", "--host", "127.0.0.1", "--port", "8095", "--strictPort"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Preview timeout")), 10000);
    server.stdout.on("data", (chunk) => { if (chunk.toString().includes("Local:")) { clearTimeout(timer); resolve(); } });
    server.once("error", reject);
    server.once("exit", (code) => { if (code) reject(Error(`Preview exited ${code}`)); });
  });
  browser = await chromium.launch({ executablePath: binary, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], apiCalls = [], results = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) apiCalls.push(request.url()); });
  await page.goto("http://127.0.0.1:8095");
  await page.locator(".lab-banner").waitFor();
  await page.evaluate(() => document.fonts.ready);
  for (const profileId of ["boss", "m1", "e0"]) {
    await selectProfile(page, "Vista de usuario", "Vista de prueba · actor simulado", profileId);
    const routes = await page.locator(".sidebar nav [data-nav]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-nav")).filter(Boolean));
    for (const theme of ["light", "dark"]) {
      for (let count = 0; count < 4 && await page.locator(".theme-toggle").getAttribute("data-theme") !== theme; count++) await page.locator(".theme-toggle").click();
      await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme);
      for (const route of routes) {
        await page.locator(`.sidebar nav [data-nav="${route}"]`).click();
        await page.locator(".heading h1").waitFor();
        await page.waitForTimeout(50);
        results.push(await contrastPage(page, theme, profileId, route));
      }
    }
  }
  const issues = results.flatMap((result) => result.issues);
  const skippedReasons = results.reduce((total, row) => { for (const [reason, count] of Object.entries(row.skippedReasons)) total[reason] = (total[reason] || 0) + count; return total; }, {});
  const cappedGradientSampleSets = results.reduce((sum, row) => sum + row.cappedGradientSampleSets, 0);
  const report = { passed: issues.length === 0 && errors.length === 0 && apiCalls.length === 0 && cappedGradientSampleSets === 0, method: "Computed text/background colors on visible DOM nodes; gradient stops and seven interpolated colors per stop segment are checked. Non-gradient image backgrounds and unsupported color formats are counted as skipped.", routesAudited: results.length, checkedTextElements: results.reduce((sum, row) => sum + row.checked, 0), skippedTextElements: results.reduce((sum, row) => sum + row.skipped, 0), skippedReasons, cappedGradientSampleSets, issueCount: issues.length, issues: issues.slice(0, 250), javascriptErrors: errors, operationalApiCalls: apiCalls };
  fs.writeFileSync(path.join(output, "contrast-audit.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, routesAudited: report.routesAudited, checkedTextElements: report.checkedTextElements, skippedTextElements: report.skippedTextElements, skippedReasons, cappedGradientSampleSets, issueCount: report.issueCount, sampleIssues: issues.slice(0, 20), javascriptErrors: errors.length, operationalApiCalls: apiCalls.length }, null, 2));
  if (!report.passed) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); if (server) server.kill(); });
