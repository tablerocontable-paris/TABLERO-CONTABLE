# Decisiones vigentes — 30/09/2026

## Infraestructura futura (pedido expreso, todavía no ejecutar)

Durante el desarrollo: código, commits, versiones y deploy privado en Sites. Al validar la versión definitiva: crear un GitHub nuevo, Supabase nuevo y alojamiento nuevo (Cloudflare, Vercel u opción que se elija entonces), bajo una cuenta dedicada propuesta como **tablerocontable@gmail.com**. La cuenta no fue creada ni se verificó su disponibilidad. No hay que contratar ni migrar servicios ahora. Preservar legado como consulta durante la transición.

## Personas y permisos

- Valentino es empleado. Su gerente es **Juan Pablo**. La cuenta de trabajo de Valentino no administra el sistema por defecto.
- Juan Pablo crea/invita usuarios, administra acceso, equipos, organigrama, empresas y catálogo. En producción se enviarán invitaciones/restablecimientos seguros, sin mostrar ni guardar contraseñas en la interfaz.
- Encargado: su propio trabajo y empleados asignados. Empleado: su perfil y tareas; durante una cobertura autorizada, acceso temporal al trabajo del titular.
- Cuenta técnica separada de Valentino: fuera del organigrama operativo, asignaciones y KPI. Puede consultar diagnóstico global autorizado; para probar escrituras usa un laboratorio con datos aislados. No emite señales de presencia del personal. Su acceso queda en auditoría técnica y no es un acceso oculto sin trazabilidad.

## Reglas que reemplazan al legado

- Una tarea puntual nunca vuelve por cambiar de mes. Diaria/semanal/mensual requieren elección expresa.
- Cada ocurrencia tiene fecha, vencimiento, estado, checklist y sesiones propios. El vencimiento se recalcula; no se copia el de octubre a noviembre.
- Frecuencia y vencimiento son distintos: repetir los lunes no obliga a vencer el lunes; puede no tener vencimiento o tener un plazo desde cada realización.
- Inducción por usuario y por tarea: identidad/contexto asignados, catálogo y múltiples particulares, regla individual, previsualización. No aplicar una frecuencia global a todas las tareas.
- Cronómetro pedido ahora por Valentino: reemplaza decisiones antiguas que lo descartaban. Inicio/pausa/reanudación, pausa al terminar o esperar; un solo cronómetro activo por ejecutor. Es tiempo registrado, no prueba de atención continua ni calificación automática.
- Nuevo ciclo no significa reapertura. Reaperturas se cuentan con un campo/evento explícito, nunca buscando palabras dentro del historial.
- Vacaciones/licencias: rango, reemplazante autorizado y nota de traspaso. Se preserva titular y se identifica ejecutor. Las ausencias no cambian automáticamente vencimientos ni pesos.
- Reprogramar conserva ocurrencias históricas. Sólo reemplaza trabajo futuro pendiente sin actividad; bloquea cambios a trabajo iniciado o cerrado.
- Tema claro/oscuro/sistema; conservar preferencia y verificar contraste y pantalla pequeña.

## Estado 0.4

Implementado en demostración local: criterios anteriores de recurrencia, cronómetro, cobertura, laboratorio aislado, temas, administración de perfiles y planificación, además de KPI/cierre de 0.3. Las vistas de usuarios siguen siendo simulación; aún no hay cuentas reales.

El esquema SQL 0.3 NO constituye todavía el backend definitivo de 0.4. Se requiere adaptar ocurrencias por fecha, sesiones/ausencias y sus RLS/RPC antes de conectar. No conectar directamente el nuevo frontend a las RPC mensuales antiguas.

## Próximas etapas para llegar a versión definitiva

1. Consolidar contrato SQL de 0.4 y equivalencia con reglas de dominio; integración y tipos generados.
2. Administración completa: altas de encargados/equipos, invitaciones, suspensión, recuperación y MFA; guardar los roles en servidor.
3. Evidencia y trazabilidad: adjuntos privados, instrucciones por tarea, notas, historial tipado, motivos de reapertura y corrección auditada de tiempos olvidados.
4. Recuperar del legado con criterios nuevos: radar de vencimientos, dependencias/bloqueos, delegación con aceptación, avisos, búsquedas rápidas y reportes imprimibles. Ver evidencia en LEGACY-RECOVERY.md.
5. Accesibilidad y volumen: navegación por teclado, rendimiento con 20+ personas, casos vacíos/error/guardado, concurrencia y varias pestañas, pruebas de actualización/restauración.
6. Piloto sobre datos de prueba con Juan Pablo y un encargado; validar frecuencias y KPI con ejemplos conocidos.
7. Sólo después: infraestructura dedicada nueva, pruebas integradas, piloto real y migración manual por equipos.

No prometer ausencia total de errores: se reducen con reglas separadas, pruebas y piloto. La base actual es una evolución verificable; todavía no es una entrega productiva final.
