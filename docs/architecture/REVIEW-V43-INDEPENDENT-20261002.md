# Revisión independiente de Sites v43

## Resultado

**Aceptado localmente el bloque de reparación de anticipación**, con QA visual
real todavía abierta. Se revisó la aplicación publicada desde
`9d6b97dc16625c974d6679cf7d69b7fe2fdb3900`. No se cambió código del producto en
esta revisión. Live sigue v43, deploy succeeded
`appgdep_6ac00b2ad81c81919a50bafab9f7101d`.

## Evidencia

Los cuatro probes originales de v42 se ejecutaron sin cambiar sus expectativas:
**4/4 pasan**. V43 rechaza una finalización posterior al corte en el mismo día,
31/02 normalizado y actividad propia con fecha inválida; repetir checklist
conserva la identidad de la tarea. Salida y probes en
`review-evidence/deadline-v43/` (la extensión .txt conserva la evidencia fuera de
la suite normal; para ejecutar, copiar a tests/review-deadline-probe.test.ts).

Las pruebas focalizadas de dominio/interfaz/CSV pasan: 15 casos incluyendo esos
cuatro probes. Verifican offsets, bisiesto, denominadores, reapertura, snapshots,
fecha declarada frente a createdAt, etiqueta registrada y promedios separados.

Se añadió una regresión independiente del llamador a `ui-a-acceptance.test.tsx`:
la interacción real de React solicita una mutación; se simula que el reductor
resuelve esa solicitud como no-op devolviendo la tarea original. Se comprueba
que se llamó al reductor, no se escribió almacenamiento y no se añadió auditoría.
Esta prueba de frontera complementa el probe de checkTask real; no pretende que
un clic normal que desmarca un checkbox sea un no-op. Los cinco casos del
archivo pasan. La primera preparación del test olvidó abrir En curso, plegada
por defecto; se corrigió el fixture sin cambiar el producto.

Inspección de rutas completada:
- Validación ISO previa a interpretar asOfISO, completedAt y createdAt.
- Comparación de instante de completedAt frente al corte.
- Validación de fechas propias antes de filtrar el período; otra fecha válida
  de otro período se ignora.
- mutateTask verifica permiso/cierre y retorna antes de reloj/commit si next===t.
- m y chartGroups comparten metricAsOf y su fecha ART. El default histórico de
  metrics al final del día y el corte exacto c.at de cierres se preservan.
- CSV de análisis usa Sin muestra para tasas/promedios null. CSV de reporte
  distingue campo ausente histórico de campo presente sin muestra e incluye
  ambos promedios. La prueba renderizada descarga el CSV desde el diálogo.
- Metas muestran “Meta registrada”; no completan la operativa ni añaden bonus.

## Límites y siguiente paso

Esta aceptación cubre comportamiento local y exportación. QA visual real de
claro/oscuro/Sistema y móvil sigue pendiente; tokens de contraste no prueban la
apariencia renderizada. Auth, RLS conectado, correo y concurrencia PostgreSQL
siguen pendientes. No se aplicó SQL ni se crearon servicios ni se migraron datos.

Después de esta aceptación se pasa a **Sol 6.1 alto, Standard**, para el diseño
B/C ya pendiente: jerarquía multiarea, conjuntas, cobertura por tareas, bajas y
huérfanas, comentarios privados y relación con inducción/agenda/reportes.

## Comprobación final de revisión

Suite regular **223/223 pruebas en 21 archivos** (v43 tenía 222; se añadió la
regresión del llamador), npm run build y git diff --check aprobados. No se cambió
código src, SQL, gateway, lector ni dependencias. El build mantiene los assets
de v43. Esta revisión se guarda en Git sin publicar otra versión idéntica.
