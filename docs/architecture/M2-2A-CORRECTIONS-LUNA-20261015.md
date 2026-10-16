# M2.2A: contrato de correcciones — 15/10/2026

Implementación: **GPT-6 Luna, esfuerzo medio, Standard**. Revisar primero
M2-2A-REVIEW-20261015.md y el contrato original de A. Los hallazgos y decisiones
de este documento completan ese contrato; no habilitan B/C ni un despliegue.

## Alcance

Modificar únicamente 014 todavía local, DTO operacional, pruebas/runners y
documentación de esta fase. Preservar 001–013, UI, Worker/D1, Site y datos reales.
No instalar dependencias. No eliminar, truncar o normalizar datos legacy para
hacer pasar una migración. Las sondas independientes deben pasar por el arreglo
de producto, conservando sus expectativas.

## R1: orden de coordinación y autorización

1. La validación optimista del contexto puede leer al entrar. No tomar locks de
   filas de perfil/ámbito antes de la coordinación que la operación necesitará.
   En escrituras: recibo 1101 → actores 1102 → perfiles 1103 → meses 1104 →
   catálogo 1105 → filas canónicas. Mantener fence de operationId después de
   1101, serialización de tasas y fences de mes.
2. Revalidar el perfil con lock de fila después de adquirir coordinación. Si
   cambió tras un snapshot RR, abortar 40001; en RC, denegar el permiso revocado.
   No quitar la protección que resolvió la baja y el cierre con snapshots RR.
3. Aplicar el orden al replay autorizado. Su coordinación mínima debe proteger
   actor/ámbito sin volver a ejecutar el comando ni exigir la revisión o mes del
   éxito original. Permiso vigente + argumentos idénticos devuelve el recibo
   original; permiso revocado no lo entrega. No crear un orden inverso en las
   consultas o commandReceipt al reutilizar helpers.
4. La sonda nativa `--m2-2a-independent yes` debe dejar de producir 40P01.
   Ampliarla para comprobar que el registro que pierde ante la baja termina
   42501/40001 y no crea actividad, recibo ni auditoría parcial. Incluir replay.
   No capturar 40P01 y convertirlo en éxito ni modificar el test para admitirlo.

## R2: upgrade y escritores legacy

Las restricciones de `measurement_version=1` deben conservar la semántica
histórica de `trim` sobre espacios ASCII y reference NOT NULL. TAB/LF, NBSP y
otras referencias que 013 admite se preservan literalmente. No aplicarles la
nueva normalización ECMAScript ni un máximo nuevo. V2 conserva referencia
opcional, normalizada y limitada a 2000 caracteres. No relajar el writer legacy.
Demostrar upgrade poblado con esas referencias, además de los snapshots y las
colecciones ya cubiertas. Si el upgrade falla, demostrar rollback íntegro.

## R3/R4: protocolo estricto y fechas

- Rechazar SQL NULL, JSON null, campos ausentes y tipos incorrectos de envelope,
  kind, payload, revisiones, filters y cursores con 22023 genérico. Usar
  comparaciones NULL-safe para los tipos y comprobar que exact_keys es TRUE.
  Un kind textual desconocido conserva 0A000; null no es un kind desconocido.
- Validar limit como entero 1–100 antes de un cast que pueda desbordar, o usar
  el helper protegido. No filtrar valores, errores internos o texto de payload
  en la respuesta de error.
- Cursores: claves exactas, tipos exactos, kind/filtros iguales a la query,
  UUID canónicos, revisiones canónicas y timestamps ISO con zona, válidos y
  finitos. Rechazar null, infinity y atajos SQL como epoch. Mantener paginación
  descendente keyset y los cursores producidos por el servidor.
- Años civiles 0001–9999 en el decoder y SQL. Rechazar 0000 y fechas imposibles;
  conservar meses bisiestos válidos. No agregar una librería para esta regla.
- Añadir controles SQL/decoder para las variantes anteriores y comprobar que
  no dejan escrituras/fences parciales cuando sean comandos.

## R5: unidades antiguas y escrituras nuevas

- `activityPage` v1 y `operationalSummary` conservan la unidad legacy exacta y
  no vacía, sin imponer retroactivamente el máximo 80. No recortar ni modificar
  tareas, referencias, snapshots o reportes. Mantener envelopes y campos exactos.
- Diferenciar activity v1/v2 en los schemas compartidos: v1 conserva snapshots
  NULL; v2 sigue con unidad de longitud real 1–80 y normalización no vacía.
  Mantener el máximo 80 para rates y unidades v2 nuevas. Actualizar tanto el
  decoder de envelope como decodeQueryDataV1; evitar definiciones divergentes.
- Si una tarea/plantilla existente no tiene unidad elegible para una escritura
  v2 (incluido largo real >80 aunque trim tenga 80), record/rate devuelve 22023
  genérico antes de insertar; rollback sin recibos, actividad o configuración
  parcial. No usar silenciosamente el writer legacy ni cambiar la unidad para
  admitirla. La edición/creación de catálogo se resolverá explícitamente en C.
- Probar lectura de actividad/resumen con unidad 81 antes/después del upgrade,
  escritura v2 rechazada y lectura de v2 normal que pasa ambos decoders.

## Matriz concurrente mínima pendiente

Para cada par distinto probar ambos órdenes con RC/RC y RR/RR. Agregar RC/RR y
RR/RC para replay y para las regresiones de autorización/fences si cambia su
resultado. Reutilizar casos existentes identificándolos en una matriz explícita;
no duplicar pruebas equivalentes sólo para aumentar el número.

| Par | Invariante al confirmar el primero |
| --- | --- |
| Primera tasa / registro | Registro ganador conserva ausencia de tasa; tasa ganadora se aplica a nuevas escrituras. Un snapshot RR obsoleto aborta 40001, sin reinterpretar entradas previas. |
| Cambio de tasa / registro | Snapshots de entradas confirmadas inmutables; futuro registro toma versión vigente. |
| Evaluación / registro | Sólo el ganador incrementa la revisión esperada; el perdedor con revisión vieja aborta 40001 sin efectos parciales. |
| Cierre legacy / registro | Cierre ganador impide el registro; registro v2 ganador hace fallar el cierre legacy con 0A000, sin cierre/reporte/outbox parcial. Usar el comando público real además del guard de tabla. |
| Cancelación de cobertura / registro | Cancelación ganadora deniega el registro; registro ganador conserva ejecutor real y luego se puede cancelar. Usar el comando público cuando exista. |
| Baja del actor / registro y replay | Baja ganadora deniega o serializa; registro ganador puede confirmar antes de la baja. Recibo denegado tras revocación. Ningún 40P01. |
| Replay exacto / replay exacto | Un movimiento y un recibo; RC devuelve el original; RR obsoleto puede abortar 40001 y su retry devuelve el original. |

Usar sesiones independientes PostgreSQL y barreras pg_blocking_pids, con timeout
acotado. Comprobar también rollback del ganador, reintento, revisiones, tasas,
auditoría y ausencia de recibos/fences parciales. No aceptar únicamente el exit
code del runner: su reporte debe identificar cada variante y estado final.

## Entrega de Luna

1. Reejecutar las sondas independientes (las 8 originales y extensiones) y los
   focales de migración/DTO. PostgreSQL nativo completo de M2.1 y la matriz de A.
2. Suite completa, TypeScript y builds cliente/Worker tras los cambios de
   producto. Confirmar hashes 001–013 y fuente UI sin cambios. Mantener la
   diferencia entre PostgreSQL local y Supabase/Auth reales todavía pendientes.
3. Actualizar estado/evidencia con comandos, exit codes, resultados y hashes;
   conservar informes fallidos como historia, sin cambiar su significado.
4. Con el candidato verde, commit local explícito de A corregida en la rama
   actual, sin `git add .`, y bundle portable comprobado por clonación limpia.
   No llamar a ese commit aceptación ni conectar/desplegar 014 incompleto.
5. Volver a **GPT-6.1 Sol, alto, Standard** para aceptar/rechazar ese commit y
   después definir B/C. Detenerse antes si aparece una decisión nueva fuera de
   estas correcciones. El porcentaje global sigue histórico hasta un recálculo
   con bloques aceptados e infraestructura comprobada.
