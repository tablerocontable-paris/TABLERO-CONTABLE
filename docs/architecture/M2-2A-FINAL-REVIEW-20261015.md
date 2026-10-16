# Revisión independiente del candidato M2.2A — 15/10/2026

Resultado: **NO aceptado**. Implementación `9c096973c21fe56fdb91ac0ba4e54ec0f8232649`,
estado documental `4597e748f795d5ffeda287bb8cd8e6a2c6d0419c`.
Se revisaron SQL 014, DTO y contrato, y se ejecutaron sondas nuevas contra el
producto comprometido. No se modificaron SQL, DTO, UI, Worker ni 001–013.

## M22A-R6 — P1: revisiones vacías permiten escribir sin control de concurrencia

`app_private.api_exact_keys('{}'::jsonb, ARRAY['clave'])` devuelve SQL NULL:
`array_agg` sobre cero claves es NULL. `IF NOT NULL` no rechaza. A continuación,
`api_expected` tampoco rechaza la clave ausente y retorna NULL; comparar la
revisión real con ese NULL deja pasar el comando.

Reproducción: enviar un envelope válido de `operation.record`, `operation.rate`
o `operation.assess` con `expectedRevisions: {}`. El decoder rechaza los tres,
pero SQL devuelve éxito y confirma sus cambios. Un cliente puede omitir la
precondición de revisión sin violar permisos de actor; dos acciones pueden
aplicarse aunque el cliente no haya leído el estado vigente.

- PGlite: registro con revisión inicial 0 deja revisión 1, un movimiento y un
  recibo; coeficiente y evaluación también se guardan con revisiones vacías.
- PostgreSQL 17.11 nativo: registro autenticado de empleado sobre una tarea en
  revisión **5** devuelve éxito; deja revisión **6**, movimientos **4→5** y un
  recibo nuevo. Se ejecutó dentro de una transacción que terminó en ROLLBACK.
- Control positivo: una revisión actual explícita funciona; una revisión
  explícita obsoleta devuelve 40001. El defecto está en aceptar su ausencia.

La misma raíz permite filtros vacíos: `commandReceipt` devuelve `found:false`
en vez de 22023; `operationalSummary` y payload vacío terminan en 42501 en vez
del error de protocolo. Se incluyen en R6 por compartir la causa.

Ubicación principal: SQL 014 líneas 249–255 (`api_exact_keys`), 296–304
(`api_expected`) y validaciones de revisión en los tres comandos.
La corrección R3 anterior ya exigía comprobar que las claves exactas fueran
TRUE; la implementación quedó incompleta para el caso de cero claves.

## Evidencia y alcance

- Matriz nativa RR completa reejecutada: **61/61**, incluidas carreras con
  bloqueos observados, autorización, cierres, coberturas y replay; exit 0.
- Sondas anteriores R1–R5/protocolo/upgrade: **15/15**; exit 0.
- Pruebas focales SQL/DTO: **17/17 en 2 archivos**; exit 0.
- Sonda nueva de aceptación: **3/9**; seis fallos corresponden a R6 y sus
  variantes de protocolo. Exit 1 acredita hallazgos, no fallo de instalación.
- Sonda nativa adicional: exit 0 de psql significa que la escritura inválida
  fue aceptada; **no** significa aceptación funcional.
- Suite 712/712 y builds son evidencia anterior cuyo producto SQL/DTO conserva
  los mismos hashes. No se repitieron en esta revisión porque no se cambió
  producto. Una suite verde no cubre el caso nuevo de objetos vacíos.

Resultados, comandos, hashes y salida nativa:
`review-evidence/m2-2a-final-acceptance-20261015.json`.
Reproductor: `tests/review/m2-2a-final-acceptance-review.mjs`.

Los bundles de `9c096973` y `4597e74` siguen siendo copias reproducibles del
candidato, ahora con defecto conocido. No se consideran versión final aceptada.
No se conectaron cuentas ni se desplegó 014. M2.2B/C y M2.3 continúan pendientes.
Avance global ~45% histórico, sin recalcular por esta revisión.

Siguiente: **GPT‑6 Luna, esfuerzo medio, Standard**, contrato
`M2-2A-NULL-SAFETY-LUNA-20261015.md`; luego revisión **Sol alto, Standard**.
