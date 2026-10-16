# Revisión de anotaciones y recorrido — 01/10/2026

Fuente: `1284483903488dc95435e6bc95dd9e9558583269`, Sites privado versión 21.
El incremento cumple la extensión del recorrido y la conversión normal, pero
requiere las correcciones definidas abajo antes de aprobarlo para integración.
La migración SQL 008 todavía no existe: esta revisión no sustituye su ejecución.

## Evidencia reproducida

`node tests/review/run-annotations-tour-probes.mjs` ejecuta ocho escenarios en
jsdom, con perfiles y almacenamiento locales simulados. Diez observaciones:
cinco cumplen y cinco fallan. El código de salida cero indica que el diagnóstico
terminó; `acceptance:false` informa que el producto requiere correcciones.
Resultados: `review-evidence/annotations-tour-20261001.json`.
No se ejecutó QA visual en navegador, autenticación ni backend real.

| ID | Resultado observado | Prioridad |
| --- | --- | --- |
| AN-01 | Al convertir una nota del 10/10 y cambiar la fecha al 12/11, se guarda una asignación pero ninguna tarjeta. Se borra el recordatorio y el vínculo sigue NULL. Otra conversión podría duplicar asignaciones. | Alta |
| AN-02 | Con QuotaExceededError de localStorage, aparece el aviso de fallo pero el formulario vacía título y contenido. El texto no guardado se pierde. | Alta |
| AN-03 | Elegir catálogo durante la conversión habilita diaria/semanal/mensual, aunque la decisión documentada es una tarea de una sola vez. | Media |
| AN-04 | Si convertedTaskId existe pero la tarjeta no está disponible, la interfaz ofrece editar, eliminar y convertir. Los handlers lo rechazan silenciosamente. | Media |
| TOUR-01 | Si falla el guardado del paso 5, la vista navega a calendario pero el coach sigue explicando actividad operativa y el avance queda en 4. | Media |

Cumplen: conversión normal con texto intacto y vínculo, siete pasos empleado,
nueve encargado, once jefe, reanudación en los tres roles tras remontar la app,
y lectura del payload v3 anterior sin anotaciones ni tourVersion.

## Observaciones por inspección

- AN-01 también valida el cierre del mes visible en vez del mes de realización
  elegido. La corrección debe comprobar el período efectivo y materializar la
  tarjeta en ese mismo período antes del commit.
- El formulario permite recordatorios sin fecha. Además, el campo «Recordarme
  el» en notas/fórmulas guarda una fecha que los avisos ignoran porque filtran sólo
  kind=reminder. Falta coherencia entre controles y recordatorios.
- El lanzamiento automático tras la inducción no inicializa versión/avance ni
  navega a la vista del primer paso. Con home=tasks puede mostrar el primer coach
  sobre otra sección. La apertura manual sí navega a la sección correcta.
- La búsqueda nueva quita el outline del input; el textarea no tiene una regla
  explícita de foco. Botones de uso diario de 11px y contenido de 12px deben
  mejorar su legibilidad. Los colores nuevos usan variables de tema; el aspecto
  y contraste real quedan pendientes de QA visual.
- Los tres tests nuevos verifican callbacks del componente; no prueban el commit
  real, período efectivo, fallo de almacenamiento, aislamiento entre perfiles
  ni la persistencia del recorrido. La afirmación anterior de «conversión
  probada» debe limitarse a esos callbacks hasta añadir aceptación integrada.

## Continuidad y decisión

Comprobaciones finales de esta revisión: `npm test` (**77 tests / 9 archivos**),
`npm run build` y `git diff --check` pasan. `git diff --quiet` confirma frontend y
migraciones sin cambios contra el SHA de versión 21; SQL 001–007, pruebas
006/007, probes/fixture 007 y evidencia previa sin cambios contra
`d55ba58ffaf7d32cb9c574d48f3df574e164f710`. Los ocho escenarios diagnósticos se
ejecutan con configuración separada y no inflan la suite de aceptación normal.
Esta entrega registra revisión/instrucciones, no implementa aún las correcciones.

Se aprueba un contrato de corrección acotado:
`docs/product/ANNOTATIONS-TOUR-HARDENING.md`.
El orden completo para Luna está en `docs/EXECUTION-NEXT.md`: primero resolver
este incremento y luego ejecutar `TIME-COVERAGE-008-ACCEPTANCE.md`. No reemplazar
la segunda parte por otra mejora visual. SQL 001–007 y la evidencia congelada
siguen intactos; la autorización actual no incluye SQL remoto ni migración real.

La privacidad real de anotaciones sigue pendiente de Supabase Auth/RLS. No usar
datos personales/productivos en el prototipo ni incluir notas en reportes/KPI.
El producto completo continúa en desarrollo; no corresponde asignar un porcentaje
de preparación productiva a partir del número de pantallas implementadas.

Próximo modelo: **GPT 6 Luna, esfuerzo medio**, ambas partes de EXECUTION-NEXT.
Al terminarlas: **GPT Sol 6.1, esfuerzo alto**, revisión de ejecución y aceptación.
