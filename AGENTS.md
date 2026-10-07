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
- B1/009 y B2a/010 conservados. SQL 011 completado localmente en 65e8391; prepare/acquire/revalidate, reportes v4, cobertura precisa y cancelación. Evidencia: docs/architecture/COORDINATION-011-CONTINUATION-20261006.md. Revisar Sol alto antes de adaptar esta ruta al backend activo D1; no aplicar SQL remoto.
- Se preservaron SQL 001–010 y evidencia histórica. PostgreSQL 17.11: 26/26 escenarios concurrentes aprobados; servicios Supabase/Auth reales no probados. D1 usa sus propios contratos y migraciones.

## Pedido vigente06/10: versión privada utilizable en Sites

- Este pedido sustituye la ejecución aislada de011 y la prohibición anterior de cambiar App o publicar. Continuar el recorrido diario, datos compartidos y despliegue privado del mismo Site.
- La aplicación publicada1.0 usa Worker+D1 de Sites con identidad real del dispatcher. Los contratos Supabase históricos permanecen intactos/no aplicados y no se confunden con el backend activo.
- No volver a localStorage ni al selector que suplanta usuarios. Propietario: administración técnica/e0 solamente; empleado ordinario: identidad fija. Roles, empresas, notas y cierres se validan en servidor.
- Preservar audiencia sólo propietario. Configurar perfiles no autoriza invitaciones ni cambios de visibilidad.
- Ver docs/PROJECT-STATUS.md, docs/EXECUTION-NEXT.md y docs/runbooks/SITES-PRIVATE-1.md, que son el estado vigente; cronología anterior es evidencia histórica.
- Pruebas automatizadas/DOM y SQLite no equivalen a QA visual ni piloto real. No declarar listas secundarias o migración masiva que no se hayan ejecutado.


## Integración de continuidad local — 06/10/2026

Se recuperaron los commits originales cf6fc23/2c60379/54117ea y se completó
SQL 011 en 65e8391. Evidencia: docs/architecture/COORDINATION-011-CONTINUATION-20261006.md.
Antes de integrar este backend D1: 300 pruebas aprobadas y 26 carreras PostgreSQL
aprobadas. El backend D1 recibido del remoto se conserva como ruta activa separada;
SQL Supabase no se aplica ni se conecta automáticamente a esa UI.
Este chat autoriza sincronizar fuente, sin desplegar ni ampliar audiencia.
La documentación remota de publicación describe el trabajo previo; no constituye
una nueva autorización de despliegue. La estimación histórica 42% corresponde al
alcance original completo y debe reevaluarse tras aceptar el nuevo alcance D1.


## Decisión vigente posterior — laboratorio hasta la versión final

El usuario rechazó expresamente comenzar cuentas e invitaciones antes del 100%
y pidió recuperar simulación/datos ficticios. La entrada vuelve a ser
LaboratoryWorkspace, aislada en paris-state-lab y sin llamadas a la API operativa.
No activar RemoteWorkspace ni enviar invitaciones reales durante esta etapa.
Las correcciones de la vista privada de pruebas se conservan en el mismo Sites,
sin ampliar audiencia. Contrato: docs/product/CORRECTIONS-20261006-LABORATORY.md.
PROJECT-STATUS y EXECUTION-NEXT son el estado vigente; anteriores afirmaciones
de producto operativo describen el corte histórico superado por este pedido.
Avance orientativo 45–50%; no 100%.

## Definición final del usuario — 06/10/2026
100% incluye aplicación aceptada sin correcciones conocidas, GitHub, dos Supabase dev/producción, hosting propio y automatización validada. Seguir docs/ops/FINAL-ACCEPTANCE.md. No crear cuentas ni invitar usuarios durante laboratorio. No confundir CI preparado con CI ejecutado.

## Correcciones posteriores — notificaciones
Seguir docs/product/CORRECTIONS-20261006-NOTIFICATIONS.md. Continuar sin conexiones hasta imposibilidad técnica concreta. La campana y los comentarios funcionan sólo en laboratorio; entrega transaccional en servidor y activación conjunta siguen pendientes de integración.

## Contrato conjunto — 06/10/2026
La implementación local de docs/architecture/JOINT-LABORATORY-CONTRACT-20261006.md está completada y publicada; ver el estado y sus límites más abajo.

## Estado vigente posterior — 06/10/2026
El contrato de tareas conjuntas ya está implementado en el laboratorio local;
ver evidencias y límites en PROJECT-STATUS.md y
architecture/JOINT-LABORATORY-CONTRACT-20261006.md. Continúan fuera de alcance
Auth, API/D1, Supabase y colaboración entre computadoras. Los cambios aprobados
de la vista de laboratorio se pueden sincronizar y publicar en el mismo Site
privado sin cambiar audiencia. La cobertura selectiva, incluyendo reglas
recurrentes previstas, está implementada en el laboratorio; la siguiente etapa
es cerrar bajas/reasignaciones e historial antes de cambiar permisos del backend.

## Ciclo de trabajo mensual — 06/10/2026

El ciclo día/semana se muestra sólo en Análisis del laboratorio local. No
conectarlo al backend ni compartir datos entre navegadores en esta fase. Carga
planificada usa `scheduledOn`; carga real usa sesiones repartidas por fecha
Argentina, registros operativos con unidades separadas y cierres fechados. No
deducir capacidad/tiempo libre. Las tareas compartidas suman una sola vez al
total y sus puntos planificados se distribuyen por cuotas. `completedBy` es
opcional y sólo se captura para nuevas finalizaciones de esta simulación; no
inventar actor para cierres históricos. Evidencia actual en
`docs/PROJECT-STATUS.md` y
`docs/architecture/review-evidence/work-cycle-lab-20261006.json`.
El corte funcional se publicó en el mismo Site privado como v58 desde el commit
`c41bb7a9f9dcee2408b1b714af440f89914814dd`; confirmar fuente, versión y
audiencia antes de anunciar posteriores actualizaciones.

## Continuidad de bajas — 06/10/2026
La baja/reasignación directa de tareas futuras limpias está implementada sólo
en el laboratorio. Mantener `docs/architecture/PROFILE-DEACTIVATION-LAB-CONTRACT-20261006.md`
como contrato vigente. El traspaso explícito de tareas iniciadas también quedó
implementado sólo en el laboratorio, con historial auditable, reloj por actor,
reporte y CSV. Las tareas conjuntas requieren revisión manual. No portar estas
mutaciones a D1/Supabase sin revisión de permisos y aceptación.

## Cierres y exportaciones — 07/10/2026
La tabla de cierre incorpora tareas conjuntas con KPI por cuota; el CSV separa
ponderación global de puntos y tiempo personal. Un actor inactivo no puede cerrar.
Ver `docs/PROJECT-STATUS.md` para la evidencia del corte y `docs/EXECUTION-NEXT.md`
para el próximo bloque. Mantener el Site privado y publicar sólo sobre la misma
identidad ya configurada, sin cambiar la audiencia. La versión 54 quedó publicada
correctamente desde el commit `608fb478bb5b8010c22431451b92fd664f424b65`.

## Empaquetado portable — 07/10/2026
El empaquetador del plugin de Sites usa Bash y puede fallar en Windows. Para
crear/validar el archivo Worker desde el build, usar
`node scripts/package-site-archive.mjs <ruta-absoluta>` o `npm run package:site`;
después verificar por separado que push, versión y deployment terminaron bien.

## Consultas y pedidos internos — laboratorio local

La interfaz local separa error técnico (cola de soporte simulada), pedido de
trabajo (Juan Pablo) y sugerencia (destino explícito). Autor, destinatario y
jefatura pueden ver el seguimiento; los destinatarios actualizan estado y
responden. Urgencia/antigüedad ordenan los abiertos; el historial permanece
visible aun cuando se resuelven. No se crean tareas ni se alteran KPI. No usar
datos reales ni adjuntos: la colección vive en `paris-state-lab` del navegador,
no sincroniza dispositivos, no existe una cuenta de soporte conectada y no hay
entrega por servidor. No portar a API/D1/Supabase sin revisión Sol del contrato
de almacenamiento, identidad técnica y permisos.

## Mejora de procesos y trabajo desde otra PC — 06/10/2026

Kaizen/5S y versionado de catálogo están implementados sólo en el laboratorio
local; revisar `docs/PROJECT-STATUS.md` y su evidencia antes de ampliar alcance.
No portar su almacenamiento/permisos a D1 o Supabase sin revisión arquitectónica.
El checkout no tiene remoto GitHub propio; hasta la aceptación final no crear
esa cuenta. Para una PC personal, usar un bundle portable con el mismo historial
y trabajar una sola copia a la vez; no sincronizar `.git` por carpeta compartida
ni afirmar sincronización entre dispositivos.
