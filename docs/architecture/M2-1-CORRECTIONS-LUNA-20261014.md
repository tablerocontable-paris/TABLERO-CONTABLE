# M2.1: contrato implementado y pendiente de aceptación independiente

Fecha: 14/10/2026. Este documento fue el contrato para corregir la revisión de
Sol. Las correcciones ya están implementadas localmente; consultar la evidencia
actual en `review-evidence/m2-1-corrected-implementation-20261014.json`.
Pendiente: revisión independiente Sol alto. No iniciar M2.2 ni crear014 hasta
aceptación. Conserva criterios y comandos del trabajo ejecutado.

## Alcance y archivo SQL

Corregir `supabase/migrations/202610140013_api_identity_foundation.sql`.
013 sólo fue aplicado en bases descartables; no tiene aplicación alojada y se
puede corregir antes de su primer deploy. Las 14 migraciones anteriores no se
modifican. No tocar App, main, Worker/D1, RemoteWorkspace, Site o dependencias.

La propuesta exacta probada se obtiene desde la fuente original 013 ejecutando:

```powershell
node tests/review/m2-1-native-review.mjs --pg-bin ../pg-runtime/pgsql/bin --output-dir ../../outputs/m2-1-candidate-for-implementation --port 55439 --candidate guard-fence-v2
```

Usar una carpeta output nueva. Antes de copiar, comprobar que su review.json
indica 11/11 y que candidate-013.sql tiene SHA-256
`168e0fc739820bf7f03e54326ff9f8998f667ab4a75ce444c449301a8ef8b12c`.
Incorporar ese SQL a013 y conservar las decisiones siguientes. El generador sólo
admite el hash original normalizado a LF; una vez corregido013, ejecutar el
runner SIN --candidate para comprobar la migración real.

1. Guard de contexto: `aal IS NULL OR aal NOT IN ('aal1','aal2')` deniega 42501.
   Contar perfiles y técnicos por ID sin filtrar active. Si el total no es 1,
   denegar 42501. Selección posterior exige active; no revelar cuál falló.
2. `app_private.normalize_context_name(text)`: función SQL IMMUTABLE STRICT,
   search_path vacío; aplicar btrim con exactamente estos caracteres Unicode:
   0009,000A,000B,000C,000D,0020,00A0,1680,2000..200A,2028,2029,202F,205F,3000,FEFF.
   Es el conjunto de String.trim usado por el decoder. Usarla al proyectar
   profiles.name/technical_accounts.display_name y en CHECK técnico1..200.
   Función interna sin EXECUTE cliente; no reescribir nombres almacenados.
3. `app_private.principal_identity_fences`: user_id UUID PK FK auth.users
   ON DELETE CASCADE; revision bigint NOT NULL DEFAULT 0 CHECK>=0. RLS activa,
   sin policies ni grants cliente/servicio. No semilla ni perfiles ficticios.
4. Trigger existente: conservar lock1110; después hacer INSERT(user_id,revision)
   VALUES(newId,1) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1, antes
   del SELECT a la tabla contraria. Mantener los dos triggers INSERT/UPDATE OF ID.
   Una colisión de identidad en READ COMMITTED da 23514; snapshots obsoletos pueden
   dar 40001. Ambos abortan sin principal parcial; no capturar 40001 ni convertirlo
   en éxito. No modificar auth.users desde el trigger.

La tabla de coordinación tiene datos técnicos y no requiere DTO/UI ni aparece
en métricas, directorio o respaldo del laboratorio. Sólo se escribe al modificar
identidad. Consultar contexto sigue sin escribir ninguna fila, incluido el contador.

## Helper y pruebas requeridas

Restaurar `AccountingLab.actor()` para que el tercer parámetro tokenRole sea
optativo, sin valor por defecto; si no se proporciona, mantener claims `{aal}`.
Las pruebas de API013 deben pasar authenticated explícitamente, idealmente mediante
un wrapper local a ese archivo. No convertir los tests legacy al contrato nuevo.

Ampliar las pruebas de identidad existentes con regresiones R1–R4 y la matriz:

- AAL ausente, JSON null, vacío y desconocido:42501 para empleado y técnico.
- Perfiles con espacios, tabs, saltos, NBSP y FEFF: un nombre sólo blanco se
  deniega; uno válido se normaliza de la misma forma que String.trim. Incluir
  nombres200/201 caracteres y Unicode; el DTO emitido pasa el decoder real.
- Identidad dual con ambas activas, sólo una activa, o ambas inactivas:42501.
  Para simular corrupción, sólo el fixture postgres puede suspender/reponer
  temporalmente el trigger dentro de una transacción descartable.
- Grants: anon/authenticated sin SELECT/INSERT/UPDATE/DELETE/TRUNCATE ni REFERENCES
  de ninguna tabla app_private. Funciones internas sin EXECUTE para PUBLIC,
  anon/authenticated/service_role. Sólo endpoint con EXECUTE authenticated.
  Comprobar RLS/policies, defaults y que ACL de funciones public previas no cambian.
- Las consultas autenticadas no alteran tablas public, technical_accounts ni
  principal_identity_fences. Restablecer SET ROLE authenticated después de capture.
- Fallo/rollback de inserción, cambio de UUID y duplicado no deja fence/principal
  parcial; incluir fallo posterior al trigger para verificar rollback del contador.

Upgrade poblado012→013: crear entregable, operativa+movimiento, sesión finalizada,
recibo idempotente, nota privada/historial y cierre/report/outbox mediante los
fixtures/RPC existentes. Hay ejemplos en coordination-completion-011.test.ts y
private-block-notes-009.test.ts. Exigir count>0 de cada familia antes de snapshot;
comparar to_jsonb(row)::text ordenado de todas las tablas public no vacías antes/
después, más snapshot::text de cierres/reportes. No usar assert vacíos como prueba
de historia conservada. El JWT previo debe reflejar inactivación/rol/membresías DB.

## Prueba PostgreSQL y cierre

Ejecutar el runner nativo SIN --candidate sobre013 corregido, con output nuevo:

```powershell
node tests/review/m2-1-native-review.mjs --pg-bin ../pg-runtime/pgsql/bin --output-dir ../../outputs/m2-1-corrected-native --port 55439
```

Debe pasar 11/11 sobre la migración real. Extender el runner para añadir carreras
INSERT/UPDATE de UUID y aislamientos mezclados RC/RR, en ambos órdenes. Observar
barrera real pg_blocking_pids; una sola identidad final, sin 40P01. La prueba actual
de11 casos demuestra la propuesta en el caso básico, no sustituye esa ampliación.
Verificar explícitamente rollback de fence y existencia única después de abortar.

Luego focales, suite completa y build TypeScript/cliente/Worker. Registrar comandos,
salidas, motor y hashes (dejar claro si se normalizan saltos de línea). Conservar
la evidencia original como histórica; crear evidence de corrección nueva. Actualizar
estado/documentos, commit y paquete portable con logs/contrato vigente. No desplegar
ni enlazar cuentas. Volver a Sol alto para aceptar M2.1 y definir M2.2;014 permanece
pendiente hasta ese corte. No aumentar el avance global por una propuesta de revisión.
