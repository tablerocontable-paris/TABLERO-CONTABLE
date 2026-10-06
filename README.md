# Grupo París — nueva generación 0.4

Aplicación React + TypeScript + Vite con identidad oficial, inducción guiada, cuatro empresas independientes, tablero automático, actividad operativa, KPI ponderado, jerarquía y cierre mensual.

## Ejecución

```sh
npm ci
npm run dev
npm test
npm run build
# Con Chromium instalado, opcional:
CHROMIUM_PATH=/ruta/a/chromium npm run test:browser
```

El build produce dist/. Sites publica ese directorio con .openai/hosting.json. Las fuentes y el lockfile se guardan en el repositorio privado de Sites. El repositorio GitHub legacy se consultó en lectura y no recibe commits de esta implementación.

## Nuevo en 0.4

- Temas claro, oscuro y automático; se guarda la elección y se sigue el sistema operativo.
- Recurrencias por tarea: puntual, diaria, semanal/múltiples días y mensual; intervalo y fecha final; vencimiento opcional calculado desde cada ocurrencia.
- Inducción con múltiples tareas particulares y configuración individual. Reprogramación de jefatura con versión nueva, preservando trabajo iniciado y cierres.
- Cronómetro con sesiones, pausa, reanudación, un cronómetro por ejecutor, parada al completar/esperar y conteo explícito de reaperturas. Tiempo registrado por ejecutor en análisis.
- Ausencias y cobertura temporal; relación jerárquica editable por Juan Pablo, gerente. Valentino mantiene perfil de empleado.
- Laboratorio de pruebas con copia en almacenamiento separado y entorno fijado por pestaña; no modifica KPI ni tareas principales. Todavía no es una cuenta técnica autenticada.

Ver [decisiones y próximos pasos](docs/PRODUCT-ROADMAP.md). La infraestructura nueva con cuenta dedicada se creará después de validar el producto, por pedido del usuario.

## Funcionalidad publicada

- Alta local de demostración e inducción de seis pasos, con borrador recuperable, empresas, catálogo, tarea particular, frecuencia, preferencias y previsualización.
- Una instancia por asignación/fecha de ocurrencia, independiente por empresa. Filtrado global, búsqueda, lista/tablero, vencimientos y recorrido guiado.
- Inicio y checklist con avance automático de estado, reapertura, esperas externas y bloqueo al cerrar mes.
- Operativas con fecha, cantidades, referencias y metas por tarea/empresa/mes.
- Análisis por empleado, equipo y sector: puntos, cumplimiento, puntualidad, vencidos, metas y detalle explicativo exportable.
- Catálogo de pesos definido por jefe y estructura de responsables. Cierre íntegro por empleado, snapshot y exportación.
- Diseño responsive, fuente local y movimiento reducido según preferencia del sistema.

**Es una demostración local, no un sistema multiusuario conectado.** Los perfiles y las cuatro empresas son ejemplos. Las selecciones de rol simulan el producto. Cada navegador guarda sus propios datos; no hay cuentas reales ni sincronización. No cargar información productiva ni iniciar la migración de empleados todavía.

## Backend preparado, no conectado

supabase/migrations es la fuente del esquema nuevo. Las migraciones locales avanzaron hasta010 (fundación staged de responsabilidad/cobertura), revisada independientemente, y011 tiene contrato de implementación y protocolo de concurrencia cerrados el06/10; ver [protocolo obligatorio](docs/architecture/COORDINATION-011-CONCURRENCY-20261006.md). SQL011 aún no existe. Ninguna se aplicó remotamente. El frontend todavía no está adaptado a las nuevas recurrencias, sesiones, reportes ni coordinación; no conectar el gateway como si esos contratos fueran equivalentes. Incluye relaciones, RLS, escrituras por RPC, checklist automático, recurrencia idempotente, pesos privilegiados con MFA y cierre transaccional calculado en servidor. PGlite no sustituye pruebas PostgreSQL/Supabase reales.

Faltan el adaptador remoto, invitaciones, bootstrap, Auth/MFA real, finalización de inducción en servidor, tareas particulares con aprobación, evidencia en Storage, recuperación y diagnóstico. No se ejecutaron migraciones remotas ni se modificó la base legacy.

Ver [decisiones](docs/architecture/DECISIONS.md), [revisión legacy](docs/architecture/LEGACY-REVIEW.md), [incorporación manual](docs/MIGRATION.md) y [contrato SQL](supabase/README.md).

## Flujo de modelos

Ver [AGENTS.md](AGENTS.md) y [WORKFLOW-MODELS.md](docs/WORKFLOW-MODELS.md): Sol 6.1 alto para razonamiento/revisión; GPT 6 Luna medio para ejecución. Cada devolución debe indicar próximo modelo y acción.
