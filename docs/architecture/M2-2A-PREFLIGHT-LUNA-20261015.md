# Contrato final de prevalidación M2.2A — R7/R8

Implementación: **GPT‑6 Luna, esfuerzo medio, Standard**. Leer el informe
`M2-2A-R6-SOL-REVIEW-20261015.md`. Corrección acotada del contrato vigente; no
introduce arquitectura nueva. Base de revisión: `ebe1633` más esta documentación
y sus dos reproductores independientes.

## Producto autorizado

Modificar solamente 014 local, runners/pruebas y documentos del corte.
Conservar 001–013, DTO, UI, Worker y Site. No instalar dependencias ni conectar
cuentas. No desplegar ni iniciar B/C.

1. En el preflight de cada comando, después de validar claves/UUID, extraer y
   validar **todas** las revisiones requeridas con `api_expected` antes de
   `_coordination_receipt_lock`, consulta de recibos, fences o locks de negocio.
   Guardarlas en variables bigint. Incluye la revisión task de assess, además
   de assessment, y la revisión rate del scope elegido. Rechazar null, tipo
   incorrecto, cadena no canónica y overflow con 22023 aunque exista un recibo
   con el mismo operationId. No inferir valores ausentes.
2. Reusar esas variables en las comparaciones actuales después de adquirir
   locks y reautorizar. La comparación contra estado vigente sigue allí; una
   revisión bien formada pero obsoleta conserva 40001. Replay exacto con
   argumentos válidos conserva su reautorización y comportamiento vigente.
3. Completar el preflight de query antes de `api_revalidate_actor` y locks de
   scope: validar UUID/XOR de rateHistory, cursor NULL y límite 1 de las no
   paginadas, y decodificar/validar el cursor de activityPage/rateHistory.
   Comprobar claves exactas, kind, filtros ligados, fecha/versión e ID usando
   los helpers existentes. Conservar las variables parseadas para keyset;
   eliminar la decodificación tardía duplicada. Esta validación no consulta
   tareas, versiones ni membresías. Mantener la autorización tras los locks.
4. `api_exact_keys` debe rechazar conjuntos esperados que contengan NULL,
   además de conjunto SQL NULL, duplicados y los casos inválidos ya probados.
   Evitar que `bool_and` omita una comparación NULL. Conservar `{}` frente
   a conjunto vacío como TRUE y el resto del contrato R6.

## Runner y evidencia

- En `m2-1-native-review.mjs`, validar opciones antes de iniciar un cluster.
  Rechazar flags desconocidos, repetidos o sin valor. Admitir sólo las opciones
  existentes: `--pg-bin`, `--output-dir`, `--port`, `--candidate`,
  `--review-matrix`, `--through-014`, `--m2-2a-smoke`, `--m2-2a-independent`,
  `--m2-2a-isolation`, `--m2-2a-first-isolation`, `--m2-2a-second-isolation`.
  No aceptar silenciosamente las abreviaturas erróneas first/second.
- El reporte nativo debe identificar también el hash de 014 cuando la aplica,
  además del hash histórico de 013, y conservar las parejas efectivas.
- Agregar una comprobación acotada del CLI inválido que termine antes de crear
  directorios/cluster. No cambiar expectativas de las sondas de revisión para
  que acepten el comportamiento defectuoso.
- Las evidencias anteriores rotuladas mixtas R6 son históricas y efectivamente
  RC/RC. La revisión Sol las repitió correctamente y pasó ambas 43/43; usar las
  opciones completas y verificar headers + isolationPair en las futuras corridas.

## Aceptación obligatoria de la corrección

1. `m2-2a-r6-preflight-review.mjs`: **18/18**. Las entradas inválidas deben
   devolver 22023 antes de los sentinelas; los controles válidos deben alcanzarlos.
2. `m2-2a-r6-native-preflight-review.mjs`: **6/6** sobre cluster sintético
   recién migrado. Con locks ocupados, revisión/cursor malformados devuelven
   22023 en vez de 55P03; las transacciones válidas mantienen el orden de locks.
3. Conservar R6 30/30, sonda independiente R6 9/9, protocolo previo 15/15,
   focales y upgrades poblados. Capturar valores/epochs de fences y revisiones,
   no sólo cantidad de filas, al verificar que no haya estado parcial.
4. Repetir una vez las matrices nativas RC/RC y RR/RR completas, más ambos
   cruces de replay/revocación. Las opciones completas son:
   `--m2-2a-first-isolation rc --m2-2a-second-isolation rr` y su inversa.
   Verificar pareja efectiva y estado final en cada reporte.
5. Ejecutar una vez suite completa, TypeScript, builds cliente/Worker,
   `node --check` de los runners modificados y `git diff --check`.
6. Actualizar AGENTS/PROJECT-STATUS/EXECUTION-NEXT y evidencia con hashes del
   producto validado. Crear un único commit coherente con el hook habilitado.
   Guardar el resultado del hook y el commit final en el manifiesto externo
   posterior; evitar commits extra sólo para insertar el hash del propio commit.
7. Bundle y ZIP del commit final, con ramas main y migration/github-bootstrap:
   verificar SHA-256, extracción y clonación limpia. No empaquetar dependencias,
   estado de navegador ni secretos. Marcar pendiente la revisión Sol.

Tras completar este bloque, **Sol alto Standard** revisa la aceptación de A;
sólo después define B/C. No declarar aceptación integral de M2.2 ni avance de
infraestructura por estos ensayos locales.
