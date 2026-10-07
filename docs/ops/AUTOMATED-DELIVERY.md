# Flujo objetivo de cambios y despliegues

Estado: decisión de producto acordada; configuración pendiente hasta la etapa de infraestructura nueva. El código permanece en Sites mientras validamos la aplicación. No se crearon GitHub, Supabase, Cloudflare ni Vercel nuevos.

## Entornos separados

- `dev` de GitHub conecta con un proyecto Supabase de desarrollo y un destino de preview/desarrollo.
- `main` conecta con un proyecto Supabase de producción y el dominio estable. Nunca se comparten URLs, claves, usuarios ni datos entre esos Supabase.
- Cada entorno usa secretos propios. No se guardan claves de servicio en el repositorio ni en el bundle web. En CI se prefiere identidad federada/OIDC cuando el proveedor lo soporte.
- Las migraciones versionadas se aplican primero en Supabase dev. CI ejecuta pruebas desde base vacía y actualización desde el fixture soportado. Producción recibe únicamente migraciones que ya pasaron las verificaciones de dev; se conserva copia de seguridad y plan de reversión.
- La herramienta final de hosting (Cloudflare Pages o Vercel, a decidir con la cuenta dedicada) necesita preview por rama y despliegue de producción ligado a `main`.

## Automatización que pidió Valentino

Una solicitud de cambio debe permitir que el asistente analice el alcance, implemente la modificación, ejecute validaciones, cree un commit, haga push a la rama correspondiente y despliegue preview sin pedirle a Valentino pasos manuales. El flujo objetivo será:

1. Crear/actualizar rama de trabajo; hooks pre-commit verifican tipos, pruebas rápidas y diff staged.
2. Push y apertura de PR hacia `dev`; CI corre pruebas, build, validación SQL desde cero/upgrade y chequeos de seguridad/dependencias.
3. Preview automático de la aplicación. Cambios SQL se prueban contra Supabase dev; nunca se ejecutan migraciones productivas desde la laptop.
4. Al pasar todos los checks, promoción automática de `dev` a `main` según la política acordada. Si los checks fallan, no se promueve ni despliega.
5. Despliegue de `main` y migración de Supabase producción como pasos CI ordenados, con registro de commit, migración y versión publicada. Health check posterior y rollback documentado.

El objetivo es que el pedido de cambio sea la única tarea rutinaria de Valentino. El alta inicial sí exige crear/verificar la cuenta de Gmail dedicada, repositorio GitHub, dos proyectos Supabase, dominio/hosting, secretos o federación y políticas de ramas. Esto se prepara cuando el producto y piloto estén aprobados; no se inventan ni exponen credenciales ahora.

## Protecciones necesarias antes de activar el automático

- `main` protegida; checks requeridos y sólo CI puede desplegar producción.
- CI conserva trazabilidad de la solicitud y commit; no publica fallos de build.
- Backups comprobados antes de migraciones de producción y migraciones compatibles con la versión desplegada durante la ventana de cambio.
- Supabase `dev` contiene sólo datos sintéticos. Los tests de rol, MFA, RLS, aislamiento por empresa y upgrade corren en CI.
- Cambios irreversibles de esquema, restauraciones, acceso a datos productivos o migración real de empleados requieren revisar y autorizar ese cambio concreto. La automatización rutinaria no debe convertir esos actos en implícitos.
- Nunca se aplican desde CI cambios de infraestructura o facturación no definidos en código y aprobados para el proyecto correcto.

## Estado actual

- Git y deploy del prototipo siguen dentro de Sites; el sitio actual es privado. No existe aún el remoto GitHub ni los entornos Supabase dev/prod de la cuenta dedicada.
- La infraestructura y secretos no están configurados; por eso el flujo descrito es plan, no una capacidad activa.
- SQL011 tiene evidencia local de 26 escenarios de carrera PostgreSQL. La suite vigente pasó 420/420 en 48 archivos; TypeScript, Vite, Worker y cuatro recorridos Edge desktop/móvil también pasaron. Esta evidencia corresponde al laboratorio, no a Auth/MFA/RLS real, correo ni recuperación productiva.
- El hook `.githooks/pre-commit` ejecuta `node scripts/validate-change.mjs`; pasó 104/104 en el último commit. `.github/workflows/validate.yml` configura CI para `pull_request` y pushes a `main`/`dev`; ejecuta `npm ci`, la suite completa y el build. No se ejecutó en GitHub porque el repositorio propio aún no existe.
- La automatización de apertura de PR, promoción `dev`/`main`, migraciones Supabase y hosting sigue pendiente de cuentas y configuración propias. No hay secretos ni destinos remotos conectados.
- Definición del 100% y puertas: FINAL-ACCEPTANCE.md. Avance global orientativo: aproximadamente 45%.

## Evaluación gratuita y puertas — 02/10/2026

Ver FREE-HOSTING-PATH-20261002.md para límites oficiales y etapas hacia dev real.
Cloudflare Pages es la preferencia de frontend; Vercel Hobby restringe uso a
personal no comercial. Supabase Free permite2 proyectos activos, pero sin
branching/backups automáticos; mantener dev/prod separados y preparar restore.
No se crearon recursos. Preparar integración antes de producto100% no implica
autorización para crear infraestructura ahora; registrar decisión de inicio y
validar versión definitiva antes de migración productiva.
