# Operación privada en Sites 1.0

## Configuración y publicación

Mantener `project_id` existente, `d1: DB`, sin `static` (hay Worker). Variables de servidor `OWNER_EMAIL` y `SITE_ORIGIN` se gestionan mediante Sites. La identidad de los usuarios llega de Sites en `oai-authenticated-user-id` y `oai-authenticated-user-email`.

Generar Drizzle sólo cuando cambie esquema. La migración0000 de esta versión crea tres tablas. Al publicarse se vuelve inmutable: cualquier cambio posterior agrega migración y metadatos. Nunca ejecutar DDL desde el Worker. No alterar las migraciones Supabase.

Ejecutar pruebas/build antes de publicar. El workflow guarda/pushea el estado fuente exacto y empaqueta `dist/client`, `dist/server/index.js`, configuración de assets y migraciones. Publicar por `save_version_and_deploy_private`; esperar estado terminal succeeded con URL. No cambiar audiencia para publicar.

## Datos y concurrencia

`paris_records` usa clave compuesta colección/id y JSON validado por entidad. `paris_workspace` guarda versión, revisión y token; no contiene un blob creciente de todos los meses. La lectura de cabecera y entidades ocurre en un batch. Cada batch escritor compara revisión y asigna token, condiciona UPSERT/DELETE a ese token y confirma todo atómicamente. Si pierde una carrera, ninguna entidad de su propuesta se modifica.

Las notas personales sólo aparecen en la proyección de su autor. La exportación de administración no incorpora notas privadas de otros empleados. Los cierres se calculan a partir del trabajo autorizado en servidor; sus snapshots no se editan. Los relojes se cierran con hora de servidor al completar, esperar o suspender el perfil.

## Primer uso

Entrar con la cuenta propietaria. Administrar tablero → Equipo: renombrar empresas y configurar perfiles/roles/correos y empresas. Abrir Mi tablero · Valentino, completar inducción y elegir procesos/fechas. No hay tareas ni cantidades ficticias en D1 inicial.

Esperar el estado Guardado en el servidor antes de cerrar. Con fallo de conexión puede descargar la propuesta/reintentar. Con409, descargar el cambio pendiente antes de cargar la versión guardada y rehacer sólo el cambio necesario. No reintentar a ciegas contra una revisión nueva.

## Incorporación del equipo

Crear perfil no cambia audiencia ni envía correo. Habilitar espectadores externos requiere pedido explícito del propietario, resolución de destinatarios y herramientas nativas de acceso. Antes: revisión visual real, piloto de varias cuentas, MFA y políticas de backup/restauración. No anunciar migración masiva por tener pruebas locales verdes.

## Evidencia de esta entrega

293 pruebas completas;20 operativas/UI después del refactor del almacenamiento. Incluyen SQLite real, transacciones, pérdida de carrera, privacidad, permisos, timer y cierre. UI en jsdom. Control-browser no disponible; no se ejecutó una sesión visual del sitio publicado ni pruebas de carga. Supabase/PostgreSQL real no se ejecutó y no pertenece al backend activo de esta versión.
