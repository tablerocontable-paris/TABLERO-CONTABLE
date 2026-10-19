# OneOff frente a revocación — aceptación Sol

Fecha: 2026-10-19
Implementación: GPT-6 Luna
Revisión: GPT-6.1 Sol, esfuerzo alto
Estado: **aceptado localmente, alcance limitado a cuatro escenarios**

## Evidencia exacta

- Contrato aprobado SHA-256: `98c9b35aca1d66c4931644b5e5e2ccf9efd654d02426b0351e2e5aa7ffa033c4`.
- Runner SHA-256: `fbf8e3a86caaecb825561e654795c01b8f065b3774bee6594d0a5e24290547b7`.
- Reporte SHA-256: `21398735b5470bf3957c3a82d8ad7b22511e8603609b1e0199724c9e33747401`.
- Manifiesto SHA-256: `fa986ff498d24615ab36b2a649e7f2bf4702cc4de1bd687c9ab0a4c3f9c924a4`.
- Sol comprobó **31/31 hashes**; el SHA del runner coincide en runner, reporte y manifiesto.
- Evidencia: `docs/architecture/review-evidence/m2-2c-oneoff-create-membership-revocation-races-luna-20261019.json`.
- Logs crudos y códigos de salida: `../outputs/m2-2c-oneoff-create-membership-revocation-races-luna-20261019-attempt11/`.

## Resultado

PostgreSQL 17.11: **333/333**, cero fallos y cero deadlocks. Los cuatro casos
RC/RC y RR/RR midieron bloqueos reales y confirmaron:

| Orden | Ganador | Perdedor | Reintento |
|---|---|---|---|
| Alta primero | `00000` | `40001` | `00000` |
| Revocación primero | `00000` | `40001` | `42501` |

El runner exige la fila completa de la tarea salvo `state_revision` 0→1,
preserva el recibo histórico con `taskRevision="0"`, verifica responsabilidad
sellada, auditoría, fences exactos y ausencia de efectos en baseline,
winner-only, rollback y final. Suite completa: **738/738 en 74 archivos**;
TypeScript, builds cliente/Worker, sintaxis y diff-check: exit `0` con logs.

## Límites

La aceptación cubre exclusivamente estos cuatro escenarios sintéticos locales.
No cubre aislamientos mixtos, otras variantes de creación, Auth/HTTP alojado ni
CI. No modifica SQL011/014, no aplica SQL014 y no cierra §9/Gate L. Sol reporta
advertencias Rollup en dependencias y conversión LF/CRLF, sin impacto en los
checks.
