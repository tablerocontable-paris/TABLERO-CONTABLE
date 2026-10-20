# Aceptación Sol — M2.2C legacy coverage replay

Fecha: 2026-10-20
Resultado: **C aceptada**, limitada a los artefactos locales identificados abajo.

## Identidad de evidencia aceptada

- Contrato: SHA-256 `9F44C0DAE1C2C3B339CAD7271EE3AD2C80B1E1700711E46692EA15F0929D53C8`.
- SQL014 candidata: SHA-256 `CE85FFB750443CB54CC25DD55AE25831CCFE71D8A10EA143D54C34855009447D`.
- Manifiesto sincronizado repo/canónico: SHA-256 `2B00185B57E55D1B9E74C806363A83DFE03309B4C560519BB2F3A868E855FD18`; las copias son idénticas.
- Runner repo/canónico: SHA-256 `2D5A5F443D499005501D02AA56CA84A33E8E3858D74787E9F3E2A451D22B5524`.
- Reporte red: SHA-256 `78AAB30AC62B3FEA56D20894BFB6FA32433125DD68E4DE9B7E7A19A6A54529C1`.
- Reporte verde: SHA-256 `917582FECC5F38DB980441A674E9E7A7F38093DE9F38B363975EB7EC6394EC2A`.
- Regresión nativa: SHA-256 `8307AA5018AE53EDF0D9EF6EB0CDB232D01D3A6ED06F1B3FBF61B8C2E192D696`, resultado 351/351.

El manifiesto corregido describe los dos sentidos de bloqueo real en ocho transacciones superpuestas. Para los cuatro casos writer-winner, especifica el snapshot completo de 57 tablas tomado en la sesión autenticada del writer tras el statement y antes del commit, y su igualdad profunda con el snapshot posterior al replay y rollback. El runner y el reporte verde asociados son exactamente los artefactos cuyos hashes declara el manifiesto.

La evidencia local registra diez casos red, 28 casos verdes secuenciales, ocho carreras y ocho retries frescos denegados sin delta. También registra Vitest 738/738 en 74 archivos, TypeScript, builds de cliente y Worker, sintaxis del runner y diff-check, todos con exit code 0.

## Límites y trabajo residual

Esta aceptación cubre exclusivamente el corte C y la evidencia local con SQL014 de hash indicado. No implica aplicación de la migración, conexión ni validación en Supabase alojado, autorización para llamadas remotas, despliegue o cierre del Gate L. La nota previa NO-GO queda como historial del manifiesto anterior y queda supersedida por esta aceptación para el nuevo manifiesto.

Quedan los residuales **A y P** para la siguiente revisión de arquitectura/compatibilidad. No se modificó SQL durante esta reauditoría y no se hizo commit/push.
