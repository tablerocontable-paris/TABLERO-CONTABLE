# Contrato borrador — primer ingreso autenticado y conceptos neutrales

Fecha: 27/10/2026
Estado: **borrador revisado, pendiente de aprobación**. Las decisiones siguientes
son propuestas de contrato; no acreditan implementación ni habilitan Auth, API,
invitaciones, migraciones alojadas o producción.

## Evidencia actual

La clasificación del laboratorio es independiente de este contrato remoto.
Las sugerencias v2 tienen códigos deterministas y la materialización local los
conserva; fuentes: `src/domain/workforceTaxonomy.mjs:1-39`,
`src/domain/habitualTaskProposals.ts:39-49,235-245`,
`src/domain/catalogue.ts:30` y `src/domain/model.ts:615`.
`src/components/Onboarding.tsx:91-92` limita las sugerencias al laboratorio sin
`remote`. Esa evidencia no prueba un primer ingreso autenticado conectado.

Comportamientos remotos existentes verificados en las fuentes:

| Comportamiento actual | Fuente |
|---|---|
| Los sobres de comandos/consultas usan `contractVersion=1`; las definiciones, líneas, respuestas y DTO son estrictos. El borrador remoto usa `schemaVersion=2`, sin clasificación neutral. | `src/data/supabase/operational-contract.ts:19,46-70,146-167,212-225` |
| Una línea personalizada remota sólo admite frecuencia `unica`. | `src/data/supabase/operational-contract.ts:65`; `supabase/migrations/202610150014_operational_api.sql:1966-1968` |
| El catálogo se consulta por organización, sin ámbito de empresa/equipo en esa consulta. | `supabase/migrations/202610150014_operational_api.sql:1906-1911` |
| Guardar y enviar exige empleado; pedir cambios exige jefe/encargado con AAL2. La solicitud enviada conserva una versión separada. | `supabase/migrations/202610150014_operational_api.sql:1988-2015,2126-2148` |
| Aprobar exige jefe con AAL2, revisión exacta y catálogo vigente; crea asignaciones y ocurrencias. La rama personalizada deja la referencia de catálogo nula; no publica una plantilla. | `supabase/migrations/202610150014_operational_api.sql:2171-2173,2240-2254,2262-2289` |
| Cero líneas permite guardar un borrador, pero no enviarlo. | `supabase/migrations/202610150014_operational_api.sql:1940-1941` |
| Las versiones de plantilla rechazan UPDATE/DELETE; asignaciones y tareas ya tienen FK de versión por organización. | `supabase/migrations/202610010001_occurrence_contract.sql:30-39` |
| Coberturas conservan/comparan snapshots completos de asignación. Añadir columnas a esa tabla cambia `to_jsonb(a)`, incluso si son NULL. | `supabase/migrations/202610150014_operational_api.sql:3104-3112,3291` |

El estado DEV y la instalación de SQL001–016 se documentan en
`docs/architecture/SUPABASE-DEV-SCHEMA-CATALOG-COMPARE-20261027.md`; no se
reconsultó DEV para esta revisión documental. No editar ni volver a aplicar
esas migraciones. La siguiente migración requiere revisión y aceptación propias.

## Decisiones propuestas: protocolo, identidad y alcance

1. Crear superficies explícitas `api.command_v3` y `api.query_v3`, con
   `contractVersion=3`, y un borrador `schemaVersion=3`. Conservar exactamente
   los sobres y DTO v1. El nuevo lector discrimina contenidos históricos
   `schemaVersion=1`, `2` y `3`; «lectores v1/v2» se refiere a esos contenidos,
   no afirma que existan RPC `command_v2`/`query_v2`. La taxonomía continúa en
   versión 2 y no se deduce de la versión del protocolo ni de medición.
2. La pareja neutral se guarda sólo en la versión inmutable de plantilla.
   Asignaciones y tareas la resuelven desde su FK histórica; no se agregan
   columnas neutrales a esas dos tablas. Tampoco se consulta la versión actual
   de la cabecera para clasificar historia.
3. El catálogo publicado es neutral y común a la organización. No contiene
   personas, empresas, clientes, alias privados ni notas de onboarding. Empresa,
   equipo y responsable pertenecen a la asignación y requieren autorización
   específica del servidor. Leer el catálogo no concede acceso al trabajo.
4. La aprobación activa exclusivamente líneas con versión publicada. Una
   personalizada debe pasar por publicación separada y un envío posterior que
   referencie esa versión. No se publica ni reclasifica como efecto implícito
   de aprobar.
5. Continuar sin selección significa guardar un borrador vacío y continuar la
   inducción sin enviar ni aprobar. No crea tareas, catálogo ni un estado nuevo
   de aprobación. La ausencia de propuestas enviadas debe mostrarse como tal.

## Catálogo neutral, versión 2

La identidad de reporte es un código estable, sin título libre, empresa,
persona, alias ni datos de cliente. `taxonomyVersion=2`. El título puede
acortarse o adaptarse en la interfaz sin cambiar el código. No se asigna un
código automáticamente por similitud de título; si no se puede decidir, se
mantiene sin clasificar hasta revisión.

| Concepto neutral v2 | Código para clasificar |
|---|---|
| Conciliación de cuenta bancaria | `bank_reconciliation` |
| Procesamiento y control de pagos | `payment_processing` |
| Arqueo y control de caja | `cash_reconciliation` |
| Registro y seguimiento de cobranzas | `collections_tracking` |
| Registro y control de liquidaciones de tarjetas y cupones | `card_coupon_settlement` |
| Registro de devoluciones a clientes | `customer_refunds` |
| Registro y control de cheques | `cheque_tracking` |
| Registro y control de operaciones de crédito | `credit_operations` |
| Aplicación y compensación de cobros | `receipt_application` |
| Conciliación de plataformas de cobro | `payment_platform_reconciliation` |
| Registro y control de cuotas de planes | `payment_plan_tracking` |
| Registro de comprobantes | `document_recording` |
| Archivo y organización de documentación | `document_organization` |
| Registro y control de asientos contables | `accounting_entries` |
| Registro y control de información de sueldos | `payroll_records` |
| Preparación y control de obligaciones fiscales | `tax_obligations` |
| Cierre contable por empresa | `company_accounting_close` |
| Control y ajuste de inventario | `inventory_control` |
| Preparación y registro de ajustes contables | `accounting_adjustments` |
| Análisis de costos de operaciones | `cost_analysis` |
| Análisis y resumen de operaciones | `operations_analysis` |
| Cierre mensual de indicadores | `monthly_indicator_close` |
| Gestión y seguimiento de trámites | `procedure_tracking` |
| Revisión de seguimiento del equipo | `team_review` |
| Actualización del registro de servicios | `service_register_update` |
| Compra y control de insumos | `supplies_control` |

La whitelist persistible es exactamente la lista de **26 códigos de esta
tabla**. La restricción del servidor y la de PostgreSQL deben usar esa lista
explícita; no reutilizar `CONCEPT_CODE_LIST` sin filtrarla: actualmente también
contiene `other_pending_review` (`src/domain/workforceTaxonomy.mjs:36-39`).
Ese valor sirve sólo como salida analítica, nunca como clasificación persistida,
sugerencia seleccionable o atajo para aprobar un faltante.

## Modelo inmutable y autoridad del servidor

La futura migración agrega `neutral_concept_code` y `taxonomy_version` sólo a
`public.task_template_versions`. Son nullable, sin default: o ambos NULL, o un
código de los 26 y la versión 2. Pares incompletos, versiones desconocidas y
códigos fuera de lista se rechazan en API y base. Los registros existentes
permanecen NULL; no se hace backfill por título, alias o estimación.

Las nuevas líneas v3 conservan los campos
`lineId/companyId/teamId/source/schedule`. Su `source` es una unión estricta:

- Catálogo: `{type: "catalogue", templateVersionId}`. No admite una pareja
  neutral suministrada por el empleado. El servidor resuelve y proyecta la
  pareja desde la versión, validando organización, publicación, vigencia y
  elegibilidad. La propuesta v3 nueva requiere una versión clasificada; la
  historia sin evidencia conserva su lectura legacy.
- Personalizada: `{type: "custom", definition}`. Conserva la definición v2
  estricta sin campos de clasificación y la restricción inicial `unica`.
  Representa una propuesta pendiente, no una definición publicada. Para
  recurrencia, primero se publica un proceso y después se envía una revisión
  basada en catálogo. Ni título ni código de sugerencia autorizan publicación.

Las sugerencias neutrales se muestran agrupando versiones publicadas por su
pareja neutral. Los 26 conceptos no generan automáticamente 26 plantillas.
Un concepto sin proceso publicado muestra espera; no se sustituye por una
definición local. Los seis IDs `starter-v1-*` históricos se conservan en la
capa local; no son identificadores Auth ni referencias de plantilla remota.

La publicación v3 de jefatura recibe una pareja explícita válida junto con
definición, vigencia y motivo, bajo las revisiones de catálogo esperadas. Crear
un proceso neutral requiere clasificación; corregir su clasificación genera
otro UUID/número de versión y motivo. Una revisión de sólo peso hereda la
pareja del servidor. No modificar ni borrar una versión publicada. Los
parámetros de medición mantienen su contrato: operativas v2 con unidad, sin
meta/peso de finalización; resultados con controles y peso válido. El código
neutral no convierte unidades ni tasas.

En los payloads de publicación y DTO v3, la pareja se expresa como objeto
estricto `classification: {neutralConceptCode, taxonomyVersion}`. Los dos
campos son obligatorios; sólo una proyección histórica admite ambos `null`.
`catalogue.create` y `catalogue.revise` v3 reciben `classification` además de
los parámetros existentes; `catalogue.weight` la hereda y no la acepta como
entrada. Las consultas de catálogo/trabajo v3 proyectan ese objeto resuelto
fuera del payload histórico; nunca le insertan campos a un envío antiguo.

`catalogue.weight` v3 primero resuelve un recibo previo exacto y autorizado,
sin revalidar la clasificación de la cabecera actual. Si se trata de una
ejecución nueva, exige clasificación válida en la versión fuente. Ante
NULL/NULL rechaza con `0A000` y código `GP_CLASSIFICATION_REQUIRED`, indicando
que jefatura debe usar primero `catalogue.revise` v3 con clasificación explícita
válida. No crea una revisión de peso nueva sin clasificar ni modifica versiones
o recibos legacy. Un mismo `operationId` con argumentos diferentes sigue siendo
conflicto, no una solicitud nueva de clasificación.

Asignaciones y tareas conservan sus FK de versión por organización. La futura
migración debe protegerlas de sustitución posterior y asegurar que la versión
de cada tarea coincide con la de su asignación al insertarla; una FK aislada
no garantiza esas dos propiedades. Cuando la referencia sea histórica/nula,
la clasificación resuelta será la histórica/nula. Cambiar plantilla actual,
título, peso o taxonomía futura no reclasifica trabajo ya creado. Una revisión
futura modifica el esquema/protocolo explícitamente, no el significado de un
código histórico.

## Matriz propuesta de roles, AAL y ámbito

Toda operación deriva actor y organización de Auth y exige perfil de negocio
activo. Un perfil técnico no puede usar estas operaciones. No aceptar actor,
rol, organización ni clasificación desde selectores de laboratorio.
`requiresMfa` debe ser falso: en el contrato actual empleado admite AAL1/AAL2,
mientras jefe/encargado requieren AAL2 incluso para leer catálogo
(`src/data/supabase/context-contract.ts:66-79`;
`supabase/migrations/202610150014_operational_api.sql:331-343`).

| Acción | Empleado activo | Encargado activo | Jefe activo | Ámbito |
|---|---|---|---|---|
| Leer catálogo neutral publicado | AAL1 o AAL2 | AAL2 | AAL2 | Sólo organización; sin datos particulares de asignaciones/propuestas. |
| Consultar, guardar y enviar inducción propia | AAL1 o AAL2 | No | No | Solicitud del actor; empresa activa y pertenencia a equipo por cada línea. |
| Consultar bandeja y pedir cambios | No | AAL2 | AAL2 | Encargado: empleado activo cuyo `manager_id` sea el actor. Jefe: organización. |
| Publicar/revisar/clasificar catálogo | No | No | AAL2 | Organización y revisiones de catálogo exactas; motivo obligatorio. |
| Aprobar y crear trabajo | No | No | AAL2 | Revisión enviada exacta; empleado activo, sus empresas/equipos y período habilitado. |
| Consultar/repetir un recibo | Sólo los propios y permitidos | Sólo los propios y permitidos, AAL2 | Sólo los propios y permitidos, AAL2 | Reautorizar según el comando original y el ámbito vigente; conocer el ID no concede acceso. |

La bandeja no expone borradores ajenos. Pedir cambios produce una observación
visible al autor de la solicitud; no mueve notas privadas al catálogo.
Las restricciones existentes de bandeja/inducción propia se verifican en
`supabase/migrations/202610150014_operational_api.sql:2786-2813`; la reautorización
de recibos de aprobación en
`supabase/migrations/202610150014_operational_api.sql:2749-2774`.
La matriz define la superficie nueva; no amplía los permisos de consultas legacy.

Los conceptos `company_accounting_close` y `monthly_indicator_close` clasifican
trabajo; no ejecutan un cierre del sistema ni conceden permiso para hacerlo.
El cierre mensual existente conserva jefe/encargado activos con AAL2 y ámbito
autorizado, incluidos sus controles por empresa; no se restringe a jefe por
la fila de aprobación de onboarding. Fuentes:
`supabase/migrations/202609300002_workflows.sql:8-12` y
`supabase/migrations/202610060011_coordination_activation.sql:1655-1668`.

## Flujo de publicación y aprobación

1. Jefatura publica versiones neutrales con definición, controles/unidad,
   medición, vigencia y motivo; empresa/equipo no forman parte del catálogo.
2. El empleado elige versiones publicadas o redacta una personalizada sin
   clasificar. Guardar conserva revisiones de propietario, solicitud y borrador;
   reconectar recupera el borrador del servidor. No sobrescribir otro guardado.
3. Enviar fija un snapshot inmutable, incrementa revisión y no crea trabajo.
   El estado enviado no admite edición directa.
4. Si hay personalizadas, jefatura publica por separado una definición neutral
   revisada, sin copiar datos privados. Encargado/jefatura solicita cambios con
   la referencia pertinente. El empleado reemplaza la propuesta por la versión
   publicada y envía una nueva revisión. No se retoca la revisión anterior.
5. La aprobación v3 rechaza cualquier línea personalizada restante. Revisa
   conceptos, empresa/equipo, propietario, período actual, recurrencia, controles
   y métricas. Comprueba revisiones de catálogo y solicitud, membresías vigentes,
   mes abierto y límites antes de materializar. Sólo entonces crea asignaciones
   y ocurrencias de esa revisión, atómicamente y una sola vez.

Si el catálogo cambia durante revisión, la primera aprobación falla y exige
corregir/reenvío; no cambia una referencia por la última versión. Mantener los
límites existentes de 100 líneas y 1000 ocurrencias por aprobación, sin volver
metas de finalización las actividades operativas. La lógica vigente está en
`supabase/migrations/202610150014_operational_api.sql:2214-2259,2274-2295`.

Con cero selecciones el empleado puede guardar vacío y continuar otras etapas;
no invoca `submit` ni `approve`. La UI muestra «Sin propuestas enviadas» y no
declara que se aprobó un plan de trabajo. Una selección posterior usa las
revisiones vigentes. No tener catálogo publicado no crea defaults ni bloquea
esa continuación sin propuestas.

## Compatibilidad, errores y reintentos

Los esquemas nuevos son `exact` en todos sus niveles, con UUID, fechas,
decimales, unicidad de líneas, revisiones y límites validados también en SQL.
El sobre v3 conserva la forma de comando
`contractVersion/operationId/kind/expectedRevisions/payload` y de consulta
`contractVersion/kind/filters/cursor/limit`, ambos con literal 3. Las respuestas
y los cursores v3 tienen versión explícita; no se reutilizan cursores v1 como
si tuvieran otra semántica. Consultas nuevas proyectan clasificación resuelta,
sin agregar campos a respuestas v1.

El nuevo lector conserva los payloads v1/v2, incluidas proyecciones legacy que
requieren reenvío. Migrar un borrador editable a v3 exige acción explícita y
revisiones esperadas; una versión enviada o recibo nunca se convierte en el
lugar. La consulta v3 identifica `payloadVersion` y devuelve la unión exacta
correspondiente, sin traducir una versión aprobada a la taxonomía vigente.

Un cliente v1 frente a contenido v3 recibe error explícito de actualización:
SQLSTATE `0A000`, código estable `GP_PROTOCOL_UPGRADE_REQUIRED`; no un DTO v1
incompleto ni un payload v3 bajo `payloadVersion=2`. Los cambios futuros deben
aplicar ese guard a lectura, bandeja y escrituras legacy que no puedan preservar
el significado. Los comandos v1 de creación legacy siguen creando versiones
sin clasificar; una revisión/peso v1 contra una plantilla ya clasificada se
rechaza con ese error para evitar degradación por omisión. La lectura de
trabajo histórico y sus replays autorizados se conserva. El error estable es
una decisión nueva: el transporte actual sólo distingue fallo `server`
(`src/data/supabase/operational-transport.ts:8-10,68`), por lo que requiere
adaptación y prueba, sin registrar el contenido privado de la respuesta.

La idempotencia usa el mismo espacio de identidad `(actor, operationId)` para
evitar duplicaciones entre protocolos. Reutilizar operación con otros
argumentos, comando o versión produce conflicto; el contrato v3 incluye su
versión en los argumentos canónicos nuevos. No modificar argumentos ni
resultados de recibos v1 ya guardados. Recuperar un recibo histórico conserva
su versión original y las verificaciones actuales del comando original.

Un replay exacto es una lectura reautorizada del recibo y versión enviada
original: no valida de nuevo elegibilidad del catálogo actual, no materializa,
no crea audit/outbox/activaciones y no avanza fences. Sí vuelve a comprobar
actor, rol/AAL y membresías/pertenencias exigidas actualmente por esa familia,
serializado frente a su revocación. Conservar el orden de locks y los controles
RC/RR existentes; un cambio de contrato no permite atajos por recibo. La rama
actual de aprobación es explícita sobre esa separación
(`supabase/migrations/202610150014_operational_api.sql:2181-2212`).

## Migración futura y puertas de aceptación

No implementar hasta aprobar este borrador. Después crear una migración nueva
posterior a 016, con hash exacto y revisión independiente. No agregar columnas
a asignaciones/tareas ni reescribir snapshots de cobertura. Además de columnas,
restricciones e inmutabilidad de referencias, revisar todos los productores:
aprobación, asignación directa, tarea puntual, materialización mensual y RPC
legacy; ninguno debe perder, sustituir o falsificar la referencia histórica.
Mantener RLS, ausencia de DML directo para clientes, funciones privadas
revocadas y `SECURITY DEFINER` con `search_path=''`. Las rutas legacy que no
puedan preservar la clasificación deben fallar explícitamente.

Primero validar replay local limpio de 001–016 más candidata y upgrade desde
un fixture 001–016 con historia sintética. Exigir rollback completo ante fallo
tardío, preservación de recibos/snapshots/cierres y verificación de ACL/funciones.
Una migración local aceptada no autoriza aplicación remota: preflight, destino,
historial, hash y procedimiento DEV requieren aceptación separada.

| Familia de aceptación | Casos y resultado exigido |
|---|---|
| Taxonomía | Los 26 códigos, NULL/NULL histórico, parejas incompletas, versión desconocida, código inventado y `other_pending_review`; sólo los pares permitidos persisten. Sin inferencia por título. |
| Autoridad | Clasificación/actor/organización inyectados, ID de versión ajena, versión no publicada/inactiva/futura y cambio de referencia histórica; rechazo sin efectos. |
| Roles y ámbito | Cada celda de la matriz; AAL1/AAL2, perfil inactivo/técnico, organizaciones ajenas, empresa revocada y equipo ajeno. Catálogo común no expone trabajo de terceros. El cierre mensual conserva jefe/encargado con AAL2 en ámbito autorizado; clasificar una tarea de cierre no cierra el mes ni concede ese permiso. |
| Personalizadas | Publicación separada, petición de cambios, envío posterior y aprobación catálogo; una personalizada restante bloquea aprobación y nunca se publica al aprobar. |
| Cero selecciones | Guardar vacío y continuar no envía, aprueba ni genera trabajo; sin catálogo conserva ese comportamiento. |
| Revisiones | Borradores concurrentes, doble envío, pedido de cambios contra revisión obsoleta y catálogo cambiado; conflicto determinista, snapshot enviado intacto. |
| Idempotencia y concurrencia | Reintento exacto, doble aprobación, operación con argumentos/protocolo diferentes; una activación por línea. Carreras de revocación/aprobación y replay bajo RC/RC y RR/RR, ambos ganadores, con bloqueo real y sin efectos de replay. |
| Historia y versiones | Nueva clasificación/peso no altera tareas anteriores; futuras materializaciones resuelven la versión de la asignación, no la cabecera actual. `catalogue.weight` v3 nuevo contra fuente NULL/NULL falla con `GP_CLASSIFICATION_REQUIRED` sin efectos y exige revisión clasificada previa; un replay exacto autorizado devuelve su recibo antes de ese guard. Coberturas previas continúan válidas. |
| Compatibilidad | Lectura de payloads 1/2/3, recibos v1 exactos, rechazo explícito de clientes antiguos frente a contenido v3, cursor de versión ajena y ausencia de campos nuevos en DTO v1. |
| Transacción y privacidad | Fallo tardío revierte catálogo/activaciones/trabajo/recibo del comando correspondiente; límites, mes cerrado, ACL/RLS y ausencia de datos privados en catálogo, logs y evidencia. |

Actualizar contratos, tipos, SQL, proyecciones, transporte y UI en etapas
revisables; ejecutar pruebas de contrato/integración PostgreSQL y luego suite,
TypeScript, builds y paquete Sites. Evidencia sintética reproducible y hash del
candidato son requisitos de aceptación, no resultados de esta revisión.
Finalmente probar DEV con identidades ficticias. Mantener Auth operativo
apagado, Site privado y cuentas reales sin invitar hasta aceptación completa y
verificación desde la PC personal.

## Fuera de esta evidencia

No existe un extracto autorizado que permita contar personas o tareas actuales.
Capturas, seed y snapshot viejo sólo describen muestras del laboratorio; no son
una estimación de la organización. El estimador local sigue disponible, pero
los datos de entrada, clave y extractos seudonimizados deben permanecer fuera
de GitHub. Las cifras se informarán sólo después de validar cobertura,
permisos, zona horaria, asignaciones conjuntas, re-aperturas y actividad real.
