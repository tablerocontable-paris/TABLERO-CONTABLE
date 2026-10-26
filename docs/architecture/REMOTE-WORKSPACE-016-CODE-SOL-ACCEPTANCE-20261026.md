# Aceptación Sol — código SQL016 para DEV

Fecha: 26/10/2026
Dictamen: **apto para aplicar SQL016 en grupo-paris-dev**

## Identificación aceptada

- Migración: `supabase/migrations/202610260016_manager_task_revocation.sql`
- SQL016 SHA-256: `F7E76313AD4132626034C5C9D38F1C70AFB140BB3E2CE3615FE89071945ED8F3`
- Contrato: reemplazar únicamente `public.read_coordinated_task_for_manager(uuid)`, conservar DTO v3 y ACL actuales.

## Dictamen y evidencia

La revisión independiente confirmó que SQL016 limita la tarea a la organización del actor y requiere tanto el acceso permanente al responsable como la autorización vigente de instancia. Se conservan firma, payload, política `search_path` y permisos mediante `CREATE OR REPLACE`; no se modifican SQL001–015 ni datos.

La segmentación mantiene `baseline_001_014` en 16 archivos y `apply_015` en 17. `apply_016` exige las 17 versiones previas, un dry-run que muestre sólo SQL016 y este dictamen con el hash exacto antes de ejecutar `db push`.

La prueba focal independiente pasó **10/10 pruebas en 2 archivos**, exit 0. Las regresiones incluyen revocación y reactivación de membresía, vencimiento futuro, jefatura, encargado, empleado, tarea inexistente, aislamiento entre organizaciones y empresas, cobertura/participación fuera de ámbito, privacidad, ACL y validación del DTO v3.

## Condición y límites

Esta aceptación habilita solicitar SQL016 **sólo en `grupo-paris-dev`**, una vez aplicadas y verificadas SQL001–015. La consulta vigente al proyecto muestra actualmente 16 migraciones; SQL015 debe aplicarse antes. No afirma que SQL016 esté aplicada ni que los propietarios/ACL del catálogo instalado, la exposición Data API, Auth real, producción o el sitio operativo estén aceptados. No ejecutar manualmente el SQL ni alterar el orden del workflow.
