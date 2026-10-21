# Corte de implementación local — 21/10/2026

La puerta `SupabaseAuthGate` ya tiene inicio/cierre de sesión, identidad derivada de `get_context_v1`, MFA TOTP requerido para jefe/encargado, guardas para respuestas asíncronas obsoletas y formulario de acceso. Validación actual (21/10/2026): 7 pruebas enfocadas; suite 760/760 en 77 archivos; TypeScript, build cliente y build Worker aprobados. La prueba nueva confirma enrolamiento TOTP obligatorio para encargado. Esto sigue sin conectar `src/main.tsx` ni activar el área operativa remota.

Lectura remota repetida el 21/10/2026: `grupo-paris-dev` continúa con 0 migraciones y 0 tablas en `public`, `api` y `app_private`; no se aplicó ningún cambio remoto.

Siguiente acción: guardar `SUPABASE_DEV_DB_URL` como secreto de Actions y ejecutar `.github/workflows/supabase-dev-migrations.yml` con `Apply migrations` desmarcado. Tras aprobar destino, historial vacío y lista exacta, ejecutar la segunda corrida para aplicar únicamente a DEV. Luego auditar el esquema y conectar la app. Cloudflare, correo y prueba desde la PC personal siguen pendientes.

---
# Estado de conexión de la aplicación para migración remota — 21/10/2026

## Avance local adicional — configuración del cliente, 21/10/2026

Se agregó `src/data/supabase/client.ts` para validar URL y clave pública/anon,
rechazar claves privilegiadas y construir un cliente de navegador con sesión
persistente y renovación automática. `.env.example` documenta los dos nombres
de variables sin valores. La prueba enfocada pasó 9/9 y TypeScript no reportó
errores. Esto todavía no crea una sesión, no instancia el cliente en el arranque,
no habilita el acceso a DEV ni reemplaza el laboratorio local.

## Avance local de integración — 21/10/2026

Se agregó `src/data/supabase/operational-transport.ts`: valida los envelopes
v1 existentes, exige una sesión Supabase antes de llamar a
`get_context_v1`, `query_v1` o `command_v1`, valida las respuestas y expone
errores categorizados sin filtrar detalles de Postgres. La identidad y los
permisos siguen determinados por el JWT y las funciones SQL; el transporte no
acepta un actor o perfil de la interfaz.

Este adaptador todavía no instancia el cliente, no está conectado a
`src/main.tsx`, no reemplaza el laboratorio y no se ha llamado contra el
proyecto alojado. La prueba unitaria enfocada pasó 6/6; la suite completa pasó
744/744 en 75 archivos, TypeScript pasó y también los builds Vite y Worker. Vite
emitió avisos no fatales de anotaciones dentro de la dependencia Zod. No hay
autenticación ni lectura/escritura remota disponibles para usuarios todavía.
Una revisión técnica independiente aceptó este alcance local y solicitó probar
rechazos de respuesta malformada y de un `actorId` inyectado; esas comprobaciones
quedaron añadidas. Los RPC se invocan explícitamente con `client.schema("api")`,
que coincide con el esquema de SQL014.

Auditoría inicial local del repositorio después de publicar `ad47ff9` en
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
- Hay contratos inyectables bajo `src/data/remote` y `src/data/supabase`.
  `operational-transport.ts` ahora invoca RPC v1 con un cliente inyectado, pero
  `src` aún no instancia ese cliente ni tiene configuración de Auth; no está
  conectado a la aplicación. `src/server/supabase-report-store.ts` sólo recibe
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

En el estado local auditado, `rg` no encontró una instancia `createClient`,
`@supabase/ssr`, `import.meta.env`, `VITE_SUPABASE` ni `SUPABASE_URL` bajo
`src`. Los dos imports de `@supabase/supabase-js` son exclusivamente de tipo,
en `src/data/supabase/operational-transport.ts` y
`src/server/supabase-report-store.ts`.
Referencias: `src/main.tsx:3,28-34`,
`src/components/LaboratoryWorkspace.tsx:16-18`,
`src/components/RemoteWorkspace.tsx:1-10,29`,
`src/data/site-client.ts:34-60` y `src/server/site-worker.ts:14-19,29-45`.
