# Coordinación B — decisiones de arquitectura

Estado actualizado al06/10/2026: B1/009 implementado, revisado y reparado
localmente. B2a/010 ejecutado y revisado independientemente, sin hallazgos.
Contrato011 y protocolo de concurrencia cerrados para implementación Luna medio:
`COORDINATION-011-EXECUTION-20261004.md` y
`COORDINATION-011-CONCURRENCY-20261006.md`. Motor011 y B3–B4 no se ejecutaron;
ningún bloque se aplicó remotamente. Fuente: SQL001–010, frontend0.4 y
`product/CORRECTIONS-20261002.md`. PostgreSQL real y Auth/UI siguen pendientes.

## Base encontrada y conflictos que hay que resolver

La base ya separa teams, team_members, profiles.manager_id y company_memberships.
El sector de plantilla/tarea es independiente. No hay que crear otro equipo por
rubro. La demo usa un teamId por persona, pero SQL permite membresías múltiples
sin validar la consistencia con manager_id. Los fixtures históricos incluso
incluyen empleados bajo jefe dentro de un equipo de otro encargado: no deben
corregirse silenciosamente ni bloquear un upgrade de un módulo no relacionado.

Task_instances conserva owner_id único. La autorización y los locks 008 están
centrados en ese propietario y período. Hay índice de un cronómetro por instancia,
además del límite por actor. Agregar participantes sin sustituir esos puntos
rompería concurrencia, cierre y KPI. Cobertura vigente autoriza por empresas y
período, no por conjunto de tareas. blocked_by es texto común visible en la tarea;
no puede almacenar la explicación confidencial solicitada.

## Modelo final y reglas de identidad

| Relación | Decisión | Lo que conserva |
| --- | --- | --- |
| Equipo | Grupo dirigido por encargado, multiarea | Organización y miembros, sin depender de sector |
| Jerarquía | Empleado → encargado → jefe; jefe sin superior operativo | Historial separado de cambios; actor actual derivado de Auth |
| Empresas | Membresía explícita independiente del equipo | Aislamiento por empresa y controles del servidor |
| Tarea conjunta | Una ocurrencia puntual, dos responsables, cuota total 100% | Empresa, fecha, estado y checklist únicos; tiempo por actor |
| Cobertura | Acceso temporal a selección aprobada de ocurrencias/reglas futuras | Titular de obligación; ejecutor real e historial de sesiones |
| Reasignación | Episodio de responsabilidad futuro auditado | Identidad/linaje; ningún cierre se atribuye a otro empleado |
| Baja | Perfil histórico permanece, acceso suspendido | Asignaciones y trabajo pendiente en bandeja de reasignación |
| Comentario privado | Recurso separado, autor y superiores vigentes | Texto no presente en Task, KPI, correo ni reporte común |

Equipo operativo: un empleado activo tendrá un equipo principal y su manager
será el encargado de ese equipo. Un encargado puede dirigir más de un equipo;
no tiene que ser miembro de cada equipo para supervisarlo. No inventar membresía
para jefe/auditor. El cambio administrativo requiere previsualizar inconsistencias
y aprobación de Juan Pablo; los fixtures previos siguen como fixtures previos.

La jerarquía actual decide permisos de supervisión. La pertenencia snapshot de
una tarea decide agrupación histórica. Mover a alguien de equipo no reescribe
team_id, pesos, sector ni empresa de tareas iniciadas/cerradas. Trabajo futuro
no iniciado se revisa mediante operación explícita y previsualización. Esto es
lo mismo que la regla vigente de reviseAssignment.

## Responsabilidad, contribución y cierre

La implementación de conjuntas añadirá responsabilidad versionada por ocurrencia,
con participantes y cuotas snapshot. owner_id existente se conserva como ancla
histórica/canónica para compatibilidad; no significa 100% de crédito individual
cuando hay participantes. Vista de trabajo puede consultar participantes; vista
de perfiles no adquiere acceso al perfil completo de otro responsable.

Sólo Juan Pablo o encargado con ambas personas en su ámbito asignan conjuntas;
entre equipos decide Juan Pablo. Únicamente frecuencia única en esta fase. Dos
actores pueden ejecutar en paralelo; cada actor sólo tiene un reloj abierto.
Finalizar una conjunta detiene todas sus sesiones en una transacción. La futura
migración sustituirá el índice one_open_session_per_instance por exclusión
compatible por instancia/actor y revalidará todas las RPC008; no basta borrarlo.

Peso global cuenta una vez por Task.id. Individual: peso×cuota vigente snapshot;
equipo/sector/empresa suma los numeradores y denominadores deduplicados. Sesiones
siempre se atribuyen al actor; no dividir tiempo ajeno por cuota. Anticipación
usa logro único de ocurrencia; el desglose individual muestra participación y
no duplica el conteo global. Se versionará la métrica del reporte al introducir
participantes; no reinterpretar snapshots schemaVersion1 existentes.

Cobertura no cambia esas cuotas: el titular mantiene responsabilidad/KPI de su
obligación y el reemplazo obtiene contribución de tiempo/registros por actor,
con etiqueta “cobertura”, sin otro peso global. La selección puede contener IDs
existentes y asignaciones habituales cuyo scheduled_on esté dentro del rango.
Al aprobar se congela la regla; futuras ocurrencias adquieren vínculo explícito,
no permiso implícito a todas las tareas de ese propietario. El reemplazo ve las
seleccionadas; al finalizar/cancelar se detienen sus relojes y expira acceso de
trabajo. Puede conservar su evidencia propia sin obtener el perfil del titular.

Un cierre de usuario consulta su participación/responsabilidad y contribuciones.
Si una tarea conjunta toca a dos usuarios, se bloquean ambos owner/períodos en
orden estable; cualquier cierre existente impide mutación de esa evidencia.
Transferencia, sesiones, checklist, materialización y cierre deberán usar ese
mismo conjunto de locks/revisiones. Esto exige ampliar snapshot/reporte/outbox y
las lecturas; no se conectará B al lector008 como si sus tipos ya lo incluyeran.

Para bajas se necesita anular acceso y detener relojes en la misma operación,
pausar nuevas materializaciones y crear pendientes de reasignación. No borrar
profiles ni usar un UUID ficticio sin dueño. Tareas sin actividad admiten traslado
futuro con cadena de responsabilidad. Las iniciadas requieren traspaso explícito;
las cerradas nunca se trasladan. Un encargado con subordinados activos no puede
retirarse sin plan de sustitución. Conflictos y cierres bloquean el lote completo.

## Matriz mínima de permisos

| Acción | Empleado | Encargado | Juan Pablo | Cuenta técnica |
| --- | --- | --- | --- | --- |
| Tablero personal | Propio + participación/cobertura vigentes | Igual | Igual | Laboratorio aislado |
| Consultar perfil completo | Propio | Subordinados actuales | Organización | Diagnóstico autorizado sin escritura operativa |
| Asignar conjunta | No | Dos personas en ámbito | Organización | No |
| Proponer cobertura | Propia, compañero del equipo | En ámbito | Organización | No |
| Aprobar cobertura | No | Ambos en ámbito/mismo equipo | Excepciones entre equipos | No |
| Cerrar período | No | Subordinados + propio | Organización | No |
| Leer comentario privado | Sólo propio | Autor subordinado vigente y empresa autorizada | Organización | No |
| Reasignar huérfanas/roles | No | No | Sí, MFA y previsualización | No |

El encargado que consulta un perfil sigue siendo el actor autenticado. Una
membresía de participación/cobertura jamás habilita comentarios privados de otro
ni un cierre de mes. No publicar personas señaladas en avisos o exportaciones.

## Secuencia de implementación para evitar rehacer módulos

1. **B1 / 009: privacidad de comentarios**, contrato ejecutable aislado
   `PRIVATE-BLOCK-NOTES-009-20261002.md`. Crea frontera RLS independiente sin
   modificar transición/clock008 ni fingir privacidad de localStorage.
2. **B2: responsabilidad coordinada**: participantes, selección de cobertura,
   cuotas/contribuciones y conjunto de locks/cierres/reportes. B2a/010 tiene
   base staged ejecutada con contrato cerrado; después Sol revisa010 y
   cierra011 para activar el motor completo. No ejecutar B2 con este documento.
3. **B3: administración jerárquica y bajas/huérfanas**, usando responsabilidad de
   B2 para no introducir una segunda forma de transferir tareas. RPC de alta de
   usuario Auth irá con servidor/invitaciones, no insert directo de contraseñas.
4. **B4: estandarización/aprobación y conexión frontend**, preservando propuesta
   original y confirmación de Juan Pablo. C después enlaza obligación a Task.id;
   D aporta consultas/ciclo sin contarlos como KPI.

Dependencias con C: obligación por empresa/período fiscal/hito, vínculo explícito
a ocurrencias, cumplimiento al concluir todos los vínculos requeridos y lectura
acotada. No unir por título ni por coincidencia de banco. ARCA y correo requieren
servidor, cuotas y proveedores confirmados durante infraestructura.

El diseño original se registró con 41% global. El estado vigente mantiene 42%
tras B1; esta revisión y el contrato010 no elevan ese estimado. Consultar
`../PROJECT-STATUS.md`. B2/B3 todavía no son capacidades operativas.
