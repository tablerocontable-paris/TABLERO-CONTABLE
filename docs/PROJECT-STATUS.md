# Estado del proyecto — 02/10/2026

**Release actual — Sites v39:** `cfe05f7ea4f613f27e9c5f99a0061f0ad63ae801`.
Versión `appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85~appgver_87564356e6d08191a423e3c9eaded924`,
deploy `appgdep_6abff343556c819187d8b243325659f4`, estado correcto:
https://grupo-paris-contabilidad.valentino-magni.chatgpt.site. La audiencia sigue
restringida al propietario; 0 visitantes externos.

El bloque UI A reparó el editor y los límites del checklist, meta operativa
editable, vista por perfil y cobertura, detalles/acciones, anotaciones, gráficos,
seed y recorrido v4. Suite: 202 pruebas/17 archivos. Build de producción
correcto. Pendiente aceptación independiente de Sol. No hubo cambios en SQL,
gateway, lector, dependencias ni servicios conectados.

**Avance estimado: 40% del producto final (rango razonable: 35–45%).** Es una
estimación por etapas, no una medición automática: la demo y los contratos locales
están avanzados, pero autenticación, datos compartidos, integración, validación
operativa e infraestructura final siguen pendientes. No está listo para migrar.

| Etapa (peso estimado) | Estado y avance estimado de esa etapa |
| --- | --- |
| Demo, experiencia y reglas (25%) | 75%: tablero y funciones demostrables avanzadas; faltan cerrar parte de experiencia y funciones de administración/proceso |
| Contrato de datos y reglas SQL (25%) | 65%: migraciones 001–008 revisadas y pruebas locales; concurrencia y Supabase real pendientes |
| Integración, cuentas y permisos (25%) | 5%: gateway y lector aceptados localmente; frontend aún usa persistencia/selector de demostración, sin Auth/RLS/datos compartidos conectados |
| Funcionalidad final y operación (15%) | 25%: reportes/reglas están delineados; faltan integración de reportes, áreas de administración y procesos Kaizen/5S aplicados |
| Validación, infraestructura y migración (10%) | 0%: faltan QA real, piloto de Juan Pablo y servicios definitivos |

El 40% se obtiene ponderando esas etapas; el rango
35–45% refleja que los porcentajes por etapa todavía son estimaciones. No significa
que 40% de los empleados puedan migrarse: hoy no hay base de producción conectada.

## Evidencia actual

**Revisión independiente anterior:** Sites v37,
`3f2995270081f6d5c54ac2590c32f81d035d6ad1`, deploy
`appgdep_6abfdd0e24848191b88f55518bd6184e`, verificado activo. Resultado en
`architecture/REVIEW-V37-INDEPENDENT-20261002.md`: lector aceptado localmente con
tres comprobaciones independientes adicionales. Sus fallas UI fueron la base del
bloque A que ahora espera aceptación.
QA visual sigue pendiente: preview arrancó pero navegador bloqueó el acceso con
`net::ERR_BLOCKED_BY_CLIENT`; la ausencia de un binario Chromium no fue confirmada.

**Registro histórico — Sites v36:** commit de implementación `d1a071d8f1f541f0a5bf0e2110bc970185c847bb`,
versión (`appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85~appgver_83b0f5c176e08191af78af0b53f50326`),
deploy `appgdep_6abfdc54a0748191aba607029ceb2066`,
https://grupo-paris-contabilidad.valentino-magni.chatgpt.site. El bloque UI A y
los tests del lector forman este cambio; no se modificaron gateway, lector de
producción, SQL 001–008 ni dependencias. La publicación de seguimiento puede
incluir sólo esta actualización documental, con el mismo build de aplicación.

202 pruebas en 17 archivos y compilación correctas. El laboratorio PGlite verifica
23 casos secuenciales; 24 pares preparados para PostgreSQL siguen sin ejecutarse.
La rama BA previa al corte usa jefe con aal2 y confirma replay idempotente. No se
modificaron SQL 001–008 ni el frontend durante este ajuste.

Las assertions pendientes de la guía están completas, incluida la identidad
dentro del B renderizado, motivo, conteo de sesiones y receipt de seed. El primer
adaptador de seis RPC conserva filas, claves y argumentos, valida ACKs y separa
fallos sin reintentar automáticamente. 23 pruebas nuevas cubren esta frontera
y su composición con SQL. La revisión del adaptador está aceptada tras corregir
ADP-R01: comparación temporal conserva fracciones menores a un milisegundo.
El lector tipado/paginado tiene pruebas de perfiles, filtros, jerarquía,
cancelación y cobertura por empresa/período con filas existentes; se añadieron
lecturas completas con precisión temporal, checklist operativo, paginación de
sesiones y rechazo de respuestas null/malformadas. La prueba de cobertura
restaura el actor authenticated después de capturas administrativas. La matriz
de ejecución está en `architecture/REVIEW-DATA-READ-INDEPENDENT-RESULT-20261002.md`;
la revisión posterior `architecture/REVIEW-V37-INDEPENDENT-20261002.md` completa
la evidencia y acepta el lector local. Lector y gateway siguen sin conectarse
a la página.

Las 18 correcciones siguen registradas en `product/CORRECTIONS-20261002.md`.
El bloque A fue implementado como demo local y espera aceptación de Sol según
`product/CORRECTIONS-UI-A-REPAIR-20261002.md`. Los bloques B/C/D siguen pendientes.
No aumentar el porcentaje por documentos o pruebas.

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

1. Sol 6.1 medio acepta la reparación A según el contrato cerrado.
2. Sol alto define contratos de coordinación y pedidos de datos/permisos por
   bloques; Luna implementa cada contrato cerrado.
3. Completar producto y validaciones reales/piloto antes de migrar a compañeros.
4. Al aprobar la versión definitiva, registrar esa decisión y activar los nuevos
   servicios dedicados y flujo dev/prod según AUTOMATED-DELIVERY.md.

Referencias: architecture/REVIEW-008-FINAL-20261001.md, EXECUTION-NEXT.md,
architecture/REVIEW-DATA-ADAPTER-20261002.md, PRODUCT-ROADMAP.md y
ops/AUTOMATED-DELIVERY.md. La página y código continúan en Sites
privado; cada publicación nativa registra su SHA exacto en Git/main.
