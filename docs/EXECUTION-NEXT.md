# Próxima ejecución del proyecto

Repositorio: `work/site`. Continuar el mismo proyecto y Git. No reconstruir ni
consultar el chat anterior.

## Estado vigente

El laboratorio privado conserva simulación y datos ficticios en
`LaboratoryWorkspace` / `paris-state-lab`; no llamar a la API operativa, no
activar `RemoteWorkspace`, no crear cuentas ni enviar invitaciones reales. SQL
Supabase 001–011 y Worker/D1 siguen separados. Audiencia actual del Site:
privada.

La agenda de obligaciones fiscales por empresa ya está implementada en el
laboratorio: separa período fiscal y vencimiento, registra fuente/revisión,
vincula tareas exactas y deriva el cumplimiento. No contiene vencimientos
oficiales ni consulta ARCA. Evidencia y límites en `docs/PROJECT-STATUS.md` y
`docs/architecture/review-evidence/fiscal-obligations-lab-20261007.json`.

El último bloque funcional es el flujo de propuestas de tareas habituales del
onboarding: preserva título, empresa y frecuencia; jefatura revisa, pide cambios,
vincula un estándar compatible o crea una versión y aprueba explícitamente antes
de asignar tareas independientes por empresa. Sigue aislado en el laboratorio.
El código quedó en `0ca71bb17da997251155d82d5e83355ab12a5c8c` y se publicó como
Site v61 en el mismo sitio privado; la audiencia continúa owner-only. Ver
`docs/PROJECT-STATUS.md`.

El usuario quiere continuar desde su PC personal antes de crear cuentas. No hay
remoto GitHub propio y la cuenta sigue pospuesta hasta la aceptación final. La
copia portable vigente se entrega como `outputs/grupo-paris-site-personal.bundle`
junto con `outputs/LEEME-PC-PERSONAL.md`, generados después de dejar el checkout
limpio y comprometido. Transferir ambos archivos por USB o una carpeta de
archivos; clonar el bundle en Codex de la PC personal y trabajar una sola copia
por vez. No sincronizar `.git` con OneDrive. `paris-state-lab` vive en el
almacenamiento local del navegador y no viaja en el bundle; la simulación puede
comenzar con sus datos ficticios iniciales en el otro equipo. La sincronización
automática entre PCs requiere configurar GitHub privado en la etapa final.

El bloque Trello-like está implementado en `65ae477`. La responsabilidad
conjunta está implementada en el laboratorio local; contrato, alcance y límites
en `docs/architecture/JOINT-LABORATORY-CONTRACT-20261006.md`. No equivale a
colaboración en línea o a permisos de producción.

## Cobertura y bajas locales implementadas; siguiente trabajo

La cobertura ya incluye tareas puntuales y reglas recurrentes seleccionadas;
previsualiza ocurrencias y aplica acceso al materializarlas. Mantiene al titular,
atribuye cronómetros al reemplazante, limita accesos por empresa/equipo y revoca
relojes al cancelar o vencer. Contrato y evidencia en
`docs/architecture/COVERAGE-LAB-CONTRACT-20261006.md`.

La baja conserva cierres/historia, detiene relojes propios y pausa reglas
recurrentes. El trabajo futuro limpio queda en la bandeja para reasignar;
actividad existente se resuelve con un traspaso explícito auditable. Contrato:
`docs/architecture/PROFILE-DEACTIVATION-LAB-CONTRACT-20261006.md`.

El traspaso conserva el snapshot completo, sesiones atribuidas al actor,
actividad, comentarios, motivo e identidades; actualiza propietario/equipo en la
misma tarea y aparece en la bandeja, cierres, informes y CSV. No acredita el
tiempo anterior al nuevo responsable. Las tareas conjuntas quedan para revisión
manual porque modificar cuotas necesita un contrato separado.

Auditoría de cierres y exportaciones completada en el laboratorio: las tareas
conjuntas aparecen en el cierre de cada miembro, el cálculo respeta la cuota y
el CSV separa contribución personal de peso global. También se impide cerrar con
un perfil actor inactivo. Evidencia reciente en `docs/PROJECT-STATUS.md`.

## Consultas y pedidos: alcance actual y revisión necesaria

La interfaz local quedó implementada según el criterio funcional del bloque D:
tipos separados, urgencia, módulo, destinatario explícito para sugerencias,
visibilidad, estados, respuesta e historial. Evidencia y límites en
`docs/PROJECT-STATUS.md` y
`docs/architecture/review-evidence/internal-requests-lab-20261006.json`.
No integrar su esquema en D1/Supabase todavía: la cola de soporte no tiene una
cuenta de identidad, y persistencia/entrega entre dispositivos requiere revisión
de permisos y diseño de servidor.

Continuar revisando las rutas operativas restantes del laboratorio contra
`docs/PRODUCT-ROADMAP.md` y los contratos vigentes, implementando sólo cambios ya
definidos. Mantener fuera del alcance Auth, cuentas, `/api`, Worker/D1 y SQL
remoto. Antes de portar al backend reglas nuevas sobre transferencia conjunta
o retenciones, volver a GPT-6.1 Sol alto para revisar el contrato.
Referencias: filas 4, 13 y 14 de
`docs/product/CORRECTIONS-20261002.md` y regla de cobertura de
`docs/product/CONSISTENCY-RULES.md`. Mantener el alcance en laboratorio antes de
alterar relaciones o el backend activo.

Si los criterios existentes de baja/reasignación bastan: GPT-6 Luna, esfuerzo
medio, velocidad Standard, para implementar y verificar. Si aparece una decisión
nueva de permisos/jerarquía, usar GPT-6.1 Sol, esfuerzo alto, Standard, sólo para
revisar esa decisión antes de volver a Luna.

Próximo cambio de modelo: **GPT-6.1 Sol, esfuerzo medio, Standard** para revisar
el módulo de consultas local y definir qué funcionalidades pendientes pueden
cerrarse en laboratorio sin crear un contrato de producción prematuro. Cualquier
esquema/backend o identidad de soporte exige **esfuerzo alto** antes de volver a
Luna.

Evidencia del bloque más reciente: 371 pruebas en 36 archivos, TypeScript/Vite,
Worker build, pre-commit 53/53 y Chromium desktop/móvil aprobados; cero errores
JS y solicitudes a `/api` operativa. El Site privado v57 publicó el commit
`c080a52ce5ca6b6d949be7fa3888e7bf85f1b8a0`; deployment confirmado y acceso
owner-only. Ver `PROJECT-STATUS.md` para límites y avance.

## Entrega

Para cambios del Site: suite completa, build, Chromium desktop/móvil,
pre-commit, commit, sincronizar la fuente interna y publicar el mismo Site
privado. Guardar evidencia y actualizar `PROJECT-STATUS.md`, `AGENTS.md` y este
archivo. No cambiar audiencia.

## Avance y aceptación final

Avance global orientativo: ~45%; no es una medición exacta ni sube por pasar
pruebas. El 100% requiere producto aceptado sin correcciones conocidas, GitHub
propio, dos proyectos Supabase dev/producción, hosting propio y automatización
validada según `docs/ops/FINAL-ACCEPTANCE.md`. No conectar cuentas hasta aceptar
el producto final.

El empaquetado portable está disponible en `scripts/package-site-archive.mjs`
(`node scripts/package-site-archive.mjs <ruta-absoluta>` o `npm run package:site
-- <ruta>`). En esta PC el script del plugin puede fallar al invocar `bash`
después de sincronizar la fuente; el helper resuelve la generación/validación del
tar, no reemplaza la comprobación de push, commit ni despliegue nativo.

## Ciclo de trabajo mensual — 06/10/2026

Implementado sólo en el laboratorio local: vistas de día y semana, planificación
por fecha de ocurrencia, ejecución por fecha real, tiempo repartido entre días
ART, registros/cantidades operativas separados por unidad y desglose por persona,
equipo, sector o empresa. Las cuotas conjuntas conservan una ocurrencia global;
los nuevos cierres guardan actor y cierres históricos sin ese dato quedan sin
atribución. No infiere capacidad ni tiempo libre, no activa API o sincronización.

Evidencia: 378/378 pruebas en 37 archivos; TypeScript, Vite y Worker; Chromium
Edge escritorio/móvil 390×844, 31 días del período y desglose de equipo; cero
errores JS y llamadas a `/api`. Ver
`architecture/review-evidence/work-cycle-lab-20261006.json`.

Este corte se publicó como **Site v58** desde `c41bb7a9f9dcee2408b1b714af440f89914814dd`;
el deployment privado terminó correctamente y sigue owner-only. Siguiente paso:
**GPT-6.1 Sol, esfuerzo medio, Standard** para revisar atribución, cortes de fecha y límites del ciclo, y
contrastar el contrato local de Kaizen/5S con la versionación actual del catálogo.
Luego, si no aparece una decisión de permisos/esquema, volver a **GPT-6 Luna,
esfuerzo medio, Standard** para implementar el contrato que quede confirmado.

## Mejora Kaizen/5S y continuidad en otra PC — 06/10/2026

El bloque de mejora de procesos está implementado localmente y validado: 385
pruebas, TypeScript, Vite/Worker y Edge desktop/móvil; evidencia en
`architecture/review-evidence/process-quality-lab-20261006.json`. Sigue aislado
en el laboratorio; no se conectaron cuentas ni se habilitó sincronización.

El checkout actual trabaja en `main` y no tiene remoto GitHub propio. La regla
vigente posterga esa cuenta hasta aceptar el producto final. Para usar otra PC
antes de esa etapa, transferir un snapshot Git portable después de dejar el
checkout limpio; trabajar en una sola PC por vez y devolver el snapshot al
finalizar. No sincronizar la carpeta `.git` con OneDrive ni editar dos copias en
paralelo. La sincronización automática permanente entre PCs queda para el
remoto privado de GitHub previsto en `docs/ops/FINAL-ACCEPTANCE.md`.

El código quedó en `27918d3f7b311e2a596fa6961fb240b4fdf7b8ee` y publicado como
Site v59, deployment `appgdep_6ac5b2ff99d481919f73e8cff76d16b5`; el estado owner-only
no cambió. `package-lock.json` es el lockfile original del proyecto; mantener
npm como gestor y usar `npm ci` al clonar en otra PC.

Próxima acción: copiar `outputs/grupo-paris-site-personal.bundle` y
`outputs/LEEME-PC-PERSONAL.md` a la PC personal, clonar el bundle y abrir la
carpeta en Codex. Para traer commits de vuelta, crear allí un bundle actualizado
e importarlo en este checkout. No existe sincronización automática entre equipos
todavía; GitHub privado sigue pospuesto hasta la aceptación final. Para el
próximo bloque de implementación ya definido: **GPT-6 Luna, esfuerzo medio,
Standard**. Para revisar arquitectura, permisos o decidir sobre GitHub:
**GPT-6.1 Sol, esfuerzo medio o alto según el riesgo, Standard**.

## Transferencia actualizada — 07/10/2026

El laboratorio local avanzó al commit 389528cbbd6ae1af668931f6bfdd05d499953d13,
que agrega reportes imprimibles. La última transferencia anterior terminaba en
c8db26d; fue reemplazada por el bundle completo descrito en
outputs/LEEME-PC-PERSONAL.md y su ZIP contenedor. El checkout estaba limpio
antes de documentar esta actualización.

La transferencia incluye el historial Git y el código comprometido, pero no el
estado ficticio guardado en el navegador ni dependencias instaladas. El usuario
debe trabajar en una sola PC por vez. Clonar no publica ni conecta cuentas.
La última publicación confirmada en el estado previo sigue siendo v61; no afirmar
v62 hasta verificar un despliegue de ese commit.

Próximo paso en la PC personal: extraer el ZIP, clonar el bundle según la guía,
ejecutar npm ci y abrir la carpeta site en Codex. Luego continuar los
pendientes documentados del laboratorio sin activar cuentas ni /api.
