// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import TimelinessBadge from "../src/components/TimelinessBadge";
import TimelinessPanel from "../src/components/TimelinessPanel";
import type { TimelinessSummary } from "../src/domain/timeliness";

afterEach(cleanup);

const empty = {
  evaluated: 0, early: 0, onDate: 0, late: 0, pending: 0, overdue: 0,
  noDeadline: 0, unknown: 0, earlyRate: null, averageDaysAhead: null,
};

describe("presentación de anticipación", () => {
  it("aclara que el objetivo operativo se acredita al registrarlo", () => {
    render(<TimelinessBadge value={{ status: "early", achievementAt: "2026-10-08T12:00:00Z", daysAhead: 2, evidence: "registered-target" }} />);
    expect(screen.getByText("Meta registrada 2 días antes")).toBeTruthy();
  });

  it("presenta muestras vacías y promedios separados para metas operativas", () => {
    const value: TimelinessSummary = {
      version: 1,
      results: { ...empty },
      operational: { ...empty, evaluated: 2, early: 1, earlyRate: 50, averageDaysAhead: 3 },
      total: { ...empty },
    };
    render(<TimelinessPanel value={value} rows={[{ id: "e0", name: "Empleado", timeliness: value }]} />);
    expect(screen.getAllByText("Sin muestra").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3 días antes (promedio de anticipados)").length).toBe(2);
    expect(screen.getByText("Anticipación media de metas")).toBeTruthy();
  });
});
