# Revisión independiente B2a / 010

Fecha: 04/10/2026 UTC. Revisión separada de la implementación; no se conectó
la migración a una base remota.

## Resultado

No se encontró un defecto que justifique editar SQL010. La migración permanece
como fundación staged: su representación explícita no activa autorización,
cronómetros, puntuación, cobertura, ni cambios a las RPC008. La cabecera sólo
admite el baseline sellado; el helper legacy conserva un fallback sin escritura.
Las FKs compuestas conservan la organización en cada referencia y la suma de
cuotas es comprobada al sellar. La privacidad de notas009 continúa en su recurso
separado y no forma parte de la proyección010.

## Pruebas añadidas

`tests/coordination-010-review.test.ts` usa SQL directo, separado de los builders
de `coordination-foundation-010.test.ts`, y prueba ocho hipótesis adicionales:

1. No se pueden crear conjuntos ni planes pre-sellados.
2. `UPSERT` no elude la inmutabilidad de miembros/cabeceras sellados.
3. Un conjunto explicit staged no reemplaza el fallback ni crea una cabecera.
4. Sin grants, también `service_role` con `BYPASSRLS` carece de SELECT/EXECUTE.
5. FK compuestas y fechas infinitas rechazan identidad inválida.
6. Cambiar perfil no reescribe snapshot y una nota privada no se filtra.
7. La comprobación de texto no blanco concuerda con `String.trim()` de JS en
   whitespace y conserva caracteres zero-width/no-break esperados.
8. Un error al final de la migración revierte DDL y datos del backfill.

Comando focal: `npm test -- --run tests/coordination-010-review.test.ts
--maxWorkers=1 --testTimeout=60000 --hookTimeout=60000` — 8/8 pasan. Con las
18 pruebas de ejecución010, son 26 pruebas focales para ese bloque.

## Límites restantes

PGlite no verifica carreras reales de PostgreSQL, Auth/MFA ni la configuración
del proveedor Supabase. La revisión comprueba el alcance aislado010, no declara
apta la activación011. La FK estructural de asignación a membresía persiste como
decisión histórica: una baja futura debe revocar acceso y reubicar trabajo sin
borrar relaciones referenciadas. La migración, lectores y permisos remotos no se
han aplicado. Live conserva Sites v43.
