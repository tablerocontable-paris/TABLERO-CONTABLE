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

## Límites explícitos

No Auth real, correo, cuentas, conexiones nuevas ni API operativa. Los avisos
se guardan en paris-state-lab; no son entrega entre navegadores o dispositivos.
En producción los eventos y permisos deben validarse en servidor y guardarse
en la transacción del cambio, no aceptar destinatarios elegidos por el cliente.
El backend Worker/D1 existente no se modifica ni se anuncia como integrado.

El contrato admite «tarea conjunta activada» con destinatarios filtrados,
pero su disparador queda pendiente de completar la coordinación conjunta
en el recorrido funcional. No se presenta un evento simulado como coordinación
real ni se alteran cuotas/KPI para aparentar su cierre.

## Comprobación

Pruebas de destinatarios, persistencia, aislamiento, comentarios y contrato conjunto.
Chromium: escritorio/móvil, alineación de logo, campana, comentario a superior,
revisión de parámetros, recarga, campos y ausencia de API operativa/errores JS.
Suite completa y build se ejecutan antes de publicar el mismo Site privado.

## Continuidad

Se puede seguir cerrando contratos funcionales y QA con datos ficticios.
Conectar servicios sólo ante necesidad técnica concreta del proyecto; ninguna
conexión se necesita para estas correcciones. Avance global aproximado: 45%.

Resultado local: suite 339/339 (33 archivos), build y Chromium aprobados. Evidencia externa al código: outputs/pruebas-notificaciones.json y outputs/notificaciones-browser/.
