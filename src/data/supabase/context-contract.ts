import { z } from "zod";

const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const displayNameSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((value) => value.trim().length > 0);
const uuidListSchema = z.array(uuidSchema).superRefine((values, context) => {
  const normalized = values.map((value) => value.toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    context.addIssue({ code: "custom", message: "Invalid protocol" });
  }
  if (
    normalized.some(
      (value, index) => index > 0 && normalized[index - 1] >= value,
    )
  ) {
    context.addIssue({ code: "custom", message: "Invalid protocol" });
  }
});

const businessPrincipalSchema = z
  .object({
    kind: z.literal("business"),
    id: uuidSchema,
    organizationId: uuidSchema,
    displayName: displayNameSchema,
    role: z.enum(["empleado", "encargado", "jefe"]),
    teamIds: uuidListSchema,
    companyIds: uuidListSchema,
  })
  .strict();

const technicalPrincipalSchema = z
  .object({
    kind: z.literal("technical"),
    id: uuidSchema,
    organizationId: uuidSchema,
    displayName: displayNameSchema,
    role: z.literal("maintainer"),
  })
  .strict();

const contextShape = z
  .object({
    contractVersion: z.literal(1),
    principal: z.discriminatedUnion("kind", [
      businessPrincipalSchema,
      technicalPrincipalSchema,
    ]),
    authentication: z
      .object({ aal: z.enum(["aal1", "aal2"]), requiresMfa: z.boolean() })
      .strict(),
    capabilities: z.array(z.never()).length(0),
  })
  .strict();

export type UUID = z.infer<typeof uuidSchema>;
export type ContextV1 = z.infer<typeof contextShape>;
export type ContextDecodeResult =
  { ok: true; context: ContextV1 } | { ok: false; error: "protocol" };

export const contextV1Schema = contextShape.superRefine((value, context) => {
  const elevated =
    value.principal.kind === "technical" ||
    value.principal.role === "jefe" ||
    value.principal.role === "encargado";
  const expected = value.authentication.aal === "aal1" && elevated;
  if (value.authentication.requiresMfa !== expected) {
    context.addIssue({
      code: "custom",
      message: "Invalid protocol",
      path: ["authentication", "requiresMfa"],
    });
  }
});

export function decodeContextV1(value: unknown): ContextDecodeResult {
  const parsed = contextV1Schema.safeParse(value);
  return parsed.success
    ? { ok: true, context: parsed.data }
    : { ok: false, error: "protocol" };
}
