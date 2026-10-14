# Revisión de cobertura del plan — 07/10/2026

**Resultado: no están todos los cambios implementados de forma completa y compatible.**
Hay componentes y funciones nuevos para gran parte del plan, pero la revisión
independiente encontró defectos de permisos, bloqueos, cierre e indicadores y
requisitos aún sin implementar. El corte no está aceptado para commit/publicación.
Esta revisión no modificó código funcional, datos operativos ni servicios.

## Evidencia actual

Se ejecutaron ocho probes de dominio con estados ficticios y un recorrido Edge
con tres comprobaciones nuevas. Los once casos reprodujeron las discrepancias
descritas abajo. El recorrido Edge no registró errores JavaScript ni solicitudes
a la API operativa. Ese resultado no significa que las reglas sean correctas:
los errores funcionales fueron los que esta revisión buscó y observó.

- `docs/architecture/review-evidence/plan-review-domain-20261007.json`.
- `docs/architecture/review-evidence/plan-review-browser-20261007.json`.
- Fuentes de probes y capturas: `outputs/plan-review-20261007` del workspace.
- Corte auditado: árbol local sin commit sobre HEAD `2c3fbfe`.

Las 442 pruebas y compilaciones registradas en la implementación anterior no se
repitieron aquí: no cambió el código del producto durante esta revisión. Sus
resultados siguen siendo evidencia de esos escenarios, pero no cubrían los
casos adversos encontrados ahora. El p95 anterior de 399,35 ms es de aquel
benchmark local; no se volvió a medir en esta revisión.

## Matriz del plan

"Implementado local" indica presencia verificada en fuente y en los escenarios
citados, sin equivaler a aceptación integrada o productiva.

| Pedido | Estado observado | Qué falta |
|---|---|---|
| Resumen para empleado; Catálogo y Cierre sólo jefe | Implementado local | Recorrido del encargado todavía incluye un paso de Cierre que su rol no puede abrir. |
| Catálogo compacto con búsqueda/filtros y despliegue | Implementado local | Revisión visual final de densidad y configuración. |
| Consultas y Anotaciones con formulario compacto | Implementado local | Aceptación visual; formularios se abren desde acción. |
| Barra fija, búsqueda/campana/tema y ruta en contenido | Implementado local | Aceptación visual final. |
| Identidad única y selector visual de empleados | Parcial | El selector agrega una segunda ficha del actor simulado; las opciones usan un select nativo sin iniciales/tonos por opción. La barra de filtros creció en altura. |
| Operativas sin cuota ni barra de meta | Parcial | Las tarjetas están corregidas, pero los grupos del reporte nuevo todavía calculan puntos contra la meta antigua (R11). |
| Carga con coeficiente versionado; cero distinto de sin parametrizar | Implementado local en registros/tarjetas | Conservar coherencia en reportes, histórico y respaldo. |
| Calidad separada, opcional y con observación | Implementado local | Revisión integral de snapshots y compatibilidad histórica. |
| Sin nuevas operativas conjuntas | Implementado local en la interfaz | Auditar todas las rutas de escritura y estados importados. |
| Consulta, gestión y ejecución separadas | Parcial con defectos | Consulta omite empresa; ajuste de pesos se rechaza al jefe; falta reprogramación puntual del encargado (R01/R09). |
| Notas personales privadas al consultar a otro empleado | Implementado local en rutas revisadas | Completar matriz de búsqueda, calendario y exportaciones junto con permisos por empresa. |
| Calendario mensual, fechas y ausencias | Parcial | Faltan enlaces de origen para obligaciones/ausencias, detalle compartido visible, destinatarios obligatorios identificados y selección ligada a la empresa del formulario. |
| Presencia visible desde equipos | Simulación implementada | Sólo el actor seleccionado figura en línea. Presencia autenticada 30/90 segundos pertenece a la etapa real pospuesta. |
| Seguimiento comercial 0–30 | Parcial | El botón especializado confirma, pero el botón común puede completar sin esa confirmación (R05). |
| Dependencias y disponibilidad | Parcial con defecto | La ruta informa espera, pero iniciar/cronometrar/completar no la revalidan (R02). |
| Hoja de ruta con orden estable y motivos | Parcial | No recibe los filtros del módulo; la explicación "Lista para empezar" no explica la posición recomendada. |
| Cierres por todos/equipo/empresa/persona | Parcial con defectos | El cierre conjunto no es atómico; planificación y coberturas ignoran cierres parciales (R03/R04/R10). |
| Adjuntos opcionales y optimización local | Parcial | Hay límites, IndexedDB, huellas y vistas previas; las escrituras asíncronas usan estado anterior y falta vínculo a una finalización concreta. |
| Respaldo v2 con archivos y compatibilidad v1 | Parcial con defecto | Se acepta un campo de dependencia inválido y el estado restaurado puede fallar al abrir la ruta (R06). |
| Paneles plegables y tablas resumidas | Parcial | Hay paneles plegables; falta completar el patrón y ayuda por indicador en todos los bloques previstos. |
| Evolución seleccionable, torta en grises y barras/tooltips | Implementado local en UI | Histórico comparable pendiente; totales de cantidades mezclan unidades distintas. |
| Series históricas desde snapshots y definición identificada | Pendiente | La evolución usa `state.tasks`/`state.activity`, no cierres congelados ni etiquetas de definición. |
| Arrastre ampliado y animación | Implementado local | Ya cubierto por la validación anterior; revisar la aceptación visual completa. |
| Recorrido con exterior oscuro, posición junto al objetivo y teclado/foco | Parcial | Sólo hay un contorno; coach fijo, foco exterior y Escape no cierra (R08). Faltan pasos interiores por módulo. |
| Bloque lateral Mi jornada | Implementado local | Ajustar convivencia con selector para no empeorar altura/contraste. |
| Indicadores correctos de Mi día | Defecto nuevo | Se muestran 0/0 y cero puntos pese a cuatro entregables del perfil (R07). |
| Commit, actualización del Site y paquete para PC | Pendiente | Requieren primero corregir el corte y completar su revisión. |

## Hallazgos reproducidos

### R01 — P1 — Consulta fuera de empresa autorizada

`src/domain/laboratory-work.ts:308` autoriza por jerarquía sin comprobar
actividad del perfil ni membresía de empresa. El probe quitó c1 al encargado:
`canWork` devolvió false y `calendarCanAccessTask` true para la misma tarea.
La función se usa en listados, detalle y aperturas. También debe conservar la
consulta legítima del encargado de cualquier participante de una tarea conjunta.

### R02 — P1 — Dependencias informativas sin bloqueo de ejecución

`src/domain/laboratory-work.ts:228` marca la tarea no habilitada, mientras
`canExecuteLab` en la línea 531 no consulta disponibilidad/dependencias.
`App.mutateTask`, `clock` y `moveBoardTask` sólo comprueban `blockedBy`.
El probe obtuvo `routeReady: false`, autorización de ejecución y estado
`En curso` con una tarea previa pendiente.

### R03 — P1 — Reprogramación cambia una empresa ya cerrada

`src/domain/planning.ts:25` y `src/domain/model.ts:531` sólo consideran cierres
mensuales completos. Se cerró e0/c1 dejando c2 abierta y luego se reprogramó su
asignación: desapareció la tarea cerrada del estado vivo y surgieron dos nuevas.
`App.tsx:2900` permite igualmente nuevas tareas dentro de unidades cerradas.
Auditar también activación conjunta, altas, coberturas y reasignaciones.

### R04 — P1 — Cierre conjunto puede quedar a medias

`src/domain/laboratory-work.ts:470` expande participantes y luego escribe cada
unidad dentro de un `try/catch` individual. La UI filtra listas por unidad en
`src/components/CompanyClosureManager.tsx:47`. Con una tarea conjunta terminada
y otro cronómetro activo de B, se cerró A/c1 y B/c1 quedó bloqueada. La
expansión tampoco recorre transitivamente cadenas de tareas conjuntas.

### R05 — P2 — Finalización comercial sin confirmación

El control de `CommercialProgressPanel.tsx:51` pide confirmación, pero
`App.advance` llama `transition` directamente. Con día 30 y controles listos,
el botón común de completar evita la confirmación del panel especializado.

### R06 — P1 — Respaldo acepta campos nuevos inválidos

`src/data/repository.ts:249` deja los campos nuevos de tarea/movimiento en
`passthrough` sin validación específica. Un respaldo con
`dependsOnTaskIds: "not-an-array"` se aceptó; `suggestedRoute` falló con
`deps.map is not a function`. Validar tipos, fechas, rangos, referencias y ciclos
de los nuevos campos antes de sustituir el estado.

### R07 — P1 — Mi día muestra indicadores vacíos

`src/App.tsx:545` sólo calcula métricas en overview/analytics, aunque la página
day renderiza `stats()`. Edge mostró 0/0 entregables y 0 puntos para una cuenta
con cuatro entregables del mes. Es una regresión introducida por la optimización.

### R08 — P2 — Recorrido incompleto

`src/styles.css:1458` sólo dibuja un contorno/sombra de 8 px. El coach sigue fijo
en el pie (`src/styles.css:1406`). Edge confirmó falta de oscurecimiento,
foco fuera del diálogo y que Escape no lo cierra. Los pasos de módulos posteriores
siguen apuntando al menú y el encargado recibe un paso de Cierre sin permiso.

### R09 — P1 — La jefatura no puede gestionar pesos de empleados

El control de `src/App.tsx:3151` usa `mutateTask`, cuyo guard exige ejecución.
En Edge el jefe intentó cambiar 5 a 8: se conservó 5 y apareció el rechazo
"sólo su responsable o cobertura autorizada puede ejecutarla". Falta una
ruta de gestión independiente, y la reprogramación de tareas puntuales del
encargado tampoco tiene un control/contrato implementado.

### R10 — P1 — Cierre ignora cronómetro de cobertura y deja registrar después

`companyUnitCloseBlocker` sólo inspecciona las tareas de responsabilidad del
dueño de la unidad. Con e0 ejecutando una cobertura de e1/c1, su propia unidad
e0/c1 se pudo cerrar. El cronómetro siguió activo y `canExecuteLab` aún permitió
escritura en la tarea cubierta. La captura de contribuciones de cobertura queda
incompleta. Se necesitan guardas tanto de responsabilidad como de contribución.

### R11 — P1 — Reporte nuevo sigue calculando puntos operativos contra cuota

`src/domain/laboratory-work.ts:421` genera el reporte base desde las tareas
guardadas y agrega el resumen nuevo sin sustituir sus métricas de operativas.
En un reporte schema 3 se observaron 4 puntos previstos y 2 logrados para
5 de 10 facturas, aun con carga pendiente de parametrizar. CSV y tablas muestran
esos campos. Los reportes nuevos deben excluir ese cálculo; los anteriores
conservan su definición original.

## Gaps adicionales comprobados en fuente

- **P1, escrituras asíncronas de evidencia:** `TaskEvidencePanel.tsx:26` y
  `App.tsx:3211` esperan almacenamiento y después guardan una copia del estado
  anterior. Un cambio durante la espera puede perderse; no se revalida actor,
  permisos, cierre ni cantidad de archivos al confirmar. No se simuló la demora
  en Edge en este corte; el riesgo se identifica por el orden de las operaciones.
- **Historia:** `App.tsx:992` calcula desde filas vivas y no indica versión de
  métrica. Las participaciones y tiempos de un perfil conjunto tampoco se
  ponderan/filtran de forma equivalente a su reporte personal.
- **Cantidades:** `App.tsx:552` suma unidades diferentes y las rotula juntas.
  Edge mostró "100 facturas · trámites · pagos" aunque eran 100 facturas.
  Informar cantidades por unidad y separar conteo de registros de suma de unidades.
- **Calendario:** la empresa del formulario no controla las opciones de
  destinatarios, los superiores obligatorios no se muestran seleccionados por
  nombre, falta ver el detalle compartido y faltan enlaces al origen de
  obligaciones/ausencias (`DeadlineAgenda.tsx:44,98,122,126`).
- **Completitud visual:** la ayuda de cálculo está en un módulo; no se implementó
  todo el patrón de ayuda y plegado previsto. El selector conserva un select
  nativo y hace la barra de filtros notablemente alta.

## Decisión de continuidad

Preparar las correcciones según
`docs/architecture/PLAN-CORRECTIONS-NEXT-20261007.md` con GPT-6 Luna, esfuerzo
medio, Standard; luego GPT-6.1 Sol, esfuerzo alto, Standard para revisar el corte.
No commit ni actualización del Site mientras existan estos defectos. Las cuentas
e infraestructura real siguen pospuestas. Avance global orientativo **~45%**,
sin aumento; esta revisión no demuestra aceptación de la versión final.

## Vigencia de este informe — auditoría 11/10/2026

Las observaciones R01–R11 documentan el árbol del 07/10 y no certifican el estado
actual. La revisión posterior distingue correcciones realizadas de defectos
nuevos o variantes no cubiertas en SOL-AUDIT-20261008.md. No sumar automáticamente
estos once casos a los 58 hallazgos vigentes ni declarar corregido un requisito
por tener una prueba del caso antiguo. La matriz de aceptación vigente es
SOL-REQUIREMENT-COVERAGE-20261008.md.
