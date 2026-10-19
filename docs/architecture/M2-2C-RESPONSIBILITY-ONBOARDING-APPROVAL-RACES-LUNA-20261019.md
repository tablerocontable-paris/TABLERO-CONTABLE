# Contrato Luna — responsabilidad frente a aprobación de inducción

Fecha: 19/10/2026. Alcance local con perfiles y solicitudes sintéticos.

## Objetivo

Completar la matriz de concurrencia entre `public.assign_task_responsibility` y
`api.command_v1(onboarding.approve)` para el mismo titular y período abierto.
Responsabilidad modifica una tarea puntual preexistente; aprobación crea una
asignación y ocurrencia de onboarding separadas. No se presupone que ambas
operaciones cambien la misma tarea. El runner ya tiene un caso de cada orden
ganador bajo aislamientos mixtos RC/RR; agregar ambos órdenes bajo RC/RC y RR/RR.
Esta familia está enumerada en §9 del contrato M2.2B/C.

## Preparación y carrera

- Cuatro fixtures independientes con perfil titular, una tarea inicial con
  responsabilidad legacy sellada revision 1, y una solicitud de onboarding
  enviada con una única línea sintética para el mismo titular/empresa/equipo y
  período actual abierto.
- Dos jefes distintos por fixture, activos y autorizados para la organización,
  ambos usando AAL2: uno ejecuta la asignación de responsabilidad y otro la
  aprobación. No serializar por una identidad compartida.
- Operaciones simultáneas en sesiones PostgreSQL distintas y mismo aislamiento
  efectivo en ambas: RC/RC o RR/RR. El ganador queda abierto mientras inicia el
  perdedor. Confirmar bloqueo real con `pg_blocking_pids` y confirmar al ganador.
  Los resultados esperados del primer intento perdedor son específicos por caso:

| Aislamiento y orden | Primer intento perdedor | Siguiente comprobación |
|---|---|---|
| RC/RC, responsabilidad primero | Aprobación `40001` | Reintentar en sesión nueva con los mismos argumentos e ID; debe dar `00000`. |
| RC/RC, aprobación primero | Responsabilidad `00000` | Confirmar el commit en la tarea preexistente; repetir exactamente la operación en sesión nueva y verificar respuesta idéntica, sin nuevos efectos. |
| RR/RR, responsabilidad primero | Aprobación `40001` | Reintentar en sesión nueva con los mismos argumentos e ID; debe dar `00000`. |
| RR/RR, aprobación primero | Responsabilidad `40001` | Reintentar en sesión nueva con los mismos argumentos e ID; debe dar `00000`. |

  En RC/RC aprobación-primero, la aprobación crea otra tarea y no altera la
  asignación, revisión ni responsabilidad de la tarea puntual sobre la que se
  ejecuta la segunda operación. Por eso la serialización observada permite que
  ambas operaciones se confirmen; el replay exacto prueba idempotencia. No
  generalizar `00000` o `40001` como outcomes intercambiables.
- Cubrir `responsibility-first` y `approval-first` en cada nivel: cuatro casos.

## Invariantes

- Si gana responsabilidad: el intermedio conserva la solicitud `submitted`, sin
  activación ni receipt de aprobación, y la tarea termina con responsabilidad
  conjunta revision 2. El reintento de aprobación crea una sola activación y la
  única asignación/ocurrencia vinculada a esa línea.
- Si gana aprobación en RC/RC: antes de confirmar la responsabilidad, el
  snapshot intermedio muestra solicitud `approved`, una activación/receipt y la
  asignación/ocurrencia resultante; la tarea y asignación preexistentes siguen
  iguales y la responsabilidad sigue en revision 1. Después, la responsabilidad
  pasa exactamente a revision 2. Su replay exacto devuelve el mismo resultado
  desde una sesión nueva, sin alterar estado, receipts ni auditoría.
- Si gana aprobación en RR/RR: el primer intento stale de responsabilidad debe
  abortar con `40001`; su reintento autorizado en sesión nueva crea exactamente
  revision 2 y conserva intacta la activación.
- En ambos órdenes, el estado final tiene solicitud aprobada, una activación para
  la línea, una asignación y ocurrencia de onboarding, responsabilidad conjunta
  revision 2 con los miembros/cuotas esperados, un receipt por operation ID y
  ningún duplicado.
- No se impone el bloqueo por orden en base a un sleep; probarlo por PID.
  Registrar SQLSTATE/mensaje y respuesta real de ganador, perdedor, retry o
  replay; capturar el snapshot winner-only antes de confirmar un perdedor que
  también sea válido.

## Evidencia y validación

Registrar snapshots antes de la competencia, tras el primer intento perdedor y
tras retry o replay con solicitud/versiones, tarea, conjunto/cabecera/miembros de
responsabilidad, asignaciones/ocurrencias, activación, recibos, fences de
creación/mes y eventos de auditoría pertinentes. Capturar actores, roles/AAL,
PIDs, aislamiento consultado, blocker, respuestas y retries.

Extender `tests/review/m2-1-native-review.mjs` en el runner nativo existente y
publicar manifiesto versionado con hashes del runner, SQL011/014, reporte/logs.
Probar PostgreSQL local, `node --check`, suite completa, TypeScript, build cliente
y Worker y `git diff --check`.

## Límites

Sólo runner, evidencia y documentos. No editar SQL011/014, datos de producto,
endpoints remotos ni configuración de Supabase. Si el resultado difiere de los
invariantes, detenerse y devolver a Sol para diagnóstico antes de tocar SQL. La
aceptación Sol posterior debe nombrar hashes exactos y cubre sólo estos cuatro
casos; no cierra §9/Gate L ni autoriza migración remota.

## Resultado de implementación Luna — 19/10/2026

Los cuatro casos pasan en PostgreSQL 17.11, con bloqueo confirmado por PID.
Resultados observados: RC/RC responsabilidad-primero y ambos órdenes RR/RR
devuelven `40001` al perdedor y `00000` al retry en conexión nueva; RC/RC
aprobación-primero devuelve `00000` para responsabilidad, que confirma el cambio
serializado y obtiene la misma respuesta al replay desde una conexión nueva. El
snapshot anterior al commit de responsabilidad confirma que aprobación no tocó
la tarea/asignación preexistentes. Los cuatro terminan con una activación,
asignación y ocurrencia de onboarding, responsabilidad conjunta rev. 2, un
recibo por operación y un evento de auditoría por acción.

Runner total: **313/313**, `40P01=0`; suite: **738/738** en 74 archivos;
TypeScript, build cliente y build Worker pasan. `npm` no está disponible en el
equipo, así que el build se ejecutó directamente con TypeScript, Vite y el
script Worker locales, equivalentes a los comandos encadenados por `npm run
build`. `node --check` y `git diff --check` pasan. Evidencia y hashes:
`docs/architecture/review-evidence/m2-2c-responsibility-onboarding-approval-races-luna-20261019.json`.
Esta implementación aún requiere revisión independiente de Sol.
