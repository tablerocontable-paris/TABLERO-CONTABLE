# Estándares, cierre y mejora continua — pedido 01/10/2026

## Catálogo e inducción

Juan Pablo administra un catálogo con código estable, nombre, objetivo, instrucciones, controles, tipo, unidad y peso. «Conciliación Banco X» es un único proceso del catálogo. Empresa 1 y empresa 2 tienen asignaciones y ocurrencias independientes del mismo proceso; no nombres o procedimientos libres. Los cambios futuros del estándar requieren versionado; nunca reescribir los cierres anteriores.

La inducción inicial obligatoria toma empresa/equipo/permisos asignados por Juan Pablo. El empleado selecciona procesos del catálogo y declara cuándo los realiza, frecuencia, vencimiento y meta. El responsable debe validar la hoja de ruta habitual antes de activarla en producción. Un proceso faltante se incorpora/revisa por jefatura; no crear sinónimos individuales. Las empresas deben seleccionarse por asignación: no asumir que toda tarea elegida se realiza en todas las empresas del empleado.

Hoja de ruta habitual = asignaciones recurrentes del catálogo, con regla y responsable. Trabajos esporádicos = auditorías, correcciones y otras intervenciones puntuales, con objetivo y cierre explícito. Un trabajo puntual puede usar un proceso estándar; su pertenencia al catálogo no implica recurrencia. Los particulares libres son únicamente puntuales y se reportan separados; no agrupar texto parecido como si fuese el mismo proceso.

Implementado en esta entrega de demo: protección de identidad/controles del catálogo al crear tareas, alta de procesos por jefatura, particulares sin recurrencia y reporte con código de catálogo. La inducción permite seleccionar las empresas por tarea. Pendientes de producción: aprobación de inducción, propuestas de procesos faltantes y versiones de estándares.

## Reporte automático al cerrar el período

El cierre de cada empleado genera una sola foto inmutable de todas sus empresas y su reporte. Destino: gerente Juan Pablo (rol jefe configurado). Incluir empleado/equipo/sector, período, empresa y proceso estándar, tareas previstas/completadas/pendientes, KPI ponderado, cumplimiento operativo en su propia unidad, tiempo registrado, reaperturas, observaciones y detalle de actividades/ejecutores. No sumar unidades diferentes ni equiparar tiempo con productividad. Distinguir titular y ejecutor durante coberturas.

La demo genera el reporte al cerrar y lo deja disponible en la sección de cierre, con exportación CSV; no envía correo. Los cierres anteriores sin reporte conservan su exportación original, sin inventar un snapshot retrospectivo.

En backend real: cerrar y crear reporte + evento de entrega en la misma transacción. Una clave única (empleado, período, versión de cierre) evita duplicados. Un trabajador de entrega reintenta fallos, registra pendiente/enviado/fallido y avisa al administrador. No marcar enviado sólo porque se creó el reporte. Usar correo verificado de Juan Pablo y enlace autenticado, no adjuntar datos privados en una URL pública. Definir si el cierre general también dispara cierres individuales y cuándo se considera completo. No programar envíos con datos de la demo ni usar una automatización de chat como sustituto del proceso de cierre.

## Kaizen: mejorar el proceso con evidencia

No usar una puntuación decorativa o un ranking de sugerencias. Cada propuesta se vincula a un proceso y empresa, con problema observado, medición inicial, cambio propuesto, responsable, fecha de prueba y medida objetivo. Ciclo: propuesta → revisión por encargado/jefe → prueba → comparación antes/después → adopción del nuevo estándar o descarte con motivo. Preservar volumen, complejidad y contexto para comparar. Ejemplo: reducir reprocesos de conciliación por extractos incompletos; comprobar diferencias pendientes antes y después. La adopción crea una nueva versión del estándar para trabajo futuro.

## 5S: orden que facilita ejecutar y cubrir tareas

Aplicación a documentos e instrucciones contables, con criterios observables:

- Clasificar: separar documentación vigente, obsoleta y faltante; política de conservación aprobada, sin borrados automáticos de evidencias.
- Ordenar: ubicación, nombres y responsables claros para extractos, conciliaciones e instructivos.
- Limpiar: detectar duplicados, archivos rotos y errores de referencias; registrar correcciones verificadas.
- Estandarizar: plantillas comunes, checklist y controles versionados del catálogo.
- Sostener: revisión periódica del estándar y traspaso de vacaciones/licencias con documentación accesible.

Cada revisión debe tener evidencia, hallazgos, acción, responsable y fecha. No contar 5S como tarea ficticia completada ni modificar el KPI productivo automáticamente. Kaizen/5S se mostrarán como calidad y mejora de procesos, separados de volumen y cumplimiento. Su módulo funcional está pendiente; estos criterios son el contrato de diseño de la siguiente ejecución.
