# Completar 008 — contrato cerrado para Luna

**GPT-6 Luna, esfuerzo medio, Standard.** Fuente revisada:
`81148aa1343ecd4271159e7e8e20a86f3d9fd704`, Sites v24.
Este suplemento concreta `TIME-COVERAGE-008-ACCEPTANCE.md` y
`REVIEW-008-20261001.md`; no reemplaza sus reglas de atomicidad y permisos.

## 1. R008-01: validar el inicio después de locks

Completar `202610010008_time_coverage_finalization.sql` en su archivo actual:
no fue aplicada remotamente. Preservar 001–007, firmas/ACL y datos históricos.
No crear 009 ni hacer backfill. No tocar los diagnósticos congelados para que
parezcan verdes; añadir aceptación equivalente a los casos fallidos.

- En checklist, desde la fila bloqueada validar paso y normalizar `changes_check`.
  Recalcular updated, next_status y `actual_needs_start` con las mismas reglas
  usadas en el plan. Comparar con `needs_start` antes de expiraciones, escritura,
  auditoría o receipt. Una diferencia provoca conflicto y rollback íntegro.
- En transición comparar también `p_next='En curso' AND t.status='Pendiente'`
  recalculado con `needs_start` antes del no-op o escrituras.
- Mensaje concreto: «El plan de inicio cambió; vuelva a intentar». No adquirir
  locks adicionales fuera de orden para rescatar el plan.
- Conservar no-op real: un control ya igual guarda receipt con revisión actual,
  sin leer/tocar el origen. Comprobar revisión, permisos e identidad de destino.
- Repetir las inyecciones de revisión sólo en fixture transaccional, restauradas
  por rollback. No instrumentar funciones productivas ni presentar esto como
  carrera real. Una escritura interna que cambie estado/kind debe incrementar
  revisión cuando se implemente su RPC; esta defensa no la sustituye.

## 2. Aceptación SQL completa e independiente

Rehacer fixture de `tests/time-coverage-008.test.ts`: transacción con rollback por
caso o base descartable por caso. JWT sub/aal y rol explícitos; fecha ART.
Todo error esperado dentro de transacción usa savepoint. No alterar filas de
otros casos para poder elegir la fixture.

| Casos | Asserts concretos |
| --- | --- |
| No-op | Dos pasos: TRUE y FALSE; tarea Pendiente; otro reloj propio en mes cerrado. Estado/revisión/sesión/audit idénticos y un receipt. Cambio real que requiere origen cerrado falla sin efectos. |
| Espera vencida | Fin por fecha y por cancelación. Comparar session/executor/absence/start/end con fila real y at común; replay exacto y clave nueva no duplican; revisión única. |
| Origen/destino | Transición y checklist con cortes distintos; ambos eventos exactos, nuevo reloj sólo destino. Origen vencido sin reloj destino deja campos de reloj del evento destino NULL. |
| Rollback | Destino vencido seguido de origen vigente sin switch; revisión obsoleta y permiso retirado. Captura completa antes/después de tareas, sesiones, audits, reaperturas y receipts. |
| Sello y ámbito | FALSE niega RLS y todas las escrituras nuevas; TRUE autoriza sólo empresa/período. Fuera de rango, cancelado, suspendido y membresía retirada denegados. Acceso permanente y replay escalar exacto preservados. |
| Plan y pausa | Identidad de cinco RPCs; inyección de inicio fuera de plan en checklist/transición rechaza. Pausa propia ended tras cierre es no-op; abierta en mes cerrado falla; pausa propia suspendida/sin membresía sigue admitida; ajena denegada. |
| Regresiones | Conservar el resto de casos exigidos en E de TIME-COVERAGE-008-ACCEPTANCE.md, incluidos operativa sin autocompletar, NULL que desbloquea sin tocar clocks, DML/helper denegados y tiempos de aprobación/cancelación. |

Actualizar reportes con bases independientes, preferiblemente un archivo dedicado
con fixture nueva por caso. Si se extraen los cuatro casos de database.test.ts,
preservar su cobertura y actualizar el comando de aceptación actual; el runner
histórico de revisión documenta el SHA anterior y permanece intacto.

- Eliminar los UPDATE globales de status y verificar que el delivery reclamado
  tiene exactamente el ID propio. No manipular entregas ajenas.
- Cierre real con sesión cerrada fija de 1800 segundos dentro del período;
  actividad 7+11 facturas, meta 40. Assert de quantity=18 y target=40 en la tarea;
  metrics.operational=1 y operationalTarget=0 son conteos de tareas, no unidades.
- Fixture separada para bloqueo de cierre por reloj abierto y destinatario no
  verificado; ningún cierre/reporte/delivery/outbox parcial.
- Repetición exitosa preserva snapshot y UUID; uno de cada registro. Lease viejo
  denegado, retry limitado y total_attempts histórico con delivery propio.
- No cambiar tests 006 congelados: añadir en 008 el equivalente que compara
  ended_at del audit con la sesión real. Sustituir la aproximación temporal del
  reporte editable de database.test; no atribuir correo a una cola local.

## 3. Upgrade y abortos

Convertir a asserts en bases separadas: 0.3→001–008, 004→005–008, 005→006–008,
006→007–008 y 007→008. Capturar filas completas de sesiones/auditorías/
reaperturas/receipts, ausencia UUID/times/empresas autorizadas, snapshot::text e
identidad/estado delivery/outbox. Diferencia de columna de sello incorporada por
006 es permitida según su contrato; no alterar historia ni reconstruir empresas.
Actor legacy NULL y permisos actuales retirados no invalidan historia válida.

Abortos en bases nuevas: múltiples clocks en 004; sesión incompatible con
ausencia, inicio posterior al corte, reapertura huérfana y actor de otra org en
005/006. Assert de error e IDs, rollback de DDL/funciones y conservación de filas.
No omitirlos porque el upgrade feliz pasa. Usar los fixtures históricos como
referencia sin editar sus bytes; no instalar PostgreSQL.

## 4. Guía PostgreSQL ejecutable, sin ejecutarla

Completar `docs/ops/TIME-COVERAGE-VALIDATION.md` y fixture/script 008 si hace falta.
Usar un conjunto de host/puerto/usuario/base explícito tanto en createdb como en
psql. Sin contraseña ficticia ni secretos en documentación.

Para cada escenario del apartado F del contrato original: preparación de base
limpia, JWT/rol por terminal, BEGIN, llamada A/B, punto de espera, COMMIT/ROLLBACK
y DO/asserts que fallen. Ambos órdenes para inicio/inicio, switch/pausa,
cierre/inicio y switch, cancelación/inicio, retiro de permiso mientras espera,
vencimiento ART, empresa/sellado y replay. Consultas narrativas no sustituyen los
asserts. Mantener **NO EJECUTADO** hasta futuras conexiones PostgreSQL reales.

## 5. Cerrar aceptación frontend ya corregida

Sin nuevas funciones ni diseño: pruebas integradas del inicio automático tras
inducción con home distinto a Mi día (versión/progreso/vista coherentes y sin
asignaciones duplicadas); Listo/reinicio y fallos al abrir/cerrar recorrido;
QuotaExceededError al editar una nota existente conserva ID/campos y reintento
guarda una única nota. Sólo corregir una divergencia del contrato ya autorizado
si esos casos la reproducen; documentar QA visual pendiente.

## Entrega sin otro bloque intermedio

Completar todos los apartados en Luna medio. Casos críticos individuales deben
seleccionar y pasar realmente al menos una prueba, no sólo devolver exit 0.
Suite completa, build, diff-check; comparar archivos congelados con el SHA de
esta revisión. Registrar matriz cumplido/pendiente y comandos en
REVIEW-008-EXECUTION-20261001.md. Commit/push y Sites privado del mismo SHA.
Luego **GPT-6.1 Sol alto**, revisión final y cambio manual.

No crear cuentas/servicios, aplicar SQL remoto, migrar empleados, enviar correo
ni conectar el frontend a una base real. La próxima etapa de integración se
define después de aprobar este bloque.
