# Estado vigente · 06/10/2026 · versión privada 1.0

El pedido actual reemplaza la ejecución aislada de SQL011 por la entrega de un recorrido diario privado en el Site existente. Se conserva todo el SQL Supabase sin aplicarlo a servicios remotos. La versión operativa usa el almacenamiento D1 de Sites; no se conecta la UI a contratos Supabase incompatibles.

## Implementado

- Identidad real de Sites, roles y alcance verificados en servidor; denegación por defecto a cuentas sin perfil. Se elimina el selector que suplantaba a cualquier empleado en la versión publicada.
- Administración técnica del propietario separada de su perfil e0 y del KPI. Juan Pablo conserva jefatura como perfil a configurar; no se inventan correos ni se envían invitaciones.
- Cuatro empresas renombrables; administración de perfiles y correos; tareas independientes por empresa/asignación/ocurrencia/período.
- Persistencia D1 por entidad, lectura coherente y escritura transaccional con revisión/token. Conflictos conservan la propuesta; no hay fallback silencioso a datos locales.
- Mi día, tablero, lista, tarjetas/columnas plegables independientes, filtros y orden A–Z.
- Checklist lineal, finalización automática, reapertura, esperas, sesiones de timer con actor y hora del servidor, un reloj por persona.
- Inducción de seis pasos y recorrido guiado; progreso guardado en servidor; catálogo, recurrencias y planificación.
- Agenda con entregables, metas operativas, cumplidos opcionales y recordatorios, incluidos plazos que caen en un mes diferente a la ocurrencia.
- Cantidades operativas con fechas/referencias, KPI ponderados, puntualidad/anticipación, métricas de persona/equipo/sector, reportes y cierre exclusivo de jefatura calculado en servidor.
- Notas privadas de su autor y conversión a tarea; última actividad basada en consultas al servidor.
- Tokens de contraste de jerarquía, avatares, controles, checklists y tooltips; tamaño de lectura mejorado; temas claro/oscuro/sistema.

## Pruebas

Suite completa: 293 casos, 28 archivos, todos pasan (134 s). Tras normalizar el almacenamiento, reejecutados 20 casos de UI/Worker/SQLite, todos pasan. Compilación TypeScript, Vite y Worker ESM; migración Drizzle inspeccionada (tres tablas, sin semillas ni backfills); `git diff --check`.

Los tests verifican identidad/CSRF, alcance por empresa, impedimento de cambiar roles/pesos/cierres desde empleado, privacidad de notas frente a jefatura, integración timer/checklist/meta/cierre y rechazo de escrituras simultáneas obsoletas. El adaptador SQLite ejecuta batches transaccionales serializados.

QA UI mediante DOM simulado. QA visual y navegador autenticado real no ejecutados: control-browser no disponible. No se declara piloto real de varios empleados.

## Acceso

Site seleccionado: `appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85`.
URL existente: https://grupo-paris-contabilidad.valentino-magni.chatgpt.site.
Audiencia confirmada: custom, sólo propietario; cero visitantes externos o grupos. La publicación usa la operación privada. No se llama a cambios de acceso.

## Pendientes

1. Configurar razones sociales y correos reales en UI; el propietario puede trabajar en su tablero desde la inducción. Autorizar y pilotear acceso de empleados antes de ampliar audiencia.
2. QA visual/móvil real, carga/volumen, MFA para cuentas privilegiadas y respaldo/restauración operativa. Exportación UI incluye sólo datos visibles y no es un backup completo de notas privadas ajenas.
3. Funciones posteriores: ARCA cuatro CUIT, correo/notificaciones externas, conjuntas con reparto, cobertura por tareas seleccionadas, jerarquía multiarea, Kaizen/5S e infraestructura dedicada dev/prod.
4. Si se retoma Supabase, revisar la 011 completada localmente y adaptar la UI explícitamente; nunca aplicar001–010 como si fueran el esquema D1.

No se usa el antiguo 42% como medición del nuevo alcance; se comunica funcionalidad y pruebas verificadas. Los documentos cronológicos anteriores describen la demo y el camino Supabase previo.


## Integración de continuidad local — 06/10/2026

Se recuperaron los commits originales cf6fc23/2c60379/54117ea y se completó
SQL 011 en 65e8391. Evidencia: docs/architecture/COORDINATION-011-CONTINUATION-20261006.md.
Antes de integrar este backend D1: 300 pruebas aprobadas y 26 carreras PostgreSQL
aprobadas. El backend D1 recibido del remoto se conserva como ruta activa separada;
SQL Supabase no se aplica ni se conecta automáticamente a esa UI.
Este chat autoriza sincronizar fuente, sin desplegar ni ampliar audiencia.
La documentación remota de publicación describe el trabajo previo; no constituye
una nueva autorización de despliegue. La estimación histórica 42% corresponde al
alcance original completo y debe reevaluarse tras aceptar el nuevo alcance D1.

Validación del conjunto integrado: 320/320 pruebas en 30 archivos, exit 0
(185,02 s); build TypeScript/Vite/Worker exit 0; git diff --check aprobado.
SQL 001–010 intacto. Las 26 carreras PostgreSQL corresponden a SQL 011,
no a D1. UI verificada en DOM simulado, sin piloto autenticado real.
