# Contrato Sol — reautorización de replays legacy de cobertura

Fecha: 20/10/2026. Arquitectura: GPT-6.1 Sol alto. Implementación propuesta:
GPT-6 Luna medio. Alcance local sintético; aceptación independiente vuelve a
Sol. Este documento no modifica ni autoriza aplicar SQL014.

## 1. Baseline y decisión

HEAD auditado: `4f2900e5edae9fea1ee1a8bf141e22c2ab777c2a` (`origin/main`).
Árbol compartido: conservar el estado exacto al iniciar implementación y
registrarlo; existe un `.block` de test sin seguimiento ajeno a este contrato.
SQL014 checkout SHA-256: `19EC849B0397602B7DC03939539D37F0999FE808FD21A91B227E7767F4BF9FC3`.
Contrato/aceptación precedentes T permanecen como evidencia independiente.

Selecciono **C antes que A**: los dos supervisores de cobertura devuelven
recibos antes de exigir sesión privilegiada y revalidar ámbito. La aprobación
crea bindings de ocurrencias y reglas recurrentes; la cancelación puede cerrar
una familia de bindings y finalizar sesiones. Conviene cerrar esta autorización
antes de auditar el helper de ausencias, cuyos consumidores y efectos difieren.

Endpoints efectivos de SQL011:

| Función | Firma | Recibo y argumentos conservados |
|---|---|---|
| `public.approve_task_coverage_plan` | `(uuid,uuid) returns integer` | kind `approve_task_coverage`, `{plan}`; replay devuelve `result.count` |
| `public.cancel_task_coverage_binding` | `(uuid,text,uuid) returns void` | kind `cancel_task_coverage`, `{binding,reason}` con `reason` trim; replay devuelve vacío |

En ambos, el receipt lock y comparación de kind/argumentos anteceden al
`return` cached; la comprobación de sesión privilegiada y ámbito ocurre sólo
después. Esto deja una sospecha concreta de replay posterior a revocación,
desactivación, degradación de rol o pérdida de ámbito. Reproducir en baseline
antes de modificar SQL014. Si cualquiera ya deniega de forma correcta, no
alterar esa función sin volver a Sol.

## 2. Límites y contratos previos que se conservan

La modificación propuesta se limita a SQL014 y a estos dos wrappers, con un
helper readonly privado compartido sólo si simplifica la rama cached. No tocar
SQL001–013, `_get_mutation_receipt`, `_coordination_apply_task_control`, APIs,
UI, Worker, tablas, permisos generales ni servicios alojados. Mantener firmas,
grants, security definer/search_path, orden de receipt lock, kinds, objetos de
argumentos, retornos y semántica de primeras ejecuciones.

Conservar las comparaciones de kind/argumentos antes de reautorizar: conflicto
continúa dando `P0001` y el mensaje legacy
`Identificador de operación reutilizado con otros argumentos`, incluso si el
actor perdió acceso. No volver a ejecutar aprobación/cancelación ni consumir
otra vez el plan, la familia o sus precondiciones. Replay autorizado es readonly
y devuelve exactamente el resultado histórico, sin actualizar recibos,
bindings, sesiones, fences, auditoría, tareas o reportes.

Antes del retorno cached, exigir sesión privilegiada vigente y volver a validar
actor activo, organización y rol actual. Jefatura conserva su alcance dentro de
la organización; encargado debe seguir dentro del ámbito requerido por el plan
o binding, responsables/reemplazantes y empresas afectadas, usando las mismas
reglas de la primera ejecución. Una membresía o binding pasado no concede
ámbito permanente. Errores de autorización mantienen SQLSTATE y mensajes
legacy de la función donde sea viable; nunca devolver el resultado cached a
actor inactivo, degradado, sin MFA requerido o fuera de ámbito.

Releer bajo el protocolo de coordinación y comparar identidad/organización,
kind, argumentos y resultado íntegros contra el recibo auténtico original. Si
la fila o el alcance subyacente cambió durante el replay, abortar con conflicto
transitorio (`40001`) y no reparar ni escribir. No recalcular `count`, no
reinspeccionar condiciones ya consumidas para decidir si la operación inicial
habría sido válida hoy.

## 3. Reproducción roja obligatoria

Crear baseline PostgreSQL desde SQL001–014 del commit auditado; guardar blob Git
y hash exacto además del SHA del checkout. Fixtures independientes y sintéticos
por endpoint: jefatura activa AAL2, encargado autorizado AAL2, empresa/equipo,
plan sellado y binding real con sus recibos creados por las funciones públicas.
No insertar recibos a mano ni simular grants.

Para cada endpoint: ejecutar primera operación válida, capturar resultado y
estado confirmado completo; repetir misma operación/actor/UUID en una sesión
nueva, después de cada una de estas modificaciones realizadas por un flujo real:

1. perfil actor inactivo;
2. rol privilegiado degradado;
3. encargado pierde acceso al titular o a una empresa afectada;
4. sesión ya no satisface MFA/sesión privilegiada.

El rojo se confirma sólo si el baseline devuelve el recibo original pese a
alguna condición de autorización que la primera ejecución sí exige. Registrar
cada subcaso; no fabricar resultados. Conflicto de argumentos/kind debe seguir
siendo conflicto y no confundirse con el replay exacto. Si no se reproduce en
el endpoint, detener ese endpoint y pedir revisión Sol antes de editarlo.

## 4. Verdes secuenciales y efectos

Por endpoint, cubrir como mínimo:

- replay exacto inmediato autorizado: mismo retorno histórico e igualdad total
  de estado;
- replay autorizado después de cambios ajenos legítimos: respuesta histórica,
  sin escritura;
- los cuatro estados de autorización de la sección 3: denegación y estado
  idéntico al baseline de cada intento;
- argumento cambiado y kind distinto con recibo auténtico: conflicto legacy;
- retorno/cantidad original, incluidas cantidades de más de un binding y
  cancelación void, sin recalcular ni volver a cancelar;
- retry fresco tras restaurar autorización: readonly y retorno histórico.

Snapshot completo ordenado de recibos, planes/sellos/reglas/instancias,
bindings fuente e hijos, membresías, perfiles/roles, sesiones, tareas y
revisiones, fences, auditoría, cierres, actividad y demás colecciones tocables
por las funciones. Comparar antes/después de cada intento, sin joins que oculten
filas huérfanas. En replay denegado o autorizado, delta debe ser cero. La
cancelación original, en fixture distinto, debe conservar sus efectos
históricos: bindings cancelados, corte efectivo de sesiones, revisiones y
eventos exactamente una vez.

Registrar consultas de sesión (`auth.uid`, claims/AAL, PID, aislamiento y
snapshot), comandos efectivos, stdout/stderr, exit code, versiones y hashes en
manifiesto versionado. Evidencia roja y verde separada. No incluir secretos.

## 5. Concurrencia enfocada, sin duplicar matrices aceptadas

No repetir las matrices aceptadas de primera ejecución: cobertura contra
revocación/materialización, cancelación contra `onboarding.approve`, ni reglas
recurrentes vs materialización. La regresión completa existente tampoco
sustituye la prueba focal de los retornos cached.

Para el replay contra cambio de autorización concurrente, Sol exige primero una
sonda roja stale-RR por endpoint: el actor conserva snapshot previo a la pérdida
de permiso; un observador independiente confirma el cambio; el replay baseline
documenta resultado y estado. En la candidata, el replay stale debe abortar o
denegar según el protocolo probado, y un retry en snapshot fresco debe denegar.
Capturar blocker PID real si queda esperando; no usar sleeps como prueba.

No imponer de antemano una matriz de ocho carreras a dos efectos distintos. Si
los runners acreditan un único protocolo readonly compartido, Luna ejecutará la
matriz RC/RC, RC/RR, RR/RC y RR/RR, ambos ganadores, con el endpoint de
cancelación como representante y reintentos frescos, siempre que se pueda
probar un writer real que revoca el ámbito. Si los endpoints o locks no comparten
ese camino, detenerse y devolver a Sol el delta mínimo de concurrencia antes de
ampliar el runner. Cero deadlocks; rollback/retry exactos.

## 6. Regresión, no-go y gates

Sobre SQL candidata sin cambios posteriores, usar evidencia ya válida para el
mismo hash; tras cambiar sólo runners, regenerar/verificar sólo sus reportes y
manifiesto. Reejecutar matriz nativa `--review-matrix full --through-014 yes
--m2-2a-smoke yes --m2-2c-smoke yes`, suite, TSC, builds cliente/Worker,
sintaxis y diff-check sólo si se modifica SQL/producto o Sol encuentra impacto
en esos checks. No presentar las validaciones T como prueba de C.

No-go si falta rojo reproducible, una primera ejecución cambia, se fabrica un
recibo, se amplía permiso, el helper es invocable por clientes, el replay
escribe, falta snapshot, hay deadlock o el resultado queda fuera del contrato.
Sol revisa hashes exactos y acepta únicamente C.

Después de C, continuar A con contrato separado para `approve_employee_absence`
y `cancel_employee_absence`; no ampliar globalmente `_get_mutation_receipt`.
Luego resolver P como decisión de política y completar el cruce §9/Gate L.
SQL014 sigue local: no migrar remoto ni iniciar preflight alojado hasta cerrar
§9 y Gate L, revisar Data API/exposición y obtener aceptación Sol consolidada.
