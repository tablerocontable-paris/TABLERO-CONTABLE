# M2.2B/C: contrato ejecutable de seguimiento y creación

Fecha: 16/10/2026. Base inspeccionada: `3af0f943d55da95e5940f3e666198985999aceb4`.
Implementación: GPT-6 Luna, esfuerzo medio, Standard; aceptación independiente:
GPT-6.1 Sol, esfuerzo alto, Standard. Este documento define trabajo; no acredita
implementación, aplicación de SQL, Auth real ni paridad de toda la aplicación.

## 1. Precedencia, alcance y destino

- Completa `SUPABASE-M2-CONTRACT-20261014.md` y los contratos/correcciones de A.
  A/R7-R8 tiene revisión local favorable; conservar su protocolo y regresiones.
  La aceptación formal y evidencia de ese corte se registran por separado.
- B = seguimiento comercial, disponibilidad, grafo y recorrido sugerido, con
  controles de ejecución/completado en servidor. C = catálogo, inducción,
  creación y materialización compatibles con operativas sin meta.
- Extender únicamente la **014 local todavía no aplicada**, DTO nuevos,
  helpers/runners/pruebas y documentos del corte. Preservar bytes de001–013,
  entrada del laboratorio, UI, `src/data/remote`, Worker/D1 y Site privado.
  No crear015 ni instalar dependencias para este bloque.
- Git vigente: repositorio privado `tablerocontable-paris/TABLERO-CONTABLE`,
  push directo a `main`; no PR, rama `dev` ni autoaplicación por integración.
- Destino declarado por coordinación: `grupo-paris-dev`, ref
  `kynqjfhqujnjojcmurwf`, sano y vacío. Releer ID/estado/esquema antes de una
  futura aplicación: esta declaración no reemplaza esa comprobación.
  **No conectar su integración GitHub**: puede aplicar014 incompleta.
- Intención futura de nombres Supabase: renombrar la organización actual a
  `dev` y crear una segunda organización llamada `main` al configurar ese
  entorno. Hoy el proyecto es `grupo-paris-dev` y la organización visible es
  `tablerocontable-paris DEV`; no ejecutar ahora el renombre ni crear la segunda.
  Los IDs y refs reales deberán releerse antes de cualquier gate futuro.
- Hallazgo del Dashboard comunicado por coordinación16/10: Data API instalada,
  exposed schemas=`public,extensions` (2 de2) y «Automatically expose new tables»
  activado; todavía sin tablas/migraciones de negocio. No cumple el destino
  sóloapi. El propietario autorizó «Sí, apagarla ahora»; no se ejecutó porque
  falló la observación de la URL del Dashboard bajo policy de Windows. No hay
  confirmación del valor actual ni del cambio; queda pendiente actuar con
  control verificable. No asumir que se apagó.
- Primero B local y revisión, luego C local y revisión integral A/B/C. Sólo
  después puede prepararse/aplicarse el paquete completo a ese dev para el gate
  alojado de §9. Producción, cuentas/invitaciones reales y cliente operativo
  siguen deshabilitados. A/B/C completa M2.2, no M2.3–M2.7 ni el producto final.

## 2. Base que debe reutilizarse

Hay16 archivos de migración hasta014: los sufijos históricos001/002 aparecen en
distintas fechas; conservar nombres y orden completo, no seleccionar por sufijo.
011 contiene las últimas bases de coordinación, cobertura, cronómetros y cierre;
012 reemplaza guards/DTO e inducción;013 separa principal técnico y de negocio;
014 añade el protocolo nuevo, cantidades v2, tasas/calidad y fences.

Los writers activos de referencia son `_coordination_apply_task_control`,
`start_task_timer`, `assign_task_responsibility`, `_coordination_materialize_core`,
`materialize_month`, `create_catalog_assignment`, `create_task_template`,
`update_template_weight` y `approve_onboarding`. Revisar también wrappers de
checklist/transición/espera y los recibos legacy antes de cambiar su núcleo.
No invocar un wrapper que tome1101 después de haber adquirido1102–1105/filas.

`main.tsx` abre `LaboratoryWorkspace`. `site-worker.ts`/`site-client.ts` usan
identidad Sites y State/D1; no son transporte Supabase. Los DTO de
`src/data/remote/task-contract.ts` esperan peso/meta legacy y no se adaptan
indirectamente. B/C entrega contratos Zod bajo `src/data/supabase`, sin cliente
global, login ni sustitución de entradas. La integración visual queda enM2.7.

## 3. Reglas comunes de API, permisos y coordinación

Conservar envelopes exactos, UUID minúsculos, fechas civiles0001–9999,
revisiones bigint como cadenas y límites de A: comando32KiB, query4KiB,
cursor2KiB, páginas1–100; no paginadas cursorNULL/limit1. Normalización de texto
igual aA, sin truncar. SQL replica Zod; todos los campos son obligatorios incluso
cuando admitenNULL. Claves/tipos/revisiones/cursor inválidos =>22023 **antes** de
locks, fences y consulta de recibos; kind textual no implementado =>0A000.

Ampliar explícitamente la allowlist de `api_command_receipts.kind`, las uniones
SQL/TS y los dispatchers de ejecución, replay y `commandReceipt`. Las ramas
`else` actuales de A no autorizan kinds nuevos. Recibos A conservan argumentos y
resultados originales; ningún ID se recicla ni se borra para permitir un retry.
No almacenar un DTO completo de trabajo en un recibo: sólo IDs/revisiones y
resultado mínimo del comando. El replay reautoriza kind/target actual antes de
devolverlo; no exige la revisión ni unidad abierta del éxito original.

Actor=auth.uid(), organización/rol/membresías desdeDB; no user_metadata. Ausente
JWT=>28000; técnico/auditor/inactivo/ajeno/MFA insuficiente=>42501. Jefe requiere
aal2 para configurar y aprobar; encargado requiereaal2 y su ámbito vigente.
Consultar a otra persona nunca convierte al supervisor en ejecutor.

Orden:1101recibo →1102actores →1103perfiles →1104meses →1105catálogo/grafo →
filas canónicas. Preparar el superset antes de adquirir; extender un plan privado
v2 sin editar011. Incluir sesiones que se puedan detener, miembros, cobertura,
ausencias, asignaciones, versiones de catálogo y filas nuevas pertinentes.
Después de esperar: revalidar contexto, footprint, revisión, membresías,
responsabilidad, cobertura al instanteART de servidor y cierres afectados.
Footprint/revisión obsoleta=>40001; unidad cerrada=>55000/GP_CLOSED_UNIT;
no disponibilidad=>55000/GP_NOT_READY. No absorber40001/40P01 como éxito.

El fence de operationId y todos los fences de negocio cambian dentro de la misma
transacción que escritura, auditoría y recibo. Con RR, advisory locks solos no
actualizan snapshots: cada universo cuya lectura decide una escritura debe tener
una fila de fence escrita después del advisory lock. Error posterior revierte
también sus epochs. Queries nunca crean heads, escriben fences ni materializan.

Tablas nuevas en `app_private`, RLS habilitada, cero policies/grants de tabla a
PUBLIC/anon/authenticated/service_role. Helpers sin EXECUTE de esos roles;
SECURITY DEFINER con search_path vacío y nombres cualificados. Sólo las entradas
`api` ya previstas tienen EXECUTE authenticated. No ampliar get_context/capabilities
ni exponer tablas para resolver permisos. Auditoría sólo IDs/acción/revisión y
valores públicos permitidos; no motivos, textos, borradores ni referencias.

## 4. B: persistencia y semántica

Crear las siguientes tablas, con FK compuestas de organización y sin cascadas
destructivas; autores refieren a perfiles de negocio de esa organización:

| Recurso privado | Datos y restricciones |
| --- | --- |
| `task_tracking` | instance_id PK; organization_id; commercial_enabled bool defaultfalse; through_day smallintNULL; progress_by/progress_atNULL o ambos presentes; available_from dateNULL. enabled exige through_day0..30 y actor/instante; disabled exige esos tresNULL. Fecha disponible finita del mismo período. Su revisión es task.state_revision; no segundo contador divergente. |
| `task_dependency_graphs` | organization_id/company_id/period PK; config_revision bigint>=0 default0; fence_epoch bigint>=0 default0. Período finito con día1; FK empresa+organización. |
| `task_dependencies` | organization_id/company_id/period; instance_id/prerequisite_id; PK(instance_id,prerequisite_id); ambos distintos; FK a grafo y a tareas de misma organización; guard bajo locks exige misma empresa/período y entregables individuales. |
| `task_tracking_events` | id, organization_id, instance_id, task_revision, kind, valores públicos previos/nuevos de configuración/progreso, actor/at servidor. Inmutable; UNIQUE(instance_id,task_revision). No copia notas privadas. |
| `task_completion_events` | UUID PK, organization_id, instance_id, task_revision, completed_by, completed_at; UNIQUE(instance_id,task_revision), inmutable. Nuevo completadoB genera evento estable; no inventar eventos para completados históricos. |

Sin backfill de progreso/dependencias desde lab. Ausencia de tracking equivale a
disabled/throughDayNULL/availableFromNULL; ausencia de grafo a revisión0.
Añadir `priority` a task_instances como Alta/Media/Baja, defaultMedia; es
prioridad operativa, no un KPI. Conservar todas las columnas anteriores.

Configuración comercial sólo resultado individual, sin responsabilidad conjunta
actual ni unidad cerrada. Habilitar por primera vez inicia0 con actor/instante de
servidor; repetir enabled=true mantiene el progreso actual. Deshabilitar dejaNULL
en cabecera y conserva el historial. No modificar una completada: reapertura
explícita con motivo antes. Progreso0..30 no es fecha civil, puede retroceder en
tarea abierta, no cambia estado/checklist/cronómetro/KPI. Día30 sólo habilita la
propuesta de completar; siempre necesita comando y confirmación explícitos.

Dependencias: lista de0..100 UUID únicos, existentes, mismo org/empresa/período,
resultado individual, sin autoenlace ni ciclo. `availableFrom` NULL o fecha del
período; nunca levanta una espera explícita. No borrar dependencias por filtros
de visibilidad. Nueva responsabilidad conjunta se rechaza mientras una tarea
tenga seguimiento comercial o enlaces entrantes/salientes: jefe los retira
explícitamente primero; conservar historia de la configuración retirada.

Lock1105 del grafo: `dependencies:<org>:<company>:<period>`, preparado junto con
las otras claves. Después del lock, upsert del graphhead e incremento de epoch
**antes** de leer el grafo para decidir; ciclo se comprueba contra grafo vigente
enDB y causa22023. Cambio de edges incrementa config_revision una vez; cambios de
estado de predecesores escriben epoch aunque no cambien config_revision.
Dos cambios A→B/B→A nunca confirman un ciclo: el perdedor RC ve el ciclo o revisión
obsoleta; RR obsoleto aborta40001 y debe reintentar en transacción nueva.

## 5. B: queries y comandos exactos

Todos usan el envelope común. `T` significa taskId; revisiones exigidas en tabla
son claves exactas, no valores inferidos. Las respuestas llevan sólo los campos
enumerados dentro de result/data, además del envelope deA.

| Kind comando | Payload exacto | expectedRevisions | Result exacto |
| --- | --- | --- | --- |
| `task.commercialMode` | {taskId,enabled:boolean} | task:T | {taskId,taskRevision,enabled,throughDay:int oNULL} |
| `task.commercialProgress` | {taskId,throughDay:int0..30} | task:T | {taskId,taskRevision,throughDay,completionSuggested:boolean} |
| `task.dependencies` | {taskId,prerequisiteIds:UUID[],availableFrom:date oNULL} | task:T y graph:companyId:period | {taskId,taskRevision,graphRevision} |
| `task.transition` | {taskId,status:«Pendiente»/«En curso»/«Completada»,reason:text5..1000 oNULL,confirmCommercialCompletion:boolean} | task:T | {taskId,taskRevision,status,completionEventId:UUID oNULL} |

La clave graph usa companyId/período de la tarea que debe haberse consultado;
validar sintaxis de la clave recibida antes de locks y su correspondencia conDB
después de autorizar. `task.dependencies` es jefeaal2; los dos comerciales tienen
los permisos de §4 y progreso exige ejecutor actual. `task.transition` exige
ejecutor real: responsable/participante autorizado o cobertura vigente. Crear
helper genérico para resultado/operativa; `api_can_execute` deA sólo acepta
operativas y no sirve como autorización de resultado.

En transición: empezar/completar consulta readiness después de locks; espera,
fecha futura o predecesor sin completar bloquean. Completar exige resultado,
estado previamente iniciado, controles completos y sin espera; comercial además
through_day=30 y confirmCommercialCompletion=true. En las otras transiciones
ese flag debe serfalse. Reapertura requiere motivo, conserva progreso comercial
hasta que el ejecutor lo cambie y crea evento de reapertura existente. Registrar
un completionEventId UUID nuevo por cada ciclo de completado, estable en replay;
no asociar evidencia hastaM2.6. Cambios de estado/revisión/tiempos y recibo atómicos.

Reutilizar controles/sesiones/cobertura de011 con núcleo **sin adquisición tardía**
de locks/recibos. Corregir en014 los entrypoints legacy que puedan saltar estas
reglas: `start_task_timer`, `_coordination_apply_task_control` y wrappers de
transición/checklist. Sus planes toman1105grafo antes de filas; inicio y
autocompletado comprueban readiness. Último check de una comercial nunca la
completa; transición legacy sin campo de confirmación rechaza su completado.
No ampliar permisos legacy; para tareas protegidas porB exigir también ejecutor
vigente. Preservar comportamiento de tareas v1 sin configuraciónB. Un trigger
que tome1105 después de task FOR UPDATE no es solución aceptable.

| Kind query | Filters exactos | Data exacta |
| --- | --- | --- |
| `readiness` no paginada | {taskId} | {taskId,taskRevision,graphRevision,asOfOn,ready,blockers:[{code,availableFrom:date oNULL}],visibleDependencies:[{taskId,title,status}],hasHiddenDependencies:boolean,commercial:{enabled,throughDay:int oNULL,completionSuggested:boolean}} |
| `suggestedRoute` paginada | {subjectId,period,companyId:UUID oNULL,teamId:UUID oNULL,sector:string1..200 oNULL} | {asOfOn,items:[{taskId,taskRevision,title,companyId,ownerId,period,dueDate:date oNULL,priority,weight:decimalString,scheduledOn,ready,blockerCodes:string[]}],nextCursor} |

blockerCodes allowlist: external_wait, available_later, dependencies_pending.
No texto de SQL009, nota personal, IDs/títulos ni cantidad de dependencias ajenas
en blockers; enlaces fuera de ámbito se representan sólo por el booleano genérico.
La nota de espera, si se muestra en otra query futura, se autoriza como su recurso
propio. Titular y superiores pueden leer dentro de su ámbito vigente; consultar
subjectId no concede ejecución. Ruta sólo entregables no completados, unidad
abierta y responsabilidades del sujeto; aplicar filtros **después de ámbito**.
No incluir tareas sólo porque el sujeto las supervisa; cobertura se consulta como
trabajo delegado exacto sin atribuirle responsabilidad/KPI.

Orden total: ready DESC, dueDate ASC NULLS LAST, prioridad Alta/Media/Baja,
weight DESC, scheduledOn ASC NULLS LAST, UUID ASC. decimalString de lectura
conserva la escala histórica del peso; el máximo6 decimales de entrada nueva no
se aplica a pesos legacy. FechaART del servidor, sin iniciar tareas/relojes.
Cursor keyset liga kind/filtros/asOfOn/tupla completa y una huella del conjunto
filtrado, incluidos estado, prioridad y readiness. Cambio de día o del conjunto
entre páginas devuelve40001 y exige recargar; una consulta no toma locks ni
escribe fences. Una query no hereda permisos del cursor. No usar OFFSET ni
resultados de State local.

## 6. C: definición v1/v2 y compatibilidad

Añadir `measurement_version smallint NOT NULL DEFAULT1 CHECK IN(1,2)` a
task_templates, task_template_versions, task_assignments y task_instances.
En DTO de definición, operativa1=legacy_target_v1 y operativa2=movements_v2;
resultado conserva1. Esta versión es de **definición**: una tarea legacy puede
tener activity_entries2 porA; no confundir ambas columnas ni recalcular filas.

| Definición | Restricciones tras014 completa |
| --- | --- |
| Resultado | measurement_version1; peso>0<=100, checklist; mantener semántica de unit/target legacy, DTO nuevo no los presenta como meta. |
| Operativa1 existente/contrato legacy | Peso y target/monthly_target positivos y unidad con semántica histórica exacta. Conservar valores y lectura; no aplicarles máximo80 ni trim nuevo retroactivamente. |
| Operativa2 nueva API | unidad normalizada1..80 reales; target/monthly_targetNULL; weightNULL; checklist vacío; nunca completar por cantidad. Coeficiente sólo operation.rate; no peso provisional0/1 para simular ese coeficiente. |

Relajar NOT NULL de weight y reemplazar sólo CHECK nombradas necesarias por la
unión anterior; comprobar NULL explícitamente para evitar bypass de CHECK.
Snapshot de versión/definición/asignación se conserva al materializar. No cambiar
los bytes de versiones inmutables ni las instancias existentes. Nuevas lecturas
v1 conservan peso/meta históricos en DTO específico legacy; nuevas lecturasv2
no incluyen esas claves. No adaptar estos nulls al Task local/D1 mediante casts.

Extender task_template_versions con effective_on/created_by/reason nullable para
versiones históricas, sin inventar fecha/autor/motivo. Versión publicada nueva
requiere los tres, fecha finita, autor de organización y motivo5..1000. Head
version identifica la última publicada; una nueva asignación fija explícitamente
esa versión y exige startDate>=effective_on. No materializa esa revisión antes
de su vigencia. Las asignaciones ya fijadas siguen usando su propia versión.
El historial expone NULL para metadatos históricos ausentes; no infiere autores.

Una plantilla operativa legacy no se convierte al migrar: jefe publica una nueva
versión movements_v2 antes de usarla en nuevas asignaciones/inducción de la API.
Mientras tanto sigue consultable, con aptForNewAssignment=false. No seleccionar
automáticamente una versión nueva ni quitarle la meta al snapshot anterior.
Asignacionesv1 existentes continúan materializando ocurrenciasv1, con su versión
fijada. Las nuevas asignaciones operativas de la API sonv2; no se migran reglas
existentes por el mero hecho de materializar un mes.

Extender guard de cierre legacy deA para rechazar también cualquier definición
operativav2 en su universo, aunque todavía no tenga movimientos/evaluación;
0A000/GP_V2_REQUIRES_COMPANY_CLOSE. No dejar que NULL weight genere un reporte
legacy parcial. Nuevos cierres por empresa siguen reservados aM2.3.

Añadir definition_revision bigint>=0 default0 a task_assignments; nuevas altas
empiezan0, cambios de definición posteriores incrementan una vez. Catálogo usa
version y la inducción current_revision/draft_revision actuales, transportados
como strings; revisar estado además de revisión en cada transición.
Heads privados api_catalogue_heads por organización y api_onboarding_owner_heads /
api_creation_heads por owner (FKorg, PK del scope, revision>=0, fence_epoch>=0)
serializan creación aun sin fila;
filas nuevas se crean por comando, nunca por query. Versiones y eventos nuevos
inmutables, actor/instante/motivo de servidor o texto confirmado según el caso.
La marca provisional vive en app_private.assignment_parameterization:
assignment_id PK/FKorg, pending boolean, created_by/created_at servidor. C sólo
crea pending=true en custom resultado no jefe; confirmación posterior exige
contratoM2.5/M2.7 y nunca cambia tareas iniciadas/cerradas ni el histórico.

## 7. C: API y reglas de creación

Tipos cerrados reutilizables, también validados íntegramente enSQL:

- Definition = unión exacta resultado `{kind,title,objective,sector,weight,
  checklist}` y operativav2 `{kind,title,objective,sector,unit}`. title1..200,
  objective0..4000, sector1..200; peso cadena decimal>0<=100, máximo6 decimales;
  checklist0..100 objetos `{id:UUID,text:string1..1000}`, IDs únicos, sin done.
  unit1..80. No target/monthlyTarget/weight en la rama operativa nueva.
- Schedule exacto `{frequency,startDate,endDate,interval,weekdays,monthDay,
  hasDeadline,dueOffsetDays}`: frequency unica/diaria/semanal/mensual, fechas
  válidas, endDateNULL o>=inicio, intervalo1..12, weekdays únicos0..6 (semanal no
  vacío), monthDay1..31, offset0..31. Unica endDateNULL o=incio; anclaje semanal
  lunes y meses cortos como schedule.ts/SQL actual. No convertir día comercial
  a fecha. Mantener posibilidad de vencimiento que cruza mes si la regla lo hace.
- Source = unión exacta `{type:'catalogue',templateVersionId}` o
  `{type:'custom',definition}`. Fuera de catálogo sólo frecuenciaunica;
  recurrentes necesitan versión estándar actual, activa y elegible.
- Line exacta `{lineId,companyId,teamId,source,schedule}`. Líneas0..100 en
  borrador;1..100 al enviar. IDs únicos; root exacto `{schemaVersion:2,lines}`.
  Validar todo el contenido y tamaño incluso en draft; no almacenar JSON libre.

En la siguiente tabla `R`=requestId, `V`=templateId, `O`=ownerId; los nombres
de claves son literales con esos UUID sustituidos. No se aceptan claves de revisión
extra ni claves de entidades ajenas que el servidor ignore.

| Comando | Payload exacto | Revisiones exactas | Result exacto |
| --- | --- | --- | --- |
| `catalogue.create` | {definition,effectiveOn,reason} | catalogue:org | {templateId,versionId,version,catalogueRevision} |
| `catalogue.revise` | {templateId,definition,effectiveOn,reason} | catalogue:V y catalogue:org | {templateId,versionId,version,catalogueRevision} |
| `catalogue.weight` | {templateId,weight,effectiveOn,reason} | catalogue:V y catalogue:org | {templateId,versionId,version,catalogueRevision} |
| `onboarding.saveDraft` | {requestId:UUID oNULL,draft:{schemaVersion:2,lines}} | onboardingOwner:actor; y, siR noNULL, onboarding:R + onboardingDraft:R | {requestId,revision,draftRevision,status} |
| `onboarding.submit` | {requestId} | onboarding:R + onboardingDraft:R | {requestId,revision,draftRevision,status} |
| `onboarding.requestChanges` | {requestId,reason} | onboarding:R | {requestId,revision,draftRevision,status} |
| `onboarding.approve` | {requestId,weightOverrides:[{lineId,weight}],period} | onboarding:R; catalogue:V para cada estándar referenciado | {requestId,revision,status,activationCount,assignmentIds:UUID[],createdTaskIds:UUID[]} |
| `assignment.create` | {ownerId,companyId,teamId,source,schedule} | creation:O; catalogue:V si estándar | {assignmentId,assignmentRevision} |
| `task.createOneOff` | {ownerId,companyId,teamId,source,scheduledOn,dueDate:date oNULL,priority} | creation:O; catalogue:V si estándar | {assignmentId,taskId,taskRevision} |
| `month.materialize` | {ownerId,period} | creation:O | {ownerId,period,createdTaskIds:UUID[],creationRevision} |

catalogue:org significa `catalogue:<organization UUID>`; catalogue:V significa
`catalogue:<template UUID>`. Head no existente=>0. creation y onboardingOwner
separan scopes/locks; devolver su revisión actual por las queries de esta sección.
Los catálogos referenciados se extraen del submit inmutable, sin payload libre en
approve. Su conjunto exacto de claves/revisiones debe conocerse al consultar inbox.
Todas las revisiones serializadas son decimalString. reason5..1000 y effectiveOn
fecha válida; no reescribir pasado ni cambiar kind de una identidad de catálogo.
`catalogue.weight` sólo resultado; unidad de operativa puede cambiar únicamente en
versión nueva, sin tocar snapshots/instancias fijados.

Catálogo/asignación/materialización y aprobación: sólo jefeaal2. Borrador/envío:
sólo empleado autoractivo. RequestChanges: jefeaal2 de organización o encargadoaal2
de su ámbito actual, sobre **enviado**, nunca borrador ajeno. Approve sólo jefe,
estado submitted y revisiones exactas; todas las líneas o ninguna. Confirmación de
pesos ocurre dentro de esa aprobación, como el contrato SQL vigente: overrides
exactamente para líneas custom resultado, no operativas ni líneas desconocidas.
No añadir un segundo `parameters.confirm` que vuelva a activar trabajo. El resto
de propuestas habituales y confirmación posterior del laboratorio esperaM2.5/M2.7.

OneOff: empleado sóloowner=actor y empresa/equipo propios; encargado puede crear
para su ámbito, jefe en organización. Resultado custom creado por no jefe exige
peso1 y marca privada pending_parameterization; sólo jefe lo confirma en
etapa posterior. Operativa nunca recibe ese peso. Ninguna creación acepta actor,
rol, status, horas, checklistdone, completado, dependencias, evidencia o tasa.
Crear asignación técnicaunica y ocurrencia atómicamente porque assignment_id es
NOT NULL en esquema; no tarea huérfana ni assignment ficticio reutilizado.
Un estándar resultado usa el peso de su versión aprobada enDB; el empleado no
lo sustituye por un peso elegido ni lo marca provisional.

Cada escritura revalida dueño activo, empresa/equipo/membresías, versión estándar
vigente y unidad abierta. Standard viene de versión deDB; no del título/peso del
cliente. Materialización no duplica UNIQUE(assignment_id,scheduled_on); dos IDs
distintos de comando no duplican la misma ocurrencia. OneOff con IDs distintos
sí representa dos altas intencionales; no deduplicar por título/importe/texto.
Acotar cada comando a1000 ocurrencias resultantes; si supera,22023 y rollback,
sin activación parcial. Repartir la planificación en comandos explícitos más
pequeños; no truncar silenciosamente la respuesta ni elevar32KiB de entrada.

Inducción approve materializa únicamente el período explícito, que debe ser el
mesART actual al confirmar; las reglas con inicio futuro quedan activadas sin
ocurrencia actual. Planificar primero todo el owner/período, versiones, altas y
sus locks; no invocar materialize_month con locks internos después de writes.
Reusar el core sin nueva adquisición y preservar la unicidad de activaciones
(request,revision,lineId). Repetición exacta devuelve recibo; nueva operación sobre
inducción ya aprobada no aprueba otra vez ni ignora argumentos:40001.

Queries C, siempre con filtros exactos y autorización actual:

| Kind / filters | Data exacta |
| --- | --- |
| `cataloguePage` / {kind:resultado/operativa oNULL,active:boolean} | {catalogueRevision,items:[CatalogueDTO],nextCursor} |
| `catalogueHistory` / {templateId} | {items:[CatalogueVersionDTO],nextCursor} |
| `ownOnboarding` no paginada / {} | {ownerRevision,request:OwnRequestDTO oNULL} |
| `parameterInbox` paginada / {status:submitted/changes_requested/approved,ownerId:UUID oNULL} | {items:[SubmittedRequestDTO],nextCursor} |
| `creationContext` no paginada / {ownerId} | {ownerId,creationRevision,companies:[{id,name}],teams:[{id,name}]} |

CatalogueDTO exacto={templateId,versionId,version,measurementVersion,definition,effectiveOn,active,
aptForNewAssignment}; CatalogueVersionDTO añade createdAt,createdBy,reason y usa
definición legacy discriminada para filas1 conservadas. Su detalle legacy tiene
title/objective/sector/kind/unit/weight/target/checklist exactos deDB, sin máximo
retroactivo nuevo. OwnRequestDTO={requestId,status,revision,draftRevision,payloadVersion,draft,
submitted:SubmittedRequestDTO oNULL}; SubmittedRequestDTO={requestId,ownerId,
status,revision,submittedAt,payloadVersion,payload,reviewEvents:[{action,actorId,at,reason}],
requiredRevisions:map}. draft sólo en ownOnboarding, nunca inbox ni recibos.
Inbox proyecta únicamente la versión enviada; si nunca se envió no aparece.
No exponer propuestas, correos o anotaciones. creationContext autoriza gestión
del sujeto, no todos los IDs del directorio.

payloadVersion2 usa el draft/payload exacto de §7; versión1 usa una proyección
legacy explícita de campos reconocidos del formatoSQL anterior (line_id,
company_id,team_id,template_version_id,custom_title,kind,unit,target,checklist y
campos de calendario). No retornar claves arbitrarias que un draft histórico
pudiera contener. Campo legacy opcional ausente se representaNULL; IDs/tipos
legacy inválidos producen resumen `{requiresResubmission:true,lineCount}` en
esa rama del DTO, con el JSON original conservado enDB y sin aprobación automática.

La privacidad del borrador también se exige a nivelDB: en014 restringir las
políticas SELECT de onboarding_requests y onboarding_progress al propio autor;
ninguna policy permisiva adicional puede devolver su draft a un superior.
Revisar las policies de versions/reviews/activations que consultan requests:
su lectura autorizada de versiones **enviadas** se resuelve por helper privado
con autorización actual, sin conceder lectura de draft. api.parameterInbox
proyecta el submit bajo autorización propia. Conservar firmas/writers legacy
definer e historia; no trasladar JSON privado a audit, versiones públicas ni
otra columna legible para sortear la restricción. Probar SELECT directo como
authenticated jefe/encargado, además delHTTP que sólo exponeapi.

Cursor catálogo: kind/filtros+version de head+(title normalizado,templateId) ASC;
si cambia head,40001 y recargar. Historia: (version,id) DESC; inbox:
(submittedAt,id) DESC, filtros ligados. Limitar reviewEvents a la revisión enviada
actual; historial completo paginado se reserva aM2.7 para no producir arrays sin
cota. No aceptar filtros arbitrarios/SQL o snapshots del navegador.

## 8. Upgrade y ejecución local por etapas

1. Guardar hashes de001–014, DTOA y fuentes UI/Worker. Construir inventario de
   constraints/índices/triggers/writers activos; no editar001–013 ni borrar datos.
2. Implementar B en014, antes del COMMIT existente, incluyendo recepción/replay
   de kinds nuevos y guards legacy. Empty→014 y013 poblado→014; revisarSol.
3. Implementar C en la misma014 aún local. SQL idempotente en **operaciones**;
   la migración completa se aplica una sola vez. No ejecutar014 sobre una base
   que ya la aplicó para simular upgrade B→C: recrear fixture sintético desde013.
4. Comparar columnas originales de todas las tablas y snapshots de reportes/
   cierres literalmente, excluyendo sólo columnas nuevas de los comparadores.
   Conservar activity/sesiones/recibos legacy yA/notasSQL009/versiones/outbox y
   versiones de catálogo/inducción no vacías. Sin rates/progreso/evaluaciones
   inventados. Error de migración=>rollback íntegro.
5. Mantener lectura de drafts/submits históricos sin schemaVersion: etiquetar
   payloadVersion1 en DTO legacy, jamás reescribir JSON. La nuevaAPI requiere
   revisión2 explícita y reenvío antes de aprobar contenido legacy; wrappers
   legacy conservan su contrato con filasv1. No aprobar un submit antiguo como
   v2 interpretando target0 o suprimiendo campos en silencio.
6. Actualizar copias de snapshot en materialización/catálogo/inducción y wrappers
   que lean definicionesv2. Wrapper incompatible devuelve0A000 genérico parav2;
   nunca crea v1 con datosv2 ni vuelve a pedir una meta para una nuevav2.
   Prueba específica de todo writer que inserte/update estas cuatro tablas.
7. Preservar nombres/recibos originalesA; suite/regresionesA/R1–R8 siempre verdes.
   Ejecutar focales y suite oficial, TypeScript, builds cliente/Worker y diff-check.
   Evidencia: comandos exactos, exitcodes, hashSQL/DTO, casos y estado/fences.
   Commit coherente con hook habilitado y push a main según flujo vigente.

## 9. Pruebas obligatorias y gates

**B local:** matriz empleado/encargado/jefeaal1/aal2/técnico/auditor/inactivo/otraorg,
consulta frente a ejecución, membresía/cobertura revocadas mientras espera;
comercial0→30→30,31/-1/fracción/tipoNULL, completed/reopen, referencia de período,
30 sin completar ni parar reloj, último check sin auto completar comercial,
confirmación explícita; espera no se levanta por fecha; disponible futura;
ciclos/autoenlace/duplicados/otra empresa/período/joint e IDs ocultos sin filtración.
Timers/transiciones/checklist legacy no saltan readiness. Rechazos sin cambios
de task_revision/graph_revision/epochs/actividad/sesiones/recibos/auditoría.

**B concurrencia nativa:** A→B/B→A ambos órdenes; edición de dependencias contra
inicio/completado; completar/reabrir predecesor contra completar sucesor; día30
contra completado; configuración contra asignación conjunta; cierre legacy y
revocación de actor/membresía/cobertura contra todos esos comandos; replay exacto
contra replay. RC/RC yRR/RR ambos órdenes, mixtosRC/RR yRR/RC para replay,
autorización y fence del grafo. Observar pg_blocking_pids; comprobar resultado,
rollback ganador/retry y epochs, no sólo el exitcode. Ningún40P01 aceptado.

**C local:** nueva operativa sin target/peso; rechazar0/falsos placeholders,
resultado/operativav1 conservados, unidadlegacy81 legible y nuevav2 rechazada,
draftprivado/submits versionados, rechazo de claves/tipos/campos privados,
fechas/recurrencias/bisiesto/día31/vence mes siguiente, approval all-or-nothing,
miembro/equipo/catálogo revocados, standard cambiado, cerrados, slots/IDs repetidos,
materialización repetida sin duplicados y alta puntual de rol permitido. Guard
legacy cierra v1 y rechazav2 incluso sin movimientos. Recibos y decoders deA/B/C
exactos, permiso revocado y argumentos distintos con mismooperationId=>40001.

**C concurrencia nativa:** alta/alta, draft/save/submit, submit/requestChanges/
approve, approve/approve, catálogo revise/assignment create/approve, materialize/
materialize y materialize/cierre/alta puntual, revisión/cobertura/responsabilidad
que altere el footprint. Ambos ganadoresRC/RC yRR/RR; mixtos para replay y
revocación. Fallo inyectado después de cada familia de writes revierte todo.

**Gate L:** A y B tienen aceptación local Sol en sus hashes registrados. Para C,
Sol aceptó únicamente los escenarios locales R90 enumerados en el mapa de
membership; eso no cierra M2.2C ni Gate L completos. Siguen pendientes la matriz
completa de replay/revocación para onboarding/creation, los writers legacy de
asignación/responsabilidad/ausencias/cobertura/movimiento/transición, la rama de
reglas recurrentes y las familias de concurrencia e inyección de fallos aún no
cubiertas por §9. La suite/builds no sustituyen esas pruebas. Mantener 014 sin
aplicar y no iniciar el preflight alojado hasta implementar, ejecutar y obtener
aceptación Sol de C/Gate L completos sobre hashes exactos. Después aún se exige
cerrar la exposición Data API y verificar el destino remoto antes de ensayar el
paquete completo; esto no habilita el cliente operativo ni producción.

**Preflight alojado, posterior aL:** releer ref `kynqjfhqujnjojcmurwf`, org dueña,
estado y ausencia de tablas/migraciones de negocio; seleccionar explícitamente
este dev. Registrar versión realPostgres/CLI, pending list y hashes de todos los
archivos. Herramienta CLI sólo después de consultar --help. No migration repair,
reset remoto, SQL manual sin historial ni puenteD1. Si encuentra drift/fila de
negocio o014 previamente aplicada, detener y definir nueva migración conSol.
No habilitar integración GitHub como método de prueba; aplicación controlada,
serializada y con commit registrado desde main. Cuenta/recurso productivo no
es destino de ensayo ni comparte variablesref de este dev.

Antes de aplicar la primera migración de negocio, inspeccionar y guardar la
configuración actual de Data API. Con autorización explícita del propietario
para esas acciones, desactivar autoexposición y quitar public/extensions de los
esquemas expuestos; destino final sóloapi, app_private/graphql_public excluidos.
Si api aún no existe y el Dashboard impide seleccionarlo, mantener Data API
desactivada durante la carga (o exposición vacía comprobada si el proveedor lo
admite), y habilitar sóloapi después de crear el esquema. Deshabilitar/rehabilitar
Data API y cambiar esquemas también requiere autorización al momento de actuar;
no inferirla de crear el proyecto ni del permiso pendiente para el toggle.
No aplicar001–014 con public expuesto esperando ocultarlo al finalizar: las
migraciones antiguas ya otorgan SELECT y pueden abrir datos durante esa ventana.
Mantener el gate hasta tener autorización y exposición cerrada comprobada.

**Gate H, Supabase dev real:** migración completa desde vacío; roles reales
anon/authenticated y JWT reales de usuarios **sintéticos**, sin correo enviado,
empleadoaal1, encargado/jefeaal2 mediante MFA real y cuenta técnica separada.
Probar porHTTP get_context/query/command/commandReceipt, dos sesiones,
token expirado, perfil/membresía inactivados con JWT todavía vigente, replay
ambiguo y matricesB/C. Exponer sóloapi; rechazar Accept-Profile yContent-Profile
public/app_private/graphql_public y lecturas/escrituras de tabla, incluidos SQL009
y borradores. Usar claves publicables en cliente de prueba, jamásservice_role
como sustituto de usuario. Verificar RLS/grants/definer/search_path y advisors;
registrar todos los hallazgos, sin publicar secretos/tokens en evidencia.
Probar limpieza sólo de fixtures identificados, con plan reversible; no borrar
automáticamente datos/proyectos tras pruebas. No instalar consumidor de correo.

Guardar evidencia alojada separada de local: ref, commit, hashes, motor,
configuración de esquemas, matriz/SQLSTATE/resultados, HTTPstatus, estados finales
y límites. Redactar secretos y texto privado; no un volcado de Auth/State. GateH
fallido mantiene deshabilitado el cliente y devuelve correcciones aSol. Migración
ya alojada es inmutable: arreglos posteriores mediante archivo nuevo numerado
según inventario real, conservando la reserva funcionalM2.3 sin sobrescribir014.

M2.2 se informa como aceptado local/alojado segúnL/H por separado. No iniciar
015/M2.3 sinL; H debe pasar antes de declarar lista la integración alojadaM2.2.
M2.3–M2.7, frontend/Auth integrado, Storage/restore, cierres nuevos, automatización
de hosting, aceptación humana y producción siguen gates independientes.

## 10. Decisiones derivadas y decisiones del propietario

Este contrato decide técnicamente NULL en vez de peso/meta ficticios parav2,
catálogo legacy fijado, reenvío explícito de inducciónv1 y confirmación comercial
separada. Son consecuencias de las reglas ya aprobadas, no cambios de negocio
que requieran detenerB/C para pedir permiso.

Antes de producción sí necesita decisión explícita del propietario: destinatario
real/domino/remitenteSMTP y recuperaciónAuth, creación e invitación de personas,
destino y método de importación de datos reales, retención de documentos y
habilitación de acceso/hosting productivo. No bloquean implementación local o
ensayo dev con fixtures. La aceptación humana del producto sigue pendiente.

La identidad visible «IVA» y «Gemelo» se conserva como dirección del producto;
este bloque de backend no rediseña ni renombra la UI. No recalcular el ~45%
histórico por documentación o por crear un proyecto vacío.

Fuentes de mecanismo consultadas16/10: [esquemas expuestos](https://supabase.com/docs/guides/api/using-custom-schemas),
[migraciones](https://supabase.com/docs/guides/deployment/database-migrations).
La receta genérica de grants del proveedor no reemplaza los permisos mínimos
de este contrato. Changelog consultado:
[cambioTLS del12/10](https://supabase.com/changelog/cbc-tls-ciphers-deprecated),
con efecto desde10/11 como fecha más temprana; no cambia el modeloSQL y requiere
validar el cliente real al ejecutarH.
