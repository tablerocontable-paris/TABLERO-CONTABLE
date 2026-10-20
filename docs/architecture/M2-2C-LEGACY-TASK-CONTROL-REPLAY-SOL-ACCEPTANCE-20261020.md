# Aceptación Sol — replay legacy de control de tarea

Fecha: 20/10/2026. Dictamen: **PASS local acotado de etapa T** tras corregir
el NO-GO de evidencia. Esta aceptación no cierra Gate L ni el inventario §9,
no autoriza aplicar SQL014 y no acredita una migración alojada.

## Alcance exacto

Se acepta la candidata de `supabase/migrations/202610150014_operational_api.sql`
para reautorizar los replays de `transition_task_reviewed`,
`set_checklist_item_reviewed`, `set_task_wait` y `set_task_wait_reviewed`,
mediante el helper privado `app_private.replay_legacy_task_control`.
Baseline HEAD: `f3a20cfe9ffba0efea5f8e09be047ebd25eb4e7d`.
Las migraciones anteriores permanecen sin cambios; el diff SQL se limita al
helper y los cuatro overrides. Se revisó la conservación de las primeras
ejecuciones, argumentos raw, firmas y formato de recibos.

El helper verifica el recibo original completo y lo relee después de adquirir
el protocolo común. La comparación de argumentos conserva precedencia sobre
la autorización. Los wrappers toman el lock1101; el plan adquiere1102–1105,
locks y fences existentes mediante `_coordination_acquire_m22b(plan,false)`.
Se revisaron el actor incluido en perfiles/meses, el grafo de resultado, la
revalidación de tarea/recibo, el perfil activo y el acceso vigente. El guard
adicional de ejecutor para tareas con tracking/dependencias está conservado.
El retorno utiliza la revisión histórica íntegra, incluido0, sin repetir el
writer ni las condiciones consumidas de la primera operación. El helper fija
`search_path=''` y tiene EXECUTE revocado a public/anon/authenticated/service_role.

## Evidencia aceptada

Base de resolución: `work/site`. Directorio de logs/reportes:
`../../outputs/m2-2c-legacy-task-control-replay-luna-20261020/`.
El manifiesto versionado contiene comandos efectivos, rutas, stdout/stderr,
códigos de salida y hashes. Se comprobaron **79/79 artefactos** y los hashes
actuales de las migraciones.

- Rojos finales: `red-review2-case0..3/red-report.json`. Los cuatro reproducen
  el retorno cached indebido tras revocación o perfil inactivo, con recibos
  auténticos sobre el blob baseline exacto.
- `red-review2-case2` incluye el probe RR: el empleado conserva su snapshot con
  membresía activa, el observador acredita la revocación ya confirmada y el
  replay devuelve indebidamente `00000/1`. Captura estado completo antes de
  revocar, después de confirmar y antes/después del replay.
- Verdes finales: `green-review2-case0..3/green-report.json`, **81 casos** entre
  los cuatro wrappers: replay inmediato, avance, restauraciones, perfil
  inactivo, revocación fresca, conflictos raw/kind auténtico, revisión0 y
  cierre legacy real en el representante. Las denegaciones devuelven
  `P0001/Sin permiso`; los replays autorizados conservan la revisión original.
- `races-review2-case2/green-report.json`: **8/8 carreras** representativas de
  `set_task_wait`, pares RC/RC, RC/RR, RR/RC y RR/RR, ambos ganadores. Se
  verificaron PIDs y blockers reales; replay primero devuelve1 y la revocación
  posterior confirma; revocación primero produce40001 en el replay perdedor;
  retry fresco en backend distinto deniega con P0001. El probe RR verde
  adicional devuelve40001 y el retry fresco P0001.

Los snapshots finales incluyen las seis colecciones faltantes del NO-GO:
tracking events, completion events, assessment versions, absence companies,
coverage plan instances y coverage plan assignment rules. Se inspeccionaron
los selectores completos y sus comparaciones. Una comprobación independiente
readonly sobre los reportes validó162 pares antes/después (81 rojos y81 verdes),
352 snapshots y las ocho combinaciones concurrentes. En las carreras se
comprobó adicionalmente la respuesta API contra un objeto esperado construido
desde el baseline, los reintentos, winner-only, rollback y la inercia de las
seis colecciones añadidas. Las mutaciones admitidas de revocación están
acotadas por el runner a membresía, fences, revisión de tarea, evento, audit y
recibo de esa operación; el recibo task_wait y el resto del estado se conservan.

## Regresión conservada

Se verificaron los artefactos ya ejecutados sobre esta misma candidata SQL:

- `native-final/review.json`: PostgreSQL17.11,351/351, failed0, deadlocks0;
  comando con `--review-matrix full --through-014 yes --m2-2a-smoke yes
  --m2-2c-smoke yes` y exit0.
- `suite-final/stdout.log`:74 archivos,738/738 pruebas; exit0.
- `build-final`: TypeScript, build cliente y build Worker con exit0. Cliente
  conserva dos advertencias de anotaciones de dependencias de Rollup.
- Sintaxis de los tres runners finales y `git diff --check` reejecutados en
  esta revisión con exit0.

No se repitieron suites/builds tras el arreglo exclusivo de evidencia: SQL y
producto mantienen el mismo hash. Los nueve procesos focales finales tienen
stdout/stderr y exit0 preservados.

## Identidades SHA-256 aceptadas

| Artefacto | SHA-256 |
|---|---|
| Contrato Sol | `86BDD0730BF33EB6184E108B20C6FE111C0EEE4B092C3940A3887CBBE3464FD2` |
| Auditoría residual §9 | `72D115845A30822809AF2FA7E88F278EAF806716BC1BBE61D06B904251E8D87B` |
| SQL014 baseline blob Git | `B5EAED293474A5A666E396AB42CBDAF998D9EA7EC63B93F111FA90B954230C92` |
| SQL014 baseline checkout raw | `CDD909C1A280DF8E891D6062838B146AEECADCF5CBC0F52291C6D44A0C89ECA2` |
| SQL014 candidata checkout raw | `19EC849B0397602B7DC03939539D37F0999FE808FD21A91B227E7767F4BF9FC3` |
| Runner rojo final | `1992B281C67E953548943E852253CF136D88D5D6E0A1FB7A0A33945E40C650C3` |
| Runner verde final | `B8F322D131B95BAA4EAF35403B768DB75591BBC88239AC8851743744902F019E` |
| Runner carreras final | `0982C71FC64BC8E00FD7B9F1D40E7B93D0C180A18E4494C545288BA5BA500541` |
| Manifiesto versionado | `0ADA1BC65256E3A183CBB6078D69315146EA322D44AD1E44DA4BF31E1518F8FA` |
| Puntero outputs manifest.json | `3969268FE9E85D692589058593004F4651A085A37C169ECA0238359F08871A53` |
| Reporte rojo RR final | `8EEEF4B0BEB79BE030D2740B77FE723424AB8C3616B8A4799BDC8867231D2FCB` |
| Reporte ocho carreras final | `7A5304E25D7CAD08FCC92DD3C9D123B475DCA2777FACCC900E0C32A221C53E04` |

Los restantes hashes de reportes/logs están en el manifiesto versionado
verificado. Los intentos previos permanecen como historial y quedan excluidos
de la aceptación focal: sus runners y snapshots anteriores no se presentan
como evidencia de la versión final. El fragmento scratch `.block` tampoco es
un runner aceptado.

## Limitaciones y siguiente unidad

P3: las identidades y claims AAL son sintéticas en PostgreSQL local. Se
inspeccionaron uid/claims/PID/aislamiento/snapshot; esto no prueba JWT firmado,
sesión Supabase, MFA del proveedor, RLS mediante HTTP ni exposición Data API.
La primera ejecución propia AAL1 conserva su política previa; el sufijo
reviewed no se interpreta como MFA universal.

La matriz concurrente aceptada corresponde al camino común con task_wait;
los otros tres wrappers tienen cobertura secuencial propia. Los recibos de
kind distinto se generan por endpoints reales en tareas aisladas; las carreras
usan empleados nuevos por caso, evitando contaminación de sesiones o alcance.
Los escenarios de tracking, coberturas y tareas conjuntas fuera de la matriz
finita no se declaran revalidados exhaustivamente por este bloque.

No se hicieron commit/push ni llamadas a servicios en esta revisión. No se
aplicó SQL014 ni se activó el espacio operativo. Continuar con las unidades
residuales C/A/P y el cruce consolidado §9 antes del preflight alojado.
