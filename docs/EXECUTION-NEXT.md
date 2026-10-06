# Continuidad después de la versión privada 1.0

El pedido06/10 actual autoriza completar y publicar el recorrido diario privado. Las instrucciones previas de conservar live v43 y limitarse a SQL011 quedan superadas para esta entrega.

1. Reutilizar el mismo Site, su fuente Git privada y `get_site`; preservar audiencia owner-only salvo aprobación expresa del usuario.
2. Mantener API y almacenamiento D1 por entidades, autorización en cada solicitud, CAS/token transaccional y lectura coherente. No volver a perfiles simulados ni localStorage como fuente de verdad.
3. El propietario configura empresas/equipo, usa Mi tablero y completa inducción. Perfiles sin correo configurado no pueden autenticarse. Crear perfil no invita ni concede audiencia.
4. Próximo trabajo: revisión visual/móvil y piloto de cuentas reales después de la aprobación de acceso. Después respaldo/restauración y MFA; secundarias según PROJECT-STATUS.
5. Supabase001–010 y contrato011 se conservan como ruta futura, sin aplicación remota. No conectar el gateway viejo a la UI1.0.

Modelo recomendado para una revisión de seguridad, concurrencia y piloto: GPT-6.1 Sol, esfuerzo alto. Implementación de un contrato ya cerrado: GPT-6 Luna medio. No delegar ni afirmar cambios de modelo que el entorno no permita verificar.

Validación previa: suite completa293; bloque operativo afectado20 tras normalizar almacenamiento; TypeScript/Vite/Worker y diff. QA de DOM no sustituye navegador real. No solicitar «continuar» entre subtareas autorizadas.
