import { randomBytes } from "node:crypto";
import { access, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { anonymizeWorkforceTables, calculateWorkforceEstimate } from "./workforce-estimate-core.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRIVATE_ROOT = path.join(PROJECT_ROOT, "private-data");
const FILES = ["people.csv", "tasks.csv", "task-events.csv", "movements.csv"];

export function assertPrivatePath(candidate) {
  const relative = path.relative(PRIVATE_ROOT, candidate);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Los datos y la clave deben permanecer dentro de private-data/, carpeta excluida de Git.");
  }
  return candidate;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--help" || key === "-h") options.help = true;
    else if (["--create-key", "--input-dir", "--output-dir", "--key-file", "--cutoff", "--timezone", "--mode"].includes(key)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Falta el valor de ${key}.`);
      if (options[key.slice(2)]) throw new Error(`La opción ${key} está repetida.`);
      options[key.slice(2)] = value;
      index += 1;
    } else {
      throw new Error("Opción no reconocida. Usá --help para ver los comandos disponibles.");
    }
  }
  return options;
}

function usage() {
  return [
    "Estimación local de dotación y actividad diaria (sin red, sin nombres).",
    "",
    "1) Crear una clave local, una sola vez:",
    "   node scripts/workforce-estimate.mjs --create-key private-data/pseudonym.key",
    "2) Seudonimizar los CSV de origen (deben estar en private-data/source):",
    "   node scripts/workforce-estimate.mjs --mode anonymize --input-dir private-data/source --output-dir private-data/anonymized --key-file private-data/pseudonym.key",
    "3) Calcular sólo métricas agregadas:",
    "   node scripts/workforce-estimate.mjs --mode estimate --input-dir private-data/anonymized --cutoff 2026-10-27T23:59:59-03:00 --timezone America/Argentina/Buenos_Aires",
    "",
    "La clave, entradas y resultados deben permanecer en private-data/; no subirlos a GitHub ni compartirlos por chat.",
  ].join("\n");
}

async function realPrivatePath(candidate, { mustExist = true } = {}) {
  const resolved = assertPrivatePath(path.resolve(PROJECT_ROOT, candidate));
  await mkdir(PRIVATE_ROOT, { recursive: true });
  const realRoot = await realpath(PRIVATE_ROOT);
  if (mustExist) {
    const actual = await realpath(resolved);
    const relative = path.relative(realRoot, actual);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error("La ruta real sale de private-data/; no se procesó.");
    }
    return actual;
  }
  const parent = await realpath(path.dirname(resolved));
  const relative = path.relative(realRoot, parent);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("La carpeta de destino sale de private-data/; no se escribió ningún archivo.");
  }
  return resolved;
}

async function readCsvBundle(directory) {
  const tables = {};
  const realDirectory = await realpath(directory);
  for (const name of FILES) {
    const filePath = await realpath(path.join(realDirectory, name));
    const relative = path.relative(realDirectory, filePath);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`${name}: el archivo resuelve fuera de la carpeta privada; no se procesó.`);
    }
    if (!(await stat(filePath)).isFile()) throw new Error(`${name}: se requiere un archivo regular dentro de private-data/.`);
    tables[name] = await readFile(filePath, "utf8");
  }
  return {
    people: tables["people.csv"],
    tasks: tables["tasks.csv"],
    events: tables["task-events.csv"],
    movements: tables["movements.csv"],
  };
}

async function createKey(candidate) {
  const keyPath = await realPrivatePath(candidate, { mustExist: false });
  await writeFile(keyPath, randomBytes(32), { flag: "wx", mode: 0o600 });
  process.stdout.write("Clave local creada. Guardala en private-data/ y conservá una copia privada para repetir seudónimos; su contenido no se muestra.\n");
}

async function anonymize(options) {
  if (!options["input-dir"] || !options["output-dir"] || !options["key-file"]) throw new Error("Para --mode anonymize se requieren --input-dir, --output-dir y --key-file.");
  const inputDir = await realPrivatePath(options["input-dir"]);
  const keyPath = await realPrivatePath(options["key-file"]);
  const outputDir = await realPrivatePath(options["output-dir"], { mustExist: false });
  try {
    await access(outputDir);
    throw new Error("La carpeta de salida ya existe. Elegí un destino nuevo; no se sobrescribe información.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const key = await readFile(keyPath);
  if (key.length !== 32) throw new Error("La clave local debe tener exactamente 32 bytes.");
  const outputs = anonymizeWorkforceTables(await readCsvBundle(inputDir), key);
  const staging = path.join(path.dirname(outputDir), `.workforce-anonymized-${process.pid}-${Date.now()}`);
  await mkdir(staging, { recursive: false });
  try {
    for (const [filename, contents] of Object.entries(outputs)) await writeFile(path.join(staging, filename), contents, { encoding: "utf8", flag: "wx" });
    await rename(staging, outputDir);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  process.stdout.write("Extracto seudonimizado localmente. No se imprimieron filas ni se transmitieron datos.\n");
}

async function estimate(options) {
  if (!options["input-dir"] || !options.cutoff || !options.timezone) throw new Error("Para --mode estimate se requieren --input-dir, --cutoff y --timezone.");
  const inputDir = await realPrivatePath(options["input-dir"]);
  const report = calculateWorkforceEstimate(await readCsvBundle(inputDir), { cutoff: options.cutoff, timezone: options.timezone });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (options["create-key"]) return createKey(options["create-key"]);
  if (options.mode === "anonymize") return anonymize(options);
  if (options.mode === "estimate") return estimate(options);
  throw new Error("Elegí --create-key o un --mode anonymize/estimate. Usá --help para ver los comandos.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "No se pudo procesar el extracto."}\n`);
    process.exitCode = 1;
  });
}
