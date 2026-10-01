# Ejecución parcial del contrato 008 — 01/10/2026

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
