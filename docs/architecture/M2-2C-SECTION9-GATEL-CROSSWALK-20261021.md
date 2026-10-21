# Cruce §9 / Gate L — matriz de evidencia y huecos finitos

Fecha: 21/10/2026. Revisión independiente de Sol sobre el contrato §9, auditoría
residual, mapa de writers, runner nativo, reportes y aceptaciones existentes.
No se ejecutaron SQL ni cambios remotos.

## Identidad del corte

```text
HEAD / origin/main: eb960410a14d70abbc4c3a43528f6da1aa567a1c
SQL014 candidata con P local: 218DEA9E9E3097743BD09238E73D5840A664F6718AEBE7670B88AF064278A837
Runner nativo heredado: DE5246B31DE87F5B6E706E7FA991024F588B9DB5F186A2F6E7B0D539C4A2D22D
Runner nativo P: B6D2E46C46735DEB8CAEB1175674AEDCBFD63E9A69BBE32513FA5BF934196F84
P27 reporte: 427B70B9D8A6E07B9413DC4419D092FF2EE5A456A88D0F4893C777B762AC982E
P aceptación: M2-2C-P-POLICY-SOL-ACCEPTANCE-20261021.md
```

R376 = `../../outputs/m2-2c-legacy-absence-replay-luna-20261020/native-full-candidate-final/review.json`, SHA-256
`09BAF79AF24C5C3FB4319E9616ACB9B2E747F62A50FEA338AF83C83013AF7374`;
SQL014 histórica P `EF9BD767…04B95`, runner `DE5246…2D22D`, 376/376.
R376 antecede a P: reutilizar sólo para funciones y casos no afectados, sin
presentarlo como ejecución integral de SQL014 actual.

B4 refiere los cuatro reportes de
`../../outputs/m2-2b-sol-p1-core-{rc-rc,rc-rr,rr-rc,rr-rr}-20261016/review.json`,
respectivamente SHA-256:

```text
C5B9F2DD205B6DE964BAA5F1EF53C9DD5F1D3569BB7EBAB0745822D406F136D2
45AA3ACD086CB3EC37B57585B4C88BF01620B16B597C73119B6531A453065B06
D31C68B6D6DCDAA6353678E2CE2B23A6C6F0DA07682766D45AB9BFDE7E348930
76B607F14583FF766028FE40DABC993C0AAC2110E4B8B702FF6D364C823B4086
```

## Evidencia aceptada que se conserva

| Área / requisito | Evidencia exacta revisada | Resultado y límite |
|---|---|---|
| B local: permisos, comercial, readiness, grafo y DTO | Aceptación B previa; `tests/m2-2b-contract.test.ts` SHA `E28C1BA2…13E0`; B4 y R376 | Mantener aceptación B; no reabrir por este inventario. |
| B concurrencia: dependencias vs timer/completado; joint/configuración; progreso/completado; cierre/revocación | B4, escenarios nombrados en R376; cuatro pares RC/RC, RC/RR, RR/RC, RR/RR | Blockers, SQLSTATE, retries y estado final inspeccionados; cubierto en alcance aceptado. |
| Alta/alta | R376 `results[17–24]`, `concurrent one-off creation serializes and retries` | Ambos ganadores en RC/RC y RR/RR; `00000/40001`, retry y dos assignments. Cubierto. |
| Draft/save vs submit | R376 `results[204–207]` | Ambos órdenes RC/RC y RR/RR; espera, stale/retry y estado final revisados. Cubierto en alcance observado. |
| Submit/requestChanges/approve | R376 `results[200–203]` | Ambos órdenes RC/RC y RR/RR; resultados, retry y estado final revisados. Cubierto. |
| Approve/approve | R376 `results[180]`, `[183]`; intento 6 casos 1–2 | Ambos órdenes/ganadores en RC/RC y RR/RR. Sol aceptó intento 6 en alcance local. |
| Replay de aprobación | R376 `results[181–182]` y aceptaciones específicas | RC/RR y RR/RC; lectura/escritura frente a revocación cubiertas por aceptaciones exactas. No repetir. |
| Catálogo revise vs assignment.create | R376 `results[208–211]` | Ambos órdenes RC/RC y RR/RR; versionado y retries. Cubierto. |
| Catálogo revise vs approve | R376 `results[219]`; intento 6 casos 3–4 | Revisión primero con aprobación aislada RC/RC y RR/RR, actores distintos; Sol aceptó intento 6 en alcance local. |
| Assignment+approve antes de revisión | R376 `results[220–221]` | RC/RC y RR/RR; revisión espera y final `2|approved|1|3`. Cubierto; no repetir. |
| Materialize/materialize | R376 `results[222–225]` | Ambos órdenes RC/RC y RR/RR; blocker, stale/retry y ocurrencias únicas. Cubierto. |
| Cierre vs alta puntual | R376 `results[226–231]` | Ambos ganadores RC/RC y RR/RR y mixtos; estados finales revisados. Cubierto. |
| Cierre vs materialización | R376 `results[232–235]` | Ambos ganadores RC/RC y RR/RR; `55000/40001/0A000`, retry y estado final revisados. Cubierto. |
| Materialización vs alta puntual | Intento 6 casos 5–8 | Ambos ganadores en RC/RC y RR/RR, mismo owner/período, receipts/ocurrencias únicas; Sol aceptó intento 6 en alcance local. |
| Responsabilidad/cobertura/recurrencia | Aceptaciones específicas; R376 | Mantener límites y matrices ya aceptadas; no reimplementar. |
| Inyecciones C | R376 `results[236–240]` | Hay pruebas, pero varias ocurren antes de escribir la familia o revisan campos parciales. Ver sección de atomicidad abajo. |
| Membership/fences | R376 `results[284–285]` | RC y RR, rollback/retry/epochs; aceptado, no repetir. |
| Legacy T/C/A | Aceptaciones publicadas de cada familia | Cerradas en su alcance; no repetir. |
| Política P writer-first | P27 y aceptación acotada | Seis barreras reales; inactivo/auditor RC deniegan, RR stale `40001`, retries deniegan; promoción válida conserva ACK. Aceptada. |
| Política P replay-first | Intento 6 casos 9–12 | Replay conserva `FOR SHARE`; writer espera el PID correcto en RC/RC y RR/RR; retry fresco deniega. Sol aceptó intento 6 en alcance local, con límite de operador PostgreSQL local documentado. |

## Trabajo finito ejecutado; revisión integral pendiente

### 1. Doce carreras sin tocar SQL014 — intento 6 aceptado por Sol en alcance local

El runner local único ejecutó estas doce carreras. Cada caso registra
actor/rol/AAL, PID por conexión, aislamiento observado, blocker real, resultado,
SQLSTATE, retry, estado ganador y snapshots completos de las 57 tablas base.
Demostrar cero `40P01` y conservar manifests/hash de runner y reporte.

| # | Pareja y orden requerido | Aislamiento / cantidad |
|---:|---|---|
| 1–2 | approve/approve: gana B; luego gana A | RC/RC y RR/RR; dos casos |
| 3–4 | catalogue revise antes de approve, aislando la pareja | RC/RC y RR/RR; dos casos |
| 5–8 | month.materialize vs task.createOneOff, mismo owner/período; ambos ganadores | RC/RC y RR/RR; cuatro casos |
| 9–12 | P replay-first vs inactivación y rol auditor; replay mantiene `FOR SHARE`, writer debe bloquear, commit del replay, writer finaliza, retry fresco deniega | RC/RC y RR/RR; cuatro casos |

Para alta/materialización, afirmar exactamente una ocurrencia por origen y
resultado stale/retry coherente con la revisión ganadora. Para P replay-first,
ACK inicial `00000`, evidencia del writer esperando en PID del replay, luego
writer y nuevo replay fresco `P0001`, sin mutación por el ACK.

### 2. Atomicidad C: inyección tardía — intento 9 aceptado por Sol en alcance local

El intento 7 ejercitó seis escenarios tardíos en las cinco
familias porque `onboarding.saveDraft` y `onboarding.submit` son operaciones
distintas. SQL014 `saveDraft` escribe el request/draft pero no
`onboarding_request_versions`; `submit` inserta la versión. Se inyectó después
de los writes de negocio y antes del commit mediante auditoría, y se comprobó
rollback/retry/replay con snapshots completos de las 57 tablas. SQL014 no cambió.

| Caso | Resultado | Evidencia |
|---|---|---|
| `task.createOneOff` posterior a escritura | inyección `23514`; rollback íntegro; retry y replay `00000` | intento 9, snapshots 57 tablas |
| `catalogue.create` posterior a escritura | inyección `23514`; rollback íntegro; retry/replay `00000` | intento 9, snapshots 57 tablas |
| `onboarding.saveDraft` después de request | inyección `23514`; rollback íntegro; retry/replay `00000` | intento 9, snapshots 57 tablas |
| `onboarding.submit` después de request version | inyección `23514`; rollback íntegro; retry/replay `00000` | intento 9, snapshots 57 tablas |
| `onboarding.approve` después de asignación/activación | inyección `23514`; rollback íntegro; retry/replay `00000` | intento 9, snapshots 57 tablas |
| `month.materialize` después de ocurrencias | inyección `23514`; rollback íntegro; retry/replay `00000` | intento 9, snapshots 57 tablas |

Sol rechazó el intento 7 por dos defectos del harness; ambos quedaron
corregidos y Sol aceptó el intento 9 en alcance local acotado. `[1,2]` positivo
con los demás campos válidos y `[1,1]` rechazado desde
`api_validate_onboarding_v2` demuestran weekday duplicado; el flujo multilinea
captura tras quitar conflicto y antes del retry, y verifica replay igual al
recibo y snapshots invariantes. Intentos 1–9 preservados, sin cambios SQL014.
No se repite la inyección de membership ya aceptada.

### 3. C local: calendarios y aprobación de múltiples líneas — intento 9 aceptado por Sol en alcance local

El intento 9 ejecutó con RPCs SQL014 y fixtures sintéticos:

- fecha bisiesta, día 31 y vencimiento trasladado al mes siguiente;
- rechazo de `lineId` y valores `weekdays` repetidos en borradores multi-línea.
  SQL014 no define `slotId`; no se inventa uno ni se prohíben líneas distintas
  sólo por compartir una configuración;
- aprobación all-or-nothing donde una segunda línea choca con una asignación
  existente después de que la primera línea puede escribirse.

Resultados aceptados por Sol en intento 9: `22023` para ambos borradores inválidos sin delta en snapshots;
29/02/2024 → vencimiento 01/03/2024 y 31/03/2024 → 01/04/2024; aprobación con
conflicto en la segunda línea `22023`, sin efectos parciales; retry `00000`, y
replay igual al recibo durable sin delta. Runner SHA-256
`08DDC8B61798FA086B59859D9388246F25AE0106D28710A041BD1DAE54E039DF`, reporte
SHA-256 `3C3DFA0452EC2FEE6F63DC5B5A9619E5C7FF564FBA3DC526A6E7366AC706271F`,
manifiesto SHA-256
`3289B52BE0E8DA639AB76816124560C1A77F2EFE8B24C65F6D31E44110837B59` en
`../../outputs/m2-2c-c-late-atomicity-calendar-luna-20261021-attempt9/`.

Los tests JS/Zod o validación visual no sustituyen la ruta SQL. No reabrir
unidad legacy81, cubierta por su aceptación específica.

## Criterio de cierre Gate L

Sol aceptó integralmente Gate L para el corte local sintético exacto. Dictamen
firmado y límites: `M2-2C-GATEL-INTEGRAL-SOL-ACCEPTANCE-20261021.md`, SHA-256
`CEF5916715C036AFA8F2E7A8EE5707432F05D276A80847C65C6ED367724DA5F5`.
Suite final, TypeScript y builds cliente/Worker con salida 0; evidencia actual
exacta en `M2-2C-GATEL-FINAL-LOCAL-VALIDATION-20261021.md`. T/C/A/P se
referencian sin repetir sus pruebas. No hubo rojos inesperados en el corte
final; los intentos históricos fallidos se preservan.

Después de Gate L siguen gates distintos: comprobar la configuración Data API
y destino, ejecutar preflight y aplicar la migración sólo en `grupo-paris-dev`,
y luego Gate H con Auth/HTTP sintéticos. Storage/restore, M2.3–M2.7, frontend,
Cloudflare, correo, aceptación humana y producción siguen fuera de Gate L.

## Fuentes revisadas

```text
M2-2BC-EXECUTABLE-CONTRACT-20261016.md
9C4ED87AA25482BF6DEFAC5DFFE5483E97C6097248E341543ADD8D1FA68F99C4
M2-2C-SECTION9-RESIDUAL-AUDIT-SOL-20261020.md
26514C757B2D96BFCADA99E82BC085A7A46F7CB798227DF73C1341A7A828FFB1
M2-2C-MEMBERSHIP-WRITERS-MAP-20261016.md
37E6B9B7ED3BB398413F3EBDAC71EBA5FC181E46C8B3ACAD279F2DB9A275930A
tests/review/m2-1-native-review.mjs
DE5246B31DE87F5B6E706E7FA991024F588B9DB5F186A2F6E7B0D539C4A2D22D
tests/m2-2c-contract.test.ts
4EED32C20BCD85A92EDD1A6C267DF3CBA6418F7E4D0F9D8AC2B4810F9B52D517
```
