// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { isLaboratoryStateCurrent, load, persist, seed, StaleLaboratoryStateError } from "../src/data/repository";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("evidencia y estado durable entre pestañas", () => {
  it("acepta el snapshot sólo mientras coincide con el estado almacenado", () => {
    localStorage.setItem("paris-state-lab", JSON.stringify(seed()));
    const expected = load(true);
    expect(isLaboratoryStateCurrent(expected)).toBe(true);

    const restored = structuredClone(expected);
    restored.profiles[0].name = "Perfil restaurado en otra pestaña";
    restored.labRevision = "revision-de-otra-pestana";
    localStorage.setItem("paris-state-lab", JSON.stringify(restored));
    expect(isLaboratoryStateCurrent(expected)).toBe(false);
  });

  it("falla cerrado cuando no puede leer localStorage", () => {
    const expected = seed();
    localStorage.setItem("paris-state-lab", JSON.stringify(expected));
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    expect(isLaboratoryStateCurrent(expected)).toBe(false);
  });

  it("renueva el token en escrituras directas y rechaza un snapshot anterior", () => {
    const first = seed();
    persist(first, true);
    const firstRevision = first.labRevision;
    const current = load(true);
    current.profiles[0].name = "Cambio durable";
    persist(current, true);

    const secondRevision = load(true).labRevision;
    expect(secondRevision).toBeTruthy();
    expect(secondRevision).not.toBe(firstRevision);
    expect(() => persist(first, true)).toThrow(StaleLaboratoryStateError);
    expect(load(true).profiles[0].name).toBe("Cambio durable");
  });
});
