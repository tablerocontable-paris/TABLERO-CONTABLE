# Estado vigente del proyecto — 06/10/2026

**Avance global estimado: 42% (rango 36–46%).** Hay avance funcional local en UI A
y anticipación de v43, contrato privado B1/009 revisado y reparado, y fundación
B2a/010 revisada independientemente sin hallazgos. La revisión de concurrencia011
está cerrada para implementación local en
`architecture/COORDINATION-011-CONCURRENCY-20261006.md`. SQL011 ya existe como
implementación local parcial y se declara no apta para producción hasta cerrar
todos los writers y el reporte v4. También faltan integración, PostgreSQL/Auth
reales, UI y producción. Las pruebas y
documentos por sí solos no elevan el porcentaje. QA visual completa y producción
conectada siguen pendientes.

**Aplicación live: Sites v43**, fuente de implementación
`9d6b97dc16625c974d6679cf7d69b7fe2fdb3900`, versión
`appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85~appgver_3e2fc69b4dac819196d375f0c836aa5a`,
deploy `appgdep_6ac00b2ad81c81919a50bafab9f7101d` succeeded:
https://grupo-paris-contabilidad.valentino-magni.chatgpt.site.
La revisión06/10 modifica pruebas y documentación en Git; conserva
la aplicación publicada desde ese commit.

## Cómo se estima el avance

Los pesos representan esfuerzo y riesgo restantes aproximados. Los porcentajes
de cada etapa son juicio de planificación, sin precisión estadística ni una
medición automática de requisitos. Se mantienen los mismos pesos para comparar.

| Etapa | Peso | Estimación anterior → actual | Evidencia / pendiente |
| --- | --- | --- | --- |
| Demo, experiencia y reglas | 25% | 80% → 80% | UI A y anticipación aceptadas localmente; pendientes funciones B/C/D y QA visual |
| Contrato de datos y SQL | 25% | 68% → 68% | SQL001–010 preservados; motor011 parcial, cierre/reporte v4, todos los writers y PostgreSQL real pendientes |
| Integración, cuentas y permisos | 25% | 5% → 5% | Lector/gateway listos localmente; frontend usa localStorage y actor simulado |
| Funcionalidad final y operación | 15% | 25% → 25% | Reportes/outbox locales; pendientes integración, notificaciones, Kaizen/5S y administración final |
| Validación, infraestructura y migración | 10% | 0% → 0% | Piloto, servicios definitivos y migración aún pendientes |

La ponderación permanece en 42,0; se comunica **aproximadamente 42%**. El rango
36–46% muestra la incertidumbre. No corresponde elevarlo al 50% por tener más
commits o reparaciones. La demo está mucho más cerca de terminarse que la entrega
operativa completa. No hay una base de producción conectada ni usuarios reales.

## Avance concreto del último bloque

- B2b/011 inició activación local: bindings para ocurrencias seleccionadas,
  responsabilidad conjunta inicial puntual, relojes por actor, revocación de
  cobertura, controles compartidos y lectura segura. Suite focal 011: 10 pruebas.
  No termina el contrato: faltan materialización recurrente de bindings, cierre
  mensual y reporte4 con atribución, junto con reemplazar el orden de locks en
  todas las rutas escritoras. No aplicar la migración en remoto. Evidencia:
  `architecture/COORDINATION-011-IMPLEMENTATION-20261006.md`.
- Las pruebas históricas de contratos 006/007 quedaron fijadas a migraciones
  hasta 008. `database.test` y la suite focal ejercitan la cadena vigente con 011.

- B2a/010: seis tablas staged de responsabilidad y cobertura seleccionada, cuotas,
  sellado/guardas, backfill sin reescribir historia, fallback y tipos Zod propios.
  Las 18 pruebas del bloque pasan. No activa tareas conjuntas, cobertura selectiva,
  acceso, relojes o métricas en UI. Evidencia:
  `architecture/COORDINATION-010-IMPLEMENTATION-20261004.md`.
- Revisión independiente010 agrega ocho probes SQL directos y no encontró defectos
  en el alcance staged. Evidencia: `architecture/COORDINATION-010-REVIEW-20261004.md`.
  Contrato011 de activación está definido; implementación local parcial y sin conexión al frontend.
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

1. Completar y revisar motor011: escritores y locks comunes, coberturas
   recurrentes y cierre/KPI/reporte4; después B/C: jerarquía multiarea,
   contribuciones, bajas/huérfanas, e integrar
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

SQL001–010, gateway y lector conservan aceptación local (009 revisado por Sol).
010 tiene aceptación de ejecución y revisión independiente local, sin hallazgos.
Laboratorio PGlite:
23 casos secuenciales y 24 pares preparados para PostgreSQL sin ejecutar. Esas
pruebas no sustituyen carreras reales ni Supabase Auth/MFA/RLS en producción.
Revisiones de lector/adaptador, upgrades y reportes se conservan en docs/architecture.
UI A: REVIEW-V40-INDEPENDENT-20261002.md. Anticipación: REVIEW-V43-INDEPENDENT-20261002.md.
El registro v42 y sus probes fallidos permanecen como evidencia histórica.
Suite completa anterior a 011: **275 pruebas en 26 archivos, todas pasan**
(86,54s). La corrida actual terminó con **285 pruebas en 27 archivos, todas
pasan** (77,77s); `npm run build` y `git diff --check` también pasan. La primera
corrida parcial de 011 halló regresiones que se documentan/corrigen en
`architecture/COORDINATION-011-IMPLEMENTATION-20261006.md`. No se ejecutó
PostgreSQL real.
Comando con contención controlada:
`npm test -- --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000`.
El smoke de la revisión010 `node tests/postgres-009/check-sql.mjs` pasó los8 órdenes009 en secuencia
con PGlite. Están preparados para PostgreSQL, sin ejecución concurrente real.
`npm run build` de010 pasa TypeScript y Vite; `git diff --check` también pasa.
En la revisión009 anterior se quitó un argumento de timeout accidental dentro de
una aserción; sus aserciones y resultados funcionales no cambiaron.

**Próximo paso: GPT-6.1 Sol, esfuerzo alto, Standard**, revisar la implementación
parcial y decidir el contrato restante de writers, cobertura recurrente y reporte4;
después GPT-6 Luna implementa ese corte cerrado. Las pruebas abstractas no ejecutan
carreras PostgreSQL ni SQL remoto. No cambia la estimación42% hasta progreso
funcional.

Puertas hacia Supabase/hosting y evaluación gratuita verificadas en
`ops/FREE-HOSTING-PATH-20261002.md`. Preferencia Cloudflare Pages+Supabase dev/prod,
con límites, backup y correo a validar antes de alta. No hay fecha fiable de
migración; se reportan puertas completadas y pendientes, sin estimarlas desde el
número de commits. Recursos finales no creados.
