# Decisiones de la nueva generación

1. **Empresa obligatoria.** La identidad es la asignación + período, nunca el título ni el banco. Dos conciliaciones del mismo banco en distintas empresas son dos trabajos. Quitar el filtro sólo cambia la vista.
2. **Definición e instancia separadas.** Una asignación define recurrencia y condiciones. Cada mes recibe una instancia con peso, meta, vencimiento y checklist propios; no se recicla una tarjeta completada ni se sobrescribe la historia.
3. **Resultado y actividad son modelos distintos.** El entregable tiene estado y checklist. La operativa tiene registros fechados de cantidades y referencias. El cierre consolida el mes y no simula haber completado pendientes.
4. **KPI explicable.** Resultado = peso si está completado; operativa = peso × mínimo(cantidad/meta, 1). Cumplimiento = puntos logrados / asignados. Sin datos se muestra ausencia de indicador. No se suman facturas y pagos como una sola cantidad. Puntualidad usa Argentina y sólo resultados completados.
5. **Jerarquía y aislamiento en servidor.** Organización, membresías de empresa/equipo y perfil responsable definen acceso. RLS protege SELECT; RPC autorizadas realizan escrituras. El selector de perfiles publicado es sólo una simulación y nunca será el mecanismo de autenticación productivo.
6. **Mes cerrado inmutable.** El cierre toma todas las empresas del empleado. Las RPC usan un bloqueo transaccional compartido por empleado/período para serializar el cierre y las escrituras. Conserva tareas, actividad y métricas calculadas en servidor. No existe una reapertura silenciosa.
7. **Pesos versionados.** Editar el catálogo modifica futuras asignaciones; no cambia las condiciones de trabajos históricos. La edición SQL del catálogo requiere jefe con sesión MFA aal2.
8. **Inducción recuperable y obligatoria.** Se guarda cada paso, se muestra una previsualización y se crean asignaciones al confirmar. Pausar mantiene el espacio bloqueado. La finalización local usa claves estables para evitar duplicación al repetir confirmaciones.
9. **Identidad visual.** Se usa el SVG oficial y la tipografía Inter. Superficies, sombras, movimiento de tarjetas y transiciones dan profundidad sin distraer; se respeta prefers-reduced-motion.
10. **Legacy intacto.** Repositorio, base y deploy anteriores se consultan en lectura. La implementación nueva tiene migraciones secuenciales propias. No se aplicó SQL a ningún Supabase remoto.

## Límite de esta entrega

El sitio publicado ejecuta React/TypeScript y persiste una demostración en el navegador. El SQL se verifica con PostgreSQL PGlite y roles emulados; no está conectado a la interfaz. Auth, invitaciones, MFA real, recuperación de cuenta, Storage y el adaptador de datos remoto aún deben integrarse y verificarse en un Supabase nuevo antes de incorporar empleados.
