> Alcance histórico verificado el 11/10/2026: este documento describe el consumidor Supabase y el snapshot versión 2 de una etapa anterior. No es la ruta activa del laboratorio ni la aceptación del contrato efectivo 011, que introduce reportes versión 4. El cierre vigente del laboratorio corresponde únicamente a jefatura por persona, empresa y mes; sus métricas operativas no usan metas. Los 48 tests/build citados al final son evidencia histórica. Consultar SOL-AUDIT-20261008.md y PROJECT-STATUS.md antes de implementar o habilitar esta ruta. No hay proveedor de correo real ni autorización para crear cuentas antes de aceptar el producto.
# Reportes mensuales: estado de implementación

Implementado en fuente, probado localmente; no está activado en Supabase ni enviando correo. El deploy estático de Sites no ejecuta migraciones ni instala este consumidor.

## Operación prevista

1. Juan Pablo configura un perfil gerente/jefe activo con correo verificado por Auth usando `set_report_recipient`. No se usa el correo dedicado de infraestructura como destinatario implícito.
2. Un responsable con MFA cierra el empleado/mes con `close_employee_month`. Falta de configuración válida o sesiones activas impide el cierre. Un cierre repetido retorna su ID anterior. Los cierres históricos sin reporte no se modifican ni se envían retroactivamente.
3. La transacción conserva el snapshot servidor, crea `period_reports`, `report_deliveries` y `report_outbox_events`. Cualquier error revierte ese cierre nuevo íntegramente. La entrega nace pendiente; no significa enviado.
4. Un consumidor de servidor usa `createSupabaseReportStore` con cliente service_role y `deliverReportBatch` con proveedor de correo aprobado. La clave externa es delivery_id. El aviso sólo contiene el enlace al reporte privado; no adjunta KPI ni datos contables.
5. El proveedor debe garantizar deduplicación estable durante todo el plazo de reintentos, incluyendo reintentos manuales y reinicios. Hasta verificar esa garantía no habilitar envíos. El proveedor falso sólo demuestra la lógica local; su Map no es persistencia productiva.

## Cola y recuperación

- Claim: sólo service_role; máximo 100 registros, SKIP LOCKED, lease de dos minutos y token nuevo por intento.
- Complete/fail: requieren ID y token del lease vigente. Nunca aceptar un ACK de un intento anterior.
- Cinco intentos; esperas 1, 5, 15 y 60 minutos. Después queda failed visible a jefatura. Jefatura con MFA puede reintentar conservando ID y total_attempts; attempts reinicia el ciclo.
- Lease vencido se reclama de nuevo con igual ID externo. Si ya agotó intentos, queda failed. Correo cambiado o gerente suspendido/no verificado invalida la entrega; no cambiar destinatario automáticamente.
- Si el proveedor aceptó pero el ACK a la base falló, queda processing hasta expirar el lease. El proveedor devuelve la aceptación anterior al reclamar y reenviar la misma clave.
- Códigos de error limitados. Nunca guardar mensajes crudos de proveedor, contraseñas, tokens ni cuerpos de correo en last_error.

## Privacidad y datos

Reportes inmutables, ligados al mismo cierre/organización/empleado/período mediante FK. Empleado ve su reporte; encargado actual necesita acceso a todas sus empresas; jefatura ve toda su organización. La cola/dirección de envío sólo se muestra a jefatura; consumo mediante servidor.

Snapshot versión 2: tareas con empresa/proceso/revisión/peso congelados, actividad, sesiones/ejecutores, tiempo registrado y reaperturas explícitas de `task.transition`. Puntualidad usa sólo completadas con vencimiento; sin denominador = null. El cronómetro no se convierte en una calificación de productividad. Las reaperturas de checklist del RPC anterior no tenían from/to; falta instrumentarlas en una migración futura sin inventar historia.

## Pendientes para habilitarlo

- Migraciones probadas en un proyecto Supabase dev real; Auth/MFA/RLS y concurrencia con PostgreSQL real. PGlite emula Auth para las pruebas.
- Implementar/verificar RPC de sesiones/coberturas y bloqueo de escrituras al cerrar; el frontend no está conectado todavía.
- Pantalla y ruta autenticada `/reportes/:id`; el consumidor sólo prepara ese enlace futuro. No mandar URLs que todavía no funcionen.
- Un cron/worker servidor, credenciales sólo de servidor, proveedor real, límites/retención de idempotencia, pruebas de reintento y observabilidad. No importar módulos de src/server desde el frontend.
- Determinar el calendario de revisión y cierre mensual. La implementación actual genera automáticamente el reporte/cola al cerrar mediante RPC; no existe aún cierre autónomo por calendario.
- Pilotear con datos sintéticos, verificar números con Juan Pablo y realizar prueba de recuperación antes de migrar empleados.

Verificación actual: 48 tests y build, migraciones desde cero y upgrade fixture anterior. No se enviaron mensajes ni se crearon cuentas/servicios.
