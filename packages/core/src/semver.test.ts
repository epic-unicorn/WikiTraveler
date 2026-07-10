import { describe, expect, it } from "vitest";
import { compareSemver, isSemverBelow, minorVersionGap, parseSemver } from "./semver";

describe("parseSemver", () => {
  it("parses standard versions", () => {
    expect(parseSemver("0.2.0")).toEqual({ major: 0, minor: 2, patch: 0 });
  });

  it("ignores prerelease suffix", () => {
    expect(parseSemver("1.0.0-rc.1")).toEqual({ major: 1, minor: 0, patch: 0 });
  });
});

describe("compareSemver", () => {
  it("orders versions", () => {
    expect(compareSemver("0.2.0", "0.3.0")).toBe(-1);
    expect(compareSemver("0.3.0", "0.2.0")).toBe(1);
    expect(compareSemver("0.2.0", "0.2.0")).toBe(0);
  });
});

describe("isSemverBelow", () => {
  it("detects older versions", () => {
    expect(isSemverBelow("0.1.0", "0.2.0")).toBe(true);
    expect(isSemverBelow("0.2.0", "0.2.0")).toBe(false);
  });
});

describe("minorVersionGap", () => {
  it("returns gap within major", () => {
    expect(minorVersionGap("0.2.0", "0.1.0")).toBe(1);
  });
});
