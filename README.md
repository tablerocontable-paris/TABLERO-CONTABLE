# Grupo París · versión privada operativa 1.0

React, TypeScript y Vite, con API Cloudflare Worker y persistencia D1 administrada por Sites. Se continúa el proyecto existente; el GitHub legacy `Valentinomagni/tablero-contable-grupo-paris` se conserva como referencia de lectura y no recibe cambios ni datos.

## Recorrido diario

1. En **Administrar tablero → Equipo**, renombrar las cuatro empresas y configurar responsables, correos, sectores y empresas autorizadas.
2. Abrir **Mi tablero · Valentino** y completar la inducción de seis pasos. Los procesos del catálogo conservan nombre, controles y peso; cada empresa tiene asignaciones y ocurrencias independientes.
3. Crear tareas puntuales o recurrentes. Iniciar trabajo, cronometrar, pausar, completar controles, registrar esperas y cantidades de operativas.
4. Consultar vencimientos, objetivos con fecha y recordatorios. La última marca del checklist completa el entregable. La meta operativa se alcanza mediante registros fechados, sin atribuir cantidades ficticias.
5. Revisar cumplimiento, puntos ponderados, anticipación y tiempo por persona, equipo, sector y empresa. Jefatura consolida cada empleado; el servidor calcula el snapshot y bloquea ese período. Reportes y CSV están disponibles inmediatamente.

Los datos se guardan en el servidor y se actualizan cada 30 segundos. El indicador distingue cambios pendientes, confirmados y fallidos. Un conflicto de revisión exige recargar; no sobrescribe otra sesión. Una propuesta fallida permanece en memoria y puede descargarse o reintentarse. No hay guardado offline definitivo.

## Acceso y privacidad

El Site sigue limitado a su propietario. Incorporar un perfil **no** invita personas ni cambia la audiencia. Los demás empleados necesitan aprobación de acceso al Site, además de un perfil activo con correo coincidente y empresas asignadas.

La identidad proviene de los encabezados autenticados que entrega Sites, nunca del selector del navegador. El propietario puede alternar solamente entre su perfil de empleado y su administración técnica, separados del KPI. No puede simular otros empleados en la aplicación publicada. Cada solicitud comprueba rol, persona, empresa y período en servidor. Las notas personales se excluyen de las respuestas de otros perfiles, incluso jefatura. Los relojes y cierres usan tiempos del servidor.

D1 guarda cada entidad por separado. Una revisión y un token de escritura condicionan todos los cambios dentro de un `batch` transaccional; una escritura concurrente obsoleta no puede afectar registros. El esquema generado está en `db/schema.ts` y `drizzle/`. Las migraciones Supabase 001–010 se conservan sin aplicar y no son el backend de esta versión.

## Validación y límites

La suite completa pasó **293 pruebas en 28 archivos**. Después del cambio del almacenamiento se verificaron los **20 casos operativos/UI** afectados y la compilación TypeScript/Vite/Worker. Las pruebas de Worker usan SQLite real; las UI usan DOM simulado. No equivalen a una sesión con varios empleados reales ni a QA visual en navegador. El skill de control de navegador no estaba disponible en esta ejecución; no se improvisó otro controlador.

El despliegue privado permite uso por el propietario y preparar el equipo. Antes de incorporar empleados: aprobación de audiencia, piloto de cuentas reales, revisión visual/móvil y volumen, respaldo/restauración y política de MFA de cuentas privilegiadas. No se anuncia una migración masiva ni equivalencia con Supabase Auth/RLS.

Pendientes secundarios: ARCA para cuatro CUIT, correo/notificaciones externas, conjuntas con reparto de contribuciones, coberturas selectivas, jerarquía multiarea, Kaizen/5S e infraestructura dedicada dev/prod. La cobertura básica por ausencia y las métricas existentes se conservan.

## Desarrollo

```sh
npm ci
npm test -- --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000
npm run build
```

El build emite `dist/client`, `dist/server/index.js` y metadatos de hosting. `OWNER_EMAIL` y `SITE_ORIGIN` se configuran en Sites; no se escriben secretos en el código. `npm run dev` es la vista local Vite; las pruebas de API usan el Worker y SQLite, y la funcionalidad compartida se sirve en Sites.

Ver `docs/PROJECT-STATUS.md`, `docs/EXECUTION-NEXT.md` y `docs/runbooks/SITES-PRIVATE-1.md`. La evidencia y los contratos históricos siguen en Git.


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
