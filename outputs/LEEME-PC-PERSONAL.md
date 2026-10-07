# Grupo París en tu PC personal

Esta copia contiene el código y el historial Git del proyecto en el commit
d7e3fabee35594c4a002717430cb4ade217a5387. No incluye claves, tokens,
credenciales, node_modules ni el estado del laboratorio guardado en el navegador.

## Pasar el código

1. Copiá juntos grupo-paris-site-personal.bundle y este instructivo a un USB o
   una carpeta privada.
2. En la PC personal instalá Git y Node.js LTS si todavía no los tenés.
3. Abrí PowerShell en la carpeta donde dejaste el bundle y ejecutá:

    git clone .\grupo-paris-site-personal.bundle .\grupo-paris-contabilidad
    cd .\grupo-paris-contabilidad
    npm ci
    npm run dev -- --host 127.0.0.1

4. Abrí la carpeta grupo-paris-contabilidad en Codex para continuar el código.
   El sitio local queda disponible en http://127.0.0.1:5173.

No sincronices la carpeta activa ni su carpeta .git mediante OneDrive. Trabajá
desde una sola PC a la vez. El bundle es un punto de partida; sin una cuenta
propia de GitHub todavía no hay sincronización automática de Git entre
computadoras.

## Pasar la simulación del navegador

El código y los datos de prueba viajan por separado. En la PC actual, entrá al
Site privado con la misma cuenta propietaria y descargá la copia desde la banda
«Vista de prueba». Transferí ese JSON junto con el bundle y, en la otra PC,
abrí el mismo Site y usá «Restaurar copia». Confirmá el reemplazo cuando la
vista previa muestre los datos correctos.

El JSON no está cifrado y puede contener anotaciones ficticias: guardalo en un
medio privado y borrá copias temporales después de importarlo. No incluye datos
reales de clientes.

Site existente: https://grupo-paris-contabilidad.valentino-magni.chatgpt.site
Proyecto Sites: appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85
