# B2a / 010 — ejecución local

Contrato ejecutado: `COORDINATION-010-EXECUTION-20261004.md`. Nueva migración
`202610040010_coordination_foundation.sql`, validadores propios en
`src/data/remote/coordination-contract.ts` y pruebas de aceptación. No se aplicó
SQL remoto ni se modificó la interfaz. Live conserva Sites v43.

## Entrega

- Responsabilidad por ocurrencia: conjuntos versionados, ancla histórica,
  snapshots de empresa/período/equipo/sector, miembros y cuotas enteras que suman
  10.000 puntos básicos. Una conjunta staged tiene exactamente dos miembros y
  sólo admite una asignación puntual.
- Sellado conserva cabeceras y miembros; incluso el owner del laboratorio no
  puede editar o borrar historia sellada mediante DML normal. Las guardas de
  miembros/selecciones bloquean la fila del padre antes de consultar su sello.
- La cabecera010 sólo admite baseline individual sellado. No puede activar una
  conjunta. Backfill crea una cabecera/baseline por ocurrencia; las posteriores
  siguen un fallback explícito de sólo lectura, sin INSERT ni efecto secundario.
- Sector únicamente desde versión de catálogo con texto no vacío; si no existe
  ese dato, se conserva unknown/null. No se toma el sector del perfil actual.
- Cobertura staged por IDs y/o snapshots completos de reglas. Una tarea mensual
  existente puede seleccionarse aunque su scheduled_on esté fuera de la ausencia.
  No crea employee_absences, permisos temporales ni bindings futuros.
- Seis tablas nuevas con RLS, sin políticas ni grants a PUBLIC/anon/authenticated/
  service_role. Nueve helpers/guardas con EXECUTE revocado a esos roles.
- Formato Zod estricto schemaVersion2, sin cuerpo privado, cálculo de KPI,
  transporte, entorno o hook de App. UUIDs de personas duplicadas se detectan
  también cuando difiere el uso de mayúsculas.

SQL001–009, App, lector/gateway/contrato008 y dependencias conservados. El helper
de pruebas sólo agrega stages.m010; sus defaults siguen apuntando a008.

## Verificación local

18 pruebas del bloque pasan con:
`npm test -- --run tests/coordination-foundation-010.test.ts --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000`.

El upgrade poblado009→010 compara SHA256 y el texto JSON de **todas** las tablas
públicas previas. Incluye perfiles, catálogo/asignaciones, notas/versiones/receipts
privados, sesiones, ausencias, registros, cierres, reportes, entregas y outbox.
También compara el texto literal de snapshots históricos y la fecha real de
captura del backfill. Los propietarios inactivos conservan responsabilidad.

Las primeras pruebas encontraron tres expectativas de fixture incorrectas:
la identidad de instancia no puede desvincularse de su asignación; pausar un
cronómetro incrementa la revisión; y una membresía referenciada no puede borrarse.
Se ajustaron los fixtures al contrato008, sin editar SQL anterior ni desactivar
constraints. La prueba de identidad crea un snapshot staged incoherente y exige
que su sellado falle. La suite acotada completa pasó después.

La regresión completa pasa **260 pruebas / 24 archivos** (330,10s), con
`npm test -- --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000`.
`npm run build` pasa TypeScript y Vite; `git diff --check` pasa. El estado final
también se registra en PROJECT-STATUS.md.
PGlite valida secuencia y permisos del laboratorio; no demuestra carreras
concurrentes PostgreSQL ni Auth/MFA/Supabase real. La ejecución no es revisión
independiente: queda pendiente Sol alto.

## Hallazgo para el siguiente diseño

La FK `assignment_company_member` de `202609300002_workflows.sql` conserva la
membresía estructural mientras una asignación la referencia. No es posible
fabricar historia sin esa fila eliminándola en este esquema. La prueba usa un
perfil inactivo y conserva su referencia histórica. B3 deberá distinguir la
revocación operativa de la eliminación de relaciones históricas; no quitar esa
FK ni borrar perfiles para facilitar bajas.

## Continuidad

**GPT-6.1 Sol, esfuerzo alto, Standard:** revisión independiente010, reparaciones
si corresponde y cierre del contrato011. Revisar invariantes/FKs, ACL/RLS,
sellado, preservación total de datos, fallback y coherencia Zod/SQL. Añadir probes
según hallazgos; no repetir pruebas sin una hipótesis nueva.

011 debe activar conjuntamente responsabilidad, acceso por ocurrencia,
cronómetros por instancia/actor, cobertura seleccionada, materialización,
revocación/cancelación, locks de todos los responsables, cierres y reporte
versionado. No basta quitar one_open_session_per_instance ni conectar estos
tipos al lector008. El diseño global no sustituye el contrato ejecutable011.
Luna no implementa011 hasta que Sol lo deje cerrado.

El porcentaje global se mantiene en42% hasta revisión; no se eleva por número de
tests o commits. Conjuntas y coberturas seleccionadas aún no son funciones de UI.
