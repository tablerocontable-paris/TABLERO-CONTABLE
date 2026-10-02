# Reparación cerrada del bloque A — 02/10/2026

**Estado:** implementada en código local con 202 pruebas/17 archivos y build
correctos; pendiente publicación privada y aceptación independiente de Sol 6.1
medio. Se conserva este contrato como criterio de revisión.

**Modelo: GPT-6 Luna, esfuerzo medio, Standard.** Base revisada:
`f6c019ada555f5ea76dcdfa78f60162f0710eac1` (Sites v38). Leer AGENTS, el contrato
A1–A8 original y REVIEW-V37-INDEPENDENT.
Este documento cierra decisiones de corrección; no inicia los bloques B/C/D.

## Límites

Modificar App, componentes de A, estilos, seed y tests focalizados. Puede
extraerse un helper pequeño de validación/selección. No modificar contratos
remotos, lector/gateway, helper AccountingLab, SQL 001–008, dependencias ni
reglas de métricas. No Auth, red, correo, cuentas ni migración. Preservar estado
guardado, anotaciones y cierres. No corregir pruebas eliminando obligaciones.

## 1. Editor de controles y metas — A-R01/R02/R08

- Onboarding mantiene string[] como buffer visual: agregar primer paso vacío
  muestra fila y permite escribir; añadir/quitar/Enter conserva las otras filas.
  Inicializar desde customSteps al montar y vaciar buffer al agregar la tarea
  particular. Persistir join en la frontera vigente; customTasks.steps sigue
  string. No cambiar representación persistida ni aprobación de inducción.
- Validar al guardar todos los límites (50 pasos, trim, 1..300 por paso no vacío).
  Filas vacías se omiten. Un paso demasiado largo o exceso de pasos informa
  error; no truncar texto ni descartar controles silenciosamente. No lanzar
  errores sin capturar durante render. NewTask, CatalogueCreator y tareas
  particulares deben aplicar la misma regla; conversión conserva nota original,
  borrador y ningún vínculo/asignación parcial si se rechaza.
- Tarea puntual sin controles muestra mensaje explícito de que se crea sin
  checklist. Catálogo conserva controles de sólo lectura. Pasos materializados
  nacen done=false. Probar cambio de catálogo sin arrastre de filas.
- Meta de operativa se toma del formulario editable, con validación 1..1000000;
  catálogo define unidad, peso, tipo, sector y pasos. Guardar meta 321 debe dar
  asignación y ocurrencia target=321 sin modificar template.target=120.

## 2. Perfil consultado, actor y cobertura — A-R03/R04/R06/R10

- Nueva tarea en páginas personales inicia responsable=viewedOwner autorizado.
  Fuera de ellas usa selección de supervisión válida o active.id. Conversión
  desde anotaciones propias inicia responsable=active.id. No cambiar actor ni
  permisos actuales; opciones siguen canSee/people.
- Mi día usa el mismo ámbito consultado para prioridades que tablero/operativas;
  no aplicar después ownerId===active.id a esas tarjetas. Si se consultó otro
  perfil, mostrar su nombre para evitar que la cabecera sugiera trabajo propio.
  Anotaciones y avisos personales siguen siendo del actor, claramente rotulados;
  Ir a mis tareas debe volver explícitamente boardOwner=active.id.
- Cambio exitoso de perfil demo limpia query/company/team/sector, detalle,
  logFor, modal y noteToTask; vuelve a su propio boardOwner. Si persistir falla
  no cambiar el contexto visible. Renderizar detalle/registro sólo si canWork
  autoriza al actor actual. No ocultar el selector del empleado: la única opción
  propia cumple A6. Al consultar subordinado conservar actor en audit/sesiones.
- Particionar tarjetas propias y cobertura en bloques separados en tablero y
  operativas, incluidos modos board/list. Bloque Tareas que cubrís identifica
  titular y reutiliza la misma task.id y acciones. Nunca duplicar Task/Assignment
  ni ampliar política de cobertura o acceso al perfil completo. En filtros y
  agregados cada ocurrencia sigue contándose una vez; no modificar fórmulas KPI.
- Limpiar filtros conserva perfil consultado. Volver a mis tareas lo cambia
  explícitamente. Click de persona en análisis/estructura conserva este flujo;
  equipos/sectores siguen en análisis.

## 3. Anotaciones — A-R07 y evidencia de recarga

Resumen de dos líneas; Leer completo/Mostrar menos disponible para cualquier
contenido (no depender de length>100). Mantener acciones y teclado accesibles,
controles regulares de 14 px mínimo. No cambiar categoría libre ni kind interno.
Comprobar nota multilineal corta y texto largo, guardar/editar/buscar/filtrar,
fallo de save conserva borrador, categoría nueva después de unmount+load+remount
y notas antiguas sin category. Mantener conversión/privacidad de pruebas previas.

## 4. Gráficos — A-R09

Definir --chart-muted en claro y oscuro, distinguible de --chart-ink. Mantener
cursor tenue/borde, tooltip opaco del tema, puntos/% y nombres completos;
maxBarSize 28 apilado/22 horizontal. Conservar alternativa tabular. Probar que
clic equipo/sector filtra análisis y persona abre su perfil; no alterar datos.
QA visual en preview si infraestructura permite, incluido móvil; si bloquea,
documentar bloqueo exacto sin fingir revisión visual ni modificar el entorno
de navegador para evadirlo.

## 5. Tour — A-R11

Secuencia de once temas: día, ambiente, perfil, columnas/orden, crear/checklist,
reloj iniciar/pausar, controles/finalizar, operativas, vencimientos, cobertura,
anotaciones. Encargado +análisis/estructura/cierre=14; jefe +catálogo/admin=16.
Eliminar regreso redundante. Selector/spotlight depende del paso actual, nunca
tourStep===índice literal. Usar objetivos presentes o fallback explícito cuando
no hay tareas; el paso de perfil del empleado explica su espacio propio.

**Nueva versión 4**, porque la secuencia publicada v3 cambia. Constante compartida
para inicio, guardar y finishOnboarding; avances v2/v3 reinician, v4 reanuda.
Anterior/Siguiente/fin sólo cambian página/progreso tras commit exitoso. Añadir
fallo de guardar Anterior: página y progreso persistido permanecen; pausa/retomar
y navegación por los tres roles. Empleado nunca visita closing.

## 6. Acciones, cierre y detalles faltantes — A-R12/R13

- modal close requiere manager, responsable activo y canSee; mismo guard visible
  del page closing y validación closeMonth. Resetear modal al cambiar actor.
  No implementar rechazo de pendientes/excepciones del bloque B ahora.
- Nueva tarea también en planning; sigue ausente en notas/ausencias/cierre/
  estructura/catálogo. Conservar acciones propias de esos módulos.
- Workspace muestra contador de ocurrencias del período/selección visibles
  (filtered.length, cada task.id una vez) y empresa elegida. Ambos selectores
  comparten company y conjunto de empresas autorizadas, sin estado paralelo.
- Seed nuevo usa Equipo de Carolina Díaz / Equipo de Martín Acosta, mismos
  t1/t2 y relaciones. No cambiar datos cargados del usuario ni inventar jerarquía
  real restante. Sector sigue independiente de equipo.

## 7. Tests, entrega y siguiente revisión

1. Incorporar regresiones significativas para las siete fallas reproducidas,
   adaptadas al comportamiento correcto de límites de pasos, sin copiar toda la
   suite de diagnóstico. A-P05 ya cumple y debe conservarse.
2. Incorporar las dos pruebas de reader-v37.probe.ts a task-reader.test.ts y las
   assertions añadidas de cobertura/rol a su test SQL existente. No duplicar la
   copia SQL completa. Producción/helper/SQL deben conservar hashes del manifest.
3. Verificar checklist catálogo/puntual, cobertura separada y sin duplicación,
   actor de acción distinto de perfil consultado, company sync y estados
   independientes para el mismo banco en dos empresas. No escribir snapshots CSS.
4. npm test completo, build y diff-check; registrar números reales. Si hay un
   defecto nuevo fuera de este contrato, reproducir y volver a Sol, no ampliar
   SQL o permisos. La suite verde no basta si un criterio de A sigue omitido.
5. Commit/push/publicación privada con el workflow de Sites, SHA exacto. Actualizar
   AGENTS/EXECUTION-NEXT/PROJECT-STATUS/roadmap con estado implementado pendiente
   de revisión, sin aumentar el 40% por documentos/tests. Mantener evidencia
   histórica y no marcar producción ni migración listas.

Después cambiar a **Sol 6.1 medio** para aceptación de A. El lector ya fue
aceptado localmente por la revisión independiente; integrar los probes no exige
otra batería completa de revisión de lector si fuente/contrato siguen intactos.
Luego **Sol alto** define contratos B/C y coordinación antes de nueva ejecución.
