# Reparación UI A — implementación v40

Implementación: `1099e9d8ae47c2b1953288b7fa8d7d0bbd380fc5`.
Deploy Sites v40: `appgprj_6abd71ec7bfc81918c0f3fce5b6a7f85~appgver_d8f07e23ce4c81918847eeb7ea3de22f`.
Deploy `appgdep_6abffc86ca808191be701a9954b3e491`: **succeeded**.

Cambios:

- Los encargados usan el avatar circular con iniciales igual que el resto. El
  test pone el perfil del encargado como “Lucía Fernández” y verifica “LF”.
- El recorrido aplica un solo foco al primer destino visible; observa filtros,
  cambios en el DOM y columnas plegables. Ante un destino ausente, resalta el
  encabezado y explica el motivo en el coach. El foco se limpia al pausar y al
  cerrar/cambiar perfil.
- La versión v4 del recorrido ahora usa una constante única, incluida la salida
  de inducción.
- El cursor de ambas gráficas usa 12% de relleno y 55% de borde; el tooltip
  permanece opaco. Tests cubren esas propiedades y el clic filtra por persona,
  equipo y sector.
- Durante las pruebas se corrigió además el orden de Hooks: el estado/efecto del
  recorrido se declara antes de las pantallas tempranas de inducción.

Validación: **206 pruebas / 17 archivos**, build de producción y `git diff
--check` aprobados. La revisión de los cursores comprueba sus propiedades al
renderizarlos; no equivale a inspección visual completa en tamaños, temas y
navegadores. La corrección no altera contratos, métricas, permisos, base ni
servicios.

Sites confirma v40 activa en
https://grupo-paris-contabilidad.valentino-magni.chatgpt.site, acceso restringido
al propietario y cero visitantes externos. Esta demo guarda localmente. La
aceptación independiente del cambio queda pendiente de Sol medio; la publicación
por sí sola no significa que A esté aceptado ni habilita migraciones.
