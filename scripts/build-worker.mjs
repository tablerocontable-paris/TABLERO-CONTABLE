import { build } from "esbuild";
import { mkdir, rename, writeFile } from "node:fs/promises";
await rename("dist", "dist-client");
await mkdir("dist", { recursive: true });
await rename("dist-client", "dist/client");
await build({
  entryPoints: ["src/server/site-worker.ts"],
  outfile: "dist/server/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
});
await mkdir("dist/.openai", { recursive: true });
await writeFile(
  "dist/.openai/hosting.json",
  await (await import("node:fs/promises")).readFile(".openai/hosting.json"),
);
await writeFile(
  "dist/server/wrangler.json",
  JSON.stringify(
    {
      main: "index.js",
      compatibility_date: "2026-10-06",
      assets: {
        directory: "../client",
        binding: "ASSETS",
        not_found_handling: "single-page-application",
        run_worker_first: ["/api/*"],
      },
    },
    null,
    2,
  ),
);
