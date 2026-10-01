# Publicación y operación

## Entrega 008 — 01/10/2026

Ejecución local completa: 151 pruebas/13 archivos, 32 casos críticos aislados,
build TypeScript/Vite y archivos congelados verificados. El código se guarda,
envía y publica en Sites privado con el mismo SHA. Fuente exacta: `git log -1`
y registro de versión en Sites; el detalle está en
`docs/architecture/REVIEW-008-EXECUTION-20261001.md`.

Próximo paso: revisión Sol 6.1 alto. PostgreSQL concurrente, Supabase real,
integración y correo siguen pendientes; aún no se migra al Gmail/GitHub/Supabase/
hosting dedicados. Las verificaciones históricas inferiores pertenecen a sus
iteraciones y no implican QA visual nueva en esta entrega.

## Ubicación actual

- Fuente: repositorio Git privado asignado por Sites, rama main; ver git remote -v.
- Página: https://grupo-paris-contabilidad.valentino-magni.chatgpt.site (privada).
- Build: npm ci y npm run build; entrega estática dist/ declarada en .openai/hosting.json.
- Versiones: commit exacto enviado al remoto + archivo de build + publicación privada mediante Sites. Se verifica estado final del despliegue.
- GitHub/Cloudflare: el repositorio y la página anteriores no se modificaron. Todavía no hay repositorio GitHub nuevo ni deploy nuevo en Cloudflare.

## Verificación

npm test ejecuta reglas de dominio y las migraciones SQL completas sobre PostgreSQL PGlite. npm run build valida TypeScript y produce los assets.

La revisión de navegador comprueba alta/inducción/pausa/recuperación, dos conciliaciones del mismo banco en distintas empresas, checklist automático, registro operativo, agrupaciones analíticas, cierre íntegro aun con filtro, bloqueo posterior y ancho móvil. Esa revisión corresponde a la demo local, no a Supabase Auth/RLS real.

## Datos y recuperación

El sitio actual guarda en localStorage (paris-state-v3). No sincroniza entre dispositivos y una limpieza del navegador pierde la demostración local. La primera carga conserva la clave anterior y su copia de respaldo; no son datos de la base legacy. El histórico cerrado conserva tareas y actividad, además de la exportación CSV.

Para producción se debe agregar respaldo de la base nueva con retención y una restauración probada. Exportar CSV no reemplaza ese respaldo. Aplicar primero las instrucciones de docs/MIGRATION.md y validar un empleado piloto.

## Revertir una publicación

Seleccionar una versión anterior guardada en Sites y desplegarla preservando la audiencia. Revertir frontend no revierte datos SQL; las migraciones productivas requieren procedimiento propio y respaldo. No ejecutar una eliminación de tablas como rollback.

## Verificación de la versión 0.4

30 pruebas automatizadas (dominio y contrato SQL 0.3), build TypeScript/Vite y recorrido Chromium del build: temas claro/oscuro/sistema, inducción, aislamiento por empresa, checklist, operativas, agrupaciones, cierre íntegro y bloqueo, recurrencias octubre/noviembre, tarea puntual, cronómetro persistente/pausa, registro de ausencia y laboratorio aislado. Se revisaron capturas de escritorio oscuro, ausencias y laboratorio; se verificó ancho móvil sin desbordamiento.

El laboratorio fija su destino de guardado por instancia de la app, para que salir en otra pestaña no convierta una pestaña de pruebas en escritora del tablero principal. No es una cuenta técnica real y no publica señales de presencia.

## Actualización del 01/10/2026

Reporte generado en cada nuevo cierre: snapshot por empleado y período, destinatarios de jefatura, agrupación por empresa y código de catálogo, tiempo registrado y reaperturas. Visible en Cierre del mes y exportable a CSV. No envía correo; el contrato de entrega productiva está en docs/product/STANDARDIZATION-REPORTS-IMPROVEMENT.md.

Las nuevas tareas del catálogo conservan identidad y controles; las particulares libres sólo admiten frecuencia única. La inducción puede elegir empresas por proceso. Jefatura puede incorporar procesos estándar.

34 pruebas de dominio/SQL aprobadas y build TypeScript/Vite. Cuatro pruebas adicionales verifican consistencia entre empresas, restricción de recurrencia libre, generación única de reportes y conservación del snapshot. Esta actualización no añade una verificación de navegador: el Chromium de este entorno falla al iniciar, antes de cargar la aplicación.

## Tablero plegable y contrato de ocurrencias — 01/10/2026

Columnas Pendiente/En curso/Completada independientes: Pendiente inicia abierta; las otras plegadas. Abrir una conserva el estado de las demás. Orden A-Z/Z-A aplica al tablero y lista después de filtrar; no altera las tareas guardadas. 40 pruebas aprobaron: además de las verificaciones de tablero/estándar/reporte, PGlite valida upgrade 0.3, versiones de catálogo, recurrencias y vencimientos. La revisión y las instrucciones de próxima ejecución están en docs/architecture/CONTRACT-REVIEW-20261001.md. Se agregó localmente la migración de ocurrencias; no se aplicó en un Supabase remoto ni se conectó la interfaz.

Ajuste de tema — 01/10/2026: las superficies, bordes, contadores y foco de las columnas plegables siguen las variables del tema claro/oscuro. La corrección se localizó al revisar la captura enviada. Build aprobado; la verificación de navegador permanece pendiente por fallo de arranque de Chromium del entorno.
