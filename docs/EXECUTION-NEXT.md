# Próximo bloque — revisión de la ejecución completa 008

**Modelo: GPT-6.1 Sol. Esfuerzo: alto. Velocidad: Standard.** Cambio manual del
usuario; con «continuá» basta, no pedir copiar otro prompt ni sustituir por agentes.

Fuente: commit vigente de main y su versión privada de Sites. La ejecución parte
de `640c376efd4aec6e7564227aa2d74fac4093a102` y completa el suplemento
`architecture/TIME-COVERAGE-008-COMPLETION.md`. Evidencia actual:
`architecture/REVIEW-008-EXECUTION-20261001.md` y archivos nuevos
`review-evidence/time-coverage-008-completion-*`. La revisión v24 es histórica;
no interpretar sus pendientes como trabajo todavía sin ejecutar.

## Revisión requerida

1. Revisar el diff de 008: `actual_needs_start` recalculado desde fila bloqueada
   en checklist y comparación equivalente en transición, antes de no-op,
   expiración, auditoría y receipt. Verificar reglas iguales al plan, orden de
   locks, rechazo íntegro y conservación de casos legítimos.
2. Revisar aceptación aislada de 39 casos de cronómetros y seis de reportes.
   Confirmar rollback por caso, SAVEPOINT en errores, JWT/aal explícitos y fechas
   ART. Capturas exactas, cortes distintos, destino sin reloj, permisos/sello,
   pausas y no-op con dos pasos; no aprobar por exit 0 ni por inyecciones de fixture.
3. Revisar 15 upgrades/abortos, proyección completa de campos originales y
   snapshots::text. El sello añadido por 006 es permitido. Historia con actor
   NULL/reemplazante suspendido y membresía retirada no se reconstruye. Los
   abortos comprueban IDs, filas, DDL, funciones, triggers, políticas y ACL.
4. Inspeccionar guía y scripts `tests/postgres-008/`: 24 pares preparados, host/
   puerto/usuario/base coherentes, SQL A/B, espera observada y COMMIT/ROLLBACK,
   asserts. Los 22 casos locales son **secuenciales**; corte real ART y toda
   concurrencia PostgreSQL siguen **NO EJECUTADO**. No ejecutar `--run` ahora.
5. Revisar las cinco nuevas pruebas integradas de inducción/recorrido/anotaciones,
   sin ampliar diseño ni atribuir privacidad al selector local. QA visual móvil,
   contraste y accesibilidad no se completaron en este bloque.
6. Verificar evidencia de casos críticos (exactamente una prueba seleccionada
   por proceso), 151/13, build y comparación de archivos congelados. Repetir sólo
   si una discrepancia concreta lo requiere; no sobrescribir diagnósticos viejos.

## Resultado de la revisión

Guardar decisión con hallazgos reproducibles y riesgos restantes. Si falta una
corrección acotada, definir contrato completo para Luna medio y detenerse sólo
al cambio manual. Si 008 se aprueba localmente, Sol prepara el siguiente bloque
de integración frontend/SQL y sus gates; aprobación local no habilita migración.

No instalar PostgreSQL, aplicar SQL remoto, crear Gmail/GitHub/Supabase/hosting,
migrar empleados ni enviar correo. Infraestructura dedicada, Git automático,
Supabase dev/prod, Auth/MFA/RLS reales, recuperación y piloto continúan anotados
en PRODUCT-ROADMAP.md y ops/AUTOMATED-DELIVERY.md.
