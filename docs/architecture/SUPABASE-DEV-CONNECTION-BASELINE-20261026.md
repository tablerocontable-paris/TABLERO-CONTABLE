# Supabase DEV: conexión y baseline — 26/10/2026

## Resultado confirmado

- Proyecto: `grupo-paris-dev`, ref `kynqjfhqujnjojcmurwf`.
- GitHub Actions `40012156985` (`Supabase DEV migrations`, commit `de734ea`) aplicó el segmento `baseline_001_014` y confirmó 16 migraciones locales y 16 remotas. SQL015 quedó fuera del directorio temporal de ejecución.
- La consulta Supabase MCP del 26/10 devolvió las 16 versiones de `202609300001` a `202610150014`, con nombres coincidentes con el conjunto local.
- GitHub Actions `40367149794` (`Preflight Supabase DEV 001–014`, run #3) validó en forma segura el host, usuario, presencia de contraseña, puerto, base y TLS del secreto `SUPABASE_DEV_DB_URL`. Luego `supabase migration list` se conectó al pooler y leyó el historial.
- El run #3 terminó con `Historial incorrecto ... local=16, remoto=16` porque el preflight antiguo exigía cero migraciones remotas. La conexión y autenticación funcionaron. El run no ejecutó `db push`, dry-run ni SQL.
- No se cargaron datos de negocio; las tablas consultadas al auditar la migración estaban vacías.

## Cambio de control

`.github/workflows/supabase-dev-preflight.yml` ahora verifica las 16 migraciones
del baseline en estado aplicado (`history ... after`) y no intenta proponerlas de
nuevo. No ejecuta SQL y excluye SQL015. La aplicación del segmento se mantiene
en el workflow separado de migraciones.

## Hallazgos de seguridad y rendimiento — reconsulta 26/10

La reconsulta read-only de Supabase Advisors del 26/10 sigue reportando 29
tablas RLS sin policies (INFO) y 39 funciones `SECURITY DEFINER` ejecutables
por `authenticated` (WARN). La revisión de grants registrada en la auditoría
read-only encontró que las tablas no conceden SELECT/INSERT/UPDATE/DELETE a
`anon` ni `authenticated`, por lo que no tienen acceso tabular directo. Las
funciones revisadas tenían `search_path` vacío y no eran ejecutables por `anon`.
Sin embargo, el Dashboard aún debe confirmar **Exposed schemas** sólo `api`;
no se autoriza inferir que las funciones `public` no estén expuestas ni conectar
Auth/UI antes de probar permisos positivos y negativos. No se cambió ningún
grant o policy.

Advisors de rendimiento: 124 claves foráneas sin índice (INFO), 8 policies con
`auth_rls_initplan` (WARN) y 12 índices sin uso observado (INFO). Los índices
sin uso no justifican eliminaciones mientras no exista carga representativa;
evaluar optimizaciones de manera selectiva.

## Próximos gates

1. Confirmar en Dashboard que Data API exponga sólo `api`; la autoexposición de nuevas tablas consta apagada.
2. Probar permisos positivos y negativos con identidades ficticias: anon, empleado propio/tercero, encargado dentro/fuera de su ámbito y jefe; incluir notas privadas y RPC legacy directos.
3. Cerrar auditoría de Auth/RLS/grants y validar la lectura remota de UI antes de considerar SQL015 o ampliar mutaciones.

El modo remoto sigue opt-in y de sólo lectura; el laboratorio local continúa
como modo predeterminado. No se activó producción, Site operativo ni usuarios
reales.
