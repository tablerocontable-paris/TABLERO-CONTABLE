> Registro histórico del corte Sol del 11/10/2026: 65 hallazgos y 95 casos
> reproducidos en ese momento. Las etapas 1–3 se aceptaron después; el avance
> vigente y los hallazgos restantes se registran en la sección de estado al
> final de este documento y en `docs/EXECUTION-NEXT.md`.

## Cierre de etapa 3 — 14/10/2026

Sol acepta funcionalmente S04/S12/S19/S22/S26/S35/S61. Se añadieron
restricciones de historia por empresa visible, unión de cierres congelados al
consolidar, distinción de nulo frente a cero, marcador `coverageSnapshotVersion`
para nuevos reportes, marcador conservador cuando se mezclan unidades antiguas
y nuevas en cualquiera de los órdenes, y deduplicación de sesiones cubiertas por
tarea/sesión/actor. S35 vuelve a invalidar una confirmación si cambia la
preparación; S61 revierte grupo candidato completo y permite reintento.

Revisión funcional independiente sin bloqueadores. Suite 595/595 en 65 archivos;
TypeScript, build cliente/Worker, `git diff --check`, recorridos Edge principal,
correcciones y tareas conjuntas; benchmark aislado p95 405,45 ms con 24 perfiles
y 2.000 tareas. Los intentos concurrentes que fallaron se conservaron y no se
usaron como aceptación. Detalle y artefactos en
`docs/architecture/review-evidence/stage-3-final-acceptance-20261014.json`.
Etapas 4–7 siguen abiertas; no es aceptación global ni habilita infraestructura.

# Contratos consolidados para Luna — auditoría Sol

> **Estado vigente de aceptación técnica — 14/10/2026:** S38/S44 y el runner
> S52 aceptados tras revisión independiente, seis variantes nuevas y 63 pruebas
> existentes (69/69). Las siete etapas están revisadas en su alcance local;
> sólo la aceptación humana con lector de pantalla mantiene abierta etapa 5.
> Seguir `../runbooks/SCREEN-READER-ACCEPTANCE-LAB.md`; evidencia actual:
> `review-evidence/s38-s44-independent-acceptance-20261014.json`.
> Los avisos inferiores de correcciones/revisiones abiertas son históricos.

> **Registro histórico de revisión inicial 14/10/2026:** corregir S38 y
> S44 según `SOL-INDEPENDENT-REVIEW-20261014.md`, con las reproducciones y
> criterios precisos allí definidos; corregir además la espera de geometría
> final del runner de captura. S52 y S57/S58 se aceptaron en su alcance local.
> Las etapas 5 y 7 siguen sin aceptar, y lector de pantalla humano pendiente.
> Las notas inferiores que dicen que sólo resta revisión describen cortes
> previos a estas dos reproducciones. No se añaden funcionalidades ni IDs.

> **Estado posterior — 14/10/2026:** este contrato conserva instrucciones y
> reportes de etapas anteriores. La corrida vigente pasó 665/665, TypeScript,
> builds cliente/Worker y S39 Edge 31/31; auditoría AX: 38 rutas/2.124
> controles/877 focos; contraste: 5.943 textos/76 combinaciones; PostgreSQL/MVCC
> local pasó 26/26 con claims sintéticos. Por eso las notas que aún dicen “navegador pendiente” o
> “MVCC real pendiente” sólo describen cortes anteriores. Continúan abiertos
> la revisión independiente de Sol para S52 y etapas 5–7, la aceptación humana
> con lector de pantalla y la futura comprobación con Supabase Auth/RLS alojado.
> No se conectaron cuentas, aplicó SQL remoto, hizo commit ni publicación.
> Estado detallado: `SOL-REQUIREMENT-COVERAGE-20261008.md`.

Estado: contrato Sol revisado para implementar por etapas. No sustituye SOL-AUDIT-20261008.md ni acredita aceptación global. El corte base del 11/10 registró 65 hallazgos y 95 casos; etapas 1–3 se aceptaron después y las etapas 4–7 tienen cortes de implementación posteriores en este documento. El conteo residual agregado no se ha reconciliado, por lo que 65/95 no debe presentarse como cantidad aún abierta. Mantener el laboratorio privado, actor real, historial y backend desconectado. No modificar migraciones históricas. La consolidación de requisitos quedó terminada; la aceptación por etapas sigue los estados actuales al final del documento.

## Resumen de ejecución del corte65/95

Leer primero este contrato, luego cada Sxx del informe detallado y la fila afectada de SOL-REQUIREMENT-COVERAGE. El árbol vigente tiene cambios previos sin commit y archivos nuevos: conservarlos; HEAD no identifica por sí solo lo auditado. Registrar manifest del árbol antes de editar y después de validar. No resetear ni reconstruir el proyecto.

Validación base del11/10:500pruebas/58archivos yTypeScript/cliente/Worker aprobados. Probes adicionales reproducen65hallazgos/95casos;no están todos dentro de la suite base. Importar cada reproducción como regresión corregida en etapa correspondiente, con archivo de evidencia ylímites explícitos. Los archivosdeoutputs son evidencia, no tests ejecutables por colección automática.

Prioridad: primero permisos/privacidad,integridad/persistencia,evidencia/cierres;después operativas/calendario/análisis einterfaz. Remoto se corrige localmente separado,mediante nueva migración sin activar servicios. Próximo modelo después de cierre de auditoría:selecciónmanual Luna medioStandard;Sol alto revisa altoimpacto. No simular cambio ni delegar contra AGENTS.

Aceptación integrada queda abierta hasta correcciones:matriz por requisito,escenario negativo/positivo,fuente actual,runtimevisual/accesible cuando corresponde yresultado. El paquetePC actualizado ycommit/publicación siguen pendientes del corte validado. Infraestructura propiaGitHub/Supabasedev+prod/hosting/automatización real viene después de aceptaciónfuncional;no pedir cuentas durante laboratorio.

## Bloque de cierre, accesibilidad y recorrido (S35–S39)

1. S35: confirmar una huella que incluya actor, período y unidades/grupos exactos mostrados. Revalidarla síncronamente al enviar y volver a ejecutar elegibilidad del dominio. Un cambio de mes, actor, selección o readiness exige revisar nuevamente. Los pendientes no se completan automáticamente y los reintentos no duplican snapshots.
2. S36: contraer lista del selector dentro del espacio disponible y desplazar sólo su contenedor para mantener visible la opción activa. Conservar combobox, foco, Escape y permisos. Verificar End/Home/flechas en ambos selectores, 24 perfiles, escritorio, móvil y viewport bajo.
3. S37–S39: pasos con IDs estables y progreso versionado; menú permitido y guía interna por módulo. Cierre/Catálogo exclusivos de jefe. Restaurar foco al cerrar y recuperar foco cuando un control queda deshabilitado. Respetar estado plegado, módulos lazy y contenido vacío sin generar datos de demostración. La prueba sintética no acredita Tab nativo; repetir los intentos Edge inconclusos con trazas por fase.

## Semántica operativa y avisos (S40–S42, S48)

1. S40: requisitos nuevos de obligaciones sólo entregables verificables de la misma empresa. Validar dominio y selector. Versionar evaluación de obligaciones y conservar interpretación histórica; no inventar metas, umbrales ni completar una operativa continua.
2. S41: fecha inicial de vigencia según Argentina, sin sobrescribir elecciones de un formulario abierto. Conservar fechas y snapshots guardados. Probar cruce UTC/ART y año.
3. S42: comparar disponibilidad, conjunto normalizado de dependencias y seguimiento comercial. Un aviso changed por destinatario autorizado y mutación; ninguno por reordenamiento equivalente o guardado fallido. No exponer títulos fuera de ámbito ni emitir avisos por ticks.
4. S48 junto a S15/S19/S33: puntos previstos/completados sólo de entregables. Cantidades operativas separadas por unidad, carga desde coeficientes congelados y tiempo real. Corregir inducción y parametrización coherentemente; targets/pesos históricos no se borran ni se reinterpretan.

## Privacidad y asignación (S43, S47, S50)

1. Definir contratos separados de consulta, gestión y ejecución. Encargado requiere empresa vigente y jerarquía autorizada; jefe tiene consulta/gestión organizacional; ejecutar exige responsable, participante o cobertura vigente.
2. S43: proyectar asignaciones antes de búsqueda, conteo y tabla; revocación no borra historia. Revalidar con panel abierto.
3. S47: jefatura sin membresía directa puede gestionar entregable conjunto elegible. Conservar empresa de participantes, cuotas positivas total 100%, cierres, ausencia de actividad y replay. No habilitar ejecución de terceros ni nuevas operativas conjuntas.
4. S50: gestión autorizada antes de materializar tarea, incluidas conversiones de notas/pedidos. Opciones son intersección de ámbito del actor y empresas del responsable; revalidar submit. Rechazo conserva borrador/origen y no escribe convertedTaskId.

## Transporte remoto separado (S44–S46)

1. S44: invalidar lecturas por generación/contexto y no aceptar GET tardío durante propuesta o POST. Respuesta descartada no actualiza revisión ni estado. Definir desmontaje sin perder intención ni dejar promesas sin resolver; no fusionar automáticamente estados.
2. S45: validar DTO Worker en read/save, distinguir protocolo inválido de HTTP y conservar propuesta ante POST 200 inválido. Usar esquema proyectado Worker, no backup laboratorio ni SQL histórico. No rellenar errores con seed.
3. S46: presencia fallida no convierte persistencia confirmada en error de guardado. Responder estado/revisión válidos con presence vacío sólo cuando trabajo quedó confirmado. Fallo de almacenamiento o autorización conserva error real; revisión obsoleta sigue 409. Probar INSERT/SELECT de presencia y fallo de trabajo separadamente, sin API real.

## Envío operativo y evidencia (S49 junto a S07/S09/S16/S55)

1. Exclusión síncrona por formulario/intento antes del primer await, con estado busy accesible. Segunda llamada no genera ID ni archivos.
2. Revalidar actor, tarea, permisos y cierre tras upload. Manejar compensación y sus fallos explícitamente; liberar guard en finally, conservar borrador ante rechazo y no mostrar éxito.
3. No deduplicar contenido: dos acciones sucesivas deliberadas con misma cantidad/fecha/referencia son válidas. Coordinar con S60 remoto: replay se identifica por operationId, no igualdad de lote.
4. Convertir cada reproducción en regresión de comportamiento correcto, incluyendo integración DOM y almacenamiento real cuando corresponda. Una prueba de caracterización que espera el defecto no demuestra corrección.

## Evidencia actual y límites

Actualización 14/10/2026: etapa 2 completa aceptada por revisión funcional
independiente de Sol. Suite 588/588 en 65 archivos; TypeScript, cliente,
Worker, `git diff --check`, recorridos Edge y benchmark (p95 591,87 ms con
24 perfiles/2.000 tareas) aprobados. Sin cuota física de disco inducida; sí
abort nativo IndexedDB en navegador. Lector de pantalla queda en gate posterior.
La aceptación corresponde sólo a etapa 2, no al producto completo. Etapas 3–7
permanecen abiertas. Evidencia: `docs/architecture/review-evidence/
stage-2-final-acceptance-20261014.json`.

Actualización 13/10/2026: etapa 1 aceptada por Sol. El bloque 2A de etapa 2
también quedó aceptado por Sol para estado durable, coordinación adjuntos/
restauración y manejo de resultados inciertos (S09/S16/S65). La inyección de
fallo de UUID se aisló de notificaciones y el test focal ahora falla
específicamente al generar `labRevision`. La prueba focal de esos módulos pasó
25/25; Edge confirmó rechazo de transacción IndexedDB nativa sin cambio de
metadata/blobs y formulario reintentable. No se indujo cuota física de disco.
La etapa 2 completa sigue abierta; ver
`docs/architecture/review-evidence/stage-2-evidence-durable-20261013.json` y
la lista de pendientes actualizada en
`docs/architecture/review-evidence/stage-2-partial-laboratory-20261012.json`.

12/10/2026: etapa 2 en curso; suite 527/527 en 58 archivos, TypeScript, Vite cliente, Worker y recorridos Edge general, correcciones y backup/restauración pasaron. Evidencia parcial: `docs/architecture/review-evidence/stage-2-partial-laboratory-20261012.json`. Los contratos S03, S09, S10, S11, S16, S49 y S65 no están completamente aceptados; la suite no prueba concurrencia entre pestañas ni todas las ramas de almacenamiento. No cerrar hallazgos antes de revisión independiente Sol. Las etapas 3–7 siguen pendientes.

## Consultas, análisis, jornada y cobertura (S51–S55)

1. S51 junto a S29: rechazar respuesta sobre pedido resuelto antes de crear mensaje/IDs/historial. No introducir reapertura. Si se resolvió mientras estaba abierto el formulario, conservar texto y comunicar motivo. Probar new/review/responded, resolved, convertido, actor ajeno e inactivo; conservar convertedTaskId e historial.
2. S52 junto a S48: elegibilidad del grupo por trabajo visible, independiente de base de entregables. Un grupo sólo operativo conserva cantidad/tiempo/calidad donde corresponde; cumplimiento null se muestra Sin base, no 0%. CSV distingue Sin base, cero y Sin evaluar. No incorporar grupos vacíos ni fuera de ámbito. Probar filtros, exportación y gráfica real además de cálculo aislado.
3. S53: proyectar consulta autorizada antes de conteo, próxima fecha y reloj de Mi jornada. Revocación con App abierto elimina título/fecha/conteo; conservar tareas de otras empresas autorizadas y no duplicar conjuntas. Revalidar al navegar. La pausa de un reloj propio tras revocación usa el contrato de pausa, no una ampliación de consulta.
4. S54: tablero de cobertura recibe el callback común de movimiento y conserva guardas del actor real. No atribuir cambios al titular ni duplicar tarea/puntos. Ratón y Alt+flechas sólo para reemplazo vigente; espera, cierre, checklist y día comercial siguen bloqueando. Animación de éxito únicamente tras cambio aceptado. Probar gesto real y movimiento reducido, no sólo draggable DOM.
5. S55 junto a S07/S16: mostrar error de evidencia fuera de los controles condicionados por canAdd/cupo. Si el detalle se desmonta, aviso seguro sin datos fuera de ámbito. Rechazo no restaura permisos ni reasigna archivos. Verificar canAdd=false, cupo lleno, cierre, compensación fallida y desmontaje, sin borrar evidencia referenciada.

## Navegación fiscal y ruta sugerida — criterios coordinados

- S24: al abrir una obligación desde otro mes del calendario, elegir explícitamente el período del módulo fiscal y desplegar su panel antes de enfocar el ID. Evitar cambiar silenciosamente todos los filtros globales. No duplicar obligaciones ni crear editor paralelo; comunicar cancelación/revocación.
- Orden sugerido: habilitación, vencimiento, prioridad, peso, fecha programada e ID estable. Conservar pruebas de precedencia con criterios posteriores opuestos, ambas permutaciones y filtros. No confundir prueba positiva del comparador con privacidad del motivo S17.
- Evidencia histórica: carga congelada null no equivale a cero ni autoriza recálculo (S04). Tiempo cubierto sin movimientos requiere representación explícita en cierre (S12). La historia de meses íntegramente cerrados no se amplía silenciosamente a meses parciales.

## Accesibilidad, verificadores y SQL futuro (S56–S60)

1. S56: prefijo React.useId estable por TaskBoard para regiones y botones ARIA; comprobar unicidad y referencias recíprocas con tableros propio y cubierto simultáneos, incluso vacíos. No cambiar IDs de tareas ni foco. Verificar plegado independiente y lector de pantalla además de nombres accesibles.
2. S57: un único umbral p95 <1000 ms, valores finitos y muestras válidas. Resultado y exit code deben fallar ante incumplimiento, preservando informe. Medir contenido específico listo por ruta, sin fallback y frames tras montaje; no usar heading común/descanso fijo como fin de navegación. Fixture válido de 24 perfiles/2000 tareas, diez recorridos, warmups y metadatos de equipo/navegador. Regresiones 999/1000/1500, vacío, no finito, JS y API. No reinterpretar un probe de 1500 ms como medición real de rendimiento.
3. S58: reportero JSON y salida parametrizada; ningún artefacto histórico se sobrescribe. Exigir cantidad positiva de pruebas aprobadas y archivo/nombres esperados por patrón; status null, todas skipped, patrón inexistente o fallo rechazan. Registrar omitidas/fallidas/ejecutadas y hash del árbol efectivo. Diferenciar diagnóstico que reproduce defecto de prueba de aceptación; exit0 aislado no prueba contrato.
4. S59: migración nueva tras 011 valida revisión no nula/válida y compara null-safe; revalida solicitud y autoridad tras locks. Conservar wrappers históricos y revisar request_onboarding_changes. NULL/negativa/obsoleta no crean asignación/auditoría/cambios; exacta aprueba una vez y replay conserva resultado autorizado. Sin SQL remoto ni activación del backend.
5. S60 coordinado con S49: recibo actor/operationId identifica replay; eliminar fusión por igualdad de contenido en migración nueva. Misma clave y cuerpo igual retorna mismo ID; cuerpo distinto rechaza; claves distintas iguales crean dos filas, cantidad6 y dos eventos para dos registros de3. Conservar locks, coberturas, cierres y autor real; no dividir ni recalcular históricos. PGlite secuencial no acredita carreras MVCC: concurrencia PostgreSQL real permanece gate posterior explícito.

## Principios de orden de ejecución y límites

Antes de UI: permisos/revocación, respaldo y persistencia, cierres e historia, exclusión de envío/evidencia. Después semántica operativa y sus consumidores, calendario/navegación, selector/recorrido/accesibilidad, gráficos y verificadores. El bloque remoto se prepara localmente separado y no habilita cuentas/API. La secuencia detallada de siete etapas y la tabla de aceptación por grupos aparecen más abajo. Este documento es el contrato de ejecución del corte auditado.

## Fundamentos de integridad y recuperación (S01–S11)

- S01 remoto: proyección por lista explícita del contrato vigente, nunca spread de State. Colecciones futuras excluidas hasta contrato servidor específico. Revisar propuesta/schema y conservar filas ocultas. Probar cada colección posterior, tres roles y DTO válido sin activar RemoteWorkspace.
- S02: updateCommercialProgress usa autorización común de ejecución con fecha única de operación; exige actor vigente/empresa y unidades abiertas de titular y ejecutor. Mantener entregable individual, seguimiento activo, entero0–30 y confirmación; rechazos no mutan. Probar revocación, baja, cobertura expirada y cierre del reemplazo.
- S03: validador semántico compartido de carga/restauración, tipos runtime de perfiles, IDs únicos, referencias, fechas reales, tarifas de misma empresa, frecuencias admitidas y grafo sin ciclos incluso inactivos. Supervisors además tiene visited/cota defensiva. Defaults sólo de campos opcionales documentados; no convertir tipos inválidos ni reconstruir jerarquías. Distinguir colecciones vivas de snapshots históricos; autores históricos no requieren actividad vigente. Rechazar antes de blobs/estado con campo/ID y conservar copia previa. Consultar tabla detallada de referencias de S03 y sus ampliaciones en informe.
- S04: fuente histórica congelada distingue número incluido0, null explícito y resumen ausente. Null nunca habilita suma parcial ni coeficientes actuales. Filtro parcial requiere datos de todas las operativas del alcance, incluidas sin movimientos; falta de información => sin muestra comparable. Nuevos snapshots versionados si necesarios; originales intactos. Probar null/0/ausente, parametrización parcial y filtros.
- S05: validador común crear/editar/restaurar calendario: empresa existente/null, tipo, título1–120, detalle0–1000 y fechas reales ordenadas. Revalidar vínculo/ámbito, superiores obligatorios y revisión antes de avisos. Mutación válida debe poder respaldarse; rechazo no altera evento/notices.
- S06: gestión/comentario organizacional del jefe activo, equipo+empresa vigente del encargado y restricción del empleado/reemplazo. No convertir comentario en ejecución ni acceso a notas personales. Mantener autor, límite2000, cierres y avisos autorizados; probar jefe sin membresía y actores revocados/ajenos/inactivos.
- S07: efecto de previews comprueba vigencia tras await antes de crear URL; toda URL creada se revoca al cesar uso/cancelar. Cambio de records/desmontaje/StrictMode no deja URL viva ni preview antiguo. No eliminar bytes ni metadata para liberar URL.
- S08: prevalidar conjunto de instancias que recurrencia eliminaría y todas sus referencias/contextos: dependencias entrantes/salientes, disponibilidad, progreso comercial, comentarios, evidencia, eventos y avisos. Pendiente no significa virgen. Rechazar sustitución destructiva con motivo; permitir vigencia posterior/instancias verdaderamente vírgenes. No remapear dependencias ni copiar progreso/referencias entre períodos automáticamente. Resultado aceptado debe validar backup.
- S09: separar bytes conservados de vínculo activo/cupo, incluyendo evidencia de cierres y coberturas. Huérfanos conservan bytes pero salen del índice de cupo sólo tras confirmar nuevo estado. Restauración/carga coordinadas con reservas y recuperación de reconciliación incompleta; fallo conserva índice/estado anterior. ID con mismos bytes y distinto recordKey no se reasigna silenciosamente. Probar v1/v2, cupo3/4, cierres, fallos y concurrencia real de IndexedDB.
- S10: no escribir incondicionalmente durante render/arranque. Estado legible con escritura fallida sigue consultable/exportable, con recuperación explícita; jamás reset al seed/borrado automático. Normalización/invitación sólo confirmadas tras persistir; URL no se retira al fallo. Tema protege lectura/escritura, usa automático si no puede leer y mantiene modo de sesión/listener si no guarda. Probar quota/security/StrictMode y reintento, sin inventar backup íntegro si faltan blobs.
- S11: token monotónico de selección; sólo lectura vigente actualiza preview/bytes/error/confirmación. Invalidar cierre/desmontaje/cancelación, reiniciar confirmación al cambiar copia y restaurar pareja inmutable contenido/token. A lenta/B rápida o error obsoleto no sustituye B; validar antes de restaurar y conservar límites.

## Cobertura, ámbito y semántica operativa (S12–S19)

- S12: universo común de unidades para preview/bloqueador/consolidación incluye contribuciones reales de cobertura, aun sólo tiempo y sin tareas propias. Autorización sin ejecución no crea unidad. Nuevos snapshots de cobertura versionados conservan tarea/empresa/período/titular y sesiones/movimientos/finalización del ejecutor; no responsabilidad ni puntos duplicados. Cierre del reemplazo bloquea sus nuevas contribuciones, sin cerrar titular. Extender backup/evidencia/historia/reportes; histórico no reconstruible se señala, no se completa desde tarea viva. Probar sólo cobertura/tiempo, grupos, reintento, clocks y meses/empresas restantes.
- S13 remoto: autorizar cada delta por acción, no por texto action ni canWork jerárquico. Checklist/finalización/clock/movimiento exigen ejecutor autenticado activo, responsabilidad/participación/cobertura vigente y unidades abiertas. Parada propia, bloqueo autorizado y suspensión son rutas diferenciadas. Probar matriz completa por acción y filas ocultas; no activar backend ni portar todas las extensiones del laboratorio.
- S14: permiso de evento común para calendario/avisos; pérdida de destinatario/empresa/jerarquía no hidrata aviso histórico con título/fecha actuales. Retirada genérica sin enlace ni contenido reservado; autorizados conservan cambios/cancelaciones, lectura e historial. Versionar kind si corresponde y revalidar navegación. Probar retiro seguido de cambios, legacy, revocación y baja.
- S15 junto S33/S41: editor jefe de coeficiente para operativa puntual real con taskId explícito, separado de plantilla/empresa. Identificar nombre/empresa/período/unidad, revalidar elección y vigencia. No inferir por nombre ni convertir peso viejo; snapshot anterior intacto y carga pendiente hasta configurar. Guardado fallido conserva formulario.
- S16 junto S09/S49/S55: manejar almacenamiento, commit y compensación, distinguiendo rechazo de movimiento y fallo de limpieza. Avisar sin afirmar borrado no confirmado, conservar previo y reconciliar blobs retenidos sin borrar referenciados. Reintento sin duplicado/identidad ajena. Probar formulario real, cero rechazos sin manejar y fallos de persistencia/limpieza.
- S17: proyectar dependencias antes de generar motivos de hoja sugerida; referencia no autorizada no revela título ni se convierte en bloqueo inexistente. Mostrar motivo genérico seguro y conservar bloqueo efectivo. Probar revocación, perfiles consultados, búsqueda, filtros y navegación; no borrar dependencia para solucionar privacidad.
- S18: presencia visible sólo a jefe y encargado del equipo autorizado, no al empleado por mera relación con su superior. Señales laboratorio explícitamente simuladas, sin derivarlas de cronómetros/KPI; actor inactivo/ámbito revocado ocultos. Contrato real 30s/TTL90s requiere sesión autenticada y aceptación futura, no se presume implementado por simulación.
- S19 junto S04/S48/S52: CSV/presentación de nuevos cierres schema3 sin metas operativas ni anticipación basada en ellas. Preservar exportación/reportes históricos schema1/2 y distinguir definición. Probar tarea operativa con target legacy positivo en cierre nuevo, reportes originales intactos, cantidades/carga/tiempo/calidad y cuotas/cobertura coherentes.

## Fechas, procesos, fiscal, perfiles y borradores (S20–S29)

- S20: fechas reales validadas antes de normalizar en mejora de procesos; 30 de febrero rechaza sin mutación. Conservar intervalo válido y zona ART; seguimiento comercial0–30 no es fecha calendario.
- S21: autorización vigente por actor/empresa/acción en consulta, búsqueda, propuesta, revisión, medición y5S. Autoría histórica no concede ámbito actual; jefatura conserva gestión organizacional. Probar todas las ampliaciones de revisión/medición/cierre5S tras revocación sin borrar historia.
- S22: adopción de estándar respeta unidad persona+empresa+mes cerrada; no reemplaza controles de tarea congelada. Prevalidar conjunto antes de cambios y conservar versiones/históricos. Vigencia futura sólo sobre trabajo elegible; probar mezcla abiertas/cerradas y rechazo sin cambios parciales.
- S23: consulta/gestión fiscal organizacional de jefe activo sin membresía directa; encargado sigue equipo+empresa vigente. No ampliar ejecución ni revelar datos privados. Probar creación/revisión/consulta con actor y vínculo autorizado.
- S24: contrato de navegación fiscal detallado arriba: desplegar panel y resolver período/id explícitos, revalidar acceso, enfocar origen real; no duplicar ficha ni editar copia derivada.
- S25: campana renueva asOf al cruzar medianoche ART aun abierta y al recuperar visibilidad pertinente. Conservar lectura por destinatario; aviso no se duplica por reloj. Probar vencida/hoy/3d, cambio de mes/año, modal abierto y actor cambiado.
- S26: baja del reemplazo cierra su reloj vigente con corte/autoría auditables, sin alterar sesiones terminadas. No dejar ejecución huérfana ni asignar tiempo al titular. Coordinar suspensión, cobertura y cierre; probar relojes propios/conjuntos, replay y límite temporal.
- S27: validar empresas existentes/sin duplicados al editar perfiles antes de persistencia, junto al grafo/IDs de S03. Rechazar referencia desconocida sin cambios. No eliminar datos históricos de empresas al revocar ámbito.
- S28: encargado autorizado puede registrar ausencia sin reemplazo; cobertura opcional no se convierte en obligatoria. Mantener intervalo real, ámbito, permisos y solapamiento; ausencia sin cobertura no otorga ejecución a nadie ni muestra observaciones privadas.
- S29: callbacks crear/responder consulta y verificar5S propagan éxito real de commit; limpiar/cerrar únicamente al éxito. Conservar texto/fecha/foco y mensaje ante false/excepción; excluir doble envío si async. Probar ambos formularios y5S, validación/reintento/éxito, coordinado con pedido terminal S51.

## Compatibilidad remota y parametrización (S30–S34)

- S30: nueva RPC revisada de espera recibe motivo de interrupción, preserva firma histórica y guarda MFA/ámbito. No usar etiqueta del sector como motivo. Gateway allowlist/intención/receipt incluyen motivo; replay con distinto motivo rechaza. Probar espera propia/superior, dos ejecutores, cierre, MFA, rollback y última cadena local; no aplicar SQL remoto.
- S31: refinamientos de lector/DTO para estado/completedAt, bloqueo/fecha, fechas programadas/vencimiento y responsabilidad instance/company/period/member cuotas coherentes sin depender de orden. UUID case-insensitive, precisión timestamps preservada. No imponer startedAt histórico ni borrar excepción legítima schema2 dueñoancla/miembro. Respuesta inválida => protocol, no defaults/normalización. Probar find/list/lookahead y contratos válidos históricos.
- S32: payload clasifica reemplazo tanto por ausencia legacy como binding preciso. Participante conserva cuota propia; sólo reemplazo => coverage/cuota0; superior consultante no adquiere contribución. Mantener caducidad/empresa, snapshots/reportes originales. Nueva migración y pruebas payload/lector coherentes.
- S33: campana/parametrización confirma revisión de perfil sin meta operativa ni coeficiente inventado. Separar puntos de entregables de tarifa versionada; sin tarifa mostrar carga pendiente. Conservar targets históricos y formulario si falla commit. Probar operativas solas/mixtas, jefe activo y coherencia onboarding/planning.
- S34: reenviar propuesta revalida autor activo y empresa vigente antes de estado/revisión/historial. Autor conserva consulta histórica/borrador con explicación tras revocación; no trasladar empresa ni eliminar historial. Aprobación mantiene su propia guarda. Probar revocación/baja/restauración de ámbito en dominio y Mi día.

### Referencia explícita de foco S38

S38 se ejecuta con S37/S39: capturar apertura y restaurar foco al Pausar/Escape/Listo; si el origen desaparece, elegir control visible pertinente. Al volver al primer paso, recuperar foco de Anterior deshabilitado hacia control habilitado sin reenfocar indiscriminadamente en cada render. Trap de Tab maneja foco fuera de su conjunto vigente. Verificar Tab/Shift+Tab nativos, reapertura, cambio de actor, objetivo plegado y móvil, conservando registro de intentos Edge inconclusos.

## Aceptación de pedidos sin hallazgo individual

La matriz SOL-REQUIREMENT-COVERAGE-20261008.md es vinculante: corregir S01–S65 no reemplaza sus filas. Para cada fila registrar fuente actual, prueba de la regla, resultado, límites y captura/runtime cuando sea visual. Las siguientes verificaciones deben figurar en la ejecución aunque no haya defecto reproducido:

| Grupo del pedido | Verificación necesaria y evidencia |
|---|---|
| Identidad y estructura | Capturas escritorio/móvil de logo centrado/alineado, sin Espacio contable, banner operativo retirado; Resumen empleado, cierre/catálogo jefe, encargado sin acceso directo. |
| Encabezado y apariencia | Scroll real de App, búsqueda/notificaciones accesibles, avatar sólo abajo, iconos de tres modos, recuperación de storage, zoom y viewport bajo. |
| Catálogo, Consultas y Anotaciones | Buscar/filtrar filas compactas, expandir configuración/historial; formularios desde acción compacta y borradores ante fallo; biblioteca exclusivamente del actor. Comparar densidad con Resumen sin reducir indiscriminadamente tipografía. |
| Paneles y espacio lateral | Inventario de paneles de cada módulo, incluido Relaciones y Planificación; plegado conserva título/descripción/cantidad/borradores, filtros siguen accesibles. Mi jornada sólo cuando hay datos útiles y autorizados; no rellenar con funciones ajenas. |
| Operativas y calidad | Cantidades por unidad, carga versionada y tiempo; sin coeficiente no inventar peso; cero distinto de sin evaluar, observación obligatoria al evaluar. Referencia/adjuntos opcionales no restan puntos. No nuevas conjuntas operativas por ninguna entrada del laboratorio; historial legacy intacto. |
| Calendario y ausencias | Mes/agenda con tareas, obligaciones, auditorías, balances, fechas manuales, vacaciones/licencias y cobertura sin observación privada; derivados abren origen sin copia editable. Todos limitado al ámbito; superiores obligatorios visibles; autor/superiores gestionan y destinatario consulta. Ausencias mantiene módulo independiente. |
| Consulta y presencia | Organigrama/selector cambian perfil consultado, nunca actor; superior sólo consulta/gestiona ámbito, sin ejecución ni notas/fórmulas/recordatorios personales en búsqueda/calendario/reportes. Presencia sólo superiores autorizados, simulación identificada, TTL90s; no KPI. |
| Mi día y seguimiento | Todas las vías de iniciar/completar respetan readiness y ejecución; día30 propone confirmar sin reemplazar controles ni fechas reales. Meses28/29/30/31, cobertura0/30 y30/30. Dependencias inválidas/cíclicas rechazan; fecha estimada no libera bloqueo. Orden explicado, estable y elegible, usuario puede elegir otra tarea sin auto-inicio. |
| Cierres e historia | Todos/equipo/empresa/persona muestran expansión exacta por conjunta; listo/pendiente separados, confirmación actual y revalidación. Reloj/futuro/cierre parcial/replay y contribución cubierta, empresas restantes abiertas, original histórico intacto. |
| Archivos y respaldo | Hasta3, imágenes5MB/PDF10MB, nombres/tamaño/preview y legibilidad de optimización. Validar firma/huella, límites exactos y corrupción; IndexedDB real, fallos/quota, restauraciónv1/v2 con archivos, límite total JSON50MB y rollback sin referencias inexistentes. No presentar mocks como aceptación de disco lleno. |
| Análisis | Resumen→gráficos→tablas plegadas, ayudas por módulo; series seleccionables bajo ejeX, sólo unidades compatibles. Torta estado/tipo/empresa/equipo con grises distinguibles, valores/etiquetas. Barras compactas y cero/Sin base; tooltip logrado/pendiente/total/unidades en bordes, zoom/móvil y teclado. Snapshots comparables por definición, originales preservados. |
| Arrastre y recorrido | Preview nativo tamaño tarjeta, opacidad legible, destino y animación tras aceptación, teclado y movimiento reducido; propio y cobertura. Recorrido oscurece exterior, explica interior de cada módulo permitido, vacío/plegado/lazy y foco nativo. |
| Entrega y rendimiento | Suite completa/TypeScript/build cliente+Worker y navegador sin API; benchmark24/2000 diez recorridos p95<1s con fixture válido y equipo/navegador. Lector de pantalla separado de heurística. Hook staged exacto, comandos reproducibles y paquete PC tras commit validado; GitHub/PR/migración/deploy reales requieren etapa propia posterior. |

Cada prueba nueva debe acreditar el contrato final, no esperar el defecto del probe. Preservar evidencia histórica con ruta de ejecución nueva. Una fila con comprobación ausente continúa pendiente; no declarar 100% por 61 identificadores presentes ni por suite verde.

## Mejoras de instrumentación ya delimitadas por la auditoría

Estas mejoras acompañan las comprobaciones del pedido; no son nuevos módulos ni hallazgos de producto adicionales.

- Contraste: readiness específico por módulo y escenarios de controles/formularios, modales, expansión, hover y temas. Informe indica inputs/textarea/select y fondos/formatos omitidos; cero fallos de muestra parcial no se llama aceptación global.
- Foco: comparar indicador antes/después en control o contenedor focus-within pertinente. Una sombra decorativa permanente de ancestro no acredita foco visible. Regresión negativa tarjeta sombreada+botón sin anillo, positiva anillo real; teclado nativo en diálogos/selectores/paneles y lector de pantalla separado.
- Concurrencia SQL: timeouts controlados por consulta y reporte parcial al fallar; no reiniciar carrera con resultado desconocido. Barreras pg_locks/pg_blocking_pids en vez de sleeps. Cada escenario necesita assertions funcionales, no sólo ausencia de deadlock y conteos. Fingerprint incluye tablas realmente afectadas, señalando las omitidas.
- Procedencia: manifest/hash de árbol efectivo con imports transitivos o diff identificable, no sólo HEAD si está sucio. Runners con salidas históricas fijas reciben destino nuevo por ejecución. Claims/Auth sintéticos se rotulan aunque PostgreSQL sea real.
- Pruebas legacy: preservar expectativas históricas en entradas/versiones históricas, y añadir laboratorio explícito para las reglas actuales. No restaurar ejecución del encargado, metas operativas ni cierre de encargado para satisfacer un test viejo.
- Entrega: corregir afirmación de que todo outputs está ignorado; sólo existen patrones específicos. Definir qué evidencia se versiona/paqueta sin excluir indiscriminadamente pruebas necesarias ni subir adjuntos con git add general. npm/lock es flujo documentado; pnpm no está aceptado. Bundle de código y respaldo v2 con archivos son entregas distintas; revertir frontend no revierte migración/datos.

## Etapas concretas para implementar y revisar

Cada etapa entrega código, regresiones del defecto con expectativa corregida, informe de límites y referencias a filas de la matriz. La siguiente etapa conserva las regresiones anteriores. No commit/publicación con controles de aceptación abiertos; decisiones arquitectónicas nuevas vuelven a Sol.

| Etapa | Hallazgos principales | Criterio de salida |
|---|---|---|
| 1. Permisos y privacidad del laboratorio | S02/S06/S14/S17/S18/S21/S23/S27/S28/S34/S43/S47/S50/S53 | Matriz actor/acción/empresa/jerarquía con revocación en vista abierta; actor real constante, sin notas personales ni títulos fuera de ámbito; creación/comentario/gestión no amplían ejecución. |
| 2. Integridad, recuperación y evidencia | S03/S07/S08/S09/S10/S11/S16/S29/S49/S51/S55/S64/S65 | Backups válidos v1/v2 y rechazo semántico previo, arranque recuperable, selección vigente, borradores conservados, exclusión de envío, compensación explícita y cupo/URL verificados en navegador. |
| 3. Cierre y conservación de historia | S04/S12/S19/S22/S26/S35/S61 | Unidades propias y cubiertas, clocks y confirmación exacta, snapshots versionados, reintento sin duplicados, historia null/0 coherente y reportes antiguos intactos. Coordinar esquema con etapa2 antes de congelar nuevos cierres. |
| 4. Operativas, calendario y análisis | S05/S15/S20/S24/S25/S33/S40/S41/S42/S48/S52 | Sin metas actuales; coeficiente puntual/versionado, fechaART, calidad separada, avisos correctos, origen fiscal visible en período correcto y gráficos/CSV con Sin base/Sin evaluar. |
| 5. Interfaz y aceptación accesible | S36/S37/S38/S39/S54/S56/S62/S63 | Selector visible por teclado, pasos internos autorizados/foco, tableros propio/cubierto con IDs únicos y arrastre aceptado; desktop/móvil/temas/movimiento reducido y lector de pantalla documentados. |
| 6. Verificadores y cierre de evidencia | S57/S58 y mejoras de instrumentación | Rechazo de cero tests/umbral incumplido, hashes y outputs por corrida, fixture válido24/2000 y navegación caliente p95<1s; suite completa/build y matriz de pedidos actualizados. |
| 7. Contratos remotos locales separados | S01/S13/S30/S31/S32/S44/S45/S46/S59/S60 | Proyección/autorización/protocolo/carreras del cliente y SQL nuevo local con compatibilidad histórica; no API real. Concurrencia PostgreSQL local puede comprobarse con base descartable propia sin cuentas externas. Auth/RLS desplegados, dispatcher/D1 y entrega real requieren infraestructura futura autorizada y evidencia separada. |

Revisión Sol tras cada bloque de alto impacto (1–3 y7); implementación Luna sobre contrato definido. No simular cambio de modelo: selección manual según AGENTS. Las comprobaciones visuales sin hallazgo individual de la tabla anterior siguen obligatorias durante etapas4–6.

### Estado de ejecución — 12/10/2026

El corte inicial de etapa 1 quedó validado con 518/518 pruebas. Revalidación
vigente del 12/10: 544/544 en 59 archivos, TypeScript, builds cliente/Worker y
dos recorridos Edge. Se corrigió la inducción de jefatura para no generar
trabajo ejecutable propio y el creador ahora exige responsable asociado a un
equipo existente; la fixture general conserva tareas históricas al añadir su
recordatorio. S53 conserva regresión integrada para aislamiento de empresa
revocada. Los 14 hallazgos de etapa 1 siguen pendientes de revisión independiente
GPT-6.1 Sol; la etapa 2 tiene código parcial previo sin aceptación y no se debe
ampliar ese bloque hasta revisar la etapa 1. El producto no se acepta, no se hizo
commit/publicación ni se conectaron servicios. Evidencia reproducible y rutas de salida:
`docs/architecture/review-evidence/stage-1-permissions-implementation-lab-20261012.json`.

### Precisión adicional para las puertas de calidad

Los probes de recorrido que sólo agregan passes sin expect deben convertir condiciones acceptance/results en aserciones antes de funcionar como gate. Dos fuentes que difieren sólo en destino de salida no suman coberturas distintas. Una cabecera PNG de8bytes sólo valida una firma de fixture: no acredita archivo decodificable, legibilidad ni exportación/restauración real. Los gráficos sustituidos por null no acreditan gráficos ni tooltips. Mantener fixtures reales ficticios y trazas de runtime para esos requisitos.

El workflow validate.yml actual sólo valida: no abre PR, promueve, migra ni despliega. Preparación de scripts/hook no acredita la automatización final que pidió el usuario. El futuro flujo dev→producción requiere prueba completa con cuentas propias después de aceptación funcional, conservando manejo de migración separado del rollback del frontend.

## Comprobaciones abiertas que no son hallazgos confirmados

No implementar un cambio de negocio por estos candidatos sin reproducir el caso y volver a Sol si exige decisión arquitectónica. Mantenerlos visibles hasta resolverlos:

- Guardia SQL de sesiones heredada: candidato descartado como bypass local tras contraste de writers/ACL; resolución más abajo. Conservar verificación de ACL de infraestructura futura.
- Cierre SQL011: contexto timer_expired, selección de cobertura sólo temporal, contenido de reaperturas en reporte, y cierre de dos participantes en órdenes distintos. Comprobar resultados/capturas específicas sin inferir defecto por omisión textual.
- Cierres laboratorio: candidato confirmado como S61 mediante fixture válido y fallo controlado; ejecutar su contrato de corrección, no repetirlo como sospecha sin resolver.
- Evidencia: excepción legítima de commit posterior al almacenamiento, y coordinación entre carga/restauración. Distinguir reject confirmado, escritura confirmada y compensación fallida; mocks no acreditan todas las intercalaciones de IndexedDB.
- Búsqueda global: comprobación nativa confirmó S62/S63; ejecutar contratos de semántica de acciones y retorno de foco. Lector de pantalla sigue gate propio.

Los candidatos se resuelven con reproducción válida o descarte fundamentado. No asignarles severidad ni contarlos entre61/91 mientras falte evidencia. Las comprobaciones de aceptación de la tabla anterior siguen obligatorias incluso si un candidato se descarta.

### Resolución del candidato de procedencia de sesión

El contraste local11/10 de la cadena001–011 niega DML y UPDATE por columna a anon/authenticated/service_role sobre sesiones; los nueve UPDATE efectivos de011 sólo cambian ended_at. No se identificó bypass autorizado de la identidad de cobertura al cerrar. Se descarta como defecto confirmado local, conservando comprobación de ACL del despliegue futuro y defensa administrativa sin cambios de negocio por conjetura. Evidencia session-service-acl-20261011.json y session-provenance-write-review-20261011.json.

## S61 — atomicidad ante fallo de consolidación

Añadir a etapa3: construir estado candidato del grupo, incluidas consolidaciones de cada propietario; publicar next/closed sólo tras éxito completo. Catch descarta candidato y marca sólo blocked, conservando grupos independientes ya preparados. Reproducción y límites en SOL-AUDIT S61; fixture válido y fallo controlado, no prueba de frecuencia espontánea. Probar ambos propietarios/grupos/reintento y preservar original/historia. Conteo vigente:61 hallazgos/91 casos abiertos; cortes60/90 anteriores son históricos.

### Límite de compensación ante excepción del commit

No agregar removeStoredEvidence indiscriminado al catch de TaskEvidencePanel: una excepción posterior a persistencia/notify no prueba rechazo y los archivos pueden estar referenciados. Comprobar fase y estado confirmado antes de compensar, con evidencia real de App/storage; retornofalse y excepción ambigua no se equiparan. El fallo pre-persistencia controlado está confirmado comoS65;no autoriza borrar archivos referenciados por un commit confirmado.

## S62 — semántica accesible de búsqueda global

Añadir etapa5: resultados abren tareas; lista semántica de botones con Tab/ShiftTab/Enter/Espacio, sin listbox/option/aria-selected falso. Conservar filtro/actor y autorización al abrir, foco/retornoEscape. No inventar selección automática. Evidencia Edge real documentada en S62. Total vigente62/92;referencias61/91 son corte anterior.

## S63 — foco al cerrar búsqueda/Dialog

Etapa5: capturar opener y restaurar alEscape/Cerrar si el cierre no transfiere foco intencional a otro diálogo/destino. Origen conectado/habilitado/visible o fallback pertinente;StrictMode/cambio de actor/diálogos simultáneos. No reenfocar búsqueda por encima del detalle seleccionado. EvidenciaEdge y límites en S63;inspeccionar demás consumidores del Dialog compartido,sin contarlos como defectos reproducidos por inferencia. Conteo vigente63/93.

### Comprobaciones locales de cierre SQL resueltas

Última cadena011 local: cobertura sólo-tiempo sin movimientos conserva sesión/cantidad0/puntos0; cierres conjuntos owner→peer ypeer→owner conservan cuota3+2=5,primer reporte literal ydos outbox. Evidencia sql-coverage-time-final-20261011.json(1caso) ysql-joint-close-order-20261011.json(2casos). No modificar esos caminos por sospecha secuencial;concurrencia/Auth real permanecen gates separados. S12/S61 del laboratorio siguen abiertos.

### Cierre de candidatos SQL de este corte

sql-close-expiry-20261011.json demuestra corte/actor y vínculo recuperable desde sesión/snapshot;sql-reopening-privacy-20261011.json conserva motivo operativo y excluye cuerpo privado marcado. No borrar historial de reapertura ni enriquecer eventos históricos por sospecha. Junto aACL,sólo-tiempo yórdenes conjuntos,estos candidatos locales quedan resueltos sin defecto adicional. Concurrencia/identidad real mantienen gate separado. Evidencia seleccionada no es suite completa ni aceptación de todos los reportes.

## S64 — tamaño de respaldo explicado correctamente

Etapa2: texto ypreview indican50MB para archivo de copia completo(JSON+datos+Base64),no50MBraw de evidencia. Mantener límites acordados ycompatibilidadv1;no modificar formato para arreglar promesa. Capturas actuales muestran inconsistencia;prueba de límite total ymensajes exactos acompaña corrección. Total vigente64/94.

## S65 — resultado de commit y compensación de evidencia

Etapa2:fallo antes de persistencia se controla/rechaza explícitamente ypermite compensación/reconciliación del archivo reciénalmacenado;errorposterioraléxito noautoriza borrar archivosreferenciados. Evitarcatchindiferenciado. CoordinarS09/S16/S49/S55 yprobarfallopreparación,persistfalse,notifytraséxito,compensación/reintento. Evidenciacontrolada enS65,noUUIDespontáneo niIndexedDBreal. Total65/95.

## Corte de implementación — etapa 5 — 14/10/2026

S36/S37/S38/S39/S54/S56/S62/S63 están implementados localmente. Ver
`docs/architecture/review-evidence/stage-5-partial-laboratory-20261014.json` y
el informe/capturas de Edge en `outputs/stage-5-validation-20261014/edge/`.
Validación vigente: 629/629 pruebas en 66 archivos, TypeScript, build cliente
y Worker; 28 checks Edge, cero errores JS/API. S36 cubre ambos selectores con
24 perfiles visibles y Tab/Shift+Tab/Escape; S62/63 cubre Tab/Enter/Espacio,
preservación del actor, apertura de destino y retorno por Escape; S54 cubre
arrastre real de tarea cubierta, titular y actor reemplazante, con preferencia
reduced-motion. No equivale a aceptar con lector de pantalla. Revisión
independiente Sol de etapa 5 pendiente; revisión de S52 de etapa 4 también
pendiente. Etapa 5 no se declara aceptada y el avance global permanece ~45%.

## Corte de implementación — etapa 6 — 14/10/2026

S57/S58 implementados localmente. Evidencia: `review-evidence/stage-6-verifier-
implementation-lab-20261014.json`. Suite completa 638/638 en 67 archivos,
TypeScript, build cliente/Worker aprobados; benchmark local válido con 24
perfiles/2.000 tareas, 30 muestras calientes y p95 368,07 ms (<1.000 ms), sin
errores JS ni API. El verificador aislado ejecutó 7/7 patrones actuales y
registra 206 omitidas por filtros; pruebas de contrato rechazan cero pruebas,
todo omitido, patrones ausentes, status nulo, errores y umbral incumplido.
Revisión independiente Sol pendiente; no se marca aceptación. No equivale a
rendimiento frío/concurrente/de producción. El hash del árbol efectivo y los
reportes por corrida están preservados bajo `outputs/`.

## Actualización de etapa 7 — 14/10/2026

> Actualización posterior: el gate de concurrencia PostgreSQL/MVCC local quedó
> cerrado en 26/26 escenarios con cluster PostgreSQL 17.11 descartable y Auth
> sintético. Las declaraciones posteriores de este documento que lo mencionan
> como pendiente describen cortes anteriores. Supabase Auth/RLS remoto no fue
> probado. La revisión independiente Sol de S52 y etapas 5–7, y la aceptación
> humana con lector de pantalla, continúan pendientes. Ver el informe runtime
> recheck 14/10/2026.

S01/S13/S30/S31/S32/S44/S45/S46/S59/S60 están implementados localmente. S46
también tiene regresiones de GET con presencia indisponible y de rechazo de
heartbeat antes de autenticar; los errores de almacenamiento conservan error.
La
respuesta Worker S45 comprueba ahora que `state.activeId` identifica un perfil
activo incluido en el DTO; tres regresiones cubren GET con perfil faltante o
inactivo y POST inválido con
conservación de la propuesta. S44 tiene una prueba de polling tardío que usa
RemoteWorkspace y App con GET/POST diferidos y verifica que la respuesta vieja
no sustituya la propuesta durante el guardado. Suite completa 658/658 en 67
archivos en ese corte previo a S39; la actualización integrada posterior figura
al final de este documento. TypeScript, cliente, Worker y `git diff --check`
pasaron. La evidencia está en
`docs/architecture/review-evidence/stage-7-implementation-local-20261014.json`.
Queda revisión independiente Sol y concurrencia PostgreSQL/MVCC real; no hay
PostgreSQL ni Docker local disponible, por lo que esa comprobación no se
simula con PGlite. No se conectó ni activó API, no se aplicó SQL remoto y no se
realizó entrega.

## Revalidación integrada posterior a S39 — 14/10/2026

En el corte de esa fecha la suite integrada pasó **659/659 pruebas en 67
archivos**; luego la revalidación completa aumentó a 663/663. La comprobación
visual de S39 quedó resuelta por Edge 29/29; la aceptación independiente Sol y
la aceptación humana con lector de pantalla siguen abiertas. Para etapa 7
siguen pendientes la revisión Sol y la concurrencia PostgreSQL/MVCC real. No se
conectaron servicios ni se realizó entrega. La relectura focal S39 pasó 57/57.
Evidencias focales S39 y S52:
`docs/architecture/review-evidence/s39-local-recheck-20261014.json` y
`docs/architecture/review-evidence/s52-local-recheck-20261014.json`.
Evidencia integrada: `docs/architecture/review-evidence/s39-tour-module-targets-lab-20261014.json`.

### Relectura local S57/S58 — 14/10/2026

El runner de aislamiento ahora reporta y falla si no puede leer el hash Git,
sin sobrescribir reportes anteriores. S57 también rechaza la aceptación del
benchmark si no puede calcular el hash del árbol efectivo. Las pruebas focales
pasaron 11/11. El runner normal completo pasó 7/7, con 209 omitidas, 0 fallidas
y hash del árbol registrado. La suite completa pasó 661/661 en 67 archivos y
TypeScript pasó. La revisión independiente Sol de S57/S58 sigue pendiente.
Evidencia: `docs/architecture/review-evidence/s58-hash-failure-report-lab-20261014.json`.

### Corrección explícita del bundle del plan anterior — 14/10/2026

La instrucción vigente del contrato `PLAN-CORRECTIONS-NEXT-20261007.md`
pedía resolver el aviso de bundle mediante separación coherente sin modificar
el umbral. La entrada estaba en 548,96 kB y mostraba un aviso de chunk >500 kB,
además de importación mixta de `laboratoryEvidence`. La reconciliación de
evidencia dejó esa importación diferida y agrupó React/ReactDOM/scheduler en
`framework`: entrada 328,29 kB y framework 208,98 kB. El límite Vite de 500 kB
permanece intacto; ambos avisos desaparecieron. Suite 661/661, TypeScript,
build cliente/Worker y `git diff --check` pasaron. Zod aún emite avisos `PURE`.
La revalidación Edge, accesibilidad automatizada y contraste quedó registrada
en la evidencia consolidada posterior. Sigue pendiente la inspección y
aceptación independiente Sol del bundle. Evidencia de corte:
`docs/architecture/review-evidence/sol-corrections-review-recheck-20261014.json`.

## Revalidación integral del paquete Sol — 14/10/2026

Se revisaron contra el árbol actual el informe R01–R11, el contrato de
correcciones, los 65 hallazgos, los contratos por etapas y la matriz de
requisitos. La suite pasó 663/663 en 67 archivos; TypeScript y builds de
cliente/Worker pasaron. Los cuatro E2E Edge terminaron correctamente. La
auditoría automatizada de accesibilidad revisó 38 rutas/3 perfiles, 2.124
controles AX y 904 paradas de teclado sin nombres/focos faltantes; el contraste
revisó 5.943 textos en 76 combinaciones, sin omisiones ni fallos. El benchmark
actual midió 534,39 ms p95 con 24 perfiles/2.000 tareas; S58 pasó 7/7. El hash
efectivo compartido de benchmark/verificador fue
`2cff5088bbc8992cecfbe25c1f019c8121ae673119d4580493c3bd534047d425`.

No se detectó una corrección de producto nueva en esta revalidación. Etapas
1–3 continúan aceptadas por Sol; S52 y etapas 5–7 quedan pendientes de revisión
Sol. La aceptación humana con lector de pantalla y PostgreSQL/MVCC real también
siguen abiertas. Evidencia completa:
`docs/architecture/review-evidence/sol-corrections-recheck-full-20261014.json`.
El recheck focal vigente pasó 200/200 en 18 archivos; S57 p95 569,62 ms y
S58 7/7, ambos con el mismo hash de ejecución. Para el gate MVCC se intentó
extraer PostgreSQL 17.11-5 sin instalar servicio, pero Windows canceló el
inicio antes de extraer binarios. No hubo prueba concurrente PostgreSQL. El
estado y la ruta temporal quedan registrados en
`review-evidence/open-contracts-recheck-20261014.json`.

Reejecución local posterior del paquete Sol, 14/10/2026: 663/663 pruebas,
TypeScript, builds, cuatro E2E Edge, auditorías AX/contraste y S57/S58 pasaron;
S57 midió p95 501,38 ms y S58 aprobó 7/7. El E2E de correcciones fue 29/29
y comprobó la geometría completa de los dos sectores de torta de S52.
No se confirmó otra corrección de producto. Gates aún abiertos: revisión
independiente Sol de S52 y etapas 5–7, aceptación humana de lector de pantalla
y PostgreSQL/MVCC concurrente real. Evidencia:
`review-evidence/sol-corrections-runtime-recheck-20261014.json`.


### Resultado vigente PostgreSQL/MVCC local — 14/10/2026

La prueba PostgreSQL usó el archivo oficial EDB 17.11, extraído a `%TEMP%` sin
instalar servicio. El cluster descartable escuchó sólo en loopback y se apagó.
El runner pasó 26/26 escenarios AB/BA, confirmó bloqueos reales mediante
`pg_locks` y `pg_blocking_pids`, no observó deadlocks y verificó rollback,
recibos y consistencia de cierres/reportes/outbox. Queda resuelta la
concurrencia MVCC local del laboratorio SQL; no se probó Supabase Auth/RLS
remoto. Revisión independiente Sol de S52 y etapas 5–7 y aceptación humana con
lector de pantalla continúan abiertas.

### Revalidación actual del contrato S57/S58 — 14/10/2026

Se retiraron opciones que permitían debilitar 30 muestras, p95 estrictamente
menor a 1.000 ms y fixture 24/2.000; los tipos y regresiones reflejan los
límites fijos. Suite 665/665, TypeScript, cliente/Worker y benchmark Edge
(384,85 ms p95) pasaron. El runner S58 pasó 7/7. Ambos informan el hash efectivo
`f3d0d7d4c3906f8cfbe48c0eb122dafb45c8dd29c4e53ec8c54c845286dfdf96`.
Evidencia: `review-evidence/s57-s58-current-contract-recheck-20261014.json`.
La revisión independiente Sol de S57/S58 sigue pendiente.
