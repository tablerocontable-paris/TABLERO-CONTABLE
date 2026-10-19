# Contrato Sol propuesto — alta puntual frente a revocación de membresía

Fecha: 19/10/2026. Preparación: GPT-6.1 Sol, auditoría de fuente local.
Estado: **aceptado por GPT-6.1 Sol para implementación local acotada; resultados pendientes**.

## 1. Alcance y fundamento

Definir cuatro carreras de primera ejecución entre
`api.command_v1(task.createOneOff)` y
`api.command_v1(companyMembership.setActive(false))`: ambos órdenes RC/RC y
RR/RR. Empleado E crea para sí mismo con AAL1; jefe R revoca con AAL2, E distinto
de R. GPT-6.1 Sol aceptó este contrato para la matriz local sintética.
Autoriza runner/evidencia local de estos cuatro escenarios. No autoriza cambios
SQL, aplicar SQL014 ni llamar servicios remotos. Gate L/§9 permanecen abiertos.

Baseline de fuente leído: `0a7b81bf727ec8ae19fca2f2bd40b1f420776d1e`.
SHA-256 de bytes del checkout al redactar:

- SQL011: `9729a6800e93dedc43ab5f0840309b7c0d222343898cc8d5b43eeb4a387f4210`.
- SQL014: `ac8cca582cf366b0cf143fd63d99c490c664b00b368eb473757017eebef26315`.
- Runner previo: `405c214816e1e257d359ea23b625e905eada5d0c1e8077d6c329395532050f3b`.

No se ejecutó esta matriz al redactar. Los outcomes y deltas completos de las
secciones 4–6 son **hipótesis inferidas de fuente**, que la futura ejecución debe
probar y Sol aceptar. Las referencias de código acreditan instrucciones SQL,
no un resultado de concurrencia observado.

Fuentes, con líneas del baseline:

- `M2-2BC-EXECUTABLE-CONTRACT-20261016.md:328–342,458–474`: alta puntual,
  atomicidad, revocación y gates pendientes.
- `M2-2C-ASSIGNMENT-CREATE-MEMBERSHIP-REVOCATION-RACES-LUNA-20261019.md:169–172`:
  altas puntuales excluidas de la matriz anterior.
- `tests/review/m2-1-native-review.mjs:958–988,2155–2180,2224,2480–2496`:
  alta/alta, replay/revocación, commandReceipt y alta/cierre existentes. Ninguno
  sustituye primera alta frente a revocación en los cuatro casos propuestos.
- SQL014 `2265–2271,2292–2296`: envelope, permisos y actor/operation lock;
  `2373–2410`: definición, plan, revisión y pertenencia revalidadas;
  `2413–2453`: fences, asignación, ocurrencia, recibo y auditoría;
  `886–939,2911–2961,3150–3171`: adquisición/revalidación y footprint de revocación.
- SQL011 `123–212`: snapshot compartido y revalidación con `40001` al cambiar;
  `270–290`: trigger de responsabilidad inicial de la ocurrencia.
- SQL004 `23`: task state_revision default 0; SQL014 `2952`: revocación aumenta
  esa revisión en tareas abiertas. SQL014 `1584–1593`: la instancia hereda la
  measurement_version de la asignación.

## 2. Fixtures, identidades y baseline

Cuatro fixtures independientes, sin reutilizar operaciones entre casos. Registrar
los UUID concretos de organización, empresa, equipo, E, R, createOperation y
revokeOperation. E y R activos, misma organización; E con rol empleado y R jefe.
E pertenece a empresa/equipo; R tiene permisos válidos. La membresía E/empresa
está activa, revisión 0 y access_valid_from NULL en este fixture sintético para
no introducir otra precondición temporal. No desactivar constraints/triggers.

Verificar antes del baseline:

- Cero asignaciones y tareas de E/empresa; cero trabajo/sesiones de R en el
  ámbito. Sin cobertura, ausencias, actividad, cierres, responsabilidades,
  dependencias, tracking ni parameterization.
- `api_creation_heads(org,E)` precreada sólo en setup, revisión/fence_epoch 0.
  La expectativa +1/+1 presupone ON CONFLICT sobre esta fila existente.
- `api_month_fences(org,E,period)` existe con epoch 0.
- `task_dependency_graphs(org,company,period)` existe con fence/config 0 y cero
  edges; se captura aunque la alta sea operativa.
- `api_membership_fences` de E y R existen con epoch 0, inicializadas mediante
  los perfiles. No confundir estas filas con company_memberships.revision.
- Ambos operation fences, recibos y eventos propios de los comandos ausentes.
- Fecha actual de servidor ART dentro del período abierto; capturar fecha y
  período usados. Sin materializar ni llamar onboarding durante el setup.

Comprobar identidad efectiva en cada conexión: auth.uid(), JWT sub, claims role,
current_user, AAL y SHOW transaction_isolation. E usa authenticated/AAL1, R
authenticated/AAL2. La diferencia de actores evita que ambos comandos se
serialicen por compartir actor/operation lock.

## 3. Comandos y columnas exactas

Conservar envelopes originales completos:

- Alta de E: contractVersion 1, UUID nuevo, kind task.createOneOff,
  expectedRevisions `{creation:E:"0"}` y payload exacto ownerId E, companyId,
  teamId, source custom operativa v2, scheduledOn, dueDate NULL, priority Media.
  La definición lleva kind, title, objective, sector y unit válidos/sintéticos;
  no agregar weight, target ni checklist de entregable.
- Revocación de R: contractVersion 1, otro UUID nuevo,
  kind companyMembership.setActive, expectedRevisions
  `{membership:company:E:"0"}`, payload companyId, profileId E, active false,
  reason sintético válido.

SQL014 `2439–2445` fija el schedule técnico de OneOff. Afirmar en la asignación:
frequency unica, start_date=end_date=scheduledOn, start_month=period,
due_day=month_day=día de scheduledOn, interval_count 1, weekdays `[1]`,
has_deadline false, due_offset_days 0, measurement_version 2,
definition_revision 1, weight/target NULL, checklist `[]`, template_id y
template_version_id NULL. Guardar y comparar también las demás columnas reales.

La ocurrencia debe enlazar la única assignment_id, org/company/owner/team,
period/scheduled_on y persistir kind/title/unit, measurement_version 2,
weight/target/due_date NULL, checklist `[]`, priority Media, status Pendiente,
sin started_at/completed_at/blocked_by. Su state_revision inicial es 0.
Objective/sector custom permanecen en el payload y receipt, no son columnas de
task_assignments/task_instances; la responsabilidad custom usa el snapshot
`NULL`/`unknown` descrito debajo. No confundir taskRevision con definition_revision
ni creation head revision.

El trigger SQL011 genera un conjunto individual sellado revisión 1,
origin baseline_legacy, anchor_owner_id E y snapshots company/period/team; un
miembro E/share_bps 10000 y un head que enlaza ese conjunto y esa instancia.
Al ser custom sin template_version_id, sector_snapshot NULL y sector_source
unknown según SQL011 `274–280`; no copiar sector de la definición custom a esas
columnas. Comparar íntegros head/set/member antes y después de la revocación.

## 4. Hipótesis de outcomes y protocolo futuro

| Ganador | Aislamiento de ambos | Primer perdedor | Retry en conexión nueva |
|---|---|---|---|
| Alta | RC/RC | Revocación 40001 | R revoca 00000 |
| Revocación | RC/RC | Alta 40001 | E crea 42501 |
| Alta | RR/RR | Revocación 40001 | R revoca 00000 |
| Revocación | RR/RR | Alta 40001 | E crea 42501 |

Son hipótesis, no casos ejecutados ni aceptados. Alta primero debe alterar el
footprint que la revocación planeó antes de esperar: nueva asignación, tarea y
responsabilidad. Revocación primero debe invalidar la membresía que el alta
observó; el retry fresco debe denegar antes de publicar efectos de creación.

Protocolo de ejecución autorizado para la matriz local:

1. Capturar baseline; ejecutar ganador 00000 sin commit. Establecer snapshot del
   perdedor mientras ganador sigue abierto y lanzar su comando.
2. Desde observador independiente, exigir
   `winnerPid=ANY(pg_blocking_pids(loserPid))`, con timeout acotado y PIDs
   registrados; no sustituirlo por sleeps o por duración.
3. Commit ganador; perdedor debe dar el 40001 propuesto y hacer rollback
   explícito. Comparar snapshot winner-only con after-rollback íntegramente.
4. Retry en conexión nueva, mismo actor, claims/AAL, aislamiento, operationId,
   payload y expectedRevisions. Commit si 00000, rollback si 42501.
5. Capturar final y comparar filas, respuestas y fences con las hipótesis.

Cualquier SQLSTATE/delta distinto debe detener el caso, guardar diagnóstico y
volver a Sol. No aceptar conjuntos de outcomes intercambiables ni editar SQL o
expectativas para obtener verde sin revisión del mecanismo.

## 5. Hipótesis de filas, recibos y auditoría

Alta primero, winner-only: una asignación, una ocurrencia, un head/set/member,
membresía activa/revisión 0, creation head revisión/fence 1. Una respuesta de
alta con assignmentId y taskId reales y taskRevision `"0"`; un recibo de alta
y una auditoría task.createOneOff. Ningún evento/recibo de revocación.

Alta primero, final: los mismos IDs y definición/schedule; una ocurrencia aún
Pendiente cuya state_revision aumenta de 0 a 1 por la revocación. Ninguna otra
columna de tarea ni fila de responsabilidad cambia. Membresía inactiva/revisión
1; un recibo por comando, una auditoría por comando y un evento de membresía.
El recibo histórico de alta conserva taskRevision `"0"`: no reescribirlo para
igualar la revisión viva 1. La fila de asignación permanece idéntica.

Revocación primero, winner-only y final: membresía inactiva/revisión 1, ninguna
asignación, tarea, responsabilidad ni recibo/evento de alta. Creation head
conserva revisión/fence 0. Conflicto y retry denegado no agregan efectos.

Para cada respuesta exitosa, comparar envelope completo con
api_command_receipts.result y comprobar actor_id, operation_id, organization_id,
kind y arguments exactos `{kind,payload,expectedRevisions}`. Clave de recibo:
(actor_id,operation_id). Fallos 40001/42501 no dejan recibo ni operation fence.
No crear un replay adicional para reemplazar la respuesta original capturada.

Auditoría de alta: task.createOneOff, actor E, entity_id assignmentId,
details.ownerId E y details.period igual a period_v, la fecha inicial del mes
fijada en SQL014 `2384` y escrita en `2453`. Exigir ese período exacto en el
resultado futuro. Auditoría de revocación:
companyMembership.setActive, actor R, entity_id company,
details.profileId E, active false y membershipRevision `"1"`.
company_membership_events: una fila E/company/revisión 1/active false,
actor R y reason original. Comparar marcas de tiempo e identidad según la
respuesta real, sin exigir timestamps iguales entre instrucciones diferentes.

En todas las etapas: cero sesiones, activity_entries, cobertura, ausencias,
cierres/reportes/outbox, tracking, completion events, dependencies,
assignment_parameterization y task_mutation_receipts del ámbito. La
responsabilidad inicial es el efecto obligatorio del alta; no afirmar cero
responsabilidad después de un alta exitosa ni llamarla asignación conjunta.

## 6. Hipótesis de fences y revisiones desde baseline

Los deltas siguientes presuponen las filas cero del setup. E es actor y owner;
el planner deduplica E en people, por lo que el alta publica un único fence E.

| Estado confirmado | Membership E | Membership R | Month E | Graph fence/config | Creation revisión/fence | Alta operation fence | Revocación operation fence |
|---|---|---|---|---|---|---|---|
| Alta primero, winner-only y after-rollback | +1 | 0 | +1 | 0/0 | +1/+1 | Una fila epoch 1 | Ausente |
| Alta primero, final tras revocar | +2 | 0 | +1 | 0/0 | +1/+1 | Una fila epoch 1 | Una fila epoch 1 |
| Revocación primero, todos los estados posteriores | +1 | 0 | 0 | 0/0 | 0/0 | Ausente | Una fila epoch 1 |

Fundamento confirmado como instrucciones: SQL014 `896–899` publica people para
el alta; rama membership `886–890` omite esa publicación genérica; `2948`
publica E una vez; `2413,2424–2427,2448` publica mes, creation y operación del
alta. Revocación no toca creation head. Grafo no se publica porque la tarea del
fixture es operativa y la rama membership no publica fence de dependencies.
La existencia del nuevo footprint no habilita incrementos adicionales de R.

El plan de revocación fresco sí puede incorporar el mes de R mediante SQL011
`162`, además del mes E. Capturar todas las filas/fences del ámbito y los meses
efectivos; no confundir adquirir un lock mensual con publicar un fence. Un mes
R ausente no debe convertirse en fila persistente por esta revocación.

## 7. Snapshots y futura evidencia necesaria

Guardar before, winner-only, after-conflict/rollback y after-retry; respuestas,
SQLSTATE y errores completos; PIDs, blockers e identidades/aislamientos
efectivos. El observador captura filas completas por org/company/E/R/entidades,
sin filtrar actor esperado para ocultar extras, y luego afirma autor correcto:

- Perfiles, membresías, equipo y todas las asignaciones/tareas del ámbito.
- Responsabilidad heads/sets/members y relaciones exactas entre sus IDs.
- Creation head, membership/month/graph/operation fences, incluyendo filas
  inexistentes y cualquier fila nueva inesperada.
- Recibos de ambos comandos, eventos de membresía y auditoría por entidad y
  ámbito; además las familias con expectativa cero de la sección 5.

El manifiesto futuro deberá registrar baseline/commit, comandos y exit codes,
motor, aislamiento efectivo, cuatro nombres inequívocos, blockers y outcomes
por caso, snapshots/respuestas y hashes SHA-256 de contrato/runner/SQL011/014,
reporte y logs crudos. Los archivos crudos pueden vivir en ../../outputs;
declarar rutas relativas inequívocas y hashes desde el repositorio. Exigir
cero 40P01. Este contrato define las comprobaciones que debe implementar el
runner; su ejecución y resultados siguen pendientes y no se comunican como
aprobados.

## 8. Riesgo, compatibilidad y límites

Esta familia comprueba que revocación incorpora una ocurrencia y su baseline
de responsabilidad creados mientras esperaba, y que denegar el alta no deja
asignación huérfana, tarea, recibo ni fence parcial. No se identificó un defecto
runtime mediante esta lectura. Las hipótesis requieren medición nativa.

Conservar SQL001–014 y DTO/UI/Worker sin cambios.
Implementar sólo runner/evidencia de esta matriz, sin ampliar producto. La
operativa v2 conserva NULL de peso/target; no introducir placeholders ni
alterar v1. Resultado custom/parameterization, catálogo, jefe/encargado como
creadores, replays/commandReceipt, month.materialize, cierres, empresas ajenas,
otros writers legacy, aislamientos mixtos e inyección de fallos siguen fuera de
esta matriz. Nada de ello se acredita por proximidad al código compartido.

Próximo único: implementación Luna y después revisión Sol de la evidencia
exacta. No aplicar SQL014 ni iniciar preflight remoto. La aceptación de esta
matriz seguirá siendo local y acotada; no cerrará por sí sola M2.2C/§9/Gate L
ni acreditará Auth/HTTP alojado o CI.
