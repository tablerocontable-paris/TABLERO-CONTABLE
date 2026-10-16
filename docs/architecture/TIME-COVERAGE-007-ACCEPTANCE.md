# Contrato 007 — completar aceptación de cronómetros y coberturas

Revisión del 01/10/2026 sobre `0df96abcd853ccec00a8ecbd02327cccd6b52415`.
**Aprobado para ejecución local GPT 6 Luna, esfuerzo medio.** Implementación
local completada; revisión terminada con correcciones y aceptación pendientes
en `TIME-COVERAGE-008-ACCEPTANCE.md`. Evidencia y límites:
`REVIEW-006-20261001.md`, `REVIEW-007-EXECUTION-20261001.md` y `REVIEW-007-20261001.md`. Este contrato complementa 006;
sus reglas de permisos, replay, reporte y conservación histórica siguen vigentes.

## Entrega y límites

1. Nueva migración `202610010007_time_coverage_completion.sql`, BEGIN/COMMIT.
   Preservar 001–006 byte por byte, firmas públicas, UUID, snapshots, filas cerradas
   y eventos anteriores. No reparar historia automáticamente ni inferir empresas.
2. Aceptación Vitest independiente de cada caso y upgrade con datos poblados.
   Los scripts de revisión 005 y 006 quedan congelados en sus versiones respectivas.
   Un diagnóstico que termina con exit 0 no sustituye un assert de aceptación.
3. Completar la guía de concurrencia futura con SQL ejecutable; mantenerla
   **NO EJECUTADA** hasta tener evidencia de dos conexiones PostgreSQL reales.
4. Registrar evidencia local, commit/push y deploy privado Sites del mismo SHA.
   Luego revisión **GPT Sol 6.1, esfuerzo alto** antes de ampliar alcance.

No modificar frontend, instalar PostgreSQL, aplicar SQL remoto, crear cuentas o
servicios, migrar empleados ni enviar reportes externos durante esta ejecución.
Si aparece una decisión arquitectónica nueva, documentar y volver a Sol 6.1.

## A. Protocolo común

Mantener orden: receipt → timer-actor firmado cuando corresponde → owners UUID
ordenados → meses `(owner,period)` ordenados → instancias UUID ordenadas → sesiones
UUID ordenadas → ausencia cuando corresponde. Cierre/cancelación no toman un guard
timer-actor después de owner. Deduplicar filas antes de bloquearlas.

- Planear el alcance bajo el guard inicial. Tras adquirir todos los locks, releer
  destino **y origen necesario**, sesiones y autorizaciones. Revalidar revisión,
  owner, período y pertenencia al conjunto bloqueado antes de escribir. Si cambió
  esa identidad, conflicto íntegro; no ampliar locks en orden inverso.
- Capturar una vez `clock_timestamp()` después del último lock necesario. Usar
  ese instante para permisos temporales, nuevo inicio/aprobación/cancelación y
  `audit_events.at` explícito. El fin efectivo puede ser anterior por corte ART.
- Sesión cubierta vencida: corte mínimo de fin de ausencia ART/cancelación <=
  instante de operación. Clasificarla antes de considerarla un ejecutor activo.
  Mantener historial de la sesión separado de la variable que indica reloj vigente.
- Una revisión por instancia modificada, aunque vencimiento y nuevo inicio afecten
  esa misma instancia. No-op no revisa. Error revierte sesiones, tarea, eventos y
  receipt. Una sesión abierta en mes cerrado sigue siendo conflicto íntegro.
- Revalidar actividad, organización, empresa y jerarquía/cobertura después de locks.
  Mantener excepción de pausa propia suspendida/sin membresía y replay escalar
  exacto ya definido en 006. UUID con contenido distinto falla; nueva clave exige
  permisos actuales salvo esa excepción. No retornar tareas desde receipts.
- Helpers privados SECURITY DEFINER con search_path vacío y sin EXECUTE para
  PUBLIC/anon/authenticated. No introducir hora, rol u organización del cliente
  como permiso. Conservar denegación de DML directo y firmas legacy.

## B. Espera — R006-01/09

**NULL sólo desbloquea.** Con permiso vigente y revisión esperada, quitar blocked
y blocked_since, incrementar una vez y guardar receipt. No pausar ni limpiar
ninguna sesión propia/ajena, incluso vencida. NULL sobre tarea ya desbloqueada es
no-op. No exigir MFA por un ejecutor ajeno porque no se interviene su reloj. Si
hay cambio, auditar `task.wait_cleared` con actor/instancia/instante, sin simular fin.

Para texto no NULL: resolver reloj bajo locks; clasificar/limpiar vencimiento
antes de exigir intervención sobre otro ejecutor vigente. Una sesión vencida se
finaliza en el corte efectivo y genera `task.timer_expired`; luego registrar
`task.wait` en el mismo instante, con una sola revisión de tarea. Una sesión ajena
vigente conserva responsable permanente + MFA + motivo. Mismo texto con sesión
abierta es cambio efectivo; mismo texto sin sesión es no-op. Error no limpia nada.

## C. Transición/checklist/inicio — R006-02/03, L006-01

1. Bajo guard timer-actor leer destino/revisión y calcular tentativamente estado
   final. `needs_start` sólo si pasa de Pendiente a En curso y queda sin espera.
   Operativa nunca completa automáticamente; resultado con último control puede
   completar. Control único de resultado no genera sesión artificial.
2. Incluir el reloj propio de otra tarea y su origen en el plan de locks/limpieza
   **sólo si needs_start**. Completar/reabrir/no-op no depende de ese otro reloj,
   ni de sus permisos o mes. Siempre resolver la sesión del destino cuando el
   cambio sí la afecta.
3. Tomar locks ordenados; releer ambas instancias necesarias y verificar plan y
   revisión. Calcular estado final desde filas bloqueadas, capturar instante,
   revalidar permiso. No mutar con `source_task` obtenido antes de locks.
4. Limpiar destino cubierto vencido antes de tratar ejecutor distinto como activo.
   El actor con permiso actual sobre destino puede limpiar vencimiento sin MFA de
   intervención. Un ejecutor ajeno **vigente** conserva controles de 006.
5. Sólo si hace falta iniciar, limpiar origen propio vencido por fecha o
   cancelación. Origen vigente impide inicio implícito y revierte todo. Sólo
   `start_task_timer` con switch TRUE puede pausar origen vigente para cambiar.
6. `start_task_timer` mantiene semántica corregida de 006, incorpora relectura
   completa de origen y contexto de auditoría. Expiración + inicio: un incremento
   por tarea; switch entre tareas distintas: un incremento por cada una.

Toda finalización/intervención conserva actor, ejecutor, instancia, sesión,
started_at, ended_at efectivo, ausencia y motivo aplicable. No perder esos datos
al reemplazar la variable de sesión por el nuevo reloj o por un indicador NULL.

## D. Pausa — R006-04/08

Receipt → timer-actor → owner → guard advisory mensual → instancia → sesión.
Usar el mismo guard mensual que `lock_open_month` **sin rechazar temprano por
cierre**. No adquirir el guard de mes después de row locks.

- Tras locks y relectura, sesión ya finalizada propia: devolver ended_at escalar
  y guardar receipt de clave nueva, incluso con mes cerrado o actor suspendido/
  sin membresía. Sin limpieza/revisión/evento. Ajena sigue denegada.
- Sesión abierta: comprobar cierre mensual; cerrado rechaza sin cambios, incluso
  si la cobertura venció. Abierto: finalizar en mínimo de instante/corte efectivo,
  revisar una vez y emitir **exactamente un** evento: `task.timer_paused` si
  ordinaria, `task.timer_expired` si vencida. Campos completos del apartado C y
  event.at igual al instante capturado, sin tolerancias basadas en now.
- Replay/otra clave sobre sesión ya terminada no repite eventos ni incrementos.

## E. Ausencias — R006-05/06/07, L006-02

- Guard inmutable incluye **id y approved_at**, además de todos los campos
  protegidos en 006. No DELETE ni cambios de empresas selladas. Sólo sellado
  FALSE→TRUE con cancelación intacta y primera cancelación de ausencia sellada.
- Trigger INSERT de empresa toma `SELECT ... FOR UPDATE` de la ausencia padre
  antes de probar authorization_sealed. Así se serializa con sellado en servidor.
  La RPC mantiene owner guard; ninguna vía nueva concede DML al cliente.
- Nuevas aprobaciones: insertar approved_at = instante capturado tras locks y
  audit.at igual. Preservar tiempos/UUID anteriores sin backfill correctivo.
- Cancelación ya realizada con clave nueva: bajo receipt/owner/ausencia releída,
  revalidar MFA y ámbito permanente del titular/reemplazante/empresas. Retornar
  no-op con receipt y cutoff existente; no revisar, relimpiar sesiones históricas,
  cambiar motivo/corte ni emitir evento. No depender de meses/sesiones que esta
  cancelación no modifica. Si cambia permiso, fallar antes del receipt.
- Primera cancelación: owners/meses/instancias/sesiones ordenados y ausencia al
  final; revalidar tras locks. Capturar un instante, guardar cutoff y motivo una
  vez, finalizar sesiones al mínimo aplicable, revisión una por tarea distinta.
  Todos los eventos nuevos usan explícitamente ese instante; los detalles guardan
  fin efectivo aunque sea anterior. Sin finalizaciones posteriores al cutoff.

## F. Aceptación aislada obligatoria

Crear `tests/time-coverage-007.test.ts` y reparar aislamiento de las pruebas
anteriores afectadas. Cada caso establece JWT sub/aal y rol explícitos, fixture
propio con rollback/savepoints o base descartable. Restaurar manager/rol/actividad
en finally cuando haya mutaciones compartidas. Ningún test hereda actor/filas de
otro; los cambios no deben ocultar errores tras catch amplio.

| Grupo | Asserts obligatorios contra 007 |
| --- | --- |
| Regresiones 005 | Conservar las once previas y convertir los seis diagnósticos corregidos en aceptación real; no editar probes congelados |
| Espera | NULL propia/ajena deja sesión idéntica, +1 revisión sólo al desbloquear; repetido no-op; texto igual con/sin reloj; vigente ajeno denegado sin MFA y autorizado con MFA/motivo; vencido produce expiración y espera, una revisión |
| Destino vencido | Transición y checklist con cobertura ajena vencida por fecha/cancelación, titular autorizado: limpieza y nuevo estado/reloj correctos; error posterior revierte todo |
| Origen independiente | Transición y checklist que sólo completan resultado funcionan con otro reloj propio en mes cerrado; ese reloj/mes no cambian. Inicio que sí requiere ese origen cerrado falla íntegro |
| Pausa | Nueva clave sobre ended_at en mes cerrado no-op + receipt; abierta cerrada falla; ordinaria emite un timer_paused; vencida un timer_expired; replay no duplica. Propia suspendida/sin membresía y ajena denegada |
| Ausencia | UUID/approved_at y demás identidad inmutables; empresa insertable sólo antes de sello, no update/delete; primera cancelación exacta, segunda clave conserva incluso anomalía histórica de reloj abierto; timestamp de evento coincide con cutoff de operación |
| Ámbito posterior | Reemplazante sin jerarquía con dos empresas y sólo una cubierta; períodos fuera de rango, suspensión/retiro de membresía, equipos/org ajenos; encargado temporal no interrumpe ajeno, jefe MFA sí dentro de su org; nueva clave revalida, replay escalar no escribe |
| Actividad/RLS | record_activity_once no duplica cantidad/revisión; mismo UUID distintos args falla; mes cerrado/empresa ajena denegados; helpers/DML denegados a anon/authenticated; cobertura no amplía perfiles, pesos, asignaciones, reportes ni KPI técnico |
| Auditoría/revisión | Campos actor/ejecutor/sesión/inicio/fin/ausencia/motivo comparados con filas reales; event.at de una operación coherente; nunca comparar ended_at contra sí mismo; una revisión por instancia y rollback íntegro en errores |

Ejecutar la prueba que antes fallaba sola:
`npm test -- --run tests/time-coverage-006.test.ts -t 'limpia el reloj propio'`.
Ejecutar individualmente los casos 007 críticos de espera, pausa, finalización y
cancelación; registrar comandos/resultados. Suite verde completa no prueba aislamiento.

### Reporte y entrega

Fixture independiente con **una sesión cerrada fija de exactamente 1800 segundos**
insertada con inicio/fin válidos, sin editar una sesión finalizada; cantidades
operativas conocidas. Snapshot suma **exactamente 1800**, sin toBeCloseTo ni
segundos de otros casos. Otra fixture prueba cierre bloqueado por reloj abierto.
Cierre/reporte/delivery/outbox se crean una vez; repetición no duplica ni modifica
snapshot. Respetar gerente activo/email confirmado/MFA/empresas tras guards antes
de crear o devolver cierre. Outbox local no prueba email entregado a Juan Pablo.

### Upgrade y abortos

Bases separadas: contrato 0.3 → 001–007, 004 → 005–007, 005 → 006–007 y
006 → 007, con historia sintética poblada compatible con cada versión. Comparar
IDs y filas de sesiones/auditorías/reaperturas con actor legacy NULL; comparar
`snapshot::text` de cierres/reportes y IDs/estado de delivery/outbox. Una membresía
retirada o suspensión posterior no invalida historia compatible.

Abortos independientes: sesión incoherente, inicio posterior al corte, reapertura
huérfana/actor de otra org y múltiples relojes incompatibles al aplicar 004. Verificar
IDs reportados, rollback de DDL/funciones y conservación íntegra de filas. Si los
guards existentes ya cubren el aborto, mantenerlos; no agregar backfills silenciosos.
La regex de carga no puede omitir 006/007. Comparar bytes 001–006 con HEAD revisado.

### Guía PostgreSQL futura

Completar `docs/ops/TIME-COVERAGE-VALIDATION.md`: base local descartable, fixture
sintética concreta, roles/auth de prueba, carga 001–007, IDs fijos, bloques separados
A/B, COMMIT/ROLLBACK y consultas/asserts SQL. Cubrir ambos órdenes de inicio/inicio,
switch/pausa, cierre/inicio, cancelación/inicio, permiso retirado mientras espera
guard, vencimiento ART y empresa INSERT/sellado. Sin placeholders que impidan
ejecución. Mantener **NO EJECUTADO** y no presentar PGlite como prueba de locks.

## Salida de Luna

`npm test`, pruebas individuales indicadas, `npm run build`, `git diff --check`.
Registrar comandos, número real de pruebas, límites y matriz probado localmente /
inspeccionado / pendiente real en `REVIEW-007-EXECUTION-20261001.md`. Commit/push y
deploy Sites privado con SHA idéntico. Próximo modelo **GPT Sol 6.1 alto**, revisar
007 y sus fixtures. Auth/invitaciones/MFA/RLS real y dos conexiones PostgreSQL
siguen pendientes antes de aprobación productiva o migración de empleados.
