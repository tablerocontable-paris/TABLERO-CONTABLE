# Estado del proyecto — 01/10/2026

**Avance estimado: 40% del producto final (rango razonable: 35–45%).** Es una
estimación por etapas, no una medición automática: la demo y los contratos locales
están avanzados, pero autenticación, datos compartidos, integración, validación
operativa e infraestructura final siguen pendientes. No está listo para migrar.

| Etapa (peso estimado) | Estado y avance estimado de esa etapa |
| --- | --- |
| Demo, experiencia y reglas (25%) | 75%: tablero y funciones demostrables avanzadas; faltan cerrar parte de experiencia y funciones de administración/proceso |
| Contrato de datos y reglas SQL (25%) | 65%: migraciones 001–008 revisadas y pruebas locales; concurrencia y Supabase real pendientes |
| Integración, cuentas y permisos (25%) | 0%: frontend aún usa persistencia/selector de demostración; no están conectados Auth, RLS ni datos compartidos |
| Funcionalidad final y operación (15%) | 25%: reportes/reglas están delineados; faltan integración de reportes, áreas de administración y procesos Kaizen/5S aplicados |
| Validación, infraestructura y migración (10%) | 0%: faltan QA real, piloto de Juan Pablo y servicios definitivos |

El 40% se obtiene ponderando esas etapas (aprox. 39%, redondeado); el rango
35–45% refleja que los porcentajes por etapa todavía son estimaciones. No significa
que 40% de los empleados puedan migrarse: hoy no hay base de producción conectada.

## Evidencia actual

151 pruebas en 13 archivos y compilación correctas. El laboratorio PGlite verifica
23 casos secuenciales; 24 pares preparados para PostgreSQL siguen sin ejecutarse.
La rama BA previa al corte usa jefe con aal2 y confirma replay idempotente. No se
modificaron SQL 001–008 ni el frontend durante este ajuste.

La revisión de v28 acepta la corrección del actor. Faltan assertions explícitas
de motivo, conteo total de sesiones y receipt de seed; se incluyen con el primer
adaptador de seis RPC en DATA-ADAPTER-FOUNDATION.md. Preparar estas instrucciones
no incrementa el porcentaje: integración todavía sin implementar.

La demo usa localStorage y selector simulado. Que haya pruebas SQL verdes no
significa que esos permisos ya gobiernen la página ni que se envíe correo.

## Siguiente camino

1. Ejecutar fundación del adaptador y completar assertions de guía (Luna medio).
2. Revisar el adaptador (Sol medio); después cerrar lecturas y coordinación del
   frontend con el contrato actual, sin crear servicios antes de lo previsto.
3. Completar producto y validaciones reales/piloto antes de migrar a compañeros.
4. Al aprobar la versión definitiva, registrar esa decisión y activar los nuevos
   servicios dedicados y flujo dev/prod según AUTOMATED-DELIVERY.md.

Referencias: architecture/REVIEW-008-FINAL-20261001.md, EXECUTION-NEXT.md,
PRODUCT-ROADMAP.md y ops/AUTOMATED-DELIVERY.md. La página y código continúan en Sites
privado; cada publicación nativa registra su SHA exacto en Git/main.
