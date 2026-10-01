# Próxima ejecución autorizada — revisión de versión 24

**Modelo: GPT-6 Luna. Esfuerzo: medio. Velocidad: Standard.**
Fuente revisada: `81148aa1343ecd4271159e7e8e20a86f3d9fd704`, Sites privado v24.
Evidencia: architecture/REVIEW-008-20261001.md.
Con «continuá» leer AGENTS.md y este archivo; no pedir copiar otro prompt.

## Orden y alcance

1. Completar architecture/TIME-COVERAGE-008-COMPLETION.md, suplemento concreto
   de architecture/TIME-COVERAGE-008-ACCEPTANCE.md. Corregir coherencia del plan,
   aislamiento, reportes, upgrades/abortos y guía PostgreSQL ejecutable.
2. 008 es local y no fue aplicada a Supabase: completar su archivo actual.
   No crear 009 para estos pendientes. Preservar 001–007 y evidencia congelada,
   incluidos los nuevos diagnósticos de esta revisión.
3. No ampliar frontend: las cinco correcciones de anotaciones/recorrido pasan
   la revisión local. Completar aceptación de inicio posinducción, cierre/reinicio
   del recorrido y fallo al editar según el suplemento, sin reabrir el diseño.
4. Casos críticos solos, suite completa, build y diff-check. Comparar bytes de
   archivos congelados. Registrar matriz y número real de pruebas en
   architecture/REVIEW-008-EXECUTION-20261001.md.
5. Commit/push y deploy privado Sites del mismo SHA; verificar versión, SHA y
   resultado, conservar audiencia. Después **GPT-6.1 Sol alto**, cambio manual
   para revisión final de 008; detenerse sólo al llegar a ese cambio.

## Límites y siguiente etapa

No instalar PostgreSQL, aplicar SQL remoto, crear Gmail/GitHub/Supabase/hosting,
migrar empleados ni enviar reportes. Guía PostgreSQL **NO EJECUTADO**. PGlite y JWT
simulados no certifican Auth/MFA ni carreras entre conexiones.

Tras aprobar 008, preparar integración frontend/SQL, permisos reales y piloto.
No afirmar que el SQL local gobierna la demo. Cuenta dedicada y dev/prod siguen
anotados para el futuro en PRODUCT-ROADMAP.md y ops/AUTOMATED-DELIVERY.md.
