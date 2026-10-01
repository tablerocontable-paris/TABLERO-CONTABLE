# Revisión del contrato y ejecución siguiente — 01/10/2026

Estado revisado: frontend 0.4, migraciones SQL 0.3 y ejecución del contrato local `202610010001`. La migración está implementada y probada con PGlite, pero no se aplicó remotamente ni se conectó al frontend. No es autorización para crear infraestructura o enviar correos reales. Ver reglas de modelos en AGENTS.md.

## Resultado de la revisión

La separación catálogo/asignación/instancia y el cierre transaccional son una base útil. El SQL 0.3 todavía NO corresponde a la interfaz 0.4 y no puede conectarse tal como está. Las pruebas SQL actuales cubren esas dos migraciones con auth emulada; no prueban Auth/MFA real ni un servicio de correo.

| Hallazgo en archivos actuales                                                         | Consecuencia                                                    | Decisión del contrato nuevo                                                                         |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| foundation: frequency sólo mensual/unica; unique(assignment_id,period)                | Impide más de una ocurrencia por mes                            | Regla explícita e identidad unique(assignment_id,scheduled_on)                                      |
| foundation: due_date obligatorio y restringido al período                             | No representa ausencia de vencimiento ni plazo que cruce de mes | due_date nullable; período determinado por scheduled_on, no por vencimiento                         |
| task_templates.version aumenta pero sobrescribe el mismo registro                     | No recupera un estándar anterior                                | Revisiones inmutables del catálogo, referencia de versión en asignación e instancia                 |
| Template de frontend incluye sector/description; SQL no los incluye                   | Adaptador incompleto                                            | Incluir objetivo, sector, controles, tipo, unidad y peso en revisión del estándar                   |
| Frontend tiene sesiones, reaperturas, ausencias; SQL no                               | Métricas y permisos difieren                                    | Sesiones y coberturas con relaciones y acciones autorizadas; reapertura explícita                   |
| save_onboarding sólo guarda JSON; finishOnboarding crea trabajo activo inmediatamente | No hay revisión ni aprobación de jefatura                       | Borrador → enviado → cambios solicitados o aprobado; activar sólo al aprobar                        |
| Draft del frontend guarda schedule por templateId                                     | Dos empresas quedan atadas a la misma frecuencia                | Línea de inducción por proceso + empresa, cada una con su propia regla/meta                         |
| close_employee_month genera snapshot sin reporte/outbox                               | No entrega reporte automático                                   | Cierre + reporte + evento de entrega en una única transacción                                       |
| reports.ts usa todos los jefes activos locales                                        | No hay destinatario productivo definido                         | Configuración explícita de destinatario gerente por organización, validado; inicialmente Juan Pablo |
| Reporte local identifica proceso por templateId y título; no incluye revisión         | Puede comparar controles diferentes como un único proceso       | Agrupar por empresa, proceso y revisión; resumen de proceso conserva desglose por revisión          |
| frontend valida colecciones como z.unknown() y usa IDs de demo                        | No es contrato API confiable                                    | DTOs completos, UUIDs de servidor, validador y adaptador explícito                                  |
| SQL de puntualidad divide por completadas; TS excluye las sin vencimiento             | Resultado distinto con fechas opcionales                        | Denominador sólo entregables completados con vencimiento; sin base = null                           |

## Decisiones cerradas para la implementación

### Identidad, calendario e historia

- organization_id en todas las relaciones nuevas y FKs compuestas para impedir referencias entre organizaciones. Perfil activo y rol obtenidos de auth.uid(), nunca enviados por el cliente.
- Catálogo: task_templates es identidad estable. task_template_versions contiene versión, nombre, objetivo, sector, tipo, unidad, peso, controles y fecha de vigencia, sin UPDATE/DELETE desde cliente. Peso vigente no cambia asignaciones ya aprobadas.
- Cada asignación aprobada referencia una revisión inmutable. Conserva empresa, titular, equipo al aprobar, meta por ocurrencia, regla y vigencia. Reprogramar crea una revisión de asignación; preserva trabajo iniciado o cerrado.
- Regla SQL: frequency en `unica/diaria/semanal/mensual`, start_date, end_date nullable, interval 1..12, weekdays 0..6 para semanal, month_day 1..31, has_deadline, due_offset_days 0..31. Adaptador traduce `única` de UI a `unica`; fechas DATE ISO, instantes UTC TIMESTAMPTZ. Zona del negocio America/Argentina/Buenos_Aires.
- Una instancia por asignación y scheduled_on. period = primer día del mes de scheduled_on. Vencimiento = scheduled_on + plazo, o NULL. Día 31 se ajusta al último día; semanal se ancla a la semana del inicio con lunes como primer día; diaria significa días calendario, como schedule.ts actual.
- Snapshot de instancia: revisión del catálogo, nombre, controles, unidad, meta, peso y equipo. No deduplicar por nombre ni sumar cantidades de unidades diferentes. Puntuales libres no tienen recurrencia ni se agrupan por semejanza de texto.
- Migración histórica: instancias mensuales actuales conservan IDs, período, peso, checklist y due_date. Backfill scheduled_on con la fecha de ejecución original si existe; para filas SQL 0.3 sin ella usar su due_date y registrar explícitamente que es una inferencia. No recalcular ni cambiar snapshots cerrados.

### Inducción y aprobación

- Sólo Juan Pablo/jefatura con MFA aprueba y activa. Encargado revisa y puede solicitar correcciones/recomendar; no concede permisos ni aprobación final. Empleado sólo edita y envía su propio borrador.
- Guardar revisiones de solicitud y líneas (catálogo/revisión, empresa, regla, meta, objetivo y controles de particulares puntuales). Estado: draft, submitted, changes_requested, approved. Cada envío sella el contenido. Las correcciones crean nueva revisión; conservar comentarios y actores anteriores.
- La interfaz puede guardar/pausar, pero ningún borrador o envío genera tareas activas. approved requiere approved_by, approved_at y revision exacta. completed_at del tutorial no equivale a aprobación operativa.
- La aprobación RPC valida nuevamente pertenencia a empresa/equipo, rol y perfil activo, catálogo/revisión vigente, meta/unidad, frecuencia, duplicados y períodos cerrados. No confiar en un JSON validado sólo por el navegador.
- Usar expected_revision para rechazar revisión desactualizada. Clave idempotente de aprobación por solicitud/revisión; líneas con clave estable. En una transacción: aprobar, crear asignaciones una vez, materializar períodos abiertos y auditar. Fallo en cualquier línea revierte todo.
- Cambios de rol/membresías durante revisión invalidan el envío y exigen nueva revisión. Si se cambia el estándar antes de aprobar, devolver conflicto; nunca sustituirlo silenciosamente.
- Un proceso faltante se solicita a Juan Pablo; aprobar el proceso no aprueba automáticamente la inducción. Un trabajo esporádico puede usar el catálogo sin recurrencia.

### Tiempo, coberturas y cierres

- time_sessions: instance_id, actor_id, start_at, end_at nullable. Una sesión activa por ejecutor (índice único parcial). Iniciar, pausar y reanudar son RPC; validar acceso permanente o cobertura vigente. No superponer sesiones del mismo actor ni aceptar finales anteriores al inicio.
- Ausencia: titular, reemplazante autorizado, empresas incluidas, rango inclusivo y nota; aprobación de responsable, cancelación auditada. Mantener titular y registrar ejecutor. No cambiar automáticamente peso o vencimiento.
- Toda escritura de actividad/checklist/sesión/reapertura comparte lock empleado/período con cierre. El cierre rechaza cronómetros activos; no inventa tiempo de trabajo. Ajustes de tiempos olvidados requieren motivo y responsable, preservan original, y quedan bloqueados después del cierre.
- Cierre individual exige responsable con MFA y acceso a todas las empresas del período. Conserva pendientes; no completa tareas. Snapshot versión 2 incluye identidades, tareas, actividades, sesiones/ejecutores, reaperturas y métricas. Fecha de evaluación explícita = closed_at en zona Argentina.
- Reporte inmutable por cierre; métricas vienen del snapshot del servidor. Ausencia de base = NULL. Tiempo registrado no es una calificación de productividad. Reportes de prueba/laboratorio no se incluyen en cierres ni envíos productivos.

### Entrega automática de reportes

- report_settings define un destinatario gerente activo de la misma organización, seleccionado por jefatura; correo verificado por Auth. No asumir que el email propuesto para infraestructura es el de Juan Pablo.
- Al cerrar: crear monthly_closure, period_report y outbox_event en la misma transacción. Restricciones únicas por cierre y por reporte/destinatario/canal. Repetir una petición de cierre devuelve el mismo cierre/reporte, sin generar otro evento. No agregar reapertura de período en esta ejecución.
- report_deliveries: pending, processing, sent, retry_wait, failed; attempts, next_attempt_at, lease_until, provider_message_id, last_error sanitizado. Consumidor de servidor reclama con FOR UPDATE SKIP LOCKED y lease de 2 minutos. Reintentos a 1, 5, 15 y 60 minutos; máximo 5 intentos, luego failed visible al administrador. Reintento manual autorizado/auditado conserva identidad de entrega.
- Clave de idempotencia externa = delivery_id. Registrar sent sólo tras aceptación del proveedor. Confirmación ambigua no garantiza «exactamente una vez»: reintentar sólo con proveedor que soporte deduplicación estable o reconciliar el mensaje antes de reenviar.
- Primera entrega: aviso breve al correo verificado de Juan Pablo con enlace autenticado al reporte privado. No adjuntar información contable ni publicar reportes en URLs abiertas. El proveedor real y sus credenciales se configurarán con la infraestructura definitiva; probar ahora con adaptador falso.
- Fallo de correo no revierte un cierre válido. Queda entrega pendiente/fallida con seguimiento. La bandeja en la app muestra generado y enviado por separado. No crear automatización de chat para leer localStorage ni enviar reportes demo.

## Instrucciones ejecutables para GPT 6 Luna — esfuerzo medio

Ejecuciones completadas: **`202610010001_occurrence_contract.sql`** y **`202610010002_onboarding_approval.sql`**, con pruebas locales. La segunda agrega borradores guardables, solicitudes versionadas, registro de revisión, solicitud de cambios limitada al encargado de la persona y aprobación transaccional exclusiva de jefatura con MFA. Aprobación valida vigencia del catálogo y membresías por empresa/equipo; genera asignaciones con recurrencia independiente por empresa, registra procedencia, rechaza revisiones obsoletas y es idempotente. El borrador/envío no activa tareas; particulares requieren peso aprobado por jefatura.

Evidencia de esta ejecución: 41 tests pasan, incluyendo PGlite desde cero y upgrade fixture 0.3 + 001 + 002; el flujo verifica dos empresas/calendarios, cambios solicitados, MFA, revisión obsoleta, membresía removida con rollback total, pausa/reanudación del borrador, cero asignaciones al enviar e idempotencia al aprobar. `npm run build` pasa. Sigue siendo validación local, sin Supabase Auth/MFA real.

Evidencia de esta ejecución: 40 tests aprobaron, incluyendo PGlite desde cero, upgrade real de fixture 0.3 que conserva snapshot/checklist/catálogo, recurrencia semanal/diaria, semana de intervalo, vencimiento posterior a febrero, ausencia de vencimiento, día 31, identidad/versionado y nueva asignación al último estándar. Build TypeScript/Vite aprobado.

Pendientes confirmados de esta etapa: el nuevo contrato no tiene aún un adaptador frontend, bootstrap/alta inicial de jefatura, ni RPC completo que reciba toda la regla semanal (la RPC compatible conserva la firma 0.3). Cronómetro/cobertura tienen tablas y lectura RLS, pero les faltan RPC de escritura autorizadas. No conectar hasta resolver estas superficies; no conceder DML directo.

## Ejecución 003 — reportes y entrega local

Completada `202610010003_report_delivery.sql`: destinatario gerente activo/verificado por organización; cierre idempotente bajo lock empleado/mes; snapshot versión 2 con sesiones, tiempo registrado y reaperturas explícitas por transición; puntualidad excluye tareas sin vencimiento. Cierre + reporte inmutable + entrega + outbox se crean en una transacción. No cambiar reportes/cierres anteriores ni enviar sus correos de forma retroactiva.

Cola de servidor: lease de dos minutos con token por intento, SKIP LOCKED, cinco intentos y esperas de 1/5/15/60 minutos. ACK viejo se rechaza; reintento manual de jefatura con MFA conserva ID y total histórico de intentos. Si el destinatario dejó de estar activo/verificado o cambió su correo, la entrega falla sin redirigirla. El consumidor sólo tiene RPC concedidas a `service_role`; usuario autenticado no puede reclamarlas. El proveedor simulado usa delivery_id para deduplicar aceptación ambigua y ACK tardío. Errores persistidos son códigos limitados, sin texto de excepciones.

Evidencia: 48 pruebas + build aprobados; base nueva y upgrade fixture 0.3 + 001/002/003; MFA/privacidad, repetición del cierre, lease/reclamación/ACK obsoleto, agotamiento y reintento, falta de correo verificado, cronómetro activo, tiempo del snapshot, puntualidad sin denominador y deduplicación del consumidor falso.

Límites: no SQL remoto, proveedor real, correo ni cron ejecutándose; no frontend/URL `/reportes/:id` conectados. Las funciones de escritura de sesiones/coberturas aún faltan. El snapshot de reaperturas contiene las transiciones explícitas ya auditadas; la RPC de checklist antigua no guarda from/to y requiere una migración posterior, sin inferir historia anterior. El cierre actual genera la entrega cuando lo invoca un responsable; la programación del cierre/revisión mensual debe definirse y probarse antes de automatizar por calendario. Ver `docs/ops/REPORT-DELIVERY.md`.

## Ejecución 004 — pendiente de revisión arquitectónica Sol 6.1

Contrato detallado en `docs/architecture/TIME-COVERAGE-004.md`. Se agregó `202610010004_time_coverage.sql`, sin editar 001–003, y una guía de validación de carreras reales en `docs/ops/TIME-COVERAGE-VALIDATION.md`. Se restringió `create_catalog_assignment` a jefatura con MFA; se añadieron autorización explícita de empresas para cobertura, RPCs de aprobación/cancelación, reloj, espera, actividad idempotente, reapertura con motivo y receipt de operaciones. El cierre nuevo genera snapshot versión 3 con eventos de reapertura y sesiones, sin reescribir snapshots anteriores. La UI no se conectó a este contrato.

Evidencia: **49 pruebas pasan**, incluida base vacía y fixture de actualización anterior; `npm run build` y `git diff --check` pasan. Commit `2ad47732c10c31e1354ca41af2680d6a3280117c` quedó en `main` del repositorio fuente de Sites y se publicó la versión privada 12 en `https://grupo-paris-contabilidad.valentino-magni.chatgpt.site`. Ese despliegue sólo sirve la build estática existente; **no aplica la migración ni conecta Supabase**. Las cuatro carreras reales están documentadas como NO EJECUTADAS; PGlite no prueba concurrencia real.

Antes de aplicar 004 o conectarla al frontend, revisión Sol 6.1 alto: confirmar el orden de locks para pausas/interrupciones de sesiones en `set_task_wait`, `transition_task_reviewed`, `set_checklist_item_reviewed` y `pause_task_timer`; pausa actualmente no toma guards de propietario/período; comprobar el cambio atómico `p_switch=true` con origen y destino en meses distintos; verificar que los wrappers preservan permisos de cobertura y que la migración de eventos legacy es robusta ante cualquier actor huérfano. Resolver cualquier ajuste en un commit nuevo y volver a ejecutar todos los checks. No ejecutar migración remota aún.

### Aceptación y límites

- Todas las migraciones se aplican desde vacío y sobre fixture anterior; integridad e historia preservadas. DML directo sigue denegado; funciones autorizadas no aceptan organization_id/actor_role del cliente como autoridad.
- Mantener pasando pruebas existentes o actualizar expectativas sólo por cambios explícitos de este contrato, explicando el motivo. npm test y npm run build aprobados; registrar qué pruebas no cubren Auth/servicios reales.
- No aplicar SQL remoto, importar empleados, subir secretos, crear cuentas nuevas ni enviar mensajes. Sites conserva audiencia privada. El despliegue de documentación o frontend no implica que el nuevo backend esté conectado.
- Al devolver: qué cambió, evidencia, pendientes y siguiente modelo recomendado. Para volver a evaluar decisiones o validar el contrato: Sol 6.1 alto. Para ejecutar la siguiente lista aprobada: GPT 6 Luna medio.
