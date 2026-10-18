# Aceptación local Sol — M2.2C — 17/10/2026

## Decisión y alcance

Sol aceptó únicamente los escenarios locales R90 enumerados en
[`M2-2C-MEMBERSHIP-WRITERS-MAP-20261016.md`](M2-2C-MEMBERSHIP-WRITERS-MAP-20261016.md).
La revisión cubre los escenarios allí listados de revocación de membresía,
privacidad de notas legacy SQL009, transiciones/coberturas, conflictos,
rollback y reintento. **No cierra M2.2C ni Gate L completos.** Siguen pendientes
las familias enumeradas abajo y en el contrato §9. Tampoco es una prueba de
Supabase Auth/HTTP alojado.

## Identidad reproducible

| Artefacto | SHA-256 |
|---|---|
| `supabase/migrations/202610150014_operational_api.sql` (working tree bytes used for R90) | `3ff379002c37c43fb8c91d2b41bd47658d73d0386b2c5bc1518f22c6b4cc86c6` |
| `supabase/migrations/202610150014_operational_api.sql` (Git blob bytes, LF) | `7c96727b7f1ecd8c5bb2b457640b824deddc06346da3f1a70e9bdb879e730a56` |
| `tests/review/m2-1-native-review.mjs` | `7c48420ee61498418642ddbd2b734dc5b7d094eabed923417a2bfebf03059588` |
| `docs/architecture/review-evidence/m2-2c-membership-r90-20261017.json` | `dc8fb2ea9d102af95b564d7deaDef79cf0e7071c07d463494cdd5324a0b78a10` |

Native report: PostgreSQL 17.11, **128/128 passed**, **0 failed**, `40P01=0`.
The report records the migration hash and the tests use synthetic JWT claims.

## Validación del árbol local

- Vitest completo: **727/727 pruebas en 74 archivos**.
- TypeScript (`tsc --noEmit`): aprobado.
- Vite client build: aprobado.
- Worker build: aprobado.
- Runner syntax check y `git diff --check`: aprobados.

## Límites y siguiente gate

- SQL014 aún no se aplicó al proyecto Supabase remoto.
- La exposición de Data API debe verificarse y el preflight debe confirmar que
  `grupo-paris-dev` sigue vacío antes de aplicar SQL.
- La matriz no sustituye pruebas con Supabase Auth/HTTP alojado. La rama
  específica de reglas recurrentes no se ejercitó por separado.
- Falta completar replay/revocación para onboarding/creation y writers legacy,
  además de las familias de concurrencia e inyección de fallos de §9.
- El commit `93278d1` es un checkpoint local; estos documentos se corrigen
  antes de solicitar revisión del nuevo hash y push directo a `main`. No abrir PR.
- Producción, datos reales, hosting y correo siguen fuera de este alcance.
