import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  readCache,
  writeCache,
  invalidateCache,
  cachedFetch,
  accessibilityCacheKey,
  searchCacheKey,
  healthCacheKey,
  CACHE_TTL,
} from "./lensCache.js";

beforeEach(() => {
  invalidateCache();
  vi.useRealTimers();
});

describe("lensCache", () => {
  it("round-trips values within TTL", () => {
    writeCache("k", { ok: true }, 5000);
    expect(readCache("k")).toEqual({ ok: true });
  });

  it("expires entries after TTL", () => {
    vi.useFakeTimers();
    writeCache("ttl", "v", 1000);
    expect(readCache("ttl")).toBe("v");
    vi.advanceTimersByTime(1001);
    expect(readCache("ttl")).toBeNull();
  });

  it("invalidates by prefix", () => {
    writeCache("a11y:n:1", 1);
    writeCache("search:n:q", 2);
    invalidateCache("a11y:");
    expect(readCache("a11y:n:1")).toBeNull();
    expect(readCache("search:n:q")).toBe(2);
  });

  it("dedupes concurrent fetches and caches the result", async () => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return { calls };
    };
    const [a, b] = await Promise.all([
      cachedFetch("dup", fn, 5000),
      cachedFetch("dup", fn, 5000),
    ]);
    expect(calls).toBe(1);
    expect(a).toEqual({ calls: 1 });
    expect(b).toEqual({ calls: 1 });
    expect(await cachedFetch("dup", fn, 5000)).toEqual({ calls: 1 });
    expect(calls).toBe(1);
  });

  it("builds stable cache keys", () => {
    expect(accessibilityCacheKey("https://n.example/", "p1")).toBe("a11y:https://n.example:p1");
    expect(searchCacheKey("https://n.example", "  The Match ")).toBe(
      "search:https://n.example:the match"
    );
    expect(healthCacheKey("https://n.example/")).toBe("health:https://n.example");
    expect(CACHE_TTL.health).toBeLessThan(CACHE_TTL.accessibility);
  });
});
