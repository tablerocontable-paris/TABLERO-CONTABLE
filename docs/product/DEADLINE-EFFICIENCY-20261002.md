# Contrato de ejecución — contraste y anticipación de objetivos

Pedido de Valentino del 02/10/2026, posterior a la revisión v40. El diseño se
cerró y la implementación local ya se ejecutó con Luna. Sigue pendiente revisión
independiente de Sol, QA visual de navegador y aceptación de los resultados.

## Evidencia y alcance

Las dos capturas adjuntas se pudieron abrir en esta sesión. En modo oscuro:
la cabecera de Lucía Fernández tiene fondo claro y texto casi blanco; las filas
del checklist tienen fondo claro con texto gris tenue. `src/styles.css` contiene
`background: #f8f9fb` en `.org-manager` y `.check-line`; el tema oscuro no sustituye
esos fondos. La revisión funcional A anterior no comprobó este contraste visual.

Implementar ambos arreglos y la medición de anticipación en la **demo local**:
tarjetas/detalle, operativas, análisis por empleado/equipo/sector y reporte de
cierre/CSV. No modificar SQL 001–008, gateway, lector, contratos remotos, servidor
de correo, dependencias ni identidad de tareas. La integración productiva de
este indicador requiere su propio contrato y migración futura: no inventar una
RPC ni afirmar que el correo/SQL actuales ya incluyen estas métricas.

## 1. Contraste

- Preservar layout y avatar circular con iniciales. No renombrar personas.
- `.org-manager`: fondo `var(--surface-soft)`, texto `var(--ink)` y borde
  `var(--line)`. Su texto secundario debe mantener contraste de al menos 4,5:1;
  usar un token local `--control-muted`: claro `#5f6772`, oscuro `#a9b2c0`.
- `.check-line`: fondo `var(--surface-soft)`, borde `var(--line)` y texto
  `var(--ink)`, también en `.checked`. Conservar el tilde y tachado como estado,
  sin disminuir opacidad de toda la fila. Checkbox con acento legible en ambos
  temas. Texto regular al menos 14px.
- La regla oscura genérica `:is(label, ...)` tiene más especificidad que
  `.check-line`; declarar también `[data-theme] .check-line` y
  `[data-theme] .check-line.checked` para que ambas usen `--ink`.
- Validar claro, oscuro y Sistema. Si no puede hacerse QA de navegador con el
  flujo autorizado, dejar esa aceptación visual abierta; no sustituirla por una
  prueba que sólo busca literales CSS. Medir contraste de los pares resueltos y
  comprobar que las capturas muestran el caso real cuando el preview esté
  disponible. No agregar dependencias de navegador para este cambio.

## 2. Regla de anticipación

Cada ocurrencia `Task` ya conserva `due` y `target` propios al materializarse.
Esos son la referencia; nunca tomar el vencimiento/meta actual del catálogo o
de otra ocurrencia/empresa. `reviseAssignment` sólo reemplaza trabajo no iniciado
y conserva trabajo/historia; mantener esa restricción. El catálogo no modifica
instancias existentes. No incorporar edición de plazos/metas históricos en este
bloque. Si en el futuro se autoriza, necesitará motivo y versiones auditadas.

Todos los plazos actuales son **fechas**, válidas hasta finalizar ese día en
`America/Argentina/Buenos_Aires`. No son horas. Los días de anticipación son días
calendario; no días hábiles ni duración del cronómetro.

| Situación | Presentación | Cálculo |
| --- | --- | --- |
| Finalizada el 8, plazo el 10 | Completada 2 días antes | fecha límite − fecha de logro = 2 |
| Finalizada el 10, plazo el 10 | Completada en fecha | diferencia = 0 |
| Finalizada el 12, plazo el 10 | Completada 2 días después | diferencia = −2 |
| Operativa alcanza meta el 8, plazo el 10 | Meta alcanzada 2 días antes | misma regla, sin completar ni detener la operativa |
| Sin vencimiento | Sin plazo para comparar | fuera del denominador |
| Con plazo, aún sin completar/alcanzar meta | Plazo pendiente / Plazo vencido | según fecha de referencia actual; fuera del denominador de logros |
| Falta fecha fiable o referencia válida | Sin medición | fuera del denominador, cantidad desconocida visible |

Un entregable sólo tiene logro si está `Completada` y tiene `completedAt` válido.
Reabrirlo elimina el logro vigente hasta completarlo nuevamente; no altera el
reporte cerrado anterior. Corregir `transition`: Completada → Completada es un
no-op y preserva el primer `completedAt`, sesiones y `reopenCount`; no registrar
nuevo audit de finalización desde el llamador para ese no-op. No cambiar las
reglas existentes de checklist, espera ni cierre.

En operativas, usar la primera fecha en que la **suma registrada** alcanza la
meta positiva de esa ocurrencia. Filtrar actividad por taskId y fecha de trabajo
del período, ordenar por `createdAt` (desempate id) y acumular `qty`. El instante
de logro es `createdAt` del registro que cruza la meta, no `Activity.date`:
registrar el 12 actividad que dice haberse realizado el 8 no acredita un logro
antes del 10. Mostrar «Meta registrada…» para que esa distinción sea clara.
No usar el último registro ni cambiar la fecha por registros posteriores. Un
logro operativo no mueve tarjetas, no detiene el reloj y no cierra el mes.

Validar fechas de calendario completas y timestamps; no permitir que `Date`
normalice 31/02 o que datos inválidos produzcan NaN/porcentajes inventados. Meta
operativa inválida, registros propios con cantidad/timestamp inválidos o fecha
futura incoherente: «Sin medición». No completar campos históricos ausentes con
la fecha de hoy. `createdAt` futuro no es evidencia de un logro actual. El modo
de pruebas pasa un instante de referencia explícito y congelado.

## 3. API local y agregados

Crear `src/domain/timeliness.ts` con funciones puras. Usar importaciones de tipos
para evitar ciclos con model.ts:

- `taskTimeliness(task, activity, asOfISO)` devuelve estado
  `early | on-date | late | pending | overdue | no-deadline | unknown`,
  `achievementAt: string | null`, `daysAhead: number | null` y tipo de evidencia
  `completion | registered-target`. Diferencia por días UTC de fechas ART, sin
  restar horas locales. No mezclar pendiente-vencida con completada-tarde.
- `summarizeTimeliness(tasks, activity, asOfISO)` devuelve `version: 1`,
  resúmenes separados `results` y `operational`, y `total`. Cada resumen tiene
  `evaluated`, `early`, `onDate`, `late`, `pending`, `overdue`, `noDeadline`,
  `unknown`, `earlyRate`, `averageDaysAhead`. `evaluated=early+onDate+late`;
  `earlyRate=100*early/evaluated` redondeado, o null sin muestra;
  `averageDaysAhead` media de días sólo de logros anticipados, o null sin ellos.
  Pendiente y vencida son categorías excluyentes. Cada instancia cuenta una vez;
  deduplicar por Task.id defensivamente. No sumar unidades operativas entre sí.

Agregar `timeliness?: TimelinessSummary` a `Metrics` para compatibilidad con
snapshots viejos. `metrics()` agrega el resumen nuevo pero **conserva** los
indicadores existentes, incluido `onTime` de entregables y su denominador.
Permitir un cuarto argumento opcional `asOfISO`; el tercero `today` existente
conserva su significado. Sin cuarto argumento usar el final de ese `today` en
ART (inicio de día UTC siguiente más 3h, límite exclusivo); esto permite pruebas
históricas deterministas. El helper recibe el último instante anterior a ese
límite, no el inicio del día siguiente. En cierres/reportes pasar `c.at` exacto.

No cambiar pesos, `earned`, `weighted`, tiempos ni presencia. El indicador mide
anticipación del plazo, no certifica por sí solo calidad/productividad ni premia
cuanto más trabajo se declara. No añadir bonificación al KPI.

## 4. Interfaz y reporte

- Componente reutilizable `TimelinessBadge`: texto/icono, no sólo color;
  colores según tokens y contraste legible. Usarlo en tarjeta de resultado,
  detalle, tarjeta operativa y tabla de análisis. Pendientes conservan el
  vencimiento habitual; no duplicar avisos en cada tarjeta.
- En análisis: panel compacto «Anticipación de plazos», total de logros antes
  del plazo / logros evaluables, porcentaje y promedio de días anticipados.
  Desglosar entregables/meta operativa; mostrar desconocidos y «Sin muestra».
  La tabla por empleado/equipo/sector muestra cantidad anticipada, denominador
  y promedio. Reusar `filtered`/`chartGroups`, `canSee` y filtros empresa,
  período/equipo/sector/persona actuales; consultar un perfil no cambia actor.
- El empleado ve su información y los superiores ven sólo su ámbito autorizado
  actual de demo. No ampliar acceso ni introducir avisos entre compañeros.
- Exportación de análisis: columnas nuevas con base evaluable y anticipación,
  sin reemplazar puntualidad anterior; nulos como «Sin muestra».
- Nuevos cierres congelan `metrics.timeliness` con `c.at` y tareas/actividad de
  ese cierre. Los grupos del nuevo reporte lo calculan también con `c.at`.
  Mostrarlo en PeriodReports y añadir columnas a su CSV, respetando `csvCell`.
  Reportes/cierres guardados antes del cambio sin timeliness muestran «Sin
  medición histórica»; **no** recalcular ni reescribir su snapshot con datos vivos.
  Conservan schemaVersion 1 con campo opcional aditivo. No regenerar al abrirlos.
- Historial/analítica ordinaria es una vista de tareas; reporte cerrado es el
  snapshot de su fecha de corte. Conservar esa distinción.
- Agenda: obligaciones vinculadas podrán consumir esta misma función sobre su
  Task.id cuando se implemente el contrato B/C. No inferir vínculo por título,
  sumar eventos como tareas, ni afirmar que ARCA/agenda ya están integrados.
  Un recordatorio personal sin una tarea/objetivo medible no entra al indicador.

## 5. Archivos y verificación de Luna

Cambiar sólo `src/styles.css`, `src/domain/timeliness.ts`,
`src/components/TimelinessBadge.tsx`, `src/domain/model.ts`,
`src/domain/reports.ts`, `src/App.tsx`, `src/components/OperationalTaskCard.tsx`,
`src/components/PeriodReports.tsx` y pruebas/documentación necesarias. Preservar
el esquema de persistencia local; sus passthrough existentes conservan campos
opcionales. No migrar ni descartar datos guardados. Revisar fixtures si una
aserción compara Metrics completos; ampliar semánticamente, no borrar el assert.

Pruebas necesarias (riesgos reales, no repetir CSS literal):

1. Antes/mismo día/después; cruce UTC/ART a medianoche; fin de mes/bisiesto y
   plazo inválido/sin plazo/completedAt ausente. Día 8 frente a día 10 = 2.
2. Completada→Completada conserva fecha/tiempo; reapertura pierde logro vigente
   y recompletar usa fecha nueva, snapshot anterior intacto.
3. Meta por múltiples registros, creados desordenados; primer cruce estable;
   registro tardío con fecha declarada anterior no obtiene anticipación falsa;
   otro período/tarea no cuenta, inválidos no producen resultado inventado.
4. Sin muestra devuelve null; categorías/denominadores excluyentes;
   empleado/equipo/sector/empresa usan la misma función; mismo banco en dos
   empresas continúa siendo dos ocurrencias; Task.id duplicado no duplica cuenta.
5. Nuevos reportes/CSV incluyen métricas del corte y grupos; snapshot antiguo
   no se recalcula y se presenta como Sin medición histórica; almacenamiento
   fallido no comunica guardado exitoso ni pierde datos.
6. UI muestra el mismo logro al empleado y al superior autorizado; filtros y
   selector consultado preservan actor. Operativa en meta sigue abierta y con
   sus controles. Tour/tablero/checklist conservan los flujos aceptados en v40.

Ejecutar `npm test`, `npm run build`, `git diff --check`; registrar resultados
reales, limites de QA visual y archivos congelados intactos. Usar workflow Sites
para commit/push y publicación privada del build exacto. No publicar la versión
documental de este contrato como si incluyera el arreglo. Tras implementación,
alinear AGENTS/EXECUTION-NEXT/PROJECT-STATUS/WORKFLOW-MODELS y recomendar revisión
Sol 6.1 medio. B/C vuelve después de aceptar este bloque. Avance sigue estimado
40%; no aumentarlo por este diseño.

## Resultado de implementación local

`src/domain/timeliness.ts` calcula estados con fechas ART y conserva la base de
anticipación separada para entregables y metas. Los paneles aparecen en tareas,
operativas, análisis agrupado y reportes nuevos. `Metrics.timeliness` es
opcional/aditivo: cierres antiguos no se recalculan y se muestran como
«Sin medición histórica». Completada→Completada y repetir el mismo checklist son
no-op; la reapertura borra el logro vigente sin alterar snapshots previos.
Los dos fondos fijos de contraste usan tokens del tema. El proyecto pasa 217
pruebas/19 archivos, `npm run build` y `git diff --check`. SQL/gateway/lector y
dependencias permanecen congelados. La QA visual real del navegador aún está
pendiente; este resultado local no verifica autenticación ni entrega de correo.

## Contrato productivo pendiente (sin implementación ahora)

La producción conservará la referencia por ocurrencia y calculará logros con
timestamps confirmados por servidor/RPC. La meta se alcanza con actividad
aceptada por servidor, no un timestamp que el cliente pueda editar. Snapshot y
reporte/outbox incorporarán una versión de esta métrica en la misma transacción
de cierre. No parchear reportes ni migraciones aplicadas; preparar nueva
migración revisada y pruebas contra SQL antes de conectar. Coberturas/conjuntas
mantienen una ocurrencia y contribuciones: no acreditan dos logros globales.
Los filtros y porcentajes de contribución se cerrarán en B/C sin fingir su
implementación en esta demo.
