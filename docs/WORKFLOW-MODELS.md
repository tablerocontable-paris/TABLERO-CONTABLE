> **Accion vigente 14/10/2026:** Contrato M0 de arquitectura definido en ops/MIGRATION-BOOTSTRAP-20261014.md. M1 Git/PC personal corresponde a Luna medio Standard; M2/M3 requieren contratos y revision Sol alto. Seleccion manual, sin simular modelos ni delegar para sustituirla. La nueva autorizacion permite cuentas/dev; produccion mantiene sus gates.

# Modelos y uso del plan Plus — 01/10/2026

Recomendación actualizada a pedido de Valentino: mantener dos modelos y ajustar
el esfuerzo a la dificultad. Medir resultados con el panel de uso de la cuenta.

| Fase | Modelo | Esfuerzo |
| --- | --- | --- |
| Plan habitual y revisión acotada | GPT-6.1 Sol | Medio |
| Arquitectura, permisos, migraciones y diagnóstico complejo | GPT-6.1 Sol | Alto |
| Implementar un contrato concreto, probar y publicar | GPT-6 Luna | Medio |
| Texto, estilos y cambios pequeños sin decisiones abiertas | GPT-6 Luna | Bajo |

Preferir velocidad **Standard**. Fast consume 2,5 veces el cupo incluido respecto
de Standard para el mismo modelo. No usar Astra, xhigh o max por defecto; escalar
sólo ante una dificultad concreta que lo justifique. Esta es una recomendación
para nuestro proyecto, no una comparación experimental de todos los modelos.

## Consumo: datos y límites

La documentación oficial estima mensajes **locales** por cinco horas para Plus:
Sol 6.1, 15–160; Luna 6, 350–3.000. No son cupos independientes ni garantías.
Work y Codex comparten uso; las tareas cloud pueden consumir más y también puede
haber límites semanales. El panel indica saldo y reinicio reales. No usar precios
de API ni dividir estos rangos para prometer un multiplicador de ahorro.

Un esfuerzo menor suele reducir tokens de razonamiento y latencia, pero no hay
una equivalencia fija entre medio/alto y porcentaje de esta cuenta. La captura
proporcionada muestra Sol 6.1 alto seleccionado; no permite medir consumo ni
cambiar automáticamente el modelo activo.

Fuentes oficiales consultadas el 01/10/2026:

- [Plan, consumo y velocidad](https://learn.chatgpt.com/docs/pricing).
- [Modelos y esfuerzo](https://learn.chatgpt.com/docs/model-selection).
- [Guía de esfuerzo](https://developers.openai.com/api/docs/guides/deployment-checklist).

## Flujo permanente

1. Sol define un bloque completo con archivos, decisiones cerradas y aceptación.
2. Luna ejecuta el contrato y sus pruebas. No crea commit ni publica mientras
   haya defectos abiertos o falte la revisión/aceptación indicada en el estado
   vigente del proyecto. Las cuentas propias se posponen hasta la aceptación
   funcional del producto.
3. Sol revisa por bloque. Evitar releer todo el proyecto o repetir una prueba ya
   válida sin un cambio o riesgo concreto. Mantener evidencia en archivos y
   devoluciones breves.
4. Registrar el próximo paso en EXECUTION-NEXT.md. Tras cambiar manualmente el
   modelo basta «continuá»; no pedir copiar otro prompt.

Una decisión nueva de arquitectura vuelve a Sol. No fingir cambios de modelo ni
activar subagentes para sustituir el cambio manual acordado. Estas instrucciones
no cambian por sí solas el selector de ChatGPT.

Cada devolución final: resultado, verificación/límites y **Próximo modelo:
[modelo y esfuerzo] — [acción]**. Si la próxima fase usa el mismo modelo, seguir
sin pedir otro «continuá».

## Referencia histórica — handoff de migration-011

Este estado fue reemplazado por las decisiones posteriores del usuario: se
autorizó commit, sincronización de la fuente del mismo Site y publicación
privada. No habilita cuentas reales, cambios de audiencia ni migraciones.

## Próximo paso vigente — revisión del corte de correcciones, 08/10/2026
El laboratorio local pasó 500/500 pruebas, TypeScript, builds de cliente y
Worker, cuatro recorridos Edge, auditorías automatizadas y benchmark. El corte
sigue sin commit, PR ni publicación. Primero seleccionar GPT-6.1 Sol, esfuerzo
alto, Standard, para revisar permisos, cierres, historia y evidencia contra el
contrato vigente. Después GPT-6 Luna, esfuerzo medio, Standard, implementa los
defectos que Sol confirme. Aceptación con lector de pantalla e integral sigue
pendiente; no conectar cuentas ni servicios antes de aceptar el producto. Ver
`docs/EXECUTION-NEXT.md` y `docs/PROJECT-STATUS.md` para evidencia y límites.
## Revisión de continuidad — 11/10/2026

Se reconsultaron las páginas oficiales de pricing y selección de modelos el 11/10. Los rangos locales Plus de 15–160 para Sol 6.1 y 350–3.000 para Luna 6 siguen publicados como estimaciones por cinco horas, con uso compartido y posibles límites semanales; no permiten calcular consumo real de esta auditoría. Fast sigue publicado como 2,5× para uso incluido y 2× para créditos comprados: no mezclar ambas modalidades.

La separación Sol alto para esta auditoría / Luna medio para contratos definidos es una decisión del proyecto. No se atribuye al modelo seleccionado automáticamente ni se promete ahorro medido. Sigue la selección manual acordada, sin delegación para sustituirla. El corte de 500 pruebas del 08/10 es histórico; la auditoría integral actual continúa con 60 hallazgos/90 casos abiertos y aceptación pendiente. La regla de evitar relecturas rutinarias no restringe el pedido posterior explícito de auditar todo.

Próximo paso actual: terminar consistencia del informe, matriz de requisitos y validación integral con Sol alto, Standard; luego Luna medio, Standard ejecutará las instrucciones consolidadas. No comenzar cuentas, API, publicación o paquete final antes de los gates de aceptación aplicables.

Fuentes reconsultadas: https://learn.chatgpt.com/docs/pricing y https://learn.chatgpt.com/docs/model-selection. Para saldo/reset de la cuenta, consultar el panel actual; este documento no registra su saldo.
