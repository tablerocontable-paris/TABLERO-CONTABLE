# Aceptación humana con lector de pantalla — laboratorio

Estado: pendiente. Esta guía concreta el gate de etapa 5 de
SOL-LUNA-CONTRACTS-20261011.md (S38/S56 y foco visible). Una prueba DOM o una
captura no acredita lo que oye y puede operar una persona con lector de pantalla.

Se confirmó que C:\Windows\System32\Narrator.exe existe en esta PC. Abrir
Narrador desde Inicio y utilizar Edge. No instalar dependencias ni conectar
cuentas. Usar datos ficticios del laboratorio; no probar en el espacio operativo.

## Abrir la versión que fue revisada

Desde la carpeta work/site ejecutar la vista previa del build ya generado:

```powershell
node node_modules/vite/bin/vite.js preview --outDir dist/client --host 127.0.0.1 --port 8091 --strictPort
```

Abrir http://127.0.0.1:8091 en Edge. El Site publicado puede contener un corte
anterior; este recorrido requiere la versión local revisada. Detener la vista
previa con Ctrl+C al finalizar.

## Recorrido y resultado esperado

| Caso | Acción con teclado y lector | Resultado esperado |
|---|---|---|
| R1 Inicio y menú | Elegir actor empleado desde controles de laboratorio y recorrer menú con Tab | Nombre/rol y sección identificables; nombres de botones comprensibles; foco visible |
| R2 Búsqueda | Abrir Buscar, escribir parte de una tarea, mover selección y abrir; repetir y salir con Escape | Resultados y selección anunciados; se abre la tarea correcta; Escape devuelve foco al disparador |
| R3 Recorrido | Abrir guía, avanzar una vez y volver con Anterior; recorrer Tab/Shift+Tab, pausar y reabrir; salir con Escape | Título y avance entendibles; al volver al primer paso foco en Siguiente; Anterior deshabilitado se salta; cierre devuelve foco al origen |
| R4 Diálogo | Abrir detalle de tarea, recorrer controles, cerrar | Título del diálogo anunciado; controles con nombres; foco vuelve a un control visible |
| R5 Tableros simultáneos | Como reemplazo autorizado, abrir tareas propias y cubiertas; plegar una columna en cada tablero | El lector distingue qué tablero/columna se controla; plegados independientes; botones anuncian expandido/plegado aun con columnas vacías |
| R6 Movimiento | En una tarea ficticia ejecutable, usar Alt y flechas según ayuda del tablero | Cambio de columna/estado comprensible; foco sigue en la tarjeta; responsable y actor conservan su identidad |
| R7 Selector y paneles | Recorrer selector de personas y abrir/cerrar un panel largo | Opción activa/seleccionada reconocible; nombres de personas/equipos entendibles; panel conserva título y estado expandido/plegado |
| R8 Calendario y campana | Navegar días con flechas y meses con PageUp/PageDown; abrir agenda y notificación | Fecha elegida, controles y destino reconocibles; salida conserva foco; no se anuncia contenido privado de otro empleado |

Registrar cada caso como Pasa/Falla/Pendiente. Si una funcionalidad no tiene
datos ficticios adecuados, queda Pendiente, no Pasa. Una falla debe indicar
actor, módulo, pasos, frase anunciada y resultado esperado. No se requiere
grabar audio ni entregar datos personales.

## Registro para completar

Fecha: pendiente. Windows/Edge/Narrador: pendiente. Persona que revisó: pendiente.

| Caso | Resultado | Observación |
|---|---|---|
| R1 | Pendiente | |
| R2 | Pendiente | |
| R3 | Pendiente | |
| R4 | Pendiente | |
| R5 | Pendiente | |
| R6 | Pendiente | |
| R7 | Pendiente | |
| R8 | Pendiente | |

No marcar etapa 5 aceptada hasta completar los casos pertinentes. El asistente
puede acompañar y registrar las observaciones; no debe simular aceptación humana.
