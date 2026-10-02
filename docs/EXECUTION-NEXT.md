# Bloque completado — lecturas de tareas y sesiones

**GPT-6 Luna, medio, Standard.** Contrato ejecutable completo:
`architecture/DATA-READ-FOUNDATION.md`. Cambio manual; basta «continuá».

## Resultado de ejecución

Se implementaron `src/data/remote/task-reader.ts`: listTasks, findTask y
listSessions; entradas strict, queries allowlist tipadas/congeladas, filas
completas validadas y errores genéricos clasificados. Paginación UUID ASC con
lookahead sin saltos; filtros sólo acotan SELECT bajo RLS del servidor. Tests
unitarios y `task-reader-sql.test.ts` ejercitan consultas parametrizadas con
AccountingLab, paginación, filtro de empresa y actor authenticated. El lector no
se conectó a UI ni usa ACK para fabricar estado.

La solicitud de presencia de Juan Pablo (activa/inactiva y última conexión) quedó
registrada en PRODUCT-ROADMAP.md con límites de alcance y criterios pendientes
de arquitectura. PROJECT-STATUS.md aclara que el cronómetro de demostración se
guarda localmente y que las señales de presencia no están implementadas.

## Aceptación y cierre

1. `npm test`, `npm run build`, `git diff --check` y evidencia nueva.
2. Revisar que SQL/gateway/App/repositorio local/dependencias no tengan cambios;
   commit/push y Sites privado del mismo SHA.
3. Después revisión Sol 6.1 medio y contrato cerrado del coordinador asíncrono,
   incorporando la decisión sobre presencia en la planificación. No conectar el
   frontend remoto, crear cuentas/MFA/servicios, cambiar políticas ni migrar.

Revisión precedente: architecture/REVIEW-DATA-ADAPTER-20261002.md, fuente v30
`723b0693079610bde0141c67e6dd8eb6a13796dc`. ADP-R01 corregido: no perder precisión
sub-milisegundo al comparar tiempos. 175 pruebas/15 archivos y build correctos;
checker 23 reutilizado por hashes verificados. Evidencia nueva review-evidence/
data-adapter-review-20261002.json; la evidencia anterior queda preservada.

Para ejecutar usar como base el commit que contiene esta revisión. SQL 001–008,
gateway, App/repositorio local, dependencias y evidencias previas congelados.
La página aún usa datos locales: sin cuentas, red, aplicación SQL ni cambio de
políticas/roles. No migrar empleados, ejecutar PostgreSQL --run o enviar correo.

Grado de avance estimado: 40%, margen 35–45%, según PROJECT-STATUS.md. Auth,
MFA/RLS/correo reales, concurrencia PostgreSQL y piloto siguen pendientes.
Auth/administración nueva requiere Sol alto. Infraestructura futura:
ops/AUTOMATED-DELIVERY.md.
