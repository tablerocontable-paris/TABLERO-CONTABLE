# Grupo París en tu PC personal

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

## Datos del laboratorio

GitHub sincroniza el código y el historial Git; no sincroniza el estado ficticio guardado en el navegador (`paris-state-lab`) ni los archivos locales de IndexedDB. Para trasladar ese estado, exportá el respaldo desde la interfaz de «Vista de prueba», guardalo en un medio privado, y restauralo en la otra PC. El respaldo contiene datos ficticios y no está cifrado. No subirlo al repositorio.

El laboratorio local no necesita Supabase y seguirá siendo la pantalla predeterminada. El proyecto `grupo-paris-dev` (región `sa-east-1`) está activo y vacío. El repo contiene workflows de GitHub Actions para las migraciones por etapas, aunque la integración GitHub del Dashboard de Supabase no está vinculada. Aún no hay migraciones remotas aplicadas. SQL015 está aceptada por Sol para DEV con hash exacto, pero no se aplicará hasta terminar el preflight remoto de 001–014.

**Acción pendiente en GitHub para iniciar el preflight:** en el repositorio, abrí Settings → Secrets and variables → Actions → New repository secret. Nombre: `SUPABASE_DEV_DB_URL`. Valor: URL Session pooler de `grupo-paris-dev`, tomada desde Connect en Supabase. Guardala directamente en GitHub; nunca la pegues en el chat ni en un archivo del repo. Después se ejecutará primero el preflight de sólo lectura y se revisará el resultado antes de escribir en DEV.

## Qué queda alojado

El Site privado de pruebas sigue en el proyecto Sites existente y conserva su audiencia actual. GitHub es la fuente de código para trabajar desde esta PC; no reemplaza automáticamente el Site ni traslada los datos del navegador. El bootstrap de Supabase Auth está publicado pero apagado por defecto; incluso si se activa sólo muestra diagnóstico. No hay todavía un tablero operativo conectado ni hosting propio. Cloudflare y correo/Gmail siguen pendientes.
