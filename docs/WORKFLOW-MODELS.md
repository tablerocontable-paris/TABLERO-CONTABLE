# Flujo de trabajo acordado — 01/10/2026

1. GPT Sol 6.1, esfuerzo alto: analizar requisitos y código, resolver decisiones, definir una ejecución acotada y sus criterios de aceptación.
2. GPT 6 Luna, esfuerzo medio: ejecutar esas instrucciones, verificar el resultado y comunicar fallos. No improvisar cambios de arquitectura.
3. Revisión al finalizar: contrastar resultado con requisitos; distinguir implementado, probado, simulado y pendiente. Recomendar el modelo para la próxima fase en cada devolución.

Formato de cierre: resultado concreto; verificación y limitaciones relevantes; **Próximo modelo: [modelo y esfuerzo] — [acción]**.

Una tarea nueva o un fallo que exige replantear el diseño vuelve a Sol 6.1. Una ejecución concreta ya revisada corresponde a Luna. La preferencia no modifica automáticamente el modelo activo en entornos que no ofrecen esa capacidad.

Continuidad acordada: si la fase siguiente usa el mismo modelo, seguir sin pedir ni esperar otro «continuar». Finalizar al llegar a un cambio de modelo necesario, indicando esfuerzo y el archivo con instrucciones preparadas; Valentino cambia el modelo manualmente. No activar subagentes para sustituir ese cambio.

Estado al finalizar la revisión del 01/10/2026: 004 tiene once violaciones
funcionales reproducidas; no está aprobada para Supabase. Próxima ejecución
**GPT 6 Luna, esfuerzo medio**, contrato
`docs/architecture/TIME-COVERAGE-005-HARDENING.md`. Ejecutar sus bloques sin
interrupciones entre ellos; al terminar, revisión **Sol 6.1 alto** antes de integrar
el frontend. Evidencia: `docs/architecture/REVIEW-004-20261001.md`.
