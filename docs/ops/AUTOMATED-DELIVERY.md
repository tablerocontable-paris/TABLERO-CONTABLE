> **Estado vigente 18/10/2026:** el repositorio privado `tablerocontable-paris/TABLERO-CONTABLE` y su workflow están configurados; `main` contiene el corte funcional `5803b1e4434cfc46a4ab64a26da3f76ab9d12d3d` y sincronizaciones documentales posteriores. El conector disponible no verifica ejecuciones Actions de push; run 18 fue de un SHA anterior. El único Supabase conectado es `grupo-paris-dev`, vacío. La Data API sigue con `public, extensions` expuestos y autoexposición activada según la última lectura; no aplicar SQL014. No hay hosting Cloudflare propio, correo transaccional ni Supabase de producción configurados. El usuario pidió push directo a `main`, sin PR ni aprobación manual.

> Los apartados inferiores que afirman que GitHub/Supabase no existen o que el flujo requiere PR son históricos y no describen el estado actual. El diseño que sigue debe ejecutarse con push directo a `main`; CI valida el SHA, pero migración y despliegue aún no están configurados.

> **Precedencia 14/10/2026 (histórica):** M1 local consolidado; contrato de migración en ../architecture/SUPABASE-M2-CONTRACT-20261014.md. El plan de PR y ramas `dev/main` de abajo queda reemplazado por la instrucción directa del usuario del 16/10. Workers Static Assets con Access sigue como candidato de hosting. Producción/datos reales/invitaciones requieren gates posteriores.

# Flujo objetivo de cambios y despliegues

Estado: decisión de producto acordada; configuración pendiente hasta la etapa de infraestructura nueva. El código permanece en Sites mientras validamos la aplicación. No se crearon GitHub, Supabase, Cloudflare ni Vercel nuevos.

## Entornos separados

- `dev` de GitHub conecta con un proyecto Supabase de desarrollo y un destino de preview/desarrollo.
- `main` conecta con un proyecto Supabase de producción y el dominio estable. Nunca se comparten URLs, claves, usuarios ni datos entre esos Supabase.
- Cada entorno usa secretos propios. No se guardan claves de servicio en el repositorio ni en el bundle web. En CI se prefiere identidad federada/OIDC cuando el proveedor lo soporte.
- Las migraciones versionadas se aplican primero en Supabase dev. CI ejecuta pruebas desde base vacía y actualización desde el fixture soportado. Producción recibe únicamente migraciones que ya pasaron las verificaciones de dev; se conserva copia de seguridad y plan de reversión.
- La herramienta final de hosting (Cloudflare Pages o Vercel, a decidir con la cuenta dedicada) necesita preview por rama y despliegue de producción ligado a `main`.

## Automatización que pidió Valentino

Una solicitud de cambio debe permitir que el asistente analice el alcance, implemente la modificación, ejecute validaciones, cree un commit y haga push directo a `main`, sin PR ni aprobación manual. El despliegue privado seguirá condicionado a que CI pase y a que los gates de Supabase/hosting estén verificados. El flujo objetivo será:

1. Crear/actualizar rama de trabajo; hooks pre-commit verifican tipos, pruebas rápidas y diff staged.
2. Push directo a `main`; CI corre pruebas, build, validación SQL desde cero/upgrade y chequeos de seguridad/dependencias.
3. Preview privado automático cuando el hosting quede conectado. Cambios SQL se prueban primero contra Supabase dev; nunca se ejecutan migraciones productivas desde la laptop.
4. Si CI falla, no se despliega. Producción requiere Supabase separado y gates de aceptación.
5. Despliegue de `main` y migración productiva sólo cuando el flujo esté configurado y aprobado, con registro de commit, migración y versión publicada. Health check posterior y rollback documentado.

El objetivo es que el pedido de cambio sea la única tarea rutinaria de Valentino. El alta inicial sí exige crear/verificar la cuenta de Gmail dedicada, repositorio GitHub, dos proyectos Supabase, dominio/hosting, secretos o federación y políticas de ramas. Esto se prepara cuando el producto y piloto estén aprobados; no se inventan ni exponen credenciales ahora.

## Protecciones necesarias antes de activar el automático

- `main` protegida; checks requeridos y sólo CI puede desplegar producción.
- CI conserva trazabilidad de la solicitud y commit; no publica fallos de build.
- Backups comprobados antes de migraciones de producción y migraciones compatibles con la versión desplegada durante la ventana de cambio.
- Supabase `dev` contiene sólo datos sintéticos. Los tests de rol, MFA, RLS, aislamiento por empresa y upgrade corren en CI.
- Cambios irreversibles de esquema, restauraciones, acceso a datos productivos o migración real de empleados requieren revisar y autorizar ese cambio concreto. La automatización rutinaria no debe convertir esos actos en implícitos.
- Nunca se aplican desde CI cambios de infraestructura o facturación no definidos en código y aprobados para el proyecto correcto.

## Estado histórico — corte 08/10/2026

El siguiente inventario refleja el corte de octubre 8, anterior a la creación del repositorio privado y del Supabase dev; no usarlo para decidir si esos servicios existen hoy.

- Git y deploy del prototipo siguen dentro de Sites; el sitio actual es privado. No existe aún el remoto GitHub ni los entornos Supabase dev/prod de la cuenta dedicada.
- La infraestructura y secretos no están configurados; por eso el flujo descrito es plan, no una capacidad activa.
- Corte de laboratorio revalidado el 08/10/2026: **500/500 pruebas en 58 archivos**, TypeScript, build cliente/Worker y cuatro recorridos Edge aprobados. Los recorridos registraron cero errores JavaScript y cero llamadas a `/api` operativa. Auditoría automatizada: 38 rutas y 2.124 controles accesibles sin nombres faltantes; contraste en 76 combinaciones y 5.943 textos sin omisiones ni fallos. El benchmark local fue 324,99 ms p95 con 24 perfiles y 2.000 tareas ficticias. Estas comprobaciones no equivalen a aceptación con lector de pantalla ni a Auth/MFA/RLS, correo, colaboración entre dispositivos o recuperación productiva.
- El hook `.githooks/pre-commit` ejecuta `node scripts/validate-change.mjs`, rechaza archivos rastreados parcialmente staged y sus pruebas rápidas y `npm test` excluyen `tmp/**` para no sumar clones locales ignorados. `.github/workflows/validate.yml` prepara CI para `pull_request` y pushes a `main`/`dev`: `npm ci`, suite completa, build y empaquetado/verificación del archivo de Sites mediante `scripts/package-site-archive.mjs`. El archivo se comprueba en el runner y no se publica como artefacto. El workflow no se ejecutó en GitHub porque el repositorio propio aún no existe.
- La validación local actual del hook pasó 130 pruebas rápidas. El paquete Sites correspondiente al corte actual se generó y se verificó sin publicarlo: `outputs/continuation-validation-20261008/grupo-paris-site-current.tar.gz`, 834.892 bytes, SHA-256 `520cf088e089ab15810d8c743ce00f522ba98df0fa7539a82fc14f00faf34da4`. Evidencia completa: `docs/architecture/review-evidence/continuation-validation-lab-20261008.json` y `delivery-readiness-local-20261008.json`.
- La automatización de apertura de PR, promoción `dev`/`main`, migraciones Supabase y hosting sigue pendiente de cuentas y configuración propias. No hay secretos ni destinos remotos conectados.
- No hay commit, PR ni publicación de este corte. Sigue pendiente la revisión GPT-6.1 Sol y la aceptación del producto; no se conectan cuentas antes de esa aceptación. Definición del 100% y puertas: FINAL-ACCEPTANCE.md. Avance global orientativo: aproximadamente 45%.

## Evaluación gratuita y puertas — 02/10/2026

Ver FREE-HOSTING-PATH-20261002.md para límites oficiales y etapas hacia dev real.
Cloudflare Pages es la preferencia de frontend; Vercel Hobby restringe uso a
personal no comercial. Supabase Free permite2 proyectos activos, pero sin
branching/backups automáticos; mantener dev/prod separados y preparar restore.
No se crearon recursos. Preparar integración antes de producto100% no implica
autorización para crear infraestructura ahora; registrar decisión de inicio y
validar versión definitiva antes de migración productiva.
