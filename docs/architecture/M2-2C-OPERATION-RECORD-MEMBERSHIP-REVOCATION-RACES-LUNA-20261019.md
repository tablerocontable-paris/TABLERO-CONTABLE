# Contrato Luna — registro operativo frente a revocación de membresía

Fecha: 19/10/2026. Alcance local con identidades/datos sintéticos. No modificar
SQL ni llamar APIs remotas.

## Objetivo y brecha

Completar la matriz entre `api.command_v1(operation.record)` ejecutado por un
empleado y `api.command_v1(companyMembership.setActive(false))` ejecutado por
jefatura sobre la membresía de ese empleado en la empresa de la tarea.
§9 exige revocación frente a comandos de ejecución con ambos órdenes bajo RC/RC
y RR/RR. El runner sólo cubre registro-primero RC/RR y revocación-primero con
snapshot RR sin espera concurrente observada.

## Fixture y carrera

- Cuatro fixtures independientes; empleado responsable AAL1 y jefe AAL2
  diferentes, activos y autorizados. Membresía de empresa activa en revisión 0.
- Una tarea operativa abierta individual, una asignación, una empresa/equipo y
  período; estado `Pendiente` o `En curso`, `task.state_revision=0` y
  `expectedRevisions` iniciales en cero. Operativa `measurement_version=2`,
  unidad válida, `target=NULL`, `weight=NULL`, sin coeficiente configurado. Sin
  cobertura, cronómetros, dependencias ni otras tareas en el ámbito.
  `operation.record` usa cantidad 1, fecha laboral válida, referencia sintética
  y el mismo actor empleado. La entrada exitosa conserva versión 2, unidad y
  coeficiente/carga nulos.
- Ambos comandos corren en transacciones/conexiones separadas con aislamiento
  efectivo igual: RC/RC o RR/RR. El ganador queda sin confirmar hasta iniciar el
  perdedor y verificar `pg_blocking_pids`; no sustituir la prueba por sleeps.
- Reutilizar los mismos argumentos y `operationId` al reintentar. Cambiar sólo
  conexión/transacción y conservar claims del actor original.

## Outcomes exactos

| Orden | Aislamiento | Primer perdedor | Reintento en sesión nueva |
|---|---|---|---|
| Registro primero | RC/RC | Revocación `40001` | Jefatura reintenta revocación `00000`. |
| Revocación primero | RC/RC | Registro `40001` | Empleado reintenta registro y recibe `42501`. |
| Registro primero | RR/RR | Revocación `40001` | Jefatura reintenta revocación `00000`. |
| Revocación primero | RR/RR | Registro `40001` | Empleado reintenta registro y recibe `42501`. |

Si cualquier SQLSTATE difiere, detener la matriz en ese escenario, guardar
respuestas, snapshots, PIDs y logs, y consultar a Sol antes de cambiar contrato
o SQL. No aceptar genéricamente `00000`, `40001` y `42501` como outcomes
intercambiables.

## Invariantes

- **Registro primero, antes de revocar:** membresía aún activa/revisión 0; una
  entrada de actividad atribuida al empleado; respuesta `entryId` coincide con
  la fila `activity_entries`; tarea revisión 1; un receipt de registro.
- El primer intento de revocación espera y devuelve `40001` sin efectos
  parciales. El retry autorizado de jefatura desactiva membresía en revisión 1,
  incrementa revisión de tarea a 2, preserva la entrada, crea exactamente una
  receipt de revocación y un evento de membresía/revocación.
- **Revocación primero:** winner-only y final tienen membresía inactiva/revisión
  1, tarea revisión 1, cero entradas de actividad y cero receipts de registro.
  El intento stale del empleado devuelve `40001`; retry fresco recibe `42501`
  por membresía revocada y no deja escritura ni receipt.
- Comparar las respuestas completas de ejecuciones exitosas de ambos comandos
  con sus receipts, incluyendo el `entryId`; el ID debe corresponder a la única
  fila real de `activity_entries`. Los intentos `40001` y `42501` no deben dejar
  receipts.
- Contar `activity.created` por `details->>'instance'` además del `entity_id` del
  movimiento: el evento puede usar la identidad del movimiento y no la tarea.
  Verificar evento de `companyMembership.setActive`, fences de membresía/
  operación y ausencia de duplicados.
- **Fences confirmados en revisión Sol (19/10/2026):** comparar las cinco claves
  contra el snapshot inicial. Registro-primero, incluido retry de revocación:
  `membership +2` (un incremento por cada comando), `month +1`, `graph +0`,
  `recordOperation +1`, `revokeOperation +1`. Revocación-primero, incluido el
  retry `42501` sin escritura: `membership +1`, `month +0`, `graph +0`,
  `recordOperation +0`, `revokeOperation +1`. El `40001` perdedor no altera el
  snapshot del ganador. No inferir un solo incremento de membresía por carrera.
- Registrar estado previo, winner-only, primer intento y retry, claims/AAL,
  PIDs/blockers, SQLSTATE/respuestas, tarea/asignación, membresía, actividad,
  receipts y auditoría pertinente.

## Validación y límites

- Extender `tests/review/m2-1-native-review.mjs`; producir reporte/manifiesto con
  hashes del runner y SQL011/014. La evidencia cruda puede quedar en `../../outputs`
  fuera del Git root; el manifiesto dentro del repo debe declarar rutas, hashes y
  resultados resumidos.
- Ejecutar PostgreSQL nativo, `node --check`, suite completa, TypeScript, builds
  cliente/Worker y `git diff --check`.
- Sólo runner, evidencia y documentos. No modificar SQL011/014, Supabase
  alojado, configuración ni endpoints. Sol revisará los hashes exactos antes del
  commit/push; esta familia no cierra §9/Gate L.
