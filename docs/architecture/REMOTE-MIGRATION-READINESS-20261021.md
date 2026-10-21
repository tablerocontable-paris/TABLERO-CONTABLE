# Estado de conexión de la aplicación para migración remota — 21/10/2026

Auditoría local del repositorio después de publicar `ad47ff9` en
`tablerocontable-paris/TABLERO-CONTABLE`. No se conectó una sesión ni se cambió
ningún servicio remoto.

## Hallazgos comprobados

- `src/main.tsx` monta `LaboratoryWorkspace`.
- `src/components/LaboratoryWorkspace.tsx` carga y persiste datos mediante el
  repositorio local; declara que no importa el espacio operativo ni llama a su
  API.
- `src/components/RemoteWorkspace.tsx` no está conectado al arranque principal.
  Sus pruebas unitarias no significan que el sitio esté usando esta ruta.
- Si se monta `RemoteWorkspace`, `src/data/site-client.ts` envía estado completo
  a `/api/workspace`. Esa ruta pertenece a `src/server/site-worker.ts`, que usa
  el binding D1, las cabeceras de identidad del entorno Sites y el almacén
  `site-store`; no implementa Supabase Auth ni el contrato de RPC.
- Hay contratos y adaptadores inyectables bajo `src/data/remote` y
  `src/data/supabase`, pero el código de `src` no instancia un cliente Supabase
  ni implementa un transporte real para esos RPC. `@supabase/supabase-js` está
  declarado como dependencia; `src/server/supabase-report-store.ts` sólo recibe
  un cliente ya creado y no crea ni conecta uno.
- Por eso, el repositorio contiene preparación y contratos para Supabase, pero
  hoy no hay un recorrido de usuario autenticado que lea y guarde trabajo en el
  esquema Supabase. El build actual sigue siendo el laboratorio local.

## Consecuencia para el plan

Aplicar las migraciones a `grupo-paris-dev` es el primer despliegue de base,
no la finalización de la migración de la aplicación. Una vez aceptado el
preflight remoto, la secuencia pendiente queda así:

1. Aplicar y auditar el esquema en DEV; comprobar historial, RLS, grants,
   funciones, exposición Data API y advisors.
2. Definir e implementar el proveedor de identidad Supabase Auth y el transporte
   autenticado, sin exponer `service_role` en el navegador ni confiar en el
   selector de perfil simulado.
3. Conectar lecturas y escrituras de la aplicación a los contratos/RPC aprobados;
   convertir la pantalla operativa desde estado completo local/D1 a datos del
   actor y organización autorizados. Mantener el laboratorio sintético aislado.
4. Incorporar archivos/Storage, recuperación y respaldos; comprobar permisos y
   flujos de error con cuentas ficticias en DEV.
5. Añadir CI y despliegue privado de frontend/Worker en Cloudflare, y configurar
   correo cuando la identidad y el proveedor estén autorizados.
6. Probar desde una segunda PC: clonar `main`, preparar el entorno sin
   credenciales versionadas, iniciar sesión y completar un flujo sintético.

No mover los datos ficticios actuales a Supabase por medio de una escritura de
estado completo. El contrato del producto usa comandos específicos con
autorización de servidor. No habilitar Site operativo, no crear usuarios reales
y no tocar producción dentro de esta etapa.

## Verificación reproducible

En el estado local auditado, `rg` no encontró `createClient`, `@supabase/ssr`,
`import.meta.env`, `VITE_SUPABASE` ni `SUPABASE_URL` bajo `src`. El único import
de `@supabase/supabase-js` es de tipo en `src/server/supabase-report-store.ts`.
Referencias: `src/main.tsx:3,28-34`,
`src/components/LaboratoryWorkspace.tsx:16-18`,
`src/components/RemoteWorkspace.tsx:1-10,29`,
`src/data/site-client.ts:34-60` y `src/server/site-worker.ts:14-19,29-45`.
