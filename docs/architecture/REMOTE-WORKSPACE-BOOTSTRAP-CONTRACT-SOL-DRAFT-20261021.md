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
2. **Evitar fan-out por tarjeta.** La primera página debe incluir agregados
   mínimos por tarea para pintar las tarjetas (tiempo propio del sujeto y, para
   operativas, cantidad/unidad y carga ponderada disponible). No incluir
   referencias, observaciones, autoría detallada ni filas de actividad. Esto
   evita disparar `operationalSummary` y `activityPage` por cada tarea. El
   detalle de actividad se carga bajo demanda para la tarea abierta.
3. **Bloqueos tipados, nunca texto libre.** Incluir `ready` y códigos de bloqueo
   permitidos por el contrato de `readiness`; omitir `blocked_by` y cualquier
   observación. Las dependencias visibles deben seguir la política existente
   de dependencias ocultas, sin revelar títulos que el actor no puede consultar.
4. **Autorización no equivale a actuar como el sujeto.** `subjectId = null`
   representa al actor autenticado. Un sujeto distinto requiere rol de jefe o
   encargado y autorización actual de `can_access_owner`; cada fila requiere
   además `can_access_instance` para empresa vigente. Para cumplir “sólo su
   equipo”, el encargado debe gestionar el `team_id` de la tarea, el sujeto debe
   pertenecer actualmente a ese equipo y seguir bajo su relación supervisora.
   El chequeo usa relaciones de base (`teams.manager_id`, `team_members` y
   `profiles.manager_id`), nunca el filtro enviado por el cliente. Esta regla
   debe incluir casos de baja o traslado entre equipos.
5. **Capacidad de mutar es otra decisión.** El listado nunca devuelve credenciales
   ni sustituye las comprobaciones de `command_v1`; los comandos validan al actor
   autenticado, participante/reemplazo y vigencia. Una vista consultada no cambia
   al actor ni habilita cronómetro, checklist o finalización.
6. **Paginación y consistencia.** Cursor opaco validado por SQL, limitado
   al sujeto, mes, filtros y último orden estable; máximo 100 filas. Cada página
   vuelve a validar permisos. Una revocación entre páginas debe impedir seguir
   consultando; no se promete snapshot estable de membresías. Orden recomendado:
   vencimiento, programación y UUID, con nulos en posiciones explícitas.
7. **Forma del DTO y costo.** Congelar claves exactas comunes y agregados
   opcionales explícitos por tipo; fechas como `YYYY-MM-DD`, revisiones y
   decimales como strings donde corresponde; límites de texto y checklist
   iguales en SQL y Zod. Probar plan de consulta con 2.000 tareas sin agregar
   datos privados a la respuesta.

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

- Filtros exactos: `subjectId` nullable (NULL significa actor autenticado), `period` (primer día del mes), `companyId` nullable, `teamId` nullable y `sector` nullable. Sólo jefe/encargado pueden solicitar otro sujeto; la regla de encargado debe reutilizar y documentar la relación supervisora vigente, no inferir autorización por compartir equipo. El rechazo debe ocultar si el sujeto existe.
- Respuesta por fila, shape exacto por congelar: `taskId`, `taskRevision`, `ownerId`, `ownerDisplayName`, `teamId`, `teamName`, `companyId`, `companyName`, `period`, `title`, `kind`, `status`, `weight`, `dueDate`, `scheduledOn`, `priority` y controles de checklist (`text`, `done`). Excluir `blocked_by` libre, observaciones, registros de actividad, anotaciones, recordatorios y fórmulas. No incluir cantidades/carga calculada: usar las consultas operativas existentes. No devolver información de empresa/equipo/persona sin autorización sobre al menos una tarea correspondiente.
- Cursor opaco ligado a los filtros exactos y última clave de orden; ordenar por vencimiento, programación y UUID de tarea, con límite máximo 100. No existe hoy una revisión única de membresías adecuada para congelar cursores. Cada página debe revalidar autorización actual; si membresías cambian, puede cambiar el conjunto entre páginas y no se promete snapshot estable. Un epoch de autorización sólo se añade si se diseña y mantiene expresamente.
- Revalidación del ámbito contra membresías actuales en cada página; nunca confiar en que `subjectId` o filtros elegidos por el cliente autoricen el acceso. Reusar `public.can_access_owner` (jefe, propio perfil o reporte directo por `profiles.manager_id`) y `public.can_access_instance`/membresía vigente de empresa; no ampliar el alcance de encargado por mera pertenencia común a un equipo. Si el contrato de negocio exige equipo además de reporte directo, exigir ambas relaciones en SQL y modelarlas en la matriz de aceptación.
- Empleado: sólo sus propias tareas. Encargado: sólo reportes directos según `can_access_owner`, con membresía vigente a la empresa de la tarea; confirmar y documentar si la pertenencia al equipo es requisito adicional. Jefe: toda la organización. Consultar `subjectId` fuera del ámbito y sujeto desconocido deben producir el mismo rechazo.
- El selector de consulta no cambia el actor. Los comandos siguen ejecutándose como la persona autenticada; consultar un empleado no permite ejecutar sus tareas.
- Denegación de notas personales en toda búsqueda/listado, independientemente del rol supervisor.
- Invocar sólo vía `client.schema("api").rpc`; no exponer tablas `public` en Data API.
- DTO Zod y SQL con las mismas claves/tipos/límites; cursors y replays con pruebas explícitas de revocación de ámbito entre páginas.

Este contrato cubre el bootstrap de tareas y contexto visual mínimo, **no** afirma paridad con todos los módulos ni cubre aún calendario, archivos/Storage, cierres, reportes, presencia o flujos administrativos faltantes. Cada módulo requiere mapearse a queries/commands aprobados antes de habilitarlo.

## Secuencia de implementación requerida

1. Aplicar el preflight remoto pendiente, comparar destino/hash/historial y, con resultado aceptado, aplicar 001–014 sólo en `grupo-paris-dev`; auditar grants, RLS, funciones, Data API y advisors.
2. Revisar este contrato con Sol y fijar el esquema de respuesta/cursor en un documento de aceptación antes de implementar SQL.
3. GPT-6 Luna implementa 015 con contratos Zod/SQL, tests nuevos, revocación/replay y actualización de docs; GPT-6.1 Sol revisa el hash y los límites de privacidad.
4. Implementar repositorio de lectura y componentes UI que consuman exclusivamente esos RPC. Mantener el laboratorio fuera de la ruta autenticada.
5. Migrar cada módulo restante según contratos disponibles; probar con cuentas ficticias por rol en DEV antes de habilitar acciones.

## No habilitar todavía

No activar `VITE_SUPABASE_URL` en una publicación compartida, no montar el área operativa, no mostrar la UI ficticia después de autenticar y no ejecutar escrituras en el Supabase alojado. El proyecto DEV está confirmado vacío y todavía requiere el secreto de Actions y el workflow manual de preflight.
