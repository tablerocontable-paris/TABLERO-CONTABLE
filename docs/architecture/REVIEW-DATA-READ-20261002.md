# Revisión del lector — 02/10/2026

Fuente: Sites v32, `0a73c2ed1407746ae01eafcd9298aa9ba0f53449`.
Contrato: DATA-READ-FOUNDATION.md. **Aceptación pendiente por cobertura incompleta.**
El siguiente bloque es DATA-READ-ACCEPTANCE-COMPLETION.md, Luna medio, Standard.
No avanzar al coordinador antes de completar y revisar esta aceptación.

## Resultado y hallazgos

El código revisado implementa entradas strict, un transporte inyectado, consultas
congeladas, límites, validación de todas las filas incluido lookahead, filtros y
orden UUID normalizado. Preserva nulos y metadatos; unavailable no distingue falta
de permiso de inexistencia. No se encontró en esta lectura una falla funcional
reproducida de esas reglas. Esto no certifica los escenarios que faltan.

| ID | Hallazgo | Resolución requerida |
| --- | --- | --- |
| READ-R01 | Las dos pruebas SQL sólo leen como empleado. No ejercitan encargado/jefe/otro org, cobertura/cancelación, sesiones históricas sin padre visible, ni lecturas posteriores a RPC/switch. La aceptación 1, 3, 4 y 6 del contrato no está demostrada. | Completar la matriz con el lector real bajo authenticated y snapshots de no mutación; no sustituirlo por getters administrativos. |
| READ-R02 | Unitarias parciales: faltan límites 100, query completa/defaults de los tres métodos, clonación de instanceIds, cursor <= afterId, exceso de filas, findTask incorrecto/excesivo, y varios errores por método. Los UUID de la prueba de mayúsculas sólo tienen cifras; toUpperCase no modifica el valor y no prueba case. | Casos mínimos con UUID que contengan a-f, filas válidas y adversarias, límites y queries congeladas completas. |
| READ-R03 | La tabla del contrato enumera table, pero TaskReadQuery sólo declara kind. SQL de prueba resuelve tablas desde kind, sin interpolación; no se observó un acceso arbitrario. La representación pública quedó menos explícita que el contrato. | Incorporar table como literal fijo por variante, construido internamente; el llamador sigue sin poder elegir tabla. |
| READ-R04 | AGENTS.md seguía ordenando ejecutar el lector y EXECUTION-NEXT lo declaraba completado. El cierre anterior no distinguió implementación de aceptación completa. | Actualizar instrucciones vigentes y estado: implementado, pendiente de completar aceptación. No convertir pruebas verdes en aprobación automática. |

La prueba SQL de dos páginas sí demuestra paginación dentro de una empresa. No
demuestra aún un recorrido completo sin filtro sobre tres o más tareas de dos
empresas. Una prueba genérica de transporte no prueba por sí sola la lectura
confirmada después de una operación ambigua o de un switch.

## Coherencia del producto

LEGACY-RECOVERY.md registra ideas recuperadas y decisiones nuevas; declara que no
se copiaron migraciones/componentes legacy. Hay funciones útiles todavía
pendientes de recuperar. La demo local y el SQL nuevo están separados hasta
integrarlos. Las ocho migraciones del proyecto nuevo documentan sus propias
correcciones y upgrades; no se aplicaron a Supabase remoto. La cantidad de
migraciones no garantiza calidad: importan compatibilidad, reglas y aceptación.

La nueva solicitud de presencia es compatible con cronómetro y cuenta técnica:
son datos distintos. Presencia tendrá señales de sesión autenticada, el reloj
registra intervalos de tarea y la cuenta técnica queda fuera de métricas del
personal. No hay presencia real implementada ni debe inferirse desde el reloj.
Reglas de coherencia vigentes: ../product/CONSISTENCY-RULES.md.

## Evidencia y límites

Reejecución sobre esta fuente: 182 pruebas en 17 archivos y build correctos.
Código de lector, pruebas, gateway, SQL, frontend y dependencias permanecen sin
cambios durante esta revisión. Evidencia nueva:
review-evidence/data-read-review-20261002.json. La evidencia anterior se preserva.

No se verificaron Auth/PostgREST/MFA, RLS productivo, concurrencia PostgreSQL,
correo, presencia ni comportamiento compartido de empleados. Avance estimado
se mantiene en 40%, sin habilitar migración. Ninguna promesa de cero errores.

## Próxima ejecución

Luna medio, Standard: completar READ-R01–03 con el contrato cerrado adjunto.
Después Sol 6.1 medio revisa resultados y define el coordinador. Auth,
administración y presencia con nuevas políticas requieren Sol 6.1 alto en su fase.
