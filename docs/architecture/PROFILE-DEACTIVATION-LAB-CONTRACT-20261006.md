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
- `handoff_required`: trabajo con sesión, actividad o responsabilidad conjunta.
  No aparece la acción de reasignación directa; requiere un flujo de traspaso
  explícito que aún no está implementado.
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

## Verificación y límites

La suite cubre permisos de jefatura, motivo obligatorio, conservación de cierres,
pausa de recurrencias/relojes, priorización de tareas por traspaso, asignación
única de tareas futuras, protección contra duplicación y paso por la pantalla.
La persistencia continúa en `paris-state-lab` del navegador y no sincroniza
entre equipos. El contrato no prueba Auth, RLS ni el backend activo. El siguiente
bloque es diseñar e implementar el traspaso explícito de tareas iniciadas y la
resolución de pendientes de encargados con subordinados, antes de migrar esta
lógica al backend.
