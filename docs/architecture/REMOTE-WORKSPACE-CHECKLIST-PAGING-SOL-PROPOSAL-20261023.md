# Contrato Sol — checklist extenso para workspace remoto

Fecha: 23/10/2026.
Estado: **aceptado para implementación local; código, pruebas y aplicación remota pendientes**.

## Alcance y compatibilidad

Agregar `workspacePageV2` y `taskChecklistPage` como kinds nuevos de `api.query_v1`.
Conservar sin cambios request, respuesta, errores y permisos de `workspacePage`
v1 y todos los kinds anteriores. `contractVersion` continúa siendo 1; el kind
identifica el DTO nuevo. No cambiar datos, comandos, SQL001–014 ni permisos para
resolver un dato histórico irregular. No incluir notas personales, referencias
de actividad, evidencias ni títulos/estados de dependencias.

El contrato base de pertenencia, permiso de actor y agregados es
`REMOTE-WORKSPACE-BOOTSTRAP-CONTRACT-SOL-DRAFT-20261021.md`, aceptado por el
SHA-256 `42849A545D2B63DCFB0507592FB696F19AD070A4FD4C8B926ACB2E76B018E96D`.
Este contrato modifica sólo los DTO nuevos.

## A. `workspacePageV2`

Request exacto: `{contractVersion:1,kind:"workspacePageV2",filters:{subjectId,
period,companyId,teamId,sector},cursor,limit}`. Tipos, límites, normalización,
autorización y orden de filtros son los del request base: sujeto/empresa/equipo
UUID canónico o null; período primer día del mes; sector normalizado o null;
limit entero 1–100; cursor null o base64url canónico sin padding/saltos, máximo
2.048 caracteres. El request completo no excede los 4.096 bytes JSON aceptados
por SQL014. No aceptar claves adicionales.

Cursor de V2: las mismas claves exactas y semántica del cursor base, pero
`kind="workspacePageV2"`: `{kind,cursorVersion,subjectId,period,companyId,teamId,
sector,orderVersion,dueDate,scheduledOn,taskId}`. `cursorVersion=1`,
`orderVersion=1`, sujeto UUID efectivo. Rechazar cursores v1/V2 cruzados. Orden
`dueDate ASC NULLS LAST,scheduledOn ASC NULLS LAST,taskId ASC`; comparar rangos
explícitos de null, sin un centinela que colisione con fechas reales.

Envelope exacto: `{contractVersion:1,kind:"workspacePageV2",data:{evaluatedAt,
items,nextCursor}}`. Conservar las claves y variantes del item base; agregar
`checklistState` y `checklistControlCount`, cambiando únicamente la representación
de `checklist` según estas reglas:

- `inline`: entre 0 y 100 controles representables, todos con texto de 1 a
  1.000 puntos de código. `checklist` lleva todos los controles, con forma
  exacta `{id,text,done}`. Nunca una fracción del arreglo.
- `paged`: longitud del arreglo >100, sin inspeccionar todas sus entradas; o
  arreglo de hasta 100 entradas que no tiene anomalías de formato pero contiene
  texto >1.000 puntos de código. `checklist=[]`.
- `requires_review`: arreglo de hasta 100 entradas con alguna anomalía de las
  reglas de normalización B. `checklist=[]`. Si concurren anomalía y texto
  extenso, prevalece `requires_review`. Un arreglo >100 siempre es `paged`;
  sus anomalías se reportan cuando se lee el detalle, no durante bootstrap.

`checklistControlCount` es `jsonb_array_length(checklist)`, entero exacto
0–2.147.483.647. SQL001 garantiza arreglo JSONB; la implementación debe comprobar
ese invariante antes de expandir y tratar una violación administrativa como
error técnico, nunca como un arreglo vacío. Para operativas v2, el arreglo
almacenado debe ser vacío y la salida es `inline`, count 0 y `[]`.

No copiar ni agregar texto extenso en el DTO inicial. Para clasificar hasta
100 entradas se permite comprobar forma y un prefijo suficiente para determinar
si supera 1.000 puntos; no materializar listas completas de textos largos.
La irregularidad de un control no hace fallar toda la página V2. Se preservan
los demás límites base; este contrato no redefine títulos, nombres o unidades.

La UI remota usará V2 y ofrecerá lectura de detalle para `paged` y
`requires_review`. Este contrato no impone 64 KiB al bootstrap: ese límite es
exclusivo de cada respuesta `taskChecklistPage`. No afirmar tamaño acotado de
V2 por ese mismo valor.

## B. Normalización de controles y segmentación

La representación es exclusivamente de lectura y no modifica el JSONB original.
Identificar cada control por ordinal 1-based; conservar orden y duplicados.

Formas conocidas:

1. String JSON: su valor exacto es el texto y `done=false` (forma legacy).
2. Objeto: reconocer sólo `text`, `done` e `id`. Texto válido si la clave `text`
   existe y es string; `done` ausente significa false por compatibilidad,
   booleano presente se conserva y otro valor presente significa `done=null`.
3. Otra forma JSON: control de tipo inválido, sin texto conocido y `done=null`.

No convertir números, arrays, objetos o null a texto, ni buscar alternativas
en claves desconocidas. No recortar ni normalizar texto; espacios y saltos se
conservan, texto vacío significa longitud cero, no texto compuesto por espacios.
Las claves desconocidas se ignoran y nunca se devuelven.

`id`: conservar únicamente el ID string con forma UUID canónica minúscula
`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`. Si falta o
no tiene esa forma, generar el ID de presentación ya usado en SQL015:
`md5(taskId::text || ':' || ordinal::text)`, dividido 8-4-4-4-12 con guiones.
No introducir otro algoritmo ni usar ese ID sintético para escribir controles.
IDs repetidos se conservan; la clave de lectura/deduplicación es ordinal+offset.
Un ID inválido o ausente por sí solo no es una anomalía de texto/done.

`issueCode` es null o el primer problema aplicable en este orden:
`invalid_type` (ni string ni objeto), `text_missing` (objeto sin clave text),
`text_invalid` (text presente y no string), `text_empty` (string de longitud 0),
`done_invalid` (texto reconocido y done presente no booleano). El diagnóstico
primario no oculta el valor done: con texto conocido preservar su booleano o
null según lo anterior. Sin texto reconocido devolver done null. Un texto
conocido se entrega completo por partes aunque done sea inválido; issueCode y
done se repiten idénticos en todos sus segmentos.

Todas las longitudes/offsets son puntos de código Unicode: SQL `char_length` y
`substring`, en JS iteración por puntos (`Array.from` o equivalente), jamás
`String.length`/slice UTF-16. No usar longitud UTF-8 como offset, no normalizar
Unicode y no dividir pares sustitutos. Cortar entre puntos puede dividir un
grafema combinado: está permitido y la concatenación exacta debe restaurarlo.
Texto PostgreSQL/JSONB válido no contiene U+0000 ni sustitutos aislados; no se
crea ni se exige soporte para estados que JSONB rechaza al almacenar.

Para texto reconocido no vacío de longitud L, producir segmentos deterministas
con offsets 0,512,1024,... menores que L; cada pieza tiene exactamente
min(512,L-offset) puntos. `textComplete` es true sólo cuando offset+longitud de
la pieza=L; significa final de ese control, no final de página/lista.
Para texto vacío o no reconocido producir exactamente una pieza, offset 0,
textPart vacío, textLength 0 y textComplete true. No producir una pieza vacía
adicional después del último segmento de un texto no vacío.

## C. Request, cursor y DTO de `taskChecklistPage`

Request exacto:
`{contractVersion:1,kind:"taskChecklistPage",filters:{taskId,subjectId,
taskRevision},cursor,limit}`.

- taskId UUID canónico minúscula; subjectId UUID canónico o null (actor).
- taskRevision string decimal canónico en 0–9.223.372.036.854.775.807, idéntico
  al tipo revision del contrato base. No coercionar números JSON a strings.
- limit entero 1–16; cursor null o base64url canónico sin padding/saltos,
  máximo 2.048 caracteres; request máximo 4.096 bytes como los otros queries.
- Claves exactas, enums/límites iguales en SQL y Zod. Las fechas de respuesta
  son timestamps ISO con zona conforme al tipo ya publicado.

Cursor JSON exacto:
`{kind:"taskChecklistPage",cursorVersion:1,taskId,subjectId,taskRevision,
ordinal,textOffset}`. subjectId siempre es UUID efectivo. taskId/revisión/sujeto
se ligan a los filtros efectivos. Versiones, claves extra, tipos incorrectos,
base64url no canónico y cualquier discrepancia se rechazan. El cursor no es
credencial ni firma: un cursor bien formado que seleccione otra posición legal
es sólo paginación, y siempre requiere permiso actual sobre tarea/sujeto.

El cursor apunta al **próximo segmento no devuelto**, no al último emitido.
Cursor null empieza en (ordinal=1,offset=0). Para un arreglo no vacío,
ordinal debe estar entre 1 y totalControls. En texto conocido no vacío, offset
debe ser múltiplo de 512 y 0<=offset<L. En texto vacío/no reconocido, sólo
0 es válido. No aceptar posiciones al final del texto/lista como páginas vacías:
el servidor entrega nextCursor=null cuando ya terminó. Si el arreglo es vacío,
cursor null devuelve items=[] y nextCursor=null; todo cursor no nulo se rechaza.

Respuesta exacta:
`{contractVersion:1,kind:"taskChecklistPage",data:{evaluatedAt,taskId,
taskRevision,totalControls,items,nextCursor}}`.

Cada item tiene exactamente `{id,ordinal,textPart,textOffset,textLength,
textComplete,done,issueCode}`:

- id UUID según B; ordinal entero 1–2.147.483.647.
- textPart string de 0–512 puntos, textOffset/textLength enteros
  0–2.147.483.647; textLength es L total, no longitud de la pieza.
- textComplete booleano; done booleano o null; issueCode enum definido en B.
- Validar relaciones cruzadas: offset y longitud cumplen B, pieza sin texto
  conocido/vacía cumple su forma única; diagnósticos y done son consistentes.
- totalControls entero 0–2.147.483.647; taskRevision vuelve exactamente el
  revision solicitado y comprobado; items tiene 0–limit segmentos en orden.
  Con lista no vacía y posición legal, devolver al menos un segmento.

Generar a partir de la posición inicial un prefijo consecutivo de hasta limit
segmentos, continuando al ordinal siguiente sólo después del último segmento
del actual. No omitir controles inválidos. nextCursor señala la primera pieza
pendiente si existe; de otro modo null. Cambiar limit entre páginas es válido.

## D. Límite de 64 KiB y costo

El presupuesto es 65.536 bytes inclusive del **envelope JSON completo**, no sólo
items. La medición autoritativa del servidor es
`octet_length(convert_to(response_jsonb::text,'UTF8'))` del objeto final con
nextCursor definitivo. Incluye claves, IDs, diagnósticos, escape JSON y cursor;
no incluye cabeceras HTTP, compresión, encuadres de una herramienta ni whitespace
arbitrario añadido por un intermediario. El consumidor valida además bytes de
`JSON.stringify(objeto)` y rechaza un payload fuera de contrato.

No asumir que 512 puntos ocupan siempre 2.048 bytes una vez serializados:
comillas, barras inversas y controles escapables cambian el tamaño. Construir
hasta 16 piezas, medir el objeto final y, si excede el presupuesto, quitar
piezas del final y regenerar nextCursor hasta que quepa. **Nunca acortar una
pieza**, porque invalidaría la cuadrícula de offsets. Mantener al menos una
pieza cuando hay contenido. Con estos límites de campos una pieza cabe; si la
implementación no puede satisfacerlo, fallar técnicamente con SQLSTATE 54000 y
mensaje estable `checklist_response_too_large`, sin texto parcial ni cursor.
No presentar ese error como truncamiento exitoso.

Acceder a los ordinales necesarios de la fila autorizada; no expandir ni
normalizar todo el array en cada página, ni agregar actividad/sesiones. El costo
de leer/detoastar el JSONB y calcular la longitud del texto actual puede crecer
con el valor almacenado: 16 piezas y 64 KiB limitan salida, no prometen costo
constante de la base. Registrar ese costo y evitar recorridos redundantes del
resto de controles. Sin datos nuevos ni límites destructivos al contenido.

## E. Autorización, revisiones y consistencia

Derivar actor de auth.uid(); usar el contexto empresarial/MFA de SQL014 y
organización actual. Todas las solicitudes, con o sin cursor, comprueban tarea,
pertenencia del sujeto, can_access_instance y, si sujeto!=actor, rol,
can_access_owner y los límites adicionales de equipo/membresía/supervisión del
contrato base. La autoría histórica no conserva acceso revocado. Para terceros
se usa la misma pertenencia base, incluyendo contribución histórica únicamente
cuando todavía hay permiso actual, sin introducir una diferencia accidental
con workspacePageV2. Equipo compartido o conocer un UUID nunca concede permiso.

Comprobar autorización **antes de informar revisión o datos del checklist**.
Sujeto desconocido/inactivo, tarea desconocida/otra organización y acceso
revocado producen SQLSTATE 42501 con mensaje uniforme `Consulta no disponible`;
no devolver taskRevision, totalControls ni cursor. Request/cursor malformado usa
22023 `Consulta inválida`; discrepancia de revisión y dato autorizado usa 40001
`task_changed`, sin respuesta parcial. Un cursor sintácticamente válido con
revisión distinta del request es inválido, no un mecanismo para consultar una
revisión histórica.

Autorizar, verificar la revisión, leer checklist y construir la página desde
**la misma versión de fila y snapshot de sentencia**. No verificar revision en
una lectura y construir con otra lectura posterior. El request RPC usa una
transacción nueva/snapshot actual; no reutilizar snapshots de una transacción
persistente de cliente. Revocaciones confirmadas antes de ese snapshot deben
denegar; una revocación concurrente posterior no puede retirar bytes ya leídos.
No prometer serialización contra revocaciones tras ese punto ni adquirir locks
nuevos con orden incompatible con la coordinación existente. Pruebas deben
mostrar que la lectura se corresponde enteramente con revisión vieja o nueva,
y que el request posterior ve la revocación/cambio confirmado.

`taskRevision` solicitado debe coincidir exactamente con state_revision de esa
fila. Antes de aceptar código, demostrar que cada ruta autorizada que modifica
checklist incrementa state_revision y que los roles de app no tienen UPDATE
directo que lo evada. No dar por cierta esa propiedad por documentación. Si
se encuentra una ruta que la viola, bloquear aceptación de código y proponer
la corrección mínima; no sustituir silenciosamente la revisión por un hash ni
cambiar el protocolo. Cambios de tarea ajenos al checklist también pueden
incrementar revisión: provocar reinicio conservador es comportamiento válido.
Ediciones privilegiadas fuera del protocolo no quedan cubiertas por esta garantía.

Cliente: reconstruir por ordinal, offsets contiguos y misma revisión; conservar
ID, done, issueCode y textLength constantes por control. Reintentar un request
fallido con el mismo cursor sólo para errores transitorios y con un máximo
configurado; deduplicar (ordinal,offset). Ante 40001 task_changed descartar toda
la reconstrucción de esa tarea, refrescar su revisión y empezar cursor null.
Ante 42501 eliminar detalle accesible y detener solicitudes. No hacer bucles
infinitos; mostrar acción de reintento al agotar el presupuesto. evaluatedAt
puede variar entre páginas y no se usa como revisión. Marcar lectura completa
sólo al recibir nextCursor null y verificar que cubre los ordinales 1..N y sus
textos completos, incluso cuando tienen issueCode. Mostrar por separado que una
lectura terminó y que hay controles pendientes de revisión. No ejecutar
comandos ni corregir valores desde este endpoint de lectura.

## F. Evidencia necesaria para aceptar la implementación

- V1: contratos/errores anteriores intactos y delegación de todos los kinds de
  SQL014 preservada. V2: 0/100/101 controles; textos 0/1/1.000/1.001;
  combinación de texto largo y anomalía, anomalía después del ordinal 100;
  operativa v2 con arreglo vacío. Comparar count y estados SQL/Zod.
- Normalización: cada tipo JSON, text ausente/null/no string/vacío/espacios,
  done ausente/booleano/null/no booleano, claves privadas desconocidas,
  ID válido/faltante/no canónico/duplicado; verificar que jamás se devuelve raw.
- Segmentos: longitudes 0/1/511/512/513/1.024/1.025; emojis, combinaciones,
  comillas, barras y controles escapables válidos para JSONB; reconstrucción
  exacta por puntos; límite de 16, cambio de limit y reintentos de la misma página.
- Cursores: codificación canónica, límites de bytes, keys/types/version/kind,
  sujeto/tarea/revisión distintos, offsets negativos/mitad de pieza/final de
  texto, ordinal fuera de lista, arreglo vacío, salto legal autorizado y cruce
  v1/V2; comprobar continuidad sin saltos en todas las fronteras generadas.
- Medir el envelope completo final con escapes/nextCursor; probar reducción
  del número de piezas mediante el constructor de presupuesto si el máximo
  actual no alcanza naturalmente 64 KiB. No crear datos JSONB imposibles.
- Roles, MFA, jefe de otra organización, encargado propio/tercero, traslado de
  equipo, revocación de empresa/supervisión/cobertura y pertenencia histórica;
  pérdida confirmada entre páginas y carrera controlada con edición/revocación.
- Acreditar incremento de state_revision de todas las escrituras autorizadas de
  checklist y ausencia de UPDATE directo del cliente; revisión uniforme de cada
  página y descarte/reinicio del consumidor cuando cambia.
- TypeScript/DTO SQL-Zod, suite afectada, build y evidencia nativa PostgreSQL.
  Benchmark RPC completo con 2.000 tareas, un checklist de 10.000 controles y
  texto de al menos 1 Mi puntos, registrando bytes/tiempos/planes/equipo; medir
  primera página y una posterior. La navegación del tablero conserva el objetivo
  vigente; reportar por separado el costo del detalle sin inventar un SLA nuevo.

## G. Secuencia y dictamen

La revisión independiente de esta versión deja el contrato **apto para Luna,
sólo implementación y pruebas locales**. La aceptación del contrato no acepta
SQL/TS existentes o futuros ni comprueba funcionamiento. El hash final se
registra en el informe del revisor para evitar autorreferencia.

Preflight/aplicación 001–014 continúa por su puerta separada en DEV exacto.
No aplicar SQL015 mientras no integre V2/detalle y no tenga revisión de código,
hashes y evidencia aceptados. Implementar en 015 sólo si no se aplicó; si ya se
aplicó, proponer migración aditiva siguiente sin reescribir historia desplegada.
Actualizar el guard/workflow solamente después de aceptación del candidato.
No habilitar UI operativa, producción, usuarios reales ni publicación compartida.
