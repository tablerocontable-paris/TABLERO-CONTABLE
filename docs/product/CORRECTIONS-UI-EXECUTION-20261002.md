# Bloque A — contrato cerrado de implementación de interfaz

**Siguiente modelo: GPT-6 Luna, esfuerzo medio, Standard.** Fuente base:
`16862eec715d81193c1b8a30403cae0288b8a326`, más este commit de planificación.
Leer AGENTS, CORRECTIONS-20261002 y CONSISTENCY-RULES. No decidir nuevos permisos,
SQL, arquitectura, red o servicios. Este bloque implementa demo local y no
declara producto conectado.

## Alcance y orden

Modificar App/componentes/estilos/modelo local/repositorio sólo para A1–A8 abajo;
conservar contrato remoto, gateway, lector, SQL 001–008, cierres guardados y
dependencias. Extraer componentes/helpers pequeños cuando evite duplicación.
Sin refactor global de App ni copiar componentes legacy. Completar todos los
puntos de este bloque antes de devolver; después revisar con Sol medio.

### A1 — contraste y densidad de gráficos (pedido 1)

Revisar los BarChart de Resumen y Análisis mensual. Tooltip: fondo opaco de
superficie del tema, texto/borde contrastantes, nombre completo, serie, unidad y
valor; cursor con relleno tenue y borde (variable CSS por tema), sin franja blanca
opaca sobre barras. Dos colores distinguibles para logrado/pendiente; barras
apiladas maxBarSize 28 y horizontales maxBarSize 22, separación suficiente.
Mantener escala, datos, pesos y agrupaciones. Leyendas y ejes legibles, sin cortar
nombres a ancho estrecho; tooltip accesible por teclado si la librería lo permite,
y conservar tabla de detalle como alternativa. Clic de agregado equipo/sector no
debe regresar al tablero mezclado: permanece en análisis y actualiza filtro;
clic de persona puede ir a su tablero autorizado.

### A2 — editor de pasos (pedido 2)

Componente reutilizable de array de textos: filas con número, input de texto,
botón Quitar paso y Agregar paso (type=button). Enter en fila agrega una línea sin
enviar el formulario. Etiquetas accesibles «Paso 1»/«Quitar paso 1». Límite 50
pasos, texto 1..300 caracteres trim; no guardar filas vacías. Al crear no mostrar
checks interactivos que signifiquen trabajo ya cumplido: vista previa de controles
pendientes. Estados done=false al materializar. Catálogo seleccionado muestra sus
pasos independientes de sólo lectura; no permite modificar estándar desde tarea.

Aplicar a NewTask, CatalogueCreator y captura de tarea particular en Onboarding.
Mantener representación actual de steps[] en Assignment/Template y string de
customSteps/customTasks.steps mediante join/split en frontera del componente.
Texto de anotación convertida sigue como propuesta editable de pasos, preservando
conversión puntual y original. Al cambiar catálogo reiniciar editor con sus pasos,
sin arrastrar controles anteriores. Catálogo requiere al menos uno; tarea puntual
puede quedar sin controles con mensaje explícito (regla actual).

Corregir también un defecto descubierto al revisar NewTask: controles select
disabled no se incluyen en FormData. Al elegir estándar tomar sector, kind, peso,
unit y controles del objeto t, no Number(null) o String(null), aunque el actor sea
Juan Pablo. Así una tarea de catálogo no recibe peso 0 ni sector «null». La meta
individual y frecuencia siguen editables según reglas actuales. Comprobar el
snapshot de asignación y ocurrencia realmente guardadas en la demo.

### A3 — anotaciones compactas, categorías abiertas (pedido 5)

Formulario plegable «Nueva anotación»; abrir al editar. Tarjetas/lista compacta
con título, categoría/fecha y resumen de 2 líneas; Expandir muestra contenido y
acciones existentes. Evitar bloques de pantalla completa; controles regulares
mínimo 14 px y áreas clickeables utilizables. Conservar búsqueda, copia, edición,
eliminación y conversión atomicamente guardada. Un fallo no vacía borrador ni
cierra formulario. Nota convertida conserva las restricciones y enlace actuales.

Añadir `category?: string` a Annotation y al schema local, máximo 40 caracteres,
trim al guardar. UI campo «Tipo o categoría» libre con sugerencias Nota personal,
Fórmula de Excel, Recordatorio y categorías propias de ese autor. Conservar kind
interno personal/formula/reminder para compatibilidad y comportamiento; nuevas
categorías libres usan personal; elegir Fórmula de Excel usa formula, Recordatorio
usa reminder y exige fecha. Fecha opcional para categorías libres; todo recordatorio
con fecha sigue entrando en avisos propios. Tipo visible = category si existe,
sino etiqueta de kind; filtrar por esa etiqueta y buscar también categoría.
No exponer ni sugerir categorías de otros perfiles. Mantener version 3 y lectura
de notas anteriores sin category; reload conserva campo nuevo. No diseñar tablas
remotas de notas en este bloque.

### A4 — recorrido versión 3, Anterior (pedido 6)

11 pasos base con páginas existentes: Mi día; ambiente; perfil consultado; columnas
independientes y orden; crear tarea/checklist; iniciar/pausar tiempo; controles y
finalizar; registros operativos; vencimientos; cobertura; anotaciones. Los pasos
explican funciones existentes: no afirmar que hay IVA automático, comentarios
privados, datos sincronizados o tareas conjuntas. Encargados agregan análisis,
estructura y cierre (14 total); Juan Pablo agrega catálogo y administración
(16 total). Asegurar navegación y spotlight adecuados a paso, no índices fijos.

Anterior disponible desde paso 2; deshabilitado en 1. Guardar progreso y cambiar
página sólo si commit devuelve true, tanto atrás como adelante/completar/iniciar.
Pausar/retomar conserva paso. Versionar tour a 3; progreso de v2 no se interpreta
con índices de v3. Actualizar reinicio al finalizar inducción para no escribir
version 2 literal. No duplicar la inducción obligatoria ni modificar su aprobación
demo en este bloque.

### A5 — selector Grupo París funcional (pedido 7)

Sustituir workspace decorativo con chevron por control de empresa accesible:
popover o select estilizado. Opciones de empresas autorizadas del actor, más
«Todas las empresas». Usa company/setCompany existentes, nombre elegido visible,
contador dinámico, teclado/cierre/foco. Sin crear segunda selección divergente.
La barra de empresa usa el mismo conjunto permitido. No es cambio de cuenta u
organización. No inferir empresas autorizadas desde otras personas.

### A6 — ámbito del tablero personal (pedidos 4 y 15)

Separar owner de supervisión usado en análisis del perfil consultado del tablero.
Usar selectedBoardOwner inicial active.id. Al cambiar perfil demo, resetearlo a
ese pid, cerrar detalles abiertos y no transferir filtros de la persona anterior.
Tablero y operativas muestran una persona por vez con desplegable «Perfil que
estás viendo», opción «Mis tareas · [nombre]» y subordinados permitidos según
canSee; no ofrecer Todo mi ámbito en esos módulos. Empleado sólo su propia opción.
Restablecer filtros de tablero conserva selectedBoardOwner, o permite «Volver a
mis tareas» explícito. Análisis/Resumen conservan agregado del ámbito autorizado.
Perfil consultado no cambia activeId; actor de cada acción y reloj sigue siendo
la persona activa. Anotaciones siempre propias y sin filtros jerárquicos ajenos.

Cobertura autorizada aparece en bloque separado «Tareas que cubrís» dentro del
tablero/operativas propios, reutilizando canWork/coverageFor actuales; no filtrar
toda cobertura por ownerId=active.id ni duplicarla. No ofrece todo el perfil del
titular. En este bloque no ampliar la política demo de cobertura; selección
sellada de tareas/propuestas llega en B.

Etiqueta de equipo por encargado, «Equipo de [nombre]», en filtros y estructura;
conservar IDs y relaciones, no convertir sector en equipo ni cambiar perfiles
guardados. Sembrar nombres de equipo jerárquicos en seed nuevo. No inventar el
organigrama real restante; Carolina → Valentino está documentado para configuración
por Juan Pablo. Filtros de sector disponibles en un equipo con múltiples procesos.
Click de persona desde estructura/análisis fija selectedBoardOwner y navega; click
de equipo/sector desde gráfico filtra análisis y no fija perfil aleatorio.

### A7 — cierre visible sólo a supervisores (pedido 9, parte de interfaz)

Excluir nav de closing y acciones para empleado. Guardar también render de página
y diálogo contra rol inválido, además de la validación actual closeMonth. Recorrido
de empleado no lleva a closing. Encargado sólo ve personas en su ámbito; Juan Pablo
su organización. No eliminar reportes individuales consultables que ya existen.
Este cambio NO implementa todavía bloqueo de todos los pendientes o excepciones
de cierre: esas reglas van en B con contrato de servidor y pruebas. No declarar
cumplido pedido 9 completo tras este ajuste visible.

### A8 — acciones contextualizadas (pedido 13, parte de interfaz)

Quitar + Nueva tarea global de absences y annotations. En absences mantener
«Registrar ausencia y cobertura» para responsables actuales, sin ampliar quién
aprueba. En anotaciones botón propio Nueva anotación. No colocar CTA de tareas en
cierre/estructura/catálogo; reutilizar acción propia de esos módulos. + Nueva tarea
queda en Mi día/tablero/operativas/planificación, con responsable seleccionado o
propio conforme autorización actual. No usar la acción de ausencia para crear
copias de tareas ni prometer coordinación entre compañeros aún no implementada.

## Comprobaciones necesarias

### Resultado de ejecución — 02/10/2026

Implementado en Luna y pendiente de revisión Sol: gráficos con bandas de hover
visibles y barras estrechas; checklists editables paso a paso en catálogo,
inducción y alta puntual; categorías libres en anotaciones con edición plegable;
recorrido base de 11 pasos, con pasos por rol, pausa y regreso; filtro de empresa
en sidebar; tablero de perfil propio/subordinado; etiquetas de cobertura;
selector subordinado persistente al navegar; equipos rotulados por responsable;
cierre oculto a empleados y CTA contextual. Se corrigió además el fallback de
sector, peso, unidad y meta al asignar un catálogo aunque sus controles estén
bloqueados. La semilla ahora muestra a Carolina Díaz como encargada de Valentino.

Pruebas dirigidas cubren persistencia/categorías, pausa/regreso del recorrido,
vista propia y selección subordinada; `npm test` completo, build y diff-check.
La inspección visual automatizada no se ejecutó: no hay Chromium instalado en el
entorno. No se alteraron esquema/gateway ni los bloques B/C/D; la cobertura es
demo local y no concede permisos productivos.

Pruebas de flujos, evitando snapshots del CSS:

1. Crear tarea puntual con dos pasos y quitarlos/agregarlos: comprobar checklist
   independiente en tarjeta guardada, ambos pendientes. Catálogo como Juan Pablo
   conserva sector/peso/controles y no puede editar el estándar desde NewTask.
2. Nota de categoría nueva persiste tras reload; notas antiguas sin categoría
   siguen funcionando; búsqueda/filtro por categoría; guardado fallido conserva
   borrador abierto y conversión sigue siendo única. Adaptar pruebas previas a
   formulario plegable, sin eliminar sus assertions de fallos/privacidad.
3. Tour Anterior avanza/regresa/pausa/retoma por rol; fallo de guardar atrás no
   cambia página/progreso; no hacer tour de empleado visitar closing.
4. Como encargado/jefe, tablero abre propio; elegir subordinado no cambia actor;
   reset no mezcla perfiles; volver propio; empleado no accede a selector ajeno;
   cobertura autorizada sigue visible y no abre perfil completo del titular.
5. Selector empresa de sidebar/barra sincronizados; empresa diferente separa
   tareas de mismo banco. Cierre y CTA por rol/módulo según A7/A8.

Inspección visual en preview local de barras/hover y notas en claro/oscuro,
desktop y móvil. Usar QA disponible sin entrar a producción para publicar; guardar
evidencia ligada al build. Sin batería de tests de cada clase CSS. npm test,
npm run build, git diff --check; comprobar SQL y remoto sin cambios. Commit/push
y deploy privado del mismo SHA, actualizar estado y registrar qué pedidos quedan
parciales. Próxima revisión Sol medio; datos/permisos B requieren Sol alto.
