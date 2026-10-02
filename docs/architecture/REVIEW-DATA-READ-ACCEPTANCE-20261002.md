# Cierre de aceptación local del lector — 02/10/2026

Ejecución contra v33, `4a8bdb4d643d318cd39c8aec021afd4d7446c2c9`.
Resultado de Luna: los READ-R01–03 quedaron implementados y probados en
AccountingLab. **Revisión independiente GPT-6.1 Sol: pendiente.** No habilita
conexión remota, producción ni migración.

## Trazabilidad de aceptación

- READ-R03: cada variante incluye una tabla literal fija (`task_instances` o
  `task_time_sessions`); el llamador no elige tabla. SQL de prueba conserva una
  lista fija y todos los valores de filtro, cursor y límite son parámetros.
- READ-R02: 8 pruebas unitarias cubren firma/defaults, `take` 2/51/101, límites,
  validación strict, array clonado/congelado, UUID con letras y case, paginación
  de tres páginas, cursor/lookahead, empresa/equipo/owner, `findTask`, datos y
  errores de los tres métodos.
- READ-R01: 6 pruebas SQL con BEGIN/ROLLBACK y actor `authenticated` verifican
  empleado, encargado actual, jefe, otra organización, filtros que no amplían
  RLS, cambio de jerarquía/membresía, cuatro tareas iguales en dos empresas,
  cobertura aprobada y cancelada, sesión histórica propia sin padre visible,
  recarga después de start/checklist/transition/switch, y snapshots intactos tras
  lecturas denegadas.

Se corrigieron fixtures y expectativas cuando las reglas existentes demostraron
que un encargado también accede a su propio trabajo en empresas autorizadas y que
completar el último control cierra la tarea. No se cambiaron roles ni políticas.
El contrato anterior `REVIEW-DATA-READ-20261002.md` queda preservado como registro
de por qué se exigió completar estos escenarios.

## Validación y límites

`npm test`: 189 pruebas en 17 archivos, correctas. `npm run build` y
`git diff --check`: correctos. Evidencia con hash por archivo y conteo de fuentes
protegidas: `review-evidence/data-read-acceptance-20261002.json`.

Controles locales no simulan completamente Supabase Auth/PostgREST/MFA ni
concurrencia PostgreSQL. El lector permanece desconectado del frontend. La demo
sigue usando almacenamiento local; no hay presencia en línea real. Siguiente
revisión: GPT-6.1 Sol, esfuerzo medio. Si acepta, definir después la fase del
coordinador asíncrono. Nuevos permisos/Auth/presencia necesitan Sol alto.
