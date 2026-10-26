# Inventario de continuidad y estimación inicial — 26/10/2026

## Qué se migra a GitHub

El repositorio privado `tablerocontable-paris/TABLERO-CONTABLE`, rama `main`, es
la fuente de verdad del **código, migraciones, contratos, pruebas, manuales y
decisiones del proyecto**. Al corte de este documento, el checkout local está
en `dd3ab2f54e926a194f4e57c2a562d7852f62075a`, igual que `origin/main`. El único
archivo local no versionado observado es
`tests/review/m2-2c-legacy-task-control-replay-races.block`; se conserva intacto
porque el estado de continuidad lo identifica como artefacto de auditoría que
no debe modificarse.

La documentación funcional y de migración vigente está en `docs/`, en especial:

- `PROJECT-STATUS.md`: estado técnico y cortes de verificación.
- `EXECUTION-NEXT.md`: siguiente puerta de trabajo.
- `MIGRATION.md`: incorporación de usuarios y límites operativos.
- `PRODUCT-ROADMAP.md`: alcance y decisiones funcionales.
- `architecture/REMOTE-MIGRATION-READINESS-20261021.md`: secuencia de servicios.
- `architecture/LABORATORY-BACKUP-CONTRACT-20261007.md`: transporte del estado local.

No se publica un duplicado de los bundles de transferencia: el historial Git
completo ya viaja en el clon. La guía de PC está en `outputs/LEEME-PC-PERSONAL.md`.
Los múltiples bundles/ZIP antiguos en `outputs/` y en la raíz son paquetes
históricos, no fuentes adicionales. No borrar esos registros sin una revisión
separada de retención y procedencia.

## Qué no se migra a GitHub

- URI/contraseñas, tokens, claves privadas, cookies o sesiones.
- El estado del navegador `paris-state-lab` ni archivos de IndexedDB. Se mueve
  manualmente con la exportación de laboratorio; el JSON es legible y puede
  incluir nombres, notas, comentarios, movimientos y evidencia. Guardarlo en un
  medio privado y no subirlo a GitHub, aunque el repositorio sea privado.
- Memoria global de Codex, conversaciones completas, adjuntos de chats y datos
  locales de usuario. GitHub no es un mecanismo de respaldo de estas fuentes.
  La continuidad técnica relevante se conserva en `AGENTS.md` y `docs/`.
- Archivos reales de clientes, empleados o del estudio. No se deben importar a
  la demo ni al repositorio.

Para continuar en una PC personal: clonar `main`, instalar dependencias desde
`package-lock.json`, y transferir aparte sólo el respaldo ficticio necesario.
Usar una PC a la vez para editar y hacer push antes de cambiar de equipo. Los
secretos necesarios se cargan como secretos del servicio, nunca en `.env` que
se comparta ni en Git.

## Conteo inicial neutral del laboratorio

La función `seed()` en `src/data/repository.ts` contiene un conjunto ilustrativo
estático. Su conteo actual es:

| Elemento | Cantidad del seed | Alcance |
|---|---:|---|
| Perfiles | 13 | 1 jefatura, 2 encargados, 10 empleados; todos ficticios/de demostración |
| Empresas | 4 | Etiquetas de ejemplo “Empresa 1” a “Empresa 4” |
| Procesos de catálogo | 6 | 3 entregables y 3 operativas, según el campo `kind` del seed |
| Ocurrencias mensuales materializadas | 73 | 6 por cada perfil distinto de jefatura, más 1 duplicado intencional de ejemplo para una persona/empresa |
| Ocurrencias por responsable en el seed | 6 para cada encargado/empleado, con una ocurrencia adicional para un empleado | Es carga de muestra generada al iniciar el laboratorio, no producción real |

El conteo de 73 ocurrencias se obtiene de 12 perfiles con seis asignaciones cada
uno y una copia extra: `12 × 6 + 1 = 73`.

Estas cifras **no permiten estimar cuántas personas trabajan hoy ni cuántas
tareas se cumplen por día**. Son datos de arranque repetibles, generados de nuevo
cuando un navegador no tiene estado guardado; además, el seed incluye perfiles y
registros ilustrativos que no son cuentas autenticadas. El sistema no dispone de
un registro productivo conectado desde el que calcular actividad diaria. Para
obtener una estimación real se necesita una exportación aprobada y anonimizada
del sistema fuente, con identificador estable, fecha, estado, responsable y
empresa. Deben deduplicarse reintentos y tareas recurrentes por ocurrencia; no
contar movimientos operativos como tareas completadas.

## Verificación y siguiente paso

- `main` coincide con `origin/main`; no se creó otra rama ni se inició una PR.
- El árbol de trabajo conserva el archivo `.block` ya mencionado.
- El repositorio no puede incluir toda la PC ni todo Codex. Este inventario
  delimita explícitamente la continuidad técnica transferible.
- Falta verificar/obtener un respaldo de laboratorio actual desde el navegador
  de origen y, si el objetivo incluye medir la operación real, una exportación
  fuente autorizada. Sin esos insumos no se inventan conteos reales ni se afirma
  migración completa de datos.
