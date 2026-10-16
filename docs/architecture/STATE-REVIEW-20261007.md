# Revisión histórica del estado — corte v68 — 07/10/2026

> Este documento conserva la revisión que acompañó el corte funcional v68.
> Sus referencias a HEAD, versión publicada y transferencia describen ese
> momento, no el estado vigente. Para la revisión actual consultar
> `docs/EXECUTION-NEXT.md` y `docs/PROJECT-STATUS.md`.

## Estado comprobado

- Checkout: `work/site`, rama `main`, HEAD `25d1490b88bddeb349328053774acbe99cb7b042`.
- Sites confirma versión 68 activa, rol propietario, audiencia personalizada con una cuenta autorizada, cero grupos y cero visitantes externos.
- El commit `25d1490` agrega avisos locales de vencimiento al laboratorio privado.
- Evidencia del árbol de código actual: 420/420 pruebas en 48 archivos; TypeScript, Vite y Worker aprobados. Edge pasó el recorrido general y el aviso a tres días con apertura y lectura persistente; cero errores JavaScript reportados.
- Edge pasó el recorrido de la campana en 1440×1000 y 390×844. Se esperó la ruta cargada, se comprobó que el diálogo móvil entrara en la pantalla y se inspeccionó su captura. No hubo errores JavaScript ni solicitudes locales a `/api`.

## Evaluación de la base

Hay separación de reglas de dominio, persistencia, interfaz, SQL Supabase y Worker/D1; pruebas de conservación de historial, permisos, cuotas, cierres y upgrades. Esto proporciona una base comprobable para desarrollar. El laboratorio conserva perfiles ficticios y estado local del navegador; todavía no prueba colaboración entre computadoras, Auth/MFA/RLS integrado ni recuperación productiva.

No se acredita ausencia de todos los defectos ni equivalencia completa entre la interfaz de laboratorio y el futuro backend. La integración productiva debe seguir una sola ruta definida y verificar los mismos contratos de negocio.

## Diferencias que debe cerrar la próxima ejecución

1. El flujo de Sites sincronizó `25d1490`; el empaquetador integrado no aceptó una ruta Windows. El empaquetador portable del proyecto generó el archivo de despliegue, que se publicó como v68 desde ese SHA.
2. El hook rápido incluye las pruebas de vencimientos y pasó 104/104 pruebas; la suite completa pasó 420/420.
3. Evidencia de escritorio/móvil, lectura persistente y aislamiento local registrada en `review-evidence/deadline-notifications-lab-20261007.json`.
4. La guía externa `outputs/LEEME-PC-PERSONAL.md` y los bundles previos mencionan versiones anteriores; generar bundle y guía concordantes con el corte publicado y verificar su clonación.

## Próximo bloque ejecutable

**GPT-6 Luna, esfuerzo medio, Standard**:

- Preparar transferencia a PC personal del commit final: bundle Git, guía, instrucciones para instalar dependencias/hook y exportar/restaurar la simulación JSON.
- Verificar el bundle mediante clonación en una carpeta temporal nueva y comparar HEAD. No incluir credenciales ni dependencias instaladas.
- Completar documentos con los IDs ya verificados: commit `25d1490`, Site v68, deployment `appgdep_6ac64381bc288191ad9d5247e4e0b340`.
- Dejar la guía y el bundle apuntando a una misma versión y a una sola PC activa.

Reutilizar las comprobaciones que siguen siendo válidas. Repetir pruebas sólo si un cambio o hallazgo lo requiere.

## Revisión posterior

**GPT-6.1 Sol, esfuerzo alto, Standard**: definir el contrato de dependencias entre tareas y delegación con aceptación. Hoy `blockedBy` es texto de espera; no demuestra relaciones entre tareas, detección de ciclos ni aceptación del receptor. Revisar identidad, alcance, estados, cancelación e historial antes de entregar instrucciones a Luna.

Después continuar aceptación funcional integral, volumen y recuperación del laboratorio. Cuentas propias e infraestructura se configuran después de aceptar el producto: GitHub, Supabase dev/producción, hosting y entrega automática completa.

## Avance

Estimación global vigente: aproximadamente 45%. Es orientativa; las pruebas locales no sustituyen aceptación funcional ni infraestructura. El 100% exige cerrar correcciones conocidas y validar producto, integración y automatización bajo cuentas propias según `docs/ops/FINAL-ACCEPTANCE.md`.
