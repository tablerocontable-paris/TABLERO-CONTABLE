# Grupo París · tablero contable en laboratorio

El repositorio mantiene el mismo proyecto privado de Grupo París. La interfaz publicada durante esta etapa entra por `LaboratoryWorkspace` y usa datos ficticios guardados en `localStorage` bajo `paris-state-lab`. No está habilitada para trabajo contable real.

## Qué se puede probar

- Perfiles, empresas, tareas y procesos de ejemplo; los selectores de perfil simulan usuarios y no autentican personas.
- Tablero con arrastre, cronómetros, tareas conjuntas, coberturas, cierres y reportes locales.
- Anotaciones, notificaciones, pedidos internos, ciclo de trabajo, Kaizen/5S y agenda de obligaciones con vínculos explícitos a tareas.
- La agenda distingue período fiscal de vencimiento, calcula su estado desde las tareas vinculadas y conserva las revisiones. Las fechas de muestra no se consultan ni validan contra ARCA.

## Datos, acceso y límites

El Site conserva audiencia personalizada owner-only. Los perfiles e invitaciones de la interfaz son simulaciones; no crean cuentas, no envían correo y no conceden acceso al Site. Los datos del laboratorio permanecen en el navegador actual, no se sincronizan entre computadoras y no deben contener información de clientes.

La ruta de laboratorio no llama a la API operativa. El código Worker/D1 y Supabase conservan contratos separados. El repositorio privado `tablerocontable-paris/TABLERO-CONTABLE`, rama `main`, es la fuente de código; los cambios se publican directamente, sin pull request, con autor **Tablero Contable**. El Site privado existente está en la versión 97 y sólo la cuenta propietaria puede abrirlo.

El proyecto Supabase `grupo-paris-dev` tiene aplicadas las migraciones 001–014; SQL015 sigue pendiente. Una consulta de sólo lectura del 26/10/2026 confirmó cero filas en `auth.users`, organizaciones, perfiles, empresas, equipos, catálogo, asignaciones, tareas y movimientos. Por eso DEV no contiene una nómina ni una línea base operativa. Falta verificar que Data API exponga sólo `api` y terminar la revisión de permisos antes de activar Auth/UI. El workflow de verificación usa `SUPABASE_DEV_DB_URL` como secreto de GitHub Actions; nunca guardes su valor en el repositorio.

El arranque conserva el laboratorio por defecto (`VITE_SUPABASE_AUTH_BOOTSTRAP=false`). El bootstrap autenticado sólo está preparado para diagnóstico; no abre el tablero ni activa el uso operativo. La inducción simulada conserva los seis conceptos `starter-v1-*` por compatibilidad y ofrece 26 sugerencias neutrales `starter-suggestion-v2-*`, opcionales, editables y pendientes de aprobación de jefatura. No crea tareas ni plantillas, y el primer ingreso autenticado aún no está implementado. Las capturas compartidas muestran 14 nombres de perfiles y fragmentos de títulos de tareas, pero no indican fecha, estado activo, IDs ni cierres. No permiten afirmar cuántas personas trabajan hoy ni cuántas tareas se completaron hoy. La normalización provisional se documenta en `docs/product/TASK-NORMALIZATION-DRAFT-20261026.md`; para cerrar el conteo real falta un extracto completo, anonimizado y fechado de la fuente original.

Aún no hay acceso real de empleados, notificaciones entre dispositivos, correo transaccional, fuente ARCA, hosting propio ni despliegue operativo. La producción, las cuentas reales y las invitaciones siguen deshabilitadas.

El repositorio privado conserva fuente e historial, no `localStorage`. Para continuar desde otra PC, clonar `https://github.com/tablerocontable-paris/TABLERO-CONTABLE.git` y trabajar sobre `main`, de a una PC por vez. El estado ficticio del navegador debe exportarse e importarse por separado desde la interfaz del laboratorio. Ver `outputs/LEEME-PC-PERSONAL.md` y `docs/EXECUTION-NEXT.md`.

## Desarrollo y validación

```sh
npm ci
npm test
npm run build
```

`npm run dev` inicia la vista local. El build compila TypeScript, Vite y el Worker separado; que compile no significa que el Worker o Supabase estén conectados a la vista del laboratorio. Para los límites vigentes, comprobaciones y próximo bloque, consultar `docs/PROJECT-STATUS.md`, `docs/EXECUTION-NEXT.md` y `docs/ops/FINAL-ACCEPTANCE.md`.
