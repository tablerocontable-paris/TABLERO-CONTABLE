# Nueva base: esquema y flujos, sin conexión remota

migrations/ es la única fuente de esquema. Ambas migraciones se prueban desde vacío con PostgreSQL PGlite, roles anon/authenticated y stubs de auth.uid()/auth.jwt(). No se aplicaron en Supabase; las pruebas no cubren sus servicios Auth/Storage.

Implementado: organización/empresa/perfiles/equipos/membresías; catálogo/asignaciones/instancias; registros/inducción/cierres/auditoría; RLS de SELECT y DML directo denegado. RPC de transición, checklist automático, actividad, progreso de inducción, asignación desde catálogo, materialización mensual idempotente, peso de catálogo reservado a jefe con MFA aal2 y cierre con snapshot calculado por servidor. Las escrituras y el cierre usan el mismo bloqueo transaccional del período. Un cierre de encargado exige acceso a todas las empresas del mes.

Pendiente antes de conectar: bootstrap administrativo, invitaciones y Auth/MFA real, finalizar inducción transaccional con catálogo/particulares e idempotencia, tareas particulares con aprobación, gestión de estructura y metas, esperas externas, ajustes de pesos autorizados y versionados, Storage/evidencia, recuperación, diagnóstico, adaptador de datos y pruebas de integración Supabase. No habilitar DML directo como atajo.

Crear un Supabase nuevo y aplicar migraciones en orden en desarrollo. Nunca ejecutar contra legacy. Una migración aplicada no se reescribe: agregar otra y verificar desde cero y actualización. La app actual usa datos locales, no estas RPC.
