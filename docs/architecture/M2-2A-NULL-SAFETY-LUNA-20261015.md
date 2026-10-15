# M2.2A R6 — validación SQL de claves y revisiones

Implementación: **GPT‑6 Luna, esfuerzo medio, Standard**.
Leer `M2-2A-FINAL-REVIEW-20261015.md`, el contrato A y sus correcciones previas.
Es una corrección acotada del protocolo ya definido; no abre decisiones de B/C.

## Cambios autorizados

Modificar sólo 014 todavía local, pruebas/runners y documentación de este corte.
Conservar 001–013, DTO salvo defecto demostrado, UI, Worker y Site. No instalar
dependencias, conectar cuentas, desplegar ni alterar datos históricos.

1. `api_exact_keys` debe devolver siempre TRUE/FALSE, nunca NULL. Objeto vacío
   frente a claves obligatorias => FALSE. SQL NULL, JSON null, no objeto y
   conjunto de claves requerido inválido => FALSE. Conjunto vacío real frente
   a conjunto esperado vacío => TRUE si se admite ese caso interno. No utilizar
   una comparación de `array_agg` nullable como resultado sin resolver NULL.
2. En entradas públicas, rechazar cuando una comprobación de claves no sea TRUE.
   Auditar envelope, payload, expectedRevisions, filters y cursores. Validación
   de forma siempre antes de recibos/fences/escrituras de negocio.
3. Hacer NULL-safe los helpers de extracción (`api_text`, `api_date`, `api_uuid`,
   `api_expected`, `api_integer`). Tipo ausente, clave nula, SQL NULL o JSON null
   donde no se permite deben producir 22023 genérico, nunca devolver NULL ni
   llegar a una restricción NOT NULL. No usar STRICT como sustituto: retornaría
   NULL al recibir SQL NULL. Preservar la normalización y los rangos vigentes.
4. Las tres familias de comando deben validar el conjunto exacto de revisiones
   y sus valores obligatorios antes de ejecutar. Revisiones vacías, parciales,
   extra, null y de tipo incorrecto => 22023. Revisión explícita válida pero
   obsoleta => 40001. No tratar ausencia como 0 ni inferir una revisión actual.
5. Filtros/payload vacíos => 22023, incluido commandReceipt, que no debe devolver
   found:false para una operación no especificada. Forma inválida de rateHistory
   => 22023; permiso válido/denegado conserva su evaluación independiente.
6. Mantener la autorización de replay y consulta de recibos. No convertir
   errores de permisos, serialización o dependencias en éxito. Ningún arreglo
   de validación debe cambiar el orden de locks ya corregido.

## Pruebas y aceptación

- El reproductor independiente nuevo debe pasar **9/9** sin relajar sus
  expectativas. Añadir matriz de formas vacías/ausentes/null/tipos y valores de
  revisión para los tres comandos y consultas, con controles positivos.
- Capturar antes/después en cada comando inválido: actividad, revisiones de
  tarea, rates y assessment, auditoría, recibos, operation/month/rate fences.
  Ningún estado parcial debe cambiar tras 22023. Probar también un bloque
  transaccional que pueda seguir después de un SAVEPOINT fallido.
- Repetir el caso nativo de revisión vacía con una tarea ya avanzada: 22023,
  estados intactos. Comprobar que revisión obsoleta explícita sigue dando40001.
- Conservar 15/15 sondas anteriores y upgrade poblado sin cambios históricos.
- Revalidar la matriz nativa RC/RC y RR/RR completa y los dos cruces de
  replay/revocación; observar barreras/SQLSTATE/estado final, sin ocultar40P01.
- Suite completa, TypeScript, builds cliente/Worker, node --check y diff --check.
  Registrar comandos, exit codes y hashes actuales, sin atribuir resultados
  históricos al SQL corregido.
- Commit explícito sólo del alcance; bundle candidato verificado con clonación
  limpia y manifiesto. Las copias antiguas se conservan como históricas.
- Actualizar AGENTS, PROJECT-STATUS y EXECUTION-NEXT. Después **Sol alto,
  Standard** revisa el candidato; no iniciar B/C antes de aceptar A.

Comando del reproductor desde la raíz del repo:

```powershell
node tests/review/m2-2a-final-acceptance-review.mjs --output-dir ../../outputs/m2-2a-r6-validation-20261015/protocol
```
