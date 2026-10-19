# Aceptación Sol — inicio de cronómetro frente a revocación

Fecha: 19/10/2026. Aceptación de alcance local sintético. No cierra §9/Gate L,
no acredita Auth/HTTP/Supabase alojados y no autoriza migración remota.

## Alcance aceptado

Se aceptan únicamente cuatro carreras entre `public.start_task_timer` del
empleado responsable y `api.command_v1(companyMembership.setActive(false))` de
jefatura, en ambos órdenes bajo RC/RC y RR/RR.

Los cuatro casos observaron bloqueador real entre PIDs distintos. El ganador
termina `00000`, el perdedor stale `40001`; el retry fresco de revocación cuando
el timer gana termina `00000`; el retry fresco del timer cuando la revocación
gana termina `P0001 / Sin permiso`.

## Evidencia y validación

- PostgreSQL 17.11: 325/325, cero fallos y cero deadlocks.
- Vitest: 738/738 en 74 archivos; TypeScript, builds cliente/Worker,
  `node --check` y `git diff --check`: exit 0. PostgreSQL, sintaxis y diff-check
  corresponden a attempt4; suite/builds al attempt3, previo al ajuste de
  aserciones del runner. Sol confirmó que la suite/build no requería repetirse.
- Winner-only, rollback del perdedor, retry, fences, claims efectivos UID/sub/AAL
  e aislamiento, receipts, auditoría, estado de sesión, inicio y asignación se
  verifican. UUID de sesión coincide con su fila y receipt. Sin efectos parciales
  en los casos denegados.
- SQL011 y SQL014 mantienen sus hashes; no hubo cambios de SQL ni llamadas
  remotas. El espacio operativo no se activó.

Manifiesto revisado por Sol:
`review-evidence/m2-2c-timer-start-membership-revocation-races-luna-20261019.json`
(SHA256 antes de marcar el límite de aceptación:
`0409cfdb36c1e50626773c305e97fad4a81330226d64d1cc875b589ae5f9667b`).
Tras registrar la aceptación en `reviewBoundary`, el manifiesto quedó con SHA256
`82e6c67ad663e0310e36cae33d8bd0fc049845ec941ea61b33355222c390d16a`.
Runner: `fa7bf8da251a9fce4b0a4cc31f5152fdd2cbb5bc30c1d1e5b2ca48b03b9a4b23`.
Reporte: `47d3e60e19cd338f7523f79345d6efce486eaa9f7bb0bbcdfdc832e4a7ffaaf8`.
La evidencia cruda está en
`../../outputs/m2-2c-timer-start-membership-revocation-races-luna-20261019-attempt4/`,
fuera del Git root.

## Límites P3

- `focusedMatrix` conserva una etiqueta anterior; los casos nuevos se
  identifican por sus nombres específicos.
- Logs crudos están fuera del Git root.
- No cubre replay legacy después de revocar; requiere auditoría independiente.

## Próximo paso

Continuar la auditoría local de §9 con otra familia de writers. Mantener la
revisión Sol antes de cada contrato y la revisión Sol posterior a cada bloque
Luna. SQL014 y el espacio operativo siguen separados de esta evidencia local.
