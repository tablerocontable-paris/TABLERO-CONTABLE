# Validación PostgreSQL real: cobertura, cronómetro y cierre

Estado: **NO EJECUTADO**. PGlite valida las funciones y restricciones en una
conexión, pero no demuestra el orden de locks entre sesiones PostgreSQL. No hay
una base de integración conectada en este proyecto. Ejecutar en una base local
descartable que tenga las migraciones 001–004 y dos sesiones `psql`; no ejecutar
contra producción.

Antes de probar, preparar dos tareas de octubre para la misma persona y empresa,
un reemplazante con membresía explícita, una ausencia autorizada, y un usuario
jefe MFA. Use un UUID de operación distinto en cada llamada.

## Dos actores inician la misma tarea

Sesión A y B, al mismo tiempo:

```sql
select start_task_timer('<instancia>', 0, '<uuid-operacion-A>', false);
select start_task_timer('<instancia>', 0, '<uuid-operacion-B>', false);
```

Resultado esperado: una sola llamada crea el cronómetro; la otra recibe conflicto
por tarea ocupada o revisión obsoleta. Verificar una única sesión abierta para
esa instancia y una única transición de estado.

## Un actor inicia dos tareas

Sesión A ejecuta ambos comandos casi simultáneamente, con revisiones actuales:

```sql
select start_task_timer('<instancia-A>', 0, '<uuid-operacion-C>', false);
select start_task_timer('<instancia-B>', 0, '<uuid-operacion-D>', false);
```

Resultado esperado: sólo una sesión abierta para ese actor. La segunda operación
debe fallar sin dejar una tarea a medio iniciar. Repetir con `p_switch=true` y
verificar que la sesión origen se pausa sólo si el inicio de destino tiene éxito.

## Cierre contra inicio

Con empleado A y jefe B iniciar `start_task_timer` en paralelo con
`close_employee_month` para el mismo empleado y mes.

Resultado esperado: si gana el cierre, el inicio falla por mes cerrado; si gana
el inicio, el cierre falla por cronómetro activo. No debe existir cierre que
contenga una sesión abierta ni inicio posterior a un cierre confirmado.

## Cancelación contra inicio de cobertura

Con encargado A cancelar la autorización y reemplazante B iniciar una tarea
cubierta en paralelo.

Resultado esperado: si gana cancelación, inicio no autorizado; si gana inicio,
cancelación termina la sesión en `cancelled_at`. En ambos órdenes verificar que
el reloj no cuente más allá del límite y que el usuario de cobertura no pueda
consultar el perfil del titular.

## Aprobación

La validación sólo se acepta cuando cada carrera da uno de los resultados
atómicos descritos en repeticiones suficientes y consultas de control no
encuentran duplicados, sesiones abiertas sin permiso o cierres inconsistentes.
Registrar versión PostgreSQL, comandos/resultados sin datos personales y fecha
en este documento al ejecutarla. No marcar como aprobada basándose en PGlite.
