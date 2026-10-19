# Aceptación Sol — cancelación de cobertura frente a aprobación de onboarding

Fecha: 19/10/2026. GPT-6.1 Sol aceptó exclusivamente los cuatro casos locales
sintéticos de `public.cancel_task_coverage_binding` frente a
`api.command_v1(onboarding.approve)`, bajo RC/RC y RR/RR en ambos órdenes.

## Resultado validado

- PostgreSQL 17.11: **317/317**, cero fallos y cero deadlocks; cada carrera
  observó bloqueo por PID y utilizó dos jefes autorizados AAL2 distintos.
- Cancelación primero, RC/RC y RR/RR: aprobación perdedora `40001`; retry en
  conexión nueva `00000`.
- Aprobación primero, RR/RR: cancelación perdedora `40001`; retry nuevo
  `00000`. Aprobación primero, RC/RC: cancelación `00000`; replay void exacto
  desde sesión nueva e inerte.
- Approval response coincide con su recibo. El recibo de cancelación conserva
  `operation_kind='cancel_task_coverage'`, argumentos `{binding, reason}` y
  `result={}`. El estado final conserva una activación, asignación y ocurrencia,
  binding original cancelado, un recibo por acción y cero duplicados.
- Vitest **738/738** en 74 archivos; TypeScript, build cliente, build Worker,
  `node --check` y `git diff --check` con exit 0. `npm` no estaba disponible;
  los scripts se ejecutaron directamente con el Node local y no se instalaron
  dependencias.
- SQL011/014 mantienen sus hashes; no hubo llamadas remotas.

## Hashes revisados

| Artefacto | SHA-256 |
|---|---|
| Runner | `320498dc9601ce7d72feb64c34ec88b38e9dce41f324651c3e45be208d829c74` |
| Contrato Luna | `0c2b373b7947223ff89b3d1683fff407aa686142693d70d6a2415f4a718ee6f6` |
| Reporte nativo | `a83766a9b9e890d64bf0c05db8e54be3d7bb41eaba55f4631d506d6fa885f27c` |
| Manifiesto con decisión Sol registrada | `3f2cde9b5d42711d2ced88656b530e3408bb5ebc3f786098b4013a7946f3036e` |

Manifiesto: `review-evidence/m2-2c-coverage-cancel-onboarding-approval-races-luna-20261019.json`.
Los logs crudos están en `../../outputs/m2-2c-coverage-cancel-onboarding-approval-races-luna-20261019-attempt3/`, fuera del Git root; no se incluyen al clonar.

## Límites P3

La etiqueta `focusedMatrix` heredada no se actualizó; los cuatro casos se
identifican correctamente por nombre. La auditoría filtra acciones y actores
esperados, y los snapshots incluyen fences de mes/grafo, no todo el estado de
coordinación. El runner compara principalmente respuesta con recibo y
cardinalidades; Sol verificó en el reporte la correspondencia de IDs físicos.
La aceptación no cierra §9/M2.2C/Gate L, no acredita CI ni Supabase alojado y no
autoriza aplicar SQL014.
