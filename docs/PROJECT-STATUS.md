# Estado vigente del proyecto — 02/10/2026

**Avance global estimado: 41% (rango 35–45%).** La estimación anterior era 40%.
Hay avance funcional real: UI A y reparación de anticipación de v43 están
aceptadas localmente. El incremento corresponde al indicador de anticipación
por tarea, metas registradas, agregados y reportes; no al número de pruebas o
documentos. QA visual completa y producción conectada siguen pendientes.

**Aplicación live: Sites v43**, fuente de implementación
`9d6b97dc16625c974d6679cf7d69b7fe2fdb3900`, versión
`appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85~appgver_3e2fc69b4dac819196d375f0c836aa5a`,
deploy `appgdep_6ac00b2ad81c81919a50bafab9f7101d` succeeded:
https://grupo-paris-contabilidad.valentino-magni.chatgpt.site.
La revisión posterior sólo modifica evidencia, tests y documentación en Git;
conserva la aplicación publicada desde ese commit.

## Cómo se estima el avance

Los pesos representan esfuerzo y riesgo restantes aproximados. Los porcentajes
de cada etapa son juicio de planificación, sin precisión estadística ni una
medición automática de requisitos. Se mantienen los mismos pesos para comparar.

| Etapa | Peso | Estimación anterior → actual | Evidencia / pendiente |
| --- | --- | --- | --- |
| Demo, experiencia y reglas | 25% | 75% → 80% | UI A y anticipación aceptadas localmente; pendientes funciones B/C/D y QA visual |
| Contrato de datos y SQL | 25% | 65% → 65% | SQL001–008 y adaptadores revisados localmente; coordinación nueva y carreras reales pendientes |
| Integración, cuentas y permisos | 25% | 5% → 5% | Lector/gateway listos localmente; frontend usa localStorage y actor simulado |
| Funcionalidad final y operación | 15% | 25% → 25% | Reportes/outbox locales; pendientes integración, notificaciones, Kaizen/5S y administración final |
| Validación, infraestructura y migración | 10% | 0% → 0% | Piloto, servicios definitivos y migración aún pendientes |

La ponderación pasó de 40 a 41,25; se comunica **aproximadamente 41%**. El rango
35–45% muestra la incertidumbre. No corresponde elevarlo al 50% por tener más
commits o reparaciones. La demo está mucho más cerca de terminarse que la entrega
operativa completa. No hay una base de producción conectada ni usuarios reales.

## Avance concreto del último bloque

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

1. Diseñar e implementar B/C: jerarquía multiarea, conjuntas y contribuciones,
   cobertura por tareas, bajas/huérfanas y comentarios privados separados.
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

SQL001–008, gateway y lector conservan aceptación local. Laboratorio PGlite:
23 casos secuenciales y 24 pares preparados para PostgreSQL sin ejecutar. Esas
pruebas no sustituyen carreras reales ni Supabase Auth/MFA/RLS en producción.
Revisiones de lector/adaptador, upgrades y reportes se conservan en docs/architecture.
UI A: REVIEW-V40-INDEPENDENT-20261002.md. Anticipación: REVIEW-V43-INDEPENDENT-20261002.md.
El registro v42 y sus probes fallidos permanecen como evidencia histórica.
Suite regular actual: 223 pruebas/21 archivos (una regresión del llamador añadida
en revisión), build y diff check pasan. V43 tenía 222 pruebas; src no cambió.

**Próximo paso: GPT-6.1 Sol, esfuerzo alto, Standard**, diseño B/C según
EXECUTION-NEXT.md. No repetir la misma revisión ni añadir pulido menor antes de
cerrar las relaciones de datos y permisos que necesitan los próximos módulos.
