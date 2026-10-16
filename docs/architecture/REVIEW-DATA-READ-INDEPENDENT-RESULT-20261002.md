# Evidencia de correcciones del lector — 02/10/2026

**Cambio local preparado para revisión Sol; todavía no es aceptación independiente.**
La revisión de origen fue sobre v34 `16862eec715d81193c1b8a30403cae0288b8a326`.
Las correcciones se limitaron a tests y fixtures: `src/data/remote/task-reader.ts`,
`task-gateway.ts`, contratos, SQL 001–008 y dependencias permanecen intactos.

| Criterio | Prueba/assertion que lo cubre | Alcance y límite |
| --- | --- | --- |
| READ-I01 — identidad y cobertura vigente | `tests/task-reader-sql.test.ts`, “retains an executor's historical session after its sealed coverage is cancelled”: filas reales de misma persona en empresa B y período previo; `findTask` unavailable y páginas vacías; `select current_user role,auth.uid()` comprueba `authenticated`/peer; después de `capture()` se vuelve a activar peer antes de lecturas. | PGlite, políticas actuales. No sustituye evaluación con PostgreSQL/Supabase productivo ni altera RLS. |
| READ-I02 — operativa, metadata y precisión | “keeps operative checklists in progress…” inicia temporizador, marca controles por RPC, recarga con reader y comprueba `En curso`; pause se verifica por sesión persistida. “compares complete SQL task/session rows…” compara `to_jsonb` completo con lector y conserva `.123456`/`.654321`. | Usa tablas y RPC locales existentes. No incluye cambios de esquema ni servicio remoto. |
| READ-I03 — límites de respuesta del lector | `tests/task-reader.test.ts`: “validates null inputs…” rechaza null de método/campo y falta de `instanceId` sin read; recorre tres páginas limit=1 en orden, verifica cursor/lookahead y metadata; filas fuera de `instanceIds` y lookahead incompleto dan `protocol`. El caso de envelope incluye `data:null,error:null` para cada método. | Pruebas de contrato unitarias. No duplican las validaciones de todos los campos del schema. |
| READ-I04 — trazabilidad | Esta tabla enlaza cada requisito pendiente a un test y assertion identificable. | La revisión Sol debe confirmar que la matriz cubre la intención, no sólo que la suite pasa. |

## Verificación ejecutada

- `npm test -- --reporter=dot`: 195 pruebas, 17 archivos, todas aprobadas.
- `npm run build`: aprobado (`tsc --noEmit` y Vite).
- `git diff --check`: aprobado.
- No se corrió el browser QA: este entorno no tiene Chromium instalado.
- No se tocaron migraciones, queries de producción, RPC, Auth, RLS ni datos reales.

La evidencia histórica anterior conserva su resultado original. La prueba temporal
de READ-I01 de la revisión previa no se incorpora a la suite ni se presenta como
una falla de seguridad en producción: identificó que el propio test dejaba el rol
administrativo activo tras capturar snapshots. El próximo modelo recomendado es
Sol 6.1 medio para revisión independiente antes de aceptar esta capa.
