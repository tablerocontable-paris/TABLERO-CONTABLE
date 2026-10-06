# Próxima ejecución — implementación completa011

**GPT-6 Luna, esfuerzo medio, Standard.** Contrato de implementación cerrado:
`architecture/COORDINATION-011-EXECUTION-20261004.md` y protocolo obligatorio
`architecture/COORDINATION-011-CONCURRENCY-20261006.md`. Leer ambos completos.
La revisión de concurrencia06/10 corrigió el orden, replay, cierre compartido,
nota009 e inducción por lote. Siete pruebas exploran el modelo abstracto;
no equivalen a validación PostgreSQL real. Revisión010 sin hallazgos en
`architecture/COORDINATION-010-REVIEW-20261004.md`.

Completar la fase entera sin pausas por subtarea: SQL011 explícito, tipos, fixtures,
runner concurrente preparado, aceptación focal/completa/build, documentación,
commit y push verificado. Revisar cada fallo contra el contrato y corregirlo.
Si aparece una decisión arquitectónica no cerrada, registrar evidencia concreta
y volver a Sol; no sustituir la fase por otro plan ni fingir cambio de modelo.

011 debe activar tareas conjuntas puntuales y coberturas exactas en SQL local. Leer
también toda evidencia010, diseño B, contratos001–009 y rutas escritoras reales.
Parchear conjuntamente autorización, clocks por actor, materialización,
cancelación, checklist/actividad, todas las RPC heredadas, conjunto de locks,
cierre, cuotas KPI y reporte versionado. No desplegar ni ejecutar migración
remota. No cambiar el orden de locks por intuición ni activar sólo parte de las rutas.
Reemplazar también notas009, catálogo y aprobación de inducción. No mezclar
keys nuevas con locks bigint antiguos. Si no hay PostgreSQL, dejar pruebas
concurrentes NO EJECUTADAS; eso no bloquea implementación local, sí producción.

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
