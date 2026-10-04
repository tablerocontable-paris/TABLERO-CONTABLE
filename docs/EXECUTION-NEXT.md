# Próxima ejecución — cerrar protocolo de concurrencia para011

**GPT-6.1 Sol, esfuerzo alto, Standard.** Antes de ejecutar011, resolver el
hallazgo reproducible del orden de locks en
`architecture/COORDINATION-011-LOCK-REVIEW-20261004.md` y actualizar
`architecture/COORDINATION-011-EXECUTION-20261004.md` con un protocolo aplicable
a todas las RPC existentes, sin lock global de organización. La revisión010 pasó
sin hallazgos; evidencia en `architecture/COORDINATION-010-REVIEW-20261004.md`.
Después de cerrar ese contrato, GPT-6 Luna medio implementa el bloque.

011 debe activar tareas conjuntas puntuales y coberturas exactas en SQL local. Leer
también toda evidencia010, diseño B, contratos001–009 y rutas escritoras reales.
Parchear conjuntamente autorización, clocks por actor, materialización,
cancelación, checklist/actividad, todas las RPC heredadas, conjunto de locks,
cierre, cuotas KPI y reporte versionado. No desplegar ni ejecutar migración
remota. No cambiar el orden de locks por intuición ni empezar una activación
parcial mientras este hallazgo esté abierto.

Ninguna relación010 staged concede acceso, modifica cronómetros o recalcula KPI.
No cambiar SQL001–010 ni App/lector/gateway durante esta ejecución aislada.

B1/009 tiene revisión y reparación independiente local en
`architecture/REVIEW-PRIVATE-NOTES-009-20261004.md`. Se probaron cancelación,
respuestas incompletas, whitespace equivalente SQL/JS, historia propia tras
cobertura, replay tras cierre y upgrade poblado. PostgreSQL real aún pendiente.
El push de B1 y su revisión se recuperó en `9a64c6a`; no hay ese pendiente.

Después de implementar011: **GPT-6.1 Sol alto, Standard** revisa el motor,
pruebas de carreras pendientes y permisos. B3 jerarquía y bajas usa la responsabilidad
coordinada para evitar otra forma de transferir tareas. Las FKs estructurales de
membresías se conservan; separar revocación operativa de borrar historia.

Live conserva Sites v43, implementación
`9d6b97dc16625c974d6679cf7d69b7fe2fdb3900`, deploy
`appgdep_6ac00b2ad81c81919a50bafab9f7101d` succeeded:
https://grupo-paris-contabilidad.valentino-magni.chatgpt.site.
Backend local y fuentes en Git de Sites; comentarios/conjuntas siguen sin UI ni
Supabase conectado. No publicar otra versión sólo por SQL invisible.

Avance **42% estimado (36–46%)**; revisión/contrato no elevan ese número. Puertas
hacia infraestructura gratuita en `ops/FREE-HOSTING-PATH-20261002.md`. No crear
servicios ni migrar empleados. Usuario cambia modelo manualmente; basta «continuá».
