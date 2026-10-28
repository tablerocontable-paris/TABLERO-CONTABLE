# Continuar Grupo París desde otra PC

Actualizado: 28/10/2026. La fuente de código e historia es el repositorio
privado [`tablerocontable-paris/TABLERO-CONTABLE`](https://github.com/tablerocontable-paris/TABLERO-CONTABLE), rama `main`.

## Estado comprobado

- El último corte es `ba26567` (`feat: add Paris business task catalog`),
  precedido por el catálogo normalizado `740804c`. Ambos están directamente en
  `main`, autor Tablero Contable, sin Pull Request. El commit de código pasó
  prueba focal 3/3, TypeScript y pre-commit 214/214.
- GitHub Actions #119 (`40558575748`) pasó instalación, pruebas completas,
  build y empaquetado Sites. [Ver ejecución](https://github.com/tablerocontable-paris/TABLERO-CONTABLE/actions/runs/40557105221).
- El Site privado existente está publicado como v99. GitHub Actions no lo
  despliega. El acceso personalizado no se amplió.
- La clasificación neutral de 26 conceptos se conserva en el laboratorio y en
  el estimador. El nuevo catálogo de Grupo París contiene siete unidades de
  negocio, tareas canónicas, códigos y alias de búsqueda; las filas ambiguas no
  se ofrecen como seleccionables. El catálogo todavía no está conectado a la
  pantalla de primer ingreso ni se guarda en tareas/asignaciones.
- Sol aceptó el diseño documental del onboarding (SHA-256
  `E65E1B467525B8AE4769E2F10EB33E238043078ED9D1E635468D0ADBD7C93D68`); la
  implementación y migración 017 siguen pendientes.
- Las capturas permiten contar sólo 14 filas con nombre y una «Sin asignar» en
  una lista parcial; no acreditan la dotación vigente ni tareas completadas hoy.
  No hay extracto actual autorizado, así que esos totales siguen sin determinar.
- Supabase DEV tiene las migraciones 001–016. No repetirlas. Siguen pendientes
  la confirmación de Data API y las pruebas de permisos con identidades Auth.
  La CLI de Supabase no está disponible en la PC de trabajo; no se creó ni se
  aplicó la migración 017.

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

Próximo trabajo concreto: integrar `src/domain/parisTaskCatalog.ts` al
onboarding y persistir `businessUnitCode` + `taskCode` versionados en las
propuestas, aprobaciones, asignaciones y tareas, sin alterar `companyId` ni los
registros históricos. Revisar el contrato remoto antes de migrar Supabase.
