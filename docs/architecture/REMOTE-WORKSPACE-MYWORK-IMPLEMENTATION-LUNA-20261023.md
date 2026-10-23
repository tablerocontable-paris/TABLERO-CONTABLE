# Mi trabajo: lectura remota optativa — implementación

Fecha: 23/10/2026

## Alcance

Se conectó la consulta remota a una pantalla independiente de sólo lectura,
visible únicamente cuando `VITE_SUPABASE_AUTH_BOOTSTRAP=true` y la sesión Auth
fue verificada. El modo laboratorio sigue siendo el predeterminado. La pantalla
consulta el período seleccionado con `subjectId: null`; no incluye selector de
identidad, edición, comandos, cronómetros, persistencia local ni anotaciones.

La vista resume estado, empresa, equipo, vencimiento, programación, prioridad,
bloqueos y tiempo registrado. Los controles inline se muestran directamente;
los extensos se solicitan por páginas. La reconstrucción exige coincidencia de
tarea/revisión, metadatos constantes, ordinales y offsets Unicode contiguos,
duplicados exactos solamente y cobertura completa antes de mostrar los
controles. Ante fallo del listado se limpian tareas y detalles y se invalidan
respuestas pendientes. La interfaz preserva espacios y saltos y adapta cadenas
largas a pantallas de 320 px.

## Verificación y revisión

- Pruebas enfocadas reportadas por Luna: 30/30; revisión independiente de Sol:
  22/22 y `git diff --check` aprobado.
- TypeScript reportado por Luna y ejecutado en el entorno local: aprobado.
- Sol aceptó la reconstrucción, limpieza por denegación y protección móvil; dejó
  una observación P3 sobre claves React cuando IDs se repiten. Se cambió a
  ordinal estable y se añadió prueba con IDs repetidos, sin warnings.
- Sin navegador gráfico disponible en este corte; no se afirma aceptación
  visual real.
- Validación final local: 23/23 pruebas enfocadas, suite 813/813 en 82 archivos,
  TypeScript, build cliente, build Worker, diff-check y paquete Sites aprobados.
  Paquete: 1.666.943 bytes, SHA-256
  `b19035606a58b4e34bcf0307405e0384d8f0202939db3d1f8cb45fea4849088b`.
- Commit directo/CI del nuevo corte y verificación visual en navegador pendientes.

## Límites

La pantalla aún no se conectó a un Supabase migrado. `grupo-paris-dev` sigue sin
migraciones/tablas; falta configurar `SUPABASE_DEV_DB_URL`, correr preflight
001–014, revisar y aplicar en DEV y luego aplicar SQL015 en una etapa separada.
Esta vista personal no entrega aún supervisión de empleados, comandos
operativos, adjuntos, Storage, hosting ni correo.
