import { z } from "zod";
import { calendarDateSchema, postgresUuidSchema, revisionSchema } from "./task-contract";

// Staged schemaVersion 2. Never merge this into the operational 008 task reader.
export const taskResponsibilitySchema = z.strictObject({
  schemaVersion: z.literal(2),
  instanceId: postgresUuidSchema,
  setId: postgresUuidSchema.nullable(),
  revision: revisionSchema,
  origin: z.enum(["baseline_legacy", "legacy_fallback", "explicit"]),
  mode: z.enum(["individual", "conjunta"]),
  anchorOwnerId: postgresUuidSchema,
  companyId: postgresUuidSchema,
  period: calendarDateSchema.refine((value) => value.endsWith("-01")),
  teamId: postgresUuidSchema,
  sector: z.string().nullable(),
  sectorSource: z.enum(["catalog", "unknown"]),
  members: z.array(z.strictObject({
    profileId: postgresUuidSchema,
    shareBps: z.number().int().min(1).max(10000),
  })),
}).superRefine((value, context) => {
  const issue = (path: string[], message: string) => context.addIssue({ code: "custom", path, message });
  if (value.members.length !== (value.mode === "individual" ? 1 : 2) ||
      new Set(value.members.map((member) => member.profileId.toLowerCase())).size !== value.members.length ||
      value.members.reduce((total, member) => total + member.shareBps, 0) !== 10000)
    issue(["members"], "Invalid responsibility participants or shares");
  if ((value.sectorSource === "unknown" && value.sector !== null) ||
      (value.sectorSource === "catalog" && (value.sector === null || value.sector.trim() === "")))
    issue(["sector"], "Invalid sector snapshot source");
  if (value.origin === "legacy_fallback") {
    if (value.setId !== null || value.revision !== 0)
      issue(["origin"], "Fallback cannot refer to a persisted set");
  } else if (value.setId === null || value.revision < 1) {
    issue(["origin"], "Persisted responsibility requires set and revision");
  }
  if (value.origin !== "explicit" &&
      (value.mode !== "individual" || value.members.length !== 1 ||
       value.members[0]?.profileId.toLowerCase() !== value.anchorOwnerId.toLowerCase() ||
       value.members[0]?.shareBps !== 10000))
    issue(["origin"], "Legacy responsibility must preserve the owner at 100%");
});

export type TaskResponsibility = z.infer<typeof taskResponsibilitySchema>;

const contributionMemberSchema = z.strictObject({
  profileId: postgresUuidSchema,
  displayName: z.string().min(1),
  shareBps: z.number().int().min(1).max(10000),
});

export const coordinatedTaskSchema = z.strictObject({
  schemaVersion: z.literal(3),
  taskId: postgresUuidSchema,
  companyId: postgresUuidSchema,
  period: calendarDateSchema.refine((value) => value.endsWith("-01")),
  scheduledOn: calendarDateSchema,
  title: z.string(),
  kind: z.enum(["resultado", "operativa"]),
  weight: z.number().gt(0).lte(100),
  unit: z.string().nullable(),
  target: z.number().int().positive().nullable(),
  status: z.enum(["Pendiente", "En curso", "Completada"]),
  dueDate: calendarDateSchema.nullable(),
  startedAt: z.string().datetime({ offset: true }).nullable(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  checklist: z.array(z.strictObject({
    id: z.string().min(1),
    done: z.boolean(),
    text: z.string().optional(),
  })),
  isBlocked: z.boolean(),
  stateRevision: revisionSchema,
  responsibility: taskResponsibilitySchema,
  members: z.array(contributionMemberSchema).length(1).or(z.array(contributionMemberSchema).length(2)),
  myContribution: z.strictObject({
    kind: z.enum(["responsible", "coverage"]),
    shareBps: z.number().int().min(0).max(10000),
  }),
  coverage: z.strictObject({
    kind: z.literal("coverage"),
    bindingId: postgresUuidSchema.nullable(),
    startsOn: calendarDateSchema,
    endsOn: calendarDateSchema,
  }).nullable(),
  dueState: z.enum(["no_deadline", "pending", "overdue", "completed_early", "completed_on_time", "completed_late"]),
}).superRefine((value, context) => {
  const ids = value.members.map((member) => member.profileId.toLowerCase());
  if (new Set(ids).size !== ids.length || value.members.reduce((sum, member) => sum + member.shareBps, 0) !== 10000) {
    context.addIssue({ code: "custom", path: ["members"], message: "Invalid members or responsibility shares" });
  }
  if (value.scheduledOn.slice(0, 7) !== value.period.slice(0, 7)) {
    context.addIssue({ code: "custom", path: ["scheduledOn"], message: "Occurrence date does not match period" });
  }
  if (value.kind === "operativa" && (!value.unit?.trim() || value.target === null)) {
    context.addIssue({ code: "custom", path: ["kind"], message: "Invalid operational target" });
  }
});

export const assignTaskResponsibilityInputSchema = z.strictObject({
  instanceId: postgresUuidSchema,
  members: z.array(z.strictObject({
    profileId: postgresUuidSchema,
    shareBps: z.number().int().min(1).max(9999),
  })).length(2),
  reason: z.string().trim().min(1).max(1000),
  expectedRevision: revisionSchema.refine((revision) => revision > 0),
  idempotencyKey: postgresUuidSchema,
}).superRefine((value, context) => {
  const ids = value.members.map((member) => member.profileId.toLowerCase());
  if (new Set(ids).size !== ids.length || value.members.reduce((sum, member) => sum + member.shareBps, 0) !== 10000) {
    context.addIssue({ code: "custom", path: ["members"], message: "Members must be distinct and total 10000 bps" });
  }
});

export const approveTaskCoverageInputSchema = z.strictObject({
  planId: postgresUuidSchema,
  operationId: postgresUuidSchema,
});
export const cancelTaskCoverageInputSchema = z.strictObject({
  bindingId: postgresUuidSchema,
  reason: z.string().trim().min(1).max(1000),
  operationId: postgresUuidSchema,
});

export type CoordinatedTask = z.infer<typeof coordinatedTaskSchema>;
