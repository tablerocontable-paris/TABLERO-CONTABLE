# Continuidad portátil — Grupo París

Actualizado el 28/10/2026. Éste es el estado para retomar el proyecto desde otra
PC o aplicación; la documentación anterior de este archivo quedó reemplazada.

## Fuentes vigentes

- Repositorio privado: [`tablerocontable-paris/TABLERO-CONTABLE`](https://github.com/tablerocontable-paris/TABLERO-CONTABLE), rama `main`.
- Catálogo v4 está publicado directamente en `main` como `d9da38f`; su guía se
  registró en `e3f389c`. GitHub confirmó el push bajo `tablerocontable-paris`,
  sin PR; GitHub CI valida los commits publicados. El repositorio permanece privado.
- Site de laboratorio existente, v4 desplegado como versión 103:
  <https://grupo-paris-contabilidad.valentino-magni.chatgpt.site>, fuente Sites
  `90df8234f0f66748b49cf113844050c43b8caf9a`. Conserva acceso
  personalizado al propietario, sin invitados externos.
- GitHub y la fuente del Site son repositorios distintos. Un push a GitHub no
  despliega el Site automáticamente; la publicación se hace con Sites y conserva
  la audiencia actual.

## Estado funcional comprobado

El catálogo v4 ofrece las siete unidades solicitadas: PARIS AUTOS, DORAL,
PARIS CARS, PARIS TRAC, MOTOR, FIDEICOMISO DESARROLLO y POSTVENTA. El catálogo
v4 tiene 55 tareas con códigos y nombres canónicos. Las 55 se pueden elegir;
25 están confirmadas para comparación y 30 son provisionales, cada una con
código propio y excluida de comparaciones entre unidades hasta confirmar su
alcance. Banco, cuenta, sucursal, sistema, período y otros datos son parámetros
separados, no parte del nombre de tarea. “Carga de otras facturas” exige indicar
el subtipo. Catálogos v1 y v2 se conservan para leer registros anteriores.

La suite completa v4 pasó **867/867 pruebas en 87 archivos**; TypeScript, build
del cliente, Worker y paquete Sites también pasaron. El hook previo al commit
pasó **223/223**; catálogo/onboarding focal pasó **21/21**. La revisión
independiente no encontró regresiones.
El build conserva avisos de Rollup por comentarios de Zod y por el chunk
principal (655 kB). No se tocaron Supabase, Auth operativo, `/api` ni SQL001–016.

El Site y el repositorio siguen en modo laboratorio: perfiles y datos ficticios.
El despliegue no constituye aceptación para producción ni habilita usuarios
reales.

## Continuar desde la PC personal

1. Iniciá sesión en GitHub con `tablerocontable-paris` (repositorio privado).
2. Instalá Git for Windows y Node.js 24 LTS si faltan. Node instala `npm`.
3. En PowerShell, comprobá `git --version`, `node --version` y `npm --version`;
   Node debe mostrar `v24.x`. Si Git solicita autenticación, usá Git Credential
   Manager y la cuenta con acceso al repo; no pegues contraseñas ni tokens en
   Codex.
4. En PowerShell:

   ```powershell
   New-Item -ItemType Directory -Force -Path "$HOME\Documents" | Out-Null
   Set-Location "$HOME\Documents"
   git clone https://github.com/tablerocontable-paris/TABLERO-CONTABLE.git
   cd TABLERO-CONTABLE
   npm ci
   npm run hooks:install
   npm run dev -- --host 127.0.0.1
   ```

5. Abrí `http://127.0.0.1:5173` para ver la copia local. En Codex, abrí la
   carpeta clonada y pedile: “Continuá este proyecto existente desde este repo.
   Antes de editar, leé `AGENTS.md`, `docs/PROJECT-STATUS.md`,
   `docs/EXECUTION-NEXT.md` y `outputs/LEEME-PC-PERSONAL.md`; revisá `git status`
   y respetá las protecciones del proyecto. No crees otro repo ni otro Site.”
   Para actualizar la copia en otra fecha, ejecutá `git switch main` y
   `git pull --ff-only origin main`.

Trabajá desde una PC a la vez. Antes de cambiar, guardá y publicá los cambios en
`main`; luego actualizá la otra copia. Las modificaciones acordadas se integran
directamente a `main`, sin Pull Request.

## Datos y servicios

GitHub sincroniza código, historial, contratos, documentación y pruebas. No
sincroniza el estado del navegador, IndexedDB ni la base D1 alojada por Sites.
Un respaldo de laboratorio se exporta desde la interfaz y se guarda fuera de
GitHub; no está cifrado. No subir datos de clientes, archivos originales,
credenciales, sesiones ni anotaciones privadas.

Supabase DEV y SQL001–016 continúan separados del laboratorio y no se migran al
abrir el clon. No configurar credenciales en el repositorio. Antes de retomar,
leer `AGENTS.md`, `docs/PROJECT-STATUS.md`, `docs/EXECUTION-NEXT.md` y
`outputs/LEEME-PC-PERSONAL.md`.
