# Contrato 008 — correcciones acotadas y aceptación pendiente

Revisión del 01/10/2026 sobre `db30dcd075cf5e795f1f93ad6657377d8942c747`.
**Aprobado para ejecución local GPT 6 Luna, esfuerzo medio.** Implementar este
contrato y la aceptación pendiente de 007 sin tomar decisiones nuevas de producto.
Evidencia: `REVIEW-007-20261001.md`. Luego revisión **GPT Sol 6.1 alto**.

## Entrega

- Nueva `202610010008_time_coverage_finalization.sql` transaccional. Preservar
  001–007 byte a byte, firmas públicas, UUID, snapshots, sesiones cerradas y
  eventos históricos. No backfill correctivo ni limpieza de historia automática.
- Preservar probes 004–007, fixture PostgreSQL 007 y evidencia de revisión.
  La aceptación nueva debe cargar hasta 008; los probes históricos conservan sus
  límites. Extender la guía con un fixture 008 cuando necesite estados nuevos.
- No modificar frontend, aplicar SQL remoto, instalar PostgreSQL, crear cuentas,
  servicios, migrar empleados ni enviar correo. Publicar sólo en Sites privado.
- Respetar orden de guards/locks, instante único de operación, revisión única por
  tarea, permisos actuales después de locks y rollback íntegro de 006/007.
  Si aparece una decisión arquitectónica fuera de este contrato, anotarla para Sol.

## A. Control sin cambio — R007-01

Al planificar checklist bajo timer-actor, validar que el paso existe y calcular
`changes_check` desde el valor normalizado actual. `needs_start` sólo puede ser
TRUE si el control cambia y el estado final calculado realmente inicia reloj.
Un control ya igual es no-op: bloquear destino con su owner/mes/instancia y
revalidar identidad, permisos y revisión; guardar receipt con la revisión actual.
No leer/bloquear ni limpiar el reloj propio de otra tarea. No emitir auditoría ni
reapertura. Recalcular desde filas bloqueadas y verificar coherencia con el plan.
Un cambio real que necesita origen en mes cerrado sigue fallando sin efectos.

## B. Contexto de cronómetros — R007-02/03

Separar, en wait/checklist/transition, estos datos: sesión histórica de destino,
sesión vigente de destino, fin efectivo de destino y fin efectivo de origen.
Se pueden usar records/variables; no agregar persistencia redundante. No reutilizar
un único ended para dos sesiones distintas. Limpiar reloj vigente nunca borra la
identidad necesaria para auditoría.

- Espera con destino vencido: timer_expired y task.wait conservan session,
  executor, instance (entity_id del wait ya identifica destino), absence,
  started_at y ended_at efectivos, con at igual al instante de operación.
- Transición/checklist con ambos relojes vencidos: ambos timer_expired describen
  su sesión real. Evento de tarea de destino usa exclusivamente contexto/fin de
  destino. Si no hubo sesión de destino, sus campos de reloj son NULL; la
  expiración de origen sigue en su evento propio. No atribuir su tiempo al destino.
- Expiración + nuevo inicio: una revisión por instancia modificada. Misma tarea
  de origen/destino no duplica revisión ni evento de expiración.
- Rechazo posterior, revisión inválida o origen vigente sin switch revierten toda
  limpieza, estado, audit y receipt. La intervención sobre ejecutor ajeno vigente
  mantiene ámbito permanente, MFA y motivo de 007.

## C. Sello como condición de cobertura — R007-04

Reemplazar `can_cover_instance(uuid)` y `_can_access_instance_at(uuid,timestamptz)`
en 008 para exigir `x.authorization_sealed` en la rama de cobertura temporal.
Mantener el resto de condiciones: actividad/organización, empresas de ambos,
fechas ART, período, identidad del reemplazante y ausencia no cancelada.
`can_access_instance` delega en el helper público, así que debe heredar el cambio
para RLS. No restringir el acceso permanente por una ausencia sin sellar.

No conceder EXECUTE sobre el helper privado a PUBLIC/anon/authenticated; mantener
SECURITY DEFINER con search_path vacío y ACL de funciones públicas. Replay
escalar exacto conserva su excepción; una clave nueva exige permisos actuales.
FALSE→TRUE sellado autoriza únicamente empresa/período de esa cobertura.

## D. Coherencia del plan — L007-01

En start/checklist/transition/wait conservar identidad de destino planificada:
id, organization_id, assignment_id, company_id, owner_id y period. Después de
tomar todos los locks, releer y comparar antes de cualquier escritura. Si falta
fila o cambia identidad, conflicto íntegro. No tomar locks adicionales fuera de
orden para continuar. Mantener comprobación de revisión esperada y comparación
del origen ya implementada. Checklist valida también que needs_start real no
exige un origen excluido del plan.

Pausa relee tarea y sesión después de locks; compara esa identidad de tarea y
pertenencia/identidad de sesión. Puede aceptar cambios legítimos de estado/revisión
que sólo finalizaron la sesión mientras esperaba: su firma no tiene revisión
esperada. Ya terminada devuelve ended_at sin otra escritura histórica aunque el
mes esté cerrado; abierta comprueba el mes bloqueado. Actividad/membresía retirada
no elimina la excepción de pausa propia; no permite pausar una sesión ajena.

No hay prueba de carrera real disponible. Si se instrumenta un helper sólo en
fixture para cambiar identidad entre lectura y locks, marcarlo como inyección
sintética, restaurarlo con rollback y no presentarlo como concurrencia PostgreSQL.

## E. Aceptación y aislamiento

Crear `tests/time-coverage-008.test.ts`. Fixture transaccional por caso o base
descartable, JWT sub/aal y rol explícitos. Ante SQL esperado fallido dentro de
transacción usar savepoint y restaurarlo; no catch amplio para esconder errores.
Evitar cleanup que modifica sesiones de otros casos. Reparar las tres pruebas de
reportes de database.test para que preparen su propio reporte/delivery/outbox.

| Grupo | Asserts |
| --- | --- |
| R007-01 | Control ya igual con otro reloj en mes cerrado: no-op + receipt, no auditoría/revisión, origen idéntico; cambio real que sí inicia falla íntegro. |
| R007-02 | Espera expirada por fecha y cancelación: ambos eventos con contexto completo comparado con filas; nueva/repetida clave no duplica; una revisión. |
| R007-03 | Destino y origen vencidos con distintos cortes, transición y checklist: session/executor/absence/inicio/fin exactos por evento; sólo destino nuevo abierto; rollback posterior sin limpieza. También origen vencido sin reloj de destino: audit del destino no usa fin de origen. |
| R007-04 | FALSE no permite lectura por RLS ni wait/checklist/transition/activity con nueva clave; TRUE habilita sólo empresa/período; fuera de rango, cancelación, suspensión o retiro de membresía denegados. Acceso permanente sin cambios. |
| Plan | Relectura/identidad de cinco RPCs, revisión inválida y rollback. Inyección sintética opcional documentada; carreras reales pendientes. |
| Regresiones | Mantener los casos útiles previos: desbloqueo NULL sin tocar clocks propios/ajenos incluso vencidos; pausa ended tras cierre; pausa propia sin membresía/suspendida; activa en mes cerrado falla; rechazo ajeno; inmutabilidad/sellado; aprobación/cancelación at exacto; cancelación repetida preserva anomalía histórica; operativa no autocompleta; actividad/receipts sin duplicados ni DML/helper expuesto. |

Convertir los upgrades de los probes 007 en asserts reales en bases separadas:
0.3→001–008, 004→005–008, 005→006–008 y 006→007–008, más 007→008.
Antes/después comparar filas completas de sesiones/auditorías/reaperturas y
receipts, UUID/times de ausencia, snapshot::text de cierres/reportes e IDs/estado
de delivery/outbox. Admitir actor legacy NULL y membresía/actividad retirada
después de historia válida. El sello añadido por 006 no exige reconstruir empresas.

Abortos en bases separadas: múltiples relojes al aplicar 004, sesión incompatible
con ausencia, inicio después del corte, reapertura huérfana y actor de otra org al
aplicar 005/006. IDs del error, rollback de DDL/funciones y conservación completa
de filas. Mantener guards existentes; no inferir correcciones históricas.

Reporte: una sesión cerrada fija de exactamente 1800 segundos y cantidades
operativas conocidas, assert exacto para ambos. Otra fixture independiente prueba
cierre bloqueado por reloj abierto. Delivery/lease/reintentos se prueban con
datos propios y destinatario verificado. Confirmar cierre/reporte/outbox únicos y
snapshots idénticos ante repetición. Reparar ended_at auto-comparado de 006 contra
la fila real; sustituir el reporte aproximado de database.test con datos fijos.
No declarar envío de correo por observar outbox local.

## F. Guía futura PostgreSQL — L007-02

Completar `docs/ops/TIME-COVERAGE-VALIDATION.md`:

- createdb y psql usan el mismo servidor/puerto/usuario/base; configuración
  explícita coherente para laboratorio, sin asumir credenciales no creadas.
- SQL de preparación, comandos A/B, COMMIT/ROLLBACK y asserts que fallen ante
  estado incorrecto para cada par. Cubrir ambos órdenes: inicio/inicio,
  switch/pausa, cierre/inicio y switch, cancelación/inicio, retiro de permiso
  mientras espera guard, vencimiento ART, INSERT empresa/sellado y replay.
- Repetición desde base limpia, UUID/roles concretos y setup del reloj previo
  requerido. Una lista narrativa no sustituye SQL ejecutable.
- Mantener **NO EJECUTADO**. No instalar motor ni iniciar conexiones reales en
  este contrato local; guardar sólo guía/fixtures para el futuro laboratorio.

## Salida y siguiente modelo

Ejecutar npm test completo, casos 008 críticos solos y las tres pruebas de reportes
reparadas cada una sola; registrar comandos/resultados y número real de tests.
Luego npm run build y git diff --check. Comparar bytes 001–007 y probes congelados
con HEAD revisado. Registrar alcance, matriz probado/inspeccionado/pendiente en
`REVIEW-008-EXECUTION-20261001.md`. Commit/push y deploy privado Sites del mismo
SHA. Después **GPT Sol 6.1 alto**, revisión de 008 y de aceptación pendiente.
PostgreSQL real y Supabase Auth/invitaciones/MFA/RLS/correo siguen siendo gates
anteriores a producción y migración de empleados.
