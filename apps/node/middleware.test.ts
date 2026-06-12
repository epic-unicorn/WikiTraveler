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
