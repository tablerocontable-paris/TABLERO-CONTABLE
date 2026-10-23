# Bootstrap optativo de Supabase Auth — implementación local

Fecha: 23/10/2026

## Alcance

Se añadió un punto de entrada optativo para comprobar Auth de Supabase sin
activar el tablero operativo. `VITE_SUPABASE_AUTH_BOOTSTRAP` debe valer la
cadena exacta `true`; configuración por sí sola no cambia el modo actual.
El valor de ejemplo es `false` y el arranque normal continúa en
`LaboratoryWorkspace`.

Con la bandera activa, URL o clave faltante/inválida muestra un error cerrado,
sin abrir el laboratorio como alternativa. Con configuración válida, el
cliente se crea una vez antes de React/StrictMode y se monta `SupabaseAuthGate`.
En el cableado posterior, después de autenticarse se monta `MyWork` de sólo
lectura (`workspacePageV2` y `taskChecklistPage`). No monta `RemoteWorkspace`, no
inicia comandos ni habilita el área operativa completa.

## Archivos

- `src/main.tsx`: arranque compartido.
- `src/mount.tsx`: resuelve configuración/cliente fuera del render y monta el
  árbol real con `StrictMode`.
- `src/bootstrap.tsx`: resolución de modo fail-closed y vista diagnóstica.
- `src/vite-env.d.ts`, `.env.example`: bandera tipada y apagada por defecto.
- `tests/bootstrap.test.tsx`: comportamiento por defecto, opt-in, error de
  configuración y una única instancia bajo el `StrictMode` de producción.

## Verificación y revisión

- Suite completa: **787 pruebas en 80 archivos**, aprobada.
- Bootstrap y validación de cliente/config: **14/14**; Auth Gate preexistente:
  **7/7**.
- `tsc --noEmit`, build Vite de cliente y build Worker: aprobados.
- Revisión Sol: aceptada. El hallazgo P2 inicial (doble creación del cliente
  por `StrictMode`) se reprodujo y corrigió creando la instancia antes de
  `createRoot`; la prueba ahora ejecuta el mismo montaje que `main.tsx`.
- El build muestra avisos de Zod/Rollup y del bundle principal superior a
  500 kB; no son fallos de esta corrección.

## Límites y continuidad — corte de implementación inicial

El bootstrap y el reporte ya están publicados en `main`; no se activó la bandera,
no se autenticó contra Supabase ni se hicieron escrituras. El repositorio activo
continúa siendo `work/site`.

El 23/10 se agregó un repositorio aislado de lectura para `workspacePageV2` y
`taskChecklistPage`, y se conectó a `MyWork` dentro del modo autenticado opcional.
No convierte DTOs a `State`, no ofrece comandos ni persistencia. Sol lo aceptó
localmente sin hallazgos bloqueantes. La revisión señaló dos mejoras P3 de
cobertura, incorporadas en la prueba enfocada; la aceptación se refiere al código
local y no demuestra integración con Supabase alojado.

La suite completa más reciente comunicada antes del cableado fue 795/795; el
repositorio nuevo pasó su prueba enfocada 8/8 y TypeScript. GitHub Actions
`40001331220` aprobó luego suite, build y paquete Sites para el código de
diagnóstico. La integración alojada sigue pendiente: el preflight `40000787076`
falló antes de conectar. Luego corresponden aplicación/auditoría de migraciones,
prueba end-to-end de Auth y lecturas, permisos/escrituras, almacenamiento,
hosting/correo y aceptación desde la PC personal.
