# Baja y reasignación de perfiles — laboratorio

Fecha: 06/10/2026. Alcance: estado ficticio aislado del laboratorio. No modifica
Worker/D1, Supabase, invitaciones, autenticación ni audiencia de Sites.

## Baja

- Sólo una jefatura activa registra una baja; no puede darse de baja a sí misma.
- Requiere motivo de 5 a 500 caracteres. Antes de dar de baja a un encargado,
  sus personas activas a cargo deben quedar bajo otro responsable.
- Conserva el perfil, las tareas cerradas, los cierres y la actividad histórica.
- Retira todas las reglas recurrentes del perfil e impide su materialización.
- Cierra únicamente las sesiones activas del perfil dado de baja. Un reloj de
  otro participante no se detiene por esa operación.
- Cancela coberturas aprobadas aún vigentes para ese perfil y detiene sólo los
  relojes de reemplazantes afectados, revocando esos permisos temporales.
- Cada tarea abierta no cerrada se agrega a la bandeja con perfil, empresa,
  asignación/estándar, frecuencia y motivo originales.

## Resolución de la bandeja

- `ready`: tarea pendiente con fecha futura, sin sesión ni actividad, y sin
  responsabilidad conjunta. Sólo se puede reasignar a un perfil activo con
  acceso a la empresa.
- `handoff_required`: trabajo iniciado (estado, fecha de inicio o controles
  realizados), con sesiones, actividad o comentarios, o responsabilidad
  conjunta. Nunca aparece la reasignación directa.
- `review_required`: tarea abierta no iniciada que no cumple el criterio de
  fecha futura o carece de fecha. Requiere revisión manual.
- La reasignación directa modifica sólo la instancia abierta y su equipo actual.
  La bandeja conserva la identidad anterior y registra destinatario, actor y
  fecha. No reactiva la regla vieja ni genera otra instancia.
- Los registros pendientes se vuelven a comprobar al confirmar la acción;
  estado, sesiones, actividad, período, destinatario y empresa deben seguir
  cumpliendo el contrato.
- Rehabilitar el acceso no reactiva reglas retiradas ni reasigna automáticamente
  trabajos que ya están en la bandeja.

## Traspaso explícito — laboratorio

- Sólo jefatura activa y con alcance sobre la persona anterior puede autorizar
  un traspaso no conjunto. Exige un receptor activo con acceso a la empresa y
  un motivo de 5 a 500 caracteres.
- Rechaza registros vencidos, tareas cerradas/completadas, cronómetros abiertos,
  receptores con el período cerrado, estado de titularidad obsoleto y repetición
  de una resolución ya confirmada.
- La tarea conserva su ID y evidencia; sólo cambia responsable y equipo. Un
  registro inmutable copia la tarea anterior completa, sesiones por actor,
  actividad, comentarios, identidades, motivo y fecha. La baja detiene el reloj
  activo antes del traspaso, conservando su intervalo.
- Las tareas conjuntas quedan para revisión manual; modificar miembros/cuotas
  exige un contrato aparte para evitar alterar cierres individuales.
- La bandeja muestra un historial permanente. El cierre del nuevo responsable
  incorpora el registro y el informe/CSV identifica responsables y motivo.
  Los informes atribuyen el tiempo sólo al actor de cada sesión; no transfieren
  horas históricas a quien recibe la tarea.

## Verificación y límites

Las pruebas cubren permisos, motivos, elegibilidad, sesiones/actividad/comentarios,
persistencia, reportes y flujo de pantalla para bajas, reasignación y traspaso.
La persistencia continúa en `paris-state-lab` del navegador y no sincroniza
entre equipos. El contrato no prueba Auth, RLS ni el backend activo. No se ha
implementado el traspaso en Worker/D1 ni Supabase; cualquier activación real
requiere trasladar estas reglas transaccionales y auditar permisos en el backend.

## Estado de aceptación — auditoría 11/10/2026

La lectura del contrato no acredita su cumplimiento completo. S26 en
SOL-AUDIT-20261008.md reproduce la baja de reemplazo con cronómetro todavía
activo; la regla de detener relojes de cobertura afectados sigue pendiente de
corrección y regresión. Conservar el actor real, intervalo histórico, tarea y
motivo al corregirlo. Los traspasos y reasignaciones no habilitan backend remoto.
