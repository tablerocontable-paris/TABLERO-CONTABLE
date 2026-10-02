# Próxima ejecución — reparación del bloque A

**GPT-6 Luna, esfuerzo medio, Standard.** El usuario cambia manualmente el
modelo; después basta «continuá». No delegar ni simular el cambio.

Revisión terminada sobre `3f2995270081f6d5c54ac2590c32f81d035d6ad1` (Sites v37):
lector aceptado localmente; interfaz con siete fallas reproducidas y omisiones
de A1–A8. Resultado y evidencia:
`architecture/REVIEW-V37-INDEPENDENT-20261002.md`.

Contrato completo para ejecutar:
`product/CORRECTIONS-UI-A-REPAIR-20261002.md`. Corregir buffer de pasos,
validaciones/meta, perfil consultado/actor, cobertura separada, anotaciones,
gráficos, tour versión 4, guard del diálogo de cierre y detalles de acciones/
workspace/seed. Incorporar probes complementarios del lector a sus tests,
sin modificar lector/gateway/helper/SQL/dependencias.

Probar, compilar, commit/push/publicar privado mediante Sites; registrar SHA y
estado implementado pendiente de revisión. Después **Sol 6.1 medio** acepta la
reparación. Luego **Sol alto** define contrato de servidor B/C antes de Luna.
No reabrir toda la revisión de lector si fuentes congeladas permanecen idénticas.

Las 18 correcciones están en `product/CORRECTIONS-20261002.md`. B/C/D permanecen
pendientes. No conectar Supabase, crear cuentas, migrar empleados, enviar correo
ni aplicar SQL remoto en este bloque. Preservar evidencia anterior y SQL 001–008.

Demo localStorage, cronómetro local, sin presencia compartida/última conexión ni
IVA/correo reales. **40% estimado (35–45%)**, no listo para migrar. La nueva
publicación documental de la revisión conserva el build de v37; no presenta las
correcciones como ya implementadas.
