# Aceptación Sol — replay legacy de responsabilidad

Actualización: 20/10/2026. GPT-6.1 Sol, revisión independiente.
**Dictamen vigente: aceptado localmente en el alcance del contrato.** Los
cuatro P2 de la revisión anterior quedan cerrados en los artefactos identificados
abajo. La revisión de rechazo se conserva al final como historial; su dictamen
ya no es el vigente. Esta aceptación no cierra §9/Gate L ni autoriza aplicar014.

## Corte aceptado y hashes exactos

Baseline Git: `c12c43aaa8db002596bc04b5836d0de0af0d4f43`.
Contrato SHA-256:
`DC7FA9BEEE6491C48F5A39E33CD30E7C1360AFD560BBD144B0927F7A27685C6F`.

| Artefacto | SHA-256 aceptado |
|---|---|
| SQL014 candidata checkout | `CDD909C1A280DF8E891D6062838B146AEECADCF5CBC0F52291C6D44A0C89ECA2` |
| SQL014 baseline blob | `092B14200AD17D5FF5F96C5D6D748826366B395E3308082C5FEDAE40444EB4EA` |
| Runner rojo | `007C2090CF8A926A4271E9A0A467A7E3CC0E9C1749194F55F2AF75FFA44C9CDD` |
| Runner verde | `06CB251C6A139D2A67566842B3FAF0921A2542F063E47157879BEA7DA227E105` |
| Generador de manifiesto | `10D105A33C56594A229135A97200B24FD1B766A90661CB345A60D9501F8F4EBB` |
| Manifiesto versionado | `478157350FC4ED3561EE5DF6BD940E0B79E20D339E8D6861F16B3B1182E71C1F` |
| Reporte rojo red-sol-p2-final3 | `72BD55572E36E2ABAF83AADD009F646A2728C09CA9A3B200093709B2E5600726` |
| Reporte verde green-sol-p2-final6 | `8797A49DDB50A7BB0287BD429A642E4A71F2F4958D47157CE1920D123AFCDAD0` |

Manifiesto:
`review-evidence/M2-2C-LEGACY-RESPONSIBILITY-REPLAY-20261019.json`.
Runners: `tests/review/m2-2c-legacy-responsibility-replay-red.mjs`,
`m2-2c-legacy-responsibility-replay.mjs` y
`m2-2c-legacy-responsibility-evidence-manifest.mjs`, relativos a work/site.
Reportes bajo `../../outputs/m2-2c-legacy-responsibility-replay-luna-20261019/`.

## Cierre de los cuatro P2

**R1 cerrado.** La tarea operativa de M que genera el recibo de kind distinto
se ubica ahora en kindCompany separada. Cada una de las ocho carreras afirma
que, en la empresa revocada, M no posee tareas/asignaciones ni integra
participantes, teamMembers, cobertura, sesiones o actividad. Los arrays de
scopeAssertions están vacíos. Sol comprobó en los ocho reportes que tareas,
asignaciones, sets, heads y members completos permanecen iguales entre baseline
y final; también graph y month fences. El delta ya no admite revisiones de
tareas de M. Los ocho casos cubren los cuatro pares RC/RC, RC/RR, RR/RC y RR/RR
con ambos ganadores y aislamientos consultados en cada backend.

**R2 cerrado.** Rojo nuevo contiene21 steps, incluidos12 conflictos de campo
con actor activo/revocado/inactivo, kind conflictivo auténtico y replay fresco
revocado00000. Conserva la reproducción RR y los retornos indebidos con
inactivo/degradado/AAL1 contra el blob baseline exacto. Verde nuevo contiene28
steps; se distingue preparación de replay. Se agregaron replays históricos
exitosos después de restaurar membresía y de restaurar perfil/rol, con resultado2
y snapshots iguales. Sol verificó24 secuencias con snapshots completos e
igualdad de colecciones. Los casos de avance, cierre auténtico, jefe y todos
los conflictos requeridos continúan presentes.

**R3 cerrado.** La membresía esperada se deriva del baseline cambiando sólo
active/revision/changed_by/changed_at/access_valid_from; se exige null en
access_valid_from y timestamp válido/progresivo. El membership fence sólo cambia
epoch. Las filas nuevas se comprueban por organización/actor/empresa/perfil/
operación/revisión y claves, con details completos de auditoría, cuotas y
recibos históricos intactos. Resultado API esperado se construye
independientemente y se compara con respuesta y recibo; operation fence tiene
la fila exacta actor/operation/epoch1. La igualdad final de todas las colecciones
rechaza efectos adicionales. Los cuatro snapshots de rollback40001 coinciden
con final confirmado, y los ocho post-retry con final.

**R4 cerrado.** El manifiesto declara pathBase=work/site y usa rutas ../../
correctas para outputs. Sol resolvió y verificó33/33 objetos path+sha256 sin
faltantes ni mismatches. Comprobó16 hashes checkout y16 blobs de migraciones;
001–013 no cambiaron. Los11 comandos incluyen rojo/verde focales, matriz nativa,
suite, TSC, cliente/Worker, sintaxis de tres runners y diff-check; todos registran
exit0 con stdout/stderr referenciados. Se leyeron además los11 exit-code.txt
adyacentes: los11 contienen el texto `0`, SHA-256 común
`5FECEB66FFC86F38D952786C6D696C79C2DBC239DD4E91B46729D73A27FB57E9`.
La candidata SQL no cambió durante la corrección de evidencia; la matriz
nativa351/351 y suite74 archivos/738 pruebas conservan su alcance sobre esa
misma candidata. TSC y builds tienen logs nuevos y exit0.

## Revisión, evidencia y límites P3

Sol revisó el contrato, diff SQL, ambos runners y manifiesto; ejecutó scripts
Node de lectura con fs/crypto/git cat-file para validar hashes/rutas,
aislamientos/blockers, scopeAssertions y equivalencia de snapshots. Los scripts
terminaron exit0. `git diff --check` volvió a terminar exit0. No se volvieron
a ejecutar las bases ni suites porque el producto conservó el mismo hash y los
resultados nuevos afectados por cambios de runner estaban disponibles.

Persisten notas P3 no bloqueantes:

- El step verde «AAL1 manager replay denied» adjunta por error el último contexto
  AAL2, porque se agrega después de registrar el replay restaurado. El array
  contexts conserva la consulta real AAL1 del mismo PID16036 en snapshot1468,
  anterior al AAL2 snapshot1470. La secuencia de código y error crudo P0001 desde
  require_privileged_session prueban la denegación MFA. Este campo por step se
  considera metadata incorrecta; no se usa como prueba de identidad/AAL.
- Los reportes nativos mantienen una etiqueta focusedMatrix histórica de OneOff;
  se usan sus resultados individuales351 y hash de SQL, no esa etiqueta, para
  acreditar regresión completa. El rojo/verde de esta familia acredita las
  nuevas carreras y replays.
- Conversiones LF/CRLF y avisos Rollup registrados no afectan este dictamen.
  Los exit-code files se comprobaron adicionalmente; sus hashes comunes quedan
  registrados aquí aunque el manifiesto conserva exitCode como valor.

El cambio de producto aceptado son31 líneas en la rama cached de
assign_task_responsibility; primera ejecución y001–013 se conservan. Los
replays autorizados devuelven el resultado original sin escribir; actor
revocado/inactivo/degradado/AAL1 se deniega, conservando conflicto raw legacy.
La aceptación cubre sólo esta familia y hashes; §9/Gate L consolidado, Data API,
Auth/HTTP alojado, Storage/restore, CI, hosting, correo y producción conservan
sus requisitos. No se tocó SQL, servicios alojados, commit ni push en esta
revisión. El coordinador puede publicar este corte por el flujo autorizado y
continuar la aceptación consolidada de gates.

---

# Revisión anterior — rechazo supersedido

Fecha: 19/10/2026. Revisor: GPT-6.1 Sol, revisión independiente.
**Dictamen: no aceptado todavía.** Se confirmó el defecto baseline y hay
evidencia verde útil, pero el paquete no satisface íntegramente el contrato.
No aplicar SQL014 ni declarar cerrado Gate L por este informe.

## Corte examinado

Baseline Git: `c12c43aaa8db002596bc04b5836d0de0af0d4f43`.
Contrato:
`M2-2C-LEGACY-RESPONSIBILITY-REPLAY-AUTHORIZATION-SOL-CONTRACT-20261019.md`,
SHA-256 `DC7FA9BEEE6491C48F5A39E33CD30E7C1360AFD560BBD144B0927F7A27685C6F`.

| Artefacto | SHA-256 examinado |
|---|---|
| SQL014 candidata checkout | `CDD909C1A280DF8E891D6062838B146AEECADCF5CBC0F52291C6D44A0C89ECA2` |
| SQL014 baseline blob conservado | `092B14200AD17D5FF5F96C5D6D748826366B395E3308082C5FEDAE40444EB4EA` |
| Runner rojo | `95F6609E6FE9C75E65A16A41BD622263AB4BB69928BD58204DA2606F994F1E7D` |
| Runner verde | `F7018BEAD7BE9BEB28DBBB8EC685BF28386F8AB513FE7A7DCFFA5F5C24381C33` |
| Manifiesto versionado | `7B04BDB07AFCC57ABE69F94A7D2D49C0C8ABA62BAEEFE1AA5FAD33CE5B38DE5E` |
| Reporte rojo final2 | `9A9C393D34DA2ECE8270967EF1ED9C0C514A35BD5CB7CE737C0599DBD1E02CA9` |
| Reporte verde completion-attempt5 | `C4C4274B197886759A4CE776C05A0BBD79DF9EEE5F64E6559948E4FC1B8A1FD2` |

Los reportes están bajo
`../../outputs/m2-2c-legacy-responsibility-replay-luna-20261019/`, relativo a
`work/site`. No confundir el SHA baseline Git con el checkout candidato.

## Hallazgos que impiden aceptación

### R1 — P2: las ocho carreras utilizan un footprint distinto del contrato

`tests/review/m2-2c-legacy-responsibility-replay.mjs:39` crea una tarea operativa
propiedad de M para generar el recibo kind conflictivo. Esa tarea y su compañía
se conservan al ejecutar las ocho carreras. En cada baseline examinado existe
la tarea de M `00000000-0000-0000-0000-000000092016`.

El contrato §6 requiere que revocar a M no altere ninguna tarea/asignación ni
sus revisiones: M es sólo encargado no participante y está fuera del footprint
de ejecución. En cambio el runner, línea96, exige que esa tarea operativa cambie
state_revision y agrega la fila completa al expected. Los ocho reportes muestran
`tasks` entre las colecciones modificadas. El campo descriptivo `allowedDelta`
ni siquiera enumera esa modificación admitida por el código.

Esto no prueba la carrera pactada con footprint vacío de M. Corregir sólo el
fixture: aislar el caso de kind conflictivo y las carreras por empresa/actores
apropiados, sin contaminar el ámbito revocado. Verificar antes de cada carrera
que M no figura como owner/participante/cobertura/sesiones/actividad del ámbito.
Volver a ejecutar las ocho carreras con el delta exacto original, sin ampliar
contrato ni relajar SQL.

### R2 — P2: secuencias obligatorias incompletas y conteo26 insuficiente

El reporte verde contiene26 steps, pero cuatro son preparación/acciones previas:
asignación inicial, pausa de reloj, revocación y restauración. No son26 replays
verdes distintos. El runner restaura membresía en línea69 e inmediatamente
inactiva M en línea70, sin probar el replay autorizado intermedio. Restaura
perfil/rol al acabar las denegaciones y comienza nuevos casos, sin replay del
recibo original después de esa restauración. Faltan las dos filas explícitas
de §5: membresía restaurada; perfil/rol restaurados. Las asignaciones nuevas
de las carreras no sustituyen el replay histórico solicitado.

El rojo tiene7 steps y prueba retorno indebido en RR, inactivo, degradado y
AAL1. Falta replay fresco revocado antes de restaurar y faltan sus controles
de conflicto por campo/kind requeridos en §3. El rojo demuestra el defecto,
pero aún no completa esa matriz contractual.

Agregar esos casos con baselines/snapshots completos y errores primarios
exactos. Guardar reproducciones rojas originales; generar nuevas evidencias
afectadas sin sobrescribirlas. El verificador del manifiesto actualmente sólo
comprueba algunos nombres y declara §5 completo aunque faltan restauraciones:
debe enumerar todas las filas requeridas y distinguir preparación de replay.

### R3 — P2: deltas permitidos se construyen con filas reales sin acotar campos

En el runner verde líneas94–95, expected recibe enteras las filas reales de
membresía, evento, auditoría, recibo y operation fence. Se comprueban algunos
campos, pero no la transformación completa que fija §6. Ejemplos: membresía
active/revision/changed_by sin exigir access_valid_from=null y sin conservar
los demás campos; evento sin exigir company/profile/revision exactos; auditoría
sin entity_id/details completos; operation fence sin actor/operation completos.
La comparación final de snapshots admite así cambios no autorizados en campos
que ya fueron copiados del resultado a expected.

Construir expected desde baseline modificando únicamente los campos permitidos;
para filas nuevas, afirmar identidad, claves/valores y timestamps válidos antes
de admitirlas. No basta comparar respuesta API con el recibo que reproduce esa
misma respuesta. Comprobar también el resultado y su alcance esperado. Capturar
sin filtros de autor y rechazar cualquier fila extra permanece correcto.

### R4 — P2: evidencia de validación/rutas no satisface la entrega reproducible

El manifiesto sólo registra cuatro comandos: rojo, verde, matriz nativa y suite.
Faltan referencias a prueba focal pertinente, TypeScript y builds cliente/Worker
con comandos, logs/exit codes y vínculo con esta candidata. Si existen logs
válidos del mismo producto, incorporarlos; si no existen, ejecutar los checks
requeridos. La revisión no sustituye builds con el hecho de que la suite pasa.

Además15 de las19 referencias `path+sha256` no resuelven desde `work/site`:
dicen `outputs/...` y en realidad están en `../../outputs/...`. Sólo fue posible
verificar sus hashes adoptando manualmente otra base no declarada. Corregir las
rutas o declarar inequívocamente base y semántica compatibles con §7. Incluir
logs de sintaxis/diff y exit-code files como artefactos verificables en la
regeneración; no sólo valores copiados de archivos sin ruta/hash.

## Evidencia válida conservada

- El diff SQL014 agrega31 líneas exclusivamente en la rama cached de
  assign_task_responsibility; la primera ejecución posterior permanece idéntica
  en el diff. SQL001–013 no cambian respecto del baseline. Se compararon los16
  archivos de migración: hashes checkout y blobs baseline coinciden con las
  columnas correspondientes del manifiesto.
- Los19 objetos con path+sha256 coinciden byte a byte al resolver la base real;
  no se detectó mismatch. Los runnerSha256 y candidateSql014Sha256 embebidos en
  reportes coinciden con los archivos examinados.
- Rojo utiliza el blob baseline exacto; recibo auténtico de asignación devuelve2
  antes/después de revocación RR y con perfil/rol/MFA inválidos. Por ello el
  defecto está reproducido, con las limitaciones R2 de cobertura.
- Verde acredita P0001 de argumentos raw, denegación de revocado/inactivo/
  degradado/AAL1, avance legítimo y cierre usando endpoint real, replay de jefe
  e inercia de las secuencias registradas.
- Los ocho pares/ganadores existen con aislamientos observados y blockers reales
  que contienen el PID ganador. En los cuatro revoke-first hubo40001 y rollback;
  sus snapshots coinciden con final al canonizar el orden de arrays. Los retries
  API devolvieron00000 y los retries M revocados P0001. Esto es evidencia útil
  del fixture actual, que R1 obliga a reemplazar para aceptar el contrato.
- Matriz nativa registrada:351/351, m2cSmoke=true, candidata SHA coincidente.
  Log de suite:74 archivos/738 pruebas aprobadas; exit-code0. No se volvieron
  a ejecutar esos procesos en esta revisión.

## Comprobaciones efectuadas por Sol

- `git diff --stat` y `git diff -- supabase/migrations/202610150014_operational_api.sql`:
  un archivo de producto,31 líneas añadidas; sin cambio en001–013.
- `git diff --name-only c12c43aaa8db002596bc04b5836d0de0af0d4f43 -- supabase/migrations`:
  únicamente014.
- Script Node inline con fs/crypto/git cat-file: recorre todos los objetos
  path+sha256 del manifiesto;19 referencias,0 mismatches,15 requieren base real
  ../../; compara16 hashes de checkout y16 blobs baseline; todos coinciden.
  Examina contexts/snapshots de ocho carreras; blockers8/8 y rollback/final4/4
  iguales tras ordenar objetos/arrays por contenido. Exit0.
- `node --check` de los tres runners nuevos: exit0.
- `git diff --check`: exit0, aviso no bloqueante de conversión LF/CRLF.

Existe también un archivo no rastreado `0`,98 bytes, que contiene una ruta de
exit-code de un intento anterior; es residuo de shell, no evidencia ni producto.
Debe excluirse de la entrega. No se modificó ni eliminó en esta revisión.

## Siguiente acción limitada

Luna corrige sólo runners/manifiesto/evidencia para R1–R4 y vuelve a Sol con
hashes nuevos. No se solicita cambiar SQL por estos hallazgos: la inspección
actual no identificó un defecto nuevo de producto en esa rama. Si aparece uno
durante la corrección, conservar reproducción y volver a arquitectura.
La suite/builds previos conservan alcance sólo si producto no cambia; repetir
pruebas afectadas por cambios de runner y completar validación faltante.

Sol no acepta este paquete hasta cerrar esos cuatro puntos. Gate L/§9 general,
Data API, Auth/HTTP alojado y los demás gates siguen abiertos. Esta revisión
no ejecutó servicios, migraciones ni llamadas alojadas, no alteró implementación
y no realizó commit/push.
