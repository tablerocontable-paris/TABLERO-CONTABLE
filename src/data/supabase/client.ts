import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseBrowserConfig = {
  url: string;
  publishableKey: string;
};

export type SupabaseClientConfigResult =
  | { ok: true; config: SupabaseBrowserConfig }
  | { ok: false; reason: "missing" | "invalid" };

function isAllowedApiKey(value: string): boolean {
  // Supabase's recommended publishable keys and the legacy anon JWT are safe
  // for browser use when Row Level Security and grants are correctly set.
  if (value.startsWith("sb_publishable_") && value.length >= 32) return true;
  if (!value.startsWith("eyJ")) return false;
  try {
    const payload = JSON.parse(atob(value.split(".")[1] ?? "")) as {
      role?: unknown;
    };
    return payload.role === "anon";
  } catch {
    return false;
  }
}

export function readSupabaseBrowserConfig(
  env: Record<string, unknown>,
): SupabaseClientConfigResult {
  const url = env.VITE_SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (
    typeof url !== "string" ||
    typeof publishableKey !== "string" ||
    !url.trim() ||
    !publishableKey.trim()
  ) {
    return { ok: false, reason: "missing" };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const localHttp =
    parsed.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (
    (!localHttp && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/" ||
    !isAllowedApiKey(publishableKey)
  ) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    config: { url: parsed.origin, publishableKey },
  };
}

export type SupabaseBrowserClientResult =
  | { ok: true; client: SupabaseClient }
  | { ok: false; reason: "missing" | "invalid" };

/** Creates only an end-user browser client; privileged keys are rejected. */
export function createSupabaseBrowserClient(
  env: Record<string, unknown>,
): SupabaseBrowserClientResult {
  const result = readSupabaseBrowserConfig(env);
  if (!result.ok) return result;

  return {
    ok: true,
    client: createClient(result.config.url, result.config.publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    }),
  };
}
