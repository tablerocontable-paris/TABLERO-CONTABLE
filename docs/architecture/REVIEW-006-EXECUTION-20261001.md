# Ejecución local de 006 — 01/10/2026

## Resultado para revisión

Se agregó `supabase/migrations/202610010006_time_coverage_acceptance.sql` como
migración transaccional nueva. Las migraciones 001–005 y el probe congelado de 005
no se modifican. Se reforzó el preflight de sesiones y reaperturas, se sellan las
autorizaciones de ausencia luego de insertar sus empresas y se bloquean cambios de
identidad o borrado de sesiones históricas. Se corrigieron las rutas de checklist,
espera, cronómetro, transición y cierre para mantener revisión, corte ART y
auditoría explícita.

Se aislaron fixtures del conjunto anterior que compartían ocurrencias/sesiones y se
quitó una edición directa de hora de sesión ya finalizada. La suite propia 006 carga
su esquema desde cero y actualmente cubre cinco casos: control operativo final,
resultado de un solo control, misma espera con reloj, rechazo de sesión tras
cancelación y limpieza/auditoría de reloj de cobertura vencido.

## Comprobaciones

- Suite completa: **58 pruebas en 7 archivos**, todas aprobadas.
- `npm run build`: aprobado; TypeScript y Vite finalizaron correctamente.
- `git diff --check`: aprobado.
- PostgreSQL con dos conexiones, prueba real de locks/deadlocks: **NO EJECUTADA**.
- Upgrade real de 004/005 a 006 con comparación de snapshots y aborto preflight:
  pendiente de fixture ejecutable independiente.
- Supabase Auth, MFA, RLS e integración real: pendiente.
- El envío de reportes sigue como cola/outbox automática; proveedor de email y
  entrega externa están pendientes.
- El diagnóstico congelado de 005 continúa mostrando sus seis violaciones de
  contrato. Ese script reproduce 005 a propósito; la suite 006 ejercita parte de
  esas rutas en el esquema nuevo y no reemplaza todavía cada probe por un assert
  individual de upgrade.

## Alcance de la aprobación

Esto es evidencia de ejecución PGlite local, no una aprobación de arquitectura ni
de producción. Sol 6.1 (alto) debe revisar 006, el preflight, el orden de locks y el
aislamiento antes de ampliar el alcance. No ejecutar SQL remoto ni migrar empleados.
