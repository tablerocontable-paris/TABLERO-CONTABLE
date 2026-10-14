# Camino a infraestructura gratuita — 02/10/2026

> Revisión de continuidad 11/10/2026: planificación histórica del 02/10. Las cuotas y condiciones citadas no se revalidaron en esta auditoría; deben consultarse nuevamente antes de elegir o activar servicios. El contrato vigente exige dos proyectos propios Supabase (dev/producción), GitHub, hosting y entrega automatizada comprobada después de aceptar el laboratorio. No autoriza crear cuentas, conectar API, invitar empleados ni publicar producción durante la revisión actual. Los gates de integración real se ejecutarán en esa etapa y no se declaran aprobados por una demo local.
Decisión de diseño, sin cuentas creadas. Preferencia técnica actual: Cloudflare
Pages para frontend Vite/React; Supabase para Postgres/Auth/RLS; GitHub para código
y CI. Workers sólo si el consumidor/scheduler necesita ejecución servidor allí.
Se conserva Sites durante desarrollo y validación. No se cambia hosting ahora.

## Puertas verificables

| Puerta | Qué hay que terminar | Qué habilita |
| --- | --- | --- |
| 1. Datos de coordinación | B1–B4, reglas, RLS y compatibilidad de lector/escritor/reportes | Preparar frontend compartido sin crear recursos todavía |
| 2. Integración preparada | Login/actor Auth, invitaciones, adaptadores de todas las rutas; sin fallback a actor simulado; SQL desde vacío y upgrade; test roles/errores | Decisión explícita de iniciar infraestructura nueva y Supabase dev con datos sintéticos |
| 3. Piloto conectado | Deploy dev, Auth/MFA/RLS reales, concurrencia PostgreSQL, dos navegadores, cronómetro, cierre/reporte, restore | Configuración de producción y aceptación operativa |
| 4. Versión definitiva | Juan Pablo/encargado validan producto, cuotas/correo/backup, dev/prod y actualización automática | Migración manual de empleados por equipos |

“Producto terminado” debe incluir prueba en backend real, no sólo demo local.
Preparar la integración puede hacerse antes del 100%; activar cuentas es otro hito
que se acordará explícitamente. No interpretar este documento como permiso para
crear Gmail, GitHub, Supabase o Cloudflare ahora. La infraestructura productiva y
la migración siguen al cierre de la versión definitiva, como pidió Valentino.

No hay fecha/calendario fiable para esas puertas: quedan módulos nuevos y riesgos
no medidos en la integración. Se reportará puerta completada, pendiente y
bloqueador, además del porcentaje global aproximado. Estar conectado a dev no
significa que los 20 empleados ya puedan migrar.

## Límites oficiales comprobados y objetivo $0

- Cloudflare Pages Free: 500 builds/mes, un build simultáneo, previews ilimitados;
  funciones consumen cuota Workers. Para esta SPA no hace falta cambiar de stack.
- Workers Free: 100.000 solicitudes/día; dimensionar cron/scheduler/consumidor
  antes de habilitarlo. No activar plan de uso variable automáticamente.
- Supabase Free: 2 proyectos activos, viable para dev/prod independientes si la
  cuenta/administradores disponen de esos cupos. Cada proyecto 500 MB de base,
  1 GB de archivos, 5 GB egress; pausa tras una semana inactivo. No incluye backups
  automáticos ni branching: separación mediante proyectos reales, no ramas DB.
- Vercel Hobby está limitado a uso personal no comercial. No se elige como base
  gratuita para el tablero empresarial. Una alternativa de hosting se reevalúa
  si cambian sus condiciones, sin contratarla por defecto.
- Dominio gratuito provisto por hosting; dominio comprado no es requisito.
  Gmail dedicado es identidad de administración; no es por sí mismo un proveedor
  de entrega transaccional probado. SMTP/reportes requieren proveedor y cuota
  verificados, y secretos sólo de servidor. No prometer correo ilimitado gratuito.
- Backup/export cifrado y restore fuera del proyecto principal deben diseñarse
  antes de migrar, porque Free no resuelve esa función. Si un límite no admite
  la operación final a coste cero, informar la limitación antes de contratar.

Esto es planificación viable dentro de cuotas, no garantía de que todo servicio
externo futuro sea gratuito para siempre. Volumen real de adjuntos/historial,
consumo y políticas se revalidan al alta y en el piloto.

Fuentes primarias consultadas 02/10/2026:
https://developers.cloudflare.com/pages/platform/limits/
https://developers.cloudflare.com/workers/platform/limits/
https://supabase.com/pricing
https://supabase.com/docs/guides/platform/billing-faq
https://vercel.com/docs/plans/hobby

Entrega automática objetivo y protección dev/prod: AUTOMATED-DELIVERY.md. Mantener
esa política al elegir servicios y registrar el hito final antes de migrar.
