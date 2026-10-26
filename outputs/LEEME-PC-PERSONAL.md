# Grupo París en tu PC personal

Estado del código al 26/10/2026: la versión v2 del catálogo neutral de primer
ingreso está en `main`, commit `a51bc395dbd2d2ec65ee3f328287c1be8cd3d6b4`, con
autor **Tablero Contable**. GitHub Actions run `40408104684` aprobó suite, build y
paquete Sites. El Site privado todavía es v97; su actualización está pendiente
de resolver el acceso de escritura a la fuente de Sites. Esto no impide clonar y
ejecutar el código actualizado en esta PC.

Para entender qué viaja por GitHub y qué requiere una copia privada, consultar
`docs/MIGRATION-INVENTORY-20261026.md`. La línea base ficticia y los conceptos
neutrales propuestos para el primer alta están en
`docs/product/STARTER-CATALOG-AND-BASELINE-20261026.md`. El conteo del seed no
representa empleados reales ni tareas cumplidas hoy.

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

**Próximo paso de migración:** verificar en Supabase Dashboard que Data API exponga únicamente el esquema `api` y ejecutar pruebas de permisos con identidades ficticias. No ejecutar otra vez la aplicación 001–014; ya está hecha. Nunca compartas la URI o la contraseña por chat ni en archivos del repo.

## Qué queda alojado

El Site privado de pruebas sigue en el proyecto Sites existente y conserva su audiencia actual. GitHub es la fuente de código para trabajar desde esta PC; no reemplaza automáticamente el Site ni traslada los datos del navegador. El bootstrap de Supabase Auth está publicado pero apagado por defecto; incluso si se activa sólo muestra diagnóstico. No hay todavía un tablero operativo conectado ni hosting propio. Cloudflare no está configurado y el correo sólo tiene proveedor ficticio; ambos siguen pendientes y dependen de integrar/auditar Supabase DEV.
