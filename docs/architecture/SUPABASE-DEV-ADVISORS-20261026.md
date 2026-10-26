# Supabase DEV — reconsulta de Advisors

**Fecha de observación:** 26/10/2026, aproximadamente 18:06 UTC
**Proyecto:** `grupo-paris-dev` (`kynqjfhqujnjojcmurwf`)
**Método:** Supabase MCP `get_advisors`, consultas read-only de seguridad y rendimiento. No se ejecutó SQL ni se modificó configuración.

## Resultados actuales

| Nivel | Aviso | Cantidad | Lectura y acción pendiente |
|---|---|---:|---|
| INFO | Tablas con RLS y sin policies | 29 | Puede ser intencional para tablas internas y acceso exclusivamente por RPC; confirmar que las tablas no queden expuestas y probar denegación directa. No agregar policies genéricas. |
| WARN | Funciones `SECURITY DEFINER` ejecutables por `authenticated` | 39 | Revisar permisos/grants, esquema Data API expuesto, `search_path`, comprobaciones de identidad y autorización de cada RPC. El aviso requiere auditoría; por sí solo no demuestra una explotación. |
| INFO | Foreign keys sin índice cubriente | 124 | Evaluar con volumen y planes representativos antes de agregar índices en bloque. |
| WARN | Policies con `auth_rls_initplan` | 8 | Verificar costo y aplicar el patrón recomendado sólo mediante una migración revisada y probada. |
| INFO | Índices sin uso observado | 12 | DEV no tiene carga operativa; no eliminarlos por el contador de uso de este entorno vacío. |

## Lectura de seguridad

La revisión de grants ya registrada en `SUPABASE-DEV-CONNECTION-BASELINE-20261026.md`
indica que las tablas señaladas no conceden DML/SELECT a `anon` ni a
`authenticated`; las tablas por sí solas quedan sin acceso directo. También
registra `search_path` vacío en las funciones revisadas y sin EXECUTE para
`anon`. Esos controles no reemplazan verificar la configuración real de Data
API ni demostrar el comportamiento con sesiones de prueba.

El valor **Automatically expose new tables** está documentado como apagado.
Sigue pendiente comprobar en Supabase Dashboard que **Exposed schemas** tenga
únicamente `api`, y verificar las 39 funciones expuestas potencialmente bajo
`public` contra la intención de las migraciones. No conectar la aplicación
remota, crear usuarios ni activar el espacio operativo hasta completar la
matriz de permisos con identidades ficticias. No revocar grants masivamente:
varias funciones son los comandos del contrato de la aplicación y requieren
una revisión función por función.

## Referencias de remediación

- [Tablas con RLS sin policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [SECURITY DEFINER ejecutable por authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Foreign keys sin índice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- [Auth en planes de inicialización RLS](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)
- [Índices sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)

## Siguiente trabajo

1. Confirmar manualmente en Dashboard el esquema expuesto; registrar el resultado sin capturar claves.
2. Comparar las 39 funciones contra grants, esquema, cuerpos y contratos SQL locales.
3. Ejecutar pruebas de acceso positivo y negativo para anon, empleado, encargado y jefe en DEV.
4. Separar problemas de seguridad que requieran migración de las optimizaciones de rendimiento.
5. Probar cualquier migración en una copia local descartable, revisar y aceptar antes de aplicarla a DEV.
