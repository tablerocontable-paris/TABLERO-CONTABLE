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

## Próximo trabajo

Revisar y extender en el laboratorio la cobertura que conserva la identidad y
responsabilidad del titular, pero atribuye la actividad y el tiempo propios al
reemplazo. Antes de tocar relaciones entre equipos, bajas/reasignaciones o el
backend activo, cerrar un contrato de permisos y regresión. Referencias: filas
4, 13 y 14 de `docs/product/CORRECTIONS-20261002.md` y regla de cobertura de
`docs/product/CONSISTENCY-RULES.md`.

Modelo para esa revisión: GPT-6.1 Sol, esfuerzo alto, velocidad Standard, por
el cruce de permisos, jerarquía y atribución histórica. Cerrado el contrato,
GPT-6 Luna, esfuerzo medio, Standard, para implementarlo y verificarlo. Si se
mantiene un alcance sólo local y aparece una decisión nueva, detenerse antes de
alterar D1 o una migración.

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
