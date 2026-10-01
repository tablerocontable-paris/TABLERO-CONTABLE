# Validación PostgreSQL de cronómetros y coberturas

**Estado: NO EJECUTADO.** La suite local usa PGlite y no comprueba bloqueos,
interbloqueos ni carreras de PostgreSQL con dos conexiones. Este procedimiento
es para una base descartable, jamás para producción ni para datos de empleados.
Revisión y contratos: `docs/architecture/REVIEW-006-20261001.md`,
`docs/architecture/TIME-COVERAGE-007-ACCEPTANCE.md` y
`docs/architecture/TIME-COVERAGE-008-ACCEPTANCE.md`.

## Preparar el laboratorio

Instalar PostgreSQL local de una versión soportada por Supabase. Crear una base
vacía y ejecutar como dueño PostgreSQL. No apuntar la URL a Supabase:

~~~sh
createdb tablero_cobertura_008_lab
export TIME_COVERAGE_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/tablero_cobertura_008_lab'
psql "$TIME_COVERAGE_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid(),auth.jwt() to authenticated;
SQL
for migration_path in supabase/migrations/*.sql; do
  psql "$TIME_COVERAGE_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration_path"
done
psql "$TIME_COVERAGE_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/review/time-coverage-007-postgres-fixture.sql
~~~

El loop debe aplicar también `202610010008_time_coverage_finalization.sql` en
último lugar. Los UUID de la fixture 007 sirven para los ensayos de carrera; para
cada repetición se restaura la base vacía. La prueba local de 008 vive en
`tests/time-coverage-008.test.ts` y no reemplaza la fixture PostgreSQL.

El fixture crea jefe, titular, reemplazante, dos empresas, dos tareas y una
cobertura limitada a Empresa A con UUID fijo
60000000-0000-0000-0000-000007000001. El período es el mes actual. Cada repetición requiere
recrear la base vacía para no heredar cierres ni cronómetros.

Cada terminal psql debe ser una conexión distinta. Antes de operar, configurar el
JWT y el rol de esa conexión:

~~~sql
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000007000002',false);
select set_config('request.jwt.claims','{"aal":"aal1"}',false);
set role authenticated;
~~~

Para jefe MFA, usar el UUID 10000000-0000-0000-0000-000007000001 y
claims {"aal":"aal2"}. Para ejecutar controles como administrador de laboratorio,
usar reset role. No reutilizar JWT de otro actor.

## Mismo actor intenta iniciar dos tareas

Terminal A, titular:

~~~sql
begin;
select public.start_task_timer(
 '50000000-0000-0000-0000-000007000001',0,
 '90000000-0000-0000-0000-000007000011',false
);
~~~

Mantener A abierta. Terminal B, con el mismo JWT, intenta iniciar Empresa B:

~~~sql
begin;
select public.start_task_timer(
 '50000000-0000-0000-0000-000007000002',0,
 '90000000-0000-0000-0000-000007000012',false
);
~~~

B debe esperar el guard del actor. Confirmar A; B debe fallar sin abrir segundo
reloj ni cambiar revisiones. Ejecutar rollback en B. Repetir desde base limpia con
true como cuarto argumento de B: el switch debe finalizar origen e iniciar destino
en una unidad. Consultar:

~~~sql
select actor_id,instance_id,started_at,ended_at from public.task_time_sessions
 where actor_id='10000000-0000-0000-0000-000007000002' order by started_at,id;
select id,status,state_revision from public.task_instances
 where id in ('50000000-0000-0000-0000-000007000001',
              '50000000-0000-0000-0000-000007000002') order by id;
~~~

Sólo destino debe quedar abierto. Repetir invirtiendo qué conexión obtiene primero
el guard.

## Inicio frente a cierre mensual

En base limpia, terminal A inicia Empresa A con operación
90000000-0000-0000-0000-000007000021 y deja la transacción sin confirmar. Terminal
B usa JWT de jefe MFA:

~~~sql
begin;
select public.close_employee_month(
 '10000000-0000-0000-0000-000007000002',
 date_trunc('month',current_date)::date,
 'Cierre sintético de concurrencia'
);
~~~

Dejar que ambas consultas se resuelvan y confirmar primero la que ganó. Si gana
inicio, cierre falla por reloj abierto. Si gana cierre, inicio falla por mes
cerrado. Nunca debe haber cierre con reloj abierto ni reloj nuevo posterior al
cierre. Comprobar:

~~~sql
select c.id,count(*) filter(where s.ended_at is null) open_sessions
from public.monthly_closures c
left join public.task_instances t on t.owner_id=c.owner_id and t.period=c.period
left join public.task_time_sessions s on s.instance_id=t.id
where c.owner_id='10000000-0000-0000-0000-000007000002'
 and c.period=date_trunc('month',current_date)::date
group by c.id;
~~~

## Cancelación frente a inicio de cobertura

Usar base limpia. Terminal A,
reemplazante, inicia Empresa A con operación
90000000-0000-0000-0000-000007000031 y deja abierta la transacción. Terminal B,
jefe MFA, comienza cancelación:

~~~sql
begin;
select public.cancel_employee_absence(
 '60000000-0000-0000-0000-000007000001','Prueba de concurrencia',
 '90000000-0000-0000-0000-000007000032'
);
~~~

Mantener la primera transacción abierta hasta que la otra consulte y espere el
guard. Probar ambos órdenes en bases limpias:

- Si confirma primero la cancelación, el inicio del reemplazante falla por
  cobertura cancelada; no queda sesión ni receipt de inicio.
- Si confirma primero el inicio, cancelación espera, conserva cutoff y finaliza
  sesión en el mínimo entre operación, fin ART y cutoff. Revisión avanza una vez.
  Auditorías comparten at de operación y guardan el fin efectivo.
- Repetir cancelación con clave nueva no modifica sesión, tarea, motivo, cutoff ni
  cantidad de eventos.

Comprobar corte y auditoría:

~~~sql
select a.cancelled_at,s.started_at,s.ended_at,
       ((a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires') expiry
from public.employee_absences a
join public.task_time_sessions s on s.absence_id=a.id
where a.note='Cobertura sintética de PostgreSQL';
select action,at,entity_id,details from public.audit_events
where action in ('absence.cancelled','absence.session_stopped','task.timer_expired')
order by id;
~~~

## Comprobaciones locales específicas de 008

En una base desechable recién migrada, verificar que las funciones públicas
conservan sus permisos y que el helper temporal sigue sin ejecución directa para
clientes:

~~~sql
select has_function_privilege('anon','public._can_access_instance_at(uuid,timestamptz)','execute') as anon_can_call,
       has_function_privilege('authenticated','public._can_access_instance_at(uuid,timestamptz)','execute') as client_can_call,
       has_function_privilege('authenticated','public.can_cover_instance(uuid)','execute') as client_can_cover;
~~~

Los dos primeros resultados deben ser `false` y el tercero `true`. Para probar
un control de checklist repetido con un reloj propio en el período anterior,
cerrado, preparar el origen y el destino de la prueba en la base aislada, repetir
el valor ya guardado con su revisión actual y confirmar que queda el mismo reloj,
una sola revisión sin cambios y un receipt. No se debe ejecutar esta operación
contra tareas reales.

La fixture automatizada también compara el contexto de una sesión vencida en los
eventos `task.timer_expired` y `task.wait`. PGlite valida resultados y permisos,
pero no identidad cambiada entre conexiones mientras una transacción espera un
bloqueo. Ese punto requiere completar los escenarios A/B de esta guía en
PostgreSQL real antes de habilitar migraciones de empleados.

## Locks restantes y permisos

Ejecutar con transacciones separadas e invertir orden A/B:

- pausa propia frente a checklist/transición en la misma tarea;
- checklist que completa resultado mientras existe otro reloj propio;
- cierre frente a inicio con switch;
- retiro de acceso permanente mientras una RPC espera owner guard;
- inserción de empresa autorizada frente al sellado de ausencia;
- replay simultáneo de receipt y UUID reutilizado con argumentos distintos.

Empresa B no pertenece a cobertura del reemplazante; su inicio debe fallar sin
receipt ni sesión. Jefe fuera de organización y encargado fuera de jerarquía no
pueden interrumpir el reloj. El titular puede desbloquear conservándolo, sin MFA
porque no pausa al ejecutor. Pausa sobre una sesión terminada admite receipt
escalar después del cierre mensual; una sesión abierta en mes cerrado falla intacta.

En cada carrera verificar estado, revisión, sesiones, ausencias, auditorías y
receipts. No debe haber deadlock, duplicados, fin anterior al inicio, estado
parcial, evento repetido ni sesión en snapshot ya cerrado.

## Registro

No cambiar NO EJECUTADO hasta guardar logs de PostgreSQL real: versión, sistema,
conexiones A/B, comandos, resultado de cada orden, consultas finales y cantidad de
repeticiones. PGlite no es una prueba de concurrencia. Nunca usar base productiva.
