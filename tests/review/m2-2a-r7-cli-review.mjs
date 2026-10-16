// Invalid native-runner arguments must fail before creating output/cluster paths.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const runner = join(root, "tests/review/m2-1-native-review.mjs");
const scratch = mkdtempSync(join(tmpdir(), "gp-r7-cli-"));
const cases = [
  ["unknown option", ["--unknown", "x"]],
  ["repeated option", ["--pg-bin", "first", "--pg-bin", "second"]],
  ["missing value", ["--pg-bin"]],
  ["legacy abbreviated isolation flags", ["--m2-2a-first", "rr"]],
];
try {
  for (const [name, args] of cases) {
    const output = join(scratch, name.replaceAll(" ", "-"));
    const run = spawnSync(process.execPath, [runner, "--output-dir", output, ...args], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.notEqual(run.status, 0, `${name} should be rejected`);
    assert.equal(existsSync(output), false, `${name} must fail before output creation`);
    console.log(JSON.stringify({ name, passed: true, status: run.status }));
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
