# Grupo París

- Trabajar exclusivamente en este proyecto nuevo. El repositorio y los servicios legacy son referencias de lectura.
- No subir secretos ni cargar datos productivos en la demostración. No confundir Sites privado con autenticación/RLS de la app.
- Mantener identidad empresa/asignación/período, snapshot de pesos y cierre íntegro por empleado.
- Esquema remoto sólo en supabase/migrations; una migración aplicada no se edita. No aplicar SQL remoto sin seleccionar explícitamente el proyecto nuevo.
- Verificar npm test y npm run build antes de publicar; guardar el código exacto en Git y desplegar su build. Mantener la audiencia privada.
- No declarar lista la migración de empleados hasta verificar Auth, invitaciones, MFA, RLS e integración contra Supabase real.
- Automatización objetivo de Git/dev/prod, pre-commit y entrega: seguir `docs/ops/AUTOMATED-DELIVERY.md`; esa infraestructura aún no existe.

## Decisiones posteriores del usuario

- Continuar en Sites hasta validar el producto. Sólo entonces crear GitHub, Supabase y hosting nuevos con cuenta dedicada propuesta tablerocontable@gmail.com. No crear esos recursos ahora.
- Juan Pablo es gerente y administrador de usuarios/parámetros. Valentino es empleado y tendrá una cuenta técnica separada del trabajo/KPI.
- No restablecer las decisiones legacy que descartaban cronómetro: el pedido actual lo requiere. Pruebas de escritura exclusivamente en laboratorio aislado; diagnóstico real autorizado y auditado.
- Respetar reglas y pendientes en docs/PRODUCT-ROADMAP.md. No conectar frontend 0.4 a contrato SQL 0.3 sin adaptar y probar.
- Integrar pedidos nuevos según docs/product/CONSISTENCY-RULES.md: registrar cruces con reglas existentes y comprobar los criterios acordados. Implementado y pruebas verdes no significan aceptación completa. Mantener AGENTS/EXECUTION-NEXT/PROJECT-STATUS alineados; los documentos cronológicos conservan evidencia histórica.

## Modelos y devolución de cada ejecución (pedido 01/10/2026)

- Planificación habitual y revisión acotada: **GPT-6.1 Sol**, esfuerzo medio. Arquitectura, permisos, migraciones y fallos complejos: esfuerzo alto.
- Ejecución de instrucciones ya definidas: **GPT-6 Luna**, esfuerzo medio; bajo sólo para cambios simples. Si aparece una decisión nueva o un problema complejo, volver a Sol antes de ejecutar otra solución.
- Preferir velocidad Standard; no activar Fast para ahorrar cupo. Política, fuentes y límites del plan Plus: `docs/WORKFLOW-MODELS.md` (actualizada por pedido del usuario).
- Al terminar cada ejecución: revisar alcance, cambios, comprobaciones y pendientes. En cada devolución final indicar el modelo recomendado para el próximo paso y su propósito.
- Si el entorno permite seleccionar el modelo, respetar esta separación. Si no permite cambiarlo, decirlo brevemente y recomendar el modelo que el usuario debe seleccionar. Nunca afirmar que se usó un modelo sin verificarlo ni prometer ahorro medido sin evidencia.
- Esta regla se aplica también después de reinicios/compacción de contexto. Mantener instrucciones ejecutables concretas para Luna, con criterios de aceptación y sin decisiones arquitectónicas abiertas.

## Continuidad sin interrupciones — pedido 01/10/2026

- Continuar autónomamente entre pasos/revisiones que usan el mismo modelo; no terminar cada bloque para pedir «continuar».
- Detenerse al llegar a un cambio de modelo necesario y comunicar modelo, esfuerzo y contrato concreto preparado. El usuario hará el cambio manual. No delegar ni simular un cambio de modelo para sortear esta preferencia.
- Próxima fase vigente: **GPT-6.1 Sol, esfuerzo medio, Standard**. Revisar lector local ya completo en `architecture/REVIEW-DATA-READ-ACCEPTANCE-20261002.md` sobre commit v33 `4a8bdb4d643d318cd39c8aec021afd4d7446c2c9`; 189 pruebas/17 archivos y build correctos. READ-R01–03 se completaron en AccountingLab, incluida tabla fija y recargas posteriores a RPC/switch/cobertura. Confirmar evidencia/matriz y límites antes de diseñar coordinador; Auth/administración/presencia con nuevas políticas requieren Sol alto.
- En la corrección se preservaron SQL 001–008 y evidencia histórica; no se alteraron permisos ni se creó 009. Concurrencia PostgreSQL, integración y Supabase Auth/invitaciones/MFA/RLS/correo reales siguen pendientes; no aplicar SQL remoto, migrar empleados ni declarar producción. Grado de avance: `docs/PROJECT-STATUS.md`.
