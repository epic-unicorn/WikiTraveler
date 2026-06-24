import { describe, expect, it } from "vitest";
import { canContribute, decodeJwtPayload, roleFromToken } from "./userRole";
import { fakeJwt } from "../../test/jwtTestUtils";

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
    expect(roleFromToken("not-a-jwt")).toBe("USER");
  });

  it("canContribute allows auditors and admins only", () => {
    expect(canContribute("USER")).toBe(false);
    expect(canContribute("AUDITOR")).toBe(true);
    expect(canContribute("ADMIN")).toBe(true);
  });
});
