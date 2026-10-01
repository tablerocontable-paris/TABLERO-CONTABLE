# Próximo bloque — ajuste de guía R008-F01

**GPT-6 Luna, medio, Standard.** Cambio manual; basta «continuá» y no se delega
para sustituir ese cambio. Revisión actual:
`architecture/REVIEW-008-FINAL-20261001.md`, fuente v26
`bdb87e235e3871d1f6f3d712834812fb78b3a48c`.

## Contrato cerrado

Ejecutar íntegramente `architecture/TIME-COVERAGE-GUIDE-FIX.md`:

1. Actor B de expiry-wait será jefe MFA en ambos órdenes.
2. Añadir aceptación secuencial del renderer antes del corte, sin pg_sleep ni
   conexión PostgreSQL; 23 casos locales, 24 pares reales todavía NO EJECUTADO.
3. Actualizar guía y evidencia nueva. Preservar SQL 001–008, frontend y todos los
   diagnósticos/evidencias anteriores. No dar permisos nuevos al empleado.
4. Verificar, commit/push y Sites privado del mismo SHA. No interrumpir entre
   pasos de este contrato. Después revisión acotada **Sol 6.1 medio**.

La revisión acepta localmente R008-01. No reabrir SQL ni repetir toda la revisión
de cronómetros para corregir una llamada de la guía. Tras cerrar este ajuste,
Sol prepara integración frontend/SQL y sus gates.

## Grado de avance y límites

Ver `PROJECT-STATUS.md`. Demo avanzada y contrato SQL local preparado; producto
final todavía requiere integración, cuentas/permisos reales, funcionalidades
restantes, pruebas concurrentes, correo, recuperación y piloto.

No crear Gmail/GitHub/Supabase/hosting, ejecutar --run, aplicar SQL remoto, migrar
empleados ni enviar correo. Cuenta dedicada y operación dev/prod automática
siguen anotadas en PRODUCT-ROADMAP.md y ops/AUTOMATED-DELIVERY.md.
