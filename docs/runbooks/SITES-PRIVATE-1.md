# Operación privada en Sites 1.0

> **Estado vigente — auditoría 11/10/2026:** este documento describe la ruta
> Worker/D1 histórica, conservada pero no activada por el laboratorio actual.
> La entrada vigente es LaboratoryWorkspace, con perfiles ficticios y sin /api.
> No ejecutar Primer uso ni Incorporación del equipo durante esta etapa.
> Seguir PROJECT-STATUS y EXECUTION-NEXT; cuentas e invitaciones reales se
> posponen hasta la aceptación funcional. Las afirmaciones de permisos de esta
> entrega no cierran los hallazgos de la auditoría actual.
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

## Empaquetado portable

El empaquetador incluido por Sites invoca `bash`; en Windows puede no existir.
Después de sincronizar la fuente con el flujo de Sites y completar el build,
generar y validar el archivo con `node scripts/package-site-archive.mjs
<ruta-absoluta-del-archivo.tar.gz>` (o `npm run package:site -- <ruta>`).
El script verifica que el build tenga el mismo `project_id`, incluya Worker y
cliente y copie las migraciones D1 a `dist/.openai/drizzle`. Usar el archivo con
la operación privada de guardado y despliegue; comprobar commit, versión y estado
final. El archivo contiene `dist/`, no el código fuente, y no cambia la audiencia.
