# Lecturas de tareas y sesiones — contrato de ejecución

Fuente: adaptador `723b0693079610bde0141c67e6dd8eb6a13796dc` más corrección
ADP-R01 aceptada en REVIEW-DATA-ADAPTER-20261002.md. Usar el commit de esa revisión
como base real al ejecutar. **GPT-6 Luna, medio, Standard.**

Objetivo: leer filas completas autorizadas por el servidor, paginar sin mezclar
empresas y recargar datos confirmados después de una RPC. No activar el frontend
remoto en este bloque. No cambiar políticas existentes ni ampliar roles.

## 1. Superficie y límites

Crear `src/data/remote/task-reader.ts` y pruebas nuevas. Reusar esquemas de
task-contract.ts y AccountingLab. SQL 001–008, gateway de escritura, frontend,
repositorio local, dependencias y evidencia previa quedan congelados.

Sin URL/clientes/red/env/credenciales. Transporte inyectado:
`TaskReadTransport.read(query): PromiseLike<{data: unknown, error: unknown|null}>`.
`query` es una unión readonly construida internamente con sólo estos miembros:

| kind | table | Campos de query |
| --- | --- | --- |
| taskPage | task_instances | period, companyId nullable, ownerId nullable, teamId nullable, afterId nullable, take |
| taskById | task_instances | instanceId, take=2 |
| sessionPage | task_time_sessions | instanceIds readonly, afterId nullable, take |

No admitir tabla, SQL, proyección, actor, organización, rol o JWT proporcionados
por el llamador. La selección incluye todos los campos obligatorios de los
contratos de filas y conserva adicionales. La implementación real del transporte
se hará después; aquí se prueba con un transporte SQL fijo del laboratorio.

La autorización corresponde a los SELECT bajo authenticated/RLS del servidor.
Filtros de empresa/propietario/equipo sólo restringen resultados visibles; no
conceden permisos ni usan el selector de perfiles de demostración. Una sesión
propia histórica puede seguir visible aunque su tarea ya no lo sea, por
own_session_read: no inventar una tarea ni ampliar acceso por ese resultado.
La cuenta técnica global y Auth/administración requieren su fase posterior;
no afirmar que el rol auditor actual concede consulta global.

## 2. API y paginación

`createTaskReader(transport)` expone:

- `listTasks(input)`: period obligatorio, válido y día 1; companyId/ownerId/teamId
  opcionales nullable (default null); afterId opcional nullable (default null);
  limit opcional entero 1..100 (default 50).
- `findTask(input)`: instanceId obligatorio, UUID PostgreSQL.
- `listSessions(input)`: instanceIds obligatorio, 1..100 UUID, sin repetidos
  incluso si cambia mayúscula/minúscula; afterId y limit como listTasks.

Entradas strict, validadas en runtime aunque haya cast. Clonar y congelar queries
incluido instanceIds, sin mutar entradas. Rechazar antes de transporte cualquier
campo desconocido o valor inválido. Una sola llamada por método; no auto retry.

Para páginas: ORDER BY id ASC y keyset `id > afterId` (UUID PostgreSQL), sin OFFSET.
take=limit+1. Comparaciones de UUID usan texto hexadecimal lowercase con guiones
para reflejar orden/igualdad PostgreSQL, pero las filas y cursores mantienen el
texto original recibido. Los transportes deben aplicar filtro, orden y límite
en servidor. No descargar todo para filtrar en cliente.

Validar el array completo, incluido lookahead, antes de devolver datos. Rechazar
como protocol: envelope/data inválidos, más de take filas, contratos incompletos,
IDs duplicados, desorden, ID <= afterId, taskPage fuera de período/filtros o
sessionPage con instance_id fuera de la lista. Sin éxito parcial ni eliminación
silenciosa de filas inválidas. No comprobar acceso de padre desde datos locales.

Página exitosa: `{ok:true, rows, hasMore, nextCursor}`. Devolver como máximo limit
filas; hasMore si había lookahead, nextCursor es ID de la última fila DEVUELTA
sólo si hasMore, de lo contrario null. Vacío => [], false, null. Nunca avanzar
el cursor al lookahead porque lo saltearía en la próxima página.

findTask acepta array de 0 o 1 fila (take=2 permite detectar exceso): vacío =>
`{ok:true, kind:'unavailable'}`, una fila válida cuyo ID coincide =>
`{ok:true, kind:'found', row}`. No distinguir inexistencia de falta de visibilidad
ni revelar roles/organizaciones por el mensaje. Más filas, ID distinto o fila
inválida => protocol. Conservar nulos/pesos/checklist/versiones/timestamps.

Errores discriminados validation/transport/server/protocol con mensajes genéricos
estables, sin excepciones ni credenciales. Puede reutilizar los tipos públicos
de error del gateway, pero no modificarlo por una refactorización. No acumular
páginas, caché o traducción a Task/State local. No producir KPI/totales a partir
de una página parcial. Entre SELECTs pueden cambiar datos/permisos: esto no es
un snapshot transaccional. Al cambiar filtros el futuro coordinador reinicia
cursor; este lector es stateless y no mantiene un cursor implícito.

## 3. Aceptación suficiente

Unitarias para defaults/firmas/queries congeladas; entradas strict sin RPC/read;
límites 1 y 100; lookahead/cursor sin saltar; vacío; mezcla empresa/banco;
UUID orden/case; filas incompletas/duplicadas/desordenadas/fuera de ámbito;
errores/envelope y una llamada sin reintentos; metadata/nulos preservados.
Incluir metadatos en lookahead para demostrar que se valida la fila completa.

SQL local con AccountingLab, BEGIN/ROLLBACK por caso. Transporte de test allowlist
por kind con SQL parametrizado literal, SELECT to_jsonb(row) y ORDER BY id ASC;
take y todos los filtros también parametrizados. No interpolar nombres/arbitrarios.
Actor authenticated antes de cada read/RPC. Admin sólo prepara fixtures y toma
snapshots de auditoría. No reutilizar getters administrativos para las lecturas.

1. Empleado ve sólo sus tareas; encargado ve las personas actualmente asignadas
   y empresas autorizadas; jefe ve lo que permite su organización. Otro org no
   ve estas tareas. Un ownerId o companyId extra no saltea RLS.
2. Tres o más tareas, algunas con mismo título/banco en empresas diferentes:
   páginas limit=1 hasta agotar mantienen exactamente los IDs, sin duplicar ni
   saltar lookahead. Filtro empresa y null (todas visibles) funcionan en servidor.
3. Cobertura vigente sellada da sólo empresa/período autorizados. Al cancelarla
   findTask es unavailable para reemplazo; sus sesiones históricas siguen según
   RLS. listSessions no fabrica el padre ni trae sesiones ajenas invisibles.
4. Después de start/checklist/transition, el lector recupera status y revisión
   reales, nunca los deduce del ACK. Switch recarga origen y destino y verifica
   revisiones, cierre de origen y nueva sesión. Se usa gateway existente.
5. findTask diferencia found/unavailable; resultados nunca incluyen campos de
   autoridad añadidos por el cliente. Nulos, versión nullable, checklist sin text,
   snapshots de pesos y precisión temporal se conservan al leer JSON real.
6. Fallos de lectura no mutan filas: snapshots antes/después iguales y una llamada.

No duplicar la batería previa de locks/ausencias/reportes. Sin integración
PostgREST/Auth real, sin prueba de concurrencia PostgreSQL, sin correo remoto.

## 4. Entrega y siguiente fase

npm test, npm run build, diff-check y evidencia nueva con SHA base/hashes de
archivos probados. Verificar SQL/gateway/frontend/repositorio local/dependencias
sin diff, commit/push y Sites privado del mismo SHA. La página seguirá en demo.

Después revisión Sol 6.1 medio y contrato cerrado del coordinador asíncrono:
intenciones en curso, resultados ambiguos, recarga de fuentes afectadas y
respuestas tardías al cambiar perfil/filtros/sesión. No diseñar ni implementar
ese coordinador, cuentas/MFA, nuevas políticas, servicios o migración ahora.
