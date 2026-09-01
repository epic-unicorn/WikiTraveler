import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchOpenRegistration } from "./nodeRegistration";

describe("fetchOpenRegistration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when the node allows open registration", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ openRegistration: true }),
      })
    );

    await expect(
      fetchOpenRegistration("https://node-eu.wikitraveler.org")
    ).resolves.toBe(true);
  });

  it("returns false when registration is closed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ openRegistration: false }),
      })
    );

    await expect(
      fetchOpenRegistration("https://node-eu.wikitraveler.org")
    ).resolves.toBe(false);
  });

  it("returns null for invalid node URLs", async () => {
    await expect(fetchOpenRegistration("not-a-url")).resolves.toBeNull();
  });
});
