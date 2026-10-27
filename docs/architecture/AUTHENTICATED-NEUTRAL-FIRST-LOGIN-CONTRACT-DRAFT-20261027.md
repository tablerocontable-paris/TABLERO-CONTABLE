# Contrato borrador — primer ingreso autenticado y conceptos neutrales

Fecha: 27/10/2026
Estado: diseño pendiente de revisión; no habilita Auth, API, invitaciones ni producción.

## Evidencia actual

### Clasificación local, 27/10/2026

En el laboratorio, las 26 sugerencias v2 ya tienen una asignación uno a uno a
un código neutral estable en `src/domain/workforceTaxonomy.mjs`. El código y
`taxonomyVersion=2` acompañan el borrador, los envíos y revisiones de una
propuesta, y su aprobación local los copia a la versión de catálogo, asignación
y ocurrencias materializadas. El almacenamiento valida la pareja código/versión
y la coherencia entre sugerencia, plantilla, asignación y tarea. Las filas
históricas pueden seguir sin clasificación; no se completan por similitud de
título.

Esta mejora sólo cubre los modelos del laboratorio y el estimador local. El
flujo de primer ingreso autenticado sigue sin conexión y su esquema remoto no
se modificó: la identidad/versión neutral aún requiere contrato de API y una
migración nueva, revisada, antes de persistirla en Supabase.

- `NEUTRAL_STARTER_SUGGESTIONS` v2 contiene 26 sugerencias y coincide con las
  26 filas de `TASK-NORMALIZATION-DRAFT-20261026.md`.
- `Onboarding.tsx` oculta las sugerencias cuando `remote` está activo. El
  primer ingreso autenticado no está conectado al flujo de primer ingreso.
- El contrato remoto `onboardingDraftV2Schema` guarda cada línea como
  `lineId/companyId/teamId/source/schedule`. `source` sólo admite una versión
  publicada del catálogo o una definición personalizada. No conserva la
  identidad ni versión de un concepto neutral.
- La definición personalizada del flujo remoto sólo se admite para frecuencia
  única. Una propuesta recurrente debe basarse en una versión publicada del
  catálogo organizacional.
- Supabase SQL014 ya contiene operaciones autenticadas de guardado revisionado,
  envío, solicitud de cambios, consulta y aprobación. La aprobación está
  restringida a jefatura con AAL2 y crea asignaciones/tareas en una operación
  transaccional. El nuevo flujo debe reutilizar y probar estos controles, no
  reemplazarlos.
- SQL001–016 está instalada en DEV. No editar ni volver a aplicar esas
  migraciones; un cambio de esquema requiere una migración nueva, exacta y
  revisada.

## Catálogo neutral, versión 2

La identidad de reporte es un código estable, sin título libre, empresa,
persona, alias ni datos de cliente. `taxonomyVersion=2`. El título puede
acortarse o adaptarse en la interfaz sin cambiar el código. No se asigna un
código automáticamente por similitud de título; si no se puede decidir, se
mantiene sin clasificar hasta revisión.

| Concepto neutral v2 | Código para clasificar |
|---|---|
| Conciliación de cuenta bancaria | `bank_reconciliation` |
| Procesamiento y control de pagos | `payment_processing` |
| Arqueo y control de caja | `cash_reconciliation` |
| Registro y seguimiento de cobranzas | `collections_tracking` |
| Registro y control de liquidaciones de tarjetas y cupones | `card_coupon_settlement` |
| Registro de devoluciones a clientes | `customer_refunds` |
| Registro y control de cheques | `cheque_tracking` |
| Registro y control de operaciones de crédito | `credit_operations` |
| Aplicación y compensación de cobros | `receipt_application` |
| Conciliación de plataformas de cobro | `payment_platform_reconciliation` |
| Registro y control de cuotas de planes | `payment_plan_tracking` |
| Registro de comprobantes | `document_recording` |
| Archivo y organización de documentación | `document_organization` |
| Registro y control de asientos contables | `accounting_entries` |
| Registro y control de información de sueldos | `payroll_records` |
| Preparación y control de obligaciones fiscales | `tax_obligations` |
| Cierre contable por empresa | `company_accounting_close` |
| Control y ajuste de inventario | `inventory_control` |
| Preparación y registro de ajustes contables | `accounting_adjustments` |
| Análisis de costos de operaciones | `cost_analysis` |
| Análisis y resumen de operaciones | `operations_analysis` |
| Cierre mensual de indicadores | `monthly_indicator_close` |
| Gestión y seguimiento de trámites | `procedure_tracking` |
| Revisión de seguimiento del equipo | `team_review` |
| Actualización del registro de servicios | `service_register_update` |
| Compra y control de insumos | `supplies_control` |

`other_pending_review` es una salida de análisis para ocurrencias cuyo concepto
no puede establecerse; no es una sugerencia preseleccionable ni un sustituto de
esta taxonomía.

## Flujo esperado por rol

| Etapa | Quién | Comportamiento obligatorio |
|---|---|---|
| Preparar procesos | Jefatura | Publica versiones del catálogo y confirma código neutral, empresa, unidad, controles, peso/regla de medición y vigencia. Un borrador no se puede elegir como trabajo. |
| Primer ingreso | Empleado | Ve conceptos y nombres breves con ejemplos desplegables. Elige opcionalmente sólo procesos publicados y autorizados por membresías activas de empresa/equipo. No recibe datos ni notas de otros perfiles. |
| Guardar borrador | Empleado | Usa `onboarding.saveDraft` con revisiones esperadas; recupera el borrador después de reconexión. Mantiene la identidad de la definición publicada y su código neutral. |
| Enviar | Empleado | Usa `onboarding.submit`; el snapshot enviado no se modifica en el lugar. Enviar no crea tareas. |
| Solicitar cambios | Encargado de equipo / jefatura | Usa el comando existente y sólo dentro del alcance autorizado. La respuesta es visible para el autor de la propuesta. El encargado no aprueba. |
| Aprobar y crear | Jefatura | Revisa conceptos, empresa, equipo, período, recurrencia, controles y métricas; con AAL2 aprueba una revisión concreta. Sólo la aprobación puede publicar configuraciones y crear asignaciones/tareas, idempotentemente. |

Si la organización aún no tiene procesos publicados, el empleado ve un estado
de espera entendible; la inducción no inventa tareas ni asigna defaults. Se
admite continuar sin seleccionar propuestas cuando las reglas de producto lo
permitan. El texto libre se mantiene como propuesta sin clasificar hasta que
jefatura lo revise. No copiar alias u observaciones privadas al catálogo global.

## Datos que debe preservar la integración

El siguiente contrato debe conservar para cada definición aprobada:

- `neutralConceptCode` y `taxonomyVersion` inmutables junto con la versión de
  catálogo;
- título/objetivo y parámetros organizacionales editables por versión;
- referencia de la línea de onboarding a la versión de catálogo aprobada;
- clasificación copiada o resoluble desde una referencia histórica inmutable en
  asignación/ocurrencia, incluso si una versión posterior cambia el proceso;
- unidad cuantitativa sólo para actividades operativas y controles para
  entregables; no convertir operativas en metas de finalización;
- empresa, equipo, responsable y período validados en servidor; identidad del
  actor siempre derivada de la sesión Auth.

El campo de clasificación debe ser nullable para datos históricos sin evidencia.
No backfillear por similitud de título, no recalcular historia, y exponer en
informes por separado el volumen clasificado y el que queda pendiente de
revisión.

## Puertas de implementación y aceptación

1. Confirmar el modelo de identidad/versionado en un contrato revisado antes de
   cambiar el esquema. Preservar compatibilidad v1/v2 o agregar una versión de
   protocolo explícita; no agregar silenciosamente campos a objetos `exact`.
2. Crear migración nueva con clasificación inmutable/versionada; actualizar
   tipos, validación de payloads, proyecciones y transporte autenticado.
3. Integrar UI de primer ingreso y bandeja de aprobación con los comandos y
   consultas existentes. No conectar este flujo al estado D1/Site del
   laboratorio.
4. Probar todos los roles, empresas/equipos ajenos, AAL2, reintentos, doble
   envío, borrador concurrente, cambios solicitados, revocación de membresía,
   sin catálogo publicado, 26 conceptos y cambios de versión. Asegurar que el
   envío no crea trabajo y que la aprobación crea una sola vez.
5. Probar DEV con identidades Auth ficticias y sin datos reales. Mantener Auth
   operativo apagado y el Site privado hasta aceptar toda la etapa y verificar
   la PC personal.

## Fuera de esta evidencia

No existe un extracto autorizado que permita contar personas o tareas actuales.
Capturas, seed y snapshot viejo sólo describen muestras del laboratorio; no son
una estimación de la organización. El estimador local sigue disponible, pero
los datos de entrada, clave y extractos seudonimizados deben permanecer fuera
de GitHub. Las cifras se informarán sólo después de validar cobertura,
permisos, zona horaria, asignaciones conjuntas, re-aperturas y actividad real.
