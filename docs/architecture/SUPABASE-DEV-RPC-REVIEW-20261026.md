# Revisión estática de RPC Supabase DEV — corte histórico 26/10/2026

## Alcance y límites

Lectura estática original de las migraciones versionadas 001–014, siguiendo
reemplazos, renombres, eliminaciones y grants. Esta sección conserva ese corte
como antecedente y no describe el estado final tras SQL015/016. No se ejecutó
SQL ni se modificó DEV. El análisis reconstruye definiciones y ACL desde
archivos; no demuestra los propietarios efectivos, la configuración del
Dashboard, el estado instalado del catálogo ni el comportamiento de Auth contra
el proyecto remoto.

## Actualización de alcance 015–016 — 27/10/2026

La lectura de este informe se completó con los cambios de
`202610230015_workspace_page.sql` y `202610260016_manager_task_revocation.sql`.
SQL015 crea las funciones internas `app_private.api_workspace_page`,
`api_workspace_page_v2` y `api_task_checklist_page` como `SECURITY DEFINER`,
revoca su ejecución a los roles de cliente y reemplaza `api.query_v1` por un
dispatcher que sólo concede `EXECUTE` a `authenticated`. SQL016 reemplaza
`public.read_coordinated_task_for_manager(uuid)` y conserva su guard de
autorización; no introduce grants nuevos. En ambos archivos las definiciones
`SECURITY DEFINER` declaran `search_path=''`.

La regresión `tests/supabase-manager-task-revocation-016.test.ts` cubre el
recorrido local de instalación 014→015→016, ACL simuladas (`authenticated`
permitido, `anon` y `PUBLIC` denegados), revocación/reactivación, límites de
equipo/organización, perfil inactivo y exclusión de notas privadas. La evidencia
registrada informa 10 pruebas focales aprobadas y suite/build/package en el
árbol evaluado. Esto no ejecuta las pruebas contra Auth/Data API del proyecto
hosteado.

El inventario numérico de 39 RPC públicas y 138 definiciones `SECURITY
DEFINER` de abajo pertenece al corte 001–014; no se debe presentar como un
recuento final actualizado. La consulta read-only al catálogo DEV del 27/10
obtuvo el recuento acumulado siguiente:

| Esquema | Funciones `SECURITY DEFINER` | Ejecutables por `authenticated` | Ejecutables por `anon`/`PUBLIC` |
|---|---:|---:|---:|
| `public` | 88 | 39 | 0 |
| `api` | 12 | 3 | 0 |
| `app_private` | 42 | 0 | 0 |
| **Total** | **142** | **42** | **0** |

Las 142 son propiedad de `postgres` y tienen `search_path` vacío. `api` otorga
USAGE a `authenticated` y no a `anon`; `app_private` no otorga USAGE a ninguno.
`public` otorga USAGE a ambos, por lo que falta confirmar en Dashboard si ese
esquema sigue expuesto por Data API. Se encontraron dos funciones públicas
`RETURNS trigger`, no `SECURITY DEFINER`, con `EXECUTE` de `PUBLIC`:
`normalize_assignment_schedule` y `reject_template_version_change`. Sus tipos de
retorno impiden invocarlas como RPC ordinarias y `anon` no tiene DML directo;
un subagente las clasificó como hardening de defensa en profundidad, no como
una vía de acceso demostrada. La revocación requiere una prueba local de que los
triggers existentes continúan ejecutándose antes de considerar una migración.

El catálogo efectivo ya fue contrastado en DEV. Siguen sin verificación la lista
de esquemas expuestos del Dashboard y las pruebas de denegación con identidades
Auth hosteadas.

## Resultado de la reconstrucción

La reconstrucción encuentra **39 funciones `SECURITY DEFINER` en `public`
ejecutables por `authenticated`**, más tres RPC en `api`: `get_context_v1`,
`query_v1` y `command_v1`. Las 138 definiciones finales `SECURITY DEFINER`
revisadas fijan `search_path` vacío. No se encontró `EXECUTE` para `PUBLIC` ni
`anon` en el estado reconstruido. Los permisos internos `app_private` están
revocados en el DDL revisado. Esto no sustituye la comprobación de ACL y roles
instalados en el servidor.

Funciones públicas agrupadas por propósito:

- Identidad y acceso (9): `actor_org`, `actor_role`, `can_access_owner`,
  `can_access_instance`, `can_cover_instance`,
  `can_read_company_membership`, `can_read_monthly_closure`,
  `can_read_period_report`, `can_read_private_block_note`.
- Consulta de tareas (2): `read_coordinated_task`,
  `read_coordinated_task_for_manager`.
- Primer ingreso (5): `save_onboarding`, `save_onboarding_draft`,
  `submit_onboarding`, `request_onboarding_changes`, `approve_onboarding`.
- Catálogo/materialización (4): `create_task_template`,
  `create_catalog_assignment`, `update_template_weight`, `materialize_month`.
- Estado/controles/espera (6): `transition_task`, `transition_task_reviewed`,
  `set_checklist_item`, `set_checklist_item_reviewed`, `set_task_wait`,
  `set_task_wait_reviewed`.
- Cronómetros (2): `start_task_timer`, `pause_task_timer`.
- Movimientos operativos (2): `record_activity`, `record_activity_once`.
- Responsabilidad (1): `assign_task_responsibility`.
- Ausencias/cobertura (4): `approve_employee_absence`,
  `cancel_employee_absence`, `approve_task_coverage_plan`,
  `cancel_task_coverage_binding`.
- Nota privada de bloqueo (1): `save_private_block_note`.
- Cierre e informes (3): `close_employee_month`, `set_report_recipient`,
  `retry_report_delivery`.

Los avisos del advisor por tablas con RLS sin policies no prueban por sí solos
una exposición: el DDL revisado habilita RLS y revoca acceso directo a tablas
internas operadas mediante RPC. No corresponde añadir policies genéricas ni
revocar las 39 funciones en bloque.

## Hallazgo que debe resolverse antes de usar datos reales

**P1 condicional a que `public` esté expuesto por Data API:**
`read_coordinated_task_for_manager` en SQL011 comprueba que exista una fila de
`company_memberships`, pero no exige `active=true`. SQL014 desactiva la
membresía conservando la fila. Esa función conserva `EXECUTE` para
`authenticated`, mientras que el guard actual `can_access_instance` sí exige
membresía activa. El payload legacy no reautoriza la consulta. En ese escenario
un encargado podría seguir leyendo una tarea después de revocar la empresa.

La mitigación de exposición es confirmar que Data API exponga únicamente `api`.
Eso bloquea el ingreso HTTP a las RPC de `public`, pero no corrige el contrato
SQL. Si se conserva esa función, una migración nueva debe comprobar la membresía
activa y una regresión debe probar: autorizado → revocación → lectura denegada.
No editar migraciones ya aplicadas.

También revisar `can_cover_instance`: su predicado legacy incluye comprobación
por existencia de membresía; esta auditoría no confirmó una vía de ejecución
indebida a partir de ello.

## Gates de verificación pendientes

1. Dashboard: confirmar sólo `api` en **Data API → Exposed schemas** y verificar
   que la autoexposición siga apagada.
2. Consultar ACL, membresías de roles, propietarios efectivos y privilegios
   predeterminados instalados; esos valores no se derivan por completo del DDL.
3. Decidir qué contratos legacy deben permanecer disponibles y corregir la
   autorización activa de la consulta de encargado si se conserva.
4. Ejecutar pruebas negativas con `anon`, perfil inactivo, otra organización,
   encargado fuera de equipo/empresa, membresía revocada, jefe AAL1/AAL2 y cuenta
   técnica.
5. Probar reintentos, argumentos alterados y revocación concurrente.

Las funciones legacy también difieren en garantías de MFA e idempotencia;
`record_activity_once` recibe identificador estable y `record_activity` crea
uno nuevo por llamada. No conectar Auth/UI ni usuarios reales hasta cerrar los
gates correspondientes.
