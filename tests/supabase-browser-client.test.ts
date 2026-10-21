import { describe, expect, it } from "vitest";
import {
  createSupabaseBrowserClient,
  readSupabaseBrowserConfig,
} from "../src/data/supabase/client";

const url = "https://example.supabase.co";
const publishableKey = `sb_publishable_${"a".repeat(32)}`;
const legacyAnonKey = `eyJhbGciOiJub25lIn0.${btoa(JSON.stringify({ role: "anon" }))}.signature`;

describe("Supabase browser client configuration", () => {
  it("reports missing configuration without exposing values", () => {
    expect(readSupabaseBrowserConfig({ VITE_SUPABASE_URL: url })).toEqual({
      ok: false,
      reason: "missing",
    });
  });

  it("accepts a publishable key and normalizes the project URL", () => {
    expect(
      readSupabaseBrowserConfig({
        VITE_SUPABASE_URL: `${url}/`,
        VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      }),
    ).toEqual({
      ok: true,
      config: { url, publishableKey },
    });
  });

  it("accepts a legacy anon JWT for existing Supabase projects", () => {
    expect(
      readSupabaseBrowserConfig({
        VITE_SUPABASE_URL: url,
        VITE_SUPABASE_PUBLISHABLE_KEY: legacyAnonKey,
      }).ok,
    ).toBe(true);
  });

  it("creates a browser client from the accepted public configuration", () => {
    const result = createSupabaseBrowserClient({
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    });
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(typeof result.client.auth.getSession).toBe("function");
  });

  it.each([
    ["service role key", `sb_secret_${"s".repeat(32)}`],
    ["user credential in URL", "https://user:pass@example.supabase.co"],
    ["insecure non-local URL", "http://example.supabase.co"],
    ["unexpected URL path", "https://example.supabase.co/other"],
    ["malformed anon token", "eyJ.not-a-token.signature"],
  ])("rejects %s", (_label, keyOrUrl) => {
    const result = keyOrUrl.startsWith("http")
      ? readSupabaseBrowserConfig({
          VITE_SUPABASE_URL: keyOrUrl,
          VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
        })
      : readSupabaseBrowserConfig({
          VITE_SUPABASE_URL: url,
          VITE_SUPABASE_PUBLISHABLE_KEY: keyOrUrl,
        });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });
});
