# Reparación cerrada — revisión independiente de anticipación v42

## Decisión

Sol revisó el código de aplicación `20d4db3c151c3c2eb963352bde4578ab321a0a8d`.
Sites v42 contiene el mismo build de v41; sólo cambió documentación en
`97b0cb20432f88e55bd1f09da925cfbf0f07f3ee`. El bloque no se acepta aún.
Avance global 40% (35–45%), sin producción ni migración de empleados.
Próximo modelo: **GPT-6 Luna, esfuerzo medio, Standard**.

## Evidencia independiente

Cuatro probes con referencia congelada fallaron contra v42. Código y salida
están en `../architecture/review-evidence/deadline-v42/`. Para reproducir copiar
`probes.test.ts.txt` a `tests/review-deadline-probe.test.ts` y ejecutar
`npx vitest run tests/review-deadline-probe.test.ts`; sus imports asumen esa ruta.
La evidencia fallida queda fuera de la suite normal, sin ocultar su resultado.

| ID | Entrada / ubicación | Observado | Requerido |
| --- | --- | --- | --- |
| R1 | completedAt 08/10 15:00Z, corte 08/10 12:00Z | early | unknown, no logro futuro |
| R2 | completedAt `2026-02-31T15:00:00Z` | early tras normalizar | unknown |
| R3 | actividad propia con date `garbage` | pending tras descartarla | unknown |
| R4 | repetir checkTask con done=true ya marcado | objeto nuevo | mismo objeto y ninguna auditoría/persistencia |

Inspección adicional, independiente de los probes:
- `App.mutateTask` llama a commit incluso si fn devuelve la tarea original.
  Por ello el no-op de transition todavía puede registrar una nueva acción.
- CSV de análisis exporta null como campo vacío; el contrato requiere Sin muestra.
- CSV de PeriodReports etiqueta earlyRate=null de un resumen nuevo como
  Sin medición histórica. Confunde ausencia de muestra con ausencia del campo.
- TimelinessBadge dice Meta / Meta alcanzada, aunque la evidencia es registro:
  debe decir Meta registrada. La tabla agrupada omite promedio operativo.

## Instrucciones ejecutables para Luna

1. En timeliness.ts validar timestamps ISO completos antes de Date.parse:
   fecha de calendario real, hora 00–23, minutos/segundos 00–59, fracción opcional,
   zona obligatoria Z o ±HH:MM con componentes válidos. Rechazar zona ausente,
   24:00, fechas normalizadas y formatos ambiguos. Aceptar timestamps emitidos
   por toISOString y offsets explícitos. Aplicar a asOfISO, completedAt y createdAt.
   Comparar completedAt por instante contra el corte, además de fecha ART.
2. Validar fecha de actividad propia antes de filtrar período. Una fecha inválida
   de taskId propio da unknown; una fecha válida de otro período se ignora.
   Después conservar validaciones de cantidad/registro de actividades del período.
   No cambiar la regla de createdAt ni usar date para acreditar anticipación.
3. checkTask valida pertenencia y devuelve t si done ya coincide. mutateTask,
   después de comprobar permiso/cierre y ejecutar fn, devuelve sin commit si
   next===t. Preservar todas las transiciones válidas, cronómetros y reaperturas.
   No inventar auditoría para acciones que no modifican nada.
4. CSV de análisis: cada tasa/promedio null se exporta como Sin muestra.
   PeriodReports: distinguir primero ausencia de timeliness (Sin medición
   histórica) de resumen presente sin muestra (Sin muestra). Usar csvCell.
   Añadir promedios de días para resultados y operativas al CSV de reporte y
   promedio operativo a la tabla por empleado/equipo/sector.
5. Badge operativo: Meta registrada N días antes/después / Meta registrada en
   fecha. No mover ni cerrar tareas operativas ni dar bonificaciones al KPI.
6. En análisis actual, capturar un único instante para m y chartGroups y pasarlo
   como cuarto argumento de metrics (tercer argumento fecha ART de ese instante).
   Evita comparar tarjetas con el presente y agregados con fin del día.
   Mantener fin del día como default compatible de metrics y c.at en cierres.

## Verificación y límites

Integrar los probes R1–R4 como regresiones semánticas en la suite, ampliando R2
para createdAt y asOfISO, offsets válidos y bisiesto. Probar no-op en llamador
sin cambio de auditoría/almacenamiento, y exportación nuevo sin muestra frente
al histórico sin campo. Verificar tabla/promedio operativo y etiqueta registrada.
No basta buscar literales del código. Usar render/interacción real de React para
CSV y llamador. Los archivos de evidencia originales permanecen históricos.

Preservar SQL001–008, gateway, lector, dependencias, permisos, snapshots anteriores
sin regeneración, identidad empresa/asignación/período y métricas KPI existentes.
No conectar Supabase ni correo ni crear servicios. No implementar B/C todavía.
Ejecutar npm test, npm run build y git diff --check; commit/push y publicar build
exacto privado por Sites. Registrar resultados y siguiente revisión Sol medio.
QA visual claro/oscuro/Sistema sigue abierta: tokens numéricos no sustituyen
capturas reales. No afirmar que los bugs ya se repararon al preparar este contrato.

## Comprobación de base sin reparaciones

Revisión actual: suite normal 217/217 en 19 archivos, build aprobado,
git diff --check aprobado. Los cuatro probes de contrato fallaron por separado.
Esto confirma huecos de cobertura; no cambia el resultado de no aceptación.
Sólo documentación/evidencia modificada; aplicación live v42 se conserva.


## Resultado de ejecución Luna — código local

Corregidos R1–R4 y hallazgos asociados de auditoría, CSV y presentación. Se
añadieron pruebas temporales estrictas ISO, offset, corte temporal, bisiesto,
actividad inválida/de otro período y prueba renderizada de la etiqueta/panel.
Suite 222 pruebas/21 archivos, build y diff check pasan. Falta revisión Sol y QA
visual real de temas; no es aceptación final ni habilita migración.


## Publicación de la reparación

Sites v43 publicada con éxito: implementación commit
`9d6b97dc16625c974d6679cf7d69b7fe2fdb3900`, versión
`appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85~appgver_3e2fc69b4dac819196d375f0c836aa5a`,
deploy `appgdep_6ac00b2ad81c81919a50bafab9f7101d`. La suite fue 222/222 en
21 archivos, build y diff check aprobados. No se cambió SQL ni infraestructura.
La QA visual real claro/oscuro/Sistema sigue abierta; Sol debe revisar el bloque
antes de aceptarlo.


## Aceptación independiente v43

Comportamiento local aceptado tras ejecutar los cuatro probes originales y
verificar CSV, paneles y frontera no-op del llamador. Ver
`../architecture/REVIEW-V43-INDEPENDENT-20261002.md`. QA visual real continúa
abierta. Próximo paso Sol alto B/C; estimación vigente en PROJECT-STATUS.md.
