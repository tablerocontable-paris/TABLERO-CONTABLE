# Revisión de política P — dictamen Sol

Fecha: 21/10/2026. Alcance: lectura de contratos efectivos y pruebas existentes
en el corte `eb960410a14d70abbc4c3a43528f6da1aa567a1c`. No se modificó SQL ni
se ejecutaron operaciones remotas.

## Dictamen

P no justifica una corrección general de replays. Las políticas de
`public.pause_task_timer` y `public.save_private_block_note` son diferentes por
diseño y no deben igualarse por uniformidad.

- `pause_task_timer` permite que el dueño detenga su sesión tras perder la
  ejecución o quedar inactivo, si conserva identidad durable, la tarea sigue en
  la misma organización y los controles de cierre lo permiten. El replay exacto
  propio devuelve el `ended_at` original y no reabre sesión, cambia revisión,
  genera auditoría ni actualiza fences. No debe revelar contenido ni identidad
  ajena.
- `save_private_block_note`: una escritura nueva requiere perfil, rol y
  organización activos, acceso vigente a la tarea y período abierto. Un replay
  exacto puede devolver el ACK histórico mínimo propio (`note_id`, `revision`,
  `cleared`) después de cobertura expirada o cierre. No puede devolverlo a un
  perfil inactivo, auditor/técnico, otra organización o actor distinto. El
  historial propio sigue legible para autor activo en su organización aunque
  pierda acceso a la tarea; las lecturas supervisoras mantienen autorización
  vigente.
- `task_private_block_notes` no es `personal_annotations` de M2.5; no trasladar
  la política de un recurso al otro.

La revisión citó `tests/private-block-notes-009-review.test.ts` y
`tests/private-block-notes-009.test.ts` como soporte unitario para historial,
denegación de nuevas escrituras, ACK tras cierre y replay inactivo. Esto no
constituye todavía prueba nativa de concurrencia.

## Primer runner nativo: defecto reproducido y contrato de corrección

PostgreSQL 17.11, baseline `eb960410a14d70abbc4c3a43528f6da1aa567a1c`, SQL014
SHA-256 `EF9BD767AA9A7FE83CD93B117E643F4B29DDC62345E8DD0687E2E2F598D04B95`.
Runner inicial `tests/review/m2-2c-private-block-note-replay-policy.mjs`
(SHA-256 `DC8CED4B5FD55FB9A74A33B6B9F3AEEC9569297BE0832E6AD69DE6C7D6038454`);
reporte rojo preservado en
`outputs/m2-2c-private-block-note-replay-policy-luna-20261021-final/report.json`
(SHA-256 `710D8F8E50ED5916409436F5E963079C04E34AEF0121FA90F03F9660271AB39C`).
El manifiesto versionado inicial SHA-256
`A5FBB36D47D5685FE8131A2F04692D14CDBBA86B6E93ED16A7DA04AD482AE45B` incluyó
once referencias verificadas; dos copias canónicas de cinco entradas quedaron
desactualizadas y deben sincronizarse en el siguiente corte.

El runner obtuvo cuatro barreras reales. Confirmó el defecto `inactive/RR`:
`save_private_block_note` devuelve el ACK previo (`00000`) después de que otra
transacción confirmó `active=false`; un retry fresco deniega. `inactive/RC`
deniega `P0001`. El cambio `empleado→encargado` con perfil activo está permitido
por la política de rol actual; dos expectativas iniciales que lo marcaban como
violación son falsos positivos y deben corregirse, no convertir la promoción en
revocación. El cambio de organización del autor no puede realizarse por la FK
compuesta y devuelve `23503` sin alterar snapshot. Otro actor y otra
organización no reciben el ACK.

Sol autorizó sólo el arreglo acotado de la rama cached de
`save_private_block_note`: luego de receipt lock y comparación exacta de
argumentos, adquirir `_coordination_acquire_m22b` con plan de actor/perfil
solamente; releer y validar perfil actual activo, misma organización y rol
permitido (`empleado`, `encargado`, `jefe`); releer el recibo y comparar sus
campos antes de devolver ACK. Se espera `P0001` en RC tras inactivación, `40001`
para snapshot RR obsoleto y `P0001` en retry fresco. No alterar pausa, helpers,
receipt lock, RLS ni migraciones 001–013.

La corrección fue implementada y aceptada por Sol en alcance local acotado;
ver `M2-2C-P-POLICY-SOL-ACCEPTANCE-20261021.md` para hashes y límites. Quedan
pendientes la suite oficial excluyendo `tmp`, el cruce del orden replay-first
con §9, Gate L y cualquier operación Supabase remota.

## Gate L

Gate L permanece **abierto**. El inventario §9 debe consolidarse como matriz
finita: requisito → caso exacto → reporte y resultado → aislamiento/ganador →
artefacto hash → aceptación y límite. La presencia de casos en el runner no
equivale a aceptación; las familias T/C/A ya aceptadas no se repiten. Sólo los
huecos probatorios genuinos generan trabajo adicional. Esta revisión P no
autoriza SQL014 remota, preflight alojado ni migración Supabase.

## Fuentes revisadas y SHA-256

```text
AGENTS.md 14186F471F95795B0C442FE83715C7EC93B5917AF61E583A6711DC521E380C5D
docs/PROJECT-STATUS.md C1154E4BF07C7DB6589209BE1E80FD015F626D12F584EF31DC574626B30B6253
docs/EXECUTION-NEXT.md 34E9950FCD331A8D45F155A65D5EF9B86C4FD3333B484B2D8A697E38EA85B11F
docs/architecture/M2-2BC-EXECUTABLE-CONTRACT-20261016.md 9C4ED87AA25482BF6DEFAC5DFFE5483E97C6097248E341543ADD8D1FA68F99C4
docs/architecture/M2-2C-SECTION9-RESIDUAL-AUDIT-SOL-20261020.md 26514C757B2D96BFCADA99E82BC085A7A46F7CB798227DF73C1341A7A828FFB1
docs/architecture/M2-2C-MEMBERSHIP-WRITERS-MAP-20261016.md 37E6B9B7ED3BB398413F3EBDAC71EBA5FC181E46C8B3ACAD279F2DB9A275930A
supabase/migrations/202610060011_coordination_activation.sql 9729A6800E93DEDC43AB5F0840309B7C0D222343898CC8D5B43EEB4A387F4210
supabase/migrations/202610150014_operational_api.sql EF9BD767AA9A7FE83CD93B117E643F4B29DDC62345E8DD0687E2E2F598D04B95
tests/review/m2-1-native-review.mjs DE5246B31DE87F5B6E706E7FA991024F588B9DB5F186A2F6E7B0D539C4A2D22D
tests/private-block-notes-009-review.test.ts A4149395E8ADF89EE532DFA4EEE0BF9B3C522C26430112014C6980D31187DA0C
tests/private-block-notes-009.test.ts C7E76E8EF13594E3663560D55CC44E522F64A65DAABD5A73A08F342D0F24A6C6
docs/architecture/M2-2C-LEGACY-ABSENCE-REPLAY-SOL-ACCEPTANCE-20261021.md D98A81BF0B7B813A6D6463A0D429985C9CACDE807AF56CDC7395D230BBB6103D
```
