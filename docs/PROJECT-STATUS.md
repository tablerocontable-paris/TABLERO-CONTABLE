# Estado al inicio del laboratorio — 06/10/2026 · registro histórico

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
