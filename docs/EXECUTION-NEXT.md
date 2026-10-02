# Próximo paso — revisión independiente de la reparación

**GPT-6.1 Sol, esfuerzo medio, Standard.** Revisar el arreglo implementado del
contrato `product/DEADLINE-EFFICIENCY-REPAIR-20261002.md`. Cuatro probes que
fallaban ahora están cubiertos por regresiones; 221 pruebas/20 archivos, build y
diff check aprobados. Revisar validación ISO, corte temporal, no-op/auditoría,
CSV y paneles. QA visual de claro/oscuro/Sistema continúa abierta.

Aplicación actual: Sites privado. El build de reparación se publicará desde el
commit que registra estas correcciones. Avance global 40%; no lista para migrar.
Tras aceptación, Sol alto diseña B/C.

## Trabajo de arquitectura a retomar después de aceptar el arreglo

**GPT-6.1 Sol, esfuerzo alto, Standard.** Aceptación local de la funcionalidad UI
A terminada contra v40. Ver `architecture/REVIEW-V40-INDEPENDENT-20261002.md`.
20 probes independientes pasan; cuatro regresiones quedaron en la suite regular.
Suite normal: 210 pruebas/18 archivos; build y diff check aprobados.
La QA visual completa de hover en ambos temas/móvil sigue pendiente para aceptar
el producto final. No es un bloqueo para diseñar datos/permisos.

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

No implementar B/C durante el diseño; no modificar migraciones aplicadas ni
aplicar SQL remoto. Crear servicios y migrar empleados sigue siendo futuro,
después de piloto y aceptación final.

Aplicación live: Sites v42 (mismo build que v41), fuente `20d4db3c151c3c2eb963352bde4578ab321a0a8d`,
versión `appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85~appgver_c8c11bed53e08191b963c2e770f681de`,
deploy `appgdep_6ac0053d99ec8191adc2f8769abecc19`, privado y activo:
https://grupo-paris-contabilidad.valentino-magni.chatgpt.site.
El build live incluye contraste por tema y anticipación local. Avance
**40% estimado (35–45%)**. Auth/MFA/RLS, integración, presencia,
concurrencia, correo e infraestructura final siguen pendientes.

El usuario cambia el esfuerzo/modelo manualmente; después basta «continuá».
No delegar ni simularlo. Continuidad: AGENTS.md y WORKFLOW-MODELS.md.
