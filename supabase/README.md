# Nueva base: esquema y flujos, sin conexión remota

migrations/ es la única fuente de esquema. Las migraciones 001–010 se prueban desde vacío con PostgreSQL PGlite, roles anon/authenticated y stubs de auth.uid()/auth.jwt(). No se aplicaron en Supabase; las pruebas no cubren sus servicios Auth/Storage.

Implementado: organización/empresa/perfiles/equipos/membresías; catálogo/asignaciones/instancias; registros/inducción/cierres/auditoría; RLS de SELECT y DML directo denegado. RPC de transición, checklist automático, actividad, progreso de inducción, asignación desde catálogo, materialización idempotente por fecha de ocurrencia (única, diaria, semanal o mensual), catálogo versionado e inmutable; alta y cambio de peso reservados a jefe con MFA aal2 y cierre con snapshot calculado por servidor. Las escrituras y el cierre usan el mismo bloqueo transaccional del período. Un cierre de encargado exige acceso a todas las empresas del mes.

También implementado y probado localmente: aprobación transaccional e idempotente de inducción, cronómetro, cobertura 008 por empresa/período, cierre con reporte snapshot y outbox, lector y gateway con contratos estrictos. El consumidor de correo es de prueba. Estas capacidades no están conectadas a la página ni a servicios remotos.

Pendiente antes de conectar: bootstrap administrativo, invitaciones y Auth/MFA real, coordinación B2 por ocurrencia y selección de cobertura, administración jerárquica y bajas/huérfanas, integración frontend, agenda y notificaciones, entrega de correo productiva, Storage/evidencia, recuperación y pruebas de integración Supabase. Ejecutar las carreras preparadas en PostgreSQL real; PGlite no sustituye esa validación. No habilitar DML directo como atajo.

Cuando se acepte la versión definitiva, crear un Supabase nuevo y aplicar migraciones en orden en desarrollo. No crear servicios ahora ni ejecutar contra legacy. Una migración aplicada no se reescribe: agregar otra y verificar desde cero y actualización. La app actual usa datos locales, no estas RPC.


B1/009 (`202610020009_private_block_notes.sql`) añade comentarios privados separados, su historial y RPC local. La revisión independiente de Sol reparó cancelación del wrapper, respuestas incompletas y normalización de texto. Aceptada localmente con PGlite; pendientes PostgreSQL concurrente real e integración Auth/UI. No se aplicó a Supabase remoto.

B2a/010 ejecutado y revisado independientemente localmente: responsabilidad versionada, selección staged, sellado, backfill/fallback y tipos; no activa permisos, relojes o KPI. Evidencia en `docs/architecture/COORDINATION-010-IMPLEMENTATION-20261004.md` y `docs/architecture/COORDINATION-010-REVIEW-20261004.md`. La activación011 está pausada antes de SQL para corregir el orden de locks de RPC heredadas; ver `docs/architecture/COORDINATION-011-LOCK-REVIEW-20261004.md`. No se aplicó ninguna migración a Supabase remoto.
