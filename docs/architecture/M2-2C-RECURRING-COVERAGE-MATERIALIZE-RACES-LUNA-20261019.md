# Contrato Luna — aprobación de cobertura recurrente frente a materialización

Fecha: 19/10/2026. Alcance estrictamente local y sintético.

## Objetivo

Agregar al runner nativo cuatro carreras entre `public.approve_task_coverage_plan`
y `api.command_v1(month.materialize)` para el mismo titular y período, con ambos
órdenes ganadores bajo `READ COMMITTED/READ COMMITTED` y
`REPEATABLE READ/REPEATABLE READ`. Esta es la próxima familia acotada de §9 del
contrato ejecutable M2.2B/C.

## Preparación de cada caso

- Usar IDs y filas sintéticas independientes por escenario; no reutilizar casos
  anteriores ni alterar el fixture base.
- Crear dos jefes activos, distintos y autorizados para organización/empresa;
  usar uno para aprobar y el otro para materializar/reintentar según el orden.
- Crear un empleado titular activo y una asignación recurrente mensual elegible
  para un mes abierto, además de un plan sellado con regla que capture el
  snapshot exacto de esa asignación y cubra la fecha de ocurrencia.
- Antes de competir, comprobar que todavía no exista una instancia de esa
  asignación en el período, que no haya cierre mensual y que no exista una
  raíz/vínculo activo para el reemplazo.
- Ejecutar cada transacción en sesiones PostgreSQL independientes. Mantener la
  operación ganadora sin confirmar; iniciar al perdedor; demostrar el bloqueo
  con `pg_blocking_pids`; confirmar el ganador y registrar el resultado real del
  perdedor. No simular la carrera con sleeps como evidencia de bloqueo.

## Resultados funcionales requeridos

En las cuatro combinaciones, tras el reintento autorizado en una sesión nueva,
deben existir exactamente una ocurrencia, una raíz activa de cobertura para la
regla recurrente y un vínculo hijo activo para la ocurrencia. El hijo debe tener
`source_rule_id` apuntando a esa raíz. No se admiten ocurrencias, raíces ni hijos
duplicados; las respuestas y recibos deben corresponder a sus respectivos
operation IDs.

- **Aprobación primero:** aprobar crea la regla raíz; la materialización
  posterior crea la ocurrencia y un único hijo enlazado.
- **Materialización primero:** materializar crea una ocurrencia; la aprobación
  posterior crea una raíz y enlaza esa ocurrencia con un único hijo.

No fijar por anticipado el SQLSTATE del perdedor. Registrar el estado y mensaje
observados, y exigir que el flujo documente una respuesta coherente con la
revalidación concurrente. Reintentar con una operación/sesión nueva según el
contrato, refrescando las revisiones necesarias. Si el primer intento del
perdedor se confirma sin conflicto cuando el contrato requiere revalidación,
produce un duplicado, o el retry no converge al resultado de arriba, detenerse
y devolver el hallazgo a Sol; no modificar SQL014 por iniciativa propia.

## Evidencia y validación

En snapshots antes de competir, luego del conflicto y al final incluir al menos:

- asignación, ocurrencia(s), plan sellado y snapshot de regla;
- binding raíz e hijo, estado, intervalo, autor y `source_rule_id`;
- revisiones/fences de creación y mes pertinentes;
- recibos de aprobación/materialización y eventos de auditoría asociados;
- aislamiento observado, PIDs, bloqueo observado, SQLSTATE/mensaje y resultado
  de reintento.

Extender `tests/review/m2-1-native-review.mjs` bajo el runner existente de
`--m2-2c-smoke`; producir un manifiesto versionado con hashes del runner, SQL011,
SQL014, salida del runner y reporte. Validar cuatro escenarios y registrar
PostgreSQL/aislamientos efectivos y conteos. Después ejecutar la suite completa,
TypeScript, build cliente/Worker, `node --check` del runner y `git diff --check`.

## Límites

Sólo se permite modificar el runner, la evidencia y documentación de este
bloque. SQL011/014, endpoints remotos, Supabase alojado, esquema desplegado,
GitHub Actions y el Site quedan intactos. Este bloque no cierra §9, Gate L ni
autoriza preflight o aplicación remota. La aceptación independiente de Sol debe
referirse a los hashes exactos de Luna.
