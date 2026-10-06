import { z } from "zod";
import { validDate, validateSchedule } from "../domain/schedule";
const key = z
  .string()
  .min(1)
  .max(180)
  .refine((v) => !["__proto__", "constructor", "prototype"].includes(v));
const short = z.string().max(300);
const month = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .refine((v) => validDate(v + "-01"));
const date = z.string().refine(validDate);
const iso = z.string().datetime();
const kind = z.enum(["resultado", "operativa"]);
const frequency = z.enum(["única", "diaria", "semanal", "mensual"]);
const priority = z.enum(["Alta", "Media", "Baja"]);
const quantity = z.number().finite().nonnegative().max(1000000);
const schedule = z
  .object({
    frequency,
    startDate: date,
    endDate: z.union([date, z.literal("")]),
    interval: z.number().int().min(1).max(12),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    monthDay: z.number().int().min(1).max(31),
    hasDeadline: z.boolean(),
    dueOffsetDays: z.number().int().min(0).max(31),
  })
  .superRefine((s, c) => {
    try {
      validateSchedule(s);
    } catch (e) {
      c.addIssue({ code: "custom", message: (e as Error).message });
    }
  });
const profile = z
  .object({
    id: key,
    name: short.min(1),
    email: z.union([z.email(), z.literal("")]).optional(),
    role: z.enum(["jefe", "encargado", "empleado"]),
    managerId: key.nullable(),
    teamId: z.string().max(180),
    sector: short,
    branch: short,
    position: short,
    companyIds: z.array(key).min(1).max(50),
    active: z.boolean(),
  })
  .strict();
const assignment = z
  .object({
    id: key,
    templateId: key.nullable(),
    title: short.min(1),
    ownerId: key,
    companyId: key,
    sector: short,
    kind,
    weight: z.number().min(1).max(100),
    unit: short,
    target: quantity,
    day: z.number().int().min(1).max(31),
    frequency,
    schedule: schedule.optional(),
    steps: z.array(short.min(1)).max(100),
    startMonth: month,
    priority,
    retired: z.boolean().optional(),
  })
  .strict();
const task = z
  .object({
    id: key,
    templateId: key.nullable().optional(),
    assignmentId: key.nullable(),
    scheduledOn: date.optional(),
    title: short.min(1),
    ownerId: key,
    companyId: key,
    teamId: z.string().max(180),
    sector: short,
    month,
    due: z.union([date, z.literal("")]),
    kind,
    weight: z.number().min(1).max(100),
    unit: short,
    target: quantity,
    status: z.enum(["Pendiente", "En curso", "Completada"]),
    checklist: z
      .array(
        z.object({ id: key, text: short.min(1), done: z.boolean() }).strict(),
      )
      .max(100),
    completedAt: iso.nullable(),
    startedAt: iso.nullable(),
    priority,
    blockedBy: short,
    blockedSince: date.nullable(),
    sessions: z
      .array(
        z
          .object({ id: key, actorId: key, start: iso, end: iso.nullable() })
          .strict(),
      )
      .max(10000)
      .optional(),
    reopenCount: z.number().int().nonnegative().optional(),
  })
  .strict();
const activity = z
  .object({
    id: key,
    taskId: key,
    date,
    qty: quantity.positive(),
    note: z.string().max(5000),
    createdAt: iso,
    actorId: key,
  })
  .strict();
const annotation = z
  .object({
    id: key,
    ownerId: key,
    title: short,
    content: z.string().max(20000),
    kind: z.enum(["personal", "formula", "reminder"]),
    category: z.string().max(40).optional(),
    reminderOn: date.nullable(),
    createdAt: iso,
    updatedAt: iso,
    convertedTaskId: key.nullable(),
  })
  .strict();
const draft = z
  .object({
    version: z.number().int(),
    step: z.number().int().min(0).max(5),
    completedAt: iso.nullable(),
    selectedCompanyIds: z.array(key).max(50),
    selectedTemplateIds: z.array(key).max(100),
    day: z.number().int().min(1).max(31),
    frequency,
    schedule: schedule.optional(),
    schedules: z.record(key, schedule).optional(),
    assignmentCompanyIds: z.record(key, z.array(key)).optional(),
    customTasks: z
      .array(
        z.object({
          id: key,
          title: short,
          steps: z.string().max(20000),
          kind,
          unit: short,
          target: quantity,
        }),
      )
      .max(100)
      .optional(),
    home: z.enum(["day", "tasks"]),
    reminders: z.boolean(),
    name: short,
    customTitle: short,
    customSteps: z.string().max(20000),
    customKind: kind,
  })
  .strict();
const absence = z
  .object({
    id: key,
    ownerId: key,
    replacementId: z.string().max(180),
    from: date,
    to: date,
    kind: z.enum(["Vacaciones", "Licencia"]),
    note: z.string().max(5000),
    createdBy: key,
    cancelledAt: iso.optional(),
  })
  .strict();
export const stateSchema = z
  .object({
    version: z.literal(3),
    companies: z
      .array(z.object({ id: key, name: short.min(1) }).strict())
      .min(1)
      .max(50),
    profiles: z.array(profile).max(300),
    teams: z
      .array(z.object({ id: key, name: short, managerId: key }).strict())
      .max(100),
    templates: z
      .array(
        z
          .object({
            id: key,
            title: short.min(1),
            sector: short,
            kind,
            weight: z.number().min(1).max(100),
            unit: short,
            target: quantity,
            steps: z.array(short.min(1)).max(100),
            description: z.string().max(10000),
          })
          .strict(),
      )
      .max(500),
    assignments: z.array(assignment).max(10000),
    tasks: z.array(task).max(30000),
    activity: z.array(activity).max(100000),
    audit: z.array(z.unknown()).max(100000),
    closures: z
      .array(
        z
          .object({ id: key, ownerId: key, month, note: z.string().max(10000) })
          .passthrough(),
      )
      .max(10000),
    annotations: z.array(annotation).max(10000).optional(),
    absences: z.array(absence).max(10000).optional(),
    onboarding: z.record(key, draft),
    parameterReviews: z
      .record(
        key,
        z
          .object({
            onboardingCompletedAt: iso,
            reviewedAt: iso,
            reviewedBy: key,
          })
          .strict(),
      )
      .optional(),
    activeId: key,
    tour: z.record(key, z.number().int().nonnegative()),
    tourVersion: z.record(key, z.number().int().nonnegative()).optional(),
  })
  .strict();
