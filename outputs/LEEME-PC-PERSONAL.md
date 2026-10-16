> **Continuidad actualizada 15/10/2026:** usar `grupo-paris-m2-1-accepted-20261015.zip`, esta guía y su manifiesto. M2.1 está aceptado localmente; el próximo contrato es M2-2A-OPERATIVE-API-LUNA-20261015.md. Los paquetes anteriores son históricos. El bundle conserva Git y el mismo proyecto; no configura cuentas ni migra datos del navegador.

# Grupo París en tu PC personal

Este instructivo acompaña el bundle Git y el manifiesto incluidos en el ZIP de
transferencia. El manifiesto registra la rama en `source_branch`, su commit en
`commit` y la huella del
bundle para verificar que ambos archivos pertenecen al mismo corte. El paquete
no incluye claves, tokens, credenciales, `node_modules` ni los datos del
laboratorio guardados en el navegador.

## Preparar el laboratorio

1. Extraé el ZIP en una carpeta privada. Deben quedar juntos este instructivo,
   `grupo-paris-site-personal.bundle` y `grupo-paris-site-transfer-manifest.json`.
2. En tu PC personal, prepará Git for Windows y Node.js 24 LTS con npm.
   La verificación de este corte registra sus versiones en el manifiesto.
3. En PowerShell, desde la carpeta extraída, cloná y verificá el código:

   ```powershell
   $bundle = (Resolve-Path .\grupo-paris-site-personal.bundle).Path
   $manifest = Get-Content .\grupo-paris-site-transfer-manifest.json -Raw | ConvertFrom-Json
   $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $bundle).Hash.ToLowerInvariant()
   if ($hash -ne $manifest.bundle_sha256) { throw 'El bundle no coincide con el manifiesto' }
   git clone --branch $manifest.source_branch $bundle .\grupo-paris-contabilidad
   if ($LASTEXITCODE -ne 0) { throw 'Falló la clonación' }
   git -C .\grupo-paris-contabilidad bundle verify $bundle
   if ($LASTEXITCODE -ne 0) { throw 'Falló la verificación del bundle' }
   $commit = git -C .\grupo-paris-contabilidad rev-parse HEAD
   if ($commit -ne $manifest.commit) { throw 'El commit restaurado no coincide' }
   cd .\grupo-paris-contabilidad
   ```

   La verificación del bundle se realiza dentro del Git recién clonado. La rama
   de integración contiene el corte actual; `main` puede seguir en un corte anterior.
4. Instalá las dependencias y los hooks; luego ejecutá las pruebas y abrí la app:

   ```powershell
   npm ci
   npm run hooks:install
   npm test
   npm run build
   npm run dev -- --host 127.0.0.1
   ```

5. Abrí la carpeta `grupo-paris-contabilidad` en Codex. El laboratorio local
   queda en `http://127.0.0.1:5173`.

## Volver con cambios

Trabajá desde una sola PC a la vez. En la PC personal, generá un bundle de tu
rama `migration/github-bootstrap` y transferilo por USB o una carpeta privada:

```powershell
git bundle create .\grupo-paris-cambios.bundle migration/github-bootstrap
```

En el checkout original, buscá el bundle recibido y aplicá sus commits sobre la
rama actual. Si `migration/github-bootstrap` avanzó desde el corte transferido, rebasá primero los
commits personales para conservar el historial lineal:

```powershell
git fetch C:\ruta\grupo-paris-cambios.bundle migration/github-bootstrap:refs/remotes/personal/migration/github-bootstrap
git switch -c personal-transfer refs/remotes/personal/migration/github-bootstrap
git rebase migration/github-bootstrap
git switch migration/github-bootstrap
git merge --ff-only personal-transfer
```

Revisá el diff y ejecutá `npm test` y `npm run build` antes de publicar. No
sincronices `.git` ni el checkout activo con OneDrive/Dropbox. GitHub aún no está
conectado a la cuenta nueva autorizada; ése es el siguiente requisito para
sincronización automática entre PCs. Al conectarlo, verificar propietario y repo
privado antes de configurar origin. El origin de una clonación portable apunta
al archivo bundle local; no equivale a GitHub ni debe recibir un push.

## Pasar la simulación del navegador

El código y los datos ficticios del laboratorio viajan por separado. En el Site
privado, exportá el respaldo versión 2 desde «Vista de prueba» y transferí esa copia
por un medio privado. En la otra PC, abrí el mismo Site con la cuenta propietaria,
elegí «Restaurar copia» y revisá la vista previa antes de confirmar.

El respaldo v2 incluye evidencia local; revisar su vista previa. El respaldo v1
se acepta pero no incorpora los blobs de IndexedDB. La copia no está cifrada y
puede contener anotaciones ficticias. Guardala en un
medio privado y borrá copias temporales después de importarlo. No incluye datos
reales de clientes. El estado local del navegador no se sincroniza con Git.

Site existente: https://grupo-paris-contabilidad.valentino-magni.chatgpt.site
Proyecto Sites: appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85

La audiencia del Site debe seguir privada y exclusiva del propietario. El bundle
no concede acceso ni incluye credenciales de publicación.
