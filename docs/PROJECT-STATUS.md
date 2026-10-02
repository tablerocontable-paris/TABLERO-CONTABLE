# Estado del proyecto — 02/10/2026

**Avance estimado: 40% del producto final (rango razonable: 35–45%).** Es una
estimación por etapas, no una medición automática: la demo y los contratos locales
están avanzados, pero autenticación, datos compartidos, integración, validación
operativa e infraestructura final siguen pendientes. No está listo para migrar.

| Etapa (peso estimado) | Estado y avance estimado de esa etapa |
| --- | --- |
| Demo, experiencia y reglas (25%) | 75%: tablero y funciones demostrables avanzadas; faltan cerrar parte de experiencia y funciones de administración/proceso |
| Contrato de datos y reglas SQL (25%) | 65%: migraciones 001–008 revisadas y pruebas locales; concurrencia y Supabase real pendientes |
| Integración, cuentas y permisos (25%) | 5%: frontera de seis RPC validada localmente; frontend aún usa persistencia/selector de demostración, sin Auth/RLS/datos compartidos conectados |
| Funcionalidad final y operación (15%) | 25%: reportes/reglas están delineados; faltan integración de reportes, áreas de administración y procesos Kaizen/5S aplicados |
| Validación, infraestructura y migración (10%) | 0%: faltan QA real, piloto de Juan Pablo y servicios definitivos |

El 40% se obtiene ponderando esas etapas; el rango
35–45% refleja que los porcentajes por etapa todavía son estimaciones. No significa
que 40% de los empleados puedan migrarse: hoy no hay base de producción conectada.

## Evidencia actual

175 pruebas en 15 archivos y compilación correctas. El laboratorio PGlite verifica
23 casos secuenciales; 24 pares preparados para PostgreSQL siguen sin ejecutarse.
La rama BA previa al corte usa jefe con aal2 y confirma replay idempotente. No se
modificaron SQL 001–008 ni el frontend durante este ajuste.

Las assertions pendientes de la guía están completas, incluida la identidad
dentro del B renderizado, motivo, conteo de sesiones y receipt de seed. El primer
adaptador de seis RPC conserva filas, claves y argumentos, valida ACKs y separa
fallos sin reintentar automáticamente. 23 pruebas nuevas cubren esta frontera
y su composición con SQL. La revisión del adaptador está aceptada tras corregir
ADP-R01: comparación temporal conserva fracciones menores a un milisegundo.
La prueba de regresión pasó y los contratos de lectura ya están definidos.
Esta base local eleva ligeramente la etapa de integración; el porcentaje global
redondeado sigue en 40%. La página todavía no utiliza el gateway.

La demo usa localStorage y selector simulado. Que haya pruebas SQL verdes no
significa que esos permisos ya gobiernen la página ni que se envíe correo.

## Siguiente camino

1. Ejecutar lector tipado/paginado y recarga confirmada de filas (Luna medio),
   según DATA-READ-FOUNDATION.md; después revisión Sol medio.
2. Cerrar coordinación asíncrona del frontend con el contrato actual,
   sin crear servicios antes de lo previsto.
3. Completar producto y validaciones reales/piloto antes de migrar a compañeros.
4. Al aprobar la versión definitiva, registrar esa decisión y activar los nuevos
   servicios dedicados y flujo dev/prod según AUTOMATED-DELIVERY.md.

Referencias: architecture/REVIEW-008-FINAL-20261001.md, EXECUTION-NEXT.md,
architecture/REVIEW-DATA-ADAPTER-20261002.md, PRODUCT-ROADMAP.md y
ops/AUTOMATED-DELIVERY.md. La página y código continúan en Sites
privado; cada publicación nativa registra su SHA exacto en Git/main.
