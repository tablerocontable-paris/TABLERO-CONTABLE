# Reautorización de replay legacy de cronómetro — aceptación Sol

Fecha: 2026-10-19
Estado: **aceptado localmente en el alcance del contrato**
Contrato SHA-256: `A006EC42F26C08992C8F0CA2BF149359D937D6B15CF639D4FF67E5FDEE489A5F`

## Evidencia aceptada

- SQL014 candidato SHA-256: `C6A4ACDD92653DFFE9A0576EC3D8FBC906B2562E3BFAC056B8561981A4203EC8`.
- Runner verde SHA-256: `27C6E8AF598C28DA4D45760C754199BA942A885E15AF14444D3A4A265065259C`.
- Reporte verde SHA-256: `F180E5DA6167DF0C98A5792131F74333FD5CAB91D47608A2F233261053C776E4`.
- Manifiesto SHA-256: `BDD92D3416A9A27C1EBFE82E3645AD82318BCFB3A1A3CAD66F8321A943771859`.
- Resultado SHA-256: `387987A12B2B375ACABE4B222969B5C76C61194A12935BF35C542EFE517F8672`.
- Sol comprobó 55/55 archivos de outputs y 63/63 referencias totales; no faltan rutas ni hashes.
- Detalle reproducible: [resultado](review-evidence/m2-2c-legacy-timer-replay-auth-luna-20261019-result.md), [manifiesto](review-evidence/m2-2c-legacy-timer-replay-auth-luna-20261019-manifest.json), reportes [rojo baseline](review-evidence/m2-2c-legacy-timer-replay-auth-luna-20261019-reproduction-red-baseline.json) y [verde](review-evidence/m2-2c-legacy-timer-replay-auth-luna-20261019-reproduction-green.json).

PostgreSQL 17.11 reprodujo el retorno no autorizado contra SQL014 exacta del commit baseline `f23c42529a0c55dd0f3596d765a30d5b6c9c54c5` (SHA-256 `BA972D3531F9CC5221FC090CDC7FB1FE5C990366B0F74773333C8582F087125C`). La candidata pasó 23 eventos secuenciales y ocho carreras RC/RC, RC/RR, RR/RC y RR/RR con ambos ganadores, bloqueadores reales y outcomes/reintentos del contrato. La matriz nativa operativa completa pasó **351/351** tanto con baseline como con candidata (`m2cSmoke=true`); Vitest **738/738** en 74 archivos, TypeScript, builds cliente/Worker, sintaxis y `git diff --check` terminaron en exit 0.

El cambio de producto modifica exclusivamente la rama cached de `public.start_task_timer` en SQL014. SQL011–013 conservan sus hashes registrados. Los conflictos de argumentos retienen el SQLSTATE/mensaje legacy y el replay sólo autorizado permanece idempotente; replays revocados o inactivos se deniegan sin alterar recibos, sesiones ni fences.

## Límites

Esta aceptación cubre únicamente reautorización y concurrencia del replay legacy de `start_task_timer`. No acepta los replays legacy de `record_activity_once` ni `assign_task_responsibility`, §9/Gate L general, Auth/HTTP alojado, Data API, Storage/restauración, SQL014 remoto, CI, hosting, correo o producción. No autoriza aplicar SQL014 ni activar el espacio operativo. Sol señaló como P3 no bloqueantes avisos Rollup, conversión LF/CRLF y stderr esperado de fallos sintéticos.
