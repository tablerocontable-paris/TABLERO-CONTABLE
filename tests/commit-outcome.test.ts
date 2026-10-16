import { describe, expect, it } from "vitest";
import { classifyCommitStorageFailure } from "../src/data/repository";

describe("resultado explícito de escritura local", () => {
  it("reconoce una escritura que quedó persistida aunque setItem haya lanzado", () => {
    expect(classifyCommitStorageFailure({
      expected: "candidate", previousRaw: "before", previousRead: true,
      actualRaw: "candidate", actualRead: true,
    })).toEqual({ status: "committed" });
  });

  it("confirma rechazo sólo si el estado previo sigue exactamente intacto", () => {
    expect(classifyCommitStorageFailure({
      expected: "candidate", previousRaw: "before", previousRead: true,
      actualRaw: "before", actualRead: true,
    })).toEqual({ status: "rejected" });
  });

  it("mantiene incertidumbre si no se puede leer o el contenido cambió", () => {
    expect(classifyCommitStorageFailure({
      expected: "candidate", previousRaw: "before", previousRead: true, actualRead: false,
    })).toEqual({ status: "unknown" });
    expect(classifyCommitStorageFailure({
      expected: "candidate", previousRaw: "before", previousRead: true,
      actualRaw: "other-write", actualRead: true,
    })).toEqual({ status: "unknown" });
    expect(classifyCommitStorageFailure({
      expected: "candidate", previousRaw: null, previousRead: false,
      actualRaw: null, actualRead: true,
    })).toEqual({ status: "unknown" });
  });
});
