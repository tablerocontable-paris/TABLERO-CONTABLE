# Revisión independiente del corte implementado — 14/10/2026

**Estado vigente posterior:** S38/S44 y la espera de captura S52 aceptados
técnicamente. La revisión final aprobó 69/69 comprobaciones. Las descripciones
iniciales de fallos que siguen son el registro histórico previo al arreglo;
ver la aceptación al final. La prueba humana con lector de pantalla sigue abierta.

El cierre anterior de implementación no acredita que todos los contratos estén
corregidos. Esta revisión confirmó dos variantes pendientes de los hallazgos
originales S38 y S44. No incorpora funcionalidades ni nuevos IDs de auditoría.
No se modificó código de producto ni se conectaron servicios.

## S38 — P2 — Foco en control deshabilitado al volver al primer paso

En `src/App.tsx:3131`, volver al paso cero intenta enfocar
`tourPrimaryRef.current`. La referencia está en el botón Iniciar/Completar/Reabrir
del detalle de una tarea (`App.tsx:3462`), y no en Siguiente del recorrido.
Sin un detalle abierto, la referencia es nula: el foco permanece en Anterior,
que queda deshabilitado. Si el detalle estuviera abierto, la referencia apunta
fuera del coach. El contrato S38 exige recuperar foco en un control habilitado
del recorrido sin reenfocar cada render.

La reproducción con App real, seed ficticio y recorrido versión 6 abre el
recorrido, avanza, enfoca Anterior, vuelve al primer paso y espera un frame.
Anterior queda deshabilitado y conserva el foco. La expectativa de enfocar
Siguiente falla. Fuente archivada:
`outputs/independent-sol-review-20261014/tour-focus.source.tsx`.
Resultado: `tour-focus-result.json` en el mismo directorio, 0/1, exit 1.
Es una reproducción DOM; la aceptación de la corrección requiere teclado nativo.

**Contrato Luna:** poner `tourPrimaryRef` en Siguiente/Listo del coach y retirarla
del botón de acción de tarea. Conservar la recuperación puntual al regresar al
paso cero. Convertir esta reproducción en regresión de App. Comprobar también
que con un detalle de tarea abierto no se transfiera foco fuera del recorrido,
y que Pausar/Escape mantengan el retorno al origen. Verificar la secuencia en
Edge por teclado, incluido Shift+Tab. No modificar el progreso ni los permisos.

## S44 — P1 — Dos sondeos fuera de orden hacen retroceder App

El intervalo de `src/components/RemoteWorkspace.tsx:111` toma la generación de
contexto actual, pero no asigna una generación distinta a cada GET automático.
Dos sondeos simultáneos de la misma vista comparten esa generación. Si el
segundo responde primero con revisión 2 y el primero responde después con
revisión 1, ambas respuestas pasan el guard: App y `revision.current` retroceden.
El contrato original S44 pidió expresamente respuestas fuera de orden.

La reproducción usa RemoteWorkspace y App reales con fetch diferido. La carga
inicial tiene revisión 0; se lanzan dos callbacks del intervalo; llega revisión
2 (empresa «Versión nueva»), seguida de revisión 1 («Versión antigua»). El DOM
termina mostrando dos opciones con el nombre antiguo. No hay POST ni API real.
Fuente archivada: `outputs/independent-sol-review-20261014/poll-order.source.tsx`.
Resultado definitivo: `poll-order-final.json`, 0/1, exit 1. El primer intento
usó una consulta singular que encontró dos opciones; se corrigió el selector,
y la aserción de cero opciones antiguas confirmó el mismo defecto.

**Contrato Luna:** identificar cada lectura con un token monotónico además de
la generación de contexto. Aceptar sólo la lectura vigente para esa vista y
sin propuesta/POST; una respuesta descartada no cambia data, revisión ni estado
de sincronización. Evitar que un sondeo iniciado durante una apertura explícita
deje la interfaz en Actualizando después de descartar esa apertura. Conservar
invalidaciones al cambiar vista, guardar o desmontar y la recuperación de
propuestas. No fusionar estados ni habilitar RemoteWorkspace en la entrada lab.

Regresiones con App real: dos sondeos AB/BA con respuesta invertida; GET de
apertura frente a intervalo; GET previo a debounce/POST; cambio de vista;
desmontaje/remontaje. Verificar el estado visible y que el siguiente POST use
la revisión vigente. Conservar las pruebas de protocolo/presencia S45/S46.

## Evidencia de gráficos — captura antes de terminar animación

El runner `tests/browser-corrections.cjs:119` espera tamaño mínimo de sectores,
lo que puede cumplirse durante la animación de Recharts. La captura anterior
mostraba una abertura amplia entre sectores y fue descrita como geometría
completa. La prueba independiente esperó que ambos paths SVG dejaran de cambiar
durante 500 ms: la torta completa se renderiza correctamente. Cero errores JS y
cero API. Captura y paths definitivos:
`outputs/independent-sol-review-20261014/pie-final/pie-settled.png` y
`pie-settled.json`. El primer intento del diagnóstico falló por usar toJSON en
un SVGRect; se usaron ancho/alto explícitos en el reintento exitoso. No es un
defecto confirmado de producto.

**Contrato Luna:** esperar geometría estable o una señal comprobable de fin de
animación antes de capturar. Mantener los asserts de nombres, Sin base/0%,
colores y ausencia de errores/API. No declarar animación final a partir sólo
de ancho/alto mínimo, ni desactivar animación del producto para aprobar el test.

## Aceptaciones y comprobaciones

- S52: aceptado funcionalmente dentro de etapa 4. Código conserva grupos por
  trabajo autorizado, métricas sólo de entregables y distinción null/0/calidad.
  Las 20 regresiones de tarjetas/análisis/exportación pasan. Recharts real fue
  inspeccionado; la captura estable complementa la evidencia anterior.
- S57/S58: aceptados para el contrato local de etapa 6. Fuentes de benchmark,
  verificador, tipos y regresiones fueron cotejadas. Las 14 pruebas del contrato
  pasan. Los reportes previos del mismo código validan 30 muestras, 24 perfiles,
  2.000 tareas, p95 383,72 ms y 7/7 casos aislados, con hash común.
- Etapa 5: no aceptada por S38 y por la aceptación humana con lector de pantalla.
- Etapa 7: no aceptada por S44. La concurrencia PostgreSQL local 26/26 sigue
  acreditada con Auth sintético; Supabase alojado continúa fuera de esta fase.

La corrida focal actual pasó 138/138 en ocho archivos. Incluye S52, selector,
tableros, recorrido, verificadores, cliente Worker, policy/presencia y DTO SQL.
No contiene las reproducciones nuevas: su verde no las reemplaza. Los probes
fueron archivados con extensión source.tsx para evitar colección automática.
No se volvió a ejecutar suite completa/build porque no cambió producto.

Evidencia estructurada: `review-evidence/independent-review-20261014.json`.
## Resultado de la implementación local — 14/10/2026

Los tres contratos de esta revisión ya se implementaron: la referencia de foco
está en Siguiente/Listo; cada lectura remota tiene secuencia monotónica y el
polling espera a que termine una apertura explícita; el runner exige 500 ms de
geometría de sectores estable sin desactivar las animaciones.

Suite completa 668/668 en 67 archivos; TypeScript, build Vite y Worker pasaron.
Edge verificó 32/32 interacciones, incluyendo S38 con teclado nativo, cero errores
JS, cero llamadas operativas y S52 tras estabilizar el SVG. Los detalles están
en `review-evidence/s38-s44-followup-20261014.json`. La revisión independiente
Sol debe aceptar el cambio; etapa 5 conserva la aceptación humana con lector de
pantalla y etapa 7 no incluye Supabase alojado.

No hubo commit ni publicación: el árbol ya tenía cambios ajenos y mezclarlos
habría impedido atribuir el commit a esta corrección. Se mantuvo el mismo repo y
Site privado.

## Aceptación independiente del arreglo — 14/10/2026

S38 aceptado: la referencia tiene un único destino en Siguiente/Listo del coach.
La recuperación ocurre sólo al volver al paso cero y no reenfoca cada render.
Dos probes de App en laboratorio válido comprueban el caso vacío y el caso con
detalle de tarea abierto; la acción de tarea no recibe foco. Escape devuelve el
foco al origen. El reporte Edge 32/32 conserva la comprobación nativa Tab/Shift+Tab.

S44 aceptado en contrato local: secuencia por lectura y generación de contexto
invalidan respuestas viejas antes de escribir data/revisión; la propuesta y el
POST impiden aplicar GET. La bandera de apertura evita que un sondeo sustituya
la respuesta que debe terminar Actualizando. Las nuevas pruebas ejercitan
apertura pendiente, montaje anterior y GET resuelto antes del debounce. La
reproducción original de sondeos fuera de orden y el POST con revisión vigente
pasan, junto con las regresiones existentes de cambio de vista/recuperación.

S52 runner aceptado: paths/bounds/fill deben estabilizarse 500 ms. Se inspeccionó
la captura final completa, con sectores grises y separación Sin base/0%.

69/69 en cinco archivos, exit 0, resultado bruto:
`outputs/independent-sol-review-20261014/acceptance-final.json`. Seis son probes
independientes; 63 son regresiones existentes. Los probes quedan archivados con
extensión accepted.source.tsx para no alterar la colección de la suite.

Los primeros intentos del probe S38 archivado fallaron por su preparación: usaba
initialState sin base durable y eliminaba tareas conservando movimientos. Se
corrigió sólo el fixture para usar paris-state-lab válido y exigir avance real
al segundo paso. Los resultados intermedios se conservan; no son defectos nuevos
de foco. El caso de detalle espera el montaje diferido antes de evaluar el modal.

Los cinco hashes de implementación coinciden; los otros 13 archivos revisados
en el informe inicial también conservan sus hashes. Esta revisión no cambió
producto: se mantiene la evidencia previa 668/668, TypeScript y builds sin
repetirlos. Evidencia consolidada:
`review-evidence/s38-s44-independent-acceptance-20261014.json`.

Etapas 1–7 revisadas técnicamente dentro del laboratorio. Etapa 5 mantiene
aceptación humana con lector de pantalla, detallada en
`../runbooks/SCREEN-READER-ACCEPTANCE-LAB.md`. No hay una corrección de código
confirmada pendiente de este bloque. Supabase alojado, commit, paquete y deploy
siguen siendo trabajos distintos que esta revisión no acredita.
