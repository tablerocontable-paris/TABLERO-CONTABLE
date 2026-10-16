# Ejecución completa local del contrato 008 — 01/10/2026

## Entrega vigente

Completado `TIME-COVERAGE-008-COMPLETION.md` sobre la base revisada
`640c376efd4aec6e7564227aa2d74fac4093a102`. **Pendiente revisión Sol 6.1 alto**;
esto no aprueba PostgreSQL real, integración ni migración de empleados. El SHA
publicado queda en Git/main y en la versión privada nativa de Sites.

### Cambios y matriz de aceptación

| Grupo | Estado y evidencia |
| --- | --- |
| Coherencia del plan R008-01 | Checklist recalcula changes_check/updated/next_status/actual_needs_start desde fila bloqueada y compara con needs_start antes de no-op/expiración/escritura. Transición hace comparación equivalente; error exacto y rollback. Sin firmas/ACL/backfill nuevos. |
| Cronómetros/cobertura | 39 pruebas aisladas por BEGIN/ROLLBACK; savepoints para errores. No-op con TRUE/FALSE, cortes distintos de origen/destino, destino sin reloj, revisión, cinco identidades, permisos, sello, replay, pausa y regresiones. Capturas completas antes/después. |
| Reportes | Seis casos con base propia y rollback por caso, extraídos de database.test sin UPDATE de cola global. Claim comprueba delivery propio. Sesión fija 1800 segundos y cantidades 7+11=18/meta40; métricas operativas cuentan tareas (1/0). Cierre único, snapshots, privacidad simulada, lease/retry/ACK y fallos atómicos. |
| Upgrades | Cinco bases: 0.3→001–008 y 004/005/006/007→008. Compara todo campo original de cada tabla, snapshots::text, IDs/times/empresas/sesiones/audits/receipts y estado de entregas/outbox. Admite nuevas columnas del contrato, incluida autorización sellada, y backfill legacy definido por 004. No altera historia cerrada. |
| Abortos | Diez bases descartables: múltiples clocks en 004; auditoría huérfana/actor de otra organización en 005 y 006; sesión con titular/ejecutor incompatible, inicio previo o posterior al rango y fin posterior al corte en 006. Error con ID, filas, columnas, constraints, índices, funciones/ACL, triggers y políticas íntegros tras rollback. |
| Anotaciones/recorrido | 18 pruebas integradas, cinco nuevas: inicio tras inducción con home=tasks y coach/vista/progreso coherentes; Listo/reinicio; fallo al abrir/cerrar; edición fallida conserva campos/ID y reintento actualiza una sola nota. Sin cambios de frontend/producto en esta ejecución. |
| Guía PostgreSQL | SQL/runner nuevos para 24 combinaciones A/B, conexión explícita coherente, espera observada y asserts. 22 checks secuenciales PGlite pasan; corte ART no simulado. Toda concurrencia PostgreSQL: **NO EJECUTADO**. |
| Entrega | 151/13, 32 casos críticos con exactamente una prueba por proceso, TypeScript/Vite y diff-check pasan; archivos congelados comparados con base revisada. Commit/push y Sites privado usan el mismo SHA. |

### Comandos y evidencia

- `npm test`: **151 pruebas en 13 archivos**, todas pasan.
- `node tests/verify-008-completion.mjs`: **32 procesos**, cada uno confirma una
  prueba seleccionada y pasada, cero fallos; un patrón sin selección falla.
  Los seis casos de reportes se ejecutaron individualmente.
- `node tests/postgres-008/check-sql.mjs`: **22 escenarios secuenciales** PGlite;
  verifica SQL emitido, no bloqueos entre conexiones.
- `npm run build`: TypeScript y Vite pasan. `git diff --check`: pasa.
- Evidencia nueva: `review-evidence/time-coverage-008-completion-isolation-20261001.jsonl`
  y `review-evidence/time-coverage-008-completion-validation-20261001.json`.
  Base SHA y hash de entradas probadas permiten distinguirla de la revisión v24.
  No se sobrescribieron los probes ni la evidencia histórica.

### Límites concretos

Las pruebas JWT/aal son simuladas. Las inyecciones de funciones para cambiar
identidad/plan/permiso están sólo dentro de fixtures y se revierten; no prueban
carreras reales ni cambian funciones del producto. Para simular membresía propia
retirada con una asignación activa se elimina temporalmente la FK
`assignment_company_member` en esos casos aislados, porque el esquema vigente
impide esa eliminación ordinaria. No hay una RPC productiva de retiro implementada.
El fixture de aborto de fin corrupto desactiva/restaura su trigger de clamp antes
del intento de upgrade; no se debilitan las migraciones congeladas.

005 no contiene el preflight completo de sesiones: los abortos de auditorías se
prueban en 005/006 y los de sesiones en 006. No se atribuye retroactivamente a 005
la defensa añadida por 006. En 0.3 se comparan todos los campos originales; la
adición contractual de versiones/ocurrencias y el backfill de reapertura NULL
se verifican aparte. No se infiere recuperación automática del legacy real.

Frontend sigue localStorage; el SQL preparado no gobierna la demo. No hay correo
real por observar la cola local. QA visual móvil/contraste, integración, dos
conexiones PostgreSQL, Supabase Auth/invitaciones/MFA/RLS, recuperación y piloto
siguen pendientes. No crear servicios ni migrar los 20 empleados todavía.

**Próximo modelo: GPT-6.1 Sol, alto, Standard**, cambio manual, contrato de
revisión en `../EXECUTION-NEXT.md`. Continuar autónomamente dentro de esa revisión.

---

## Historia de ejecución parcial y revisión v24

Lo que sigue documenta la iteración anterior y sus pendientes en ese momento.
La matriz de entrega vigente de arriba reemplaza esos pendientes locales;
se conserva el registro para distinguir evidencia antigua y actual.

## Revisión posterior de versión 24

La revisión en `REVIEW-008-20261001.md` confirma las cuatro correcciones R007 y
las cinco de anotaciones/recorrido, pero no aprueba 008: detecta coherencia del
plan pendiente y aceptación/aislamiento incompletos. La ejecución siguiente
debe seguir `TIME-COVERAGE-008-COMPLETION.md`. El bloque inferior conserva la
evidencia de ejecución anterior; que los casos de reportes pasen solos no implica
que no modifiquen fixtures ajenas en la suite compartida.

Estado: **avance local parcial; no aprobado para migrar empleados ni activar
producción**. Esta nota distingue los casos probados de la matriz completa del
contrato `TIME-COVERAGE-008-ACCEPTANCE.md`.

## Cambios de esta iteración

- Anotaciones: conservar borrador ante guardado fallido, exigir fecha en
  recordatorios, mostrar fechas vencidas en el tablero y vincular una sola tarjeta
  puntual al período elegido. Rechazar períodos cerrados, recurrencias y vínculos
  faltantes sin crear filas huérfanas.
- Recorrido: acotar progreso corrupto, evitar avanzar la vista si no se guardó el
  paso y dejar la inducción inicial en el día del empleado.
- Migración nueva 008: exigir `authorization_sealed` en cobertura temporal;
  dejar privado `_can_access_instance_at`; mantener ACL pública de
  `can_cover_instance`; comparar identidad de destino después de los bloqueos en
  start, checklist, transition, wait y pause; hacer que un checklist sin cambios
  no planifique ni detenga otro cronómetro; mantener separados los fines y
  auditorías de sesiones vencidas de origen y destino; conservar el contexto de
  la sesión vencida al registrar una espera.
- Aislamiento: tres pruebas de reportes ahora preparan sus propios snapshots,
  entregas y eventos de outbox; el cierre de duración usa comparación exacta de
  1800 segundos y cantidades operativas conocidas.

## Evidencia ejecutada

Evidencia de la iteración publicada como Sites versión 23, commit
`65e01b0c103edc69e80035bb7b3372267e18be22`:

- `npm test`: **96 pruebas en 11 archivos**, todas pasan.
- `tests/time-coverage-008.test.ts`: seis pruebas locales de sello, ACL,
  checklist repetido con período previo cerrado, contexto de espera vencida,
  expiración simultánea de origen/destino y reporte con 1800 segundos exactos.
- Las cuatro pruebas focalizadas de reportes corren solas con fixtures propios.
- Las cuatro pruebas focalizadas de reportes pasan ejecutadas cada una por
  separado.
- `npm run build` y `git diff --check` pasan.
- Migraciones `202609300001` y `202610010001`–`007`, pruebas bajo `tests/review`
  y evidencia congelada permanecen idénticas a la base.
- Sites confirma despliegue `succeeded` y mantiene la audiencia personalizada de
  sólo la propietaria.

## Pendiente antes de aprobar 008

- Completar la matriz de cancelación, cambios de identidad y rollback con
  `SAVEPOINT`, receipts y auditorías; agregar la expiración dual equivalente para
  checklist y ausencia de reloj de destino.
- Añadir asserts completos de upgrade desde cada base 004/005/006/007 y abortos
  de preflight, comparando sesiones, ausencias, cierres, reportes, deliveries y
  outbox antes/después.
- Completar escenarios A/B de concurrencia y probarlos en PostgreSQL real. El
  procedimiento sigue **NO EJECUTADO**; PGlite no demuestra bloqueo ni carreras.
- Revisar la migración 008 como contrato completo en GPT Sol 6.1 alto antes de
  llamarla aprobada.

Los datos personales siguen en la demo local del navegador. Autenticación real,
RLS productiva, invitaciones, MFA, entrega de correo y recuperación siguen siendo
requisitos antes de migrar empleados.
