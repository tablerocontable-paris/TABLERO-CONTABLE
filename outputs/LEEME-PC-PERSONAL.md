# Grupo París en tu PC personal

Este instructivo acompaña el bundle `grupo-paris-site-personal.bundle` del ZIP
de transferencia vigente. Ese bundle contiene el mismo repositorio Git e
historial; no incluye claves, tokens, credenciales, `node_modules` ni los datos
del laboratorio guardados en el navegador.

## Pasar el código

1. Extraé el ZIP en una carpeta privada. Deben quedar juntos este instructivo y
   `grupo-paris-site-personal.bundle`.
2. En la PC personal instalá Git y Node.js LTS si todavía no los tenés.
3. Abrí PowerShell en esa carpeta y ejecutá:

    git clone .\grupo-paris-site-personal.bundle .\grupo-paris-contabilidad
    cd .\grupo-paris-contabilidad
    npm ci
    npm run hooks:install
    npm test
    npm run dev -- --host 127.0.0.1

4. Abrí `grupo-paris-contabilidad` en Codex para continuar. El laboratorio
   local queda en http://127.0.0.1:5173.

La configuración local del hook no forma parte del bundle: `npm run
hooks:install` activa `.githooks` en este clon. Trabajá desde una sola PC a la
vez. No sincronices la carpeta activa ni `.git`
con OneDrive/Dropbox. GitHub todavía no está conectado; por eso los cambios
entre PCs se pasan con bundles nuevos, no automáticamente.

## Pasar la simulación del navegador

El código y los datos ficticios viajan por separado. En el Site privado,
descargá la copia desde la banda «Vista de prueba». Transferí ese JSON junto con
el ZIP; en la otra PC, abrí el mismo Site con la cuenta propietaria y elegí
«Restaurar copia». Revisá la vista previa antes de confirmar.

El JSON no está cifrado y puede contener anotaciones ficticias. Guardalo en un
medio privado y borrá copias temporales después de importarlo. No incluye datos
reales de clientes. La simulación no se sincroniza con el bundle Git.

Site existente: https://grupo-paris-contabilidad.valentino-magni.chatgpt.site
Proyecto Sites: appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85

La audiencia del Site debe seguir siendo privada y exclusiva del propietario.
