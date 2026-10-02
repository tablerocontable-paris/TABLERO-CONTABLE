# Próximo bloque — revisión del adaptador de tareas

**GPT-6.1 Sol, medio, Standard.** Cambio manual; basta «continuá».

## Alcance de revisión

1. Leer DATA-ADAPTER-FOUNDATION.md, EXECUTION-DATA-ADAPTER-20261002.md y evidencia
   review-evidence/data-adapter-foundation-20261002.json. Verificar hashes antes
   de reutilizar resultados: 174 pruebas/15 archivos, build y checker 23 correctos.
2. Revisar src/data/remote/task-contract.ts y task-gateway.ts: filas completas,
   nulos, metadata, fechas y revisiones seguras; seis firmas exactas; claves/
   argumentos congelados; defensa runtime contra casts/autoridad añadida;
   errores genéricos, ACKs tipados y ausencia de reintentos automáticos.
3. Revisar composición SQL nueva y assertions del checker: B identifica jefe
   aal2 después del login propio, seed/wait receipts, motivo, una sesión cerrada
   y replay intacto. SQL/App/repositorio local/dependencias permanecen congelados.
4. Corregir hallazgos concretos con aceptación suficiente. Si no hay hallazgos,
   registrar aprobación y preparar contrato cerrado de lecturas autorizadas/
   paginadas y recarga de filas confirmadas, antes del coordinador asíncrono.

La próxima implementación vuelve a Luna medio. No ampliar esta revisión a Auth/
administración: esas decisiones requieren Sol alto. El adaptador todavía no se
activa en la página y no realiza conexiones remotas.

Grado de avance estimado: 40%, margen 35–45%, según PROJECT-STATUS.md. Auth,
invitaciones/MFA/RLS/correo reales, concurrencia PostgreSQL y piloto pendientes.
No crear cuentas/servicios, aplicar SQL remoto, ejecutar --run, migrar empleados
ni enviar correo. Futuro dev/prod: ops/AUTOMATED-DELIVERY.md.
