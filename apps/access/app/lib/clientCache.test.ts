import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dedupedFetch,
  invalidateClientCache,
  readClientCache,
  writeClientCache,
} from "./clientCache";

describe("clientCache", () => {
  beforeEach(() => {
    invalidateClientCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads and writes cached values", () => {
    writeClientCache("test:key", { id: 1 });
    expect(readClientCache<{ id: number }>("test:key")).toEqual({ id: 1 });
  });

  it("expires entries after TTL", () => {
    writeClientCache("ttl:key", "value", 1000);
    vi.advanceTimersByTime(1001);
    expect(readClientCache("ttl:key")).toBeNull();
  });

  it("invalidates all entries when no prefix is given", () => {
    writeClientCache("a", 1);
    writeClientCache("b", 2);
    invalidateClientCache();
    expect(readClientCache("a")).toBeNull();
    expect(readClientCache("b")).toBeNull();
  });

  it("invalidates entries matching a prefix", () => {
    writeClientCache("map-pins:http://node", [1]);
    writeClientCache("map-pins:http://peer", [2]);
    writeClientCache("search:q", ["x"]);
    invalidateClientCache("map-pins:");
    expect(readClientCache("map-pins:http://node")).toBeNull();
    expect(readClientCache("map-pins:http://peer")).toBeNull();
    expect(readClientCache("search:q")).toEqual(["x"]);
  });

  it("deduplicates concurrent fetches", async () => {
    const fn = vi.fn().mockResolvedValue("result");
    const [a, b] = await Promise.all([
      dedupedFetch("dedup", fn),
      dedupedFetch("dedup", fn),
    ]);
    expect(a).toBe("result");
    expect(b).toBe("result");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
