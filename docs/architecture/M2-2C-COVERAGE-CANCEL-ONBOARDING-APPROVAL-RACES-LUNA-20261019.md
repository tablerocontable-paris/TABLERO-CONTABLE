# Contrato Luna — cancelación de cobertura frente a aprobación de onboarding

Fecha: 19/10/2026. Alcance local, PostgreSQL sintético; no aplicar migraciones
ni llamar APIs remotas.

## Objetivo

Completar la matriz `public.cancel_task_coverage_binding` vs
`api.command_v1(onboarding.approve)`. Ya existen dos carreras mixtas: cancelación
primero RR/RC y aprobación primero RC/RR. Agregar ambos órdenes bajo RC/RC y
RR/RR. §9 del contrato M2.2B/C exige los dos ganadores para cambios de cobertura
que alteran el footprint de aprobación.

La cancelación cambia un binding activo de una tarea ya existente. La aprobación
materializa una asignación/ocurrencia nueva para la misma persona, empresa,
equipo y período; no debe presumirse que siempre modifica el binding existente.

## Fixtures y actores

- Cuatro fixtures independientes con persona titular, una tarea puntual abierta,
  un plan de cobertura sellado con binding activo para esa tarea y una solicitud
  de onboarding enviada con una sola línea nueva del mismo titular/empresa/
  equipo/período.
- La cobertura es puntual por instancia: `source_rule_id IS NULL`; tarea y
  ocurrencia ya existen antes de la carrera. No dejar sesiones de tiempo abiertas
  ni reglas recurrentes en el fixture.
- La cancelación y aprobación usan jefes AAL2 distintos, activos y autorizados
  para la organización. No usar una identidad común para serializar ambas
  escrituras.
- Operaciones en conexiones PostgreSQL separadas con el mismo aislamiento
  efectivo por caso: RC/RC o RR/RR. Mantener abierto el ganador, iniciar el
  perdedor y comprobar bloqueo real con `pg_blocking_pids` antes del commit.

## Resultados esperados por caso

No usar una aserción genérica que acepte indistintamente `00000` o `40001`.

| Orden e aislamiento | Primer resultado del perdedor | Paso posterior |
|---|---|---|
| Cancelación primero, RC/RC | Aprobación `40001` por binding/snapshot obsoleto | Retry en sesión nueva, mismos argumentos/operation ID, `00000`. |
| Aprobación primero, RC/RC | Cancelación `00000` si el binding/task inicial no cambió | Confirmar la cancelación y luego replay exacto en sesión nueva; respuesta void y recibo `{}` idénticos, snapshot inmutable. |
| Cancelación primero, RR/RR | Aprobación `40001` | Retry en sesión nueva, mismos argumentos/operation ID, `00000`. |
| Aprobación primero, RR/RR | Cancelación `40001` | Retry en sesión nueva, mismos argumentos/operation ID, `00000`. |

Para aprobación-primero RC/RC, demostrar antes de confirmar la cancelación que
la aprobación no modificó la tarea, el binding, su plan ni el estado de sesiones
existentes. Si el SQLSTATE real contradice el resultado esperado, detener el
bloque, conservar evidencia exacta y devolverlo a Sol; no editar SQL ni
generalizar outcomes.

Los retries/replays usan el mismo actor AAL2, `operationId` y argumentos; sólo
cambian la conexión y transacción. Identificar recibos mediante
`(actor_id, operation_id)`. El replay RC debe probar idempotencia con permisos
conservados; no audita la reautorización del replay legacy de cancelación.

## Invariantes

- Cancelación-primero: el snapshot intermedio conserva onboarding `submitted`,
  sin activación/recibo de aprobación, y muestra cancelado el binding (más el
  cierre de cronómetros de cobertura si hubiera alguno). El retry de aprobación
  crea una única activación, asignación y ocurrencia ligadas a la línea.
- Aprobación-primero: snapshot winner-only muestra request `approved`, una
  activación/recibo y una asignación/ocurrencia nuevas. El binding original
  permanece activo hasta que cancele el perdedor o su retry. No se duplica la
  tarea onboarding.
- Estado final: request aprobado; una activación por línea, una asignación y
  ocurrencia; binding original cancelado una vez; un recibo por operación y un
  evento de auditoría por acción; cero duplicados.
- `cancel_task_coverage_binding` devuelve `void`: comprobar resultado SQLSTATE,
  receipt `operation_kind='cancel_task_coverage'`, argumentos `{binding, reason}`,
  `result={}`, identidad de actor/operación y filas exactas de auditoría. El replay
  debe ser inerte y no crear recibos/eventos adicionales.
- Comparar la respuesta completa de aprobación con `api_command_receipts.result`,
  incluidos los IDs exactos de asignación y ocurrencia.
- Conservar snapshots before, winner-only, tras primer intento, tras retry o
  replay; aislamientos y claims efectivos, actores/AAL, PIDs, blocker, respuestas,
  receipts, task/binding/plan, task assignments/instances, activaciones, fences
  y auditoría pertinente.

## Validación y límites

- Extender `tests/review/m2-1-native-review.mjs` y su reporte/manifiesto hash.
- Ejecutar PostgreSQL nativo, `node --check`, suite completa, TypeScript, builds
  de cliente y Worker y `git diff --check`.
- Sólo runner, evidencia y documentos. No cambiar SQL011/014, datos de producto,
  endpoints remotos ni configuración Supabase.
- Sol revisará los hashes exactos de estos cuatro casos. La aceptación no cierra
  §9/M2.2C/Gate L ni autoriza migrar SQL a Supabase.
