# M2.2C assignment.create / revocación de membresía — aceptación Sol

Fecha: 2026-10-19
Revisor: GPT-6.1 Sol, esfuerzo alto
Implementación: GPT-6 Luna, esfuerzo medio
Estado: **aceptado localmente, alcance acotado a la matriz**

## Alcance

Se acepta la matriz sintética local para `assignment.create` concurrente con
`companyMembership.setActive(false)`: ambos órdenes en `read committed` y
`repeatable read`. No se modificaron SQL011/014 ni se hicieron llamadas a
servicios remotos. Esta aceptación no cierra §9/Gate L, no acredita Auth/HTTP
alojado y no autoriza aplicar SQL014.

## Evidencia revisada

- Manifiesto: `docs/architecture/review-evidence/m2-2c-assignment-create-membership-revocation-races-luna-20261019.json`
- Manifiesto SHA-256: `0a52685ea402381ccfb40719e75c11b4c7ef1658836ec5dab11e33ecb030bd5b`
- Runner `tests/review/m2-1-native-review.mjs` SHA-256: `405c214816e1e257d359ea23b625e905eada5d0c1e8077d6c329395532050f3b`
- Reporte nativo, intento 9 SHA-256: `5c20d256d103a1fb99694a243322e4332360448f953ec93af1d568e1ba207957`
- Sol confirmó que coinciden los **16/16 hashes** del manifiesto.

## Resultados

- PostgreSQL 17.11: **329/329**; cuatro bloqueos reales y cero deadlocks.
- `assignment-first`: `00000 / 40001 / 00000` (ganador / perdedor / reintento).
- `revoke-first`: `00000 / 40001 / 42501`.
- Cuatro combinaciones RC/RR con fences exactos, rollback sin residuos,
  asignación conservada, recibos y claims/rol/AAL2 comprobados.
- Vitest: **738/738 en 74 archivos**. El fallo UI del intento 6 no se reprodujo
  en el caso enfocado sobre baseline limpio y pasó en las suites posteriores.
- TypeScript, build de cliente, build de Worker, `node --check` y
  `git diff --check`: exit `0` documentado en el manifiesto y logs.

No quedan hallazgos bloqueantes en esta matriz. Los límites de aceptación son
los indicados arriba; la revisión es local y no equivale a una validación
alojada.
