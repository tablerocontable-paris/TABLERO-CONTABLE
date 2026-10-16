# Contrato de correcciones posteriores a la revisión — 07/10/2026

Ejecutor recomendado: **GPT-6 Luna, esfuerzo medio, Standard**. Trabajar sobre
el árbol actual, conservar Git y el mismo Site privado. No conectar servicios,
aplicar SQL remoto, activar API ni editar los reportes históricos anteriores.
La revisión y reproducción están en `PLAN-REVIEW-20261007.md`.

## 1. Guardas de permisos y de unidad cerrada

- Centralizar `canConsultLab`, `canManageLab` y `canExecuteLab` y usarlos en
  listados, búsqueda, calendario, detalle, comentarios y acciones.
- Consultar requiere perfil activo; jefe consulta toda la organización;
  encargado consulta su equipo y empresas autorizadas, incluyendo participantes
  conjuntos de su ámbito; responsable/participante/reemplazo conserva su acceso
  autorizado. Consultar nunca altera el actor ni entrega notas personales.
- Gestionar tareas puntuales permite al superior autorizado asignar,
  reprogramar y comentar sin ejecutar por el empleado. Ajustar pesos y reglas
  recurrentes continúa reservado al jefe. Reprogramación puntual debe tener
  fecha válida, motivo y autor; no modificar trabajo iniciado ni snapshots.
- Aplicar el cierre persona+empresa+mes a todas las rutas de escritura:
  materialización, nueva tarea, inducción, propuesta habitual, reprogramación,
  parámetros de instancia, bajas/traspasos, cobertura y activación conjunta.
  Conservar las empresas abiertas. Evitar cambiar el contrato operativo remoto.
- Revisar también la unidad del ejecutor para contribuciones de cobertura.
  Un cierre no puede admitirse con un reloj propio activo, aunque la tarea
  pertenezca a otra persona. Contribuciones posteriores al cierre se rechazan.

## 2. Readiness, ruta y seguimiento comercial

- Una sola evaluación de disponibilidad/dependencias/espera sirve para ruta,
  iniciar, reanudar, controles y completar, con revalidación al confirmar.
  Pausar un reloj existente sigue permitido. Una fecha estimada no libera una
  espera externa; referencia inexistente bloquea con motivo explícito.
- La ruta recibe período, empresa, equipo y sector de Mi día. Mantener
  desempates estables y explicar el vencimiento/prioridad/peso que justifican
  la posición, además del motivo de espera.
- Con seguimiento comercial activo, todas las formas de completar (botón,
  drag, teclado y control) pasan por la misma confirmación y exigen día 30 y
  checklist verificado. Registrar actor y finalización confirmada. No inventar
  una fecha calendario a partir del día comercial.

## 3. Cierre por grupos coherentes y snapshots

- Expandir transitivamente las unidades conectadas por tareas conjuntas.
  Mostrar exactamente qué unidades se cerrarán y por qué una selección puede
  incluir participantes de otro equipo/persona.
- Cada grupo conectado se cierra completo o queda pendiente completo. Revalidar
  todas sus unidades antes de construir el nuevo estado; no usar un catch por
  unidad que admita cierres parciales dentro del grupo. Los grupos independientes
  listos sí pueden cerrarse aunque otro grupo quede pendiente.
- Reintentos conservan IDs y no duplican cierres, reportes ni avisos. Una
  inconsistencia antigua se muestra para revisión; no reabrir ni reescribirla
  silenciosamente. Revisar clocks propios, compartidos y de cobertura.
- Congelar en la unidad sus métricas, evaluaciones y contribuciones necesarias.
  Consolidar desde esas unidades congeladas, sin recalcular una empresa cerrada
  desde filas vivas o coeficientes posteriores.
- Reportes nuevos: cumplimiento únicamente de entregables, operativas con
  cantidades por unidad/carga/tiempo/calidad; los campos de puntos de cuota no
  aplican a grupos operativos. Mantener reportes y métricas históricas originales.

## 4. Evidencia y restauración

- Revalidar contra el estado vigente después de cada await. Capturar el autor
  al iniciar; cancelar si cambia la identidad/permiso/cierre durante la espera.
  Mezclar sólo la operación nueva con el estado vigente, sin sustituirlo con
  la copia anterior. Evitar envío doble y revalidar el límite de tres archivos.
- Coordinar rollback de blobs/referencias si falla el guardado. Vincular evidencia
  del entregable a una finalización concreta cuando se completa; conservar los
  archivos ya referenciados por cierre. Referencias/adjuntos siguen opcionales.
- Validar campos nuevos de tareas y movimientos en respaldo: tipos, rangos
  0–30, fechas reales, evidencias, coeficientes, dependencias existentes y sin
  ciclos, unidad/empresa/período consistente. Validar también snapshots nuevos.
  Rechazar estados incompatibles antes de escribir; mantener respaldo v1 válido
  y preservar atribuciones históricas tras cambios de rol.

## 5. Indicadores, historia y completitud de interfaz

- Corregir el guard de métricas de Mi día; mostrar los mismos cálculos que
  Resumen con el ámbito seleccionado. Cantidades se agrupan por unidad;
  "registros" cuenta movimientos y no suma facturas/pagos/trámites indistintos.
- Construir evolución cerrada desde snapshots conservados. Para comparar
  entregables entre versiones, usar sólo datos de snapshot que permitan una
  serie explícitamente definida; si faltan datos, mostrar sin muestra comparable.
  No rellenar desde filas vivas ni modificar reportes originales. Aplicar cuotas
  y tiempos propios al filtro por participante. Indicar definición de cada serie.
- Calendario: controlar la empresa del formulario, mostrar superiores
  obligatorios por nombre y sin opción de excluirlos; destinatarios adicionales
  nunca amplían permisos. Mostrar detalle y abrir origen de obligaciones y
  ausencias. Conservar Ausencias como apartado separado y notas privadas ocultas.
- Completar paneles resumidos y botones de ayuda de cálculo de los módulos
  pertinentes. Mantener filtros accesibles y evitar repetir tablas expandidas.
- Compactar EmployeePicker con búsqueda accesible, opciones con iniciales,
  nombre/equipo y tonos grises por grupo; evitar duplicar identidad del actor
  en el control del laboratorio. Preservar teclado y no crear espacios grandes.
- Recorrido: overlay exterior oscuro con hueco en el objetivo, explicación
  posicionada junto a él, seguimiento de scroll/resize, pasos interiores por
  módulo permitido, despliegue necesario, foco/restauración/teclado y Escape.
  El encargado no recibe un paso de Cierre. Respetar movimiento reducido.
- Conservar animación/teclado de arrastre, controles de tema y Mi jornada.
  Resolver el aviso de bundle con separación coherente sin ocultar el límite.

## 6. Aceptación del bloque de correcciones

Convertir los once casos R01–R11 del informe en regresiones con expectativas
correctas; incluir el caso asíncrono de evidencia sin pérdida de una edición,
confirmación comercial por todas las rutas, filtros de ruta, snapshots antiguos,
calendario y destinatarios. Cubrir matriz empleado/encargado/jefe y privacidad.

Ejecutar suite completa, TypeScript, build cliente/Worker y cuatro E2E Edge,
ampliándolos para los controles nuevos. Verificar escritorio/móvil, teclado,
tema, drag, tooltips y guía; cero API operativa. Repetir benchmark de 24 perfiles
y 2.000 tareas, diez ciclos, p95 caliente <1.000 ms con equipo/navegador.
Actualizar evidencia y documentos; luego solicitar la revisión GPT-6.1 Sol,
esfuerzo alto, Standard conforme al flujo del usuario. Commit, Site y paquete PC
se preparan después del corte sin correcciones conocidas.

## Continuidad de revisión — 11/10/2026

Este documento es el contrato del corte 07/10, no una orden de volver a ejecutar
sin contraste sus correcciones ya realizadas. La auditoría integral posterior
está en SOL-AUDIT-20261008.md y la matriz vigente en
SOL-REQUIREMENT-COVERAGE-20261008.md. Sus 58 hallazgos abiertos exigen decisiones
y regresiones propias; los once casos históricos no los sustituyen. Mantener el
alcance aprobado y las prohibiciones de API/cuentas/SQL remoto.
