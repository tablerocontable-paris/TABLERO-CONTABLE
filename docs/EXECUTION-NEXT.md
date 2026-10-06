# Próxima ejecución — continuar desde este repositorio

El código y los commits originales del chat anterior fueron recuperados en este
checkout. No depende de leer o esperar ese chat. Proyecto Sites existente:
appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85. No crear otro proyecto ni reiniciar.

## Corte 011 completado localmente

La continuación incorpora reporte/cierre v4, atribución por cuotas, cobertura
sin puntos duplicados, cancelación de reglas y sus bindings, envelope completo
prepare/acquire/revalidate, conversión de ausencias/catálogo/inducción y lectura
compatible de reportes históricos. SQL 001–010 permanece intacto. El laboratorio
PostgreSQL 17.11 ejecuta 26 carreras AB/BA con barreras observadas en pg_locks y
pg_stat_activity, conflictos40001 y rollback íntegro, sin40P01. Evidencia en
architecture/COORDINATION-011-CONTINUATION-20261006.md.

## Siguiente bloque

**GPT-6.1 Sol, alto, Standard:** revisar este corte y preparar B3 (jerarquía
multiarea, transferencias/bajas/huérfanas) y el contrato de integración B1/B2
con las vistas. El proyecto vigente es TypeScript/SQL; no reescribirlo en Python.
Incorporar las nuevas preferencias IVA/Gemelo al definir la evolución de producto,
sin reemplazar la reconstrucción existente.

**GPT-6 Luna, medio, Standard:** ejecutar el contrato revisado, mantener APIs
separadas para datos compartidos y privados, pruebas y continuidad en Git.

Antes de conectar: adaptar contratos SQL actuales, manejo de 40001 con rollback
completo, DTO/reporte3+4 y permisos, aceptación de UI, QA visual y volumen. El
laboratorio usa Auth/JWT ficticios; NO acredita Supabase Auth, MFA, invitaciones,
correo, Storage ni RLS con sesiones reales.

## Autorización y puertas de publicación

El usuario autorizó commits y push de fuente al mismo repositorio de Sites.
No implica despliegue web ni ejecución de SQL remoto. Live sigue en v43.
No crear GitHub/Supabase/hosting ni cuenta dedicada todavía. No usar legacy.
Sólo declarar lista la app operativa cuando estén cerrados los pendientes
funcionales, UI/servicios reales, seguridad, piloto y recuperación en
PROJECT-STATUS.md. Hoy esa puerta permanece abierta.

## Verificación reproducible

- npm test -- --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000
- npm run build
- git diff --check
- node scripts/coordination-concurrency.mjs --psql /ruta/local/psql --port 55432 --output /ruta/local/evidencia.json

El runner sólo se conecta a 127.0.0.1, crea bases nuevas con prefijo
coordination_011_lab_, carga datos ficticios y conserva laboratorios para revisión.
Usar exclusivamente un motor local descartable. Sin PostgreSQL indica
NO EJECUTADO y sale con código 2; no presentar PGlite como sustituto.

Avance global estimado: **42% (36–46%)**, metodología conservada. El bloque 011
avanzó en implementación/verificación; el producto aún no está integrado.
