# Cobertura acotada del laboratorio — 06/10/2026

## Alcance aplicado

- La cobertura registra titular, reemplazante, rango, motivo operativo y una
  lista explícita de ocurrencias abiertas.
- El titular conserva la tarea y su obligación. Las sesiones del reemplazante
  mantienen su `actorId` y no cambian dueño ni equipo.
- El reemplazante sólo puede abrir las ocurrencias elegidas mientras la
  cobertura está vigente y conserva acceso a la empresa correspondiente.
- Un encargado sólo puede registrar cobertura para titular y reemplazante de
  su propio equipo. Jefatura puede resolver excepciones entre equipos.
- La persistencia local ahora valida y conserva ausencias y `taskIds` al
  recargar.
- Cancelar una cobertura revoca el acceso y detiene los relojes activos del
  reemplazante en esas ocurrencias. Al vencer el rango, el reloj se cierra al
  último instante del último día en horario de Argentina.

## Fuera de alcance y aceptación pendiente

- Sólo aparecen ocurrencias ya materializadas. Las futuras generadas por reglas
  recurrentes aún no se agregan automáticamente a una cobertura.
- No hay propuesta separada para aprobación, reasignación, baja de perfil,
  traspaso de tareas iniciadas, auditoría multiusuario ni colaboración entre
  computadoras.
- El laboratorio usa `localStorage`; estos controles no sustituyen autorización
  de servidor, RLS, Auth ni una política de producción.
- Antes de aceptar cobertura completa falta probar recurrencias dentro del
  rango, cancelación tras trabajo parcial, cierres e historial/exportaciones y
  accesibilidad visual del selector. No se modificó SQL/D1/Supabase.

## Evidencia local

La suite, el build y la prueba Chromium descritos en `PROJECT-STATUS.md` cubren
selección/persistencia, alcance de acceso, separación de ejecutores, cierre del
reloj por cancelación/vencimiento y controles de equipo. Criterios siguientes:
incorporar ocurrencias recurrentes previstas sin duplicarlas, permitir revisar
un traspaso antes de activarlo y conservar evidencia al cancelar/reasignar.
