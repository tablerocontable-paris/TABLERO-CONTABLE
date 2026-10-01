# Próximo bloque — fundación del adaptador de tareas

**GPT-6 Luna, medio, Standard.** Contrato ejecutable completo:
`architecture/DATA-ADAPTER-FOUNDATION.md`. Cambio manual; basta «continuá».

## Ejecución autorizada

1. Completar assertions de guía sobre identidad dentro del B renderizado,
   motivo, una sesión y receipt de seed. Mantener 23 casos secuenciales.
2. Crear contratos de filas task_instances/task_time_sessions y gateway tipado
   para seis RPC. Transporte inyectado, operations inmutables y reintentos con
   la misma clave; ninguna conexión ni activación remota en la app.
3. Aceptación de frontera y composición con SQL parametrizado/roles simulados
   en AccountingLab. Conservar pruebas, SQL 001–008 y frontend existentes.
4. Checker/emisión sin --run, npm test, build, diff-check, evidencia nueva,
   commit/push y Sites privado del mismo SHA. Después revisión Sol 6.1 medio.

Revisión anterior: `architecture/REVIEW-GUIDE-FIX-20261001.md`, fuente v28
`f916d1b2bb567f133a7c51d4559b3cfaffee1c07`. Actor corregido aceptado; pequeñas
assertions adicionales incorporadas al paso 1, sin modificar permisos.

Grado de avance estimado: 40%, margen 35–45%, según PROJECT-STATUS.md. No
aumentarlo sólo por haber preparado este contrato. La demo usa datos locales;
la integración real, Auth/MFA/RLS, correo, concurrencia y piloto siguen pendientes.

No crear cuentas ni servicios nuevos, aplicar SQL remoto, ejecutar --run,
migrar empleados ni enviar correo. Futuro dev/prod y entregas automáticas:
ops/AUTOMATED-DELIVERY.md. Nuevas decisiones de arquitectura vuelven a Sol alto.
