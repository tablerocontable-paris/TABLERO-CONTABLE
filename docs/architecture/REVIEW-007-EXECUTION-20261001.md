# Ejecución local de 007 — 01/10/2026

## Resultado

Implementada la migración nueva `202610010007_time_coverage_completion.sql`,
tests aislados para los casos cubiertos, fixture SQL para el futuro laboratorio
PostgreSQL y guía operativa. No se alteraron migraciones 001–006 ni fixtures de
revisión congelados 005/006. Sí se reparó aislamiento de un test 006 y se amplió
el test de upgrade en `tests/database.test.ts`.

## Comprobaciones ejecutadas

- `npm test`: **74 pruebas en 8 archivos, todas pasan**.
- `npm run build`: pasa; Vite construyó 2.277 módulos. Rollup reporta comentarios
  de anotación de Zod que elimina, sin fallo de build.
- `git diff --check`: pasa.
- Prueba 007 ejecutada en filtros separados: `desbloquear` (3), `pausar` (2),
  `destino vencido|cobertura vencida` (4), `cancelación repetida` (1),
  `completar destino|completar último control` (2). También se ejecutó
  `tests/time-coverage-006.test.ts -t 'limpia el reloj propio'` (1 pasa).
- Carga del fixture PostgreSQL en PGlite: pasa con una empresa autorizada. Esto
  valida sintaxis/carga del fixture en PGlite, no bloqueos ni concurrencia PG.
- Upgrade poblado 0.3 → migraciones 001–007: pasa; verifica sesión cerrada,
  UUID/tiempos, snapshot textual, actor legacy NULL e IDs de reporte/outbox.

## Cobertura y pendientes

| Estado | Evidencia |
| --- | --- |
| Probado localmente | Flujos 007 descritos arriba y suite Vitest completa sobre PGlite. |
| Inspeccionado | Conservación de 001–006 contra HEAD; estructura de nueva migración y fixture de laboratorio. |
| Pendiente | Upgrades poblados independientes 004→005–007, 005→006–007 y 006→007. Sólo se automatizó 0.3→001–007; no marcar completos los escenarios por etapa del contrato. |
| Pendiente | Ejecución real en PostgreSQL con dos conexiones, bloqueos, carreras e interbloqueos. La guía `docs/ops/TIME-COVERAGE-VALIDATION.md` sigue marcada **NO EJECUTADO**. |
| Pendiente | Supabase real: Auth, invitaciones, MFA, RLS, privilegios y entrega de correo. La outbox local no es evidencia de un reporte enviado al gerente. |
| Pendiente | Revisión de arquitectura/corrección por GPT Sol 6.1, esfuerzo alto. |

La suite local no equivale a aceptación completa del contrato ni aprobación de
producción. No aplicar esta migración a un proyecto remoto y no migrar empleados
hasta cerrar revisión Sol, upgrades por etapa y verificaciones de PostgreSQL /
Supabase correspondientes.

## Entrega

El commit y la versión privada Sites deben registrar el mismo SHA. El hosting
privado sólo demuestra el artefacto publicado; no implica Supabase conectado ni
flujo de autenticación listo.
