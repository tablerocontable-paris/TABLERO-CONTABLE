# Revisión independiente de lector — v34

Fuente exacta: `16862eec715d81193c1b8a30403cae0288b8a326`. Se revisaron lector,
tests unitarios, composición SQL, helper AccountingLab y criterios de
DATA-READ-ACCEPTANCE-COMPLETION. Verificación nueva: 189 tests/17 archivos y build
correctos. La prueba de diagnóstico siguiente falla intencionalmente y no forma
parte de esa suite verde.

**Resultado: aceptación local pendiente de correcciones de evidencia.** La
ejecución anterior completó varios casos importantes; no demostró todavía toda
la matriz acordada. No se reprodujo una falla del lector que exponga datos: se
reprodujo un defecto del test y faltan criterios concretos. Mantener documento
anterior y JSON como evidencia histórica, sin modificar sus resultados.

| ID | Evidencia en v34 | Corrección acotada |
| --- | --- | --- |
| READ-I01 | En el caso de cobertura, después de afterDeniedRead=capture(), la última consulta corre como postgres. capture() llama admin(); el test no restaura peer. Además no existe una tarea de la otra empresa que esa assertion pretenda denegar | Restaurar actor antes de todo read y comprobar identidad. Crear tareas realmente existentes fuera de empresa/período autorizados y comprobar denegación durante cobertura, además de cancelación/historial |
| READ-I02 | La composición RPC sólo prueba checklist resultado. El caso de sesiones dice preservar metadata pero sólo compara id/instance_id. No hay comparación íntegra de sesión exitosa con microsegundos/metadata | Añadir operativa: último check no completa; comparar JSON real y fixture completo de sesiones exitosas, con precisión preservada |
| READ-I03 | Unitarias no prueban sesión fuera de instanceIds, página de sesiones exitosa con lookahead, data=null con error=null ni null indebido de entrada. findTask incompleta usa revision negativa, no ausencia de campo | Casos específicos con filas válidas salvo el defecto; paginación sesiones tres páginas exactas, fuera-de-lista, lookahead incompleto, null/data y campo requerido ausente |
| READ-I04 | Matriz JSON lista títulos de tests y booleans; no liga cada obligación omitida a assertion. EXECUTION-NEXT dice que Luna puede definir coordinador | Matriz criterio→test→assertion, declarar límites; Sol define arquitectura, Luna implementa contrato cerrado |

## Reproducción READ-I01

Copiar temporalmente tests/task-reader-sql.test.ts al mismo directorio y agregar
justo después del último capture del test de cobertura:

```ts
expect((await lab.first("select current_user role")).role).toBe("authenticated");
```

Ejecutar sólo el test «retains an executor» sobre la copia. Resultado reproducido:
esperado authenticated, recibido postgres. 1 failed, 5 skipped, 4.93 s. Log en
`review-evidence/data-read-independent-role-repro-20261002.txt`. La copia se
eliminó antes de ejecutar la suite original. Este hallazgo no demuestra un bypass
de RLS en producción; demuestra que esa assertion no comprueba RLS del peer.

## Contrato cerrado para la siguiente ejecución de tests

Modelo Luna medio, Standard. Modificar sólo tests/task-reader*.test.ts y evidencia
de esta corrección; src/data/remote/task-reader.ts sólo si un defecto dentro de su
contrato se reproduce y se justifica. Gateway, task-contract, helper, migraciones,
dependencias e historia anteriores congelados. Sin Auth/red/coordinador.

1. Durante cobertura vigente sellada company A y período actual: crear tarea A
   válida, B del mismo titular en otra empresa y C del mismo titular en período
   anterior. Corregir scheduled_on y rangos en fixtures según políticas actuales.
   Como peer leer A found, B/C unavailable; listTasks actual obtiene sólo A con
   ownerId; company B o período anterior vacío aunque las filas existan. Verificar
   current_user=authenticated y auth.uid()=peer antes de esas lecturas. Snapshots
   son administrativos: tras capture restaurar peer. Conservar inicio vía RPC,
   cancelación jefe, historial propio y exclusión de sesión ajena ya probados.
2. Operativa con checklist: start, marcar todos los controles vía gateway,
   recargar con reader y comprobar status sigue En curso, revisión exacta y
   checklist verdadero; no completar operativa por controles. Pausar vía gateway
   y recargar sesión cerrada; no recalcular estado desde ACK.
3. SQL fixture real con peso/versión/due null/checklist sin text: como admin sólo
   obtener JSON esperado antes de leer; actor autorizado explícito para reader.
   Comparar fila completa. Sesión histórica cerrada con timestamps .123456 y
   .654321: comparar JSON completo esperado y strings fraccionarios recibidos.
   No exigir metadata extra de columnas que la tabla no tiene; metadata adicional
   se demuestra en unidad con passthrough. No modificar esquema para el test.
4. Unidad: sesiones válidas a-f/mayúsculas, tres páginas limit1 y secuencia exacta,
   metadata y strings íntegros; fila de sesión fuera de instanceIds => protocol;
   lookahead sesión requerido ausente, orden/exceso inválidos; findTask requerido
   ausente; entradas period/instanceId/instanceIds/limit null no admitidos; data
   null/error null => protocol por los tres métodos, una llamada. No duplicar
   batería de esquemas o pruebas ya presentes.
5. Evidencia nueva criterion→test/assertion, hashes probados y base exacta; suite,
   build/diff-check; comparar fuentes congeladas. Si aparece defecto de política
   SQL, detener esa corrección y preparar reproducción para Sol alto, no cambiar
   política o eliminar criterios para pasar. Publicar y volver a Sol medio.

La UI puede corregirse en bloque A independiente: estas pruebas pendientes
bloquean integración remota, no mejoras de interfaz local. Después de aceptar
lector, Sol prepara contrato de coordinación asíncrona antes de Luna. Los nuevos
18 pedidos están en product/CORRECTIONS-20261002.md y no se incorporan
silenciosamente en las pruebas de las políticas actuales.
