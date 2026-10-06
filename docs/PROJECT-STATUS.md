# Estado vigente — 06/10/2026 · laboratorio

**Avance global orientativo: aproximadamente 45%.** Referencia de planificación; no equivale
a aceptación ni se calcula a partir de tests. No está al 100% ni lista para
migrar empleados. El usuario exige terminar la versión final antes de crear
cuentas o enviar invitaciones reales.

## Entrada de esta etapa

El mismo Site vuelve a abrir el laboratorio con usuarios y datos ficticios.
No conecta la UI a /api/workspace ni importa datos operativos. El backend D1
recuperado sigue en el repositorio como ruta separada futura. SQL 001–011
permanece independiente y sin aplicación remota desde este chat.

Correcciones: menú sin barras internas/cortes, logo más grande y completo,
selector de simulación, invitaciones ficticias con perfiles preconfigurados,
aviso de parametrización para jefatura y control de plegado por icono.
Contrato y evidencia: product/CORRECTIONS-20261006-LABORATORY.md.

## Verificación

339 pruebas aprobadas en 33 archivos; compilación y diff-check aprobados.
Chromium local: escritorio/móvil, alta simulada de seis pasos, logo, menús,
tarjetas, aviso y persistencia; cero solicitudes a la API operativa y errores JS.
SQL 011 conserva su evidencia local previa: 26 carreras PostgreSQL aprobadas.

## Pendientes para la versión final

- Completar y aceptar funcionalidades del alcance original: conjuntas/cuotas,
  cobertura precisa y jerarquía multiarea en el backend activo; bajas/huérfanas,
  agenda/cumplimiento, consultas y procesos operativos pendientes.
- Revisar equivalencia de frontend, reglas, snapshots y privacidad al elegir
  la ruta definitiva D1 o Supabase. No mezclar sus esquemas o KPI.
- QA visual y funcional del producto completo, volumen, recuperación/respaldo,
  seguridad y ensayo controlado del circuito final.
- Sólo tras aceptar versión final: configurar cuentas e invitaciones reales,
  MFA y servicios; piloto autenticado e infraestructura dedicada/migración.

## Continuidad

Repositorio y commits originales recuperados; no leer/esperar el chat viejo.
Sol6.1 alto para razonar/planear/revisar próximos contratos; Luna6 medio para
implementarlos. No simular cambio de modelo ni delegación.

## Definición final de avance
Avance global aproximado: 45%. El 100% incluye GitHub propio, Supabase dev/producción y hosting funcionando, con entrega automática verificada y todas las correcciones conocidas cerradas. Ver ops/FINAL-ACCEPTANCE.md. Primero aceptación funcional del laboratorio; después configuración e integración de infraestructura. No enviar invitaciones reales ahora.

## Correcciones de marca y notificaciones
Logo alineado y centrado sin leyenda, cabecera compacta, campana para todos los perfiles y comentarios de tareas en laboratorio. Avisos de asignación, cambios, finalización y comentarios; lectura persistente por destinatario. Contrato conjunto preparado pero disparador funcional aún pendiente. Ver product/CORRECTIONS-20261006-NOTIFICATIONS.md. No se necesitan cuentas/conexiones para continuar estos bloques.

Verificación de este bloque: 339/339 pruebas en 33 archivos, build aprobado y Chromium escritorio/móvil aprobado con cero errores JS y cero llamadas a /api. Fuente y publicación privada del mismo Site; sin cambiar audiencia.

## Contrato conjunto listo para implementación
Revisado el desacople SQL011/laboratorio y cerrado architecture/JOINT-LABORATORY-CONTRACT-20261006.md. Define cambios de permisos, filtros, relojes, cuotas, cierre, reportes y avisos. Todavía no implementado; próximo Luna6 medio Standard. No suma avance funcional ni requiere conexiones.

## Tablero movible — 06/10/2026
Entregables arrastrables entre estados, orden antes/después y persistencia de orden manual. Cambio respeta transition(): iniciar abre sólo cronómetro del actor, completar requiere pasos y espera liberada, reapertura aumenta contador. Teclado Alt+flecha izquierda/derecha. Evidencia suite 341/341, build y Chromium con cero llamadas API operativa/errores JS.

## Tareas conjuntas del laboratorio — 06/10/2026

Implementación local para una ocurrencia puntual, dos participantes y cuotas
selladas. Incluye validación/idempotencia, snapshots, acceso acotado por miembro,
cronómetros paralelos por actor, métricas individuales/globales, cierre separado,
reporte v2 compatible con reportes v1 y aviso `joint`. UI de activación y tarjetas
en tableros personales integradas. Contrato y límites:
`architecture/JOINT-LABORATORY-CONTRACT-20261006.md`.

Verificación vigente: 348/348 pruebas en 34 archivos y 74 suites, build y recorrido Chromium
de activación 60/40, aviso, relojes A/B y pausa individual; recorrido general
Chromium desktop/móvil también pasa. Ambos: cero errores JS y cero solicitudes
a `/api`. Pendiente: ensayo UI del cierre v2 y aceptación visual con estado real.
La simulación usa localStorage de un navegador; no prueba colaboración entre
computadoras ni aislamiento Auth/RLS. No se conectó cuenta/API ni se aplicó
migración. El avance global orientativo permanece alrededor de45%; esto no
completa la aceptación funcional total ni la infraestructura del 100%.
