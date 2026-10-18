> **Guía vigente 16/10/2026:** clonar directamente `https://github.com/tablerocontable-paris/TABLERO-CONTABLE.git`; `main` contiene la importación inicial con autor Tablero Contable. El flujo es push directo a `main`, sin PR. Autenticarse con la cuenta nueva y usar Node 24/npm: `npm ci`, `npm run hooks:install`, `npm test`, `npm run build`. El JSON ficticio de `paris-state-lab`/IndexedDB no viaja en Git; transferirlo sólo con el respaldo v2 y mantenerlo privado. No copiar `.git` por OneDrive. La guía Sites que sigue es histórica.

> El procedimiento Sites debajo quedó supersedido el 16/10/2026. Para la PC personal se usa el clon GitHub indicado arriba; no seguir los pasos que dicen que GitHub no hace falta ni que la conexión queda para después.

> Actualización de continuidad — 11/10/2026: el checkout local work/site y su Git son la fuente de esta auditoría. La guía de apertura desde Sites que sigue es histórica y no acredita que una segunda PC contenga los cambios locales aún sin commit. La transferencia vigente debe prepararse después del commit validado mediante bundle Git y guía local, conservando el mismo proyecto. El paquete actualizado sigue pendiente mientras existan las correcciones abiertas registradas en SOL-AUDIT-20261008.md y EXECUTION-NEXT.md. Los datos ficticios de paris-state-lab y la evidencia IndexedDB requieren respaldo versión 2 separado si se desea trasladarlos; el bundle de código no los incluye. No transferir credenciales ni asumir sincronización de datos entre navegadores.
# Continuar el mismo proyecto desde otra PC

El sitio y la fuente de Sites ya están asociados al proyecto
`appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85`. Para abrirlo desde una segunda
computadora:

1. Instalar/abrir Codex en esa PC e iniciar sesión con la cuenta que ya es dueña
   del Site. El acceso actual es privado para esa cuenta.
2. Abrir el Site existente desde
   `https://grupo-paris-contabilidad.valentino-magni.chatgpt.site` o desde su
   proyecto de Sites. No crear otro Site.
3. En esa sesión, abrir el repositorio de fuente de Sites con una credencial de
   escritura temporal y el helper `site-workflow.mjs` en modo apertura, desde
   una carpeta vacía. Ese flujo obtiene la rama `main` y devuelve el checkout
   local que se debe editar.
4. Terminar o subir el trabajo de una PC antes de editar desde la otra. Así las
   dos copias parten del último commit y evitan conflictos de Git.

No hace falta conectar un GitHub personal, Supabase ni Cloudflare propio para
esta continuidad: se usa la fuente administrada por el mismo Site y se conserva
su audiencia privada. La sincronización es entre checkouts autenticados; el
`localStorage` de pruebas de cada navegador no se comparte. Por eso este acceso
permite seguir el desarrollo, pero no prueba operación multiusuario en línea.

La fuente Sites no equivale al GitHub propio que exige la aceptación final. La
conexión de GitHub/Supabase/Vercel o Cloudflare personales queda para después de
aceptar el producto, como pidió el usuario.
