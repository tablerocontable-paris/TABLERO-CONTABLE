# Validación real PostgreSQL: cobertura, cronómetro y cierre

**Advertencia de revisión 005:** esta guía aún es un borrador, no un harness
ejecutable. Falta fixture concreto y separar bloques de dos conexiones. La
corrección se exige en `../architecture/TIME-COVERAGE-006-ACCEPTANCE.md`; no tomar
las 53 pruebas locales como aprobación de concurrencia ni de contrato completo.

Estado: **NO EJECUTADO**. `npm test` usa PGlite, una sola conexión emulada. No
verifica interbloqueos, Auth/RLS/MFA reales ni carreras PostgreSQL. En este
entorno no están instalados `psql` ni `postgres`, y no hay una base de integración.
Esta guía es para una base local descartable con las migraciones **001–005**; no
ejecutar en producción ni en Supabase de empleados.

La ejecución local 005 tiene 53 pruebas aprobadas, incluido el fixture de upgrade
0.3→005 que conserva un snapshot/cierre, un reporte/outbox y una reapertura con
referencia auditada. Eso no sustituye las pruebas de dos conexiones de abajo.

## Preparación aislada

Crear dos actores, dos tareas pendientes del mismo titular y período, un reemplazante
con membresía explícita, una ausencia autorizada y un jefe con MFA. Usar un email de
prueba y UUID de operación diferentes para cada llamada. En cada conexión autenticada
configurar JWT local con `request.jwt.claim.sub` y `request.jwt.claims` (`aal1` o
`aal2`) según el rol; nunca reutilizar datos personales/productivos.

Las consultas `SELECT` de control siguientes se ejecutan como rol de laboratorio;
las mutaciones como `authenticated`. Guardar logs con IDs ficticios y resultados.

## Dos actores intentan la misma tarea

Conexión A y B, al mismo tiempo, cada una con su propio UUID de operación:

```sql
-- A
begin;
select start_task_timer('<instancia>', 0, '<uuid-operacion-A>', false);
-- mantener abierta la transacción

-- B
begin;
select start_task_timer('<instancia>', 0, '<uuid-operacion-B>', false);
```

Confirmar A y después B. Debe existir una sola sesión abierta; B devuelve conflicto
por estado/revisión o tarea ocupada, sin dejar cambios parciales:

```sql
select count(*) from task_time_sessions
 where instance_id='<instancia>' and ended_at is null;
select status,state_revision from task_instances where id='<instancia>';
```

## Un actor intenta iniciar dos tareas

Ejecutar en dos conexiones bajo el mismo actor, dejando A sin confirmar:

```sql
-- A                         -- B
begin;                        begin;
select start_task_timer(      select start_task_timer(
 '<instancia-A>',0,'<op-A>',false); '<instancia-B>',0,'<op-B>',false);
```

Una sola llamada puede dejar reloj abierto. Repetir con B `p_switch=true`: el
cambio debe cerrar el origen e iniciar destino como una unidad. Forzar un destino
inválido debe revertir el cierre del origen. Consultar sesiones y ambas revisiones.

## Inicio frente a cierre del mes

Empleado A inicia una sesión mientras jefe MFA B llama
`close_employee_month('<titular>','<periodo-primer-dia>','Revisión de prueba')`.
Si gana el cierre, inicio falla por período cerrado; si gana el inicio, el cierre
falla por sesión activa. Nunca debe haber cierre con un reloj abierto ni inicio
posterior a cierre confirmado:

```sql
select c.id, count(*) filter(where s.ended_at is null) as open_sessions
from monthly_closures c
left join task_instances t on t.owner_id=c.owner_id and t.period=c.period
left join task_time_sessions s on s.instance_id=t.id
where c.owner_id='<titular>' and c.period='<periodo-primer-dia>'
group by c.id;
```

Resultado esperado: `open_sessions = 0`; snapshot e instancia no cambian después.

## Cancelación frente a inicio de cobertura

Encargado MFA A cancela una ausencia mientras reemplazante B intenta iniciar una
tarea de una empresa y período autorizados. Probar ambos órdenes manteniendo abierta
la primera transacción hasta que la segunda espere el guard `work-owner:`.

- Si gana cancelación: inicio falla por falta de cobertura.
- Si gana inicio: cancelación espera, limita ended_at al mínimo entre cancelación
  y fin ART, incrementa revisión y audita actor/ejecutor/tarea/sesión/motivo.
- Un mes cerrado con sesión abierta produce rollback íntegro.
- Repetir cancelación con nueva clave conserva `cancelled_at` y no duplica auditoría.

Verificar corte y único evento:

```sql
select s.started_at,s.ended_at,a.ends_on,a.cancelled_at,
       (a.ends_on+1)::timestamp at time zone 'America/Argentina/Buenos_Aires' as expiry
from task_time_sessions s join employee_absences a on a.id=s.absence_id
where a.id='<ausencia>';
select action,count(*) from audit_events where entity_id='<ausencia>'
 group by action;
```

## Orden de locks adicional

Probar también en conexiones separadas:

- pausa vs finalización/checklist de la misma tarea;
- transición/wait vs switch del mismo ejecutor;
- inicio mientras aprobación de ausencia toma owner guard;
- cancelación con dos períodos abiertos (meses, instancias y sesiones en orden);
- replay simultáneo de la misma clave receipt y rechazo de clave reutilizada con
  argumentos distintos.

Cada carrera se repite invirtiendo cuál transacción obtiene primero el guard.
Verificar que no haya deadlock, duplicados, medio switch, fin previo a inicio,
sesión abierta en snapshot, revisión perdida ni operación inválida que deje receipt.

## Aprobación

Registrar versión exacta de PostgreSQL, comandos/resultados sin datos personales,
fecha, cantidad de repeticiones y consultas de control en este documento. Mantener
el estado **NO EJECUTADO** hasta realizar las carreras en PostgreSQL real. No marcar
005 como aprobada, no conectar frontend y no migrar empleados basándose sólo en
PGlite, build o despliegue de Sites.
