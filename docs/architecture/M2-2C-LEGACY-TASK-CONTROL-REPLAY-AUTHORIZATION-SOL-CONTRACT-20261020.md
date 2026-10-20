# Contrato Sol — replay de wrappers legacy de control de tarea

Fecha: 20/10/2026. Arquitectura: GPT-6.1 Sol alto. Implementación: GPT-6 Luna
medio. Sólo PostgreSQL local sintético. Aceptación independiente vuelve a Sol.

## 1. Baseline, alcance único y sospecha

HEAD inspeccionado: `f3a20cfe9ffba0efea5f8e09be047ebd25eb4e7d`, árbol limpio.
SQL014 blob Git exacto:
`B5EAED293474A5A666E396AB42CBDAF998D9EA7EC63B93F111FA90B954230C92`;
checkout raw:
`CDD909C1A280DF8E891D6062838B146AEECADCF5CBC0F52291C6D44A0C89ECA2`.
Registrar ambos y `git ls-files --eol`; extraer blob byte a byte para rojo.
No intercambiarlos por conversión de newlines del shell.

La auditoría residual compañera fija cuatro wrappers efectivos:

| Wrapper y fuente efectiva | Kind recibo | Claves raw de arguments |
|---|---|---|
| transition_task_reviewed, SQL011:774 | transition_reviewed | instance,next,reason,revision |
| set_checklist_item_reviewed, SQL011:789 | checklist_reviewed | instance,check,done,reason,revision |
| set_task_wait, SQL011:804 | task_wait | instance,note,revision |
| set_task_wait_reviewed, SQL012:7 | task_wait_reviewed | instance,note,reason,revision |

Los cuatro toman receipt lock, comparan argumentos y retornan revision antes de
`_coordination_apply_task_control`. SQL014 conserva esas definiciones y sólo
reemplaza su núcleo, por lo que el retorno cached puede saltar reautorización.
Es sospecha estática todavía sin reproducción de esta familia. La aceptación
API task.transition/revocación y el replay timer no prueban estos wrappers.

Se trata como **una familia compartida**, no cuatro proyectos: helper readonly
privado común y delegación desde las cuatro ramas cached. Fuera de alcance:
otros endpoints de inventario, modificaciones al núcleo writer, servicios
alojados, UI/DTO/Worker, nuevos permisos, nuevas tablas e índices.

## 2. Preparación, rojo obligatorio y no-go inicial

Registrar HEAD/status, hashes de todas las migraciones001–014, contrato,
runners y herramientas. Conservar001–013 byte a byte. No instalar dependencias.
Base nueva con001–014 del baseline; preparación privilegiada sólo sintética.

Por cada wrapper: E empleado activo AAL1 propietario único, J jefe activo AAL2
distinto; organización/empresa/equipo/membresías autorizados; tarea resultado
puntual del período actual ART abierto, pendiente/revisión0 y responsabilidad
baseline real. Checklist con dos controles incompletos. Sin tracking,
dependencias, coberturas, ausencias, cierres ni actividades previas. Grafo y
fences de mes E/J preexistentes0; membership fences inicializados por trigger.
No crear recibos manualmente. Fixtures y operaciones separadas por wrapper.

Primera ejecución auténtica de cada wrapper, expected revision0:

- transition_reviewed: Pendiente→En curso, reason NULL; resultado1 y sesión E.
- checklist_reviewed: primer control→true, reason NULL; segundo sigue false;
  resultado1, En curso y sesión E. Evitar completar por último control.
- task_wait: noteRaw no vacío; resultado1 y espera sin sesión nueva.
- task_wait_reviewed: igual espera, reason NULL; resultado1.

Comprobar resultado y recibo auténticos `{revision:1}`. Guardar estado confirmado
B completo, incluidos sesión/auditoría/fences. Para cada wrapper, medir:

1. Replay autorizado exacto00000/1 e inercia total.
2. Revocar E/empresa por comando real J, confirmar; replay fresco E predicho
   00000/1. Registrar resultado indebido como rojo, no aceptación.
3. Otro fixture: perfil E inactivo confirmado; replay predicho00000/1.
4. Conflictos por cada campo raw y kind auténtico: P0001, mensaje primario
   `Identificador de operación reutilizado con otros argumentos`. Referencia
   reason/note con sólo espacios diferentes sigue siendo argumento distinto.
5. Un probe RR representativo de task_wait: fijar snapshot E antes de que J
   revoque/confirme; replay posterior en RR predicho00000/1. Registrar contexto
   efectivo y lectura del observador que acredita membresía ya inactiva.

Obtener recibo kind distinto mediante otro endpoint real y operación auténtica,
en otra empresa del fixture. No contaminar las carreras con sesiones/tareas
extra del actor en la empresa revocada; conservar scopes completos para detectar
efectos cruzados. En conflictos variar un argumento válido por vez; otra tarea
debe existir. Mantener reportes rojos originales separados de candidata.

No-go: si un wrapper ya deniega el replay revocado/inactivo, si no hay recibo
auténtico, si baseline/hash difieren o fixture/firmas impiden la primera llamada,
detener ese cambio y volver a Sol. No abrir carreras hasta rojo acreditado.
No reescribir el contrato en Luna para aceptar resultados inesperados.

## 3. Modificación permitida y protocolo común

En SQL014 añadir override de los cuatro wrappers copiando sus cuerpos vigentes;
cambiar sólo las ramas cached para delegar en un helper privado común nuevo.
Conservar validación inicial de cada wrapper, firma/grants, kind/args raw,
primera ejecución y formato de recibo. No modificar001–013 ni helpers globales,
`_coordination_apply_task_control(_m22b)`, API command/query o familias aceptadas.

El helper privado admite únicamente esos cuatro kinds y un recibo auténtico
actor/operation/task; no aceptar un result JSON confiado al cliente. Se puede
usar firma interna `(task,operation,kind,args) returns bigint` o equivalente.
Fijar search_path vacío y revocar EXECUTE a public/anon/authenticated/service_role.
No convertirlo en endpoint nuevo. Los wrappers SECURITY DEFINER lo llaman.

Mantener receipt lock1101 y comparación de kind/args antes de autorización,
incluido actor revocado/inactivo. Conflicto conserva P0001 y mensaje legacy.
Preparar tarea, actor E y responsables actuales con sus meses y clave graph
de resultado; adquirir `_coordination_acquire_m22b(plan,false)` respetando
1101→1102→1103→1104→1105→locks/fences/filas existentes. Incluir actor en perfiles.
No variante writer, month touch, creación de grafo o incremento de epochs.

Releer tarea/recibo bajo esos locks; exigir organización coherente, identidad
actor/operation, kind, args y resultado íntegro y sin sustitución respecto del
recibo leído originalmente. Inconsistencia concurrente:40001 sin reparación.
Result histórico es objeto exacto `{revision:bigint}` no negativo, incluido0
de operaciones sin cambio; no convertirlo en task.state_revision actual.

Reautorizar perfil activo, rol empleado/encargado/jefe de la misma organización
y acceso `_can_access_instance_at` vigente, con condiciones NULL-safe.
Denegación base: P0001, mensaje primario `Sin permiso`. Para tarea protegida por
tracking/dependencias, conservar adicionalmente la condición actual de ejecutor
que exige `_coordination_apply_task_control_m22b`; no permitir que cached la
salte. No inventar MFA universal para wrappers cuyo nombre dice reviewed:
el writer permite actividad propia AAL1; MFA contextual de interrumpir sesiones
ajenas pertenece a la primera ejecución, que aquí se conserva íntegra.

No ejecutar nuevamente controles, transición, espera, readiness, estado inicial,
expected revision actual, cierre de mes ni autoarranque/parada de cronómetros.
Un replay autorizado devuelve revision histórica sin ninguna escritura.
Las precondiciones consumidas de la primera ejecución no se vuelven a evaluar.
Interrupción de cronómetros ajenos y reaperturas supervisoras no amplían esta
matriz; no cambiar su política por este bloque.

## 4. Matriz verde secuencial finita

Cada caso declara wrapper/kind y baseline; no contar preparaciones como replays.

| Por wrapper, salvo alcance indicado | Resultado | Efectos del replay |
|---|---|---|
| Inmediato autorizado E AAL1 | 00000,1 | Igualdad total con B |
| Tras avance legítimo de tarea con otra operación | 00000,1 original | Ninguno |
| Revocado fresco | P0001,Sin permiso | Ninguno |
| Perfil inactivo | P0001,Sin permiso | Ninguno |
| Restauración membresía con comando J y revisión actual | 00000,1 | Ninguno |
| Reactivación perfil local, E AAL1 | 00000,1 | Ninguno |
| Conflictos de cada argumento, activo/revocado/inactivo | P0001,mensaje raw | Ninguno |
| Kind distinto con recibo real | P0001,mensaje raw | Ninguno |
| Operación auténtica sin cambio revision0, después replay | 00000,0 | Recibo0 se conserva íntegro |
| Sólo task_wait: RR stale después de revocación confirmada | 40001; retry fresco P0001 | Rollback sin cambios |
| Sólo representante: cierre legacy real seguido de replay autorizado | 00000,revision original | Ninguno |

Para revision0 usar primera acción válida sin cambio: transición a Pendiente,
check=false ya false o wait note=NULL sin espera, según wrapper. No fabricar
recibo0. Para el avance/cierre, usar endpoints reales y cumplir sus condiciones;
capturar baseline posterior. Si no puede prepararse cierre auténtico, volver a
Sol con diagnóstico, sin insertar directamente monthly_closures.

La matriz debe probar que cada wrapper realmente usa el helper compartido
mediante sus replays autorizados/denegados e inercia; una prueba textual de que
la función menciona el helper no basta. No introducir otras cuatro matrices
de carreras idénticas si todos delegan al mismo protocolo inalterado.

## 5. Ocho carreras del camino común, representante task_wait

Usar `set_task_wait` auténtico como representante: tarea resultado E propietario,
espera inicial ya confirmada, revision1, sin sesiones. Un fixture por caso;
J autor de revocación, ambos activos con membresías autorizadas. Declarar pares
efectivos replay/revocación RC/RC, RC/RR, RR/RC y RR/RR; ambos ganadores.

| Ganador | Ganador | Perdedor | Retry nuevo, mismos argumentos |
|---|---|---|---|
| Replay E | 00000,1 | Revocación J00000 | Revocación00000 JSON original; replay E posterior P0001 |
| Revocación J | 00000 JSON/recibo | Replay E40001 | Replay E P0001,Sin permiso |

Tres conexiones, contextos consultados (auth.uid/claims/AAL/PID/aislamiento/
snapshot) y snapshot del perdedor antes del comando. Exigir PID ganador en
`pg_blocking_pids(loserPid)` mientras ganador abierto, no sleeps como prueba.
Capturar B, winner-only, rollback explícito, final y post-retry. Mantener
revocador sin confirmar al capturar replay winner-only. Retry en backend nuevo,
claims correctos y PID diferente; cero40P01. Resultados fuera de tabla => Sol.

Desde B, replay y denegaciones tienen delta cero. Revocación efectiva:
membresía E active=false/revision+1/access_valid_from=null/changed_by=J con
timestamp válido; membership fence E+1, J+0; graph fence+1/config sin cambio;
month fences E/J sin cambio; tarea no completada revision+1, espera y demás
campos iguales; sesiones siguen vacías. Una fila company_membership_event,
audit companyMembership.setActive, recibo API J y operation fence J/op epoch1.
Recibo task_wait, audit y datos de espera inicial íntegros. No exigir evento
timer_stopped ni efectos sobre actividad/cobertura que el fixture no tiene.

Construir expected desde B cambiando sólo campos permitidos. Para filas nuevas
comprobar claves, identidad, empresa/perfil, revision, argumentos/resultados
completos y tiempos, no copiar filas reales enteras sin acotar campos. Respuesta
API debe igualar resultado construido independientemente y su recibo.

## 6. Snapshots, validación y aceptación

Arrays completos ordenados por claves reales: perfiles/company/team members,
tareas/asignaciones, responsabilidad sets/heads/members independientes,
sesiones/actividad del actor y tareas, ambos tipos de recibo, audit sin ocultar
autores, membership/month/graph/operation fences de todos los períodos del
ámbito; espera/controles/seguimiento/dependencies/events/completions/reopen,
coberturas/plans, ausencias/companies, evaluaciones/versiones, cierres/reportes/
entregas/outbox. No joins que oculten huérfanos ni conteos que oculten cambios.
Capturar antes/después de cada replay y comparar; conservar valores completos
de receipt(created_at,result,args), checklist y sesiones/timestamps.

Artefactos rojos/verdes separados, hashes SQL baseline/candidata/001–013,
contrato/runners/reportes/logs. Manifiesto versionado declara work/site como
base y rutas resolubles, comandos efectivos/stdout/stderr/exit codes/versiones.
Extraer el blob baseline byte a byte y conservarlo. No publicar secretos.

Validación focal es el runner nuevo de esta familia; luego matriz nativa vigente
con --review-matrix full --through-014 yes --m2-2a-smoke yes --m2-2c-smoke yes,
suite completa, TSC, builds cliente/Worker, sintaxis y diff-check. No repetir
checks no afectados tras cambios sólo de evidencia; repetir los reportes cuyo
runner cambie. Corregir metadata de contextos en el momento de cada llamada.

No-go final: permiso ampliado, primera ejecución distinta, recibo fabricado,
helper accesible al cliente, falta de blocker, deadlock, efecto readonly o
snapshot incompleto. Sol revisa hashes exactos y acepta sólo esta familia.
No se declara Gate L completo ni se aplican migraciones/servicios alojados.
Después volver al inventario residual finito C/A/P y al cruce consolidado §9,
sin reimplementar las tres familias de replay ni carreras ya aceptadas.
