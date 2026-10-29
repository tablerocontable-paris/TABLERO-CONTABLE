# Revisión REST de esquemas expuestos — Supabase DEV

Fecha: 29/10/2026
Proyecto: `grupo-paris-dev` (`kynqjfhqujnjojcmurwf`)
Tipo: comprobación externa de sólo lectura; no modifica configuración ni datos.

## Resultado

Se consultó el endpoint REST de DEV con una clave publicable y nombres RPC
deliberadamente inexistentes. Las respuestas distinguen los esquemas aceptados
por PostgREST de los rechazados, sin ejecutar funciones ni escribir datos:

| Perfil solicitado | HTTP / resultado | Conclusión |
|---|---|---|
| `api` | 406 `PGRST106`; indica que sólo están expuestos `public, graphql_public` | `api` no está expuesto |
| `public` | 404 `PGRST202`; función de prueba inexistente | El perfil se acepta; no implica que la función exista |
| `app_private` | 406 `PGRST106` | No está expuesto |
| `extensions` | 406 `PGRST106` | No está expuesto |

Perfiles REST aceptados por PostgREST en esta comprobación:
`public` y `graphql_public`. Esto no coincide con el diseño aprobado para el
DEV ya migrado, que requiere exponer sólo `api`. La respuesta del perfil ante
una función inexistente sirve para inferir aceptación del esquema, no demuestra
que las funciones reales sean invocables ni valida sus permisos, RLS, JWT o la
superficie GraphQL. Las comprobaciones SQL anteriores de grants/RLS tampoco
sustituyen estas pruebas.

## Límite y siguiente acción

El conector Supabase disponible no ofrece lectura/escritura de `Exposed
schemas`; tampoco se debe intentar cambiar esta configuración mediante SQL.
La skill de control de Windows prohíbe automatizar cambios en ajustes de
seguridad/privacidad de aplicaciones, por lo que esta sesión no puede aplicar
el cambio en Dashboard. Se debe ajustar en Supabase Dashboard, proyecto
`grupo-paris-dev`, API Settings: dejar únicamente `api` en Exposed schemas y
guardar. Luego repetir esta comprobación REST y verificar que `api` responde
como esquema aceptado y `public`, `graphql_public` y `app_private` son
rechazados. No tocar producción, grants, migraciones ni Auth operativo.

No se usó ni registró la clave publicable, URL completa de RPC ni secretos en
este documento.

## Repetición de la comprobación — 29/10/2026 22:10 UTC

Se repitieron los GET a los perfiles `api`, `public`, `graphql_public`,
`app_private` y `extensions` con una clave publicable vigente y otro nombre RPC
inexistente. El resultado fue idéntico: `public` y `graphql_public` aceptados
(404 `PGRST202` por función inexistente); los otros tres recibieron 406
`PGRST106` con la lista expuesta `public, graphql_public`. No se invocaron
funciones ni se escribió estado. La clave no se guardó ni imprimió.

Esta repetición sólo confirma los perfiles REST aceptados/rechazados por
PostgREST. No es una auditoría completa de seguridad de Data API, funciones,
RLS, JWT ni GraphQL.
