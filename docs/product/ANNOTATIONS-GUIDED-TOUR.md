# Anotaciones y recorrido guiado

Estado: demo versión 21. La revisión encontró correcciones pendientes; la
conversión de una sola vez con vínculo se cumple en el caso normal, pero aún
falla al elegir otra fecha/período y habilita recurrencia al elegir catálogo.
Ver `docs/architecture/REVIEW-ANNOTATIONS-TOUR-20261001.md` y el contrato
`ANNOTATIONS-TOUR-HARDENING.md` antes de considerarlo aprobado.

## Anotaciones personales

Cada perfil puede guardar referencias de tipo nota, fórmula de Excel o
recordatorio con fecha. Se pueden buscar, filtrar, editar y copiar fórmulas.
Convertir una anotación crea una asignación de una sola vez, en la empresa,
responsable y período seleccionados. El texto original se conserva y queda
vinculado a la tarjeta creada; no se permite volver a convertirla.

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

Estos pasos son orientación inicial, no reemplazan la inducción transaccional ni
la parametrización de tareas habituales por empresa.
