# Completar aceptación del lector — instrucciones para Luna

**GPT-6 Luna, esfuerzo medio, Standard.** Fuente revisada: v32,
`0a73c2ed1407746ae01eafcd9298aa9ba0f53449`, más el commit de revisión. Usar
REVIEW-DATA-READ-20261002.md y DATA-READ-FOUNDATION.md. Sin decisiones abiertas.

## Alcance

Completar pruebas del lector y la representación fija de tabla. No modificar
gateway, esquemas de filas, SQL 001–008, App, repositorio local ni dependencias.
No activar red, Auth, coordinador, presencia ni servicios. Conservar evidencia
histórica y aislamiento BEGIN/ROLLBACK. Si una prueba reproduce un defecto fuera
de este alcance, guardar evidencia y volver a Sol; no ampliar reglas desde tests.

## READ-R03 — query explícita

Agregar a TaskReadQuery y a las queries construidas internamente:

| kind | table literal |
| --- | --- |
| taskPage | task_instances |
| taskById | task_instances |
| sessionPage | task_time_sessions |

El input continúa strict y no acepta table. Transporte de tests usa SQL literal
por kind y valida su table fija; no interpolar tabla/proyección/SQL. Mantener
queries readonly congeladas y una llamada por método. Puede quitarse hasMore
interno no usado en validPage, sin modificar las respuestas públicas.

## READ-R02 — unitarias suficientes

Ampliar pruebas existentes sin repetir la batería de esquemas de filas:

1. Queries completas/defaults de los tres métodos; limit 1 y 100 (take 2/101),
   rechazo 0/101/fracciones, período inválido o distinto de día 1, UUID inválido,
   campos extra de autoridad y null indebido. No read ante validación fallida.
2. instanceIds 1..100, array vacío/101/repetidos con UUID a-f en distinto case;
   copia y freeze del array/query; input no modificado y su mutación posterior no
   modifica query. Case real en filtros/ID/cursores, conservando texto devuelto.
3. Página vacía y terminal; tres páginas limit=1 con lookahead correcto y mismo
   ID en la siguiente página; filas duplicadas/desordenadas, <= afterId, >take,
   período/filtros incorrectos y sesión fuera de lista. Validar lookahead completo.
4. findTask: vacío/found, ID distinto, fila incompleta y dos filas => protocol.
   Metadata/nulos/checklist sin text y precisión temporal original preservados.
5. Errores de envelope/data, server y excepción de transporte; por cada método
   comprobar clasificación, mensajes genéricos, una llamada sin retry. Fallos no
   mutan inputs. Usar filas válidas salvo el defecto puntual de cada caso.

## READ-R01 — composición SQL bajo permisos existentes

Reusar AccountingLab. SELECT to_jsonb(row), ORDER BY id ASC, todos los filtros,
cursor y take parametrizados, allowlist literal. Antes de cada read/RPC activar
authenticated del actor explícito. Admin prepara fixtures/captura auditoría;
capture devuelve a admin: restaurar actor antes de cualquier lectura posterior.
Para errores SQL deliberados usar savepoint y rollback para no dejar la
transacción de test abortada. No reutilizar getters administrativos como lector.

1. Fixtures con tareas de owner, peer y sourceOwner, ambas empresas. Empleado
   sólo propio trabajo; encargado sólo jerarquía vigente y empresas autorizadas;
   jefe su organización; outsider otra organización no las ve. Consultar
   ownerId/companyId ajenos no amplía visibilidad. Retirar jerarquía/membresía en
   fixture y recargar para demostrar aplicación actual de RLS, sin tocar políticas.
2. Tres o más tareas con mismo título/banco en dos empresas. Recorrer limit=1
   hasta hasMore=false con límite defensivo en test; comparar IDs exactos sin
   duplicar/saltar. Probar companyId concreto y null. No generar totales/KPI.
3. Cobertura aprobada/sellada: sólo empresas/período autorizados. Iniciar sesión
   por RPC como reemplazante; cancelar como jefe; findTask unavailable para el
   reemplazante. listSessions conserva su sesión histórica permitida, no expone
   sesiones de otros ni fabrica una tarea. Fixtures deben coincidir con fechas de
   cobertura: usar lab.day/lab.period y scheduled_on válido, no un mes artificial.
4. Componer createTaskGateway existente y lector. start/checklist/transition
   retornan ACK: recargar findTask/listSessions y comparar estado/revisión reales.
   Checklist de resultado y operativa conservan su semántica SQL vigente.
   Switch de tarea A a B: recargar ambas, verificar revisiones, fin de sesión A
   y sesión abierta B con su ejecutor. No deducir estado desde ACK. Sin diseñar
   coordinador ni reintentos automáticos en este bloque.
5. Leer JSON real con versión nullable, peso snapshot, due_date null, checklist
   sin text y metadata adicional disponible; preservar timestamps íntegros. No
   reemplazar con catálogo actual ni Task local.
6. Fallos/denegaciones de lectura no escriben: comparar snapshots de DB
   antes/después. Harness con conteo de read verifica una llamada. Inexistente y
   no visible tienen idéntica respuesta unavailable.

## Cierre

Revisar que todos los apartados estén demostrados por assertions concretas, no
por cantidad de tests. npm test, npm run build, diff-check. Evidencia nueva con
SHA base, hashes de fuentes realmente probadas y matriz caso→prueba. Verificar
archivos congelados sin diff, commit/push, deploy privado del mismo SHA. Actualizar
EXECUTION-NEXT/AGENTS/PROJECT-STATUS a revisión Sol medio; no declarar aprobación
antes de esa revisión. No migrar empleados ni ejecutar PostgreSQL --run.
