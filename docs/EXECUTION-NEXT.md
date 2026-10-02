# Próximo bloque — lecturas de tareas y sesiones

**GPT-6 Luna, medio, Standard.** Contrato ejecutable completo:
`architecture/DATA-READ-FOUNDATION.md`. Cambio manual; basta «continuá».

## Ejecución autorizada

1. Crear task-reader.ts: listTasks, findTask y listSessions con transporte
   inyectado, entradas strict, queries congeladas y filas completas validadas.
2. Paginación por UUID/id ASC y lookahead sin saltar filas; filtros de empresa,
   propietario y equipo sólo restringen SELECT autorizado por RLS del servidor.
3. Probar permisos actuales y recarga confirmada tras las RPC existentes con
   SQL parametrizado/roles simulados de AccountingLab, sin inventar estado por ACK.
4. npm test, build, diff-check, evidencia nueva, commit/push y Sites privado.
   Después revisión Sol 6.1 medio, antes del coordinador asíncrono.

Revisión precedente: architecture/REVIEW-DATA-ADAPTER-20261002.md, fuente v30
`723b0693079610bde0141c67e6dd8eb6a13796dc`. ADP-R01 corregido: no perder precisión
sub-milisegundo al comparar tiempos. 175 pruebas/15 archivos y build correctos;
checker 23 reutilizado por hashes verificados. Evidencia nueva review-evidence/
data-adapter-review-20261002.json; la evidencia anterior queda preservada.

Para ejecutar usar como base el commit que contiene esta revisión. SQL 001–008,
gateway, App/repositorio local, dependencias y evidencias previas congelados.
La página aún usa datos locales: sin cuentas, red, aplicación SQL ni cambio de
políticas/roles. No migrar empleados, ejecutar PostgreSQL --run o enviar correo.

Grado de avance estimado: 40%, margen 35–45%, según PROJECT-STATUS.md. Auth,
MFA/RLS/correo reales, concurrencia PostgreSQL y piloto siguen pendientes.
Auth/administración nueva requiere Sol alto. Infraestructura futura:
ops/AUTOMATED-DELIVERY.md.
