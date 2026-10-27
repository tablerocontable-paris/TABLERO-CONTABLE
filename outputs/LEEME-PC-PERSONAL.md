# Continuar Grupo París desde otra PC

Actualizado: 27/10/2026. La fuente de código e historia es el repositorio
privado [`tablerocontable-paris/TABLERO-CONTABLE`](https://github.com/tablerocontable-paris/TABLERO-CONTABLE), rama `main`.

## Estado comprobado

- HEAD actual: `ea99133402fbdae73b3a4bb7e4de42e4d8fc70d3`, documentación de
  continuidad. El último cambio de código es `9b54a4625f56e07fedbfba82d68696204f9a0e5d`.
- GitHub Actions #118 (`40557105221`) pasó instalación, pruebas completas,
  build y empaquetado Sites. [Ver ejecución](https://github.com/tablerocontable-paris/TABLERO-CONTABLE/actions/runs/40557105221).
- El Site privado existente está publicado como v99. GitHub Actions no lo
  despliega. El acceso personalizado no se amplió.
- La clasificación neutral de 26 conceptos se conserva en el laboratorio y en
  el estimador. El onboarding del primer login autenticado aún no está integrado.
- Las capturas permiten contar sólo 14 filas con nombre y una «Sin asignar» en
  una lista parcial; no acreditan la dotación vigente ni tareas completadas hoy.
  No hay extracto actual autorizado, así que esos totales siguen sin determinar.
- Supabase DEV tiene las migraciones 001–016. No repetirlas. Siguen pendientes
  la confirmación de Data API y las pruebas de permisos con identidades Auth.

## Traer el proyecto a esta PC

1. Iniciá sesión en GitHub con la cuenta que tiene acceso al repositorio privado.
2. Instalá Git for Windows y Node.js 24 LTS si todavía no están instalados.
3. En PowerShell:

   ```powershell
   git clone https://github.com/tablerocontable-paris/TABLERO-CONTABLE.git
   cd TABLERO-CONTABLE
   npm ci
   npm run hooks:install
   npm run dev -- --host 127.0.0.1
   ```

4. Abrí `http://127.0.0.1:5173`.
5. Para actualizar esta copia, detené el servidor y ejecutá:

   ```powershell
   git switch main
   git pull --ff-only origin main
   npm ci
   ```

Trabajá en una sola PC por vez. Antes de cambiar, subí los commits desde la PC
activa; luego traelos con `git pull --ff-only`. Los cambios acordados se publican
directamente en `main`, sin Pull Request.

## Qué sincroniza GitHub y qué no

GitHub conserva código, historial Git, especificaciones, decisiones de proyecto,
pruebas y evidencias técnicas saneadas. La memoria global de Codex y el historial
bruto de chats no se sincronizan como archivos del proyecto. Las decisiones
útiles ya se resumen en `AGENTS.md`, `docs/PROJECT-STATUS.md`,
`docs/EXECUTION-NEXT.md` y `docs/PORTABLE-CONTINUITY-20261027.md`.

El clon no incluye estado de navegador (`paris-state-lab`), IndexedDB ni la base
D1 alojada del Site. El respaldo de laboratorio se exporta/restaura desde la
interfaz y debe guardarse fuera de GitHub: no está cifrado. No se suben imágenes
originales, nombres, tareas identificables, comentarios privados, datos de
clientes, credenciales ni sesiones. Para calcular cifras reales hace falta un
extracto autorizado procesado localmente conforme a
`docs/product/ANONYMIZED-WORKFORCE-ESTIMATE.md`.

## Servicios y estado operativo

El Site de laboratorio sigue en el proyecto existente y conserva su audiencia.
Supabase DEV está separado; Auth operativo y el espacio operativo siguen
apagados. No hay infraestructura de producción ni despliegue automático del
Site conectado a GitHub. No compartas `SUPABASE_DEV_DB_URL` ni otra credencial
por chat, GitHub o este instructivo.

Para retomar el trabajo, leer primero `AGENTS.md`,
`docs/PROJECT-STATUS.md` y `docs/EXECUTION-NEXT.md`. No usar bundles/ZIPs
anteriores como fuente de código: clonar `main` desde GitHub.
