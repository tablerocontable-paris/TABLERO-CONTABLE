# Revisión del adaptador — 02/10/2026

Fuente: Sites v30, `723b0693079610bde0141c67e6dd8eb6a13796dc`.
Contrato revisado: DATA-ADAPTER-FOUNDATION.md.

**Resultado: aceptado tras corregir ADP-R01.** Puede avanzar el lector tipado
local bajo las políticas actuales. No habilita producción ni migración.

## Hallazgo y corrección

ADP-R01: taskInstanceSchema/taskTimeSessionSchema comparaban extremos con
Date.parse, que pierde dígitos menores a un milisegundo. Inicio
15:00:00.123456Z y fin 15:00:00.123455Z se aceptaban a pesar del intervalo negativo.
La prueba de regresión reprodujo el fallo antes de corregirlo (exit 1).

Ahora se valida y compara el segundo completo ajustado por zona y, si es igual,
la fracción original con precisión completa. No redondea, cambia o limita los
strings recibidos. Una prueba cubre tareas y sesiones: fin previo, offsets que
cruzan fecha, igualdad con ceros adicionales, avance de microsegundo, cruce de
segundo y época anterior a 1970. Pasó después de la corrección.

## Revisión del bloque

- Filas completas y metadata/nulos/snapshots preservados. UUID PostgreSQL y
  revisiones seguras; ningún mapeo a modelo local ni consulta al catálogo actual.
- Seis firmas exactas y validación runtime de kind/RPC/argumentos/operationId.
  Clonado y congelación protegen la intención; entradas extra de autoridad se
  rechazan antes de llamar. NULL/texto originales permanecen iguales en replay.
- Una llamada por execute y ACK discriminado sin inventar estado. Errores
  separados, genéricos, sin datos de excepción ni reintentos automáticos.
- Composición SQL con roles simulados, SQL fijo parametrizado y rollback por
  caso cubre los seis comandos, denegaciones, replay, revisión vieja y empresas.
- Checker BA contiene assertion de identidad dentro de B después de su login,
  motivo, una sesión cerrada, seed peer/op90 y wait boss/op1; replay intacto.

## Evidencia y límites

Antes de editar coincidían los 22 hashes de código/SQL, 2 logs y 8 archivos de
build del manifiesto de ejecución. Después de ADP-R01: 175 pruebas/15 archivos
y npm run build correctos. Checker 23 reutilizado: checker, fixture, escenarios
y SQL no cambiaron; no se repitió la prueba sin un riesgo nuevo.

Evidencia nueva: review-evidence/data-adapter-review-20261002.json y logs
review-tests/review-build/review-repro de la misma fecha. No se sobrescribió
la evidencia de ejecución anterior. Único cambio funcional: comparador temporal
del contrato; gateway, SQL, App/repositorio local y dependencias preservados.

PGlite/JSON SQL no verifican PostgREST, Auth/MFA/RLS productivos ni carreras en
PostgreSQL. Sigue faltando la administración y el acceso técnico global
autorizado; el lector no debe ampliar el rol auditor actual desde cliente.

## Próxima ejecución

GPT-6 Luna medio, Standard: DATA-READ-FOUNDATION.md define lecturas paginadas por
empresa/propietario/equipo, tarea por ID y sesiones, con validación y aceptación
local. Recarga confirmada tras RPC sin activar el frontend. Después Sol 6.1
medio revisa antes de diseñar el coordinador. Auth/administración => Sol alto.
