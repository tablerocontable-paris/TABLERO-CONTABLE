import {
  operationalSeed,
  identify,
  projectState,
  applyProposal,
} from "./site-policy";
import type { State } from "../domain/model";
import {
  readStore,
  initializeStore,
  writeStore,
  type Database,
} from "./site-store";
interface Env {
  DB: Database;
  ASSETS: { fetch(request: Request): Promise<Response> };
  OWNER_EMAIL: string;
  SITE_ORIGIN?: string;
}
function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (url.pathname !== "/api/workspace")
    return json({ error: "Ruta no encontrada." }, 404);
  const email = request.headers
    .get("oai-authenticated-user-email")
    ?.toLowerCase();
  if (!email || !request.headers.get("oai-authenticated-user-id"))
    return json(
      { error: "Iniciá sesión con ChatGPT para abrir tu tablero." },
      401,
    );
  if (!env.DB || !env.OWNER_EMAIL)
    return json(
      { error: "El espacio de trabajo todavía no está configurado." },
      503,
    );
  if (request.method !== "GET" && request.method !== "POST")
    return json({ error: "Método no permitido." }, 405);
  const sameOrigin =
    request.headers.get("Origin") === (env.SITE_ORIGIN || url.origin);
  if (
    request.method === "POST" &&
    (!sameOrigin ||
      request.headers.get("Sec-Fetch-Site") === "cross-site" ||
      !request.headers.get("Content-Type")?.startsWith("application/json"))
  )
    return json({ error: "Solicitud de guardado no autorizada." }, 403);
  let row = await readStore(env.DB);
  if (!row) {
    if (email !== env.OWNER_EMAIL.toLowerCase())
      return json(
        { error: "Administración debe iniciar el espacio de trabajo." },
        403,
      );
    await initializeStore(env.DB, operationalSeed(env.OWNER_EMAIL));
    row = await readStore(env.DB);
  }
  if (!row) throw Error("Workspace not initialized");
  let s = row.state;
  let body: {
    state?: State;
    revision?: number;
    action?: string;
    entityId?: string;
  } = {};
  if (request.method === "POST") {
    if (Number(request.headers.get("Content-Length") || 0) > 4000000)
      return json({ error: "El cambio es demasiado grande." }, 413);
    const raw = await request.text();
    if (raw.length > 4000000)
      return json({ error: "El cambio es demasiado grande." }, 413);
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Solicitud inválida." }, 400);
    }
  }
  let auth;
  try {
    auth = identify(
      s,
      email,
      env.OWNER_EMAIL,
      request.method === "GET"
        ? url.searchParams.get("view") || ""
        : body.state?.activeId || "",
    );
  } catch (e) {
    return json({ error: (e as Error).message }, 403);
  }
  if (request.method === "POST") {
    if (!Number.isInteger(body.revision) || body.revision !== row.revision)
      return json(
        {
          error:
            "Otra sesión guardó cambios. Actualizá el tablero para continuar; conservamos tu propuesta.",
        },
        409,
      );
    const previous = s;
    try {
      s = applyProposal(
        s,
        body.state,
        auth.actor,
        typeof body.action === "string" ? body.action : "",
        typeof body.entityId === "string" ? body.entityId : "",
      );
    } catch (e) {
      return json({ error: (e as Error).message }, 422);
    }
    if (!(await writeStore(env.DB, previous, s, body.revision!)))
      return json(
        { error: "Otra sesión guardó cambios. Actualizá antes de continuar." },
        409,
      );
    row.revision++;
    auth = identify(s, email, env.OWNER_EMAIL, auth.actor.id);
  }
  let presenceResults: { profile_id: string; last_seen: string }[] = [];
  try {
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO paris_presence (profile_id,last_seen) VALUES (?,?) ON CONFLICT(profile_id) DO UPDATE SET last_seen = excluded.last_seen",
    )
      .bind(auth.actor.id, now)
      .run();
    const presence = await env.DB.prepare(
      "SELECT profile_id, last_seen FROM paris_presence",
    ).all<{ profile_id: string; last_seen: string }>();
    presenceResults = presence.results;
  } catch {
    // Presence is advisory. A committed workspace write remains committed.
    console.warn("Workspace presence unavailable");
    presenceResults = [];
  }
  const projected = projectState(s, auth.actor);
  return json({
    state: projected,
    revision: row.revision,
    isOwner: auth.isOwner,
    presence: Object.fromEntries(
      presenceResults
        .filter((r) => projected.profiles.some((p) => p.id === r.profile_id))
        .map((r) => [r.profile_id, r.last_seen]),
    ),
  });
}
export default {
  async fetch(request: Request, env: Env) {
    try {
      return await handle(request, env);
    } catch (e) {
      console.error(
        "Workspace unavailable",
        e instanceof Error ? e.message : "unknown",
      );
      return json(
        {
          error:
            "No se pudo acceder a los datos. Tu trabajo guardado se conserva; reintentá.",
        },
        503,
      );
    }
  },
};
