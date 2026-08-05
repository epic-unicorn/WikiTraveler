import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { limitMock } = vi.hoisted(() => ({
  limitMock: vi.fn(),
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    vi.fn().mockImplementation(() => ({
      limit: limitMock,
    })),
    { slidingWindow: vi.fn(() => ({})) }
  ),
}));

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: vi.fn() },
}));

describe("middleware rate limiting", () => {
  beforeEach(async () => {
    vi.resetModules();
    limitMock.mockReset();
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    limitMock.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
  });

  it("returns 429 when auth route is rate limited", async () => {
    limitMock.mockResolvedValueOnce({ success: false, reset: Date.now() + 30_000 });
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
    });
    const res = await middleware(req);
    expect(res?.status).toBe(429);
    await expect(res?.json()).resolves.toMatchObject({
      message: expect.stringContaining("Too many requests"),
    });
    expect(res?.headers.get("Retry-After")).toBeTruthy();
  });

  it("skips rate limiting when Upstash is not configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
    });
    const res = await middleware(req);
    expect(res?.status).not.toBe(429);
    expect(limitMock).not.toHaveBeenCalled();
  });
});

describe("middleware dashboard role gate", () => {
  const setupFetch = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes("/api/setup")) {
      return new Response(JSON.stringify({ needed: false }), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });

  beforeEach(async () => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.stubGlobal("fetch", setupFetch);
  });

  function dashboardRequest(path: string, token?: string) {
    const headers = token ? { cookie: `wt_token=${encodeURIComponent(token)}` } : undefined;
    return new NextRequest(`http://localhost${path}`, { headers });
  }

  it("redirects unauthenticated users to login", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(dashboardRequest("/properties/p1"));
    expect(res?.headers.get("location")).toContain("/login");
  });

  it("clears USER tokens and redirects to login", async () => {
    const { fakeJwt } = await import("./test/jwtTestUtils");
    const { middleware } = await import("./middleware");
    const token = fakeJwt({ sub: "traveler", role: "USER" });
    const res = await middleware(dashboardRequest("/properties/p1", token));
    expect(res?.headers.get("location")).toContain("/login");
    expect(res?.cookies.get("wt_token")?.value).toBe("");
  });

  it("allows auditors on dashboard routes", async () => {
    const { fakeJwt } = await import("./test/jwtTestUtils");
    const { middleware } = await import("./middleware");
    const token = fakeJwt({ sub: "auditor", role: "AUDITOR" });
    const res = await middleware(dashboardRequest("/properties/p1", token));
    expect(res?.status).toBe(200);
  });
});

describe("middleware API CORS", () => {
  beforeEach(async () => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.CORS_ORIGINS = "https://access.wikitraveler.org";
    delete process.env.CLIENT_ORIGINS;
    delete process.env.ACCESS_PUBLIC_URL;
  });

  it("reflects trusted Origin on API GET", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/api/health", {
      headers: { origin: "https://access.wikitraveler.org" },
    });
    const res = await middleware(req);
    expect(res?.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://access.wikitraveler.org"
    );
    expect(res?.headers.get("Vary")).toBe("Origin");
  });

  it("omits Allow-Origin for untrusted Origin", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/api/health", {
      headers: { origin: "https://evil.example" },
    });
    const res = await middleware(req);
    expect(res?.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("answers OPTIONS preflight with 204", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/api/properties", {
      method: "OPTIONS",
      headers: { origin: "https://access.wikitraveler.org" },
    });
    const res = await middleware(req);
    expect(res?.status).toBe(204);
    expect(res?.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://access.wikitraveler.org"
    );
    expect(res?.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});
