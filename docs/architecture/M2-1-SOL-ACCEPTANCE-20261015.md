# Aceptación independiente local de M2.1

Fecha de revisión: 15/10/2026. Fuente de producto: `a93f7d084b8f802499965df8b8677a59fedac364`
(implementación en `5125d7e412985ef2f2a17bb37a0231d7ef19f4bf`).
Resultado: **M2.1 aceptado en su alcance local**. No se encontraron defectos de
producto adicionales. La aceptación no acredita Supabase alojado, Auth real,
MFA real, configuración de esquemas expuestos ni despliegue.

## Hallazgos anteriores resueltos

| Hallazgo                 | Decisión comprobada                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| R1: AAL ausente/null     | Guard explícito; ausente/null/vacío/desconocido denegados para negocio y técnico.                |
| R2: identidad simultánea | Fence transaccional escrito después del lock1110; conflictos 23514/40001 y rollback íntegro.     |
| R3: duplicado inactivo   | Se cuentan ambas tablas sin filtrar active; los cuatro estados activo/inactivo se deniegan.      |
| R4: espacios invisibles  | Normalizador SQL usa el conjunto completo de String.trim; nombres válidos pasan el decoder real. |

Los esquemas internos continúan sin acceso cliente/servicio, con RLS y helpers
sin EXECUTE PUBLIC. `api.get_context_v1()` sigue devolviendo únicamente el
contexto propio y capabilities vacío. Rol, actividad y membresías se leen de DB;
metadata del JWT no otorga jefatura. La cuenta técnica no obtiene perfil contable.

## Evidencia de esta revisión

- Runner existente sobre013 real: **24/24**, salida0.
- Matriz ampliada `--review-matrix full`: **42/42**, salida0. Incluye
  INSERT/UPDATE y UPDATE/UPDATE con el actualizador esperando, RC/RR en ambos
  órdenes, bloqueo observado mediante pg_blocking_pids y rollback de la primera
  sesión. Se conserva exactamente un principal; el perdedor conserva su UUID y
  el fence del ganador no retiene incrementos abortados. No40P01.
- Vitest focal: **27/27 en3 archivos**, salida0; cinco comprobaciones independientes
  nuevas cubren todas las tablas públicas durante upgrade, snapshots literales
  de cierres/reportes, 25 caracteres de whitespace, U+0085 conservado, nombres
  técnicos200/201 Unicode, ACL/defaults y JWT sin refrescar al inactivar.
- TypeScript y git diff --check: salida0.
- La revisión no modificó `src` ni `supabase`. Se conservan la suite completa
  **690/690 en69 archivos** y build cliente/Worker del corte implementado; no se
  repitieron porque el producto coincide. No se afirma una nueva suite695 completa.

Se cerraron brechas de evidencia mediante pruebas independientes; no fue necesario
modificar el producto. El upgrade nuevo exige familias no vacías y compara todas
las tablas públicas obtenidas del catálogo, incluyendo asignaciones, identidades,
membresías y configuración, además del historial de trabajo. Las funciones SQL
antiguas y los archivos001–012 conservan sus bytes.

Motor: PostgreSQL17.11 portable, cluster nuevo y descartable,127.0.0.1:55439,
tres conexiones psql y claims sintéticos. El proceso se detuvo al finalizar.
Resultados: `review-evidence/m2-1-independent-acceptance-20261015.json` y
`../../outputs/m2-1-sol-acceptance-20261015/native-full/review.json` desde la raíz.
SHA256013 sin normalizar saltos: `d013b82bfa1101ed11a35daeaf7a64b2e6063da9c09b55e7586ce67cc586bac2`.

## Siguiente bloque

M2.2 continúa reservado a014. Se desglosa en A (protocolo y operativas), B
(seguimiento/dependencias) y C (creación/inducción/catálogo sin metas). Esto permite
revisar las incompatibilidades reales del contrato antiguo sin declarar paridad
antes de implementarla. Sólo A queda ejecutable ahora mediante
`M2-2A-OPERATIVE-API-LUNA-20261015.md`. B/C necesitan contrato posterior;014 no se
despliega mientras esté incompleto y015/M2.3 espera la aceptación total de M2.2.

El avance global ~45% es histórico y orientativo. Esta aceptación cierra una
fundación local del backend; aún quedan implementación del resto de módulos,
aceptación humana, cuentas propias y entrega automática probada.

Fuentes primarias para el mecanismo de concurrencia:
[aislamiento PostgreSQL17](https://www.postgresql.org/docs/17/transaction-iso.html),
[locks PostgreSQL17](https://www.postgresql.org/docs/17/explicit-locking.html).
Los resultados anteriores provienen de las pruebas del repositorio.
