# Próxima ejecución autorizada — 01/10/2026

**Modelo: GPT 6 Luna. Esfuerzo: medio.**
La revisión actual es `architecture/REVIEW-ANNOTATIONS-TOUR-20261001.md` sobre
`1284483903488dc95435e6bc95dd9e9558583269` (versión 21 de Sites).
No hace falta otro prompt: con «continuá» leer este archivo y AGENTS.md.

## Orden y alcance

1. Implementar `product/ANNOTATIONS-TOUR-HARDENING.md` con aceptación integrada.
   Esta autorización específica permite los cambios de frontend de anotaciones
   y recorrido que pidió el usuario después del contrato 008. Registrar un
   commit coherente de esa corrección.
2. Continuar en el mismo modelo hasta completar
   `architecture/TIME-COVERAGE-008-ACCEPTANCE.md`: nueva SQL 008, fallas R007,
   coherencia de locks, aislamiento de reportes, upgrades/abortos, guía futura y
   matriz de evidencia. No dar esta parte por terminada porque npm test completo
   esté verde: hay tres tests de reportes que fallan aislados en la revisión 007.
   No editar 001–007 ni probes/evidencias congelados. El apartado «No modificar
   frontend» de 008 sigue aplicando a esta parte SQL, no bloquea el punto 1.
3. Guardar el resultado de ambas partes en
   `architecture/REVIEW-008-EXECUTION-20261001.md`; distinguir implementado,
   probado, inspeccionado y pendiente. Mantener pruebas SQL/fixture locales.
4. Ejecutar suite completa, casos críticos individuales requeridos, build y
   diff-check. Comparar bytes de migraciones/evidencia congelada con el SHA
   revisado. Commit/push y deploy privado Sites sobre el mismo SHA final,
   conservando la audiencia. Verificar versión, SHA y resultado del deploy.
5. Al concluir, siguiente modelo **GPT Sol 6.1, esfuerzo alto**, revisión de
   las dos partes. Detenerse aquí para el cambio manual pedido por Valentino.

## Límites y producto posterior

Todavía no crear Gmail/GitHub/Supabase/hosting nuevos, aplicar SQL remoto,
migrar empleados o enviar reportes. Auth/MFA/RLS real, pruebas PostgreSQL con dos
conexiones, integración frontend/RPC, correo, piloto y restauración siguen
pendientes. Las notas locales no son privadas frente al selector de demo.

Tras aprobar 008, preparar una fase nueva de integración del frontend al contrato
SQL; no asumir que el SQL local implementado ya gobierna la app publicada.
No delegar ni fingir un cambio automático de modelo. Continuar las tareas que
usen el mismo modelo sin pedir un nuevo «continuá» entre ellas.
