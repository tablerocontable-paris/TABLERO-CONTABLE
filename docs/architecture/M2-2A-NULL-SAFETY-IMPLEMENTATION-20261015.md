# M2.2A-R6 — implementación de validación NULL-safe

## Alcance

Se corrigió únicamente el contrato local de la migración 014 y sus pruebas de
aceptación. No se editó ni aplicó SQL remoto, no se cambió el DTO, UI, Worker,
Site o las migraciones 001–013, y no se conectaron cuentas.

## Corrección

- `api_exact_keys` devuelve siempre un booleano estricto: objetos vacíos,
  `SQL NULL`, JSON null y valores que no sean objetos ya no producen NULL.
- Los extractores de texto, fecha, UUID, revisión y entero rechazan con `22023`
  campos ausentes, nulos o con tipo inválido.
- Las tres familias de comando comprueban las claves exactas y los valores de
  revisión antes de locks de negocio, recibos, fences o escrituras. Revisión
  válida obsoleta sigue respondiendo `40001`.
- Consultas validan la forma de filtros/cursor y el tipo de envelope antes de
  locks/lecturas. Un `commandReceipt` vacío ya no devuelve `found:false`.
- Se conserva la reautorización de los recibos y el orden de locks ya revisado.
- Los errores 22023 revierten sin cambios parciales y permiten continuar la
  transacción desde un SAVEPOINT.

## Evidencia de aceptación local

El reproductor R6 pasó 30/30; la sonda independiente nueva pasó 9/9; las sondas
compatibles previas pasaron 15/15; las pruebas focales 17/17; las matrices
PostgreSQL 17.11 pasaron 61/61 RC/RC, 61/61 RR/RR, 43/43 RC/RR y 43/43 RR/RC.
La suite completa aprobó 712/712 en 72 archivos. TypeScript, build de cliente y
Worker terminaron con código 0. `git diff --check` y `node --check` para ambos
reproductores terminaron sin errores. El commit local `08b7405` pasó el hook
pre-commit automático: 196/196 en 19 archivos.

La prueba nativa adicional intentó registrar una operativa avanzada con
`expectedRevisions: {}`: el llamado fue rechazado como entrada inválida; la
cantidad existente de movimientos permaneció igual y la transacción se revirtió.

Todos los ensayos usan fixtures ficticios/locales. No prueban Supabase alojado,
Auth/MFA real, permisos remotos ni despliegues. El candidato anterior conserva
el defecto y no es una entrega aceptada. **Siguiente paso:** verificar el bundle
de este commit en clonación limpia; después revisión independiente GPT‑6.1 Sol,
esfuerzo alto, Standard. B/C continúan fuera del alcance hasta aceptar A.

Detalle y hashes: `review-evidence/m2-2a-r6-implementation-20261015.json`.
