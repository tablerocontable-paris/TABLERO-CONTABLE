# Grupo París · tablero contable en laboratorio

El repositorio continúa el mismo Site privado de Grupo París. La interfaz publicada durante esta etapa entra por `LaboratoryWorkspace` y usa datos ficticios guardados en `localStorage` bajo `paris-state-lab`. No está habilitada para trabajo contable real.

## Qué se puede probar

- Perfiles, empresas, tareas y procesos de ejemplo; los selectores de perfil simulan usuarios y no autentican personas.
- Tablero con arrastre, cronómetros, tareas conjuntas, coberturas, cierres y reportes locales.
- Anotaciones, notificaciones, pedidos internos, ciclo de trabajo, Kaizen/5S y agenda de obligaciones con vínculos explícitos a tareas.
- La agenda distingue período fiscal de vencimiento, calcula su estado desde las tareas vinculadas y conserva las revisiones. Las fechas de muestra no se consultan ni validan contra ARCA.

## Datos, acceso y límites

El Site conserva audiencia personalizada owner-only. Los perfiles e invitaciones de la interfaz son simulaciones; no crean cuentas, no envían correo y no conceden acceso al Site. Los datos del laboratorio permanecen en el navegador actual, no se sincronizan entre computadoras y no deben contener información de clientes.

La ruta de laboratorio no llama a la API operativa. El código Worker/D1 y las migraciones históricas de Supabase permanecen separados: no afirmar que están integrados ni aplicar SQL remoto. No hay autenticación de empleados, notificaciones entre dispositivos, correo, fuente ARCA, hosting propio ni despliegue final. La cuenta de GitHub, los dos proyectos Supabase y la automatización se difieren hasta que el producto se acepte.

El paquete Git portable conserva fuente e historial, no `localStorage`. Para cambiar de PC antes de crear el remoto privado, transferir un bundle actualizado y trabajar con una sola copia activa. Ver `docs/EXECUTION-NEXT.md`.

## Desarrollo y validación

```sh
npm ci
npm test -- --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000
npm run build
```

`npm run dev` inicia la vista local. El build compila TypeScript, Vite y el Worker separado; que compile no significa que el Worker o Supabase estén conectados a la vista del laboratorio. Para los límites vigentes, comprobaciones y próximo bloque, consultar `docs/PROJECT-STATUS.md`, `docs/EXECUTION-NEXT.md` y `docs/ops/FINAL-ACCEPTANCE.md`.
