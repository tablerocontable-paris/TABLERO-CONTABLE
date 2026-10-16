# Validación PostgreSQL de cronómetros y coberturas 008

**Estado: NO EJECUTADO en PostgreSQL.** No se instaló un motor ni se abrieron
conexiones reales. PGlite verifica SQL secuencial y permisos simulados; no verifica
esperas, carreras, interbloqueos, Auth ni MFA reales.

Este procedimiento completa F de `../architecture/TIME-COVERAGE-008-ACCEPTANCE.md`.
Usar exclusivamente un servidor descartable de laboratorio, con un usuario que
pueda crear bases/roles y observar sus conexiones. Nunca Supabase ni el servidor
de empleados. Los roles y la tabla `auth.users` del laboratorio son simulados.

## Archivos ejecutables

| Archivo | Función |
| --- | --- |
| `tests/postgres-008/fixture.sql` | UUID fijos, jefe MFA, encargado, titular, reemplazante; empresas A/B; tres tareas; cobertura inicialmente sin sello |
| `tests/postgres-008/scenarios.mjs` | SQL completo por escenario y orden: preparación, A/B y DO/asserts |
| `tests/postgres-008/run-case.mjs` | Emite SQL sin conectar; modo futuro `--run` crea una base nueva y coordina dos psql más un observador |
| `tests/postgres-008/check-sql.mjs` | Comprueba sintaxis/resultados secuenciales en PGlite; jamás certifica concurrencia |

El runner no borra ni reutiliza bases. Si `createdb` encuentra el mismo nombre,
falla. Para repetir elegir un prefijo nuevo. Guarda SQL y logs en el directorio
indicado, sin contraseñas. Cada orden usa su propia base vacía.

## Configuración coherente

Host, puerto y usuario se indican explícitamente una vez y se pasan tanto a
`createdb` como a **todas** las conexiones `psql`, incluido el observador.
No hay URL o contraseña supuesta. Credenciales mediante `.pgpass` o configuración
del laboratorio; `--no-password` evita una espera interactiva.

```bash
read -r -p 'Host del laboratorio: ' TC_PGHOST
read -r -p 'Puerto del laboratorio: ' TC_PGPORT
read -r -p 'Usuario dueño del laboratorio: ' TC_PGUSER
export TC_PGHOST TC_PGPORT TC_PGUSER
export TC_DB_PREFIX=tablero_008_lab_revision01
```

No ejecutar hasta seleccionar ese servidor de laboratorio. El bootstrap crea
roles `anon`, `authenticated`, `service_role` si faltan, simula `auth.uid()/jwt()`
y aplica las migraciones ordenadas hasta 008. No cambia roles existentes. Debe
ser un laboratorio reservado para este contrato.

## Revisar SQL sin servidor

```bash
node tests/postgres-008/run-case.mjs --emit-only /tmp/008-start-AB start-start AB
node tests/postgres-008/run-case.mjs --emit-only /tmp/008-start-BA start-start BA
```

Cada directorio contiene:

1. `00-fixture.sql`: preparación con sus propios BEGIN/COMMIT.
2. `01-setup.sql`: sello y reloj previo cuando corresponde.
3. `02-A.sql` y `03-B.sql`: JWT sub/aal, rol, BEGIN y llamada concreta.
4. `04-first-commit.sql`: espera ART cuando corresponde, luego COMMIT.
5. `05-second-commit.sql`: COMMIT del segundo participante.
6. `06-verify.sql`: DO/asserts que generan excepción ante resultado incorrecto.
7. `07-rollback.sql`: ROLLBACK ante interrupción o fallo inesperado.

`ORDER.txt` identifica la conexión que inicia primero. Las llamadas que deben
fallar usan un bloque EXCEPTION que sólo acepta el mensaje esperado y revierte
la RPC dentro de una subtransacción. Un éxito inesperado u otro error hacen fallar
el script. No se acepta un proceso verde sin resultado comprobado.

## Ejecutar en el futuro

```bash
node tests/postgres-008/run-case.mjs --run /tmp/008-start-AB start-start AB
node tests/postgres-008/run-case.mjs --run /tmp/008-start-BA start-start BA
```

AB crea `tablero_008_lab_revision01_start_start_ab`; BA crea otra base. No se cambia
Sites ni se conecta el frontend. El runner:

1. Ejecuta fixture/setup como dueño de esa base.
2. Abre A/B distintas con `application_name` distinto, JWT/rol explícitos y BEGIN
   abierto en la primera.
3. Dispara la segunda y comprueba mediante una tercera conexión que
   `pg_stat_activity.wait_event_type='Lock'`. Si no observa espera, **falla**.
4. Confirma primera, espera resolución de segunda y confirma ésta. Los errores
   esperados ya revirtieron su llamada mediante subtransacción.
5. Ejecuta DO/asserts como dueño y registra versión, SQL/logs y resultado.
   Ante otro fallo cierra A/B con ROLLBACK. Una espera excedida es fallo.

### Ejecución manual equivalente

Preparada la misma base, abrir **dos terminales interactivas**. No ejecutar un
archivo que deja BEGIN abierto mediante `psql -f`, que cerraría la conexión:

```bash
export TC_DATABASE=tablero_008_lab_revision01_start_start_ab
psql --host "$TC_PGHOST" --port "$TC_PGPORT" --username "$TC_PGUSER" \
  --dbname "$TC_DATABASE" -X --no-password -v ON_ERROR_STOP=1
```

En A: `\i /tmp/008-start-AB/02-A.sql`; mantener BEGIN abierto.
En B: `\i /tmp/008-start-AB/03-B.sql`; debe quedar esperando.
En un observador con los mismos cuatro parámetros:

```sql
select pid,application_name,wait_event_type,wait_event
from pg_stat_activity where datname=current_database() and state='active';
```

Luego A: `\i /tmp/008-start-AB/04-first-commit.sql`; cuando B termine,
B: `\i /tmp/008-start-AB/05-second-commit.sql`. Observador:
`\i /tmp/008-start-AB/06-verify.sql`. Para BA invertir primera/segunda según
ORDER.txt, en **otra base recién creada y migrada**. Ante error inesperado,
ROLLBACK; no continuar como si el caso hubiera pasado.

## Matriz de escenarios y asserts

Todos tienen SQL completo A/B para AB y BA. Los UUID concretos de jefe/titular/
reemplazante/encargado terminan en `008000001/2/3/4`, con prefijo `10000000`;
tareas A/B/anterior tienen prefijo `50000000` y sufijos `008000001/2/3`.
Cobertura sólo habilita A, hasta medianoche ART posterior al día de fixture.

| Escenario | A / B | Resultado comprobado por orden |
| --- | --- | --- |
| `start-start` | Titular inicia A / inicia B, sin switch | Gana primera; segunda rechazada; una sesión, revisión y receipt; otra tarea idéntica |
| `start-switch` | Inicia A / inicia B, segunda con switch | Sólo última abierta; origen revisión 2, destino 1; dos sesiones/receipts, un audit de switch |
| `switch-pause` | Switch A→B / pausa A | Reloj A sembrado; ambos órdenes conservan fin; A revisión 2, B 1; una abierta, tres receipts |
| `checklist-pause` | Último control B / pausa A | B completo sin reloj; no hereda tiempo de A; dos revisiones propias, tres receipts |
| `close-start` | Jefe aal2 cierra mes / titular inicia A | Cierre primero rechaza inicio; inicio primero rechaza cierre sin reporte/cola; nunca cierre con reloj abierto |
| `close-switch` | Cierra mes / switch desde tarea del mes anterior | Cierre primero preserva origen anterior abierto; switch primero rechaza cierre y sólo destino queda abierto |
| `cancel-start` | Jefe cancela / reemplazante inicia A | Cancelación primero deniega inicio; inicio primero luego termina al corte efectivo; revisiones/receipts/audits exactos |
| `permission-start` | Retira membresía de encargado bajo owner guard / encargado inicia A | Retiro primero exige revalidación y rechazo íntegro; inicio primero conserva historia; no existe RPC productiva de retiro |
| `expiry-wait` | Sostiene owner guard hasta corte ART real / jefe aal2 pone en espera | Corte primero: expiración y espera usan fin exacto; espera primero: fin previo y sin expiración redundante; revisión única |
| `company-seal` | Sella ausencia / inserta empresa B | Sello primero deniega INSERT; INSERT primero integra B antes del sello; acceso A y B sólo en segundo caso |
| `replay-exact` | Misma operación/argumentos / replay | Dos retornos iguales al UUID original; una sesión, revisión y receipt; sin eventos extra |
| `replay-different` | Mismo UUID con destino A / con destino B | Sólo primera válida; segunda error específico; retorno ganador y ningún efecto de perdedora |

Todos verifican también: un reloj por actor/tarea, tiempos no negativos, ningún
reloj abierto en cierre, un reporte/delivery/outbox por cierre, contexto de audit
igual a su sesión y helper privado sin EXECUTE cliente. Los upgrades locales
comparan snapshots textuales; este ensayo no reemplaza esas pruebas.

Para emitir toda la matriz **salvo corte real ART**:

```bash
for TC_CASE in start-start start-switch switch-pause checklist-pause close-start close-switch cancel-start permission-start company-seal replay-exact replay-different; do
  for TC_ORDER in AB BA; do
    node tests/postgres-008/run-case.mjs --emit-only "/tmp/008-${TC_CASE}-${TC_ORDER}" "$TC_CASE" "$TC_ORDER"
  done
done
```

Revisar SQL emitido. Sustituir `--emit-only` por `--run` únicamente en el futuro
laboratorio seleccionado. Cada combinación crea una base distinta.

### Corte ART real

`expiry-wait` no altera el reloj ni edita una ausencia aprobada. La espera exige
que la próxima medianoche ART esté a **120 segundos o menos** y aún sea futura;
fuera de la ventana falla. Ejecutar AB/BA en bases separadas cerca del mismo corte
(dos procesos) o en dos noches distintas con prefijos nuevos. La fixture usa
fecha ART incluso si el servidor tiene otro TZ.

```bash
node tests/postgres-008/run-case.mjs --emit-only /tmp/008-expiry-AB expiry-wait AB
node tests/postgres-008/run-case.mjs --emit-only /tmp/008-expiry-BA expiry-wait BA
```

AB usa al jefe aal2 como actor B, sostiene owner guard, verifica B esperando y
recién entonces espera al corte antes de COMMIT. BA ejecuta espera como jefe aal2
antes del corte, libera A y A cruza el corte sin reescribir la sesión finalizada.
Una inyección local no equivale a este caso.

La aceptación local secuencial ejecuta setup y B de BA sin `pg_sleep`; verifica
sesión, revisión, actor, MFA, receipt, audit y replay idempotente. Son 23 casos
secuenciales PGlite. Este caso no prueba la espera ni la carrera.

## Registro requerido

**23 verificaciones locales secuenciales; 24 combinaciones preparadas y ninguna
ejecutada en PostgreSQL.** Para cambiar
estado conservar por combinación: SHA, versión PostgreSQL, servidor de laboratorio,
orden, SQL emitido, evidencia de espera, logs A/B/observador, RESULT.json, asserts
y repetición desde base limpia. Revisar con Sol alto antes de aprobar. Integración
Supabase/Auth/MFA/correo y migración de empleados siguen pendientes aunque pase.
