import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Hashes cover UTF-8 SQL normalized to LF so Windows and GitHub Linux compare
// the same committed migration bytes. SQL014's accepted Windows CRLF hash is
// BC09CF...; its committed LF equivalent is 6CAF7C....
export const MIGRATIONS = [
  ["202609300001_foundation.sql", "4AE00143F3740D21A828165139FA929DEA0DCB8775849939A505CA5CB8BDF161"],
  ["202609300002_workflows.sql", "EC5AA503834DC8A10E0A7CF858C0C6C4F09A3B0C5BB0A53DF9E34FD834697832"],
  ["202610010001_occurrence_contract.sql", "009E453942D2609F6F84913D2684015326FE5874EB39351A9E75A0525C4C17B0"],
  ["202610010002_onboarding_approval.sql", "F531CEC7664A4E58B2575F8F8FB154EC933D53973F63A7A1036387E2B27C02F3"],
  ["202610010003_report_delivery.sql", "2CA30367916FE708464BAE2A857C34B014089F1D7618D21C1A822DC16E5C7FF4"],
  ["202610010004_time_coverage.sql", "C4868ECC2A0AC7B440D459D80C06EDB65B15AD2929517CFB178570412392A7E3"],
  ["202610010005_time_coverage_hardening.sql", "50A073AAC2913D7EF3F5FE3D32D2879226DDA19A4A15239CF02D65BD9D0179AC"],
  ["202610010006_time_coverage_acceptance.sql", "394E3354FAB91CA3BABD850F3E5B08E32513E08CCC172064F74CDE16594D906B"],
  ["202610010007_time_coverage_completion.sql", "5FEE47AB9A401A6D05A205431365BB3E5840CBA98147E9950AB84FF18C1E454F"],
  ["202610010008_time_coverage_finalization.sql", "AD0DA14254585C341C3F0846EA21E9FD7F8F71020F44A4079D4D5E1424E45A3E"],
  ["202610020009_private_block_notes.sql", "7E4B0E179C8B0D058FD08DCC4127EB16EA4577F432F358A0D133C334E6820A80"],
  ["202610040010_coordination_foundation.sql", "93A161ED5949C02E3067C080E80AAF3E8AE917A8DF66FCC4E788B58FBFAB16F8"],
  ["202610060011_coordination_activation.sql", "9729A6800E93DEDC43AB5F0840309B7C0D222343898CC8D5B43EEB4A387F4210"],
  ["202610140012_sql_receipt_and_onboarding_guards.sql", "CABFE95DBD04AE65EA82C787BC5E3EC8E638E4620456366B7EEB8A5D715DFBF4"],
  ["202610140013_api_identity_foundation.sql", "D013B82BFA1101ED11A35DAEAF7A64B2E6063DA9C09B55E7586CE67CC586BAC2"],
  ["202610150014_operational_api.sql", "6CAF7C6285BC43F651EA9D1CCE845C8AB5428F643F62ECEB88B50FFDE84127D7"],
  ["202610230015_workspace_page.sql", "CC49480D1317F1B44CD29F245508F9C8FB0B0894FE4E66C1B22F8E00D36B33F2"],
];

export const BASELINE_COUNT = 16;
const phaseNames = new Set(["baseline_001_014", "apply_015"]);
const versions = MIGRATIONS.map(([filename]) => filename.slice(0, 12));

function assertPhase(phase) {
  if (!phaseNames.has(phase)) throw new Error("Etapa de migración inválida.");
}

export async function verifyMigrationFiles(root) {
  const directory = path.join(root, "supabase", "migrations");
  const actualNames = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  const expectedNames = MIGRATIONS.map(([name]) => name).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error("El conjunto local de migraciones no coincide exactamente con las 17 revisadas.");
  }
  for (const [filename, expected] of MIGRATIONS) {
    if (!/^[A-F0-9]{64}$/.test(expected)) throw new Error(`Falta fijar el hash aprobado para ${filename}.`);
    const bytes = await readFile(path.join(directory, filename));
    const normalized = Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
    const actual = createHash("sha256").update(normalized).digest("hex").toUpperCase();
    if (actual !== expected) throw new Error(`Hash de migración inesperado: ${filename}.`);
  }
}

export async function createStage(root, stageRoot, phase) {
  assertPhase(phase);
  await verifyMigrationFiles(root);
  await mkdir(stageRoot, { recursive: false });
  const migrationsDir = path.join(stageRoot, "supabase", "migrations");
  await mkdir(migrationsDir, { recursive: true });
  const count = phase === "baseline_001_014" ? BASELINE_COUNT : MIGRATIONS.length;
  for (const [filename] of MIGRATIONS.slice(0, count)) {
    await copyFile(path.join(root, "supabase", "migrations", filename), path.join(migrationsDir, filename));
  }
  await writeFile(path.join(stageRoot, "supabase", "config.toml"),
    'project_id = "grupo-paris-dev-migrations"\n\n[db]\nmajor_version = 17\n\n[db.migrations]\nenabled = true\nschema_paths = []\n',
    { encoding: "utf8", flag: "wx" });
  return { stageRoot, localVersions: versions.slice(0, count) };
}

export function validateHistory(payload, phase, state = "before") {
  assertPhase(phase);
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.migrations)) throw new Error("Formato de historial remoto inesperado.");
  const local = [];
  const remote = [];
  for (const row of payload.migrations) {
    if (!row || typeof row !== "object" || Object.keys(row).sort().join(",") !== "local,remote,time"
        || ![row.local, row.remote, row.time].every((value) => typeof value === "string")) {
      throw new Error("Fila del historial remoto inesperada.");
    }
    if (row.local) local.push(row.local);
    if (row.remote) remote.push(row.remote);
  }
  const localExpected = versions.slice(0, phase === "baseline_001_014" ? BASELINE_COUNT : MIGRATIONS.length);
  let remoteExpected;
  if (state === "after") remoteExpected = localExpected;
  else remoteExpected = phase === "baseline_001_014" ? [] : versions.slice(0, BASELINE_COUNT);
  if (JSON.stringify(local) !== JSON.stringify(localExpected) || JSON.stringify(remote) !== JSON.stringify(remoteExpected)) {
    throw new Error(`Historial incorrecto para ${phase}/${state}: local=${local.length}, remoto=${remote.length}.`);
  }
  return { local: local.length, remote: remote.length };
}

export function validateDryRun(text, phase) {
  assertPhase(phase);
  const expected = phase === "baseline_001_014" ? versions.slice(0, BASELINE_COUNT) : [versions[BASELINE_COUNT]];
  const actual = text.match(/\b\d{12}\b/g) ?? [];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`El dry-run no demuestra exactamente ${expected.length === 1 ? "015" : "001–014"} como pendientes.`);
  }
  return actual;
}

export async function verifySql015ReviewAcceptance(root) {
  const expectedHash = MIGRATIONS[BASELINE_COUNT][1];
  // This separate artifact is intentionally distinct from the accepted
  // bootstrap-contract document. Contract approval alone must never enable SQL.
  const file = path.join(root, "docs", "architecture", "REMOTE-WORKSPACE-015-CODE-SOL-ACCEPTANCE-20261023.md");
  let acceptance;
  try {
    acceptance = await readFile(file, "utf8");
  } catch {
    throw new Error("SQL015 todavía no tiene una aceptación Sol del hash exacto para DEV.");
  }
  if (!acceptance.includes("Dictamen: **apto para aplicar SQL015 en grupo-paris-dev**")
      || !acceptance.includes(`SQL015 SHA-256: \`${expectedHash}\``)) {
    throw new Error("SQL015 todavía no tiene una aceptación Sol del hash exacto para DEV.");
  }
}

async function main() {
  const [command, rootArg, phase, fileArg, state = "before"] = process.argv.slice(2);
  const root = path.resolve(rootArg ?? ".");
  assertPhase(phase);
  if (command === "verify-files") {
    await verifyMigrationFiles(root);
    console.log("Hashes verificados para las 17 migraciones; SQL014 permanece fijada.");
    return;
  }
  if (command === "verify-acceptance") {
    await verifySql015ReviewAcceptance(root);
    console.log("Aceptación Sol coincide con el hash exacto de SQL015.");
    return;
  }
  if (command === "history") {
    const summary = validateHistory(JSON.parse(await readFile(fileArg, "utf8")), phase, state);
    console.log(`Historial validado: ${summary.local} locales, ${summary.remote} remotas.`);
    return;
  }
  if (command === "dry-run") {
    validateDryRun(await readFile(fileArg, "utf8"), phase);
    console.log(`Dry-run validado para ${phase}.`);
    return;
  }
  if (command === "stage") {
    const created = await createStage(root, path.resolve(fileArg), phase);
    console.log(`Entorno Supabase temporal listo con ${created.localVersions.length} migraciones.`);
    return;
  }
  throw new Error("Comando de protección de migración inválido.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Validación de migraciones fallida.");
    process.exitCode = 1;
  });
}
