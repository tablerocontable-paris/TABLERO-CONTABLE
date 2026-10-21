# Revisión Sol — primera migración Supabase dev — 2026-10-21

**Dictamen: BLOQUEADO para aplicación remota por `supabase_apply_migration` y para el plan actual de «14 archivos».** No ejecuté migraciones ni modifiqué Supabase. El destino permanece intacto.

## Alcance y evidencia actual

- Revisé el preflight, `AGENTS.md`, `docs/PROJECT-STATUS.md`, `docs/EXECUTION-NEXT.md` y los 16 SQL de `supabase/migrations/`.
- Reconsulté en modo lectura el proyecto exacto `grupo-paris-dev`, ref `kynqjfhqujnjojcmurwf`: `ACTIVE_HEALTHY`, PostgreSQL 17.11, región `sa-east-1`; historial MCP vacío; existen `public`, `auth`, `storage`, `extensions`; todavía no existen `api`, `app_private` ni `supabase_migrations.schema_migrations`; cero tablas de aplicación; roles `anon`, `authenticated`, `authenticator`, `postgres`, `service_role` presentes. `pgcrypto` y `uuid-ossp` están instaladas en `extensions`.
- El ajuste Data API (autoexposición apagada; `public` y `extensions` seleccionados) procede del registro de Dashboard del preflight; no lo pude volver a leer mediante el conector en esta revisión.
- Revisé alcance de DDL: no hay cambios de estructura/roles en `auth` o `storage`, ni creación de roles/extensiones, ni `DROP TABLE`, `DROP SCHEMA`, `TRUNCATE` o borrado de datos como acciones de nivel superior. Los `DROP POLICY/TRIGGER IF EXISTS` están limitados a objetos de la aplicación y forman parte de reemplazos versionados. Las migraciones 013 y 014 usan `api`/`app_private`; 013 crea ambos esquemas, restringe `CREATE` y privilegios por defecto, y concede sólo `USAGE` de `api` a `authenticated`. Las dependencias de `auth.users` son referencias/lecturas, no mutaciones al esquema gestionado.

## Bloqueos

1. **Cantidad incorrecta:** hay **16 archivos**, no 14. El preflight enumera 16 hashes, pero su texto operativo instruye aplicar 14. La secuencia correcta, si se conserva el baseline, es lexicográfica completa desde `202609300001_foundation.sql` hasta `202610150014_operational_api.sql`. Corregir la instrucción antes de ejecutar.
2. **No usar MCP `apply_migration` con estos archivos:** esa herramienta acepta sólo `name` y `query`; Supabase genera la versión/fecha del lado servidor. Eso produce filas remotas con versiones que no coinciden con las versiones locales; las próximas subidas con CLI pueden detectar migraciones locales pendientes e intentar repetirlas. La CLI compara versiones/timestamps. Usar la ruta versionada del repositorio, `supabase db push --linked`, tras validar localmente la lista; no reparar ni inventar a mano el historial. Fuentes: [contrato actual de Supabase MCP](https://supabase.com/docs/guides/ai-tools/mcp), [documentación de `migration list`](https://supabase.com/docs/reference/cli/supabase-migration-list), [incidencia del MCP sobre versiones autogeneradas](https://github.com/supabase/mcp/issues/241).
3. **SQL014 no es atómica como archivo:** comienza una transacción en línea 1 y ejecuta `COMMIT` en línea 3577; el archivo continúa hasta línea 3974 con nuevas definiciones y sin otro `BEGIN`. Si una instrucción final falla o la conexión se corta después del `COMMIT`, una parte queda persistida aunque el paso no termine correctamente. El reintento puede chocar con objetos ya creados. Antes del primer despliegue, Sol debe aprobar una corrección de límites transaccionales o una partición versionada con estrategia explícita de recuperación; después se actualizan hashes y se repiten las validaciones locales. No tratar un timeout como rollback confirmado.
4. **Versiones locales de 12 dígitos:** los prefijos actuales son `YYYYMMDDNNNN`, no los timestamps de 14 dígitos que genera la CLI por defecto. Las versiones deben conservarse exactamente si la CLI las acepta; comprobar antes que `db push` las detecte como las mismas versiones y que el historial final empareje los 16 archivos. La salida de `migration list` puede tener problemas de presentación al parsear versiones no estándar; contrastar también las versiones almacenadas en `supabase_migrations.schema_migrations`. No renombrar ni ejecutar `migration repair` sin decisión explícita de Sol.

## Recomendación de aplicación

No aplicar ahora. Primero ajustar el plan/documentación a 16 archivos y resolver el límite transaccional de SQL014 con Sol. Después validar en una base local limpia con la misma versión mayor (PostgreSQL 17) y comprobar que el CLI mantiene las versiones locales; finalmente ejecutar sólo `supabase db push --linked` apuntando al ref exacto `kynqjfhqujnjojcmurwf`. Detenerse ante cualquier salida parcial o discrepancia de historial y releer estado antes de reintentar. Tras la secuencia, verificar las 16 versiones, esquemas/tablas/RLS/grants/funciones y advisors; reducir Data API a `api` solamente antes de crear identidades o habilitar Auth/HTTP. Producción permanece fuera de alcance.

## SHA-256 verificados contra el inventario del preflight

| Orden | Archivo | SHA-256 |
|---:|---|---|
| 1 | `202609300001_foundation.sql` | `2B1115E1E043883D3284613D2367B7228A5C443925829FF09EE5D32322189DD9` |
| 2 | `202609300002_workflows.sql` | `7472D4AE996C827412E5F7DAAEFDA498206349BBF49D02A8C90E3542F8EECCBE` |
| 3 | `202610010001_occurrence_contract.sql` | `3A9C3B92A241FC4A6569FEA2549FA179CA96E7FAAC50832C5841EFC90DB5CA2F` |
| 4 | `202610010002_onboarding_approval.sql` | `9560644D1304DD5123D6B295BC9E4E5EC07D91BB07024174AED979B3A425D897` |
| 5 | `202610010003_report_delivery.sql` | `39C8B92F41D00FB96174978BE8903120424CBABE4D0378761746148E57B38731` |
| 6 | `202610010004_time_coverage.sql` | `FA49AA77BB8A7FC9B153C8AF9B27225ED6500D0489D7C396D9C7128B393E7630` |
| 7 | `202610010005_time_coverage_hardening.sql` | `400C671934E0FA050907AEA78C3DA28248255068F0E8AD16F0007081421D8A33` |
| 8 | `202610010006_time_coverage_acceptance.sql` | `A47942D0281ADB517AA7BC5E1123769DD77F415B58CF97748B97FCE376314FBF` |
| 9 | `202610010007_time_coverage_completion.sql` | `34886FF8E7CCB947D8E68754F68AC9155F4E012DC4200B395C95967D2710160B` |
| 10 | `202610010008_time_coverage_finalization.sql` | `3CDE522CBF9DF98A05BEE0F1C6FD510377324A9551FF2AD396756A397BC70A46` |
| 11 | `202610020009_private_block_notes.sql` | `CF2B2BABF4A0FF8B144A643ABA5D71796D9062559CDD201C989BA754640D6269` |
| 12 | `202610040010_coordination_foundation.sql` | `84BA65311535E85F5B1AB3A991308193CE634C79F031978DC020B15B683AD7B1` |
| 13 | `202610060011_coordination_activation.sql` | `9729A6800E93DEDC43AB5F0840309B7C0D222343898CC8D5B43EEB4A387F4210` |
| 14 | `202610140012_sql_receipt_and_onboarding_guards.sql` | `CABFE95DBD04AE65EA82C787BC5E3EC8E638E4620456366B7EEB8A5D715DFBF4` |
| 15 | `202610140013_api_identity_foundation.sql` | `D013B82BFA1101ED11A35DAEAF7A64B2E6063DA9C09B55E7586CE67CC586BAC2` |
| 16 | `202610150014_operational_api.sql` | `218DEA9E9E3097743BD09238E73D5840A664F6718AEBE7670B88AF064278A837` |

**Verificación de inventario:** los 16 archivos actuales coinciden byte por byte con los hashes anotados en el preflight; no edité ninguno.

**Firma:** GPT-6.1 Sol — revisión independiente del preflight, alcance sólo lectura, 21/10/2026.

## Actualización operativa posterior — 2026-10-21

La versión portable oficial Supabase CLI 2.121.0 fue probada localmente, sin
instalación administrativa ni acceso al proyecto remoto. El release fue
verificado por SHA-256
`bc0f27a29c1f4ccaf33a801b7cb9d10da6484568c88e232c9dea0b9e8666b0db`. En
PostgreSQL 17.11 descartable, `migration list --db-url` presentó las 16 versiones
locales de 12 dígitos como pendientes y `db push --dry-run --db-url` enumeró
exactamente los 16 archivos. El dry-run no creó tablas ni historial. La evidencia
está en `SUPABASE-DEV-CLI-LOCAL-PREFLIGHT-20261021.md`.

Esto resuelve **sólo el bloqueo de compatibilidad local de versiones**. No prueba
el destino remoto ni autoriza todavía `db push`: Supabase MCP volvió a confirmar
cero migraciones/tablas en `grupo-paris-dev`; el dry-run remoto sigue sin ejecutar.
Próximo requisito: preflight de sólo lectura y dry-run mediante CLI fijada contra
el ref exacto; verificar de nuevo el estado remoto antes de aplicar. El camino
MCP `apply_migration` sigue descartado porque genera versiones distintas.