# Estimación local de dotación y trabajo

## Propósito y límites

Este utilitario permite calcular, a partir de un extracto que la persona
responsable prepara y guarda localmente, personas activas, tareas por estado,
tareas que siguen completadas al corte, eventos de cierre/reapertura y
movimientos operativos por unidad. No consulta GitHub, Sites, Supabase ni otros
servicios. No interpreta capturas, títulos libres ni datos ficticios como cifras
de la organización. Hasta procesar un extracto vigente, la cantidad real de
personas y tareas completadas hoy sigue **sin determinarse**.

La seudonimización reduce exposición pero no garantiza anonimato: las fechas,
relaciones y patrones poco frecuentes aún pueden reidentificar. Por eso el
extracto original, los CSV seudonimizados, la clave y cualquier tabla de mapeo
deben permanecer en `private-data/` y nunca subirse ni compartirse. El resumen
agregado puede revisarse aparte; se debe comprobar que no permita identificar a
personas en grupos pequeños.

## Cómo preparar la entrada

1. Copiar las cuatro plantillas vacías desde `templates/workforce-estimate/source/`
   a `private-data/source/`.
2. Completar los archivos usando identificadores estables de origen (UUID u
   otros IDs opacos), no nombres ni correos. Mantener la correspondencia en una
   tabla local aparte si hace falta. No incluir nombres de empresas, personas,
   tareas originales, comentarios, notas, referencias, adjuntos ni importes.
3. Incluir un corte temporal explícito y usar el mismo instante para determinar
   el estado de cada tarea. En personas, una fila representa un intervalo de
   actividad; se permiten varias altas/bajas no superpuestas para la misma ID.
4. Transformar cada tarea a uno de los códigos neutros cerrados descritos abajo.
   Lo dudoso va como `other_pending_review` y se aclara antes de interpretar el
   resultado. No se debe deduplicar ocurrencias por título.
5. Las fechas de evento deben incluir zona (`Z` o desfase); `scheduled_at` usa
   `YYYY-MM-DD`. La zona IANA del cálculo determina qué significa “hoy”.

Esquema completo:

- `people.csv`: una fila por intervalo activo, `source_person_id`, `active_from`,
  `active_until` (vacío si continúa activo).
- `tasks.csv`: una fila por ocurrencia y corte; identificador estable, período
  `YYYY-MM`, concepto neutral, estado, responsable si corresponde, fecha
  programada, última finalización, anulación y claves de tarea conjunta/cobertura.
- `task-events.csv`: historial de finalizaciones, reaperturas, cancelaciones y
  restauraciones, cada evento con ID propio, ocurrencia y fecha.
- `movements.csv`: un movimiento por fila con IDs estables, persona ejecutora,
  fecha, cantidad decimal positiva y unidad neutra.

Catálogo de conceptos admitidos: `bank_reconciliation`, `payment_processing`,
`cash_reconciliation`, `collections_tracking`, `card_coupon_settlement`,
`customer_refunds`, `cheque_tracking`, `credit_operations`, `receipt_application`,
`payment_platform_reconciliation`, `payment_plan_tracking`,
`document_recording`, `document_organization`, `accounting_entries`,
`payroll_records`, `tax_obligations`, `company_accounting_close`,
`inventory_control`, `accounting_adjustments`, `cost_analysis`,
`operations_analysis`, `monthly_indicator_close`, `procedure_tracking`,
`team_review`, `service_register_update`, `supplies_control` y
`other_pending_review`.

Unidades admitidas: `invoice`, `payment`, `collection`, `settlement`, `refund`,
`cheque`, `installment`, `document`, `entry`, `employee_record`,
`tax_obligation`, `company_close`, `inventory_item`, `adjustment`, `procedure`,
`service_record`, `supply_item`, `operation`, `movement` y `other`. Si el origen
requiere otra unidad, primero debe revisarse y agregarse explícitamente al
contrato; nunca se copia el rótulo original.

## Ejecución (Windows PowerShell)

El runtime Node incluido en la PC del trabajo alcanza; no hace falta instalar
npm ni depender de permisos de administrador. Desde la raíz `work/site`:

```powershell
node scripts/workforce-estimate.mjs --create-key private-data/pseudonym.key
node scripts/workforce-estimate.mjs --mode anonymize --input-dir private-data/source --output-dir private-data/anonymized --key-file private-data/pseudonym.key
node scripts/workforce-estimate.mjs --mode estimate --input-dir private-data/anonymized --cutoff 2026-10-27T23:59:59-03:00 --timezone America/Argentina/Buenos_Aires
```

Usar un corte real y actual al ejecutar; la fecha del ejemplo no es una
instrucción de corte. El proceso no reemplaza carpetas de salida existentes. La
clave se crea una vez y se conserva privada; perderla cambia todos los
seudónimos en futuras exportaciones.

## Significado del resultado

- `activePeople`: IDs únicos con intervalo vigente en el instante de corte.
- `taskCount` y `tasksByStatus`: ocurrencias lógicas incluidas en el extracto;
  las filas que comparten `joint_group_id` se cuentan una vez. `taskAssignmentCount`
  informa la cantidad de filas/asignaciones fuente por separado. Un grupo
  conjunto con período, concepto o estado distintos se rechaza para revisión.
- `completedTasksStillCompletedAtCutoff`: ocurrencias cuya última finalización
  cae en la fecha local del corte y siguen completas a ese instante.
- `completionEvents` y `reopenEvents`: eventos ocurridos durante la fecha local,
  incluyendo intentos repetidos. Se muestran aparte del resultado final.
- `operationalMovementCount` y `operationalQuantityByUnit`: registros de
  movimientos y suma exacta de cantidad por unidad. Un movimiento nunca se
  cuenta automáticamente como una tarea finalizada.

Para trabajar con asignaciones compartidas, mantener una fila por asignación y
reutilizar la misma `source_joint_group_id` en participantes de una ocurrencia;
el reporte deduplica la tarea por ese grupo, pero mantiene sus asignaciones en
`taskAssignmentCount`. `source_coverage_id` permite
identificar ejecuciones durante cobertura; el autor se registra por movimiento.
El reporte actual no desglosa resultados por persona ni equipo para limitar
riesgo de reidentificación.

## Pruebas y traslado

Las pruebas usan personas y tareas sintéticas. Antes de usar un export real,
validar localmente permisos, definiciones de estado y completitud del historial.
Subir a GitHub sólo este código, plantillas vacías, contrato y evidencia
agregada revisada; no subir la carpeta `private-data/`, la clave, extractos ni
capturas. GitHub sirve para continuar el desarrollo en otra PC, pero no
sincroniza memoria global de Codex, conversaciones completas, credenciales,
sesiones de navegador, estado local del Site ni anotaciones privadas. Las
decisiones útiles y seguras deben registrarse en los documentos del proyecto,
no mediante volcados indiscriminados de datos privados.
