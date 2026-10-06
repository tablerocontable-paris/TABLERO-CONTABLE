# Estado vigente del proyecto — 06/10/2026

**Avance global estimado: 42% (36–46%).** La estimación conservadora del producto
completo se mantiene: el avance de backend todavía no se integra con la UI ni
con cuentas y servicios reales. No es un porcentaje de tests ni commits.

## Continuidad recuperada

Repositorio del mismo proyecto Sites, con commits originales cf6fc23, 2c60379 y
54117ea recuperados desde la base remota 6ec239f. Este chat trabaja desde ese
código y ya no depende de esperar/leer el anterior. El usuario autorizó commits
y push de fuente. Implementación y evidencia en
architecture/COORDINATION-011-CONTINUATION-20261006.md.

## Bloque local 011 completado

- Reporte v4 y cierre por empleado, cuotas, segundos propios, cobertura sin
  duplicar peso, privacidad y lectura de reportes v3/v4; históricos intactos.
- Cancelación de regla recurrente y bindings derivados, relojes detenidos
  atómicamente y grants legacy restringidos a selecciones precisas.
- Prepare/acquire/revalidate para todas las rutas escritoras del inventario;
  ausencias/catálogo/inducción comparten el protocolo 011; ningún writer vigente
  del inventario conserva locks bigint antiguos. SQL 001–010 no se modifica.
- PostgreSQL 17.11:26 carreras AB/BA verifican espera real, conflicto 40001 o
  serialización válida, rollback completo, receipts/outbox únicos y sin40P01.
- Tests completos y build se verifican antes de cada entrega. Los resultados
  exactos están en el informe de continuidad, no se infieren del progreso.

## Aplicación publicada

Sites v43, fuente 9d6b97dc16625c974d6679cf7d69b7fe2fdb3900,
deploy appgdep_6ac00b2ad81c81919a50bafab9f7101d.
https://grupo-paris-contabilidad.valentino-magni.chatgpt.site

Sigue siendo demostración localStorage, con roles ficticios y datos por
navegador. El push de código no cambia el deploy web. No se aplicó SQL remoto.

## Metodología de avance conservada

| Etapa | Peso | Estimación | Evidencia / pendiente |
| --- | --- | --- | --- |
| Demo, experiencia y reglas |25%|80%| UI A/anticipación; faltan B/C/D y QA visual |
| Contrato de datos y SQL |25%|68%|011 implementado y probado localmente; falta aceptación/integración real|
| Integración, cuentas y permisos |25%|5%|Lector/gateway locales; UI aún usa actor simulado|
| Funcionalidad final y operación |15%|25%|Reportes/outbox locales; funciones operativas finales y correo pendientes|
| Validación, infraestructura y migración |10%|0%|Piloto, recuperación, servicios y migración pendientes|

Ponderación 42,0. Son juicios de planificación con incertidumbre; se conservan
para no atribuir avance integrado a nuevas pruebas o documentación.

## Puertas que impiden declarar lista la app operativa

1. Revisión de 011 y B3: jerarquía multiarea, transferencias, bajas/huérfanas;
   integrar comentarios privados y contribuciones en la UI.
2. Adaptador completo de frontend, equivalencia de reglas, manejo de 40001,
   Auth/invitaciones/MFA/RLS reales y datos compartidos.
3. Agenda/cumplimiento, presencia/última conexión, notificaciones, consultas,
   entrega real de reportes y procesos de mejora.
4. QA visual/volumen, aceptación funcional con Juan Pablo y encargado,
   piloto y pruebas de recuperación/actualización.
5. Después de aceptar producto: cuenta e infraestructura dedicadas nuevas,
   GitHub/Supabase/hosting y flujo dev/prod; luego migración manual por equipos.

PostgreSQL real aquí prueba el motor y esa matriz de carreras con Auth/JWT
ficticios; no verifica servicios Supabase, emails, Storage ni producción.
No se crearon cuentas externas ni se modificó la base legacy.

## Próxima ejecución

Sol6.1 alto: revisión y contrato B3/integración. Luna6 medio: implementar contrato
definido. Continuar autónomamente siguiendo EXECUTION-NEXT.md. Historial de
etapas y revisiones conservado en docs/architecture y Git.
