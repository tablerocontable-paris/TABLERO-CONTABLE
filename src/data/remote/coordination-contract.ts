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
