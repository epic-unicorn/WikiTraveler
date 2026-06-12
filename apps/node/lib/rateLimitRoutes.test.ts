import { describe, expect, it } from "vitest";
import { getClientIp, getRateLimitProfile } from "./rateLimitRoutes";

describe("getRateLimitProfile", () => {
  it("matches POST /api/auth/login as auth", () => {
    expect(getRateLimitProfile("/api/auth/login", "POST")).toBe("auth");
  });

  it("matches POST /api/auth/register as auth", () => {
    expect(getRateLimitProfile("/api/auth/register", "POST")).toBe("auth");
  });

  it("matches POST accessibility audit as audit", () => {
    expect(
      getRateLimitProfile("/api/properties/prop-1/accessibility", "POST")
    ).toBe("audit");
  });

  it("ignores GET requests", () => {
    expect(getRateLimitProfile("/api/auth/login", "GET")).toBeNull();
  });

  it("ignores unrelated routes", () => {
    expect(getRateLimitProfile("/api/health", "POST")).toBeNull();
  });
});

describe("getClientIp", () => {
  it("uses the first x-forwarded-for address", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(getClientIp(headers)).toBe("9.9.9.9");
  });

  it("returns anonymous when no IP headers are present", () => {
    expect(getClientIp(new Headers())).toBe("anonymous");
  });
});
