import { describe, expect, it } from "vitest";
import { decodeContextV1 } from "../src/data/supabase/context-contract";

const uuid = (n: number) =>
  `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const business = {
  contractVersion: 1,
  principal: {
    kind: "business",
    id: uuid(1),
    organizationId: uuid(2),
    displayName: "Valentino Magni",
    role: "empleado",
    teamIds: [uuid(3), uuid(4)],
    companyIds: [uuid(5)],
  },
  authentication: { aal: "aal1", requiresMfa: false },
  capabilities: [],
};

describe("decodeContextV1", () => {
  it("accepts exact business and technical DTOs", () => {
    expect(decodeContextV1(business)).toEqual({ ok: true, context: business });
    const technical = {
      contractVersion: 1,
      principal: {
        kind: "technical",
        id: uuid(6),
        organizationId: uuid(2),
        displayName: "Maintainer",
        role: "maintainer",
      },
      authentication: { aal: "aal1", requiresMfa: true },
      capabilities: [],
    };
    expect(decodeContextV1(technical)).toEqual({
      ok: true,
      context: technical,
    });
  });

  it.each([
    ["unknown contract", { ...business, contractVersion: 2 }],
    ["extra field", { ...business, email: "private@example.test" }],
    [
      "nested secret",
      { ...business, principal: { ...business.principal, token: "secret" } },
    ],
    [
      "invalid UUID",
      { ...business, principal: { ...business.principal, id: "not-a-uuid" } },
    ],
    [
      "empty name",
      { ...business, principal: { ...business.principal, displayName: "  " } },
    ],
    [
      "unsupported business role",
      { ...business, principal: { ...business.principal, role: "auditor" } },
    ],
    [
      "duplicate memberships",
      {
        ...business,
        principal: { ...business.principal, teamIds: [uuid(3), uuid(3)] },
      },
    ],
    [
      "unsorted memberships",
      {
        ...business,
        principal: { ...business.principal, teamIds: [uuid(4), uuid(3)] },
      },
    ],
    [
      "incoherent MFA",
      { ...business, principal: { ...business.principal, role: "jefe" } },
    ],
    ["invented capability", { ...business, capabilities: ["admin"] }],
    ["full state", { ...business, tasks: [] }],
  ])("rejects %s without echoing input", (_label, input) => {
    const result = decodeContextV1(input);
    expect(result).toEqual({ ok: false, error: "protocol" });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("requires MFA for aal1 supervisors and technical principals only", () => {
    for (const role of ["jefe", "encargado"]) {
      expect(
        decodeContextV1({
          ...business,
          principal: { ...business.principal, role },
          authentication: { aal: "aal1", requiresMfa: true },
        }).ok,
      ).toBe(true);
      expect(
        decodeContextV1({
          ...business,
          principal: { ...business.principal, role },
          authentication: { aal: "aal2", requiresMfa: false },
        }).ok,
      ).toBe(true);
    }
    expect(
      decodeContextV1({
        ...business,
        authentication: { aal: "aal2", requiresMfa: false },
      }).ok,
    ).toBe(true);
  });
});
