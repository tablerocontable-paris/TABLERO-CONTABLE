# Estado vigente — actualización 29/10/2026

## Corte de código — IVA / Gemelo en GitHub `main`

El corte actual agrega validación de parámetros obligatorios al alta de tareas del catálogo: no permite avanzar el onboarding si falta un dato parametrizado (por ejemplo, la cuenta bancaria). No se inventan parámetros ni se cambia la semántica del catálogo. Gemelo sigue siendo una consulta local explicable de datos autorizados, sin notas personales, mutaciones, cronómetros, IA externa, ARCA ni llamadas a `/api`.

El commit `ccc5785a156617fecb79ed0a42055f4b65afaa6d` está en GitHub `main`, sin Pull Request. Para ese árbol pasaron **888/888 pruebas en 88 archivos**, TypeScript, builds de cliente y Worker, Playwright/Edge en escritorio y móvil, y benchmark de navegación caliente **30/30**, p95 **644,84 ms** con 24 perfiles y 2.000 tareas. El hook de commit pasó 235/235. GitHub Actions **#161 sigue en curso** al corte; no se cuenta como aprobado. La suite no demuestra ausencia absoluta de errores ni sustituye la aceptación de la interfaz publicada con sesión autenticada.

El mismo Site `Grupo París · Tablero contable` está publicado como **v108**, desde la fuente `97eb08b28bac48489e24321866b4834051ee5587`; el árbol de esa fuente (`6ecb68ee3e1667f564134c7c18f4ab492c64582e`) coincidía con GitHub `main` al publicar. Sites confirmó versión activa, acceso **privado owner-only**, un usuario permitido y cero visitantes. La UI interior autenticada y el clon en la PC personal todavía requieren aceptación. No se activaron usuarios reales, API operativa ni producción.

No hay certeza del 100% ni garantía de ausencia de errores. Restan aceptación con sesión, uso del clon en PC personal y homologación de tareas provisionales con criterios reales antes de activar Auth/API/Supabase/hosting de producción.

## Corte anterior — v106 (histórico)

## Corte vigente — reclasificación histórica publicada en v106

El titular puede clasificar una propuesta antigua sólo al reenviarla en una
nueva revisión y elegir tarea, unidad y parámetros explícitamente. Se conservan
las revisiones no clasificadas; cualquier historial previo parcialmente
clasificado o contradictorio queda bloqueado y se debe reemplazar por una
propuesta nueva. Revisión independiente sin hallazgo claro. La suite completa
pasó **884/884 pruebas en 87 archivos**; también pasaron TypeScript, builds de
cliente y Worker, empaquetado Sites y recorrido Playwright/Edge ampliado. No se
observaron errores JS ni solicitudes a `/api`. El paquete de validación fue
1.698.130 bytes. Persisten avisos conocidos de bundle principal (>500 kB) y
comentarios de Zod.

Commit `dd2b8a1fa7f45dc502da7befe47044aa851ff62c` está directamente en GitHub
`main` (sin PR); Actions #156 pasó suite, build y paquete. El mismo Site privado
está en v106, desde el merge de fuente
`ed7d08e009fe9d16db10ca1f1cab8806b62d35b0`; continúa con acceso sólo del
propietario y cero visitantes externos. No se validó la UI interna con una
sesión autenticada; la revisión y las pruebas no equivalen a aceptación real ni
a certeza de error cero. El scratch protegido
`tests/review/m2-2c-legacy-task-control-replay-races.block` permanece intacto.

## Despliegue anterior — Site privado v105

El catálogo V6 ya se publicó en el mismo Site existente, versión **105**,
proyecto `appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85`, fuente Sites
`c647ef793cd1f0e36e3e43b0e7102a43a40ce3ab`. La audiencia continúa
personalizada al propietario, con cero visitantes externos. La navegación sin
sesión muestra correctamente la pantalla de inicio de sesión; la UI interna
no quedó validada con sesión autenticada. Despliegue confirmado por Sites con
versión activa y archivo de 62 entradas (4.382.720 bytes).

GitHub `main` estaba en `05e3e52a8088779668baba1af0ea3324060885d4` y Actions
#153 pasó para ese SHA. En esta PC: **880/880 pruebas en 87 archivos**,
TypeScript, build cliente, Worker y empaquetado Sites aprobados. No hay `npm`
instalado; se invocaron directamente las herramientas ya presentes en
`node_modules`. Persisten avisos de bundle cliente mayor a 500 kB y comentarios
de Zod. El código de repositorio y el origen interno de Sites usan historias
Git distintas; la publicación conservó ambas con un merge de dos padres cuyo
árbol coincide exactamente con GitHub `main`.

El Site sigue siendo un laboratorio privado de datos ficticios. Esto no prueba
la operación integrada con usuarios reales, autenticación propia, API ni
Supabase en producción; tampoco establece certeza de error cero.

**El bloque siguiente es historial del corte anterior y sus afirmaciones de
“no desplegado” quedan superadas por v105.**

## Catálogo V6 — corte GitHub anterior al despliegue Sites v105 (histórico)

V6 añade opciones canónicas de banco en conciliación: Banco Francés y Banco
Nación, respaldadas por nombres presentes en las fuentes del repositorio. Las
búsquedas “Conciliación Banco Francés”, “Conciliación Banco Nación” y
`CONC BANC FRANC` llevan al mismo código `gpar_bank_reconciliation`, guardando
el banco separado (`frances` / `nacion`). Otros bancos quedan como “pendiente
de normalizar”, con nombre detallado y fuera de comparación. No se presume que
esas opciones cubran todos los bancos reales.

Propuestas del onboarding, alta puntual, corrección de propuestas y análisis
comparten controles para esta dimensión. Métricas nuevas V6 sin banco o con un
banco pendiente no se comparan; V1–V5 conservan parámetros e indicadores
históricos. Validación local final: suite **880/880 en 87 archivos**, TypeScript,
build cliente, Worker, paquete Sites y recorrido Playwright en Edge aprobados;
el navegador confirmó que onboarding conserva cuatro propuestas distintas
(dos tareas × dos empresas) sin crear tareas/asignaciones antes de aprobación,
además de cierres, cronómetros, aislamiento, temas y móvil. `git diff --check`
aprobado. Implementación publicada directamente en `main` como `cd84168`;
GitHub Actions #150 pasó suite, build y paquete Sites para el corte funcional
`54e8b4d`. Los posteriores commits de continuidad pasaron el hook 230/230.
V6 no se desplegó en Sites, que permanece en v104.

## Guardas para onboarding y activación de propuestas — corte GitHub

La revisión del flujo encontró que las propuestas antiguas sin clasificación
París podían llegar a los controles de aprobación. El laboratorio ahora exige
clasificación canónica completa y consistente entre revisiones antes de
activar una propuesta como trabajo nuevo. El onboarding conserva borradores y
propuestas históricas, pero no los materializa si no tienen selección París;
el historial puede quitarse explícitamente sin borrar otros datos. No se
reclasifican títulos antiguos por inferencia. Las propuestas antiguas sin
clasificación quedan bloqueadas y todavía no tienen un formulario de
reclasificación; se puede crear una propuesta nueva desde el catálogo y
preservar el registro anterior.

Validación local: suite completa **877/877 pruebas en 87 archivos**; las
pruebas focales posteriores al último ajuste pasaron **35/35** en los tres
archivos afectados, y el hook
automático de commit **229/229**. TypeScript, build cliente, Worker, paquete
Sites y `git diff --check` aprobaron. La build de cliente deja los avisos
conocidos del bundle principal (>500 kB) y comentarios de Zod. Commit funcional
`5bcf11a` ya está publicado directamente en `main`, sin PR; Actions #146
aprobó el HEAD `77bbae7`. Ya se puede actualizar la PC personal con
`git pull --ff-only origin main`. Site privado v104 sin cambios; no afecta
`/api`, Auth ni SQL001–016.

### Historial previo del catálogo y comparabilidad pendiente

En V5, “Conciliación Banco Francés” y `CONC BANC FRANC` son formas de buscar
la tarea canónica “Conciliación bancaria”; banco y cuenta quedan en parámetros
obligatorios. Esto evita crear identidades de tarea distintas por abreviatura.
Sin embargo, el campo banco y los demás parámetros se ingresan como texto
libre. Para comparar bancos sin dividir métricas por diferencias de escritura,
el siguiente paso es acordar opciones de banco basadas en el listado real y
versionarlas; no debe inferirse una lista completa de las capturas actuales.
Las 30 tareas aún no elegibles para comparación entre unidades siguen
registrables; su homologación analítica requiere revisar alcance y parámetros.
La auditoría identificó tres candidatas documentales para analizar luego de
normalizar dimensiones: carga de facturas de vehículos nuevos, análisis de
costo de créditos y operaciones MO4. Las otras 27 necesitan definiciones de
alcance, siglas o solapamientos. El desglose está en
`docs/product/BUSINESS-UNIT-TASK-CATALOG-DRAFT-20261028.md`; todavía no se
habilitan comparaciones nuevas.

## Alta de tareas puntuales normalizada — 28/10/2026

En el laboratorio, “Nueva tarea” ya no admite títulos libres ni tareas sin
clasificación: exige elegir una de las 55 tareas canónicas y una de las siete
unidades de negocio. Guarda código y versión V5; pide sólo los parámetros que
el catálogo marca obligatorios y conserva los demás como opcionales. El nombre
de tarjeta proviene del catálogo. Las conversiones de pedidos y anotaciones
mantienen el contexto y vínculo de origen; el formulario operativo fuera del
laboratorio no cambia. Las asignaciones puntuales existentes e históricas no se
reclasifican.

Validación local: suite **873/873 en 87 archivos**, TypeScript, build
cliente/Worker y paquete Sites aprobados; las rutas tocadas pasaron **92/92**.
El cambio se publicó directamente en GitHub `main` como
`d37792b8a1b9fd29697ecaed726ecaeaae003cc0`, autor **Tablero Contable**, sin
Pull Request. Actions #142 está **en ejecución** (consultado 28/10/2026); el
run previo #141 pasó. El build conserva avisos de Zod y chunk principal de
~659 kB. El Site sigue en v104; no se desplegó. No modifica `/api`, Auth ni
SQL001–016.

El apunte de continuidad para la PC personal se publicó en
`4ae9416ddf83e89d01a8fcb273dea3fa278b1bd0`; Actions #143 está pendiente. El
archivo no versionado `tests/review/m2-2c-legacy-task-control-replay-races.block`
permanece intacto y fuera de Git, según la protección del proyecto.

La auditoría de rutas confirma que Nueva tarea y las conversiones de pedidos y
anotaciones usan el catálogo canónico. Las propuestas puramente neutrales
continúan con su flujo de revisión; las que tienen metadatos París incompletos
o historial París/no clasificado no pueden activarse como trabajo nuevo hasta
resolver la clasificación. Los borradores anteriores se conservan, no se
renombran ni se reclasifican. La presentación del formulario deriva tipo,
checklist y unidad del catálogo. Este corte ya está publicado en GitHub; la
versión publicada del Site permanece v104 y no incluye estas protecciones.

## Catálogo Grupo París — normalización inicial

La inducción local del laboratorio ofrece las siete unidades solicitadas y 55 tareas con código y nombre canónicos. V6 conserva las 55 opciones; 25 son comparables y 30 siguen provisionales. V5 dejó fuera de comparaciones a `supplier_invoice_load` mientras se confirma el alcance de portales y habilitó `customer_collections`, que estaba marcada Confirmada en el contrato. Unidad, banco, cuenta, sucursal y período son dimensiones separadas. V6 normaliza los bancos Francés y Nación para conciliación; V1–V5 siguen disponibles para historial y los registros sin código no se reclasifican.

V4 agregó el alias de búsqueda `CONC BANC FRANC` para la tarea canónica Conciliación bancaria; V5 lo conserva. La selección guarda código y nombre canónicos. V5 está publicado en el Site de laboratorio, versión 104, desde la fuente Sites `2a965026c40cad97a108f2e78dadd5f3c55edb37`. Validación local del corte funcional: suite completa 870/870 en 87 archivos, TypeScript, build cliente, Worker y paquete Sites; GitHub Actions #135 para `f5263f1` terminó en éxito. En una auditoría posterior se alinearon cuatro nombres del borrador con las etiquetas canónicas del selector; la prueba ahora exige paridad de los 55 códigos, nombres y criterios de comparación. El build conserva avisos de comentarios de Zod y un chunk principal de aproximadamente 656 kB.

El laboratorio usa perfiles y datos ficticios. GitHub `main` contiene V5 en `f5263f1`; el Site v104 también contiene V5 y conserva acceso owner-only con cero visitantes externos. No se habilitaron usuarios reales ni `/api` operativo; Supabase Auth y SQL001–016 no se modificaron. No se necesitan exportaciones de personal para normalizar nombres de tareas y unidades.

## Continuidad a PC personal

La guía ejecutable está en `outputs/LEEME-PC-PERSONAL.md`; el detalle de estado portable, en `docs/PORTABLE-CONTINUITY-20261027.md`. El repo es privado `tablerocontable-paris/TABLERO-CONTABLE`, rama `main`. Clonar `main`; no usar ZIPs antiguos. El estado del navegador, IndexedDB y la base D1 de Sites no viajan con GitHub; respaldos del laboratorio se exportan por separado y se guardan fuera del repo.
## Corte anterior verificado 27/10/2026

## Clasificación neutral local — publicada y desplegada

Quedó implementado el enlace determinista de los 26 conceptos v2 con el
estimador local. El código estable y su versión se conservan en propuestas,
revisiones, catálogo, asignaciones y tareas generadas; los datos históricos
quedan sin clasificar cuando no existe evidencia. Se comprueban correspondencias
entre sugerencia, catálogo, asignación y tarea. La capa remota y SQL001–016 no
se modifican. Validación local: suite **845/845 en 85 archivos**, TypeScript,
build cliente, build Worker y paquete Sites aprobados; pre-commit **214/214**.
GitHub commit `9b54a4625f56e07fedbfba82d68696204f9a0e5d`, autor **Tablero
Contable**, directo a `main`, sin PR; Actions #117 (`40555801302`) aprobó
instalación, suite, build y paquete Sites. La continuidad documental se publicó
en `e9fae71f3c1fda7414f0ad103c99f60275670c76`; Actions #119
(`40558575748`) pasó instalación, suite, build y paquete Sites.
El mismo Site quedó actualizado a
v99, deployment `appgdep_6ae0e7e339d4819180adeda021e82d7a`, desde su fuente
`a80e3013d00165f1bc0abd64a580545a4322e49b`; acceso personalizado conservado,
un usuario autorizado, cero visitantes externos. El build cliente mantiene el
aviso de chunk principal superior a 500 kB. Ver
`docs/architecture/AUTHENTICATED-NEUTRAL-FIRST-LOGIN-CONTRACT-DRAFT-20261027.md`.

## Revisión de onboarding neutral — 27/10/2026

Una revisión independiente comparó los 26 conceptos neutrales v2 con el
borrador funcional: cobertura completa del borrador, sin afirmar cobertura del
trabajo real. Se mantienen separadas cobranzas, aplicación de cobros,
liquidaciones de tarjetas y conciliaciones para evitar dobles conteos. La
inducción v2 continúa sólo en el laboratorio local; no existe aún onboarding
del primer ingreso autenticado. El backend de DEV sí contiene comandos
revisionados de borrador, envío, cambios y aprobación; el frontend no está
conectado a ellos y el payload remoto no conserva el código/versión del
concepto neutral. Las propuestas personalizadas remotas sólo permiten
frecuencia única. El contrato borrador y el flujo por rol están en
`docs/architecture/AUTHENTICATED-NEUTRAL-FIRST-LOGIN-CONTRACT-DRAFT-20261027.md`.
GPT-6.1 Sol aceptó sus decisiones de arquitectura sólo para el SHA-256
`E65E1B467525B8AE4769E2F10EB33E238043078ED9D1E635468D0ADBD7C93D68`. La
aceptación no cubre implementación ni migración. No habilita Auth ni modifica
SQL001–016. En esta PC hay Node 24, pero no npm ni Supabase CLI; no se creó ni
aplicó la migración 017. Revisión de catálogo en
`docs/product/TASK-NORMALIZATION-DRAFT-20261026.md`.

## Continuidad y estimador — última actualización

El estimador se publicó directamente en `main` como
`daee754b9b688931e0779e271245acd6bd695526`; su enlace con la taxonomía v2 se
publicó como `9b54a4625f56e07fedbfba82d68696204f9a0e5d`. Actions #117
validó ese corte de código; Actions #119 (`40558575748`) validó la última
continuidad documental publicada (`e9fae71`). Los conteos locales 845/845 y
214/214 corresponden al corte de código 9b54a46. El build cliente conserva un
aviso de chunk principal superior a 500 kB.

El estimador es local, con vocabulario neutral cerrado y entradas/salidas
ignoradas por Git. No se recibió un extracto real autorizado: dotación actual y
tareas completadas hoy siguen sin determinarse. La continuidad portable segura
está en `docs/PORTABLE-CONTINUITY-20261027.md`; conversaciones brutas, datos
identificables, credenciales, sesiones y memoria global no se copian al repo.
El CI del repositorio no publica Sites; v99 se desplegó por separado.

## Resultado verificado de migraciones

El repositorio activo es `work/site`, remoto privado
`tablerocontable-paris/TABLERO-CONTABLE`, rama `main`. El corte de código
`31b49631d6a23b6f8d56e928e2a95ed57a2f1224`, autor **Tablero Contable**, está
publicado directamente en `main`. GitHub Actions run `40533524080` (#105)
terminó en éxito con instalación, suite, build y paquete Sites. La actualización
documental de auditoría se publicó como
`a3a370f9f139f31df48bdc8f3f33796b8cce52d7`, bajo el mismo autor; run
`40534554189` (#106) también pasó suite, build y validación Sites. Estos runs
no despliegan el Site ni producción.

El proyecto `grupo-paris-dev` (`kynqjfhqujnjojcmurwf`) registra las 18
versiones correspondientes a los archivos 001–016. GitHub Actions confirma la
secuencia: run `40012156985` aplicó y verificó la línea base 001–014; run
`40522413076` aplicó 015; run `40522611976` aplicó 016. Los tres terminaron en
éxito con el control de hashes, preflight, historial antes/después y dry-run.
La comparación read-only de hoy confirma que el hash MD5 de los cuerpos
instalados de `api_workspace_page`, `api_workspace_page_v2`, `api.query_v1` y
`read_coordinated_task_for_manager` coincide con 015/016 del repositorio; la
aplicación además validó el SHA-256 del archivo SQL completo.

El run `40522765334` (#4) falló porque se seleccionó `baseline_001_014` cuando
el remoto ya tenía 18 versiones: esperaba 16 locales/0 remotas y detectó
16/18. El guard detuvo la ejecución antes del dry-run y del `db push`; ese
intento no escribió en Supabase. No volver a ejecutar la línea base.

El cotejo posterior del catálogo remoto contra un replay de los 18 archivos
versionados encontró coincidencia en 57 relaciones, 445 columnas, 28 políticas,
159 funciones/procedimientos, 360 restricciones declaradas, 116 índices, 42
triggers y los privilegios comparados. Por eso, la afirmación de que el esquema
instalado de 001–014 difiere de los archivos no está confirmada; el run #4 fue
un reintento equivocado, sin escrituras. El run #1 aplicó la línea base. Esto no
borra el defecto semántico de SQL011: SQL016 lo corrigió y está instalado. La
metodología, huellas y límites quedan en
`docs/architecture/SUPABASE-DEV-SCHEMA-CATALOG-COMPARE-20261027.md`.

No reejecutar ni editar 001–014. El workflow de migraciones sigue sólo en
lectura. La paridad del catálogo no prueba permisos con identidades Auth reales,
configuración de esquemas expuestos del Dashboard ni aceptación de producción.
Auth y el área operativa continúan apagados.

## Auditoría read-only del esquema instalado

La consulta read-only del catálogo remoto del 27/10 encontró 37 tablas en
`public` y 20 en `app_private`, todas con RLS. Hay 28 policies públicas y
ninguna en tablas privadas. `anon` no tiene SELECT; `authenticated` tiene
SELECT en 28 tablas públicas, sujeto a sus policies. Ninguno de esos roles tiene
DML directo. `app_private` no concede USAGE a esos roles. `api` concede USAGE a
`authenticated`, no a `anon`; `public` concede USAGE a ambos. Los advisors siguen
marcando 29 tablas con RLS sin policy (20 privadas y 9 públicas), aviso INFO
compatible con denegación por defecto, pero requiere revisar las nueve tablas
públicas individualmente.

Las nueve tablas públicas sin policies son `private_block_note_receipts`,
`task_coverage_bindings`, `task_coverage_plan_assignment_rules`,
`task_coverage_plan_instances`, `task_coverage_plans`,
`task_mutation_receipts`, `task_responsibility_heads`,
`task_responsibility_members` y `task_responsibility_sets`. El catálogo confirma
que `anon` y `authenticated` no tienen SELECT directo sobre ellas.

La configuración de esquemas expuestos de Data API no está confirmada en esta
revisión: la página del Dashboard no entregó su contenido legible a la sesión.
El catálogo muestra que `public` concede USAGE a `anon` y
`authenticated`; antes de usar Auth, datos reales o frontend conectado se debe
verificar en Dashboard que Data API exponga sólo `api`, mantener apagada la
autoexposición y completar la matriz de permisos. El área operativa sigue
apagada y no hay datos reales.

La lectura del catálogo contó 142 funciones `SECURITY DEFINER` en `public`,
`api` y `app_private`; las 142 pertenecen a `postgres` y tienen `search_path`
vacío. De ellas, 39 RPC de `public` y 3 RPC de `api` permiten `EXECUTE` a
`authenticated`; ninguna función `SECURITY DEFINER` da acceso a `anon` o a
`PUBLIC`. Las funciones internas de `app_private` no son ejecutables por esos
roles. Se detectaron además dos funciones públicas no-`SECURITY DEFINER` de
retorno `trigger` con `EXECUTE` heredado de `PUBLIC` (`normalize_assignment_schedule`,
`reject_template_version_change`); no son llamadas RPC ordinarias, pero queda
como hardening de defensa en profundidad revisar/revocar ese ACL en migración.

La configuración de esquemas expuestos por Data API no se pudo confirmar desde
el Dashboard. La matriz local no reemplaza pruebas contra sesiones Auth reales.
Ambas comprobaciones siguen siendo gates obligatorios antes de conectar
usuarios o datos reales.

El workflow manual ahora ofrece `verify_current` sin escrituras como opción
predeterminada. Próximo gate: revisión individual de ACL/RPC y tablas públicas,
confirmación del Dashboard y pruebas positivas/negativas con identidades de
DEV. No se requiere re-aplicar 001–016.

---

# Estado histórico — migración de workspace, 26/10/2026

## Actualización de seguridad Supabase — migraciones 015/016

El proyecto `grupo-paris-dev` está activo y la consulta vigente confirma que
mantiene 16 migraciones aplicadas (001–014). SQL015 ya tiene aceptación Sol
registrada; SQL016 también fue aceptada para DEV con SHA-256
`F7E76313AD4132626034C5C9D38F1C70AFB140BB3E2CE3615FE89071945ED8F3`.
La corrección local cierra la lectura legacy de encargado después de revocar
una membresía. Sus pruebas focales independientes pasaron 10/10; aún no se
ejecutaron contra el catálogo remoto ni se aplicó SQL016.

SQL016 y su evidencia ya están publicados en `main`. Orden vigente: ejecutar
el workflow `apply_015` contra el historial actual; confirmar éxito y las 17
versiones; luego ejecutar `apply_016` con preflight de esas 17 versiones y
dry-run exclusivo de 016. No aplicar SQL manualmente. Para datos reales sigue pendiente verificar en
Dashboard que Data API exponga únicamente `api`, contrastar catálogo/ACL y
completar las pruebas de permisos. La revisión Sol no equivale a aceptación de
DEV ni de producción.

## Registro histórico — publicación del 26/10/2026, v98

El catálogo neutral v2 está actualizado en el mismo Site privado, versión **98**,
deployment `appgdep_6adfd2a5c0ac81919f1d8a96c432f46c`, estado `succeeded`:
`https://grupo-paris-contabilidad.valentino-magni.chatgpt.site`. La audiencia
sigue personalizada y owner-only para `valentino.ialocal@gmail.com`, sin
visitantes externos. El paquete se construyó desde el árbol exacto de GitHub
`main` en `ad1b4180556307755c7a4e0fd221316237fc341c`; el SHA de fuente propio de
Sites es `b0d09694d901e4d813d6d8fb333eef4af0491ec0`. Los historiales Git siguen
separados, sin force push ni mezcla de autores antiguos. El repo GitHub sigue
siendo la fuente de verdad; para futuras publicaciones hay que repetir la
sincronización de árbol validado en el checkout Sites.

GitHub Actions run `40409657073` pasó `npm ci`, suite, build y validación del
paquete. El build local del checkout Sites también pasó. La suite local que se
inició allí se interrumpió durante su ejecución y no se cuenta como validación;
el resultado completo es el de GitHub Actions y la corrida previa 832/832 del
mismo árbol. La apertura en la PC personal aún necesita confirmación visual con
la cuenta propietaria. El despliegue es del laboratorio, no autoriza datos reales
ni activa producción.

La revisión estática de Supabase 001–014 encontró una ruta legacy de encargado
que omitía el estado activo de la membresía. SQL016 corrige esa función y tiene
aceptación Sol para DEV bajo preflight, pero todavía no está aplicada. El
hallazgo y el plan de pruebas permanecen en
`architecture/SUPABASE-DEV-RPC-REVIEW-20261026.md`; evidencia y límites de 016
en `architecture/REMOTE-WORKSPACE-016-CODE-SOL-ACCEPTANCE-20261026.md`.

## Publicación y acceso confirmados — 26/10/2026

El parche de dependencias de producción quedó publicado directamente en `main`
como commit `fb5b5d4751e841460d104479b22ebbe31ac9e1c7`. `npm audit --omit=dev`
reportó cero vulnerabilidades de producción. GitHub Actions run `40383506637`
pasó instalación, suite completa, build y empaquetado Sites. La suite local del
pre-commit aprobó 198/198 casos. La auditoría completa conserva 7 avisos sólo
de desarrollo (5 moderados, 2 críticos) que requieren una actualización mayor
de Vitest separada; no se forzó ese cambio.

El mismo Site privado se publicó como **v97**, deployment
`appgdep_6adfa65a1ed081918f5fc8fd05bb72a9`, estado `succeeded`, desde el commit
de fuente Sites `2d1c2f4916a633624ed5b8afa10708cad246547b`. URL:
`https://grupo-paris-contabilidad.valentino-magni.chatgpt.site`. El acceso sigue
en modo personalizado, sólo para la cuenta propietaria
`valentino.ialocal@gmail.com`, sin visitantes externos. La solicitud de abrirlo
en el panel quedó en cola; no se confirmó aceptación visual en el navegador del
usuario. En la PC personal debe abrirlo con la misma cuenta de ChatGPT; la
conexión de GitHub no concede acceso al Site.

La publicación del Site de laboratorio está confirmada, pero no equivale a
despliegue operativo: perfiles y datos siguen siendo ficticios. Permanecen como
gates la aceptación desde la PC personal, confirmar que Supabase Data API exponga
sólo `api`, auditar los 39 RPC `SECURITY DEFINER` y completar identidad/permisos,
escrituras, Storage/evidencia, Cloudflare/correo y aceptación antes de habilitar
producción. No hay certeza del 100% ni se activa el espacio operativo.

## Catálogo neutral v2 y revisión de primer ingreso — 26/10/2026

El laboratorio incorpora 26 sugerencias neutrales y opcionales
`starter-suggestion-v2-*`, manteniendo intactos los seis IDs y flujos legacy
`starter-v1-*`. Las sugerencias se pueden buscar, filtrar, desplegar y editar;
terminar la inducción sólo deja propuestas pendientes de jefatura, sin crear
tareas, cuotas, pesos ni vencimientos. La inducción remota autenticada sigue sin
implementarse.

La revisión independiente corrigió los casos de empresas retiradas, reglas
latentes, propuestas incompletas de jefatura, validación de trabajos puntuales,
cambio de perfil durante la inducción y formularios opcionales abandonados. La
validación y la materialización ahora usan el mismo conjunto efectivo; los
borradores fuera de alcance se conservan sin bloquear el envío. La suite local
cerró **832/832 pruebas en 83 archivos**; TypeScript, build cliente, build
Worker y `git diff --check` terminaron con código 0. Se mantienen avisos
informativos por anotaciones de Zod, tamaño de bundle cliente (620,87 KB) y
normalización LF/CRLF. Esta evidencia valida el árbol local, no producción.
El corte quedó publicado directamente en el repositorio privado correcto,
`tablerocontable-paris/TABLERO-CONTABLE`, rama `main`, commit
`a51bc395dbd2d2ec65ee3f328287c1be8cd3d6b4`, autor **Tablero Contable**, sin
pull request. GitHub Actions run `40408104684` pasó instalación, suite, build y
validación del paquete Sites. El Site sigue en v97; la consulta de lectura
confirma propietario y acceso personalizado sin visitantes externos, pero la
emisión de credencial para sincronizar su fuente devuelve `NOT_FOUND`. No se
creó otra versión ni se cambió la audiencia; el v2 aún no está publicado en el
Site.

## Catálogo neutral de inicio — implementación local revisada, 26/10/2026

El alta del laboratorio ofrece seis procesos iniciales neutrales, versionados
como `starter-v1-*`, todos opcionales y sin selección automática. No cambia el
seed ni el catálogo común. Al seleccionarlos se materializan asignaciones
independientes sin `templateId`; las operativas conservan cantidad sin cuota y
sin peso supuesto. Las asignaciones llevan un `starterId` versionado explícito,
que permite reprogramar recurrencias sin promover el concepto al catálogo
común. La opción sólo aparece en el alta local del laboratorio, nunca en
onboarding remoto. Se preservan borradores y selección al repetir una invitación
simulada.

Validación: suite completa 817/817 en 83 archivos; TypeScript, cliente Vite y
Worker aprobaron localmente. GitHub Actions run `40379419640` pasó instalación,
suite, build y empaquetado para el commit `247b3c8702d196d9eb9c3a352473f59edb282433`
en `main`. El mismo Site privado quedó actualizado en versión 96; deployment
`appgdep_6adfa090f2488191bfacd1446b3594f2` terminó `succeeded` desde su historial
de fuente, commit `38620dffce02190cad2b67c9b946c8f44f0d029d`. No cambió la
audiencia owner-only. La apertura desde la cuenta propietaria/PC personal aún
requiere aceptación visible. Vite mantiene el aviso conocido de un bundle
principal mayor a 500 kB. Este cambio no crea onboarding autenticado ni activa
el espacio operativo.

## Revalidación del corte — 26/10/2026

GitHub Actions run `40373683135` validó el commit `366c2df92482dafcb66ec3f8d6d5e84f9e4b9aea`: `npm ci`, suite completa, build y empaquetado Sites terminaron correctamente. El checkout `main` local coincide con `origin/main`; se conserva sin modificar el scratch `.block` indicado por `AGENTS.md`. Esta actualización documental aún requiere su propio control de CI.

El Site privado existente está activo en versión 95 y su último despliegue (`appgdep_6adb8ba50788819197d78ab295aeb120`) figura `succeeded`. La audiencia sigue en modo `custom`, con acceso sólo de la cuenta propietaria y cero visitantes externos. Esto explica que el enlace no abra desde otra cuenta; no acredita aceptación en navegador de la cuenta propietaria.

La consulta directa de Supabase Advisors el 26/10 detectó: seguridad INFO, 29 tablas con RLS sin policy; seguridad WARN, 39 funciones `SECURITY DEFINER` ejecutables por `authenticated`; rendimiento INFO, 124 claves foráneas sin índice; rendimiento WARN, 8 policies con reevaluación por fila; INFO, 12 índices no usados. No se cambiaron grants, policies ni exposición. Las tablas sin policies pueden ser intencionales y fallar cerradas; las funciones ejecutables requieren revisar esquema expuesto, grants y controles internos. No conectar Auth/UI ni usuarios hasta cerrar la matriz de permisos.

Detalle y enlaces de remediación: `architecture/SUPABASE-DEV-ADVISORS-20261026.md`. El valor del ajuste de autoexposición está documentado como apagado, pero falta confirmar en Dashboard que **Exposed schemas** incluya únicamente `api`; los documentos históricos que dicen `public, extensions` más autoexposición activa describen un corte anterior.

## Inventario para continuidad entre computadoras — 26/10/2026

El corte documentado en `MIGRATION-INVENTORY-20261026.md` conserva qué se
transfiere por GitHub y qué debe quedar fuera por ser credencial, memoria/chats
privados o estado local. `docs/product/STARTER-CATALOG-AND-BASELINE-20261026.md`
define conceptos neutrales para el alta inicial futura y separa muestra ficticia
de línea base real. El seed reproducible tiene 13 perfiles ficticios (1 jefe, 2
encargados, 10 empleados), 4 empresas, 6 conceptos de catálogo y 73 ocurrencias
mensuales. El D1 del Site tiene 4 perfiles activos, 4 empresas, 6 plantillas,
1 asignación y 1 tarea en curso; el workspace no se actualiza desde el 06/10.
Supabase DEV tiene cero filas operativas. Ninguno de esos conteos demuestra
dotación o actividad de hoy. Falta una exportación actual, autorizada y
anonimizada de la fuente real. El primer ingreso actual sigue siendo una
simulación local sin cuentas.

El commit `d1577470cb2938d8f19adbe0be8f2f3c1c898359` publica el inventario y la
propuesta inicial de conceptos neutrales a `origin/main`; esa etapa de diseño
fue luego implementada en el laboratorio según la sección vigente superior.
El control local aprobó 196/196 pruebas, la suite 813/813, TypeScript y los
builds de cliente/Worker.
Después se publicaron en `origin/main` los agregados read-only del D1 y DEV como
`6656d114b3fb9ff64358edba2e3afd5624e925ec`. La revisión de 46 bundles descubrió
39 refs históricos fuera del ancestro de `main`; quedaron preservados en
`archive/sites-source-history-20261015` y
`archive/site-analytics-stash-20261007`, sin mezclarse con el producto vigente.
Se mantiene intacto el artefacto `.block` de auditoría.

## Resultado de conexión y migración DEV — 26/10/2026

El secreto `SUPABASE_DEV_DB_URL` valida y autentica. GitHub Actions run
`40367149794` aprobó la URL sin imprimirla, conectó al pooler y leyó el historial
remoto. El run terminó en fallo porque el preflight antiguo esperaba cero
migraciones; encontró 16. Supabase MCP confirmó que son exactamente las
versiones locales 001–014. Ese run no ejecutó SQL.

La aplicación previa está comprobada por GitHub Actions run `40012156985`: aplicó
el segmento 001–014 y verificó 16 versiones locales y remotas. SQL015 sigue
excluida. El workflow de verificación se actualizó para confirmar el estado
completo sin ejecutar SQL.

El siguiente gate es confirmar que Data API exponga sólo `api` y probar permisos
positivos y negativos con identidades ficticias. Auth/UI remotos siguen apagados
por defecto; no conectar producción ni activar el espacio operativo.

## Corte de publicación y migración externa

La última validación verde de suite, build y paquete Sites corresponde al cambio
de diagnóstico `6dea64af0c0344ba2175fc5a4a61b1ea56d80fce`, Actions
`40001331220`.

El mismo Site privado `appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85` se sincronizó
con los 634 archivos versionados de `main` y se publicó como versión 95 desde
`872f014a73ef1a7447d5ba58f3e6012518dca20c`. La publicación terminó con éxito en
`https://grupo-paris-contabilidad.valentino-magni.chatgpt.site`. Su audiencia
sigue limitada a la cuenta propietaria; no se agregaron visitantes ni se activó
el área operativa.

Supabase `grupo-paris-dev` continúa activo con las 16 migraciones 001–014 y sin
datos de negocio. El Site privado conserva su audiencia actual.

Siguen pendientes la migración/autenticación alojada y sus permisos, escrituras
operativas, evidencia y Storage, hosting Cloudflare independiente, correo,
producción y aceptación desde la PC personal. La aplicación sigue en laboratorio
con datos ficticios.

Cloudflare y correo no se han conectado. El Worker actual depende de D1 y de
identidad proporcionada por Sites; el correo sólo tiene proveedor de prueba.
Auditoría read-only y secuencia detalladas en
`docs/architecture/REMOTE-MIGRATION-READINESS-20261021.md`.

Este bloque reemplaza los estados anteriores de “lector sin UI”, `158b2a0`,
“sólo diagnóstico”, “URI inválida” y “base vacía”. El resto del registro queda
como historial.

## Cableado local Supabase/Auth — estado vigente

El modo remoto opcional ya está conectado desde `main.tsx`/`mount.tsx` al
bootstrap, al `SupabaseAuthGate` y a `MyWork`. Sigue apagado por defecto: sin
`VITE_SUPABASE_AUTH_BOOTSTRAP=true` la app abre el laboratorio. Con el modo
activado, el cliente usa clave publishable/anon, resuelve identidad y permisos
con `get_context_v1`, exige TOTP cuando corresponde y `MyWork` consulta páginas
`workspacePageV2` y `taskChecklistPage`.

Este primer recorrido es de sólo lectura: no contiene comandos RPC, escritura,
gestión de equipo ni el tablero operativo completo. Su montaje no prueba un
servicio alojado. El run `40367149794` sí conectó, pero todavía faltan pruebas
de aceptación de Auth, RLS, grants y respuestas en Supabase DEV. La ruta antigua
`RemoteWorkspace`/`site-worker.ts` usa D1 y
autenticación de Sites y permanece fuera del arranque.

SQL015 está aceptada para DEV con hash LF
`CC49480D1317F1B44CD29F245508F9C8FB0B0894FE4E66C1B22F8E00D36B33F2`, pero va
después de aplicar y auditar 001–014. La secuencia remota y los límites de
Cloudflare/correo están en
`docs/architecture/REMOTE-MIGRATION-READINESS-20261021.md`.

# Corte de implementación local — 21/10/2026

La puerta `SupabaseAuthGate` ya tiene inicio/cierre de sesión, identidad derivada de `get_context_v1`, MFA TOTP requerido para jefe/encargado, guardas para respuestas asíncronas obsoletas y formulario de acceso. Validación actual: 7 pruebas enfocadas; suite 760/760 en 77 archivos; TypeScript, build cliente y build Worker aprobados. La prueba nueva confirma que un encargado no entra al espacio antes de completar el enrolamiento TOTP. Esto sigue sin conectar `src/main.tsx` ni activar el área operativa remota.

Estado remoto reconsultado el 21/10/2026: `grupo-paris-dev` sigue con 0 migraciones y 0 tablas en `public`, `api` y `app_private`; no se escribió en Supabase.

Próximo paso remoto vigente al 23/10: configurar `SUPABASE_DEV_DB_URL` como secreto y ejecutar primero el preflight 001–014 sin escrituras; revisar destino, historial y dry-run antes de aplicar DEV. SQL015 queda en etapa separada y requiere aceptación Sol específica del código/hash. Después conectar la app y validar integración. Cloudflare, correo y prueba desde la PC personal siguen pendientes.

---
# Continuidad vigente — preflight CLI local listo; remoto pendiente, 21/10/2026

## Último corte local publicado — 21/10/2026

Commit `e8b8eb2` agrega el creador de cliente Supabase para navegador y sus
validaciones: sólo acepta URL HTTPS (HTTP local sólo para localhost), clave
publishable o JWT `anon`, rechaza claves privilegiadas y configura persistencia
de sesión/renovación. `.env.example` mantiene vacíos los valores. Prueba enfocada
9/9; suite completa 753/753 en 76 archivos; TypeScript, build cliente, build
Worker y hook de commit 196/196 aprobaron. Push directo a `origin/main`
confirmado en `e8b8eb2c70bfbf7eac6a99222b122d7f26fd0f1d`.

Esto no monta el cliente en `src/main.tsx` ni activa Auth: la app sigue siendo
el laboratorio local. Supabase DEV permanece en 0 migraciones y 0 tablas. Para
seguir, falta que el usuario agregue `SUPABASE_DEV_DB_URL` como secreto de
Actions y ejecute el workflow manual primero en modo preflight; no enviar el
secreto por chat. Después corresponde revisar el destino/dry-run, aplicar sólo
en DEV y auditar antes de integrar pantallas.

**Gate L aceptado por Sol** para el corte local sintético original, con alcance
en `architecture/M2-2C-GATEL-INTEGRAL-SOL-ACCEPTANCE-20261021.md`; esa aceptación
corresponde al SQL014 SHA-256 `218DEA9E9E3097743BD09238E73D5840A664F6718AEBE7670B88AF064278A837`.
Luego se quitaron sólo los delimitadores SQL `BEGIN`/`COMMIT` para que la CLI
ejecute el archivo como una transacción única. El candidato actual es
`BC09CF9631A2F3E4BD19541C2A050AB1C663AE0E704D47D7E5A4752B114E0345`; su
revalidación de atomicidad local está documentada. Sol aceptó BC09 para aplicar
exclusivamente en `grupo-paris-dev` mediante CLI 2.121.0; no amplía el alcance a
producción, usuarios reales ni activación operativa. Gate L original sigue
referido al hash 218DEA.

La CLI 2.121.0 se probó ahora contra un PostgreSQL 17.11 descartable: la falla
inyectada al final de SQL014 dejó 15 versiones y cero objetos de 014; el retry
con BC09 exacta pasó y registró la versión 16. Evidencia:
`architecture/SUPABASE-DEV-CLI-TRANSACTION-LOCAL-PREFLIGHT-20261021.md`.
Sol aceptó BC09 para aplicación únicamente en `grupo-paris-dev`; resta el
preflight remoto y la verificación de que el destino coincide exactamente.

**CLI Supabase:** se descargó temporalmente la versión oficial 2.121.0 y se
verificó el SHA-256 del release. En PostgreSQL 17.11 descartable, `migration list`
reconoció las 16 versiones locales de 12 dígitos y `db push --dry-run` enumeró
exactamente esos 16 archivos. No creó tablas ni historial. Evidencia:
`architecture/SUPABASE-DEV-CLI-LOCAL-PREFLIGHT-20261021.md`.

**Estado remoto confirmado ahora:** `grupo-paris-dev`, ref
`kynqjfhqujnjojcmurwf`: Supabase MCP informa 0 migraciones y 0 tablas en `public`,
`api` y `app_private`. No se ejecutó SQL remoto. Autoexposición de tablas nuevas
apagada en DEV; producción intacta.

**Preparación local:** ya existe el transporte `get_context_v1`/`query_v1`/
`command_v1`, con sesión requerida y decodificación estricta. Sus 6 pruebas
enfocadas, la suite completa 744/744, TypeScript y los builds cliente/Worker
pasaron. Aún no se instancia en el arranque ni se conecta al proyecto, por lo
que no habilita el uso remoto. Detalle:
`docs/architecture/REMOTE-MIGRATION-READINESS-20261021.md`.

**Workflow publicado:** commit `83249f0` agregó en `main` el flujo manual
`.github/workflows/supabase-dev-migrations.yml`, primero con `Apply migrations`
desmarcado. Requiere el secreto de repositorio `SUPABASE_DEV_DB_URL`, tomado de
Connect → Session pooler de DEV; no compartir su valor en el chat. Revisar el
resultado de destino, historial y dry-run; sólo luego volver a ejecutarlo con
`Apply migrations` seleccionado para aplicar. El workflow todavía no se ejecutó;
no hubo `db push` remoto.

Después del preflight remoto aceptado: aplicar las 16 migraciones sólo en DEV y auditar
ledger, esquema, RLS, grants, funciones y advisors; configurar Data API para
exponer sólo `api`. Luego siguen Auth/API sintética, Storage/restore, frontend,
CI, Cloudflare, correo y validación desde la PC personal. Mantener Site privado,
datos ficticios y espacio operativo apagado.

**Conexión de la app aún no implementada:** `src/main.tsx` monta el laboratorio
local. `RemoteWorkspace` usa el API del Worker con D1 y tampoco está montado; no
hay instancia de Supabase Auth/RPC en `src`. Aplicar el esquema no completa la
migración de la aplicación. Auditoría y secuencia concreta:
`docs/architecture/REMOTE-MIGRATION-READINESS-20261021.md`.

Esta cabecera supersede el estado y siguiente paso históricos más abajo.

# Continuidad vigente — C aceptada localmente, 20/10/2026

La familia C de replays legacy de supervisión de cobertura quedó aceptada por
GPT-6.1 Sol en alcance local acotado. Aceptación SHA-256
`64A2B9D3F9024E307FC21DCBEB38B810208B551C8DA2BE8DFEB6CE094FD8F8A1`; SQL014
`CE85FFB750443CB54CC25DD55AE25831CCFE71D8A10EA143D54C34855009447D`.
Evidencia canónica con manifiesto sincronizado: rojo 10/10, verde 28/28, 8/8
carreras, 56 snapshots completos, matriz 351/351, suite 738/738; TypeScript y
builds de cliente/Worker aprobados. Cubre sólo el SQL local; no se aplicó en
Supabase. Corte pendiente de commit/push directo junto con T.

Siguiente: contrato Sol para A (dos replays de ausencias), implementación Luna,
aceptación Sol; luego resolver P y consolidar §9/Gate L. Supabase alojado,
Auth/HTTP, Data API, Storage/restauración, frontend integrado, CI, hosting,
correo y producción siguen pendientes. Sin activar el espacio operativo ni
usar datos reales.

# Continuidad vigente — controles legacy de tarea aceptados localmente, 20/10/2026

Etapa T aprobada por GPT-6.1 Sol, en alcance local acotado. Aceptación SHA-256
`638EA12EF904AC9F72873854F15AAFAABFD17DEF7B2E0D892B7F11F3636C4B7B`;
SQL014 candidata `19EC849B0397602B7DC03939539D37F0999FE808FD21A91B227E7767F4BF9FC3`.
Cuatro rojos y cuatro verdes, ocho carreras con blockers, 162 comparaciones de
inercia y 352 snapshots; manifiesto 79/79; matriz 351/351, suite 738/738,
TypeScript y builds cliente/Worker aprobados. Los intentos históricos y scratch
`.block` están excluidos. Sin SQL remoto, cambios de servicio, commit o push.

Próximo paso: GPT-6.1 Sol selecciona/acota siguiente familia C/A/P y GPT-6 Luna
la implementa con contrato cerrado. §9/Gate L siguen abiertos; SQL014 no se
aplicó. Después quedan preflight, Auth/HTTP, Data API, Storage/restauración,
frontend integrado, GitHub CI, hosting, correo y aceptación final. Mantener Site
privado, datos ficticios y espacio operativo apagado.

# Continuidad vigente — replay de responsabilidad aceptado localmente, 20/10/2026

Sol aceptó localmente `public.assign_task_responsibility` en alcance acotado.
Contrato y aceptación están en `architecture/M2-2C-LEGACY-RESPONSIBILITY-REPLAY-AUTHORIZATION-SOL-CONTRACT-20261019.md`
y `architecture/M2-2C-LEGACY-RESPONSIBILITY-REPLAY-SOL-ACCEPTANCE-20261019.md`
(SHA aceptación `233ADBE22F7DFB2BE135D6AAE08E232530688D291D07BB05EAE8B7964AFB018E`).
SQL014 candidata SHA `CDD909C1A280DF8E891D6062838B146AEECADCF5CBC0F52291C6D44A0C89ECA2`;
baseline Git exacta `092B14200AD17D5FF5F96C5D6D748826366B395E3308082C5FEDAE40444EB4EA`.
Rojo confirmado; 28 casos secuenciales, 8/8 carreras, matriz nativa 351/351,
suite 738/738, TSC, builds cliente/Worker, sintaxis y diff-check exit 0.
Manifiesto SHA `478157350FC4ED3561EE5DF6BD940E0B79E20D339E8D6861F16B3B1182E71C1F`;
33/33 hashes y rutas verificados. SQL001–013 intactas. Límite P3 AAL1 consta en
la aceptación.

El bloque está publicado directamente a `origin/main`, sin PR, en
`53f37f09d04e871bbc15ae88c8b8362472753a95`; el SHA remoto fue confirmado.
SQL014 no se aplicó a Supabase. El proyecto dev continúa separado y sin
migraciones aplicadas. GPT-6.1 Sol audita ahora el inventario residual §9.
Gate L, Auth/HTTP, Data API, Storage/restore, CI, hosting, correo y producción
siguen abiertos.

Esta actualización supersede el encabezado anterior; los registros siguientes
son historial.

# Continuidad vigente — replay legacy de cronómetro aceptado, 19/10/2026

Sol aceptó localmente y en alcance acotado la reautorización del replay legacy
`public.start_task_timer`. Contrato y aceptación: `architecture/M2-2C-LEGACY-TIMER-REPLAY-AUTHORIZATION-SOL-CONTRACT-20261019.md`
y `architecture/M2-2C-LEGACY-TIMER-REPLAY-AUTHORIZATION-SOL-ACCEPTANCE-20261019.md`.
SQL014 candidato SHA-256 `C6A4ACDD92653DFFE9A0576EC3D8FBC906B2562E3BFAC056B8561981A4203EC8`;
manifiesto SHA-256 `BDD92D3416A9A27C1EBFE82E3645AD82318BCFB3A1A3CAD66F8321A943771859`.
Rojo baseline exacto confirmado; verde 23 eventos/8 carreras con blockers;
matriz nativa con smoke flags 351/351 baseline y candidata; suite 738/738,
TypeScript, builds, sintaxis y diff-check exit 0. SQL011–013 intactos. Sin commit
de este bloque todavía; SQL014 no se aplicó remotamente.

Lectura Supabase actual: organización `tablerocontable-paris DEV`, proyecto
`grupo-paris-dev` (`kynqjfhqujnjojcmurwf`) activo; lista de migraciones vacía y
sin tablas en `public`, `api`, `app_private`. La configuración Data API no se
verificó. Gate L/§9, otros replays legacy, Auth/HTTP, Data API, Storage/restore,
SQL014 remoto, CI, hosting, correo y producción siguen abiertos.

**Siguiente:** revisión Sol del inventario residual de §9; elegir el siguiente
contrato legacy sin reimplementar familias ya aceptadas.

## Bloque anterior — OneOff local, 19/10/2026

Runner/evidencia de la matriz OneOff aceptados por Sol en alcance limitado y ejecutados localmente contra
`architecture/M2-2C-ONEOFF-CREATE-MEMBERSHIP-REVOCATION-RACES-SOL-CONTRACT-20261019.md` (SHA-256 contrato `98C9B35ACA1D66C4931644B4E5E2CCF9EFD654D02426B0351E2E5AA7FFA033C4`).
PostgreSQL 17.11: 333/333, cuatro carreras create-first/revoke-first RC/RC y RR/RR; cero deadlocks. En baseline, winner-only, after-rollback y final se capturan/assertan sesiones y efectos laterales cero; reportes, entregas y outbox se limitan por org y owners E/R; month fences cubren todos los períodos de E/R, y las filas de operación se comparan exactamente por comando. Suite 738/738 en 74 archivos; TypeScript, build cliente, Worker, sintaxis y diff-check exit 0.
Runner SHA-256: `fbf8e3a86caaecb825561e654795c01b8f065b3774bee6594d0a5e24290547b7`; reporte SHA-256: `21398735b5470bf3957c3a82d8ad7b22511e8603609b1e0199724c9e33747401`. Manifiesto: `architecture/review-evidence/m2-2c-oneoff-create-membership-revocation-races-luna-20261019.json`; logs nativos en `../outputs/m2-2c-oneoff-create-membership-revocation-races-luna-20261019-attempt11/`. Aceptación: `architecture/M2-2C-ONEOFF-CREATE-MEMBERSHIP-REVOCATION-RACES-SOL-ACCEPTANCE-20261019.md`. Esto no cierra Gate L/§9. SQL011/014 y producto sin cambios. No aplicar SQL014 ni iniciar preflight alojado.

Esta cabecera tiene precedencia. Los registros cronológicos siguientes
conservan evidencia histórica; sus instrucciones anteriores de próximo paso
quedan supersedidas. Las reglas permanentes de seguridad, datos y flujo siguen
vigentes.
Las matrices de assignment.create, timer y operation.record ya aceptadas no
se deben volver a implementar por una instrucción histórica. El contrato
OneOff sólo autoriza su matriz local sintética.
No aplicar SQL014 ni iniciar preflight alojado por este documento.

## Antecedentes y evidencia histórica

**Último bloque local aceptado por Sol, alcance acotado:** cuatro carreras `assignment.create` vs `companyMembership.setActive(false)`, RC/RC y RR/RR en ambos órdenes. PostgreSQL nativo 17.11: 329/329, cuatro bloqueos reales, cero deadlocks; outcomes por contrato exactos. Suite completa: 738/738 en 74 archivos; TypeScript, builds cliente/Worker, `node --check` y `git diff --check` exit 0. El fallo anterior 737/738 no se reprodujo en el caso enfocado sobre baseline limpio, ni en la suite completa posterior. Sin cambios SQL ni llamadas remotas. Manifiesto versionado: `docs/architecture/review-evidence/m2-2c-assignment-create-membership-revocation-races-luna-20261019.json`; runner, reportes y logs en `../../outputs/m2-2c-assignment-create-membership-revocation-races-luna-20261019-attempt9/`. Aceptación registrada en `docs/architecture/M2-2C-ASSIGNMENT-CREATE-MEMBERSHIP-REVOCATION-RACES-SOL-ACCEPTANCE-20261019.md`. Sin aplicar SQL014; Gate L/§9 siguen abiertos.

# Estado general de la migración — actualización 19/10/2026

**Último bloque aceptado por Sol y publicado, alcance acotado:** cuatro
carreras `public.start_task_timer` frente a revocación, RC/RC y RR/RR, ambos
órdenes. PostgreSQL nativo 17.11: **325/325**, cuatro blockers reales, cero
deadlocks; Vitest **738/738 en 74 archivos**; TypeScript, builds cliente/Worker,
sintaxis y diff-check aprobados. Aceptación y límites P3:
`architecture/M2-2C-TIMER-START-MEMBERSHIP-REVOCATION-RACES-SOL-ACCEPTANCE-20261019.md`.
Manifiesto final:
`architecture/review-evidence/m2-2c-timer-start-membership-revocation-races-luna-20261019.json`
(SHA256 `82e6c67ad663e0310e36cae33d8bd0fc049845ec941ea61b33355222c390d16a`).
Runner SHA256 `fa7bf8da251a9fce4b0a4cc31f5152fdd2cbb5bc30c1d1e5b2ca48b03b9a4b23`;
SQL011/014 sin cambios. Publicado directamente a `origin/main`, sin PR, en
`0ff1df0eebc1237d60b08fed6450f6f21f401006`; SHA remoto confirmado. CI no está
verificado. Gate L y §9 siguen abiertos.

**Bloque completado:** assignment.create/revocación está aceptado en alcance
acotado y registrado en la cabecera; ya no es el siguiente paso.

**Último bloque aceptado por Sol y publicado, alcance acotado:** matriz de cuatro
carreras `operation.record`/revocación de membresía bajo RC/RC y RR/RR, ambos
órdenes. PostgreSQL 17.11 **321/321**, sin deadlocks; blockers reales en los
cuatro casos y outcomes del contrato exactos. Suite **738/738 en 74 archivos**;
TypeScript, builds cliente/Worker, `node --check` y diff-check con exit 0.
Fences comparados en las cinco claves según aclaración de Sol. Manifiesto e
informe con snapshots/respuestas/receipts:
`architecture/review-evidence/m2-2c-operation-record-membership-revocation-races-luna-20261019.json`.
Runner SHA256 `756295076e72cb35981d5ae30ac282bf5b508846c822b3cc4cf14b5032643ea9`;
SQL011 `9729a680…` y SQL014 `ac8cca58…` permanecen intactas. Logs locales en
`../../outputs/m2-2c-operation-record-membership-revocation-races-luna-20261019-final4/`.
Aceptación y límites P3: `architecture/M2-2C-OPERATION-RECORD-MEMBERSHIP-REVOCATION-RACES-SOL-ACCEPTANCE-20261019.md`.
No hubo llamadas remotas ni se activó el espacio operativo. Gate L y §9 siguen
abiertos. Publicado directo a `origin/main`, sin PR, en
`cf37b7fe220befa5317e4ae3295514288e96ff6e`; el SHA remoto fue confirmado.
CI de este push no está verificado.

**Último bloque aceptado por Sol y publicado, alcance acotado:** cuatro carreras
`cancel_task_coverage_binding`/`onboarding.approve` con binding de instancia
única y dos jefes AAL2 distintos. PostgreSQL 17.11: **317/317**, cero fallos y
deadlocks; cada caso bloqueó realmente. En RC/RC el cancel-first tuvo `40001`
y retry `00000`; approve-first canceló con `00000` y el replay void fue inerte.
Ambos órdenes RR/RR tuvieron el `40001` esperado y retry `00000`. Respuestas y
recibos completos coinciden; cierre final sin duplicados. Suite **738/738 en 74
archivos**; TypeScript, builds cliente/Worker, sintaxis y diff-check con exit 0.
Aceptación y límites P3:
`architecture/M2-2C-COVERAGE-CANCEL-ONBOARDING-APPROVAL-RACES-SOL-ACCEPTANCE-20261019.md`.
Manifiesto:
`architecture/review-evidence/m2-2c-coverage-cancel-onboarding-approval-races-luna-20261019.json`.
Runner SHA256 `320498dc9601ce7d72feb64c34ec88b38e9dce41f324651c3e45be208d829c74`;
SQL011/014 no cambiaron. Evidencia local adicional está bajo
`../../outputs/m2-2c-coverage-cancel-onboarding-approval-races-luna-20261019-attempt3/`,
fuera del Git root. No se modificó SQL ni hubo llamadas remotas. Gate L y §9
siguen abiertos; esta aceptación no autoriza migración.
Commit directo a `origin/main`, sin PR:
`4c598f575d1465ba3218af4b2da6ef3bca93aed4`; `git ls-remote` confirmó el SHA.
CI del push no está verificado.

**Último bloque Luna aceptado localmente por Sol, sólo este alcance:** cuatro
carreras `task.transition`/revocación de membresía para RC/RC y RR/RR, ambos
ganadores. El runner focal local pasó 305/305 en PostgreSQL 17.11, con
`40P01=0`, bloqueo medido por `pg_blocking_pids`, retries y snapshots completos.
Manifiesto: `architecture/review-evidence/m2-2c-transition-membership-races-luna-20261019.json`;
runner SHA256 `d00b0ddd7c1fb0820da7b5b341e897b8c74519416ce24e7129c32a60e88d7ce7`.
SQL014 sigue idéntica al baseline; no hubo llamadas remotas. Aceptación y límites
P3: `architecture/M2-2C-TRANSITION-MEMBERSHIP-RACES-SOL-ACCEPTANCE-20261019.md`.
La suite completa pasó 738/738 en 74 archivos; TypeScript, build cliente/Worker,
sintaxis del runner y diff-check terminaron con código 0; hook **196/196**.
Publicado directo a `main`, sin PR, y confirmado por SHA remoto:
`63bc5c78dd3274a5d6c0d1e1ef089f06f24baa75`. GitHub devolvió `statuses=[]`; CI no
está verificado. Gate L y §9 permanecen abiertos.

**Último bloque aceptado por GPT-6.1 Sol y publicado (alcance acotado):** cuatro
carreras de aprobación de cobertura recurrente frente a revocación de membresía,
RC/RC y RR/RR con ambos ganadores. PostgreSQL 17.11 **301/301**, `40P01=0`;
suite Vitest **738/738 en 74 archivos**; TypeScript, build cliente/Worker,
sintaxis del runner y `git diff --check` aprobados. Manifiesto y hashes:
`architecture/review-evidence/m2-2c-recurrent-same-isolation-luna-20261019.json`.
Sol acepta sólo estos casos; límites P3 y snapshot acotado constan en el
manifiesto. Código/evidencia en `660f75dcc9a9d4a5ab698e84d3ff0ae23a0f2068`; contrato
y estado actual en `8646f10ee90371748054830ef4af81cf4904f577`, ambos confirmados en
`origin/main` sin PR. El último status query devolvió lista vacía; CI no está
verificado. Hook local 196/196. Gate L/§9 sigue abierto. SQL014 no se aplicó remotamente.

**Bloques anteriores publicados y aceptados por Sol:** onboarding.requestChanges exact replay/commandReceipt y cuatro carreras mixtas de cobertura recurrente. El run 39184344731 corresponde al commit 873829271463b4f3bf4bbb5ad39dad978908a8d2 y no valida cambios posteriores. Gate L/M2.2C sigue abierto.

**Último bloque aceptado localmente por Sol, sólo este alcance:** cuatro carreras
entre aprobación de cobertura recurrente y `month.materialize`, ambos ganadores
bajo RC/RC y RR/RR. PostgreSQL 17.11 309/309, cero fallas/deadlocks; blocker,
`40001`, estado intermedio, retry `00000`, respuestas y recibos comparados, y
estado final 1 ocurrencia/1 raíz/1 hijo enlazado. Aceptación y límites P3:
`architecture/M2-2C-RECURRING-COVERAGE-MATERIALIZE-RACES-SOL-ACCEPTANCE-20261019.md`;
manifiesto y hashes en `architecture/review-evidence/m2-2c-recurring-coverage-materialize-races-luna-20261019.json`.
Suite 738/738 y build de Luna pasaron; Sol repitió sintaxis y diff-check, no la
suite/build. SQL011/014 intactas, sin llamadas remotas. Esto no cierra §9 ni Gate L.

**Último bloque local aceptado por Sol, sólo este alcance:** cuatro carreras de
`assign_task_responsibility` vs `onboarding.approve`, ambos órdenes bajo RC/RC y
RR/RR. PostgreSQL 17.11 **313/313**, cero deadlocks; suite **738/738** en 74
archivos; TypeScript, builds cliente/Worker, sintaxis y diff-check con exit 0.
Aceptación y límites:
`architecture/M2-2C-RESPONSIBILITY-ONBOARDING-APPROVAL-RACES-SOL-ACCEPTANCE-20261019.md`;
manifiesto y hashes:
`architecture/review-evidence/m2-2c-responsibility-onboarding-approval-races-luna-20261019.json`.
No se modificaron SQL011/013/014 ni se hicieron llamadas remotas. Esto no cierra
§9/Gate L; SQL014 sigue sin aplicar.
Commit publicado directamente a `origin/main`, sin PR:
`5425d99589f5edfcca1b2224753a0c5c1d2c1332`; `git ls-remote` confirmó el SHA.
El hook local ejecutó 196/196, aunque `git commit` devolvió código 1 después de
crear el commit; el árbol quedó limpio. CI del push no está verificado.

**Bloque completado:** timer/revocación está aceptado en alcance acotado,
según su aceptación y manifiesto conservados arriba; no es una acción pendiente.

El bloque cobertura recurrente/materialización quedó publicado directamente en
`main` (sin PR) como `63bc5c78dd3274a5d6c0d1e1ef089f06f24baa75`; el SHA remoto
coincide. Checks de GitHub vacíos; CI no verificado.

**Infraestructura sin cambios:** GitHub `main` está en `6d014381cf5888fe4aafa79e4be3ae0248e74531`; SHA remoto confirmado. CI de este SHA no aparece en el conector. Supabase dev sigue activo/vacío; falta apagar la autoexposición. No hay Cloudflare, correo productivo ni Supabase de producción configurados. Site privado y datos ficticios.

# Estado general de la migración — actualización 19/10/2026

**Checkpoint remoto:** el repo privado `tablerocontable-paris/TABLERO-CONTABLE` tiene publicado en `main` el corte funcional `d5f4e15045d097701b680b62789440310f6112ca`, autoría Tablero Contable y push directo sin PR. El push y el SHA remoto están confirmados. No se pudo verificar Actions para el evento push: el conector disponible filtra los runs por pull request; no usar un run anterior como evidencia de este corte.

**Último corte publicado:** Sol aceptó el arreglo de `assignment.create` exact replay tras revocación. Evidencia `docs/architecture/review-evidence/m2-2c-assignment-replay-20261018.json`; PostgreSQL 17.11 144/144, `40P01=0`; Vitest focal 19/19 y suite 735/735; TypeScript, build de cliente y Worker, `node --check` y `git diff --check` aprobados. Revalida jefe AAL2, empleado activo, membresía de empresa y equipo antes de devolver el recibo; argumentos distintos conservan `40001`. Sol lo aceptó en alcance local acotado; dejó P3 no bloqueante: la carrera usa el mismo jefe en ambas sesiones y no aísla lock de actor vs lock de membresía.

Los cortes previos de `task.createOneOff commandReceipt`, `onboarding.saveDraft/submit commandReceipt` y `onboarding.submit` replay tienen aceptaciones locales acotadas y evidencias propias. Ninguna de estas revisiones cierra M2.2C/Gate L.

**Supabase dev verificado:** organización `tablerocontable-paris DEV` (plan FREE), proyecto `grupo-paris-dev` (`kynqjfhqujnjojcmurwf`), PostgreSQL 17.11, activo y vacío, sin tablas ni migraciones; advisors sin hallazgos. Data API habilitada, expone `public, extensions` y “Automatically expose new tables” sigue activado. El usuario ya autorizó apagar esa opción; no hay una operación conector segura disponible para cambiarla. No aplicar SQL014.

**Siguiente paso:** continuar Gate L con una revisión acotada del permiso de `assignment.create commandReceipt` y `month.materialize`. Mantener SQL014 sin aplicar. Actions del push actual sigue sin verificarse con el conector disponible. Gate L, preflight Data API, Auth/HTTP alojado, hosting Cloudflare, correo productivo y Supabase de producción siguen pendientes.

# Estado histórico — A R7/R8 corregido localmente, 15/10/2026

La migración 014 ahora parsea las revisiones obligatorias antes del lock del
recibo y compara revisiones bien formadas sólo después de la reautorización y
los locks existentes. Los cursores de `activityPage` y `rateHistory`, además
de los límites/cursores de consultas no paginadas, se validan antes de locks.
`api_exact_keys` rechaza arrays esperados con miembros NULL. El runner nativo
rechaza flags desconocidos, repetidos y sin valor antes de crear el directorio
de salida y reporta el SHA‑256 de 014.

Validación final: sondas **20/20** (las 18 originales más dos controles de
`rateHistory`), PostgreSQL con bloqueos **6/6**, R6 **30/30**, sonda R6
independiente **9/9**, protocolo **15/15**; PostgreSQL17.11 **61/61 RC/RC**,
**61/61 RR/RR**, **43/43 RC/RR** y **43/43 RR/RC**. Suite completa **712/712 en
72 archivos**, TypeScript, build cliente, Worker, `node --check` de los runners
y `git diff --check` pasaron. La revisión inicial de la comprobación agregada
de rateHistory encontró un control positivo mal configurado; se corrigió el
fixture y la ejecución final pasó 20/20.

Evidencia: `architecture/review-evidence/m2-2a-r7r8-implementation-20261015.json`;
sondas en `../../outputs/m2-2a-r7r8-implementation-20261015/`. La revisión Sol
de A sigue pendiente. No aplicar ni desplegar 014, iniciar B/C ni conectar
cuentas. Supabase alojado, hosting y aceptación final siguen pendientes; avance
~45% histórico sin recalcular.

## Candidato anterior — implementación R6 pendiente de revisión

Se corrigió la validación NULL-safe de claves y revisiones en la migración local 014. Los envelopes, payloads, revisiones, filtros y cursores malformados devuelven
errores de protocolo antes de producir efectos. Las revisiones vacías, ausentes,
nulas, parciales o con claves/tipos incorrectos ya no habilitan escrituras. Una
revisión explícita obsoleta conserva `40001`; una entrada vigente sigue funcionando.
Los errores 22023 se pueden revertir a SAVEPOINT y continuar con una operación válida.

Validación de este corte: reproductor R6 **30/30**, sonda independiente **9/9**,
sondas previas **15/15**, focos **17/17**; PostgreSQL 17.11 **61/61 RC/RC**,
**61/61 RR/RR**, **43/43 RC/RR** y **43/43 RR/RC**; suite **712/712 en 72 archivos**.
TypeScript, build de cliente y build de Worker aprobados. Se probó además en
PostgreSQL nativo el rechazo de `expectedRevisions: {}` con estado sin cambios.
Evidencia y hashes: `architecture/review-evidence/m2-2a-r6-implementation-20261015.json`.

La corrección quedó guardada en `08b7405`; la evidencia documental en `de38b3d`.
Ambos commits pasaron el hook pre-commit **196/196 en 19 archivos**. El bundle y
ZIP de `de38b3d` se verificaron con clonación limpia: el HEAD restaurado coincide
con el manifiesto. Paquete: `outputs/m2-2a-r6-candidate-delivery-20261015`.

Próximo: revisión independiente de **GPT‑6.1 Sol, esfuerzo alto, Standard**.
Los candidatos anteriores 9c096973/4597e74 conservan el defecto. No iniciar
B/C, desplegar 014 ni conectar cuentas. Integración alojada y aceptación final
siguen pendientes. El avance permanece ~45% histórico, sin recalcular por este corte.

## Candidato anterior — M2.2A pendiente de revisión, 15/10/2026

Las cinco correcciones del informe Sol están implementadas en la migración local
014 y el DTO. Matriz PostgreSQL17.11: **61/61 RC/RC, 61/61 RR/RR**, y las
variantes cruzadas para replay/revocación **43/43 RC/RR y 43/43 RR/RC**. Los 19
casos M2.2A pasaron en cada corte completo; se observaron los bloqueos, reintentos,
recibos y estados finales. Sondas PGlite/protocolo **15/15**; suite completa
**712/712 en72 archivos**; TypeScript y builds cliente/Worker código0. Evidencia:
`architecture/review-evidence/m2-2a-corrections-validation-20261015.json`.

**El commit candidato 9c096973 y el bundle portátil se generaron y verificaron**
mediante clonación limpia en `outputs/m2-2a-candidate-delivery-20261015`.
M2.2A aún no está aceptado por Sol. La revalidación fue sólo local y sintética.
No desplegar 014 ni conectar cuentas;
M2.2B/C e integración Supabase/hosting siguen pendientes. Se conservan 001–013,
UI, Worker y Site. El avance global permanece ~45% histórico y no se recalcula.

## Evidencia del corte previo a la matriz — histórica, no pendiente vigente

La migración local 014, el contrato Zod y el runner operativo siguen en revisión.
PostgreSQL 17.11 nativo aprobó **35/35**, incluido el control de ACL, paginación,
registro/tasa/evaluación, rollback, cierre legacy y ámbito de encargado. Dos
regresiones nuevas confirman que un snapshot RR anterior a la baja del actor o a
un cierre no produce actividad ni recibo; también se volvió a comprobar la
cancelación de cobertura sin `40P01`. El upgrade PGlite 013→014 preserva actividad,
tarea, cierre, reporte, outbox, sesión, recibos legacy y notas privadas con su
historial. El decoder pasó **16/16**, TypeScript, build cliente y build Worker.

La suite completa corrió **712/712 en 72 archivos**. El intento
anterior mostró una falla intermitente de búsqueda accesible en Catálogo; la
prueba aislada y la suite completa posterior pasaron.

**En ese corte** M2.2A todavía esperaba el repaso Sol independiente y ampliar
ordenamientos entre niveles de aislamiento. La matriz del encargado cubría
AAL2, consultas dentro y fuera de su equipo, prohibición
de ejecutar y parametrizar, privacidad y revocación de recibos de los tres
comandos. Fallos inyectados en registro, tasa y evaluación confirmaron rollback
de cambios parciales, recibos y fences. Las carreras cubiertas incluyen primera tasa↔registro,
replay, evaluación, cierre legado y cancelación de cobertura mientras espera; todas
se observaron bloqueadas y finalizaron sin `40P01`. 014 sigue sin desplegar. No se
conectaron cuentas, transporte de UI, Worker ni Site. M2.2 B/C y M2.3 siguen fuera
de este corte. El avance global permanece ~45% histórico, sin recalcular ni aumentarlo.

Evidencia de aquel corte: `architecture/review-evidence/m2-2a-implementation-20261015.json`.
La revalidación posterior y la acción vigente constan al inicio de este archivo.

> **Corte vigente 15/10/2026: M2.1 aceptado localmente.** Los cuatro defectos anteriores quedaron resueltos. Revisión independiente: PostgreSQL42/42, focales27/27 y TypeScript; fuentes de producto iguales al corte690/690/builds del14/10. Informe architecture/M2-1-SOL-ACCEPTANCE-20261015.md. Próximo: Luna medio Standard implementa architecture/M2-2A-OPERATIVE-API-LUNA-20261015.md. M2.2 completo requiere A/B/C; sólo A tiene contrato ejecutable. Sin aceptación de servicios alojados ni despliegue. ~45% histórico, sin recalcular por revisión/documentación.

> **Diseño M2 — 14/10/2026.** Inventario estático de 90 fuentes/38 campos State y matriz completa de consultas/comandos, con siete bloques de migración a Supabase. Se definieron fronteras de API, identidad técnica separada, privacidad de anotaciones, operativas versionadas, cierres por empresa, evidencia y recuperación. Contrato inmediato cerrado para M2.1; los demás requieren desglose/revisión antes de Luna. Ver architecture/SUPABASE-M2-CONTRACT-20261014.md y architecture/M2-1-IDENTITY-LUNA-20261014.md. Reproducibilidad M1 verificada ahora sobre clonación limpia con npm ci: Node24.19/npm portable12.2, 223 paquetes, 668/668, TypeScript/builds/paquete Sites aprobados; Git limpio. Se corrigió la guía portable. Evidencia: architecture/review-evidence/m2-architecture-contract-20261014.json. SQL013 y la app Supabase aún no están implementados. ~45% histórico sin recalcular.

> **Migración propia — corte M1, 14/10/2026.** Commit `8d95200` en `migration/github-bootstrap`; fuente/evidencia acotadas, CI con acciones fijadas a SHA, suite 668/668, TypeScript, builds cliente/Worker y paquete Sites aprobados con las dependencias existentes. Bundle clonado en limpio con HEAD coincidente. La guía anterior tenía errores de orden de verificación y de clave del manifiesto; corregidos en M2 y reemplazados en el paquete portable siguiente. GitHub NUEVO aún sin conexión/remoto; Supabase Auth/paridad alojada pendientes. M1 no acredita por sí mismo npm ci en copia limpia ni aceptación productiva.

> Registro histórico de auditoría Sol (11/10/2026): en ese corte se identificaron
> 65 hallazgos/95 casos y la siguiente acción era implementar la etapa 1. El
> estado vigente está en la actualización de aceptación de etapa 3 más abajo.

> **Reauditoría del recorrido S39 — 14/10/2026.** La lectura módulo por módulo encontró brechas después de la validación anterior: algunos pasos aún apuntaban a controles generales, y una vista sin laboratorio no resolvía su destino de calendario. Se ajustaron los anclajes internos, los estados vacíos, el despliegue temporal de Catálogo y el recálculo de posición al cambiar el viewport. El recorrido no abre formularios ni ejecuta acciones de negocio; empleado, encargado y jefe conservan sus permisos.
> Suite completa: **663/663 en 67 archivos**. TypeScript, build cliente y Worker pasan. Edge: **31/31**, tours completos para los tres roles (11/13/15 pasos), desktop 1440×900 y coach móvil 390×844; cero errores JS y cero llamadas a la API operativa. Revisión independiente Sol y aceptación humana con lector de pantalla siguen pendientes. Evidencia: `docs/architecture/review-evidence/s39-tour-refresh-20261014.json` y `outputs/s39-tour-refresh-20261014/browser-validation.json`. No se hizo commit ni publicación; avance global ~45%.

# Estado del proyecto Grupo París

> **Aceptación M2.1 — 15/10/2026.** Se revisaron migración013, decoder, permisos,
> fixtures y evidencia del commit a93f7d0. Las cinco pruebas independientes nuevas
> cubren todas las tablas públicas y snapshots en upgrade, whitespace completo,
> nombres técnicos200/201 Unicode, ACL y JWT vigente al inactivar. Runner nativo
> ampliado:42/42, incluidas carreras con actualizador esperando y rollback de la
> primera sesión; focales27/27 y TypeScript pasan. Producto001–013/src intacto,
> por lo que suite690/690/builds se conservan como evidencia histórica coincidente.
> M2.1 queda aceptado en alcance local. M2.2A tiene contrato ejecutable para
> protocolo y operativas; seguimiento/dependencias y creación/inducción/catálogo
> sin metas completarán B/C bajo revisión posterior. El backend no está conectado
> al proveedor ni a la UI. Evidencia: architecture/review-evidence/m2-1-independent-acceptance-20261015.json.

> **M2.1 corregido y listo para revisión Sol — 14/10/2026.** La migración 013 ahora deniega AAL ausente/null, reconoce identidades dobles aunque una esté inactiva, normaliza nombres con el mismo conjunto Unicode que el decoder y serializa cambios de UUID con filas de fence. `AccountingLab.actor()` volvió a preservar claims históricos sin `role`; el wrapper de estas pruebas envía explícitamente `authenticated`. El upgrade 012→013 conserva filas y snapshots de datos de prueba poblados, y se amplió la matriz ACL, corrupción y rollback. PostgreSQL17.11 nativo: **24/24**, incluidas carreras insert/update, RC/RR/Serializable y bloqueos observados; Vitest completa: **690/690 en69 archivos**; TypeScript, build cliente y Worker aprobados. Evidencia en `architecture/review-evidence/m2-1-corrected-implementation-20261014.json`. Sólo entorno local descartable/sintético: no se conectó ni desplegó Supabase. Próximo paso: GPT-6.1 Sol, esfuerzo alto, revisión independiente contra `M2-1-CORRECTIONS-LUNA-20261014.md`; M2.2/014 permanece bloqueado hasta aceptación. Avance global sigue ~45% histórico.

> **Revisión M2.1 — 14/10/2026: NO aceptado.** Cuatro defectos reproducidos:
> AAL ausente/null, identidades simultáneas con snapshot repetible, identidad
> doble parcialmente inactiva y nombre sólo de espacios invisibles. PostgreSQL
> portable sí estaba en work/pg-runtime/pgsql/bin. El corte actual pasó5/11 casos
> independientes; una propuesta aislada corrigió los cuatro y pasó11/11, sin
> incorporarse aún a013. Se identificaron brechas de upgrade poblado y fixtures.
> Informe architecture/M2-1-SOL-REVIEW-20261014.md; siguiente Luna medio Standard
> ejecuta architecture/M2-1-CORRECTIONS-LUNA-20261014.md, luego Sol alto revisa.
> 014/M2.2 pendiente; sin cuentas conectadas, avance ~45% histórico sin aumentar.

> **M2.1 implementado localmente — 14/10/2026.** Se añadió SQL013 con los
> esquemas `api`/`app_private`, cuenta técnica separada, bloqueo de identidad
> cruzada, ACL cerradas y `api.get_context_v1()`. El decoder Zod valida el DTO
> mínimo estricto sin iniciar sesión ni tocar State. Verificación: 688/688 en
> 69 archivos, TypeScript y build cliente/Worker aprobados; prueba focal 20/20.
> Evidencia: `architecture/review-evidence/m2-1-identity-implementation-20261014.json`.
> Tiene commit local y sigue sin conexión remota. PostgreSQL de dos sesiones para la
> carrera de doble identidad y revisión independiente Sol permanecen pendientes;
> PGlite secuencial no sustituye esa comprobación. No se conecta UI ni datos
> operativos a Supabase. Próximo: GPT-6.1 Sol alto audita M2.1 y define el
> contrato ejecutable M2.2. El ~45% global es histórico; se actualizará al
> cerrar bloques migratorios con aceptación, infraestructura y entrega medidas.

> **Aceptación técnica independiente vigente — 14/10/2026.** S38/S44 y el
> runner S52 aceptados tras revisar fuente y 69/69 comprobaciones (63 existentes
> y seis variantes independientes). Los hashes del producto coinciden con el
> corte que pasó 668/668 y builds; no se repitieron suite completa/build porque
> esta revisión no cambió producto. Etapas 1–7 revisadas en alcance técnico local;
> permanece la aceptación humana con lector de pantalla de etapa 5. Recorrido:
> `docs/runbooks/SCREEN-READER-ACCEPTANCE-LAB.md`. Evidencia:
> `docs/architecture/review-evidence/s38-s44-independent-acceptance-20261014.json`.
> Esto no acepta infraestructura alojada ni acredita commit, paquete o deploy.
> El avance global sigue como estimación histórica ~45%, sin nueva medición.

> **Implementación local S38/S44 — 14/10/2026.** Se corrigió el foco del coach,
> la aceptación fuera de orden de sondeos y la sincronización de la captura con
> la animación de la torta. Suite completa 668/668, TypeScript, cliente y Worker
> aprobados; Edge 32/32, cero errores JS y cero llamadas a API. Evidencia en
> `docs/architecture/review-evidence/s38-s44-followup-20261014.json`. Los gates
> de revisión independiente Sol y lector de pantalla humano siguen pendientes.
> No hubo commit, publicación ni conexión de cuentas/servicios. El árbol ya tenía
> cambios ajenos, por lo que se preservó el historial local sin crear un commit
> que los mezclara.

> **Registro histórico de revisión inicial — supersedido 14/10/2026.** S38 y S44
> tienen correcciones incompletas confirmadas con App real: foco al volver al
> primer paso y sondeos GET fuera de orden. Dos probes fallan; 138 regresiones
> existentes pasan. S52 aceptado funcionalmente y S57/S58 aceptados en alcance
> local. Etapas 5/7 no aceptadas y lector de pantalla humano pendiente. La torta
> se renderiza completa al terminar la animación; corregir la espera de captura
> del runner. Informe y contratos Luna:
> `docs/architecture/SOL-INDEPENDENT-REVIEW-20261014.md`. Próximo modelo Luna
> medio, Standard; después Sol alto. El cierre anterior de implementación fue
> prematuro para S38/S44. No se modificó código de producto ni servicios.

> **Revalidación runtime del paquete Sol — 14/10/2026.** Con Node v24.19.0,
> dependencias locales, Edge y `playwright-core` se repitió la suite: 665/665
> en 67 archivos; TypeScript y builds cliente/Worker pasaron. Los cuatro E2E
> Edge pasaron, incluido el de correcciones 29/29; S52 esperó la geometría
> visible de los sectores “En curso” y “Pendiente” de la torta antes de la captura;
> accesibilidad automatizada
> cubrió 38 rutas/2.124 controles/877 focos y contraste 5.943 textos/76
> combinaciones. La revalidación S57 posterior midió 384,85 ms p95; S58 pasó
> 7/7. `git diff --check`
> pasó. npm/npx global no están en PATH y no fueron necesarios. El gate de
> navegador quedó cerrado localmente; PostgreSQL/MVCC local pasó 26/26 casos con
> Auth sintético, sin validar Supabase remoto. Siguen abiertos lector de pantalla
> humano y revisión independiente Sol (S52 y etapas 5–7). Evidencia:
> `docs/architecture/review-evidence/sol-corrections-runtime-recheck-20261014.json`.

> **S57/S58 reejecutados sobre el árbol actual — 14/10/2026.** TypeScript,
> build cliente (entrada 332,85 kB), build Worker y `git diff --check` pasan.
> Benchmark: 30/30 muestras, 24 perfiles/2.000 tareas, p95 383,72 ms. Verificador
> aislado: 7/7, 209 omitidas por filtros y 0 fallidas. Ambos reportes comparten
> SHA-256 `4b599c7c83732082c72d0a9dbbd343ea8b4bd4b5c19766aa9ff0a4cb0032a109`
> (443 archivos antes de esta nota). Artefactos bajo
> `outputs/current-sol-followup-20261014/`. No se modificó código de producto;
> siguen pendientes la revisión independiente Sol y la aceptación humana del
> lector de pantalla.

> **Cotejo local de etapa 7 — 14/10/2026.** Se revisaron S01/S13/S30–S32 y
> S44–S46/S59–S60 contra contratos, código y regresiones. No apareció una
> brecha concreta que justifique otro cambio de código. Las pruebas focales
> pasaron 122/122 en 8 archivos (47 + 40 + 35), excluyendo copias temporales
> bajo `tmp/**`. Detalle, outputs y hashes en
> `docs/architecture/review-evidence/s01-s13-s59-s60-source-recheck-20261014.json`.
> Es una relectura local; la revisión independiente GPT‑6.1 Sol sigue pendiente.

> **S61–S65, relectura local — 14/10/2026.** Los contratos de atomicidad por
> grupo, semántica/foco de búsqueda, límite del respaldo y resultado/compensación
> de evidencia se contrastaron con fuentes y regresiones actuales. Focal: 99/99
> en 8 archivos. No surgió otra corrección de código. Evidencia y hashes:
> `docs/architecture/review-evidence/s61-s65-source-recheck-20261014.json`.
> No reemplaza aprobación independiente de Sol ni aceptación humana con lector
> de pantalla.

> **S52/recorrido Edge actual — 14/10/2026.** Build cliente aprobado; Edge
> completó 31/31 controles con cero errores JS y cero llamadas a API operativa.
> Inspección directa del SVG real de Recharts confirmó grupos sólo operativos,
> fila de entregables en cero, rótulos separados y dos sectores completos en
> escala de grises. Evidencia/hash/captura:
> `docs/architecture/review-evidence/s52-edge-current-source-recheck-20261014.json`.
> Revisión independiente GPT‑6.1 Sol y aceptación humana siguen pendientes.

> **Reconciliación completa S01–S65 — 14/10/2026.** El informe Sol contiene
> 65 IDs únicos; la partición de evidencias por siete etapas cubre 65/65 sin
> faltantes ni duplicados entre etapas. La suite actual pasó 665/665 en 67
> archivos; TypeScript, build cliente, Worker y Edge 31/31 pasaron. Informe con
> estados, outputs y hashes:
> `docs/architecture/review-evidence/sol-65-current-closure-recheck-20261014.json`.
> Etapa 4/S52 y etapas 5–7 esperan la revisión independiente Sol; la aceptación
> humana con lector de pantalla también sigue abierta.

> **Endurecimiento S57/S58 — 14/10/2026.** El verificador ahora fija 30
> muestras, p95 <1.000 ms y fixture de 24 perfiles/2.000 tareas; no admite
> opciones que relajen esos límites. Regresiones focales 14/14; suite 665/665;
> TypeScript, cliente y Worker pasaron. Edge: p95 384,85 ms. El runner S58
> pasó 7/7 (209 filtradas por patrones), con hash efectivo igual al del
> benchmark. Evidencia: `docs/architecture/review-evidence/s57-s58-current-contract-recheck-20261014.json`.

> **Revalidación real del recorrido S39 — 14/10/2026.** Edge completó el
> runner de correcciones **29/29**, sin errores JavaScript ni llamadas a la API
> operativa. El fallo previo era una aserción desactualizada que buscaba el
> título “Cierre por alcance”; el producto muestra correctamente “Cierre de
> mes”. Se corrigió sólo el texto esperado del runner. Quedan abiertas la
> aceptación humana con lector de pantalla y la revisión independiente Sol.
> Evidencia: `docs/architecture/review-evidence/s39-edge-browser-recheck-20261014.json`
> y `outputs/stage-5-validation-20261014/edge-post-s57-recheck-final/`.

> **Revisión local del paquete Sol — 14/10/2026.** Árbol efectivo verificado:
> SHA-256 `2cff5088bbc8992cecfbe25c1f019c8121ae673119d4580493c3bd534047d425`.
> Suite 663/663 en 67 archivos; TypeScript y builds de cliente/Worker pasan.
> Los cuatro recorridos Edge pasan; accesibilidad automatizada cubrió 38 rutas,
> 2.124 controles del árbol AX y 904 paradas de teclado sin fallos. Contraste:
> 5.943 textos en 76 combinaciones, cero omitidos/fallos. S57 midió p95 534,39
> ms con 24 perfiles/2.000 tareas; S58 aprobó 7/7. Esto no sustituye aceptación
> humana de lector de pantalla, revisión Sol de S52 y etapas 5–7, ni MVCC real.
> Evidencia consolidada en
> `docs/architecture/review-evidence/sol-corrections-recheck-full-20261014.json`.

> **Revisión focal de contratos pendientes — 14/10/2026.** Se compararon los
> contratos abiertos S52, S36–S39, S54, S56, S62–S63, S57–S58 y etapa 7 con
> las fuentes actuales. Regresiones focales: 200/200 en 18 archivos; S57: 30
> muestras, 24 perfiles/2.000 tareas, p95 569,62 ms; S58: 7/7, 209 omitidas.
> Hash común de árbol: `292d563c7f2306cc5f71967e76dc737e8da8e1a87de1b7322b1b9cd3b9b5568e`.
> No se confirmó una discrepancia nueva de código. Siguen pendientes la revisión
> independiente Sol de S52 y etapas 5–7, lector de pantalla humano y MVCC real.
> Evidencia: `docs/architecture/review-evidence/open-contracts-recheck-20261014.json`.
> Comprobación local adicional: Winget verificó el instalador EDB PostgreSQL
> 17.11-5, pero Windows canceló su inicio antes de extraer binarios; no se
> instaló ni arrancó un servicio y no hubo prueba MVCC. El intento y la ruta
> temporal están documentados en el mismo expediente.

> **Revisión del paquete de correcciones Sol — 14/10/2026.** Se conciliaron
> `PLAN-REVIEW`, `PLAN-CORRECTIONS-NEXT`, `SOL-AUDIT`, la matriz de requisitos y
> el contrato de ejecución: 65 hallazgos identificados y reconciliados sin
> omisiones ni duplicados. Se corrigió el último punto de código explícito que
> seguía abierto en el plan anterior: la entrada del cliente bajó de 548,96 a
> 328,29 kB mediante chunk de framework; la evidencia operativa se carga de
> forma diferida y el límite Vite de 500 kB se conserva. La suite pasó 661/661,
> TypeScript y builds de cliente/Worker pasaron. Zod aún emite avisos `PURE` de
> dependencia. La comprobación posterior del recorrido S39 en Edge pasó 29/29;
> ver el registro inmediatamente anterior. La inspección independiente del
> bundle y la revisión Sol continúan pendientes. No se hizo commit, PR,
> actualización del Site, conexión ni despliegue.
> Evidencia: `docs/architecture/review-evidence/sol-corrections-review-recheck-20261014.json`.

> **Corrección de respaldo congelado — 14/10/2026.** La auditoría encontró que
> las tareas y movimientos incluidos en snapshots podían omitir validaciones
> de fechas reales, rango 0–30, período del avance comercial, coeficientes y
> dependencias. Se endureció el esquema preservando la compatibilidad de campos
> ausentes en snapshots antiguos. Regresión focal 17/17 y TypeScript pasan;
> `git diff --check` no encontró errores de whitespace (avisos sólo de CRLF).
> Esto no cierra la aceptación completa del respaldo ni la revisión visual.
> Evidencia: `docs/architecture/review-evidence/backup-snapshot-validation-lab-20261014.json`.

> **Relectura S57/S58 — 14/10/2026.** S57 tenía un caso de salida que podía
> guardar un informe fallido en una carpeta `PERFORMANCE_OUTPUT` preexistente.
> El verificador reserva ahora una carpeta hermana nueva y conserva intacto el
> historial; regresión focal 12/12. La suite actual pasó **663/663 en 67
> archivos**, TypeScript, build cliente (entrada 331,70 kB) y Worker pasaron.
> El runner aislado pasó 7/7; Edge midió p95 408,51 ms en 30 recorridos, 24
> perfiles/2.000 tareas, sin errores JS ni llamadas operativas. Sigue siendo
> rendimiento local, no concurrente ni de producción; la aceptación Sol de
> S57/S58 permanece pendiente. Evidencia:
> `docs/architecture/review-evidence/s57-s58-recheck-lab-20261014.json`.

> **Actualización 14/10/2026 — S57/S58.** Además del runner de aislamiento,
> el benchmark ahora rechaza un resultado si no puede acreditar el hash del
> árbol, aunque las muestras cumplan el umbral. El runner genera reporte fallido
> y salida no-cero ante error de Git. Regresión focal: 11/11; runner completo:
> 7/7, 209 omitidas, 0 fallidas; suite actual: 661/661 en 67 archivos;
> TypeScript pasa. Revisión independiente Sol de S57/S58 pendiente. Evidencia:
> `docs/architecture/review-evidence/s58-hash-failure-report-lab-20261014.json`.
> Sin commit, PR, Site update, servicios, API ni despliegue.

> **Corte anterior 14/10/2026 — continuación S39/S57/S58 (superado).** Se completó localmente la
> corrección del recorrido guiado: objetivos internos por módulo, alternativas
> para vistas equivalentes y estados vacíos, apertura/restauración de paneles y
> tarjetas sin escrituras de negocio. S57 ahora rechaza benchmarks sin hash de
> procedencia aunque las muestras sean válidas; S58 genera reporte fallido ante
> error de Git. La suite pasó **661/661 en 67 archivos**; TypeScript, build
> cliente y Worker pasan. En ese corte el chequeo visual real quedó pendiente;
> luego Edge pasó 29/29, como registra la revalidación vigente al comienzo de
> este documento. S39 aún requiere revisión independiente de Sol. Evidencia:
> `docs/architecture/review-evidence/s39-tour-module-targets-lab-20261014.json`.
> No hubo commit, PR, Site update ni despliegue. Avance ~45%, sin cambio.

> **Actualización anterior 14/10/2026 — revalidación local integrada.** La etapa 1 sigue
> aceptada por Sol; etapas 2–3 también. En etapa 5 se corrigió retorno de foco
> del recorrido tras cambiar actor, aviso de reinicio de progreso antiguo y
> retorno de foco a tarjeta movida con teclado. Suite completa en ese corte 658/658
> en 67 archivos; TypeScript, cliente, Worker y `git diff --check` pasan. Edge
> ejecutó 29 comprobaciones, incluida tarjeta cubierta por teclado y foco, sin
> errores JS ni llamadas a `/api`. Benchmark local
> de 24 perfiles/2.000 tareas: p95 502,95 ms (<1.000 ms). La etapa 7 continúa
> implementada, pendiente revisión Sol y MVCC real. Restan 21 hallazgos para
> revisión independiente de Sol, además de lector de pantalla y MVCC concurrente.
> Avance ~45%, sin
> cambio. No hubo commit, PR, actualización del Site, conexión de cuentas, API
> operativa ni despliegue. Evidencias de etapas 5–7 al final de este bloque.

> **Detalle de etapa 7 — auditoría independiente pendiente.** Incluye S59/S60 y S01/S13/S30/S31/S32/S44/S45/S46.
> La suite integrada tras S39 y las regresiones S57/S58 pasó 661/661 en 67 archivos;
> TypeScript, cliente, Worker y `git diff --check` pasan. El corte anterior,
> tras los cambios de foco de etapa 5, había pasado 658/658. Regresiones
> integradas S44/S45 cubren el polling
> tardío durante POST y un `activeId` sin perfil activo resoluble en GET, además
> de POST inválido; la
> propuesta se conserva ante la respuesta POST inválida. La migración 012 no se
> aplicó remotamente. S46 también comprueba GET válido con presencia vacía y que
> no se escribe heartbeat sin identidad. S59 también prueba que un encargado
> cuyo vínculo fue revocado no modifica la inducción ni deja revisión/auditoría;
> el RPC usa ahora bloqueos compartidos de actor, perfil y solicitud y revalida
> autoridad antes de escribir. PGlite secuencial no demuestra concurrencia
> MVCC; este entorno no tiene PostgreSQL ni Docker locales. Sol debe revisar
> contratos, permisos, migración y evidencia
> antes de aceptar la etapa. Siguen abiertos gates de etapas 4–7 y aceptación
> global; avance orientativo ~45%, sin cambio. No hubo commit, PR, actualización
> del Site, conexión de cuentas, API operativa ni despliegue. Evidencia:
> `docs/architecture/review-evidence/stage-7-implementation-local-20261014.json`.

> Revalidación y nuevos bordes de foco: `docs/architecture/review-evidence/
stage-5-partial-laboratory-20261014.json`; benchmark actual:
> `outputs/performance-lab-2026-10-14-post-tour-2026-10-14/`.

> **Corte anterior a la actualización de etapa 7 — etapas 5 y 6 implementadas localmente; aceptación
> todavía abierta.** La suite oficial pasó 638/638 en 67 archivos; TypeScript,
> cliente y Worker compilan. El benchmark válido de 24 perfiles/2.000 tareas
> midió 30 recorridos con p95 368,07 ms (<1.000 ms); el verificador aislado
> aprobó 7/7 casos esperados y rechaza cero pruebas/patrones ausentes. La etapa 5
> tuvo 28 checks Edge, cero errores JS/API. Faltan revisión independiente Sol
> de etapas 5/6, lector de pantalla y revisión S52 de etapa 4. Avance global
> ~45%, sin cambio. Sin commit, PR, actualización del Site, cuentas, API
> operativa ni despliegue. Evidencia: `docs/architecture/review-evidence/
stage-5-partial-laboratory-20261014.json`, `stage-6-verifier-implementation-
lab-20261014.json` y sus reportes bajo `outputs/`.

> Actualización 14/10/2026 — **etapa 3 aceptada por revisión independiente de
> Sol** para S04/S12/S19/S22/S26/S35/S61. Suite final 595/595 en 65 archivos;
> TypeScript, builds cliente/Worker, `git diff --check`, recorridos Edge
> principal/correcciones/conjuntas y benchmark aislado aprobaron. Navegación
> caliente p95 405,45 ms con 24 perfiles y 2.000 tareas. Avance global sigue
> orientativo ~45%; etapas 4–7 abiertas. Sin commit, PR, actualización del Site,
> cuentas, API operativa ni despliegue. Evidencia:
> `docs/architecture/review-evidence/stage-3-final-acceptance-20261014.json`.

> Etapa 4 en curso: Sol aceptó funcionalmente S05, S15, S20, S24, S25, S33, S40,
> S41 y S42; S48 también quedó aceptado tras revisar separación de puntos de
> entregables y actividad operativa. S52 está implementado localmente, pero
> sigue pendiente de revisión independiente. La comprobación visual con
> Recharts real pasó: dos perfiles sólo operativos aparecen como “Sin base de
> entregables” y un entregable sin avance queda identificado como 0%. TypeScript,
> build de cliente/Worker, prueba focal 20/20, `git diff --check` y Edge
> correcciones pasaron tras el ajuste. Edge sin errores JS ni llamadas operativas.
> Captura y resultado: `outputs/stage-4-validation-20261014/edge-s52-real-chart/`.
> Avance global ~45%, sin cambio. Sin commit, PR, publicación, cuentas ni despliegue.
> Evidencia: `docs/architecture/review-evidence/stage-4-partial-laboratory-20261014.json`.

> Corte anterior de etapa 4: Sol aceptó funcionalmente S05, S15, S20, S24, S25, S33 y S40. S25
> recibió seis pruebas focales independientes, incluyendo StrictMode, cruce de
> año, cambio de día ART, recuperación de visibilidad, limpieza de listeners y
> cambio de actor. Suite integrada previa: 606/606 en 66 archivos; TypeScript,
> builds cliente/Worker, `git diff --check` y Edge principal/correcciones pasan.
> S33 quedó aceptado funcionalmente por revisión independiente de Sol (36/36 probes). S40 quedó aceptado tras corregir la validación del historial v2 en respaldos; S41 aceptado por fecha ART y selección estable; S42 aceptado por avisos de disponibilidad, dependencias y seguimiento con 18/18 probes independientes. S48/S52 siguen abiertos; S48 incluye ajustes separados en inducción. La suite integrada actual pasó 620/620 en 66 archivos; TypeScript, cliente/Worker, Edge principal/correcciones y `git diff --check` pasan. Edge sin errores JS ni llamadas operativas. Avance global ~45%,
> sin cambio. Sin commit, PR, publicación, cuentas ni despliegue. Evidencia:
> `docs/architecture/review-evidence/stage-4-partial-laboratory-20261014.json`.

> Registro de etapa 2 — 14/10/2026 (histórico; ver estado vigente arriba):
> **etapa 2 aceptada por revisión funcional
> independiente de Sol**. El corte vigente suma 588/588 pruebas en 65 archivos;
> TypeScript, build cliente, Worker, `git diff --check`, recorridos Edge y
> benchmark aprobado (p95 591,87 ms para 24 perfiles/2.000 tareas) pasaron.
> Los recorridos registraron cero errores JavaScript y cero llamadas a API
> operativa. La cuota física de disco no se agotó; se probó abortar una
> transacción IndexedDB real. Lector de pantalla continúa como gate posterior.
> Etapa 1 sigue aceptada; etapas 3–7 y aceptación global abiertas. Avance
> orientativo ~45%, sin cambio. Sin commit, PR, actualización del Site, cuentas,
> API ni despliegue. Evidencia completa: `docs/architecture/review-evidence/
stage-2-final-acceptance-20261014.json`.

> Próximo bloque en ese corte: revisar y terminar etapa 3 (S04/S12/S19/S22/S26/S35/S61)
> contra el código actual y sus casos adversos. El archivo fechado 12/10 es
> evidencia parcial anterior, no dictamen de aceptación. Mantener límites entre
> laboratorio, D1 y SQL; no tocar migraciones históricas ni conectar servicios.

> Actualización 13/10/2026 — **etapa 1 aceptada por revisión independiente
> Sol** para S02/S06/S14/S17/S18/S21/S23/S27/S28/S34/S43/S47/S50/S53.
> En el corte final: 565/565 pruebas en 62 archivos, 93/93 pruebas focales,
> TypeScript, compilaciones de cliente/Worker y ambos recorridos Edge aprobados;
> cero errores JS y llamadas a API operativa en navegador. Sol registró una
> corrida a dos workers de 174/178 con cuatro esperas de UI fallidas en dos
> archivos y su repetición estable a un worker de 56/56; no se reprodujeron ni
> se atribuyeron a permisos. El chunk principal sigue en 519,27 kB con aviso
> de Vite. La aceptación se limita a etapa 1. Continúa etapa 2, parcialmente
> implementada y sin aceptación; etapas 3–7 y aceptación global siguen abiertas.
> Avance global orientativo ~45%, sin recalcular. Sin commit, PR, actualización
> de Site, cuentas ni API; laboratorio privado. Evidencia: `docs/architecture/
review-evidence/stage-1-final-acceptance-20261013.json`.

> Actualización 13/10/2026 — bloque 2A de etapa 2 aceptado por Sol, alcance
> S09/S16/S65 y estado durable de evidencia. La revisión pidió que la prueba
> de inyección alcanzara labRevision en vez de un ID de notificación; la
> fixture se aisló y su corte focal pasó 23/23.
> Se implementaron guardado durable de evidencia, revisión de estado entre
> pestañas, coordinación de
> adjuntos/restauración y manejo de resultados inciertos. Validación vigente:
> 579/579 pruebas en 65 archivos; 25/25 focales; TypeScript, builds directos
> de cliente y Worker y recorrido Edge final2 aprobados. Edge abortó una
> transacción IndexedDB nativa y verificó metadata/blobs intactos y reintento
> habilitado; no indujo cuota física del disco. El comando `pnpm run build`
> quedó bloqueado por scripts de esbuild ignorados; se ejecutaron y aprobaron
> sus pasos equivalentes directamente. La revisión final independiente de Sol
> etapa 2A aceptada; etapa 2 completa sigue abierta. Quedan además los
> casos adversos restantes de IndexedDB y los requisitos integrados,
> lector de pantalla y benchmark. Sin commit, PR, actualización del Site,
> cuentas ni API operativa. Avance global orientativo ~45%, sin recalcular.
> Evidencia: `docs/architecture/review-evidence/
stage-2-evidence-durable-20261013.json`.

> Actualización de continuación — 13/10/2026: etapa 1 revalidada localmente;
> sus 14 hallazgos siguen pendientes de revisión independiente de Sol. Tras
> añadir pruebas de privacidad de Planificación y cancelación de fechas, la suite
> completa queda en 547/547 en 60 archivos; TypeScript y builds cliente/Worker aprobados. Los recorridos
> Edge general y correcciones pasaron sin errores JavaScript ni llamadas a la
> API operativa. El build cliente conserva el aviso de chunk principal mayor a
> 500 kB. La etapa 2 mantiene trabajo local parcial sin aceptación; también hay
> correcciones parciales de cierres/historia S04/S12/S19/S22/S26/S35/S61, sin
> aceptar etapa 3. Próximo: revisión Sol de etapa 1. Sin commit, publicación ni
> cuentas. Evidencia de revalidación:
> `outputs/stage-1-permissions-20261013/stage1-rerun-20261013.json`.

> Actualización 13/10/2026 — etapa 2: se amplió la validación de backups S03
> para datos malformados v1/v2 y de S65 en el flujo integrado de actividad:
> escritura confirmada aunque arroje excepción, rechazo seguro con compensación,
> y resultado indeterminado que conserva el archivo. Suite completa actual
> 553/553 en 61 archivos; 76/76 en las seis pruebas focales. TypeScript,
> compilación cliente/Worker y `git diff --check` pasaron. No equivale a aceptar
> etapa 2: faltan intercalados posteriores al guardado, errores físicos de
> IndexedDB en navegador, el resto de casos adversos, lector de pantalla y
> benchmark de esa etapa. Ver `docs/architecture/review-evidence/stage-2-partial-laboratory-20261012.json`.
> No hubo commit, publicación, cuentas ni llamadas a API operativa.

> Corte previo de etapa 2 — 12/10/2026: 527/527 antes de las pruebas agregadas después. La evidencia vigente de implementación está en el bloque de continuación anterior y en el JSON parcial. Los 65 hallazgos/95 casos continúan abiertos hasta corrección y revisión según contrato; etapas posteriores no se declaran aceptadas. Producto no aceptado. Sin commit, publicación, cuentas ni API. Avance global orientativo ~45%, sin recalcular.

Auditoría integral de Sol y su detalle: `docs/architecture/SOL-AUDIT-20261008.md`.
Sesenta y cinco hallazgos cuentan con noventa y cinco casos reproducidos: proyección remota, seguimiento
comercial, respaldo/jerarquías, historia, calendario, comentarios, previews y
dependencias huérfanas al revisar recurrencias, cupo bloqueado tras restaurar y
arranque impedido cuando falla la escritura local y selección de respaldo con
lecturas tardías, omisión del tiempo/unidades de cobertura en cierres y
ejecución jerárquica indebida en el backend separado y avisos de calendario tras
retirar destinatarios, falta de editor de coeficientes para operativas puntuales
y rechazo sin manejar al fallar la compensación de adjuntos operativos y
título de dependencia fuera del ámbito visible en la hoja de ruta y
presencia simulada del encargado expuesta al empleado y meta operativa antigua
exportada en CSV de cierres nuevos y fecha imposible aceptada en mejora de procesos,
consulta después de revocar empresa, adopción que modifica tarea de unidad cerrada
y denegación del ámbito organizacional de jefatura en obligaciones y origen
de obligación que permanece oculto tras abrirlo desde calendario y fecha
anterior conservada en avisos al cruzar medianoche argentina y cronómetro de
cobertura que sigue abierto después de la baja del reemplazo.
No se modificó el producto con estos hallazgos ni se cerró la auditoría completa.

Bloque posterior: referencias de empresas al editar perfiles (S27), ausencia sin cobertura rechazada al encargado (S28), pérdida de borradores de Consultas al fallar guardado (S29) y RPC SQL histórica de espera sin argumento de motivo (S30). Contraste lector/gateway contra 011: 13/14 aprobadas, discrepancia aislada en S30. Comentarios operativos privados contra 011: 12/12 aprobadas. Inventario de permisos efectivo: 84 funciones/37 tablas, sin DML directo authenticated; límites y dos triggers con ACL por defecto documentados. No se volvió a ejecutar suite completa ni build en este bloque; no hubo implementación de producto, commit o despliegue.

## Registro histórico de estado — 08/10/2026

**No están terminados y aceptados todos los cambios del proyecto.** La evolución desde cierres inmutables y los filtros de la hoja de ruta de Mi día ya están implementados, con pruebas en `closed-history-lab-20261008.json` y `mi-dia-route-filters-lab-20261008.json`; el listado de pendientes del registro previo de correcciones corresponde a un corte anterior. En los avances recientes alineé el estado visual del cierre con la atomicidad de grupos conjuntos, bloqueé activar una tarea si el segundo responsable ya cerró esa empresa, bloqueé reasignaciones/traspasos a empresas cerradas para la persona receptora, exigí jefatura activa para editar perfiles o recurrencias y apliqué el requisito de jefatura activa al cierre mensual del dominio. También alineé la consulta de tareas conjuntas y sus notificaciones con el acceso organizacional de jefatura, aunque no haya membresía directa de la empresa. Añadí reprogramación puntual para jefatura y encargados autorizados, con motivo y aviso al responsable, preservando el vencimiento y la regla recurrente. Vinculé evidencia de tarea con su finalización, reforcé el límite de tres archivos mediante transacción IndexedDB por registro y extendí el control plegable a todos los paneles inventariados. Los respaldos v2 conservan identidad de tarea/movimiento para que el límite siga vigente tras restaurar, con compatibilidad para copias v2 anteriores. Se conserva la explicación desplegable del orden de Mi día y la presencia con caducidad a 90 segundos; en el laboratorio sigue simulada.

Validación repetida el 08/10: **500/500 pruebas en 58 archivos**, TypeScript aprobado. El hook pre-commit pasó **130 pruebas rápidas** y ahora rechaza archivos rastreados con cambios staged y posteriores sin stage; su regresión ejecuta el hook en un Git temporal y confirma que aborta antes de otras comprobaciones. `package.json` y `package-lock.json` coinciden. El build de cliente y Worker y el paquete Sites local están aprobados; la CI de GitHub aún no se ejecutó porque la cuenta/repositorio propios no se crearon. La entrada principal de cliente quedó en **486,52 kB**; reprogramación se carga en su chunk de 1,38 kB. Los cuatro recorridos Edge generales, de correcciones, tareas conjuntas y respaldo/restauración pasaron; el recorrido de correcciones se repitió después del ajuste de Anotaciones. Cero errores JavaScript y cero llamadas a la API operativa. Auditoría de contraste: 76 combinaciones de perfil, tema y sección; 5.943 textos evaluados, cero omitidos, cero fallos y cero muestras truncadas de gradientes. Auditoría accesible automatizada: 38 rutas, 2.124 controles del árbol de Chromium sin nombres faltantes, 877 paradas de teclado y cero problemas de foco según la heurística. Ninguna de estas verificaciones reemplaza la aceptación con lector de pantalla ni certifica WCAG. Benchmark local: p95 **324,99 ms** en 30 navegaciones calientes con 24 perfiles/2.000 tareas. Evidencia de esta repetición: `continuation-validation-lab-20261008.json`; resultados de navegador en `outputs/continuation-validation-20261008/`.

Benchmark local repetido: 24 perfiles y 2.000 tareas ficticias, p95 **324,99 ms** en 30 navegaciones calientes, frente al objetivo de 1.000 ms. La entrada principal del build cliente quedó en **486,52 kB**; validación Zod está en un chunk separado de **94,82 kB** y gráficos en **423,74 kB**. No aparece el aviso de chunks sobre 500 kB; siguen avisos no bloqueantes de anotaciones de comentarios de Zod.

La presencia conectada se probó con reglas de dominio y componente; no se probó con cuentas/sesiones reales. Edge confirmó que dos cargas simultáneas de dos archivos al mismo registro permiten una sola escritura válida cuando se alcanzaría el límite y que una evidencia restaurada se contabiliza contra el límite. También pasó el recorrido de descarga, validación, rollback por cuota y restauración tras la actualización de IndexedDB. La auditoría de contraste cubre 5.943 textos sin omisiones ni fallos; sigue sin reemplazar la aceptación con lector de pantalla. Quedan esa aceptación asistida y la aceptación integral del producto y servicios propios. No hay commit, PR, publicación ni cuentas conectadas. El laboratorio sigue privado. **Avance global orientativo: ~45%, sin cambio.**

Siguiente paso: GPT-6.1 Sol, esfuerzo alto, Standard, para revisar el corte y las nuevas validaciones de evidencias, historia y permisos frente al contrato; luego GPT-6 Luna, esfuerzo medio, Standard, para cerrar los faltantes identificados. El pendiente de accesibilidad que requiere interacción humana es la aceptación con lector de pantalla. Mantener los servicios desconectados hasta aceptar el producto. Este proceso no cambia el modelo automáticamente.

Evidencia: docs/architecture/review-evidence/continuation-ui-presence-performance-lab-20261008.json, `evidence-archive-backup-lab-20261008.json` y `contrast-audit-gradient-lab-20261008.json`; navegador y auditorías: outputs/plan-validation-20261008/edge-continuation-split-chunks/, outputs/plan-validation-20261008/edge-continuation-accessibility/, outputs/plan-validation-20261008/contrast-audit-final3/, outputs/plan-validation-20261008/evidence-record-limit-final3/ y outputs/plan-validation-20261008/edge-evidence-concurrency-final3/; benchmark: outputs/plan-validation-20261008/performance-continuation-final/navigation-benchmark.json.

## Registro anterior de continuidad — 08/10/2026

Este registro fue reemplazado por el cierre de revisión que aparece arriba. Las métricas de 465 pruebas y el estado de revisión pendiente corresponden a un corte previo; la evidencia más reciente registra 474/474 en la segunda ejecución completa y revisión independiente de Sol. No usar ese bloque histórico como estado actual.

## Revisión inicial del plan — 07/10/2026 (histórico)

**No están todos los cambios implementados de forma completa y compatible.**
La revisión independiente del árbol local reprodujo ocho discrepancias de
dominio y tres de interfaz en Edge. Entre ellas: consulta sin restricción por
empresa, dependencias sin bloqueo de ejecución, reprogramación dentro de una
empresa cerrada, cierre conjunto parcial, cronómetro de cobertura ignorado,
respaldo incompatible aceptado, métricas vacías en Mi día, rechazo de gestión
del jefe y cálculo de operativas contra cuotas en reportes nuevos.

También quedan incompletos historia desde snapshots, recorrido guiado con
oscurecimiento/foco, partes del calendario, presentación del selector y la
coordinación de escrituras asíncronas de evidencia. La revisión corrigió el
estado/documentación y registró evidencia; no editó el código del producto.

Informe y matriz de cobertura: `docs/architecture/PLAN-REVIEW-20261007.md`.
Contrato listo para **GPT-6 Luna, esfuerzo medio, Standard**:
`docs/architecture/PLAN-CORRECTIONS-NEXT-20261007.md`. Después corresponde
**GPT-6.1 Sol, esfuerzo alto, Standard**, para revisar las correcciones.

La suite anterior de 442 pruebas y su benchmark siguen siendo evidencia de los
flujos que cubrían; no acreditan los casos adversos nuevos. Esta revisión
ejecutó ocho probes y un recorrido Edge con tres comprobaciones nuevas, sin
llamadas API ni errores JavaScript. Los resultados están en
`docs/architecture/review-evidence/plan-review-domain-20261007.json` y
`docs/architecture/review-evidence/plan-review-browser-20261007.json`.

**Avance global orientativo: ~45%.** Corte sin commit ni actualización del Site;
producto todavía no aceptado. Mantener cuentas y servicios reales pospuestos.

## Registro de implementación anterior — 07/10/2026

La descripción siguiente corresponde al registro previo a la revisión. Su
afirmación de cobertura general queda acotada por los hallazgos vigentes arriba.

Se implementó localmente el contrato registrado en
`docs/product/CORRECTIONS-20261006-LABORATORY.md` y el plan aprobado en esta
sesión. La base previa era `2c3fbfe`; los cambios actuales continúan sin commit
y todavía no se actualizaron al Site. La audiencia y la infraestructura no se
modificaron.

El bloque incluye: separación de entregables, carga y calidad operativa;
coeficientes de movimiento versionados; seguimiento comercial 0–30 y tareas
dependientes con hoja de ruta sugerida; cierre por persona/empresa/mes con
alcances seleccionables; calendario y avisos locales; evidencia opcional con
respaldo versión 2; presencia simulada por equipo; y revisiones de permisos del
laboratorio. La interfaz integra paneles plegables, selectores buscables,
series y distribución seleccionables, tooltips legibles, mejor presentación de
arrastre, navegación adaptable y recorrido contextual.

### Validación local

- **442/442 pruebas aprobadas en 109 archivos**.
- TypeScript, compilación cliente Vite y compilación Worker/D1 aprobadas.
- Cuatro recorridos Edge: general/móvil; responsive, accesibilidad de
  interacción y solicitudes internas; tareas conjuntas/cierres/reportes; y
  respaldo/restauración con evidencia. Cero errores JavaScript y cero llamadas
  a la API operativa en los recorridos.
- Rendimiento local con 24 perfiles y 2.000 tareas ficticias: p95 de navegación
  caliente **399,35 ms** frente al criterio de menos de 1.000 ms. Diez ciclos,
  30 cambios de ruta, Edge 154 en Windows, Intel i3-N305, 1440×900. Sin errores
  JavaScript ni llamadas a la API. Esto no representa hosting real,
  concurrencia ni carga de producción.
- Vite mantiene un aviso de tamaño: entrada principal **554,46 kB** (gzip
  167,34 kB) y chunk de gráficos **423,74 kB** (gzip 121,39 kB). No se ocultó
  el aviso ni se fragmentó más el bundle dentro de esta etapa.

Evidencia consolidada: `docs/architecture/review-evidence/plan-implementation-lab-20261007.json`.
Capturas y salidas detalladas de navegador/rendimiento: carpeta externa
`outputs/plan-validation-20261007` del workspace.

### Límites y siguiente gate

Los datos y archivos son ficticios y locales. No se probó autenticación real,
MFA, RLS, invitaciones, persistencia entre dispositivos, notificaciones
transaccionales ni almacenamiento remoto. La presencia es demostrativa. La
validación de accesibilidad es de los recorridos cubiertos, no una auditoría
WCAG completa con lector de pantalla. El 100% de alcance aún exige revisión
integral y aceptación final sin correcciones conocidas.

**Avance global orientativo: ~45%; esta implementación y sus pruebas no elevan
la estimación hasta superar la revisión de producto.** Sigue pendiente todo el
tramo de cuentas propias, GitHub, Supabase dev/producción, hosting y entrega
automatizada. El código sigue sin commit y el mismo Site privado no se actualizó.

**Próximo gate: GPT-6.1 Sol, esfuerzo alto, Standard**, para revisar este
conjunto contra el contrato, especialmente permisos y privacidad, cálculos,
cierres, dependencias, calendario y recuperación de evidencia. Si la revisión
encuentra correcciones, volver a **GPT-6 Luna, esfuerzo medio, Standard** para
resolverlas y repetir la aceptación afectada. Después de una revisión limpia se
podrá preparar el commit y actualizar el mismo Site privado, sin conectar
cuentas ni ampliar audiencia. El modelo activo no se puede cambiar desde esta
ejecución; no se atribuye el trabajo a Luna sin verificar el selector del
entorno.

### Evidencia anterior

La revisión del commit `a69fbd4`, Site v92 y los antecedentes documentales se
conservan en las secciones históricas inferiores y en los JSON allí citados.

## Registro histórico del laboratorio — 06/10/2026

## Verificación del corte funcional v78 — 07/10/2026

El commit `a15448f5fdf47675b8a14f6da881d34892790c12` está publicado en el
Site existente como v79. La audiencia sigue personalizada y exclusiva del
propietario: una cuenta autorizada, cero grupos y cero visitantes externos.
Los cambios v76–v79 fueron de configuración de pruebas, documentación y
transferencia; no modificaron funcionalidades. Sobre el mismo código pasaron
420/420 pruebas en 48 archivos, pre-commit 104/104, TypeScript, Vite, Worker y
cuatro recorridos Edge desktop/móvil sin errores JS ni llamadas a `/api`.
Prettier pudo parsear `.github/workflows/validate.yml` como YAML.

La prueba sintética con 24 perfiles mostró 24 filas en 512 ms desde la
selección de Equipo. Es una línea base, no un criterio de aceptación acordado.
Siguen pendientes la navegación de teclado de extremo a extremo, el umbral
formal para 20+ perfiles y la concurrencia entre pestañas/dispositivos. No se
probó Auth/MFA/RLS real ni recuperación productiva. Avance global orientativo:
45%, no 100%.

La guía de transferencia está en `outputs/LEEME-PC-PERSONAL.md`; el bundle y
ZIP vigentes se entregan junto al checkout, generados desde el SHA final. El
bundle se verificó clonando y comparando HEAD. `npm run hooks:install` se probó
en un clon temporal y activó `.githooks`, ya que `core.hooksPath` es local al
checkout y no viaja dentro del bundle. El estado `paris-state-lab` del
navegador no está en Git ni en el ZIP: exportarlo aparte desde «Vista de
prueba». El registro v68 está marcado como histórico en
`docs/architecture/STATE-REVIEW-20261007.md`.

Las publicaciones v79–v80 fueron documentales; la versión viva y el SHA más
reciente se verifican en Sites y en el `HEAD` limpio del checkout, no en este
registro del corte funcional.

**Avance global orientativo: aproximadamente 45%.** Referencia de planificación; no equivale
a aceptación ni se calcula a partir de tests. No está al 100% ni lista para
migrar empleados. El usuario exige terminar la versión final antes de crear
cuentas o enviar invitaciones reales.

## Entrada de esta etapa

El mismo Site vuelve a abrir el laboratorio con usuarios y datos ficticios.
No conecta la UI a /api/workspace ni importa datos operativos. El backend D1
recuperado sigue en el repositorio como ruta separada futura. SQL 001–011
permanece independiente y sin aplicación remota desde este chat.

Correcciones: menú sin barras internas/cortes, logo más grande y completo,
selector de simulación, invitaciones ficticias con perfiles preconfigurados,
aviso de parametrización para jefatura y control de plegado por icono.
Contrato y evidencia: product/CORRECTIONS-20261006-LABORATORY.md.

## Verificación

339 pruebas aprobadas en 33 archivos; compilación y diff-check aprobados.
Chromium local: escritorio/móvil, alta simulada de seis pasos, logo, menús,
tarjetas, aviso y persistencia; cero solicitudes a la API operativa y errores JS.
SQL 011 conserva su evidencia local previa: 26 carreras PostgreSQL aprobadas.

## Pendientes para la versión final

- Completar y aceptar funcionalidades del alcance original: conjuntas/cuotas,
  cobertura precisa y jerarquía multiarea en el backend activo; bajas/huérfanas,
  agenda/cumplimiento, consultas y procesos operativos pendientes.
- Revisar equivalencia de frontend, reglas, snapshots y privacidad al elegir
  la ruta definitiva D1 o Supabase. No mezclar sus esquemas o KPI.
- QA visual y funcional del producto completo, volumen, recuperación productiva
  y ensayo controlado del circuito final. Hay copia/restauración local del
  laboratorio; no cubre respaldo remoto ni recuperación de producción.
- Sólo tras aceptar versión final: configurar cuentas e invitaciones reales,
  MFA y servicios; piloto autenticado e infraestructura dedicada/migración.

## Continuidad

Repositorio y commits originales recuperados; no leer/esperar el chat viejo.
Sol6.1 alto para razonar/planear/revisar próximos contratos; Luna6 medio para
implementarlos. No simular cambio de modelo ni delegación.

## Definición final de avance

Avance global aproximado: 45%. El 100% incluye GitHub propio, Supabase dev/producción y hosting funcionando, con entrega automática verificada y todas las correcciones conocidas cerradas. Ver ops/FINAL-ACCEPTANCE.md. Primero aceptación funcional del laboratorio; después configuración e integración de infraestructura. No enviar invitaciones reales ahora.

## Correcciones de marca y notificaciones

Logo alineado y centrado sin leyenda, cabecera compacta, campana para todos los perfiles y comentarios de tareas en laboratorio. Avisos de asignación, cambios, finalización, comentarios y activación conjunta; lectura persistente por destinatario. La entrega transaccional y los avisos entre computadoras siguen pendientes de servidor. Ver product/CORRECTIONS-20261006-NOTIFICATIONS.md.

Verificación de este bloque: 339/339 pruebas en 33 archivos, build aprobado y Chromium escritorio/móvil aprobado con cero errores JS y cero llamadas a /api. Fuente y publicación privada del mismo Site; sin cambiar audiencia.

## Contrato conjunto — estado histórico actualizado

El contrato de architecture/JOINT-LABORATORY-CONTRACT-20261006.md ya está implementado en el laboratorio local, con límites y validaciones vigentes descritos en la sección posterior «Tareas conjuntas del laboratorio». No modifica SQL011 ni el backend.

## Tablero movible — 06/10/2026

Entregables arrastrables entre estados, orden antes/después y persistencia de orden manual. Cambio respeta transition(): iniciar abre sólo cronómetro del actor, completar requiere pasos y espera liberada, reapertura aumenta contador. Teclado Alt+flecha izquierda/derecha. Evidencia suite 341/341, build y Chromium con cero llamadas API operativa/errores JS.

## Tareas conjuntas del laboratorio — 06/10/2026

Implementación local para una ocurrencia puntual, dos participantes y cuotas
selladas. Incluye validación/idempotencia, snapshots, acceso acotado por miembro,
cronómetros paralelos por actor, métricas individuales/globales, cierre separado,
reporte v2 compatible con reportes v1 y aviso `joint`. UI de activación y tarjetas
en tableros personales integradas. Contrato y límites:
`architecture/JOINT-LABORATORY-CONTRACT-20261006.md`.

Verificación vigente: 348/348 pruebas en 34 archivos y 74 suites, build y recorrido Chromium
de activación 60/40, aviso, relojes A/B y pausa individual; recorrido general
Chromium desktop/móvil también pasa. Ambos: cero errores JS y cero solicitudes
a `/api`. Pendiente: ensayo UI del cierre v2 y aceptación visual con estado real.
La simulación usa localStorage de un navegador; no prueba colaboración entre
computadoras ni aislamiento Auth/RLS. No se conectó cuenta/API ni se aplicó
migración. El avance global orientativo permanece alrededor de45%; esto no
completa la aceptación funcional total ni la infraestructura del 100%.

## Cobertura selectiva en laboratorio — 06/10/2026

La vista de ausencias ahora limita acceso a tareas puntuales y reglas recurrentes
que el responsable selecciona. Previsualiza fechas con la misma regla de
materialización; las ocurrencias futuras reciben acceso al crearse sin duplicar
tareas. Encargados quedan restringidos a su equipo y jefatura puede coordinar
cruces. Cancelación y vencimiento revocan acceso y cierran sólo el reloj del
reemplazante. Contrato y límites:
`architecture/COVERAGE-LAB-CONTRACT-20261006.md`.

Validación de esta etapa: 353/353 pruebas en 34 archivos, build aprobado,
formulario puntual/recurrente probado en jsdom. Chromium general escritorio y
móvil: cero errores JS y cero llamadas operativas a `/api`. Quedan pendientes
los cierres/exportaciones, traspasos y bajas/reasignaciones. No modifica el
avance global (~45%) ni habilita usuarios reales.

## Baja y reasignación de laboratorio — 06/10/2026

La jefatura puede registrar una baja con motivo, siempre que primero haya
resuelto subordinados activos. Se conserva el perfil, tareas cerradas y cierres;
se pausan reglas recurrentes y los relojes del usuario afectado. Las tareas
abiertas quedan en una bandeja con snapshot de perfil/empresa/asignación/frecuencia
y motivo. También se cancelan sus coberturas activas y se detienen los relojes
de reemplazantes para revocar permisos temporales. Sólo el trabajo futuro pendiente
sin sesiones, actividad o responsabilidad conjunta permite reasignación directa,
y se vuelve a validar al confirmar. Las tareas iniciadas quedan como
`handoff_required`; fechas vencidas/sin fecha requieren revisión manual.
Rehabilitar un perfil no revive reglas antiguas.

Contrato: `architecture/PROFILE-DEACTIVATION-LAB-CONTRACT-20261006.md`.
El flujo funciona sólo en `paris-state-lab`; la baja del Worker/D1 no se ofrece
porque el backend aún no tiene este contrato. La implementación local del
traspaso explícito de trabajo iniciado se documenta en la sección siguiente;
portarla al backend exige revisión de permisos.

## Traspaso de tarea iniciada — 06/10/2026

Jefatura puede transferir una tarea no conjunta desde la bandeja de bajas a una
persona activa con acceso a la empresa. El formulario exige motivo y vuelve a
validar estado, alcance y cierres. Se conserva la misma tarea, el estado previo
completo, sesiones, actividad y comentarios; el reloj del perfil dado de baja se
cierra antes de transferir. El informe de cierre y CSV muestran la cadena de
responsables y el motivo. El tiempo queda atribuido al actor de cada sesión, sin
heredar horas. Tareas conjuntas requieren revisión manual por sus cuotas y
cierres separados.

Verificación: **360/360 pruebas en 35 archivos**; TypeScript, Vite y bundle
Worker aprobados. Chromium de correcciones desktop/móvil y recorrido conjunto
aprobados; ambos con cero errores JavaScript y cero solicitudes a `/api`.
Persistencia local validada. Esto no sincroniza computadoras ni implementa el
traspaso en D1/Supabase.

El avance global orientativo sigue en **45%**: las pruebas aprobadas no equivalen
a aceptación final. La próxima fase es auditar cierres/exportaciones y probar
reglas diarias, semanales y en varios meses. La fase de traspasos ya está en el
Site privado versión 52, con fuente
`c7fb09ac0b4875079b3bea30c2ec60c42745d323`. La auditoría posterior
detectó y corrigió que la validación de la bandeja de bajas no aceptaba la
frecuencia diaria aunque el planificador la admite. Se añadieron pruebas de
persistencia diaria, materialización a través de dos meses y aviso de nueva
asignación al receptor y su encargado. El Site privado versión **53** publicó
el commit `e7fc01334dc8b8aaab261d0cb52ba97401830935`; fuente y versión se
confirmaron en Sites. Verificación local del código: **362/362 pruebas en 35
archivos**, TypeScript, Vite y Worker build aprobados. Chromium desktop/móvil
aprobado con cero errores JS y cero solicitudes a `/api`. La audiencia se
mantiene personalizada y sólo incluye al propietario.

Verificación del corte: 358/358 pruebas en 35 archivos con timeout ampliado
para migraciones históricas; TypeScript, build Worker y Chromium desktop/móvil
aprobados. En Chromium no hubo errores JS ni llamadas a `/api`. El test de
interfaz específico recorre motivo, baja, bandeja y reasignación; persistencia
valida el snapshot de baja. La implementación sigue siendo sólo laboratorio.

## Cierres y exportaciones de laboratorio — 07/10/2026

La tabla mensual ahora incluye las tareas conjuntas para cada miembro y usa
métricas atribuidas a su cuota. El CSV de cierre distingue peso global de cuota,
puntos posibles/obtenidos y tiempo personal; no replica la ponderación completa
como si fuera individual. `closeMonth` también rechaza a quien tenga el perfil
inactivo. Sólo afecta al laboratorio local y conserva los snapshots históricos.

Verificación local: **365/365 pruebas en 35 archivos**, TypeScript, build Vite,
bundle Worker y Chromium de correcciones aprobados. El recorrido Chromium cubrió
escritorio/móvil, arrastre, notificaciones, persistencia y simulación; cero
errores JavaScript y cero llamadas a `/api` operativa. El Site privado v54 publicó
el commit `608fb478bb5b8010c22431451b92fd664f424b65`; deployment confirmado como
exitoso en el mismo URL. La audiencia continúa personalizada y sólo permite al
propietario. El avance global sigue cerca de **45%**; no aumenta por pasar pruebas.

## Empaquetado portable de Sites — 07/10/2026

Se agregó `scripts/package-site-archive.mjs` y el comando `package:site` para
evitar depender de Bash en Windows. Verifica identidad del Site, Worker,
cliente y migraciones D1 dentro de `dist/` antes de entregar el tar. Prueba local
del helper: archivo de 745.693 bytes, SHA-256
`f49a7f519ce0f48968e61ca0e27ff47a1474c73fe842a3097fd418b722bbc8f7`, una
migración y `project_id` correcto. Es tooling de entrega; no altera lógica de la
aplicación ni crea cuentas. La versión de aplicación al validar el helper era v55.

## Consultas y pedidos internos — laboratorio local — 06/10/2026

Se agregó `Consultas y pedidos` sólo a la vista privada de laboratorio. Los
errores técnicos van a una cola de soporte simulada; los pedidos de trabajo a
Juan Pablo; las sugerencias exigen elegir un jefe o encargado. Autor, destinatario
y perfiles con rol jefe pueden consultar; sólo destinatario/jefatura responde o
cambia estados. Se guardan mensajes e historial completo con estado nuevo, en
revisión, respondido o resuelto; los abiertos se ordenan por urgencia y fecha, y
el filtro “Abiertos primero” conserva también los resueltos para que el autor
pueda leer la respuesta. Filtros de tipo, autor y estado.

La colección opcional es compatible con datos de laboratorio anteriores. Los
pedidos no generan tareas, actividad ni KPI. No se implementaron capturas,
notificaciones entre dispositivos, correo, cuenta de soporte ni conversión en
tarea; esta función no sincroniza entre equipos ni acepta información real de
clientes. Backend y permisos productivos requieren revisión Sol antes de portar.

Verificación del corte: **371/371 pruebas en 36 archivos**; TypeScript, Vite y
bundle Worker compilados. Chromium Edge recorrió creación por empleado,
seguimiento/respuesta/resolución por jefatura y lectura posterior por el autor;
probó anchos de 1440×900, 1600×740, 1280×720, 1024×650 y móvil, con cero
errores JS, cero solicitudes a `/api` y sin recorte del menú. Durante QA se
corrigieron el espacio de la barra y la visibilidad de casos resueltos.
Evidencia: `architecture/review-evidence/internal-requests-lab-20261006.json`.

El código de este corte se publicó correctamente como **Site v57** desde el
commit `c080a52ce5ca6b6d949be7fa3888e7bf85f1b8a0` en el mismo URL privado. La
audiencia sigue owner-only (cero visitantes externos). El empaquetador del
plugin falló en Windows, pero se verificó HEAD remoto y se publicó el archivo
Worker generado por `scripts/package-site-archive.mjs`.

El avance global se mantiene en **~45%**; una función local aprobada no satisface
la aceptación completa ni la infraestructura del 100%.

## Ciclo de trabajo mensual — laboratorio local — 06/10/2026

Se implementó en Análisis mensual una vista diaria/semanal de carga planificada
y ejecución registrada, con filtros existentes y desglose por persona, equipo,
sector o empresa. La planificación usa `scheduledOn`; no sustituye esa fecha por
el vencimiento. Las tareas conjuntas cuentan una ocurrencia global y reparten
puntos previstos por su cuota. Las sesiones se dividen por día calendario de
Argentina; las actividades operativas se atribuyen a quien las registró y sus
cantidades se muestran separadas por unidad.

Las nuevas finalizaciones del laboratorio guardan `completedBy`, sin cambiar la
versión del esquema local ni reconstruir actores de cierres históricos. Los
cierres antiguos sin actor quedan expresamente sin atribución. Los días sin
registros se identifican como falta de evidencia: no se deduce tiempo libre ni
capacidad laboral. El módulo aparece sólo en laboratorio privado, lee los datos
ficticios/locales existentes y no hace llamadas al API operativo.

Verificación: **378/378 pruebas en 37 archivos**, TypeScript, Vite y bundle
Worker aprobados. Chromium Edge verificó agrupación día/semana, los 31 días de
octubre, cambio a equipo, escritorio y móvil 390×844; cero errores JS, cero
llamadas a `/api` y sin desbordamiento horizontal de página. Test focal:
`tests/work-cycle.test.ts`; recorrido: `tests/browser-corrections.cjs`; evidencia:
`architecture/review-evidence/work-cycle-lab-20261006.json`.

La función no activa colaboración entre computadoras, Auth, D1 ni Supabase. El
avance global sigue orientativamente en **~45%**; no equivale a aceptación final.
El código quedó publicado como **Site v58**, desde el commit
`c41bb7a9f9dcee2408b1b714af440f89914814dd`, deployment
`appgdep_6ac5ab6391708191a3df327efb304ac2`, en el mismo URL privado. Confirmación
final: deployment exitoso, sólo una cuenta owner permitida y cero visitantes
externos. La corrección documental de este estado no modifica el código de la
aplicación.

## Mejora Kaizen, revisiones 5S y versiones de catálogo — 06/10/2026

Se agregó `Mejora de procesos` sólo al laboratorio. Kaizen conserva problema,
base, meta, evidencia y contexto; un encargado o Juan Pablo autoriza una prueba,
el responsable registra la medición comparable y sólo Juan Pablo adopta el
cambio. La adopción crea una versión inmutable del catálogo y actualiza sólo
trabajo futuro todavía intacto; no cambia pesos/KPI ni tareas iniciadas,
completadas o cerradas. Las versiones históricas sin fecha conocida quedan
identificadas como vigencia desconocida, sin inventar una fecha.

Las revisiones 5S exigen las cinco áreas, evidencia, hallazgo/fundamento, acción,
responsable y fecha. El cierre de una acción requiere una evidencia y fecha de
verificación. Ambas funciones guardan datos ficticios sólo en `paris-state-lab`,
no llaman a `/api`, no sincronizan navegadores y no usan documentos reales.

Verificación: **385/385 pruebas en 38 archivos**; TypeScript, Vite y Worker
build aprobados. Edge Chromium recorrió propuesta, autorización, prueba,
medición, adopción/versionado y cierre de acción 5S; revisó la página en 1440,
1600, 1280 y 1024 px, y en móvil 390×844. No hubo overflow horizontal, errores
JavaScript ni solicitudes a la API operativa. Evidencia automatizada:
`architecture/review-evidence/process-quality-lab-20261006.json`.

Este corte quedó publicado como **Site v59** desde el commit
`27918d3f7b311e2a596fa6961fb240b4fdf7b8ee`, deployment
`appgdep_6ac5b2ff99d481919f73e8cff76d16b5`, en el mismo URL. La publicación
terminó correctamente; el acceso sigue personalizado owner-only, con una sola
cuenta permitida y cero visitantes externos. El avance global permanece en
**~45%**; esta función local no satisface aceptación final ni infraestructura.

## Agenda de obligaciones fiscales del laboratorio — 07/10/2026

Se agregó una agenda ficticia por empresa que diferencia período fiscal y fecha
de vencimiento, permite vincular tareas exactas de la misma empresa y deriva el
cumplimiento de esas tareas. La carga y cada corrección conservan la referencia
de origen; las revisiones guardan motivo, fecha, valores anteriores e historial.
Los datos de ejemplo se crean sólo al cargar una versión de laboratorio que aún
no tenía esta colección. No se consultan fechas oficiales, ARCA, correo ni
notificaciones externas, y no se sincroniza entre navegadores.

Verificación: **394/394 pruebas en 40 archivos**, TypeScript, build Vite y build
Worker aprobados. Chromium Edge completó alta, vínculo a tarea, período separado
del vencimiento, revisión e historial; revisó escritorio y móvil y no encontró
errores JavaScript ni llamadas a `/api`. Evidencia del recorrido:
`architecture/review-evidence/fiscal-obligations-lab-20261007.json`.

La corrección del recorrido de navegador fue necesaria porque su selector estaba
cambiando el filtro global en lugar de la empresa del formulario. La versión
privada se actualizó como **Site v60** desde el commit
`85cef4515bebce99c2d829d4a4a1186ab9de8558`, deployment
`appgdep_6ac5ba96fbf48191bcc1b00d32751b54`, en el mismo URL. El deployment
terminó correctamente. La relectura del Site confirmó propietario, una sola
cuenta permitida, cero grupos y cero visitantes externos; no se amplió audiencia.
El avance global permanece orientativamente en **~45%**: esto todavía es
laboratorio local y no implica aceptación final, backend ni colaboración entre
PCs.

## Propuestas de tareas habituales — laboratorio — 07/10/2026

La inducción conserva las propuestas habituales del empleado con el título
original y sus empresas, frecuencias y objetivos. La jefatura puede vincular
cada propuesta con un estándar compatible o crear una versión nueva, definir
peso/sector/controles y aprobarla de forma explícita. También puede solicitar
cambios; el empleado ve el estado y el historial y puede volver a enviarla.
Recién después de la aprobación se generan asignaciones independientes por
empleado y empresa. Las coincidencias son sugerencias: no se fusionan ni activan
solas. Todo permanece en el laboratorio ficticio, sin `/api`, cuentas ni
invitaciones reales.

Verificación: **406/406 pruebas en 94 suites**; pre-commit **96/96 pruebas en 14
archivos**, TypeScript, comprobación de diff y build Vite/Worker aprobados. Los
recorridos Chromium generales y de correcciones aprobaron escritorio y móvil,
incluyendo propuestas, arrastre, persistencia y navegación, sin errores JS ni
solicitudes a `/api`. El build conserva una advertencia de tamaño de chunk
principal (584 kB frente al umbral informativo de 500 kB); no impide compilar.

El código `0ca71bb17da997251155d82d5e83355ab12a5c8c` se publicó en el mismo Site
como **v61**. Confirmación actual: sitio activo, URL existente, usuario actual
con rol propietario, acceso personalizado con una sola cuenta autorizada y cero
visitantes externos. No se cambió audiencia ni se activó el espacio operativo.
El avance global permanece en **~45%**: el laboratorio aún requiere aceptación
funcional y después infraestructura final.

Para trabajar desde una PC personal se preparó una transferencia Git portable
con historial completo de `main`. El bundle no incluye `node_modules` ni el
estado `paris-state-lab` guardado en el navegador; ese estado no sincroniza entre
equipos. Usar una sola copia por vez hasta configurar el GitHub privado previsto
para la etapa final. Instrucciones: `outputs/LEEME-PC-PERSONAL.md`.

## Reportes imprimibles del período — laboratorio local — 07/10/2026

El diálogo de reportes ahora permite imprimir una versión de lectura en A4
horizontal. La impresión muestra sólo el reporte, oculta navegación y controles,
repite encabezados y evita cortar filas entre páginas. La exportación CSV sigue
disponible.

Verificación del commit 389528cbbd6ae1af668931f6bfdd05d499953d13:
**407/407 pruebas en 44 archivos**, TypeScript, build Vite/Worker, pre-commit
**96/96 pruebas en 14 archivos** y los recorridos Chromium generales y de
correcciones aprobados. La comprobación de impresión confirmó el área imprimible
y dejó captura en outputs/period-report-print-browser/period-report-print.png.
No hubo errores JavaScript ni llamadas a /api. Persiste el aviso informativo
del bundle JavaScript principal de aproximadamente 585 kB.

El commit está en el repositorio local. No se confirmó una publicación Site v62;
la transferencia a otra PC no modifica el Site ni su audiencia. El progreso
global sigue orientativamente en **~45%** y no equivale a aceptación final.
La transferencia vigente está descripta en outputs/LEEME-PC-PERSONAL.md.

## Cierre conjunto secuencial y traspaso personal — 07/10/2026

Se corrigió el selector de empleado después de confirmar un cierre mensual:
al cerrar a una persona, la tabla vuelve a mostrar todo el ámbito autorizado,
para poder revisar al siguiente integrante. El recorrido Chromium ahora comprueba
la misma tarea conjunta con cierre A y B por separado, reportes personales v2
60/40, CSV sin nombre ni sesiones del compañero y cronómetros cerrados al
completar la tarea. Todo sigue aislado en el laboratorio local.

Verificación: **407/407 pruebas en 44 archivos** (`vitest run --testTimeout=20000`),
TypeScript, build Vite y build Worker aprobados. Chromium verificó activación,
relojes simultáneos, pausa individual, finalización compartida, cierre A/B y CSV;
cero llamadas a `/api` y cero errores JavaScript. La ejecución estándar inicial
marcó tres límites de 5 segundos en migraciones/UI; los casos pasaron al repetir
la suite completa con timeout de 20 segundos. El build conserva una advertencia
informativa por el chunk principal de ~585 kB.

Evidencia: `architecture/review-evidence/joint-close-lab-20261007.json` y
`outputs/joint-close-acceptance/`. El cambio permanece en `main`; no cambia SQL,
Worker/D1, el espacio operativo, cuentas ni invitaciones. La transferencia
portable actualizada se entrega en `outputs/grupo-paris-site-transfer-20261007.zip`,
con bundle Git e instructivo. El bundle incluye el historial y el commit de este
corte; el laboratorio guardado en `localStorage` no se transfiere. Para trabajar
antes de habilitar GitHub, usar una sola PC a la vez y devolver commits mediante
un bundle de actualización. El avance global sigue alrededor de **45%**.

Publicación confirmada: Site **v62**, commit `8d21e3245c6e4ee93aa741b4c3baf3ddc7b8b608`,
deployment `appgdep_6ac5d2df02ec8191b861bfcee8d98934`, estado exitoso en el URL
existente. La verificación posterior confirmó la versión 62 y su commit fuente;
audiencia personalizada owner-only, una persona permitida, cero grupos y cero
visitantes externos. No se habilitó el espacio operativo ni se conectó Supabase.

## Conversión explícita de pedidos — laboratorio — 07/10/2026

Jefatura puede convertir un pedido de trabajo abierto en una tarea puntual desde
su seguimiento. La conversión exige confirmar una vez y definir responsable,
empresa, fecha, tipo/controles y peso. La autorización vuelve a comprobar perfil
activo, ámbito visible, pertenencia a empresa y período sin cierre. Errores
técnicos y sugerencias no se convierten. El pedido resuelto conserva actor,
fecha e ID de la tarea; la tarea conserva el ID del pedido y presenta su detalle
en la tarjeta. El responsable recibe la notificación de asignación existente.

El pedido por sí solo sigue sin crear trabajo ni alterar KPI. Conversión,
asignación y cierre del pedido se guardan en una sola mutación; la repetición se
rechaza sin duplicar la tarjeta. El alcance continúa local en `paris-state-lab`;
no se agregan servidor, cuenta, adjuntos ni datos de clientes. La producción
necesita revisión de identidad, aislamiento y permisos antes de portar el flujo.

Verificación: **408/408 pruebas en 44 archivos** con timeout de 20 s; TypeScript,
Vite y Worker aprobados. Chromium Edge comprobó que registrar no crea tareas,
jefatura crea una sola tarjeta con responsable/empresa/fecha/peso seleccionados,
se genera la notificación y se conserva el detalle del pedido de origen. Cero
errores JavaScript y cero llamadas a `/api`. Evidencia:
`architecture/review-evidence/internal-request-conversion-lab-20261007.json`;
recorrido y captura en `outputs/requests-conversion-browser/`.

Vite mantiene una advertencia informativa por el chunk principal de ~589 kB; el
build termina correctamente. El avance global permanece orientativamente en
**~45%**: el laboratorio no cubre aceptación completa ni la infraestructura
automática del 100%. El código quedó comprometido en
`f7b4c661d32a753b0ab34f4120c692c880efb8b0` y publicado como **Site v63** en el
mismo proyecto privado; deployment `appgdep_6ac5db13c9608191bd4ab52ee27f33b2`,
estado exitoso. Relectura posterior: rol propietario, acceso personalizado con
una cuenta permitida, cero grupos y cero visitantes externos. El código sigue
siendo sólo de laboratorio; no se activó el espacio operativo ni se conectaron
cuentas de usuarios.

## Búsqueda rápida de tareas — laboratorio — 07/10/2026

El encabezado del laboratorio abre una búsqueda rápida por tarea, empresa,
responsable, sector, estado, período o vencimiento. Ignora tildes y permite
escribir términos en cualquier orden; prioriza trabajo abierto del período
actual y limita la lista inicial a diez resultados. Ctrl+K y `/` abren el mismo
diálogo fuera de campos de escritura. Cada resultado vuelve a verificar
`canWork`; al abrirlo se conserva el perfil que actúa y se ajustan período y
tablero a la tarjeta encontrada.

Verificación: **412/412 pruebas en 45 archivos**, TypeScript, Vite y Worker
aprobados. Chromium Edge recorrió la búsqueda con dos coincidencias accesibles
para un empleado y abrió una de ellas. El recorrido general de escritorio/móvil
terminó sin errores JavaScript ni llamadas a `/api`. Evidencia:
`architecture/review-evidence/quick-task-search-lab-20261007.json` y captura
`outputs/quick-task-search-browser/quick-task-search.png`.

La búsqueda sólo lee el `paris-state-lab` local; no sincroniza dispositivos ni
indexa notas privadas. La advertencia informativa del bundle principal de Vite
(más de 500 kB) continúa abierta. El avance global no cambia: sigue en torno a
**45%**, porque esto no cubre aceptación funcional completa ni infraestructura.
La interfaz se publicó en el mismo Site privado como **v64**, desde el commit
`5ecf94e9439a4d56ceab0990877451b3a5d6ca5a`; deployment
`appgdep_6ac5e1327d7c8191919a40fbf57b4b96` terminó correctamente. Relectura:
propietario, acceso personalizado con una cuenta permitida, cero grupos y cero
visitantes externos. No se activó el espacio operativo ni se conectaron cuentas.

## Aviso de tarea conjunta y accesibilidad de diálogos — laboratorio — 07/10/2026

La activación desde la interfaz ahora queda aceptada de punta a punta: cada
persona autorizada distinta del actor recibe un solo aviso; el nuevo integrante
lo ve en la campana, abre la tarea correcta y conserva el estado leído tras
recargar. Los diálogos comunes asocian su título visible mediante
`aria-labelledby`, de modo que lectores de pantalla y automatización puedan
identificarlos por nombre.

Verificación: **412/412 pruebas en 45 archivos**, TypeScript, build Vite y
Worker; Chromium Edge recorrió coordinación conjunta, notificación, apertura,
lectura persistente, cierre secuencial y reportes, además de los recorridos
generales y móviles. Cero errores JavaScript y cero solicitudes a `/api`.
Evidencia: `architecture/review-evidence/joint-notification-lab-20261007.json`
y capturas/CSV bajo `outputs/joint-notification-acceptance/` y
`outputs/site-acceptance-20261007/`.

El build conserva el aviso informativo de Vite por el chunk principal de ~593 kB
y avisos de comentarios de pureza en Zod; no impiden compilar. El aviso y su
lectura siguen guardados en `paris-state-lab`: no hay correo ni sincronización
entre equipos. La entrega en servidor requiere revisar identidad, permisos y
transacciones antes de integrar API/D1/Supabase. Publicación confirmada en el
mismo Site privado como **v65**, desde el commit
`8d221ca4da4b32220fd1e49e176c7f01bc248e17`; deployment
`appgdep_6ac5e81f55448191bf732b8f58d73147` terminó correctamente. La relectura
confirmó rol propietario, acceso personalizado a una cuenta, cero grupos y cero
visitantes externos. No se cambió la audiencia ni se habilitaron cuentas.

El avance global continúa aproximadamente en **45%**: este cierre funcional no
incluye aceptación completa, sincronización entre PCs ni infraestructura final.

## Copia portable del laboratorio — 07/10/2026

La banda de prueba ofrece descargar una copia JSON versionada y restaurarla en
otro navegador/PC. Antes de reemplazar datos muestra cantidades y exige una
confirmación. La importación valida tamaño/formato/estado y escribe sólo
`paris-state-lab`; una copia inválida deja intacta la simulación actual y el
espacio operativo permanece aislado. El archivo no está cifrado y puede incluir
notas y comentarios: guardarlo de forma privada.

Verificación: 416/416 pruebas en 46 archivos; TypeScript, Vite y Worker build;
pre-commit 100/100 en 15 archivos; Chromium Edge validó descarga, lectura,
confirmación y restauración; sin errores JS ni llamadas a `/api`. Evidencia:
`architecture/review-evidence/laboratory-backup-lab-20261007.json`.
Contrato y límites: `architecture/LABORATORY-BACKUP-CONTRACT-20261007.md`.

Esto facilita mover también la simulación junto al bundle de código, pero no
sincroniza PCs automáticamente ni demuestra backup/restore de GitHub, D1 o
Supabase. Avance global: **~45%**, sin cambios. No se conectaron cuentas ni se
modificó la audiencia del Site.

## Carga de vistas por demanda — laboratorio — 07/10/2026

Las pantallas de administración, planificación, reportes, equipo, ausencias,
inducción, anotaciones y laboratorio ahora se descargan al abrir su sección.
Mientras llega el módulo se muestra un estado accesible. La entrada JavaScript
bajó de ~593 kB a 489,53 kB (−~17,4%) y quedó debajo del umbral de advertencia
de Vite. El paquete separado de gráficos sigue en 405,70 kB porque el resumen
lo usa; queda como oportunidad de optimización distinta.

Verificación del estado actual: 412/412 pruebas en 45 archivos, TypeScript,
build Vite y Worker; Chromium Edge escritorio y móvil pasó los tres recorridos,
sin errores JavaScript ni llamadas operativas a `/api`. Evidencia:
`docs/architecture/review-evidence/route-code-split-lab-20261007.json`.
La suite ejercita la carga diferida en anotaciones, inducción, ausencias,
invitaciones, reportes y equipo. El cambio no modifica reglas contables,
identidad, persistencia ni almacenamiento y se mantiene dentro del laboratorio.

El corte está comprometido como `806ff00696434f573ee0542e4710d8b383ab1406` y
publicado en el mismo Site privado como **v66**; deployment
`appgdep_6ac5f09cccb48191910a364ef6e8f998` terminó correctamente. Relectura:
propietario, audiencia personalizada, una cuenta permitida, cero grupos y cero
visitantes externos. No se conectaron cuentas, Supabase, D1, GitHub ni correo.
El avance global sigue orientativamente en **~45%**.

## Avisos locales de vencimiento — corte en preparación — 07/10/2026

La campana del laboratorio agrupa tareas autorizadas que vencen en tres días,
vencen hoy o están atrasadas. Al abrirla recalcula las ventanas; permite abrir
la tarea y guarda lectura por perfil, regla y día ART. Omite tareas cerradas,
completadas y fechas inválidas. Durante ausencia pausa el aviso personal del
titular; el reemplazante sólo lo recibe si mantiene la cobertura y el acceso.

El alcance es local y a demanda dentro de `paris-state-lab`: no hay proceso en
segundo plano, correo, servidor ni sincronización entre equipos. No prueba
entrega entre dispositivos ni permisos de Auth/RLS. La ruta operativa conectada
no muestra estos avisos locales.

Verificación del árbol actual: **420/420 pruebas en 48 archivos**; TypeScript,
Vite y bundle Worker aprobados. Chromium Edge recorrió la campana en escritorio
y móvil, abrió una tarea, guardó y releyó su recibo; cero errores JS, cero
solicitudes locales a `/api` y sin desborde horizontal. El diálogo se inspeccionó
en ambas capturas. Evidencia:
`architecture/review-evidence/deadline-notifications-lab-20261007.json`;
capturas de revisión bajo `outputs/deadline-notifications-browser/` en el
workspace.

Este corte quedó comprometido como `25d1490b88bddeb349328053774acbe99cb7b042`
y publicado en el mismo Site privado como **v68**; deployment
`appgdep_6ac64381bc288191ad9d5247e4e0b340` terminó correctamente. Relectura
confirmó propietario, audiencia personalizada, una cuenta autorizada, cero
grupos y cero visitantes externos. Avance global estimado **~45%**; no implica
aceptación final ni sincronización entre computadoras.

## Sincronización documental y transferencia personal — 07/10/2026

El commit `e9fd3f8b33b16366143d2bff413ff5b1fc939b90` sincronizó los documentos
del corte de avisos locales y se publicó como **Site v69**, deployment
`appgdep_6ac6458abaec81919944f70b0530a8f6`. El archivo publicado se generó desde
el build del mismo checkout. La relectura confirmó estado activo y acceso
personalizado con una sola cuenta propietaria, sin grupos ni visitantes
externos. No hubo cambios funcionales ni de audiencia en v69.

La transferencia portable de este commit se verificó con `git bundle verify`,
`git bundle list-heads` y una clonación temporal cuyo `HEAD` coincide exactamente
con el bundle. El paquete excluye credenciales, `node_modules` y estado del
navegador. La simulación `paris-state-lab` debe exportarse/importarse aparte desde
la interfaz del laboratorio; el JSON no está cifrado. No hay sincronización
automática entre computadoras sin GitHub propio.

La siguiente revisión pendiente sigue siendo de arquitectura: identidad,
permisos, idempotencia y entrega para dependencias/delegación/aceptación y
notificaciones entre dispositivos. No llevar estas mutaciones al servidor ni
crear cuentas antes de la aceptación final. Avance global orientativo: **~45%**.

## Sincronización de continuidad — 07/10/2026

El commit `617536429bd9bcc6d8cb0cfd85eb62948437bdef` actualizó el registro de
continuidad luego de v69 y se publicó como **Site v70**; deployment
`appgdep_6ac6465aee508191a879dc794316b54a` terminó correctamente. Relectura del
Site: activo, acceso personalizado, una cuenta propietaria, cero grupos y cero
visitantes externos. Fue una sincronización documental; el comportamiento
funcional sigue siendo el ya validado en el corte de avisos locales.

El bundle de PC personal se debe regenerar desde el `HEAD` documentado en
`outputs/LEEME-PC-PERSONAL.md`; su transferencia incluye historial Git, no
credenciales ni el estado del navegador. El avance global sigue orientativamente
en **~45%**.

## QA local antes de revisión de arquitectura — 07/10/2026

Build del checkout: TypeScript, Vite y Worker pasaron. El bundle de entrada fue
496,56 kB; los dos avisos de anotaciones de pureza de Zod son informativos. Los
recorridos Edge existentes `browser.cjs`, `browser-corrections.cjs`,
`browser-laboratory-backup.cjs` y `browser-joint.cjs` pasaron en las ventanas
registradas, incluyendo móvil 390×844. Ver
`docs/architecture/review-evidence/local-browser-audit-20261007.json`.
Todos reportaron cero errores JS y cero llamadas a `/api` operativo.

Esta evidencia valida flujos locales del laboratorio, no producción. Sigue sin
probarse rendimiento con 20+ perfiles, navegación por teclado de extremo a
extremo ni concurrencia real entre pestañas/dispositivos. La persistencia local
no permite inferir entrega/consistencia de servidor. El avance global permanece
aproximadamente en **45%** y el siguiente gate requiere GPT-6.1 Sol alto.

La prueba unitaria de tablero `tests/task-board.test.tsx` pasó 4/4 casos de
teclado para mover tarjetas. Esto no sustituye una auditoría por teclado de toda
la navegación. El alcance y comando se agregaron al JSON de evidencia.

Sondeo sintético de volumen: 13 perfiles base + 11 ficticios = 24 perfiles; la
tabla de administración mostró las 24 filas en 512 ms desde seleccionar Equipo
(ventana 1440×900). La medida incluye carga de ruta e interacción, se guarda como
línea base y no implica aceptación porque no hay umbral acordado. Cero errores
JS y cero llamadas a `/api`. No prueba concurrencia entre pestañas ni servidor.

## Validación preparada del paquete de Sites en CI — 07/10/2026

El workflow `.github/workflows/validate.yml` quedó ampliado para ejecutar, luego
del build, `scripts/package-site-archive.mjs` y comprobar que el archivo incluya
el manifiesto del Site, los artefactos cliente/Worker y las migraciones D1. El
archivo temporal se valida dentro del runner y no se publica como artefacto.
Esto reduce el riesgo de que un build verde omita una ruta requerida al guardar
una versión en Sites.

`npm test` y el pre-commit también excluyen `tmp/**`, donde se guardan clones
locales ignorados por Git; así los resultados no duplican los mismos tests ni
incorporan copias que no forman parte del commit.

La validación aún está preparada, no ejecutada: no existe el repositorio GitHub
propio. No conecta cuentas ni cambia la audiencia del Site. El avance global
permanece aproximadamente en **45%**.

## Cierre de revisión anterior — 08/10/2026 (histórico; reemplazado por «Estado actual»)

**Respuesta: no, todavía no están implementados ni aceptados todos los cambios del plan.** Este bloque sí corrigió la privacidad entre empresas en Mi día/calendario/historial, la atribución individual de tareas conjuntas, la validación de snapshots de cierres y la selección de vínculos del formulario de fechas. Sol revisó esas cuatro correcciones con probes independientes y no encontró regresiones en esos casos.

Validación del árbol local más reciente: suite completa **474/474 en 54 archivos** (la primera ejecución tuvo un fallo intermitente en una prueba integrada de Anotaciones; esa prueba pasó aislada y la segunda suite completa pasó); TypeScript, build de cliente y Worker; Edge en escritorio/móvil. El último recorrido confirmó arrastre, persistencia, navegación y cero llamadas a la API operativa ni errores JavaScript. `git diff --check` pasó con advertencias informativas LF/CRLF. El build conserva avisos de tamaño: entrada principal **576.280 bytes**, gráficos **423.739 bytes**.

Queda trabajo funcional y aceptación global: consistencia de paneles/ayudas, explicación visual de algunas recomendaciones, evaluación con lector de pantalla y revisión sistemática de contraste, además de los escenarios integrados y de rendimiento que el plan exige. La presencia real, autenticación, persistencia entre dispositivos y notificaciones entre usuarios dependen de la etapa de servicios y cuentas propias; siguen pospuestas. No hay commit, PR, actualización del Site ni cuentas conectadas. El laboratorio sigue privado y sin API operativa.

**Avance global orientativo: ~45%, sin cambio.** El 100% sigue requiriendo todos los requisitos aceptados, infraestructura propia GitHub + Supabase dev/producción + hosting, y automatización de migraciones, PR, verificaciones y despliegues. La suite aprobada no equivale a producto final sin correcciones conocidas.

**Siguiente paso:** GPT-6 Luna, esfuerzo medio, Standard, para implementar el próximo bloque acotado de paneles/ayudas y aceptación visual sin abrir servicios. Luego GPT-6.1 Sol, esfuerzo alto, Standard, para revisión independiente. La selección del modelo no se cambia automáticamente desde este entorno.

Evidencia de este cierre: `docs/architecture/review-evidence/privacy-backup-calendar-recheck-lab-20261008.json`; recorrido Edge: `outputs/plan-validation-20261008/edge-final-privacy-validation/`.

## Registro de implementación inicial — 08/10/2026 (455 pruebas; histórico y reemplazado por «Estado actual»)

Se corrigieron en el árbol local rutas del contrato 07/10: consulta por empresa, guardas de ejecución/readiness, bloqueos y materialización por unidad, cierre atómico de componentes conjuntos, confirmación comercial por botón/arrastre, gestión de pesos, cobertura y unidad cerrada, validación del respaldo y métricas de operativas sin cuotas antiguas. Se eliminó la ficha duplicada del actor simulado en la barra lateral. El recorrido guiado ahora oscurece el exterior, resalta el destino, ubica la explicación cerca del objetivo y contiene el foco con salida por Escape; pausar retira el resaltado.

Verificación local: suite completa **455/455 en 51 archivos**; TypeScript, build Vite y Worker pasaron. La suite focalizada del recorrido pasó 35/35 y Edge verificó la guía dentro del viewport y su cierre al pausar. En el calendario, Edge comprobó tipo/descripción de evento y navegación desde una obligación a la ficha de origen; cero errores JavaScript y cero llamadas a la API operativa. Benchmark del árbol actual: 24 perfiles/2.000 tareas, p95 **670,11 ms** en 30 transiciones calientes, dentro del objetivo local de 1.000 ms. `git diff --check` pasó. Evidencia en `docs/architecture/review-evidence/plan-corrections-lab-20261008.json`, `outputs/plan-validation-20261008/browser-calendar-final` y `outputs/plan-validation-20261008/performance-calendar-final`.

Pendiente: snapshots históricos inmutables completos; robustez transaccional de escritura asíncrona de adjuntos; filtros de Mi día, densidad del selector y consistencia de ayudas/paneles; auditoría accesible; revisión de Sol. Vite mantiene el aviso de bundle principal 560,57 kB y gráficos 423,74 kB. El benchmark es local y caliente; no representa concurrencia ni producción. No hay commit ni despliegue. No se conectaron cuentas ni servicios. Avance global orientativo ~45%; el plan no está completo ni aceptado.

## Migración GitHub — 16/10/2026

El código vigente del laboratorio se publicó directamente en la rama `main` del
repositorio privado `tablerocontable-paris/TABLERO-CONTABLE`, como importación
inicial atribuida a **Tablero Contable**. La importación crea una raíz Git nueva
para que GitHub no muestre como actividad del repositorio los commits locales
anteriores a su creación. El árbol de archivos se conserva íntegro; no se
reescribieron los archivos de producto para esta migración.

La rama `main` es el punto de continuidad para la PC personal. La PR temporal de
bootstrap se cierra y se retiran las ramas auxiliares remotas para que el flujo
no dependa de aprobar PR. El proyecto sigue siendo laboratorio privado con
datos ficticios. Esta migración no conecta Supabase, Cloudflare ni Gmail, no
aplica migraciones y no despliega el espacio operativo.
