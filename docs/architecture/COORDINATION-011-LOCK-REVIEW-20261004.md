# Hallazgo previo a ejecutar B2b / 011: orden de locks heredado

04/10/2026 UTC. No se modificó ninguna migración SQL en esta revisión.

## Hallazgo que bloquea la activación

El contrato011 propone bloquear todos los participantes/períodos en orden estable
antes de bloquear filas de tarea/sesión. Las RPC vigentes no llegan a ese punto
con el mismo orden: `transition_task_reviewed` (006, líneas 468–479) toma primero
`timer-actor`, luego `work-owner` de ancla/origen y finalmente locks mensuales;
`start_task_timer` (008, líneas 167–183) repite ese patrón. En cambio, el cierre
006 (líneas 393–406) bloquea el owner y su período directamente. `lock_open_month`
001 (líneas 54–56) añade una tercera clave advisory distinta.

Al añadir locks de todos los responsables dentro de la rutina existente, dos
actores pueden invertir el orden antes de solicitar el segundo lock:

- ejecución A ya posee `work-owner:A`; después intentaría tomar B;
- ejecución B ya posee `work-owner:B`; después intentaría tomar A.

Esto puede ocurrir cuando ambas modifican tareas conjuntas ancladas en titulares
distintos. PostgreSQL abortaría una transacción por deadlock; no hay corrupción
confirmada, pero incumple el orden único que exige011 y vuelve impredecible la
experiencia. El lock mensual separado también debe tener una posición única.
PGlite no sirve para afirmar que esta carrera está ausente.

## Resolución requerida antes de continuar con Luna

**GPT-6.1 Sol alto:** corregir `COORDINATION-011-EXECUTION-20261004.md` para
definir un único protocolo aplicable a *todas* las rutas antiguas y nuevas,
incluidos cambio de cronómetro origen/destino, cierre, actividad, onboarding,
materialización, ausencias legacy y cancelar binding. Precisar las claves
existentes que desaparecen/se reemplazan, orden desde receipt y actor-timer,
cuándo se descubre/revalida el conjunto, y cómo se bloquea contra cierres sin
pedir locks fuera de orden. El protocolo debe ser viable sin volver serial toda
la organización si una tarea individual basta, y requerir prueba PostgreSQL real
con dos sesiones/barrier que reproduzca el caso y pruebe ausencia de deadlock.

No se habilita acceso conjunto/cobertura ni se quita el índice por instancia
hasta que el orden haya sido aprobado e implementado. El SQL010 queda intacto y
el Site live sigue v43.
