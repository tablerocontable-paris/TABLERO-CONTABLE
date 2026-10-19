# Aceptación Sol — registro operativo frente a revocación

Fecha: 19/10/2026. Aceptación de alcance local sintético; no acredita la
integración alojada, no cierra §9/Gate L y no autoriza aplicar SQL remoto.

## Alcance aceptado

Se aceptan únicamente cuatro carreras entre `api.command_v1(operation.record)`
ejecutado por el empleado y `api.command_v1(companyMembership.setActive(false))`
ejecutado por jefatura sobre su membresía en la empresa de la tarea: ambos
órdenes bajo RC/RC y RR/RR.

Los cuatro escenarios observaron blockers reales con PIDs distintos. Resultados
exactos: ganador `00000`, perdedor stale `40001`; si registra primero, el retry
de revocación termina `00000`; si revoca primero, el retry fresco del registro
termina `42501` sin efectos.

## Evidencia y validación

- PostgreSQL 17.11: 321/321, 0 fallos y 0 deadlocks; cuatro escenarios
  bloquearon realmente.
- Vitest: 738/738 en 74 archivos. TypeScript, build cliente, build Worker,
  `node --check` y `git diff --check`: exit 0. Suite/build corresponden a
  final2; runner final4 repitió PostgreSQL, sintaxis, diff-check y hashes.
- `entryId` coincide con la única fila de actividad; respuestas completas de
  ejecuciones exitosas coinciden con receipts. Retries denegados dejan estado,
  receipts y auditoría sin escrituras parciales.
- Se validan las cinco fences en ambos órdenes. Registro primero: membresía +2,
  mes +1, grafo +0 y fences de ambas operaciones +1. Revocación primero:
  membresía +1, mes/grafo/registro +0 y revocación +1.
- SQL011 y SQL014 conservan sus hashes y no tienen cambios. No hubo llamadas
  remotas ni se activó el espacio operativo.

Manifiesto revisado por Sol:
`review-evidence/m2-2c-operation-record-membership-revocation-races-luna-20261019.json`
(SHA256 previo al cambio de este límite: `eb4c99ec2f373f1d28ddc0e1a111202c40a829c49091711c5e64f5d1275b524b`).
Tras registrar la aceptación en `reviewBoundary`, el manifiesto quedó con SHA256
`b995384693d4bc4235053da617163af7d4113fae66302cb8750a70ddd980c519`.
Runner: `756295076e72cb35981d5ae30ac282bf5b508846c822b3cc4cf14b5032643ea9`.
Reporte: `04d924e8bb3aafa4a5e574695b02221474380f0933078560ececb622df0282786`.
La evidencia cruda está en `../../outputs/m2-2c-operation-record-membership-revocation-races-luna-20261019-final4/`, fuera del Git root.

## Límites P3

- El campo histórico `focusedMatrix` del reporte conserva una etiqueta anterior;
  los cuatro resultados se identifican correctamente por nombre.
- La evidencia cruda externa al Git root no se incluye al clonar el repositorio.
- El runner establece claims/AAL de los actores, pero no repite esos claims en
  cada objeto de resultado.

## Próximo paso

Auditar la matriz incompleta `public.start_task_timer` frente a la revocación
de membresía y redactar un contrato Sol antes de pedir otra implementación
Luna. Esta aceptación no cubre esa familia.
