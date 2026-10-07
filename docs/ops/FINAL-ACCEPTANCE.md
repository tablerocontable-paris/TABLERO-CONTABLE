# Definición de terminado — pedido 06/10/2026

100% exige cerrar el alcance funcional y todas las correcciones conocidas,
validar la aplicación integrada y tener infraestructura funcionando bajo
cuenta propia: GitHub, dos proyectos Supabase separados (dev y producción)
y hosting Vercel o Cloudflare. Un prototipo publicado en Sites no cumple esto.
No implica garantizar que nunca aparecerá un defecto futuro.

## Puertas de aceptación

1. Producto: cerrar pendientes de PROJECT-STATUS, aprobar recorridos completos,
   privacidad, permisos, reportes y pruebas con datos ficticios.
2. Tras aceptación funcional: configurar cuentas propias e infraestructura.
   No enviar invitaciones reales ahora. No pedir el correo del jefe en laboratorio.
3. Integración: probar Auth, MFA, RLS, empresas, migraciones desde cero y upgrade
   en Supabase dev real; comprobar respaldo y restauración.
4. Entrega: PR/checks/protecciones, preview, migración y deploy ordenados,
   verificación posterior y recuperación. Probar el flujo completo con un cambio.
5. Producción: mismo código aceptado, Supabase producción separado, hosting
   y accesos verificados; cero correcciones conocidas pendientes de aceptación.

## Estimación actual

**Alrededor del 45% global**, estimación de planificación, no medición exacta.
La referencia anterior 45–50% no acreditaba infraestructura terminada.
Las pruebas locales y SQL implementado no acreditan Supabase desplegado.
No aumentar el porcentaje por escribir un plan o preparar un workflow.

## Automatización actual

- Activo localmente: hook pre-commit (tipos, pruebas rápidas y diff staged).
  Instalar en cada checkout con `npm run hooks:install`. Requiere dependencias.
  Valida el árbol de trabajo; no garantiza un snapshot parcialmente staged.
- Preparado: workflow GitHub con suite completa, build y validación del paquete
  de despliegue Sites del commit enviado. No ejecutado en GitHub: todavía no
  existe ese repositorio propio.
- Pendiente: creación automática de PR, promoción dev/main, migraciones
  Supabase por CI y deploy del hosting. No existen secretos/destinos conectados.
- Sites: fuente y publicación se ejecutan mediante herramientas del asistente;
  no hay automatización permanente de publicación activada en este checkout.

Objetivo rutinario: pedir un cambio y recibir commit, PR, checks, migraciones
y sitio actualizado sin pegar SQL. El alta inicial y verificación de cuentas
propias se realiza una vez; las credenciales no se incluyen en Git.
