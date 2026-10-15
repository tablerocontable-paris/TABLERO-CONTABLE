# Revisión independiente del candidato M2.2A-R6

Fecha: 15/10/2026. Candidato: `ebe16335b183d0df3f4ea0e643801f7f249970be`;
implementación SQL: `08b7405`. Resultado: **R6 original resuelto; M2.2A aún no
aceptado por dos incumplimientos acotados del contrato de validación previa**.

## R6 original

El mapa vacío de revisiones ya no permite registrar, parametrizar o evaluar.
El reproductor existente pasó nuevamente 30/30, incluidas entradas nulas y
recuperación desde SAVEPOINT. Se conservan los errores 40001 de revisiones
explícitas obsoletas. Las sondas previas pasaron 15/15 y las focales 17/17.
No se observó una escritura sin revisión ni un nuevo acceso indebido.

## M22A-R7 — P2: completar la validación de valores antes de locks/recibos

En `014:376` se adquiere el lock del recibo antes de extraer la revisión de
registro/tasa y la revisión de tarea de evaluación. Las extracciones siguen en
`014:430,453,475`; sólo la revisión propia de evaluación se valida antes.
Consecuencias reproducidas:

- Una revisión NULL enviada con un operationId ya existente devuelve 40001 por
  conflicto de recibo, en lugar del 22023 de entrada inválida.
- En PostgreSQL 17.11, una revisión NULL con el lock del recibo ocupado espera
  y termina con 55P03 al alcanzar el timeout, en lugar de rechazarla previamente.
- El cursor de activityPage y el cursor/límite de consultas no paginadas se
  validan después de `api_lock_task_scope` (`014:532,541,545`). Un cursor inválido
  también espera un lock de tarea ocupado y termina con 55P03.

Los controles sin competencia devuelven 22023 y el estado permanece intacto.
El defecto afecta el orden y la categoría de validación; no se demostró pérdida
de datos. Corregir parseando todos los valores y cursores antes de locks y
comparando las revisiones ya parseadas únicamente después de reautorizar y
adquirir los locks existentes. No adelantar la comparación con estado de DB.

## M22A-R8 — P2: conjunto esperado con un miembro NULL

`api_exact_keys` (`014:249–262`) devuelve TRUE para el objeto `{"a":1,"b":2}`
frente al conjunto esperado `array['a',NULL]`. `k = ANY(p_keys)` produce NULL
para la clave desconocida y `bool_and` omite ese NULL; el conteo coincide y la
función acepta el conjunto inválido. Se reprodujo en PGlite y PostgreSQL 17.11.

El contrato R6 exige FALSE para un conjunto esperado inválido. No se encontró
un caller público actual que aproveche este caso; el helper privado debe cerrar
esta condición antes de utilizarlo en los siguientes bloques.

## Corrección de evidencia de aislamiento

Las carpetas anteriores `cross-rc-rr` y `cross-rr-rc` de la implementación R6
contienen **RC/RC**, porque se usaron `--m2-2a-first`/`--m2-2a-second`, que el
runner ignora. Esas ejecuciones no prueban las parejas mixtas declaradas.

Se repitieron durante esta revisión con `--m2-2a-first-isolation` y
`--m2-2a-second-isolation`: **43/43 RC/RR y 43/43 RR/RC**. Los headers y los
resultados de replay/revocación reflejan las parejas reales. Esta evidencia
supera las dos etiquetas anteriores; los reportes históricos no se alteran.
El runner debe rechazar opciones desconocidas antes de levantar PostgreSQL.

## Evidencia y alcance

- Sonda nueva con sentinelas en funciones de fixture: **8/18**, diez casos
  documentan R7/R8. Los controles positivos alcanzan cada sentinel y restauran
  después las funciones originales. No se alteran migraciones de producto.
- Reproductor nativo: **3/6**, tres casos documentan los mismos defectos; ambos
  timeouts son reales con dos sesiones y barrera de disponibilidad del lock.
- Reproductor R6 existente 30/30; sondas previas 15/15; focales 17/17 y TypeScript
  pasan. ZIP/bundle coincide con manifiesto y candidato.
- La migración 014 conserva SHA-256
  `d0c4ebf747530529118af1c2525dec03e6d2f65d7dfbe46639a1ed8feaaa701e`.
  `git diff ebe1633 -- supabase/migrations src` está vacío. La suite 712/712 y
  builds corresponden a la implementación anterior del mismo producto; no se
  volvieron a ejecutar en esta revisión documental/de pruebas.

Evidencia: `review-evidence/m2-2a-r6-sol-review-20261015.json`. Todos los datos
son ficticios/locales. PostgreSQL quedó detenido. No se conectaron cuentas ni
se desplegó la migración. B/C siguen pendientes.

Siguiente: **GPT‑6 Luna, esfuerzo medio, Standard**, implementa
`M2-2A-PREFLIGHT-LUNA-20261015.md`. Después corresponde revisión independiente
de Sol alto. El ~45% sigue siendo una estimación histórica, sin recalcular.
