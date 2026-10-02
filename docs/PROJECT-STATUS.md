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

182 pruebas en 17 archivos y compilación correctas. El laboratorio PGlite verifica
23 casos secuenciales; 24 pares preparados para PostgreSQL siguen sin ejecutarse.
La rama BA previa al corte usa jefe con aal2 y confirma replay idempotente. No se
modificaron SQL 001–008 ni el frontend durante este ajuste.

Las assertions pendientes de la guía están completas, incluida la identidad
dentro del B renderizado, motivo, conteo de sesiones y receipt de seed. El primer
adaptador de seis RPC conserva filas, claves y argumentos, valida ACKs y separa
fallos sin reintentar automáticamente. 23 pruebas nuevas cubren esta frontera
y su composición con SQL. La revisión del adaptador está aceptada tras corregir
ADP-R01: comparación temporal conserva fracciones menores a un milisegundo.
El lector tipado/paginado está implementado y probado con transportes unitarios
y SELECTs parametrizados bajo RLS simulada; evidencia en
`architecture/review-evidence/data-read-foundation-20261002.json`.
Su revisión v32 deja la aceptación pendiente: faltan escenarios acordados de
roles/cobertura y lecturas tras RPC/switch, además de unitarias y table literal
fija. La batería se reejecutó con 182 pruebas/17 archivos y build correctos,
pero no demuestra los casos ausentes. Ver REVIEW-DATA-READ-20261002.md y
su evidencia data-read-review-20261002.json. No avanzar al coordinador todavía.
Esta base local eleva ligeramente la etapa de integración; el porcentaje global
redondeado sigue en 40%. La página todavía no utiliza el gateway.

La demo usa localStorage y selector simulado. Que haya pruebas SQL verdes no
significa que esos permisos ya gobiernen la página ni que se envíe correo.

El cronómetro se puede accionar y visualizar en la demo; su estado y sesiones
persisten en el almacenamiento local de ese navegador, por lo que no es todavía
un registro compartido ni sirve para controlar tiempo real de los empleados. Las
RPC de cronómetro existen en SQL local y tienen pruebas de laboratorio; no están
conectadas al sitio publicado. La presencia/última conexión tampoco está
implementada: sin Auth y señales de sesión servidor no se puede saber de manera
fiable quién está usando la aplicación. Requisito de gerencia agregado al
roadmap, pendiente de diseño/revisión y de la fase de autenticación.

## Siguiente camino

1. Completar aceptación del lector (Luna medio): DATA-READ-ACCEPTANCE-COMPLETION.md.
2. Revisión Sol 6.1 medio; después definir coordinación asíncrona del frontend.
3. Completar producto y validaciones reales/piloto antes de migrar a compañeros.
4. Al aprobar la versión definitiva, registrar esa decisión y activar los nuevos
   servicios dedicados y flujo dev/prod según AUTOMATED-DELIVERY.md.

Referencias: architecture/REVIEW-008-FINAL-20261001.md, EXECUTION-NEXT.md,
architecture/REVIEW-DATA-ADAPTER-20261002.md, PRODUCT-ROADMAP.md y
ops/AUTOMATED-DELIVERY.md. La página y código continúan en Sites
privado; cada publicación nativa registra su SHA exacto en Git/main.
