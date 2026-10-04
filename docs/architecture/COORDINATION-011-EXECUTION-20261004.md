# B2b / 011 — contrato de activación coordinada

**Ejecución asignada: GPT-6 Luna, esfuerzo medio, Standard.** Contrato cerrado
por Sol el 04/10/2026. Antes de escribir, leerlo completo junto con AGENTS.md,
`COORDINATION-010-EXECUTION-20261004.md`, su implementación/revisión, el diseño
B (`COORDINATION-B-DESIGN-20261002.md`), contratos/migraciones 001–009,
`task-gateway.ts`, `task-contract.ts`, `timeliness.ts`, `reports.ts` y pruebas
del laboratorio. Si el esquema observado contradice este contrato, detener el
cambio, registrar el hecho y volver a Sol; no reinterpretar permisos, créditos,
estados de negocio ni recurrencias.

**Estado actualizado:** la ejecución se pausó antes de crear SQL011 al detectar
una inversión concreta entre locks de titular/actor heredados y el nuevo lock
común de participantes. Ver `COORDINATION-011-LOCK-REVIEW-20261004.md`. Este
contrato queda en suspenso hasta que Sol cierre y apruebe el protocolo; Luna no
debe ejecutar instrucciones de locks de esta versión sin esa corrección.

## Resultado requerido y límites

Crear `supabase/migrations/202610040011_coordination_activation.sql`, en una
transacción reversible, tipos de lectura/entrada Zod versionados, pruebas del
laboratorio `stages.m011`, y documentación de implementación/estado. Activa el
motor SQL local para conjuntos de responsabilidad conjunta y cobertura por tarea.
No aplicar migración remota; no integrar frontend/lector008; no crear Auth,
usuarios, hosting, email, tablas de negocio adicionales no indicadas aquí ni
publicar Site. No cambiar 001–010 ni editar migraciones aplicadas. Mantener
exactamente la audiencia live v43. El resultado aún no migra empleados ni hace
que la app demo sea producción.

011 no crea otro tipo de obligación: `task_instances.id` sigue siendo la
identidad única y empresa/asignación/período/título/snapshot de peso no se
fusionan por banco o similitud de texto. Las tareas habituales siguen sus
ocurrencias ya materializadas; sólo una tarea espontánea con frecuencia `unica`
puede tener dos responsables. La cobertura conserva la obligación titular y
concede ejecución temporal acotada, sin clonar tarea ni KPI.

## Tablas nuevas y restricciones

### `task_coverage_bindings`

Registro append-only por selección aprobada: `id uuid`, `organization_id`,
`plan_id`, `instance_id uuid nullable`, `assignment_id uuid nullable`,
`responsible_id`, `replacement_id`, `starts_on`, `ends_on`, `company_id_snapshot`,
`period_snapshot date nullable`, `scheduled_on_snapshot date nullable`,
`assignment_snapshot jsonb nullable`, `status active|cancelled|expired`,
`approved_by`, `approved_at`, `cancelled_by/at/reason nullable`, y fechas
auditables. Exactamente una de `instance_id` o `assignment_id` es no nula. FK
compuestas con organization para plan/ocurrencia/asignación/perfiles/empresa.
Índices por `(instance_id,status,starts_on,ends_on)` y por
`(assignment_id,status,starts_on,ends_on)`; no exclusión por titular que impida
cubrir selecciones distintas. Restricción/trigger serializado rechaza bindings
activos solapados de la misma ocurrencia+reemplazo cuando produzcan más de un
ejecutor sustituto, o más de una ocurrencia equivalente de la misma regla y
reemplazo. Cambiar responsable/rango/selección se hace cancelando y emitiendo
otro binding; no se edita historia. Expirar es derivado de fecha o un cambio
append-only consistente; no reescribe sesiones pasadas.

Los planes sellados010 se aprueban sólo mediante RPC nueva y se traducen a
bindings concretos. Una selección de ocurrencia queda ligada a ese `instance_id`
aunque su fecha programada no caiga dentro del rango: rango significa período
de reemplazo, no filtro retrospectivo de la obligación. Una regla snapshot crea
bindings únicamente para ocurrencias cuya fecha canónica `scheduled_on` cae
dentro de `[starts_on, ends_on]`; si la ocurrencia todavía no existe, crear
binding de regla y materializar el binding de instancia en la misma transacción
que esa ocurrencia. La identidad de la regla/versionado se valida contra el
snapshot010 y la asignación al aprobar y al materializar. No cambiar la fecha ni
el mes original de la ocurrencia.

Los bindings de cobertura nunca agregan filas a `task_responsibility_members` ni
cambian las cuotas. El responsable original conserva la obligación y sus puntos.
El reemplazo recibe autoría de sus sesiones/registros, marcados como cobertura,
no cuota ni crédito de resultado. Al cancelar antes del fin, no se crea binding
para el futuro; revocar acceso activo y parar su cronómetro se hace atómicamente.
Si el reemplazo coincide con un miembro conjunto, sus acciones cuentan una vez
como miembro responsable y no se duplican como cobertura.

### Contribución/sesión

Reemplazar el índice único actual `one_open_session_per_instance` por un índice
único de sesión abierta por `(instance_id, actor_id)` y conservar
`one_open_session_per_actor`. Ambos índices parciales son sólo para
`ended_at IS NULL`. Autorizar como máximo un reloj por persona, permitiendo dos
personas en una conjunta. Cada sesión conserva el actor Auth, la tarea, revisión
y timestamps; nunca copiar una fila de sesión al cerrar/cancelar. Inicio de
sesión registra contribución original o `coverage` y `binding_id` opcional en
columnas nuevas nullable o recurso append-only con FK: no recalificar una sesión
posterior si el vínculo cambia. Restricciones impiden mezclar actor y binding
incoherentes. Las sesiones viejas se backfillean como responsabilidad histórica
del owner/tarea según evidencia disponible; no inferir actor cuando falta,
inventar tiempo ni cambiar el hash/texto snapshot del cierre existente.

## Activación versionada de responsabilidad

Reemplazar la guarda de `task_responsibility_heads` para admitir INSERT de
baseline durante upgrade sólo donde falte y avance atómico de una revisión
sellada explícita exactamente `head.revision+1`. Sets y miembros sellados siguen
append-only. Validar conjunto y ocurrencia bajo locks; en modo conjunta exigir
dos miembros distintos, exactamente 10.000 bps y frecuencia `unica`. Una conjunta
nueva debe contener al owner/ancla actual; una transferencia sólo puede emitir
una revisión `individual` al nuevo responsable mediante RPC de traspaso explícito
separada, con evento y motivo, no por esta RPC conjunta. No admitir cambio de
company/period/team/sector snapshot ni de identidad de asignación. Perfil activo,
rol y empresa actual se validan al asignar; los snapshots históricos no se
actualizan después.

Crear RPC `assign_task_responsibility(p_instance,p_members jsonb,p_reason,
p_expected_revision,p_idempotency_key)` disponible al jefe, o a encargado sólo
si owner y todos los miembros son subordinados actuales del actor y pertenecen
al mismo ámbito de trabajo autorizado; ambos deben estar activos, tener perfil
operativo (`empleado` o `encargado`), tener membresía activa de empresa de esa
ocurrencia y no estar dados de baja. Jefe requiere sesión privilegiada/MFA AAL2.
Auditor/técnico de prueba no pasa roles reales ni adquiere escritura de trabajo.
La solicitud sólo crea conjunto para la tarea puntual, no tarea ni asignación.
Idempotencia usa receipt011 con actor, RPC, key y hash canónico; misma clave y
mismo cuerpo retorna resultado original, cuerpo distinto da conflicto. Replay
jamás salta autenticación, vigencia de perfil, ámbito ni cierre.

La tarea conjunta se crea como una sola instancia espontánea por la ruta ya
autorizada de tarea ad hoc y la asignación conjunta se hace en la misma
transacción antes de ser visible. No crear una tarea completa por participante.
Si el flujo heredado crea primero una instancia individual, sólo se permite
añadir el segundo miembro antes de actividad/sesión/checklist/progreso/cierre,
con expected revision; después de evidencia operativa no hay upgrade silencioso
a conjunta. Cambios posteriores requieren plan explícito que preserve evidencia.

## Aislamiento, RLS y contrato de lectura

Cada tabla nueva tiene RLS, ACL mínima y sin DML/SELECT directo para PUBLIC,
anon, authenticated o service_role. Helpers SECURITY DEFINER usan search_path
vacío, nombres calificados y EXECUTE revocado; solo RPC validada invoca helpers.
No confiar en `user_metadata`, actor/rol enviado por cliente, GUC seteable o
`BYPASSRLS` como autorización. Resolver actor por `auth.uid()` y pertenencia,
estado/rol y AAL actuales en base. La cuenta fantasma de laboratorio no obtiene
permisos operativos por su nombre o por ser owner de la conexión de test.

Sustituir helpers de autorización dentro de la misma migración (sin ventana de
política abierta) de modo que owner/manager/jefe sigan funcionando según008 y
una tarea coordinada admita miembro actual o reemplazo con binding vigente para
la fecha de escritura. Permiso de escritura por empresa y período además
comprueba que ese actor puede operar la compañía de esa instancia. Compartir una
tarea no habilita `profiles`, otras tareas, historial privado ni cierre del
perfil vecino. Comentarios 009 siguen sólo para su autor y superiores permitidos
por el contrato009; participación/cobertura no se interpreta como supervisión.
La tarea puede compartir título, empresa, estado/checklist y colaboradores
necesarios; notas privadas, texto de bloqueo reservado, reportes de otro usuario
y duración de sesiones ajenas no se revelan a participante empleado.

Mantener/ajustar policies de `task_instances` y `task_time_sessions` para que
miembro/reemplazo pueda consultar sólo los datos de su ocurrencia activa, sin
abrir fila de perfil. Empleado participante lee sus propias sesiones y estado
común, no actor/duración histórica de pares; encargado/jefe sólo ve sesiones
detalladas de personas en su ámbito jerárquico y con empresa autorizada. No
ampliar policy de profiles, `private_block_notes`, cierres, reportes u outbox.
Los RPC de lectura devuelven DTO por lista permitida, no `to_jsonb(profile)` ni
la fila indiscriminada `task_instances`.

Agregar contrato de lectura separado de `TaskInstanceSchema`008 con
`schemaVersion: 3`, `taskId`, campos seguros de ocurrencia, responsabilidad
versionada, `members[{profileId,displayName,shareBps}]`, `myContribution`,
`coverage:{kind,bindingId,startsOn,endsOn}|null`, y estado de vencimiento. No
incluir cuerpo de notas, texto privado de bloqueo, perfil completo, recibo,
secretos ni sesiones de otras personas. DTO de jefatura usa endpoint/función
separado y ámbito de permisos explícito. Validadores strict Zod rechazan campos
extra y UUID repetidos por valor canónico.

## Una transacción y conjunto determinista de locks para toda escritura

Todas las rutas que puedan afectar tareas coordinadas toman el mismo orden,
deduplicando y ordenando por UUID binario/canonical antes de bloquear:

1. advisory lock de receipts `(organization, actor, operation, idempotency_key)`;
2. todas las llaves `work-owner:<profile>:<YYYY-MM>` de cada participante activo,
   owner/ancla y sustituto cuyo crédito/evidencia/cierre puede cambiar, ordenadas
   por `(profile UUID, período)`;
3. todas las filas `task_instances` ordenadas por UUID;
4. todas las filas de cabeceras/head y binding/absence relevantes ordenadas por
   UUID;
5. todas las filas de sesiones actor-tarea ordenadas por `(instance,actor,id)`;
6. receipt/outbox bajo la protección ya adquirida.

Antes de esperar locks puede descubrir candidatos; después de adquirirlos vuelve
a consultar binding/head, estado Auth/perfil/relación/empresa, expected revision,
períodos y cierres. Si el conjunto afectado cambió, rollback con conflicto
reintentable y ningún efecto parcial. Cierres compiten usando las llaves del
mismo orden y cierran solamente el perfil solicitado, nunca a su compañero.
Cada escritura coordinada serializa la revisión/progreso y comprueba que ningún
período afectado esté cerrado. No introducir un orden alterno para cancelar una
cobertura, completar una conjunta o materializar.

La idempotencia/replay conserva recibos incluso al cerrar mes o revocar actor,
pero antes de devolver respuesta valida actor Auth igual al emisor y organización
vigente; no filtrará el resultado a otro usuario. Operaciones con expiración
temporal además devuelven resultado inocuo de expiración sin reactivar.

## Parche conjunto de todas las rutas escritoras existentes

Revisar la definición real en migraciones, no sólo la lista aquí. Reemplazar en
una migración todos los wrappers y subrutinas que mutan, sin dejar ruta antigua
como bypass. Las versiones de API mantienen parámetros/respuesta compatibles
con task-gateway008 donde el contrato de idempotencia lo permita:

`transition_task_reviewed`, `transition_task`; `set_checklist_item_reviewed`,
`set_checklist_item`; `set_task_wait`; `start_task_timer`, `pause_task_timer`;
`record_activity_once`, `record_activity`; creación/materialización de
asignación/ocurrencia; `approve_employee_absence`, cancelación/terminación de
ausencia; `close_employee_month`; aprobación de inducción cuando materializa
tareas; y mutación de pesos/plantillas. Buscar todas las funciones con
INSERT/UPDATE/DELETE de `task_instances`, `task_time_sessions`, `task_activity`,
`employee_absences`, `period_reports`, `task_assignments`, receipts y outbox.
Ningún wrapper SECURITY DEFINER antiguo queda EXECUTE para el cliente si no llama
al guard común. `service_role` tampoco se convierte en interfaz de producto.

- Transición, checklist, espera, actividad, reloj y revisión resuelven actor,
  empresa y binding/head vigentes bajo el lock; un participante no puede escribir
  progreso ajeno al suyo por enviar otro owner UUID. Un bloqueo privado usa RPC009.
- Checklist/progreso lo comparte la instancia única. Una operación idempotente
  conjunta se almacena una vez y no se duplica al leer dos tableros.
- `start_task_timer` puede coexistir con la sesión del compañero; conserva un
  único reloj activo por actor. `pause` termina sólo la sesión del actor, no el
  reloj de otro miembro. Para tarea a completar/reabrir, la operación autorizada
  termina cada sesión activa dentro de la transacción; las restricciones únicas
  finales se cumplen siempre.
- `transition` completa tarea de resultado sólo cuando el checklist exigible
  termina, desbloqueo resuelto y controles actuales se cumplen. Un miembro no
  puede reabrir tarea cerrada ni vencer un cierre sin rol superior y evento.
- Operativas no quedan completadas por un botón si el target requiere registros:
  se usa evidencia `task_activity`, unidad, período original y corte existentes;
  no convertir la cantidad del reemplazo en actividad del titular.
- `record_activity_once` conserva key/hash y actor real, exige periodo abierto y
  asignación/obligación adecuada; wrapper no idempotente se limita a usos
  heredados que sigan seguros o responde error de deprecación explícito, nunca
  omite locks. Cantidades de actividad de dos actores no crean dos tareas ni
  duplican el target.
- Pesos se mantienen snapshot por ocurrencia. Cambio de plantilla futuro no
  reescribe tareas ya creadas, reportes ni puntos ganados.
- `materialize_month` es idempotente por `(assignment_id, period)` y crea binding
  de regla aprobado sólo para `scheduled_on` comprendido en cobertura. Una
  asignación diaria/puntual ya consumida no reaparece; no mover vencimientos al
  próximo mes ni recurrencias semanales por defecto.
- Las rutas de ausencia antiguas siguen disponibles para periodos/selecciones
  legacy ya aprobadas y para revocar sus propios permisos. Nunca traducir una
  cobertura seleccionada nueva al grant amplio compañía/período de 004–008.
  Validar conflicto entre un grant legacy vigente y binding específico; aplicar
  intersección más restrictiva y mostrar la procedencia al gestor. No revocar
  ausencias históricas silenciosamente.
- Cancelar/revocar binding comprueba rol; para encargado ambos perfiles están en
  su ámbito/mismo equipo, para jefe AAL2 admite cruce. En una sola transacción
  marca revocación, para sesión actual del reemplazo en ocurrencias afectadas,
  registra motivo y prohíbe nuevas escrituras desde ese momento. No elimina
  auditoría ni trabajo ya evidenciado. Para terminar al rango natural, fecha
  final inclusiva según timezone de negocio `America/Argentina/Buenos_Aires`;
  convertir a instant UTC una sola vez; no comparar fechas con timezone local del
  navegador.

## KPI individuales, conjunto y reportes

No editar ni recalcular históricos `period_reports.schemaVersion=3` ni entregas
anteriores. Incorporar una versión nueva (documentar exacto schemaVersion4 para
el JSON que introduce atribución coordinada; preservar campos3 byte por byte en
filas viejas y mantener compatibilidad de lectura 3+4). Reporte4 contiene
`period`, `algorithmVersion`, `generatedAt`, una tabla de tareas únicas (por
`taskId`, una empresa/peso/vencimiento/estado/evidencia) y contribuciones
individuales separadas por perfil. Por task: peso global único, cuotas bps de la
revisión vigente a la fecha, resultado y timeliness únicos. Por miembro:
`weightedPossible=weight*shareBps/10000`, `weightedEarned` por estado/operativo
con misma fórmula de task modelo versionada, sesión/actividad propia, rol
`responsible|coverage`, tiempo actor, atribución explícita. Valores numéricos
están redondeados sólo al serializar; sumar decimales sin redondeo intermedio.

La contribución individual de score usa cuota explícita de responsabilidad, no
horas: miembro conjunto recibe `peso*cuota`; el denominador individual incluye
el peso por cuota. Cobertura mantiene la responsabilidad/obligación y su score
en el titular; la actividad/tiempo del reemplazo queda como contribución
operativa marcada cobertura, no le transfiere puntos de resultado. Gráfico
empresa/equipo/sector cuenta el peso y la tarea una sola vez; contribución
persona es una dimensión distinta. Las horas son siempre segundos reales por
actor, sin multiplicar ni repartir por porcentaje. Eficiencia temporal se
separa de puntuación (carga/peso) y tasa de anticipación. La llegada anticipada
se toma de `taskTimeliness`/evidencia actual y usa ocurrencia/vencimiento original;
no `now()` ni vencimiento del periodo vecino.

Controlar invariantes por cierre: para cada tarea, suma cuotas=10000; tarea
global aparece una vez; tareas+participaciones reportadas concilian con
`taskId`; sumar puntos concedidos por responsabilidad=score global por peso de
la misma tarea; el replacement no recibe peso al ser sólo cobertura; las
sesiones por actor concilian con sus filas auditadas; las métricas3 previas no
cambian. El responsable puede cerrar su periodo sólo cuando lo autorice rol
superior de acuerdo con la regla de producto vigente; empleado no cierra mes.
Jefe/encargado cierra únicamente perfiles permitidos. Cierre incluye su trabajo
propio y_snapshot inmutable; cerrar miembro A no cierra B. La misma tarea conjunta
se congela para ambas partes: no se escribe si cualquiera de sus períodos está
cerrado; cierre adquirido primero impide después el cierre conflictivo hasta que
una operación explícita de revisión/admin resuelva, no escritura escondida.

La generación/envío actual de reportes sigue transaccional con outbox, un reporte
por empleado al cierre y sólo a su jefe/encargado vigente según regla de entrega;
no hacer un envío SMTP desde SQL, ni prometer email mientras no exista proveedor.
011 graba fila/outbox local únicamente con idempotencia y snapshot versionado.

## Pruebas de aceptación obligatorias

Usar PGlite sólo para claims de secuencia/constraints/RLS simuladas, y marcar
concurrencia como pendiente de PostgreSQL real. Añadir `stages.m011`; conservar
defaults008–010. Incluir:

1. Upgrade poblado010 preserva digest/filas/datos de todas las tablas previas,
   sobre todo notas/versiones privadas, actividad, sesiones, cierres/reportes,
   receipts/outbox; snapshots de reporte3 exactos.
2. Asignación joint puntual autorizada crea revisión nueva; doble actor repetido,
   cuotas erróneas, actor inactive/wrong company/equipo, rol auditor, MFA ausente,
   replay con body distinto y key duplicada se rechazan sin filas/efectos.
3. No crear conjunta habitual; ancla requerida; conflicto de revisión y tarea con
   actividad/sesión impiden agregar miembro implícitamente.
4. Dos sesiones paralelas para miembros sí, dos para mismo actor no; actor puede
   pausar la propia; terminar/reabrir autorizado detiene todas; constraint de
   actor sigue activa; duración pasada no cambia por mutación posterior.
5. Plan de cobertura de IDs fuera/dentro del rango y reglas por fecha: snapshot
   no alterable; instancia nueva vinculada solo con fecha canónica dentro del
   rango y misma asignación/empresa; cambio de fecha/regla falla; sin tarea/credit
   duplicados. Solapamientos de la misma tarea fallan, tareas distintas del
   titular pueden solaparse.
6. Reemplazo puede hacer tarea seleccionada sólo dentro del rango, empresa,
   jerarquía y sesión Auth actuales; no ve ni actualiza tareas no elegidas,
   perfil titular completo, notes privadas, cierres ni sesiones históricas peer.
   Revocar durante sesión detiene reloj y bloquea siguiente write atómicamente;
   actividad y tiempo previo permanecen de actor real. Grant legacy no amplía un
   binding nuevo; datos legacy no se revocan.
7. Todas las RPC/wrappers anteriores usan orden de locks/recheck y no evaden
   autorización. `service_role` BYPASSRLS sin EXECUTE/grants de usuario tampoco
   tiene interfaz. `anon/authenticated` sin DML directo.
8. Caso dos personas y cobertura con checklist, target operativo, vencimiento,
   anticipo, atraso y periodo: tarea/weight/timeliness cuentan global una vez;
   KPI individual usa cuota; tiempo/actividad usa actor real; corte mensual
   conserva solo versión/atribución nueva en reporte4 y no altera reportes3.
9. Pruebas estructurales de orden de lock/rollback con barreras y asserts
   deterministas en laboratorio; no afirmar que un test unitario prueba carrera
   MVCC. Registrar conjunto que requiere Testcontainers/PG real antes de activar
   en Supabase.
10. Zod estricto separa DTO3/DTO4, cuotas, miembros y cobertura; no admite notas
    privadas, campos arbitrarios, fechas inválidas o perfiles extra.

Ejecutar suite focal, suite completa, `npm run build`, `git diff --check`; incluir
resumen de conteos reales. No debilitar asserts/constraints/RLS para arreglar
fixtures. Añadir diff allowlist que demuestre SQL001–010 y UI permanecen iguales.

## Salida y bloque siguiente

Commit y push de fuentes/código en Sites Git mediante su workflow; ningún nuevo
deploy, Site publish, `db push` ni migración remota en este bloque. Actualizar
README/AGENTS/EXECUTION-NEXT/PROJECT-STATUS y reporte de implementación.
Detenerse tras ejecutar contrato y review local; la fase posterior vuelve a
**GPT-6.1 Sol, esfuerzo alto**, para revisión de engine011, problemas de carrera,
contrato de Auth real e integración/cambio de contratos antes de frontend B4.
Mantener avance global 42% hasta que existan integraciones y aceptación funcional
end-to-end; las relaciones/motor locales no son app lista para empleados.
