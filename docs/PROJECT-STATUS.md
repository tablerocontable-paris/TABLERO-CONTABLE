# Estado vigente del proyecto — 04/10/2026 UTC (sesión 03/10 Argentina)

**Avance global estimado: 42% (rango 36–46%).** Se mantiene el estimado de la ejecución B1.
Hay avance funcional local en UI A y anticipación de v43, más un contrato backend
privado B1/009 revisado y reparado localmente. El avance reconoce este bloque de
datos aislado; las pruebas y documentos por sí solos no elevan el porcentaje. QA
visual completa y producción conectada siguen pendientes.

**Aplicación live: Sites v43**, fuente de implementación
`9d6b97dc16625c974d6679cf7d69b7fe2fdb3900`, versión
`appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85~appgver_3e2fc69b4dac819196d375f0c836aa5a`,
deploy `appgdep_6ac00b2ad81c81919a50bafab9f7101d` succeeded:
https://grupo-paris-contabilidad.valentino-magni.chatgpt.site.
La revisión posterior modifica backend local, contratos, tests y documentación
en Git; conserva la aplicación publicada desde ese commit.

## Cómo se estima el avance

Los pesos representan esfuerzo y riesgo restantes aproximados. Los porcentajes
de cada etapa son juicio de planificación, sin precisión estadística ni una
medición automática de requisitos. Se mantienen los mismos pesos para comparar.

| Etapa | Peso | Estimación anterior → actual | Evidencia / pendiente |
| --- | --- | --- | --- |
| Demo, experiencia y reglas | 25% | 80% → 80% | UI A y anticipación aceptadas localmente; pendientes funciones B/C/D y QA visual |
| Contrato de datos y SQL | 25% | 68% → 68% | SQL001–008 intactos; 009 revisado y reparado localmente, PostgreSQL real pendiente |
| Integración, cuentas y permisos | 25% | 5% → 5% | Lector/gateway listos localmente; frontend usa localStorage y actor simulado |
| Funcionalidad final y operación | 15% | 25% → 25% | Reportes/outbox locales; pendientes integración, notificaciones, Kaizen/5S y administración final |
| Validación, infraestructura y migración | 10% | 0% → 0% | Piloto, servicios definitivos y migración aún pendientes |

La ponderación permanece en 42,0; se comunica **aproximadamente 42%**. El rango
36–46% muestra la incertidumbre. No corresponde elevarlo al 50% por tener más
commits o reparaciones. La demo está mucho más cerca de terminarse que la entrega
operativa completa. No hay una base de producción conectada ni usuarios reales.

## Avance concreto del último bloque

- B1 `202610020009_private_block_notes.sql` añade notas privadas, historial
  inmutable, receipts separados y RPC con autorización por autor/jefe/encargado
  actual y empresa. El wrapper RPC no cambia el gateway existente ni la UI.
- Siete pruebas locales cubren base vacía, upgrade desde 008 sin tocar snapshots,
  ciclo de edición/limpieza, permisos, recibos, mes cerrado, ACL y wrapper. PGlite
  no valida carreras reales ni Supabase Auth/RLS remoto. Sol añadió 12 pruebas
  independientes y reparó cancelación, envelope y normalización de whitespace.
- La página sigue v43. Los comentarios aún no aparecen ni funcionan en la UI.
El commit de implementación B1 se conserva como evidencia y se sincroniza junto
con la revisión en el repositorio de Sites. Backend aún local, no SQL remoto.

- Contraste de cabecera del encargado y checklist adaptado a tokens del tema;
  capturas posteriores motivaron el cambio. QA de navegador aún abierta.
- Anticipación por ocurrencia/empresa y período: antes/en fecha/después,
  pendiente/vencida, sin plazo y sin medición. Metas usan el registro que cruza
  el objetivo y muestran “Meta registrada”. No dan bonificación al KPI.
- Nuevos cierres conservan métricas del corte; históricos sin campo no se
  recalculan. Análisis y CSV incluyen bases, tasas y promedios.
- Revisión v42 encontró cuatro fallos; reparación v43 pasa los cuatro probes
  originales. Revisión independiente actual acepta este comportamiento local.
- Regresión adicional verifica que no-op del reductor no escribe ni audita en
  el llamador. Evidencia: architecture/REVIEW-V43-INDEPENDENT-20261002.md.

## Pendientes que impiden migrar a los empleados

1. Ejecutar B2a/010 y revisar/implementar motor011; después B/C: jerarquía multiarea,
   conjuntas y contribuciones, cobertura por tareas, bajas/huérfanas, e integrar
   comentarios privados con Auth real.
2. Integrar frontend con lector/gateway y completar equivalencia de reglas,
   Auth/invitaciones/MFA/RLS y datos compartidos.
3. Cerrar agenda/cumplimiento, presencia y última conexión, notificaciones,
   entrega de reportes, consultas y procesos de mejora.
4. Ejecutar concurrencia PostgreSQL real, QA visual y volumen, piloto con Juan
   Pablo y encargado, pruebas de restauración y actualización.
5. Al aceptar versión definitiva, crear infraestructura dedicada nueva y flujo
   dev/prod, GitHub/Supabase/hosting e iniciar migración manual por equipos.

El cronómetro funciona localmente y guarda sesiones en ese navegador. Sus RPC
existen en SQL local, pero no están conectadas a la página. Presencia y última
conexión siguen pendientes de Auth y señales del servidor. Correo/outbox tienen
contratos y consumidor de prueba; no hay correo productivo.

## Evidencia y continuidad

SQL001–009, gateway y lector conservan aceptación local (009 revisado por Sol).
Laboratorio PGlite:
23 casos secuenciales y 24 pares preparados para PostgreSQL sin ejecutar. Esas
pruebas no sustituyen carreras reales ni Supabase Auth/MFA/RLS en producción.
Revisiones de lector/adaptador, upgrades y reportes se conservan en docs/architecture.
UI A: REVIEW-V40-INDEPENDENT-20261002.md. Anticipación: REVIEW-V43-INDEPENDENT-20261002.md.
El registro v42 y sus probes fallidos permanecen como evidencia histórica.
Suite completa: **242 pruebas en 23 archivos, todas pasan** (333,13s en este
laboratorio). La revisión añade 12 casos independientes a las 230 previas.
Comando con contención controlada:
`npm test -- --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000`.
El smoke `node tests/postgres-009/check-sql.mjs` pasa los 8 órdenes009 en secuencia
con PGlite. Están preparados para PostgreSQL, sin ejecución concurrente real.
`npm run build` pasa TypeScript y Vite; `git diff --check` también pasa. El build
se repitió tras quitar un argumento de timeout accidental dentro de una aserción
del test009; las aserciones y los resultados funcionales no cambiaron.

**Próximo paso: GPT-6 Luna, esfuerzo medio, Standard**, ejecutar
`architecture/COORDINATION-010-EXECUTION-20261004.md`. Este contrato crea la base
staged de responsabilidad y selección; no activa permisos, relojes o KPI. Sol alto
revisa010 y prepara011 antes de activar el conjunto de funcionalidades B2.

Puertas hacia Supabase/hosting y evaluación gratuita verificadas en
`ops/FREE-HOSTING-PATH-20261002.md`. Preferencia Cloudflare Pages+Supabase dev/prod,
con límites, backup y correo a validar antes de alta. No hay fecha fiable de
migración; se reportan puertas completadas y pendientes, sin estimarlas desde el
número de commits. Recursos finales no creados.
