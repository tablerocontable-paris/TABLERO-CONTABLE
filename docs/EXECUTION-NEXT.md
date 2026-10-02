# Próximo bloque — completar aceptación del lector

**GPT-6 Luna, esfuerzo medio, Standard.** Basta «continuá» después del cambio
manual. Contrato cerrado: `architecture/DATA-READ-ACCEPTANCE-COMPLETION.md`.

Revisión de v32, fuente `0a73c2ed1407746ae01eafcd9298aa9ba0f53449`:
`architecture/REVIEW-DATA-READ-20261002.md`. Lector implementado, aceptación
pendiente: 182 pruebas/17 archivos y build correctos, pero no demuestran los
escenarios ausentes. No avanzar al coordinador todavía.

## Ejecución autorizada

1. READ-R03: table literal fija en cada variante/query del lector; no input table.
2. READ-R02: completar unitarias de límites, arrays clonados/congelados, UUID con
   letras/case real, cursores, filas/envelopes adversarios y fallos por método.
3. READ-R01: completar SELECTs parametrizados bajo authenticated con empleado,
   encargado, jefe y outsider; tres páginas/empresas, cobertura/cancelación,
   sesiones históricas sin padre visible y recargas tras RPC/switch. Snapshots
   antes/después verifican que lecturas fallidas no escriben.
4. Matriz criterio→assertions, npm test, build, diff-check y evidencia nueva.
   Commit/push y Sites privado del mismo SHA. Después revisión Sol 6.1 medio.

Usar el commit que contiene esta revisión como base de ejecución. SQL 001–008,
gateway, esquemas de filas, App/repositorio local, dependencias y evidencia previa
congelados. Si se reproduce un defecto fuera del alcance, guardar evidencia y
volver a Sol; no improvisar reglas ni ampliar permisos para pasar pruebas.

El pedido de presencia/última conexión quedó registrado en PRODUCT-ROADMAP.
Cronómetro local funciona en demo, sin sincronización real; presencia no existe
todavía. Reglas de coherencia: `product/CONSISTENCY-RULES.md`.

Avance estimado: 40% (35–45%). Sin SQL remoto, cuentas, correo ni migración de
empleados. PostgreSQL concurrencia, Auth/MFA/RLS/PostgREST reales y piloto siguen
pendientes. Auth/administración/presencia con políticas nuevas requiere Sol alto;
infraestructura futura: `ops/AUTOMATED-DELIVERY.md`.
