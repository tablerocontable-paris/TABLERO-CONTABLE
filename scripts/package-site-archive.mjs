import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const dist = path.join(root, "dist");
const sourceManifest = JSON.parse(readFileSync(path.join(root, ".openai", "hosting.json"), "utf8"));
const builtManifest = JSON.parse(readFileSync(path.join(dist, ".openai", "hosting.json"), "utf8"));
if (!sourceManifest.project_id || sourceManifest.project_id !== builtManifest.project_id) {
  throw new Error("El build no corresponde al proyecto Sites configurado.");
}

for (const relativePath of ["server/index.js", "client/index.html"]) {
  if (!existsSync(path.join(dist, relativePath))) {
    throw new Error(`Falta un archivo de build requerido: dist/${relativePath}`);
  }
}

const migrations = readdirSync(path.join(root, "drizzle")).filter((name) => name.endsWith(".sql")).sort();
if (!migrations.length) throw new Error("No se encontraron migraciones D1 para empaquetar.");
const builtMigrationsDirectory = path.join(dist, ".openai", "drizzle");
mkdirSync(builtMigrationsDirectory, { recursive: true });
for (const migration of migrations) {
  copyFileSync(path.join(root, "drizzle", migration), path.join(builtMigrationsDirectory, migration));
}

const archive = path.resolve(process.argv[2] || path.join(root, "tmp", "sites-deployment.tar.gz"));
const relativeArchive = path.relative(dist, archive);
if (!relativeArchive.startsWith("..") && !path.isAbsolute(relativeArchive)) {
  throw new Error("Guardá el archivo fuera de dist para no incluirlo dentro de sí mismo.");
}
mkdirSync(path.dirname(archive), { recursive: true });
const tar = process.platform === "win32" ? "tar.exe" : "tar";
execFileSync(tar, ["-czf", archive, "dist"], { cwd: root, stdio: "inherit" });

const members = execFileSync(tar, ["-tzf", archive], { cwd: root, encoding: "utf8" });
const required = [
  "dist/.openai/hosting.json",
  "dist/server/index.js",
  "dist/client/index.html",
  ...migrations.map((name) => `dist/.openai/drizzle/${name}`),
];
for (const member of required) {
  if (!members.split(/\r?\n/).includes(member)) throw new Error(`El archivo no contiene ${member}.`);
}

console.log(JSON.stringify({
  project_id: sourceManifest.project_id,
  archive,
  size_bytes: statSync(archive).size,
  sha256: createHash("sha256").update(readFileSync(archive)).digest("hex"),
  migration_count: migrations.length,
}));
