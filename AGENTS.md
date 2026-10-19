# Estado operativo y precedencia — actualización 19/10/2026

**Último bloque local aceptado por Sol, alcance acotado:** cuatro carreras entre
`assign_task_responsibility` y `onboarding.approve`, ambos órdenes bajo RC/RC y
RR/RR. PostgreSQL 17.11: 313/313, cero fallos/deadlocks; cuatro bloqueos reales,
resultados/replays exactos y estados finales sin duplicados. Suite 738/738;
TypeScript, builds cliente/Worker, `node --check` y diff-check con exit 0. SQL011,
013 y 014 sin cambios. Aceptación y límites:
`docs/architecture/M2-2C-RESPONSIBILITY-ONBOARDING-APPROVAL-RACES-SOL-ACCEPTANCE-20261019.md`;
manifiesto `docs/architecture/review-evidence/m2-2c-responsibility-onboarding-approval-races-luna-20261019.json`.
La rama RC aprobación-primero confirma responsabilidad `00000` porque actualiza
una tarea distinta; el replay exacto prueba idempotencia. Gate L y §9 siguen
abiertos. No aplicar SQL014.
Publicado directo a `origin/main`, sin PR: `5425d99589f5edfcca1b2224753a0c5c1d2c1332`;
`git ls-remote` confirmó el mismo SHA. El hook local reportó 196/196, aunque el
proceso `git commit` terminó con código 1 después de crear el commit y dejar el
árbol limpio. CI del push no está verificado.

**Bloque más reciente aceptado por Sol y publicado:** cuatro carreras de
`cancel_task_coverage_binding` frente a `onboarding.approve`, ambos órdenes
RC/RC y RR/RR. PostgreSQL 17.11 317/317, cero fallos/deadlocks; suite 738/738,
builds y comprobaciones con exit 0. Aceptación y límites P3:
`docs/architecture/M2-2C-COVERAGE-CANCEL-ONBOARDING-APPROVAL-RACES-SOL-ACCEPTANCE-20261019.md`;
manifiesto `docs/architecture/review-evidence/m2-2c-coverage-cancel-onboarding-approval-races-luna-20261019.json`.
Gate L/§9 siguen abiertos; SQL014 no se aplicó.
Commit directo a `origin/main`, sin PR: `4c598f575d1465ba3218af4b2da6ef3bca93aed4`;
SHA remoto confirmado. CI del push no está verificado.

## Base previamente aceptada

**Último bloque local aceptado por GPT-6.1 Sol (alcance acotado):** cuatro
carreras adicionales entre aprobación de cobertura recurrente y revocación de
membresía, RC/RC y RR/RR con ambos ganadores. PostgreSQL 17.11: 301/301;
`40P01=0`; suite 738/738 en 74 archivos; TypeScript, build cliente/Worker,
sintaxis del runner y diff-check aprobados. Evidencia:
`docs/architecture/review-evidence/m2-2c-recurrent-same-isolation-luna-20261019.json`.
Sol acepta sólo esos cuatro casos. Sus límites P3 están en el manifiesto; Gate L
y §9 siguen abiertos. Código/evidencia: `660f75dcc9a9d4a5ab698e84d3ff0ae23a0f2068`;
contrato y estado actual: `8646f10ee90371748054830ef4af81cf4904f577`. Ambos están en
`origin/main`, sin PR. GitHub devolvió una lista de checks vacía para el último
SHA; no hay CI verificado en esta sesión. El hook local pasó 196/196. SQL014 no
se aplicó remotamente.

**Siguiente vigente:** implementar el contrato
`docs/architecture/M2-2C-OPERATION-RECORD-MEMBERSHIP-REVOCATION-RACES-LUNA-20261019.md`.
Matriz local `operation.record` vs `companyMembership.setActive(false)`, cuatro
casos RC/RC y RR/RR, con outcomes exactos. No tocar SQL011/014, Supabase alojado
ni activar el espacio operativo.

**Bloques anteriores aceptados y publicados:** onboarding.requestChanges exact replay/commandReceipt y cuatro carreras mixtas de cobertura recurrente (RC/RR, RR/RC, ambos ganadores). Evidencias: `docs/architecture/review-evidence/m2-2c-onboarding-requestchanges-replay-20261018.json` y `m2-2c-gatel-recurrent-coverage-20261019.json`. El run 39184344731 corresponde al commit 873829271463b4f3bf4bbb5ad39dad978908a8d2. Gate L sigue abierto.

**Validación previa:** requestChanges y las carreras mixtas pasaron en los alcances documentados. Esto no cierra Gate L. No aplicar SQL014; Supabase dev sigue vacío y queda su configuración Data API/preflight.

El corte `onboarding.approve` publicado como `ad64854091505a2770cb93478fc34467e2aeae05` tiene Actions `39181886848` en success; esto no acredita el siguiente commit. Mantener separado SQL014 del Worker/D1. El resto del historial de este archivo conserva su valor histórico.

# Estado operativo y precedencia — actualización 19/10/2026

Este bloque tiene precedencia sobre el historial más abajo. GitHub privado
`tablerocontable-paris/TABLERO-CONTABLE` tiene publicado en `main` el corte
funcional `5803b1e4434cfc46a4ab64a26da3f76ab9d12d3d`, seguido de sincronización
documental directa. El push está confirmado, pero el conector disponible no
permite verificar los runs de Actions para eventos push.
El único Supabase es `grupo-paris-dev`, activo y vacío. La última lectura del
Dashboard mostró `public, extensions` expuestos y autoexposición activada; el
usuario ya autorizó apagarla, pero aún no se modificó. No aplicar SQL014 hasta
cerrar ese ajuste y completar Gate L. Sol aceptó el alcance local R7 de
`task.createOneOff commandReceipt` y, en esta sesión, la corrección acotada de
`assignment.create` exact replay tras revocación. La validación de este último
corte fue suite 735/735, PostgreSQL 17.11 144/144 (`40P01=0`), TypeScript y
builds cliente/Worker. Esto no cierra M2.2C/Gate L. No hay hosting Cloudflare
propio, correo transaccional ni Supabase de producción configurados. Mantener
datos ficticios y el Site privado; no abrir el espacio operativo.

El estado detallado fechado 17/10/2026 que sigue es histórico donde contradice
este checkpoint; conservarlo sólo como registro de decisiones/evidencia.

La cuenta y el repositorio GitHub privados ya están creados. El repositorio
`tablerocontable-paris/TABLERO-CONTABLE` usa `main` como rama única y flujo de
push directo; no abrir PR ni recrear `dev` sin nueva decisión del usuario. La
importación inicial es `8a10c6c19c1a619d3a621ea25af30e15f503cae0`, atribuida a
Tablero Contable y con el árbol actual del laboratorio. El workflow valida
pushes a `main`. La PR de bootstrap está cerrada y no se integró.

La conexión a Supabase/hosting no autoriza desplegar producción ni datos reales.
Precedencia vigente 17/10/2026: M2.2A-R7/R8 y M2.2B fueron aceptadas localmente
por Sol. Sol aceptó únicamente los escenarios R90 enumerados para SQL014
(checkout `3ff379002c37c43fb8c91d2b41bd47658d73d0386b2c5bc1518f22c6b4cc86c6`,
blob Git LF `7c96727b7f1ecd8c5bb2b457640b824deddc06346da3f1a70e9bdb879e730a56`)
y runner `7c48420ee61498418642ddbd2b734dc5b7d094eabed923417a2bfebf03059588`;
R90 regeneró el reporte (PostgreSQL 17.11, **128/128**, `40P01=0`). El reporte acredita las filas
6, 8, 11 y 12 en el alcance local revisado, incluida la revocación de lectura
SQL009 para encargados y conflictos/rollback/reintentos bajo RC/RR. La matriz
usa JWT sintéticos; no acredita Auth/HTTP alojado ni presencia de datos reales.
Suite 727/727 en 74 archivos, TypeScript, build cliente y Worker pasaron sobre
este corte. Esta aceptación acotada no cierra M2.2C ni Gate L completos: quedan
familias API/legacy writer, concurrencia e inyección de fallos del contrato §9.
El fix local posterior de replay `onboarding.submit` fue aceptado por Sol sólo
para los casos enumerados (SQL014 SHA256 de checkout
`13e88c8549f969187294367161c3ce6cf458d7f4618ddba40cb5058254982a26`; contenido
normalizado LF `b593618d1fcc11fe0be5e6678574faba8a013e4ac587e303d7f00d49dbe05e49`;
PostgreSQL 17.11 130/130, `40P01=0`). Está en el commit local vigente; el remoto `main` permanece en
`8cf5e8a3e6969cfe02d77c595698c5f60ddfa8f5`. Falta la revisión Sol del commit
exacto antes del push directo; no abrir PR. Continuar Gate L local. 014 sigue sin aplicar. No tocar Supabase remoto
hasta realizar y verificar el gate de exposición Data API. Producción,
Cloudflare y correo productivo siguen aparte.

# Precedencia histórica M2.2A-R7/R8 — revisión local, 15/10/2026

R7/R8 están corregidos en la migración local 014 y el runner nativo. Evidencia
vigente `docs/architecture/review-evidence/m2-2a-r7r8-implementation-20261015.json`.
El candidato actual de B registra 67/67 casos por par en PostgreSQL17.11
(RC/RC, RC/RR, RR/RC, RR/RR), incluyendo timers y transiciones legacy RR
stale→cierre con abort `40001`, retries cerrados sin filas parciales, y fence
API `task.transition` incrementado exactamente una vez; `40P01=0`. Suite
716/716 en73 archivos, focal
44/44, TypeScript, builds cliente/Worker, sintaxis y diff-check aprobados.
Esta nota es histórica para B y queda superada por el bloque operativo vigente
de C al inicio de AGENTS.md. Evidencia B:
`docs/architecture/review-evidence/m2-2b-sol-review-corrections-20261016.json`.

> **Precedencia M2.2A — revisión R6 finalizada, 15/10/2026.** R6 original resuelto (30/30); candidato `ebe1633` aún NO aceptado por R7/R8 P2: valores de revisión/cursores validados después de locks y helper de claves que acepta un conjunto esperado con NULL. Sonda nueva 8/18, nativa 3/6, con estado sin cambios; los fallos son evidencia deliberada. Se corrigió la evidencia mixta previa: sus opciones erróneas produjeron RC/RC; nuevas ejecuciones reales RC/RR y RR/RC pasan 43/43 cada una. Focales17/17, protocolo15/15 y TypeScript pasan. Producto SQL/DTO/UI/Worker sin cambios en la revisión; suite712/builds son del mismo producto anterior. Siguiente **GPT‑6 Luna medio Standard** ejecuta `docs/architecture/M2-2A-PREFLIGHT-LUNA-20261015.md`; después Sol alto acepta A y define B/C. Informe/evidencia `M2-2A-R6-SOL-REVIEW-20261015.md` / `review-evidence/m2-2a-r6-sol-review-20261015.json`. No desplegar014, iniciar B/C ni conectar cuentas en este corte. Avance ~45% histórico.

> **Precedencia M2.2A-R6 — candidato local empaquetado y verificado, 15/10/2026.** Corrección NULL-safe implementada en 014. R6 30/30, sonda independiente 9/9, pruebas previas 15/15, matrices PostgreSQL 17.11: 61/61 RC/RC, 61/61 RR/RR, 43/43 RC/RR, 43/43 RR/RC; focales 17/17; suite 712/712; TypeScript y builds cliente/Worker aprobados. Los commits `08b7405` (código) y `de38b3d` (evidencia) pasaron cada uno el hook 196/196. Bundle/ZIP de `de38b3d` verificado desde clonación limpia en `outputs/m2-2a-r6-candidate-delivery-20261015`. Próximo: GPT‑6.1 Sol, esfuerzo alto, revisión independiente del candidato. No iniciar B/C, desplegar 014 ni conectar cuentas. Evidencia `docs/architecture/review-evidence/m2-2a-r6-implementation-20261015.json`; avance ~45% histórico sin recalcular.

> PRECEDENCIA M2.2A — revisión independiente 15/10/2026: candidato 9c096973/4597e74 NO aceptado. M22A-R6 P1 confirmado en PostgreSQL17.11: expectedRevisions vacío evita la precondición y escribe movimiento/recibo/revisión. Sonda nueva3/9; matriz RR61/61 y sondas previas15/15 siguen verdes. Siguiente GPT‑6 Luna medio Standard ejecuta docs/architecture/M2-2A-NULL-SAFETY-LUNA-20261015.md; después Sol alto revisa. No iniciar B/C, desplegar014 ni conectar cuentas en este corte. Producto SQL/DTO intacto durante la revisión; los bundles anteriores son candidatos con defecto conocido. ~45% histórico sin recalcular. Esta nota reemplaza la acción del candidato anterior.

> PRECEDENCIA M2.2A — candidato local creado en 9c096973; matriz concurrente validada y bundle portátil clonado en limpio. Aceptación independiente de Sol pendiente (15/10/2026). PostgreSQL17.11: 61/61 RC/RC y 61/61 RR/RR; replay/revocación 43/43 en RC/RR y 43/43 en RR/RC; PGlite15/15, suite712/712, TypeScript, builds cliente/Worker y hook pre-commit196/196 pasan. Evidencia: docs/architecture/review-evidence/m2-2a-corrections-validation-20261015.json. Siguiente: GPT‑6.1 Sol alto revisa el candidato y define B/C. Conservar001–013/UI/Worker/Site. No desplegar014 ni conectar cuentas en este corte. ~45% histórico sin recalcular.

> PRECEDENCIA M2 — 15/10/2026: M2.1/013 aceptado localmente tras revisión independiente (PostgreSQL42/42, focales27/27, TypeScript; producto coincide con suite690/builds del14/10). Ver docs/architecture/M2-1-SOL-ACCEPTANCE-20261015.md. El contrato original A se completa con las correcciones de la nota vigente anterior. M2.2 se divide A/B/C; sólo A tiene contrato ejecutable. No desplegar014 incompleto ni iniciar015/M2.3 antes de aceptar M2.2 completo. Supabase alojado/Auth/cuentas siguen pendientes; ~45% es estimación histórica.

> PRECEDENCIA VIGENTE 14/10/2026: el usuario autorizo iniciar infraestructura propia y continuidad PC; GitHub sera cuenta NUEVA, no usar conexiones anteriores. Seguir docs/ops/MIGRATION-BOOTSTRAP-20261014.md. M0 Sol prepara inventario/respaldo; M1 Luna medio Standard consolida Git/paquete. Se permite iniciar cuentas/dev aunque siga pendiente lector humano; produccion, datos reales e invitaciones conservan gates. No activar D1/Sites como adaptador Supabase. Esta nota reemplaza las prohibiciones historicas de iniciar cuentas para este alcance.

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

Corrección técnica del 07/10/2026: los módulos propios de cada sección usan
`React.lazy` y un estado de carga accesible; los tests de integración esperan a
que la sección aparezca. El bundle principal bajó de ~593 kB a 489,53 kB. Ver
`docs/architecture/review-evidence/route-code-split-lab-20261007.json`.
Validación completa: 412/412, TypeScript, Vite, Worker y Chromium desktop/móvil.
No cambia el alcance privado ni habilita API o cuentas. Mantener el aviso del
chunk de gráficos de 405,70 kB como oportunidad separada.
El corte quedó publicado como Site v66 desde `806ff00696434f573ee0542e4710d8b383ab1406`;
deployment `appgdep_6ac5f09cccb48191910a364ef6e8f998` exitoso, owner-only.

## Definición final del usuario — 06/10/2026
100% incluye aplicación aceptada sin correcciones conocidas, GitHub, dos Supabase dev/producción, hosting propio y automatización validada. Seguir docs/ops/FINAL-ACCEPTANCE.md. No crear cuentas ni invitar usuarios durante laboratorio. No confundir CI preparado con CI ejecutado.

## Correcciones posteriores — notificaciones
Seguir docs/product/CORRECTIONS-20261006-NOTIFICATIONS.md. La activación conjunta ya genera un aviso local y se verificó desde la interfaz hasta abrir la tarea y persistir su lectura; evidencia en `docs/architecture/review-evidence/joint-notification-lab-20261007.json`. Campana y comentarios siguen aislados al laboratorio. Entrega transaccional entre dispositivos requiere revisión de identidad y permisos antes de implementarse en servidor; no conectar cuentas durante esta etapa.

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

Correcciones de interfaz 07/10: revisar
`docs/product/CORRECTIONS-20261007-UI.md` y
`docs/architecture/review-evidence/ui-corrections-lab-20261007.json`. Resumen,
Catálogo/Cierre por rol, tarjetas compactas, tema y arrastre están verificados.
Operativas, calendario/eventos, cierres de alcance múltiple y analítica necesitan
contrato GPT-6.1 Sol alto antes de implementar. Avance sigue ~45%; no crear
cuentas ni cambiar la audiencia hasta la aceptación final.

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
ni afirmar sincronización entre dispositivos. `package-lock.json` es el lockfile
existente; conservar npm y ejecutar `npm ci` en la copia de otro equipo.

## Agenda fiscal en laboratorio — 07/10/2026

La agenda de obligaciones conserva período fiscal, vencimiento, origen y
revisiones y sólo usa datos ficticios del laboratorio. No cargar vencimientos
reales ni consultar ARCA. No sincroniza la simulación entre PCs; para continuar
en otra PC usar el bundle Git actualizado después de dejar limpio el checkout,
trabajar una sola copia por vez y transferir commits de vuelta con otro bundle.

## Estado y traslado a otra PC — 07/10/2026

El flujo de propuestas de tareas habituales quedó implementado sólo en el
laboratorio y publicado en el Site privado v61 desde `0ca71bb`. Jefatura aprueba
de forma explícita antes de materializar asignaciones. No ampliar audiencia,
activar cuentas ni conectar `/api`, D1 o Supabase.

La PC personal recibe `outputs/grupo-paris-site-personal.bundle` y
`outputs/LEEME-PC-PERSONAL.md`. El bundle conserva `main` y su historial; no
incluye el `localStorage` `paris-state-lab`, por lo que no comparte la simulación
guardada en el navegador. Trabajar con una sola copia por vez y devolver commits
en otro bundle. No sincronizar la carpeta `.git` con OneDrive. Mantener el
avance global aproximado en 45%; la transferencia no adelanta aceptación ni
habilita la infraestructura final.

### Actualización local y traslado — 07/10/2026

El commit local 389528cbbd6ae1af668931f6bfdd05d499953d13 agrega reportes
imprimibles y quedó verificado según docs/PROJECT-STATUS.md. No hay confirmación
de publicación Site v62. Para la PC personal usar el bundle vigente y la guía
outputs/LEEME-PC-PERSONAL.md; no usar transferencias antiguas. El bundle
preserva código e historial, no datos localStorage ni acceso a Sites.

## Continuidad desde PC personal — 07/10/2026

El paquete vigente `outputs/grupo-paris-site-transfer-20261007.zip` incluye el
bundle Git de `main`, su historial y `outputs/LEEME-PC-PERSONAL.md`. Se puede
editar/ejecutar el laboratorio local en otra PC sin GitHub ni cuentas nuevas;
usar una sola copia a la vez y transferir commits de vuelta en otro bundle. El
estado `paris-state-lab` del navegador no viaja. Para publicar, acceder al mismo
Site privado desde la cuenta dueña; nunca incluir credenciales en el paquete.

El cierre secuencial A/B de tareas conjuntas se validó en Chromium y en la suite
completa; evidencia vigente en `docs/PROJECT-STATUS.md` y
`docs/architecture/review-evidence/joint-close-lab-20261007.json`. No trasladar
ese contrato local a D1/Supabase sin una revisión de permisos y esquema.

El arreglo se publicó como Site privado v62 desde el commit
`8d21e3245c6e4ee93aa741b4c3baf3ddc7b8b608`; deployment exitoso
`appgdep_6ac5d2df02ec8191b861bfcee8d98934`. Relectura confirmada: owner-only,
una cuenta autorizada, sin grupos ni visitantes externos. No activar APIs ni
cambiar audiencia.

## Conversión explícita de pedidos — 07/10/2026

En el laboratorio se puede convertir un pedido de trabajo en una tarea puntual,
pero sólo mediante confirmación explícita de jefatura. El pedido no crea tareas
ni afecta KPI al registrarse; la jefatura debe elegir responsable, empresa,
fecha, controles y peso. Errores técnicos y sugerencias no se convierten.
La tarea y el pedido conservan sus IDs de origen/destino, el historial cierra el
pedido y el responsable recibe la notificación ya usada para asignaciones.

Mantener validaciones de período abierto, membresía de empresa, perfil activo,
visibilidad, peso positivo e idempotencia. No trasladar esta ruta a API, D1 o
Supabase sin revisar identidad y permisos; no usar adjuntos ni datos reales.
Evidencia y cobertura: `docs/architecture/review-evidence/internal-request-conversion-lab-20261007.json`.

Actualización del 07/10/2026: la conversión de pedidos se publicó como Site
v63 desde `f7b4c661d32a753b0ab34f4120c692c880efb8b0`; deployment
`appgdep_6ac5db13c9608191bd4ab52ee27f33b2`, exitoso y con la audiencia privada
sin cambios. Para continuar en la PC personal usar el ZIP y el bundle vigentes
indicados en `docs/EXECUTION-NEXT.md` y `outputs/LEEME-PC-PERSONAL.md`. El estado
`paris-state-lab` del navegador no forma parte del repositorio ni se transfiere.

### Búsqueda rápida de tareas — 07/10/2026

Implementada en el laboratorio con atajo Ctrl+K o `/`; busca tarea, empresa,
responsable, sector, estado, período y vencimiento sin distinguir tildes y
limita cada consulta a tareas autorizadas por `canWork`. Abrir un resultado
vuelve a validar el permiso y conserva el actor activo. No buscar comentarios
privados ni conectar `/api`, D1 o Supabase. Aceptación: 412/412 tests,
TypeScript, Vite/Worker y Chromium; ver
`docs/architecture/review-evidence/quick-task-search-lab-20261007.json`.
Antes de implementar dependencias, delegación/aceptación o nuevos avisos,
revisar contratos de estado y permisos con Sol alto. Mantener la audiencia del
Site sin cambios y actualizar el bundle personal sólo después del commit.
La búsqueda quedó publicada en el Site existente v64 desde
`5ecf94e9439a4d56ceab0990877451b3a5d6ca5a`, deployment
`appgdep_6ac5e1327d7c8191919a40fbf57b4b96`, sin ampliar la audiencia.

## Copia portable del laboratorio — 07/10/2026

La interfaz de «Vista de prueba» ofrece exportar/restaurar estado ficticio para trasladarlo manualmente entre navegadores/PCs. La función sólo escribe `paris-state-lab`; mantiene prohibido leer/escribir la clave operativa al restaurar y no habilita cuentas, sincronización ni llamadas API. El JSON no está cifrado; debe guardarse de forma privada. Contrato, pruebas y límites en `docs/architecture/LABORATORY-BACKUP-CONTRACT-20261007.md`, `docs/PROJECT-STATUS.md` y `docs/EXECUTION-NEXT.md`.

La transferencia de código sigue requiriendo bundle Git. Para llevar también el estado ficticio, descargar la copia desde la banda del laboratorio y, en la otra PC, elegirla desde el mismo control y confirmar la restauración. Trabajar una sola copia de código a la vez; no sincronizar `.git` por OneDrive.

## Estado vigente de entrega — 07/10/2026

El corte funcional de avisos se publicó como v68 desde `25d1490`. La audiencia
verificada es personalizada, propietario, una cuenta autorizada, sin grupos ni visitantes externos. Los avisos locales
de vencimiento se implementaron en `paris-state-lab`: agrupación a tres días,
hoy y atrasadas; apertura de tarea y lectura persistente por perfil/regla/día
ART. Se calculan al abrir la campana; no hay scheduler, correo ni entrega entre
equipos. Contrato y evidencia: `docs/architecture/STATE-REVIEW-20261007.md` y
`docs/architecture/review-evidence/deadline-notifications-lab-20261007.json`.

El árbol actual pasó 420/420 pruebas completas, 104/104 del pre-commit,
TypeScript, Vite/Worker y Edge escritorio/móvil; no llamó a `/api`. La tarea
pendiente de continuidad inmediata es generar/verificar bundle y guía vigentes
para PC personal. No conectar cuentas reales durante la aceptación del
laboratorio.

## Estado vigente posterior: revisión del plan — 07/10/2026

La revisión actual encontró once discrepancias reproducidas y requisitos
incompletos; la implementación no está aceptada. Seguir la matriz y evidencia
en `docs/architecture/PLAN-REVIEW-20261007.md` y el contrato de correcciones
`docs/architecture/PLAN-CORRECTIONS-NEXT-20261007.md` con Luna medio Standard.
Después revisar con Sol alto Standard. El código está sin commit ni nueva
publicación. No conectar cuentas/servicios ni actualizar el Site mientras estos
defectos sigan abiertos. PROJECT-STATUS y EXECUTION-NEXT contienen el estado
vigente; los números de pruebas/publicaciones previos son registros históricos.


## Correcciones del plan — estado local 08/10/2026

### Precedencia de auditoría integral — 11/10/2026

La auditoría integral Sol sigue abierta: 60 hallazgos y 90 casos reproducidos,
con instrucciones en `docs/architecture/SOL-AUDIT-20261008.md`. Las cifras y
afirmaciones de verificación de cortes anteriores son evidencia histórica;
no acreditan aceptación actual ni autorizan commit/publicación con defectos
abiertos. Completar la revisión pendiente antes del cambio manual a Luna.
La lectura completa de migraciones no acredita Auth/RLS real ni concurrencia.

Hay correcciones locales desde la auditoría 07/10; el estado vigente y los límites están en `docs/PROJECT-STATUS.md` y `docs/EXECUTION-NEXT.md`. La suite completa más reciente pasó 494/494 en 57 archivos; TypeScript, build cliente/Worker y recorridos Edge pasaron. El cierre por empresa cuenta y confirma grupos conjuntos completos; activación, reasignación y traspaso revisan cierres parciales de todos los responsables. Edición de perfiles, recurrencias y cierre mensual exigen jefatura activa. Jefatura conserva consulta y avisos de tareas conjuntas en todo su ámbito sin membresía empresarial directa. Encargados autorizados pueden reprogramar tareas puntuales pendientes con motivo, preservando vencimiento, período y recurrencia. Evidencias en `docs/architecture/review-evidence/company-closure-group-readiness-lab-20261008.json`, `joint-task-partial-close-guard-lab-20261008.json`, `orphan-transfer-recipient-closure-guard-lab-20261008.json`, `inactive-manager-write-guard-lab-20261008.json`, `monthly-close-role-guard-lab-20261008.json`, `boss-joint-notification-access-lab-20261008.json` y `punctual-task-rescheduling-lab-20261008.json`. La auditoría de contraste ampliada evaluó 5.943 textos en 76 combinaciones, con cero fallos y cero omitidos; evidencia en `docs/architecture/review-evidence/contrast-audit-gradient-lab-20261008.json`. El flujo de evidencia aplica atómicamente el límite por tarea/movimiento, conserva ese alcance al restaurar respaldos v2, sigue aceptando respaldos v2 anteriores y preserva blobs existentes al actualizar IndexedDB v1 a v2; evidencia en `outputs/plan-validation-20261008/evidence-record-limit-final3/` y `edge-evidence-concurrency-final3/`. La historia desde cierres inmutables y los filtros de Mi día ya están implementados; evidencia en `docs/architecture/review-evidence/closed-history-lab-20261008.json` y `mi-dia-route-filters-lab-20261008.json`. Un inventario TypeScript confirma que no quedan llamadas a Panel sin control de plegado; el seguimiento está en `docs/architecture/review-evidence/cross-module-panel-folding-followup-lab-20261008.json`. La auditoría accesible con árbol de Chromium cubre 38 rutas/2.124 controles sin nombres faltantes; su script y salida están en `tests/browser-accessibility-audit.cjs` y `outputs/plan-validation-20261008/accessibility-panel-folding-final/accessibility-audit.json`. Aún faltan aceptación total y lector de pantalla. El corte sigue sin commit/PR/publicación; mantener datos ficticios, Site privado y cuentas/servicios desconectados.
