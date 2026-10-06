import type { State } from "../domain/model";
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
  ) {
    super(message);
  }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
    );
  }
  const body = await response
    .json()
    .catch(() => ({ error: "El servidor no respondió correctamente." }));
  if (!response.ok)
    throw new WorkspaceError(
      body.error || "No se pudo guardar.",
      response.status,
    );
  return body;
}
export function readWorkspace(view = "") {
  return request<WorkspaceResponse>(
    "/api/workspace" + (view ? "?view=" + encodeURIComponent(view) : ""),
  );
}
export function saveWorkspace(
  state: State,
  revision: number,
  action = "Actualizó trabajo",
  entityId = "",
) {
  return request<WorkspaceResponse>("/api/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, revision, action, entityId }),
  });
}
