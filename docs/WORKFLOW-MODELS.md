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
2. Luna ejecuta el bloque, pruebas requeridas, commit/push y publicación privada
   verificada. Continúa mientras el contrato y el modelo sean adecuados.
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

## Próximo bloque

**GPT-6 Luna medio, Standard:** ejecutar
`product/DEADLINE-EFFICIENCY-REPAIR-20261002.md`. Revisión independiente v42
no aceptada: cuatro probes fallaron y hay discrepancias de auditoría/CSV.
Después Sol medio revisa; B/C requiere Sol alto tras aceptar el arreglo.
El cambio es manual; no simularlo con subagentes.
