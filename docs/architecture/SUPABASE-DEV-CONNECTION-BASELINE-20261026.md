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

## Hallazgos de seguridad previamente revisados

La lectura de advisors del 23/10 reportó 29 tablas RLS sin policies y 39
funciones `SECURITY DEFINER` ejecutables por `authenticated`. La auditoría
read-only identificó que las tablas concernidas no conceden SELECT/INSERT/
UPDATE/DELETE a `anon` ni `authenticated`; el acceso queda denegado. Las
funciones revisadas tenían `search_path` vacío y no eran ejecutables por `anon`.
Las funciones API v1 se invocan por esquema `api`; aun así, falta confirmar la
configuración real de **Exposed schemas** en el Dashboard y dejar sólo `api`.
No se cambió ningún grant o policy.

Advisors de rendimiento: 124 claves foráneas sin índice, 8 policies con
`auth_rls_initplan` y 12 índices no usados. No son bloqueo para comprobar
conectividad; evaluar optimizaciones con carga representativa, sin aplicar
cambios masivos a ciegas.

## Próximos gates

1. Confirmar en Dashboard que Data API exponga sólo `api` (la autoexposición de nuevas tablas ya estaba apagada).
2. Probar permisos positivos y negativos con identidades ficticias: anon, empleado propio/tercero, encargado dentro/fuera de su ámbito y jefe; incluir notas privadas y RPC legacy directos.
3. Cerrar auditoría de Auth/RLS/grants y validar la lectura remota de UI antes de considerar SQL015 o ampliar mutaciones.

El modo remoto sigue opt-in y de sólo lectura; el laboratorio local continúa
como modo predeterminado. No se activó producción, Site operativo ni usuarios
reales.
