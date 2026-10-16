# Protocolo ejecutable de concurrencia011 — revisión 06/10/2026

Este documento sustituye el apartado de locks de
`COORDINATION-011-EXECUTION-20261004.md`. Cierra el hallazgo de diseño en
`COORDINATION-011-LOCK-REVIEW-20261004.md`; no modifica ni activa SQL001–010.
Ejecución siguiente: GPT-6 Luna medio, Standard. Revisión posterior: Sol alto.

## Alcance del hallazgo y decisión

El caso anterior era una inversión posible al ampliar las RPC con locks tardíos,
no una carrera reproducida contra el SQL010. Los wrappers transition/checklist
vigentes fueron corregidos en005 para delegar sin prelocks: se debe inspeccionar
la última definición de cada función, no una definición004 ya reemplazada.
La activación011 sustituye cada ruta escritora y su envelope completo; agregar
locks a `lock_open_month` sin sustituir sus llamadores queda prohibido.

No hay lock de organización ni serialización de todos los empleados. Se conserva
un gate por perfil para estabilizar creación de tareas/relaciones mientras se
cierra ese perfil; perfiles distintos sin trabajo compartido pueden progresar.
El gate por perfil incluye sus meses, como ya ocurre con work-owner008; no es
una promesa de paralelismo entre meses del mismo empleado.

## Identidades físicas y orden único

Usar exclusivamente `pg_advisory_xact_lock(namespace int, key int)` en011.
Namespaces nuevos fijos, no concatenaciones bigint antiguas:

| Tier | Namespace | Identidad lógica que se hashea con `pg_catalog.hashtext` |
| --- | --- | --- |
| R receipt | 1101 | UUID Auth canónico + `:` + UUID operation_id canónico |
| A reloj por actor | 1102 | UUID canónico del ejecutor cuya sesión puede cambiar |
| W gate de perfil | 1103 | UUID canónico del perfil afectado |
| M corte mensual | 1104 | UUID canónico + `:` + fecha ISO YYYY-MM-01 |
| C catálogo | 1105 | `template:` + UUID o `name:` + org UUID + `:` + nombre normalizado |

Orden R → A → W → M → C → filas. En cada tier calcular **todas** las keys int,
deduplicar y ordenar por su valor físico signed int ASC, y adquirir mediante
loop PL/pgSQL explícito. No ordenar sólo por UUID ni ejecutar la función de lock
en un SELECT cuyo orden de evaluación se presuponga. Colisiones hash sólo
serializan recursos extra; ordenar keys físicas evita inversión por colisiones.
Los namespaces separan dominios; una colisión nunca concede permisos ni altera
la identidad de una tarea. Este protocolo reemplaza las keys bigint antiguas
receipt/timer-actor/work-owner/owner+period en todas las definiciones vigentes.
No mezclar ambas familias para aparentar compatibilidad.

R tiene una única key por entrada RPC; la identidad compartida de receipts
008/009 es actor+operation_id, **sin operation_kind** porque ambas rutas
serializaban esa misma key. Las tablas de receipts siguen separadas y sus
conflictos de argumentos siguen vigentes. Los wrappers sin key pública generan
una sola operación interna y entran una vez al envelope. Ningún core crea o
adquiere un segundo receipt ni vuelve a empezar el protocolo dentro del primero.

## Envelope y helpers internos obligatorios

`_coordination_prepare(...)` sólo lee; no toma row/advisory locks ni hace DML.
Devuelve un plan interno con actor/org, operación, task IDs, fuente/destino de
timer, actors A, perfiles W, parejas M, catálogo C, filas auxiliares a bloquear,
identidades/head revisions/binding snapshots y fingerprint de la selección.
No acepta un plan firmado por cliente ni permite que éste elija locks/permisos.

`_coordination_receipt_lock(actor,operation_id)` adquiere R una vez en la
entrada. `_coordination_acquire(plan)` valida forma interna y adquiere A/W/M/C
completos en ese orden, con R ya obtenido antes de resolver el receipt. Tras R, un
ACK exacto propio puede retornar sin A–C ni writes conforme al contrato de replay.
Para una operación nueva el plan completo se descubre después de R, antes de A.
Puede consultar la sesión de origen de forma optimista; si cambia mientras
espera A o W, la comparación posterior aborta, no se bloquea otro origen tarde.

Después de advisories bloquear las filas existentes en un orden fijo de tablas,
por PK UUID ASC en cada tabla: task_templates → task_assignments →
onboarding_requests → task_coverage_plans → employee_absences → task_instances →
task_responsibility_sets → task_responsibility_heads → task_coverage_bindings →
task_time_sessions → task_private_block_notes. En sessions ordenar
`instance_id,actor_id,id`; heads por instance_id; notes por instance_id,author_id,id.
Preparar IDs antes del lock; obtener cada fila por PK en un loop, no basarse en
el plan físico de una consulta con ANY(...). Los datos nuevos se insertan dentro
de su envelope; parents/FKs históricos no se eliminan. Los triggers010 que
bloquean parent set/plan deben ejecutarse después de haber bloqueado ese parent,
o sobre el parent recién insertado propio. Ningún trigger toma A/W/M/C tarde.
Inventariar también locks implícitos por FKs/índices y las tablas auxiliares de
DML: el orden listado no demuestra por sí solo ausencia de deadlocks SQL. No
eliminar ni cambiar claves parent históricas dentro de estas rutas.

`_coordination_revalidate(plan)` vuelve a leer actor/org/AAL/empresa/jerarquía,
identidades, head/set/binding/ausencia, selección de tasks, origen de timer,
revisiones y periodos cerrados con timestamp tomado después de esperar.
Fingerprint diferente, expansión **o reducción** del conjunto, devuelve
SQLSTATE40001 con mensaje de conflicto. No sumar locks ni ampliar tareas después
de A, ni usar loop de reintento en la misma transacción: debe hacer rollback
completo y reentrar como nueva transacción con la misma operation_id. No emitir
audit/receipt/outbox antes de validar. No actualizar otra tarea fuente que haya
aparecido después del plan. Un resultado ya confirmado sigue resuelto por receipt.

El helper histórico `lock_open_month(uuid,date)` se redefine en011 como assert
interno de corte abierto, sin adquisición de locks. Sólo se llama después de M;
se revoca EXECUTE de PUBLIC/anon/authenticated/service_role. No puede ser API para
usuarios. `_get_mutation_receipt` usa sólo R; `_save_mutation_receipt` no toma
locks. Los cores de transición/checklist/actividad/materialización no toman
advisories; el envelope ya los obtuvo todos. Helpers SECURITY DEFINER con
search_path vacío, objetos calificados y ACL revocadas. Los wrappers públicos
mantienen firma y respuesta salvo los nuevos DTO explícitamente versionados.

## Cómo construir cada footprint

- **Una task:** W incluye owner/ancla y cada miembro de head sellado vigente
  (fallback owner); M incluye esas personas con task.period. Si se modifican
  sesiones/registros de un actor, también W/M del actor con ese periodo. No usar
  el mes actual del navegador como sustituto del periodo original.
- **Timer propio:** A incluye actor Auth. Cambio de reloj incluye todas las
  tasks fuente/destino y su footprint combinado. Pausar sólo su sesión añade
  actores cuya sesión vaya a cerrar, no todos los empleados del equipo.
- **Completar/reabrir/espera que detiene relojes:** A incluye Auth y todos los
  actores con sesiones abiertas en tasks afectadas. Una sesión abierta nueva
  que no estaba planificada dispara conflicto tras W, nunca se detiene sin A.
- **Asignar conjunta:** W/M une miembros viejos, ancla y dos miembros propuestos;
  A sólo si hay sesiones que se vayan a modificar (la aprobación inicial exige
  ausencia de evidencia/sesiones). Head revision esperada es la de responsabilidad;
  state_revision de task también se captura/revalida. Esta RPC sólo activa una
  conjunta inicial puntual con ancla; transferencias individuales quedan para B3.
- **Materializar:** W incluye propietario de asignaciones y responsables/
  reemplazos de reglas aprobadas que puedan generar bindings. M incluye mes de
  cada ocurrencia prevista y cada actor que recibiría vínculo. Leer catálogo y
  assignments bajo C/filas; generar la lista completa antes de INSERT. Nuevas
  reglas aprobadas bajo W hacen que se reprograme el plan, no permiso implícito.
- **Cobertura propuesta/aprobada/cancelada:** W une titular, reemplazo y miembros
  de cada tarea elegida. M incluye tasks existentes originales y meses del rango
  de reglas futuras. Cancelar agrega A de sesiones abiertas que tocará y su
  task.period; plan/absence se bloquea antes de tasks, binding antes de sesiones.
  Es posible revocar un vínculo sin reescribir evidencia cerrada; si hay sesión
  abierta incompatible con cierre, rollback y diagnóstico, no alterar snapshot.
- **Cierre:** descubrir tasks donde p_owner es responsable y contribuciones
  propias de cobertura; W incluye p_owner, responsables de esas tasks y actores
  de sesiones que el cierre pudiera terminar por expiración. M incluye todos
  esos cortes originales. A incluye actores de sesiones a expirar o inspeccionar
  para cierre. Tras W reconsultar lista de tasks/heads/sesiones. Un start nuevo
  antes de W obliga a revalidar/rechazar cierre por reloj activo; después de W
  queda esperando M/W y, al entrar, observa el cierre. Sólo se inserta closure
  de p_owner, no de los compañeros. Cerrar B después de A es válido sobre tarea
  congelada; no exigir que todos los cortes asociados estén abiertos para una
  operación de cierre que no escribe su evidencia.
- **Comentario privado009:** R compartido; A vacío; W/M de owner/ancla original,
  task fila y luego nota propia. No cambia status/KPI/sesiones de la conjunta ni
  se incluye en reporte común. Mantener privacidad, replay y corte009; no bloquear
  perfil vecino por autoría de una nota. Sustituir el cuerpo de RPC009 en011 para
  usar las nuevas keys; no editar la migración009 histórica.
- **Inducción:** plan de todas sus líneas, assignments, catálogo y meses que
  materializará. Obtener envelope completo antes de bloquear onboarding_request.
  El core de materialización invocado por cada línea no toma nuevos locks. Si
  request/current_revision cambia, rollback todo el lote.

Para tarea individual sin cobertura: W/M del titular, A del actor sólo si afecta
un reloj. No incluir toda la organización ni el equipo por comodidad. Cierre de
un contribuyente pasado no congela trabajo actual ajeno si no se alteran sus
sesiones/registros cerrados: su sección cobertura conserva evidencia propia y
referencia de obligación, no un segundo resultado/peso. Una task conjunta sí
queda sin nuevas mutaciones de resultado al cerrar cualquiera de sus miembros.

## Matriz de rutas que Luna sustituye en una sola migración

| Ruta vigente | Última definición en001–010 | Cambio de envelope |
| --- | --- | --- |
| start_task_timer / pause_task_timer | 008 | R,A y unión source/dest, actor y filas de sesión |
| transition_task_reviewed / set_checklist_item_reviewed / set_task_wait | 008 | R,A de relojes afectados, todo W/M, estado global único |
| transition_task / set_checklist_item | 005 | Delegan una vez sin prelocks a core protegido |
| record_activity_once | 004 | R; core de actividad sin envelope anidado |
| record_activity | 005 | Entrada propia con key interna; mismo core/footprint |
| close_employee_month | 006 | Un envelope del cierre completo, no por owner aislado |
| materialize_month | 001 ocurrencias | Un envelope para todas las ocurrencias/bindings |
| create_catalog_assignment | 004 | W/M/C antes de insert, misma firma |
| approve_employee_absence | 007 | Envelope de rango/empresas y sesiones actuales, legacy acotado |
| cancel_employee_absence | 007 | R,A,W/M, absence antes de task/session |
| approve_onboarding | 002 | Plan lote previo a request row; materialización sólo core |
| save_private_block_note | 009 | R,W/M nuevos, tarea antes de nota, política privada intacta |
| update_template_weight / create_task_template | 001 ocurrencias | C y template fila; no locks de task ya creada |
| propose/approve/cancel selected coverage y assign responsibility | 011 nuevos | Footprints definidos arriba; sin puente a grant amplio legacy |

Las RPC de draft/submit/request_changes de inducción no escriben tasks ni
adquieren W/A/M; bloquean su request y terminan ahí, sin invocar un core de
materialización. Consumidores delivery/outbox sólo bloquean sus propias filas,
no invocan escritor de tareas. Guardar esa separación al auditar rutas futuras.

## Replay y compatibilidad ya verificados en008/009

Receipt existente propio, key/args/operation correctos retorna ACK escalar sin
escritura tras perder membresía de task o cerrar mes; no exigir autorización nueva
de task para ese ACK ni adjuntar nuevos datos. Operación nueva sí comprueba todo
el permiso actual. Validar Auth y organización del perfil del emisor; los ACK
de notas009 conservan requisito de perfil activo. Pausa propia permite la limpieza
acotada008 aun si el perfil fue suspendido o perdió empresa: sólo sesión propia,
sin iniciar/leer task ajena y sin cambiar evidencia de mes cerrado. No debilitar
esa excepción ni convertirla en autorización genérica. El permiso ampliado de
conjunta jamás permite parar una sesión ajena por la RPC de pausa propia.

## Verificación y condiciones para aceptar implementación

`tests/coordination-lock-order.test.ts` explora interleavings abstractos de
adquisición/commit: reproduce la inversión, incluye switches cruzados, cierre,
keys signed/colisiones y 225 pares de footprints. Sus siete pruebas pasan.
No ejecutan PostgreSQL ni validan DML/RLS/phantoms/triggers del engine.

Luna debe agregar fixtures PG descartables011 y runner de barreras con dos
conexiones, que confirme bloqueo en `pg_locks/pg_stat_activity` antes de liberar
la primera sesión. No usar sleeps como prueba de que la segunda esperaba. Casos
en órdenes AB/BA: joints ancladas inversamente; switch A↔B; complete vs start;
close vs start/activity/private note; materialize vs close; approve rule vs
materialize; cancel coverage vs start/pause; assign head vs close; onboarding
vs close/weight update. Verificar 40P01 ausente, revalidación40001 esperada donde
corresponda, auditoría/receipt únicos y rollback completo. Conexiones/roles
descartables aislados, nunca base legacy ni cuenta productiva. Si no existe PG,
emitir escenarios y marcar **NO EJECUTADO**, sin bloquear la escritura local011
ni afirmar que pasó la puerta de concurrencia para producción.

Auditar definiciones finales con pg_get_functiondef después del upgrade011 y
probar que no quedan las keys bigint antiguas en ningún entry/core/helper de la
matriz, incluso009. No parsear y reemplazar bodies mediante strings durante una
migración: escribir CREATE OR REPLACE explícitos y revisar sus diffs.
Una RPC nueva no adquiere locks fuera del envelope, y un core anidado no llama
RPC pública. Ejecutar suite focal/full/build, preservación de datos010,
regresión008/009 y pruebas de permiso privado según contrato. Son puertas
diferentes: abstracto → laboratorioSQL → PostgreSQL real → Auth/UI real.

Referencias técnicas primarias verificadas: PostgreSQL Explicit Locking,
https://www.postgresql.org/docs/17/explicit-locking.html y pg_locks,
https://www.postgresql.org/docs/18/view-pg-locks.html. La garantía aquí depende
del orden total y de la sustitución completa de rutas, no sólo de advisory locks.
