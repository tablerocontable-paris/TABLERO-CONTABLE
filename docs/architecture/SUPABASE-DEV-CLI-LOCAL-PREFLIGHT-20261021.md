# Preflight local de Supabase CLI para grupo-paris-dev — 2026-10-21

## Resultado

**Aprobado sólo para compatibilidad local; no es un preflight remoto ni una
autorización para aplicar migraciones.** Supabase CLI 2.121.0 leyó las versiones
locales de 12 dígitos, listó las 16 como pendientes y enumeró exactamente los 16
archivos en `db push --dry-run`. La base PostgreSQL 17.11 usada para la prueba
permaneció sin tablas de aplicación ni tabla de historial.

## Herramienta y origen

- Release oficial: [Supabase CLI v2.121.0](https://github.com/supabase/cli/releases/tag/v2.121.0).
- Asset Windows AMD64: `supabase_2.121.0_windows_amd64.tar.gz`.
- SHA-256 publicado por GitHub y verificado localmente:
  `bc0f27a29c1f4ccaf33a801b7cb9d10da6484568c88e232c9dea0b9e8666b0db`.
- Se ejecutó desde `%LOCALAPPDATA%\Temp`; no se instaló en el sistema ni se
  requirieron permisos de administrador.
- `supabase --version`: `2.121.0`.

## Procedimiento y evidencia

Se inició el PostgreSQL 17.11 portátil de pruebas y se creó una base descartable
`cli_preflight_12_digit` con confianza sólo local. URL de prueba:
`postgresql://postgres@127.0.0.1:55437/cli_preflight_12_digit?sslmode=disable`.
No contiene ni usa credenciales de Supabase alojado.

Antes de probar:

- Tablas fuera de los esquemas internos de PostgreSQL: `0`.
- `supabase_migrations.schema_migrations`: no existe.

Comandos ejecutados desde `work/site`:

```text
supabase migration list --db-url <URL-local> --workdir <work/site>
supabase db push --dry-run --db-url <URL-local> --workdir <work/site>
```

Ambos terminaron con código `0`. El listado mostró las 16 versiones locales
`202609300001`, `202609300002`, `202610010001`–`202610010008`, `202610020009`,
`202610040010`, `202610060011`, `202610140012`, `202610140013` y
`202610150014`; el remoto local de prueba estaba vacío. El dry-run enumeró,
además, los nombres completos de esos mismos 16 SQL, en orden, desde
`202609300001_foundation.sql` hasta `202610150014_operational_api.sql`.

Después:

- Tablas fuera de los esquemas internos de PostgreSQL: `0`.
- `supabase_migrations.schema_migrations`: sigue sin existir.
- El servidor PostgreSQL de prueba se detuvo correctamente.

Esto prueba que **esta versión concreta de la CLI interpreta correctamente las
versiones locales de 12 dígitos** y que el dry-run no escribió en una base vacía.
No prueba todavía cómo se comportará frente a `grupo-paris-dev`.

## Estado remoto y paso siguiente

La lectura posterior con Supabase MCP para `grupo-paris-dev`, ref
`kynqjfhqujnjojcmurwf`, devolvió `migrations: []` y `tables: []` en
`public`, `api` y `app_private`. No se usó la CLI con el destino alojado y no se
ejecutó `db push` remoto.

El siguiente paso es correr, con CLI fijada a `2.121.0`, `migration list` y
`db push --dry-run` contra ese ref exacto, y volver a comprobar que el historial y
las tablas sigan vacíos. El workflow manual
`.github/workflows/supabase-dev-preflight.yml` usa un único secreto de repositorio,
`SUPABASE_DEV_DB_URL`, con la URL Session pooler de `grupo-paris-dev` copiada desde
Connect. La URL debe validarse sin imprimirse en logs; no pegarla en Git ni en el
chat. Sólo si la simulación remota lista exactamente los 16 archivos y no hay
mutaciones podrá prepararse la ejecución real, limitada a DEV.

La documentación de Supabase indica que `migration list` compara versiones
locales con el historial remoto y que `db push --dry-run` enumera migraciones sin
aplicarlas: [referencia de migration list](https://supabase.com/docs/reference/cli/supabase-migration-list),
[referencia de db push](https://supabase.com/docs/reference/cli/v1/supabase-db-push).
