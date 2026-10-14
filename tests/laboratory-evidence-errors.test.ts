import { describe, expect, it } from "vitest";
import { evidenceStorageErrorMessage } from "../src/data/evidenceErrors";

describe("errores del almacenamiento local de evidencia", () => {
  it("explica cómo recuperarse de una cuota agotada", () => {
    const message = evidenceStorageErrorMessage(
      new DOMException("storage full", "QuotaExceededError"),
    );

    expect(message).toMatch(/No hay espacio disponible/i);
    expect(message).toMatch(/copia del laboratorio/i);
  });

  it("explica cuando el navegador bloquea el almacenamiento", () => {
    const message = evidenceStorageErrorMessage(
      new DOMException("blocked", "SecurityError"),
      "restaurar la copia",
    );

    expect(message).toMatch(/bloqueó el almacenamiento local/i);
    expect(message).toMatch(/restaurar la copia/i);
  });

  it("mantiene los errores de validación que ya son claros", () => {
    expect(evidenceStorageErrorMessage(new Error("El PDF supera el límite.")))
      .toBe("El PDF supera el límite.");
  });
});
