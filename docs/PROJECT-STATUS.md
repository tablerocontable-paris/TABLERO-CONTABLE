# Estado del proyecto — 01/10/2026

**Avance alto en la demostración; avance intermedio hacia el producto final.**
No está listo para migrar empleados. Se registra el progreso por entregables,
porque aún no existe una estimación ponderada que justifique un porcentaje total.

| Etapa | Estado actual |
| --- | --- |
| Experiencia y reglas de trabajo | Demo avanzada: cuatro empresas, tablero independiente y filtros, recurrencias, KPI/pesos, cronómetros, inducción, anotaciones, temas, ausencias y laboratorio local |
| Contrato de datos/servidor | SQL 001–008 preparado y probado localmente; defensa R008-01 aceptada. Reportes/outbox, aprobación y jerarquía presentes en SQL. Ajuste pequeño pendiente en una prueba de la guía PostgreSQL |
| Integración y producto restante | Pendientes adaptador frontend/SQL, cuentas reales y permisos, anotaciones privadas en servidor, administración completa, Kaizen/5S orientados a procesos y controles restantes de producto |
| Validación y operación | Pendientes dos conexiones PostgreSQL, Supabase Auth/invitaciones/MFA/RLS, correo, respaldo/restauración, QA visual/accesibilidad/volumen y piloto con Juan Pablo |
| Infraestructura y migración | Futuras cuentas dedicadas Gmail/GitHub/Supabase dev/prod/hosting, automatización de entregas y migración manual por equipos; no creadas aún |

## Evidencia actual

151 pruebas en 13 archivos, 32 casos críticos individualizados, build y 30 archivos
congelados verificados para v26. La revisión confirma esa evidencia y detecta una
llamada de empleado incorrecta en la rama previa al corte de la guía; el SQL la
rechaza correctamente. No hay evidencia de ese problema en datos reales.

La demo usa localStorage y selector simulado. Que haya pruebas SQL verdes no
significa que esos permisos ya gobiernen la página ni que se envíe correo.

## Siguiente camino

1. Corregir actor y aceptación de guía (Luna medio), revisión acotada Sol medio.
2. Preparar integración del frontend con el contrato actual, sin crear servicios
   antes de la decisión prevista; construir adaptadores y aceptación local.
3. Completar producto y validaciones reales/piloto antes de migrar a compañeros.
4. Al aprobar la versión definitiva, registrar esa decisión y activar los nuevos
   servicios dedicados y flujo dev/prod según AUTOMATED-DELIVERY.md.

Referencias: architecture/REVIEW-008-FINAL-20261001.md, EXECUTION-NEXT.md,
PRODUCT-ROADMAP.md y ops/AUTOMATED-DELIVERY.md. La página y código continúan en Sites
privado; cada publicación nativa registra su SHA exacto en Git/main.
