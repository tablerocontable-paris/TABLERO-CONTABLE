import { type State, id } from "../domain/model";
import { equal } from "./site-policy";
export interface Result {
  meta: { changes: number };
  results?: Record<string, unknown>[];
}
export interface Statement {
  bind(...args: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<Result>;
  all<T>(): Promise<{ results: T[] }>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<Result[]>;
}
interface Row {
  data: string;
  revision: number;
}
const arrays = [
  "companies",
  "teams",
  "profiles",
  "templates",
  "assignments",
  "tasks",
  "activity",
  "audit",
  "closures",
  "annotations",
  "absences",
] as const;
const maps = ["onboarding", "tour", "tourVersion", "parameterReviews"] as const;
interface RecordRow {
  collection: string;
  id: string;
  data: string;
}
function records(s: State) {
  return [
    ...arrays.flatMap((collection) =>
      (s[collection] || []).map((r) => ({
        collection,
        id: r.id,
        data: JSON.stringify(r),
      })),
    ),
    ...maps.flatMap((collection) =>
      Object.entries(s[collection] || {}).map(([id, value]) => ({
        collection,
        id,
        data: JSON.stringify(value),
      })),
    ),
  ];
}
export async function readStore(
  db: Database,
): Promise<{ state: State; revision: number } | null> {
  const row = await db
    .prepare("SELECT data, revision FROM paris_workspace WHERE id = ?")
    .bind("main")
    .first<Row>();
  if (!row) return null;
  // Reading revision and rows in the same batch gives one consistent SQLite snapshot.
  const values = (await db.batch([
    db
      .prepare("SELECT data, revision FROM paris_workspace WHERE id = ?")
      .bind("main"),
    db.prepare(
      "SELECT collection, id, data FROM paris_records ORDER BY collection, id",
    ),
  ])) as unknown as { results: Record<string, unknown>[] }[];
  const header = values[0].results[0] as unknown as Row;
  const s = JSON.parse(header.data) as State;
  for (const k of arrays) (s as unknown as Record<string, unknown>)[k] = [];
  for (const k of maps) (s as unknown as Record<string, unknown>)[k] = {};
  for (const record of values[1].results as unknown as RecordRow[]) {
    const value = JSON.parse(record.data);
    if ((arrays as readonly string[]).includes(record.collection))
      (s as unknown as Record<string, unknown[]>)[record.collection].push(
        value,
      );
    else if ((maps as readonly string[]).includes(record.collection))
      (s as unknown as Record<string, Record<string, unknown>>)[
        record.collection
      ][record.id] = value;
  }
  return { state: s, revision: header.revision };
}
function upsert(db: Database, r: RecordRow, token: string) {
  return db
    .prepare(
      "INSERT INTO paris_records (collection, id, data) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM paris_workspace WHERE id = ? AND write_token = ?) ON CONFLICT(collection,id) DO UPDATE SET data = excluded.data",
    )
    .bind(r.collection, r.id, r.data, "main", token);
}
export async function initializeStore(db: Database, s: State) {
  const token = id();
  await db.batch([
    db
      .prepare(
        "INSERT OR IGNORE INTO paris_workspace (id, revision, data, updated_at, write_token) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(
        "main",
        0,
        JSON.stringify({ version: s.version, activeId: s.activeId }),
        new Date().toISOString(),
        token,
      ),
    ...records(s).map((r) => upsert(db, r, token)),
  ]);
}
export async function writeStore(
  db: Database,
  previous: State,
  next: State,
  revision: number,
): Promise<boolean> {
  const token = id();
  const old = new Map(
    records(previous).map((r) => [r.collection + ":" + r.id, r]),
  );
  const updated = records(next);
  const keys = new Set(updated.map((r) => r.collection + ":" + r.id));
  const statements = [
    db
      .prepare(
        "UPDATE paris_workspace SET revision = revision + 1, updated_at = ?, write_token = ? WHERE id = ? AND revision = ?",
      )
      .bind(new Date().toISOString(), token, "main", revision),
  ];
  for (const r of updated) {
    const prior = old.get(r.collection + ":" + r.id);
    if (!prior || !equal(JSON.parse(prior.data), JSON.parse(r.data)))
      statements.push(upsert(db, r, token));
  }
  for (const r of old.values())
    if (!keys.has(r.collection + ":" + r.id))
      statements.push(
        db
          .prepare(
            "DELETE FROM paris_records WHERE collection = ? AND id = ? AND EXISTS (SELECT 1 FROM paris_workspace WHERE id = ? AND write_token = ?)",
          )
          .bind(r.collection, r.id, "main", token),
      );
  const result = await db.batch(statements);
  return result[0].meta.changes === 1;
}
