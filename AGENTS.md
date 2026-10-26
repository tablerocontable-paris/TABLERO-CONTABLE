# Estado actual de migración — actualizado 26/10/2026

Repositorio activo `work/site`, remoto privado
`tablerocontable-paris/TABLERO-CONTABLE`, rama `main`. El último commit de
producto `13132ec5df85856eae378ff8d05efa9397d7c398`, autor **Tablero Contable**,
pasó GitHub Actions run `40418925125` (suite, build cliente/Worker y paquete
Sites). El commit de continuidad `f62ee502bfd2270fe9d8784dfccb8bfec3bd2d1c`
quedó publicado directamente en `main`, sin PR ni reescritura; su run 98
(`40419944096`) seguía en `npm test` al corte. La suite local completa pasó
838/838, build cliente/Worker, paquete Sites y pre-commit 212/212.

## Continuidad portable y uso de subagentes

Usar subagentes cuando mejoren velocidad o calidad, en especial para revisión
independiente de cambios de seguridad; no delegar por rutina. Mantener un solo
subagente activo a la vez salvo que la tarea necesite paralelismo. Para este
proyecto, GPT-6.1 Sol define/revisa contratos y GPT-6 Luna implementa el contrato
aprobado cuando esos modelos estén disponibles.

GitHub conserva el código, historial Git, instrucciones del proyecto,
decisiones pertinentes, informes y evidencia técnica. No puede sincronizar la
memoria global de Codex ni el historial bruto de chats. Registrar en `docs/` las
decisiones útiles; nunca subir credenciales, sesiones de navegador ni datos
reales de clientes/personas. La preferencia de subagentes se anota aquí para que
viaje con `main`.

## Estado de Supabase DEV

Proyecto `grupo-paris-dev` (`kynqjfhqujnjojcmurwf`) activo. La lectura actual del
conector confirma 16 migraciones aplicadas: 001–014. SQL015 tiene aceptación Sol
previa. SQL016 corrige lectura de tareas de encargado tras revocar una
membresía; aceptación Sol para DEV condicionada al preflight, SHA-256
`F7E76313AD4132626034C5C9D38F1C70AFB140BB3E2CE3615FE89071945ED8F3`. Ninguna de
las dos migraciones 015/016 está aplicada. El orden es `apply_015`, verificar
éxito e historial de 17, luego `apply_016` con dry-run exclusivo de 016. Usar
únicamente `Supabase DEV migrations` en GitHub Actions con
`apply_migrations=true`; no pegar SQL ni elegir la línea base. La automatización
del navegador no pudo identificar de forma confiable la URL abierta, así que no
se inició el workflow desde la interfaz.

Antes de datos reales sigue pendiente verificar en Dashboard que Data API
exponga únicamente `api`, cotejar catálogo/ACL instalados y completar la matriz
de permisos en DEV. No habilitar el espacio operativo ni usar datos reales.

## Estado de despliegue y preservación

El mismo Site privado de laboratorio está en v98; la audiencia sigue owner-only.
La aceptación visual desde la PC personal no está confirmada. Cloudflare y
Gmail/correo todavía no están conectados. Supabase Auth operativo sigue
deshabilitado. El inventario neutral del primer ingreso está en
`docs/product/TASK-NORMALIZATION-DRAFT-20261026.md`; las capturas sólo permiten
contar filas visibles, no personal actual ni tareas completadas hoy.

Conservar los datos ficticios, Site privado e historias Git. No activar área
operativa ni invitar usuarios. Conservar el scratch no versionado
`tests/review/m2-2c-legacy-task-control-replay-races.block` sin leerlo, modificarlo,
stagearlo ni borrarlo.

Este bloque supersede los estados inferiores. Conservar los registros
históricos y no modificar el scratch `.block`.

<!-- Historial de continuidad -->

# Estado anterior — 23/10/2026, corte posterior a publicación

Repositorio activo `work/site`, remoto `tablerocontable-paris/TABLERO-CONTABLE`,
`main` en `22ac0ad404d6e12e69828edde7026e5f9f114de4`. Se preserva el Site privado.
GitHub Actions `39976297299` valida este SHA; el commit anterior pasó suite, build y paquete Sites.

Supabase `grupo-paris-dev` (`kynqjfhqujnjojcmurwf`) está activo y reconsultado
ahora: 0 migraciones y 0 tablas en `public`, `api` y `app_private`. SQL014
conserva el hash aprobado DEV `BC09CF9631A2F3E4BD19541C2A050AB1C663AE0E704D47D7E5A4752B114E0345`.
SQL015 tiene aceptación Sol para el hash LF
`CC49480D1317F1B44CD29F245508F9C8FB0B0894FE4E66C1B22F8E00D36B33F2`, limitada
a DEV. SQL015 todavía no se aplicó.

La siguiente puerta es el workflow manual `supabase-dev-preflight.yml` para
001–014, sin escrituras. Requiere `SUPABASE_DEV_DB_URL` guardada como secreto
Actions en GitHub; nunca compartir su valor por chat. Después se ejecutará el
preflight de destino/historial/dry-run, se aplicará y auditará 001–014; SQL015
se hará en una etapa separada.

El bootstrap optativo de Auth quedó publicado y aceptado por Sol; suite completa
787 pruebas en 80 archivos, TypeScript y builds cliente/Worker aprobaron. La
bandera remota permanece apagada y el bootstrap sólo muestra diagnóstico; no
conecta el tablero operativo. Cloudflare, correo, producción y aceptación desde
la PC personal siguen pendientes. Evidencia en
`docs/architecture/REMOTE-WORKSPACE-AUTH-BOOTSTRAP-IMPLEMENTATION-LUNA-20261023.md`.
Mantener datos ficticios, Site privado y el área operativa apagada.

El historial de continuidad anterior se conserva debajo como referencia. Si
contradice este estado actual, prevalece este bloque.

# Continuidad del proyecto — estado vigente, 21/10/2026

Repo activo: `work/site`; conservar este repositorio, historia Git y Site privado.
Sol aceptó Gate L para SQL014 SHA `218DEA9E...`. Luego se quitaron únicamente
los delimitadores `BEGIN`/`COMMIT` para preservar una sola transacción por archivo
al ejecutarlo con Supabase CLI. El candidato actual SHA-256
`BC09CF9631A2F3E4BD19541C2A050AB1C663AE0E704D47D7E5A4752B114E0345`.
La atomicidad del candidato se verificó con Supabase CLI 2.121.0 en PostgreSQL
17.11 descartable: el fallo tardío revirtió SQL014/historial y el retry exacto
pasó; evidencia en `docs/architecture/SUPABASE-DEV-CLI-TRANSACTION-LOCAL-PREFLIGHT-20261021.md`.
Sol aceptó el hash exacto BC09 para aplicarlo sólo en `grupo-paris-dev`, mediante
CLI 2.121.0 y `db push --skip-vault --yes`; esta aceptación no cubre producción,
usuarios reales ni activar el espacio operativo. La misma CLI reconoció las 16
migraciones de 12 dígitos y `db push --dry-run` no alteró una base local limpia.

Supabase `grupo-paris-dev` (`kynqjfhqujnjojcmurwf`) sigue vacío: 0 migraciones,
0 tablas en `public`/`api`/`app_private`; autoexposición de tablas nuevas apagada.
No aplicar migraciones alojadas hasta que el workflow de preflight confirme la
lista exacta y el dry-run contra el proyecto exacto; volver a verificar el estado
y destino antes de aplicar sólo en DEV.
Credenciales deben vivir en secretos de GitHub Actions, nunca en el repo/chat.
Luego aplicar sólo las 16 migraciones a DEV, auditar esquema/permisos/advisors y
seguir con Auth/API/Storage, frontend, CI, Cloudflare, correo y prueba en PC
personal. Producción intacta; datos ficticios; espacio operativo apagado.
# Continuidad vigente — A aceptada localmente, 21/10/2026

Sol aceptó la familia A de replays de ausencias en SQL014, limitada a
`approve_employee_absence` y `cancel_employee_absence`. Aceptación:
`docs/architecture/M2-2C-LEGACY-ABSENCE-REPLAY-SOL-ACCEPTANCE-20261021.md`.
Manifiesto SHA-256 `97A69B5539E69A5125F3DBD9A857171C6DACB4F7BBE595E39A20DAA99BD1E191`;
SQL014 SHA-256 `EF9BD767AA9A7FE83CD93B117E643F4B29DDC62345E8DD0687E2E2F598D04B95`.
Rojo 50; verde 52, 2 stale-RR y 8 carreras reales; matriz PostgreSQL 376/376
baseline y candidata; suite 738/738; TypeScript/builds/checks aprobados. SQL001–013
intactas. No se aplicó SQL remoto.

T, C y A quedan aceptadas localmente; A aún debe publicarse en el commit directo
a `origin/main`, sin PR, con continuidad actualizada. Después GPT-6.1 Sol debe
resolver P y completar el cruce residual §9/Gate L. Sólo con Gate L aceptado se
retoma la migración Supabase dev y luego Auth/API/Storage, frontend, hosting,
correo y validación desde la PC personal. Sitio privado, datos ficticios,
espacio operativo apagado. No aplicar SQL014 ni activar servicios alojados antes
de Gate L.

Esta cabecera supersede estados y próximos pasos históricos debajo. Conservar
el proyecto, la historia Git y el scratch `.block`.
# Continuidad vigente — C aceptada localmente, 20/10/2026

GPT-6.1 Sol aceptó localmente, en alcance acotado, los replays legacy de
`approve_task_coverage_plan` y `cancel_task_coverage_binding`. Aceptación:
`docs/architecture/M2-2C-LEGACY-COVERAGE-REPLAY-SOL-ACCEPTANCE-20261020.md`
(SHA-256 `64A2B9D3F9024E307FC21DCBEB38B810208B551C8DA2BE8DFEB6CE094FD8F8A1`).
Contrato SHA `9F44C0DAE1C2C3B339CAD7271EE3AD2C80B1E1700711E46692EA15F0929D53C8`;
SQL014 candidata SHA `CE85FFB750443CB54CC25DD55AE25831CCFE71D8A10EA143D54C34855009447D`.
Manifiesto repo/canónico SHA `2B00185B57E55D1B9E74C806363A83DFE03309B4C560519BB2F3A868E855FD18`.
Evidencia: 10 rojos, 28 verdes, ocho carreras con ambos ganadores y blockers
reales, 56 snapshots completos, 351/351 matriz nativa y 738/738 en 74 archivos;
TypeScript/builds cliente y Worker con exit 0. SQL014 no se aplicó remotamente.

El corte C está aceptado, pendiente de documentar/publicar junto con T en el
commit directo a `origin/main`, sin PR. Próximo paso: GPT-6.1 Sol define el
contrato A (replays de aprobación/cancelación de ausencias); luego GPT-6 Luna
implementa y Sol acepta. Después queda P, el cruce §9/Gate L y la migración
alojada. Mantener Site privado, datos ficticios y espacio operativo apagado.
No iniciar escrituras remotas todavía.

Esta cabecera supersede los próximos pasos históricos que siguen.

# Continuidad vigente — controles legacy de tarea aceptados localmente, 20/10/2026

GPT-6.1 Sol aceptó en alcance local acotado la familia T de replays de controles
legacy de tarea. Aceptación `docs/architecture/M2-2C-LEGACY-TASK-CONTROL-REPLAY-SOL-ACCEPTANCE-20261020.md`
(SHA-256 `638EA12EF904AC9F72873854F15AAFAABFD17DEF7B2E0D892B7F11F3636C4B7B`);
contrato en `docs/architecture/M2-2C-LEGACY-TASK-CONTROL-REPLAY-AUTHORIZATION-SOL-CONTRACT-20261020.md`.
SQL014 candidata SHA-256 `19EC849B0397602B7DC03939539D37F0999FE808FD21A91B227E7767F4BF9FC3`.
Evidencia: 4 rojos, 4 verdes, 8 carreras con blockers, 162 comparaciones de
inercia, 352 snapshots; matriz 351/351, suite 738/738, TSC y builds cliente/
Worker exit 0. Manifiesto de 79 artefactos con hashes verificados. SQL001–013
intactas. Sol excluyó intentos históricos y scratch `.block` de la aceptación.

Este bloque está aceptado localmente y pendiente de commit/push directo a
`origin/main`, sin PR. SQL014 no se aplicó a Supabase. El próximo paso es que
GPT-6.1 Sol acote la unidad C/A/P siguiente desde el inventario residual en
`docs/architecture/M2-2C-SECTION9-RESIDUAL-AUDIT-SOL-20261020.md`; después
GPT-6 Luna implementa el contrato aprobado. Gate L, Data API, Auth/HTTP,
Storage/restauración, CI, hosting, correo y producción siguen abiertos. No
activar el espacio operativo ni usar datos reales.

Esta cabecera supersede los próximos pasos históricos que siguen.

# Continuidad vigente — replay de responsabilidad aceptado localmente, 20/10/2026

GPT-6.1 Sol aceptó en alcance local acotado el replay de
`public.assign_task_responsibility`. Contrato:
`docs/architecture/M2-2C-LEGACY-RESPONSIBILITY-REPLAY-AUTHORIZATION-SOL-CONTRACT-20261019.md`;
aceptación: `docs/architecture/M2-2C-LEGACY-RESPONSIBILITY-REPLAY-SOL-ACCEPTANCE-20261019.md`
(SHA-256 `233ADBE22F7DFB2BE135D6AAE08E232530688D291D07BB05EAE8B7964AFB018E`).
SQL014 candidata checkout SHA-256 `CDD909C1A280DF8E891D6062838B146AEECADCF5CBC0F52291C6D44A0C89ECA2`;
baseline Git exacta `092B14200AD17D5FF5F96C5D6D748826366B395E3308082C5FEDAE40444EB4EA`.
Rojo confirmado; verde 28 casos secuenciales y 8/8 carreras con M fuera del
ámbito de tareas; matriz nativa 351/351 y suite 738/738. TSC, builds cliente y
Worker, sintaxis y diff-check terminaron con exit 0. Manifiesto versionado SHA
`478157350FC4ED3561EE5DF6BD940E0B79E20D339E8D6861F16B3B1182E71C1F`; 33/33
referencias verificadas. SQL001–013 intactas. Límite P3 de metadatos AAL1 está
descripto en la aceptación.

Este bloque quedó aceptado y publicado directamente a `origin/main`, sin PR,
en `53f37f09d04e871bbc15ae88c8b8362472753a95`; el SHA remoto fue confirmado.
SQL014 no se aplicó a Supabase. GPT-6.1 Sol audita ahora el inventario residual
§9 y define la próxima unidad acotada.
Gate L, Auth/HTTP, Data API, Storage/restore, CI, hosting, correo y producción
siguen abiertos. No activar el espacio operativo ni usar datos reales.

Esta cabecera supersede el estado anterior de movimientos. El historial
siguiente se conserva como evidencia; sus instrucciones previas de próximo paso
quedan supersedidas.
# Continuidad vigente — replay legacy de cronómetro aceptado, 19/10/2026

Sol aceptó en alcance local limitado la reautorización del replay legacy de
`public.start_task_timer`. Contrato `docs/architecture/M2-2C-LEGACY-TIMER-REPLAY-AUTHORIZATION-SOL-CONTRACT-20261019.md`
(SHA-256 `A006EC42F26C08992C8F0CA2BF149359D937D6B15CF639D4FF67E5FDEE489A5F`);
aceptación `docs/architecture/M2-2C-LEGACY-TIMER-REPLAY-AUTHORIZATION-SOL-ACCEPTANCE-20261019.md`.
SQL014 candidato SHA `C6A4ACDD92653DFFE9A0576EC3D8FBC906B2562E3BFAC056B8561981A4203EC8`.
Reproducción roja con SQL014 baseline exacta de `f23c42529a0c55dd0f3596d765a30d5b6c9c54c5`;
23 eventos verdes y ocho carreras con blockers; matriz nativa con smoke flags
351/351 en baseline y candidata; suite 738/738 en 74 archivos, TSC/builds/
sintaxis/diff-check exit 0. Manifiesto `docs/architecture/review-evidence/m2-2c-legacy-timer-replay-auth-luna-20261019-manifest.json`
(SHA-256 `BDD92D3416A9A27C1EBFE82E3645AD82318BCFB3A1A3CAD66F8321A943771859`).
SQL011–013 no cambiaron. SQL014 sigue sin aplicar en Supabase.

El proyecto Supabase `grupo-paris-dev` (`kynqjfhqujnjojcmurwf`) fue consultado
en modo lectura: activo, sin migraciones ni tablas en `public`, `api` o
`app_private`. La configuración Data API no fue verificada en esta consulta.
No aplicar SQL014 ni iniciar Gate H hasta cerrar Gate L y sus requisitos de
exposición. Los replays legacy de `record_activity_once` y
`assign_task_responsibility`, §9/Gate L, Auth/HTTP, Data API, Storage/restore,
hosting, correo, CI y producción siguen pendientes.

**Próximo paso:** GPT-6.1 Sol audita el inventario de §9 tras esta aceptación y
elige la siguiente familia legacy pendiente sin repetir matrices aceptadas;
luego GPT-6 Luna implementa ese contrato acotado.

## Bloque anterior — OneOff local, 19/10/2026

Runner/evidencia de la matriz OneOff aceptados por Sol en alcance limitado y ejecutados localmente contra
`docs/architecture/M2-2C-ONEOFF-CREATE-MEMBERSHIP-REVOCATION-RACES-SOL-CONTRACT-20261019.md` (SHA-256 contrato `98C9B35ACA1D66C4931644B4E5E2CCF9EFD654D02426B0351E2E5AA7FFA033C4`).
PostgreSQL 17.11: 333/333, cuatro carreras create-first/revoke-first RC/RC y RR/RR; cero deadlocks. En baseline, winner-only, after-rollback y final se capturan/assertan sesiones y efectos laterales cero; reportes, entregas y outbox se limitan por org y owners E/R; month fences cubren todos los períodos de E/R, y las filas de operación se comparan exactamente por comando. Suite 738/738 en 74 archivos; TypeScript, build cliente, Worker, sintaxis y diff-check exit 0.
Runner SHA-256: `fbf8e3a86caaecb825561e654795c01b8f065b3774bee6594d0a5e24290547b7`; reporte SHA-256: `21398735b5470bf3957c3a82d8ad7b22511e8603609b1e0199724c9e33747401`. Manifiesto: `docs/architecture/review-evidence/m2-2c-oneoff-create-membership-revocation-races-luna-20261019.json`; logs nativos en `../outputs/m2-2c-oneoff-create-membership-revocation-races-luna-20261019-attempt11/`. Aceptación: `docs/architecture/M2-2C-ONEOFF-CREATE-MEMBERSHIP-REVOCATION-RACES-SOL-ACCEPTANCE-20261019.md`. Esto no cierra Gate L/§9. SQL011/014 y producto sin cambios. No aplicar SQL014 ni iniciar preflight alojado.

Esta cabecera tiene precedencia. Los registros cronológicos siguientes
conservan evidencia histórica; sus instrucciones anteriores de próximo paso
quedan supersedidas. Las reglas permanentes de seguridad, datos y flujo siguen
vigentes.
Las matrices de assignment.create, timer y operation.record ya aceptadas no
se deben volver a implementar por una instrucción histórica. El contrato
OneOff sólo autoriza su matriz local sintética.
No aplicar SQL014 ni iniciar preflight alojado por este documento.

## Antecedentes y evidencia histórica

**Último bloque local aceptado por Sol, alcance acotado:** cuatro carreras `assignment.create` vs `companyMembership.setActive(false)`, RC/RC y RR/RR en ambos órdenes. PostgreSQL nativo 17.11: 329/329, cuatro bloqueos reales, cero deadlocks; outcomes por contrato exactos. Suite completa: 738/738 en 74 archivos; TypeScript, builds cliente/Worker, `node --check` y `git diff --check` exit 0. El fallo anterior 737/738 no se reprodujo en el caso enfocado sobre baseline limpio, ni en la suite completa posterior. Sin cambios SQL ni llamadas remotas. Manifiesto versionado: `docs/architecture/review-evidence/m2-2c-assignment-create-membership-revocation-races-luna-20261019.json`; runner, reportes y logs en `../../outputs/m2-2c-assignment-create-membership-revocation-races-luna-20261019-attempt9/`. Aceptación registrada en `docs/architecture/M2-2C-ASSIGNMENT-CREATE-MEMBERSHIP-REVOCATION-RACES-SOL-ACCEPTANCE-20261019.md`. Sin aplicar SQL014; Gate L/§9 siguen abiertos.

# Estado operativo y precedencia — actualización 19/10/2026

**Último bloque local aceptado por Sol, alcance acotado:** cuatro carreras entre
`assign_task_responsibility` y `onboarding.approve`, ambos órdenes bajo RC/RC y
RR/RR. PostgreSQL 17.11: 313/313, cero fallos/deadlocks; cuatro bloqueos reales,
resultados/replays exactos y estados finales sin duplicados. Suite 738/738;
TypeScript, builds cliente/Worker, `node --check` y diff-check con exit 0. SQL011,
013 y 014 sin cambios. Aceptación y límites:
`docs/architecture/M2-2C-RESPONSIBILITY-ONBOARDING-APPROVAL-RACES-SOL-ACCEPTANCE-20261019.md`;
manifiesto `docs/architecture/review-evidence/m2-2c-responsibility-onboarding-approval-races-luna-20261019.json`.
La rama RC aprobación-primero confirma responsabilidad `00000` porque actualiza
una tarea distinta; el replay exacto prueba idempotencia. Gate L y §9 siguen
abiertos. No aplicar SQL014.
Publicado directo a `origin/main`, sin PR: `5425d99589f5edfcca1b2224753a0c5c1d2c1332`;
`git ls-remote` confirmó el mismo SHA. El hook local reportó 196/196, aunque el
proceso `git commit` terminó con código 1 después de crear el commit y dejar el
árbol limpio. CI del push no está verificado.

**Bloque más reciente aceptado por Sol y publicado:** cuatro carreras de
`cancel_task_coverage_binding` frente a `onboarding.approve`, ambos órdenes
RC/RC y RR/RR. PostgreSQL 17.11 317/317, cero fallos/deadlocks; suite 738/738,
builds y comprobaciones con exit 0. Aceptación y límites P3:
`docs/architecture/M2-2C-COVERAGE-CANCEL-ONBOARDING-APPROVAL-RACES-SOL-ACCEPTANCE-20261019.md`;
manifiesto `docs/architecture/review-evidence/m2-2c-coverage-cancel-onboarding-approval-races-luna-20261019.json`.
Gate L/§9 siguen abiertos; SQL014 no se aplicó.
Commit directo a `origin/main`, sin PR: `4c598f575d1465ba3218af4b2da6ef3bca93aed4`;
SHA remoto confirmado. CI del push no está verificado.

## Base previamente aceptada

**Último bloque local aceptado por GPT-6.1 Sol (alcance acotado):** cuatro
carreras adicionales entre aprobación de cobertura recurrente y revocación de
membresía, RC/RC y RR/RR con ambos ganadores. PostgreSQL 17.11: 301/301;
`40P01=0`; suite 738/738 en 74 archivos; TypeScript, build cliente/Worker,
sintaxis del runner y diff-check aprobados. Evidencia:
`docs/architecture/review-evidence/m2-2c-recurrent-same-isolation-luna-20261019.json`.
Sol acepta sólo esos cuatro casos. Sus límites P3 están en el manifiesto; Gate L
y §9 siguen abiertos. Código/evidencia: `660f75dcc9a9d4a5ab698e84d3ff0ae23a0f2068`;
contrato y estado actual: `8646f10ee90371748054830ef4af81cf4904f577`. Ambos están en
`origin/main`, sin PR. GitHub devolvió una lista de checks vacía para el último
SHA; no hay CI verificado en esta sesión. El hook local pasó 196/196. SQL014 no
se aplicó remotamente.

**Último bloque aceptado por Sol y publicado, alcance acotado:** cuatro carreras
`public.start_task_timer` frente a revocación, RC/RC y RR/RR, ambos órdenes.
PostgreSQL 17.11 325/325, cuatro blockers, cero deadlocks; Vitest 738/738,
TypeScript, builds cliente/Worker, sintaxis y diff-check aprobados. Aceptación:
`docs/architecture/M2-2C-TIMER-START-MEMBERSHIP-REVOCATION-RACES-SOL-ACCEPTANCE-20261019.md`;
manifiesto `docs/architecture/review-evidence/m2-2c-timer-start-membership-revocation-races-luna-20261019.json`.
SQL011/014 sin cambios; no hubo llamadas remotas. Commit directo a `origin/main`,
sin PR: `0ff1df0eebc1237d60b08fed6450f6f21f401006`; SHA remoto confirmado. CI no
está verificado.

**Bloque aceptado anterior, publicado:** cuatro carreras
`operation.record` frente a revocación de membresía, RC/RC y RR/RR, ambos órdenes.
PostgreSQL 17.11 321/321, cuatro blockers reales, cero deadlocks; Vitest 738/738,
TypeScript, builds cliente/Worker, sintaxis y diff-check aprobados. Aceptación:
`docs/architecture/M2-2C-OPERATION-RECORD-MEMBERSHIP-REVOCATION-RACES-SOL-ACCEPTANCE-20261019.md`;
manifiesto `docs/architecture/review-evidence/m2-2c-operation-record-membership-revocation-races-luna-20261019.json`.
Runner `756295076e72cb35981d5ae30ac282bf5b508846c822b3cc4cf14b5032643ea9`;
SQL011/014 sin cambios. Logs locales en
`../../outputs/m2-2c-operation-record-membership-revocation-races-luna-20261019-final4/`.
No se hicieron llamadas remotas ni se activó el espacio operativo. Gate L y §9
siguen abiertos. Commit directo a `origin/main`, sin PR:
`cf37b7fe220befa5317e4ae3295514288e96ff6e`; `git ls-remote` confirmó el SHA.
CI del push no está verificado.

**Bloque completado:** assignment.create/revocación quedó aceptado en alcance
acotado y registrado en la cabecera; ya no es una instrucción de implementación.

**Bloques anteriores aceptados y publicados:** onboarding.requestChanges exact replay/commandReceipt y cuatro carreras mixtas de cobertura recurrente (RC/RR, RR/RC, ambos ganadores). Evidencias: `docs/architecture/review-evidence/m2-2c-onboarding-requestchanges-replay-20261018.json` y `m2-2c-gatel-recurrent-coverage-20261019.json`. El run 39184344731 corresponde al commit 873829271463b4f3bf4bbb5ad39dad978908a8d2. Gate L sigue abierto.

**Validación previa:** requestChanges y las carreras mixtas pasaron en los alcances documentados. Esto no cierra Gate L. No aplicar SQL014; Supabase dev sigue vacío y queda su configuración Data API/preflight.

El corte `onboarding.approve` publicado como `ad64854091505a2770cb93478fc34467e2aeae05` tiene Actions `39181886848` en success; esto no acredita el siguiente commit. Mantener separado SQL014 del Worker/D1. El resto del historial de este archivo conserva su valor histórico.

# Checkpoint histórico supersedido — 19/10/2026

Este bloque conserva evidencia anterior; no define la acción vigente. GitHub privado
`tablerocontable-paris/TABLERO-CONTABLE` tiene publicado en `main` el corte
funcional `5803b1e4434cfc46a4ab64a26da3f76ab9d12d3d`, seguido de sincronización
documental directa. El push está confirmado, pero el conector disponible no
permite verificar los runs de Actions para eventos push.
El único Supabase es `grupo-paris-dev`, activo y vacío. La última lectura del
Dashboard mostró `public, extensions` expuestos y autoexposición activada; el
usuario ya autorizó apagarla, pero aún no se modificó. No aplicar SQL014 hasta
cerrar ese ajuste y completar Gate L. Sol aceptó el alcance local R7 de
`task.createOneOff commandReceipt` y, en esta sesión, la corrección acotada de
`assignment.create` exact replay tras revocación. La validación de este último
corte fue suite 735/735, PostgreSQL 17.11 144/144 (`40P01=0`), TypeScript y
builds cliente/Worker. Esto no cierra M2.2C/Gate L. No hay hosting Cloudflare
propio, correo transaccional ni Supabase de producción configurados. Mantener
datos ficticios y el Site privado; no abrir el espacio operativo.

El estado detallado fechado 17/10/2026 que sigue es histórico donde contradice
este checkpoint; conservarlo sólo como registro de decisiones/evidencia.

La cuenta y el repositorio GitHub privados ya están creados. El repositorio
`tablerocontable-paris/TABLERO-CONTABLE` usa `main` como rama única y flujo de
push directo; no abrir PR ni recrear `dev` sin nueva decisión del usuario. La
importación inicial es `8a10c6c19c1a619d3a621ea25af30e15f503cae0`, atribuida a
Tablero Contable y con el árbol actual del laboratorio. El workflow valida
pushes a `main`. La PR de bootstrap está cerrada y no se integró.

La conexión a Supabase/hosting no autoriza desplegar producción ni datos reales.
Precedencia vigente 17/10/2026: M2.2A-R7/R8 y M2.2B fueron aceptadas localmente
por Sol. Sol aceptó únicamente los escenarios R90 enumerados para SQL014
(checkout `3ff379002c37c43fb8c91d2b41bd47658d73d0386b2c5bc1518f22c6b4cc86c6`,
blob Git LF `7c96727b7f1ecd8c5bb2b457640b824deddc06346da3f1a70e9bdb879e730a56`)
y runner `7c48420ee61498418642ddbd2b734dc5b7d094eabed923417a2bfebf03059588`;
R90 regeneró el reporte (PostgreSQL 17.11, **128/128**, `40P01=0`). El reporte acredita las filas
6, 8, 11 y 12 en el alcance local revisado, incluida la revocación de lectura
SQL009 para encargados y conflictos/rollback/reintentos bajo RC/RR. La matriz
usa JWT sintéticos; no acredita Auth/HTTP alojado ni presencia de datos reales.
Suite 727/727 en 74 archivos, TypeScript, build cliente y Worker pasaron sobre
este corte. Esta aceptación acotada no cierra M2.2C ni Gate L completos: quedan
familias API/legacy writer, concurrencia e inyección de fallos del contrato §9.
El fix local posterior de replay `onboarding.submit` fue aceptado por Sol sólo
para los casos enumerados (SQL014 SHA256 de checkout
`13e88c8549f969187294367161c3ce6cf458d7f4618ddba40cb5058254982a26`; contenido
normalizado LF `b593618d1fcc11fe0be5e6678574faba8a013e4ac587e303d7f00d49dbe05e49`;
PostgreSQL 17.11 130/130, `40P01=0`). Está en el commit local vigente; el remoto `main` permanece en
`8cf5e8a3e6969cfe02d77c595698c5f60ddfa8f5`. Falta la revisión Sol del commit
exacto antes del push directo; no abrir PR. Continuar Gate L local. 014 sigue sin aplicar. No tocar Supabase remoto
hasta realizar y verificar el gate de exposición Data API. Producción,
Cloudflare y correo productivo siguen aparte.

# Precedencia histórica M2.2A-R7/R8 — revisión local, 15/10/2026

R7/R8 están corregidos en la migración local 014 y el runner nativo. Evidencia
vigente `docs/architecture/review-evidence/m2-2a-r7r8-implementation-20261015.json`.
El candidato actual de B registra 67/67 casos por par en PostgreSQL17.11
(RC/RC, RC/RR, RR/RC, RR/RR), incluyendo timers y transiciones legacy RR
stale→cierre con abort `40001`, retries cerrados sin filas parciales, y fence
API `task.transition` incrementado exactamente una vez; `40P01=0`. Suite
716/716 en73 archivos, focal
44/44, TypeScript, builds cliente/Worker, sintaxis y diff-check aprobados.
Esta nota es histórica para B y queda superada por el bloque operativo vigente
de C al inicio de AGENTS.md. Evidencia B:
`docs/architecture/review-evidence/m2-2b-sol-review-corrections-20261016.json`.

> **Precedencia M2.2A — revisión R6 finalizada, 15/10/2026.** R6 original resuelto (30/30); candidato `ebe1633` aún NO aceptado por R7/R8 P2: valores de revisión/cursores validados después de locks y helper de claves que acepta un conjunto esperado con NULL. Sonda nueva 8/18, nativa 3/6, con estado sin cambios; los fallos son evidencia deliberada. Se corrigió la evidencia mixta previa: sus opciones erróneas produjeron RC/RC; nuevas ejecuciones reales RC/RR y RR/RC pasan 43/43 cada una. Focales17/17, protocolo15/15 y TypeScript pasan. Producto SQL/DTO/UI/Worker sin cambios en la revisión; suite712/builds son del mismo producto anterior. Siguiente **GPT‑6 Luna medio Standard** ejecuta `docs/architecture/M2-2A-PREFLIGHT-LUNA-20261015.md`; después Sol alto acepta A y define B/C. Informe/evidencia `M2-2A-R6-SOL-REVIEW-20261015.md` / `review-evidence/m2-2a-r6-sol-review-20261015.json`. No desplegar014, iniciar B/C ni conectar cuentas en este corte. Avance ~45% histórico.

> **Precedencia M2.2A-R6 — candidato local empaquetado y verificado, 15/10/2026.** Corrección NULL-safe implementada en 014. R6 30/30, sonda independiente 9/9, pruebas previas 15/15, matrices PostgreSQL 17.11: 61/61 RC/RC, 61/61 RR/RR, 43/43 RC/RR, 43/43 RR/RC; focales 17/17; suite 712/712; TypeScript y builds cliente/Worker aprobados. Los commits `08b7405` (código) y `de38b3d` (evidencia) pasaron cada uno el hook 196/196. Bundle/ZIP de `de38b3d` verificado desde clonación limpia en `outputs/m2-2a-r6-candidate-delivery-20261015`. Próximo: GPT‑6.1 Sol, esfuerzo alto, revisión independiente del candidato. No iniciar B/C, desplegar 014 ni conectar cuentas. Evidencia `docs/architecture/review-evidence/m2-2a-r6-implementation-20261015.json`; avance ~45% histórico sin recalcular.

> PRECEDENCIA M2.2A — revisión independiente 15/10/2026: candidato 9c096973/4597e74 NO aceptado. M22A-R6 P1 confirmado en PostgreSQL17.11: expectedRevisions vacío evita la precondición y escribe movimiento/recibo/revisión. Sonda nueva3/9; matriz RR61/61 y sondas previas15/15 siguen verdes. Siguiente GPT‑6 Luna medio Standard ejecuta docs/architecture/M2-2A-NULL-SAFETY-LUNA-20261015.md; después Sol alto revisa. No iniciar B/C, desplegar014 ni conectar cuentas en este corte. Producto SQL/DTO intacto durante la revisión; los bundles anteriores son candidatos con defecto conocido. ~45% histórico sin recalcular. Esta nota reemplaza la acción del candidato anterior.

> PRECEDENCIA M2.2A — candidato local creado en 9c096973; matriz concurrente validada y bundle portátil clonado en limpio. Aceptación independiente de Sol pendiente (15/10/2026). PostgreSQL17.11: 61/61 RC/RC y 61/61 RR/RR; replay/revocación 43/43 en RC/RR y 43/43 en RR/RC; PGlite15/15, suite712/712, TypeScript, builds cliente/Worker y hook pre-commit196/196 pasan. Evidencia: docs/architecture/review-evidence/m2-2a-corrections-validation-20261015.json. Siguiente: GPT‑6.1 Sol alto revisa el candidato y define B/C. Conservar001–013/UI/Worker/Site. No desplegar014 ni conectar cuentas en este corte. ~45% histórico sin recalcular.

> PRECEDENCIA M2 — 15/10/2026: M2.1/013 aceptado localmente tras revisión independiente (PostgreSQL42/42, focales27/27, TypeScript; producto coincide con suite690/builds del14/10). Ver docs/architecture/M2-1-SOL-ACCEPTANCE-20261015.md. El contrato original A se completa con las correcciones de la nota vigente anterior. M2.2 se divide A/B/C; sólo A tiene contrato ejecutable. No desplegar014 incompleto ni iniciar015/M2.3 antes de aceptar M2.2 completo. Supabase alojado/Auth/cuentas siguen pendientes; ~45% es estimación histórica.

> PRECEDENCIA VIGENTE 14/10/2026: el usuario autorizo iniciar infraestructura propia y continuidad PC; GitHub sera cuenta NUEVA, no usar conexiones anteriores. Seguir docs/ops/MIGRATION-BOOTSTRAP-20261014.md. M0 Sol prepara inventario/respaldo; M1 Luna medio Standard consolida Git/paquete. Se permite iniciar cuentas/dev aunque siga pendiente lector humano; produccion, datos reales e invitaciones conservan gates. No activar D1/Sites como adaptador Supabase. Esta nota reemplaza las prohibiciones historicas de iniciar cuentas para este alcance.

# Grupo París

- Trabajar exclusivamente en este proyecto nuevo. El repositorio y los servicios legacy son referencias de lectura.
- No subir secretos ni cargar datos productivos en la demostración. No confundir Sites privado con autenticación/RLS de la app.
- Mantener identidad empresa/asignación/período, snapshot de pesos y cierre íntegro por empleado.
- Esquema remoto sólo en supabase/migrations; una migración aplicada no se edita. No aplicar SQL remoto sin seleccionar explícitamente el proyecto nuevo.
- Verificar npm test y npm run build antes de publicar; guardar el código exacto en Git y desplegar su build. Mantener la audiencia privada.
- No declarar lista la migración de empleados hasta verificar Auth, invitaciones, MFA, RLS e integración contra Supabase real.
- Automatización objetivo de Git/dev/prod, pre-commit y entrega: seguir `docs/ops/AUTOMATED-DELIVERY.md`; esa infraestructura aún no existe.

## Decisiones posteriores del usuario

- Continuar en Sites hasta validar el producto. Sólo entonces crear GitHub, Supabase y hosting nuevos con cuenta dedicada propuesta tablerocontable@gmail.com. No crear esos recursos ahora.
- Juan Pablo es gerente y administrador de usuarios/parámetros. Valentino es empleado y tendrá una cuenta técnica separada del trabajo/KPI.
- No restablecer las decisiones legacy que descartaban cronómetro: el pedido actual lo requiere. Pruebas de escritura exclusivamente en laboratorio aislado; diagnóstico real autorizado y auditado.
- Respetar reglas y pendientes en docs/PRODUCT-ROADMAP.md. No conectar frontend 0.4 a contrato SQL 0.3 sin adaptar y probar.
- Integrar pedidos nuevos según docs/product/CONSISTENCY-RULES.md: registrar cruces con reglas existentes y comprobar los criterios acordados. Implementado y pruebas verdes no significan aceptación completa. Mantener AGENTS/EXECUTION-NEXT/PROJECT-STATUS alineados; los documentos cronológicos conservan evidencia histórica.
- Pedidos vigentes 02/10: `docs/product/CORRECTIONS-20261002.md`. Equipos jerárquicos multiarea; tablero personal por defecto; coincidencias de tareas se proponen y Juan Pablo confirma; agenda ligada explícitamente a cumplimiento. Tareas conjuntas/coberturas conservan identidad única y contribuciones sin doble KPI. Comentarios privados requieren datos/políticas separados, no ocultamiento visual.

## Modelos y devolución de cada ejecución (pedido 01/10/2026)

- Planificación habitual y revisión acotada: **GPT-6.1 Sol**, esfuerzo medio. Arquitectura, permisos, migraciones y fallos complejos: esfuerzo alto.
- Ejecución de instrucciones ya definidas: **GPT-6 Luna**, esfuerzo medio; bajo sólo para cambios simples. Si aparece una decisión nueva o un problema complejo, volver a Sol antes de ejecutar otra solución.
- Preferir velocidad Standard; no activar Fast para ahorrar cupo. Política, fuentes y límites del plan Plus: `docs/WORKFLOW-MODELS.md` (actualizada por pedido del usuario).
- Al terminar cada ejecución: revisar alcance, cambios, comprobaciones y pendientes. En cada devolución final indicar el modelo recomendado para el próximo paso y su propósito.
- Si el entorno permite seleccionar el modelo, respetar esta separación. Si no permite cambiarlo, decirlo brevemente y recomendar el modelo que el usuario debe seleccionar. Nunca afirmar que se usó un modelo sin verificarlo ni prometer ahorro medido sin evidencia.
- Esta regla se aplica también después de reinicios/compacción de contexto. Mantener instrucciones ejecutables concretas para Luna, con criterios de aceptación y sin decisiones arquitectónicas abiertas.

## Continuidad sin interrupciones — pedido 01/10/2026

- Continuar autónomamente entre pasos/revisiones que usan el mismo modelo; no terminar cada bloque para pedir «continuar».
- Detenerse al llegar a un cambio de modelo necesario y comunicar modelo, esfuerzo y contrato concreto preparado. El usuario hará el cambio manual. No delegar ni simular un cambio de modelo para sortear esta preferencia.
- Completar una fase entera del mismo modelo (corrección, implementación y verificaciones necesarias); no fraccionarla para pedir continuar después de una subtarea. Pedido de sesiones más largas del 06/10/2026. Detenerse sólo por cambio necesario de modelo o bloqueo concreto.
- B1/009 y B2a/010 conservados. SQL 011 completado localmente en 65e8391; prepare/acquire/revalidate, reportes v4, cobertura precisa y cancelación. Evidencia: docs/architecture/COORDINATION-011-CONTINUATION-20261006.md. Revisar Sol alto antes de adaptar esta ruta al backend activo D1; no aplicar SQL remoto.
- Se preservaron SQL 001–010 y evidencia histórica. PostgreSQL 17.11: 26/26 escenarios concurrentes aprobados; servicios Supabase/Auth reales no probados. D1 usa sus propios contratos y migraciones.

## Pedido vigente06/10: versión privada utilizable en Sites

- Este pedido sustituye la ejecución aislada de011 y la prohibición anterior de cambiar App o publicar. Continuar el recorrido diario, datos compartidos y despliegue privado del mismo Site.
- La aplicación publicada1.0 usa Worker+D1 de Sites con identidad real del dispatcher. Los contratos Supabase históricos permanecen intactos/no aplicados y no se confunden con el backend activo.
- No volver a localStorage ni al selector que suplanta usuarios. Propietario: administración técnica/e0 solamente; empleado ordinario: identidad fija. Roles, empresas, notas y cierres se validan en servidor.
- Preservar audiencia sólo propietario. Configurar perfiles no autoriza invitaciones ni cambios de visibilidad.
- Ver docs/PROJECT-STATUS.md, docs/EXECUTION-NEXT.md y docs/runbooks/SITES-PRIVATE-1.md, que son el estado vigente; cronología anterior es evidencia histórica.
- Pruebas automatizadas/DOM y SQLite no equivalen a QA visual ni piloto real. No declarar listas secundarias o migración masiva que no se hayan ejecutado.


## Integración de continuidad local — 06/10/2026

Se recuperaron los commits originales cf6fc23/2c60379/54117ea y se completó
SQL 011 en 65e8391. Evidencia: docs/architecture/COORDINATION-011-CONTINUATION-20261006.md.
Antes de integrar este backend D1: 300 pruebas aprobadas y 26 carreras PostgreSQL
aprobadas. El backend D1 recibido del remoto se conserva como ruta activa separada;
SQL Supabase no se aplica ni se conecta automáticamente a esa UI.
Este chat autoriza sincronizar fuente, sin desplegar ni ampliar audiencia.
La documentación remota de publicación describe el trabajo previo; no constituye
una nueva autorización de despliegue. La estimación histórica 42% corresponde al
alcance original completo y debe reevaluarse tras aceptar el nuevo alcance D1.


## Decisión vigente posterior — laboratorio hasta la versión final

El usuario rechazó expresamente comenzar cuentas e invitaciones antes del 100%
y pidió recuperar simulación/datos ficticios. La entrada vuelve a ser
LaboratoryWorkspace, aislada en paris-state-lab y sin llamadas a la API operativa.
No activar RemoteWorkspace ni enviar invitaciones reales durante esta etapa.
Las correcciones de la vista privada de pruebas se conservan en el mismo Sites,
sin ampliar audiencia. Contrato: docs/product/CORRECTIONS-20261006-LABORATORY.md.
PROJECT-STATUS y EXECUTION-NEXT son el estado vigente; anteriores afirmaciones
de producto operativo describen el corte histórico superado por este pedido.
Avance orientativo 45–50%; no 100%.

Corrección técnica del 07/10/2026: los módulos propios de cada sección usan
`React.lazy` y un estado de carga accesible; los tests de integración esperan a
que la sección aparezca. El bundle principal bajó de ~593 kB a 489,53 kB. Ver
`docs/architecture/review-evidence/route-code-split-lab-20261007.json`.
Validación completa: 412/412, TypeScript, Vite, Worker y Chromium desktop/móvil.
No cambia el alcance privado ni habilita API o cuentas. Mantener el aviso del
chunk de gráficos de 405,70 kB como oportunidad separada.
El corte quedó publicado como Site v66 desde `806ff00696434f573ee0542e4710d8b383ab1406`;
deployment `appgdep_6ac5f09cccb48191910a364ef6e8f998` exitoso, owner-only.

## Definición final del usuario — 06/10/2026
100% incluye aplicación aceptada sin correcciones conocidas, GitHub, dos Supabase dev/producción, hosting propio y automatización validada. Seguir docs/ops/FINAL-ACCEPTANCE.md. No crear cuentas ni invitar usuarios durante laboratorio. No confundir CI preparado con CI ejecutado.

## Correcciones posteriores — notificaciones
Seguir docs/product/CORRECTIONS-20261006-NOTIFICATIONS.md. La activación conjunta ya genera un aviso local y se verificó desde la interfaz hasta abrir la tarea y persistir su lectura; evidencia en `docs/architecture/review-evidence/joint-notification-lab-20261007.json`. Campana y comentarios siguen aislados al laboratorio. Entrega transaccional entre dispositivos requiere revisión de identidad y permisos antes de implementarse en servidor; no conectar cuentas durante esta etapa.

## Contrato conjunto — 06/10/2026
La implementación local de docs/architecture/JOINT-LABORATORY-CONTRACT-20261006.md está completada y publicada; ver el estado y sus límites más abajo.

## Estado vigente posterior — 06/10/2026
El contrato de tareas conjuntas ya está implementado en el laboratorio local;
ver evidencias y límites en PROJECT-STATUS.md y
architecture/JOINT-LABORATORY-CONTRACT-20261006.md. Continúan fuera de alcance
Auth, API/D1, Supabase y colaboración entre computadoras. Los cambios aprobados
de la vista de laboratorio se pueden sincronizar y publicar en el mismo Site
privado sin cambiar audiencia. La cobertura selectiva, incluyendo reglas
recurrentes previstas, está implementada en el laboratorio; la siguiente etapa
es cerrar bajas/reasignaciones e historial antes de cambiar permisos del backend.

Correcciones de interfaz 07/10: revisar
`docs/product/CORRECTIONS-20261007-UI.md` y
`docs/architecture/review-evidence/ui-corrections-lab-20261007.json`. Resumen,
Catálogo/Cierre por rol, tarjetas compactas, tema y arrastre están verificados.
Operativas, calendario/eventos, cierres de alcance múltiple y analítica necesitan
contrato GPT-6.1 Sol alto antes de implementar. Avance sigue ~45%; no crear
cuentas ni cambiar la audiencia hasta la aceptación final.

## Ciclo de trabajo mensual — 06/10/2026

El ciclo día/semana se muestra sólo en Análisis del laboratorio local. No
conectarlo al backend ni compartir datos entre navegadores en esta fase. Carga
planificada usa `scheduledOn`; carga real usa sesiones repartidas por fecha
Argentina, registros operativos con unidades separadas y cierres fechados. No
deducir capacidad/tiempo libre. Las tareas compartidas suman una sola vez al
total y sus puntos planificados se distribuyen por cuotas. `completedBy` es
opcional y sólo se captura para nuevas finalizaciones de esta simulación; no
inventar actor para cierres históricos. Evidencia actual en
`docs/PROJECT-STATUS.md` y
`docs/architecture/review-evidence/work-cycle-lab-20261006.json`.
El corte funcional se publicó en el mismo Site privado como v58 desde el commit
`c41bb7a9f9dcee2408b1b714af440f89914814dd`; confirmar fuente, versión y
audiencia antes de anunciar posteriores actualizaciones.

## Continuidad de bajas — 06/10/2026
La baja/reasignación directa de tareas futuras limpias está implementada sólo
en el laboratorio. Mantener `docs/architecture/PROFILE-DEACTIVATION-LAB-CONTRACT-20261006.md`
como contrato vigente. El traspaso explícito de tareas iniciadas también quedó
implementado sólo en el laboratorio, con historial auditable, reloj por actor,
reporte y CSV. Las tareas conjuntas requieren revisión manual. No portar estas
mutaciones a D1/Supabase sin revisión de permisos y aceptación.

## Cierres y exportaciones — 07/10/2026
La tabla de cierre incorpora tareas conjuntas con KPI por cuota; el CSV separa
ponderación global de puntos y tiempo personal. Un actor inactivo no puede cerrar.
Ver `docs/PROJECT-STATUS.md` para la evidencia del corte y `docs/EXECUTION-NEXT.md`
para el próximo bloque. Mantener el Site privado y publicar sólo sobre la misma
identidad ya configurada, sin cambiar la audiencia. La versión 54 quedó publicada
correctamente desde el commit `608fb478bb5b8010c22431451b92fd664f424b65`.

## Empaquetado portable — 07/10/2026
El empaquetador del plugin de Sites usa Bash y puede fallar en Windows. Para
crear/validar el archivo Worker desde el build, usar
`node scripts/package-site-archive.mjs <ruta-absoluta>` o `npm run package:site`;
después verificar por separado que push, versión y deployment terminaron bien.

## Consultas y pedidos internos — laboratorio local

La interfaz local separa error técnico (cola de soporte simulada), pedido de
trabajo (Juan Pablo) y sugerencia (destino explícito). Autor, destinatario y
jefatura pueden ver el seguimiento; los destinatarios actualizan estado y
responden. Urgencia/antigüedad ordenan los abiertos; el historial permanece
visible aun cuando se resuelven. No se crean tareas ni se alteran KPI. No usar
datos reales ni adjuntos: la colección vive en `paris-state-lab` del navegador,
no sincroniza dispositivos, no existe una cuenta de soporte conectada y no hay
entrega por servidor. No portar a API/D1/Supabase sin revisión Sol del contrato
de almacenamiento, identidad técnica y permisos.

## Mejora de procesos y trabajo desde otra PC — 06/10/2026

Kaizen/5S y versionado de catálogo están implementados sólo en el laboratorio
local; revisar `docs/PROJECT-STATUS.md` y su evidencia antes de ampliar alcance.
No portar su almacenamiento/permisos a D1 o Supabase sin revisión arquitectónica.
El checkout no tiene remoto GitHub propio; hasta la aceptación final no crear
esa cuenta. Para una PC personal, usar un bundle portable con el mismo historial
y trabajar una sola copia a la vez; no sincronizar `.git` por carpeta compartida
ni afirmar sincronización entre dispositivos. `package-lock.json` es el lockfile
existente; conservar npm y ejecutar `npm ci` en la copia de otro equipo.

## Agenda fiscal en laboratorio — 07/10/2026

La agenda de obligaciones conserva período fiscal, vencimiento, origen y
revisiones y sólo usa datos ficticios del laboratorio. No cargar vencimientos
reales ni consultar ARCA. No sincroniza la simulación entre PCs; para continuar
en otra PC usar el bundle Git actualizado después de dejar limpio el checkout,
trabajar una sola copia por vez y transferir commits de vuelta con otro bundle.

## Estado y traslado a otra PC — 07/10/2026

El flujo de propuestas de tareas habituales quedó implementado sólo en el
laboratorio y publicado en el Site privado v61 desde `0ca71bb`. Jefatura aprueba
de forma explícita antes de materializar asignaciones. No ampliar audiencia,
activar cuentas ni conectar `/api`, D1 o Supabase.

La PC personal recibe `outputs/grupo-paris-site-personal.bundle` y
`outputs/LEEME-PC-PERSONAL.md`. El bundle conserva `main` y su historial; no
incluye el `localStorage` `paris-state-lab`, por lo que no comparte la simulación
guardada en el navegador. Trabajar con una sola copia por vez y devolver commits
en otro bundle. No sincronizar la carpeta `.git` con OneDrive. Mantener el
avance global aproximado en 45%; la transferencia no adelanta aceptación ni
habilita la infraestructura final.

### Actualización local y traslado — 07/10/2026

El commit local 389528cbbd6ae1af668931f6bfdd05d499953d13 agrega reportes
imprimibles y quedó verificado según docs/PROJECT-STATUS.md. No hay confirmación
de publicación Site v62. Para la PC personal usar el bundle vigente y la guía
outputs/LEEME-PC-PERSONAL.md; no usar transferencias antiguas. El bundle
preserva código e historial, no datos localStorage ni acceso a Sites.

## Continuidad desde PC personal — 07/10/2026

El paquete vigente `outputs/grupo-paris-site-transfer-20261007.zip` incluye el
bundle Git de `main`, su historial y `outputs/LEEME-PC-PERSONAL.md`. Se puede
editar/ejecutar el laboratorio local en otra PC sin GitHub ni cuentas nuevas;
usar una sola copia a la vez y transferir commits de vuelta en otro bundle. El
estado `paris-state-lab` del navegador no viaja. Para publicar, acceder al mismo
Site privado desde la cuenta dueña; nunca incluir credenciales en el paquete.

El cierre secuencial A/B de tareas conjuntas se validó en Chromium y en la suite
completa; evidencia vigente en `docs/PROJECT-STATUS.md` y
`docs/architecture/review-evidence/joint-close-lab-20261007.json`. No trasladar
ese contrato local a D1/Supabase sin una revisión de permisos y esquema.

El arreglo se publicó como Site privado v62 desde el commit
`8d21e3245c6e4ee93aa741b4c3baf3ddc7b8b608`; deployment exitoso
`appgdep_6ac5d2df02ec8191b861bfcee8d98934`. Relectura confirmada: owner-only,
una cuenta autorizada, sin grupos ni visitantes externos. No activar APIs ni
cambiar audiencia.

## Conversión explícita de pedidos — 07/10/2026

En el laboratorio se puede convertir un pedido de trabajo en una tarea puntual,
pero sólo mediante confirmación explícita de jefatura. El pedido no crea tareas
ni afecta KPI al registrarse; la jefatura debe elegir responsable, empresa,
fecha, controles y peso. Errores técnicos y sugerencias no se convierten.
La tarea y el pedido conservan sus IDs de origen/destino, el historial cierra el
pedido y el responsable recibe la notificación ya usada para asignaciones.

Mantener validaciones de período abierto, membresía de empresa, perfil activo,
visibilidad, peso positivo e idempotencia. No trasladar esta ruta a API, D1 o
Supabase sin revisar identidad y permisos; no usar adjuntos ni datos reales.
Evidencia y cobertura: `docs/architecture/review-evidence/internal-request-conversion-lab-20261007.json`.

Actualización del 07/10/2026: la conversión de pedidos se publicó como Site
v63 desde `f7b4c661d32a753b0ab34f4120c692c880efb8b0`; deployment
`appgdep_6ac5db13c9608191bd4ab52ee27f33b2`, exitoso y con la audiencia privada
sin cambios. Para continuar en la PC personal usar el ZIP y el bundle vigentes
indicados en `docs/EXECUTION-NEXT.md` y `outputs/LEEME-PC-PERSONAL.md`. El estado
`paris-state-lab` del navegador no forma parte del repositorio ni se transfiere.

### Búsqueda rápida de tareas — 07/10/2026

Implementada en el laboratorio con atajo Ctrl+K o `/`; busca tarea, empresa,
responsable, sector, estado, período y vencimiento sin distinguir tildes y
limita cada consulta a tareas autorizadas por `canWork`. Abrir un resultado
vuelve a validar el permiso y conserva el actor activo. No buscar comentarios
privados ni conectar `/api`, D1 o Supabase. Aceptación: 412/412 tests,
TypeScript, Vite/Worker y Chromium; ver
`docs/architecture/review-evidence/quick-task-search-lab-20261007.json`.
Antes de implementar dependencias, delegación/aceptación o nuevos avisos,
revisar contratos de estado y permisos con Sol alto. Mantener la audiencia del
Site sin cambios y actualizar el bundle personal sólo después del commit.
La búsqueda quedó publicada en el Site existente v64 desde
`5ecf94e9439a4d56ceab0990877451b3a5d6ca5a`, deployment
`appgdep_6ac5e1327d7c8191919a40fbf57b4b96`, sin ampliar la audiencia.

## Copia portable del laboratorio — 07/10/2026

La interfaz de «Vista de prueba» ofrece exportar/restaurar estado ficticio para trasladarlo manualmente entre navegadores/PCs. La función sólo escribe `paris-state-lab`; mantiene prohibido leer/escribir la clave operativa al restaurar y no habilita cuentas, sincronización ni llamadas API. El JSON no está cifrado; debe guardarse de forma privada. Contrato, pruebas y límites en `docs/architecture/LABORATORY-BACKUP-CONTRACT-20261007.md`, `docs/PROJECT-STATUS.md` y `docs/EXECUTION-NEXT.md`.

La transferencia de código sigue requiriendo bundle Git. Para llevar también el estado ficticio, descargar la copia desde la banda del laboratorio y, en la otra PC, elegirla desde el mismo control y confirmar la restauración. Trabajar una sola copia de código a la vez; no sincronizar `.git` por OneDrive.

## Estado vigente de entrega — 07/10/2026

El corte funcional de avisos se publicó como v68 desde `25d1490`. La audiencia
verificada es personalizada, propietario, una cuenta autorizada, sin grupos ni visitantes externos. Los avisos locales
de vencimiento se implementaron en `paris-state-lab`: agrupación a tres días,
hoy y atrasadas; apertura de tarea y lectura persistente por perfil/regla/día
ART. Se calculan al abrir la campana; no hay scheduler, correo ni entrega entre
equipos. Contrato y evidencia: `docs/architecture/STATE-REVIEW-20261007.md` y
`docs/architecture/review-evidence/deadline-notifications-lab-20261007.json`.

El árbol actual pasó 420/420 pruebas completas, 104/104 del pre-commit,
TypeScript, Vite/Worker y Edge escritorio/móvil; no llamó a `/api`. La tarea
pendiente de continuidad inmediata es generar/verificar bundle y guía vigentes
para PC personal. No conectar cuentas reales durante la aceptación del
laboratorio.

## Estado vigente posterior: revisión del plan — 07/10/2026

La revisión actual encontró once discrepancias reproducidas y requisitos
incompletos; la implementación no está aceptada. Seguir la matriz y evidencia
en `docs/architecture/PLAN-REVIEW-20261007.md` y el contrato de correcciones
`docs/architecture/PLAN-CORRECTIONS-NEXT-20261007.md` con Luna medio Standard.
Después revisar con Sol alto Standard. El código está sin commit ni nueva
publicación. No conectar cuentas/servicios ni actualizar el Site mientras estos
defectos sigan abiertos. PROJECT-STATUS y EXECUTION-NEXT contienen el estado
vigente; los números de pruebas/publicaciones previos son registros históricos.


## Correcciones del plan — estado local 08/10/2026

### Precedencia de auditoría integral — 11/10/2026

La auditoría integral Sol sigue abierta: 60 hallazgos y 90 casos reproducidos,
con instrucciones en `docs/architecture/SOL-AUDIT-20261008.md`. Las cifras y
afirmaciones de verificación de cortes anteriores son evidencia histórica;
no acreditan aceptación actual ni autorizan commit/publicación con defectos
abiertos. Completar la revisión pendiente antes del cambio manual a Luna.
La lectura completa de migraciones no acredita Auth/RLS real ni concurrencia.

Hay correcciones locales desde la auditoría 07/10; el estado vigente y los límites están en `docs/PROJECT-STATUS.md` y `docs/EXECUTION-NEXT.md`. La suite completa más reciente pasó 494/494 en 57 archivos; TypeScript, build cliente/Worker y recorridos Edge pasaron. El cierre por empresa cuenta y confirma grupos conjuntos completos; activación, reasignación y traspaso revisan cierres parciales de todos los responsables. Edición de perfiles, recurrencias y cierre mensual exigen jefatura activa. Jefatura conserva consulta y avisos de tareas conjuntas en todo su ámbito sin membresía empresarial directa. Encargados autorizados pueden reprogramar tareas puntuales pendientes con motivo, preservando vencimiento, período y recurrencia. Evidencias en `docs/architecture/review-evidence/company-closure-group-readiness-lab-20261008.json`, `joint-task-partial-close-guard-lab-20261008.json`, `orphan-transfer-recipient-closure-guard-lab-20261008.json`, `inactive-manager-write-guard-lab-20261008.json`, `monthly-close-role-guard-lab-20261008.json`, `boss-joint-notification-access-lab-20261008.json` y `punctual-task-rescheduling-lab-20261008.json`. La auditoría de contraste ampliada evaluó 5.943 textos en 76 combinaciones, con cero fallos y cero omitidos; evidencia en `docs/architecture/review-evidence/contrast-audit-gradient-lab-20261008.json`. El flujo de evidencia aplica atómicamente el límite por tarea/movimiento, conserva ese alcance al restaurar respaldos v2, sigue aceptando respaldos v2 anteriores y preserva blobs existentes al actualizar IndexedDB v1 a v2; evidencia en `outputs/plan-validation-20261008/evidence-record-limit-final3/` y `edge-evidence-concurrency-final3/`. La historia desde cierres inmutables y los filtros de Mi día ya están implementados; evidencia en `docs/architecture/review-evidence/closed-history-lab-20261008.json` y `mi-dia-route-filters-lab-20261008.json`. Un inventario TypeScript confirma que no quedan llamadas a Panel sin control de plegado; el seguimiento está en `docs/architecture/review-evidence/cross-module-panel-folding-followup-lab-20261008.json`. La auditoría accesible con árbol de Chromium cubre 38 rutas/2.124 controles sin nombres faltantes; su script y salida están en `tests/browser-accessibility-audit.cjs` y `outputs/plan-validation-20261008/accessibility-panel-folding-final/accessibility-audit.json`. Aún faltan aceptación total y lector de pantalla. El corte sigue sin commit/PR/publicación; mantener datos ficticios, Site privado y cuentas/servicios desconectados.
