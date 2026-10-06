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
- Pedidos vigentes 02/10: `docs/product/CORRECTIONS-20261002.md`. Equipos jerárquicos multiarea; tablero personal por defecto; coincidencias de tareas se proponen y Juan Pablo confirma; agenda ligada explícitamente a cumplimiento. Tareas conjuntas/coberturas conservan identidad única y contribuciones sin doble KPI. Comentarios privados requieren datos/políticas separados, no ocultamiento visual.

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
- Completar una fase entera del mismo modelo (corrección, implementación y verificaciones necesarias); no fraccionarla para pedir continuar después de una subtarea. Pedido de sesiones más largas del 06/10/2026. Detenerse sólo por cambio necesario de modelo o bloqueo concreto.
- B1/009 reparado y B2a/010 revisado independientemente. Protocolo011 cerrado el06/10: `docs/architecture/COORDINATION-011-CONCURRENCY-20261006.md`, obligatorio junto al contrato `COORDINATION-011-EXECUTION-20261004.md`. Próxima fase: **GPT-6 Luna, esfuerzo medio, Standard**, implementar todo011 local, pruebas, documentación y commit/push; revisión posterior Sol alto. Sustituir todas las rutas escritoras en una migración, no activar por partes. Las siete pruebas del modelo abstracto no sustituyen PostgreSQL real. Mantener live v43 y SQL remoto sin aplicar.
- Se preservaron SQL 001–008 y evidencia histórica; no se aplicó SQL remoto. Concurrencia PostgreSQL, integración y Supabase Auth/invitaciones/MFA/RLS/correo reales siguen pendientes; no migrar empleados ni declarar producción. Grado de avance: `docs/PROJECT-STATUS.md`.

## Pedido vigente06/10: versión privada utilizable en Sites

- Este pedido sustituye la ejecución aislada de011 y la prohibición anterior de cambiar App o publicar. Continuar el recorrido diario, datos compartidos y despliegue privado del mismo Site.
- La aplicación publicada1.0 usa Worker+D1 de Sites con identidad real del dispatcher. Los contratos Supabase históricos permanecen intactos/no aplicados y no se confunden con el backend activo.
- No volver a localStorage ni al selector que suplanta usuarios. Propietario: administración técnica/e0 solamente; empleado ordinario: identidad fija. Roles, empresas, notas y cierres se validan en servidor.
- Preservar audiencia sólo propietario. Configurar perfiles no autoriza invitaciones ni cambios de visibilidad.
- Ver docs/PROJECT-STATUS.md, docs/EXECUTION-NEXT.md y docs/runbooks/SITES-PRIVATE-1.md, que son el estado vigente; cronología anterior es evidencia histórica.
- Pruebas automatizadas/DOM y SQLite no equivalen a QA visual ni piloto real. No declarar listas secundarias o migración masiva que no se hayan ejecutado.
