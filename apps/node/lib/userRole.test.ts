import { describe, expect, it } from "vitest";
import { canAccessDashboard, canContribute, decodeJwtPayload, roleFromToken } from "./userRole";
import { fakeJwt } from "../test/jwtTestUtils";

describe("userRole", () => {
  it("decodes JWT payload", () => {
    const token = fakeJwt({ sub: "alice", role: "AUDITOR" });
    expect(decodeJwtPayload(token)).toMatchObject({ sub: "alice", role: "AUDITOR" });
  });

  it("maps AUDITOR and ADMIN from token", () => {
    expect(roleFromToken(fakeJwt({ role: "AUDITOR" }))).toBe("AUDITOR");
    expect(roleFromToken(fakeJwt({ role: "admin" }))).toBe("ADMIN");
  });

  it("defaults to USER for missing or unknown roles", () => {
    expect(roleFromToken(null)).toBe("USER");
    expect(roleFromToken(fakeJwt({ role: "USER" }))).toBe("USER");
    expect(roleFromToken(fakeJwt({}))).toBe("USER");
  });

  it("canAccessDashboard allows auditors and admins only", () => {
    expect(canAccessDashboard("USER")).toBe(false);
    expect(canAccessDashboard("AUDITOR")).toBe(true);
    expect(canAccessDashboard("ADMIN")).toBe(true);
    expect(canContribute("AUDITOR")).toBe(true);
  });
});
