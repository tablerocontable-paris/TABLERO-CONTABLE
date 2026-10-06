# B2b / 011 — ejecución local parcial

Fecha: 06/10/2026. **No aplicar esta migración a Supabase.** El encabezado de
`supabase/migrations/202610060011_coordination_activation.sql` marca el corte
como no apto para producción: varias rutas aún conservan el comportamiento y
locks heredados, y el contrato de reporte v4 no está implementado.

## Implementado y comprobado localmente

- Sustitución del índice de reloj por tarea por actor, conservando un único reloj
  abierto por empleado.
- Baseline de responsabilidad para filas nuevas y backfill exclusivo de tareas
  creadas después de 010 que todavía no tuvieran cabecera. No modifica sets ya
  existentes ni cambia empresa, período, identidad o peso de la tarea.
- Activación inicial de responsabilidad conjunta únicamente en tarea puntual,
  con dos miembros, cuotas, empresa/membresía y revisión esperada validadas.
- Vínculos de cobertura para ocurrencias seleccionadas y RPC explícitas para
  aprobar/cancelar. Cancelar revoca acceso y detiene el reloj de cobertura dentro
  de la transacción; la evidencia anterior permanece atribuida a su autor.
- Controles compartidos y sesión por actor; una pausa afecta sólo el reloj propio.
  Un superior AAL2 puede interrumpir otra sesión con motivo y auditoría separada.
- RLS de sesiones sin exponer al empleado la actividad cronometrada de pares;
  DTO seguro de tarea coordinada y contrato Zod estricto.
- La revocación/caducidad de un reloj cubierto conserva actor, corte efectivo y
  evento de auditoría. Los snapshots previos se mantienen intactos.

Prueba de upgrade aplica 011 sobre una base 010 poblada con tarea, actividad,
nota privada y receipt; comprueba que esos datos no cambian y que la tarea recibe
su baseline. Las pruebas históricas de 006/007 están fijadas a su cadena de origen
hasta 008: son evidencia de esos contratos, no regresión de la API más reciente.
La suite `database.test.ts` sí recorre todas las migraciones; los tests focales
011 ejercitan las nuevas rutas.

## No implementado; bloquea cerrar B2b/011

1. `close_employee_month` no crea snapshot v4. No hay cuotas individuales de
   resultado, contribución operativa por cobertura ni invariantes de conciliación
   entre el peso global único y los puntos por participante.
2. `materialize_month` no fue reemplazado. La aprobación de un plan con reglas
   recurrentes hoy se rechaza deliberadamente; no hay binding que se materialice
   junto a la ocurrencia por fecha canónica `scheduled_on`.
3. `approve_employee_absence` y `cancel_employee_absence` permanecen heredadas;
   falta integrar footprints, locks e intersección restrictiva con bindings.
4. `create_catalog_assignment`, cambios de plantilla/peso y aprobación de
   inducción no usan un único envelope 011. En esas rutas siguen existiendo
   locks bigint o escrituras que no se revalidan bajo el protocolo nuevo.
5. Falta auditar todas las subrutinas/wrappers antiguos para garantizar que no
   quede un bypass y completar pruebas de replay/rollback/ACL por operación.
6. PGlite prueba aplicación SQL, secuencias, constraints y RLS simulada; no prueba
   deadlocks, concurrencia MVCC ni integración Supabase Auth/RLS/MFA real. No hay
   PostgreSQL descartable disponible en este entorno.

El reporte mensual existente conserva su versión previa. No se promete correo
productivo: esta migración no genera reporte4 ni cambia entrega/outbox.

## Correcciones encontradas en la suite completa

La primera ejecución con 011 parcial tuvo **14 fallos**. Se corrigieron las
regresiones atribuibles: una finalización válida desde el último checklist de
resultado, el vencimiento automático de un reloj legacy cubierto, la auditoría de
pausa/corte, los mensajes de política y el no-op de espera que no debe interrumpir
un reloj de un par. Las pruebas de recurrencia dejaron de borrar ocurrencias
históricas —protegidas ahora por el FK de responsabilidad— y usan asignaciones
aisladas. También se fijó la prueba de privacidad de sesión peer a la nueva
política. Resultado final de esta ejecución: suite completa **285/285 en 27
archivos (77,77s)**; `npm run build` y `git diff --check` pasan. Vite reportó
anotaciones Rollup en dependencias Zod, sin bloquear el build.

## Destino y publicación

Trabajo local y commit local únicamente. No se hizo push, Sites save/deploy ni
`db push`; la aplicación publicada permanece en v43 y SQL remoto no se tocó.
Avance global del producto: **42% estimado (36–46%)**; esta base parcial aún no
permite migrar empleados.

**Siguiente modelo: GPT-6.1 Sol, esfuerzo alto, Standard**, revisar el diseño
incompleto de cierre/reporte4, materialización recurrente y writers. Luego GPT-6
Luna medio ejecuta ese contrato cerrado. Véase también `docs/EXECUTION-NEXT.md`.
