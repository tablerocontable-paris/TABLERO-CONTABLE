# M2.2A: protocolo API y registros operativos

Fecha: 15/10/2026. Contrato ejecutable después de la aceptación local de M2.1.
Implementación recomendada: GPT-6 Luna, medio, Standard. Revisión: Sol alto.
Leer AGENTS, EXECUTION-NEXT, SUPABASE-M2-CONTRACT y M2-1-SOL-ACCEPTANCE.

## Entrega y límites

Crear `supabase/migrations/202610150014_operational_api.sql`, contratos estrictos
en `src/data/supabase/operational-contract.ts`, tests SQL/decoder y runner nativo.
Se permiten helpers SQL bajo app_private y fixtures/tests locales. Conservar001–013
y no instalar dependencias. No conectar App, main.tsx, Worker/D1, transporte
Supabase, cuentas ni Site. Se prueba el servidor y DTO, sin activar la UI nueva.

M2.2 completo comprende A (este documento), B (seguimiento/dependencias) y C
(onboarding/catálogo/creación sin metas). B/C todavía no son ejecutables.014 se
mantiene como migración local en preparación y no se aplica a un proyecto alojado
hasta completar/aceptar M2.2. Las siguientes ampliaciones de014 sólo podrán hacerse
mientras no exista despliegue alojado; si eso cambia, detener y definir nueva
versión.015/M2.3 continúa reservado al cierre por empresa.

En A se trabaja con las tareas operativas existentes. Sus `target`, `weight` y
definiciones antiguas conservan valores y semántica legacy. La nueva API no los
presenta como objetivo ni los convierte en peso por movimiento. Eliminar esos
campos del DTO no equivale a haber migrado la creación de nuevas tareas: eso se
resuelve en C, junto con las restricciones actuales que exigen target positivo.

## Datos y compatibilidad

Nuevas tablas app_private, todas con RLS, cero policies/grants cliente/servicio y
FK de organización consistente. UUID de autores siempre refiere a profiles;
cuenta técnica no puede autorizar estos comandos.

| Tabla                           | Campos y restricciones requeridos                                                                                                                                                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| operational_rate_heads          | id UUID PK; organization_id/company_id; template_id o instance_id, exactamente uno; unique NULLS NOT DISTINCT(organization_id,company_id,template_id,instance_id); config_revision bigint>=0 default0; fence_epoch bigint>=0 default0. FK compuesta a companies y template/task de la misma organización.        |
| operational_rate_versions       | id UUID PK; head_id; version bigint>0; effective_on date; unit texto1..80 tomado del template/tarea; unit_weight numeric(20,6)>0 y<=1000000; reason texto normalizado5..1000; created_by; created_at reloj servidor; unique(head_id,version). Inmutable UPDATE/DELETE mediante trigger, sin cascada destructiva. |
| operational_assessments         | instance_id PK; organization_id; revision bigint>0; FK a task_instances de la misma organización. Cabecera de versión actual, sin sobreescribir el historial.                                                                                                                                                    |
| operational_assessment_versions | id UUID PK; instance_id; revision bigint>0; quality/order_score/timeliness enteros0..100 NOT NULL; observation5..1000; evaluated_by; evaluated_at servidor; unique(instance_id,revision). Inmutable.                                                                                                             |
| api_operation_fences            | actor_id/operation_id UUID PK compuesto; fence_epoch bigint>=1. Fila técnica para serializar reintentos con snapshots RC/RR.                                                                                                                                                                                     |
| api_command_receipts            | actor_id/operation_id PK compuesto; organization_id; kind; arguments JSONB validado completo; result JSONB estricto; created_at servidor. Inmutable, sin acceso cliente directo; no borrar recibos para permitir reutilizar IDs.                                                                                 |

No crear duplicados de profiles, tareas, sesiones o cantidades. Reusar
public.activity_entries añadiendo únicamente:

- measurement_version smallint NOT NULL DEFAULT1 CHECK IN(1,2).
- operational_rate_id UUID NULL FK operational_rate_versions y
  operational_unit_weight numeric(20,6) NULL CHECK>0<=1000000.
- unit_snapshot texto NULL para v1 y obligatorio1..80 para v2, copiado por servidor
  desde la tarea. Una vez que existe actividad v2, un trigger impide cambiar unit
  en esa instancia. Reglas futuras de catálogo no renombrarán la unidad histórica.
- Pareja rate_id/weight ambos NULL o ambos NOT NULL; v1 exige ambos NULL.
- V2 con coeficiente conserva exactamente el valor de la versión referida;
  comprobar scope empresa/actividad/tarea y vigencia al insertar, no confiar en
  campos enviados por el cliente. Columnas de snapshot inmutables.
- `reference` pasa a nullable: v1 sigue exigiendo texto no blanco; v2 permiteNULL
  o texto normalizado1..2000. Cambiar sólo NOT NULL/CHECK correspondiente, sin
  modificar ninguna referencia histórica. El writer legacy sigue exigiendo
  referencia; no se relaja su contrato.

Migración: ninguna fila antigua se recalcula o recibe coeficiente inventado.
Todas las entradas previas quedan measurement_version 1 con snapshots NULL.
Usar capturas de columnas originales para demostrar que sus valores no cambian;
to_jsonb completo ahora incorpora las columnas nuevas y no es comparación válida
sin excluirlas. Snapshots JSON de cierres/reportes se comparan literalmente,
incluidos reportes v3/v4 conservados. Nuevas tablas vacías al finalizar migración.

Guard de compatibilidad obligatorio: extender en014 la definición vigente de
public.close_employee_month manteniendo firma y comportamiento v1, para denegar
con0A000/GP_V2_REQUIRES_COMPANY_CLOSE si el universo de cierre contiene entradas v2
(por propietario de tarea o ejecutor del aporte) o evaluaciones v2 del titular.
Esto evita aplicar la fórmula antigua a trabajo nuevo antes de M2.3. No generar
un reporte nuevo con la fórmula legacy y etiqueta v2. Cierres/reportes anteriores
siguen íntegros. No cambiar los archivos de migración anteriores.

## Seguridad común y autorización vigente

Funciones nuevas SECURITY DEFINER, search_path vacío y objetos cualificados.
Sólo `api.query_v1(jsonb)` y `api.command_v1(jsonb)` tienen EXECUTE authenticated;
ningún helper tiene EXECUTE PUBLIC/anon/authenticated/service_role. API schemas
siguen cerrados a CREATE cliente. `get_context_v1` conserva su forma/capabilities[].

Cada entrada llama al contexto aceptado013 y exige principal de negocio activo,
role empleado/encargado/jefe y requiresMfa=false. Actor siempre auth.uid();
organización desde DB. No aceptar actor, rol, autor, coeficiente resuelto ni hora
de servidor del payload. AusenteJWT=>28000; principal/rol/MFA/ámbito inválido=>42501.

Crear helpers separados para consultar/ejecutar/parametrizar:

- Consultar tarea: `public.can_access_instance` como filtro base, misma organización,
  sujeto autorizado vigente y memberships actuales. Supervisor sólo consulta.
- Ejecutar registro: además responsable actual, participante autorizado o
  reemplazo vigente con binding/ausencia sellada para tarea y empresa exactas.
  No confundir `_can_access_instance_at` con permiso de ejecutar: también incluye
  superiores. En operativas rechazar toda responsabilidad conjunta actual; los
  casos antiguos se pueden consultar con requiresJointReview=true.
- Cobertura: registrar auth.uid real, binding/absence resuelto internamente;
  fecha del movimiento debe estar dentro del intervalo autorizado y el período
  de la tarea. Verificar autorización también al instante servidor tras esperar.
- Parametrizar coeficientes y evaluar: sólo jefe activo de esa organización con
  aal2. Una membresía a una empresa de otra organización no concede permiso.
- Calidad detallada (scores/observación/historial): titular evaluado y jefe de
  organización; supervisor encargado y reemplazo no reciben esa observación por
  consultar la tarea. No se mezcla con anotaciones privadas ni notas SQL009.

Los filtros nunca amplían permisos. Una lectura denegada no distingue inexistente
de ajeno. Ningún DTO incluye notas personales, SQL009, tokens, correos o State.

## Protocolo estricto implementado en A

TypeScript exporta schemas Zod/tipos/decoders por cada unión de entrada y salida,
sin transporte ni cliente global. Fallos de decode => {ok:false,error:'protocol'}
sin eco de datos. SQL repite validaciones: el decoder no es frontera de seguridad.
Máximo32KiB por envelope de comando y4KiB por query, además de límites por campo.
UUID de entrada de esta API en forma canónica minúscula; el contexto013 conserva
su contrato previo. Texto se normaliza con el mismo trim ECMAScript en SQL/TS,
conservando espacios internos y saltos. No truncar contenido para hacerlo válido.

CommandEnvelope exacto:
`{contractVersion:1,operationId:UUID,kind,expectedRevisions,payload}`.
expectedRevisions es mapa cerrado con exactamente las claves exigidas por kind;
valores cadenas bigint canónicas `0|[1-9][0-9]*` <=9223372036854775807.

| kind             | payload exacto                                                                         | revisiones exigidas                                                                                | resultado exacto                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| operation.record | {taskId,workDate,quantity,reference} reference:string oNULL; quantity entero1..1000000 | `task:<taskId>`                                                                                    | {entryId,taskRevision,measurementVersion:2,rateId:UUID oNULL,unitWeight:decimalString oNULL,weightedLoad:decimalString oNULL} |
| operation.rate   | {companyId,templateId,taskId,effectiveOn,unitWeight,reason}; scope XORtemplate/task    | `rate:<companyId>:template:<templateId>` o `rate:<companyId>:task:<taskId>`;0 si sin configuración | {rateId,scopeRevision,version,effectiveOn,unit,unitWeight}                                                                    |
| operation.assess | {taskId,quality,order,timeliness,observation}                                          | `task:<taskId>` y `assessment:<taskId>`;0 si sin evaluación                                        | {assessmentId,assessmentRevision,taskRevision,quality,order,timeliness}                                                       |

Respuesta comando: `{contractVersion:1,operationId,kind,result}`. Sin flags de
éxito ficticio ni cuerpo de error mezclado con resultado. UUID devuelve forma
canónica; revisiones/cantidades agregadas/tiempos/cargas son cadenas decimales.
Scores/quantity de un movimiento/limit son enteros JS seguros por sus límites.
Coeficiente de entrada es cadena decimal positiva sin exponente, máximo6decimales
y<=1000000; rechazar más precisión antes de cast para evitar redondeo silencioso.
JSONB compara argumentos completos; "1" y "1.000000" son cadenas distintas para
reutilización del operationId. Fecha civil válidaYYYY-MM-DD, no sólo regex.
Fechas/meses usan ART; capturar clock_timestamp después de adquirir/revalidar.

Query exacta: `{contractVersion:1,kind,filters,cursor,limit}`, cursor:string oNULL,
limit entero1..100 (default no implícito). Las no paginadas exigen cursorNULL y
limit1. Claves extra, null donde no corresponde, tipos coercibles y kind no
implementado se rechazan. A sólo permite:

| kind / filters                                                  | DTO de data                                                                                                                                                                            |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| activityPage / {taskId}                                         | {items:[{entryId,taskId,workDate,quantity,unit,reference,actorId,createdAt,measurementVersion,rateId,unitWeight,weightedLoad}],nextCursor}                                             |
| operationalSummary / {taskId}                                   | {taskId,unit,movementCount,quantity,ratedLoad,weightedLoad,unratedQuantity,recordedSeconds,fullyWeighted,requiresJointReview}; agregados en decimalString salvo booleans y unit:string |
| rateHistory / {companyId,templateId,taskId} scopeXOR, sólo jefe | {scopeRevision,items:[{rateId,version,effectiveOn,unit,unitWeight,createdAt,createdBy,reason}],nextCursor}                                                                             |
| quality / {taskId}, no paginada                                 | {taskId,current:null o {assessmentId,revision,quality,order,timeliness,mean,observation,evaluatedBy,evaluatedAt}}                                                                      |
| commandReceipt / {operationId}, no paginada                     | {found:false} o {found:true,command:respuestaComando}                                                                                                                                  |

Cursor paginado: base64 UTF8JSON del último(createdAt,id), para rates de
(version,id), más filtros canónicos y kind completos. Validar igualdad con query,
tipos y límite de tamaño2KiB; no confiar en su contenido como autorización.
Orden descendente estable, keyset sinOFFSET. No exponer UUID/title de tareas
fuera del ámbito mediante cursor. Los objetos de paginación llevan
`{contractVersion:1,kind,data}` como envelope común. El detalle de todas las
versiones de calidad se conserva en tabla; el query público A devuelve actual.

## Reglas operativas

Rate: sólo actividad operativa, scopeempresa+template o empresa+task. Preferir
override específico de tarea vigente; si no hay, usar templateId de asignación.
Dentro del scope filtrar por unit igual a la unidad de la tarea y elegir
effective_on<=workDate descendente y mayorversion como
desempate. No tener coeficiente permite registrar cantidades/tiempo; ambos
snapshots NULL y weightedLoadNULL. Nunca usar task.weight ni target como sustituto.
Permitir nueva vigencia pasada/futura con motivo; afecta sólo futuras escrituras,
incluidas altas tardías con workDate pasado, nunca filas ya confirmadas.

Record: tarea operativa y fecha del mismo período, no futura frente a fecha ART;
referencia vacía normaliza aNULL y no penaliza. Evidencia/Storage se implementará
enM2.6; no aceptar evidenceIds que todavía no pueden verificarse. Insertar
activityentryv2, incrementar task.state_revision una vez, audit con autorreal y
recibo en la misma transacción. Dos operationIds distintos representan dos
movimientos aunque cantidad/fecha/texto coincidan; no deduplicar por contenido.
No completar tarea ni calcular porcentaje de objetivo.

Summary: cantidad de un único task/unidad; nunca sumar facturas y pagos en una
cantidad común. ratedLoad suma quantity*snapshot conocido con numeric exacto.
unratedQuantity suma entradas sin coeficiente, incluidashistóricas. fullyWeighted
exige todas las entradas ponderadas y coeficiente aplicable al cierre calendario
del período; weightedLoad es ratedLoad sólo entonces, de lo contrarioNULL.
Sin movimientos devuelvequantity 0 y movementCount 0 y estado de configuración real.
recordedSeconds deriva de sesiones de esa tarea, sin duplicar cuotas; reutilizar
public._effective_session_end y _session_cutoff para respetar el corte de cobertura
y un mismo instante servidor. No detener sesiones al consultar ni inferir
presencia o calidad de esos tiempos.
La carga es independiente de puntos logrados y calidad, sin topes100%.

Assessment: operativa individual, criterios enteros0..100, observación5..1000,
guardar versión nueva y aumentar cabecera/revisión de tarea. Sin evaluación es
NULL; cero es una evaluación válida. mean=round((quality+order+timeliness)/3,2)
como decimalString. No cambia cantidades, puntos, cronómetros ocoeficientes.

## Transacciones, reintentos y cierres

Todas las escrituras respetan 011:1101recibo→1102actores→1103perfiles→1104meses
persona/período→1105catálogo→filas canónicas. Usar prepare/acquire/revalidate
existentes para tarea y universo de personas/bindings; extender planv2 en helper
app_private para incluir heads/evaluaciones/revisiones y referencias nuevas.
No adquirir un lock anterior dentro de un helper invocado con locks posteriores.

Después del lock1101, tocar api_operation_fences mediante INSERT ON CONFLICT
DO UPDATE fence_epoch+1. Los reintentos RR obsoletos abortan40001; no convertir
40001 en éxito ni ocultarlo. Recibo completo y fence se confirman juntos.
Antes de devolver recibo o commandReceipt: verificar identidad y permiso actual
para el kind/target; un permiso revocado no devuelve un resultado privado viejo.
Replay autorizado exacto devuelve el resultado original aunque revisión/mes haya
cambiado después del éxito; no reejecuta validación de revisión o writes. Otro
kind/payload/revisiones con mismo operationId=>40001 y cero cambios.

Rateheads se crean vacíos cuando una operación necesita coordinar un scope aún
sin coeficiente. No equivalen a rate configurado. Tras adquirir1105 de ambos
scopes aplicables (template ytask, claves ordenadas), escribir fence_epoch+1 en
ambos heads antes de resolver rate. config_revision sólo cambia al crear rate.
Así registro contra primera parametrización también aborta snapshotsRR obsoletos;
advisory lock sin escritura no basta. Fallos posteriores revierten ambos fences.
Los planes incluyen además `template:<id>` cuando corresponda, para conservar
coordinación con el catálogo legacy. Todas esas claves se preparan juntas antes
de adquirir1105. Las queries nunca crean heads ni modifican fences: rateHistory
de scope sin cabecera devuelve scopeRevision="0" y lista vacía.
Rate por tarea requiere su mes abierto; rate por template no altera unidades
cerradas ni snapshots y no necesita enumerar todos sus meses históricos.

Record/assessment: después de esperar revalidar autoridad, task revision,
responsabilidad, coberturas y cierre legacy de todos los propietarios/ejecutores
afectados. Mes ya cerrado=>55000/GP_CLOSED_UNIT. Estado inválido/inputs=>22023.
Revisión o footprint desactualizado=>40001; permisos=>42501; kind fuera deA=>0A000.
Sin mensajesSQL/observaciones/referencias en logs o errores. Auditoría sólo IDs,
kind, versión y cantidades/criterios permitidos, no texto de referencia/evaluación.

## Comprobaciones y finalización

1. Vacío→014 y upgrade poblado 013→014. Conservar todos los valores de columnas
   previas y snapshots literales; exigir actividades/sesiones/recibos/notas,
   cierres/reportes/outbox no vacíos. Ningún rate/evaluation inventado para v1.
2. Matriz anon/sin JWT/técnico/auditor/inactivo, empleados, encargado y jefe
   aal1/aal2, otra organización, empresas revocadas. Superior consulta pero no
   registra por otro; cobertura exacta y actor real. Nota personal nunca aparece.
3. SQL y Zod rechazan payloads/revisiones/claves extra, coeficiente con exponentes
   o 7 decimales, pérdida de precisión bigint y fechas imposibles; DTO SQL pasan decoder.
4. Referencia NULL y whitespace aceptados en v2; no aceptados por writer legacy.
   Peso antiguo nunca es coeficiente; NULL frente a 0 y versiones/vigencias se distinguen.
5. Scope override/template, entradas antes/después de cambiar tasa y alta tardía;
   historia fija, calidad 0/sin evaluación, observación obligatoria, cierres abiertos.
   Cierre legacy rechaza v2; cierre v1 y snapshots anteriores conservan contrato.
6. Recibo exacto, ID reutilizado con otros args/kind/revisión, permiso revocado,
   resultado ambiguo consultado por su propio actor. No recibos/audit parciales
   al fallar después de insert/update. Reintentos no duplican entradas/versiones.
7. PostgreSQL nativo con sesiones independientes y pg_blocking_pids: rate change
   contra record (incluida primera configuración), replay contra replay, cierre legacy contra record,
   evaluación contra record, revocación/cancelación de cobertura mientras espera. RC/RR en
   ambos órdenes, una sola versión/entrada según caso,40001 explícito, sin 40P01.
8. Focales, suite completa oficial y TypeScript/build cliente/Worker. Confirmar
   que fuente UI y001–013 no cambiaron. Evidencia con comandos/exitcodes/hashes,
   commit y bundle portable validado por clonación limpia.

Terminar A de forma coherente sin crear handlers vacíos de B/C. Actualizar estado
como **M2.2A implementado, M2.2 aún incompleto**, luego revisión Sol alto para
aceptar A y cerrar contratos B/C. No activar cliente ni desplegar014 parcialmente.

Fuentes primarias: [aislamiento](https://www.postgresql.org/docs/17/transaction-iso.html),
[locks](https://www.postgresql.org/docs/17/explicit-locking.html),
[funciones Supabase](https://supabase.com/docs/guides/database/functions).
Los permisos, límites y semántica anteriores son decisiones del proyecto.
