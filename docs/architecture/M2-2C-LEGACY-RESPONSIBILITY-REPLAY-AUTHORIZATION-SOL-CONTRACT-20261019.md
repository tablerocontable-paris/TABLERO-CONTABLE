# Contrato Sol — replay legacy de responsabilidad conjunta

Fecha: 19/10/2026. Arquitectura/revisión: GPT-6.1 Sol, esfuerzo alto.
Implementación: GPT-6 Luna, esfuerzo medio. Alcance exclusivamente local,
PostgreSQL nativo y datos ficticios. La aceptación vuelve a Sol.

## 1. Baseline exacto y sospecha

HEAD inspeccionado: `c12c43aaa8db002596bc04b5836d0de0af0d4f43`, árbol limpio.
SQL014: `supabase/migrations/202610150014_operational_api.sql`.

- SHA-256 del **blob Git exacto** de ese commit:
  `092B14200AD17D5FF5F96C5D6D748826366B395E3308082C5FEDAE40444EB4EA`.
- SHA-256 del **checkout raw** inspeccionado:
  `7BF6F10E8703A2044708C9E37AD72021F07B6CD3C7E803C3D9313A0E170A5C7E`.

No intercambiar esos hashes ni extraer el blob mediante una conversión de
newlines del shell. Registrar ambos, `git ls-files --eol` y el archivo baseline
extraído byte a byte. El rojo usará el blob exacto conservado. Si cambia HEAD,
la lógica SQL o las precondiciones, volver a Sol antes de implementar.

Definición efectiva: override `public.assign_task_responsibility` en SQL014,
líneas 1126–1184 del baseline. Toma receipt lock, compara kind/argumentos y
retorna `cached.result.revision` en 1138–1141, antes de autorización actual.
`_coordination_can_assign`, SQL011:962–989, exige rol, MFA, ámbito y condiciones
de primera asignación; el override la llama después del retorno temprano.
Esto es una sospecha estática, **no una reproducción ni un defecto aceptado**.

Ya están aceptados el replay timer y el replay de actividad, y las primeras
ejecuciones de responsabilidad frente a aprobación de inducción. No repetir
esas implementaciones. Este contrato sólo trata el replay cached de
`assign_task_responsibility`; no acepta §9/Gate L completos.

## 2. Preparación y fronteras

Registrar antes de ejecutar: HEAD/status, hashes blob y checkout de todas las
migraciones 001–014, contrato, runners y versiones de Node/PostgreSQL. Conservar
SQL001–013 byte a byte respecto del inicio; no instalar dependencias.

Ruta de este bloque: base nueva con 001–014 exactas, creación auténtica y replay.
No se añade una segunda matriz Upgrade ni otra familia a este contrato.

Cada caso dispone de organización/empresa/equipo ficticios, con:

- M: encargado activo, actor AAL2; no es propietario, participante, reemplazo,
  titular de cobertura ni autor de sesiones/actividad de la tarea.
- J: jefe activo AAL2 distinto de M; autor real de revocación/restauración.
- E: empleado propietario y P: segundo empleado; ambos activos, de la empresa,
  miembros del equipo y con `manager_id=M`. M tiene membresía empresarial y
  ámbito vigente sobre ambos. J tiene acceso organizacional de jefatura.
- Tarea resultado de asignación `frequency='unica'`, mes actual ART abierto,
  pendiente, checklist vacío, revisión de tarea 0, responsabilidad baseline
  auténtica revisión1 sellada y un solo propietario E.
- Sin tracking/dependencias, sesiones, actividad, cobertura/ausencias,
  evaluaciones, cierres, reportes, entregas ni outbox. Graph row del período y
  month fences E/P/M/J preexistentes en 0; membership fences de los cuatro
  perfiles en 0 por bootstrap/trigger. No modificar fences para ocultar efectos.

Crear mediante llamada autenticada real:

`assign_task_responsibility(task, [{profileId:E,shareBps:6000},
{profileId:P,shareBps:4000}], reasonRaw, 1, responsibilityOperation)`.

Exigir `00000`, resultado bigint2; conservar task revision1, head apuntando al
set explícito conjunto revisión2, baseline histórico intacto, participantes y
cuotas exactos, auditoría y recibo auténtico. M sólo figura como autor/capturador.
No insertar manualmente recibos, sets explícitos ni heads para simular endpoint.

El planner SQL011 incluye actores en `people` y `months`; por ello la primera
asignación publica membership fence E/P/M +1, J+0 y graph fence+1/config0; no
avanza month ni operation fences. Comprobar arrays completos contra baseline.
Si el comportamiento observado difiere, conservar evidencia y volver a Sol.

## 3. Rojo obligatorio antes de cambiar producto

Ejecutar contra SQL014 blob baseline conservado, con fixtures independientes:

1. Primera llamada auténtica y replay inmediato autorizado: `00000`, bigint2,
   mismo recibo; replay con igualdad completa antes/después.
2. Revocar membresía de M/empresa por `api.command_v1(companyMembership.setActive)`
   como J, expected revision real y motivo; confirmar. Replay exacto M AAL2
   predicho `00000`, bigint2. Registrar el resultado real sin llamarlo aceptación.
3. Otro fixture: inactivar sólo perfil M mediante preparación privilegiada
   local confirmada; conservar membresía activa. Replay predicho `00000`, 2.
4. Otro fixture: degradar únicamente rol M de encargado a empleado mediante
   preparación local confirmada; actor sigue activo. Replay predicho `00000`,2.
5. Otro fixture: mismos datos/rol, claims M AAL1; replay predicho `00000`,2.
6. Probe RR: M AAL2 abre RR, consulta identidad/aislamiento/snapshot y tarea,
   membresía y perfil; J revoca y confirma en otra conexión; el observador
   prueba membresía false. M repite con snapshot fijo: predicción `00000`,2.
   Conservar lectura visible antes/después, estado comprometido y replay inerte.
7. Controles de conflicto por campo y kind de §5: `P0001`, mensaje primario
   `Identificador de operación reutilizado con otros argumentos`, sin cambios.

Registrar contextos efectivos mediante consultas de `auth.uid()`, claims,
`pg_backend_pid()`, `transaction_isolation` y snapshot; no escribir sólo valores
esperados en JSON. Mantener reportes/logs rojos originales, separados del verde.

No-go: si revocado/inactivo ya se deniegan, si el RR no acredita retorno
temprano, si la asignación inicial no es auténtica o las firmas/grants impiden
invocarla, detener el fix y volver a Sol. Un error de fixture no reproduce el
defecto. **No abrir las ocho carreras salvo reproducción roja acreditada.**

## 4. Corrección condicional permitida

Sólo rama cached de `assign_task_responsibility` en SQL014 y variables mínimas.
Primera ejecución posterior a esa rama, firma bigint, grants, wrappers, recibos,
auditoría y reglas iniciales permanecen iguales. No modificar SQL011–013,
helpers globales, funciones de timer/actividad, API/DTO/UI/Worker ni migración
distinta. No activar servicios alojados.

Conservar validación inicial actual. Después de receipt lock1101, comparar kind
y argumentos raw antes de autorización, manteniendo error/mensaje legacy para
actor activo, revocado, inactivo o degradado. La revisión se compara con el
recibo original; no con el head ni revisión actual.

En cached exacto: planificar tarea original, actor M y responsables actuales,
meses pertinentes y clave dependencies del resultado. Incluir M en perfiles y
actores; usar `_coordination_prepare` y `_coordination_acquire_m22b(plan,false)`.
Orden existente:1101→1102→1103→1104→1105→locks de filas/revalidación. No variante
writer, no touch de meses, inserts de grafo ni incrementos de epochs.

Releer tarea/recibo bajo ese protocolo. Exigir coherencia de organización,
actor, operación, kind, argumentos y resultado; inconsistencias concurrentes
producen `40001`, sin reparación. Reautorizar perfil activo, organización y rol
actual jefe/encargado mediante condiciones NULL-safe. M encargado requiere
ámbito actual del propietario y `_can_access_instance_at` vigente; jefe conserva
su autoridad organizacional vigente. Para rol/perfil/acceso denegado: `P0001`,
mensaje primario `Sin permiso`. Después exigir MFA actual usando
`require_privileged_session`: AAL1 da `P0001`, mensaje primario
`Se requiere sesión de responsable con MFA`. No reemplazar por errores API.

No llamar `_coordination_can_assign` íntegra en replay: comprueba requisitos ya
consumidos (baseline1, estado pendiente, ausencia de sesiones/evidencia, etc.).
Tampoco revalidar cuotas/elegibilidad inicial de participantes, tracking,
readiness, mes abierto o revisión actual para volver a ejecutar el comando.
Un replay autorizado devuelve el bigint histórico2 sin crear ni modificar nada.

## 5. Matriz verde secuencial finita

Fixtures separados para mutaciones de permisos; restauraciones tienen sus
propios baselines y autores. Mantener estos casos identificados:

| Caso | Resultado del replay | Delta del replay |
|---|---|---|
| Inmediato autorizado M AAL2 | `00000`, bigint2 | Cero |
| Después de avance legítimo de tarea/revisión | `00000`,2, argumentos originales | Cero |
| Después de cierre legacy válido del período | `00000`,2 | Cero |
| Membresía M revocada | `P0001`, `Sin permiso` | Cero |
| Perfil M inactivo | `P0001`, `Sin permiso` | Cero |
| Rol M degradado a empleado | `P0001`, `Sin permiso` | Cero |
| M encargado activo AAL1 | `P0001`, mensaje MFA de §4 | Cero |
| Membresía restaurada por J con revisión actual; M activo AAL2 | `00000`,2 | Cero |
| Perfil/rol restaurados localmente; M activo AAL2 | `00000`,2 | Cero |
| J creó su propia responsabilidad y mantiene autoridad, AAL2 | `00000`,2 | Cero |

El avance utiliza una acción legacy válida y conserva su autor. El cierre debe
ejecutar el endpoint real de cierre y satisfacer reglas conjuntas/control/MFA
existentes; preparar trabajo real sintético necesario, sin insertar directamente
`monthly_closures`. Tomar baseline después de esa acción. Si no se logra un
cierre válido, devolver diagnóstico; no relajar el writer para pasar el ensayo.

En M activo, M revocado y M inactivo, variar por separado con el mismo operation:
`instance` (otra tarea válida), `members` (cuotas válidas distintas manteniendo
E/P), `reason` (incluido sólo cambio de espacios) y `revision` (otro bigint válido).
Todos: `P0001` y mensaje de argumentos reutilizados, antes de autorización.
Crear kind conflictivo con otro endpoint legacy válido como M y su recibo
auténtico, después reutilizar esa operación aquí; no fabricar recibo ni ampliar
grants. Conservar igualdad completa antes/después de cada intento.

## 6. Ocho carreras cached replay frente a revocación de M

Cuatro pares efectivos replay/revocación: RC/RC, RC/RR, RR/RC y RR/RR; ambos
ganadores por par, en fixtures independientes. No cambiar M por E/P ni hacer
que M participe para copiar efectos de otros contratos.

| Ganador | Ganador | Perdedor | Retry en conexión autenticada nueva |
|---|---|---|---|
| Replay M | `00000`, bigint2 | Revocación J `00000` | Revocación exacta `00000`, JSON/recibo idénticos; luego replay M `P0001`, `Sin permiso` |
| Revocación J | `00000`, JSON/recibo API | Replay M `40001` | Replay M `P0001`, `Sin permiso` |

RC detecta `companies` modificado al revalidar el plan: SQL011:184–213 incluye
company_memberships de M aunque M no sea participante. RR puede abortar al
tomar share lock de su membership fence actualizado. No aceptar listas abiertas
de SQLSTATE; si difieren los resultados, devolver evidencia a Sol.

Registrar dos conexiones de comando y observador privilegiado local, contextos
efectivos por conexión (UID, claims, AAL, PID, aislamiento y snapshot), lecturas
visibles del perdedor antes de bloquear y PIDs reales de `pg_blocking_pids`.
Exigir ganador entre esos PIDs mientras mantiene transacción abierta. No usar
sólo sleeps. El observador no sustituye la lectura visible de la conexión
perdedora. Capturar baseline; winner-only confirmado; rollback explícito del
40001; final y post-retry. En replay-first mantener revocador sin confirmar al
capturar winner-only. Usar conexión nueva para replay de revocación y para retry
de M, registrando PIDs distintos; no reutilizar una transacción abortada.
Ningún `40P01` es aceptable.

Desde baseline posterior a asignación auténtica, **revocar a M no participante**
produce exactamente lo siguiente:

- Membresía M: active=false, revision+1, changed_by=J y timestamp/motivo reales;
  access_valid_from=null. Todas las otras membresías/perfiles iguales.
- Membership fence M+1; E/P/J sin cambio. Todas las month y graph rows,
  config_revision, tareas, asignaciones, sets/heads/members y recibo legacy
  íntegros sin cambio. No revisar tareas de E/P: M no integra su footprint.
- Una company_membership_event de J, una auditoría companyMembership.setActive,
  un API receipt de J y una operation fence J/revokeOperation epoch1.
  Respuesta completa igual al recibo API; argumentos/identidad completos.
- Ninguna sesión, actividad, cobertura cancelada ni otro efecto lateral.

Replay exitoso/denegado/rollback tiene delta cero. Repetir revocación exacta
conserva todas las filas y epochs. Restablecer permisos sólo fuera de la carrera
y con baseline separado; preferir fixtures independientes a acumulación opaca.

## 7. Evidencia y aceptación limitada

Reutilizar captura completa de los runners aceptados: arrays ordenados por
claves reales e independientes para sets/heads/members. Incluir perfiles,
company/team memberships, tareas/asignaciones, sesiones y actividad, recibos
legacy **y api_command_receipts**, auditorías sin filtrar autor esperado,
membership/month/graph/operation fences (todos los períodos del ámbito),
tracking/dependencies/events, coverage/plans, absences/absenceCompanies,
assessments/versiones, cierres/reportes/entregas/outbox. No joins que oculten
huérfanos ni conteos/sumas que oculten cambios de filas.

Recibo auténtico exacto: organization, actor M, operation, kind
`assign_responsibility`, arguments `{instance,members,reason,revision:1}` raw,
result `{revision:2}` y created_at intacto. Resultado2 no equivale a task
state_revision. Conservar set baseline, set explícito y head, autor real y
cuotas6000/4000. Guardar snapshots antes/después de **cada secuencial** y todas
las fases de cada carrera; comparar con assertions de transformaciones
permitidas, no sólo almacenar un delta descriptivo.

Antes de aceptar: rojo y verde en rutas distintas con hashes exactos del
contrato/SQL/runners/reportes; comandos efectivos, stdout/stderr/exit codes,
motor/versiones y artefactos estables en outputs; manifiesto versionado con
rutas resolubles desde work/site y SHA-256 verificados. No exponer secretos.
El hash de este contrato se calcula sobre el archivo terminado y se comunica
aparte y en el manifiesto, evitando un self-hash imposible dentro del contenido.

Validar sólo lo necesario: focal relevante del cambio; matriz nativa completa
vigente (`--review-matrix full --through-014 yes --m2-2a-smoke yes
--m2-2c-smoke yes`), suite completa, TypeScript, build cliente/Worker, sintaxis
de runners y diff-check. Si la suite falla, conservar evidencia y resolver o
diagnosticar con comparación apropiada; no ocultarla con un resultado verde.
Después de cambios sólo de evidencia/runner, repetir la evidencia afectada y
sintaxis; suite/build/producto previos inalterados conservan su alcance.

No-go adicionales: primera ejecución diferente, permisos ampliados, autor M
sustituido, recibo fabricado, ausencia de blockers, snapshots incompletos,
deadlock o delta no permitido; volver a Sol sin adaptar el contrato en Luna.

Sol acepta **únicamente esta familia** y sus hashes exactos. No se declara
Gate L completo, no se aplica SQL014 ni se inicia Gate H. Después el coordinador
cruza §9 con aceptaciones existentes para cierre consolidado; no crea auditorías
repetidas. Data API/Auth/HTTP, Storage/restore, CI, frontend/Auth, hosting,
correo, cuentas reales y producción mantienen sus requisitos independientes.
