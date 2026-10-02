# Revisión independiente — Sites v37

Fuente revisada: `3f2995270081f6d5c54ac2590c32f81d035d6ad1`; implementación
`d1a071d8f1f541f0a5bf0e2110bc970185c847bb`. Se contrastó el diff con A1–A8 y
READ-I01–04. Esta revisión no modifica la aplicación, el lector, el gateway ni
las migraciones. El porcentaje permanece en 40%; no habilita migración.

**Resultado: bloque A requiere correcciones; lector aceptado localmente.**

## Interfaz: reproducción y omisiones

Las ocho comprobaciones de `review-evidence/ui-a-v37.probe.tsx` se ejecutaron
temporalmente desde tests. Siete fallan contra comportamientos acordados; una
confirma que el empleado sólo puede elegir su propio perfil. No se suman a la
suite verde ni se presentan como errores nuevos causados por esta revisión.

| ID | Resultado observado | Corrección |
| --- | --- | --- |
| A-R01 | En Onboarding, Agregar paso serializa `[""]` como `""`; al renderizar desaparece la primera fila | Conservar array de edición, incluidos borradores vacíos; serializar sólo en la frontera actual |
| A-R02 | Escribir meta 321 en catálogo operativo guarda 120 | Tomar la meta individual del formulario; mantener unidad, peso y demás estándar desde catálogo |
| A-R03 | Consultar Valentino desde Carolina y abrir Nueva tarea selecciona Carolina como responsable | Usar el perfil consultado para el valor inicial en páginas personales, sin cambiar actor |
| A-R04 | Mi día mantiene el selector de Valentino pero no muestra su tarea pendiente | Quitar el segundo filtro por active.id de las prioridades consultadas; recordatorios/anotaciones propios deben seguir identificados |
| A-P05 | El selector del empleado contiene únicamente e0 | Cumple A6. No ocultarlo ni ampliar opciones para satisfacer una expectativa más estricta que el contrato |
| A-R06 | Cambiar actor simulado conserva el detalle anterior | Limpiar detalle, registro, modal y conversión al cambiar actor; validar acceso también al renderizar detalle/registro |
| A-R07 | Una nota de cuatro líneas y menos de 100 caracteres se recorta sin Leer completo | Expansión disponible independientemente de cantidad de caracteres; resumen de dos líneas y controles de al menos 14 px |
| A-R08 | Convertir nota con paso de 301 caracteres guarda asignación y vínculo | Validar límites antes de guardar; informar error y conservar borrador/original, sin guardado parcial |

A-R06 usa un evento sintético de cambio de actor con dialog.showModal simulado.
Demuestra estado residual en React; no prueba que una persona pueda actuar sobre
la barra detrás de un diálogo modal real ni demuestra una vulnerabilidad de
Supabase. La demo tiene un selector deliberado de identidades; no es Auth.

Omisiones adicionales comprobadas leyendo la fuente:

| ID | Evidencia | Criterio pendiente |
| --- | --- | --- |
| A-R09 | Bar pendiente usa `var(--chart-muted)` sin definición en styles.css | Definir color logrado/pendiente distinguible en ambos temas; comprobar tooltip/ejes/barras visualmente |
| A-R10 | Tablero mezcla cobertura con tarjetas propias; operativas sólo añade una etiqueta | Bloque separado Tareas que cubrís en ambos módulos, sin copiar ocurrencias ni conceder perfil completo del titular |
| A-R11 | Tour combina reloj/controles en un paso, agrega regreso redundante y filters usa tourStep===1 | Once temas acordados, reloj y controles separados, spotlight según selector; versionar nueva secuencia para no reinterpretar progreso v3 |
| A-R12 | Página closing tiene guard manager, pero modal close no | Guard de rol/ámbito también al renderizar diálogo, más validación de dominio existente |
| A-R13 | Workspace no tiene contador; CTA Nueva tarea omitido en planning; seed mantiene nombres de equipo por sector | Completar esos tres detalles ya contratados; no reescribir perfiles/equipos guardados |

La prueba de categoría nueva anterior comprueba almacenamiento pero no recarga
real; Anterior tampoco prueba fallo de persistencia hacia atrás. Se incluyen
esas comprobaciones en la reparación, junto con actor, cobertura y pasos creados
con done=false. No son fallas de funcionamiento reproducidas actualmente.

## Lector: aceptación local de READ-I01–04

Las pruebas incorporadas por Luna cubren los casos centrales. Faltaban algunas
assertions específicas de la matriz; se completaron mediante comprobaciones
independientes, sin cambiar producción, helper ni SQL.

| Criterio | Evidencia revisada/completada |
| --- | --- |
| READ-I01 | Test de cobertura con filas B/C existentes, cancelación e historial. Copia independiente `reader-coverage-v37.probe.ts` comprueba authenticated/peer antes de cada bloque de lecturas y página actual company A + owner con IDs exactamente `[taskId]`; B/C vacíos. Después de capture restaura actor |
| READ-I02 | Tests “keeps operative checklists…” y “compares complete SQL task/session rows…”: controles completos siguen En curso, revisiones 3/4, pausa persistida; task JSON completo y todos los campos de sesión esperados, fracciones .123456/.654321 preservadas |
| READ-I03 | Null indebido antes de read, findTask campo ausente, sesión fuera de lista, lookahead incompleto y envelopes por los tres métodos. `reader-v37.probe.ts` añade sesión UUID a-f/mayúsculas, tres páginas exactas con cursores/lookahead y filas completas, orden/exceso inválidos y una llamada |
| READ-I04 | Esta matriz liga requisitos, archivos y assertions; manifest fija SHA, resultados y hashes de fuentes congeladas |

Las tres comprobaciones independientes del lector pasan (siete tests no
seleccionados se saltaron en la copia SQL). Se acepta **el lector local para su
contrato de lectura**. Incorporar las assertions complementarias a los tests
normales en la siguiente ejecución evita depender de copias de revisión.

Esto no acepta un transporte Supabase productivo ni un coordinador frontend.
Persisten concurrencia PostgreSQL, Auth/invitaciones/MFA, integración, presencia,
datos compartidos y entrega real de correo. La UI continúa usando localStorage.

## Verificación y reproducción

- Suite original: 195 pruebas/17 archivos aprobados; build aprobado.
- Interfaz: 7 fallas esperadas y 1 aprobación en 8 probes independientes.
- Lector: 3 aprobaciones independientes; fuentes congeladas idénticas a la base
  de planificación `3ab0c95285881249914c889bc9052e1c3eb83325`.
- Logs y hashes: `review-evidence/v37-independent-manifest-20261002.json` y
  archivos indicados allí. Las copias .probe no forman parte de npm test.
- Preview supervisado arrancó. El navegador devolvió
  `net::ERR_BLOCKED_BY_CLIENT` al abrir el preview autorizado. No se aprobó QA
  visual de claro/oscuro/móvil. Existe Chromium local; la afirmación anterior
  de que no había Chromium instalado fue demasiado amplia.

Para reproducir, copiar ui-a-v37.probe.tsx a tests/review-v37.probe.test.tsx,
reader-v37.probe.ts a tests/review-reader-v37.probe.test.ts y
reader-coverage-v37.probe.ts a tests/review-reader-coverage-v37.probe.test.ts.
Ejecutar los dos comandos registrados en los logs, desde la fuente revisada;
eliminar las copias temporales antes de ejecutar la suite normal. Las rutas
relativas de importación están preparadas para tests/, no review-evidence/.

## Próximo paso

GPT-6 Luna medio, Standard: contrato cerrado
`../product/CORRECTIONS-UI-A-REPAIR-20261002.md`. Después, revisión Sol medio de
la reparación. Sólo entonces Sol alto define contratos de servidor B/C. No
ampliar permisos o integrar servicios para compensar defectos de interfaz.
