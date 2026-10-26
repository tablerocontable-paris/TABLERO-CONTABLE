# Normalización preliminar de usuarios y tareas — 26/10/2026

Actualización local 26/10/2026: las 26 familias neutrales aprobadas están
disponibles como sugerencias v2 editables del laboratorio, no como hallazgos
confirmados sobre una organización. Cada opción tiene aliases de búsqueda y
campos de propuesta iniciales configurables; seleccionar y finalizar genera
únicamente un pendiente para jefatura. No asigna trabajo ni agrega metas, pesos,
vencimientos, obligaciones, empresas o responsables por defecto. La revisión de
capturas descrita debajo sigue sin permitir inferir cantidades reales.

## Alcance de la evidencia

Se revisaron capturas parciales proporcionadas por el usuario. Son material de
orientación funcional, no una exportación de datos ni una fuente con fecha de
corte verificable. No se copiaron nombres, empresas ni asignaciones
individuales a la línea base neutral.

En la captura de estructura se distinguen **14 nombres de usuario**: 1 jefe,
4 encargados y 9 empleados, además de una fila «Sin asignar». Es un conteo de
filas visibles; no confirma que el listado esté completo, que esas cuentas
sigan activas ni que representen la dotación actual. El laboratorio ficticio
local tiene una semilla distinta (13 perfiles) y Supabase DEV no tiene perfiles
reales; ninguna de las dos fuentes permite inferir la dotación actual.

Las capturas de tareas están recortadas, se superponen y muestran nombres
repetidos sin identificadores, períodos ni marcas de finalización. No permiten
calcular tareas únicas, movimientos diarios ni tareas completadas hoy. Una
operativa (por ejemplo, carga de facturas) representa movimientos repetibles;
no debe convertirse en una tarea completada por cada movimiento.

## Conceptos neutrales propuestos para el primer ingreso

Estos nombres normalizan familias de trabajo observadas o útiles para la
inducción. Son **propuestas editables y opcionales**; no afirman que todas las
organizaciones las usen. No crean plantillas, tareas, responsables, cuotas,
pesos ni vencimientos sin revisión y aprobación de jefatura.

| Familia | Concepto neutral | Alcance que conserva |
|---|---|---|
| Tesorería, bancos y cobranzas | Conciliación de cuenta bancaria | Banco/plataforma y período son parámetros; no asumir año comercial o día 30 sin configuración. |
| Tesorería, bancos y cobranzas | Procesamiento y control de pagos | Incluye pagos a proveedores y su referencia; pago de sueldos no implica liquidar haberes. |
| Tesorería, bancos y cobranzas | Arqueo y control de caja | Registrar control y diferencias, sin inferir faltantes. |
| Tesorería, bancos y cobranzas | Registro y seguimiento de cobranzas | Registrar movimientos y estado con referencia. |
| Tesorería, bancos y cobranzas | Registro y control de cancelaciones de cupones | Plataforma y período quedan como contexto. |
| Tesorería, bancos y cobranzas | Registro de devoluciones a clientes | Mantener la referencia al movimiento de origen cuando exista. |
| Tesorería, bancos y cobranzas | Registro y control de cheques | Distinguir cheques y eCheq sólo si la fuente lo requiere. |
| Tesorería, bancos y cobranzas | Registro y control de operaciones de crédito | No inferir evaluación o aprobación crediticia. |
| Tesorería, bancos y cobranzas | Aplicación y compensación de cobros | Conservar referencias de origen y destino. |
| Tesorería, bancos y cobranzas | Conciliación de plataformas de cobro | Separada de la conciliación bancaria; la plataforma es contexto. |
| Tesorería, bancos y cobranzas | Registro y control de cuotas de planes | Tipo de plan y período se configuran por organización. |
| Registración y documentación | Registro de comprobantes | Facturas y otros comprobantes se distinguen en la configuración. |
| Registración y documentación | Archivo y organización de documentación | No presupone que el archivo exista ni reemplaza su evidencia. |
| Registración y documentación | Registro y control de asientos contables | Un asiento asociado a IVA no implica liquidación ni presentación fiscal. |
| Registración y documentación | Registro y control de información de sueldos | No equivale a liquidación de haberes. |
| Contabilidad, inventario y obligaciones | Preparación y control de obligaciones fiscales | Obligación, período y vencimiento deben confirmarse por organización. |
| Contabilidad, inventario y obligaciones | Cierre contable por empresa | Empresa y período son parte del contexto de asignación. |
| Contabilidad, inventario y obligaciones | Control y ajuste de inventario | Separar recuento, análisis y asiento cuando el proceso lo requiera. |
| Contabilidad, inventario y obligaciones | Preparación y registro de ajustes contables | No inferir el motivo del ajuste a partir del título. |
| Análisis e indicadores | Análisis de costos de operaciones | Precisar el alcance del costo antes de crear controles. |
| Análisis e indicadores | Análisis y resumen de operaciones | Mantener fuente y período como referencias. |
| Análisis e indicadores | Cierre mensual de indicadores | Es un proceso de análisis; no cierra automáticamente el período contable. |
| Coordinación y administración | Gestión y seguimiento de trámites | Organismo, identificador y estado se parametrizan. |
| Coordinación y administración | Revisión de seguimiento del equipo | Consulta/supervisión; no equivale a ejecutar tareas ajenas. |
| Coordinación y administración | Actualización del registro de servicios | Definir qué registro y periodicidad antes de aprobar. |
| Coordinación y administración | Compra y control de insumos | No presume autorización de compra ni presupuesto. |

Los términos «Análisis Bonis PYMES», «Canon municipal acumulados» y «carga y
pago de cambio de modelo» permanecen **pendientes de aclarar alcance**. Siglas
como PA, PC, PT, PDA, VN, VO, MO4 y PSA requieren diccionario de origen; no se
expanden ni se asignan a empresas/sectores por inferencia. Las ocurrencias
originales nunca se deduplican por título.

## Conteos y datos necesarios para una estimación real

| Medida solicitada | Evidencia disponible | Resultado válido hoy |
|---|---|---|
| Personas actuales | 14 nombres y una fila sin asignar en una captura sin fecha ni estado activo | No determinable; sólo un mínimo de filas visibles en esa captura. |
| Tareas únicas | Títulos parciales, repetidos y sin ID/período | No determinable. |
| Tareas completadas hoy | Sin estado ni timestamp verificable de cierre | No determinable. |
| Trabajo operativo diario | Sin movimientos fechados ni cantidad/unidad | No determinable. |

Para cerrar estos números se necesita un extracto autorizado y anonimizado con:
ID estable de persona, estado activo y equipo; ID de ocurrencia, empresa y
período; estado; fechas de programación, finalización, anulación y reapertura;
zona horaria; relación de tarea conjunta/cobertura; y movimientos operativos
individuales con cantidad, unidad y fecha. Los adjuntos y comentarios deben
quedar fuera salvo autorización explícita, necesidad funcional y revisión de
privacidad.

## Estado de implementación

La versión `starter-v1-*` es una simulación local de seis sugerencias y se
conserva por compatibilidad. El catálogo v2 agrupa 26 conceptos opcionales,
editables y sin selección predeterminada; sólo genera propuestas pendientes de
aprobación antes de crear tareas. No es todavía el primer ingreso autenticado.
La línea base ficticia (13 perfiles, 4 empresas, 6 conceptos y 73 ocurrencias de
demostración) debe mostrarse siempre identificada como muestra, nunca como dato
del trabajo actual.
