# Contrato Luna — cobertura recurrente RC/RC y RR/RR — 19/10/2026

## Objetivo

Completar localmente la matriz de carreras entre aprobación de cobertura
recurrente y revocación de membresía. Ya están aceptadas cuatro combinaciones
mixtas; esta unidad añade las cuatro faltantes: approve-first y revoke-first,
cada una con RC/RC y RR/RR. No cierra Gate L ni todo §9.

## Referencias y límites

- Contrato: `M2-2BC-EXECUTABLE-CONTRACT-20261016.md`, §9, líneas 458–464.
- Runner vigente: `tests/review/m2-1-native-review.mjs`, fixture recurrente y
  matriz cerca de líneas 3081–3158.
- Aceptación previa estrictamente acotada:
  `review-evidence/m2-2c-gatel-recurrent-coverage-20261019.json`.
- SQL014: ramas de revocación próximas a las líneas 2925–2952. No modificar
  SQL014 preventivamente; conservar 001–013, firmas legacy, Worker/D1 y Site.
- Usar PostgreSQL local descartable y filas sintéticas. No llamar Supabase ni
  aplicar migraciones remotas.

## Trabajo

1. Extender el harness para cuatro carreras nuevas. Usar jefes distintos en
   ambas sesiones, fijar barreras deterministas y demostrar bloqueo efectivo
   con `pg_blocking_pids`.
2. Para cada caso, registrar nivel real de aislamiento, transacción ganadora,
   resultado SQLSTATE, retry en transacción nueva, estado de fences y efectos.
   No copiar sin análisis el `40001` observado en los pares mixtos: determinar
   las expectativas RC/RC y RR/RR leyendo el protocolo de adquisición,
   serialización y retry vigente. Si alguna expectativa depende de una decisión
   de contrato no resuelta, parar y devolver esa pregunta a Sol.
3. Comparar estado antes/después del conflicto para sesiones, asignaciones de
   raíz e hijo, revisión de tareas/responsabilidad/grafo, `source_rule_id`,
   ocurrencias hermanas, fences, recibos, eventos y auditoría relevante.
4. Si los cuatro escenarios pasan sin tocar producto, generar reporte y
   manifiesto ligados al commit/artefactos exactos. Si aparece un fallo de SQL,
   corregir primero el test para descartar una aserción incorrecta; no editar
   SQL014 hasta documentar reproducción y devolver el cambio a Sol.
5. La inyección de fallos se conserva como unidad posterior; no declarar cerrada
   toda §9 por esta ampliación.

## Criterios de aceptación

- Las ocho filas combinadas (cuatro ya aceptadas y cuatro nuevas) aparecen con
  aislamiento/ganador explícitos; para las nuevas hay cuatro resultados
  reproducibles y retry en sesión nueva.
- Cada fila verifica blocking, rollback atómico, invariantes del grafo/fences y
  ausencia de recibos/eventos/auditoría duplicados; `40P01=0`.
- Hashes del runner, test, SQL014 y reporte se verifican contra los bytes reales.
- Sol revisa el reporte/hashes actualizados antes de publicar. No aplicar SQL014
  ni cambiar el alcance de privacidad/operación.

**Modelo de ejecución:** GPT-6 Luna, esfuerzo medio, Standard. Si se encuentra
un defecto de producto o ambigüedad de concurrencia, detener la implementación
y pedir un contrato corregido a GPT-6.1 Sol, esfuerzo alto.
