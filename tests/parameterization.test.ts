import { describe, expect, it } from "vitest";
import { seed } from "../src/data/repository";
import {
  confirmParameters,
  pendingParameterizations,
  prepareLaboratoryInvitation,
} from "../src/domain/parameterization";
import { applyProposal, projectState } from "../src/server/site-policy";
import type { State } from "../src/domain/model";

const stamp = "2026-10-06T18:00:00.000Z";
function prepared() {
  const s = seed();
  s.onboarding.e0.completedAt = stamp;
  return s;
}
function values(s: State) {
  return s.assignments
    .filter((a) => a.ownerId === "e0" && !a.retired)
    .map((a) => ({
      id: a.id,
      weight: 7,
      target: a.kind === "operativa" ? 90 : a.target,
    }));
}
describe("perfil, invitación de laboratorio y parametrización", () => {
  it("first invitation preserves preconfigured boss role and scopes without creating an account", () => {
    const s = prepared(),
      next = prepareLaboratoryInvitation(s, "boss");
    expect(next.profiles).toEqual(s.profiles);
    expect(next.activeId).toBe("boss");
    expect(next.onboarding.boss.completedAt).toBeNull();
    expect(next.onboarding.boss.selectedCompanyIds).toEqual(
      s.profiles[0].companyIds,
    );
    expect(next.tasks).toEqual(s.tasks);
  });
  it("blocks invitations to unconfigured or inactive profiles", () => {
    const s = prepared();
    expect(() => prepareLaboratoryInvitation(s, "unknown")).toThrow();
    s.profiles.find((p) => p.id === "e0")!.managerId = "unknown";
    expect(() => prepareLaboratoryInvitation(s, "e0")).toThrow(/Completá/);
    s.profiles[0].active = false;
    expect(() => prepareLaboratoryInvitation(s, "boss")).toThrow();
  });
  it("notifies for completed profiles, not drafts, bosses or inactive people", () => {
    const s = prepared();
    s.onboarding.e1.completedAt = null;
    s.profiles.find((p) => p.id === "e2")!.active = false;
    const ids = pendingParameterizations(s).map((p) => p.id);
    expect(ids).toContain("e0");
    expect(ids).not.toContain("e1");
    expect(ids).not.toContain("e2");
    expect(ids).not.toContain("boss");
  });
  it("confirmation updates future assignment parameters and preserves started/completed work", () => {
    const s = prepared();
    const historical = structuredClone(s.tasks);
    const next = confirmParameters(s, "e0", "boss", values(s), stamp);
    expect(next.tasks).toEqual(historical);
    expect(
      next.assignments
        .filter((a) => a.ownerId === "e0")
        .every((a) => a.weight === 7),
    ).toBe(true);
    expect(pendingParameterizations(next).some((p) => p.id === "e0")).toBe(
      false,
    );
    expect(next.parameterReviews?.e0.reviewedBy).toBe("boss");
  });
  it("updates only untouched task snapshots and retains closed snapshots", () => {
    const s = prepared();
    const t = s.tasks.find((t) => t.ownerId === "e0")!;
    Object.assign(t, {
      status: "Pendiente",
      startedAt: null,
      completedAt: null,
      sessions: [],
    });
    t.checklist.forEach((c) => (c.done = false));
    s.activity = s.activity.filter((a) => a.taskId !== t.id);
    expect(
      confirmParameters(s, "e0", "boss", values(s)).tasks.find(
        (x) => x.id === t.id,
      )?.weight,
    ).toBe(7);
  });
  it("employees cannot confirm parameters and invalid/partial values fail", () => {
    const s = prepared();
    expect(() => confirmParameters(s, "e0", "e0", values(s))).toThrow(
      /jefatura/,
    );
    expect(() =>
      confirmParameters(s, "e0", "boss", values(s).slice(1)),
    ).toThrow(/Revisá/);
    expect(() =>
      confirmParameters(
        s,
        "e0",
        "boss",
        values(s).map((v) => ({ ...v, weight: NaN })),
      ),
    ).toThrow();
  });
  it("keeps a resolved notice resolved on reload, and a new completed induction needs a new review", () => {
    const initial = prepared();
    let s = confirmParameters(initial, "e0", "boss", values(initial), stamp);
    expect(
      pendingParameterizations(JSON.parse(JSON.stringify(s))).some(
        (p) => p.id === "e0",
      ),
    ).toBe(false);
    s.onboarding.e0.completedAt = "2026-10-07T18:00:00.000Z";
    expect(pendingParameterizations(s).some((p) => p.id === "e0")).toBe(true);
  });
  it("server rejects forged reviews, stamps approved reviews itself and hides peer reviews", () => {
    const s = prepared(),
      boss = s.profiles.find((p) => p.id === "boss")!;
    const proposal = confirmParameters(s, "e0", "boss", values(s), stamp);
    proposal.parameterReviews!.e0.reviewedBy = "e0";
    const next = applyProposal(
      s,
      proposal,
      boss,
      "Confirmó pesos",
      "e0",
      stamp,
    );
    expect(next.parameterReviews!.e0.reviewedBy).toBe("boss");
    expect(next.parameterReviews!.e0.reviewedAt).toBe(stamp);
    const e1 = s.profiles.find((p) => p.id === "e1")!;
    expect(projectState(next, e1).parameterReviews?.e0).toBeUndefined();
    const employee = s.profiles.find((p) => p.id === "e0")!;
    const forged = projectState(s, employee);
    forged.parameterReviews = proposal.parameterReviews;
    expect(() => applyProposal(s, forged, employee, "", "")).toThrow(
      /jefatura/,
    );
  });
});
