# Contrato revisado 004 — cronómetro, cobertura y reaperturas

Revisión 01/10/2026 sobre el commit 044c882. Documento listo para implementación con GPT 6 Luna, esfuerzo medio. No es código implementado ni autorización para conectar SQL remoto, crear cuentas o mandar correo.

## Hallazgos y decisiones

| Hallazgo confirmado | Decisión |
| --- | --- |
| employee_absences no tiene empresas | Relación employee_absence_companies; cobertura exclusivamente en la selección explícita |
| Un índice impide dos sesiones abiertas del actor, pero admite dos actores en la misma tarea | Un ejecutor por tarea y una tarea cronometrada por ejecutor; no tomar el cronómetro de un compañero silenciosamente |
| transition_task y set_checklist_item SQL no detienen sesiones | Completar, volver a pendiente o entrar en espera termina la sesión atómicamente |
| El checklist reabre sin motivo/from-to auditado | Evento explícito de reapertura y motivo obligatorio; no inferir historia anterior |
| can_access_owner controla perfiles/administración | Mantenerlo como acceso permanente; la cobertura sólo amplía acceso a tareas concretas |
| applyClock local pausa otras tareas sin revisar sus cierres | Cambio de cronómetro en servidor valida y bloquea ambos períodos, o revierte todo |
| create_catalog_assignment permite al empleado/encargado asignar estándares | Restringir la RPC pública a jefatura con MFA; la aprobación de inducción conserva su camino transaccional interno |
| No hay RPC de espera ni escrituras de cobertura/sesión | Añadir APIs explícitas; ningún DML directo de authenticated |

## Alcance de la migración

Crear únicamente `supabase/migrations/202610010004_time_coverage.sql`. No editar 001/002/003 ni el frontend durante esta ejecución. Mantener todas las pruebas previas excepto el caso que permitía crear asignaciones al encargado: ahora debe probar el rechazo y luego la creación por jefatura con MFA. No aplicar migraciones remotas.

Agregar:

- `employee_absence_companies(absence_id,organization_id,company_id)`, PK ausencia/empresa, FKs compuestas. Agregar unique(id,organization_id) a employee_absences para referencias compuestas.
- `task_time_sessions.absence_id` nullable con FK compuesta; identificar la cobertura al iniciar. started_at/ended_at siempre del servidor; el cliente no envía tiempos.
- Índice único parcial de sesión abierta por instance_id, además del existente por actor_id. Preflight: si una tarea ya tiene sesiones abiertas de varios actores, abortar la migración completa, informar IDs y volver a Sol para reparación. No truncar historia ni elegir un ejecutor arbitrario.
- `task_instances.state_revision bigint default 0 not null` para conflicto de estado. Incrementar en cambios de estado/checklist/espera/cronómetro; no inventar revisiones históricas.
- `task_reopen_events`: UUID, organización, instancia, actor, at servidor, motivo, source (`explicit`/`legacy_transition`), legacy_audit_id nullable único. Lectura por can_access_instance; escritura sólo RPC. FKs compuestas e inmutabilidad.
- `task_mutation_receipts`: organización, actor, operation_id UUID del cliente, operation_kind, arguments JSONB, result JSONB, created_at. Unique(actor_id,operation_id); sin DML/lectura directa. Una repetición idéntica retorna el resultado inicial sin ejecutar de nuevo; la misma clave con otra acción/argumentos da conflicto. Esto evita que reintentar un inicio ya pausado inicie un segundo cronómetro.

Organización, actor, rol y horas provienen del servidor. Firma de nuevos RPC usa UUIDs, `p_operation_id` obligatorio, expected_revision obligatorio para cambiar tarea; sin parámetros de rol/organización/actor del cliente.

## Ausencias y autorización temporal

RPC `approve_employee_absence(p_owner,p_replacement,p_kind,p_starts,p_ends,p_company_ids,p_note,p_operation_id)`; `cancel_employee_absence(p_absence,p_reason,p_operation_id)`.

- Jefatura/encargado activos con MFA. Encargado sólo sobre titular y reemplazante en su ámbito permanente, y todas las empresas seleccionadas en sus membresías. Jefatura puede aprobar cobertura entre equipos de la misma organización.
- Titular activo; reemplazante opcional, activo y diferente. Reemplazante sólo empleado/encargado operativo, nunca auditor/laboratorio. Si no hay reemplazante, registrar ausencia sin conceder cobertura.
- Con reemplazante: selección de empresas no vacía, sin duplicados; ambos tienen membresía permanente en cada empresa seleccionada. Sin reemplazante: no crear filas de autorización de empresa.
- Fechas DATE inclusivas, fin >= inicio, zona America/Argentina/Buenos_Aires; nota de traspaso funcional sin pedir causa médica. Una ausencia no cancelada por titular no se solapa con otra, independientemente de las empresas. Serializar aprobación por titular.
- Sólo crear y cancelar, sin reescribir fechas/titular/reemplazante del registro aprobado. Para cambiarlo: cancelar con motivo y emitir una nueva autorización, conservando historia.
- Ausencias preexistentes sin empresas NO conceden cobertura; conservarlas. Exigen nueva autorización explícita para poder utilizarse. No rellenar todas las empresas del titular por inferencia.
- Cobertura de una tarea: actor/reemplazante y titular activos, membresía de ambos en esa empresa, fila de empresa explícita, ausencia no cancelada y fecha actual ART dentro del rango. Además, period de tarea debe ser uno de los meses que intersectan el rango; no conceder automáticamente acceso al backlog histórico de otros meses.
- Cobertura no habilita perfil privado, usuarios, catálogo, pesos, programación, asignaciones, cierre, reportes ni aprobación. No modificar can_access_owner. Cambiar can_access_instance para permitir lectura permanente actual O la cobertura válida; escrituras además excluyen auditor y comprueban período abierto.
- Cancellation congela cancelled_at servidor y motivo auditado; cierra las sesiones asociadas que estén abiertas antes de devolver éxito. Si un período estuviera cerrado y contuviera una sesión abierta, devolver conflicto íntegro: no modificar un cierre.
- Expiración termina el cómputo en el inicio del día siguiente a ends_on en ART. Una sesión asociada a ausencia nunca acumula tiempo posterior a ese límite o cancelled_at. RPCs y cierre finalizan sesiones expiradas con ese límite canónico; no poner ended_at=hora del próximo login si ya venció la cobertura.
- RLS de employee_absences/employee_absence_companies: acceso permanente al titular o reemplazante de esa autorización en la misma organización; sólo datos de ausencia/traspaso/empresas. Ver su autorización pasada no conserva permiso de tarea. Clientes sin DML directo.
- Sin extender RLS a perfiles/relaciones del titular: la futura UI de cobertura usará datos mínimos de la tarea; no requerir el perfil completo para mostrarla.

## Cronómetro y estados

RPC `start_task_timer(p_instance,p_expected_revision,p_operation_id,p_switch boolean)` y `pause_task_timer(p_session,p_operation_id)`.

- Inicio: permiso de trabajo, período abierto, tarea no completada ni en espera. Pending → En curso y sesión creada en una operación; tarea ya En curso conserva started_at original. El estado esperado se revisa después del lock.
- Si la tarea ya tiene una sesión abierta propia y la operación es nueva pero no cambia nada, retornar esa sesión. Si la tiene otro actor, rechazar; no tomar posesión ni cerrar su reloj.
- Si el actor tiene otro reloj abierto y p_switch=false, error que identifique que debe pausar primero, sin exponer detalles de tarea fuera de su acceso actual.
- p_switch=true pausa únicamente la sesión anterior propia e inicia destino en una transacción. Validar destino antes de pausar; si falla acceso/estado/fecha/cierre, no modificar ninguna sesión. La pausa de la propia sesión no exige mantener cobertura vigente, pero nunca escribe en mes cerrado.
- Pausa admite auth.uid del ejecutor incluso si perdió permiso para la tarea o fue suspendido: sólo termina su sesión, sin devolver la tarea privada ni permitir otras escrituras. Para actor suspendido, derivar organización del registro de su sesión, no de actor_org() que devolverá NULL. Verificar identidad firmada; no aceptar actor enviado. Una sesión terminada retorna el mismo resultado al repetir.
- started_at/ended_at desde reloj de servidor y límite efectivo de cobertura; no aceptar fechas cliente ni duración calculada por el navegador. Cerrar pestaña no detiene un reloj propio vigente; no inventar atención registrada. Corrección de tiempo olvidado tendrá un contrato posterior auditado, sin DML directo.
- Lectura sessions_read permite actor_id=auth.uid() para su propio registro de tiempo mínimo, aun si expiró la cobertura, además del acceso válido a la instancia. Esto no devuelve el contenido de la tarea.

RPC `transition_task_reviewed(p_instance,p_next,p_reason,p_expected_revision,p_operation_id)`; `set_checklist_item_reviewed(p_instance,p_check,p_done,p_reason,p_expected_revision,p_operation_id)`; `set_task_wait(p_instance,p_note,p_expected_revision,p_operation_id)`.

- Pending → En curso equivale a iniciar reloj; si hay otro reloj propio, exigir cambio explícito, no hacerlo desde un cambio de estado accidental.
- Primer check realizado que pasa Pending a En curso inicia sesión. Último check de resultado que completa tarea detiene sesión en la misma transacción. No completar operativas por checklist.
- Completada → otro estado o desmarcar un check de Completada requiere motivo no vacío y crea exactamente un evento de reapertura. Reabrir deja En curso/Pendiente solicitado SIN activar cronómetro hasta un inicio explícito; distinguir revisión de trabajo efectivo. Repetir una operación no suma otra reapertura.
- Completada → Completada y check sin cambio son no-op: no cambiar completed_at, no sumar eventos, no incrementar revisión.
- Completar conserva las validaciones existentes de checklist/bloqueo/operativas. Pendiente, Completada o espera termina sesión activa. Si está ejecutando otro actor, sólo responsable permanente con MFA puede detenerla, con motivo auditado; otros actores no pueden interrumpirlo.
- Espera: p_note=NULL significa desbloquear; string no vacía significa bloquear (string vacía se rechaza), detiene reloj, mantiene estado; desbloquear borra blocked_by/blocked_since y NO inicia reloj hasta pulsar continuar.
- Mantener las firmas viejas transition_task(uuid,text) y set_checklist_item(uuid,text,boolean) como wrappers seguros con validación servidor, locks y auditoría. Sin motivo nunca permiten reapertura. Una operación vieja sin UUID usa UUID generado de servidor; sólo nueva API garantiza idempotencia de peticiones. No dejar la vieja ruta sin detener sesiones ni con bypass de autorización.
- record_activity conserva firma, registro cuantitativo y fecha dentro del período; adopta autorización temporal/locks y rechaza auditor/cierre. Cantidades siempre atribuidas al actor real; no alterar titular/peso. Idempotencia de carga operativa se agrega en `record_activity_once(p_instance uuid,p_work_date date,p_quantity integer,p_reference text,p_operation_id uuid)`; el wrapper viejo queda compatible, con límite documentado de reintento.

## Locks y carreras

Orden fijo en las RPC de mutación:

1. Lock advisory de actor+operation_id; revisar receipt de repetición y argumentos.
2. Para inicio/cambio de reloj: lock advisory `timer-actor:` + auth.uid.
3. Guards advisory `work-owner:` + owner_id de los propietarios afectados, ordenados por UUID. Incluye origen/destino al cambiar reloj. Ausencia/cancelación adquiere owner guard; no adquiere después actor lock (evita ciclo inverso).
4. Locks empleado/período existentes hash(owner_id::text || period::text,0), ordenados por owner_id y period.
5. Lock de filas de instancias/sesiones por UUID; revalidar estado, permisos y cierre dentro de la transacción.

Toda escritura de sesiones, estados, checklist, actividad, espera y cancelación debe seguir este orden. Cambiar close_employee_month para adquirir owner guard ANTES del lock mes; terminar sesiones de cobertura expiradas y luego rechazar sesiones realmente activas. Preservar su idempotencia y reporte/outbox atómico 003. El cierre no adquiere actor lock. Materialize_month comparte el lock de mes; no introducir una adquisición invertida de owner guard.

Dos inicios de distintos actores en la misma tarea: owner guard + fila + índice único, sólo uno tiene éxito. Dos inicios del mismo actor en tareas diferentes: actor guard + índice único, segundo rechaza o cambia según p_switch. Cierre/inicio: si inició primero, cierre rechaza reloj; si cerró primero, inicio rechaza mes cerrado. Cancelar/iniciar: si canceló primero, permiso denegado; si inició primero, cancelación termina sesión en su timestamp. No aceptar que un actor revierta un cierre para poder pausar.

Futuras RPC de suspensión/membresías deben usar owner guards y finalizar relojes antes de revocar permisos. No simular esa administración ahora; DML directo de perfiles/membresías sigue denegado al cliente.

## Reaperturas e historia del reporte

Migrar sólo audit_events explícitos task.transition con from=Completada/to distinto, y referencia legacy_audit_id única. Motivo `Transición histórica sin motivo registrado`, source=legacy_transition. No inferir eventos antiguos de texto o checklist. Preflight verifica referencias; no inventar actor faltante: actor nullable sólo para source histórico, documentado.

Nuevas reaperturas son source=explicit, actor/motivo obligatorios. Snapshot de NUEVOS cierres toma task_reopen_events de sus instancias, incluyendo source y motivo. No alterar snapshots/versiones ya cerrados en 003. Registrar cobertura/ejecutor por sesión; tiempo no es calificación automática. Historial viejo de checklist conserva limitación explícita.

## Casos de aceptación para Luna

Mantener 48 tests + build. Añadir casos PGlite con base vacía y upgrade 0.3→001→002→003→004:

- Preflight rechaza varios actores abiertos por tarea sin mutar filas previas; datos históricos/snapshots se conservan.
- Empleado/encargado no pueden saltarse inducción usando create_catalog_assignment; jefatura MFA sí.
- Una cobertura de empresa A no deja leer/escribir B ni perfil/administración/cierre/reportes del titular; ni amplía otro tenant.
- Antes/después del rango, cancelada, reemplazante suspendido, membresía faltante o ausencia legacy sin empresas: no da permiso. Fecha ART al borde de medianoche.
- Ausencia superpuesta/cross-team por encargado rechazada; jefatura puede aprobar entre equipos autorizados de la organización.
- Inicio idempotente, pausa/reanudación suma sesiones, no superponer actor ni tarea, completada/espera/cierre rechazados.
- Cambio de reloj inválido conserva reloj de origen. Pérdida de cobertura permite sólo pausar sesión propia, sin leer tarea.
- Expiración/cancelación corta exactamente en límite servidor; no acumular hasta próximo login. Cierre puede finalizar expirada y rechaza realmente activa.
- Checklist completa/pausa y reabre con motivo; wrapper antiguo sin motivo rechaza reapertura. No-op no altera fecha/revisión. Nueva operación repetida no duplica evento.
- Revisión obsoleta y UUID repetido con argumentos distintos fallan íntegramente. Actividad reintentada con UUID nuevo API no duplica cantidad.
- Snapshot nuevo usa eventos explícitos/sesiones; snapshot anterior sigue idéntico. No mail real ni infraestructura.

PGlite no valida carreras entre conexiones reales ni MFA/Auth productivo. Añadir `docs/ops/TIME-COVERAGE-VALIDATION.md` con guiones de dos sesiones PostgreSQL para las cuatro carreras anteriores, resultado esperado y condición de aprobación. Si no hay PostgreSQL real disponible, registrar esos casos como NO ejecutados; no inventar resultados ni configurar servicios. npm test + npm run build + git diff --check. Documentar superficie todavía sin adaptar al frontend.

Si aparece una decisión no cubierta aquí o reparación de datos necesaria, parar implementación y volver a Sol 6.1 alto. No activar correo, cuentas ni SQL remoto.
