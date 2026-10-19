# Aceptación Sol — replay legacy de movimientos operativos

Fecha: 19/10/2026. Aceptación local limitada al contrato
`M2-2C-LEGACY-ACTIVITY-REPLAY-AUTHORIZATION-SOL-CONTRACT-20261019.md`
(SHA-256 `F4113A701BF4E8C075CAF12F95535BAC7B5A0BFC8D307E17EC17CF40010D665A`).
No acepta Gate L completo, otros replays, servicios alojados ni producción.

## Veredicto

GPT-6.1 Sol acepta el corte local: el último P2 documental quedó cerrado y no
quedan P1/P2 abiertos en esta familia. La candidata SQL014 conserva SHA-256
`7BF6F10E8703A2044708C9E37AD72021F07B6CD3C7E803C3D9313A0E170A5C7E`.
SQL001–013 no tienen diferencias; la primera ejecución del helper permanece
idéntica a SQL012. La evidencia se limita a PostgreSQL local y datos sintéticos.

## Evidencia revisada

- Baseline exacto Actual y Upgrade: reproducción roja confirmada.
- Candidata Actual y Upgrade: `GREEN_DENIED`, ocho de ocho carreras por ruta,
  exit 0; dos órdenes de ganador y niveles de aislamiento cubiertos.
- Contextos efectivos consultados en PostgreSQL; replay posterior a revocación
  desde conexión autenticada nueva; recibos `api_command_receipts` capturados.
- Deltas permitidos assertionados y colecciones restantes conservadas.
- Los siete casos secuenciales guardan snapshots completos antes/después en
  ambos reportes; 14 comparaciones independientes sin cambios por replay.
- 67/67 referencias del manifiesto verificadas. `node --check` para ambos
  runners y `git diff --check` terminaron con exit 0.

Artefactos: `review-evidence/M2-2C-LEGACY-ACTIVITY-REPLAY-20261019.json`;
paquete local `outputs/m2-2c-legacy-activity-replay-luna-20261019/manifest.json`.

## Límites conservados

- P3: una corrida paralela histórica obtuvo 737/738; el reintento serial obtuvo
  738/738 en 74 archivos. Las pruebas nuevas usan autenticación sintética local.
- Aviso de autocrlf LF/CRLF de SQL014 registrado; no es error de diff.
- Suite, builds y matriz nativa no se repitieron en este corte, porque los
  cambios finales fueron sólo de runner y evidencia.
- SQL014 no se aplicó a Supabase; no hubo llamadas alojadas, cambios de hosting,
  correo, datos reales, commit ni push como parte de esta aceptación.
