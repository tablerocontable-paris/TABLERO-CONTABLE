# Próxima ejecución — completar activación coordinada 011

**GPT-6.1 Sol, esfuerzo alto, Standard.** Revisar el cambio de reglas recurrentes
y materialización de bindings aplicado localmente a 011, junto con
`architecture/COORDINATION-011-EXECUTION-20261004.md` y
`architecture/COORDINATION-011-CONCURRENCY-20261006.md`. Determinar si el
footprint y la revalidación cumplen el protocolo, y cerrar el contrato para las
rutas faltantes. Luego GPT-6 Luna medio implementa ese contrato en el mismo corte
atómico 011; nunca modificar 001–010.

## Hallazgos abiertos que bloquean aplicar 011

1. `close_employee_month` no se reemplazó. Sigue sin reporte v4, cuotas por
   miembro/cobertura ni validación de cierre conjunto y outbox reportado.
2. `materialize_month` y la aprobación de reglas recurrentes ya se ampliaron en
   011 para congelar regla, materializar bindings según `scheduled_on`, y
   revalidar assignment/binding antes del write. La prueba focal cubre regla
   futura y repetición idempotente. Falta aceptación de concurrencia PostgreSQL
   y compartir C con los demás writers de catálogo.
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

Implementar rutas restantes y atribución/snapshots v4, pruebas secuenciales y de upgrade,
auditoría de grants/replay y conversión de todos los writers del inventario. No
reducir alcance si una ruta resulta difícil: registrar el bloqueo preciso y
mantener 011 marcada no apta para producción. Ejecutar suite focal/completa,
build, diff-check, actualizar estado y crear commit local sólo con resultados
verdes. Las carreras PostgreSQL reales siguen siendo puerta previa a producción.

Comprobaciones locales:

```sh
npm test -- --run tests/coordination-activation-011.test.ts --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000
npm test -- --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000
npm run build
git diff --check
```

La suite de contratos históricos 006/007 está fijada a su cadena original hasta
008. `database.test.ts` aplica todas las migraciones y la suite focal 011 cubre
la activación parcial y las reglas recurrentes. Sites live conserva v43; la
migración SQL nunca se aplica desde Sites ni desde este laboratorio.

Avance global estimado: **42% (36–46%)**. La revisión de contratos y la
documentación no elevan el porcentaje sin integración y aceptación funcional.
