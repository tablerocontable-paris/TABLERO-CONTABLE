# Aceptación Sol — replays legacy de ausencias

Fecha: 2026-10-21. Estado: **aceptada en alcance local acotado**.

GPT-6.1 Sol aceptó las rutas `public.approve_employee_absence` y
`public.cancel_employee_absence` de SQL014, con la reautorización actual del
recibo antes del replay y conservación de los efectos de primera ejecución.

## Corte aceptado

- Baseline local y `origin/main`: `dbf65fadde1693f29d52a85c9f17f9dc000bbcc9`.
- Contrato: `docs/architecture/M2-2C-LEGACY-ABSENCE-REPLAY-AUTHORIZATION-SOL-CONTRACT-20261020.md`
  (SHA-256 `32036E2F698130EF0D90C77A86280777F217DB26C6A31CDF92E772CFBD882376`).
- SQL014 candidata (SHA-256): `EF9BD767AA9A7FE83CD93B117E643F4B29DDC62345E8DD0687E2E2F598D04B95`.
- Runner A: `tests/review/m2-2c-legacy-absence-replay-red.mjs`
  (SHA-256 `2F67D6E9BD9C2BC18E1DBC3D5A20D414B8B47173C9E34B0A2D45E3AD38AD67DE`).
- Runner nativo: `tests/review/m2-1-native-review.mjs`
  (SHA-256 `DE5246B31DE87F5B6E706E7FA991024F588B9DB5F186A2F6E7B0D539C4A2D22D`).
- Manifiesto repo y copia canónica (SHA-256):
  `docs/architecture/review-evidence/m2-2c-legacy-absence-replay-luna-20261020.json`
  y `../../outputs/m2-2c-legacy-absence-replay-luna-20261020/manifest.json`,
  `97A69B5539E69A5125F3DBD9A857171C6DACB4F7BBE595E39A20DAA99BD1E191`.
  Los 95 artefactos del manifiesto tienen rutas, tamaños y hashes verificados.

## Evidencia y límites

- Rojo: 50 casos, ambos endpoints reproducen el acceso indebido del recibo
  autenticado después de perder autorización.
- Verde: 52 casos secuenciales sin delta de replay sobre 57 tablas, 2 stale-RR,
  8 carreras con blockers reales y cero deadlocks. Incluye snapshots completos
  antes/después de las primeras operaciones y replays, mutaciones inocuas,
  cancelación de una sesión real iniciada por `start_task_timer`, y empresas
  `NULL` para una aprobación sin reemplazante.
- Matriz PostgreSQL 17.11: 376/376 sobre baseline y 376/376 sobre el hash exacto
  de SQL014 candidato.
- Suite: 738/738 en 74 archivos; TypeScript, builds cliente/Worker, checks de
  sintaxis y `git diff --check` aprobados.
- SQL001–013 permanecen intactas. La corrección del fixture temporal en
  `tests/m2-2c-contract.test.ts` evita que la suite falle al cambiar el día.
- Fallos de intentos previos y su atribución quedan preservados en outputs.
- Sin llamadas remotas, commit ni push en esta aceptación; SQL014 no se aplicó
  a Supabase.

La revisión acepta RC `P0001` y RR `40001` cuando la revocación gana, ya que
ambos niegan el recibo sin delta y el retry fresco deniega `P0001`.

Esta aceptación sólo cubre A. P, el residual §9/Gate L, la migración Supabase
alojada, Auth/API/Storage, frontend, hosting, correo y aceptación de producción
continúan pendientes. Mantener Site privado, datos ficticios y espacio
operativo apagado.
