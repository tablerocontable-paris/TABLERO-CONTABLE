import type { State } from "../domain/model";
import { z } from "zod";
import { stateSchema } from "../server/site-schema";

const workspaceResponseSchema = z.strictObject({
  state: stateSchema,
  revision: z.number().refine((value) => Number.isSafeInteger(value) && value >= 0),
  isOwner: z.boolean(),
  presence: z.record(z.string().min(1), z.string().datetime({ offset: true })),
}).superRefine((workspace, context) => {
  if (!workspace.state.profiles.some((profile) => profile.id === workspace.state.activeId && profile.active)) {
    context.addIssue({
      code: "custom",
      path: ["state", "activeId"],
      message: "El perfil activo no existe en el tablero recibido.",
    });
  }
});
export interface WorkspaceResponse {
  state: State;
  revision: number;
  isOwner: boolean;
  presence: Record<string, string>;
}
export class WorkspaceError extends Error {
  constructor(
    message: string,
    public status: number,
    public kind: "http" | "transport" | "protocol" = "http",
  ) {
    super(message);
  }
}
async function request(path: string, init?: RequestInit): Promise<WorkspaceResponse> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new WorkspaceError(
      "No hay conexión con el servidor. Conservamos el cambio para reintentar.",
      0,
      "transport",
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
      ? body.error
      : "No se pudo completar la solicitud.";
    throw new WorkspaceError(
      message,
      response.status,
      "http",
    );
  }
  const parsed = workspaceResponseSchema.safeParse(body);
  if (!parsed.success)
    throw new WorkspaceError(
      "El servidor devolvió un tablero con formato inválido. Conservamos el cambio para reintentar.",
      502,
      "protocol",
    );
  return parsed.data as unknown as WorkspaceResponse;
}
export function readWorkspace(view = "") {
  return request(
    "/api/workspace" + (view ? "?view=" + encodeURIComponent(view) : ""),
  );
}
export function saveWorkspace(
  state: State,
  revision: number,
  action = "Actualizó trabajo",
  entityId = "",
) {
  return request("/api/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, revision, action, entityId }),
  });
}
