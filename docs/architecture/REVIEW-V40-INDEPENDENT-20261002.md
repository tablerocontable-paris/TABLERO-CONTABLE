# Revisión independiente de v40

Aplicación revisada: `1099e9d8ae47c2b1953288b7fa8d7d0bbd380fc5`.
Base documental: `269e16488e7350f13a101e431b00708a58fef328`.

**Resultado: A aceptado localmente en su funcionalidad. La QA visual completa
de claro/oscuro/móvil sigue abierta para la aceptación del producto final.**
Esto permite diseñar B/C; no autoriza migrar empleados ni declara producción.
La aplicación no se modificó durante esta revisión.

## Evidencia independiente

Se ejecutaron los 16 probes de v39 contra la aplicación v40 y cuatro regresiones
adicionales: **20 aprobados, cero fallas**. Las cuatro adicionales quedan en la
suite regular `tests/ui-a-acceptance.test.tsx`:

| Criterio | Resultado |
| --- | --- |
| Guardado fallido de Anterior | Conserva página, paso mostrado y avance almacenado |
| Actor distinto del perfil consultado | Titular e0 permanece; sesión y auditoría se atribuyen a m1 |
| Secuencia completa por rol | 11/14/16 pasos; un solo resaltado en cada paso; Listo limpia el foco; cambiar actor lo cierra |
| Recuperación del destino | Dos tarjetas disponibles producen un solo foco; filtro sin resultados y columna plegada usan encabezado; limpiar/desplegar recupera el foco sin apertura automática |

También pasan nuevamente los ocho casos originales (checklist, meta, perfil,
Mi día, ámbito empleado, cambio de actor, nota y conversión inválida) y los seis
casos del resaltado/avatar que fallaban en v39.

Las pruebas normales de gráficos capturan las props del cursor y ejercitan los
callbacks reales de App por empleado/equipo/sector. La fuente confirma relleno
0.12, borde 0.55, tooltip temático sin opacidad, barras máximas 28/22 y datos
sin cambios. Son pruebas con componentes de gráfico instrumentados, no una
simulación del SVG ni prueba visual del hover. La constante TOUR_VERSION es
única y se usa también al completar inducción.

## Visual y procedencia

La guía de preview administrado exige el skill `control-browser` antes de usar
el navegador y dice que, si no está disponible, no se improvise otro camino.
Ese skill no está disponible en el catálogo de esta sesión. No se abrió ni
calificó visualmente un preview en esta revisión. El error histórico
`net::ERR_BLOCKED_BY_CLIENT` de v37 sigue siendo histórico, no un nuevo intento.

Sites confirmó versión **40**, fuente exacta 1099e9d, archivo de build y acceso
restringido al propietario con cero visitantes externos. La versión correcta es
`appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85~appgver_d8f07e23ce4c81918847eeb7ea3de22f`.
En la documentación de la implementación faltaba la última `f`; se corrige el
registro documental, sin crear otra versión de la aplicación.

Se verificaron los 17 hashes congelados de v39: SQL, lector, gateway,
dependencias y helper idénticos. No se reabrió la revisión completa del lector.
Manifest y resultados en `review-evidence/v40-independent-manifest-20261002.json`.

La suite normal incorpora las cuatro regresiones nuevas: **210 pruebas en 18
archivos aprobadas**, build y diff check correctos. Su resultado está
en `review-evidence/v40-reviewed-suite-20261002.txt`. Build y diff check se
registran junto al manifest. Los probes históricos permanecen intactos.

## Próxima fase

**GPT-6.1 Sol, esfuerzo alto, Standard**: cerrar el contrato de datos/permisos B
y su relación con C, antes de redactar instrucciones ejecutables para Luna.
Revisar jerarquía multiarea, asignación conjunta puntual, cobertura seleccionada,
bajas/tareas huérfanas y comentarios privados; vincularlo a catálogo, inducción,
agenda y cierre/reportes. Separar cada bloque para que sea comprobable.
Todavía no crear servicios ni aplicar SQL remoto. Avance estimado: 40%.
