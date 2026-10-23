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
const legacyDecimal = z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/);
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
const commercialModePayload = exact({ taskId: uuid, enabled: z.boolean() });
const commercialProgressPayload = exact({ taskId: uuid, throughDay: safeInteger(0, 30) });
const dependenciesPayload = exact({ taskId: uuid, prerequisiteIds: z.array(uuid).max(100), availableFrom: day.nullable() }).superRefine((v, c) => {
  if (new Set(v.prerequisiteIds).size !== v.prerequisiteIds.length) c.addIssue({ code: "custom", path: ["prerequisiteIds"], message: "Invalid protocol" });
});
const transitionPayload = exact({ taskId: uuid, status: z.enum(["Pendiente", "En curso", "Completada"]), reason: clean(5, 1000).nullable(), confirmCommercialCompletion: z.boolean() });

// M2.2C definitions are deliberately distinct from the mutable local/D1 task
// model. A v2 operational definition has a unit and no target or weight.
const checklistItem = exact({ id: uuid, text: clean(1, 1000) });
export const definitionV2Schema = z.union([
  exact({ kind: z.literal("resultado"), title: clean(1, 200), objective: clean(0, 4000), sector: clean(1, 200), weight: decimal.refine((v) => Number(v) > 0 && Number(v) <= 100), checklist: z.array(checklistItem).max(100) }).superRefine((v, c) => {
    if (new Set(v.checklist.map((x) => x.id)).size !== v.checklist.length) c.addIssue({ code: "custom", path: ["checklist"], message: "Invalid protocol" });
  }),
  exact({ kind: z.literal("operativa"), title: clean(1, 200), objective: clean(0, 4000), sector: clean(1, 200), unit: clean(1, 80) }),
]);
export const scheduleV2Schema = exact({ frequency: z.enum(["unica", "diaria", "semanal", "mensual"]), startDate: day, endDate: day.nullable(), interval: safeInteger(1, 12), weekdays: z.array(safeInteger(0, 6)).max(7), monthDay: safeInteger(1, 31), hasDeadline: z.boolean(), dueOffsetDays: safeInteger(0, 31) }).superRefine((v, c) => {
  if (v.endDate !== null && v.endDate < v.startDate) c.addIssue({ code: "custom", path: ["endDate"], message: "Invalid protocol" });
  if (v.frequency === "unica" && v.endDate !== null && v.endDate !== v.startDate) c.addIssue({ code: "custom", path: ["endDate"], message: "Invalid protocol" });
  if (v.frequency === "semanal" && v.weekdays.length === 0) c.addIssue({ code: "custom", path: ["weekdays"], message: "Invalid protocol" });
  if (new Set(v.weekdays).size !== v.weekdays.length) c.addIssue({ code: "custom", path: ["weekdays"], message: "Invalid protocol" });
});
const sourceV2Schema = z.union([
  exact({ type: z.literal("catalogue"), templateVersionId: uuid }),
  exact({ type: z.literal("custom"), definition: definitionV2Schema }),
]);
export const onboardingDraftV2Schema = exact({ schemaVersion: z.literal(2), lines: z.array(exact({ lineId: uuid, companyId: uuid, teamId: uuid, source: sourceV2Schema, schedule: scheduleV2Schema })).max(100) }).superRefine((v, c) => {
  const ids = v.lines.map((line) => line.lineId);
  if (new Set(ids).size !== ids.length) c.addIssue({ code: "custom", path: ["lines"], message: "Invalid protocol" });
  if (v.lines.some((line) => line.source.type === "custom" && line.schedule.frequency !== "unica")) c.addIssue({ code: "custom", path: ["lines"], message: "Invalid protocol" });
});
const catalogueCreatePayload = exact({ definition: definitionV2Schema, effectiveOn: day, reason: clean(5, 1000) });
const catalogueRevisePayload = exact({ templateId: uuid, definition: definitionV2Schema, effectiveOn: day, reason: clean(5, 1000) });
const catalogueWeightPayload = exact({ templateId: uuid, weight: decimal.refine((v) => Number(v) > 0 && Number(v) <= 100), effectiveOn: day, reason: clean(5, 1000) });
const onboardingSavePayload = exact({ requestId: uuid.nullable(), draft: onboardingDraftV2Schema });
const onboardingIdPayload = exact({ requestId: uuid });
const requestChangesPayload = exact({ requestId: uuid, reason: clean(5, 1000) });
const approvePayload = exact({ requestId: uuid, weightOverrides: z.array(exact({ lineId: uuid, weight: decimal.refine((v) => Number(v) > 0 && Number(v) <= 100) })).max(100), period: day.refine((v) => v.endsWith("-01")) });
const assignmentCreatePayload = exact({ ownerId: uuid, companyId: uuid, teamId: uuid, source: sourceV2Schema, schedule: scheduleV2Schema }).superRefine((v, c) => {
  if (v.source.type === "custom" && v.schedule.frequency !== "unica") c.addIssue({ code: "custom", path: ["schedule"], message: "Invalid protocol" });
});
const oneOffPayload = exact({ ownerId: uuid, companyId: uuid, teamId: uuid, source: sourceV2Schema, scheduledOn: day, dueDate: day.nullable(), priority: z.enum(["Alta", "Media", "Baja"]) });
const materializePayload = exact({ ownerId: uuid, period: day.refine((v) => v.endsWith("-01")) });
const companyMembershipPayload = exact({ companyId: uuid, profileId: uuid, active: z.boolean(), reason: clean(5, 1000) });
const commandKinds = z.discriminatedUnion("kind", [
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("operation.record"), expectedRevisions: z.record(z.string(), rev), payload: recordPayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("operation.rate"), expectedRevisions: z.record(z.string(), rev), payload: ratePayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("operation.assess"), expectedRevisions: z.record(z.string(), rev), payload: assessPayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("task.commercialMode"), expectedRevisions: z.record(z.string(), rev), payload: commercialModePayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("task.commercialProgress"), expectedRevisions: z.record(z.string(), rev), payload: commercialProgressPayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("task.dependencies"), expectedRevisions: z.record(z.string(), rev), payload: dependenciesPayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("task.transition"), expectedRevisions: z.record(z.string(), rev), payload: transitionPayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("catalogue.create"), expectedRevisions: z.record(z.string(), rev), payload: catalogueCreatePayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("catalogue.revise"), expectedRevisions: z.record(z.string(), rev), payload: catalogueRevisePayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("catalogue.weight"), expectedRevisions: z.record(z.string(), rev), payload: catalogueWeightPayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("onboarding.saveDraft"), expectedRevisions: z.record(z.string(), rev), payload: onboardingSavePayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("onboarding.submit"), expectedRevisions: z.record(z.string(), rev), payload: onboardingIdPayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("onboarding.requestChanges"), expectedRevisions: z.record(z.string(), rev), payload: requestChangesPayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("onboarding.approve"), expectedRevisions: z.record(z.string(), rev), payload: approvePayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("assignment.create"), expectedRevisions: z.record(z.string(), rev), payload: assignmentCreatePayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("task.createOneOff"), expectedRevisions: z.record(z.string(), rev), payload: oneOffPayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("month.materialize"), expectedRevisions: z.record(z.string(), rev), payload: materializePayload }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("companyMembership.setActive"), expectedRevisions: z.record(z.string(), rev), payload: companyMembershipPayload }),
]).superRefine((value, ctx) => {
  const { kind, payload, expectedRevisions } = value;
  if (kind.startsWith("catalogue.") || kind.startsWith("onboarding.") || kind === "assignment.create" || kind === "task.createOneOff" || kind === "month.materialize" || kind === "companyMembership.setActive") {
    const payloadRecord = payload as unknown as Record<string, unknown>;
    const keys = Object.keys(expectedRevisions).sort();
    const orgKey = keys.find((key) => /^catalogue:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key));
    if (kind.startsWith("catalogue.")) {
      const wanted = kind === "catalogue.create" ? [orgKey] : [`catalogue:${String(payloadRecord.templateId)}`, orgKey];
      if (!orgKey || keys.length !== wanted.length || keys.join("\0") !== wanted.filter((x): x is string => x !== undefined).sort().join("\0")) ctx.addIssue({ code: "custom", path: ["expectedRevisions"], message: "Invalid protocol" });
    } else if (kind === "onboarding.saveDraft") {
      const ownerKeys = keys.filter((key) => /^onboardingOwner:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key));
      const wanted = payloadRecord.requestId === null ? [] : [`onboarding:${String(payloadRecord.requestId)}`, `onboardingDraft:${String(payloadRecord.requestId)}`];
      if (ownerKeys.length !== 1 || keys.length !== wanted.length + 1 || keys.filter((key) => !key.startsWith("onboardingOwner:")).sort().join("\0") !== wanted.sort().join("\0")) ctx.addIssue({ code: "custom", path: ["expectedRevisions"], message: "Invalid protocol" });
    } else if (kind.startsWith("onboarding.")) {
      const request = String(payloadRecord.requestId);
      const wanted = kind === "onboarding.submit" ? [`onboarding:${request}`, `onboardingDraft:${request}`] : [`onboarding:${request}`];
      if (kind === "onboarding.approve") {
        if (!keys.includes(`onboarding:${request}`) || keys.some((key) => key !== `onboarding:${request}` && !/^catalogue:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key))) ctx.addIssue({ code: "custom", path: ["expectedRevisions"], message: "Invalid protocol" });
      } else if (keys.join("\0") !== wanted.sort().join("\0")) ctx.addIssue({ code: "custom", path: ["expectedRevisions"], message: "Invalid protocol" });
    } else if (kind === "companyMembership.setActive") {
      const wanted = [`membership:${String(payloadRecord.companyId)}:${String(payloadRecord.profileId)}`];
      if (keys.join("\0") !== wanted.join("\0")) ctx.addIssue({ code: "custom", path: ["expectedRevisions"], message: "Invalid protocol" });
    } else {
      const wanted = [`creation:${String(payloadRecord.ownerId)}`];
      const source = payloadRecord.source as { type?: unknown } | undefined;
      const catalogueKeys = keys.filter((key) => /^catalogue:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key));
      if (kind === "month.materialize" ? keys.join("\0") !== wanted.join("\0") : source?.type === "catalogue"
        ? keys.length !== 2 || !keys.includes(wanted[0]) || catalogueKeys.length !== 1
        : keys.join("\0") !== wanted.join("\0")) ctx.addIssue({ code: "custom", path: ["expectedRevisions"], message: "Invalid protocol" });
    }
    if (kind === "onboarding.approve" && payloadRecord.weightOverrides && new Set((payloadRecord.weightOverrides as Array<{ lineId: string }>).map((x) => x.lineId)).size !== (payloadRecord.weightOverrides as unknown[]).length) ctx.addIssue({ code: "custom", path: ["payload", "weightOverrides"], message: "Invalid protocol" });
    return;
  }
  const legacyPayload = payload as unknown as Record<string, unknown>;
  const taskId = String(legacyPayload.taskId ?? "");
  if (kind === "task.dependencies") {
    const keys = Object.keys(expectedRevisions);
    if (keys.length !== 2 || !keys.includes(`task:${taskId}`) || !keys.some((key) => /^graph:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:\d{4}-\d{2}-01$/.test(key))) {
      ctx.addIssue({ code: "custom", path: ["expectedRevisions"], message: "Invalid protocol" });
    }
    return;
  }
  const wanted = kind === "operation.rate"
    ? [`rate:${String(legacyPayload.companyId)}:${legacyPayload.templateId !== null ? `template:${String(legacyPayload.templateId)}` : `task:${taskId}`}`]
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
  exact({ contractVersion: z.literal(1), kind: z.literal("readiness"), filters: exact({ taskId: uuid }), cursor: z.null(), limit: z.literal(1) }),
  exact({ contractVersion: z.literal(1), kind: z.literal("suggestedRoute"), filters: exact({ subjectId: uuid, period: day.refine((v) => v.endsWith("-01")), companyId: uuid.nullable(), teamId: uuid.nullable(), sector: clean(1, 200).nullable() }), ...pagination }),
  exact({ contractVersion: z.literal(1), kind: z.literal("cataloguePage"), filters: exact({ kind: z.enum(["resultado", "operativa"]).nullable(), active: z.boolean() }), ...pagination }),
  exact({ contractVersion: z.literal(1), kind: z.literal("catalogueHistory"), filters: exact({ templateId: uuid }), ...pagination }),
  exact({ contractVersion: z.literal(1), kind: z.literal("ownOnboarding"), filters: exact({}), cursor: z.null(), limit: z.literal(1) }),
  exact({ contractVersion: z.literal(1), kind: z.literal("parameterInbox"), filters: exact({ status: z.enum(["submitted", "changes_requested", "approved"]), ownerId: uuid.nullable() }), ...pagination }),
  exact({ contractVersion: z.literal(1), kind: z.literal("creationContext"), filters: exact({ ownerId: uuid }), cursor: z.null(), limit: z.literal(1) }),
  exact({ contractVersion: z.literal(1), kind: z.literal("workspacePage"), filters: exact({ subjectId: uuid.nullable(), period: day.refine((v) => v.endsWith("-01")), companyId: uuid.nullable(), teamId: uuid.nullable(), sector: clean(1, 200).nullable() }), ...pagination }),
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
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("task.commercialMode"), result: exact({ taskId: uuid, taskRevision: rev, enabled: z.boolean(), throughDay: safeInteger(0, 30).nullable() }) }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("task.commercialProgress"), result: exact({ taskId: uuid, taskRevision: rev, throughDay: safeInteger(0, 30), completionSuggested: z.boolean() }) }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("task.dependencies"), result: exact({ taskId: uuid, taskRevision: rev, graphRevision: rev }) }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("task.transition"), result: exact({ taskId: uuid, taskRevision: rev, status: z.enum(["Pendiente", "En curso", "Completada"]), completionEventId: uuid.nullable() }) }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("catalogue.create"), result: exact({ templateId: uuid, versionId: uuid, version: rev, catalogueRevision: rev }) }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("catalogue.revise"), result: exact({ templateId: uuid, versionId: uuid, version: rev, catalogueRevision: rev }) }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("catalogue.weight"), result: exact({ templateId: uuid, versionId: uuid, version: rev, catalogueRevision: rev }) }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("onboarding.saveDraft"), result: exact({ requestId: uuid, revision: rev, draftRevision: rev, status: z.string() }) }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("onboarding.submit"), result: exact({ requestId: uuid, revision: rev, draftRevision: rev, status: z.string() }) }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("onboarding.requestChanges"), result: exact({ requestId: uuid, revision: rev, draftRevision: rev, status: z.string() }) }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("onboarding.approve"), result: exact({ requestId: uuid, revision: rev, status: z.string(), activationCount: safeInteger(0, 100), assignmentIds: z.array(uuid).max(100), createdTaskIds: z.array(uuid).max(1000) }) }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("assignment.create"), result: exact({ assignmentId: uuid, assignmentRevision: rev }) }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("task.createOneOff"), result: exact({ assignmentId: uuid, taskId: uuid, taskRevision: rev }) }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("month.materialize"), result: exact({ ownerId: uuid, period: day, createdTaskIds: z.array(uuid).max(1000), creationRevision: rev }) }),
  exact({ contractVersion: z.literal(1), operationId: uuid, kind: z.literal("companyMembership.setActive"), result: exact({ companyId: uuid, profileId: uuid, active: z.boolean(), membershipRevision: rev }) }),
]);

const isoTimestamp = z.string().datetime({ offset: true });
const legacyUnit = z.string().min(1);
const activity = z.union([
  exact({ entryId: uuid, taskId: uuid, workDate: day, quantity: safeInteger(1, 1_000_000), unit: legacyUnit, reference: z.string(), actorId: uuid, createdAt: isoTimestamp, measurementVersion: z.literal(1), rateId: z.null(), unitWeight: z.null(), weightedLoad: z.null() }),
  exact({ entryId: uuid, taskId: uuid, workDate: day, quantity: safeInteger(1, 1_000_000), unit: z.string().min(1).max(80), reference: z.string().nullable(), actorId: uuid, createdAt: isoTimestamp, measurementVersion: z.literal(2), rateId: uuid.nullable(), unitWeight: positiveRate.nullable(), weightedLoad: nullableDecimal }),
]);
const rate = exact({ rateId: uuid, version: rev, effectiveOn: day, unit: z.string().min(1).max(80), unitWeight: positiveRate, createdAt: isoTimestamp, createdBy: uuid, reason: z.string().min(5).max(1000) });
const currentQuality = exact({ assessmentId: uuid, revision: rev, quality: safeInteger(0, 100), order: safeInteger(0, 100), timeliness: safeInteger(0, 100), mean: decimal, observation: z.string().min(5).max(1000), evaluatedBy: uuid, evaluatedAt: isoTimestamp });
const blocker = exact({ code: z.enum(["external_wait", "available_later", "dependencies_pending"]), availableFrom: day.nullable() });
const dependencyDto = exact({ taskId: uuid, title: z.string(), status: z.enum(["Pendiente", "En curso", "Completada"]) });
const readinessData = exact({ taskId: uuid, taskRevision: rev, graphRevision: rev, asOfOn: day, ready: z.boolean(), blockers: z.array(blocker), visibleDependencies: z.array(dependencyDto), hasHiddenDependencies: z.boolean(), commercial: exact({ enabled: z.boolean(), throughDay: safeInteger(0, 30).nullable(), completionSuggested: z.boolean() }) });
const routeItem = exact({ taskId: uuid, taskRevision: rev, title: z.string(), companyId: uuid, ownerId: uuid, period: day, dueDate: day.nullable(), priority: z.enum(["Alta", "Media", "Baja"]), weight: legacyDecimal, scheduledOn: day.nullable(), ready: z.boolean(), blockerCodes: z.array(z.enum(["external_wait", "available_later", "dependencies_pending"])) });
const suggestedRouteData = exact({ asOfOn: day, items: z.array(routeItem), nextCursor: z.string().max(2048).nullable() });
const catalogueChecklistItem = exact({ text: z.string(), done: z.boolean() });
const catalogueResultDefinition = exact({ kind: z.literal("resultado"), title: z.string(), objective: z.string().nullable(), sector: z.string(), weight: legacyDecimal, checklist: z.array(catalogueChecklistItem).max(100) });
const catalogueOperativeV1Definition = exact({ kind: z.literal("operativa"), title: z.string(), objective: z.string().nullable(), sector: z.string(), unit: z.string().nullable(), weight: legacyDecimal, target: safeInteger(1, 2_147_483_647).nullable(), checklist: z.array(catalogueChecklistItem).max(100) });
const catalogueOperativeV2Definition = exact({ kind: z.literal("operativa"), title: z.string(), objective: z.string().nullable(), sector: z.string(), unit: z.string() });
const catalogueDefinitionDto = z.union([catalogueResultDefinition, catalogueOperativeV1Definition, catalogueOperativeV2Definition]);
const catalogueItem = exact({ templateId: uuid, versionId: uuid, version: rev, measurementVersion: safeInteger(1, 2), definition: catalogueDefinitionDto, effectiveOn: day.nullable(), active: z.boolean(), aptForNewAssignment: z.boolean() });
const cataloguePageData = exact({ catalogueRevision: rev, items: z.array(catalogueItem).max(100), nextCursor: z.string().max(2048).nullable() });
const catalogueHistoryItem = exact({ templateId: uuid, versionId: uuid, version: rev, measurementVersion: safeInteger(1, 2), definition: catalogueDefinitionDto, effectiveOn: day.nullable(), createdAt: isoTimestamp, createdBy: uuid.nullable(), reason: z.string().nullable() });
const catalogueHistoryData = exact({ items: z.array(catalogueHistoryItem).max(100), nextCursor: z.string().max(2048).nullable() });
const legacyChecklistItem = z.union([z.string(), exact({ id: uuid.optional(), text: z.string(), done: z.boolean().optional() })]);
const legacyOnboardingLine = exact({ line_id: uuid, company_id: uuid, team_id: uuid, template_version_id: uuid.nullable(), custom_title: z.string().nullable(), kind: z.string().nullable(), unit: z.string().nullable(), target: safeInteger(1, 2_147_483_647).nullable(), checklist: z.array(legacyChecklistItem).max(100), frequency: z.string().nullable(), start_date: day.nullable(), end_date: day.nullable(), interval_count: safeInteger(1, 12).nullable(), weekdays: z.array(safeInteger(0, 6)).max(7), month_day: safeInteger(1, 31).nullable(), has_deadline: z.boolean().nullable(), due_offset_days: safeInteger(0, 31).nullable() });
const legacyOnboardingPayload = z.union([
  exact({ schemaVersion: z.literal(1), lines: z.array(legacyOnboardingLine).max(100) }),
  exact({ requiresResubmission: z.literal(true), lineCount: safeInteger(0, 100) }),
]);
const onboardingPayloadDto = z.union([onboardingDraftV2Schema, legacyOnboardingPayload]);
const submittedRequest = exact({ requestId: uuid, ownerId: uuid, status: z.enum(["submitted", "changes_requested", "approved"]), revision: rev, submittedAt: isoTimestamp, payloadVersion: safeInteger(1, 2), payload: onboardingPayloadDto, reviewEvents: z.array(exact({ action: z.string(), actorId: uuid, at: isoTimestamp, reason: z.string().nullable() })).max(100), requiredRevisions: z.record(z.string(), rev) });
const ownRequest = exact({ requestId: uuid, status: z.string(), revision: rev, draftRevision: rev, payloadVersion: safeInteger(1, 2), draft: onboardingPayloadDto, submitted: submittedRequest.nullable() });
const ownOnboardingData = exact({ ownerRevision: rev, request: ownRequest.nullable() });
const parameterInboxData = exact({ items: z.array(submittedRequest).max(100), nextCursor: z.string().max(2048).nullable() });
const creationContextData = exact({ ownerId: uuid, creationRevision: rev, companies: z.array(exact({ id: uuid, name: z.string() })).max(1000), teams: z.array(exact({ id: uuid, name: z.string() })).max(1000) });
const workspaceCommon = {
  taskId: uuid, taskRevision: rev, ownerId: uuid, ownerDisplayName: z.string().min(1).max(200),
  teamId: uuid, teamName: z.string().min(1).max(200), companyId: uuid, companyName: z.string().min(1).max(200),
  period: day.nullable(), scheduledOn: day.nullable(), title: z.string().min(1).max(200),
  status: z.enum(["Pendiente", "En curso", "Completada"]), dueDate: day.nullable(), priority: z.enum(["Alta", "Media", "Baja"]),
  ready: z.boolean(), blockerCodes: z.array(z.enum(["external_wait", "available_later", "dependencies_pending"])), hasHiddenDependencies: z.boolean(),
};
const workspaceChecklist = z.array(exact({ id: uuid, text: z.string().min(1).max(1000), done: z.boolean() })).max(100);
const workspaceResultItem = exact({ ...workspaceCommon, kind: z.literal("resultado"), measurementVersion: z.literal(1), weight: legacyDecimal.refine((v) => Number(v) > 0 && Number(v) <= 100), target: z.null(), unit: z.null(), checklist: workspaceChecklist, subjectWork: exact({ recordedSeconds: rev }) });
const workspaceOperativeV1Item = exact({ ...workspaceCommon, kind: z.literal("operativa"), measurementVersion: z.literal(1), weight: legacyDecimal.refine((v) => Number(v) > 0 && Number(v) <= 100), target: safeInteger(1, 2_147_483_647), unit: z.string().min(1).max(80), checklist: workspaceChecklist, subjectWork: exact({ recordedSeconds: rev, movementCount: rev, quantity: rev, unit: z.string().min(1).max(80), ratedLoad: legacyDecimal, weightedLoad: legacyDecimal.nullable(), unratedQuantity: rev }) });
const workspaceOperativeV2Item = exact({ ...workspaceCommon, kind: z.literal("operativa"), measurementVersion: z.literal(2), weight: z.null(), target: z.null(), unit: z.string().min(1).max(80), checklist: z.array(z.never()).max(0), subjectWork: exact({ recordedSeconds: rev, movementCount: rev, quantity: rev, unit: z.string().min(1).max(80), ratedLoad: legacyDecimal, weightedLoad: legacyDecimal.nullable(), unratedQuantity: rev }) });
const workspaceItem = z.union([workspaceResultItem, workspaceOperativeV1Item, workspaceOperativeV2Item]);
const workspacePageData = exact({ evaluatedAt: isoTimestamp, items: z.array(workspaceItem).max(100), nextCursor: z.string().max(2048).nullable() });
const queryDataKinds = z.discriminatedUnion("kind", [
  exact({ kind: z.literal("activityPage"), data: exact({ items: z.array(activity), nextCursor: z.string().max(2048).nullable() }) }),
  exact({ kind: z.literal("operationalSummary"), data: exact({ taskId: uuid, unit: legacyUnit, movementCount: rev, quantity: rev, ratedLoad: decimal, weightedLoad: nullableDecimal, unratedQuantity: rev, recordedSeconds: rev, fullyWeighted: z.boolean(), requiresJointReview: z.boolean() }) }),
  exact({ kind: z.literal("rateHistory"), data: exact({ scopeRevision: rev, items: z.array(rate), nextCursor: z.string().max(2048).nullable() }) }),
  exact({ kind: z.literal("quality"), data: exact({ taskId: uuid, current: currentQuality.nullable() }) }),
  exact({ kind: z.literal("commandReceipt"), data: z.discriminatedUnion("found", [exact({ found: z.literal(false) }), exact({ found: z.literal(true), command: commandResponseV1Schema })]) }),
  exact({ kind: z.literal("readiness"), data: readinessData }),
  exact({ kind: z.literal("suggestedRoute"), data: suggestedRouteData }),
  exact({ kind: z.literal("cataloguePage"), data: cataloguePageData }),
  exact({ kind: z.literal("catalogueHistory"), data: catalogueHistoryData }),
  exact({ kind: z.literal("ownOnboarding"), data: ownOnboardingData }),
  exact({ kind: z.literal("parameterInbox"), data: parameterInboxData }),
  exact({ kind: z.literal("creationContext"), data: creationContextData }),
  exact({ kind: z.literal("workspacePage"), data: workspacePageData }),
]);
export const queryResponseV1Schema = z.discriminatedUnion("kind", [
  exact({ contractVersion: z.literal(1), kind: z.literal("activityPage"), data: z.object({ items: z.array(activity), nextCursor: z.string().max(2048).nullable() }).strict() }),
  exact({ contractVersion: z.literal(1), kind: z.literal("operationalSummary"), data: z.object({ taskId: uuid, unit: legacyUnit, movementCount: rev, quantity: rev, ratedLoad: decimal, weightedLoad: nullableDecimal, unratedQuantity: rev, recordedSeconds: rev, fullyWeighted: z.boolean(), requiresJointReview: z.boolean() }).strict() }),
  exact({ contractVersion: z.literal(1), kind: z.literal("rateHistory"), data: z.object({ scopeRevision: rev, items: z.array(rate), nextCursor: z.string().max(2048).nullable() }).strict() }),
  exact({ contractVersion: z.literal(1), kind: z.literal("quality"), data: z.object({ taskId: uuid, current: currentQuality.nullable() }).strict() }),
  exact({ contractVersion: z.literal(1), kind: z.literal("commandReceipt"), data: z.discriminatedUnion("found", [exact({ found: z.literal(false) }), exact({ found: z.literal(true), command: commandResponseV1Schema })]) }),
  exact({ contractVersion: z.literal(1), kind: z.literal("readiness"), data: readinessData }),
  exact({ contractVersion: z.literal(1), kind: z.literal("suggestedRoute"), data: suggestedRouteData }),
  exact({ contractVersion: z.literal(1), kind: z.literal("cataloguePage"), data: cataloguePageData }),
  exact({ contractVersion: z.literal(1), kind: z.literal("catalogueHistory"), data: catalogueHistoryData }),
  exact({ contractVersion: z.literal(1), kind: z.literal("ownOnboarding"), data: ownOnboardingData }),
  exact({ contractVersion: z.literal(1), kind: z.literal("parameterInbox"), data: parameterInboxData }),
  exact({ contractVersion: z.literal(1), kind: z.literal("creationContext"), data: creationContextData }),
  exact({ contractVersion: z.literal(1), kind: z.literal("workspacePage"), data: workspacePageData }),
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
