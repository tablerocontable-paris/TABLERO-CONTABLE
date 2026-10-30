# Ficha de homologación de tareas — 29/10/2026

## Para qué sirve

Esta ficha reúne las decisiones funcionales pendientes para comparar tareas
entre PARIS AUTOS, DORAL, PARIS CARS, PARIS TRAC, MOTOR, FIDEICOMISO
DESARROLLO y POSTVENTA. Parte del catálogo V7 y de los términos observados en
el material enviado; **no asigna tareas a unidades por inferencia ni completa
datos que no aparecen en esas fuentes**.

Las 30 tareas listadas siguen provisionales y excluidas de comparaciones entre
unidades. Completar esta ficha no cambia el catálogo automáticamente. Primero
se documenta el proceso; luego se revisan código, parámetros, unidad de medida,
versionado y pruebas antes de habilitar una comparación.

## Datos mínimos para cada tarea

Para cada código, responder:

1. **Unidad/es de negocio:** marcar de la lista oficial las unidades donde se
   realiza el proceso. Si una sigla identifica una unidad, escribir su nombre
   completo y fuente de confirmación.
2. **Alcance:** qué pasos concretos incluye la tarea y qué pasos quedan fuera;
   quién recibe el trabajo y qué resultado permite considerarla terminada.
3. **Medición:** qué movimiento se cuenta (por ejemplo, factura, pago, cheque,
   transferencia, asiento o análisis), en qué unidad y si el mismo conteo tiene
   igual significado en todas las unidades marcadas.
4. **Parámetros:** indicar cuáles se necesitan para distinguir el trabajo
   (empresa legal, sucursal, sector, banco/cuenta, sistema, proveedor,
   contraparte, tipo de operación, período u otros). Los parámetros no cambian
   el nombre ni el código canónicos.
5. **Solapamientos:** indicar si el flujo ya está incluido en otra tarea de la
   lista y si son etapas separadas hechas por personas diferentes.
6. **Respaldo:** nombre o referencia del procedimiento, formulario, reporte o
   ejemplo ficticio que permita corroborar la respuesta. No adjuntar datos de
   clientes ni credenciales.

Si un campo sigue sin confirmación, registrar `Pendiente`. No inventar una
unidad de negocio, término expandido, etapa, volumen ni equivalencia.

## Preguntas pendientes por tarea

### Confirmaciones rápidas de unidad observada

El catálogo contiene estas menciones explícitas. Son candidatas, no una matriz
aprobada. Para acelerar la validación, cada par puede responderse como
**Confirmar**, **Corregir** (indicar unidad correcta) o **No se usa**. Aun si se
confirma el par, las preguntas de alcance y medición de abajo siguen aplicando
antes de habilitar comparaciones.

| Código | Par candidato observado | Confirmación |
|---|---|---|
| `gpar_bank_reconciliation` | PARIS AUTOS | Pendiente |
| `parts_invoice_load` | PARIS CARS | Pendiente |
| `salary_accounting_entry` | PARIS AUTOS; PARIS TRAC | Pendiente por unidad |
| `vat_accounting_entry` | DORAL; PARIS AUTOS; PARIS CARS; PARIS TRAC | Pendiente por unidad |
| `coupon_settlement` | PARIS CARS; PARIS AUTOS | Pendiente por unidad y alcance |

No hay pares candidatos expandidos registrados todavía para las otras tareas.
Eso significa “sin evidencia textual directa suficiente”, no “la unidad no
realiza la tarea”. Hay una pista ambigua que no cuenta como par confirmado:
`new_vehicle_invoice_load` tiene el alias “carga factura VN PA”; confirmar qué
significan `VN` y `PA` en ese flujo antes de asociarla a una unidad.

### Facturas, inventario y compras

- [ ] **`supplier_invoice_load` — Carga de facturas de proveedores.** ¿La carga
  desde GM, Chevrolet y portal Stellantis sigue el mismo flujo y controles?
  ¿Qué unidad de medida común sirve (facturas, comprobantes u otra)? Indicar
  portales/proveedores como parámetros y separar la tarea si los pasos cambian.
- [ ] **`new_vehicle_invoice_load` — Carga de facturas de vehículos nuevos.**
  ¿“VN” significa vehículos nuevos y “PA” PARIS AUTOS en el alias “carga
  factura VN PA”? Confirmar ambos términos para este flujo. ¿Qué distingue esta
  carga de recibir/registrar la factura al ingresar un 0 km? Definir inicio,
  fin, unidad de conteo, marcas y sucursales usadas.
- [ ] **`service_invoice_load` — Carga de facturas de proveedores de servicios.**
  ¿Qué significa “conjunta con caja”: coordinación entre dos responsables,
  una tarea compartida o un único ejecutor? Describir el traspaso y quién
  realiza cada paso.
- [ ] **`invoice_load_other` — Carga de otras facturas.** ¿Qué tipos concretos
  entran aquí después de excluir proveedores, repuestos, vehículos nuevos y
  servicios? Definir opciones obligatorias para que no funcione como categoría
  residual sin detalle.
- [ ] **`inventory_adjustment` — Ajustes de inventario.** ¿Incluye recuento,
  análisis de diferencias y asiento, o sólo registrar un ajuste aprobado?
  Indicar qué unidad se cuenta y si los pasos deben ser tareas distintas.
- [ ] **`service_register_update` — Actualización del tablero de servicios de
  internet.** ¿“Completar tablero” significa actualizar datos, conciliar
  facturas o controlar vencimientos? Indicar producto de salida y unidad de
  medición.
- [ ] **`supplies_purchase_control` — Compra y control de insumos.** ¿Insumos
  informáticos y de limpieza comparten responsable, circuito y resultado?
  Si difieren, indicar categorías o procesos separados.

### Pagos, bancos y cheques

- [ ] **`supplier_payment` — Preparación y registro de pagos a proveedores.**
  ¿Preparar, autorizar, ejecutar y registrar son etapas de personas distintas?
  Marcar cuáles se realizan y qué hecho se cuenta como movimiento.
- [ ] **`bank_transfer_register` — Registro de transferencias bancarias.**
  ¿Sólo registra una transferencia ya ejecutada o también la prepara/ejecuta?
  Indicar cómo se distingue de pagos a proveedores.
- [ ] **`supplier_payment_transfer` — Transferencias de pago a proveedores.**
  ¿Es un proceso separado del pago genérico por tener autorización o controles
  propios? Definir qué evento se cuenta y qué parámetros lo identifican.
- [ ] **`dealer_credits_payment_load` — Carga de pagos PDA.** ¿Qué significa
  PDA en este contexto y qué pagos se cargan? Describir origen, destino y
  resultado; conservar la sigla literal hasta confirmarla.
- [ ] **`supplier_payment_transfer_vn_vo_pda` — Carga de transferencias de
  VN/VO/PDA.** ¿VN, VO y PDA son clases de operación, sectores o unidades?
  ¿Comparten un mismo proceso y medida? Confirmar cada significado sin
  expandirlo por suposición.
- [ ] **`cheque_operation_load` — Carga de cheques en operación.** ¿Qué
  significa “en operación” y dónde se cargan? ¿Incluye cheques físicos,
  eCheq o ambos? Indicar si “cheqs” es sólo una abreviatura y no una clase.
- [ ] **`cheque_nosis_verification` — Verificación de cheques en Nosis.**
  ¿Cuál es el procedimiento y qué resultado se registra (consulta, cheque
  validado, informe)? Confirmar el producto Nosis y la unidad de conteo.

### Cobros, devoluciones y cupones

- [ ] **`sector_cash_collections` — Registro de cobros de caja por sector.**
  ¿Taller, repuestos y chapa comparten controles y unidad de medición? Indicar
  si el sector es parámetro de un único proceso o si hay circuitos distintos.
- [ ] **`vehicle_cash_collection` — Registro de cobros en caja de operaciones
  de vehículos.** ¿Qué significan VN, VO, PDA y PV en este flujo? ¿Es el mismo
  circuito que `vehicle_collection`? Enumerar evento contado y parámetros.
- [ ] **`vehicle_collection` — Cobro de operaciones de vehículos.** Definir
  qué operación se cobra, qué marca el cobro realizado y qué significan VN,
  VO y PDA. Comparar explícitamente con las otras dos tareas de cobros de
  vehículos.
- [ ] **`workshop_invoice_collection` — Cobro de facturas de taller.** ¿Es
  una etapa separada del cobro general por cliente o una subclase? Indicar si
  se mide por factura saldada, recibo emitido u otro evento.
- [ ] **`vehicle_exit_collection` — Cobro asociado a la salida diaria de
  vehículos.** ¿Se trata de cobrar, liberar la unidad o controlar que el cobro
  ya ocurrió? Definir quién ejecuta el paso y qué evento se cuenta.
- [ ] **`customer_refund_record` — Registro de devoluciones a clientes en banco
  y sistema.** Confirmar el nombre del sistema (“Quiter”) y si la tarea registra
  una devolución ya hecha o procesa el reintegro. Precisar cómo se vinculan el
  movimiento bancario y el registro interno.
- [ ] **`coupon_settlement` — Registro de liquidación de cupones.** ¿“Cancelar
  cupones” significa liquidar, cerrar lote o anular? Indicar procesador,
  identificador de lote y resultado que se cuenta.
- [ ] **`gm_collection_register` — Registro de cobros de GM.** ¿Qué entidad o
  concepto representa GM? Describir el origen del cobro, el paso registrado y
  cómo se diferencia de otras cobranzas.

### Análisis, ajustes y cierres

- [ ] **`credit_cost_analysis` — Análisis de costo de créditos.** ¿Qué
  producto/línea identifica “PSA”? Indicar qué reporte se produce y qué unidad
  comparable se mide (crédito, operación, período u otra).
- [ ] **`operations_analysis_mo4` — Análisis y resumen de operaciones.** ¿Qué
  reporte exacto se denomina MO4? Aportar su clase o período y confirmar si dos
  reportes MO4 de distintas unidades miden la misma actividad.
- [ ] **`pda_result_adjustment` — Ajuste de resultados PDA.** ¿Qué representa
  PDA y qué se ajusta: resultado, cuenta, asiento o reporte? Describir el
  antes/después que determina una unidad de trabajo.
- [ ] **`pymes_bonus_analysis` — Análisis de Bonis PYMES.** ¿“Bonis” es el
  nombre de un sistema, beneficio o término distinto? Indicar cálculo, período,
  resultado y unidad de medición.
- [ ] **`municipal_fees_accrual` — Registración de cánones municipales
  acumulados.** ¿La tarea calcula, devenga, paga o asienta el canon? Precisar
  cuál es el paso del puesto y cómo se cuenta.
- [ ] **`vehicle_model_change_payment` — Gestión del cambio de modelo y su
  pago.** ¿La gestión administrativa y el pago los realizan la misma persona
  como un único circuito? Si son etapas separadas, describir cada responsable,
  resultado y medida.
- [ ] **`vehicle_transfers_pda` — Registro de transferencias de VN, VO y PDA.**
  Confirmar VN/VO/PDA y si el flujo registra transferencias entre cuentas,
  unidades, operaciones u otro objeto. Comparar con transferencias a
  proveedores.
- [ ] **`team_followup_review` — Revisión de seguimiento del equipo.** ¿Es un
  checkpoint periódico de supervisión, una tarea asignable a una persona o un
  módulo/reporte? Indicar la unidad de trabajo si corresponde.

## Resultado de la homologación

Completar por tarea después de reunir evidencia:

```text
Código:
Unidad/es confirmadas:
Fuente de confirmación:
Incluye:
Excluye:
Responsable(s) / traspasos:
Evento o resultado que se cuenta:
Unidad de medida:
Parámetros controlados necesarios:
Tareas con las que se comparó para evitar duplicados:
Decisión: mantener / dividir / fusionar como alias / renombrar / pendiente
Comparación entre unidades: habilitada / pendiente
Motivo y versión efectiva:
```

Una respuesta puede confirmar varias tareas si describe explícitamente cada
código y su alcance. No basta con confirmar que dos títulos “suenan igual”:
deben compartir flujo, resultado y unidad de medida. Toda división, fusión o
cambio de medida requiere una nueva versión del catálogo; nunca reescribe
trabajo ni análisis históricos.
