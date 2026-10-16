# Corrección acotada de anotaciones y recorrido

Instrucciones aprobadas para **GPT 6 Luna, esfuerzo medio** sobre la versión 21.
Evidencia: `docs/architecture/REVIEW-ANNOTATIONS-TOUR-20261001.md`.
No añadir módulos nuevos ni conectar Supabase en esta parte.

## 1. Conversión transaccional local

- Una anotación se convierte en una tarea de una sola vez. Catálogo sigue
  disponible para usar un estándar vigente, pero la conversión no habilita
  recurrencias. Validar frequency=única también en el handler, no sólo el select.
- Calcular el período efectivo desde schedule.startDate, no desde el filtro
  mensual visible. Validar calendario, perfil, empresa, ámbito y cierre de ese
  período. Construir la asignación con startMonth coherente con esa fecha.
- Releer la anotación en el State actual: existe, pertenece al perfil activo y
  convertedTaskId es NULL. Una anotación ausente/ya convertida rechaza la acción
  con mensaje explícito y sin guardar datos parciales.
- Construir un único State nuevo con asignación y materialize del período
  efectivo. Exigir exactamente una tarjeta creada para esa asignación antes
  del commit. En ese mismo State guardar el ID real en convertedTaskId y
  conservar contenido, ID, propietario y createdAt originales. Sólo al
  completarse el commit se retira el recordatorio y se cierra el modal.
- Ante calendario inválido, cierre, pérdida de ámbito o fallo de persistencia,
  mantener nota/fecha, formulario, asignaciones, tareas, auditoría y KPI previos.
- Tras éxito mostrar el mes real de la tarjeta. El vínculo permite abrirla.
  Repetir el intento no crea otra asignación ni otra tarjeta.
- Con convertedTaskId no NULL, nunca mostrar editar/eliminar/reconvertir aunque
  falte la tarjeta. Mostrar estado «Tarea vinculada no disponible» sin borrar el
  vínculo. Copiar la fórmula sigue permitido.
- No reconstruir automáticamente anotaciones ya dañadas por AN-01. Una
  asignación histórica puede estar en un período cerrado; cualquier reparación
  de datos guardados requiere diagnóstico específico posterior.

## 2. Guardado y recordatorios

- onSave comunica éxito/fallo explícitamente. Limpiar el formulario y salir de
  edición sólo después de guardar con éxito. Si falla, conservar todos los
  campos y el ID editado para reintentar, con aviso visible.
- La validación de entrada rechaza títulos/contenidos vacíos y fechas inválidas.
  Tipo recordatorio requiere fecha; notas/fórmulas pueden tener fecha opcional.
  Cualquier anotación con fecha activa aparece como recordatorio al alcanzarla
  según dateART, sin depender del tipo. ConvertedTaskId excluye recordatorios.
- Usar la misma regla de recordatorios en Mi día y en Anotaciones. Fechas son
  días locales ART, sin inferir envío de avisos/correos ni automatización externa.
- Mantener separación por propietario en el perfil simulado y guardado local,
  la compatibilidad del payload v3 y el aviso de alcance de privacidad.
  Las notas personales no alteran auditoría operativa, KPIs o cierres.

## 3. Recorrido y legibilidad

- Mantener 7/9/11 pasos por rol, progreso por usuario/versión, pausa y reinicio
  después de completarlo. Validar/bordear índices enteros fuera de rango antes
  de acceder al array; datos corruptos no deben provocar un crash.
- En apertura manual, Siguiente y Listo, avanzar vista/coach/cierre sólo si se
  guardó el estado correspondiente. Al fallar conservar el paso y la vista.
- El inicio automático después de la inducción inicializa versión/avance y
  abre la página del primer paso coherentemente. Completar la inducción y sus
  asignaciones no debe repetirse para reiniciar el recorrido.
- Foco visible en búsqueda y textarea; controles habituales y recordatorios
  con texto de al menos 14px; contenido de notas legible, preferir 16px. Usar
  variables del tema y no introducir fondos fijos incompatibles con oscuro.
  Evitar desbordes de fórmulas largas en móvil. Con movimiento reducido desactivar
  transform del hover de la tarjeta nueva además de animation/transition.

## Aceptación requerida

Añadir pruebas de interacción integradas con App o con un helper compartido que
App use realmente, además de la verificación de formularios. Mockear persistencia
fallida y controlar la fecha; no hacer asserts incidentales sobre seed().tasks.

| Caso | Resultado exigido |
| --- | --- |
| Conversión mismo mes y mes siguiente | Una asignación, una tarjeta fechada, un vínculo real; texto íntegro; recordatorio retirado sólo al guardar. |
| Fecha del mes cerrado | Rechazo sin asignación, tarjeta, modificación de nota o auditoría. |
| Cancelar o fallar al guardar conversión | Formulario y nota disponibles; ninguna escritura parcial. |
| Repetir conversión | Sin duplicados; mensaje/vínculo existentes. |
| Estándar del catálogo | Nombre/pasos/peso estándar; frecuencia única también validada fuera del select. |
| Editar/crear con QuotaExceededError | Texto, tipo, fecha e ID editado intactos; reintento guarda una única nota. |
| Fecha y perfil | Recordatorio requiere fecha; notas/fórmulas fechadas generan aviso ART; otro perfil no muestra su contenido. |
| Vínculo sin tarjeta | Estado informativo; ninguna acción de nueva conversión/edición/eliminación. |
| Recorrido | 7/9/11; pausa y recarga retoman; terminar/reiniciar; inicio posinducción correcto. |
| Fallo de persistencia del recorrido | Vista y coach permanecen alineados, incluso al abrir/cerrar. |
| Compatibilidad | Payload v3 anterior conserva perfiles/asignaciones/tareas/KPI sin reset; índices corruptos se normalizan. |

Actualizar el documento de producto sólo con comportamiento implementado.
Registrar resultado real de pruebas y cualquier pendiente visual/real. Continuar
la parte SQL 008 según `docs/EXECUTION-NEXT.md` antes de pedir otro cambio de modelo.
