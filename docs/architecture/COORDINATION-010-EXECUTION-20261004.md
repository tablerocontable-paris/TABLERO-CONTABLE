# B2a / 010 — contrato ejecutable de responsabilidad y cobertura seleccionada

**GPT-6 Luna, esfuerzo medio, Standard.** Fecha técnica UTC 04/10; sesión iniciada
el 03/10 por la noche de Argentina. Se ejecuta después de la revisión B1/009.
Diseño rector: COORDINATION-B-DESIGN-20261002.md. Este contrato cierra la base de
relaciones; la activación coordinada será 011, con contrato revisado por Sol.

## Propósito y límite de entrega

Agregar `supabase/migrations/202610040010_coordination_foundation.sql`, en una
transacción, y `src/data/remote/coordination-contract.ts` con validadores propios.
Las relaciones nuevas permiten representar dos responsables y una selección
exacta de tareas/reglas para cubrir. Se validan y sellan en laboratorio; no dan
acceso ni cambian el crédito, los estados o los cronómetros de la aplicación.

SQL001–009, App, modelo localStorage, lector/gateway008, reportes y dependencias
quedan intactos. No reemplazar RPC, políticas o índices existentes. No crear
servicios ni aplicar SQL remoto. No instanciar Supabase ni añadir otro selector
de actor. No llamar a 008 approve_employee_absence para representar una selección:
ese RPC concedería cobertura por empresa y excedería las tareas elegidas.

010 no es una feature activa ni el cierre completo B2. La activación 011 debe
resolver simultáneamente permisos, materialización, clock/checklist/transiciones,
registros, cancelación, todas las rutas heredadas, cierre y reporte versionado.
No quitar one_open_session_per_instance antes de disponer de ese motor.

## Tablas de responsabilidad

Todas usan UUID, FK compuestas con organization_id, RLS habilitada y REVOKE ALL
para PUBLIC/anon/authenticated/service_role. Ninguna tiene política ni grant de
cliente en 010. El owner de laboratorio es el único escritor; nunca se entrega
su credential a un usuario. Helpers internos sin EXECUTE para esos cuatro roles,
security definer sólo cuando necesitan leer tablas; search_path='' y objetos
calificados. Los triggers también deben tener EXECUTE revocado.

### task_responsibility_sets

- id PK; organization_id; instance_id; revision BIGINT entre 1 y MAX_SAFE_INTEGER.
- mode `individual|conjunta`; origin `baseline_legacy|explicit`; sealed BOOL false.
- anchor_owner_id, company_id_snapshot, period_snapshot, team_id_snapshot.
- sector_snapshot TEXT nullable; sector_source `catalog|unknown`. Sector catalog
  requiere texto no vacío y copia exacta de task_template_versions.sector cuando
  la ocurrencia tiene template_version_id; unknown implica null. No inferir sector
  histórico desde profiles.sector ni rellenar los cierres viejos.
- captured_at TIMESTAMPTZ, captured_by UUID nullable, reason TEXT nullable.
  baseline: captured_by/reason null, fecha del backfill explícitamente como fecha
  de captura, nunca inventar fecha original. explicit: actor y motivo no vacío.
- UNIQUE(instance_id,revision), UNIQUE(id,instance_id,organization_id), UNIQUE(id,org).
- FK a instancia, ancla, empresa, equipo y captured_by por organización.

### task_responsibility_members

- set_id, organization_id, profile_id, share_bps SMALLINT entre 1 y 10.000.
- PK(set_id,profile_id); FK set/org y perfil/org. Cuotas en puntos básicos enteros,
  10.000 = 100%; no flotantes ni cuotas derivadas de horas registradas.

### task_responsibility_heads

- instance_id PK, organization_id, set_id; FK(instance/org) y FK(set_id,instance,org).
- En 010 sólo apunta a un set baseline_legacy sellado, individual, con un miembro
  que es task.owner_id y share_bps=10.000. Guard BEFORE INSERT/UPDATE/DELETE:
  INSERT valida esos invariantes; UPDATE/DELETE rechaza siempre. Esto impide que
  un fixture o código futuro active una conjunta mientras 008 siga vigente.
- Una conjunta staged puede existir/sellarse en sets, pero jamás convertirse en
  head ni afectar autorización en 010. No añadir un switch cliente para activarla.

### Validación y sellado

`_validate_task_responsibility_set(p_set uuid) returns void`, interno, comprueba
existencia, FKs/snapshots de identidad contra instancia, cuota total 10.000,
perfiles distintos, individual exactamente un miembro; conjunta exactamente dos
y assignment.frequency='unica'. La tarea no se identifica por nombre/banco.
El ancla sigue task.owner_id histórico: no exige que sea miembro de un set
explicit, para permitir luego un traspaso versionado sin borrar al titular viejo.
Origin baseline exige exactamente owner y 100%, incluso si está inactivo o sin
membresía actual. No bloquear historia por autorización actual.

Guard de sets: INSERT requiere sealed=false; UPDATE sólo permite false→true con
todas las otras columnas idénticas y valida el conjunto. Otros UPDATE y todo
DELETE rechazan. Guard de members: ningún INSERT/UPDATE/DELETE si parent.sealed;
cambio de set_id/org en un UPDATE siempre se rechaza; para draft se mantienen
FKs y controles de cuota. No guardar una cabecera sellada sin validar miembros.
Los permisos de negocio actuales (equipo/rol/MFA/membresía activa) son validación
del RPC 011, no constraints que invaliden datos históricos al dar de baja a alguien.

## Backfill y fallback explícito

Crear un baseline revision=1 por cada task_instances existente: copiar identidad,
owner con 100%, sector sólo si catálogo versionado lo documenta; sellar y apuntar
head usando las guardas. No modificar una sola columna de tablas 001–009, no crear
audits, eventos, tareas, sesiones, cierres, receipts u outbox por el backfill.

`_legacy_task_responsibility(p_instance uuid) returns jsonb`, interno sin grant:
devuelve el formato siguiente para head baseline. Si la tarea fue creada por 008
después de 010 y no tiene head, retorna una proyección individual de owner con
origin=legacy_fallback, setId=null, revision=0, sin INSERT ni efecto secundario.
Una instancia inexistente rechaza. Este helper no es RPC de lectura para clientes.
011 debe sustituir ese fallback al crear/activar responsabilidades coordinadas.

Formato exacto (camelCase): schemaVersion=2, instanceId, setId UUID|null, revision,
origin `baseline_legacy|legacy_fallback|explicit`, mode, anchorOwnerId, companyId,
period ISO primer día del mes, teamId, sector STRING|null, sectorSource,
members=[{profileId,shareBps}]. No cuerpo privado ni perfil completo ni pesos nuevos.
010 sólo emite baseline/fallback; el tipo admite explicit para contrato futuro.

## Selección de cobertura, todavía sin autorización

### task_coverage_plans

- id, org, responsible_id, replacement_id distintos; starts_on/ends_on DATE,
  starts<=ends; kind `vacaciones|licencia|otra`; handover_note TEXT 0–2.000 chars.
- created_by, created_at; sealed=false; sealed_by UUID nullable; sealed_at nullable.
  sealed=false requiere ambos null; true requiere ambos presentes. Todos los
  perfiles con FK org. Sellado es validación de un plan, no aprobación operativa.
- Sin vínculo a employee_absences en 010 y sin escrituras allí. No hay grants,
  tablas de bindings activos ni permiso de trabajo derivado de un plan sellado.

### task_coverage_plan_instances

- plan_id, org, instance_id; PK(plan,instance); FK plan/org, instancia/org.
- company_id_snapshot, period_snapshot, responsibility_set_id nullable y FK set/org.
- En sellado: identidad coincide con ocurrencia y responsable pertenece al set
  indicado sellado (de esa instancia), o es el owner heredado si set es null.
  IDs existentes son selección expresa: no exigir que scheduled_on esté dentro
  de la ausencia (una tarea mensual iniciada el día 1 puede cubrirse del 10 al 20).
  El rango de acceso futuro sí será el plan y el mes original sigue bloqueable.

### task_coverage_plan_assignment_rules

- plan_id, org, assignment_id; PK(plan,assignment); FKs por organización.
- company_id_snapshot, assignment_snapshot JSONB object completo de to_jsonb(a).
- Al sellar debe coincidir con la asignación actual, org/empresa y owner=responsible.
  Se congela el snapshot. 011 sólo materializará bindings explícitos para futuras
  ocurrencias de esa regla cuyo scheduled_on esté en starts..ends; reprogramarla
  no dará acceso silencioso a otra regla/empresa. No hacer esas materializaciones
  ni autorizaciones en 010.

`_validate_task_coverage_plan(p_plan uuid) returns void`, interno: existencia,
responsible!=replacement, fechas, al menos una selección de instancia o regla,
FK/identidad/snapshots y responsable indicado. No exige profiles.active ni equipo
actual para historia; 011 comprobará permisos actuales al aprobar/activar.

Guard de plan permite sólo false→true, fijando sealed_by/at sin cambiar identidad,
fechas ni traspaso; valida. Toda edición/DELETE posterior se rechaza. Guard de las
dos selecciones rechaza cambios de plan/org y DML cuando parent está sellado.
Nada llama can_cover_instance ni amplía RLS de tareas/perfiles/notas privadas.
Planes pueden solaparse mientras están staged: 011 aprobará por tarea/rango y
validará conflictos. No aplicar la antigua exclusión por propietario a todas las
tareas elegidas, porque dos personas pueden cubrir selecciones diferentes.

## Tipos preparados

`coordination-contract.ts`: Zod estricto para el formato de responsabilidad;
usar postgresUuidSchema, calendarDateSchema, revisionSchema compartidos sin
cambiarlos. Refinements: miembros distintos, 1 individual/2 conjunta, suma10.000,
shareBps entero1–10.000; primer día de período; sector/source coherentes;
fallback exige setId=null/revision0/modeindividual/owner100%; baseline exige
UUID/revision>=1/modeindividual/owner100%; explicit UUID/revision>=1 y motivo no
forma parte del payload de lectura. Exportar schema y tipo inferido. No transporte,
env, hook de App, mezcla con TaskInstanceSchema008 ni cálculo de KPI vigente.

## Pruebas y aceptación

Nuevo `tests/coordination-foundation-010.test.ts`; agregar stages.m010 al helper
sin cambiar default008 ni obligar fixtures viejos a atravesar010.

1. Base vacía y upgrade009 poblado: SHA/conteos/textos de todos los datos anteriores
   intactos, especialmente notas/versiones/receipts privados y reportes históricos.
2. Cada ocurrencia histórica recibe exactamente un baseline/head, owner100%, incluso
   inactivo/sin membresía. Sin sector de catálogo usa unknown, no perfil actual.
3. Sets draft individual y conjunta válida puntual; sellado rechaza suma/cantidad,
   duplicados, org/identidad/sector incoherente o conjunta habitual. Failed seal
   revierte la transición; no head conjunta ni credit duplicado.
4. Historia y selecciones selladas inmutables, incluidas sesiones owner del lab;
   guards también se ejecutan con rol elevado. DML draft no mueve identidad.
5. Plan válido por IDs y por reglas; invalid refs/responsible, snapshot alterado,
   fecha o selección vacía fallan. Una tarea mensual fuera del rango scheduled_on
   puede seleccionarse explícitamente; reglas futuras aún no generan bindings.
6. authenticated/anon/service_role no tienen SELECT/DML/EXECUTE nuevos, incluyendo
   helpers. No activar grants globales para facilitar el test.
7. Una tarea 008 creada después de010 produce fallback correcto sin insertar filas.
   Baseline/head no altera transiciones/clock ni la política de lectura 008.
8. Zod rechaza shares decimales/suma errónea/personas duplicadas/fechas inválidas,
   identidad y sector/source incoherentes; acepta baseline/fallback válidos.
9. Verificar diff de SQL001–009/lector/gateway/App/dependencias vacío. Ejecutar
   npm test, npm run build y git diff --check; usar workers limitados si el lab
   tiene contención y registrar ese comando, sin ocultar fallos de aserción.

Commit/push del código de Sites, conservar live v43 (sin UI nueva). No guardar ni
publicar otro build sólo por añadir SQL invisible. Terminar en el cambio manual
a **GPT-6.1 Sol alto, Standard**: revisión010 y contrato011 completo. 011 no se
ejecuta con este documento; no marcar tasks conjuntas/cobertura selectiva como
funcionales hasta que engine+Auth+interfaz estén conectados y comprobados.
