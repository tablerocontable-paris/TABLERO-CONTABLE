# Grupo París en tu PC personal

Este instructivo acompaña el bundle Git y el manifiesto incluidos en el ZIP de
transferencia. El manifiesto registra el SHA exacto de `main` y la huella del
bundle para verificar que ambos archivos pertenecen al mismo corte. El paquete
no incluye claves, tokens, credenciales, `node_modules` ni los datos del
laboratorio guardados en el navegador.

## Preparar el laboratorio

1. Extraé el ZIP en una carpeta privada. Deben quedar juntos este instructivo,
   `grupo-paris-site-personal.bundle` y `grupo-paris-site-transfer-manifest.json`.
2. Instalá Git for Windows y Node.js LTS si todavía no los tenés.
3. En PowerShell, desde la carpeta extraída, cloná y verificá el código:

   ```powershell
   git bundle verify .\grupo-paris-site-personal.bundle
   git bundle list-heads .\grupo-paris-site-personal.bundle
   git clone --branch main .\grupo-paris-site-personal.bundle .\grupo-paris-contabilidad
   cd .\grupo-paris-contabilidad
   git rev-parse HEAD
   ```

   El SHA de `git rev-parse HEAD` debe coincidir con `source.commit` del
   manifiesto.
4. Instalá las dependencias y los hooks; luego ejecutá las pruebas y abrí la app:

   ```powershell
   npm ci
   npm run hooks:install
   npm test
   npm run dev -- --host 127.0.0.1
   ```

5. Abrí la carpeta `grupo-paris-contabilidad` en Codex. El laboratorio local
   queda en `http://127.0.0.1:5173`.

## Volver con cambios

Trabajá desde una sola PC a la vez. En la PC personal, generá un bundle de tu
rama `main` y transferilo por USB o una carpeta privada:

```powershell
git bundle create .\grupo-paris-cambios.bundle main
```

En el checkout original, buscá el bundle recibido y aplicá sus commits sobre la
rama actual. Si `main` avanzó desde el corte transferido, rebasá primero los
commits personales para conservar el historial lineal:

```powershell
git fetch C:\ruta\grupo-paris-cambios.bundle main:refs/remotes/personal/main
git switch -c personal-transfer refs/remotes/personal/main
git rebase main
git switch main
git merge --ff-only personal-transfer
```

Revisá el diff y ejecutá `npm test` y `npm run build` antes de publicar. No
sincronices `.git` ni el checkout activo con OneDrive/Dropbox. GitHub aún no está
conectado; la sincronización automática entre PCs forma parte de la etapa de
infraestructura posterior a la aceptación final.

## Pasar la simulación del navegador

El código y los datos ficticios del laboratorio viajan por separado. En el Site
privado, exportá el estado desde la banda «Vista de prueba» y transferí ese JSON
por un medio privado. En la otra PC, abrí el mismo Site con la cuenta propietaria,
elegí «Restaurar copia» y revisá la vista previa antes de confirmar.

El JSON no está cifrado y puede contener anotaciones ficticias. Guardalo en un
medio privado y borrá copias temporales después de importarlo. No incluye datos
reales de clientes. El estado local del navegador no se sincroniza con Git.

Site existente: https://grupo-paris-contabilidad.valentino-magni.chatgpt.site
Proyecto Sites: appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85

La audiencia del Site debe seguir privada y exclusiva del propietario. El bundle
no concede acceso ni incluye credenciales de publicación.
