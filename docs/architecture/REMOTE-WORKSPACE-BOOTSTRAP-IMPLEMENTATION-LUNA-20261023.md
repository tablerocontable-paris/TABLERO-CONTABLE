# Implementación local — workspacePage SQL015

Fecha: 23/10/2026
Contrato aceptado por Sol: SHA-256 `42849A545D2B63DCFB0507592FB696F19AD070A4FD4C8B926ACB2E76B018E96D`.

## Cambio

La migración aditiva `202610230015_workspace_page.sql` añade `workspacePage`
mediante una función privada y una capa nueva de `api.query_v1`. La capa delega
cualquier otro kind a la función final de SQL014, renombrada sin alterar su
cuerpo. El hash actual de SQL014 es
`BC09CF9631A2F3E4BD19541C2A050AB1C663AE0E704D47D7E5A4752B114E0345`; `git
diff` confirmó que no cambió.

La rama usa `api_require_business(false)`, toma el actor de `auth.uid()` y
separa la consulta propia de la consulta de otra persona. Cada tarea requiere
`can_access_instance`; el acceso de encargado a otra persona valida relación
supervisora, equipo gestionado y membresía vigente. El propio encargado puede
consultarse sin relación consigo mismo. Para tareas compartidas, reemplazos con
cobertura vigente y evidencia histórica se conserva la pertenencia por sujeto
y la autorización actual de la tarea. Los filtros explícitos de empresa/equipo
se revalidan en cada página.

La respuesta limita dependencias a códigos de bloqueo y `hasHiddenDependencies`.
Las sumas de tiempo y movimientos usan `actor_id` del sujeto; las sesiones
conservan el corte efectivo de SQL014. Las cargas ponderadas se derivan de
`operational_unit_weight` almacenado en cada movimiento; SQL015 no consulta
coeficientes actuales. Se valida el cursor exacto y se seleccionan hasta 101
filas autorizadas antes de agregar exclusivamente las 100 devueltas.

Los esquemas Zod/TypeScript validan filtros y respuesta exacta por variante de
medición. Se añadieron pruebas de respuesta sin campos privados, delegación a
`readiness`, consulta propia de encargado, denegación de tercero fuera de
ámbito, pérdida de relación supervisora y un smoke de 2.000 tareas.

## Validación local

- Pruebas enfocadas: 5/5 nuevas pruebas de migración y 16/16 de contrato
  (21/21 combinadas).
- Suite: 765/765 pruebas en 78 archivos.
- TypeScript (`tsc --noEmit`), build de Vite cliente, build del Worker y
  `git diff --check`: exit 0.
- Smoke PGlite de 2.000 tareas, ejecutado sin build concurrente: respuesta de
  100 tareas y cursor siguiente en 646 ms, 60.663 bytes. La selección del plan
  con `EXPLAIN (ANALYZE, BUFFERS)` devolvió 101 filas; plan superior `Limit`,
  529,051 ms y 50.052 bloques compartidos.

El smoke mide una base PGlite local con filas sintéticas y sin volumen
representativo de sesiones ni concurrencia. Sirve para comprobar el límite de
página y detectar costos gruesos; no es una estimación de latencia en Supabase
ni reemplaza mediciones con datos de volumen real.

## Alcance y evidencia

SQL015 está implementada localmente para revisión independiente. No se aplicó
ninguna migración alojada, no se usaron credenciales, no se desplegó ni se
conectó la interfaz. La aceptación de Sol cubre el contrato, no este código ni
una aplicación remota. El manifiesto con comandos, resultados y hashes está en
`docs/architecture/review-evidence/workspace-page-015-luna-20261023.json`.
