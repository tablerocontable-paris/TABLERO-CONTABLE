import { z } from "zod";

// PostgreSQL accepts UUIDs without a particular version/variant, including lab IDs.
export const postgresUuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
  );
}

export const calendarDateSchema = z.string().refine(validCalendarDate);
export const timestampSchema = z.string().refine((value) => {
  const parts =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!parts || !validCalendarDate(parts[1])) return false;
  const [, , hour, minute, second, zone] = parts;
  return (
    Number(hour) < 24 &&
    Number(minute) < 60 &&
    Number(second) < 60 &&
    (zone === "Z" ||
      (Number(zone.slice(1, 3)) < 24 && Number(zone.slice(4)) < 60)) &&
    Number.isFinite(Date.parse(value))
  );
});

export const revisionSchema = z
  .number()
  .refine((value) => Number.isSafeInteger(value) && value >= 0);
export const taskStatusSchema = z.enum(["Pendiente", "En curso", "Completada"]);
export const nonBlankTextSchema = z
  .string()
  .refine((value) => value.trim().length > 0);
const checklistItemSchema = z
  .object({
    id: nonBlankTextSchema,
    done: z.boolean(),
    text: z.string().optional(),
  })
  .passthrough();
const checklistSchema = z
  .array(checklistItemSchema)
  .refine(
    (items) => new Set(items.map((item) => item.id)).size === items.length,
  );

// Full selected server rows, never a fabricated local Task or current catalog copy.
export const taskInstanceSchema = z
  .object({
    id: postgresUuidSchema,
    organization_id: postgresUuidSchema,
    assignment_id: postgresUuidSchema,
    company_id: postgresUuidSchema,
    owner_id: postgresUuidSchema,
    team_id: postgresUuidSchema,
    template_version_id: postgresUuidSchema.nullable(),
    period: calendarDateSchema,
    scheduled_on: calendarDateSchema,
    title: z.string(),
    kind: z.enum(["resultado", "operativa"]),
    weight: z.number().gt(0).lte(100),
    unit: z.string().nullable(),
    target: z.number().refine(Number.isSafeInteger).nullable(),
    status: taskStatusSchema,
    due_date: calendarDateSchema.nullable(),
    started_at: timestampSchema.nullable(),
    completed_at: timestampSchema.nullable(),
    checklist: checklistSchema,
    blocked_by: z.string().nullable(),
    blocked_since: calendarDateSchema.nullable(),
    state_revision: revisionSchema,
  })
  .passthrough()
  .superRefine((row, context) => {
    if (
      !row.period.endsWith("-01") ||
      row.scheduled_on.slice(0, 7) !== row.period.slice(0, 7)
    )
      context.addIssue({
        code: "custom",
        path: ["period"],
        message: "Invalid task period",
      });
    if (
      row.kind === "operativa" &&
      (row.unit === null ||
        row.unit.trim() === "" ||
        row.target === null ||
        row.target <= 0)
    )
      context.addIssue({
        code: "custom",
        path: ["kind"],
        message: "Invalid operational target",
      });
    if (
      row.started_at !== null &&
      row.completed_at !== null &&
      Date.parse(row.completed_at) < Date.parse(row.started_at)
    )
      context.addIssue({
        code: "custom",
        path: ["completed_at"],
        message: "End precedes start",
      });
  });

export const taskTimeSessionSchema = z
  .object({
    id: postgresUuidSchema,
    organization_id: postgresUuidSchema,
    instance_id: postgresUuidSchema,
    actor_id: postgresUuidSchema,
    started_at: timestampSchema,
    ended_at: timestampSchema.nullable(),
    absence_id: postgresUuidSchema.nullable(),
  })
  .passthrough()
  .superRefine((row, context) => {
    if (
      row.ended_at !== null &&
      Date.parse(row.ended_at) < Date.parse(row.started_at)
    )
      context.addIssue({
        code: "custom",
        path: ["ended_at"],
        message: "End precedes start",
      });
  });

export type RemoteTaskInstance = z.infer<typeof taskInstanceSchema>;
export type RemoteTaskTimeSession = z.infer<typeof taskTimeSessionSchema>;
