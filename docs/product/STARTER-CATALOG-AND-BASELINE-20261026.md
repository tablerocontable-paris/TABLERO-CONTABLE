# Catálogo inicial y estimación de línea base — 26/10/2026

## Propósito

Definir conceptos neutrales y comprensibles para el primer inicio de una
organización nueva. No son tareas asignadas automáticamente ni una afirmación
de que todas las organizaciones realizan estos procesos. Jefatura debe elegir
los procesos pertinentes, completar empresas/unidades y confirmar la inducción
antes de crear trabajo.

| Concepto inicial | Tipo | Unidad sugerida | Qué significa |
|---|---|---|---|
| Conciliación de cuenta bancaria | Entregable | Cuenta y período | Comparar movimientos del extracto con registros contables, documentar diferencias y dejar revisión trazable. |
| Preparación y control de obligaciones fiscales | Entregable | Obligación y período | Revisar documentación, cálculos y vencimiento; dejar constancia del control y de la presentación cuando corresponda. |
| Registro de comprobantes | Operativa | Comprobantes | Registrar comprobantes recibidos o emitidos con referencia suficiente para encontrarlos después. |
| Gestión y seguimiento de trámites | Operativa | Trámites | Iniciar, controlar y actualizar trámites administrativos o fiscales, conservando identificador y estado. |
| Procesamiento y control de pagos | Operativa | Pagos | Procesar pagos autorizados y registrar fecha, referencia y resultado. |
| Cierre contable por empresa | Entregable | Empresa y período | Revisar saldos, documentar ajustes y dejar un cierre revisable para cada empresa/período. |

Las unidades son sugerencias de configuración, no metas. Para operativas, el
registro informa cantidad/movimientos, tiempo y carga ponderada sólo si existe
un coeficiente versionado aprobado. No crear una barra contra meta. Los
entregables conservan checklist y puntos según la regla aprobada por jefatura.
La obligación fiscal concreta, norma, fecha y responsable se parametrizan por
organización: el catálogo base nunca inventa un vencimiento.

## Lógica del primer inicio

1. Crear la organización y su configuración regional/horaria.
2. Crear jefatura y verificar autenticación reforzada.
3. Registrar empresas, equipos y membresías confirmadas.
4. Elegir/editar conceptos del catálogo y sus unidades; revisar versiones y
   responsables.
5. Cada usuario revisa la propuesta de trabajo por empresa y período.
6. Jefatura valida y aprueba; sólo la aprobación explícita materializa tareas.

No poblar usuarios con nombres del seed ficticio ni copiar perfiles desde el
navegador al sistema autenticado. No asignar automáticamente las seis filas a
cada persona. Una organización puede descartar o agregar conceptos antes de
aprobar su estándar.

## Línea base disponible y límites

La única cifra reproducible antes de conectarse a una fuente real procede de
`seed()` en `src/data/repository.ts:41-224`:

- 13 perfiles ficticios: 1 jefe, 2 encargados y 10 empleados.
- 4 empresas ilustrativas.
- 6 conceptos actuales del seed: 3 entregables y 3 operativas.
- 73 ocurrencias mensuales de demostración al materializar el primer seed.
- 0 cuentas reales representadas y 0 medición verificada de cumplimiento diario
  en ese seed. La demo genera tareas, fechas y movimientos ficticios; no debe
  comunicarse como producción ni como trabajo efectivamente realizado.

La muestra de primer arranque se genera únicamente si el navegador no tiene
estado de laboratorio (`paris-state-lab`). Un navegador ya utilizado puede
mostrar otro volumen. GitHub no contiene ese estado. Para estimar el estado
actual del trabajo se necesita un extracto autorizado de la aplicación fuente,
anonimizado antes de compartirlo y con período de corte acordado. El conteo
deberá separar:

- personas activas únicas (ID estable, no nombre);
- ocurrencias de tareas únicas por ID y período;
- tareas completadas según estado y timestamp real de cierre;
- movimientos operativos, que son cantidades y no tareas completadas;
- tareas anuladas, transferidas, conjuntas y reabiertas, sin duplicarlas.

Sin esa fuente no corresponde estimar tareas reales cumplidas al día de hoy.

## Compatibilidad

El catálogo de esta propuesta se documenta, pero no sustituye los seis IDs,
nombres, snapshots ni respaldos legacy de `seed()` en esta etapa. Al implementar
el onboarding autenticado debe guardarse como una nueva versión de plantilla y
conservar las versiones anteriores en históricos y restauraciones. La aceptación
requiere pruebas de: alta desde organización vacía, edición/descartado de
conceptos, aprobación idempotente, cero asignaciones antes de aprobar y
preservación de estados/respaldo anteriores.
