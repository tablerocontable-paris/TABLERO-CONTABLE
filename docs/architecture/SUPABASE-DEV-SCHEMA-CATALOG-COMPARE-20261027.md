# Comparación del esquema instalado de Supabase DEV — 27/10/2026

## Resultado

El run #4 (`40522765334`) no modificó Supabase. Intentó aplicar otra vez la
etapa `baseline_001_014` cuando el proyecto ya registraba las 18 versiones de
001–016. El control detectó `local=16, remoto=18` y terminó antes del dry-run y
de `db push`.

La lectura actual del catálogo DEV coincide con un replay local de los 18
archivos del repositorio en PGlite, en estas categorías:

| Categoría | Cantidad comparada | Resultado |
|---|---:|---|
| Relaciones con RLS | 57 | Huella coincidente |
| Columnas y tipos | 445 | Huella coincidente |
| Políticas RLS | 28 | Huella coincidente |
| Funciones/procedimientos | 159 | Huella coincidente |
| Restricciones declaradas | 360 | Huella coincidente |
| Índices | 116 | Huella coincidente |
| Triggers de usuario | 42 | Huella coincidente |
| Privilegios de ejecución de funciones | 159 | Huella coincidente |
| Privilegios de tabla para `anon`, `authenticated` y `PUBLIC` | 28 | Huella coincidente |

Las huellas agregadas (replay local = catálogo remoto) son:

| Categoría | MD5 agregado |
|---|---|
| Relaciones | `ade82b64606ffbc4c060976fd3b32735` |
| Columnas | `822acbb199971bc994361ac895a58bf2` |
| Políticas | `887f19b766f6252133670e283fdfde1f` |
| Funciones normalizadas | `289b8fa8c1420b5af7deacf9bba7e1c7` |
| Restricciones declaradas | `4cbfe2eabeadbe46f1bb8b8f4b525c1d` |
| Índices | `4b8caa32c2d48cc90624a6bb15acf876` |
| Triggers | `991c6c9293f75604d0b17be15633dde5` |
| Privilegios de función | `34b4387791e20ca1b6bccce4770b8fd1` |
| Privilegios de tabla | `0ecc2466ee3168d45e1710491d2997f8` |

Las huellas de funciones normalizan CRLF a LF antes de calcular MD5; las
restricciones excluyen los registros internos de `NOT NULL`, cuya
representación difiere entre la versión PGlite y PostgreSQL remoto. Las
huellas comparan filas ordenadas con nombres, definiciones, configuración de
seguridad y privilegios. El inventario remoto lista exactamente las 18
versiones 001–016. Las regresiones locales de SQL016 se encuentran en
`tests/supabase-manager-task-revocation-016.test.ts`.

## Interpretación

El aviso «001–014 migró mal» no queda respaldado como diferencia entre los
objetos instalados y el replay de los archivos versionados. El run #1 acredita
que el lote se aplicó secuencialmente y el cotejo actual acredita paridad de
catálogo para el estado final 001–016. No corresponde reejecutar la línea base
ni editar las migraciones históricas.

Esto tampoco significa que cada migración inicial haya sido funcionalmente
perfecta: SQL011 tenía una lectura de encargado que no exigía membresía activa
después de una revocación. SQL016 corrige esa ruta; la función remota final
coincide con el replay local de SQL016 y sus regresiones sintéticas pasan.

La frase «001–014 migró mal» mezcla dos asuntos distintos. Los defectos
históricos encontrados en SQL004–008 y SQL014 se corrigieron durante sus
iteraciones antes de fijar los hashes actuales; no se deben volver a ejecutar
esas versiones antiguas. En cambio, el defecto de membresía revocada de SQL011
sí persistió en el esquema instalado hasta que SQL016 reemplazó esa función.
La revisión del SQL016 y la comparación de catálogo respaldan que esa función
reparadora está instalada. Esto no equivale a certificar con Auth y HTTP
alojados todos los permisos de las 18 migraciones.

No hay evidencia para crear una migración 017 ahora: el run #4 no escribió,
SQL016 corrige el único defecto explotable confirmado en la revisión de
permisos citada, y no se identificó otra diferencia concreta que justifique
DDL adicional. No reejecutar SQL001–016 ni usar `migration repair` para intentar
resolver el fallo del workflow.

## Límites y siguiente paso

La comparación acredita paridad del catálogo, no comportamiento integral de
usuarios autenticados alojados, configuración de Data API, entregas de correo,
ni aceptación de producción. Mantener Auth y el área operativa apagados. Antes
de conectar usuarios reales siguen pendientes la confirmación de esquemas
expuestos en Dashboard y la matriz con identidades Auth de DEV.

No se ejecutó SQL de escritura ni se creó una migración compensatoria. El
workflow actual permanece exclusivamente de lectura para proteger el historial.
