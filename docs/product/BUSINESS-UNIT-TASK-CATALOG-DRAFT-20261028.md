# Catálogo inicial de unidades de negocio y tareas — borrador 28/10/2026

## Propósito

Definir selecciones canónicas para el primer ingreso y para medir el mismo
trabajo entre unidades de negocio. El usuario selecciona una tarea del catálogo;
no crea otra tarea equivalente escribiendo una abreviatura o una variante en su
tablero. El nombre visible y el código estable identifican la clase de trabajo.

Este documento normaliza los títulos legibles en las capturas entregadas. Las
capturas son parciales: sirven para reconocer vocabulario, no para contar
frecuencias, asignaciones o tareas completadas. No se incorporan nombres de
personas ni datos identificables.

## Unidades de negocio

Usar estas opciones como dimensión organizativa explícita, separada de la
empresa legal (`companyId`), del equipo, la sucursal y el sector:

| Código | Nombre visible |
|---|---|
| `paris_autos` | PARIS AUTOS |
| `doral` | DORAL |
| `paris_cars` | PARIS CARS |
| `paris_trac` | PARIS TRAC |
| `motor` | MOTOR |
| `fideicomiso_desarrollo` | FIDEICOMISO DESARROLLO |
| `postventa` | POSTVENTA |

Una asignación de trabajo lleva unidad de negocio y empresa legal como campos
separados. No inferir que son lo mismo ni que cada unidad corresponde a una sola
empresa legal. Los códigos PA, PC y PT sólo pueden traducirse a PARIS AUTOS,
PARIS CARS y PARIS TRAC en las tareas donde esas siglas aparecen junto al nombre
completo de forma inequívoca. `PV` queda como posible POSTVENTA, pendiente de
confirmación.

## Regla de selección y medición

- Toda tarea estándar tiene `taskCode` inmutable, `catalogVersion`, nombre
  canónico y parámetros estructurados.
- En primer ingreso se seleccionan unidad de negocio y tarea. Cuando corresponda
  se completa además banco, cuenta, sucursal, marca, sistema, sector, tipo de
  operación y período. Los parámetros no se agregan al nombre canónico.
- No ofrecer un campo de título libre al crear trabajo estándar. Un nombre nuevo
  se solicita como propuesta de catálogo; jefatura define si crea un nuevo código
  o vincula el alias a uno existente. La decisión conserva autoría e historial.
- Una repetición de una tarea conserva su código y parámetros, y registra sus
  movimientos/cantidad cuando es trabajo operativo. No crear otra definición
  por período, persona, unidad o empresa.
- Alias y errores de tipeo se guardan sólo como alias de búsqueda; nunca como
  categoría de análisis ni como reemplazo del nombre canónico.
- Un mismo código permite comparar el proceso entre unidades; la comparación
  debe conservar unidad, banco/marca/sucursal y período como dimensiones.
- Todas las tareas observadas se pueden registrar desde el catálogo v5. Las que
  tienen significado todavía no confirmado se marcan como provisionales, usan
  códigos separados y no participan en comparaciones entre unidades hasta que
  jefatura confirme que describen el mismo flujo y unidad de medida.
- No importar códigos de la taxonomía neutral actual por similitud textual sin
  revisar la semántica. Los códigos neutral-v2 existentes son contratos
  históricos y no se renumeran.

## Tareas canónicas observadas

Los códigos debajo son las claves estables de la implementación del catálogo
específico del laboratorio; su versión vigente es 5. La clasificación `Confirmada` indica que el
proceso principal resulta claro por el título; `Revisar` indica que hace falta
una decisión funcional antes de habilitarlo como selección oficial.

| Código estable | Nombre canónico | Parámetros que deben quedar separados | Variantes observadas / criterio | Estado |
|---|---|---|---|---|
| `gpar_bank_reconciliation` | Conciliación bancaria | Unidad, banco, cuenta, período | Incluye “Conciliación Banco Francés – PA”; Francés y PARIS AUTOS son parámetros. Código de organización, sin reemplazar neutral-v2. | Confirmada |
| `gpar_mp_reconciliation` | Conciliación de movimientos de Mercado Pago | Unidad, cuenta/comercio, período | Separada de cancelación/registro de cupones. | Confirmada |
| `cash_count` | Arqueo de caja | Unidad, sucursal, caja, turno/fecha | Une arqueo de caja/cajas y diferencias de mayúsculas. | Confirmada |
| `document_archive` | Archivo y organización de documentación | Unidad, tipo de documento, ubicación | Une repeticiones de “Archivo de documentación”. | Confirmada |
| `supplier_invoice_load` | Carga de facturas de proveedores | Unidad, proveedor, clase de comprobante, sucursal, sistema/origen | Une “Carga de factura(s) proveedor(es)”; GM, Chevrolet y portal Stellantis son parámetros si el trabajo es el mismo. | Revisar alcance de portales |
| `parts_invoice_load` | Carga de facturas de repuestos | Unidad, sucursal | Repuestos París Cars sucursal 3/81 no crean tareas distintas. | Confirmada |
| `new_vehicle_invoice_load` | Carga de facturas de vehículos nuevos | Unidad, marca, sucursal, momento del proceso | “Vehículos nuevos Chevrolet” y “Factura VN” son alias potenciales; confirmar VN antes de activar sigla. | Revisar sigla VN |
| `zero_km_invoice_receipt` | Registro de factura de unidad 0 km al recibirla | Unidad, marca, vehículo, sucursal, fecha de recepción | Se mantiene separado de carga general de facturas. | Confirmada |
| `service_invoice_load` | Carga de facturas de proveedores de servicios | Unidad, proveedor, tratamiento de caja | “Conjunta con caja” sugiere coordinación, no permite inferir un dueño o una sola tarea. | Revisar flujo conjunto |
| `invoice_load_other` | Carga de otras facturas | Unidad, tipo, proveedor, sucursal | Sólo usar si no aplica una familia más específica; no es un cajón para duplicar conceptos existentes. | Revisar uso |
| `supplier_payment` | Preparación y registro de pagos a proveedores | Unidad, medio/banco, proveedor, fecha | Diferenciar preparar, ejecutar y registrar si son etapas hechas por personas distintas. | Revisar etapa |
| `bank_transfer_register` | Registro de transferencias bancarias | Unidad, banco/cuenta, destinatario, motivo | Variantes singulares/plurales se consolidan; no asumir que registro equivale a ejecutar. | Revisar etapa |
| `supplier_payment_transfer` | Transferencias de pago a proveedores | Unidad, banco/cuenta, proveedor | Mantener separada de transferencia genérica si tiene controles propios. | Revisar separación |
| `salary_data_load` | Carga de información de sueldos | Unidad, período, sistema | “Carga de sueldos” es distinta del asiento y del pago. | Confirmada |
| `salary_bank_payment` | Pago de sueldos por banco | Unidad, banco/cuenta, período | No implica cargar recibos ni contabilizar asiento. | Confirmada |
| `salary_accounting_entry` | Registración contable de sueldos | Período | “Asiento sueldos PA/PT” conserva la unidad sólo en `businessUnitCode`. | Confirmada |
| `vat_accounting_entry` | Registración contable de IVA | Período, tipo | “Asiento IVA DORAL/PA/PC/PT” conserva la unidad sólo en `businessUnitCode`. | Confirmada |
| `patent_debt_payment_entry` | Registración del pago de deuda de patentes | Unidad, jurisdicción, período | Separada de canon municipal hasta aclarar proceso. | Confirmada |
| `pda_result_adjustment` | Ajuste de resultados PDA | Unidad, período, concepto de ajuste | Mantener PDA literal; no expandir sigla. | Revisar significado PDA |
| `inventory_adjustment` | Ajustes de inventario | Unidad, sucursal, rubro/período | Confirmar si incluye recuento, análisis y asiento, o sólo registración del ajuste. | Revisar alcance |
| `credit_cost_analysis` | Análisis de costo de créditos | Unidad, línea/producto, período | “PSA” se conserva como contexto literal hasta confirmar sigla. | Revisar PSA |
| `coupon_cost_analysis` | Análisis de costo de cupones | Unidad, medio/procesador, período | No confundir con registración de liquidaciones o conciliación. | Confirmada |
| `procedure_cost_analysis` | Análisis de costo de trámites | Unidad, tipo de trámite, período | Mantener distinto de análisis de créditos. | Confirmada |
| `operations_analysis_mo4` | Análisis y resumen de operaciones | Unidad, período, reporte MO4 | Conservar “MO4” como atributo del reporte a confirmar; no mezclarlo con el nombre canónico. | Revisar MO4 |
| `pymes_bonus_analysis` | Análisis de Bonis PYMES | Unidad, período, criterio de cálculo | “Bonis” puede ser nombre de sistema, beneficio o error. No corregir por inferencia. | Revisar término |
| `monthly_parts_metrics` | Cierre mensual de indicadores de repuestos | Unidad, período | Separado del cierre de indicadores de taller. | Confirmada |
| `monthly_workshop_metrics` | Cierre mensual de indicadores de taller | Unidad, período | Separado del cierre de indicadores de repuestos. | Confirmada |
| `cheque_nosis_verification` | Verificación de cheques en Nosis | Unidad, cheque, fecha | Corregir “CINTROL” como error de escritura; confirmar producto/flujo Nosis. | Revisar proceso |
| `customer_collections` | Registro de cobros de clientes | Unidad, cliente, medio, fecha | Cobro general no duplica caja sectorial ni aplicación a facturas. | Confirmada |
| `sector_cash_collections` | Registro de cobros de caja por sector | Unidad, sector, sucursal, fecha | Taller/repuestos/chapa son valores de sector, no títulos de tarea. | Revisar si se conserva un flujo común |
| `vehicle_cash_collection` | Registro de cobros en caja de operaciones de vehículos | Unidad, tipo de operación, sucursal/caja, medio, fecha | “VN/VO/PDA/PV” son dimensiones candidatas; queda separado del cobro general de vehículos hasta validar el diccionario. | Revisar siglas y flujo |
| `workshop_invoice_collection` | Cobro de facturas de taller | Unidad, cliente, factura, fecha | Separado del registro de factura y del cobro genérico hasta confirmar posible solapamiento. | Revisar solapamiento |
| `vehicle_collection` | Cobro de operaciones de vehículos | Unidad, tipo de operación, medio, fecha | “VN, VO, PDA” conservados como contexto; confirmar expansiones y si PDA es unidad/proceso. | Revisar siglas |
| `savings_plan_installment_collection` | Cobro de cuotas de planes de ahorro | Unidad, plan, cuota, período | No mezclar con carga de primeras cuotas. | Confirmada |
| `vehicle_exit_collection` | Cobro asociado a la salida diaria de vehículos | Unidad, vehículo/operación, fecha | Confirmar si es caja, liberación o sólo control de cobranza. | Revisar alcance |
| `coupon_settlement` | Registro de liquidación de cupones | Unidad, procesador, lote, fecha | Mercado Pago es procesador. “Cancelación de cupones” necesita aclarar si significa liquidación, cierre o anulación. | Revisar significado |
| `customer_refund_record` | Registro de devoluciones a clientes en banco y sistema | Unidad, cliente, movimiento bancario, sistema/operación, fecha | “Quiter” es posible nombre de sistema; confirmar escritura, flujo y si es carga o conciliación. | Revisar Quiter y alcance |
| `customer_receipt_application` | Aplicación de cobros de seguros a facturas pendientes | Unidad, aseguradora, factura, período | No es conciliación bancaria ni recepción de cobros. | Confirmada |
| `credit_operation_load` | Carga de operaciones de créditos prendarios | Unidad, financiera, operación, vehículo | Distinta de carga de liquidaciones de crédito. | Confirmada |
| `credit_settlement_load` | Carga de liquidaciones de créditos prendarios | Unidad, financiera (GPAT/BNA), operación, período | GPAT/BNA son parámetros de contraparte, no unidades de negocio. | Confirmada |
| `savings_plan_first_installment_load` | Carga de primeras cuotas de planes de ahorro | Unidad, plan, cuota, período | No es cobro de cuota. | Confirmada |
| `vehicle_model_change_payment` | Gestión del cambio de modelo y su pago | Unidad, operación, vehículo, fecha | Descomponer en dos códigos si gestión y pago son tareas separadas. | Revisar división |
| `vehicle_transfers_pda` | Registro de transferencias de VN, VO y PDA | Unidad, tipo de operación, medio, período | No expandir siglas; mantener separada de las transferencias de pago a proveedores. | Revisar siglas |
| `municipal_fees_accrual` | Registración de cánones municipales acumulados | Unidad, municipio, período | El original puede referirse a cálculo, devengamiento, pago o asiento. | Revisar significado |
| `service_register_update` | Actualización del tablero de servicios de internet | Unidad, proveedor, servicio/período | “Completar tablero” necesita confirmar si actualiza, concilia o controla facturas. | Revisar alcance |
| `supplies_purchase_control` | Compra y control de insumos | Unidad, categoría, proveedor, período | Informáticos y limpieza son categorías; confirmar que comparten flujo antes de compararlas entre sí. | Revisar agrupación |
| `cheque_operation_load` | Carga de cheques en operación | Unidad, operación, tipo de cheque, sistema | No asumir que “cheqs” son eCheq ni expandir “operación”. | Revisar término |
| `team_followup_review` | Revisión de seguimiento del equipo | Unidad/equipo, período | “Checkpoint supervisión” puede ser revisión periódica, no tarea operativa. | Revisar significado |
| `gm_collection_register` | Registro de cobros de GM | Unidad, entidad, medio, período | Confirmar GM y distinguir de cualquier integración/carga. | Revisar sigla |
| `dealer_credits_payment_load` | Carga de pagos PDA | Unidad, entidad/proceso, período | No expandir PDA ni inferir qué pagos se cargan. | Revisar significado |
| `supplier_payment_transfer_vn_vo_pda` | Carga de transferencias de VN/VO/PDA | Unidad, tipo de operación, medio, período | No expandir siglas; determinar si es una sola tarea o tres flujos. | Revisar siglas |
| `procedure_follow_up` | Control de trámites | Unidad, tipo de trámite, organismo o destino, período | Tarea visible como control recurrente; registrar movimientos, sin meta fija. | Confirmada |
| `payment_processing` | Procesamiento de pagos | Unidad, tipo de pago, medio, empresa o destinatario, período | Tarea visible como procesamiento recurrente; separada de pagos a proveedores y sueldos. | Confirmada |
| `monthly_accounting_close` | Cierre de cuentas mensuales | Unidad, empresa legal, período | Tarea de resultado mensual; separada de cierres de indicadores de repuestos/taller. | Confirmada |
| `vat_settlement_control` | Liquidación y control de IVA | Unidad, empresa legal, período, tipo de liquidación | Tarea de resultado visible; distinta de la registración contable de IVA. | Confirmada |

La lista refleja familias vistas en las capturas, no certifica todavía que cada
fila sea una función distinta del proceso real. Los ítems `Revisar` se ofrecen
como opciones provisionales con códigos propios, pero sus cantidades no se
comparan entre unidades hasta que se confirme el alcance. No se fusionan por
abreviaturas ni por alias. “Carga de otras facturas” exige subtipo para no
convertirse en una categoría residual sin detalle. Los siete nombres de unidades
son exactamente los proporcionados por el usuario; no se asignan tareas a
unidades por deducción.

## Reglas de medición

1. La clave de comparación será al menos `(taskCode, businessUnitCode, período)`;
   para tareas bancarias también `(bankCode, accountCode)`; para tareas con
   sucursales o sectores se conserva esa dimensión.
2. Las tareas de resultado se miden por estado/entrega y sus puntos según el
   estándar vigente. Las operativas se miden por movimientos y unidad (facturas,
   pagos, cuotas, etc.); no llevan meta fija ni barra porcentual inventada.
3. Sólo comparar cantidades cuando la unidad de medición sea igual. No sumar
   facturas, transferencias, cuotas y asientos como si fueran una métrica común.
4. Cambios al catálogo crean nueva versión efectiva; tareas y movimientos
   anteriores conservan código, versión y parámetros originales.
5. Una unidad de negocio faltante es `sin clasificar`; no completar mediante
   inferencia desde el nombre de usuario, equipo o empresa legal.

## Compatibilidad y alcance de implementación

### Catálogo V6 para dimensión bancaria (implementación local)

V6 conserva `gpar_bank_reconciliation` y agrega opciones controladas Banco
Francés (`frances`) y Banco Nación (`nacion`), sustentadas por nombres
observados en las fuentes existentes. “Conciliación Banco Francés”,
“CONC BANC FRANC” y “Conciliación Banco Nación” son búsquedas/presets del mismo
código; el banco persiste como dimensión separada. “Otro banco · pendiente de
normalizar” requiere un nombre y queda fuera de comparación. La lista no es
exhaustiva. Los parámetros V1–V5 permanecen intactos.

Estado de esta guía: cambios locales aún no publicados ni desplegados. Confirmar
suite, builds, revisión y CI antes de declarar el corte completo.

El catálogo Grupo París versión 5 ya está conectado en el laboratorio local:
primer ingreso, propuestas, aprobación, asignaciones, tareas materializadas y
analítica. La unidad (`businessUnitCode`) se conserva separada de la empresa
legal (`companyId`); nombres y códigos no son editables por quien registra el
trabajo. Banco y cuenta se solicitan aparte para conciliaciones. Las operativas
se miden por movimientos sin cuotas artificiales.

Las versiones 1 (50 tareas), 2 (55 tareas), 3 (55 tareas) y 4 (55 tareas) se
conservan para leer propuestas y trabajo ya guardado. La versión 5 ofrece las 55
tareas en el primer ingreso; 25 están habilitadas para comparar y 30 siguen
provisionales, separadas por código y excluidas de comparaciones entre unidades.
V4 eliminó el parámetro
libre `unidad` de registración contable de sueldos e IVA porque la unidad ya se
guarda en `businessUnitCode`; las versiones históricas mantienen ese campo para
validar registros anteriores. Las métricas conservan la versión y marcan las
filas provisionales. Los datos históricos sin código no se clasifican por el
título ni se reescriben.

V5 conserva el alias `CONC BANC FRANC` que V4 agregó para buscar Conciliación
bancaria. El alias conduce a la misma tarjeta y al mismo código canónico; nunca
se almacena como nombre de una tarea independiente.

V5 alineó dos criterios de comparación con la columna Estado de esta tabla:
`supplier_invoice_load` sigue disponible para registrar movimientos, pero queda
fuera de comparaciones entre unidades hasta confirmar el alcance de portales;
`customer_collections` queda habilitada para comparar cobros registrados. V1–V4
conservan sus criterios históricos; no se recalculan ni reclasifican sus
métricas.

Este cambio cubre sólo el laboratorio privado con datos ficticios. No modifica
SQL001–016, API operativa, Auth remoto ni el onboarding autenticado. La conexión
del frontend y el versionado del catálogo en backend requieren un contrato
remoto independiente antes de habilitar cuentas reales.

## Próxima revisión funcional

La versión 5 ofrece las 55 tareas observadas para registro: 25 comparables y 30
provisionales. Las versiones 1 (50 tareas), 2 (55 tareas), 3 (55 tareas) y 4
(55 tareas) se conservan para leer trabajo del laboratorio ya guardado. Los códigos
provisionales pueden registrar trabajo, pero quedan marcados como no
comparables entre unidades hasta que su alcance y unidad de medida se validen.

La revisión funcional debe concentrarse sólo en los términos marcados `Revisar`:
confirmar siglas PDA/PSA/MO4/VN/VO/GM, significado de “Bonis”, “cancelación de
cupones”, “canon acumulados”, “conjunta con caja”, “carga de pagos PDA” y el
alcance exacto de transferencias y cobros por sector. Hasta entonces no se
convierten en conceptos de análisis separados ni se les asigna unidad de negocio
por deducción.

### Auditoría de comparabilidad de las 30 tareas — 28/10/2026

Una revisión de sólo las definiciones del repo encontró tres candidatas a
comparar luego de normalizar también sus parámetros: `new_vehicle_invoice_load`
(marca/sucursal/etapa; no fusionar con recepción de 0 km),
`credit_cost_analysis` (línea/producto; conservar literalmente el contexto
“PSA”) y `operations_analysis_mo4` (comparar MO4 sólo con la misma clase de
reporte; no expandir la sigla). Todavía no se habilitan: los parámetros siguen
siendo texto libre y código/unidad/período por sí solos sería demasiado grueso.

Las otras 27 tareas provisionales permanecen fuera de comparación hasta aclarar
su alcance, siglas o solapamientos: `supplier_invoice_load`,
`invoice_load_other`, `service_invoice_load`, `supplier_payment`,
`bank_transfer_register`, `supplier_payment_transfer`,
`dealer_credits_payment_load`, `inventory_adjustment`, `service_register_update`,
`supplies_purchase_control`, `cheque_nosis_verification`, `vehicle_collection`,
`sector_cash_collections`, `vehicle_cash_collection`,
`workshop_invoice_collection`, `vehicle_exit_collection`,
`customer_refund_record`, `coupon_settlement`, `pda_result_adjustment`,
`pymes_bonus_analysis`, `municipal_fees_accrual`,
`vehicle_model_change_payment`, `vehicle_transfers_pda`,
`supplier_payment_transfer_vn_vo_pda`, `cheque_operation_load`,
`team_followup_review` y `gm_collection_register`. Siguen disponibles para
registrar trabajo; no se inventan definiciones para habilitar gráficos.
