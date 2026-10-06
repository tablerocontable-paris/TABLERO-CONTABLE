# Contrato ejecutable — tareas conjuntas del laboratorio

Estado: implementado en el laboratorio privado; pendiente aceptación visual y
de la ruta completa de cierre en Chromium.
Base de diseño: commit 8ca6933, Site privado v46. No depende del chat anterior.
Conservar el laboratorio, Git y SQL001–011. No conectar Auth, D1 o Supabase.

## 1. Evidencia y frontera

CORRECTIONS-20261002.md exige dos responsables, una ocurrencia puntual,
cuotas que suman 100%, relojes independientes y cierre sin doble KPI.
SQL011 ya implementa responsabilidad versionada/cierre v4 y tiene evidencia
local previa. Ese motor no está conectado al laboratorio.

Hallazgos en código vigente:

| Archivo / función | Brecha que debe resolver la implementación |
| --- | --- |
| model.ts / Task | Sólo ownerId, sin miembros ni cuota |
| workforce.ts / startClock | Rechaza un segundo reloj porque mira cualquier actor |
| workforce.ts / stopClock, applyClock | Pausa todas las sesiones, incluso de compañeros |
| App.tsx / filtros y mutateTask | Filtra por ownerId; un cambio de reloj puede parar actores ajenos |
| model.ts / isClosed, closeMonth | Sólo período del ancla; no congela al cerrar el segundo miembro |
| reports.ts / generatePeriodReport | Suma todas las sesiones de la tarea como tiempo del empleado |
| notifications.ts / recipients | Falta acceso explícito del segundo responsable |
| OperationalTaskCard.tsx / running | Estado del botón depende de cualquier reloj abierto |
| site-schema.ts / site-policy.ts | Contrato remoto separado: no acepta coordinación ni eventos nuevos |

No modificar el contrato remoto para aceptar un JSON nuevo del cliente.
Los cambios compartidos deben mantener el comportamiento de las tareas sin
responsabilidad conjunta. Las pruebas existentes del backend son regresión.

## 2. Identidad y datos

Extender Task con responsibility opcional, sellada y de sólo lectura funcional:
`{ version: 1, revision: 1, mode: 'joint', activatedAt, activatedBy,
reason, members: [{profileId, shareBps, name, teamId, sector}] }`.
Exactamente dos miembros distintos, cuotas enteras positivas sumando10000.
Sin propiedad responsibility: tarea individual heredada, ownerId tiene10000bps.
ownerId sigue siendo ancla y debe ser uno de los miembros. No copiar Task.
Empresa, período, sector, equipo del ancla e identidad de asignación no cambian.
Nombres/equipos de miembros son snapshot, no se reescriben por editar perfil.

La persistencia local conserva version3 y campos opcionales validados en Zod;
no reescribe cierres ni datos operativos. Índices únicos de recibos/tareas en
memoria se validan. No agregar dependencias ni alterar migraciones SQL.

## 3. Activación inicial, autorización e idempotencia

Crear domain/coordination.ts con activateJointTask(state, input, actorId).
Input: taskId, secondProfileId, anchorShareBps, reason, expectedRevision,
requestId. Baseline individual revision0; conjunta inicial revision1.
Validar todo antes de devolver nuevo State; sin mutación del estado recibido.

- Sólo jefe o encargado con ambos miembros como subordinados directos activos
  del mismo equipo y ambos en su ámbito. Cruce de equipos sólo jefe.
- El perfil técnico admin no activa conjuntas ni genera trabajo/KPI propio.
- Miembros operativos: empleado o encargado; excluir jefe y perfil técnico admin.
- Actor activo y empresa autorizada; ambos miembros activos y autorizados para
  esa empresa. No ampliar companyIds ni managerId para permitir la operación.
- Sólo una asignación puntual (`frequency` y schedule.frequency si existe son
  'única') con una única ocurrencia. Sin asignación: tarea ad hoc individual
  elegible si no tiene plantilla recurrente ni otra ocurrencia vinculada.
- Rechazar si startedAt/completedAt, sesiones, actividad, checklist marcado,
  espera externa, comentarios de tarea o cierre de cualquiera de los miembros.
  El estado debe ser Pendiente. Una tarea iniciada no se convierte silenciosamente.
- Defaults50/50; porcentajes UI con máximo dos decimales se convierten a bps.
  Rechazar NaN, infinitos, cero, negativos, suma inválida y motivo vacío.
- No editar miembros/cuotas después de activar en este bloque. Desactivar un
  perfil conserva su historia; traspaso o nueva revisión requieren otro contrato.
- State.jointReceipts opcional guarda requestId, actorId, cuerpo canónico y ACK
  taskId/revision. Replay exacto propio devuelve mismo estado/ACK, sin otro aviso
  o auditoría; misma clave con cuerpo distinto falla. expectedRevision viejo falla.

UI: acción 'Compartir tarea' en detalle sólo de tarea elegible y actor autorizado,
selector del segundo responsable, reparto, motivo y confirmación. Permitir crear
una tarea puntual individual y activar antes de iniciarla. Una confirmación = un
commit de todo el nuevo estado, responsabilidad, recibo, auditoría y avisos.

## 4. Acceso y privacidad

Agregar helpers responsibleMembers(task), responsibilityShare(task, profileId),
isResponsible(task, profileId) y canAccessJointTask(state, actor, task).
canWork integra acceso por miembro activo y empresa autorizada sin llamar a
canSee sobre el perfil del compañero ni abrir acceso a sus demás tareas.
Superiores autorizados mantienen su ámbito sobre miembros; encargado necesita
subordinado directo en la tarea para lectura, ambos para activar. Jefe requiere
empresa autorizada en esta nueva ruta. Actor desactivado pierde acceso actual.

Empleado conjunto ve estado/checklist/vencimiento compartidos y sólo sus propios
registros/sesiones detallados. Tiempo total no se presenta como tiempo propio.
Un superior sólo ve detalle de actores que ya están en su ámbito. Los comentarios
comunes son visibles a los lectores autorizados de la tarea; anotaciones personales
y causas privadas no se incluyen en tarjetas, avisos o reporte del compañero.

El laboratorio contiene todos los datos ficticios en un navegador: filtros de UI
no son aislamiento de seguridad real. No declarar RLS/Auth/colaboración online.

## 5. Relojes, estado y checklist

Separar stopActorClock(task, actorId, at), stopAllTaskClocks(task, at) y
actorElapsedSeconds(task, actorId, at). Mantener elapsedSeconds como total
explícito para agregados; no usarlo en etiquetas de tiempo personal.
startClock permite dos actores distintos en conjunta y sólo uno por actor.
applyClock y la autoactivación de mutateTask paran sólo relojes del mismo actor
en otras tareas. Pausar A no cambia B ni pone Pendiente una tarea compartida.

Una finalización válida (incluido último check que completa) detiene todas las
sesiones de esa tarea al mismo instante; guarda Completada/completedAt una vez.
No permite detener arbitrariamente el reloj ajeno desde el control de pausa.
Reabrir sin cierres conserva sesiones/actividad previas, aumenta reopenCount una
vez y deja relojes apagados hasta inicio explícito; no arranca el reloj del par.
La espera externa detiene todos los relojes de la tarea compartida de forma
explícita/auditada, porque bloquea el trabajo de la ocurrencia.

Cada botón y banner usa el actor activo, no 'alguna sesión abierta'.
Una sesión propia abierta como máximo en todo el estado, también al alternar
entre tarea individual, conjunta y cobertura. No alterar cuota por tiempo.

## 6. Tableros, filtros y métricas

La misma Task.id aparece en ambos tableros personales como 'Tarea conjunta'.
Selección de persona autorizada incluye tareas donde es responsable, aunque no
sea ownerId. Mi día/agenda/búsqueda/tablero/operativas usan el mismo helper.
No aparecer dos veces si también tiene cobertura. No mostrar fila del compañero
en administración de perfiles por el mero acceso a una conjunta.

Global: deduplicar por Task.id y contar weight una sola vez. Equipo/sector global
conservan ancla original; atribución personal es dimensión separada y rotulada.
Individual: possible=weight*shareBps/10000; earned=earnedGlobal*shareBps/10000.
Sin redondeo intermedio; redondeo sólo presentación/exportación. Meta operativa
y cantidad cumplida son únicas; cantidad propia y tiempo propios se muestran
separados del resultado compartido. Cobertura no concede cuota ni puntos extra.
Mantener métricas globales heredadas; agregar helper explícito para métricas por
persona, no clonar tareas con pesos reducidos para reutilizar una fórmula.

Ejemplo de aceptación: peso5, A60% y B40% => posibles3 y2; finalización da3 y2;
global5. A600s y B900s => tiempos personales600/900, global1500, nunca750cada uno.

## 7. Cierre y compatibilidad histórica

isClosed congela la tarea si cualquier miembro responsable tiene período cerrado.
Todos los writers de tarea, reloj, actividad, parámetros y comentarios comprueban
esa guarda; cerrar A no crea cierre B. No congelar por cierre de mero reemplazo.

closeMonth incluye responsabilidad propia y contribución de cobertura propia,
no sólo ownerId. Rechaza conjunta de resultado no Completada; operativa conjunta
requiere meta alcanzada, sin espera y sin relojes abiertos. Cualquier reloj de
esa ocurrencia abierto impide cerrar. Mes futuro y permisos heredados se conservan.
Tras cerrar A, B puede cerrar leyendo la misma evidencia congelada. No volver a
materializar, cambiar cuotas ni recomputar el snapshot A por cerrar B.

Reporte local nuevo schemaVersion2, con campos comunes de visualización,
contribuciones y algoritmo 'joint-lab-v1'. Lectura/exportación discriminada de
schemaVersion1 y2. No confundirlo con snapshot SQL version4, no reutilizar sus
grants ni afirmar que está integrado. Viejos cierres/reportes1 quedan intactos.
Reporte del empleado no incluye sesiones ni textos privados del compañero.
CSV añade cuota/puntos personales/tiempo propio en reporte2, mantiene CSV1.

## 8. Notificaciones

collectTaskNotifications detecta responsabilidad individual->joint, emite 'joint'
una vez por destinatario autorizado y commit de activación. Incluye ambos miembros
salvo autor y sus superiores autorizados, deduplicados; sin cuerpo privado.
Completar/cambiar/comentar usa mismo acceso conjunto, sin otro aviso de asignación
para la misma activación. Marcar leído o cambiar perfil no genera nuevos eventos.
Si un destinatario pierde acceso, el aviso no se muestra ni permite abrir detalle.

## 9. Archivos y orden de implementación — un bloque completo

1. model.ts + coordination.ts + repository.ts: tipos, validación, activación,
   helpers, guardas e idempotencia. tests/joint-coordination.test.ts.
2. workforce.ts + App.mutateTask: relojes propios, cierre compartido y pruebas.
3. model.metrics/closeMonth + reports.ts + PeriodReports.tsx: cuotas, snapshot2,
   compatibilidad1 y exportación. Tests de conciliación y de no filtración.
4. App.tsx + OperationalTaskCard.tsx: acción compartir, filtros, badges,
   tiempo propio y aviso joint. Componente JointTaskSetup.tsx separado.
5. Tests DOM y Chromium: simular A/B/superior, activar, dos relojes, pausa,
   finalización, comentarios, avisos y cierre A/B. Recargar y comprobar persistencia.
6. Suite completa, build, QA desktop/mobile, commit/pre-commit, push y publicación
   privada mismo Sites; verificar versión y deploy. Actualizar estado/evidencia.

No activar RemoteWorkspace. Si las modificaciones compartidas rompen contrato
D1, aislar el helper nuevo en laboratorio y conservar regresiones del servidor.
No ampliar cobertura recurrente o jerarquía multiarea en este mismo cambio.

## 10. Matriz mínima de aceptación

- Alta válida50/50 y60/40, misma identidad/peso/empresa/período.
- Rechazos: empleado activador, jefe técnico, encargado fuera de ámbito/cruce,
  miembro inactivo/empresa incorrecta/repetido, cuota inválida, tarea recurrente,
  tarea iniciada/comentada/cerrada, revision vieja y requestId cambiado.
- Replay: mismo resultado, una auditoría/aviso por destinatario, persistencia.
- A y B inician en paralelo; A pausa sin afectar B; A cambia de tarea sin afectar B.
- Completar/último check para ambos relojes; reabrir conserva historia y no inicia B.
- Cada miembro ve su tarjeta y tiempo; compañero ajeno no la ve; sin ampliación
  de acceso a perfil, anotaciones privadas o sesiones del par.
- Global5 = A3+B2; actores600/900s; cobertura sin cuota extra; listas sin duplicados.
- Cierre rechaza conjunta pendiente/operativa sin meta/relojes activos.
- Cerrar A congela writers de A/B, B cierra después, reporte A no cambia.
- UI/CSV/reportes no filtran registros del par; históricos1 no se reescriben.
- Notificación joint, cambio, finalización y comentario a miembros/superiores;
  cero avisos al autor, duplicados de replay o filtración por pérdida de acceso.
- Regresión individual, SQL011 y backend D1; cero API operativa en laboratorio.

## Handoff

Próximo modelo: GPT-6 Luna, esfuerzo medio, velocidad Standard, para implementar
este contrato completo y comprobarlo. Si descubre contradicción material entre
reglas o necesidad de nuevo esquema remoto, preservar trabajo y volver a Sol6.1
alto con evidencia concreta; no inventar autorización ni cambiar cuentas.
Diseño cerrado no incrementa el avance funcional: global aproximado45%.

Estado actualizado 06/10: el tablero ahora conserva orden manual entre columnas, incluye soporte teclado y activa el reloj al mover a En curso. Suite de regresión posterior reportada por proyecto: 341/341. Esto no implementa todavía activación conjunta, responsabilidad/cuotas o cierre.

## Implementación de laboratorio — 06/10/2026

- `Task.responsibility` conserva una sola identidad de tarea y snapshots de dos
  participantes/cuotas. La activación es idempotente, revisa versión, actor,
  empresa, equipo, recurrencia, cierres y evidencia previa. El recibo y la
  auditoría se guardan junto con la activación local.
- Los dos responsables pueden cronometrar a la vez. Pausa, inicio en otra tarea,
  etiquetas de tiempo y registros personales no mezclan a los actores. Completar
  detiene ambos relojes; reabrir mantiene la historia y deja los relojes apagados.
- Tableros y análisis individuales atribuyen puntos por cuota; el peso global se
  cuenta una vez. Los cierres personales incluyen la tarea por participación,
  congelan escritores de ambos cuando cierra uno y generan informe v2 sólo para
  cierres con tareas conjuntas. Los informes individuales existentes siguen en v1.
- La UI permite compartir con motivo/reparto, muestra miembros/cuotas, hace una
  tarjeta por participante, avisa a los lectores autorizados y oculta al otro
  actor sus sesiones y anotaciones personales.
- Evidencia: 348 pruebas locales, build TypeScript/Vite/Worker, Chromium de la
  activación, aviso, dos relojes y pausa individual; el recorrido general también
  pasa escritorio y móvil. Cero llamadas a `/api` desde los dos recorridos.
- Límite: `localStorage` es una simulación en un solo navegador, no colaboración
  autenticada o concurrente entre PCs. No se aplicó SQL, no se conectó D1,
  Supabase o Auth y no se amplió la audiencia del Site. La cobertura no otorga
  cuota conjunta; la coordinación entre equipos sigue sin ampliarse para encargados.
