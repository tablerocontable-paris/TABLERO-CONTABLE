# Inventario residual §9 — auditoría Sol

Fecha: 20/10/2026. Baseline inspeccionado:
`f3a20cfe9ffba0efea5f8e09be047ebd25eb4e7d`, árbol inicialmente limpio.
Es auditoría de código y aceptaciones existentes, no una nueva ejecución SQL ni
aceptación consolidada de Gate L. Se leyeron AGENTS/PROJECT-STATUS/EXECUTION-NEXT,
§9 del contrato M2-2BC y definiciones efectivas de las migraciones001–014.

SQL014 checkout SHA-256:
`CDD909C1A280DF8E891D6062838B146AEECADCF5CBC0F52291C6D44A0C89ECA2`.
Blob Git de HEAD:
`B5EAED293474A5A666E396AB42CBDAF998D9EA7EC63B93F111FA90B954230C92`.
Las cabeceras mencionan el commit funcional53f37f0; HEAD f3a20cfe incluye esa
publicación y documentación. No interpretar las notas cronológicas antiguas
como instrucciones para repetir matrices ya aceptadas.

## Alcances aceptados que no deben reimplementarse

| Familia | Alcance aceptado y referencia en docs/architecture |
|---|---|
| Replay start_task_timer | Reautorización, secuencias y ocho carreras; `M2-2C-LEGACY-TIMER-REPLAY-AUTHORIZATION-SOL-ACCEPTANCE-20261019.md`. |
| Replay record_activity_once | Actual/Upgrade, ocho carreras por ruta, inercia y recibos; `M2-2C-LEGACY-ACTIVITY-REPLAY-SOL-ACCEPTANCE-20261019.md`. |
| Replay assign_task_responsibility | Cuatro P2 cerrados; secuencias y ocho carreras, footprint no participante; `M2-2C-LEGACY-RESPONSIBILITY-REPLAY-SOL-ACCEPTANCE-20261019.md`, dictamen vigente20/10. |
| Primer inicio timer vs revocación | Cuatro casos RC/RC y RR/RR, complementan mixtos anteriores; `M2-2C-TIMER-START-MEMBERSHIP-REVOCATION-RACES-SOL-ACCEPTANCE-20261019.md`. |
| API operation.record vs revocación | Cuatro carreras; `M2-2C-OPERATION-RECORD-MEMBERSHIP-REVOCATION-RACES-SOL-ACCEPTANCE-20261019.md`. |
| API task.transition vs revocación | Cuatro primeras ejecuciones; `M2-2C-TRANSITION-MEMBERSHIP-RACES-SOL-ACCEPTANCE-20261019.md`. No acepta replays de wrappers legacy con otro recibo/retorno. |
| assignment.create y task.createOneOff vs revocación | Cuatro carreras cada familia; aceptaciones `M2-2C-ASSIGNMENT-CREATE-MEMBERSHIP-REVOCATION-RACES-SOL-ACCEPTANCE-20261019.md` y `M2-2C-ONEOFF-CREATE-MEMBERSHIP-REVOCATION-RACES-SOL-ACCEPTANCE-20261019.md`. |
| Responsabilidad/cancelación cobertura vs onboarding.approve | Cuatro casos cada familia; `M2-2C-RESPONSIBILITY-ONBOARDING-APPROVAL-RACES-SOL-ACCEPTANCE-20261019.md` y `M2-2C-COVERAGE-CANCEL-ONBOARDING-APPROVAL-RACES-SOL-ACCEPTANCE-20261019.md`. |
| Cobertura recurrente vs revocación | Mixtos y mismos aislamientos aceptados; evidencia `review-evidence/m2-2c-gatel-recurrent-coverage-20261019.json` y `review-evidence/m2-2c-recurrent-same-isolation-luna-20261019.json`, cabeceras históricas aceptadas. |
| Cobertura recurrente vs materialización | Cuatro casos; `M2-2C-RECURRING-COVERAGE-MATERIALIZE-RACES-SOL-ACCEPTANCE-20261019.md`. |
| API onboarding y receipt | Submit/saveDraft: follow-up R90 en `M2-2C-GATEL-REPLAY-DEFECT-20261017.md`/mapa de writers. RequestChanges: `M2-2C-REQUESTCHANGES-REPLAY-LUNA-20261018.md` declara aceptación acotada y evidencia. Mantener sus límites, no llamarlos matriz completa. |
| Base R90 y B | `M2-2C-SOL-ACCEPTANCE-20261017.md` enumera128 casos y límites; el mapa `M2-2C-MEMBERSHIP-WRITERS-MAP-20261016.md` describe autorización, RLS, sesiones, restores y fallos específicos. A/B tienen aceptación previa según §9; no se reabren por repetir el inventario. |

Esta tabla registra el alcance de los documentos. No transfiere la aceptación
de un hash histórico a todo SQL014 actual ni revalida todos sus artefactos.
La matriz351/351 y suite738 del último corte son regresión de la candidata,
no prueba de que cualquier endpoint omitido esté cubierto.

## Inventario efectivo finito de replays legacy todavía no aceptados

Se inspeccionaron definiciones por orden de migración y sus llamadas de recibo;
no se confundió una función reemplazada con su versión efectiva. Son cuatro
grupos, diez endpoints, más helper interno compartido de ausencias:

| Grupo | Endpoints | Evidencia actual y tratamiento |
|---|---|---|
| T: controles de tarea | transition_task_reviewed, set_checklist_item_reviewed, set_task_wait, set_task_wait_reviewed | Retornos cached anteriores a `_coordination_apply_task_control`. Sospecha estática concreta; seleccionado ahora como una familia de cuatro wrappers. |
| C: supervisión de cobertura | approve_task_coverage_plan, cancel_task_coverage_binding | Retorno cached antes de MFA/ámbito; sus carreras aceptadas de primera ejecución no prueban esos retornos. Inspección y reproducción posterior agrupadas, sin repetir materialización/revocación ya aceptadas. |
| A: supervisión de ausencias | approve_employee_absence, cancel_employee_absence | `_get_mutation_receipt` de SQL011:1379 retorna antes de MFA/ámbito. Helper sólo tiene estos dos consumidores efectivos. No cambiarlo globalmente sin contrato de esta familia. |
| P: política de cleanup/privacidad | pause_task_timer, save_private_block_note | No clasificar automáticamente como defecto. Pause admite cerrar sesión propia después de perder acceso; el mapa R90 documenta explícitamente pausa con perfil inactivo. Notas son privadas del autor y ya verifican rol/org activos antes de cached; falta resolver qué acceso histórico propio conserva el autor. Revisar política y evidencia existente antes de autorizar cambios. |

El inventario anterior de «tres replays pendientes» era selección acotada,
no catálogo exhaustivo. Esta auditoría corrige esa ambigüedad con los diez
endpoints efectivos. No se abrirán diez matrices idénticas: T comparte una
implementación de autorización y una matriz concurrente representativa;
C/A se deben agrupar por protocolo; P puede cerrarse con evidencia de política
si confirma el comportamiento deseado, sin cambiar código por uniformidad.

Los otros endpoints legacy de asignación/materialización sin receipt cached
no entran automáticamente en este inventario. Su cobertura de primera
ejecución pertenece al cruce de §9, no a nuevas correcciones de replay.

## Próxima unidad elegida y condición de avance

Contrato ejecutable:
`M2-2C-LEGACY-TASK-CONTROL-REPLAY-AUTHORIZATION-SOL-CONTRACT-20261020.md`.
Cuatro wrappers, una autorización readonly privada y una matriz compartida;
reproducción por wrapper antes de tocar SQL014. Si la sospecha no se reproduce,
no-go y evidencia a Sol; no fabricar un fallo para justificar un cambio.

Después de aceptar T: actualizar esta tabla una sola vez y seguir C/A/P.
Después, cruce consolidado de §9 con nombres/resultados ya existentes y
acotamiento de huecos reales de concurrencia/inyección de fallos: no una nueva
reimplementación genérica de todos los writers. Una familia ya aceptada sólo
se reabre por cambio de producto o evidencia concreta contradictoria.

Gate L sigue abierto. Data API, preflight H, Auth/HTTP real, Storage/restauración,
integración frontend, CI, hosting/correo y producción son entregables distintos
pendientes; no se acreditan con estas matrices. Este inventario no ejecutó SQL
ni servicios, no editó código y no realizó commit/push.
