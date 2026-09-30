# Análisis inicial del legacy y propuesta de reconstrucción

Revisión: 30/09/2026. Repositorio: https://github.com/Valentinomagni/tablero-contable-grupo-paris
Commit observado: `4b29544085b70ce2349642608a3de0f9de1c72f2`.
Acceso exclusivamente de lectura. No se modificó el legacy, su infraestructura ni sus datos.

## Alcance y límites

Se examinó el árbol completo y una muestra dirigida de documentación, tipos, alta de tareas, lectura de datos, períodos, duplicados, gráficos, autenticación y CI. No se ejecutaron tests del legacy, no se inspeccionó la base desplegada ni se comprobó que sus migraciones estén aplicadas. Los estados históricos documentados no certifican el estado actual de producción. Esta es una revisión inicial del código, no una auditoría completa de seguridad.

## A. Producto actual

Organiza tareas contables individuales y compartidas, checklist, recurrencias, actividad operativa, agenda, cierres mensuales e historial. Incluye Mi día, Mi mes, Semana, tablero, reportes, resumen de gestión, organigrama, administración, catálogo estándar, notas, consultas, adjuntos, objetivos y esperas externas. React + TypeScript + Vite, Supabase y TanStack Query. Hay módulos específicos de arqueo y transferencias que deben validar su necesidad de negocio antes de trasladarlos.

## B–D. Conservar, rediseñar y eliminar

| Concepto | Decisión | Motivo |
|---|---|---|
| Tablero y checklist | Conservar | Son el núcleo del seguimiento operativo. |
| Catálogo estándar | Conservar y versionar | Permite comparar el mismo trabajo aunque cambie su título. |
| Checklist por ocurrencia | Conservar | Evita perder evidencia de días anteriores. |
| Esperas por otra área | Conservar | Diferencia demoras externas de trabajo del empleado. |
| Mi día y agenda | Conservar | Orientan el trabajo diario. |
| Empresa / marca / sucursal / sector | Rediseñar | Son dimensiones distintas; no deben depender de etiquetas o texto libre. |
| Períodos y reinicios | Rediseñar | Hay distintas fuentes de estado para mes vigente, futuro y archivo. |
| Métricas | Rediseñar | Deben compartir período, alcance y denominador, con desglose verificable. |
| Permisos | Rediseñar | Roles explícitos y membresías por empresa/equipo, aplicadas en RLS. |
| Cuenta técnica oculta | Eliminar como mecanismo de diagnóstico | Reemplazar por auditor explícito con MFA y sesiones auditadas. |
| Compatibilidad permanente con base incompleta | Eliminar del nuevo arranque | Coordinar migraciones y despliegues, con contrato de esquema comprobado. |
| Objetivos / arqueo / transferencias | Investigar | El árbol prueba que existen; no prueba su uso o necesidad actual. |

## E. Hallazgos con evidencia

1. **La empresa no es un atributo obligatorio de la tarea.** `src/lib/types.ts` define Empresa, pero Card contiene marca/sucursal/etiquetas y no `empresa_id`. `src/features/board/NuevaTareaModal.tsx` tampoco requiere ni inserta empresa. La migración 31 crea el catálogo empresas, sin vincularlo a cards mediante una FK. El nuevo modelo necesita una empresa obligatoria por instancia.
2. **Las tareas parecidas se detectan por título.** `src/lib/similitud.ts`, función similares, excluye terminadas y calcula similitud de texto, sin empresa o período. El alta usa ese helper sobre las tarjetas del responsable. Es un aviso, no un bloqueo ni una fusión automática. Puede advertir sobre dos conciliaciones legítimamente independientes.
3. **El estado mensual tiene varias fuentes.** `src/lib/periodo-instancias.ts` devuelve cards para el vigente y combina card_periodos para otros períodos; fuenteDelMes también distingue archivo. `CardPeriodo.aplicado_at` y la documentación registran las correcciones necesarias para trasladar trabajo adelantado. Conviene una instancia por tarea/empresa/fecha o período, con la misma fuente para pasado, presente y futuro.
4. **Drift de esquema.** `src/lib/esquema.ts` elimina campos de escritura según migraciones aplicadas, pero COLUMNAS_CARDS es fija. `src/hooks/useData.ts` intenta leer esas columnas y recurre a select('*') ante error. Esto sostiene compatibilidad histórica, pero aumenta complejidad y puede ocultar despliegues incompletos.
5. **Migraciones en dos mundos.** `db/README.md` describe SQL manual y reconstrucción no probada. El árbol contiene migraciones numeradas hasta 57 y sólo .gitkeep en supabase/migrations. También hay scripts de migración: su existencia no demuestra una reconstrucción completa validada.
6. **Autenticación revela ausencia de cuenta.** `src/lib/auth.ts` devuelve un mensaje diferente para sin-usuario. El documento de permisos coincide. Es un riesgo de enumeración que requiere revisar el flujo backend; no se afirma una explotación verificada.
7. **Cuenta técnica oculta en el modelo.** Profile mantiene admin_sistema/oculto y comentarios de usuario fantasma. No se afirma una puerta trasera actual: la reconstrucción debe dar acceso técnico explícito, auditable y separado de roles laborales.
8. **CI verde puede no significar E2E ejecutado.** `.github/workflows/main.yml` documenta que los specs omiten ejecución sin E2E_USER/E2E_PASSWORD. Debe haber un estado visible de cobertura, y un check requerido que no dé por probado lo omitido.
9. **Gráficos poco aptos para comparación masiva.** `src/components/charts.tsx` ofrece donut, gauge y leyenda. Hay títulos SVG con valores, lo que es útil, pero una comparación de muchos empleados necesita barras ordenables, escala común, etiquetas y tabla. No se concluye que todas las pantallas del legacy carezcan de esos recursos.
10. **El README sigue siendo una plantilla de Vite.** No explica el producto, el modelo de acceso o el procedimiento de recuperación.

El documento ESTADO-DEL-PROYECTO declara correcciones y 1494 tests al 20/08. Esa cifra se conserva como dato histórico declarado, no como resultado ejecutado en esta revisión. Algunos problemas de seguridad registrados están documentados como cerrados; no corresponde presentarlos como vulnerabilidades actuales sin contrastar toda la cadena de SQL y el despliegue.

## F–G. Arquitectura y stack propuestos

React + TypeScript strict + Vite, React Router, TanStack Query, formularios validados con Zod, componentes y tokens semánticos. Supabase Auth/PostgreSQL/RLS/Storage; Edge Functions sólo para privilegios. Supabase/migrations como fuente única de esquema. Cloudflare para el frontend definitivo, repositorio privado y CI reproducible. Sites permanece como prototipo revisable: no equivale al sistema multiusuario definitivo.

## H–I. Autenticación y permisos

Invitación administrativa, activación, verificación y onboarding reanudable; sin registro público. Mensajes externos genéricos. MFA obligatorio para administración y auditor. Recuperación de cuenta mediante flujo seguro, evitando entregar contraseñas temporales como operación habitual.

| Rol | Lectura | Gestión |
|---|---|---|
| Empleado | Trabajo propio y compartido autorizado | Tareas propias según reglas y permisos |
| Encargado | Equipos y empresas asignados | Asignar y acompañar su ámbito |
| Jefe / admin funcional | Ámbito organizacional autorizado | Usuarios, catálogo y estructura |
| Auditor técnico | Diagnóstico explícito y autorizado | Preferentemente sólo lectura; sin contaminar métricas |

RLS deny by default. Cambios de rol y diagnóstico auditados. Ningún permiso depende solamente de ocultar botones.

## J. Onboarding

Identidad → contexto preasignado → empresas habilitadas → catálogo según puesto/sector → frecuencia y checklist por empresa → vista previa del mes → preferencias → tutorial contextual → confirmación. Persistir versión, paso y finalización. Crear la misma conciliación para dos empresas produce dos instancias independientes.

## K. Modelo de datos

Organización, empresas, sucursales, marcas, sectores, equipos, perfiles y membresías. Catálogo de tareas versionado; asignaciones y recurrencias; instancias con empresa_id obligatorio, responsable, fecha/período, vencimiento y estado. Checklist y actividad por instancia; dependencias y esperas externas separadas; adjuntos privados; eventos de auditoría y sesiones de diagnóstico.

No imponer unicidad por título ni banco. Para recurrencias usar clave idempotente de asignación + fecha/período + empresa. Una definición puede originar múltiples instancias sin que cambien juntas sus estados. Pasado y futuro se consultan en la misma tabla de instancias, sin resetear destructivamente evidencia.

## L. Identidad visual

Conservar el logo oficial, sidebar oscura, blanco/negro/grises, color sólo para estados, cifras tabulares, densidad de dashboard y lenguaje rioplatense. Escala tipográfica legible y foco visible. Se reutilizó el SVG oficial `public/brand/lockup-blanco.svg`, coherente con el adjunto, sin inventar una marca. El prototipo actualizado incorpora esa identidad.

## M–N. Estructura y fases

Repositorio nuevo: README, AGENTS, ARCHITECTURE, SECURITY; src por módulos de dominio; supabase/migrations; tests; docs/product, architecture, security y runbooks. No copiar la estructura histórica ni todas sus migraciones.

1. Validar mapa del producto, cuatro empresas reales, estructura de equipos y reglas de cierre.
2. Construir esquema reproducible, Auth, RLS y matriz de pruebas de acceso.
3. Alta, catálogo, instancias por empresa, checklist y recurrencias idempotentes.
4. Onboarding, Mi día, tablero y agenda con errores y estados vacíos.
5. Analítica con períodos y denominadores explícitos; exportación y desglose por tarea.
6. Auditoría, adjuntos, observabilidad, restauración probada y piloto de equipo.

## O. Herramientas útiles

GitHub se usó exclusivamente para lectura del commit indicado. Vitest y Testing Library para reglas y componentes; Playwright/axe para recorridos y accesibilidad; pruebas PostgreSQL/RLS y recreación desde cero para seguridad y esquema. No es necesario introducir microservicios, agentes múltiples ni infraestructura adicional para justificar la reconstrucción.

## P. Decisiones de negocio pendientes

- Nombres y relación legal de las cuatro empresas; marca y sucursal no son sustitutos.
- Equipos reales, responsables y ámbitos de encargados/jefes.
- Qué trabajos se repiten por empresa y qué trabajos son compartidos.
- Definición de cumplimiento, demora externa, complejidad y cierres fuera de término.
- Regla de cierre con checklist pendiente y manejo de excepciones.

## Lo que cambió ahora y lo que no está implementado

Se incorporó el logo oficial y la paleta monocroma al prototipo existente. Sus filtros por empresa, empleado y sector conservan tareas independientes. Los nombres de empresa y equipos siguen siendo ejemplos. El prototipo guarda localmente y no implementa RLS, usuarios reales, recurrencias ni auditoría. No se migraron datos ni se tocó infraestructura legacy.
