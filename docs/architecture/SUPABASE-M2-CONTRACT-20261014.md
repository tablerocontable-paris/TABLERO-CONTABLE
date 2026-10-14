# M2: contrato de migración a Supabase

Fecha: 14/10/2026. Base inspeccionada: `8d95200f599b6188e041526507627f649d673940`,
rama `migration/github-bootstrap`. Estado: diseño y contratos, no implementación
ni aceptación de Supabase. M1 tiene commit y clonación de bundle comprobados.
La revisión M2 completó npm ci en otra clonación limpia: Node 24.19.0, npm
portable 12.2.0, 223 paquetes, 668/668 tests, TypeScript/build cliente/Worker y
paquete Sites aprobados. Evidencia: review-evidence/m2-architecture-contract-20261014.json.
La primera apertura en la PC personal sigue pendiente. Los tests originales de
M1 habían usado las dependencias existentes; no se atribuye esa instalación a M1.

El inventario está en `review-evidence/m2-source-inventory-20261014.json`:
90 fuentes con hash, 38 campos de State, 232 funciones/interfaces/tipos exportados del
dominio, 30 funciones nombradas de App, 70 llamadas sintácticas a persistencia,
14 migraciones de versión única y 230 definiciones SQL (incluye reemplazos).
Estos conteos son inventario estático; no prueban que una política sea correcta.

## 1. Decisiones que deben conservar todas las etapas

1. Postgres es la fuente de verdad de la versión operativa. React/Vite continúa.
   D1 y el State JSON de Sites no son un adaptador Supabase. El laboratorio
   conserva su entrada y respaldo propios hasta aceptar la nueva integración.
2. Se conservan las 14 migraciones existentes, sus nombres y bytes. Las nuevas
   son posteriores a `202610140012`; ningún import convierte IDs ficticios
   como `e0`, `c1` o `boss` en identidades Auth. Dev recibe fixtures sintéticos
   explícitos; no importa localStorage/IndexedDB de usuarios como producción.
3. El esquema expuesto de la nueva Data API será **api**. Las tablas existentes
   siguen en public; las nuevas tablas internas y helpers, en **app_private**.
   Public y graphql_public no se exponen por esa Data API. Esta configuración se
   comprobará en el proyecto real; un archivo SQL por sí solo no la acredita.
4. api sólo expone funciones concretas de contexto, consulta y comando. No hay
   escritura de tablas desde navegador ni endpoint para guardar State completo.
   RLS y permisos de cada comando se prueban también sin pasar por la interfaz.
5. Se conserva la separación consultar/gestionar/ejecutar. Actor = auth.uid();
   ownerId/subjectId sólo seleccionan trabajo. Nunca se acepta actor, rol,
   organización, coeficiente efectivo, autor de auditoría o tiempo de servidor
   como autoridad proporcionada por el cliente.
6. No se activa el frontend operativo hasta alcanzar paridad de todos los
   módulos habilitados. Cada bloque nuevo puede probarse sin cambiar main.tsx.
   Un error de configuración/autenticación no abre una simulación de reemplazo.
7. No se crean cuentas reales de empleados ni invitaciones por este contrato.
   Las pruebas Auth futuras usan cuentas sintéticas sin envío de correo.

## 2. Identidad y permisos

Se mantiene profiles.id = auth.users.id para las personas de negocio. Los roles
operativos son empleado, encargado y jefe. El valor SQL histórico auditor no
obtiene permisos nuevos ni entra en la UI operativa: contexto denegado hasta un
contrato específico. No se lo usa para el administrador técnico.

Una cuenta técnica vive en app_private.technical_accounts, ligada a auth.users
y a una organización, sin fila en profiles, tareas, cuotas ni KPI. No puede
coexistir como perfil de negocio con el mismo UUID. Puede abrir el contexto
técnico y funciones de mantenimiento explícitamente contratadas; no obtiene
consultas de trabajo ni acceso a anotaciones. La propiedad administrativa de
un proyecto Supabase puede permitir acceso de infraestructura a datos; la
privacidad descrita aquí se aplica a los roles de la app, sin prometer cifrado
de extremo a extremo frente al propietario del proveedor.

Roles, jerarquía y membresías se leen de tablas vigentes en cada operación;
no se confía en user_metadata ni en roles obsoletos de un JWT. Jefe abarca su
organización; encargado, su equipo jerárquico y empresas autorizadas. Se
conserva team_members multiequipo en los DTO; no se reduce a un teamId único.
La cobertura habilita sólo las tareas y fechas selladas en el binding vigente.

| Recurso/acción | Empleado | Encargado | Jefe | Técnico |
| --- | --- | --- | --- | --- |
| Trabajo y datos mínimos de personas | Propios/participación/cobertura | Propios + equipo y empresas | Organización | No |
| Cronómetro, controles, finalización y movimientos | Sólo ejecutor autorizado | Misma regla; supervisar no basta | Misma regla; supervisar no basta | No |
| Tarea puntual/asignación/reprogramación/comentario | Sus acciones permitidas | Gestión dentro de su ámbito | Gestión de organización | No |
| Catálogo, pesos, recurrencias, bajas/traspasos y cierres | No | No | Sí | No |
| Calidad operativa y configuración comercial/dependencias | No | No | Sí | No |
| Anotaciones, fórmulas, recordatorios y su borrador | Sólo autor | Sólo autor | Sólo autor | No |
| Presencia de otra persona | No | Equipo/empresas autorizados | Organización | No |
| Estado de despliegue sin contenido de negocio | No | No | No | Función explícita futura |

La nota de bloqueo de SQL 009 es **otro recurso**: autor y superiores
autorizados según su contrato anterior. No alimenta Anotaciones ni se renombra
como nota personal. Las notas personales nuevas tienen tabla, DTO y RPC propios.
La conversión de una nota a tarea copia sólo los campos que confirma su autor;
el vínculo inverso de la nota jamás se publica en el DTO compartido de la tarea.

Auth usará email/contraseña, recuperación y MFA TOTP. Se permite contexto mínimo
aal1 para enrolar/desafiar MFA; jefes, encargados y técnicos requieren aal2 para
abrir datos operativos o funciones privilegiadas. Empleados usan aal1 con MFA
opcional. Ningún signup público elige roles. El bootstrap inicial se ejecuta
una vez mediante herramienta administrativa con destino/verificación de Auth
explícitos; no mediante una página pública ni un trigger que otorgue jefatura.
La desactivación se verifica en DB en cada lectura/escritura. Salir limpia sesión
y cachés del cliente; un JWT emitido puede durar hasta expirar. No se promete
revocación instantánea del token sólo por cerrar sesión.

## 3. Protocolo nuevo y consistencia

- api.get_context_v1() devuelve sólo el contexto propio descrito en M2.1.
- api.heartbeat_v1(), desde M2.4, registra sólo señal del principal de negocio
  autenticado y su session_id. Es señal efímera, sin recibos/auditoría de trabajo;
  limita escrituras a una por 15 segundos/sesión y devuelve su sello de servidor.
- api.query_v1(p_query jsonb): kind allowlistado, filtros/cursores estrictos y
  proyección DTO por módulo. Páginas de hasta 100 elementos, orden estable
  `(clave,id)`, cursor opaco validado y filtros ligados al cursor. Contexto y
  selección ajena siempre se vuelven a autorizar; no se hace SELECT * de State.
- api.command_v1(p_envelope jsonb): `{contractVersion:1, operationId:uuid,
  kind, expectedRevisions:{entityKey:decimalString}, payload}`. Cada kind tiene
  su esquema estricto. Rechazar claves ajenas, tamaños fuera de límite y comandos
  no implementados; no crear handlers vacíos que devuelvan éxito.
- Revisiones bigint se transportan como cadenas decimales, nunca redondeadas
  en Number. UUID es identidad, no permiso. Fechas civiles son YYYY-MM-DD;
  períodos, primer día del mes; instantes, timestamptz de servidor. ART para
  reglas diarias. El día comercial 0–30 no es una fecha de calendario.
- Cantidades de movimientos: entero 1..1.000.000. Coeficientes: numeric(20,6),
  >0 y <=1.000.000. Totales y cantidades monetarias/ponderadas se transportan
  como decimalString; los gráficos convierten sólo tras validar rango finito.
- Recibo único por actor+operationId: kind y argumentos jsonb canónicos se
  comparan completos. Repetición exacta devuelve el mismo resultado; parámetros
  distintos, conflicto. Auditoría, avisos y resultados se confirman juntos.
- Antes de devolver un recibo se comprueba identidad y autorización vigente.
  Si el permiso fue revocado, no se devuelve un DTO antiguo con datos privados.
  Una consulta de recibo propia sólo confirma el resultado que aún puede leer.
- Un resultado ambiguo de red conserva operationId y formulario; se consulta el
  recibo y se reintenta con el mismo ID. No interpretar timeout como rollback.
  Un conflicto de revisión exige releer y nueva decisión; no sobrescritura ciega.
- Categorías cliente: validation, unauthenticated, forbidden, conflict,
  closed_unit, not_ready, storage, protocol, transport/ambiguous. Nunca enviar
  SQL, secretos o payloads privados en errores/logs. SQLSTATE 40001 se conserva
  como conflicto reintentable con autorización y revisión renovadas.

No modificar el orden de locks de 011: recibo (1101), actores (1102), perfiles
(1103), meses persona/período (1104), catálogo (1105), después filas en su orden
canónico. Las unidades por empresa siguen bajo esos locks de mes, aunque eso
serialice empresas de una persona: se prioriza consistencia. Preparar todas las
referencias antes de adquirir; tras esperar revalidar ampliaciones/reducciones,
roles, empresas, dependencias y cierres. Si cambió el plan, 40001 antes de writes.
No adquirir locks de un orden anterior dentro de un helper anidado.

Las nuevas funciones definer tienen search_path vacío, nombres cualificados,
autorización interna y grants de ejecución explícitos. Defaults cerrados para
nuevos esquemas; no usar un REVOKE masivo de helpers antiguos sin revisar las
políticas que los invocan. Los RPC antiguos permanecen como contrato histórico
aislado; la nueva app sólo llama api. La activación exige demostrar que public
no puede elegirse mediante Accept-Profile/Content-Profile en la Data API.

## 4. Inventario de módulos y comandos que debe portar Luna

En la tabla, cada nombre es un kind del protocolo nuevo. create/save/edit incluye
expectedRevision si modifica un recurso existente, motivo cuando lo exige el
dominio e idempotencia. Ningún comando admite State o un resultado calculado por
el navegador. Las funciones puras inventariadas se reutilizan como referencia
de cálculo, no como control de autorización del servidor.

| Área y fuente | Consultas | Comandos | Tablas nuevas/reutilizadas y alcance |
| --- | --- | --- | --- |
| Equipo/estructura, workforce.ts | directory, employeeWork, presence | profile.update, profile.deactivate, work.reassign, work.transfer | profiles, teams, team_members, company_memberships; historial de bajas/huérfanos/traspasos nuevo. Jefe cambia estructura; consultas de trabajo no cambian actor |
| Inducción y parámetros, parameterization.ts/habitualTaskProposals.ts | ownOnboarding, parameterInbox, proposals | onboarding.saveDraft, onboarding.submit, onboarding.requestChanges, onboarding.approve, parameters.confirm, proposal.submit, proposal.resubmit, proposal.requestChanges, proposal.approve | Tablas onboarding existentes + propuestas/versiones; borrador sólo autor; revisiones/sumisión se proyectan al jefe sin datos privados ajenos |
| Catálogo, processImprovement.ts/catalogue.ts | cataloguePage, catalogueHistory | catalogue.create, catalogue.revise, catalogue.weight | task_templates/task_template_versions; vigencia/snapshot/razón, jefe; no reescribir instancias/cierres |
| Planificación, planning.ts/schedule.ts | assignmentPage, recurrencePreview | assignment.create, assignment.revise, month.materialize | task_assignments/instances; versionar reglas; jefe; validar frecuencia, fecha y dependencias/referencias antes de reemplazar futuras instancias limpias |
| Tareas, model.ts/App.tsx | taskPage, taskDetail, taskSearch, blockNote separada | task.createOneOff, task.transition, task.check, task.wait, task.reschedule, task.weight, task.blockNote.save | task_instances y recurso SQL009 conservado; creación por responsable o superior de ámbito; pesos sólo jefe; ejecución sólo responsable/participante/cobertura. Superiores no completan por consultar; nota de bloqueo conserva su autorización propia |
| Tiempo, workforce.ts | ownClock, sessionPage, ownTimeSummary | timer.start, timer.pause | task_time_sessions; un reloj activo por actor; conservar origen/binding/corte; switch transaccional no detiene reloj ajeno |
| Conjuntas, coordination.ts | responsibilityDetail | responsibility.assign | sets/members/heads existentes, dos participantes/10.000 bps; sólo entregables; conservar acuses/versiones |
| Ausencias/cobertura, workforce.ts | absencePage, coveragePreview | absence.approve, absence.cancel, coverage.approvePlan, coverage.cancelBinding | absences y planes/bindings existentes; no exponer observación privada en calendario ni trasvasar tiempo/puntos al dueño |
| Operativas, laboratory-work.ts | activityPage, operationalSummary, rateHistory, quality | operation.record, operation.rate, operation.assess | activity_entries ampliada; operational_rates, assessments + versiones; ejecución autorizada, parametrización/evaluación jefe |
| Seguimiento y Mi día, laboratory-work.ts | suggestedRoute, readiness | task.commercialMode, task.commercialProgress, task.dependencies | task tracking + task_dependencies; configuración jefe, avance ejecutor; sugerencia sin side effects |
| Calendario/obligaciones, fiscalObligations.ts/laboratory-work.ts | calendarRange, dayAgenda, fiscalObligations | calendar.create, calendar.edit, calendar.cancel, obligation.create, obligation.revise | calendar_events/recipients/revisions; fiscal_obligations/revisions/task_links; derivados consultan origen, no copias editables |
| Avisos/comentarios, notifications.ts/deadlineNotifications.ts | notificationPage, taskComments, dueReminders | notification.read, reminder.read, comment.add | work_notifications, task_comments, reminder_reads; destinatario propio, acceso vigente a tarea; autor real y fanout transaccional |
| Consultas/pedidos, internalRequests.ts | requestPage, requestThread | request.create, request.reply, request.status, request.convert | internal_requests/messages/events; autor, destinatario y jefe; técnico sólo errores técnicos dirigidos a su cola, sin adjuntar datos de tareas automáticamente |
| Anotaciones, App.tsx | ownAnnotations | annotation.save, annotation.delete, annotation.convert | personal_annotations/versiones; exclusivamente autor, incluida búsqueda; conversión atómica a tarea autorizada y vínculo privado |
| Mejora de procesos, processImprovement.ts | improvementPage, fiveSPage | improvement.propose, improvement.review, improvement.measure, improvement.decide, fiveS.create, fiveS.completeAction | kaizen_proposals/events, five_s_reviews/items; mismas etapas/ámbito actual, adopción de catálogo sólo jefe y versión nueva |
| Cierre/reportes, laboratory-work.ts/reports.ts/closedHistory.ts | closePreview, closurePage, report, analytics | close.batch | company_closures, closure_batches/results y contribuciones; monthly_closures y period_reports históricos conservados; sólo jefe cierra |
| Evidencia, laboratoryEvidence.ts | evidenceMetadata, evidenceDownload | evidence.reserve, evidence.verify; asociación dentro de operation.record/task.transition/task.check | task_evidence/upload_reservations + Storage privado; hasta 3 por movimiento/finalización; sin reemplazo silencioso |
| Preferencias/recorrido, App.tsx | ownPreferences | preference.save, tour.save | user_preferences/tour_progress sólo autor; no confundir con notas/identidad |

task.createOneOff conserva controles de conversión/creación: empleado sólo su
empresa asignada y tarea puntual, peso provisional de entregable 1 pendiente
de parametrización; superior dentro de ámbito. Las reglas recurrentes y el
catálogo requieren jefe. Responsabilidad conjunta sólo mediante su comando.
El arrastre combina una transición autorizada con orden personal: la animación
puede previsualizar, pero no salta checklist, confirmación comercial o permisos.
Un fallo restaura la tarjeta; el orden personal no reescribe tareas compartidas.

Cobertura de los 38 campos State (ninguno viaja como snapshot compartido):

- companies/teams/profiles → directorio; templates/catalogueVersions → catálogo;
  assignments/tasks/activity → comandos de trabajo; audit → eventos de servidor.
- absences/orphanedWork/taskTransfers → cobertura/bajas; jointReceipts → recibos
  de responsabilidad; closures/companyClosures → cierres/reportes.
- onboarding/parameterReviews/habitualTaskProposals → inducción/parámetros;
  improvementProposals/fiveSReviews → mejora de procesos.
- operationalRates/operationalAssessments → carga/calidad; taskEvidence → Storage;
  fiscalObligations/calendarEvents/calendarNotices → agenda y avisos.
- notifications/taskComments/deadlineReminderReads → avisos/hilos/lecturas;
  internalRequests → consultas; annotations → recurso personal aislado.
- boardOrder/tour/tourVersion/tourStepId → preferencias propias. Apariencia y
  pliegues pueden seguir locales, con clave usuario+entorno, sin permiso de datos.
- activeId se elimina del protocolo: actor Auth; subject de consulta va en filtro.
  version y labRevision siguen sólo en respaldo/laboratorio; contrato/revisiones
  remotos son independientes.

## 5. Reglas de los bloques con diferencias de contrato

### Operativas e historia

Añadir measurement_version a catálogo/asignación/instancia: legacy_target_v1
para filas existentes, movements_v2 para las nuevas. Las metas y pesos legacy
quedan intactos; v2 exige unidad, permite target NULL, jamás tiene finalización
por cantidad y queda fuera del cumplimiento de entregables. Los DTO distinguen
la definición; no convierten target=0 en una meta válida del esquema anterior.
Los entrypoints de onboarding/catálogo/materialización se amplían juntos.

operational_rates: UUID/organización/empresa, exactamente template_id o task_id,
effective_on, unit_weight, versión secuencial por ámbito, created_by/at. Versiones
inmutables; prioridad tarea sobre catálogo; vigencia por work_date, desempate por
effective_on/version/created_at, como el laboratorio. Guardar un movimiento
selecciona el coeficiente dentro de la transacción y conserva ID+valor o ambos
NULL. Sin coeficiente: cantidad/tiempo válidos, carga pendiente. No reinterpretar
weight antiguo como coeficiente. Nuevas parametrizaciones no recalculan entradas.
Referencia vacía se normaliza a NULL; adjunto/referencia no cambian puntuación.

Assessments: única versión vigente por task_id, historial inmutable; quality,
order,timeliness enteros 0..100; observación 5..1000; sólo jefe, operativa
individual y unidad abierta. NULL/sin fila significa sin evaluar; 0 es evaluación.
Cumplimiento y puntualidad calculan sobre entregables; carga y calidad operativas
son dimensiones independientes. Cada snapshot nuevo guarda calculation_version
y entradas utilizadas. Los informes legacy se leen con su fórmula original.

### Seguimiento y dependencias

Modo comercial sólo en entregable individual; jefe habilita/deshabilita, ejecutor
autorizado registra through_day entero 0..30 del período. Día 30 sólo propone
finalización: comando explícito, confirmación, controles, disponibilidad y unidad
abierta. No crear fecha civil desde ese número. Guardar progreso en completada
se rechaza; reapertura requiere su comando/motivo antes de retroceder progreso.

Dependencias sólo configuradas por jefe: IDs únicos, existentes, entregables de
la misma empresa/período, sin autoenlace ni ciclos; entrega conjunta no recibe
esta configuración nueva. Actualización del grafo toma lock de catálogo
`dependencies:<organization>:<company>:<period>` en el conjunto 1105 preparado,
antes de filas; prueba concurrente A→B/B→A debe impedir el ciclo. available_from
es fecha civil del período; espera explícita nunca se levanta sólo por fecha.
Al leer, títulos de dependencias fuera de ámbito se sustituyen por explicación
genérica. Ruta: habilitadas primero, vencimiento, prioridad Alta/Media/Baja, peso
descendente, scheduled_on e ID ascendente para desempate; filtros vigentes y
fecha ART del servidor. Sin iniciar tareas/relojes automáticamente.

### Cierre por persona/empresa/mes

company_closures tiene UNIQUE(owner_id,company_id,period), snapshot versionado,
hash, actor/fecha/motivo y contribuciones propias de cobertura. Referencias de
evidencia retenidas. Un monthly_closure legacy cubre todas las empresas sin
fabricar cierres nuevos históricos. El nuevo consolidado de persona se crea una
vez cuando estén cerradas todas las empresas con trabajo/contribuciones del
período; lista exacta de unidades y hash quedan en el reporte.

closePreview resuelve all/team/company/person a unidades explícitas (máximo 100)
y muestra pendientes y revisiones. close.batch recibe esa lista exacta y motivo;
no amplía selección al confirmar. Deriva grupos conexos por entregables conjuntos;
un grupo debe estar completo en la selección y listo para cerrarse atómicamente.
Adquiere el superset de locks de TODOS los grupos en orden global antes de filas;
revalida y procesa cada grupo con subtransacción. Devuelve cerradas, ya cerradas y
pendientes con motivos. Fallo de infraestructura revierte la transacción global;
un recibo perdido se recupera con el mismo operationId. No duplicar reportes/avisos.

Bloqueadores: actor/perfil inactivo, mes futuro, ausencia de trabajo, reloj activo,
conjunta no revisada/completada, cambios de ámbito/revisión y motivo inválido.
No completar tareas pendientes para cerrar. Cerrar una empresa no bloquea otra;
cerrar contribución de cobertura no congela futuras acciones del responsable en
su unidad abierta. Controles/tiempos/actividad nuevos comprueban unidades de
responsables y del ejecutor aplicables. Los writers antiguos quedan protegidos
frente a modificar datos referenciados por un cierre nuevo mediante guards de DB;
no basta con actualizar sólo el endpoint nuevo de cierre.

### Calendario, comunicación y privacidad

Cada evento manual tiene organización, autor, empresa nullable, tipo, título,
descripción, rango civil, revision, destinatarios y vínculo nullable a tarea.
Autor/superiores autorizados administran; destinatarios leen. Todos pueden crear
dentro de ámbito. Todos en el selector significa sólo elegibles. Destinatarios
obligatorios = autor y superiores vigentes autorizados, visibles en preview y
recalculados al guardar. No aceptar un recipientId técnico/ajeno arbitrario.
Un vínculo a tarea no otorga permiso sobre esa tarea. Antiguos destinatarios
retirados reciben sólo un aviso genérico de retiro/cancelación sin nuevo contenido.
Fechas derivadas de tarea/obligación/ausencia se consultan, no se duplican.
Ausencia muestra persona, intervalo y cobertura autorizada; no su observación.

Avisos durables por destinatario+evento+revisión en la misma transacción que el
cambio; leer aviso no permite leer tarea que dejó de estar autorizada. Comentario
es trabajo compartido, no nota personal. Recordatorios son proyecciones derivadas
con lectura propia; la clave incluye revisión/fecha del origen para no ocultar
un vencimiento modificado. Outbox de correo sigue sin consumidor/envío real.

Realtime sólo avisa invalidación/cursor para el usuario autorizado, sin nombres,
textos, tareas o notas en el payload. El cliente vuelve a consultar la API con
permisos vigentes. Canales privados con RLS; reconexión y cambios de sesión vacían
cachés. Respuestas iniciadas bajo otra sesión/actor/ámbito se descartan aunque
lleguen después; no pueden repoblar una vista nueva. Presencia fiable viene de
heartbeat de servidor (cada 30s, TTL 90s),
identidad/sesión JWT derivadas; no de `track({profileId})` ni del cronómetro. Varias
pestañas/sesiones se consolidan por persona sin inflar tiempo. No es KPI.

Pedidos: autor/destinatario/jefe; técnico sólo technical_error explícitamente
dirigido a su cuenta, nunca recibe contexto de tareas/notas automáticamente.
Conversión sólo jefe y work_request: creación puntual, vínculo e historial
atómicos. Kaizen/5S conservan transiciones, responsables y evidencias textuales;
adoptar crea una versión de catálogo con vigencia, sin reescribir trabajo anterior.

### Evidencia y recuperación

Bucket privado task-evidence; objetos inmutables con rutas UUID derivadas en
servidor. RLS relaciona objeto con reserva o evidencia autorizada, sin permisos
de listado general. Sin bucket público, upsert ni URL pública persistida.
Límites por movimiento/finalización: 3 archivos; imagen JPEG/PNG/WebP <=5 MiB,
PDF <=10 MiB. Optimización local conserva legibilidad; servidor verifica tamaño,
firma de formato/MIME y SHA-256 leyendo el objeto, no confiando en el hash cliente.

Flujo: reserve (15 minutos, actor/tarea/propósito) → upload autenticado al objeto
exacto → Edge verifier autorizado → evidencia ready → comando de trabajo liga
IDs verificados de ese actor/propósito. Verificador no acepta una ruta libre;
resuelve la reserva y sólo usa secreto del servidor después de autorizar.
Finalización tiene un completion_event_id estable para cada reapertura/cierre,
no sólo un timestamp. La asociación y el evento de trabajo son transaccionales;
no se revierte un movimiento confirmado porque falle un aviso de red.

Storage y Postgres no forman una transacción distribuida: reservas/estados y
compensación evitan referencias a objetos inexistentes. Limpieza idempotente de
pendientes vencidos sólo tras revalidar referencias; evidencia de cierre nunca
se purga automáticamente. Descarga autenticada con autorización vigente; no
generar enlaces firmados de larga duración que sobrevivan cambios de permisos.

Respaldo v1/v2 del laboratorio continúa aislado. El respaldo operativo incluye
DB+objetos+manifiesto/hashes+versiones en destino privado, sin credenciales,
se verifica restaurando en entorno aislado y no mediante importar State del lab.
No llamar backup completo a pg_dump sin los archivos de Storage ni a una copia
que jamás se restauró. Restaurar producción requiere plan concreto y autorización.

## 6. Orden de implementación y aceptación

| Bloque | Entrega | Gate antes del siguiente |
| --- | --- | --- |
| **M2.1 / 013** | Identidad separada, esquemas API/privado y contrato de contexto. Contrato ejecutable en M2-1-IDENTITY-LUNA-20261014.md | Base vacía y upgrade hasta012; permisos y contexto; bytes/snapshots anteriores iguales |
| M2.2 / 014 | Operativas v2, coeficientes/calidad, seguimiento/dependencias; DTO/entrypoints de onboarding/catálogo compatibles | Cálculo legacy/v2, referencia vacía, sin coeficiente, snapshots, ciclos concurrentes, 0/30/30, ejecución vs gestión |
| M2.3 / 015 | Cierres por empresa, guards, reportes y recibos por grupos | Casos parciales/reintentos, uniones conjuntas, cobertura, writers viejos, dos sesiones PostgreSQL |
| M2.4 / 016 | Calendario, obligaciones, comentarios, avisos, presencia/outbox | Ámbito/privacidad, destinatarios retirados, dos usuarios, heartbeat y TTL; cero correo real |
| M2.5 / 017 | Notas personales, pedidos, propuestas, Kaizen/5S, bajas, preferencias y revisiones recurrentes | Matriz completa; conversiones atómicas; futuro sin perder referencias ni historia |
| M2.6 / 018 | Storage/reservas/verificador/retención y restore operativo | Límites, formato/hash falso, carrera cierre/borrado, cuota agotada, recuperación real en dev |
| M2.7 / 019 + cliente | DTO de todos los módulos, Auth/MFA, queries/comandos y Shell Supabase | Paridad de las 38 propiedades por comportamiento, sin State compartido, sin suplantación ni notas ajenas |

Los números se reservan en este diseño; antes de crear un archivo verificar
que no exista una migración posterior en la rama. Cada bloque vuelve a revisión
Sol. La tabla fija la arquitectura; **sólo M2.1 está desglosado como contrato de
implementación inmediato**. Luna no debe inventar el detalle pendiente de los
otros bloques ni implementarlos de una vez con mocks que aparenten paridad.

Aceptación común: catálogo de comandos/DTO/grants contrastado con este inventario;
tests positivos y negativos por rol/empresa/organización; anon/técnico/auditor
excluidos; recibos y SQLSTATE; upgrade poblado y snapshots por bytes; SQL real
con sesiones concurrentes para carreras. PGlite y JWT simulados no aceptan
Supabase Auth/MFA/Storage/Realtime reales. El gate alojado se registra aparte.

## 7. Infraestructura y lo que aún requiere cuentas

GitHub NUEVO privado: preservar main baseline, subir la rama de integración y
abrir PR; no poner el producto sin contrato en main sólo para facilitar setup.
CI usa npm ci, tests/build y prueba de migraciones desde cero/upgrade. Los checks
reales de GitHub todavía no corrieron. La clonación e instalación npm limpia
ya pasaron localmente en M2; eso no verifica el runner Linux ni su workflow.

Supabase dev/prod con refs distintas verificadas en configuración de entorno;
la variable dev nunca comparte ref con prod. CLI versionada en CI; db push
serializado por entorno desde merge, migration list y hashes antes/después.
Un PR prueba una DB efímera, no migra dev compartido. No migration repair ni
SQL manual como respuesta automática a un drift: falla y se diagnostica.
Primero preparar contratos y pruebas locales; las cuentas son necesarias cuando
se creen recursos y se pruebe Auth/Storage/Realtime contra el proveedor.

Cloudflare Workers Static Assets continúa como destino; Access debe proteger
tráfico dev y previews antes del primer contenido. El pipeline de M3 ordena
migración → deploy del mismo commit → health check, con app compatible con la
ventana de esquema. No conectar un auto deploy paralelo que cambie ese orden.
Protecciones de PR en repos privados dependen del plan real de GitHub: verificar
su enforcement y coste antes de prometer auto merge protegido. No contratar.

El ~45% sigue siendo estimación histórica. Diseño, empaquetado y tests locales
no equivalen al 100% definido por el usuario. Quedan aceptación humana,
implementación/validación de estos contratos y operación propia comprobada.

## Fuentes primarias verificadas 14/10/2026

- Funciones y grants: https://supabase.com/docs/guides/database/functions
- RLS/identidad: https://supabase.com/docs/guides/database/postgres/row-level-security
- Esquemas expuestos: https://supabase.com/docs/guides/api/using-custom-schemas
- MFA y sesiones: https://supabase.com/docs/guides/auth/auth-mfa y https://supabase.com/docs/guides/auth/sessions
- Storage: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Realtime: https://supabase.com/docs/guides/realtime/authorization
- Entornos/migraciones CI: https://supabase.com/docs/guides/deployment/managing-environments y https://supabase.com/docs/guides/deployment/database-migrations

Las reglas específicas de negocio y el orden de bloques son decisiones de este
proyecto; las fuentes describen mecanismos del proveedor, no prueban nuestro código.
