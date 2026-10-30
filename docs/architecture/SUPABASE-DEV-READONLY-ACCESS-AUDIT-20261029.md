# Auditoría read-only de accesos de Supabase DEV — 29/10/2026

## Consulta ACL puntual — 29/10/2026 21:21 ART

Consulta SQL de sólo lectura ejecutada en `grupo-paris-dev` a las 00:21 UTC
(21:21 ART): `public` contiene 88 funciones `SECURITY DEFINER`; 39 permiten
`EXECUTE` efectivo a `authenticated`, cero a `anon`, y las 39 ejecutables por
`authenticated` tienen `search_path` configurado. La consulta no examinó los
cuerpos ni probó autorización por rol; por lo tanto, no certifica que esas RPC
sean seguras en ejecución. Tampoco volvió a comprobar la lista **Exposed
schemas** del Dashboard ni la matriz JWT.

El resultado coincide con el conteo anterior de Advisor/ACL. No se modificaron
permisos, datos, Dashboard, Auth ni migraciones. Mantener pendiente la revisión
función por función y la validación de sesión antes de activar uso operativo.

## Revisión estática acotada de RPC — 29/10/2026

La revisión del repositorio encontró controles estáticos en algunas rutas
sensibles: `can_access_instance` y lectura de membresías/cierres en SQL014
(líneas 3350–3398); SQL016 vuelve a validar identidad, organización, rol de
jefatura/encargado y membresía vigente en la lectura de tareas para encargados
(líneas 3–26). Las pruebas de SQL016 cubren revocación, aislamiento entre
organizaciones, perfil inactivo y DTO sin notas personales
(`tests/supabase-manager-task-revocation-016.test.ts:22–132`). Otras pruebas
de coordinación cubren alcance de coberturas y privacidad de notas.

Esto es una revisión parcial del código fuente y pruebas aisladas del
repositorio; no es un cotejo completo de los 39 cuerpos instalados en DEV y no
demuestra el comportamiento de PostgREST con JWT reales. No se encontró una
vulnerabilidad confirmada en esta porción, pero las 39 funciones aún necesitan
inventario firma por firma, cotejo local–desplegado y pruebas por rol/ámbito.
Mantener esa validación, junto con Exposed schemas, como gate antes de activar
Auth operativo o datos reales.

## Separación entre anotaciones y comentarios operativos — 29/10/2026

En el Site, `projectState` entrega sólo las anotaciones cuyo `ownerId` coincide
con el actor (`src/server/site-policy.ts:166`). La prueba
`tests/site-operational.test.ts:170–195` verifica que la jefatura recibe una
lista vacía y que guardar la proyección no borra la anotación original. Gemelo
recibe tareas y obligaciones, no anotaciones (`src/domain/gemelo.ts:31–32`);
`tests/gemelo.test.tsx:46–63` verifica que ni el título ni el contenido privado
aparezcan en el contexto o UI del superior.

Hay otra entidad separada: `task_private_block_notes` contiene comentarios de
bloqueo asociados a una tarea. SQL009 permite leerlos al autor, a jefatura y al
encargado del autor si conserva membresía de la empresa
(`supabase/migrations/202610020009_private_block_notes.sql:63–85`); SQL014
revalida la membresía vigente (`:3411–3430`). Estos comentarios tampoco salen
en el DTO compartido de tarea para encargado; los tests SQL011/016 lo comprueban
(`tests/coordination-activation-011.test.ts:114–125`,
`tests/supabase-manager-task-revocation-016.test.ts:63–102`).

**Límite funcional pendiente de aceptación:** esta evidencia protege las
anotaciones personales, pero los comentarios de bloqueo son visibles a sus
superiores dentro del ámbito de tarea. La interfaz/contrato debe dejar claro que
ese campo es operativo y no es un bloc personal; si el usuario espera que
tampoco esos comentarios sean visibles al superior, habrá que cambiar RLS y su
contrato antes de habilitar Auth operativo.

El inventario live volvió a listar 39 firmas exactas en `public`, todas con
`SECURITY DEFINER`, propietario `postgres`, `search_path=''` y `EXECUTE` para
`authenticated`; `anon` no tiene ese permiso en estas funciones. Se encontraron
referencias locales para las 39 firmas en el historial SQL, pero no se cotejó
el hash/cuerpo desplegado contra la definición local de cada una. La lista se
trata como superficie a auditar, no como evidencia de que las 39 estén
aprobadas. La prueba local revisa fixtures/migraciones aisladas y no ejecuta
estas firmas con JWT contra DEV.

## Alcance y evidencia

Se inspeccionó el proyecto `grupo-paris-dev` (`kynqjfhqujnjojcmurwf`) mediante
Supabase MCP: estado del proyecto, migraciones registradas, inventario de
tablas, grants PostgreSQL y advisors de seguridad/rendimiento. Se ejecutaron
sólo lecturas. No se aplicaron SQL, migraciones, cambios de Dashboard ni Auth.
La consulta de catálogos se hizo contra PostgreSQL 17.11 en `sa-east-1`.

## Refresco read-only de proyecto, migraciones y Advisors — 29/10/2026 23:58 UTC

Una consulta nueva confirmó que `grupo-paris-dev` sigue `ACTIVE_HEALTHY` en
`sa-east-1`, con PostgreSQL 17.11. La lista actual devuelve **16 migraciones**,
versiones `001–016` (corrijo el conteo “18” de la nota inicial, que no coincidía
con el inventario enumerado).

Advisors se refrescó a las 23:58:47 UTC y mantiene estos conteos:

- Seguridad: 29 tablas con RLS sin policies (INFO) y 39 funciones
  `SECURITY DEFINER` ejecutables por `authenticated` (WARN).
- Rendimiento: 124 claves foráneas sin índice cubriente (INFO), 8 policies con
  reevaluación de funciones Auth (WARN) y 12 índices sin uso observado (INFO).

El refresh sólo volvió a leer proyecto, migraciones y Advisors; no repitió la
consulta SQL de grants/RLS ni la sonda REST de **Exposed schemas**. Los avisos
no prueban por sí solos una vulnerabilidad. No se cambió la base. Hasta repetir
la sonda y completar la matriz con JWT Auth DEV, se mantiene el bloqueo de Auth
operativo y de datos reales.

## Hallazgos observados

- El proyecto está `ACTIVE_HEALTHY` y registra 16 migraciones, versiones
  001–016. El inventario reporta cero filas en las tablas de negocio revisadas.
- `public` tiene 37 tablas y `app_private`, 20. Todas tienen RLS habilitado;
  ninguna tiene `FORCE ROW LEVEL SECURITY`.
- El rol `authenticated` tiene `SELECT` sobre 28 tablas de `public`. Las
  políticas RLS limitan sus filas; nueve tablas no tienen policy y tampoco
  aparecen en los grants de tablas a `authenticated` o `anon`.
- No se observaron grants de tablas a `anon`, ni grants de tablas o funciones
  `SECURITY DEFINER` a `PUBLIC`/`anon` en los esquemas revisados.
- `api` concede `USAGE` a `authenticated` y tiene tres funciones
  `SECURITY DEFINER` ejecutables por ese rol: `get_context_v1`, `query_v1` y
  `command_v1`. `app_private` no mostró grants de esquema a `anon` o
  `authenticated`.
- El esquema `public` conserva `USAGE` y 39 funciones `SECURITY DEFINER`
  ejecutables por `authenticated`. El repositorio conserva contratos legacy
  para RPC de tareas/notas, pero el bootstrap actual sólo se habilita con
  `VITE_SUPABASE_AUTH_BOOTSTRAP=true` y el cliente de diagnóstico usa el esquema
  `api`; esto no demuestra que las 39 funciones sean innecesarias ni permite
  revocarlas sin revisar cada firma y sus pruebas.
- Advisors: 29 tablas con RLS sin policies (20 de `app_private` y 9 de
  `public`), 39 funciones `SECURITY DEFINER` alcanzables por `authenticated`,
  124 claves foráneas sin índice cubriente, 8 policies con llamadas de auth que
  pueden reevaluarse por fila y 12 índices no usados. Estos avisos no son por sí
  solos prueba de exposición ni mandato para cambiar el esquema.

## Lo que esta auditoría no demuestra

El inventario SQL no permite confirmar qué esquemas están habilitados en la
lista **Exposed schemas** de Data API en Dashboard. Tampoco prueba que el
JWT/Auth, RLS y límites de empleado/encargado/jefe funcionen de extremo a
extremo con usuarios de prueba. Esas comprobaciones requieren la configuración
actual del Dashboard y cuentas Auth DEV de cada rol. No conectar Auth
operativo, publicar usuarios reales ni activar el frontend contra Supabase
hasta completar esa matriz.

No se modificaron migraciones 001–016. Si la revisión posterior detecta una
concesión innecesaria, preparar una migración nueva con pruebas de rol y
mantener el historial aplicado inmutable.

## Revalidación de ACL — 29/10/2026 20:46 UTC

Una consulta read-only posterior volvió a contar las funciones instaladas y
sus permisos efectivos. El resultado coincide con el corte anterior: `public`
tiene 88 funciones `SECURITY DEFINER`, de las que 39 son ejecutables por
`authenticated`; `api` tiene 12, de las que 3 son ejecutables por ese rol; y
`app_private` tiene 42, ninguna ejecutable por `authenticated`. Las 42
funciones ejecutables por `authenticated` tienen `search_path` fijado y son
propiedad de `postgres`. No se halló `EXECUTE` de `anon` ni `PUBLIC` sobre
funciones `SECURITY DEFINER` en esos tres esquemas.

También se confirmó el privilegio PostgreSQL `USAGE`: `authenticated` lo tiene
en `api` y `public`; `anon` y `PUBLIC` lo tienen en `public`; ninguno lo tiene
en `app_private`. `USAGE` en PostgreSQL no demuestra por sí solo que un esquema
esté incluido en **Data API → Exposed schemas**. La verificación REST posterior
confirmó que `public` y `graphql_public` sí están expuestos, mientras `api` y
`app_private` se rechazan. La revalidación exacta está abajo.

## Revalidación de privilegios efectivos — 29/10/2026 21:52 UTC

Se repitió la inspección SQL de sólo lectura luego de detectar por REST que
PostgREST acepta `public` y `graphql_public`, pero rechaza `api` y
`app_private`. El resultado actual distingue permisos PostgreSQL efectivos de
la lista Exposed schemas:

- `public` tiene 37 tablas y `app_private`, 20; todas tienen RLS. `anon` no
  tiene privilegios efectivos `SELECT`, `INSERT`, `UPDATE` ni `DELETE` en esas
  tablas. `authenticated` tiene `SELECT` en 28 tablas `public`, sin privilegio
  directo `INSERT`, `UPDATE` o `DELETE` en las 57 tablas; las lecturas quedan
  sujetas a RLS.
- `api` contiene 12 funciones, las 12 `SECURITY DEFINER`; sólo tres son
  ejecutables por `authenticated`, ninguna por `anon`, y todas tienen
  `search_path` fijado.
- `app_private` contiene 53 funciones (42 `SECURITY DEFINER`); ninguna es
  ejecutable por `anon` o `authenticated`, y ninguna `SECURITY DEFINER` carece
  de `search_path` fijado.
- `public` contiene 94 funciones (88 `SECURITY DEFINER`). 39 funciones
  `SECURITY DEFINER` son ejecutables por `authenticated`; 41 funciones totales
  de `public` lo son. `anon` tiene EXECUTE sobre dos funciones no
  `SECURITY DEFINER`: `normalize_assignment_schedule()` y
  `reject_template_version_change()`. Sus definiciones las identifican como
  triggers (`RETURNS trigger`); no se invocaron.
- Las 88 funciones `SECURITY DEFINER` de `public` tienen `search_path` fijado.
  Por tanto, el riesgo relevante que sigue pendiente es revisar el alcance de
  las RPC legacy expuestas a `authenticated` mientras `public` siga en la
  lista Exposed; las ACL/RLS de tablas no indican acceso anónimo directo.

Los advisors se refrescaron a las 21:52 UTC y mantienen 29 tablas con RLS sin
policies, 39 funciones `SECURITY DEFINER` ejecutables por `authenticated`,
124 claves foráneas sin índice cubriente, 8 policies con reevaluación de
funciones de auth y 12 índices no usados. Son avisos de configuración o
rendimiento, no demostraciones de explotación. No se cambió ACL, RLS,
migraciones, Dashboard, Auth ni datos.

La evidencia REST de Exposed schemas, el resultado exacto y el próximo paso
están en
[`SUPABASE-DEV-EXPOSED-SCHEMAS-REST-CHECK-20261029.md`](SUPABASE-DEV-EXPOSED-SCHEMAS-REST-CHECK-20261029.md).

## Refresco de advisors — 29/10/2026 22:17 UTC

Se volvió a consultar Advisors sin cambiar base, configuración ni migraciones.
Los conteos permanecen iguales: seguridad, 29 tablas con RLS sin policies
(INFO) y 39 funciones `SECURITY DEFINER` ejecutables por `authenticated`
(WARN); rendimiento, 124 claves foráneas sin índice cubriente (INFO), 8
policies con reevaluación de funciones de auth (WARN) y 12 índices sin uso
observado (INFO). La repetición confirma que no hubo variación en estos
contadores entre 21:52 y 22:17 UTC; no demuestra que cada aviso sea explotable
ni que su configuración sea óptima. No se hicieron cambios correctivos porque
requieren evaluar contratos de funciones, consultas reales y carga antes de
revocar privilegios o agregar/quitar índices.

## Revisión estática complementaria de rutas sensibles — 29/10/2026

Una revisión de sólo lectura de las migraciones 001–016 encontró que las rutas
revisadas comprueban organización, rol y membresía vigente: consulta de tareas
(`202610150014_operational_api.sql:3350–3355`), lectura de sesiones y actividad
por autor o supervisor dentro de ámbito (`:3369–3386`), cierres/reportes por
organización, titular y empresas del snapshot (`:3388–3405`) y notas privadas
por autor, jefe o encargado con membresía actual (`:3411–3427`). SQL016 vuelve
a comprobar el ámbito vigente al consultar tareas de encargado
(`202610260016_manager_task_revocation.sql:3–26`). Las funciones observadas
fijan `search_path=''`.

Esto no certifica toda la superficie de las 39 funciones ni sus resultados en
tiempo de ejecución. Siguen pendientes pruebas con JWT Auth DEV por cada rol,
incluidos intentos fuera de ámbito, lectura de notas privadas y revocación de
membresía; tampoco se probó GraphQL. No revocar grants sólo por el aviso del
Advisor: primero comparar cada firma con su contrato y pruebas.

## Cotejo de SQL014 con DEV — 29/10/2026

El comentario de cabecera del archivo local SQL014 todavía dice que la
migración “remains local”. Se contrastó con el estado real: DEV registra la
versión `202610150014` con nombre `operational_api`; el guard local fija la
huella aceptada y pasó el comando `node scripts/supabase-dev-migration-guard.mjs verify-files . verify_current`.
Una consulta SQL read-only comparó las definiciones
alojadas y locales de `public.can_access_instance(uuid)`,
`public.can_read_private_block_note(uuid)` y
`public.read_coordinated_task_for_manager(uuid)`; coincidieron, con
`search_path` vacío. El comentario antiguo no representa el estado aplicado.
No se alteró ni reejecutó SQL014. Es un cotejo puntual, no una comparación
integral de los 39 cuerpos alojados ni una prueba Auth/JWT.
