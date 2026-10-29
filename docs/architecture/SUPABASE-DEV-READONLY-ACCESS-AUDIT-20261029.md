# Auditoría read-only de accesos de Supabase DEV — 29/10/2026

## Alcance y evidencia

Se inspeccionó el proyecto `grupo-paris-dev` (`kynqjfhqujnjojcmurwf`) mediante
Supabase MCP: estado del proyecto, migraciones registradas, inventario de
tablas, grants PostgreSQL y advisors de seguridad/rendimiento. Se ejecutaron
sólo lecturas. No se aplicaron SQL, migraciones, cambios de Dashboard ni Auth.
La consulta de catálogos se hizo contra PostgreSQL 17.11 en `sa-east-1`.

## Hallazgos observados

- El proyecto está `ACTIVE_HEALTHY` y registra 18 migraciones, versiones
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
esté incluido en **Data API → Exposed schemas**. Esa configuración sigue sin
confirmación; por tanto la auditoría no cierra el posible acceso HTTP a RPC
legacy de `public` ni reemplaza las pruebas de autorización con sesiones Auth
DEV.
