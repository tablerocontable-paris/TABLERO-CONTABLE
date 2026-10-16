# Fundación del adaptador de tareas — contrato de ejecución

Fuente: v28, `f916d1b2bb567f133a7c51d4559b3cfaffee1c07`.
Modelo de ejecución: **GPT-6 Luna, medio, Standard**.
Objetivo: preparar la frontera tipada entre la app y las RPC 008, probarla con
SQL real en PGlite y conservar operaciones reintentables sin duplicación. Esta
entrega no activa el modo remoto de la página.

## 1. Cerrar aceptación de guía

En `tests/postgres-008/check-sql.mjs`, para BA antes del corte:

- Sustituir el bloque de login/assertion manual por una assertion dentro del DO
  de B renderizado, antes de la llamada capturada. Verificar auth.uid jefe, aal2
  y current_user authenticated después del login contenido en spec.B.
- Agregar motivo Synthetic wait, una sola sesión total/cero abiertas, receipt
  seed de peer/op90 con kind start_timer y session_id original; receipt de boss/
  op1 con kind task_wait y revisión 2. Mantener todos los checks/replay actuales.
- Conservar 23 casos; no ejecutar A, afterFirst, pg_sleep ni PostgreSQL.

## 2. Archivos nuevos y frontera de datos

Crear `src/data/remote/task-contract.ts`, `src/data/remote/task-gateway.ts` y
pruebas nuevas bajo tests. Reutilizar Zod y AccountingLab existentes. No añadir
dependencias. SQL 001–008, App/repository local y evidencia previa permanecen
congelados para este bloque.

El contrato representa filas del servidor, **sin convertirlas a State/Task local**.
Hoy el modelo local no tiene state_revision, no representa auditor, tiene sector/
prioridad que la instancia SQL no guarda y admite asignaciones nulas que la tabla
remota no admite. Ninguno de esos huecos se rellena con datos de demostración.

Validar estas filas seleccionadas completas; conservar campos adicionales:

| Fila | Campos obligatorios del contrato |
| --- | --- |
| task_instances | id, organization_id, assignment_id, company_id, owner_id, team_id, template_version_id nullable, period, scheduled_on, title, kind, weight, unit nullable, target nullable, status, due_date nullable, started_at/completed_at nullable, checklist, blocked_by/blocked_since nullable, state_revision |
| task_time_sessions | id, organization_id, instance_id, actor_id, started_at, ended_at nullable, absence_id nullable |

UUID: aceptar la representación PostgreSQL de 36 caracteres hex con guiones,
incluyendo fixtures con versión 0. No restringir a UUID v4 ni reescribir IDs por
nombres. Fecha: YYYY-MM-DD válida por calendario; period primer día y scheduled_on
del mismo mes; due_date opcional y puede caer en el siguiente mes. Timestamps:
ISO con Z/offset explícito; validar instante y fin no anterior al inicio. Tests
SQL serializan Date a ISO para simular JSON, sin afirmar prueba de PostgREST.

Revision: número entero no negativo y seguro en JavaScript; rechazar valores
fuera de MAX_SAFE_INTEGER y strings arbitrarios. Peso finito >0 y <=100. Kind y
status con los valores SQL exactos. Para operativa exigir unit no vacía y target
entero positivo. Resultado conserva unit/target nulos si así llegan.

Checklist: array de elementos con id no vacío y done boolean; text es opcional
porque el SQL/fixtures permiten `{id,done}`. Conservar metadata adicional, IDs,
orden y valores. Rechazar IDs repetidos para evitar controles ambiguos. No buscar
los controles o el peso en la versión actual del catálogo.

## 3. Operaciones y transporte inyectado

Sin URL, createClient, red ni variables de entorno. Definir un transporte RPC
inyectado con resultado `{data: unknown, error: unknown | null}` mediante
PromiseLike. Sólo estas seis RPC; no DML ni wrappers antiguos:

| Comando | RPC y argumentos exactos | Resultado |
| --- | --- | --- |
| start | start_task_timer: p_instance, p_expected_revision, p_operation_id, p_switch | UUID session_id |
| pause | pause_task_timer: p_session, p_operation_id | timestamp ended_at |
| wait | set_task_wait: p_instance, p_note nullable, p_expected_revision, p_operation_id | revisión bigint segura |
| transition | transition_task_reviewed: p_instance, p_next, p_reason nullable, p_expected_revision, p_operation_id | revisión bigint segura |
| checklist | set_checklist_item_reviewed: p_instance, p_check, p_done, p_reason nullable, p_expected_revision, p_operation_id | revisión bigint segura |
| activity | record_activity_once: p_instance, p_work_date, p_quantity, p_reference, p_operation_id | UUID entry_id |

Usar una unión discriminada de comandos. `prepareTaskCommand` valida y clona
entrada; devuelve nombre/argumentos readonly congelados, operationId y kind.
Usar `{kind, operationId, rpc, args}`; execute comprueba que rpc coincide con
kind, que args sólo contiene la firma correspondiente y que p_operation_id
coincide con operationId. Un cast TypeScript no puede eludir esta validación.
operationId es obligatorio y lo aporta el llamador una sola vez por intención.
No generar UUID dentro de execute. Rechazar campos de entrada desconocidos,
incluidos actor/organización/rol, antes de llamar al transporte. El servidor
obtiene identidad del JWT; este adaptador no concede permisos.

Start exige switch boolean explícito; note/reason conservan NULL y texto original
sin normalizaciones entre intentos. Note no nula y referencia deben contener
texto; cantidad 1..1000000 entera. No inferir razón de reapertura ni controlar
acceso a partir del selector local. Esas validaciones pertenecen a la RPC.

`createTaskGateway(transport).execute(prepared)` valida también el request recibido
en runtime, realiza una sola llamada y valida el retorno por kind. Devuelve
resultado discriminado con UUID/revisión/instante; nunca calcula estado de tarjeta
desde el ACK: puede haber completado checklist o cambiado otro reloj.

Errores separados: validation, transport (promesa rechazada), server (error en
respuesta), protocol (respuesta escalar inválida). Mensajes genéricos y estables,
sin persistir texto de excepciones ni credenciales. Conservar prepared para que el
llamador pueda repetirlo; ninguna categoría reintenta automáticamente. Un fallo
de transporte o ACK inválido puede ocurrir tras commit: misma clave/argumentos
permiten consultar el resultado sin duplicar. Conflicto requiere releer y una
nueva intención explícita; jamás cambiar revisión bajo la misma operationId.

## 4. Aceptación suficiente

Pruebas unitarias pequeñas para filas, preparador, transporte y ACK. Cubrir:
UUID PostgreSQL, nulos/fecha entre meses, dos tareas del mismo banco/empresas
distintas, checklist sin text, metadatos originales, revisión insegura, fechas/
estados inválidos y campos de autoridad extra rechazados antes de RPC. Verificar
argumentos/nombres exactos de seis comandos, sin mutar entrada ni generar IDs,
errores de transporte/server/protocol y que nunca se llama automáticamente otra
vez. Replay explícito conserva byte a byte clave/argumentos.

Pruebas de integración con AccountingLab, BEGIN/ROLLBACK por caso. Transporte de
test con allowlist fija de SQL parametrizado para las seis RPC; nunca construir
SQL a partir de un nombre arbitrario. Login actor autenticado antes de execute;
queries de resultado bajo ese rol cuando corresponda y admin sólo para snapshots
de auditoría. Serializar fechas a JSON sólo en la frontera de fixture.

1. Start/replay: mismo UUID, una sesión/revisión; pause/replay: mismo fin y estado.
2. Wait: empleado no detiene al peer vigente; jefe aal2 sí y conserva contexto.
   Rechazo con rollback íntegro y una sola llamada de transporte.
3. Checklist último control devuelve revisión y SQL completa resultado sin que
   gateway invente un estado; transición de reapertura sin motivo se rechaza y
   con motivo crea exactamente un evento.
4. Revisión vieja rechazada sin modificar filas ni reintentar automáticamente.
5. Actividad/replay: UUID original, una fila, fecha/cantidad/referencia correctas.
6. Parsear filas auténticas del laboratorio preserva empresa, propietario,
   asignación, versión nullable, peso, checklist y contexto temporal.

No duplicar toda la batería de locks/ausencias/reportes. Estos tests verifican
la nueva frontera y su composición con SQL; PGlite no prueba Auth ni concurrencia
real. Mantener todas las pruebas anteriores y diagnósticos byte a byte.

## 5. Entrega y siguiente bloque

Checker 23, emisión --emit-only AB/BA, pruebas nuevas, npm test, npm run build,
diff-check. Evidencia nueva con SHA base y hashes de archivos probados; no
sobrescribir evidencias previas. Revisar diff de SQL/App/repositorio local vacío,
commit/push y Sites privado del mismo SHA. La build publicada seguirá siendo demo.

Después **Sol 6.1 medio** revisa este adaptador. Siguientes etapas: lecturas
autorizadas/paginadas y recarga de filas confirmadas, coordinador de operaciones
asíncronas; inducción/aprobación, anotaciones privadas, usuarios/administración,
reportes; finalmente Auth/MFA reales, QA concurrente y piloto. Ese plan se cerrará
por partes con fuentes actuales. No habilitar remoto ni crear servicios/cuentas,
aplicar SQL, migrar empleados o enviar correo en esta ejecución.
