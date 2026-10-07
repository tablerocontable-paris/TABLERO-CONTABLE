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
