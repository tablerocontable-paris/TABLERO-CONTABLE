# Aceptación Sol — contrato de lectura inicial Supabase

Fecha: 23/10/2026
Dictamen: **apto para implementación local de la migración aditiva 015**, limitado al contrato identificado por el hash indicado abajo.

Documento aceptado: `REMOTE-WORKSPACE-BOOTSTRAP-CONTRACT-SOL-DRAFT-20261021.md`
SHA-256: `42849A545D2B63DCFB0507592FB696F19AD070A4FD4C8B926ACB2E76B018E96D`

La revisión independiente confirmó los límites de consulta propia y supervisora, privacidad de notas y dependencias, atribución por actor, compatibilidad de las variantes de medición, cursor y selección previa a agregados. Se incorporaron como aclaraciones mecánicas los campos `ready`, `blockerCodes` y `hasHiddenDependencies`, y el uso exclusivo de snapshots de peso guardados por movimiento.

La implementación de 015 debe agregar su rama al **último** `api.query_v1` preservando todos los kinds y permisos existentes de SQL014. Debe mantener DTO SQL/Zod exactos y cubrir cambios de equipo/empresa, acceso propio del encargado, contribución conjunta/cobertura, denegaciones de privacidad, cursor y rendimiento con 2.000 tareas.

Esta aceptación **no** aprueba código aún inexistente, no autoriza aplicar migraciones en Supabase alojado y no habilita el espacio operativo ni despliegues compartidos. Aplicar primero el preflight aprobado para 001–014 en `grupo-paris-dev`; la migración 015 requiere su revisión de código y evidencia antes de cualquier aplicación remota.
