# Resultado de revalidación — M2-2C timer replay

Fecha: 19/10/2026. Implementación local GPT-6 Luna. **Pendiente revisión y aceptación independiente de GPT-6.1 Sol.**

## Resultado

La reproducción roja se ejecutó sobre PostgreSQL 17.11 y SQL014 extraído byte por byte del commit baseline `f23c42529a0c55dd0f3596d765a30d5b6c9c54c5`. Su hash exacto es `BA972D3531F9CC5221FC090CDC7FB1FE5C990366B0F74773333C8582F087125C`. Confirmó por separado que el replay autorizado y exacto devuelve la sesión previa; luego de una revocación confirmada vía `api.command_v1` y, en otro fixture, tras inactivar el perfil del empleado, el replay también devolvía `00000` y la sesión anterior. El conflicto con argumento de revisión diferente devolvió `P0001` y el mensaje primario legacy exacto. El resultado rojo está en [reproducción baseline](m2-2c-legacy-timer-replay-auth-luna-20261019-reproduction-red-baseline.json); los logs crudos, SQL y código de salida permanecen en `../../outputs/m2-2c-sol-recheck-20261019-baseline-red-final/`.

Se modificó solamente la rama cached de `public.start_task_timer` en SQL014 y el runner nativo asociado. El replay vuelve a validar la autorización, sin convertir argumentos incompatibles a errores de autorización y conservando los fences. SQL011–013 no se editaron.

El runner verde actual terminó `GREEN_MEMBERSHIP_DENIAL`, con **23 eventos**: matriz secuencial ampliada y las 8 carreras con ganador, perdedor, bloqueadores observados y reintentos. Los controles secuenciales guardan el snapshot completo y lo comparan entre operación y resultado: perfiles, empresas/equipos, membresías, tareas/asignaciones/responsabilidades, sesiones/recibos, auditoría/eventos, todos los fences y las colecciones de actividad, evaluación, seguimiento, dependencias, cobertura, ausencias, cierres, reportes, entregas y outbox. Los tres argumentos conflictivos (`revision`, `switch`, `instance`) se prueban con actor activo y revocado, manteniendo el SQLSTATE y mensaje legacy. La revocación secuencial confirma el delta completo esperado. Reporte [verde](m2-2c-legacy-timer-replay-auth-luna-20261019-reproduction-green.json) y evidencia cruda en `../../outputs/m2-2c-sol-recheck-20261019-green-attempt33/`.

## Matriz general y validación

- Matriz nativa completa con `--review-matrix full --through-014 yes --m2-2a-smoke yes --m2-2c-smoke yes`: candidato SQL014 **351/351**; baseline exacto SQL014 **351/351**. Cada corrida incluye 17 resultados M2.2A y 194 M2.2C; `m2cSmoke=true`. No se observó diferencia entre baseline y candidato ni discrepancia `42501`/`55000`.
- Vitest: **738 pruebas en 74 archivos**, exit 0.
- TypeScript (`tsc --noEmit`), build cliente, build Worker, `node --check` de ambos runners y `git diff --check`: exit 0.
- PostgreSQL: 17.11. Los archivos por comando incluyen stdout, stderr, logs, reporte completo y código de salida hashable en `../../outputs/m2-2c-sol-recheck-20261019-validation-final/` y los directorios de cada corrida.
- Las matrices anteriores **43/43** quedan fuera de la aceptación: tenían `m2cSmoke=false` y omitían los smoke operations exigidos. Se conservan, pero el paquete cualificante es la corrida de 351 resultados por baseline y candidato. Los intentos 24/25 se conservan como fallos del fixture/harness (clave primaria de cobertura ausente y fence mensual de jefe no preexistente); los intentos 28–32 también se conservaron, incluyendo el diagnóstico de que la revocación sobre una tarea ya pausada no cumple el delta de la fixture contractual. El runner vigente separa la revocación en una fixture independiente con sesión abierta. El puerto ya ocupado de un intento está registrado aparte como fallo ambiental de harness.

## Hashes de implementación

- Contrato Sol: `A006EC42F26C08992C8F0CA2BF149359D937D6B15CF639D4FF67E5FDEE489A5F`.
- SQL014 baseline exacto: `BA972D3531F9CC5221FC090CDC7FB1FE5C990366B0F74773333C8582F087125C`.
- SQL014 candidato: `C6A4ACDD92653DFFE9A0576EC3D8FBC906B2562E3BFAC056B8561981A4203EC8`.
- SQL011: `9729A6800E93DEDC43AB5F0840309B7C0D222343898CC8D5B43EEB4A387F4210`.
- SQL012: `CABFE95DBD04AE65EA82C787BC5E3EC8E638E4620456366B7EEB8A5D715DFBF4`.
- SQL013: `D013B82BFA1101ED11A35DAEAF7A64B2E6063DA9C09B55E7586CE67CC586BAC2`.
- Runner verde: `27C6E8AF598C28DA4D45760C754199BA942A885E15AF14444D3A4A265065259C`.
- Runner rojo: `D6641D8C5CEF6454E563F96749E1AE4AC4EF40CF815469075800E161022E7841`.

El manifiesto vincula cada artefacto con comando, reporte, stdout/stderr, logs, códigos de salida y hashes. Todas las rutas `../../outputs/...` se resuelven desde `work/site`. La evidencia previa había consignado `AC8CCA...` como hash de SQL014 pre-fix del working tree; no coincide con el blob exacto del commit baseline. Este recheck no atribuye ese hash al blob de `f23c425`; usa y conserva el baseline exacto `BA972D...`.

## Límite

No se hizo commit ni push, no se llamó a servicios alojados ni se aplicó SQL014. No hubo cambios de API, UI o Worker. Esta etapa no está aceptada hasta revisión Sol y no autoriza publicación.
