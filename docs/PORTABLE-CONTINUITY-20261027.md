# Continuidad portátil — Grupo París

Actualizado el 28/10/2026. Éste es el estado para retomar el proyecto desde otra
PC o aplicación; la documentación anterior de este archivo quedó reemplazada.

## Fuentes vigentes

- Repositorio privado: [`tablerocontable-paris/TABLERO-CONTABLE`](https://github.com/tablerocontable-paris/TABLERO-CONTABLE), rama `main`.
- Último cambio funcional: `ecf4d3542d460bc684590d0e7f699f65c9212dfb`, autor
  `tablerocontable-paris`; commit directo, sin PR. GitHub confirmó repositorio
  privado, rama por defecto `main` y permisos de administración/escritura para
  la cuenta conectada.
- Site de laboratorio existente:
  <https://grupo-paris-contabilidad.valentino-magni.chatgpt.site>, versión 102,
  fuente Sites `4e795dde520a62606f7cfe671ae0b7e10d0f2733`. Conserva acceso
  personalizado al propietario, sin invitados externos.
- GitHub y la fuente del Site son repositorios distintos. Un push a GitHub no
  despliega el Site automáticamente; la publicación se hace con Sites y conserva
  la audiencia actual.

## Estado funcional comprobado

El laboratorio ahora ofrece las siete unidades solicitadas: PARIS AUTOS, DORAL,
PARIS CARS, PARIS TRAC, MOTOR, FIDEICOMISO DESARROLLO y POSTVENTA. El catálogo
v3 tiene 55 tareas con códigos y nombres canónicos. Las 55 se pueden elegir;
25 están confirmadas para comparación y 30 son provisionales, cada una con
código propio y excluida de comparaciones entre unidades hasta confirmar su
alcance. Banco, cuenta, sucursal, sistema, período y otros datos son parámetros
separados, no parte del nombre de tarea. “Carga de otras facturas” exige indicar
el subtipo. Catálogos v1 y v2 se conservan para leer registros anteriores.

La suite completa pasó **865/865 pruebas en 87 archivos**; TypeScript, build del
cliente, Worker y paquete Sites también pasaron. El hook previo al commit pasó
**223/223** y las pruebas focales del catálogo/onboarding/analítica **51/51**.
El build conserva avisos de Rollup por comentarios de Zod y por el chunk
principal (655 kB). No se tocaron Supabase, Auth operativo, `/api` ni SQL001–016.

El Site y el repositorio siguen en modo laboratorio: perfiles y datos ficticios.
El despliegue no constituye aceptación para producción ni habilita usuarios
reales.

## Continuar desde la PC personal

1. Iniciá sesión en GitHub con `tablerocontable-paris` (repositorio privado).
2. Instalá Git for Windows y Node.js 24 LTS si faltan. Node instala `npm`.
3. En PowerShell:

   ```powershell
   cd $HOME\Documents
   git clone https://github.com/tablerocontable-paris/TABLERO-CONTABLE.git
   cd TABLERO-CONTABLE
   npm ci
   npm run hooks:install
   npm run dev -- --host 127.0.0.1
   ```

4. Abrí `http://127.0.0.1:5173`.
5. Si continuás con Codex, abrí la carpeta clonada en Codex e iniciá sesión con
   la cuenta que tenga acceso al repositorio. Para actualizar, ejecutá
   `git switch main` y `git pull --ff-only origin main`.

Trabajá desde una PC a la vez. Antes de cambiar, guardá y publicá los cambios en
`main`; luego actualizá la otra copia. Las modificaciones acordadas se integran
directamente a `main`, sin Pull Request.

## Datos y servicios

GitHub sincroniza código, historial, contratos, documentación y pruebas. No
sincroniza el estado del navegador, IndexedDB ni la base D1 alojada por Sites.
Un respaldo de laboratorio se exporta desde la interfaz y se guarda fuera de
GitHub; no está cifrado. No subir datos de clientes, archivos originales,
credenciales, sesiones ni anotaciones privadas.

Supabase DEV y SQL001–016 continúan separados del laboratorio y no se migran al
abrir el clon. No configurar credenciales en el repositorio. Antes de retomar,
leer `AGENTS.md`, `docs/PROJECT-STATUS.md`, `docs/EXECUTION-NEXT.md` y
`outputs/LEEME-PC-PERSONAL.md`.
