# Continuar el proyecto desde tu PC personal

Actualizado el 28/10/2026. Esta guía reemplaza instrucciones anteriores de
traslado del proyecto.

## Fuente de código

- Repositorio privado de GitHub: [`tablerocontable-paris/TABLERO-CONTABLE`](https://github.com/tablerocontable-paris/TABLERO-CONTABLE)
- Rama activa: `main`; commit funcional v4 `d9da38f`, ya publicado. Para
  actualizar una copia existente, ejecutá `git pull --ff-only origin main`.
- El código no se entrega en ZIP: cloná el repositorio para conservar historia
  y poder traer los cambios futuros.
- Los cambios acordados se publican directamente en `main`, sin Pull Request.

## Preparar la PC personal

1. Iniciá sesión en GitHub con la cuenta `tablerocontable-paris`, que tiene
   acceso al repositorio privado.
2. Instalá Git for Windows y Node.js 24 LTS si todavía no están instalados.
   Node.js instala `npm`.
3. Abrí PowerShell y comprobá las herramientas:

   ```powershell
   git --version
   node --version
   npm --version
   ```

   `node --version` debe mostrar una versión `v24.x`. Si `git clone` pide
   iniciar sesión, usá la ventana de autenticación de Git Credential Manager
   con la cuenta `tablerocontable-paris`; no pegues contraseñas ni tokens en
   Codex.
4. En PowerShell, elegí una carpeta para el proyecto y ejecutá:

   ```powershell
   New-Item -ItemType Directory -Force -Path "$HOME\Documents" | Out-Null
   Set-Location "$HOME\Documents"
   git clone https://github.com/tablerocontable-paris/TABLERO-CONTABLE.git
   cd TABLERO-CONTABLE
   npm ci
   npm run hooks:install
   npm run dev -- --host 127.0.0.1
   ```

5. Abrí `http://127.0.0.1:5173` para ver la copia local. Para trabajar con
   Codex, abrí la carpeta `TABLERO-CONTABLE` clonada en Codex e iniciá sesión
   en GitHub con la cuenta que tiene acceso al repositorio.
6. Al abrir el repo en Codex, podés pedirle:

   > Continuá este proyecto existente desde este repositorio. Antes de editar,
   > leé `AGENTS.md`, `docs/PROJECT-STATUS.md`, `docs/EXECUTION-NEXT.md` y
   > `outputs/LEEME-PC-PERSONAL.md`. Revisá `git status` y respetá las
   > protecciones del proyecto. No crees otro repo ni otro Site.

   Para trabajar desde ChatGPT en vez de Codex, abrí este repositorio con la
   integración de GitHub vinculada a esa misma cuenta.

## Cambiar entre computadoras

Trabajá en una sola copia a la vez. Antes de dejar una PC, guardá y publicá los
cambios en `main`. En la otra PC:

```powershell
git switch main
git pull --ff-only origin main
npm ci
```

## Estado del proyecto al traslado

- La normalización inicial de Grupo París está en el onboarding del laboratorio.
  Las siete unidades están fijadas: PARIS AUTOS, DORAL, PARIS CARS, PARIS TRAC,
  MOTOR, FIDEICOMISO DESARROLLO y POSTVENTA.
- El catálogo v4 ofrece las 55 tareas observadas con nombres canónicos y códigos
  versionados. Veinticinco son comparables; treinta son provisionales y se
  pueden elegir/registrar con código propio, pero no se comparan entre unidades
  hasta confirmar su alcance. “Carga de otras facturas” exige indicar el
  subtipo. Los alias ayudan a encontrar la tarea, pero no crean nombres nuevos.
- Conciliación bancaria usa un nombre común; `CONC BANC FRANC` es un alias de
  búsqueda que conduce a esa tarea canónica. Banco, cuenta y unidad se guardan
  como campos separados. Los registros históricos sin código no se clasifican
  automáticamente.
- La validación local v4 pasó TypeScript, suite completa (867/867 en 87
  archivos), build del cliente y Worker, empaquetado Sites, revisión
  independiente y hook (223/223). GitHub confirmó el push directo a `main`, sin
  PR; GitHub CI valida los commits de `main`. El Site privado sigue en v102 hasta publicar
  v4.
  GitHub y Sites son repositorios separados: los pushes a GitHub no despliegan
  el Site automáticamente.
- El Site conserva acceso personalizado al propietario y cero visitantes
  externos. Está en
  <https://grupo-paris-contabilidad.valentino-magni.chatgpt.site>.
- Esta etapa sigue siendo un laboratorio con perfiles/datos ficticios. No se
  activaron usuarios reales, Auth operativo, `/api`, producción ni migraciones
  nuevas de Supabase. SQL001–016 no se modificaron.

## Qué no viaja con GitHub

El clon conserva código, historia, requisitos, documentación y pruebas. No
incluye el estado local del navegador, IndexedDB ni la base D1 del Site. Si
necesitás llevar datos ficticios del laboratorio, exportalos desde su interfaz y
guardá el respaldo fuera del repositorio; el respaldo no está cifrado. No
subas credenciales, sesiones, información de clientes ni archivos originales.

Para retomar, leé `AGENTS.md`, `docs/PROJECT-STATUS.md` y
`docs/EXECUTION-NEXT.md`. El inventario de pendientes y contratos se mantiene en
`docs/`.
