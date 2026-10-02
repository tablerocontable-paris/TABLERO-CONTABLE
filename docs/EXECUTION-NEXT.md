# Próximo paso — contrato B y relación con C

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

Aplicación live: Sites v40, fuente `1099e9d8ae47c2b1953288b7fa8d7d0bbd380fc5`,
versión `appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85~appgver_d8f07e23ce4c81918847eeb7ea3de22f`,
deploy `appgdep_6abffc86ca808191be701a9954b3e491`, privado y activo:
https://grupo-paris-contabilidad.valentino-magni.chatgpt.site.
Esta revisión sólo añade tests/evidencia/documentación; conserva el build live.
Avance **40% estimado (35–45%)**. Auth/MFA/RLS, integración, presencia,
concurrencia, correo e infraestructura final siguen pendientes.

El usuario cambia el esfuerzo/modelo manualmente; después basta «continuá».
No delegar ni simularlo. Continuidad: AGENTS.md y WORKFLOW-MODELS.md.
