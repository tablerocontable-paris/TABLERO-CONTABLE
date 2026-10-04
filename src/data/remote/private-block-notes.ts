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

  // Attach both handlers even if cancellation wins: the RPC may settle later.
  const settled = Promise.resolve(pending).then(
    (response) => ({ kind: "response" as const, response: response as unknown }),
    () => ({ kind: "transport" as const }),
  );
  let onAbort: (() => void) | undefined;
  const cancelled = signal && new Promise<{ kind: "aborted" }>((resolve) => {
    onAbort = () => resolve({ kind: "aborted" });
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  try {
    const outcome = await (cancelled ? Promise.race([settled, cancelled]) : settled);
    if (signal?.aborted || outcome.kind === "aborted") return fail("aborted", true);
    if (outcome.kind === "transport") return fail("transport", true);
    const response = outcome.response;
    if (response === null || typeof response !== "object" || Array.isArray(response))
      return fail("protocol", true);
    const envelope = response as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(envelope, "data") ||
        !Object.prototype.hasOwnProperty.call(envelope, "error") || envelope.error === undefined)
      return fail("protocol", true);
    if (envelope.error !== null) return fail("server", false);
    const ack = ackSchema.safeParse(envelope.data);
    if (!ack.success) return fail("protocol", true);
    return {
      ok: true,
      noteId: ack.data.note_id,
      revision: ack.data.revision,
      cleared: ack.data.cleared,
    };
  } catch {
    return fail(signal?.aborted ? "aborted" : "transport", true);
  } finally {
    if (signal && onAbort) signal.removeEventListener("abort", onAbort);
  }
}
