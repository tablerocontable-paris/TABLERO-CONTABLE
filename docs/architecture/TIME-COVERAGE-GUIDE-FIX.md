# Corrección cerrada de guía 008 — R008-F01

Modelo de ejecución: **GPT-6 Luna, medio, Standard**. Fuente revisada:
`bdb87e235e3871d1f6f3d712834812fb78b3a48c`, Sites v26.
Revisión: `REVIEW-008-FINAL-20261001.md`. Sólo guía/aceptación; SQL 001–008,
frontend, firmas y permisos productivos permanecen sin cambios.

## Implementación

1. En `tests/postgres-008/scenarios.mjs`, rama expiry-wait, crear B con
   `step(boss, llamada_existente, null, true)`. Ambos órdenes usan jefe aal2.
   Conservar titular/executor, operación, owner guard, fixture y límites reales
   ART. No alterar permisos para permitir al empleado detener al compañero.
2. Extender `tests/postgres-008/check-sql.mjs` con un caso adicional explícito
   `expiry-wait BA before cutoff, sequential only`. Base/rollback aislado como
   los otros casos. Ejecutar **únicamente setup y B** del renderer corregido;
   nunca A/afterFirst ni pg_sleep. Así comprueba la rama previa al corte, no
   simula la carrera ni el corte real. Seguir sin ejecutar PostgreSQL.
3. Assert de JWT sub jefe, aal2 y role authenticated en B. Antes de operar,
   comprobar que la sesión está vigente y que clock_timestamp precede al corte;
   si cruzó el día, recrear fixture, no aceptar otra rama. Guardar ID/inicio.
4. Ejecutar B y su verify BA. Comprobar: revisión 2, motivo Synthetic wait,
   sesión original cerrada con started_at intacto y ended_at anterior al corte;
   un task.wait con session/executor/absence/start/end iguales a la sesión real;
   cero timer_expired; dos receipts (seed peer y wait jefe), sin sesión adicional.
   Capturar el valor retornado de la llamada y comparar revisión 2, sin duplicar
   operación. Repetir la misma clave debe preservar estado/audits y retornar 2.
5. Resultado del checker: **23 casos secuenciales** — 22 existentes y una rama
   previa al corte. Concurrencia PostgreSQL y límite ART real: NO EJECUTADO.
   Emitir SQL AB y BA con --emit-only y verificar que ambos usan jefe/aal2.
6. Actualizar guía: B es jefe MFA, no empleado; diferenciar 23 verificaciones
   secuenciales de 24 pares PostgreSQL preparados. No cambiar la protección del
   ejecutor ni publicar el procedimiento como ya ejecutado.

## Entrega y siguiente modelo

Preservar los bytes de SQL 001–008 y todos los probes/evidencias anteriores,
incluidos el diagnóstico original y su salida de esta revisión. Guardar evidencia
nueva con otro nombre; no sobrescribir completion-validation ni final-review.

Ejecutar checker, emisión AB/BA, npm test, npm run build y diff-check. Comparar
archivos preservados con HEAD revisado. Registrar cambios, número real de casos
y límites; commit/push y Sites privado del mismo SHA. Después revisión
**GPT-6.1 Sol medio**, con cambio manual; basta «continuá».

No instalar motor, ejecutar --run, aplicar SQL remoto, crear servicios, migrar
empleados, conectar frontend ni enviar correo. Integración se prepara después
de cerrar esta corrección, sin agregar otra ronda de cambios de SQL innecesaria.
