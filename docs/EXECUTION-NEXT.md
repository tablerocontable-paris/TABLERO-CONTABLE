# Estado vigente de ejecución — 30/10/2026

## Estado actual — SQL017 aplicada en DEV; continuar auditoría

Se halló y corrigió en código local una brecha en el registro de movimientos:
el permiso de consulta de un superior no debe habilitar escritura. SQL017
revalida responsable/participante/cobertura con fecha de trabajo y deja
bloqueadas para escritura las operativas conjuntas históricas. Incluye
revalidación durante replay. Pruebas focalizadas: **17/17** aprobadas. Suite
completa local: **898/898 pruebas en 89 archivos**.

La revisión independiente aceptó el hash exacto SQL017 y se aplicó sólo a
`grupo-paris-dev`. El historial posterior contiene 19 migraciones; Supabase
asignó a SQL017 la versión `20261030012651`, que ya coincide con el nombre
local. Consulta SQL read-only confirmó la definición con ambas guardas,
`EXECUTE` al wrapper para `authenticated`, sin `EXECUTE` para `anon` y helper
interno no ejecutable por `authenticated`. El preflight anterior de Actions que
falló no es evidencia de fallo de esta aplicación.

El 30/10 se cotejaron por SHA-256 las 39 RPC `SECURITY DEFINER` accesibles a
`authenticated`: 39/39 firmas, sin diferencias con el catálogo de las 19
migraciones locales reconstruido en PGlite (normalización CRLF/CR). Esto
acredita igualdad de definiciones, no ejecución con JWT ni acceso vía Data API.

La certeza global sigue **por debajo del 100%**: faltan pruebas JWT reales por
rol/ámbito, verificación de Exposed schemas, aceptación autenticada de interfaz
y homologación del catálogo tarea–unidad.

## Continuidad verificada — 29/10/2026 21:24 ART

HEAD local y `origin/main`: `983a9bc889ae8071fdea21e5cb4e63e40e3703b1`.
Actions **#195** pasó para ese SHA; el corte documental local actual aún no se
publicó y necesitará su propia validación.

Supabase DEV: la consulta ACL de las 21:21 ART confirma 39 de 88 funciones
`SECURITY DEFINER` de `public` ejecutables por `authenticated`, ninguna por
`anon`; las 39 tienen `search_path` configurado. No revisa autorización de
cuerpos. No activar Auth operativo, `/api` ni datos reales hasta completar la
revisión de RPC, corregir/verificar **Exposed schemas** y ejecutar pruebas JWT
por rol. La última sonda guardada muestra `public, graphql_public` expuestos.
Las 39 firmas expuestas existen en el historial SQL local, pero falta el
cotejo de cada cuerpo live/local y su prueba autenticada.

Control de privacidad: Anotaciones y Gemelo excluyen el texto personal de
terceros en pruebas locales. Los comentarios de bloqueo de tarea son distintos
y actualmente legibles por superior autorizado con membresía vigente. Antes de
Auth operativo, dejar claro que ese campo es operativo o ajustar la política si
la expectativa es privacidad frente al superior también para esos comentarios.

Pendiente para aceptación: interfaz autenticada manual, matriz de perfiles y
ámbitos, privacidad de notas, catálogo homologado por evidencia, y confirmar el
sitio en los recorridos del usuario. Estos pendientes impiden afirmar certeza
total; seguir avanzando con auditorías locales/documentales mientras no se
requiera intervención del Dashboard o cuentas de prueba.

GitHub Actions **#191** terminó `success` para `0b9c479`; pasó suite,
TypeScript/build y paquete Sites. Se agregaron a la ficha cuatro pares con el
nombre completo de la unidad, pendientes de confirmación, y se separaron las
siglas no expandidas. El cambio no modifica el comportamiento.
La actualización es documental y no requiere publicar otra versión del Site.
Después de publicarla en `main`, verificar el workflow de ese commit y mantener
la guía de la PC personal sincronizada.

Actions **#192** terminó `success` para `9a563fe` (suite, build y paquete
Sites). El corte documental en curso incorpora el refresh read-only de
Supabase DEV de las 23:58 UTC; al publicarlo, verificar su workflow.

Supabase DEV se releyó en modo read-only a las 23:58 UTC: activo, saludable,
16 migraciones 001–016 y Advisors sin variación relevante (29, 39, 124, 8 y
12). La exposición REST no se volvió a probar: la evidencia de las 22:10 UTC
mantiene `public, graphql_public` expuestos y `api`/`app_private` rechazados.
No activar Auth ni datos reales hasta modificar esa configuración y completar
la prueba con JWT por rol.

Revalidación actual: GitHub Actions **#189** `success` para el HEAD
`74b506e60fc8cf8ed5dd8341fe2fe629e9394ede` (suite, build y paquete Sites).
En esta PC, 892/892 pruebas en 88 archivos, TypeScript, cliente/Worker,
paquete Sites y recorrido Playwright/Edge pasaron. El benchmark Edge 24/2.000
completó 30 recorridos, p95 502,98 ms. Sigue pendiente la aceptación manual
autenticada, la matriz unidad–tarea real y la corrección/verificación de
Exposed schemas y permisos Auth DEV antes de activar servicio operativo.

Actions **#190** confirmó `success` para `main` en `90f40a6`. El mismo Site
privado está actualizado a **v110**, despliegue
`appgdep_6ae3d9f57fa88191989e95248e30e1ff`, owner-only y sin visitantes
externos. Aceptar todavía la UI interior con sesión; no se activó el espacio
operativo.

Benchmark Edge del árbol `74b506e`: 30 recorridos calientes, 24 perfiles y
2.000 tareas; p95 **502,98 ms** (<1.000 ms), sin errores JavaScript ni llamadas
a `/api`. Evidencia: `docs/architecture/review-evidence/laboratory-performance-20261029.json`.
Es una prueba sintética local, no aceptación real.

El onboarding local admite varias cuentas u otras combinaciones de parámetros
bajo el mismo código canónico por unidad. Prueba del caso de dos cuentas de
Banco Francés; suite completa 892/892, TypeScript, build cliente y Worker
aprobados en esta PC. El recorrido Playwright/Edge también pasó con dos cuentas,
sin errores JS ni solicitudes a `/api`. No cambia la matriz unidad–tarea, que
sigue sin confirmar. El cambio y su regresión de navegador se publican junto con
esta actualización documental, directamente en `main`; comprobar el workflow
posterior al push antes de considerarlo validado en GitHub.

GitHub Actions **#183** terminó `success` para el HEAD documental
`91f9505a4a92193206908de7b5ed44314e129829` (suite, build y paquete Sites).
Este corte es documental y no requiere nueva publicación del Site.

Supabase Advisors se reconsultó en modo lectura a las 22:17 UTC y conservó
los conteos del informe de acceso. No se aplicaron correcciones de esquema;
revisar el detalle actualizado en
`docs/architecture/SUPABASE-DEV-READONLY-ACCESS-AUDIT-20261029.md`.

## Revisión posterior — 29/10/2026

En `5fe0cb6` se añadió una prueba que fija la paridad entre los 30 códigos
provisionales V7 y la ficha de homologación. La suite local pasó 891/891
pruebas en 88 archivos y GitHub Actions #177 pasó suite, build y paquete Sites
para `35e90a3c1eea5b1ef58abd9060a04cf9314bf406`.

La sonda REST repetida a las 22:10 UTC confirma Exposed schemas = `public,
graphql_public`; `api` no está expuesto. Debe cambiarse desde API Settings del
proyecto DEV para dejar únicamente `api` y repetirse la sonda. Esta sesión no
puede modificar ese ajuste de seguridad desde UI: el conector carece de una
operación para ello y la skill de control Windows lo prohíbe. Evidencia:
`docs/architecture/SUPABASE-DEV-EXPOSED-SCHEMAS-REST-CHECK-20261029.md`.
Hasta entonces, no activar Auth operativo, `/api` ni datos reales. La
revalidación SQL read-only de 21:52 UTC confirmó que ninguna tabla de `public`
o `app_private` da permisos efectivos a `anon`; las 39 RPC `SECURITY DEFINER`
de `public` disponibles para `authenticated` siguen siendo el motivo para
retirar `public` de Exposed schemas antes de pruebas de sesión. El detalle está
en `docs/architecture/SUPABASE-DEV-READONLY-ACCESS-AUDIT-20261029.md`.

## Corte funcional anterior — catálogo V7 / Site v109

El commit funcional `c28c365de14a8d7c099ca20cecc2e0ab01764a1d` está directamente en GitHub `main` (sin PR). El catálogo París V7 añade sucursales 3/81 a carga de facturas de repuestos, exige un detalle para las demás y las excluye de comparación hasta homologarlas; V1–V6 siguen congeladas. Pasaron localmente 890/890 pruebas, TypeScript, build cliente y Worker, Playwright/Edge en escritorio y móvil, y hook 236/236. GitHub Actions **#167** terminó `success` para ese SHA. El mismo Site privado está en v109; fuente Sites `0e004e951192b95e52552b6444b759a344b8ad7b`, árbol `1d4eb82585015f76fec91705bd4432f72d313c8c`, idéntico al árbol de GitHub `main` en c28c365. El despliegue terminó `succeeded`; audiencia personalizada sólo propietaria, cero visitantes externos.

### Siguiente bloque

1. Aceptar la UI interior de v110 con sesión autorizada y completar recorridos manuales de permisos y responsive; Edge automatizado no sustituye esta aceptación.
2. En la PC personal, seguir `outputs/LEEME-PC-PERSONAL.md`, clonar/actualizar `main` y ejecutar instalación, validaciones y recorrido local.
3. Mantener las 30 tareas provisionales fuera de comparación. La reauditoría del 29/10 no encontró una candidata que pueda habilitarse con evidencia documental suficiente; VN, PSA y MO4 aún requieren confirmar proceso y alcance. El borrador del catálogo registra qué debe aclararse.
4. Revisar en Dashboard la lista efectiva de esquemas Exposed de Data API y completar matriz de permisos con identidades Auth DEV. La auditoría read-only de grants está en `docs/architecture/SUPABASE-DEV-READONLY-ACCESS-AUDIT-20261029.md`; no sustituye estas pruebas. Mantener Auth operativo, `/api` y Supabase de producción desactivados hasta aceptar el laboratorio.

Como preparación funcional para el catálogo, la ficha
`docs/product/BUSINESS-UNIT-TASK-NORMALIZATION-QUESTIONNAIRE-20261029.md`
contiene preguntas para homologar las 30 tareas provisionales. No habilita
comparaciones: se requiere responder con evidencia del proceso y luego revisar
la versión del catálogo.

El preflight no demuestra ausencia total de errores ni certeza del 100%. No tocar el scratch protegido `tests/review/m2-2c-legacy-task-control-replay-races.block`.

La revalidación documental de ACL quedó publicada directamente en `main` como
`b2911fc128092f73bdb61cdb2c43f0d2fe61c636`; GitHub Actions #170 terminó
`success` para suite, build y paquete Sites. La guía para la PC personal
registra ese corte y remite a la auditoría read-only de accesos DEV. Ese cambio
no modificó el código funcional ni requirió desplegar el Site.

### Estado Supabase DEV revisado el 29/10/2026

El proyecto sigue activo y las 18 migraciones 001–016 están registradas. 001–014 se aplicaron correctamente; un reintento posterior eligió por error el baseline completo y el guard lo detuvo antes de escribir. SQL016 corrige el defecto funcional de membresía revocada detectado en SQL011. Mantener el workflow actual read-only; antes de datos reales completar la revisión de exposición Data API y la matriz de permisos con Auth DEV. No editar ni reejecutar migraciones históricas.

GitHub Actions #165 se verificó directamente en GitHub: resultado `success` para `4d9d8c820c4a882cdaa71e950d7ea0ff15840a8d`, sin Pull Request asociado. Esto verifica CI de ese corte documental, no la UI autenticada ni el Site con usuarios operativos.

## Corte anterior — reclasificación histórica, Site v106 (histórico)

## Cambio vigente — reclasificación de propuestas históricas, Site v106

La reclasificación explícita se implementó en una nueva revisión del titular,
con historial antiguo inmutable y guardas contra clasificaciones parciales o
contradictorias. Validado localmente con **884/884 pruebas en 87 archivos**,
TypeScript, builds cliente/Worker, paquete Sites y recorrido Playwright/Edge;
sin errores JS ni llamadas a `/api`. Commit `dd2b8a1fa7f45dc502da7befe47044aa851ff62c`
en GitHub `main`, Actions #156 verde y el mismo Site privado desplegado como
v106 desde fuente `ed7d08e009fe9d16db10ca1f1cab8806b62d35b0`. Audiencia
owner-only. No stagear ni inspeccionar
`tests/review/m2-2c-legacy-task-control-replay-races.block`.

## Corte anterior — Site privado v105

El catálogo V6 está desplegado en el Site privado existente: versión **105**,
proyecto `appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85`, fuente Sites
`c647ef793cd1f0e36e3e43b0e7102a43a40ce3ab`, propietario autorizado y cero
visitantes externos. Se conserva el entorno ficticio; el acceso sin sesión
presenta la pantalla de inicio de sesión. No se verificó el interior con una
sesión autenticada.

GitHub Actions #153 aprobó el HEAD de código
`05e3e52a8088779668baba1af0ea3324060885d4`. En la PC de trabajo pasaron
**880/880 pruebas**, TypeScript, build cliente, Worker y paquete Sites mediante
los ejecutables locales de Node; npm no está instalado. El bundle cliente
mantiene un aviso por superar 500 kB y la build de Zod muestra comentarios
conocidos. Este resultado no equivale a certeza del 100% ni a aceptación real
por usuarios.

### Trabajo que todavía falta

- Validar la interfaz interna del Site con sesión autorizada y completar
  recorridos manuales de accesibilidad/responsive.
- Homologar las 30 tareas provisionales, sin habilitar comparaciones hasta
  confirmar alcance y parámetros; resolver cómo reclasificar propuestas
  históricas incompletas sin inferir su clasificación.
- Hacer la prueba de clon y desarrollo en la PC personal cuando esté disponible.
- Mantener Auth operativo, `/api` y producción desactivados hasta que el
  producto y las cuentas reales tengan una etapa de aceptación aprobada.

Los siguientes apartados son históricos; sus menciones a “no desplegado” o
v104 describen el estado anterior a la publicación de v105.

## Catálogo V6 — corte anterior a v105 (histórico; pendientes funcionales)

La implementación introduce valores controlados para Banco Francés y
Banco Nación en conciliación bancaria. Los nombres tienen respaldo en el
repositorio, pero la lista es parcial. Otro banco se registra con nombre y
marca pendiente, excluido de comparación hasta homologarlo. Las búsquedas por
nombre/abreviatura mantienen un código de tarea y guardan el banco como
parámetro versionado. Los datos V1–V5 se conservan.

Validación local final: suite **880/880 en 87 archivos**, TypeScript, build
cliente, Worker, paquete Sites y recorrido Playwright en Edge aprobados. La
prueba de navegador confirma propuestas canónicas pendientes por empresa y que
no se crean tareas/asignaciones hasta aprobación, junto con cierres, tareas,
cronómetros, ausencia, aislamiento, temas y móvil. Implementación publicada en
`main` como `cd84168`, guía personal actualizada en `e8299c8`, sin Pull Request.
GitHub Actions #150 pasó suite, build y paquete Sites para el corte funcional
`54e8b4d`. La continuidad documental posterior pasó el hook 230/230. No
desplegar a Sites sin una etapa de publicación aprobada; Site v104 sigue sin
cambios.

## Corte GitHub: seguridad de clasificación en onboarding

Cambios implementados localmente en `5bcf11a`: bloquear activación de propuestas con
clasificación faltante/inconsistente; preservar el historial de selecciones
antiguas del onboarding; y no materializar borradores libres como tareas París.
Validación terminada: **877/877** suite, **35/35** focales posteriores en los
tres archivos afectados,
**229/229** hook automático, TypeScript, build cliente/Worker, paquete Sites y
`git diff --check`. Revisión final independiente sin hallazgos críticos/altos.
Commit funcional `5bcf11a` ya publicado directamente a `main`; Actions #146
aprobó el HEAD documental `77bbae7`. Las propuestas antiguas sin clasificación se preservan pero no tienen
aún un flujo de reclasificación; no aprobarlas ni inferir códigos desde el
texto histórico. Site privado v104 sin cambios ni despliegue.

## Estado del catálogo y límites de homologación

El catálogo V6 controla Francés y Nación para `gpar_bank_reconciliation` y
mantiene otros bancos pendientes de homologación, sin inventar opciones.
Mantener el mismo código de tarea y banco/cuenta como dimensiones para
comparaciones entre unidades. No transformar cada abreviatura histórica en una
nueva tarea. Tres candidatas provisionales (VN, costo de créditos
y MO4) requieren normalizar dimensiones antes de compararlas; las otras 27
requieren aclarar alcance, siglas o solapamientos. Ver los códigos en el
borrador del catálogo. No habilitar comparaciones por código únicamente.

## Corte publicado para continuidad entre PC — 28/10/2026

El corte funcional está en `main`, commit
`d37792b8a1b9fd29697ecaed726ecaeaae003cc0`, autor **Tablero Contable**,
publicado directamente y sin Pull Request. Valida el cierre de onboarding
nuevo con unidades/tareas canónicas y bloquea la activación de propuestas con
historial de clasificación incompleto o mezclado, preservando su historial.
Validación local: suite **873/873 en 87 archivos**, rutas modificadas **92/92**,
TypeScript, build cliente/Worker y paquete Sites aprobados. GitHub Actions #142
está en ejecución; el run #141 del commit anterior terminó en éxito. La
actualización de continuidad está publicada en `4ae9416`; Actions #143 está
pendiente. El Site privado sigue en v104 y no recibió estos cortes. No modifica
`/api`, Auth ni SQL001–016. Guía para la PC personal:
`outputs/LEEME-PC-PERSONAL.md`.

## Alta puntual con identidad canónica — publicada en GitHub

Commit `d1fc8a9` endurece “Nueva tarea” en el laboratorio: sólo permite elegir
las 55 tareas y siete unidades de negocio del catálogo París, toma el nombre de
la definición V5 y conserva código, unidad y parámetros en asignación y tarea.
Los parámetros requeridos por la definición bloquean el guardado si faltan;
los opcionales no. Conversión de pedidos/anotaciones mantiene su vínculo; el
flujo fuera del laboratorio no cambia. No reclasifica historial ni modifica
interfaces/API Supabase.

Comprobación local del corte funcional: **871/871 pruebas en 87 archivos**,
TypeScript, build cliente, Worker, paquete Sites y hook **223/223**. Publicado
directamente en `main`; Actions #140 (`40742326097`) aprobó el SHA `deb4b9e`,
mientras #139 (`40742037924`) quedó cancelado por el corte posterior. El Site
existente continúa en v104, por lo que la corrección todavía no está visible
allí.

La revisión agregó validación al finalizar onboarding nuevo y evita
activar propuestas donde una revisión actual codificada como París conserva
versiones anteriores sin código. La bandeja mantiene visible el historial y
oculta controles de activación en esos casos; neutral puro sigue su flujo. Los
borradores anteriores no se renombran ni reclasifican. Validación local actual:
873/873 suite, TypeScript, build cliente/Worker, paquete Sites y pruebas
seriales de rutas tocadas 92/92. El corte quedó publicado en `main` como
`d37792b8a1b9fd29697ecaed726ecaeaae003cc0`; Actions #142 corre todavía. No se
desplegó al Site, que sigue v104.

## Normalización Grupo París — catálogo v5 desplegado

La inducción local del laboratorio contiene siete unidades fijas y 55 tareas estandarizadas (`src/domain/parisTaskCatalog.ts`). V5 permite elegir las 55; 25 son comparables y 30 provisionales. Una auditoría cruzada detectó dos filas cuya elegibilidad no coincidía con el borrador: V5 excluye `supplier_invoice_load` de comparación hasta confirmar el alcance de portales y habilita `customer_collections`, marcada Confirmada. Conserva el total de 25/30. V1–V4 siguen disponibles para leer métricas anteriores; no se recalculan.

V4 había quitado el campo redundante de unidad en dos tareas y agregado `CONC BANC FRANC` como alias de búsqueda; V5 conserva ambos cambios. La suite completa del corte funcional pasó 870/870 en 87 archivos; TypeScript, builds cliente/Worker y paquete Sites terminaron bien. El benchmark Edge del 28/10 pasó 30/30 recorridos con 24 perfiles, 2.000 tareas y p95 de 517,44 ms. Auditoría cruzada alineó cuatro nombres del borrador con las etiquetas canónicas y añadió una aserción para los 55 nombres, códigos y criterios de comparación; su prueba focal pasó 10/10. GitHub `main`: `f5263f1` funcional y Actions #135 éxito. El mismo Site privado se desplegó en v104. El build deja avisos de anotaciones de Zod y del bundle principal de ~656 kB. Cambios sin impacto en SQL001–016 ni onboarding autenticado.

No se modificaron `/api`, Supabase Auth ni SQL001–016. Esta publicación es del laboratorio privado con perfiles/datos ficticios; no representa una versión operativa ni habilita acceso a usuarios reales. Los pasos para continuar desde otra PC están en `outputs/LEEME-PC-PERSONAL.md`. Guía de continuidad y límites de sincronización: `docs/PORTABLE-CONTINUITY-20261027.md`.

## Historial de etapas anteriores
## Clasificación neutral — publicada y desplegada

Las sugerencias de primer ingreso v2 ya se conectan con códigos estables
compartidos con el estimador. La clasificación se conserva al enviar y
aprobar una propuesta local, crear su versión de catálogo, asignarla y
materializar ocurrencias. Se validan los códigos y la correspondencia entre
origen y registros; unidades sugeridas no se convierten automáticamente a las
unidades del estimador. Datos antiguos sin clasificación permanecen así.
No se tocó el contrato autenticado ni SQL001–016. Suite completa **845/845 en
85 archivos**, TypeScript, build cliente, build Worker y paquete Sites
aprobados; hook **214/214**. GitHub commit
`9b54a4625f56e07fedbfba82d68696204f9a0e5d`, autor Tablero Contable, directo en
`main`, sin PR; Actions #117 (`40555801302`) pasó instalación, suite, build y
validación Sites. El seguimiento documental quedó en
`e9fae71f3c1fda7414f0ad103c99f60275670c76`, y Actions #119
(`40558575748`) también pasó instalación, suite, build y paquete Sites. La
versión **99** del Site existente se desplegó correctamente
desde su rama fuente (`a80e3013d00165f1bc0abd64a580545a4322e49b`), manteniendo el
acceso personalizado actual y sin visitantes externos. El build cliente conserva
un aviso de chunk principal >500 kB. El onboarding autenticado y la clasificación
remota siguen pendientes; no se activó Auth ni se modificó SQL001–016. Sol
aceptó sólo el diseño del contrato (SHA-256
`E65E1B467525B8AE4769E2F10EB33E238043078ED9D1E635468D0ADBD7C93D68`). Próximo:
implementar localmente la migración posterior a 016, API v3, tipos y UI según el
contrato, validar replay/upgrade y someter el código a revisión Sol. En esta PC
de trabajo no está disponible la CLI de Supabase y no se debe improvisar el
archivo de migración ni aplicar SQL en remoto; continuar ese paso en una PC con
la CLI disponible. La futura migración debe conceder EXECUTE explícitamente a
`authenticated` sólo en funciones `api` autorizadas y no depender de grants
automáticos; ver el [cambio de defaults de Data API de Supabase](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
Mantener Auth y escrituras remotas apagadas hasta aceptación específica DEV.
Usar el estimador sólo después de recibir un extracto vigente autorizado.
Contrato/detalle en
`docs/architecture/AUTHENTICATED-NEUTRAL-FIRST-LOGIN-CONTRACT-DRAFT-20261027.md`.

## Revisión del catálogo neutral

La auditoría independiente cotejó las 26 sugerencias v2 contra el borrador y
no encontró omisiones dentro de ese borrador. No prueba que el catálogo cubra el
trabajo real. El onboarding autenticado sigue pendiente: antes de habilitarlo,
conectar el frontend al backend de aprobación existente y persistir el código y
versión de concepto en las definiciones aprobadas. El contrato vigente de
onboarding no transporta esa clasificación; las definiciones personalizadas
remotas son de frecuencia única. No modificar SQL001–016; revisar primero el
contrato borrador en
`docs/architecture/AUTHENTICATED-NEUTRAL-FIRST-LOGIN-CONTRACT-DRAFT-20261027.md`.
Cobranzas, aplicación de cobros, liquidación de tarjetas y conciliación siguen
separadas. Detalle de cobertura en
`docs/product/TASK-NORMALIZATION-DRAFT-20261026.md`.

La documentación del contrato y el cotejo Supabase se publicaron inicialmente
en `14304ff79557ada887fd2f3d8e0f616ff4d4786d` (Actions #114); ese registro es
histórico. El último corte documental es `ea99133402fbdae73b3a4bb7e4de42e4d8fc70d3`
y Actions #118 (`40557105221`) pasó instalación, suite, build y paquete Sites.

## Estimador local y continuidad portable — actualización

El estimador de personas/tareas fue implementado localmente en
`scripts/workforce-estimate*.mjs`, con plantillas vacías, vocabularios neutrales
cerrados, clave HMAC generada sólo en `private-data/`, aislamiento de entradas y
salidas con `.gitignore`, y documentación en
`docs/product/ANONYMIZED-WORKFORCE-ESTIMATE.md`. Hay cuatro pruebas sintéticas
focales. La última suite completa aprobó **843/843 pruebas en 85 archivos**;
TypeScript, build cliente y build Worker aprobaron en esta copia. El build
cliente conserva un aviso de bundle principal superior a 500 kB. Commit del
estimador `daee754b9b688931e0779e271245acd6bd695526` y seguimiento documental
`c3ebaeb655d9350c3f0ffab60823a889004fbce7` están publicados directamente en
`main`; para `c3ebaeb`, hook **212/212** y Actions #113 aprobados. No trasladar
esa validación a commits posteriores.
No se recibió un extracto autorizado; la cantidad real de personas y tareas
terminadas hoy continúa **sin determinarse**. No crear ni copiar datos reales a
GitHub. El runtime Node incluido permite ejecutar el código en esta PC sin
instalar npm.

El resumen portable está en `docs/PORTABLE-CONTINUITY-20261027.md` y la guía
para traer `main` a la PC personal en `outputs/LEEME-PC-PERSONAL.md`. Migra
decisiones y evidencia técnica segura, no conversaciones brutas, memoria global
de Codex, comentarios privados, datos identificables, credenciales o sesiones.
La versión Sites v99 sigue publicada y privada; su acceso requiere la cuenta
propietaria. La audiencia se mantuvo sin ampliaciones.

## Continuidad de GitHub

El estimador se publicó en `daee754b9b688931e0779e271245acd6bd695526`; el
código neutral, en `9b54a4625f56e07fedbfba82d68696204f9a0e5d`; y la continuidad
actual, en `ea99133402fbdae73b3a4bb7e4de42e4d8fc70d3`, todo directamente en
`main`, bajo Tablero Contable y sin PR. Actions #117 y #118 pasaron sus
comprobaciones. Los runs #105–107 son evidencia histórica. El run #4 de
migraciones fue detenido por el
preflight antes de escritura; el workflow vigente inicia en `verify_current`,
de sólo lectura.

## Supabase DEV — historial ya completo

La lectura remota confirma las 18 versiones 001–016 instaladas. Actions run
`40012156985` aplicó 001–014; `40522413076` aplicó 015; `40522611976` aplicó
016. Los controles exactos de archivos, historial, dry-run y salida finalizaron
correctamente. No volver a correr `baseline_001_014`.

El run `40522765334` falló de forma segura: recibió `baseline_001_014`, pero el
remoto ya tenía 18 versiones; el control detuvo el job antes del `dry-run` y de
cualquier escritura. El estado de Supabase no cambió en ese run. La comparación de hoy
confirma que los cuerpos instalados de las funciones añadidas/reemplazadas por
015 y 016 tienen hashes MD5 de cuerpo coincidentes con el repositorio; cada
workflow verificó también el SHA-256 del archivo completo.

El cotejo del catálogo contra replay local, documentado en
`docs/architecture/SUPABASE-DEV-SCHEMA-CATALOG-COMPARE-20261027.md`, coincide
en relaciones, columnas, políticas, funciones, restricciones, índices,
triggers y privilegios. SQL011 sí tuvo un defecto semántico de membresía
revocada; SQL016 lo corrige. No reejecutar 001–014 ni modificar su historial.

El workflow de DEV quedó convertido a verificación exclusivamente de lectura:
exige las 18 versiones y ya no ofrece re-aplicar el baseline ni 015/016. También
se retiró el workflow duplicado de preflight 001–014. Las migraciones futuras
necesitan una etapa nueva, exacta y revisada. La auditoría read-only del
catálogo remoto del 27/10 halló RLS en 57 tablas, 28 policies en `public`,
ninguna policy en 20 tablas `app_private`, ningún DML directo para `anon` ni
`authenticated` y SELECT sujeto a policy en 28 tablas públicas sólo para
`authenticated`. Advisors reportan 29 tablas con RLS sin policy; las nueve
públicas no tienen SELECT directo. Hay 142 funciones `SECURITY DEFINER`; todas
pertenecen a `postgres` y fijan `search_path` vacío. 39 RPC `public` y 3 RPC
`api` permiten `authenticated`, ninguna permite `anon` o `PUBLIC`. Se anotan
dos funciones trigger no-definer con EXECUTE heredado de PUBLIC para hardening.
Queda pendiente confirmar exposición del esquema Data API y probar límites
mediante identidades Auth reales de DEV.

La evidencia del run `40012156985` confirma que 001–014 se aplicó correctamente
como proceso. Sí existía un defecto funcional en SQL011 para la lectura de
encargados tras revocar una membresía; SQL016 lo corrigió. La definición remota
actual delega en un helper que exige membresía activa. El inventario en
`SUPABASE-DEV-RPC-REVIEW-20261026.md` ahora separa el conteo histórico del
catálogo remoto vigente. Dashboard y pruebas con identidades hosteadas aún son
pendientes; esto no equivale a aceptación integral del esquema ni de Auth.

---

# Estado histórico de ejecución — 26/10/2026

## Siguiente secuencia — Supabase DEV 015→016

Estado remoto consultado ahora: `grupo-paris-dev` activo, migraciones 001–014
(16 archivos) aplicadas. SQL015 tiene aceptación Sol previa y SQL016 tiene
aceptación Sol local para el hash
`F7E76313AD4132626034C5C9D38F1C70AFB140BB3E2CE3615FE89071945ED8F3`. La 016
corrige la lectura de tareas de encargado luego de revocar una membresía.
Pruebas focales de implementación y revisión independientes: 10/10, exit 0.

Los cambios y aceptación Sol ya están publicados en `main`. Ejecutar desde
GitHub Actions el workflow `Supabase DEV migrations` en dos pasos secuenciales: `apply_015` con
`apply_migrations=true`; confirmar estado exitoso e historial de 17; después
`apply_016` con `apply_migrations=true`, que debe mostrar sólo SQL016 en el
dry-run. No elegir `baseline_001_014` ni pegar SQL en el Dashboard. Si el
preflight no coincide exactamente, detenerse y revisar el historial.

La migración no certifica catálogo/ACL instalados ni seguridad integrada. Antes
de datos reales todavía falta verificar Data API (sólo esquema `api`), consultar
advisors, contrastar permisos instalados y ejecutar matriz negativa en DEV.

## Registro histórico — catálogo v2 publicado en Site v98 (26/10/2026)

La versión 98 del mismo Site privado se desplegó correctamente desde el commit
de fuente Sites `b0d09694d901e4d813d6d8fb333eef4af0491ec0`. Su árbol coincide
exactamente con GitHub `main` `ad1b4180556307755c7a4e0fd221316237fc341c`.
Deployment `appgdep_6adfd2a5c0ac81919f1d8a96c432f46c`, URL
`https://grupo-paris-contabilidad.valentino-magni.chatgpt.site`, owner-only para
`valentino.ialocal@gmail.com`. No se cambió audiencia. Actions run
`40409657073` pasó suite, build y paquete Sites; el build local pasó. La segunda
suite local fue interrumpida y no se usa como evidencia.

**Siguiente acción:** abrir el enlace en la PC personal con la cuenta ChatGPT
propietaria y confirmar si carga. Si no, registrar el mensaje exacto y la cuenta
activa; GitHub conectado no concede acceso al Site.

**Gate de datos reales:** sigue pendiente confirmar en Dashboard que sólo `api`
esté expuesto y validar el catálogo remoto/ACL, aplicar 015→016 en DEV y correr
la matriz de permisos. No exponer datos reales ni activar Auth operativo hasta
cerrar esos controles. Luego seguir con identidad, Storage/evidencia,
Cloudflare/correo y aceptación desde la PC personal. La suite verde no ofrece
certeza del 100%.

## Corte publicado más reciente — 26/10/2026

El catálogo de inicio neutral está implementado en el laboratorio y el parche
de `zod` y `vite` se publicó directamente en `main` como
`fb5b5d4751e841460d104479b22ebbe31ac9e1c7`. `npm audit --omit=dev` encontró cero
vulnerabilidades de producción. GitHub Actions run `40383506637` terminó en
éxito con instalación, suite, build y paquete Sites; el hook local aprobó
198/198 casos. Siguen 7 avisos de dependencias de desarrollo (5 moderados, 2
críticos); la migración de Vitest requiere revisión aparte.

El Site privado existente está publicado como v97, deployment
`appgdep_6adfa65a1ed081918f5fc8fd05bb72a9` (`succeeded`):
`https://grupo-paris-contabilidad.valentino-magni.chatgpt.site`. No se cambió
la audiencia: sólo la cuenta propietaria `valentino.ialocal@gmail.com` tiene
acceso; cero visitantes externos. En la PC personal hay que iniciar ChatGPT con
esa misma cuenta y abrir el enlace. La conexión de GitHub no otorga acceso al
Site. La apertura en el navegador del usuario aún no está confirmada.

Esto confirma el despliegue privado del laboratorio, no producción ni aceptación
sin errores. Próximos gates: (1) aceptación desde la PC personal y registro del
mensaje exacto si no abre; (2) verificar en Supabase Dashboard que Data API
exponga únicamente `api`; (3) auditar los 39 RPC `SECURITY DEFINER` y probar
permisos positivos/negativos en DEV; (4) completar autenticación y escrituras,
Storage/evidencia, hosting Cloudflare y correo; (5) aceptación integral antes de
habilitar el espacio operativo. No se puede afirmar certeza del 100%.

## Continuidad PC personal y línea base neutral — 26/10/2026

La continuidad técnica y decisiones del proyecto están en `main` y en las dos
ramas de archivo. El último corte de código sincronizado, commit
`366c2df92482dafcb66ec3f8d6d5e84f9e4b9aea`, pasó GitHub Actions
`40373683135` (instalación limpia, suite, build y paquete Sites). Esta
actualización documental requiere una nueva ejecución de CI. Mantener fuera
del repo credenciales, memoria/chats privados, estado local del navegador y
datos personales/de clientes. El respaldo de laboratorio debe moverse aparte y
de forma privada si se necesita en la PC personal.

El catálogo neutral está implementado sólo en el alta del laboratorio; el
primer inicio remoto sigue sin ser un flujo real autenticado. El seed actual no
se cambia y mantiene sus IDs históricos. La estimación vigente sigue siendo sólo 13
perfiles ficticios/73 ocurrencias de muestra; el Site contiene un snapshot del
06/10 y Supabase DEV no contiene filas operativas. Para cifras actuales hace
falta un extracto autorizado y anonimizado de la fuente real.

**Catálogo neutral v2:** GPT-6.1 Sol revisó y aceptó localmente el alcance y sus
casos de compatibilidad; GPT-6 Luna implementó los ajustes. Resultado: 832/832
pruebas en 83 archivos, TypeScript, builds cliente/Worker y `git diff --check`
aprobados. Esta revisión cubre el prototipo de laboratorio, no el onboarding
autenticado.

**Estado de publicación:** el commit `a51bc395dbd2d2ec65ee3f328287c1be8cd3d6b4`
está en `main`, con autor Tablero Contable y sin PR. Actions run `40408104684`
terminó en éxito. El mismo Site sigue en v97. La lectura de Site lo reconoce
como propio y privado; crear la credencial de su repositorio fuente falla con
`NOT_FOUND`, así que no se intentó guardar ni desplegar una versión nueva.

**Próximos gates, en orden:** (1) resolver la emisión de credencial de la fuente
del Site existente y desplegar v2 sin cambiar audiencia; (2) abrirlo desde la PC
personal con la cuenta propietaria y clonar/trabajar desde `main`; (3) confirmar
en Dashboard que Data API exponga sólo `api`; (4) auditar los 39 RPC
`SECURITY DEFINER` y completar pruebas positivas y negativas de permisos en DEV,
sin modificar grants a ciegas; (5) obtener, sólo con autorización, un extracto
anonimizado para estimar dotación y actividad reales; (6) continuar
Auth/escrituras, evidencia/Storage, Cloudflare/correo y aceptación integral. No
habilitar producción ni el área operativa antes de esa aceptación.

Última consulta read-only de Advisors: ver
`architecture/SUPABASE-DEV-ADVISORS-20261026.md`.

## Supabase DEV: conexión resuelta y baseline aplicado

El secreto `SUPABASE_DEV_DB_URL` funciona. GitHub Actions run `40367149794`
validó la URL y se conectó; el paso falló porque el workflow antiguo esperaba
un historial vacío y DEV ya tiene 16 versiones remotas. Supabase MCP confirmó
que coinciden exactamente con las migraciones locales 001–014. Ese run no
ejecutó SQL. La aplicación previa fue correcta en Actions run `40012156985`.

Se actualizó `supabase-dev-preflight.yml` para comprobar el historial exacto
001–014 ya aplicado sin ejecutar SQL. SQL015 sigue pendiente. No vuelvas a
cambiar la contraseña ni reejecutes la aplicación del baseline.

Siguiente gate: desde Supabase Dashboard, confirmar Data API → Exposed schemas
con sólo `api`; luego completar pruebas positivas y negativas de permisos con
identidades ficticias. El modo remoto de la app sigue apagado por defecto y el
espacio operativo permanece inactivo. No tocar producción.

Cloudflare y correo continúan pendientes. Evidencia de advisor en la auditoría
Supabase DEV y readiness en
`docs/architecture/REMOTE-MIGRATION-READINESS-20261021.md`. Los registros
anteriores debajo se conservan como historial; no usar sus instrucciones de
URI faltante o base vacía.

## Publicación confirmada y próxima puerta

- El Site existente conserva su versión y audiencia owner-only; no se cambió en este paso.
- Supabase `grupo-paris-dev` tiene 16 migraciones 001–014 y tablas sin datos de negocio.
- SQL015, Auth/UI remotos, permisos de identidad, Data API, Storage, Cloudflare, correo, producción y aceptación en PC personal siguen pendientes.
- La aplicación continúa como laboratorio con perfiles ficticios; no se activó el espacio operativo ni se agregaron usuarios al Site.

## Historial de ejecución anterior al baseline — no vigente

Los siguientes registros se conservan para trazabilidad. Sus referencias a
URL pendiente, cero migraciones, migraciones por aplicar o cliente aún no
montado corresponden a cortes anteriores y quedan supersedidos por el estado
vigente de este documento.

- El código ya conecta el modo opt-in de Supabase Auth con `MyWork` de sólo lectura. El laboratorio sigue por defecto; todavía no se probó el modo contra Supabase alojado ni hay escrituras RPC desde la UI.
- No hubo un nuevo preflight después del rechazo de URL. El secreto `SUPABASE_DEV_DB_URL` existe en Actions; actualizarlo con el URI Session pooler de DEV y repetir el preflight read-only. No compartir su valor en el chat.
- Después del preflight: aplicar/auditar 001–014 en DEV; revisar y aplicar SQL015 por separado; probar Auth/MFA y `MyWork` con identidades ficticias. Luego ampliar módulos y comandos RPC de forma incremental, incorporar Storage/evidencia, Cloudflare y correo, y aceptar desde la PC personal.

- Último commit publicado antes de este corte local: `158b2a0d4ab0251f1a775b332ccd3497e59ec92f`; GitHub Actions `39978569509` pasó suite, build y paquete Sites. El repositorio aislado de lectura queda pendiente de publicar y validar en CI.
- El hook aprobó 196/196 pruebas. El bootstrap optativo pasó revisión Sol y la suite completa 787/787 en 80 archivos, TypeScript y builds cliente/Worker. Código y evidencia ya están publicados.
- Lectura Supabase de hoy: `grupo-paris-dev` activo, 0 migraciones y 0 tablas en `public`, `api` y `app_private`.
- SQL015 está aceptada por Sol para DEV en el hash exacto `CC49480D1317F1B44CD29F245508F9C8FB0B0894FE4E66C1B22F8E00D36B33F2`, pero no aplicada.
- Próximo bloqueo operativo: agregar `SUPABASE_DEV_DB_URL` como secreto de Actions desde GitHub; no compartir el valor por chat. Luego correr preflight sin escrituras para 001–014, revisar destino/historial/dry-run, aplicar y auditar. SQL015 va en ejecución separada.
- La app conserva laboratorio por defecto. El bootstrap autenticado, si se activa explícitamente, sólo ofrece diagnóstico; no abre tablero ni comandos. Cloudflare, correo, hosting, producción y validación de PC personal siguen después.

La puerta `SupabaseAuthGate` ya tiene inicio/cierre de sesión, identidad derivada de `get_context_v1`, MFA TOTP requerido para jefe/encargado, guardas para respuestas asíncronas obsoletas y formulario de acceso. Validación actual: 7 pruebas enfocadas; suite 760/760 en 77 archivos; TypeScript, build cliente y build Worker aprobados. La prueba nueva confirma el enrolamiento TOTP obligatorio para encargado. Esto sigue sin conectar `src/main.tsx` ni activar el área operativa remota.

Supabase DEV fue reconsultado el 21/10/2026: 0 migraciones y 0 tablas en `public`, `api` y `app_private`; no hubo escrituras remotas.

Siguiente: Sol revisa la implementación local exacta de SQL015 y su evidencia; sólo tras aceptar el hash puede habilitarse su puerta de aplicación en DEV. En paralelo, ejecutar el preflight sin escrituras de 001–014; sólo si destino, historial y dry-run coinciden, aplicar ese segmento. Después conectar y validar la app. Cloudflare, correo y prueba desde la PC personal siguen pendientes.

---
# Próximo paso vigente — preflight remoto de Supabase dev, 21/10/2026

## Estado agregado del cliente — 21/10/2026

Commit `e8b8eb2` en `main` contiene `src/data/supabase/client.ts`, plantilla
`.env.example` y pruebas. El cliente acepta sólo clave publishable/anon, URL
HTTPS (HTTP localhost para desarrollo) y habilita persistencia/renovación de
sesión. Prueba enfocada 9/9; suite completa 753/753, TypeScript y builds cliente
y Worker aprobados; hook 196/196. La aplicación sigue montando el laboratorio;
la nueva fábrica aún no está conectada al inicio ni a pantallas operativas.

**Corte Sol original:** Gate L fue aceptado para el hash SQL014
`218DEA9E9E3097743BD09238E73D5840A664F6718AEBE7670B88AF064278A837` en alcance
sintético. Luego se eliminaron los delimitadores `BEGIN`/`COMMIT` para preservar
la transacción por archivo de Supabase CLI. El hash candidato actual es
`BC09CF9631A2F3E4BD19541C2A050AB1C663AE0E704D47D7E5A4752B114E0345`.
La atomicidad de BC09 se probó con Supabase CLI 2.121.0 en PostgreSQL 17.11:
fallo tardío por CLI dejó intactas 15 versiones y revirtió objetos 014; el retry
con el archivo exacto pasó. Evidencia en
`architecture/SUPABASE-DEV-CLI-TRANSACTION-LOCAL-PREFLIGHT-20261021.md`.
**Aceptación suplementaria Sol:** BC09 queda aprobado para aplicar únicamente
en `grupo-paris-dev` mediante CLI 2.121.0, `db push --skip-vault --yes`. No cubre
producción, datos/usuarios reales ni activar el espacio operativo. Dictamen en
`architecture/SUPABASE-DEV-INITIAL-MIGRATION-SOL-REVIEW-20261021.md`.

**CLI comprobada sin instalación en la PC del usuario:** Supabase CLI 2.121.0,
descargada temporalmente y verificada contra el SHA-256 oficial del release,
reconoció exactamente las 16 versiones locales de 12 dígitos. `migration list`
las emparejó con el PostgreSQL 17.11 descartable; `db push --dry-run` enumeró
las mismas 16 y no creó tablas ni historial. La evidencia reproducible está en
`architecture/SUPABASE-DEV-CLI-LOCAL-PREFLIGHT-20261021.md`.

**Destino remoto sigue vacío:** `grupo-paris-dev`, ref `kynqjfhqujnjojcmurwf`;
lectura Supabase de hoy: 0 migraciones y 0 tablas en `public`, `api` y
`app_private`. No se ejecutó `db push` remoto. El interruptor de autoexposición
de tablas nuevas continúa apagado.

## Siguiente puerta

El workflow manual ya está publicado en `main` desde el commit `83249f0`.
Ejecutar
`.github/workflows/supabase-dev-migrations.yml` en `main`, primero con
`Apply migrations` desmarcado. Usa la URL Session pooler de DEV; guardar su valor
como secreto `SUPABASE_DEV_DB_URL` en Settings → Secrets and variables → Actions,
nunca en el chat. Valida proyecto/host/puerto/TLS, hash aceptado de SQL014 y las
16 versiones locales frente a 0 remotas; el dry-run lista el orden exacto. Revisar
ese resultado antes de volver a ejecutar con `Apply migrations` seleccionado.
Ese segundo paso aplica sólo en DEV y verifica el historial final.

Después auditar versiones, esquema, RLS, grants, funciones y advisors; configurar
Data API para exponer únicamente `api`. Producción sigue fuera de alcance. Luego
continúan Auth/API sintética, Storage/restore, frontend, CI, Cloudflare, correo y
prueba desde la PC personal. Mantener Site privado, datos ficticios y espacio
operativo apagado.

Esta cabecera supersede próximos pasos históricos debajo.

# Próximo paso — familia A y publicación del corte C

Familia C aceptada por Sol localmente: `approve_task_coverage_plan` y
`cancel_task_coverage_binding`. Aceptación SHA-256
`64A2B9D3F9024E307FC21DCBEB38B810208B551C8DA2BE8DFEB6CE094FD8F8A1`;
SQL014 candidata SHA `CE85FFB750443CB54CC25DD55AE25831CCFE71D8A10EA143D54C34855009447D`.
El manifiesto y los reportes locales/canónicos están identificados en la
aceptación.

1. Actualizar inventario §9 y continuidad; publicar juntos T+C directamente en
   `origin/main`, sin PR.
2. GPT-6.1 Sol define contrato aislado A para `approve_employee_absence` y
   `cancel_employee_absence`; no ampliar `_get_mutation_receipt` globalmente.
3. GPT-6 Luna implementa con rojo primero, verdes, concurrencia necesaria y
   evidencia; Sol revisa hashes y alcance.
4. Resolver P con dictamen de política, después cruce consolidado §9/Gate L.
5. Sólo con Gate L aceptado y settings Data API revisados, preparar preflight y
   migración Supabase dev. Luego Auth/API/Storage/front-end, CI, Cloudflare,
   correo y validación desde la PC personal.

No hubo migración alojada en los cortes T/C. Mantener Site privado, datos
ficticios y espacio operativo apagado.

# Próximo paso — etapa C/A/P de §9

Etapa T (replays de controles legacy de tarea) aceptada por GPT-6.1 Sol en
alcance local acotado. Aceptación:
`docs/architecture/M2-2C-LEGACY-TASK-CONTROL-REPLAY-SOL-ACCEPTANCE-20261020.md`
(SHA-256 `638EA12EF904AC9F72873854F15AAFAABFD17DEF7B2E0D892B7F11F3636C4B7B`).
SQL014 candidata SHA-256
`19EC849B0397602B7DC03939539D37F0999FE808FD21A91B227E7767F4BF9FC3`.

1. Registrar/pulir este corte, commit y push directo a `origin/main`, sin PR.
2. GPT-6.1 Sol revisa el residual §9 y fija contrato de siguiente unidad entre
   C (supervisión de cobertura), A (supervisión de ausencias) y P (política de
   cleanup/privacidad); no repetir matrices ya aceptadas.
3. GPT-6 Luna implementa sólo el contrato aprobado; Sol reaudita hashes y
   alcance antes de publicar.
4. Repetir el esquema para cerrar §9 y Gate L. Recién entonces revisar
   configuración Data API, preflight H y despliegues de Supabase/Auth/HTTP/
   Storage, frontend, CI, hosting y correo.

Sin migraciones ni escrituras remotas en esta etapa. Mantener Site privado,
datos ficticios y espacio operativo apagado. No afirmar migración completa.

# Continuidad vigente — replay de responsabilidad aceptado localmente, 20/10/2026

Sol aceptó `public.assign_task_responsibility` en alcance local acotado.
Contrato y aceptación: `architecture/M2-2C-LEGACY-RESPONSIBILITY-REPLAY-AUTHORIZATION-SOL-CONTRACT-20261019.md`
y `architecture/M2-2C-LEGACY-RESPONSIBILITY-REPLAY-SOL-ACCEPTANCE-20261019.md`.
SQL014 candidata SHA `CDD909C1A280DF8E891D6062838B146AEECADCF5CBC0F52291C6D44A0C89ECA2`;
aceptación SHA `233ADBE22F7DFB2BE135D6AAE08E232530688D291D07BB05EAE8B7964AFB018E`.
Rojo confirmado; 28 casos secuenciales y 8/8 carreras; matriz nativa 351/351,
suite 738/738, TSC, builds cliente/Worker, sintaxis y diff-check aprobados.
Manifiesto versionado SHA `478157350FC4ED3561EE5DF6BD940E0B79E20D339E8D6861F16B3B1182E71C1F`,
33/33 rutas y hashes correctos. SQL001–013 intactas. La aceptación registra el
límite P3 del contexto AAL1.

El corte está publicado directamente en `origin/main`, sin PR, en
`53f37f09d04e871bbc15ae88c8b8362472753a95`; el SHA remoto fue confirmado. No
aplicar SQL014 ni activar el espacio operativo. GPT-6.1 Sol debe auditar §9 y
seleccionar la siguiente unidad de migración. Gate L, Auth/HTTP, Data API,
Storage/restore, CI, hosting, correo y producción siguen abiertos.

Esta actualización supersede el encabezado anterior; los registros siguientes
son historial.

# Continuidad vigente — replay legacy de cronómetro aceptado, 19/10/2026

Sol aceptó en alcance local acotado la reautorización del replay legacy de
`public.start_task_timer`. Contrato y aceptación: `architecture/M2-2C-LEGACY-TIMER-REPLAY-AUTHORIZATION-SOL-CONTRACT-20261019.md`
y `architecture/M2-2C-LEGACY-TIMER-REPLAY-AUTHORIZATION-SOL-ACCEPTANCE-20261019.md`.
SQL014 candidato SHA-256 `C6A4ACDD92653DFFE9A0576EC3D8FBC906B2562E3BFAC056B8561981A4203EC8`;
manifiesto `architecture/review-evidence/m2-2c-legacy-timer-replay-auth-luna-20261019-manifest.json`
(SHA-256 `BDD92D3416A9A27C1EBFE82E3645AD82318BCFB3A1A3CAD66F8321A943771859`).
Reproducción roja contra SQL014 exacta del baseline; 23 eventos verdes, ocho
carreras bloqueadas; matriz nativa operativa 351/351 baseline y candidata;
suite 738/738 en 74 archivos y TypeScript/builds/sintaxis/diff-check exit 0.
SQL011–013 intactos. SQL014 no se aplicó ni se hicieron llamadas alojadas.

Supabase dev consultado en modo lectura: proyecto activo y vacío, lista de
migraciones vacía; Data API no verificada. No aplicar migraciones hasta aceptar
Gate L y cerrar la configuración Data API exigida por el contrato.

**Próximo paso:** Sol cruza §9 con la evidencia acumulada y selecciona el
siguiente replay legacy pendiente (`record_activity_once` o
`assign_task_responsibility`); Luna implementa sólo el contrato Sol resultante.

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

# Acción vigente de migración — actualización 19/10/2026

## Último bloque aceptado localmente por Sol — timer/revocación

GPT-6 Luna agregó cuatro carreras `public.start_task_timer` frente a
`companyMembership.setActive(false)`, en ambos órdenes bajo RC/RC y RR/RR.
PostgreSQL nativo 17.11: 325/325, cuatro blockers reales, resultados/reintentos
del contrato exactos y cero deadlocks. El resultado incluye sesiones, recibos,
auditoría y fences. La suite completa pasó **738/738 en 74 archivos**;
TypeScript, builds cliente/Worker, sintaxis y diff-check terminaron con exit 0.
Los hashes y resultados se registran en el manifiesto
`architecture/review-evidence/m2-2c-timer-start-membership-revocation-races-luna-20261019.json`.
Runner SHA256 `fa7bf8da251a9fce4b0a4cc31f5152fdd2cbb5bc30c1d1e5b2ca48b03b9a4b23`;
manifiesto SHA256 `82e6c67ad663e0310e36cae33d8bd0fc049845ec941ea61b33355222c390d16a`.
Aceptación y límites P3:
`architecture/M2-2C-TIMER-START-MEMBERSHIP-REVOCATION-RACES-SOL-ACCEPTANCE-20261019.md`.
Publicado directamente a `origin/main`, sin PR, en
`0ff1df0eebc1237d60b08fed6450f6f21f401006`; SHA remoto confirmado. CI no está
verificado; SQL011/014 siguen intactas.

## Último bloque aceptado localmente por Sol — operation.record/revocación

GPT-6 Luna implementó los cuatro escenarios RC/RC y RR/RR. PostgreSQL nativo
321/321, cuatro blockers reales y outcomes SQLSTATE/retry conformes; Vitest
738/738, TypeScript, builds cliente/Worker, sintaxis y diff-check con exit 0.
La aclaración de Sol sobre fences está incorporada en el contrato y las cinco
claves se validan en cada snapshot. Informe y hashes:
`architecture/review-evidence/m2-2c-operation-record-membership-revocation-races-luna-20261019.json`.
El runner vigente tiene SHA256 `756295076e72cb35981d5ae30ac282bf5b508846c822b3cc4cf14b5032643ea9`;
los logs crudos están en `../../outputs/m2-2c-operation-record-membership-revocation-races-luna-20261019-final4/`.
Aceptación y límites P3:
`architecture/M2-2C-OPERATION-RECORD-MEMBERSHIP-REVOCATION-RACES-SOL-ACCEPTANCE-20261019.md`.
Publicado directamente a `origin/main`, sin PR, en
`cf37b7fe220befa5317e4ae3295514288e96ff6e`; SHA remoto confirmado. CI no está
verificado. SQL011/014 siguen sin cambios; Gate L/§9 permanece abierto.

## Bloque completado — assignment.create/revocación

Esta matriz está aceptada localmente en alcance acotado, según la cabecera y
su aceptación registrada. La instrucción anterior de implementarla queda retirada.

## Último bloque local aceptado por Sol — cobertura contra onboarding

Luna implementó el contrato
`architecture/M2-2C-COVERAGE-CANCEL-ONBOARDING-APPROVAL-RACES-LUNA-20261019.md`.
Las cuatro carreras focales pasaron con resultados específicos por orden y
aislamiento; runner 317/317, Vitest 738/738, TypeScript y builds cliente/Worker,
sintaxis y diff-check aprobados. Ver informe con snapshots, SQLSTATE, receipts
y hashes en
`architecture/review-evidence/m2-2c-coverage-cancel-onboarding-approval-races-luna-20261019.json`.
Aceptación acotada y límites P3:
`architecture/M2-2C-COVERAGE-CANCEL-ONBOARDING-APPROVAL-RACES-SOL-ACCEPTANCE-20261019.md`.
Los logs crudos están fuera del Git root. No se cambió SQL ni hubo llamadas
remotas. Esto no cierra §9/Gate L.
Commit directo a `main`, sin PR, en `4c598f575d1465ba3218af4b2da6ef3bca93aed4`;
el SHA remoto está confirmado. CI de este push no está verificado.

## Último bloque local aceptado — transición frente a revocación

GPT-6 Luna agregó cuatro carreras locales `task.transition` vs
`companyMembership.setActive`, RC/RC y RR/RR con ambos ganadores. El runner
focal terminó 305/305 en PostgreSQL 17.11, `40P01=0`; las cuatro observan
bloqueo, validan actores distintos autorizados, conflicto/retry y snapshots.
Evidencia y hashes en
`architecture/review-evidence/m2-2c-transition-membership-races-luna-20261019.json`.
Sol aceptó este alcance tras revisar hashes, SQL014 y el reporte. Decisión y
límites P3: `architecture/M2-2C-TRANSITION-MEMBERSHIP-RACES-SOL-ACCEPTANCE-20261019.md`.
Publicado directo a `main`, sin PR, en
`6d014381cf5888fe4aafa79e4be3ae0248e74531`; SHA remoto confirmado. Suite,
TypeScript, builds, sintaxis, diff-check y hook 196/196 pasaron. GitHub devolvió
checks vacíos, por lo que CI no está verificado. Mantener Gate L y §9 abiertos;
no aplicar SQL014.

## Bloque completado — operation.record/revocación

Esta matriz está aceptada localmente en alcance acotado, según la aceptación
y el manifiesto conservados arriba. La instrucción anterior de ejecutarla queda retirada.

El último bloque `assign_task_responsibility`/`onboarding.approve` quedó aceptado
localmente por Sol; ver
`architecture/M2-2C-RESPONSIBILITY-ONBOARDING-APPROVAL-RACES-SOL-ACCEPTANCE-20261019.md`.
El código y su evidencia están publicados directo a `main`, sin PR, en
`5425d99589f5edfcca1b2224753a0c5c1d2c1332`; el SHA remoto fue verificado. El
hook terminó 196/196 pero devolvió código 1 después de crear el commit; CI no
está verificado.

## Último bloque local aceptado — cobertura recurrente RC/RC y RR/RR

GPT-6.1 Sol aceptó únicamente las cuatro carreras agregadas para ambos
ganadores bajo RC/RC y RR/RR. PostgreSQL 17.11 **301/301**, `40P01=0`; suite
**738/738** en 74 archivos; TypeScript, build cliente/Worker, sintaxis del runner
y diff-check aprobados. Evidencia y límites:
`architecture/review-evidence/m2-2c-recurrent-same-isolation-luna-20261019.json`.
La revisión usó hashes del contenido sobre baseline `2b60c21…`. El código y su
evidencia están publicados como `660f75dcc9a9d4a5ab698e84d3ff0ae23a0f2068`; este
estado/contrato quedó en `8646f10ee90371748054830ef4af81cf4904f577`. SHA remoto
confirmado; GitHub devolvió checks vacíos, por lo que CI no se acredita. SQL014
sigue sin aplicar; Gate L/§9 sigue abierto.

1. Los bloques anteriores de onboarding y cuatro carreras mixtas están publicados y aceptados en sus alcances.
2. Sol aceptó localmente cuatro carreras adicionales RC/RC y RR/RR. PostgreSQL 17.11 **301/301**, `40P01=0`; suite **738/738 en 74 archivos**; TypeScript y builds cliente/Worker aprobados. Ver manifiesto vigente arriba.
3. Hook local **196/196**, commits directos a `main` y SHA remoto verificados; no se abrió PR. La API disponible aún no devuelve checks para esos pushes, así que la verificación CI queda pendiente.
4. **Selección completada:** se eligió primera alta task.createOneOff frente a
   revocación de membresía. La cabecera fija como único próximo paso revisar
   su contrato Sol; aún no se autoriza implementar ni ejecutar la matriz.

# Acción de migración histórica — 17/10/2026

1. **Aceptación acotada R90:** Sol aceptó los escenarios enumerados para SQL014 y runner, PostgreSQL 17.11 **128/128**, `40P01=0`. No cierra M2.2C/Gate L completos. Hashes y límites: `architecture/M2-2C-SOL-ACCEPTANCE-20261017.md`; evidencia `architecture/review-evidence/m2-2c-membership-r90-20261017.json`. Quedan matriz onboarding/creation, writers legacy y concurrencia/inyección de fallos del contrato §9.
2. **Fix acotado de replay aceptado; Gate L abierto:** se corrigió el replay exacto `onboarding.submit` después de revocación y se agregó regresión de replays y primera ejecución bajo carrera. Sol aceptó sólo esos casos: SQL014 SHA256 checkout `13e88c8549f969187294367161c3ce6cf458d7f4618ddba40cb5058254982a26`, normalizado LF `b593618d1fcc11fe0be5e6678574faba8a013e4ac587e303d7f00d49dbe05e49`. PostgreSQL 17.11 pasó 130/130, `40P01=0`; Vitest focal 11/11 y suite completa 727/727 en 74 archivos; TypeScript, cliente, Worker, sintaxis del runner, diff-check y verificación de 001–013 también pasaron. Evidencia y hashes: `architecture/review-evidence/m2-2c-gatel-onboarding-replay-20261017.json`; repro/causa: `architecture/M2-2C-GATEL-REPLAY-DEFECT-20261017.md`. El commit local vigente espera revisión Sol de su contenido exacto antes del push. Esto no es aceptación Gate L. Siguen pendientes writers legacy, cobertura recurrente y las matrices completas de §9. Mantener 014 sin aplicar y no iniciar preflight alojado.
3. El checkpoint `8cf5e8a3e6969cfe02d77c595698c5f60ddfa8f5` está publicado directamente en `origin/main`; CI de ese commit terminó success (npm ci/test, build y validación Sites). El commit local vigente contiene el fix aceptado de replay y la evidencia; tras la revisión Sol del commit exacto, publicarlo directamente a `main`, sin PR.
4. El repositorio fuente está en GitHub privado `tablerocontable-paris/TABLERO-CONTABLE`, rama única `main`. La guía de PC personal es `outputs/LEEME-PC-PERSONAL.md`; IndexedDB/localStorage no se sincroniza con GitHub.
5. Proyecto Supabase `grupo-paris-dev` existe en la organización visible `tablerocontable-paris DEV`, región `sa-east-1`, activo y vacío. La Data API aún muestra `public,extensions` expuestos y autoexposición activada según la última observación. No aplicar migraciones hasta comprobar exposición segura y completar el preflight en el proyecto vacío.
6. Cloudflare/hosting propio, correo productivo, Supabase de producción y flujo de release permanecen pendientes. El Site privado existente sigue separado; no abrir audiencia ni activar la app operativa.

# Acción histórica — completar M2.2C localmente, 16/10/2026

**Registro histórico supersedido — R51 (no usar como estado actual).** R51
reportó 96/96 sobre un candidato anterior que todavía no tenía el writer soft
de membresía. Su probe hacía `DELETE` y recibía `23503`; no describe el árbol
actual. También son históricos sus gates de suite/build. Ver el primer punto
vigente y el JSON consolidado para R35 y las correcciones posteriores. No
aplicar 014 ni inferir cobertura actual desde R51.

# Acción histórica — GPT‑6.1 Sol revisa M2.2A-R7/R8, 15/10/2026

La implementación local está completa. Evidencia:
`architecture/review-evidence/m2-2a-r7r8-implementation-20261015.json` y los
reportes nativos en `../../outputs/m2-2a-r7r8-implementation-20261015/`.
Pasaron sondas20/20 (18 base +2 rateHistory), nativo6/6, R6 30/30 e
independiente9/9, protocolo15/15, PostgreSQL RC/RC61/61, RR/RR61/61, los dos
cruces43/43, suite712/712, TypeScript, builds cliente/Worker, sintaxis y
diff-check. El reporte captura SHA‑256 de 014 y pares de aislamiento efectivos.

Siguiente: **GPT‑6.1 Sol, esfuerzo alto, Standard**, revisión independiente de
R7/R8 y del candidato A. Conservar SQL001–013/DTO/UI/Worker/Site. Hasta esa
decisión no iniciar B/C, aplicar o desplegar014, conectar cuentas ni declarar
aceptada M2.2A. El ~45% sigue siendo histórico; no recalcular por este bloque.

## Acción anterior — preparar el candidato R6 para revisión

La corrección NULL-safe de 014 ya está implementada y validada. Evidencia vigente:
`architecture/review-evidence/m2-2a-r6-implementation-20261015.json`; contrato
ejecutado: `architecture/M2-2A-NULL-SAFETY-LUNA-20261015.md`; informe que originó
la corrección: `architecture/M2-2A-FINAL-REVIEW-20261015.md`.

Resultados: matriz R6 30/30, sonda independiente 9/9, pruebas previas 15/15,
focales 17/17, PostgreSQL nativo 61/61 RC/RC + 61/61 RR/RR + 43/43 RC/RR +
43/43 RR/RC, suite 712/712, TypeScript y builds de cliente/Worker aprobados.

El commit de código R6 es **08b7405** y el commit de evidencia **de38b3d**;
ambos hooks automáticos pasaron **196/196 en 19 archivos**. Bundle y ZIP se
verificaron en clonación limpia; el HEAD restaurado coincide con el manifiesto.
Paquete: `outputs/m2-2a-r6-candidate-delivery-20261015`.

Siguiente acción: **GPT‑6.1 Sol, esfuerzo alto, Standard**, revisa el commit y el
paquete como evaluador independiente. Si acepta M2.2A, define el contrato B/C.
No iniciar B/C antes de la aceptación, ni desplegar 014 ni conectar cuentas.
Conservar 001–013/UI/Worker/Site. Avance ~45% histórico, sin recalcular.

## Acción anterior — revisión del candidato M2.2A (15/10/2026)

R1–R5 ya están corregidos y revalidados. PostgreSQL 17.11: **61/61 RC/RC** y
**61/61 RR/RR**; replay y revocación cruzados: **43/43 RC/RR** y **43/43 RR/RC**.
PGlite/protocolo **15/15**, suite **712/712**, TypeScript, build cliente y Worker
con código 0. Comandos, salidas y hashes:
`architecture/review-evidence/m2-2a-corrections-validation-20261015.json`.

El candidato de implementación está en el commit **9c096973**. El bundle portátil
con las ramas `main` y `migration/github-bootstrap` se verificó y clonó en limpio
con ese HEAD. También pasó el hook automático **196/196**; la suite completa es
**712/712** y las cuatro matrices nativas suman **208/208** ejecuciones aprobadas.
La entrega local está en `outputs/m2-2a-candidate-delivery-20261015`.

**Siguiente paso:** **GPT‑6.1 Sol, esfuerzo alto, Standard** revisa el diff exacto,
los contratos de permiso/MVCC, migración 014, evidencia y matrices; decide aceptar
o devolver hallazgos y define B/C. Conservar 001–013 y UI/Worker/Site; no desplegar
ni conectar cuentas. No hay integración alojada comprobada. Avance ~45% histórico,
sin recalcularlo.

## Evidencia anterior de implementación — supersedida por la matriz completa

Continuar el contrato `architecture/M2-2A-OPERATIVE-API-LUNA-20261015.md` sobre
la migración local 014. El último runner PostgreSQL nativo pasó 35/35, incluyendo
pruebas nuevas de snapshot RR obsoleto tras baja de perfil y cierre mensual, sin
actividad ni recibos. El upgrade PGlite 013→014 conserva sesiones, recibos legacy,
notas privadas/versiones y snapshots; decoder 16/16. TypeScript, builds cliente y
Worker y suite completa 712/712 en 72 archivos también pasaron.
El recorrido y evidencia están en
`architecture/review-evidence/m2-2a-implementation-20261015.json`.

Ese primer corte no incluía todos los ordenamientos RC/RR. La matriz completa
posterior está registrada en la actualización vigente al inicio de este archivo.
Mantener 014 local, sin conexión de cuentas, despliegue, handlers UI ni cambios
a 001–013.

> **Registro previo 15/10/2026: GPT-6 Luna, medio, Standard.** M2.1 aceptado localmente, informe `architecture/M2-1-SOL-ACCEPTANCE-20261015.md`. El contrato de A se completa ahora con las correcciones indicadas al inicio. M2.2 completo requiere A/B/C; B/C esperan contrato posterior. Mantener 014 local sin desplegarlo incompleto ni iniciar 015. Sin remoto GitHub nuevo. El runner nativo de aceptación M2.1 usa --review-matrix full (42/42).

> Registro histórico del cierre de auditoría Sol (11/10/2026): en ese corte se identificaron 65 hallazgos/95 casos y la siguiente acción era implementar la etapa 1 con Luna. El estado actual figura en la actualización del 12/10 inmediatamente debajo.

> **Nota histórica 14/10/2026 (supersedida para MVCC local):** la ruta del
> instalador EDB fue cancelada por Windows y no se creó servicio. Más tarde se
> extrajeron los binarios oficiales portátiles y se completó la prueba local
> PostgreSQL/MVCC, documentada en la reejecución vigente abajo. La aceptación
> humana con lector de pantalla continúa abierta; no se modificó SQL ni se
> conectaron cuentas.

# Estado de ejecución vigente — 14/10/2026

## Corte anterior — implementación M2.1 del14/10, aceptada el15/10

La implementación de correcciones para 013 quedó localmente completa: PostgreSQL
17.11 nativo **24/24**, Vitest **690/690 en69 archivos**, TypeScript y builds de
cliente/Worker aprobados. Incluye upgrade poblado 012→013 con familias de datos
no vacías, pruebas de ACL/default privileges, cuatro estados de identidad dual y
rollback de fence. Evidencia: `architecture/review-evidence/m2-1-corrected-implementation-20261014.json`.
El diff está en `migration/github-bootstrap`; primero completar el commit y el
bundle portable de esta fase. Luego seleccionar **GPT-6.1 Sol, esfuerzo alto,
Standard** para revisar cambios, hashes, carreras, privacidad y criterios del
contrato M2.1. No iniciar 014/M2.2, conectar cuentas ni desplegar antes de su
aceptación. Sin cambios en App, Worker/D1, Site o migraciones 001–012. El avance
global orientativo sigue ~45% y no se recalcula con esta etapa local.

## Revisión de aceptación posterior — acción vigente

S38/S44 aceptados técnicamente tras revisión independiente del código y 69/69
comprobaciones en cinco archivos: foco con detalle abierto, Escape, sondeo durante
apertura, respuesta de montaje anterior, propuesta antes del debounce y revisión
correcta del POST. Los cinco hashes coinciden con el corte de implementación;
se conserva su suite 668/668 y build, sin repetirlos al no cambiar producto.
El runner S52 y su captura estable también quedan aceptados. Evidencia:
`docs/architecture/review-evidence/s38-s44-independent-acceptance-20261014.json`.

Las siete etapas quedan revisadas en su alcance técnico local. Etapa 5 conserva
únicamente la aceptación humana con lector de pantalla. Ejecutar
`docs/runbooks/SCREEN-READER-ACCEPTANCE-LAB.md` y registrar los resultados antes
de afirmar aceptación funcional completa. Narrador está presente en esta PC.
No hacen falta instalaciones ni cuentas para ese recorrido. Después consolidar
el corte validado en Git y actualizar el paquete de PC personal; una revisión de
código aprobada no acredita ese commit, el paquete ni una publicación.

Modelo para acompañar la aceptación: **GPT-6.1 Sol, esfuerzo medio, Standard**.
Si aparecen defectos concretos, documentar contrato y pasar a Luna medio para
corregirlos. No hay un nuevo contrato de código pendiente en este bloque.

## Registro de implementación — S38/S44 y captura S52

S38 quedó corregido: el foco principal ahora pertenece al botón Siguiente/Listo
del recorrido, y el retorno al primer paso recupera un control habilitado. S44
ahora asigna una secuencia monotónica por lectura, descarta sondeos viejos,
invalida lecturas al guardar/cambiar contexto y evita sondear durante una apertura
explícita. El runner S52 espera 500 ms de geometría SVG estable antes de capturar.

Aceptación local: suite completa **668/668 en 67 archivos**; TypeScript, build
Vite, build Worker y Edge **32/32** pasan. Edge reporta cero errores JS y cero
llamadas a la API operativa. Evidencia:
`docs/architecture/review-evidence/s38-s44-followup-20261014.json` y
`outputs/s39-tour-refresh-20261014/edge-final-retry/browser-validation.json`.
Los cambios no se comprometieron ni publicaron porque el árbol ya contenía
cambios ajenos a esta corrección. No se conectaron servicios.

Siguiente: revisión independiente **GPT-6.1 Sol, esfuerzo alto, Standard** de
S38/S44 y del diff acotado. Etapa 5 aún requiere aceptación humana con lector de
pantalla; etapa 7 no acepta servicios alojados ni Supabase Auth/RLS.

## Registro histórico de revisión inicial — supersedido por la aceptación

Se confirmaron dos correcciones incompletas de contratos originales: S38 deja
foco en Anterior deshabilitado al volver al primer paso; S44 acepta un sondeo
antiguo después de otro más nuevo. Sus pruebas independientes fallan con App
real, aunque las 138 regresiones existentes del bloque pasan. S52 se acepta
funcionalmente y S57/S58 se aceptan para el contrato local. La captura anterior
de la torta era intermedia; Edge con paths estables confirmó el gráfico completo.

Próximo modelo: **GPT-6 Luna, esfuerzo medio, Standard**, para ejecutar los dos
contratos y corregir la espera de captura definidos en
`docs/architecture/SOL-INDEPENDENT-REVIEW-20261014.md`. Después, Sol alto revisa
esas correcciones. Etapas 5 y 7 no aceptadas; lector de pantalla humano pendiente.
Esta actualización reemplaza los saldos anteriores de revisión y la afirmación
de que no quedaban correcciones concretas. No modifica el alcance del producto.

## Revalidación runtime actual del paquete Sol — 14/10/2026

Revisión focal posterior S01/S13/S59/S60: fuente y contratos cotejados; no se
encontró discrepancia concreta que requiera código. La proyección remota enumera
el DTO vigente y mantiene filas ocultas en servidor; consultar tareas no otorga
permiso de ejecución; S59 revalida autoridad y revisión tras locks; S60 usa el
recibo por actor/operationId para replay y conserva operaciones distintas.
Pruebas focales S01/S13/S59/S60 47/47, S30–S32 40/40 y S44–S46 35/35,
excluyendo `tmp/**` (122/122 en 8 archivos).
Informe, outputs y hashes:
`docs/architecture/review-evidence/s01-s13-s59-s60-source-recheck-20261014.json`.
S61–S65: fuente y regresiones cotejadas también, 99/99 en 8 archivos; ver
`docs/architecture/review-evidence/s61-s65-source-recheck-20261014.json`.
Las revisiones independientes Sol de S52 y etapas 5–7 siguen pendientes; la
aceptación humana con lector de pantalla también.

Revalidación actual S52/etapa 5 en Edge local: build cliente aprobado y el
recorrido `tests/browser-corrections.cjs` pasó 31/31, cero errores JS y cero
llamadas a API operativa. Inspección visual de Recharts confirmó ámbitos sólo
operativos, cero entregables, etiquetas Sin base/Sin evaluar y sectores grises.
Reporte/captura y hashes:
`docs/architecture/review-evidence/s52-edge-current-source-recheck-20261014.json`.
No sustituye la revisión independiente Sol ni la aceptación humana.

Reconciliación final del alcance documental: el informe fuente tiene 65 IDs
únicos; la asignación a siete etapas también reúne 65 IDs, sin omisiones ni
duplicados entre etapas. La suite actual pasó **665/665 en 67 archivos**;
TypeScript, build cliente, Worker y Edge 31/31 pasan. Estado por etapa, outputs
y hashes en
`docs/architecture/review-evidence/sol-65-current-closure-recheck-20261014.json`.
Etapas 4–7 aún esperan revisión independiente Sol, y etapa 5 lector de pantalla.

Corrección vigente S57/S58: se retiraron opciones que podían relajar el umbral
de 1.000 ms, el número de muestras y la fixture 24/2.000. La suite pasó
665/665; las regresiones focales 14/14; TypeScript, cliente y Worker pasaron.
Edge registró p95 384,85 ms y el runner aislado S58 pasó 7/7. Detalle y hash
compartido en `docs/architecture/review-evidence/s57-s58-current-contract-recheck-20261014.json`.

Reejecución con huella exacta del árbol actual: TypeScript, build Vite cliente
(entrada 332,85 kB), build Worker y `git diff --check` pasan. El benchmark S57
registró 30/30 muestras, 24 perfiles/2.000 tareas y p95 383,72 ms. S58 pasó
7/7 (209 omitidas por filtros, 0 fallidas). Ambos reportes registran la misma
huella SHA-256 `4b599c7c83732082c72d0a9dbbd343ea8b4bd4b5c19766aa9ff0a4cb0032a109`
(443 archivos antes de esta nota documental). Salidas:
`outputs/current-sol-followup-20261014/navigation-benchmark.json` y
`outputs/current-sol-followup-20261014/isolation/isolation-run.json`.

Se repitió la aceptación local sobre el árbol actual. Node v24.19.0 y las
dependencias del repositorio bastaron; npm/npx global no están en el PATH.
TypeScript, build cliente (entrada JS 331,70 kB, bajo el límite de 500 kB),
Worker y suite completa **665/665 en 67 archivos** pasaron. Los cuatro E2E de
Edge pasaron; el de correcciones verificó 29 controles, sin errores JS ni
llamadas a la API operativa. S52 esperó geometría visible de los dos sectores
del gráfico de torta antes de capturar: En curso y Pendiente, en grises.
Accesibilidad automatizada: 38 rutas, 2.124 controles AX y 877 focos; contraste:
5.943 textos en 76 combinaciones. S57: p95 384,85 ms con 24 perfiles/2.000
tareas; S58: 7/7 (209 filtradas por sus
patrones explícitos). `git diff --check` pasó. Evidencia:
`docs/architecture/review-evidence/sol-corrections-runtime-recheck-20261014.json`
y `outputs/current-sol-corrections-browser-20261014/`.

Esto cierra la limitación anterior del runner de navegador. Siguen abiertas la
revisión independiente Sol de S52 y etapas 5–7 y la aceptación humana con lector
de pantalla. PostgreSQL/MVCC local pasó 26/26 escenarios con Auth sintético;
esto no valida Supabase Auth/RLS alojado. No se confirmó otra corrección de
producto en esta reejecución.

**PostgreSQL/MVCC local — reejecución 14/10/2026:** usando el archivo binario
oficial EDB 17.11 se creó un cluster descartable en `%TEMP%`, sólo en
`127.0.0.1:55432`, sin servicio de Windows ni datos reales. La prueba pasó
**26/26** (órdenes AB/BA, bloqueos observados en `pg_locks`, SQLSTATE 00000 y
40001, cero deadlocks 40P01). Se comprobaron huellas de rollback, recibos
únicos y consistencia de cierres/reportes/outbox. PostgreSQL se apagó y se
verificó que no quedaron procesos ni listeners. Auth fue sintético: esto valida
MVCC del laboratorio SQL, no Supabase Auth/RLS alojado. Reporte:
`outputs/current-sol-corrections-browser-20261014/postgres-mvcc-coordination-20261014.json`.

## Revalidación real S39 en Edge — 14/10/2026

El recorrido anterior se detuvo por una expectativa vieja del runner, no por un
defecto del producto: jefatura llega al paso correcto con el título actual
“Cierre de mes”, mientras el runner esperaba “Cierre por alcance”. Se actualizó
sólo esa aserción y el recorrido completo pasó **29/29**, con cero errores JS y
cero llamadas a la API operativa. Se comprobaron los pasos de jefatura y
catálogo, foco/teclado, arrastre, vistas móviles y flujos de las correcciones.
Evidencia: `outputs/stage-5-validation-20261014/edge-post-s57-recheck-final/`
y `docs/architecture/review-evidence/s39-edge-browser-recheck-20261014.json`.

Esto cierra la comprobación visual local de S39, pero no la aceptación humana
con lector de pantalla ni la revisión independiente Sol. El runner usa
`playwright-core` del repositorio y Edge local; no necesita npm/npx global. No
hay cambio de producto pendiente por el fallo inicial.

## Revisión local de todos los documentos de correcciones Sol — 14/10/2026

Se contrastaron `PLAN-REVIEW`, el contrato `PLAN-CORRECTIONS-NEXT`, los 65
hallazgos de `SOL-AUDIT`, los contratos `SOL-LUNA` y la matriz por requisito.
Las etapas 1–3 tienen aceptación Sol registrada; S52 y las etapas 5–7 no se
declaran aceptadas porque conservan gates expresos. Los resultados más antiguos
que afirmaban que faltaba Edge para S39 quedaron sustituidos por la revalidación
vigente.

Repetición sobre el árbol efectivo SHA-256
`2cff5088bbc8992cecfbe25c1f019c8121ae673119d4580493c3bd534047d425`:
**663/663** pruebas en 67 archivos; TypeScript, build cliente y Worker; los
cuatro E2E Edge; auditoría automatizada de 38 rutas con 2.124 controles AX y
904 paradas de teclado sin errores; contraste de 5.943 textos en 76
combinaciones sin omisiones ni fallos; benchmark p95 534,39 ms (<1.000 ms) con
24 perfiles/2.000 tareas; S58 7/7. Los E2E y auditorías no llamaron a la API
operativa. Git diff-check pasó con avisos de conversión LF/CRLF solamente.
Registro: `docs/architecture/review-evidence/sol-corrections-recheck-full-20261014.json`.

No se halló una corrección adicional de producto en la revalidación de S39; el
fallo previo correspondía al texto esperado por el runner. Gates restantes:
revisión independiente Sol de S52 y etapas 5–7, aceptación humana de lector de
pantalla y PostgreSQL/MVCC concurrente real para etapa 7. No se hicieron commit,
PR, Site, cuentas, API ni migraciones remotas. Próximo modelo de revisión:
GPT‑6.1 Sol, esfuerzo alto, Standard.

## Revisión focal de los contratos Sol aún abiertos — 14/10/2026

Se contrastaron los contratos de S52, S36–S39, S54, S56, S62–S63, S57–S58 y
S01/S13/S30–S32/S44–S46/S59–S60 con sus fuentes actuales. Las regresiones
focales pasaron **200/200 en 18 archivos**. El benchmark S57 volvió a pasar con
24 perfiles, 2.000 tareas y p95 **569,62 ms**; S58 pasó 7/7 (209 omitidas por
los filtros explícitos). Ambos runners registraron el mismo hash efectivo
`292d563c7f2306cc5f71967e76dc737e8da8e1a87de1b7322b1b9cd3b9b5568e`.
Evidencia: `docs/architecture/review-evidence/open-contracts-recheck-20261014.json`
y los reportes referidos allí. No se confirmó una discrepancia nueva de código.

Esto no reemplaza la aceptación independiente GPT‑6.1 Sol de S52 y etapas 5–7,
la aceptación humana con lector de pantalla ni la prueba concurrente real de
PostgreSQL/MVCC. No se modificó código de producto ni se conectaron servicios.

### Reintento de comprobación PostgreSQL local — 14/10/2026

La comprobación vigente volvió a encontrar `psql`, `postgres`, `pg_ctl`,
`initdb`, Docker y Podman ausentes. Winget descargó el instalador EDB 17.11-5
y verificó su hash. EDB documenta `--extract-only 1` para extraer binarios
sin instalar el servicio
([parámetros oficiales](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/command_line_parameters/)).
Sin embargo, al invocar el instalador firmado con `--help`, Windows devolvió
“El usuario ha cancelado la operación” antes de extraerlo. No se instaló ni
inició PostgreSQL y no se ejecutó MVCC. No repetir la instalación: requiere que
el usuario autorice ese inicio local. El instalador quedó en la ruta temporal
única registrada en `open-contracts-recheck-20261014.json`; la limpieza fue
rechazada por la política del entorno. Esto no conecta cuentas ni servicios
externos.

## Revisión de documentos Sol y separación del bundle — 14/10/2026

Se revisaron `PLAN-REVIEW-20261007.md`, `PLAN-CORRECTIONS-NEXT-20261007.md`,
`SOL-AUDIT-20261008.md`, `SOL-REQUIREMENT-COVERAGE-20261008.md` y
`SOL-LUNA-CONTRACTS-20261011.md`. La matriz enumera los 65 hallazgos S01–S65
sin duplicados ni omisiones; etapas 1–3 están aceptadas, y S52/etapas 5–7
constan implementadas localmente con las puertas de revisión y aceptación aún
abiertas que se detallan abajo.

Se resolvió el aviso de entrada grande del plan de correcciones sin elevar el
límite: `laboratoryEvidence` queda bajo el límite de importación diferida y
React/ReactDOM/scheduler forman el chunk `framework`. El build dejó la entrada
en 328,29 kB (antes 548,96 kB), sin aviso de chunk >500 kB ni de importación
mixta. Suite 661/661, TypeScript y builds de cliente/Worker pasaron. Zod aún
emite avisos `PURE`. Evidencia:
`docs/architecture/review-evidence/sol-corrections-review-recheck-20261014.json`.

La comprobación visual de S39 quedó completada en Edge después del corte de
bundle: ver “Revalidación real S39 en Edge” arriba. La inspección visual del
bundle tras su separación aún requiere revisión independiente Sol. No hacer
commit, PR ni entrega antes de resolver los gates restantes.

## Corrección de validador en snapshots de respaldo — 14/10/2026

La auditoría de campos nuevos encontró que snapshots congelados no aplicaban
los mismos límites para avance comercial y fechas que los registros vivos.
Se corrigió manteniendo opcionales los campos nuevos en snapshots antiguos.
Prueba focal: 17/17; TypeScript: pasa. Evidencia:
`docs/architecture/review-evidence/backup-snapshot-validation-lab-20261014.json`.
La validación visual S39 se completó con Edge desde el runner existente; ver la
evidencia referenciada arriba. Sigue pendiente la revisión integral del
respaldo y las aceptaciones independientes/humanas correspondientes. No se
requiere npm/npx global para este runner del repositorio.

## Relectura S57/S58 — 14/10/2026

Se corrigió el caso en que una ruta de salida ya existente recibía el informe
fallido del benchmark. Ahora se conserva esa carpeta y el informe de esta
ejecución se guarda en una hermana nueva. Regresión focal 12/12; suite completa
663/663, TypeScript y builds cliente/Worker pasan. El runner S58 pasó 7/7, y el
benchmark Edge actual pasó 30/30 con p95 408,51 ms, 24 perfiles/2.000 tareas,
cero errores y cero llamadas operativas. La revisión independiente Sol de
S57/S58 sigue pendiente; el recheck PostgreSQL/MVCC local 26/26 está registrado
en la actualización vigente al inicio de este documento. Evidencia:
`docs/architecture/review-evidence/s57-s58-recheck-lab-20261014.json`.
El recorrido visual S39 pasó en Edge; ver la revalidación registrada arriba.

## Etapa 7 — implementación local completa; auditoría independiente pendiente

La etapa incorpora S59/S60 y los contratos S01/S13/S30/S31/S32/S44/S45/S46.
La migración 012 corrige revisión nula/desactualizada y revalida autoridad en
aprobación y pedido de cambios de inducción. Ambos flujos adquieren bloqueos de
actor/perfil/solicitud y vuelven a validar antes de escribir; una regresión
confirma que un encargado removido del equipo no modifica la solicitud ni deja
revisión o auditoría parcial. Los recibos identifican replay por actor y
operationId. También se endurecieron proyección/permisos, interrupción de
cronómetros, DTOs de tareas y
coberturas, respuestas Worker con referencia a perfil activo y recuperación de
propuestas locales. Las pruebas S44/S45 integradas con
RemoteWorkspace y App cubren el polling GET tardío durante POST y respuestas
GET cuyo perfil activo no existe o está inactivo, más POST cuyo perfil no
existe; la propuesta se conserva ante POST
inválido. S46 cubre presencia fallida en GET/POST y rechazo previo a heartbeat
si falta identidad. Tras integrar la continuación S39 del recorrido, la suite
actual pasó **661/661 en 67 archivos** tras la regresión S57/S58; TypeScript, cliente, Worker y
`git diff --check` pasan. La evidencia Edge 29/29 corresponde al corte integrado
anterior a S39; la comprobación visual Edge posterior pasó 29/29 y está
registrada en `s39-edge-browser-recheck-20261014.json`.
Edge recorrió 29 comprobaciones, incluida tarea cubierta con teclado y retorno de foco, sin errores JS ni
llamadas a `/api`. Benchmark local actual: 24 perfiles/2.000 tareas, p95
502,95 ms en 30 recorridos calientes. Es una medición local, no concurrente ni
de producción. No se aplicó SQL remoto. La limitación antigua de no tener
PostgreSQL/Docker quedó resuelta para MVCC local: PostgreSQL 17.11 descartable
pasó 26/26 escenarios concurrentes en órdenes AB/BA, con barreras verificadas
en `pg_locks`, cero deadlocks y comprobaciones de rollback/recibos/cierres. Auth
fue sintético; no se validó Supabase Auth/RLS alojado. Cluster apagado y sin
servicio. Evidencia en `review-evidence/sol-corrections-runtime-recheck-20261014.json`
y `outputs/current-sol-corrections-browser-20261014/postgres-mvcc-coordination-20261014.json`.

## Relectura local S57/S58 — procedencia y reporte ante falla de Git — 14/10/2026

El runner S58 calculaba el hash/HEAD antes del bloque que escribe su resultado;
si Git fallaba, la ejecución terminaba sin reporte. Ambos accesos quedaron bajo
el manejo de errores y la regresión con PATH vacío confirma salida no-cero y
reporte fallido sin sobrescribir resultados previos. S57 también falla si no
puede calcular el hash del árbol efectivo, aunque las muestras sean válidas.
Las pruebas focales pasaron 11/11, el runner completo pasó 7/7 con 209 omitidas
y 0 fallidas, y la suite completa pasó 661/661 en 67 archivos; `tsc --noEmit`
pasó. Evidencia:
`docs/architecture/review-evidence/s58-hash-failure-report-lab-20261014.json`.
La revisión independiente Sol de S57/S58 sigue pendiente.

**Siguiente paso: GPT-6.1 Sol, esfuerzo alto, Standard**, para revisar de forma
independiente S52 y las etapas 5–7, incluida la migración 012, los contratos,
permisos y evidencias; corregir lo que encuentre antes de aceptar. La etapa 5
también requiere aceptación humana con lector de pantalla. La concurrencia
PostgreSQL/MVCC local ya pasó; Auth/RLS alojado e integración desplegada se
reservan para la infraestructura futura autorizada. No conectar ni activar API.
Evidencia:
`docs/architecture/review-evidence/stage-7-implementation-local-20261014.json`.
Revalidación de foco/benchmark: `docs/architecture/review-evidence/
stage-5-partial-laboratory-20261014.json` y
`outputs/performance-lab-2026-10-14-post-tour-2026-10-14/`.

## Corte histórico previo a la etapa 7 — etapa 6 implementada localmente (14/10/2026)

S57/S58 están implementados y validados localmente, pendientes de revisión
independiente Sol. Suite completa: 638/638 en 67 archivos; TypeScript, cliente
y Worker pasan. Benchmark con fixture válida de 24 perfiles/2.000 tareas:
30 recorridos calientes, p95 368,07 ms, umbral estricto <1.000 ms; cero errores
JS/API. El runner aislado ejecutó 7 expectativas exactas: 7 aprobadas, 0
fallidas y 206 omitidas por los filtros de nombre; los casos de cero pruebas,
todo omitido, patrón ausente, status nulo y fallo se rechazan en pruebas de
contrato. Los informes incluyen hash del árbol efectivo y salidas únicas.

En ese corte, la acción pendiente era la revisión independiente GPT-6.1 Sol,
esfuerzo alto, Standard, sobre S57/S58 y su evidencia. Luego correspondía
resolver los pendientes de aceptación de etapas 5 y 4 antes de iniciar la etapa 7. El estado vigente y sus gates están en la sección superior. Este corte no es
aceptación global ni modifica el avance orientativo ~45%. No hubo commit, PR,
publicación, cuentas, API operativa o despliegue.
Evidencia: `docs/architecture/review-evidence/stage-6-verifier-implementation-
lab-20261014.json`.

## Registro de etapa 5 — corte anterior (14/10/2026)

La suite oficial pasó **629/629 en 66 archivos**; TypeScript, cliente, Worker,
`git diff --check` y Edge correcciones pasan. El Edge final comprobó los dos
selectores con 24 perfiles y navegación Tab/Shift+Tab/Escape, búsqueda nativa
con Tab/Enter/Espacio preservando actor, guía con permisos por rol y foco, y
arrastre de cobertura con responsable original, actor reemplazante y duración
de animación reducida `0s`. Cero errores JS y cero llamadas a `/api`.

La aceptación de etapa 5 sigue abierta por aceptación humana con lector de
pantalla y revisión independiente de Sol. La etapa 4 también queda abierta
hasta la revisión independiente de S52. No hay commit, PR, actualización del
Site, cuentas conectadas, API operativa ni despliegue. Avance global ~45%, sin
cambio. Evidencia: `docs/architecture/review-evidence/stage-5-partial-
laboratory-20261014.json` y `outputs/stage-5-validation-20261014/edge/`.

## Registro histórico — etapa 3 aceptada (14/10/2026)

Sol aceptó funcionalmente S04/S12/S19/S22/S26/S35/S61. Corte final:
595/595 pruebas en 65 archivos; TypeScript, build cliente y Worker,
`git diff --check`, Edge principal/correcciones/conjuntas y benchmark aislado
pasaron. Con 24 perfiles y 2.000 tareas, p95 caliente fue 405,45 ms frente a
objetivo <1.000 ms. Una corrida concurrente de pruebas/navegadores tuvo un
timeout SQL y un benchmark fuera de objetivo; ambos se repitieron aislados y
pasaron. La evidencia mantiene ambos intentos visibles.

En ese corte, etapas 1–3 estaban aceptadas y etapa 6 era el siguiente bloque.
S57/S58 ya quedaron implementados según el estado vigente al inicio de este
documento. Etapas 4–7 y la aceptación global siguen abiertas; revisar el corte
vigente anterior para los gates pendientes. No commit, PR, publicación,
cuentas, API operativa ni despliegue.
Evidencia: `docs/architecture/review-evidence/stage-3-final-acceptance-20261014.json`.

## Progreso parcial de etapa 4 — 14/10/2026

### Corte más reciente

S48 quedó **aceptado funcionalmente por Sol**. La revisión confirmó que las
operativas sin coeficiente no suman puntos de entregables, pero conservan
movimientos, cantidades, tiempo y cuotas conjuntas; aprobar una propuesta no
crea un coeficiente por movimiento.

S52 quedó implementado: los grupos con tareas operativas permanecen en el
análisis, se distinguen los grupos sin base de entregables de un cero real, y
la exportación CSV conserva esa distinción y la calidad “Sin evaluar”. La
prueba focal pasó 20/20; TypeScript, build Vite cliente, build Worker y Edge
correcciones pasaron. Edge ejercitó el SVG de Recharts real con dos grupos sólo
operativos y un entregable con cero avance; se ven los nombres y la nota separa
“Sin base de entregables” de “Cumplimiento 0%”. Captura y datos en
`outputs/stage-4-validation-20261014/edge-s52-real-chart/`. Los dos intentos de
revisión independiente de S52 por Sol quedaron sin respuesta por capacidad del
modelo; esa revisión funcional permanece pendiente.

**Etapa 5:** S36–S39, S54, S56, S62 y S63 están implementados localmente y sus
comprobaciones automáticas y Edge pasan. Falta lector de pantalla y revisión
independiente. Las comprobaciones de S52 se conservan para revisión Sol. No
conectar cuentas ni actualizar/publicar el Site. Avance global ~45%, sin cambio.

Sol aceptó S05, S15 y S20 por separado. S05 conserva referencia histórica del
autor sin ampliar su permiso vigente; S15 alinea empresa/tarea visible y guardada
y continúa versionado desde el máximo restaurado; S20 rechaza fechas imposibles
en escrituras y copias, sin alterar fechas válidas ni interpretación ART.

Corte integrado: 603/603 pruebas en 66 archivos, TypeScript, builds
cliente/Worker, `git diff --check` y Edge principal, correcciones y
respaldo/restauración pasaron sobre el árbol final; no hubo errores JS ni
llamadas a API operativa.

Actualización S24: la navegación de una obligación desde el calendario usa su
período fiscal dentro del módulo de origen, abre el panel si estaba plegado,
revalida visibilidad vigente y enfoca el registro después del render. La
selección de mes del calendario no cambia. Validación actual: prueba focal 9/9,
suite integrada 604/604 en 66 archivos, TypeScript, Vite cliente, Worker y Edge
correcciones; Edge sin errores JS ni llamadas operativas. Sol aceptó S24 tras
12/12 probes independientes, incluyendo origen inexistente y actor revocado.

Actualización S25: Sol aceptó funcionalmente la campana tras seis pruebas
independientes. Se verificaron cambio de día ART, cruce de año, recuperación de
foco/visibilidad, panel abierto/cerrado, lectura con ID actual, cambio de actor,
un solo timer bajo StrictMode y limpieza de listeners al desmontar. No se
detectaron bloqueos en S25. La suite integrada local final del corte sigue en
606/606 en 66 archivos; TypeScript, cliente, Worker y Edge principal aprobaron.
Edge sin errores JS ni llamadas operativas.

S33 quedó implementado en laboratorio y aceptado funcionalmente por Sol con
36/36 probes independientes. Perfil sólo operativo acepta revisión sin cuota y
conserva target/peso; perfil mixto cambia sólo pesos de entregables; actores no
autorizados se rechazan; el guardado fallido deja el formulario disponible. No
hubo diferencias en Worker, servidor operativo, Supabase ni migraciones.
La bandeja ya no exige objetivos operativos ni actualiza sus targets o pesos
legacy; sólo cambia pesos de entregables. Un perfil con operativas solamente se
puede revisar sin cuota, y coeficientes siguen en el panel versionado. Un fallo
de persistencia conserva el formulario. Worker/site-policy y SQL Supabase
permanecen intactos. La suite pasó 609/609 en 66 archivos; TypeScript, builds
cliente/Worker, `git diff --check` y Edge correcciones pasan; Edge sin errores JS
ni llamadas operativas.

S40 quedó aceptado funcionalmente por Sol. En la revisión detectó un P2: una
revisión v2 sin marcador propio podía omitir la validación de tipo de tarea al
restaurar. La validación ahora hereda la versión del registro padre; pruebas
cubren revisión sin marcador válida con entregable y rechazo de la adulterada
con operativa, además de preservar obligaciones legacy. Sol revalidó y aceptó
S40 con 37/37 probes focales. Suite completa: 611/611 en 66 archivos; TypeScript,
build cliente/Worker, Edge de correcciones y `git diff --check` pasan. Los builds
conservan avisos existentes de chunk cliente >500 kB, anotaciones Zod e imports
mixtos de evidencia.

S41 quedó aceptado funcionalmente por Sol. Usa `dateART` como fecha inicial al
abrir el formulario y conserva lo seleccionado aunque el reloj cruce medianoche.
La revisión independiente pasó 50/50 pruebas focales: incluye zona local
`Pacific/Kiritimati`, cruce de año, conservación al avanzar el reloj y coeficiente
de hoy en snapshot del movimiento de hoy. La suite posterior a S41 pasó 615/615
en 66 archivos; TypeScript, builds cliente/Worker, Edge de correcciones y
`git diff --check` pasan. El build cliente conserva avisos ya existentes de
chunk >500 kB, anotaciones Zod e imports mixtos.

S42 quedó aceptado funcionalmente por Sol con 18/18 probes focales. Notifica
cambios de disponibilidad, dependencias y seguimiento comercial con un aviso
genérico por destinatario autorizado; equivalencias normalizadas no avisan,
revocaciones excluyen al destinatario y los cambios simultáneos no duplican.
La suite posterior pasó 620/620 pruebas en 66 archivos; TypeScript, builds,
Edge y `git diff --check` pasan. No cambia contratos del Worker ni Supabase.

En ese corte, el siguiente bloque era S48, puntos y textos de metas operativas
antiguas en ciclo e inducción; luego S52. La inducción conserva su revisión
separada dentro de S48. El estado actualizado figura en las secciones superiores.
Etapa 4 y aceptación global siguen abiertas; avance global orientativo ~45%.
Evidencia: `docs/architecture/review-evidence/stage-4-partial-laboratory-20261014.json`.

## Registro anterior — aceptación etapa 2 (14/10/2026)

La etapa 2 quedó aceptada en revisión funcional independiente de Sol. Validación
final: 588/588 pruebas en 65 archivos; TypeScript; build cliente y Worker;
`git diff --check`; recorridos Edge principal, correcciones y respaldo; y
benchmark de 24 perfiles/2.000 tareas con p95 de 591,87 ms (objetivo <1.000 ms).
Los recorridos Edge informaron cero errores JS y llamadas operativas. No se
indujo cuota física del disco; el navegador sí abortó una transacción IndexedDB
nativa sin alterar metadata/blobs. Aceptación de etapa 2 no equivale a producto
terminado. Evidencia: `docs/architecture/review-evidence/stage-2-final-acceptance-20261014.json`.

En ese corte, la siguiente acción era continuar con etapa 3: revisar S04/S12/S19/S22/S26/S35/S61 en el árbol
vigente, completar los escenarios requeridos que falten, volver a validar el
conjunto y solicitar revisión Sol antes de aceptar la etapa. Las correcciones
parciales y pruebas fechadas 12/10 no son aceptación final. Etapas 4–7 siguen
abiertas. Sin commit, PR, actualización del Site, cuentas, API operativa ni
despliegue.

> Cierre 13/10/2026 — Sol aceptó la etapa 1 del laboratorio sin bloqueos
> residuales (S02/S06/S14/S17/S18/S21/S23/S27/S28/S34/S43/S47/S50/S53).
> Validación del árbol final: 565/565 pruebas en 62 archivos; corte focal
> 93/93; TypeScript, cliente, Worker, `git diff --check` y recorridos Edge
> general/correcciones aprobados, sin errores JS ni llamadas a API operativa.
> Revisión Sol: una corrida independiente de dos workers quedó 174/178 por
> esperas UI en dos archivos; la repetición estable quedó 56/56. Conservar la
> variación como evidencia de sensibilidad temporal, no ocultar la primera.
> El próximo bloque es continuar etapa 2 desde su evidencia parcial, priorizando
> intercalados post-commit/notificación y fallos de compensación en S65, errores
> físicos de IndexedDB y adversos restantes. Luego validar y pedir revisión Sol
> de etapa 2. Etapas 3–7 permanecen abiertas; no commit, PR, publicación ni
> cuentas. Evidencia de cierre etapa 1:
> `docs/architecture/review-evidence/stage-1-final-acceptance-20261013.json`.

> Actualización 13/10/2026 — etapa 2A aceptada por Sol, alcance S09/S16/S65
> y estado durable de evidencia. La revisión observó que la inyección de UUID
> alcanzaba un ID de notificación antes de labRevision; se aisló la fixture y
> el corte focal pasó 23/23.
> Se cerró el bloque de estado durable,
> lock compartido entre adjuntos/restauración y resultados inciertos de
> guardado. Última suite completa 579/579 en 65 archivos; foco 25/25;
> TypeScript,
> Vite, Worker y Edge aprobados. Edge confirmó que un cambio de otra pestaña
> mientras la subida esperaba el lock detuvo la escritura. Edge también abortó
> una transacción IndexedDB nativa y confirmó que los datos quedaron intactos;
> no se simuló haber agotado cuota física del disco. El guard para un
> cambio durante el almacenamiento se sustenta en regresión focal e inspección
> Sol, no en ese E2E. Se corrigió el hallazgo P2 de UUID fuera del try y se
> verificó rechazo/compensación segura. Evidencia:
> `docs/architecture/review-evidence/stage-2-evidence-durable-20261013.json`.
> Etapa 2 completa sigue abierta; sin commit, PR, publicación, cuentas ni API.

> Actualización 13/10/2026 — seguimiento de evidencia de etapa 2: suite
> completa 553/553 en 61 archivos, 76/76 focalizadas en seis archivos;
> TypeScript, build cliente/Worker y `git diff --check` pasaron. Se añadieron
> casos S03 para backups malformados v1/v2 y S65 para escritura confirmada,
> rechazo compensado y readback ambiguo en el formulario operativo integrado.
> Esto no acepta etapa 2: todavía faltan errores físicos de IndexedDB en
> navegador, fallos tras commit/notificación y compensación, conjunto completo
> de adversos, lector de pantalla y benchmark. Evidencia:
> `docs/architecture/review-evidence/stage-2-partial-laboratory-20261012.json`.
> El gate vigente sigue siendo revisión Sol independiente de etapa 1; no se
> cierra etapa ni se publica.

> Actualización 13/10/2026: la etapa 1 está implementada y revalidada en el árbol vigente; sus 14 hallazgos esperan revisión independiente de Sol. Tras añadir pruebas de privacidad de Planificación y avisos de cancelación, suite completa 547/547 en 60 archivos; TypeScript y builds de cliente y Worker pasaron. Los dos recorridos Edge anteriores también pasaron. Se corrigió la inducción de jefatura que generaba tareas sin equipo y la selección del responsable en el creador; la fixture de vencimientos preserva movimientos históricos. El detalle de validación está en `outputs/stage-1-permissions-20261013/stage1-rerun-20261013.json`. La etapa 2 conserva trabajo local parcial sin aceptación; también hay correcciones parciales de cierres/historia S04/S12/S19/S22/S26/S35/S61, sin declarar etapa 3. Próximo: GPT-6.1 Sol, esfuerzo alto, Standard, revisa etapa 1 antes de iniciar el siguiente bloque de implementación. No se hicieron commit, PR, publicación, cuentas ni llamadas a API operativa.

## Etapa 2 — continuación en curso — 12/10/2026

Ya quedaron cubiertos localmente controles semánticos de backups, URLs de
previsualización obsoletas, referencias protegidas al reemplazar recurrencias,
reconciliación del índice de evidencia al restaurar, fallos del almacenamiento
en el inicio, selección concurrente de copias, rechazo de respuestas tardías,
conservación de borradores, serialización del registro operativo y resultados
explícitos `committed`, `rejected` y `unknown` para adjuntos. El bloque 2A pasó
suite, TypeScript, build cliente/Worker y Edge; su dictamen final Sol está
pendiente. La etapa completa no es aceptable: faltan pruebas de los demás
intercalados, errores físicos de IndexedDB, los adversos restantes, lector de
pantalla y benchmark. Etapas 3–7 siguen pendientes.

## Etapa 1 implementada localmente — 12/10/2026

Se incorporaron guardas actuales para el seguimiento comercial, comentarios,
avisos de fechas compartidas, motivos de dependencias, presencia, consultas y
asignaciones por empresa, obligaciones fiscales, edición de empresas del perfil,
ausencias sin reemplazo y reenvío de propuestas. La creación de trabajo y Mi
jornada vuelven a comprobar el ámbito al guardar/consultar. La jefatura conserva
su alcance organizacional sin membresía directa donde lo permite el contrato.

Regresiones focales iniciales: 94/94 en 7 archivos; integración de avisos/asignación
y Mi jornada: 45/45 en 2 archivos (el test de avisos se comparte entre ambos
cortes). En la revisión siguiente se corrigió S14 para revocar avisos y fechas
compartidas cuando cambia la jefatura del autor; pruebas focales: 36/36 en 2
archivos. Revisiones de permisos adicionales corrigieron S17 (proyección segura
de dependencias y resolución del actor vigente) y permisos que retenían autoridad
tras cambios de jerarquía o empresa (S18/S21/S34/S43/S50), con regresiones de
presencia, adopción de propuestas, comentarios y reasignación. La suite completa
actual de ese primer corte quedó en 518/518 en 58 archivos. El 12/10 se volvió
a compilar y verificar el árbol ampliado: 544/544 en 59 archivos, TypeScript,
cliente y Worker pasaron; los recorridos Edge general y de correcciones también
pasaron, sin errores JavaScript ni llamadas a la API operativa. Se corrigió una
ruta de inducción/creación de tareas que permitía persistir tareas de jefatura
sin equipo. Este resultado sigue siendo un corte de implementación; requiere
revisión Sol y aceptación posterior. No hubo commit ni publicación; no se
conectaron servicios.

## Registro histórico — inicio de auditoría integral Sol

La auditoría descrita aquí comenzó antes del corte final del 11/10/2026. El
resultado vigente, el inventario de cobertura, los 65 hallazgos y sus 95 casos
reproducidos constan en `docs/architecture/SOL-AUDIT-20261008.md`,
`docs/architecture/SOL-LUNA-CONTRACTS-20261011.md` y
`outputs/sol-audit-20261008/final-audit-delivery-check-20261011.json`.

## Validación más reciente — 08/10/2026

El corte pasó nuevamente **500/500 pruebas en 58 archivos**, TypeScript, cliente/Worker y cuatro recorridos Edge (general, correcciones, tareas conjuntas y respaldo/restauración). Cero errores JavaScript y llamadas a la API operativa. El pre-commit pasó 130 pruebas rápidas y rechaza archivos parcialmente staged; una regresión ejecuta el hook en un Git temporal y confirma que aborta antes de otras comprobaciones. El cierre cuenta como listas sólo las unidades de grupos conjuntos que pueden cerrarse completas; tampoco se activa una tarea compartida ni se reasigna/traspasa trabajo a empresas cerradas para cualquiera de sus responsables. Edición de perfiles, recurrencias y cierre mensual exigen jefatura activa. Jefatura consulta y recibe avisos de tareas conjuntas según su acceso organizacional, incluso sin membresía directa de una empresa. Los encargados autorizados pueden reprogramar una instancia pendiente con motivo; se conserva período, vencimiento y regla recurrente, y se avisa al responsable. Se corrigieron claves React duplicadas en los paneles de detalle; la prueba integrada de búsqueda ahora exige cero advertencias. El recorrido de evidencia confirmó que el límite de tres archivos se mantiene frente a cargas simultáneas y después de restaurar una copia. La regresión de evidencia confirma que un adjunto guardado mientras se completa la tarea queda vinculado al timestamp de finalización vigente (ver docs/architecture/review-evidence/task-evidence-completion-race-lab-20261008.json). La actualización de IndexedDB agrega un índice por tarea/movimiento; respaldos v2 nuevos incluyen ese alcance y las copias v2 anteriores siguen siendo aceptadas. La auditoría de contraste cubrió 76 combinaciones: 5.943 textos evaluados, cero fallos, cero omitidos y cero muestras truncadas de gradientes. La auditoría accesible recorrió 38 rutas y 2.124 controles del árbol de Chromium: cero controles interactivos sin nombre, 877 paradas de teclado y cero fallos de foco en la heurística; no equivale a probar con lector de pantalla. Todos los paneles JSX tienen plegado disponible y las acciones del encabezado siguen accesibles. La historia usa cierres inmutables y Mi día incorpora búsqueda/filtros; evidencia de tarea se liga a su finalización. El estado vacío de la biblioteca de Anotaciones quedó más compacto y el recorrido Edge volvió a pasar. Benchmark repetido: 324,99 ms p95 con 24 perfiles/2.000 tareas. El bundle principal quedó en 486,52 kB. Evidencia: `docs/architecture/review-evidence/continuation-validation-lab-20261008.json`.

El hook pre-commit local está configurado y `node scripts/validate-change.mjs` pasó 130 pruebas rápidas. `package.json` y `package-lock.json` coinciden. También se generó y verificó localmente el paquete Sites para el proyecto configurado; el artefacto, su SHA-256 y los límites del chequeo están en `docs/architecture/review-evidence/delivery-readiness-local-20261008.json`. CI aún no puede ejecutarse hasta contar con el repositorio GitHub propio.

No están todos los cambios aceptados. Próximo paso de revisión: GPT-6.1 Sol, esfuerzo alto, Standard, para revisar permisos, cierres, historial y conservación de evidencias frente al contrato actual. Después, GPT-6 Luna, esfuerzo medio, Standard, implementará los defectos que confirme. Sigue la aceptación con lector de pantalla y la aceptación restante. La presencia real requiere sesiones autenticadas; no conectar cuentas antes de aceptar el producto. Sin commit, PR ni publicación.

Mantener el mismo laboratorio privado. Implementación acotada: GPT-6 Luna, esfuerzo medio, Standard. Revisión: GPT-6.1 Sol, esfuerzo alto, Standard. Avance global orientativo ~45%.

Evidencia completa en docs/architecture/review-evidence/continuation-ui-presence-performance-lab-20261008.json. Plegado de paneles: docs/architecture/review-evidence/cross-module-panel-folding-followup-lab-20261008.json. Atomicidad visual del cierre por grupo: docs/architecture/review-evidence/company-closure-group-readiness-lab-20261008.json. Bloqueos y permisos: docs/architecture/review-evidence/joint-task-partial-close-guard-lab-20261008.json, docs/architecture/review-evidence/orphan-transfer-recipient-closure-guard-lab-20261008.json, docs/architecture/review-evidence/inactive-manager-write-guard-lab-20261008.json y docs/architecture/review-evidence/monthly-close-role-guard-lab-20261008.json. Auditoría del árbol accesible: tests/browser-accessibility-audit.cjs y outputs/plan-validation-20261008/accessibility-panel-folding-final/accessibility-audit.json.

# Próxima ejecución del proyecto

## Revalidación de etapa 1 — 13/10/2026

Se volvió a ejecutar el árbol actual: **547/547 pruebas en 60 archivos**,
TypeScript, build cliente y Worker aprobados. Los recorridos Edge general y de
correcciones pasaron sin errores JavaScript ni llamadas a `/api` operativa;
`git diff --check` pasó. Evidencia de la corrida y capturas:
`outputs/stage-1-permissions-20261013/stage1-rerun-20261013.json`.
Esto revalida implementación, no completa revisión independiente ni aceptación.
Los 14 hallazgos de etapa 1 siguen a revisión GPT-6.1 Sol; no continuar a otro
bloque de implementación hasta esa revisión. Etapas posteriores y matriz de
requisitos continúan abiertas. Sin commit ni publicación.

## Registro histórico de ejecución — 07/10/2026

La revisión del plan ya se ejecutó. **No todos los cambios están completos**:
se reprodujeron once discrepancias (ocho probes de dominio y tres comprobaciones
en Edge) y se identificaron otros requisitos incompletos en fuente. Ver la
matriz y evidencia en `docs/architecture/PLAN-REVIEW-20261007.md`.

**Seleccionar GPT-6 Luna, esfuerzo medio, Standard** para ejecutar
`docs/architecture/PLAN-CORRECTIONS-NEXT-20261007.md`. El contrato abarca guardas
por empresa/acción/unidad cerrada, readiness y confirmación comercial, cierres
conjuntos/cobertura, evidencia y restauración, indicadores/historia y completitud
de calendario, selector y recorrido. Conservar el árbol actual y corregir las
rutas existentes; no sustituir el repositorio ni conectar servicios.

Primero resolver permisos, cierre y pérdida de datos; luego las partes de
interfaz pendientes. Incorporar regresiones de los casos reproducidos, ejecutar
suite/build y recorridos ampliados y dejar evidencia. **Después GPT-6.1 Sol,
esfuerzo alto, Standard** revisará el corte. No crear commit ni actualizar el
Site con estas correcciones abiertas. El paquete para PC sigue pendiente hasta
el commit validado. Avance orientativo **~45%**, sin aceptación final.

## Registro anterior: revisión pendiente tras la implementación

La implementación local del plan quedó validada: **442/442 pruebas en 109
archivos**, TypeScript, cliente Vite, Worker y cuatro recorridos Edge aprobados.
El rendimiento caliente con 24 perfiles y 2.000 tareas ficticias dio p95 de
399,35 ms en 30 cambios de ruta, bajo el objetivo local de 1.000 ms. Evidencia:
`docs/architecture/review-evidence/plan-implementation-lab-20261007.json`.
No hubo llamadas a `/api` operativo. Los cambios siguen sin commit ni
publicación; el Site conserva audiencia privada.

El bundle cliente deja un aviso visible: entrada principal 554,46 kB (gzip
167,34 kB); gráficos 423,74 kB (gzip 121,39 kB). Tampoco están comprobados
Auth/MFA/RLS reales, persistencia y concurrencia entre dispositivos,
notificaciones entre usuarios ni accesibilidad completa con tecnologías
asistivas. Esos límites impiden considerar el producto aceptado o desplegable.

**Siguiente paso: GPT-6.1 Sol, esfuerzo alto, Standard**, para una revisión
crítica del código y la evidencia frente a los contratos, con prioridad en
privacidad/permisos, reglas de puntuación, cierres por empresa, bloqueos y
evidencia/restauración. Si encuentra defectos, GPT-6 Luna, esfuerzo medio,
Standard implementará las correcciones y se repetirán las comprobaciones
afectadas. Si Sol confirma el corte sin correcciones conocidas, preparar el
commit y actualizar el mismo Site privado; no crear cuentas ni conectar
servicios durante esta etapa.

El entorno actual no permite seleccionar otro modelo desde esta ejecución; no
se afirma que el código se haya implementado con Luna. El usuario debe elegir
GPT-6.1 Sol antes del paso siguiente. **Avance orientativo: ~45%**, igual que
antes del bloque. El 100% requiere aceptación sin correcciones conocidas,
GitHub, Supabase dev y producción, hosting propio y automatización de commit,
PR, comprobaciones, migraciones y deploy verificada.

Repositorio: `work/site`. Continuar en el mismo proyecto y Git.

## Registro previo — correcciones de interfaz verificadas 07/10/2026

Se corrigieron roles del Resumen/Catálogo/Cierre, el catálogo plegable, la
duplicación del avatar, el selector de tema y el tamaño/animación de arrastre.
La suite completa aprobó **423/423 pruebas en 48 archivos**; TypeScript, Vite y
Worker compilan. Cuatro recorridos Edge aprobaron y no registraron errores JS ni
llamadas a `/api`. Evidencia:
`docs/architecture/review-evidence/ui-corrections-lab-20261007.json`.
El Site existente está en v81 antes de este corte, owner-only y sin cambios de
audiencia. Fuente local `main`; el checkout conserva el laboratorio aislado.

Siguiente paso de modelo: **GPT-6.1 Sol, esfuerzo alto, Standard**, para resolver
los contratos que las correcciones dejan abiertos: cantidades operativas y KPI,
agenda de eventos/ausencias, permisos y atomicidad de cierres por alcance,
definiciones de series/gráficos mensuales y organización compacta de Consultas y
Anotaciones. Mantener cuentas, invitaciones, API y Supabase fuera de esa etapa.
Después del contrato, **GPT-6 Luna, esfuerzo medio, Standard**, implementa sólo
las decisiones aprobadas en el laboratorio. Los apartados posteriores conservan
la cronología.

## Estado vigente

El laboratorio privado conserva simulación y datos ficticios en
`LaboratoryWorkspace` / `paris-state-lab`; no llamar a la API operativa, no
activar `RemoteWorkspace`, no crear cuentas ni enviar invitaciones reales. SQL
Supabase 001–011 y Worker/D1 siguen separados. Audiencia actual del Site:
privada.

La agenda de obligaciones fiscales por empresa ya está implementada en el
laboratorio: separa período fiscal y vencimiento, registra fuente/revisión,
vincula tareas exactas y deriva el cumplimiento. No contiene vencimientos
oficiales ni consulta ARCA. Evidencia y límites en `docs/PROJECT-STATUS.md` y
`docs/architecture/review-evidence/fiscal-obligations-lab-20261007.json`.

El último bloque funcional es el flujo de propuestas de tareas habituales del
onboarding: preserva título, empresa y frecuencia; jefatura revisa, pide cambios,
vincula un estándar compatible o crea una versión y aprueba explícitamente antes
de asignar tareas independientes por empresa. Sigue aislado en el laboratorio.
El código quedó en `0ca71bb17da997251155d82d5e83355ab12a5c8c` y se publicó como
Site v61 en el mismo sitio privado; la audiencia continúa owner-only. Ver
`docs/PROJECT-STATUS.md`.

El usuario quiere trabajar desde su PC personal antes de crear cuentas o
conectar servicios. No hay GitHub propio y sigue pospuesto hasta la aceptación
final. Para mover el código, generar `outputs/grupo-paris-site-personal.bundle`
desde un commit limpio y copiarlo con `outputs/LEEME-PC-PERSONAL.md` por USB o
una carpeta privada. Clonar ese bundle en Codex de la PC personal y mantener
una sola copia activa a la vez; no sincronizar `.git` con OneDrive. El estado
`paris-state-lab` vive en el almacenamiento local del navegador: descargarlo
desde la banda «Vista de prueba» como JSON y restaurarlo en el otro equipo.
La sincronización automática de código entre PCs requiere configurar GitHub
privado durante la etapa de infraestructura final.

El bloque Trello-like está implementado en `65ae477`. La responsabilidad
conjunta está implementada en el laboratorio local; contrato, alcance y límites
en `docs/architecture/JOINT-LABORATORY-CONTRACT-20261006.md`. No equivale a
colaboración en línea o a permisos de producción.

## Cobertura y bajas locales implementadas; siguiente trabajo

La cobertura ya incluye tareas puntuales y reglas recurrentes seleccionadas;
previsualiza ocurrencias y aplica acceso al materializarlas. Mantiene al titular,
atribuye cronómetros al reemplazante, limita accesos por empresa/equipo y revoca
relojes al cancelar o vencer. Contrato y evidencia en
`docs/architecture/COVERAGE-LAB-CONTRACT-20261006.md`.

La baja conserva cierres/historia, detiene relojes propios y pausa reglas
recurrentes. El trabajo futuro limpio queda en la bandeja para reasignar;
actividad existente se resuelve con un traspaso explícito auditable. Contrato:
`docs/architecture/PROFILE-DEACTIVATION-LAB-CONTRACT-20261006.md`.

El traspaso conserva el snapshot completo, sesiones atribuidas al actor,
actividad, comentarios, motivo e identidades; actualiza propietario/equipo en la
misma tarea y aparece en la bandeja, cierres, informes y CSV. No acredita el
tiempo anterior al nuevo responsable. Las tareas conjuntas quedan para revisión
manual porque modificar cuotas necesita un contrato separado.

Auditoría de cierres y exportaciones completada en el laboratorio: las tareas
conjuntas aparecen en el cierre de cada miembro, el cálculo respeta la cuota y
el CSV separa contribución personal de peso global. También se impide cerrar con
un perfil actor inactivo. Evidencia reciente en `docs/PROJECT-STATUS.md`.

## Consultas y pedidos: alcance actual y revisión necesaria

La interfaz local quedó implementada según el criterio funcional del bloque D:
tipos separados, urgencia, módulo, destinatario explícito para sugerencias,
visibilidad, estados, respuesta e historial. Evidencia y límites en
`docs/PROJECT-STATUS.md` y
`docs/architecture/review-evidence/internal-requests-lab-20261006.json`.
No integrar su esquema en D1/Supabase todavía: la cola de soporte no tiene una
cuenta de identidad, y persistencia/entrega entre dispositivos requiere revisión
de permisos y diseño de servidor.

Continuar revisando las rutas operativas restantes del laboratorio contra
`docs/PRODUCT-ROADMAP.md` y los contratos vigentes, implementando sólo cambios ya
definidos. Mantener fuera del alcance Auth, cuentas, `/api`, Worker/D1 y SQL
remoto. Antes de portar al backend reglas nuevas sobre transferencia conjunta
o retenciones, volver a GPT-6.1 Sol alto para revisar el contrato.
Referencias: filas 4, 13 y 14 de
`docs/product/CORRECTIONS-20261002.md` y regla de cobertura de
`docs/product/CONSISTENCY-RULES.md`. Mantener el alcance en laboratorio antes de
alterar relaciones o el backend activo.

Si los criterios existentes de baja/reasignación bastan: GPT-6 Luna, esfuerzo
medio, velocidad Standard, para implementar y verificar. Si aparece una decisión
nueva de permisos/jerarquía, usar GPT-6.1 Sol, esfuerzo alto, Standard, sólo para
revisar esa decisión antes de volver a Luna.

Próximo cambio de modelo: **GPT-6.1 Sol, esfuerzo medio, Standard** para revisar
el módulo de consultas local y definir qué funcionalidades pendientes pueden
cerrarse en laboratorio sin crear un contrato de producción prematuro. Cualquier
esquema/backend o identidad de soporte exige **esfuerzo alto** antes de volver a
Luna.

Evidencia del bloque más reciente: 371 pruebas en 36 archivos, TypeScript/Vite,
Worker build, pre-commit 53/53 y Chromium desktop/móvil aprobados; cero errores
JS y solicitudes a `/api` operativa. El Site privado v57 publicó el commit
`c080a52ce5ca6b6d949be7fa3888e7bf85f1b8a0`; deployment confirmado y acceso
owner-only. Ver `PROJECT-STATUS.md` para límites y avance.

## Entrega

Para cambios del Site: suite completa, build, Chromium desktop/móvil,
pre-commit, commit, sincronizar la fuente interna y publicar el mismo Site
privado. Guardar evidencia y actualizar `PROJECT-STATUS.md`, `AGENTS.md` y este
archivo. No cambiar audiencia.

## Avance y aceptación final

Avance global orientativo: ~45%; no es una medición exacta ni sube por pasar
pruebas. El 100% requiere producto aceptado sin correcciones conocidas, GitHub
propio, dos proyectos Supabase dev/producción, hosting propio y automatización
validada según `docs/ops/FINAL-ACCEPTANCE.md`. No conectar cuentas hasta aceptar
el producto final.

El empaquetado portable está disponible en `scripts/package-site-archive.mjs`
(`node scripts/package-site-archive.mjs <ruta-absoluta>` o `npm run package:site
-- <ruta>`). En esta PC el script del plugin puede fallar al invocar `bash`
después de sincronizar la fuente; el helper resuelve la generación/validación del
tar, no reemplaza la comprobación de push, commit ni despliegue nativo.

## Ciclo de trabajo mensual — 06/10/2026

Implementado sólo en el laboratorio local: vistas de día y semana, planificación
por fecha de ocurrencia, ejecución por fecha real, tiempo repartido entre días
ART, registros/cantidades operativas separados por unidad y desglose por persona,
equipo, sector o empresa. Las cuotas conjuntas conservan una ocurrencia global;
los nuevos cierres guardan actor y cierres históricos sin ese dato quedan sin
atribución. No infiere capacidad ni tiempo libre, no activa API o sincronización.

Evidencia: 378/378 pruebas en 37 archivos; TypeScript, Vite y Worker; Chromium
Edge escritorio/móvil 390×844, 31 días del período y desglose de equipo; cero
errores JS y llamadas a `/api`. Ver
`architecture/review-evidence/work-cycle-lab-20261006.json`.

Este corte se publicó como **Site v58** desde `c41bb7a9f9dcee2408b1b714af440f89914814dd`;
el deployment privado terminó correctamente y sigue owner-only. Siguiente paso:
**GPT-6.1 Sol, esfuerzo medio, Standard** para revisar atribución, cortes de fecha y límites del ciclo, y
contrastar el contrato local de Kaizen/5S con la versionación actual del catálogo.
Luego, si no aparece una decisión de permisos/esquema, volver a **GPT-6 Luna,
esfuerzo medio, Standard** para implementar el contrato que quede confirmado.

## Mejora Kaizen/5S y continuidad en otra PC — 06/10/2026

El bloque de mejora de procesos está implementado localmente y validado: 385
pruebas, TypeScript, Vite/Worker y Edge desktop/móvil; evidencia en
`architecture/review-evidence/process-quality-lab-20261006.json`. Sigue aislado
en el laboratorio; no se conectaron cuentas ni se habilitó sincronización.

El checkout actual trabaja en `main` y no tiene remoto GitHub propio. La regla
vigente posterga esa cuenta hasta aceptar el producto final. Para usar otra PC
antes de esa etapa, transferir un snapshot Git portable después de dejar el
checkout limpio; trabajar en una sola PC por vez y devolver el snapshot al
finalizar. No sincronizar la carpeta `.git` con OneDrive ni editar dos copias en
paralelo. La sincronización automática permanente entre PCs queda para el
remoto privado de GitHub previsto en `docs/ops/FINAL-ACCEPTANCE.md`.

El código quedó en `27918d3f7b311e2a596fa6961fb240b4fdf7b8ee` y publicado como
Site v59, deployment `appgdep_6ac5b2ff99d481919f73e8cff76d16b5`; el estado owner-only
no cambió. `package-lock.json` es el lockfile original del proyecto; mantener
npm como gestor y usar `npm ci` al clonar en otra PC.

Próxima acción: copiar `outputs/grupo-paris-site-personal.bundle` y
`outputs/LEEME-PC-PERSONAL.md` a la PC personal, clonar el bundle y abrir la
carpeta en Codex. Para traer commits de vuelta, crear allí un bundle actualizado
e importarlo en este checkout. No existe sincronización automática entre equipos
todavía; GitHub privado sigue pospuesto hasta la aceptación final. Para el
próximo bloque de implementación ya definido: **GPT-6 Luna, esfuerzo medio,
Standard**. Para revisar arquitectura, permisos o decidir sobre GitHub:
**GPT-6.1 Sol, esfuerzo medio o alto según el riesgo, Standard**.

## Transferencia actualizada — 07/10/2026

El laboratorio local avanzó al commit 389528cbbd6ae1af668931f6bfdd05d499953d13,
que agrega reportes imprimibles. La última transferencia anterior terminaba en
c8db26d; fue reemplazada por el bundle completo descrito en
outputs/LEEME-PC-PERSONAL.md y su ZIP contenedor. El checkout estaba limpio
antes de documentar esta actualización.

La transferencia incluye el historial Git y el código comprometido, pero no el
estado ficticio guardado en el navegador ni dependencias instaladas. El usuario
debe trabajar en una sola PC por vez. Clonar no publica ni conecta cuentas.
La última publicación confirmada en el estado previo sigue siendo v61; no afirmar
v62 hasta verificar un despliegue de ese commit.

Próximo paso en la PC personal: extraer el ZIP, clonar el bundle según la guía,
ejecutar npm ci y abrir la carpeta site en Codex. Luego continuar los
pendientes documentados del laboratorio sin activar cuentas ni /api.

## Transferencia personal preparada — 07/10/2026

Se corrigió y validó el flujo de cierre secuencial de una tarea conjunta: la
tabla de jefatura vuelve al ámbito completo después del cierre de una persona,
y el compañero puede cerrar luego su reporte personal v2. Evidencia actualizada
en `docs/PROJECT-STATUS.md` y
`docs/architecture/review-evidence/joint-close-lab-20261007.json`.

La suite aprobó 407/407 con `--testTimeout=20000`; también pasaron TypeScript,
Vite, Worker y el recorrido Chromium sin errores JS ni llamadas a `/api`. El
primer intento estándar tuvo tres timeouts, sin fallos de aserciones; por eso el
timeout ampliado queda explícito en la evidencia.

Para continuar desde la PC personal, copiar `outputs/grupo-paris-site-transfer-20261007.zip`
por USB o carpeta de archivos, extraerlo, instalar Git for Windows y Node.js,
clonar el bundle con el comando de `outputs/LEEME-PC-PERSONAL.md`, ejecutar
`npm ci` y abrir la carpeta `site` en Codex. Trabajar una sola PC por vez; al
volver, transferir commits con un bundle y aplicar `git merge --ff-only` en
este checkout. No sincronizar `.git` con OneDrive. No se necesita GitHub ni
crear cuentas para editar o ejecutar el laboratorio local. Publicar cambios en
Sites requiere acceder al mismo proyecto privado desde la cuenta dueña; el
paquete no contiene credenciales.

El bundle incluye el historial hasta el commit documentado en la guía, pero no
`node_modules` ni el `localStorage` del navegador. SQL 011 y Worker/D1 siguen
separados; no conectar servicios ni invitar usuarios hasta la aceptación final.
El avance global permanece aproximadamente en 45%.

La corrección quedó publicada en el Site privado existente como **v62** desde
`8d21e3245c6e4ee93aa741b4c3baf3ddc7b8b608`; deployment
`appgdep_6ac5d2df02ec8191b861bfcee8d98934` terminó exitosamente. Relectura de
Sites: versión 62, propietario, audiencia personalizada con una persona
permitida, cero grupos y cero visitantes externos. No cambió el alcance de
acceso.

## Conversión de pedidos de trabajo — 07/10/2026

El último cambio local implementa conversión opcional y explícita de un pedido
de trabajo a una única tarea por jefatura. Se eligen responsable, empresa,
fecha, tipo/controles y peso; se revalidan membresía, jerarquía, período abierto
e idempotencia. El registro conserva el vínculo en ambos sentidos, cierra el
pedido y notifica la asignación. Errores técnicos y sugerencias no se convierten.

Verificación vigente: 408/408 pruebas, TypeScript/Vite/Worker y Chromium Edge
escritorio/móvil; cero errores JS y llamadas a `/api`. Contrato y límites en
`docs/architecture/review-evidence/internal-request-conversion-lab-20261007.json`.
La interfaz y el guardado siguen en `paris-state-lab` y no sincronizan equipos.

Seguir con rutas de laboratorio ya definidas en `docs/PRODUCT-ROADMAP.md` y
`docs/product/CORRECTIONS-20261002.md`. No abrir identidad real, `/api`, Worker,
D1, Supabase ni GitHub antes de aceptar el producto. Actualizar el bundle de PC
personal después del commit y conservar una sola copia de trabajo activa.

## Continuidad desde PC personal — 07/10/2026

El bloque de conversión explícita de pedidos se comprometió en
`f7b4c661d32a753b0ab34f4120c692c880efb8b0` y se publicó como Site v63 en el
mismo proyecto privado. El deployment `appgdep_6ac5db13c9608191bd4ab52ee27f33b2`
terminó correctamente; se confirmó acceso propietario, una cuenta permitida y
cero visitantes externos.

La transferencia vigente está en `outputs/grupo-paris-site-transfer-20261007-f7b4c66.zip`
y `outputs/LEEME-PC-PERSONAL.md`. Incluye un bundle Git completo con los cambios
comprometidos y el historial de `main`; no lleva dependencias ni el estado
`paris-state-lab` guardado en el navegador. En la PC personal, instalar Git for
Windows y Node.js, extraer el ZIP, clonar el bundle, ejecutar `npm ci` y abrir
`site` en Codex. Trabajar una sola copia a la vez; devolver commits por otro
bundle hasta configurar GitHub en la aceptación final. No sincronizar `.git`
con OneDrive. El progreso global sigue aproximadamente en **45%**.

## Búsqueda rápida y próximo corte — 07/10/2026

Se implementó la búsqueda rápida de tareas del laboratorio. Revisa el alcance
del perfil antes de mostrar y antes de abrir resultados; no agrega acceso a
datos de compañeros. La suite completa aprobó 412/412, TypeScript, Vite, Worker
y Chromium Edge escritorio/móvil, sin llamadas a `/api`. Evidencia en
`docs/architecture/review-evidence/quick-task-search-lab-20261007.json`.

Conservar el Site privado y el laboratorio local. Próximo corte: revisar con
GPT-6.1 Sol, esfuerzo alto, los contratos pendientes de dependencias,
delegación/aceptación y avisos; Luna implementa sólo los contratos aprobados.
La infraestructura de cuentas sigue pospuesta hasta la aceptación final.
El avance orientativo permanece en ~45%.
La última versión publicada es la v64 del Site privado, desde el commit
`5ecf94e9439a4d56ceab0990877451b3a5d6ca5a`; la audiencia permanece sin cambios.

## Aviso conjunto validado y accesibilidad — 07/10/2026

El disparador de activación conjunta ya está cerrado en el recorrido del
laboratorio: una única notificación para cada otro perfil autorizado, apertura
de la tarea desde la campana y lectura persistente tras recargar. El componente
común `Dialog` vincula su título con `aria-labelledby`. Evidencia y límites en
`docs/architecture/review-evidence/joint-notification-lab-20261007.json`.

Validación: 412/412 pruebas en 45 archivos; TypeScript, Vite, Worker y Chromium
Edge escritorio/móvil aprobados, cero errores JS y cero llamadas a `/api`.
Vite conserva la advertencia informativa por un chunk principal de ~593 kB.
El alcance continúa local en `paris-state-lab`; no se conectaron cuentas ni
servicios. Publicación confirmada como Site **v65** desde
`8d221ca4da4b32220fd1e49e176c7f01bc248e17`; deployment
`appgdep_6ac5e81f55448191bf732b8f58d73147` exitoso. La audiencia siguió
personalizada owner-only: una cuenta permitida, cero grupos y cero visitantes
externos.

Siguiente paso que requiere revisión de contrato: **GPT-6.1 Sol, esfuerzo alto,
Standard** para evaluar dependencias, delegación/aceptación y notificaciones de
servidor. Después, **GPT-6 Luna, esfuerzo medio, Standard** para implementar los
contratos aprobados en laboratorio antes de conectar infraestructura.

## Estado de rendimiento — 07/10/2026

Se cerró la advertencia del bundle principal mediante carga diferida de rutas.
Entrada actual: 489,53 kB (148,90 kB gzip), frente a ~593 kB anteriores. El
chunk de gráficos de 405,70 kB sigue separado y usado por el resumen; no forma
parte de la próxima decisión de permisos. Evidencia y límites en
`docs/architecture/review-evidence/route-code-split-lab-20261007.json`.

Próximo paso: **GPT-6.1 Sol, esfuerzo alto, Standard**, revisión acotada de
contratos de dependencias, delegación/aceptación y avisos entre dispositivos;
definir el borde de identidad, permisos, idempotencia y entrega antes de portar
mutaciones del laboratorio al servidor. Después seleccionar **GPT-6 Luna,
esfuerzo medio, Standard** para implementar sólo el contrato aprobado. En Plus,
el uso de Work y Codex es compartido y los rangos publicados por cinco horas son
estimaciones; consultar el panel antes de una revisión extensa. No crear cuentas
ni activar integraciones reales hasta el 100% aceptado.

Este corte quedó publicado como **Site v66** desde
`806ff00696434f573ee0542e4710d8b383ab1406`, deployment
`appgdep_6ac5f09cccb48191910a364ef6e8f998`. La audiencia personalizada sigue
owner-only: una cuenta autorizada, cero grupos y cero visitantes externos.

## Copia portable de la simulación — 07/10/2026

La banda «Vista de prueba» permite descargar una copia JSON versionada del
laboratorio y restaurarla en otra PC. La lectura valida formato, estado activo y
tamaño (máximo 10 MB); muestra cantidades y requiere confirmación antes de
reemplazar `paris-state-lab`. El espacio operativo queda intacto. El archivo no
está cifrado; guardarlo de forma privada.

Contrato: `docs/architecture/LABORATORY-BACKUP-CONTRACT-20261007.md`. Evidencia:
`docs/architecture/review-evidence/laboratory-backup-lab-20261007.json`.
416/416 pruebas, pre-commit 100/100, TypeScript, Vite/Worker y Chromium Edge de
descarga/restauración aprobados; cero errores JS y solicitudes a `/api`.

Para el próximo cambio usar **GPT-6 Luna, esfuerzo medio, Standard** en contratos
locales ya definidos y revisión funcional. Cuentas, sincronización, respaldo de
producción, permisos entre dispositivos y migraciones siguen pendientes para la
aceptación final; si el próximo cambio define alguno de esos contratos, revisar
primero con **GPT-6.1 Sol, esfuerzo alto, Standard**. Avance global continúa en
~45%.

## Corte vigente y siguiente revisión — 07/10/2026

La documentación del laboratorio y los avisos locales quedó sincronizada en el
commit `e9fd3f8b33b16366143d2bff413ff5b1fc939b90`, publicado en el mismo Site
privado como **v69** (`appgdep_6ac6458abaec81919944f70b0530a8f6`). El Site sigue
owner-only: una cuenta permitida, cero grupos y cero visitantes externos. Este
corte no agrega funcionalidad ni cambia audiencia.

La transferencia para PC personal se genera a partir del `HEAD` limpio actual,
se valida clonando el bundle en una carpeta nueva y se entrega en
`outputs/LEEME-PC-PERSONAL.md` junto con su ZIP. Pasar el JSON del laboratorio
por separado desde la interfaz; no está cifrado. Trabajar en una sola PC a la
vez y no sincronizar `.git` con OneDrive.

Próximo paso que necesita razonamiento de arquitectura: seleccionar **GPT-6.1
Sol, esfuerzo alto, Standard** para revisar los contratos de dependencias,
delegación/aceptación y avisos entre dispositivos, con foco en identidad,
permisos, idempotencia, historial y límites de notificación. No implementar
escrituras de servidor ni conectar cuentas en esa revisión. Al cerrar el
contrato, volver a **GPT-6 Luna, esfuerzo medio, Standard** para implementar y
validar sólo las decisiones ya acordadas en el laboratorio. El avance total
permanece orientativamente en **~45%**; no equivale a aceptación final.

## Versión documental actualizada — 07/10/2026

El registro anterior de v69 quedó actualizado por el commit
`617536429bd9bcc6d8cb0cfd85eb62948437bdef`, publicado como **Site v70** con
deployment `appgdep_6ac6465aee508191a879dc794316b54a`. La publicación conserva el
mismo Site privado y la audiencia owner-only; es sólo sincronización documental.
El corte funcional vigente continúa siendo el laboratorio de avisos locales,
con verificación previa de 420/420 pruebas y revisión Edge desktop/móvil.

El workflow preparado para GitHub también valida el paquete de despliegue Sites
después del build. La verificación local confirma el formato y sus rutas; todavía
no hay ejecución externa porque el repositorio propio no fue creado. El 100% del
proyecto y el avance orientativo de ~45% no cambian por preparar esta comprobación.

La transferencia portable vigente está en `outputs/LEEME-PC-PERSONAL.md` y el
ZIP de igual nombre indicado en la guía. Bundle y JSON del navegador son
artefactos separados. Para el contrato siguiente, detener implementación y
seleccionar **GPT-6.1 Sol, esfuerzo alto, Standard** según las instrucciones del
último apartado de este archivo.

## Continuación local S39 — 14/10/2026

Se corrigieron los objetivos del recorrido que todavía apuntaban al encabezado
genérico o a la navegación lateral. Cada paso ahora apunta al contenido del
módulo; el tablero conserva un objetivo para columnas vacías/plegadas, y los
paneles o tarjetas se abren sólo mientras el recorrido los necesita. Al avanzar
o pausar, se restaura el estado anterior salvo que la persona lo haya cambiado.
No se crean datos ficticios adicionales ni se ejecutan escrituras de negocio.

Validación registrada en ese corte: **659/659 pruebas en 67 archivos**, TypeScript,
build cliente y Worker aprobados. La suite oficial-equivalente excluye `tmp/**`.
La limitación de navegador descrita entonces quedó resuelta después: Edge pasó
29/29; ver `review-evidence/s39-edge-browser-recheck-20261014.json`. Siguen
pendientes la revisión independiente de Sol y la aceptación humana con lector
de pantalla de etapa 5. Evidencia de la implementación:
`review-evidence/s39-tour-module-targets-lab-20261014.json`.

**Siguiente modelo:** GPT‑6.1 Sol, esfuerzo alto, Standard, para revisar S39 y
reconciliar la aceptación pendiente de la etapa 5. Luego Luna implementa sólo si
Sol marca correcciones concretas. El avance global continúa ~45%; no se conectó
ninguna cuenta ni se publicó el Site.

## Reauditoría del recorrido S39 — 14/10/2026

La inspección del código detectó huecos que no estaban descritos por el corte
anterior. Se agregaron destinos internos para vista/estado vacío de Calendario,
acción y biblioteca de Anotaciones sin exponer contenido personal, filas/empty de
Planificación, seguimiento de Consultas, propuestas de Mejora, distribución de
Análisis, vista previa de cierres y fichas compactas del Catálogo. Los módulos y
las acciones siguen sujetos a su rol. El tour no envía formularios, no confirma
cierres y no cambia datos de negocio. El Catálogo puede abrir temporalmente su
ficha para orientar y restaurarla al cambiar de paso o salir. El progreso se
versionó a 6 para no saltar pasos recién ajustados.

La revalidación incluyó una matriz Edge de empleado/encargado/jefe y una
reducción de ventana escritorio→móvil. Detectó y corrigió que el coach quedara
fuera de pantalla al cambiar el viewport. Estado final: suite 663/663 en 67
archivos, TypeScript, cliente/Worker y `git diff --check` aprobados; Edge 31/31,
cero errores JS y API operativa. No requiere instalar npm global: se usaron Node,
Vitest, Playwright Core y Edge ya presentes en el entorno. Evidencia:
`architecture/review-evidence/s39-tour-refresh-20261014.json` y
`../outputs/s39-tour-refresh-20261014/browser-validation.json`.

**Siguiente paso:** revisión independiente GPT‑6.1 Sol, esfuerzo alto, Standard,
para aceptar el contrato S39 y comprobar la privacidad/estados vacíos. La
aceptación humana con lector de pantalla sigue siendo un gate de etapa 5. Luego
continuar sólo con hallazgos concretos; no conectar cuentas ni desplegar aún.

## GitHub y continuidad desde PC personal — 16/10/2026

La continuidad directa está en `main` de `tablerocontable-paris/TABLERO-CONTABLE`.
El repositorio privado recibió una importación inicial nueva atribuida a
**Tablero Contable**, sin arrastrar al historial publicado las fechas y autores
del checkout local previo. Clonar `main` en la PC personal; no usar la PR
bootstrap ni las ramas auxiliares de migración.

Pendiente después de la clonación: instalar dependencias con `npm ci`, abrir el
proyecto y comprobar su ejecución local. Supabase, Cloudflare y Gmail no están
conectados; no hay despliegue operativo ni migraciones aplicadas.
