# Correspondencia entre GitHub y Sites — 26/10/2026

## Resultado comprobado

El Site privado existente continúa en versión 97. La consulta Sites del
26/10/2026 confirmó el deployment
`appgdep_6adfa65a1ed081918f5fc8fd05bb72a9` en estado `succeeded`, con URL
`https://grupo-paris-contabilidad.valentino-magni.chatgpt.site`. La audiencia
es personalizada y autoriza únicamente a la cuenta propietaria; hay cero
visitantes externos.

El SHA de fuente Sites de v97 es
`2d1c2f4916a633624ed5b8afa10708cad246547b`. Pertenece a un historial Git
separado y no es un commit del repositorio GitHub. Esto no indica por sí mismo
un error de deploy ni que se haya usado otra cuenta.

Se compararon árboles versionados:

| Fuente | SHA | Archivos | SHA-256 de manifiesto |
|---|---|---:|---|
| Repositorio GitHub, `main` | `7b9aa3d7344d2cf1f0d7d2eb62390c4aea9b1cc7` | 640 | `3e1461dbd2beb2504dcf9bf71a560fc39d274dac0255c947d9a70a91a8629a98` |
| Fuente Sites, versión 97 | `2d1c2f4916a633624ed5b8afa10708cad246547b` | 640 | `d994ad67429d0d72fcb43faece398ee805bfa72e4e398b331d71014a9329a56b` |

Las únicas rutas diferentes son `docs/PROJECT-STATUS.md` y
`docs/EXECUTION-NEXT.md`. Los otros **638 archivos** coinciden en modo, tipo y
blob; su manifiesto conjunto tiene SHA-256
`e5866861cd2c296061ca078fb6b6eaede23229dc709870cba8d0e30a165ee900`.
El manifiesto se calcula con las líneas de `git ls-tree -r --full-tree`
ordenadas ordinalmente, unidas con LF y LF final, en UTF-8.

También se comprobó que GitHub `main` en `7b9aa3d` sólo cambió esos dos
documentos frente al último commit de código
`fb5b5d4751e841460d104479b22ebbe31ac9e1c7`. Por lo tanto, el código
versionado del Site v97 y el código en GitHub `main` coinciden. Esta
comparación acredita correspondencia de fuentes, no que todos los flujos de
producto estén libres de errores.

## Acceso y continuidad

`project_id` identifica el mismo proyecto Sites, pero no prueba una
sincronización automática entre GitHub y Sites. Para abrir el Site hay que
usar la cuenta propietaria de ChatGPT autorizada en el acceso personalizado.
La conexión de GitHub no otorga permiso de acceso al Site.

En cada publicación futura conviene registrar el SHA GitHub, el SHA propio del
checkout Sites, número de versión, deployment, estado y hash del paquete. Los
dos historiales Git pueden usar SHAs diferentes aun cuando el árbol de código
sea idéntico. Mantener la audiencia owner-only y publicar sobre este mismo
proyecto.

Esta evidencia corresponde a los commits enumerados arriba; no incluye los
cambios locales no confirmados del catálogo v2 ni confirma su publicación.
