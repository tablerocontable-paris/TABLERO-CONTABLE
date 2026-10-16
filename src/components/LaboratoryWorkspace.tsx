import { useEffect, useRef, useState } from "react";
import App from "../App";
import { load, persist } from "../data/repository";
import { prepareLaboratoryInvitation } from "../domain/parameterization";
import type { State } from "../domain/model";

type Bootstrap = {
  initial: State | null;
  persistenceUnavailable: boolean;
  invitation: string | null;
  attempt: number;
  needsSeedPersist: boolean;
  needsMigrationPersist: boolean;
};

// The release remains a laboratory until the final version is accepted.
// It never imports the operational workspace or calls its API.
export default function LaboratoryWorkspace() {
  const [bootstrap, setBootstrap] = useState<Bootstrap>(() => {
    try {
      const stored = localStorage.getItem("paris-state-lab");
      const state = load(true);
      const invitation = new URLSearchParams(location.search).get("invitacion");
      const normalizedStored = stored === null ? null : JSON.stringify(JSON.parse(stored));
      const needsMigrationPersist = stored !== null && normalizedStored !== JSON.stringify(state);
      return { initial: state, persistenceUnavailable: false, invitation, attempt: 0, needsSeedPersist: stored === null && !invitation, needsMigrationPersist: needsMigrationPersist && !invitation };
    } catch {
      return { initial: null, persistenceUnavailable: true, invitation: null, attempt: 0, needsSeedPersist: false, needsMigrationPersist: false };
    }
  });
  const handledAttempt = useRef(-1);
  const seedPersistAttempted = useRef(false);
  const migrationPersistAttempted = useRef(false);

  useEffect(() => {
    const { initial, invitation, attempt } = bootstrap;
    if (!initial) return;
    if (!invitation && bootstrap.needsMigrationPersist && !migrationPersistAttempted.current) {
      migrationPersistAttempted.current = true;
      try {
        persist(initial, true);
        setBootstrap((current) => ({ ...current, needsMigrationPersist: false, persistenceUnavailable: false }));
      } catch {
        setBootstrap((current) => ({ ...current, persistenceUnavailable: true }));
      }
      return;
    }
    if (!invitation && bootstrap.needsSeedPersist && !seedPersistAttempted.current) {
      seedPersistAttempted.current = true;
      try {
        persist(initial, true);
        setBootstrap((current) => ({ ...current, needsSeedPersist: false }));
      } catch {
        setBootstrap((current) => ({ ...current, persistenceUnavailable: true }));
      }
      return;
    }
    if (!invitation || handledAttempt.current === attempt) return;
    handledAttempt.current = attempt;
    try {
      const prepared = prepareLaboratoryInvitation(initial, invitation);
      persist(prepared, true);
      const params = new URLSearchParams(location.search);
      params.delete("invitacion");
      const search = params.toString();
      history.replaceState(null, "", location.pathname + (search ? "?" + search : ""));
      setBootstrap((current) => ({ ...current, initial: prepared, invitation: null, persistenceUnavailable: false, needsMigrationPersist: false }));
    } catch {
      // Keep the prior identity and URL until the preparation is durably confirmed.
      setBootstrap((current) => ({ ...current, persistenceUnavailable: true }));
    }
  }, [bootstrap]);

  if (!bootstrap.initial) return <main className="storage-recovery" role="alert">
    <h1>No se pudo leer el laboratorio</h1>
    <p>Conservamos el almacenamiento sin modificarlo. No mostramos datos de ejemplo como si fueran los datos guardados.</p>
    <button type="button" onClick={() => location.reload()}>Reintentar lectura</button>
  </main>;

  return <>
    {bootstrap.persistenceUnavailable && <div className="storage-recovery-banner" role="alert">
      <span>{bootstrap.invitation ? "La invitación de laboratorio no se confirmó; sigue activa la identidad anterior." : bootstrap.needsSeedPersist ? "El almacenamiento no confirmó la preparación inicial; podés reintentar sin perder el estado." : bootstrap.needsMigrationPersist ? "La actualización de formato no se confirmó; conservamos la copia anterior y podés reintentar." : "El almacenamiento local no está disponible; podés consultar y exportar, pero no guardar cambios."}</span>
      {bootstrap.invitation && <button type="button" onClick={() => setBootstrap((current) => ({ ...current, persistenceUnavailable: false, attempt: current.attempt + 1 }))}>Reintentar preparación</button>}
      {!bootstrap.invitation && bootstrap.needsSeedPersist && <button type="button" onClick={() => { seedPersistAttempted.current = false; setBootstrap((current) => ({ ...current, persistenceUnavailable: false })); }}>Reintentar guardado inicial</button>}
      {!bootstrap.invitation && bootstrap.needsMigrationPersist && <button type="button" onClick={() => { migrationPersistAttempted.current = false; setBootstrap((current) => ({ ...current, persistenceUnavailable: false })); }}>Reintentar actualización</button>}
    </div>}
    <App initialState={bootstrap.initial} laboratoryMode persistenceUnavailable={bootstrap.persistenceUnavailable} />
  </>;
}
