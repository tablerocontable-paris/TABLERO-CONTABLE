> **Actualizacion vigente 14/10/2026:** autorizada infraestructura propia/dev con cuenta GitHub NUEVA. Seguir ops/MIGRATION-BOOTSTRAP-20261014.md. La incorporacion de empleados reales que se describe abajo sigue pendiente de aceptacion productiva. No confundir continuidad de codigo con migracion de datos/usuarios.

# Incorporación manual de empleados

**Estado: todavía no habilitada en producción.** «Alta de demostración» prepara un perfil local y sirve para probar la inducción; no crea usuarios ni envía invitaciones.

## Preparación del proyecto nuevo

- Crear dos proyectos Supabase propios, desarrollo y producción, después de aceptar el producto; conservar el legacy sin cambios y con respaldo verificable.
- Automatizar migraciones versionadas por CI, primero en desarrollo y después en producción con los gates aprobados. Validar RLS con usuarios reales cuando se habilite esa etapa. No pegar SQL manualmente ni copiar tablas sin revisar las relaciones.
- Implementar y verificar el flujo administrativo de invitaciones: bootstrap del jefe, MFA, encargado y empleados. El servidor crea perfil, responsable y membresías de empresas/equipo; nunca el registro público.
- Conectar el adaptador de la app al nuevo backend, eliminar la selección libre de roles y separar completamente los datos de demostración.
- Configurar archivos privados/evidencia, recuperación de cuentas, correo, auditoría y backups; probar restauración.
- Elegir el repositorio GitHub y despliegue definitivos. Actualmente se publica una vista privada en Sites; no existe deploy nuevo en Cloudflare.

## Orden de alta manual, después de esas verificaciones

1. Cargar las cuatro empresas reales, sectores y sucursales.
2. Crear la jefatura y verificar MFA. Crear encargados y sus equipos.
3. Definir catálogo: tipo de trabajo y peso de entregables; para operativas, unidad y coeficiente por movimiento versionado con vigencia. Registrar cantidades y tiempo sin meta mensual ni porcentaje de finalización. La evaluación opcional de calidad, orden y oportunidad requiere observación y distingue sin evaluar de cero.
4. Invitar un empleado piloto y vincular encargado, equipo, sector, sucursal y empresas autorizadas.
5. El empleado completa su inducción, selecciona sus trabajos y revisa la previsualización. Verificar dos conciliaciones del mismo banco en empresas distintas, cantidades operativas y vencimientos.
6. Validar con encargado y jefe el KPI y el primer cierre. Comprobar que un empleado no ve a otros y que un encargado no ve otro equipo.
7. Continuar por equipos y registrar fecha de corte. Conservar el histórico legacy como consulta; no importarlo automáticamente al período nuevo.

No mover contraseñas manualmente ni reutilizar service_role en el navegador. La clave pública del proyecto es publicable; las claves administrativas quedan en el servidor.

## Aclaración posterior del usuario — 30/09/2026

La infraestructura se creará **cuando el producto esté validado**, no durante esta fase. Todo continúa en Sites. Cuenta dedicada propuesta: tablerocontable@gmail.com (sin crear/verificar). Nuevos GitHub, Supabase y hosting independiente del anterior. Juan Pablo administrará usuarios y parámetros; Valentino conservará su perfil de empleado y un acceso técnico separado para diagnóstico/pruebas. Ver PRODUCT-ROADMAP.md.
