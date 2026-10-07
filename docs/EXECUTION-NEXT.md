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

## Cobertura local implementada y siguiente trabajo

La cobertura ya incluye tareas puntuales y reglas recurrentes seleccionadas;
previsualiza ocurrencias y aplica acceso al materializarlas. Mantiene al titular,
atribuye cronómetros al reemplazante, limita accesos por empresa/equipo y revoca
relojes al cancelar o vencer. Contrato y evidencia en
`docs/architecture/COVERAGE-LAB-CONTRACT-20261006.md`.

Siguiente: cerrar traspaso, baja y reasignación sin perder historial ni
responsabilidad; luego auditar cierres/exportaciones y completar pruebas de
reglas diarias, semanales y varios meses. Referencias: filas 4, 13 y 14 de
`docs/product/CORRECTIONS-20261002.md` y regla de cobertura de
`docs/product/CONSISTENCY-RULES.md`. Mantener el alcance en laboratorio antes de
alterar relaciones o el backend activo.

Si los criterios existentes de baja/reasignación bastan: GPT-6 Luna, esfuerzo
medio, velocidad Standard, para implementar y verificar. Si aparece una decisión
nueva de permisos/jerarquía, usar GPT-6.1 Sol, esfuerzo alto, Standard, sólo para
revisar esa decisión antes de volver a Luna.

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
