# Aceptación Sol — cobertura recurrente frente a materialización

Fecha: 19/10/2026. Aceptación acotada, sólo para cuatro casos locales con datos
sintéticos.

## Decisión

GPT-6.1 Sol acepta r3 para la carrera entre `public.approve_task_coverage_plan`
y `api.command_v1(month.materialize)`, ambos órdenes ganadores bajo
READ COMMITTED/READ COMMITTED y REPEATABLE READ/REPEATABLE READ.

El runner comprueba bloqueo real, `40001` del primer intento perdedor, estado
intermedio, retry en sesión nueva con `00000`, comparación de cada respuesta con
su recibo y cardinalidad final de una ocurrencia, una raíz activa y un hijo activo
enlazado por `source_rule_id`. Los cuatro casos pasan en PostgreSQL 17.11; el
reporte da 309/309 y el log no registra `40P01` ni `deadlock detected`.

## Hashes aceptados

Base `f9496d81b3249d43d762d3855178f58ac3baba49`.

| Archivo | SHA-256 |
|---|---|
| `tests/review/m2-1-native-review.mjs` | `288f304c8574278ce4e1130ef4c1b9710e2882875df17f6afe0a759b87833860` |
| SQL011 `202610060011_coordination_activation.sql` | `9729a6800e93dedc43ab5f0840309b7c0d222343898cc8d5b43eeb4a387f4210` |
| SQL014 `202610150014_operational_api.sql` | `ac8cca582cf366b0cf143fd63d99c490c664b00b368eb473757017eebef26315` |
| Reporte nativo | `eb870a28a0fe0e50c747922bd344e0e3b350090a4be0da96ea5f4d945b1c666a` |
| Log del runner | `90febbfe224257867ce75214b317953303e4fcd426c707c7861c7fbbf7e8f770` |
| Log PostgreSQL | `9ac087312dc10a02b028aca23584fa908dd589fcaabb925ae49b1534466cc247` |
| Manifiesto | `d2eafcec09472445e36a6a8720b284dea86e436b2d101f97479074315467f2a5` |

Evidencia: `review-evidence/m2-2c-recurring-coverage-materialize-races-luna-20261019.json`.
La revisión Sol confirmó los siete hashes, los resultados y los recibos.

## Límites de revisión

Sol clasifica como P3, sin bloquear estos cuatro casos: `focusedMatrix` conserva
el nombre de la familia anterior; los snapshots filtran eventos a actores y
entidades conocidos; se registran fences sin afirmar todos sus deltas; y Sol
inspeccionó los artefactos y repitió `node --check`/`git diff --check`, pero no
repitió PostgreSQL, suite completa ni build.

Esta decisión no acepta la matriz completa de §9, no cierra M2.2C/Gate L, no
verifica Supabase alojado/Auth/HTTP y no autoriza aplicar SQL014 remotamente.
