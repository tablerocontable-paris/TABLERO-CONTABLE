export function evidenceStorageErrorMessage(error: unknown, action = "guardar evidencia") {
  const cause = error instanceof Error ? error : null;
  const name = cause?.name || "";
  if (name === "QuotaExceededError")
    return `No hay espacio disponible en este navegador para ${action}. Liberá espacio o guardá una copia del laboratorio antes de volver a intentar.`;
  if (name === "SecurityError" || name === "NotAllowedError")
    return `El navegador bloqueó el almacenamiento local necesario para ${action}. Revisá los permisos del sitio.`;
  if (cause?.message) return cause.message;
  return `No se pudo ${action}. El estado del laboratorio no se modificó.`;
}
