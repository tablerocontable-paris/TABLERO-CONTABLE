# Grupo París en tu PC personal

## Estado de continuidad actualizado — 26/10/2026

La rama principal `main` está en el repositorio privado
`tablerocontable-paris/TABLERO-CONTABLE`. El producto en el commit
`13132ec5df85856eae378ff8d05efa9397d7c398` pasó CI 97; el commit documental
`f62ee502bfd2270fe9d8784dfccb8bfec3bd2d1c` se publicó directamente en `main`,
y CI 98 estaba ejecutando `npm test` al último control. Consultá Actions antes
de tomar ese run como aprobado.

La preferencia de usar subagentes cuando ayuden, normalmente uno a la vez, está
registrada en `AGENTS.md`. El catálogo neutral de 26 conceptos es opcional y no
crea trabajo sin aprobación. Las capturas sólo prueban 14 filas de personas
visibles más «Sin asignar»; no permiten estimar el personal actual ni tareas
reales completadas hoy. El estado con detalle y límites está en
`docs/MIGRATION-INVENTORY-20261026.md`.

## Supabase DEV

El proyecto Supabase `grupo-paris-dev` está activo y tiene 16 migraciones
aplicadas (001–014). SQL015 tiene aceptación Sol anterior; SQL016 fue aprobada
para DEV con hash
`F7E76313AD4132626034C5C9D38F1C70AFB140BB3E2CE3615FE89071945ED8F3` y corrige
la lectura de tareas luego de revocar una membresía. La prueba focal pasó 10/10
con revisión independiente. Al actualizar `main`, ejecutar en GitHub Actions
`Supabase DEV migrations`: primero `apply_015` y, sólo tras éxito, `apply_016`,
ambos con `apply_migrations=true`. El workflow valida el historial y el SQL
exactos. No aplicar SQL manualmente. El código local de la 016 todavía no se
había aplicado en el proyecto cuando se registró esta nota.

Antes de cargar datos reales siguen pendientes: confirmar que Data API exponga
únicamente `api`, contrastar las ACL/catálogos instalados y completar pruebas de
permisos. La aceptación Sol del archivo no equivale a aceptación de producción.

Estado al 26/10/2026: la versión v2 del catálogo neutral de primer ingreso está
en `main`; el commit de código `ad1b4180556307755c7a4e0fd221316237fc341c` pasó
GitHub Actions run `40409657073`. La actualización documental vigente es
`a087d7b801827c9bc31fdc9fd23707f915741a49` (autor **Tablero Contable**); su
validación CI está pendiente. El mismo Site privado ya está publicado como v98
con estado `succeeded`. Para verlo, usá la cuenta ChatGPT propietaria del Site;
la conexión a GitHub no da acceso a Sites.

Para entender qué viaja por GitHub y qué requiere una copia privada, consultar
`docs/MIGRATION-INVENTORY-20261026.md`. La línea base ficticia y los conceptos
neutrales propuestos para el primer alta están en
`docs/product/STARTER-CATALOG-AND-BASELINE-20261026.md`. El conteo del seed no
representa empleados reales ni tareas cumplidas hoy.

## Qué contexto se migra y qué queda fuera

GitHub contiene el código, historial Git, especificaciones, decisiones,
resultados de auditoría y próximos pasos pertinentes al proyecto. No puede
contener toda la memoria global de Codex ni el historial bruto de chats; tampoco
se deben subir credenciales, sesiones, estado privado del navegador ni datos
reales de personas/clientes. Las decisiones útiles de los chats se registran en
`docs/`; la copia local ficticia del laboratorio se exporta aparte desde la
interfaz y no está cifrada.

## Código fuente: GitHub

El repositorio oficial privado es [`tablerocontable-paris/TABLERO-CONTABLE`](https://github.com/tablerocontable-paris/TABLERO-CONTABLE), rama `main`. La cuenta propietaria es `tablerocontable-paris`; los cambios nuevos se publican directamente en `main` y el commit vigente figura como **Tablero Contable**.

1. En la PC personal, instalá Git for Windows y Node.js 24 LTS.
2. Iniciá sesión en GitHub con la cuenta `tablerocontable-paris` y confirmá que podés abrir el repositorio privado.
3. En PowerShell, cloná el proyecto e instalá las dependencias:

   ```powershell
   git clone https://github.com/tablerocontable-paris/TABLERO-CONTABLE.git
   cd TABLERO-CONTABLE
   npm ci
   npm run hooks:install
   npm run dev -- --host 127.0.0.1
   ```

4. Abrí `http://127.0.0.1:5173` y, para editar, abrí la carpeta `TABLERO-CONTABLE` en tu editor.
5. Para traer cambios nuevos a esa PC, detené el servidor y ejecutá:

   ```powershell
   git switch main
   git pull --ff-only origin main
   npm ci
   ```

6. Para publicar cambios desde la PC personal, usá GitHub con la cuenta propietaria. El flujo acordado trabaja directamente en `main`, sin pull request. Antes de editar desde otra computadora, subí los cambios pendientes de la computadora actual; no edites ambas copias a la vez.

El trabajo normal está en `main`. Se preservaron además dos ramas de archivo
para recuperar historia anterior de Sites, fuera de la historia de `main`:
`archive/sites-source-history-20261015` y
`archive/site-analytics-stash-20261007`. No son ramas de trabajo/despliegue.

## Datos del laboratorio

GitHub sincroniza el código y el historial Git; no sincroniza el estado ficticio guardado en el navegador (`paris-state-lab`) ni los archivos locales de IndexedDB. Para trasladar ese estado, exportá el respaldo desde la interfaz de «Vista de prueba», guardalo en un medio privado, y restauralo en la otra PC. El respaldo contiene datos ficticios y no está cifrado. No subirlo al repositorio.

El laboratorio local no necesita Supabase y seguirá siendo la pantalla predeterminada. `grupo-paris-dev` está activo y tiene aplicadas las 16 migraciones 001–014. El secreto `SUPABASE_DEV_DB_URL` validó y conectó correctamente el 26/10/2026; no hace falta volver a cambiarlo. El preflight #3 falló porque esperaba una base vacía y encontró el historial exacto ya aplicado; no fue un error de contraseña ni ejecutó SQL. SQL015 sigue pendiente.

**Próximo paso de migración:** tras actualizar `main`, correr 015 y 016 en orden desde el workflow de GitHub. Luego verificar en Supabase Dashboard que Data API exponga únicamente `api` y ejecutar pruebas de permisos con identidades ficticias. No volver a ejecutar 001–014. Nunca compartas la URI o la contraseña por chat ni en archivos del repo.

## Qué queda alojado

El Site privado de pruebas sigue en el proyecto Sites existente, ahora v98, y
conserva su audiencia actual. GitHub es la fuente de código para trabajar desde
esta PC; no reemplaza el Site ni traslada el estado del navegador. El bootstrap
de Supabase Auth está publicado pero apagado por defecto. Antes de datos reales
falta cerrar el hallazgo de permisos de la consulta legacy de encargado,
confirmar exposición sólo de `api`, ACL instaladas y pruebas negativas; ver
`docs/architecture/SUPABASE-DEV-RPC-REVIEW-20261026.md`. No hay todavía un
tablero operativo conectado ni hosting propio. Cloudflare no está configurado y
el correo sólo tiene proveedor ficticio.
