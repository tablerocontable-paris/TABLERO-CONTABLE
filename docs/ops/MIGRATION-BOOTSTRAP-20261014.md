# Precedencia vigente — 16/10/2026

La importación a GitHub quedó hecha en una raíz Git nueva, atribuida a Tablero
Contable y publicada directamente en `main` del repositorio privado
`tablerocontable-paris/TABLERO-CONTABLE`. `main` es la rama de trabajo; no usar
PR, `dev` ni ramas de integración para el flujo rutinario. El commit inicial es
`8a10c6c19c1a619d3a621ea25af30e15f503cae0`; sólo se publica el código y los
documentos versionados, no credenciales ni estado local del navegador. El
checkout de la PC personal debe clonar `main` y autenticarse con la cuenta nueva.

La conexión Supabase/Cloudflare todavía no está verificada. La revisión Sol de
M2.2A-R7/R8 sigue siendo gate antes de cambiar/aplicar SQL. La creación de
recursos dev, si se autoriza al continuar, no significa producción, migración de
empleados, invitaciones ni despliegue público. No configurar SMTP/Gmail ni
enviar correo hasta acordar el dominio/remitente y la necesidad de Auth.

# Migración a cuentas propias — contrato de inicio, 14/10/2026

> Actualización M2: M1 local consolidado en 8d95200. Diseño de paridad completo en
> ../architecture/SUPABASE-M2-CONTRACT-20261014.md; contrato inmediato de Luna en
> ../architecture/M2-1-IDENTITY-LUNA-20261014.md. Los siguientes preflight/M0/M1
> conservan el estado inicial de su corte. La cuenta GitHub nueva sigue pendiente
> para trabajo remoto y no bloquea la implementación local de SQL013/contexto.

## Decisión vigente

El usuario autorizó iniciar GitHub, Supabase y hosting propios para continuar
desde su PC personal. GitHub será una cuenta NUEVA; ninguna de las conexiones
anteriores es destino autorizado. Esta decisión permite consolidar código y
conectar desarrollo aunque la aceptación humana con lector de pantalla siga
pendiente. Reemplaza la espera histórica para iniciar cuentas. No constituye
aceptación final, alta de empleados, importación de datos reales ni contratación.

Se conserva este Git y el Site privado
`appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85`. La evidencia anterior de 668 pruebas
y 69 comprobaciones de aceptación es local; no valida Supabase real.

## Preflight

- HEAD `2c3fbfe`, rama `main`, sin remotos. Al iniciar el bloque: 107 archivos
  rastreados modificados y 2.685 nuevos, incluidos 2.565 bajo `outputs/`.
  Los 267 renglones anteriores de status agrupaban carpetas, no eran 267 archivos.
- `outputs/` contiene aproximadamente 416,6 MB. Se conserva localmente; sólo
  evidencia seleccionada entra en el corte Git.
- npm y Node 24 son el gestor/runtime del corte. package.json y la raíz del
  lock npm coinciden. Preservar como extras locales pnpm-lock.yaml y
  pnpm-workspace.yaml; este último contiene un placeholder de allowBuilds.
- main.tsx abre LaboratoryWorkspace. No hay cliente Auth Supabase en la entrada.
- Hay 14 archivos SQL hasta contrato 012. La CI existente sólo valida
  pruebas/build/paquete Sites; no aplica SQL ni despliega hosting propio.
- La cuenta GitHub nueva aún no está identificada/conectada. El directorio de
  plugins ofrece Supabase; no estaba instalado durante el preflight.

## Arquitectura de destino

GitHub privado conserva fuente/historial: ramas de trabajo → PR a dev → release
por PR a main. Supabase tendrá dos proyectos independientes, dev y producción;
Postgres será la fuente de verdad, Auth el actor, Storage la evidencia privada
y Realtime la señal de avisos/presencia autorizados.

Lecturas por DTO autorizado; acciones mediante comandos/RPC transaccionales,
revisiones e idempotencia. No publicar el State completo del laboratorio como
documento compartido. Consultar empleados conserva al actor autenticado;
el servidor decide el ámbito. Funciones administrativas elevadas quedan en
servidor Supabase; no se expone service_role al navegador. No operar D1 y
Postgres como dos fuentes activas ni activar RemoteWorkspace como adaptador
Supabase: su identidad/protocolo pertenecen al backend Sites.

Hosting nuevo: **Cloudflare Workers Static Assets**, fallback SPA, conservando
Vite/React. Sustituye la preferencia histórica por Pages: Cloudflare recomienda
Workers para proyectos nuevos. No desplegar el Worker/D1 Sites automáticamente.
Proteger TODO el tráfico dev/previews con Cloudflare Access ANTES de desplegar
contenido; verificar acceso propietario y rechazo anónimo. Repo privado y
noindex no acreditan privacidad del sitio. Auth/RLS se verifica por separado.

La entrega se orquesta por GitHub Actions, sin otro deploy independiente que
pueda adelantar la app a su migración. Registrar el mismo commit/artefacto para
cada entrega. Configuración operativa incompleta debe fallar cerrada, sin
fallback silencioso a laboratorio o identidad simulada.

## Brechas de paridad — condiciones para activar Supabase

| Área | Evidencia actual | Contrato pendiente |
| --- | --- | --- |
| Identidad | main.tsx abre laboratorio; no crea sesión Supabase | Login/recuperación/expiración, MFA administrativa y bootstrap sin registro público de roles |
| Operativas | task-contract.ts exige target positivo; SQL 012 exige meta; gateway y SQL exigen referencia | Cantidades sin meta, coeficiente versionado/snapshot, referencia opcional y calidad independiente; no reinterpretar historia |
| Colecciones nuevas | State marca rates, assessments, calendar, closures y evidence como exclusivas del laboratorio | Esquema/RPC/DTO, ámbito y auditoría para cada colección |
| Seguimiento/ruta | Campos comerciales y dependencias locales | Validación 0–30, ciclos, disponibilidad, permisos y confirmación de completado en servidor |
| Cierres | Nuevo alcance persona/empresa/mes local | Grupos conjuntos atómicos, revalidación/reintentos, snapshots y bloqueo selectivo |
| Evidencia | IndexedDB/respaldo v2 locales | Storage privado, límites/hash, finalización/compensación, retención por cierre y restore |
| Privacidad | Consultar/gestionar/ejecutar separados localmente | RLS/RPC/DTO equivalentes; notas personales fuera de búsqueda, reportes, calendario y consulta ajena |
| Avisos/presencia | Avisos locales y presencia simulada | Dos sesiones, destinatarios autorizados, heartbeat 30 s / caducidad 90 s; fuera de KPI |
| Otros módulos | Obligaciones, pedidos, propuestas, planificación, comentarios/reportes locales | Inventario de todas las lecturas/escrituras y contrato de servidor antes de declarar paridad |

Son trabajos de integración pendientes, no regresiones nuevas del laboratorio.
Añadir migraciones posteriores; no editar migraciones ya aplicadas. Probar
desde vacío y upgrade, incluyendo los snapshots históricos.

## M0 — protección y documentación

Inventario por ruta/SHA-256, bundle del historial comprometido y ZIP de fuente
actual superpuesta. Es recuperación ANTES del commit, no release, y no incluye
datos del navegador. Verificar bundle y cada entrada ZIP. Registrar escaneo de
secretos con límites. Ningún recurso remoto se crea en este bloque.

## M1 — contrato ejecutable Luna: Git y PC personal

1. Usar git-candidates.json del paquete M0; revisar diff completo. Crear rama
   migration/github-bootstrap. Revalidar hashes antes de stage; no git add .
2. Incorporar fuente, pruebas, SQL, docs y evidencia explícita del manifiesto.
   Excluir outputs masivos, node_modules, dist, secretos y extras pnpm. Ajustar
   gitignore sin borrar archivos; mantener el LEEME rastreado y evidencia elegida.
3. Revisar secretos del corte E HISTORIAL sin imprimir valores. No reescribir
   historial ni ocultar hallazgos. Conservar identidad Git local existente; si
   falta, pedir el dato sin inventarlo.
4. Verificar las acciones CI en sus repositorios oficiales y fijar SHA válido.
   npm ci usa el lock npm. No entregar secretos a PR de forks. El workflow inicial
   valida el laboratorio; no incluye aún despliegue ni SQL remoto.
5. Ejecutar hook, suite, TypeScript y builds del candidato. Commit del laboratorio
   revisado, sin llamarlo producto final. Generar/verificar bundle del commit,
   manifiesto y guía para clonación limpia en PC personal.
6. Si la cuenta nueva está conectada, comprobar identidad y crear repo privado
   grupo-paris si no existe. Confirmar propietario/visibilidad, configurar remoto
   sin reemplazar otro que aparezca, subir historial sin force, comprobar CI y
   abrir PR de integración. Adjuntar cada PR creado al chat.
7. Si falta cuenta, completar commit/bundle local y registrar únicamente la parte
   remota pendiente. M1 local no necesita cuentas Supabase/Cloudflare.

Aceptación: clonación limpia reproducible, npm ci/pruebas/build correctos,
secretos conocidos ausentes y guía suficiente. La primera apertura en PC personal
queda pendiente de confirmación real. La cuenta nueva la crea/verifica el usuario
y conecta la integración una vez; no pegar contraseñas/tokens/recovery codes.

## M2 — Supabase dev (Sol define contratos antes de Luna)

Inventariar TODOS los comandos/módulos y cerrar esquema/DTO/permisos por bloque.
Luna implementa migraciones/adaptadores definidos. Crear proyecto dev con ref
exacta verificada, Auth, Storage y secretos. Aplicar SQL mediante pipeline,
probar base vacía/upgrade y dos sesiones con aislamiento, concurrencia y restore.

## M3 — entrega automática dev (Sol antes de Luna)

PR → checks del commit/prueba SQL en base efímera CI → merge dev → migración dev
serializada → deploy privado → health check/recorrido. Un PR no migra la base dev
compartida: preview sólo si es compatible con el esquema actual. No contratar
branching pagado implícitamente. Registrar commit, refs, migraciones y versión.

## M4 — producción y rutina (después de aceptación)

Exigir paridad, lector humano y piloto dev antes de release. Separar secrets y
environments, verificar enforcement de protecciones en el plan GitHub privado
elegido; si no lo soporta, Sol resuelve antes de prometer seguridad equivalente.
Automatizar PR dev→main con checks, backup restaurable, migración compatible,
deploy y health check. Rollback de app no revierte datos automáticamente: usar
app compatible o corrección hacia adelante. Ensayar recuperación y revisar
por separado operaciones irreversibles, datos reales e invitaciones.

## Coste, datos y continuidad

No contratar planes, dominio ni SMTP automáticamente. Supabase Free permite
dos proyectos activos, con pausa por inactividad y sin backups automáticos.
Sirve para integración sintética; definir recuperación/coste antes de producción.
Plus de ChatGPT no paga proveedores. Secretos CI sólo por interfaz segura.

Código/historial viajan por Git. Estado ficticio y blobs IndexedDB, mediante
respaldo v2 separado si se desean; no importar laboratorio a producción.
Continuar código desde PC personal no necesita esperar colaboración multiusuario.

Modelos: Sol 6.1 alto Standard para arquitectura/seguridad/revisión; Luna 6 medio
Standard para M1 y contratos cerrados. Mantener selección manual. El ~45% global
sigue como estimación histórica, sin incremento por documentación o respaldo.

Fuentes primarias consultadas 14/10/2026:

- https://developers.cloudflare.com/pages/ (Workers para nuevos proyectos).
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://supabase.com/docs/guides/deployment/managing-environments
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/pricing
- https://learn.chatgpt.com/docs/models y https://learn.chatgpt.com/docs/pricing
