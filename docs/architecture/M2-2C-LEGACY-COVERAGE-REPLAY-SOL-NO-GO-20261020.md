# Revisión Sol — replays legacy de cobertura: NO-GO

Fecha: 20/10/2026. Alcance: revisión local del corte C; no hubo conexiones ni
cambios en servicios alojados. No se modificó SQL durante esta revisión.

## Identidad de los artefactos

- SQL014 candidata: SHA-256 `CE85FFB750443CB54CC25DD55AE25831CCFE71D8A10EA143D54C34855009447D`.
- Contrato C: SHA-256 `9F44C0DAE1C2C3B339CAD7271EE3AD2C80B1E1700711E46692EA15F0929D53C8`.
- Manifiesto Luna: SHA-256 `17DBB8255EB7BEED9618779B2EB007DD0E416A82CF99FE6B3577FD6ECF808DD3`.
- Runner rojo/verde: SHA-256 `604B75764E701F57DAE2FD26E653E045A2B03EEED29FB6F3325AEE3E40D2242F`.
- Matriz nativa disponible: `outputs/m2-2c-legacy-coverage-replay-luna-20261020/native-full/review.json`, SHA-256 `8307AA5018AE53EDF0D9EF6EB0CDB232D01D3A6ED06F1B3FBF61B8C2E192D696`; internamente reporta 351/351, 0 fallos y `migration014Sha256` coincidente con SQL014 candidata.

Los hashes declarados de SQL, contrato, manifiesto y runner coinciden con el
checkout. La regresión nativa de 351 casos también está presente y coincide con
el hash declarado.

## Hallazgos que impiden aceptar

1. **Falta la evidencia primaria de C.** El manifiesto referencia los reportes
   `outputs/m2-2c-legacy-coverage-replay-luna-20261020/red-complete/red-report.json`
   y `.../green-races/green-report.json`, con hashes declarados
   `CD35BF613D3F92E76F59EE3CCB9886FECD49832E41167C9D8CE0D5003873D985` y
   `6055C5572D369E7F3D1F690E31AA51CCDC5CF2B676113B4A638D90A70119244C`.
   Ninguno existe en el checkout actual; el directorio de evidencia contiene
   sólo `native-full`. Por eso no pude confirmar de forma independiente los 10
   casos rojos, 28 verdes, 8 carreras, snapshots completos, SQLSTATE ni PID
   bloqueadores indicados por el manifiesto.
2. **Falta salida primaria de la suite y los builds.** El manifiesto registra
   738/738, TypeScript y dos builds exitosos, pero no incluye reportes/logs
   verificables de esas ejecuciones. Esos valores quedan como afirmaciones del
   manifiesto, no como resultados reexaminables en este corte.
3. **La aserción de snapshot en una rama de carrera es parcial.** En el runner,
   cuando gana la revocación, compara el snapshot posterior sólo para
   `task_coverage_bindings` y `task_time_sessions` contra el anterior. El
   contrato pide comparar antes/después del replay las colecciones completas
   tocables. La rama registra objetos de snapshot completos, pero su aserción
   no rechaza una escritura accidental en recibos, auditoría, revisiones,
   cierres u otras tablas.

## Inspección de SQL

La revisión estática no halló desvío evidente del contrato en la rama de
replay: mantiene firma y grants públicos, revisa kind/argumentos antes del
helper, usa el helper privado con ejecución revocada, toma el protocolo M2.2B
sin avanzar fences, revalida el snapshot, vuelve a comprobar sesión MFA,
perfil/organización/rol y alcance de encargado, y compara el recibo completo
antes de devolver el resultado histórico. Las primeras ejecuciones conservan
los caminos de aprobación/cancelación originales en el cuerpo reemplazado.

Esta inspección de código no sustituye los reportes de ejecución faltantes ni
la comprobación de que cada carrera no deja efectos laterales.

## Decisión

**NO-GO de evidencia, no de SQL.** No aplicar SQL014 ni publicar/aceptar el
corte C. Recuperar o regenerar ambos reportes con el runner identificado y
hashes exactos. Ajustar la aserción de snapshots de la rama revocación-primero
para comprobar delta completo, regenerar sus reportes y manifiesto, y adjuntar
salidas de suite/build con hashes. Después volver a Sol para una revisión
acotada de C. El residual posterior sigue siendo A y P; Gate L continúa
abierto.
