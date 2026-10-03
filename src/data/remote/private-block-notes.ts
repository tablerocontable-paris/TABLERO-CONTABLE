import { z } from "zod";
import { postgresUuidSchema, revisionSchema } from "./task-contract";

const inputSchema = z.strictObject({
  instanceId: postgresUuidSchema,
  body: z
    .string()
    .refine((value) => Array.from(value.trim()).length <= 2000)
    .nullable(),
  expectedRevision: revisionSchema,
  operationId: postgresUuidSchema,
});
const ackSchema = z.strictObject({
  note_id: postgresUuidSchema,
  revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  cleared: z.boolean(),
});
export type PrivateBlockNoteInput = z.infer<typeof inputSchema>;
export type PrivateBlockNoteResult =
  | { ok: true; noteId: string; revision: number; cleared: boolean }
  | {
      ok: false;
      error: {
        category: "validation" | "transport" | "server" | "protocol" | "aborted";
        message: string;
      };
      ambiguous: boolean;
    };

export interface PrivateBlockNoteTransport {
  rpc(
    name: "save_private_block_note",
    args: {
      p_instance: string;
      p_body: string | null;
      p_expected_revision: number;
      p_operation_id: string;
    },
    options: { signal?: AbortSignal },
  ): PromiseLike<{ data: unknown; error: unknown | null }>;
}

const messages = {
  validation: "El comentario o la revisión no son válidos.",
  transport: "No se pudo confirmar el guardado. Conservá el mismo identificador de operación y revisá el estado antes de reintentar.",
  server: "El servidor rechazó el guardado.",
  protocol: "La respuesta del servidor no se pudo validar. Revisá el estado antes de reintentar.",
  aborted: "La solicitud se canceló. Revisá el estado antes de reintentar.",
} as const;

function fail(
  category: keyof typeof messages,
  ambiguous: boolean,
): PrivateBlockNoteResult {
  return { ok: false, error: { category, message: messages[category] }, ambiguous };
}

export async function savePrivateBlockNote(
  transport: PrivateBlockNoteTransport,
  input: unknown,
  signal?: AbortSignal,
): Promise<PrivateBlockNoteResult> {
  const parsed = inputSchema.safeParse(input);
  if (
    !parsed.success ||
    (parsed.data.body !== null && parsed.data.body.trim().length === 0) ||
    signal?.aborted
  )
    return fail(signal?.aborted ? "aborted" : "validation", false);

  const value = parsed.data;
  let pending: PromiseLike<{ data: unknown; error: unknown | null }>;
  try {
    pending = transport.rpc(
      "save_private_block_note",
      {
        p_instance: value.instanceId,
        p_body: value.body,
        p_expected_revision: value.expectedRevision,
        p_operation_id: value.operationId,
      },
      { signal },
    );
  } catch {
    return fail(signal?.aborted ? "aborted" : "transport", true);
  }

  try {
    const response = await pending;
    if (response.error !== null)
      return fail(signal?.aborted ? "aborted" : "server", signal?.aborted ?? false);
    const ack = ackSchema.safeParse(response.data);
    if (!ack.success) return fail("protocol", true);
    return {
      ok: true,
      noteId: ack.data.note_id,
      revision: ack.data.revision,
      cleared: ack.data.cleared,
    };
  } catch {
    return fail(signal?.aborted ? "aborted" : "transport", true);
  }
}
