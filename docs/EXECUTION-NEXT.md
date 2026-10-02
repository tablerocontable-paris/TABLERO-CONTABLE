# Próximo paso — aceptar A en v40

**GPT-6.1 Sol, esfuerzo medio, Standard.** Revisión independiente de la
implementación `1099e9d8ae47c2b1953288b7fa8d7d0bbd380fc5` contra
`product/CORRECTIONS-UI-A-FOLLOWUP-20261002.md` y
`architecture/REPAIR-A-V40-IMPLEMENTATION-20261002.md`.

La reparación ya está implementada y publicada como Sites v40. Se unificaron los
avatares, se conectó un solo spotlight a destinos visibles con fallback para
tablero vacío/columna plegada, se compartió la constante v4 y se atenuaron ambos
cursores. Suite completa: **206 pruebas / 17 archivos**; build y diff check
aprobados. No se tocaron SQL, lector, gateway, permisos, métricas ni servicios.

Deploy `appgdep_6abffc86ca808191be701a9954b3e491`, versión
`appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85~appgver_d8f07e23ce4c81918847eeb7ea3de22`,
estado succeeded. Sitio privado, 0 visitantes externos:
https://grupo-paris-contabilidad.valentino-magni.chatgpt.site. Inspección visual
completa del hover en móvil/claro/oscuro queda pendiente; el test valida props de
cursor y navegación del click por persona/equipo/sector.

Si Sol acepta A, **Sol alto** define servidor B/C y coordinación antes de Luna.
La integración real, Auth/MFA/RLS, concurrencia, presencia, correo e
infraestructura final siguen pendientes. Avance **40% (35–45%)**, no habilita
migración.

Continuidad en AGENTS.md, WORKFLOW-MODELS.md y PRODUCT-ROADMAP.md. El cambio de
modelo es manual; después basta «continuá». No delegar ni simularlo.
