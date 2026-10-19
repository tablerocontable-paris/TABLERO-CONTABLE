# Contrato Luna — task.transition frente a revocación de membresía — 19/10/2026

## Objetivo y alcance

Completar localmente una familia de concurrencia pendiente de §9: transición
de una tarea por su responsable frente a `companyMembership.setActive(false)`
por jefatura. Cubrir ambos órdenes ganadores (`task.transition` primero y
revocación primero) bajo RC/RC y RR/RR. Son cuatro carreras. No cerrar Gate L ni
la matriz total de §9.

Las pruebas vigentes ya incluyen un caso de transición primero bajo RC/RR con
bloqueo/reintento, y un caso de revocación primero bajo RR/RR que no demuestra
una carrera simultánea bloqueada. No duplicar esas pruebas; sumar las cuatro
combinaciones estrictamente solicitadas en este contrato con los dos niveles
iguales.

## Referencias y límites

- Contrato ejecutable: `M2-2BC-EXECUTABLE-CONTRACT-20261016.md`, §9, líneas
  458–464.
- Runner: `tests/review/m2-1-native-review.mjs`, sección M2.2C; revisar en
  particular los casos próximos a líneas 2587–2615 y 2777–2787 antes de editar.
- Matriz recurrente recién aceptada: `review-evidence/m2-2c-recurrent-same-isolation-luna-20261019.json`.
- Ejecutar únicamente contra PostgreSQL local descartable con perfiles, tareas
  y membresías sintéticos. Sin llamadas a Supabase ni cambios de migraciones.
- No modificar `supabase/migrations/202610150014_operational_api.sql`, SQL001–013,
  firmas legacy, Worker/D1, DTO, frontend ni Site.

## Trabajo

1. Auditar las dos pruebas de transición existentes y el harness; conservar sus
   regresiones y añadir sólo los casos faltantes, con IDs/operaciones nuevos.
2. Cubrir los cuatro casos:
   - transición gana: RC/RC;
   - revocación gana: RC/RC;
   - transición gana: RR/RR;
   - revocación gana: RR/RR.
3. Las sesiones deben usar actores distintos y autorizados: el empleado
   responsable ejecuta la transición y un jefe activo revoca la membresía.
   Registrar el actor efectivo de cada recibo, evento y auditoría.
4. Forzar orden de locks con barreras deterministas del harness y comprobar
   bloqueo efectivo con `pg_blocking_pids`. Registrar el nivel efectivo de cada
   sesión. Si el harness no permite demostrar que ambas órdenes son carreras
   reales sin tocar producto, detenerse y documentar el impedimento para Sol.
5. Expectativas por ganador:
   - Si gana la transición, la revocación obsoleta aborta con `40001`; reintentada
     en transacción nueva se completa con `00000`. El estado final conserva una
     transición y una revocación, cada una con un recibo/evento/auditoría propio.
   - Si gana la revocación, la transición obsoleta aborta con `40001`; reintentada
     en transacción nueva se deniega por autorización con `42501`, sin cambio de
     tarea ni recibo de transición.
   Si PostgreSQL contradice estas expectativas, no editar SQL014: revisar
   primero barreras/fixtures; si la diferencia es real, detenerse y devolverla
   a Sol para decidir el contrato.
6. Comparar snapshots antes de competir, tras el conflicto y tras el retry:
   membresía/revisión, estado/revisión de tarea, assignment, sesiones activas,
   graph/month/membership/operation fences, recibos, tracking events,
   membership events y auditoría. Verificar ausencia de efectos parciales o
   duplicados; `40P01=0`.
7. Registrar reporte y manifiesto con SHA exacto del runner, prueba focal, SQL014
   sin cambios, versión de PostgreSQL, aislamiento observado y resultados.
   Vincular el reporte con el commit fuente; no atribuir aceptación a hashes de
   otro candidato.

## Criterios de aceptación

- Cuatro carreras nuevas pasan; ambas órdenes muestran bloqueo real y retry en
  una sesión nueva.
- Fixtures demuestran identidad y permiso de cada actor; ninguna acción adopta
  la identidad del otro actor.
- Snapshots prueban estado final e invariantes; cero deadlocks `40P01`.
- Prueba focal, suite, TypeScript, build cliente/Worker, sintaxis del runner y
  `git diff --check` pasan. Ejecutar el hook pre-commit completo.
- GPT-6.1 Sol revisa manifiesto y hashes exactos antes del commit/publicación.
- No aplicar SQL014 ni realizar cambios remotos. Gate L permanece abierto.

**Modelo:** GPT-6 Luna, esfuerzo medio, Standard. Ante defecto real, permiso
ambiguo o barrera no demostrable, detener la implementación y volver a Sol.
