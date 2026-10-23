// @vitest-environment jsdom
import { act } from "react";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("../src/components/LaboratoryWorkspace", () => ({
  default: () => <div>Laboratorio local</div>,
}));
vi.mock("../src/components/SupabaseAuthGate", () => ({
  default: ({ children }: { children: (context: unknown) => React.ReactNode }) => (
    <div data-testid="auth-gate">
      {children({
        principal: { role: "empleado", displayName: "No mostrar" },
        capabilities: [],
      })}
    </div>
  ),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { mountApplication } from "../src/mount";

const config = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${"a".repeat(32)}`,
};
let mountedRoot: ReturnType<typeof mountApplication> | undefined;

function mount(env: Record<string, unknown>) {
  const container = document.createElement("div");
  document.body.append(container);
  act(() => {
    mountedRoot = mountApplication(container, env);
  });
  return container;
}

afterEach(() => {
  act(() => mountedRoot?.unmount());
  mountedRoot = undefined;
  cleanup();
  document.body.replaceChildren();
  createClient.mockReset();
});

describe("opt-in app bootstrap", () => {
  it("defaults to the laboratory even when Supabase config is present", () => {
    mount(config);
    expect(screen.getByText("Laboratorio local")).toBeTruthy();
    expect(screen.queryByTestId("auth-gate")).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("creates one client before mounting the real StrictMode tree when explicitly enabled", async () => {
    createClient.mockReturnValue({ auth: {} });
    mount({ ...config, VITE_SUPABASE_AUTH_BOOTSTRAP: "true" });
    expect(createClient).toHaveBeenCalledOnce();
    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      config.VITE_SUPABASE_PUBLISHABLE_KEY,
      expect.any(Object),
    );
    expect(screen.getByTestId("auth-gate")).toBeTruthy();
    expect(screen.getByText("Mi trabajo")).toBeTruthy();
    expect(screen.getByText("Vista de solo lectura de las tareas asignadas a tu sesión.")).toBeTruthy();
    await screen.findByRole("alert");
    expect(screen.queryByText("No mostrar")).toBeNull();
    expect(screen.queryByText("Laboratorio local")).toBeNull();
  });

  it.each([
    [{ VITE_SUPABASE_AUTH_BOOTSTRAP: "true" }, "falta"],
    [
      {
        ...config,
        VITE_SUPABASE_AUTH_BOOTSTRAP: "true",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_invalid",
      },
      "no es válida",
    ],
  ])("fails closed for missing or invalid config", (env, reason) => {
    mount(env);
    expect(screen.getByRole("alert").textContent).toContain(reason);
    expect(screen.queryByText("Laboratorio local")).toBeNull();
    expect(screen.queryByTestId("auth-gate")).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("treats non-literal flag values as disabled", () => {
    mount({ ...config, VITE_SUPABASE_AUTH_BOOTSTRAP: "1" });
    expect(screen.getByText("Laboratorio local")).toBeTruthy();
    expect(createClient).not.toHaveBeenCalled();
  });
});
