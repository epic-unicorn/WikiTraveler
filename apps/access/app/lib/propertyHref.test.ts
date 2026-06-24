import { describe, expect, it } from "vitest";
import { auditHref, propertyHref, propertyOrAuditHref } from "./propertyHref";

const HOME = "http://localhost:3000";
const PEER = "http://peer:3000";

describe("propertyHref", () => {
  it("omits node param when property is on home node", () => {
    expect(propertyHref("p1", HOME, HOME)).toBe("/properties/p1");
  });

  it("includes node param for peer properties", () => {
    expect(propertyHref("p1", PEER, HOME)).toBe("/properties/p1?node=http%3A%2F%2Fpeer%3A3000");
  });
});

describe("auditHref", () => {
  it("builds audit path with optional peer node param", () => {
    expect(auditHref("p1", HOME, HOME)).toBe("/audit/p1");
    expect(auditHref("p1", PEER, HOME)).toBe("/audit/p1?node=http%3A%2F%2Fpeer%3A3000");
  });
});

describe("propertyOrAuditHref", () => {
  it("routes travelers to property detail", () => {
    expect(propertyOrAuditHref("p1", HOME, HOME, false)).toBe("/properties/p1");
    expect(propertyOrAuditHref("p1", PEER, HOME, false)).toBe(
      "/properties/p1?node=http%3A%2F%2Fpeer%3A3000"
    );
  });

  it("routes contributors to audit wizard", () => {
    expect(propertyOrAuditHref("p1", HOME, HOME, true)).toBe("/audit/p1");
    expect(propertyOrAuditHref("p1", PEER, HOME, true)).toBe(
      "/audit/p1?node=http%3A%2F%2Fpeer%3A3000"
    );
  });
});
