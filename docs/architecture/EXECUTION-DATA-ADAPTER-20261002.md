# Fundación del adaptador — ejecución 02/10/2026

Base: v29, `042145d5bc50682ef5e7153c97d83ac58022cee4`.
Contrato: DATA-ADAPTER-FOUNDATION.md. Revisión independiente Sol pendiente.

## Resultado

- Contratos Zod de filas completas de task_instances/task_time_sessions. UUID
  PostgreSQL sin restricción de versión, fechas de calendario, zonas explícitas,
  revisión segura, nulos y metadata preservados; no conversión a Task local.
- Seis comandos y firmas RPC exactas. El preparador valida, clona y congela
  intención/argumentos; el gateway vuelve a validar en runtime. La identidad
  la determina SQL/JWT; entradas con autoridad añadida se rechazan antes de RPC.
- ACKs discriminados por operación, sin inferir estado de la tarjeta. Fallos
  validation/transport/server/protocol con mensajes estables. Ningún reintento
  automático ni generación de operationId: replay explícito conserva la clave
  y los argumentos de la intención original.
- Checker BA previo al corte verifica jefe/aal2/authenticated dentro del DO de B
  después de su login real. También verifica Synthetic wait, una sesión total
  cerrada, receipt seed peer/op90/start_timer/session_id original y receipt
  boss/op1/task_wait/revisión 2. Conserva checks y replay anteriores.

## Verificación

23 pruebas nuevas (17 unitarias y 6 de composición SQL); 174 pruebas totales en
15 archivos correctas. tsc y build correctos. Checker 23 casos secuenciales
correctos. Emisión expiry-wait AB/BA con --emit-only; ambos NO EJECUTADO contra
PostgreSQL. No se ejecutó A/afterFirst/pg_sleep en el caso BA previo al corte.

Los tests SQL usan AccountingLab con BEGIN/ROLLBACK por caso y allowlist fija
de SQL parametrizado para seis RPC. Actor authenticated antes de ejecutar y
leer filas; rol administrativo sólo para fixture/snapshots/auditoría. Date se
serializa a ISO en la frontera del transporte de test y las filas se seleccionan
como JSON SQL. Esto no verifica PostgREST ni Supabase Auth real.

Casos: start/pause/replay; espera denegada a empleado y aceptada por jefe aal2
con contexto de cobertura; último checklist completado por SQL; reapertura
sin motivo rechazada y con motivo/replay deja un evento; revisión vieja con
rollback íntegro; actividad/replay crea una fila; banco igual en dos empresas
con asignaciones/pesos/checklist/nulos originales preservados.

SQL 001–008, frontend, repositorio local y dependencias sin cambios. Evidencia
nueva: review-evidence/data-adapter-foundation-20261002.json y logs de pruebas/
build de esa misma fecha. El build publicado sigue siendo la demostración.

## Próximo paso

GPT-6.1 Sol, medio, Standard: revisar frontera, argumentos, validación runtime,
ACKs/replay y aceptación SQL; usar los hashes/logs registrados. Resolver cualquier
hallazgo antes de definir lecturas autorizadas y coordinación asíncrona. Auth,
invitaciones/MFA/RLS/correo reales, concurrencia PostgreSQL y piloto pendientes.
