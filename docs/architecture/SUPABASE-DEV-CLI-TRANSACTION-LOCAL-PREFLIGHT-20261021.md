# Prueba transaccional con Supabase CLI — local descartable — 2026-10-21

## Dictamen y alcance

La Supabase CLI `2.121.0` aplica cada archivo de migración como una unidad
transaccional en esta ruta de ejecución. Se provocó un error al final de SQL014;
la CLI informó fallo, el catálogo del archivo 014 y su fila de historial no
quedaron persistidos. Se reintentó con el archivo exacto del repositorio y la CLI
lo aplicó correctamente. Esto cierra la evidencia local necesaria para revisar
SQL014 BC09; **no es una aplicación alojada ni autoriza producción**.

## Identidad del candidato

- SQL014: `supabase/migrations/202610150014_operational_api.sql`.
- SHA-256 vigente: `BC09CF9631A2F3E4BD19541C2A050AB1C663AE0E704D47D7E5A4752B114E0345`.
- La copia exacta usada en el retry tiene el mismo SHA-256.
- CLI oficial `2.121.0`, previamente verificada contra el SHA-256 del release.
- PostgreSQL local descartable `17.11`, conectado sólo por `127.0.0.1`.
- Esquemas, roles y usuarios del banco fueron sintéticos; no se usó Supabase remoto.

## Procedimiento y resultado

1. La CLI aplicó las 15 migraciones previas en el banco descartable.
2. En una carpeta temporal, SQL014 exacta se copió y se agregó al final
   únicamente `select 1 / 0;`. La CLI devolvió `DbPushApplyError`, SQLSTATE
   `22012`, en esa última sentencia.
3. Consulta posterior devolvió `15|NULL|0`: quedaron las 15 versiones previas,
   no existe `app_private.operational_rate_heads` y no quedó la versión 014.
4. El mismo banco recibió un retry con SQL014 sin modificación. La CLI terminó
   con código `0`; consulta final devolvió
   `16|app_private.operational_rate_heads|1`.
5. `migration list --output-format json` devolvió las 16 versiones locales y las
   16 remotas idénticas.

Comandos sustantivos (URLs locales omitidas):

```text
supabase db push --skip-vault --yes --db-url <URL local> --workdir <copia con falla>
supabase db push --skip-vault --yes --db-url <URL local> --workdir <copia exacta>
supabase migration list --db-url <URL local> --workdir <copia exacta> --output-format json
```

La opción `--skip-vault` evita que una configuración agregada en el futuro
sincronice secretos Vault durante estos comandos.

## Archivos de evidencia

Los logs crudos están fuera del checkout en
`../../outputs/supabase-cli-transaction-proof-20261021-142ce6e207734211b236ec20226931bd/`.
Hashes SHA-256:

| Artefacto | SHA-256 |
|---|---|
| `cli-injected-failure.log` | `85231372E2D3A647F86796B03FFE31CF230295286367ACF4C59CEBAE9C6DE660` |
| `after-failure-state.txt` | `AC896F9214629AF56B2CBEBFBB644CB798A5B3D40705DD105C5B04AB9F9F1920` |
| `cli-clean-retry.log` | `5E788DE2172D89763C288BD71D0703B1F7E6E94FFF39D8BAB799549DFE94459F` |
| `after-clean-retry-state.txt` | `084D4ADAFF19F30895D0144DE1E8B712C76C7BC470AC74AEABD3CA2476EDCFB0` |
| `migration-list-local.json` | `4A49FBCB66E6D960277187AFA32531B7D916FDC6D7AB592BB9003626EAFB5A51` |
| `summary.txt` | `4D138B52CE1A0EEE5FA12E7B6C1CBA87236A8483E518C89C8C02968902C46D83` |

## Lo que sigue

Sol aceptó el hash exacto BC09 para aplicarlo sólo en `grupo-paris-dev`, usando
esta evidencia de la misma CLI que se empleará en GitHub Actions. El workflow de preflight
remoto sólo ejecuta `migration list` y `db push --skip-vault --dry-run`; tras su
aceptación, se verifica que DEV siga vacío. La aplicación alojada requiere una
acción separada y revisión de ese resultado.
