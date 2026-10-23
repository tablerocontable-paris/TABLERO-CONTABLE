import type { SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import LaboratoryWorkspace from "./components/LaboratoryWorkspace";
import SupabaseAuthGate from "./components/SupabaseAuthGate";
import {
  createSupabaseBrowserClient,
  type SupabaseBrowserClientResult,
} from "./data/supabase/client";
import { createOperationalTransport } from "./data/supabase/operational-transport";
import MyWork from "./components/MyWork";

export type BootstrapEnvironment = Record<string, unknown> & {
  VITE_SUPABASE_AUTH_BOOTSTRAP?: unknown;
};

export type ApplicationBootstrapState =
  | { mode: "laboratory" }
  | { mode: "configuration-error"; reason: "missing" | "invalid" }
  | { mode: "remote-diagnostic"; client: SupabaseClient };

export type ClientFactory = (env: Record<string, unknown>) => SupabaseBrowserClientResult;

/** Resolve the opt-in before React renders; the factory is never called by a component. */
export function resolveApplicationBootstrap(
  env: BootstrapEnvironment,
  clientFactory: ClientFactory = createSupabaseBrowserClient,
): ApplicationBootstrapState {
  if (env.VITE_SUPABASE_AUTH_BOOTSTRAP !== "true") {
    return { mode: "laboratory" };
  }

  const result = clientFactory(env);
  return result.ok
    ? { mode: "remote-diagnostic", client: result.client }
    : { mode: "configuration-error", reason: result.reason };
}

function DiagnosticWorkspace({ client }: { client: SupabaseClient }) {
  const queryTransport = useMemo(() => {
    const operational = createOperationalTransport(client);
    return { query: operational.query };
  }, [client]);
  return (
    <div>
      <MyWork transport={queryTransport} />
    </div>
  );
}

/** Pure view over bootstrap state already resolved before createRoot. */
export function ApplicationBootstrap({
  bootstrap,
}: {
  bootstrap: ApplicationBootstrapState;
}) {
  if (bootstrap.mode === "laboratory") return <LaboratoryWorkspace />;
  if (bootstrap.mode === "configuration-error") {
    const reason = bootstrap.reason === "missing" ? "falta" : "no es válida";
    return (
      <main className="fatal" role="alert">
        <h1>No se puede iniciar el acceso de prueba.</h1>
        <p>
          La configuración del acceso a Supabase {reason}. Revisá
          VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY. El laboratorio no
          se abrirá como alternativa.
        </p>
      </main>
    );
  }

  return (
    <SupabaseAuthGate client={bootstrap.client}>
      {() => <DiagnosticWorkspace client={bootstrap.client} />}
    </SupabaseAuthGate>
  );
}
