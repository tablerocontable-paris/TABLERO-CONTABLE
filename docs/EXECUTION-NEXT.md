# Próxima ejecución — revisión de activación parcial 011

**GPT-6.1 Sol, esfuerzo alto, Standard.** Revisar la implementación local
`supabase/migrations/202610060011_coordination_activation.sql` y el informe
`architecture/COORDINATION-011-IMPLEMENTATION-20261006.md` contra el contrato
`architecture/COORDINATION-011-EXECUTION-20261004.md` y el protocolo
`architecture/COORDINATION-011-CONCURRENCY-20261006.md`. La revisión debe
cerrar un plan ejecutable para completar las rutas sin cambiar semántica por
intuición.

## Hallazgos abiertos que bloquean aplicar 011

1. `close_employee_month` no se reemplazó. Sigue sin reporte v4, cuotas por
   miembro/cobertura ni validación de cierre conjunto y outbox reportado.
2. `materialize_month` no se reemplazó. La aprobación de planes con reglas
   recurrentes se rechaza explícitamente; faltan bindings por ocurrencia,
   validación de `scheduled_on` y locks del materializador.
3. `approve_employee_absence` y `cancel_employee_absence` permanecen en sus
   versiones heredadas. Falta integrar su footprint/orden de locks y la
   intersección con bindings precisos.
4. `create_catalog_assignment`, actualización de pesos/plantillas y aprobación
   de inducción no usan el envelope 011 para todas las escrituras. Aún hay
   escritores con locks bigint heredados.
5. La ejecución PGlite sólo acredita la secuencia SQL y las políticas simuladas.
   No hay PostgreSQL real, MVCC/barreras de carrera, Supabase Auth/MFA ni
   validación remota.

La migración tiene comentario explícito de **NO apta para producción**. No
conectar UI, no hacer `db push`, no cambiar migraciones 001–010, Site ni audiencia.
No hacer Sites save/deploy ni push de Git durante esta revisión; el usuario pidió
mantener esta fase local.

Después de la revisión, si el contrato queda cerrado, cambiar manualmente a
**GPT-6 Luna, esfuerzo medio, Standard** para implementar el plan completo en
un solo bloque: rutas restantes, atribución y snapshots v4, pruebas secuenciales
y de upgrade, suite focal/completa, build, estado y commit local. No simular un
cambio de modelo. Las carreras reales siguen siendo puerta previa a producción.

Comprobaciones locales:

```sh
npm test -- --run tests/coordination-activation-011.test.ts --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000
npm test -- --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000
npm run build
git diff --check
```

La suite de contratos históricos 006/007 está fijada a su cadena original hasta
008. `database.test.ts` aplica todas las migraciones y la suite focal 011 cubre
la activación parcial. Sites live conserva v43; la migración SQL nunca se aplica
desde Sites ni desde este laboratorio.

Avance global estimado: **42% (36–46%)**. Revisiones/documentación no elevan el
porcentaje sin integración y aceptación funcional.
