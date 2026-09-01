import { describe, expect, it } from "vitest";
import { dataNodeFromResolve, isConfirmedUncovered } from "./peerCoverage";

describe("dataNodeFromResolve", () => {
  it("uses home when resolve failed (auth/network) instead of treating as uncovered", () => {
    expect(dataNodeFromResolve(null, "http://home")).toEqual({
      url: "http://home",
      matched: "home",
    });
  });

  it("uses self and peer URLs when a bbox contains the point", () => {
    expect(
      dataNodeFromResolve({ url: "http://home", region: "NL", matched: "self" }, "http://home")
    ).toEqual({ url: "http://home", matched: "self" });
    expect(
      dataNodeFromResolve({ url: "http://peer", region: "BE", matched: "peer" }, "http://home")
    ).toEqual({ url: "http://peer", matched: "peer" });
  });

  it("still uses the fallback node URL so callers can fetch before showing uncovered", () => {
    expect(
      dataNodeFromResolve({ url: "http://home", region: null, matched: "fallback" }, "http://home")
    ).toEqual({ url: "http://home", matched: "fallback" });
  });
});

describe("isConfirmedUncovered", () => {
  it("is only true after fallback resolve with an empty fetch", () => {
    expect(isConfirmedUncovered("fallback", 0)).toBe(true);
    expect(isConfirmedUncovered("fallback", 3)).toBe(false);
    expect(isConfirmedUncovered("self", 0)).toBe(false);
    expect(isConfirmedUncovered("home", 0)).toBe(false);
    expect(isConfirmedUncovered("peer", 0)).toBe(false);
  });
});
