# Contrato 006 — cerrar hallazgos de 005

Decisiones de revisión del 01/10/2026 sobre `b3de414872fa246761b7785c22e0103224f678c4`.
**Aprobado para ejecución local GPT 6 Luna, esfuerzo medio.**
Evidencia: `REVIEW-005-20261001.md`. No implementar durante la fase de revisión Sol.
Las reglas de 005 siguen vigentes salvo la aclaración de replay de abajo.

## Entrega acotada

1. Una migración nueva `202610010006_time_coverage_acceptance.sql`, BEGIN/COMMIT.
   No editar 001–005. Reemplazar funciones/triggers necesarios, preservar firmas
   públicas, UUID, revisiones históricas, pesos, asignaciones, cierres y reportes.
2. Suite SQL propia con fixtures aislados; reparar aislamiento de las pruebas
   antiguas que hoy dependen de otra prueba/contaminan segundos de reporte.
3. Fixtures de upgrade correctos e incompatibles y guía de dos conexiones
   preparada para una base PostgreSQL local descartable futura.
4. `npm test`, `npm run build`, `git diff --check`; Git y deploy Sites privado
   del mismo código. Registrar evidencia sin declarar aprobación productiva.

No cambiar frontend, crear cuentas/infraestructura, instalar PostgreSQL,
aplicar SQL remoto, importar empleados ni enviar correo. Si un preflight encuentra
incompatibilidad, abortar con IDs y volver a Sol; no resolverla alterando historia.

## A. Estados, espera y cortes

- **R005-01:** eliminar la rama que completa sin comprobar `kind`. Calcular estado
  final una sola vez: resultado con todos los controles y sin espera puede
  completar; operativa nunca. Sólo iniciar sesión si estado final queda En curso
  desde Pendiente; control único que completa resultado no inventa duración.
- **R005-02:** resolver la sesión de destino antes de decidir no-op por mismo
  texto. Mismo bloqueo + sesión abierta es intervención efectiva; mismo texto
  sin sesión es no-op. NULL sólo desbloquea y nunca detiene reloj. Con reloj de
  otro ejecutor se mantienen responsable permanente + MFA + motivo; error revierte
  control, revisión, reloj y receipt. Replay de la misma operación no limpia nada.
- **R005-03/L005-05:** una sesión cubierta dejó de estar vigente cuando su corte
  efectivo (mínimo expiración ART/cancelación) es <= instante de operación.
  Reconocer ambas causas, en origen y destino. Limpiar sesiones expiradas conocidas
  antes de tratarlas como ocupación, también cuando transición/checklist realmente
  necesitan iniciar. No cerrar un origen vigente implícitamente: sólo start con
  switch TRUE. Operación inválida revierte limpieza y auditoría.
- Incrementar una vez cada instancia cambiada, aun cuando expiración y nuevo inicio
  afecten la misma tarea. Switch incrementa origen y destino; no-op no incrementa.
  Mes cerrado con sesión abierta es conflicto íntegro, incluso si está expirada.

## B. Protocolo de locks y permiso posterior

Aplicar el orden de 005 a todos los caminos afectados, incluidas firmas legacy:
receipt → timer-actor firmado cuando corresponda → owners UUID ordenados →
meses `(owner,period)` ordenados → instancias UUID ordenadas → sesiones UUID
ordenadas → ausencia cuando corresponda. Cierre/cancelación no toman timer después
de owner. Pausa sí toma timer-actor antes de owner.

- En switch obtener origen y destino bajo guard del actor. Bloquear ambas
  instancias antes de sus sesiones; deduplicar IDs y ordenarlos. Releer las filas
  después de tomar los locks, no modificar origen con datos prelock.
- En transición/checklist que podrían iniciar: identificar reloj propio y su
  instancia antes de owner; incluirlos si hay limpieza/inicio que los afecte.
  Predecir esa necesidad desde el estado/revisión y revalidar después; una revisión
  distinta causa conflicto, no permite ampliar locks en orden inverso. Los
  controles que sólo completan un resultado no dependen de otro reloj propio.
- Centralizar el cálculo de corte y, si evita duplicaciones, el bloqueo/limpieza
  en helpers privados SECURITY DEFINER con search_path vacío. Helpers sin EXECUTE
  PUBLIC/anon/authenticated; ninguna hora, rol u organización pública suministrada
  por cliente. El orden aplica también dentro de esos helpers.
- Capturar **un solo `clock_timestamp()` después del último lock necesario**.
  Revalidar identidad activa/rol/org, empresa, jerarquía/cobertura, revisión,
  estado y mes con ese instante. Rechazo temprano sólo ahorra trabajo.
- Cierre: volver a exigir responsable MFA, acceso permanente al titular y todas
  las empresas bajo guards y antes de devolver un cierre existente o escribir.
  Cobertura temporal no otorga permisos de cierre. Verificar de nuevo destinatario
  gerente activo con email confirmado. No devolver IDs de cierre sin permiso.
- Pausa propia suspendida/sin membresía conserva excepción y protección de mes;
  no devuelve tarea. Resto de operaciones nuevas ordinarias requiere actor activo.

## C. Integridad, preflight y auditoría

- **R005-04:** trigger de límite calcula desde NEW.absence_id/NEW.started_at y
  ausencia compatible, sin buscar NEW.id antes de INSERT. Limitar ended_at al
  mínimo propuesto/expiración/cancelación en INSERT y UPDATE. No modificar inicio;
  si corte < inicio, rechazar con ID, nunca fabricar duración cero.
- **R005-06:** preflight al inicio, antes de backfill/reemplazos, identifica sesiones
  con ausencia cuyo titular no coincide con task.owner, reemplazante no coincide
  con actor, empresa sin autorización explícita, inicio fuera del rango ART o
  posterior a cancelación/corte, y fin posterior al límite. Reportar IDs y abortar.
  Validar también referencias incompatibles de reapertura/audit. No deducir empresa
  para ausencia legacy sin empresas. No exigir membresía/actividad **actual** para
  validar una sesión histórica: pudo retirarse después legítimamente.
- Nuevas escrituras de sesión aplican identidad y fechas coherentes. Su identidad
  (org/tarea/actor/inicio/ausencia) no se reescribe con UPDATE; sólo finalizar una
  sesión abierta. Prohibir DELETE. Un fin ya registrado no se altera aquí; una
  futura corrección auditada de tiempos será una fase distinta.
- **L005-06:** ausencia conserva org/titular/reemplazante/tipo/fechas/nota/aprobador.
  UPDATE sólo puede fijar cancelled_at una vez y nunca eliminar ausencia/empresas
  históricas. Agregar `authorization_sealed boolean not null default true`:
  las ausencias existentes quedan selladas sin inferir empresas. La RPC de
  aprobación crea la ausencia con FALSE, inserta empresas y cambia a TRUE dentro
  de la misma transacción. El trigger sólo permite el sellado FALSE→TRUE y la
  primera cancelación; empresas sólo pueden insertarse en una ausencia no sellada,
  nunca actualizarse/eliminarse. Sesiones requieren autorización sellada. No usar
  un GUC/flag de cliente como prueba de permiso. Cliente sigue sin DML/EXECUTE de
  helpers. Cancelación ya realizada con UUID nuevo retorna no-op
  con receipt tras revalidar ámbito; no relimpia historia ni cambia motivo/corte.
- **R005-05/L005-03:** auditoría que finaliza/interviene incluye actor, ejecutor,
  instancia, sesión, motivo aplicable, started_at, ended_at efectivo y ausencia.
  Expiración se registra como tal. Pasar `at=instante_operacion` explícito a los
  eventos nuevos de estas RPC; evento de reapertura usa el mismo instante. No
  confundir ese instante con ended_at cuando el corte de cobertura es anterior.
  No reescribir eventos/snapshots anteriores.
- Replay exacto de receipt previo puede devolver su resultado escalar aunque
  cambió actividad/ámbito del firmante; no consulta/retorna tareas ni escribe,
  no reactiva reloj, no vuelve a enviar reportes. UUID+contenido distinto falla.
  Nueva clave exige todos los permisos actuales, salvo pausa propia suspendida.

## D. Pruebas de aceptación independientes

Usar rollback/fixture por caso o una base propia por describe; no depender de orden
ni de IDs creados por otra prueba. Esperados errores usan savepoint si hay transacción.
Actor helper siempre configura sub y aal; resetear ambos al preparar migraciones.

| Grupo | Casos obligatorios y asserts |
| --- | --- |
| R005-01/02 | Operativa con un control y varios, último control mantiene En curso; resultado control único completa sin sesión; bloqueo igual sin reloj no-op, con reloj propio pausa+1 revisión, ajeno denegado/MFA autorizado; NULL no pausa |
| R005-03 | Origen/destino expirados por fecha y por cancelación anterior al fin; ausencia nunca autoriza target nueva tras cancelación; nueva tarea propia sí inicia sin switch; switch FALSE sobre vigente falla íntegro |
| R005-04/06 | INSERT/UPDATE termina exactamente en mínimo ART/cancelación; inicio posterior al corte rechazado; identidad de sesión/ausencia inmutable; empresas no reescritas; preflight rechaza y conserva IDs |
| R005-05 | Transición/checklist/wait autorizados con reloj ajeno guardan actor/ejecutor/sesión/motivo e inicio/fin; evento.at posterior a locks, consistente con instante servidor; reapertura no inicia reloj |
| Permisos | Reemplazante que no tiene jerarquía sobre titular; dos empresas, sólo una cubierta; períodos anterior/futuro denegados; suspensión de titular/reemplazante, retiro de membresía, empresa/organización/equipo ajenos; encargado temporal no interrumpe otro; jefe MFA cruza equipos de su org |
| Pausa/receipts | Propia sin membresía y suspendida; ajena denegada; mes cerrado con sesión abierta falla sin cambios; ya terminada no-op; replay después de pausa/cancelación/suspensión; operación distinta nueva exige actividad; UUID reutilizado con otros args falla |
| Actividad | record_activity_once operativa: replay misma cantidad sin duplicar ni +revisión; contenido distinto falla; distinta empresa y mes cerrado denegados; wrapper legacy documenta falta de idempotencia |
| RLS/privilegios | authenticated/anon no ejecutan helpers ni DML directo; cobertura no amplía perfiles/catálogo/asignaciones/reportes/pesos; diagnóstico separado no crea KPI; pruebas reales Supabase pendientes |
| Reporte aislado | Fixture propio: sólo una sesión fija de 1800 segundos y cantidades conocidas; snapshot suma exactamente 1800, no tolerancias ni segundos de otro caso; cierre/reporte/outbox una vez, sin reloj abierto; snapshot anterior idéntico |

Convertir los seis diagnósticos fallidos en asserts reales contra 006; no alterar el
script congelado de 005 para mostrar verde. Mantener también las once regresiones.

### Upgrade

Base 0.3 → 001–006 y base 004/005 → 006 con datos sintéticos cerrados. Guardar y
comparar IDs y `snapshot::text` antes/después para cierres y reportes, estado/IDs
de delivery/outbox, sesiones válidas y audit/events con actor legacy NULL.
Abortos independientes para sesión incoherente, inicio después del corte, reapertura
huérfana/actor de otra organización y múltiples relojes incompatibles al pasar por
004. Comprobar rollback íntegro de la migración que falla, sin borrar/inferir filas.

### Guía PostgreSQL futura

Completar `docs/ops/TIME-COVERAGE-VALIDATION.md` con fixture sintético ejecutable,
JWT de prueba, bloques A y B separados por conexión, COMMIT/ROLLBACK y consultas
con asserts para ambos órdenes. Cubrir inicio/inicio, switch/pausa, cierre/inicio,
cancelación/inicio, cambio de permiso mientras espera guard y expiración ART.
Usar valores del fixture, no pseudocódigo intercalado ni placeholders invisibles.
Mantener **NO EJECUTADO** hasta tener logs de PostgreSQL con dos conexiones. No
instalar motor ni crear un servicio remoto para completar este contrato.

## Revisión y salida

Registrar número exacto de pruebas/asserts, build y diff. Matriz con cada grupo:
probado localmente / inspeccionado / pendiente real. Publicar misma fuente/build
privados en Sites. Luego **Sol 6.1 alto** revisa 006 y el aislamiento; PostgreSQL y
Supabase real siguen bloqueando aprobación productiva aunque todo PGlite pase.
