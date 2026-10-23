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
Después de autenticarse sólo aparece una pantalla diagnóstica mínima; no monta
`RemoteWorkspace`, no inicia comandos ni habilita el área operativa.

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

## Límites

Esta implementación está local y aún debe publicarse. No se activó la bandera,
no se autenticó contra Supabase ni se hicieron escrituras. Supabase DEV sigue
vacío; las migraciones 001–015 y la aceptación funcional desde la PC personal
siguen pendientes.
