# Reparación acotada A — seguimiento de la revisión v39

Modelo de ejecución: **GPT-6 Luna, esfuerzo medio, Standard**.
Base: código v39 `cfe05f7ea4f613f27e9c5f99a0061f0ad63ae801`.
Contexto: `../architecture/REVIEW-V39-INDEPENDENT-20261002.md`.
Conservar íntegros los criterios de `CORRECTIONS-UI-A-REPAIR-20261002.md`.

## Alcance cerrado

Editar App, estilos, una constante de recorrido compartida si hace falta y tests
UI. Actualizar documentación y publicar por Sites. No modificar SQL 001–008,
gateway/lector, helper AccountingLab, dependencias, contratos remotos o métricas.
No conectar servicios ni migrar empleados. No delegar ni simular otro modelo.

### 1. Avatares uniformes

En `.org-manager`, reemplazar el ícono `GitBranch` por el mismo
`<span className="avatar">{ini(nameOf(t.managerId))}</span>` usado en el resto.
Aplicar a todos los encargados; mantener cargo y equipo en texto. Reutilizar
estilos de avatar claro/oscuro, sin reglas por nombre. Quitar importación sólo
si no se usa en otro lugar. No renombrar perfiles ni resetear localStorage.
Comprobar LF con un fixture Lucía Fernández y las iniciales del encargado del
seed actual; jefe y empleados mantienen su presentación.

### 2. Destinos reales del recorrido

Conectar `.spotlight` al encabezado, CTA Nueva tarea, cronómetro y controles,
además de los destinos ya implementados. La selección depende del selector del
paso, sin índices literales. Una sola instancia resaltada: el primer destino
visible y utilizable de la página actual. Si la columna está plegada, el destino
no se considera utilizable. No desplegar columnas ni abrir tareas automáticamente.

Resolver el destino tras el render de página/paso, usando refs o un efecto
centralizado; no decidir la ausencia consultando el DOM anterior durante render.
Eliminar el resaltado al pausar/finalizar y al cambiar actor. Si falta el destino
(tablero vacío, filtro sin resultados o columnas plegadas), resaltar `.heading`
y agregar una frase breve al coach que explique la ausencia. Al quitar el filtro
o desplegar la columna, resolver de nuevo el destino. No resaltar otro módulo.

Mantener 11/14/16 pasos y los permisos por rol. Conservar la persistencia de
Anterior/Siguiente/Listo antes del cambio visible y el reinicio de versiones
2/3. Crear una constante v4 accesible tanto al recorrido como a
`finishOnboarding`; no dejar un segundo literal de versión.

### 3. Cursor legible de gráficos

En ambos Tooltip de barras, usar `fillOpacity: 0.12` para el cursor y conservar
el borde del tema con `strokeOpacity: 0.55`. No aplicar opacidad al tooltip ni a
la barra activa. Preservar variables de barras, maxBarSize 28/22, nombres,
porcentajes/puntos, tablas y callbacks por persona/equipo/sector. No cambiar datos
para lograr una apariencia distinta. Verificar claro/oscuro y viewport móvil en
preview soportado; registrar el bloqueo exacto si el entorno no lo permite.

## Comprobaciones de aceptación

- Llevar a la suite normal los probes v39 de spotlight, alternativa, avatar,
  Anterior fallido y actor distinto del titular. Los ocho anteriores deben pasar.
- Recorrer los 11 pasos de empleado; repetir secuencia y rol de encargado/jefe.
  En cada paso activo hay exactamente un resaltado o la alternativa explícita.
  Probar cambio de página, tablero vacío, filtro sin resultados y columna
  plegada; tras pausar no hay resaltados. No introducir un test estático que
  simplemente busque una llamada a isTourSpotlight en la fuente.
- Comprobar propiedades reales recibidas por Tooltip o SVG renderizado para
  cursor tenue y tooltip opaco. Prueba de interacción existente debe conservar
  equipo/sector en análisis y persona en su tablero; no basta mockear todo
  Recharts a null para afirmar aceptación de gráficos.
- Ejecutar suite completa, build y diff check; registrar cantidades reales.
  Verificar los 17 hashes congelados de v39; no volver a ejecutar todo el lector
  si sigue idéntico. Mantener evidencia histórica sin editar sus resultados.
- Commit/push y deploy privado exacto por Sites; comprobar estado terminal y
  audiencia. No declarar terminado hasta esa comprobación.
- Actualizar AGENTS, EXECUTION-NEXT, PROJECT-STATUS, PRODUCT-ROADMAP y
  WORKFLOW-MODELS: siguiente modelo Sol medio para aceptación independiente.
  Avance sigue 40% estimado; migración no habilitada.

Si aparece una decisión de datos o permisos, detener ese alcance y volver a Sol.
Después de aceptar esta reparación, Sol alto define contratos B/C; no anticiparlos.
