# Contrato pendiente: lectura inicial del espacio Supabase

Fecha: 21/10/2026. Estado: **borrador arquitectónico, no implementado ni aceptado**.

## Revisión técnica local — 23/10/2026

Esta revisión precisa los criterios para la aceptación del contrato; no equivale
a la aceptación de GPT-6.1 Sol. No escribir SQL ni conectar la pantalla hasta
resolver estos puntos:

1. **La página inicial debe cubrir el tablero, no sólo la hoja de ruta.** Debe
   devolver tareas de tipo `resultado` y `operativa`, además de estado, empresa,
   equipo, persona, período, controles y fechas. `suggestedRoute` existente sólo
   contiene resultados no completados; no sustituye este listado.
2. **Evitar fan-out por tarjeta sin atribuir trabajo ajeno.** La primera página
   incluye por fila tiempo y movimientos atribuidos al sujeto consultado. Filtrar
   `task_time_sessions.actor_id` y `activity_entries.actor_id` por ese sujeto;
   las sumas generales por instancia no sirven para representar su aporte en una
   tarea conjunta o cubierta. Conservar además el estado global de la tarea como
   dato separado. El resumen actual `operationalSummary` agrega sesiones y
   movimientos de toda la instancia; no debe usarse como contribución personal.
   No incluir referencias, observaciones, autoría detallada ni filas de
   actividad. El detalle se carga bajo demanda al abrir la tarea.
3. **Bloqueos tipados, nunca texto libre.** Incluir `ready` y códigos de bloqueo
   permitidos por el contrato de `readiness`; omitir `blocked_by` y cualquier
   observación. En `workspacePage` no incluir títulos ni estados de tareas
   dependientes: SQL014 filtra las dependencias actuales con `can_access_instance`,
   que no aplica el límite adicional de equipo del nuevo listado. Devolver sólo
   códigos de bloqueo y un indicador de dependencia oculta. No modificar el
   contrato publicado de `readiness`; cualquier detalle se carga por el RPC
   existente, que revalida su propio permiso.
4. **Autorización no equivale a actuar como el sujeto.** `subjectId = null`
   representa al actor autenticado. Resolver la pertenencia de tareas y la
   autorización del actor como predicados separados:
   - La consulta propia (sujeto efectivo = actor) incluye tareas donde es
     `owner_id`, miembro del conjunto responsable, reemplazo con cobertura
     autorizada vigente, o autor de movimientos/sesiones del período, pero sólo
     si `can_access_instance` aún autoriza esa tarea y empresa. La autoría
     histórica no conserva acceso tras revocar empresa/cobertura. No necesita
     relación supervisora consigo mismo y nunca habilita ejecutar acciones.
   - Consultar a otra persona requiere rol jefe/encargado y `can_access_owner`;
     para encargado, además, la tarea debe pertenecer a un equipo que gestiona,
     la persona debe ser miembro vigente de ese equipo y permanecer bajo la
     relación supervisora. Incluir propietario, participantes responsables y
     cobertura autorizada vigente que intersecte el período. Aportes históricos
     sólo se incluyen si el actor conserva hoy autorización sobre esa tarea y
     su empresa.
   Revalidar por fila `can_access_instance` y, sólo cuando el sujeto efectivo es
   distinto del actor, el ámbito de equipo reforzado. No inferir permisos desde
   filtros del cliente. Usar relaciones de base (`teams.manager_id`,
   `team_members`, `profiles.manager_id`, conjuntos y coberturas), con casos de
   baja o traslado. Si un encargado consulta su propio trabajo, usar el primer
   caso y no exigir que se supervise a sí mismo.
5. **Capacidad de mutar es otra decisión.** El listado nunca devuelve credenciales
   ni sustituye las comprobaciones de `command_v1`; los comandos validan al actor
   autenticado, participante/reemplazo y vigencia. Una vista consultada no cambia
   al actor ni habilita cronómetro, checklist o finalización.
6. **Paginación y consistencia.** Orden obligatorio: `dueDate ASC NULLS LAST`,
   `scheduledOn ASC NULLS LAST`, `taskId ASC`. Cursor versión 1 opaco y validado
   por SQL, ligado al sujeto efectivo, mes, filtros normalizados, versión de
   orden y última clave; máximo 100 filas. Cada página revalida el sujeto y los
   filtros explícitos: si el sujeto perdió acceso, o una empresa/equipo pedido
   explícitamente dejó de estar autorizado, se rechaza. Con filtros amplios,
   recomputar el ámbito actual y omitir cada fila que ya no esté autorizada; no
   se rechaza toda la página por cambios parciales de membresía. No se promete
   snapshot de datos: si una edición mueve filas entre páginas puede haber
   repetidos u omitidos; el cliente
   deduplica por `taskId`, reinicia al cambiar filtros/sujeto/mes y ofrece
   recargar el listado para reconciliar cambios. Un cursor malformado, de otro
   filtro o versión se rechaza sin filtrar silenciosamente.
7. **Forma del DTO y costo.** Unión exacta por `kind` y `measurementVersion`;
   conservar `checklist.id`. Para `resultado` v1, `weight` es decimal positivo
   como string. Para `operativa` v1, peso y meta son valores legacy explícitos
   (no coeficientes por movimiento); para `operativa` v2, `weight` y `target`
   son `null`, sin checklist y con `unit` requerida. Incluir
   `measurementVersion` siempre. `subjectWork.recordedSeconds` y, en operativas,
   movimientos/cantidad/unidad/carga ponderada/cantidad sin coeficiente se
   calculan sólo para el `actor_id` sujeto. Conservar el recorte efectivo de
   cada sesión de SQL014, no restar simplemente inicio y fin. Si falta un
   coeficiente, `weightedLoad` es `null`; el resultado global de la tarea sigue
   separado del aporte personal. Fijar fechas `YYYY-MM-DD`, revisiones y
   decimales como strings, valores nulos y límites idénticos en SQL/Zod.

   La consulta elige primero hasta 101 tareas autorizadas en orden; calcula
   agregados sólo para las 100 filas devueltas. No sumar la actividad global de
   instancia y luego presentarla como personal. Medir `EXPLAIN (ANALYZE, BUFFERS)`
   y bytes de respuesta con 2.000 tareas y volumen representativo de sesiones;
   conservar el objetivo de navegación acordado en la matriz de aceptación y no
   incluir filas privadas de actividad.

La página debe tener un único RPC paginado que agregue los datos de sus filas;
no puede resolverse con un `Promise.all` por tarjeta. Si los agregados aumentan
el costo de SQL por encima del objetivo, acordar una consulta bulk separada que
reciba una lista acotada de IDs y vuelva a autorizar cada tarea; no degradar a
consultas individuales.

## Hallazgo que bloquea la interfaz real

`src/main.tsx` todavía monta `LaboratoryWorkspace`, que usa datos ficticios locales. `RemoteWorkspace` usa el Worker/D1 y guarda el estado completo; no se puede reutilizar para Supabase. `SupabaseAuthGate` autentica y consulta `get_context_v1`, pero los RPC de lectura actuales no devuelven el conjunto paginado de tareas necesario para pintar un tablero.

`api.query_v1` conoce consultas específicas como `activityPage`, `operationalSummary`, `readiness`, `suggestedRoute`, `cataloguePage` y `creationContext`. No hay un listado inicial por mes con tarea, empresa, equipo, persona responsable y estado. `get_context_v1` sólo entrega identidad, rol e IDs de ámbito; no aporta los nombres ni las tareas. Los módulos de calendario, navegación y demás datos tampoco quedan satisfechos con una respuesta de tareas ficticias.

Evidencia en `src/data/supabase/operational-contract.ts` (unión `queryKinds` y `queryDataKinds`), `supabase/migrations/202610150014_operational_api.sql` (`api.query_v1`) y `src/main.tsx`.

## Contrato que se propone para revisión Sol

Agregar en una **nueva migración aditiva 015** un kind de consulta paginada, por ejemplo `workspacePage`, sin alterar ni reinterpretar tipos ya publicados:

- Filtros exactos: `subjectId` nullable (`NULL` = actor autenticado), `period` (primer día del mes), `companyId`, `teamId` y `sector` nullable. Sólo jefe/encargado pueden solicitar otro sujeto; el rechazo de sujeto desconocido/fuera de ámbito es idéntico. Un encargado que consulta su propio trabajo usa permiso de actor, no permiso de supervisor.
- Incluir tareas del sujeto según la regla de pertenencia del punto 4, siempre subordinada a `can_access_instance` actual. Reemplazo vencido o autoría histórica no conserva acceso cuando el permiso actual fue revocado. El permiso para consultar sujeto distinto es independiente y sólo entonces se aplica la relación supervisora y el equipo gestionado: jefe consulta organización; encargado consulta sujetos supervisados vigentes, tareas de equipos que gestiona, miembros vigentes de ese equipo y empresas autorizadas. Compartir equipo sin relación supervisora no concede acceso.
- Respuesta: envelope exacto `{ contractVersion: 1, kind: "workspacePage", data: { evaluatedAt, items, nextCursor } }`. Claves comunes por item: `taskId` UUID, `taskRevision` string decimal, `ownerId` UUID, `ownerDisplayName` string (1–200), `teamId` UUID, `teamName` string (1–200), `companyId` UUID, `companyName` string (1–200), `period` y `scheduledOn` fechas ISO `YYYY-MM-DD` o null, `title` (1–200), `kind`, `measurementVersion` (1|2), `status` enum de `task_instances`, `dueDate` ISO o null, `priority` (`Alta|Media|Baja`), `weight` decimal string o null, `target` entero positivo o null, `unit` texto 1–80 o null, `checklist` arreglo de `{ id: UUID, text: 1–1000, done: boolean }` con máximo 100, `ready` boolean, `blockerCodes` arreglo de códigos tipados existentes, `hasHiddenDependencies` boolean y `subjectWork`. No incluir títulos ni estados de dependencias. Se conserva el envelope RPC `{ contractVersion, kind, data }`.
- Unión de medición: `resultado` v1 requiere `weight` decimal positivo y permite `unit/target` null; `operativa` v1 conserva `weight/target` legacy identificados por `measurementVersion=1`; `operativa` v2 requiere `weight=null`, `target=null`, `unit` no nula y `checklist=[]`. Nunca interpretar peso legacy como coeficiente por movimiento.
- `subjectWork` también es una unión: resultados llevan `{ recordedSeconds: nonnegative-integer-string }`; operativas llevan `{ recordedSeconds, movementCount, quantity, unit, ratedLoad, weightedLoad, unratedQuantity }`, conteos y números como strings salvo `unit`. `ratedLoad` suma sólo movimientos con snapshot `operational_unit_weight` guardado al registrar (cero si no hay); nunca recalcular con el coeficiente vigente. Los movimientos legacy v1 sin snapshot suman en `unratedQuantity`. `weightedLoad` es null si algún movimiento no tiene snapshot o falta cobertura completa de coeficientes. `data.evaluatedAt` es ISO con zona y define el corte de sesiones abiertas; los segundos usan el redondeo de SQL014. Filtrar por `actor_id` sujeto y conservar el recorte efectivo de SQL014. El agregado global `operationalSummary` no se reutiliza como contribución personal.
- Excluir referencias, observaciones, detalle de actividad, anotaciones, recordatorios, fórmulas y texto libre `blocked_by`. Para dependencias sólo devolver códigos tipados y si existen dependencias ocultas; no incluir títulos/estados con permiso menos estricto que el de la fila.
- Cursor JSON v1 con claves exactas `{ kind, cursorVersion, subjectId, period, companyId, teamId, sector, orderVersion, dueDate, scheduledOn, taskId }`; `subjectId` siempre es UUID efectivo; company/team son UUID canónicos o null; sector es texto trim o null; fechas nulas se codifican null. `cursorVersion=1` y `orderVersion=1`; toda clave/filtro/versión distinta rechaza cursor. Orden obligatorio `dueDate ASC NULLS LAST`, `scheduledOn ASC NULLS LAST`, `taskId ASC`; límite 100. En cada página se vuelve a validar sujeto y filtros explícitos: pérdida de acceso al sujeto o a companyId/teamId seleccionados rechaza. Con filtros amplios se recomputa ámbito y se omiten filas revocadas, sin rechazo total. Mutaciones de filas pueden repetir/omitir; deduplicar por `taskId`, reiniciar al cambiar filtros y ofrecer recarga. Elegir ≤101 filas autorizadas antes de agregar, y agregar sólo las ≤100 devueltas.
- El selector de consulta no cambia el actor. Los comandos siguen ejecutándose como la persona autenticada; consultar un empleado no permite ejecutar sus tareas.
- Denegación de notas personales en toda búsqueda/listado, independientemente del rol supervisor.
- Invocar sólo vía `client.schema("api").rpc`; no exponer tablas `public` en Data API.
- DTO Zod y SQL con las mismas claves/tipos/límites; cursor con pruebas explícitas de revocación de ámbito entre páginas y con cambios de equipo/empresa.

Este contrato cubre el bootstrap de tareas y contexto visual mínimo, **no** afirma paridad con todos los módulos ni cubre aún calendario, archivos/Storage, cierres, reportes, presencia o flujos administrativos faltantes. Cada módulo requiere mapearse a queries/commands aprobados antes de habilitarlo.

## Secuencia de implementación requerida

1. Aplicar el preflight remoto pendiente, comparar destino/hash/historial y, con resultado aceptado, aplicar 001–014 sólo en `grupo-paris-dev`; auditar grants, RLS, funciones, Data API y advisors.
2. Revisar este contrato con Sol y fijar el esquema de respuesta/cursor en un documento de aceptación antes de implementar SQL.
3. GPT-6 Luna implementa 015 con contratos Zod/SQL, tests nuevos, revocación/replay y actualización de docs; GPT-6.1 Sol revisa el hash y los límites de privacidad.
4. Implementar repositorio de lectura y componentes UI que consuman exclusivamente esos RPC. Mantener el laboratorio fuera de la ruta autenticada.
5. Migrar cada módulo restante según contratos disponibles; probar con cuentas ficticias por rol en DEV antes de habilitar acciones.

## No habilitar todavía

No activar `VITE_SUPABASE_URL` en una publicación compartida, no montar el área operativa, no mostrar la UI ficticia después de autenticar y no ejecutar escrituras en el Supabase alojado. El proyecto DEV está confirmado vacío y todavía requiere el secreto de Actions y el workflow manual de preflight.
