# Matriz del pedido aprobado — auditoría Sol

**Aceptación técnica posterior vigente — 14/10/2026:** S38/S44 y la espera de
captura S52 aceptados por revisión independiente, fuente y 69/69 comprobaciones.
Las siete etapas están revisadas técnicamente en alcance local; etapa 5 conserva
el gate humano con lector de pantalla. No se confirma aceptación global ni
infraestructura alojada. Evidencia:
`review-evidence/s38-s44-independent-acceptance-20261014.json`.

**Registro de implementación previo 14/10/2026:** S38/S44 y la espera de captura S52
quedaron corregidos y verificados localmente. Suite 668/668, TypeScript/builds y
Edge 32/32; no equivale a revisión independiente Sol ni a aceptación humana con
lector de pantalla. Etapa 5 mantiene ese gate humano; etapa 7 conserva el límite
de no validar Supabase alojado. Detalle: `s38-s44-followup-20261014.json`.

**Registro histórico de revisión inicial 14/10/2026:** S38 y S44 reabiertos
por dos reproducciones fallidas con App real. S52 y S57/S58 aceptados en alcance
local; etapas 5/7 no aceptadas y lector de pantalla humano pendiente. Informe:
`SOL-INDEPENDENT-REVIEW-20261014.md`; evidencia:
`review-evidence/independent-review-20261014.json`. Esta nota y las filas por
etapa actualizadas reemplazan los saldos anteriores, conservados como histórico.

Estado: requisitos auditados; aceptación global del producto pendiente. Esta
matriz deriva del plan aprobado y las correcciones del usuario; no agrega
funciones. La columna “Criterio/pendiente del corte” conserva notas históricas
de aceptación y no representa por sí sola un defecto vigente. El estado actual
por hallazgo está en la reconciliación al final de este documento, que
reemplaza los estados de etapa anteriores.

**Actualización vigente 14/10/2026:** PostgreSQL/MVCC local pasó 26/26
escenarios concurrentes en un cluster descartable PostgreSQL 17.11, con
claims/Auth sintéticos. Por eso queda cerrada la comprobación MVCC local de
etapa 7. No se probaron Supabase Auth/RLS ni servicios desplegados. Siguen
pendientes la revisión independiente Sol de S52 y etapas 5–7 y la aceptación
humana con lector de pantalla. Ver
`review-evidence/sol-corrections-runtime-recheck-20261014.json`. Los estados
contrarios de los registros fechados antes de esta actualización son históricos.

Presencia en fuente no equivale a aceptación. Los hallazgos e instrucciones
originales están en `SOL-AUDIT-20261008.md`.

Actualización integrada 14/10/2026: suite completa actual **665/665 en 67 archivos**;
TypeScript, builds cliente/Worker, cuatro E2E Edge, auditorías automatizadas de
accesibilidad/contraste y `git diff --check` pasan. Se reconciliaron
65/65 hallazgos, sin omisiones ni duplicados. El aviso de entrada >500 kB quedó
resuelto por separación del framework (entrada 328,29 kB) sin cambiar el
umbral; `laboratoryEvidence` conserva carga diferida. Zod mantiene avisos `PURE`.
Etapas 1–3 fueron
aceptadas por Sol. En etapa 4, S52 está implementado y verificado en Edge con
Recharts real; sólo resta revisión Sol. Etapas 5–7 están implementadas y
validadas localmente; siguen abiertas sus revisiones Sol y la aceptación humana
con lector de pantalla (etapa 5). PostgreSQL/MVCC local pasó 26/26 casos con
Auth sintético; Supabase Auth/RLS alojado no se validó. Evidencia actual:
`review-evidence/sol-corrections-runtime-recheck-20261014.json`;
los cortes específicos y sus límites siguen en los informes de etapas 4–7.

**Reauditoría S39 posterior — 14/10/2026:** la matriz de roles y geometría
desktop/móvil pasó en Edge **31/31**: empleado 11 pasos, encargado 13 y jefe
15; coach verificado en 390×844, cero errores JavaScript y cero llamadas a la
API operativa. La suite integrada actual está en 665/665; TypeScript y builds cliente/Worker
aprobados. Esta corrida reemplaza los resultados anteriores de 29/29 y 29/29
del paquete integrado en cuanto a la cobertura específica del recorrido. No
reemplaza la revisión independiente Sol ni la aceptación humana con lector de
pantalla. Evidencia: `review-evidence/s39-tour-refresh-20261014.json` y
`../../outputs/s39-tour-refresh-20261014/browser-validation.json`.

Revalidación posterior de S39 en Edge: pasó 29/29, sin errores JS ni llamadas
a API operativa. El primer intento reveló sólo una expectativa obsoleta del
runner (“Cierre por alcance”); se actualizó a “Cierre de mes”. Auditoría AX
actual: 38 rutas, 2.124 controles y 904 paradas de teclado, cero nombres o
focos faltantes. Contraste: 5.943 textos en 76 combinaciones, cero omitidos o
fallos. Esto no reemplaza la revisión independiente Sol ni la aceptación humana
con lector de pantalla. Evidencia consolidada:
`review-evidence/sol-corrections-recheck-full-20261014.json`.

Reejecución local posterior el 14/10: suite **663/663**, cuatro E2E Edge,
auditorías AX/contraste y S57/S58 pasaron desde el árbol comprobado. El runner
de correcciones confirmó 29/29 y esperó a que la torta S52 mostrara sus dos
sectores completos; el benchmark S57 obtuvo p95 501,38 ms. La
auditoría AX actualizada registró 877 paradas de teclado. Esto resuelve la
limitación previa del runner de navegador; la evidencia vigente también registra
PostgreSQL/MVCC local 26/26 con Auth sintético. No cierra la aceptación
independiente Sol, la revisión humana con lector de pantalla ni valida Supabase
Auth/RLS alojado. Evidencia vigente:
`review-evidence/sol-corrections-runtime-recheck-20261014.json`.

| Requisito | Fuente localizada / evidencia vigente | Criterio/pendiente del corte |
|---|---|---|
| Resumen empleado; cierre y catálogo sólo jefe | App, navegación y guarda closing jefe | Matriz completa por rol y acceso directo |
| Logo centrado, sin Espacio contable, alineado con empresa | App/styles | Comparación visual escritorio/móvil |
| Notificaciones arriba y avisos de asignación/cambio/cierre/comentario/conjunta | NotificationCenter, notifications | Destinatarios, duplicados, actor y apertura autorizada; cambios de disponibilidad/dependencias/seguimiento S42 |
| Quitar cartel promocional de actividad operativa | App | Captura actual de módulo y revisión de texto |
| Encabezado fijo; avatar único abajo; tema con icono | App/styles/ThemeControl; falla almacenamiento reproducida S10 | Scroll, móvil, tres modos y corrección de almacenamiento bloqueado |
| Catálogo compacto, búsqueda, expansión e historial | CatalogueVersionCard/CatalogueCreator | Densidad y controles accesibles por rol |
| Consultas y Anotaciones compactas | InternalRequests/Annotations; 22 tests existentes y dos reproducciones S29 | Conservar borradores si falla guardado S29; estado resuelto terminal en respuestas S51; comparación visual y teclado |
| Operativas por cantidades, carga y tiempo, sin meta | OperationalTaskCard/laboratory-work | Eliminar meta exigida en bandeja de parametrización S33; coeficientes, vigencia, ausencia de peso, cero, historial S04; fecha local de vigencia S41; puntos heredados en ciclo e inducción S48 |
| Calidad opcional independiente con observación | OperationalQualityReview | Prueba de separación aprobada (sin evaluar vs cero, observación); integración, permisos y cierre pendientes |
| No nuevas operativas conjuntas; historial anterior conservado | laboratory-work/JointTaskSetup; `tests/joint-coordination.test.ts` | Jefatura activa sin membresía directa puede activar entregable elegible S47; mantener pendientes revisión independiente del bloque y rutas alternativas/restauración legacy |
| Consulta de terceros sin cambiar actor ni acceder notas | App/EmployeePicker; 95 tests acotados | Matriz completa; S01/S02/S06/S13; Planificación tras revocar empresa S43; creación de tareas fuera de empresa autorizada S50 |
| Selector buscable y agrupado por equipo en grises | EmployeePicker; pruebas teclado; Edge cubre actor y consulta de tablero con 24 perfiles | Implementado S36: ambas listas mantienen visible la opción activa al usar End; lector de pantalla y revisión Sol pendientes |
| Presencia en equipo, simulada en laboratorio, TTL 90 s | workforce/Workforce; App empleado reproduce S18 | Corrección de visibilidad por jerarquía S18; real requiere sesión futura |
| Calendario mensual/agenda con obligaciones, tareas, fechas y ausencias | DeadlineAgenda/calendar-agenda | Fechas derivadas, privacidad y vínculos; S05/S14/S23/S24/S40; borrador fiscal preservado ante commit=false (prueba DOM) |
| Compartir manual con superiores obligatorios y avisos | laboratory-work | Permisos de todos, cambios/cancelación y jerarquía S03 |
| Ausencias y cobertura sigue independiente | Workforce; `tests/scheduling-workforce.test.ts` | S28 permite ausencia de subordinado sin reemplazo al encargado autorizado y mantiene guardas si se elige cobertura; aceptar independientemente permisos e intervalos/cancelación/baja de reemplazo |
| Seguimiento comercial 0–30 sin fechas ficticias | CommercialProgressPanel | Todas las vías de completar; S02/S08 |
| Dependencias válidas, sin ciclos, disponibilidad | TaskReadinessPanel/model | Inicio, controles, completar, referencias S08 |
| Mi día: hoja sugerida explicada, filtros y orden estable | SuggestedRoutePanel; exposición de dependencia reproducida S17 | Desempates, bloqueo externo, libertad de orden y motivos autorizados S17 |
| Cierre todos/equipo/empresa/persona, preview exacto e idempotencia | CompanyClosureManager | Confirmación ligada a período/unidades S35; atomicidad ante fallo S61; conjuntas, relojes, empresas abiertas y cobertura S12 |
| Snapshots históricos sin recalcular desde datos vivos | closedHistory/reports | Ausencia de base, versiones, filtros y cobertura S04/S12 |
| Hasta 3 adjuntos, imagen 5 MB/PDF 10 MB, optimización y preview | laboratoryEvidence/TaskEvidencePanel | Corrupción, cuotas, concurrencia, URL S07/S09; fallo precommit S65 |
| Referencias/evidencia operativa sugeridas y opcionales | Formulario App; S16 reproducido en callback actual | Ausencia no bloquea ni resta puntos; compensación, aviso y reintento S16; exclusión de envíos simultáneos S49 |
| Respaldo v2 50 MB con archivos, lectura v1, restauración atómica | LaboratoryBackup/repository | S03/S09/S10/S11/S64; fallos y reintentos |
| Paneles extensos plegables con descripción y cantidad | ui/Planning/ProcessQuality/App | Inventario completo; filtros accesibles; visual móvil |
| Análisis: resumen, gráficos, tablas plegadas, ayuda contextual | App/TimelinessPanel | Coherencia de unidades y datos, menor scroll |
| Evolución seleccionable: cumplimiento/puntualidad/carga/tiempo | App/closedHistory | No combinar unidades incompatibles; S04/S12 |
| Torta seleccionable por estado/tipo/empresa/equipo en grises | PieChart App | Etiquetas, valores, teclado y contraste real |
| Cumplimiento compacto; cero distinto de sin base | App | Altura/valores y filtros, sin mezclar operativas; S52 conserva visibles en gráfica/CSV los ámbitos sólo operativos como “Sin base de entregables”, separados de cero y de calidad “Sin evaluar” |
| Tooltips logrado/pendiente/total con unidades y sin recorte | App gráficos | Bordes, tabla, zoom, móvil y pantalla reducida |
| Arrastre tipo Trello, preview grande, animación y teclado | TaskBoard/styles; Edge S54 cubre movimiento real y atribución a cobertura | Implementado S54: conserva titular, registra actor real y respeta reduced motion; aceptación humana y Sol pendientes |
| Recorrido con exterior oscuro, explicación y pasos internos | App/styles; Edge verificó roles, pasos internos, exterior oscurecido, geometría y foco al pausar | Implementado S37–S39; navegador y foco automatizado pasan; lector de pantalla humano y revisión Sol pendientes |
| Mi jornada útil en espacio lateral | App sidebar-day-summary; `tests/annotations-tour-app.test.tsx` | S53 oculta conteo/título de empresa revocada, conserva tareas de empresa vigente y permite navegar sólo a la tarea autorizada; revisión Sol pendiente |
| Backend validado sin trasladar campos lab automáticamente | site-policy/site-worker y DTO Worker; prueba integrada S44 inicia polling GET antes del cambio y resuelve su respuesta durante el POST pendiente, conservando la propuesta en App; S45 exige que `activeId` resuelva a un perfil activo en GET y POST | S01/S13 y matriz de acciones completa, aceptación independiente Sol sigue separada; PostgreSQL/MVCC local 26/26 con Auth sintético; Supabase Auth/RLS alojado no se validó; S45 rechaza DTO inválido preservando la propuesta, S46 cubre presencia fallida en GET/POST, workspace persistido y ausencia de heartbeat sin identidad. La ruta remota continúa inactiva y sin API operativa. |

| SQL histórico preservado; futura integración compatible | Contraste lector/gateway hasta 011: 13/14; notas 12/12; staged 010 52/52; catálogo efectivo de permisos | S30/S31/S32/S59/S60; definiciones 001–011 revisadas, corrección y servicios reales pendientes |
| Commit/hook/PR/build/deploy/migraciones automáticos | scripts/.github/docs ops | Reproducibilidad, exactitud staged; servicios propios posteriores |
| Paquete portable para PC después del commit validado | scripts/paquete y runbooks | Entrega portable y comandos en instalación limpia |
| Rendimiento 24 perfiles/2.000 tareas y accesibilidad | Evidencia anterior en PROJECT-STATUS | Revalidación al corregir, lector de pantalla y equipo/navegador |
| Mismo Site privado, sin API operativa ni cuentas reales | main/LaboratoryWorkspace | Tráfico en recorridos finales y audiencia al publicar |

### Revalidación integrada local — 14/10/2026

El árbol de ejecución tuvo SHA-256
`2cff5088bbc8992cecfbe25c1f019c8121ae673119d4580493c3bd534047d425` (433
archivos incluidos, outputs excluidos). La suite pasó 663/663 en 67 archivos;
TypeScript, cliente, Worker y cuatro E2E Edge pasaron. S39 corrigió únicamente
el nombre esperado por el runner y quedó 29/29 en navegador. La auditoría AX
revisó 38 rutas/3 perfiles, 2.124 controles y 904 focos; la auditoría de
contraste revisó 5.943 textos en 76 combinaciones, sin omisiones ni hallazgos.
S57 obtuvo p95 534,39 ms para 24 perfiles/2.000 tareas y 30 muestras; S58 pasó
7/7 con 209 omitidas. La inspección de lector de pantalla humano y revisión
independiente Sol no se han realizado. Evidencia completa:
`review-evidence/sol-corrections-recheck-full-20261014.json`.

Revisión focal posterior de los contratos aún abiertos: 200/200 regresiones en
18 archivos; S57 p95 569,62 ms y S58 7/7. Benchmark y aislador comparten el
hash efectivo `292d563c7f2306cc5f71967e76dc737e8da8e1a87de1b7322b1b9cd3b9b5568e`.
La revisión no confirmó una discrepancia nueva de código; no equivale a la
aceptación independiente Sol, a lector de pantalla humano ni a MVCC real.
Evidencia: `review-evidence/open-contracts-recheck-20261014.json`.
El intento inicial de extracción quedó cancelado, pero fue superado con el
archivo oficial EDB: PostgreSQL/MVCC local pasó 26/26 escenarios concurrentes
con Auth sintético. El cluster descartable ya está apagado; Supabase Auth/RLS
no se probó.

## Cómo cerrar cada fila

Registrar archivo/línea, prueba que cubre la regla, resultado y, para pedidos
visuales, captura/runtime actual. Si faltan evidencia o escenarios, la fila
sigue abierta. No borrar pendientes por pasar una suite ajena a su requisito.
Cada corrección de Luna debe señalar filas y hallazgos afectados, preservar los
contratos históricos y ejecutar regresiones de los cruces relacionados.

Esta matriz no declara las 406 rutas revisadas ni el producto aceptado. Cuentas
propias, Supabase dev/producción, GitHub y hosting siguen siendo parte del 100%
final; no se conectan durante el laboratorio. La revisión integral permanece
activa hasta cerrar cobertura y decisiones necesarias para Luna.








### Estado vigente de hallazgos documentados en el corte anterior

- **S55:** corregido y aceptado dentro de etapa 2; el guard de carga se vuelve a
  validar tras el await y el formulario conserva estado ante rechazo.
- **S24:** corregido y aceptado funcionalmente en etapa 4; cambia el período
  fiscal interno, despliega el panel y enfoca el origen original autorizado.
- **S56:** IDs accesibles prefijados por instancia; pruebas cubren tablero propio,
  cubierto y vacío. Revisión Sol y aceptación humana de etapa 5 siguen abiertas.
- **S60:** la migración local 012 preserva movimientos distintos por
  operationId/actor; no se aplicó remotamente. PostgreSQL/MVCC local pasó
  26/26 escenarios con Auth sintético; revisión Sol y Supabase remoto siguen
  pendientes.
- **S57/S58:** los verificadores se corrigieron; el benchmark actual exige
  p95 <1.000 ms y hash del árbol, y el runner aislado ejecuta/valida los siete
  casos exactos sin sobrescribir reportes. Revisión Sol pendiente; el resultado
  local no certifica producción o concurrencia.
- **Privacidad SQL009:** la evidencia renovada se limita a comentarios de
  bloqueo remotos y no se interpreta como privacidad de Anotaciones ni como
  aceptación de frontend/backend efectivo.

Evidencia vigente consolidada:
`review-evidence/sol-corrections-recheck-full-20261014.json`.

### Implementación local S57/S58 — 14/10/2026

S57/S58 se corrigieron localmente; aceptación independiente Sol pendiente.
`scripts/benchmark-laboratory.cjs` valida una fixture referencial de 24 perfiles
y 2.000 tareas, espera contenido propio de cada módulo y dos frames, mide 30
recorridos calientes y falla ante p95 >=1.000 ms, muestra inválida, errores JS
o API. Reporte: `outputs/performance-lab-2026-10-14T12-47-03-976Z-2820/`;
p95 368,07 ms. `tests/review/run-time-coverage-008-isolation.mjs` usa siete
nombres actuales y reportero JSON; todos pasaron. Registra 206 omitidas por los
filtros, con 7 ejecutadas y 0 fallidas. `tests/verification-contract.test.ts`
comprueba rechazos de p95 1.000/1.500, cero y omitidas, patrón faltante,
proceso sin status, fallo, fixture y errores JS/API (9/9). Los informes por
corrida son no destructivos y contienen SHA-256 del árbol efectivo. Evidencia
consolidada: `review-evidence/stage-6-verifier-implementation-lab-20261014.json`.

### Hallazgo posterior S59 — actualizado 14/10

La migración local 012 aplica revisión null-safe y revalidación posterior a
bloqueos tanto al aprobar como al pedir cambios. La prueba focal comprueba
revocación de equipo sin mutar solicitud, revisiones o auditoría (39/39 en
`tests/database.test.ts`). El corte local actual está implementado; siguen
pendientes revisión independiente Sol y validación PostgreSQL/MVCC concurrente.
No se aplicó migración remota.

## Correspondencia con documento de ejecución — 11/10/2026

SOL-LUNA-CONTRACTS-20261011.md reúne instrucciones S01–S60 y una tabla de aceptación de todos los grupos del pedido, incluidos requisitos visuales/funcionales sin hallazgo individual. La matriz sigue abierta: referencias e instrucciones no sustituyen sus pruebas. Deben registrarse resultados por fila después de corrección y validación. El contrato de entrega futura con cuentas propias permanece separado del laboratorio.

### Registro histórico 11/10 — atomicidad de cierre S61

Hallazgo adicional confirmado mediante fallo controlado de consolidación sobre seed válido: resultado contiene unidad cerrada y bloqueada. Instrucciones en SOL-AUDIT y contrato Luna, etapa3. Total vigente61 hallazgos/91 casos abiertos; no se corrigió producto ni se publicó.

## Registro histórico 11/10 — búsqueda global y foco (S62/S63)

S62/S63 actualizados 14/10: la etapa 5 reemplazó listbox/option por lista y botones nativos; Edge comprobó Tab/Enter/Espacio, preservación del actor, foco del destino y retorno del foco al Escape. Pruebas focales y suite completa pasan. Evidencia `outputs/stage-5-validation-20261014/edge/browser-validation.json`. La aceptación con lector de pantalla y la revisión independiente Sol siguen pendientes; no inferir aceptación de todos los consumidores de Dialog.

Respaldo integrado actual backup-integration-current-20261011:download/inspect/confirm/restorev2,archivo1,quota inyectada,rollback localStorage yblob temporal,cierres con evidencia disponible,móvil dentro deviewport,ceroJS/API. No acreditaS03/S09/S11 ni límites/PDF/legibilidad completos. Mantener pendientes de matriz yregistro63hallazgos/93casos.

## S64 — capacidad de copia y límites

Texto debe indicar límite total de copia50MB(JSON+Base64+datos),no50MBraw de adjuntos. Prueba backup-byte-boundary-20261011.json3/3 verifica v2exacto/+1ycompatibilidadv110MiB. FixturesJSONsinarchivos:restauración física ylegibilidad permanecen criterios separados. Etapa2,total64/94.

## Registro histórico 11/10 — S65 compensación de evidencia

S65 añade manejo de fallo precommit de entregable con archivo yaalmacenado;no borrar en errorposterioraléxito. Prueba usa componente ycommitAgainst actual con fallo controlado ystorage simulado;IndexedDB físico no acreditado porésta. Etapa2,coordinaS09/S16/S49/S55. Los criterios de evidencia/restauración de matriz siguenabiertos.

## Reconciliación por identificador Sol — 14/10/2026

El handoff index confirma 65 hallazgos únicos asignados a siete etapas. Los 95
casos son el tamaño del corte diagnóstico, no el saldo abierto actual.

| Etapa | Hallazgos asignados | Estado acreditado | Pendiente real |
|---|---|---|---|
| 1 | S02, S06, S14, S17, S18, S21, S23, S27, S28, S34, S43, S47, S50, S53 (14) | Aceptada por Sol | Ninguno de esta etapa en el corte vigente |
| 2 | S03, S07, S08, S09, S10, S11, S16, S29, S49, S51, S55, S64, S65 (13) | Aceptada por Sol | Ninguno de esta etapa en el corte vigente |
| 3 | S04, S12, S19, S22, S26, S35, S61 (7) | Aceptada por Sol | Ninguno de esta etapa en el corte vigente |
| 4 | S05, S15, S20, S24, S25, S33, S40, S41, S42, S48, S52 (11) | Aceptada funcionalmente; S52 y captura estable del runner aceptados | Ninguna corrección concreta del corte local |
| 5 | S36, S37, S38, S39, S54, S56, S62, S63 (8) | Revisión técnica local aceptada; S38 verificado también con detalle de tarea abierto | Aceptación humana con lector de pantalla; guía en runbooks/SCREEN-READER-ACCEPTANCE-LAB.md |
| 6 | S57, S58 (2) | Aceptada para el contrato local: 14 regresiones del verificador pasan; benchmark 383,72 ms y S58 7/7 acreditados con hash común | Medición local no certifica rendimiento concurrente/producción |
| 7 | S01, S13, S30, S31, S32, S44, S45, S46, S59, S60 (10) | Revisión técnica local aceptada, incluyendo carreras de S44 y conservación de revisión/propuesta; MVCC local 26/26 | Supabase alojado pertenece a integración futura; no hay defecto de código confirmado en este corte |

Fuentes de estado: `review-evidence/stage-1-final-acceptance-20261013.json`,
`stage-2-final-acceptance-20261014.json`, `stage-3-final-acceptance-20261014.json`,
`stage-4-partial-laboratory-20261014.json`, `stage-5-partial-laboratory-20261014.json`,
`stage-6-verifier-implementation-lab-20261014.json` y
`stage-7-implementation-local-20261014.json`. Esta conciliación no marca la
aceptación global ni incorpora trabajo ajeno al plan aprobado.

### Revalidación integrada posterior a foco — 14/10/2026

Tras corregir dos bordes de foco de etapa 5, la suite completa pasó **658/658
en 67 archivos**; TypeScript, cliente y Worker compilaron; Edge ejecutó 29
comprobaciones sin errores JavaScript ni llamadas a `/api`. `git diff --check`
pasó. El benchmark actualizado validó 24 perfiles/2.000 tareas y 30 transiciones
calientes, con p95 **502,95 ms**; es una medición local, no concurrente ni de
producción. El runner S58 se repitió sobre el árbol actual y pasó sus 7
expectativas exactas (7 ejecutadas/aprobadas, 209 omitidas por filtros, 0
fallidas), en salida nueva y sin sobrescribir artefactos anteriores.
Evidencias: `stage-5-partial-laboratory-20261014.json`,
`stage-6-verifier-implementation-lab-20261014.json` y salidas actuales en
`outputs/stage-5-validation-20261014/edge-covered-keyboard-post-audit/` y
`outputs/performance-lab-2026-10-14-post-tour-2026-10-14/` y
`outputs/time-coverage-008-isolation-2026-10-14T14-32-44-729Z-17492/`.

### Continuación S39 — objetivos internos del recorrido — 14/10/2026

Se implementaron objetivos internos para los módulos del recorrido, alternativas
por modalidad para calendario y cierre, y objetivos de columna para tarjetas
vacías o controles ocultos. Abrir paneles/tarjetas es temporal y se restaura al
avanzar o pausar, salvo intervención manual. El recorrido respeta movimiento
reducido, mantiene los permisos y no crea datos de ejemplo.

Suite actual: **659/659 en 67 archivos**; TypeScript y builds de cliente/Worker
aprobados. `git diff --check` no detectó errores; sólo informó conversión LF/CRLF.
No se hizo comprobación visual en navegador porque el entorno no cuenta con
`npm`/`npx`; por tanto el recorrido de navegador de esta corrección queda abierto.
También quedan la revisión independiente Sol de S39 y la aceptación humana con
lector de pantalla de la etapa 5. Evidencia: `review-evidence/s39-tour-module-targets-lab-20261014.json`.
La relectura focal posterior pasó 57/57 en tres archivos; no reemplaza la
inspección visual ni esas aceptaciones. Evidencia:
`review-evidence/s39-local-recheck-20261014.json`.

### Revalidación visual S39 posterior — 14/10/2026

La nota histórica anterior sobre falta de navegador quedó superada al disponer
de Node, Playwright Core y Edge ya presentes en el entorno (sin instalación
global ni permisos administrativos). La corrida final pasó 31/31 en Edge,
incluyó los tres perfiles y móvil, y no registró errores JS ni llamadas a la
API operativa. La evidencia vigente es `review-evidence/s39-tour-refresh-20261014.json`
y `../../outputs/s39-tour-refresh-20261014/browser-validation.json`. Siguen
pendientes la revisión independiente Sol y la aceptación humana con lector de
pantalla.

La revisión de fuente S39 anterior usaba hashes previos a la actualización de
objetivos internos. Se volvió a cotejar el árbol actual y se registraron hashes
de `App.tsx`, estilos, pruebas del recorrido y runner de Edge en
`review-evidence/s39-tour-current-source-recheck-20261014.json`. No apareció
una discrepancia del contrato; la revisión independiente de Sol y la aceptación
humana siguen separadas y abiertas.

### Relectura local S52 — 14/10/2026

La inspección actual de `App.tsx` confirma que la elegibilidad del grupo depende
del trabajo filtrado visible, mientras las métricas de cumplimiento usan sólo
entregables; “Sin base” queda separado de cero y la calidad sin evaluaciones se
rotula “Sin evaluar”. La regresión focal pasó 20/20 en el árbol actual. No se
repite aquí la validación visual Edge ya registrada ni se reemplaza la revisión
independiente Sol, que sigue pendiente. Evidencia:
`review-evidence/s52-local-recheck-20261014.json`.

### Relectura local S58 — error de procedencia — 14/10/2026

Se corrigió el runner para que una falla al leer el hash Git produzca un
reporte fallido en una carpeta nueva, en lugar de terminar antes de registrar
el resultado. También se añadió el gate S57: el benchmark falla si no acredita
el hash del árbol, incluso con muestras válidas. La regresión focal pasó 11/11.
Revisión Sol de S57/S58 sigue pendiente. El runner normal completo aprobó 7/7
casos (209 omitidos por filtros, 0 fallidos), con hash del árbol efectivo y
salida nueva; la suite actual pasó 661/661 en 67 archivos y TypeScript.
Evidencia:
`review-evidence/s58-hash-failure-report-lab-20261014.json`.

La relectura adicional encontró un borde en S57: ante una ruta
`PERFORMANCE_OUTPUT` ya existente, el bloque `finally` podía escribir el
reporte fallido en el directorio histórico o dejar apuntando a un reporte
anterior. Se agregó reserva de una carpeta hermana única y escritura exclusiva;
una regresión confirma que el contenido previo permanece intacto. En este corte
la focal pasó 12/12, la suite 663/663, TypeScript y builds cliente/Worker
pasaron; el runner S58 pasó 7/7 y el benchmark Edge actual midió 408,51 ms p95
en 30 recorridos con 24 perfiles/2.000 tareas, cero errores y cero llamadas
operativas. La revisión independiente Sol no se declara aquí. Evidencia:
`review-evidence/s57-s58-recheck-lab-20261014.json`.

### Revisión de fuente S59/S60 — migración 012 — 14/10/2026

Se contrastó la migración local 012 y las regresiones de `database.test.ts`
contra los contratos Sol. La lectura no encontró discrepancias en las rutas
revisadas: aprobación y pedido de cambios de inducción validan revisión
obligatoria, vuelven a leer solicitud/autoridad tras locks y dejan sin cambios
los intentos inválidos; los recibos de actividad distinguen replay por actor y
operationId de movimientos nuevos con contenido igual. Las pruebas existentes
comprueban también IDs, filas, cantidad, auditoría y revisión de tarea.

Esto es una revisión de fuente, no una nueva ejecución SQL ni una revisión
independiente de Sol. No acredita concurrencia PostgreSQL/MVCC, Auth/RLS real o
estado remoto; no se aplicó SQL. Evidencia y hashes de los dos archivos:
`review-evidence/s59-s60-source-review-luna-20261014.json`.

### Revisión de fuente S39 — recorrido guiado — 14/10/2026

La lectura de `App.tsx`, estilos y regresiones no encontró una discrepancia de
fuente con los requisitos revisados: pasos acotados por rol, destinos/fallbacks
por módulo, restauración de paneles, overlay, cálculo del coach, teclado, foco y
movimiento reducido están presentes. La ejecución focal DOM previamente
registrada fue 57/57; no se presenta como geometría o aceptación visual. Sigue
pendiente la inspección real de navegador, la revisión independiente de Sol y
la aceptación humana con lector de pantalla. Evidencia con hashes:
`review-evidence/s39-tour-source-review-luna-20261014.json`.

### Revisión de fuente S04 — evolución histórica y filtro de participante — 14/10/2026

La lectura de `closedHistory.ts`, `model.ts` y sus regresiones confirma que la
evolución toma la carga desde snapshots congelados, mantiene `null` separado de
cero, evita reconstruir series filtradas desde movimientos vivos, aplica la
participación a entregables y filtra el tiempo por ejecutor, incluidas sesiones
de cobertura congeladas sin duplicarlas. No encontré una discrepancia de fuente
con este contrato. Los tests citados existen en el árbol actual, pero no se
volvieron a ejecutar en esta relectura. Evidencia con hashes:
`review-evidence/s04-history-source-review-luna-20261014.json`.

### Revisión de paquete Sol y corrección de bundle — 14/10/2026

Se revisaron los dos documentos históricos del plan del 07/10 y los tres
documentos de auditoría/contrato Sol. Los 11 casos R están preservados como
corte histórico; la lista vigente se reconcilia por S01–S65. La revisión de
cobertura comprobó 65 títulos únicos y los 65 IDs en la matriz vigente.
También se corrigió el requisito explícito de separación de bundle del
contrato `PLAN-CORRECTIONS-NEXT`: entrada 328,29 kB, chunk `framework` 208,98
kB, límite 500 kB sin modificar y sin aviso de chunk grande ni de importación
mixta de evidencia. Suite 661/661, TypeScript, cliente, Worker y diff-check
pasaron. Ver `review-evidence/sol-corrections-review-recheck-20261014.json`.
La nota de espera de navegador de este corte quedó superada: Edge ejecutó el
recorrido actualizado 29/29, según `s39-edge-browser-recheck-20261014.json`.
Permanecen las puertas humanas e independientes listadas en la reconciliación;
no son código sin implementar.

### Revisión de snapshots de respaldo — 14/10/2026

La revisión de `repository.ts` encontró que las formas passthrough para tareas
y movimientos congelados no limitaban todos los campos nuevos: un snapshot
podía aceptar avance comercial fuera de 0–30 o una fecha de movimiento
imposible. Se añadió validación compatible con campos opcionales antiguos,
validación de fechas, período y autor del seguimiento congelado, referencias de
coeficientes, referencias y ciclos de dependencias y rango/tipo de coeficientes
operativos. Las regresiones rechazan casos inválidos y conservan un snapshot
histórico sin campos nuevos. Prueba focal 17/17 y TypeScript pasan. Esto no
cierra el gate completo de respaldo/IndexedDB ni revisión de navegador.
Evidencia y hashes:
`review-evidence/backup-snapshot-validation-lab-20261014.json`.

### Corrección del criterio S57 y revalidación S58 — 14/10/2026

La revisión actual encontró que S57 permitía cambiar por opciones los límites
que deben ser fijos. Se eliminaron esas opciones, se sincronizó la declaración
TypeScript y se añadieron regresiones que intentan relajar umbral, muestras y
dimensiones de fixture. Resultado: 14/14 pruebas focales, suite 665/665,
TypeScript, build cliente/Worker; Edge midió 30 muestras con 24 perfiles/2.000
tareas y p95 384,85 ms. El runner S58 pasó 7/7 con 209 omitidas por filtros
explícitos. Ambas corridas registraron el mismo árbol efectivo SHA-256
`f3d0d7d4c3906f8cfbe48c0eb122dafb45c8dd29c4e53ec8c54c845286dfdf96`.
Evidencia: `review-evidence/s57-s58-current-contract-recheck-20261014.json`.
La revisión independiente Sol permanece pendiente.
