# Cobertura acotada del laboratorio — 06/10/2026

## Alcance aplicado

- La cobertura registra titular, reemplazante, rango, motivo operativo y una
  lista explícita de ocurrencias abiertas y/o reglas recurrentes seleccionadas.
- El titular conserva la tarea y su obligación. Las sesiones del reemplazante
  mantienen su `actorId` y no cambian dueño ni equipo.
- El reemplazante sólo puede abrir las ocurrencias elegidas mientras la
  cobertura está vigente y conserva acceso a la empresa correspondiente.
- Una regla recurrente se previsualiza con las mismas fechas que usa
  `materialize`; las ocurrencias futuras heredan el permiso por el ID de la
  regla seleccionada y por la fecha de ocurrencia dentro del rango.
- Materializar el mismo mes más de una vez no duplica tareas ni permisos.
- Un encargado sólo puede registrar cobertura para titular y reemplazante de
  su propio equipo. Jefatura puede resolver excepciones entre equipos.
- La persistencia local ahora valida y conserva ausencias y `taskIds` al
  recargar.
- Cancelar una cobertura revoca el acceso y detiene los relojes activos del
  reemplazante en esas ocurrencias. Al vencer el rango, el reloj se cierra al
  último instante del último día en horario de Argentina.

## Fuera de alcance y aceptación pendiente

- Las ocurrencias futuras se previsualizan desde la regla; el acceso a cada
  tarea se activa cuando `materialize` crea la ocurrencia. No se admiten reglas
  que no produzcan ninguna ocurrencia abierta durante el rango.
- No hay propuesta separada para aprobación, reasignación, baja de perfil,
  traspaso de tareas iniciadas, auditoría multiusuario ni colaboración entre
  computadoras.
- El laboratorio usa `localStorage`; estos controles no sustituyen autorización
  de servidor, RLS, Auth ni una política de producción.
- Antes de aceptar cobertura completa falta ampliar escenarios con reglas
  semanales/diarias y rangos multimes, cancelación tras trabajo parcial, cierres,
  historial/exportaciones y accesibilidad visual. No se modificó SQL/D1/Supabase.

## Evidencia local

La suite, el build y los recorridos descritos en `PROJECT-STATUS.md` cubren
selección/persistencia puntual y recurrente, ocurrencias materializadas una vez,
alcance temporal, separación de ejecutores, cierre del reloj por
cancelación/vencimiento y controles de equipo. Criterios siguientes: permitir
revisar un traspaso antes de activarlo y conservar evidencia al reasignar.
