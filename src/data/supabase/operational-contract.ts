import { z } from "zod";

const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const day = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (value.startsWith("0000")) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
});
const rev = z.string().refine((v) => /^(0|[1-9][0-9]*)$/.test(v) && BigInt(v) <= 9223372036854775807n);
const decimal = z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/);
const positiveRate = decimal.refine((v) => Number(v) > 0 && Number(v) <= 1_000_000);
const clean = (min: number, max: number) => z.string().transform((s) => s.replace(/^[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+|[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+$/gu, "")).pipe(z.string().min(min).max(max));
const reference = z.string().nullable().transform((v) => v === null ? null : v.replace(/^[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+|[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+$/gu, "") || null).pipe(z.string().min(1).max(2000).nullable());
const safeInteger = (min: number, max: number) => z.number().int().min(min).max(max);
const exact = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();
const boundedJson = (maxBytes: number) => z.unknown().superRefine((value, ctx) => {
  try {
    const json = JSON.stringify(value);
    if (json === undefined || new TextEncoder().encode(json).byteLength > maxBytes) {
      ctx.addIssue({ code: "custom", message: "Invalid protocol" });
    }
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid protocol" });
  }
});

const recordPayload = exact({ taskId: uuid, workDate: day, quantity: safeInteger(1, 1_000_000), reference });
const ratePayload = exact({ companyId: uuid, templateId: uuid.nullable(), taskId: uuid.nullable(), effectiveOn: day, unitWeight: positiveRate, reason: clean(5, 1000) }).superRefine((v, ctx) => {
  if ((v.templateId === null) === (v.taskId === null)) ctx.addIssue({ code: "custom", path: ["taskId"], message: "Invalid protocol" });
});
const assessPayload = exact({ taskId: uuid, quality: safeInteger(0, 100), order: safeInteger(0, 100), timeliness: safeInteger(0, 100), observation: clean(5, 1000) });
const commandKinds = z.discriminatedUnion("kind", [
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("operation.record"), expectedRevisions: z.record(z.string(), rev), payload: recordPayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("operation.rate"), expectedRevisions: z.record(z.string(), rev), payload: ratePayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("operation.assess"), expectedRevisions: z.record(z.string(), rev), payload: assessPayload }),
]).superRefine((value, ctx) => {
  const { kind, payload, expectedRevisions } = value;
  const taskId = payload.taskId;
  const wanted = kind === "operation.rate"
    ? [`rate:${payload.companyId}:${payload.templateId !== null ? `template:${payload.templateId}` : `task:${payload.taskId}`}`]
    : kind === "operation.assess" ? [`task:${taskId}`, `assessment:${taskId}`] : [`task:${taskId}`];
  if (Object.keys(expectedRevisions).sort().join("\0") !== [...wanted].sort().join("\0")) ctx.addIssue({ code: "custom", path: ["expectedRevisions"], message: "Invalid protocol" });
});
export const commandV1Schema = boundedJson(32_768).pipe(commandKinds);

const pagination = { cursor: z.string().max(2048).nullable(), limit: safeInteger(1, 100) };
const queryKinds = z.discriminatedUnion("kind", [
  exact({ contractVersion: z.literal(1), kind: z.literal("activityPage"), filters: exact({ taskId: uuid }), ...pagination }),
  exact({ contractVersion: z.literal(1), kind: z.literal("operationalSummary"), filters: exact({ taskId: uuid }), cursor: z.null(), limit: z.literal(1) }),
  exact({ contractVersion: z.literal(1), kind: z.literal("rateHistory"), filters: exact({ companyId: uuid, templateId: uuid.nullable(), taskId: uuid.nullable() }).superRefine((v, c) => { if ((v.templateId === null) === (v.taskId === null)) c.addIssue({ code: "custom", message: "Invalid protocol" }); }), ...pagination }),
  exact({ contractVersion: z.literal(1), kind: z.literal("quality"), filters: exact({ taskId: uuid }), cursor: z.null(), limit: z.literal(1) }),
  exact({ contractVersion: z.literal(1), kind: z.literal("commandReceipt"), filters: exact({ operationId: uuid }), cursor: z.null(), limit: z.literal(1) }),
]);
export const queryV1Schema = boundedJson(4_096).pipe(queryKinds);

const nullableDecimal = decimal.nullable();
const recordResult = exact({ entryId: uuid, taskRevision: rev, measurementVersion: z.literal(2), rateId: uuid.nullable(), unitWeight: positiveRate.nullable(), weightedLoad: nullableDecimal });
const rateResult = exact({ rateId: uuid, scopeRevision: rev, version: rev, effectiveOn: day, unit: z.string().min(1).max(80), unitWeight: positiveRate });
const assessmentResult = exact({ assessmentId: uuid, assessmentRevision: rev, taskRevision: rev, quality: safeInteger(0, 100), order: safeInteger(0, 100), timeliness: safeInteger(0, 100) });
export const commandResponseV1Schema = z.discriminatedUnion("kind", [
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("operation.record"), result: recordResult }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("operation.rate"), result: rateResult }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("operation.assess"), result: assessmentResult }),
]);

const isoTimestamp = z.string().datetime({ offset: true });
const legacyUnit = z.string().min(1);
const activity = z.union([
  exact({ entryId: uuid, taskId: uuid, workDate: day, quantity: safeInteger(1, 1_000_000), unit: legacyUnit, reference: z.string(), actorId: uuid, createdAt: isoTimestamp, measurementVersion: z.literal(1), rateId: z.null(), unitWeight: z.null(), weightedLoad: z.null() }),
  exact({ entryId: uuid, taskId: uuid, workDate: day, quantity: safeInteger(1, 1_000_000), unit: z.string().min(1).max(80), reference: z.string().nullable(), actorId: uuid, createdAt: isoTimestamp, measurementVersion: z.literal(2), rateId: uuid.nullable(), unitWeight: positiveRate.nullable(), weightedLoad: nullableDecimal }),
]);
const rate = exact({ rateId: uuid, version: rev, effectiveOn: day, unit: z.string().min(1).max(80), unitWeight: positiveRate, createdAt: isoTimestamp, createdBy: uuid, reason: z.string().min(5).max(1000) });
const currentQuality = exact({ assessmentId: uuid, revision: rev, quality: safeInteger(0, 100), order: safeInteger(0, 100), timeliness: safeInteger(0, 100), mean: decimal, observation: z.string().min(5).max(1000), evaluatedBy: uuid, evaluatedAt: isoTimestamp });
const queryDataKinds = z.discriminatedUnion("kind", [
  exact({ kind: z.literal("activityPage"), data: exact({ items: z.array(activity), nextCursor: z.string().max(2048).nullable() }) }),
  exact({ kind: z.literal("operationalSummary"), data: exact({ taskId: uuid, unit: legacyUnit, movementCount: rev, quantity: rev, ratedLoad: decimal, weightedLoad: nullableDecimal, unratedQuantity: rev, recordedSeconds: rev, fullyWeighted: z.boolean(), requiresJointReview: z.boolean() }) }),
  exact({ kind: z.literal("rateHistory"), data: exact({ scopeRevision: rev, items: z.array(rate), nextCursor: z.string().max(2048).nullable() }) }),
  exact({ kind: z.literal("quality"), data: exact({ taskId: uuid, current: currentQuality.nullable() }) }),
  exact({ kind: z.literal("commandReceipt"), data: z.discriminatedUnion("found", [exact({ found: z.literal(false) }), exact({ found: z.literal(true), command: commandResponseV1Schema })]) }),
]);
export const queryResponseV1Schema = z.discriminatedUnion("kind", [
  exact({ contractVersion: z.literal(1), kind: z.literal("activityPage"), data: z.object({ items: z.array(activity), nextCursor: z.string().max(2048).nullable() }).strict() }),
  exact({ contractVersion: z.literal(1), kind: z.literal("operationalSummary"), data: z.object({ taskId: uuid, unit: legacyUnit, movementCount: rev, quantity: rev, ratedLoad: decimal, weightedLoad: nullableDecimal, unratedQuantity: rev, recordedSeconds: rev, fullyWeighted: z.boolean(), requiresJointReview: z.boolean() }).strict() }),
  exact({ contractVersion: z.literal(1), kind: z.literal("rateHistory"), data: z.object({ scopeRevision: rev, items: z.array(rate), nextCursor: z.string().max(2048).nullable() }).strict() }),
  exact({ contractVersion: z.literal(1), kind: z.literal("quality"), data: z.object({ taskId: uuid, current: currentQuality.nullable() }).strict() }),
  exact({ contractVersion: z.literal(1), kind: z.literal("commandReceipt"), data: z.discriminatedUnion("found", [exact({ found: z.literal(false) }), exact({ found: z.literal(true), command: commandResponseV1Schema })]) }),
]);

export type CommandV1 = z.infer<typeof commandV1Schema>;
export type QueryV1 = z.infer<typeof queryV1Schema>;
export type CommandResponseV1 = z.infer<typeof commandResponseV1Schema>;
export type QueryResponseV1 = z.infer<typeof queryResponseV1Schema>;
export type DecodeResult<T> = { ok: true; value: T } | { ok: false; error: "protocol" };
function decode<T>(schema: z.ZodType<T>, value: unknown): DecodeResult<T> {
  try {
    const parsed = schema.safeParse(value);
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: "protocol" };
  } catch {
    return { ok: false, error: "protocol" };
  }
}
export const decodeCommandV1 = (value: unknown): DecodeResult<CommandV1> => decode(commandV1Schema, value);
export const decodeQueryV1 = (value: unknown): DecodeResult<QueryV1> => decode(queryV1Schema, value);
export const decodeCommandResponseV1 = (value: unknown): DecodeResult<CommandResponseV1> => decode(commandResponseV1Schema, value);
export const decodeQueryResponseV1 = (value: unknown): DecodeResult<QueryResponseV1> => decode(queryResponseV1Schema, value);
export const decodeQueryDataV1 = (value: unknown) => decode(queryDataKinds, value);
