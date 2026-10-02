# Próxima ejecución — correcciones visibles y evidencia del lector

**GPT-6 Luna, esfuerzo medio, Standard.** Base de planificación/revisión:
`16862eec715d81193c1b8a30403cae0288b8a326` (v34), más este commit de documentos.
El usuario cambia modelo manualmente; no delegar ni simular ese cambio.

1. Implementar bloque A completo de
   `product/CORRECTIONS-UI-EXECUTION-20261002.md`: gráficos, pasos, notas,
   recorrido, selector, tablero personal y acciones por módulo/rol. No implementar
   todavía los esquemas/permisos B/C/D del nuevo pedido.
2. Registrar comprobaciones y publicar cambio A como commit propio, con tests y
   build del SHA publicado. No detenerse para pedir «continuar» dentro de la misma
   ejecución/modelo.
3. En cambio separado, completar contrato de tests en
   `architecture/REVIEW-DATA-READ-INDEPENDENT-20261002.md` READ-I01–03 y matriz
   READ-I04. El lector no queda aceptado por el conteo de pruebas anterior.
   Cualquier defecto nuevo de política SQL exige reproducción y Sol alto.
4. Pasar a revisión Sol 6.1 medio de A y lector con evidencia de ambos. Sol define
   contratos de arquitectura; Luna sólo implementa instrucciones cerradas.

Las 18 correcciones están registradas con aceptación y dependencias en
`product/CORRECTIONS-20261002.md`. Bloque B requiere diseño de servidor y revisión
Sol alto antes de ejecutar. No conectar frontend a Supabase, crear cuentas,
migrar empleados, enviar correo ni aplicar SQL remoto en A o en los tests del
lector. Mantener SQL 001–008 y evidencia anterior.

La demo usa localStorage; el cronómetro no sincroniza entre personas. Presencia,
última conexión, importación mensual IVA y correo reales permanecen pendientes.
Avance estimado 40% (35–45%): `PROJECT-STATUS.md`.
