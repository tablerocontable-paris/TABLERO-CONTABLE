# Continuidad portable del proyecto — 27/10/2026

## Fuente de verdad

- Repositorio privado: `tablerocontable-paris/TABLERO-CONTABLE`, rama `main`.
- Site existente: `appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85`, versión publicada
  98, privado para su cuenta propietaria. El CI de GitHub no publica el Site.
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

Commit `daee754b9b688931e0779e271245acd6bd695526` contiene el estimador y
contratos neutrales. El último corte documental validado es
`14304ff79557ada887fd2f3d8e0f616ff4d4786d`, publicado directamente en `main`
bajo Tablero Contable y sin PR. Actions run `40547953494` (#114) aprobó
instalación, suite, build y paquete Sites; el hook local fue 212/212 y las
pruebas focales 27/27. La suite completa histórica es 843/843 en 85 archivos.
El build cliente advierte un chunk principal superior a 500 kB.

`main` contiene código, contratos, pruebas, historia Git y continuidad técnica
segura. No incluye conversaciones brutas, datos identificables, credenciales,
sesiones ni archivos personales. El archivo
`tests/review/m2-2c-legacy-task-control-replay-races.block` es scratch protegido;
no leerlo, modificarlo, incluirlo ni borrarlo.
