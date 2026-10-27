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

1. Terminar y probar el estimador con fixtures sintéticos; revisar CLI, seguridad
   de entradas, zona horaria y reconciliación de intervalos.
2. Registrar contrato y evidencia reproducible en este repositorio y continuar
   su flujo directo a `main`, sin PR si el usuario mantiene esa preferencia.
3. Sólo después, procesar un extracto real si se recibe de forma autorizada;
   preservar originales localmente y compartir, como máximo, métricas agregadas
   revisadas. No almacenar esas cifras o identificadores en el repositorio.
4. Para terminar el producto real: resolver Data API/Auth y pruebas de permisos
   en DEV, definir persistencia segura, luego producción, Cloudflare/correo y
   aceptación desde la PC personal. Ver gates en `docs/EXECUTION-NEXT.md`.

## Estado de esta copia al iniciar la continuidad

HEAD `2ff373c700547f0eb2c9c34ae1278984706d2737`, remoto `origin/main` igual.
Después se implementó el estimador, plantillas vacías, cobertura sintética y
documentación portable. La última suite completa aprobó **843/843 en 85
archivos**; TypeScript, build cliente y build Worker terminaron con código 0. El
build cliente reporta un chunk sobre 500 kB. El hook y CI de GitHub todavía
deben confirmarse para el commit de esta etapa.

Al terminar esta etapa, se debe registrar el SHA del commit que contenga los
cambios en `.gitignore`, `AGENTS.md`, `package.json`, el catálogo neutral, los
scripts/declaraciones del estimador, las plantillas vacías, pruebas y documentos.
El archivo
`tests/review/m2-2c-legacy-task-control-replay-races.block` es scratch protegido;
no leerlo, modificarlo, incluirlo ni borrarlo.
