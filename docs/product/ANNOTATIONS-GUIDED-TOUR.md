# Anotaciones y recorrido guiado

Estado: cambios locales de aceptación posteriores a la demo versión 22. Las
correcciones de esta iteración están cubiertas por
`tests/annotations-tour-app.test.tsx`; ver además
`docs/architecture/ANNOTATIONS-TOUR-HARDENING.md` y la revisión inicial.

## Anotaciones personales

Cada perfil puede guardar referencias de tipo nota, fórmula de Excel o
recordatorio con fecha. Se pueden buscar, filtrar, editar y copiar fórmulas.
Convertir una anotación crea una asignación de una sola vez para la fecha elegida
y el período de esa fecha. El texto original se conserva y queda vinculado a la
única tarjeta creada. Los cierres del período objetivo, recurrencias, fechas
inválidas, vínculos incompletos y fallos de guardado se rechazan sin perder la
anotación ni dejar asignaciones huérfanas. La anotación sólo se marca convertida
cuando el guardado de la tarjeta se confirma.

Los recordatorios requieren fecha y aparecen en el tablero cuando corresponden.
Un guardado fallido conserva el borrador para reintentar. Una referencia cuyo
vínculo quedó sin tarjeta no ofrece edición ni una segunda conversión.

La demo asocia anotaciones al perfil seleccionado en `localStorage`. Como el
selector de perfiles no es autenticación, esto no constituye privacidad ni
protección frente a otros usuarios del mismo navegador. Antes de producción,
persistirlas en backend bajo `owner_id = auth.uid()` y aplicar RLS de lectura,
escritura y eliminación. No incluir el contenido personal en KPIs ni reportes
mensuales. La conversión es explícita y sí genera la asignación normal, con sus
reglas de empresa, vencimiento y cierre.

## Recorrido guiado

La versión 2 tiene siete pasos base: prioridades, ambiente de empresa, tarjetas,
controles y cronómetro, actividad operativa, vencimientos, y anotaciones.
Encargados agregan análisis y estructura; jefatura agrega catálogo/pesos y
cierre. El avance queda asociado al perfil y versión del recorrido. Pausar y
retomar conserva el paso; completarlo permite reiniciar desde el principio.

El progreso se guarda por perfil y versión; los índices corruptos se normalizan,
un guardado fallido no adelanta la vista y completar la inducción deja un estado
coherente para retomarla o volver a iniciarla. Estos pasos orientan, pero no
reemplazan la inducción transaccional ni la parametrización de tareas habituales
por empresa.
