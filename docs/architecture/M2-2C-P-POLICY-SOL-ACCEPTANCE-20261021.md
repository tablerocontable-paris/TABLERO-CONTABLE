# Aceptación Sol — política P y replay de nota privada

Fecha: 21/10/2026. Aceptación independiente de la corrección local de
`public.save_private_block_note`; no cierra §9/Gate L ni autoriza acciones
remotas.

## Identidad revisada

```text
Baseline: eb960410a14d70abbc4c3a43528f6da1aa567a1c
SQL014: 218DEA9E9E3097743BD09238E73D5840A664F6718AEBE7670B88AF064278A837
Runner: B6D2E46C46735DEB8CAEB1175674AEDCBFD63E9A69BBE32513FA5BF934196F84
Manifiesto: 63F3FE57CD108B18FA40F85CAD565EAEC479D66DF86FC2595AFBBBD0513AC631
Reporte candidato: 427B70B9D8A6E07B9413DC4419D092FF2EE5A456A88D0F4893C777B762AC982E
Reporte baseline corregido: 4BA24309EBF42D65AD5C8F47AFC0F4205F7008F3330B623BDA09315A0E766F66
```

Las once referencias del manifiesto verifican rutas, tamaños y hashes; el
manifiesto versionado y su copia canónica coinciden byte por byte. El primer
reporte de exploración se conserva como antecedente, corregido por la
clasificación de promoción de rol: pasar de empleado a encargado con perfil
activo es válido según el rol actual permitido.

## Dictamen acotado

Acepto que SQL014 revalida el ACK propio de `save_private_block_note` bajo el
bloqueo M2.2B sólo del actor/perfil. La rama valida perfil activo, organización
del recibo y rol actual admitido, y vuelve a comparar el recibo completo tras
adquirir el bloqueo. No encontré otro defecto en el candidato.

La primera ejecución desde `select * into planned` es idéntica a SQL011 al
compararla normalizada. Sólo SQL014 cambió; pausa, receipt lock, helpers
compartidos, RLS y SQL001–013 permanecen intactos.

Evidencia PostgreSQL 17.11, 27 casos y seis barreras reales, con snapshots de
las 57 tablas base. Resultado: inactivación RC `P0001`, RR `40001`, retry fresco
`P0001`; rol auditor RC `P0001`, RR `40001`, retry `P0001`; promoción permitida
empleado→encargado RC ACK, RR `40001` y retry ACK. El ACK propio tras cierre
mensual y cancelación de cobertura no muta tablas. Conflicto de argumentos,
otro actor y otra organización no filtran el recibo. El intento de mover
organización se rechaza por FK compuesta `23503` sin alterar snapshots. No hubo
`40P01` ni deadlock.

## Límites de esta aceptación

- Las seis carreras son writer-first en el receipt lock. No se ejercitó replay
  primero con `FOR SHARE` ya adquirido y escritor de perfil esperando. No
  repetir las carreras aceptadas; el orden inverso queda por cruzar con §9.
- Vitest 24/24 son dos copias del mismo test SQL009, una bajo
  `tmp/transfer-validation-bbff614-main`; esa prueba carga M2.5/M2.9 y no SQL014.
  No citarlo como suite completa ni como prueba directa de la función corregida.
- TSC, build cliente y build Worker registraron exit 0 en el manifiesto de Luna,
  con dos advertencias benignas de Rollup sobre anotaciones PURE de Zod. Sol no
  reejecutó estos comandos ni dispone de sus logs entre los once artefactos.
- La cobertura se probó mediante cancelación de una ausencia aprobada, no por
  paso natural del tiempo. `pause_task_timer` conserva su dictamen de código
  previo; no se volvió a ejecutar su matriz.

Antes de afirmar validación integral, ejecutar la suite oficial excluyendo
`tmp` y adjuntar su salida sobre SQL014 exacta. Gate L requiere consolidar §9 y
probar sólo huecos reales; no reabrir familias T/C/A/P aceptadas. No aplicar
SQL014 en Supabase ni iniciar preflight alojado hasta que Gate L cierre.
