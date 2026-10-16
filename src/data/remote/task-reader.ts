import { z } from "zod";
import {
  calendarDateSchema,
  postgresUuidSchema,
  taskInstanceSchema,
  taskTimeSessionSchema,
  type RemoteTaskInstance,
  type RemoteTaskTimeSession,
} from "./task-contract";

const pageInput = {
  afterId: postgresUuidSchema.nullable().default(null),
  limit: z.number().int().min(1).max(100).default(50),
};
const taskInput = z
  .strictObject({
    period: calendarDateSchema,
    companyId: postgresUuidSchema.nullable().default(null),
    ownerId: postgresUuidSchema.nullable().default(null),
    teamId: postgresUuidSchema.nullable().default(null),
    ...pageInput,
  })
  .superRefine((value, ctx) => {
    if (!value.period.endsWith("-01"))
      ctx.addIssue({
        code: "custom",
        path: ["period"],
        message: "Invalid period",
      });
  });
const taskByIdInput = z.strictObject({ instanceId: postgresUuidSchema });
const sessionsInput = z
  .strictObject({
    instanceIds: z.array(postgresUuidSchema).min(1).max(100),
    ...pageInput,
  })
  .superRefine((value, ctx) => {
    const normalized = value.instanceIds.map((id) => id.toLowerCase());
    if (new Set(normalized).size !== normalized.length)
      ctx.addIssue({
        code: "custom",
        path: ["instanceIds"],
        message: "Duplicate IDs",
      });
  });

export type TaskReadQuery =
  | Readonly<{
      kind: "taskPage";
      table: "task_instances";
      period: string;
      companyId: string | null;
      ownerId: string | null;
      teamId: string | null;
      afterId: string | null;
      take: number;
    }>
  | Readonly<{
      kind: "taskById";
      table: "task_instances";
      instanceId: string;
      take: 2;
    }>
  | Readonly<{
      kind: "sessionPage";
      table: "task_time_sessions";
      instanceIds: readonly string[];
      afterId: string | null;
      take: number;
    }>;
export type TaskReadTransport = {
  read(
    query: TaskReadQuery,
  ): PromiseLike<{ data: unknown; error: unknown | null }>;
};
export type ReadError = {
  ok: false;
  error: "validation" | "transport" | "server" | "protocol";
  message: string;
};
type Page<T> = {
  ok: true;
  rows: T[];
  hasMore: boolean;
  nextCursor: string | null;
};
const err = (error: ReadError["error"]): ReadError => ({
  ok: false,
  error,
  message: `Task read ${error} error`,
});
const uuidKey = (id: string) => id.toLowerCase();
const freezeQuery = <T extends object>(query: T): Readonly<T> =>
  Object.freeze(query);

function decodeEnvelope(
  result: unknown,
): { data: unknown; error: unknown | null } | null {
  if (
    typeof result !== "object" ||
    result === null ||
    !("data" in result) ||
    !("error" in result)
  )
    return null;
  return result as { data: unknown; error: unknown | null };
}
async function readOnce(transport: TaskReadTransport, query: TaskReadQuery) {
  try {
    const envelope = decodeEnvelope(await transport.read(query));
    if (!envelope) return { ok: false as const, error: "protocol" as const };
    if (envelope.error === undefined)
      return { ok: false as const, error: "protocol" as const };
    if (envelope.error !== null)
      return { ok: false as const, error: "server" as const };
    return { ok: true as const, data: envelope.data };
  } catch {
    return { ok: false as const, error: "transport" as const };
  }
}
function validPage<T>(
  data: unknown,
  schema: z.ZodType<T>,
  take: number,
  afterId: string | null,
  matches: (row: T) => boolean,
): T[] | null {
  if (!Array.isArray(data) || data.length > take) return null;
  const parsed: T[] = [];
  let previous = afterId === null ? null : uuidKey(afterId);
  const seen = new Set<string>();
  for (const raw of data) {
    const row = schema.safeParse(raw);
    if (!row.success || !matches(row.data)) return null;
    const id = (row.data as { id: string }).id;
    const key = uuidKey(id);
    if (seen.has(key) || (previous !== null && key <= previous)) return null;
    seen.add(key);
    previous = key;
    parsed.push(row.data);
  }
  return parsed;
}

export function createTaskReader(transport: TaskReadTransport) {
  async function listTasks(
    input: unknown,
  ): Promise<Page<RemoteTaskInstance> | ReadError> {
    const parsed = taskInput.safeParse(input);
    if (!parsed.success) return err("validation");
    const value = parsed.data;
    const query = freezeQuery({
      kind: "taskPage" as const,
      table: "task_instances" as const,
      period: value.period,
      companyId: value.companyId,
      ownerId: value.ownerId,
      teamId: value.teamId,
      afterId: value.afterId,
      take: value.limit + 1,
    });
    const response = await readOnce(transport, query);
    if (!response.ok) return err(response.error);
    const checked = validPage(
      response.data,
      taskInstanceSchema,
      query.take,
      value.afterId,
      (row) =>
        row.period === value.period &&
        (value.companyId === null ||
          uuidKey(row.company_id) === uuidKey(value.companyId)) &&
        (value.ownerId === null ||
          uuidKey(row.owner_id) === uuidKey(value.ownerId)) &&
        (value.teamId === null ||
          uuidKey(row.team_id) === uuidKey(value.teamId)),
    );
    if (!checked) return err("protocol");
    const rows = checked.slice(0, value.limit);
    const hasMore = checked.length > value.limit;
    return {
      ok: true,
      rows,
      hasMore,
      nextCursor: hasMore ? rows.at(-1)!.id : null,
    };
  }
  async function findTask(
    input: unknown,
  ): Promise<
    | { ok: true; kind: "found"; row: RemoteTaskInstance }
    | { ok: true; kind: "unavailable" }
    | ReadError
  > {
    const parsed = taskByIdInput.safeParse(input);
    if (!parsed.success) return err("validation");
    const response = await readOnce(
      transport,
      freezeQuery({
        kind: "taskById" as const,
        table: "task_instances" as const,
        instanceId: parsed.data.instanceId,
        take: 2 as const,
      }),
    );
    if (!response.ok) return err(response.error);
    if (!Array.isArray(response.data) || response.data.length > 1)
      return err("protocol");
    if (response.data.length === 0) return { ok: true, kind: "unavailable" };
    const row = taskInstanceSchema.safeParse(response.data[0]);
    if (
      !row.success ||
      uuidKey(row.data.id) !== uuidKey(parsed.data.instanceId)
    )
      return err("protocol");
    return { ok: true, kind: "found", row: row.data };
  }
  async function listSessions(
    input: unknown,
  ): Promise<Page<RemoteTaskTimeSession> | ReadError> {
    const parsed = sessionsInput.safeParse(input);
    if (!parsed.success) return err("validation");
    const value = parsed.data;
    const ids = Object.freeze([...value.instanceIds]);
    const query = freezeQuery({
      kind: "sessionPage" as const,
      table: "task_time_sessions" as const,
      instanceIds: ids,
      afterId: value.afterId,
      take: value.limit + 1,
    });
    const allowed = new Set(ids.map(uuidKey));
    const response = await readOnce(transport, query);
    if (!response.ok) return err(response.error);
    const checked = validPage(
      response.data,
      taskTimeSessionSchema,
      query.take,
      value.afterId,
      (row) => allowed.has(uuidKey(row.instance_id)),
    );
    if (!checked) return err("protocol");
    const rows = checked.slice(0, value.limit);
    const hasMore = checked.length > value.limit;
    return {
      ok: true,
      rows,
      hasMore,
      nextCursor: hasMore ? rows.at(-1)!.id : null,
    };
  }
  return { listTasks, findTask, listSessions };
}
