import type { SupabaseClient } from "@supabase/supabase-js";
import { decodeContextV1 } from "./context-contract";
import {
  decodeCommandResponseV1,
  decodeCommandV1,
  decodeQueryResponseV1,
  decodeQueryV1,
  type CommandResponseV1,
  type CommandV1,
  type QueryResponseV1,
  type QueryV1,
} from "./operational-contract";

export type OperationalFailure =
  "unauthenticated" | "transport" | "server" | "protocol";
export type OperationalResult<T> =
  { ok: true; value: T } | { ok: false; error: OperationalFailure };

type UntypedSupabaseClient = SupabaseClient<any>;
type AuthStateListener = (authenticated: boolean) => void;

const failure = <T>(error: OperationalFailure): OperationalResult<T> => ({
  ok: false,
  error,
});

/**
 * Thin v1 transport over the authenticated Supabase client. The caller must
 * provide a publishable-key client; actor identity and authorization always
 * come from the JWT validated by Postgres, never from a profile selector.
 * This adapter deliberately does not persist, translate, or submit workspace
 * state and is not wired into the laboratory entry point.
 */
export function createOperationalTransport(client: UntypedSupabaseClient) {
  async function hasSession(): Promise<boolean | "transport"> {
    try {
      const { data, error } = await client.auth.getSession();
      if (error) return false;
      return Boolean(data.session?.access_token);
    } catch {
      return "transport";
    }
  }

  async function call<T>(
    rpc: string,
    args: Record<string, unknown> | undefined,
    decode: (value: unknown) => { ok: true; value: T } | { ok: false },
  ): Promise<OperationalResult<T>> {
    const session = await hasSession();
    if (session === "transport") return failure("transport");
    if (!session) return failure("unauthenticated");

    let response: { data: unknown; error: unknown | null };
    try {
      response = await client.schema("api").rpc(rpc, args);
    } catch {
      return failure("transport");
    }
    if (
      response === null ||
      typeof response !== "object" ||
      !Object.hasOwn(response, "data") ||
      !Object.hasOwn(response, "error")
    ) {
      return failure("protocol");
    }
    if (response.error !== null) return failure("server");
    const decoded = decode(response.data);
    return decoded.ok
      ? { ok: true, value: decoded.value }
      : failure("protocol");
  }

  return {
    subscribeAuth(listener: AuthStateListener): () => void {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        listener(Boolean(session?.access_token));
      });
      return () => data.subscription.unsubscribe();
    },

    async getContext() {
      return call("get_context_v1", undefined, (value) => {
        const decoded = decodeContextV1(value);
        return decoded.ok
          ? { ok: true as const, value: decoded.context }
          : { ok: false as const };
      });
    },

    async query(input: unknown): Promise<OperationalResult<QueryResponseV1>> {
      const request = decodeQueryV1(input);
      if (!request.ok) return failure("protocol");
      return call("query_v1", { p: request.value }, decodeQueryResponseV1);
    },

    async command(
      input: unknown,
    ): Promise<OperationalResult<CommandResponseV1>> {
      const request = decodeCommandV1(input);
      if (!request.ok) return failure("protocol");
      return call("command_v1", { p: request.value }, decodeCommandResponseV1);
    },
  };
}

export type { CommandV1, QueryV1 };
