# Segunda revisión del legado

Fuente: Valentinomagni/tablero-contable-grupo-paris, commit 4b29544085b70ce2349642608a3de0f9de1c72f2, consultado en lectura el 30/09/2026. No se copiaron migraciones ni componentes legacy a la app nueva.

| Evidencia en origen | Idea recuperable | Decisión nueva |
|---|---|---|
| src/lib/recurrencia-ciclo.ts | Distinguir nuevo ciclo y reapertura; fechas sin corrimiento UTC | Instancias separadas por fecha; no reset de tarjeta; contador explícito de reaperturas |
| db/migraciones/migracion-24, 25, 45, 46 | Reinicios mensuales y semanales por mecanismos diferentes | Una regla de programación y un generador idempotente por ocurrencia |
| src/features/calendario/VacacionesModal.tsx y src/lib/vacaciones.ts | Rango, reemplazante, impacto y traspaso | Cobertura temporal sin cambiar el titular; ejecutor en sesiones de tiempo |
| src/features/organigrama/Organigrama.tsx | Responsable, hijos, carga y evolución | Relación explícita perfil/equipo/empresas; controles de edición de jefatura |
| src/lib/retrabajo.ts y comentarios de recurrencia-ciclo.ts | Separar correcciones de trabajo recurrente | No inferir eventos por texto del historial |
| docs/PROPUESTAS-PRODUCTIVIDAD.md y docs/ESTADO-DEL-PROYECTO.md §3.5 | Cronómetro quedó descartado | Pedido actual lo incorpora, con pausas y limitaciones de interpretación explícitas |
| src/features/resumen/RadarVencimientos.tsx | Vencimientos y ausencias como contexto | Incorporar radar después de consolidar cobertura y reglas de fechas |
| src/lib/delegaciones.ts y docs/superpowers/plans/2026-07-15-20B-delegacion-notificaciones.md | Delegación, aceptación y avisos | Mantener como siguiente módulo; no confundir con cobertura temporal |
| src/lib/plantillas.ts, notas.ts, bloqueo-area.ts | Instrucciones reutilizables, notas y esperas | Recuperar con propiedad/visibilidad explícitas; adjuntos privados en la etapa backend |
| docs/superpowers/plans/2026-07-14-roadmap-herramientas.md | QA oscuro/móvil, animación, componentes accesibles | Capturas de build real, temas y diálogo nativo; no copiar disposición anterior |
| docs/ESTADO-DEL-PROYECTO.md §3.4 | Advertía que código revisado no había sido visto en navegador | Verificar flujos y capturas además de tests antes de publicar |

La presencia de una función o un documento no demuestra que haya funcionado correctamente en producción. No se ingresó a cuentas de empleados; se revisaron código, planes y la pantalla pública de acceso.
