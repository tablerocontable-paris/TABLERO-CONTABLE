// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { acquireEvidenceMutationLock } from "../src/data/laboratoryEvidence";

const originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks");

afterEach(() => {
  if (originalLocks) Object.defineProperty(navigator, "locks", originalLocks);
  else Reflect.deleteProperty(navigator, "locks");
});

describe("exclusión entre pestañas para evidencia local", () => {
  it.each([
    ["rechaza antes de ejecutar el callback", "rejects"],
    ["lanza antes de crear la solicitud", "throws"],
  ])("propaga el fallo cuando Web Locks %s", async (_description, mode) => {
    const failure = new DOMException("Permiso de bloqueo denegado", "SecurityError");
    const request = vi.fn(() => {
      if (mode === "throws") throw failure;
      return Promise.reject(failure);
    });
    Object.defineProperty(navigator, "locks", { configurable: true, value: { request } });

    await expect(acquireEvidenceMutationLock()).rejects.toBe(failure);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("sólo libera el lock después de terminar el trabajo protegido", async () => {
    const request = vi.fn((_name: string, _options: unknown, callback: () => Promise<void>) => {
      return Promise.resolve().then(callback);
    });
    Object.defineProperty(navigator, "locks", { configurable: true, value: { request } });

    const acquired = acquireEvidenceMutationLock();
    const release = await acquired;
    let requestSettled = false;
    void request.mock.results[0]?.value?.then(() => { requestSettled = true; });
    await Promise.resolve();
    expect(requestSettled).toBe(false);
    release();
    await request.mock.results[0]?.value;
    expect(requestSettled).toBe(true);
  });
});
