# Contrato 005 — corrección de cobertura y cronómetros

Revisión Sol 6.1, 01/10/2026, sobre `f547d006b2e191968e3a6a9f20b2778a140a1c6e`.
**Estado: especificación aprobada para ejecución local con GPT 6 Luna, esfuerzo medio.**
004 no cumple todavía todos los requisitos y no está aprobada para aplicación remota.
Esta ejecución corrige la base antes de adaptar el frontend. No crear infraestructura,
importar empleados, aplicar SQL remoto ni enviar correo.

## Alcance y secuencia de ejecución

1. Crear una sola migración transaccional `202610010005_time_coverage_hardening.sql`.
   Preservar las migraciones publicadas 001–004, datos, IDs, revisiones históricas,
   pesos y snapshots. Reemplazar RPCs/helpers en 005 y agregar restricciones/trigger
   explícitos cuando se indican abajo. No modificar el frontend.
2. Escribir regresiones funcionales en `tests/database.test.ts` o separar la suite
   SQL en `tests/time-coverage.test.ts` con su propio fixture. Los casos deben ser
   independientes; un error esperado no debe dejar una transacción abortada ni
   un reloj que contamine una prueba posterior.
3. Corregir el fixture de upgrade para que realmente aplique 004 y 005. Completar
   la guía de carreras PostgreSQL con transacciones y consultas de control.
4. Ejecutar `npm test`, `npm run build`, `git diff --check`. Registrar resultados
   exactos y límites. Publicar el código/build en Sites con audiencia privada.
   Continuar entre estos bloques sin pedir otro «continuar» ni cambio de modelo.

Si un preflight encuentra datos históricos incompatibles, abortar la migración,
conservarlos e informar IDs para revisión Sol; no elegir un ejecutor, borrar filas
ni inventar una historia. Si aparece una decisión fuera de este contrato, volver
a Sol 6.1 alto antes de programar la solución.

## 1. Identidad, argumentos y receipts

- Toda RPC nueva exige `auth.uid()` firmado no NULL. Rol/organización/actividad
  se obtienen de tablas servidor. No agregar parámetros públicos de actor, rol,
  organización, hora o duración.
- `p_expected_revision` requerido y no NULL; usar comparación que rechace NULL
  (`IS DISTINCT FROM`) después del lock de la instancia. Rechazar también valores
  negativos. `p_switch` no NULL: sólo TRUE permite cambiar un reloj vigente.
- Validar enums y argumentos requeridos explícitamente contra NULL. En espera,
  `p_note IS NULL` desbloquea; `nullif(trim(p_note),'') IS NULL` con entrada no NULL
  es inválida. Misma regla para motivos de reapertura/interrupción. No guardar
  una espera con descripción vacía.
- Actor activo para operaciones ordinarias. **Única excepción: pausar su propia
  sesión con identidad firmada, aun estando suspendido o sin acceso a la tarea.**
  Derivar la organización del registro de sesión propio; comprobar pertenencia
  del perfil a esa organización sin exigir `active`. No retornar la tarea.
- Adaptar helpers privados de receipt para esa excepción; no depender de
  `actor_org()` en lookup/save de pausa suspendida. Cualquier parámetro interno
  de organización/excepción debe derivarse en servidor y el helper debe tener
  EXECUTE revocado a PUBLIC/anon/authenticated. No abrir la excepción a otras RPCs.
- Lock de receipt por actor+operation UUID antes de cualquier otro lock advisory.
  Misma clave+acción+argumentos retorna resultado inicial sin nueva escritura,
  incluso si ya terminó la sesión. Misma clave con otro contenido falla íntegra.
- **Todo éxito guarda receipt**, incluidos no-op y retorno de sesión ya abierta.
  `start_task_timer` con operación B sobre un reloj ya iniciado por A debe guardar
  B. Pausarlo y reintentar B devuelve aquel UUID terminado, sin reactivarlo ni
  rechazarlo por la revisión que cambió después. Resultado/argumentos del no-op
  deben coincidir exactamente con el lookup; nunca agregar sólo al guardar un
  campo extra como `operation`.
- Wrappers viejos generan UUID de servidor y delegan al mismo núcleo seguro.
  No adquieren owner/month locks antes del receipt/timer lock del núcleo. Pueden
  obtener una revisión de servidor sin lock y recibir conflicto si cambió antes
  de la delegación; no deben eludir el chequeo. Validar autorización antes de
  revelar si una tarea/mes existe o está cerrado. Sin motivo, no reabrir ni
  interrumpir el reloj de otra persona. Documentar falta de idempotencia de
  reintentos de las firmas viejas, especialmente `record_activity`.

## 2. Protocolo único de locks

Orden obligatorio para cada escritura:

1. Receipt actor/operation.
2. `timer-actor:` + actor firmado cuando la RPC puede iniciar, cambiar o pausar
   un reloj propio. `start_task_timer`, pausa y los núcleos de transición/checklist
   toman ese guard antes de cualquier owner guard. Espera puede tomar el guard
   del actor firmado por coherencia; nunca el de otro ejecutor después de owner.
3. Todos los `work-owner:` de propietarios afectados, UUID ascendente. En cambio
   de reloj incluir origen y destino. Aprobación/cancelación de ausencia y cierre
   toman owner guard; **no toman posteriormente un timer-actor guard**.
4. Locks de empleado/mes existentes, ordenados por `(owner_id, period)`; usar el
   mismo hash de `lock_open_month`. Periodos afectados se conocen antes de tomar
   locks de fila y se revalidan después. `materialize_month` conserva su camino
   de lock mes, sin adquirir después owner guard ni llamar un núcleo que lo haga.
5. Instancias UUID ascendente; sesiones UUID ascendente; ausencia afectada cuando
   corresponda. Pausa no puede bloquear sesión y después instancia. Evitar locks
   de fila previos a guards que el resto adquiere antes de esa fila.

El owner guard común permite al responsable/cancelación/cierre detener una
sesión de otro ejecutor sin adquirir su timer-actor guard: sus inicios/pausas y
cambios también deben pasar por ese owner guard. Nunca introducir un ciclo
owner → timer-actor frente al inicio timer-actor → owner.

Después de los locks, volver a comprobar actor activo/rol, membresías, autorización
permanente o cobertura, estado/revisión y cierre. La comprobación antes de esperar
el lock sólo sirve para rechazo temprano. **No autoriza una escritura después de
una cancelación que ganó el guard.** Centralizar esa verificación en helper privado
si evita diferencias entre start/transition/checklist/wait/activity.

`pause_task_timer` es excepción de permiso de tarea, pero no de período abierto:
si una sesión abierta aparece en un mes ya cerrado, error íntegro sin tocar sesión,
instancia, snapshot ni receipt. Una sesión ya terminada puede devolver su resultado
como no-op sin escribir datos del período cerrado.

## 3. Reloj servidor y límites de cobertura

- Capturar un instante `clock_timestamp()` **después** de adquirir guards/locks
  necesarios. Usarlo consistentemente en esa operación para horas, fecha ART,
  inicio/fin y auditoría. No usar `now()` capturado al principio de una transacción
  que puede esperar: una llamada que comenzó antes de medianoche no conserva una
  autorización vencida al conseguir el lock. Lectura RLS puede evaluar la cobertura
  con `statement_timestamp()`; el núcleo de escritura revalida con su instante
  posterior al lock y la zona `America/Argentina/Buenos_Aires`.
- Límite de sesión con ausencia: mínimo entre instante propuesto, comienzo ART
  del día `ends_on + 1`, y `cancelled_at` si existe. `COALESCE(cancelled_at,expiry)`
  no cumple esto cuando cancelación ocurrió después de la expiración.
- Aplicar el mismo helper de límite en pausa, switch, completar, checklist,
  bloquear, cancelar y cierre. No terminar una cobertura vencida a la hora del
  siguiente login/cancelación. Sin ausencia, límite = instante propuesto.
- Sesiones expiradas conocidas se finalizan bajo los mismos guards/períodos antes
  de tratar un reloj como vigente. Un origen propio expirado no exige `p_switch`
  para comenzar otra tarea autorizada. Una sesión expirada de otra persona en
  destino se termina como expiración auditada, no como toma de posesión; sólo se
  permite trabajo nuevo si la autorización actual/revisión/período lo permite.
  Una operación inválida revierte también cualquier limpieza realizada dentro
  de ella. Pausar sigue siendo el camino disponible sin permiso de la tarea.
- Si hay historia con inicio posterior al límite efectivo o vínculo de cobertura
  incoherente, preflight/error de datos: no fabricar duración cero ni cambiar
  `started_at`. Nuevas sesiones obtienen inicio/ausencia sólo de servidor.
- Una revisión por tarea afectada por operación efectiva, aunque cambien a la vez
  estado y sesión. Switch incrementa origen y destino. Pausa/expiración/cancelación
  incrementan las instancias cuyas sesiones terminaron. No-op no incrementa.
  Actividad efectiva conserva incremento; replay no crea cantidad ni revisión.

## 4. Estados, checklist, espera e intervención

- Pending → En curso inicia sesión propia atómicamente. No iniciar si hay bloqueo
  de espera, si el mes está cerrado o si hay otro reloj propio vigente. El cambio
  implícito de reloj está prohibido en transición/checklist: usar start con switch.
- Primer control realizado sobre pendiente inicia sesión sólo si el estado final
  queda En curso y no está en espera. Marcar controles durante espera es permitido,
  pero conserva Pendiente/En curso, no inicia reloj ni completa. Si un único control
  termina el entregable en la misma operación, se completa sin reloj abierto y sin
  inventar duración medida. Conservar fecha de inicio de trabajo ya existente;
  el primer evento de realización puede fijar `started_at` servidor sin atribuir
  segundos a una sesión inexistente.
- Último control de entregable completa y detiene sesión en la misma transacción.
  Operativa no se completa por checklist. Reapertura necesita motivo, produce un
  evento explícito y no activa reloj. No-op de estado/control conserva fechas,
  revisión y cantidad de eventos.
- Completar, volver a Pendiente y bloquear pausa el reloj vigente. Si su ejecutor
  es otro actor, exigir responsable **permanente** sobre titular/empresa, rol
  jefe/encargado activo, `aal2` y motivo no vacío. El encargado que sólo tiene
  cobertura temporal no puede interrumpir al otro. Empleado no interrumpe aunque
  sea titular. Este guard se aplica igual en transición, checklist y espera.
- Motivo de intervención: `p_reason` para transición/checklist; descripción
  `p_note` para bloquear. Auditar actor que interviene, ejecutor, tarea, sesión,
  motivo y límite efectivo. Wrapper sin motivo sólo detiene sesión propia.
- `p_note=NULL` exclusivamente desbloquea: no detener un reloj, no iniciar uno,
  no generar reapertura. Si ya estaba desbloqueada es no-op con receipt. La espera
  bloqueada guarda descripción limpia y fecha ART; repetir mismo valor sin cambio
  no altera revisión/tiempos, salvo una sesión vigente que realmente deba detenerse.

## 5. Aprobación/cancelación de ausencias y ámbito

- Superposición prohibida para cualquier ausencia no cancelada del titular,
  **también sin reemplazante**. Serializar por owner guard. Fechas DATE inclusivas;
  validar NULL, orden y tipo. Empresas con reemplazante: no vacías, sin UUID NULL
  ni duplicados; ambos activos y miembros permanentes de cada empresa. Sin
  reemplazante: no filas de empresas ni autorización temporal.
- Jefe MFA puede cruzar equipos de su organización. Encargado MFA tiene titular
  y reemplazante en ámbito permanente y membresía en todas las empresas. Revalidar
  estas reglas bajo guard al aprobar. Mismas reglas de ámbito al cancelar una
  autorización existente; jefe puede cancelar si la asignación del encargado
  cambió. Si no hay reemplazante, comprobar ámbito del titular solamente.
- Cancelar recoge períodos de sus sesiones abiertas bajo owner guard, adquiere
  month locks ordenados y revalida cierre antes de escribir. Mes cerrado con sesión
  abierta: conflicto total. Congelar `cancelled_at` una sola vez; detener relojes
  con mínimo expiración/cancelación y auditoría. Cancelación ya realizada con otra
  operación es no-op con receipt, conserva corte/motivo original y no duplica evento.
- No reescribir titular, reemplazante, fechas, empresas ni aprobador para corregir
  la autorización: cancelar y crear nueva. RLS no amplía perfiles/usuarios/catálogo,
  pesos, asignaciones, cierre ni reportes. Ausencia legacy sin empresas sigue sin
  autorizar tareas; no inferir empresas durante esta migración.

## 6. Integridad e historia

- `task_reopen_events.actor_id` con FK `(actor_id,organization_id)` a perfiles.
  Actor NULL sólo para historia legacy; explícitos requieren actor/motivo. Agregar
  FK a audit histórico con organización (unique de audit si es necesario), y
  trigger que rechace UPDATE/DELETE de eventos de reapertura. Mantener sólo las
  RPC autorizadas para INSERT; no conceder DML cliente ni EXECUTE helpers.
- Preflight identifica eventos legacy de reapertura con tarea inexistente o
  organización incompatible. Actor histórico NULL se conserva; actor de otra
  organización es conflicto, no se reemplaza por NULL automáticamente. 004 puede
  haber omitido un audit huérfano por INNER JOIN; 005 lo verifica en audit original.
  Backfill sólo referencias válidas explícitas y sólo si falta su legacy_audit_id.
  Checklist antiguo sin from/to sigue sin historia inferida.
- Preservar snapshots 003/004 existentes byte a byte. Nuevos cierres conservan
  snapshot versión 3, eventos explícitos/source/motivo y sesiones atribuidas al
  ejecutor/ausencia. No regenerar reportes ni entregas anteriores. Owner guard
  antes de mes, expiración antes de rechazo de relojes vigentes, cierre/reporte/
  entrega/outbox idempotentes y atómicos. No agregar cierre automático por calendario.

## 7. Matriz mínima de aceptación

### Regresiones reproducidas, todas deben pasar con resultado corregido

| Caso | Resultado requerido |
| --- | --- |
| expected_revision=NULL en start/transición/checklist/espera | Rechazo sin cambios ni receipt |
| p_switch=NULL con origen vigente | Rechazo; origen sigue abierto y destino pendiente |
| Titular suspendido pausa su sesión | Éxito, único fin, sin lectura/escritura de tarea adicional |
| Inicio no-op con nuevo UUID, pausa, replay del UUID no-op | Mismo UUID original terminado; receipt existe, no nueva sesión |
| Pendiente bloqueada → En curso por transición/checklist | No inicia reloj; transición de inicio rechazada, checklist mantiene espera |
| Empleado completa checklist con reloj de otro | Rechazo total, checklist y reloj intactos |
| Jefe/encargado detiene a otro sin MFA o motivo | Rechazo; con MFA/motivo y ámbito permanente funciona/audita |
| Dos ausencias superpuestas sin reemplazante | Segunda rechazada; una sola fila |
| Espera compuesta por espacios | Rechazo; no guarda blocked_by vacío |
| Cancelación posterior a expiración | Sesión termina exactamente en medianoche ART de ends_on+1 |
| Sesión abierta en mes cerrado; actor intenta pausar | Rechazo íntegro; snapshot/sesión sin cambios |

### Ámbito y operaciones no cubiertas por la suite anterior

- Reemplazante fuera del equipo permanente: cobertura sólo empresa A, no B,
  otro mes fuera del rango, otro tenant, perfil del titular, asignaciones,
  pesos, administración, cierre ni reportes. Probar SELECT RLS y RPC de escritura.
- Antes/después del rango, cancelada, replacement suspendido, titular suspendido,
  membresía faltante y ausencia legacy sin empresas: denegar trabajo. Hora exacta
  ART cerca de medianoche: verificar fórmula con instantes fijos mediante helper
  privado sólo como superusuario de test; no exponer reloj simulable al cliente.
- Encargado no aprueba/cancela cross-team ni empresas fuera de sus membresías;
  jefe MFA sí en su tenant. Membresía de ambos exigida, NULL/duplicado rechazado.
- Start/pausa/reanudación produce varias sesiones sin superposición; no toma otro
  ejecutor. Inicio en completada/espera/cierre se rechaza. Switch inválido por
  cualquiera de estas causas no pausa origen; válido entre meses incrementa ambas
  revisiones y conserva started_at. Source closed no se modifica.
- Desbloquear no inicia/pausa reloj; completar/checklist sí termina sesión propia;
  reabrir con motivo crea un evento y replay ninguno adicional. No-op conserva
  completed_at y revisión. Wrappers viejos no dejan bypass de permisos/reapertura.
- record_activity_once replay no duplica cantidad/entry/revisión; op UUID con
  argumentos distintos falla. Fecha ART dentro de período, qty/reference válidos,
  actor real y cobertura. Sesión expirada finaliza por límite también en cierre.
- DML directo y EXECUTE de helpers siguen denegados a anon/authenticated. Eventos
  de reapertura inmutables y referencia de actor/empresa/organización íntegra.

### Fixtures y evidencia

- Helper `actor(uid, aal='aal1')` debe establecer **sub y claims** cada vez. MFA
  de una prueba no puede quedar heredada para la siguiente. Marcar explícitamente
  `aal2` en casos de jefatura/responsable que deben permitirse.
- La prueba upgrade previa terminaba en 003: agregar carga explícita 004 y 005.
  Crear antes de ellas cierre y period_report versión 2, audit de reapertura válida
  (incluido actor histórico NULL) y sesiones históricas. Comparar snapshots::text,
  IDs, pesos/checklist y sesiones después. No basta crear tablas sobre base vacía.
- Fixture separado 001–003 con dos actores abiertos en una tarea: 004 debe abortar
  y preservar filas/esquema previo tras ROLLBACK. Fixture con referencias históricas
  inconsistentes: 005 aborta con IDs, sin backfill ficticio.
- Aislar el test nuevo de cronómetro de la prueba vieja de cierre: ésta vuelve a
  comprobar exactamente 1800 segundos y una sesión propia del fixture, sin margen
  artificial `<1801` ni contar una sesión residual de otra prueba. Se conserva la
  expectativa legítima de snapshot versión 3 para un cierre nuevo.
- PostgreSQL entre conexiones: preparar guiones psql con UUIDs/roles de fixture,
  BEGIN/COMMIT/ROLLBACK y JWT local de cada conexión. Mantener primera transacción
  abierta para que la segunda espere el guard; probar ambos órdenes de cierre vs
  inicio y cancelación vs inicio, dos actores/misma tarea y mismo actor/dos tareas.
  Añadir pausa vs completar y wrapper vs start para detectar locks invertidos.
  Cada caso incluye SELECT de control de sesiones, estados, snapshots y receipts.
  Una única sesión no ejecuta dos llamadas concurrentes. Sin PostgreSQL disponible,
  mantener estos guiones como **NO EJECUTADOS**, sin instalar/configurar servicios.

## Salida exigida a Luna

Código 005 + tests + guía; resumen de lo corregido y de la matriz probada; cantidad
real de pruebas; build/diff; commit/push/deploy confirmados. Enumerar cualquier
aceptación no alcanzada sin afirmar que el backend está aprobado. Próximo modelo
Sol 6.1 alto para revisar el resultado antes de crear adaptador/API de frontend.
