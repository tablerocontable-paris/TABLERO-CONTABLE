# Contrato Luna — creación de asignación frente a revocación de membresía

Fecha: 19/10/2026. Contrato preparado por GPT-6.1 Sol. Sólo PostgreSQL nativo
local con identidades/datos sintéticos. No cambiar SQL ni llamar APIs remotas.

## Objetivo y código que lo fundamenta

Agregar cuatro carreras de primera ejecución entre
`api.command_v1(assignment.create)` y
`api.command_v1(companyMembership.setActive(false))`, con dos jefes diferentes,
para un mismo empleado/empresa. Ambos órdenes bajo RC/RC y RR/RR.

Referencias al redactar este contrato:

- `M2-2BC-EXECUTABLE-CONTRACT-20261016.md:458`–474: concurrencia/revocación de
  creation y aceptación completa de §9/Gate L aún pendiente.
- Runner `tests/review/m2-1-native-review.mjs:2701`–2719 y 2764–2785: los dos
  órdenes existentes sólo RC/RR, usando el mismo jefe. Los escenarios de replay
  y commandReceipt son otros alcances y no sustituyen primera ejecución.
- SQL014 `202610150014_operational_api.sql:2247`–2271: contrato, jefe AAL2,
  argumentos y lock de actor/operación. 2393–2410: revisión, plan compartido,
  revalidación y pertenencia del empleado a empresa/equipo.
- SQL014 2413–2453: fence mensual, creation head, operation fence, asignación,
  incremento de creation revision, recibo y auditoría. `assignment.create` no
  entra en la rama `task.createOneOff` de 2443–2447 y no inserta ocurrencias.
- SQL014 2911–2961 y 3150–3171: revocación y ampliación de su snapshot con las
  asignaciones del sujeto/empresa aunque no tengan tareas. Detectar ese cambio
  de footprint es parte central de esta prueba.
- SQL014 871–939: adquisición compartida, publicación selectiva de fences y
  revalidación. SQL011 `202610060011_coordination_activation.sql:123`–212:
  construcción de personas/snapshot y comparación tras esperar.

## Fixture y estado inicial obligatorio

Cuatro fixtures independientes, cada uno con empresa/equipo propios, empleado
destinatario E y dos jefes C (creador) y R (revocador), todos activos de la misma
organización. C y R diferentes, ambos con claims authenticated/AAL2 y permisos
de empresa/equipo. E tiene membresía activa en empresa/equipo; revisión de su
membresía exactamente 0. E no ejecuta los comandos; su AAL no es precondición.

Antes de baseline, comprobar:

- Cero asignaciones y ocurrencias del empleado, cero sesiones y ausencia de
  cobertura, ausencias, responsabilidades conjuntas, actividad, cierres y
  dependencias. Ninguno de los jefes tiene trabajo o sesiones en el ámbito.
- `api_creation_heads(org,E)` existe, `revision=0`, `fence_epoch=0`, creada
  sólo durante preparación sintética. La creación debe usar ON CONFLICT;
  no mezclar una fila ausente con esta expectativa de incremento.
- `api_month_fences(org,E,period)` existe con epoch 0.
- `task_dependency_graphs(org,company,period)` existe con fence/config 0 y sin
  edges. Sus valores se conservarán: no hay task instances en esta matriz.
- `api_membership_fences` de E, C y R existen con epoch 0, inicializadas por el
  trigger de perfiles; capturar filas reales. Cero operation fences y recibos
  para las dos nuevas operaciones.
- Período abierto actual, fecha válida dentro de él. No materializar el mes,
  llamar onboarding ni crear tareas durante el setup.

Comando de C: `assignment.create`, `expectedRevisions={creation:E:"0"}`,
ownerId E, empresa/equipo del fixture y source custom operativa v2 con unidad
válida, título/objetivo/sector sintéticos. Schedule puntual válido (`unica`,
inicio/fin el mismo día, interval 1 y demás campos exactos requeridos).
Definición sin target/peso/checklist de entregable: la fila resultante conserva
`measurement_version=2`, `weight=NULL`, `target=NULL`, unidad y checklist vacío.
No usar catálogo; no introducir locks/revisiones de un tercer escritor.

Comando de R: `companyMembership.setActive`, expected membership E/company
revision `"0"`, `active=false` y motivo sintético válido. Operaciones UUID nuevas
y diferentes. Conservar los envelopes originales para retries y comparación.

## Outcomes exactos

| Ganador | Aislamiento de ambos | Primer perdedor | Reintento en conexión nueva |
|---|---|---|---|
| Asignación | RC/RC | Revocación `40001` | R reintenta revocación: `00000`. |
| Revocación | RC/RC | Asignación `40001` | C reintenta asignación: `42501`. |
| Asignación | RR/RR | Revocación `40001` | R reintenta revocación: `00000`. |
| Revocación | RR/RR | Asignación `40001` | C reintenta asignación: `42501`. |

Revocación-primero: el retry fresco falla por pertenencia del empleado, antes
de escribir creation head/operation fence (SQL014 2410 y 2424–2427). No cambiar
expected creation revision ni operación. Asignación-primero: el snapshot de
revocación debe detectar la nueva asignación aun con cero tareas.

Cualquier SQLSTATE o delta distinto detiene ese escenario. Guardar respuestas,
logs, PIDs y snapshots exactos, y devolver la divergencia a Sol. No aceptar
listas intercambiables de outcomes ni cambiar SQL/contrato para volverlo verde.

## Protocolo de bloqueo y reintento

1. Capturar baseline tras preparación; registrar claims efectivos mediante
   auth.uid()/JWT/AAL, no sólo los valores enviados. Usar dos conexiones reales
   y comprobar `show transaction_isolation` en ambas.
2. Ejecutar ganador y exigir `00000` sin confirmar. Iniciar transacción del
   perdedor con snapshot establecido mientras ganador sigue abierto; lanzar el
   comando. Observar desde conexión independiente
   `winnerPid=ANY(pg_blocking_pids(loserPid))`; registrar ambos PIDs y blockers
   con timeout acotado. Sleeps no sustituyen el bloqueo.
3. Confirmar ganador; resolver el perdedor con `40001` y rollback explícito.
   Capturar winner-only y estado tras rollback: igualdad exacta de filas y
   fences del ámbito. Un error no debe dejar escrituras parciales.
4. Abrir conexión nueva, mismo actor C/R, claims/AAL, argumentos, operationId
   y aislamiento. Retry `00000` se confirma; retry `42501` se revierte. Capturar
   final y afirmar los estados/deltas completos de este contrato.

Snapshots locales privilegiados: E/C/R y sus membresías, equipo, todas las
asignaciones del empleado/empresa, todas sus ocurrencias, sesiones, creation
head, graph/month/membership/operation fences, recibos de ambas operaciones,
eventos de membresía y auditoría. Consultar por entidad/ámbito sin filtrar
autores inesperados; después afirmar autor correcto. Guardar before,
winner-only, after-first-attempt/rollback y after-retry, más respuestas/errores.

## Filas, IDs y recibos

- **Asignación primero, winner-only:** una asignación del empleado; cero
  ocurrencias. Membresía aún activa/revisión 0. Creation head revisión 1/fence 1.
  Un recibo/evento de assignment.create, ninguno de revocación.
- **Asignación primero, final:** misma fila de asignación sin cambios de
  contenido, cero ocurrencias/sesiones. Membresía inactiva/revisión 1. Un recibo
  de cada comando y un evento de membresía/revocación; cero duplicados.
- **Revocación primero, winner-only y final:** membresía inactiva/revisión 1;
  cero asignaciones, ocurrencias y recibos/eventos de creación. Creation head
  sigue exactamente en revision/fence 0. Conflicto/retry denegado no agregan nada.
- Comparar respuesta completa exitosa con `api_command_receipts.result`, actor,
  operationId, kind y arguments exactos (`{kind,payload,expectedRevisions}`).
  Recibos identificados por `(actor_id,operation_id)`. Fallos `40001`/`42501`
  no dejan recibo para la operación fallida.
- `assignmentId` devuelto coincide con la única fila física y el entity_id del
  evento assignment.create. `assignmentRevision="1"` corresponde a
  `task_assignments.definition_revision=1`; no confundirla con creation head.
  Verificar propietario/empresa/equipo/definición/schedule y versión v2 exactos.
- Auditoría: una fila `assignment.create` atribuida a C con details.ownerId=E;
  una `companyMembership.setActive` atribuida a R con details.profileId=E y
  active=false. Un único `company_membership_events` E/company/revisión 1.
  Guardar también auditoría por empresa/empleado/IDs para descubrir extras.
- Todas las etapas confirman cero `task_instances`, sesiones, movimientos,
  parameterization pendiente, cobertura, tracking, completion events y cierres.

## Fences y revisiones exactos desde baseline

Los valores son incrementos respecto a las filas cero precreadas. C y R no
comparten identidad. Los operation fences de esta tabla empiezan ausentes.

| Estado confirmado | membership E | membership C | membership R | month E | graph fence/config | creation revision/fence | createOperation | revokeOperation |
|---|---|---|---|---|---|---|---|---|
| Asignación primero, winner-only y tras rollback perdedor | +1 | +1 | +0 | +1 | +0/+0 | +1/+1 | Una fila, epoch 1 | Ausente |
| Asignación primero, tras retry de revocación | +2 | +1 | +0 | +1 | +0/+0 | +1/+1 | Una fila, epoch 1 | Una fila, epoch 1 |
| Revocación primero, winner-only y todos los estados posteriores | +1 | +0 | +0 | +0 | +0/+0 | +0/+0 | Ausente | Una fila, epoch 1 |

Razón: `_coordination_prepare` incorpora C en people, de modo que la creación
incrementa fences de E y C. La rama membership de revocación no incrementa
fences genéricos de people; publica explícitamente E una vez (SQL014 2948),
sin incrementar R. Sólo la creación publica mes y creation head. Ninguno
adquiere un catálogo dependencies con tareas en este fixture; el grafo no cambia.
Toda escritura tentativa de intentos fallidos desaparece con rollback.

## Validación, entrega y límites

Luna modifica sólo runner, manifiesto y documentación de resultado de este
bloque. No editar SQL001–014, DTO/UI/Worker, ni reescribir escenarios anteriores.
Registrar baseline Git real, comandos/exit codes, PostgreSQL e aislamiento
efectivos y SHA-256 de runner/contrato/SQL011/014/reporte/logs. Ejecutar PostgreSQL
nativo con cuatro casos identificados, cero `40P01`/deadlocks, `node --check`,
suite completa, TypeScript, builds cliente/Worker y diff-check. Sin instalar
dependencias. Evidencia cruda en `../../outputs` puede quedar fuera del Git root;
el manifiesto versionado debe declarar rutas, hashes y resumen verificable.

Sol acepta hashes exactos antes del commit/push. Esta familia no cierra
§9/M2.2C/Gate L, no verifica CI/Auth/HTTP alojado ni autoriza aplicar SQL014.
Fuera de alcance: catálogo, altas puntuales, month.materialize, replays y
commandReceipt, revocación del creador/jefe, otros equipos/empresas, tareas ya
existentes, cierres y otros writers legacy. No usar aceptación de esta matriz
como evidencia de esos escenarios.
