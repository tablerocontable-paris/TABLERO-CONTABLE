# Implementación local: checklist remoto paginado — SQL015

Fecha: 23/10/2026.
Contrato de trabajo: `REMOTE-WORKSPACE-CHECKLIST-PAGING-SOL-PROPOSAL-20261023.md`,
SHA-256 `34C7A45A02100E28617E5E180753472F148E6E1D96152003A9757DF61128E36D`.
Estado: implementado localmente; falta revisión Sol del código y del hash exacto.

## Alcance implementado

- `workspacePageV2` y `taskChecklistPage` se agregaron como kinds nuevos a
  SQL015. `workspacePage` v1 mantiene su request, respuesta y ruta delegada a
  SQL014. SQL001–014 no se modificaron.
- V2 conserva cantidad, estado y controles representables completos. Checklist
  extenso se clasifica para lectura paginada; anomalías de hasta 100 controles
  quedan para revisión. Una anomalía no bloquea otras tareas. No se trunca ni
  reescribe el JSONB histórico.
- El detalle normaliza sólo la forma de lectura, conserva orden y duplicados y
  segmenta texto por puntos de código Unicode. Los cursores usan el próximo
  ordinal/offset canónico, ligan sujeto/tarea/revisión, y se reautorizan en cada
  solicitud. La reconstrucción de prueba conserva texto, ID, done e incidencias.
- Zod y TypeScript validan requests, DTO, relaciones de segmentos y el límite
  de 65.536 bytes medido sobre el envelope JSON completo. El SQL verifica el
  tamaño JSON UTF-8 final y falla con error técnico estable si no cabe.
- SQL014 ya incrementa `state_revision` en las rutas autorizadas de control; la
  prueba verifica la edición reviewed. SQL015 agrega un trigger defensivo que
  incrementa exactamente una vez sólo si una modificación de checklist no
  avanzó la revisión. Los roles de aplicación no tienen UPDATE directo.

## Validación

PGlite ejecuta la migración real y las pruebas cubren compatibilidad v1,
clasificación 0/100/101, anomalías y límites, campos privados, Unicode,
límites de piezas, cursores malformados y válidos, revisión/cambio, revocación
entre páginas y ámbitos de jefe/encargado. La prueba de envolvente con escapes
produce 53.935 bytes frente al máximo de 65.536. El caso de 2.000 tareas con
checklist de 10.000 controles y texto de 1 Mi puntos registró en la corrida
focal V2 532 ms y detalle primera/siguiente página 17/14 ms (11.274/11.292
bytes). En la corrida completa el smoke V2 registró 880 ms y detalle 26/19 ms
(11.274/11.292 bytes); variación local esperable.

Suite completa: 782/782 pruebas en 79 archivos. El archivo focal SQL015 pasó
18/18; el guard de migraciones pasó 4/4; el caso legacy de checklist verifica
que las rutas ordinary/reviewed incrementan una vez. TypeScript, build del
cliente, build del Worker y `git diff --check` terminaron con exit 0. El cliente
emitió sólo advertencias de comentarios PURE de la dependencia Zod.

Estos números son de Windows x64, Node 24.19.0 y PGlite con datos sintéticos;
no son una medición de Supabase ni un compromiso de latencia. El
`EXPLAIN ANALYZE BUFFERS` disponible cubre sólo el selector, no el RPC entero.
No demuestra comportamiento de hosting, concurrencia real ni navegador.

La aceptación Sol del código SQL015 aún no existe. No se aplicó migración
remota, no se usaron credenciales, no se desplegó y no se conectó la UI. El
workflow continúa separado y falla cerrado hasta la aceptación del hash exacto.
El manifiesto complementario registra hashes y comandos de la validación
vigente: `review-evidence/workspace-checklist-paging-015-luna-20261023.json`.
