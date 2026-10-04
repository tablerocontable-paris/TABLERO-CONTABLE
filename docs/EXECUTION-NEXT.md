# Próxima ejecución — B2a / 010

**GPT-6 Luna, esfuerzo medio, Standard.** Ejecutar
`architecture/COORDINATION-010-EXECUTION-20261004.md`: nueva migración 010 local,
responsabilidad por ocurrencia y cuotas, selección de cobertura por IDs/reglas,
sellado/guardas, backfill/fallback y tipos Zod propios. El contrato fija las tablas,
FK, invariantes, permisos y aceptación. Ninguna relación staged concede acceso,
modifica cronómetros o recalcula KPI. No cambiar SQL001–009 ni App/lector/gateway.

B1/009 tiene revisión y reparación independiente local en
`architecture/REVIEW-PRIVATE-NOTES-009-20261004.md`. Se probaron cancelación,
respuestas incompletas, whitespace equivalente SQL/JS, historia propia tras
cobertura, replay tras cierre y upgrade poblado. PostgreSQL real aún pendiente.
El push pendiente de la ejecución B1 se sincroniza junto con esta revisión.

Después de010: **GPT-6.1 Sol alto, Standard**, revisión y contrato011 completo de
activación coordinada. 011 deberá adaptar todas las rutas de escritura/RLS,
cronómetros paralelos, materialización, cobertura, cierres y reportes versionados
juntos; no basta quitar el índice de un reloj por instancia. B3 jerarquía y bajas
usa esa responsabilidad para evitar otra forma de transferir tareas.

Live conserva Sites v43, implementación
`9d6b97dc16625c974d6679cf7d69b7fe2fdb3900`, deploy
`appgdep_6ac00b2ad81c81919a50bafab9f7101d` succeeded:
https://grupo-paris-contabilidad.valentino-magni.chatgpt.site.
Backend local y fuentes en Git de Sites; comentarios/conjuntas siguen sin UI ni
Supabase conectado. No publicar otra versión sólo por SQL invisible.

Avance **42% estimado (36–46%)**; revisión/contrato no elevan ese número. Puertas
hacia infraestructura gratuita en `ops/FREE-HOSTING-PATH-20261002.md`. No crear
servicios ni migrar empleados. Usuario cambia modelo manualmente; basta «continuá».
