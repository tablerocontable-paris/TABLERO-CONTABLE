# Preflight inicial Supabase dev — 2026-10-21

## Destino verificado

- Organización: `tablerocontable-paris DEV` (Free).
- Proyecto: `grupo-paris-dev`; ref `kynqjfhqujnjojcmurwf`.
- Región `sa-east-1`; PostgreSQL `17.11`; estado `ACTIVE_HEALTHY`.
- Supabase MCP: ninguna migración registrada y ninguna tabla listada en `public`, `api` o `app_private`.
- Consulta SQL de sólo lectura: `public`, `auth`, `storage` y `extensions` existen; `api` y `app_private` no existen; tampoco existe aún `supabase_migrations.schema_migrations`.
- Roles Supabase `anon`, `authenticated`, `service_role`, `authenticator` y extensiones necesarias `pgcrypto` y `uuid-ossp` están presentes.
- Advisors de seguridad y rendimiento: sin avisos.
- Dashboard Data API (recargado tras guardar): 2/2 esquemas expuestos (`public`, `extensions`); sin tablas ni funciones disponibles; exposición automática de nuevas tablas apagada. Sólo se modificó ese ajuste en DEV.
- Producción no fue seleccionada ni modificada. El selector visible identifica `main` como `PRODUCTION`; destino actual permanece `grupo-paris-dev`.

## Hallazgo de secuencia

El destino está realmente vacío. SQL014 depende de tablas y funciones creadas por las migraciones anteriores y no debe aplicarse sola. El inventario actual contiene **16 archivos**, desde `202609300001_foundation.sql` hasta `202610150014_operational_api.sql`; deben aplicarse en orden lexicográfico/timestamp, preservando exactamente las versiones locales y registrando cada migración. Antes de ejecutar, validar el límite transaccional de SQL014 y que la herramienta elegida conserve las 16 versiones del repositorio en el historial remoto.

Durante y después de la secuencia: verificar las 16 versiones registradas; confirmar tablas/RLS/funciones esperadas; correr advisors; restringir Data API a `api` solamente (una vez que exista); comprobar denegaciones a `public`/`app_private` según el contrato; volver a consultar roles y settings. Auth/HTTP sintético queda para Gate H posterior.

## Inventario local inmutable del preflight

| Archivo | Bytes | SHA-256 |
|---|---:|---|
| `202609300001_foundation.sql` | 14965 | `2B1115E1E043883D3284613D2367B7228A5C443925829FF09EE5D32322189DD9` |
| `202609300002_workflows.sql` | 11567 | `7472D4AE996C827412E5F7DAAEFDA498206349BBF49D02A8C90E3542F8EECCBE` |
| `202610010001_occurrence_contract.sql` | 19129 | `3A9C3B92A241FC4A6569FEA2549FA179CA96E7FAAC50832C5841EFC90DB5CA2F` |
| `202610010002_onboarding_approval.sql` | 18755 | `9560644D1304DD5123D6B295BC9E4E5EC07D91BB07024174AED979B3A425D897` |
| `202610010003_report_delivery.sql` | 16849 | `39C8B92F41D00FB96174978BE8903120424CBABE4D0378761746148E57B38731` |
| `202610010004_time_coverage.sql` | 44562 | `FA49AA77BB8A7FC9B153C8AF9B27225ED6500D0489D7C396D9C7128B393E7630` |
| `202610010005_time_coverage_hardening.sql` | 54126 | `400C671934E0FA050907AEA78C3DA28248255068F0E8AD16F0007081421D8A33` |
| `202610010006_time_coverage_acceptance.sql` | 52541 | `A47942D0281ADB517AA7BC5E1123769DD77F415B58CF97748B97FCE376314FBF` |
| `202610010007_time_coverage_completion.sql` | 49663 | `34886FF8E7CCB947D8E68754F68AC9155F4E012DC4200B395C95967D2710160B` |
| `202610010008_time_coverage_finalization.sql` | 42614 | `3CDE522CBF9DF98A05BEE0F1C6FD510377324A9551FF2AD396756A397BC70A46` |
| `202610020009_private_block_notes.sql` | 10870 | `CF2B2BABF4A0FF8B144A643ABA5D71796D9062559CDD201C989BA754640D6269` |
| `202610040010_coordination_foundation.sql` | 20218 | `84BA65311535E85F5B1AB3A991308193CE634C79F031978DC020B15B683AD7B1` |
| `202610060011_coordination_activation.sql` | 156578 | `9729A6800E93DEDC43AB5F0840309B7C0D222343898CC8D5B43EEB4A387F4210` |
| `202610140012_sql_receipt_and_onboarding_guards.sql` | 22790 | `CABFE95DBD04AE65EA82C787BC5E3EC8E638E4620456366B7EEB8A5D715DFBF4` |
| `202610140013_api_identity_foundation.sql` | 7916 | `D013B82BFA1101ED11A35DAEAF7A64B2E6063DA9C09B55E7586CE67CC586BAC2` |
| `202610150014_operational_api.sql` | 410837 | `BC09CF9631A2F3E4BD19541C2A050AB1C663AE0E704D47D7E5A4752B114E0345` |


## Actualización de verificación local — 2026-10-21

El hash de la fila anterior refleja el candidato original del preflight
(`218DEA9E...`); luego se corrigieron únicamente los delimitadores de transacción
de SQL014. El hash vigente aparece en la tabla superior. La nueva candidata,
SHA-256 `BC09CF9631A2F3E4BD19541C2A050AB1C663AE0E704D47D7E5A4752B114E0345`,
fue ejecutada por completo en PostgreSQL 17.11 descartable: fallo inyectado al
final revirtió objetos y fila de versión; reintento limpio instaló las 16
versiones. Evidencia de aceptación Gate L en
`M2-2C-GATEL-INTEGRAL-SOL-ACCEPTANCE-20261021.md`.

Supabase CLI 2.121.0, ejecutada desde carpeta temporal con release SHA-256
`bc0f27a29c1f4ccaf33a801b7cb9d10da6484568c88e232c9dea0b9e8666b0db`, reconoció
las versiones locales `YYYYMMDDNNNN` en `migration list --db-url` y enumeró las
mismas 16 en `db push --dry-run --db-url`. La base local estaba vacía antes y
continuó sin tablas ni `supabase_migrations.schema_migrations` después. Véase
`SUPABASE-DEV-CLI-LOCAL-PREFLIGHT-20261021.md`.

La aceptación Sol integral de Gate L corresponde al hash previo
`218DEA9E9E3097743BD09238E73D5840A664F6718AEBE7670B88AF064278A837`. El hash
BC09 registrado arriba es el candidato posterior a retirar los dos delimitadores
de transacción. Sol lo aceptó para aplicarlo exclusivamente en
`grupo-paris-dev` mediante Supabase CLI 2.121.0 con `db push --skip-vault --yes`.
No autoriza producción, usuarios reales ni activar el espacio operativo.

La comprobación remota continúa pendiente: la lectura Supabase actual confirma
cero migraciones y tablas en `grupo-paris-dev`; no se corrió CLI contra remoto ni
se escribieron cambios. Para avanzar se requiere preflight remoto con CLI fijada
y credenciales seguras de Actions; después aplicar con `db push` sólo si lista
exactamente las 16 versiones y el dry-run no muestra divergencias.

## Límite

Este documento registra inspección y preparación; no registra una migración aplicada. Gate L original cubre 218DEA; la revisión suplementaria acepta SQL014 BC09 sólo en DEV. La aceptación del resultado remoto aún es condición para aplicar. Nada autoriza producción, usuarios reales ni activar el espacio operativo. Aplicar un archivo distinto de estos hashes requiere repetir revisión y validación.
