# Grupo París en tu PC personal

## Estado de continuidad actualizado — 27/10/2026

La rama principal `main` está en el repositorio privado
`tablerocontable-paris/TABLERO-CONTABLE`. Los commits de continuidad se publican
directamente, sin PR. El último commit documental es
`b199c900e3c5a0b04694f07ea01d4b32876e7790`, autor Tablero Contable; GitHub
Actions run 104 terminó correctamente (suite, build y paquete Sites). Antes de
editar, hacé `git pull --ff-only origin main`.

La preferencia de usar subagentes cuando ayuden, normalmente uno a la vez, está
registrada en `AGENTS.md`. El catálogo neutral de 26 conceptos es opcional y no
crea trabajo sin aprobación. Las capturas sólo prueban 14 filas de personas
visibles más «Sin asignar»; no permiten estimar el personal actual ni tareas
reales completadas hoy. El estado con detalle y límites está en
`docs/MIGRATION-INVENTORY-20261026.md`.

## Supabase DEV

El proyecto Supabase `grupo-paris-dev` está activo y registra 18 versiones
correspondientes a SQL001–016. Las corridas #1, #2 y #3 aplicaron y verificaron
001–014, 015 y 016. No volver a aplicar la línea base ni 015/016. La corrida #4
falló de forma segura porque se eligió la línea base con el historial completo;
el control abortó antes de cualquier escritura. El workflow ahora inicia en
`verify_current`, de sólo lectura.

Antes de Auth, datos reales o frontend conectado sigue pendiente verificar en el
Dashboard que Data API exponga sólo `api`, revisar ACL/RPC y completar pruebas de
permisos con identidades de DEV. La revisión no equivale a aceptación integral
de producción.

El catálogo v2 está publicado en el mismo Site privado como v98, desde el
commit de código `ad1b4180556307755c7a4e0fd221316237fc341c`; el run de validación
del paquete Sites `40409657073` pasó. Hubo commits posteriores de correcciones y
continuidad; revisá Actions para el estado actual. Para abrir el Site, usá la
cuenta ChatGPT propietaria; conectar GitHub no concede acceso a Sites.

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

GitHub sincroniza el código y el historial Git; no sincroniza el estado del
navegador (`paris-state-lab`), IndexedDB ni la base D1 del Site. La relectura
read-only del 27/10 encontró en el D1 de laboratorio cuatro perfiles marcados
activos y una tarea en curso sin cierre; el workspace sigue fechado el 06/10.
Esto no estima la dotación ni la actividad real del 27/10. Las colecciones
revisadas no tienen una colección separada de comentarios. No copiamos nombres,
emails, identificadores, auditoría ni respaldo del navegador a GitHub.

Para trasladar estado de navegador, exportá el respaldo desde la interfaz de «Vista de prueba», guardalo en un medio privado y restauralo en la otra PC. El respaldo contiene datos ficticios y no está cifrado. No subirlo al repositorio. El D1 sigue alojado en el Site y no se incorpora automáticamente al clon de GitHub.

El laboratorio local no necesita Supabase y sigue siendo la vista predeterminada.
El secreto `SUPABASE_DEV_DB_URL` ya conectó; no volver a cambiarlo. La línea
base y SQL015/016 están aplicadas en DEV. El intento #4 no alteró la base.

**Próximo paso de migración:** cerrar la auditoría de ACL/RPC y verificar la
configuración Data API en el Dashboard; no hay migraciones pendientes de
aplicación. No compartir URI ni contraseña por chat o archivos del repo.

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
