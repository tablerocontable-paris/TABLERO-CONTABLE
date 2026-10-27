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
| Tesorería, bancos y cobranzas | Registro y control de liquidaciones de tarjetas y cupones | Registrar la liquidación del procesador; conciliarla con banco/contabilidad en un control separado. |
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
| Personas actuales | Captura: 14 nombres y una fila sin asignar; D1: 4 perfiles activos con estado actualizado el 06/10 | No determinable; ninguno acredita dotación vigente. |
| Tareas únicas | Capturas parciales; el D1 conserva una tarea con ID en un snapshot del 06/10 | Una fila en ese snapshot; universo de tareas reales no determinable. |
| Tareas completadas hoy | El D1 conserva 1 tarea «En curso», sin cierre y con workspace actualizado el 06/10 | No hay cierres en ese snapshot; no demuestra actividad real del día. |
| Trabajo operativo diario | Sin movimientos fechados ni cantidad/unidad | No determinable. |

Relectura de sólo lectura del D1 del Site actual, 27/10/2026: se encontraron 4
perfiles marcados activos y 1 tarea, cuyo estado es «En curso» y cuyo campo de
cierre está vacío. La fecha `updated_at` del workspace continúa en
`2026-10-06T16:24:10Z`; las dos señales de presencia también son de esa fecha y
no están vigentes. Por lo tanto, el conteo describe únicamente la muestra del
laboratorio guardada el 06/10, no la dotación actual ni las completaciones del
27/10. El Site contiene datos de prueba identificables: no se copiaron nombres,
emails, identificadores, títulos de tareas, comentarios ni filas de auditoría a
GitHub. El respaldo local del navegador no se consultó.

Para cerrar estos números se necesita un extracto autorizado y seudonimizado
con IDs estables, estado activo, ID de ocurrencia y período, estado al corte,
fechas de programación/finalización/anulación, eventos de reapertura, zona
horaria, relación conjunta/cobertura y movimientos con cantidad, unidad y fecha.
Los adjuntos y comentarios quedan fuera. El proceso local está especificado en
`docs/product/ANONYMIZED-WORKFORCE-ESTIMATE.md`; no se ha recibido ni procesado
ningún extracto real. Los IDs estables se protegen con una clave HMAC local, pero
la salida aún puede permitir reidentificación por fechas o rareza; no publicarla.

## Revisión independiente de cobertura — 27/10/2026

La comparación del catálogo v2 con las 26 filas de este borrador encontró
cobertura completa: no se identificaron familias explícitas del borrador que
falte representar. Esto valida la correspondencia documental, no que esas
familias describan todo el trabajo real de la organización.

Se deben mantener separadas recepción/registro de cobranzas, aplicación de
cobros y conciliación de plataformas; también registro de liquidaciones de
tarjetas/cupones y conciliación con banco o contabilidad. Son momentos de
procesamiento distintos y unirlos podría duplicar o perder movimientos. Los
términos aún pendientes de aclarar en este borrador no se convierten en
sugerencias normalizadas hasta entender su alcance.

El onboarding de v2 sigue habilitado sólo para el laboratorio local. Antes de
conectarlo al primer ingreso autenticado hay que especificar por rol: quién
propone conceptos, quién revisa y aprueba, cuándo se convierten en tareas, qué
datos se solicitan y cómo se retoma o cancela una configuración incompleta.
La lista debe seguir opcional, editable, sin preselecciones y sin asignaciones
automáticas. Para hacerla más fácil de recorrer, la inducción puede presentar
un nombre breve y ejemplos con detalle desplegable, conservando el nombre
formal en catálogo e historial.

## Estado de implementación

El estimador local distingue personas vigentes al corte, ocurrencias lógicas
por estado (una sola por grupo de tarea conjunta), asignaciones fuente, cierres
finales vigentes, eventos de cierre/reapertura y movimientos por cantidad/unidad.
No calcula personal real hasta recibir un extracto
autorizado y actual. Sus plantillas están vacías y sus pruebas usan fixtures
ficticios. Se aceptan únicamente códigos de concepto y unidades de vocabulario
neutro cerrado; toda categoría nueva requiere revisión explícita.

La versión `starter-v1-*` es una simulación local de seis sugerencias y se
conserva por compatibilidad. El catálogo v2 agrupa 26 conceptos opcionales,
editables y sin selección predeterminada; sólo genera propuestas pendientes de
aprobación antes de crear tareas. No es todavía el primer ingreso autenticado.
La línea base ficticia (13 perfiles, 4 empresas, 6 conceptos y 73 ocurrencias de
demostración) debe mostrarse siempre identificada como muestra, nunca como dato
del trabajo actual.
