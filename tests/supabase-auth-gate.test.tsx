// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import SupabaseAuthGate from "../src/components/SupabaseAuthGate";

const context = {
  contractVersion: 1,
  principal: {
    kind: "business",
    id: "11111111-1111-4111-8111-111111111111",
    organizationId: "22222222-2222-4222-8222-222222222222",
    displayName: "Valentino Magni",
    role: "empleado",
    teamIds: [],
    companyIds: [],
  },
  authentication: { aal: "aal1", requiresMfa: false },
  capabilities: [],
};
const elevatedContext = {
  ...context,
  principal: { ...context.principal, role: "jefe" },
  authentication: { aal: "aal1", requiresMfa: true },
};
const elevatedContextAfterMfa = {
  ...elevatedContext,
  authentication: { aal: "aal2", requiresMfa: false },
};

function makeClient(
  response: unknown = context,
  mfaResult?: unknown,
  factors: Array<{ id: string; status: string }> = [],
  initialSessionCheck?: Promise<unknown>,
) {
  let authListener: ((event: string, session: unknown) => void) | undefined;
  const session = { access_token: "test-access-token" };
  let activeSession: typeof session | null = null;
  let initialSessionCheckPending = Boolean(initialSessionCheck);
  let mfaVerified = false;
  const rpc = vi.fn(async () => ({
    data: mfaVerified ? (mfaResult ?? response) : response,
    error: null,
  }));
  const client = {
    auth: {
      getSession: vi.fn(async () => {
        if (initialSessionCheckPending && initialSessionCheck) {
          initialSessionCheckPending = false;
          return await initialSessionCheck;
        }
        return { data: { session: activeSession }, error: null };
      }),
      onAuthStateChange: vi.fn((listener) => {
        authListener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithPassword: vi.fn(async () => {
        activeSession = session;
        authListener?.("SIGNED_IN", session);
        return { data: { session }, error: null };
      }),
      signOut: vi.fn(async () => ({ error: null })),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(async () => ({
          data: {
            currentLevel: mfaVerified ? "aal2" : "aal1",
            nextLevel: "aal2",
          },
          error: null,
        })),
        listFactors: vi.fn(async () => ({
          data: { totp: factors, phone: [] },
          error: null,
        })),
        enroll: vi.fn(async () => ({
          data: {
            id: "33333333-3333-4333-8333-333333333333",
            totp: {
              qr_code: "data:image/svg+xml,<svg />",
              secret: "test-totp-secret",
            },
          },
          error: null,
        })),
        challenge: vi.fn(async () => ({
          data: { id: "mfa-challenge-id" },
          error: null,
        })),
        verify: vi.fn(async () => {
          mfaVerified = true;
          authListener?.("MFA_CHALLENGE_VERIFIED", session);
          return { data: { access_token: "aal2-access-token" }, error: null };
        }),
      },
    },
    schema: vi.fn(() => ({ rpc })),
  } as unknown as SupabaseClient;
  return {
    client,
    rpc,
    emitAuth(event: string, nextSession: unknown) {
      activeSession = nextSession ? session : null;
      authListener?.(event, nextSession);
    },
  };
}

describe("SupabaseAuthGate", () => {
  afterEach(() => cleanup());
  it("derives the workspace identity from authenticated server context", async () => {
    const user = userEvent.setup();
    const { client, rpc } = makeClient();
    render(
      <SupabaseAuthGate client={client}>
        {(value) => <p>Espacio: {value.principal.displayName}</p>}
      </SupabaseAuthGate>,
    );

    expect(
      await screen.findByRole("heading", { name: "Ingresar a Grupo París" }),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/perfil|actor/i)).toBeNull();
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "persona@example.test",
    );
    await user.type(screen.getByLabelText("Contraseña"), "not-a-real-password");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByText("Espacio: Valentino Magni")).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith("get_context_v1", undefined);
    expect(screen.getByText("Valentino Magni · empleado")).toBeTruthy();
  });

  it("does not render the workspace when the context response is invalid", async () => {
    const user = userEvent.setup();
    const { client } = makeClient({
      contractVersion: 1,
      principal: { role: "jefe" },
    });
    render(
      <SupabaseAuthGate client={client}>
        {() => <p>Área privada</p>}
      </SupabaseAuthGate>,
    );
    await screen.findByRole("heading", { name: "Ingresar a Grupo París" });
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "persona@example.test",
    );
    await user.type(screen.getByLabelText("Contraseña"), "not-a-real-password");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Espacio de trabajo no disponible",
        }),
      ).toBeTruthy(),
    );
    expect(screen.getByRole("alert").textContent).toContain("no coincide");
    expect(screen.queryByText("Área privada")).toBeNull();
  });

  it("requires TOTP enrollment before rendering an elevated workspace", async () => {
    const user = userEvent.setup();
    const { client } = makeClient(elevatedContext, elevatedContextAfterMfa);
    render(
      <SupabaseAuthGate client={client}>
        {(value) => <p>Espacio: {value.principal.displayName}</p>}
      </SupabaseAuthGate>,
    );
    await screen.findByRole("heading", { name: "Ingresar a Grupo París" });
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "jefe@example.test",
    );
    await user.type(screen.getByLabelText("Contraseña"), "not-a-real-password");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(
      await screen.findByRole("heading", {
        name: "Activá la verificación en dos pasos",
      }),
    ).toBeTruthy();
    expect(screen.queryByText("Espacio: Valentino Magni")).toBeNull();
    expect(screen.getByText("test-totp-secret")).toBeTruthy();
    await user.type(screen.getByLabelText("Código de verificación"), "123456");
    await user.click(
      screen.getByRole("button", { name: "Verificar e ingresar" }),
    );
    expect(await screen.findByText("Espacio: Valentino Magni")).toBeTruthy();
  });

  it("challenges the verified TOTP factor for an elevated account", async () => {
    const user = userEvent.setup();
    const { client } = makeClient(elevatedContext, elevatedContextAfterMfa, [
      { id: "verified-totp", status: "verified" },
    ]);
    render(
      <SupabaseAuthGate client={client}>
        {(value) => <p>Espacio: {value.principal.displayName}</p>}
      </SupabaseAuthGate>,
    );
    await screen.findByRole("heading", { name: "Ingresar a Grupo París" });
    await user.type(screen.getByLabelText("Correo electrónico"), "jefe@example.test");
    await user.type(screen.getByLabelText("Contraseña"), "not-a-real-password");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(
      await screen.findByRole("heading", { name: "Verificá tu identidad" }),
    ).toBeTruthy();
    expect(client.auth.mfa.challenge).toHaveBeenCalledWith({
      factorId: "verified-totp",
    });
    expect(client.auth.mfa.enroll).not.toHaveBeenCalled();
  });

  it("ignores a context response after the session changes to signed out", async () => {
    const user = userEvent.setup();
    let resolveContext!: (value: unknown) => void;
    const delayedContext = new Promise((resolve) => {
      resolveContext = resolve;
    });
    const { client, emitAuth } = makeClient(delayedContext);
    render(
      <SupabaseAuthGate client={client}>
        {(value) => <p>Área privada: {value.principal.displayName}</p>}
      </SupabaseAuthGate>,
    );
    await screen.findByRole("heading", { name: "Ingresar a Grupo París" });
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "persona@example.test",
    );
    await user.type(screen.getByLabelText("Contraseña"), "not-a-real-password");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    await waitFor(() => expect(client.schema).toHaveBeenCalled());

    emitAuth("SIGNED_OUT", null);
    resolveContext({ data: context, error: null });

    expect(
      await screen.findByRole("heading", { name: "Ingresar a Grupo París" }),
    ).toBeTruthy();
    expect(screen.queryByText(/Área privada/)).toBeNull();
  });

  it("does not let a late initial null session overwrite a successful sign-in", async () => {
    let resolveInitialSession!: (value: unknown) => void;
    const initialSessionCheck = new Promise((resolve) => {
      resolveInitialSession = resolve;
    });
    const { client, emitAuth } = makeClient(context, undefined, [], initialSessionCheck);
    render(
      <SupabaseAuthGate client={client}>
        {(value) => <p>Área privada: {value.principal.displayName}</p>}
      </SupabaseAuthGate>,
    );
    await screen.findByText("Revisando la sesión…");
    emitAuth("SIGNED_IN", { access_token: "new-session" });
    expect(await screen.findByText("Área privada: Valentino Magni")).toBeTruthy();

    resolveInitialSession({ data: { session: null }, error: null });
    await waitFor(() =>
      expect(screen.getByText("Área privada: Valentino Magni")).toBeTruthy(),
    );
  });
});
