# Publicación y operación

## Ubicación actual

- Fuente: repositorio Git privado asignado por Sites, rama main; ver git remote -v.
- Página: https://grupo-paris-contabilidad.valentino-magni.chatgpt.site (privada).
- Build: npm ci y npm run build; entrega estática dist/ declarada en .openai/hosting.json.
- Versiones: commit exacto enviado al remoto + archivo de build + publicación privada mediante Sites. Se verifica estado final del despliegue.
- GitHub/Cloudflare: el repositorio y la página anteriores no se modificaron. Todavía no hay repositorio GitHub nuevo ni deploy nuevo en Cloudflare.

## Verificación

npm test ejecuta reglas de dominio y las migraciones SQL completas sobre PostgreSQL PGlite. npm run build valida TypeScript y produce los assets.

La revisión de navegador comprueba alta/inducción/pausa/recuperación, dos conciliaciones del mismo banco en distintas empresas, checklist automático, registro operativo, agrupaciones analíticas, cierre íntegro aun con filtro, bloqueo posterior y ancho móvil. Esa revisión corresponde a la demo local, no a Supabase Auth/RLS real.

## Datos y recuperación

El sitio actual guarda en localStorage (paris-state-v3). No sincroniza entre dispositivos y una limpieza del navegador pierde la demostración local. La primera carga conserva la clave anterior y su copia de respaldo; no son datos de la base legacy. El histórico cerrado conserva tareas y actividad, además de la exportación CSV.

Para producción se debe agregar respaldo de la base nueva con retención y una restauración probada. Exportar CSV no reemplaza ese respaldo. Aplicar primero las instrucciones de docs/MIGRATION.md y validar un empleado piloto.

## Revertir una publicación

Seleccionar una versión anterior guardada en Sites y desplegarla preservando la audiencia. Revertir frontend no revierte datos SQL; las migraciones productivas requieren procedimiento propio y respaldo. No ejecutar una eliminación de tablas como rollback.
