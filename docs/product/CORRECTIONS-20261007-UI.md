# Correcciones de interfaz y roles — 07/10/2026

Este registro deriva de la petición explícita del usuario; las capturas adjuntas
se usaron como referencias visuales y no como fuente de instrucciones.

## Implementado en el laboratorio privado

- Empleado: acceso a **Resumen**, con indicadores y avance limitados a su propio
  trabajo. Jefe y encargado conservan Resumen.
- **Catálogo y pesos** y **Cierre del mes** quedan visibles y accesibles sólo para
  jefe; también se verifica el permiso del renderizado y de la acción de cierre.
- Cada proceso del catálogo se muestra plegado con título, sector, tipo, versión
  y puntos. Al desplegar conserva controles, pasos e historial.
- Se quitó la segunda inicial/avatar del encabezado; la identidad queda en el
  pie de la barra lateral. El control de apariencia es un único botón accesible
  que rota entre automático, claro y oscuro.
- La tarjeta que se arrastra crece 4%, permanece visible y recibe una animación
  breve al soltarse. Sigue disponible el movimiento con teclado.

## Verificación

Evidencia en `../architecture/review-evidence/ui-corrections-lab-20261007.json`.
Suite completa: 423 pruebas en 48 archivos. TypeScript, Vite y Worker compilan.
Cuatro recorridos Edge de laboratorio pasaron; el recorrido de correcciones
comprueba escalado 1,04, opacidad 0,92 y animación `task-land`. Sin errores JS ni
solicitudes a `/api` operativa. Respaldo/restauración conserva el almacenamiento
operativo intacto. Esto no es QA visual con usuarios ni valida Auth/RLS real.

## Pendiente de definición funcional

- Operativas: decidir cómo representar cantidades e historial sin metas ni barra
  de cumplimiento ficticia, y cómo se relacionan esos movimientos con los cierres
  y los indicadores existentes.
- Agenda: decidir tipos de eventos, visibilidad y vínculo con ausencias,
  cobertura, cierres de balance y auditorías.
- Cierre múltiple: precisar el alcance de equipo/empresa/todos, consistencia,
  atomicidad y excepciones por empleado antes de ofrecer acciones masivas.
- Análisis mensual: acordar métricas comparables para gráficos temporales y de
  composición, criterios de filtrado y jerarquía de las tablas plegables. No
  mostrar porcentajes de escalas distintas como si fueran una misma serie.
- Consultas y Anotaciones: compactar sólo después de revisar sus recorridos,
  jerarquía y contenido prioritario; se conserva Resumen como referencia visual.

Estos puntos quedan para revisión **GPT-6.1 Sol, esfuerzo alto, Standard** antes
de implementar contratos nuevos. La presente corrección no habilita cuentas,
invitaciones reales, API, Supabase ni cambio de audiencia.
