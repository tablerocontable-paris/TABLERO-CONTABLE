# Revisión independiente B1/009

Sesión Sol alto, 03/10 Argentina / 04/10 UTC. Base de implementación revisada:
`bfd7da12efbaeabc8889963c96c15bce1c880296`. Backend local, sin SQL remoto ni UI.

## Hallazgos reproducidos y reparación

Los probes se escribieron antes de reparar. Primer resultado: 6 fallos y 4 casos
correctos en tests/private-block-notes-009-review.test.ts sobre esa base.

| Hallazgo | Observación anterior | Corrección |
| --- | --- | --- |
| R01 cancelación tras envío | ACK válido tardío retornaba ok:true tras abort | Cancelación gana y devuelve ambiguous:true; libera listener y atiende settlement tardío sin otra mutación |
| R02 envelope incompleto | Null/undefined/objeto sin error se confundían con transport/server; algunos marcaban rechazo confirmado | Validar envelope antes del ACK; error protocol ambiguo, mensajes fijos y sin cuerpo |
| R03 espacios | SQL trim sólo quitaba espacios; tabs/newlines/Unicode vacíos podían guardarse aunque JS los rechazaba | Normalización SQL equivalente a ECMAScript trim, sin transformar la entrada enviada por wrapper |

Se agregó cancelación con transporte que nunca resuelve: termina sin esperar el
ACK, mantiene el operationId del llamador, no reintenta ni confirma un guardado.
Se quitó el límite arbitrario de 32 bits de revisión: el límite coherente con
revisionSchema/JSON numérico es MAX_SAFE_INTEGER. Los CHECK y RPC lo conservan.
La RPC vuelve a comprobar perfil activo/org/rol tras el lock de operación antes
de leer el receipt y tras locks de propietario/período; el replay no evade una
baja visible al momento de esa comprobación.

SQL001–008 no se editaron. 009 no estaba aplicada remotamente; su reparación
local se conserva en un commit nuevo, con la implementación anterior en Git.

## Aceptación local comprobada

- Suite acotada: 19 pruebas/2 archivos pasaron, incluidas las originales y los
  nuevos probes. La revisión añade 12 pruebas a las siete de la implementación.
- Autor puede conservar texto/historia propios cuando termina cobertura; no
  conserva acceso a la tarea ni al perfil del titular y no lee la nota de otro.
- Replay exacto después de cierre retorna el ACK original; operación nueva en
  mes cerrado e identidad inactiva se deniegan, sin receipt o versión adicional.
- Clear repetido es no-op sólo con revisión vigente. Texto de 2.000 codepoints
  se admite; vacío y límite/revisión inválidos no dejan escrituras parciales.
- Upgrade poblado 008→009 conserva SHA de tareas/sesiones/coberturas/activity,
  receipts y snapshots/reportes/outbox; se verifica texto literal de snapshots.
- Auditor/pares/exencargados no reciben historia privada por políticas compartidas.
  Notas, versiones y receipts privados permanecen fuera del lector/gateway/KPI.

## Concurrencia preparada, no ejecutada en PostgreSQL

tests/postgres-009 contiene fixture sintético y runner para base descartable, con
cuatro escenarios en ambos órdenes: crear/crear, revisar/revisar, cierre/nota,
desactivar/replay. Runner exige TC_PGHOST/PORT/USER y prefijo tablero_009_lab_,
crea DB nueva, observa espera real de locks y conserva log. Nunca usa una base
existente ni drops. --emit-only sólo escribe SQL; no hace conexiones.

El smoke checker PGlite pasó los ocho órdenes de los cuatro escenarios;
verifica la lógica SQL secuencial, sin afirmar carreras.
No hay psql/PostgreSQL instalado ni proyecto remoto seleccionado en esta sesión.
La documentación de PostgreSQL distingue snapshots de funciones STABLE y VOLATILE:
https://www.postgresql.org/docs/17/xfunc-volatility.html
La RPC de escritura es VOLATILE; comprobar con el runner la revocación tras
espera de locks sigue siendo una puerta real del piloto, no una conclusión del
smoke secuencial ni de esta lectura documental.

## Verificación final y continuidad

La suite amplia pasó **242 pruebas / 23 archivos** con
`npm test -- --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000` (333,13s).
En este entorno, PGlite tuvo tiempos de inicialización mayores y produjo timeouts de
fixtures (sin aserciones fallidas); los casos 009 permiten 60s de setup/ejecución
y se usa maxWorkers=1 para evitar solapamientos. No se cambia la lógica por esos
timeouts ni se considera el runtime local una medición de la aplicación final.
`npm run build` pasa TypeScript y Vite. Su primer intento detectó un segundo
argumento de timeout accidental en `expect(...).toEqual(...)`; se quitó y se
repitió el build correctamente. No cambia la aserción ni la ejecución SQL.
`git diff --check` pasa.

Siguiente contrato: COORDINATION-010-EXECUTION-20261004.md, responsabilidad y
selección staged de cobertura. Su activación 011 tiene otra puerta de revisión,
porque debe adaptar clocks, permisos, cierres y todos los RPC heredados juntos.
Live sigue v43; no declarar comentarios ni conjuntas funcionando en la interfaz.
