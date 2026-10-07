# Próxima ejecución del proyecto

Repositorio: `work/site`. Continuar el mismo proyecto y Git. No reconstruir ni
consultar el chat anterior.

## Estado vigente

El laboratorio privado conserva simulación y datos ficticios en
`LaboratoryWorkspace` / `paris-state-lab`; no llamar a la API operativa, no
activar `RemoteWorkspace`, no crear cuentas ni enviar invitaciones reales. SQL
Supabase 001–011 y Worker/D1 siguen separados. Audiencia actual del Site:
privada.

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

Siguiente: auditar los circuitos de cierre y sus exportaciones, y ampliar las
pruebas de materialización diaria, semanal y de varios meses. Luego revisar con
Sol el contrato conjunto de transferencias/retenciones antes de portar cualquier
regla al backend activo.
Referencias: filas 4, 13 y 14 de
`docs/product/CORRECTIONS-20261002.md` y regla de cobertura de
`docs/product/CONSISTENCY-RULES.md`. Mantener el alcance en laboratorio antes de
alterar relaciones o el backend activo.

Si los criterios existentes de baja/reasignación bastan: GPT-6 Luna, esfuerzo
medio, velocidad Standard, para implementar y verificar. Si aparece una decisión
nueva de permisos/jerarquía, usar GPT-6.1 Sol, esfuerzo alto, Standard, sólo para
revisar esa decisión antes de volver a Luna.

Evidencia del bloque de traspaso: 360 pruebas en 35 archivos, TypeScript/Vite y
Worker build, Chromium de correcciones desktop/móvil y flujo conjunto aprobados;
sin errores JS ni solicitudes a `/api` operativa. Ver el estado para límites y
publicación vigente.

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
