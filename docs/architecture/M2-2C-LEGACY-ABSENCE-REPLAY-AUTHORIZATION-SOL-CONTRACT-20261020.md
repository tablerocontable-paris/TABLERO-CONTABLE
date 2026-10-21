# Contrato Sol — replays legacy de aprobación/cancelación de ausencias

Fecha: 2026-10-20. Arquitectura y revisión: GPT-6.1 Sol, esfuerzo alto.
Implementación autorizada: GPT-6 Luna, esfuerzo medio. Ámbito local y sintético únicamente. La aceptación vuelve a Sol.

## 1. Baseline e hipótesis

Baseline inspeccionada: `dbf65fadde1693f29d52a85c9f17f9dc000bbcc9`, igual a `origin/main` al iniciar esta revisión.

| Archivo | Blob Git de HEAD | SHA-256 de bytes del checkout |
|---|---|---|
| `supabase/migrations/202610150014_operational_api.sql` | `4a283f7261f3500e3e20320be68c048e3ddfee2b` | `CE85FFB750443CB54CC25DD55AE25831CCFE71D8A10EA143D54C34855009447D` |
| `supabase/migrations/202610060011_coordination_activation.sql` | `3c8202175c8f99d1fd96848cd74f0982c08e5a34` | `9729A6800E93DEDC43AB5F0840309B7C0D222343898CC8D5B43EEB4A387F4210` |

Aceptación C revisada: `M2-2C-LEGACY-COVERAGE-REPLAY-SOL-ACCEPTANCE-20261020.md`, SHA-256 `64A2B9D3F9024E307FC21DCBEB38B810208B551C8DA2BE8DFEB6CE094FD8F8A1`. Inventario §9: `M2-2C-SECTION9-RESIDUAL-AUDIT-SOL-20261020.md`, SHA-256 `26514C757B2D96BFCADA99E82BC085A7A46F7CB798227DF73C1341A7A828FFB1`.

El árbol del commit es la baseline reproducible; al inspeccionar sólo había un scratch no versionado `tests/review/m2-2c-legacy-task-control-replay-races.block`, que no pertenece a A. Capturar antes de ejecutar `git status`, branch, HEAD, ambos hashes de SQL014 (blob y archivo), los hashes de SQL001–013 y los del contrato/runner/evidencia. Si HEAD o cualquier baseline SQL difiere, detenerse y pedir revisión Sol; no adaptar hashes desde el shell ni mezclar los bytes red y green.

SQL011 define `public._get_mutation_receipt(text,jsonb,uuid)` en 1379. Su flujo adquiere lock de recibo, busca por `(actor_id, operation_id)`, da conflicto legacy si cambian `kind/arguments` y retorna el resultado cached en 1384; sólo sin recibo consulta `actor_org()`. Los únicos dos consumidores efectivos de ese helper en SQL011 son `approve_employee_absence` (1395) y `cancel_employee_absence` (1429). SQL014 no los reemplaza hoy. El helper es SECURITY DEFINER y su EXECUTE se revoca a clientes; **no modificar ni ampliar globalmente `_get_mutation_receipt`**. A trata ambos wrappers como una familia autorizada, en SQL014 candidato. C y T permanecen cerradas; no repetir sus matrices.

Hipótesis por reproducir antes del cambio: tras una primera ejecución auténtica, un replay exacto retorna el recibo antes de MFA, perfil/rol/org activos y ámbito actual. Un cambio de autorización con `api.command_v1` puede dejar el replay permitido. Esto es sólo sospecha estática hasta obtener el rojo.

## 2. Contrato de compatibilidad y autorización

Conservar firmas, tipos de retorno, grants existentes, validaciones iniciales, nombre de operaciones/argumentos, recibos y efectos de primera ejecución. Reemplazar sólo los dos wrappers en SQL014 y añadir, si se necesita, un helper privado específico de reautorización de ausencias. No tocar SQL001–013, `_get_mutation_receipt`, P, otras RPC, UI, Worker, servicio alojado ni permisos generales. Todo helper nuevo debe ser SECURITY DEFINER con `search_path=''`, no invocable por `public`, `anon`, `authenticated` ni `service_role`; revisar ACL efectiva tras toda la cadena 001–014.

Para las dos rutas, el orden observable queda:

1. Mantener las validaciones estructurales de argumentos que hoy preceden al lookup.
2. Tomar el receipt lock del actor/operation y llamar al helper compartido. Mantener kind/argumentos antes de autorización: si un recibo existe pero discrepa, devolver SQLSTATE `P0001` y mensaje primario `Identificador de operación reutilizado con otros argumentos`, incluso con perfil inactivo, rol degradado, AAL1 o scope perdido.
3. Si hay recibo exacto, **antes de devolverlo** validar la sesión privilegiada actual (AAL2), perfil activo, organización y rol actual `jefe`/`encargado`; luego scope específico de la ausencia. No volver a ejecutar la operación ni sus precondiciones consumidas.
4. Coordinar el check actual con cambios concurrentes. Construir un plan sólo con identidad, perfiles impactados, período/ausencia y relaciones pertinentes; usar el orden de locks de SQL011 y revalidar tras esperar. En la rama readonly no incrementar/crear fences, revisiones, auditoría, recibos ni filas de sesión. Bloquear explícitamente con `FOR SHARE`, en orden determinista, las filas actuales de perfiles, memberships y ausencia/empresas usadas para autorizar; evitar que una transacción RR valide una versión revocada sin abortar. Si la fila o scope del plan cambió durante la lectura, abortar `40001` y exigir transacción nueva.
5. Sólo con autorización vigente, devolver exactamente el resultado persistido: UUID original de aprobación; retorno void de cancelación. No recalcular ni exigir que sigan vigentes los precondicionantes consumidos (ausencia no superpuesta, mes abierto, ausencia aún no cancelada, sesiones aún abiertas).

`public.require_privileged_session()` exige rol `jefe`/`encargado` activo y AAL2; `actor_org()` y `actor_role()` derivan perfil activo. Mantener su semántica/mensajes. Rechazo por MFA/rol conserva el error existente (`P0001`, `Se requiere sesión de responsable con MFA`); scope fuera de ámbito conserva el error legacy y `P0001`. No devolver datos de recibo/ausencia a quien no superó current auth. La diferencia de organización, sujeto o receipt incoherente no debe convertirse en enumeración de recibos.

### `approve_employee_absence`

Args receipt actuales: `owner`, `replacement`, `kind`, `starts`, `ends`, `companies`, `note`; resultado `{id}`. La clave JSONB conserva nota raw y orden del array, tal como fue almacenada; no normalizar el recibo durante replay.

Para `jefe`, exigir perfil activo y misma org, más coherencia de la fila sellada con el recibo original. Para `encargado`, conservar la relación vigente `can_access_owner(owner)` y, si existe, `can_access_owner(replacement)`, además de scope vigente de empresas elegidas. Titular/reemplazante deben seguir perteneciendo a la organización del recibo. No exigir que el mes esté abierto, que no haya otra ausencia, que la persona siga disponible, ni que el vínculo siga sin cancelar: esas son precondiciones de la primera aprobación, no permisos para leer el ACK histórico.

Hallazgo acotado: SQL011 comprueba existencia de filas `company_memberships` del encargado sin `active=true` en 1407, mientras SQL014 revoca membresías con `active=false` y conserva la fila. Para que revocar acceso empresarial revoque también el acceso a un ACK, requerir membresía activa actual del encargado para cada empresa del recibo, tanto en el check de primera aprobación como en el replay. Esta es la única corrección de precondición de primera ejecución autorizada en A; no cambiar elegibilidad de owner/replacement ni otra regla. El snapshot y test deben distinguir al encargado con membership existente inactiva. Jefe conserva alcance organizacional.

La primera aprobación conserva: perfil/rol/dates/kind válidos; reemplazante distinto, activo y de rol permitido; empresas únicas, no-null, en cantidad consistente con reemplazante; membresías actuales exigidas por la función; ausencia sin solapamiento; meses abiertos. Inserta una ausencia, sus vínculos de empresas, la sella, una auditoría `absence.approved`, un receipt `{id}` y retorna ese UUID. Reintento exacto autorizado devuelve ese UUID sin cambios, incluso si luego la ausencia fue cancelada.

### `cancel_employee_absence`

Args receipt actuales: `absence`, `reason=trim(p_reason)`; resultado `{cancelled_at}`. Conservar razón trim como identidad; whitespace externo equivalente sigue siendo el mismo argumento. Salida SQL void.

Revalidar la ausencia target en la org activa del actor, relación actual de scope al titular; para encargado, verificar también relación actual al reemplazante cuando exista y membership activa actual en **todas** las empresas asociadas a la ausencia. Jefe conserva alcance de organización. El propietario puede estar inactivo si el predicado actual de autoridad lo permite; no introducir una prohibición nueva al reautorizar una cancelación histórica. No requerir `cancelled_at IS NULL`, sesiones abiertas ni recalcular corte.

Hallazgo: el check encargado/empresa de SQL011:1437 prueba existencia, no `active`, por lo que la revocación conserva una fila permisiva. Endurecer a membership activa para actor en el scope de empresas de esta ausencia tanto para nueva cancelación como replay, coherente con la autorización de trabajo de SQL014. No ampliar a empresas no enlazadas. Jefe mantiene su autoridad.

La primera cancelación conserva: timestamp cutoff real; marca la ausencia; detiene sólo sesiones abiertas enlazadas a esa ausencia con `_effective_session_end`; incrementa la revisión de cada tarea afectada; inserta un evento `absence.session_stopped` por sesión y un `absence.cancelled`; persiste `{cancelled_at}`. Una segunda operación nueva sobre una ausencia ya cancelada conserva el cutoff original, no duplica `absence.cancelled` ni altera sesiones/tareas ya detenidas, pero guarda su propio receipt como lo hace hoy. Replay exacto de un receipt existente no produce ningún efecto adicional.

## 3. Reproducción roja antes de modificar SQL014

Crear PostgreSQL nativo descartable desde la cadena SQL001–014 exacta del commit baseline. Fixtures independientes y sintéticos por endpoint: J=jefe activo AAL2; M=encargado activo AAL2; E=empleado titular; R=empleado reemplazante; empresa C, equipo y períodos abiertos. M administra a E/R y tiene membership activa en C; E/R están activos y afiliados a C. No usar datos reales ni insertar/alterar receipts para simular operaciones.

1. Ejecutar aprobación real como M AAL2, con `kind='vacaciones'`, intervalo actual ART corto, empresa `[C]` y replacement R. Confirmar UUID, ausencia sellada, vínculo C, una auditoría y un receipt auténticos. Hacer replay inmediato autorizado; resultado UUID idéntico, snapshot sin delta.
2. En fixture separado, aprobar y crear un task sintético de E/C que R pueda cronometrar durante la ausencia. Iniciar el reloj con la RPC real como R. Cancelar la ausencia por primera vez como M AAL2. Confirmar salida void, `cancelled_at`, sesión terminada, una revisión de tarea incrementada, eventos esperados y receipt auténtico. Repetir exactamente como M; salida void y snapshot sin delta.
3. Para cada uno de los dos endpoints, reproducir en fixtures separados estos cambios de autorización **después** de su receipt real: (a) M cambia AAL2→AAL1 en claims; (b) `profiles.active=false`; (c) `profiles.role='empleado'`; (d) pérdida del scope del encargado cambiando la relación manager de E a J; (e) revocación empresarial autenticada `api.command_v1(companyMembership.setActive)` de J que pone membership de M/C `active=false`. Los casos (b–d) son mutaciones de fixture sólo en DB local; (e) debe usar comando público real, revision esperada actual, operación nueva y confirmación de J.
4. En cada caso, capturar contexto de sesión y snapshot antes/después del replay. Baseline sospechada: replay exacto todavía retorna `{id}`/void `00000` pese a la pérdida de autorización; registrar lo observado sin forzarlo. Probar además un operation ID fresco: los casos AAL1/inactivo/rol/scope deben denegar sin escritura. Si baseline ya deniega el replay de algún estado, registrar y volver a Sol antes de modificar esa rama.
5. En cada endpoint con su receipt auténtico, variar por separado un argumento válido (`note` no vacío para aprobación; `reason` no vacío para cancelación) y cruzar un receipt de la otra operación con el mismo `operation_id` para demostrar kind mismatch. Incluso con autorización revocada: `P0001`, mensaje `Identificador de operación reutilizado con otros argumentos`, delta cero. No fabricar el receipt. Para aprobación, igualdad compara la nota raw y el array de empresas en el orden guardado; para cancelación compara razón trim.

Cada sesión debe registrar `auth.uid()`, JWT claims/AAL, PID, aislamiento y snapshot MVCC real. Un error de setup, operación inicial o permisos/grants no acredita rojo; detenerse y pedir revisión Sol.

## 4. Verde secuencial y no-regresión de primera ejecución

Después de reproducir rojo, implementar sólo el cambio autorizado en SQL014 y probar sobre otra base descartable. Las matrices de permiso se repiten separadas para aprobación y cancelación. Resultado exacto de replay ante auth loss: `P0001`, mensaje existente de MFA/ámbito; sin delta. Para membresía inactiva del encargado, una operación nueva y un replay deben denegarse; la restauración por J mediante `companyMembership.setActive(true)` permite de nuevo el replay histórico original, sólo si el resto del scope sigue válido.

Casos mínimos por endpoint:

- primera ejecución válida y replay inmediato autorizado;
- autorización vigente tras mutación inocua que no cambie args/target;
- AAL1, perfil inactivo, rol degradado y scope manager perdido, casos separados;
- membership empresarial inactiva separada;
- restauración auténtica de scope y replay autorizado readonly;
- argumentos alterados/kind ajeno conserva conflicto legacy antes de reautorización;
- resultado original exacto; no recalcular el retorno ni volver a ejecutar operaciones.

Completar snapshots ordenados y deep-equal antes/después por todos los tables base de `public` y `app_private`, no sólo entidades esperadas. Incluir explícitamente ausencia/sello/company links, receipts, audit events, profiles, team/company memberships, sessions, tasks/checklists/revisions, monthly closures, month/membership/graph/API fences, API receipts/events, activity, bindings, reports/outbox y cualquier tabla escrita por triggers. No excluir filas por actor esperado. La primera ejecución debe compararse contra su propio baseline y comprobar los efectos descritos arriba; el replay debe comparar contra el estado justo anterior a replay.

## 5. Concurrencia mínima exigida

Primero, para cada endpoint, stale-RR red y green separados: M abre `REPEATABLE READ`, obtiene snapshot/lee su membresía activa; J desactiva M/C mediante `api.command_v1(companyMembership.setActive)` en otra sesión; observador confirma membership/fence/event/receipt/auditoría; M llama replay exacto con snapshot stale. Baseline documenta leak si aparece. Candidata debe abortar `40001` al revalidar/bloquear la fila cambiada; luego `ROLLBACK` y retry en conexión/transacción nueva deniega `P0001` sin delta. No leer sólo el estado del observador: capturar también qué ve cada conexión.

La ruta `api.command_v1` usa coordinación m22b; las wrappers legacy usan coordinación pública de 011. Antes de aceptar la matriz, Luna debe documentar que ambos caminos comparten el orden de advisory locks 1101→1102→1103→1104→1105, lock de perfiles y lock de las filas company membership afectadas. En la rama readonly no se puede crear/incrementar fence. Si no se prueba este puente entre coordinadores, detenerse antes de carreras y traer a Sol el delta mínimo; no fingir blockers.

Si se confirma el protocolo común, ejecutar ocho carreras locales: endpoint cancel (replay representative) y también approve (scope de empresa propio), pares RC/RC y RR/RR, ambos ganadores por par. No se exigen los pares mixtos RC/RR y RR/RC en este contrato mínimo. J revoca M/C con operación real y mantiene la transacción writer abierta; replay exacto compite. El observador comprueba `pg_stat_activity.wait_event_type='Lock'` y `pg_blocking_pids(pid)` contiene al ganador antes de liberar. Esperas deben usar promesas/poll acotado, no sleep como evidencia.

| Ganador | Resultado del perdedor / retry |
|---|---|
| Replay M | Retorno histórico readonly; writer J completa `00000`; retry fresco de M tras revocación `P0001`. |
| Revocación J | Replay en snapshot viejo aborta `40001`; `ROLLBACK`; retry fresco de M `P0001`. |

Para cada carrera capturar snapshot completo inicial, estado ganador mientras su transacción continúa abierta, final comprometido y after-retry. El post-replay/rollback debe deep-equal al snapshot del writer confirmado cuando gana writer, incluyendo todos sus deltas legítimos; cuando gana replay, comparar cero delta del replay antes de permitir commit del writer. Cero deadlocks `40P01`. No reutilizar conexión abortada.

La matriz de ocho se detiene si se demuestra que la concurrencia de los wrappers no comparte protocolo real o si el writer no bloquea la pérdida de membership. Mantener los stale-RR secuenciales por ambos endpoints en ese caso y volver a Sol con reporte, no ampliar locks por intuición.

## 6. Artefactos y aceptación

Separar directorios/reportes red y green. Guardar runner, stdout/stderr/exit codes exactos, snapshots (o artefacto reproducible que incluya todas las filas), versión PostgreSQL, fixtures/contextos y lista completa de tablas incluidas. Manifiesto versionado en repo y copia canónica debe declarar contrato, HEAD/blob baseline, hashes red/green/runner, migraciones, resultado por endpoint, carreras, suite/builds, límites y rutas. Verificar hashes/copias byte a byte antes de devolver a Sol.

Sobre el candidate exacto: runner `node --check`; matriz PostgreSQL específica A; matriz nativa completa actual (351/351 en C baseline); suite completa (738/738 en 74 archivos), TypeScript, build cliente y Worker, diff-check. No usar datos ni servicios remotos. SQL001–013 deben conservar blob SHA. No dar por aprobada la API/HTTP Supabase alojada.

No-go si no se reproduce rojo autenticado por endpoint, cambia el resultado/efecto de primera ejecución fuera de la excepción activa membership descrita, conflicto de argumentos/kind deja de preceder autorización, replay autorizado escribe, replay revocado revela resultado, primera operación revocada se acepta, hay delta en snapshot readonly, no se captura blocker real donde corresponde, se incrementa fence en readonly, hay deadlock, ACL/helper queda ejecutable por cliente o falta evidencia/hash exacto. Sol acepta sólo el alcance A y hashes candidatos enumerados.

## 7. Exclusiones y siguiente etapa

Esta autorización cubre sólo `approve_employee_absence` y `cancel_employee_absence`. **P** (`pause_task_timer` y `save_private_block_note`) permanece como dictamen de política separado. El cruce completo de §9 y Gate L siguen abiertos. No aplicar SQL014 en Supabase, no iniciar preflight alojado, no conectar servicios, no activar el espacio operativo ni usar información real. Tras implementation, Sol revisa A; luego decide P y realiza el cruce consolidado §9/Gate L.
