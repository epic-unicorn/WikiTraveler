import { describe, expect, it } from "vitest";
import { resolveUpstashRestEnv } from "./upstashRedis";

describe("resolveUpstashRestEnv", () => {
  it("prefers UPSTASH_REDIS_REST_* when set", () => {
    expect(
      resolveUpstashRestEnv({
        UPSTASH_REDIS_REST_URL: "https://upstash.example",
        UPSTASH_REDIS_REST_TOKEN: "upstash-token",
        KV_REST_API_URL: "https://kv.example",
        KV_REST_API_TOKEN: "kv-token",
      })
    ).toEqual({
      url: "https://upstash.example",
      token: "upstash-token",
    });
  });

  it("falls back to Vercel Marketplace KV_REST_API_*", () => {
    expect(
      resolveUpstashRestEnv({
        KV_REST_API_URL: "https://kv.example",
        KV_REST_API_TOKEN: "kv-token",
      })
    ).toEqual({
      url: "https://kv.example",
      token: "kv-token",
    });
  });

  it("returns null when neither pair is complete", () => {
    expect(resolveUpstashRestEnv({})).toBeNull();
    expect(
      resolveUpstashRestEnv({ UPSTASH_REDIS_REST_URL: "https://x.example" })
    ).toBeNull();
    expect(resolveUpstashRestEnv({ KV_REST_API_TOKEN: "only-token" })).toBeNull();
  });
});
