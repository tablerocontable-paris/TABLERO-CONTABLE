# Próxima ejecución — revisión010 y contrato011

**GPT-6.1 Sol, esfuerzo alto, Standard.** Revisar de forma independiente010,
implementado según `architecture/COORDINATION-010-EXECUTION-20261004.md`.
Evidencia y hallazgo de membresías históricas en
`architecture/COORDINATION-010-IMPLEMENTATION-20261004.md`.

1. Contrastar migración y Zod con el contrato: identidad/FKs, cuotas, sellado,
   backfill/fallback, sector histórico, grants/RLS y ausencia de autorización
   operativa. Probes independientes según hipótesis; registrar y reparar hallazgos.
2. Revisar preservación de datos009 poblados y compatibilidad con RPC008. Las
   18 pruebas de ejecución pasan localmente; no sustituyen revisión independiente
   ni carreras PostgreSQL reales.
3. Cerrar el contrato011 completo antes de volver a Luna: activar acceso por
   ocurrencia, cronómetros paralelos por actor, cobertura seleccionada,
   materialización/cancelación, locks de todos los responsables, cierres y reportes
   versionados. Adaptar todas las rutas heredadas juntas. No implementar011 sólo
   con el diseño global ni quitar el índice de un reloj por instancia como atajo.

Ninguna relación010 staged concede acceso, modifica cronómetros o recalcula KPI.
No cambiar SQL001–009 ni App/lector/gateway durante esta revisión aislada.

B1/009 tiene revisión y reparación independiente local en
`architecture/REVIEW-PRIVATE-NOTES-009-20261004.md`. Se probaron cancelación,
respuestas incompletas, whitespace equivalente SQL/JS, historia propia tras
cobertura, replay tras cierre y upgrade poblado. PostgreSQL real aún pendiente.
El push de B1 y su revisión se recuperó en `9a64c6a`; no hay ese pendiente.

Después de una revisión010 aceptada y contrato011 cerrado: **GPT-6 Luna medio,
Standard** implementa ese contrato. B3 jerarquía y bajas usa la responsabilidad
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
