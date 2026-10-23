# Aceptación Sol — código SQL015 para DEV

Fecha: 23/10/2026
Dictamen: **apto para aplicar SQL015 en grupo-paris-dev**

## Identificación aceptada

- Migración: `supabase/migrations/202610230015_workspace_page.sql`
- SQL015 SHA-256: `CC49480D1317F1B44CD29F245508F9C8FB0B0894FE4E66C1B22F8E00D36B33F2` (UTF-8/LF)
- Contrato de checklist aceptado para implementación local: `docs/architecture/REMOTE-WORKSPACE-CHECKLIST-PAGING-SOL-PROPOSAL-20261023.md`
- Contrato SHA-256: `34C7A45A02100E28617E5E180753472F148E6E1D96152003A9757DF61128E36D`

## Dictamen

La revisión independiente del SQL, DTO/Zod, autorización y evidencia no encontró
un defecto bloqueante para aplicar esta migración **únicamente a
`grupo-paris-dev`**. La compatibilidad de `workspacePage` v1 y la delegación de
los demás kinds a SQL014 se conservan. Los kinds nuevos paginan checklists
extensos sin truncarlos, enlazan cada página con sujeto, tarea y revisión, y
vuelven a comprobar autorización vigente. También se revisaron privacidad,
permisos de encargado, coberturas y ausencias legacy, coeficientes históricos,
cursores canónicos, límites de transporte y el incremento de revisión en
escrituras de checklist.

## Evidencia revisada

- `docs/architecture/REMOTE-WORKSPACE-CHECKLIST-PAGING-IMPLEMENTATION-LUNA-20261023.md`
- `docs/architecture/review-evidence/workspace-checklist-paging-015-luna-20261023.json`
- `tests/supabase-workspace-page-015.test.ts`: 18/18 aprobadas en la corrida
  focal. Incluye autorización y revocación entre páginas, compatibilidad y
  decodificación, Unicode, cursores, privacidad, snapshots de coeficientes y
  carga sintética de 2.000 tareas.
- `tests/supabase-dev-migration-guard.test.ts`: 4/4 aprobadas; valida
  segmentación, historial, dry-run y rechazo de ausencia/hash de aceptación.
- En la verificación de esta revisión, `verify-files` pasó para las 17
  migraciones y `verify-acceptance` permaneció cerrado hasta registrar este
  documento con el hash exacto.

El benchmark usa PGlite y datos sintéticos; no es una medición del RPC en un
proyecto Supabase alojado. El selector tiene `EXPLAIN ANALYZE` parcial, no un
plan completo del RPC. Las anomalías de controles históricos se exponen con
códigos de incidencia en el detalle paginado; no se truncan ni invalidan por sí
solas el resto de la página.

## Alcance y condiciones

Esta aceptación permite solicitar la aplicación de SQL015 **sólo en
`grupo-paris-dev`**, una vez que el workflow confirme el destino, el historial
remoto exacto de 16 migraciones 001–014 y un dry-run que muestre sólo SQL015.
No afirma que la migración haya sido aplicada. No aprueba producción, la
conexión de la UI, el despliegue del producto ni la activación del espacio
operativo.

SQL014 y las migraciones 001–013 permanecen sin modificaciones en este cambio.
