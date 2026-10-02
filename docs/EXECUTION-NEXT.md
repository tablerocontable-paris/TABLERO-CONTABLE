# Próximo paso — arquitectura de coordinación y permisos

**GPT-6.1 Sol, esfuerzo alto, Standard.** La reparación de anticipación v43 está
aceptada localmente. Ver `architecture/REVIEW-V43-INDEPENDENT-20261002.md`.
Cuatro probes originales pasan; se verificó la frontera no-op del llamador y
CSV/paneles. QA visual real claro/oscuro/Sistema y móvil sigue abierta.

Diseñar el siguiente bloque acotado a partir de
`product/CORRECTIONS-20261002.md`, los contratos SQL 001–008 y el frontend actual:

1. Jerarquía gerente/encargado/empleado y equipos multiarea; empresa/sector son
   dimensiones independientes del equipo.
2. Asignación conjunta sólo puntual, una identidad y contribuciones sin doble
   KPI; distinguir titular, participante y actor real.
3. Cobertura por período y tareas seleccionadas, con historial y contribuciones
   preservados; retiro de acceso e historial después de la cobertura.
4. Bajas y tareas huérfanas reasignables; comentarios de bloqueo privados para
   superiores en datos/políticas separados.
5. Impacto sobre estandarización/inducción, recurrencia, vencimientos, cierres y
   reportes. Preparar matriz de invariantes/permisos y contrato ejecutable para
   Luna por bloque, sin decisiones abiertas.


Preparar contrato ejecutable para Luna por bloque, con matriz de invariantes,
permisos, identidad, snapshots y pruebas. Revisar SQL001–008 y datos existentes
antes de proponer migración nueva. No implementar ni aplicar SQL remoto durante
el diseño. Infraestructura final y migración de empleados son futuras.

Live: Sites v43, implementación `9d6b97dc16625c974d6679cf7d69b7fe2fdb3900`,
deploy succeeded `appgdep_6ac00b2ad81c81919a50bafab9f7101d`:
https://grupo-paris-contabilidad.valentino-magni.chatgpt.site.
Revisión actual sólo cambia tests/evidencia/documentación; conserva ese build.
Avance **41% estimado (35–45%)**; cálculo en PROJECT-STATUS.md.

El usuario cambia el esfuerzo/modelo manualmente; después basta «continuá».
No delegar ni simularlo. Continuidad: AGENTS.md y WORKFLOW-MODELS.md.
