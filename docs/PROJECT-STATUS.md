# Estado del proyecto — 02/10/2026

**Código funcional — Sites v41/v42:** commit
`20d4db3c151c3c2eb963352bde4578ab321a0a8d`.
Versión `appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85~appgver_c8c11bed53e08191b963c2e770f681de`,
deploy `appgdep_6ac0053d99ec8191adc2f8769abecc19`, estado succeeded:
https://grupo-paris-contabilidad.valentino-magni.chatgpt.site. Audiencia
restringida al propietario, cero visitantes externos.

v40 conserva la aceptación funcional independiente de UI A, con QA visual
pendiente. Las capturas posteriores detectaron dos colores fijos en tema oscuro;
v41 los corrigió y agregó anticipación de plazos y metas operativas al análisis y
a los nuevos reportes. **217 pruebas/19 archivos, build y diff check aprobados.**
La revisión independiente detectó cuatro fallos reproducibles y discrepancias
de auditoría/CSV/presentación. Reparación pendiente; QA visual completa abierta. Ver `architecture/REVIEW-V40-INDEPENDENT-20261002.md` y
`product/DEADLINE-EFFICIENCY-20261002.md`.

Pedido posterior del 02/10: el arreglo de contraste y la anticipación ya están en
v41/v42. Próximo paso: Luna medio ejecuta DEADLINE-EFFICIENCY-REPAIR-20261002;
luego Sol medio revisa y, tras aceptación, Sol alto retoma B/C. SQL 001–008, permisos remotos e infraestructura no se modificaron.

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
bloque A, revisado parcialmente en v39.
QA visual sigue pendiente: preview arrancó pero navegador bloqueó el acceso con
`net::ERR_BLOCKED_BY_CLIENT`; la ausencia de un binario Chromium no fue confirmada.

**Registro histórico — Sites v36:** commit de implementación `d1a071d8f1f541f0a5bf0e2110bc970185c847bb`,
versión (`appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85~appgver_83b0f5c176e08191af78af0b53f50326`),
deploy `appgdep_6abfdc54a0748191aba607029ceb2066`,
https://grupo-paris-contabilidad.valentino-magni.chatgpt.site. El bloque UI A y
los tests del lector forman ese cambio; no se modificaron gateway, lector de
producción, SQL 001–008 ni dependencias.

La suite vigente de v41 tiene 217 pruebas en 19 archivos. El laboratorio PGlite
verifica 23 casos secuenciales; 24 pares preparados para PostgreSQL siguen sin
ejecutarse. La rama BA previa al corte usa jefe con aal2 y confirma replay
idempotente. Esas comprobaciones locales no sustituyen carreras PostgreSQL reales.

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
El bloque A y la corrección posterior están demostrados en la UI privada; QA
visual final y reparación de la revisión independiente pendientes. Los bloques B/C/D siguen pendientes.
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

1. Luna medio repara según contrato; luego Sol medio revisa. QA visual abierta.
2. Sol alto define contratos de coordinación y pedidos de datos/permisos por
   bloques; Luna implementa cada contrato cerrado.
3. Completar producto y validaciones reales/piloto antes de migrar a compañeros.
4. Al aprobar la versión definitiva, registrar esa decisión y activar los nuevos
   servicios dedicados y flujo dev/prod según AUTOMATED-DELIVERY.md.

Referencias: architecture/REVIEW-008-FINAL-20261001.md, EXECUTION-NEXT.md,
architecture/REVIEW-DATA-ADAPTER-20261002.md, PRODUCT-ROADMAP.md y
ops/AUTOMATED-DELIVERY.md. La página y código continúan en Sites
privado; cada publicación nativa registra su SHA exacto en Git/main.

## Revisión independiente actual

Sites live confirmado v42, versión
`appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85~appgver_bd5d2636e4388191acdd41af1daca971`,
deploy `appgdep_6ac00614bbd881919b493c582d5fcd14`, fuente documental
`97b0cb20432f88e55bd1f09da925cfbf0f07f3ee`. Misma aplicación que v41.
Cuatro probes independientes fallaron; evidencia y contrato en
`product/DEADLINE-EFFICIENCY-REPAIR-20261002.md`. No se modifica producto en esta
revisión ni se despliega documentación para aparentar una reparación.


## Reparación local de anticipación — 02/10/2026

Se cerraron los cuatro defectos reproducidos en v42: completedAt posterior al
corte en el mismo día, timestamp calendario imposible/incompleto, fecha inválida
de actividad propia ignorada y checklist repetido tratado como cambio. La ruta de
mutación ya corta por identidad para evitar audit/commit del no-op. Los timestamps
ISO completos se validan antes de interpretar; `createdAt` futuro no acredita meta.

CSV de análisis marca tasas/promedios nulos como “Sin muestra”; CSV de cierre
distingue ausencia histórica de falta de muestra y añade ambos promedios. La tabla
agrupada muestra promedio operativo y la etiqueta especifica “Meta registrada”.
El corte de análisis se congela una vez por render y se pasa a agregados.

Regresiones integradas: suite **221 pruebas/20 archivos**, `npm run build` y
`git diff --check` aprobados. No se cambió SQL, gateway, lector ni dependencias.
Revisión Sol medio y QA visual de navegador pendientes; avance sigue **40%**.
