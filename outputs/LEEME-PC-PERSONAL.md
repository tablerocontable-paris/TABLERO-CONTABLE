# Continuar Grupo París desde tu PC personal

Actualizado: 29/10/2026

Repositorio privado: [tablerocontable-paris/TABLERO-CONTABLE](https://github.com/tablerocontable-paris/TABLERO-CONTABLE)

Rama de trabajo: `main` (GitHub es la fuente actual; `git pull` trae el último commit)
Site privado existente: [Grupo París · Tablero contable](https://grupo-paris-contabilidad.valentino-magni.chatgpt.site)

## Antes de empezar

El código y su historial viven en GitHub. El Site es un destino separado y los
pushes a GitHub no lo despliegan automáticamente. El Site sigue siendo un
laboratorio privado, con perfiles/datos ficticios y acceso únicamente de la
cuenta propietaria. No se habilitaron usuarios reales, Auth operativo, `/api`
operativa ni Supabase de producción.

El último commit funcional de `main` es
`8d950075f555507fccf64922680e91bd244a274c`. Incluye el catálogo V7, selección
de varias cuentas por tarea canónica en onboarding y la corrección para poder
quitar/volver a seleccionar “Otro banco”. Sobre ese código pasaron localmente
892/892 pruebas, TypeScript, build de cliente y Worker, y recorrido
Playwright/Edge. GitHub Actions **#189** terminó `success` para el HEAD
documental `74b506e60fc8cf8ed5dd8341fe2fe629e9394ede`, incluyendo suite, build
y paquete Sites. Este resultado sí valida el código funcional que contiene.
El corte documental `90f40a6101a18fc7d950e88d01392eabfc523ca8` pasó Actions
**#190**. En ese corte, el mismo Site
privado se publicó como **v110** desde la fuente Sites
`d65a2a1d906fe1b13dee5bf94a2c70b9684cbe88`; el despliegue pasó y la audiencia
sigue owner-only, con cero visitantes externos. Falta la aceptación manual de
la interfaz interior con sesión. Estas comprobaciones no garantizan error cero.

Actions **#192** terminó `success` para el commit
`9a563fe089380132e8483188ca09ff5e0d656878` (suite, build y paquete Sites). La
ficha de homologación muestra diez pares tarea–unidad candidatos extraídos de
menciones explícitas; siguen pendientes de ratificación y no habilitan
comparaciones. El alias “carga factura VN PA” queda aparte como pista
ambigua, sin expandir `PA` ni `VN`.

Supabase DEV se releyó en modo read-only a las 23:58 UTC: está activo,
saludable y registra 16 migraciones (001–016). Advisors mantiene 29 RLS sin
policies, 39 funciones `SECURITY DEFINER` ejecutables por `authenticated`,
124 FK sin índice cubriente, 8 avisos de initplan y 12 índices no usados.
La exposición de esquemas sigue sin revalidarse desde la sonda de las 22:10
UTC; no activar Auth ni datos reales. Para comenzar desde esta PC, cloná el
repositorio o actualizá el clon existente con `git pull --ff-only origin main`.

En esta PC, el benchmark Edge del árbol `74b506e` pasó 30 recorridos con 24
perfiles/2.000 tareas y p95 502,98 ms; suite completa 892/892, build cliente y
Worker, empaquetado Sites y recorrido de navegador también se repitieron. La
evidencia y sus límites están en
`docs/architecture/review-evidence/laboratory-performance-20261029.json`.

La revalidación de permisos de Supabase DEV quedó registrada en el commit
`b2911fc128092f73bdb61cdb2c43f0d2fe61c636`, sin cambiar el código
funcional ni requerir publicar otra versión del Site. Su hook local pasó
236/236 y GitHub Actions #170 terminó en `success` (suite, build y paquete
Sites). Una sonda REST posterior confirmó que DEV expone `public` y
`graphql_public`, mientras `api` y `app_private` son rechazados. El objetivo es
dejar únicamente `api` expuesto. Evidencia:
`docs/architecture/SUPABASE-DEV-EXPOSED-SCHEMAS-REST-CHECK-20261029.md`.
Debe cambiarse en API Settings del proyecto DEV y revalidarse; Auth operativo
y las pruebas con sesiones Auth DEV siguen pendientes.

El commit documental `5fe0cb66eee6af58149faf7d09dcd2efb0d6030d` agrega una
prueba de paridad entre el catálogo V7 y su ficha de homologación. La suite
local pasó 891/891 pruebas en 88 archivos; Actions #177 pasó suite, build y
paquete Sites para `35e90a3c1eea5b1ef58abd9060a04cf9314bf406`.

Actions **#183** terminó `success` para el corte documental
`91f9505a4a92193206908de7b5ed44314e129829` (suite, build y paquete Sites).

Revisión SQL read-only: las tablas `public`/`app_private` no dan privilegios
efectivos de tabla a `anon`, pero `public` sigue expuesto y conserva RPC
`SECURITY DEFINER` ejecutables por `authenticated`. El objetivo de DEV es
exponer sólo `api`; la evidencia detallada está en
`docs/architecture/SUPABASE-DEV-READONLY-ACCESS-AUDIT-20261029.md` y
`docs/architecture/SUPABASE-DEV-EXPOSED-SCHEMAS-REST-CHECK-20261029.md`; el
último chequeo REST del 29/10 a las 22:10 confirmó que la configuración no
cambió.

## Clonar el repositorio

1. En la PC personal, iniciá sesión en GitHub con la cuenta
   `tablerocontable-paris`, que tiene acceso al repositorio privado.
2. Instalá Git for Windows y Node.js 24 LTS si todavía no están instalados.
   Node incluye `npm`. Comprobá las instalaciones en PowerShell:

   ```powershell
   git --version
   node --version
   npm --version
   ```

3. Elegí una carpeta para el proyecto y ejecutá:

   ```powershell
   New-Item -ItemType Directory -Force -Path "$HOME\Documents" | Out-Null
   Set-Location "$HOME\Documents"
   git clone https://github.com/tablerocontable-paris/TABLERO-CONTABLE.git
   Set-Location .\TABLERO-CONTABLE
   npm ci
   npm run hooks:install
   npm run dev -- --host 127.0.0.1
   ```

4. Abrí <http://127.0.0.1:5173>. Para continuar con Codex, abrí la carpeta
   `TABLERO-CONTABLE` en Codex. Si GitHub pide autenticación, usá la ventana
   de Git Credential Manager; no pegues contraseñas ni tokens en Codex.

## Si ya tenés un clon

Primero comprobá que no haya cambios locales que quieras conservar. En la
carpeta del repositorio:

```powershell
git status --short --branch
git switch main
git pull --ff-only origin main
npm ci
```

No trabajes en dos computadoras a la vez. Antes de cambiar de PC, publicá los
cambios acordados en `main`; en la otra PC, traé el último `main` con el comando
anterior.

## Datos del laboratorio

GitHub sincroniza código, documentación y pruebas; no sincroniza IndexedDB,
sesiones ni los datos del navegador. Si necesitás conservar los datos ficticios
del laboratorio, exportá el respaldo desde la interfaz y trasladalo por separado
en un medio privado. El respaldo local no está cifrado. No incluyas datos de
clientes, notas personales, archivos reales, credenciales o sesiones en GitHub
ni en el respaldo.

## Estado funcional y próximos límites

- El catálogo contiene 55 tareas canónicas y siete unidades de negocio. Hay 25
  tareas comparables y 30 provisionales; no se deben homologar por intuición.
- El onboarding del laboratorio permite elegir unidades y tareas canónicas,
  pero todavía no limita cada tarea a una matriz unidad–tarea confirmada. Es un
  relevamiento ficticio, no la configuración operativa final. No completar esa
  matriz desde capturas o siglas ambiguas.
- Se puede agregar la misma tarea canónica más de una vez dentro de una unidad
  para identificar cuentas u otras combinaciones distintas; por ejemplo, dos
  cuentas bancarias. Cada selección conserva parámetros separados.
- Este recorrido se comprobó en Edge y quedó en `tests/browser.cjs`; no produjo
  errores JavaScript ni llamadas a `/api`.
- La ficha para homologar esas 30 tareas está en
  `docs/product/BUSINESS-UNIT-TASK-NORMALIZATION-QUESTIONNAIRE-20261029.md`;
  reúne preguntas y campos de evidencia sin fijar respuestas por inferencia.
- La conciliación distingue Banco Francés y Banco Nación. En carga de facturas
  de repuestos, sucursales 3 y 81 son opciones observadas; otras quedan
  pendientes de homologación.
- La UI interna todavía necesita aceptación manual con sesión autorizada. El
  clon y la ejecución local deben comprobarse en esta PC personal.
- Antes de activar usuarios reales, completar la revisión de esquemas Data API
  y la matriz de permisos con identidades Auth de Supabase DEV. Mantener Auth
  operativo, `/api` y producción desactivados hasta esa aceptación.
- La consulta de permisos y sus límites están documentados en
  `docs/architecture/SUPABASE-DEV-READONLY-ACCESS-AUDIT-20261029.md`.

Para continuar el desarrollo, pedile a Codex que lea `AGENTS.md`,
`docs/PROJECT-STATUS.md`, `docs/EXECUTION-NEXT.md` y esta guía, y que verifique
`git status` antes de editar. Continuá el mismo repositorio y el mismo Site;
no crees otros.
