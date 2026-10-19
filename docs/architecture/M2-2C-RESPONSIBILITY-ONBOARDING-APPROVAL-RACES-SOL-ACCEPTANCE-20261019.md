# Aceptación Sol — responsabilidad frente a aprobación de inducción

Fecha: 19/10/2026. GPT-6.1 Sol aceptó el alcance local acotado de los cuatro
casos sintéticos `public.assign_task_responsibility` frente a
`api.command_v1(onboarding.approve)`, bajo RC/RC y RR/RR en ambos órdenes.

## Resultado

- PostgreSQL 17.11: **313/313**, cero fallos y cero deadlocks; los cuatro casos
  observaron bloqueo real por PID.
- Resultados por caso: RC responsabilidad primero, aprobación pierde con
  `40001` y retry `00000`; RC aprobación primero, responsabilidad confirma con
  `00000` y replay exacto en sesión nueva; RR ambos órdenes, perdedor `40001` y
  retry `00000`.
- Cada caso termina con una activación, asignación y ocurrencia; responsabilidad
  conjunta revisión 2 y cuotas 5000/5000; un recibo por operación y un evento
  por acción; sin duplicados.
- Suite: **738/738** en 74 archivos. TypeScript, builds de cliente y Worker,
  `node --check` y `git diff --check` terminaron con código 0. Como `npm` no
  estaba disponible, se ejecutaron los binarios/scripts con el Node local; no
  se instalaron dependencias.
- No se modificaron SQL011/013/014 y no hubo llamadas remotas.

## Hashes aceptados

| Artefacto | SHA-256 |
|---|---|
| Runner `tests/review/m2-1-native-review.mjs` | `0abd05693274c04199576421540d4712844450c5c1bccdf58947017f4b3fba83` |
| Contrato Luna | `ecae277d8ffcd37a5817921cd386064186ba358f4de3b16ede31653b90b0b438` |
| Reporte nativo | `3dc77fed979bdaeb0fab6dc446e9f313dfd65b633a495d0f56c9d083286eb442` |
| Manifiesto | `b0faa11ad4e8b8c530d761a7627d047c59f7fd862af10bbd08c44eae28059dd0` |

Manifiesto y resultados: `review-evidence/m2-2c-responsibility-onboarding-approval-races-luna-20261019.json`.
Los logs crudos están en `../../outputs/m2-2c-responsibility-approval-races-luna-20261019-sol-fix/`, fuera del Git root; no se incluyen al clonar este repositorio.

## Límites

La aceptación cubre sólo estos cuatro escenarios; no cierra §9, M2.2C ni Gate L.
El nombre `focusedMatrix` heredado en el reporte no se actualizó, aunque cada
caso está identificado por nombre. TypeScript y Worker registran salida vacía
con exit 0. No acredita Supabase alojado, Auth/HTTP, aplicación remota de SQL,
hosting, producción ni migración completa.
