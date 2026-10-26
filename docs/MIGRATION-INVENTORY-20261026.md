# Inventario de continuidad y estimación inicial — 26/10/2026

## Estado de continuidad actualizado — 26/10/2026

El proyecto continúa en `tablerocontable-paris/TABLERO-CONTABLE`, rama `main`.
El commit de producto `13132ec5df85856eae378ff8d05efa9397d7c398` pasó CI 97;
el commit documental de continuidad `f62ee502bfd2270fe9d8784dfccb8bfec3bd2d1c`
está publicado y su CI 98 ejecutaba la suite al momento de este corte. La
preferencia de usar subagentes cuando aporten valor, normalmente uno por vez,
quedó en `AGENTS.md`.

El mismo Site sigue activo en v98, personalizado sólo para la cuenta propietaria.
Supabase DEV tiene 16 migraciones aplicadas (001–014); las 015 y 016 están
aceptadas para DEV, pero no aplicadas. Ejecutar `apply_015`, verificar historial
de 17 y luego `apply_016` desde `Supabase DEV migrations` en GitHub Actions.
No pegar SQL ni ejecutar este flujo contra producción.

El catálogo neutral contiene 26 conceptos propuestos, opcionales y editables.
La captura permite contar 14 nombres visibles y una fila «Sin asignar», pero no
confirmar dotación actual. El seed de 13 perfiles y 73 ocurrencias es ficticio;
no existe evidencia verificable de tareas reales completadas hoy. GitHub guarda
el código, historial y continuidad técnica pertinente, pero no sincroniza
memoria global ni chats brutos de Codex, el estado del navegador ni archivos
locales. Consultar «Qué no se migra a GitHub» antes de transferir datos.

## Corte vigente posterior — 26/10/2026

El mismo Site privado recibió el catálogo neutral v2 como versión **98**,
deployment `appgdep_6adfd2a5c0ac81919f1d8a96c432f46c` (`succeeded`). La URL sigue
siendo `https://grupo-paris-contabilidad.valentino-magni.chatgpt.site`, con
acceso personalizado sólo para la cuenta propietaria y cero visitantes
externos. GitHub `main` `ad1b4180556307755c7a4e0fd221316237fc341c` y el commit de
fuente Sites `b0d09694d901e4d813d6d8fb333eef4af0491ec0` tienen el mismo árbol
versionado. Se conservaron los historiales separados; no se forzó ni reescribió
ninguno. El run `40409657073` terminó en éxito con suite, build y paquete.

El v2 está publicado en el laboratorio, no es onboarding remoto autenticado ni
permite cargar datos reales. Confirmar apertura desde la PC personal con la
cuenta ChatGPT propietaria. No migrar a GitHub secretos, cookies, datos reales,
estado local del navegador ni memoria/chats globales; el repositorio contiene
la continuidad técnica pertinente y segura del proyecto.

La auditoría de RPC detectó una consulta legacy que omite comprobar membresía
activa tras una revocación, si `public` está expuesto. Falta confirmar esquema
`api` únicamente, ACL/propietarios del servidor, resolver el flujo mediante
migración nueva si se mantiene, y ejecutar pruebas de regresión y permisos
negativos antes de conectar datos reales. No se modificó SQL en esta revisión.

## Actualización del corte — 26/10/2026

El catálogo neutral v2 quedó publicado directamente en `main` como commit
`a51bc395dbd2d2ec65ee3f328287c1be8cd3d6b4`, con autor **Tablero Contable** y
sin PR. El SHA remoto coincide. GitHub Actions run `40408104684` pasó instalación,
suite, build y validación del paquete Sites. GPT-6.1 Sol aceptó la revisión
independiente; la validación local cerró **832/832 pruebas en 83 archivos**,
TypeScript, builds cliente/Worker y diff-check.

El mismo Site privado aún está en v97. La consulta de lectura confirma que la
cuenta actual es propietaria y que no hay visitantes externos, pero la emisión
de credencial para su repositorio fuente devuelve `NOT_FOUND`; no se pudo
sincronizar ni publicar v2. El original `.block` permanece sin seguimiento y
sin cambios; la copia fiel está archivada en `docs/architecture/archive/`.

La normalización preliminar y sus límites de conteo están en
`docs/product/TASK-NORMALIZATION-DRAFT-20261026.md`. Las 26 sugerencias son una
línea de partida configurable, no evidencia de que la empresa use esas 26
familias. La captura sólo permite contar 14 nombres visibles; no hay IDs, estado
activo ni cierre fechado. La cantidad de personas actuales y de tareas reales
cumplidas hoy sigue sin determinarse.

## Qué se migra a GitHub

El repositorio privado `tablerocontable-paris/TABLERO-CONTABLE`, rama `main`, es
la fuente de verdad del **código, migraciones, contratos, pruebas, manuales y
decisiones del proyecto**. Al inicio de la reauditoría del 26/10/2026, el
checkout local estaba sincronizado con `origin/main` en
`366c2df92482dafcb66ec3f8d6d5e84f9e4b9aea`. El único
archivo local no versionado observado es
`tests/review/m2-2c-legacy-task-control-replay-races.block`; se conserva intacto
porque el estado de continuidad lo identifica como artefacto de auditoría que
no debe modificarse.

Para trasladar el contexto sin versionar ni alterar ese original, se preparó
una copia exacta en
`docs/architecture/archive/M2-2C-legacy-task-control-replay-races.block.txt`.
La nota
`docs/architecture/archive/M2-2C-LEGACY-TASK-CONTROL-REPLAY-SCRATCH-20261026.md`
registra procedencia, límites y SHA-256
`586D39015E54F1E46BC564845CF4C77734F65DC2BCBEAE9D56C6C32218A46789`. Es un
fragmento experimental no ejecutable ni aceptado, no un test ni evidencia de
funcionamiento.

La documentación funcional y de migración vigente está en `docs/`, en especial:

- `PROJECT-STATUS.md`: estado técnico y cortes de verificación.
- `EXECUTION-NEXT.md`: siguiente puerta de trabajo.
- `MIGRATION.md`: incorporación de usuarios y límites operativos.
- `PRODUCT-ROADMAP.md`: alcance y decisiones funcionales.
- `architecture/REMOTE-MIGRATION-READINESS-20261021.md`: secuencia de servicios.
- `architecture/LABORATORY-BACKUP-CONTRACT-20261007.md`: transporte del estado local.
- `product/TASK-NORMALIZATION-DRAFT-20261026.md`: familias neutrales y límites del conteo visible.
- `architecture/SITE-GITHUB-SOURCE-RECONCILIATION-20261026.md`: igualdad del código fuente entre el Site v97 y `main`.

Se contrastaron 46 bundles locales: sus 39 referencias Git no pertenecían a la
línea del `main` vigente. Se preservaron en el mismo repositorio, sin mezclarlas
con el producto actual, mediante dos ramas de archivo:

- `archive/sites-source-history-20261015` → `f23af935f3897d7bb318f5b72ff1860beefe8dcd`.
- `archive/site-analytics-stash-20261007` → `7a4f9d4614df572f5040b3d702591ca269c68b3b`.

Las 39 referencias de esos bundles son alcanzables desde una de las dos ramas.
Son historia/código de cortes anteriores, no una versión desplegable ni fuente
activa; continuar el trabajo desde `main`. Los ZIP/TAR de transferencia y
paquetes de despliegue son derivados y no hacen falta para reconstruir el
historial Git. La guía de PC está en `outputs/LEEME-PC-PERSONAL.md`. No borrar
paquetes locales sin revisión separada de procedencia y retención.

## Qué no se migra a GitHub

- URI/contraseñas, tokens, claves privadas, cookies o sesiones.
- El estado del navegador `paris-state-lab` ni archivos de IndexedDB. Se mueve
  manualmente con la exportación de laboratorio; el JSON es legible y puede
  incluir nombres, notas, comentarios, movimientos y evidencia. Guardarlo en un
  medio privado y no subirlo a GitHub, aunque el repositorio sea privado.
- Memoria global de Codex, conversaciones completas, adjuntos de chats y datos
  locales de usuario. GitHub no es un mecanismo de respaldo de estas fuentes.
  La continuidad técnica relevante se conserva en `AGENTS.md` y `docs/`.
- Archivos reales de clientes, empleados o del estudio. No se deben importar a
  la demo ni al repositorio.

Para continuar en una PC personal: clonar `main`, instalar dependencias desde
`package-lock.json`, y transferir aparte sólo el respaldo ficticio necesario.
Usar una PC a la vez para editar y hacer push antes de cambiar de equipo. Los
secretos necesarios se cargan como secretos del servicio, nunca en `.env` que
se comparta ni en Git.

## Conteo inicial neutral del laboratorio

La función `seed()` en `src/data/repository.ts` contiene un conjunto ilustrativo
estático. Su conteo actual es:

| Elemento | Cantidad del seed | Alcance |
|---|---:|---|
| Perfiles | 13 | 1 jefatura, 2 encargados, 10 empleados; todos ficticios/de demostración |
| Empresas | 4 | Etiquetas de ejemplo “Empresa 1” a “Empresa 4” |
| Procesos de catálogo | 6 | 3 entregables y 3 operativas, según el campo `kind` del seed |
| Ocurrencias mensuales materializadas | 73 | 6 por cada perfil distinto de jefatura, más 1 duplicado intencional de ejemplo para una persona/empresa |
| Ocurrencias por responsable en el seed | 6 para cada encargado/empleado, con una ocurrencia adicional para un empleado | Es carga de muestra generada al iniciar el laboratorio, no producción real |

El conteo de 73 ocurrencias se obtiene de 12 perfiles con seis asignaciones cada
uno y una copia extra: `12 × 6 + 1 = 73`.

## Snapshot persistido del Site y Supabase DEV — consulta 26/10/2026

Una consulta read-only al D1 del Site existente encontró 49 filas en
`paris_records`: 4 perfiles (2 jefe, 1 encargado y 1 empleado; las 4 filas
marcadas activas), 4 empresas, 6 plantillas, 1 asignación, 1 tarea, 24 eventos
de auditoría, 4 registros de inducción, 1 equipo, 2 pasos de recorrido y 2
versiones del recorrido. La tarea almacenada está `En curso`; el snapshot no
registra una tarea completada. La fila de estado del workspace tiene revisión
24 y `updated_at` 2026-10-06. Esto es el contenido que existe en el Site, no una
prueba de que los perfiles sean empleados reales ni de actividad al 26/10.

Supabase `grupo-paris-dev` tiene las 16 migraciones aplicadas, pero las tablas
consultadas tienen cero filas. No contiene el padrón ni el trabajo del Site.

Por lo tanto, los conteos reproducibles son distintos y deben mantenerse
separados: **13 perfiles/73 ocurrencias** del seed local; **4 perfiles/1 tarea
en curso** en el D1 del Site, con snapshot del 06/10; **0 filas operativas** en
Supabase DEV. No se puede afirmar cuántas personas están trabajando hoy ni
cuántas tareas reales se completaron hoy. No copié filas, nombres, emails,
auditoría ni contenido de tareas a GitHub.

Las cifras del seed **no permiten estimar cuántas personas trabajan hoy ni
cuántas tareas se cumplen por día**. Son datos de arranque repetibles, generados de nuevo
cuando un navegador no tiene estado guardado; además, el seed incluye perfiles y
registros ilustrativos que no son cuentas autenticadas. El sistema no dispone de
un registro productivo conectado desde el que calcular actividad diaria. Para
obtener una estimación real se necesita una exportación aprobada y anonimizada
del sistema fuente, con identificador estable, fecha, estado, responsable y
empresa. Deben deduplicarse reintentos y tareas recurrentes por ocurrencia; no
contar movimientos operativos como tareas completadas.

## Verificación y siguiente paso

- El inventario quedó publicado directamente en `main` como commit
  `d1577470cb2938d8f19adbe0be8f2f3c1c898359`; el conteo read-only se agregó en
  `6656d114b3fb9ff64358edba2e3afd5624e925ec`. Las dos historias históricas se
  preservan en las ramas de archivo indicadas; no se inició una PR.
- El árbol de trabajo conserva el archivo `.block` ya mencionado.
- El repositorio no puede incluir toda la PC ni todo Codex. Este inventario
  delimita explícitamente la continuidad técnica transferible.
- Falta verificar/obtener un respaldo de laboratorio actual desde el navegador
  de origen y, si el objetivo incluye medir la operación real, una exportación
  fuente autorizada. Sin esos insumos no se inventan conteos reales ni se afirma
  migración completa de datos.

## Revalidación de GitHub Actions y Supabase Advisors — 26/10/2026

GitHub Actions run `40373683135`, commit `366c2df92482dafcb66ec3f8d6d5e84f9e4b9aea`,
terminó en verde: `npm ci`, suite completa, build y validación del paquete Sites.
No convierte el conteo del seed ni el snapshot antiguo del Site en cifras reales.

La consulta read-only actual de Supabase reportó 29 tablas con RLS sin policies
(INFO), 39 funciones `SECURITY DEFINER` ejecutables por `authenticated` (WARN),
124 foreign keys sin índice (INFO), 8 policies con `auth_rls_initplan` (WARN) y
12 índices sin uso observado (INFO). No se aplicaron cambios. Debe confirmarse
el esquema expuesto y revisar grants/contratos antes de conectar Auth/UI; la
advertencia de función no demuestra por sí sola una ruta explotable, pero sí
exige completar la revisión. Referencias y límites en
`architecture/SUPABASE-DEV-ADVISORS-20261026.md`.
