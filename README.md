# Grupo París — nueva generación 0.3

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

## Funcionalidad publicada

- Alta local de demostración e inducción de seis pasos, con borrador recuperable, empresas, catálogo, tarea particular, frecuencia, preferencias y previsualización.
- Una instancia por asignación/mes, independiente por empresa. Filtrado global, búsqueda, lista/tablero, vencimientos y recorrido guiado.
- Inicio y checklist con avance automático de estado, reapertura, esperas externas y bloqueo al cerrar mes.
- Operativas con fecha, cantidades, referencias y metas por tarea/empresa/mes.
- Análisis por empleado, equipo y sector: puntos, cumplimiento, puntualidad, vencidos, metas y detalle explicativo exportable.
- Catálogo de pesos definido por jefe y estructura de responsables. Cierre íntegro por empleado, snapshot y exportación.
- Diseño responsive, fuente local y movimiento reducido según preferencia del sistema.

**Es una demostración local, no un sistema multiusuario conectado.** Los perfiles y las cuatro empresas son ejemplos. Las selecciones de rol simulan el producto. Cada navegador guarda sus propios datos; no hay cuentas reales ni sincronización. No cargar información productiva ni iniciar la migración de empleados todavía.

## Backend preparado, no conectado

supabase/migrations es la fuente del esquema nuevo. Incluye relaciones, RLS de lectura, escrituras por RPC, checklist automático, recurrencia idempotente, pesos privilegiados con MFA y cierre transaccional calculado en servidor. Las pruebas ejecutan ambas migraciones en PostgreSQL PGlite con Auth emulado; no sustituyen pruebas contra un Supabase real.

Faltan el adaptador remoto, invitaciones, bootstrap, Auth/MFA real, finalización de inducción en servidor, tareas particulares con aprobación, evidencia en Storage, recuperación y diagnóstico. No se ejecutaron migraciones remotas ni se modificó la base legacy.

Ver [decisiones](docs/architecture/DECISIONS.md), [revisión legacy](docs/architecture/LEGACY-REVIEW.md), [incorporación manual](docs/MIGRATION.md) y [contrato SQL](supabase/README.md).
