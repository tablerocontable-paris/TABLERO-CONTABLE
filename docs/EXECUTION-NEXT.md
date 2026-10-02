# Próxima ejecución — revisión de interfaz y aceptación del lector

La implementación cerrada de Luna está en el SHA que encabeza `PROJECT-STATUS.md`.
**Siguiente paso: GPT-6.1 Sol, esfuerzo medio, Standard**, revisión independiente de
interfaz y lector. El usuario cambia el modelo manualmente; detenerse aquí para
ese cambio y no simularlo.

1. Revisar el diff del SHA de estado contra los criterios A1–A8 y pruebas visuales
   disponibles. QA automatizado de Chromium no se ejecutó porque no hay binario
   instalado en este entorno.
2. Revisar la nueva matriz READ-I01–04 en
   `architecture/REVIEW-DATA-READ-INDEPENDENT-RESULT-20261002.md` y decidir si la
   evidencia local permite aceptar el lector. No ampliar SQL ni gateway.
3. Si Sol acepta estas capas, definir contrato de servidor para los bloques de
   datos/permisos B/C antes de regresar a Luna. El grado de producto continúa en
   `PROJECT-STATUS.md`; no habilitar migración.

Las 18 correcciones están registradas con aceptación y dependencias en
`product/CORRECTIONS-20261002.md`. Bloque B requiere diseño de servidor y revisión
Sol alto antes de ejecutar. No conectar frontend a Supabase, crear cuentas,
migrar empleados, enviar correo ni aplicar SQL remoto en A o en los tests del
lector. Mantener SQL 001–008 y evidencia anterior.

La demo usa localStorage; el cronómetro no sincroniza entre personas. Presencia,
última conexión, importación mensual IVA y correo reales permanecen pendientes.
Avance estimado 40% (35–45%): `PROJECT-STATUS.md`.
