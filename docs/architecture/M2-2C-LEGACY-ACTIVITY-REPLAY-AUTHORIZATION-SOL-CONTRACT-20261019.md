# Contrato Sol — replay legacy de movimientos operativos

Fecha: 19/10/2026. GPT-6.1 Sol, esfuerzo alto. Implementación posterior:
GPT-6 Luna, esfuerzo medio. Sólo laboratorio local con PostgreSQL nativo y datos
sintéticos. No implementar ni ejecutar contra servicios alojados por este archivo.

## 1. Baseline y estado probado

HEAD inspeccionado: `e3e18c2053367812fd78b21a786d13143030098d`, publicado según la
continuidad del coordinador. SQL014 del checkout fue medido en esta auditoría:
`BC83666B4FFD916FA8E7FA7EBC03800C6F61E0A3B852C851BE70C5BE1498F3C3` (SHA-256 del blob Git exacto; ver errata al final).
No reutilizar las menciones históricas a «sin commit» del estado general como
instrucción vigente. No se modifican aquí esos documentos generales.

Se leyeron AGENTS.md, PROJECT-STATUS.md, EXECUTION-NEXT.md y §9 de
`M2-2BC-EXECUTABLE-CONTRACT-20261016.md`. La aceptación timer es un antecedente
acotado; su suite verde no acredita el replay del helper de movimientos.

Evidencia estática actual:

- SQL011, `record_activity_once` alrededor de línea 876: wrapper UUID que llama
  `_coordination_record_activity(...,'record_activity')`. `record_activity`
  llama el mismo helper con una operación generada y kind `activity_legacy`.
- SQL012, `_coordination_record_activity`, líneas 308–379: toma receipt lock,
  compara kind/argumentos y devuelve entry_id/id antes del control de rol,
  organización, acceso, preparación, locks y revalidación.
- SQL014 vigente no redefine este helper ni esos wrappers. Sí reemplaza la
  adquisición de coordinación y conserva fences de membresía de los writers.
- SQL012 eliminó la deduplicación por contenido de SQL011: distintas operaciones
  crean distintas entradas aunque sus cantidades/fecha/referencia coincidan.
- §9 exige replays reautorizados, revocación y evidencia de cambios/rollback;
  el SQLSTATE `40001` de conflictos API nuevos no reemplaza el error legacy.

**Conclusión actual: sospecha sustentada por código, todavía no defecto
reproducido en este bloque.** No se ejecutaron consultas mutantes ni sondas
locales para redactar este contrato. No adjudicar severidad de carrera ni
autorizar cambios de producto antes de la reproducción roja siguiente.

## 2. Precondiciones y frontera de modificación

Luna registra baseline HEAD, estado limpio y SHA-256 de cada migración 001–014,
runner, contrato y herramientas antes de ejecutar. Exigir exactamente la SQL014
indicada arriba; si difiere, volver a Sol. No instalar dependencias.

Fixtures independientes, mismos roles reales del esquema: empleado E activo
AAL1 y jefe J activo AAL2, empresa/equipo/membresías autorizados, una tarea
operativa **legacy measurement_version=1** individual con unit/target/peso
legacy válidos. Fecha de trabajo del mes actual y no futura en ART; referencia
no vacía, cantidad 1. Sin actividad previa, sesiones, cobertura, ausencias,
tracking/dependencias, cierres, reportes, entregas, evaluación ni outbox.
Capturar claims/identidad efectivos; no basta declarar UUIDs en el runner.

Dos rutas auténticas de fixture:

1. **Actual:** aplicar 001–014 del baseline en clúster nuevo; crear el fixture y
   llamar el wrapper `record_activity_once` como E para generar entrada/recibo.
2. **Upgrade:** aplicar 001–013, generar entrada/recibo usando el mismo wrapper
   autorizado, conservar snapshot, aplicar la SQL014 exacta y comprobar que
   entrada/recibo histórico no se reescribieron. Luego ejecutar replay.

Nunca insertar manualmente `task_mutation_receipts` ni crear recibos con kinds o
resultados sintéticos. Para kind conflictivo, generar un recibo auténtico con
`record_activity` y obtener su operation_id desde el observador local. Invocar
después `record_activity_once` con esa operación debe rechazar el kind distinto.
No dar EXECUTE del helper privado al rol authenticated para hacer las pruebas.

Se permite corregir sólo el override de `_coordination_record_activity` añadido
en SQL014, su rama cached y variables mínimas. Copiar del cuerpo vigente SQL012
la primera ejecución sin alterarla. No cambiar firmas, grants, wrappers,
SQL001–013, timer ya aceptado, API operation.record, UI, DTO, Worker ni rates.
No crear otra migración ni API de inactivación. SQL014 permanece local sin aplicar.

## 3. Reproducción roja antes de modificar SQL

Sobre baseline exacto, guardar reporte original con código/mensaje y snapshots:

1. Primera llamada auténtica confirma `00000`, UUID de entry y recibo legacy.
   Replay autorizado exacto devuelve ese UUID y no altera ninguna fila.
2. En otro fixture, J revoca membresía E/empresa mediante
   `api.command_v1(companyMembership.setActive(false))`, confirma y se comprueba
   active=false/revisión nueva. Replay exacto E posterior: inspección predice
   `00000`, UUID previo. Si ocurre, acredita retorno de resultado sin permiso
   actual; registrarlo como defecto, no como caso verde.
3. En otro fixture, inactivar perfil E con preparación privilegiada local
   confirmada. Replay exacto predicho `00000`. Capturar active=false real.
4. Control de mismos operation_id con cambio de quantity, work_date, reference o
   instance válidos: `P0001`, mensaje primario exacto
   `Identificador de operación reutilizado con otros argumentos`. Variar un
   campo por intento; referencia con sólo cambio de espacios sigue siendo
   argumento distinto aunque la entrada se guarde con trim.
5. Probe de snapshot: abrir RR E, fijar snapshot con consulta de tarea/membresía,
   revocar y confirmar en J, luego replay exacto E manteniendo RR. Registrar el
   retorno esperado por inspección `00000` y ausencia de revalidación; no exigir
   que haya esperado un lock que la rama actual no toma. Es prueba de snapshot
   obsoleto, no evidencia de una carrera ya corregida.

Repetir los rechazos/controles secuenciales esenciales en ruta Upgrade. Registrar
separadamente esa ruta y el momento exacto en que se aplica014. La rama legacy
`activity_legacy` se conserva mediante llamada real al wrapper y pruebas de
conflicto kind; no se presenta el helper privado como endpoint del cliente.

**No-go:** si los replays revocados/inactivos ya se deniegan o la primera llamada
no genera recibo auténtico, detener el fix, conservar diagnóstico y volver a Sol.
Una firma mal invocada, grant denegado o tarea inválida no reproduce este riesgo.
No editar resultados esperados para convertir una sonda mal preparada en defecto.

## 4. Corrección condicional autorizada

Sólo si §3 demuestra el retorno no autorizado, añadir el override acotado en014.
Conservar identidad/operación/argumentos raw, kind y resultado histórico. La
comparación kind/argumentos precede autorización y mantiene `P0001` y su mensaje
legacy, también para actor revocado/inactivo; no convertirlo en API `40001`.

Para un cached exacto, preparar ámbito actual de tarea original, actor y
responsables; adquirir `_coordination_acquire_m22b(plan,false)` bajo el mismo
receipt lock. Incluir actor en perfiles y meses pertinentes. No usar variante
writer, no tocar month fences, no insertar grafo y no avanzar epochs. Para tarea
operativa fixture no hay clave de grafo. Respetar orden global existente recibo
1101, actores1102, perfiles1103, meses1104, catálogo1105 y locks de filas.

Después de adquisición/revalidación: releer tarea y recibo; exigir coherencia de
organización/actor/operación, perfil activo y rol actual en
empleado/encargado/jefe, y acceso `_can_access_instance_at` vigente. Las
comprobaciones deben ser NULL-safe. Denegar con `P0001`, mensaje `Sin permiso`.
No ampliar la autorización legacy ni introducir permiso de ejecutor más
restrictivo en esta corrección de compatibilidad.

Devolver UUID histórico si sigue autorizado, sin comprobar nuevamente fecha de
trabajo, cantidad, referencia normalizada, mes abierto o revisión actual. Esos
argumentos ya se validaron al ejecutar y se comparan con el recibo. Cambios
legítimos posteriores no deben volver a ejecutar actividad ni crear recibos.
Releer el recibo bajo lock y rechazar inconsistencias concurrentes con `40001`;
no reparar ni reemplazar recibos corruptos silenciosamente.

Primera ejecución debe seguir idéntica a SQL012, incluyendo dos operation_id
distintos con el mismo contenido => dos entradas, dos recibos y dos incrementos
de state_revision. `record_activity` conserva UUID nuevo por llamada y resultado
`{id:entry}`; once conserva `{entry_id:entry}`. Ambos formatos antiguos permanecen
legibles; no convertir recibos antiguos a formato API ni añadir measurement_v2.

## 5. Matriz verde condicional y concurrencia limitada

Ejecutar sólo después de reproducir §3 y crear la candidata:

| Caso | Resultado exacto | Escrituras por el intento |
|---|---|---|
| Replay autorizado inmediato, actual y Upgrade | `00000`, UUID original | Ninguna |
| Replay autorizado tras nueva entrada/revisión avanzada | `00000`, UUID original | Ninguna |
| Replay autorizado tras cierre legacy válido del mes | `00000`, UUID original | Ninguna |
| Replay tras membresía revocada | `P0001`, `Sin permiso` | Ninguna |
| Replay tras perfil inactivo | `P0001`, `Sin permiso` | Ninguna |
| Replay tras reactivación autorizada | `00000`, UUID original | Ninguna |
| Conflicto quantity/work_date/reference/instance por separado | `P0001`, mensaje de argumentos reutilizados | Ninguna |
| Conflicto de argumentos mientras revocado/inactivo | Mismo error de argumentos | Ninguna |
| Kind distinto con recibo auténtico de record_activity | Mismo error de argumentos | Ninguna |
| Nueva operación con contenido idéntico | `00000`, UUID distinto | Sólo efectos auténticos SQL012 descritos arriba |

Para cierre, un fixture de operativa legacy debe reunir las condiciones reales
del cierre011; si exige más datos, prepararlos de forma autorizada y registrar
baseline posterior al cierre. No fabricar una fila monthly_closures sólo para
saltar su contrato. Reactivar membresía por comando jefe con revisión actual;
reactivar perfil sólo en preparación local. Estas acciones tienen sus propios
baselines; no imputar sus efectos al replay.

Concurrencia se habilita **únicamente si la reproducción roja secuencial y el
probe RR acreditan el retorno temprano**. En caso contrario no abrir un bloque
de ocho carreras especulativas: volver a Sol. La matriz usa cuatro pares
efectivos (replay/revocación): RC/RC, RC/RR, RR/RC, RR/RR, ambos ganadores.

| Ganador | Ganador | Perdedor | Retry en sesión nueva, misma operación/argumentos |
|---|---|---|---|
| Replay | `00000`, UUID original | Revocación `00000` | Revocación `00000`, JSON original; replay E posterior `P0001` |
| Revocación | `00000`, JSON/recibo API | Replay `40001` | Replay `P0001`, `Sin permiso` |

Replay es readonly: no invalida el snapshot del revocador. Revocación sí altera
membresía/tarea/fence y obliga a revalidar. Confirmar aislamiento por sesión y
snapshot del perdedor antes de llamar. Dos conexiones de comando y observador:
registrar PIDs y `winnerPid=ANY(pg_blocking_pids(loserPid))` mientras ganador
sigue abierto; no sustituir con sleeps. Commit ganador, rollback explícito del
`40001`, snapshot intermedio y retry nuevo. En replay-first mantener transacción
revocadora abierta al capturar winner-only. Ningún40P01 permitido. Si outcomes
difieren, devolver evidencia a Sol sin ensanchar listas aceptadas de SQLSTATE.

No repetir primeras ejecuciones API operation.record/revocación ya aceptadas,
timer ni su matriz. Esto ensaya exclusivamente replay cached del helper legacy.

## 6. Aceptación, snapshots y evidencia exacta

Capturar baseline posterior a entrada auténtica, winner-only, rollback, final y
post-retry. Comparar filas completas y arrays ordenados, no sólo conteos:
tarea/asignación, perfiles/membresías, responsabilidad sets/heads/members por
consultas independientes, todas las entradas/recibos/sesiones del ámbito,
auditoría sin filtrar el autor esperado, todos los fences E/J de organización y
todos los meses, gráficos y operation fences; cierres/reportes/entregas/outbox,
tracking/dependencias/coberturas/ausencias/evaluaciones. Cero huérfanos ocultos
por joins. Replay/denegación/rollback deja igualdad exacta.

Recibo once auténtico: actor E, organización, operation_id, kind record_activity,
`arguments={instance,work_date,quantity,reference}` raw exactos,
`result={entry_id:UUID}`; resultado UUID igual a activity_entries.id, autor E y
referencia trim. Conservar created_at, cantidad, unidad/snapshot y audit original
activity.created (entity_id=entry; details.instance=tarea). Comprobar conjuntos
de claves completos. Recibo activity_legacy auténtico conserva `{id:UUID}`.

Baseline de entrada actual: tarea mantiene su status y aumenta revisión una vez;
fence membresía E +1 por writer existente, J sin cambio; sin graph/month/op
fences nuevos. En ruta Upgrade, la creación de fences014 es bootstrap, no
efecto del replay: capturar ese baseline aparte.

Revocación confirmada desde baseline actual: membresía E active=false/revisión
+1, tarea no completada revisión +1 y demás campos iguales, membership fence E
+1 y J+0, ningún month/graph delta para esta operativa sin dependencias; una fila
operation fence J/revokeOperation epoch1, un recibo/evento/auditoría API. Entradas
y recibos legacy íntegros, sesiones siguen vacías, resto igual. La respuesta
completa de revocación coincide con su recibo y se conserva en su replay.

No aceptar hasta que Sol revise hashes exactos de reproducción roja (SQL014
baseline), candidata verde, runner y logs. Conservar reportes separados; no
sobrescribir rojo. Registrar comandos/stdout/stderr/exitcodes, PostgreSQL,
aislamientos/claims efectivos, blockers y archivos estables en outputs con
manifiesto versionado. Ejecutar focal relevante, matriz nativa completa, suite,
TSC, builds cliente/Worker, sintaxis runner y diff-check; repetir sólo por cambio
de código/runner, fallo o preocupación sin resolver. 001–013 bytes intactos.

La aceptación cubre esta familia únicamente. Residual conocido de retorno
temprano después: `assign_task_responsibility`; inspeccionar y reproducir en su
propio contrato. §9/Gate L completo, otros riesgos inventariados, Data API,
Auth/HTTP alojado, Storage/restore, CI, hosting/correo/producción conservan gates.
No aplicar migraciones ni activar cliente operativo por este bloque. El
coordinador cruza evidencia acumulada con requisitos y avanza al gate siguiente
sin reimplementar familias ya aceptadas.


## Errata de baseline and recheck (2026-10-19)

The initial C6A4 hash came from an unavailable checkout. No local artifact reproduces it. The authoritative SQL014 baseline is the exact Git blob at commit e3e18c2053367812fd78b21a786d13143030098d:supabase/migrations/202610150014_operational_api.sql, SHA-256 BC83666B4FFD916FA8E7FA7EBC03800C6F61E0A3B852C851BE70C5BE1498F3C3. It was extracted from git cat-file without newline conversion. Preserve the historical C6 report as non-authoritative; exact-baseline Actual and Upgrade runs use BC8366.

The recheck records RR PID, authenticated claims, transaction_isolation, txid_current_snapshot(), the employee's pre-read, the committed revocation snapshot, same-transaction replay, and complete final snapshots. Exact-baseline Actual and Upgrade both reproduce the unauthorized replay as SQLSTATE 00000 after revocation and after profile inactivation. The Upgrade path preserves every pre-existing entry/task column and the complete authentic receipt, while separately asserting all six columns added by SQL014 and their defaults/backfill values.

Candidate green Actual and Upgrade each pass eight replay/revocation races across RC/RC, RC/RR, RR/RC, and RR/RR, both winners. Reports retain PIDs, blocker sets, claims/isolation, complete snapshots, rollback, post-retry state and deltas. Argument conflicts are recorded with complete before/after snapshots in active state, after revocation with either winner order, and with an inactive profile.

No hosted Supabase/API, service, commit, or push was used. Independent Sol acceptance remains pending.
