# Hallazgo Gate L: replay de onboarding después de revocación

Estado: defecto confirmado en SQL014 y corregido en el candidato local posterior
a R90. La regresión nativa y Vitest pasan con la corrección. Sol aceptó el
cambio sólo para estos casos de replay, y quedó comprometido localmente.
SQL014 no se aplicó a Supabase remoto
ni a otra base persistente.

## Reproducción nativa

Comando ejecutado desde `work/site`:

```powershell
node tests/review/m2-1-native-review.mjs --pg-bin ../pg-runtime/pgsql/bin --output-dir outputs/m2-2c-gatel-replay-20261017-r2 --port 55622 --through-014 yes --m2-2a-smoke yes --m2-2c-smoke yes
```

El runner crea un cluster PostgreSQL 17.11 descartable en loopback y usa JWT
sintéticos. Fixture: owner empleado sintético `...000390`, empresa/equipo de la
fixture C, borrador v2 de una línea con origen catálogo vigente y calendario
mensual. El empleado guarda el draft con operationId `...000392`, lo envía con
`...000393`; ambos comandos terminan en `00000`. Luego el jefe AAL2 revoca la
membresía con operationId `...000395` en Read Committed y confirma la
transacción. Antes de los replays, la fila pasa de `active=true, revision=0` a
`active=false, revision=1`; la solicitud sigue `submitted`, no tiene activación
ni asignaciones.

Con el mismo JWT del empleado (aún válido) y argumentos/operationId idénticos,
el runner reintenta cada comando en una llamada nueva autocommit/Read Committed:

| Operación exacta | Esperado | Observado |
| --- | --- | --- |
| `onboarding.saveDraft` (`...000392`) | SQLSTATE `42501` | `42501` |
| `onboarding.submit` (`...000393`) | SQLSTATE `42501` | `00000`; devuelve el recibo previo |
| Solicitud después del replay | Sin mutación ni activación | `submitted`, activaciones `0`, assignments `0` |

Reporte completo: `outputs/m2-2c-gatel-replay-20261017-r2/review.json`.
PostgreSQL reportó 129 casos, 128 aprobados y 1 fallido; `40P01=0`. El fallo es
el caso de replay indicado, no una caída del harness. SHA-256 de SQL014 en esa
ejecución: `3ff379002c37c43fb8c91d2b41bd47658d73d0386b2c5bc1518f22c6b4cc86c6`.

Reproducción Vitest: `node_modules/.bin/vitest run
tests/m2-2c-contract.test.ts --maxWorkers=1 --testTimeout=20000`. En el árbol
anterior a la corrección SQL: 11 tests, 10 pasaron y el regresivo falló porque
el replay no lanzó excepción (la respuesta fue exitosa). El test nativo y
Vitest conservan la expectativa `42501`.

## Causa y cambio mínimo propuesto

`app_private.api_onboarding_command` valida el estado de perfil antes de buscar
el recibo. Para `saveDraft`, también verifica la membresía de empresa/equipo
derivada de las líneas del payload antes de entrar en el camino de replay. Para
`submit`, carga y valida el request/draft antes del recibo, pero la comprobación
de membresía de cada empresa/equipo está después del `if existing.actor_id` que
retorna el recibo exacto. Así un submit previamente emitido permite replay tras
revocar la membresía, mientras que saveDraft rechaza el mismo escenario.

Corrección local implementada: después de adquirir los locks 1102/1103/1105,
`submit` relee la solicitud con `SELECT ... FOR UPDATE`; justo antes del retorno
del recibo se reautoriza con las líneas vigentes de esa solicitud. La
membresía de empresa y la pertenencia al equipo se leen con `FOR SHARE`: bajo
RC se usa y protege la fila actual; si una revocación ya cambió la fila después
del snapshot RR, el lock de fila fuerza `40001` en vez de aceptar el snapshot
obsoleto. Para una primera ejecución, el guard original permanece restaurado
después del segundo `SELECT ... FOR UPDATE` del request y antes de insertar la
versión. `saveDraft` también revalida y bloquea membresías antes del recibo.
No se cambió el orden de advisory namespaces ni el receipt identity, esquema,
001–013 o contrato esperado.

## Revalidación local posterior

En el primer follow-up, SQL014 completó 129/129 y Vitest 11/11, pero Sol señaló
que la revalidación de submit usaba el draft leído antes de locks y que se había
quitado el guard posterior a `FOR UPDATE`. Ese candidato fue rechazado y no se
acepta como resultado final. La corrección anterior a esta nota conserva ese
guard y añade relectura/locks frescos.

La reejecución con hash SQL014
`13e88c8549f969187294367161c3ce6cf458d7f4618ddba40cb5058254982a26` completó
PostgreSQL 17.11 **130/130**, `40P01=0`. Replays exactos tras revocación:
saveDraft `42501`, submit `42501`. Carrera primera-submit: espera bloqueada,
snapshot RR obsoleto `40001`, retry fresco `42501`; estado final `false|1|draft|0|0`
(membresía/revisión, solicitud, versiones, recibos). La prueba focal Vitest
completó **11/11**. La evidencia y hashes de esta reejecución están en
`review-evidence/m2-2c-gatel-onboarding-replay-20261017.json`.

Esta evidencia no cierra la matriz completa de replay/revocación: sólo prueba
saveDraft y submit exactos después de una revocación ya confirmada. Tampoco
cubre races de writers legacy, coverage recurrente ni todas las familias de
concurrencia/rollback de §9.

Validación final del candidato corregido: comando nativo `node tests/review/m2-1-native-review.mjs --pg-bin ../pg-runtime/pgsql/bin --output-dir outputs/m2-2c-gatel-locked-20261017-r2 --port 55625 --through-014 yes --m2-2a-smoke yes --m2-2c-smoke yes`; reporte `outputs/m2-2c-gatel-locked-20261017-r2/review.json`. Suite Vitest 727/727 en 74 archivos; `tsc --noEmit`, build cliente y build Worker finalizaron con código 0; `node --check` y `git diff --check` finalizaron con código 0. Las migraciones 001–013 no tienen diferencias contra HEAD.
