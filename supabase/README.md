# Nueva base: esquema y flujos, sin conexión remota

migrations/ es la única fuente de esquema. Las migraciones 001–011 se prueban localmente desde vacío con PostgreSQL PGlite, roles anon/authenticated y stubs de auth.uid()/auth.jwt(); 011 se completó en laboratorio con reporte v4 y writers coordinados. No se aplicaron en Supabase; las pruebas no cubren sus servicios Auth/Storage.

Implementado: organización/empresa/perfiles/equipos/membresías; catálogo/asignaciones/instancias; registros/inducción/cierres/auditoría; RLS de SELECT y DML directo denegado. RPC de transición, checklist automático, actividad, progreso de inducción, asignación desde catálogo, materialización idempotente por fecha de ocurrencia (única, diaria, semanal o mensual), catálogo versionado e inmutable; alta y cambio de peso reservados a jefe con MFA aal2 y cierre con snapshot calculado por servidor. Las escrituras y el cierre usan el mismo bloqueo transaccional del período. Un cierre de encargado exige acceso a todas las empresas del mes.

También implementado y probado localmente: aprobación transaccional e idempotente de inducción, cronómetro, cobertura 008 por empresa/período, cierre con reporte snapshot y outbox, lector y gateway con contratos estrictos. El consumidor de correo es de prueba. Estas capacidades no están conectadas a la página ni a servicios remotos.

Pendiente antes de conectar: bootstrap administrativo, invitaciones y Auth/MFA real, administración jerárquica y bajas/huérfanas, integración frontend, agenda y notificaciones, entrega de correo productiva, Storage/evidencia, recuperación y pruebas de integración Supabase. La matriz local de 26 carreras ya fue ejecutada en PostgreSQL 17.11; falta integración con servicios reales. No habilitar DML directo como atajo.

Cuando se acepte la versión definitiva, crear un Supabase nuevo y aplicar migraciones en orden en desarrollo. No crear servicios ahora ni ejecutar contra legacy. Una migración aplicada no se reescribe: agregar otra y verificar desde cero y actualización. La app actual usa datos locales, no estas RPC.


B1/009 (`202610020009_private_block_notes.sql`) añade comentarios privados separados, su historial y RPC local. La revisión independiente de Sol reparó cancelación del wrapper, respuestas incompletas y normalización de texto. Aceptada localmente con PGlite; concurrencia local verificada en el bloque 011; pendiente integración Auth/UI. No se aplicó a Supabase remoto.

B2a/010 ejecutado y revisado independientemente localmente: responsabilidad versionada, selección staged, sellado, backfill/fallback y tipos; no activa permisos, relojes o KPI. Evidencia en `docs/architecture/COORDINATION-010-IMPLEMENTATION-20261004.md` y `docs/architecture/COORDINATION-010-REVIEW-20261004.md`. SQL011 se completó localmente: reporte v4/cuotas/privacidad, cobertura recurrente y revocación de derivados, todos los writers y revalidación del footprint. Evidencia en docs/architecture/COORDINATION-011-CONTINUATION-20261006.md. PostgreSQL 17.11 ejecutó 26 carreras AB/BA con barreras reales, sin40P01 y con rollback40001 verificado. **No está listo para producción ni debe aplicarse remotamente.** Faltan integración y Auth/Supabase reales; el laboratorio mantiene JWT ficticios. No se aplicó ninguna migración remota.


## Fuente remota incorporada tras la validación 011

Se incorporó el commit c022f82 del mismo repositorio: backend Worker/D1 y UI
operativa. No sustituye ni aplica las migraciones Supabase. Sites get_site confirmó
latest_version_number 44; la referencia v43 anterior describe el corte histórico.
La estimación 42% del alcance completo original es histórica y requiere nueva
evaluación frente al alcance privado D1. Este chat no publicó ni aplicó SQL remoto.
