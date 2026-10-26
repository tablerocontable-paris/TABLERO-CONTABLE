# SQL016: revocación de lectura coordinada — implementación local

## Alcance

La auditoría estática encontró que `read_coordinated_task_for_manager` permitía
leer una tarea después de desactivar una membresía, porque el RPC antiguo sólo
comprobaba que existiera la fila. La migración 016 reemplaza únicamente esa
función. Conserva firma `uuid → jsonb`, DTO `schemaVersion: 3`, permisos vigentes
y la consulta de payload existente. No toca SQL001–015, RPC de escritura, Auth,
UI ni datos.

La autorización exige actor activo, organización y rol `jefe`/`encargado`,
`can_access_owner` y `_can_access_instance_at` con un único instante capturado.
Esto hace que el encargado pierda acceso al revocar la membresía, mientras que
la jefatura mantiene el acceso organizacional sin requerir membresía empresarial.

## Generación y guard remoto

Se añadió `supabase/migrations/202610260016_manager_task_revocation.sql` siguiendo
el formato, numeración y orden de migraciones ya usado por el repositorio. La
CLI de Supabase no está instalada en el entorno local; el único comando de CLI
existente está en el workflow y descarga Supabase CLI 2.121.0 en GitHub Actions.
Por ello, el archivo SQL fue creado localmente con el contrato de Sol; no se
ejecutó CLI ni SQL remoto durante esta etapa.

El hash UTF-8/LF de SQL016 quedó fijado en el guard:
`F7E76313AD4132626034C5C9D38F1C70AFB140BB3E2CE3615FE89071945ED8F3`.
`baseline_001_014` continúa
incluyendo exactamente 16 archivos; `apply_015` exactamente 17. La etapa nueva
`apply_016` incluye 18 archivos, exige historial remoto exacto 001–015 y dry-run
de sólo 016. El workflow exige además un dictamen separado de Sol con el hash
exacto en `REMOTE-WORKSPACE-016-CODE-SOL-ACCEPTANCE-20261026.md`; ese dictamen
está registrado. La aplicación remota continúa bloqueada hasta que SQL015 esté
aplicada y el preflight confirme el historial exacto de 17 migraciones más un
dry-run sólo de 016. No se conectó ni aplicó SQL al proyecto durante esta
implementación.

## Regresiones

La prueba local usa PGlite y datos sintéticos. Cubre 014→015→016, segunda
aplicación idempotente, ACL de `authenticated` y denegación de `anon`/`PUBLIC`,
lectura de encargado dentro/fuera de ámbito y en segunda empresa, jefe sin
membresía, empleado, ID inexistente, tarea real de otra organización, perfil
inactivo, participación y cobertura legacy fuera del ámbito, DTO v3 validado
por el esquema Zod con UUIDs válidos y sin notas privadas. La revocación real se
ejecuta por `api.command_v1` y conserva la fila; también se comprueba reactivación
y `access_valid_from` futuro. No usa Auth, API HTTP ni DB alojada.

## Verificación local

- `node node_modules/vitest/vitest.mjs run tests/supabase-manager-task-revocation-016.test.ts tests/supabase-dev-migration-guard.test.ts --maxWorkers=1 --testTimeout=30000 --hookTimeout=30000` — 10/10 pruebas, exit 0.
- `node scripts/supabase-dev-migration-guard.mjs verify-files . baseline_001_014` — hashes verificados.
- `node scripts/supabase-dev-migration-guard.mjs verify-acceptance . apply_016` — falla como se espera y mantiene cerrado el gate por falta de aceptación exacta Sol.
- `git diff --check` — exit 0; sólo avisos de normalización CRLF de Git para archivos existentes.

La aceptación Sol del código/hash está concedida sólo para DEV bajo el preflight
indicado. Las pruebas del esquema instalado, la exposición Data API y la
aplicación futura en DEV siguen pendientes.
