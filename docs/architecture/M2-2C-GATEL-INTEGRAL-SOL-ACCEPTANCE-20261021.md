# Aceptación integral Sol — §9 / Gate L

Fecha: 2026-10-21. Dictamen independiente sobre la matriz del corte local
SQL014. **Gate L queda aceptado sólo para la validación local sintética descrita
abajo.** Esta aceptación habilita el preflight remoto controlado de Supabase
dev; no constituye autorización para production, datos reales ni activar el
espacio operativo.

## Identidad y evidencia verificada

- `HEAD` y `origin/main`: `eb960410a14d70abbc4c3a43528f6da1aa567a1c`.
- SHA-256 actual de `supabase/migrations/202610150014_operational_api.sql`:
  `218DEA9E9E3097743BD09238E73D5840A664F6718AEBE7670B88AF064278A837`.
- Doce carreras residuales: `GREEN_RESIDUAL_12`, 12 casos, cero errores y
  deadlocks; runner SHA-256
  `414601854C47106A4F2D289BC51116413FCF1F090D38090A99632DE4FE412500`, reporte
  `A07BA3253E395E6B44F267755B1082E01A25DA6368804CBBC1B614286ED15A87`, manifiesto
  `B8EDD3394BF7AD507DFE83812437D9E7F375EAD8F964053301F26D8F75E2294C`; salida 0.
- Atomicidad/calendario C: `GREEN_C_LATE_ATOMICITY_CALENDAR`, 10 casos, cero
  errores y deadlocks; runner SHA-256
  `08DDC8B61798FA086B59859D9388246F25AE0106D28710A041BD1DAE54E039DF`, reporte
  `3C3DFA0452EC2FEE6F63DC5B5A9619E5C7FF564FBA3DC526A6E7366AC706271F`, manifiesto
  `3289B52BE0E8DA639AB76816124560C1A77F2EFE8B24C65F6D31E44110837B59`; salida 0.
- Suite oficial sobre el corte actual, excluyendo `tmp`: 74 archivos, 738/738,
  salida 0. Log SHA-256
  `E0FA0AED578880CACFE158D77512D1D8634CB14B583ABD8F8AE537E59447BD70`; salida
  `../../outputs/m2-2c-post-P-full-suite-20261021.exit` SHA-256
  `13BF7B3039C63BF5A50491FA3CFD8EB4E699D1BA1436315AEF9CBE5711530354`.
- `npm run build` ejecutó la cadena declarada en `package.json`: TypeScript,
  build cliente y build Worker; salida 0. Log SHA-256
  `52DE2FEFAB2C779157001AABF24CB685E29B8F71D04F5F7114B28A721BDEBC3E`; archivo
  de salida 0 SHA-256 `13BF7B3039C63BF5A50491FA3CFD8EB4E699D1BA1436315AEF9CBE5711530354`.
- El hash SQL de ambos runners coincide con el archivo presente. Se conservaron
  las aceptaciones específicas de P, T, C y A, más las dos aceptaciones locales
  de los casos residuales y C que constan en el registro de revisión/crosswalk.

## Dictamen

Acepto la matriz finita de §9 y cierro Gate L para el corte exacto indicado.
La evidencia cubre la suite final, los 12 escenarios residuales en PostgreSQL
17.11, las seis inyecciones C posteriores a escrituras, retries y replays,
validación de borradores, fechas límite/calendario, aprobación multilínea
all-or-nothing y las aceptaciones acotadas T/C/A/P previamente registradas.
Los snapshots completos y comparaciones de estado documentados hacen que el
dictamen sea coherente con el alcance declarado; no se requiere repetir esas
matrices antes del preflight dev.

## Límites que permanecen

- Todo lo aceptado aquí se ejecutó en PostgreSQL local sintético. Los casos P
  replay-first usan un operador SQL local directo para simular el escritor de
  perfil; no prueban una ruta autenticada de gestión de perfiles. El runner
  declara esta limitación y no la presenta como identidad de aplicación.
- No se ejecutaron las funciones contra Supabase alojado. La lectura previa del
  proyecto dev no sustituye el preflight de destino, exposición Data API,
  esquema/migraciones ni prueba de Auth/HTTP.
- Este dictamen no acepta Storage/restore, frontend alojado, Cloudflare, correo,
  CI/despliegue final, experiencia real desde PC personal ni producción.
- SQL014 no fue aplicada remotamente y el espacio operativo sigue apagado.

## Siguiente paso autorizado

Continuar con una revisión de sólo lectura de configuración y destino de
`grupo-paris-dev`, preparar preflight reproducible y revisar su resultado antes
de aplicar SQL014 exclusivamente a ese proyecto. Después corresponde Gate H
(Auth/HTTP sintéticos). Si el destino o la exposición difieren de lo esperado,
detener la aplicación y resolver el hallazgo primero.

— GPT-6.1 Sol, esfuerzo alto — aceptación independiente de Gate L, alcance local
