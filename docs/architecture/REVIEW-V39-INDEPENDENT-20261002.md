# Revisión independiente — Sites v39

Aplicación revisada: `cfe05f7ea4f613f27e9c5f99a0061f0ad63ae801`.
Checkout documental: `98127385cf6cae756b1b5718d5caa0154229767d`.
Resultado: **A parcialmente conforme; requiere una reparación acotada**.
Esta revisión no cambia aplicación, SQL ni permisos. Avance estimado: 40%.

## Comprobaciones ejecutadas

Se copiaron los ocho probes independientes de v37 y se añadieron ocho
comprobaciones de recorrido, actor y avatar. Resultado: **10 aprobaciones y
6 fallas en 16 comprobaciones**. Las copias de diagnóstico están fuera de la
suite normal; no se presentan como una ejecución verde.

| Comprobación | Resultado |
| --- | --- |
| A-R01–08 / A-P05 históricos | Las ocho pasan: primera fila de inducción, meta editable, responsable consultado, Mi día consultado, selector limitado, limpieza de detalle, nota multilineal y conversión inválida sin guardado parcial |
| Nuevo A-R09 | Anterior con fallo de persistencia conserva página, paso mostrado y avance almacenado |
| Nuevo A-R10 | El encargado inicia una tarea del empleado: titular e0 permanece y sesión/auditoría atribuyen la acción a m1 |
| A-R11-heading/create/timer/controls | Cuatro fallas: los destinos existen, pero no tienen un ancestro con `.spotlight` |
| A-R12 | Tablero vacío no resalta el encabezado como alternativa al cronómetro ausente |
| A-R13 | Encargado del organigrama no usa el avatar circular con iniciales |

Los identificadores de la ampliación pertenecen al probe v39; no sustituyen los
IDs homónimos de las tablas históricas de v37.

## Hallazgos de fuente

1. `isTourSpotlight` sólo se conecta a navegación, ambiente, filtros y orden.
   Encabezado, Nueva tarea, cronómetro y controles no aplican la clase. La
   alternativa tampoco se conecta al encabezado. Consultar el DOM durante
   render puede observar la página anterior; resolver destino después del render.
2. Versión del recorrido: start/avance usan `tourVersion`, pero
   `finishOnboarding` persiste un literal `4`. Falta una constante compartida.
3. Los dos cursores de gráficos usan colores sólidos (`#667085` / `#ffffff`)
   sin `fillOpacity`. Sigue pendiente el criterio de relleno tenue. Se verificó
   la configuración; no se afirma aceptación visual del hover.
4. `.org-manager` renderiza `GitBranch`, mientras jefe y empleados renderizan
   `.avatar` con `ini(nombre)`. La captura del usuario confirma esa diferencia
   en Lucía Fernández. Es una decisión visual por rol, no una imagen fallida.
   Unificar avatar en todos los encargados; preservar nombres guardados y roles.
   El seed actual usa Carolina Díaz, pero datos locales anteriores pueden
   conservar Lucía; no se debe renombrar un perfil para corregir su avatar.

Las variables de barras logradas/pendientes, anchuras máximas y tooltip temático
están presentes. La aceptación visual completa de claro/oscuro/móvil sigue
pendiente. No se repitió ni se eludió el preview bloqueado anteriormente con
`net::ERR_BLOCKED_BY_CLIENT`. La captura aportada sólo cubre el organigrama.

## Evidencia y límites

- `review-evidence/ui-a-v39.probe.tsx`, JSON y log homónimos del 02/10.
- `review-evidence/v39-independent-manifest-20261002.json`: 17 fuentes congeladas
  idénticas a v37; incluye SQL, lector, gateway, dependencias y helper.
- La suite de implementación anterior tiene 202 pruebas/17 archivos y build
  aprobado. No se repitió completa: la aplicación no cambió en esta revisión.
- Get Site confirmó v39 activa, audiencia restringida y 0 visitantes externos.
- El lector conserva aceptación local; no se revisó de nuevo toda su capa.
- No habilita Auth, datos compartidos, presencia, correo ni migración.

Reproducción: copiar `review-evidence/ui-a-v39.probe.tsx` a
`tests/ui-a-v39-independent.test.tsx`, ejecutar
`npx vitest run tests/ui-a-v39-independent.test.tsx`, retirar la copia temporal.
Las fallas esperadas describen la fuente v39, no una suite productiva verde.

## Próximo paso

**GPT-6 Luna, medio, Standard**, contrato
`../product/CORRECTIONS-UI-A-FOLLOWUP-20261002.md`. Después revisión Sol medio.
Servidor B/C sólo se diseña con Sol alto al aceptar A.
