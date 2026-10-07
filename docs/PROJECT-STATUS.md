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
