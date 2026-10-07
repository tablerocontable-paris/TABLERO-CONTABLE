# Estado vigente — 06/10/2026 · laboratorio

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
- QA visual y funcional del producto completo, volumen, recuperación/respaldo,
  seguridad y ensayo controlado del circuito final.
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
