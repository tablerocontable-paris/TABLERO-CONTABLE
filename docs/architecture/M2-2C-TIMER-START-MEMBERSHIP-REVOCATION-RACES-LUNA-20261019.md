# Contrato Luna — inicio de cronómetro frente a revocación de membresía

Fecha: 19/10/2026. Contrato preparado por GPT-6.1 Sol. Alcance local, PostgreSQL
nativo con datos/claims sintéticos. No modificar SQL ni llamar APIs remotas.

## Objetivo y fundamento

Agregar cuatro carreras entre `public.start_task_timer` ejecutado por el
empleado responsable y `api.command_v1(companyMembership.setActive(false))`
ejecutado por un jefe sobre la membresía del empleado en la empresa de la tarea.
Ambos órdenes bajo RC/RC y RR/RR. Complementa los escenarios mixtos existentes;
no sustituye sus resultados ni acredita una matriz completa de Gate L.

Referencias del código inspeccionado:

- Contrato M2.2B/C `M2-2BC-EXECUTABLE-CONTRACT-20261016.md`, §9, líneas 441–447
  y 464–474: revocación contra ejecución/writers legacy y ambos ganadores.
- SQL014 `202610150014_operational_api.sql:1186`–1250: receipt, preparación de
  tarea/sesiones, adquisición/revalidación, permiso y readiness del timer.
- SQL014 1324–1335: cambia `Pendiente` a `En curso`, incrementa revisión,
  inserta sesión y devuelve su UUID, conservado en el receipt `start_timer`.
- SQL014 2911–2929 y 2944–2961: revocación prepara tareas/sesiones/personas,
  revalida, desactiva membresía, termina sesiones y publica revisión/evento/recibo.
- SQL014 871–939: fences de membresía, grafo y revalidación; 1224–1229: el timer
  publica además fence de mes. SQL011 123–205 y 207–212: snapshot y comparación
  del ámbito antes/después de adquirir locks.
- Runner `tests/review/m2-1-native-review.mjs`: casos existentes identificados
  por los nombres `timer-first then membership revoke blocks, stale RR aborts`
  y `revoke-first mixed RR/RC stale legacy timer`; al redactar, líneas
  3413–3443. No depender de esos números si se desplazan con nuevas pruebas.

## Fixture controlado

Crear cuatro fixtures independientes. Cada uno tiene:

- Empleado responsable AAL1 y jefe AAL2 distintos, activos, de la misma
  organización, con membresía activa en empresa y equipo autorizados. Registrar
  claims efectivos (`auth.uid()`/JWT/AAL), no sólo los valores intentados.
- Una empresa y equipo propios del fixture, una asignación puntual de resultado,
  una ocurrencia ya materializada, período abierto actual, fecha válida y
  checklist vacío. Estado exactamente `Pendiente`, `state_revision=0`,
  responsabilidad individual baseline y empleado único responsable. Peso válido
  de entregable; no usar operativa ni heredar metas del helper `memberTask`.
- Membresía empleado/empresa activa, revisión 0. Jefe no es participante de la
  tarea. Sin otras tareas del empleado en esa empresa, ausencias, cobertura,
  sesiones previas (incluidas sesiones del empleado en otra tarea), tracking,
  dependencias ni cierres. Comprobar estas condiciones antes de la carrera.
- Fila `task_dependency_graphs` de empresa/período existente con configuración
  y fence en cero, sin edges, y fila `api_month_fences` empleado/período en cero,
  creadas sólo durante preparación sintética. Esto evita confundir INSERT inicial
  de grafo con incremento. Los fences de membresía de los dos perfiles deben
  existir por el trigger de perfiles y comenzar en cero. Guardar filas reales.
- Dos operaciones UUID nuevas: timerOperation del empleado y revokeOperation del
  jefe. `start_task_timer(taskId,0,timerOperation,false)`; revocación con revisión
  esperada de membresía `0`, `active=false` y motivo sintético válido.

La fila de grafo no configura dependencias ni altera readiness. Su preexistencia
es necesaria para que los deltas de esta especificación sean exactos. No tomar
un grafo compartido con otras pruebas ni simular increments en producción.

## Cuatro outcomes fijos

| Ganador | Aislamiento de ambos | Primer perdedor | Mismos argumentos en sesión nueva |
|---|---|---|---|
| Inicio | RC/RC | Revocación `40001` | Revocación `00000`. |
| Revocación | RC/RC | Inicio `40001` | Inicio `P0001`, mensaje primario `Sin permiso`. |
| Inicio | RR/RR | Revocación `40001` | Revocación `00000`. |
| Revocación | RR/RR | Inicio `40001` | Inicio `P0001`, mensaje primario `Sin permiso`. |

El retry denegado conserva expected task revision `0`: el permiso legacy se
comprueba antes de esa revisión (SQL014 1244 y 1249). No exigir `42501` ni adaptar
el fixture para producirlo. Capturar código y mensaje primario; no comparar
todo el texto contextual de PostgreSQL con una cadena rígida.

Si un resultado difiere, detener el caso, conservar log/diagnóstico y devolver
el resultado a Sol. No aceptar listas genéricas de SQLSTATE ni cambiar SQL.

## Protocolo concurrente y snapshots

1. Baseline después de toda preparación y antes de ambos comandos. Verificar
   identidades, aislamiento/configuración y estado sin efectos de operaciones.
2. Dos conexiones reales diferentes. Ejecutar ganador en transacción del
   aislamiento indicado; exigir `00000` y conservarla abierta. Establecer
   snapshot del perdedor bajo el mismo aislamiento antes de llamar su comando.
3. Lanzar perdedor mientras ganador sigue abierto y observar con una tercera
   conexión `winnerPid = ANY(pg_blocking_pids(loserPid))`. Registrar ambos PIDs
   y conjunto de bloqueadores, con timeout acotado. No sustituir por sleeps.
4. Confirmar ganador, esperar resultado `40001` del perdedor y hacer rollback
   explícito. Capturar winner-only y estado tras rollback: igualdad exacta en
   filas/fences del ámbito, sin efectos parciales del perdedor.
5. Reintentar en conexión nueva, mismo actor/claims/AAL, operación y argumentos,
   mismo aislamiento. Confirmar sólo `00000`; rollback para `P0001`. Capturar
   estado final y comparar los deltas y filas requeridos.

Snapshots antes, winner-only, tras conflicto/rollback y tras retry incluyen
tarea/asignación, responsabilidad/head/members, membresía, perfiles/claims,
sesiones completas del actor y tarea, ambos tipos de recibos, fences de las
claves exactas, eventos de membresía y auditoría. Leer snapshots con observador
privilegiado local; el empleado revocado ya no puede consultar todo el estado.

## Estados y recibos

- **Inicio primero, winner-only:** membresía activa/revisión 0; tarea `En curso`,
  revisión 1; una sesión abierta del empleado, `contribution_kind=responsible`,
  sin binding/ausencia. Un recibo legacy y un `task.timer_started`; sin recibo ni
  evento de revocación.
- **Inicio primero, final:** misma sesión y timestamps originales de inicio,
  `ended_at` no nulo y mayor o igual a `started_at`; cero sesiones abiertas.
  Membresía inactiva/revisión 1; tarea `En curso`, revisión 2. Exactamente un
  recibo/evento de revocación. No exigir un evento `task.timer_stopped`: esta
  revocación no lo emite. Conservar el evento original de inicio.
- **Revocación primero, winner-only y final:** membresía inactiva/revisión 1;
  tarea `Pendiente`, revisión 1; cero sesiones y cero recibos/eventos de inicio.
  El `40001` y el retry `P0001` no cambian el estado confirmado del ganador.
- El UUID devuelto por el inicio exitoso coincide con la única fila de sesión
  y `task_mutation_receipts.result.session_id`. Es un UUID generado por SQL,
  distinto conceptualmente de timerOperation; no presuponer que son iguales.
  Recibo exacto: actor empleado, timerOperation, `operation_kind=start_timer`,
  `arguments={instance:taskId,revision:0,switch:false}` y
  `result={session_id:sessionId}`. Afirmar conjuntos de claves y valores.
- Comparar respuesta completa de revocación exitosa con
  `api_command_receipts.result`, actor jefe, revokeOperation, kind, argumentos y
  claves exactas. Intentos fallidos no dejan recibos de su operación.
- Auditoría: `task.timer_started` usa entity_id=sessionId y details.instance=taskId;
  `companyMembership.setActive` usa empresa y details.profileId=empleado.
  Consultar por ámbito/entidad/detalles sin ocultar autores inesperados mediante
  filtros de actor; afirmar el autor correcto y una fila por acción. Comprobar
  también un único `company_membership_events` del empleado/empresa/revisión 1.
- Cero actividad, evaluaciones, cobertura, cierres o cambios de asignación/
  responsabilidad en cualquiera de las cuatro carreras.

## Fences exactos desde baseline

Claves: membershipEmployee y membershipChief en `api_membership_fences`,
month en `api_month_fences(owner,period)`, graph en
`task_dependency_graphs(company,period)`, timerOperation y revokeOperation en
`api_operation_fences(actor,operation)`. Ambos operation fences ausentes antes.

| Momento confirmado | membershipEmployee | membershipChief | month | graph fence | graph config | timerOperation | revokeOperation |
|---|---|---|---|---|---|---|---|
| Inicio primero, winner-only y tras rollback del perdedor | +1 | +0 | +1 | +1 | +0 | Ausente | Ausente |
| Inicio primero, tras retry exitoso de revocación | +2 | +0 | +1 | +2 | +0 | Ausente | Una fila, epoch 1 |
| Revocación primero, winner-only y todos los estados posteriores | +1 | +0 | +0 | +1 | +0 | Ausente | Una fila, epoch 1 |

El timer es legacy: escribe su recibo, no `api_operation_fences`. La adquisición
del timer publica una vez membershipEmployee, graph y month. La revocación
publica una vez su fence de operación, membershipEmployee y graph, sin month;
su scope membership no incrementa el fence del jefe. Sus adquisiciones false y
true no deben contarse como dos escrituras exitosas de grafo. Todos los writes
tentativos del `40001`/`P0001` desaparecen con rollback. Verificar filas y deltas,
no únicamente exit codes. Si divergen, guardar evidencia y volver a Sol.

## Validación y entrega

Luna modifica únicamente runner, manifiesto y documentación de resultado del
bloque. Conservar SQL001–014, DTO/UI/Worker y demás escenarios. Registrar commit
baseline real y SHA-256 de runner, contrato, SQL011/014, reporte y logs. Ejecutar
PostgreSQL nativo con cuatro casos identificados, `node --check`, suite completa,
TypeScript, build cliente/Worker y diff-check. Registrar versión de PostgreSQL,
aislamiento efectivo y cero `40P01`/deadlocks. No instalar dependencias.

Evidencia cruda puede ir a `../../outputs`; el manifiesto versionado declara
rutas, hashes, comandos/exit codes y resultados resumidos. Sol revisa hashes
exactos antes de aceptación/commit/push. Esta familia no cierra §9/M2.2C/Gate L,
no verifica Auth/HTTP alojado ni autoriza aplicar SQL014 o producción.

## Límites explícitos

No incluir replay después de revocación: la rama legacy de start_timer devuelve
recibo antes de adquirir el ámbito y reautorizar (SQL014 1200–1203). Ese
comportamiento requiere una auditoría y contrato independientes; no declararlo
corregido ni cubierto aquí. Tampoco incluye cambio de cronómetro, expiración,
participación conjunta, cobertura, ausencias, otra empresa, cierre mensual,
readiness/dependencias, revocación del jefe ni otros writers legacy.
