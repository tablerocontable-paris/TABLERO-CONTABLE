import { describe, expect, it, vi } from "vitest";
import {
  postgresUuidSchema,
  taskInstanceSchema,
  taskTimeSessionSchema,
  timestampSchema,
} from "../src/data/remote/task-contract";
import {
  createTaskGateway,
  prepareTaskCommand,
  TaskCommandValidationError,
  type PreparedTaskCommand,
  type TaskCommand,
} from "../src/data/remote/task-gateway";

const id = (n: number) =>
  `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const base = {
  id: id(1),
  organization_id: id(2),
  assignment_id: id(3),
  company_id: id(4),
  owner_id: id(5),
  team_id: id(6),
  template_version_id: null,
  period: "2026-10-01",
  scheduled_on: "2026-10-20",
  title: "Conciliación Banco X",
  kind: "resultado",
  weight: 8,
  unit: null,
  target: null,
  status: "Pendiente",
  due_date: "2026-11-05",
  started_at: null,
  completed_at: null,
  checklist: [
    { id: "b", done: false, extra: { formula: "=SUMA(A1:A5)" } },
    { id: "a", text: "Control", done: true },
  ],
  blocked_by: null,
  blocked_since: null,
  state_revision: 0,
  extra: { source: "snapshot" },
};
const common = { operationId: id(10), instanceId: id(1), expectedRevision: 0 };
const examples: {
  input: TaskCommand;
  rpc: string;
  args: Record<string, unknown>;
  ack: unknown;
  result: Record<string, unknown>;
}[] = [
  {
    input: { ...common, kind: "start", switch: false },
    rpc: "start_task_timer",
    args: {
      p_operation_id: id(10),
      p_instance: id(1),
      p_expected_revision: 0,
      p_switch: false,
    },
    ack: id(11),
    result: { kind: "start", sessionId: id(11) },
  },
  {
    input: { kind: "pause", operationId: id(10), sessionId: id(11) },
    rpc: "pause_task_timer",
    args: { p_operation_id: id(10), p_session: id(11) },
    ack: "2026-10-01T12:00:00-03:00",
    result: { kind: "pause", endedAt: "2026-10-01T12:00:00-03:00" },
  },
  {
    input: { ...common, kind: "wait", note: "  Espera Banco X  " },
    rpc: "set_task_wait",
    args: {
      p_operation_id: id(10),
      p_instance: id(1),
      p_expected_revision: 0,
      p_note: "  Espera Banco X  ",
    },
    ack: 1,
    result: { kind: "wait", revision: 1 },
  },
  {
    input: { ...common, kind: "transition", next: "En curso", reason: null },
    rpc: "transition_task_reviewed",
    args: {
      p_operation_id: id(10),
      p_instance: id(1),
      p_expected_revision: 0,
      p_next: "En curso",
      p_reason: null,
    },
    ack: 1,
    result: { kind: "transition", revision: 1 },
  },
  {
    input: {
      ...common,
      kind: "checklist",
      checkId: "a",
      done: true,
      reason: "  Control adicional  ",
    },
    rpc: "set_checklist_item_reviewed",
    args: {
      p_operation_id: id(10),
      p_instance: id(1),
      p_expected_revision: 0,
      p_check: "a",
      p_done: true,
      p_reason: "  Control adicional  ",
    },
    ack: 1,
    result: { kind: "checklist", revision: 1 },
  },
  {
    input: {
      kind: "activity",
      operationId: id(10),
      instanceId: id(1),
      workDate: "2026-10-01",
      quantity: 7,
      reference: "  Lote 123  ",
    },
    rpc: "record_activity_once",
    args: {
      p_operation_id: id(10),
      p_instance: id(1),
      p_work_date: "2026-10-01",
      p_quantity: 7,
      p_reference: "  Lote 123  ",
    },
    ack: id(12),
    result: { kind: "activity", entryId: id(12) },
  },
];

describe("filas remotas sin traducción a tareas locales", () => {
  it("preserva identidad de dos empresas para el mismo banco, snapshots, metadatos y nulos", () => {
    const original = structuredClone(base);
    expect(taskInstanceSchema.parse(base)).toEqual(original);
    const other = {
      ...base,
      id: id(13),
      assignment_id: id(14),
      company_id: id(15),
      weight: 21,
    };
    expect(taskInstanceSchema.parse(other)).toEqual(other);
    expect(base).toEqual(original);
    expect(taskInstanceSchema.parse({ ...base, due_date: null })).toMatchObject(
      { due_date: null, template_version_id: null, unit: null, target: null },
    );
    expect(
      taskInstanceSchema.parse({
        ...base,
        kind: "operativa",
        unit: "  facturas  ",
        target: 40,
      }),
    ).toMatchObject({ unit: "  facturas  ", target: 40 });
  });
  it("acepta UUID PostgreSQL versión cero y exige filas completas", () => {
    expect(postgresUuidSchema.parse(id(0))).toBe(id(0));
    expect(
      postgresUuidSchema.parse("ABCDEFAB-0000-0000-0000-000000000000"),
    ).toBe("ABCDEFAB-0000-0000-0000-000000000000");
    for (const key of Object.keys(base).filter((key) => key !== "extra")) {
      const incomplete: Record<string, unknown> = { ...base };
      delete incomplete[key];
      expect(taskInstanceSchema.safeParse(incomplete).success, key).toBe(false);
    }
  });
  it("rechaza períodos, fechas, estados, pesos y revisiones inválidos sin rellenarlos", () => {
    for (const patch of [
      { period: "2026-10-02" },
      { scheduled_on: "2026-11-01" },
      { due_date: "2026-02-29" },
      { due_date: "2026-04-31" },
      { due_date: "2026-1-01" },
      { due_date: "0000-01-01" },
      { kind: "operativa", unit: " ", target: 40 },
      { kind: "operativa", unit: "facturas", target: null },
      { kind: "operativa", unit: "facturas", target: 0 },
      { kind: "operativa", unit: "facturas", target: 1.5 },
      { kind: "mensual" },
      { status: "En proceso" },
      { weight: 0 },
      { weight: 101 },
      { weight: Infinity },
      { state_revision: -1 },
      { state_revision: 1.2 },
      { state_revision: Number.MAX_SAFE_INTEGER + 1 },
      { state_revision: "1" },
      { company_id: "Empresa 1" },
      {
        checklist: [
          { id: "a", done: false },
          { id: "a", done: true },
        ],
      },
      { checklist: [{ id: "", done: false }] },
      { checklist: [{ id: "a", done: "true" }] },
      {
        started_at: "2026-10-01T12:00:00Z",
        completed_at: "2026-10-01T11:59:59Z",
      },
    ])
      expect(
        taskInstanceSchema.safeParse({ ...base, ...patch }).success,
        JSON.stringify(patch),
      ).toBe(false);
    expect(
      taskInstanceSchema.parse({
        ...base,
        due_date: "2028-02-29",
        state_revision: Number.MAX_SAFE_INTEGER,
      }),
    ).toMatchObject({
      due_date: "2028-02-29",
      state_revision: Number.MAX_SAFE_INTEGER,
    });
  });
  it("conserva sesiones y offsets; compara instantes y exige zona/calendario válidos", () => {
    const session = {
      id: id(20),
      organization_id: id(2),
      instance_id: id(1),
      actor_id: id(5),
      started_at: "2026-10-01T12:00:00-03:00",
      ended_at: "2026-10-01T15:00:00.000Z",
      absence_id: null,
      extra: { retained: true },
    };
    expect(taskTimeSessionSchema.parse(session)).toEqual(session);
    expect(
      taskTimeSessionSchema.parse({ ...session, ended_at: null }),
    ).toMatchObject({ ended_at: null });
    expect(
      taskTimeSessionSchema.safeParse({
        ...session,
        ended_at: "2026-10-01T14:59:59Z",
      }).success,
    ).toBe(false);
    for (const value of [
      "2026-10-01T15:00:00",
      "2026-02-29T15:00:00Z",
      "2026-10-01T24:00:00Z",
      "2026-10-01T15:00:00+25:00",
      "2026-10-01T15:61:00Z",
      new Date(),
    ])
      expect(timestampSchema.safeParse(value).success).toBe(false);
    for (const key of [
      "id",
      "organization_id",
      "instance_id",
      "actor_id",
      "started_at",
      "ended_at",
      "absence_id",
    ]) {
      const incomplete: Record<string, unknown> = { ...session };
      delete incomplete[key];
      expect(taskTimeSessionSchema.safeParse(incomplete).success).toBe(false);
    }
  });
  it("compara fracciones originales sin aceptar un cierre anterior al inicio", () => {
    const intervals: [string, string, boolean][] = [
      ["2026-10-01T15:00:00.123456Z", "2026-10-01T15:00:00.123455Z", false],
      [
        "2026-10-01T00:00:00.000001+03:00",
        "2026-09-30T21:00:00.000000Z",
        false,
      ],
      [
        "2026-10-01T12:00:00.123456-03:00",
        "2026-10-01T15:00:00.123456000Z",
        true,
      ],
      ["2026-10-01T15:00:00.123456Z", "2026-10-01T15:00:00.123457Z", true],
      ["1969-12-31T23:59:59.999999Z", "1970-01-01T00:00:00Z", true],
      ["2026-10-01T15:00:00.999999Z", "2026-10-01T15:00:01.000000Z", true],
    ];
    for (const [started_at, ended_at, valid] of intervals) {
      const session = {
        id: id(20),
        organization_id: id(2),
        instance_id: id(1),
        actor_id: id(5),
        started_at,
        ended_at,
        absence_id: null,
      };
      expect(
        taskTimeSessionSchema.safeParse(session).success,
        `${started_at} → ${ended_at}`,
      ).toBe(valid);
      const task = {
        ...base,
        status: "Completada",
        started_at,
        completed_at: ended_at,
      };
      expect(taskInstanceSchema.safeParse(task).success).toBe(valid);
      if (valid) {
        expect(taskTimeSessionSchema.parse(session)).toEqual(session);
        expect(taskInstanceSchema.parse(task)).toEqual(task);
      }
    }
  });
});

describe("gateway de seis RPC con intenciones conservadas", () => {
  it.each(examples)(
    "envía una vez $rpc con firma exacta y valida el ACK escalar",
    async ({ input, rpc: name, args, ack, result }) => {
      const rpc = vi.fn(() => ({
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(resolve({ data: ack, error: null })),
      }));
      const prepared = prepareTaskCommand(input);
      expect(prepared).toEqual({
        kind: input.kind,
        operationId: id(10),
        rpc: name,
        args,
      });
      // The injected interface permits Supabase-style PromiseLike builders.
      const gateway = createTaskGateway({ rpc: rpc as any });
      expect(await gateway.execute(prepared)).toEqual({ ok: true, ...result });
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith(name, args);
    },
  );
  it("clona y congela la intención sin mutar entrada ni cambiar nulos/texto", () => {
    const input = { ...common, kind: "wait" as const, note: null };
    const original = structuredClone(input),
      prepared = prepareTaskCommand(input);
    expect(input).toEqual(original);
    input.operationId = id(30);
    input.expectedRevision = 20;
    expect(prepared).toMatchObject({
      operationId: id(10),
      args: { p_operation_id: id(10), p_expected_revision: 0, p_note: null },
    });
    expect(Object.isFrozen(prepared)).toBe(true);
    expect(Object.isFrozen(prepared.args)).toBe(true);
    expect(() => {
      (prepared.args as any).p_operation_id = id(30);
    }).toThrow();
  });
  it("rechaza entradas sin intención, switch explícito o con autoridad añadida", () => {
    const start = examples[0].input;
    for (const extra of [
      { actor: id(5) },
      { organization_id: id(2) },
      { role: "jefe" },
      { operationId: undefined },
      { switch: undefined },
      { expectedRevision: "0" },
    ])
      expect(() => prepareTaskCommand({ ...start, ...extra })).toThrow(
        TaskCommandValidationError,
      );
    for (const input of [
      { ...common, kind: "wait", note: " " },
      {
        kind: "activity",
        operationId: id(10),
        instanceId: id(1),
        workDate: "2026-10-01",
        quantity: 0,
        reference: "x",
      },
      {
        kind: "activity",
        operationId: id(10),
        instanceId: id(1),
        workDate: "2026-10-01",
        quantity: 1_000_001,
        reference: "x",
      },
      {
        kind: "activity",
        operationId: id(10),
        instanceId: id(1),
        workDate: "2026-10-01",
        quantity: 2.5,
        reference: "x",
      },
      {
        kind: "activity",
        operationId: id(10),
        instanceId: id(1),
        workDate: "2026-10-01",
        quantity: 2,
        reference: " ",
      },
    ])
      expect(() => prepareTaskCommand(input)).toThrow(
        TaskCommandValidationError,
      );
  });
  it("un cast no elude validación de RPC, firma, autoridad o clave antes del transporte", async () => {
    const prepared = prepareTaskCommand(examples[0].input),
      rpc = vi.fn(async () => ({ data: id(11), error: null }));
    const gateway = createTaskGateway({ rpc });
    for (const bad of [
      { ...prepared, rpc: "record_activity_once" },
      { ...prepared, rpc: "transition_task" },
      { ...prepared, actor: id(5) },
      { ...prepared, args: { ...prepared.args, actor_id: id(5) } },
      { ...prepared, operationId: id(30) },
      { ...prepared, args: { ...prepared.args, p_switch: undefined } },
      { ...prepared, args: { ...prepared.args, p_expected_revision: "0" } },
    ])
      expect(await gateway.execute(bad as PreparedTaskCommand)).toMatchObject({
        ok: false,
        error: { category: "validation" },
      });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("separa fallos de transporte/servidor/protocolo y omite excepciones privadas", async () => {
    const prepared = prepareTaskCommand(examples[0].input);
    for (const [category, implementation] of [
      [
        "transport",
        async () => {
          throw new Error("credential=PRIVATE");
        },
      ],
      [
        "server",
        async () => ({ data: null, error: { message: "credential=PRIVATE" } }),
      ],
      ["protocol", async () => ({ data: "PRIVATE", error: null })],
      ["protocol", async () => ({ data: id(11) })],
    ] as const) {
      const rpc = vi.fn(implementation),
        result = await createTaskGateway({ rpc: rpc as any }).execute(prepared);
      expect(result).toMatchObject({ ok: false, error: { category } });
      expect(JSON.stringify(result)).not.toContain("PRIVATE");
      expect(rpc).toHaveBeenCalledTimes(1);
    }
  });
  it("rechaza ACK de otra forma, fecha sin zona y revisiones inseguras sin reintentar", async () => {
    for (const [input, invalid] of [
      [examples[0].input, { session_id: id(11) }],
      [examples[1].input, "2026-10-01T12:00:00"],
      [examples[2].input, "1"],
      [examples[2].input, Number.MAX_SAFE_INTEGER + 1],
      [examples[2].input, -1],
      [examples[3].input, 1.1],
      [examples[4].input, null],
      [examples[5].input, { entry_id: id(12) }],
    ] as const) {
      const rpc = vi.fn(async () => ({ data: invalid, error: null }));
      expect(
        await createTaskGateway({ rpc }).execute(prepareTaskCommand(input)),
      ).toMatchObject({ ok: false, error: { category: "protocol" } });
      expect(rpc).toHaveBeenCalledTimes(1);
    }
  });
  it.each(["transport", "protocol"])(
    "replay explícito tras fallo %s conserva clave y argumentos byte a byte",
    async (category) => {
      const prepared = prepareTaskCommand(examples[0].input),
        bytes = JSON.stringify(prepared);
      const calls: string[] = [];
      const rpc = vi.fn(async (name, args) => {
        calls.push(
          JSON.stringify({
            kind: prepared.kind,
            operationId: prepared.operationId,
            rpc: name,
            args,
          }),
        );
        if (calls.length === 1) {
          if (category === "transport")
            throw new Error("ACK lost after commit");
          return { data: null, error: null };
        }
        return { data: id(11), error: null };
      });
      const gateway = createTaskGateway({ rpc });
      expect(await gateway.execute(prepared)).toMatchObject({
        ok: false,
        error: { category },
      });
      expect(calls).toEqual([bytes]);
      expect(await gateway.execute(prepared)).toEqual({
        ok: true,
        kind: "start",
        sessionId: id(11),
      });
      expect(calls).toEqual([bytes, bytes]);
      expect(JSON.stringify(prepared)).toBe(bytes);
    },
  );
});
