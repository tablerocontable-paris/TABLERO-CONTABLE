# Incidente de migración DEV — 27/10/2026

## Conclusión

La captura del run #4 no muestra que se haya migrado mal el baseline 001–014.
Ese run intentó repetir `baseline_001_014` cuando Supabase ya tenía 18
migraciones y el control lo detuvo antes de cualquier escritura. El baseline
original terminó con éxito. Sí había un defecto funcional concreto en una
función de SQL011; SQL016 ya lo corrigió.

## Evidencia de ejecución

- GitHub Actions `40012156985` aplicó las 16 migraciones que componen SQL001–014.
  El preflight confirmó `16 locales, 0 remotas`, el dry-run enumeró sólo el
  conjunto esperado, se aplicaron los 16 archivos y el post-check confirmó
  `16 locales, 16 remotas`.
- GitHub Actions `40522413076` confirmó `17 locales, 16 remotas`, aplicó sólo
  `202610230015_workspace_page.sql` y cerró en `17/17`.
- GitHub Actions `40522611976` confirmó `18 locales, 17 remotas`, aplicó sólo
  `202610260016_manager_task_revocation.sql` y cerró en `18/18`.
- El run #4, `40522765334`, seleccionó por error el baseline. Su guard esperaba
  `16 locales, 0 remotas`, detectó `16 locales, 18 remotas` y falló antes del
  dry-run y `db push`. No cambió la base.
- La consulta actual de Supabase devuelve las 18 versiones, con nombres y
  versiones correspondientes a los archivos SQL001–016 del repositorio.

## Defecto funcional y corrección

La ruta legacy de `read_coordinated_task_for_manager` definida en SQL011 podía
mantener lectura después de desactivar la membresía de empresa. SQL016
reemplazó la función para usar `_can_access_instance_at`; la definición remota
actual delega en `api_company_membership_valid_at`, que exige que la fila de
`company_memberships` esté activa y vigente. El historial remoto y la función
instalada confirman que esa corrección está presente.

Las pruebas focales de SQL016 cubren revocación, reactivación, perfil inactivo,
límites organizacionales y exclusión de notas privadas en el laboratorio local.
No equivalen a pruebas con sesiones Auth del proyecto hosteado.

## Prevención aplicada

El workflow manual `Verify Supabase DEV migration history` ahora sólo verifica
el conjunto completo y el historial remoto; no contiene `db push`, SQL ni una
opción para repetir segmentos ya instalados. Se retiró
`supabase-dev-preflight.yml`, que duplicaba la verificación antigua de 001–014.
La lógica histórica de staging sigue en el guard y sus pruebas locales para
reproducir las aplicaciones, pero no está expuesta como workflow de DEV.

## Lo que esta evidencia no prueba

Esto confirma que las migraciones fueron registradas y aplicadas, y que el
defecto conocido de SQL011 está corregido. No certifica que cada contrato de
negocio de las 16 migraciones sea semánticamente correcto ni reemplaza la
revisión completa de funciones/ACL, la confirmación de esquemas expuestos en
Data API ni las pruebas positivas y negativas con identidades Auth reales.
