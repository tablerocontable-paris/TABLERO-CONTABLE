# Contrato Sol — reautorización del replay legacy de cronómetro

Fecha: 19/10/2026. Autor: GPT-6.1 Sol, esfuerzo alto. Baseline inspeccionado:
`f23c42529a0c55dd0f3596d765a30d5b6c9c54c5`. Ejecución: GPT-6 Luna, medio.
Este documento autoriza exclusivamente reproducción, corrección y evidencia
local sintética del replay `public.start_task_timer`. La aceptación final vuelve
a Sol. No autoriza aplicar SQL014 ni acceder a servicios alojados.

## 1. Hecho observado y reproducción obligatoria antes de corregir

En `supabase/migrations/202610150014_operational_api.sql:1186`, la función toma
el lock de recibo y devuelve `cached.result.session_id` antes de preparar el
ámbito, adquirir los locks y reautorizar. Las líneas 1200–1203 son la rama
temprana. `_coordination_receipt_lock` (SQL011:94) sólo comprueba identidad,
existencia del perfil y operación; no exige perfil activo ni membresía vigente.
Esta inspección identifica un defecto posible; no equivale a reproducirlo.

Antes de modificar SQL, Luna debe crear una base local nueva con 001–014 del
baseline, registrar sus hashes y demostrar separadamente:

1. Inicio inicial autorizado y confirmado: `00000`, UUID real de sesión y un
   recibo `start_timer` con los argumentos originales.
2. Revocación confirmada mediante `api.command_v1(companyMembership.setActive)`
   por jefe AAL2. El replay exacto posterior actualmente debería devolver
   `00000` y el UUID anterior: registrar este resultado como reproducción del
   defecto, no como aceptación.
3. Otro fixture iniciado; inactivar únicamente el perfil del empleado mediante
   preparación privilegiada local, confirmada. El replay exacto actualmente
   debería devolver también `00000`. Capturar perfil y recibo reales.
4. Control autorizado exacto devuelve el mismo UUID. Cambiar un argumento con
   la misma operación produce `P0001`, mensaje primario exacto
   `Identificador de operación reutilizado con otros argumentos`.

Conservar reporte/logs originales de reproducción y SQL014 anterior al fix.
No reemplazarlos con resultados verdes posteriores. Si el defecto no se
reproduce, detener el cambio de producto y devolver evidencia a Sol.

SQL011/012/013 conservan bytes, firmas, grants y semántica histórica; SQL014
no está aplicada y puede corregir localmente su override. SQL012 no redefine
`start_task_timer`: su cambio de recibos corresponde a otros writers. No editar
esas migraciones ni ampliar permisos legacy para resolver este caso.

## 2. Cambio autorizado y preservación de idempotencia

Corregir sólo la rama cached del override de `start_task_timer` en SQL014 y las
variables mínimas que necesita. Se permite extraer un helper privado sólo si es
necesario para claridad, con `search_path=''` y privilegios revocados; no cambiar
el helper global compartido ni otro writer sin regresar a Sol.

La firma, tipo UUID, claves de argumentos, identidad de actor y operación,
recibo histórico y resultado se conservan. La comparación de kind y argumentos
precede la reautorización y conserva `P0001` y el mensaje legacy indicado,
también cuando el actor está revocado o inactivo. Valores nulos/inválidos
conservan la validación inicial existente. No sustituir los errores legacy por
`42501` de la API nueva.

Un replay exacto debe preparar y adquirir un ámbito de **sólo lectura lógica**
antes de devolver el resultado. Usar el protocolo existente
`_coordination_prepare` y `_coordination_acquire_m22b(plan,false)`, con actor,
tarea original, responsables actuales, meses y clave de grafo pertinente.
Mantener orden global: recibo 1101; actores 1102; perfiles 1103; meses 1104;
catálogo 1105; locks de perfiles/fences/grafo/filas según el helper. El plan
debe incluir al actor en sus perfiles. No adquirir locks nuevos fuera del orden
ni llamar la variante writer por comodidad.

Después de adquirir y revalidar, exigir perfil activo, organización de perfil,
tarea y recibo iguales, acceso vigente a la tarea y rol legacy permitido. Usar
la comprobación legacy `_can_access_instance_at` y conservar la exclusión de
auditor. En tarea protegida por seguimiento/dependencias conservar además el
permiso de ejecutor que ya exige el override. La denegación de replay por falta
de autorización devuelve `P0001`, mensaje primario `Sin permiso`; usar
comprobaciones NULL-safe, evitando que un rol NULL pase la condición.

No comprobar nuevamente expected task revision, estado, mes abierto, readiness
o inexistencia de sesión: el comando ya ocurrió y esos valores pueden cambiar
legítimamente. Una sesión cerrada no vuelve a abrirse. La revisión de argumentos
se compara contra el recibo, no contra la revisión actual de la tarea. No
crear/actualizar recibo, sesión, auditoría ni fences en un replay exitoso.

La adquisición readonly puede esperar y tomar locks de filas; eso no autoriza
escrituras lógicas. No llamar `api_touch_month_fences`, no insertar un grafo
faltante y no avanzar `api_membership_fences` ni `api_operation_fences`.

## 3. Fixture y matriz secuencial fija

Fixtures independientes: empleado E AAL1, jefe J AAL2, ambos activos y de una
organización ficticia; membresías activas empresa/equipo; tarea de resultado
individual, checklist vacío, pendiente/revisión 0, período actual abierto,
responsabilidad baseline única. Sin cobertura, ausencia, tracking, dependencias,
actividad, evaluaciones, cierres, reportes ni outbox. Grafo y fences de mes de
E/J preexistentes en 0; fences de membresía de E/J inicializados por trigger en
0. J no participa de la tarea. Una empresa/equipo/tarea propios de cada caso.

Iniciar una sola vez con `start_task_timer(task,0,timerOperation,false)` y
confirmar. Baseline B para replay es posterior a ese inicio: tarea En curso/
revisión 1, una sesión abierta, un recibo legacy, un evento timer_started,
membership E +1, membership J +0, month E +1, graph fence +1, config 0, ningún
operation fence legacy. Guardar B completo; las siguientes comparaciones son
contra B o el estado de revocación confirmado, no contra antes del inicio.

| Caso tras fix | Resultado exacto | Efectos del intento |
|---|---|---|
| Replay autorizado inmediato | `00000`, UUID original | Igualdad total con B. |
| Replay autorizado con sesión ya cerrada | `00000`, UUID original | Igualdad total con baseline posterior al cierre. |
| Replay autorizado con tarea/revisión legítimamente avanzada | `00000`, UUID original con expected original 0 | Igualdad total con baseline avanzado. |
| Membresía revocada, replay exacto | `P0001`, `Sin permiso` | Igualdad con estado posterior a revocación. |
| Perfil inactivo, replay exacto | `P0001`, `Sin permiso` | Igualdad con estado posterior a inactivación. |
| Perfil reactivado y membresía activa, replay exacto | `00000`, UUID original | No reabrir/recrear sesión ni modificar recibo. |
| Actor activo, misma operación/otra revisión o switch | `P0001`, mensaje de argumentos reutilizados | Sin cambios. |
| Actor revocado, misma operación/argumentos distintos | Mismo `P0001` de argumentos reutilizados | Sin cambios. |
| Perfil inactivo, misma operación/argumentos distintos | Mismo `P0001` de argumentos reutilizados | Sin cambios. |
| Mismo actor/operación reutilizada de otro operation_kind | Mismo `P0001` de argumentos reutilizados | Sin cambios. |

Variar individualmente `revision`, `switch` e `instance` en los casos de
argumentos; otra tarea válida del fixture evita confundir ausencia de tarea.
El kind distinto se prepara usando una acción legacy válida y su propio
recibo auténtico; no fabricar un recibo incoherente para simular el endpoint.
La reactivación local de perfil es preparación sintética, no nueva API.
La prueba de avance puede usar una transición autorizada y confirmada en otro
fixture; tomar baseline después y conservar el recibo inicial intacto.

## 4. Ocho carreras: replay exacto contra revocación

Matriz cartesiana de aislamiento efectivo del replay/revocación: RC/RC, RC/RR,
RR/RC y RR/RR. Para cada par ejecutar ambos ganadores, en fixtures diferentes.
La columna aislamiento siempre nombra replay primero, revocación segundo,
independientemente de quién gana. No reducir pares mixtos a variables iguales.

| Ganador para cada par | Ganador | Perdedor mientras espera | Retry en conexión nueva con mismos argumentos |
|---|---|---|---|
| Replay | `00000`, UUID original | Revocación `00000` | Revocación exacta `00000`, mismo JSON/recibo |
| Revocación | `00000`, JSON/recibo exacto | Replay `40001` | Replay `P0001`, `Sin permiso` |

Replay primero no publica cambios: la revocación conserva su snapshot y puede
confirmar sin conflicto. Revocación primero cambia membresía, revisión de tarea
y sesión; RC detecta el plan distinto y RR puede abortar al bloquear una fila
actualizada. Exigir `40001`, no permitir genéricamente `00000` o `42501`.
Registrar mensaje primario sin fijar el texto contextual interno de PostgreSQL.
Todo resultado distinto vuelve a Sol; no adaptar el fixture ni los outcomes.

1. Tres conexiones: ganador, perdedor y observador privilegiado local. Registrar
   PIDs, claims efectivos, actor, AAL, `transaction_isolation` y operación.
2. Establecer explícitamente snapshot del perdedor antes del comando bloqueado,
   mientras ganador tiene la operación ejecutada y transacción abierta. Registrar
   que ve membresía activa/sesión abierta del baseline. Evitar snapshots fijados
   accidentalmente antes de preparar el fixture.
3. Exigir `winnerPid=ANY(pg_blocking_pids(loserPid))`, con timeout acotado y
   registro del conjunto real. No aceptar sólo sleeps o duración transcurrida.
4. Registrar estado observable winner-only después del commit del ganador; para
   replay ganador capturarlo antes de permitir commit de revocación perdedora.
   Puede mantener explícitamente abierta la transacción perdedora tras responder.
5. Revoke-first: rollback explícito del replay `40001`, capturar estado posterior
   idéntico al winner-only; retry nuevo con misma operación/revisión/switch da
   `P0001` y rollback. Replay-first: confirmar revocación exitosa y repetirla en
   conexión nueva para probar recibo exacto e inercia. Después probar replay del
   timer ya revocado: `P0001`, `Sin permiso`.
6. Cero `40P01`, cero sesiones/recibos adicionales, cero efectos parciales. No
   continuar un caso fallido dentro de la transacción abortada.

## 5. Snapshots, recibos y fences sin puntos ciegos

Capturar baseline B, winner-only, después de rollback si corresponde, final y
post-retry. Comparar filas completas y arrays ordenados por claves reales de:

- Todos los perfiles/membresías del fixture, tarea/asignación, sets/heads/members
  de responsabilidad (consultas independientes sin joins que oculten huérfanos).
- Todas las sesiones de E y todas las sesiones de las tareas del fixture,
  incluidas cerradas; todos los recibos legacy y API de los actores/operaciones.
- Auditoría y eventos de membresía por organización/entidad/details, sin filtrar
  el actor esperado en la consulta y ocultar un autor erróneo.
- Todos los membership fences E/J; todos los month fences E/J en la organización
  y todos los períodos, no sólo el mes esperado; todos los graph rows de empresa;
  todos los operation fences E/J. No reemplazar arrays por sumas o conteos.
- Actividad, evaluaciones/versiones, seguimiento/eventos, dependencias, coberturas,
  ausencias, cierres, reportes, entregas y outbox del ámbito. Exigir vacío o
  igualdad exacta al baseline. No ocultar duplicados filtrando sólo IDs esperados.

Desde B, cualquier replay/denegación/rollback tiene delta cero en todas las
colecciones. Una revocación efectiva y confirmada tiene exactamente:

| Campo | Delta/estado respecto de B |
|---|---|
| Membresía E | active=false, revision +1; motivo/autor J y timestamps conservados al replay |
| Tarea | En curso, state_revision +1; demás campos iguales |
| Sesión inicial | Mismo UUID/started_at/autor; ended_at no nulo >= started_at; cero abiertas |
| membership fence E / J | +1 / +0 |
| month fences E/J, todos períodos | Sin cambios |
| graph fence / config | +1 / +0 |
| operation fences | Sólo la fila J/revokeOperation epoch 1; ninguna por timer/replay |
| Eventos | Un company_membership_event y una auditoría companyMembership.setActive; el timer_started original intacto |
| Recibos | Recibo timer original íntegro y un api_command_receipt de revocación |

No exigir auditoría timer_stopped: la revocación actual no la emite. Resultado
timer UUID = sesión.id = receipt.result.session_id, nunca asumir UUID=operation.
Recibo legacy exacto: `operation_kind=start_timer`,
`arguments={instance:task,revision:0,switch:false}`, `result={session_id:uuid}`,
organization/actor/operation correctos. Comparar todas sus claves/valores y
timestamps. La respuesta completa de revocación debe igualar su recibo API; el
replay de revocación no cambia sus fences/eventos. Inactivación local de perfil
no incrementa fences por sí sola: baselines antes/después deben declararlo.

## 6. Validación, entrega y frontera finita del bloque

Modificar sólo SQL014 si la reproducción prueba el defecto, runner nativo y
regresión focal relevante, manifiesto y documentos de resultado. Conservar
001–013 byte a byte. No modificar UI/DTO/Worker ni inventar API de inactivación.
No instalar dependencias. El runner debe ejecutar la matriz contra PostgreSQL
nativo y conservar los escenarios anteriores. Reproducción roja y validación
verde llevan rutas/reportes distintos y hashes exactos de SQL/runner/contrato.

Después del fix: matriz nativa completa y ocho casos identificables con sus
blockers/outcomes; prueba focal, suite completa, TypeScript, builds cliente y
Worker, `node --check` y `git diff --check`. Registrar comandos, salidas crudas,
exit codes, versión PostgreSQL, commit baseline, hashes de SQL011/012/013/014,
runner, reporte y logs. El manifiesto versionado referencia evidencia local
estable. Repetir sólo si cambia código/runner o falla una verificación.

Este contrato termina cuando Sol acepta exclusivamente esta familia con hashes
exactos. El inventario residual conocido de **replay legacy temprano** se limita
a dos endpoints para el siguiente contrato: `record_activity_once` (núcleo
`_coordination_record_activity` de SQL012) y `assign_task_responsibility`
(override SQL014). Sus retornos tempranos se inspeccionaron; no se declara aquí
su reproducción/corrección. No agregar otra familia a esta implementación.

Las primeras ejecuciones timer/revocación ya aceptadas no se vuelven a
implementar. §9/Gate L general, otros writers/creaciones y fallos inventariados,
Auth/HTTP alojado, configuración Data API, Storage/restauración, SQL014 remoto,
GitHub CI, hosting, correo, producción, cuentas e invitaciones siguen sus gates
separados. Esta corrección local no acredita ninguno de ellos ni abre el espacio
operativo. Tras aceptación, el coordinador debe cruzar el inventario residual
con evidencia existente y avanzar a los gates reales sin crear auditorías
repetidas de familias ya aceptadas.
