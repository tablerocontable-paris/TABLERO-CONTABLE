# Próxima ejecución — laboratorio hasta aceptar versión final

Proyecto Sites existente appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85.
Continuar work/site y su Git recuperado; no reiniciar ni consultar el chat viejo.

1. Mantener entrada LaboratoryWorkspace y storage paris-state-lab, con datos y
   perfiles ficticios. No activar RemoteWorkspace en main por tener tests verdes.
2. Respetar product/CORRECTIONS-20261006-LABORATORY.md y PROJECT-STATUS.md.
   No pedir correo del jefe, crear cuentas ni enviar invitaciones hasta aceptar
   la versión final completa. Enlaces actuales son simulados y no conceden acceso.
3. Próximo contrato Sol6.1 alto: revisar funcionalidad pendiente del alcance
   original y equivalencia entre laboratorio, SQL011 y backend D1. Elegir el
   siguiente bloque concreto; no mezclar datos, modelos de cierre o permisos.
4. Luna6 medio ejecuta el contrato definido; revisión Sol de arquitectura y
   permisos. Mantener cada fase completa y su evidencia antes de cambiar modelo.
5. Verificar npm test y npm run build. Runner actual de correcciones:
   CHROMIUM_PATH y E2E_OUTPUT + node tests/browser-corrections.cjs.
   tests/browser.cjs conserva el recorrido cronológico anterior; no presentarlo
   como validación de la entrada de laboratorio actual.
6. Fuente/commits al mismo Sites. Las correcciones del laboratorio privado
   no habilitan producción, cuentas, invitaciones ni ampliación de audiencia.

Avance orientativo 45–50%, no 100%. Última suite 334/334; navegador de laboratorio
sin errores JS y sin llamadas a la API operativa. No declara validado el acceso
real de empleados ni Supabase/Auth/MFA externo.

El cierre al 100% se rige por ops/FINAL-ACCEPTANCE.md. Pre-commit local activo; CI GitHub preparado, todavía sin ejecutar. PR/deploy/migraciones remotas pendientes de infraestructura propia.
