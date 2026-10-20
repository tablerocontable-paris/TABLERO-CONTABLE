# Recheck Sol — M2.2C legacy coverage replay — NO-GO

Fecha: 2026-10-20
Alcance: recheck local del corte C. No se modificó SQL, no se consultaron servicios remotos y no se hizo commit/push.

## Artefactos revisados

- Contrato: `docs/architecture/M2-2C-LEGACY-COVERAGE-REPLAY-AUTHORIZATION-SOL-CONTRACT-20261020.md`, SHA-256 `9F44C0DAE1C2C3B339CAD7271EE3AD2C80B1E1700711E46692EA15F0929D53C8`.
- SQL014 candidata: `supabase/migrations/202610150014_operational_api.sql`, SHA-256 `CE85FFB750443CB54CC25DD55AE25831CCFE71D8A10EA143D54C34855009447D`.
- Runner repo y canónico: SHA-256 `2D5A5F443D499005501D02AA56CA84A33E8E3858D74787E9F3E2A451D22B5524`.
- Reporte red: SHA-256 `78AAB30AC62B3FEA56D20894BFB6FA32433125DD68E4DE9B7E7A19A6A54529C1`.
- Reporte verde: SHA-256 `917582FECC5F38DB980441A674E9E7A7F38093DE9F38B363975EB7EC6394EC2A`.
- Manifiesto repo y canónico: ambos SHA-256 `38AA6A5B6043325DC1E75AD46EFB389E9D5F315348F6C43BFFBAACCAD98F4BD2`, byte-idénticos.

## Evidencia de carrera confirmada

El runner actual abre primero la transacción auténtica `api.command_v1` del escritor, ejecuta replay concurrente y verifica que `pg_stat_activity` muestra `wait_event_type=Lock` y que `pg_blocking_pids(replay_pid)` contiene el PID del escritor antes de hacer commit. Los cuatro escenarios writer-winner (RC/RC, RC/RR, RR/RC, RR/RR) producen `40001`. En cada uno, el snapshot completo de 57 tablas observado en la transacción del escritor luego de ejecutar la revocación es idéntico al snapshot completo posterior al replay/rollback. Los ocho retries frescos dan `P0001` y conservan el snapshot completo sin cambios.

También se verificaron en el reporte 10 casos red, 28 casos verdes secuenciales y ocho carreras. El artefacto nativo conserva 351/351; el manifiesto registra Vitest 738/738 en 74 archivos, TypeScript, build cliente, build Worker, sintaxis del runner y diff-check con exit code 0. Esta aceptación queda detenida por la inconsistencia documental indicada abajo, no por una falla observada en esas carreras.

## Hallazgo bloqueante

El manifiesto, pese a tener el hash sincronizado indicado arriba y a nombrar los hashes actuales de runner y reportes, conserva la descripción de la implementación anterior:

- `evidence.green.revocationWinnerSnapshotOrder` dice que el escritor hace commit antes de capturar estado y llamar replay.
- `evidence.green.blockersClaimed` dice que los writer-winner son deterministas y no esperan lock.

Ambas afirmaciones contradicen el runner actual y los cuatro objetos writer-winner del reporte verde, que prueban la superposición, el bloqueo real y el snapshot antes del commit del writer. Como el manifiesto es la declaración canónica de evidencia y tiene el hash anunciado como actualizado, el paquete no puede aceptarse mientras su contenido describa una secuencia distinta.

## Resolución requerida

Actualizar ambos manifiestos para que describan literalmente el orden concurrente observado, recalcular y sincronizar sus hashes; comprobar que las rutas canónicas aún resuelven los reportes actuales. Luego solicitar un recheck Sol final. No hace falta modificar SQL014 si los demás artefactos permanecen idénticos.

**Resultado:** NO-GO de evidencia/consistencia para C. No se autoriza aplicar SQL014 ni cerrar el Gate L. Los residuales A y P siguen pendientes para después de aceptar C.
