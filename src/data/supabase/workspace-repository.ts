import {
  decodeQueryResponseV1,
  decodeQueryV1,
  type QueryResponseV1,
  type QueryV1,
} from "./operational-contract";

export type WorkspacePageV2Query = Omit<Extract<QueryV1, { kind: "workspacePageV2" }>, "contractVersion" | "kind">;
export type WorkspacePageV2Response = Extract<QueryResponseV1, { kind: "workspacePageV2" }>;
export type TaskChecklistPageQuery = Omit<Extract<QueryV1, { kind: "taskChecklistPage" }>, "contractVersion" | "kind">;
export type TaskChecklistPageResponse = Extract<QueryResponseV1, { kind: "taskChecklistPage" }>;

export type WorkspaceQueryFailure = "unauthenticated" | "transport" | "server" | "protocol";
export type WorkspaceQueryResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: WorkspaceQueryFailure };

/** Deliberately narrow capability: this repository can only issue read queries. */
export interface WorkspaceQueryTransport {
  query(input: unknown): Promise<WorkspaceQueryResult<QueryResponseV1>>;
}

const failure = <T>(error: WorkspaceQueryFailure): WorkspaceQueryResult<T> => ({ ok: false, error });

type WorkspaceResponseFor<K extends "workspacePageV2" | "taskChecklistPage"> = Extract<QueryResponseV1, { kind: K }>;

function runQuery<K extends "workspacePageV2" | "taskChecklistPage">(
  transport: WorkspaceQueryTransport,
  input: Omit<Extract<QueryV1, { kind: K }>, "contractVersion" | "kind">,
  expectedKind: K,
): Promise<WorkspaceQueryResult<WorkspaceResponseFor<K>>> {
  return (async () => {
    const request = { ...input, contractVersion: 1 as const, kind: expectedKind } as Extract<QueryV1, { kind: K }>;
    const checkedRequest = decodeQueryV1(request);
    if (!checkedRequest.ok || checkedRequest.value.kind !== expectedKind) return failure("protocol");

    let result: WorkspaceQueryResult<QueryResponseV1>;
    try {
      // Send the shared decoder's canonical value (for example, trimmed sector).
      result = await transport.query(checkedRequest.value);
    } catch {
      return failure("transport");
    }
    if (!result || typeof result !== "object" || typeof result.ok !== "boolean") return failure("protocol");
    if (!result.ok) {
      if (["unauthenticated", "transport", "server", "protocol"].includes(result.error)) {
        return failure(result.error);
      }
      return failure("protocol");
    }

    const rawResponse: unknown = result.value;
    const decoded = decodeQueryResponseV1(rawResponse);
    if (!decoded.ok || decoded.value.kind !== expectedKind) return failure("protocol");
    // Validate with the shared contract, but return the raw value: strings,
    // revisions, cursors and Unicode segments are opaque protocol data here.
    return { ok: true, value: rawResponse as WorkspaceResponseFor<K> };
  })();
}

export function createWorkspaceRepository(transport: WorkspaceQueryTransport) {
  return {
    listPage(input: WorkspacePageV2Query): Promise<WorkspaceQueryResult<WorkspacePageV2Response>> {
      return runQuery(transport, input, "workspacePageV2");
    },

    readChecklistPage(input: TaskChecklistPageQuery): Promise<WorkspaceQueryResult<TaskChecklistPageResponse>> {
      return runQuery(transport, input, "taskChecklistPage");
    },
  };
}
