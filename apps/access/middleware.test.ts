import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { fakeJwt } from "./test/jwtTestUtils";

function request(path: string, token?: string) {
  const url = `http://localhost:3001${path}`;
  const headers = token ? { cookie: `wt_token=${encodeURIComponent(token)}` } : undefined;
  return new NextRequest(url, { headers });
}

describe("access middleware", () => {
  it("redirects unauthenticated users to login", () => {
    const res = middleware(request("/"));
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("/login");
  });

  it("allows login and register without a token", () => {
    expect(middleware(request("/login"))?.status).toBe(200);
    expect(middleware(request("/register"))?.status).toBe(200);
  });

  it("redirects USER from audit routes to property detail", () => {
    const token = fakeJwt({ sub: "traveler", role: "USER" });
    const res = middleware(request("/audit/prop-123", token));
    expect(res?.headers.get("location")).toContain("/properties/prop-123");
  });

  it("allows AUDITOR on audit routes", () => {
    const token = fakeJwt({ sub: "auditor", role: "AUDITOR" });
    const res = middleware(request("/audit/prop-123", token));
    expect(res?.status).toBe(200);
  });

  it("redirects USER from properties/new to home", () => {
    const token = fakeJwt({ sub: "traveler", role: "USER" });
    const res = middleware(request("/properties/new", token));
    expect(res?.headers.get("location")).toMatch(/\/$/);
  });

  it("preserves query params when redirecting audit to property", () => {
    const token = fakeJwt({ sub: "traveler", role: "USER" });
    const res = middleware(request("/audit/prop-123?node=http%3A%2F%2Fpeer", token));
    const location = res?.headers.get("location") ?? "";
    expect(location).toContain("/properties/prop-123");
    expect(location).toContain("node=");
  });
});
