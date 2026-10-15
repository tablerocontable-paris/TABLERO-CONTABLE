# M2.1: contrato ejecutable para Luna

> Revisión14/10: la implementación inicial no fue aceptada. La siguiente ejecución
> usa M2-1-CORRECTIONS-LUNA-20261014.md, que amplía este contrato con la coordinación
> de identidad entre snapshots y las regresiones independientes. Ver M2-1-SOL-REVIEW-20261014.md.

Fecha: 14/10/2026. Leer SUPABASE-M2-CONTRACT-20261014.md y el estado vigente.
Modelo de ejecución recomendado: GPT-6 Luna, esfuerzo medio, Standard.
Revisión posterior: GPT-6.1 Sol, esfuerzo alto, Standard.

## Resultado requerido

Agregar una base de identidad y API local, probada desde vacío y upgrade, que
distinga una cuenta técnica de un perfil contable. No conectar servicios ni
modificar el comportamiento visible del laboratorio en este bloque. Es una
fundación comprobable; no se declara habilitada la app Supabase.

## Archivos y límites

Crear:

- supabase/migrations/202610140013_api_identity_foundation.sql
- src/data/supabase/context-contract.ts
- tests/supabase-identity-foundation.test.ts
- tests/supabase-context-contract.test.ts
- docs/architecture/review-evidence/m2-1-identity-implementation-20261014.json

Se puede extender tests/helpers/accounting-lab.ts si las fixtures de claims lo
necesitan, conservando su modo anterior por defecto. Leer los helpers y tests
SQL existentes antes de agregar otra infraestructura. No instalar dependencias.
No editar las 14 migraciones anteriores. No cambiar main.tsx, App.tsx, Worker,
D1, RemoteWorkspace, el adaptador histórico ni la configuración del Site.
No crear dispatcher genérico, roles nuevos de Postgres o tablas de negocio de
los siguientes bloques. No simular una implementación alojada.

## SQL 013

Una transacción de migración crea los esquemas api y app_private si no existen.
Defaults para objetos nuevos cerrados para PUBLIC, anon y authenticated; dar
USAGE de api a authenticated y ningún acceso directo a app_private. Revocar
CREATE de los roles cliente. No hacer REVOKE global de las funciones de public
que ya usan RLS. Revocar ejecuciones de los nuevos helpers/trigger functions a
PUBLIC, anon, authenticated y service_role. Grant explícito sólo al endpoint
api.get_context_v1() para authenticated. Verificar grants reales en pg_proc/ACL,
no inferirlos desde que la llamada anon falló una sola vez.

Tabla app_private.technical_accounts:

| Columna | Tipo/condición |
| --- | --- |
| user_id | uuid PK, FK auth.users(id), sin borrado en cascada |
| organization_id | uuid NOT NULL FK public.organizations |
| display_name | text NOT NULL, trim no vacío, 1..200 caracteres |
| active | boolean NOT NULL DEFAULT true |
| created_at | timestamptz NOT NULL DEFAULT now() |

No hay columna rol editable: el único tipo técnico del bloque es maintainer.
Activar RLS, sin policies de lectura/escritura cliente y sin grants de tabla.
La tabla se crea vacía; sólo la migración/fixture como administrador inserta
filas en esta etapa. No seedear correos, IDs del laboratorio, contraseñas o
propietarios reales.

Evitar que el mismo auth UUID exista en profiles y technical_accounts,
incluyendo filas inactivas. Un trigger BEFORE INSERT/UPDATE OF identidad en
AMBAS tablas toma pg_advisory_xact_lock(1110,hashtext(auth_uuid::text)), luego
comprueba la tabla contraria. Choque => SQLSTATE 23514, mensaje genérico. Colisión
de hash sólo serializa más; no autoriza. No usar un CHECK con subconsulta ni un
SELECT sin lock que permita dos inserts concurrentes. No cambiar los IDs de
perfiles existentes. Un UUID distinto para la cuenta personal y técnica cumple
la separación que pidió el usuario.

El nuevo endpoint, SECURITY DEFINER SET search_path='', sólo consulta:

1. auth.uid() no NULL y auth.jwt()->>'role' = authenticated. Un JWT sin rol o
   service_role no se convierte en actor del negocio. `aal` debe ser aal1/aal2.
2. exactamente un principal por ID: profile O technical_account. Doble identidad,
   principal ausente, inactivo o profile.role=auditor => SQLSTATE 42501 con
   texto genérico, sin divulgar qué fila falta o el nombre de otra cuenta.
3. Para perfiles, organización y membresías se leen de tablas actuales con
   organization_id coincidente. teamIds y companyIds son arrays únicos ordenados
   de UUID. No confiar en metadata del JWT ni recibir userId/organizationId.
4. Contexto mínimo aal1 se permite para resolver MFA; no devuelve datos de
   empleados, tareas, correos, tokens, sesiones, facturas ni notas.

displayName se presenta con trim; si un perfil histórico tiene nombre vacío o
mayor de 200 caracteres, denegar el contexto con 42501 en vez de emitir un DTO
inválido o reescribir el nombre sin aprobación. Cubrir ese caso con fixture.

Forma exacta del resultado:

```typescript
type ContextV1 = {
  contractVersion: 1;
  principal:
    | {kind: 'business'; id: UUID; organizationId: UUID; displayName: string;
       role: 'empleado'|'encargado'|'jefe'; teamIds: UUID[]; companyIds: UUID[]}
    | {kind: 'technical'; id: UUID; organizationId: UUID; displayName: string;
       role: 'maintainer'};
  authentication: {aal: 'aal1'|'aal2'; requiresMfa: boolean};
  capabilities: [];
};
```

requiresMfa = aal1 Y (principal técnico O role jefe/encargado). Empleado devuelve
false con aal1 o aal2. No se devuelven permisos de trabajo todavía: capabilities
es siempre vacío en 013, incluso para jefe con aal2. Tampoco se muestra una
acción técnica que aún no está implementada.

No otorgar acceso a profiles a la cuenta técnica para que funcionen helpers
viejos: actor_org/actor_role permanecen sin principal de negocio para esa cuenta.
No tocar la política de notas SQL009 ni usarla para futuras anotaciones propias.
La función no crea/actualiza perfiles, membresías o auditoría al consultar.

## Contrato TypeScript

context-contract.ts exporta schema Zod estricto, tipo ContextV1 y decoder
decodeContextV1(value:unknown). El decoder devuelve unión `{ok:true,context}` o
`{ok:false,error:'protocol'}` sin incluir valores privados de entrada en mensajes.
Objetos y ambas ramas son estrictos; UUID acepta representación PostgreSQL
canónica de 8-4-4-4-12 hex sin imponer versión; displayName no vacío/<=200;
arrays únicos y ordenados (normalizar UUID a minúsculas al comparar, no mutar
la entrada). organizationId no debe copiarse desde un campo externo.

El decoder rechaza duplicados, campos adicionales, capabilities no vacío y
requiresMfa incoherente con aal/principal. No transforma un contexto técnico
en jefe ni rellena un principal desconocido. No crear sesión Auth ficticia,
cliente global, fallback local ni persistencia de este contexto en State.

## Comprobaciones de aceptación local

1. Migraciones desde base vacía hasta013 y upgrade poblado012→013, sin perder
   tasks/activity/sessions/receipts/reportes/cierres/observaciones anteriores.
   Comparar filas y snapshots por bytes, no sólo cantidades.
2. Empleado/encargado/jefe activos reciben sólo su contexto, con membresías de
   su organización, orden estable y requiresMfa correcto en aal1/aal2. Cambio de
   rol/membresía/inactividad en DB se refleja usando el mismo JWT anterior.
3. Sin auth, rol de claim inválido, servicio, auditor, perfil ausente/inactivo,
   técnico inactivo => denegación. No `PUBLIC execute` heredado, ni SELECT/INSERT/
   UPDATE/DELETE directo de technical_accounts como anon/authenticated.
4. Técnico activo usa su contexto sin aparecer en profiles, directorio,
   métricas, asignaciones o actor_role antiguo. Contexto no devuelve credenciales
   ni datos de otra persona. Las consultas no escriben filas.
5. Doble identidad rechazada en AMBOS sentidos, también inactivos y UPDATE de
   UUID. Rollback de migración/pruebas no deja un principal parcial. Verificar
   concurrencia con dos sesiones PostgreSQL: insert profile vs technical con
   mismo auth UUID, A/B y B/A; una confirma y la otra rechaza, sin coexistencia.
   Si no se puede ejecutar PostgreSQL real, registrar esa prueba como pendiente,
   sin reemplazarla por dos promesas concurrentes en un único PGlite.
6. Decoder acepta las dos ramas y rechaza cuerpo extra, secreto añadido, UUID/
   nombre/rol inválidos, membresía duplicada o fuera de orden, MFA incoherente,
   contrato desconocido y capabilities inventadas. No tolerar un State completo.
7. Cero cambios de hashes de SQL anteriores y archivos de producto fuera de
   alcance. Gates focales, suite completa, TypeScript y build antes del commit.
   Registrar comandos, códigos de salida, versiones y hashes en evidencia.

Los tests pueden insertar fixtures como postgres en una DB efímera. Eso no
autoriza insertar cuentas reales ni acredita Auth/MFA del proveedor. La prueba
del esquema expuesto api y la negativa de public quedan para M2 alojado, junto
al login con sesiones reales; no inventar un pase con la API simulada.

## Cierre del bloque

Actualizar PROJECT-STATUS, EXECUTION-NEXT y el registro de evidencia. Crear
commit local sobre migration/github-bootstrap y paquete portable actualizado;
no usar las cuentas GitHub anteriores. Si una cuenta nueva aún falta, terminar
todo lo local. Luego volver a Sol alto para revisar 013/contexto/grants y cerrar
el contrato de implementación M2.2. No comenzar 014 automáticamente en Luna.
