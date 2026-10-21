import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createOperationalTransport } from "../src/data/supabase/operational-transport";

const taskId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const operationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeClient({
  authenticated = true,
  data = null,
  error = null,
}: {
  authenticated?: boolean;
  data?: unknown;
  error?: unknown;
} = {}) {
  const authListener = vi.fn();
  const unsubscribe = vi.fn();
  const rpc = vi.fn().mockResolvedValue({ data, error });
  const schema = vi.fn(() => ({ rpc }));
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: authenticated ? { access_token: "signed-jwt" } : null,
        },
        error: null,
      }),
      onAuthStateChange: vi.fn(
        (callback: (event: string, session: unknown) => void) => {
          authListener.mockImplementation(callback);
          return { data: { subscription: { unsubscribe } } };
        },
      ),
    },
    schema,
  } as unknown as SupabaseClient<any>;
  return { client, rpc, schema, authListener, unsubscribe };
}

describe("Supabase operational v1 transport", () => {
  it("does not call an RPC without an authenticated session", async () => {
    const { client, rpc } = makeClient({ authenticated: false });
    const transport = createOperationalTransport(client);

    await expect(transport.getContext()).resolves.toEqual({
      ok: false,
      error: "unauthenticated",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("subscribes only to authenticated state and releases the listener", () => {
    const { client, authListener, unsubscribe } = makeClient();
    const transport = createOperationalTransport(client);
    const listener = vi.fn();

    const stop = transport.subscribeAuth(listener);
    authListener("SIGNED_IN", { access_token: "jwt" });
    authListener("SIGNED_OUT", null);
    stop();

    expect(listener).toHaveBeenNthCalledWith(1, true);
    expect(listener).toHaveBeenNthCalledWith(2, false);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("decodes the authoritative context RPC response", async () => {
    const context = {
      contractVersion: 1,
      principal: {
        kind: "business",
        id: taskId,
        organizationId: operationId,
        displayName: "Empleado de prueba",
        role: "empleado",
        teamIds: [],
        companyIds: [],
      },
      authentication: { aal: "aal1", requiresMfa: false },
      capabilities: [],
    };
    const { client, rpc, schema } = makeClient({ data: context });
    const transport = createOperationalTransport(client);

    await expect(transport.getContext()).resolves.toEqual({
      ok: true,
      value: context,
    });
    expect(schema).toHaveBeenCalledWith("api");
    expect(rpc).toHaveBeenCalledWith("get_context_v1", undefined);
  });

  it("sends only the validated query envelope and rejects malformed responses", async () => {
    const query = {
      contractVersion: 1,
      kind: "ownOnboarding",
      filters: {},
      cursor: null,
      limit: 1,
    };
    const response = {
      contractVersion: 1,
      kind: "ownOnboarding",
      data: { ownerRevision: "0", request: null },
    };
    const { client, rpc, schema } = makeClient({ data: response });
    const transport = createOperationalTransport(client);

    await expect(transport.query(query)).resolves.toEqual({
      ok: true,
      value: response,
    });
    expect(schema).toHaveBeenCalledWith("api");
    expect(rpc).toHaveBeenCalledWith("query_v1", { p: query });
    await expect(transport.query({ ...query, ignored: true })).resolves.toEqual(
      {
        ok: false,
        error: "protocol",
      },
    );
    await expect(
      transport.query({ ...query, actorId: taskId }),
    ).resolves.toEqual({
      ok: false,
      error: "protocol",
    });
    expect(rpc).toHaveBeenCalledOnce();

    const malformed = makeClient({
      data: { ...response, ignored: "unexpected" },
    });
    const malformedTransport = createOperationalTransport(malformed.client);
    await expect(malformedTransport.query(query)).resolves.toEqual({
      ok: false,
      error: "protocol",
    });
    malformed.rpc.mockResolvedValue({ data: response });
    await expect(malformedTransport.query(query)).resolves.toEqual({
      ok: false,
      error: "protocol",
    });
  });

  it("sends a validated command and never returns an unvalidated acknowledgement", async () => {
    const command = {
      contractVersion: 1,
      operationId,
      kind: "operation.record",
      expectedRevisions: { [`task:${taskId}`]: "0" },
      payload: {
        taskId,
        workDate: "2026-10-21",
        quantity: 2,
        reference: null,
      },
    };
    const response = {
      contractVersion: 1,
      operationId,
      kind: "operation.record",
      result: {
        entryId: taskId,
        taskRevision: "1",
        measurementVersion: 2,
        rateId: null,
        unitWeight: null,
        weightedLoad: null,
      },
    };
    const { client, rpc, schema } = makeClient({ data: response });
    const transport = createOperationalTransport(client);

    await expect(transport.command(command)).resolves.toEqual({
      ok: true,
      value: response,
    });
    expect(schema).toHaveBeenCalledWith("api");
    expect(rpc).toHaveBeenCalledWith("command_v1", { p: command });
    await expect(
      transport.command({ ...command, operationId: "not-a-uuid" }),
    ).resolves.toEqual({ ok: false, error: "protocol" });
  });

  it("normalizes server and transport failures without leaking server details", async () => {
    const serverClient = makeClient({
      error: { message: "private database detail" },
    });
    const serverTransport = createOperationalTransport(serverClient.client);
    await expect(serverTransport.getContext()).resolves.toEqual({
      ok: false,
      error: "server",
    });

    const broken = makeClient();
    broken.rpc.mockRejectedValue(new Error("private network detail"));
    const brokenTransport = createOperationalTransport(broken.client);
    await expect(brokenTransport.getContext()).resolves.toEqual({
      ok: false,
      error: "transport",
    });
  });
});
