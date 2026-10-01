// Diagnostic review only; separate config keeps probes out of acceptance tests.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
execFileSync(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "tests/review/annotations-tour.config.ts",
  ],
  {
    cwd: root,
    stdio: "inherit",
  },
);
process.stdout.write(
  readFileSync(
    path.join(root, "review-evidence/annotations-tour-20261001.json"),
    "utf8",
  ),
);
