# Continuar el proyecto desde tu PC personal

**Corte actual 29/10/2026:** el commit `ccc5785a156617fecb79ed0a42055f4b65afaa6d` está en GitHub `main`, sin Pull Request, y valida campos requeridos del catálogo durante el onboarding. Pasaron 888/888 pruebas en 88 archivos, TypeScript, builds cliente y Worker, Playwright/Edge y benchmark 30/30 (p95 644,84 ms); Actions #163 pasó tests, build y paquete Sites para el commit documental `f8b37c2`. Supabase DEV está activo y confirma 18 migraciones 001–016; el reintento fallido de baseline se detuvo sin escribir. SQL016 corrige el defecto de membresía revocada de SQL011. El mismo Site privado está en v108, owner-only. La UI interior con sesión autorizada y la PC personal todavía no se aceptaron. Esto no acredita certeza del 100%.

En la PC personal, iniciar sesión en GitHub con la cuenta que tiene acceso y
actualizar el clon con `git pull --ff-only origin main`. Después seguir los
pasos de preparación de entorno de esta guía; no usar ZIP como copia de trabajo.

**Actualización 29/10/2026:** se implementó y desplegó como Site privado v106
la reclasificación
explícita de propuestas históricas al reenviarlas a jefatura, conservando las
revisiones antiguas. Pasaron 884/884 pruebas, TypeScript, builds cliente/Worker,
paquete Sites y Playwright en Edge. Commit `dd2b8a1` está en GitHub `main`, sin
Pull Request; Actions #156 pasó. El despliegue mantiene audiencia privada y
propietario único.

**Corte anterior, actualizado el 29/10/2026:** V6 estaba en GitHub `main` y desplegado como Site
privado v105 en el mismo proyecto. GitHub Actions #153 pasó para el SHA
`05e3e52a8088779668baba1af0ea3324060885d4`. En la PC de trabajo pasaron
880/880 pruebas, TypeScript, build cliente, Worker y paquete Sites usando
ejecutables locales de Node (npm no está instalado aquí). El Site conserva
acceso sólo al propietario y cero visitantes externos. Sin iniciar sesión sólo
se verificó la puerta de acceso, no la interfaz interna. La guía ya sirve para
clonar o actualizar la PC personal; ese clon todavía debe probarse allí.

Actualizado el 29/10/2026. Esta guía reemplaza instrucciones anteriores de
traslado del proyecto.

## Fuente de código

- Repositorio privado de GitHub: [`tablerocontable-paris/TABLERO-CONTABLE`](https://github.com/tablerocontable-paris/TABLERO-CONTABLE)
- Corte anterior en GitHub: la protección para no activar propuestas con
  clasificación antigua/incompleta pasó localmente **877/877 pruebas**,
  otras 35/35 pruebas focales en los archivos afectados, hook automático
  229/229, TypeScript, build cliente/Worker y paquete Sites. Código `5bcf11a`;
  guía actualizada en `77bbae7`. Actions #146 aprobó suite, build y paquete
  Sites para ese HEAD.
- Catálogo V6: “Conciliación Banco Francés”, “Conciliación Banco Nación” y
  `CONC BANC FRANC` conducen al mismo código de tarea. Banco Francés y Banco
  Nación son opciones controladas; otros bancos quedan pendientes de
  homologación y sin comparación. La lista es parcial, basada en evidencia del
  repositorio.
- Rama activa: `main`; incluye catálogo V6, normalización del alta puntual y
  protecciones del onboarding/propuestas. Para
  actualizar una copia existente, ejecutá `git pull --ff-only origin main`.
  GitHub Actions #150 pasó suite, build y paquete Sites para el corte funcional
  `54e8b4d`.
  El Site privado está en v105, en el mismo proyecto y con audiencia privada.
  Consultá `docs/PROJECT-STATUS.md` y `docs/EXECUTION-NEXT.md` para el estado
  actualizado. El despliegue no activa Auth operativo, `/api` ni Supabase de
  producción.
- Los commits `66b4d4a` y `77bbae7` son cortes documentales anteriores. El
  estado actual está en `a0dd803` (incluye el registro de publicación v105).
  El estado inicial de la PC de trabajo conserva
  un único scratch local protegido sin versionar; no forma parte del clon ni
  impide continuar desde `main`.
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
- El catálogo v6 ofrece las 55 tareas observadas con nombres canónicos y códigos
  versionados. Veinticinco son comparables; treinta son provisionales y se
  pueden elegir/registrar con código propio, pero no se comparan entre unidades
  hasta confirmar su alcance. “Carga de otras facturas” exige indicar el
  subtipo. Los alias ayudan a encontrar la tarea, pero no crean nombres nuevos.
- Conciliación bancaria usa un nombre común; `CONC BANC FRANC` es un alias de
  búsqueda que conduce a esa tarea canónica. Banco, cuenta y unidad se guardan
  como campos separados. Los registros históricos sin código no se clasifican
  automáticamente.
- El catálogo v5 pasó TypeScript, suite completa (870/870 en 87 archivos),
  build del cliente y Worker y empaquetado Sites. El commit `d1fc8a9` además
  exige tareas/unidades canónicas en altas puntuales del laboratorio; el corte
  publicado `5d309c8` pasó 871/871 pruebas, TypeScript, build cliente/Worker,
  paquete Sites y hook 223/223. La revisión local posterior añadió controles
  al onboarding y propuestas con historial de clasificación mezclada: suite
  873/873, rutas relevantes seriales 92/92, TypeScript, builds y paquete Sites
  aprobados. El corte está publicado directamente en `main` como
  `d37792b8a1b9fd29697ecaed726ecaeaae003cc0`; Actions #142 sigue ejecutándose.
  `gh` no está instalado en la PC del trabajo, pero se consultó Actions por el
  conector de GitHub.
  La paridad entre
  el catálogo y la documentación pasa 55/55. GitHub confirmó el push directo a
  `main`, sin PR; GitHub Actions #135 pasó para el commit funcional. El mismo Site privado
  publica v5 como versión 104. GitHub y Sites son repositorios separados: los
  pushes a GitHub no despliegan el Site automáticamente.
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
