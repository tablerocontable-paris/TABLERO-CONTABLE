import { describe, expect, it } from "vitest";
import { seed } from "../src/data/repository";
import { closeMonth, materialize, currentMonth } from "../src/domain/model";
import { standardizeAssignment } from "../src/domain/catalogue";
import { defaultSchedule } from "../src/domain/schedule";

describe("catálogo común y reportes de cierre", () => {
  it("conserva identidad y controles entre empresas sin compartir estado", () => {
    const s = seed();
    const a = s.assignments[0];
    const first = standardizeAssignment(s, {
      ...a,
      title: "Nombre libre",
      steps: ["Control distinto"],
    });
    const second = standardizeAssignment(s, {
      ...a,
      id: "second",
      companyId: "c2",
      title: "Otro nombre",
    });
    expect(first.title).toBe(second.title);
    expect(first.steps).toEqual(second.steps);
    expect(first.steps).not.toBe(second.steps);
    expect(first.companyId).not.toBe(second.companyId);
    expect(first.id).not.toBe(second.id);
  });
  it("requiere catálogo para recurrencias libres pero admite intervenciones puntuales", () => {
    const s = seed();
    const a = {
      ...s.assignments[0],
      templateId: null,
      schedule: defaultSchedule("2026-09-01", "semanal"),
    };
    expect(() => standardizeAssignment(s, a)).toThrow("habituales");
    expect(
      standardizeAssignment(s, {
        ...a,
        schedule: defaultSchedule("2026-09-01"),
      }).templateId,
    ).toBeNull();
  });
  it("emite un reporte único por empleado y consolida todas sus empresas", () => {
    const month = currentMonth();
    let s = materialize(seed(), month);
    const owner = s.tasks.find((t) => t.month === month)!.ownerId;
    s = closeMonth(s, owner, month, "boss", "Revisión del período");
    const c = s.closures[0];
    expect(c.report?.recipientIds).toContain("boss");
    expect(c.report?.delivery).toBe("disponible en demostración");
    expect(c.report?.groups.length).toBeGreaterThan(0);
    expect(new Set(c.report!.groups.map((g) => g.company)).size).toBe(
      new Set(c.tasks.map((t) => t.companyId)).size,
    );
    expect(c.tasks.every((t) => t.templateId)).toBe(true);
    expect(() => closeMonth(s, owner, month, "boss", "Otra revisión")).toThrow(
      "cerrado",
    );
    expect(s.closures).toHaveLength(1);
  });
  it("preserva identidad, pesos y resumen aunque el catálogo y perfiles cambien después", () => {
    const month = currentMonth();
    let s = materialize(seed(), month);
    const owner = s.tasks.find((t) => t.month === month)!.ownerId;
    s = closeMonth(s, owner, month, "boss", "Cierre");
    const before = structuredClone(s.closures[0]);
    s.profiles.find((p) => p.id === owner)!.name = "Nombre cambiado";
    s.templates.forEach((t) => {
      t.title = "Nuevo estándar";
      t.weight = 8;
    });
    s.tasks.forEach((t) => {
      t.title = "Otra tarea";
      t.weight = 8;
    });
    expect(s.closures[0]).toEqual(before);
  });
});
