# Continuación recuperada de B2b/011 —06/10/2026

## Identidad y recuperación

Mismo proyecto Sites appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85, sin otra app.
Base remota 6ec239f73c0228a3ef65f359e78e35aba6cd85ea; recuperados cf6fc23,
2c60379 y 54117ea. Bundle Git verificado SHA256:
22a9dc4d42457ba8618dd0c6de4c0b3b396b0f6a2d69cbc1d27ef993dc86ba8b.
Este checkout contiene su historia y ya no depende del chat anterior.

## Cambios comprobados

- Plan readonly prepare; A/W/M/C y filas por PK; revalidación completa tras
  esperar. Ampliación/reducción del ámbito produce 40001 antes de writes.
- Helpers internos sin EXECUTE de PUBLIC/anon/authenticated/service_role.
  Auditoría de definiciones finales: writers sin hashtextextended/bigint antiguos.
- Ausencias, catálogo/pesos e inducción comparten envelope. Inducción inserta
  todas las líneas y llama una vez al core de materialización, sin RPC anidada.
- Cada cobertura generada conserva source_rule_id. Cancelar regla revoca sus
  derivados y para sus relojes en una transacción, sin borrar evidencia.
- Binding inmutable, sin solapamiento de sustitutos, intervalos disjuntos
  permitidos. Precisión del plan restringe legacy y cancelar no abre grants.
- Procedencia de sesiones viejas legacy; nuevas por responsable o cobertura
  con binding/ausencia. Un reloj viejo vencido se termina antes de reanudar la
  misma tarea bajo otro binding. Se conserva actor y corte efectivo.
- Gate privado del ancla original; notas fuera del DTO común y reportes.
- Cierre v4: tarea/obligación únicas, puntos por cuota, cobertura cero puntos,
  horas/actividad propias sin multiplicar cuota ni exponer detalle del par.
  A congela conjunta y B puede cerrar después. Cierre de cobertura no congela
  actividad futura ajena ni modifica su propia evidencia ya cerrada.
- Lectura de reportes v3/v4; snapshots, destinatarios y outbox históricos intactos.
  Reporte/entrega/outbox transaccionales e idempotentes, sin envío SMTP.

## Verificación

Suites 011 prueban selección/recurrencia, cancelación en cascada, solapamiento,
cuotas, privacidad, segundos, grants, revalidación, upgrade poblado y destinatario
inválido. Validación final: 300/300 pruebas en 28 archivos (exit 0), build
TypeScript/Vite aprobado (exit 0) y git diff --check aprobado. Matriz real
PostgreSQL: 26/26 escenarios aprobados (exit 0), sin deadlocks 40P01.

scripts/coordination-concurrency.mjs usa dos conexiones psql y bases nuevas
ficticias. Observa wait en pg_locks/pg_stat_activity/pg_blocking_pids antes de
liberar la primera conexión; no usa sleeps como prueba. 13 pares en AB/BA:
anclas inversas; switches; completar/iniciar; cierre vs inicio/actividad/nota;
materializar/cerrar; regla/materializar; cancelar vs inicio/pausa; head/cierre;
inducción/cierre; inducción/peso. Verifica sin 40P01, 40001 o serialización válida,
receipts únicos, correlación cierre/reporte/outbox y fingerprint tras rollback.

PostgreSQL 17.11 extraído en carpeta de laboratorio, sin instalar servicio ni
crear cuentas externas. Sólo 127.0.0.1:55432; detener después de verificar.
Distribución oficial: https://www.enterprisedb.com/download-postgresql-binaries.

## Alcance de la conclusión

Evidencia concreta para esa matriz/versión, no todos los interleavings ni volumen
máximo. Auth/JWT/MFA se simulan incluso en PostgreSQL real. Faltan UI, Supabase
Auth/invitaciones/MFA/RLS reales, SMTP, Storage, recuperación y piloto.
**No aplicar011 remotamente ni migrar empleados.**

El usuario autorizó commits/push de fuente. No Sites save/deploy ni SQL remoto.
Live v43 y SQL 001–010 preservados. Avance global 42% (36–46%). Próximo B3/UI en
EXECUTION-NEXT.md.
