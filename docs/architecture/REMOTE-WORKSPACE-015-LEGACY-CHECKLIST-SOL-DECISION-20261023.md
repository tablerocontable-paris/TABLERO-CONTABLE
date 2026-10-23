# Decisión pendiente — controles históricos fuera de los límites de workspacePage

Fecha: 23/10/2026. Estado: **requiere contrato Sol; no habilita SQL ni cambia la aceptación vigente**.

## Invariante actual

El contrato aceptado para `workspacePage` establece un DTO exacto con hasta 100
controles y textos de 1 a 1.000 caracteres. La migración 015 no trunca ni omite
controles: si una tarea histórica excede esos límites o tiene una forma inválida,
rechaza esa lectura con un error descriptivo. La prueba local cubre 101 controles
y un texto de 1.001 caracteres. Esto conserva los datos, pero puede impedir que
se renderice la página que incluya esa tarea. Se registra como limitación abierta,
no como solución final del producto.

## Propuesta para un contrato posterior

Solicitar a GPT-6.1 Sol un contrato adicional antes de modificar el DTO aceptado:

1. Mantener la tarjeta `workspacePage` acotada e incluir un marcador explícito
   `checklistState: "complete" | "requires_detail"` y el total de controles. No
   presentar una lista parcial como completa.
2. Añadir un kind de lectura paginada `taskChecklistPage`, con tamaño limitado,
   cursor propio y revalidación de `can_access_instance`, organización, actor y
   permisos de consulta. Debe devolver todos los controles originales en páginas,
   incluidos textos largos, sin cambiar sus IDs, texto ni estado.
3. Si un control individual excede el límite de transporte acordado, devolverlo
   en segmentos UTF-8 con cursor/offset verificable, o acordar un límite global
   de detalle y un error por control que identifique la revisión manual requerida.
   Nunca truncar ni reemplazar el texto almacenado.
4. Acordar límites máximos de elementos, tamaño total de respuesta, longitud de
   texto y costo antes de implementar; probar 101 controles, texto de 1.001
   caracteres, límite de bytes, cursores y revocación de permisos.

La propuesta cambia el DTO exacto y el contrato de lectura; no se considera
aceptada por esta nota. Hasta contar con un artefacto Sol que identifique el
contrato y hash exactos, SQL015 debe conservar el rechazo descriptivo y no
aplicarse a Supabase.
