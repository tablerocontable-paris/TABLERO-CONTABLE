# Reglas para integrar pedidos nuevos

La referencia del producto es PRODUCT-ROADMAP.md; AGENTS.md y EXECUTION-NEXT.md
marcan la fase vigente. Cada ejecución usa su contrato y revisión. Documentos
cronológicos anteriores conservan evidencia, pero no sustituyen decisiones
posteriores explícitas del usuario. Actualizar esos tres puntos al cambiar fase.

Se recuperan ideas con evidencia en architecture/LEGACY-RECOVERY.md y
LEGACY-REVIEW.md. Su presencia en el repositorio viejo no prueba que funcionaran.
Hay módulos pendientes de recuperar, validar e integrar en el producto nuevo.

## Reglas que cada cambio debe preservar

| Pedido o dato | Regla vigente | Cruces que hay que comprobar |
| --- | --- | --- |
| Mismo banco/tarea en dos empresas | Mismo estándar, instancias y asignaciones independientes por empresa | Filtros, permisos, recurrencia, KPI y cierre |
| Tarea puntual o recurrente | Regla explícita por tarea; nuevo ciclo crea otra ocurrencia | Fecha, vencimiento recalculado, historia y aprobación |
| Catálogo/pesos | Estándar versionado y peso snapshot de cada ocurrencia | Cambios futuros no reescriben reportes cerrados |
| Inducción | Empleado prepara; Juan Pablo aprueba y parametriza acceso | No activar tareas antes de aprobación autorizada |
| Jerarquía/coberturas | Servidor decide acceso por jerarquía/empresa y cobertura vigente | Cambios/cancelaciones revocan acceso; historia propia permitida no amplía el padre |
| Cronómetro | Intervalos por ejecutor, un reloj abierto; pausa/reanudación/cierre coordinados | Estados, espera, cobertura, meses cerrados y cambio de tarea |
| Presencia/última conexión | Señales de sesión autenticada de personal para Juan Pablo | No inferir desde reloj ni usar como KPI; cuenta técnica fuera de esa vista |
| Cuenta técnica/laboratorio | Pruebas de escritura aisladas de empleados y KPI | Diagnóstico autorizado/auditado y datos productivos protegidos |
| Notas → tarea | Conversión explícita y tarea puntual, con vínculo | Privacidad, empresa/fecha/mes y persistencia sin perder nota |
| Cierre/reporte | Snapshot íntegro, reporte inmutable y entrega idempotente | Tiempos abiertos, revisión, destinatario y reintentos |
| Tema y tablero | Claro/oscuro/sistema; columnas independientes | Contraste, móviles y accesibilidad sin alterar datos |
| Equipos y sectores | Equipo jerárquico multiarea; sector por proceso/tarea | Organigrama, filtros y agregados sin reclasificar personas por tarea |
| Perfil propio y supervisión | Tablero personal por defecto; consultar no cambia actor | Desplegable autorizado, reset, cronómetro y cobertura conservados |
| Nombres libres de inducción | Propuestas agrupadas por coincidencia, confirmadas por Juan Pablo | Estándar versionado sin fusionar empresas/asignaciones/historia |
| Tarea conjunta puntual | Una ocurrencia compartida, participaciones snapshot suman 100% | Sesiones por actor, cierre de ambos y peso global contado una vez |
| Detalle interpersonal de bloqueo | Autor y superiores vigentes; datos separados | No exponer a coautor/reemplazo/persona señalada ni correo/exports comunes |
| Agenda y cumplimiento | Evento por empresa/obligación/período vinculado explícitamente | IVA/pago/balance, fechas oficiales versionadas y terminado no pendiente vencido |
| Baja y tareas huérfanas | Perfil histórico conservado; trabajo futuro se reasigna auditado | Pausa de recurrencia/reloj, cierres intactos y sin doble materialización |
| Consultas/avisos/ciclo | Destinatarios permitidos, deduplicación y magnitudes separadas | Privacidad, ausencia, correo y carga planificada frente a ejecución |

## Antes de implementar y antes de aprobar

1. Registrar el pedido en la decisión vigente y localizar sus cruces en la tabla.
2. Resolver contradicciones con reglas anteriores en el contrato de ejecución;
   dejar explícita la decisión reemplazada. Si queda una decisión de datos o
   permisos abierta, revisión Sol alto antes de Luna.
3. Implementar el alcance acordado y comprobar flujos afectados. Usar pruebas
   que puedan detectar el riesgo; cambios visuales simples no requieren baterías
   que dupliquen la implementación.
4. Distinguir implementación, pruebas y aceptación. Tests verdes no completan
   criterios ausentes. El revisor confirma cada criterio o deja el bloque
   pendiente; el siguiente bloque no se integra sobre una aceptación incompleta.
5. Separar demo local, laboratorio SQL y producto conectado. Exigir integración,
   permisos reales y piloto antes de migrar empleados. La separación dev/prod y
   recuperación de versiones serán parte de la infraestructura final acordada.

Estas reglas reducen regresiones y contradicciones. No garantizan ausencia de
errores; un fallo detectado se registra, se reproduce y se corrige antes de
aprobar la función afectada.

Pedidos actuales y decisiones que amplían estos cruces:
`CORRECTIONS-20261002.md`. Su matriz distingue implementación pendiente de
criterios aceptados. Los nuevos permisos no se agregan de manera implícita a
tests o adaptadores de las políticas antiguas.
