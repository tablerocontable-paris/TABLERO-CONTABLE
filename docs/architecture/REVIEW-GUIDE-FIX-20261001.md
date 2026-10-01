# Revisión de corrección de guía — v28

Fuente revisada: `f916d1b2bb567f133a7c51d4559b3cfaffee1c07`, Sites privado v28.
Fecha: 01/10/2026. Decisión: **actor R008-F01 corregido y aceptado localmente**.
La revisión no aprueba concurrencia, Auth/MFA real ni producción.

## Evidencia y límites

- `expiry-wait` usa jefe con aal2 como B en AB y BA. La operación, titular,
  reemplazante, owner guard y corte ART permanecen iguales.
- El checker ejecuta únicamente setup/B de BA; no A, afterFirst ni pg_sleep.
  Se volvió a ejecutar y pasa: 23 casos secuenciales. Continúan 24 pares reales
  preparados, sin ejecutar en PostgreSQL.
- Captura el escalar de la primera llamada dentro del DO, sin otra RPC de inicio.
  Retorna revisión 2. La repetición conserva argumentos/clave y retorna 2; filas
  de tareas, sesiones, auditoría y receipts se comparan antes/después.
- El fin de la sesión original queda antes del corte y el inicio se conserva.
  Auditoría compara sesión, ejecutor, ausencia y timestamps con la fila real.
- Diff de v28 contra su padre: frontend, migraciones y diagnósticos históricos
  sin cambios. La publicación registra el mismo SHA; acceso sigue sólo del dueño.
- El 40% de PROJECT-STATUS es una estimación de planificación: 38,75% ponderado,
  redondeado, margen 35–45%. Las etapas y los pesos son estimaciones, no mediciones
  de esfuerzo restante ni un porcentaje de empleados migrables.

Gates de esta revisión: npm test 151/13 y build pasan. Evidencia nueva con SHA
revisado y hashes del checker/renderer:
`review-evidence/time-coverage-guide-review-20261001.json`.

## Comprobaciones explícitas a completar

El comportamiento del actor ya está corregido. Antes de dar por completa toda la
aceptación de guía, ampliar el checker con:

1. JWT/aal2/rol comprobados **dentro del B renderizado**, después de su login.
   El checker actual comprueba un login manual anterior; audit/receipt y la RPC
   prueban el jefe/MFA en la operación, pero la assertion de identidad es indirecta.
2. `blocked_by='Synthetic wait'`, exactamente una sesión total, y cero abiertas.
3. Receipt de seed con actor reemplazante y `start_timer`, además del receipt
   `task_wait` del jefe. Comparar el ID de sesión guardado por seed con la fila.

Se incluyen estos puntos como primer paso de la próxima ejecución, junto con la
fundación del adaptador. No requieren cambios de SQL ni otra migración.

## Próximo bloque

Contrato cerrado: `DATA-ADAPTER-FOUNDATION.md`. Luna medio, Standard.
Después revisión Sol 6.1 medio del adaptador; decisiones futuras de autenticación,
bootstrap de administración o nuevas RPC requieren revisión Sol alto.
