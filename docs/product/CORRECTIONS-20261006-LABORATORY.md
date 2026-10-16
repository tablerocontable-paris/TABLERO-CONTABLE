# Correcciones y retorno al laboratorio — 06/10/2026

## Pedido vigente

Corregir barras/cortes del menú, dar protagonismo al logo, recuperar usuarios,
datos ficticios y simulación, definir alta con parámetros previos y aviso a
jefatura, separar el título de la tarjeta del control para plegar.
El usuario aclaró expresamente: NO crear cuentas ni enviar invitaciones hasta
que la versión final esté completa y validada. No pedir correo del jefe ahora.

## Implementación

- Entrada publicada de prueba: LaboratoryWorkspace, con App en modo laboratorio.
  Sólo lee/escribe paris-state-lab. No importa RemoteWorkspace ni llama /api.
  Conserva los datos del laboratorio existentes y no copia datos operativos ni
  antiguos paris-tasks-v1. El backend Worker/D1 permanece separado e inactivo
  desde la UI de esta etapa; no se borró ni se migró su contenido.
- Perfiles, empresas, trabajos y KPI ficticios de seed, selector de simulación.
- Menú sin scroll interno; distribución compacta adaptada al alto. En pantallas
  extremadamente bajas se usa el scroll del documento, sin ocultar contenido.
- Logo con object-fit contain, mayor tamaño y proporciones intactas; inducción
  ajustada para que logo, pasos y pie se vean completos.
- Cada tarjeta tiene cabecera flexible con título y botón de icono al costado,
  aria-label y aria-expanded. El plegado sigue siendo independiente.
- Equipo muestra enlaces de invitación SIMULADOS, comenzando por Juan Pablo.
  El enlace reanuda el perfil existente con rol, responsable, puesto, sucursal,
  sector y empresas definidos; consume el parámetro de URL una vez. No crea
  identidad, no envía correo, no concede acceso Sites ni activa cuentas reales.
- Perfil con inducción terminada genera un pendiente persistente para jefatura:
  «Pendiente parametrizar pesos y objetivos». Jefatura revisa todas sus tareas
  y confirma. El aviso no desaparece sólo por abrirlo; una nueva inducción
  completada requiere otra revisión. Usuarios comunes no revisan a sus pares.
- Parámetros se aplican a futuras asignaciones y tarjetas sin actividad/inicio.
  Trabajo iniciado, completado y cierres conserva sus valores históricos.
- Contrato futuro de D1: revisión validada por servidor, actor/fecha derivados
  del servidor y colección por entidad; no requiere DDL nuevo. Esa ruta no se
  conecta ni activa cuentas en la UI de laboratorio.

## Cruces con las reglas del producto

| Regla | Comprobación |
| --- | --- |
| Laboratorio separado del KPI real | Cero solicitudes /api; storage operativo sin tocar |
| Inducción y jerarquía | Parámetros previos conservados; enlace sólo simulado |
| Avisos/deduplicación | Uno por perfil/completado; persiste hasta confirmar |
| Catálogo y snapshots | Trabajo iniciado/cerrado no se reescribe |
| Perfiles y permisos | Confirmación sólo jefatura; revisión ajena fuera de proyección |
| Tarjetas independientes | Un plegado no cambia el de la tarjeta vecina |
| Responsive | 1440×900, 1600×740, 1280×720, 1024×650 y 390×844 |

## Evidencia

334/334 pruebas, 32 archivos, exit 0 (157,43 s). Build TypeScript/Vite/Worker
aprobado. Runner tests/browser-corrections.cjs en Chromium local instalado:
recorrido completo de alta ficticia, menú, logos, tarjetas, confirmación,
persistencia y móvil; cero errores JS y cero llamadas a API operativa.
Capturas y JSON se conservan en outputs/correcciones-browser fuera del repo.
La revisión anterior de PostgreSQL 011 continúa histórica; SQL no cambió aquí.
No se declara probado el piloto autenticado ni el alta real/invitación externa.

## Etapa

Esta es una corrección del Site privado de pruebas, no la puesta en producción.
Avance global orientativo: 45–50%, referencia de planificación indicada por el
usuario, sin medir aceptación por número de tests. La app completa no está al
100%. Primero terminar y aceptar el alcance funcional y su validación; sólo
entonces cuentas, invitaciones, infraestructura final y migración del equipo.
