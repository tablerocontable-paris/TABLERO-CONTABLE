# Correcciones del producto — 18 pedidos del 02/10/2026

Estado: decisiones y criterios definidos; implementación pendiente. Fuente del
análisis: commit `16862eec715d81193c1b8a30403cae0288b8a326` (Sites v34),
las once capturas adjuntas y el pedido escrito. Este documento amplía el producto;
no afirma que las funciones estén conectadas o terminadas.

## Matriz del pedido y su aceptación

| Nº | Cambio acordado | Criterio observable | Bloque |
| --- | --- | --- | --- |
| 1 | Gráficos con barras más finas, cursor discreto y tooltip legible en ambos temas | Se distinguen logrado/pendiente, valores y nombre al pasar el cursor; barras apiladas de ancho máximo 28 px; alternativa tabular | A |
| 2 | Checklist como filas individuales al crear tareas/procesos | Agregar, editar y quitar pasos; cada paso genera un checkbox independiente al abrir la tarea; el catálogo conserva sus controles; crear no marca controles como hechos | A |
| 3 | Agenda de obligaciones por empresa: balances e impuestos; importación futura de IVA desde ARCA | Empresa, período fiscal, vencimiento, origen y fecha de consulta visibles; responsable y colaboradores informados; ninguna fecha se deduce copiando el mes anterior | C |
| 4 | Equipos jerárquicos, con tareas de múltiples sectores | Un equipo puede tener conciliaciones, impuestos, gestoría y pagos; filtrar sector no cambia pertenencia; Carolina es la encargada indicada de Valentino, configuración real por Juan Pablo | A/B |
| 5 | Anotaciones compactas y categorías abiertas | Formulario plegable, contenido expandible, categorías libres además de sugerencias; conserva recordatorios, copia y conversión a tarea | A |
| 6 | Recorrido más completo, con botón Anterior | 11 pasos base, extensiones por rol, atrás/adelante/pausa/reanudación sin reiniciar ni perder avance ante fallo de guardado | A |
| 7 | Hacer funcional el selector Grupo París de la captura image(9) | Clic y teclado permiten elegir una empresa autorizada o todas; comparte el mismo filtro de empresa de la barra | A |
| 8 | Capturar nombres libres y agrupar coincidencias para estandarizarlos | CONC BNA EMPRESA 1 y CONCILIACION BANCO NACION E2 se proponen para un estándar común; Juan Pablo confirma proceso/controles/rubro; empresas e instancias independientes | B |
| 9 | Cierre reservado a encargados y gerente, con revisión del trabajo completo | Empleado no ve acción ni puede cerrar mediante servidor; pendientes/relojes abiertos impiden cierre normal; revisión abarca todas las empresas del empleado | A/B |
| 10 | Tareas conjuntas sólo espontáneas | Una tarea puntual con dos responsables aparece a ambos; estado/checklist/vencimiento compartidos, sesiones por ejecutor y KPI sin duplicar el peso global | B |
| 11 | Avisos internos por proximidad del vencimiento e inactividad; correo futuro | Sólo destinatarios autorizados; completar deja de generar avisos pendientes; lectura no cuenta como trabajo; correo reintentable y deduplicado con destinatario verificado | C/D |
| 12 | Comentario de bloqueo reservado al autor y sus superiores | Autor aclara qué falta; jefe/encargado pueden leer; compañero señalado, reemplazante y coautor de tarea no reciben ni leen el detalle por esa relación | B |
| 13 | Cobertura como coordinación de reemplazos, sin + Nueva tarea global | Seleccionar titular, reemplazo, rango y tareas; aprobación del responsable; la misma tarea aparece al reemplazante, cierre y tiempo quedan en su historial original | A/B |
| 14 | Tareas huérfanas en administración de Juan Pablo | Al desactivar/reubicar un usuario se conserva su hoja habitual y tareas abiertas para reasignar; historia/cierres no se borran ni se atribuyen retroactivamente al nuevo empleado | B |
| 15 | Tablero personal por defecto para todos; supervisor elige perfil en desplegable | Juan Pablo/Carolina ven primero lo propio; eligen una persona autorizada y pueden volver a su perfil; resumen del equipo en análisis mensual | A |
| 16 | Consultas y pedidos internos con urgencia y seguimiento | Errores a soporte técnico; solicitudes a Juan Pablo; autor ve estado y respuesta; destinatario ve pendientes ordenados por urgencia, sin convertirlos silenciosamente en tareas KPI | D |
| 17 | Relacionar obligación y tarea terminada | Evento cumplido no aparece como vencido pendiente; conserva la fecha y si se cumplió tarde; una tarea ajena/otro impuesto/otra empresa no cancela el aviso | C |
| 18 | Ciclo de trabajo mensual | Vista por día/semana con carga planificada y ejecución real separadas, por persona/equipo/sector/empresa; cubre 28/29/30/31 días sin duplicar tareas compartidas | D |

Bloque A: interfaz y demo, contrato ejecutable en
`CORRECTIONS-UI-EXECUTION-20261002.md`. B: datos, aprobación, jerarquía, participación,
confidencialidad y administración. C: agenda fiscal y avisos enlazados. D:
consultas, comunicaciones y ciclo. B/C/D necesitan contratos SQL/API cerrados y
revisión de permisos antes de cada ejecución; no se autoriza inventar su esquema
durante A.

## Personas, equipos y contextos de vista

El equipo depende de un encargado, no de la naturaleza de la tarea. El sector
pertenece al proceso/tarea y puede ser distinto del puesto de la persona. Juan
Pablo configura la relación Carolina → Valentino y sus otros integrantes; los
nombres restantes de la demo no son un organigrama real validado.

El perfil autenticado y el perfil consultado son conceptos distintos. Consultar
el tablero de otra persona nunca cambia actor, permisos ni atribución del reloj.
Tablero y actividad operativa abren en el perfil propio. Encargado puede elegir
sólo subordinados actuales; gerente puede elegir perfiles de su organización.
Empleado no recibe una lista de compañeros. Análisis conserva filtros de todo
el ámbito autorizado. Los accesos temporales por cobertura y participación se
muestran como trabajo asignado a la persona, sin habilitar el perfil completo del
titular. Reset de filtros no vuelve un tablero personal una vista global.

## Inducción y estandarización sin catálogo taxativo

Se conserva la entrada libre de una tarea habitual como propuesta. No se obliga
al empleado a disfrazarla de trabajo esporádico ni se activa una recurrencia sin
aprobación. El empleado declara empresa, nombre original, banco/proceso si lo
conoce, instrucciones, controles, frecuencia y vencimiento por línea.

Antes de aprobar inducciones, Juan Pablo tiene una bandeja de propuestas que
agrupa coincidencias. Normalizar tildes, mayúsculas, espacios y abreviaturas
configuradas (ejemplo BNA/Banco Nación). Separar empresa del nombre para comparar;
conservar el texto original y el banco/empresa explícitos. La similitud ofrece
candidatos: nunca fusiona procesos ni asignaciones automáticamente. Un banco
distinto, controles diferentes o un nombre ambiguo exige revisión.

Juan Pablo puede vincular con estándar existente, crear uno o pedir correcciones.
La confirmación establece nombre, rubro/sector, instrucciones, controles, versión
y peso común. Cada empleado/empresa mantiene frecuencia, meta y asignación
propias. Cambios de estándar rigen trabajo futuro: no reescribir actividad,
tiempos, ocurrencias iniciadas, cierres ni reportes. La aprobación del borrador y
activación deben ser transaccionales, idempotentes y validar membresías actuales.
La inducción demo que hoy materializa directo no es ese flujo de producción.

## Una tarea, varios ejecutores

Para tarea conjunta puntual: un identificador de ocurrencia, una empresa, un
vencimiento, un checklist y un estado. Juan Pablo o encargado con ambos usuarios
en su ámbito pueden asignar participantes activos y autorizados para esa empresa;
asignaciones entre equipos quedan a Juan Pablo. Empieza con dos responsables;
no admitir recurrencia conjunta en esta fase. Cada participante inicia/pausa su
propio tiempo; puede haber trabajo paralelo de dos actores, pero sólo un reloj
abierto por actor. Una finalización conjunta detiene los relojes de esa ocurrencia
en una transacción y se refleja en los dos tableros.

Antes de activar, el responsable fija participación que suma 100%, por defecto
50%/50%, con snapshot. KPI global cuenta el peso una vez; KPI individual atribuye
su proporción y muestra participación, contribución y tiempo reales. No contar
la mitad de tiempo de otro como tiempo propio. Un participante retirado no pierde
historia; redefinir responsabilidad futura exige auditoría y no modifica cierres.
Una tarea compartida bloquea cierres de los afectados hasta estar resuelta, y un
participante cerrado impide editar su evidencia mediante el otro tablero.

Cobertura es otra relación: conserva el titular y su responsabilidad, con acceso
temporal del reemplazo a tareas seleccionadas y empresas aprobadas. Se propone
entre compañeros del mismo equipo; encargado aprueba, Juan Pablo decide excepciones
entre equipos. Rango y tareas se previsualizan antes de aprobar, incluyendo tareas
habituales que ocurrirán durante la ausencia. El reemplazante completa la misma
ocurrencia, no una copia; después ambos conservan evidencia permitida del trabajo.
El titular tiene cumplimiento de su obligación; el reemplazo tiene contribución
real por sesiones/actividad, no un segundo peso global completo. Cancelación o
fin revoca acceso operativo y detiene reloj de cobertura; historial propio de
sesiones no da acceso general al perfil o a tareas del titular.

El SQL 001–008 ya sella cobertura por empresa y período. Selección de tareas,
propuesta entre compañeros y cambios de jerarquía requieren ampliaciones futuras
revisadas; no editar migraciones aplicadas para introducir estas reglas.

## Comentarios privados y desactivación de usuarios

El estado operativo de espera puede ser visible en la tarjeta autorizada, pero
el detalle de causa interpersonal se almacena aparte de task_instances, actividad
y auditoría que puedan leer colaboradores. Sólo autor, encargado vigente del
autor y Juan Pablo pueden leerlo. Soporte técnico no obtiene esos textos por
defecto. No enviar comentarios/personas señaladas en notificaciones a terceros,
correo, exportación común, tooltip o reporte de empleado. Puede quedar una
versión de gerencia con acceso reservado. Cambio jerárquico revoca la lectura del
encargado anterior. No fingir privacidad con CSS ni esconder un campo recibido
por todos en el JSON. Nueva política/RPC con pruebas de denegación requerida.

Desactivar acceso y retirar pertenencia no elimina el perfil histórico. Pausar
relojes y recurrencias nuevas, guardar pendientes de reasignación con antiguo
responsable, empresa, estándar, frecuencia y motivo. Administración de Juan Pablo
revisa uno por uno o un lote previsualizado. Reasignar trabajo futuro pendiente
sin actividad conserva la cadena de asignación y evita doble materialización;
trabajo iniciado necesita traspaso explícito con historial y cierres comprobados.
Trabajo ya cerrado permanece con el autor original. Si un usuario supervisa a
otros, resolver también esos subordinados antes de retirarlo. No usar un UUID
falso «Sin asignar» ni eliminar filas para representar huérfanas.

## Agenda de empresa y vencimientos fiscales

Agenda es independiente del plazo de cada tarea. Un evento de empresa tiene
identidad estable por empresa + obligación + período fiscal + tipo de hito
(presentación/pago/cierre), fecha, fuente/revisión y estado derivado de vínculos
explícitos. No usar título aproximado para decidir cumplimiento ni tratar la
fecha pasada como prueba de incumplimiento. Período fiscal y mes del vencimiento
son campos distintos: IVA puede corresponder a un período anterior al mes en que
se presenta.

Fuentes oficiales consultadas 02/10/2026:

- https://www.arca.gob.ar/iva/iva-simple/presentacion.asp: remite al cronograma
  vigente de la Agenda General de Vencimientos.
- https://arca.gob.ar/vencimientos/: enlaza a la agenda completa.
- https://seti.afip.gob.ar/av/seleccionVencimientos.do: ofrece filtro de fechas,
  terminación de CUIT e impuestos. Consulta pública, sin clave fiscal.

Esto verifica la fuente propuesta, no un scraper, una API disponible ni el
calendario particular de las cuatro empresas. No se tomó la captura como fuente
para cargar fechas oficiales. Integración futura de sólo IVA inicialmente, con
los CUIT informados entonces y configuración de obligación/régimen validada por
Juan Pablo. CUIT completo en configuración protegida; no en código, logs públicos
o notificaciones. Importador servidor consulta datos oficiales, valida período,
terminación, obligación y formato, conserva evidencia y fecha de consulta, y hace
upsert idempotente. Nunca inventa fecha ni recicla un mes anterior si falla la
consulta. Un cambio/prórroga se versiona y comunica sin alterar reportes cerrados.
Primera integración requiere pruebas con fuente guardada y aprobación operativa;
la actualización mensual desatendida se habilita en el backend oficial, no ahora.

Balances y otros impuestos pueden cargarse manualmente por responsables con
empresa, origen y tareas vinculadas. Informar a usuarios con esa empresa y con
procesos relevantes (ejemplo carga de facturas); no enviar a toda la organización
sin relación. Hitos para carga de documentación son internos y distinguibles del
vencimiento oficial. Completar la declaración no acredita pago si se modelan como
dos hitos. Si hay varias tareas obligatorias vinculadas, se cumple al terminar
todas. Mostrar pendiente / cumplido a tiempo / cumplido fuera de término / sin
responsable; al reabrir una tarea de período abierto, recalcular. Leer o reconocer
un aviso no cumple una obligación.

## Cierre, avisos y consultas

Separar preparación automática del reporte de aprobación del cierre. Encargado
o Juan Pablo revisan todas las empresas y sólo ellos confirman. Entregables
pendientes, bloqueos y relojes abiertos impiden cierre normal. Operativas se
consolidan por registros y meta; un desvío requiere disposición y observación
explícita de gerencia, no marcar todo como cumplido. Un pendiente excepcional
debe quedar resuelto como cancelado justificado o trasladado mediante operación
auditada que preserve período original, sin volverlo «Completada». Ese flujo
excepcional requiere contrato posterior antes de ofrecerlo. El cierre emitirá
reportes/outbox por usuario en una transacción; correo real permanece pendiente.

Avisos por vencimiento: 3 días antes, día de vencimiento y resumen de atrasadas.
Inactividad: 5 días corridos sin evento de trabajo; configurable por Juan Pablo
en el contrato backend, suspender recordatorio personal durante ausencia y
dirigir trabajo pendiente al reemplazo activo. Evento de trabajo = inicio/fin de
sesión, checklist, registro operativo o cambio de estado; visitas al perfil,
heartbeat, consulta de tarjeta y edición cosmética no reinician esa antigüedad.
Notas/recordatorios personales sólo a su autor. Deduplicar por destinatario,
entidad, regla y ventana; recalcular elegibilidad al entregar. Mostrar lectura y
acciones; silenciar no cierra tarea. Correo opcional verificado, con preferencias,
outbox y resumen en lugar de duplicar cada aviso. No incluir detalles privados
de bloqueos; enlaces vuelven a verificar permisos. Sin mail ni scheduler activos
durante la demo.

Consultas separan Error técnico → cuenta técnica de soporte, Pedido/consulta de
trabajo → Juan Pablo, Sugerencia → destino elegido explícitamente. Autor,
destinatario y Juan Pablo según su facultad de administración ven los casos;
soporte no recibe pedidos de trabajo por defecto. Alta con texto, urgencia
(baja/media/alta/urgente), módulo y captura privada opcional. Estados nuevo,
en revisión, respondido, resuelto; historial y respuesta. Ordenar abiertos por
urgencia y antigüedad, filtros por tipo/autor/estado. No alterar KPI ni crear
tareas automáticamente; conversión opcional explícita por responsable al asignar
trabajo con sus fechas y permisos. Capturas requieren almacenamiento privado,
validación de tamaño/tipo y acceso de los mismos participantes de la consulta.

## Ciclo de trabajo y métricas

Análisis mensual tendrá una vista diaria y semanal, comparable por empresas,
personas, equipos y sectores. Carga planificada = puntos snapshot de ocurrencias
en scheduled_on; en las compartidas usar participación para individuo y contar
una vez en agregado. Carga real = sesiones divididas por día de Argentina más
registros operativos/completados en su fecha; no atribuir una sesión entera al día
en que terminó. Mostrar cantidad/puntos/tiempo como magnitudes distintas.
Cobertura conserva contribución de ejecutor y obligación de titular sin sumar
dos tareas globales. No deducir «tiempo libre» por falta de conexión o registro:
mostrar días con menor carga planificada y marcar datos ausentes. Ausencias
aportan contexto; comparar con capacidad sólo después de configurar jornadas.
No sumar porcentajes individuales para obtener el KPI del equipo.

## Secuencia y límites

1. A, ejecución Luna medio con contrato cerrado: correcciones visibles y pruebas
   de flujos afectados. Revisión Sol medio después.
2. Completar aceptación pendiente del lector con contrato de tests específico;
   no integrar coordinador sobre evidencia incompleta.
3. B, diseño Sol alto de cambios de datos/permisos, migración incremental nueva,
   ejecución Luna medio y revisión de permisos/upgrade.
4. C, después de B y conexión autenticada: agenda, vínculos, importación y avisos.
5. D: consultas, ciclo y entregas verificadas. Validar con Juan Pablo/encargado.
6. Piloto y servicios definitivos antes de migrar. No crear Gmail, GitHub,
   Supabase, Cloudflare/Vercel ni tocar el legado en esta planificación.

La arquitectura del coordinador la define Sol; Luna implementa contratos
aprobados. Las 18 correcciones siguen pendientes hasta tener evidencia concreta.
El avance estimado sigue en 40% (35–45%); registrar requisitos no eleva ese grado.


## Seguimiento del avatar — 02/10/2026

El usuario observó que Lucía Fernández aparecía con un ícono de ramificación en
el organigrama. La fuente usa ese ícono para todos los encargados, mientras jefe y
empleados usan iniciales. Unificar el avatar circular de personas, conservar
cargo/equipo como texto y no renombrar perfiles guardados. Contrato:
`CORRECTIONS-UI-A-FOLLOWUP-20261002.md`; revisión v39 documentada.
