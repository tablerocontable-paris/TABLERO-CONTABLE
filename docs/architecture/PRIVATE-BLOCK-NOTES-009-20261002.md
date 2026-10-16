# Contrato ejecutable Luna — B1 / comentarios privados 009

**GPT-6 Luna, esfuerzo medio, Standard.** Implementar sólo este contrato en
laboratorio local. SQL001–008, frontend/App/localStorage, lector/gateway vigentes,
dependencias y snapshots históricos quedan intactos. No crear servicios ni
aplicar SQL remoto. Decisiones relacionadas: COORDINATION-B-DESIGN-20261002.md.

## Alcance y superficie

Nueva migración `supabase/migrations/202610020009_private_block_notes.sql` en una
transacción. No reemplazar funciones existentes ni guardar texto privado en
blocked_by. Ese campo sigue siendo la causa operativa común; la separación de su
selector/validación y adaptación UI se hará al integrar, sin convertir sus textos
históricos automáticamente en comentarios privados. 009 por sí sola no hace
confidencial información previamente introducida en un campo público.

Añadir dos tablas de texto privado y una de receipts privados:

- `task_private_block_notes`: id UUID, organization_id, instance_id, author_id,
  body TEXT, revision BIGINT (>=1), created_at/updated_at TIMESTAMPTZ,
  cleared_at TIMESTAMPTZ nullable. Unique(instance_id,author_id) y unique(id,org).
  FKs compuestas a task_instances/profiles con organization_id. Body activo:
  trim no vacío y 1–2000 caracteres; cleared: body='' y cleared_at no null.
- `task_private_block_note_versions`: note_id, organization_id, revision,
  body, cleared_at, at, actor_id. PK(note_id,revision), FK compuesta a nota y
  perfiles. Append-only, sin UPDATE/DELETE, historial de crear/editar/limpiar.
- `private_block_note_receipts`: organization_id, actor_id, operation_id,
  arguments JSONB, result JSONB, created_at; PK(actor_id,operation_id), FK
  compuesta a perfil. **No reutilizar task_mutation_receipts para el cuerpo**:
  ese JSON genérico tampoco debe contener esta información privada.

RLS habilitada en todas. Authenticated sólo SELECT en notas/versiones bajo la
política siguiente, ninguna escritura directa. Receipts sin grants de lectura o
escritura a anon/authenticated, internos al RPC. Revocar privilegios por defecto
PUBLIC/anon de funciones; security definer con search_path vacío y nombres
calificados. Guardas contra UPDATE/DELETE de versiones, incluso sesión elevada.
No otorgar nuevas facultades de diagnóstico a role auditor.

## Lectura explícita — no delegar a can_access_instance

Helper `can_read_private_block_note(p_note uuid) returns boolean`:
Auth activa, role operativo (auditor denegado antes de comprobar autor) y
organización de actor/nota coinciden; entonces:
1. Autor: puede leer su propio texto/historial aunque haya expirado cobertura o
   ya no vea la tarea. Esto **no** autoriza SELECT sobre tarea/perfil del titular.
2. Jefe activo de esa organización: puede leer.
3. Encargado activo: author_profile.manager_id=auth.uid() y membresía del
   encargado en la empresa de la ocurrencia. No exigir que el autor siga activo
   para leer su historia, pero siempre aplicar manager_id actual.
4. Auditor/otro empleado/otro equipo/otra organización: no. Participación,
   cobertura, ser persona mencionada o can_access_instance no dan lectura ajena.

La política de versiones usa la misma nota/autor; nunca concede historia por
manager_id snapshot. Un cambio de encargado revoca lectura al anterior en la
próxima consulta. El helper no devuelve cuerpo ni lista de notas. No modificar
RLS de tareas, perfiles, sesiones ni empresa en este bloque.

## Única RPC de escritura

`save_private_block_note(p_instance uuid, p_body text,
 p_expected_revision bigint, p_operation_id uuid) returns jsonb`

Return exacto: `{note_id: UUID, revision: integer, cleared: boolean}`. Autor
siempre auth.uid(), sin p_author ni p_org manipulables. El jefe/encargado sólo
escribe su propia nota sobre una tarea autorizada; no edita la de otra persona.
P_body null limpia; trim vacío no null se rechaza. Se requieren expected>=0 y
operation UUID. Crear exige expected=0 y cuerpo; no se crea una nota vacía.
Editar/limpiar exige expected=revision vigente. Limpieza no borra historia.

Orden y validaciones:
1. Verificar Auth/perfil activo, role operativo (empleado/encargado/jefe), org,
   p_instance/operation/revision, texto y longitud antes de cualquier resultado.
2. Lock actor+operation igual al namespace de receipts actuales
   hashtextextended(auth.uid()::text||p_operation_id::text,0). Consultar receipt
   privado: argumentos idénticos devuelven result original, sin otro efecto;
   distintos rechazan. Un replay de receipt propio después del cierre devuelve
   sólo id/revision/cleared, nunca texto. Inactivo u otra organización denegados.
   Los operationId se interpretan en el namespace privado de este módulo; el
   mismo UUID en otro módulo no es su receipt. Compartir el lock de operación
   serializa peticiones, sin mezclar argumentos/resultados ni cambiar receipts008.
3. Obtener propietario/período de la ocurrencia de la organización del actor.
   Adquirir work-owner:<owner UUID> y lock_open_month(owner,period) en el mismo
   orden de 008; después lock fila task_instances y revalidar su identidad.
4. Corte=clock_timestamp() tras locks. Verificar
   `_can_access_instance_at(instance,cutoff)` y permisos operativos; cerrado
   rechaza operación nueva. No tocar state_revision, reloj, checklist o status.
5. Serializar la pareja instance+author (el lock de tarea ya la serializa) y leer
   nota FOR UPDATE. Comprobar expected revision **antes** de evaluar no-op.
6. Misma body normalizada o repetición de limpiar una nota limpia: mismo
   id/revision, ninguna versión/audit nueva; guardar receipt privado de operación.
7. Cambio válido: revision+1, created_at inicial inmutable, updated_at=cutoff;
   append versión con actor autor. Limpiar body='', cleared_at=cutoff; volver a
   escribir texto deja cleared_at=null. Crear revision=1.
8. Audit genérico sólo action `private_block_note.created|updated|cleared`,
   entity_id=note_id y details={} (sin texto, nombres señalados, task título,
   empresas o copia de argumentos). No afecta eventos de trabajo/recordatorios
   ni KPI. Receipt privado y nota/versión/audit se guardan en la misma transacción.

Los recibos genéricos no incluyen ni operan sobre un cuerpo privado. Las RPC008
permanecen intactas; ids de operación serán nuevos UUID desde el cliente al integrar. El servidor confiable puede leer receipts,
pero el rol auditor autenticado no obtiene claves de servicio ni tablas privadas.

## Tipo/API preparada, sin conectar App

Nuevo `src/data/remote/private-block-notes.ts`: tipos Zod y wrapper con transporte
propio (el union de TaskRpcTransport008 no incluye este RPC y no se amplía).
Interface `PrivateBlockNoteTransport.rpc(name: "save_private_block_note", args,
options: {signal?: AbortSignal})` devuelve PromiseLike<{data: unknown, error: unknown|null}>.
No instanciar Supabase ni leer env vars. El futuro adaptador Supabase conectará
options.signal mediante abortSignal; no asumir que Supabase rpc recibe ese objeto.
Exportar `savePrivateBlockNote(transport,input,signal?)`; input estricto
{instanceId,body,expectedRevision,operationId}, mapea sin otros campos a
{p_instance,p_body,p_expected_revision,p_operation_id}. Validar UUID, texto/null,
revisión entera segura y resultado exacto usando
UUID/revisionSchema compartidos. No truncar ni cambiar body original enviado:
normalización autorizada la hace servidor; rechazar vacío con trim local.

Return discriminado: {ok:true,noteId,revision,cleared} o
{ok:false,error:{category,message},ambiguous:boolean}. Categories validation,
transport,server,protocol,aborted; mensajes fijos sin el error/body recibido.
Validation/aborted antes de enviar y error de servidor son ambiguous=false;
transport/protocol o aborted después de enviar son ambiguous=true.
ACK con error, null, array o shape incorrecto se rechaza; no reintentar una
mutación automáticamente. AbortSignal limita solicitud; si se aborta tras enviar
es resultado ambiguo, se conserva operationId para reconciliar, sin emitir
“guardado” ni reenviar con UUID nuevo. No añadir body a logs/errores ni a gateway,
TaskInstanceSchema, reports, outbox, CSV, notificaciones o caches comunes.

No se añade componente visual ni persistencia local. La lectura de notas usa RLS
futura en ruta propia; no unirlas al lector de tareas. La UI se integrará con
Auth real y sólo recibirá los campos autorizados para su rol.

## Pruebas necesarias, coherentes con 008

Nuevo tests/private-block-notes-009.test.ts con AccountingLab hasta008 y migración
009 explícita; conservar fixture008 sin “arreglar” su jerarquía histórica.

1. Base vacía→009 y upgrade poblado008→009 preservan hash/conteos de tareas,
   sesiones, ausencias, activity, cierres/reportes/outbox y receipts008.
2. Crear/editar/limpiar/restaurar; revisión incorrecta y no-op después de revisar.
   Append-only, body límite, texto no vacío; autor auth; estado/tiempo intactos.
3. Autor+encargado actual+boss leen; compañero que puede cubrir la tarea no lee;
   auditor, otra org y exencargado no leen nota ni versiones. Autor mantiene
   texto tras expiración de cobertura, pero no acceso al perfil/tarea del titular.
4. Perfil inactivo no lee/escribe; company membership faltante del encargado
   deniega; same org boss sí. Cambiar manager mediante fixture admin verifica
   revocación sin reescribir nota, historial o snapshot.
5. Nueva escritura en mes cerrado falla; creación por reemplazo fuera de rango
   falla. Replay exacto conserva resultado, versiones y audit; argumentos distintos
   rechazan. UUID igual en receipt008 no se confunde con replay009. Failures
   rollback todo incluido receipt.
6. Direct SELECT denegado por RLS y DML por grants en roles reales; bodies no
   aparecen en SELECT task_instances/audit/report snapshot/outbox.
7. Wrapper: argumentos exactos, signal, ACK válido y rechazo null/array/error,
   revision inválida; no reintentos ni logs sensibles.
8. Preparar escenarios PostgreSQL de crear simultáneo, revisión concurrente y
   close-versus-note. No afirmar que PGlite secuencial demuestra carreras reales.

Añadir stage009 al helper sin cambiar default008, ni listar009 como aplicado.
No forzar los fixtures008 a atravesar009 inadvertidamente. Ejecutar npm test,
npm run build y git diff --check; inspeccionar diff de SQL001–008/dependencias.
Commit/push del código y evidencia por Sites. Al no cambiar interfaz/runtime,
conservar live v43 y marcar 009 como backend local no integrado. No publicar un
módulo invisible como si el comentario privado ya funcionara en la página.
Siguiente revisión: **GPT-6.1 Sol alto, Standard**, seguridad, upgrade y locks009.
No ejecutar B2 mientras el contrato009 no esté revisado.


## Ajustes tras revisión independiente 04/10 UTC

Ver REVIEW-PRIVATE-NOTES-009-20261004.md. La versión reparada normaliza con la
misma lista de whitespace que ECMAScript trim, valida cuerpo almacenado ya
normalizado y limita revisión a 1..MAX_SAFE_INTEGER. Cancellation después de envío
retorna aborted/ambiguous=true incluso si llega ACK después o el transporte no
resuelve; el listener se limpia y no hay retry. Envelope incompleto es protocol
ambiguo. Auth/org/rol se revalidan después de locks antes de replay/escritura.
SQL001–008 y snapshots siguen intactos; 009 local y sin integración remota.
