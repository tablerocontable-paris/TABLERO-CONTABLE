import { z } from "zod";
import {
  calendarDateSchema,
  nonBlankTextSchema,
  postgresUuidSchema,
  revisionSchema,
  taskStatusSchema,
  timestampSchema,
} from "./task-contract";

const common = { operationId: postgresUuidSchema };
const instance = {
  instanceId: postgresUuidSchema,
  expectedRevision: revisionSchema,
};
const quantitySchema = z.number().int().min(1).max(1_000_000);
const commandSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...common,
    ...instance,
    kind: z.literal("start"),
    switch: z.boolean(),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("pause"),
    sessionId: postgresUuidSchema,
  }),
  z.strictObject({
    ...common,
    ...instance,
    kind: z.literal("wait"),
    note: nonBlankTextSchema.nullable(),
  }),
  z.strictObject({
    ...common,
    ...instance,
    kind: z.literal("transition"),
    next: taskStatusSchema,
    reason: z.string().nullable(),
  }),
  z.strictObject({
    ...common,
    ...instance,
    kind: z.literal("checklist"),
    checkId: nonBlankTextSchema,
    done: z.boolean(),
    reason: z.string().nullable(),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("activity"),
    instanceId: postgresUuidSchema,
    workDate: calendarDateSchema,
    quantity: quantitySchema,
    reference: nonBlankTextSchema,
  }),
]);
export type TaskCommand = z.infer<typeof commandSchema>;

const operation = { p_operation_id: postgresUuidSchema };
const task = {
  p_instance: postgresUuidSchema,
  p_expected_revision: revisionSchema,
};
const preparedSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({
      ...common,
      kind: z.literal("start"),
      rpc: z.literal("start_task_timer"),
      args: z.strictObject({ ...operation, ...task, p_switch: z.boolean() }),
    }),
    z.strictObject({
      ...common,
      kind: z.literal("pause"),
      rpc: z.literal("pause_task_timer"),
      args: z.strictObject({ ...operation, p_session: postgresUuidSchema }),
    }),
    z.strictObject({
      ...common,
      kind: z.literal("wait"),
      rpc: z.literal("set_task_wait"),
      args: z.strictObject({
        ...operation,
        ...task,
        p_note: nonBlankTextSchema.nullable(),
      }),
    }),
    z.strictObject({
      ...common,
      kind: z.literal("transition"),
      rpc: z.literal("transition_task_reviewed"),
      args: z.strictObject({
        ...operation,
        ...task,
        p_next: taskStatusSchema,
        p_reason: z.string().nullable(),
      }),
    }),
    z.strictObject({
      ...common,
      kind: z.literal("checklist"),
      rpc: z.literal("set_checklist_item_reviewed"),
      args: z.strictObject({
        ...operation,
        ...task,
        p_check: nonBlankTextSchema,
        p_done: z.boolean(),
        p_reason: z.string().nullable(),
      }),
    }),
    z.strictObject({
      ...common,
      kind: z.literal("activity"),
      rpc: z.literal("record_activity_once"),
      args: z.strictObject({
        ...operation,
        p_instance: postgresUuidSchema,
        p_work_date: calendarDateSchema,
        p_quantity: quantitySchema,
        p_reference: nonBlankTextSchema,
      }),
    }),
  ])
  .superRefine((request, context) => {
    if (request.operationId !== request.args.p_operation_id)
      context.addIssue({
        code: "custom",
        path: ["operationId"],
        message: "Operation mismatch",
      });
  });
type PreparedRequest = z.infer<typeof preparedSchema>;
type FrozenRequest<T> = T extends { args: infer A }
  ? Readonly<Omit<T, "args"> & { args: Readonly<A> }>
  : never;
export type PreparedTaskCommand = FrozenRequest<PreparedRequest>;
export type TaskRpcName = PreparedTaskCommand["rpc"];
export type TaskRpcArguments = PreparedTaskCommand["args"];
export interface TaskRpcTransport {
  rpc(
    name: TaskRpcName,
    args: TaskRpcArguments,
  ): PromiseLike<{ data: unknown; error: unknown | null }>;
}

export type TaskErrorCategory =
  "validation" | "transport" | "server" | "protocol";
const messages: Record<TaskErrorCategory, string> = {
  validation: "La operación no es válida.",
  transport: "No se pudo confirmar la operación.",
  server: "El servidor rechazó la operación.",
  protocol: "La respuesta de la operación no es válida.",
};
export class TaskCommandValidationError extends Error {
  readonly category = "validation";
  constructor() {
    super(messages.validation);
    this.name = "TaskCommandValidationError";
  }
}
type TaskFailure = {
  ok: false;
  error: { category: TaskErrorCategory; message: string };
};
export type TaskExecutionResult =
  | { ok: true; kind: "start"; sessionId: string }
  | { ok: true; kind: "pause"; endedAt: string }
  | { ok: true; kind: "wait" | "transition" | "checklist"; revision: number }
  | { ok: true; kind: "activity"; entryId: string }
  | TaskFailure;
const failure = (category: TaskErrorCategory): TaskFailure => ({
  ok: false,
  error: { category, message: messages[category] },
});
function freezeRequest(request: PreparedRequest): PreparedTaskCommand {
  Object.freeze(request.args);
  return Object.freeze(request);
}

// The caller creates operationId once per intention and retains this snapshot.
export function prepareTaskCommand(input: unknown): PreparedTaskCommand {
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) throw new TaskCommandValidationError();
  const command = parsed.data;
  const shared = { p_operation_id: command.operationId };
  let prepared: PreparedRequest;
  switch (command.kind) {
    case "start":
      prepared = {
        kind: command.kind,
        operationId: command.operationId,
        rpc: "start_task_timer",
        args: {
          ...shared,
          p_instance: command.instanceId,
          p_expected_revision: command.expectedRevision,
          p_switch: command.switch,
        },
      };
      break;
    case "pause":
      prepared = {
        kind: command.kind,
        operationId: command.operationId,
        rpc: "pause_task_timer",
        args: { ...shared, p_session: command.sessionId },
      };
      break;
    case "wait":
      prepared = {
        kind: command.kind,
        operationId: command.operationId,
        rpc: "set_task_wait",
        args: {
          ...shared,
          p_instance: command.instanceId,
          p_expected_revision: command.expectedRevision,
          p_note: command.note,
        },
      };
      break;
    case "transition":
      prepared = {
        kind: command.kind,
        operationId: command.operationId,
        rpc: "transition_task_reviewed",
        args: {
          ...shared,
          p_instance: command.instanceId,
          p_expected_revision: command.expectedRevision,
          p_next: command.next,
          p_reason: command.reason,
        },
      };
      break;
    case "checklist":
      prepared = {
        kind: command.kind,
        operationId: command.operationId,
        rpc: "set_checklist_item_reviewed",
        args: {
          ...shared,
          p_instance: command.instanceId,
          p_expected_revision: command.expectedRevision,
          p_check: command.checkId,
          p_done: command.done,
          p_reason: command.reason,
        },
      };
      break;
    case "activity":
      prepared = {
        kind: command.kind,
        operationId: command.operationId,
        rpc: "record_activity_once",
        args: {
          ...shared,
          p_instance: command.instanceId,
          p_work_date: command.workDate,
          p_quantity: command.quantity,
          p_reference: command.reference,
        },
      };
      break;
  }
  return freezeRequest(prepared);
}

// One request only. ACKs carry identifiers/revisions, never inferred card state.
export function createTaskGateway(transport: TaskRpcTransport) {
  return {
    async execute(prepared: PreparedTaskCommand): Promise<TaskExecutionResult> {
      const parsed = preparedSchema.safeParse(prepared);
      if (!parsed.success) return failure("validation");
      const request = freezeRequest(parsed.data);
      let response: { data: unknown; error: unknown | null };
      try {
        response = await transport.rpc(request.rpc, request.args);
      } catch {
        return failure("transport");
      }
      if (
        response === null ||
        typeof response !== "object" ||
        Array.isArray(response) ||
        !Object.hasOwn(response, "data") ||
        !Object.hasOwn(response, "error")
      )
        return failure("protocol");
      if (response.error !== null) return failure("server");
      switch (request.kind) {
        case "start": {
          const ack = postgresUuidSchema.safeParse(response.data);
          return ack.success
            ? { ok: true, kind: request.kind, sessionId: ack.data }
            : failure("protocol");
        }
        case "pause": {
          const ack = timestampSchema.safeParse(response.data);
          return ack.success
            ? { ok: true, kind: request.kind, endedAt: ack.data }
            : failure("protocol");
        }
        case "activity": {
          const ack = postgresUuidSchema.safeParse(response.data);
          return ack.success
            ? { ok: true, kind: request.kind, entryId: ack.data }
            : failure("protocol");
        }
        default: {
          const ack = revisionSchema.safeParse(response.data);
          return ack.success
            ? { ok: true, kind: request.kind, revision: ack.data }
            : failure("protocol");
        }
      }
    },
  };
}
