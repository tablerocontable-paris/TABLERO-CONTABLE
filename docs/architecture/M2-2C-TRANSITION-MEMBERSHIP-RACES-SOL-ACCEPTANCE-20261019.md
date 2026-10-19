# Aceptación Sol — carreras task.transition/revocación — 19/10/2026

## Decisión y alcance

**ACEPTADO**, únicamente para los cuatro casos nuevos de
`task.transition` frente a `companyMembership.setActive(false)`: ambos ganadores
bajo RC/RC y RR/RR. No cierra Gate L ni §9, no prueba Auth/HTTP de Supabase y no
autoriza aplicar SQL014.

## Evidencia revisada

- Base y `sourceCommit`: `b4d223d51141178f360d8b86594145a9d755a023`.
- PostgreSQL 17.11: **305/305**, fallos 0, `40P01=0`.
- Cada escenario verifica el aislamiento efectivo, actores diferentes con
  permisos adecuados, espera observable con `pg_blocking_pids`, conflicto
  `40001` y retry después de rollback en una transacción nueva.
- Transición primero: retry de la revocación `00000`.
- Revocación primero: retry de la transición `42501`, sin cambio adicional de
  tarea, recibo, evento ni auditoría.
- Los snapshots antes/durante/después del retry coinciden entre el reporte y el
  manifiesto para los cuatro casos; los estados registrados son coherentes.
- SHA‑256 recalculados desde bytes actuales:

| Artefacto | SHA‑256 |
|---|---|
| Runner `tests/review/m2-1-native-review.mjs` | `d00b0ddd7c1fb0820da7b5b341e897b8c74519416ce24e7129c32a60e88d7ce7` |
| SQL014, sin cambios | `ac8cca582cf366b0cf143fd3d99c490c664b00b368eb473757017eebef26315` |
| Reporte PostgreSQL | `b24b0d11a6489c82652b42e1ca40ca57a7a7786ec2dfecf9e9b2718f3e502b73` |
| Log del runner | `4deec186ed9455fbed7773939cb8c72864d04264e75c17d48a1e44a0ec65c365` |
| Manifiesto Luna | `55b3dd6d15c7a5e25083256c6d526249d0fe6ae251f00d1da2bdc5dd27d6a5cf` |

Comprobaciones adicionales reejecutadas por el agente principal sobre el árbol
del candidato: Vitest **738/738 en 74 archivos**; `tsc --noEmit`, build Vite de
cliente, build Worker, `node --check` del runner y `git diff --check`, todos con
código 0. Hook completo **196/196**.

## Límites P3 conservados

- La consulta de auditoría filtra actores esperados; podría ocultar una fila
  adicional atribuida a otro actor.
- Los snapshots registran valores de fences y cantidad de sesiones, pero el
  runner no afirma cada delta por separado ni captura las filas completas de
  sesiones. Los datos reportados fueron revisados manualmente.
- Se conserva `review.json`, no `postgres.log`; el cero deadlock está respaldado
  por el resultado y log del runner con hashes verificados, pero el log nativo
  no pudo releerse durante la revisión.
- La revisión Sol cubre estos cuatro casos y sus hashes. No certifica CI ni el
  resto del Gate L.

Evidencia primaria: `review-evidence/m2-2c-transition-membership-races-luna-20261019.json`.
