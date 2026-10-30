# Aceptación Sol — código SQL017 para DEV

Fecha: 30/10/2026
Dictamen: **apto para aplicar SQL017 en grupo-paris-dev**

## Identificación aceptada

- Migración: `supabase/migrations/20261030012651_activity_executor_authorization.sql`
- SQL017 SHA-256: `B41666E1AC41EC019673C61787AC89F2265BD018F617295C1395E80C93B31770`
- Alcance: exigir permiso de ejecución para registrar actividad y sus reintentos; rechazar escritura en operativas conjuntas históricas.

## Revisión y evidencia

La revisión independiente confirmó que el control se ejecuta tras adquirir los bloqueos y volver a leer la tarea, y también antes de devolver un recibo repetido. Se conserva la identidad real del actor y la superficie pública existente; no se agregan grants ni tablas.

Las regresiones cubren el salto 016→017, ACL del wrapper y helper interno, superior con lectura pero sin escritura, responsable autorizado, reemplazo de cobertura vigente, cobertura cancelada, operativa conjunta histórica y reintentos. Suite focal: **17/17**; suite total: **898/898** en 89 archivos; TypeScript, builds de cliente/Worker y `git diff --check` aprobados. GitHub Actions #198 pasó para `426aaf30bc550372953e5ce0be7b069f5ec60eaa`.

## Aplicación en DEV y límites

Esta aceptación habilitó SQL017 **sólo en `grupo-paris-dev`**, cuyo historial remoto leído antes de la aplicación contenía exactamente las 18 migraciones esperadas hasta SQL016. Supabase registró la nueva versión como `20261030012651`. Después de aplicar, la lectura remota confirmó 19 migraciones; la definición contiene ambas guardas; `authenticated` ejecuta el wrapper, `anon` no lo ejecuta y `authenticated` no ejecuta el helper interno. No habilita Auth operativo, producción, cambios de exposición Data API ni uso con datos reales. La autorización y los reintentos todavía necesitan pruebas con JWT en el servicio remoto.
