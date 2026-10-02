# Próxima ejecución — B1, comentarios privados

**GPT-6 Luna, esfuerzo medio, Standard.** Implementar
`architecture/PRIVATE-BLOCK-NOTES-009-20261002.md`: nueva migración 009 local,
RLS de comentarios separados, versiones/receipts privados y wrapper RPC propio.
El contrato define permisos, locks, no-op, replay, formato ACK y pruebas.
No cambiar App ni simular privacidad en localStorage. Preservar SQL 001–008,
lector/gateway existentes y snapshots; no conectar Supabase ni crear servicios.

Arquitectura B y dependencias cerradas en
`architecture/COORDINATION-B-DESIGN-20261002.md`. B2/B3 requieren su contrato API
posterior antes de implementación. Después de 009 Sol 6.1 alto revisa seguridad,
upgrade y locks, y prepara responsabilidad conjunta/cobertura/contribuciones.

Camino a servicios gratuitos y puertas de salida de Sites:
`ops/FREE-HOSTING-PATH-20261002.md`. Primero preparar integración, luego decidir
inicio de infraestructura nueva/dev sintético, piloto conectado y producción.
La migración de 20 empleados sólo se habilita con aceptación final.

Live conserva Sites v43, implementación
`9d6b97dc16625c974d6679cf7d69b7fe2fdb3900`, deploy succeeded
`appgdep_6ac00b2ad81c81919a50bafab9f7101d`:
https://grupo-paris-contabilidad.valentino-magni.chatgpt.site.
No hay nuevo código productivo en este diseño. Avance **41% estimado (35–45%)**.
QA visual real sigue abierta. No elevar avance por contratos escritos.

El usuario cambia modelo/esfuerzo manualmente; basta «continuá». No delegarlo.
