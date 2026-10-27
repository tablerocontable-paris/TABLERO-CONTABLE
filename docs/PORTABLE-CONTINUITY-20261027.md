# Continuidad portable del proyecto — 27/10/2026

## Corte de continuidad más reciente — verificado 27/10/2026

- El último commit funcional es `9b54a4625f56e07fedbfba82d68696204f9a0e5d`;
  el checkpoint documental `e9fae71f3c1fda7414f0ad103c99f60275670c76` pasó CI.
- GitHub Actions #119 (`40558575748`) terminó en éxito: instalación,
  pruebas completas, build y empaquetado Sites. [Ejecución #118](https://github.com/tablerocontable-paris/TABLERO-CONTABLE/actions/runs/40557105221).
- La versión 99 del Site existente está desplegada; su flujo de publicación es
  independiente de GitHub Actions y la audiencia personalizada se conservó.
- Los documentos de estado y la guía de traslado para la PC personal se
  actualizaron en este corte. Clonar siempre `main`; no usar ZIPs viejos como
  fuente de código.
- Este repositorio conserva contexto técnico sintetizado, decisiones,
  contratos, pruebas y evidencias saneadas. No contiene ni debe contener el
  historial bruto de chats, memoria global de Codex, comentarios privados,
  credenciales, sesiones, archivos originales o datos identificables.

La normalización local y su enlace con el estimador están implementados. Sol
aceptó el diseño del onboarding autenticado para el documento SHA-256
`E65E1B467525B8AE4769E2F10EB33E238043078ED9D1E635468D0ADBD7C93D68`; el código
y la migración posterior a 016 todavía no están implementados. En la PC de
trabajo hay Node 24, pero no npm ni Supabase CLI. Los totales reales de personal y tareas
completadas hoy siguen indeterminados hasta procesar un extracto vigente y
autorizado fuera del repositorio. Las capturas compartidas no bastan para ese
cálculo. La guía operativa está en `outputs/LEEME-PC-PERSONAL.md`.

## Fuente de verdad

- Repositorio privado: `tablerocontable-paris/TABLERO-CONTABLE`, rama `main`.
- Site existente: `appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85`, versión publicada
  99, deployment `appgdep_6ae0e7e339d4819180adeda021e82d7a`. Mantiene el modo
  de acceso personalizado existente: un usuario autorizado, cero visitantes
  externos. El CI de GitHub no publica el Site.
- Supabase: `grupo-paris-dev`; migraciones SQL001–016 están instaladas. El
  workflow vigente verifica en sólo lectura; no volver a aplicar el baseline.
- Estado operativo: perfiles y datos del laboratorio son ficticios; no activar
  Auth operativo, `/api`, producción ni invitaciones reales durante aceptación.
- Leer `AGENTS.md`, `docs/PROJECT-STATUS.md`, `docs/EXECUTION-NEXT.md` y
  `docs/MIGRATION-INVENTORY-20261026.md` antes de retomar trabajo.

## Decisiones vigentes

- Primera experiencia: 26 conceptos neutrales v2, sugeridos y editables; aún no
  existe onboarding remoto autenticado. Las sugerencias no son afirmaciones de
  qué procesos usa realmente la organización.
- Revisión independiente del 27/10: los 26 conceptos cubren el borrador, sin
  demostrar cobertura del trabajo real. Se conserva separada la recepción de
  cobranzas, su aplicación, el registro de liquidaciones y sus conciliaciones.
  El primer ingreso autenticado requiere especificar permisos, aprobación,
  borrador recuperable y aceptación antes de crear tareas. Hay comandos
  backend revisionados, pero el UI remoto no está integrado ni persiste el
  código/version del concepto neutral. Ver contrato borrador en
  `docs/architecture/AUTHENTICATED-NEUTRAL-FIRST-LOGIN-CONTRACT-DRAFT-20261027.md`.
- Se conservan los IDs históricos `starter-v1-*` y los historiales.
- La taxonomía estable v2 del laboratorio ya enlaza los 26 conceptos con el
  estimador y persiste la clasificación por propuesta, snapshot, estándar,
  asignación y ocurrencia. No se infiere desde títulos ni unidades. El cambio
  `9b54a4625f56e07fedbfba82d68696204f9a0e5d` pasó Actions #117
  (`40555801302`), suite local 845/845, pre-commit 214/214, TypeScript, builds
  cliente/Worker y paquete Sites. Se desplegó en Site v99 desde la rama fuente
  independiente, commit `a80e3013d00165f1bc0abd64a580545a4322e49b`.
- La captura de equipo sólo acredita 14 filas con nombre y una fila «Sin
  asignar», no el padrón vigente. Las imágenes de tareas están incompletas y no
  permiten estimar el trabajo real de hoy.
- Hay ahora un estimador local que separa personas activas, tareas por estado,
  ocurrencias que siguen completadas al corte, eventos de finalización y
  reaperturas, y movimientos operativos por unidad. No se puede informar una
  cifra real hasta contar con extracto vigente y autorizado.
- “Todo el contexto” se traslada mediante decisiones, requisitos, contratos,
  código, pruebas y evidencia segura. No se copian conversaciones brutas,
  memoria global de Codex, comentarios privados, información personal/de
  clientes, credenciales ni sesiones. GitHub no permite transportar esos estados
  y un volcado indiscriminado expondría datos privados.
- Node ya disponible en la PC de trabajo permite ejecutar el estimador y las
  pruebas locales sin instalar npm. Para un navegador real o comandos que sí
  requieran herramientas ausentes, se continuará en la PC personal y se anotará
  el bloqueo concreto; no se declara como prueba aprobada.

## Próximas acciones técnicas

1. Revisar el contrato de primer ingreso autenticado con la nueva clasificación
   versionada y llevarlo a implementación tras cerrar el diseño. No habilitar
   Auth operativo ni cambiar las migraciones 001–016.
2. Migraciones 001–016: el catálogo instalado coincide con replay local; SQL011
   tuvo un defecto funcional corregido por SQL016. No repetir la línea base.
   Mantener pendientes la revisión Data API y pruebas con identidades Auth.
   Evidencia: `docs/architecture/SUPABASE-DEV-SCHEMA-CATALOG-COMPARE-20261027.md`.
3. Para estimar datos reales, recibir un extracto autorizado y procesarlo
   localmente con el utilitario. Mantener originales, clave y CSV seudonimizados
   fuera de GitHub; no almacenar cifras identificables en el repositorio.
4. Completar el onboarding autenticado sólo después de cerrar la revisión de
   Auth/identidad y permisos en DEV; la inducción actual es de laboratorio y no
   puede crear asignaciones reales.
5. Para uso real, cerrar Data API/Auth y pruebas de permisos, luego persistencia,
   producción, Cloudflare/correo y aceptación desde la PC personal. Ver gates en
   `docs/EXECUTION-NEXT.md`.

## Corte implementado y publicado

La clasificación neutral local quedó publicada en GitHub `main` con el commit
`9b54a4625f56e07fedbfba82d68696204f9a0e5d` y desplegada en Site v99. Auth
operativo permanece apagado y las migraciones SQL001–016 no se alteraron.
La dotación y el trabajo real de hoy siguen sin determinarse: no se recibió un
extracto vigente autorizado.

Commit `daee754b9b688931e0779e271245acd6bd695526` contiene el estimador y
contratos neutrales. Como registro histórico, el commit documental
`14304ff79557ada887fd2f3d8e0f616ff4d4786d` pasó Actions #114. El corte
vigente es `ea99133402fbdae73b3a4bb7e4de42e4d8fc70d3`, validado por Actions
#118 (`40557105221`); el último código funcional es 9b54a46, validado por
Actions #117. La suite completa 845/845 y hook 214/214 corresponden a ese
corte de código; la actualización posterior fue documental. El build cliente
advierte un chunk principal superior a 500 kB.

`main` contiene código, contratos, pruebas, historia Git y continuidad técnica
segura. No incluye conversaciones brutas, datos identificables, credenciales,
sesiones ni archivos personales. El archivo
`tests/review/m2-2c-legacy-task-control-replay-races.block` es scratch protegido;
no leerlo, modificarlo, incluirlo ni borrarlo.
