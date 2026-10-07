# Correcciones de marca y notificaciones — 06/10/2026

## Alcance implementado en laboratorio

- Logo completo, discretamente mayor, sin «Espacio contable» y centrado sobre
  el selector de empresas. Sin scroll independiente del menú.
- Campana en encabezado para todos los perfiles. Lectura individual persistente,
  acceso a la tarea y pendientes de parametrización dentro de la bandeja del jefe.
- Avisos generados por cambios efectivos: asignación, finalización, modificación,
  comentario de tarea y registro/anotación de actividad. Sin mensajes al autor,
  sin duplicación al cambiar perfil o leer y sin avisos de anotaciones personales.
- Destinatarios: responsable, superiores y cobertura vigente autorizada,
  según acceso a empresa/tarea. El aviso deja de verse si pierde acceso.
- Comentarios de tarea separados de las anotaciones privadas; sólo laboratorio.
- Retirado el cartel explicativo de actividad operativa. Cabecera compacta;
  «Vista de prueba» reemplaza el título técnico y sólo existe en laboratorio.
- Paneles no recortan foco de campos; controles móviles adaptados al ancho.
- Entregables movibles entre Pendiente/En curso/Completada por arrastre, con
  inserción antes/después de tarjeta, animación y acceso de teclado. La operación
  usa la transición existente: iniciar abre el reloj del actor; terminar valida
  checklist/esperas y detiene su tiempo. Orden manual persiste tras recargar.

## Límites explícitos

No Auth real, correo, cuentas, conexiones nuevas ni API operativa. Los avisos
se guardan en paris-state-lab; no son entrega entre navegadores o dispositivos.
En producción los eventos y permisos deben validarse en servidor y guardarse
en la transacción del cambio, no aceptar destinatarios elegidos por el cliente.
El backend Worker/D1 existente no se modifica ni se anuncia como integrado.

«Tarea conjunta activada» se genera desde el cambio efectivo de responsabilidad
en el recorrido de laboratorio. El flujo de interfaz quedó verificado de punta
a punta: una persona incorporada recibe un aviso, lo abre hacia la tarea y la
lectura persiste al recargar. Los destinatarios siguen filtrados por acceso y
empresa; el actor no recibe su propio aviso. Esto no representa entrega remota ni
habilita coordinación entre dispositivos.

## Comprobación

Pruebas de destinatarios, persistencia, aislamiento, comentarios y contrato conjunto.
Chromium: escritorio/móvil, alineación de logo, campana, comentario a superior,
revisión de parámetros, recarga, campos y ausencia de API operativa/errores JS.
Suite completa y build se ejecutan antes de publicar el mismo Site privado.

## Verificación posterior — 07/10/2026

La aceptación de activación conjunta quedó extendida para comprobar exactamente
un aviso por cada otra persona autorizada, acceso desde la campana, apertura de
la tarea y persistencia del estado leído tras recargar. El componente común de
diálogos ahora enlaza cada título con `aria-labelledby`, para que el nombre del
diálogo se exponga a tecnologías de asistencia. Ver
`docs/architecture/review-evidence/joint-notification-lab-20261007.json`.

La entrega local continúa en `paris-state-lab`. No se implementó correo,
notificación del sistema operativo ni sincronización entre dispositivos; eso
requiere identidad y permisos de servidor revisados antes de integrar el
backend.

## Continuidad

Se puede seguir cerrando contratos funcionales y QA con datos ficticios.
Conectar servicios sólo ante necesidad técnica concreta del proyecto; ninguna
conexión se necesita para estas correcciones. Avance global aproximado: 45%.

Resultado local: suite 339/339 (33 archivos), build y Chromium aprobados. Evidencia externa al código: outputs/pruebas-notificaciones.json y outputs/notificaciones-browser/.
